// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH THE EYES, PUT TOGETHER (ADR-0213; issues #194, #196). The camera and the face tracker are replaced by the synthetic face
// (`tests/fixtures/synthetic-face.js`, checked against the engine's own readers), and frames arrive when the case says. What is measured is
// what a child meets: nothing commands before the rest, the gesture presses the virtual controller with the eyes as its source (ADR-0111,
// issue #197), and what cannot start
// is said, reported, and puts the 👀 back to off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEyeControl } from '../app/js/ui/eye-control.js';
import { detection } from './fixtures/synthetic-face.js';

let region, keys, said, alerts, reports, offs, face, feedClosed, trackerClosed, frameCb, now;

const loop = {
  requestFrame: (cb) => { frameCb = cb; return 1; },
  cancelFrame: () => { frameCb = null; },
  now: () => now,
  every: () => 2,
  stopEvery: () => {},
};
const tracker = () => ({ detect: () => face, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, close: () => { trackerClosed = true; } });
const make = (over = {}) => createEyeControl({
  doc: document, region, base: location.href, loop,
  controller: { press: (action, source) => keys.push(['press', action, source]), release: (action, source) => keys.push(['release', action, source]) },
  say: (s) => said.push(s), alert: (s) => alerts.push(s), report: (l) => reports.push(l), turnOff: () => { offs++; },
  loadTracker: async () => ({ ok: true, tracker: tracker() }),
  openFeed: async () => ({ frame: {}, ready: () => true, close: () => { feedClosed = true; } }),
  ...over,
});
/** Frames every 33 ms for `ms`, looking at `gaze`. */
const look = (gaze, ms) => { face = detection(gaze); for (const end = now + ms; now < end;) { now += 33; frameCb?.(now); } };

beforeEach(() => {
  region = document.createElement('div');
  Object.assign(region.style, { position: 'relative', width: '720px', height: '360px' });
  document.body.appendChild(region);
  keys = [];
  said = []; alerts = []; reports = []; offs = 0; face = null; feedClosed = false; trackerClosed = false; frameCb = null; now = 0;
});
afterEach(() => { region.remove(); });

describe('turning it on', () => {
  it('draws over the game region and asks for the middle', async () => {
    await make().apply(true);
    expect(region.querySelector('canvas.gaze-overlay')).not.toBeNull();
    expect(said[0]).toMatch(/meio da tela/);
  });
  it('nothing commands before the rest is measured, however the eyes move', async () => {
    await make().apply(true);
    for (let i = 0; i < 6; i++) { look({ v: 0.3 }, 300); look({ v: -0.3 }, 2000); look({}, 200); }
    expect(keys).toEqual([]);
  });
  it('not even START: both eyes closed for the whole close time before the rest is ready press nothing', async () => {
    await make().apply(true);
    look({ closed: true }, 2500); // the rest needs 3 s, START needs 2 s
    expect(keys).toEqual([]);
  });
  it('after three still seconds it says ready, and down-then-up presses «up» on the virtual controller, from the eyes', async () => {
    await make().apply(true);
    look({}, 3200);
    expect(said).toContain('Pronto: já pode jogar com os olhos.');
    look({ v: 0.3 }, 300);   // the opposite zone: prepares
    look({ v: -0.3 }, 1900); // up, held past cancel onto «up»
    look({}, 600);           // back to the middle: leaving commands
    expect(keys).toEqual([['press', 'up', 'olhos'], ['release', 'up', 'olhos']]);
  });
  it('only the RIGHT eye is read: the same gesture made by the left eye alone commands nothing', async () => {
    const oneEye = (gaze, which) => {
      const d = detection(gaze);
      const still = new Set(which === 'right' ? ['eyeLookUpLeft', 'eyeLookDownLeft'] : ['eyeLookUpRight', 'eyeLookDownRight']);
      d.faceBlendshapes[0].categories = d.faceBlendshapes[0].categories.map((c) => (still.has(c.categoryName) ? { ...c, score: 0 } : c));
      return d;
    };
    const run = async (which) => {
      keys.length = 0; now = 0; face = null;
      await make().apply(true);
      const step = (gaze, ms) => { face = oneEye(gaze, which); for (const end = now + ms; now < end;) { now += 33; frameCb?.(now); } };
      step({}, 3200); step({ v: 0.3 }, 300); step({ v: -0.3 }, 1900); step({}, 600);
      return keys.map((k) => k[0]);
    };
    expect(await run('left')).toEqual([]);
    expect(await run('right')).toEqual(['press', 'release']);
  });
  it('the drawing\'s element carries the reading, so a child who is not answered can be diagnosed', async () => {
    await make().apply(true);
    const c = region.querySelector('canvas.gaze-overlay');
    look({}, 1000);
    expect(c.dataset).toMatchObject({ face: 'true', ready: 'false', reason: 'measuring-rest' });
    look({}, 2400);
    look({ v: 0.3 }, 200);
    expect(c.dataset).toMatchObject({ ready: 'true', zone: 'down', tremorV: '0.02' });
    expect(Number(c.dataset.dv)).toBeGreaterThan(4);
  });
  it('a frame with no face commands nothing', async () => {
    await make().apply(true);
    look({}, 3200);
    look({ v: 0.3 }, 300);
    look({ v: -0.3 }, 1900);
    face = null; for (let i = 0; i < 30; i++) { now += 33; frameCb?.(now); }
    expect(keys).toEqual([]);
  });
});

describe('what cannot start', () => {
  it('files not on the device: said, reported, 👀 back to off, no camera and nothing drawn', async () => {
    let opened = false;
    await make({ loadTracker: async () => ({ ok: false, missing: ['visao:modelo:rosto'] }), openFeed: async () => { opened = true; } }).apply(true);
    expect(alerts).toHaveLength(1); expect(reports[0]).toMatch(/visao:modelo:rosto/); expect(offs).toBe(1);
    expect(opened).toBe(false); expect(region.querySelector('canvas')).toBeNull();
  });
  it('a camera that does not open: said, reported, 👀 back to off, the tracker let go', async () => {
    await make({ openFeed: async () => { throw new Error('NotAllowedError'); } }).apply(true);
    expect(reports[0]).toMatch(/camera did not open/); expect(offs).toBe(1); expect(trackerClosed).toBe(true);
    expect(region.querySelector('canvas')).toBeNull();
  });
});

describe('turning it off', () => {
  it('lets the camera and the tracker go, removes the drawing and releases a held key', async () => {
    const eyes = make();
    await eyes.apply(true);
    look({}, 3200); look({ v: 0.3 }, 300); look({ v: -0.3 }, 1900); look({}, 100); // pressed, pulse still on
    await eyes.apply(false);
    expect(feedClosed).toBe(true); expect(trackerClosed).toBe(true);
    expect(region.querySelector('canvas')).toBeNull();
    expect(keys.at(-1)).toEqual(['release', 'up', 'olhos']);
    look({ v: 0.3 }, 300);
    expect(frameCb).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-eye-control.py`:
//   · commands before the rest (not frozen while not ready)   → «not even START» (a first plan measured only zones, and the reader
//     already gives none before the rest, so the mutation survived: what the freeze protects there is the eyes-closed START)
//   · a frame with no face not frozen                          → «no face commands nothing»
//   · the left eye read instead of the right                   → «only the RIGHT eye is read»
//   · no turnOff on missing files                              → «files not on the device»
//   · the tracker kept when the camera fails                   → «camera that does not open»
//   · the held key not released on off                        → «releases a held key»
