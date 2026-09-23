// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EYE CONTROL DRAWN OVER THE GAME, MEASURED IN PIXELS (ADR-0213 §6, ADR-0215; issues #194, #199). The 📷's eyes position draws the
// region borders, the words and the eyes — never hatching (the Dev: «olhos + retângulos (sem hachuras)»). Measured on a real canvas.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { drawGazeOverlay, GAZE_REGIONS } from '../app/js/ui/gaze-overlay.js';

const W = 720, H = 360;
const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const idle = { zone: null, armed: false, preparing: false, preview: null, restReady: true };

/** Painted pixels inside a rectangle given in fractions, `[cx, cy, w, h]`, shrunk to its inside so the border is left out. */
const painted = (c, [cx, cy, w, h], inset = 6) => {
  const x = Math.round((cx - w / 2) * W) + inset, y = Math.round((cy - h / 2) * H) + inset;
  const d = c.getContext('2d').getImageData(x, y, Math.round(w * W) - 2 * inset, Math.round(h * H) - 2 * inset).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
};
const everywhere = (c) => { const d = c.getContext('2d').getImageData(0, 0, W, H).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };

describe('the regions', () => {
  it('are outlined and never hatched: the inside of an idle region stays empty', () => {
    const o = canvas();
    drawGazeOverlay(o.getContext('2d'), W, H, idle);
    expect(everywhere(o), 'nothing drawn — the case would measure nothing').toBeGreaterThan(0);
    for (const r of ['up', 'right', 'down', 'left', 'middle']) expect(painted(o, GAZE_REGIONS[r]), `${r} inside`).toBe(0);
  });
  it('each drawing starts from a clear canvas', () => {
    const c = canvas();
    drawGazeOverlay(c.getContext('2d'), W, H, { ...idle, zone: 'up', preparing: true }, { say: () => 'Desça!' });
    drawGazeOverlay(c.getContext('2d'), W, H, idle);
    expect(painted(c, GAZE_REGIONS.up), 'the old words stayed').toBe(0);
  });
  it('the words show at the outlines level too: a preparing look writes inside its region', () => {
    const c = canvas();
    drawGazeOverlay(c.getContext('2d'), W, H, { ...idle, zone: 'up', preparing: true }, { say: () => 'Desça!' });
    expect(painted(c, GAZE_REGIONS.up)).toBeGreaterThan(50);
    expect(painted(c, GAZE_REGIONS.down)).toBe(0);
  });
  it('the eyes and brows are drawn from the landmarks, mirrored, and only those lines', () => {
    const c = canvas();
    const landmarks = [{ x: 0.9, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }];
    drawGazeOverlay(c.getContext('2d'), W, H, idle, { face: { landmarks, lines: { eyes: [{ start: 0, end: 1 }], brows: [] } } });
    const g = c.getContext('2d');
    const at = (x, y) => g.getImageData(x, y, 1, 1).data[3];
    expect(at(Math.round(0.15 * W), H / 2), 'mirrored: x 0.9–0.8 is drawn at 0.1–0.2').toBeGreaterThan(0);
    expect(at(Math.round(0.85 * W), H / 2), 'not unmirrored').toBe(0);
    expect(at(Math.round(0.85 * W), Math.round(0.1 * H)), 'a pair no line names is not joined').toBe(0);
  });
});

describe('what each region is drawn WITH (probed 2026-09-23)', () => {
  /*
   * 🔴 Fourteen of twenty decisions of the drawing could be undone with the pixel cases above green: they measure THAT something is
   * painted, not its colour, its weight, its size or where the words sit. These cases record every call on the context, with the
   * style in force at that moment — the colour a child reads as «armed» is the rule, not a decoration.
   */
  const recorded = (width = W, height = H) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const real = c.getContext('2d'), calls = [];
    const ctx = new Proxy(real, {
      get: (t, k) => (typeof t[k] === 'function'
        ? (...a) => { calls.push({ k, a, style: t.strokeStyle, width: t.lineWidth, font: t.font }); return t[k](...a); }
        : t[k]),
      set: (t, k, v) => { t[k] = v; return true; },
    });
    return { ctx, calls, real };
  };
  const rectOf = (region, width = W, height = H) => {
    const [fx, fy, fw, fh] = GAZE_REGIONS[region];
    return [(fx - fw / 2) * width, (fy - fh / 2) * height, fw * width, fh * height];
  };
  const outline = (calls, region) => calls.find((c) => c.k === 'strokeRect' && c.a.every((v, i) => Math.abs(v - rectOf(region)[i]) < 0.01));
  const texts = (calls) => calls.filter((c) => c.k === 'fillText');
  const upArmed = (item) => ({ zone: 'up', armed: true, preparing: false, preview: { zone: 'up', item, index: 1 }, restReady: true });

  it('an idle region is faint and thin; the armed one is green and thicker', () => {
    const { ctx, calls } = recorded();
    drawGazeOverlay(ctx, W, H, upArmed('up'));
    expect([outline(calls, 'down').style, outline(calls, 'down').width]).toEqual(['rgba(234, 242, 248, 0.35)', 1]);
    expect([outline(calls, 'up').style, outline(calls, 'up').width]).toEqual(['#3ddc84', 3]);
  });

  it('the middle is never green: its count-down is yellow even while a zone is armed', () => {
    const { ctx, calls } = recorded();
    drawGazeOverlay(ctx, W, H, { ...upArmed('up'), restReady: false, restLeftMs: 1500 });
    expect(outline(calls, 'middle').style).toBe('#ffd23f');
  });

  it('the words grow with the game region — twice the region, twice the letters', () => {
    const { ctx, calls } = recorded(2 * W, 2 * H);
    drawGazeOverlay(ctx, 2 * W, 2 * H, { ...idle, restReady: false, restLeftMs: 1500 }, { say: () => 'Olhe aqui' });
    expect(texts(calls).find((c) => c.a[0] === 'Olhe aqui').font).toMatch(/\b32px\b/);
  });

  it('only the middle counts down, only while there is time left, and its words step up to make room', () => {
    const counting = recorded();
    drawGazeOverlay(counting.ctx, W, H, { ...idle, zone: 'up', preparing: true, restReady: false, restLeftMs: 1500 }, { say: (k) => k });
    const seconds = texts(counting.calls).filter((c) => / s$/.test(c.a[0]));
    expect(seconds.map((c) => c.a[0]), 'a count-down in a region that is not the middle').toEqual(['1.5 s']);
    expect(texts(counting.calls).find((c) => c.a[0] === 'gaze.lookHere').a[2], 'the words did not step up').toBeLessThan(H / 2);
    const done = recorded();
    drawGazeOverlay(done.ctx, W, H, { ...idle, restReady: false }, { say: (k) => k });
    expect(texts(done.calls).some((c) => / s$/.test(c.a[0])), 'a count-down with no time left to count').toBe(false);
  });

  it('the face button is its Xbox letter AND its PlayStation shape', () => {
    const { ctx, calls } = recorded();
    drawGazeOverlay(ctx, W, H, upArmed('action4'));
    expect(texts(calls).map((c) => c.a[0])).toContain('Y');
    expect(calls.some((c) => c.k === 'closePath'), 'the triangle was not drawn').toBe(true);
  });

  it('the shoulder is its label inside a square', () => {
    const { ctx, calls } = recorded();
    drawGazeOverlay(ctx, W, H, upArmed('rightShoulder'));
    expect(texts(calls).map((c) => c.a[0])).toContain('R1');
    const f = 16, side = f * 2.4;
    expect(calls.some((c) => c.k === 'strokeRect' && Math.abs(c.a[2] - side) < 0.01 && Math.abs(c.a[3] - side) < 0.01), 'no square').toBe(true);
  });

  it('a line naming a landmark the face does not have is skipped, and the others still draw', () => {
    const { ctx, calls } = recorded();
    const landmarks = [{ x: 0.9, y: 0.5 }, { x: 0.8, y: 0.5 }];
    expect(() => drawGazeOverlay(ctx, W, H, idle, { face: { landmarks, lines: { eyes: [{ start: 0, end: 7 }, { start: 0, end: 1 }], brows: [] } } }))
      .not.toThrow();
    expect(calls.filter((c) => c.k === 'lineTo')).toHaveLength(1);
  });

  it('the shadow is switched off when the drawing ends — the next thing drawn on this context is not blurred', () => {
    const { ctx, real } = recorded();
    drawGazeOverlay(ctx, W, H, upArmed('up'));
    expect(real.shadowBlur).toBe(0);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-overlay.py`:
//   · not clearing before drawing          → «starts from a clear canvas»
//   · the regions hatched again            → «never hatched»
//   · the face lines not mirrored          → «mirrored»
