// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE BUTTON ONLY: WHATEVER HER DEVICE SENDS TAKES THE ONE SHOWN (ADR-0218 §4, and its erratum of 2026-09-26).
//
// «With one button only on, every key, every touch on the game region and every press a camera or speech transport sends collapses
// into "take the one shown". A child who has one switch has it wired to whatever her device already sends; the engine does not ask
// which.» 📏 Measured before: only KEYS collapsed. A touch on the game region clicked what was under the finger, the on-screen pad
// pressed its own position, and the eyes, the face, the hands, the voice and the gamepad pressed theirs — with the chip saying
// «Cima», a camera's «Confirmar» answered the quiz, and its START opened the pause.
//
// 📌 Two doors, each asked once: the VIRTUAL CONTROLLER asks the scan before any position pressed on it — every transport that reads
// positions presses it — and the root's POINTER listener asks it before any touch on the game region or the pad. The gamepad also
// steers menus by itself, and asks the same question once per frame. What is measured HERE is that the whole chain holds with real
// input: `userEvent` clicks, pointer events, the transports' own modules on the doubles their files use, a fake pad behind
// `navigator.getGamepads`, and the root's own controller.
//
// ⚠️ ONE ROOT for the file: `createGame` hangs listeners on the window, so a second root would answer the same presses.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { detection as gaze } from './fixtures/synthetic-face.js';
import { createEyeControl } from '../app/js/ui/eye-control.js';
import { createVoiceControl } from '../app/js/ui/voice-control.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';
import pt from '../app/js/i18n/pt.js';
import css from '../app/css/style.css?raw';

const translate = createTranslator().t;
const PASSO = SWITCH_SCAN_DEFAULTS.stepMs;
const LIMITE = 20_000;
const PRESET = { up: { label: 'Cima' }, down: { label: 'Baixo' }, action2: { label: 'Confirmar' } };

let motor;
let estado;
let raiz;
let getGamepadsOriginal;
/** What the GAME heard through `onCommand`. */
const ouvidos = [];
/** What the game's own button on the region heard: a click is the button's, and it must not happen while scanning. */
const cliques = [];
/** A standard pad behind `navigator.getGamepads`, seated as player 0's. */
const pad = { id: 'Pad de teste (STANDARD GAMEPAD)', index: 0, mapping: 'standard', connected: true, timestamp: 0,
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

const chip = () => document.querySelector('#game-region .scan-now');
const resposta = () => document.getElementById('resposta');
const icone = (k) => document.querySelector(`#title-icons .pi-btn[data-pi="${k}"]`);
const pausadoAVista = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));
const ouvido = () => ouvidos.filter((c) => c.pressed).map((c) => `${c.action}:${c.source ?? '-'}`);
/** Waits until the chip OFFERS `texto`, frame by frame, and fails naming the last word seen. */
const quandoOferecer = async (texto) => {
  const fim = performance.now() + PASSO * 10;
  while (chip()?.textContent !== texto) {
    if (performance.now() > fim) throw new Error(`the chip never offered «${texto}» (last: «${chip()?.textContent}»)`);
    await quadro();
  }
};
/** A tap on the root's controller from `source`, the way every transport that reads positions presses it. */
const tocar = (action, source) => { motor.controller.press(action, source, 0); motor.controller.release(action, source, 0); };
/** A button of the fake pad going down and up, one frame each: the root polls it on its own frames. */
const botaoDoPad = async (i) => {
  pad.buttons[i].pressed = true; pad.buttons[i].value = 1;
  await quadro(); await quadro();
  pad.buttons[i].pressed = false; pad.buttons[i].value = 0;
  await quadro(); await quadro();
};
/** A finger on `el`: the pointer events a touch screen sends, stamped `touch`, then the click the browser fires after them. */
const toque = (el) => {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, composed: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: r.x + 4, clientY: r.y + 4 };
  el.dispatchEvent(new PointerEvent('pointerdown', at));
  el.dispatchEvent(new PointerEvent('pointerup', at));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: at.clientX, clientY: at.clientY }));
};

beforeAll(async () => {
  localStorage.removeItem('incl_switch_scan');
  getGamepadsOriginal = Object.getOwnPropertyDescriptor(Navigator.prototype, 'getGamepads');
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  const folha = document.createElement('style');
  folha.textContent = css;
  document.head.appendChild(folha);
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div>'
    + '<button id="resposta" type="button" style="position:absolute;left:24px;top:150px;width:140px;height:44px">Quatro</button></div>'
    + '<button id="fora" type="button">outside the game region</button>';
  document.body.appendChild(raiz);
  resposta().addEventListener('click', () => cliques.push('resposta'));
  resposta().addEventListener('pointerdown', () => cliques.push('resposta:pointerdown'));
  resposta().addEventListener('pointerup', () => cliques.push('resposta:pointerup'));
  document.getElementById('fora').addEventListener('click', () => cliques.push('fora'));
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    players: [{ ctrl: 0, pad: 0 }], onScreenPad: true, ...keyed({ preset: PRESET }), onCommand: (c) => ouvidos.push(c),
  });
  estado = motor.settings;
});
afterAll(() => {
  estado.setSwitchScanValue(false);
  localStorage.removeItem('incl_switch_scan');
  motor?.unmount?.();
  raiz?.remove();
  delete navigator.getGamepads;
  if (getGamepadsOriginal) Object.defineProperty(Navigator.prototype, 'getGamepads', getGamepadsOriginal);
});
beforeEach(async () => {
  motor.pause.hide(0);
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  if (pausadoAVista()) { estado.setSwitchScanValue(false); tocar('start', 'olhos'); }
  const tc = document.getElementById('touch-controls');
  if (tc) tc.hidden = true;
  await quadro();
  ouvidos.length = 0;
  cliques.length = 0;
});

/* ===================== WITH THE SCAN OFF, EACH TRANSPORT IS ITSELF — the doubles below work ===================== */
describe('with one-button scanning OFF, every transport presses what it presses', () => {
  beforeEach(() => { estado.setSwitchScanValue(false); });

  it('🔴 [Zero] a click answers with the game\'s button, the eyes press their own position, the pad its own button', async () => {
    await userEvent.click(resposta());
    expect(cliques, 'the game\'s button was not pressed: the case would measure nothing').toEqual(['resposta:pointerdown', 'resposta:pointerup', 'resposta']);
    tocar('down', 'olhos');
    await botaoDoPad(0);
    expect(ouvido(), 'a transport did not press its own position with the scan off').toEqual(['down:olhos', 'action2:gamepad']);
    expect(chip()?.hidden, 'the chip is on screen with the scan off').not.toBe(false);
  });
});

/* ===================== WITH IT ON, EVERY PRESS TAKES THE ONE SHOWN ===================== */
describe('with one-button scanning ON, a press from any transport takes the item shown', () => {
  beforeEach(async () => { estado.setSwitchScanValue(true); await quadro(); ouvidos.length = 0; });
  afterAll(() => { estado.setSwitchScanValue(false); });

  for (const source of ['olhos', 'rosto', 'gestos', 'fala', 'toque', 'gamepad']) {
    it(`🔴 [Right] through the controller, «${source}»'s «Confirmar» takes «Cima», which is shown — and the game hears «Cima»`, async () => {
      await quandoOferecer('Cima');
      tocar('action2', source);
      expect(ouvido(), `the press from «${source}» was itself, not the item shown`).toEqual([`up:${source}`]);
    }, LIMITE);
  }

  it('🔴 [Zero] a press that lands on «cancelar» means NOTHING, from every transport — not even the camera\'s START', async () => {
    await quandoOferecer(pt['scan.nothing']);
    for (const source of ['olhos', 'rosto', 'gestos', 'fala', 'toque', 'gamepad']) tocar('action2', source);
    tocar('start', 'olhos');
    expect(ouvido(), 'a press on «cancelar» reached the game').toEqual([]);
    expect(pausadoAVista(), 'a press on «cancelar» opened the pause').toBe(false);
  }, LIMITE);

  it('🔴 [Right] a CLICK on the game region takes the item shown, and the button under it is NOT pressed', async () => {
    await quandoOferecer('Cima');
    await userEvent.click(resposta());
    expect(cliques, 'the click was also the game\'s button: one press, two things').toEqual([]);
    expect(ouvido()).toEqual(['up:toque']);
  }, LIMITE);

  it('🔴 [Zero] a click on the region while «cancelar» shows does nothing at all', async () => {
    await quandoOferecer(pt['scan.nothing']);
    await userEvent.click(resposta());
    expect(cliques).toEqual([]);
    expect(ouvido()).toEqual([]);
  }, LIMITE);

  it('🔴 [Right] a FINGER — pointer events stamped `touch` — takes it too, and the click after it is swallowed', async () => {
    await quandoOferecer('Baixo');
    toque(resposta());
    expect(cliques, 'the click that follows a touch pressed the button').toEqual([]);
    expect(ouvido()).toEqual(['down:toque']);
  }, LIMITE);

  it('🔴 [Boundary] a finger that SLID OFF before its click does not swallow the click a later «confirm» sends to its item', async () => {
    // A touch whose click never comes (the finger left the button) must not leave a mark that eats the engine's own click: in a
    // panel, «confirmar» presses the item under the cursor by clicking it, and that click is the take's, not a touch's.
    const painel = document.querySelector('#game-region .overlay');
    const botao = painel?.querySelector('.overlay__card button');
    expect(botao, 'the root mounted no panel with a button: the case would measure nothing').toBeTruthy();
    const apertados = [];
    const ouvir = (e) => { apertados.push(e.target); e.stopImmediatePropagation(); }; // heard, and kept from acting
    painel.hidden = false;
    botao.focus();
    botao.addEventListener('click', ouvir);
    try {
      await quadro();
      await quandoOferecer(pt['scan.nothing']);
      const r = resposta().getBoundingClientRect();
      const at = { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 9, clientX: r.x + 4, clientY: r.y + 4 };
      resposta().dispatchEvent(new PointerEvent('pointerdown', at)); // on «cancelar»: taken, and nothing
      resposta().dispatchEvent(new PointerEvent('pointercancel', at)); // ...and the finger slides off: no click follows
      await quandoOferecer(pt['scan.menu.confirm']);
      document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true, cancelable: true }));
      // by IDENTITY: `toEqual` compares DOM nodes with `isEqualNode`, and a copy of the button passes it
      expect(apertados, '«confirmar» did not press the item under the cursor: its click was swallowed').toHaveLength(1);
      expect(apertados[0], '«confirmar» pressed another node than the item under the cursor').toBe(botao);
    } finally { botao.removeEventListener('click', ouvir); painel.hidden = true; }
  }, LIMITE);

  it('🔴 [Right] the ON-SCREEN PAD: its face buttons and its START pill take the item shown — no pause opens', async () => {
    const tc = document.getElementById('touch-controls');
    expect(tc, 'the root drew no pad: the case would measure nothing').not.toBeNull();
    tc.hidden = false;
    const face = tc.querySelector('.touch-pad .touch-btn'); // «Confirmar», the game's own button on the pad
    const start = document.getElementById('touch-start');
    expect(face && start, 'the pad has no face button or no START pill').toBeTruthy();
    await quandoOferecer('Cima');
    await userEvent.click(face);
    await quandoOferecer('Baixo');
    await userEvent.click(start);
    expect(ouvido(), 'a pad button pressed its own position').toEqual(['up:toque', 'down:toque']);
    expect(pausadoAVista(), 'the START pill opened the pause').toBe(false);
  }, LIMITE);

  it('🔴 [Right] THE GAMEPAD: its START takes the item shown instead of pausing, and its d-pad moves nothing', async () => {
    await quandoOferecer('Cima');
    await botaoDoPad(9); // START
    expect(ouvido(), 'the pad\'s START was itself').toEqual(['up:gamepad']);
    expect(pausadoAVista(), 'the pad\'s START opened the pause').toBe(false);
    await quandoOferecer(pt['scan.nothing']);
    await botaoDoPad(13); // down on the d-pad, on «cancelar»
    expect(ouvido(), 'a press on «cancelar» from the pad reached the game').toEqual(['up:gamepad']);
  }, LIMITE);

  it('🔴 [Right] THE VOICE, through its own module: «start» takes the item shown — no pause', async () => {
    const pulsos = [];
    let ouvir = null; let fim = null;
    const voz = createVoiceControl({
      t: translate, base: location.href, language: () => 'pt-BR', controller: motor.controller,
      menuWords: () => [], pointAt: () => false, oneButtonOnly: () => estado.switchScan,
      say: () => {}, alert: () => {}, report: () => {}, turnOff: () => {},
      after: (fn) => { pulsos.push(fn); },
      hasFile: async () => true, loadBundle: async () => ({ createModel: async () => ({}) }), getUserMedia: async () => ({ getTracks: () => [] }),
      createContext: () => ({}), loadRuntime: async () => ({ ok: true, model: {} }),
      listen: async (d) => { ouvir = d.onPartial; fim = d.onFinal; return { setGrammar() {}, async stop() {} }; },
    });
    await voz.apply(true);
    try {
      await quandoOferecer('Confirmar');
      ouvir('start'); fim(''); for (const p of pulsos.splice(0)) p();
      expect(ouvido(), '«start» was itself').toEqual(['action2:fala']);
      expect(pausadoAVista(), '«start» opened the pause').toBe(false);
    } finally { await voz.apply(false); }
  }, LIMITE);

  it('🔴 [Right] THE EYES, through their own module: two seconds closed take the item shown — no pause', async () => {
    const regiao = document.createElement('div');
    Object.assign(regiao.style, { position: 'relative', width: '720px', height: '360px' });
    document.body.appendChild(regiao);
    let agora = 0; let passo = null; let rosto = null;
    const loop = { requestFrame: (cb) => { passo = cb; return 1; }, cancelFrame: () => { passo = null; }, now: () => agora, every: () => 2, stopEvery: () => {} };
    const passar = (ms) => { for (const fim = agora + ms; agora < fim;) { agora += 33; passo?.(agora); } };
    const tracker = { detect: () => rosto, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, close: () => {} };
    const olhos = createEyeControl({
      t: translate, doc: document, region: regiao, base: location.href, hasFile: async () => true, loop,
      controller: motor.controller, say: () => {}, alert: () => {}, report: () => {}, turnOff: () => {},
      openFeed: async () => ({ frame: {}, ready: () => true, close: () => {} }), loadTracker: async () => ({ ok: true, tracker }),
    });
    await olhos.apply(true);
    try {
      rosto = gaze({}); passar(3200); // the rest is measured
      await quandoOferecer('Baixo');
      ouvidos.length = 0; // only the gesture below is measured
      rosto = gaze({ closed: true }); passar(2200);
      rosto = gaze({}); passar(300);
      expect(ouvido(), 'the eyes\' START was itself').toEqual(['down:olhos']);
      expect(pausadoAVista(), 'closing the eyes opened the pause').toBe(false);
    } finally { await olhos.apply(false); regiao.remove(); }
  }, LIMITE);
});

/*
 * ===================== WHAT STAYS ITSELF =====================
 * The quick bar is where the child's own switches live, and three of them must answer as themselves: ☝️ is the way OUT of
 * one-button mode, and 📷 and 👄 turn the camera and voice transports on and off. A touch on the bar is the bar's.
 */
describe('with one-button scanning ON, the quick bar stays itself', () => {
  beforeEach(async () => { estado.setSwitchScanValue(true); await quadro(); ouvidos.length = 0; });
  afterAll(() => { estado.setSwitchScanValue(false); });

  it('🔴 [Right] touching ☝️ LEAVES one-button mode — the child is not locked in it — and takes nothing', async () => {
    expect(icone('altmove'), 'the root mounted no ☝️').not.toBeNull();
    await quandoOferecer('Cima');
    await userEvent.click(icone('altmove'));
    expect(estado.switchScan, '☝️ was taken as a scan press: the child cannot leave').toBe(false);
    expect(ouvido(), 'touching ☝️ also took the item shown').toEqual([]);
    await quadro();
    expect(chip().hidden, 'the chip stayed on screen').toBe(true);
  }, LIMITE);

  it('🔴 [Zero] a click OUTSIDE the game region is the page\'s, not the switch', async () => {
    await quandoOferecer('Cima');
    await userEvent.click(document.getElementById('fora'));
    expect(cliques, 'a button outside the game was swallowed').toEqual(['fora']);
    expect(ouvido(), 'a click outside the game took the item shown').toEqual([]);
  }, LIMITE);

  for (const [k, nome] of [['camera', '📷'], ['voice', '👄']]) {
    it(`🔴 [Right] touching ${nome} reaches ${nome} — a transport's own switch — and takes nothing`, async () => {
      const el = icone(k);
      expect(el, `the root mounted no ${nome}`).not.toBeNull();
      const vistos = [];
      // 📌 Heard on the document, before the icon's own listener, and stopped there: what is measured is that the press REACHED
      // the icon, and the camera or the microphone are not really opened by a test.
      const ouvir = (e) => { if (el.contains(e.target)) { vistos.push(e.type); e.stopPropagation(); } };
      for (const tipo of ['pointerdown', 'click']) document.addEventListener(tipo, ouvir, true);
      try {
        await quandoOferecer('Cima');
        await userEvent.click(el);
      } finally { for (const tipo of ['pointerdown', 'click']) document.removeEventListener(tipo, ouvir, true); }
      expect(vistos, `the press never reached ${nome}`).toEqual(['pointerdown', 'click']);
      expect(ouvido(), `touching ${nome} also took the item shown`).toEqual([]);
      expect(estado.switchScan).toBe(true);
    }, LIMITE);
  }
});

// MUTATIONS CHECKED (2026-09-26) — `scratchpad/scan-rest/mutate2.mjs`: CRLF normalised, exactly one occurrence required, each
// file restored from a copy and checked by SHA-256. All red, counted in this file:
//   Q1 the controller never asks the scan                       🔴 9 (every transport through the controller, voice, eyes, START)
//   Q2 the controller lets START and SELECT through untaken      🔴 3 («cancelar» with the camera's START, the voice, the eyes)
//   Q3 the root does not wire the controller to the scan         🔴 9
//   Q4 the gamepad never asks                                    🔴 «THE GAMEPAD» (and 5 in `gamepad.node`)
//   Q6 the root does not wire the gamepad to the scan            🔴 «THE GAMEPAD»
//   Q7 a touch blocked but not taken                             🔴 3 (the click, the finger, the pad)
//   Q8 the touch's pointerdown not stopped                       🔴 3 (the game's own button hears it)
//   Q9 the click after a taken touch not swallowed               🔴 4
//   Q10 the quick bar taken like the rest of the region          🔴 3 (☝️, 📷, 👄)
//   Q11 the mark of a touch whose click never came not cleared   🔴 «a finger that SLID OFF»
//   Q12 a touch anywhere on the page taken                       🔴 «a click OUTSIDE the game region»
//   Q13 the scan's own press taken again                         🔴 12
//   Q14 a press on «cancelar» not taken (it acts as itself)      🔴 2
//   Q15 the touch's pointerup not stopped                        🔴 3
