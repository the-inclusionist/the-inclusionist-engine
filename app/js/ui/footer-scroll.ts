// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/footer-scroll — WHEN A LONG FOOTER EXPLANATION MOVES, AND FOR HOW LONG (ADR-0245).
//
// The footer shows its lines (two; one while the button legend shares the column, ADR-0164). A text that needs more moves
// INSIDE them, at the child's caption rate — the arithmetic of `core/caption-duration`, 60000 / ppm ms a word:
//   · GLIDE (ADR-0245 erratum, 2026-09-26: «suave e contínua, lentamente»): it waits for the first view to be read, then rises
//     at ONE constant speed until its last line is in view — the distance passes in the time the words below the first view
//     take, so the last line arrives when every word has been read —, holds the last view for its words, and the caller starts
//     again from the top;
//   · PAGES, with reduced motion: no slide — a whole view at a time, each page held for the words it brings.
//
// 📌 PURE: word positions and numbers in, a plan out. The DOM half (`ui/footer-scroll-driver`) measures and moves.
import { isCaptionRate } from '../core/caption-duration.js';

/** One page: the first line on show, and how long it stays before the next. */
export interface FooterScrollStep {
  readonly line: number;
  readonly holdMs: number;
}
/**
 * Rises continuously: still for `waitMs`, then up at one speed for `travelMs` until `toLine` tops the view (the last view),
 * held there `holdMs`.
 */
export interface FooterGlidePlan {
  readonly mode: 'glide';
  readonly waitMs: number;
  readonly travelMs: number;
  readonly holdMs: number;
  readonly toLine: number;
}
/** Turns a whole view at a time, without sliding (reduced motion). */
export interface FooterPagesPlan {
  readonly mode: 'pages';
  readonly steps: readonly FooterScrollStep[];
}
export type FooterScrollPlan = FooterGlidePlan | FooterPagesPlan;
/** The rendered lines: how many words each holds, and where each starts, from the top of the first. */
export interface FooterLines {
  readonly words: readonly number[];
  readonly starts: readonly number[];
}

/**
 * The lines, from the TOP of each word as laid out. A word lower than the line's top by more than half a line opens a new one;
 * a word broken across two lines counts where it starts.
 */
export function readLines(wordTops: readonly number[], lineHeight: number): FooterLines {
  const words: number[] = [];
  const starts: number[] = [];
  let top = -Infinity;
  for (const t of wordTops) {
    if (t > top + lineHeight / 2) { top = t; words.push(0); starts.push(t - (wordTops[0] ?? 0)); }
    words[words.length - 1]! += 1;
  }
  return { words, starts };
}

/**
 * The plan for a text of `wordsPerLine.length` lines shown `shown` at a time, or `null` when it fits — a text that fits never
 * moves. The rate is one of the three the child can choose; any other number reads as the slowest (`isCaptionRate`).
 */
export function footerScrollPlan(wordsPerLine: readonly number[], shown: number, ppm: number, reduced: boolean): FooterScrollPlan | null {
  const last = wordsPerLine.length - shown; // the first line of the last view
  if (shown < 1 || last <= 0) return null;
  const msPerWord = 60_000 / isCaptionRate(ppm);
  const read = (from: number, to: number): number =>
    Math.round(wordsPerLine.slice(from, to).reduce((a, b) => a + b, 0) * msPerWord);
  // the last view is held as long as its lines take to read
  const endHold = read(last, last + shown);
  if (!reduced) {
    return { mode: 'glide', waitMs: read(0, shown), travelMs: read(shown, wordsPerLine.length), holdMs: endHold, toLine: last };
  }
  const steps: FooterScrollStep[] = [{ line: 0, holdMs: read(0, shown) }];
  for (let line = shown; steps[steps.length - 1]!.line < last; line += shown) {
    const top = Math.min(line, last);
    const before = steps[steps.length - 1]!.line;
    // every other page, as long as the lines it brought
    steps.push({ line: top, holdMs: top === last ? endHold : read(before + shown, top + shown) });
  }
  return { mode: 'pages', steps };
}
