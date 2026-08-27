// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch.ts — on-screen touch controls (Estágio 4): the physical geometry of the touch pad (mm→px) and
// its config UI (#touchcfg, #touch-controls visibility). Extracted from game.js's E13 block. Geometry/layout/
// touch-map-merge are pure (padPxPerMm/padHandTag/computePadPhysicalPx/padLayoutFromId/normalizeTouchMap —
// project node); DOM wiring + persisted state (touchMap/padDesign/padBtnMm/padGapMm/padStickMm/padTravelMm/
// padDpadMm/padDir) live behind initTouch(ctx). PAD_DESIGNS/TOUCH_ACT_LABELS/TOUCH_DEFAULT come from
// ./devices.js (not reimplemented). Reading the real Gamepad API (polling, mapping wizard) is input/gamepad's
// territory, not this module's — see the header note on padKind() for the one deliberate exception.
import { PAD_DESIGNS, TOUCH_ACT_LABELS, TOUCH_DEFAULT } from './devices.js';
import { t } from '../core/i18n.js';
import { KEYS } from '../platform/storage.js'; // só as CHAVES (constantes) — leitura/escrita passam por ctx.store (DI)
import { setMinimapCorner } from '../render/minimap.js'; // já módulo próprio (Estágio 4, Tier 1) — importado direto
import type { DomQuery } from '../core/dom-query.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs. */
export interface TouchStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
  getNum(key: string, fallback?: number): number;
  getJSON<T = unknown>(key: string, fallback?: T | null): T | null;
  setJSON(key: string, obj: unknown): void;
}

/* O `TouchPlayer` SAIU no item 19. Era `PlayerView<'quiz'>` — a camada de TOQUE declarando que sabe existir
 * atividade de alfabetização — e servia a UMA linha, que virou `ctx.padAllowed()`. Um tipo que sobrevive ao
 * único uso vira documentação de um acoplamento que já não existe. Ver `padAllowed` no ctx. */

export interface TouchCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: TouchStore;
  /** Element the --pad-* CSS custom properties are written to: document.documentElement in production
   *  (mirrors ui/settings-typo.ts's `root` injection for the same reason — no direct `document` access). */
  root: HTMLElement;
  /** Shared device-class check (game.js's isMobile(), used by several subsystems) — injected, not duplicated. */
  isMobile: () => boolean;
  /** Screen dimensions, injected (never reads `window.innerWidth/innerHeight` directly). */
  viewport: () => { w: number; h: number };
  /** Shared overlay z-index/focus helper (game.js's frontOverlay), used by every panel — injected. */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Optional hook fired after applyPadDesign() changes padDesign — game.js's renderPauseLegend() (Sim/Não
   *  glyphs in the pause menu) is NOT part of this module's boundary but must still refresh; see report. */
  onPadDesignApplied?: () => void;
  /**
   * O controle de tela ENTROU em cena. Existe para que a raiz possa ligar sozinha o que só faz sentido no
   * toque — hoje, a alternância do botão de correr: num botão virtual ninguém "segura" com conforto, porque
   * o dedo que segura é o mesmo que precisa alcançar os outros.
   *
   * Gancho e não regra aqui dentro: este módulo desenha controles e não conhece ajuste de acessibilidade
   * nenhum. Quem sabe o que ligar é quem possui os jogadores.
   */
  onTouchControlsShown?: () => void;
  /**
   * PODE mostrar o pad virtual AGORA? Injetado, e é o corte do item 19 neste módulo.
   *
   * Era uma linha que lia TRÊS coisas por importação de `core/state`:
   *     `if (numPlayers > 1 || phase !== 'playing' || players.some((p) => p.quiz)) return;`
   * — o número de jogadores, a fase, e se algum jogador tem um QUIZ aberto. A última é a que denunciava: a
   * camada de TOQUE sabia que existe atividade de alfabetização. E as três juntas eram uma POLÍTICA do jogo
   * escrita dentro da engine.
   *
   * É o mesmo movimento do achado 10 (`isNavigable`): injetar o BOOLEANO, não o estado. A plataforma responde
   * "um jogador, jogando, sem desafio aberto"; um jogo de outro gênero responde o que for verdade nele. E o
   * módulo deixou de importar `core/state` — não sobrou leitura de estado compartilhado nenhuma.
   */
  padAllowed: () => boolean;
}

// ===================== PURO (sem DOM/store — project node) =====================

// Alvo físico ancorado no iPhone 16 a tela cheia (aresta longa 141,1mm do display 1179×2556 @460ppi →
// ~6,04 px CSS/mm). Ver o comentário original em game.js para a justificativa completa (WCAG 2.5.5 / GAG).
export const IPHONE16_LONG_MM = 141.1;
export const IPHONE16_LONG_PX = 852;
export const IPHONE16_PXMM = IPHONE16_LONG_PX / IPHONE16_LONG_MM; // ~6,04 px CSS/mm

/** mm→px CSS. No celular, ancora na aresta longa da JANELA (físico exato, retrato ou paisagem). No
 *  desktop/notebook, fixa no ratio do iPhone 16 (não cresce com a largura do monitor). Determinístico e puro:
 *  `mobile`/`viewW`/`viewH` chegam já resolvidos (isMobile()/innerWidth/innerHeight ficam no lado impuro). */
export function padPxPerMm(mobile: boolean, viewW: number, viewH: number): number {
  return mobile ? Math.max(viewW, viewH) / IPHONE16_LONG_MM : IPHONE16_PXMM;
}

export type HandTag = 'crianca' | 'adulto' | 'inter';
/** Classifica um valor em mm na faixa mão-de-criança / intermediário / mão-de-adulto (usado nas etiquetas
 *  do painel de configuração de toque). */
export function padHandTag(v: number, lo: number, hi: number): HandTag {
  return v <= lo ? 'crianca' : v >= hi ? 'adulto' : 'inter';
}

export interface PadMm { btn: number; gap: number; stick: number; travel: number; dpad: number; }
export interface PadPhysicalPx {
  btnPx: number; diamPx: number; knobPx: number; basePx: number;
  armPx: number; armWPx: number; spanPx: number; stickTravelPx: number; stickDeadPx: number;
}
/** Toda a geometria em px a partir dos mm configurados + do fator px/mm — extraída de applyPadPhysical() para
 *  ficar pura/testável (dpr alto/baixo, tela pequena, valores extremos). applyPadPhysical() só chama isto e
 *  escreve o resultado em custom properties CSS + nos rótulos do painel. */
export function computePadPhysicalPx(mm: PadMm, pxPerMm: number): PadPhysicalPx {
  const btnPx = mm.btn * pxPerMm, gapPx = mm.gap * pxPerMm;
  const diamPx = btnPx + Math.SQRT2 * (btnPx + gapPx); // losango: folga de aresta = gap
  const knobPx = mm.stick * pxPerMm, travelPx = mm.travel * pxPerMm;
  const basePx = knobPx + 2 * travelPx + 16; // base do analógico = contato + curso
  const armPx = mm.dpad * pxPerMm, armWPx = armPx * 0.8, spanPx = 2 * armPx + armWPx; // cruz: braço + largura(0,8×)
  const stickTravelPx = travelPx, stickDeadPx = Math.max(6, travelPx * 0.4); // zona-morta ~40% do curso
  return { btnPx, diamPx, knobPx, basePx, armPx, armWPx, spanPx, stickTravelPx, stickDeadPx };
}

export type PadLayout = 'sony' | 'nintendo' | 'microsoft' | 'generic';
/** Layout de rotulagem dos botões pelo id reportado do controle (heurística por substring/VID). */
export function padLayoutFromId(id: string | null | undefined): PadLayout {
  const s = (id || '').toLowerCase();
  if (/dualshock|dualsense|playstation|054c/.test(s)) return 'sony';
  if (/switch|nintendo|joy-con|057e/.test(s)) return 'nintendo';
  if (/xbox|xinput|microsoft|045e/.test(s)) return 'microsoft';
  return 'generic';
}

/** As 9 posições de toque remapeáveis (direcional×4, START, botões 0–3) — `lbl` é a chave i18n do rótulo. */
// `lbl` guarda a CHAVE i18n, não o texto: tabela de módulo resolvida no import congelaria o idioma no boot
// (ver a nota em input/devices). A seta e o nome do botão viajam DENTRO da tradução, porque em inglês o
// "(cima)" vira "(up)" e a seta fica onde está — é moldura inteira, não conteúdo interpolado.
export const TOUCH_SLOTS: ReadonlyArray<{ k: string; lbl: string }> = [
  { k: 'up', lbl: 'touch.slot.up' }, { k: 'down', lbl: 'touch.slot.down' },
  { k: 'left', lbl: 'touch.slot.left' }, { k: 'right', lbl: 'touch.slot.right' },
  { k: 'start', lbl: 'touch.slot.start' },
  { k: 'b0', lbl: 'touch.slot.b0' }, { k: 'b1', lbl: 'touch.slot.b1' },
  { k: 'b2', lbl: 'touch.slot.b2' }, { k: 'b3', lbl: 'touch.slot.b3' },
];
/** As 9 ações mapeáveis a uma posição de toque (opções do <select> de cada slot). */
export const TOUCH_ACTS: readonly string[] = ['left', 'right', 'up', 'down', 'jump', 'run', 'especial', 'swap', 'pause'];

/** Funde o mapa persistido (JSON solto do localStorage) sobre TOUCH_DEFAULT. Mantido IDÊNTICO ao original:
 *  NÃO valida chaves/valores contra TOUCH_SLOTS/TOUCH_ACTS — um JSON malformado com chaves/valores estranhos
 *  passa como está (só falha se não for um objeto). Ver a nota "bug surfaced" no retorno da extração. */
export function normalizeTouchMap(stored: unknown): Record<string, string> {
  return Object.assign({}, TOUCH_DEFAULT, stored && typeof stored === 'object' ? (stored as Record<string, string>) : {});
}

export type PadKind = 'kb' | 'x' | 'd';
/** UNUSED hoje — grep em game.js (`\bpadKind\b`) só acha a própria definição, nenhum chamador. Extraído porque
 *  a fronteira explicitamente listou; NÃO apagado (relatado, não conserto). Lê navigator.getGamepads() direto,
 *  no mesmo padrão de ui/settings-audio.ts / core/i18n.ts (acesso direto a navigator, sem DI) — mesmo assim,
 *  é semanticamente "ler o controle", território do agente de input/gamepad; ver a nota de fronteira no retorno. */
export function padKind(): PadKind {
  let kind: PadKind = 'kb';
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp) continue;
    kind = gp.mapping === 'standard' ? 'x' : 'd';
    if (kind === 'x') break;
  }
  return kind;
}

// ===================== IMPURO (DOM + store — via initTouch(ctx)) =====================

export interface PadMmPatch { btn?: number; gap?: number; stick?: number; travel?: number; dpad?: number; }

export interface TouchApi {
  /** (Re)desenha #touchmap-list a partir do touchMap atual e prende os <select> de cada slot. */
  renderTouchMap(): void;
  /** Abre o diálogo "Botões de tela touch" (#touchcfg). */
  openTouchCfg(): void;
  /** Fecha o diálogo #touchcfg e devolve o foco ao botão que o abriu. */
  closeTouchCfg(): void;
  /** Esconde os controles de toque (teclado/controle físico assumiu, ou um menu abriu por cima). O parâmetro
   *  `reason` é só um rótulo de depuração nos call-sites originais — o game.js já o descartava (função de
   *  zero parâmetros); mantido aqui só de fachada para não quebrar chamadas existentes. */
  hideTouchControls(reason?: string): void;
  /** Mostra os controles de toque (toque/clique detectado). No-op em multi-tela, fora de 'playing', ou com
   *  quiz aberto — dá pra tocar direto nos botões da tela nesses casos. */
  showTouchControls(): void;
  /** Alterna a visibilidade do analógico virtual vs. da cruz (D-pad), conforme `padDir`. */
  applyDirStyle(): void;
  /** Recalcula toda a geometria (mm→px) e escreve as custom properties + os rótulos do painel. */
  applyPadPhysical(): void;
  /** Atualiza um ou mais tamanhos (mm), persiste e reaplica a geometria. */
  setPadMm(patch: PadMmPatch): void;
  /** Aplica (e opcionalmente troca) o desenho dos botões; persiste; repinta os botões físicos do losango de
   *  toque (#pad-diamond); dispara ctx.onPadDesignApplied() (legenda Sim/Não da pausa, fora daqui). Retorna o
   *  design resultante. */
  applyPadDesign(d?: string): string;
  /** Design de botão atualmente ativo ('generic'|'microsoft'|'sony'|'nintendo'). */
  getPadDesign(): string;
  /** Referência viva do mapa de toque atual (slot → ação) — mutada por renderTouchMap(); NÃO é uma cópia. */
  getTouchMap(): Record<string, string>;
  /** Deslocamento útil do analógico virtual em px, recalculado a cada applyPadPhysical(). */
  getStickTravelPx(): number;
  /** Zona-morta do analógico virtual em px, recalculada a cada applyPadPhysical(). */
  getStickDeadPx(): number;
}

export function initTouch(ctx: TouchCtx): TouchApi {
  let padDesign = ctx.store.get(KEYS.padDesign, 'generic') || 'generic';
  let padBtnMm = ctx.store.getNum(KEYS.padBtnMm, 12.5);
  let padGapMm = ctx.store.getNum(KEYS.padGapMm, 3);
  let padStickMm = ctx.store.getNum(KEYS.padStickMm, 18);
  let padTravelMm = ctx.store.getNum(KEYS.padTravelMm, 4.5);
  let padDpadMm = ctx.store.getNum(KEYS.padDpadMm, 12);
  let padDir = ctx.store.get(KEYS.padDir, 'stick') || 'stick';
  let _stickTravelPx = 42, _stickDeadPx = 12; // valores de arranque; applyPadPhysical() atualiza de verdade
  const touchMap: Record<string, string> = normalizeTouchMap(ctx.store.getJSON(KEYS.touchmap, null));

  function renderTouchMap(): void {
    const el = ctx.$<HTMLElement>('#touchmap-list');
    if (!el) return;
    el.innerHTML = TOUCH_SLOTS.map((s) =>
      `<div class="ctrl-row"><label for="tm-${s.k}">${t(s.lbl)}</label><select id="tm-${s.k}" class="vol" data-slot="${s.k}">` +
      TOUCH_ACTS.map((a) => `<option value="${a}"${touchMap[s.k] === a ? ' selected' : ''}>${t(TOUCH_ACT_LABELS[a]!)}</option>`).join('') +
      `</select></div>`
    ).join('');
    el.querySelectorAll<HTMLSelectElement>('select[data-slot]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const slot = sel.dataset.slot || '';
        touchMap[slot] = sel.value;
        ctx.store.setJSON(KEYS.touchmap, touchMap);
        const label = sel.previousElementSibling ? sel.previousElementSibling.textContent : null;
        ctx.srSay(t('sr.touch.slotSet', { slot: label || t('touch.slot.fallback'), acao: t(TOUCH_ACT_LABELS[sel.value]!) }));
      });
    });
  }

  function openTouchCfg(): void {
    const ov = ctx.$<HTMLElement>('#touchcfg');
    if (!ov) return;
    renderTouchMap();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('select,button');
    if (f) f.focus();
  }
  function closeTouchCfg(): void {
    const ov = ctx.$<HTMLElement>('#touchcfg');
    if (!ov) return;
    ov.hidden = true;
    const b = ctx.$<HTMLElement>('#opt-touchcfg');
    if (b) b.focus();
  }

  function hideTouchControls(_reason?: string): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc && !tc.hidden) tc.hidden = true;
    ctx.$<HTMLElement>('body')?.classList.remove('touch-mode');
    setMinimapCorner(false);
  }
  function showTouchControls(): void {
    // MENU ativo = sem controle virtual: dá pra tocar direto nos botões da tela. QUEM decide é o jogo.
    if (!ctx.padAllowed()) return;
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc) tc.hidden = false;
    ctx.$<HTMLElement>('body')?.classList.add('touch-mode');
    setMinimapCorner(true);
    ctx.onTouchControlsShown?.();
  }

  function applyDirStyle(): void {
    const st = ctx.$<HTMLElement>('#touch-stick'), cr = ctx.$<HTMLElement>('#touch-cross');
    if (st) st.hidden = padDir === 'cross';
    if (cr) cr.hidden = padDir !== 'cross';
    const sel = ctx.$<HTMLSelectElement>('#pad-dir');
    if (sel && sel.value !== padDir) sel.value = padDir;
  }

  function applyPadPhysical(): void {
    const vp = ctx.viewport();
    const r = padPxPerMm(ctx.isMobile(), vp.w, vp.h);
    const px = computePadPhysicalPx({ btn: padBtnMm, gap: padGapMm, stick: padStickMm, travel: padTravelMm, dpad: padDpadMm }, r);
    _stickTravelPx = px.stickTravelPx; _stickDeadPx = px.stickDeadPx;
    const S = ctx.root.style;
    S.setProperty('--pad-btn', px.btnPx.toFixed(1) + 'px');
    S.setProperty('--pad-diam', px.diamPx.toFixed(1) + 'px');
    S.setProperty('--stick-knob', px.knobPx.toFixed(1) + 'px');
    S.setProperty('--stick-base', px.basePx.toFixed(1) + 'px');
    S.setProperty('--dpad-arm-l', px.armPx.toFixed(1) + 'px');
    S.setProperty('--dpad-arm-w', px.armWPx.toFixed(1) + 'px');
    S.setProperty('--dpad-span', px.spanPx.toFixed(1) + 'px');
    const fmt = (n: number): string => n.toFixed(1).replace('.', ',');
    const lbl: Record<HandTag, string> = { crianca: 'mão de criança', adulto: 'mão de adulto', inter: 'intermediário' };
    const upd = (valId: string, tagId: string, mm: number, lo: number, hi: number, slId: string): void => {
      const v = ctx.$<HTMLElement>(valId); if (v) v.textContent = fmt(mm) + ' mm';
      const t = ctx.$<HTMLElement>(tagId);
      if (t) { const w = padHandTag(mm, lo, hi); t.dataset.who = w; t.textContent = lbl[w]; }
      const s = ctx.$<HTMLInputElement>(slId); if (s && parseFloat(s.value) !== mm) s.value = String(mm);
    };
    upd('#pad-size-val', '#pad-size-tag', padBtnMm, 12.5, 13, '#pad-size');
    upd('#pad-gap-val', '#pad-gap-tag', padGapMm, 3, 4.5, '#pad-gap');
    upd('#pad-stick-val', '#pad-stick-tag', padStickMm, 17, 19, '#pad-stick');
    upd('#pad-travel-val', '#pad-travel-tag', padTravelMm, 4, 5.5, '#pad-travel');
    upd('#pad-dpad-val', '#pad-dpad-tag', padDpadMm, 12, 14, '#pad-dpad');
  }

  function setPadMm(o: PadMmPatch): void {
    if (o.btn != null) padBtnMm = o.btn;
    if (o.gap != null) padGapMm = o.gap;
    if (o.stick != null) padStickMm = o.stick;
    if (o.travel != null) padTravelMm = o.travel;
    if (o.dpad != null) padDpadMm = o.dpad;
    ctx.store.set(KEYS.padBtnMm, padBtnMm);
    ctx.store.set(KEYS.padGapMm, padGapMm);
    ctx.store.set(KEYS.padStickMm, padStickMm);
    ctx.store.set(KEYS.padTravelMm, padTravelMm);
    ctx.store.set(KEYS.padDpadMm, padDpadMm);
    applyPadPhysical();
  }

  function applyPadDesign(d?: string): string {
    if (d && PAD_DESIGNS[d]) padDesign = d;
    ctx.store.set(KEYS.padDesign, padDesign);
    const set = PAD_DESIGNS[padDesign] || PAD_DESIGNS.generic;
    const diamond = ctx.$<HTMLElement>('#pad-diamond');
    if (diamond) {
      diamond.querySelectorAll<HTMLElement>('.pad-b').forEach((b) => {
        const s = set[b.dataset.btn || ''];
        if (s) { b.textContent = s[0]; b.style.background = s[1]; }
      });
    }
    ctx.onPadDesignApplied?.();
    return padDesign;
  }

  // --- wiring: #touchcfg (painel "Botões de tela touch") + o botão que o abre/fecha (#opt-touchcfg no painel
  //     de Movimento) — todo elemento abaixo mora dentro (ou controla) o overlay #touchcfg. ---
  const touchCfgBtn = ctx.$<HTMLElement>('#opt-touchcfg'); if (touchCfgBtn) touchCfgBtn.addEventListener('click', openTouchCfg);
  const touchCfgClose = ctx.$<HTMLElement>('#touchcfg-close'); if (touchCfgClose) touchCfgClose.addEventListener('click', closeTouchCfg);
  const padDirSel = ctx.$<HTMLSelectElement>('#pad-dir');
  if (padDirSel) {
    padDirSel.value = padDir;
    padDirSel.addEventListener('change', () => {
      padDir = padDirSel.value;
      ctx.store.set(KEYS.padDir, padDir);
      applyDirStyle();
      ctx.srSay(t('sr.touch.dirSet', { tipo: t(padDir === 'cross' ? 'touch.dir.cross' : 'touch.dir.stick') }));
    });
  }
  const padSizeEl = ctx.$<HTMLInputElement>('#pad-size'); if (padSizeEl) padSizeEl.addEventListener('input', () => setPadMm({ btn: parseFloat(padSizeEl.value) }));
  const padGapEl = ctx.$<HTMLInputElement>('#pad-gap'); if (padGapEl) padGapEl.addEventListener('input', () => setPadMm({ gap: parseFloat(padGapEl.value) }));
  const padStickEl = ctx.$<HTMLInputElement>('#pad-stick'); if (padStickEl) padStickEl.addEventListener('input', () => setPadMm({ stick: parseFloat(padStickEl.value) }));
  const padTravelEl = ctx.$<HTMLInputElement>('#pad-travel'); if (padTravelEl) padTravelEl.addEventListener('input', () => setPadMm({ travel: parseFloat(padTravelEl.value) }));
  const padDpadEl = ctx.$<HTMLInputElement>('#pad-dpad'); if (padDpadEl) padDpadEl.addEventListener('input', () => setPadMm({ dpad: parseFloat(padDpadEl.value) }));
  const padPresetChild = ctx.$<HTMLElement>('#pad-preset-child');
  if (padPresetChild) padPresetChild.addEventListener('click', () => { setPadMm({ btn: 12, gap: 2.5, stick: 16.5, travel: 4, dpad: 11.5 }); ctx.srSay(t('sr.touch.presetChild')); });
  const padPresetAdult = ctx.$<HTMLElement>('#pad-preset-adult');
  if (padPresetAdult) padPresetAdult.addEventListener('click', () => { setPadMm({ btn: 14, gap: 4.5, stick: 20, travel: 5.5, dpad: 14 }); ctx.srSay(t('sr.touch.presetAdult')); });
  addEventListener('resize', applyPadPhysical); // recalcula os px ao girar/redimensionar; os mm são fixos

  // estado inicial (equivalente aos `applyPadDesign(padDesign); applyPadPhysical(); applyDirStyle();` de boot no game.js)
  applyPadDesign();
  applyPadPhysical();
  applyDirStyle();

  return {
    renderTouchMap, openTouchCfg, closeTouchCfg, hideTouchControls, showTouchControls,
    applyDirStyle, applyPadPhysical, setPadMm, applyPadDesign,
    getPadDesign: () => padDesign,
    getTouchMap: () => touchMap,
    getStickTravelPx: () => _stickTravelPx,
    getStickDeadPx: () => _stickDeadPx,
  };
}
