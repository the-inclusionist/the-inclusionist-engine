// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/listener-scope — A WINDOW THAT CAN BE LET GO.
//
// 🔴 WHY THIS EXISTS, AND IT IS A DEFECT THAT WAS MEASURED, NOT A TIDINESS. A root (`boot/create-game`) installs about thirty
// listeners on the window — the scan interception, START, SELECT, `action4`, the resize, the language change, and the five that
// `ui/menu-nav.attach()` puts there — AND THERE WAS NO WAY TO TAKE THEM OFF. `unmount()` is not that way and must not become it:
// it releases the CURRENT CARTRIDGE (ADR-0142), and a root that went deaf on `unmount()` would come back from the next `mount()`
// with no keyboard at all.
//
// 📏 What that cost, measured in the browser with the real engine: a root whose host element was removed from the document KEEPS
// LISTENING, and every query it makes is document-wide (`getPauseMenu` is `doc.querySelector('#vp-pause-0')`,
// `topVisibleOverlay` is `doc.querySelectorAll('#game-region .overlay')`) — so the dead root finds THE LIVE ROOT'S pause card and
// navigates it too. One ArrowDown moved the cursor one item with one root, TWO with a second root, THREE with a third. Nobody
// gets an error: the child presses down once and the cursor jumps two.
//
// ⚠️ AND `stopPropagation()` SAVES NOBODY HERE. Every one of these listeners sits on the SAME node in the SAME phase, and
// stopping propagation does not stop the siblings on that node — only `stopImmediatePropagation()` would, and using it would mean
// the first root to be built silences every other one, which is a worse rule than the bug.
//
// 🎯 THE SHAPE: one seam instead of a `detach()` in each of the seven modules that listen. The root wraps the window ONCE and
// hands the WRAPPER down; every listener installed through it — by the root or by any module it builds — is remembered, and
// `releaseAll()` takes all of them off at once. A module that learns to listen tomorrow is covered without being edited, which a
// list of `detach()` calls could never promise: the one that is forgotten is the one that leaks.
//
// 📌 Everything else about the window is UNCHANGED. `getComputedStyle`, `requestAnimationFrame`, `matchMedia`, `innerWidth` and
// the rest answer exactly as the real window does — this is a window with a memory, not a window with a smaller API.

/** A window that remembers what was hung on it, so it can be taken down. */
export interface ListenerScope {
  /** The window to hand around. Identical to the real one, except that its listeners are remembered. */
  readonly win: Window;
  /**
   * Takes off every listener still installed through `win`. Idempotent: what was already removed by hand, or removed itself
   * (`once: true`), is simply no longer there — removing a listener that is not installed is a no-op in the DOM.
   */
  releaseAll(): void;
}

/** What the DOM matches a removal on: the type, the callback, and CAPTURE — never the rest of the options. */
interface Installed {
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly capture: boolean;
  readonly options: boolean | AddEventListenerOptions | undefined;
}

const captureOf = (o: boolean | AddEventListenerOptions | undefined): boolean => (typeof o === 'boolean' ? o : !!o?.capture);

export function createListenerScope(real: Window): ListenerScope {
  const installed: Installed[] = [];

  const listen = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    real.addEventListener(type, listener, options);
    installed.push({ type, listener, capture: captureOf(options), options });
  };

  const forget = (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void => {
    real.removeEventListener(type, listener, options);
    const capture = captureOf(options);
    const i = installed.findIndex((e) => e.type === type && e.listener === listener && e.capture === capture);
    if (i >= 0) installed.splice(i, 1);
  };

  /*
   * ⚠️ WHAT LEAVES THIS TRAP IS ANSWERED BY THE REAL WINDOW, NEVER BY THE PROXY, and it is not style: `innerWidth`,
   * `devicePixelRatio` and `location` are GETTERS on the window, and `getComputedStyle`, `requestAnimationFrame` and
   * `matchMedia` are methods of it — run any of them with the proxy as `this` and the browser answers «Illegal invocation».
   * So the receiver is left at its default (which IS the target) and every function is bound before it goes out.
   *
   * 📌 Both halves are exercised, by mutation: forwarding the proxy as the receiver kills the whole collection at load, and
   * dropping the `bind` kills it at the first `getComputedStyle`.
   *
   * 🔴 BUT A CONSTRUCTOR LEAVES UNBOUND, and this was not foreseen — the suite found it. `bind` returns a function with NO
   * `prototype`, and code that reaches a constructor THROUGH the window reads that prototype: `platform/speech-recognition`
   * asks `'processLocally' in api.prototype` before it will use the browser's recogniser on the device, and bound, that read is
   * `in undefined`. 📏 Measured: `tests/reading-no-createGame.browser.test.js` went red — the child who reads aloud got no
   * microphone at all. A constructor never needs `this` from the property access; a method always does, and `prototype` is the
   * one thing that tells the two apart.
   */
  const win = new Proxy(real, {
    get(target, prop) {
      if (prop === 'addEventListener') return listen;
      if (prop === 'removeEventListener') return forget;
      const value = Reflect.get(target, prop) as unknown;
      if (typeof value !== 'function') return value;
      return Object.hasOwn(value, 'prototype') ? value : (value as (...a: unknown[]) => unknown).bind(target);
    },
  });

  const releaseAll = (): void => {
    // Drained as it goes: a listener that took another off while being removed would otherwise make this skip one, and a scope
    // released twice must not try to take the same listener off again.
    for (const e of installed.splice(0)) real.removeEventListener(e.type, e.listener, e.options);
  };

  return { win, releaseAll };
}
