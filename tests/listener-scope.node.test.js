// SPDX-License-Identifier: AGPL-3.0-or-later
// A RELEASED SCOPE LISTENS TO NOTHING MORE (ADR-0220).
//
// `platform/listener-scope` is the one seam through which a root listens on the window, and `dispose()` releases it. A listener
// that arrives AFTER the release — a timer the root armed just before it ended, like the print mode's 80 ms "go back" — used to
// go straight onto the real window and into a list nobody would release again: an ended root still hearing the keyboard.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createListenerScope } from '../app/js/platform/listener-scope.js';

/** A window that records what is added and removed, and nothing else. */
function fakeWindow() {
  const live = new Set();
  return {
    live,
    addEventListener(type, fn) { live.add(`${type}:${fn.name}`); },
    removeEventListener(type, fn) { live.delete(`${type}:${fn.name}`); },
  };
}

describe('the listener scope', () => {
  it('🔴 [Right] releasing takes every listener it installed off the real window', () => {
    const real = fakeWindow();
    const scope = createListenerScope(real);
    function onKey() {}
    scope.win.addEventListener('keydown', onKey, true);
    expect(real.live.has('keydown:onKey')).toBe(true);
    scope.releaseAll();
    expect(real.live.size).toBe(0);
  });

  it('🔴 [Boundary] a listener added AFTER the release never reaches the real window', () => {
    const real = fakeWindow();
    const scope = createListenerScope(real);
    scope.releaseAll();
    function lateGoBack() {}
    scope.win.addEventListener('keydown', lateGoBack, true);
    expect(real.live.has('keydown:lateGoBack'), 'an ended scope went on listening').toBe(false);
  });
});

// ===== MUTATIONS CHECKED (2026-09-24) =====
// 1. the `released` guard in `listen` removed → [Boundary] red (the late listener reaches the real window)
// 2. `releaseAll` not marking the scope as released → [Boundary] red
