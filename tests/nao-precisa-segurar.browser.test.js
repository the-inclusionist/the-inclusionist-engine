// SPDX-License-Identifier: AGPL-3.0-or-later
// «NÃO PRECISA SEGURAR», OFERECIDO ONDE UMA CRIANÇA PROCURA UMA OPÇÃO (ADR-0211; the Dev, 2026-09-21: «a aderência existe e falta
// oferecê-la como opção para teclado e toque, com nome que a criança entenda»).
//
// The setting is old — a tap holds the button down instead of a hand that cannot (`input/latch`) — and until today the only
// surface that offered it was the quick bar's ☝️, which can say on or off and nothing else. What is measured here is the row in
// the motor panel the ENGINE mounts: that it is the SAME setting (not a second one that disagrees), and that it is locked WITH
// THE REASON on a device that can only ever send one command at a time.
//
// ⚠️ TWO THINGS THIS FILE LEARNED BY BEING WRONG FIRST, and both are why it looks like this:
//   · The engine's motor panel exists only where the game has a PAD (`controleNaTela`) — without one there is no size to choose
//     and the panel is not mounted. A first version measured, for three green cases, the row of the LEGACY panel a cartridge
//     mounts: `ui/settings-motor` builds an `#opt-altmove` too, so the id alone proved nothing. The engine's row has its own id.
//   · A case that says «if the device did not change, return» measures nothing and tells nobody. The lock case asserts the
//     transport FIRST, and that is what showed that enabling an assisted transport is an explicit act (ADR-0109 rule 4).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';
import pt from '../app/js/i18n/pt.js';

let motor;
let raiz;
const assentos = [{ ctrl: 0 }];
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const PRESET = { up: { label: 'Cima' }, down: { label: 'Baixo' }, action2: { label: 'Pular' } };

const CHAVES = ['incl_togglemove_p0', 'incl_togglemove_p0_teclado', 'incl_togglemove_p0_olhos'];
const guardadas = {};

beforeAll(async () => {
  for (const k of CHAVES) { guardadas[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    baixarPesados: false, controleNaTela: true, players: assentos, preset: PRESET,
  });
});
afterAll(async () => {
  const { desabilitarAssistidaDe } = await import('../app/js/input/state.js');
  desabilitarAssistidaDe(0);
  for (const k of CHAVES) { if (guardadas[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, guardadas[k]); }
  motor?.unmount?.();
  raiz?.remove();
});

/** Opens the engine's motor panel and answers with ITS sticky row. The opening is not synchronous with the click. */
const abrirMotora = async () => {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]');
  expect(item?.hidden, 'the engine does not action «Acessibilidade motora»').toBe(false);
  item.click();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return document.querySelector('#motora #opt-sticky');
};
const fechar = () => {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
};

describe('the sticky-keys row a child can read', () => {
  it('🔴 [Right] it is offered, by the name the child reads — not by the mechanism\'s name', async () => {
    const botao = await abrirMotora();
    expect(botao, 'a game that holds keys was not offered the option').not.toBeNull();
    const linha = botao.closest('.ctrl-row');
    expect(linha.hidden, 'a game that holds keys had the option hidden').toBe(false);
    expect(linha.querySelector('strong').textContent).toBe(pt['motor.altmove']);
    // 🔴 ONE SETTING, ONE NAME. The bar and the panel writing the same value under two names is how a child learns they are two
    // different things — and it was the state of this repository until today («Teclas de alternância» × «Movimento por
    // alternância»), both of them the mechanism's name and neither one hers.
    expect(pt['motor.altmove']).toBe(pt['icon.altmove']);
    expect(pt['motor.altmove'], 'the name is still the mechanism\'s').not.toMatch(/altern/i);
    fechar();
  });

  it('🔴 [Right] pressing it writes the SAME setting the bar\'s ☝️ writes', async () => {
    const botao = await abrirMotora();
    expect(botao.getAttribute('aria-pressed')).toBe('false');
    botao.click();
    expect(botao.getAttribute('aria-pressed'), 'the row did not turn it on').toBe('true');
    // the two halves the bar writes too: the seat the cartridge passed, and the key that survives to tomorrow
    expect(assentos[0].toggleMove, 'the seat the cartridge passed did not receive the choice').toBe(true);
    expect(localStorage.getItem('incl_togglemove_p0'), 'the choice was not kept for the next day').toBe('1');
    botao.click();
    expect(botao.getAttribute('aria-pressed')).toBe('false');
    expect(assentos[0].toggleMove).toBe(false);
    fechar();
  });

  /**
   * ⚠️ ON THE EYES, THE FACE, GESTURES AND SPEECH IT CANNOT BE TURNED OFF (ADR-0104 §C): those devices send one command at a
   * time, so the latch is not a preference — it is the only way the control works. The row stays VISIBLE and locked with the
   * reason, because hiding it would hide why (ADR-0113 clause 3).
   */
  it('🔴 [Right] on a device that sends one command at a time it is locked, and the reason is there to read', async () => {
    const { arestaDoJogador, habilitarAssistidaDe, entradaDe } = await import('../app/js/input/state.js');
    habilitarAssistidaDe(0);
    arestaDoJogador(0, 'olhos');
    expect(entradaDe(0).emUso, 'the eyes did not become the transport in use: the case would measure nothing').toBe('olhos');
    const botao = await abrirMotora();
    expect(botao.getAttribute('aria-disabled'), 'the eyes are in use and the row still offers turning it off').toBe('true');
    expect(botao.getAttribute('aria-pressed'), 'locked OFF would be a control that lies about the device').toBe('true');
    expect(botao.getAttribute('title'), 'locked without a reason is worse than not offering it').toBe(pt['alt.exigida.olhos']);
    fechar();
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-nao-precisa-segurar.py`:
//   · the row built but never appended             → «it is offered, by the name the child reads»
//   · the row's name taken from the mechanism      → same (and the bar-and-panel agreement)
//   · the row shown where nothing is held          → `controle-virtual-no-arranque`, «built and HIDDEN»
//   · the click writing the seat and not the key   → «writes the SAME setting the bar's ☝️ writes»
//   · the lock dropped on one-command devices      → «it is locked, and the reason is there to read»
//   · the lock without its reason                  → same
