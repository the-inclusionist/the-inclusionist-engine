// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/footer-scroll — WHEN A LONG FOOTER EXPLANATION MOVES, AND HOW LONG EACH VIEW STAYS (ADR-0245).
//
// The footer shows its lines (two; one while the button legend shares the column, ADR-0164). A text that needs more scrolls
// INSIDE them: it waits for the first view to be read, then brings one new line at a time, each held for its own words at the
// child's caption rate — the arithmetic of `core/caption-duration`, 60000 / ppm ms a word — holds the last view as long as the
// first, and the caller starts again from the top. With reduced motion the text turns like pages, a whole view at a time, at
// the same pace: each page is held for the words it brings.
//
// 📌 PURE: word positions and numbers in, a plan out. The DOM half (`ui/footer-scroll-driver`) measures and moves.
import { isCaptionRate } from '../core/caption-duration.js';

/** One view: the first line on show, and how long it stays before the next. */
export interface FooterScrollStep {
  readonly line: number;
  readonly holdMs: number;
}
/** `glide` moves a line at a time and slides; `pages` turns a whole view at a time, without sliding (reduced motion). */
export interface FooterScrollPlan {
  readonly mode: 'glide' | 'pages';
  readonly steps: readonly FooterScrollStep[];
}
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
  const stride = reduced ? shown : 1;
  const steps: FooterScrollStep[] = [{ line: 0, holdMs: read(0, shown) }];
  for (let line = stride; steps[steps.length - 1]!.line < last; line += stride) {
    const top = Math.min(line, last);
    const before = steps[steps.length - 1]!.line;
    // the last view is held as long as its lines take to read; every other, as long as the lines it brought
    steps.push({ line: top, holdMs: top === last ? read(last, last + shown) : read(before + shown, top + shown) });
  }
  return { mode: reduced ? 'pages' : 'glide', steps };
}
