// SPDX-License-Identifier: AGPL-3.0-or-later
// `createGame`'s `problems` names a cartridge key missing in one of the three languages (study item E4, contract part).
// The rule itself is gated in `dicionario-do-cartucho-nas-tres-linguas.node`; this file gates the WIRING, read when read.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

describe('a cartridge dictionary under createGame', () => {
  it('🔴 [Right] a key missing in es is a line of `problems` — and completing es takes it away', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    document.body.innerHTML = '<p id="sr-status"></p><div id="game-region" tabindex="-1"></div>';
    // the game's dictionaries go through its root (ADR-0232 D3): `core/i18n` has no page-wide dictionary any more
    const motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
      dictionaries: { pt: { 'jogo.fixture.vitoria': 'Vitória' }, en: { 'jogo.fixture.vitoria': 'Victory' } } });
    const linhas = () => motor.problems.filter((p) => p.includes('jogo.fixture.vitoria'));
    expect(linhas(), 'the missing es was not said').toHaveLength(1);
    expect(linhas()[0]).toMatch(/lacks es/);
    // after boot: a cartridge `mount()` swaps in brings es, ADDED to the root's dictionary — `problems` is read when it is read
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, dictionaries: { es: { 'jogo.fixture.vitoria': 'Victoria' } } });
    expect(linhas(), 'the line outlived the fix').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   M1 `problems` does not read the dictionaries   🔴
