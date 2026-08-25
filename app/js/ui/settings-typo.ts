// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-typo — Typography panel (Estágio 4): extracted from game.js's renderTypo()/setGameFont(). Pure
// logic (catalog view-model, key→CSS-target mapping, persisted-value validation) is separated from the thin
// DOM-touching render()/setFont(). DI via initSettingsTypo(ctx): `$` (DOM selector), `srSay`, `store`
// (platform/storage shape) and `root` (the element the chosen font is applied to — document.documentElement in
// production). Overlay open/close plumbing (frontOverlay, focus management, the #typo hidden toggle, Escape
// handling) is the SHARED helper used by every settings panel and stays in game.js. The font catalog itself
// (FONT_GROUPS/FONT_BY_KEY) stays in ./fonts.js (Phase 2 extraction) — imported here, never duplicated.

import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';
import { FONT_GROUPS, FONT_BY_KEY, DEFAULT_FONT_KEY, type FontItem } from './fonts.js';
import { markChanged, markMenuChanged, CHANGED_CLASS } from './changed-mark.js';

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


/** A key is selectable when it exists in the catalog and is not marked `.off` (licence pending, etc.). */
export function isSelectableFont(k: string): boolean {
  const it = FONT_BY_KEY[k];
  return !!it && !it.off;
}

// A semantica da chave (validacao + migracao da chave antiga) mora em ui/fonts.ts, que e o dono do
// catalogo; re-exportada aqui para quem ja consome este modulo. Uma implementacao, nao duas.
export { resolveFontKey, persistFontKey } from './fonts.js';
import { resolveFontKey, persistFontKey } from './fonts.js';

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
    g: t(g.g),  // `g` guarda CHAVE i18n desde o item 14 (ver ui/fonts)
    rows: g.items.map((it): TypoRow => {
      const disabled = !!it.off;
      // `d` e `off` também guardam CHAVE. O travessão que junta os dois é pontuação, não frase — as duas
      // metades são independentes e cada uma traduz por si.
      const desc = it.d ? t(it.d) : '', motivo = it.off ? t(it.off) : '';
      const note = desc ? desc + (disabled ? ' — ' + motivo : '') : disabled ? motivo : '';
      return { key: it.k, fam: it.fam, selected: fontKey === it.k, disabled, note };
    }),
  }));
}

function rowHTML(row: TypoRow): string {
  const noteHTML = row.note
    ? `<br><span class="opt-hint" style="margin:0;font-family:var(--font)">${row.note}</span>`
    : '';
  const ariaLabel = row.fam + (row.note ? ' — ' + row.note : '');
  const stateLabel = toggleLabel(row.selected);
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
    if (announce) ctx.srSay(t('sr.typo.font', { fam: it.fam }));
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
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Mora DENTRO do render porque é derivada, nunca guardada: ela é
   * recalculada de valor-atual-contra-padrão a cada desenho, então não tem como envelhecer no armazenamento.
   * Envelhecer na TELA ela tem — se algum dia alguém mudar a fonte sem redesenhar —, e é por isso que a
   * atualização anda junto com quem já redesenha, e não numa função própria que se possa esquecer de chamar.
   *
   * Aqui a linha marcada é a da fonte ESCOLHIDA, e só quando ela não é a padrão: as outras quinze não saíram
   * do padrão, foram apenas oferecidas.
   */
  function refreshMarks(): void {
    const changed = fontKey !== DEFAULT_FONT_KEY;
    const list = ctx.$<HTMLElement>('#typo-list');
    list?.querySelectorAll<HTMLElement>('.' + CHANGED_CLASS).forEach((el) => markChanged(el, false));
    const sel = list?.querySelector<HTMLElement>(`button[data-font="${fontKey}"]`);
    markChanged(sel?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="tipo"]'), [changed]);
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O menu mais simples dos oito: a tipografia guarda uma escolha só, então o reset é uma linha. Ainda assim
  // vale dizer para onde ele volta — a Atkinson Hyperlegible não é o padrão por ser bonita, é o padrão por ter
  // sido desenhada para quem tem baixa visão. Uma criança que experimentou seis fontes e não consegue mais ler
  // a tela precisa de um caminho de volta que termine na MAIS legível, não numa qualquer.
  //
  // O anúncio nomeia a fonte porque a mudança é visível para quem enxerga e invisível para quem não enxerga.
  const resetBtn = ctx.$<HTMLButtonElement>('#typo-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    setFont(DEFAULT_FONT_KEY, false);
    render();
    ctx.srSay(t('sr.typo.reset', { fam: FONT_BY_KEY[DEFAULT_FONT_KEY].fam }));
  });

  setFont(fontKey, false); // aplica a fonte persistida ao boot (== antigo `setGameFont(fontKey,false)`)

  return { render, setFont, getFontKey: () => fontKey };
}
