// SPDX-License-Identifier: AGPL-3.0-or-later
// input/state.ts — runtime input STATE + a generic query, shared by the writers that mutate these objects IN
// PLACE (the virtual controller through the root, `input/keydown`, `input/gamepad`): held keys (keys), pad state per
// controller (padCur/padPrevAct/padPrevStart) and the per-player transport in use. held(pl,act) = the player is
// holding the action, on the keyboard (pl.ctrl) OR on the pad assigned to them (pl.pad).
//
// 🔴 A FACTORY THE ROOT BUILDS ONCE (ADR-0232 D4): every structure below belongs to ONE root. As module state, two roots
// on one page shared a pad's previous frame and each other's held keys (ADR-0142), and two test files inherited each
// other's. A game reads this root's through `Engine.input`. The stick's dead zone is a constant and lives with the pure
// reading (`input/pad-reading`).
import type { ControlledPlayer } from '../core/entity.js';
import type { Action } from '../core/actions.js';
// The two above are type-only and vanish in the build. This one is not, and enters for the reason the vocabulary lives
// where it does: with whoever has the RULES about it (`input/transport-in-use`, a leaf) — repeating it here would be a
// second copy of a union.
import {
  DEFAULT_INPUT_STATE, afterEdge, enableAssisted, disableAssisted,
  type TransportName, type InputState,
} from './transport-in-use.js';

/** The actions one pad holds this frame. Mutated IN PLACE by `input/gamepad`'s `pollPads`. */
type PadState = Record<string, boolean>;

// The minimum player contract `held` needs — DERIVED from core/entity. `ControlledPlayer` because `held` is only
// called during a match, when assignControls has run and `ctrl` is no longer `null`.
type HeldPlayer = Pick<ControlledPlayer, 'ctrl' | 'pad'>;

/** ONE ROOT'S INPUT STATE — what `createInputState()` returns and what `Engine.input` is. */
export interface LiveInput {
  /** Physical keys held NOW (KeyboardEvent.code). */
  readonly keys: Set<string>;
  /**
   * THE SOURCE OF EACH HELD KEY — code → the device that produced it (ADR-0109).
   *
   * ⚠️ THIS MAP EXISTS BECAUSE `keys` ERASES THE SOURCE AT THE DOOR (issue #114): it is a set of CODES, and several
   * transports hold keys in it — the keyboard, and the virtual controller for a position the eyes, the face, the hands
   * or the voice pressed — so by the time `held()` answers there is no telling WHO pressed. The pad keeps its own
   * identity only because it goes through `padCur` instead of the set.
   *
   * ⚠️ THE TWO ARE WRITTEN IN ONE PLACE (`markKey`/`releaseKey` and their siblings), because they are two structures and
   * may drift apart.
   *
   * 📌 A code with NO entry here is not a data error — it is a key nobody signed, and every real key from the keyboard
   * is one: an event the child produced carries no stamp. `sourceOf` returns `undefined` and whoever asks decides.
   */
  readonly keySource: Map<string, TransportName>;
  /**
   * A key WAS PRESSED, and who pressed it is known. The only place that writes both.
   *
   * ⚠️ BOTH TOGETHER OR NEITHER: while they are two structures they can drift apart, and a drift here is silent — the
   * game keeps moving and only the latch goes wrong. Whoever writes, writes through here.
   */
  markKey(code: string, origin: TransportName): void;
  /**
   * The key was pressed and WHO pressed it is NOT KNOWN. The narrow door, and it is narrow on purpose.
   *
   * ⚠️ A FUNCTION WITH ANOTHER NAME AND NOT AN OPTIONAL SECOND PARAMETER: `markKey(code)` with the source left out is what
   * gets written without thinking; `markKeyWithoutSource(code)` is what gets written after thinking, when the answer is
   * "I don't know". The name is what shows in review.
   *
   * ⚠️ AND THE `delete` IS THE HALF THAT MATTERS: without it, a key pressed again by an unknown source INHERITED the
   * source of the time before, and the latch kept answering "eyes" to an edge that is no longer theirs.
   */
  markKeyWithoutSource(code: string): void;
  /**
   * The key was pressed and the CALLER MAY NOT KNOW by whom — it picks the right one of the two doors above. The union
   * is demanded EXPLICITLY: whoever knows who pressed keeps calling `markKey`; this one is for whoever receives the
   * answer from someone else (the root's virtual controller, `input/keydown`) and cannot pretend to have it.
   */
  markKeyFrom(code: string, source: TransportName | undefined): void;
  /** The other half. Lets go in both, for the same reason. */
  releaseKey(code: string): void;
  /**
   * Lets go of EVERYTHING — both structures, or the map is left describing keys nobody holds any more. The window's
   * `blur` does NOT use this: see `letGoOfTheKeyboard`.
   */
  releaseAllKeys(): void;
  /**
   * Hands `release` every key THE KEYBOARD holds — the ones the window's `blur` owes a keyup. ⚠️ ONLY THE KEYBOARD'S: a
   * key with no source or the keyboard's own stamp. A camera or voice press does not depend on the window's focus, and
   * letting go of it would take a held position from whoever cannot press it again quickly. It hands out codes and does
   * not release them itself: the release has to travel the road a real keyup travels, which belongs to the root.
   */
  letGoOfTheKeyboard(release: (code: string) => void): void;
  /**
   * Who produced this key? `undefined` when it is not known. ⚠️ NOT A DEFAULT: a `'teclado'` default would read an
   * unsigned key from an unknown producer as the keyboard, and the latch would turn off for whoever plays by gaze.
   */
  sourceOf(code: string): TransportName | undefined;
  /**
   * THIS PLAYER'S TRANSPORT STATE (ADR-0109 · ADR-0113). Never `undefined`: whoever never produced an edge is at the
   * DEFAULT — a player who has not touched anything yet really is on the keyboard with nothing assisted.
   */
  inputOf(player: number): InputState;
  /**
   * AN EDGE FROM THIS PLAYER ARRIVED, with its source. ⚠️ An edge from an assisted transport does NOT enable it — that
   * rule lives in `afterEdge` with its reason: a webcam false positive would lock latching on for everyone.
   */
  playerEdge(player: number, origin: TransportName): void;
  /** Enabling the assisted transports is an EXPLICIT ACT (ADR-0109 rule 4), and so it has its own door. */
  enableAssistedFor(player: number): void;
  disableAssistedFor(player: number): void;
  /**
   * ⚠️ FORGETTING IS A SEPARATE DOOR, AND LETTING GO OF KEYS DOES NOT CALL IT. The child did not change devices by
   * changing tabs; it exists for the end of a MATCH, where the question is asked again.
   */
  forgetInputs(): void;
  /** Gamepad: the actions each pad (by index) holds this frame. The pad↔player assignment lives in `p.pad`. */
  readonly padCur: Record<number, PadState>;
  /** The previous frame's actions per pad — the edge is measured against it. */
  readonly padPrevAct: Record<number, PadState>;
  /** The previous frame's START per pad. */
  readonly padPrevStart: Record<number, boolean>;
  /**
   * Is the player holding the action? keyboard (some code in the pl.ctrl scheme) OR the assigned pad (pl.pad).
   * ⚠️ `?? []` and not a raw `pl.ctrl[act]`: since issue #118 a position the keyboard DOES NOT REACH is a declared
   * `null`. Holding it is `false`, and the pad is asked right after: whoever has a pad reaches what their keyboard does not.
   */
  held(pl: HeldPlayer, act: Action): boolean;
}

/**
 * BUILDS ONE ROOT'S INPUT STATE. Nothing is shared between two calls: that is the point (ADR-0232 D4, ADR-0142).
 *
 * ⚠️ THE CONTAINERS ARE CONSTANTS AND ARE MUTATED IN PLACE, as they were: the root, `input/keydown` and `input/gamepad`
 * receive them once, and reassigning one would leave every reader holding the old object.
 */
export function createInputState(): LiveInput {
  const keys = new Set<string>();
  const keySource = new Map<string, TransportName>();
  // ⚠️ HERE AND NOT ON `PlayerBase`: the automaton answers "which device is producing this player's edges" — INPUT
  // state, kept per player in exactly the shape `padCur` has. On `PlayerBase` every cartridge would have to declare a
  // field it decides nothing about.
  const inputByPlayer: Record<number, InputState> = {};
  const padCur: Record<number, PadState> = {};
  const padPrevAct: Record<number, PadState> = {};
  const padPrevStart: Record<number, boolean> = {};

  function markKey(code: string, origin: TransportName): void {
    keys.add(code);
    keySource.set(code, origin);
  }
  function markKeyWithoutSource(code: string): void {
    keys.add(code);
    keySource.delete(code);
  }
  function inputOf(player: number): InputState {
    return inputByPlayer[player] ?? DEFAULT_INPUT_STATE;
  }

  return {
    keys, keySource, padCur, padPrevAct, padPrevStart,
    markKey, markKeyWithoutSource,
    markKeyFrom(code, source) { if (source) markKey(code, source); else markKeyWithoutSource(code); },
    releaseKey(code) { keys.delete(code); keySource.delete(code); },
    releaseAllKeys() { keys.clear(); keySource.clear(); },
    letGoOfTheKeyboard(release) {
      for (const code of [...keys]) {
        const source = keySource.get(code);
        if (!source || source === 'teclado') release(code);
      }
    },
    sourceOf: (code) => keySource.get(code),
    inputOf,
    // 📌 `afterEdge` returns the SAME object when nothing changes, so storing it back allocates nothing per frame.
    playerEdge(player, origin) { inputByPlayer[player] = afterEdge(inputOf(player), origin); },
    enableAssistedFor(player) { inputByPlayer[player] = enableAssisted(inputOf(player)); },
    disableAssistedFor(player) { inputByPlayer[player] = disableAssisted(inputOf(player)); },
    forgetInputs() { for (const k of Object.keys(inputByPlayer)) delete inputByPlayer[Number(k)]; },
    held: (pl, act) => (pl.ctrl[act] ?? []).some((k) => keys.has(k)) || (pl.pad >= 0 && !!padCur[pl.pad]?.[act]),
  };
}
