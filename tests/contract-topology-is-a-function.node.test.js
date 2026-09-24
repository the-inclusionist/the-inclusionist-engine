// SPDX-License-Identifier: AGPL-3.0-or-later
// The ADR-0084 gate. `topology` is a FUNCTION, and the difference between function and value must be VISIBLE — not a
// coincidence TypeScript accepts and production discovers.
//
// ⚠️ WHAT THIS FILE EXISTS TO PREVENT, and it is concrete: a game written before this change, or copied from an old
// example, hands in `topology: { kind: 'grid', ... }`. That passes `conformanceProblems` if it only asks whether the field
// exists, and dies on the first frame with `o.declaration.topology is not a function` — a frozen screen, which for
// someone who cannot see is indistinguishable from a game that simply did not start.
import { describe, it, expect } from 'vitest';
import { conformanceProblems, distance } from '../app/js/core/contract.js';

const GRADE = { kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' };

/** A conforming, minimal declaration. */
const valida = (over = {}) => ({
  topology: () => GRADE,
  holdsAtOnce: () => 1,
  // A hotspots fixture holds nothing — ADR-0115's pair, beside the number that does not say so.
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
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
    // The message cannot say only missing: the field is there, in plain view, and it would send the author looking for
    // something they already wrote.
    expect(problemas[0]).toMatch(/FUNCTION/);
    expect(problemas[0]).not.toMatch(/missing/);
  });

  it('topology ausente continua a ser reprovada, e com OUTRA mensagem', () => {
    const problemas = conformanceProblems(valida({ topology: undefined }));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/missing/);
  });

  it('🔴 [Boundary] a topology written as `null` is MISSING too — not «a value that should be a function»', () => {
    // Found by the probe of 2026-09-24: only `undefined` had a case. A game that writes `topology: null` has written no
    // space at all, and «must be a FUNCTION» would send its author to fix a shape that is not there.
    const problemas = conformanceProblems(valida({ topology: null }));
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
    // The measured case: game-15puzzle is 3×3, 4×4 or 5×5, chosen at play time.
    let lado = 3;
    const d = valida({ topology: () => ({ kind: 'grid', size: [lado, lado], move: 'diagonal', frame: 'compass' }) });

    expect(d.topology().size[0]).toBe(3);
    expect(conformanceProblems(d)).toEqual([]);

    lado = 5;
    // ⚠️ THE EQUALITY BELOW IS THE DECISION. With `topology` as a value, this 5 would be a 3 — the object was read once, at
    // construction, and nothing asked again.
    expect(d.topology().size[0]).toBe(5);
    expect(conformanceProblems(d)).toEqual([]);
  });

  it('e a medida do sonar acompanha o tabuleiro novo', () => {
    let lado = 3;
    const topology = () => ({ kind: 'grid', size: [lado, lado], move: 'diagonal', frame: 'compass' });
    const canto = () => ({ x: topology().size[0] - 1, y: topology().size[1] - 1 });

    expect(distance(topology(), { x: 0, y: 0 }, canto())).toBe(2);
    lado = 5;
    expect(distance(topology(), { x: 0, y: 0 }, canto())).toBe(4);
  });

  it('uma declaração cujo tamanho fica inválido passa a ser reprovada NA HORA', () => {
    let cols = 4;
    const d = valida({ topology: () => ({ kind: 'grid', size: [cols, 4], move: 'diagonal', frame: 'compass' }) });
    expect(conformanceProblems(d)).toEqual([]);
    cols = 0; // a game bug: the board collapsed
    expect(conformanceProblems(d)).toHaveLength(1);
  });
});

describe('o MUNDO declarado (ADR-0087)', () => {
  const valida = (over = {}) => ({
    topology: () => ({ kind: 'grid', size: [4, 4], move: 'diagonal', frame: 'compass' }),
    holdsAtOnce: () => 1,
    // A hotspots fixture holds nothing — ADR-0115's pair, beside the number that does not say so.
    holdsKeys: () => false,
    world: () => ({ kind: 'element', selector: '#game-region' }),
    tick: 'player',
    roleAt: () => 'free',
    nameAt: () => ({ text: 'peca', gender: 'f', plural: false }),
    focusOf: () => null,
    objectiveOf: () => ({ name: { text: 'pecas', gender: 'f', plural: true }, have: 0, need: 1 }),
    targetsOf: () => [],
    ...over,
  });

  it('um jogo que declara o seu elemento passa', () => {
    expect(conformanceProblems(valida())).toEqual([]);
  });

  it('⚠️ AUSENTE é REPROVADO — e a mensagem ensina as duas saídas', () => {
    // The original proposal was an optional field with a default. The Dev refused, and the reason is blindfold chess:
    // chess played blind exists, so a pure-DOM game is not a game where empathy makes no sense. A default would let
    // FORGETTING pass as if it were a choice.
    const p = conformanceProblems(valida({ world: undefined }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/world: missing/);
    expect(p[0]).toMatch(/none/); // diz que existe a saida declarada
  });

  it('⚠️ `none` PASSA, e e a escolha escrita — atividade sem espaco', () => {
    // The case the Dev named: «atividades como paint nao sao exatamente jogos, mas podem ser feitas com a engine e sonar
    // nao vai funcionar muito bem».
    expect(conformanceProblems(valida({ world: () => ({ kind: 'none' }) }))).toEqual([]);
  });

  it('seletor vazio e reprovado — declarar nada nao e declarar', () => {
    const p = conformanceProblems(valida({ world: () => ({ kind: 'element', selector: '   ' }) }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/non-empty selector/);
  });

  it('kind desconhecido e reprovado', () => {
    expect(conformanceProblems(valida({ world: () => ({ kind: 'canvas' }) }))).toHaveLength(1);
  });

  it('valor em vez de funcao e reprovado, com mensagem propria', () => {
    const p = conformanceProblems(valida({ world: { kind: 'none' } }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/FUNCTION/);
  });

  it('funcao que nao devolve nada e reprovada', () => {
    expect(conformanceProblems(valida({ world: () => undefined }))).toHaveLength(1);
  });

  it('⚠️ o mundo e REAVALIADO, como a topologia', () => {
    // An activity can swap surfaces at run time — an editor that opens a painting canvas over the board. Reading once
    // would freeze the simulation's reach on what it was before.
    let alvo = '#game-region';
    const d = valida({ world: () => ({ kind: 'element', selector: alvo }) });
    expect(d.world().selector).toBe('#game-region');
    alvo = '#paint-surface';
    expect(d.world().selector).toBe('#paint-surface');
    expect(conformanceProblems(d)).toEqual([]);
  });
});
