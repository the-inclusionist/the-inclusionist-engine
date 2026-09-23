import { describe, it, expect } from 'vitest';
import { TITLE_MENU_IDS, isTitleMenuId, computeTitleMenuView } from '../app/js/ui/title.js';
// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/title (navegação pura entre submenus) e render/title-scene (geometria da cena PIXI do título) —
// project NODE: sem document/PIXI reais, só a lógica + camadas falsas injetadas (padrão de scene-sky-decor).
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4).

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

