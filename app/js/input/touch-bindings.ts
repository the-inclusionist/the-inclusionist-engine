// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch-bindings.ts — AS AMARRAS DO CONTROLE POR TOQUE: o gesto vira TECLA.
//
// Este módulo é a outra metade de `input/touch.ts`. Aquele é o DONO DO PAD — a geometria física (mm→px), o
// painel de configuração, o mapa remapeável (`getTouchMap`), mostrar/esconder os botões. Ele sabe onde o
// polegar encosta e de que tamanho o alvo tem de ser. Não sabe o que acontece depois do toque.
// É isto aqui. E o que acontece depois do toque é uma coisa só, e surpreendente: o botão da tela **finge ser
// o teclado**. `press('jump')` não chama a física, não empurra o personagem, não fala com o jogo — ele
// descobre qual TECLA está mapeada para "pular" no esquema do Jogador 1, injeta esse código no `keys` de
// `input/state.ts` (o mesmo conjunto que o `keydown` alimenta) e levanta a borda `jumpEdge` em todo jogador
// que tenha aquele código no próprio esquema. O resto do jogo nunca fica sabendo que houve um dedo na tela.
//
// ======================= POR QUE UM ARQUIVO NOVO, E NÃO DENTRO DE input/touch.ts =======================
// Porque são duas perguntas diferentes, e a segunda depende de coisas que a primeira não conhece.
// `input/touch.ts` fecha sobre `$`, `store`, `root`, `viewport` — desenho e persistência. Este módulo precisa
// do ESQUEMA DE TECLAS vivo (`kbRuntime.controlsState()`), do ARRAY DE JOGADORES, do `keys` compartilhado, do
// `togglePause`, do `attract` e do `hideTips`: seis dependências que não têm nada a ver com desenhar um pad e
// que arrastariam metade do jogo para dentro de um módulo que hoje é quase todo geometria pura.
// A fronteira caiu, portanto, entre "onde o dedo está" (lá) e "o que o dedo significa" (aqui).
// FUNDIR DEPOIS? Na minha leitura, NÃO — mas se um dia se fundir, que seja como DOIS `init` no mesmo arquivo
// (`initTouch` e `initTouchBindings`), nunca como um `ctx` só: o `ctx` unificado teria quinze campos e o
// módulo passaria a ser "tudo que tem a ver com toque", que é um tema, não uma responsabilidade. O acoplamento
// real entre os dois é estreitíssimo e já está explícito no `ctx` daqui: `getTouchMap`, `getStickTravelPx`,
// `getStickDeadPx` e `showTouchControls` — quatro getters, todos de leitura.
//
// ======================= A ENTREGA: DECIDIR ≠ EXECUTAR =======================
// O bloco original (`touchSetup` do main.js) trançava três coisas num `const` de uma linha cada: a tradução
// gesto→tecla, a geometria do direcional e o amarrado de ouvintes. As duas primeiras são PURAS e aqui estão
// separadas, no mesmo movimento que `input/keydown.ts` fez com `decideKeydown`:
//   · `decideTouch(acao, ligado, snapshot) -> TouchDecision` — dado (ação, esquema do J1, esquemas dos
//     jogadores, teclas já seguradas), existe UMA resposta. Sem DOM, sem ponteiro, sem `window`. Roda no
//     project `node`. É onde a divergência do modo Fácil (abaixo) deixa de ser observável só num tablet.
//   · `crossDirsAt` / `stickDirsAt` / `stickKnobOffset` — posição do ponteiro + retângulo do elemento →
//     conjunto de direções ligadas. Zona morta, quadrantes e a borda da zona morta viram casos de teste.
//   · `initTouchBindings(ctx).attach()` — a metade IMPURA: captura de ponteiro, `preventDefault`, `classList`,
//     `setTimeout`. É a única parte que precisa de navegador de verdade.
//
// ======================= ⚠️ A TABELA "AÇÃO → BORDA" EXISTE TRÊS VEZES, E UMA DELAS DISCORDA =======================
// A mesma correspondência entre as seis ações e as seis flags de borda está escrita em três lugares:
//   1. `input/keydown.ts` (`EDGE_BY_ACTION`, tabela congelada; consumida em `edgesFor`, que aplica a guarda
//      `if (act === 'run' && p.easy) continue; // Fácil: sem correr`);
//   2. `input/gamepad.ts` (seis `if` à mão dentro de `pollPads`; o do `run` TEM a guarda: `if (edge('run') &&
//      !p.easy) p.runEdge = true;`);
//   3. AQUI (`TOUCH_EDGE_BY_ACTION` + `touchEdgesFor`), que veio dos seis `if` à mão do main.js — e o do `run`
//      **NÃO TEM** a guarda do Fácil.
// Isso FOI CORRIGIDO: o `run` daqui passou a ter a mesma guarda dos outros dois caminhos.
//
// A consequência é de acessibilidade, e é ao contrário do que o nome sugere. `runEdge` não é a velocidade de
// corrida (isso é `held(pl,'run')`, lido em `game/physics.ts:169-170`): `runEdge` é a BORDA que gruda e solta
// da parede — a ventosa/homem-aranha de `updateCling`, em `game/physics.ts:177` e `:179`. Logo, hoje, no modo
// Fácil (deficiência motora), a criança NÃO consegue escalar parede pelo teclado nem pelo controle físico —
// mas CONSEGUE pelo botão da tela. Três caminhos de entrada, dois comportamentos.
// O teste continua comparando os TRÊS caminhos lado a lado, com o `edgesFor` real importado de `keydown.js` —
// agora exigindo que CONCORDEM. As três tabelas ainda são três; fundi-las numa só é o passo seguinte, e é o
// que impede a divergência de voltar.
//
// ======================= O QUE FICOU DE FORA, E POR QUÊ =======================
//  · `hideTouchControls`/`showTouchControls` são de `input/touch.ts`. Aqui só se CHAMA `showTouchControls`
//    (o toque revela os botões); esconder é do `keydown`, que sabe que o teclado assumiu.
//  · `attractCtl.onInput()` não vira parte pura, pelo mesmo motivo do cabeçalho de `keydown.ts`: ela DECIDE E
//    AGE na mesma chamada (zera a ociosidade, encerra a demo, devolve se encerrou). Fica no ouvinte.
//  · A geometria FÍSICA do direcional (quantos px vale o curso, quantos px vale a zona morta do analógico) é
//    de `input/touch.ts`, que a recalcula a cada `applyPadPhysical()`. Entra por getter e é lida A CADA
//    MOVIMENTO, verbatim — girar o aparelho no meio de um gesto muda o curso no gesto seguinte.
//  · A zona morta da CRUZ, ao contrário, não é configurável: são 18% do lado, escritos no lugar. Continua
//    assim (`CROSS_DEAD_FRACTION`), agora com nome.
//
// ======================= ARMADILHAS DE ORDEM DE BOOT =======================
// `initTouchBindings(ctx)` não toca em DOM nenhum: só fecha sobre o `ctx` e devolve a api. Todo efeito está em
// `attach()`, que é onde o `#touch-controls` é procurado (e onde a função inteira desiste, se ele não existir —
// a guarda `if(!tc)return` do original).
// MESMO ASSIM, o ctx é quase todo GETTER, e por dois motivos independentes:
//   1. TDZ. No main.js, `attractCtl` é `const` declarado ABAIXO do ponto onde este bloco mora. O IIFE original
//      só funcionava porque o corpo dos ouvintes é preguiçoso. Passar `attractCtl` por VALOR derruba o boot.
//   2. Reatribuição. A regra da casa: o que o main.js REATRIBUI entra por getter. `keys` é `const` de
//      `input/state.ts`, mutado in place → entra por VALOR (é sempre o mesmo objeto, para sempre).
// ORDEM DE REGISTRO: `attach()` instala um `pointerdown` de CAPTURA na janela. Ele é hoje o primeiro ouvinte
// de ponteiro do jogo e é ele que encerra a demo; registrar mais tarde só passa a importar se algum dia nascer
// outro ouvinte de ponteiro de janela no meio. Mantenha a chamada no lugar exato onde o IIFE estava.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara constantes congeladas e funções puras.
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D3-b).

/* ===================== interfaces mínimas ===================== */

/** `ui/dom.ts` `$` — injetado; o módulo nunca alcança `document`. */
import { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
import type { PlayerView } from '../core/entity.js';
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

/** ação -> lista de códigos físicos. Cópia ESTRUTURAL do `KeyScheme` de `input/keyboard-runtime.ts` — a casa
 *  prefere a cópia a puxar um alias de tipo através de camadas (mesmo precedente de `input/keydown.ts`). */
export type KeyScheme = Record<string, string[]>;

/** As seis bordas de entrada que o toque levanta no jogador (consumidas e zeradas pela física). */
export type EdgeFlag = 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge';

/** Uma borda a levantar: qual jogador (POSIÇÃO no array) e qual flag. */
export interface EdgeRaise { playerIndex: number; edge: EdgeFlag }

/** O que este módulo lê (e escreve) de um jogador — e SÓ isso. DERIVADA de core/entity.
 *  `easy`: quem está no modo Fácil não levanta `runEdge`, e portanto não gruda na parede — a mesma regra do
 *  teclado e do controle, que é justamente a que divergiu em três cópias uma vez. Ver o cabeçalho. */
export type TouchBindPlayer = PlayerView<
  'ctrl' | 'easy' | 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge'
>;

/** TUDO o que a decisão precisa saber do mundo, num objeto só, montado ANTES de qualquer efeito. */
export interface TouchBindSnapshot {
  /** `kbRuntime.controlsState().controls` — o esquema do Jogador 1 (remapeável). É dele, e só dele, que sai a
   *  tecla que o botão da tela injeta: o toque é sempre o J1, mesmo em multi-tela. */
  controls: KeyScheme;
  /** o array vivo de jogadores: as bordas são levantadas em TODOS que tenham o código no próprio esquema. */
  players: readonly TouchBindPlayer[];
  /** `keys` de `input/state.ts`: as teclas seguradas AGORA (teclado, toque e webcam, misturados). */
  heldKeys: ReadonlySet<string>;
}

/** Retângulo do elemento (o que `getBoundingClientRect()` entrega, reduzido ao que a conta usa). */
export interface RectLike { left: number; top: number; width: number; height: number }

/** As quatro direções físicas do direcional, ligadas ou não. */
export interface DirSet { left: boolean; right: boolean; up: boolean; down: boolean }

/** Um evento de ponteiro, reduzido ao que este módulo lê (`PointerEvent` real é atribuível a isto). */
export interface PointerLike { pointerId: number; clientX: number; clientY: number; preventDefault(): void }

/** A resposta única: o que este toque SIGNIFICA. */
export type TouchDecision =
  /** ação sem tecla mapeada, slot vazio, ou SOLTAR de `pause` — nada acontece. */
  | { kind: 'noop' }
  /** `pause` é o único caso especial: não vira tecla, chama `togglePause()` direto (e só no APERTAR). */
  | { kind: 'pause' }
  /** apertar. `addKey=false` = a tecla JÁ estava segurada (outro dedo, ou o teclado): não re-injeta nem
   *  levanta borda de novo — é isso que faz disto uma BORDA e não um estado. `hideTips` é independente. */
  | { kind: 'press'; code: string; addKey: boolean; edges: EdgeRaise[]; hideTips: boolean }
  /** soltar: some com o código do conjunto. NÃO abaixa borda nenhuma (quem zera as bordas é a física). */
  | { kind: 'release'; code: string };

/* ===================== PURO (sem DOM — project node) ===================== */

/**
 * Ação → borda, na MESMA ordem das outras duas cópias do projeto.
 * ⚠️ TERCEIRA CÓPIA DE UMA TABELA QUE JÁ EXISTE DUAS VEZES — `input/keydown.ts` (`EDGE_BY_ACTION`) e
 * `input/gamepad.ts` (seis `if` dentro de `pollPads`). Ver o bloco de aviso no cabeçalho: as três não
 * concordam sobre o modo Fácil, e a divergência está PRESERVADA de propósito.
 */
export { EDGE_BY_ACTION as TOUCH_EDGE_BY_ACTION } from './edges.js'; // MESMA tabela dos outros dois caminhos

/** `?touch=1` na URL força os controles de toque a aparecerem no desktop (atalho de teste do José). */
export const TOUCH_FORCE_RE = /[?&]touch=1/;

/** Predicado do `?touch=1`, isolado para o teste não repetir o regex. */
export function wantsForcedTouch(search: string): boolean {
  return TOUCH_FORCE_RE.test(search || '');
}

/**
 * Que TECLA este botão de tela finge apertar? A 1ª do esquema do Jogador 1 para aquela ação — 1ª, e não
 * todas, porque só uma precisa entrar em `keys` para o jogo inteiro reagir. Remapear o teclado remapeia o
 * toque junto, de graça: é a mesma tabela.
 * `null` = a ação não existe no esquema (ou o slot do mapa de toque está vazio) → o toque não faz nada.
 */
export function codeForAction(act: string | undefined | null, controls: KeyScheme): string | null {
  if (!act) return null;
  const list = controls[act];
  return (list && list[0]) || null;
}

/**
 * As bordas que este toque levanta, e em quem.
 *
 * ⚠️ SEM A GUARDA DO MODO FÁCIL — VERBATIM DO main.js, DEFEITO PRESERVADO.
 * `input/keydown.ts:edgesFor` pula `run` quando `p.easy` ("Fácil: sem correr"); `input/gamepad.ts:pollPads`
 * também (`if (edge('run') && !p.easy)`). Este caminho NÃO pula. Como `runEdge` é o gatilho de grudar/soltar
 * da parede (`game/physics.ts:177` e `:179`), e não a velocidade de corrida, o efeito prático é que no modo
 * Fácil a escalada existe pelo botão da tela e não existe pelo teclado nem pelo controle.
 * NÃO acrescente a guarda aqui sem consertar as três cópias de uma vez — ver o cabeçalho.
 *
 * ÚNICO DESVIO DE LITERALIDADE, declarado: `p.ctrl[a] || []`. O original alcançava `p.ctrl.jump`/`.run`/
 * `.left`/`.right` DIRETO (e estouraria num esquema sem a ação), enquanto guardava `swap` e `especial` com
 * `&&` — assimetria sem intenção. Trocar um TypeError por um no-op não remove rede de conserto nenhuma; é o
 * mesmo precedente que `input/keydown.ts:edgesFor` já abriu, e está anotado lá pelo mesmo motivo.
 */
export function touchEdgesFor(act: string, code: string, players: readonly TouchBindPlayer[]): EdgeRaise[] {
  const out: EdgeRaise[] = [];
  players.forEach((p, idx) => {
    if (!p.ctrl) return; // jogador sem esquema (tela não ativada) não recebe borda
    for (const [a, edge] of EDGE_BY_ACTION) {
      if (a !== act) continue;
      if (!edgeAllowed(a, p.easy)) continue; // Fácil: sem correr (input/edges.ts)
      if ((p.ctrl[a] || []).includes(code)) out.push({ playerIndex: idx, edge });
    }
  });
  return out;
}

/**
 * A DECISÃO. Gesto (ação mapeada + apertar/soltar) + mundo → o que isso significa.
 * `pause` primeiro, porque é o único que não passa pelo teclado sintético. Depois a tecla; sem tecla, nada.
 */
export function decideTouch(act: string | undefined | null, on: boolean, s: TouchBindSnapshot): TouchDecision {
  if (act === 'pause') return on ? { kind: 'pause' } : { kind: 'noop' }; // SOLTAR o START não despausa
  const code = codeForAction(act, s.controls);
  if (!code) return { kind: 'noop' };
  if (!on) return { kind: 'release', code };
  // BORDA: só a PRIMEIRA vez que o código entra em `keys`. Se o teclado (ou o outro polegar) já o segurava,
  // o toque não re-levanta as bordas — mas `hideTips` roda igual, verbatim.
  const fresh = !s.heldKeys.has(code);
  return {
    kind: 'press', code, addKey: fresh,
    edges: fresh ? touchEdgesFor(act as string, code, s.players) : [],
    hideTips: act === 'jump',
  };
}

/* --- geometria do direcional (pura: posição + retângulo → direções) --- */

/** Zona morta da CRUZ: ~18% do LADO a partir do centro, em cada eixo. Ver a nota de `crossDirsAt` sobre o
 *  `width` valer também para o eixo vertical — é verbatim, e é uma assimetria de verdade. */
export const CROSS_DEAD_FRACTION = 0.18;

/**
 * Cruz (D-pad): onde o dedo está → quais direções ligam. Miolo neutro para não disparar por encostar no meio.
 * As quatro comparações são INDEPENDENTES: fora do miolo, uma diagonal liga DUAS direções (é o que dá o
 * comportamento de D-pad físico de 8 setores). O centro exato não liga nenhuma.
 *
 * VERBATIM, incluindo a assimetria: a zona morta dos DOIS eixos sai de `rect.width` — a altura nunca entra na
 * conta. Numa cruz quadrada (é o que o CSS `--dpad-span` produz) dá no mesmo; numa cruz achatada, o miolo
 * vertical ficaria proporcionalmente maior ou menor que o horizontal. Anotado, não consertado.
 */
export function crossDirsAt(px: number, py: number, rect: RectLike): DirSet {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const dx = px - cx, dy = py - cy;
  const dead = rect.width * CROSS_DEAD_FRACTION;
  return { left: dx < -dead, right: dx > dead, up: dy < -dead, down: dy > dead };
}

/**
 * Analógico virtual: mesma regra da cruz, mas a zona morta vem em PX de `input/touch.ts` (derivada dos mm
 * configuráveis — A12e motora), não de uma fração do elemento.
 */
export function stickDirsAt(px: number, py: number, rect: RectLike, deadPx: number): DirSet {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const dx = px - cx, dy = py - cy;
  return { left: dx < -deadPx, right: dx > deadPx, up: dy < -deadPx, down: dy > deadPx };
}

/**
 * Para onde a manopla do analógico anda (px, relativo ao centro da base): segue o dedo até o limite do curso
 * `travelPx` e ali PARA, mantendo o ângulo (recorte radial, não por eixo — por isso `hypot`, e não `clamp`).
 * O `|| 1` do original evita divisão por zero quando o dedo cai no centro exato.
 */
export function stickKnobOffset(px: number, py: number, rect: RectLike, travelPx: number): { x: number; y: number } {
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const dx = px - cx, dy = py - cy;
  const m = Math.hypot(dx, dy) || 1;
  const f = m > travelPx ? travelPx / m : 1;
  return { x: dx * f, y: dy * f };
}

/* ===================== IMPURO (DOM + ponteiro — via initTouchBindings(ctx)) ===================== */

/** Só o que `attach()` precisa da janela. `(e: never)` é o mesmo truque de `input/keydown.ts`: o handler é
 *  convertido no ponto de registro, e o alvo real (window) satisfaz isto de sobra. */
export interface EventTargetLike {
  addEventListener(type: string, fn: (e: never) => void, opts?: boolean | { capture?: boolean; passive?: boolean }): void;
}

/** Quanto tempo o START segura a ação, quando ela é momentânea (não é `pause`). */
export const START_TAP_MS = 140;

export interface TouchBindingsCtx {
  /** `ui/dom.ts` `$` — injetado; o módulo nunca alcança `document`. */
  $: DomQuery;
  /** `window`, só para os dois ouvintes globais de "houve um dedo/ponteiro". */
  win: EventTargetLike;
  /** `location.search` — lido por getter para o teste poder mentir sem mexer na URL. */
  getSearch: () => string;
  /** `kbRuntime.controlsState().controls` (memorizado do lado de lá) — o esquema do J1, lido a cada toque. */
  getControls: () => KeyScheme;
  /** o array vivo de jogadores. Getter: o main.js o repovoa a cada `restartGame`. */
  getPlayers: () => readonly TouchBindPlayer[];
  /** `keys` de `input/state.ts`: `const` mutado in place → entra por VALOR (é sempre o mesmo objeto). */
  heldKeys: Set<string>;
  /** `game/attract.ts`: zera a ociosidade e encerra a demo; `true` = o toque foi só para acordar.
   *  LAZY obrigatoriamente — `attractCtl` é `const` declarado ABAIXO do ponto de init no main.js. */
  attractOnInput: () => boolean;
  /** `input/touch.ts`: o toque REVELA os botões (o `hideTouchControls` é do keydown, não daqui). */
  showTouchControls: () => void;
  /** main.js: hoje um stub vazio (as dicas de início saíram em 2026-07-04); o call-site é mantido verbatim. */
  hideTips: () => void;
  togglePause: () => void;
  /** `input/touch.ts:getTouchMap()` — slot → ação, remapeável. Lido A CADA evento, verbatim: remapear no
   *  painel passa a valer no toque seguinte, sem re-amarrar ouvinte nenhum. */
  getTouchMap: () => Record<string, string>;
  /** A ação do slot `start`. VER O RELATO DA EXTRAÇÃO: no main.js a linha original é `touchMap.start`, e
   *  `touchMap` NÃO EXISTE naquele escopo — o botão START da tela está quebrado hoje. Este campo é o ponto
   *  exato onde esse defeito vive, isolado para poder ser consertado (ou não) numa linha só, com decisão. */
  getStartAction: () => string | undefined;
  /** `input/touch.ts`: curso e zona morta do analógico, em px, recalculados a cada `applyPadPhysical()`. */
  getStickTravelPx: () => number;
  getStickDeadPx: () => number;
  /** `setTimeout` — injetável só para o teste do START não esperar 140 ms de relógio. */
  defer?: (fn: () => void, ms: number) => void;
}

export interface TouchBindingsApi {
  /** A decisão pura, já com o mundo de agora. Exposta para o teste comparar sem aplicar. */
  decide: (act: string | undefined, on: boolean) => TouchDecision;
  /** O despacho inteiro: decide e carimba no mundo. É o `doTouch` do main.js. */
  doTouch: (act: string | undefined, on: boolean) => void;
  /** O que o botão START faz num clique (pausar, ou apertar-e-soltar depois de `START_TAP_MS`). */
  pressStart: () => void;
  /** `window.__incl.showTouch` — revela os botões à força, para teste em desktop. */
  revealForTests: () => void;
  /** Amarra tudo: os dois ouvintes globais, os `.touch-btn`, o START, o analógico e a cruz. */
  attach: () => void;
}

export function initTouchBindings(ctx: TouchBindingsCtx): TouchBindingsApi {
  const later = ctx.defer || ((fn: () => void, ms: number) => { setTimeout(fn, ms); });

  function snapshot(): TouchBindSnapshot {
    return { controls: ctx.getControls(), players: ctx.getPlayers(), heldKeys: ctx.heldKeys };
  }

  function decide(act: string | undefined, on: boolean): TouchDecision {
    return decideTouch(act, on, snapshot());
  }

  /** A metade IMPURA: pega a decisão pronta e a carimba no mundo. Ordem verbatim: a tecla entra em `keys`
   *  ANTES das bordas, e `hideTips` vem depois de tudo. */
  function apply(d: TouchDecision): void {
    if (d.kind === 'noop') return;
    if (d.kind === 'pause') { ctx.togglePause(); return; }
    if (d.kind === 'release') { ctx.heldKeys.delete(d.code); return; }
    if (d.addKey) {
      ctx.heldKeys.add(d.code);
      const players = ctx.getPlayers();
      for (const { playerIndex, edge } of d.edges) {
        const p = players[playerIndex];
        if (p) p[edge] = true;
      }
    }
    if (d.hideTips) ctx.hideTips();
  }

  function doTouch(act: string | undefined, on: boolean): void { apply(decide(act, on)); }

  function pressStart(): void {
    const a = ctx.getStartAction();
    if (a === 'pause') { ctx.togglePause(); return; }
    doTouch(a, true);
    later(() => doTouch(a, false), START_TAP_MS); // ação momentânea: aperta e solta sozinho
  }

  function revealForTests(): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc) tc.hidden = false;
  }

  /** Direcional (analógico ou cruz): um só padrão — estado por direção, só despacha na MUDANÇA. Sem isso,
   *  arrastar o polegar dentro do mesmo quadrante re-levantaria a borda a cada `pointermove`. */
  function makeDirGate(onChange: (dir: keyof DirSet, on: boolean) => void): {
    set: (dir: keyof DirSet, on: boolean) => void;
    apply: (dirs: DirSet) => void;
    reset: () => void;
  } {
    const state: DirSet = { left: false, right: false, up: false, down: false };
    const set = (dir: keyof DirSet, on: boolean): void => {
      if (state[dir] === on) return;
      state[dir] = on;
      onChange(dir, on);
    };
    return {
      set,
      apply: (dirs: DirSet) => { set('left', dirs.left); set('right', dirs.right); set('up', dirs.up); set('down', dirs.down); },
      reset: () => { (['left', 'right', 'up', 'down'] as const).forEach((d) => set(d, false)); },
    };
  }

  /* --- os .touch-btn do losango --- */
  function wireButtons(tc: HTMLElement): void {
    tc.querySelectorAll<HTMLElement>('.touch-btn').forEach((b) => {
      const slot = 'b' + (b.dataset.btn || ''); // a função vem do touchMap (remapeável), não do data-act
      const down = (e: PointerLike): void => { e.preventDefault(); doTouch(ctx.getTouchMap()[slot], true); };
      const up = (e: PointerLike): void => { e.preventDefault(); doTouch(ctx.getTouchMap()[slot], false); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);   // o dedo escorregou para fora: conta como soltar
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e: Event) => e.preventDefault()); // segurar não abre menu do sistema
    });
  }

  /**
   * Analógico e cruz compartilham TODO o ciclo de vida do ponteiro (captura, um dedo por vez, soltar/cancelar,
   * perder a captura). O que muda é só a conta de direção e o retorno visual — por isso os dois entram aqui e
   * a diferença vira dois callbacks.
   */
  function wirePointerPad(
    el: HTMLElement,
    dirsAt: (px: number, py: number, rect: RectLike) => DirSet,
    onMove: ((px: number, py: number, rect: RectLike) => void) | null,
    onReset: (() => void) | null,
    onDirVisual: ((dir: keyof DirSet, on: boolean) => void) | null,
  ): void {
    let pid: number | null = null;
    const gate = makeDirGate((dir, on) => {
      doTouch(ctx.getTouchMap()[dir], on); // direção FÍSICA → função mapeada (a cruz também é remapeável)
      if (onDirVisual) onDirVisual(dir, on);
    });
    const at = (px: number, py: number): void => {
      const rect = el.getBoundingClientRect();
      if (onMove) onMove(px, py, rect);
      gate.apply(dirsAt(px, py, rect));
    };
    const reset = (): void => { if (onReset) onReset(); gate.reset(); pid = null; };
    el.addEventListener('pointerdown', (e: PointerLike) => {
      e.preventDefault();
      const id = e.pointerId;
      pid = id;
      // captura: o dedo pode sair do elemento sem que o gesto acabe (é o que faz um direcional ser usável)
      try { el.setPointerCapture(id); } catch { /* sem captura de ponteiro: o gesto ainda funciona por cima do elemento */ }
      at(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e: PointerLike) => {
      if (pid !== e.pointerId) return; // um dedo por vez: o segundo ponteiro é ignorado, não disputa
      e.preventDefault();
      at(e.clientX, e.clientY);
    });
    const end = (e: PointerLike): void => { if (pid !== e.pointerId) return; e.preventDefault(); reset(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', reset); // rede: perdeu a captura = solta tudo (nada fica preso)
    el.addEventListener('contextmenu', (e: Event) => e.preventDefault());
  }

  function attach(): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc) return; // sem os botões no documento, não há o que amarrar (guarda do IIFE original)

    // alternância por modalidade: toque/clique MOSTRA; teclado/controle OCULTA (lá no keydown/gamepad).
    if (wantsForcedTouch(ctx.getSearch())) ctx.showTouchControls();
    const onPointerDown = (): void => { if (ctx.attractOnInput()) return; ctx.showTouchControls(); }; // toque revela (e encerra a demo)
    const onTouchStart = (): void => { ctx.showTouchControls(); };
    ctx.win.addEventListener('pointerdown', onPointerDown as (e: never) => void, true);
    ctx.win.addEventListener('touchstart', onTouchStart as (e: never) => void, { capture: true, passive: true });

    wireButtons(tc);

    const startBtn = ctx.$<HTMLElement>('#touch-start');
    if (startBtn) startBtn.addEventListener('click', pressStart);

    // analógico: base (círculo grande) + manopla que desliza para a direção tocada
    const stick = ctx.$<HTMLElement>('#touch-stick');
    const knob = stick && stick.querySelector<HTMLElement>('.touch-knob');
    if (stick && knob) {
      wirePointerPad(
        stick,
        (px, py, rect) => stickDirsAt(px, py, rect, ctx.getStickDeadPx()), // px/mm relidos a cada movimento
        (px, py, rect) => {
          const o = stickKnobOffset(px, py, rect, ctx.getStickTravelPx());
          knob.style.transform = `translate(${o.x}px,${o.y}px)`;
        },
        () => { knob.style.transform = 'translate(0,0)'; },
        null,
      );
    }

    // cruz (estilo alternativo ao analógico): superfície dividida por hit-test, com miolo neutro
    const cross = ctx.$<HTMLElement>('#touch-cross');
    if (cross) {
      const arms: Record<keyof DirSet, HTMLElement | null> = {
        up: cross.querySelector<HTMLElement>('.dpad-up'),
        down: cross.querySelector<HTMLElement>('.dpad-down'),
        left: cross.querySelector<HTMLElement>('.dpad-left'),
        right: cross.querySelector<HTMLElement>('.dpad-right'),
      };
      wirePointerPad(cross, crossDirsAt, null, null, (dir, on) => { arms[dir]?.classList.toggle('on', on); });
    }
  }

  return { decide, doTouch, pressStart, revealForTests, attach };
}
