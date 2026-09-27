// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH HAND GESTURES, PUT TOGETHER (ADR-0210, ADR-0215; issues #191, #199). The camera and the Gesture Recognizer are replaced by a
// synthetic hand whose recognised gesture a case chooses; frames arrive when the case says. Measured: a gesture held presses its action on
// the virtual controller from `gestos`, a lost hand lets go, the hand's bones are drawn, what cannot start turns the 📷 off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHandControl } from '../app/js/ui/hand-control.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

let region, presses, said, reports, offs, hand, frameCb, now;
const loop = { requestFrame: (cb) => { frameCb = cb; return 1; }, cancelFrame: () => { frameCb = null; }, now: () => now, every: () => 2, stopEvery: () => {} };
// a hand drawn across the region's left half, so its bone is on the RIGHT once mirrored; custom gestures read nothing on a flat hand
const PONTOS = Array.from({ length: 21 }, (_, i) => ({ x: i === 1 ? 0.2 : 0.3, y: 0.5, z: 0 }));
const detection = (name) => ({ landmarks: [PONTOS], gestures: [[{ categoryName: name, score: 0.9 }]] });
const make = (over = {}) => createHandControl({
  t: translate, doc: document, region, base: location.href, hasFile: async () => true, loop,
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
  // 🔴 ADR-0232 D4: the checked cache is the ROOT's, and the loader asks it through the control — not through a global.
  it('hands the loader the page and the cache question it was given', async () => {
    const asked = [];
    const hasFile = async () => true;
    await make({ hasFile, loadTracker: async (deps) => { asked.push(deps); return { ok: false, missing: ['x'] }; } }).apply(true);
    expect(asked).toEqual([{ base: location.href, hasFile }]);
  });

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
  /*
   * 🔴 THE HAND'S BONES ARE OPAQUE WHITE WITH A BLACK SHADOW (ADR-0250 §1, superseding ADR-0212 §4's 20–50 % opacity). The case
   * above sees that a bone is painted; a translucent one is painted too. So the style in force at each stroke is written down.
   */
  it('🔴 [Right] the hand\'s bones are stroked opaque white, at full opacity, over a black shadow', async () => {
    const strokes = [];
    const docQueTraca = {
      createElement: (tag) => {
        const el = document.createElement(tag);
        if (tag !== 'canvas') return el;
        const real = el.getContext.bind(el);
        el.getContext = (kind) => new Proxy(real(kind), {
          get: (t, p) => (p === 'stroke'
            ? (...r) => { strokes.push({ style: t.strokeStyle, alpha: t.globalAlpha, shadow: t.shadowColor }); return t.stroke(...r); }
            : typeof t[p] === 'function' ? t[p].bind(t) : t[p]),
          set: (t, p, v) => { t[p] = v; return true; },
        });
        return el;
      },
    };
    await make({ doc: docQueTraca }).apply(true);
    hold('None', 100);
    expect(strokes.length, 'no bone was stroked — the case would measure nothing').toBeGreaterThan(0);
    const styles = new Set(strokes.map((s) => JSON.stringify(s)));
    expect([...styles], 'a bone over the game is not opaque white on black')
      .toEqual([JSON.stringify({ style: '#ffffff', alpha: 1, shadow: '#000000' })]);
  });
  it('🔴 [Right] changing gesture lets go of the old one and presses the new one ONCE', async () => {
    // Only a LOST hand had a case; a hand that goes from one gesture to another could keep both held, or press again every frame.
    await make().apply(true);
    hold('Thumb_Up', 700);
    hold('Thumb_Down', 700);
    expect(presses.filter(([o, a]) => o === 'press' && a === 'leftShoulder'), 'a held gesture pressed again').toHaveLength(1);
    expect(presses).toContainEqual(['release', 'leftShoulder', 'gestos']);
    expect(presses).toContainEqual(['press', 'leftTrigger', 'gestos']);
  });
  it('🔴 [Right] a hand that comes back must be held again — the gap is not bridged', async () => {
    // Losing the hand starts the reading over; otherwise a hand that flickers out for a frame comes back pressing at once.
    await make().apply(true);
    hold('Thumb_Up', 700);
    hold(null, 33);
    presses.length = 0;
    hold('Thumb_Up', 100);
    expect(presses, 'a returning hand pressed before it was held').toEqual([]);
  });
  it('🔴 [Right] only the recognizer\'s TOP answer counts — a runner-up is not a gesture', async () => {
    await make().apply(true);
    hand = { landmarks: [PONTOS], gestures: [[{ categoryName: 'None', score: 0.6 }, { categoryName: 'Thumb_Up', score: 0.3 }]] };
    for (const end = now + 700; now < end;) { now += 33; frameCb?.(now); }
    expect(presses).toEqual([]);
  });
  it('[Zero] «None» held presses nothing', async () => {
    await make().apply(true);
    hold('None', 700);
    expect(presses).toEqual([]);
  });
  it('🔴 [Zero] a camera with no frame yet reads nothing', async () => {
    await make({ openFeed: async () => ({ frame: {}, ready: () => false, close: () => {} }) }).apply(true);
    hold('Thumb_Up', 700);
    expect(presses).toEqual([]);
  });
  it('⚠️ [Error] a bone to a landmark the hand does not have is skipped — the frame does not fail', async () => {
    await make({ loadTracker: async () => ({ ok: true, tracker: { detect: () => hand, delegate: () => 'GPU', handLines: [{ start: 0, end: 99 }, { start: 0, end: 1 }], close: () => {} } }) }).apply(true);
    hold('Thumb_Up', 700);
    expect(reports.filter((r) => /a frame failed/.test(r))).toEqual([]);
    expect(presses).toContainEqual(['press', 'leftShoulder', 'gestos']);
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
// (2026-09-27, ADR-0250 §1) — `scratchpad/latch-by-game/mutate.mjs`, restored by SHA-256: the bones' `#ffffff` →
// `rgba(255,255,255,0.35)`, a `globalAlpha = 0.35` before them, and their shadow `#000` → `#fff` → each «stroked opaque white…»
//
// PROBED AGAIN (2026-09-23), eleven decisions of the `frame` disabled one at a time — `scratchpad/sonda-rosto-maos.py`. Nine
// were green, and the press/release diff itself was among them: only a LOST hand had a case, so a hand going from one gesture
// to another could keep both held or press every frame. Held now by the six cases before «files not on the device». Two are
// inert and leave in the cut rather than being pinned: dropping `None` before the map (the map already ignores a name it does
// not know), and clearing the layer (setting the canvas width a line above already clears it).
