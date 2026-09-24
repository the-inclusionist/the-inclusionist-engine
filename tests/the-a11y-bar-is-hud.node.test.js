// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ACCESSIBILITY BAR IS HUD: its rectangle is reserved (ADR-0148 §3).
//
// ========================= THE DEFECT, MEASURED IN A BROWSER BEFORE IT WAS WRITTEN =========================
// 🔴 On 2026-09-12, in `dist/quiz.html`: `#title-icons` is `position:absolute` INSIDE `#game-region`, at (123,15) with
// 337×44 — and `H2.quiz-pergunta`, the question's title, occupies the same pixels. The child looking for blind mode,
// TTS or Libras finds game text on top of the buttons.
//
// ⚠️ AND NOTHING FAILED: no error, no type, no console. Just a row of buttons covered — and whoever depends on it most is
// precisely whoever cannot see it is covered. The Dev pointed it out, not a sieve.
//
// 📌 THE DECISION THIS FILE PINS IS WHAT COUNTS AS AN INTRUSION, which is the part people get wrong: the bar intersects
// itself and its own buttons, and a sieve counting them would ALWAYS accuse.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { barIntruders } from '../app/js/ui/layout.js';

const BARRA = { x: 100, y: 10, w: 300, h: 44 };
const no = (nome, caixa, daBarra = false) => ({ name: nome, box: caixa, isBar: daBarra });

describe('invasoresDaBarra — quem escreve por cima do HUD', () => {
  it('🔴 [Right] o título que cobre a barra é ACUSADO, pelo nome', () => {
    // The Dev's case, with the numbers the browser gave.
    // ⚠️ The nodes' NAMES are neutral on purpose (the `engine-boundary` sieve demands it): an engine fixture must not
    // need a genre's vocabulary to run. What this case asserts is geometric — a title over the bar —, and that holds for
    // any game.
    const invasores = barIntruders(BARRA, [
      no('h2#.titulo-da-atividade', { x: 90, y: 5, w: 340, h: 60 }),
      no('div#app.raiz-do-jogo', { x: 80, y: 0, w: 420, h: 400 }),
    ]);
    expect(invasores).toEqual(['h2#.titulo-da-atividade', 'div#app.raiz-do-jogo']);
  });

  it('🔴 [Zero] os BOTÕES da própria barra não contam — senão o crivo acusa sempre', () => {
    // ⚠️ They intersect it by definition. A sieve counting them would be red in every game, and a sieve that always
    // accuses is the same as no sieve — it is ADR-0106 §2's «afogar o que se pode resolver».
    expect(barIntruders(BARRA, [
      no('button#.pi-btn', { x: 110, y: 15, w: 40, h: 40 }, true),
      no('div#title-icons.pause-icons', BARRA, true),
    ])).toEqual([]);
  });

  it('📌 [Boundary] encostar NÃO é invadir — nos DOIS eixos', () => {
    // A node that ends exactly where the bar begins is beside it, not on top. Without this, every game with an element
    // stuck to the bar would be accused, and the consumer would learn to ignore the line.
    //
    // ⚠️ BOTH AXES: a mutation loosening only the X comparison stayed GREEN while the case only touched in Y. A sieve
    // that pins one border and not the other authorises half the defect.
    expect(barIntruders(BARRA, [no('div#.below', { x: 100, y: 54, w: 300, h: 20 })])).toEqual([]);
    expect(barIntruders(BARRA, [no('div#.one-px-inside', { x: 100, y: 53, w: 300, h: 20 })]))
      .toEqual(['div#.one-px-inside']);
    expect(barIntruders(BARRA, [no('div#.to-the-right', { x: 400, y: 10, w: 50, h: 44 })])).toEqual([]);
    expect(barIntruders(BARRA, [no('div#.to-the-left', { x: 50, y: 10, w: 50, h: 44 })])).toEqual([]);
    expect(barIntruders(BARRA, [no('div#.one-px-into-the-right', { x: 399, y: 10, w: 50, h: 44 })]))
      .toEqual(['div#.one-px-into-the-right']);
  });

  it('[Zero] um nó SEM ÁREA não invade nada', () => {
    // Zero-height containers are common in generated markup, and accusing them would be pure noise.
    //
    // 🔴 AND THE SECOND LINE IS THE ONE THAT MATTERS: the strict inequalities exclude the DEGENERATE case AT THE BORDER
    // (the first line), not one in general. A zero-width stripe crossing the bar passes all four comparisons. The guard
    // is needed, and this line is what pins it.
    expect(barIntruders(BARRA, [no('div#.vazio', { x: 100, y: 10, w: 0, h: 0 })])).toEqual([]);
    expect(barIntruders(BARRA, [no('div#.risca', { x: 150, y: 20, w: 0, h: 60 })])).toEqual([]);
  });

  it('🔴 [Zero] sem barra — ou com barra de área zero — NÃO se acusa ninguém', () => {
    // ⚠️ It is the pair that stops the sieve from being a universal accuser: against a zero rectangle, everything
    // «intersecta» by the naive rule. A game with no bar mounted has nothing reserved.
    const tudo = [no('div#.qualquer', { x: 0, y: 0, w: 999, h: 999 })];
    expect(barIntruders(null, tudo)).toEqual([]);
    expect(barIntruders({ x: 100, y: 10, w: 0, h: 44 }, tudo)).toEqual([]);
    expect(barIntruders({ x: 100, y: 10, w: 300, h: 0 }, tudo)).toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script to the file, with the occurrence count checked BEFORE each one. Eight, eight red — and TWO of them
// only turned red after the plan caught me:
//
//   G1  the bar's own buttons start counting            🔴 the sieve would ALWAYS accuse
//   G2a the X border loosens to `<=`                     🔴 touching would become intruding
//   G2b the Y border loosens to `<=`                     🔴 likewise, on the other axis
//   G3  a zero-area bar is no longer refused             🔴 it would accuse everyone
//   G4  the zero-area guard leaves                       🔴 the zero-width stripe
//   G5  the engine does not accuse the overlap (target: browser) 🔴 the silence comes back
//   G6  the reserved band is not declared (likewise)     🔴 the game has nothing to read
//
// ⚠️ G2 SURVIVED THE FIRST ROUND because the border case only touched on one axis. A sieve that pins one border and not
// the other authorises half the defect — and that is why the case got all four sides.
//
// 🔴 AND G4 CAUGHT A MISTAKE OF MINE, which is this file's most useful finding. It survived, I read that as «o guarda de
// área zero é inerte porque as desigualdades estritas já o fazem», and REMOVED the guard. The reading was false: the strict
// ones exclude the DEGENERATE case AT THE BORDER, not one in general — a zero-width stripe crossing the bar passes all four
// comparisons. The guard came back, and the stripe case is what pins it.
// 📌 The lesson is not about geometry: a surviving mutation says «o crivo não vê isto», and does NOT say «o código é
// inerte». The two conclusions look the same and lead in opposite directions.
