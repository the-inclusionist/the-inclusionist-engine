// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate do ADR-0084. `topology` é FUNÇÃO, e a diferença entre função e valor tem de ser VISÍVEL —
// não uma coincidência que o TypeScript aceita e a produção descobre.
//
// ⚠️ O QUE ESTE FICHEIRO EXISTE PARA IMPEDIR, e é uma coisa concreta: um jogo escrito antes desta
// mudança, ou copiado de um exemplo velho, entrega `topology: { kind: 'grid', ... }`. Isso passa por
// `conformanceProblems` se ele só perguntar "existe?", e morre no primeiro quadro com
// «o.declaration.topology is not a function» — uma tela congelada, que para quem não enxerga é
// indistinguível de um jogo que simplesmente não começou.
import { describe, it, expect } from 'vitest';
import { conformanceProblems, distance } from '../app/js/core/contract.js';

const GRADE = { kind: 'grid', cols: 8, rows: 8 };

/** Uma declaração conforme, mínima. */
const valida = (over = {}) => ({
  topology: () => GRADE,
  tick: 'player',
  roleAt: () => 'free',
  nameAt: () => ({ text: 'peça', gender: 'f', plural: false }),
  focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'peças', gender: 'f', plural: true }, have: 0, need: 1 }),
  targetsOf: () => [],
  ...over,
});

describe('topology é função (ADR-0084)', () => {
  it('a declaração conforme passa', () => {
    expect(conformanceProblems(valida())).toEqual([]);
  });

  it('⚠️ topology COMO VALOR é reprovada, e a mensagem diz o que fazer', () => {
    const problemas = conformanceProblems(valida({ topology: GRADE }));
    expect(problemas).toHaveLength(1);
    // A mensagem não pode dizer só "ausente": o campo está lá, à vista, e mandaria o autor procurar
    // uma coisa que ele já escreveu.
    expect(problemas[0]).toMatch(/FUNCTION/);
    expect(problemas[0]).not.toMatch(/missing/);
  });

  it('topology ausente continua a ser reprovada, e com OUTRA mensagem', () => {
    const problemas = conformanceProblems(valida({ topology: undefined }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/missing/);
  });

  it('uma função que não devolve nada é reprovada — é o getter partido', () => {
    const problemas = conformanceProblems(valida({ topology: () => undefined }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/returned nothing/);
  });
});

describe('a topologia é REAVALIADA, que é a razão inteira da mudança', () => {
  it('um tabuleiro que muda de tamanho é lido pelo tamanho de agora', () => {
    // O caso medido: o game-15puzzle é 3×3, 4×4 ou 5×5, escolhido em tempo de jogo.
    let lado = 3;
    const d = valida({ topology: () => ({ kind: 'grid', cols: lado, rows: lado }) });

    expect(d.topology().cols).toBe(3);
    expect(conformanceProblems(d)).toEqual([]);

    lado = 5;
    // ⚠️ A IGUALDADE ABAIXO É A DECISÃO. Com `topology` como valor, este 5 seria um 3 — o objeto foi
    // lido uma vez, na construção, e nada tornava a perguntar.
    expect(d.topology().cols).toBe(5);
    expect(conformanceProblems(d)).toEqual([]);
  });

  it('e a medida do sonar acompanha o tabuleiro novo', () => {
    let lado = 3;
    const topology = () => ({ kind: 'grid', cols: lado, rows: lado });
    const canto = () => ({ x: topology().cols - 1, y: topology().rows - 1 });

    expect(distance(topology(), { x: 0, y: 0 }, canto())).toBe(2);
    lado = 5;
    expect(distance(topology(), { x: 0, y: 0 }, canto())).toBe(4);
  });

  it('uma declaração cujo tamanho fica inválido passa a ser reprovada NA HORA', () => {
    let cols = 4;
    const d = valida({ topology: () => ({ kind: 'grid', cols, rows: 4 }) });
    expect(conformanceProblems(d)).toEqual([]);
    cols = 0; // um bug do jogo: o tabuleiro colapsou
    expect(conformanceProblems(d)).toHaveLength(1);
  });
});
