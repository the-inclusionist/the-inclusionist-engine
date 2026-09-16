// SPDX-License-Identifier: AGPL-3.0-or-later
// input/face-signals — WHAT THE EYE CONTROL READS FROM THE FACE LANDMARKER (ADR-0213; issue #194).
//
// Three readings and nothing else: the head pose from the facial transformation matrix, each eye's gaze from the ready-made blendshapes, and
// whether both eyes are closed. Nothing here knows where the screen is — the eye control measures how far the gaze moves from its own rest
// (input/gaze-relative), and uses the pose only to notice a head that turns fast.
//
// ⚠️ THE SIGN OF PITCH IS NOT MEASURED against a real head. Only the pose's rate of change reaches a command, so the sign does not; the old
// `poseDaCabeca` of `input/camera-gestures` uses the opposite sign and leaves with the old readers (issue #191).

export interface HeadPose {
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  /** The face's position in the camera's metric space, in cm: the camera at the origin looking down −z, so a face in front has tz < 0. */
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
}

/** Degrees from the Face Landmarker's 4×4 column-major matrix. Null without one. */
export function headPoseFromMatrix(m: ArrayLike<number> | null | undefined): HeadPose | null {
  if (!m || m.length < 16) return null;
  const deg = 180 / Math.PI;
  return {
    yaw: Math.atan2(m[8]!, m[10]!) * deg,
    pitch: Math.asin(Math.max(-1, Math.min(1, -m[9]!))) * deg,
    roll: Math.atan2(m[1]!, m[5]!) * deg,
    tx: m[12]!, ty: m[13]!, tz: m[14]!,
  };
}

/** The blendshapes the eye control reads — a closed list, so a score kept here can never be a number per action (ADR-0112). */
export const EYE_BLENDSHAPES = [
  'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeLookDownLeft',
  'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeLookDownRight',
  'eyeBlinkLeft', 'eyeBlinkRight',
] as const;
export type EyeBlendshape = (typeof EYE_BLENDSHAPES)[number];

/** Scores of the eye blendshapes by name; one the detection did not bring is absent. */
export type BlendshapeScores = Partial<Readonly<Record<EyeBlendshape, number>>>;

const READ = new Set<string>(EYE_BLENDSHAPES);

/** The Face Landmarker gives all 52 blendshapes as `{ categoryName, score }` pairs; this keeps the eye ones, by name. */
export function scoresFromCategories(categories: ReadonlyArray<{ readonly categoryName: string; readonly score: number }> | null | undefined): BlendshapeScores {
  return Object.fromEntries((categories ?? []).filter((c) => READ.has(c.categoryName)).map((c) => [c.categoryName, c.score]));
}

export interface EyeGaze {
  /** Grows as the eye turns towards the PLAYER'S LEFT. */
  readonly h: number;
  /** Grows as the eye turns DOWN. */
  readonly v: number;
}

/**
 * Each eye's gaze. `left` and `right` are the subject's own eyes, as MediaPipe names them; the right eye turning to the player's left moves
 * towards the nose (in), the left eye moves out. A missing score reads as zero.
 */
export function eyeGazeFromScores(s: BlendshapeScores | null | undefined): { readonly left: EyeGaze; readonly right: EyeGaze } {
  const q = (n: EyeBlendshape): number => s?.[n] ?? 0;
  return {
    left: { h: q('eyeLookOutLeft') - q('eyeLookInLeft'), v: q('eyeLookDownLeft') - q('eyeLookUpLeft') },
    right: { h: q('eyeLookInRight') - q('eyeLookOutRight'), v: q('eyeLookDownRight') - q('eyeLookUpRight') },
  };
}

/** The mark a blink score must reach on BOTH eyes for them to count as closed — START is both eyes closed (ADR-0213 §5). */
export const EYES_CLOSED_MARK = 0.5;

/** Both eyes closed: the LESS closed of the two reaches the mark, so one eye squeezed shut is not a close. */
export function bothEyesClosed(s: BlendshapeScores | null | undefined, mark = EYES_CLOSED_MARK): boolean {
  return Math.min(s?.['eyeBlinkLeft'] ?? 0, s?.['eyeBlinkRight'] ?? 0) >= mark;
}
