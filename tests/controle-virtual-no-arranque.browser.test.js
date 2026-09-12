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
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';
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
  motor = createGame({ acomodacoes: SEM_ASSUNTO,
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

  it('🔴 [Right] a preset of two actions gets the MINIMUM pad — four buttons and a directional (ADR-0157)', () => {
    expect(botoes()).toHaveLength(4);
    expect(document.querySelector('#touch-cross, #touch-stick'), 'no directional: no menu can be moved by touch').not.toBeNull();
    const nomes = botoes().map((b) => b.textContent);
    // the game's own words where it has them…
    expect(nomes).toEqual(expect.arrayContaining(['Confirm', 'Back']));
    // …and the physical face label elsewhere — never an id
    for (const n of nomes) expect(n, 'a pad button shows an action id').not.toMatch(/^action\d|^b\d$/);
    expect(nomes.every((n) => n.trim() !== ''), 'a pad button with no label').toBe(true);
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

  it('🔴 [Right] the START pill is the QUICK PAUSE (ADR-0155) — and the second tap leaves it', () => {
    const pausado = () => document.querySelector('#game-region .pausa-rapida');
    toque(document.getElementById('game-region'), 'pointerdown');
    expect(pausado()?.hidden ?? true, 'PAUSED was already showing; the case would measure nothing').toBe(true);
    fases.length = 0;
    document.getElementById('touch-start').click();
    expect(pausado()?.hidden, 'the START pill did not pause').toBe(false);
    expect(document.getElementById('vp-pause-0').hidden, 'the START pill opened the menu card: that is SELECT now').toBe(true);
    expect(fases).toEqual(['paused']);
    // ⚠️ THE PAD STAYS: its START pill is the only exit a touch-only child has. Hiding it, as the card did, would
    // leave her in a frozen game with no door.
    expect(pad().hidden, 'the quick pause hid the pad, and with it the only way out').toBe(false);
    document.getElementById('touch-start').click();
    expect(pausado().hidden, 'the second tap did not leave the quick pause').toBe(true);
    expect(fases).toEqual(['paused', 'playing']);
  });

  it('🔴 [Right] with the menu card OPEN the pad STAYS, and its directional MOVES the card (ADR-0157)', async () => {
    // 🔴 It was the opposite: the pad hid over the card, and a pad press only marked a held key with no keyboard event —
    // the menu navigation never saw it. The Dev could not move through any menu by touch.
    // 📌 With the real stylesheet and the CROSS: the directional reads the finger's position against its own rectangle,
    // and an unstyled pad measures nothing — the case would pass or fail by geometry, not by the bridge.
    const { default: css } = await import('../app/css/style.css?raw');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    try { localStorage.setItem('incl_paddir', 'cross'); } catch { /* sem storage */ }
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    motor.pausa.mostrar(0);
    try {
      toque(document.getElementById('game-region'), 'pointerdown');
      expect(pad().hidden, 'the pad hid with the card open: a touch-only child has no directional').toBe(false);
      const marcado = () => document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act;
      const antes = marcado();
      const cruz = document.getElementById('touch-cross');
      const r = cruz.getBoundingClientRect();
      expect(r.height, 'the cross has no size — the case would measure nothing').toBeGreaterThan(0);
      const em = { bubbles: true, cancelable: true, pointerId: 7, clientX: r.left + r.width / 2, clientY: r.bottom - 2 };
      cruz.dispatchEvent(new PointerEvent('pointerdown', em));
      cruz.dispatchEvent(new PointerEvent('pointerup', em));
      expect(marcado(), 'the pad directional did not move the card cursor').toBeTruthy();
      expect(marcado()).not.toBe(antes);
      // ⚠️ the key the pad handed to the menu is stamped as TOUCH (ADR-0109): the «keyboard hides the pad» listener must not
      // take it for a keyboard, or the pad would vanish after every step it gives
      expect(pad().hidden, 'the pad hid itself after its own press').toBe(false);
      // 🔴 THE PAIR, found by the Dev: a REAL key in the same menu hides the pad. The menu navigation consumes the key
      // in the window's CAPTURE phase with `stopPropagation()`, so a listener in the bubble phase never heard it — the
      // child switched to the keyboard and the pad stayed over the card.
      const depoisDoPad = marcado();
      document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(marcado(), 'the key did not reach the menu — the case would not be in a menu').not.toBe(depoisDoPad);
      expect(pad().hidden, 'switching to the keyboard inside a menu left the pad on screen').toBe(true);
    } finally {
      motor.pausa.esconder(0);
      style.remove();
      try { localStorage.removeItem('incl_paddir'); } catch { /* idem */ }
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
  });

  it('🔴 [Right] from the QUICK PAUSE the pad\'s action-4 button opens the menus — and the pad stays (ADR-0155, ADR-0157)', () => {
    // ⚠️ The door the footer legend names. The key the pad hands over is NOT consumed by the menu navigation here (no menu
    // intent for action 4), so it reaches the «keyboard hides the pad» listener: only its TOUCH stamp (ADR-0109) keeps
    // the pad from vanishing under the finger that just used it.
    toque(document.getElementById('game-region'), 'pointerdown');
    document.getElementById('touch-start').click();
    try {
      expect(document.querySelector('#game-region .pausa-rapida')?.hidden, 'the START pill did not pause').toBe(false);
      const menu = document.querySelector('#touch-controls .touch-btn[data-btn="3"]'); // b3 → action4 by default
      toque(menu, 'pointerdown');
      toque(menu, 'pointerup');
      expect(document.getElementById('vp-pause-0').hidden, 'action 4 on the pad did not open the menus').toBe(false);
      expect(pad().hidden, 'the pad hid itself after the key it handed over').toBe(false);
    } finally {
      for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
      motor.pausa.esconder(0);
    }
  });

  it('🔴 [Right] in PLAY a pad press still holds the key — the menu bridge only works with a menu open', () => {
    const confirmar = botoes().find((b) => b.textContent === 'Confirm');
    const antes = new Set(keys);
    toque(confirmar, 'pointerdown');
    expect([...keys].filter((k) => !antes.has(k)), 'in play the pad stopped holding the key').toHaveLength(1);
    toque(confirmar, 'pointerup');
  });
});

describe('the SELECT pill opens the menus (ADR-0155)', () => {
  it('🔴 [Right] it exists anyway, with its word — the menus are a door of the pause, not declinable', () => {
    const select = document.getElementById('touch-select');
    expect(select, 'a touch-only child has no way to the menus').not.toBeNull();
    expect(select.textContent.trim()).not.toBe('');
  });

  it('🔴 [Right] a tap opens the card, asks the game to pause once — and the pad stays, it is the way to move in it', () => {
    toque(document.getElementById('game-region'), 'pointerdown');
    fases.length = 0;
    document.getElementById('touch-select').click();
    expect(document.getElementById('vp-pause-0').hidden, 'the SELECT pill did not open the menus').toBe(false);
    expect(fases).toEqual(['paused']);
    expect(pad().hidden, 'the pad hid with the card open (ADR-0157)').toBe(false);
    motor.pausa.esconder(0);
  });

  it('🔴 [Right] from the QUICK PAUSE, the tap goes to the card without thawing the game', () => {
    toque(document.getElementById('game-region'), 'pointerdown');
    document.getElementById('touch-start').click();
    fases.length = 0;
    document.getElementById('touch-select').click();
    expect(document.getElementById('vp-pause-0').hidden).toBe(false);
    expect(document.querySelector('#game-region .pausa-rapida').hidden, 'PAUSED stayed under the card').toBe(true);
    expect(fases, 'the game was resumed on the way to the menus').toEqual([]);
    motor.pausa.esconder(0);
  });
});

describe('the MOTOR panel sizes the pad by persona (ADR-0151 erratum)', () => {
  const abrirMotora = () => {
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]');
    expect(item?.hidden, 'the engine does not action «Acessibilidade motora» even with a pad').toBe(false);
    item.click();
    return document.getElementById('opt-pad-persona');
  };
  const fechar = () => { for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true; motor.pausa.esconder(0); };

  it('🎯 [Right] the panel opens with ONE row, «◀ Controller size: <persona> ▶», read from the stored size', () => {
    try { localStorage.removeItem('incl_padbtnmm'); } catch { /* sem storage: vale o de fábrica */ }
    const passos = abrirMotora();
    expect(passos, 'no persona step control in the motor panel').not.toBeNull();
    // the factory 12.5 mm reads as «small adult»
    expect(passos.getAttribute('aria-valuetext')).toBe('adulto pequeno');
    expect(passos.querySelector('.passo-valor').textContent).toBe('Tamanho do controle: adulto pequeno');
    // 🔴 and the rows ADR-0151 removed are not in THIS panel
    const painel = document.getElementById('motora');
    for (const sel of ['#opt-facil', '#opt-altmove', '#opt-togglerun']) expect(painel.querySelector(sel), sel).toBeNull();
    fechar();
  });

  it('🔴 [Right] with the real stylesheet the row IS the item: the hint went to the footer, no box inside, one line', async () => {
    // «Por que continua desenhando os botões de seleção de <=5 itens do jeito errado?!» (the Dev, on a screenshot:
    // the hint beside the stepper, and «Controller size: small adult» broken into four lines inside a bordered box).
    const { default: css } = await import('../app/css/style.css?raw');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    try {
      const passos = abrirMotora();
      const linha = passos.closest('.ctrl-row');
      // `fillExplain` moves the prose to the footer and leaves the node empty in the row
      expect(linha.querySelector('.opt-hint')?.textContent.trim() ?? '', 'the hint stayed inside the row instead of the footer').toBe('');
      expect(getComputedStyle(passos).borderTopWidth, 'a box drawn inside the row').toBe('0px');
      const valor = passos.querySelector('.passo-valor');
      const alturaDeUmaLinha = parseFloat(getComputedStyle(valor).lineHeight) || parseFloat(getComputedStyle(valor).fontSize) * 1.5;
      expect(valor.getBoundingClientRect().height, 'the label wrapped onto more than one line').toBeLessThan(alturaDeUmaLinha * 1.6);
    } finally {
      fechar();
      style.remove();
    }
  });

  it('🔴 [Right] a step APPLIES the persona: the stored size and the pad geometry change together', () => {
    const passos = abrirMotora();
    const antes = getComputedStyle(document.documentElement).getPropertyValue('--pad-btn');
    passos.querySelector('[data-passo="1"]').click(); // small adult → adult with large hands
    expect(passos.getAttribute('aria-valuetext')).toBe('adulto de mãos grandes');
    expect(localStorage.getItem('incl_padbtnmm'), 'the choice was not stored').toBe('15');
    expect(getComputedStyle(document.documentElement).getPropertyValue('--pad-btn'), 'the pad did not change size').not.toBe(antes);
    passos.querySelector('[data-passo="-1"]').click();
    passos.querySelector('[data-passo="-1"]').click();
    passos.querySelector('[data-passo="-1"]').click(); // to the wall: small child
    expect(localStorage.getItem('incl_padbtnmm')).toBe('16');
    fechar();
    try { localStorage.removeItem('incl_padbtnmm'); } catch { /* idem */ }
  });
});

describe('mount() rebuilds the pad for the new cartridge', () => {
  it('🔴 [Zero] without a preset: the MINIMUM pad, with face labels, AND `problems` says the words are missing', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO });
    expect(botoes()).toHaveLength(4);
    expect(document.getElementById('touch-start'), 'the pause lost its only touch door').not.toBeNull();
    expect(motor.problems.some((l) => /sem `preset`: o controle virtual mostra só o mínimo/.test(l)), 'the gap was silent').toBe(true);
  });

  it('🎯 [Boundary] a platform preset gets the cross with its arms drawn the way the bindings light them', () => {
    try { localStorage.setItem('incl_paddir', 'cross'); } catch { /* sem storage não há como pedir a cruz */ }
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: PLATAFORMA });
    const cruz = document.getElementById('touch-cross');
    expect(cruz, 'four declared directions and no cross').not.toBeNull();
    // ⚠️ `touch-bindings` lights `.dpad-up` & co. on the cross and the stylesheet draws `.dpad-arm`: an arm
    // with only `.touch-arm` is an unstyled button the finger never sees light up.
    for (const d of ['up', 'down', 'left', 'right']) {
      expect(cruz.querySelector(`.dpad-arm.dpad-${d}`), `arm ${d} without the classes that draw and light it`).not.toBeNull();
    }
    expect(botoes()).toHaveLength(4);
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
      // 📌 BOTH system pills since ADR-0155 — SELECT beside START — and each word fits its own pill
      for (const id of ['touch-select', 'touch-start']) {
        const pill = document.getElementById(id);
        const caixa = pill.getBoundingClientRect();
        const r = document.createRange();
        r.selectNodeContents(pill);
        const texto = r.getBoundingClientRect();
        expect(texto.width, `#${id} measured no text — the case would pass by measuring nothing`).toBeGreaterThan(0);
        expect(texto.left >= caixa.left - 0.5 && texto.right <= caixa.right + 0.5,
          `the word spills out of #${id}: text ${Math.round(texto.width)}px in a ${Math.round(caixa.width)}px button`).toBe(true);
      }
      // 🔴 and the two pills do not sit on top of each other — two absolutely-placed pills at the centre would
      const a = document.getElementById('touch-select').getBoundingClientRect();
      const b = document.getElementById('touch-start').getBoundingClientRect();
      expect(a.right <= b.left + 0.5, `SELECT (${Math.round(a.left)}–${Math.round(a.right)}) overlaps START (${Math.round(b.left)}–${Math.round(b.right)})`).toBe(true);
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
//   P11 (retired by ADR-0155: the touch START is the quick pause, and the pad STAYS — it is the exit)
//   Q1  the touch START opens the card instead of the quick pause  🔴 (checked with the ADR-0155 change)
//   Q2  the touch START hides the pad on entering                 🔴 no way out for a touch-only child
//   P12 `.touch-start` loses `width:auto`                   🔴 «START» spills 66px out of 56px (it was red before the fix)
//   Q3  the SELECT pill is not wired                         🔴 no way to the menus by touch
//   Q4  the SELECT pill leaves the pad over the card         🔴 pad over «Voltar ao jogo»
//   Q5  the two pills lose their container                   🔴 SELECT on top of START
//   M1  acoesDaEngine.motora is not set                      🔴 no door to the motor panel
//   M2  the step does not call setPadMm                      🔴 the size is shown and never applied
//   M3  the motor panel render does not fill the footer      🔴 hint inside the row
//   M4  the stepper keeps its border inside the row          🔴 a box inside the box
// ⚠️ And wiring the modules together found THREE defects none of their own tests could see: arms the
// stylesheet does not draw and the bindings do not light, a START pill with no text, and a bare global
// `addEventListener` in `input/touch` that took down every boot on a document with no window.
