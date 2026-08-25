// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-visual (project NODE: só lógica pura, sem document). Contrato: as regras do painel
// Acessibilidade visual (nível de contraste, rótulos, realce L→Q, clamp do jogador selecionado, cor do papel,
// e a montagem do HTML de #visual-list) não dependem de DOM. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // VIZ_MODES guarda CHAVE desde o item 14
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import {
  CONTRAST_LEVELS, CONTRAST_LABELS, ROLE_KEYS, ROLE_LABELS,
  resolveVisualMode, VISUAL_MODES, VISUAL_MODE_LIST, contrastLabel, clamp01, lqLabel, lqPercent, lqFromPercent,
  clampSelectedPlayer, rgbToHex, onOffLabel, renderVisualPanelHtml,
} from '../app/js/ui/settings-visual.js';

const baseSettings = () => ({
  lq: 0, ownerColors: true, cbSafe: false, outlineFg: 0, outlineBg: 0,
  roleColors: { hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212] },
});

describe('ui/settings-visual — resolveVisualMode', () => {
  // Chamava-se `resolveContrastValue` enquanto o menu só tinha contraste. Com as correções de daltonismo
  // mudando de casa (#60), o nome antigo passaria a mentir ao devolver 'fix-deuter'.
  it('[Right] devolve o próprio valor nos 4 níveis de contraste', () => {
    for (const lvl of CONTRAST_LEVELS) expect(resolveVisualMode(lvl)).toBe(lvl);
  });

  it('[Right] e também nas 3 correções de daltonismo, que agora são deste menu', () => {
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(resolveVisualMode(k)).toBe(k);
  });

  it('[Boundary] SIMULAÇÃO cai para "normal" — ela é do menu de empatia, e este menu não fala por ela', () => {
    // Não é um "desconhecido": `sim-deuter` existe e está ligado. Responder 'normal' aqui é a verdade sobre
    // ESTE menu, e é o que impede a marca de aparecer no painel errado.
    expect(resolveVisualMode('sim-deuter')).toBe('normal');
    expect(resolveVisualMode('blind')).toBe('normal');
    expect(resolveVisualMode('lv-tunnel')).toBe('normal');
  });

  it('[Zero/Error] vazio e desconhecido caem para "normal"', () => {
    expect(resolveVisualMode('')).toBe('normal');
    expect(resolveVisualMode('lixo')).toBe('normal');
  });

  it('[Interface] VISUAL_MODES são 7: os 4 de contraste mais as 3 correções, nessa ordem', () => {
    expect(VISUAL_MODES).toEqual(['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7',
      'fix-protan', 'fix-deuter', 'fix-tritan']);
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
  it('[Interface] NÃO monta mais o modo visual — ele saiu daqui para uma lista de rádio própria', () => {
    // O modo visual era um `<select>` dentro deste HTML. Virou `#visual-modes`, desenhado pelo mesmo
    // renderizador de linhas que o painel de empatia usa, porque as correções de daltonismo precisavam
    // continuar VISÍVEIS ao mudar de menu — dentro da caixa fechada elas sumiam.
    const html = renderVisualPanelHtml('hc-direto-45', baseSettings());
    expect(html).not.toContain('opt-contrast');
    expect(html).not.toContain('<select');
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

describe('ui/settings-visual — VISUAL_MODE_LIST', () => {
  // A lista que o painel DESENHA, em linhas de rádio. Ela existe porque a primeira tentativa de trazer as
  // correções para cá usou um `<select>`: no menu de empatia elas eram linhas visíveis com descrição, e
  // dentro da caixa fechada viraram invisíveis. Para um controle cuja razão de existir é ser ACHADO por quem
  // enxerga mal, esconder atrás de um clique é quase o mesmo que não ter movido.
  it('[Right] são os 7: normal, os 3 contrastes e as 3 correções, nessa ordem', () => {
    expect(VISUAL_MODE_LIST.map((m) => m.key)).toEqual(
      ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7', 'fix-protan', 'fix-deuter', 'fix-tritan']);
  });

  it('[Interface] cada linha leva nome E descrição — é o que a torna achável, e o que o select tirava', () => {
    for (const m of VISUAL_MODE_LIST) {
      // Os campos guardam CHAVE; o que precisa existir é a TRADUÇÃO delas. Cobrar só o comprimento da chave
      // deixaria passar um modo cuja chave não está no dicionário — e ele apareceria no menu como 'viz.xyz'.
      expect(t(m.nome), m.key).not.toBe(m.nome);
      expect(t(m.desc), m.key).not.toBe(m.desc);
    }
  });

  it('[Boundary] NENHUMA simulação entra — elas continuam sendo do menu de empatia', () => {
    for (const m of VISUAL_MODE_LIST) expect(m.sim).toBeUndefined();
  });

  it('[Interface] a lista desenhada e as chaves aceitas são a MESMA coisa', () => {
    // Se divergissem, o painel ofereceria um modo que `resolveVisualMode` trataria como de outro menu — e a
    // marca de "alterado" apareceria no painel errado.
    expect(VISUAL_MODE_LIST.map((m) => m.key)).toEqual([...VISUAL_MODES]);
  });
});
