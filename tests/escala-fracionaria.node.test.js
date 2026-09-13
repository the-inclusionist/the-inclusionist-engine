// SPDX-License-Identifier: AGPL-3.0-or-later
// ON A FRACTIONAL DISPLAY SCALE THE 16 px FLOOR WINS OVER THE WHOLE PIXEL (ADR-0179; issue #175).
//
// 📏 Measured on 2026-09-13: at the 640×360 minimum window, a 110% display scale gave k = 1.82 CSS px per logical pixel (text
// 14.55 px, region 582×327) and 125% rounded the 2× minimum up to 3 device pixels (k = 2.4, a 768×432 region cut by the
// window). The Dev: «Piso de 16px (WCAG 2.2 AA é quem decide).»
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { escalaDoPalco } from '../app/js/ui/layout.js';

describe('the scale on a fractional display scale (ADR-0179)', () => {
  it('🔴 [Right] at the minimum window, 110%, 125% and 175% all give exactly 640×360 CSS — the floor, whole pixels or not', () => {
    for (const dpr of [1.1, 1.25, 1.75]) {
      const e = escalaDoPalco(640, 360, dpr, 320, 180);
      expect(e.k, `k at ${dpr}`).toBeCloseTo(2, 6);
      expect(8 * e.k, `--ui-fs at ${dpr} is under the 16 px floor`).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(e.largura, `the region at ${dpr} is not 640 CSS wide`).toBeCloseTo(640, 6);
      expect(e.altura).toBeCloseTo(360, 6);
    }
  });

  it('🔴 [Boundary] the region never outgrows a window that fits 640×360 — the 2× minimum is counted in CSS pixels', () => {
    const e = escalaDoPalco(640, 360, 1.25, 320, 180);
    expect(e.largura, 'the region is wider than the window').toBeLessThanOrEqual(640 + 1e-9);
  });

  it('📌 [Right] where the whole multiple already reaches 2 CSS px, nothing changes', () => {
    expect(escalaDoPalco(1366, 768, 1, 320, 180)).toMatchObject({ kDev: 4, k: 4, largura: 1280, altura: 720 });
    expect(escalaDoPalco(1920, 1080, 1, 320, 180)).toMatchObject({ kDev: 6, k: 6 });
    const e = escalaDoPalco(1242, 698, 1.1, 320, 180); // 1366×768 at 110%
    expect(e.kDev, 'a large window at 110% lost its whole multiple').toBe(4);
    expect(Number.isInteger(e.kDev)).toBe(true);
    expect(escalaDoPalco(640, 360, 2, 320, 180)).toMatchObject({ kDev: 4, k: 2 });
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 the old rounding up of the 2× minimum in device pixels   🔴 110%/125%/175%, boundary
//   S2 no floor: the whole multiple alone                        🔴 110%
//   S3 the floor applied everywhere (k always 2)                 🔴 nothing changes
