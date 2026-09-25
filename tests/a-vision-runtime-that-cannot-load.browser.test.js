// SPDX-License-Identifier: AGPL-3.0-or-later
// A VISION RUNTIME THAT CANNOT LOAD IS SAID, NOT SWALLOWED (ADR-0169, ADR-0215).
//
// 🔴 MEASURED BY THE LEAD IN A REAL PAGE, 2026-09-25: served by a server that sends `.mjs` as `text/plain` (Python's
// `http.server` on Windows), `import(<page>/heavy/…/vision_bundle.mjs)` rejects, and after the child turned the 📷 to its
// hands position the icon STAYED on, nothing was said and `problems` stayed empty — 20 s later. The same page on a server with
// the right MIME worked, and a camera the browser refused WAS said. The difference: the camera's failure is caught inside the
// control, and the loader's rejection travelled up through `apply` into `followCameraMode`'s `void`, where it died unhandled.
//
// So each case goes through the REAL loader (`platform/vision`) with only the browser's edge replaced: the import (a real
// `import()` of a text/plain module and of an address that is not there), the vision task that refuses to be built, and a
// model the install did not keep because its sha256 did not match. For the three camera controls alike, the child hears the
// reason, `problems` gains one line naming the subject, what it costs and the fix, the 📷 goes back to off, and turning it on
// again tries again.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHandControl } from '../app/js/ui/hand-control.js';
import { createFaceControl } from '../app/js/ui/face-control.js';
import { createEyeControl } from '../app/js/ui/eye-control.js';
import { loadFaceTracker, loadHandTracker } from '../app/js/platform/vision.js';
import { HEAVY_FILES } from '../app/js/platform/heavy.js';
import { createTranslator } from '../app/js/core/i18n.js';

const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
const urlOf = (id) => HEAVY_FILES.find((p) => p.id === id).url;

const MODES = [
  { name: 'hands', create: createHandControl, load: loadHandTracker, subject: 'gesture control', model: 'visao:modelo:gestos', key: 'hands', overlay: 'canvas.hand-overlay' },
  { name: 'face', create: createFaceControl, load: loadFaceTracker, subject: 'face control', model: 'visao:modelo:rosto', key: 'face', overlay: 'canvas.face-overlay' },
  { name: 'eyes', create: createEyeControl, load: loadFaceTracker, subject: 'eye control', model: 'visao:modelo:rosto', key: 'eyes', overlay: 'canvas.gaze-overlay' },
];

/** A vision task the fake bundle builds, or refuses to build. */
const task = () => ({ detectForVideo: () => ({}), recognizeForVideo: () => ({}), close: () => {} });
/** The part of `tasks-vision` the loader reads, with `create` answering both the face and the hands. */
const fakeVision = (create = async () => task()) => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  FaceLandmarker: {
    createFromOptions: create,
    FACE_LANDMARKS_LEFT_EYE: [], FACE_LANDMARKS_RIGHT_EYE: [], FACE_LANDMARKS_LEFT_IRIS: [], FACE_LANDMARKS_RIGHT_IRIS: [],
    FACE_LANDMARKS_LEFT_EYEBROW: [], FACE_LANDMARKS_RIGHT_EYEBROW: [], FACE_LANDMARKS_LIPS: [],
  },
  GestureRecognizer: { createFromOptions: create, HAND_CONNECTIONS: [] },
});

/** The browser's own refusal: a module served as `text/plain`, which is what Python's `http.server` does with `.mjs` on Windows. */
const importTextPlain = () => import(/* @vite-ignore */ URL.createObjectURL(new Blob(['export const x = 1;'], { type: 'text/plain' })));
/** The browser's own refusal of an address that is not there. */
const importMissing = () => import(/* @vite-ignore */ new URL(`/heavy/not-here-${Math.random().toString(36).slice(2)}.mjs`, location.href).href);

let region, said, alerts, reports, offs, opened, loads;
const loop = { requestFrame: () => 1, cancelFrame: () => {}, now: () => 0, every: () => 2, stopEvery: () => {} };

/** One control of `mode`, whose loader is the real one over the given import and checked cache. */
const make = (mode, { importBundle, hasFile = async () => true } = {}) => mode.create({
  t: translate, doc: document, region, base: location.href, hasFile, loop,
  controller: { press: () => {}, release: () => {} },
  say: (s) => said.push(s), alert: (s) => alerts.push(s), report: (l) => reports.push(l), turnOff: () => { offs++; },
  loadTracker: (deps) => { loads++; return mode.load({ ...deps, importBundle }); },
  openFeed: async () => { opened++; return { frame: {}, ready: () => false, close: () => {} }; },
});

beforeEach(() => {
  region = document.createElement('div');
  Object.assign(region.style, { position: 'relative', width: '720px', height: '360px' });
  document.body.appendChild(region);
  said = []; alerts = []; reports = []; offs = 0; opened = 0; loads = 0;
});
afterEach(() => { region.remove(); });

describe.each(MODES)('the $name control, when its vision runtime cannot load', (mode) => {
  const failedLine = new RegExp(`^${mode.subject}: the vision runtime did not load \\(.+\\) — the child cannot play with .+; `);

  it('🔴 [Error] the runtime served as text/plain: the child hears why, one line in problems, the 📷 back to off', async () => {
    const c = make(mode, { importBundle: importTextPlain });
    await expect(c.apply(true), 'the rejection reached `followCameraMode`, which drops it').resolves.toBeUndefined();
    expect(alerts, 'nothing was said to the child').toEqual([translate(`sr.${mode.key}.failed`)]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(failedLine);
    expect(reports[0], 'the line does not carry what the browser said').toMatch(/dynamically imported module|MIME|module script/i);
    expect(reports[0], 'the line does not name the fix').toMatch(/text\/javascript/);
    expect(offs, 'the 📷 stayed on over a camera control that never started').toBe(1);
    expect(opened, 'the camera was opened with no reader to feed').toBe(0);
    expect(region.querySelector('canvas'), 'something was drawn over the game').toBeNull();
  });

  it('🔴 [Error] the runtime is not at its address (404): said, reported, back to off', async () => {
    await make(mode, { importBundle: importMissing }).apply(true);
    expect(alerts).toEqual([translate(`sr.${mode.key}.failed`)]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(failedLine);
    expect(offs).toBe(1);
  });

  it('🔴 [Error] the vision task refuses to be built on the GPU and on the CPU: said, reported, back to off', async () => {
    const refused = async () => { throw new Error('the model could not be read'); };
    await make(mode, { importBundle: async () => fakeVision(refused) }).apply(true);
    expect(alerts).toEqual([translate(`sr.${mode.key}.failed`)]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatch(failedLine);
    expect(reports[0]).toContain('the model could not be read');
    expect(offs).toBe(1);
    expect(opened).toBe(0);
  });

  it('[Error] a model whose sha256 did not match was never kept: it is named as missing, and the runtime is not even imported', async () => {
    let imported = 0;
    const model = urlOf(mode.model);
    await make(mode, { importBundle: async () => { imported++; return fakeVision(); }, hasFile: async (u) => u !== model }).apply(true);
    expect(imported).toBe(0);
    expect(alerts).toEqual([translate(`sr.${mode.key}.needsInternet`)]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toContain(mode.model);
    expect(offs).toBe(1);
  });

  it('🔴 [Boundary] turning it on again tries again — said again, reported ONCE, and a load that now works starts', async () => {
    let tries = 0;
    const c = make(mode, { importBundle: async (u) => { tries++; if (tries === 1) return importTextPlain(u); return fakeVision(); } });
    await c.apply(true);
    await c.apply(false); // what the root does when the control turns the 📷 off
    await c.apply(true);
    expect(loads, 'the second press did not try to load again').toBe(2);
    expect(reports, 'problems is read by an adult once: the same failure is one line').toHaveLength(1);
    expect(alerts).toHaveLength(1);
    expect(region.querySelector(mode.overlay), 'the second try, which could load, did not start').not.toBeNull();
    await c.apply(false);
  });

  it('⚠️ [Boundary] every failed try is said to the child, and written once', async () => {
    const c = make(mode, { importBundle: importTextPlain });
    await c.apply(true);
    await c.apply(false);
    await c.apply(true);
    expect(alerts).toHaveLength(2);
    expect(reports).toHaveLength(1);
    expect(offs).toBe(2);
  });

  it('🔴 [Boundary] a load that fails AFTER the 📷 moved on says nothing and does not turn the 📷 off again', async () => {
    let fail;
    const c = make(mode, { importBundle: () => new Promise((_, reject) => { fail = reject; }) });
    const going = c.apply(true);
    await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); // the loader reaches the import
    const off = c.apply(false);
    fail(new TypeError('Failed to fetch dynamically imported module'));
    await going; await off;
    expect(offs, 'a failure nobody waits for turned the 📷 off over another mode the child chose since').toBe(0);
    expect(alerts, 'a failure nobody waits for was announced').toEqual([]);
  });
});

// MUTATIONS CHECKED (2026-09-25) — each red before this file counted; the unmutated code of 66a5ac8b was red in 18 of these 21
// cases (the three sha256 ones were already right: a file the install did not keep is named as missing):
//   C1  `ui/camera-control`: the loader's rejection rethrown instead of caught    🔴 18 — every runtime case, all three modes
//   C2  the runtime failure says the «files» sentence                              🔴 9 — the three runtime cases × 3
//   C3  the line without what broke                                                🔴 6 — text/plain · task refused
//   C4  a model not kept (sha256) says the «runtime» sentence                      🔴 3 — sha256 × 3
//   C5–C7  hands · face · eyes: a failure after the 📷 moved on not ignored          🔴 1 each — «AFTER the 📷 moved on»
//   C8–C10 hands · face · eyes: the 📷 not turned back off                          🔴 5 each
//   C11 hands: `problems` written on every try                                     🔴 «written once»
//   C12 hands: a failed runtime never tried again                                  🔴 «tries again» · «written once»
//   C13 eyes: the child not told (the alert dropped)                               🔴 6
