// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "browser" project. The render module (`render/canvas`) does `import * as PIXI from 'pixi.js'` directly (the
// global `vendor/pixi.min.js` was retired), so it needs no global. globalThis.PIXI stays as a harmless shim for any
// legacy access. See docs/3-Sprint-Design/plan-unit-tests-at-extraction.md.
import * as PIXI from 'pixi.js';
globalThis.PIXI = PIXI;
// No error suppression: the render modules are imported PURELY (nothing loads a texture at import time), so there is no
// asset-load rejection to ignore.
// The stored settings are loaded as a composition root loads them (ADR-0178); `createGame` loads them again from the page's
// storage, and `estado-carregado-pela-raiz` checks the order without this setup.
import * as store from './app/js/platform/storage.js';
import { loadState } from './app/js/core/state.js';
import { loadLocale, applyDom } from './app/js/core/i18n.js';
import { localeHostHooks } from './app/js/platform/locale-host.js';
loadState(store);
// 🔴 AND THE HOST TOO (ADR-0221 step 7g): since `core/i18n` stopped reaching `document`/`window`, the three things a PAGE
// does when the language changes — `<html lang>`, re-translating the markup and telling the window — come in through
// the port. This setup plays the composition root, and without this line a case that checks `<html lang>` measures a
// page nobody told. That is exactly what happened: `tts.browser` went red at the moment of the cut, and it was right.
loadLocale({ ...store, ...localeHostHooks(document, window, applyDom) });

// EACH FILE STARTS WITH NO TYPOGRAPHY CHOSEN. The browser project shares one localStorage across files, and five of them walk the
// typography cycle: since ADR-0176 a stored face with a 20 px floor is applied at boot (25% larger text), and the next file
// opened the quiz with its last option in the footer — failing about one full run in three, never alone.
import { beforeAll } from 'vitest';
beforeAll(() => {
  for (const chave of ['incl_font_k', 'incl_lettercase']) localStorage.removeItem(chave);
  document.documentElement.style.removeProperty('--fonte-escala');
  delete document.documentElement.dataset.letras;
  loadState(store);
});
