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

/*
 * WHAT THE WINDOW LENDS IS ANSWERED BY THE WINDOW. A browser method refuses any `this` but its window («Illegal invocation»);
 * the fake ones here do the same. The download takes `win.fetch` as a VALUE and calls it as `tools.fetchFile(url)`, and an
 * extension that wraps `window.fetch` does it with a plain `function` — which has a `prototype`, and which the old rule took
 * for a constructor and handed on unbound (measured in the Dev's Brave on 2026-09-27: no heavy file ever requested).
 */
describe('a function read through the scope', () => {
  /** A window whose `fetch` refuses any `this` but itself, like the browser's. */
  function windowWithFetch() {
    const real = { ...fakeWindow() };
    real.fetch = function fetch(url) { if (this !== real) throw new TypeError('Illegal invocation'); return `fetched ${url}`; };
    return real;
  }

  it('🔴 [Right] a method runs with the real window as `this`, called through the scope or handed on as a value', () => {
    const real = windowWithFetch();
    const { win } = createListenerScope(real);
    expect(win.fetch('a')).toBe('fetched a');
    const tools = { fetchFile: win.fetch };
    expect(tools.fetchFile('b'), 'a method handed on as a value ran with another `this`').toBe('fetched b');
  });

  it('🔴 [Right] an extension\'s wrapper — a plain function, with a `prototype` — is still a method of the window', () => {
    const real = windowWithFetch();
    const original = real.fetch;
    real.fetch = function (...args) { return original.apply(this, args); }; // the shape extensions use
    expect(Object.hasOwn(real.fetch, 'prototype'), 'the wrapper must have a prototype, or this case measures nothing').toBe(true);
    const { win } = createListenerScope(real);
    const tools = { fetchFile: win.fetch };
    expect(tools.fetchFile('heavy/model'), 'the wrapped fetch left unbound').toBe('fetched heavy/model');
  });

  it('🔴 [Right] a constructor keeps `new`, its `prototype` and its statics', () => {
    const real = fakeWindow();
    class Recogniser { static available() { return 'available'; } }
    Recogniser.prototype.processLocally = true;
    real.SpeechRecognition = Recogniser;
    const { win } = createListenerScope(real);
    expect('processLocally' in win.SpeechRecognition.prototype, 'the prototype did not reach the reader').toBe(true);
    expect(win.SpeechRecognition.available()).toBe('available');
    expect(new win.SpeechRecognition()).toBeInstanceOf(Recogniser);
  });

  it('🔴 [Right] a constructor the host already bound still builds an object with its methods', () => {
    const real = fakeWindow();
    class Observer { observe() { return 'observing'; } }
    real.MutationObserver = Observer.bind(null); // a host that lends its window through a proxy of its own binds everything
    const { win } = createListenerScope(real);
    expect(new win.MutationObserver().observe(), 'the object built has none of its methods').toBe('observing');
  });

  it('🔴 [Consistency] the same property read twice is the same function', () => {
    const { win } = createListenerScope(windowWithFetch());
    expect(win.fetch).toBe(win.fetch);
  });
});

// ===== MUTATIONS CHECKED (2026-09-24) =====
// 1. the `released` guard in `listen` removed → [Boundary] red (the late listener reaches the real window)
// 2. `releaseAll` not marking the scope as released → [Boundary] red
// ===== MUTATIONS CHECKED (2026-09-27), the functions =====
// 3. the old rule back (a function with a `prototype` left as it is, the rest bound) → the extension's wrapper red
// 4. the call forwarding its own `this` instead of the real window → both method cases red
// 5. every function `bind`-ed → the constructor case red (no `prototype`, no statics)
// 6. no cache, a new wrapper per read → [Consistency] red
// 7. no `construct` trap (the wrapper as `newTarget`) → the host-bound constructor case red
