// SPDX-License-Identifier: GPL-3.0-or-later
// input/keydown.ts — O ROTEADOR DE TECLADO: o que UMA tecla SIGNIFICA, aqui e agora.
//
// Este é o ouvinte de `keydown` de BOLHA do game.js — o único ponto do jogo por onde passa toda tecla que não
// foi interceptada antes. Ele não é "o controle do personagem": andar/pular são consequência da ÚLTIMA das
// nove perguntas que ele faz. As oito primeiras decidem se a tecla é do jogo ou de outra coisa — demo,
// remapeamento, diálogo, tela de vitória, menu inicial, número de telas, pausa, quiz — e é essa SEQUÊNCIA que
// é a especificação: quem vem antes vence, e mudar a ordem de duas guardas muda o jogo sem quebrar nada que
// um build, um `tsc` ou um olho consigam ver.
//
// ======================= A ENTREGA: DECIDIR ≠ EXECUTAR =======================
// O bloco original é uma CADEIA DE DECISÃO PURA DISFARÇADA DE EFEITO. Dado (código da tecla, fase, quem tem
// quiz aberto, qual diálogo está visível, número de telas, esquemas de tecla), existe UMA resposta sobre o que
// a tecla significa — e o `preventDefault`, o `click()`, o `togglePause()` vêm só DEPOIS dessa resposta. No
// monólito as duas metades estavam trançadas: cada `if` misturava a pergunta ("tem diálogo aberto?") com a
// resposta ("então esconde e sai"), e por isso a ordem de precedência — a parte que realmente importa — só
// podia ser verificada jogando.
//
// Aqui elas são dois objetos separados:
//   · `decideKeydown(evento, estado) -> KeydownDecision`  — PURA. Sem DOM, sem PIXI, sem áudio, sem `window`.
//     Roda no project `node`. Cada ramo da ordem de precedência é um caso de teste, e a precedência ENTRE os
//     ramos (quiz aberto E diálogo visível: quem ganha?) é uma asserção, não um relato.
//   · `initKeydown(ctx).onKeydown(e)` — a metade IMPURA: pega a decisão pronta e a carimba no mundo.
// Mesmo movimento que `ui/shell.ts` fez com `phaseView`/`applyPhaseView` e `ui/title.ts` com
// `computeTitleMenuView`; é o precedente da casa, e aqui ele vale mais do que lá, porque o que está em jogo é
// o teclado — a única modalidade que TODA pessoa que joga sem mouse, sem visão ou sem controle depende.
//
// ======================= O QUE FICOU DE FORA DA PARTE PURA, E POR QUÊ =======================
// Duas guardas do topo NÃO cabem em `decideKeydown`, e forçá-las lá seria mentira:
//   · `attractCtl.onInput()` (game/attract.ts) — ela DECIDE E AGE na mesma chamada: zera o contador de
//     ociosidade, encerra a demo se estiver rodando, e devolve se encerrou. Não há como perguntar sem mexer.
//   · `ctrlPanel.handleCaptureKeydown(e)` (ui/settings-controls.ts) — idem: se há remapeamento em curso, ela
//     GRAVA a tecla no esquema e devolve `true`.
// As duas continuam sendo as duas primeiras linhas de `onKeydown`, na mesma ordem, e o teste que prova que
// elas vêm antes de tudo é do wrapper (com sondas de mentira), não da função pura.
// A leitura de VISIBILIDADE dos diálogos também não entra pura: ela é `querySelector` + `.hidden`. O que entra
// na parte pura é o RESULTADO dela (três booleanos e um id), montado por `snapshot()`.
//
// ======================= ⚠️ PAUSADO, ESTE OUVINTE NÃO É ALCANÇADO PARA Escape =======================
// `ui/menu-nav.ts` registra o PRÓPRIO `keydown` em fase de CAPTURA e dá `stopPropagation()`. Com o jogo
// PAUSADO (`phase==='paused'`), toda tecla com intenção de menu — Escape inclusive — morre lá em cima e nunca
// desce até aqui. Consequência MEDIDA no navegador, e anotada tanto no game.js quanto no cabeçalho de
// menu-nav (DEFEITO 2): a cadeia `overlays.escapeTarget()` e o `togglePause()` de Escape são, na prática,
// código morto enquanto pausado; quem fecha é sempre o topo da pilha de z-index.
// ISTO É COMPORTAMENTO ATUAL E FOI PRESERVADO — não é bug para consertar aqui, é rede de segurança de que o
// conserto futuro vai precisar (tirar o `stopPropagation()` sem mais nada faz o `if(Escape||Enter)
// togglePause()` daqui DESPAUSAR o jogo com a Ajuda aberta). Os testes o ancoram como está: `decideKeydown`
// devolve a decisão que ELE tomaria, e o teste do wrapper documenta que, pausado, ela não é consultada porque
// o evento não chega. Ver `tests/keydown.node.test.js`, bloco "a captura do menu-nav chega antes".
//
// ======================= O QUE VEIO JUNTO, E O QUE NÃO VEIO =======================
//  · `keyup` VEIO. Ele é a outra metade exata do `keys.add(e.code)` da última linha do keydown: sem os dois no
//    mesmo lugar, quem lê "quando uma tecla entra em `keys`" tem de procurar a saída em outro arquivo. `attach()`
//    instala os dois, na mesma ordem de antes.
//  · `blur` NÃO veio. Parece irmão, mas não é: `keys` também recebe códigos INJETADOS pelos botões de toque
//    (o `press`/`release` do game.js, que faz `keys.add(codeFor(act))`) e pelo controle por webcam
//    (`ui/webcam.ts` despacha `KeyboardEvent` sintético). `blur -> keys.clear()` é uma rede de ciclo de vida da
//    JANELA sobre um conjunto que não é só do teclado; trazê-la para cá daria a este módulo a
//    responsabilidade de limpar estado que ele não escreve. Fica no game.js, uma linha, ao lado do `resize`.
//  · A cadeia de Escape, o registro de overlays e o `closeById` são de `ui/settings-panel.ts`. Este módulo
//    CONSOME (`escapeTarget`, `closeOverlayById`) e não reimplementa — mesma disciplina de menu-nav.
//  · `whichPlayer`/`actionOf`/`controlsState` são de `input/keyboard-runtime.ts`, que é quem sabe de esquema de
//    teclas. Aqui eles entram injetados e são só consultados. `controlsState()` é MEMORIZADO lá: este módulo o
//    chama uma vez por tecla, como o original.
//  · A navegação do menu inicial (`navTitle`) é de `ui/activities-menu.ts`; a do menu de pausa é de
//    `ui/menu-nav.ts`. Este módulo decide QUE a tecla é de navegação e para QUEM ela vai — nunca desenha menu.
//
// ======================= INJEÇÃO E ORDEM DE BOOT =======================
// `initKeydown` tem de ser chamado NO LUGAR EXATO onde o `addEventListener('keydown', …)` estava (logo depois
// de `assignControls()`), por dois motivos independentes:
//   1. ORDEM DE REGISTRO. Os ouvintes de bolha do mesmo alvo disparam na ordem em que foram registrados. Este é
//      hoje o primeiro `keydown` de bolha da janela, e o único de captura (menu-nav) já vence por fase.
//      Registrar mais tarde não muda nada HOJE, mas passa a depender de nenhum outro ouvinte de janela nascer
//      no meio — dependência invisível que não vale a pena criar.
//   2. TDZ. Quase tudo o que este módulo aciona (`attractCtl`, `ctrlPanel`, `gamepadApi`, `hud`, `navTitle`,
//      `activateScreens`, `togglePause`, `hideTouchControls`, as quatro funções de quiz) é `const`/`function`
//      declarado CENTENAS de linhas ABAIXO desse ponto. O ouvinte original só funcionava porque o corpo dele é
//      preguiçoso: nada é lido até a primeira tecla. Por isso TODO o ctx é `() => …`: valor nenhum é resolvido
//      na montagem. Passar `attractCtl` (ou `hud`, ou `navTitle`) por VALOR derruba o boot em TDZ.
// A regra da casa vale igual: o que o game.js REATRIBUI entra por GETTER (`oneButton`, `numPlayers`, `players`,
// o estado de controles). `keys` é `const` de `input/state.ts`, mutado in place — entra por VALOR (é o mesmo
// objeto para sempre). `phase` é binding vivo de `core/state.ts`, importado direto, como em menu-nav.
//
// ÚNICA DIFERENÇA DE COMPORTAMENTO EM RELAÇÃO AO MONÓLITO, declarada: `snapshot()` lê os três `hidden` e o
// `escapeTarget()` de uma vez, enquanto o original os lia em curto-circuito (só chegava ao `#padwiz` se não
// houvesse overlay nem `#touchcfg`). São no máximo quatro `querySelector` a mais por tecla, todos de leitura
// pura (`escapeTarget` só varre o registro e testa `.hidden` — conferido em ui/settings-panel.ts). Nada
// observável muda; anotado porque medir depois é mais caro do que escrever agora.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara tabelas congeladas e funções puras. Todo efeito passa por
// `initKeydown` (e mesmo ele não faz nada até `attach()`).
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D2-a).

import { EDGE_BY_ACTION, edgeAllowed, type EdgeFlag } from './edges.js';
import { phase } from '../core/state.js'; // binding vivo (fonte única de estado)

/* ===================== interfaces mínimas ===================== */

/** ui/dom.ts `$` — injetado; o módulo nunca alcança `document`. */
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** O que este módulo lê e faz com um `KeyboardEvent` de `keydown`. */
export interface KeydownEventLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  preventDefault(): void;
}

/** `keyup` só precisa do código. */
export interface KeyupEventLike { code: string }

/** ação -> lista de códigos físicos. Cópia ESTRUTURAL do `KeyScheme` de input/keyboard-runtime.ts: a casa
 *  prefere a cópia a puxar um alias de tipo através de camadas (ver o cabeçalho de keyboard-runtime). */
export type KeyScheme = Record<string, string[]>;

/** As seis bordas de entrada que o keydown levanta no jogador (consumidas e zeradas pela física). */
// `EdgeFlag` vem de input/edges.ts (reexportado mais abaixo) — era declarado aqui e em touch-bindings.

/** O que este módulo lê (e escreve) de um jogador do game.js — e SÓ isso. */
export interface KeydownPlayer {
  /** índice PRÓPRIO do jogador (`makePlayer(i)`). O original roteia por ele, não pela posição no array. */
  i: number;
  ctrl?: KeyScheme | null;
  /** o desafio educativo aberto deste jogador; `kind==='braille'` tem caminho próprio. */
  quiz?: { kind?: string } | null;
  /** tela em espera (multi-tela): a 1ª tecla DAQUELE jogador entra na partida. */
  waiting?: boolean;
  /** modo Fácil (deficiência motora): sem correr, e ganha os atalhos Ctrl/Shift no solo. */
  easy?: boolean;
  jumpEdge?: boolean; runEdge?: boolean; leftEdge?: boolean; rightEdge?: boolean;
  swapEdge?: boolean; specialEdge?: boolean;
}

/** Subconjunto do `ControlsState` de input/keyboard-runtime.ts que a decisão consulta (`controls` não entra:
 *  o original nunca o usa aqui, só os seis aliases e a lista achatada). */
export interface ControlsSnapshot {
  jump: string[]; left: string[]; right: string[]; up: string[]; down: string[]; run: string[];
  gameKeys: string[];
}

/** A intenção de navegação do menu inicial. MESMA forma que `NavKeys` de ui/activities-menu.ts e de
 *  ui/menu-nav.ts — de novo cópia estrutural, de propósito. */
export interface TitleNav { yes: boolean; no: boolean; up: boolean; down: boolean; left: boolean; right: boolean }

/** TUDO o que a decisão precisa saber do mundo, num objeto só, montado ANTES de qualquer efeito. */
export interface KeydownSnapshot {
  phase: string;
  numPlayers: number;
  players: readonly KeydownPlayer[];
  controls: ControlsSnapshot;
  /** `keys` de input/state.ts: as teclas seguradas AGORA (inclui códigos injetados por toque/webcam). */
  heldKeys: ReadonlySet<string>;
  /** empatia motora: um botão de jogo por vez. */
  oneButton: boolean;
  /** `overlays.escapeTarget()` — id do 1º diálogo REGISTRADO que está aberto, ou null. */
  escapeTargetId: string | null;
  touchCfgVisible: boolean;
  padWizVisible: boolean;
  winVisible: boolean;
  actionOf(code: string, playerIndex: number): string | null;
  whichPlayer(code: string): number;
}

/* ===================== a decisão ===================== */

/** O que o quiz do dono da tecla deve fazer. `null` = a tecla é dele mas não significa nada no quiz. */
export type QuizAct =
  | { type: 'move'; delta: number }
  | { type: 'confirm' }
  | { type: 'erase' }
  | { type: 'braille-announce' };

/** Uma borda a levantar: qual jogador (POSIÇÃO no array) e qual flag. */
export interface EdgeRaise { playerIndex: number; edge: EdgeFlag }

/**
 * A resposta única: o que esta tecla SIGNIFICA. `kind` é o ramo da ordem de precedência que venceu — e é essa
 * palavra, e não o efeito, que os testes de precedência afirmam.
 */
export type KeydownDecision =
  /** 1º · diálogo REGISTRADO aberto: Escape fecha (`closeId`), qualquer outra tecla é engolida. */
  | { kind: 'overlay'; closeId: string | null; preventDefault: boolean }
  /** 2º · `#touchcfg` visível: Escape esconde, o resto é engolido. */
  | { kind: 'touchcfg'; close: boolean; preventDefault: boolean }
  /** 3º · `#padwiz` (assistente de gamepad) visível: Escape CANCELA (`save:false`), o resto é engolido. */
  | { kind: 'padwiz'; close: boolean; preventDefault: boolean }
  /** 4º · tela de vitória: pulo (de qualquer jogador) ou Escape/Enter apertam "Jogar de novo". */
  | { kind: 'win'; again: boolean; preventDefault: boolean }
  /** 5º · tela de título: `wait` = multi-tela e a tecla é de outro jogador (só o J1 comanda). */
  | { kind: 'title'; wait: boolean; nav: TitleNav | null; preventDefault: boolean }
  /** 6º · Alt+1..4 = número de telas. */
  | { kind: 'screens'; count: number; preventDefault: boolean }
  /** 7º · Escape/Enter = pausa. */
  | { kind: 'pause'; preventDefault: boolean }
  /** 8º · quiz aberto: a tecla age no quiz do DONO dela (`playerIndex` = posição no array). */
  | { kind: 'quiz'; playerIndex: number; act: QuizAct | null; preventDefault: boolean }
  /** 9º · jogo normal. */
  | { kind: 'play'; gameKey: boolean; wake: number[]; edges: EdgeRaise[]; releaseKeys: string[]; preventDefault: boolean };

/* --- tabelas (congeladas: são dados, e um `Set` nomeado deixa a tabela auditável de fora) --- */

/** Fácil (SOLO): Ctrl = Especial, Shift = Trocar poder. Fora de Win/Alt/AltGr, de propósito. */
export const EASY_SHORTCUTS: ReadonlySet<string> = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);
/** Alt + fileira de números (NÃO o teclado numérico) = 1..4 telas. Alt fica livre: o solo não o usa. */
export const SCREEN_DIGITS = /^Digit[1234]$/;
/** Pausa: Escape ou o Enter CENTRAL. `NumpadEnter` NÃO pausa (E14, verbatim). */
export const PAUSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'Enter']);
// A tabela e a regra do Fácil vivem em input/edges.ts, compartilhadas com gamepad e touch-bindings. Reexporta
// pelo nome antigo porque quem importa daqui (teste e leitor) espera achá-la aqui.
export { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
export type { EdgeFlag } from './edges.js';

/* --- predicados puros (exportados: o teste importa a peça, não repete a expressão) --- */

/** A tecla vale como PULO para alguém? O alias do J1 OU a ação `jump` de qualquer jogador (é o que faz
 *  "qualquer um pode apertar Jogar de novo" e "qualquer um confirma no título" serem verdade). */
export function isJumpKey(code: string, s: KeydownSnapshot): boolean {
  return s.controls.jump.includes(code) || s.players.some((_p, i) => s.actionOf(code, i) === 'jump');
}

/** A tecla é de JOGO? Verbatim do `isGameKeyCode` do game.js — o alias achatado OU o esquema de algum
 *  jogador. NÃO inclui os atalhos do Fácil (o original também não: por isso `easyKey` é somado à parte). */
export function isGameKeyCode(code: string, s: KeydownSnapshot): boolean {
  return s.controls.gameKeys.includes(code)
    || s.players.some((p) => !!p.ctrl && Object.values(p.ctrl).some((arr) => arr.includes(code)));
}

/** Os atalhos de acessibilidade do Fácil só existem SOLO (`numPlayers<=1`) e só para o Jogador 1. */
export function isEasyShortcut(code: string, s: KeydownSnapshot): boolean {
  return !!s.players[0]?.easy && s.numPlayers <= 1 && EASY_SHORTCUTS.has(code);
}

/**
 * A intenção no menu inicial. Repare na ASSIMETRIA, preservada verbatim: `up`/`down` aceitam ArrowUp/ArrowDown
 * ALÉM do alias configurado, `left`/`right` não aceitam ArrowLeft/ArrowRight. No esquema de fábrica isso não
 * aparece (o solo já tem as setas nos quatro lados); aparece para quem REMAPEIA — remapeou esquerda para KeyA
 * e a seta deixa de andar no menu, enquanto cima continua funcionando pelas duas. Está anotado como caso de
 * teste em tests/keydown.node.test.js, e é candidato a conserto, não a "limpeza" silenciosa.
 */
export function titleNavOf(code: string, s: KeydownSnapshot, jump: boolean): TitleNav {
  return {
    yes: jump || code === 'Enter',
    no: code === 'Escape' || s.players.some((_p, i) => s.actionOf(code, i) === 'especial'),
    up: s.controls.up.includes(code) || code === 'ArrowUp',
    down: s.controls.down.includes(code) || code === 'ArrowDown',
    left: s.controls.left.includes(code),
    right: s.controls.right.includes(code),
  };
}

/** Alguma intenção foi expressa? Sem intenção, a tecla NÃO é consumida (nem `preventDefault`, nem `navTitle`). */
export function hasTitleIntent(k: TitleNav): boolean {
  return k.yes || k.no || k.up || k.down || k.left || k.right;
}

/**
 * Quem é o dono do quiz que esta tecla comanda? Devolve a POSIÇÃO no array, ou -1.
 * Regra verbatim: tecla de um jogador vai para o quiz DAQUELE jogador (e só se ele tiver quiz aberto); tecla
 * genérica cai no Jogador 1. Tecla de um jogador SEM quiz aberto não cai no P1 — ela desce para o jogo normal,
 * que é o que deixa a partida dele continuar enquanto o outro resolve o desafio.
 */
export function quizOwnerIndex(code: string, s: KeydownSnapshot): number {
  const owner = s.whichPlayer(code);
  if (owner >= 0) return s.players[owner]?.quiz ? owner : -1;
  return s.players[0]?.quiz ? 0 : -1;
}

/**
 * O que a tecla faz DENTRO do quiz do dono. `owner` é a posição no array; `generic` diz se a tecla chegou sem
 * dono (aí as seis leituras usam os aliases do J1 em vez da ação remapeada).
 * A grade do quiz é de 3 colunas: cima/baixo andam ±3, esquerda/direita ±1.
 */
export function quizActOf(code: string, s: KeydownSnapshot, owner: number, generic: boolean): QuizAct | null {
  const pl = s.players[owner];
  if (!pl) return null;
  const act = generic ? null : s.actionOf(code, pl.i); // `qpl.i`, não a posição — verbatim
  const K = s.controls;
  const L = act ? act === 'left' : K.left.includes(code);
  const R = act ? act === 'right' : K.right.includes(code);
  const U = act ? act === 'up' : K.up.includes(code);
  const D = act ? act === 'down' : K.down.includes(code);
  const J = act ? act === 'jump' : K.jump.includes(code);
  // ESPECIAL = apagar a última sílaba/letra. A leitura genérica sai de `pl.ctrl`, NÃO de `K` — assimetria do
  // original preservada (não existe alias `KESPECIAL` em ControlsState; o original alcançava `qpl.ctrl`).
  const E = act ? act === 'especial' : ((pl.ctrl?.especial || []).includes(code));

  if (pl.quiz?.kind === 'braille') { // cego: cima DITA a cela, pulo confirma. Nada mais anda.
    if (U) return { type: 'braille-announce' };
    if (J) return { type: 'confirm' };
    return null;
  }
  if (L) return { type: 'move', delta: -1 };
  if (R) return { type: 'move', delta: 1 };
  if (U) return { type: 'move', delta: -3 };
  if (D) return { type: 'move', delta: 3 };
  if (J) return { type: 'confirm' };
  if (E) return { type: 'erase' };
  return null;
}

/**
 * As bordas que esta tecla levanta. Só é chamada quando a tecla AINDA NÃO está segurada — é isso que a torna
 * uma BORDA e não um estado, e é o que impede o auto-repeat do sistema de virar dez pulos.
 * `p.ctrl[act] || []`: o original alcançava `p.ctrl.jump` direto e estouraria num esquema sem a ação. Trocar
 * um TypeError por um no-op não remove rede de conserto nenhuma (o precedente é a guarda de `navPause` em
 * ui/menu-nav.ts) — é a única linha desta função que não é cópia literal.
 */
export function edgesFor(code: string, s: KeydownSnapshot): EdgeRaise[] {
  const out: EdgeRaise[] = [];
  s.players.forEach((p, idx) => {
    if (!p.ctrl) return;
    for (const [act, edge] of EDGE_BY_ACTION) {
      if (!edgeAllowed(act, p.easy)) continue; // Fácil: sem correr (input/edges.ts, valendo nos três caminhos)
      if ((p.ctrl?.[act] || []).includes(code)) out.push({ playerIndex: idx, edge });
    }
  });
  // Fácil (solo): Ctrl vira Especial e Shift vira Trocar poder, SEMPRE no Jogador 1 (`player` do original).
  if (isEasyShortcut(code, s)) out.push({ playerIndex: 0, edge: code.startsWith('Control') ? 'specialEdge' : 'swapEdge' });
  return out;
}

/**
 * A CADEIA. Nove perguntas, nesta ordem — e a ordem É a especificação.
 * O que NÃO está aqui, e vem antes no wrapper: a demo (attract) e a captura de remapeamento. Ver o cabeçalho.
 */
export function decideKeydown(ev: { code: string; altKey?: boolean; ctrlKey?: boolean }, s: KeydownSnapshot): KeydownDecision {
  const code = ev.code;

  // 1..3 · diálogo aberto BLOQUEIA o jogo — mas só se o elemento estiver DE FATO visível (uma flag presa não
  // trava mais o teclado). Os três saem sem `preventDefault`, verbatim: o diálogo é DOM e quer o comportamento
  // nativo do navegador (Tab, digitação num range) por baixo.
  if (s.escapeTargetId) return { kind: 'overlay', closeId: code === 'Escape' ? s.escapeTargetId : null, preventDefault: false };
  if (s.touchCfgVisible) return { kind: 'touchcfg', close: code === 'Escape', preventDefault: false };
  if (s.padWizVisible) return { kind: 'padwiz', close: code === 'Escape', preventDefault: false };

  // 4..5 · fim de fase / título. O pulo de QUALQUER jogador aciona o botão principal, sem depender do foco do
  // mouse (clicar na tela tirava o foco do botão e o teclado parava de funcionar — report do José).
  const jump = isJumpKey(code, s);
  const pauseKey = PAUSE_KEYS.has(code);
  if (s.winVisible) { const again = jump || pauseKey; return { kind: 'win', again, preventDefault: again }; }
  if (s.phase === 'title') {
    // multi-tela: só o Jogador 1 escolhe o jogo. A tecla de um dos outros é consumida com um aviso falado.
    if (s.numPlayers > 1 && s.whichPlayer(code) > 0) return { kind: 'title', wait: true, nav: null, preventDefault: true };
    const nav = titleNavOf(code, s, jump);
    const has = hasTitleIntent(nav);
    return { kind: 'title', wait: false, nav: has ? nav : null, preventDefault: has };
  }

  // 6..7 · número de telas e pausa. As DUAS exigem quiz FECHADO: com um desafio aberto na tela, Alt+3 não pode
  // reconfigurar o jogo por baixo dele, e Enter é a confirmação do quiz, não a pausa.
  const anyQuiz = s.players.some((p) => !!p.quiz);
  const inGame = s.phase === 'playing' || s.phase === 'paused';
  if (ev.altKey && !ev.ctrlKey && SCREEN_DIGITS.test(code) && inGame && !anyQuiz) {
    return { kind: 'screens', count: +code.slice(5), preventDefault: true };
  }
  if (!anyQuiz && pauseKey && inGame) return { kind: 'pause', preventDefault: true };

  // 8 · quiz. A tecla age no quiz do DONO dela; genérica cai no P1. `preventDefault` é o mesmo dos dois
  // caminhos (braille e normal) e NÃO depende de a tecla ter significado: basta ser tecla de jogo.
  if (anyQuiz) {
    const owner = quizOwnerIndex(code, s);
    if (owner >= 0) {
      return { kind: 'quiz', playerIndex: owner, act: quizActOf(code, s, owner, s.whichPlayer(code) < 0),
        preventDefault: s.controls.gameKeys.includes(code) };
    }
    // tecla de um jogador SEM quiz cai no jogo normal (a partida dele continua) — segue adiante
  }

  // 9 · jogo normal.
  const gameKey = isEasyShortcut(code, s) || isGameKeyCode(code, s);
  const wake = s.players.reduce<number[]>((acc, p, idx) => { if (p.waiting && s.actionOf(code, p.i)) acc.push(idx); return acc; }, []);
  const edges = s.heldKeys.has(code) ? [] : edgesFor(code, s);
  // Empatia motora (um botão por vez): a tecla nova entra e as OUTRAS de jogo saem. `keys.add` vem depois da
  // limpeza no wrapper, então a recém-chegada sobrevive mesmo se já estivesse na lista.
  const releaseKeys = s.oneButton && gameKey ? [...s.heldKeys].filter((k) => isGameKeyCode(k, s)) : [];
  return { kind: 'play', gameKey, wake, edges, releaseKeys, preventDefault: gameKey };
}

/* ===================== ctx / api ===================== */

export interface KeydownCtx {
  /* --- as duas sondas que DECIDEM E AGEM: rodam antes da decisão pura, nesta ordem --- */
  /** game/attract.ts: zera a ociosidade e encerra a demo; `true` = a tecla foi só para acordar. */
  attractOnInput: () => boolean;
  /** ui/settings-controls.ts: remapeamento em curso — a próxima tecla VIRA o controle. */
  handleCaptureKeydown: (e: KeydownEventLike) => boolean;

  /* --- estado (tudo getter: o game.js reatribui; `phase` vem por import) --- */
  getNumPlayers: () => number;
  getPlayers: () => readonly KeydownPlayer[];
  /** `kbRuntime.controlsState()` — memorizado do lado de lá; uma chamada por tecla, como no original. */
  getControls: () => ControlsSnapshot;
  /** `keys` de input/state.ts: `const` mutado in place → entra por VALOR (é sempre o mesmo objeto). */
  heldKeys: Set<string>;
  /** `let oneButton` do game.js (empatia motora) → getter. */
  isOneButton: () => boolean;
  actionOf: (code: string, playerIndex: number) => string | null;
  whichPlayer: (code: string) => number;

  /* --- DOM (leitura de visibilidade + dois toques pontuais) --- */
  $: DomQuery;
  /** `overlays.escapeTarget()` de ui/settings-panel.ts. */
  escapeTarget: () => string | null;
  /** `overlays.closeById(id)` — o retorno é ignorado, verbatim. */
  closeOverlayById: (id: string) => void;
  /** input/gamepad.ts. LAZY: `gamepadApi` é `const` declarado ~800 linhas abaixo do ponto de init. */
  closePadWiz: (save: boolean) => void;

  /* --- efeitos --- */
  /** input/touch.ts via o envelope içado do game.js. Sem motivo no título; `'teclado'` no jogo (E13). */
  hideTouchControls: (reason?: string) => void;
  srSay: (msg: string) => void;
  navTitle: (k: TitleNav) => void;
  activateScreens: (n: number) => void;
  togglePause: () => void;
  quizMove: (pl: KeydownPlayer, delta: number) => void;
  quizConfirm: (pl: KeydownPlayer) => void;
  quizErase: (pl: KeydownPlayer) => void;
  announceBraille: (pl: KeydownPlayer) => void;
  /** ui/hud.ts: some com o selo "tela em espera" quando o jogador daquela tela entra. */
  clearWaitingBadge: (playerIndex: number) => void;

  /** `window` — só para `attach()` instalar os dois ouvintes de BOLHA, exatamente como o game.js fazia. */
  win: { addEventListener(type: string, fn: (e: never) => void): void };
}

export interface KeydownApi {
  /** O snapshot que a decisão consome. Exposto para o teste poder montá-lo e comparar. */
  snapshot: () => KeydownSnapshot;
  /** O ouvinte de bolha inteiro (sondas + decisão + efeito). Exportado à parte para o teste disparar sem DOM. */
  onKeydown: (e: KeydownEventLike) => void;
  /** A outra metade do `keys.add`. */
  onKeyup: (e: KeyupEventLike) => void;
  /** Instala os dois na janela, em BOLHA, na mesma ordem de antes. */
  attach: () => void;
}

export function initKeydown(ctx: KeydownCtx): KeydownApi {
  /** Diálogo aberto = elemento que existe E não está `hidden`. Verbatim do `dlgVis` do monólito, que nasceu
   *  justamente para uma flag presa em `true` não travar o teclado do jogo inteiro. */
  const visible = (id: string): boolean => { const el = ctx.$<HTMLElement>('#' + id); return !!el && !el.hidden; };

  function snapshot(): KeydownSnapshot {
    return {
      phase, numPlayers: ctx.getNumPlayers(), players: ctx.getPlayers(), controls: ctx.getControls(),
      heldKeys: ctx.heldKeys, oneButton: ctx.isOneButton(),
      escapeTargetId: ctx.escapeTarget(),
      touchCfgVisible: visible('touchcfg'), padWizVisible: visible('padwiz'), winVisible: visible('win-overlay'),
      actionOf: ctx.actionOf, whichPlayer: ctx.whichPlayer,
    };
  }

  /** A metade IMPURA: pega a decisão pronta e a carimba no mundo. */
  function apply(d: KeydownDecision, code: string): void {
    switch (d.kind) {
      case 'overlay': if (d.closeId) ctx.closeOverlayById(d.closeId); return;
      case 'touchcfg': { if (!d.close) return; const t = ctx.$<HTMLElement>('#touchcfg'); if (t) t.hidden = true; return; }
      case 'padwiz': if (d.close) ctx.closePadWiz(false); return; // wizard de gamepad: Esc CANCELA (não salva)
      case 'win': { if (!d.again) return; const b = ctx.$<HTMLElement>('#btn-again'); if (b) (b as HTMLElement & { click(): void }).click(); return; }
      case 'title':
        ctx.hideTouchControls(); // teclado no splash oculta os controles virtuais — ANTES do aviso, verbatim
        if (d.wait) { ctx.srSay('Aguarde o Jogador 1 escolher o jogo.'); return; }
        if (d.nav) ctx.navTitle(d.nav);
        return;
      case 'screens': ctx.activateScreens(d.count); return;
      case 'pause': ctx.togglePause(); return;
      case 'quiz': {
        const pl = ctx.getPlayers()[d.playerIndex];
        if (!pl || !d.act) return;
        if (d.act.type === 'braille-announce') ctx.announceBraille(pl);
        else if (d.act.type === 'confirm') ctx.quizConfirm(pl);
        else if (d.act.type === 'erase') ctx.quizErase(pl);
        else ctx.quizMove(pl, d.act.delta);
        return;
      }
      case 'play': {
        const players = ctx.getPlayers();
        if (d.gameKey) ctx.hideTouchControls('teclado'); // E13: jogar no teclado oculta os botões de toque
        for (const idx of d.wake) { // a tecla DAQUELE jogador ativa a tela em espera
          const p = players[idx]; if (!p) continue;
          p.waiting = false; ctx.clearWaitingBadge(p.i); ctx.srSay('Jogador ' + (p.i + 1) + ' entrou!');
        }
        for (const { playerIndex, edge } of d.edges) { const p = players[playerIndex]; if (p) p[edge] = true; }
        for (const k of d.releaseKeys) ctx.heldKeys.delete(k);
        ctx.heldKeys.add(code);
        return;
      }
    }
  }

  function onKeydown(e: KeydownEventLike): void {
    if (ctx.attractOnInput()) { e.preventDefault(); return; } // qualquer tecla encerra a demo
    if (ctx.handleCaptureKeydown(e)) return;                  // remap: a próxima tecla vira o controle
    const d = decideKeydown(e, snapshot());
    if (d.preventDefault) e.preventDefault();
    apply(d, e.code);
  }

  function onKeyup(e: KeyupEventLike): void { ctx.heldKeys.delete(e.code); }

  function attach(): void {
    ctx.win.addEventListener('keydown', onKeydown as (e: never) => void);
    ctx.win.addEventListener('keyup', onKeyup as (e: never) => void);
  }

  return { snapshot, onKeydown, onKeyup, attach };
}
