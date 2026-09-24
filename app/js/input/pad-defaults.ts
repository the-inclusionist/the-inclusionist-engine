// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-defaults.ts — THE BUTTON MAP THIS GAME WANTS, by arrangement and by seat (ADR-0115).
//
// ========================= WHY A MODULE AND NOT A LINE IN `input/gamepad` =========================
// Whoever REGISTERS it and whoever READS it sit on different sides of the mount, and that is the whole reason: the
// composition root registers it from the game's declaration; the pad transport reads it every frame. Kept apart, the
// transport never has to be handed the declaration — a field a caller could forget, and forgetting it would give the
// ENGINE's map to a game that declared another, in silence.
//
// ⚠️ AND THE PRECEDENCE IS THE KEYBOARD'S, with a difference of place worth writing down: on a pad the CHILD's remap is
// not a layer on top of this table — it is a whole BRANCH of `padActions` (the map the wizard recorded for that `gp.id`).
// So the game's default decides only when they remapped nothing, which is exactly what "default" means.
//
// 📌 THE ENGINE'S FACTORY → THE GAME'S DEFAULT → THE CHILD'S REMAP. The same sentence as `input/keyboard`.
import type { Action } from '../core/actions.js';
import { GAMEPAD_STANDARD, type Binding } from './default-bindings.js';

/** What the game declares: only what it wants to change. `null` on a button is "this position does not exist in this game". */
export type PadMapping = (players: number, seat: number) => Partial<Record<Action, number | null>> | null;

export type PadTable = Readonly<Record<Action, Binding<number>>>;

let gameMapping: PadMapping | null = null;
const memo = new Map<string, PadTable>();

/**
 * REGISTERS THE GAME'S DEFAULT. Called once by the start; `null` clears it (what a game with no opinion produces).
 *
 * ⚠️ IT CLEARS THE MEMO, and without that line the register would be worse than not existing: a second mount — another
 * game on the same page, one test after another — would read the previous game's table, and the reading would be right
 * everywhere except in its value.
 */
export function registerPadMapping(f: PadMapping | null): void {
  gameMapping = f;
  memo.clear();
}

/**
 * THE BUTTON TABLE FOR THIS ARRANGEMENT AND SEAT — the engine's factory with the game's default on top.
 *
 * 📌 MEMOISED because it is read in the polling loop, once per pad per frame: merging two objects sixty times a second
 * per player is garbage no child sees and the collector pays for. The key is `players:seat`, and the register clears it
 * — the only moment the answer can change.
 */
export function padTable(players: number, seat: number): PadTable {
  if (!gameMapping) return GAMEPAD_STANDARD;
  const key = `${players}:${seat}`;
  const cached = memo.get(key);
  if (cached) return cached;
  const changes = gameMapping(players, seat);
  const table: PadTable = changes ? Object.freeze({ ...GAMEPAD_STANDARD, ...changes }) : GAMEPAD_STANDARD;
  memo.set(key, table);
  return table;
}
