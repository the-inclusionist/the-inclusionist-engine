// SPDX-License-Identifier: AGPL-3.0-or-later
// createGame LOADS THE CHILD'S STORED SETTINGS FIRST (ADR-0178, issue #174).
//
// 📌 A setting stored with a value that is NOT the default — captions off, blind mode on — is what tells a root that loads
// from one that does not: a default would pass either way (the letter-case case stores `upper`, which is the default).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import * as store from '../app/js/platform/storage.js';

let createGame;
let state;
let raiz;
const CHAVES = ['incl_captions', 'incl_modocego'];
let guardadas;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

beforeAll(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
  state = await import('../app/js/core/state.js');
});

afterEach(() => {
  raiz?.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  CHAVES.forEach((k, i) => { if (guardadas[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, guardadas[i]); });
  state.loadState(store); // back to the page's storage, as the setup left it
});

describe('the stored settings reach a game through createGame', () => {
  it('🔴 [Right] a setting stored away from its default is what the game reads after createGame', () => {
    guardadas = CHAVES.map((k) => localStorage.getItem(k));
    // stored AFTER the setup loaded the settings: only a load by createGame can bring them in
    localStorage.setItem('incl_captions', '0');
    localStorage.setItem('incl_modocego', '1');
    raiz = document.createElement('div');
    raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p><section id="game-region"></section><div id="title-icons"></div>';
    document.body.appendChild(raiz);
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    expect(state.captionsOn, 'the child turned captions off and the game reads them on').toBe(false);
    expect(state.blindMode, 'the child turned blind mode on and the game reads it off').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R4 createGame without `state.loadState(store)`   🔴 captions off / blind mode on
