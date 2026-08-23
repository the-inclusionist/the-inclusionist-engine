// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-typo — Typography panel (Estágio 4): extracted from game.js's renderTypo()/setGameFont(). Pure
// logic (catalog view-model, key→CSS-target mapping, persisted-value validation) is separated from the thin
// DOM-touching render()/setFont(). DI via initSettingsTypo(ctx): `$` (DOM selector), `srSay`, `store`
// (platform/storage shape) and `root` (the element the chosen font is applied to — document.documentElement in
// production). Overlay open/close plumbing (frontOverlay, focus management, the #typo hidden toggle, Escape
// handling) is the SHARED helper used by every settings panel and stays in game.js. The font catalog itself
// (FONT_GROUPS/FONT_BY_KEY) stays in ./fonts.js (Phase 2 extraction) — imported here, never duplicated.

import { FONT_GROUPS, FONT_BY_KEY, type FontItem } from './fonts.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface TypoStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

export interface SettingsTypoCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: TypoStore;
  /** Element the chosen font is applied to (dataset.fonte + --font-custom): document.documentElement in prod. */
  root: HTMLElement;
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

const CURRENT_KEY = 'incl_font_k'; // == platform/storage.ts KEYS.fontKey
const LEGACY_KEY = 'incl_fonte';   // pre-Phase-2 key: 'alfabetizacao' | 'dislexia' | outro

/** A key is selectable when it exists in the catalog and is not marked `.off` (licence pending, etc.). */
export function isSelectableFont(k: string): boolean {
  const it = FONT_BY_KEY[k];
  return !!it && !it.off;
}

/**
 * Resolves the font key to use at boot: validated persisted key -> legacy-key migration -> 'atkinson' default.
 * Verbatim port of fonts.ts's loadFontKey(), re-expressed over an injected store (DI requirement) instead of a
 * module-level import, so this module never reaches storage except through `ctx.store`.
 */
export function resolveFontKey(store: TypoStore): string {
  const k = store.get(CURRENT_KEY, null);
  if (k && isSelectableFont(k)) return k;
  const leg = store.get(LEGACY_KEY, null);
  if (leg === 'alfabetizacao') return 'andika';
  if (leg === 'dislexia') return 'lexend';
  return 'atkinson';
}

export function persistFontKey(store: TypoStore, k: string): void {
  store.set(CURRENT_KEY, k);
}

export interface FontCssTarget {
  /** Value written to root.dataset.fonte. */
  fonte: 'padrao' | 'alfabetizacao' | 'dislexia' | 'custom';
  /** Value for the --font-custom CSS property, or null to remove the property. */
  customFamily: string | null;
}

/**
 * Maps a selectable font key to the CSS it drives. The three canonical EdSP fonts (atkinson/andika/lexend) use
 * dedicated data-fonte values (Lexend's keeps the BDA letter/word spacing tied to data-fonte="dislexia"); every
 * other catalog font goes through --font-custom with a generic fallback by family (serif/cursive/none).
 * Verbatim port of the branching inside the old setGameFont().
 */
export function fontCssTarget(k: string, it: FontItem): FontCssTarget {
  if (k === 'atkinson') return { fonte: 'padrao', customFamily: null };
  if (k === 'andika') return { fonte: 'alfabetizacao', customFamily: null };
  if (k === 'lexend') return { fonte: 'dislexia', customFamily: null };
  const suffix = it.fb === 'serif' ? ',Georgia,serif' : it.fb === 'cursive' ? ',cursive' : '';
  return { fonte: 'custom', customFamily: `'${it.fam}'${suffix}` };
}

export interface TypoRow {
  key: string;
  fam: string;
  selected: boolean;
  disabled: boolean;
  /** Description (+ "— <off reason>" when disabled), or '' when there is none. */
  note: string;
}
export interface TypoGroupView {
  g: string;
  rows: TypoRow[];
}

/** Pure view-model for the typography list: which row is selected/disabled and its note, per catalog group. */
export function typoGroups(fontKey: string): TypoGroupView[] {
  return FONT_GROUPS.map((g) => ({
    g: g.g,
    rows: g.items.map((it): TypoRow => {
      const disabled = !!it.off;
      const note = it.d ? it.d + (disabled ? ' — ' + it.off : '') : disabled ? (it.off ?? '') : '';
      return { key: it.k, fam: it.fam, selected: fontKey === it.k, disabled, note };
    }),
  }));
}

function rowHTML(row: TypoRow): string {
  const noteHTML = row.note
    ? `<br><span class="opt-hint" style="margin:0;font-family:var(--font)">${row.note}</span>`
    : '';
  const ariaLabel = row.fam + (row.note ? ' — ' + row.note : '');
  const stateLabel = row.selected ? '❚❚ Ligado' : '▶ Desligado';
  return (
    `<div class="ctrl-row"><span style="font-family:'${row.fam}'"><strong>${row.fam}</strong>${noteHTML}</span>` +
    `<button class="mode-btn switch${row.selected ? ' is-on' : ''}" data-font="${row.key}" type="button"` +
    `${row.disabled ? ' disabled' : ''} aria-pressed="${row.selected}" aria-label="${ariaLabel}">${stateLabel}</button></div>`
  );
}

/** Full innerHTML for #typo-list, given the currently selected key. Pure string building — no DOM. */
export function typoListHTML(fontKey: string): string {
  return typoGroups(fontKey)
    .map((group) => `<h3 class="panel-sub">${group.g}</h3>` + group.rows.map(rowHTML).join(''))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsTypo(ctx: SettingsTypoCtx): SettingsTypoApi {
  let fontKey = resolveFontKey(ctx.store);

  function setFont(k: string, announce = false): void {
    const it = FONT_BY_KEY[k];
    if (!it || it.off) return;
    fontKey = k;
    persistFontKey(ctx.store, k);
    const target = fontCssTarget(k, it);
    ctx.root.dataset.fonte = target.fonte;
    if (target.customFamily) ctx.root.style.setProperty('--font-custom', target.customFamily);
    else ctx.root.style.removeProperty('--font-custom');
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv) pv.style.fontFamily = `'${it.fam}'`;
    if (announce) ctx.srSay('Tipografia: ' + it.fam + '.');
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#typo-list');
    if (!el) return;
    el.innerHTML = typoListHTML(fontKey);
    el.querySelectorAll<HTMLButtonElement>('button[data-font]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.font;
        if (!k) return;
        setFont(k, true);
        render();
      });
    });
    const cur = FONT_BY_KEY[fontKey];
    const pv = ctx.$<HTMLElement>('#typo-preview');
    if (pv && cur) pv.style.fontFamily = `'${cur.fam}'`;
  }

  setFont(fontKey, false); // aplica a fonte persistida ao boot (== antigo `setGameFont(fontKey,false)`)

  return { render, setFont, getFontKey: () => fontKey };
}
