// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE LEGEND IS NOT INVISIBLE TO WHOEVER NEEDS IT MOST — item 4 of ADR-0044.
//
// ========================= THE FINDING =========================
// `.pause-legend` is the line that says WHICH BUTTON DOES WHAT, and it carried `aria-hidden="true"`. That is exactly
// what XAG 106 says to narrate ("A to Select"), explicitly removed from the accessibility tree.
//
// The intent behind the attribute is easy to guess, and it was good: the legend shows controller GLYPHS — `✕`, `○`,
// `□`, `△` on PlayStation —, and a screen reader reads `✕` as a multiplication sign, or reads nothing. Hiding the
// noise looks like the way out. But the price was hiding the INFORMATION with the noise: whoever cannot see had no
// way to know which button confirms.
//
// ========================= WHY REMOVING THE ATTRIBUTE IS NOT ENOUGH =========================
// Removing `aria-hidden` and stopping there would bring the noise back: "sinal de multiplicação Sim, círculo Não". The
// ADR's decision says so in so many words — "It has to be written so it reads well, which is a rewrite and not an
// attribute removal".
//
// So there are TWO layers in the same element: the chips stay visible and MUTE (`aria-hidden` moves down to them),
// and beside them a sentence only for the screen reader — "Botão xis para confirmar, botão bola para voltar." The
// glyph stays on screen for whoever recognises it; the word exists for whoever listens.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { pauseLegendHtml, spokenGlyph } from '../app/js/ui/shell.js';
import { PAD_DESIGNS } from '../app/js/input/devices.js';

/** A pad design's (yes, no) pair: the south button (index 0) and the east one (index 1) on every design, no swap (ADR-0013 erratum). */
function par(desenho) {
  const s = PAD_DESIGNS[desenho];
  return [s['0'], s['1']];
}

describe('legenda da pausa · o glifo fica na tela, a palavra vai para o ouvido', () => {
  it('[Right] os chips visíveis ficam MUDOS e a frase falada nasce ao lado', () => {
    const [sim, nao] = par('microsoft');
    const html = pauseLegendHtml(sim, nao);
    // What is seen: two chips with the glyph and the word, marked for the screen reader to ignore.
    expect(html).toContain('<span class="lg" aria-hidden="true">');
    expect(html).toContain('>A<');
    expect(html).toContain('>B<');
    // What is heard: ONE sentence, and it says what each button DOES.
    expect(html).toContain('<span class="sr-only">Botão A para confirmar, botão B para voltar.</span>');
  });

  it('[Right] o glifo do PlayStation vira PALAVRA na frase falada — e continua glifo na tela', () => {
    // The case that justifies the whole item. `✕` on screen is recognisable to whoever sees; to the ear it is
    // a multiplication sign or silence. Both have to hold at the same time.
    const [sim, nao] = par('sony'); // yes is the south button on PlayStation too: cross (ADR-0013 erratum)
    const html = pauseLegendHtml(sim, nao);
    expect(html).toContain('>○<');
    expect(html).toContain('>✕<');
    expect(html).toContain('<span class="sr-only">Botão xis para confirmar, botão bola para voltar.</span>');
  });

  it('[Zero] NADA na legenda carrega `aria-hidden` no elemento de fora — só nos chips', () => {
    // The regression this case prevents is the attribute returning to the `<p>`: that alone would make the spoken
    // sentence vanish with it, and the case above would stay green, because the sentence would be there — just unreachable.
    const [sim, nao] = par('generic');
    const html = pauseLegendHtml(sim, nao);
    expect(html.startsWith('<span class="lg"')).toBe(true); // no wrapper at all: the DOM builds the `<p>`
    expect(html).toContain('class="sr-only"');
    expect(html.indexOf('aria-hidden')).toBeGreaterThan(-1);
    expect(html.split('sr-only')).toHaveLength(2); // one sentence, not one per chip
  });

  it('[Boundary] glifo que já se lê passa INTOCADO — a tradução é só para os quatro que não se leem', () => {
    // Turning "A" into "letra A" would be noise added in the name of accessibility, which is the defect this
    // item fixes, turned inside out.
    expect(spokenGlyph('A')).toBe('A');
    expect(spokenGlyph('0')).toBe('0');
    expect(spokenGlyph('✕')).toBe('xis');
    expect(spokenGlyph('○')).toBe('bola');
    expect(spokenGlyph('□')).toBe('quadrado');
    expect(spokenGlyph('△')).toBe('triângulo');
  });

  it('[Interface] a cor do chip continua saindo do desenho do controle', () => {
    // The legend is the only colour cue that matches the screen to the physical controller in the child's hand. It
    // must not be a casualty of the accessibility change.
    const [sim, nao] = par('microsoft');
    const html = pauseLegendHtml(sim, nao);
    expect(html).toContain('background:' + sim[1]);
    expect(html).toContain('background:' + nao[1]);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing `aria-hidden` from the chips → `[Right] os chips visíveis ficam MUDOS` fails, and the real effect
//     would be the reader reading the glyph AND the sentence, twice.
//   · giving the raw glyph back to the spoken sentence (without `spokenGlyph`) → `[Right] o glifo do PlayStation` fails
//     with "Botão ○ para confirmar".
//   · replacing the sentence with two `sr-only`, one per chip → `[Zero] uma frase, não uma por chip` fails.
