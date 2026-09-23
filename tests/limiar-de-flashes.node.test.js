// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GENERAL FLASH THRESHOLD, AS WCAG 2.3.1 WRITES IT (study item B2, cut 1: the pure analyzer).
//
// ========================= THE SOURCE, READ ON 2026-09-13 =========================
// W3C, Understanding SC 2.3.1 (WCAG 2.2), https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
//   · general flash: «pair of opposing changes in relative luminance of 10% or more of the maximum relative luminance (1.0)
//     where the relative luminance of the darker image is below 0.80»
//   · the threshold is passed with «no more than three general flashes … within any one-second period», OR when the
//     «combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10
//     degree visual field» — the 10° field approximated as «341 x 256 pixel rectangle» at «1024 x 768»; .006 sr is 25% of it.
//   · the red flash («R/(R + G + B) … greater than or equal to 0.8», CIE 1976 UCS) is NOT in this cut, and says so.
//
// ========================= THE GRID, AND WHY THESE NUMBERS =========================
// The analyzer reads a 16×12 grid of relative luminance — 64×64 cells of a 1024×768 reference. The 10° field is taken as a
// 5×4 cell window (320×256, the nearest whole-cell rectangle to 341×256), and «25% of the field» as 5.3 cells of it: a flash
// counts where at least 6 cells of one window make the same transition in the same frame.
//
// ========================= EXPECTED RESULTS (written before the code) =========================
//   case                                                        flashes in the worst second   verdict
//   whole screen black↔white, 4 flashes/s                                4                      FAIL
//   whole screen black↔white, 3 flashes/s                                3                      pass («no more than three»)
//   10 flashes/s on 4 cells of one window (under 25%)                   0 counted               pass (area)
//   10 flashes/s on 6 cells of one window                               10                      FAIL
//   10 flashes/s between 0.85 and 1.0 (darker not below 0.80)           0                       pass
//   10 flashes/s of 0.05 luminance                                      0                       pass (under 10%)
//   one change and no return                                            0                       pass (a flash is a PAIR)
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { analyseFlashes, COLUMNS, ROWS } from '../app/js/core/flash-threshold.js';

// ⚠️ 120 frames/s and a wave by FRAME INDEX: at 60/s a wave computed in ms jitters one frame at its edges, and three flashes
// can land 983 ms apart — a test that fails by float. At 120/s the half-period of 3, 4 and 10 Hz is a whole number of frames.
const QPS = 120;
/** `segundos` of frames; `valor(f, celula)` gives each cell's relative luminance at frame f. */
function quadros(segundos, valor) {
  const out = [];
  for (let f = 0; f < segundos * QPS; f++) {
    out.push({ t: (f * 1000) / QPS, luminancias: Float32Array.from({ length: COLUMNS * ROWS }, (_, c) => valor(f, c)) });
  }
  return out;
}
/** A square wave with `hz` flashes per second: each flash is one half-period low, one half-period high. */
const onda = (hz, alto, baixo) => (f) => (Math.floor(f / (QPS / (2 * hz))) % 2 === 0 ? baixo : alto);
/** Cells (col, row) of the top-left 5×4 window, the first `n` of them. */
const primeirasDaJanela = (n) => new Set(Array.from({ length: 20 }, (_, k) => (k % 5) + Math.floor(k / 5) * COLUMNS).slice(0, n));

describe('WCAG 2.3.1 general flash threshold', () => {
  it('🔴 [Right] the whole screen at 4 flashes/s fails, with 4 in the worst second', () => {
    const r = analyseFlashes(quadros(2, onda(4, 1, 0)));
    expect(r.passa).toBe(false);
    expect(r.piorSegundo).toBe(4);
  });

  it('🎯 [Boundary] at 3 flashes/s it passes — «no more than three»', () => {
    const r = analyseFlashes(quadros(2, onda(3, 1, 0)));
    expect(r.piorSegundo).toBe(3);
    expect(r.passa).toBe(true);
  });

  it('🎯 [Boundary] 10 flashes/s on 4 cells of a field pass — under 25% of it; on 6 cells they fail', () => {
    const quatro = primeirasDaJanela(4);
    expect(analyseFlashes(quadros(2, (q, c) => (quatro.has(c) ? onda(10, 1, 0)(q) : 0))).passa, 'area under 25% was counted').toBe(true);
    const seis = primeirasDaJanela(6);
    const r = analyseFlashes(quadros(2, (q, c) => (seis.has(c) ? onda(10, 1, 0)(q) : 0)));
    expect(r.passa, 'area over 25% was not counted').toBe(false);
    expect(r.piorSegundo).toBe(10);
  });

  it('🎯 [Boundary] a darker image not below 0.80 is no flash', () => {
    expect(analyseFlashes(quadros(2, onda(10, 1, 0.85))).piorSegundo).toBe(0);
  });

  it('🎯 [Boundary] a change under 10% of the maximum is no flash', () => {
    expect(analyseFlashes(quadros(2, onda(10, 0.35, 0.3))).piorSegundo).toBe(0);
  });

  it('🔴 [Right] a change is measured from the PEAK — a fade by small steps that swings 0.12 is a flash', () => {
    // From dark up to 0.30 in steps of 0.04, then swinging 0.30↔0.18 at 20/s. Measured from where the rise was first
    // noticed (0.24) instead of from the peak, every swing looks like 0.06 and nothing is counted.
    const subida = [0, 0.12, 0.16, 0.2, 0.24, 0.28, 0.3];
    const ciclo = [0.26, 0.22, 0.18, 0.22, 0.26, 0.3];
    const valor = (q) => (q < subida.length ? subida[q] : ciclo[(q - subida.length) % ciclo.length]);
    const r = analyseFlashes(quadros(2, valor));
    expect(r.passa, 'a swing of 0.12 reached by small steps was not counted').toBe(false);
  });

  it('🎯 [Zero] one change and no return is no flash — a flash is a PAIR of opposing changes', () => {
    expect(analyseFlashes(quadros(2, (q) => (q < 60 ? 0 : 1))).piorSegundo).toBe(0);
    expect(analyseFlashes([]).passa).toBe(true);
  });
});

describe('the boundaries the probe of 2026-09-23 found unheld', () => {
  // ⚠️ PLAIN ARRAYS, NOT Float32Array. In 32 bits 0.8 is stored as 0.80000001 and 0.1 as 0.10000000149, so a case about
  // «below 0.80» or «10% or more» written with the helper above would pass or fail by rounding, not by the rule.
  const exact = (segundos, valor) =>
    Array.from({ length: segundos * QPS }, (_, f) => ({
      t: (f * 1000) / QPS,
      luminancias: Array.from({ length: COLUMNS * ROWS }, (_, c) => valor(f, c)),
    }));
  const within = (cells, v) => (f, c) => (cells.has(c) ? v(f) : 0);

  it('🎯 [Boundary] a change of EXACTLY 10% counts — «10% or more»', () => {
    expect(analyseFlashes(exact(2, onda(10, 0.1, 0))).passa, 'a swing of exactly 0.10 was not counted').toBe(false);
  });

  it('🎯 [Boundary] a darker image of EXACTLY 0.80 is no flash — «below 0.80»', () => {
    expect(analyseFlashes(exact(2, onda(10, 0.95, 0.8))).piorSegundo).toBe(0);
  });

  it('🎯 [Boundary] 5 cells of a field pass — the area is SIX, not five', () => {
    expect(analyseFlashes(exact(2, within(primeirasDaJanela(5), onda(10, 1, 0)))).passa).toBe(true);
  });

  it('🎯 [Boundary] the field is FOUR rows tall — six cells that need all four still count', () => {
    // Column 0 rows 0–3, and column 1 rows 0 and 3: no three-row window holds more than five of them.
    const seis = new Set([0, COLUMNS, 2 * COLUMNS, 3 * COLUMNS, 1, 3 * COLUMNS + 1]);
    expect(analyseFlashes(exact(2, within(seis, onda(10, 1, 0)))).passa, 'a field three rows tall missed this').toBe(false);
  });

  it('🎯 [Zero] three groups brightening in turn are no flash — a flash is a pair of OPPOSING transitions', () => {
    // Different cells each time, all rising: a wipe or a fade-in, never a return.
    const grupo = (k) => Math.floor([...primeirasDaJanela(18)].indexOf(k) / 6);
    const valor = (f, c) => (primeirasDaJanela(18).has(c) && f >= 10 * (grupo(c) + 1) ? 0.5 : 0);
    expect(analyseFlashes(exact(1, valor)).piorSegundo, 'two rises in a row were read as a flash').toBe(0);
  });

  it('🎯 [Right] a completed pair starts afresh — the transition after it opens a new pair and closes nothing', () => {
    // Group A rises and falls (one flash); then group B, bright from the start, falls. That fall has nothing to pair with.
    const a = new Set([...primeirasDaJanela(6)]);
    const b = new Set([...primeirasDaJanela(12)].filter((c) => !a.has(c)));
    const valor = (f, c) => (a.has(c) ? (f >= 10 && f < 20 ? 0.5 : 0) : b.has(c) ? (f < 30 ? 0.5 : 0) : 0);
    expect(analyseFlashes(exact(1, valor)).piorSegundo, 'the old pair closed a second time').toBe(1);
  });

  it('🎯 [Boundary] four flashes 999.9999 ms apart are not «within one second» — frame arithmetic drifts', () => {
    const at = (t, l) => ({ t, luminancias: Array(COLUMNS * ROWS).fill(l) });
    const frames = [at(0, 0), at(1, 1), at(10, 0), at(300, 1), at(343.33, 0), at(600, 1), at(676.66, 0), at(900, 1),
      at(10 + 999.9999, 0)];
    const r = analyseFlashes(frames);
    expect(r.piorSegundo, 'a drift of a ten-thousandth of a millisecond made a fourth flash').toBe(3);
    expect(r.passa).toBe(true);
  });
});

// Two mutations of the 2026-09-23 probe are EQUIVALENT and have no case, by measurement:
//   · dropping `direction[c] !== 0 &&` from the extension test: with no direction yet, the two sides differ only when
//     `way` is 0, i.e. `l === ref`, and then re-writing the reference with the same value changes nothing — the guard was
//     inert, and the cut removes it;
//   · `luminancias[c] ?? 0` without the `?? 0`: it acts only on a frame SHORTER than the grid, which the sampler never
//     builds (`platform/flash-sampler` always fills `COLUMNS * ROWS`).

// ============================== MUTATIONS CHECKED ==============================
//   F1 a change of 4% counts                   🔴 under 10%
//   F2 the darker side may be up to 0.90       🔴 not below 0.80
//   F3 no more than two per second             🔴 three pass
//   F4 / F8 the area as 4 / 7 cells            🔴 4 cells pass, 6 fail
//   F5 every opposing transition is a flash    🔴 three (double counting)
//   F6 no extension of the extreme             🔴 the fade — FIRST SURVIVED: every case jumped in one frame
//   F7 flashes exactly one second apart count  🔴 three
