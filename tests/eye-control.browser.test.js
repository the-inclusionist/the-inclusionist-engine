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
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
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
  t: translate, doc: document, region, base: location.href, hasFile: async () => true, loop,
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
  // 🔴 ADR-0232 D4: the checked cache is the ROOT's, and the loader asks it through the control — not through a global.
  it('hands the loader the page and the cache question it was given', async () => {
    const asked = [];
    const hasFile = async () => true;
    await make({ hasFile, loadTracker: async (deps) => { asked.push(deps); return { ok: true, tracker: tracker() }; } }).apply(true);
    expect(asked).toEqual([{ base: location.href, hasFile }]);
  });

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

describe('what the probe of 2026-09-23 found unheld', () => {
  /*
   * 🔴 Fifteen of twenty-four decisions of the frame could be undone with this file green: the frame is WIRING, and wiring is only
   * seen from a page. What reaches the drawing is observed by RECORDING the calls on the canvas's own 2D context — the only way to
   * see what the frame hands the overlay without comparing pixels.
   */
  const recordDrawing = (canvas) => {
    const calls = [];
    const real = canvas.getContext.bind(canvas);
    canvas.getContext = (kind) => new Proxy(real(kind), {
      get: (target, key) => (typeof target[key] === 'function' ? (...args) => { calls.push([key, ...args]); return target[key](...args); } : target[key]),
      set: (target, key, value) => { target[key] = value; return true; },
    });
    return calls;
  };
  const texts = (calls) => calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  const armUp = () => { look({}, 3200); look({ v: 0.3 }, 300); look({ v: -0.3 }, 1900); };

  it('a camera with no frame yet reads nothing — no reading, no diagnosis, no «ready»', async () => {
    await make({ openFeed: async () => ({ frame: {}, ready: () => false, close: () => {} }) }).apply(true);
    look({}, 4000);
    expect(region.querySelector('canvas.gaze-overlay').dataset.face).toBeUndefined();
    expect(said).toEqual([said[0]]);
  });

  it('«ready» is said ONCE, when the rest is first measured — not again on every ready frame', async () => {
    await make().apply(true);
    look({}, 3200); look({}, 2000);
    expect(said.filter((s) => s.startsWith('Pronto'))).toHaveLength(1);
  });

  it('once ready, both eyes closed for two seconds press START', async () => {
    await make().apply(true);
    look({}, 3200);
    look({ closed: true }, 2200);
    expect(keys[0]).toEqual(['press', 'start', 'olhos']);
  });

  it('a head that moves fast freezes the cycle: an armed gaze is not taken for one that left', async () => {
    await make().apply(true);
    armUp();
    for (let i = 0; i < 10; i++) { face = detection({ v: -0.3, yaw: i % 2 ? 20 : 0 }); now += 33; frameCb?.(now); }
    expect(keys, 'a turning head was read as the gaze leaving, and the preview was pressed').toEqual([]);
  });

  it('a reader re-centring under a held gaze cancels the gesture: what was held was never a decision', async () => {
    await make().apply(true);
    const c = region.querySelector('canvas.gaze-overlay');
    look({}, 3200); look({ v: 0.3 }, 300);
    look({ v: -0.3 }, 12500); // parked for over 10 s: the reader starts moving its rest under the gaze
    expect(c.dataset.reason, 'the case never reached the re-centring it is about').toBe('recentring');
    expect(c.dataset.zone, 'the zone is still in the reader\'s hand while it re-centres').toBe('up');
    expect(c.dataset.armed, 'a re-centring reader left the gesture armed: leaving would press whatever it showed').toBe('false');
    expect(keys).toEqual([]);
  });

  it('the diagnosis says when there is no face, and when the zone in hand is armed', async () => {
    await make().apply(true);
    const c = region.querySelector('canvas.gaze-overlay');
    armUp();
    expect(c.dataset.armed).toBe('true');
    face = null; now += 33; frameCb?.(now);
    expect(c.dataset.face).toBe('false');
  });

  it('the drawing is the game region\'s size', async () => {
    await make().apply(true);
    look({}, 100);
    const c = region.querySelector('canvas.gaze-overlay');
    expect([c.width, c.height]).toEqual([720, 360]);
  });

  it('while the rest is measured the middle counts down, from what is left', async () => {
    await make().apply(true);
    const calls = recordDrawing(region.querySelector('canvas.gaze-overlay'));
    look({}, 1000);
    const count = texts(calls).filter((s) => / s$/.test(s)).at(-1);
    expect(Number(count.split(' ')[0])).toBeCloseTo(2.0, 0);
  });

  it('the drawing gets the zone, the preview and the face\'s lines', async () => {
    const lined = () => ({ ...tracker(), eyeLines: { eyes: [{ start: 33, end: 133 }], brows: [] } });
    await make({ loadTracker: async () => ({ ok: true, tracker: lined() }) }).apply(true);
    const calls = recordDrawing(region.querySelector('canvas.gaze-overlay'));
    // the synthetic face leaves its landmarks out «until a test draws them»: this one does
    const marks = Array.from({ length: 478 }, (_, i) => ({ x: 0.3 + (i % 10) / 50, y: 0.4 + (i % 7) / 50 }));
    for (const end = now + 3200; now < end;) { face = { ...detection({}), faceLandmarks: [marks] }; now += 33; frameCb?.(now); }
    expect(calls.some((c) => c[0] === 'lineTo'), 'the face\'s lines were not drawn').toBe(true);
    calls.length = 0; look({ v: 0.3 }, 200);
    // looking down, unarmed, prepares «up»: the down region tells the child where to go next
    expect(texts(calls), 'the zone in hand was not drawn as preparing').toContain('Suba!');
    calls.length = 0; look({ v: -0.3 }, 1900);
    expect(calls.some((c) => c[0] === 'stroke' && c[1] instanceof Path2D), 'the preview\'s arrow was not drawn').toBe(true);
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
// And on 2026-09-23 (`scratchpad/sonda-eyectl.py`), fifteen of twenty-four decisions of the frame were blind; fourteen are held by the
// block «what the probe found unheld». The fifteenth is EQUIVALENT and has no case: the countdown's `Math.max(0, …)` never acts, because
// the countdown exists only before the rest is ready, and the rest is ready the moment the still time reaches the rest time.
