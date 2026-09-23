// SPDX-License-Identifier: AGPL-3.0-or-later
// input/gaze-cycle — TWELVE ACTIONS AND START FROM FOUR GAZE ZONES (ADR-0213; issue #194).
//
// Four zones is all the eye signal can separate, so the second dimension is TIME: the zone says which group, how long the gaze stays says
// which action of the group. Each group is a direction, the face button on that side and a shoulder, and the child sees the action of the
// moment before anything is pressed.
//
// · A zone ARMS only when the gaze came from the OPPOSITE zone within `oppositeMs` — the movement is the command, not the position, and that
//   is what separates a decision from a gaze walking around. The visit that did not arm becomes the PREPARATION for the next; an armed visit
//   that reached the preview spends it, so going back and forth does not command both ways, and a flicker through the target does not.
// · While the gaze stays, the preview walks: cancel → direction → button → shoulder, every `stepMs` after `entryMs`, and round again. Cancel
//   comes first, so a look that lands and leaves commands nothing.
// · The action leaves when the gaze LEAVES the zone, as a pulse of `pulseMs` — otherwise reaching the shoulder would press the direction on
//   the way.
// · For `deadMs` after any action no visit becomes a preparation: the way back from a command overshoots into the opposite zone, and that
//   rebound must not become the next gesture.
// · Both eyes closed for `closeMs` press START; while they are closed the cycle freezes, because with the lids down the gaze reading is noise.
// · A frame that could not be read (`frozen`: the head moving, no eyes) freezes the cycle too and commands nothing, not even START, and its
//   time is given back — a frame with no reading must never look like the gaze leaving. `cancel` drops the gesture without commanding (the
//   reader re-centred under the gaze, so what was held was never a decision).

import type { Action } from '../core/actions.js';
import type { GazeZone } from './gaze-relative.js';

/** The safe item: leaving on it commands nothing. */
export const CANCEL = 'cancel';
export type CycleItem = Action | typeof CANCEL;

/** Each zone's group: the direction, the face button on that side, the shoulder (ADR-0213). */
export const GAZE_GROUPS: { readonly [Z in GazeZone]: readonly [Action, Action, Action] } = {
  up: ['up', 'action4', 'rightShoulder'],
  right: ['right', 'action3', 'rightTrigger'],
  down: ['down', 'action2', 'leftTrigger'],
  left: ['left', 'action1', 'leftShoulder'],
};

const OPPOSITE: { readonly [Z in GazeZone]: GazeZone } = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface GazeCycleOptions {
  readonly entryMs?: number;
  readonly stepMs?: number;
  readonly closeMs?: number;
  readonly pulseMs?: number;
  readonly cancelFirst?: boolean;
  readonly repeat?: boolean;
  readonly requireOpposite?: boolean;
  readonly oppositeMs?: number;
  readonly deadMs?: number;
}

/** The defaults the lab settled on (ADR-0213). */
export const GAZE_CYCLE_DEFAULTS = {
  entryMs: 800, stepMs: 1000, closeMs: 2000, pulseMs: 400,
  cancelFirst: true, repeat: true, requireOpposite: true, oppositeMs: 2000, deadMs: 700,
} as const;

export interface GazeFrame {
  readonly zone?: GazeZone | null;
  readonly eyesClosed?: boolean;
  /** Nothing could be read this frame. */
  readonly frozen?: boolean;
  /** Drop the gesture in hand without commanding. */
  readonly cancel?: boolean;
}

export interface GazePreview { readonly zone: GazeZone; readonly item: CycleItem; readonly index: number }

export interface GazeCycleOutput {
  /** The action being pressed, for `pulseMs` after it was commanded. */
  readonly pressed: Action | null;
  /** The action commanded on THIS frame. */
  readonly commanded: Action | null;
  /** What leaving the zone now would command. */
  readonly preview: GazePreview | null;
  /** How long both eyes have been closed. */
  readonly closedMs: number;
  /** The zone in hand came from its opposite, so it can command. */
  readonly armed: boolean;
  /** The zone in hand did not arm, and will prepare the opposite one. */
  readonly preparing: boolean;
}

export interface GazeCycle {
  (nowMs: number, frame: GazeFrame): GazeCycleOutput;
}

export function createGazeCycle(options: GazeCycleOptions = {}): GazeCycle {
  const o = { ...GAZE_CYCLE_DEFAULTS, ...options };
  let zone: GazeZone | null = null, since = 0, index = -1, closedSince: number | null = null, frozenSince: number | null = null;
  let pressed: Action | null = null, pressedAt = 0, startGiven = false, armed = false;
  let preparation: { zone: GazeZone; at: number } | null = null, commandedAt = -Infinity;

  const items = (z: GazeZone): readonly CycleItem[] => (o.cancelFirst ? [CANCEL, ...GAZE_GROUPS[z]] : [...GAZE_GROUPS[z], CANCEL]);
  const preview = (): GazePreview | null => (zone && index >= 0 ? { zone, item: items(zone)[index]!, index } : null);
  const mayPrepare = (): boolean => since - commandedAt >= o.deadMs;
  const clear = (now: number): void => { zone = null; since = 0; index = -1; frozenSince = null; armed = false; preparation = null; commandedAt = now; };

  /** A frame with no reading: nothing moves, and the moment it began is kept, to give the time back. Returns the closed time. */
  const holdFrozen = (now: number): number => {
    frozenSince ??= now;
    return closedSince === null ? 0 : frozenSince - closedSince;
  };

  /** The reading is back: the time spent frozen is given back to the zone and to the closed eyes. */
  const resumeFromFreeze = (now: number): void => {
    if (frozenSince === null) return;
    const paused = now - frozenSince;
    since += paused;
    if (closedSince !== null) closedSince += paused;
    frozenSince = null;
  };

  /** Both eyes closed: the cycle waits, and after `closeMs` presses START — once per closing. Returns the closed time. */
  const whileClosed = (now: number, command: (a: Action) => void): number => {
    closedSince ??= now;
    if (!startGiven && now - closedSince >= o.closeMs) { startGiven = true; command('start'); clear(now); }
    return now - closedSince;
  };

  /** The eyes open again: the time they were closed is given back to the zone, and START may come again. */
  const reopen = (now: number): void => {
    if (closedSince === null) return;
    since += now - closedSince;
    closedSince = null;
    startGiven = false;
  };

  /** Leaving a zone: an armed visit commands what its preview showed and spends the preparation; an unarmed one prepares. */
  const leave = (now: number, command: (a: Action) => void): void => {
    if (!zone) return;
    if (!armed) { if (mayPrepare()) preparation = { zone, at: now }; return; }
    if (index < 0) return; // left before the preview showed anything
    const item = items(zone)[index]!;
    if (item !== CANCEL) command(item);
    preparation = null;
  };

  /** Entering a zone: it arms from its opposite, prepared inside the window — or at once when that rule is off. */
  const enter = (next: GazeZone | null, now: number): void => {
    zone = next; since = now; index = -1;
    armed = !next || !o.requireOpposite || (!!preparation && preparation.zone === OPPOSITE[next] && now - preparation.at <= o.oppositeMs);
  };

  /** While an armed gaze stays, the preview walks: −1 while the look settles, then one item every `stepMs`. */
  const walk = (now: number): void => {
    if (!zone || !armed) return;
    const steps = Math.floor((now - since - o.entryMs) / o.stepMs), n = items(zone).length;
    index = o.repeat ? steps % n : Math.min(n - 1, steps);
  };

  return (now, { zone: next = null, eyesClosed = false, frozen = false, cancel = false }) => {
    let commanded: Action | null = null;
    const command = (action: Action): void => { commanded = action; pressed = action; pressedAt = now; commandedAt = now; };
    const out = (closedMs: number): GazeCycleOutput => {
      if (pressed && now - pressedAt >= o.pulseMs) pressed = null;
      return { pressed, commanded, preview: preview(), closedMs, armed, preparing: !!zone && !armed && mayPrepare() };
    };

    if (cancel) { clear(now); return out(0); }
    if (frozen) return out(holdFrozen(now));
    resumeFromFreeze(now);
    if (eyesClosed) return out(whileClosed(now, command));
    reopen(now);
    if (next !== zone) { leave(now, command); enter(next, now); }
    walk(now);
    return out(0);
  };
}
