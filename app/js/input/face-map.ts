// SPDX-License-Identifier: AGPL-3.0-or-later
// input/face-map — THE FACE AS A CONTROLLER: THIRTEEN EXPRESSIONS AND THE ACTIONS THEY PRESS (ADR-0210 and its erratum; issue #191).
//
// The map is the Dev's, settled in twelve lab rounds (the last clean: every position read, nothing read that was not asked, nothing read in
// 26 s of «no position»). Each expression is measured as a LEVEL — how far its blendshapes rose from the calibrated rest, 0..1 — and the
// levels go through the rules those rounds found before a level becomes a press:
// · exclusions: lips pressed lift the smile, and the mouth pushed to a side projects the lips, so the specific one clears the other; a
//   squeezed eye pulls the brow down, so a squeeze at START's mark clears the frown;
// · the pucker has its own mark (0.6): a relaxed mouth sits near 0.33;
// · the crossed look: a look to one side peaking at 0.6, then the other side within 0.8 s and held 300 ms; a turned head cancels it;
// · START is one eye squeezed at 0.5 for 0.7 s; the mouth expressions hold 300 ms more, because talking moves the mouth in short syllables;
// · then a level at 0.3 held 300 ms presses, and stays pressed while it holds.
// ⚠️ The levels are keyed by EXPRESSION, never by action: a number per action is the analogue grammar ADR-0112 refused for input/. The
// only thing that reaches the action vocabulary is which actions are held.

import type { Action } from '../core/actions.js';

export type FaceExpression =
  | 'browsUp' | 'frown' | 'headLeft' | 'headRight' | 'squeeze' | 'pressLips' | 'openMouth' | 'smile' | 'pucker'
  | 'lookRightThenLeft' | 'mouthLeft' | 'lookLeftThenRight' | 'mouthRight';

/** The Dev's map (ADR-0210 erratum): each expression and the action it presses. SELECT has no expression. */
export const FACE_MAP: { readonly [E in FaceExpression]: Action } = {
  browsUp: 'up', frown: 'down', headLeft: 'left', headRight: 'right', squeeze: 'start',
  pressLips: 'action1', openMouth: 'action2', smile: 'action3', pucker: 'action4',
  lookRightThenLeft: 'leftShoulder', mouthLeft: 'leftTrigger', lookLeftThenRight: 'rightShoulder', mouthRight: 'rightTrigger',
};
const EXPRESSIONS = Object.keys(FACE_MAP) as FaceExpression[];

/** The blendshapes the map reads — a closed list. */
export const FACE_BLENDSHAPES = [
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'browDownLeft', 'browDownRight',
  'mouthPressLeft', 'mouthPressRight', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
  'mouthPucker', 'mouthLeft', 'mouthRight',
  'eyeLookOutLeft', 'eyeLookInLeft', 'eyeLookOutRight', 'eyeLookInRight', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
] as const;
export type FaceBlendshape = (typeof FACE_BLENDSHAPES)[number];
export type FaceScores = Partial<Readonly<Record<FaceBlendshape, number>>>;
export type ExpressionLevels = { readonly [E in FaceExpression]?: number };

const READ = new Set<string>(FACE_BLENDSHAPES);
/** The Face Landmarker's categories, keeping the ones the map reads. */
export function faceScoresFromCategories(categories: ReadonlyArray<{ readonly categoryName: string; readonly score: number }> | null | undefined): FaceScores {
  return Object.fromEntries((categories ?? []).filter((c) => READ.has(c.categoryName)).map((c) => [c.categoryName, c.score]));
}

/** The calibrated rest: each blendshape's median, and where the nose sat. */
export interface FaceRest { readonly scores: FaceScores; readonly headX: number }

const rise = (s: FaceScores, rest: FaceScores, n: FaceBlendshape): number => {
  const b = rest[n] ?? 0;
  return Math.max(0, ((s[n] ?? 0) - b) / Math.max(1e-6, 1 - b));
};

/**
 * The head turned, from the nose tip's offset against the middle of the face's two sides (landmarks 1, 234, 454), in face widths, from the
 * rest. In the camera's unmirrored image the player's left is +x. `FULL_TURN` 0.65 puts the 0.3 mark near 18° (the Dev asked for a less
 * sensitive head; geometry, not measured on a face).
 */
export const FULL_TURN = 0.65;
export function headTurn(landmarks: ReadonlyArray<{ readonly x: number; readonly y: number }> | null | undefined, restX = 0): { x: number | null; left: number; right: number } {
  if (!landmarks || landmarks.length < 455) return { x: null, left: 0, right: 0 };
  const nose = landmarks[1]!, a = landmarks[234]!, b = landmarks[454]!;
  const width = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
  const x = (nose.x - (a.x + b.x) / 2) / width;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return { x, left: clamp((x - restX) / FULL_TURN), right: clamp((restX - x) / FULL_TURN) };
}

/** The raw levels of one frame, from the scores and the head turn, against the rest. */
export function faceLevels(s: FaceScores, rest: FaceRest, turn: { left: number; right: number }): ExpressionLevels {
  const r = (...names: FaceBlendshape[]): number => Math.max(0, ...names.map((n) => rise(s, rest.scores, n)));
  return {
    browsUp: r('browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'),
    frown: r('browDownLeft', 'browDownRight'),
    headLeft: turn.left, headRight: turn.right,
    // one eye squeezed is enough, the other squeezed or not: the more closed eye, by blink or squint
    squeeze: r('eyeBlinkLeft', 'eyeSquintLeft', 'eyeBlinkRight', 'eyeSquintRight'),
    pressLips: r('mouthPressLeft', 'mouthPressRight'),
    openMouth: r('jawOpen'),
    smile: r('mouthSmileLeft', 'mouthSmileRight', 'mouthUpperUpLeft', 'mouthUpperUpRight'),
    pucker: r('mouthPucker'),
    // a look to the player's left moves the left eye out and the right eye in, and both must rise: the weaker of the pair
    lookRightThenLeft: Math.min(rise(s, rest.scores, 'eyeLookOutLeft'), rise(s, rest.scores, 'eyeLookInRight')),
    lookLeftThenRight: Math.min(rise(s, rest.scores, 'eyeLookOutRight'), rise(s, rest.scores, 'eyeLookInLeft')),
    mouthLeft: r('mouthLeft'), mouthRight: r('mouthRight'),
  };
}

/** START's squeeze mark: above the relaxed narrowing (0.30–0.34) and the eye a real frown squeezes (0.36–0.49) in the Dev's runs. */
export const SQUEEZE_MARK = 0.5;
const DOMINATES: { readonly [E in FaceExpression]?: readonly FaceExpression[] } = { pressLips: ['smile'], mouthLeft: ['pucker'], mouthRight: ['pucker'] };

/** The exclusions: a held specific expression clears the generic one it drags along; a squeeze at START's mark clears the frown. */
export function resolveFace(levels: ExpressionLevels, mark: number): ExpressionLevels {
  const out: { [E in FaceExpression]?: number } = { ...levels };
  if ((levels.squeeze ?? 0) >= SQUEEZE_MARK) out.frown = 0;
  for (const e of EXPRESSIONS) {
    if ((levels[e] ?? 0) >= mark) for (const weak of DOMINATES[e] ?? []) out[weak] = 0;
  }
  return out;
}

/** The pucker's own mark (0.6): below it, it is not a pucker. */
export const PUCKER_MARK = 0.6;
export function ownMarks(levels: ExpressionLevels): ExpressionLevels {
  return (levels.pucker ?? 0) < PUCKER_MARK ? { ...levels, pucker: 0 } : levels;
}

/**
 * The crossed look. In: the look to each side (in the levels, under the button it ends on). Out: the button levels. A first side counts
 * only if it peaked at `peakMin` and then left the mark; the second must reach `peakMin` within `windowMs` and stay `holdMs`; held, it
 * stays down while the look stays at the mark; a turned head cancels any crossing.
 */
export function createCrossedLook({ mark, peakMin = 0.6, windowMs = 800, holdMs = 300 }: { mark: number; peakMin?: number; windowMs?: number; holdMs?: number }) {
  // the look to the player's left is read under the button that ENDS on the left
  type Button = 'lookRightThenLeft' | 'lookLeftThenRight';
  const side = { lookRightThenLeft: { on: false, peak: 0, leftAt: null as number | null }, lookLeftThenRight: { on: false, peak: 0, leftAt: null as number | null } };
  const button = { lookRightThenLeft: { start: null as number | null, heldSince: null as number | null }, lookLeftThenRight: { start: null as number | null, heldSince: null as number | null } };
  const first: { readonly [B in Button]: Button } = { lookRightThenLeft: 'lookLeftThenRight', lookLeftThenRight: 'lookRightThenLeft' };
  return (ms: number, levels: ExpressionLevels): ExpressionLevels => {
    const out: { [E in FaceExpression]?: number } = { ...levels };
    const turned = Math.max(levels.headLeft ?? 0, levels.headRight ?? 0) >= mark;
    for (const b of ['lookRightThenLeft', 'lookLeftThenRight'] as const) {
      const s = side[b], v = levels[b] ?? 0;
      if (v >= mark) { if (!s.on) { s.on = true; s.peak = 0; } s.peak = Math.max(s.peak, v); }
      else if (s.on) { s.on = false; if (s.peak >= peakMin) s.leftAt = ms; s.peak = 0; }
      if (turned) { s.leftAt = null; s.peak = 0; }
    }
    for (const b of ['lookRightThenLeft', 'lookLeftThenRight'] as const) {
      const st = button[b], v = levels[b] ?? 0, before = side[first[b]];
      if (st.heldSince !== null) {
        if (v >= mark) { out[b] = 1; continue; }
        st.heldSince = null; st.start = null; out[b] = 0; continue;
      }
      if (v >= peakMin && !turned) {
        if (st.start === null) {
          if (before.leftAt === null) st.start = -1;
          else { st.start = ms - before.leftAt <= windowMs ? ms : -1; before.leftAt = null; }
        }
        if (st.start >= 0 && ms - st.start >= holdMs) st.heldSince = st.start;
      } else st.start = null;
      out[b] = st.start !== null && st.start >= 0 ? 1 : 0;
    }
    return out;
  };
}

/** START's long squeeze: its level passes only after staying at `SQUEEZE_MARK` for `ms` (the usual hold comes on top: about 1 s). */
export function createLongSqueeze(ms = 700) {
  let since: number | null = null;
  return (now: number, levels: ExpressionLevels): ExpressionLevels => {
    if ((levels.squeeze ?? 0) < SQUEEZE_MARK) { since = null; return { ...levels, squeeze: 0 }; }
    since ??= now;
    return now - since >= ms ? levels : { ...levels, squeeze: 0 };
  };
}

/** The mouth expressions, held `ms` longer: talking moves the mouth past the mark in short syllables. */
const MOUTH_EXPRESSIONS: readonly FaceExpression[] = ['pressLips', 'openMouth', 'smile', 'pucker', 'mouthLeft', 'mouthRight'];
export function createMouthHold({ mark, ms = 300 }: { mark: number; ms?: number }) {
  const since = new Map<FaceExpression, number>();
  return (now: number, levels: ExpressionLevels): ExpressionLevels => {
    const out: { [E in FaceExpression]?: number } = { ...levels };
    for (const e of MOUTH_EXPRESSIONS) {
      if ((levels[e] ?? 0) < mark) { since.delete(e); continue; }
      if (!since.has(e)) since.set(e, now);
      if (now - since.get(e)! < ms) out[e] = 0;
    }
    return out;
  };
}

/** The whole reader: a frame's scores and landmarks in, the actions held and the ones that just started out. */
export function createFaceMapReader({ rest, mark = 0.3, holdMs = 300 }: { rest: FaceRest; mark?: number; holdMs?: number }) {
  const crossed = createCrossedLook({ mark }), squeeze = createLongSqueeze(), mouth = createMouthHold({ mark });
  const aboveSince = new Map<FaceExpression, number>(), held = new Set<FaceExpression>();
  return (ms: number, scores: FaceScores, landmarks?: ReadonlyArray<{ readonly x: number; readonly y: number }> | null): { held: Action[]; started: Action[] } => {
    const turn = headTurn(landmarks, rest.headX);
    const levels = mouth(ms, squeeze(ms, crossed(ms, ownMarks(resolveFace(faceLevels(scores, rest, turn), mark)))));
    const started: Action[] = [];
    for (const e of EXPRESSIONS) {
      if ((levels[e] ?? 0) >= mark) {
        if (!aboveSince.has(e)) aboveSince.set(e, ms);
        if (!held.has(e) && ms - aboveSince.get(e)! >= holdMs) { held.add(e); started.push(FACE_MAP[e]); }
      } else { aboveSince.delete(e); held.delete(e); }
    }
    return { held: [...held].map((e) => FACE_MAP[e]), started };
  };
}

/** The rest from a few seconds of samples: each blendshape's median, and the nose's. */
export function faceRestFromSamples(samples: ReadonlyArray<{ readonly scores: FaceScores; readonly headX: number | null }>): FaceRest {
  const median = (xs: number[]): number => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)]! : 0; };
  const scores: { [B in FaceBlendshape]?: number } = {};
  for (const n of FACE_BLENDSHAPES) {
    const xs = samples.map((s) => s.scores[n]).filter((v): v is number => typeof v === 'number');
    if (xs.length) scores[n] = median(xs);
  }
  return { scores, headX: median(samples.map((s) => s.headX).filter((v): v is number => v !== null)) };
}
