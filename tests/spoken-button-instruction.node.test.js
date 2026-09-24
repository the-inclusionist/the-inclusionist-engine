// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SPOKEN INSTRUCTION HAS TO NAME THE RIGHT BUTTON.
//
// ========================= WHY =========================
// `sr.power.wallcling` and `sr.physics.spiderOn` are the two sentences the child HEARS about the spider power. Whoever
// sees finds the button by trying; whoever cannot see has THAT SENTENCE as the only channel. When a button name was
// written inside them and a setting moved the trigger to another button, both sentences pointed at a button that did
// something else — ADR-0044's trap in its purest form: the only information that child has, wrong.
//
// ========================= THE SHAPE OF THE FIX =========================
// The button's name is `{botao}` and travels by parameter — "the frame lives in the key, the content travels through
// `{param}`", the rule this project already uses for curriculum and for the touch slot. One sentence in the three
// languages, and the name varies with the setting.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

describe('instrução falada · o botão dito é o botão que funciona', () => {
  it('[Right] a instrução do grude manda apertar o BOTÃO DE INTERAÇÃO, e só ele', () => {
    // The wall-cling trigger is the INTERACTION button (the Dev revoked moving it to jump, and `botaoDeGrude` is gone):
    // there is no choice to make any more. What still matters is that the sentence CARRIES the parameter — without it, it
    // goes back to naming a button by hand.
    for (const [idioma, dic] of [['pt', pt], ['en', en], ['es', es]]) {
      expect(dic['sr.physics.spiderOn'], `${idioma}: a moldura tem de trazer {botao}`).toContain('{botao}');
      expect(dic['sr.power.wallcling'], `${idioma}: idem`).toContain('{botao}');
    }
  });

  it('[Right] as duas frases do poder de aranha carregam `{botao}` nos TRÊS idiomas', () => {
    // Without the parameter, the button's name would be embedded in the text and each language would have to rewrite the
    // whole sentence to change it — which is exactly how the defect was born.
    for (const [nome, d] of [['pt', pt], ['en', en], ['es', es]]) {
      for (const k of ['sr.power.wallcling', 'sr.physics.spiderOn']) {
        expect(d[k], `${nome} não tem ${k}`).toBeTruthy();
        expect(d[k], `${nome}/${k} deixou de carregar {botao}`).toContain('{botao}');
      }
    }
  });

  it('[Zero] nenhuma das duas frases menciona o botão POR NOME — senão a troca não alcança', () => {
    // The case that prevents a half fix: putting `{botao}` in one occurrence and leaving the other written by hand would
    // make the sentence name BOTH buttons, a right one and a wrong one.
    for (const [nome, d] of [['pt', pt], ['en', en], ['es', es]]) {
      for (const k of ['sr.power.wallcling', 'sr.physics.spiderOn']) {
        expect(d[k].toLowerCase(), `${nome}/${k} ainda nomeia um botão à mão`).not.toMatch(/correr|\brun\b|pular|\bjump\b/);
      }
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing `{botao}` from one of the two sentences → the case above fails, and the real effect is the blind child
//     pressing the button that turns running on while trying to cling to the wall.
//   · giving back a hand-written "Correr" in one of the `{botao}` occurrences →
//     `[Zero] nenhuma das duas menciona o botão por nome` fails.
