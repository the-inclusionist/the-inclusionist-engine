// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keyboard-runtime.ts — keyboard ROUTING at play time: which key belongs to which player, which action
// it fires. Extracted from game.js (kbFor/actionOf/whichPlayer/assignControls/applyControls). Pure logic, DI
// via initKeyboardRuntime(ctx): reads the live KB config (input/keyboard.ts owns load/save/reset) and the live
// numPlayers/players (still in game.js) through injected getters — never imports game.js, never touches
// `document`. KJUMP/KLEFT/.../GAME_KEYS come back as a plain VALUE object (computeControlsState) instead of
// being reassigned here: imported bindings can't be reassigned from outside their own module, so the game.js
// wrapper is the one that copies the returned fields onto its own `let`s (same trap `core/state.ts` documents
// for `coins`/`players`).

import type { ControlledPlayer } from '../core/entity.js';
import type { KeyScheme } from '../core/entity.js';
import { ACTIONS, type Action } from '../core/actions.js';
import type { KBDefaults } from '../input/keyboard.js';

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {jump:['KeyJ','Space']}. Mirrors the shape
 *  ui/settings-controls.ts also defines locally (input/keyboard.ts's KeyScheme is not exported — each consumer
 *  keeps its own structural copy rather than reaching across layers for a type alias). */
// `KeyScheme` mora em `core/entity` desde 2026-08-26: a entidade declara `ctrl: KeyScheme | null`, então
// ela é a dona. A mesma linha estava escrita em SEIS módulos. Reexportada para quem já a importava daqui.
export type { KeyScheme } from '../core/entity.js';

/** input/keyboard.ts's KBDefaults shape ({solo,p2,p3,p4}) — the live `KB` value in game.js. */
/** O `KBDefaults` de `input/keyboard`, que é o dono. O nome local sobrevive porque os consumidores o usam. */
export type KeyboardConfig = KBDefaults;

/** Minimal player shape this module needs: only `ctrl` is read/written — derived from core/entity.
 *  `ControlledPlayer` rather than `Player` because this module runs after assignControls, so `ctrl` is no
 *  longer null. That was already assumed here; now it is stated. */
export type KeyboardRuntimePlayer = Pick<ControlledPlayer, 'ctrl'>;

export interface KeyboardRuntimeCtx {
  /** The live keyboard config (game.js's `KB`), read fresh on every call — never cached. */
  getKB(): KeyboardConfig;
  /** Current player count (core/state.ts's `numPlayers`, read live via game.js). */
  getNumPlayers(): number;
  /** The live players array (core/state.ts's `players`, mutated in place — never reassigned). */
  getPlayers(): KeyboardRuntimePlayer[];
}

/** Result of the old `applyControls()` mutation, as a value: `controls` + its per-action aliases (game.js's
 *  KJUMP/KLEFT/KRIGHT/KUP/KDOWN/KRUN) + the flattened `GAME_KEYS` list. */
/** A lista que uma posição SEM ALCANCE devolve. Congelada e partilhada: ninguém deve escrever nela. */
const EMPTY: readonly string[] = Object.freeze([]);

export interface ControlsState {
  controls: KeyScheme;
  // ⚠️ `readonly` desde a #118: uma posição sem alcance devolve a lista vazia partilhada, e uma lista
  // partilhada que alguém pudesse mutar seria uma lista vazia que deixa de ser vazia para todos.
  action2: readonly string[];
  left: readonly string[];
  right: readonly string[];
  up: readonly string[];
  down: readonly string[];
  action1: readonly string[];
  gameKeys: string[];
}

export interface KeyboardRuntime {
  /** The key scheme for player `playerIndex`, given the current KB config + player count (game.js's kbFor). */
  kbFor(playerIndex: number): KeyScheme;
  /** Which action (if any) `code` triggers FOR that player, given their scheme (game.js's actionOf). */
  actionOf(code: string, playerIndex: number): string | null;
  /** Which player (0-based) owns `code` among the active players; -1 if none (game.js's whichPlayer). */
  whichPlayer(code: string): number;
  /** Propagates `kb` -> each active player's `p.ctrl`, mutated in place (game.js's assignControls). */
  assignControls(): void;
  /** Computes the P1-alias `controls` + `GAME_KEYS` (game.js's applyControls, minus the reassignment). */
  computeControlsState(): ControlsState;
  /** O estado ATUAL, memorizado. Antes eram oito `let` no game.js (`controls`, `KJUMP`..`KRUN`, `GAME_KEYS`)
   *  copiados de `computeControlsState()` por um `applyControls()` que existia só para fazer a cópia. Eram
   *  derivados de `KB` + `players`, guardados em variável — a forma de estado que mais apodrece, porque nada
   *  obriga a cópia a acompanhar a origem. Aqui a memória fica com quem é dono da conta, e a invalidação é
   *  explícita e única: `refreshControls()`. NÃO recalcula a cada leitura de propósito — recalcular mudaria
   *  o comportamento (passaria a enxergar remapeamento que ainda não foi aplicado), e isto é refatoração. */
  controlsState(): ControlsState;
  /** Recalcula e memoriza. É o `applyControls()` do game.js, agora do lado de cá. */
  refreshControls(): ControlsState;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no ctx, no `document` — directly testable with plain KeyScheme fixtures)
// ---------------------------------------------------------------------------------------------

/** code -> action index for ONE scheme, first action wins when a code is bound twice in the same scheme
 *  (mirrors ui/settings-controls.ts's keyUsedByOther: a Map built over the scheme, not a re-scan per query). */
function buildActionIndex(scheme: KeyScheme): Map<string, string> {
  const index = new Map<string, string>();
  // ⚠️ O LAÇO PASSOU A SER SOBRE `ACTIONS` E NÃO SOBRE AS CHAVES DO OBJETO (issue #118). São a mesma lista
  // agora que o `KeyScheme` é fechado — mas percorrer `ACTIONS` diz QUAL é a lista, e um esquema que ganhe
  // uma chave a mais por engano deixa de a ver. E o `?? []` é o que trata a AUSÊNCIA DECLARADA: um `null`
  // não é um esquema partido, é um teclado que não alcança aquela posição.
  for (const action of ACTIONS) {
    for (const code of scheme[action] ?? []) {
      if (!index.has(code)) index.set(code, action);
    }
  }
  return index;
}

/** Which action does `code` trigger in this ONE scheme? Pure — no player/KB involved. */
export function actionForCode(scheme: KeyScheme, code: string): string | null {
  return buildActionIndex(scheme).get(code) ?? null;
}

/** Which player owns `code`, given one scheme per player (index = player index)? -1 if none. Pure. */
export function ownerOfCode(schemesByPlayer: readonly KeyScheme[], code: string): number {
  for (let i = 0; i < schemesByPlayer.length; i++) {
    if (actionForCode(schemesByPlayer[i], code)) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------------------------
// DI runtime (closes over ctx — still no `document`)
// ---------------------------------------------------------------------------------------------

export function initKeyboardRuntime(ctx: KeyboardRuntimeCtx): KeyboardRuntime {
  function kbFor(playerIndex: number): KeyScheme {
    const kb = ctx.getKB();
    const n = ctx.getNumPlayers();
    if (n <= 1) return kb.solo;
    if (n <= 2) return kb.p2[playerIndex] || kb.p2[0];
    if (n <= 3) return kb.p3[playerIndex] || kb.p3[0];
    return kb.p4[playerIndex] || kb.p4[0];
  }

  function schemesForActivePlayers(): KeyScheme[] {
    const n = ctx.getNumPlayers();
    return Array.from({ length: n }, (_, i) => kbFor(i));
  }

  function actionOf(code: string, playerIndex: number): string | null {
    return actionForCode(kbFor(playerIndex), code);
  }

  function whichPlayer(code: string): number {
    return ownerOfCode(schemesForActivePlayers(), code);
  }

  function assignControls(): void {
    ctx.getPlayers().forEach((p, i) => { p.ctrl = kbFor(i); });
  }

  function computeControlsState(): ControlsState {
    const kb = ctx.getKB();
    const controls = kb.solo; // alias do P1 — SEMPRE kb.solo, mesmo com numPlayers>1 (comportamento original; ver relato)
    // Os apelidos são LISTAS, nunca `null`: quem os lê faz `.includes(code)` sem perguntar. Uma posição que o
    // esquema não alcança vira lista vazia aqui — «não alcança» e «alcança com zero teclas» valem o mesmo
    // para quem só pergunta se a tecla está lá.
    //
    // ⚠️ E DEVOLVE A MESMA REFERÊNCIA, não uma cópia. A primeira versão fazia `[...]` e um caso reprovou por
    // identidade — corretamente: o apelido é o alias do P1, e um teste que afirma «é o mesmo array» está a
    // afirmar que ninguém interpôs uma cópia entre o esquema vivo e quem o lê. Copiar aqui não custaria nada
    // hoje e passaria a custar no dia em que alguém mutasse a lista no lugar.
    const list = (a: Action): readonly string[] => controls[a] ?? EMPTY;
    const action2 = list('action2'), left = list('left'), right = list('right');
    const up = list('up'), down = list('down'), action1 = list('action1');
    const gameKeySet = new Set<string>();
    ctx.getPlayers().forEach((_, i) => {
      const scheme = kbFor(i);
      for (const action of ACTIONS) for (const code of scheme[action] ?? []) gameKeySet.add(code);
    });
    const gameKeys = gameKeySet.size ? [...gameKeySet] : [...action2, ...left, ...right, ...up, ...down];
    return { controls, action2, left, right, up, down, action1, gameKeys };
  }

  let cache: ControlsState | null = null; // memória do estado derivado; só refreshControls a invalida
  function controlsState(): ControlsState { return cache ?? (cache = computeControlsState()); }
  function refreshControls(): ControlsState { cache = computeControlsState(); return cache; }

  return { kbFor, actionOf, whichPlayer, assignControls, computeControlsState, controlsState, refreshControls };
}
