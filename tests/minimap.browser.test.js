// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/minimap — fog-of-war + visibilidade (project BROWSER: usa PIXI real). Padrões: ZOMBIES + Right-BICEP.
// PIXI global vem do setup (mesma instância npm do módulo). Colisão inicializada p/ o tileAt do redraw.
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, Tier 1, render/minimap).
import { describe, it, expect } from 'vitest';
import * as MM from '../app/js/render/minimap.js';
import * as COL from '../app/js/core/collision.js';

const W = 40, H = 40;
const fakeWorld = Array.from({ length: H }, () => new Array(W).fill(0));
const initAll = () => {
  COL.initCollision({ world: fakeWorld, W, H, isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1, wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true });
  MM.initMinimap(new PIXI.Container(), W, H); // eslint-disable-line no-undef — PIXI é global no setup
};

describe('render/minimap — fog-of-war (markSeen/minimapSeenCount/resetMinimap)', () => {
  it('[Zero] recém-criado: nada visto', () => {
    initAll();
    expect(MM.minimapSeenCount()).toBe(0);
  });
  it('[Right] markSeen revela tiles na janela da câmera; [Idempotente] revelar de novo não soma', () => {
    initAll();
    MM.markSeen(0, 0);
    const n = MM.minimapSeenCount();
    expect(n).toBeGreaterThan(0);
    MM.markSeen(0, 0);
    expect(MM.minimapSeenCount()).toBe(n); // já visto → idempotente
  });
  it('[Inverse] resetMinimap zera o fog (fim de fase)', () => {
    initAll();
    MM.markSeen(0, 0);
    expect(MM.minimapSeenCount()).toBeGreaterThan(0);
    MM.resetMinimap();
    expect(MM.minimapSeenCount()).toBe(0);
  });
});

describe('render/minimap — visibilidade + redraw', () => {
  it('[Interface] setMinimapVisible alterna a visibilidade do container', () => {
    initAll();
    MM.setMinimapVisible(false); expect(MM.getMinimap().visible).toBe(false);
    MM.setMinimapVisible(true); expect(MM.getMinimap().visible).toBe(true);
  });
  it('[Robustez] redrawMinimapIfDirty + drawMinimapPlayer não lançam (com colisão ligada)', () => {
    initAll();
    MM.markSeen(0, 0);
    expect(() => { MM.redrawMinimapIfDirty(); MM.drawMinimapPlayer(100, 100); }).not.toThrow();
  });
});
