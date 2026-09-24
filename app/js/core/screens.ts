// SPDX-License-Identifier: AGPL-3.0-or-later
// core/screens — the multiplayer screen grid, in one place.
//
// The game splits the window into one screen per player (pillar: multiplayer on SEPARATE screens, no split-screen —
// ADR-0010). How many columns and rows that gives was a one-line sum copied into several places (the layout's integer
// scale, the CRT's scanline step, the HUD's `.player-screen` positions), and one copy DIVERGED: without the `n<=1`
// guard, n=0 gives zero columns and every geometry becomes NaN. It survived because that case is unreachable today,
// not because anyone checked it — which is why the sum lives here once.
//
// A LEAF module on purpose: no dependencies, not even on state. `n` is a parameter, never a global `numPlayers` —
// that is what makes the sum testable and lets render, layout and HUD import it without depending on each other.

/** Columns and rows of the grid for `n` screens. */
export interface ScreenGrid { cols: number; rows: number }

/**
 * The grid for `n` players: 1 -> 1x1 · 2 -> 2x1 · 3 and 4 -> 2x2.
 * `n` below 1 gives the grid of one screen, not zero columns.
 */
export function screenGrid(n: number): ScreenGrid {
  return { cols: n <= 1 ? 1 : (n <= 2 ? n : 2), rows: n <= 2 ? 1 : 2 };
}

/** Size in art pixels of the grid of `n` screens (320x180 per screen — the canonical pixel of ADR-0010). */
export function screenBaseSize(n: number): { w: number; h: number } {
  const { cols, rows } = screenGrid(n);
  return { w: 320 * cols, h: 180 * rows };
}
