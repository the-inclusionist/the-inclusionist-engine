// SPDX-License-Identifier: AGPL-3.0-or-later
// input/transport-in-use — THE LATCH FOLLOWS THE DEVICE IN USE (ADR-0109), the pure half.
//
// ========================= WHAT THIS MODULE IS =========================
// The automaton of ADR-0109 §1's four rules, with no DOM, no storage and no events. It takes EDGES with their
// origin and returns state; whoever asks "is latching on now?" asks the state.
//
//   1. By default, pad and keyboard, both WITHOUT latching.
//   2. A mouse click or a touch on the screen → on-screen controls WITH latching.
//   3. Pressing a key returns the keyboard WITHOUT latching; using the pad does the same.
//   4. Camera and microphone have to be enabled; once enabled, they turn latching on for ALL the other
//      controls, with NO way to turn it off. They take priority.
//
// ⚠️ WHY THIS IS AN AUTOMATON AND NOT A STORED VALUE — and it is what ADR-0109 supersedes of ADR-0104 §C.
// Latching was a CHOICE stored per transport, and issue #114 measured that its wiring could not be written: the
// edge's origin is erased at the door (`input/state.keys` is a `Set<string>` of CODES, and touch and the webcam
// write into it). The Dev decided the BEHAVIOUR, and the behaviour picks the mechanism.
//
// ⚠️ AND RULE 3 IS WHY IT TAKES TWO THINGS, not one. "Pressing a key returns the keyboard without latching" is
// TWO facts: an EVENT whose origin must be known, and a MODE that persists until the next switch. An edge keeps
// no state; a stored mode does not detect its own switch. Neither half expresses the rule; together they do.
// This file is the second half — the MODE.
//
// 📌 The Dev's image, kept because it says the thing: it is a CAPS LOCK ON A KEYBOARD WITH MEMORY. A mode and
// not a momentary state; remembered per device; switching devices does not erase what the other remembers.

/**
 * The devices a child plays through. Closed: a new transport has to decide its rule here.
 *
 * The values stay Portuguese because they are stored — `latch-scope.latchKey` puts the transport name in the
 * key — and renaming a stored value loses what the child saved.
 */
export type TransportName = 'teclado' | 'gamepad' | 'toque' | 'olhos' | 'rosto' | 'gestos' | 'fala';

/**
 * THE UNION AS A VALUE, because there is one place where it has to be checked at runtime.
 *
 * ⚠️ IT EXISTS BECAUSE OF A BOUNDARY, and that is the only reason that justifies it: `input/synthetic-source`
 * reads the transport from an EXPANDO hung on a `KeyboardEvent` — an object this code did not build and that
 * any script on the page can build. A value crossing that boundary is not a `TransportName` because TypeScript
 * says so; it is a `string` until someone checks it. Without the list, `'olho'` would enter the origin map as a
 * phantom transport, and nothing would say so.
 *
 * 📌 This is not the list-beside-the-union defect this repository has already undone three times (`RM_KEYS`,
 * the reduced-motion labels, the storage keys), because the guard below belongs to the COMPILER: the two cannot
 * diverge. A copy that cannot diverge is a projection, not a second source.
 */
export const TRANSPORT_NAMES = ['teclado', 'gamepad', 'toque', 'olhos', 'rosto', 'gestos', 'fala'] as const;

// `[X] extends [never]` and not `X extends never`: the conditional distributes over `never` and would give
// `never` instead of answering the question. Same shape as `_COVERS_THE_UNION` in `ui/motion-scene`.
type _MissingTransport = Exclude<TransportName, (typeof TRANSPORT_NAMES)[number]>;
type _ExtraTransport = Exclude<(typeof TRANSPORT_NAMES)[number], TransportName>;
const _COVERS_THE_TRANSPORTS: [_MissingTransport] extends [never]
  ? ([_ExtraTransport] extends [never] ? true : false)
  : false = true;
void _COVERS_THE_TRANSPORTS;

/**
 * Is this thing that came from outside really a transport?
 *
 * ⚠️ The question is not about security — every script on this page is ours, and whoever wanted to lie would
 * use a VALID value. It is about correctness: it keeps a wrong or missing stamp from becoming a silent entry in
 * `keySource`, the structure the whole latch depends on.
 */
export function isTransportName(v: unknown): v is TransportName {
  return typeof v === 'string' && (TRANSPORT_NAMES as readonly string[]).includes(v);
}

/**
 * THE FOUR THAT REQUIRE EXPLICIT ENABLING and, once enabled, rule over all the others (rule 4).
 *
 * ⚠️ It is the same list as `ONE_COMMAND_AT_A_TIME` in `input/latch-scope`, and the match is no accident: these
 * are the transports of whoever CANNOT HOLD ANYTHING. What ADR-0109 adds is that they do not turn latching on
 * only for themselves — they turn it on for the rest, because whoever uses the webcam may also touch the screen,
 * and a latch that turns off when the device changes is a trap for exactly that person.
 */
export const NEED_ENABLING: ReadonlySet<TransportName> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/** The transport that turns latching on by itself, with no priority involved (rule 2). */
export const LATCH_OF_THEIR_OWN: ReadonlySet<TransportName> = new Set(['toque']);

export interface InputState {
  /** Which device this player is using NOW. */
  readonly inUse: TransportName;
  /**
   * Was the camera/microphone enabled? ⚠️ Once `true`, it NEVER goes back to `false` through an edge — only an
   * explicit decision turns it off, and ADR-0109 §4 says the child does not own that decision. See
   * `disableAssisted`.
   */
  readonly assistedOn: boolean;
}

/**
 * THE INITIAL STATE: keyboard, without latching.
 *
 * ⚠️ Rule 1 says "pad AND keyboard, both without latching", and that is why the default can name just one
 * without lying: between the two, the answer to the only question this module asks — is latching on? — is the
 * SAME. `inUse` only starts telling them apart when someone wants to SHOW the current device, which is another
 * question, and ADR-0109 explicitly leaves it undecided.
 */
export const DEFAULT_INPUT_STATE: InputState = Object.freeze({ inUse: 'teclado', assistedOn: false });

/**
 * IS LATCHING ON NOW? — ⚠️ **DO NOT ASK THIS FUNCTION.** See the paragraph below.
 *
 * ⚠️ The assisted priority comes FIRST, and the order is the whole of rule 4: while it is on, no other device
 * turns latching off — not even the keyboard, which otherwise would. Swapping these two lines is the defect that
 * would lock a child out of their own game, and it is silent.
 *
 * @deprecated 🔴 **THIS FUNCTION IMPLEMENTS THE MODEL ADR-0113 SUPERSEDED**, and stays exported because it is
 * published surface (`./input/*.js`) and because the record has historical value — not because it is the answer.
 *
 * ADR-0109 decided latching **by device alone**: assisted on → yes; touch → yes; everything else → no. ADR-0113
 * withdrew that clause, with the Dev's reason: latching is a **caps lock stored with the controller's mapping**,
 * and the value the child saved counts.
 *
 * 🔴 THE DIVERGENCE HAS A CONCRETE CHILD, and it is the one who prompted the record: someone with a motor
 * difficulty who plays on the KEYBOARD and saved latching on. This function returns `false` for them —
 * `teclado` is not in `LATCH_OF_THEIR_OWN` — and that is exactly the control they would lose.
 * `latch-scope.latchOf` returns `true`, because it reads what they saved.
 *
 * ⚠️ AND THE TOUCH CLAUSE FELL TOO: under ADR-0113 touch is a transport like the others — its value is a choice
 * and is stored. Only eyes, face, gestures and speech may refuse to turn OFF, and that half lives in
 * `latch-scope.latchAlwaysOn`, with a different set from this one and answering a different question.
 *
 * **The right answer is `latch-scope.latchOf(inputState.inUse, reading)`.** The role left to this module is
 * what its name says: WHICH transport is in use — which is what feeds that first argument.
 * `tests/latching-per-transport.node.test.js` asserts this function still has no consumer.
 */
export function latchNow(inputState: InputState): boolean {
  if (inputState.assistedOn) return true;
  return LATCH_OF_THEIR_OWN.has(inputState.inUse);
}

/**
 * AN EDGE ARRIVED, with its origin. Returns the NEW state.
 *
 * ⚠️ An edge from an assisted transport does NOT enable it. Enabling is an explicit act (rule 4: they "have to
 * be enabled"), and letting an edge do it would mean a webcam false positive — a shadow, a second face passing
 * by — locked latching on for everyone without anyone asking.
 */
export function afterEdge(inputState: InputState, origin: TransportName): InputState {
  if (inputState.inUse === origin) return inputState; // no change: returns the SAME object, not a copy
  return { inUse: origin, assistedOn: inputState.assistedOn };
}

/** The child (or whoever is with them) enabled the camera/microphone. From here on, latching is law. */
export function enableAssisted(inputState: InputState): InputState {
  return inputState.assistedOn ? inputState : { inUse: inputState.inUse, assistedOn: true };
}

/**
 * DISABLE the assisted transports. It exists, and ADR-0109 says whose it is: NOT the child's during a match.
 *
 * ⚠️ It stays exported because turning the camera off has to be possible somewhere — switching users, closing
 * the game, an adult reconfiguring. What §4 forbids is offering it as a button beside the game. A function that
 * exists and is not offered differs from a function that does not exist: the first says where the decision
 * lives.
 */
export function disableAssisted(inputState: InputState): InputState {
  return inputState.assistedOn ? { inUse: inputState.inUse, assistedOn: false } : inputState;
}
