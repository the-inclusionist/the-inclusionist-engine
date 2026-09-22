// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COLOUR-BLIND-SAFE PALETTE FOR MENUS AND HUD (ADR-0151) — measured on the stylesheet itself.
//
// ========================= WHAT THIS FILE DECIDES =========================
// 📏 The interface carries meaning by colour in two tokens: `--accent` (selected, «on», chosen) and `--good` (the
// right answer revealed). The default pair, yellow and green, is the pair protan and deutan confuse. This file
// holds the palette to two promises at once, because each one alone passes a bad palette:
//   · the two meanings stay FAR APART under all three simulations (Machado 2009, the engine's own matrices);
//   · every pair still meets its CONTRAST target (WCAG 1.4.3 for text, 1.4.11 for UI).
// A palette that is distinguishable and unreadable, or readable and indistinguishable, fails here.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CVD_MATRIX } from '../app/js/render/cvd-matrices.js';
import { razaoDeContraste, hex } from './fixtures/contraste-wcag.js';

const CSS = readFileSync(new URL('../app/css/style.css', import.meta.url), 'utf8');

/** The custom properties declared inside the first block whose selector matches exactly. */
function tokens(seletor) {
  const i = CSS.indexOf(seletor + '{');
  if (i < 0) return null;
  const bloco = CSS.slice(i + seletor.length + 1, CSS.indexOf('}', i));
  return Object.fromEntries([...bloco.matchAll(/--([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)].map((m) => [m[1], m[2]]));
}

const BASE = tokens(':root');
const OKABE = tokens(':root[data-paleta="okabe-ito"]');
const FUNDO = '#0b1020';
const SELECIONADO = '#2a3a5e'; // the selected menu button (style.css, the note on `--good` over it)

/* --- ΔE CIE76 after a CVD simulation, applied in linear RGB as the SVG filter does --- */
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const clamp = (x) => Math.min(1, Math.max(0, x));
function simular(cor, m) {
  const [r, g, b] = hex(cor).map(lin);
  return [0, 1, 2].map((k) => clamp(m[k * 5] * r + m[k * 5 + 1] * g + m[k * 5 + 2] * b));
}
function lab([r, g, b]) {
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b, m) => { const x = lab(simular(a, m)), y = lab(simular(b, m)); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const SIMULATIONS = ['sim-protan', 'sim-deuter', 'sim-tritan'];
const piorCaso = (p) => Math.min(...SIMULATIONS.map((k) => deltaE(p.accent, p.good, CVD_MATRIX[k])));

describe('the Okabe-Ito palette for menus and HUD', () => {
  it('⚠️ [Interface] the gate reads REAL tokens — both blocks parse, and the palette changes both meanings', () => {
    // The vacuum case first: with an empty parse every comparison below would pass by comparing nothing.
    expect(BASE?.accent, 'the base :root lost --accent').toMatch(/^#/);
    expect(BASE?.good).toMatch(/^#/);
    expect(OKABE, 'no :root[data-paleta="okabe-ito"] block — the palette is not in the stylesheet').not.toBeNull();
    expect(OKABE.accent.toLowerCase()).not.toBe(BASE.accent.toLowerCase());
    expect(OKABE.good.toLowerCase()).not.toBe(BASE.good.toLowerCase());
  });

  it('🔴 [Right] «selected» and «right answer» stay FAR APART under protan, deutan AND tritan', () => {
    // 📏 The default pair measures ΔE 48 (protan) and 55 (deutan). 60 is the floor this palette promises, and
    // the pair chosen measures 101 / 111 / 87.
    for (const k of SIMULATIONS) {
      const d = deltaE(OKABE.accent, OKABE.good, CVD_MATRIX[k]);
      expect(d, `${k}: the two meanings are ΔE ${d.toFixed(0)} apart`).toBeGreaterThanOrEqual(60);
    }
  });

  it('🔴 [Cross-check] and it BEATS the default pair in its worst case — or it would not be worth switching', () => {
    // The pair of the case above: a palette that met 60 while the default did too would be a change with no buyer.
    expect(piorCaso(OKABE)).toBeGreaterThan(piorCaso(BASE));
  });

  it('🔴 [Right] every contrast still meets its target — distinguishable is not enough if it is unreadable', () => {
    const tinta = BASE['accent-ink'];
    expect(razaoDeContraste(hex(tinta), hex(OKABE.accent)), 'text on the accent (1.4.3)').toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(hex(OKABE.accent), hex(FUNDO)), 'accent as UI on the background (1.4.11)').toBeGreaterThanOrEqual(3);
    expect(razaoDeContraste(hex(OKABE.good), hex(FUNDO)), '--good on the background').toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste(hex(OKABE.good), hex(SELECIONADO)), '--good on the selected button').toBeGreaterThanOrEqual(4.5);
  });

  it('[Right] the focus ring follows the accent — a focus in the old yellow would be the one confusable mark left', () => {
    expect(OKABE.focus?.toLowerCase()).toBe(OKABE.accent.toLowerCase());
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   O1 the palette block removed from style.css                  🔴 the vacuum case
//   O2 --good back to the default green                          🔴 deutan ΔE falls below 60
//   O3 --accent a dark orange (#8a5a00)                          🔴 text on the accent below 4.5
//   O4 --focus left out of the block                             🔴 the focus ring stays yellow
