// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud.ts — HUD POR TELA + a infraestrutura de TELAS do jogo (Estágio 4). Duas responsabilidades coladas
// desde sempre no game.js: (a) a GRADE de `.player-screen` dentro de `#game-hud` — um contêiner por jogador,
// posicionado em %, que hospeda o HUD, o selo "jogo abandonado", o selo "aperte um botão para entrar"
// (`.vp-wait`), o menu de pausa daquele jogador e (em MP) o overlay de quiz dele; e (b) o CONTEÚDO do HUD —
// o OBJETIVO do jogador e o poder ativo — reescrito a cada frame por updateGameHud().
//
// ========================= O CONTADOR DEIXOU DE SER DE MOEDA (item 19) =========================
// O passo 4 do ADR-0027 matou a DEPENDÊNCIA (`vphudHtml(coinTarget = COIN_TARGET)` virou parâmetro
// obrigatório); o que sobrou era VOCABULÁRIO — o ícone cravado no markup, a classe `vphud-coins`, o campo
// `coins` do view-model. Nome não é seguido pelo compilador e não impede um pacote de se separar, e por isso
// a dívida era menor. Não era nula: ela dizia, em toda tela, que este HUD é de um jogo de plataforma.
//
// Agora o contador recebe um `Objective` — campo 5 de `core/contract` — e o ícone entra por injeção. E a
// mudança compra mais do que um nome: com `Objective.name` o contador GANHOU NOME ACESSÍVEL. Até aqui a
// criança cega ouvia o contador como "3 / 10", dois números sem substantivo — não havia o que falar porque a
// engine não sabia o nome do que se junta. Agora sabe, porque o jogo declara.
//
// O HUD é DOM SOBREPOSTO (não pixela: fica em alta definição sobre o canvas 320×180) — por isso vive aqui e
// não no render. O menu de pausa NÃO é deste módulo: `buildScreenPause(i)` entra por injeção e este módulo só
// anexa o retorno na tela certa e devolve os painéis prontos por `onScreensBuilt` (o game.js guarda `vpPause`
// e o `pauseActor`, que são do slice de pausa/ícones). Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
//
// Sem I/O no import: `document` só aparece DENTRO das funções → o módulo é importável no project node, onde os
// testes exercitam só a metade PURA (screenGrid/screenRect/hudRowView/vphudHtml/waitBadgeHtml).
import { screenGrid } from '../core/screens.js';
import type { PlayerView } from '../core/entity.js';
import type { Objective } from '../core/contract.js';

import { t } from '../core/i18n.js';
import type { DomQuery } from '../core/dom-query.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Só os campos do jogador que o HUD lê. Estrutural de propósito: o `players[]` real é `unknown[]` no core/state. */
/** O que o HUD lê do JOGADOR: o poder ativo e se ele desistiu. O progresso vem do `Objective`, não daqui —
 *  `collected` saiu da fatia, e com ele a última coisa que o HUD sabia sobre juntar objetos. */
export type HudPlayer = PlayerView<'activePower' | 'quit'>;

// ---------------------------------------------------------------------------------------------
// Lógica PURA (nenhum `document`; testável no project node)
// ---------------------------------------------------------------------------------------------

/** Grade de telas: 1 → 1×1, 2 → 2×1, 3-4 → 2×2 (a 3ª tela é centralizada na linha de baixo). */

// A grade agora mora em core/screens (folha, sem dependências), porque o layout e o CRT precisam da MESMA
// conta e não têm o que fazer importando de um módulo de HUD. Reexportada aqui sob o nome de sempre.
export { screenGrid } from '../core/screens.js';
export type { ScreenGrid } from '../core/screens.js';

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

/** O texto que o leitor de tela ouve no contador. A MOLDURA é a chave; o NOME do objetivo atravessa por
 *  parâmetro — a regra do pilar 3 (ADR-0010), a mesma que o currículo segue. */
export const contadorLabel = (o: Objective): string =>
  t('hud.contador', { have: String(o.have), need: String(o.need), nome: o.name.text });

/**
 * Markup do contador (objetivo na 1ª coluna, poder na 2ª).
 *
 * O objetivo entra INTEIRO — nome, quanto tem, quanto precisa — em vez de só o alvo numérico, e o ícone entra
 * por injeção. É o que tira o desenho da moeda de dentro da engine: o HUD mostra o que o jogo declarou
 * (campo 5 do contrato), sem saber se é moeda, palavra ou conta.
 *
 * O `aria-label` é a parte que não é renomeação: sem o nome do objetivo não havia o que dizer, e o contador
 * era mudo para quem não vê a tela.
 */
export function vphudHtml(objetivo: Objective, icone: string): string {
  return '<span class="vphud-obj" aria-label="' + contadorLabel(objetivo) + '"><b class="vphud-ico">' + icone
    + '</b> <b class="vphud-n">' + objetivo.have + '</b> / ' + objetivo.need
    + '</span><span class="vphud-power"><b class="vphud-ico">✨</b> <span class="vphud-pw">—</span></span>';
}

/** Markup do selo "aperte um botão para entrar" (tela criada em jogo, ainda sem dono). `i` é o índice 0-based. */
export function waitBadgeHtml(i: number): string {
  return '<div class="vphud-quit vp-wait">Jogador ' + (i + 1)
    + ': aperte um botão do SEU teclado ou de um controle livre para entrar</div>';
}

/** Projeção do HUD de UMA tela: tudo que updateGameHud() escreve no DOM, sem tocar no DOM. */
export interface HudRowView {
  /** Texto do contador: quanto o jogador tem, verbatim (sem formatação nem clamp). */
  have: string;
  /** O que o leitor de tela ouve no contador — reescrito junto com o número, senão ele ficaria falando o
   *  valor do primeiro quadro a partida inteira. É o defeito que um `aria-label` estático teria. */
  label: string;
  /** Rótulo curto do poder ativo, com o travessão como fallback de poder desconhecido/ausente. */
  power: string;
  /** `hidden` do selo "Jogo abandonado": escondido enquanto o jogador NÃO desistiu. */
  quitHidden: boolean;
  /** `style.visibility` do contador: quem desistiu vê tela preta com o selo, sem números. */
  visibility: 'hidden' | 'visible';
}

/**
 * Estado do HUD de um jogador. Verbatim do corpo de updateGameHud(), só que como valor.
 * `powerShort` é o POWER_SHORT do game.js (injetado — a mesma FUNÇÃO que game/coin-spawning.ts já recebe).
 * Função e não tabela: o texto depende do idioma ATUAL, e uma tabela lida no boot ficaria congelada nele.
 */
export function hudRowView(p: HudPlayer, powerShort: (kind: string) => string, objetivo: Objective): HudRowView {
  return {
    have: String(objetivo.have),
    label: contadorLabel(objetivo),
    // O `|| '—'` FICA, mesmo com o resolvedor já tratando desconhecido. Não é redundância: é a garantia de
    // que o campo do poder NUNCA aparece em branco no HUD, e ela não pode depender de todo consumidor futuro
    // lembrar de tratar o caso. Um teste meu ia perdê-la nesta mudança e reprovou por isso.
    power: powerShort(p.activePower) || '—',
    quitHidden: !p.quit,
    visibility: p.quit ? 'hidden' : 'visible',
  };
}

// ---------------------------------------------------------------------------------------------
// Casca de DOM (initHud(ctx) → HudApi)
// ---------------------------------------------------------------------------------------------

export interface HudCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /** Seletor DOM (forma do `$` de ui/dom.ts), injetado — o módulo nunca alcança `document` por global. */
  $: DomQuery;
  /**
   * POWER_SHORT: rótulos curtos de poder mostrados no HUD. Fica no game.js porque game/coin-spawning.ts
   * (showPower) também o recebe — injetar evita a 2ª cópia da tabela.
   */
  powerShort: (kind: string) => string;
  /**
   * O OBJETIVO do jogador `i` — campo 5 do contrato (`core/contract.Objective`): o nome do que se junta,
   * quanto tem e quanto precisa. FUNÇÃO e não valor, porque `have` muda a cada quadro.
   *
   * Era `hudTarget: number`, e antes disso `COIN_TARGET` por importação. Cada passo tirou uma coisa que o HUD
   * sabia sobre o jogo: primeiro a dependência, agora o assunto.
   */
  hudObjective: (playerIndex: number) => Objective;
  /** O ícone do contador. Era o desenho da moeda cravado no markup da engine; é do jogo, como o nome. */
  hudIcon: string;
  /**
   * Painel de pausa da tela `i`. NÃO é deste módulo (slice de pausa/ícones): entra por injeção e o HUD só
   * anexa o retorno dentro da `.player-screen` correspondente.
   */
  buildScreenPause: (i: number) => HTMLElement;
  /**
   * A BARRA RÁPIDA de acessibilidade da tela `i` (ui/pause-icons `buildQuickBar`). Anexada como IRMÃ da
   * `.screen-exp`, e não dentro dela: a barra é CONTROLE, e o modo empatia não a alcança (issue #82).
   */
  buildQuickBar: (i: number) => HTMLElement;
  /**
   * Chamado no FIM de buildGameHud() com os painéis de pausa recém-criados, em ordem de tela. É o gancho onde o
   * game.js reatribui `vpPause` (binding local dele) e roda o que o original rodava depois do laço
   * (applyLetra/renderPauseLegend). Opcional: sem ele o HUD monta igual, só não avisa ninguém.
   */
  onScreensBuilt?: (pausePanels: HTMLElement[]) => void;
  /** As barras rápidas recém-montadas, na ordem das telas. A raiz guarda para o `getA11yBars`. */
  onBarsBuilt?: (bars: HTMLElement[]) => void;
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
  /** A sub-camada de EXPERIÊNCIA de cada tela — o que a empatia atrapalha. Ver `buildGameHud`. */
  let vpExpDom: HTMLElement[] = [];

  function buildGameHud(): void {
    if (!gameHudEl) gameHudEl = ctx.$<HTMLElement>('#game-hud');
    if (!gameHudEl) return;
    gameHudEl.innerHTML = '';
    vpHudDom = []; vpQuitDom = []; vpScreens = []; vpExpDom = [];
    const panes: HTMLElement[] = [];
    const bars: HTMLElement[] = [];
    const n = ctx.getNumPlayers();
    for (let i = 0; i < screenCount(n); i++) {
      const r = screenRect(i, n);
      const scr = document.createElement('div');
      scr.className = 'player-screen'; scr.dataset.player = String(i);
      scr.style.left = r.L; scr.style.top = r.T; scr.style.width = r.W; scr.style.height = r.H;

      // A TELA TEM DUAS SUB-CAMADAS, e a divisão é de PAPEL (issue #82, decisão do Dev):
      //
      //   · EXPERIÊNCIA (`.screen-exp`) — HUD, selo de abandono e a atividade pedagógica do multi-tela. O
      //     modo de EMPATIA precisa atrapalhar aqui: é o prejuízo que a pessoa tem de sentir.
      //   · CONTROLE (o painel de pausa, irmão) — nunca é atingido por empatia. Simulação não é
      //     acessibilidade: é criar dificuldade onde a facilidade não existe. O que existe para DAR ACESSO
      //     — pausa, legenda, controle de toque — não pode ser degradado por ela.
      //
      // Elas são IRMÃS e não pai/filho porque `filter` de CSS desce para os descendentes e um filho não
      // consegue cancelá-lo: com a pausa dentro da experiência, não haveria como isentá-la.
      const exp = document.createElement('div');
      exp.className = 'screen-exp';
      scr.appendChild(exp); vpExpDom.push(exp);

      const d = document.createElement('div');
      d.className = 'vphud';
      d.innerHTML = vphudHtml(ctx.hudObjective(i), ctx.hudIcon);
      exp.appendChild(d); vpHudDom.push(d);

      const q = document.createElement('div');
      q.className = 'vphud-quit'; q.hidden = true; q.textContent = 'Jogo abandonado';
      exp.appendChild(q); vpQuitDom.push(q);

      // A BARRA RÁPIDA entra entre a experiência e a pausa, e é IRMÃ das duas. Não vai DENTRO da
      // `.screen-exp` porque `filter` de CSS desce para os descendentes e um filho não consegue cancelá-lo:
      // ali dentro, o modo empatia degradaria justamente o que existe para dar acesso.
      const bar = ctx.buildQuickBar(i);
      scr.appendChild(bar); bars.push(bar);

      const sp = ctx.buildScreenPause(i);
      scr.appendChild(sp); panes.push(sp);

      gameHudEl.appendChild(scr); vpScreens.push(scr);
    }
    // O original terminava com `vpPause` preenchido e dois efeitos DEFENSIVOS (applyLetra/renderPauseLegend em
    // try/catch, porque no 1º build do init LETRA/PAD_DESIGNS ainda estão em TDZ). Ambos são de OUTROS slices →
    // saem por este gancho, com o try/catch preservado no game.js. Ver "chamada defensiva" no relatório.
    ctx.onBarsBuilt?.(bars);
    ctx.onScreensBuilt?.(panes);
  }

  function updateGameHud(): void {
    for (let i = 0; i < vpHudDom.length; i++) {
      const p = ctx.getPlayers()[i] as HudPlayer | undefined;
      if (!p) continue;
      const d = vpHudDom[i];
      const v = hudRowView(p, ctx.powerShort, ctx.hudObjective(i));
      const n = d.querySelector('.vphud-n'); if (n) n.textContent = v.have;
      // O rótulo acessível acompanha o número. Escrevê-lo só na montagem deixaria o leitor de tela repetindo
      // "0 de 10" a partida inteira — pior do que não ter rótulo, porque soa como informação.
      const obj = d.querySelector('.vphud-obj'); if (obj) obj.setAttribute('aria-label', v.label);
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
