// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ROWS FOLLOW THE CARTRIDGE'S ANSWER (ADR-0153) — the first two readers of `acomodacoes`.
//
// 🔴 Before this, the cane row in the hearing panel and the «Character» section of the visual sensitivity panel
// mounted in EVERY game: a board game offered a cane spacing and three switches for a character it does not have.
// The switch worked and meant nothing — the second dead button ADR-0145 names.
//
// 📌 ONE root, and the cartridge is swapped with `mount()` — which is also what proves the rows are re-read per
// cartridge and not frozen at boot (ADR-0142).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO, comAssunto } from './fixtures/respostas-de-acomodacao.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' }), holdsAtOnce: () => 1,
  seguraTeclas: () => false, tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal', nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const COM_PERSONAGEM_E_BENGALA = comAssunto({
  reducedCharacterMotion: { label: 'Character motion' }, caneSpacing: { label: 'Cane taps' },
});

const linhaDaBengala = () => document.querySelector('#cane-div')?.closest('.ctrl-row');
function abrirSensibilidade() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, baixarPesados: false });
});

describe('the rows follow the cartridge\'s answer', () => {
  it('🔴 [Zero] a game that says «no cane» does not offer the cane row', () => {
    expect(linhaDaBengala(), 'the hearing panel did not build its interior — the case would measure nothing').toBeTruthy();
    expect(linhaDaBengala().hidden, 'a cane spacing offered to a game with nobody walking').toBe(true);
  });

  it('🔴 [Zero] and it does not offer the «Character» section', () => {
    abrirSensibilidade();
    const lista = document.querySelector('#motion-list');
    expect(lista.querySelectorAll('button').length, 'the panel opened empty — the case would measure nothing').toBeGreaterThan(0);
    expect(lista.querySelector('[data-rmc]'), 'character switches for a game with no character').toBeNull();
    fecharTudo();
  });

  it('🎯 [Right] a cartridge mounted AFTER, that says «yes», gets both — read per cartridge, not frozen at boot', () => {
    motor.mount(declaracao(), { acomodacoes: COM_PERSONAGEM_E_BENGALA });
    abrirSensibilidade();
    expect(document.querySelectorAll('#motion-list [data-rmc]').length, 'the character section did not come back').toBe(3);
    fecharTudo();
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(linhaDaBengala().hidden, 'the cane row stayed hidden for a game that has a walker').toBe(false);
    fecharTudo();
  });

  it('🔴 [Right] and swapping back to «no» hides them again — no leak from the previous cartridge (ADR-0142)', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO });
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(linhaDaBengala().hidden, 'the previous cartridge\'s cane leaked into this one').toBe(true);
    fecharTudo();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C1 the cane row is never hidden                              🔴 «no cane» still offers it
//   C2 comPersonagem always true                                 🔴 character switches in a game with none
//   C3 the cane decision is read once at boot, not per render    🔴 the mounted «yes» cartridge stays without it
