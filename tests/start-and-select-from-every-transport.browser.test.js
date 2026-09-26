// SPDX-License-Identifier: AGPL-3.0-or-later
// START AND SELECT FROM EVERY TRANSPORT (ADR-0144 §1 «from any transport», ADR-0155; erratum of ADR-0144 of 2026-09-26).
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 MEASURED on 2026-09-26: the keyboard (Enter/H, F), the gamepad's START and the touch pills open the pause, because each has a
// door of its own. The transports that press the VIRTUAL CONTROLLER directly — the eyes (both closed for 2 s), the face (a long
// squeeze), the hands (🤟 and the dog), the voice («start», «select») and the scan — never did: before `e7cccc29` the controller
// handed `start`/`select` to the game's `onCommand`, which ignored them; after it, the controller dropped them in play. Only with a
// menu open did they do anything, as that menu's key. Now, in play, the controller hands them to the ENGINE (`systemPress`).
//
// 📌 Each transport is driven through the REAL root's controller (`motor.controller`, ADR-0223) with its own stamp, and the three
// camera transports and the voice also through their own modules, on the same doubles their files use — so what is measured is
// the gesture a child makes, not a call a test makes for her.
//
// ⚠️ ONE ROOT for the file: `createGame` hangs listeners on the window, so a second root would answer the same keys.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js';
import { detection as gaze } from './fixtures/synthetic-face.js';
import { createEyeControl } from '../app/js/ui/eye-control.js';
import { createFaceControl } from '../app/js/ui/face-control.js';
import { createHandControl } from '../app/js/ui/hand-control.js';
import { createVoiceControl } from '../app/js/ui/voice-control.js';
import { createTranslator } from '../app/js/core/i18n.js';

const translate = createTranslator().t;
let motor;
let raiz;
/** What the GAME heard through `onCommand` — it must hear neither `start` nor `select`. */
const ouvidos = [];
/** The phases the GAME was asked for (its `setPhase`). */
const fases = [];

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const PRESET = { up: { label: 'Cima' }, down: { label: 'Baixo' }, action2: { label: 'Confirmar' }, action3: { label: 'Voltar' } };

const cartao = () => document.getElementById('vp-pause-0');
const pausado = () => document.querySelector('#game-region .pausa-rapida');
const pausadoAVista = () => !!pausado() && pausado().hidden === false;
const cartaoAberto = () => cartao()?.hidden === false;
const cursorNaBarra = () => document.querySelectorAll('.pi-sel').length;
/** A real key, as the child gives it: born on the game region and rising. */
const tecla = (code) => {
  const e = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  document.getElementById('game-region').dispatchEvent(e);
  document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
  return e;
};
/** A tap on the controller from `source`, the way every transport that reads positions presses it. */
const tocar = (action, source, seat = 0) => { motor.controller.press(action, source, seat); motor.controller.release(action, source, seat); };
const sistemaOuvido = () => ouvidos.filter((c) => c.action === 'start' || c.action === 'select');

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    ...keyed({ preset: PRESET }), setPhase: (p) => fases.push(p), onCommand: (c) => ouvidos.push(c),
  });
});
afterAll(() => { motor?.unmount?.(); raiz?.remove(); });

beforeEach(() => {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  // a quick pause a case left on leaves by its own door, as a child's would: there is no API that turns it off
  if (pausadoAVista()) tecla('KeyH');
  ouvidos.length = 0;
  fases.length = 0;
});

/* ===================== THROUGH THE CONTROLLER, ONE STAMP AT A TIME ===================== */
for (const source of ['olhos', 'rosto', 'gestos', 'fala']) {
  describe(`START and SELECT pressed on the virtual controller from «${source}»`, () => {
    it('🔴 [Right] START in play opens the QUICK PAUSE — PAUSED, the bar on the directional, no card — and asks the game to pause', () => {
      expect(pausadoAVista(), 'PAUSED was already on screen: the case would measure nothing').toBe(false);
      tocar('start', source);
      expect(pausadoAVista(), `START from «${source}» did not open the quick pause`).toBe(true);
      expect(cursorNaBarra(), 'the directional did not go to the bar').toBe(1);
      expect(cartaoAberto(), 'START opened the menus: that is SELECT\'s').toBe(false);
      expect(fases).toEqual(['paused']);
      expect(sistemaOuvido(), 'the game heard a system position').toEqual([]);
    });

    it('🔴 [Right] START again RESUMES — PAUSED leaves, the bar lets go, the game is asked to play', () => {
      tocar('start', source);
      tocar('start', source);
      expect(pausadoAVista(), `the second START from «${source}» did not leave the quick pause`).toBe(false);
      expect(cursorNaBarra(), 'the directional stayed on the bar').toBe(0);
      expect(fases).toEqual(['paused', 'playing']);
      expect(sistemaOuvido()).toEqual([]);
    });

    it('🔴 [Right] SELECT opens the CARD and asks the game to pause once — and from the quick pause it goes on to the card', () => {
      tocar('select', source);
      expect(cartaoAberto(), `SELECT from «${source}» did not open the menus`).toBe(true);
      expect(fases).toEqual(['paused']);
      motor.pause.hide(0);
      fases.length = 0;
      tocar('start', source);
      tocar('select', source);
      expect(cartaoAberto(), 'SELECT in the quick pause did not open the menus').toBe(true);
      expect(pausadoAVista(), 'PAUSED stayed over the card').toBe(false);
      expect(fases, 'the game was unfrozen on the way from the quick pause to the card').toEqual(['paused']);
      expect(sistemaOuvido()).toEqual([]);
    });

    it('🔴 [Zero] the GAME hears neither — not the press, not the release', () => {
      tocar('start', source);
      tocar('start', source);
      tocar('select', source);
      expect(ouvidos, 'the cartridge was handed a position that is the engine\'s').toEqual([]);
    });
  });
}

describe('the card\'s own rules, and the doors the keyboard already had', () => {
  it('🔴 [Boundary] with the CARD open, START does not open the quick pause under it — as Enter/H do not', () => {
    tocar('select', 'olhos');
    fases.length = 0;
    tocar('start', 'olhos');
    expect(pausadoAVista(), 'START opened the quick pause under the open card').toBe(false);
    expect(cartaoAberto(), 'START closed the card: that is «Voltar ao jogo» and Escape').toBe(true);
    expect(fases).toEqual([]);
  });

  it('🔴 [Boundary] with a PANEL open, neither START nor SELECT opens anything under it', () => {
    const painel = document.querySelector('#game-region .overlay');
    expect(painel, 'the root mounted no panel: the case would measure nothing').not.toBeNull();
    painel.hidden = false;
    try {
      tocar('start', 'fala');
      tocar('select', 'fala');
      expect(pausadoAVista(), 'START opened the quick pause under a panel').toBe(false);
      expect(cartaoAberto(), 'SELECT opened the card under a panel').toBe(false);
    } finally { painel.hidden = true; }
  });

  it('🔴 [Right] THE KEYBOARD still pauses ONCE per key with a cartridge that listens: H, then Enter, then F', () => {
    // 📌 The keyboard's key is answered by its own listener; if the keyboard conductor ALSO pressed it on the controller, one H
    // would open the quick pause and close it again in the same event.
    tecla('KeyH');
    expect(pausadoAVista(), 'H did not open the quick pause (or opened and closed it at once)').toBe(true);
    tecla('KeyH');
    expect(pausadoAVista(), 'H again did not leave').toBe(false);
    tecla('Enter');
    expect(pausadoAVista(), 'Enter did not open the quick pause').toBe(true);
    tecla('KeyH');
    tecla('KeyF');
    expect(cartaoAberto(), 'F did not open the menus').toBe(true);
    expect(fases).toEqual(['paused', 'playing', 'paused', 'playing', 'paused']);
    expect(sistemaOuvido(), 'the game heard a system key').toEqual([]);
  });

  it('🔴 [CrossCheck] THE SEAT: SELECT from seat 1 does not open seat 0\'s card', () => {
    // 📌 A press carries its seat, and the pause it opens is that seat's (ADR-0144 §1 «for the seat that raised it»). This root
    // mounts seat 0's card only, so seat 1's SELECT opens nothing — handing it seat 0's would be another child's menu.
    tocar('select', 'olhos', 1);
    expect(cartaoAberto(), 'a press from seat 1 opened seat 0\'s card').toBe(false);
  });

  it('🔴 [Right] a press the SCAN sends — stamped with the switch\'s source, `teclado` — opens the quick pause in play too', () => {
    // 📌 The scan presses the controller with the source of the switch it read; a key switch is `teclado`, and its key was
    // stopped dead before any listener, so the controller must not assume «the keyboard already answered».
    tocar('start', 'teclado');
    expect(pausadoAVista(), 'a scan press of START was taken for the keyboard\'s own key').toBe(true);
    tecla('KeyH');
  });
});

/*
 * ===================== A START REMAPPED TO ENTER (ADR-0144 erratum of 2026-09-26) =====================
 * 🔴 MEASURED before the fix: with a menu open the controller handed START to the menu as the FIRST key of `start`. In the solo
 * scheme that is `KeyH`, which means nothing to a menu, so it reached START's own listener and left. A child who remapped her first
 * START key to `Enter` got the bar's «confirm» instead: the icon under the cursor was pressed and the game stayed frozen.
 */
describe('START from a transport inside the quick pause, with `start` bound to Enter only', () => {
  let antes;
  beforeEach(() => { antes = motor.keyboardConfig.kb().solo.start; motor.keyboardConfig.kb().solo.start = ['Enter']; });
  afterEach(() => { motor.keyboardConfig.kb().solo.start = antes; });

  it('🔴 [Right] START again LEAVES the quick pause — it does not confirm the bar\'s icon', () => {
    tocar('start', 'olhos');
    expect(pausadoAVista(), 'the case would measure nothing: START did not open the quick pause').toBe(true);
    const cursorAntes = document.querySelector('.pi-sel');
    const clicados = [];
    const ouvir = (e) => clicados.push(e.target);
    document.addEventListener('click', ouvir, true);
    try {
      tocar('start', 'olhos');
    } finally { document.removeEventListener('click', ouvir, true); }
    expect(clicados, `START pressed the icon under the cursor (${cursorAntes?.getAttribute('aria-label') ?? '?'}) as «confirm»`).toEqual([]);
    expect(pausadoAVista(), 'START from the camera did not leave the quick pause').toBe(false);
    expect(cartaoAberto(), 'START opened the menus').toBe(false);
    expect(fases).toEqual(['paused', 'playing']);
  });

  it('🔴 [Right] and SELECT there still goes on to the card, as F does', () => {
    tocar('start', 'fala');
    tocar('select', 'fala');
    expect(cartaoAberto(), 'SELECT in the quick pause did not open the menus').toBe(true);
    expect(pausadoAVista()).toBe(false);
  });

  it('🔴 [CrossCheck] the KEYBOARD\'s Enter on the bar stays the bar\'s «confirm»: the key means what the child bound, the position what the engine owns', () => {
    tocar('start', 'olhos');
    const clicados = [];
    const ouvir = (e) => clicados.push(e.target);
    document.addEventListener('click', ouvir, true);
    try { tecla('Enter'); } finally { document.removeEventListener('click', ouvir, true); }
    expect(clicados.length, 'Enter on the bar no longer presses the icon under the cursor').toBe(1);
    motor.pause.hide(0);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  });
});

/* ===================== THROUGH EACH TRANSPORT'S OWN MODULE ===================== */
// The doubles are the ones each transport's own file uses; what changes is that the presses go to the REAL root.
describe('the gesture a child makes, through its transport, reaches the pause', () => {
  let regiao; let agora; let quadro;
  const loop = {
    requestFrame: (cb) => { quadro = cb; return 1; }, cancelFrame: () => { quadro = null; },
    now: () => agora, every: () => 2, stopEvery: () => {},
  };
  const passar = (ms) => { for (const fim = agora + ms; agora < fim;) { agora += 33; quadro?.(agora); } };
  const base = (extra) => ({
    t: translate, doc: document, region: regiao, base: location.href, hasFile: async () => true, loop,
    controller: motor.controller, say: () => {}, alert: () => {}, report: () => {}, turnOff: () => {},
    openFeed: async () => ({ frame: {}, ready: () => true, close: () => {} }), ...extra,
  });
  beforeEach(() => {
    regiao = document.createElement('div');
    Object.assign(regiao.style, { position: 'relative', width: '720px', height: '360px' });
    document.body.appendChild(regiao);
    agora = 0; quadro = null;
  });

  it('🔴 [Right] THE EYES: both closed for two seconds open the quick pause, and closed again leave it', async () => {
    let rosto = null;
    const tracker = { detect: () => rosto, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, close: () => {} };
    const olhos = createEyeControl(base({ loadTracker: async () => ({ ok: true, tracker }) }));
    await olhos.apply(true);
    try {
      rosto = gaze({}); passar(3200); // the rest is measured
      rosto = gaze({ closed: true }); passar(2200);
      rosto = gaze({}); passar(300);
      expect(pausadoAVista(), 'two seconds of closed eyes did not open the quick pause').toBe(true);
      rosto = gaze({ closed: true }); passar(2200);
      rosto = gaze({}); passar(300);
      expect(pausadoAVista(), 'closing them again did not leave it').toBe(false);
      expect(fases).toEqual(['paused', 'playing']);
      expect(sistemaOuvido()).toEqual([]);
    } finally { await olhos.apply(false); regiao.remove(); }
  });

  it('🔴 [Right] THE FACE: a long squeeze opens the quick pause', async () => {
    let rosto = null;
    const relaxado = { jawOpen: 0.05, mouthPucker: 0.2 };
    const detectar = (scores) => ({ faceBlendshapes: [{ categories: Object.entries(scores).map(([categoryName, score]) => ({ categoryName, score })) }], faceLandmarks: [[]] });
    const tracker = { detect: () => rosto, delegate: () => 'GPU', eyeLines: { eyes: [], brows: [] }, faceLines: { eyes: [], brows: [], lips: [] }, close: () => {} };
    const face = createFaceControl(base({ loadTracker: async () => ({ ok: true, tracker }) }));
    await face.apply(true);
    try {
      rosto = detectar(relaxado); passar(3100);
      rosto = detectar({ ...relaxado, eyeBlinkLeft: 0.8, eyeSquintLeft: 0.8 }); passar(2500);
      rosto = detectar(relaxado); passar(300);
      expect(pausadoAVista(), 'a long squeeze did not open the quick pause').toBe(true);
      expect(sistemaOuvido()).toEqual([]);
    } finally { await face.apply(false); regiao.remove(); }
  });

  it('🔴 [Right] THE HANDS: 🤟 held opens the quick pause', async () => {
    let mao = null;
    const PONTOS = Array.from({ length: 21 }, (_, i) => ({ x: i === 1 ? 0.2 : 0.3, y: 0.5, z: 0 }));
    const tracker = { detect: () => mao, delegate: () => 'GPU', handLines: [{ start: 0, end: 1 }], close: () => {} };
    const maos = createHandControl(base({ loadTracker: async () => ({ ok: true, tracker }) }));
    await maos.apply(true);
    try {
      mao = { landmarks: [PONTOS], gestures: [[{ categoryName: 'ILoveYou', score: 0.9 }]] }; passar(700);
      mao = null; passar(100);
      expect(pausadoAVista(), '🤟 did not open the quick pause').toBe(true);
      expect(sistemaOuvido()).toEqual([]);
    } finally { await maos.apply(false); regiao.remove(); }
  });

  it('🔴 [Right] THE VOICE: «start» opens the quick pause, «start» again leaves it, «select» opens the card', async () => {
    const pulsos = [];
    let ouvir = null; let fim = null;
    const voz = createVoiceControl({
      t: translate, base: location.href, language: () => 'pt-BR', controller: motor.controller,
      menuWords: () => [], pointAt: () => false, say: () => {}, alert: () => {}, report: () => {}, turnOff: () => {},
      after: (fn) => { pulsos.push(fn); },
      hasFile: async () => true, loadBundle: async () => ({ createModel: async () => ({}) }), getUserMedia: async () => ({ getTracks: () => [] }),
      createContext: () => ({}), loadRuntime: async () => ({ ok: true, model: {} }),
      listen: async (d) => { ouvir = d.onPartial; fim = d.onFinal; return { setGrammar() {}, async stop() {} }; },
    });
    await voz.apply(true);
    const dizer = (palavra) => { ouvir(palavra); fim(''); for (const p of pulsos.splice(0)) p(); };
    try {
      dizer('start');
      expect(pausadoAVista(), '«start» did not open the quick pause').toBe(true);
      dizer('start');
      expect(pausadoAVista(), '«start» again did not leave it').toBe(false);
      dizer('select');
      expect(cartaoAberto(), '«select» did not open the menus').toBe(true);
      expect(fases).toEqual(['paused', 'playing', 'paused']);
      expect(ouvidos, 'the game heard a spoken system word').toEqual([]);
    } finally { await voz.apply(false); regiao.remove(); }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// 📏 BEFORE the change this file was 18 red of 25: every START and SELECT from «olhos», «rosto», «gestos» and «fala», the scan's
// press, the four gestures through their own modules, and «with the CARD open», whose SELECT opened no card — nothing opened. The seven green were the four «the GAME hears
// neither» (it heard nothing because nothing happened), the two that assert nothing opens (a panel, seat 1) and the keyboard's.
// Eleven mutations, eleven red (2026-09-26) — `scratchpad/start-any/mutate.mjs`: CRLF normalised, exactly one occurrence
// required, each file restored from a copy and checked by SHA-256. Counted in this file (and in `virtual-controller.node`):
//   V1 the controller never calls `systemPress`                  🔴 18 here, 17 there
//   V2 the controller tells the engine seat 0 whatever the seat   🔴 «THE SEAT», and «told the SEAT» there
//   V3 `systemPress` asked before `toPlay`                        🔴 «held back from play reaches nobody» there
//   V4 `systemPress` asked with a menu open too                   🔴 6 here (START again no longer leaves), 1 there
//   V5 a system position also delivered to the game               🔴 20 here, 17 there
//   H1 the root does not wire `systemPress`                       🔴 18
//   H2 START and SELECT swapped in the root                       🔴 15
//   H3 the root opens seat 0's card whatever the seat             🔴 «THE SEAT»
//   H4 the keyboard conductor presses START/SELECT again          🔴 «THE KEYBOARD still pauses ONCE» (H opened and closed at once)
//   H5 `startForSeat` ignores the open card                       🔴 «with the CARD open»
//   H6 `startForSeat` ignores an open panel                       🔴 «with a PANEL open»
// And (2026-09-26, a START remapped to Enter) — `scratchpad/scan-doors/mutate.mjs`, same discipline:
//   V6 with a menu open, the controller hands START to the menu as its first key again   🔴 «START again LEAVES» (the icon
//      under the cursor was pressed); «SELECT there still goes on to the card» stays green, as it should: F means SELECT anyway
