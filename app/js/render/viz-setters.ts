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

import { VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, simulatesDisability, type VizMode } from './viz-modes.js';
import {
  migrateVisual, filterKey, textureKey, legacyKey, isSimulation, isLowVision, isBlind, hasHighContrast, PADRAO,
  type Theme, type Correction,
  type VisualState,
} from './viz-axes.js';
import { t } from '../core/i18n.js'; // VIZ_MODES guarda CHAVE i18n desde o item 14; quem exibe resolve
import {
  axesHtml, buttonChoice, THEME_LABEL, CORRECTION_LABEL,
} from './viz-axes-labels.js';
import { simulationRefusal } from './viz-refusal.js';
import { DIRECT_CFG, worldTexFor, spriteTexFor, clearWorldTexCache, clearSpriteTexCache } from './high-contrast.js';

import { lqFilter } from './lq-filter.js';
import { setVizModeValue, setBlindModeValue } from '../core/state.js';
import * as store from '../platform/storage.js';
import type { DomQuery } from '../core/dom-query.js';
import type { WithFilter, WithTexture, Visible, DrawingWithCircle, ApplyCssFilter, FilterReach,
  ApplyHighContrastToDom } from './port.js';

/* ===================== PURO (sem PIXI, sem DOM) — o que rende teste de verdade ===================== */

/**
 * Até onde o filtro deste modo vai. MELHORIA alcança os menus; EMPATIA fica no mundo (ver `FilterReach`).
 * Derivado de `sim`, do catálogo — a mesma flag que já distingue os dois, e não uma segunda lista para
 * alguém esquecer de atualizar.
 */
export function reachOfMode(mode: string): FilterReach {
  return simulatesDisability(mode) ? 'mundo' : 'mundo-e-menus';
}

/** Modo por chave, com o fallback do original: chave desconhecida (ou nula) CAI em `normal`. */
export function resolveViz(key: string | null | undefined): VizMode {
  return VIZ_BY_KEY[key as string] || VIZ_BY_KEY.normal;
}

/**
 * O ESTADO VISUAL GUARDADO deste jogador, de qualquer das duas formas (issue #104).
 *
 * ⚠️ ESTA FUNÇÃO É A CAIXA «um ajuste salvo antes da divisão restaura o mesmo estado visível» da definition
 * of done, e a ordem das duas leituras é a decisão inteira:
 *
 *   1. a chave NOVA (`visualP`), que é a única que sabe dizer dois eixos;
 *   2. na falta dela, a chave VELHA (`vizP`), que guarda a string única — e é aqui que mora o ajuste de toda
 *      criança que já jogou este jogo antes de hoje;
 *   3. na falta das duas, o padrão.
 *
 * ⚠️ O RECUO NÃO É ZELO: sem ele, a primeira sessão depois da actualização apagaria o modo visual que ela
 * escolheu — e quem escolheu `fix-deuter` ou `hc-direto-7` escolheu-o porque enxerga assim. É a diferença
 * entre migrar e recomeçar.
 *
 * `migrateVisual` aceita as duas formas e é idempotente, então isto pode correr quantas vezes for preciso.
 */
export function readStoredVisual(i: number): VisualState {
  const storedVisual = store.getJSON<unknown>(store.KEYS.visualP(i), null);
  if (storedVisual !== null) return migrateVisual(storedVisual);
  return migrateVisual(store.get(store.KEYS.vizP(i), null));
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
    return `<div class="ctrl-row"><span><strong>${t(m.name)}</strong><br><span class="opt-hint" style="margin:0">${t(m.desc)}</span></span>`
      + `<button class="mode-btn${sel ? ' is-on' : ''}" role="radio" aria-checked="${sel}" data-viz="${m.key}" type="button">${sel ? '✓ Selecionado' : 'Selecionar'}</button></div>`;
  }).join('');
}

/** Fala do leitor de tela ao escolher um modo: prefixa "Jogador N:" só em multi-tela. */
export function vizGroupSay(numPlayers: number, sel: number, nome: string): string {
  return (numPlayers > 1 ? 'Jogador ' + (sel + 1) + ': ' : '') + nome + '.';
}

/* ===================== cascas: PIXI/DOM injetados ===================== */

// `Filtered`, `Textured` e `DotGfx` vêm de `render/port` desde 2026-08-26. Eram três descrições locais
// do mesmo PixiJS, e a do `DotGfx` divergia das outras cópias de `Graphics` da árvore no retorno de cada
// método (`unknown` aqui, `this` lá) — foi assim que as cinco cópias de `Gfx` divergiram antes.
type Filtered = WithFilter;
type Textured = WithTexture;
/** PIXI.Graphics da bolinha por viewport — só o que updateVpDots realmente usa. */
type DotGfx = Visible & DrawingWithCircle;
interface ClassListHost { classList: { toggle(token: string, force?: boolean): unknown; remove(...tokens: string[]): unknown } }
// ⚠️ `visual` OPCIONAL AQUI, e `viz` não: esta é a fatia ESTRUTURAL que o módulo lê, e ela é satisfeita
// também por fixtures de teste escritos antes da #104. Torná-lo obrigatório nesta interface local obrigaria
// cada fixture a saber de um campo que ele não exercita — e o campo obrigatório de verdade está onde deve
// estar, no `core/entity.PlayerBase`, que é quem descreve o jogador a sério.
interface Pl { viz: string; visual?: VisualState; sprite?: Textured | null; _tx?: unknown }
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
  applyCssFilter: ApplyCssFilter;               // era `app: AppLike|null` + `app.view.style.filter`; ver a porta
  /** Alto contraste no DOM — o filtro não o alcança porque ele não É filtro. Issue #83. */
  applyHighContrastToDom: ApplyHighContrastToDom;
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
  /**
   * A TEXTURA DE UM POWER-UP NESTE MODO VISUAL, e o esquecimento dela — por PORTA desde o ADR-0228.
   *
   * 🔴 Vinham de `render/textures`, que saiu para o cartucho: um power-up é mobília de um jogo, e o cache das
   * texturas dele também. O que é da ENGINE é a regra — trocar de modo visual repinta o que está na tela —, e
   * essa regra não precisa de saber o que um power-up é.
   */
  pupTexFor: (kind: string, mode: string) => unknown;
  resetPupTexCache: () => void;

  /* --- efeitos colaterais de outros subsistemas --- */
  setFrontDim: (on: boolean) => void;               // game/traffic: carros/placas/semáforo escurecem como fundo
  rebuildExtras: () => void;                        // game/level-geometry
  rebuildCoins: () => void;                         // game/coin-spawning
  setBlindMode?: (on: boolean) => void;               // empatia cegueira liga bengala + pistas de áudio
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
  /**
   * O ESTADO INTEIRO de um jogador, e os DOIS escritores por eixo (#104).
   *
   * ⚠️ Os dois de eixo existem separados porque é isso que um painel de dois controles precisa: mexer no
   * TEMA sem tocar na correção, e vice-versa. Enquanto havia um campo só, «mexer num» significava
   * inevitavelmente «apagar o outro» — e era o defeito, não a API.
   */
  setPlayerVisual(i: number, v: VisualState): void;
  setPlayerTheme(i: number, tema: Theme): void;
  setPlayerCorrection(i: number, correcao: Correction): void;
  /** Caminho SOLO: filtro CSS na canvas + texturas globais + overlay DOM + bolinha. */
  applyVizGlobal(v: VisualState): void;
  /** Reaplica tudo depois de uma mudança estrutural (cenário, nº de telas). */
  reapplyVizAll(): void;
  /** Bolinha global (#viz-indicator) para um `kind`. */
  updateVizIndicator(kind: string): void;
  /** Invalida os caches de textura direta (mundo/moeda/power-up/jogador) e re-renderiza. */
  rebakeDirect(): void;
  /** Grupo de rádios de modos visuais nos painéis (visual/empatia). */
  renderVizGroup(listSel: string, tabsSel: string, modes: readonly VizMode[]): void;
  /** Os DOIS eixos do painel visual (#104). Irmão do de cima — ver a nota na implementação. */
  renderVisualAxes(listSel: string, tabsSel: string): void;
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
      for (const pu of ctx.getPowerups()) { if (pu.sprite) pu.sprite.texture = ctx.pupTexFor(pu.kind, mode); }
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
    // ⚠️ `filterKey` E NÃO `p.viz` (#104). É a outra metade do par que a etapa 0 mediu: o TEMA vai pela
    // textura (`playerVizTex`/`applySharedTextures`) e a CORREÇÃO ou SIMULAÇÃO vai pelo FILTRO — e é
    // exactamente por serem dois caminhos que os dois eixos podem coexistir. `null` (sem filtro) entra como
    // `'normal'`, que é a chave que o `pixiFilterFor` já usa para «nenhum», e ele cacheia por ela.
    for (let i = 0; i < ctx.getNumPlayers(); i++) {
      const p = players[i];
      if (spr[i]) spr[i].filters = ctx.pixiFilterFor((p.visual && filterKey(p.visual)) || 'normal');
    }
  }

  /**
   * O ESCRITOR DE VERDADE desde a etapa 4 da #104: recebe o ESTADO, não uma chave.
   *
   * ⚠️ E É AQUI QUE O ESPELHO MUDA DE SIGNIFICADO, o que estava previsto e escrito. Enquanto os controles
   * escreviam um valor de cada vez, `viz` conseguia ser «o modo equivalente». Com dois eixos não há chave
   * única que descreva `hc7 + fix-deuter`, então o espelho passa a ser exactamente o que ele ainda consegue
   * ser com honestidade: **a CHAVE DE TEXTURA** — `simulação ?? tema ?? normal`, o que mais muda o que se vê.
   *
   * Isso não é uma perda escondida: é a mesma chave que o `setVizModeValue` já escreve, e o invariante do
   * gate passou a afirmá-la nesses termos. Um leitor antigo continua a ver algo verdadeiro sobre a tela; o
   * que ele deixa de ver é a metade que a forma antiga nunca soube dizer.
   */
  function writePlayerVisual(i: number, v: VisualState): void {
    const p = ctx.getPlayers()[i];
    p.visual = v;
    p.viz = legacyKey(v);
    store.set(store.KEYS.vizP(i), p.viz);        // legada: um leitor antigo faria `VIZ_BY_KEY[v]` e recusaria JSON
    store.setJSON(store.KEYS.visualP(i), v);     // nova: os dois eixos, que a chave velha não sabe dizer
    applyPlayerVisual(i, v);
  }

  /** Muda SÓ o tema deste jogador. A correção e a simulação ficam onde estavam — é o ponto da #104. */
  function writePlayerTheme(i: number, tema: Theme): void {
    const p = ctx.getPlayers()[i];
    writePlayerVisual(i, { ...(p.visual ?? PADRAO), tema });
  }

  /** Muda SÓ a correção de cor deste jogador. O tema e a simulação ficam onde estavam. */
  function writePlayerCorrection(i: number, correcao: Correction): void {
    const p = ctx.getPlayers()[i];
    writePlayerVisual(i, { ...(p.visual ?? PADRAO), correcao });
  }

  /** A API antiga, por chave única. Continua a valer: um jogo que escolhe um modo inteiro passa por aqui. */
  function setPlayerViz(i: number, mode: string): void {
    writePlayerVisual(i, migrateVisual(resolveViz(mode).key));
  }

  /** Os efeitos colaterais de ter mudado o visual de um jogador. Separados do ESCREVER de propósito: os dois
   *  escritores por eixo e o antigo por chave partilham-nos, e uma cópia a mais seria uma cópia a divergir. */
  function applyPlayerVisual(i: number, v: VisualState): void {
    ctx.invalidateSharedViz();
    if (isBlind(v)) (ctx.setBlindMode ?? setBlindModeValue)(true); // empatia cegueira total liga o modo cego (áudio) por padrão
    if (ctx.getNumPlayers() <= 1 && i === 0) { applyVizGlobal(v); } else { applyVpFilters(); updateVpDots(); }
    ctx.reflectVizButtons(); ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
  }

  /**
   * ⚠️ AQUI É QUE OS DOIS EIXOS PASSAM A COEXISTIR (#104, ADR-0076), e a função nem cresceu — ela SEPAROU-SE.
   *
   * Enquanto o estado era uma chave só, cada linha abaixo perguntava a mesma coisa (`mode`, `m.kind`) e a
   * resposta tinha de ser uma. Com dois eixos, as mesmas linhas dividem-se em três grupos que nunca se
   * tocaram — e essa é a razão de a composição já ser mecanicamente possível, como o `viz-axes` regista:
   *
   *   · TEMA (contraste) → textura e classe de DOM. `textureKey` e `hasHighContrast`.
   *   · CORREÇÃO ou SIMULAÇÃO → filtro CSS. `filterKey`.
   *   · SIMULAÇÃO → as classes do corpo, o overlay, os controles de toque, a bolinha.
   *
   * ⚠️ E O ALCANCE DO FILTRO CONTINUA A DEPENDER DE SIMULAR OU CORRIGIR, que é a distinção do ADR-0046: uma
   * CORREÇÃO alcança os menus, porque a criança precisa dela para LER o menu; uma SIMULAÇÃO fica no mundo,
   * porque quem simula tem de conseguir sair.
   *
   * `setVizModeValue` continua a escrever a chave ÚNICA legada, e a que ele escreve é a de TEXTURA — que é
   * `simulação ?? tema ?? normal`, ou seja o que mais muda o que se vê. É espelho, não fonte: o estado a
   * sério são os dois eixos, e esta linha sai quando o último leitor da chave velha sair.
   */
  function applyVizGlobal(v: VisualState): void {
    const filterName = filterKey(v);
    const textureForMode = textureKey(v);
    // ⚠️ `legacyKey` E NÃO `textura`: a de textura devolve `normal` para uma correção de cor, e escrevê-la
    // aqui faria um leitor antigo da chave global perder a correção da criança. Ver a nota em `legacyKey`.
    setVizModeValue(legacyKey(v)); // core/state: valor + persistência (incl_viz) + evento — espelho legado
    // ANTES daqui saía também `ctx.setHcMode(m.kind === 'hcnew')`, alimentando um `let hcMode` no game.js cujo
    // único leitor era o gancho window.__incl. Era `vizMode` reescrito com outro nome: derivar de VIZ_BY_KEY
    // custa uma comparação e não pode divergir. (O inicializador daquele `let` usava OUTRA fórmula,
    // `vizMode!=='normal'`, e discordava do setter — sem efeito, porque applyVizGlobal roda no boot antes de
    // o gancho existir, mas é o sintoma clássico de cópia de estado.)
    // --- eixo CORREÇÃO/SIMULAÇÃO: o filtro CSS ---
    ctx.applyCssFilter(cssFilterFor(filterName ?? '', lqFilter()), isSimulation(v) ? 'mundo' : 'mundo-e-menus');
    // --- eixo TEMA: DOM e textura. Não é filtro (ver `ApplyHighContrastToDom`), e é por isso que compõe.
    ctx.applyHighContrastToDom(hasHighContrast(v));
    ctx.camera.filters = hasHighContrast(v) ? ctx.pixiFilterFor(textureForMode) : null; // solo: alto contraste na câmera
    ctx.setFrontDim(hasHighContrast(v)); // HC: frente (carros/placas/semáforo) escurece como fundo
    ctx.worldSprite.texture = worldTexFor(textureForMode);         // alto contraste direto = Renderização Direta · resto=normal
    ctx.parallaxLayers.forEach((ts, i) => { ts.texture = ctx.parallaxTexFor(i, textureForMode); });
    ctx.decoSprites.forEach((s) => { s.texture = ctx.treeTexFor(textureForMode); });
    ctx.rebuildExtras(); ctx.rebuildCoins();
    // --- SIMULAÇÃO: baixa visão = névoa+manchas (overlay) + bolinha verde; cegueira = tela preta + esconde
    //     controles + bolinha branca. Nenhuma delas olha para o tema, e é por isso que o tema não as apaga.
    ctx.body.classList.toggle('lowvision-mode', isLowVision(v));
    ctx.body.classList.toggle('blind-mode', isBlind(v));
    const ov = ctx.$('#viz-overlay');
    if (ov) { ov.hidden = !isLowVision(v); ov.className = isLowVision(v) ? 'lv-' + String(v.simulacao).slice(3) : ''; }
    if (isBlind(v)) { ctx.hideTouchControls('cegueira'); }
    updateVizIndicator(isBlind(v) ? 'blind' : isLowVision(v) ? 'lowvision' : 'normal');
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
    if (ctx.getNumPlayers() <= 1) { applyVizGlobal(ctx.getPlayers()[0].visual ?? PADRAO); }
    else {
      ctx.applyCssFilter(lqFilter(), 'mundo-e-menus'); // realce L/Q é melhoria: alcança o menu
      ctx.camera.filters = null;
      ctx.body.classList.remove('lowvision-mode', 'blind-mode');
      const ov = ctx.$('#viz-overlay'); if (ov) ov.hidden = true;
      updateVizIndicator('normal'); applyVpFilters();
    }
  }

  // invalida os caches de textura direta (mundo depende de bg; sprites de fg) e re-renderiza
  function rebakeDirect(): void {
    clearWorldTexCache(); clearSpriteTexCache(); ctx.resetPupTexCache(); ctx.clearPlayerDirectCache(); ctx.invalidateSharedViz();
    if (ctx.getNumPlayers() <= 1) applyVizGlobal(ctx.getPlayers()[0].visual ?? PADRAO); else applyVpFilters();
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
    const v = players[sel]?.visual ?? PADRAO;
    const cur = legacyKey(v);
    el.innerHTML = vizGroupHtml(modes, cur);
    // ⚠️ A RECUSA DA SIMULAÇÃO (#104, ADR-0076 §4). Com qualquer dos dois eixos fora do padrão, uma
    // demonstração não mostra a deficiência — mostra o AJUSTE por cima do qual ela corre, e isso ensina uma
    // coisa falsa. A linha CONTINUA na tela, desabilitada e com o motivo: sumir ensinaria que a coisa não
    // existe, e um adulto concluiria que ela foi tirada em vez de perceber que foi ele que ligou o contraste.
    //
    // A prosa entra num `.opt-hint`, que é o que a casca (`ui/settings-panel.fillExplain`) MOVE para o rodapé
    // — a regra das três zonas do CLAUDE.md: a explicação mora no rodapé, nunca na linha.
    //
    // ⚠️ SÓ AS LINHAS QUE SIMULAM. Esta função desenha hoje a lista de simulações (o painel visual passou a
    // usar o `drawVisualAxes`), mas ela continua a receber os modos por parâmetro — e uma correção de
    // cor nesta lista não deve ser recusada por causa do eixo dela própria.
    const refusal = simulationRefusal(v);
    el.querySelectorAll<HTMLElement>('button[data-viz]').forEach((btn) => {
      const key = btn.dataset.viz as string;
      if (refusal && simulatesDisability(key)) {
        btn.setAttribute('aria-disabled', 'true');
        const explanation = btn.closest('.ctrl-row')?.querySelector<HTMLElement>('.opt-hint');
        if (explanation) explanation.textContent = `${explanation.textContent} ${t(refusal.key)}`.trim();
        return; // sem ouvinte: aceitar o clique e ignorá-lo é a outra metade do que o ADR proíbe
      }
      btn.addEventListener('click', () => {
        setPlayerViz(ctx.getSelVizPlayer(), key);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), ctx.getSelVizPlayer(), t(VIZ_MODES.find((m) => m.key === key)!.name)));
      });
    });
  }

  /**
   * OS DOIS EIXOS no painel VISUAL (#104). Irmão do `renderVizGroup`, e SEPARADO dele de propósito.
   *
   * ⚠️ QUASE FIZ ISTO DENTRO DO `renderVizGroup`, E TERIA PARTIDO O PAINEL DE EMPATIA. Aquela função serve os
   * DOIS painéis — `#visual-modes` com os sete modos e `#empathy-list` com as nove simulações —, e trocar o
   * corpo dela teria posto os dois eixos na lista de simulações. Ali o rádio único continua CERTO: as
   * simulações são mesmo exclusivas entre si, e o que deixou de ser exclusivo foi outra coisa.
   *
   * ⚠️ E OS DOIS GRUPOS ENTRAM NO CONTENEDOR QUE JÁ EXISTE, sem markup nova do hospedeiro. Exigir um elemento
   * a mais faria cada um dos 300 jogos ter de se lembrar dele — a forma de defeito que o ADR-0106 acabou de
   * medir em cinco jogos sem barra de acessibilidade nenhuma.
   */
  function drawVisualAxes(listSel: string, tabsSel: string): void {
    const el = ctx.$(listSel); if (!el) return;
    if (ctx.getSelVizPlayer() >= ctx.getNumPlayers()) ctx.setSelVizPlayer(0);
    const tabs = ctx.$(tabsSel); if (tabs) { tabs.hidden = true; tabs.innerHTML = ''; }
    const sel = ctx.getSelVizPlayer();
    const v = ctx.getPlayers()[sel]?.visual ?? PADRAO;
    el.innerHTML = axesHtml(v, t);
    el.querySelectorAll<HTMLElement>('button[data-eixo]').forEach((btn) => btn.addEventListener('click', () => {
      const choice = buttonChoice(btn.dataset);
      if (!choice) return; // botão de outro assunto, ou um `data-` editado à mão: não se adivinha
      const i = ctx.getSelVizPlayer();
      if (choice.axis === 'tema') {
        writePlayerTheme(i, choice.value as Theme);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), i, t(THEME_LABEL[choice.value as Theme])));
      } else {
        writePlayerCorrection(i, choice.value as Correction);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), i, t(CORRECTION_LABEL[choice.value as Correction])));
      }
    }));
  }

  return {
    applySharedTextures, updateVpDots, applyVpFilters, setPlayerViz, applyVizGlobal, reapplyVizAll,
    updateVizIndicator, rebakeDirect, renderVizGroup, renderVisualAxes: drawVisualAxes,
    // Os DOIS escritores por eixo (#104): é o que um painel de dois controles chama.
    setPlayerVisual: writePlayerVisual, setPlayerTheme: writePlayerTheme, setPlayerCorrection: writePlayerCorrection,
  };
}
