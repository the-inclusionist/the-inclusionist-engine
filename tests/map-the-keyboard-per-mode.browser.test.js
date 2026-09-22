// SPDX-License-Identifier: AGPL-3.0-or-later
// MAPPING THE KEYBOARD FOR 1, 2 AND 3–4 PLAYERS, from the motor panel (ADR-0151 §2 item 5 and its erratum).
//
// 📌 A BROWSER FILE, AND ONE ROOT: `createGame` hangs listeners on `window` and nothing removes them, so the root is
// born once and cartridges are swapped with `mount()` (ADR-0142), as in the other boot files.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const CKEY = 'inclusionist.kbcontrols.v3';
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, seguraTeclas: () => false,
  tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});
const DUAS_ACOES = { action1: { label: 'Confirm' }, action2: { label: 'Back' } };
const COM_OMBRO = { action1: { label: 'Confirm' }, leftShoulder: { label: 'Previous' } };

const linha = (modo) => document.getElementById(`opt-teclado-${modo}`)?.closest('.ctrl-row');
function abrirMotora() {
  motor.pausa.mostrar(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="motora"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pausa.esconder(0);
}
function tecla(code) {
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  document.getElementById('game-region').dispatchEvent(ev);
  return ev;
}
const salvo = () => JSON.parse(localStorage.getItem(CKEY) ?? 'null');

beforeAll(async () => {
  try { localStorage.removeItem(CKEY); } catch { /* sem storage */ }
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, preset: DUAS_ACOES });
});
beforeEach(() => { fecharTudo(); });

describe('the three rows in the motor panel', () => {
  it('🎯 [Right] a preset with no shoulders offers all three: 1, 2 and 3–4 players', () => {
    abrirMotora();
    for (const m of [1, 2, 4]) expect(linha(m)?.hidden, `the row for mode ${m} is missing or hidden`).toBe(false);
  });

  it('🔴 [Zero] a preset that names a shoulder or trigger does NOT get the 3–4 row — and keeps 1 and 2', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: COM_OMBRO });
    try {
      abrirMotora();
      expect(linha(4).hidden, 'four keyboard schemes offered to a game that uses a shoulder position').toBe(true);
      expect(linha(1).hidden).toBe(false);
      expect(linha(2).hidden).toBe(false);
    } finally {
      fecharTudo();
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES });
    }
  });

  it('🔴 [Zero] a game with no preset has nothing to map — the three rows are absent', () => {
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO });
    try {
      abrirMotora();
      for (const m of [1, 2, 4]) expect(linha(m).hidden, `mode ${m} offered with no action to map`).toBe(true);
    } finally {
      fecharTudo();
      motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, preset: DUAS_ACOES });
    }
  });
});

describe('the mapping panel, in the mode of the row that opened it', () => {
  it('🎯 [Right] «2 players» opens with the seat step and the game\'s own words, one row per action', () => {
    abrirMotora();
    document.getElementById('opt-teclado-2').click();
    expect(document.getElementById('ctrl').hidden, 'the mapping panel did not open').toBe(false);
    const assento = document.getElementById('ctrl-assento');
    expect(assento.closest('.ctrl-row').hidden, 'no seat step in a two-player mode').toBe(false);
    expect(assento.querySelector('.passo-valor').textContent).toBe('Teclado de: Jogador 1');
    const nomes = [...document.querySelectorAll('#ctrl-list .ctrl-nome')].map((n) => n.textContent);
    expect(nomes).toEqual(['Confirm', 'Back']);
  });

  it('🔴 [Right] a capture on SEAT 2 of the two-player mode writes p2[1] — and the key goes nowhere else', () => {
    abrirMotora();
    document.getElementById('opt-teclado-2').click();
    document.getElementById('ctrl-assento').querySelector('[data-passo="1"]').click();
    const alterar = document.querySelector('#ctrl-list button[data-act="action1"]');
    alterar.focus();
    alterar.click();
    // ⚠️ AN ARROW WHILE CAPTURING stays with the capture: with `isCapturing` answering false the menu navigation
    // moves the cursor away from the row the child is recording. (The arrow itself is refused — another seat owns it.)
    tecla('ArrowDown');
    expect(document.activeElement, 'the arrow navigated the menu in the middle of a capture').toBe(alterar);
    // a free key is recorded
    const ev = tecla('Digit3');
    expect(ev.defaultPrevented).toBe(true);
    expect(salvo()?.p2?.[1]?.action1, 'seat 2 of the two-player keyboard did not get the key').toEqual(['Digit3']);
    expect(salvo()?.solo?.action1, 'the one-player keyboard changed too').not.toEqual(['Digit3']);
  });

  it('🔴 [Right] «3–4» is ONE keyboard: a capture on seat 1 of four is followed by seat 1 of three', () => {
    abrirMotora();
    document.getElementById('opt-teclado-4').click();
    expect(document.querySelector('#ctrl .overlay__title, #ctrl h2')?.textContent ?? '').toMatch(/3–4/);
    document.querySelector('#ctrl-list button[data-act="action2"]').click();
    tecla('Digit4');
    expect(salvo()?.p4?.[0]?.action2).toEqual(['Digit4']);
    expect(salvo()?.p3?.[0]?.action2, 'the three-player keyboard kept the old key').toEqual(['Digit4']);
  });

  it('🔴 [Right] «restore» resets THIS mode only — the two-player keyboard does not undo the four', () => {
    abrirMotora();
    document.getElementById('opt-teclado-2').click();
    document.getElementById('ctrl-reset').click();
    expect(salvo()?.p2?.[1]?.action1, 'the two-player reset did not reset its own seat').not.toEqual(['Digit3']);
    expect(salvo()?.p4?.[0]?.action2, 'the two-player reset wiped the four-player keyboard').toEqual(['Digit4']);
    try { localStorage.removeItem(CKEY); } catch { /* idem */ }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 the 3–4 row ignores the shoulders                   🔴 four schemes for a shoulder game
//   T2 isCapturing stays () => false                        🔴 the arrow is navigated, not recorded
//   T3 kbFor answers the live match, not the mode           🔴 seat 2 of two writes the solo scheme
//   T4 the three-player sync is dropped                     🔴 3–4 is two keyboards
//   T5 restore resets the whole keyboard                    🔴 the four-player keys are wiped
