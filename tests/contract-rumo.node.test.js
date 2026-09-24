// SPDX-License-Identifier: AGPL-3.0-or-later
// `bearing` — WHERE THE TARGET IS, in the words the topology declared (ADR-0089, finding O4).
//
// What this replaces is worth saying, because the defect was one of accessibility and not of style. The sonar
// (`platform/audio-sonar.ts`) worked out the side by hand, from raw `x`, with a ±4 dead zone:
//
//     alvo.at.x < pl.x - 4 ? 'left' : alvo.at.x > pl.x + 4 ? 'right' : 'ahead'
//
// ⚠️ THREE WORDS WHERE THE CONTRACT HAS EIGHT — and, worse, MIXING FRAMES OF REFERENCE. Left and right are relative to
// the SCREEN; ahead is relative to the BODY. A blind child who hears both in the same sentence has no way to know which
// origin each one speaks from. And everything above or below her became ahead — the information most missing for
// someone who cannot see the screen, erased by a dead zone.
//
// ⚠️ AND THIS IS NOT `Focus.heading`. That one is where the child is FACING; this is where the TARGET is. They are two
// different angles and the sonar needs the second.
import { describe, it, expect } from 'vitest';
import { bearing } from '../app/js/core/contract.js';

const P = (x, y, z) => (z === undefined ? { x, y } : { x, y, z });
const O = P(0, 0);

const ROSA = { kind: 'grid', size: [9, 9], move: 'diagonal', frame: 'compass' };
const LADO = { kind: 'continuous', size: [100, 100], unit: 16, move: 'free', frame: 'clock' };
const CUBO = { kind: 'grid', size: [9, 9, 9], move: 'orthogonal', frame: 'compass' };
const LISTA = { kind: 'hotspots', order: ['q1', 'q2'] };

describe('rosa-dos-ventos — e `y` cresce para BAIXO, que é o detalhe que inverte tudo', () => {
  // ⚠️ The SCREEN's vertical axis points down: it is the canvas coordinate, inherited from all the code that exists.
  // Whoever writes `atan2(dy, dx)` instead of `atan2(-dy, dx)` produces a perfectly coherent and perfectly inverted
  // compass rose — north for south —, and nothing but these cases catches it.
  const casos = [
    ['e', P(5, 0)], ['w', P(-5, 0)],
    ['n', P(0, -5)], ['s', P(0, 5)],
    ['ne', P(5, -5)], ['nw', P(-5, -5)],
    ['se', P(5, 5)], ['sw', P(-5, 5)],
  ];
  it.each(casos)('[Right] o alvo em %s sai como %s', (esperado, alvo) => {
    expect(bearing(ROSA, O, alvo)).toEqual({ kind: 'compass', heading: esperado });
  });

  it('[Right] ⚠️ NORTE é para CIMA — o caso que apanha a rosa invertida', () => {
    // Written apart from the `it.each` on purpose: if someone tidies the table above by swapping the pairs, this one still
    // says what the word must mean, without depending on the table.
    expect(bearing(ROSA, O, P(0, -1)).heading).toBe('n');
    expect(bearing(ROSA, O, P(0, 1)).heading).toBe('s');
  });

  it('[Boundary] o setor é de 45°, e a fronteira cai para o vizinho e não para o vazio', () => {
    expect(bearing(ROSA, O, P(10, -3)).heading).toBe('e');   // 16,7° — ainda leste
    expect(bearing(ROSA, O, P(10, -10)).heading).toBe('ne'); // 45° — full north-east
    expect(bearing(ROSA, O, P(3, -10)).heading).toBe('n');   // 73.3° — already north
  });
});

describe('relógio — a vista LATERAL, onde norte e sul não querem dizer nada', () => {
  // 12 o'clock is UP and the hands move CLOCKWISE. The easy error is measuring counter-clockwise, trigonometrically: then
  // 3 o'clock comes out where 9 should be, and the sentence is coherent and wrong.
  const casos = [[12, P(0, -5)], [3, P(5, 0)], [6, P(0, 5)], [9, P(-5, 0)], [2, P(5, -5)], [8, P(-5, 5)]];
  it.each(casos)('[Right] %i horas', (hora, alvo) => {
    expect(bearing(LADO, O, alvo)).toEqual({ kind: 'clock', hour: hora });
  });

  it('[Boundary] a hora é 1..12 e NUNCA 0 — «às 0 horas» não é coisa que se diga', () => {
    // `% 12` returns 0 for the top, and 0 is the one output a dial does not have. An `hour: 0` would reach the narration as
    // a translation key that does not exist, and the screen reader would go quiet — the most silent defect there is in
    // this product.
    for (let a = 0; a < 360; a += 7) {
      const r = bearing(LADO, O, P(Math.cos((a * Math.PI) / 180) * 9, -Math.sin((a * Math.PI) / 180) * 9));
      expect(r.hour, `${a}°`).toBeGreaterThanOrEqual(1);
      expect(r.hour, `${a}°`).toBeLessThanOrEqual(12);
    }
  });

  it('[Interface] o MESMO alvo dá palavras diferentes conforme o referencial declarado', () => {
    // The pair that proves the field is read, and not that the two fixtures happen to differ in something else.
    expect(bearing({ ...ROSA, frame: 'compass' }, O, P(5, -5))).toEqual({ kind: 'compass', heading: 'ne' });
    expect(bearing({ ...ROSA, frame: 'clock' }, O, P(5, -5))).toEqual({ kind: 'clock', hour: 2 });
  });
});

describe('o eixo vertical do ESPAÇO — zênite e nadir', () => {
  it('[Right] `z` cresce para CIMA: acima é zênite, abaixo é nadir', () => {
    // ⚠️ The OPPOSITE convention to `y`, and chosen: nothing forces the third axis's orientation, and zenith can only mean
    // the side the child would look at by raising her head. `y` goes down because it is a screen coordinate, inherited;
    // `z` goes up because it is a world coordinate, decided.
    expect(bearing(CUBO, P(0, 0, 0), P(0, 0, 5))).toEqual({ kind: 'compass', heading: 'zenith' });
    expect(bearing(CUBO, P(0, 0, 0), P(0, 0, -5))).toEqual({ kind: 'compass', heading: 'nadir' });
  });

  it('[Boundary] o vertical só ganha quando DOMINA o plano', () => {
    expect(bearing(CUBO, P(0, 0, 0), P(10, 0, 1)).heading).toBe('e');       // quase tudo no plano
    expect(bearing(CUBO, P(0, 0, 0), P(1, 0, 10)).heading).toBe('zenith');  // quase tudo na vertical
  });

  it('[Zero] ⚠️ numa topologia de DUAS dimensões o `z` é IGNORADO, mesmo que o ponto o traga', () => {
    // The dimension is `size.length`, not what the point happens to carry. Without this, a `z` forgotten in a 2D fixture
    // would have the narration say zenith in a game with no height at all.
    expect(bearing(ROSA, P(0, 0, 0), P(5, 0, 99))).toEqual({ kind: 'compass', heading: 'e' });
    expect(bearing(LADO, P(0, 0, 0), P(0, -5, 99))).toEqual({ kind: 'clock', hour: 12 });
  });

  it('[Interface] zênite e nadir saem como COMPASSO mesmo num jogo de relógio', () => {
    // A dial has no position for above the plane. Returning an hour here would be inventing a direction.
    expect(bearing({ ...CUBO, frame: 'clock' }, P(0, 0, 0), P(0, 0, 5)))
      .toEqual({ kind: 'compass', heading: 'zenith' });
  });
});

describe('quando não há direção que dizer', () => {
  it('[Zero] o mesmo lugar não tem rumo — e inventar um seria mentir', () => {
    expect(bearing(ROSA, P(3, 4), P(3, 4))).toEqual({ kind: 'none' });
    expect(bearing(LADO, P(3, 4), P(3, 4))).toEqual({ kind: 'none' });
    expect(bearing(CUBO, P(3, 4, 5), P(3, 4, 5))).toEqual({ kind: 'none' });
  });

  it('[Zero] uma LISTA não tem espaço, logo não tem direção', () => {
    expect(bearing(LISTA, P(0, 0), P(3, 0))).toEqual({ kind: 'none' });
  });
});
