// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOUR ROLE COLOURS STAY DIFFERENT FOR WHOEVER DOES NOT TELL COLOURS APART (issue #12, item 4).
//
// ========================= THE QUESTION, AND WHY IT NEEDED MEASURING =========================
// ADR-0011 decides *color-blocking*: in high contrast, a tile's ROLE is said by colour — hazard is hot orange, climbable
// is cyan, water is blue, gate is magenta. Issue #12 asks for the «estudo protan/deutan, para além da luminância», and
// the question it answers is exactly this: **does a colour-blind person still see four roles, or do two of them
// collapse into one?**
//
// If they collapse, the child loses the information the colour carried — and loses it in silence, because the game
// keeps drawing four distinct colours for whoever tells them apart.
//
// ========================= ⚠️ THE CONTRAST RATIO IS THE WRONG MEASURE =========================
// The first measurement used the CONTRAST RATIO (WCAG) between the pairs, the tool this repository already had at
// hand — and it raised a huge false alarm: `hazard × water` at 1.16:1 **with no simulation at all**, and
// `hazard × water` at 1.00:1 under tritanopia.
//
// The contrast ratio sees ONLY LUMINANCE. And the role palette separates by HUE on purpose — that is what
// *color-blocking* means. Measuring luminance on it is asking the wrong question very precisely: it would say
// «indistinguíveis» about two colours anyone separates at a glance.
//
// What answers is **ΔE** (CIE76, in Lab), which is PERCEIVED distance and sees hue, saturation and luminance. It stays
// recorded because the wrong version would have produced a gate demanding from the palette a property it never
// promised — and that, to meet it, would force undoing the color-blocking.
//
// ========================= WHAT WAS MEASURED (2026-09-07) =========================
// The tightest pair of each vision, applying the matrices of `render/cvd-matrices` to the palette of
// `render/hc-role-data`:
//
//     typical vision   ΔE 57.6   (water × gate)
//     protanopia       ΔE 25.1   (water × gate)
//     deuteranopia     ΔE 14.6   (water × gate)   ← the tightest of the twelve
//     tritanopia       ΔE 29.2   (hazard × gate)
//
// ✅ **No role collapses into another.** The color-blocking survives the three simulations. The pair to watch is
// water×gate under deuteranopia, which is where blue and magenta come closest.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { HC_ROLE_DEF, HC_ROLE_KEYS } from '../app/js/render/hc-role-data.js';
import { CVD_MATRIX } from '../app/js/render/cvd-matrices.js';
import { razaoDeContraste } from './fixtures/wcag-contrast.js';

/** The three SIMULATIONS — it is what a colour-blind person sees. The `fix-*` ones are corrections and do not enter here. */
const SIMULATIONS = ['sim-protan', 'sim-deuter', 'sim-tritan'];

/**
 * Applies a `feColorMatrix` (4 rows of 5: R,G,B,A,offset) to a 0-255 RGB.
 * It is the SAME matrix the SVG uses in production — if it changes, this sum changes with it.
 */
function aplicar([r, g, b], m) {
  const n = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const [R, G, B] = [r / 255, g / 255, b / 255];
  return [
    n(m[0] * R + m[1] * G + m[2] * B + m[4]),
    n(m[5] * R + m[6] * G + m[7] * B + m[9]),
    n(m[10] * R + m[11] * G + m[12] * B + m[14]),
  ];
}

/* ===================== ΔE (CIE76), the PERCEIVED distance =====================
 * It lives here and not in a fixture because only this gate uses it. It moves to `tests/fixtures/` the day a second one
 * needs it — which was exactly the path of the WCAG sum, and the rule that justified it is the same: a test file is not
 * imported from another. */
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function lab([r, g, b]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
function deltaE(a, b) {
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Every pair of roles, in the given vision (`null` = typical). */
function paresDe(matriz) {
  const vistas = Object.fromEntries(HC_ROLE_KEYS.map((k) => [k, matriz ? aplicar(HC_ROLE_DEF[k], matriz) : HC_ROLE_DEF[k]]));
  const out = [];
  for (let i = 0; i < HC_ROLE_KEYS.length; i++) {
    for (let j = i + 1; j < HC_ROLE_KEYS.length; j++) {
      const [a, b] = [HC_ROLE_KEYS[i], HC_ROLE_KEYS[j]];
      out.push({ nome: `${a}×${b}`, de: deltaE(vistas[a], vistas[b]) });
    }
  }
  return out;
}

/**
 * The separation floor. Today the worst pair measures 14.6 (water×gate under deuteranopia); 12 gives the slack of a
 * small change and fails a real collision.
 *
 * ⚠️ IT IS NOT A QUALITY TARGET — it is the point below which two roles stop being two. For reference: ΔE ≈ 1 is the
 * perception threshold under ideal conditions; on a pixel-art tile seen from afar, much more than that is wanted, and
 * that is why 12 is a FLOOR and not a goal.
 */
const PISO_DE_SEPARACAO = 12;

describe('color-blocking sobrevive ao daltonismo (ADR-0011, issue #12)', () => {
  it('[Zero] a paleta e as matrizes existem, e o crivo vê os quatro papéis', () => {
    expect(HC_ROLE_KEYS.length).toBe(4);
    for (const k of HC_ROLE_KEYS) expect(HC_ROLE_DEF[k], `${k} sem cor`).toHaveLength(3);
    for (const s of SIMULATIONS) expect(CVD_MATRIX[s], `${s} sem matriz`).toHaveLength(20);
    expect(paresDe(null)).toHaveLength(6); // 4 papéis = 6 pares
  });

  it('⚠️ [Right] nenhum par de papéis colapsa, em NENHUMA das três visões', () => {
    const apertados = [];
    for (const sim of [null, ...SIMULATIONS]) {
      const rotulo = sim ?? 'visão típica';
      for (const { nome, de } of paresDe(sim ? CVD_MATRIX[sim] : null)) {
        if (de < PISO_DE_SEPARACAO) apertados.push(`${rotulo}: ${nome} ΔE ${de.toFixed(1)}`);
      }
    }
    expect(apertados, 'dois papéis viraram um só:\n  ' + apertados.join('\n  ')).toEqual([]);
  });

  it('[Boundary] o par mais apertado é água×portão sob deuteranopia — e é o que se vigia', () => {
    const pior = paresDe(CVD_MATRIX['sim-deuter']).sort((a, b) => a.de - b.de)[0];
    expect(pior.nome).toBe('water×gate');
    expect(pior.de).toBeGreaterThan(PISO_DE_SEPARACAO);
    expect(pior.de).toBeLessThan(20); // if it rises above this, someone improved the palette and this number goes down
  });

  it('⚠️ [Interface] a RAZÃO DE CONTRASTE é a ferramenta ERRADA aqui, e o caso prova-o com número', () => {
    // ⚠️ This case exists so nobody «fixes» this gate to the metric the repository already had at hand. The contrast
    // ratio sees ONLY luminance; the role palette separates by HUE, on purpose — that is what color-blocking means.
    //
    // `hazard` (orange) and `water` (blue) are two colours anyone separates at a glance, and the contrast ratio between
    // them is 1.16:1 — which, read as separation, would say «indistinguíveis». ΔE says 129.
    //
    // A gate built on the contrast ratio would demand from the palette a property it never promised, and meeting it
    // would force UNDOING the color-blocking, pushing the roles to different luminances — that is, making worse the
    // thing the gate should protect.
    const laranja = HC_ROLE_DEF.hazard, azul = HC_ROLE_DEF.water;
    expect(razaoDeContraste(laranja, azul)).toBeLessThan(1.5);
    expect(deltaE(laranja, azul)).toBeGreaterThan(100);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · putting `water: [200, 60, 210]` (almost the gate's magenta) in `hc-role-data` → `[Right] nenhum par
//     colapsa` fails in all FOUR visions, and `[Boundary]` fails with it. It is the defect the gate exists to
//     catch: two roles becoming one.
//   · replacing the `sim-deuter` matrix with the identity → `[Boundary] o par mais apertado` fails, because under
//     typical vision the closest pair is another one (water×gate at ΔE 57.6, above the case's ceiling of 20).
//   · replacing `deltaE` with `razaoDeContraste` in the pairs sieve → `[Right] nenhum par colapsa` fails in
//     EVERY vision, typical included. ⚠️ It is the most instructive mutation: it shows the wrong metric does not
//     fail by a little, it fails completely — and that such a gate would have been read as «a paleta está
//     partida» when what was broken was the gate.
