// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/webcam — jogar com os olhos (project BROWSER: usa DOM + KeyboardEvent). Padrões: ZOMBIES + Right-BICEP.
// WebGazer é lib externa (não existe no teste) → checamos os fallbacks + o mapeamento olhar→tecla (onGaze).
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, Tier 1, ui/webcam).
import { describe, it, expect } from 'vitest';
import * as W from '../app/js/ui/webcam.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const noWebGazer = () => { delete window.webgazer; };

describe('ui/webcam — eyeMode', () => {
  it('[Interface] setEyeMode alterna o modo', () => {
    W.setEyeMode(true); expect(W.eyeMode).toBe(true);
    W.setEyeMode(false); expect(W.eyeMode).toBe(false);
  });
});

describe('ui/webcam — carga/parada sem o WebGazer', () => {
  it('[Robustez] startEyeControl sem WebGazer avisa via srAlert (não lança)', async () => {
    noWebGazer(); document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    expect(() => W.startEyeControl()).not.toThrow();
    await nextFrame();
    expect(document.querySelector('#sr-alert').textContent).toMatch(/WebGazer/i);
  });
  it('[Robustez] stopEyeControl sem WebGazer não lança', () => {
    noWebGazer();
    expect(() => W.stopEyeControl()).not.toThrow();
  });
  it('[Interface] loadWebGazer sem WebGazer NÃO injeta o <script> do CDN — ele vem da cache verificada (#169)', () => {
    noWebGazer(); document.querySelectorAll('script[src*="webgazer"]').forEach((s) => s.remove());
    W.loadWebGazer();
    expect(document.querySelector('script[src*="webgazer"]')).toBeNull();
  });
});

describe('ui/webcam — onGaze (olhar → tecla sintética)', () => {
  it('[Right] olhar à ESQUERDA (x baixo) dispara keydown KeyA', () => {
    document.body.innerHTML = '<div id="game-region" style="position:fixed;left:0;top:0;width:1000px;height:500px"></div>';
    W.stopEyeControl(); W.setEyeMode(true); // reseta o estado das teclas
    const codes = []; const h = (e) => codes.push(e.code);
    window.addEventListener('keydown', h);
    W.onGaze({ x: 100, y: 250 }); // fx=0.1 < 0.4 → esquerda → KeyA
    window.removeEventListener('keydown', h);
    expect(codes).toContain('KeyA');
  });
  it('[Right] olhar p/ CIMA (y baixo) dispara keydown Space (pular)', () => {
    document.body.innerHTML = '<div id="game-region" style="position:fixed;left:0;top:0;width:1000px;height:500px"></div>';
    W.stopEyeControl(); W.setEyeMode(true);
    const codes = []; const h = (e) => codes.push(e.code);
    window.addEventListener('keydown', h);
    W.onGaze({ x: 500, y: 50 }); // fy=0.1 < 0.28 → cima → Space; fx=0.5 (centro) → sem A/D
    window.removeEventListener('keydown', h);
    expect(codes).toContain('Space');
    expect(codes).not.toContain('KeyA');
  });
  it('[Zero] com eyeMode desligado, onGaze não faz nada', () => {
    document.body.innerHTML = '<div id="game-region" style="position:fixed;left:0;top:0;width:1000px;height:500px"></div>';
    W.stopEyeControl(); W.setEyeMode(false);
    const codes = []; const h = (e) => codes.push(e.code);
    window.addEventListener('keydown', h);
    W.onGaze({ x: 100, y: 250 });
    window.removeEventListener('keydown', h);
    expect(codes).toEqual([]);
  });
});
