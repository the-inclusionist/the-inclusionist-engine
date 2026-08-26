// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/shell.ts — A CASCA: em que TELA o jogo está, e o que a tela liga e desliga ao trocar.
//
// Este módulo responde a UMA pergunta: "estamos no título, jogando ou pausados — e o que isso significa para o
// documento?". Ele é o irmão de cima de tudo o que já saiu: game/session.ts decide o que é uma RODADA,
// render/draw.ts decide o que é um QUADRO, e aqui se decide o que é uma TELA. Nada aqui sabe de física, de
// moeda ou de pixel; tudo aqui sabe de `hidden`, de foco, de mudo e do menu de pausa.
//
// O QUE VEIO, E DE ONDE (bloco "E14: shell — título/splash + pausa" do game.js)
//  · `setPhase(p)`        — a reação de UI à troca de fase. O VALOR continua em core/state.ts (setPhaseValue);
//                           o que mora aqui é só a consequência visível.
//  · `pauseActs`          — a tabela de ações dos `.pm-btn` do menu de pausa (por tela).
//  · `pauseSelect()`      — põe o 1º item (Continuar) selecionado em cada tela de pausa.
//  · `printMode()`        — esconde as pausas para ver a tela limpa; qualquer botão volta.
//  · `togglePause()`      — jogando ⇄ pausado.
//  · `updateTitleLegend()`— a legenda de dispositivo do splash (2 linhas de "chips": movimento/pausa e os 4
//                           botões de ação, com o que está CONFIGURADO para o Jogador 1).
//
// POR QUE `setPhase` NÃO VIROU UMA MÁQUINA DE ESTADOS COM TABELA DE TRANSIÇÃO — E O QUE VIROU NO LUGAR
// O pedido do projeto era transformar a sequência de `if`s numa máquina de estados de verdade. Olhei e a
// resposta honesta é: metade sim, metade não, e a metade que vale não é a que o nome sugere.
//   · NÃO vale a tabela de transição. São TRÊS estados e as nove transições são todas legais — de qualquer
//     fase para qualquer fase, sem guarda, sem evento nomeado, sem hook de entrada/saída além do corpo que já
//     está aqui. Uma `Map<[from,to], handler>` sobre isso não impede nenhum estado ilegal (não existe nenhum),
//     não descreve nada que o código já não diga, e troca um bloco linear que se lê de cima a baixo por uma
//     indireção que obriga a saltar. Seria cerimônia sobre três estados. Não fiz.
//   · VALE, e muito, separar a DECISÃO do EFEITO. Os `if`s do original não são transições: são nove perguntas
//     diferentes feitas à MESMA fase (`p!=='playing'`, `p!=='title'`, `p!=='paused'`, `p==='paused'`…),
//     espalhadas no meio de nove escritas no DOM. Isso é uma PROJEÇÃO pura da fase disfarçada de sequência
//     imperativa. Extraí a projeção — `phaseView(p)` devolve o registro completo do que a fase manda fazer, e
//     `applyPhaseView` é a única parte que toca o documento. O ganho é concreto e não é estético: a decisão
//     passa a ser testável no project `node`, sem DOM, sem PIXI e sem áudio, e um erro de sinal num `!==`
//     (o tipo de erro que aqui deixa a11y quebrada em silêncio: overlay do título visível durante o jogo,
//     áudio não silenciado na pausa) vira uma asserção em vez de um sintoma que só aparece jogando.
//     É o mesmo movimento que ui/title.ts já fez com `computeTitleMenuView`, e por isso é o precedente da casa.
//   · O único pedaço com MEMÓRIA (e portanto o único candidato legítimo a "estado") é a restauração dos
//     controles de toque, que depende do `dataset.wasOn` gravado na pausa anterior. Esse virou
//     `touchControlsPlan(...)`, uma função pura de (fase, wasOn, escondido, nº de telas) → (escondido', wasOn').
//     Ver, logo abaixo, o defeito que essa separação tornou visível.
//
// O QUE FICOU DE FORA, E POR QUÊ
//  · `fpsTick` — a fronteira listava, mas ele não é casca: é instrumentação de HUD (escreve `#hud-fps` e
//    `#hud-fpsmin`), tem três contadores próprios de módulo e é chamado do laço a cada quadro, não na troca de
//    tela. Trazê-lo para cá acoplaria o "em que tela estamos" ao "quantos quadros por segundo" sem nenhum
//    parentesco. O precedente da casa já é esse: ui/layout.ts diz, no cabeçalho, "fpsTick/configureRender
//    seguem no game.js (outro concern)". Não forcei; segue no game.js, e o lar natural dele, quando chegar a
//    vez, é ui/hud.ts.
//  · `padKind()` — NÃO extraí porque JÁ ESTÁ EXTRAÍDO: `input/touch.ts` exporta `padKind()` desde a Onda A,
//    com o corpo idêntico ao do game.js, e o cabeçalho de lá registra que a cópia é órfã. A que sobrou no
//    game.js é código morto duplicado (nenhum chamador — ver o relatório). O certo é apagá-la, não mudá-la
//    de lugar mais uma vez.
//  · `updateTitleLegend()` — a fronteira deixava em aberto se ela é de shell ou de menu-nav. É de SHELL, e a
//    razão é simples: ela não navega nada. Não lê foco, não trata tecla, não anda entre itens; ela pinta o
//    rodapé de UMA tela específica (o título) com a configuração de entrada vigente, e quem a chama é o
//    próprio `setPhase('title')`. Se morasse em ui/menu-nav, a casca precisaria importar o módulo de
//    navegação só para desenhar uma legenda, e a dependência apontaria para o lado errado (a casca chamando o
//    teclado). Ficando aqui, ui/menu-nav não precisa saber que existe uma tela de título.
//  · O `.pm-btn`/`.pi-btn` (markup e delegação de clique) é de ui/pause-icons.ts, que já os constrói e já
//    consome esta tabela por `getPauseActs()`. Aqui está só a TABELA, não o botão.
//  · Abrir/fechar os nove diálogos de configuração é de ui/settings-panel.ts + ui/settings-*.ts. `pauseActs`
//    apenas os CHAMA, por injeção.
//
// INJEÇÃO E ORDEM DE BOOT (a armadilha desta etapa)
//   · `phase` e `numPlayers` NÃO entram por getter, e isso é de propósito: eles deixaram de ser `let` do
//     game.js na Fase 2 e hoje são bindings vivos de core/state.ts. Importá-los direto é exatamente o que
//     game/session.ts e input/touch.ts já fazem — um getter aqui seria uma indireção sobre uma indireção.
//     Quem AINDA é `let` do game.js entra por getter: `vpPause` (reatribuído por `buildGameHud`) e
//     `pauseActor` (reatribuído por seis lugares, incluindo o ctx do gamepad).
//   · TODA entrada de `pauseActs` é um callback, e não um valor, porque `initShell` precisa poder ser chamado
//     no lugar do bloco E14 (linha ~1373 do game.js) enquanto quase tudo o que a tabela chama — `openTypo`,
//     `openAudio`, `openMovement`, `openVisual`, `openHelp`, `quitGame`, `fitsN`, `joinPlayer` — são
//     `function` içadas OU `const` declarados depois (`motor`, `motion`, `empathy`, `hud`, `selVizPlayer`).
//     Com callbacks, a resolução acontece na CHAMADA (sempre pós-boot) e não na montagem do ctx.
//   · `setPhase` é chamado de fora por game/session.ts, input/gamepad.ts, game/attract.ts e
//     ui/activities-menu.ts, todos com o ctx montado ANTES do ponto de extração. Por isso o game.js deve
//     manter um envelope `function setPhase(p){ shell.setPhase(p); }` — declaração de função, içada — em vez
//     de trocar as quatro fiações. É o mesmo padrão já usado lá para `hideTouchControls`, `showTouchControls`,
//     `restartGame`, `fitsN`, `joinPlayer` e `quitGame`.
//   · O original protegia duas chamadas com `typeof pauseSelect==='function'` / `typeof reflectPauseIcons===
//     'function'`. Eram guardas de TDZ do tempo do monólito; aqui `pauseSelect` é função local (sempre
//     definida) e `reflectPauseIcons` é injetada (sempre função). Verifiquei que `reflectPauseIcons` é `const`
//     declarado no game.js MUITO antes de a primeira pausa acontecer, então as guardas nunca foram falsas em
//     execução real — removê-las não muda comportamento, só tira ruído. Registrado aqui porque é a única
//     linha que não é cópia literal.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara dados e funções puras. Todo efeito passa por `initShell`.
// GUARDAS: cada consulta ao DOM passa por guarda de nulo, como manda a casa — é o que permite rodar no project
// `node` com um `$` falso que devolve `null`.
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C3).

import { t } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';
import { phase, numPlayers, setPhaseValue, players, type Phase } from '../core/state.js';
import { PAD_DESIGNS } from '../input/devices.js'; // módulo-folha de DADOS (zero deps) — importado, não injetado
import type { DomQuery } from '../core/dom-query.js';
import type { PadMap } from '../input/gamepad.js';

/* ===================== interfaces mínimas ===================== */

/** ui/dom.ts `$` — injetado para o teste node poder passar um DOM falso. */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** O que `pauseActs.addplayer` lê de um jogador. `players` é `unknown[]` em core/state.ts. */
/** A casca só precisa saber QUEM é o jogador e se ele está esperando a próxima rodada. */
type ShellPlayer = PlayerView<'i' | 'waiting'>;

/** O subconjunto de `Window` que `printMode` usa (add/remove de ouvinte em CAPTURA + o adiamento de 80ms). */
export interface ShellWindow {
  addEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  removeEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  setTimeout(fn: () => void, ms: number): unknown;
}

/** Uma tela de pausa (`.screen-pause`) — só o que a casca toca. */
export interface PauseScreen {
  hidden: boolean;
  querySelectorAll<T extends Element = Element>(sel: string): ArrayLike<T> & Iterable<T>;
}

/** Um gamepad, do jeito mínimo que a legenda do título lê. */
interface PadLike { index: number; id: string; mapping: string }

// ---------------------------------------------------------------------------------------------------------
// PROJEÇÃO PURA — a decisão de fase, sem DOM. Testável no project `node`.
// ---------------------------------------------------------------------------------------------------------

/** As três fases, na ordem em que o jogo as vive. Fonte única do tipo (core/state.ts declara o mesmo `Phase`). */
export const PHASES: readonly Phase[] = ['title', 'playing', 'paused'];

/** Para onde o foco vai ao ENTRAR na fase. `null` = ninguém foca nada (não existe hoje; é o default seguro). */
export type PhaseFocus = 'game-region' | 'pause-menu' | 'title-button';

/**
 * O que a fase `p` manda o documento fazer. É a sequência de `if`s do `setPhase` original lida como o que ela
 * sempre foi: uma projeção da fase. Nenhum campo depende de histórico — o único que dependeria
 * (`#touch-controls`) mora em `touchControlsPlan`, separado de propósito.
 */
export interface PhaseView {
  /** `#title-overlay`.hidden — o splash só aparece no título. */
  titleOverlayHidden: boolean;
  /** `#pause-overlay`.hidden — SEMPRE true. A pausa global foi aposentada na Etapa 2 (agora é uma por tela);
   *  o elemento continua no index.html e o original o escondia incondicionalmente. Verbatim. */
  pauseOverlayHidden: true;
  /** `.screen-pause`.hidden de CADA tela — os menus por tela só aparecem na pausa. */
  screenPauseHidden: boolean;
  /** `setMasterMuted(...)` — GAG: fora de 'playing' TODO o som cala (loops de ambiente/chuva inclusive). */
  masterMuted: boolean;
  /** `hideTouchControls()` — menu ativo (título/pausa) = sem controle virtual. */
  hideTouchControls: boolean;
  /** `#btn-pause`[aria-pressed] — o botão de pausa reflete a fase para o leitor de tela. */
  pausePressed: boolean;
  /** Quem recebe o foco ao entrar nesta fase. */
  focus: PhaseFocus;
}

/** Verbatim das nove perguntas que o `setPhase` do game.js fazia à fase, agora feitas de uma vez só. */
export function phaseView(p: Phase): PhaseView {
  return {
    titleOverlayHidden: p !== 'title',
    pauseOverlayHidden: true,
    screenPauseHidden: p !== 'paused',
    masterMuted: p !== 'playing',
    hideTouchControls: p !== 'playing',
    pausePressed: p === 'paused',
    focus: p === 'playing' ? 'game-region' : p === 'paused' ? 'pause-menu' : 'title-button',
  };
}

/** O estado de `#touch-controls` que interessa: escondido? e havia controle ligado antes da pausa? */
export interface TouchControlsState {
  /** `tc.hidden`. */
  hidden: boolean;
  /** `tc.dataset.wasOn === '1'`. Ausente/qualquer outro valor = false, como no original. */
  wasOn: boolean;
}

/**
 * O ÚNICO pedaço de `setPhase` com memória: esconder os controles de toque ao pausar (guardando que estavam
 * ligados) e devolvê-los ao retomar. Pura, e por isso pinável sem navegador.
 *
 * O estado que chega aqui é o de ANTES de `hideTouchControls()` — quem chama lê primeiro e esconde depois.
 * Já foi o contrário, e o efeito era que `wasOn` nunca era gravado (o plano via o pad como se já estivesse
 * desligado): pausar no celular sumia com o direcional virtual e retomar não o devolvia.
 */
export function touchControlsPlan(p: Phase, st: TouchControlsState, screens: number): TouchControlsState {
  if (p === 'paused') {
    if (!st.hidden) return { hidden: true, wasOn: true }; // guarda que estava ligado e esconde
    return st;                                            // já escondido: nada muda (nem `wasOn`)
  }
  if (p === 'playing') {
    return { hidden: st.wasOn && screens <= 1 ? false : st.hidden, wasOn: false };
  }
  return { hidden: true, wasOn: false }; // título: some e esquece
}

// ---------------------------------------------------------------------------------------------------------
// LEGENDA DO TÍTULO — a parte pura (montar as duas linhas de chips a partir dos glifos escolhidos)
// ---------------------------------------------------------------------------------------------------------

/** Um "chip" da legenda: o glifo (com cor de fundo opcional) seguido da palavra que ele significa. */
export function chip(txt: string, col: string | null, word?: string): string {
  return `<span class="lg"><span class="lg-ico"${col ? ` style="background:${col}"` : ''}>${txt}</span>${word ? ' ' + word : ''}</span>`;
}

/** Os quatro botões de ação, na ordem fixa da legenda: pular · especial · correr · trocar. */
export interface ActionGlyphs {
  jump: readonly [string, string | null];
  especial: readonly [string, string | null];
  run: readonly [string, string | null];
  swap: readonly [string, string | null];
}

/**
 * Linha 1 da legenda: direcional + START/Enter. Igual para toque e gamepad; o teclado sobrescreve os rótulos.
 *
 * As palavras vêm de `legend.*` e são resolvidas AQUI, a cada chamada — não numa tabela de módulo, que
 * congelaria o idioma no boot. Registro CURTO de propósito: esta fileira fica embaixo de um glifo e não tem
 * largura para o "Correr / interagir" que a lista de mapeamento usa (ver a nota em pt.ts).
 */
export function legendRow1(dirTxt: string, pauseTxt: string): string {
  return chip(dirTxt, null, t('legend.move')) + chip(pauseTxt, null, t('legend.pause'));
}

/** Linha 2 da legenda: os quatro botões de ação. */
export function legendRow2(g: ActionGlyphs): string {
  return chip(g.jump[0], g.jump[1], t('legend.jump')) + chip(g.especial[0], g.especial[1], t('legend.especial'))
    + chip(g.run[0], g.run[1], t('legend.run')) + chip(g.swap[0], g.swap[1], t('legend.swap'));
}

/** O innerHTML final de `#title-legend`: duas `.lg-row`. */
export function legendHtml(l1: string, l2: string): string {
  return `<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`;
}

/**
 * Glifos de um pad FÍSICO. `layout` sai de `padLayoutFromId` (só quando `mapping === 'standard'`; fora do
 * padrão é sempre 'generic'), e `custom` é o mapa do assistente (só consultado FORA do padrão). Verbatim:
 * um botão sem entrada no mapa custom cai no índice default ('0'..'3'), e um índice que o design não conhece
 * vira o par `[índice, '#3a4a6a']` — o cinza de fallback.
 */
export function padActionGlyphs(layout: string, custom: PadMap | null): ActionGlyphs {
  const set = PAD_DESIGNS[layout] || PAD_DESIGNS.generic;
  // O `typeof b === 'object'` não é cerimônia: o `PadMap` admite `boolean` além de `PadBinding` — é o
  // sentinela `_skip: true` do assistente de mapeamento. As quatro chaves lidas aqui nunca são ele, então
  // em execução nada muda; o que muda é que a leitura passa a PERGUNTAR em vez de supor.
  const bOf = (k: string, def: string): string => {
    const b = custom && custom[k];
    return b && typeof b === 'object' && typeof b.b === 'number' ? String(b.b) : def;
  };
  const gy = (k: string): readonly [string, string | null] => (set[k] as [string, string] | undefined) || [k, '#3a4a6a'];
  return { jump: gy(bOf('jump', '0')), especial: gy(bOf('especial', '1')), run: gy(bOf('run', '2')), swap: gy(bOf('swap', '3')) };
}

/** Glifos do joystick VIRTUAL (toque): sempre o design 'generic' (0/1/2/3), sem mapa custom. */
export function touchActionGlyphs(): ActionGlyphs {
  return padActionGlyphs('generic', null);
}

/**
 * Escolhe QUAL gamepad a legenda descreve: o do Jogador 1, se ele tiver um associado (`players[0].pad`);
 * senão o primeiro conectado. Verbatim do laço do game.js — inclusive o detalhe de que, com `p1pad >= 0` e
 * nenhum pad daquele índice presente, o resultado é `null` (a legenda cai no teclado) em vez de pegar outro.
 */
export function pickLegendPad(pads: readonly (PadLike | null)[], p1pad: number): PadLike | null {
  let gp: PadLike | null = null;
  for (const g of pads) {
    if (!g) continue;
    if (p1pad >= 0) { if (g.index === p1pad) { gp = g; break; } } else if (!gp) gp = g;
  }
  return gp;
}

// ---------------------------------------------------------------------------------------------------------
// ctx / api
// ---------------------------------------------------------------------------------------------------------

export interface ShellCtx {
  /* --- DOM e plataforma --- */
  /** ui/dom.ts `$`. Injetado: o módulo nunca alcança `document`. */
  $: DomQuery;
  /** `window` — só para os dois ouvintes em CAPTURA do modo Print e o adiamento de 80ms. */
  win: ShellWindow;
  /** platform/audio.ts `setMasterMuted` — o nó mestre que cala TUDO na pausa/título (GAG). */
  setMasterMuted: (muted: boolean) => void;
  /** core/a11y-sr `srSay` (educado) e `srAlert` (assertivo). */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;

  /* --- o que o game.js AINDA reatribui: getters --- */
  /** `let vpPause` — `buildGameHud` REATRIBUI a array a cada troca de nº de telas. */
  getPauseScreens: () => PauseScreen[];
  /** `let pauseActor` — quem abriu o menu; os submenus de a11y escopam no jogador dele. */
  getPauseActor: () => number;

  /* --- efeitos vizinhos (todos `const`/`function` do game.js; entram como callback) --- */
  /** input/touch.ts via o envelope içado do game.js: some com o direcional virtual. */
  hideTouchControls: () => void;
  /** ui/pause-icons.ts: reflete os `.pi-btn` de todas as telas (estado de a11y). */
  reflectPauseIcons: () => void;

  /* --- legenda do título --- */
  /** Adaptador da Gamepad API — mesmo padrão de input/gamepad.ts (é o que a torna testável sem navegador). */
  getGamepads: () => readonly (PadLike | null)[];
  /** `document.body.classList.contains('touch-mode')` — injetado para não alcançar `document`. */
  isTouchMode: () => boolean;
  /** input/touch.ts `padLayoutFromId` — id do controle → design de botões. */
  padLayoutFromId: (id: string) => string;
  /** input/gamepad.ts `padMapFor` — mapa do assistente para aquele modelo (só usado FORA do padrão). */
  /** O mapa do controle. `PadMap` vem de `input/gamepad`, que é dono dele — a versão escrita aqui,
   *  `Record<string, { b?: number }>`, era uma aproximação: perdia o `boolean` que o mapa admite. */
  padMapFor: (id: string) => PadMap | null;
  /** input/keyboard-runtime.ts `kbFor(i)` — as teclas CONFIGURADAS do jogador `i` (remap respeitado). */
  kbFor: (i: number) => Record<string, string[]>;
  /** ui/settings-controls.ts `keyName` — `KeyboardEvent.code` → rótulo humano. */
  keyName: (code: string) => string;

  /* --- as ações do menu de pausa (cada uma é um callback: TDZ, ver o cabeçalho) --- */
  /** `setQuizLevel(n, announce)` — o ciclo 1..5 do nível de alfabetização. */
  setQuizLevel: (n: number, announce: boolean) => void;
  /** `quizLevel` de core/state.ts — lido para calcular o próximo do ciclo. */
  getQuizLevel: () => number;
  openTypo: () => void;
  openAudio: () => void;
  openMovement: () => void;
  openVisual: () => void;
  openHelp: () => void;
  quitGame: () => void;
  /** game/session.ts: cabe mais uma tela nesta janela? */
  fitsN: (n: number) => boolean;
  /** game/session.ts: cria/ativa o jogador seguinte; `null` = sem pad associado ainda. */
  joinPlayer: (padIdx: number | null) => boolean;
  /** ui/hud.ts: crachá "aperte um botão para entrar" na tela do jogador novo. */
  showWaitingBadge: (i: number) => void;
  /** ui/settings-motor.ts: escopa o painel Movimento no jogador que abriu. */
  setMotorPlayer: (i: number) => void;
  /** ui/settings-motion.ts `setSelectedPlayer`: idem para o painel Animação. */
  setMotionPlayer: (i: number) => void;
  /** ui/settings-motion.ts `motion.open`. */
  openMotion: () => void;
  /** Abre o menu de Comunicação Aumentada e Alternativa (ui/settings-caa). */
  openCaa: () => void;
  /** ui/settings-empathy.ts `empathy.open`. */
  openEmpathy: () => void;
  /** `let selVizPlayer` do game.js — escopa Visual e Empatia no jogador que abriu. */
  setSelVizPlayer: (i: number) => void;
}

/** A tabela de ações dos `.pm-btn`. Chave = `data-act` do botão (PM_BTNS, de ui/activities-menu.ts). */
export type PauseActs = Record<string, () => void>;

export interface ShellApi {
  /** Troca de fase: grava o valor em core/state.ts e aplica a projeção `phaseView` ao documento. */
  setPhase: (p: Phase) => void;
  /** jogando ⇄ pausado. No título, não faz nada (verbatim: o `else if` do original não tem `else`). */
  togglePause: () => void;
  /** Põe o 1º `.pm-btn` (Continuar) selecionado em CADA tela de pausa. */
  pauseSelect: () => void;
  /** Modo Print: esconde as pausas para ver a tela limpa; qualquer tecla/clique as traz de volta. */
  printMode: () => void;
  /** Repinta `#title-legend` com o dispositivo e o mapeamento vigentes do Jogador 1. */
  updateTitleLegend: () => void;
  /** A tabela de ações do menu de pausa — consumida por ui/pause-icons.ts (`getPauseActs`). */
  pauseActs: PauseActs;
}

export function initShell(ctx: ShellCtx): ShellApi {
  /* ===================== a legenda do título ===================== */

  /** Linha 1+2 quando não há toque nem gamepad: as teclas REALMENTE configuradas do Jogador 1. */
  function keyboardLegend(): [string, string] {
    const m = ctx.kbFor(0);
    const K = (a: string): string => ctx.keyName((m[a] || [])[0] || '?');
    const l1 = legendRow1(`${K('up')} ${K('left')} ${K('down')} ${K('right')}`, 'Enter');
    const l2 = legendRow2({ jump: [K('jump'), null], especial: [K('especial'), null], run: [K('run'), null], swap: [K('swap'), null] });
    return [l1, l2];
  }

  function updateTitleLegend(): void {
    const el = ctx.$<HTMLElement>('#title-legend');
    if (!el) return; // 2 LINHAS, com o que está CONFIGURADO p/ o jogador da tela
    let l1: string, l2: string;
    if (ctx.isTouchMode()) {                       // joystick VIRTUAL: 0/1/2/3 + START
      l1 = legendRow1('✜', 'START');
      l2 = legendRow2(touchActionGlyphs());
    } else {
      const p0 = players[0] as { pad?: number } | undefined;
      const p1pad = p0 && typeof p0.pad === 'number' && p0.pad >= 0 ? p0.pad : -1;
      const gp = pickLegendPad(ctx.getGamepads(), p1pad);
      if (gp) {                                    // joystick FÍSICO: design do modelo + mapa custom do wizard
        const layout = gp.mapping === 'standard' ? ctx.padLayoutFromId(gp.id) : 'generic';
        const custom = gp.mapping !== 'standard' ? ctx.padMapFor(gp.id) : null;
        l1 = legendRow1('✜', 'START');
        l2 = legendRow2(padActionGlyphs(layout, custom));
      } else {
        [l1, l2] = keyboardLegend();               // TECLADO: teclas configuradas (remap respeitado)
      }
    }
    el.innerHTML = legendHtml(l1, l2);
    const w = ctx.$<HTMLElement>('#title-wait');
    if (w) w.hidden = numPlayers <= 1;             // MP: aviso "Aguarde o Jogador 1"
  }

  /* ===================== seleção e Print ===================== */

  function pauseSelect(): void {
    ctx.getPauseScreens().forEach((sp) => {
      const items = [...sp.querySelectorAll<HTMLElement>('.pm-btn')];
      items.forEach((b) => b.classList.remove('pm-sel'));
      if (items[0]) items[0].classList.add('pm-sel'); // 1º item (Continuar) selecionado em cada tela
    });
  }

  function printMode(): void {
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = true; }); // vê a tela limpa; qualquer botão volta
    const back = (e?: Event): void => {
      if (e && e.preventDefault) { try { e.preventDefault(); } catch { /* noop */ } }
      ctx.win.removeEventListener('keydown', back, true);
      ctx.win.removeEventListener('pointerdown', back, true);
      if (phase === 'paused') { ctx.getPauseScreens().forEach((sp) => { sp.hidden = false; }); pauseSelect(); }
    };
    // 80ms de atraso: o próprio evento que ACIONOU o Print não pode ser o que o desfaz.
    ctx.win.setTimeout(() => {
      ctx.win.addEventListener('keydown', back, true);
      ctx.win.addEventListener('pointerdown', back, true);
    }, 80);
    ctx.srSay(t('sr.print.on'));
  }

  /* ===================== a troca de fase ===================== */

  /** A metade IMPURA: pega a projeção pronta e a carimba no documento. */
  function applyPhaseView(v: PhaseView): void {
    const t = ctx.$<HTMLElement>('#title-overlay'), pa = ctx.$<HTMLElement>('#pause-overlay');
    if (t) t.hidden = v.titleOverlayHidden;
    if (pa) pa.hidden = v.pauseOverlayHidden; // pausa GLOBAL aposentada (Etapa 2): agora é uma por tela
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = v.screenPauseHidden; });
  }

  /** O estado do `#touch-controls` ANTES de qualquer coisa desta troca de fase mexer nele. */
  function readTouchControls(): TouchControlsState | null {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    return tc ? { hidden: tc.hidden, wasOn: tc.dataset.wasOn === '1' } : null;
  }

  /** A metade IMPURA do plano de toque: recebe o estado lido ANTES do hide e grava o plano de volta. */
  function applyTouchControls(p: Phase, before: TouchControlsState | null): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc || !before) return;
    const after = touchControlsPlan(p, before, numPlayers);
    // Só escreve o que MUDOU — é o que torna o applier equivalente linha a linha ao original (que, no ramo
    // 'paused' já-escondido, não toca em nada; e cujos `delete` nos outros ramos são no-op quando não havia flag).
    if (after.hidden !== before.hidden) tc.hidden = after.hidden;
    if (after.wasOn !== before.wasOn) { if (after.wasOn) tc.dataset.wasOn = '1'; else delete tc.dataset.wasOn; }
  }

  function applyFocus(f: PhaseFocus): void {
    if (f === 'game-region') { const gr = ctx.$<HTMLElement>('#game-region'); if (gr) gr.focus(); return; }
    if (f === 'pause-menu') { pauseSelect(); ctx.reflectPauseIcons(); return; }
    updateTitleLegend();
    const b = ctx.$<HTMLElement>('#tm-main button');
    if (b) b.focus();
  }

  function setPhase(p: Phase): void {
    setPhaseValue(p);        // core/state.js: só o valor + evento; a reação de UI é toda daqui para baixo
    const v = phaseView(p);
    // LER ANTES DE ESCONDER. Era aqui o defeito: `hideTouchControls()` roda logo abaixo e já põe `tc.hidden`
    // em true, então o plano — que rodava depois — via o pad como se ele já estivesse desligado, nunca gravava
    // o `wasOn`, e o ramo que o traz de volta ao retomar era inalcançável. No celular: pausar sumia com o
    // direcional e retomar não o devolvia.
    const antesDoHide = readTouchControls();
    if (v.hideTouchControls) ctx.hideTouchControls(); // menu ativo (título/pausa) = sem controle virtual
    // GAG: na pausa, silencia TODO o som do jogo (loops de ambiente/chuva inclusive) — volta ao retomar.
    ctx.setMasterMuted(v.masterMuted);
    applyPhaseView(v);
    applyTouchControls(p, antesDoHide); // o estado é o de ANTES do hide — ver o comentário acima
    const pb = ctx.$<HTMLElement>('#btn-pause'); // ORDEM verbatim: o aria-pressed vem DEPOIS do bloco de toque
    if (pb) pb.setAttribute('aria-pressed', String(v.pausePressed));
    applyFocus(v.focus);
  }

  function togglePause(): void {
    if (phase === 'playing') setPhase('paused');
    else if (phase === 'paused') setPhase('playing');
  }

  /* ===================== a tabela do menu de pausa ===================== */

  // Ações do menu de pausa (compartilhadas pelos menus por tela). Ao abrir um submenu de a11y, escopa ao
  // jogador que agiu (pauseActor) — o diálogo abre na aba dele.
  const pauseActs: PauseActs = {
    resume: () => setPhase('playing'),
    // O botão ABC era um CICLO de duas posições; virou a porta do menu de CAA (ADR-0028), onde a caixa da
    // letra é uma escolha entre outras. Ele não sumiu — quem usava o atalho continua a um clique da escolha,
    // em vez de ter de descobrir onde ela foi parar. A ação `letra` sumiu junto com o ciclo: um nome por coisa.
    caa: () => ctx.openCaa(),
    nivel: () => ctx.setQuizLevel(ctx.getQuizLevel() % 5 + 1, true), // L3: cicla 1..5
    tipo: () => ctx.openTypo(),
    // R-splash 2: só AUMENTA (nunca diminui); a tela nova ESPERA um botão do jogador entrar
    addplayer: () => {
      if (numPlayers >= 4) { ctx.srAlert(t('sr.screens.maxPlayers')); return; }
      if (!ctx.fitsN(numPlayers + 1)) { ctx.srAlert(t('sr.screens.wontFitOneMore')); return; }
      if (!ctx.joinPlayer(null)) return;
      const p = players[numPlayers - 1] as ShellPlayer;
      p.waiting = true;
      ctx.showWaitingBadge(p.i);
      setPhase('playing');
      ctx.srAlert(t('sr.player.pressToJoin', { n: p.i + 1 }));
    },
    audio: () => ctx.openAudio(),
    motora: () => { ctx.setMotorPlayer(ctx.getPauseActor()); ctx.openMovement(); },
    anim: () => { ctx.setMotionPlayer(ctx.getPauseActor()); ctx.openMotion(); },
    visual: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openVisual(); },
    empatia: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openEmpathy(); },
    print: () => printMode(),
    quit: () => ctx.quitGame(),
    ajuda: () => ctx.openHelp(),
  };

  return { setPhase, togglePause, pauseSelect, printMode, updateTitleLegend, pauseActs };
}
