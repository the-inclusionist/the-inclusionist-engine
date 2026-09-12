// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VIRTUAL PAD IS MOUNTED BY THE ENGINE (ADR-0143, plan phase 4).
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 MEASURED on 2026-09-12: `montarControleDeToque`, `initTouch` and `initTouchBindings` had tests and NO
// production caller — `git grep` found them only in their own modules. A school whose device is a tablet with
// no keyboard had no way to play any game started by `createGame`, and nothing said so.
//
// 📌 A BROWSER FILE, AND ONE ROOT: `createGame` hangs listeners on `window` and nothing removes them, so the
// root is born once and cartridges are swapped with `mount()` (ADR-0142), as in the pause-start file.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { keys } from '../app/js/input/state.js';

let motor;
let raiz;
let fases;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

/** Two actions, and nothing else — the quiz shape. `action1` sits on slot b2 and `action2` on b0 by default. */
const DUAS_ACOES = { action1: { label: 'Confirm' }, action2: { label: 'Back' } };
const PLATAFORMA = {
  up: { label: 'Up' }, down: { label: 'Down' }, left: { label: 'Left' }, right: { label: 'Right' },
  action1: { label: 'Jump' }, action2: { label: 'Run' },
};

const pad = () => document.getElementById('touch-controls');
const botoes = () => [...document.querySelectorAll('#touch-controls .touch-btn[data-btn]')];
const toque = (el, tipo) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 1 }));

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  try { localStorage.removeItem('incl_touchmap'); } catch { /* sem storage: o mapa de fábrica vale na mesma */ }
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  fases = [];
  motor = createGame({
    declaration: declaracao(),
    host: { doc: document, win: window },
    baixarPesados: false,
    preset: DUAS_ACOES,
    setPhase: (p) => fases.push(p),
  });
});

describe('createGame mounts the virtual pad from the preset', () => {
  it('🎯 [Right] the pad is IN the game region, and born hidden', () => {
    expect(pad(), 'no #touch-controls: a tablet with no keyboard has no way to play').not.toBeNull();
    expect(document.getElementById('game-region').contains(pad())).toBe(true);
    expect(pad().hidden, 'a pad born visible covers the game of whoever never touches it').toBe(true);
  });

  it('🔴 [Right] a preset of TWO actions gets TWO buttons and no directional — not nine', () => {
    expect(botoes()).toHaveLength(2);
    expect(document.querySelector('#touch-cross, #touch-stick'), 'a directional nobody declared').toBeNull();
    // the game's own words, not an id
    expect(botoes().map((b) => b.textContent).sort()).toEqual(['Back', 'Confirm']);
  });

  it('🔴 [Right] the START pill exists anyway — the pause is not declinable (ADR-0122)', () => {
    const start = document.getElementById('touch-start');
    expect(start).not.toBeNull();
    expect(start.textContent.trim(), 'an empty pill is a button nobody can read').not.toBe('');
  });

  it('[Zero] a preset whose actions all reach the pad says nothing in `problems`', () => {
    expect(motor.problems.filter((l) => /controle virtual/.test(l))).toEqual([]);
  });

  it('🎯 [Right] a touch REVEALS the pad, and a key of the game hides it again', () => {
    toque(document.getElementById('game-region'), 'pointerdown');
    expect(pad().hidden, 'touching the screen did not reveal the pad').toBe(false);
    document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', bubbles: true }));
    expect(pad().hidden, 'playing on the keyboard left the pad over the game').toBe(true);
  });

  it('🔴 [Right] pressing a pad button holds the KEY of that action, and releasing lets it go', () => {
    const confirmar = botoes().find((b) => b.textContent === 'Confirm');
    const antes = new Set(keys);
    toque(confirmar, 'pointerdown');
    const novas = [...keys].filter((k) => !antes.has(k));
    expect(novas, 'the button did not inject the key the child mapped to «Confirm»').toHaveLength(1);
    toque(confirmar, 'pointerup');
    expect(keys.has(novas[0]), 'the key stayed held after the finger left').toBe(false);
  });

  it('🔴 [Right] the START pill opens the pause card and asks the game to pause', () => {
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao?.hidden, 'the card was already open; the case would measure nothing').toBe(true);
    document.getElementById('touch-start').click();
    expect(cartao.hidden, 'the START pill did not open the pause').toBe(false);
    expect(fases).toContain('paused');
    // 📌 The pair: with the card OPEN, a touch does not bring the pad back over the menu the child is tapping.
    expect(pad().hidden, 'opening the pause left the pad over the card').toBe(true);
    toque(document.getElementById('game-region'), 'pointerdown');
    expect(pad().hidden, 'a touch on the open pause revealed the pad on top of its buttons').toBe(true);
    motor.pausa.esconder(0);
  });
});

describe('mount() rebuilds the pad for the new cartridge', () => {
  it('🔴 [Zero] without a preset: no action button, the START stays, AND `problems` says why', () => {
    motor.mount(declaracao(), {});
    expect(botoes()).toHaveLength(0);
    expect(document.getElementById('touch-start'), 'the pause lost its only touch door').not.toBeNull();
    expect(motor.problems.some((l) => /sem `preset`: o controle virtual/.test(l)), 'the gap was silent').toBe(true);
  });

  it('🎯 [Boundary] a platform preset gets the cross with its arms drawn the way the bindings light them', () => {
    try { localStorage.setItem('incl_paddir', 'cross'); } catch { /* sem storage não há como pedir a cruz */ }
    motor.mount(declaracao(), { preset: PLATAFORMA });
    const cruz = document.getElementById('touch-cross');
    expect(cruz, 'four declared directions and no cross').not.toBeNull();
    // ⚠️ `touch-bindings` lights `.dpad-up` & co. on the cross and the stylesheet draws `.dpad-arm`: an arm
    // with only `.touch-arm` is an unstyled button the finger never sees light up.
    for (const d of ['up', 'down', 'left', 'right']) {
      expect(cruz.querySelector(`.dpad-arm.dpad-${d}`), `arm ${d} without the classes that draw and light it`).not.toBeNull();
    }
    expect(botoes()).toHaveLength(2);
    expect(motor.problems.some((l) => /sem `preset`/.test(l)), 'the old cartridge\'s gap outlived it').toBe(false);
  });

  it('🔴 [Right] the rebuilt buttons are WIRED — a mount does not leave dead buttons', () => {
    const pular = botoes().find((b) => b.textContent === 'Jump');
    const antes = new Set(keys);
    toque(pular, 'pointerdown');
    expect([...keys].filter((k) => !antes.has(k)), 'the button of the new cartridge does nothing').toHaveLength(1);
    toque(pular, 'pointerup');
  });
});

describe('the START pill, with the real stylesheet', () => {
  it('🔴 [Right] its word FITS inside it — measured in the dist, «START» spilled 66px out of a 56px button', async () => {
    // ⚠️ The stylesheet is not loaded in vitest browser; without injecting it this case would measure an
    // unstyled button and pass by blindness (the trap already paid in the BDA spacing gate).
    const { default: css } = await import('../app/css/style.css?raw');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    // 📏 AT THE LARGEST SCALE THE ENGINE ITSELF APPLIES: the country's cursive hand sets `--fonte-escala` to
    // 1.25 (ADR-0149 §1). At 1 the word fits by luck — this case passed green at 16px while the dist, at 20px,
    // spilled — so measuring at 1 would test the child who never enlarged anything.
    document.documentElement.style.setProperty('--fonte-escala', '1.25');
    try {
      pad().hidden = false;
      const start = document.getElementById('touch-start');
      const caixa = start.getBoundingClientRect();
      const r = document.createRange();
      r.selectNodeContents(start);
      const texto = r.getBoundingClientRect();
      expect(texto.width, 'the pill measured no text — the case would pass by measuring nothing').toBeGreaterThan(0);
      expect(texto.left >= caixa.left - 0.5 && texto.right <= caixa.right + 0.5,
        `the word spills out of the pill: text ${Math.round(texto.width)}px in a ${Math.round(caixa.width)}px button`).toBe(true);
    } finally {
      pad().hidden = true;
      style.remove();
      document.documentElement.style.removeProperty('--fonte-escala');
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Twelve, twelve red — applied by script from a copy, occurrence count checked before each:
//   P1 the pad is never drawn at boot                        🔴 6 cases
//   P2 the bindings are never attached                       🔴 3 cases (reveal, press, START)
//   P3 mount() redraws but does not rewire                   🔴 dead buttons after a swap
//   P4 mount() does not redraw                               🔴 the old cartridge's pad stays
//   P5 the cross arms lose `dpad-arm dpad-<dir>`             🔴 unstyled, never lit
//   P6 the START pill has no text                            🔴 a button nobody can read
//   P7 a game key does not hide the pad                      🔴 pad over the keyboard player's game
//   P8 getStartAction back to the old broken read            🔴 the START pill opens nothing
//   P9 the pad is allowed over an open pause card            🔴 pad over the menu buttons
//   P10 the pad's gaps do not reach `problems`               🔴 silent gap
//   P11 opening the pause by touch leaves the pad up         🔴 pad over the card
//   P12 `.touch-start` loses `width:auto`                   🔴 «START» spills 66px out of 56px (it was red before the fix)
// ⚠️ And wiring the modules together found THREE defects none of their own tests could see: arms the
// stylesheet does not draw and the bindings do not light, a START pill with no text, and a bare global
// `addEventListener` in `input/touch` that took down every boot on a document with no window.
