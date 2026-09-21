// SPDX-License-Identifier: AGPL-3.0-or-later
// core/flash-threshold — THE GENERAL FLASH THRESHOLD OF WCAG 2.3.1, over a grid of relative luminance (study item B2).
//
// ADR-0020 names a FLASH_LIMIT pass and the engine limits nothing a cartridge flashes: it does not own the render. What it
// can do is MEASURE what a game draws and say it. This file is the pure half — frames in, a verdict out, no DOM, no clock —
// so the rule is tested by numbers written from the source; the sampler that reads a canvas lives with the root.
//
// 📌 THE SOURCE (read 2026-09-13), W3C Understanding SC 2.3.1, WCAG 2.2: a general flash is «a pair of opposing changes in
// relative luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of the darker
// image is below 0.80»; the threshold passes with «no more than three … within any one-second period» or when the
// concurrent area is «no more than … .006 steradians within any 10 degree visual field» (341×256 px at 1024×768; 25%).
// ⚠️ NOT HERE: the red flash (CIE 1976 UCS chromaticity) — a verdict of «passes» from this file says nothing about red.
// A LEAF: imports nothing.

/** The grid: 64×64 cells of a 1024×768 reference. */
export const COLUMNS = 16;
export const ROWS = 12;
/** The 10° field as whole cells: 5×4 = 320×256, the nearest rectangle to 341×256. */
const JANELA_C = 5;
const JANELA_L = 4;
/** More than 25% of the field: 21 824 px of 87 296, 5.3 cells of 4 096 px — so 6 cells. */
const CELULAS_PARA_AREA = 6;
const MUDANCA = 0.1;
const ESCURA_ABAIXO_DE = 0.8;
const MAXIMO_POR_SEGUNDO = 3;

export interface LuminanceFrame {
  /** Milliseconds. */
  readonly t: number;
  /** Relative luminance 0..1 per cell, row by row, `COLUMNS * ROWS` long. */
  readonly luminancias: ArrayLike<number>;
}

export interface FlashVerdict {
  readonly passa: boolean;
  /** The most general flashes any 10° field showed within one second. */
  readonly piorSegundo: number;
}

/**
 * Counts general flashes per 10° field and returns the worst second.
 *
 * Per cell, a TRANSITION is a move of 10% or more away from the last extreme, with the darker side below 0.80; a move
 * further in the same direction extends the extreme instead of counting. Per field, a transition is 6 cells making one in
 * the same direction in the same frame; a FLASH is two opposing field transitions, and the pair then starts afresh.
 */
export function analyseFlashes(quadros: readonly LuminanceFrame[]): FlashVerdict {
  const n = COLUMNS * ROWS;
  const referencia = new Float64Array(n).fill(Number.NaN);
  const direcao = new Int8Array(n);
  const janelas = (COLUMNS - JANELA_C + 1) * (ROWS - JANELA_L + 1);
  const ultimaDaJanela = new Int8Array(janelas);
  const flashesDaJanela: number[][] = Array.from({ length: janelas }, () => []);
  const transicao = new Int8Array(n);

  for (const quadro of quadros) {
    for (let c = 0; c < n; c++) {
      transicao[c] = 0;
      const l = Number(quadro.luminancias[c] ?? 0);
      const ref = referencia[c]!;
      if (Number.isNaN(ref)) { referencia[c] = l; continue; }
      const sentido = Math.sign(l - ref);
      if (direcao[c] !== 0 && sentido === direcao[c]) { referencia[c] = l; continue; }
      if (Math.abs(l - ref) >= MUDANCA && Math.min(l, ref) < ESCURA_ABAIXO_DE) {
        transicao[c] = sentido;
        direcao[c] = sentido;
        referencia[c] = l;
      }
    }
    let j = 0;
    for (let lin = 0; lin + JANELA_L <= ROWS; lin++) {
      for (let col = 0; col + JANELA_C <= COLUMNS; col++, j++) {
        let subiu = 0;
        let desceu = 0;
        for (let dl = 0; dl < JANELA_L; dl++) {
          for (let dc = 0; dc < JANELA_C; dc++) {
            const s = transicao[(lin + dl) * COLUMNS + col + dc]!;
            if (s > 0) subiu++; else if (s < 0) desceu++;
          }
        }
        const sentido = subiu >= CELULAS_PARA_AREA ? 1 : desceu >= CELULAS_PARA_AREA ? -1 : 0;
        if (!sentido) continue;
        if (ultimaDaJanela[j] !== 0 && ultimaDaJanela[j] !== sentido) {
          flashesDaJanela[j]!.push(quadro.t);
          ultimaDaJanela[j] = 0; // the pair is complete: the next transition starts a new one
        } else {
          ultimaDaJanela[j] = sentido;
        }
      }
    }
  }

  let pior = 0;
  for (const tempos of flashesDaJanela) {
    for (let i = 0, k = 0; i < tempos.length; i++) {
      // «within any one-second period»: flashes less than a second apart; half a millisecond absorbs frame arithmetic
      while (k < tempos.length && tempos[k]! - tempos[i]! < 1000 - 0.5) k++;
      pior = Math.max(pior, k - i);
    }
  }
  return { passa: pior <= MAXIMO_POR_SEGUNDO, piorSegundo: pior };
}
