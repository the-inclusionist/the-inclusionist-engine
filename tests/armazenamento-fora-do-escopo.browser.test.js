// SPDX-License-Identifier: AGPL-3.0-or-later
// A KEY STORED OUTSIDE THE ENGINE'S SCOPES DURING THE PAGE'S LIFE IS SAID IN `problems` (study item E2; ADR-0080, ADR-0027).
//
// 📏 Measured on 2026-09-13 across the six sibling games: the platformer, soccer and whack-whack store under the engine's
// two scopes (`incl_*` for what belongs to the child, `incl.<game>.*` for what belongs to the game — `storage.gameKey`);
// 2048 stores nothing; pinball stores `pinball:highscore:*`, `pinball:keymap`, `pinball:palette`, `pinball:vision` — outside
// both — and chess keeps its game in `incl_chess_*`, the CHILD's shared scope.
//
// 📌 WHAT THIS CAN SEE, AND WHAT IT CANNOT. A key outside every engine prefix (`incl_`, `inclusionist.`, `incl.`) is seen.
// Chess's case is NOT: the engine's own shared keys are not one closed list (`incl_audiocat_<k>`, `incl_padmap_<i>`,
// `incl_sink_p<i>`, keys built in `ui/settings-motion`), so «an `incl_` key the engine does not own» would accuse the engine.
// And only keys that APPEAR during the page's life: on a shared origin (localhost) other projects' keys are not this game's.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'alvo', gender: 'm', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const CRIADAS = ['fixture-outro-projeto', 'fixture:keymap', 'incl.fixture.nivel', 'incl_fixture_ok', 'fixture:sessao'];
let motor;
const linhas = () => motor.problems.filter((p) => /outside the engine's scopes/.test(p));

beforeAll(async () => {
  localStorage.setItem('fixture-outro-projeto', '1'); // there before boot: another project on the same origin
  document.body.innerHTML = '<p id="sr-status"></p><div id="game-region" tabindex="-1"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
});
afterAll(() => { for (const k of CRIADAS) { localStorage.removeItem(k); sessionStorage.removeItem(k); } });

describe('storage outside the engine\'s scopes', () => {
  it('🎯 [Zero] nothing stored yet: no line — and a key that was there before boot is not this game\'s', () => {
    expect(linhas()).toEqual([]);
  });

  it('🔴 [Right] a key written after boot outside every scope is named; one in the game or child scope is not', () => {
    localStorage.setItem('fixture:keymap', '{}');
    localStorage.setItem('incl.fixture.nivel', '3');
    localStorage.setItem('incl_fixture_ok', '1');
    expect(linhas(), 'no line, or more than one').toHaveLength(1);
    expect(linhas()[0]).toContain('fixture:keymap');
    expect(linhas()[0]).toMatch(/gameKey/);
    for (const k of ['incl.fixture.nivel', 'incl_fixture_ok', 'fixture-outro-projeto']) expect(linhas()[0], k).not.toContain(k);
  });

  it('🔴 [Right] sessionStorage counts too', () => {
    sessionStorage.setItem('fixture:sessao', '1');
    expect(linhas()[0]).toContain('fixture:sessao');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   A1 every key of the origin, not only the new ones   🔴 [Zero] + [Right]
//   A2 `incl.<game>.*` not a scope                      🔴 [Right]
//   A3 `incl_*` not a scope                             🔴 [Right]
//   A4 sessionStorage not read                          🔴 sessionStorage
//   A5 `problems` does not read it                      🔴 two
