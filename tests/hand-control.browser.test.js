// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH HAND GESTURES, PUT TOGETHER (ADR-0210, ADR-0215; issues #191, #199). The camera and the Gesture Recognizer are replaced by a
// synthetic hand whose recognised gesture a case chooses; frames arrive when the case says. Measured: a gesture held presses its action on
// the virtual controller from `gestos`, a lost hand lets go, the hand's bones are drawn, what cannot start turns the 📷 off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHandControl } from '../app/js/ui/hand-control.js';

let region, presses, said, reports, offs, hand, frameCb, now;
const loop = { requestFrame: (cb) => { frameCb = cb; return 1; }, cancelFrame: () => { frameCb = null; }, now: () => now, every: () => 2, stopEvery: () => {} };
// a hand drawn across the region's left half, so its bone is on the RIGHT once mirrored; custom gestures read nothing on a flat hand
const PONTOS = Array.from({ length: 21 }, (_, i) => ({ x: i === 1 ? 0.2 : 0.3, y: 0.5, z: 0 }));
const detection = (name) => ({ landmarks: [PONTOS], gestures: [[{ categoryName: name, score: 0.9 }]] });
const make = (over = {}) => createHandControl({
  doc: document, region, base: location.href, loop,
  controller: { press: (a, s) => presses.push(['press', a, s]), release: (a, s) => presses.push(['release', a, s]) },
  say: (s) => said.push(s), alert: () => {}, report: (l) => reports.push(l), turnOff: () => { offs++; },
  loadTracker: async () => ({ ok: true, tracker: { detect: () => hand, delegate: () => 'GPU', handLines: [{ start: 0, end: 1 }], close: () => {} } }),
  openFeed: async () => ({ frame: {}, ready: () => true, close: () => {} }),
  ...over,
});
const hold = (name, ms) => { hand = name ? detection(name) : null; for (const end = now + ms; now < end;) { now += 33; frameCb?.(now); } };

beforeEach(() => {
  region = document.createElement('div');
  Object.assign(region.style, { position: 'relative', width: '720px', height: '360px' });
  document.body.appendChild(region);
  presses = []; said = []; reports = []; offs = 0; hand = null; frameCb = null; now = 0;
});
afterEach(() => { region.remove(); });

describe('the hand control', () => {
  it('says ready, and a thumb up held presses L1 from the hands', async () => {
    await make().apply(true);
    expect(said).toContain('Pronto: já pode jogar com gestos das mãos.');
    hold('Thumb_Up', 700);
    expect(presses).toContainEqual(['press', 'leftShoulder', 'gestos']);
  });
  it('a hand that leaves the camera lets go of what it held', async () => {
    await make().apply(true);
    hold('Thumb_Up', 700);
    hold(null, 100);
    expect(presses.at(-1)).toEqual(['release', 'leftShoulder', 'gestos']);
  });
  it('draws the hand\'s bones, mirrored — the lines are the mode, not a choice', async () => {
    await make().apply(true);
    hold('None', 100);
    const g = region.querySelector('canvas.hand-overlay').getContext('2d');
    const alpha = (fx) => g.getImageData(Math.round(fx * 720), 180, 1, 1).data[3];
    expect(alpha(0.75), 'mirrored: x 0.3–0.2 is drawn at 0.7–0.8').toBeGreaterThan(0);
    expect(alpha(0.25), 'not unmirrored').toBe(0);
  });
  it('files not on the device: reported and the 📷 back to off; turning it off removes the drawing', async () => {
    await make({ loadTracker: async () => ({ ok: false, missing: ['visao:modelo:gestos'] }) }).apply(true);
    expect(reports[0]).toMatch(/gesture control: visao:modelo:gestos/); expect(offs).toBe(1);
    const c = make();
    await c.apply(true);
    expect(region.querySelector('canvas.hand-overlay')).not.toBeNull();
    await c.apply(false);
    expect(region.querySelector('canvas.hand-overlay')).toBeNull(); expect(frameCb).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-camera.py`:
//   · presses from the face's source                → «presses L1 from the hands»
//   · no release when the hand is lost               → «lets go of what it held»
//   · the bones not mirrored                         → «mirrored»
//   · no turnOff on missing files                    → «back to off»
