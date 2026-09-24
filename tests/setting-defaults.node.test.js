// SPDX-License-Identifier: AGPL-3.0-or-later
// THE REDUCED-MOTION DEFAULT IS THE OPERATING SYSTEM'S ANSWER, ASKED THROUGH AN INJECTED QUESTION (ADR-0029, ADR-0232).
//
// This is the project's only DEFAULT that is not a constant, and the reason matters: returning `false` on a machine whose owner
// asked for less motion WOULD TURN ANIMATION BACK ON. The reset would do, by itself, what WCAG 2.3.3 exists to prevent — on
// the screen of someone who had already said they cannot bear it.
//
// 📌 The question arrives as a parameter (issue #207): `core/setting-defaults` reaches no `window`, so these cases run in the
// node project with a double, and the root passes `win.matchMedia` on a real page.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { defaultReducedMotion } from '../app/js/core/setting-defaults.js';

/** A `matchMedia` double that records what it was asked and answers `reduce` for the reduced-motion query only. */
function askedSystem(reduce) {
  const asked = [];
  const matchMedia = (query) => { asked.push(query); return { matches: query === '(prefers-reduced-motion: reduce)' && reduce.now }; };
  return { asked, matchMedia };
}

describe('defaultReducedMotion — the default the system decides', () => {
  it('[Right] answers what the system answers to `prefers-reduced-motion: reduce`, both ways', () => {
    expect(defaultReducedMotion(askedSystem({ now: true }).matchMedia)).toBe(true);
    expect(defaultReducedMotion(askedSystem({ now: false }).matchMedia)).toBe(false);
  });

  it('[Interface] asks exactly the reduced-motion query, once per call', () => {
    const s = askedSystem({ now: true });
    defaultReducedMotion(s.matchMedia);
    expect(s.asked).toEqual(['(prefers-reduced-motion: reduce)']);
  });

  it('[Time] asks AGAIN at every call — a preference changed with the game open is followed', () => {
    // If it became a value read once, the system could change the preference with the game open and the reset would
    // restore yesterday's answer. A default that does not follow stops being a default.
    const reduce = { now: false };
    const s = askedSystem(reduce);
    expect(defaultReducedMotion(s.matchMedia)).toBe(false);
    reduce.now = true;
    expect(defaultReducedMotion(s.matchMedia)).toBe(true);
  });

  it('[Zero] reaches no global: the node project has no `window`, and the answer still comes', () => {
    expect(typeof window).toBe('undefined');
    expect(defaultReducedMotion(askedSystem({ now: true }).matchMedia)).toBe(true);
  });
});

// MUTATIONS CHECKED (2026-09-24):
//   · the query changed to `(prefers-reduced-motion: no-preference)` -> all four fail.
//   · `return false` in place of asking -> all four fail ([Interface] because nothing was asked).
