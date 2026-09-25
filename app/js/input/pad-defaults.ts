// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-defaults.ts — THE BUTTON MAP THIS GAME WANTS, by arrangement and by seat (ADR-0115).
//
// ========================= WHY A MODULE AND NOT A LINE IN `input/gamepad` =========================
// Whoever BUILDS the table and whoever READS it sit on different sides of the mount: the composition root builds it from
// the game's declaration; the pad transport reads it every frame, through a REQUIRED `GamepadCtx.padTable` — a caller
// cannot forget it and silently hand the ENGINE's map to a game that declared another.
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

/** The button table for an arrangement and seat — what `createPadTable` returns and `GamepadCtx.padTable` receives. */
export type PadTableFor = (players: number, seat: number) => PadTable;

/**
 * THE BUTTON TABLE OF ONE GAME'S MAPPING, for each arrangement and seat — the engine's factory with the game's default on
 * top. `null` = a game with no opinion: the factory itself, the same object.
 *
 * 📌 MEMOISED because it is read in the polling loop, once per pad per frame: merging two objects sixty times a second
 * per player is garbage no child sees and the collector pays for. The key is `players:seat`.
 * ⚠️ AND THE MEMO IS THIS TABLE'S, one per mapping (ADR-0232 D4): a root that mounts another cartridge builds another
 * table. As a module registration it was one memo for the page, and a second mount — another game, another root, one
 * test after another — read the previous game's table unless every writer remembered to clear it.
 */
export function createPadTable(mapping: PadMapping | null): PadTableFor {
  const memo = new Map<string, PadTable>();
  return (players, seat) => {
    if (!mapping) return GAMEPAD_STANDARD;
    const key = `${players}:${seat}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const changes = mapping(players, seat);
    const table: PadTable = changes ? Object.freeze({ ...GAMEPAD_STANDARD, ...changes }) : GAMEPAD_STANDARD;
    memo.set(key, table);
    return table;
  };
}
