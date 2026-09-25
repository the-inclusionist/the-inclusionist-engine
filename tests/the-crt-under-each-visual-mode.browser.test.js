// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DECORATIVE CRT UNDER EACH VISUAL MODE, measured under `createGame` (ADR-0047).
//
// The stored CRT here has BOTH effects on — scanlines and vignette — so every case can tell which of the two yielded.
// The root owns the answer to «which visual modes are on»; `render/crt` only draws what that answer lets it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { memoryBackend } from '../app/js/platform/storage.js';
import { DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';

let motor;
let regiao;
/** The game's one player; its 🌗 writer keeps the theme on her, as a game that draws its own high contrast does. */
const jogadores = [{ ctrl: 0 }];
const scan = () => regiao.classList.contains('crt-scan-1');
const vig = () => regiao.classList.contains('crt-vig-1');
const icone = (k) => {
  const b = document.querySelector(`#title-icons [data-pi="${k}"]`);
  expect(b, `no ${k} icon — the case would measure nothing`).not.toBeNull();
  return b;
};

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div class="stage-wrap" style="width:700px;height:420px;display:flex">'
    + '<div id="game-region" tabindex="-1"><div id="title-icons"></div></div></div>';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(svg);
  regiao = document.getElementById('game-region');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
      objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
    },
    players: jogadores,
    setPlayerTheme: (i, tema) => { jogadores[i].visual = { ...(jogadores[i].visual ?? DEFAULT_VISUAL), tema }; },
    // a store of this file's own, holding a CRT with BOTH effects on
    host: { doc: document, win: window, cvdHost: svg,
      storage: memoryBackend([['incl_crt2', JSON.stringify({ scan: 1, vig: 1, round: 1 })]]) },
    downloadHeavy: false,
  });
});

afterEach(() => {
  motor.lq.set(0);
  // every case leaves the page with no visual mode, and proves it: the next one starts from the stored CRT
  expect([scan(), vig()], 'a case left a visual mode on').toEqual([true, true]);
});

describe('the CRT under createGame, mode by mode', () => {
  it('🔴 [Right] with no visual mode, both effects are drawn as stored', () => {
    expect(motor.crt.cfg, 'the stored CRT was not read').toMatchObject({ scan: 1, vig: 1 });
    expect(scan(), 'the stored scanlines are missing').toBe(true);
    expect(vig(), 'the stored vignette is missing').toBe(true);
  });

  it('🔴 [Right] the game\'s 🌗 high-contrast theme takes BOTH away, and the way back gives them back', () => {
    const contraste = icone('contrast');
    contraste.click(); // padrao → hc3
    expect(jogadores[0].visual?.tema, 'the theme did not reach the game — the case would measure nothing').toBe('hc3');
    expect(scan(), 'the scanlines stayed over high contrast').toBe(false);
    expect(vig(), 'the vignette stayed over high contrast').toBe(false);
    contraste.click(); contraste.click(); contraste.click(); // hc45 → hc7 → padrao
    expect(jogadores[0].visual?.tema).toBe('padrao');
  });

  it('🔴 [Right] the contrast enhancement takes BOTH away', () => {
    motor.lq.set(0.5);
    expect(scan(), 'the scanlines stayed over the contrast enhancement').toBe(false);
    expect(vig(), 'the vignette stayed over the contrast enhancement').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 the root's answer ignores the theme (`hasHighContrast(worldState) ||` removed)          🔴 the 🌗 case
//   T2 the 🌗 writer does not re-apply the CRT (`applyCrt()` removed from it)                 🔴 the 🌗 case
//   T3 the 🌗 writer does not tell the root (`worldState = …tema…` removed)                  🔴 the 🌗 case
