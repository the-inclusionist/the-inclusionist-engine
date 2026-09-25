// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VIRTUAL CONTROLLER, DRAWN FROM WHAT THE GAME DECLARES — the gate of ADR-0143.
//
// ========================= WHY THESE CASES ARE BROWSER ONES =========================
// The rule inherited from `boot-create-game.browser.test.js`: a case only enters here if the fake DOM could not do it.
// What is asked is whether the node really is in the tree, whether `dataset.btn` survives being read as
// `'b' + dataset.btn` — which is what `touch-bindings` does —, and whether mounting twice leaves one pad.
//
// 🔴 AND ONE CASE EXISTS BECAUSE THE RECORD ITSELF WARNED IT PASSES BY ACCIDENT. ADR-0143 writes it: «hoje o pad já está
// ausente e já está calado, então um caso que afirme só a ausência continua verde com nada construído». The empty `preset`
// case requires BOTH halves — the markup absent AND the line present.
//
// MUTATIONS CHECKED at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import { mountTouchControls, touchGaps } from '../app/js/input/touch.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';

const ctx = {
  t: translate, // the root's translator, played by the test (ADR-0232 D3)
  find: (s) => document.querySelector(s),
  create: (t) => document.createElement(t),
};

let hospedeiro;
beforeEach(() => {
  hospedeiro = document.createElement('div');
  document.body.appendChild(hospedeiro);
});
afterEach(() => { hospedeiro.remove(); });

const montar = (acoes, extra = {}) => {
  const raiz = mountTouchControls(ctx, {
    map: TOUCH_DEFAULT,
    gameActions: new Set(acoes),
    slotLabel: (s) => 'rótulo de ' + s,
    ...extra,
  });
  hospedeiro.appendChild(raiz);
  return raiz;
};

// The actions the platform game declares, and the ones a quiz declares. They are the two extremes the record uses to
// decide the shape.
const OITO_ACOES = ['up', 'down', 'left', 'right', 'action1', 'action2', 'action3', 'action4'];
const DUAS_ACOES = ['action1', 'action2'];

describe('ADR-0143 · a FORMA vem do que o jogo declara', () => {
  it('🎯 [Right] o platformer recebe as quatro direções e os quatro botões', () => {
    const raiz = montar(OITO_ACOES);
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(4);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
  });

  it('🔴 [Right] duas acções e nenhuma direção: DOIS botões e NENHUM braço (ADR-0162)', () => {
    // ADR-0157 gave every game the minimum (directions and four buttons); the Dev: «Vale para todos os botões: somente
    // aparecem se o jogo os nomeia.»
    const raiz = montar(DUAS_ACOES, { dpad: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm'), 'um braço que o jogo não nomeou').toHaveLength(0);
    expect(raiz.querySelector('#touch-cross'), 'uma cruz sem braço nenhum').toBeNull();
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(2);
  });

  it('🔴 [Right] the FACE shows the button\'s NAME, never the cartridge\'s word; the accessible name holds both (ADR-0165)', () => {
    // The Dev: «Botões 2 e 3 devem continuar sendo 2 e 3, confirm e back não são seus nomes, mas suas funções atribuídas
    // pelo cartucho.» Measured before: the quiz's pad wrote «Confirm» and «Back» on the faces of 2 and 3.
    const slotDe = (acao) => Object.keys(TOUCH_DEFAULT).find((s) => TOUCH_DEFAULT[s] === acao);
    const FUNCOES = { action2: 'Confirm', action3: 'Back', leftShoulder: 'Page', up: 'Climb' };
    const raiz = mountTouchControls(ctx, {
      map: TOUCH_DEFAULT,
      gameActions: new Set(Object.keys(FUNCOES)),
      slotLabel: (s) => FUNCOES[TOUCH_DEFAULT[s]] ?? (s === 'start' ? 'START' : s === 'select' ? 'SELECT' : ''),
      dpad: 'cruz',
    });
    hospedeiro.appendChild(raiz);
    const botao = (acao) => raiz.querySelector(`[data-btn="${slotDe(acao).slice(1)}"]`);
    expect(botao('action2').textContent, 'the face shows the function').toBe('2');
    expect(botao('action3').textContent).toBe('3');
    expect(botao('leftShoulder').textContent).toBe('L1');
    expect(botao('action2').getAttribute('aria-label')).toBe('2, Confirm');
    expect(botao('leftShoulder').getAttribute('aria-label')).toBe('L1, Page');
    expect(botao('action2').dataset.acao, 'the button does not say which action places it').toBe('action2');
    // a direction keeps its direction name (in the language of the moment) and says its function after it
    expect(raiz.querySelector('.dpad-up').getAttribute('aria-label')).toMatch(/^Cima, Climb$/);
    // SELECT and START: name and function are the same word, said once
    expect(raiz.querySelector('#touch-start').textContent).toBe('START');
    expect(raiz.querySelector('#touch-start').getAttribute('aria-label')).toBe('START');
    expect(raiz.textContent, 'a function word reached a face').not.toMatch(/Confirm|Back|Page/);
  });

  it('⚠️ [Right] a REMAPPED slot takes the name of the action it now fires — the name follows the place', () => {
    const slot = Object.keys(TOUCH_DEFAULT).find((s) => TOUCH_DEFAULT[s] === 'action2');
    const raiz = montar(['action4'], { map: { ...TOUCH_DEFAULT, [slot]: 'action4' } });
    expect([...raiz.querySelectorAll('.touch-btn[data-btn]')].map((b) => b.textContent)).toContain('4');
  });

  it('⚠️ [Interface] `data-btn` casa com o `\'b\' + dataset.btn` que o `touch-bindings` recompõe', () => {
    // A double would accept any string here. What is measured is the round trip: what the markup writes has to be what the
    // dispatch reads, or the button fires `undefined` — with no error, and doing nothing.
    const raiz = montar(OITO_ACOES);
    for (const b of raiz.querySelectorAll('.touch-btn[data-btn]')) {
      const slot = 'b' + b.dataset.btn;
      expect(TOUCH_DEFAULT[slot], `o slot ${slot} não existe no mapa`).toBeTruthy();
    }
  });

  it('🔴 [Right] o START é INCONDICIONAL — a pausa não é declinável (ADR-0122)', () => {
    // The other eight slots answer to what the game declares; this one answers to a decision already taken. A child with a
    // tablet and no keyboard has no other way to reach the pause.
    expect(montar([]).querySelector('#touch-start'), 'um jogo sem acções ficou sem pausa alcançável')
      .not.toBeNull();
    expect(montar(DUAS_ACOES).querySelector('#touch-start')).not.toBeNull();
  });

  it('⚠️ [Right] nasce ESCONDIDO — a alternância por modalidade é do `touch-bindings`', () => {
    // «toque/clique MOSTRA; teclado/controle OCULTA». A pad born in sight covers the game of whoever will never touch it.
    expect(montar(OITO_ACOES).hidden).toBe(true);
  });

  it('⚠️ [Right] o analógico traz a `.touch-knob`, sem a qual o `touch-bindings` desiste dele', () => {
    // `if (stick && knob)` — without the knob, the whole stick is left with no listener, in silence.
    const raiz = montar(OITO_ACOES, { dpad: 'analogico' });
    const stick = raiz.querySelector('#touch-stick');
    expect(stick, 'o analógico não foi montado').not.toBeNull();
    expect(stick.querySelector('.touch-knob'), 'o analógico veio sem manopla e fica sem escuta').not.toBeNull();
    expect(raiz.querySelector('#touch-cross'), 'montou os dois direcionais ao mesmo tempo').toBeNull();
    // the BASE is what the stylesheet draws (`.touch-stick`): with the id alone the knob moves inside a circle nobody sees
    expect(stick.classList.contains('touch-stick'), 'the stick\'s base is not drawn').toBe(true);
  });

  it('🔴 [Right] the pad READS in a controller\'s order: directions, buttons, shoulders, then SELECT and START', () => {
    // The document order is the order a screen reader and Tab walk the pad (WCAG 2.4.3), whatever the stylesheet puts where.
    const raiz = montar([...OITO_ACOES, 'leftShoulder', 'rightShoulder'], { dpad: 'cruz' });
    expect([...raiz.children].map((el) => el.className.split(' ')[0]))
      .toEqual(['touch-cross', 'touch-pad', 'touch-ombros', 'touch-ombros', 'touch-sistema']);
  });

  it('🔴 [Right] no button box where the game names no button, and no corner where it names no shoulder', () => {
    // An empty box on the screen is a promise with nothing in it — the ADR-0162 rule, for the containers as well as the keys.
    const raiz = montar(['up', 'down', 'left', 'right'], { dpad: 'cruz' });
    expect(raiz.querySelector('.touch-pad'), 'an empty button box is drawn').toBeNull();
    expect(raiz.querySelectorAll('.touch-ombros'), 'an empty shoulder corner is drawn').toHaveLength(0);
  });

  it('⚠️ [Zero] montar DUAS vezes deixa UM pad', () => {
    montar(OITO_ACOES);
    montar(OITO_ACOES);
    expect(document.querySelectorAll('#touch-controls')).toHaveLength(1);
    expect(document.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(4);
  });
});

describe('ADR-0143 §4 · o silêncio acaba', () => {
  it('🔴 [Zero] sem `preset`: só SELECT e START, E a linha diz o que falta (ADR-0162)', () => {
    const raiz = montar([], { dpad: 'cruz' });
    expect(raiz.querySelectorAll('.touch-arm')).toHaveLength(0);
    expect(raiz.querySelectorAll('.touch-btn[data-btn]')).toHaveLength(0);
    expect(raiz.querySelector('#touch-start')).not.toBeNull();
    const linhas = touchGaps({ map: TOUCH_DEFAULT, gameActions: new Set() });
    expect(linhas).toHaveLength(1);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/preset/);
    expect(linhas[0], 'a linha não diz o que a criança perde').toMatch(/tablet/);
  });

  it('🎯 [Zero] com o preset do platformer, `problems` não inventa lacuna nenhuma', () => {
    // The pair of the case above. Without it, the sieve would approve an engine that always accuses — as useless as one
    // that never does.
    expect(touchGaps({ map: TOUCH_DEFAULT, gameActions: new Set(OITO_ACOES) })).toEqual([]);
  });

  it('🔴 [Boundary] uma acção declarada que NENHUM slot dispara também vira linha', () => {
    // ⚠️ The PARTIAL gap, which appears nowhere else: the action exists on the keyboard and not on touch. Whoever plays by
    // touch simply does not have it, and nobody tells them.
    const linhas = touchGaps({
      map: TOUCH_DEFAULT,
      // ⚠️ `select` and not `leftShoulder`: since ADR-0160 the shoulders HAVE a slot, and the example would stop being one
      gameActions: new Set(['action1', 'select']),
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatch(/select/);
    expect(linhas[0], 'a linha não nomeia a saída').toMatch(/remap a slot/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   N1 the face shows the function again (ADR-0165)       🔴 name and remap cases
//   N2 the accessible name is the name only               🔴
//   N3 L1 and L2 swapped                                   🔴
//   N4 directions without a spoken name                   🔴
//   N5 the name read from the slot, not the action it fires 🔴
//
// PROBED AGAIN (2026-09-23), twenty-seven decisions of `mountTouchControls` disabled one at a time against the nine files that
// draw or drive the pad — `scratchpad/sonda-pad.py`. Five were green:
//   · the analog base's class, which is what the stylesheet draws  → «o analógico traz a `.touch-knob`…» (last assertion)
//   · an empty button box, and an empty shoulder corner              → «no button box where the game names no button…»
//   · the arm's `data-dir` — 📏 NO reader in the engine, its stylesheet or any of the seven games (the 2048 writes its own on
//     its own buttons): an inert write, and it left in the cut instead of being pinned.
//   · 📏 EQUIVALENT, and declared: a drawn slot whose position has no name falls back to the game's word — no drawn slot can
//     reach it today, since every action in the catalogue has a position name; it is the fallback for one added without.
// RE-PROBED IN THE NEW SHAPE (a function per part — `scratchpad/sonda-pad-3.py`): 26 of 26 red, with «the pad READS in a
// controller's order», added with the cut and green on the old shape too: the order of the parts had no case in either shape,
// and it is the order a screen reader and Tab walk the pad.
