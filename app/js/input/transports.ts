// SPDX-License-Identifier: AGPL-3.0-or-later
// input/transports — THE TRANSPORT REGISTRY (ADR-0079). A leaf module: only types and arithmetic.
//
// ========================= WHAT A TRANSPORT IS =========================
// A way of reaching the actions, and nothing about meaning. It declares what it OFFERS PHYSICALLY — how many
// assignable places it has — and the player assigns the game's actions to them. `TOUCH_DEFAULT` was already an
// instance of this before the model existed: a default assignment the child can change.
//
// ========================= THE GUARANTEE CHANGED SHAPE =========================
// ⚠️ It is NOT "every transport reaches every action". It is: **of the transports available to this child, AT
// LEAST ONE carries this game's set of actions.** The difference is what lets a narrow transport exist — a
// two-tap switch, a blink — without it failing the whole product.
//
// ========================= AND A TRANSPORT NEVER REMOVES ANOTHER =========================
// Choosing the mouse does not turn off the keyboard, the pad or touch. The engine OFFERS; the one who chooses is the
// child (or whoever is with them). A method that demands fine coordination is not exclusion while the others exist
// — exclusion would be a short list, not a demanding item in a long one.
//
// ========================= WHAT THIS MODULE EXISTS TO PREVENT =========================
// ⚠️ A game that needs twelve actions and a transport with fewer places is a REAL combination — the on-screen
// control has thirteen slots and the action set has fourteen. The honest answer is ONE SENTENCE BEFORE STARTING,
// not half a playable screen: the child who discovers midway that they cannot reach an action concludes the game is
// broken, and they have no way of knowing it is not.

import { ACTIONS, type Action } from '../core/actions.js';

/**
 * HOW MANY PLACES EACH REAL TRANSPORT HAS, and where each number comes from. They were measured and lived only in
 * the test; a number that exists only in a test reaches no child.
 *
 *   · `gamepad: 17` — the Gamepad API's "standard" mapping declares seventeen buttons. Not our choice.
 *   · `toque: 13` — `TOUCH_DEFAULT` (input/devices) names thirteen slots: the nine plus ADR-0160's four shoulders.
 *   · `teclado: ACTIONS.length` — ⚠️ and this is the one that needed a decision.
 *
 * ⚠️ THE KEYBOARD'S NUMBER IS NOT THE NUMBER OF KEYS, nor the number of bindings in the current scheme. Not the keys,
 * because a hundred keys are not a hundred places a child finds and remembers; not the scheme, because the scheme
 * grows, and the limit would become the configuration instead of the device.
 *
 * It is `ACTIONS.length` because what limits a keyboard, in this product's practice, is THE VOCABULARY THE ENGINE
 * CAN NAME: a transport that covers every position that exists cannot be the short one. Derived and not written by
 * hand on purpose — when the vocabulary grows (it went from nine to fourteen), this number grows with it and never
 * starts lying.
 */
export const SLOTS = Object.freeze({ gamepad: 17, toque: 13, teclado: ACTIONS.length });

/**
 * HOW MANY POSITIONS THE ON-SCREEN CONTROL HOLDS AT ONCE. Two, and it is a DECLARATION (ADR-0104 §B).
 *
 * ⚠️ AND THE DECISION IS NOT TO ASK THE DEVICE. `navigator.maxTouchPoints` exists, answers fast, and LIES — upwards:
 * many devices announce five and recognise two. A model built on it fails exactly on the public school's cheap
 * phone, which is this project's pillar 1, and fails silently: the child tries to run and jump at once, nothing
 * happens, and they conclude the game is broken.
 *
 * A declared floor cannot err upwards. It errs downwards — a device that held three is served by two —, and that
 * error has a fix: the third-button option, PROVEN BY A TEST, because a real gesture is the only evidence a device
 * cannot fake. Nothing is refused and nothing is assumed.
 *
 * ⚠️ IT IS NOT A REGISTRY OF CEILINGS PER TRANSPORT, and the ADR says so in `more-information`: only touch has a
 * declared number. `Transport.holds` is optional precisely for that — absent means "no known ceiling", not "holds
 * one". A ceiling registry for keyboard and pad is a bigger change, and nothing needs it today.
 */
const HOLDS_TOUCH = 2;

/** How each transport is found to be here NOW. Injected: none of these questions is pure. */
export interface Availability {
  gamepad: () => boolean;
  touch: () => boolean;
  keyboard: () => boolean;
  /**
   * Is there a MOUSE here? (ADR-0112)
   *
   * ⚠️ IT IS NOT A TRANSPORT OF ITS OWN, which is why it enters as a question and not as a fourth line of
   * `defaultTransports`: a mouse alone does not carry the fourteen positions. It is the CONTINUOUS SIGNAL beside the
   * keyboard — the Dev's sentence, «no caso do teclado, o sinal contínuo passa a ser o mouse» —, and it is what gives
   * a foundation to ADR-0074's transports 8 and 9, which that record declared as having none.
   */
  mouse: () => boolean;
}

/**
 * The three transports this engine knows how to offer today.
 *
 * ⚠️ THE KEYBOARD DETECTION IS IMPRECISE AND THAT IS ACCEPTABLE — but only because the screen that consumes this
 * INFORMS instead of REFUSING. No API says "a physical keyboard is plugged in"; what the root asks is
 * `pointer:coarse && hover:none`, and a tablet WITH a keyboard answers "touch" to that. If the screen blocked, that
 * tablet would get a false refusal in a game it plays. Since it only says what is missing and lets the child go on,
 * the error costs one extra sentence and never a closed door.
 */
export function defaultTransports(d: Availability): Transport[] {
  return [
    // ⚠️ THE GAMEPAD DECLARES NO POINTER, and the absence is measured, not forgotten: the stick has the continuous
    // signal and the engine throws it away at the source (`PAD_DEAD = 0.5`, `PadState = Record<string, boolean>`).
    // Wiring it to the pointer is possible and brings back a question ADR-0112 already named — half the travel dead is
    // the right ergonomics for a BUTTON and the wrong one for a CURSOR.
    { id: 'gamepad', slots: SLOTS.gamepad, available: d.gamepad },
    // The keyboard points WHEN THERE IS A MOUSE — the Dev's clause, and the foundation of ADR-0074's transports 8 and 9.
    { id: 'teclado', slots: SLOTS.teclado, available: d.keyboard, points: d.mouse },
    // Touch points by nature: the surface IS the pointer, and it is the same finger that presses the buttons.
    { id: 'toque', slots: SLOTS.toque, holds: HOLDS_TOUCH, available: d.touch, points: d.touch },
  ];
}

/** A transport, as it declares itself. Zero meaning: how many places, and whether it is here now. */
export interface Transport {
  /** A stable identifier, for saved preferences. Never reaches a person. */
  readonly id: string;
  /** How many ASSIGNABLE places. It is the number the guarantee's arithmetic uses. */
  readonly slots: number;
  /**
   * How many positions it HOLDS AT ONCE, when that is known. A different axis from `slots`: the on-screen control
   * has thirteen places and holds two.
   *
   * ⚠️ ABSENT MEANS "NO KNOWN CEILING", not "holds one". Today only touch declares a number (`HOLDS_TOUCH`), because
   * only about it is there a decision — see the note there. Reading the absence as zero would make every transport
   * without a number suddenly fail, which is the opposite of what an optional field should do.
   */
  readonly holds?: number;
  /**
   * Is it available ON THIS device, NOW? A function and not a value: a pad gets plugged in mid-match, and a touch
   * screen appears when the child turns the tablet.
   */
  readonly available: () => boolean;
  /**
   * Does this transport offer a POINTER — a continuous position (ADR-0112)?
   *
   * ⚠️ A FUNCTION AND NOT A BOOLEAN, for the same reason written on `available` above: a mouse gets plugged in
   * mid-match, just like a pad. A fixed value here would answer with the state at boot.
   *
   * ⚠️ ABSENT MEANS "DOES NOT OFFER", and here — unlike `holds` — reading the absence that way is right: the pointer
   * is a capability one DECLARES, and a transport that does not declare it does not have it. `holds` is the opposite
   * because there the absence is "no known ceiling", and reading it as zero would fail everyone.
   */
  readonly points?: () => boolean;
}

/** Does this transport carry this set of actions? Arithmetic, as ADR-0079 §3 describes it. */
export function carries(t: Transport, actions: readonly Action[]): boolean {
  return t.slots >= actions.length;
}

/**
 * Does this transport HOLD as many as the game asks at once? (ADR-0104 §A.)
 *
 * ⚠️ A TRANSPORT WITH NO DECLARED CEILING ANSWERS YES, and the choice is deliberate: an absent `holds` means "we did
 * not measure this", and refusing for lack of a measure would turn ignorance into an accusation — keyboard and pad
 * would fail every game for having no number at all. Where there is no decision, the model stays silent; touch is
 * the one with a decision, and it alone can fail here.
 */
function holds(t: Transport, asked: number): boolean {
  return t.holds === undefined || t.holds >= asked;
}

/**
 * The AVAILABLE transports that carry this set.
 *
 * ⚠️ Availability and capacity are checked in this order on purpose: a transport that would fit but is not plugged
 * in is no answer for a child sitting at the device now.
 */
export function carriedBy(list: readonly Transport[], actions: readonly Action[]): Transport[] {
  return list.filter((t) => t.available() && carries(t, actions));
}

/**
 * ADR-0079 §3's guarantee, as a yes-or-no question.
 *
 * ⚠️ AN EMPTY SET OF ACTIONS RETURNS `false`, not a vacuous `true`. A game that declares no action is not a game any
 * transport serves — it is a game nobody can play, and `actionSetProblems` already fails it. Returning `true` here
 * would hide that defect behind this function.
 */
export function reachable(list: readonly Transport[], actions: readonly Action[]): boolean {
  return actions.length > 0 && carriedBy(list, actions).length > 0;
}

/** What the selection screen has to say, and what it needs to know to say it. */
export interface Reach {
  /**
   * True = at least one available transport carries the set **and holds as many as the game asks at once**.
   *
   * ⚠️ THE SECOND HALF OF THIS SENTENCE (ADR-0104) fixed a blind spot nobody had named: the platformer declared nine
   * actions, touch had nine places, `ok` said yes — and running, walking and jumping at once are three fingers a
   * two-touch phone does not have. `ok` claimed "playable" about a game that was not, which is the worst thing this
   * field could do.
   */
  readonly ok: boolean;
  /** How many actions the game asks for. */
  readonly asked: number;
  /** How many it asks to HOLD at once — the second axis, and what `holdsAtOnce` declares. */
  readonly holdsAsked: number;
  /** Those that would serve if they were plugged in — the actionable information: "plug in a pad". */
  readonly wouldServeIfOn: readonly string[];
  /** The available ones that DO NOT fit, with how many places they have. So the sentence can say the number. */
  readonly short: readonly { readonly id: string; readonly slots: number }[];
  /**
   * The available ones that REACH the actions but do not hold as many as the game asks at once, with their ceiling.
   *
   * It is the third sentence of #112's card, and it needs both numbers — the on-screen control holds two buttons at
   * a time and this game asks for three. Without the ceiling, the sentence would say something is missing without
   * saying what.
   */
  readonly cannotHold: readonly { readonly id: string; readonly holds: number }[];
  /** Did this game declare that it needs a POINTER? (ADR-0112) */
  readonly needsPointer: boolean;
  /**
   * The available ones that reach the actions AND hold as many as the game asks, and fail ONLY by not pointing.
   *
   * ⚠️ ONLY THOSE THAT FAIL JUST ON THIS, by the same rule `cannotHold` follows: a transport on two lists would make
   * #112's card state two problems where there is one, and the child would read two reasons for the same refusal.
   * The list is empty when the game does not ask for a pointer — not "all of them", because none failed.
   */
  readonly cannotPoint: readonly string[];
}

/**
 * Measures the reach BEFORE the child starts.
 *
 * ⚠️ It returns DATA and not text. The sentence belongs to the interface and has to go through `t()`; returning
 * prose from here would put a language in a module that has none.
 */
export function reach(
  list: readonly Transport[],
  actions: readonly Action[],
  askedHolds: number,
  wantsPointer = false,
): Reach {
  const availableNow = list.filter((t) => t.available());
  /**
   * ⚠️ A `false` DEFAULT AND NOT A REQUIRED PARAMETER: games that do not draw must not feel this change, and a
   * required fourth argument would make every existing caller decide today something that is none of its business.
   */
  const pointsIfNeeded = (t: Transport) => !wantsPointer || (!!t.points && t.points());
  // ⚠️ "Serves" became THREE things. It was TWO with #114 (`ok` said yes to whoever could not hold three fingers), and
  // three since ADR-0112 — for the same reason both times: a true `ok` about a game the child cannot play is the worst
  // thing this field can do.
  const serve = (t: Transport) => carries(t, actions) && holds(t, askedHolds) && pointsIfNeeded(t);
  return {
    ok: actions.length > 0 && availableNow.some(serve),
    asked: actions.length,
    holdsAsked: askedHolds,
    needsPointer: wantsPointer,
    wouldServeIfOn: list.filter((t) => !t.available() && serve(t)).map((t) => t.id),
    short: availableNow.filter((t) => !carries(t, actions)).map((t) => ({ id: t.id, slots: t.slots })),
    cannotPoint: availableNow
      .filter((t) => carries(t, actions) && holds(t, askedHolds) && !pointsIfNeeded(t))
      .map((t) => t.id),
    // ⚠️ ONLY THOSE THAT REACH, and not those already failed for places. A transport on both lists would make the card
    // say two things about the same defect, and the child would read two problems where there is one.
    cannotHold: availableNow
      .filter((t) => carries(t, actions) && !holds(t, askedHolds))
      .map((t) => ({ id: t.id, holds: t.holds as number })),
  };
}
