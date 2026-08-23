// SPDX-License-Identifier: GPL-3.0-or-later
// input/keyboard-runtime.ts — keyboard ROUTING at play time: which key belongs to which player, which action
// it fires. Extracted from game.js (kbFor/actionOf/whichPlayer/assignControls/applyControls). Pure logic, DI
// via initKeyboardRuntime(ctx): reads the live KB config (input/keyboard.ts owns load/save/reset) and the live
// numPlayers/players (still in game.js) through injected getters — never imports game.js, never touches
// `document`. KJUMP/KLEFT/.../GAME_KEYS come back as a plain VALUE object (computeControlsState) instead of
// being reassigned here: imported bindings can't be reassigned from outside their own module, so the game.js
// wrapper is the one that copies the returned fields onto its own `let`s (same trap `core/state.ts` documents
// for `coins`/`players`).

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {jump:['KeyJ','Space']}. Mirrors the shape
 *  ui/settings-controls.ts also defines locally (input/keyboard.ts's KeyScheme is not exported — each consumer
 *  keeps its own structural copy rather than reaching across layers for a type alias). */
export type KeyScheme = Record<string, string[]>;

/** input/keyboard.ts's KBDefaults shape ({solo,p2,p3,p4}) — the live `KB` value in game.js. */
export interface KeyboardConfig {
  solo: KeyScheme;
  p2: KeyScheme[];
  p3: KeyScheme[];
  p4: KeyScheme[];
}

/** Minimal player shape this module needs: only `ctrl` (game.js's Player.ctrl) is read/written. */
export interface KeyboardRuntimePlayer {
  ctrl: KeyScheme;
}

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
export interface ControlsState {
  controls: KeyScheme;
  jump: string[];
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  run: string[];
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
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no ctx, no `document` — directly testable with plain KeyScheme fixtures)
// ---------------------------------------------------------------------------------------------

/** code -> action index for ONE scheme, first action wins when a code is bound twice in the same scheme
 *  (mirrors ui/settings-controls.ts's keyUsedByOther: a Map built over the scheme, not a re-scan per query). */
function buildActionIndex(scheme: KeyScheme): Map<string, string> {
  const index = new Map<string, string>();
  for (const action in scheme) {
    for (const code of scheme[action]) {
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
    const { jump, left, right, up, down, run } = controls;
    const gameKeySet = new Set<string>();
    ctx.getPlayers().forEach((_, i) => {
      const scheme = kbFor(i);
      for (const action in scheme) for (const code of scheme[action]) gameKeySet.add(code);
    });
    const gameKeys = gameKeySet.size ? [...gameKeySet] : [...jump, ...left, ...right, ...up, ...down];
    return { controls, jump, left, right, up, down, run, gameKeys };
  }

  return { kbFor, actionOf, whichPlayer, assignControls, computeControlsState };
}
