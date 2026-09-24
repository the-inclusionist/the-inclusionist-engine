// SPDX-License-Identifier: AGPL-3.0-or-later
// input/synthetic-source.ts — WHO DISPATCHED THIS KEY, when it was not a finger on a keyboard (ADR-0109).
//
// ========================= THE HARD PART OF THE EDGE, AND IT WAS NAMED =========================
// The gate `tests/the-keys-source-survives-the-door` has named it since the funnel began: a synthetic `KeyboardEvent`
// enters through `keydown` and would be stamped as the keyboard — the erasure coming back through the front door. Today
// the engine's only synthetic key is the menu key the pad and the virtual controller hand to the menus.
//
// `isTrusted` tells PRESSED from DISPATCHED — the one property a script cannot forge — but not WHICH assisted transport
// dispatched it. That has to arrive DECLARED, and that is what this module is.
//
// ⚠️ WHY THE STAMP TRAVELS ON THE EVENT, and not in an injected "what is the synthetic source now?". The injected answer
// is GLOBAL state, and input is not global: a child playing by gaze with an adult pressing a key beside them produces both
// edges at the same instant, and global state would stamp both as gaze. The event cannot be confused with itself — the
// origin travels with the edge it belongs to, the same reason the key source is a map by CODE and not a single field.
//
// 📌 And it is additive by construction: an unstamped event still works. That is what let the writers migrate one at a
// time without a single red commit in between.

import type { TransportName } from './transport-in-use.js';
import { isTransportName } from './transport-in-use.js';

/**
 * The property hung on the event.
 *
 * 📌 Prefixed and ugly on purpose: it is an expando on an object that is not ours, and a short name could collide with
 * another library's without anything saying so.
 */
export const SOURCE_KEY = '__vpOrigem';

/**
 * The minimum this module reads from a key event — STRUCTURAL, so a real `KeyboardEvent` and a test double both serve.
 *
 * ⚠️ `isTrusted` is OPTIONAL, and its absence is not `false` by accident: a double that does not declare it is saying "I
 * asserted nothing about this", and the right answer to that is `undefined`, not the keyboard. The same rule as
 * `input/state`'s `sourceOf`, one layer up.
 */
export interface KeyEventLike {
  readonly isTrusted?: boolean;
}

/**
 * DECLARES that this event came from that device. Returns the event itself, so the dispatch fits on one line.
 *
 * ⚠️ Stamp it BEFORE dispatching. After `dispatchEvent` the listeners have already run, and the stamp would reach an
 * event nobody reads any more.
 */
export function stampSource<T extends object>(ev: T, source: TransportName): T {
  (ev as unknown as Record<string, unknown>)[SOURCE_KEY] = source;
  return ev;
}

/**
 * WHO PRODUCED THIS EVENT? `undefined` when it is not known.
 *
 * The whole rule, in three lines and in this order:
 *
 *   1. **A valid stamp wins.** An explicit declaration always beats an inference — inverting it would make a REAL event
 *      someone remapped (a pedal, a sip-and-puff switch that emits real keys) read as the keyboard, erasing exactly the
 *      information whoever stamped it took the trouble to put there.
 *   2. **No stamp but trusted → `'teclado'`.** That is what `isTrusted` means: the browser saw the person press. It is the
 *      one inference this module makes, and it makes it on the property that cannot be forged.
 *   3. **No stamp and not trusted → `undefined`.** A synthetic event nobody signed. Nothing in this engine produces one;
 *      code from outside does, and code from outside did not declare. ⚠️ Returning the keyboard here would be the erasure
 *      coming back another way, the defect the whole of ADR-0109 exists to close — and worse than the original, because
 *      it would have the shape of an answer.
 */
export function sourceOfEvent(ev: KeyEventLike): TransportName | undefined {
  const declared = (ev as unknown as Record<string, unknown>)[SOURCE_KEY];
  if (isTransportName(declared)) return declared;
  return ev.isTrusted ? 'teclado' : undefined;
}
