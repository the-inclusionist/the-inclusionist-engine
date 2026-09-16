// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH THE FACE, PUT TOGETHER (ADR-0210, ADR-0212 §3; issue #191). The camera and the tracker are replaced by a synthetic face whose
// blendshapes a case chooses; frames arrive when the case says. Measured: the rest measures itself on a still face, nothing commands
// before it, an expression presses its action on the virtual controller from `rosto`, a lost face lets go, what cannot start turns 🧑 off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFaceControl } from '../app/js/ui/face-control.js';

let region, presses, said, reports, offs, face, frameCb, now;
const loop = { requestFrame: (cb) => { frameCb = cb; return 1; }, cancelFrame: () => { frameCb = null; }, now: () => now, every: () => 2, stopEvery: () => {} };
const detection = (scores) => ({ faceBlendshapes: [{ categories: Object.entries(scores).map(([categoryName, score]) => ({ categoryName, score })) }], faceLandmarks: [[]] });
const make = (over = {}) => createFaceControl({
  doc: document, region, base: location.href, loop,
  controller: { press: (a, s) => presses.push(['press', a, s]), release: (a, s) => presses.push(['release', a, s]) },
  say: (s) => said.push(s), alert: () => {}, report: (l) => reports.push(l), turnOff: () => { offs++; },
  loadTracker: async () => ({ ok: true, tracker: { detect: () => face, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, faceLines: { eyes: [], brows: [], lips: [] }, close: () => {} } }),
  openFeed: async () => ({ frame: {}, ready: () => true, close: () => {} }),
  ...over,
});
const hold = (scores, ms) => { face = scores ? detection(scores) : null; for (const end = now + ms; now < end;) { now += 33; frameCb?.(now); } };
const RELAXED = { jawOpen: 0.05, mouthPucker: 0.2 };

beforeEach(() => {
  region = document.createElement('div');
  Object.assign(region.style, { position: 'relative', width: '720px', height: '360px' });
  document.body.appendChild(region);
  presses = []; said = []; reports = []; offs = 0; face = null; frameCb = null; now = 0;
});
afterEach(() => { region.remove(); });

describe('the face control', () => {
  it('asks for the middle, measures the rest on a still face and says ready', async () => {
    await make().apply('on');
    expect(said[0]).toMatch(/rosto parado/);
    hold(RELAXED, 3100);
    expect(said).toContain('Pronto: já pode jogar com o rosto.');
  });
  it('nothing commands before the rest: an open mouth while it is measured presses nothing', async () => {
    await make().apply('on');
    hold({ jawOpen: 0.9 }, 1000);
    expect(presses).toEqual([]);
  });
  it('after the rest, an open mouth held presses action 2 from the face, and closing it releases', async () => {
    await make().apply('on');
    hold(RELAXED, 3100);
    hold({ ...RELAXED, jawOpen: 0.9 }, 800);
    hold(RELAXED, 200);
    expect(presses).toEqual([['press', 'action2', 'rosto'], ['release', 'action2', 'rosto']]);
  });
  it('a face that leaves the camera lets go of what it held', async () => {
    await make().apply('on');
    hold(RELAXED, 3100);
    hold({ ...RELAXED, jawOpen: 0.9 }, 800);
    hold(null, 100);
    expect(presses.at(-1)).toEqual(['release', 'action2', 'rosto']);
  });
  it('files not on the device: reported and 🧑 back to off; turning it off removes the drawing', async () => {
    await make({ loadTracker: async () => ({ ok: false, missing: ['visao:modelo:rosto'] }) }).apply('lines');
    expect(reports[0]).toMatch(/face control: visao:modelo:rosto/); expect(offs).toBe(1);
    const c = make();
    await c.apply('lines');
    expect(region.querySelector('canvas.face-overlay')).not.toBeNull();
    await c.apply('off');
    expect(region.querySelector('canvas.face-overlay')).toBeNull(); expect(frameCb).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-face-control.py`:
//   · the reader created before the rest                  → «nothing commands before the rest»
//   · presses from the eyes' source                       → «presses action 2 from the face»
//   · no release when the face is lost                    → «lets go of what it held»
//   · no turnOff on missing files                         → «back to off»
