// SPDX-License-Identifier: AGPL-3.0-or-later
// core/ring — THE RING ARITHMETIC, and nothing else.
//
// It lived in `ui/menu-nav` and left when item 7 of ADR-0044 made `ui/pause-icons` need it too: `menu-nav` already
// imported `pause-icons`, and the way back would close an import CYCLE. A cycle in ESM does not blow up at once — it
// blows up at boot, in the TDZ, when one of the two reads the other during evaluation: the kind of defect that shows
// once, in production, and vanishes when investigated.
//
// A leaf module on purpose: no dependencies, one function, no I/O.

/**
 * TAKES ONE STEP ROUND A RING — past the last comes the first, and before the first is the last.
 *
 * It was `clampIndex`, which stuck at the ends. ADR-0044 overturned that for a reason of use, not taste: with ONE MENU
 * PER SCREEN every list can be a ring, and the least wanted item (`quit`) is ONE key from the most urgent (`resume`)
 * without sitting next to it. A child who cannot see does not sweep the list looking for its end — they ask "and
 * before the first?" and get an answer.
 *
 * XAG 106 allows the ring exactly for a LINEAR menu and forbids it for a 2-D grid of blocks, where "back to the first"
 * has no spatial meaning.
 *
 * ⚠️ WALKING A LIST IS A RING; ADJUSTING A VALUE IS A LIMIT. The select and range steps stay pinned at their ends, and
 * the difference is real: jumping from the loudest volume to the quietest with one key is a fright, not a convenience —
 * and in a game with audio cues for blindness, a volume fright is harm.
 */
export function stepInRing(len: number, idx: number, delta: number): number {
  if (len <= 0) return 0;
  return ((idx + delta) % len + len) % len; // the extra `+ len`: `%` of a negative in JS is negative
}
