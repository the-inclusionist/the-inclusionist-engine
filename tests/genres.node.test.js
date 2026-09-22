// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE'S GENRE LIST IS THE DEV'S (ADR-0156; optional per ADR-0153; issue #149).
//
// 📌 The list is the Dev's transcription of the Wikipedia list of video game genres: families and their genres (§1). A
// cartridge MAY declare one; nobody assigns it (§5). Casino game is refused (§2). Horror game is accepted and carries its
// «avoid» mark (§3). The by-purpose genres and sandbox / open world are not declarable (§4).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { GENRES, genreProblems, genreWarning } from '../app/js/core/genres.js';

const nomes = GENRES.map((g) => g.nome);

describe('the genre list (ADR-0156)', () => {
  it('🔴 [Right] it is exactly §1: the ten families and their genres, in the Dev\'s order', () => {
    const familias = [...new Set(GENRES.map((g) => g.familia))];
    expect(familias).toEqual(['Action', 'Action-adventure', 'Adventure', 'Puzzle', 'Role-playing', 'Simulation', 'Strategy', 'Sports', 'MMO', 'Other notable genres']);
    for (const n of ['Platform games', 'Hero shooters', 'Metroidvania', 'Visual novels', 'Puzzle-platform game', 'Monster-taming',
      'Vehicle simulation', 'Auto chess', 'Grand strategy wargame', 'Racing', 'MMO', 'Typing game', 'Trivia game', 'Casino game', 'Horror game']) {
      expect(nomes, `${n} is missing from the list`).toContain(n);
    }
    expect(new Set(nomes).size, 'a genre is listed twice').toBe(nomes.length);
  });

  it('🔴 [Zero] nothing from §4 is in the list', () => {
    for (const n of ['Advergame', 'Art game', 'Casual game', 'Christian game', 'Educational game', 'Esports', 'Exergame',
      'Personalized game', 'Serious game', 'Live Interactive Game', 'Sandbox', 'Creative', 'Open world']) {
      expect(nomes, `${n} is declarable, and §4 keeps it out`).not.toContain(n);
    }
  });

  it('🎯 [Zero] no genre declared is conformant — the genre is optional (ADR-0153)', () => {
    expect(genreProblems(undefined)).toEqual([]);
    expect(genreWarning(undefined)).toBeNull();
  });

  it('🔴 [Right] Casino game is refused, with the reason', () => {
    expect(genreProblems('Casino game').join(' ')).toMatch(/Casino game.*prohibited.*ADR-0156/);
  });

  it('🔴 [Right] Horror game is accepted and carries its «avoid» mark', () => {
    expect(genreProblems('Horror game')).toEqual([]);
    expect(GENRES.find((g) => g.nome === 'Horror game').marca).toBe('avoid');
    expect(genreWarning('Horror game')).toMatch(/Horror game.*avoid.*children.*ADR-0156/);
    expect(genreWarning('Platform games'), 'a genre without a mark reports nothing').toBeNull();
  });

  it('🔴 [Boundary] an unknown genre, or one from §4, is refused as not in the list', () => {
    expect(genreProblems('Educational game').join(' ')).toMatch(/Educational game.*not in the engine's genre list/);
    expect(genreProblems('Plataforma').join(' ')).toMatch(/not in the engine's genre list/);
    expect(genreProblems(7).join(' ')).toMatch(/must be a genre name/);
    expect(genreProblems('Platform games')).toEqual([]);
    expect(genreProblems('Action'), 'a family is not a genre a cartridge declares').not.toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   G1 Casino game accepted                                🔴 refused
//   G2 Horror game without its mark                        🔴 avoid mark
//   G3 an unknown genre accepted                           🔴 [Boundary]
//   G4 «Educational game» added to the list                🔴 §4, [Boundary]
//   G5 a genre missing from the list (Typing game)         🔴 exactly §1
// (with `boot-create-game.node`'s genre case)
//   G6 `mount` does not refuse the genre                   🔴 the boot case
//   G7 no «avoid» line in `problems`                       🔴 the boot case
