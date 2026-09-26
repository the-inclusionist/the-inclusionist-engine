// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PACE OF A LONG FOOTER EXPLANATION (ADR-0245; `ui/footer-scroll`): the plan the driver follows, with the numbers written
// out — 60 000 / ppm ms a word, the arithmetic of `core/caption-duration` (ADR-0183 §4), and never read back through it.
//
// A text of six lines shown two at a time, words per line [7, 8, 6, 9, 5, 4]:
//   · the first view waits for its words: 15 × 480 = 7200 ms at 125;
//   · gliding, each new line stays for its own words (line 2: 6 × 480 = 2880 …), and the last view — lines 4 and 5 — as long
//     as it takes to read: 9 × 480 = 4320 ms;
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

  it('🔴 [Right] gliding: the first view waits for its words, then a line at a time, the last view held to be read', () => {
    expect(footerScrollPlan(SIX, 2, 125, false)).toEqual({
      mode: 'glide',
      steps: [
        { line: 0, holdMs: 7200 }, // lines 0–1: 15 words
        { line: 1, holdMs: 2880 }, // line 2 arrives: 6 words
        { line: 2, holdMs: 4320 }, // line 3: 9
        { line: 3, holdMs: 2400 }, // line 4: 5
        { line: 4, holdMs: 4320 }, // lines 4–5, the end: 9
      ],
    });
  });

  it('🔴 [Right] the last line arrives when the words before it are read — 16 800 ms at 125, 14 483 at 145, 12 000 at 175', () => {
    const lastArrives = (ppm) => {
      const { steps } = footerScrollPlan(SIX, 2, ppm, false);
      return steps.slice(0, -1).reduce((t, s) => t + s.holdMs, 0);
    };
    // 7 + 8 + 6 + 9 + 5 = 35 words before line 5 shows, at 60 000 / ppm each (each hold rounded to the millisecond:
    // 35 × 413.79 = 14 482.8 and 35 × 342.86 = 12 000 — four roundings land on 14 483 and 12 000)
    expect(lastArrives(125)).toBe(16800);
    expect(lastArrives(145)).toBe(14483);
    expect(lastArrives(175)).toBe(12000);
  });

  it('🔴 [Right] the pace is the child\'s caption rate: 480, 414 and 343 ms a word', () => {
    expect(footerScrollPlan(SIX, 2, 125, false).steps[0].holdMs).toBe(7200); // 15 × 480
    expect(footerScrollPlan(SIX, 2, 145, false).steps[0].holdMs).toBe(6207); // 15 × 413.8
    expect(footerScrollPlan(SIX, 2, 175, false).steps[0].holdMs).toBe(5143); // 15 × 342.9
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

  it('🔴 [Right] one line on show (the legend shares the footer): a line at a time, pages of one', () => {
    const glide = footerScrollPlan([3, 4, 5], 1, 125, false).steps;
    expect(glide).toEqual([{ line: 0, holdMs: 1440 }, { line: 1, holdMs: 1920 }, { line: 2, holdMs: 2400 }]);
    expect(footerScrollPlan([3, 4, 5], 1, 125, true).steps.map((s) => s.line)).toEqual([0, 1, 2]);
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
// (2026-09-26; `scratchpad/footer-scroll/mutate.mjs`, counting each target first) — listed with the browser file's, in
// `tests/a-long-explanation-scrolls.browser.test.js`.
