// SPDX-License-Identifier: AGPL-3.0-or-later
// THE STORED CRT IS APPLIED AT BOOT, YIELDS TO EVERY VISUAL ACCESSIBILITY MODE, AND ITS SCANLINES FOLLOW THE SCALE.
// (study items A5 and B1; ADR-0020, ADR-0047, ADR-0001)
//
// 📏 Measured in dist/quiz.html (study, 2026-09-12): the «Visual sensitivity» panel said «Scanlines: on» and the region had
// no CRT class until a toggle was pressed — `createGame` never ran `render/crt`, so the yield rule had nothing to act on,
// and `crtScanVars` (the scanline period in REAL pixels) only ran inside `ui/layout.layout()`, which this root does not run.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let regiao;
let palco;

beforeAll(async () => {
  // the platform default: scanlines on
  try { localStorage.setItem('incl_crt2', JSON.stringify({ scan: 1, vig: 0, round: 1 })); } catch { /* sem storage */ }
  const { createGame } = await import('../app/js/boot/create-game.js');
  palco = document.createElement('div');
  palco.className = 'stage-wrap';
  palco.style.cssText = 'width:700px;height:420px;display:flex';
  palco.innerHTML = '<div id="game-region" tabindex="-1"><div id="title-icons"></div></div>';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.append(Object.assign(document.createElement('p'), { id: 'sr-status' }), palco, svg);
  regiao = palco.querySelector('#game-region');
  createGame({ acomodacoes: SEM_ASSUNTO,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    },
    host: { doc: document, win: window, cvdHost: svg },
    downloadHeavy: false,
  });
});

describe('the CRT under createGame', () => {
  it('🔴 [Right] the stored scanlines are ON at boot, with their period set in real pixels', () => {
    expect(regiao.classList.contains('crt-scan-1'), 'the stored scanlines were not applied at boot').toBe(true);
    expect(regiao.style.getPropertyValue('--scan-per'), 'no scanline period').toMatch(/px$/);
  });

  it('🔴 [Right] the period follows the scale the engine applies — one line per art pixel', () => {
    palco.style.width = '1300px';
    palco.style.height = '760px';
    window.dispatchEvent(new Event('resize'));
    const dpr = window.devicePixelRatio || 1;
    const k = regiao.getBoundingClientRect().height / 180;
    expect(Math.round(k), 'the region did not grow — the case would compare the same scale').toBe(4);
    expect(parseFloat(regiao.style.getPropertyValue('--scan-per')) * dpr).toBeCloseTo(Math.round(k * dpr), 5);
    palco.style.width = '700px';
    palco.style.height = '420px';
    window.dispatchEvent(new Event('resize'));
  });

  it('🔴 [Right] a colour correction switched ON takes the CRT away, and OFF gives it back (ADR-0047)', () => {
    const cvd = document.querySelector('#title-icons [data-pi="cvd"]');
    expect(cvd, 'no 🚥 icon — the case would measure nothing').not.toBeNull();
    cvd.click(); // protan correction
    expect(regiao.classList.contains('crt-scan-1'), 'the scanlines stayed over a correction').toBe(false);
    // the cycle: protan → deuter → tritan → off
    cvd.click(); cvd.click(); cvd.click();
    expect(regiao.style.filter, 'the cycle did not come back to no correction').toBe('');
    expect(regiao.classList.contains('crt-scan-1'), 'the scanlines did not come back after the correction').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C1 the stored CRT not applied at boot                 🔴
//   C2 the CRT does not follow the world filter          🔴 the correction case
//   C3 the scanlines not re-anchored on a new scale      🔴 the period case
//   C4 a colour correction does not count as a visual mode 🔴 the correction case
