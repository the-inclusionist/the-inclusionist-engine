// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-panel.ts — the COMMON SHELL of the settings dialogs: (a) the overlays' z-index stack (frontOverlay), (b)
// the explanation footer (fillExplain), (c) the registry of dialogs (id → close) and (d) the Escape chain.
//
// DESIGN DECISION: there is NO generic open()/close() here. The dialogs diverge in almost everything a shell would do —
// what to render before showing, WHICH control receives focus on open, what extra to do on close, and WHERE focus goes
// back. A shell with a parameter per exception, each a one-line closure, would cost the same code plus one more
// indirection to read. So this file delivers ONLY what is genuinely common, and each open/close stays a short function
// readable on its own.
//
// ACCESSIBILITY: who focuses what stays in each panel's open/close functions; the focus trap is `ui/focus-trap`. What
// THIS shell handles is READING ORDER: fillExplain takes the long description out of the row, leaves only the label in
// <strong>, and hands the description to an `aria-live="polite"` footer — focus/hover on the row updates it. And
// frontOverlay makes the last dialog opened sit on top (increasing z), which topVisibleOverlay reads back to know what to
// navigate.
//
// INJECTED via initSettingsPanel(ctx): $/$$ (ui/dom.ts), doc (`createElement` for the footer, `activeElement` and
// `contains` for focus return) and computedZ (the effective z-index). No I/O on import; all state (the z counter and the
// overlay registry) lives in the init's closure — two inits do not leak into each other.

import { t } from '../core/i18n.js';

/** Scope of the accessibility overlays: they all live inside #game-region ("no screen outside the canvas"). */
export const OVERLAY_SCOPE_SELECTOR = '#game-region .overlay';

/**
 * The i18n KEY of the explanation footer's resting text.
 *
 * 🔴 A KEY, never raw text: a raw sentence here would sit in one language under a card title in another, on the same
 * screen.
 *
 * ⚠️ KEY AND NOT TEXT, by the rule `input/devices` already wrote for the same trap: a module `const` is evaluated ONCE,
 * on import, so a resolved `t('…')` would freeze the boot language. Keeping the key, the point of use resolves it — and
 * the point of use runs on every `fillExplain`.
 */
export const EXPLAIN_IDLE = 'menu.explainIdle';

/** Initial z-index of the stack: the first overlay brought to the front gets 61. */
export const OVERLAY_BASE_Z = 60;

export interface SettingsPanelCtx {
  /** ui/dom.ts `$` — used only to resolve `#<id>` and check visibility in the Escape chain. Injected, not imported,
   *  so the node test can pass a fake DOM. */
  $: <T extends Element = Element>(sel: string) => T | null;
  /** ui/dom.ts `$$` — used only by topVisibleOverlay(), which scans OVERLAY_SCOPE_SELECTOR. */
  $$: <T extends Element = Element>(sel: string) => T[];
  /** Three things from `document`, and only them: `createElement` (fillExplain CREATES the `.opt-explain` footer the
   *  first time it sees a card), `activeElement` and `contains` (frontOverlay notes who opened the dialog and
   *  restoreFocus returns focus there). Injected so the module is not tied to the global. */
  doc: Pick<Document, 'createElement' | 'activeElement' | 'contains'>;
  /** An element's EFFECTIVE z-index — typically `+getComputedStyle(el).zIndex||0` ('auto' becomes NaN and the `||0`
   *  turns it into 0; that is the injector's responsibility). Injected because getComputedStyle only exists in the
   *  browser, and the node test needs to simulate the stack. */
  computedZ: (el: Element) => number;
}

/** One entry of the overlay registry. */
export interface OverlayEntry {
  /** Closes the dialog. Each panel returns focus its own way inside it — the shell has no opinion. */
  close: () => void;
  /** Does this dialog join the Escape chain? REQUIRED with no default on purpose: an exclusion expressed as the ABSENCE
   *  of a field is the kind of mistake nobody makes by choice, only by forgetting. Whoever registers has to say which
   *  side they are on.
   *
   *  "Open" is read from the dialog's visibility (`hidden`), not from a separate flag: a flag written next to every
   *  `ov.hidden` would be redundant with it where they agree, and where they disagree `hidden` is what decides. */
  inEscapeChain: boolean;
}

export interface SettingsPanelApi {
  /** Brings the overlay to the front of the stack (increasing z) and fills its card's explanation footer. Called by
   *  every panel's open. */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Moves the card's `.ctrl-row` descriptions to the `.opt-explain` footer (idempotent per row). */
  fillExplain: (card: HTMLElement | null) => void;
  /** Registers a dialog. REGISTRATION ORDER matters: it is what the Escape chain walks. */
  register: (id: string, entry: OverlayEntry) => void;
  /** Returns focus to whoever opened `id` (the counterpart of `frontOverlay`). False if the opener left or is not
   *  focusable. */
  restoreFocus: (id: string) => boolean;
  /** Closes the registered dialog `id` — returns true if there was a registered entry. */
  closeById: (id: string) => boolean;
  /** Id of the dialog that should consume the key, or null. Walks in REGISTRATION ORDER (not by z-index) and returns the
   *  first that is actually visible (`!el.hidden`). This is NOT "the one on top". */
  escapeTarget: () => string | null;
  /** The highest VISIBLE overlay in the stack. A z tie: the last in the DOM wins. */
  topVisibleOverlay: () => HTMLElement | null;
  /** Registered ids, in order — for tests/debugging only. */
  registeredIds: () => string[];
}

// ---------------------------------------------------------------------------------------------------------
// PURE logic — no `document`, testable in the node project.
// ---------------------------------------------------------------------------------------------------------

/**
 * An option row's description: is there an `.opt-hint` inside the <span>? use its text. Otherwise take the <strong>'s
 * prefix (the short label) and the dash separating label from description off the <span>'s text.
 * Accepts — (em dash), – (en dash) and - (hyphen).
 */
export function rowExplainText(spanText: string, strongText: string, hintText: string | null): string {
  if (hintText !== null) return hintText.trim();
  return spanText.slice(strongText.length).replace(/^\s*[—–-]\s*/, '').trim();
}

/**
 * The three listeners that take the description to the footer and return it to rest. Both row shapes use them word for
 * word, and writing them once is what keeps the two from drifting.
 *
 * NOTE (known defect, not fixed): there is no `focusout` listener — navigating by keyboard, the footer never returns to
 * its resting text.
 */
function wireFooter(row: HTMLElement, footer: HTMLElement): void {
  // 🔴 READ AT THE INSTANT OF SHOWING, never captured: a closure keeps the sentence from the day the row was born, and a
  // row built ONCE AND KEPT would never change it — the explanation would stay in the boot language forever.
  const show = (): void => { footer.textContent = row.dataset.explain || (footer.dataset.idle ?? ''); };
  const clear = (): void => { footer.textContent = footer.dataset.idle ?? ''; };
  row.addEventListener('mouseenter', show);
  row.addEventListener('focusin', show);
  row.addEventListener('mouseleave', clear);
}

/**
 * 🔴 A STEPS ROW HAS NO `<strong>`: its label lives inside the control itself («◀ Tamanho do controle: adulto pequeno ▶»,
 * ADR-0130 errata), and giving up on rows without a separate short label would leave the hint beside the steps,
 * squeezing them until they break over several lines. For it, the description is the whole hint, and the `<span>` is
 * emptied.
 */
function wireStepsRow(row: HTMLElement, span: HTMLElement, hint: HTMLElement, footer: HTMLElement): void {
  const desc = (hint.textContent ?? '').trim();
  row.dataset.explainDone = '1';
  if (!desc) return;
  row.dataset.explain = desc;
  span.textContent = '';
  span.appendChild(hint); // hidden and not erased, for the same reason as the ordinary row, below
  hint.hidden = true;
  wireFooter(row, footer);
}

/**
 * An ALREADY WIRED row, reread: only the TEXT changes, never the wiring.
 *
 * 📌 It is the half that makes the explanation follow the language (ADR-0225). The producer rewrites the `.opt-hint`, this
 * function takes the new text to `data-explain`, and the footer reads it at the instant of showing. A hint that becomes
 * EMPTY erases the explanation instead of keeping the previous one — the reason `labelRow` already gives for erasing
 * instead of not writing: on a retranslation into a dictionary without the key, the old text would survive.
 */
function refreshExplain(row: HTMLElement): void {
  const hint = row.querySelector<HTMLElement>(':scope > span .opt-hint');
  if (!hint) return; // a row that never had a hint, or lost it: it keeps what it has
  row.dataset.explain = (hint.textContent ?? '').trim();
}

/** The ordinary row: short label in `<strong>`, prose beside it — and the prose goes down to the footer. */
function wireLabelledRow(row: HTMLElement, span: HTMLElement, strong: HTMLElement, footer: HTMLElement): void {
  const hint = span.querySelector<HTMLElement>('.opt-hint');
  const desc = rowExplainText(span.textContent ?? '', strong.textContent ?? '', hint ? (hint.textContent ?? '') : null);
  row.dataset.explainDone = '1';
  if (!desc) return; // a label with no description: the row stays as it is
  row.dataset.explain = desc;
  span.innerHTML = strong.outerHTML; // READING ORDER: only the short label stays in view…
  /*
   * ⚠️ …and the hint COMES BACK, HIDDEN, instead of being destroyed.
   *
   * 🔴 Erasing it froze the explanation in the language the row was born in: the kit's `labelRow` rewrites `.opt-hint` on
   * every relabel, and a node that no longer exists receives nothing.
   *
   * 📌 `hidden` takes it out of the whole accessibility tree, so the reading order of `CLAUDE.md` §4 stays intact: the
   * screen reader still reads "short label, control", and the prose still belongs only to the footer.
   */
  if (hint) { hint.hidden = true; span.appendChild(hint); }
  wireFooter(row, footer); // the description goes to the footer on focus/hover
}

/**
 * Picks the visible overlay with the highest z-index. A tie: the LAST in the list (DOM order) wins — the effect of a
 * stable sort followed by taking the last. An empty list → null.
 */
export function topByZ<T>(overlays: readonly T[], zOf: (el: T) => number): T | null {
  if (!overlays.length) return null;
  const sorted = [...overlays].sort((a, b) => zOf(a) - zOf(b));
  return sorted[sorted.length - 1] as T;
}

// ---------------------------------------------------------------------------------------------------------
// DOM shell
// ---------------------------------------------------------------------------------------------------------

export function initSettingsPanel(ctx: SettingsPanelCtx): SettingsPanelApi {
  // The z counter lives in the closure (not the module) so each init starts clean — otherwise a test would inherit the
  // previous one's stack.
  let ovZ = OVERLAY_BASE_Z;

  // The dialog registry. A Map preserves insertion order, which is exactly the Escape chain's order.
  const registry = new Map<string, OverlayEntry>();

  /** The card's footer, found or created. */
  function explainFooter(card: HTMLElement): HTMLElement {
    const found = card.querySelector<HTMLElement>('.opt-explain');
    if (found) return found;
    const f = ctx.doc.createElement('div');
    f.className = 'opt-explain';
    f.setAttribute('aria-live', 'polite'); // the footer is announced when it changes (focus/hover on the row)
    // The resting text can be the PANEL's, via `data-explain-idle` on the card. It is where a menu introduction belongs:
    // a paragraph of prose at the top turns the menu into a manual, and the footer is already the place for
    // explanation — the panel has something to say only while nobody points at any row.
    // ⚠️ RESOLVED HERE, not at the top of the module: `fillExplain` runs on every render, so the text follows a language
    // change. A `t()` in a module `const` would freeze the boot language.
    const idle = card.dataset.explainIdle || t(EXPLAIN_IDLE);
    f.dataset.idle = idle;
    f.textContent = idle;
    card.appendChild(f);
    return f;
  }

  function fillExplain(card: HTMLElement | null): void {
    if (!card) return;
    const footer = explainFooter(card);
    card.querySelectorAll<HTMLElement>('.ctrl-row').forEach((row) => {
      // Idempotent in the WIRING and only there: a finished row is not wired again, but its TEXT is reread, otherwise a
      // row built once and kept would never change language (ADR-0225).
      if (row.dataset.explainDone) { refreshExplain(row); return; }
      const span = row.querySelector<HTMLElement>(':scope > span');
      const strong = span ? span.querySelector<HTMLElement>('strong') : null;
      const stepsHint = !strong && span ? span.querySelector<HTMLElement>('.opt-hint') : null;
      if (span && stepsHint && row.querySelector('[data-passos]')) { wireStepsRow(row, span, stepsHint, footer); return; }
      if (!span || !strong) { row.dataset.explainDone = '1'; return; } // a row with no short label: nothing to move
      wireLabelledRow(row, span, strong, footer);
    });
  }

  /** Who had focus when each dialog was brought to the front — keyed by dialog id. Used by `restoreFocus`, the
   *  counterpart of `frontOverlay`. Not a disguised global `let`: it is born and dies with the registry, and the only
   *  thing reading it is focus return. */
  const openerOf = new Map<string, HTMLElement>();

  function frontOverlay(el: HTMLElement | null): void {
    if (!el) return;
    // BEFORE the dialog appears: whoever has focus now is whoever opened it, and that is where focus returns (WCAG
    // 2.4.3). The real element, not a fixed id: the same panel is opened from the pause menu, a keyboard shortcut and a
    // bar button, and only one of them is right each time.
    // A STRUCTURAL check, not `instanceof HTMLElement`: this module runs in the `node` project, where there is no DOM
    // global at all. All that is asked of the opener is what will be used — being able to receive focus.
    const opener = ctx.doc.activeElement as HTMLElement | null;
    const focusable = !!opener && typeof opener.focus === 'function';
    const isInside = !!opener && typeof el.contains === 'function' && el.contains(opener);
    if (focusable && opener !== el && !isInside) openerOf.set(el.id, opener as HTMLElement);
    el.style.zIndex = String(++ovZ);
    const card = el.querySelector<HTMLElement>('.overlay__card');
    if (card) fillExplain(card);
  }

  /**
   * Returns focus to whoever opened dialog `id`. True if it succeeded.
   *
   * A fixed `#opt-*` per panel would fail silently: most of those ids do not exist in the document (they are hooks for a
   * button bar that does not exist yet), so closing would leave focus on `<body>` — a keyboard user back at the start of
   * the document, a screen-reader user losing their place entirely.
   *
   * It only returns to an element still in the document and still focusable — a panel may have been opened from inside
   * another that already closed, and then the caller decides (hence the boolean).
   */
  function restoreFocus(id: string): boolean {
    const opener = openerOf.get(id);
    openerOf.delete(id);
    if (!opener) return false;
    if (typeof ctx.doc.contains === 'function' && !ctx.doc.contains(opener)) return false; // it left the document
    if (typeof opener.hasAttribute === 'function' && opener.hasAttribute('disabled')) return false;
    if (opener.offsetParent === null) return false; // hidden: focusing it would take focus nowhere
    opener.focus();
    return ctx.doc.activeElement === opener;
  }

  function register(id: string, entry: OverlayEntry): void {
    registry.set(id, entry);
  }

  function closeById(id: string): boolean {
    const entry = registry.get(id);
    if (!entry) return false;
    entry.close();
    return true;
  }

  function escapeTarget(): string | null {
    for (const [id, entry] of registry) {
      if (!entry.inEscapeChain) continue; // whoever registered outside the chain stays out
      const el = ctx.$<HTMLElement>('#' + id);
      if (!el || el.hidden) continue;    // open = VISIBLE, the single source
      return id;
    }
    return null;
  }

  function topVisibleOverlay(): HTMLElement | null {
    const visible = ctx.$$<HTMLElement>(OVERLAY_SCOPE_SELECTOR).filter((o) => !o.hidden);
    return topByZ(visible, ctx.computedZ);
  }

  return {
    frontOverlay, fillExplain, register, closeById, escapeTarget, topVisibleOverlay, restoreFocus,
    registeredIds: () => [...registry.keys()],
  };
}
