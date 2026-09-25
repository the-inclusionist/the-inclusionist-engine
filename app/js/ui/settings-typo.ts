// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-typo — Typography panel. The thin DOM-touching render()/setFont(); what a choice IS lives in
// ./typo-choices.js. DI via initSettingsTypo(ctx): `$` (DOM selector), `srSay`, `store` (platform/storage shape) and
// `root` (the element the chosen font is applied to — document.documentElement in production). Overlay open/close
// plumbing (frontOverlay, focus management, Escape handling) is the SHARED helper every settings panel uses. The font
// catalog itself (FONT_GROUPS/FONT_BY_KEY) lives in ./fonts.js — imported here, never duplicated.

// (No on/off toggle label here: this menu is a CHOICE, not a switch.)
import type { Translate } from '../core/i18n.js';
import { FONT_BY_KEY, DEFAULT_FONT_KEY, faceAvailable, faceScale } from './fonts.js';
import { markChanged, markMenuChanged, CHANGED_CLASS } from './changed-mark.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` lives in `core/dom-query`: copies of this line in many modules drifted apart. Re-exported for whoever
// already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface TypoStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

export interface SettingsTypoCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: TypoStore;
  /** Element the chosen font is applied to (dataset.fonte + --font-custom): document.documentElement in prod. */
  root: HTMLElement;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY `render()`, not only on
   * open.
   *
   * Relabelling a row puts its `.opt-hint` back inside it. Without this call the description appears TWICE — in the
   * footer, from the first pass, and under the font's name, from the redraw. CLAUDE.md §4 warns about exactly that.
   *
   * OPTIONAL on purpose: a consumer that mounts this panel without the shell (a test) keeps drawing. What it cannot do
   * is draw duplicated prose, and without the shell there is no footer to duplicate.
   */
  fillExplain?: (card: HTMLElement | null) => void;
  /**
   * IS THIS FAMILY INSTALLED ON THE DEVICE? — in production, `(f) => doc.fonts.check(\`16px "${f}"\`)`.
   *
   * It turns ADR-0012's «enquanto» into code: the Ronde option stays disabled WHILE none of the three faces is present,
   * and becomes available again when the adult installs one.
   *
   * ⚠️ INJECTED, and `document.fonts` is NEVER read here, by the rule this file already follows for `$`: a browser
   * global in a module that runs in node is a boot waiting to crash.
   * 📌 OPTIONAL, and here the default really is safe: with no detector the row stays disabled WITH the message, and the
   * message tells the adult the three fonts that solve it. The default state is actionable.
   */
  fontInstalled?: (family: string) => boolean;
}

export interface SettingsTypoApi {
  /** Re-renders #typo-list from current selection and (re)wires its buttons. Idempotent. */
  render: () => void;
  /** Selects+applies+persists a font by key; no-op for unknown/disabled keys. Mirrors old setGameFont(k,announce). */
  setFont: (k: string, announce?: boolean) => void;
  /** Currently selected font key. */
  getFontKey: () => string;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------


// The key's semantics (validation + migration of the old key) live in ui/fonts.ts, which owns the catalogue;
// re-exported here for whoever already consumes this module. One implementation, not two.
export { resolveFontKey, persistFontKey } from './fonts.js';
import { resolveFontKey, persistFontKey } from './fonts.js';
import type { DomQuery } from '../core/dom-query.js';
import { controlRow, labelRow, sectionHeader } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
/*
 * 🎯 WHAT A TYPOGRAPHY CHOICE IS lives in `./typo-choices.js`, and this file keeps the work its name always described:
 * finding the nodes it reaches and never created, wiring them, and reflecting the choice. No alias left behind — a
 * re-export would keep alive a path nothing here uses and make the surface snapshot LIE, because it does not see
 * re-exports (#204).
 */
import { typoGroups, typoRowSpec, fontCssTarget, type TypoRow } from './typo-choices.js';

/**
 * ⚠️ THE SELECTION MARK, and it exists because COLOUR IS NOT STATE.
 *
 * `.mode-btn.is-on` paints the button with `var(--accent)` — the yellow background the ADR-0012 amendment asks for in
 * so many words. But whoever does not tell the colour apart sees no state at all: the state has to come in TWO forms,
 * and neither of them a colour.
 */
const CHOSEN_MARK = '●';
const OFFERED_MARK = '○';

/**
 * Mounts the list ONCE, inside a single radio group. Called again, it RELABELS instead of rebuilding.
 *
 * ⚠️ ONE RADIO GROUP ACROSS ALL SECTIONS, and that is the decision and not a markup detail: exclusivity belongs to the
 * WHOLE menu — one active font in total —, not to each family. Separate groups would tell a listener they can have a
 * sans AND a serif at once. That is why the `radiogroup` belongs to the PANEL and not the kit: only the panel knows
 * where exclusivity ends.
 *
 * 🔴 AND EACH ROW'S LABEL IS DRAWN IN ITS OWN FACE, which is this menu's central behaviour: a list of NAMES lets no one
 * choose a typeface, and whoever most needs to choose is whoever reads the face they are looking at poorly. The note
 * beside it stays in the READING face on purpose — it explains the choice, it is not the choice. (With `fillExplain`,
 * it does not even stay on the row: it goes to the footer.)
 */
export function mountTypoInside(t: Translate, ctx: PanelShellCtx, list: HTMLElement,
  fontKey: string, isInstalled?: (family: string) => boolean): void {
  let radios = list.querySelector<HTMLElement>('[role="radiogroup"]');
  if (!radios) {
    radios = ctx.create('div');
    radios.setAttribute('role', 'radiogroup');
    list.appendChild(radios);
  }
  radios.setAttribute('aria-label', t('font.grupo.rotulo'));
  for (const group of typoGroups(t, fontKey, isInstalled)) {
    const head = radios.querySelector(`[data-typo-group="${group.g}"]`)
      ? null
      : sectionHeader(ctx, group.g, '', group.rows.length);
    if (head) {
      head.setAttribute('data-typo-group', group.g);
      radios.appendChild(head);
    }
    for (const row of group.rows) {
      const spec = typoRowSpec(row);
      const old = ctx.find('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
      if (old) { labelRow(old, spec); dressRow(old, row); continue; }
      const { row: rowNode, controle: faceButton } = controlRow(ctx, spec);
      faceButton.dataset.font = row.key;
      dressRow(rowNode, row);
      radios.appendChild(rowNode);
    }
  }
}

/** What the kit does not know about a face: the face itself on the label, and the note in the reading face. */
function dressRow(where: HTMLElement, row: TypoRow): void {
  const label = where.querySelector<HTMLElement>(':scope > span');
  if (label) label.style.fontFamily = `'${row.fam}'`;
  const note = where.querySelector<HTMLElement>('.opt-hint');
  if (note) { note.style.fontFamily = 'var(--font)'; note.style.margin = '0'; }
}

/**
 * Reflects the choice onto the rows that already exist: the mark, the spoken state and the lock.
 *
 * 🔴 THE ● / ○ MARK EXISTS BECAUSE COLOUR IS NOT STATE (see `CHOSEN_MARK`).
 *
 * 📌 THE LOCK is reflected and not built, because it can CHANGE: `ronde` becomes available the instant the adult
 * installs one of the faces the message names (ADR-0012, the word «enquanto»).
 */
function reflectTypo(list: HTMLElement, fontKey: string, isInstalled?: (family: string) => boolean): void {
  // Walks what EXISTS in the list, not the catalogue: reflecting is about the nodes already there, and asking the
  // catalogue again would build the list a second time just to read it.
  for (const b of list.querySelectorAll<HTMLButtonElement>('button[data-font]')) {
    const it = FONT_BY_KEY[b.dataset.font ?? ''];
    const isChosen = b.dataset.font === fontKey;
    b.classList.toggle('is-on', isChosen);
    b.setAttribute('aria-checked', String(isChosen));
    b.textContent = isChosen ? CHOSEN_MARK : OFFERED_MARK;
    b.disabled = !it || !faceAvailable(it, isInstalled);
  }
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsTypo(ctx: SettingsTypoCtx): SettingsTypoApi {
  const { t } = ctx;
  let fontKey = resolveFontKey(ctx.store);

  /*
   * 📌 THE KIT'S CTX COMES FROM THE LIST NODE ITSELF: `ownerDocument` is the document it LIVES in, which is where the
   * rows must be born. So this module's global reach stays zero (ADR-0221) and `SettingsTypoCtx`, which is published
   * surface, gains no required member (ADR-0172).
   */
  const panelCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  function setFont(k: string, announce = false): void {
    const it = FONT_BY_KEY[k];
    // The SAME function as the other two readings: a face the list shows clickable has to be accepted here, and one it
    // shows grey has to be refused. Three answers to the same question drift.
    if (!it || !faceAvailable(it, ctx.fontInstalled)) return;
    fontKey = k;
    persistFontKey(ctx.store, k);
    const target = fontCssTarget(k, it);
    ctx.root.dataset.fonte = target.font;
    /*
     * 🔴 THE JOINED-FACE MARK (ADR-0149 §3), which removes the BDA spacing. `:root[data-cursiva]` returns
     * `letter-spacing`/`word-spacing` to `normal`, because spacing a cursive face breaks it at the joins that make it
     * cursive — «para manter os conectores».
     *
     * ⚠️ IT ERASES WHEN IT IS NOT, not only writes when it is: without the `delete`, a child who chose a cursive face
     * and went back to Atkinson would have the reading face WITHOUT the spacing — the defect in the costliest
     * direction, because whoever goes back to the reading face is whoever needs it.
     */
    if (target.cursive) ctx.root.dataset.cursiva = '1';
    else delete ctx.root.dataset.cursiva;
    if (target.customFamily) ctx.root.style.setProperty('--font-custom', target.customFamily);
    else ctx.root.style.removeProperty('--font-custom');
    // drawn at its floor, never under it (ADR-0176 §4): a face asking 20 px makes the text 25% larger; the others give it back
    ctx.root.style.setProperty('--fonte-escala', String(faceScale(it)));
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv) pv.style.fontFamily = `'${it.fam}'`;
    if (announce) ctx.srSay(t('sr.typo.font', { fam: it.fam }));
  }

  /*
   * The listeners are wired ONCE, on the list, by delegation — which mounting once allows. ⚠️ A `disabled` button emits
   * no click, so the lock is still what protects the face the device does not have — not a guard here, which would be
   * a second answer to the same question.
   */
  let listening = false;

  function render(): void {
    const el = ctx.$<HTMLElement>('#typo-list');
    if (!el) return;
    mountTypoInside(t, panelCtx(el), el, fontKey, ctx.fontInstalled);
    reflectTypo(el, fontKey, ctx.fontInstalled);
    if (!listening) {
      listening = true;
      el.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button[data-font]');
        const k = b?.dataset.font;
        if (!k) return;
        setFont(k, true);
        render();
      });
    }
    const cur = FONT_BY_KEY[fontKey];
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv && cur) pv.style.fontFamily = `'${cur.fam}'`;
    refreshMarks();
    // THE LAST THING IN RENDER, and it has to be: the rows were just relabelled with the prose inside them.
    ctx.fillExplain?.(ctx.$<HTMLElement>('#typo .overlay__card'));
  }

  /**
   * The left-the-default mark (ADR-0029). It lives INSIDE render because it is derived, never stored: it is recomputed
   * from current-value-against-default on every draw, so it cannot go stale in storage. It could go stale on SCREEN —
   * if someone changed the font without redrawing —, which is why the update travels with what already redraws.
   *
   * Here the marked row is the CHOSEN font's, and only when it is not the default: the others did not leave the default,
   * they were only offered.
   */
  function refreshMarks(): void {
    const changed = fontKey !== DEFAULT_FONT_KEY;
    const list = ctx.$<HTMLElement>('#typo-list');
    list?.querySelectorAll<HTMLElement>('.' + CHANGED_CLASS).forEach((el) => markChanged(t, el, false));
    const sel = list?.querySelector<HTMLElement>(`button[data-font="${fontKey}"]`);
    markChanged(t, sel?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="tipo"]'), [changed]);
  }

  // ---- reset THIS menu's defaults (ADR-0028) ----
  //
  // Typography stores a single choice, so the reset is one line. Still, where it returns to is worth saying — Atkinson
  // Hyperlegible is not the default for being pretty, it is the default for having been designed for low vision. A
  // child who tried six fonts and can no longer read the screen needs a way back that ends at the MOST legible one.
  //
  // The announcement names the font because the change is visible to whoever sees and invisible to whoever does not.
  const resetBtn = ctx.$<HTMLButtonElement>('#typo-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    setFont(DEFAULT_FONT_KEY, false);
    render();
    ctx.srSay(t('sr.typo.reset', { fam: FONT_BY_KEY[DEFAULT_FONT_KEY].fam }));
  });

  setFont(fontKey, false); // applies the persisted font at boot

  return { render, setFont, getFontKey: () => fontKey };
}
