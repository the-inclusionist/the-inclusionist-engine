// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VOICE CHOICE, MOUNTED (ADR-0185; issue #180): the hearing panel of a real `createGame` lists the voices of the page's
// language, and the choice reaches the narration. The voices are Kokoro's, on a browser that offers none of its own — where it
// offers one, it is listed first (ADR-0200). The game declares `uses: { neuralVoice: true }` and nothing else (ADR-0216 §3); what
// stands in for the delivery here is the engine's own loader, replaced by `vi.mock` — there is no wasm engine in this case.
//
// MUTATIONS CHECKED — at the end of the file (shared with `escolha-da-voz.node` and the panel cases in `settings-audio.browser`).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

vi.mock('../app/js/platform/kokoro-runtime.js', () => ({
  loadKokoroRuntime: async () => ({
    fonemizar: async () => 'a', vocabulario: async () => ({ a: 1 }), voz: async () => new Float32Array(256),
    sessao: async () => { throw new Error('no session in this case'); },
  }),
}));

let motor;
let antes;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

const getVoicesOriginal = window.speechSynthesis.getVoices;

beforeAll(async () => {
  window.speechSynthesis.getVoices = () => [];
  antes = localStorage.getItem('incl_tts_voz');
  localStorage.removeItem('incl_tts_voz');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }],
    uses: { neuralVoice: true } });
});
afterAll(() => {
  window.speechSynthesis.getVoices = getVoicesOriginal;
  if (antes === null) localStorage.removeItem('incl_tts_voz'); else localStorage.setItem('incl_tts_voz', antes);
});

describe('the voice choice in the hearing panel', () => {
  it('🔴 [Right] the «Voz» row is in the hearing panel, a list with the Portuguese voices only', () => {
    const sel = document.querySelector('#audio #tts-voz');
    expect(sel, 'no «Voz» row in the hearing panel').not.toBeNull();
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(sel.tagName).toBe('SELECT');
    expect([...sel.options].map((o) => o.value)).toEqual(['pf_dora', 'pm_alex', 'pm_santa']);
  });

  it('🎯 [Zero] Portuguese has a voice: neither the speech rows nor the bar\'s narration button are locked', () => {
    for (const id of ['#opt-tts', '#tts-vol', '#opt-menuindex', '#tts-voz']) {
      expect(document.querySelector(id)?.getAttribute('aria-disabled'), id).toBeNull();
    }
    const botao = document.querySelector('#title-icons .pi-btn[data-pi="tts"]');
    if (botao) expect(botao.getAttribute('aria-disabled')).toBeNull();
  });

  it('🔴 [Right] the choice is the narration\'s: picking it stores it and says it', async () => {
    const sel = document.querySelector('#audio #tts-voz');
    sel.value = 'pm_alex'; // the second: a <select> opens on its first option by itself (mutation P7)
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(motor.tts.vozAtual()?.voice).toBe('pm_alex');
    expect(localStorage.getItem('incl_tts_voz')).toBe('pm_alex');
    // the live region is written after a beat (a repeated phrase must be re-announced), so wait for it rather than a tick count
    const dito = () => document.getElementById('sr-status').textContent;
    for (let i = 0; i < 40 && !/Alex/.test(dito()); i++) await new Promise((r) => setTimeout(r, 25));
    expect(dito(), 'the choice was silent').toMatch(/Alex/);
  });
});
