// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "browser" project. The render module (`render/canvas`) does `import * as PIXI from 'pixi.js'` directly (the
// global `vendor/pixi.min.js` was retired), so it needs no global. globalThis.PIXI stays as a harmless shim for any
// legacy access. See docs/3-Sprint-Design/plan-unit-tests-at-extraction.md.
import * as PIXI from 'pixi.js';
globalThis.PIXI = PIXI;
// No error suppression: the render modules are imported PURELY (nothing loads a texture at import time), so there is no
// asset-load rejection to ignore.

// 🔴 EACH FILE HAS ITS OWN STORAGE (ADR-0232 D4, issue #207 — the browser suite's F9). The files share one origin, and
// with it one `localStorage`: a file wrote a key while another booted, and the second read the first one's choice. The
// engine reaches no storage by import any more — a root builds its store from what its host lends — so the host WINDOW of
// this file lends this file's own backend (`tests/fixtures/file-storage.js`). Every root a case boots with `win: window`,
// the quiz page and every case reading `localStorage` meet this file's storage and nobody else's. It is set here, before
// any case runs; nothing imported above reads storage at import (ADR-0232), so nothing has read the origin's first.
// 📌 This also retires the per-file cleanup of `incl_font_k`/`incl_lettercase` that stood here: a file's storage starts
// empty, and each file has its own window, so no stored face or `--fonte-escala` survives into the next file.
import { fileBackend } from './tests/fixtures/file-storage.js';
Object.defineProperty(window, 'localStorage', { value: fileBackend, configurable: true, writable: false });

// 🔴 EVERY DEEP-EQUALITY MATCHER REFUSES A SCREEN ELEMENT (`DEEP_EQUALITY` below: `toEqual`, `toStrictEqual`, `toContainEqual`,
// `toMatchObject`, `toHaveProperty`'s value, the spy's «called with» and «returned with») — the Dev, 2026-09-26: «crie uma
// trava geral que recusa toEqual com
// elementos de tela em qualquer teste futuro»). Vitest compares two DOM nodes with `isEqualNode`, so a COPY of an element passes
// as the element: a case claiming «the cursor IS on this option» stays green when the code hands over a clone, and that is how a
// mutation survived in the footer-glide work (commit c9a10098, which converted the six assertions that did it). So either side
// holding a Node — a node, a NodeList or HTMLCollection, or an array, Set, Map, object or asymmetric matcher holding one — fails
// the assertion, `.not` included, before anything is compared. Identity is `toBe`; content is a property (`textContent`, `id`, a
// list of ids). The proof is `tests/to-equal-refuses-screen-elements.browser.test.js`.
import { chai } from 'vitest';

/** Does `value` hold a DOM node anywhere a deep equality looks — its items, its entries, its own properties? Each visited once. */
function holdsAScreenElement(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return false;
  if (value instanceof Node || value instanceof NodeList || value instanceof HTMLCollection) return true;
  if (seen.has(value)) return false;
  seen.add(value);
  const inside = (items) => [...items].some((item) => holdsAScreenElement(item, seen));
  if (value instanceof Set) return inside(value);
  if (value instanceof Map) return inside(value.keys()) || inside(value.values());
  return inside(Object.values(value)); // an array's items, an object's own fields, an asymmetric matcher's `sample`
}

/**
 * EVERY MATCHER THAT COMPARES BY DEEP EQUALITY, and what of it to look at: the received value and the arguments for the ones that
 * compare the two; only the arguments for the spy's (the received side is the spy; `nth` forms lead with a count), and only the
 * value for `toHaveProperty` (its first argument is a path). A deep equality anywhere lets a copy pass as the element.
 */
const both = (received, args) => [received, ...args];
const argsOnly = (_received, args) => args;
const DEEP_EQUALITY = {
  toEqual: both, toStrictEqual: both, toContainEqual: both, toMatchObject: both,
  toHaveProperty: (_received, args) => args.slice(1),
  toHaveBeenCalledWith: argsOnly, toBeCalledWith: argsOnly,
  toHaveBeenLastCalledWith: argsOnly, lastCalledWith: argsOnly,
  toHaveBeenNthCalledWith: (_received, args) => args.slice(1), nthCalledWith: (_received, args) => args.slice(1),
  toHaveReturnedWith: argsOnly, toReturnWith: argsOnly,
  toHaveLastReturnedWith: argsOnly, lastReturnedWith: argsOnly,
  toHaveNthReturnedWith: (_received, args) => args.slice(1), nthReturnedWith: (_received, args) => args.slice(1),
};

chai.use((api, utils) => {
  for (const [name, compared] of Object.entries(DEEP_EQUALITY)) {
    if (typeof api.Assertion.prototype[name] !== 'function') continue; // a name this Vitest does not define
    utils.overwriteMethod(api.Assertion.prototype, name, (compare) => function (...args) {
      if (compared(utils.flag(this, 'object'), args).some((value) => holdsAScreenElement(value))) {
        throw new Error(`${name} refuses a screen element (vitest.setup.browser.js): it compares DOM nodes with isEqualNode, `
          + 'so a copy of an element passes as the element. Compare identity with toBe (node by node for a list), or compare '
          + 'a specific property — textContent, id, a list of ids.');
      }
      return compare.call(this, ...args);
    });
  }
});

// 📌 NO LANGUAGE IS LOADED HERE ANY MORE: `core/i18n` holds no state (ADR-0232 D3, erratum of 2026-09-25). A root builds its
// translator from the storage its host lends, and a case switches the language through its engine (`engine.setLocale`); a case
// with no engine builds one over this file's storage and page (`pageTranslator()`, `tests/fixtures/page-locale.js`).
