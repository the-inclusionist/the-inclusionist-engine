// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RONDE FALLS BACK TO COOKIE — measured on the glyphs, not on the name (ADR-0154, issue #150, ADR-0255).
//
// The three ronde faces are never distributed, so on a school tablet with none of them installed the ronde stack must reach
// Cookie — since ADR-0255 a font LIBRARY family, whose `@font-face` the engine writes where the game declared it. A catalogue that
// SAYS «…, Cookie» proves nothing: a stack quoted as one string names a single family that does not exist, the browser skips
// it, and the child gets the generic `cursive` with no error anywhere. So this measures the ADVANCE WIDTH of a string drawn in
// the stack exactly as the engine writes it — through `setFont('ronde')`, onto the root's `--font-custom` — against the same
// string in Cookie alone.
//
// 📌 COOKIE HERE IS THE LIBRARY WRITER'S RULE for the family, pointed at a joined hand the package carries (Playwrite BR): the
// author's Cookie lives in the mirror, not in this repository. What is measured is the engine's half — the stack reaching its
// LAST family, declared by the engine's own rule — and it holds whatever file that rule points at.
// ⚠️ THE METHOD HOLDS ONLY IF THE MACHINE LACKS THE THREE: with one installed, the stack resolves to it (correctly) and stops
// equalling Cookie. 📏 Checked on 2026-09-25: none of Ronde Script, OPTIFrench-Script, Merveille or Cookie is in the system or
// user font folders of this machine. The control case keeps the other leg honest.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { initSettingsTypo } from '../app/js/ui/settings-typo.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { libraryFaceRules } from '../app/js/platform/font-library.js';

const SIZE = 48;
const SAMPLE = 'Aa Bb Cc escola ronde';
const FILE = new URL('../app/public/vendor/fonts/playwrite-br.woff2', import.meta.url).href;
const LIBRARY = { mirror: 'https://lfs.example/fonts', ranges: {},
  families: { Cookie: { folder: 'cookie', licence: 'OFL-1.1', faces: [{ file: 'playwrite-br.woff2', weight: '100 400', style: 'normal', bytes: 1, sha256: '0' }] } } };

let stage;
let style;
const width = (family) => {
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${SIZE}px;font-family:${family}`;
  s.textContent = SAMPLE;
  stage.appendChild(s);
  return s.getBoundingClientRect().width;
};

beforeAll(async () => {
  style = document.createElement('style');
  style.textContent = libraryFaceRules(LIBRARY, ['Cookie'], () => FILE);
  document.head.appendChild(style);
  await document.fonts.load(`${SIZE}px 'Cookie'`, SAMPLE);
});
afterAll(() => style?.remove());

afterEach(() => {
  stage?.remove();
  stage = null;
  document.documentElement.style.removeProperty('--font-custom');
  document.documentElement.style.removeProperty('--fonte-escala');
  document.documentElement.removeAttribute('data-fonte');
  document.documentElement.removeAttribute('data-cursiva');
});

describe('the ronde stack reaches Cookie on a device without the three', () => {
  it('⚠️ [Interface] Cookie draws differently from the generic cursive — otherwise the case below measures nothing', () => {
    stage = document.body.appendChild(document.createElement('div'));
    expect(Math.abs(width("'Cookie'") - width('cursive')), 'Cookie did not load, or equals the generic').toBeGreaterThan(5);
  });

  it('🔴 [Right] the stack the engine writes for the ronde draws in Cookie, where the game declared Cookie', () => {
    const store = new Map();
    const api = initSettingsTypo({
      t: createTranslator().t, $: (sel) => document.querySelector(sel), srSay: () => {},
      store: { get: (k, fb = null) => store.get(k) ?? fb, set: (k, v) => { store.set(k, String(v)); return true; } },
      root: document.documentElement,
      fontInstalled: (family) => family === 'Cookie', // the root's answer for a game that declared Cookie (ADR-0255)
    });
    api.setFont('ronde');
    expect(api.getFontKey(), 'setFont refused the ronde although its game declared Cookie').toBe('ronde');
    stage = document.body.appendChild(document.createElement('div'));
    expect(width('var(--font-custom)'), 'the ronde stack does not reach Cookie: the child gets the generic cursive').toBeCloseTo(width("'Cookie'"), 0);
  });
});

// MUTATIONS CHECKED (2026-09-25), each applied by script and restored from a copy:
//   · `familyStack` quoting the whole `fam` once («'Ronde Script, …, Cookie'») → «draws in Cookie» fails.
//   · `, Cookie` removed from the ronde's `fam` → «draws in Cookie» fails.
//   · `off` put back on the ronde → «draws in Cookie» fails (setFont refuses the ronde).
//   · the Cookie `@font-face` renamed → «draws in Cookie» fails; the control stays green.
// And on 2026-09-27 (ADR-0255), with Cookie a library family written by the engine's writer: `, Cookie` removed from the ronde's
// `fam` → «draws in Cookie» fails (W2); the writer pointing at the mirror instead of `href` → the suite fails in `beforeAll` (W1).
