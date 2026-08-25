// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de game/progress — a senha DESTE jogo (item 23). Project node.
//
// Metade destes casos não testa código: testa uma PROMESSA sobre o futuro. A senha é escrita a lápis num
// caderno e lida semanas depois, então o formato é um contrato com o passado — e a única forma de um contrato
// com o passado sobreviver a um repositório vivo é alguém quebrar o build quando ele for violado.
//
// Duas violações são possíveis, e nenhuma delas dá erro em tempo de execução:
//   · mexer na ORDEM das atividades na senha (a senha certa passa a abrir a atividade errada);
//   · acrescentar uma atividade ao catálogo e esquecer de lhe dar lugar na senha (ela some da senha em
//     silêncio, e quem estava nela recebe "ludico" ao voltar).
// Os casos do bloco [Contrato] existem para isso, e é normal que um deles falhe quando o catálogo cresce: a
// correção é ACRESCENTAR ao fim da lista, nunca reordenar para o teste passar.
//
// ⚠️ O QUE ESTES CASOS NÃO ALCANÇAM HOJE, conferido por mutação: trocar `ORDEM_SENHA` por `listActivityIds()`
// dentro de `senhaDe` passa nos treze casos. Passa porque as duas listas estão, HOJE, na mesma ordem — a da
// senha nasceu copiada da do catálogo. A troca só produz senha errada no dia em que o menu for reordenado, e
// é nesse mesmo dia que as cinco senhas fixadas abaixo mudam e quebram o build. Quando isso acontecer, a
// correção é o código voltar a ler `ORDEM_SENHA`; reescrever as cinco senhas é rasgar o caderno da professora.
import { describe, it, expect } from 'vitest';
import {
  ORDEM_SENHA, CAMPOS, COMPRIMENTO_SENHA,
  senhaDe, progressoDe, senhaLegivel, progressoAtual, aplicarProgresso,
} from '../app/js/game/progress.js';
import { listActivityIds } from '../app/js/educational/activities-registry.js';
import { criarCodec } from '../app/js/core/password.js';

describe('[Contrato] a lista que só pode crescer, e só no fim', () => {
  it('o prefixo de hoje é o prefixo de sempre', () => {
    // Não é um retrato do arquivo: é a afirmação de que estes 18 ids ocupam ESTES 18 números para sempre.
    // Reordenar aqui para "consertar" o teste é exatamente o defeito que ele existe para impedir.
    expect([...ORDEM_SENHA]).toEqual([
      'ludico',
      'alf1', 'alf2', 'alf3', 'alf4', 'alf5',
      'mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6',
      'fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6',
    ]);
  });

  it('toda atividade do catálogo tem lugar na senha', () => {
    const sem = listActivityIds().filter((id) => !ORDEM_SENHA.includes(id));
    expect(sem, `atividade(s) sem lugar na senha — ACRESCENTE ao FIM de ORDEM_SENHA: ${sem.join(', ')}`).toEqual([]);
  });

  it('CINCO senhas de verdade, letra por letra — o contrato com o caderno', () => {
    // A pinagem que as outras não fazem. Ida-e-volta continua passando se alguém trocar o alfabeto, a ordem
    // lida, a largura dos campos ou a soma — porque escrita e leitura mudam JUNTAS. O que não muda junto é o
    // papel: a senha que a professora anotou em agosto tem de abrir o mesmo nível em novembro. Estas cinco
    // letras a letra são a única coisa neste repositório que afirma isso.
    expect(senhaDe({ atividade: 'ludico', nivel: 1 })).toBe('0204');
    expect(senhaDe({ atividade: 'alf3', nivel: 2 })).toBe('1M19');
    expect(senhaDe({ atividade: 'alf5', nivel: 5 })).toBe('2T1P');
    expect(senhaDe({ atividade: 'mat6', nivel: 3 })).toBe('5P1H');
    expect(senhaDe({ atividade: 'fr2a6', nivel: 4 })).toBe('8R1R');
  });

  it('sem id repetido, e dentro dos 64 lugares dos 6 bits', () => {
    expect(new Set(ORDEM_SENHA).size).toBe(ORDEM_SENHA.length);
    const bits = CAMPOS.find((c) => c.nome === 'atividade').bits;
    expect(ORDEM_SENHA.length).toBeLessThanOrEqual(2 ** bits);
  });
});

describe('ida e volta', () => {
  it('[Right] TODA combinação de atividade e nível volta inteira', () => {
    // 18 × 5 = 90 casos. É barato o bastante para ser exaustivo, e exaustivo é o que se quer de um formato
    // que alguém vai digitar sem poder conferir.
    let n = 0;
    for (const atividade of ORDEM_SENHA) {
      for (let nivel = 1; nivel <= 5; nivel++) {
        expect(progressoDe(senhaDe({ atividade, nivel }))).toEqual({ atividade, nivel });
        n++;
      }
    }
    expect(n).toBe(ORDEM_SENHA.length * 5);
  });

  it('[Interface] QUATRO caracteres, sempre os mesmos quatro', () => {
    expect(COMPRIMENTO_SENHA).toBe(4);
    for (const atividade of ORDEM_SENHA) expect(senhaDe({ atividade, nivel: 3 })).toHaveLength(4);
  });

  it('[Right] senhas diferentes para progressos diferentes', () => {
    const vistas = new Set();
    for (const atividade of ORDEM_SENHA) for (let nivel = 1; nivel <= 5; nivel++) vistas.add(senhaDe({ atividade, nivel }));
    expect(vistas.size).toBe(ORDEM_SENHA.length * 5); // nenhuma colisão: 90 progressos, 90 senhas
  });

  it('[Interface] a senha legível é a MESMA senha', () => {
    const p = { atividade: 'alf3', nivel: 4 };
    expect(senhaLegivel(p)).toBe(senhaDe(p).slice(0, 2) + '-' + senhaDe(p).slice(2));
    expect(progressoDe(senhaLegivel(p))).toEqual(p);
  });
});

describe('o que não deveria acontecer, e acontece', () => {
  it('[Zero] senha inválida é `null` — nunca um progresso inventado', () => {
    expect(progressoDe('')).toBeNull();
    expect(progressoDe('ABCDE')).toBeNull();
    expect(progressoDe('!!!!')).toBeNull();
  });

  it('[Boundary] nível fora da faixa é aparado, na escrita e na leitura', () => {
    // Uma senha de uma versão futura pode carregar nível 6 nos mesmos 3 bits. Aparar na leitura é o que
    // impede o jogo de abrir num nível que não existe.
    expect(progressoDe(senhaDe({ atividade: 'alf1', nivel: 9 }))).toEqual({ atividade: 'alf1', nivel: 5 });
    expect(progressoDe(senhaDe({ atividade: 'alf1', nivel: 0 }))).toEqual({ atividade: 'alf1', nivel: 1 });
    expect(progressoDe(senhaDe({ atividade: 'alf1', nivel: NaN }))).toEqual({ atividade: 'alf1', nivel: 1 });
  });

  it('[Boundary] senha de uma versão FUTURA, com um nível que ainda não existe', () => {
    // Este caso não passa por `senhaDe` de propósito: ele FORJA a senha com o mesmo codec, como faria uma
    // versão futura do jogo que tivesse seis níveis. É a única forma de exercitar o aparo na LEITURA — pela
    // escrita ele é inalcançável, porque `senhaDe` já apara antes. (Sem ele, apagar o aparo da leitura passa
    // por todos os outros doze casos: conferido por mutação.)
    const futura = criarCodec([{ nome: 'atividade', bits: 6 }, { nome: 'nivel', bits: 3 }])
      .codificar({ atividade: 3, nivel: 7 });
    expect(progressoDe(futura)).toEqual({ atividade: ORDEM_SENHA[3], nivel: 5 });
  });

  it('[Zero] atividade desconhecida vira a primeira — a criança perde a atividade, não o nível', () => {
    expect(progressoDe(senhaDe({ atividade: 'nao-existe', nivel: 4 }))).toEqual({ atividade: 'ludico', nivel: 4 });
  });
});

describe('as duas pontas que tocam o estado vivo', () => {
  it('[Right] aplicar e ler de volta dá o mesmo progresso', () => {
    // O caso que prova que a senha serve para alguma coisa: ela entra no estado do jogo e sai dele igual.
    const p = { atividade: 'alf4', nivel: 5 };
    aplicarProgresso(p);
    expect(progressoAtual()).toEqual(p);
    expect(senhaDe(progressoAtual())).toBe(senhaDe(p));
  });

  it('[Boundary] aplicar uma senha lida fecha o ciclo inteiro: senha → estado → senha', () => {
    const original = senhaDe({ atividade: 'mat5', nivel: 2 });
    aplicarProgresso(progressoDe(original));
    expect(senhaDe(progressoAtual())).toBe(original);
  });
});
