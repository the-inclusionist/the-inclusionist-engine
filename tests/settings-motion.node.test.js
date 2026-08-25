// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-motion — lógica PURA (project node, sem `document`). ZOMBIES + Right-BICEP.
// Cobre: clamp do jogador selecionado, montagem de linhas (HTML string), allOn do botão-mestre e os
// textos de anúncio ao leitor de tela. O render/DOM real (querySelector/addEventListener/focus) é coberto
// em tests/settings-motion.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (ui/settings-motion).
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // RM_LABEL guarda CHAVE desde o item 14; o HTML tem de trazer o TEXTO
import {
  clampSelectedPlayer, motionRowHtml, buildCharRowsHtml, buildSceneRowsHtml,
  crtToggleRowHtml, crtRoundRowHtml, allMotionFrozen, motionMasterLabel,
  sceneMotionAnnouncement, crtToggleAnnouncement, crtLevelLabel, crtRoundAnnouncement,
  stopResumeAllAnnouncement, RM_LABEL, RM_SOON,
} from '../app/js/ui/settings-motion.js';

const RM_CHAR = [
  { prop: 'rmWalk', lbl: 'Personagem em movimento (andar, escalar, nadar, pular)' },
  { prop: 'rmBreath', lbl: 'Respiração (parado)' },
  { prop: 'rmFlavor', lbl: 'Gracinhas (animações de descanso)' },
];
const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];

describe('clampSelectedPlayer', () => {
  it('[Right] mantém o índice quando ele ainda cabe no nº de telas', () => {
    expect(clampSelectedPlayer(1, 3)).toBe(1);
  });
  it('[Boundary] volta a 0 quando o índice fica >= nº de telas (ex.: 4p→1p com o 4º selecionado)', () => {
    expect(clampSelectedPlayer(3, 1)).toBe(0);
    expect(clampSelectedPlayer(2, 2)).toBe(0); // igual conta como "fora" (0-based)
  });
  it('[Zero] 0 jogadores também volta a 0 (não quebra, não fica negativo)', () => {
    expect(clampSelectedPlayer(0, 0)).toBe(0);
  });
});

describe('motionRowHtml', () => {
  it('[Right] animado (frozen=false): switch is-on, aria-pressed=true, texto ▶ Animado', () => {
    const html = motionRowHtml('Andar', false, 'data-rmc="rmWalk"', false);
    expect(html).toContain('Andar');
    expect(html).toContain('is-on');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('▶ Animado');
    expect(html).toContain('data-rmc="rmWalk"');
  });
  it('[Inverse] congelado (frozen=true): sem is-on, aria-pressed=false, texto ❄ Congelado', () => {
    const html = motionRowHtml('Andar', true, 'data-rmc="rmWalk"', false);
    expect(html).not.toContain('is-on');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('❄ Congelado');
  });
  it('[Boundary] soon=true acrescenta a marca "(em breve)"', () => {
    expect(motionRowHtml('X', true, '', true)).toContain('(em breve)');
    expect(motionRowHtml('X', true, '', false)).not.toContain('em breve');
  });
});

describe('buildCharRowsHtml', () => {
  it('[Right] uma linha por alvo de RM_CHAR, refletindo o player selecionado', () => {
    const player = { rmWalk: true, rmBreath: false, rmFlavor: false };
    const html = buildCharRowsHtml(RM_CHAR, player);
    expect((html.match(/ctrl-row/g) || []).length).toBe(3);
    expect(html).toContain('❄ Congelado'); // rmWalk=true (congelado)
  });
  it('[Zero] sem player (undefined) trata tudo como não-congelado (animado)', () => {
    const html = buildCharRowsHtml(RM_CHAR, undefined);
    expect(html).not.toContain('❄ Congelado');
    expect((html.match(/▶ Animado/g) || []).length).toBe(3);
  });
});

describe('buildSceneRowsHtml', () => {
  it('[Right] uma linha por chave de RM_KEYS, usando o rótulo certo e o estado de `rm`', () => {
    const rm = { parallax: true, decor: false, items: false, particles: false };
    const html = buildSceneRowsHtml(RM_KEYS, rm, RM_LABEL, RM_SOON);
    // `RM_LABEL` guarda CHAVE i18n desde o item 14, e o HTML tem de trazer o TEXTO. Este caso comparava com
    // `RM_LABEL.parallax` cru e reprovou — com razão: se passasse, estaria aceitando `rm.parallax` na tela.
    expect(html).toContain(t(RM_LABEL.parallax));
    expect(html).not.toContain('rm.parallax'); // a chave NUNCA vaza para a interface
    expect((html.match(/ctrl-row/g) || []).length).toBe(4);
  });
  it('[Boundary] alvo marcado em RM_SOON aparece com "(em breve)"', () => {
    const rm = { parallax: false, decor: false, items: false, particles: false };
    const html = buildSceneRowsHtml(RM_KEYS, rm, RM_LABEL, new Set(['decor']));
    expect(html).toContain('(em breve)');
  });
});

describe('crtToggleRowHtml / crtRoundRowHtml', () => {
  it('[Right] toggle ligado usa o rótulo "Ligado" e data-crt-tgl com a chave', () => {
    const html = crtToggleRowHtml('Scanlines', 'scan', true);
    expect(html).toContain('data-crt-tgl="scan"');
    expect(html).toContain('❚❚ Ligado');
    expect(html).toContain('is-on');
  });
  it('[Inverse] toggle desligado usa "▶ Desligado" e não marca is-on', () => {
    const html = crtToggleRowHtml('Vinheta', 'vig', false);
    expect(html).toContain('▶ Desligado');
    expect(html).not.toContain('is-on');
  });
  it('[Boundary] cantos: cada nível (0/1/2) marca a option certa com "selected"', () => {
    for (const round of [0, 1, 2]) {
      const html = crtRoundRowHtml('Cantos arredondados', round);
      const opt = new RegExp(`<option value="${round}" selected>`);
      expect(html).toMatch(opt);
      expect((html.match(/selected/g) || []).length).toBe(1); // só uma option marcada
    }
  });
});

describe('allMotionFrozen', () => {
  // rmWalk/rmBreath/rmFlavor = true SIGNIFICA "movimento reduzido LIGADO" (congelado), não "animação ligada" —
  // mesma convenção de `rm[k]`. allMotionFrozen só é true quando TUDO está congelado.
  const allFrozenPlayer = { rmWalk: true, rmBreath: true, rmFlavor: true };
  const partiallyFrozenPlayer = { rmWalk: false, rmBreath: true, rmFlavor: true };
  it('[Right] true quando toda cena + todo personagem estão com movimento reduzido (congelados)', () => {
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, allFrozenPlayer)).toBe(true);
  });
  it('[Inverse] false se QUALQUER alvo de cena ainda estiver animado', () => {
    const rm = { parallax: false, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, allFrozenPlayer)).toBe(false);
  });
  it('[Inverse] false se QUALQUER alvo do personagem ainda estiver animado', () => {
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, partiallyFrozenPlayer)).toBe(false);
  });
  it('[Zero] sem player (undefined) nunca dá true (RM_CHAR.every falha)', () => {
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined)).toBe(false);
  });
});

describe('motionMasterLabel', () => {
  it('[Right] allFrozen=true → "Retomar"; allFrozen=false → "Parar"', () => {
    expect(motionMasterLabel(true)).toBe('▶ Retomar todas as animações');
    expect(motionMasterLabel(false)).toBe('⏸ Parar todas as animações');
  });
});

describe('anúncios (srSay)', () => {
  it('sceneMotionAnnouncement: congelado vs animado', () => {
    expect(sceneMotionAnnouncement('Parallax do fundo', true)).toBe('Parallax do fundo congelado.');
    expect(sceneMotionAnnouncement('Parallax do fundo', false)).toBe('Parallax do fundo animado.');
  });
  it('crtToggleAnnouncement: ligada vs desligada', () => {
    expect(crtToggleAnnouncement('Scanlines', true)).toBe('Scanlines ligada.');
    expect(crtToggleAnnouncement('Scanlines', false)).toBe('Scanlines desligada.');
  });
  it('crtLevelLabel: 0/1/2 → desligado/pequeno/grande', () => {
    expect(crtLevelLabel(0)).toBe('desligado');
    expect(crtLevelLabel(1)).toBe('pequeno');
    expect(crtLevelLabel(2)).toBe('grande');
  });
  it('crtRoundAnnouncement compõe rótulo + nível', () => {
    expect(crtRoundAnnouncement('Cantos arredondados', 2)).toBe('Cantos arredondados: grande.');
  });
  it('stopResumeAllAnnouncement: nowFrozen=true (acabou de congelar) vs false (acabou de retomar)', () => {
    expect(stopResumeAllAnnouncement(true)).toBe('Todas as animações paradas.');
    expect(stopResumeAllAnnouncement(false)).toBe('Todas as animações retomadas.');
  });
});
