// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE ANSWER TO WHAT THIS CONTROL IS CALLED — the rest of item 3 of ADR-0044.
//
// ========================= THE DEFECT, MEASURED =========================
// In the built game, landing the cursor on the number-of-players button of the start menu:
//
//     the game narrated:        "◀ Number of players: 1 ▶, 1 of 4"
//     the screen reader said:   "Number of players: 1. Click on the left for fewer, on the right for more."
//
// Two sentences for the SAME item, at the same instant. Whoever uses a screen reader AND the game's narration hears the
// item twice, two ways — and the game's version reads the glyphs `◀` and `▶`, the same noise item 4 took out of the pause
// legend. The index "1 of 4" is item 3's and is right; the label came from the wrong source.
//
// The rule was already written ONCE, in `iconCaption`: read the `aria-label` so that hovering or focusing says the SAME
// truth a screen reader would announce. It held for the bar's icons and not for the rest.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { accessibleLabel } from '../app/js/core/accessible-label.js';

/** A fake element with the slice the module reads — no DOM, to run in the `node` project. */
const el = (aria, texto) => ({ getAttribute: (n) => (n === 'aria-label' ? aria : null), textContent: texto });

describe('rótulo acessível · o que o jogo narra é o que o leitor de tela diz', () => {
  it('[Right] `aria-label` VENCE o texto visível', () => {
    // The order is the decision: `aria-label` is what the accessibility platform WILL announce. Narrating something else
    // adds no information — it creates a second version of the same item.
    expect(accessibleLabel(el('Number of players: 1', '◀ Number of players: 1 ▶'))).toBe('Number of players: 1');
  });

  it('[Right] sem `aria-label`, o texto visível é a resposta', () => {
    // Most buttons' case: the two sources already agree by construction, and forcing a declared label on all of them
    // would be work with no gain.
    expect(accessibleLabel(el(null, 'Continuar'))).toBe('Continuar');
  });

  it('[Zero] `aria-label` VAZIO não engole o texto visível', () => {
    // An `aria-label=""` in generated markup is an accident, not a decision. If it won, the item would have NO name — and
    // an item with no name is worse than an item with two.
    expect(accessibleLabel(el('', 'Continuar'))).toBe('Continuar');
    expect(accessibleLabel(el('   ', 'Continuar'))).toBe('Continuar');
  });

  it('[Interface] espaço em branco de markup não vaza', () => {
    // `textContent` brings the HTML's line breaks and indentation. Without this the TTS reads pauses where there is nothing.
    expect(accessibleLabel(el(null, '\n   Sair do jogo  \n'))).toBe('Sair do jogo');
  });

  it('[Zero] elemento ausente devolve string vazia, não estoura', () => {
    expect(accessibleLabel(null)).toBe('');
    expect(accessibleLabel(undefined)).toBe('');
    expect(accessibleLabel(el(null, null))).toBe('');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · reversing the order (visible text before `aria-label`) → the [Right] case where `aria-label` wins fails, and the real effect is
//     the measured defect coming back: the game reading "◀ … ▶" over the screen reader.
//   · replacing `enxuto(aria) || enxuto(texto)` with `aria ?? texto` → the [Zero] empty-`aria-label` case fails with an empty
//     string, which is the item left with no name at all.
