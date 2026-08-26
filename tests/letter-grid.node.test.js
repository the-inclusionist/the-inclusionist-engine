// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/letter-grid — a mecânica da ENTRADA DE TEXTO SEM TECLADO (project node, sem DOM e sem PIXI).
//
// O alvo destes casos não é "o cursor anda". É a fronteira: as bordas, a LINHA INCOMPLETA e o valor cheio —
// os três lugares onde uma grade cai num índice que não existe e o leitor de tela anuncia vazio.
import { describe, it, expect } from 'vitest';
import { criarGrade } from '../app/js/core/letter-grid.js';
import { ALFABETO } from '../app/js/core/password.js';

/** A grade da senha: os 32 símbolos de Crockford em 8 colunas — 4 linhas cheias, sem sobra. */
const gradeSenha = (capacidade = 4) => criarGrade({ simbolos: ALFABETO, colunas: 8, capacidade });

/** Uma grade com SOBRA: 10 símbolos em 4 colunas dão 2 linhas cheias e uma terceira com 2. */
const gradeTorta = () => criarGrade({ simbolos: 'ABCDEFGHIJ', colunas: 4 });

describe('criarGrade — o que a grade recusa a nascer', () => {
  it('sem símbolo nenhum: uma grade sem casa não tem cursor, e um cursor sem casa vira undefined três telas adiante', () => {
    expect(() => criarGrade({ simbolos: '', colunas: 4 })).toThrow('simbolos');
  });
  it('colunas inválidas — zero, negativo e fracionário', () => {
    for (const colunas of [0, -1, 2.5]) {
      expect(() => criarGrade({ simbolos: 'AB', colunas }), String(colunas)).toThrow('colunas');
    }
  });
  it('capacidade inválida', () => {
    expect(() => criarGrade({ simbolos: 'AB', colunas: 2, capacidade: -1 })).toThrow('capacidade');
  });
});

describe('a forma da grade', () => {
  it('os 32 símbolos da senha cabem em 8×4, exatamente', () => {
    const g = gradeSenha();
    expect(g.simbolos).toHaveLength(32);
    expect(g.colunas).toBe(8);
    expect(g.linhas).toBe(4);
  });
  it('sobra vira uma linha a mais, não um erro', () => {
    const g = gradeTorta();
    expect(g.linhas).toBe(3); // 4 + 4 + 2
  });
  it('o cursor nasce na primeira casa', () => {
    const g = gradeSenha();
    expect(g.indice()).toBe(0);
    expect(g.posicao()).toEqual({ linha: 0, coluna: 0 });
    expect(g.sob()).toBe('0');
  });
});

describe('mover — as quatro bordas enrolam em TOROIDE', () => {
  it('direita anda na linha e volta ao começo DELA, não da grade', () => {
    const g = gradeSenha();
    for (let i = 0; i < 7; i++) g.mover('direita');
    expect(g.posicao()).toEqual({ linha: 0, coluna: 7 });
    g.mover('direita');
    expect(g.posicao()).toEqual({ linha: 0, coluna: 0 }); // a LINHA é preservada — é o ponto do toroide
  });
  it('esquerda na coluna 0 vai para o fim da MESMA linha', () => {
    const g = gradeSenha();
    g.mover('baixo'); // linha 1
    g.mover('esquerda');
    expect(g.posicao()).toEqual({ linha: 1, coluna: 7 });
  });
  it('baixo anda na coluna e enrola para a linha 0', () => {
    const g = gradeSenha();
    for (let i = 0; i < 3; i++) g.mover('baixo');
    expect(g.posicao()).toEqual({ linha: 3, coluna: 0 });
    g.mover('baixo');
    expect(g.posicao()).toEqual({ linha: 0, coluna: 0 });
  });
  it('cima na linha 0 vai para a última linha da MESMA coluna', () => {
    const g = gradeSenha();
    g.mover('direita'); g.mover('direita'); // coluna 2
    g.mover('cima');
    expect(g.posicao()).toEqual({ linha: 3, coluna: 2 });
  });
  it('um passeio horizontal completo volta exatamente ao ponto de partida', () => {
    const g = gradeSenha();
    g.mover('baixo');
    const partida = g.indice();
    for (let i = 0; i < 8; i++) g.mover('direita');
    expect(g.indice()).toBe(partida);
  });
});

describe('a LINHA INCOMPLETA — onde uma grade cai num buraco', () => {
  it('a última linha enrola no tamanho DELA', () => {
    const g = gradeTorta(); // 'ABCDEFGHIJ' em 4 colunas: última linha = I, J
    expect(g.irPara('I')).toBe(true);
    expect(g.posicao()).toEqual({ linha: 2, coluna: 0 });
    g.mover('direita');
    expect(g.sob()).toBe('J');
    g.mover('direita'); // fim da linha curta
    expect(g.sob()).toBe('I');
  });
  it('descer numa coluna que a última linha NÃO tem pula a linha, em vez de cair no vazio', () => {
    const g = gradeTorta();
    expect(g.irPara('G')).toBe(true); // linha 1, coluna 2 — a linha 2 só tem as colunas 0 e 1
    g.mover('baixo');
    expect(g.sob()).toBe('C'); // pulou a linha curta e enrolou para a linha 0, mesma coluna
    expect(g.posicao()).toEqual({ linha: 0, coluna: 2 });
  });
  it('toda tecla, de toda casa, cai numa casa que EXISTE', () => {
    const g = gradeTorta();
    for (let inicio = 0; inicio < 10; inicio++) {
      for (const dir of ['esquerda', 'direita', 'cima', 'baixo']) {
        const h = gradeTorta();
        for (let i = 0; i < inicio; i++) h.mover('direita');
        h.mover(dir);
        expect(typeof h.sob(), `de ${inicio} para ${dir}`).toBe('string');
        expect(h.sob()).not.toBe('');
      }
    }
  });
});

describe('irPara — o mapeamento símbolo → posição, que a leitura de tela precisa', () => {
  it('leva ao símbolo e devolve true', () => {
    const g = gradeSenha();
    expect(g.irPara('Z')).toBe(true);
    expect(g.sob()).toBe('Z');
    expect(g.posicao()).toEqual({ linha: 3, coluna: 7 });
  });
  it('símbolo fora da grade devolve false e NÃO move o cursor', () => {
    const g = gradeSenha();
    g.irPara('B');
    const antes = g.indice();
    expect(g.irPara('L')).toBe(false); // L não existe no alfabeto de Crockford
    expect(g.indice()).toBe(antes);
  });
  it('cada símbolo do alfabeto tem uma posição, e ela devolve o próprio símbolo', () => {
    const g = gradeSenha();
    for (const s of ALFABETO) {
      expect(g.irPara(s), s).toBe(true);
      expect(g.sob(), s).toBe(s);
    }
  });
});

describe('o valor digitado', () => {
  it('digitar acumula o símbolo sob o cursor', () => {
    const g = gradeSenha();
    g.irPara('0'); g.digitar();
    g.irPara('2'); g.digitar();
    expect(g.valor()).toBe('02');
    expect(g.faltam()).toBe(2);
    expect(g.completo()).toBe(false);
  });
  it('cheio para de aceitar — a quinta tecla não vira quinta casa', () => {
    const g = gradeSenha(4);
    for (const s of ['0', '2', '0', '4']) { g.irPara(s); g.digitar(); }
    expect(g.valor()).toBe('0204');
    expect(g.completo()).toBe(true);
    expect(g.faltam()).toBe(0);
    g.irPara('9'); g.digitar();
    expect(g.valor()).toBe('0204');
  });
  it('apagar tira a última casa, e no vazio não faz nada', () => {
    const g = gradeSenha();
    g.digitar(); g.apagar();
    expect(g.valor()).toBe('');
    g.apagar();
    expect(g.valor()).toBe('');
  });
  it('limpar esvazia o valor e NÃO mexe no cursor', () => {
    const g = gradeSenha();
    g.irPara('K'); g.digitar(); g.digitar();
    const onde = g.indice();
    g.limpar();
    expect(g.valor()).toBe('');
    expect(g.indice()).toBe(onde); // quem apagou continua olhando para onde estava
  });
  it('sem capacidade declarada não há limite nem "faltam" — é o caso dos jogos de palavra', () => {
    const g = criarGrade({ simbolos: ALFABETO, colunas: 8 });
    for (let i = 0; i < 40; i++) g.digitar();
    expect(g.valor()).toHaveLength(40);
    expect(g.faltam()).toBeNull();
    expect(g.completo()).toBe(false);
  });
});

describe('duas grades na mesma página não se pisam (D13: sem estado de módulo)', () => {
  it('mover e digitar numa não mexe na outra', () => {
    const a = gradeSenha();
    const b = gradeSenha();
    a.mover('direita'); a.digitar();
    expect(b.indice()).toBe(0);
    expect(b.valor()).toBe('');
  });
});
