// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RONDE FALLS BACK TO COOKIE — measured on the glyphs, not on the name (ADR-0154, issue #150).
//
// The three ronde faces are never packaged, so on a school tablet with none of them installed the ronde stack must reach
// Cookie, which the engine ships. A catalogue that SAYS «…, Cookie» proves nothing: a stack quoted as one string names a
// single family that does not exist, the browser skips it, and the child gets the generic `cursive` with no error
// anywhere. So this measures the ADVANCE WIDTH of a string drawn in the stack exactly as the engine writes it — through
// `setFont('ronde')`, onto the root's `--font-custom` — against the same string in Cookie alone.
//
// ⚠️ THE METHOD HOLDS ONLY IF THE MACHINE LACKS THE THREE: with one installed, the stack resolves to it (correctly) and
// stops equalling Cookie. 📏 Checked on 2026-09-25: none of Ronde Script, OPTIFrench-Script, Merveille or Cookie is in
// the system or user font folders of this machine. The control case below keeps the other leg honest: Cookie must draw
// differently from the generic `cursive`, or «equals Cookie» would also be true of the broken stack.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import '../app/public/vendor/fonts.css';
import { initSettingsTypo } from '../app/js/ui/settings-typo.js';
import { createTranslator } from '../app/js/core/i18n.js';

const SIZE = 48;
const SAMPLE = 'Aa Bb Cc escola ronde';

let stage;
const width = (family) => {
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${SIZE}px;font-family:${family}`;
  s.textContent = SAMPLE;
  stage.appendChild(s);
  return s.getBoundingClientRect().width;
};

beforeAll(async () => {
  // Loads Cookie for the sample: without this the first measurement may catch the fallback while the face is arriving.
  await document.fonts.load(`${SIZE}px 'Cookie'`, SAMPLE);
});

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

  it('🔴 [Right] the stack the engine writes for the ronde draws in Cookie', () => {
    const store = new Map();
    const api = initSettingsTypo({
      t: createTranslator().t, $: (sel) => document.querySelector(sel), srSay: () => {},
      store: { get: (k, fb = null) => store.get(k) ?? fb, set: (k, v) => { store.set(k, String(v)); return true; } },
      root: document.documentElement,
    });
    api.setFont('ronde');
    expect(api.getFontKey(), 'setFont refused the ronde — it is locked again').toBe('ronde');
    stage = document.body.appendChild(document.createElement('div'));
    const stack = width('var(--font-custom)');
    expect(stack, 'the ronde stack does not reach Cookie: the child gets the generic cursive').toBeCloseTo(width("'Cookie'"), 0);
  });
});

// MUTATIONS CHECKED (2026-09-25), each applied by script and restored from a copy:
//   · `familyStack` quoting the whole `fam` once («'Ronde Script, …, Cookie'») → «draws in Cookie» fails.
//   · `, Cookie` removed from the ronde's `fam` → «draws in Cookie» fails.
//   · `off` put back on the ronde → «draws in Cookie» fails (setFont refuses the ronde).
//   · the Cookie `@font-face` renamed in `fonts.css` → «draws in Cookie» fails; the control stays green, since an
//     unknown family and the generic `cursive` still draw differently.
