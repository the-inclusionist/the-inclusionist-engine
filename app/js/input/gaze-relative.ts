// SPDX-License-Identifier: AGPL-3.0-or-later
// input/gaze-relative — WHERE THE GAZE WENT, MEASURED FROM ITS OWN REST (ADR-0213; issue #194).
//
// Nothing here knows where the screen is, and there is no calibration: the reader knows where the eye RESTS and how far it has moved from
// there, and four zones need only the direction of the movement.
//
// · The rest is the median of `restMs` of frames that were CONTINUOUSLY still, and its scatter (MAD × 1.4826) is measured at the same time.
//   While the gaze keeps moving the stretch restarts, so nothing is read before a real rest — the rest must never be taken while the child
//   reads or looks around, or the threshold is born from a moving gaze and no look can reach it.
// · A zone is reached when the eye leaves the rest by more than `vertical` of its own tremors; the sides have their own threshold
//   (`sideways`), because for the same intent the eyes move further sideways. The horizontal displacement is scaled into vertical units
//   before anything looks at it, so the threshold, the exit and the contest between the axes all speak the same unit.
// · The zone is the axis that moved further. It holds while the displacement stays above `exit` of the threshold, and the other axis must
//   beat it by `axisSwitch` to take it — a gaze between two zones would otherwise flicker, and every flicker restarts the command cycle.
// · The rest follows slowly while the gaze is near it, so a drifting sensor does not command by itself.
// · A gaze PARKED (range within ±2 tremors, not the MAD — a MAD shrugs off a gaze that keeps coming back) for `parkedMs` re-centres the rest
//   onto itself: a rest that went stale leaves a zone marked after the eyes came back to the middle, and nothing else can unmark it.
// · A frame where the head turned fast is not read: a head turn imitates an eye movement.

import type { EyeGaze } from './face-signals.js';

/** The four zones, as the gaze moves on the screen. */
export type GazeZone = 'up' | 'down' | 'left' | 'right';

/** Why a frame gave no zone, or what the reader is doing; null when it is simply reading. */
export type GazeReason = 'no-eyes' | 'gaze-moving' | 'measuring-rest' | 'rest-measured' | 'head-moving' | 'recentring' | null;

export interface GazeReaderOptions {
  readonly restMs?: number;
  /** The threshold up and down, in tremors of the rest. */
  readonly vertical?: number;
  /** The threshold to the sides, in tremors of the rest. */
  readonly sideways?: number;
  readonly exit?: number;
  readonly axisSwitch?: number;
  readonly tremorFloor?: number;
  readonly tremorMax?: number;
  readonly followMs?: number;
  readonly parkedMs?: number;
  readonly parkedFollowMs?: number;
  readonly headMaxDegPerSecond?: number;
}

/** The defaults the lab settled on (ADR-0213): 4 tremors vertically, 8 sideways, a rest of three still seconds. */
export const GAZE_DEFAULTS = {
  restMs: 3000, vertical: 4, sideways: 8, exit: 0.6, axisSwitch: 1.3, tremorFloor: 0.02, tremorMax: 0.05,
  followMs: 12000, parkedMs: 10000, parkedFollowMs: 1500, headMaxDegPerSecond: 60,
} as const;

export interface GazeSample {
  readonly h: number | null | undefined;
  readonly v: number | null | undefined;
  readonly pose?: { readonly yaw: number; readonly pitch: number } | null;
}

export interface GazeReading {
  readonly zone: GazeZone | null;
  readonly ready: boolean;
  readonly reason: GazeReason;
  readonly rest?: EyeGaze | null;
  readonly tremor?: EyeGaze | null;
  /** Displacement from the rest, in tremors of each axis (the horizontal NOT scaled). */
  readonly displacement?: EyeGaze;
  /** The larger displacement, in vertical units. */
  readonly strength?: number;
  readonly parked?: boolean;
  /** While measuring: how long the gaze has been still. */
  readonly stillMs?: number;
}

export interface GazeReader {
  (nowMs: number, sample: GazeSample): GazeReading;
  state(): { readonly rest: EyeGaze | null; readonly tremor: EyeGaze | null; readonly zone: GazeZone | null };
  /** Forget the rest, so the next frames measure a new one. */
  reset(): void;
}

const AXIS_OF: { readonly [Z in GazeZone]: 'h' | 'v' } = { up: 'v', down: 'v', left: 'h', right: 'h' };

const median = (xs: readonly number[]): number => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2;
};
const spread = (xs: readonly number[], m: number): number => median(xs.map((x) => Math.abs(x - m))) * 1.4826;
const range = (xs: readonly number[]): number => Math.max(...xs) - Math.min(...xs);

export function createGazeReader(options: GazeReaderOptions = {}): GazeReader {
  const o = { ...GAZE_DEFAULTS, ...options };
  let stillSince: number | null = null, rest: EyeGaze | null = null, tremor: EyeGaze | null = null, zone: GazeZone | null = null;
  let lastPose: GazeSample['pose'] = null, lastMs: number | null = null, parkedSince: number | null = null;
  const restH: number[] = [], restV: number[] = [];
  const recentH: number[] = [], recentV: number[] = [], recentT: number[] = [];

  const read = (now: number, { h, v, pose = null }: GazeSample): GazeReading => {
    if (typeof h !== 'number' || typeof v !== 'number') return { zone: null, ready: !!rest, reason: 'no-eyes' };
    const dtMs = lastMs === null ? 0 : Math.max(0, now - lastMs);
    let headMoving = false;
    if (pose && lastPose && dtMs > 0) {
      headMoving = Math.hypot(pose.yaw - lastPose.yaw, pose.pitch - lastPose.pitch) / (dtMs / 1000) > o.headMaxDegPerSecond;
    }
    lastPose = pose; lastMs = now;

    if (!rest || !tremor) {
      stillSince ??= now;
      restH.push(h); restV.push(v);
      const mh = median(restH), mv = median(restV), sh = spread(restH, mh), sv = spread(restV, mv);
      if (restH.length > 4 && Math.max(sh, sv) > o.tremorMax) {
        stillSince = now; restH.length = 0; restV.length = 0;
        return { zone: null, ready: false, reason: 'gaze-moving', stillMs: 0 };
      }
      if (now - stillSince < o.restMs) return { zone: null, ready: false, reason: 'measuring-rest', stillMs: now - stillSince };
      rest = { h: mh, v: mv };
      tremor = { h: Math.max(o.tremorFloor, sh), v: Math.max(o.tremorFloor, sv) };
      return { zone: null, ready: true, reason: 'rest-measured', rest, tremor, stillMs: now - stillSince };
    }

    recentH.push(h); recentV.push(v); recentT.push(now);
    while (recentT.length && now - recentT[0]! > 1000) { recentH.shift(); recentV.shift(); recentT.shift(); }
    const still = recentH.length > 5 && range(recentH) <= 4 * tremor.h && range(recentV) <= 4 * tremor.v;
    if (!still || headMoving) parkedSince = null; else parkedSince ??= now;
    const parked = parkedSince !== null && now - parkedSince >= o.parkedMs;

    const dhRaw = (h - rest.h) / tremor.h, dv = (v - rest.v) / tremor.v;
    const dh = dhRaw * (o.vertical / o.sideways);
    const threshold = zone ? o.vertical * o.exit : o.vertical;
    const strength = Math.max(Math.abs(dh), Math.abs(dv));
    let next: GazeZone | null = null;
    if (!headMoving && strength >= threshold) {
      const ah = Math.abs(dh), av = Math.abs(dv);
      let axis: 'h' | 'v' = ah >= av ? 'h' : 'v';
      if (zone) {
        const mine = AXIS_OF[zone] === 'h' ? ah : av, other = AXIS_OF[zone] === 'h' ? av : ah;
        if (mine >= threshold && other < mine * o.axisSwitch) axis = AXIS_OF[zone];
      }
      next = axis === 'h' ? (dh > 0 ? 'left' : 'right') : (dv > 0 ? 'down' : 'up');
    }
    zone = next;
    if (!headMoving && ((!zone && strength < o.vertical / 2) || parked)) {
      const k = Math.min(1, dtMs / (parked ? o.parkedFollowMs : o.followMs));
      rest = { h: rest.h + (h - rest.h) * k, v: rest.v + (v - rest.v) * k };
    }
    return {
      zone, ready: true, displacement: { h: dhRaw, v: dv }, strength, parked, rest, tremor,
      reason: headMoving ? 'head-moving' : parked ? 'recentring' : null,
    };
  };
  return Object.assign(read, {
    state: () => ({ rest, tremor, zone }),
    reset: () => {
      stillSince = null; parkedSince = null; rest = null; tremor = null; zone = null;
      for (const a of [restH, restV, recentH, recentV, recentT]) a.length = 0;
    },
  });
}
