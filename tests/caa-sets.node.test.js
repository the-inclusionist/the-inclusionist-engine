// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/caa-sets + a lógica pura de ui/settings-caa (project node, sem document). ADR-0028, issue #57.
//
// O que estes casos protegem NÃO é a lista — é a REGRA que a ordena: a camada de cada conjunto é decidida pela
// LICENÇA dele e por mais nada. No dia em que um conjunto mudar de camada por ser bonito, popular ou fácil de
// integrar, o catálogo terá deixado de ser verdadeiro, e é aqui que isso precisa doer.
import { describe, it, expect } from 'vitest';
import { CAA_SETS, CAA_BY_KEY, caaDisponiveis, caaMotivo, caaRotulo } from '../app/js/ui/caa-sets.js';
import { caixaAltaLigada, letrasRowHtml, caaRowHtml, caaListHtml } from '../app/js/ui/settings-caa.js';

describe('CAA_SETS — o catálogo', () => {
  it('[Zero] NENHUM conjunto está disponível hoje, e o menu não finge o contrário', () => {
    // Os pictogramas são milhares de arquivos que ainda não entraram no repositório. Oferecê-los como
    // escolhíveis seria um botão que não faz nada — pior que a ausência, porque gasta a confiança.
    expect(caaDisponiveis()).toEqual([]);
  });

  it('[Boundary] as LETRAS não estão nesta lista — viraram um interruptor, não um conjunto', () => {
    // Decisão do Dev: uma pergunta binária apresentada como duas linhas obriga a criança a comparar as duas
    // para descobrir que são a mesma pergunta. Sobra aqui o que é de verdade uma lista.
    expect(CAA_SETS.some((s) => s.key.startsWith('letras'))).toBe(false);
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
    for (const s of CAA_SETS) if (s.tier === 'bundled') expect(s.licenca, s.key).toBeTruthy();
  });

  it('[Interface] CAA_BY_KEY cobre o catálogo inteiro, sem chave perdida', () => {
    expect(Object.keys(CAA_BY_KEY)).toHaveLength(CAA_SETS.length);
  });
});

describe('caaMotivo — duas respostas, porque são duas situações', () => {
  it('[Zero] disponível não tem motivo — não há o que explicar', () => {
    expect(caaMotivo({ ...CAA_BY_KEY.mulberry, disponivel: true })).toBeNull();
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
  });
});

describe('o interruptor das letras', () => {
  it('[Right] ligado é `upper`; desligado é `mixed`, que INCLUI as minúsculas', () => {
    expect(caixaAltaLigada('upper')).toBe(true);
    expect(caixaAltaLigada('mixed')).toBe(false);
  });

  it('[Right] a linha reflete o estado no botão e no aria-pressed', () => {
    expect(letrasRowHtml(true)).toContain('aria-pressed="true"');
    expect(letrasRowHtml(false)).toContain('aria-pressed="false"');
  });

  it('[Interface] a linha explica o DESLIGADO — senão "off" fica sem significado', () => {
    // O off não é "sem letras": é maiúsculas E minúsculas. Um interruptor cujo desligado não se explica
    // deixa a criança adivinhando o que ela perde ao desligá-lo.
    expect(letrasRowHtml(false)).toContain('minúsculas');
  });

  it('[Interface] o interruptor NUNCA vem disabled — é o piso, e não depende de arquivo nenhum', () => {
    expect(letrasRowHtml(true)).not.toContain('disabled');
  });
});

describe('caaRowHtml / caaListHtml — a montagem', () => {
  it('[Right] o indisponível vem `disabled`: nunca um botão que não faz nada', () => {
    const html = caaRowHtml(CAA_BY_KEY.widgit, false);
    expect(html).toContain('disabled');
    expect(html).toContain('data-caa="widgit"');
  });

  it('[Right] o disponível NÃO vem disabled — o dia em que um conjunto entrar, esta linha muda sozinha', () => {
    expect(caaRowHtml({ ...CAA_BY_KEY.mulberry, disponivel: true }, true)).not.toContain('disabled');
  });

  it('[Interface] o motivo entra também no NOME ACESSÍVEL — quem não vê a linha ouve por que ela não serve', () => {
    const html = caaRowHtml(CAA_BY_KEY.sclera, false);
    expect(html).toMatch(/aria-label="Sclera, [^"]*negocia/);
  });

  it('[Interface] a lista traz o interruptor mais os 8 conjuntos, em três seções', () => {
    const html = caaListHtml('upper');
    expect(html).toContain('id="caa-caixa-alta"');
    for (const s of CAA_SETS) expect(html).toContain(`data-caa="${s.key}"`);
    expect(html.match(/panel-sub"/g)).toHaveLength(3);
  });

  it('[Right] o interruptor reflete a caixa atual', () => {
    expect(caaListHtml('upper')).toMatch(/id="caa-caixa-alta"[^>]*aria-pressed="true"/);
    expect(caaListHtml('mixed')).toMatch(/id="caa-caixa-alta"[^>]*aria-pressed="false"/);
  });

  it('[Interface] Tawasol carrega a nota sobre cultura — é o que muda o significado da escolha', () => {
    // Um pictograma não é neutro: é desenhado por e para uma cultura. Sem a nota, "Tawasol" é só um nome
    // estranho na lista, e o educador não tem como saber para qual criança ele é a escolha certa.
    expect(caaRowHtml(CAA_BY_KEY.tawasol, false)).toContain('árabe');
  });
});
