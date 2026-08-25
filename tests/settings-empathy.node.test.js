// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-empathy — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: quais modos do catálogo VIZ_MODES contam como simulação de empatia (vs. as correções, que desde a
// #60 moram no menu visual), o recorte EMPATHY_VIZ_MODES resultante e o mapeamento valor→rótulo dos botões. O render()/open()/
// close() (tocam DOM) ficam em settings-empathy.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // VIZ_MODES guarda CHAVE desde o item 14
import { EMPATHY_VIZ_MODES } from '../app/js/ui/settings-empathy.js';
import { VIZ_MODES, simulatesDisability } from '../app/js/render/viz-modes.js';

describe('EMPATHY_VIZ_MODES — só o que SIMULA', () => {
  // Esta lista MUDOU e a mudança é o conserto de um defeito de anos. Ela se recortava por
  // `isSimKind(m.kind)`, e `kind` não distingue simular de corrigir: as três "Correção de daltonismo"
  // apareciam num menu chamado "sentir como é ter uma deficiência". A criança daltônica precisava entrar ali
  // para achar a correção da própria condição, ao lado do botão que simula a condição dela para quem não a
  // tem. O Dev mandou movê-las para a Acessibilidade visual (#60); a lista agora pergunta pelo campo `sim`.
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
    // Contra `t()` e não contra o português: fixar a frase aqui devolveria ao teste o texto que o item 14
    // tirou do catálogo. O caso segue pegando entrada trocada — cada modo tem chave própria.
    expect(t(blind.nome)).toBe(t('viz.blind'));
    expect(t(blind.desc)).toContain('Tela preta');
  });
});

// (Os casos de `toggleLabel` mudaram de arquivo: a função foi para `ui/dom`, ao lado do `toggleBtn`, e o
//  teste viajou com ela — tests/dom.node.test.js. Ver a regra do item 19.)

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

  it('[Boundary] falso para os 3 `fix-*` — corrigem daltonismo, e o `kind` deles não denuncia isso', () => {
    // Os três dividem `kind:'filter'` com `sim-protan/deuter/tritan`, servindo pessoas opostas. Era isso que
    // os colocava no menu de empatia, e é isso que o campo `sim` passou a separar.
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
    // Prende o total: um modo novo entra no catálogo já tendo que declarar de que lado está.
    expect(VIZ_MODES.filter((m) => simulatesDisability(m.key))).toHaveLength(9);
    expect(VIZ_MODES).toHaveLength(16);
  });
});
