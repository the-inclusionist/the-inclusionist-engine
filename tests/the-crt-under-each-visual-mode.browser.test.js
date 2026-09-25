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
/** Picks a simulation in the empathy panel, as a child does, and returns to play. */
function simular(chave) {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
  const sel = document.querySelector('#empathy #opt-simulacao');
  sel.value = chave;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  expect(sel.value, `the list refused ${chave} — the case would measure nothing`).toBe(chave);
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
/** The 🚥 cycle: tricro → protan → deuter → tritan → tricro. */
const CORRECOES = ['fix-protan', 'fix-deuter', 'fix-tritan'];

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
    try {
      expect(jogadores[0].visual?.tema, 'the theme did not reach the game — the case would measure nothing').toBe('hc3');
      expect(scan(), 'the scanlines stayed over high contrast').toBe(false);
      expect(vig(), 'the vignette stayed over high contrast').toBe(false);
    } finally {
      contraste.click(); contraste.click(); contraste.click(); // hc45 → hc7 → padrao
    }
    expect(jogadores[0].visual?.tema).toBe('padrao');
  });

  it('🔴 [Right] the contrast enhancement takes BOTH away', () => {
    motor.lq.set(0.5);
    expect(scan(), 'the scanlines stayed over the contrast enhancement').toBe(false);
    expect(vig(), 'the vignette stayed over the contrast enhancement').toBe(false);
  });
});

// ADR-0241 — the Dev: «Modos de daltonismo estão tirando as scanlines sem necessidade.» A colour-vision mode changes hue,
// not contrast or sharpness: under it ON ITS OWN, the scanline is drawn as stored, and the vignette still yields.
describe('the scanlines stay under the colour-vision modes (ADR-0241)', () => {
  it('🔴 [Right] each 🚥 correction: the scanline drawn, the vignette taken away', () => {
    const cvd = icone('cvd');
    let presses = 0;
    try {
      for (const correcao of CORRECOES) {
        cvd.click(); presses++;
        expect(regiao.style.filter, `${correcao} did not reach the world — the case would measure nothing`).toContain(`cvd-${correcao}`);
        expect(scan(), `the scanlines were taken away by ${correcao}`).toBe(true);
        expect(vig(), `the vignette stayed over ${correcao}`).toBe(false);
      }
    } finally {
      // back to no correction even when a step failed, so no later case inherits it
      for (; presses % 4 !== 0; presses++) cvd.click();
    }
    expect(regiao.style.filter, 'the cycle did not come back to no correction').toBe('');
  });

  for (const simulacao of ['sim-protan', 'sim-deuter', 'sim-tritan']) {
    it(`🔴 [Right] the ${simulacao} simulation: the scanline drawn, the vignette taken away`, () => {
      try {
        simular(simulacao);
        expect(scan(), `the scanlines were taken away by ${simulacao}`).toBe(true);
        expect(vig(), `the vignette stayed over ${simulacao}`).toBe(false);
      } finally { simular('normal'); }
    });
  }

  for (const simulacao of ['lv-blur', 'blind']) {
    it(`🔴 [Right] the ${simulacao} simulation is not a colour-vision mode: BOTH taken away`, () => {
      try {
        simular(simulacao);
        expect(scan(), `the scanlines stayed over ${simulacao}`).toBe(false);
        expect(vig(), `the vignette stayed over ${simulacao}`).toBe(false);
      } finally { simular('normal'); }
    });
  }

  it('🔴 [Right] a correction BESIDE another visual mode is not «on its own»: BOTH taken away', () => {
    const cvd = icone('cvd');
    const contraste = icone('contrast');
    let themePresses = 0;
    cvd.click(); // protan
    try {
      motor.lq.set(0.5);
      expect(scan(), 'the scanlines stayed over a correction plus the contrast enhancement').toBe(false);
      expect(vig()).toBe(false);
      motor.lq.set(0);
      expect(scan(), 'the enhancement left, the correction alone: the scanlines did not come back').toBe(true);
      contraste.click(); themePresses++; // hc3, with the correction still on
      expect(jogadores[0].visual?.correcao, 'the theme erased the correction — the case would measure nothing').toBe('protan');
      expect(scan(), 'the scanlines stayed over a correction plus high contrast').toBe(false);
      expect(vig()).toBe(false);
    } finally {
      for (; themePresses % 4 !== 0; themePresses++) contraste.click(); // back to padrao
      cvd.click(); cvd.click(); cvd.click(); // deuter → tritan → off
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 the root's answer ignores the theme (`hasHighContrast(worldState) ||` removed)          🔴 the 🌗 case
//   T2 the 🌗 writer does not re-apply the CRT (`applyCrt()` removed from it)                 🔴 the 🌗 case
//   T3 the 🌗 writer does not tell the root (`worldState = …tema…` removed)                  🔴 the 🌗 case
//   ADR-0241, each red:
//   M1 the scanline yields to every visual mode again (`scanlineYields: visualModeOn`)       🔴 corrections, simulations
//   M2 the vignette stops yielding under colour modes (it asks the scanline's question)       🔴 corrections, simulations
//   M3 the simulations are not colour-vision modes (only `fix-*` counts)                      🔴 the three simulations
//   M4 every filter counts as colour vision (lv-blur, blind keep the scanline)                🔴 lv-blur, blind
//   M5 the contrast enhancement beside a correction is ignored                                🔴 the «beside» case
//   M6 the high-contrast theme beside a correction is ignored                                 🔴 the «beside» case
//   M7/M8 `render/crt` asks the other effect's question · M9 the vignette asks nothing        🔴 (also crt.browser)
