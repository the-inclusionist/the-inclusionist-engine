// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAGE WITHOUT THE ENGINE'S STYLESHEET IS TOLD SO IN `problems` (study item B4; ADR-0012, the ADR-0148 model).
//
// 📏 Study, 2026-09-12: `createGame` injects no CSS — the quiz page links `css/style.css` itself. A cartridge page without it
// gets unstyled panels, no footer band, no target floor and no focus rings, and no line anywhere said so.
//
// 📌 The check reads a SENTINEL custom property that only the engine's stylesheet declares on `:root`, and it reads it when
// `problems` is read: a stylesheet that finishes loading after boot is not accused.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const daFolha = () => motor.problems.filter((p) => /stylesheet/.test(p));

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status"></p><div id="game-region" tabindex="-1"></div>';
  document.body.appendChild(raiz);
  motor = createGame({ acomodacoes: SEM_ASSUNTO,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    },
    host: { doc: document, win: window },
    downloadHeavy: false,
  });
});

describe('the engine stylesheet', () => {
  it('🔴 [Zero] without it, `problems` names what is missing and how to link it', () => {
    const linhas = daFolha();
    expect(linhas, 'a page without the engine stylesheet was not told').toHaveLength(1);
    expect(linhas[0]).toMatch(/\/style\.css/);
  });

  it('🎯 [Right] once it is on the page — even after boot — the line is gone', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    try {
      expect(daFolha(), 'the engine stylesheet is there and the line stayed').toEqual([]);
    } finally {
      style.remove();
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   B1 the sentinel removed from `style.css`          🔴 the stylesheet-present case
//   B2 the check left out of `problems`               🔴 the missing-stylesheet case
//   (the sentinel was first named `--incl-folha-da-engine`: the pilar-3 raw-text gate read «da» as Portuguese prose)
