// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/crt — estética CRT (project BROWSER: usa #game-region, classList, style, localStorage).
// CRT é config MUTÁVEL (o menu ajusta as props) → fixamos CRT.scan/vig/round no teste e checamos as classes CSS.
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, Tier 1, render/crt).
import { describe, it, expect } from 'vitest';
import { CRT, crtScanVars, applyCrt } from '../app/js/render/crt.js';

const region = () => { document.body.innerHTML = '<div id="game-region" style="height:360px"></div>'; return document.querySelector('#game-region'); };

describe('render/crt — applyCrt (classes CSS no #game-region)', () => {
  it('[Right] CRT.scan → classe crt-scan-1 + variável --scan-per definida', () => {
    const g = region();
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(true);
    expect(g.style.getPropertyValue('--scan-per')).not.toBe('');
  });
  it('[Interface] vinheta e cantos: vig=1→crt-vig-1; round=2→crt-round-2; round=1 não gera classe', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 1; CRT.round = 2;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
    expect(g.classList.contains('crt-round-2')).toBe(true);
    expect(g.classList.contains('crt-scan-1')).toBe(false); // scan=0 → sem scanline
  });
  it('[Inverse] tudo desligado (scan/vig 0, round 1) → nenhuma classe crt-*', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect([...g.classList].some((c) => c.startsWith('crt-'))).toBe(false);
  });
});

describe('render/crt — crtScanVars (scanline ancorada em px reais)', () => {
  it('[Interface] define --scan-per e --scan-line quando há scanline', () => {
    const g = region();
    CRT.scan = 1;
    crtScanVars();
    expect(g.style.getPropertyValue('--scan-per')).toMatch(/px$/);
    expect(g.style.getPropertyValue('--scan-line')).toMatch(/px$/);
  });
});
