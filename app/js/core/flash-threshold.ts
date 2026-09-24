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
  readonly luminances: ArrayLike<number>;
}

export interface FlashVerdict {
  readonly passes: boolean;
  /** The most general flashes any 10° field showed within one second. */
  readonly worstSecond: number;
}

const CELLS = COLUMNS * ROWS;
const WINDOWS = (COLUMNS - WINDOW_C + 1) * (ROWS - WINDOW_L + 1);

/** What the analysis carries from one frame to the next. */
interface Tracking {
  /** Per cell: the last extreme reached — NaN until the first frame sets it. */
  readonly reference: Float64Array;
  /** Per cell: the direction of its last transition, 0 before it has one. */
  readonly direction: Int8Array;
  /** Per cell: this frame's transition, −1, 0 or +1. */
  readonly transition: Int8Array;
  /** Per field: the direction of the half-pair left open, 0 when none is. */
  readonly openHalf: Int8Array;
  /** Per field: the time each flash closed. */
  readonly flashTimes: number[][];
}

/**
 * Per cell, a TRANSITION is a move of 10% or more away from the last extreme, with the darker side below 0.80; a move
 * further in the same direction extends the extreme instead of counting.
 */
function markCellTransitions(frame: LuminanceFrame, s: Tracking): void {
  for (let c = 0; c < CELLS; c++) {
    s.transition[c] = 0;
    const l = Number(frame.luminances[c] ?? 0);
    const ref = s.reference[c]!;
    if (Number.isNaN(ref)) { s.reference[c] = l; continue; }
    const way = Math.sign(l - ref);
    if (way === s.direction[c]) { s.reference[c] = l; continue; }
    if (Math.abs(l - ref) >= CHANGE && Math.min(l, ref) < DARK_BELOW) {
      s.transition[c] = way;
      s.direction[c] = way;
      s.reference[c] = l;
    }
  }
}

/** A field makes a transition when 6 of its cells make one in the same direction in the same frame. */
function fieldTransition(transition: Int8Array, row: number, col: number): number {
  let wentUp = 0;
  let wentDown = 0;
  for (let dr = 0; dr < WINDOW_L; dr++) {
    for (let dc = 0; dc < WINDOW_C; dc++) {
      const way = transition[(row + dr) * COLUMNS + col + dc]!;
      if (way > 0) wentUp++; else if (way < 0) wentDown++;
    }
  }
  return wentUp >= CELLS_FOR_AREA ? 1 : wentDown >= CELLS_FOR_AREA ? -1 : 0;
}

/** A FLASH is two opposing field transitions, and the pair then starts afresh. */
function pairFieldTransitions(t: number, s: Tracking): void {
  let j = 0;
  for (let row = 0; row + WINDOW_L <= ROWS; row++) {
    for (let col = 0; col + WINDOW_C <= COLUMNS; col++, j++) {
      const way = fieldTransition(s.transition, row, col);
      if (!way) continue;
      if (s.openHalf[j] !== 0 && s.openHalf[j] !== way) {
        s.flashTimes[j]!.push(t);
        s.openHalf[j] = 0;
      } else {
        s.openHalf[j] = way;
      }
    }
  }
}

/** The most flashes any one field showed «within any one-second period». */
function worstSecond(flashTimes: readonly number[][]): number {
  let worst = 0;
  for (const times of flashTimes) {
    for (let i = 0, k = 0; i < times.length; i++) {
      // less than a second apart; half a millisecond absorbs frame arithmetic
      while (k < times.length && times[k]! - times[i]! < 1000 - 0.5) k++;
      worst = Math.max(worst, k - i);
    }
  }
  return worst;
}

/** Counts general flashes per 10° field and returns the worst second. */
export function analyseFlashes(frames: readonly LuminanceFrame[]): FlashVerdict {
  const s: Tracking = {
    reference: new Float64Array(CELLS).fill(Number.NaN),
    direction: new Int8Array(CELLS),
    transition: new Int8Array(CELLS),
    openHalf: new Int8Array(WINDOWS),
    flashTimes: Array.from({ length: WINDOWS }, () => []),
  };
  for (const frame of frames) {
    markCellTransitions(frame, s);
    pairFieldTransitions(frame.t, s);
  }
  const worst = worstSecond(s.flashTimes);
  return { passes: worst <= MAX_PER_SECOND, worstSecond: worst };
}
