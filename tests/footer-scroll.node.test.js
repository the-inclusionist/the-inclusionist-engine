// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PACE OF A LONG FOOTER EXPLANATION (ADR-0245; `ui/footer-scroll`): the plan the driver follows, with the numbers written
// out — 60 000 / ppm ms a word, the arithmetic of `core/caption-duration` (ADR-0183 §4), and never read back through it.
//
// A text of six lines shown two at a time, words per line [7, 8, 6, 9, 5, 4]:
//   · the first view waits for its words: 15 × 480 = 7200 ms at 125;
//   · gliding (the ADR's erratum of 2026-09-26: continuous, at one speed, not a line at a time), the text travels until line 4
//     tops the view — its last two lines in view — in the time the words BELOW the first view take: 6 + 9 + 5 + 4 = 24 words,
//     11 520 ms; then the last view is held as long as it takes to read: 9 × 480 = 4320 ms;
//   · with reduced motion, pages of two: lines 2–3 held for 15 words, lines 4–5 for their 9.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { footerScrollPlan, readLines } from '../app/js/ui/footer-scroll.js';

const SIX = [7, 8, 6, 9, 5, 4];

describe('when a long footer explanation moves', () => {
  it('🎯 [Zero] a text that fits never moves — no plan, whatever the rate or the motion', () => {
    for (const reduced of [false, true]) {
      expect(footerScrollPlan([7, 8], 2, 125, reduced), 'two lines in a two-line footer').toBeNull();
      expect(footerScrollPlan([7], 2, 125, reduced), 'one line').toBeNull();
      expect(footerScrollPlan([], 2, 125, reduced), 'no text').toBeNull();
      expect(footerScrollPlan([7], 1, 175, reduced), 'one line beside the legend').toBeNull();
    }
  });

  it('🔴 [Right] gliding: a wait for the first view, ONE travel for the words below it, a hold for the last view', () => {
    expect(footerScrollPlan(SIX, 2, 125, false)).toEqual({
      mode: 'glide',
      waitMs: 7200, // lines 0–1: 15 words
      travelMs: 11520, // lines 2–5: 24 words — the text passes in the time they take
      holdMs: 4320, // lines 4–5, the last view: 9 words
      toLine: 4, // the line on top when the last line is in view
    });
  });

  it('🔴 [Right] the pace is the child\'s caption rate — 480, 413.8 and 342.9 ms a word at 125, 145 and 175', () => {
    // 15, 24 and 9 words, each total rounded to the millisecond once
    expect(footerScrollPlan(SIX, 2, 145, false)).toEqual({ mode: 'glide', waitMs: 6207, travelMs: 9931, holdMs: 3724, toLine: 4 });
    expect(footerScrollPlan(SIX, 2, 175, false)).toEqual({ mode: 'glide', waitMs: 5143, travelMs: 8229, holdMs: 3086, toLine: 4 });
  });

  it('🔴 [Right] the last line is in view when all the words are read — 18 720 ms at 125, 16 138 at 145, 13 372 at 175', () => {
    const lastInView = (ppm) => { const p = footerScrollPlan(SIX, 2, ppm, false); return p.waitMs + p.travelMs; };
    // 39 words, at 60 000 / ppm each (two roundings: 6207 + 9931 and 5143 + 8229)
    expect(lastInView(125)).toBe(18720);
    expect(lastInView(145)).toBe(16138);
    expect(lastInView(175)).toBe(13372);
  });

  it('📌 [Boundary] a rate that is not one of the three reads as the slowest — a typo never makes the text rush', () => {
    expect(footerScrollPlan(SIX, 2, 900, false)).toEqual(footerScrollPlan(SIX, 2, 125, false));
    expect(footerScrollPlan(SIX, 2, Number.NaN, false)).toEqual(footerScrollPlan(SIX, 2, 125, false));
  });

  it('🔴 [Right] reduced motion: pages of two lines, each held for the words it brings; the last page is full', () => {
    expect(footerScrollPlan(SIX, 2, 125, true)).toEqual({
      mode: 'pages',
      steps: [
        { line: 0, holdMs: 7200 }, // lines 0–1
        { line: 2, holdMs: 7200 }, // lines 2–3: 15 words
        { line: 4, holdMs: 4320 }, // lines 4–5: 9
      ],
    });
    // five lines: the last page cannot be a line and a blank — it shows lines 3–4, and is held for them
    expect(footerScrollPlan([7, 8, 6, 9, 5], 2, 125, true).steps).toEqual([
      { line: 0, holdMs: 7200 }, { line: 2, holdMs: 7200 }, { line: 3, holdMs: 6720 },
    ]);
  });

  it('🔴 [Right] one line on show (the legend shares the footer): the glide runs to the last line, pages are of one', () => {
    expect(footerScrollPlan([3, 4, 5], 1, 125, false)).toEqual({ mode: 'glide', waitMs: 1440, travelMs: 4320, holdMs: 2400, toLine: 2 });
    expect(footerScrollPlan([3, 4, 5], 1, 125, true).steps).toEqual([
      { line: 0, holdMs: 1440 }, { line: 1, holdMs: 1920 }, { line: 2, holdMs: 2400 },
    ]);
  });
});

describe('the lines, read from where each word stands', () => {
  it('🔴 [Right] a word more than half a line lower opens a line; where each line starts is from the first', () => {
    // 20 px lines, first at 300: three words, two, one — a word 0.5 px off its line's top stays on it
    expect(readLines([300, 300.5, 300, 320, 321, 340], 20)).toEqual({ words: [3, 2, 1], starts: [0, 20, 40] });
    // half a line is the boundary: 9.9 px lower is the same line, 10.1 px a new one
    expect(readLines([300, 309.9, 310.1], 20).words).toEqual([2, 1]);
  });

  it('🎯 [Zero] no words, no lines', () => {
    expect(readLines([], 20.8)).toEqual({ words: [], starts: [] });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/footer-glide/mutate.mjs`, counting each target first) — listed with the browser file's, in
// `tests/a-long-explanation-scrolls.browser.test.js`.
