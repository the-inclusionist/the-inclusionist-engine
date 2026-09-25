// SPDX-License-Identifier: AGPL-3.0-or-later
// «NÃO PRECISA SEGURAR», OFFERED WHERE A CHILD LOOKS FOR AN OPTION (ADR-0211; the Dev, 2026-09-21: «a aderência existe e falta
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
//     mounts: `ui/settings-mobility` builds an `#opt-altmove` too, so the id alone proved nothing. The engine's row has its own id.
//   · A case that says «if the device did not change, return» measures nothing and tells nobody. The lock case asserts the
//     transport FIRST, and that is what showed that enabling an assisted transport is an explicit act (ADR-0109 rule 4).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import pt from '../app/js/i18n/pt.js';

let motor;
let raiz;
const assentos = [{ ctrl: 0 }];
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => true, tick: 'player',
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
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, onScreenPad: true, players: assentos, preset: PRESET,
  });
});
afterAll(async () => {
  const { disableAssistedFor } = await import('../app/js/input/state.js');
  disableAssistedFor(0);
  for (const k of CHAVES) { if (guardadas[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, guardadas[k]); }
  motor?.unmount?.();
  raiz?.remove();
});

/** Opens the engine's motor panel and answers with ITS sticky row. The opening is not synchronous with the click. */
const abrirMotora = async () => {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]');
  expect(item?.hidden, 'the engine does not action «Acessibilidade motora»').toBe(false);
  item.click();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return document.querySelector('#motora #opt-sticky');
};
const fechar = () => {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
};

describe('the sticky-keys row a child can read', () => {
  /*
   * 🔴 THE ROW IS NOT IN THIS PANEL (the Dev, 2026-09-21: «Tire a linha de acessibilidade motora»), and what this case measures
   * is the ABSENCE — because a removed row that comes back by accident is exactly the kind of regression nobody notices. The
   * setting exists, with its three positions, on the quick bar's ☝️: that is the surface the Dev designed.
   */
  it('🎯 [Zero] o «jeito de apertar» NÃO é uma linha do painel motora — ele mora no ☝️ da barra', async () => {
    const botao = await abrirMotora();
    expect(botao, 'a linha voltou ao painel: o ajuste passou a ter duas superfícies outra vez').toBeNull();
    // and the pair, or «ausente» would pass for a panel that never opened: the neighbouring row (ADR-0217) is still there
    expect(document.querySelector('#motora #opt-cooldown'), 'o painel motora não abriu — o caso acima não mediria nada').not.toBeNull();
    fechar();
  });

  /**
   * 🔴 «ESPERAR ENTRE TOQUES» (ADR-0217): the row that STAYS — it is another setting. It is for the hand that cannot press ONCE,
   * and it ships off, because for someone without a tremor it would be half a second lost between two presses — and what it
   * refuses is measured in `input-cooldown.node`; here it is that she can find it and that it is kept.
   */
  it('🔴 [Right] «Esperar entre toques» is offered, off, and the choice survives to the next day', async () => {
    const state = motor.settings; // the ROOT's settings store: the one its panel and bar write (ADR-0232 D4)
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
    const state = motor.settings; // the ROOT's settings store: the one its panel and bar write (ADR-0232 D4)
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
   * 📌 The microphone row of that same list was deliberately absent until 2026-09-21, because with no voice-command transport it
   * would switch nothing; the transport landed (issue #184) and the row is measured just below.
   */
  it('🔴 [Right] the camera is offered in the panel, as the SAME setting the 📷 cycles', async () => {
    const state = motor.settings; // the ROOT's settings store: the one its panel and bar write (ADR-0232 D4)
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
    fechar();
  });

  /**
   * 🔴 THE MICROPHONE ROW (the last of issue #182's motor list; ADR-0189): the same stored answer the bar's 👄 writes, on the
   * surface that has room to say what it does — including the sentence that matters most to a family, which is that the
   * microphone stays on the device.
   *
   * ⚠️ AND THE TWO SURFACES FOLLOW EACH OTHER IN BOTH DIRECTIONS. It is the correction ADR-0218 had just made to the ☝️: one
   * setting with two surfaces cannot have them naming — or showing — different things. Here the panel is checked against a
   * change made from OUTSIDE it, which is exactly what `ui/voice-control` does when nothing can start.
   */
  it('🔴 [Right] the microphone is offered in the panel, as the SAME setting the 👄 switches', async () => {
    const state = motor.settings; // the ROOT's settings store: the one its panel and bar write (ADR-0232 D4)
    await abrirMotora();
    try {
      const botao = document.querySelector('#motora #opt-voice');
      expect(botao, 'the microphone row the Dev listed in #182').not.toBeNull();
      // ⚠️ and VISIBLE: this browser has a microphone to ask for, so a hidden row here would be the case measuring nothing
      expect(botao.closest('.ctrl-row').hidden).toBe(false);
      // ⚠️ THROUGH THE SAME FUNCTION THE ENGINE USES (`toggleLabel`), not the raw dictionary: the switch's label is capitalised,
      // and comparing with the raw key would measure the capitalisation instead of the state.
      const { toggleLabel } = await import('../app/js/ui/dom.js');
      expect(botao.textContent, 'a linha nasceu a dizer o contrário do valor guardado').toBe(toggleLabel(translate, false));
      // ⚠️ THE EXPLANATION DOES NOT LIVE ON THE ROW, it lives in the panel's FOOTER and only shows when the row is reached — the
      // menu rule of `CLAUDE.md` §4. So the case REACHES it: what it holds is that the sentence exists and tells the family the
      // one thing that decides whether the microphone is turned on — that what the child says does not leave the device.
      botao.closest('.ctrl-row').dispatchEvent(new Event('focusin', { bubbles: true }));
      expect(document.querySelector('#motora .opt-explain')?.textContent,
        'alcançar a linha não disse à família que o microfone fica no aparelho').toContain('fica no aparelho');
      state.setVoiceControlValue(true);
      expect(botao.textContent, 'o 👄 mudou e o painel continuou a mostrar o valor antigo').toBe(toggleLabel(translate, true));
      state.setVoiceControlValue(false);
      expect(botao.textContent).toBe(toggleLabel(translate, false));
      // 🔴 AND THE OTHER DIRECTION, where a mutation survived: the click writes THE SAME key the 👄 writes, not a second one of
      // its own. Without this half, the row could turn on the scan and the case above stayed green.
      botao.click();
      expect(state.voiceControl, 'o clique na linha não escreveu a resposta da criança').toBe(true);
      expect(localStorage.getItem('incl_voice_control'), 'a escolha não foi guardada para o dia seguinte').toBe('1');
      expect(state.switchScan, 'a linha da voz mexeu num ajuste que não é o dela').toBe(false);
    } finally {
      state.setVoiceControlValue(false);
      fechar();
    }
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
      accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: outro, win: semCamera },
      downloadHeavy: false, onScreenPad: true, players: [{ ctrl: 0 }], preset: PRESET,
    });
    try {
      const passos = outro.querySelector('#motora #opt-camera');
      expect(passos, 'the row must be BUILT even here — hidden, so the panel does not change shape between devices').not.toBeNull();
      expect(passos.closest('.ctrl-row').hidden, 'a device with no camera was offered playing with one').toBe(true);
      // 📌 AND THE SAME DOOR ANSWERS FOR BOTH: `getUserMedia` is what is asked of the camera AND the microphone, so a device
      // without it is offered neither. Without this line, a mutation that always showed the voice row would pass.
      const voz = outro.querySelector('#motora #opt-voice');
      expect(voz, 'a linha da voz não é construída neste aparelho').not.toBeNull();
      expect(voz.closest('.ctrl-row').hidden, 'um aparelho sem microfone foi convidado a jogar falando').toBe(true);
    } finally {
      segundo.unmount?.();
    }
  });

  // ⚠️ NO DEVICE-LOCK CASE HERE: without the row there is nothing to lock (ADR-0113 clause 3). With eyes, face, gestures and
  // speech the ☝️ simply does not offer «padrão», and that rule is measured in `pause-icons.node`, where the cycle lives.
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
