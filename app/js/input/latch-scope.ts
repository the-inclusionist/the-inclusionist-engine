// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-scope — THE TOGGLE BELONGS TO A TRANSPORT, not to the child (ADR-0104 §C, issue #114).
//
// ========================= THE DEFECT THIS FIXES, WHICH HAD NO NAME =========================
// "Holding becomes toggling" was stored PER PLAYER — `incl_togglemove_p0` — that is: per person, and for every device
// at once. A child who turns the toggle on for the on-screen pad, because nobody holds a virtual button comfortably,
// turns it on for the keyboard too, where holding a key is exactly what they can do. They did not ask for that and
// nothing tells them.
//
// ⚠️ AND THE REPOSITORY ALREADY KNEW THE DEFECT WITHOUT NAMING IT: the run toggle is born off at the factory and switches
// itself on with the on-screen pad, which is CONTEXT and not choice. Context is exactly the word: the value depends on
// the device the child is on. Keeping it per person forced a separate mark (ADR-0029) to tell "turned on because they
// wanted" from "turned on because it is touch" — a mark compensating for a key in the wrong scope.
//
// The key mapping is already kept per transport, and always was. This is the same thing.
//
// ========================= AND FOR FOUR TRANSPORTS IT IS NO CHOICE AT ALL =========================
// ⚠️ Eyes, face, gestures and speech emit ONE COMMAND AT A TIME. There is no looking left and at the jump button at once;
// no saying two words simultaneously. On them the toggle is not a preference — it is the only way the control works, and
// offering it as an option would offer a child the choice of a control that does not work.
//
// This resolves, in passing, a tension ADR-0084 had with its own rule "a stored value means a choice": the toggle
// switching itself on for the camera was an exception to that rule. It no longer is, because on these transports it was
// never a stored value — it is a property of the transport.
//
// The rule was written before those four transports existed, so they arrived COVERED instead of arriving at an
// exception someone would have to remember to open.
//
// A leaf module: it imports nothing, not even the `platform/storage` whose keys it builds.

/**
 * The transports that emit ONE COMMAND AT A TIME, on which the toggle is always on.
 *
 * The values are transport names, which stay Portuguese like the rest of that vocabulary (`teclado`, `toque`): they are
 * stored, and renaming a stored value loses what the child saved.
 */
export const ONE_COMMAND_AT_A_TIME: ReadonlySet<string> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/**
 * Is the toggle always on for this transport?
 *
 * ⚠️ "Always on" and "on by default" are different things, and the difference is ADR-0104 §C's: a default can be changed,
 * and changing it here would make the control unusable. So the stored value is not even read on these transports — see
 * `latchOf`.
 */
export function latchAlwaysOn(transport: string): boolean {
  return ONE_COMMAND_AT_A_TIME.has(transport);
}

/**
 * Should the option be OFFERED for this transport?
 *
 * The opposite of `latchAlwaysOn`, with a name of its own because a different caller asks: one decides the state, the
 * other whether to draw the button. A panel that drew the button and ignored the click would be worse than not drawing it.
 */
export function latchIsOptional(transport: string): boolean {
  return !latchAlwaysOn(transport);
}

/**
 * The toggle's storage key, with the transport in its name.
 *
 * ⚠️ A FUNCTION, and not concatenation at the call site, for the reason `platform/storage` gives for the per-player keys:
 * as a function, no call site can write a crooked name. Not a hypothesis — the mobility panel once rewrote the per-player
 * key by hand, with a comment beside it saying it matched storage's. Two copies of a name change one at a time.
 *
 * `base` is `togglemove` or `togglerun`, the two names that already exist in the child's storage.
 */
export function latchKey(base: string, player: number, transport: string): string {
  return `incl_${base}_p${player}_${transport}`;
}

/**
 * The OLD key, per player and without a transport. Still read, never written again.
 *
 * ⚠️ IT IS INHERITED BY EVERY TRANSPORT, and the choice takes a sentence to explain. The old value was set by the child in
 * some context, and there is no way to know which — the key did not record it, which is the defect. The ways out were
 * three: lose their setting, guess a transport, or inherit for all. Inheriting for all is the only one that takes nothing
 * from whoever depends on the setting, and the leak it keeps lasts only until the child touches the setting once on each
 * device. Losing the setting would cost more, and to whoever can least afford it.
 *
 * It is also the pattern this repository chose for this same value before: the old key stays where it is — it is the
 * child's data, not mine to delete, and keeping it is what makes a way back possible.
 */
export function legacyLatchKey(base: string, player: number): string {
  return `incl_${base}_p${player}`;
}

/** What is known when resolving a transport's toggle. */
export interface LatchReading {
  /** What is stored for THIS transport. `null` = never written. */
  readonly fromTransport: boolean | null;
  /** What is stored under the old key, without a transport. `null` = never written. */
  readonly fromLegacy: boolean | null;
  /** The factory default (`DEFAULTS.toggleMove` / `DEFAULTS.toggleRun`). */
  readonly byDefault: boolean;
}

/**
 * This transport's toggle, resolved.
 *
 * The order: one-command transport → ALWAYS on, and nothing else is read · this transport's value · the legacy value ·
 * the factory default.
 *
 * ⚠️ THE ONE-COMMAND TRANSPORT COMES FIRST, and not as a shortcut: if it read the stored value first, a child who had
 * turned the toggle off on the keyboard would inherit that `false` through the legacy key and be left with a gaze control
 * that does not respond — the worst defect possible, on the control of whoever has fewest alternatives.
 */
export function latchOf(transport: string, l: LatchReading): boolean {
  if (latchAlwaysOn(transport)) return true;
  if (l.fromTransport !== null) return l.fromTransport;
  if (l.fromLegacy !== null) return l.fromLegacy;
  return l.byDefault;
}
