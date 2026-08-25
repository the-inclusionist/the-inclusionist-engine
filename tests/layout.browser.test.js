// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/layout — escala do #game-region (project BROWSER: usa #stage-wrap/#game-region + devicePixelRatio).
// Padrões: ZOMBIES + Right-BICEP. VLibras fechado por padrão (librasOpen=false). Ver docs/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { layout } from '../app/js/ui/layout.js';

const setup = (w = 1280, h = 720) => { document.body.innerHTML = `<div id="stage-wrap" style="width:${w}px;height:${h}px"><div id="game-region"></div></div>`; };

describe('ui/layout — escala do #game-region', () => {
  it('[Right] escala o canvas e seta as vars de UI (--ui-fs/--tap/--hud-fs) em px', () => {
    setup();
    layout();
    const gr = document.querySelector('#game-region');
    expect(parseFloat(gr.style.width)).toBeGreaterThan(0);
    expect(gr.style.height).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--ui-fs')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--tap')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--hud-fs')).toMatch(/px$/);
  });
  it('[Cross-check] 1 jogador (base 320) com piso k≥2 → largura ≥ 640 (viewport mín. do Chromebook)', () => {
    setup(1280, 720);
    layout();
    expect(parseFloat(document.querySelector('#game-region').style.width)).toBeGreaterThanOrEqual(640);
  });
  it('[Zero/Robustez] sem #stage-wrap → early return, não quebra', () => {
    document.body.innerHTML = '';
    expect(() => layout()).not.toThrow();
  });
  it('[Interface] VLibras fechado (padrão) → sem reserva à direita (paddingRight 0)', () => {
    setup();
    layout();
    expect(document.querySelector('#stage-wrap').style.paddingRight).toBe('0px');
  });
});
