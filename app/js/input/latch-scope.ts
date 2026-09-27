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
// ========================= ON FOUR TRANSPORTS THE GAME SETS THE DEFAULT (ADR-0249) =========================
// Eyes, face, gestures and speech emit ONE COMMAND AT A TIME: a word or a look is a tap, never a hold. Whether that tap
// should keep going is the GAME's to say — in a platform game «direita» keeps the character walking, in a quiz «abaixo»
// moves the cursor once — and the game already says it: `GameDeclaration.holdsKeys()`. So on these four the latch STARTS
// as the game answers, and the child's stored choice for that transport, when there is one, wins (ADR-0104 §C: a default
// is not a lock). Keyboard, pad and touch keep the factory default and the legacy inheritance below.
//
// A leaf module: it imports nothing, not even the `platform/storage` whose keys it builds.

/**
 * The transports that emit ONE COMMAND AT A TIME, on which the latch's default is the game's `holdsKeys()` (ADR-0249).
 *
 * The values are transport names, which stay Portuguese like the rest of that vocabulary (`teclado`, `toque`): they are
 * stored, and renaming a stored value loses what the child saved.
 */
export const ONE_COMMAND_AT_A_TIME: ReadonlySet<string> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/**
 * Does this transport's latch start where the GAME says (ADR-0249)?
 *
 * `true` on the four one-command transports: with nothing stored for them, the latch is the game's `holdsKeys()`. The
 * option is offered on every transport alike; this answers only where the default comes from.
 */
export function latchDefaultFromGame(transport: string): boolean {
  return ONE_COMMAND_AT_A_TIME.has(transport);
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
 * ⚠️ IT IS INHERITED BY THE KEYBOARD, THE PAD AND TOUCH, and the choice takes a sentence to explain. The old value was set
 * by the child in some context, and there is no way to know which — the key did not record it, which is the defect. The
 * ways out were three: lose their setting, guess a transport, or inherit for all. Inheriting is the only one that takes
 * nothing from whoever depends on the setting, and the leak it keeps lasts only until the child touches the setting once
 * on each device. Losing the setting would cost more, and to whoever can least afford it.
 *
 * 📌 NOT BY THE FOUR ONE-COMMAND TRANSPORTS (ADR-0249): there the default is the game's answer, and a value the child set
 * on the keyboard is not a choice about how a spoken word or a look should behave in this game.
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
  /**
   * THE GAME'S ANSWER, NOW: `GameDeclaration.holdsKeys()` (ADR-0249). The default on the one-command transports.
   *
   * ⚠️ READ WHEN THE LATCH IS RESOLVED, not once at boot: a game changes it between stages (ADR-0084), and a latch resolved
   * from a stale answer would keep a quiz stage latched because the stage before it held keys. REQUIRED, like `holdsKeys`
   * itself: both values can be wrong, so there is no safe default to fall back on.
   */
  readonly gameHoldsKeys: boolean;
}

/** The two defaults a resolution needs from outside storage — the factory's and the game's. */
export type LatchDefaults = Pick<LatchReading, 'byDefault' | 'gameHoldsKeys'>;

/**
 * This transport's toggle, resolved.
 *
 * The order: this transport's stored value · on a one-command transport, the game's `holdsKeys()` · the legacy value ·
 * the factory default.
 *
 * ⚠️ THE STORED VALUE COMES FIRST ON EVERY TRANSPORT (ADR-0249): the child's choice for this device wins over any default,
 * including the game's. And a stored `false` is a VALUE, not an absence — the `!== null` is what keeps a latch the child
 * turned off from coming back by itself.
 */
export function latchOf(transport: string, l: LatchReading): boolean {
  if (l.fromTransport !== null) return l.fromTransport;
  if (latchDefaultFromGame(transport)) return l.gameHoldsKeys;
  if (l.fromLegacy !== null) return l.fromLegacy;
  return l.byDefault;
}
