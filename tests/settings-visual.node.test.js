// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-visual (project NODE: só lógica pura, sem document). Contrato: as regras do painel
// Acessibilidade visual (nível de contraste, rótulos, realce L→Q, clamp do jogador selecionado, cor do papel,
// e a montagem do HTML de #visual-list) não dependem de DOM. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import {
  CONTRAST_LEVELS, CONTRAST_LABELS, ROLE_KEYS, ROLE_LABELS,
  resolveContrastValue, contrastLabel, clamp01, lqLabel, lqPercent, lqFromPercent,
  clampSelectedPlayer, rgbToHex, onOffLabel, renderVisualPanelHtml,
} from '../app/js/ui/settings-visual.js';

const baseSettings = () => ({
  lq: 0, ownerColors: true, cbSafe: false, outlineFg: 0, outlineBg: 0,
  roleColors: { hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212] },
});

describe('ui/settings-visual — resolveContrastValue', () => {
  it('[Right] devolve o próprio valor quando é um dos 4 níveis de contraste', () => {
    for (const lvl of CONTRAST_LEVELS) expect(resolveContrastValue(lvl)).toBe(lvl);
  });
  it('[Boundary/Error] valor desconhecido cai para "normal"', () => {
    expect(resolveContrastValue('sim-deuter')).toBe('normal');
    expect(resolveContrastValue('')).toBe('normal');
    expect(resolveContrastValue('lixo')).toBe('normal');
  });
});

describe('ui/settings-visual — contrastLabel', () => {
  // contrastLabel devolve a CHAVE i18n; as asserções atravessam o dicionário pt para continuarem a afirmar o
  // rótulo que a pessoa ouve, e não só que existe alguma chave. 'desligado' era 'off' — palavra inglesa dentro
  // de uma frase em português, corrigida nesta passada; '4,5:1' vira '4.5:1' em inglês, o que é a razão de a
  // razão de contraste, que parece um número universal, precisar de tradução.
  it('[Right] rótulo curto de cada nível (desligado/3:1/4,5:1/7:1)', () => {
    expect(pt[contrastLabel('normal')]).toBe('desligado');
    expect(pt[contrastLabel('hc-direto')]).toBe('3:1');
    expect(pt[contrastLabel('hc-direto-45')]).toBe('4,5:1');
    expect(pt[contrastLabel('hc-direto-7')]).toBe('7:1');
    expect(en[contrastLabel('hc-direto-45')]).toBe('4.5:1');
  });
  it('[Error] chave desconhecida cai para "off"', () => {
    expect(contrastLabel('bogus')).toBe(CONTRAST_LABELS.normal);
  });
});

describe('ui/settings-visual — clamp01', () => {
  it('[Boundary] satura em 0 e em 1', () => {
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(5)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('ui/settings-visual — lqLabel', () => {
  // Reexporta lqName de render/lq-filter, que passou a devolver a CHAVE i18n; as asserções vão pelo dicionário.
  it('[Boundary] 0 é desligado; logo acima de 0 é linear; 0,34 vira misto; 0,67 vira quadrático; 1 é quadrático', () => {
    expect(pt[lqLabel(0)]).toBe('desligado');
    expect(pt[lqLabel(0.1)]).toBe('linear');
    expect(pt[lqLabel(0.33)]).toBe('linear');
    expect(pt[lqLabel(0.34)]).toBe('misto');
    expect(pt[lqLabel(0.66)]).toBe('misto');
    expect(pt[lqLabel(0.67)]).toBe('quadrático');
    expect(pt[lqLabel(1)]).toBe('quadrático');
  });
  it('[Error] entradas fora de 0..1 são saturadas antes de rotular', () => {
    expect(pt[lqLabel(-1)]).toBe('desligado');
    expect(pt[lqLabel(2)]).toBe('quadrático');
  });
});

describe('ui/settings-visual — lqPercent / lqFromPercent (slider <-> t)', () => {
  it('[Right] ida e volta exata em valores redondos', () => {
    expect(lqPercent(0)).toBe(0);
    expect(lqPercent(0.5)).toBe(50);
    expect(lqPercent(1)).toBe(100);
    expect(lqFromPercent(0)).toBe(0);
    expect(lqFromPercent(50)).toBe(0.5);
    expect(lqFromPercent(100)).toBe(1);
  });
  it('[Boundary] lqFromPercent satura fora de 0..100', () => {
    expect(lqFromPercent(-10)).toBe(0);
    expect(lqFromPercent(150)).toBe(1);
  });
  it('[Interface] lqPercent arredonda', () => {
    expect(lqPercent(0.333)).toBe(33);
  });
});

describe('ui/settings-visual — clampSelectedPlayer', () => {
  it('[Right] mantém o índice quando está dentro da contagem de jogadores', () => {
    expect(clampSelectedPlayer(1, 2)).toBe(1);
    expect(clampSelectedPlayer(0, 1)).toBe(0);
  });
  it('[Boundary] volta a 0 quando o índice não existe mais (jogador saiu)', () => {
    expect(clampSelectedPlayer(2, 1)).toBe(0);
    expect(clampSelectedPlayer(1, 1)).toBe(0); // igual à contagem também é fora de faixa (0-based)
  });
});

describe('ui/settings-visual — rgbToHex', () => {
  it('[Right] converte RGB para hex de 6 dígitos', () => {
    expect(rgbToHex([255, 110, 45])).toBe('#ff6e2d');
    expect(rgbToHex([0, 0, 0])).toBe('#000000');
    expect(rgbToHex([255, 255, 255])).toBe('#ffffff');
  });
  it('[Boundary] valores de 1 dígito em hex ganham zero à esquerda', () => {
    expect(rgbToHex([1, 2, 3])).toBe('#010203');
  });
});

describe('ui/settings-visual — onOffLabel', () => {
  it('[Right] rótulo ligado/desligado', () => {
    expect(onOffLabel(true)).toBe('❚❚ Ligado');
    expect(onOffLabel(false)).toBe('▶ Desligado');
  });
});

describe('ui/settings-visual — dados fixos (ROLE_KEYS/ROLE_LABELS/CONTRAST_LEVELS)', () => {
  it('[Zero] ROLE_LABELS cobre exatamente os 4 papéis do color-blocking, na ordem esperada', () => {
    expect(ROLE_KEYS).toEqual(['hazard', 'climb', 'water', 'gate']);
    for (const k of ROLE_KEYS) expect(typeof ROLE_LABELS[k]).toBe('string');
  });
  it('[Zero] CONTRAST_LEVELS começa em "normal" (desligado)', () => {
    expect(CONTRAST_LEVELS[0]).toBe('normal');
    expect(CONTRAST_LEVELS).toHaveLength(4);
  });
});

describe('ui/settings-visual — renderVisualPanelHtml (montagem pura do HTML)', () => {
  it('[Interface] marca a opção de contraste atual como valor do <select>', () => {
    const html = renderVisualPanelHtml('hc-direto-45', baseSettings());
    expect(html).toContain('id="opt-contrast"');
    expect(html).toContain('value="hc-direto-45"');
  });
  it('[Interface] reflete ownerColors/cbSafe ligados em class+aria-pressed', () => {
    const html = renderVisualPanelHtml('normal', { ...baseSettings(), ownerColors: true, cbSafe: true });
    expect(html).toMatch(/id="opt-ownercolors" class="mode-btn is-on"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/id="opt-cbsafe" class="mode-btn is-on"[^>]*aria-pressed="true"/);
  });
  it('[Interface] reflete ownerColors/cbSafe desligados sem a classe is-on', () => {
    const html = renderVisualPanelHtml('normal', { ...baseSettings(), ownerColors: false, cbSafe: false });
    expect(html).toMatch(/id="opt-ownercolors" class="mode-btn"[^>]*aria-pressed="false"/);
    expect(html).toMatch(/id="opt-cbsafe" class="mode-btn"[^>]*aria-pressed="false"/);
  });
  it('[Right] gera um <input type=color> por papel, com a cor atual e o rótulo certo', () => {
    const html = renderVisualPanelHtml('normal', baseSettings());
    for (const k of ROLE_KEYS) {
      expect(html).toContain(`id="opt-role-${k}"`);
      expect(html).toContain(`aria-label="Cor de ${ROLE_LABELS[k]}"`);
    }
    expect(html).toContain('value="#ff6e2d"'); // hazard
  });
  it('[Zero] inclui o botão de restaurar cores padrão', () => {
    expect(renderVisualPanelHtml('normal', baseSettings())).toContain('id="opt-role-reset"');
  });
});
