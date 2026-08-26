// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-setters — APLICAÇÃO dos modos de visão acessível (daltonismo, baixa visão, cegueira, alto
// contraste), por jogador e globalmente. Extraído verbatim do game.js. É a camada de POLÍTICA — "qual modo
// vale onde" — e não a de FÁBRICA: quem constrói pixel (pixiFilterFor / parallaxTexFor / playerVizTex /
// lvOverlayTex / renderVpOverlay) fica no game.js e sai depois em `render/viewports` (grupo B); esses quatro
// entram AQUI por injeção. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (A16/B2).
//
// Fronteiras que este módulo NÃO reabre:
//  · `_lastSharedViz` FICA no game.js — não é cache de visão, é o registro de qual modo o pipeline de render
//    ESTÁTICO aplicou por último, escrito de cinco lugares (rebuildCoins/rebuildExtras/applySharedTextures/
//    setPlayerViz/reapplyVizAll). Entra por `getSharedViz`/`setSharedViz`/`invalidateSharedViz`.
//  · `selVizPlayer` idem: quatro escritores (renderVizGroup, aba de jogador, ui/settings-visual, menu de
//    pausa) → get/set por ctx, o `let` continua no game.js até o D1.
//  · `_playerDirect` é `let` do game.js reatribuído por estas funções → clear por ctx
//    (binding importado não pode ser reatribuído).
//
// As camadas e sprites PIXI (camera/worldSprite/parallaxLayers/decoSprites/vpSpr/vpDots) são CRIADOS no
// game.js — a ordem de addChild é a ordem de desenho — e entram injetados por interface ESTRUTURAL, para o
// módulo rodar no project `node` sem importar PIXI. Mesmo precedente de render/scene-sky e game/traffic.
// SEM I/O no import: initVizSetters(ctx) só fecha closures, não chama nada.

import { VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, type VizMode } from './viz-modes.js';
import { t } from '../core/i18n.js'; // VIZ_MODES guarda CHAVE i18n desde o item 14; quem exibe resolve
import { DIRECT_CFG, worldTexFor, spriteTexFor, clearWorldTexCache, clearSpriteTexCache } from './high-contrast.js';
import { pupTexFor, resetPupTexCache } from './textures.js';
import { lqFilter } from './lq-filter.js';
import { setVizModeValue } from '../core/state.js';
import * as store from '../platform/storage.js';
import type { DomQuery } from '../core/dom-query.js';

/* ===================== PURO (sem PIXI, sem DOM) — o que rende teste de verdade ===================== */

/** Modo por chave, com o fallback do original: chave desconhecida (ou nula) CAI em `normal`. */
export function resolveViz(key: string | null | undefined): VizMode {
  return VIZ_BY_KEY[key as string] || VIZ_BY_KEY.normal;
}

/** É um dos três níveis de Renderização Direta (alto contraste)? Mesmo teste do original: `!!DIRECT_CFG[mode]`. */
export function isDirectMode(mode: string): boolean { return !!DIRECT_CFG[mode]; }

/** Filtro CSS da canvas no SOLO: simulação/correção de visão + realce L→Q, compostos e sem vazios. */
export function cssFilterFor(mode: string, lq: string): string {
  return [VIZ_FILTER[mode] || '', lq].filter(Boolean).join(' ');
}

/** Bolinha indicadora de um viewport: só cegueira (branca) e baixa visão (verde) acendem. */
export function vizDotFor(m: VizMode | undefined): { visible: boolean; fill: number | null } {
  const on = !!m && (m.kind === 'blind' || m.kind === 'lowvision');
  return { visible: on, fill: on ? (m!.kind === 'blind' ? 0xffffff : 0x36d36a) : null };
}

/** Bolinha GLOBAL (#viz-indicator) para um `kind`: visível, classes e rótulo de leitor de tela. */
export function vizIndicatorFor(kind: string): { on: boolean; blind: boolean; low: boolean; label: string } {
  return {
    on: kind === 'blind' || kind === 'lowvision',
    blind: kind === 'blind', low: kind === 'lowvision',
    label: (kind === 'blind' ? 'Modo cegueira total' : 'Modo baixa visão') + '. Toque duas vezes para voltar às cores normais.',
  };
}

/** Classe do overlay DOM de baixa visão (`lv-haze`/`lv-tunnel`/…); '' para qualquer outro kind. */
export function lvOverlayClassFor(m: VizMode): string {
  return m.kind === 'lowvision' ? 'lv-' + m.lv : '';
}

/** HTML do grupo de rádios de modos visuais (uma linha por modo; o atual marcado). Verbatim do game.js. */
export function vizGroupHtml(modes: readonly VizMode[], cur: string): string {
  return modes.map((m) => {
    const sel = m.key === cur;
    return `<div class="ctrl-row"><span><strong>${t(m.nome)}</strong><br><span class="opt-hint" style="margin:0">${t(m.desc)}</span></span>`
      + `<button class="mode-btn${sel ? ' is-on' : ''}" role="radio" aria-checked="${sel}" data-viz="${m.key}" type="button">${sel ? '✓ Selecionado' : 'Selecionar'}</button></div>`;
  }).join('');
}

/** Fala do leitor de tela ao escolher um modo: prefixa "Jogador N:" só em multi-tela. */
export function vizGroupSay(numPlayers: number, sel: number, nome: string): string {
  return (numPlayers > 1 ? 'Jogador ' + (sel + 1) + ': ' : '') + nome + '.';
}

/* ===================== cascas: PIXI/DOM injetados ===================== */

interface Styled { style: { filter: string } }
interface AppLike { view?: Styled | null }
interface Filtered { filters: unknown }
interface Textured { texture: unknown }
/** PIXI.Graphics da bolinha por viewport — só o que updateVpDots realmente usa. */
interface DotGfx {
  visible: boolean;
  clear(): unknown; lineStyle(w: number, color: number, alpha: number): unknown;
  beginFill(color: number): unknown; drawCircle(x: number, y: number, r: number): unknown; endFill(): unknown;
}
interface ClassListHost { classList: { toggle(token: string, force?: boolean): unknown; remove(...tokens: string[]): unknown } }
interface Btn { dataset: { viz?: string; vp?: string }; addEventListener(type: string, fn: () => void): void }
interface El {
  hidden: boolean; className: string; innerHTML: string;
  classList: { toggle(token: string, force?: boolean): unknown };
  setAttribute(name: string, value: string): void;
  querySelectorAll(sel: string): { forEach(cb: (b: Btn) => void): void };
}
interface Pl { viz: string; sprite?: Textured | null; _tx?: unknown }
interface Pu { kind: string; sprite?: Textured | null }

export interface VizSettersCtx {
  /* --- DOM (ui/dom + a11y) --- */
  /** O seletor do jogo (#viz-overlay, #viz-indicator, listas do painel). `DomQuery` de `core/dom-query`
   *  desde 2026-08-26: a versão local era NÃO-GENÉRICA, e uma função genérica atribuída a uma
   *  assinatura não-genérica é instanciada pela RESTRIÇÃO. O `El` estrutural continua abaixo — ele é a
   *  fatia que este módulo LÊ, e `HTMLElement` a satisfaz. */
  $: DomQuery;
  body: ClassListHost;                              // document.body — classes `lowvision-mode`/`blind-mode` gateiam o CSS
  srSay: (s: string) => void;                       // leitor de tela (região aria-live)

  /* --- objetos PIXI criados no game.js (z-order soldado lá) --- */
  app: AppLike | null;                              // só `app.view.style.filter` (filtro CSS global do solo)
  camera: Filtered;                                 // solo: alto contraste = filtro GPU na câmera
  worldSprite: Textured;                            // mundo recolorido por modo
  parallaxLayers: Textured[];                       // camadas de fundo (const; elementos só têm .texture trocada)
  decoSprites: Textured[];                          // árvores/decoração de fundo
  getVpSpr: () => Filtered[];                       // GETTER: configureRender REATRIBUI o array a cada troca de nº de telas
  getVpDots: () => DotGfx[];                        // GETTER: idem (bolinhas por viewport, acima de tudo)
  /**
   * Os sprites dos ITENS declarados (o array vive no jogo e pode ser recriado — por isso getter).
   *
   * Era `getCoinSprites`, e o nome dizia o que eles são. Mesma fatia que `render/draw` recebe desde o corte
   * das entidades declaradas: uma lista de sprites, sem o desenho saber o que cada um representa.
   */
  getItemSprites: () => (Textured | null | undefined)[];
  /**
   * Como o JOGO chama os itens dele no cache de recoloração de `render/high-contrast`.
   *
   * Era `spriteTexFor('coin', mode)` — a string cravada aqui dentro. O cache já não tinha forma de moeda
   * (ele chaveia por `(id, modo)`); quem ainda nomeava uma era este módulo. Repare no vizinho de baixo: os
   * power-ups sempre carregaram o próprio `kind`, e a engine só o repassa. Os itens não carregavam nada, e
   * por isso o nome tinha de estar em algum lugar — agora está do lado de quem o escolheu.
   */
  itemTexId: string;
  getPowerups: () => readonly Pu[];                          // `powerups` é `let` do game.js

  /* --- estado do jogo (fica no game.js até o D1) --- */
  getPlayers: () => Pl[];
  getNumPlayers: () => number;                      // binding vivo de core/state — muda com setNumPlayers
  getSelVizPlayer: () => number;                    // 4 escritores fora daqui → get/set, não valor
  setSelVizPlayer: (i: number) => void;
  getSharedViz: () => string | null;                // `_lastSharedViz`: registro do render estático, FICA no game.js
  setSharedViz: (mode: string) => void;
  invalidateSharedViz: () => void;

  /* --- fábricas de textura/filtro que ficam no game.js (saem depois em render/viewports) --- */
  parallaxTexFor: (i: number, mode: string) => unknown;
  treeTexFor: (mode: string) => unknown;
  playerVizTex: (base: unknown, mode: string) => unknown;
  pixiFilterFor: (mode: string) => unknown;
  clearPlayerDirectCache: () => void;               // zera `_playerDirect` (cache de playerVizTex, mora lá)

  /* --- efeitos colaterais de outros subsistemas --- */
  setFrontDim: (on: boolean) => void;               // game/traffic: carros/placas/semáforo escurecem como fundo
  rebuildExtras: () => void;                        // game/level-geometry
  rebuildCoins: () => void;                         // game/coin-spawning
  setModoCego: (on: boolean) => void;               // empatia cegueira liga bengala + pistas de áudio
  hideTouchControls: (reason?: string) => void;     // input/touch
  reflectVizButtons: () => void;                    // acende #opt-visual/#opt-empathy (lê hearingLoss/oneButton/wheelchair)
  renderVisualPanel: () => void;                    // visual.render() — ui/settings-visual
  renderEmpathyPanel: () => void;                   // empathy.render() — ui/settings-empathy
}

export interface VizSettersApi {
  /** Multi-tela: aplica as texturas ESTÁTICAS do modo (memoizado) + a do quadro atual de cada jogador. */
  applySharedTextures(mode: string): void;
  /** Bolinhas indicadoras por viewport (fora do filtro do viewport — visíveis mesmo em cegueira). */
  updateVpDots(): void;
  /** Filtro PIXI de cada viewport = modo do jogador daquela tela. */
  applyVpFilters(): void;
  /** Troca o modo de UM jogador: persiste, invalida o render estático e reaplica pelo caminho certo. */
  setPlayerViz(i: number, mode: string): void;
  /** Caminho SOLO: filtro CSS na canvas + texturas globais + overlay DOM + bolinha. */
  applyVizGlobal(mode: string): void;
  /** Reaplica tudo depois de uma mudança estrutural (cenário, nº de telas). */
  reapplyVizAll(): void;
  /** Bolinha global (#viz-indicator) para um `kind`. */
  updateVizIndicator(kind: string): void;
  /** Invalida os caches de textura direta (mundo/moeda/power-up/jogador) e re-renderiza. */
  rebakeDirect(): void;
  /** Grupo de rádios de modos visuais nos painéis (visual/empatia). */
  renderVizGroup(listSel: string, tabsSel: string, modes: readonly VizMode[]): void;
}

export function initVizSetters(ctx: VizSettersCtx): VizSettersApi {
  // estáticos (mundo/parallax/moedas/itens) só re-aplicam quando o modo muda (_lastSharedViz mora no game.js)
  function applySharedTextures(mode: string): void {
    if (mode !== ctx.getSharedViz()) {
      ctx.setSharedViz(mode);
      ctx.setFrontDim(!!DIRECT_CFG[mode]); // HC: carros/placas/semáforo (frente) escurecem como fundo
      ctx.worldSprite.texture = worldTexFor(mode);
      ctx.parallaxLayers.forEach((ts, j) => { ts.texture = ctx.parallaxTexFor(j, mode); });
      ctx.decoSprites.forEach((s) => { s.texture = ctx.treeTexFor(mode); });
      for (const s of ctx.getItemSprites()) { if (s) s.texture = spriteTexFor(ctx.itemTexId, mode); }
      for (const pu of ctx.getPowerups()) { if (pu.sprite) pu.sprite.texture = pupTexFor(pu.kind, mode); }
    }
    for (const pl of ctx.getPlayers()) { if (pl.sprite && pl._tx) pl.sprite.texture = ctx.playerVizTex(pl._tx, mode); } // player muda de quadro toda frame
  }

  // bolinhas indicadoras por viewport (sobre os sprites de saída → NÃO sofrem o filtro do viewport, ex. cegueira)
  function updateVpDots(): void {
    const dots = ctx.getVpDots(), players = ctx.getPlayers();
    for (let i = 0; i < dots.length; i++) {
      const g = dots[i], m = VIZ_BY_KEY[(players[i] && players[i].viz) as string];
      if (!g) continue;
      const d = vizDotFor(m); g.visible = d.visible;
      if (d.visible) { g.clear(); g.lineStyle(1, 0x000000, .6); g.beginFill(d.fill!); g.drawCircle(0, 0, 5); g.endFill(); }
    }
  }

  function applyVpFilters(): void {
    const spr = ctx.getVpSpr(), players = ctx.getPlayers();
    for (let i = 0; i < ctx.getNumPlayers(); i++) { if (spr[i]) spr[i].filters = ctx.pixiFilterFor(players[i].viz); }
  }

  function setPlayerViz(i: number, mode: string): void {
    const m = resolveViz(mode);
    ctx.getPlayers()[i].viz = m.key;
    store.set(store.KEYS.vizP(i), m.key);
    ctx.invalidateSharedViz();
    if (m.kind === 'blind') ctx.setModoCego(true); // empatia cegueira total liga o modo cego (áudio) por padrão
    if (ctx.getNumPlayers() <= 1 && i === 0) { applyVizGlobal(m.key); } else { applyVpFilters(); updateVpDots(); }
    ctx.reflectVizButtons(); ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
  }

  function applyVizGlobal(mode: string): void {
    const m = resolveViz(mode); mode = m.key;
    setVizModeValue(mode); // core/state: valor + persistência (incl_viz) + evento
    // ANTES daqui saía também `ctx.setHcMode(m.kind === 'hcnew')`, alimentando um `let hcMode` no game.js cujo
    // único leitor era o gancho window.__incl. Era `vizMode` reescrito com outro nome: derivar de VIZ_BY_KEY
    // custa uma comparação e não pode divergir. (O inicializador daquele `let` usava OUTRA fórmula,
    // `vizMode!=='normal'`, e discordava do setter — sem efeito, porque applyVizGlobal roda no boot antes de
    // o gancho existir, mas é o sintoma clássico de cópia de estado.)
    if (ctx.app && ctx.app.view) ctx.app.view.style.filter = cssFilterFor(mode, lqFilter()); // sim. daltonismo/baixa-visão/cegueira + realce L/Q compostos
    ctx.camera.filters = (m.kind === 'hcnew') ? ctx.pixiFilterFor(mode) : null; // solo: alto contraste experimental = filtro GPU na câmera
    ctx.setFrontDim(!!DIRECT_CFG[mode]); // HC: frente (carros/placas/semáforo) escurece como fundo
    ctx.worldSprite.texture = worldTexFor(mode);            // alto contraste direto = Renderização Direta · resto=normal
    ctx.parallaxLayers.forEach((ts, i) => { ts.texture = ctx.parallaxTexFor(i, mode); });
    ctx.decoSprites.forEach((s) => { s.texture = ctx.treeTexFor(mode); });
    ctx.rebuildExtras(); ctx.rebuildCoins();
    // baixa visão = névoa+manchas (overlay) + bolinha verde; cegueira = tela preta (filtro) + esconde controles + bolinha branca
    ctx.body.classList.toggle('lowvision-mode', m.kind === 'lowvision');
    ctx.body.classList.toggle('blind-mode', m.kind === 'blind');
    const ov = ctx.$('#viz-overlay'); if (ov) { ov.hidden = (m.kind !== 'lowvision'); ov.className = lvOverlayClassFor(m); }
    if (m.kind === 'blind') { ctx.hideTouchControls('cegueira'); }
    updateVizIndicator(m.kind);
    ctx.reflectVizButtons(); // (a guarda `typeof ...==='function'` do original morreu: era declaração de função, sempre verdadeira)
    ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
  }

  // bolinha indicadora (canto sup. dir.): branca=cegueira, verde=baixa visão; toque/clique 2× volta ao normal
  function updateVizIndicator(kind: string): void {
    const el = ctx.$('#viz-indicator'); if (!el) return;
    const s = vizIndicatorFor(kind);
    el.hidden = !s.on;
    el.classList.toggle('blind', s.blind); el.classList.toggle('low', s.low);
    el.setAttribute('aria-label', s.label);
  }

  // MP: filtro CSS/overlay/bolinha globais OFF (por viewport agora)
  function reapplyVizAll(): void {
    ctx.invalidateSharedViz();
    if (ctx.getNumPlayers() <= 1) { applyVizGlobal(ctx.getPlayers()[0].viz); }
    else {
      if (ctx.app && ctx.app.view) ctx.app.view.style.filter = lqFilter();
      ctx.camera.filters = null;
      ctx.body.classList.remove('lowvision-mode', 'blind-mode');
      const ov = ctx.$('#viz-overlay'); if (ov) ov.hidden = true;
      updateVizIndicator('normal'); applyVpFilters();
    }
  }

  // invalida os caches de textura direta (mundo depende de bg; sprites de fg) e re-renderiza
  function rebakeDirect(): void {
    clearWorldTexCache(); clearSpriteTexCache(); resetPupTexCache(); ctx.clearPlayerDirectCache(); ctx.invalidateSharedViz();
    if (ctx.getNumPlayers() <= 1) applyVizGlobal(ctx.getPlayers()[0].viz); else applyVpFilters();
  }

  function renderVizGroup(listSel: string, tabsSel: string, modes: readonly VizMode[]): void {
    const el = ctx.$(listSel); if (!el) return;
    if (ctx.getSelVizPlayer() >= ctx.getNumPlayers()) ctx.setSelVizPlayer(0);
    const tabs = ctx.$(tabsSel);
    if (tabs) {
      tabs.hidden = true; // E3: sem abas — cada jogador edita só o seu
      tabs.innerHTML = '';
      // NOTA (verbatim do original): o innerHTML acima já esvaziou `tabs`, então este querySelectorAll não
      // acha nada e o listener nunca é ligado. Preservado como estava — ver relatório da extração.
      tabs.querySelectorAll<HTMLElement>('button[data-vp]').forEach((b) => b.addEventListener('click', () => {
        ctx.setSelVizPlayer(+(b.dataset.vp as string)); ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
      }));
    }
    const players = ctx.getPlayers(), sel = ctx.getSelVizPlayer();
    const cur = players[sel] ? players[sel].viz : 'normal';
    el.innerHTML = vizGroupHtml(modes, cur);
    el.querySelectorAll<HTMLElement>('button[data-viz]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.viz as string;
      setPlayerViz(ctx.getSelVizPlayer(), key);
      ctx.srSay(vizGroupSay(ctx.getNumPlayers(), ctx.getSelVizPlayer(), t(VIZ_MODES.find((m) => m.key === key)!.nome)));
    }));
  }

  return { applySharedTextures, updateVpDots, applyVpFilters, setPlayerViz, applyVizGlobal, reapplyVizAll, updateVizIndicator, rebakeDirect, renderVizGroup };
}
