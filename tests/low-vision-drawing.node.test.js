// SPDX-License-Identifier: AGPL-3.0-or-later
// render/low-vision-drawing driven on its own, with a 2D context that records what is drawn.
//
// 🔴 A probe (2026-09-24) found two of its answers held by nothing, because every case reaches this drawing through a
// viewport or the world overlay and reads a pixel or two: the cataract film being TRANSLUCENT (opaque, it is a wall that
// hides the whole game, and no case noticed) and diabetic retinopathy being SEVERAL scattered spots (one spot passed).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { drawLowVision } from '../app/js/render/low-vision-drawing.js';

function recorder() {
  const fills = [];
  const gradients = [];
  const c = {
    fillStyle: '',
    createRadialGradient: (...args) => { const g = { args, stops: [], addColorStop(at, colour) { g.stops.push([at, colour]); } }; gradients.push(g); return g; },
    fillRect: (x, y, w, h) => fills.push({ style: c.fillStyle, rect: [x, y, w, h] }),
  };
  return { c, fills, gradients };
}

const alphaOf = (rgba) => Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(rgba)[1]);

describe('drawLowVision — what a colour filter cannot make', () => {
  it('🔴 [Right] the cataract film covers the whole view and lets the world show through it', () => {
    const { c, fills } = recorder();
    drawLowVision(c, 'haze', 320, 180);
    expect(fills).toHaveLength(1);
    expect(fills[0].rect).toEqual([0, 0, 320, 180]);
    const alpha = alphaOf(fills[0].style);
    expect(alpha, 'the film is opaque: a wall over the game, not a cataract').toBeLessThan(1);
    expect(alpha, 'the film is gone').toBeGreaterThan(0);
  });

  it('🔴 [Right] diabetic retinopathy is SEVERAL spots, scattered — each one confined to its own square', () => {
    const { c, fills, gradients } = recorder();
    drawLowVision(c, 'diabetic', 320, 180);
    expect(gradients.length, 'one spot is a scotoma, not retinopathy').toBe(6);
    expect(fills).toHaveLength(6);
    for (const { rect: [, , w, h] } of fills) expect(w * h, 'a spot covered the whole view').toBeLessThan(320 * 180 / 4);
    const centres = new Set(gradients.map((g) => `${g.args[0]},${g.args[1]}`));
    expect(centres.size, 'the spots are on top of each other').toBe(6);
  });

  it('📌 [Zero] a key that is not a drawn simulation draws nothing, and inherited names are not keys', () => {
    for (const key of ['normal', 'protan', 'toString', 'constructor', '']) {
      const { c, fills, gradients } = recorder();
      expect(() => drawLowVision(c, key, 320, 180)).not.toThrow();
      expect([fills.length, gradients.length], key).toEqual([0, 0]);
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-baixa-visao.py`: the film made opaque and the spots cut to one, both green before this file.
