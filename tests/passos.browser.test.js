// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STEP CONTROL ⯇ ⯈ (ADR-0151) — choosing between named positions with left and right.
//
// The Dev's words: «trocando entre desligado, linear, misto e quadrático da mesma forma que se troca o número de
// jogadores, isto é, apertando botões direita e esquerda, e não através de uma barra». A browser file because the
// promises are about focus, the accessibility tree and a finger on an arrow.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { montarPassos, atualizarPassos, passoSeguinte } from '../app/js/ui/panel-widgets.js';

const ctx = { procurar: (s) => document.querySelector(s), criar: (t) => document.createElement(t) };
const SPEC = { rotulo: 'Rounded corners', valores: ['off', 'small', 'large'], atual: 1 };

beforeEach(() => { document.body.innerHTML = ''; });

describe('passoSeguinte — the next position, held at the ends', () => {
  it('🎯 [Right] one step each way', () => {
    expect(passoSeguinte(1, 3, 1)).toBe(2);
    expect(passoSeguinte(1, 3, -1)).toBe(0);
  });

  it('🔴 [Boundary] the ends are WALLS, not a ring — right from «large» stays «large»', () => {
    // ⚠️ A ring would take whoever is looking for the maximum straight past it and switch the thing off.
    expect(passoSeguinte(2, 3, 1)).toBe(2);
    expect(passoSeguinte(0, 3, -1)).toBe(0);
  });

  it('[Zero] no positions answers 0, and a big delta is still ONE step', () => {
    expect(passoSeguinte(0, 0, 1)).toBe(0);
    expect(passoSeguinte(0, 4, 5)).toBe(1);
  });
});

describe('montarPassos — one focusable control, two finger targets', () => {
  it('🎯 [Right] it says where it is: the written value and the spoken one agree', () => {
    const el = montarPassos(ctx, SPEC);
    document.body.appendChild(el);
    expect(el.getAttribute('role')).toBe('spinbutton');
    expect(el.getAttribute('aria-label')).toBe('Rounded corners');
    expect(el.getAttribute('aria-valuetext')).toBe('small');
    expect(el.querySelector('.passo-valor').textContent).toBe('small');
  });

  it('🔴 [Interface] the arrows are NOT buttons and are hidden from the accessibility tree', () => {
    // The menu navigation treats every `button` as an item: three stops for one setting, two of them nameless.
    const el = montarPassos(ctx, SPEC);
    document.body.appendChild(el);
    expect(el.querySelectorAll('button')).toHaveLength(0);
    for (const s of el.querySelectorAll('[data-passo]')) expect(s.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('🔴 [Right] a finger on an arrow emits `passo` with the direction', () => {
    const el = montarPassos(ctx, SPEC);
    document.body.appendChild(el);
    const vistos = [];
    el.addEventListener('passo', (e) => vistos.push(e.detail));
    el.querySelector('[data-passo="1"]').click();
    el.querySelector('[data-passo="-1"]').click();
    expect(vistos).toEqual([1, -1]);
  });

  it('[Boundary] the arrow of a wall is marked, and it moves with the position', () => {
    const el = montarPassos(ctx, { ...SPEC, atual: 0 });
    document.body.appendChild(el);
    expect(el.querySelector('[data-passo="-1"]').classList.contains('no-limite')).toBe(true);
    expect(el.querySelector('[data-passo="1"]').classList.contains('no-limite')).toBe(false);
    atualizarPassos(el, { ...SPEC, atual: 2 });
    expect(el.querySelector('[data-passo="-1"]').classList.contains('no-limite')).toBe(false);
    expect(el.querySelector('[data-passo="1"]').classList.contains('no-limite')).toBe(true);
    expect(el.getAttribute('aria-valuenow')).toBe('2');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   W1 passoSeguinte wraps around instead of holding           🔴 the walls case
//   W2 the arrows become <button>                              🔴 three stops for one setting
//   W3 atualizarPassos stops writing aria-valuetext            🔴 the eye and the ear disagree
