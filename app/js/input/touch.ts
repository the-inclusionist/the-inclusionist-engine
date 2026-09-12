// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch.ts — on-screen touch controls (Estágio 4): the physical geometry of the touch pad (mm→px) and
// its config UI (#touchcfg, #touch-controls visibility). Extracted from game.js's E13 block. Geometry/layout/
// touch-map-merge are pure (padPxPerMm/padHandTag/computePadPhysicalPx/padLayoutFromId/normalizeTouchMap —
// project node); DOM wiring + persisted state (touchMap/padDesign/padBtnMm/padGapMm/padStickMm/padTravelMm/
// padDpadMm/padDir) live behind initTouch(ctx). PAD_DESIGNS/TOUCH_ACT_LABELS/TOUCH_DEFAULT come from
// ./devices.js (not reimplemented). Reading the real Gamepad API (polling, mapping wizard) is input/gamepad's
// territory, not this module's — see the header note on padKind() for the one deliberate exception.
import { PAD_DESIGNS, TOUCH_DEFAULT } from './devices.js';
import { migrarMapaDeToque } from './vocabulary-migration.js';
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
  /**
   * AS POSIÇÕES QUE ESTE JOGO USA, cada uma com a palavra dele, no idioma vigente.
   *
   * ⚠️ Substitui `TOUCH_ACTS` + `TOUCH_ACT_LABELS`. O menu de cada slot oferecia NOVE opções fixas — quer
   * dizer, a engine decidia que todo jogo tem pular, correr, trocar e especial, e uma criança num quiz
   * poderia atribuir «Trocar poder» a um botão da tela, que depois não faria nada.
   *
   * A ordem também vem daqui: é a ordem canônica de `core/actions`, a mesma que a tela de remapeamento usa,
   * para a criança não ter de reaprender a lista ao trocar de painel.
   */
  acoesDoJogo: () => readonly { readonly acao: string; readonly rotulo: string }[];
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
/**
 * As ações que o TRANSPORTE de toque consegue carregar.
 *
 * ⚠️ DEIXOU DE SER A LISTA DO `<select>`: as opções vêm agora de `ctx.acoesDoJogo()`, porque quem decide
 * quais ações existem é o jogo. Esta lista continua a valer como o que ESTE transporte alcança — e é contra
 * ela que o gate de `input/touch-bindings` confere se o despacho reconhece tudo o que se pode oferecer.
 * As duas coisas eram a mesma por acidente enquanto só havia um jogo.
 */
export const TOUCH_ACTS: readonly string[] = ['left', 'right', 'up', 'down', 'action2', 'action1', 'action3', 'action4', 'start'];

/** Funde o mapa persistido (JSON solto do localStorage) sobre TOUCH_DEFAULT. Mantido IDÊNTICO ao original:
 *  NÃO valida chaves/valores contra TOUCH_SLOTS/TOUCH_ACTS — um JSON malformado com chaves/valores estranhos
 *  passa como está (só falha se não for um objeto). Ver a nota "bug surfaced" no retorno da extração. */
export function normalizeTouchMap(stored: unknown): Record<string, string> {
  // ⚠️ O GUARDADO PASSA PELO TRADUTOR ANTES DA FUSÃO, e a ordem é o que importa: `Object.assign` deixa o
  // guardado VENCER o padrão, então um `b0: 'jump'` de antes do ADR-0086 sobrescreveria o `b0: 'action2'`
  // correto e o botão da tela deixaria de fazer nada — sem erro nenhum. Aqui o nome da ação está no VALOR,
  // não na chave, e por isso precisa de um tradutor próprio. Ver `input/vocabulary-migration.ts`.
  const migrado = migrarMapaDeToque(stored && typeof stored === 'object' ? (stored as Record<string, string>) : null);
  return Object.assign({}, TOUCH_DEFAULT, migrado || {});
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
      // ⚠️ A OPÇÃO NASCE VAZIA e o `rotulo` entra logo abaixo por `textContent` (issue #106). Ele é a PALAVRA
      // do jogo — `acoesDoJogo()` sai do preset —, e um jogo vive noutro repositório (ADR-0083), então este
      // texto não é revisto por esta árvore. `value="${acao}"` fica: `acao` é o nome ABSTRATO, e a engine
      // enumera-o em `core/actions`; é dela e não do jogo.
      ctx.acoesDoJogo().map(({ acao }) => `<option value="${acao}"${touchMap[s.k] === acao ? ' selected' : ''}></option>`).join('') +
      `</select></div>`
    ).join('');
    // As palavras do jogo, por `textContent` — que escapa por construção. A ordem casa porque é a mesma lista.
    for (const sel of el.querySelectorAll<HTMLSelectElement>('select[data-slot]')) {
      const palavras = ctx.acoesDoJogo();
      for (let i = 0; i < sel.options.length && i < palavras.length; i++) {
        sel.options[i]!.textContent = palavras[i]!.rotulo;
      }
    }
    el.querySelectorAll<HTMLSelectElement>('select[data-slot]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const slot = sel.dataset.slot || '';
        touchMap[slot] = sel.value;
        ctx.store.setJSON(KEYS.touchmap, touchMap);
        const label = sel.previousElementSibling ? sel.previousElementSibling.textContent : null;
        // ⚠️ A palavra falada é a MESMA que a lida: sai da mesma lista que acabou de montar o `<option>`.
        // Antes vinham de tabelas diferentes e nada obrigava as duas a concordar.
        const escolhida = ctx.acoesDoJogo().find((x) => x.acao === sel.value);
        const nomeDoSlot = label || t('touch.slot.fallback');
        // ⚠️ SEM PALAVRA DO JOGO, O ANÚNCIO PERDE A POSIÇÃO — NÃO RECUA PARA O ID. `sel.value` é o nome
        // ABSTRATO (`action3`), e o ADR-0074 diz que ele nunca chega a uma pessoa; o `7742ac0` já pagou este
        // defeito no ecrã de remapeamento e a saída é a mesma: uma chave própria que diz o que importa.
        // 📌 O recuo é alcançável porque `acoesDoJogo()` é FUNÇÃO do cartucho, relida a cada `change`: num hub
        // de atividades a lista muda por baixo e a `<option>` desenhada antes fica órfã.
        ctx.srSay(escolhida
          ? t('sr.touch.slotSet', { slot: nomeDoSlot, acao: escolhida.rotulo })
          : t('sr.touch.slotSetUnnamed', { slot: nomeDoSlot }));
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

// =============================================================================================
// O CONTROLE VIRTUAL, DESENHADO A PARTIR DO QUE O JOGO DECLARA (ADR-0143)
// =============================================================================================
//
// 🔴 O QUE ISTO CONSERTA. 📏 Medido em 2026-09-12: este ficheiro alcança **26 ids** e cria **ZERO**, e
// `input/touch-bindings.ts:506` é `const tc = ctx.$('#touch-controls'); if (!tc) return;` — **sem uma linha
// em `problems`**. Um jogo sem essa marcação não tem pad, não tem erro e não tem como saber porquê. Numa
// escola onde o aparelho é um tablet sem teclado, isso não é uma comodidade em falta: é a única entrada.
//
// ⚠️ E MORA AQUI, E NÃO NUM MÓDULO AO LADO, porque um gate desta casa recusou a alternativa em tantas
// palavras: «o `exports` do pacote é um CURINGA (`./input/*.js`) — logo ele já está alcançável por trezentos
// cartuchos. Declare-o, ou construa-o ATRÁS do controle virtual em vez de ao lado dele». Um ficheiro novo em
// `input/` nasce API pública por acidente; uma função neste, não.
//
// ========================= POR QUE NÃO É UM MOLDE FIXO =========================
// A leitura óbvia do pedido do Dev já tinha sido recusada, por escrito, pelo segundo consumidor da própria
// engine (`consumer-quiz/main-quiz.ts` item 14): «reproduzir doze ids para um conjunto de controles que o
// quiz não quer seria o mesmo tipo de mentira do sonar». Montar o pad do platformer em todo jogo entregaria
// NOVE BOTÕES MORTOS a quem declara duas acções — o ADR-0106 §5 quebrado pelo trabalho que o cita.
//
// 🎯 Então a forma vem do `preset`: um slot é desenhado quando a acção que ele dispara é uma que ESTE jogo
// declara. 📌 E dispara pelo MAPA, não pelo nome do slot — `touch-bindings.ts:451` faz
// `doTouch(ctx.getTouchMap()['b' + b.dataset.btn])`, «a função vem do touchMap (remapeável), não do
// data-act». Ler o nome desenharia o pad de fábrica a quem o remapeou.

/** As três coisas do `document` de que a marcação do pad precisa. Mesma forma do `ui/panel-shell`. */
export interface TouchMarkupCtx {
  procurar: (sel: string) => HTMLElement | null;
  criar: (tag: string) => HTMLElement;
}

export interface TouchMarkupSpec {
  /** O MAPA VIVO de slot→acção (`TOUCH_DEFAULT` fundido com o que a criança remapeou). */
  readonly mapa: Readonly<Record<string, string>>;
  /** As acções que ESTE jogo declara (`presetActions(preset)`). Vazio = não há o que desenhar. */
  readonly acoesDoJogo: ReadonlySet<string>;
  /** O rótulo de cada slot, já traduzido — a palavra do JOGO para a acção que ele dispara. */
  readonly rotuloDoSlot: (slot: string) => string;
  /** O desenho do direcional: `cruz` ou `analogico`. Vem do ajuste persistido do pad (`padDir`). */
  readonly direcional?: 'cruz' | 'analogico';
}

/** Os quatro slots direcionais, na ordem em que a cruz os desenha. */
const DIRECOES = ['up', 'left', 'right', 'down'] as const;
/** Os quatro slots de botão de acção, na ordem do losango. */
const BOTOES = ['b0', 'b1', 'b2', 'b3'] as const;

/**
 * Constrói (ou reaproveita) `#touch-controls` e devolve-o.
 *
 * ⚠️ NASCE ESCONDIDO, e não é detalhe: a alternância por modalidade é do `touch-bindings` — «toque/clique
 * MOSTRA; teclado/controle OCULTA». Um pad que nasce à vista cobre o jogo de quem nunca lhe vai tocar.
 *
 * ⚠️ E O `#touch-start` É INCONDICIONAL, ao contrário de tudo o resto aqui. Ele é a PAUSA, e desde o ADR-0122
 * a pausa não é declinável: uma criança com um tablet e sem teclado não tem outra forma de lá chegar. Os
 * outros oito slots respondem ao que o jogo declara; este responde a uma decisão que já foi tomada.
 *
 * Idempotente: montar duas vezes devolve o mesmo nó, com o conteúdo refeito para o mapa de agora.
 */
export function montarControleDeToque(ctx: TouchMarkupCtx, spec: TouchMarkupSpec): HTMLElement {
  const raiz = ctx.procurar('#touch-controls') ?? ctx.criar('div');
  raiz.id = 'touch-controls';
  raiz.className = 'touch';
  raiz.hidden = true;
  while (raiz.firstChild) raiz.removeChild(raiz.firstChild);

  const vivo = (slot: string): boolean => spec.acoesDoJogo.has(spec.mapa[slot] ?? '');

  // ⚠️ A CRUZ É UM CONJUNTO DE BRAÇOS, E NÃO UM MOLDE DE QUATRO — é o risco que o ADR-0143 nomeia: «um jogo
  // que declara só `left` e `right` não deve receber uma cruz com dois braços mortos».
  const direcoesVivas = DIRECOES.filter(vivo);
  if (direcoesVivas.length) {
    const analogico = spec.direcional === 'analogico';
    const dir = ctx.criar('div');
    dir.id = analogico ? 'touch-stick' : 'touch-cross';
    dir.className = analogico ? 'touch-stick' : 'touch-cross';
    if (analogico) {
      // `touch-bindings` exige a `.touch-knob` dentro da base (`if (stick && knob)`), e sem ela desiste do
      // analógico inteiro — em silêncio.
      const knob = ctx.criar('div');
      knob.className = 'touch-knob';
      dir.appendChild(knob);
    } else {
      for (const d of direcoesVivas) {
        const braco = ctx.criar('button');
        braco.className = 'touch-arm';
        braco.dataset.dir = d;
        braco.setAttribute('type', 'button');
        braco.setAttribute('aria-label', spec.rotuloDoSlot(d));
        dir.appendChild(braco);
      }
    }
    raiz.appendChild(dir);
  }

  const botoesVivos = BOTOES.filter(vivo);
  if (botoesVivos.length) {
    const losango = ctx.criar('div');
    losango.className = 'touch-pad';
    for (const b of botoesVivos) {
      const botao = ctx.criar('button');
      botao.className = 'touch-btn';
      // `b2` -> `2`, que é o que `'b' + dataset.btn` volta a compor no despacho. Escrever a ACÇÃO aqui
      // criaria uma segunda fonte para a mesma resposta, e o remapeamento da criança deixaria de valer.
      botao.dataset.btn = b.slice(1);
      botao.setAttribute('type', 'button');
      botao.setAttribute('aria-label', spec.rotuloDoSlot(b));
      botao.textContent = spec.rotuloDoSlot(b);
      losango.appendChild(botao);
    }
    raiz.appendChild(losango);
  }

  const start = ctx.criar('button');
  start.id = 'touch-start';
  start.className = 'touch-btn touch-start';
  start.setAttribute('type', 'button');
  start.setAttribute('aria-label', spec.rotuloDoSlot('start'));
  raiz.appendChild(start);

  return raiz;
}

/**
 * O que este jogo NÃO alcança pelo toque, dito em vez de calado — a metade do ADR-0143 §4 que não é markup.
 *
 * 📌 Devolve LINHAS e não lança: uma lacuna do hospedeiro nunca derruba o boot, pela mesma regra que o resto
 * de `problems` já segue. As frases vão para o consumidor que INTEGRA a engine, e não para uma criança.
 */
export function lacunasDoToque(spec: Pick<TouchMarkupSpec, 'mapa' | 'acoesDoJogo'>): string[] {
  if (!spec.acoesDoJogo.size) {
    return ['sem `preset`: o controle virtual não foi montado, porque não há acção nenhuma para ele disparar. '
      + 'Declare as posições que este jogo usa, com a palavra de cada uma, e ele aparece — e sem ele uma '
      + 'criança com tablet e sem teclado não tem por onde jogar'];
  }
  // ⚠️ E A LACUNA PARCIAL TAMBÉM SE DIZ. Um jogo pode declarar uma acção que nenhum slot dispara: ela existe
  // no teclado e não existe no toque, e hoje isso não aparece em lado nenhum.
  const alcancadas = new Set(TOUCH_SLOTS.map((s) => spec.mapa[s.k]).filter(Boolean));
  const foraDoToque = [...spec.acoesDoJogo].filter((a) => !alcancadas.has(a));
  if (!foraDoToque.length) return [];
  return [`o controle virtual não alcança ${foraDoToque.join(', ')}: nenhum dos nove slots dispara essas `
    + 'acções. Quem joga por toque não as tem — remapeie um slot no painel do pad, ou declare menos acções'];
}
