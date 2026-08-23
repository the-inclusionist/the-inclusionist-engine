// SPDX-License-Identifier: GPL-3.0-or-later
// ui/hud.ts — HUD POR TELA + a infraestrutura de TELAS do jogo (Estágio 4). Duas responsabilidades coladas
// desde sempre no game.js: (a) a GRADE de `.player-screen` dentro de `#game-hud` — um contêiner por jogador,
// posicionado em %, que hospeda o HUD, o selo "jogo abandonado", o selo "aperte um botão para entrar"
// (`.vp-wait`), o menu de pausa daquele jogador e (em MP) o overlay de quiz dele; e (b) o CONTEÚDO do HUD —
// moedas coletadas / poder ativo — reescrito a cada frame por updateGameHud().
//
// O HUD é DOM SOBREPOSTO (não pixela: fica em alta definição sobre o canvas 320×180) — por isso vive aqui e
// não no render. O menu de pausa NÃO é deste módulo: `buildScreenPause(i)` entra por injeção e este módulo só
// anexa o retorno na tela certa e devolve os painéis prontos por `onScreensBuilt` (o game.js guarda `vpPause`
// e o `pauseActor`, que são do slice de pausa/ícones). Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
//
// Sem I/O no import: `document` só aparece DENTRO das funções → o módulo é importável no project node, onde os
// testes exercitam só a metade PURA (screenGrid/screenRect/hudRowView/vphudHtml/waitBadgeHtml).
import { COIN_TARGET } from '../core/constants.js';
import { players, numPlayers } from '../core/state.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** Só os campos do jogador que o HUD lê. Estrutural de propósito: o `players[]` real é `unknown[]` no core/state. */
export interface HudPlayer {
  collected: number;
  activePower: string;
  quit: boolean;
}

// ---------------------------------------------------------------------------------------------
// Lógica PURA (nenhum `document`; testável no project node)
// ---------------------------------------------------------------------------------------------

/** Grade de telas: 1 → 1×1, 2 → 2×1, 3-4 → 2×2 (a 3ª tela é centralizada na linha de baixo). */
export interface ScreenGrid { cols: number; rows: number; }

/**
 * Colunas/linhas da grade para `n` jogadores. Verbatim do game.js (screenRect) — e a MESMA conta aparece em
 * ui/layout.ts, em fitsN() e em configureRender(): ver "duplicação" no relatório da extração.
 */
export function screenGrid(n: number): ScreenGrid {
  return { cols: n <= 1 ? 1 : (n <= 2 ? n : 2), rows: n <= 2 ? 1 : 2 };
}

/** Retângulo da tela `i` em porcentagens de CSS, já prontas para `style.left/top/width/height`. */
export interface ScreenRect { L: string; T: string; W: string; H: string; }

/**
 * Posição/tamanho da tela `i` numa grade de `n` jogadores. Verbatim de screenRect(i) — que lia `numPlayers`
 * global; aqui `n` é parâmetro (mesma conta, testável sem estado). Caso especial preservado: com 3 telas, a
 * terceira é centralizada na linha de baixo, para casar com o posicionamento do render (configureRender).
 */
export function screenRect(i: number, n: number): ScreenRect {
  const { cols, rows } = screenGrid(n);
  const col = i % cols, row = Math.floor(i / cols);
  let colFrac = col / cols;
  if (n === 3 && i === 2) colFrac = (1 - 1 / cols) / 2;
  return { L: (colFrac * 100) + '%', T: (row / rows * 100) + '%', W: (100 / cols) + '%', H: (100 / rows) + '%' };
}

/** Quantas telas o HUD monta: ao menos uma, mesmo antes de `players[]` existir no boot. Verbatim (Math.max(1,…)). */
export function screenCount(n: number): number { return Math.max(1, n); }

/** Markup do contador (moedas na 1ª coluna, poder na 2ª). `coinTarget` é parâmetro só para o teste. */
export function vphudHtml(coinTarget: number = COIN_TARGET): string {
  return '<span class="vphud-coins"><b class="vphud-ico">🪙</b> <b class="vphud-n">0</b> / ' + coinTarget
    + '</span><span class="vphud-power"><b class="vphud-ico">✨</b> <span class="vphud-pw">—</span></span>';
}

/** Markup do selo "aperte um botão para entrar" (tela criada em jogo, ainda sem dono). `i` é o índice 0-based. */
export function waitBadgeHtml(i: number): string {
  return '<div class="vphud-quit vp-wait">Jogador ' + (i + 1)
    + ': aperte um botão do SEU teclado ou de um controle livre para entrar</div>';
}

/** Projeção do HUD de UMA tela: tudo que updateGameHud() escreve no DOM, sem tocar no DOM. */
export interface HudRowView {
  /** Texto do contador de moedas (verbatim: `String(p.collected)` — sem formatação nem clamp). */
  coins: string;
  /** Rótulo curto do poder ativo, com o travessão como fallback de poder desconhecido/ausente. */
  power: string;
  /** `hidden` do selo "Jogo abandonado": escondido enquanto o jogador NÃO desistiu. */
  quitHidden: boolean;
  /** `style.visibility` do contador: quem desistiu vê tela preta com o selo, sem números. */
  visibility: 'hidden' | 'visible';
}

/**
 * Estado do HUD de um jogador. Verbatim do corpo de updateGameHud(), só que como valor.
 * `powerShort` é o POWER_SHORT do game.js (injetado — o mesmo objeto que game/coin-spawning.ts já recebe).
 */
export function hudRowView(p: HudPlayer, powerShort: Record<string, string>): HudRowView {
  return {
    coins: String(p.collected),
    power: powerShort[p.activePower] || '—',
    quitHidden: !p.quit,
    visibility: p.quit ? 'hidden' : 'visible',
  };
}

// ---------------------------------------------------------------------------------------------
// Casca de DOM (initHud(ctx) → HudApi)
// ---------------------------------------------------------------------------------------------

export interface HudCtx {
  /** Seletor DOM (forma do `$` de ui/dom.ts), injetado — o módulo nunca alcança `document` por global. */
  $: DomQuery;
  /**
   * POWER_SHORT: rótulos curtos de poder mostrados no HUD. Fica no game.js porque game/coin-spawning.ts
   * (showPower) também o recebe — injetar evita a 2ª cópia da tabela.
   */
  powerShort: Record<string, string>;
  /**
   * Painel de pausa da tela `i`. NÃO é deste módulo (slice de pausa/ícones): entra por injeção e o HUD só
   * anexa o retorno dentro da `.player-screen` correspondente.
   */
  buildScreenPause: (i: number) => HTMLElement;
  /**
   * Chamado no FIM de buildGameHud() com os painéis de pausa recém-criados, em ordem de tela. É o gancho onde o
   * game.js reatribui `vpPause` (binding local dele) e roda o que o original rodava depois do laço
   * (applyLetra/renderPauseLegend). Opcional: sem ele o HUD monta igual, só não avisa ninguém.
   */
  onScreensBuilt?: (pausePanels: HTMLElement[]) => void;
}

export interface HudApi {
  /** (Re)monta `#game-hud`: uma `.player-screen` por jogador, com HUD, selo de abandono e painel de pausa. */
  buildGameHud: () => void;
  /** Reescreve moedas/poder e o selo de abandono de todas as telas montadas. Chamado a cada frame. */
  updateGameHud: () => void;
  /** Contêiner `.player-screen` da tela `i` (o quiz de MP e outros overlays por jogador penduram aqui). */
  getScreen: (i: number) => HTMLElement | null;
  /** Cria o selo `.vp-wait` na tela `i` (idempotente: não duplica se já existir). */
  showWaitingBadge: (i: number) => void;
  /** Remove o selo `.vp-wait` da tela `i` (o jogador entrou). No-op se a tela ou o selo não existirem. */
  clearWaitingBadge: (i: number) => void;
}

export function initHud(ctx: HudCtx): HudApi {
  let gameHudEl: HTMLElement | null = null;
  let vpHudDom: HTMLElement[] = [];
  let vpQuitDom: HTMLElement[] = [];
  let vpScreens: HTMLElement[] = [];

  function buildGameHud(): void {
    if (!gameHudEl) gameHudEl = ctx.$<HTMLElement>('#game-hud');
    if (!gameHudEl) return;
    gameHudEl.innerHTML = '';
    vpHudDom = []; vpQuitDom = []; vpScreens = [];
    const panes: HTMLElement[] = [];
    for (let i = 0; i < screenCount(numPlayers); i++) {
      const r = screenRect(i, numPlayers);
      const scr = document.createElement('div');
      scr.className = 'player-screen'; scr.dataset.player = String(i);
      scr.style.left = r.L; scr.style.top = r.T; scr.style.width = r.W; scr.style.height = r.H;

      const d = document.createElement('div');
      d.className = 'vphud';
      d.innerHTML = vphudHtml();
      scr.appendChild(d); vpHudDom.push(d);

      const q = document.createElement('div');
      q.className = 'vphud-quit'; q.hidden = true; q.textContent = 'Jogo abandonado';
      scr.appendChild(q); vpQuitDom.push(q);

      const sp = ctx.buildScreenPause(i);
      scr.appendChild(sp); panes.push(sp);

      gameHudEl.appendChild(scr); vpScreens.push(scr);
    }
    // O original terminava com `vpPause` preenchido e dois efeitos DEFENSIVOS (applyLetra/renderPauseLegend em
    // try/catch, porque no 1º build do init LETRA/PAD_DESIGNS ainda estão em TDZ). Ambos são de OUTROS slices →
    // saem por este gancho, com o try/catch preservado no game.js. Ver "chamada defensiva" no relatório.
    ctx.onScreensBuilt?.(panes);
  }

  function updateGameHud(): void {
    for (let i = 0; i < vpHudDom.length; i++) {
      const p = players[i] as HudPlayer | undefined;
      if (!p) continue;
      const d = vpHudDom[i];
      const v = hudRowView(p, ctx.powerShort);
      const n = d.querySelector('.vphud-n'); if (n) n.textContent = v.coins;
      const pw = d.querySelector('.vphud-pw'); if (pw) pw.textContent = v.power;
      if (vpQuitDom[i]) vpQuitDom[i].hidden = v.quitHidden;
      if (d) d.style.visibility = v.visibility; // jogador que saiu: tela preta "jogo abandonado"
    }
  }

  const getScreen = (i: number): HTMLElement | null => vpScreens[i] ?? null;

  function showWaitingBadge(i: number): void {
    const scr = vpScreens[i];
    if (scr && !scr.querySelector('.vp-wait')) scr.insertAdjacentHTML('beforeend', waitBadgeHtml(i));
  }

  function clearWaitingBadge(i: number): void {
    const scr = vpScreens[i];
    const w = scr && scr.querySelector('.vp-wait');
    if (w) w.remove();
  }

  return { buildGameHud, updateGameHud, getScreen, showWaitingBadge, clearWaitingBadge };
}
