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

/**
 * What a game with menus declares since ADR-0162 — a pad button appears only when the game names it, so a game that
 * names no direction cannot move through a menu by touch. `action2` sits on slot b0, `action3` on b1, `action4` on b3.
 */
const DUAS_ACOES = { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Confirm' }, action3: { label: 'Back' }, action4: { label: 'Menu' } };
/** Two actions and no direction: the ADR-0162 boundary. */
const SO_DUAS = { action1: { label: 'Jump' }, action2: { label: 'Run' } };
const PLATAFORMA = {
  up: { label: 'Up' }, down: { label: 'Down' }, left: { label: 'Left' }, right: { label: 'Right' },
  action1: { label: 'Jump' }, action2: { label: 'Run' },
};

const pad = () => document.getElementById('touch-controls');
const botoes = () => [...document.querySelectorAll('#touch-controls .touch-btn[data-btn]')];
/** ADR-0165: a pad button's FUNCTION is said after its name in the accessible name («2, Confirm»); the face is the name. */
const funcao = (b) => (b.getAttribute('aria-label') ?? '').split(', ').slice(1).join(', ');
const toque = (el, tipo) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: 1 }));

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  try { localStorage.removeItem('incl_touchmap'); } catch { /* sem storage: o mapa de fábrica vale na mesma */ }
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  fases = [];
  motor = createGame({ acomodacoes: SEM_ASSUNTO, controleNaTela: true,
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

  it('🔴 [Right] the pad draws exactly what the game NAMES — the button\'s name on the face, the game\'s word as its function (ADR-0162, ADR-0165)', () => {
    const nomes = botoes().map(funcao).sort();
    expect(nomes, 'a button the game did not name, or a named one missing').toEqual(['Back', 'Confirm', 'Menu']);
    expect(botoes().map((b) => b.textContent).sort(), 'a face shows the function, not the name').toEqual(['2', '3', '4']);
    expect(document.querySelector('#touch-cross, #touch-stick'), 'the game named up and down: no directional').not.toBeNull();
  });

  it('🔴 [Boundary] two actions and no direction: two buttons and NO directional (ADR-0162)', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: SO_DUAS, setPhase: (p) => fases.push(p) });
    try {
      expect(botoes().map(funcao).sort()).toEqual(['Jump', 'Run']);
      expect(document.querySelector('#touch-cross, #touch-stick'), 'a directional the game never named').toBeNull();
      expect(document.getElementById('touch-start'), 'SELECT and START stay: they are the doors of the pause').not.toBeNull();
    } finally {
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
  });

  it('🔴 [Right] the SHOULDERS sit in the top corners, the trigger over the bumper — and are WIRED (ADR-0160)', async () => {
    const { default: css } = await import('../app/css/style.css?raw');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const OMBROS = { leftTrigger: { label: 'L-two' }, leftShoulder: { label: 'L-one' }, rightTrigger: { label: 'R-two' }, rightShoulder: { label: 'R-one' } };
    const regiao = document.getElementById('game-region');
    regiao.style.cssText = 'position:relative;width:640px;height:360px';
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: OMBROS, setPhase: (p) => fases.push(p) });
    pad().hidden = false;
    try {
      const botao = (palavra) => [...document.querySelectorAll('#touch-controls .touch-ombro')].find((b) => funcao(b) === palavra);
      const r = regiao.getBoundingClientRect();
      const [l2, l1, r2, r1] = ['L-two', 'L-one', 'R-two', 'R-one'].map((p) => botao(p).getBoundingClientRect());
      expect(l2.top, 'L2 is not above L1').toBeLessThan(l1.top);
      expect(r2.top, 'R2 is not above R1').toBeLessThan(r1.top);
      expect(l2.left - r.left, 'the left pair is not in the left corner').toBeLessThan(r.width / 4);
      expect(r.right - r2.right, 'the right pair is not in the right corner').toBeLessThan(r.width / 4);
      expect(l2.top - r.top, 'the shoulders are not at the top').toBeLessThan(r.height / 4);
      // wired: L1 holds the key the child mapped to «leftShoulder»
      const antes = new Set(keys);
      toque(botao('L-one'), 'pointerdown');
      expect([...keys].filter((k) => !antes.has(k)), 'the shoulder does nothing').toHaveLength(1);
      toque(botao('L-one'), 'pointerup');
    } finally {
      pad().hidden = true;
      style.remove();
      regiao.style.cssText = '';
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
    // and the game that names no shoulder gets none
    expect(document.querySelectorAll('#touch-controls .touch-ombro'), 'a shoulder nobody named').toHaveLength(0);
  });

  it('🔴 [Right] the four action buttons sit by NUMBER — 1 and 4 on top, 2 and 3 below (ADR-0160)', async () => {
    const { default: css } = await import('../app/css/style.css?raw');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const QUATRO = { action1: { label: 'One' }, action2: { label: 'Two' }, action3: { label: 'Three' }, action4: { label: 'Four' } };
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: QUATRO, setPhase: (p) => fases.push(p) });
    pad().hidden = false;
    try {
      const caixa = (palavra) => botoes().find((b) => funcao(b) === palavra).getBoundingClientRect();
      const [um, dois, tres, quatro] = ['One', 'Two', 'Three', 'Four'].map(caixa);
      expect(um.top, '1 is not above 2').toBeLessThan(dois.top);
      expect(quatro.top, '4 is not above 3').toBeLessThan(tres.top);
      expect(um.left, '1 is not left of 4').toBeLessThan(quatro.left);
      expect(dois.left, '2 is not left of 3').toBeLessThan(tres.left);
      expect(Math.abs(um.top - quatro.top), '1 and 4 are not one row').toBeLessThan(1);
    } finally {
      pad().hidden = true;
      style.remove();
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
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
    const confirmar = botoes().find((b) => funcao(b) === 'Confirm');
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

  it('🔴 [Right] the pad LEAVES when the card opens and COMES BACK in play; the keyboard still moves the card (ADR-0166)', async () => {
    // The Dev: «Ao acessar um menu (via SELECT por exemplo) o controle na tela deve desaparecer para que o usuário controle
    // com cliques ou toques como em uma página de internet. Teclados, controles de video-game […] continuam funcionando.»
    // It undoes ADR-0157's pad over the menus, which this case pinned until 2026-09-12.
    const esperar = () => new Promise((r) => setTimeout(r, 0));
    toque(document.getElementById('game-region'), 'pointerdown');
    expect(pad().hidden, 'the pad was not in view in play — the case would measure nothing').toBe(false);
    motor.pausa.mostrar(0);
    await esperar();
    try {
      expect(pad().hidden, 'the pad stayed over the card').toBe(true);
      // a touch inside the menu does not bring it back over the items
      toque(document.getElementById('game-region'), 'pointerdown');
      expect(pad().hidden, 'a touch in the menu put the pad over it again').toBe(true);
      // the keyboard still drives the card with the pad gone
      const marcado = () => document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act;
      const antes = marcado();
      document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(marcado(), 'the keyboard stopped moving the card').not.toBe(antes);
    } finally {
      motor.pausa.esconder(0);
    }
    await esperar();
    // the arrow above was a KEYBOARD: the child is on the keyboard now, and the pad does not come back on its own
    expect(pad().hidden, 'the pad came back after the child switched to the keyboard').toBe(true);
    // on touch all the way, it does come back
    toque(document.getElementById('game-region'), 'pointerdown');
    motor.pausa.mostrar(0);
    await esperar();
    motor.pausa.esconder(0);
    await esperar();
    expect(pad().hidden, 'back in play, the pad did not come back for a touch-only child').toBe(false);
  });

  it('🔴 [Right] a settings PANEL takes the pad away too, and gives it back when it closes (ADR-0166)', async () => {
    const esperar = () => new Promise((r) => setTimeout(r, 0));
    toque(document.getElementById('game-region'), 'pointerdown');
    const painel = document.querySelector('#game-region .overlay');
    expect(painel, 'no panel mounted — the case would measure nothing').not.toBeNull();
    painel.hidden = false;
    await esperar();
    try {
      expect(pad().hidden, 'the pad stayed over an open panel').toBe(true);
    } finally {
      painel.hidden = true;
    }
    await esperar();
    expect(pad().hidden, 'the panel closed and the pad did not come back').toBe(false);
  });

  it('🔴 [Zero] a cartridge that does NOT ask for the pad gets none — and no pad line in `problems` (ADR-0166)', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    try {
      expect(pad(), 'a pad for a cartridge that never asked for one').toBeNull();
      expect(motor.problems.filter((l) => /pad|preset/.test(l)), 'a pad gap reported for a game without a pad').toEqual([]);
    } finally {
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
    expect(pad(), 'asking again did not bring the pad back').not.toBeNull();
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
    const confirmar = botoes().find((b) => funcao(b) === 'Confirm');
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

  it('🔴 [Right] a tap opens the card, asks the game to pause once — and the pad leaves, the card is touched directly (ADR-0166)', async () => {
    toque(document.getElementById('game-region'), 'pointerdown');
    fases.length = 0;
    document.getElementById('touch-select').click();
    expect(document.getElementById('vp-pause-0').hidden, 'the SELECT pill did not open the menus').toBe(false);
    expect(fases).toEqual(['paused']);
    await new Promise((r) => setTimeout(r, 0));
    expect(pad().hidden, 'the pad stayed over the card').toBe(true);
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

  it('🔴 [Zero] a cartridge with NO on-screen pad is not offered its size — the keyboard rows stay (ADR-0166, ADR-0106 §5)', () => {
    // Found in the dist after ADR-0166: the quiz asks for no pad, and the motor panel still offered «Controller size» — a
    // row with nothing to act on. It is hidden («not offered», ADR-0113 clause 3), not locked: there is no pad to unlock.
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    try {
      const passos = abrirMotora();
      expect(passos.closest('.ctrl-row').hidden, 'the pad size is offered to a game with no pad').toBe(true);
      const visiveis = [...document.querySelectorAll('#motora .ctrl-row')].filter((l) => !l.hidden);
      expect(visiveis.length, 'the keyboard rows went with the pad row').toBeGreaterThan(0);
    } finally {
      fechar();
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: DUAS_ACOES, setPhase: (p) => fases.push(p) });
    }
    // the pair: with the pad asked for, the row is offered again
    expect(abrirMotora().closest('.ctrl-row').hidden, 'the pad size row stayed hidden with a pad').toBe(false);
    fechar();
  });
});

describe('mount() rebuilds the pad for the new cartridge', () => {
  it('🔴 [Zero] without a preset: only SELECT and START, AND `problems` says what is missing (ADR-0162)', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true });
    expect(botoes(), 'a button nobody named').toHaveLength(0);
    expect(document.querySelector('#touch-cross, #touch-stick'), 'a directional nobody named').toBeNull();
    expect(document.getElementById('touch-start'), 'the pause lost its only touch door').not.toBeNull();
    expect(document.getElementById('touch-select')).not.toBeNull();
    expect(motor.problems.some((l) => /the virtual pad shows only SELECT and START/.test(l)), 'the gap was silent').toBe(true);
  });

  it('🎯 [Boundary] a platform preset gets the cross with its arms drawn the way the bindings light them', () => {
    try { localStorage.setItem('incl_paddir', 'cross'); } catch { /* sem storage não há como pedir a cruz */ }
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, controleNaTela: true, preset: PLATAFORMA });
    const cruz = document.getElementById('touch-cross');
    expect(cruz, 'four declared directions and no cross').not.toBeNull();
    // ⚠️ `touch-bindings` lights `.dpad-up` & co. on the cross and the stylesheet draws `.dpad-arm`: an arm
    // with only `.touch-arm` is an unstyled button the finger never sees light up.
    for (const d of ['up', 'down', 'left', 'right']) {
      expect(cruz.querySelector(`.dpad-arm.dpad-${d}`), `arm ${d} without the classes that draw and light it`).not.toBeNull();
    }
    expect(botoes().map(funcao).sort(), 'the platform named two actions').toEqual(['Jump', 'Run']);
    expect(motor.problems.some((l) => /shows only SELECT and START/.test(l)), 'the old cartridge\'s gap outlived it').toBe(false);
  });

  it('🔴 [Right] the rebuilt buttons are WIRED — a mount does not leave dead buttons', () => {
    const pular = botoes().find((b) => funcao(b) === 'Jump');
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

// ---- ADR-0166 (2026-09-12): the pad only on request, and out of the menus ----
//   P1 a pad for every cartridge                       🔴 the quiz case and the [Zero] case
//   P2 `padAllowed` without the menu check              ✅ SURVIVED: both callers already ask `menuAberto()` — the check was removed
//   P3 the observer does not reflect the pad            🔴 four cases
//   P4 the pad never comes back                         🔴 two cases
//   P5 the keyboard does not forget the touch           🔴
//   P6 a panel is not a menu                            🔴 the panel case
//   P7 the quiz menu button opens nothing (quiz tests)  🔴
//   H1 the opening does not re-ask the cartridge for the pad row   🔴 the [Zero] no-pad case
//   H2 the row hidden at mount as well                              ✅ SURVIVED: the opening decides — that line was removed
//   H3 the pad row hidden always                                    🔴 the pair
