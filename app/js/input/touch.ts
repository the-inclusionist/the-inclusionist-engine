// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch.ts — on-screen touch controls (Estágio 4): the physical geometry of the touch pad (mm→px) and
// its config UI (#touchcfg, #touch-controls visibility). Extracted from game.js's E13 block. Geometry/layout/
// touch-map-merge are pure (padPxPerMm/padHandTag/computePadPhysicalPx/padLayoutFromId/normalizeTouchMap —
// project node); DOM wiring + persisted state (touchMap/padDesign/padBtnMm/padGapMm/padStickMm/padTravelMm/
// padDpadMm/padDir) live behind initTouch(ctx). PAD_DESIGNS/TOUCH_ACT_LABELS/TOUCH_DEFAULT come from
// ./devices.js (not reimplemented). Reading the real Gamepad API (polling, mapping wizard) is input/gamepad's
// territory, not this module's — see the header note on padKind() for the one deliberate exception.
import { PAD_DESIGNS, TOUCH_DEFAULT } from './devices.js';
import { migrateTouchMap } from './vocabulary-migration.js';
import { t } from '../core/i18n.js';
import { KEYS } from '../platform/storage.js'; // só as CHAVES (constantes) — leitura/escrita passam por ctx.store (DI)
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
   * The on-screen controls LEFT the screen — the pair of `onTouchControlsShown`. A root that moves something out of the
   * pad's way (the platformer's minimap corner) moves it back here; `input/` does not reach `render/` for it (issue #167).
   */
  onTouchControlsHidden?: () => void;
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
  /**
   * A janela, só para ouvir `resize`. Opcional: sem ela o módulo recua para o global quando existe, e num
   * ambiente sem janela nenhuma simplesmente não ouve — a geometria fica a do arranque.
   */
  win?: Pick<Window, 'addEventListener'> | null;
}

// ===================== PURO (sem DOM/store — project node) =====================

// Alvo físico ancorado no iPhone 16 a tela cheia (aresta longa 141,1mm do display 1179×2556 @460ppi →
// ~6,04 px CSS/mm). Ver o comentário original em game.js para a justificativa completa (WCAG 2.5.5 / GAG).
export const IPHONE16_LONG_MM = 141.1;
export const IPHONE16_LONG_PX = 852;
export const IPHONE16_PXMM = IPHONE16_LONG_PX / IPHONE16_LONG_MM; // ~6,04 px CSS/mm

/**
 * CSS px per ASSUMED millimetre — an estimate anchored on one phone, NOT a measurement of the device (plan phase 5b).
 * On a mobile, the window's long edge is taken to be an iPhone 16's display (141.1 mm), whatever the device: a 10-inch
 * tablet window of 1280×800 is read as 141.1 mm long, about 9.07 px/mm, where its glass is about 216 mm. On a desktop it is
 * the iPhone 16 ratio, fixed (it does not grow with the monitor). The browser exposes no physical size, so a «real
 * millimetre» is not reachable from here; targets that must meet a floor use the engine's `--alvo-min` (ADR-0163).
 * Pure: `mobile`/`viewW`/`viewH` arrive resolved (isMobile()/innerWidth/innerHeight stay on the impure side).
 */
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
  { k: 'bl2', lbl: 'touch.slot.bl2' }, { k: 'bl1', lbl: 'touch.slot.bl1' },
  { k: 'br2', lbl: 'touch.slot.br2' }, { k: 'br1', lbl: 'touch.slot.br1' },
];
/**
 * As ações que o TRANSPORTE de toque consegue carregar.
 *
 * ⚠️ DEIXOU DE SER A LISTA DO `<select>`: as opções vêm agora de `ctx.acoesDoJogo()`, porque quem decide
 * quais ações existem é o jogo. Esta lista continua a valer como o que ESTE transporte alcança — e é contra
 * ela que o gate de `input/touch-bindings` confere se o despacho reconhece tudo o que se pode oferecer.
 * As duas coisas eram a mesma por acidente enquanto só havia um jogo.
 */
export const TOUCH_ACTS: readonly string[] = ['left', 'right', 'up', 'down', 'action2', 'action1', 'action3', 'action4', 'start',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger'];

/** Funde o mapa persistido (JSON solto do localStorage) sobre TOUCH_DEFAULT. Mantido IDÊNTICO ao original:
 *  NÃO valida chaves/valores contra TOUCH_SLOTS/TOUCH_ACTS — um JSON malformado com chaves/valores estranhos
 *  passa como está (só falha se não for um objeto). Ver a nota "bug surfaced" no retorno da extração. */
export function normalizeTouchMap(stored: unknown): Record<string, string> {
  // ⚠️ O GUARDADO PASSA PELO TRADUTOR ANTES DA FUSÃO, e a ordem é o que importa: `Object.assign` deixa o
  // guardado VENCER o padrão, então um `b0: 'jump'` de antes do ADR-0086 sobrescreveria o `b0: 'action2'`
  // correto e o botão da tela deixaria de fazer nada — sem erro nenhum. Aqui o nome da ação está no VALOR,
  // não na chave, e por isso precisa de um tradutor próprio. Ver `input/vocabulary-migration.ts`.
  const migrado = migrateTouchMap(stored && typeof stored === 'object' ? (stored as Record<string, string>) : null);
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
    ctx.onTouchControlsHidden?.();
  }
  function showTouchControls(): void {
    // MENU ativo = sem controle virtual: dá pra tocar direto nos botões da tela. QUEM decide é o jogo.
    if (!ctx.padAllowed()) return;
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc) tc.hidden = false;
    ctx.$<HTMLElement>('body')?.classList.add('touch-mode');
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
  // Recalcula os px ao girar/redimensionar; os mm são fixos.
  // ⚠️ ERA `addEventListener('resize', …)` NU — o global —, num módulo cujo cabeçalho diz que nunca alcança a
  // janela. Ninguém o via porque ninguém montava isto fora de um navegador; ligado ao `createGame`, derrubou
  // todo arranque num documento falso. A janela entra pelo `ctx`, e sem ela não há o que ouvir.
  (ctx.win ?? (typeof addEventListener === 'function' ? globalThis : null))?.addEventListener('resize', applyPadPhysical);

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

/**
 * A BUTTON'S NAME, from the position it fires (ADR-0165): the same in every game — 1 to 4, L1/L2/R1/R2, SELECT, START,
 * and the four directions by their spoken name. The cartridge's word is the FUNCTION, and it never reaches the face.
 */
const NOME_DA_POSICAO: Readonly<Record<string, string>> = {
  action1: '1', action2: '2', action3: '3', action4: '4',
  leftShoulder: 'L1', leftTrigger: 'L2', rightShoulder: 'R1', rightTrigger: 'R2',
  select: 'SELECT', start: 'START',
};
function buttonName(acao: string): string | null {
  if (NOME_DA_POSICAO[acao]) return NOME_DA_POSICAO[acao]!;
  return acao === 'up' || acao === 'down' || acao === 'left' || acao === 'right' ? t(`touch.nome.${acao}`) : null;
}

/** Os quatro slots direcionais, na ordem em que a cruz os desenha. */
const DIRECOES = ['up', 'left', 'right', 'down'] as const;
/** Os quatro slots de botão de acção, na ordem do losango. */
const BOTOES = ['b0', 'b1', 'b2', 'b3'] as const;
/** Os OMBROS por canto, de cima para baixo (ADR-0160): o gatilho (2) sobre o ombro (1). */
const OMBROS = [['esq', ['bl2', 'bl1']], ['dir', ['br2', 'br1']]] as const;

/**
 * Constrói (ou reaproveita) `#touch-controls` e devolve-o.
 *
 * ⚠️ NASCE ESCONDIDO, e não é detalhe: a alternância por modalidade é do `touch-bindings` — «toque/clique
 * MOSTRA; teclado/controle OCULTA». Um pad que nasce à vista cobre o jogo de quem nunca lhe vai tocar.
 *
 * 🔴 SÓ O QUE O JOGO NOMEIA, desde o ADR-0162 — que desfez o mínimo do ADR-0157 (direções e quatro botões em todo
 * jogo, com a legenda física nos sem nome): «Vale para todos os botões: somente aparecem se o jogo os nomeia.» SELECT
 * e START ficam sempre, porque são as portas da pausa. ⚠️ Um jogo que não nomeia direção não anda nos menus por toque;
 * por isso o `consumer-quiz` declara as posições que usa. Os quatro botões ficam em bloco 2×2 pelo NÚMERO da acção
 * (ADR-0160): 1 e 4 em cima, 2 e 3 embaixo.
 *
 * Idempotente: montar duas vezes devolve o mesmo nó, com o conteúdo refeito para o mapa de agora.
 */
export function mountTouchControls(ctx: TouchMarkupCtx, spec: TouchMarkupSpec): HTMLElement {
  const raiz = ctx.procurar('#touch-controls') ?? ctx.criar('div');
  raiz.id = 'touch-controls';
  raiz.className = 'touch';
  raiz.hidden = true;
  while (raiz.firstChild) raiz.removeChild(raiz.firstChild);

  // 🔴 SÓ O QUE O JOGO NOMEIA (ADR-0162, supersede o mínimo do ADR-0157): «Vale para todos os botões: somente aparecem
  // se o jogo os nomeia.» Um botão na tela é uma promessa de que ele faz alguma coisa, e quem sabe isso é o jogo.
  const nomeado = (slot: string): boolean => spec.acoesDoJogo.has(spec.mapa[slot] ?? '');
  // ADR-0165: the face is the NAME of the position the slot fires; the accessible name is «name, function».
  const nomeDe = (slot: string): string => buttonName(spec.mapa[slot] ?? slot) ?? spec.rotuloDoSlot(slot);
  const acessivel = (slot: string): string => {
    const nome = nomeDe(slot);
    const funcao = spec.rotuloDoSlot(slot);
    return funcao && funcao !== nome ? `${nome}, ${funcao}` : nome;
  };
  const direcoesVivas = DIRECOES.filter(nomeado);
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
        // ⚠️ AS TRÊS CLASSES, e cada uma tem um leitor. `touch-arm` é a deste módulo; `dpad-arm` é a que a folha
        // de estilo DESENHA; `dpad-<dir>` é a que o `touch-bindings` ACENDE ao toque (`.dpad-up` & co.). Com só
        // a primeira — que era o que isto escrevia até ser ligado ao `createGame` —, o braço era um botão sem
        // estilo que nunca acendia, e nenhum caso o via, porque nada tinha ainda montado os dois juntos.
        braco.className = `touch-arm dpad-arm dpad-${d}`;
        braco.dataset.dir = d;
        braco.setAttribute('type', 'button');
        braco.setAttribute('aria-label', acessivel(d));
        dir.appendChild(braco);
      }
    }
    raiz.appendChild(dir);
  }

  const botoesVivos = BOTOES.filter(nomeado);
  if (botoesVivos.length) {
    const losango = ctx.criar('div');
    losango.className = 'touch-pad';
    for (const b of botoesVivos) {
      const botao = ctx.criar('button');
      botao.className = 'touch-btn';
      // `b2` -> `2`, que é o que `'b' + dataset.btn` volta a compor no despacho. Escrever a ACÇÃO aqui
      // criaria uma segunda fonte para a mesma resposta, e o remapeamento da criança deixaria de valer.
      botao.dataset.btn = b.slice(1);
      // O LUGAR SEGUE A ACÇÃO, não o slot (ADR-0160: 1 4 em cima, 2 3 embaixo): a folha de estilo põe cada botão na
      // célula do seu número, e um slot remapeado leva o botão para o lugar da acção que passou a disparar.
      botao.dataset.acao = spec.mapa[b] ?? '';
      botao.setAttribute('type', 'button');
      botao.setAttribute('aria-label', acessivel(b));
      botao.textContent = nomeDe(b);
      losango.appendChild(botao);
    }
    raiz.appendChild(losango);
  }

  // OS OMBROS, cada par no seu canto superior (ADR-0160), e só os que o jogo nomeia (ADR-0162).
  for (const [lado, slots] of OMBROS) {
    const vivos = slots.filter(nomeado);
    if (!vivos.length) continue;
    const canto = ctx.criar('div');
    canto.className = `touch-ombros touch-ombros--${lado}`;
    for (const s of vivos) {
      const botao = ctx.criar('button');
      botao.className = 'touch-btn touch-ombro';
      botao.dataset.btn = s.slice(1); // `bl1` -> `l1`: o `'b' + dataset.btn` do `touch-bindings` recompõe o slot
      botao.setAttribute('type', 'button');
      botao.setAttribute('aria-label', acessivel(s));
      botao.textContent = nomeDe(s);
      canto.appendChild(botao);
    }
    raiz.appendChild(canto);
  }

  /*
   * AS DUAS PÍLULAS DE SISTEMA, lado a lado e ao centro: SELECT (os menus) e START (a pausa rápida), na ordem de
   * um comando de consola. ⚠️ AMBAS INCONDICIONAIS, pela mesma razão: desde o ADR-0155 são as duas portas da pausa,
   * e a pausa não é declinável (ADR-0122) — um tablet sem teclado não tem outra forma de chegar a «Sair».
   */
  const sistema = ctx.criar('div');
  sistema.className = 'touch-sistema';
  const pilula = (id: string, slot: 'select' | 'start'): HTMLElement => {
    const b = ctx.criar('button');
    b.id = id;
    b.className = `touch-btn touch-${slot}`;
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', acessivel(slot));
    // ⚠️ E ESCRITO, não só dito: uma pílula sem texto é um botão que quem vê não sabe ler.
    b.textContent = nomeDe(slot);
    return b;
  };
  sistema.appendChild(pilula('touch-select', 'select'));
  sistema.appendChild(pilula('touch-start', 'start'));
  raiz.appendChild(sistema);

  return raiz;
}

/**
 * O que este jogo NÃO alcança pelo toque, dito em vez de calado — a metade do ADR-0143 §4 que não é markup.
 *
 * 📌 Devolve LINHAS e não lança: uma lacuna do hospedeiro nunca derruba o boot, pela mesma regra que o resto
 * de `problems` já segue. As frases vão para o consumidor que INTEGRA a engine, e não para uma criança.
 */
export function touchGaps(spec: Pick<TouchMarkupSpec, 'mapa' | 'acoesDoJogo'>): string[] {
  // ⚠️ SEM `preset` O PAD SÓ TEM SELECT E START (ADR-0162): nenhuma direção, nenhum botão — nem para andar nos menus.
  // É lacuna de quem integra, e diz-se.
  if (!spec.acoesDoJogo.size) {
    return ['the virtual pad shows only SELECT and START — no direction and no button: a child on a tablet without a '
      + 'keyboard cannot play — declare `preset` with the positions this game uses and a word for each'];
  }
  // ⚠️ E A LACUNA PARCIAL TAMBÉM SE DIZ. Um jogo pode declarar uma acção que nenhum slot dispara: ela existe
  // no teclado e não existe no toque, e hoje isso não aparece em lado nenhum.
  const alcancadas = new Set(TOUCH_SLOTS.map((s) => spec.mapa[s.k]).filter(Boolean));
  const foraDoToque = [...spec.acoesDoJogo].filter((a) => !alcancadas.has(a));
  if (!foraDoToque.length) return [];
  return [`the virtual pad does not reach ${foraDoToque.join(', ')}: no slot fires them, so a child playing by touch `
    + 'does not have them — remap a slot in the pad panel, or declare fewer actions'];
}

// ===================== THE FOUR SIZES OF THE VIRTUAL PAD, one per persona (ADR-0151 erratum) =====================
//
// The Dev: the touch pad size is chosen with left/right in FOUR steps, «cada um direcionado a uma persona» —
// small child (under 6), older child (12), small adult, adult with large hands. Data and one pure function, no DOM, no
// storage. ⚠️ HERE and not in a module of its own: the input boundary (ADR-0111) closes by shrinking, and the pad
// module already owns every pad size — a new `input/` file would be one more door for cartridges.
//
// ========================= WHERE THE MILLIMETRES COME FROM =========================
// Research first (`CLAUDE.md` §4): the numbers are DERIVED from these measurements, not chosen by taste.
//   · Vatavu, Cramariuc & Schipor (2015), «Touch interaction for children aged 3 to 6 years», IJHCS 74:54–76 —
//     mean touch offset 4.5 mm at 3 years, 3.8 mm at 4, 3.4 mm above 5, against 2.1–3.3 mm for adults; and the
//     guideline to accept offsets of up to 10 mm for 3-year-olds.
//   · Anthony et al. (2013), cited there — children aged 7–10 miss 7 mm targets almost 30% of the time and 11–17
//     year-olds 20%; 9 mm targets are missed once in six attempts until 17.
//   · Parhi, Karlson & Bederson (2006), «Target size study for one-handed thumb use on small touchscreen
//     devices», MobileHCI — for adults, no error difference above 9.6 mm (discrete) and 9.2–9.6 mm sufficient;
//     performance levels off above 11.5 mm.
//   · MIT Touch Lab, as reported by Smashing Magazine (2012) — adult index finger 16–20 mm wide, pad 10–14 mm.
//
// 📌 AND SO THE SMALL CHILD GETS THE LARGEST BUTTONS, which reads backwards and is not: the small hand is not the
// constraint, the imprecision is. A 3-year-old lands up to twice as far from the centre as an adult (Vatavu), so
// her target has to absorb that spread. The large-handed adult is second largest for the other reason — the
// finger itself is 16–20 mm and covers a smaller button entirely.
//
// ⚠️ `gap`, `stick`, `travel` and `dpad` follow the button in proportion to the engine's factory pad (button
// 12.5, gap 3, stick 18, travel 4.5, cross 12 mm — `input/touch`), because no source measures them per age.
// That is stated rather than hidden: they are the part of this table that is proportion, not measurement.

export type PersonaKey = 'crianca-pequena' | 'crianca-grande' | 'adulto-pequeno' | 'adulto-maos-grandes';

export interface PersonaDoPad {
  readonly chave: PersonaKey;
  /** The i18n key of the persona's name. */
  readonly rotulo: string;
  readonly mm: Readonly<PadMm>;
}

/** The factory pad of `input/touch`, the base the non-button sizes are proportioned from. */
const FABRICA: Readonly<PadMm> = { btn: 12.5, gap: 3, stick: 18, travel: 4.5, dpad: 12 };

/** A persona's pad: the button from the sources, the rest in proportion to the factory pad. */
function pad(btn: number): PadMm {
  const k = btn / FABRICA.btn;
  const r = (n: number): number => Math.round(n * k * 10) / 10;
  return { btn, gap: r(FABRICA.gap), stick: r(FABRICA.stick), travel: r(FABRICA.travel), dpad: r(FABRICA.dpad) };
}

/** The four, in the Dev's order. */
export const PERSONAS_DO_PAD: readonly PersonaDoPad[] = Object.freeze([
  // 16 mm: an adult's 9.6 mm plus twice the extra spread of a 3-year-old (≈ 2.4 mm each side), rounded up.
  { chave: 'crianca-pequena', rotulo: 'motora.pad.crianca-pequena', mm: pad(16) },
  // 14 mm: 9 mm is still missed once in six until 17 (Anthony), and 12.7 mm was the size that did not trouble them.
  { chave: 'crianca-grande', rotulo: 'motora.pad.crianca-grande', mm: pad(14) },
  // 11.5 mm: where adult performance levels off (Parhi) — above it there is no gain, only lost room.
  { chave: 'adulto-pequeno', rotulo: 'motora.pad.adulto-pequeno', mm: pad(11.5) },
  // 15 mm: a 16–20 mm finger covers anything smaller and hides the label under the thumb (MIT Touch Lab).
  { chave: 'adulto-maos-grandes', rotulo: 'motora.pad.adulto-maos-grandes', mm: pad(15) },
]);

/**
 * The persona whose button is closest to `btnMm` — what the step control shows for a pad that was sized before
 * the personas existed (the factory 12.5 mm reads as «small adult»). Ties go to the LARGER button: when in doubt,
 * the easier target.
 */
export function closestPersona(btnMm: number): number {
  let melhor = 0;
  PERSONAS_DO_PAD.forEach((p, i) => {
    const d = Math.abs(p.mm.btn - btnMm);
    const dm = Math.abs(PERSONAS_DO_PAD[melhor]!.mm.btn - btnMm);
    if (d < dm || (d === dm && p.mm.btn > PERSONAS_DO_PAD[melhor]!.mm.btn)) melhor = i;
  });
  return melhor;
}
