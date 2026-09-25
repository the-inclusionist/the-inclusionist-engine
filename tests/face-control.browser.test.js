// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH THE FACE, PUT TOGETHER (ADR-0210, ADR-0212 §3; issue #191). The camera and the tracker are replaced by a synthetic face whose
// blendshapes a case chooses; frames arrive when the case says. Measured: the rest measures itself on a still face, nothing commands
// before it, an expression presses its action on the virtual controller from `rosto`, a lost face lets go, what cannot start turns the 📷 off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFaceControl } from '../app/js/ui/face-control.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

let region, presses, said, reports, offs, face, frameCb, now;
const loop = { requestFrame: (cb) => { frameCb = cb; return 1; }, cancelFrame: () => { frameCb = null; }, now: () => now, every: () => 2, stopEvery: () => {} };
const detection = (scores, landmarks = []) => ({ faceBlendshapes: [{ categories: Object.entries(scores).map(([categoryName, score]) => ({ categoryName, score })) }], faceLandmarks: [landmarks] });
/**
 * A document whose canvases write down the TEXT drawn on them: the request for the middle and its countdown are text, and a case
 * cannot read text back from pixels.
 */
const escritos = [];
const docQueGrava = {
  createElement: (tag) => {
    const el = document.createElement(tag);
    if (tag !== 'canvas') return el;
    const real = el.getContext.bind(el);
    el.getContext = (kind) => {
      const g = real(kind);
      return new Proxy(g, {
        get: (t, p) => (p === 'fillText' ? (s, ...r) => { escritos.push(s); return t.fillText(s, ...r); }
          : typeof t[p] === 'function' ? t[p].bind(t) : t[p]),
        set: (t, p, v) => { t[p] = v; return true; },
      });
    };
    return el;
  },
};
const make = (over = {}) => createFaceControl({
  t: translate, doc: document, region, base: location.href, loop,
  controller: { press: (a, s) => presses.push(['press', a, s]), release: (a, s) => presses.push(['release', a, s]) },
  say: (s) => said.push(s), alert: () => {}, report: (l) => reports.push(l), turnOff: () => { offs++; },
  loadTracker: async () => ({ ok: true, tracker: { detect: () => face, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, faceLines: { eyes: [], brows: [], lips: [] }, close: () => {} } }),
  openFeed: async () => ({ frame: {}, ready: () => true, close: () => {} }),
  ...over,
});
const hold = (scores, ms, landmarks) => { face = scores ? detection(scores, landmarks) : null; for (const end = now + ms; now < end;) { now += 33; frameCb?.(now); } };
const PRONTO = 'Pronto: já pode jogar com o rosto.';
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
    await make().apply(true);
    expect(said[0]).toMatch(/rosto parado/);
    hold(RELAXED, 3100);
    expect(said).toContain('Pronto: já pode jogar com o rosto.');
  });
  it('nothing commands before the rest: an open mouth while it is measured presses nothing', async () => {
    await make().apply(true);
    hold({ jawOpen: 0.9 }, 1000);
    expect(presses).toEqual([]);
  });
  it('after the rest, an open mouth held presses action 2 from the face, and closing it releases', async () => {
    await make().apply(true);
    hold(RELAXED, 3100);
    hold({ ...RELAXED, jawOpen: 0.9 }, 800);
    hold(RELAXED, 200);
    expect(presses).toEqual([['press', 'action2', 'rosto'], ['release', 'action2', 'rosto']]);
  });
  it('a face that leaves the camera lets go of what it held', async () => {
    await make().apply(true);
    hold(RELAXED, 3100);
    hold({ ...RELAXED, jawOpen: 0.9 }, 800);
    hold(null, 100);
    expect(presses.at(-1)).toEqual(['release', 'action2', 'rosto']);
  });
  it('🔴 [Right] «ready» is said ONCE — the rest is measured once, not again every frame', async () => {
    await make().apply(true);
    hold(RELAXED, 3100);
    hold({ ...RELAXED, jawOpen: 0.9 }, 800);
    expect(said.filter((s) => s === PRONTO)).toHaveLength(1);
  });
  it('⚠️ [Zero] the frames before the rest do not fail — there is no reader yet, and none is asked', async () => {
    await make().apply(true);
    hold({ jawOpen: 0.9 }, 1000);
    expect(reports.filter((r) => /a frame failed/.test(r))).toEqual([]);
  });
  it('🔴 [Zero] a camera with no frame yet reads nothing — no rest is measured on an empty picture', async () => {
    await make({ openFeed: async () => ({ frame: {}, ready: () => false, close: () => {} }) }).apply(true);
    hold(RELAXED, 3100);
    expect(said).not.toContain(PRONTO);
  });
  it('🔴 [Right] a head that keeps turning is not a rest — the rest waits for the head too', async () => {
    // 455 landmarks, the cheeks still and the nose going side to side: a child looking around, not a child ready.
    const cabeca = (nx) => {
      const p = Array.from({ length: 455 }, () => ({ x: 0.5, y: 0.5 }));
      p[234] = { x: 0.3, y: 0.5 }; p[454] = { x: 0.7, y: 0.5 }; p[1] = { x: nx, y: 0.5 };
      return p;
    };
    await make().apply(true);
    for (let i = 0; i < 100; i++) hold(RELAXED, 33, cabeca(i % 2 ? 0.5 : 0.6));
    expect(said).not.toContain(PRONTO);
  });
  it('🔴 [Right] while the rest is measured the middle counts DOWN, and a face that leaves is still asked for the middle', async () => {
    escritos.length = 0;
    await make({ doc: docQueGrava }).apply(true);
    hold(RELAXED, 1500);
    const contagem = escritos.filter((s) => / s$/.test(s)).map(parseFloat);
    expect(Math.min(...contagem), 'the countdown never went down').toBeLessThan(2);
    escritos.length = 0;
    hold(null, 100);
    expect(escritos, 'the face left before the rest and the middle stopped being asked for').toContain('Olhe aqui');
    hold(RELAXED, 3100);
    escritos.length = 0;
    hold(null, 100);
    expect(escritos, 'after the rest, a face that leaves is not asked for the middle again').toEqual([]);
  });
  it('🔴 [Right] after the rest the face\'s lines are drawn, mirrored', async () => {
    const PONTOS = [{ x: 0.3, y: 0.5 }, { x: 0.2, y: 0.5 }];
    await make({ loadTracker: async () => ({ ok: true, tracker: { detect: () => face, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] },
      faceLines: { eyes: [{ start: 0, end: 1 }], brows: [], lips: [] }, close: () => {} } }) }).apply(true);
    hold(RELAXED, 3100, PONTOS);
    const g = region.querySelector('canvas.face-overlay').getContext('2d');
    const alpha = (fx) => g.getImageData(Math.round(fx * 720), 180, 1, 1).data[3];
    expect(alpha(0.75), 'mirrored: x 0.3–0.2 is drawn at 0.7–0.8').toBeGreaterThan(0);
    expect(alpha(0.25), 'not unmirrored').toBe(0);
  });
  it('files not on the device: reported and the 📷 back to off; turning it off removes the drawing', async () => {
    await make({ loadTracker: async () => ({ ok: false, missing: ['visao:modelo:rosto'] }) }).apply(true);
    expect(reports[0]).toMatch(/face control: visao:modelo:rosto/); expect(offs).toBe(1);
    const c = make();
    await c.apply(true);
    expect(region.querySelector('canvas.face-overlay')).not.toBeNull();
    await c.apply(false);
    expect(region.querySelector('canvas.face-overlay')).toBeNull(); expect(frameCb).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-face-control.py`:
//   · the reader created before the rest                  → «nothing commands before the rest»
//   · presses from the eyes' source                       → «presses action 2 from the face»
//   · no release when the face is lost                    → «lets go of what it held»
//   · no turnOff on missing files                         → «back to off»
//
// PROBED AGAIN (2026-09-23), twelve decisions of the `frame` disabled one at a time — `scratchpad/sonda-rosto-maos.py`. Seven
// were green: a camera with no frame yet, the middle asked for when the face leaves before the rest, the rest measured ONCE
// («ready» was said every frame after it), the countdown, the frames before the rest failing on a reader that is not there,
// the face's lines, and the head turn counting against the rest. Held now by the six cases before «files not on the device».
// ⚠️ The first probe of «no reader before the rest» measured nothing: its mutation only added TypeScript's `!`, which the
// compiler erases — the running code was the original. Rewritten to change what runs, it is red.
