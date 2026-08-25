// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/password — o codec de códigos curtos copiados à mão. Project node: nada de DOM, nada de PIXI.
//
// O arquivo tem duas metades, e a segunda é a que justifica o módulo existir.
//
// A primeira é o de sempre: ida e volta, extremos, esquema malformado. A segunda é a VERIFICAÇÃO, e ela não
// é feita por amostragem — é EXAUSTIVA sobre os dois erros que uma criança comete ao copiar do quadro: trocar
// um símbolo, e trocar dois de lugar. Para um código do tamanho real isso são algumas centenas de casos, todos
// gerados aqui. Um teste que sorteasse dez deles diria "provavelmente"; este diz "sempre", e "sempre" é
// exatamente a afirmação que o módulo faz no comentário do topo.
//
// Por que a afirmação importa tanto: um código errado que PASSA leva a criança para OUTRA SALA — a atividade
// de outra turma, escolhida por outro professor. Não há mensagem de erro, não há log, só uma criança fazendo
// a lição errada e ninguém na sala entendendo por quê.
//
// O que estes testes NÃO cobrem, dito para ninguém confiar demais: o significado dos campos. Ele morreu junto
// com `game/progress` (ADR-0037) e o da sala do professor ainda não nasceu. O que está provado aqui é a
// aritmética — e era ela que valia a pena guardar quando o resto foi apagado.
import { describe, it, expect } from 'vitest';
import { criarCodec, formatar, ALFABETO } from '../app/js/core/password.js';

/**
 * Um esquema do PORTE de um código real — quatro campos, 13 bits, 5 caracteres. Não corresponde a nenhum
 * esquema em uso: o do jogo (`game/progress`) foi APAGADO com o ADR-0037, e o da sala do professor ainda não
 * existe. O que interessa aqui é um corpo com três símbolos, para que os casos exaustivos de troca de posição
 * tenham pares de posições para trocar.
 */
const ESQUEMA = [
  { nome: 'atividade', bits: 5 },
  { nome: 'nivel', bits: 3 },
  { nome: 'luzes', bits: 2 },
  { nome: 'cenario', bits: 3 },
];

describe('o alfabeto', () => {
  it('[Interface] 32 símbolos, sem I, L, O e U', () => {
    expect(ALFABETO).toHaveLength(32);
    expect(new Set(ALFABETO).size).toBe(32); // sem repetido: o índice tem de ser único
    for (const proibido of ['I', 'L', 'O', 'U']) expect(ALFABETO).not.toContain(proibido);
  });
});

describe('ida e volta', () => {
  it('[Right] o que entra é o que sai', () => {
    const c = criarCodec(ESQUEMA);
    const v = { atividade: 17, nivel: 4, luzes: 2, cenario: 5 };
    const s = c.codificar(v);
    expect(c.decodificar(s)).toEqual(v);
  });

  it('[Zero] tudo em zero é senha válida — e não é a senha vazia', () => {
    const c = criarCodec(ESQUEMA);
    const s = c.codificar({ atividade: 0, nivel: 0, luzes: 0, cenario: 0 });
    expect(s).toHaveLength(c.comprimento);
    expect(c.decodificar(s)).toEqual({ atividade: 0, nivel: 0, luzes: 0, cenario: 0 });
  });

  it('[Boundary] o teto de cada campo (2^bits − 1) cabe', () => {
    const c = criarCodec(ESQUEMA);
    const v = { atividade: 31, nivel: 7, luzes: 3, cenario: 7 };
    expect(c.decodificar(c.codificar(v))).toEqual(v);
  });

  it('[Interface] toda senha do esquema tem o MESMO comprimento', () => {
    // A grade de letras desenha um número fixo de casas. Se o comprimento variasse com o valor, a tela teria
    // de se redesenhar a cada símbolo escolhido — e a criança veria a senha "encolher" ao trocar de nível.
    const c = criarCodec(ESQUEMA);
    for (let a = 0; a < 32; a++) expect(c.codificar({ atividade: a, nivel: 1, luzes: 0, cenario: 0 })).toHaveLength(c.comprimento);
  });

  it('[Boundary] 120 bits em quatro campos de 30 — o motivo de empacotar bit a bit', () => {
    // Um acumulador com `<<` estouraria os 32 bits dos operadores do JS aqui, e o sintoma seria uma senha que
    // decodifica certo nos primeiros campos e errado nos últimos. Este caso é o que impede aquela "simplificação".
    const c = criarCodec([{ nome: 'a', bits: 30 }, { nome: 'b', bits: 30 }, { nome: 'c', bits: 30 }, { nome: 'd', bits: 30 }]);
    const v = { a: 2 ** 30 - 1, b: 0, c: 123456789, d: 2 ** 29 };
    expect(c.decodificar(c.codificar(v))).toEqual(v);
  });

  it('[Right] a ORDEM dos campos é a declarada — dois esquemas com os mesmos nomes não são o mesmo codec', () => {
    const c1 = criarCodec([{ nome: 'a', bits: 4 }, { nome: 'b', bits: 4 }]);
    const c2 = criarCodec([{ nome: 'b', bits: 4 }, { nome: 'a', bits: 4 }]);
    expect(c1.codificar({ a: 1, b: 2 })).not.toBe(c2.codificar({ a: 1, b: 2 }));
  });
});

describe('lendo o que a criança escreveu', () => {
  const c = criarCodec(ESQUEMA);
  const v = { atividade: 9, nivel: 3, luzes: 1, cenario: 2 };
  const s = c.codificar(v);

  it('[Right] minúsculas valem', () => {
    expect(c.decodificar(s.toLowerCase())).toEqual(v);
  });

  it('[Right] separadores são ignorados — a senha agrupada é a MESMA senha', () => {
    expect(c.decodificar(formatar(s))).toEqual(v);
    expect(c.decodificar(formatar(s, 2, ' '))).toEqual(v);
    expect(c.decodificar(formatar(s, 3, '·'))).toEqual(v);
  });

  it('[Right] a leniência de Crockford: I e L viram 1, O vira 0', () => {
    // Quem copiou do caderno a lápis escreve O onde o jogo escreveu 0. Perdoar na LEITURA custa nada; o
    // contrário — escrever O — nunca acontece, porque O não está no alfabeto.
    const comZeroEUm = criarCodec([{ nome: 'x', bits: 5 }, { nome: 'y', bits: 5 }]);
    const senha = comZeroEUm.codificar({ x: 0, y: 1 }); // símbolos '0' e '1'
    expect(senha.startsWith('01')).toBe(true);
    expect(comZeroEUm.decodificar('OI' + senha.slice(2))).toEqual({ x: 0, y: 1 });
    expect(comZeroEUm.decodificar('Ol' + senha.slice(2))).toEqual({ x: 0, y: 1 });
  });

  it('[Zero] comprimento errado é `null`, para menos e para mais', () => {
    expect(c.decodificar('')).toBeNull();
    expect(c.decodificar(s.slice(0, -1))).toBeNull();
    expect(c.decodificar(s + '5')).toBeNull();
  });

  it('[Zero] símbolo fora do alfabeto é `null` — não se adivinha o que ela quis dizer', () => {
    expect(c.decodificar('@' + s.slice(1))).toBeNull();
    expect(c.decodificar(s.slice(0, -1) + 'ç')).toBeNull();
  });

  it('[Interface] o que não é texto é `null`, e não exceção', () => {
    expect(c.decodificar(null)).toBeNull();
    expect(c.decodificar(undefined)).toBeNull();
    expect(c.decodificar(42)).toBeNull();
  });
});

describe('a verificação — exaustiva, não por amostragem', () => {
  const c = criarCodec(ESQUEMA);
  const s = c.codificar({ atividade: 21, nivel: 5, luzes: 3, cenario: 6 });
  const corpo = c.comprimento - 2;

  it('[Boundary] TODA troca de um símbolo por outro é rejeitada — em qualquer posição', () => {
    let testadas = 0;
    for (let i = 0; i < s.length; i++) {
      for (const ch of ALFABETO) {
        if (ch === s[i]) continue;
        const errada = s.slice(0, i) + ch + s.slice(i + 1);
        expect(c.decodificar(errada), `posição ${i} trocada por ${ch}`).toBeNull();
        testadas++;
      }
    }
    expect(testadas).toBe(s.length * 31); // a conta fecha: nada foi pulado por acidente
  });

  it('[Boundary] TODA troca de dois símbolos do corpo de lugar é rejeitada', () => {
    let testadas = 0;
    for (let i = 0; i < corpo; i++) {
      for (let j = i + 1; j < corpo; j++) {
        if (s[i] === s[j]) continue; // trocar iguais de lugar não é erro: é a mesma senha
        const a = s.split('');
        [a[i], a[j]] = [a[j], a[i]];
        expect(c.decodificar(a.join('')), `posições ${i}↔${j}`).toBeNull();
        testadas++;
      }
    }
    expect(testadas).toBeGreaterThan(0); // se a senha fosse toda de símbolos iguais, este caso não afirmaria nada
  });

  it('[Boundary] enchimento não-zero é rejeitado — essa senha não pode ter saído daqui', () => {
    // 13 bits de esquema ⇒ 3 símbolos (15 bits) ⇒ 2 bits de enchimento. Uma senha com lixo ali não é
    // produzível por `codificar`, e aceitá-la seria aceitar como válido algo que o módulo não sabe gerar.
    const cc = criarCodec([{ nome: 'a', bits: 13 }]);
    const boa = cc.codificar({ a: 8191 });
    const corpoBom = boa.slice(0, cc.comprimento - 2);
    // acha um último símbolo com enchimento sujo e RECALCULA a soma, para que só o enchimento reprove
    const ultimo = ALFABETO.indexOf(corpoBom[2]);
    const sujo = corpoBom.slice(0, 2) + ALFABETO[ultimo | 1]; // liga o bit menos significativo (enchimento)
    expect(sujo).not.toBe(corpoBom);
    const simbolos = [...sujo].map((ch) => ALFABETO.indexOf(ch));
    let acc = 0;
    for (let i = 0; i < simbolos.length; i++) acc = (acc + (i + 1) * simbolos[i]) % 1021;
    const comSomaBoa = sujo + ALFABETO[(acc >> 5) & 31] + ALFABETO[acc & 31];
    expect(cc.decodificar(comSomaBoa)).toBeNull(); // a soma confere; o enchimento não
  });

  it('[Boundary] senha forjada ao acaso quase nunca cola — e o "quase" é ~1/1021', () => {
    // Não é um teste de aleatoriedade: é a varredura EXAUSTIVA de um esquema pequeno. Com 5 bits de corpo,
    // existem 32·32·32 senhas possíveis e só 32 legítimas; o teste conta as que passam.
    const cc = criarCodec([{ nome: 'x', bits: 5 }]);
    let passaram = 0;
    for (const a of ALFABETO) for (const b of ALFABETO) for (const d of ALFABETO) {
      if (cc.decodificar(a + b + d)) passaram++;
    }
    expect(passaram).toBe(32); // exatamente as 32 legítimas, nem uma a mais
  });
});

describe('esquema malformado lança — porque é erro de programa', () => {
  it('[Error] esquema vazio', () => {
    expect(() => criarCodec([])).toThrow(/empty schema/);
  });

  it('[Error] nome repetido — o segundo apagaria o primeiro na leitura', () => {
    expect(() => criarCodec([{ nome: 'a', bits: 3 }, { nome: 'a', bits: 4 }])).toThrow(/declared twice/);
  });

  it('[Error] bits fora de 1..30', () => {
    expect(() => criarCodec([{ nome: 'a', bits: 0 }])).toThrow(/1 to 30/);
    expect(() => criarCodec([{ nome: 'a', bits: 31 }])).toThrow(/1 to 30/);
    expect(() => criarCodec([{ nome: 'a', bits: 2.5 }])).toThrow(/1 to 30/);
  });

  it('[Boundary] o limite de 32 símbolos é o LIMITE DA GARANTIA, e por isso lança em vez de degradar', () => {
    // 160 bits = 32 símbolos: passa. 165 = 33: não. Aceitar o 33 daria uma senha que parece funcionar e que
    // deixa de detectar trocas de posição sem nenhum sintoma — a pior forma de quebra possível aqui.
    const campos = Array.from({ length: 16 }, (_, i) => ({ nome: 'c' + i, bits: 10 })); // 160 bits = 32 símbolos
    expect(() => criarCodec(campos)).not.toThrow();
    expect(() => criarCodec([...campos, { nome: 'gota', bits: 1 }])).toThrow(/33 symbols/); // 161 bits = 33
  });
});

describe('valor que não cabe lança — aparar em silêncio devolveria outra progressão', () => {
  const c = criarCodec(ESQUEMA);
  const base = { atividade: 1, nivel: 1, luzes: 0, cenario: 0 };

  it('[Error] acima do teto do campo', () => {
    expect(() => c.codificar({ ...base, nivel: 8 })).toThrow(/"nivel" got 8.*0 to 7/s);
  });

  it('[Error] negativo, fracionário, ausente', () => {
    expect(() => c.codificar({ ...base, luzes: -1 })).toThrow(/"luzes"/);
    expect(() => c.codificar({ ...base, luzes: 1.5 })).toThrow(/"luzes"/);
    expect(() => c.codificar({ atividade: 1, nivel: 1, luzes: 0 })).toThrow(/"cenario"/);
  });

  it('[Interface] campo A MAIS é ignorado — o esquema manda, não o objeto', () => {
    // O jogo passa o objeto de progresso inteiro; exigir que ele não tenha nada além do esquema obrigaria a
    // recortá-lo em cada chamada, e o recorte é justamente o que o codec já faz.
    expect(c.decodificar(c.codificar({ ...base, sobrando: 99 }))).toEqual(base);
  });
});

describe('formatar', () => {
  it('[Right] agrupa de 4 em 4 por padrão', () => {
    expect(formatar('A1B2C3D4')).toBe('A1B2-C3D4');
    expect(formatar('A1B2C3')).toBe('A1B2-C3');
  });

  it('[Zero] grupo inválido devolve a senha intacta — nunca uma senha quebrada', () => {
    expect(formatar('ABCD', 0)).toBe('ABCD');
    expect(formatar('', 4)).toBe('');
  });
});
