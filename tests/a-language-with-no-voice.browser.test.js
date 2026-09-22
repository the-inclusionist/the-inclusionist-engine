// SPDX-License-Identifier: AGPL-3.0-or-later
// A LANGUAGE NO VOICE SPEAKS, MOUNTED (ADR-0185 §4; issue #180): in a real `createGame`, the four speech rows of the hearing
// panel and the narration button of the quick bar are locked with the reason, never hidden.
//
// 📌 The engine's three languages all have a voice, and in the browser project `core/i18n` is loaded by the setup before any`n// `vi.mock` could replace it. So the engine's own `tts` object — the one the root and the panel both ask — is told it has no`n// voice for the language, before the pause opens. The narration's side of the lock is in `fala-sem-voz.node`.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';


let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
  motor.tts.vozes = () => [];
  motor.tts.vozAtual = () => null;
});

describe('a language no voice speaks', () => {
  it('🔴 [Right] the four speech rows are locked with the reason, and still shown', () => {
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    for (const id of ['#opt-tts', '#tts-vol', '#opt-menuindex', '#tts-voz']) {
      const el = document.querySelector('#audio ' + id);
      expect(el, id + ' missing').not.toBeNull();
      expect(el.getAttribute('aria-disabled'), id + ' not locked').toBe('true');
      expect(el.dataset.motivo ?? '', id + ' without its reason').not.toBe('');
      expect(el.closest('[hidden]'), id + ' hidden instead of locked').toBeNull();
    }
  });

  it('🔴 [Right] the quick bar\'s narration button is locked, and pressing it says why', async () => {
    const botao = document.querySelector('#title-icons .pi-btn[data-pi="tts"]');
    expect(botao, 'no narration button on the bar').not.toBeNull();
    expect(botao.getAttribute('aria-disabled'), 'the bar\'s button is not locked').toBe('true');
    botao.click();
    await esperar();
    const dito = document.getElementById('sr-alert').textContent + document.getElementById('sr-status').textContent;
    expect(dito, 'refused in silence').toMatch(/Não há voz/);
  });
});
