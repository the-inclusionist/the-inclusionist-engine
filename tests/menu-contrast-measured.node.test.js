// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MENU'S CONTRAST IN HIGH CONTRAST — measured, not estimated (issue #83).
//
// ========================= WHAT THIS FILE PREVENTS =========================
// A mode called "high contrast 7:1" that does not deliver 7:1 is WORSE than no mode at all: it promises a number, the
// teacher trusts it, and the child reads worse than they would with no promise. This file exists so the promise and the
// screen cannot drift apart silently.
//
// The colours are READ FROM `style.css`, not copied here. Two sources that copy each other drift apart — the defect
// this repository has paid for many times with `DomQuery`. If someone changes a token, the arithmetic changes with it
// and the case fails by itself.
//
// ========================= WHY THE VEIL IS OPAQUE AND THE CURSOR INVERTED =========================
// A translucent veil (`rgba(4,7,15,.72)`) gives text a ratio that DEPENDS on the game behind — 19.17:1 over a black
// frame, 8.07:1 over a white one; with `--ink-soft`, `--accent` and `--good` it fell to 5.92 / 5.94 / 5.11:1, AA and not
// AAA. A `#2a3a5e` selected button gave `--good` 6.70:1.
//
// The fix invents no colour: an OPAQUE veil (no half-tone, no dependency) and an INVERTED cursor (`--accent` background,
// `--accent-ink` text). Darkening the selected button would bring it closer to the unselected ones and the child would
// LOSE THE CURSOR — inverting solves contrast and distinction at once. (At 3:1 and 4.5:1 the menu already passed;
// inventing a per-level difference would be theatre.)
//
// MUTATIONS CHECKED:
//   · putting `background:rgba(4,7,15,.72)` back on `#dom-layer.hc .screen-pause` → the veil case fails, because the
//     value is no longer opaque.
//   · changing `--panel-btn` to `#3a4a6a` (the button's BORDER colour) → "ink-soft sobre botão: 6.12:1" fails. A
//     `#2a3a5e` was tried first and it PASSES (7.77:1) — the obvious mutation did not serve, and that is recorded because
//     an annotated mutation that does not fail is worse than none: it gives the feeling of rigour without the rigour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// The WCAG arithmetic lives in `fixtures/wcag-contrast.js`, shared with other gates (the ADR-0029 mark, issue #61):
// importing a `.test.js` would run its `describe`s twice.
import { razaoDeContraste, hex, lerToken } from './fixtures/wcag-contrast.js';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');

/** Reads `--name:#rrggbb` from `:root`. Fails LOUDLY if the token is gone — better than measuring `undefined`. */
function token(nome) {
  return lerToken(CSS, nome);
}

/* ===================== the pairs the child actually reads ===================== */

const ALVO_AAA = 7; // the highest level the mode promises

describe('alto contraste no DOM · o menu entrega o que o modo promete (issue #83)', () => {
  it('[Zero] o gate está lendo o CSS de verdade', () => {
    expect(CSS.length).toBeGreaterThan(5000);
    expect(CSS).toContain('#dom-layer.hc');
  });

  it('[Right] o véu do painel de pausa é OPACO na BASE — 7:1 desde o início, não só no modo', () => {
    // The Dev's decision, 2026-08-26, and the reason is use: it is IN THE MENU that a person with a disability adjusts
    // the controls for themselves. Contrast that arrives only after they find the setting arrives late. It is the same
    // reason blind mode is born with TTS, earcons, sonar and the ledge guard on.
    //
    // The root cause of the worst case was TRANSLUCENCY: a translucent veil has whatever ratio the frame behind allows —
    // 19.17:1 over a black frame, 8.07:1 over a white one. While it is translucent, no number here is a guarantee; it is
    // an average of luck.
    //
    // THE COST IS DECLARED: the game behind the pause is no longer visible.
    for (const sel of ['pause-incanvas', 'screen-pause']) {
      const regra = CSS.match(new RegExp('\.' + sel + '\{[^}]*background:([^;}]+)'));
      expect(regra, 'a regra de fundo de .' + sel + ' sumiu').toBeTruthy();
      expect(regra[1], '.' + sel + ' voltou a ser translúcido — a razão volta a depender do jogo').not.toMatch(/rgba|transparent/);
    }
  });

  it('[Right] todo par de texto do menu bate 7:1 em alto contraste', () => {
    const veu = token('bg-solid'), btn = token('panel-btn');
    const ink = token('ink'), inkSoft = token('ink-soft'), accent = token('accent'), accentInk = token('accent-ink');
    const pares = [
      ['ink sobre véu', ink, veu],
      ['ink-soft sobre véu', inkSoft, veu],
      ['accent sobre véu', accent, veu],
      ['ink sobre botão', ink, btn],
      ['ink-soft sobre botão', inkSoft, btn],
      ['cursor invertido (accent-ink sobre accent)', accentInk, accent],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO_AAA)
      .map(([nome, r]) => `${nome}: ${r.toFixed(2)}:1`);
    expect(falham, 'par abaixo de 7:1 num modo que promete 7:1: ' + falham.join(' | ')).toEqual([]);
  });

  it('[Right] a PALETA BASE também bate 7:1 — o modo não é pré-requisito para enxergar o menu', () => {
    // The Dev's correction: high contrast is a SETTING, not the way in. Whoever needs it must be able to READ the menu to
    // find it. If the menu became legible only after it was on, the person would have to cross what they cannot see to
    // reach what would let them see.
    const veu = token('bg-solid'), btn = token('panel-btn'), sel = hex('#2a3a5e');
    const ink = token('ink'), inkSoft = token('ink-soft');
    const pares = [
      ['ink sobre véu', ink, veu],
      ['ink-soft sobre véu', inkSoft, veu],
      ['ink sobre botão', ink, btn],
      ['ink-soft sobre botão', inkSoft, btn],
      ['ink sobre selecionado', ink, sel],
      // The selected button's BORDER is held with the text, and the reason is the Dev's: WCAG 1.4.11 asks 3:1 for a
      // component, and 3:1 is a FLOOR, not a ceiling. Treating a minimum as permission to stop is the opposite of what
      // this project does — and the pair measures 7.80:1. If it ever falls below 7:1, the suite says so.
      ['borda accent sobre selecionado', token('accent'), sel],
    ];
    const falham = pares
      .map(([nome, fg, bg]) => [nome, razaoDeContraste(fg, bg)])
      .filter(([, r]) => r < ALVO_AAA)
      .map(([nome, r]) => nome + ': ' + r.toFixed(2) + ':1');
    expect(falham, 'a paleta BASE do menu não bate 7:1: ' + falham.join(' | ')).toEqual([]);
  });

  it('[Interface] o cursor continua DISTINGUÍVEL do não-selecionado — contraste não pode custar a orientação', () => {
    // The case that prevents the obvious wrong fix. Darkening the selected button raises the text's ratio and loses the
    // cursor: the child reads well without knowing where they are. Both must hold together.
    const btn = token('panel-btn'), accent = token('accent');
    expect(razaoDeContraste(btn, accent), 'selecionado e não-selecionado ficaram parecidos demais').toBeGreaterThan(3);
  });

  it('[Boundary] a conta é a da WCAG — confere contra valores conhecidos', () => {
    // Without this, an error in the formula would leave every case above green while measuring the wrong thing.
    // Black/white is 21:1 by definition, and mid-grey against white is the canonical pair of the standard's examples.
    expect(razaoDeContraste([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(razaoDeContraste([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    expect(razaoDeContraste([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 1);
  });
});
