// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/caa-sets + a lógica pura de ui/settings-caa (project node, sem document). ADR-0028, issue #57.
//
// O que estes casos protegem NÃO é a lista — é a REGRA que a ordena: a camada de cada conjunto é decidida pela
// LICENÇA dele e por mais nada. No dia em que um conjunto mudar de camada por ser bonito, popular ou fácil de
// integrar, o catálogo terá deixado de ser verdadeiro, e é aqui que isso precisa doer.
import { describe, it, expect } from 'vitest';
import { CAA_SETS, CAA_BY_KEY, caaAvailable, caaReason, caaLabel } from '../app/js/ui/caa-sets.js';
import { upperCaseOn, lettersRowSpec, caaRowSpec, caaControlId, CAA_SECTIONS } from '../app/js/ui/settings-caa.js';

describe('CAA_SETS — o catálogo', () => {
  it('[Zero] NENHUM conjunto está disponível hoje, e o menu não finge o contrário', () => {
    // Os pictogramas são milhares de arquivos que ainda não entraram no repositório. Oferecê-los como
    // escolhíveis seria um botão que não faz nada — pior que a ausência, porque gasta a confiança.
    expect(caaAvailable()).toEqual([]);
  });

  it('[Boundary] as LETRAS não estão nesta lista — viraram um interruptor, não um conjunto', () => {
    // Decisão do Dev: uma pergunta binária apresentada como duas linhas obriga a criança a comparar as duas
    // para descobrir que são a mesma pergunta. Sobra aqui o que é de verdade uma lista.
    expect(CAA_SETS.some((s) => s.key.startsWith('letras'))).toBe(false);
  });

  it('[Right] os três CC BY-SA estão na camada que pode viajar dentro do jogo', () => {
    for (const k of ['mulberry', 'blissymbolics', 'tawasol']) {
      expect(CAA_BY_KEY[k].tier).toBe('bundled');
      expect(CAA_BY_KEY[k].license).toContain('CC BY-SA');
    }
  });

  it('[Boundary] ARASAAC é o único que precisa ser BAIXADO — licença permite usar, não redistribuir', () => {
    expect(CAA_SETS.filter((s) => s.tier === 'fetched').map((s) => s.key)).toEqual(['arasaac']);
  });

  it('[Boundary] Sclera está com PCS/SymbolStix/Widgit, não com os redistribuíveis', () => {
    // Sclera é livre e grande, e a tentação de tratá-la como os CC BY-SA é real. Ela precisa de permissão
    // negociada, e a camada segue a licença — não a vontade.
    expect(CAA_SETS.filter((s) => s.tier === 'negotiating').map((s) => s.key))
      .toEqual(['sclera', 'pcs', 'symbolstix', 'widgit']);
  });

  it('[Interface] todo conjunto redistribuível DECLARA a licença; nenhum viaja sem ela', () => {
    // Embutir sem licença registrada é problema jurídico, não bug: quem redistribui somos nós.
    for (const s of CAA_SETS) if (s.tier === 'bundled') expect(s.license, s.key).toBeTruthy();
  });

  it('[Interface] CAA_BY_KEY cobre o catálogo inteiro, sem chave perdida', () => {
    expect(Object.keys(CAA_BY_KEY)).toHaveLength(CAA_SETS.length);
  });
});

describe('caaMotivo — duas respostas, porque são duas situações', () => {
  it('[Zero] disponível não tem motivo — não há o que explicar', () => {
    expect(caaReason({ ...CAA_BY_KEY.mulberry, available: true })).toBeNull();
  });

  it('[Right] "em preparação" quando a licença está resolvida e o trabalho é NOSSO', () => {
    expect(caaReason(CAA_BY_KEY.mulberry)).toBe('caa.emPreparo');
    expect(caaReason(CAA_BY_KEY.arasaac)).toBe('caa.emPreparo');
  });

  it('[Right] "aguardando negociação" quando a permissão é de OUTRA pessoa', () => {
    // A diferença não é de estilo: quem lê a primeira sabe esperar, quem lê a segunda sabe que esperar não
    // adianta. Um educador decide coisas diferentes com cada uma.
    for (const k of ['sclera', 'pcs', 'symbolstix', 'widgit']) {
      expect(caaReason(CAA_BY_KEY[k])).toBe('caa.aguardandoNegociacao');
    }
  });

  it('[Interface] o rótulo carrega o motivo junto do nome — a linha se explica sozinha', () => {
    expect(caaLabel(CAA_BY_KEY.pcs)).toContain('PCS');
    expect(caaLabel(CAA_BY_KEY.pcs)).toContain('negocia');
  });
});

describe('o interruptor das letras', () => {
  it('[Right] ligado é `upper`; desligado é `mixed`, que INCLUI as minúsculas', () => {
    expect(upperCaseOn('upper')).toBe(true);
    expect(upperCaseOn('mixed')).toBe(false);
  });

  it('[Interface] a linha explica o DESLIGADO — senão "off" fica sem significado', () => {
    // O off não é "sem letras": é maiúsculas E minúsculas. Um interruptor cujo desligado não se explica
    // deixa a criança adivinhando o que ela perde ao desligá-lo.
    expect(lettersRowSpec().hint).toContain('minúsculas');
  });

  it('[Interface] o interruptor das letras é o piso: sem motivo, porque não depende de arquivo nenhum', () => {
    // Todo conjunto de pictograma carrega um motivo de não servir; este não tem nenhum a carregar. Se um dia
    // tiver, é porque virou dependente de algo — e aí o motivo aparece aqui antes de aparecer na tela.
    expect(lettersRowSpec().ariaLabel).toBeUndefined();
  });
});

describe('caaRowSpec — o que a linha de um conjunto DIZ, antes de existir nó nenhum', () => {
  it('[Interface] o motivo entra no NOME ACESSÍVEL — quem não vê a linha ouve por que ela não serve', () => {
    expect(caaRowSpec(CAA_BY_KEY.sclera).ariaLabel).toMatch(/^Sclera, .*negocia/);
  });

  it('[Interface] Tawasol carrega a nota sobre cultura — é o que muda o significado da escolha', () => {
    // Um pictograma não é neutro: é desenhado por e para uma cultura. Sem a nota, "Tawasol" é só um nome
    // estranho na lista, e o educador não tem como saber para qual criança ele é a escolha certa.
    expect(caaRowSpec(CAA_BY_KEY.tawasol).hint).toContain('árabe');
  });

  it('[Interface] a licença vai na MESMA dica, não numa segunda linha de prosa', () => {
    // A regra de menu do CLAUDE.md §4: um único `.opt-hint` por linha. Dois davam duas descrições ao mesmo
    // controle, e o rodapé mostrava a primeira — a outra ficava na linha, virando o manual que a regra proíbe.
    expect(caaRowSpec(CAA_BY_KEY.mulberry).hint).toContain('Licença: ');
  });

  it('[Right] o id sai do key do catálogo, que é único por construção', () => {
    const ids = CAA_SETS.map((s) => caaRowSpec(s).id);
    expect(new Set(ids).size).toBe(CAA_SETS.length);
    expect(ids).toContain(caaControlId('widgit'));
  });
});

describe('CAA_SECTIONS — três seções, e a primeira NÃO sai do catálogo', () => {
  it('[Right] o interruptor das letras é a seção «agora»; os 8 conjuntos dividem-se nas outras duas', () => {
    const [agora, preparo, negociacao] = CAA_SECTIONS.map((s) => s.rows());
    expect(agora.map((l) => l.id)).toEqual(['caa-caixa-alta']);
    expect(preparo.length + negociacao.length).toBe(CAA_SETS.length);
    expect(negociacao.map((l) => l.id))
      .toEqual(['sclera', 'pcs', 'symbolstix', 'widgit'].map(caaControlId));
  });
});
