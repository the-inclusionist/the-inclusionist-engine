// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/screen-text — WHAT IS ON THE SCREEN NOW, AS TEXT: what the sonar reads (ADR-0234).
//
// The Dev: «O sonar, ao ser apertado com texto na tela faz com que o texto seja lido. […] não é fila de mensagens nem "só a
// última", mas sim "sonar do que está na tela"». So the sonar's words are read from the page AT THE PRESS — never a copy taken
// earlier, which would read the question the child already answered.
//
// WHAT «ON SCREEN» MEANS, in this order:
//   1. a dialog open in front (the pause card, a settings panel, a notice): ITS text — it covers the world, and it is what the
//      child is looking at. The front one is the one holding the focus, else the last one open; the layers under it are `inert`.
//   2. otherwise the world the game declared (`world: { kind: 'element' }`), in DOM order — the programmatic reading order a
//      page has to make meaningful (WCAG 1.3.2); sorting by geometry breaks on layers that overlap.
// Skipped everywhere: what is not shown (`hidden`, `display: none`, `visibility: hidden`, transparent), `aria-hidden` and
// `inert` subtrees, and the engine's own chrome that the child did not ask about — the quick bar, the footer (sound caption,
// button legend, explanation), the scan chip, the on-screen pad, the camera overlays, screen-reader-only text, and the
// session clock. The HUD's OTHER numbers are read: they are the ones the GAME declared in `hud` to show (its points, mission,
// power and learning bars), which is what is on screen for the game; the session clock is the engine's measure of the
// session, not the game, and read at every press it would put the time into every answer.
//
// ⚠️ A WORLD DRAWN ON A CANVAS CANNOT BE READ: its words are pixels. Then this answers nothing, the sonar keeps its navigation
// sentence, and `problems` says so (ADR-0169). A contract field through which a game hands its screen's text is the Dev's
// decision, not this module's.
//
// It receives the document and reaches no global (ADR-0232).
import type { Action } from '../core/actions.js';
import type { WorldScope } from '../core/contract.js';

/**
 * THE SONAR'S POSITION WHILE A MENU IS OPEN. In play the position is the game's (its `preset`); with a menu open the positions
 * are the engine's, and there R1 reads the menu — the Dev's default for the sonar («Tecla padrão para o sonar deve ser R1»).
 */
const MENU_SONAR: Action = 'rightShoulder';

/** The engine's chrome the child did not ask about (see the header). */
const NOT_ASKED_ABOUT = [
  '.pause-icons', '.screen-a11y', '.rodape-da-tela', '.scan-now', '#touch-controls', '.touch', '.sr-only',
  '.gaze-overlay', '.face-overlay', '.hand-overlay', '.hud-row-clock',
].join(', ');
/** What is open in front of the world. */
const DIALOG = '[role="dialog"], [role="alertdialog"], [aria-modal="true"]';
/** Elements whose content is not words on the screen (a `<select>` shows its chosen option only — see `spokenAs`). */
const NOT_WORDS = /^(script|style|template|noscript|svg|canvas|video|audio|iframe|object|option|optgroup)$/i;
/** A line that already ends a sentence is not given a full stop. */
const ENDS_A_SENTENCE = /[.!?…:;]$/u;

/** What the reader is built over. Both are read at every call: a `mount()` swaps the cartridge, a panel opens. */
export interface ScreenTextCtx {
  /** The root's document. */
  readonly doc: Document;
  /** The world the mounted game declares (`GameDeclaration.world`). */
  readonly world: () => WorldScope;
}

/**
 * Is this one element drawn for the eye, and meant for everyone? Its ancestors are asked by whoever walks down to it.
 * 📌 The RENDERING decides, not the `hidden` attribute: `hidden` hides by `display: none`, which is read here, and a stylesheet
 * that shows a `[hidden]` element puts it on the screen.
 */
function isShown(el: Element): boolean {
  if (el.hasAttribute('inert') || el.getAttribute('aria-hidden') === 'true') return false;
  const style = el.ownerDocument?.defaultView?.getComputedStyle(el);
  return !style || (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0');
}

/** Is it drawn, with every ancestor drawn too? For an element found by a query rather than walked down to. */
function isOnScreen(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) if (!isShown(node)) return false;
  return true;
}

/**
 * Can this node be walked and asked? A host double may hand elements without the DOM's questions; then there is nothing the
 * engine can read, and it says nothing rather than throwing into the sonar (a capability of the environment, ADR-0169).
 */
function canBeRead(el: Element | null): el is Element {
  return !!el && typeof el.matches === 'function' && typeof el.querySelectorAll === 'function' && typeof el.hasAttribute === 'function';
}

/** The dialog in front, or `null`: the one holding the focus, else the last one open in the document. */
function dialogInFront(doc: Document): Element | null {
  if (typeof doc.querySelectorAll !== 'function') return null;
  const open = [...doc.querySelectorAll(DIALOG)].filter((d) => canBeRead(d) && isOnScreen(d) && !d.matches(NOT_ASKED_ABOUT));
  const focused = doc.activeElement;
  return open.find((d) => !!focused && d.contains(focused)) ?? open[open.length - 1] ?? null;
}

/** The world's element, or `null` when the game declared none, its selector matches nothing, or it cannot be read. */
function worldElement(ctx: ScreenTextCtx): Element | null {
  const scope = ctx.world();
  const el = scope.kind === 'element' && typeof ctx.doc.querySelector === 'function' ? ctx.doc.querySelector(scope.selector) : null;
  return canBeRead(el) ? el : null;
}

/** Does the world draw on a canvas the engine did not put there? Then its words are pixels. */
function drawsOnCanvas(world: Element): boolean {
  const canvases = world.matches('canvas') ? [world] : [...world.querySelectorAll('canvas')];
  return canvases.some((c) => !c.closest(NOT_ASKED_ABOUT) && isOnScreen(c));
}

/** The words an element stands for instead of its children, or `null` to read its children. */
function spokenAs(el: Element): string | null {
  if (el.getAttribute('role') === 'img') return el.getAttribute('aria-label') ?? '';
  if (el.localName === 'img') return el.getAttribute('alt') ?? '';
  if (el.localName === 'select') return (el as HTMLSelectElement).selectedOptions[0]?.textContent ?? '';
  return null;
}

/** Does the element start a line of its own? Everything that is not inline does — a button, a heading, a row. */
function breaksTheLine(el: Element): boolean {
  const display = el.ownerDocument?.defaultView?.getComputedStyle(el).display ?? 'block';
  return el.localName === 'br' || (display !== 'inline' && display !== 'contents');
}

/**
 * The text under `root`, in DOM order, one line per block. Lines are joined as sentences, so the voice pauses between the
 * statement and each option and the interpreter receives them apart.
 */
function textOf(root: Element): string {
  const lines: string[] = [];
  let line = '';
  const endLine = (): void => {
    const words = line.replace(/\s+/gu, ' ').trim();
    if (words) lines.push(words);
    line = '';
  };
  const readChildren = (el: Element): void => {
    for (const child of el.childNodes ?? []) {
      if (child.nodeType === 3) line += child.textContent ?? '';
      else if (child.nodeType === 1) visit(child as Element);
    }
  };
  const visit = (el: Element): void => {
    if (!isShown(el) || el.matches(NOT_ASKED_ABOUT) || NOT_WORDS.test(el.localName)) return;
    const own = breaksTheLine(el);
    if (own) endLine();
    const said = spokenAs(el);
    if (said === null) readChildren(el); else line += ` ${said} `;
    if (own) endLine();
  };
  visit(root);
  endLine();
  return lines.map((l) => (ENDS_A_SENTENCE.test(l) ? l : `${l}.`)).join(' ');
}

/**
 * WHAT IS ON THE SCREEN NOW, as the sonar reads it — `''` when there is nothing the engine can read: no world, an empty one,
 * or a world drawn on a canvas.
 */
export function screenText(ctx: ScreenTextCtx): string {
  const front = dialogInFront(ctx.doc);
  if (front) return textOf(front);
  const world = worldElement(ctx);
  return world && !drawsOnCanvas(world) ? textOf(world) : '';
}

/**
 * The `problems` line for a world the sonar cannot read — none, or one (ADR-0169: the subject, the child's cost, the fix).
 * Measured at every read of `problems`: a canvas is often drawn after the boot.
 */
export function unreadableWorldProblems(ctx: ScreenTextCtx): string[] {
  const world = worldElement(ctx);
  if (!world || !drawsOnCanvas(world)) return [];
  return ['the sonar cannot read this game\'s screen: its world draws on a <canvas>, whose words are pixels to the engine, so '
    + 'a child who presses the sonar hears only the nearest target\'s name and side instead of what is written on screen — '
    + 'and in deaf mode the interpreter signs that, not the screen (ADR-0234). Write the words the child must read as text '
    + 'in the page, inside the world; a contract field for a game to hand the engine its screen\'s text is a decision the '
    + 'Dev has not taken'];
}

/**
 * A press made WITH A MENU OPEN: the menu sonar's position reads what is in front (`read`) and takes the press. Any other
 * position is left to the menus — answers whether this one was taken.
 */
export function menuSonarPress(action: Action, ctx: ScreenTextCtx, read: (text: string) => void): boolean {
  if (action !== MENU_SONAR) return false;
  const text = screenText(ctx);
  if (text) read(text);
  return true;
}
