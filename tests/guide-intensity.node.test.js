// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GUIDE GROWS MORE INTENSE AS YOU GET CLOSER, AND NEVER GOES SILENT (#84 item 2).
//
// ========================= WHY CONTINUOUS =========================
// No repeating ping — the Dev's verdict: «um ping é a pior escolha possível, tenebroso para quem tem TEA». The guide is a
// continuous presence — nothing fires, the thing just becomes more present.
//
// The axis is BRIGHTNESS, with a small share of volume on top, and the choice is the Dev's. The redundancy is not
// decoration: for a child with hearing loss the brightness may fall in a band they cannot reach, and two axes mean
// neither decides alone.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  guideIntensity, STEPS_TO_FLOOR, FAR_CUT, NEAR_CUT, FAR_VOL,
} from '../app/js/platform/guide-intensity.js';

describe('platform/guide-intensity — a distancia vira brilho', () => {
  it('[Right] em cima do alvo abre no maximo, no fundo da escala fecha no minimo', () => {
    expect(guideIntensity(0).cutoff).toBeCloseTo(NEAR_CUT, 6);
    expect(guideIntensity(0).volume).toBeCloseTo(1, 6);
    expect(guideIntensity(STEPS_TO_FLOOR).cutoff).toBeCloseTo(FAR_CUT, 6);
    expect(guideIntensity(STEPS_TO_FLOOR).volume).toBeCloseTo(FAR_VOL, 6);
  });

  it('⚠️ [Zero] NUNCA emudece — longe ainda soa, e e a assercao que mais importa', () => {
    // If the guide went silent far away, «longe» would be indistinguishable from «nao ha alvo», and the child who
    // depends on it would conclude there is nothing to find exactly when there is and it is far.
    for (const passos of [12, 20, 100, 5000]) {
      expect(guideIntensity(passos).volume, `${passos} passos calou o guia`).toBeGreaterThanOrEqual(FAR_VOL);
      expect(guideIntensity(passos).cutoff, `${passos} passos fechou o filtro`).toBeGreaterThanOrEqual(FAR_CUT);
    }
    expect(FAR_VOL, 'o piso de volume virou zero').toBeGreaterThan(0);
  });

  it('⚠️ [Right] os DOIS eixos crescem juntos ao aproximar — nenhum decide sozinho', () => {
    const passos = [12, 9, 6, 3, 0];
    const cortes = passos.map((p) => guideIntensity(p).cutoff);
    const vols = passos.map((p) => guideIntensity(p).volume);
    for (let i = 1; i < passos.length; i++) {
      expect(cortes[i], `o brilho nao subiu de ${passos[i - 1]} para ${passos[i]}`).toBeGreaterThan(cortes[i - 1]);
      expect(vols[i], `o volume nao subiu de ${passos[i - 1]} para ${passos[i]}`).toBeGreaterThan(vols[i - 1]);
    }
  });

  it('⚠️ [Boundary] o brilho e EXPONENCIAL: a meia distancia nao esta a meio caminho', () => {
    // A linear ramp would open almost everything in the first third of the way and then seem to stall — the child
    // would feel they had arrived with half still to go. With a constant ratio, halfway gives the GEOMETRIC MEAN of the
    // ends, noticeably smaller than the arithmetic one.
    const meio = guideIntensity(STEPS_TO_FLOOR / 2).cutoff;
    expect(meio).toBeCloseTo(Math.sqrt(FAR_CUT * NEAR_CUT), 4);
    expect(meio, 'o corte virou linear').toBeLessThan((FAR_CUT + NEAR_CUT) / 2);
  });

  it('[Boundary] e o VOLUME e linear — a assimetria e deliberada', () => {
    // If both were exponential they would accelerate at the same point, which is the opposite of having two axes.
    expect(guideIntensity(STEPS_TO_FLOOR / 2).volume).toBeCloseTo((1 + FAR_VOL) / 2, 6);
  });

  it('[Zero] entrada absurda cai no fundo da escala em vez de produzir NaN', () => {
    for (const mau of [NaN, Infinity, -1, -0.0001]) {
      const i = guideIntensity(mau);
      expect(Number.isFinite(i.cutoff), `${mau} produziu corte nao-finito`).toBe(true);
      expect(i.volume).toBeCloseTo(FAR_VOL, 6);
    }
  });

  it('⚠️ [Interface] o fundo da escala e a regua que o resto do modulo ja usa', () => {
    // The sonar's `distanceKey` cuts "very near" at 4 steps and "near" at 9; `PAN_PACES` saturates the stereo at 11. The
    // guide saturates just after — the fine information serves whoever is already arriving. If someone moves this
    // number inside that range, the guide bottoms out while the sonar still says «perto».
    expect(STEPS_TO_FLOOR).toBeGreaterThan(9);
    expect(NEAR_CUT, 'acima disto o timbre sibila, e sibilar chama atencao como um bipe').toBeLessThanOrEqual(4000);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · setting `FAR_VOL = 0` → "[Zero] NUNCA emudece" fails at all four distances and at the final assertion. It is the
//     defect that would make «longe» sound like «nao ha alvo».
//   · making the cutoff interpolation linear (`FAR_CUT + (NEAR_CUT - FAR_CUT) * perto`) → the [Boundary] case of the
//     EXPONENTIAL brightness fails on both assertions, with the arithmetic mean in place of the geometric one.
//   · making the volume exponential too → "[Boundary] e o VOLUME e linear" fails. The two axes would accelerate at the
//     same point, which is the opposite of having two.
//   · removing the saturation's `Math.min(1, …)` → "[Zero] NUNCA emudece" fails at 20, 100 and 5000 steps, with the
//     volume below the floor and the cutoff below `FAR_CUT`.
//   · lowering `STEPS_TO_FLOOR` to 8 → TWO fail: the [Interface] case of the scale's floor and the [Right] case of BOTH
//     axes growing together, because at 12 and at 9 steps it would already be saturated and the two axes would stand
//     still between them. The guide would bottom out while the sonar still said «perto».
