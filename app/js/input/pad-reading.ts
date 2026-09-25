// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-reading — WHAT A GAMEPAD IS DOING RIGHT NOW, and nothing else.
//
// 🔴 WHY IT IS ITS OWN MODULE. `input/gamepad` carried two jobs under one name: this one — buttons and axes in,
// positions out, no host, no state, no clock — and the DI runtime that polls the pads every frame and decides
// where the reading goes (title, pause, seat, play, wizard). The second is the engine's wiring and can only be
// read with a ctx in hand; the first is arithmetic over a snapshot, and every one of its rules is a promise to a
// child whose controller the browser does not recognise: a D-pad on a DirectInput POV hat, an analogue axis used
// as a button, a map the child recorded in the wizard.
//
// 📌 Nothing here reads or writes state. The frame-to-frame memory (`padCur`, `padPrevAct`) belongs to whoever
// polls — one root's `input/state` (ADR-0232 D4).
import { GAMEPAD_STANDARD } from './default-bindings.js';
import type { PadTable } from './pad-defaults.js';
import type { Action } from '../core/actions.js';

/**
 * THE STICK'S DEAD ZONE = the first HALF of its travel (ergonomics — the Dev's decision). A constant, and so it lives
 * here with the reading that uses it, not in `input/state`, which is a factory now (ADR-0232 D4). Internal: nothing
 * outside this reading asks for it, in this repository or in the games.
 */
const PAD_DEAD = 0.5;

// ---------------------------------------------------------------------------------------------
// Gamepad API surface (minimal, adapter-friendly — mirrors the real Gamepad/GamepadButton shape)
// ---------------------------------------------------------------------------------------------

export interface PadButtonLike { pressed: boolean; }
export interface PadLike {
  id: string;
  index: number;
  mapping: string; // 'standard' (XInput) | '' (DirectInput/other)
  buttons: readonly (PadButtonLike | null | undefined)[];
  axes: readonly number[];
}
/** Adapter for `navigator.getGamepads()` — the DI point that lets tests feed a fake pad without a browser. */
export type GetGamepads = () => readonly (PadLike | null | undefined)[] | null | undefined;

// ---------------------------------------------------------------------------------------------
// Action mapping (button/axis -> game action)
// ---------------------------------------------------------------------------------------------

/** One binding captured by the wizard: a digital button, a signed analog threshold, or an exact hat/POV value.
 *  Loosely-shaped (all fields optional) rather than a strict union: bindings round-trip through JSON in
 *  localStorage, so `bindActive` must stay defensive against malformed/partial saved data, same as the original. */
export interface PadBinding { b?: number; ax?: number; s?: number; av?: number; v?: number; }
/** action -> binding, keyed by the 9 wizard steps (left/right/up/down/jump/run/swap/especial/start), PLUS the
 *  `_skip: true` sentinel meaning "user cancelled the wizard for this model — use the default mapping, don't
 *  ask again this session" (not persisted). A flat index signature (not `Partial<Record<..>> & {_skip}`) so the
 *  boolean `_skip` and the PadBinding action values can coexist under TS's index-signature rule; `bindingAt`
 *  narrows a lookup back down to a PadBinding for `bindActive`. */
export type PadMap = Record<string, PadBinding | boolean | undefined>;
function bindingAt(map: PadMap, key: string): PadBinding | undefined {
  const v = map[key];
  return typeof v === 'object' && v !== null ? v : undefined;
}

export type ActionKey = 'left' | 'right' | 'up' | 'down' | 'action2' | 'action1' | 'action4' | 'action3';
export interface Dirs { left: boolean; right: boolean; up: boolean; down: boolean; }
export interface PadActions extends Dirs {
  [key: string]: boolean; // makes PadActions assignable to PadState (input/state.ts's Record<string,boolean>)
  action2: boolean; action1: boolean; action4: boolean; action3: boolean;
  _start: boolean; // action 2 OR start (closes dialogs and victory screens)
  _pause: boolean; // start only (pause/resume)
}

// [axisValue, up, down, left, right] — the 8 steps of a "POV hat" D-pad (DirectInput's high axis), resting at ~1.286.
const HAT_STEPS: readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1][] = [
  [-1, 1, 0, 0, 0], [-0.7143, 1, 0, 0, 1], [-0.4286, 0, 0, 0, 1], [-0.1429, 0, 1, 0, 1],
  [0.1429, 0, 1, 0, 0], [0.4286, 0, 1, 1, 0], [0.7143, 0, 0, 1, 0], [1, 1, 0, 1, 0],
];

/** The hat step this axis value IS, or `null` — the eight are ~0.286 apart, and the tolerance is ±0.09. */
function hatStepAt(v: number | undefined): readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1] | null {
  if (typeof v !== 'number' || Math.abs(v) > 1.001) return null; // the hat's rest, outside the steps
  return HAT_STEPS.find(([hv]) => Math.abs(v - hv) <= 0.09) ?? null;
}

/** A hat step LIGHTS directions and never puts them out — which keeps the stick and the D-pad alive at once. */
function applyHatStep(d: Dirs, step: readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1]): void {
  const [, up, down, left, right] = step;
  if (up) d.up = true;
  if (down) d.down = true;
  if (left) d.left = true;
  if (right) d.right = true;
}

/** Directions from the STANDARD SOURCES: stick 0/1 (dead zone PAD_DEAD), D-pad 12-15, and the "hat" on axes >=6
 *  (DirectInput's POV). A pad with both directionals mapped keeps both alive (a thumb on the stick does not kill the D-pad). */
export function stdDirs(gp: PadLike): Dirs {
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const ax = (i: number): number => gp.axes[i] || 0;
  const d: Dirs = { left: ax(0) < -PAD_DEAD || b(14), right: ax(0) > PAD_DEAD || b(15), up: ax(1) < -PAD_DEAD || b(12), down: ax(1) > PAD_DEAD || b(13) };
  for (let i = 6; i < gp.axes.length; i++) {
    const step = hatStepAt(gp.axes[i]);
    if (step) applyHatStep(d, step);
  }
  return d;
}

/** Is binding `bd` active now on this gamepad? Digital = pressed; analogue ({ax,s}) = threshold by sign (half the
 *  travel); hat ({av,v}) = the step's exact value (±0.13 — the 8 steps are ~0.286 apart). */
export function bindActive(gp: PadLike, bd: PadBinding | null | undefined): boolean {
  if (!bd) return false;
  if (bd.b != null) return !!(gp.buttons[bd.b] && gp.buttons[bd.b]!.pressed);
  if (bd.ax != null) return ((gp.axes[bd.ax] || 0) * (bd.s ?? 0)) > 0.5;
  if (bd.av != null) return Math.abs((gp.axes[bd.av] || 0) - (bd.v ?? 0)) <= 0.13;
  return false;
}

/** The snapshot when the CHILD recorded a map in the wizard: their directions fall back to the standard ones when the
 *  binding is not active, so the D-pad and the stick stay alive beside what they chose. */
function actionsFromTheSavedMap(gp: PadLike, custom: PadMap): PadActions {
  const A = (k: string): boolean => bindActive(gp, bindingAt(custom, k));
  const sd = stdDirs(gp);
  return {
    left: A('left') || sd.left, right: A('right') || sd.right, up: A('up') || sd.up, down: A('down') || sd.down,
    action2: A('action2'), action1: A('action1'), action4: A('action4'), action3: A('action3'), _start: A('action2') || A('start'), _pause: A('start'),
  };
}

/**
 * The snapshot by the declared TABLE — the engine's factory with this game's default on top (ADR-0115), resolved in
 * `input/pad-defaults`.
 *
 * ⚠️ THE INDICES COME FROM THE TABLE, not from literals here. While they were literals, this line and
 * `input/default-bindings` DISAGREED and nothing noticed — the defect the touch gate caught: two tables agreeing with
 * each other prove nothing about a third that reads them.
 *
 * ⚠️ AND THE DISAGREEMENT WAS REAL: here `action1` was `b(2) || b(5) || b(7)` — X, R1 and R2 all running — while the table
 * declares R1 as `rightShoulder` and R2 as `rightTrigger`. ADR-0086 recorded it as the asterisk of its "zero movement": no
 * VERB changes button, but that one loses two of its three.
 */
function actionsFromTheTable(gp: PadLike, table: PadTable): PadActions {
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const sd = stdDirs(gp);
  const at = (a: Action): boolean => { const i = table[a]; return typeof i === 'number' ? b(i) : false; };
  return {
    left: sd.left, right: sd.right, up: sd.up, down: sd.down,
    action1: at('action1'), action2: at('action2'), action3: at('action3'), action4: at('action4'),
    leftShoulder: at('leftShoulder'), leftTrigger: at('leftTrigger'),
    rightShoulder: at('rightShoulder'), rightTrigger: at('rightTrigger'),
    // ⚠️ `start` AS A POSITION, not only as the derived ones below. It was missing, and the table's gate found it:
    // whoever wanted to know "is START pressed?" had to read `_start`, which starts with an underscore and means
    // something else (closes a dialog, and accepts action 2 too).
    start: at('start'), select: at('select'),
    // `_start` and `_pause` are DERIVED, not positions: "close dialog" accepts action 2 or START, "pause" only START.
    // They are written here because they describe what the root does with two positions, not a third one.
    _start: at('action2') || at('start'), _pause: at('start'),
  };
}

/** This frame's actions for this gamepad. `custom` = the map the wizard saved for this `gp.id` (null/`_skip` = the
 *  declared table). ⚠️ The table decides only in the second branch, which is right: a game's default does not override
 *  a choice the child recorded. */
export function padActions(gp: PadLike, custom: PadMap | null, table: PadTable = GAMEPAD_STANDARD): PadActions {
  return custom && !custom._skip ? actionsFromTheSavedMap(gp, custom) : actionsFromTheTable(gp, table);
}

/**
 * THE POSITIONS THE ONE-BUTTON SIMULATION DOES NOT CUT. Pausing is the WAY OUT, not a move.
 *
 * ⚠️ Cutting START would trap the child inside the match — the reasoning that puts "the way out first" in ADR-0044 and
 * made the focus trap exist in ADR-0090. An accommodation that locks is not an accommodation. The derived ones (`_start`,
 * `_pause`) pass too: they describe what the root does with these two positions, not a third.
 */
const OUTSIDE_CUT = new Set(['start', 'select', '_start', '_pause']);

/**
 * ONE BUTTON AT A TIME, APPLIED TO THE PAD — the missing half of the motor empathy simulation (issue #120).
 *
 * ⚠️ IT USED TO HOLD ONLY ON THE KEYBOARD. The keyboard transport releases every other game key when a new one arrives
 * with the simulation on; the pad polling had no equivalent. A child who turned it on with a pad in hand **was not in
 * it** — no error, no warning, no symptom, because the settings kept saying it was on.
 *
 * ⚠️ THE DIRECTIONS COUNT, which is what makes the rule faithful to the keyboard: there, the game keys include the four
 * directions — walking and jumping do not coexist. A filter that spared the directions would be more comfortable and
 * would be simulating another disability.
 *
 * ⚠️ AND WHO SURVIVES DIFFERS FROM THE KEYBOARD, BY NECESSITY. On the keyboard the new arrival wins, because there IS an
 * arrival: the event says which. A pad is read by POLLING — what arrives is a snapshot, without order. So the one that
 * already held stays, and only when it lets go does the next take over. That keeps the run button from being cut because
 * the thumb brushed another, and it is the reading of "holding" ADR-0077 gives.
 *
 * The POLICY is the keyboard's; the IMPLEMENTATION cannot be shared today because the state's shapes differ — there a
 * `Set` of key codes, here a snapshot of booleans by position.
 */
export function oneButtonAtOnce(
  // ⚠️ THE PREVIOUS FRAME IS TYPED BY WHAT THIS FUNCTION READS, not by `PadActions`: the loop's previous-frame state is
  // looser, and demanding the full shape would force the caller into a mould that does not describe what happens here —
  // the only question is "was this key down?".
  wasDown: Readonly<Record<string, boolean | undefined>>,
  reading: PadActions,
  on: boolean,
): PadActions {
  if (!on) return reading;
  const cuttable = Object.keys(reading).filter((k) => !OUTSIDE_CUT.has(k));
  const active = cuttable.filter((k) => reading[k] === true);
  if (active.length <= 1) return reading;
  // The one that already held has priority; with none, the snapshot's first takes over.
  const kept = active.find((k) => wasDown[k] === true) ?? active[0];
  const onlyOne: PadActions = { ...reading };
  for (const k of active) if (k !== kept) onlyOne[k] = false;
  return onlyOne;
}
