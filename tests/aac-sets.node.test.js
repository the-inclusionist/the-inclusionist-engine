// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/aac-sets + the pure logic of ui/settings-aac (node project, no document). ADR-0028, issue #57.
//
// What these cases protect is NOT the list — it is the RULE that orders it: each set's tier is decided by its LICENCE and
// nothing else. The day a set changes tier for being pretty, popular or easy to integrate, the catalogue will have
// stopped being true, and this is where that has to hurt.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { AAC_SETS, AAC_BY_KEY, aacAvailable, aacReason, aacLabel } from '../app/js/ui/aac-sets.js';
import { upperCaseOn, lettersRowSpec, aacRowSpec, aacControlId, AAC_SECTIONS } from '../app/js/ui/settings-aac.js';

describe('AAC_SETS — o catálogo', () => {
  it('[Zero] NENHUM conjunto está disponível hoje, e o menu não finge o contrário', () => {
    // The pictograms are thousands of files that have not entered the repository yet. Offering them as choosable would be
    // a button that does nothing — worse than the absence, because it spends trust.
    expect(aacAvailable()).toEqual([]);
  });

  it('[Boundary] as LETRAS não estão nesta lista — viraram um interruptor, não um conjunto', () => {
    // The Dev's decision: a binary question presented as two rows forces the child to compare both to discover they are
    // the same question. What stays here is what really is a list.
    expect(AAC_SETS.some((s) => s.key.startsWith('letras'))).toBe(false);
  });

  it('[Right] os três CC BY-SA estão na camada que pode viajar dentro do jogo', () => {
    for (const k of ['mulberry', 'blissymbolics', 'tawasol']) {
      expect(AAC_BY_KEY[k].tier).toBe('bundled');
      expect(AAC_BY_KEY[k].license).toContain('CC BY-SA');
    }
  });

  it('[Boundary] ARASAAC é o único que precisa ser BAIXADO — licença permite usar, não redistribuir', () => {
    expect(AAC_SETS.filter((s) => s.tier === 'fetched').map((s) => s.key)).toEqual(['arasaac']);
  });

  it('[Boundary] Sclera está com PCS/SymbolStix/Widgit, não com os redistribuíveis', () => {
    // Sclera is free and big, and the temptation to treat it like the CC BY-SA ones is real. It needs a negotiated
    // permission, and the tier follows the licence — not the wish.
    expect(AAC_SETS.filter((s) => s.tier === 'negotiating').map((s) => s.key))
      .toEqual(['sclera', 'pcs', 'symbolstix', 'widgit']);
  });

  it('[Interface] todo conjunto redistribuível DECLARA a licença; nenhum viaja sem ela', () => {
    // Embedding without a recorded licence is a legal problem, not a bug: whoever redistributes is us.
    for (const s of AAC_SETS) if (s.tier === 'bundled') expect(s.license, s.key).toBeTruthy();
  });

  it('[Interface] AAC_BY_KEY cobre o catálogo inteiro, sem chave perdida', () => {
    expect(Object.keys(AAC_BY_KEY)).toHaveLength(AAC_SETS.length);
  });
});

describe('aacReason — duas respostas, porque são duas situações', () => {
  it('[Zero] disponível não tem motivo — não há o que explicar', () => {
    expect(aacReason({ ...AAC_BY_KEY.mulberry, available: true })).toBeNull();
  });

  it('[Right] "em preparação" quando a licença está resolvida e o trabalho é NOSSO', () => {
    expect(aacReason(AAC_BY_KEY.mulberry)).toBe('aac.emPreparo');
    expect(aacReason(AAC_BY_KEY.arasaac)).toBe('aac.emPreparo');
  });

  it('[Right] "aguardando negociação" quando a permissão é de OUTRA pessoa', () => {
    // The difference is not style: whoever reads the first knows to wait, whoever reads the second knows waiting is no
    // use. An educator decides different things with each.
    for (const k of ['sclera', 'pcs', 'symbolstix', 'widgit']) {
      expect(aacReason(AAC_BY_KEY[k])).toBe('aac.aguardandoNegociacao');
    }
  });

  it('[Interface] o rótulo carrega o motivo junto do nome — a linha se explica sozinha', () => {
    expect(aacLabel(translate, AAC_BY_KEY.pcs)).toContain('PCS');
    expect(aacLabel(translate, AAC_BY_KEY.pcs)).toContain('negocia');
  });
});

describe('o interruptor das letras', () => {
  it('[Right] ligado é `upper`; desligado é `mixed`, que INCLUI as minúsculas', () => {
    expect(upperCaseOn('upper')).toBe(true);
    expect(upperCaseOn('mixed')).toBe(false);
  });

  it('[Interface] a linha explica o DESLIGADO — senão "off" fica sem significado', () => {
    // Off is not no letters: it is upper AND lower case. A switch whose off is not explained leaves the child guessing
    // what she loses by switching it off.
    expect(lettersRowSpec(translate).hint).toContain('minúsculas');
  });

  it('[Interface] o interruptor das letras é o piso: sem motivo, porque não depende de arquivo nenhum', () => {
    // Every pictogram set carries a reason for not serving; this one has none to carry. If one day it does, it is because
    // it became dependent on something — and then the reason shows up here before it shows up on screen.
    expect(lettersRowSpec(translate).ariaLabel).toBeUndefined();
  });
});

describe('aacRowSpec — o que a linha de um conjunto DIZ, antes de existir nó nenhum', () => {
  it('[Interface] o motivo entra no NOME ACESSÍVEL — quem não vê a linha ouve por que ela não serve', () => {
    expect(aacRowSpec(translate, AAC_BY_KEY.sclera).ariaLabel).toMatch(/^Sclera, .*negocia/);
  });

  it('[Interface] Tawasol carrega a nota sobre cultura — é o que muda o significado da escolha', () => {
    // A pictogram is not neutral: it is drawn by and for a culture. Without the note, Tawasol is just a strange name on
    // the list, and the educator has no way to know which child it is the right choice for.
    expect(aacRowSpec(translate, AAC_BY_KEY.tawasol).hint).toContain('árabe');
  });

  it('[Interface] a licença vai na MESMA dica, não numa segunda linha de prosa', () => {
    // The CLAUDE.md §4 menu rule: a single `.opt-hint` per row. Two gave two descriptions to the same control, and the
    // footer showed the first — the other stayed in the row, becoming the manual the rule forbids.
    expect(aacRowSpec(translate, AAC_BY_KEY.mulberry).hint).toContain('Licença: ');
  });

  it('[Right] o id sai do key do catálogo, que é único por construção', () => {
    const ids = AAC_SETS.map((s) => aacRowSpec(translate, s).id);
    expect(new Set(ids).size).toBe(AAC_SETS.length);
    expect(ids).toContain(aacControlId('widgit'));
  });
});

describe('AAC_SECTIONS — três seções, e a primeira NÃO sai do catálogo', () => {
  it('[Right] o interruptor das letras é a seção «agora»; os 8 conjuntos dividem-se nas outras duas', () => {
    const [agora, preparo, negociacao] = AAC_SECTIONS.map((s) => s.rows(translate));
    expect(agora.map((l) => l.id)).toEqual(['caa-caixa-alta']);
    expect(preparo.length + negociacao.length).toBe(AAC_SETS.length);
    expect(negociacao.map((l) => l.id))
      .toEqual(['sclera', 'pcs', 'symbolstix', 'widgit'].map(aacControlId));
  });
});
