// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-empathy — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: qual "kind" do catálogo VIZ_MODES conta como simulação de empatia (vs. correção do settings-visual),
// o recorte EMPATHY_VIZ_MODES resultante e o mapeamento valor→rótulo dos botões liga/desliga. O render()/open()/
// close() (tocam DOM) ficam em settings-empathy.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { isSimKind, EMPATHY_VIZ_MODES, toggleLabel } from '../app/js/ui/settings-empathy.js';
import { VIZ_MODES } from '../app/js/render/viz-modes.js';

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
