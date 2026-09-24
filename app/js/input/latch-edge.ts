// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-edge.ts — THE EDGE AND THE TOGGLE, IN ONE FUNCTION (ADR-0113, issue #127).
//
// ========================= WHY THE PAIR CANNOT SPLIT =========================
// Recording which device an edge came from and resolving that device's toggle are two halves of ONE event: the child
// changed controls. Done in different places, the second can go missing — the kind of defect this project has paid for
// several times: the state machine knows they picked up the pad, and the game keeps moving with the keyboard's toggle.
// No error, and only the child notices.
//
// 📌 The same move as the menu navigation's "one function so the pair never splits", and the double write in
// `ui/settings-mobility`.
//
// ⚠️ AND IT IS A FACTORY, NOT A NEW FIELD IN EVERY INPUT MODULE'S CONTEXT. The keyboard and touch transports already
// receive `playerEdge(player, origin)`; this returns one with that same signature, so the wiring is right without either
// of them knowing the toggle exists. A second required field in two contexts would be more public surface, one more
// thing a cartridge can forget, and the same question asked twice.
import * as store from '../platform/storage.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import { playerEdge, inputOf } from './state.js';
import { syncLatch, type LatchPlayer } from './latch-sync.js';
import type { LatchStore } from './latch-store.js';
import type { TransportName } from './transport-in-use.js';

export interface LatchedEdgeOptions {
  /**
   * The storage. Injectable **for the gate**, and with a default so a consumer cannot forget it.
   *
   * ⚠️ A default and not a required field: an injected store is something a cartridge can omit, and omitting it would
   * make the child lose their stored choice — in silence, and only in that game.
   */
  readonly store?: LatchStore;
  /** The factory default. `DEFAULTS.toggleMove`, not a hand-written `false`: there is ONE source (ADR-0029). */
  readonly byDefault?: boolean;
}

/**
 * RETURNS THE `playerEdge` THAT ALSO RESOLVES THE TOGGLE — to hand to `initKeydown` and `initTouchBindings` in place of
 * the raw one.
 *
 * ⚠️ IT RESOLVES AGAINST `inputOf(player).inUse` AND NOT `origin`, a difference of design and not of behaviour: today the
 * edge always sets in-use to the origin, so swapping one for the other is an EQUIVALENT mutation — recorded as such in the
 * gate, instead of pretending coverage. What the choice buys is the future: the state machine decides which device is in
 * use, and the day it gains a rule that REFUSES an edge (a webcam false positive being filtered, say) this line follows
 * it without being edited. Reading `origin` would be a second answer to the question `input/transport-in-use` exists to
 * answer.
 */
export function createLatchedEdge(
  getPlayers: () => readonly (LatchPlayer | null | undefined)[],
  opts: LatchedEdgeOptions = {},
): (player: number, origin: TransportName) => void {
  const latchStore = opts.store ?? store;
  const fallback = opts.byDefault ?? DEFAULTS.toggleMove;
  return (player: number, origin: TransportName): void => {
    playerEdge(player, origin);
    // 📌 THE PLAYER MAY NOT EXIST — a waiting screen, a seat not joined yet — and that does not make the edge invalid:
    // the transport in use is a fact about the INPUT and is recorded all the same. What does not happen is the second
    // half, because there is nowhere to write it.
    const p = getPlayers()[player];
    if (p) syncLatch(p, latchStore, player, inputOf(player).inUse, fallback);
  };
}
