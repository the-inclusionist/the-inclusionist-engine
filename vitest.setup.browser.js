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

// 🔴 `toEqual` AND `toStrictEqual` REFUSE A SCREEN ELEMENT (the Dev, 2026-09-26: «crie uma trava geral que recusa toEqual com
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

chai.use((api, utils) => {
  for (const name of ['toEqual', 'toStrictEqual']) {
    utils.overwriteMethod(api.Assertion.prototype, name, (compare) => function (expected, ...rest) {
      if (holdsAScreenElement(utils.flag(this, 'object')) || holdsAScreenElement(expected)) {
        throw new Error(`${name} refuses a screen element (vitest.setup.browser.js): it compares DOM nodes with isEqualNode, `
          + 'so a copy of an element passes as the element. Compare identity with toBe (node by node for a list), or compare '
          + 'a specific property — textContent, id, a list of ids.');
      }
      return compare.call(this, expected, ...rest);
    });
  }
});

// 📌 NO LANGUAGE IS LOADED HERE ANY MORE: `core/i18n` holds no state (ADR-0232 D3, erratum of 2026-09-25). A root builds its
// translator from the storage its host lends, and a case switches the language through its engine (`engine.setLocale`); a case
// with no engine builds one over this file's storage and page (`pageTranslator()`, `tests/fixtures/page-locale.js`).
