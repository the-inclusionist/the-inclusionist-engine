// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/title (navegação pura entre submenus) e render/title-scene (geometria da cena PIXI do título) —
// project NODE: sem document/PIXI reais, só a lógica + camadas falsas injetadas (padrão de scene-sky-decor).
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4).
import { describe, it, expect } from 'vitest';
import { TITLE_MENU_IDS, isTitleMenuId, computeTitleMenuView } from '../app/js/ui/title.js';
import {
  TITLE_CLOUDS, titleHorizonY, titleSkyRowColor, titleCloudDriftOffset, titleCloudX, titleGrassRows,
  createTitleScene,
} from '../app/js/render/title-scene.js';
import { cloudWrapX } from '../app/js/render/scene-sky.js';

// ===================== ui/title — máquina de estados (navegação) =====================

describe('ui/title · TITLE_MENU_IDS / isTitleMenuId', () => {
  it('[Interface] os 6 submenus do título, na ordem histórica do game.js', () => {
    expect([...TITLE_MENU_IDS]).toEqual(['tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen']);
  });

  it('[Boundary] isTitleMenuId aceita só os 6 ids conhecidos', () => {
    expect(isTitleMenuId('tm-fr')).toBe(true);
    expect(isTitleMenuId('tm-inexistente')).toBe(false);
    expect(isTitleMenuId('')).toBe(false);
  });
});

describe('ui/title · computeTitleMenuView', () => {
  it('[Happy] tm-main: só ele fica visível; legenda visível; bloco de título visível', () => {
    const v = computeTitleMenuView('tm-main');
    expect(v.active).toBe('tm-main');
    expect(v.hidden.get('tm-main')).toBe(false);
    expect(v.hidden.get('tm-alf')).toBe(true);
    expect(v.hidden.get('tm-mat')).toBe(true);
    expect(v.hidden.get('tm-tab')).toBe(true);
    expect(v.hidden.get('tm-fr')).toBe(true);
    expect(v.hidden.get('tm-cen')).toBe(true);
    expect(v.legendHidden).toBe(false);
    expect(v.titleBlockDisplay).toBe('');
  });

  it('[Interface] tm-cen: só ele visível; legenda ESCONDIDA; bloco de título escondido (submenu tem o próprio tm-title)', () => {
    const v = computeTitleMenuView('tm-cen');
    expect(v.hidden.get('tm-cen')).toBe(false);
    expect(v.hidden.get('tm-main')).toBe(true);
    expect(v.legendHidden).toBe(true);
    expect(v.titleBlockDisplay).toBe('none');
  });

  it('[Boundary] cada submenu, por sua vez, é o único NÃO escondido (exclusão mútua total)', () => {
    for (const id of TITLE_MENU_IDS) {
      const v = computeTitleMenuView(id);
      const visibleCount = [...v.hidden.values()].filter((h) => !h).length;
      expect(visibleCount).toBe(1);
      expect(v.hidden.get(id)).toBe(false);
    }
  });

  it('[Zero] transição "goto" sem histórico: chamar de novo com o mesmo id dá a mesma view (idempotente)', () => {
    expect(computeTitleMenuView('tm-mat')).toEqual(computeTitleMenuView('tm-mat'));
  });
});

// ===================== render/title-scene — geometria pura =====================

describe('render/title-scene · titleHorizonY', () => {
  it('[Interface] arredonda H*0.735 (v3 exato)', () => {
    expect(titleHorizonY(180)).toBe(Math.round(180 * 0.735));
    expect(titleHorizonY(1080)).toBe(Math.round(1080 * 0.735));
  });

  it('[Zero] H=0 → horizonte 0', () => {
    expect(titleHorizonY(0)).toBe(0);
  });
});

describe('render/title-scene · titleSkyRowColor', () => {
  it('[Boundary] topo (y=0): rgb(26,26,58)', () => {
    expect(titleSkyRowColor(0, 100)).toBe((26 << 16) | (26 << 8) | 58);
  });

  it('[Boundary] no horizonte (y=horizon, f=1): rgb(58,76,180)', () => {
    expect(titleSkyRowColor(100, 100)).toBe((58 << 16) | (76 << 8) | 180);
  });

  it('[Range] meio do gradiente (f=0.5): interpolação linear exata', () => {
    const c = titleSkyRowColor(50, 100);
    const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
    expect(r).toBe(Math.round(26 + 32 * 0.5));
    expect(g).toBe(Math.round(26 + 50 * 0.5));
    expect(b).toBe(Math.round(58 + 122 * 0.5));
  });
});

describe('render/title-scene · titleCloudDriftOffset', () => {
  it('[Gate] rm.parallax (movimento reduzido) → sempre 0, mesmo com titleT alto', () => {
    expect(titleCloudDriftOffset(600, true)).toBe(0);
  });

  it('[Interface] sem redução: titleT/6 (deriva sub-pixel, #21a)', () => {
    expect(titleCloudDriftOffset(6, false)).toBe(1);
    expect(titleCloudDriftOffset(1, false)).toBeCloseTo(1 / 6);
  });
});

describe('render/title-scene · titleCloudX', () => {
  it('[Interface] delega em cloudWrapX com enterAt=-28k e span=W+28k (corpo inteiro, #21b)', () => {
    const cx = 40, k = 1, off = 5, W = 320;
    expect(titleCloudX(cx, k, off, W)).toBe(cloudWrapX(cx * k - off, -28 * k, W + 28 * k));
  });

  it('[Boundary] nunca ultrapassa W (a nuvem some inteira antes de reentrar)', () => {
    const k = 1.5, W = 200;
    for (let off = 0; off < 500; off += 11) {
      expect(titleCloudX(180, k, off, W)).toBeLessThan(W);
    }
  });
});

describe('render/title-scene · titleGrassRows', () => {
  it('[Interface] 3 fileiras escalonadas (v3 exato: passo 3k/4k/5k, y=HOR/HOR+3k/HOR+6k)', () => {
    const rows = titleGrassRows(2, 100);
    expect(rows).toEqual([
      { xStart: 0, xStep: 6, y: 100 },
      { xStart: 2, xStep: 8, y: 106 },
      { xStart: 4, xStep: 10, y: 112 },
    ]);
  });
});

describe('render/title-scene · TITLE_CLOUDS', () => {
  it('[Zero] as 4 nuvens da v3, na ordem histórica', () => {
    expect(TITLE_CLOUDS).toEqual([
      { cx: 40, cy: 30 }, { cx: 180, cy: 52 }, { cx: 265, cy: 22 }, { cx: 110, cy: 72 },
    ]);
  });
});

// ===================== render/title-scene · createTitleScene (camada PIXI falsa) =====================

function fakeGfx() {
  const rec = { clears: 0, fills: 0, rects: 0 };
  const g = {
    clear: () => { rec.clears++; },
    beginFill: () => { rec.fills++; return g; },
    drawRect: () => { rec.rects++; return g; },
    endFill: () => g,
  };
  g._rec = rec;
  return g;
}

describe('render/title-scene · createTitleScene', () => {
  it('[Boot] draw() limpa a camada e desenha (fills/rects > 0)', () => {
    const titleG = fakeGfx();
    const scene = createTitleScene({ titleG, screen: { width: 320, height: 180 }, getRm: () => ({}) });
    scene.draw();
    expect(titleG._rec.clears).toBe(1);
    expect(titleG._rec.fills).toBeGreaterThan(0);
    expect(titleG._rec.rects).toBeGreaterThan(0);
  });

  it('[Interface] cada draw() limpa de novo (idempotente por frame)', () => {
    const titleG = fakeGfx();
    const scene = createTitleScene({ titleG, screen: { width: 320, height: 180 }, getRm: () => ({}) });
    scene.draw(); scene.draw(); scene.draw();
    expect(titleG._rec.clears).toBe(3);
  });

  it('[Interface] lê screen.width/height AO VIVO (mesma referência, tamanho mudou entre draws)', () => {
    const titleG = fakeGfx();
    const screen = { width: 320, height: 180 };
    const scene = createTitleScene({ titleG, screen, getRm: () => ({}) });
    scene.draw();
    const rectsAt320 = titleG._rec.rects;
    screen.width = 640; screen.height = 360;
    titleG._rec.rects = 0;
    scene.draw();
    expect(titleG._rec.rects).not.toBe(0);
    expect(titleG._rec.rects).not.toBe(rectsAt320); // mais pixels de largura → mais retângulos na faixa do céu
  });

  it('[Gate] getRm().parallax reduz a deriva das nuvens, mas o desenho continua acontecendo', () => {
    const titleG = fakeGfx();
    const scene = createTitleScene({ titleG, screen: { width: 320, height: 180 }, getRm: () => ({ parallax: true }) });
    expect(() => scene.draw()).not.toThrow();
    expect(titleG._rec.fills).toBeGreaterThan(0);
  });

  it('[Zero] tela 0×0 não quebra (sem faixa de céu, sem grama, ainda limpa e desenha as nuvens)', () => {
    const titleG = fakeGfx();
    const scene = createTitleScene({ titleG, screen: { width: 0, height: 0 }, getRm: () => ({}) });
    expect(() => scene.draw()).not.toThrow();
    expect(titleG._rec.clears).toBe(1);
  });
});
