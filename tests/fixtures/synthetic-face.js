// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/synthetic-face — A FACE LANDMARKER RESULT BUILT FROM A GAZE AND A HEAD WE CHOOSE (ADR-0213; issue #194).
//
// The camera and the vision runtime are not in the test tree, so the eye control is exercised on frames built here: the head as a pose matrix,
// the gaze as blendshape scores, in the shape `detectForVideo` returns. It is only worth something if the engine's own readers read back what
// was put in, and `tests/face-signals.node.test.js` checks exactly that before any other test leans on it.

const rad = Math.PI / 180;

/** The 4×4 column-major matrix of a head turned by `yaw` about y and `pitch` about x, `tz` cm in front of the camera. */
export function poseMatrix({ yaw = 0, pitch = 0, tx = 0, ty = 0, tz = -45 } = {}) {
  const cy = Math.cos(yaw * rad), sy = Math.sin(yaw * rad), cp = Math.cos(pitch * rad), sp = Math.sin(pitch * rad);
  return [cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp, -sp, cy * cp, 0, tx, ty, tz, 1];
}

/** The blendshapes of a gaze: `h` towards the player's left, `v` down, both eyes alike; `closed` shuts both lids. */
export function gazeScores({ h = 0, v = 0, closed = false } = {}) {
  const pos = (x) => Math.max(0, x), neg = (x) => Math.max(0, -x);
  return {
    eyeLookInRight: pos(h), eyeLookOutRight: neg(h), eyeLookOutLeft: pos(h), eyeLookInLeft: neg(h),
    eyeLookDownRight: pos(v), eyeLookUpRight: neg(v), eyeLookDownLeft: pos(v), eyeLookUpLeft: neg(v),
    eyeBlinkLeft: closed ? 0.9 : 0.05, eyeBlinkRight: closed ? 0.9 : 0.05,
  };
}

/** One detection, as `detectForVideo` returns it. The landmarks are left out until a test draws them. */
export function detection({ h = 0, v = 0, yaw = 0, pitch = 0, tz = -45, closed = false } = {}) {
  return {
    faceLandmarks: [],
    faceBlendshapes: [{ categories: Object.entries(gazeScores({ h, v, closed })).map(([categoryName, score]) => ({ categoryName, score })) }],
    facialTransformationMatrixes: [{ data: poseMatrix({ yaw, pitch, tz }) }],
  };
}
