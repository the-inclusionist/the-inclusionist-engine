// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-visual (NODE project: pure logic only, no document). Contract: the rules of the Visual
// accessibility panel (contrast level, labels, L→Q enhancement, clamp of the selected player, role colour) do not depend
// on the DOM; the panel's rows are measured in the browser project. See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { createTranslator as translatorOfThisFile } from '../app/js/core/i18n.js'; // VIZ_MODES holds KEYS (item 14)
const { t } = translatorOfThisFile(); // pt: `core/i18n` holds no state (ADR-0232 D3)
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
// 📌 The PURE half lives in `ui/visual-choices` (ADR-0221 step 7c, 2026-09-23), and it was THIS file that pointed at the
// seam: it imported exactly these names and nothing else, and the node project mounts no document.
import {
  CONTRAST_LABELS, ROLE_KEYS, ROLE_LABELS,
  resolveVisualMode, VISUAL_MODES, VISUAL_MODE_LIST, contrastLabel, clamp01, lqLabel, lqPercent, lqFromPercent, LQ_STEPS, lqPosition,
  clampSelectedPlayer, rgbToHex, onOffLabel,
} from '../app/js/ui/visual-choices.js';
import { CONTRAST_LEVELS } from '../app/js/core/visual-cycles.js';

const baseSettings = () => ({
  lq: 0, ownerColors: true, cbSafe: false, outlineFg: 0, outlineBg: 0,
  roleColors: { hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212] },
});

describe('ui/settings-visual — resolveVisualMode', () => {
  // The name says «mode», not «contrast»: with the colour-blindness corrections in this menu (#60), a contrast-only name
  // would lie when returning 'fix-deuter'.
  it('[Right] devolve o próprio valor nos 4 níveis de contraste', () => {
    for (const lvl of CONTRAST_LEVELS) expect(resolveVisualMode(lvl)).toBe(lvl);
  });

  it('[Right] e também nas 3 correções de daltonismo, que agora são deste menu', () => {
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(resolveVisualMode(k)).toBe(k);
  });

  it('[Boundary] SIMULAÇÃO cai para "normal" — ela é do menu de empatia, e este menu não fala por ela', () => {
    // It is not an "unknown": `sim-deuter` exists and is on. Answering 'normal' here is the truth about THIS menu, and it
    // is what keeps the mark from appearing on the wrong panel.
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
  // contrastLabel returns the i18n KEY; the assertions go through the pt dictionary so they keep asserting the label the
  // person hears, and not only that some key exists. '4,5:1' becomes '4.5:1' in English, which is why the contrast ratio,
  // which looks like a universal number, needs translating.
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
  // Re-exports lqName from render/lq-filter, which returns the i18n KEY; the assertions go through the dictionary.
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

describe('ui/settings-visual — LQ_PASSOS / lqPosicao (os passos do realce, ADR-0151)', () => {
  it('🔴 [Right] cada posição cai na faixa do SEU nome — e «linear» não é zero, que desligaria', () => {
    expect(LQ_STEPS.map((v) => lqLabel(v))).toEqual(['lq.off', 'lq.linear', 'lq.mixed', 'lq.quadratic']);
    expect(LQ_STEPS[1]).toBeGreaterThan(0);
  });
  it('🔴 [Boundary] um valor GUARDADO pelo cursor antigo é lido na posição do nome que a criança ouviu', () => {
    expect(lqPosition(0)).toBe(0);
    expect(lqPosition(0.2)).toBe(1);
    expect(lqPosition(0.35)).toBe(2);
    expect(lqPosition(0.7)).toBe(3);
    for (let i = 0; i < LQ_STEPS.length; i++) expect(lqPosition(LQ_STEPS[i])).toBe(i);
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
    expect(clampSelectedPlayer(1, 1)).toBe(0); // equal to the count is out of range too (0-based)
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
    expect(onOffLabel(translate, true)).toBe('Ligado');
    expect(onOffLabel(translate, false)).toBe('Desligado');
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

// 📌 THE BLOCK THAT MEASURED THE MARKUP CHANGED PROJECT, not requirement: this panel builds NODES with the kit
// (ADR-0129), so the string `renderVisualPanelHtml` returned no longer exists, and what those cases assert is observable
// only in a document. They are whole in `tests/settings-visual.browser.test.js`, under «o interior montado em nós», with
// two assertions MORE than the string could make: the steps row SURVIVES a render — it used to be rebuilt each time, and
// the cursor fell out of it — and the listeners are wired only once.

describe('ui/settings-visual — VISUAL_MODE_LIST', () => {
  // The list the panel DRAWS, as radio rows. It exists because a `<select>` would hide the corrections: in the empathy
  // menu they were visible rows with a description, and inside a closed box they became invisible. For a control whose
  // reason to exist is to be FOUND by whoever sees poorly, hiding it behind a click is almost the same as not having moved.
  it('[Right] são os 7: normal, os 3 contrastes e as 3 correções, nessa ordem', () => {
    expect(VISUAL_MODE_LIST.map((m) => m.key)).toEqual(
      ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7', 'fix-protan', 'fix-deuter', 'fix-tritan']);
  });

  it('[Interface] cada linha leva nome E descrição — é o que a torna achável, e o que o select tirava', () => {
    for (const m of VISUAL_MODE_LIST) {
      // The fields hold KEYS; what has to exist is their TRANSLATION. Checking only the key's length would let through a
      // mode whose key is not in the dictionary — and it would show up in the menu as 'viz.xyz'.
      expect(t(m.name), m.key).not.toBe(m.name);
      expect(t(m.desc), m.key).not.toBe(m.desc);
    }
  });

  it('[Boundary] NENHUMA simulação entra — elas continuam sendo do menu de empatia', () => {
    for (const m of VISUAL_MODE_LIST) expect(m.sim).toBeUndefined();
  });

  it('[Interface] a lista desenhada e as chaves aceitas são a MESMA coisa', () => {
    // If they diverged, the panel would offer a mode `resolveVisualMode` would treat as another menu's — and the
    // "changed" mark would appear on the wrong panel.
    expect(VISUAL_MODE_LIST.map((m) => m.key)).toEqual([...VISUAL_MODES]);
  });
});
