// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHANGED-FROM-DEFAULT MARK MUST BE SEEN — measured, not estimated (ADR-0029, issue #61).
//
// ========================= WHY THIS FILE EXISTS =========================
// Issue #61 closes with a warning written by the Dev and never kept: «⚠️ Não verificado: contraste da marca. WCAG
// 1.4.11 pede 3:1 para indicador não-textual, e NINGUÉM MEDIU.» The panels mark, ADR-0029 described three channels, and
// the one number behind all of it was none.
//
// It is the same defect the `contraste-menu` check already fixed for text: an accessibility feature that promises and
// does not measure is worse than its absence, because the teacher trusts what is written.
//
// ========================= WHAT WAS MEASURED =========================
// Target: 7:1, the same choice `contraste-menu` made for the cursor's border — WCAG 1.4.11 asks 3:1 for a component, and
// 3:1 is a FLOOR, not a ceiling. Treating a minimum as permission to stop is the opposite of what this project does. No
// pair came close to needing the slack:
//
//   base theme         frame over the row (.ctrl-row)       18.42:1
//                      frame over the button (--panel)      15.30:1
//                      frame over the .pm-btn               14.91:1
//   high contrast      frame over the row                   14.54:1
//                      frame over the button (--panel)      16.57:1
//                      frame over the .pm-btn               11.77:1
//
// ⚠️ AND THE MEASUREMENT FOUND WHAT THE WARNING DID NOT FORESEE, which is this file's finding:
//
//   MARKED against UNMARKED measures 1.45:1 in the base theme and 1.27:1 in high contrast.
//
// That is: by LUMINANCE, the two frames are the same. White (#fff) against `--ink-soft` (#cdd6f2), and yellow (#ffe600)
// against white, are differences of HUE. For whoever sees in greyscale — achromatopsia, a monochrome screen, print — the
// mark's COLOUR channel delivers nothing, in both themes.
//
// This is NOT a defect, and the distinction matters: it is exactly why ADR-0029 has three channels and not one, and why
// channel 2 is a COUNT OF RINGS. What changes is the ring's status — it stops being reinforcement and becomes what
// carries the information for part of the audience. That is why the `[Interface]` case below holds the ring: whoever
// deletes it one day because the colour already says it will be deleting the only thing that says it.
//
// ⚠️ The comment of `@media (prefers-contrast: more)` in `style.css` says that without the swap marked and unmarked become
// the same frame. That stays literally true — there `--ink-soft` IS already white, and without the swap both would be
// the SAME value, not just similar. The swap buys hue distinction; it does not buy contrast. Both sentences live
// together, and both are held by a case.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { razaoDeContraste, hex, lerToken } from './fixtures/wcag-contrast.js';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');

/** Where the high-contrast token redeclaration starts. Everything before is the base theme. */
const HC = CSS.indexOf('@media (prefers-contrast: more)');

const base = (nome) => lerToken(CSS, nome);
const alto = (nome) => lerToken(CSS, nome, HC);

/** A rule's LITERAL `background:#rrggbb`, read from the stylesheet instead of copied here. */
function fundoDaRegra(seletor) {
  const m = CSS.match(new RegExp(seletor.replace('.', '\\.') + '\\{[^}]*background:\\s*(#[0-9a-fA-F]{3,8})'));
  if (!m) throw new Error(`o fundo literal de ${seletor} sumiu do style.css — o par deixou de existir`);
  return hex(m[1]);
}

/** 3:1 is what the standard asks; 7:1 is what this project pays. See the header. */
const ALVO = 7;
const PISO_DA_NORMA = 3;

describe('a marca de "saiu do padrão" é VISÍVEL nos dois temas (ADR-0029, issue #61)', () => {
  it('[Zero] o gate está a ler o CSS de verdade, e achou os DOIS temas', () => {
    // Without this, an `indexOf` returning -1 would make `lerToken(css, nome, -1)` measure the last character and throw —
    // or worse, make the high-contrast reading return the base theme's value silently, and every case below would stay
    // green measuring the same theme twice.
    expect(CSS.length).toBeGreaterThan(5000);
    expect(HC, 'o @media do alto contraste sumiu do style.css').toBeGreaterThan(0);
    expect(CSS.slice(0, HC), 'a marca deixou de ter token no tema base').toContain('--changed:');
  });

  it('[Right] a moldura da marca bate 7:1 contra TODA superfície onde é desenhada, nos dois temas', () => {
    const linha = fundoDaRegra('.ctrl-row');   // the panels' option rows
    const pares = [
      ['base · moldura sobre a linha', base('changed'), linha],
      ['base · moldura sobre o botão', base('changed'), base('panel')],
      ['base · moldura sobre o .pm-btn', base('changed'), base('panel-btn')],
      ['alto · moldura sobre a linha', alto('changed'), linha],
      ['alto · moldura sobre o botão', alto('changed'), alto('panel')],
      // `--panel-btn` is NOT redeclared in high contrast — the `.pm-btn` keeps the base theme's background, and the yellow
      // frame is drawn against it. Reading `alto('panel-btn')` would throw, and throwing here would be right: it would
      // mean the stylesheet changed and this pair stopped being the real pair.
      ['alto · moldura sobre o .pm-btn', alto('changed'), base('panel-btn')],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO)
      .map(([nome, r]) => `${nome}: ${r.toFixed(2)}:1`);
    expect(falham, 'a marca ficou abaixo de 7:1 (a norma pede ' + PISO_DA_NORMA + ':1): ' + falham.join(' | ')).toEqual([]);
  });

  it('⚠️ [Interface] o ANEL é o que distingue marcado de não-marcado — a cor não distingue, e está medido', () => {
    // The header's finding, held by a number on both sides.
    //
    // First the observation: the two frames are indistinguishable by luminance. It is stated as an assertion, not as a
    // comment, on purpose — if one day someone picks colours that ALSO contrast with each other, this case fails and
    // forces the paragraph to be reread instead of letting it lie silently.
    const rBase = razaoDeContraste(base('changed'), base('ink-soft'));
    const rAlto = razaoDeContraste(alto('changed'), alto('ink-soft'));
    expect(rBase, `marcado x não-marcado no tema base: ${rBase.toFixed(2)}:1`).toBeLessThan(PISO_DA_NORMA);
    expect(rAlto, `marcado x não-marcado no alto contraste: ${rAlto.toFixed(2)}:1`).toBeLessThan(PISO_DA_NORMA);

    // And that is why the SHAPE channel must exist: it is what remains in greyscale. The rule draws an INNER ring with
    // `box-shadow`, of which the unmarked has none — ADR-0029's count of rings.
    const regra = CSS.match(/\.is-changed\{([^}]*)\}/);
    expect(regra, 'a regra .is-changed sumiu do style.css').toBeTruthy();
    expect(regra[1], 'o ANEL do canal de FORMA saiu, e a cor sozinha não distingue nada em escala de cinza')
      .toMatch(/box-shadow:[^;]*inset[^;]*var\(--changed\)/);
  });

  it('[Boundary] o alto contraste REDECLARA a marca — sem isso ela seria o mesmo valor do não-marcado', () => {
    // The literal promise of the `@media` comment in style.css. There `--ink-soft` is `#fff`; if `--changed` were not
    // swapped, marked and unmarked would be the SAME `#fff` — not similar, equal.
    expect(alto('ink-soft'), 'a premissa mudou: --ink-soft já não é branco no alto contraste').toEqual([255, 255, 255]);
    expect(alto('changed'), 'a marca voltou a ser a cor do não-marcado no alto contraste').not.toEqual(alto('ink-soft'));
    expect(base('changed'), 'a marca ficou igual ao não-marcado no tema base').not.toEqual(base('ink-soft'));
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · replacing `--changed:#fff` with `--changed:#1c2542` (almost the button's background) in `:root` → TWO cases fail,
//     and the second is the proof that the header's paragraph is held and not only written:
//       the [Right] 7:1 case falls on the three base-theme pairs, with 1.22 / 1.01 / 1.01:1;
//       [Interface] falls because a DARK frame contrasts 10.41:1 with `--ink-soft` — that is, the claim that colour does
//       not distinguish would stop being true, and the case forces it to be rewritten.
//   · deleting `.is-changed`'s `box-shadow` → the [Interface] ring case fails: the colour remains, already measured as
//     unable to distinguish.
//   · removing `--changed:#ffe600` from `@media (prefers-contrast: more)` → three cases fail by `lerToken`'s exception
//     (`token --changed não existe a partir do índice 14591`), the right failure: without the token there is nothing to
//     measure, and returning `undefined` would give a green NaN.
//   · ⚠️ switching `--changed` in high contrast to `#fff` (the unmarked colour) → [Boundary] fails on the `.not.toEqual`
//     assertion, AND [Right] stays GREEN (white on black measures 21:1). Recorded because it shows what each case
//     guards: the first guards DISTINCTION, the second VISIBILITY, and neither replaces the other.
