// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-empathy — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: qual "kind" do catálogo VIZ_MODES conta como simulação de empatia (vs. correção do settings-visual),
// o recorte EMPATHY_VIZ_MODES resultante e o mapeamento valor→rótulo dos botões liga/desliga. O render()/open()/
// close() (tocam DOM) ficam em settings-empathy.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { isSimKind, EMPATHY_VIZ_MODES, toggleLabel } from '../app/js/ui/settings-empathy.js';
import { VIZ_MODES, simulatesDisability } from '../app/js/render/viz-modes.js';

describe('isSimKind', () => {
  it('[Right] verdadeiro para os 3 kinds de simulação (filter/lowvision/blind)', () => {
    expect(isSimKind('filter')).toBe(true);
    expect(isSimKind('lowvision')).toBe(true);
    expect(isSimKind('blind')).toBe(true);
  });
  it('[Boundary] falso para "hcnew" — é CORREÇÃO (alto contraste), não simulação; pertence ao settings-visual', () => {
    expect(isSimKind('hcnew')).toBe(false);
  });
  it('[Boundary] falso para "normal" (cores originais, sem efeito)', () => {
    expect(isSimKind('normal')).toBe(false);
  });
  it('[Zero/Error] falso para string vazia ou kind desconhecido', () => {
    expect(isSimKind('')).toBe(false);
    expect(isSimKind('kind-que-nao-existe')).toBe(false);
  });
});

describe('EMPATHY_VIZ_MODES', () => {
  it('[Right] contém as chaves de kind filter/lowvision/blind, na ordem do catálogo', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    expect(keys).toEqual(['sim-deuter', 'sim-protan', 'sim-tritan', 'fix-protan', 'fix-deuter', 'fix-tritan',
      'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']);
  });
  it('[Boundary] NÃO inclui os modos "hcnew" (alto contraste) nem "normal" — esses são do settings-visual', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    for (const k of ['hc-direto', 'hc-direto-45', 'hc-direto-7', 'normal']) {
      expect(keys).not.toContain(k);
    }
  });
  // BUG SURFADO (comportamento herdado do game.js, não corrigido aqui — ver retorno da extração):
  // fix-protan/fix-deuter/fix-tritan são CORREÇÃO de daltonismo (para quem tem a condição), não simulação
  // (para quem não tem); mas compartilham kind:'filter' com sim-protan/sim-deuter/sim-tritan em
  // render/viz-modes.ts, então isSimKind('filter') também os inclui aqui. O painel de empatia hoje lista os 3
  // modos "Correção X" junto dos 3 "Simular X". Comportamento preservado por design (extração, não redesign).
  it('[Interface] inclui fix-protan/fix-deuter/fix-tritan (kind "filter" não distingue sim de correção)', () => {
    const keys = EMPATHY_VIZ_MODES.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['fix-protan', 'fix-deuter', 'fix-tritan']));
  });
  it('[Interface] é exatamente VIZ_MODES filtrado por isSimKind (fonte única: render/viz-modes.ts)', () => {
    expect(EMPATHY_VIZ_MODES).toEqual(VIZ_MODES.filter((m) => isSimKind(m.kind)));
  });
  it('[Right] cada entrada preserva nome/desc do catálogo (a lista não reescreve os dados)', () => {
    const blind = EMPATHY_VIZ_MODES.find((m) => m.key === 'blind');
    expect(blind.nome).toBe('Simular cegueira total');
    expect(blind.desc).toContain('Tela preta');
  });
});

describe('toggleLabel', () => {
  it('[Right] ligado → "❚❚ Ligado"', () => {
    expect(toggleLabel(true)).toBe('❚❚ Ligado');
  });
  it('[Right] desligado → "▶ Desligado"', () => {
    expect(toggleLabel(false)).toBe('▶ Desligado');
  });
  it('[Boundary] valores truthy/falsy não-booleanos seguem a mesma regra (uso defensivo)', () => {
    expect(toggleLabel(1)).toBe('❚❚ Ligado');
    expect(toggleLabel(0)).toBe('▶ Desligado');
  });
});

// `simulatesDisability` mora ao lado de `isSimKind` neste arquivo de propósito: as duas parecem responder à
// mesma pergunta e não respondem, e é justamente aí que um reset erra. `isSimKind` diz o que o PAINEL LISTA;
// `simulatesDisability` diz o que o RESET PODE DESLIGAR. Enquanto as correções de daltonismo não tiverem outro
// lugar onde morar, essas duas listas continuam diferentes, e a diferença é a proteção.
describe('simulatesDisability', () => {
  it('[Right] verdadeiro para os 9 modos que simulam: 3 daltonismos, 5 baixas visões e cegueira', () => {
    for (const k of ['sim-deuter', 'sim-protan', 'sim-tritan',
      'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']) {
      expect(simulatesDisability(k)).toBe(true);
    }
  });

  it('[Boundary] falso para os 3 `fix-*` — corrigem daltonismo, e `isSimKind` NÃO os distingue', () => {
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) {
      expect(simulatesDisability(k)).toBe(false);
      expect(isSimKind(VIZ_MODES.find((m) => m.key === k).kind)).toBe(true); // a lista inclui; o reset não
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
    // Prende o total: um modo novo entra no catálogo já tendo que declarar de que lado está.
    expect(VIZ_MODES.filter((m) => simulatesDisability(m.key))).toHaveLength(9);
    expect(VIZ_MODES).toHaveLength(16);
  });
});
