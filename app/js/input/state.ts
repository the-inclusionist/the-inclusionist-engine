// SPDX-License-Identifier: AGPL-3.0-or-later
// input/state.ts — runtime input STATE + a generic query, shared by the writers that mutate these objects IN
// PLACE (the virtual controller through the root, `input/keydown`, `input/gamepad`): held keys (keys), pad state per
// controller (padCur/padPrevAct/padPrevStart) and the stick's dead zone (PAD_DEAD). held(pl,act) = the player is
// holding the action, on the keyboard (pl.ctrl) OR on the pad assigned to them (pl.pad).

// Physical keys held NOW (KeyboardEvent.code).
import type { ControlledPlayer } from '../core/entity.js';
import type { Action } from '../core/actions.js';
// The two above are type-only and vanish in the build. This one is not, and enters for the reason the vocabulary lives
// where it does: with whoever has the RULES about it (`input/transport-in-use`, a leaf) — repeating it here would be a
// second copy of a union.
import {
  DEFAULT_INPUT_STATE, afterEdge, enableAssisted, disableAssisted,
  type TransportName, type InputState,
} from './transport-in-use.js';

export const keys = new Set<string>();

/**
 * THE SOURCE OF EACH HELD KEY — code → the device that produced it (ADR-0109).
 *
 * ⚠️ THIS MAP EXISTS BECAUSE `keys` ERASES THE SOURCE AT THE DOOR (issue #114): it is a set of CODES, and several
 * transports hold keys in it — the keyboard, and the virtual controller for a position the eyes, the face, the hands
 * or the voice pressed — so by the time `held()` answers there is no telling WHO pressed. The pad keeps its own
 * identity only because it goes through `padCur` instead of the set.
 *
 * ⚠️ THE TWO ARE WRITTEN IN ONE PLACE (`markKey`/`releaseKey` and their siblings below), because they are two
 * structures and may drift apart.
 *
 * 📌 A code with NO entry here is not a data error — it is a key nobody signed, and every real key from the keyboard
 * is one: an event the child produced carries no stamp. `sourceOf` returns `undefined` and whoever asks decides; see
 * the note there.
 */
export const keySource = new Map<string, TransportName>();

/**
 * A key WAS PRESSED, and who pressed it is known. The only place that writes both.
 *
 * ⚠️ BOTH TOGETHER OR NEITHER: while they are two structures they can drift apart, and a drift here is silent — the
 * game keeps moving and only the latch goes wrong. That is why this module has no public `keys.add`: whoever writes,
 * writes through here.
 */
export function markKey(code: string, origin: TransportName): void {
  keys.add(code);
  keySource.set(code, origin);
}

/**
 * The key was pressed and WHO pressed it is NOT KNOWN. The narrow door, and it is narrow on purpose.
 *
 * ⚠️ WHY A FUNCTION WITH ANOTHER NAME AND NOT AN OPTIONAL SECOND PARAMETER. `markKey(code)` with the source left out
 * is what gets written without thinking; `markKeyWithoutSource(code)` is what gets written after thinking, when the
 * answer is "I don't know". The type does not tell the two apart, but the name does — and the name is what shows in
 * review. A forgotten parameter cannot be read; a function called this can be read from afar.
 *
 * ⚠️ AND THE `delete` IS THE HALF THAT MATTERS, not the `add`. Without it, a key pressed again by an unknown source
 * INHERITED the source of the time before: the child plays by gaze, lets go of the key, something else dispatches the
 * same code, and the latch keeps answering "eyes" to an edge that is no longer theirs. A map that keeps yesterday's
 * right answer is worse than one that keeps nothing.
 *
 * 📌 Every real key comes through here, since an event the child produced carries no stamp: `input/keydown` calls it
 * directly, and the root reaches it through `markKeyFrom` when the virtual controller holds an unsigned key.
 */
export function markKeyWithoutSource(code: string): void {
  keys.add(code);
  keySource.delete(code);
}

/**
 * The key was pressed and the CALLER MAY NOT KNOW by whom — it picks the right one of the two doors above.
 *
 * ⚠️ IT IS NOT `markKey` WITH AN OPTIONAL SOURCE, and the difference is the one `markKeyWithoutSource`'s comment
 * argues: a forgotten parameter cannot be read, and this signature demands the union EXPLICITLY. Whoever knows who
 * pressed keeps calling `markKey`; this one is for whoever receives the answer from someone else and cannot pretend
 * to have it.
 *
 * 🔴 It exists because that choice was written TWICE with the same sentence beside it — in `input/keydown` and, since
 * ADR-0223's single door, in the root, where the virtual controller holds the key of every transport. Two copies of a
 * rule are two chances to diverge, and this one has an expensive side: inheriting yesterday's source answers "eyes"
 * to an edge that is no longer theirs.
 * 📌 `input/keydown` receives the two doors through its ctx, so it adopts this one when that ctx changes for another
 * reason — changing it for this alone would break every cartridge that mounts the keyboard.
 */
export function markKeyFrom(code: string, source: TransportName | undefined): void {
  if (source) markKey(code, source); else markKeyWithoutSource(code);
}

/** The other half. Lets go in both, for the same reason. */
export function releaseKey(code: string): void {
  keys.delete(code);
  keySource.delete(code);
}

/**
 * Lets go of EVERYTHING — both structures, or the map is left describing keys nobody holds any more.
 *
 * ⚠️ The window's `blur` does NOT use this: a blur owes a keyup only to what the keyboard holds, and the keyup has to
 * be heard by everything that counts presses — see `letGoOfTheKeyboard` below.
 */
export function releaseAllKeys(): void {
  keys.clear();
  keySource.clear();
}

/**
 * Hands `release` every key THE KEYBOARD holds — the ones the window's `blur` owes a keyup, because no keyup will reach
 * the page once it has lost focus.
 *
 * ⚠️ ONLY THE KEYBOARD'S: a key with no source (a real key carries none) or the keyboard's own stamp. A camera or voice
 * press does not depend on the window's focus — the camera keeps reading — and letting go of it would take a held
 * position from whoever cannot press it again quickly.
 *
 * 📌 It hands out codes and does not release them itself: the release has to travel the road a real keyup travels, so
 * everything that counts presses (the simulations, the cool-down, the virtual controller) hears it. Which road that is
 * belongs to the root.
 */
export function letGoOfTheKeyboard(release: (code: string) => void): void {
  for (const code of [...keys]) {
    const source = keySource.get(code);
    if (!source || source === 'teclado') release(code);
  }
}

/**
 * Who produced this key? `undefined` when it is not known.
 *
 * ⚠️ `undefined` AND NOT A DEFAULT. A `'teclado'` default would bring the erasure back through another door: an
 * unsigned key from a producer this engine does not know would be read as the keyboard, the latch would turn off for
 * whoever plays by gaze, and nothing would say so. Not knowing is an answer; pretending to know is not.
 */
export function sourceOf(code: string): TransportName | undefined {
  return keySource.get(code);
}

// ===================== THE TRANSPORT IN USE, PER PLAYER (ADR-0109 · ADR-0113) =====================
//
// ⚠️ HERE AND NOT ON `PlayerBase`, and the choice is measured. The automaton answers "which device is producing this
// player's edges" — that is INPUT state, and input already keeps per-player state in this module in exactly this
// shape: `padCur` just below is a `Record<number, …>`. Putting it on `PlayerBase` would make it part of the CONTRACT,
// and every cartridge would have to declare a field it decides nothing about.
//
// 📌 What the player CARRIES is the resolved latch (`toggleMove`), which is what the physics reads. This map is what
// sits upstream of it: with it and `input/latch-store`, ADR-0113's answer is complete.
const inputByPlayer: Record<number, InputState> = {};

/**
 * THIS PLAYER'S INPUT STATE. Never `undefined`: whoever never produced an edge is at the DEFAULT.
 *
 * ⚠️ `DEFAULT_INPUT_STATE` AND NOT `undefined`, for the same reason `sourceOf` does the opposite: there, "I don't know"
 * is an honest answer about a key that exists; here the question is about a PLAYER, and a player who has not touched
 * anything yet really is on the keyboard with nothing assisted — which is what `DEFAULT_INPUT_STATE` says.
 */
export function inputOf(player: number): InputState {
  return inputByPlayer[player] ?? DEFAULT_INPUT_STATE;
}

/**
 * AN EDGE FROM THIS PLAYER ARRIVED, with its source.
 *
 * 📌 `afterEdge` returns the SAME object when nothing changes, so storing it back allocates nothing per frame.
 * ⚠️ And an edge from an assisted transport does NOT enable it — that rule lives in `afterEdge` with its reason: a
 * webcam false positive would lock latching on for everyone without anyone asking.
 */
export function playerEdge(player: number, origin: TransportName): void {
  inputByPlayer[player] = afterEdge(inputOf(player), origin);
}

/** Enabling the assisted transports is an EXPLICIT ACT (ADR-0109 rule 4), and so it has its own door. */
export function enableAssistedFor(player: number): void {
  inputByPlayer[player] = enableAssisted(inputOf(player));
}

export function disableAssistedFor(player: number): void {
  inputByPlayer[player] = disableAssisted(inputOf(player));
}

/**
 * ⚠️ FORGETTING IS A SEPARATE DOOR, AND LETTING GO OF KEYS DOES NOT CALL IT — on purpose.
 *
 * The window's `blur` lets go of the keyboard's keys because they really stopped being pressed. But the child did not
 * change devices by changing tabs: resetting the transport in use there would send everyone back to the keyboard, and
 * whoever plays by gaze would lose latching mid-match with nothing saying so. It exists for the end of a MATCH, where
 * the question is asked again.
 */
export function forgetInputs(): void {
  for (const k of Object.keys(inputByPlayer)) delete inputByPlayer[Number(k)];
}

// Gamepad: padCur[gi] = actions held this frame; padPrevAct/padPrevStart = the previous frame's edge.
// The pad↔player assignment lives in p.pad. Mutated IN PLACE by `input/gamepad`'s `pollPads`.
type PadState = Record<string, boolean>;
export const padCur: Record<number, PadState> = {};
export const padPrevAct: Record<number, PadState> = {};
export const padPrevStart: Record<number, boolean> = {};
export const PAD_DEAD = 0.5; // dead zone = the first HALF of the stick's travel (ergonomics — the Dev's decision)

// The minimum player contract `held` needs — DERIVED from core/entity. `ControlledPlayer` because `held` is only
// called during a match, when assignControls has run and `ctrl` is no longer `null`.
type HeldPlayer = Pick<ControlledPlayer, 'ctrl' | 'pad'>;

// Is the player holding the action? keyboard (some code in the pl.ctrl scheme) OR the assigned pad (pl.pad).
// ⚠️ `?? []` and not a raw `pl.ctrl[act]`: since issue #118 a position the keyboard DOES NOT REACH is a declared
// `null` — on a keyboard split four ways there is no physical room for shoulders and triggers. Holding an action the
// keyboard does not reach is `false`, and the pad is asked right after: whoever has a pad reaches what their keyboard
// does not, which is the point of having two transports.
export const held = (pl: HeldPlayer, act: Action): boolean =>
  (pl.ctrl[act] ?? []).some((k) => keys.has(k)) || (pl.pad >= 0 && !!padCur[pl.pad]?.[act]);
