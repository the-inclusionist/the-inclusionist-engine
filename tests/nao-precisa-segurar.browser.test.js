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

const CHAVES = ['incl_togglemove_p0', 'incl_togglemove_p0_teclado', 'incl_togglemove_p0_olhos', 'incl_input_cooldown'];
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
  /*
   * 🔴 A LINHA SAIU DESTE PAINEL (o Dev, 2026-09-21: «Tire a linha de acessibilidade motora»), no mesmo dia em que entrou, e o
   * que este caso mede é a AUSÊNCIA — porque uma linha removida que volta por acidente é exactamente o tipo de regresso que
   * ninguém nota. O ajuste existe, com as três posições, no ☝️ da barra rápida: é essa a superfície que ele desenhou.
   */
  it('🎯 [Zero] o «jeito de apertar» NÃO é uma linha do painel motora — ele mora no ☝️ da barra', async () => {
    const botao = await abrirMotora();
    expect(botao, 'a linha voltou ao painel: o ajuste passou a ter duas superfícies outra vez').toBeNull();
    // e o par, senão «ausente» passaria por um painel que não abriu: a linha vizinha (ADR-0217) continua lá
    expect(document.querySelector('#motora #opt-cooldown'), 'o painel motora não abriu — o caso acima não mediria nada').not.toBeNull();
    fechar();
  });

  /**
   * 🔴 «ESPERAR ENTRE TOQUES» (ADR-0217): a linha que FICA — é outro ajuste, e ninguém a tirou. Ela é para a mão que não
   * consegue apertar UMA vez, e sai de fábrica desligada, porque para quem não treme seria meio segundo perdido entre duas
   * presses — and what it refuses is measured in `input-cooldown.node`; here it is that she can find it and that it is kept.
   */
  it('🔴 [Right] «Esperar entre toques» is offered, off, and the choice survives to the next day', async () => {
    const state = await import('../app/js/core/state.js'); // a module of bindings, not a default export
    await abrirMotora();
    const botao = document.querySelector('#motora #opt-cooldown');
    expect(botao, 'the cool-down the catalogue promised since the catalogue was written').not.toBeNull();
    expect(botao.closest('.ctrl-row').querySelector('strong').textContent).toBe(pt['motor.espera']);
    expect(botao.getAttribute('aria-pressed'), 'it does not leave the factory off').toBe('false');
    botao.click();
    expect(botao.getAttribute('aria-pressed')).toBe('true');
    expect(state.inputCooldown, 'the rule reads milliseconds, and the row wrote something else').toBe(500);
    expect(localStorage.getItem('incl_input_cooldown'), 'the choice was not kept for the next day').toBe('500');
    botao.click();
    expect(state.inputCooldown, 'turning it off left a wait behind').toBe(0);
    fechar();
  });

  /**
   * 🔴 AND THE ROOT APPLIES IT, which the row alone cannot show: a setting that is stored, announced and read by nobody is the
   * whole class of defect this repository keeps finding. Two presses a few milliseconds apart, as a hand that bounces sends
   * them — the first reaches the game and the second does not.
   */
  it('🔴 [Right] with it on, the second press of a bouncing hand never reaches the game', async () => {
    const state = await import('../app/js/core/state.js');
    const regiao = document.getElementById('game-region');
    const ouvidas = [];
    const escuta = (e) => ouvidas.push(e.code);
    regiao.addEventListener('keydown', escuta);
    const bater = (code) => regiao.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    try {
      state.setInputCooldownValue(0);
      bater('KeyW'); bater('KeyW');
      expect(ouvidas, 'with the setting off, both presses must reach the game').toEqual(['KeyW', 'KeyW']);
      ouvidas.length = 0;
      state.setInputCooldownValue(500);
      bater('KeyW'); bater('KeyW'); bater('KeyS');
      expect(ouvidas, 'the bounce and the key after it reached the game').toEqual(['KeyW']);
    } finally {
      regiao.removeEventListener('keydown', escuta);
      state.setInputCooldownValue(0);
    }
  });

  /**
   * 🔴 THE CAMERA ROW (issue #182; ADR-0215): «webcam (gestos/rosto/olhos)» was on the Dev's list of missing motor rows, and
   * until the 📷 existed there was nothing to put in it. It is the SAME stored value the bar cycles — the panel's job is to say
   * what each position does, which a bar of icons cannot.
   *
   * 📌 The microphone row of that same list is deliberately absent: the engine has no voice-command transport yet (issue #184),
   * so it would switch nothing. The bar already says «em construção» with 👄, and a second surface saying it would be a second
   * promise. This case holds that absence, so it stays a decision and not an oversight.
   */
  it('🔴 [Right] the camera is offered in the panel, as the SAME setting the 📷 cycles', async () => {
    const state = await import('../app/js/core/state.js');
    await abrirMotora();
    const passos = document.querySelector('#motora #opt-camera');
    expect(passos, 'the camera row the Dev listed in #182').not.toBeNull();
    // ⚠️ and VISIBLE: this browser has a camera to ask for, so a hidden row here would be the case measuring nothing
    expect(passos.closest('.ctrl-row').hidden).toBe(false);
    expect(passos.getAttribute('aria-valuetext')).toBe(pt['state.off']);
    // what the bar writes, this row shows: one value, two surfaces
    state.setCameraControlValue('face');
    expect(passos.getAttribute('aria-valuetext'), 'the bar changed it and the panel went on showing the old one')
      .toBe(pt['camera.face']);
    state.setCameraControlValue('off');
    expect(document.querySelector('#motora #opt-microphone'), 'a row that would switch nothing (issue #184)').toBeNull();
    fechar();
  });

  /**
   * ⚠️ AND HIDDEN WHERE THERE IS NO CAMERA TO ASK FOR (ADR-0106 §5) — which THIS browser cannot show, because it has one: a
   * mutation that made the row always visible survived every case above. So the rule is measured on a second engine, booted
   * into a document of its own with a `navigator` that offers no `getUserMedia`, which is the school Chromebook with the
   * camera disabled by the administrator.
   */
  it('🔴 [Zero] on a device with no camera the row is not offered at all', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const outro = document.implementation.createHTMLDocument('sem camera');
    outro.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
      + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
    // ⚠️ A METHOD READ THROUGH A PROXY IS CALLED ON THE PROXY, and `addEventListener` answers «Illegal invocation» to anything
    // that is not the real window. Functions come back bound to it; everything else is the window's own.
    const semCamera = new Proxy(window, {
      get: (alvo, chave) => {
        if (chave === 'navigator') {
          return { language: navigator.language, languages: navigator.languages, userAgent: navigator.userAgent };
        }
        const valor = Reflect.get(alvo, chave);
        return typeof valor === 'function' ? valor.bind(alvo) : valor;
      },
    });
    const segundo = createGame({
      acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: outro, win: semCamera },
      baixarPesados: false, controleNaTela: true, players: [{ ctrl: 0 }], preset: PRESET,
    });
    try {
      const passos = outro.querySelector('#motora #opt-camera');
      expect(passos, 'the row must be BUILT even here — hidden, so the panel does not change shape between devices').not.toBeNull();
      expect(passos.closest('.ctrl-row').hidden, 'a device with no camera was offered playing with one').toBe(true);
    } finally {
      segundo.unmount?.();
    }
  });

  // ⚠️ O CASO DA TRAVA DO APARELHO SAIU COM A LINHA (2026-09-21). Ele media que, nos olhos, no rosto, nos gestos e na fala, a
  // linha ficava VISÍVEL e trancada com o motivo (ADR-0113 cláusula 3). Sem linha não há o que trancar: o ☝️ simplesmente não
  // oferece o «padrão» nesses aparelhos, e essa regra é medida em `pause-icons.node`, onde o ciclo vive.
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-nao-precisa-segurar.py`:
//   · the row built but never appended             → «it is offered, by the name the child reads»
//   · the row's name taken from the mechanism      → same (and the bar-and-panel agreement)
//   · the row shown where nothing is held          → `controle-virtual-no-arranque`, «built and HIDDEN»
//   · the click writing the seat and not the key   → «writes the SAME setting the bar's ☝️ writes»
//   · the lock dropped on one-command devices      → «it is locked, and the reason is there to read»
//   · the lock without its reason                  → same
//   · the camera row built and never appended      → «the camera is offered in the panel»
//   · the camera row shown where there is no camera → «on a device with no camera the row is not offered at all»
//   · the row no longer following what the bar writes → «as the SAME setting the 📷 cycles»
//   · the row writing one mode and showing another  → same
//   · a microphone row that switches nothing        → «a row that would switch nothing (issue #184)»
