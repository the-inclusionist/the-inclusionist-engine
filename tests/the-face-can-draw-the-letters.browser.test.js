// SPDX-License-Identifier: AGPL-3.0-or-later
// A FACE THE ENGINE WRITES DRAWS THE LETTERS — measured on the glyph, not on the name.
//
// ========================= THE LESSON IS BORROWED, AND IT WAS EXPENSIVE =========================
// ⚠️ This is not caution: it happened, in `SP-the-inclusionist-whackwhack`. The title came out in the wrong font for FOUR
// commits and every available check said it was right. The vendored `press-start-2p-400.woff2` was the **cyrillic-ext**
// subset — a valid woff2, correctly declared, correctly loaded, **without a single Latin letter**.
//
// What the page reported, live, with the wrong glyphs on screen:
//
//     document.fonts.check('16px "Press Start 2P"')   →  true
//     [...document.fonts].map(f => f.status)          →  ['loaded', 'loaded']
//     getComputedStyle(el).fontFamily                 →  '"Press Start 2P", monospace'
//
// All three true and all three useless, because each compares the family NAME. None looks inside the file.
//
// ========================= WHAT IT MEASURES NOW (ADR-0255) =========================
// Press Start 2P left the package for the font library, as its AUTHOR'S ORIGINAL (ADR-0254): the whole font, no subset to pick
// wrongly, and every table checked against the author's in `font-licences.node.test.js`. What the engine now does ITSELF is
// write a library family's `@font-face` rules (`platform/font-library`), and that writer is what this file measures: a family
// declared through it DRAWS from the file its rule points at. The face is the package's Atkinson Hyperlegible Mono, declared
// under a probe name no machine has installed — so the only way the probe draws monospaced is through the rule the writer wrote.
//
// The measure is the ADVANCE WIDTH, which comes from the glyph and therefore from the FILE: a monospaced face advances every
// character by the same width, and a character that fell back breaks the uniformity. ⚠️ THE CONTROL IS `serif`, NOT
// `monospace` — against a monospaced fallback the measurement is identical with or without the face.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { FONT_BY_KEY } from '../app/js/ui/fonts.js';
import { libraryFaceRules } from '../app/js/platform/font-library.js';

const SIZE = 48;
const PROBE = 'Library Probe Mono';
const FAMILIA = `'${PROBE}'`;
/** The package's mathematics face, which the probe family's one rule points at. */
const FILE = new URL('../app/public/vendor/fonts/atkinson-mono-400.woff2', import.meta.url).href;
const LIBRARY = { mirror: 'https://lfs.example/fonts', ranges: {},
  families: { [PROBE]: { folder: 'probe', licence: 'OFL-1.1', faces: [{ file: 'atkinson-mono-400.woff2', weight: '400', style: 'normal', bytes: 1, sha256: '0' }] } } };

/** The characters a game's HUD draws: the alphabet, the digits and its punctuation. */
const CARACTERES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/x%'];

let palco;
let style;

/** The width of ONE string, in the given font stack. It measures the real node, which is what the browser draws. */
function largura(texto, stack) {
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${SIZE}px;font-family:${stack}`;
  s.textContent = texto;
  palco.appendChild(s);
  return s.getBoundingClientRect().width;
}

beforeAll(async () => {
  style = document.createElement('style');
  // the writer's rules, as the root writes them — every address through `href`, here the package's own file
  style.textContent = libraryFaceRules(LIBRARY, [PROBE], () => FILE);
  document.head.appendChild(style);
  // Loads the face for the characters to be measured: without this the first measurement may catch the fallback.
  await document.fonts.load(`${SIZE}px ${FAMILIA}`, CARACTERES.join(''));
});
afterAll(() => style?.remove());
afterEach(() => { palco?.remove(); palco = null; });

describe('a face the engine writes draws the letters (issue #87, the whackwhack lesson, ADR-0255)', () => {
  it('[Zero] the arcade face is in the catalogue with the GAME role, not the interface\'s', () => {
    const it0 = FONT_BY_KEY.pressstart;
    expect(it0, 'Press Start 2P left the catalogue').toBeTruthy();
    expect(it0.role, 'the arcade face became an interface face').toBe('jogo');
    expect(it0.fam).toBe('Press Start 2P');
  });

  it('⚠️ [Right] EVERY character advances the same width — none fell back', () => {
    palco = document.body.appendChild(document.createElement('div'));
    const larguras = CARACTERES.map((c) => [c, largura(c, `${FAMILIA}, serif`)]);
    const w = larguras[0][1];
    const fora = larguras.filter(([, x]) => Math.abs(x - w) > 0.5).map(([c, x]) => `${c}: ${x.toFixed(1)}px (A: ${w.toFixed(1)})`);
    expect(fora, 'character with no glyph in the face (fell back to the serif):\n  ' + fora.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] the whole string does NOT measure what the fallback does — the face is not missing', () => {
    palco = document.body.appendChild(document.createElement('div'));
    const texto = CARACTERES.join('');
    expect(Math.abs(largura(texto, `${FAMILIA}, serif`) - largura(texto, 'serif')), 'the string measured the same as the serif — the face did not load')
      .toBeGreaterThan(1);
  });

  it('[Interface] the `serif` control really is PROPORTIONAL — otherwise the cases above tell nothing apart', () => {
    palco = document.body.appendChild(document.createElement('div'));
    const larguras = ['i', 'W', 'M', 'l'].map((c) => largura(c, 'serif'));
    expect(Math.max(...larguras) - Math.min(...larguras), 'this environment\'s `serif` is monospaced').toBeGreaterThan(1);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-27, ADR-0255; applied by script and restored from a copy by sha256.)
//   W1 the writer ignores `href` and points the face at the mirror's address → 🔴 the suite: `document.fonts.load` rejects with
//      NetworkError in `beforeAll`, and no case runs. (The same mutation fails the ronde's file.)
//   · removing `role:'jogo'` from the catalogue → `[Zero]` fails (recorded when this file measured Press Start 2P itself).
