// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EYE CONTROL DRAWN OVER THE GAME, MEASURED IN PIXELS (ADR-0213 §6; issue #194). The toggle's three levels must draw exactly their layers:
// off nothing; outlines the region borders, the words and the eyes; hatched all of that plus the hatching. Measured on a real canvas.
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

describe('the three levels', () => {
  it('off draws nothing at all, even over a canvas that had something', () => {
    const c = canvas();
    drawGazeOverlay(c.getContext('2d'), W, H, idle, { level: 'hatched' });
    drawGazeOverlay(c.getContext('2d'), W, H, idle, { level: 'off' });
    expect(everywhere(c)).toBe(0);
  });
  it('outlines leave the inside of an idle region empty; hatched fills it', () => {
    const o = canvas(), hch = canvas();
    drawGazeOverlay(o.getContext('2d'), W, H, idle, { level: 'outlines' });
    drawGazeOverlay(hch.getContext('2d'), W, H, idle, { level: 'hatched' });
    expect(everywhere(o)).toBeGreaterThan(0);
    for (const r of ['up', 'right', 'down', 'left', 'middle']) {
      expect(painted(o, GAZE_REGIONS[r]), `${r} inside, outlines`).toBe(0);
      expect(painted(hch, GAZE_REGIONS[r]), `${r} inside, hatched`).toBeGreaterThan(200);
    }
  });
  it('the words show at the outlines level too: a preparing look writes inside its region', () => {
    const c = canvas();
    drawGazeOverlay(c.getContext('2d'), W, H, { ...idle, zone: 'up', preparing: true }, { level: 'outlines', say: () => 'Desça!' });
    expect(painted(c, GAZE_REGIONS.up)).toBeGreaterThan(50);
    expect(painted(c, GAZE_REGIONS.down)).toBe(0);
  });
  it('the eyes and brows are drawn from the landmarks, mirrored, and only those lines', () => {
    const c = canvas();
    const landmarks = [{ x: 0.9, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }];
    drawGazeOverlay(c.getContext('2d'), W, H, idle, { level: 'outlines', face: { landmarks, lines: { eyes: [{ start: 0, end: 1 }], brows: [] } } });
    const g = c.getContext('2d');
    const at = (x, y) => g.getImageData(x, y, 1, 1).data[3];
    expect(at(Math.round(0.15 * W), H / 2), 'mirrored: x 0.9–0.8 is drawn at 0.1–0.2').toBeGreaterThan(0);
    expect(at(Math.round(0.85 * W), H / 2), 'not unmirrored').toBe(0);
    expect(at(Math.round(0.85 * W), Math.round(0.1 * H)), 'a pair no line names is not joined').toBe(0);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-overlay.py`:
//   · off not clearing                     → «off draws nothing at all»
//   · hatching at the outlines level       → «outlines leave the inside … empty»
//   · no hatching at the hatched level     → «hatched fills it»
//   · the face lines not mirrored          → «mirrored»
