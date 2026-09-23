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
const WINDOW_C = 5;
const WINDOW_L = 4;
/** More than 25% of the field: 21 824 px of 87 296, 5.3 cells of 4 096 px — so 6 cells. */
const CELLS_FOR_AREA = 6;
const CHANGE = 0.1;
const DARK_BELOW = 0.8;
const MAX_PER_SECOND = 3;

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
  const reference = new Float64Array(n).fill(Number.NaN);
  const direction = new Int8Array(n);
  const windows = (COLUMNS - WINDOW_C + 1) * (ROWS - WINDOW_L + 1);
  const lastOfWindow = new Int8Array(windows);
  const windowFlashes: number[][] = Array.from({ length: windows }, () => []);
  const transition = new Int8Array(n);

  for (const quadro of quadros) {
    for (let c = 0; c < n; c++) {
      transition[c] = 0;
      const l = Number(quadro.luminancias[c] ?? 0);
      const ref = reference[c]!;
      if (Number.isNaN(ref)) { reference[c] = l; continue; }
      const way = Math.sign(l - ref);
      if (direction[c] !== 0 && way === direction[c]) { reference[c] = l; continue; }
      if (Math.abs(l - ref) >= CHANGE && Math.min(l, ref) < DARK_BELOW) {
        transition[c] = way;
        direction[c] = way;
        reference[c] = l;
      }
    }
    let j = 0;
    for (let lin = 0; lin + WINDOW_L <= ROWS; lin++) {
      for (let col = 0; col + WINDOW_C <= COLUMNS; col++, j++) {
        let wentUp = 0;
        let wentDown = 0;
        for (let dl = 0; dl < WINDOW_L; dl++) {
          for (let dc = 0; dc < WINDOW_C; dc++) {
            const s = transition[(lin + dl) * COLUMNS + col + dc]!;
            if (s > 0) wentUp++; else if (s < 0) wentDown++;
          }
        }
        const way = wentUp >= CELLS_FOR_AREA ? 1 : wentDown >= CELLS_FOR_AREA ? -1 : 0;
        if (!way) continue;
        if (lastOfWindow[j] !== 0 && lastOfWindow[j] !== way) {
          windowFlashes[j]!.push(quadro.t);
          lastOfWindow[j] = 0; // the pair is complete: the next transition starts a new one
        } else {
          lastOfWindow[j] = way;
        }
      }
    }
  }

  let worst = 0;
  for (const times of windowFlashes) {
    for (let i = 0, k = 0; i < times.length; i++) {
      // «within any one-second period»: flashes less than a second apart; half a millisecond absorbs frame arithmetic
      while (k < times.length && times[k]! - times[i]! < 1000 - 0.5) k++;
      worst = Math.max(worst, k - i);
    }
  }
  return { passa: worst <= MAX_PER_SECOND, piorSegundo: worst };
}
