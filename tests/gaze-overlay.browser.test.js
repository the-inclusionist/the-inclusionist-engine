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

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-overlay.py`:
//   · not clearing before drawing          → «starts from a clear canvas»
//   · the regions hatched again            → «never hatched»
//   · the face lines not mirrored          → «mirrored»
