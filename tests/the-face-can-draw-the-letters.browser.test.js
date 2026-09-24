// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME'S FACE CAN DRAW THE LETTERS THE GAME SHOWS — measured on the glyph, not on the name.
//
// ========================= THE LESSON IS BORROWED, AND IT WAS EXPENSIVE =========================
// ⚠️ This is not caution: it happened, in `SP-the-inclusionist-whackwhack`. The title came out in the wrong font for FOUR
// commits and every available check said it was right. The vendored `press-start-2p-400.woff2` was the **cyrillic-ext**
// subset — a valid woff2, correctly declared, correctly loaded, **without a single Latin letter**. Google Fonts serves
// this family in five files ordered by `unicode-range` with Latin LAST, and the vendoring took the first `src:` it found.
//
// What the page reported, live, with the wrong glyphs on screen:
//
//     document.fonts.check('16px "Press Start 2P"')   →  true
//     [...document.fonts].map(f => f.status)          →  ['loaded', 'loaded']
//     getComputedStyle(el).fontFamily                 →  '"Press Start 2P", monospace'
//
// All three true and all three useless, because each compares the family NAME — a string written twice, once in the
// `@font-face` and once in the rule, by the same hand. None looks inside the file. And CSS resolves by CODEPOINT: a face
// that loads but has no glyph for `U+0057` is ignored for that character in silence — no console error, no failed
// request, no state in `document.fonts` that can be read.
//
// ⚠️ AND THE GATE THIS TREE ALREADY HAD HAS THE SAME BLIND SPOT: `fontes-carregam.node.test.js` compares the catalogue's
// family name with the `@font-face`'s. It is exactly the comparison that was proved worthless there. This file does not
// replace it — it covers what it cannot reach.
//
// ========================= WHAT IT MEASURES INSTEAD =========================
// The ADVANCE WIDTH of each character, which comes from the glyph and therefore from the FILE.
//
// Press Start 2P is monospaced at exactly 1em: at `SIZE` px, every character advances `SIZE` px. So a character that fell
// back would break the uniformity, and a whole string that fell back would equal the fallback. Both are asserted,
// because they fail for different reasons: the first catches a HOLE in the coverage, the second catches the face
// missing entirely.
//
// ⚠️ AND THE CONTROL IS `serif`, NOT the stack's own `monospace` — that is the whole trick. Against a monospaced fallback
// the measurement is identical with or without the face, and this test would have passed on the Cyrillic file too.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import '../app/public/vendor/fonts.css';
import { FONT_BY_KEY } from '../app/js/ui/fonts.js';

/** Big enough that a rounding difference does not look like a glyph difference. */
// ========================= ⚠️ WHY THIS METHOD HOLDS HERE, AND WHERE IT STOPS HOLDING =========================
// 📏 Written on 2026-09-09, after the SAME method failed in another repository. `game-whackwhack` copied this shape for
// `Atkinson Hyperlegible` and the gate failed on the first Linux run that repository ever had — `7: expected 24 not to
// be 24`, with the face perfectly loaded.
//
// This file's argument has TWO legs, and only the first is about the font file:
//
//   1. THE FACE IS MONOSPACED at exactly 1em, and the control (`serif`) is PROPORTIONAL. A glyph that fell back cannot
//      coincide, because the two families advance by different rules. The `toBeCloseTo(SIZE * CARACTERES.length)` case
//      pins that leg: the day the arcade face stops being monospaced, it fails — and that is what stops the method from
//      silently becoming invalid, which is exactly what happened in the other repository with a PROPORTIONAL face.
//
//   2. ⚠️ THE FAMILY MUST NOT BE INSTALLED ON THE MACHINE. If it is, `font-family` resolves from the SYSTEM and the
//      vendored `@font-face` is never consulted: renaming the declaration so it never matches leaves the whole file
//      GREEN. That is what was measured in the other repository — «Atkinson Hyperlegible Regular» is among this machine's
//      user fonts, and that block has no coverage here.
//      📏 Measured in this tree on 2026-09-09: `Press Start 2P` is NOT installed, neither system-wide nor for the user,
//      and no test of this engine measures Atkinson's metrics. This file is clear of both.
//
// 📌 WHOEVER COPIES THIS SHAPE HAS TO CHECK BOTH. The first is a property of the face and is checked with a case; the
// second is a property of the MACHINE and cannot be checked from inside the test — it is only found by breaking the
// `@font-face` on purpose and seeing whether anything fails.
const SIZE = 48;
const FAMILIA = "'Press Start 2P'";

/**
 * The characters the game may draw in this face: the alphabet, the digits and a HUD's punctuation.
 * ⚠️ NO ACCENTS on purpose — the face is a basic Latin subset, and requiring `ã` from it would accuse it of lacking what
 * it never promised. What is checked is that it draws what the HUD actually uses.
 */
const CARACTERES = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:.-/x%'];

let palco;

/** The width of ONE string, in the given font stack. It measures the real node, which is what the browser draws. */
function largura(texto, stack) {
  const s = document.createElement('span');
  s.style.cssText = `position:absolute;left:-9999px;white-space:pre;font-size:${SIZE}px;font-family:${stack}`;
  s.textContent = texto;
  palco.appendChild(s);
  return s.getBoundingClientRect().width;
}

beforeAll(async () => {
  // Loads the face for the characters to be measured. Without this the first measurement may catch the fallback while
  // the face is still arriving — and a test that runs a race loses it now and then.
  await document.fonts.load(`${SIZE}px ${FAMILIA}`, CARACTERES.join(''));
});

afterEach(() => { palco?.remove(); palco = null; });

describe('a face de arcade desenha as letras do jogo (issue #87, lição do whackwhack)', () => {
  beforeAll(() => { /* noop: the stage is born per case */ });

  it('[Zero] o catálogo declara a face, com papel de JOGO e não de interface', () => {
    const it0 = FONT_BY_KEY.pressstart;
    expect(it0, 'a Press Start 2P saiu do catálogo').toBeTruthy();
    expect(it0.role, 'a face de arcade virou fonte de interface').toBe('jogo');
    expect(it0.fam).toBe('Press Start 2P');
  });

  it('⚠️ [Right] TODO caractere avança exactamente 1em — nenhum caiu para o fallback', () => {
    // The case that catches a HOLE in the coverage: a single missing codepoint is substituted in silence, and its width
    // stops being 1em while all the others still are.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const fora = CARACTERES
      .map((c) => [c, largura(c, `${FAMILIA}, serif`)])
      .filter(([, w]) => Math.abs(w - SIZE) > 0.5)
      .map(([c, w]) => `${c}: ${w.toFixed(1)}px`);
    expect(fora, 'caractere sem glifo na face (caiu para o serif):\n  ' + fora.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] a cadeia inteira NÃO mede o mesmo que o fallback — a face não está ausente', () => {
    // The case that catches the face missing entirely. The control is `serif`, which is PROPORTIONAL: if the face did not
    // load, the two measurements would be equal. With `monospace` as the control, they would be equal either way — and
    // that is why the control cannot be the stack's own fallback.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const texto = CARACTERES.join('');
    const comFace = largura(texto, `${FAMILIA}, serif`);
    const soFallback = largura(texto, 'serif');
    expect(comFace).toBeCloseTo(SIZE * CARACTERES.length, 0);
    expect(Math.abs(comFace - soFallback), 'a cadeia mediu o mesmo que o serif — a face não carregou')
      .toBeGreaterThan(1);
  });

  it('[Interface] o controlo `serif` é mesmo PROPORCIONAL — senão o caso acima não distingue nada', () => {
    // The trick's guard. If one day the environment's `serif` is monospaced, the case above compares two equal
    // measurements and stops proving what it says — and this fails before that goes unnoticed.
    palco = document.createElement('div');
    document.body.appendChild(palco);
    const larguras = ['i', 'W', 'M', 'l'].map((c) => largura(c, 'serif'));
    expect(Math.max(...larguras) - Math.min(...larguras), 'o `serif` deste ambiente é monoespaçado')
      .toBeGreaterThan(1);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ POINTING THE FAMILY'S `@font-face` AT ANOTHER REAL FILE (`atkinson-400.woff2`) → BOTH measurement cases fail.
//     It is the mutation that matters, because it is the Cyrillic scenario translated into something observable: the
//     face LOADS, declares itself and reports itself as right — and draws the wrong glyphs. `[Right] TODO caractere`
//     accuses the characters one by one; `[Right] a cadeia inteira` measures 1183 px where it expected 2016.
//   · ⚠️ And pointing at a file that DOES NOT EXIST does not exercise this gate: Vite resolves the imported CSS's `url()`
//     at build time, so the whole file is SKIPPED instead of failing. Recorded because it is good news misread if left
//     unsaid — the missing file is already caught earlier, by the build; what only this gate catches is the file PRESENT
//     and wrong.
//   · replacing the `serif` control with `monospace` in both cases → both pass EVEN with the face missing. It is not a
//     code mutation, it is the demonstration of why the control exists — and the reason for the case
//     `[Interface] o controlo é PROPORCIONAL`, which fails if someone makes that swap.
//   · removing `papel:'jogo'` from the catalogue → `[Zero]` fails: the arcade face would become offerable as an
//     interface font, which is what the role exists to prevent.
