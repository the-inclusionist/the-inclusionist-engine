// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-typo — Typography panel (Estágio 4): extracted from game.js's renderTypo()/setGameFont(). Pure
// logic (catalog view-model, key→CSS-target mapping, persisted-value validation) is separated from the thin
// DOM-touching render()/setFont(). DI via initSettingsTypo(ctx): `$` (DOM selector), `srSay`, `store`
// (platform/storage shape) and `root` (the element the chosen font is applied to — document.documentElement in
// production). Overlay open/close plumbing (frontOverlay, focus management, the #typo hidden toggle, Escape
// handling) is the SHARED helper used by every settings panel and stays in game.js. The font catalog itself
// (FONT_GROUPS/FONT_BY_KEY) stays in ./fonts.js (Phase 2 extraction) — imported here, never duplicated.

// (`toggleLabel` saiu daqui em 2026-09-07: ele devolve «Ligado»/«Desligado», e este menu é uma ESCOLHA.)
import { t } from '../core/i18n.js';
import { FONT_GROUPS, FONT_BY_KEY, DEFAULT_FONT_KEY, type FontItem } from './fonts.js';
import { markChanged, markMenuChanged, CHANGED_CLASS } from './changed-mark.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

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
  /**
   * Move a prosa das linhas para o rodapé (`ui/settings-panel` → `fillExplain`). Chamado a CADA `render()`, e
   * não só ao abrir — que é o defeito que este parâmetro existe para fechar.
   *
   * `fillExplain` roda uma vez quando o overlay é frontalizado e reescreve cada `<span>` para conter só o
   * rótulo curto. Mas `render()` reconstrói o `#typo-list` inteiro a cada clique numa fonte, e as linhas novas
   * voltam com o `.opt-hint` dentro. Sem esta chamada a descrição aparece DUAS vezes — no rodapé, vinda da
   * primeira passada, e sob o nome da fonte, vinda do redesenho. O CLAUDE.md §4 avisa exatamente isso.
   *
   * OPCIONAL de propósito: um consumidor que monte este painel sem a casca (o segundo consumidor, um teste)
   * continua desenhando. O que ele não pode é desenhar prosa duplicada, e sem casca não há rodapé para duplicar.
   */
  fillExplain?: (card: HTMLElement | null) => void;
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
import type { DomQuery } from '../core/dom-query.js';

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

/**
 * ⚠️ A MARCA DE SELEÇÃO, e ela existe porque COR NÃO É ESTADO.
 *
 * O `.mode-btn.is-on` pinta o botão com `var(--accent)` — o fundo amarelo que a emenda do ADR-0012 pede
 * por extenso. Mas quem não distingue a cor não vê estado nenhum, e é a mesma razão pela qual
 * `ui/activities-menu.ts:656` já emite ☑/☐ ao lado do `aria-checked`: «o estado em DUAS formas, e nenhuma
 * delas é cor».
 */
const MARCA_ESCOLHIDA = '●';
const MARCA_ALTERNATIVA = '○';

function rowHTML(row: TypoRow): string {
  const noteHTML = row.note
    ? `<br><span class="opt-hint" style="margin:0;font-family:var(--font)">${row.note}</span>`
    : '';
  const ariaLabel = row.fam + (row.note ? ' — ' + row.note : '');
  return (
    `<div class="ctrl-row"><span style="font-family:'${row.fam}'"><strong>${row.fam}</strong>${noteHTML}</span>` +
    `<button class="mode-btn${row.selected ? ' is-on' : ''}" data-font="${row.key}" type="button" role="radio"` +
    `${row.disabled ? ' disabled' : ''} aria-checked="${row.selected}" aria-label="${ariaLabel}">` +
    `${row.selected ? MARCA_ESCOLHIDA : MARCA_ALTERNATIVA}</button></div>`
  );
}

/**
 * Full innerHTML for #typo-list, given the currently selected key. Pure string building — no DOM.
 *
 * ⚠️ É UM GRUPO DE RÁDIO SÓ, ATRAVESSANDO AS TRÊS SECÇÕES, e isso é a decisão e não um detalhe de
 * marcação: a exclusividade é do MENU inteiro — uma fonte activa no total —, não de cada família. Três
 * grupos diriam a quem escuta que dá para ter uma sans E uma serif ao mesmo tempo.
 *
 * ⚠️ E ISTO DEIXOU DE SER UM INTERRUPTOR EM 2026-09-07. Era `class="mode-btn switch"` + `aria-pressed` +
 * `toggleLabel()`, ou seja dezassete interruptores independentes anunciando «Ligado»/«Desligado» para
 * escolher UMA fonte. A emenda do ADR-0012 diz o contrário em tantas palavras: «THE MENU IS A CHOICE, NOT
 * A TOGGLE […] One font is active; the others are alternatives, not switches.» O `switch` do
 * `style.css:427` desenha uma chave de 52×28 px com bolinha — era o desenho de um estado que não existe.
 */
export function typoListHTML(fontKey: string): string {
  const grupos = typoGroups(fontKey)
    .map((group) => `<h3 class="panel-sub">${group.g}</h3>` + group.rows.map(rowHTML).join(''))
    .join('');
  return `<div role="radiogroup" aria-label="${t('font.grupo.rotulo')}">${grupos}</div>`;
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
    // A ÚLTIMA COISA DO RENDER, e tem de ser: as linhas acabaram de ser recriadas com a prosa dentro delas.
    ctx.fillExplain?.(ctx.$<HTMLElement>('#typo .overlay__card'));
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
