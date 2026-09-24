// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-empathy — PURE logic (node project, no document). ZOMBIES + Right-BICEP.
// Covers: which modes of the VIZ_MODES catalogue count as an empathy simulation (vs. the corrections, which live in
// the visual menu, #60), the resulting EMPATHY_VIZ_MODES cut, and the value→label mapping of the buttons. render()/open()/
// close() (they touch the DOM) are in settings-empathy.browser.test.js. See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // VIZ_MODES holds KEYS (item 14)
import { EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';
import { VIZ_MODES, simulatesDisability } from '../app/js/render/viz-modes.js';

describe('EMPATHY_VIZ_MODES — só o que SIMULA', () => {
  // The list asks the `sim` field. `kind` does not tell simulating from correcting, and the three colour-blindness
  // corrections belong to visual accessibility (#60): a colour-blind child must not have to look for the correction of
  // her own condition next to the button that simulates it for whoever does not have it — in a menu about feeling what
  // having a disability is like.
  it('[Right] são as 9 que simulam: 3 daltonismos, 5 baixas visões e cegueira', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    expect(keys).toEqual(['sim-deuter', 'sim-protan', 'sim-tritan',
      'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']);
  });

  it('[Boundary] NÃO inclui mais as 3 correções de daltonismo — elas mudaram de menu (#60)', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(keys).not.toContain(k);
  });

  it('[Boundary] nem os modos de alto contraste, nem "normal" — esses sempre foram do settings-visual', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    for (const k of ['hc-direto', 'hc-direto-45', 'hc-direto-7', 'normal']) expect(keys).not.toContain(k);
  });

  it('[Interface] é exatamente VIZ_MODES filtrado por `sim` — fonte única, sem segunda opinião', () => {
    expect(EMPATHY_VIZ_MODES).toEqual(VIZ_MODES.filter((m) => simulatesDisability(m.key)));
  });

  it('[Right] cada entrada preserva nome/desc do catálogo (a lista não reescreve os dados)', () => {
    const blind = EMPATHY_VIZ_MODES.find((m) => m.key === 'blind');
    // Against `t()` and not against the Portuguese: pinning the sentence here would bring back into the test the text
    // item 14 took out of the catalogue. The case still catches a swapped entry — each mode has its own key.
    expect(t(blind.name)).toBe(t('viz.blind'));
    expect(t(blind.desc)).toContain('Tela preta');
  });
});

// (The `toggleLabel` cases live in tests/dom.node.test.js: the function is in `ui/dom`, beside `toggleBtn`, and the test
//  travels with it. See the rule of item 19.)

// `simulatesDisability` answers both what the panel LISTS and what the reset MAY TURN OFF, and `kind` cannot answer
// either: the `fix-*` corrections share `kind:'filter'` with the simulations. That shared `kind` is exactly where a
// reset goes wrong.
describe('simulatesDisability', () => {
  it('[Right] verdadeiro para os 9 modos que simulam: 3 daltonismos, 5 baixas visões e cegueira', () => {
    for (const k of ['sim-deuter', 'sim-protan', 'sim-tritan',
      'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      expect(simulatesDisability(k)).toBe(true);
    }
  });

  it('[Boundary] falso para os 3 `fix-*` — corrigem daltonismo, e o `kind` deles não denuncia isso', () => {
    // The three share `kind:'filter'` with `sim-protan/deuter/tritan`, serving opposite people. The `sim` field is what
    // separates them.
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) {
      expect(simulatesDisability(k)).toBe(false);
      expect(VIZ_MODES.find((m) => m.key === k).kind).toBe('filter');
    }
  });

  it('[Boundary] falso para alto contraste e cores normais', () => {
    for (const k of ['hc-direto', 'hc-direto-45', 'hc-direto-7', 'normal']) {
      expect(simulatesDisability(k)).toBe(false);
    }
  });

  it('[Zero/Error] falso para chave vazia ou desconhecida — diante do que não conhece, não desliga', () => {
    expect(simulatesDisability('')).toBe(false);
    expect(simulatesDisability('chave-que-nao-existe')).toBe(false);
  });

  it('[Interface] os 16 modos do catálogo se dividem em 9 que simulam e 7 que não', () => {
    // Pins the total: a new mode enters the catalogue already having to declare which side it is on.
    expect(VIZ_MODES.filter((m) => simulatesDisability(m.key))).toHaveLength(9);
    expect(VIZ_MODES).toHaveLength(16);
  });
});
