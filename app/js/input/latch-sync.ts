// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-sync.ts — THE TOGGLE OF THE TRANSPORT IN USE, PUT ON THE PLAYER (ADR-0113, issue #127).
//
// ========================= THE MISSING PIECE, AND WHAT IT CLOSES =========================
// ADR-0113 decided the toggle is a CAPS LOCK kept with each device's mapping: changing controls is receiving that
// device's state, without writing anything. Three modules were built for it and none answers the whole question:
//
//   · `input/latch-scope`      — the RULE (the transport's value · the game's `holdsKeys()` on the four one-command
//                                transports, ADR-0249 · legacy · factory);
//   · `input/latch-store`      — the STORAGE (the three states, and the key with the transport in its name);
//   · `input/transport-in-use` — the STATE MACHINE (which device produced this player's edges).
//
// 📏 Measured: `storedLatch` once had ZERO callers in production. The rule was written and tested, and nobody read it.
// This module is the join: it asks the state machine WHO is playing, the storage WHAT is kept for that device, and writes
// the answer where the physics reads it.
//
// ⚠️ WRITING ON THE PLAYER, AND NOT REPLACING THE FIELD, IS A DECISION. `p.toggleMove` is read in a CARTRIDGE's physics
// loop, which lives in another repository. Making the toggle a question the physics would call would change another
// game's hottest loop to save a field; putting it IN the field it already reads keeps the readers right and makes the
// field a DERIVED CACHE — recomputed on the edge, never guessed.
//
// 🔴 AND THE LINE THAT MATTERS MOST HERE IS `walkDir = 0`. Turning the toggle off without stopping whoever walks by latch
// leaves the character walking alone while the child lets go of everything — no error, no warning, on the device of
// whoever has fewest alternatives. The mobility panel had this rule for its icon; a second copy here would be one more
// duplicated table, so the rule lives in one function (`applyLatch`) and the panel calls it.
import type { PlayerView } from '../core/entity.js';
import { storedLatch, type LatchStore } from './latch-store.js';
import type { LatchDefaults } from './latch-scope.js';

/**
 * The MINIMUM OF THE PLAYER the toggle touches — two fields, neither of them part of the game's contract.
 *
 * 📌 `PlayerView` and not the whole player: this module has nothing to do with sprites, physics or camera, and a wide type
 * here would make a gate need a whole fake player to assert two lines.
 *
 * ⚠️ AND IT MOVED HERE INSTEAD OF BEING BORN A SECOND TIME. This line existed word for word in the mobility panel —
 * writing it again would be a second copy of a type. The panel publishes it by ALIAS, so the names snapshot does not read
 * it as removed.
 */
export type LatchPlayer = PlayerView<'toggleMove' | 'walkDir'>;

/**
 * The base under which the WALKING toggle lives in the child's storage.
 *
 * ⚠️ ITS SIBLING (`togglerun`, the RUN toggle) DOES NOT ENTER HERE, and the absence is declared rather than forgotten:
 * `p.toggleRun` has a ROUND reader in the cartridge, with its own latch saying whether it is running NOW — `walkDir = 0`
 * is not the right gesture for it, and inventing one without that reader in front of me would decide for a game I did not
 * open. `input/latch-store` already takes the base as an argument, so when it enters it needs no second form of the same
 * question.
 */
export const BASE_DA_MARCHA = 'togglemove';

/**
 * PUTS THE WALKING TOGGLE ON THE PLAYER, with the rule that goes with it. Returns whether anything CHANGED.
 *
 * ⚠️ `walkDir = 0` runs only when the toggle FALLS. Zeroing it on every call would take the direction from whoever is
 * walking, once per edge — the defect inside out, and more frequent.
 *
 * 📌 Returning "changed" is not convenience: a caller on the edge runs this many times a second, and announcing or
 * reflecting on every call would fill the screen reader with the same sentence.
 */
export function applyLatch(p: LatchPlayer, on: boolean): boolean {
  if (p.toggleMove === on) return false;
  p.toggleMove = on;
  if (!on) p.walkDir = 0;
  return true;
}

/**
 * THIS PLAYER'S TOGGLE, RESOLVED FOR THE TRANSPORT IN USE AND WRITTEN ON THEM. Returns whether it changed.
 *
 * Clause 1 of ADR-0113 in code, and the property it promises is NEGATIVE: calling this when the device changes changes
 * the answer **without writing to storage**. A sync that stored the resolved value would erase, on the first edge, the
 * choice the child made on the other device.
 *
 * ⚠️ ON THE FOUR ONE-COMMAND TRANSPORTS THE DEFAULT IS THE GAME'S (ADR-0249) — `defaults.gameHoldsKeys`, which the caller
 * reads from `holdsKeys()` when it calls: a platform game keeps walking on «direita», a quiz moves once on «abaixo», and a
 * choice the child stored for that transport wins over both. The rule lives in `latch-scope`.
 */
export function syncLatch(
  p: LatchPlayer,
  store: LatchStore,
  player: number,
  transport: string,
  defaults: LatchDefaults,
): boolean {
  return applyLatch(p, storedLatch(store, BASE_DA_MARCHA, player, transport, defaults));
}
