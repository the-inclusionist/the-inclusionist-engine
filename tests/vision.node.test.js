// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FACE LANDMARKER AND THE CAMERA, FROM THE GAME'S OWN ORIGIN (ADR-0213, ADR-0177; issue #196). The bundle, the cache and the camera
// are injected: what is checked is the address each file is asked at, what happens when a file is missing, and the GPU → CPU way out.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { loadFaceTracker, openCamera, closeCamera, FACE_VISION_FILES } from '../app/js/platform/vision.js';
import { PESADOS } from '../app/js/platform/pesados.js';

const BASE = 'https://game.example/play/index.html';
const upstream = (id) => PESADOS.find((p) => p.id === id).url;
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake `tasks-vision`: records what it was asked, and fails the GPU as told. */
const fakeVision = ({ gpuCreate = true, gpuFrame = true, cpuCreate = true } = {}) => {
  const log = { imported: null, wasmBase: null, created: [], closed: [] };
  const make = (delegate) => ({
    detectForVideo(frame, ms) {
      if (delegate === 'GPU' && !gpuFrame) throw new Error('No support of const');
      return { faceBlendshapes: [{ categories: [] }], frame, ms, delegate };
    },
    close() { log.closed.push(delegate); },
  });
  const c = (a, b) => [{ start: a, end: b }];
  const vision = {
    FilesetResolver: { forVisionTasks: async (base) => { log.wasmBase = base; return { base }; } },
    FaceLandmarker: {
      FACE_LANDMARKS_LEFT_EYE: c(1, 2), FACE_LANDMARKS_RIGHT_EYE: c(3, 4), FACE_LANDMARKS_LEFT_IRIS: c(5, 6),
      FACE_LANDMARKS_RIGHT_IRIS: c(7, 8), FACE_LANDMARKS_LEFT_EYEBROW: c(9, 10), FACE_LANDMARKS_RIGHT_EYEBROW: c(11, 12),
      FACE_LANDMARKS_LIPS: c(13, 14), FACE_LANDMARKS_TESSELATION: c(15, 16),
      createFromOptions: async (_fileset, options) => {
        const d = options.baseOptions.delegate;
        log.created.push({ delegate: d, model: options.baseOptions.modelAssetPath, options });
        if ((d === 'GPU' && !gpuCreate) || (d === 'CPU' && !cpuCreate)) throw new Error(`${d} refused`);
        return make(d);
      },
    },
  };
  return { log, importBundle: async (u) => { log.imported = u; return vision; } };
};
const all = async () => true;

describe('loading the face reader', () => {
  it('asks for every file at pesados/<host><path> beside the PAGE, by an absolute address', async () => {
    const v = fakeVision();
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: v.importBundle });
    expect(r.ok).toBe(true);
    expect(v.log.imported).toBe('https://game.example/play/pesados/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs');
    expect(v.log.wasmBase).toBe('https://game.example/play/pesados/cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
    expect(v.log.created[0].model).toBe('https://game.example/play/pesados/storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task');
  });
  it('asks for blendshapes and the pose matrix, one face, in video mode', async () => {
    const v = fakeVision();
    await loadFaceTracker({ base: BASE, hasFile: all, importBundle: v.importBundle });
    expect(v.log.created[0].options).toMatchObject({ runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
  });
  it('a file missing from the checked cache loads nothing, and says which', async () => {
    const v = fakeVision();
    const model = upstream('visao:modelo:rosto');
    const r = await loadFaceTracker({ base: BASE, hasFile: async (u) => u !== model, importBundle: v.importBundle });
    expect(r).toEqual({ ok: false, missing: ['visao:modelo:rosto'] });
    expect(v.log.imported).toBeNull();
  });
  it('checks the four files the face needs, by their upstream address — the cache key', async () => {
    const asked = [];
    await loadFaceTracker({ base: BASE, hasFile: async (u) => { asked.push(u); return false; }, importBundle: fakeVision().importBundle });
    expect(FACE_VISION_FILES).toEqual(['visao:runtime', 'visao:runtime:cola', 'visao:runtime:wasm', 'visao:modelo:rosto']);
    expect(asked).toEqual(FACE_VISION_FILES.map(upstream));
  });
});

describe('the lines drawn over the game', () => {
  it('are the eyes with their irises and the brows the bundle ships — no lips, no mesh', async () => {
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: fakeVision().importBundle });
    expect(r.tracker.eyeLines.eyes.map((l) => l.start)).toEqual([1, 3, 5, 7]);
    expect(r.tracker.eyeLines.brows.map((l) => l.start)).toEqual([9, 11]);
  });
});

describe('GPU first, CPU as the way out', () => {
  it('runs on the GPU when it can', async () => {
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: fakeVision().importBundle });
    expect(r.tracker.delegate()).toBe('GPU');
    expect(r.tracker.detect('frame', 16).delegate).toBe('GPU');
  });
  it('a GPU that cannot create the landmarker gives way to the CPU', async () => {
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: fakeVision({ gpuCreate: false }).importBundle });
    expect(r.tracker.delegate()).toBe('CPU'); expect(r.tracker.detect('f', 1).delegate).toBe('CPU');
  });
  it('a GPU that fails on a frame reads nothing on that frame, closes, and the CPU takes over', async () => {
    const v = fakeVision({ gpuFrame: false });
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: v.importBundle });
    expect(r.tracker.detect('f', 1)).toBeNull();
    expect(v.log.closed).toEqual(['GPU']); expect(r.tracker.delegate()).toBe('CPU');
    await tick();
    expect(r.tracker.detect('f', 2).delegate).toBe('CPU');
  });
  it('a CPU that cannot be built either makes the next frame throw, so the loop can say it', async () => {
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: fakeVision({ gpuFrame: false, cpuCreate: false }).importBundle });
    expect(r.tracker.detect('f', 1)).toBeNull();
    await tick();
    expect(() => r.tracker.detect('f', 2)).toThrow('CPU refused');
  });
  it('close lets the landmarker go, and a CPU that arrives after it is closed too', async () => {
    const v = fakeVision({ gpuFrame: false });
    const r = await loadFaceTracker({ base: BASE, hasFile: all, importBundle: v.importBundle });
    r.tracker.detect('f', 1); r.tracker.close();
    await tick();
    expect(v.log.closed).toEqual(['GPU', 'CPU']); expect(r.tracker.detect('f', 2)).toBeNull();
  });
});

describe('the camera', () => {
  it('opens video only, at 640×480', async () => {
    let asked = null;
    await openCamera({ getUserMedia: async (c) => { asked = c; return {}; } });
    expect(asked).toEqual({ video: { width: 640, height: 480 }, audio: false });
  });
  it('closing stops every track, and a missing stream is not an error', () => {
    const stopped = [];
    closeCamera({ getTracks: () => [{ stop: () => stopped.push(1) }, { stop: () => stopped.push(2) }] });
    expect(stopped).toEqual([1, 2]);
    expect(() => closeCamera(null)).not.toThrow();
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-vision.py`:
//   · the bundle asked by the relative delivery path                → «beside the PAGE, by an absolute address»
//   · the upstream address loaded instead of the delivery path       → «beside the PAGE»
//   · the missing files not checked                                 → «a file missing … loads nothing»
//   · blendshapes not asked                                         → «asks for blendshapes»
//   · no CPU when the GPU cannot create                             → «gives way to the CPU»
//   · a failing GPU frame rethrown                                  → «reads nothing on that frame»
//   · the CPU failure swallowed                                     → «makes the next frame throw»
//   · a late CPU not closed after close                             → «a CPU that arrives after it is closed»
//   · the camera asked with audio                                   → «video only»
