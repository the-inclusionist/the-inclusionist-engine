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

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {action2:['KeyJ','Space']}. It lives in `core/entity`,
 *  whose `ctrl: KeyScheme | null` makes it the owner — the same line was once written in six modules. Re-exported for
 *  whoever already imported it from here. */
export type { KeyScheme } from '../core/entity.js';

/** `input/keyboard`'s `KBDefaults` ({solo,p2,p3,p4}), which owns it. The local name survives because consumers use it. */
export type KeyboardConfig = KBDefaults;

/** Minimal player shape this module needs: only `ctrl` is read/written — derived from core/entity.
 *  `ControlledPlayer` rather than `Player` because this module runs after assignControls, so `ctrl` is no
 *  longer null. That was already assumed here; now it is stated. */
export type KeyboardRuntimePlayer = Pick<ControlledPlayer, 'ctrl'>;

export interface KeyboardRuntimeCtx {
  /** The live keyboard config, read fresh on every call — never cached. */
  getKB(): KeyboardConfig;
  /** The current player count, read live. */
  getNumPlayers(): number;
  /** The live players array (mutated in place — never reassigned). */
  getPlayers(): KeyboardRuntimePlayer[];
}

/** The list a position WITH NO REACH returns. Frozen and shared: nobody may write to it. */
const EMPTY: readonly string[] = Object.freeze([]);

/** The controls state as a value: player 1's `controls` + its per-action aliases + the flattened list of game keys. */
export interface ControlsState {
  controls: KeyScheme;
  // ⚠️ `readonly` (#118): a position with no reach returns the shared empty list, and a shared list someone could mutate
  // would be an empty list that stops being empty for everyone.
  action2: readonly string[];
  left: readonly string[];
  right: readonly string[];
  up: readonly string[];
  down: readonly string[];
  action1: readonly string[];
  gameKeys: string[];
}

export interface KeyboardRuntime {
  /** The key scheme for player `playerIndex`, given the current config + player count. */
  kbFor(playerIndex: number): KeyScheme;
  /** Which action (if any) `code` triggers FOR that player, given their scheme. */
  actionOf(code: string, playerIndex: number): string | null;
  /** Which player (0-based) owns `code` among the active players; -1 if none. */
  whichPlayer(code: string): number;
  /** Propagates the config -> each active player's `p.ctrl`, mutated in place. */
  assignControls(): void;
  /** Computes player 1's `controls` alias + the game keys. */
  computeControlsState(): ControlsState;
  /** The CURRENT state, memoised. It was a set of copies kept in variables, derived from the config + players — the
   *  kind of state that rots fastest, because nothing forces a copy to follow its source. Here the memo stays with
   *  whoever owns the sum, and invalidating it is explicit and single: `refreshControls()`. It does NOT recompute on
   *  every read, on purpose — that would change behaviour (it would see a remap not applied yet). */
  controlsState(): ControlsState;
  /** Recomputes and memoises. */
  refreshControls(): ControlsState;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no ctx, no `document` — directly testable with plain KeyScheme fixtures)
// ---------------------------------------------------------------------------------------------

/** code -> action index for ONE scheme, first action wins when a code is bound twice in the same scheme
 *  (mirrors ui/settings-controls.ts's keyUsedByOther: a Map built over the scheme, not a re-scan per query). */
function buildActionIndex(scheme: KeyScheme): Map<string, string> {
  const index = new Map<string, string>();
  // ⚠️ THE LOOP IS OVER `ACTIONS` AND NOT OVER THE OBJECT'S KEYS (issue #118). They are the same list now that
  // `KeyScheme` is closed — but walking `ACTIONS` says WHICH list it is, and a scheme that gains an extra key by mistake
  // no longer sees it. And `?? []` handles the DECLARED ABSENCE: a `null` is not a broken scheme, it is a keyboard that
  // does not reach that position.
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
    const controls = kb.solo; // player 1's alias — ALWAYS kb.solo, even with more players (the original behaviour)
    // The aliases are LISTS, never `null`: whoever reads them does `.includes(code)` without asking. A position the
    // scheme does not reach becomes an empty list here — "does not reach" and "reaches with zero keys" are worth the
    // same to whoever only asks whether the key is there.
    //
    // ⚠️ AND IT RETURNS THE SAME REFERENCE, not a copy. A case asserts "it is the same array", which is asserting that
    // nobody put a copy between the live scheme and its reader. Copying would cost nothing today and would start costing
    // the day someone mutated the list in place.
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

  let cache: ControlsState | null = null; // the derived state's memo; only refreshControls invalidates it
  function controlsState(): ControlsState { return cache ?? (cache = computeControlsState()); }
  function refreshControls(): ControlsState { cache = computeControlsState(); return cache; }

  return { kbFor, actionOf, whichPlayer, assignControls, computeControlsState, controlsState, refreshControls };
}
