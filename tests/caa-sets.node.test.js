// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/caa-sets + a lógica pura de ui/settings-caa (project node, sem document). ADR-0028, issue #57.
//
// O que estes casos protegem NÃO é a lista — é a REGRA que a ordena: a camada de cada conjunto é decidida pela
// LICENÇA dele e por mais nada. No dia em que um conjunto mudar de camada por ser bonito, popular ou fácil de
// integrar, o catálogo terá deixado de ser verdadeiro, e é aqui que isso precisa doer.
import { describe, it, expect } from 'vitest';
import { CAA_SETS, CAA_BY_KEY, caaDisponiveis, caaMotivo, caaRotulo } from '../app/js/ui/caa-sets.js';
import { chaveSelecionada, caaRowHtml, caaListHtml } from '../app/js/ui/settings-caa.js';

describe('CAA_SETS — o catálogo', () => {
  it('[Right] as duas caixas de letra são as ÚNICAS disponíveis hoje, e o menu não finge o contrário', () => {
    // Os pictogramas são milhares de arquivos que ainda não entraram no repositório. Oferecê-los como
    // escolhíveis seria um botão que não faz nada — pior que a ausência, porque gasta a confiança.
    expect(caaDisponiveis().map((s) => s.key)).toEqual(['letras-mistas', 'letras-maiusculas']);
  });

  it('[Right] os três CC BY-SA estão na camada que pode viajar dentro do jogo', () => {
    for (const k of ['mulberry', 'blissymbolics', 'tawasol']) {
      expect(CAA_BY_KEY[k].tier).toBe('bundled');
      expect(CAA_BY_KEY[k].licenca).toContain('CC BY-SA');
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
    for (const s of CAA_SETS) {
      if (s.tier === 'bundled' && !s.key.startsWith('letras-')) expect(s.licenca).toBeTruthy();
    }
  });

  it('[Interface] CAA_BY_KEY cobre o catálogo inteiro, sem chave perdida', () => {
    expect(Object.keys(CAA_BY_KEY)).toHaveLength(CAA_SETS.length);
  });
});

describe('caaMotivo — duas respostas, porque são duas situações', () => {
  it('[Zero] disponível não tem motivo — não há o que explicar', () => {
    expect(caaMotivo(CAA_BY_KEY['letras-maiusculas'])).toBeNull();
  });

  it('[Right] "em preparação" quando a licença está resolvida e o trabalho é NOSSO', () => {
    expect(caaMotivo(CAA_BY_KEY.mulberry)).toBe('caa.emPreparo');
    expect(caaMotivo(CAA_BY_KEY.arasaac)).toBe('caa.emPreparo');
  });

  it('[Right] "aguardando negociação" quando a permissão é de OUTRA pessoa', () => {
    // A diferença não é de estilo: quem lê a primeira sabe esperar, quem lê a segunda sabe que esperar não
    // adianta. Um educador decide coisas diferentes com cada uma.
    for (const k of ['sclera', 'pcs', 'symbolstix', 'widgit']) {
      expect(caaMotivo(CAA_BY_KEY[k])).toBe('caa.aguardandoNegociacao');
    }
  });

  it('[Interface] o rótulo carrega o motivo junto do nome — a linha se explica sozinha', () => {
    expect(caaRotulo(CAA_BY_KEY.pcs)).toContain('PCS');
    expect(caaRotulo(CAA_BY_KEY.pcs)).toContain('negocia');
    expect(caaRotulo(CAA_BY_KEY['letras-mistas'])).toBe('Letras maiúsculas e minúsculas');
  });
});

describe('chaveSelecionada — a ponte entre `letterCase` e o catálogo', () => {
  it('[Right] upper e mixed apontam para as duas linhas de letra', () => {
    expect(chaveSelecionada('upper')).toBe('letras-maiusculas');
    expect(chaveSelecionada('mixed')).toBe('letras-mistas');
  });
});

describe('caaRowHtml / caaListHtml — a montagem', () => {
  it('[Right] o indisponível vem `disabled`: nunca um botão que não faz nada', () => {
    const html = caaRowHtml(CAA_BY_KEY.widgit, false);
    expect(html).toContain('disabled');
    expect(html).toContain('data-caa="widgit"');
  });

  it('[Right] o disponível NÃO vem disabled', () => {
    expect(caaRowHtml(CAA_BY_KEY['letras-maiusculas'], true)).not.toContain('disabled');
  });

  it('[Interface] o motivo entra também no NOME ACESSÍVEL — quem não vê a linha ouve por que ela não serve', () => {
    const html = caaRowHtml(CAA_BY_KEY.sclera, false);
    expect(html).toMatch(/aria-label="Sclera, [^"]*negocia/);
  });

  it('[Interface] a lista traz os 9 conjuntos, em três seções', () => {
    const html = caaListHtml('upper');
    for (const s of CAA_SETS) expect(html).toContain(`data-caa="${s.key}"`);
    expect(html.match(/panel-sub"/g)).toHaveLength(3);
  });

  it('[Right] só a linha escolhida vem marcada como ligada', () => {
    const html = caaListHtml('upper');
    expect(html).toMatch(/data-caa="letras-maiusculas"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-caa="letras-mistas"[^>]*aria-pressed="false"/);
  });

  it('[Interface] Tawasol carrega a nota sobre cultura — é o que muda o significado da escolha', () => {
    // Um pictograma não é neutro: é desenhado por e para uma cultura. Sem a nota, "Tawasol" é só um nome
    // estranho na lista, e o educador não tem como saber para qual criança ele é a escolha certa.
    expect(caaRowHtml(CAA_BY_KEY.tawasol, false)).toContain('árabe');
  });
});
