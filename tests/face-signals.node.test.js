// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT THE EYE CONTROL READS FROM THE FACE, AND THE SYNTHETIC FACE THE OTHER TESTS LEAN ON (ADR-0213; issue #194).
//
// The synthetic face is worth something only if these readers read back what was put in; so a head and a gaze go in, and the same head and gaze
// must come out. Ported from the lab's `sinais.check.mjs` and `rosto-falso.check.mjs`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { headPoseFromMatrix, scoresFromCategories, eyeGazeFromScores, bothEyesClosed, EYES_CLOSED_MARK, EYE_BLENDSHAPES } from '../app/js/input/face-signals.js';
import { poseMatrix, gazeScores, detection } from './fixtures/synthetic-face.js';

describe('the head pose, from the Face Landmarker matrix', () => {
  it('comes back as the head that was asked for', () => {
    const p = headPoseFromMatrix(poseMatrix({ yaw: 25, pitch: -12, tx: 4, ty: -3, tz: -52 }));
    expect(p.yaw).toBeCloseTo(25, 4); expect(p.pitch).toBeCloseTo(-12, 4); expect(p.roll).toBeCloseTo(0, 4);
    expect([p.tx, p.ty, p.tz]).toEqual([4, -3, -52]);
  });
  it('reads zero for a head facing the camera, at any distance', () => {
    const p = headPoseFromMatrix(poseMatrix({ tz: -30 }));
    expect(p.yaw).toBeCloseTo(0, 6); expect(p.pitch).toBeCloseTo(0, 6); expect(p.roll).toBeCloseTo(0, 6); expect(p.tz).toBe(-30);
  });
  it('reads turning and tilting apart', () => {
    const turn = headPoseFromMatrix(poseMatrix({ yaw: 30 })), tilt = headPoseFromMatrix(poseMatrix({ pitch: 30 }));
    expect(turn.yaw).toBeCloseTo(30, 4); expect(turn.pitch).toBeCloseTo(0, 4);
    expect(tilt.pitch).toBeCloseTo(30, 4); expect(tilt.yaw).toBeCloseTo(0, 4);
  });
  it('does not blow up on an arcsine a rounding error pushed past 1', () => {
    const p = headPoseFromMatrix([1, 0, 0, 0, 0, 0, 1, 0, 0, -1.0000001, 0, 0, 0, 0, -40, 1]);
    expect(Number.isFinite(p.pitch)).toBe(true); expect(Math.abs(p.pitch)).toBeCloseTo(90, 3);
  });
  it('is null without a matrix, and does not throw', () => {
    expect(headPoseFromMatrix(null)).toBeNull(); expect(headPoseFromMatrix([1, 2, 3])).toBeNull();
  });
});

describe('each eye\'s gaze, from the blendshapes', () => {
  it('comes back as the gaze that was asked for, on both eyes', () => {
    const g = eyeGazeFromScores(gazeScores({ h: 0.4, v: -0.3 }));
    expect(g.right.h).toBeCloseTo(0.4, 9); expect(g.right.v).toBeCloseTo(-0.3, 9);
    expect(g.left.h).toBeCloseTo(0.4, 9); expect(g.left.v).toBeCloseTo(-0.3, 9);
  });
  it('grows towards the player\'s LEFT and DOWN, and the axes do not leak into each other', () => {
    const left = eyeGazeFromScores(gazeScores({ h: 0.5 })), down = eyeGazeFromScores(gazeScores({ v: 0.5 }));
    expect(left.right.h).toBeGreaterThan(0); expect(left.right.v).toBe(0);
    expect(down.right.v).toBeGreaterThan(0); expect(down.right.h).toBe(0);
  });
  it('reads a missing score as zero, not as NaN, and answers without a sample', () => {
    const g = eyeGazeFromScores({ eyeLookInRight: 0.3 });
    expect(g.right.h).toBe(0.3); expect(g.right.v).toBe(0); expect(g.left.h).toBe(0);
    expect(eyeGazeFromScores(null)).toEqual({ left: { h: 0, v: 0 }, right: { h: 0, v: 0 } });
  });
});

describe('both eyes closed — the START signal', () => {
  it('is true only when BOTH lids pass the mark', () => {
    expect(bothEyesClosed(gazeScores({ closed: true }))).toBe(true);
    expect(bothEyesClosed(gazeScores({ closed: false }))).toBe(false);
    expect(bothEyesClosed({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.1 }), 'one eye squeezed shut is not a close').toBe(false);
  });
  it('holds the mark as a boundary, and the mark is 0.5', () => {
    expect(EYES_CLOSED_MARK).toBe(0.5);
    expect(bothEyesClosed({ eyeBlinkLeft: 0.5, eyeBlinkRight: 0.5 })).toBe(true);
    expect(bothEyesClosed({ eyeBlinkLeft: 0.5, eyeBlinkRight: 0.49 })).toBe(false);
    expect(bothEyesClosed(null)).toBe(false);
  });
});

describe('the synthetic face, read back through the readers', () => {
  it('has the shape a detection has, and its blendshapes read back as the gaze and the close asked for', () => {
    const d = detection({ h: -0.6, v: 0.2, yaw: 18, closed: false });
    expect(d.facialTransformationMatrixes[0].data).toHaveLength(16);
    expect(d.facialTransformationMatrixes[0].data.every(Number.isFinite)).toBe(true);
    const s = scoresFromCategories(d.faceBlendshapes[0].categories);
    const g = eyeGazeFromScores(s);
    expect(g.right.h).toBeCloseTo(-0.6, 9); expect(g.right.v).toBeCloseTo(0.2, 9);
    expect(bothEyesClosed(s)).toBe(false);
    expect(bothEyesClosed(scoresFromCategories(detection({ closed: true }).faceBlendshapes[0].categories))).toBe(true);
    expect(headPoseFromMatrix(d.facialTransformationMatrixes[0].data).yaw).toBeCloseTo(18, 4);
  });
  it('a turned head moves the pose and leaves the gaze where it was', () => {
    const straight = detection({ h: 0.5, v: -0.4 }), turned = detection({ h: 0.5, v: -0.4, yaw: 30, pitch: 12 });
    const g0 = eyeGazeFromScores(scoresFromCategories(straight.faceBlendshapes[0].categories));
    const g1 = eyeGazeFromScores(scoresFromCategories(turned.faceBlendshapes[0].categories));
    expect(g1).toEqual(g0);
    expect(headPoseFromMatrix(turned.facialTransformationMatrixes[0].data).yaw).toBeCloseTo(30, 4);
  });
  it('an empty or missing category list is an empty record', () => {
    expect(scoresFromCategories([])).toEqual({}); expect(scoresFromCategories(undefined)).toEqual({});
  });
  it('keeps the ten eye blendshapes and drops the other 42 the detection brings', () => {
    const s = scoresFromCategories([{ categoryName: 'jawOpen', score: 0.8 }, { categoryName: 'eyeBlinkLeft', score: 0.4 }]);
    expect(s).toEqual({ eyeBlinkLeft: 0.4 });
    expect(EYE_BLENDSHAPES).toHaveLength(10);
    expect(Object.keys(gazeScores()).sort()).toEqual([...EYE_BLENDSHAPES].sort());
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted:
//   · pitch without the minus (`asin(m[9])`)                          → «comes back as the head», «turning and tilting apart»
//   · the arcsine not clamped                                          → «does not blow up»
//   · the length guard dropped (`!m`)                                  → «is null without a matrix»
//   · the right eye's h as out − in                                    → «comes back as the gaze», «towards the player's LEFT»
//   · v as up − down                                                   → «comes back as the gaze», «towards … DOWN»
//   · a missing score not defaulted (`s?.[n]`)                         → «reads a missing score as zero»
//   · both eyes closed by the MORE closed eye (`Math.max`)             → «is true only when BOTH lids pass»
//   · the mark as a strict bound (`>`)                                 → «holds the mark as a boundary»
//   · every category kept (no filter)                                  → «keeps the ten eye blendshapes»
