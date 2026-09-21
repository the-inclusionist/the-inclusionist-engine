// SPDX-License-Identifier: AGPL-3.0-or-later
// A GAME THAT DECLARES NO PLAYERS STILL HAS ONE CHILD — and the quick bar's cycles move (issue #147).
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 MEASURED on 2026-09-12: the bar read `cartucho.players ?? []` while the keyboard read one seat. With the
// list EMPTY, the 🚥 cycle reread the default state on every press and stayed on its first position while the
// icon announced different corrections. Since ADR-0151 that also left the PERSISTED safe palette switched on for
// anyone who pressed once. Measured in the dist: six presses, never back to trichromatic vision.
//
// 📌 One root, no `players`, and the ENGINE's correction writer (it needs `host.cvdHost`) — the path the quiz
// consumer takes.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

let state;
const paleta = () => document.documentElement.dataset.paleta;
const icone = () => document.querySelector('#title-icons [data-pi="cvd"]');

beforeAll(async () => {
  state = await import('../app/js/core/state.js');
  state.setCbSafeValue(false);
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>'
    + '<svg id="cvd-host" width="0" height="0" aria-hidden="true"></svg>';
  document.body.appendChild(raiz);
  createGame({ acomodacoes: SEM_ASSUNTO,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['a'] }), holdsAtOnce: () => 1, seguraTeclas: () => false,
      tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
      objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
    },
    host: { doc: document, win: window, cvdHost: document.getElementById('cvd-host') },
    downloadHeavy: false,
  });
});

describe('the quick bar with no declared players', () => {
  it('🔴 [Right] the 🚥 cycle MOVES: pressing it goes through the corrections and comes back to default vision', () => {
    expect(icone(), 'the colour icon did not mount — the case would measure nothing').not.toBeNull();
    icone().click();
    expect(paleta(), 'the first press did not turn a correction on').toBe('okabe-ito');
    let voltas = 0;
    while (paleta() && voltas < 6) { icone().click(); voltas += 1; }
    // Three corrections and back: the cycle has four positions, so it must come home in three more presses.
    expect(paleta(), `stuck: ${voltas} more presses and still not back to trichromatic vision`).toBeUndefined();
    expect(voltas, 'the cycle came back, but not after the three corrections').toBe(3);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   P1 the bar reads `cartucho.players ?? []` again                      🔴 stuck on the first correction
//   P2 the engine writer stores in `cartucho.players?.[i]` again         🔴 stuck (nowhere to store)
