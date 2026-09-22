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

const GRADE = { kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' };

/** Uma declaração conforme, mínima. */
const valida = (over = {}) => ({
  topology: () => GRADE,
  holdsAtOnce: () => 1,
  // Um fixture de hotspots não segura nada — o par do ADR-0115, ao lado do número que não o diz.
  seguraTeclas: () => false,
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
    const d = valida({ topology: () => ({ kind: 'grid', size: [lado, lado], move: 'diagonal', frame: 'compass' }) });

    expect(d.topology().size[0]).toBe(3);
    expect(conformanceProblems(d)).toEqual([]);

    lado = 5;
    // ⚠️ A IGUALDADE ABAIXO É A DECISÃO. Com `topology` como valor, este 5 seria um 3 — o objeto foi
    // lido uma vez, na construção, e nada tornava a perguntar.
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
    cols = 0; // um bug do jogo: o tabuleiro colapsou
    expect(conformanceProblems(d)).toHaveLength(1);
  });
});

describe('o MUNDO declarado (ADR-0087)', () => {
  const valida = (over = {}) => ({
    topology: () => ({ kind: 'grid', size: [4, 4], move: 'diagonal', frame: 'compass' }),
    holdsAtOnce: () => 1,
    // Um fixture de hotspots não segura nada — o par do ADR-0115, ao lado do número que não o diz.
    seguraTeclas: () => false,
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
    // A proposta original era campo opcional com padrão. O Dev recusou, e a razão e o blindfold chess:
    // xadrez as cegas existe, logo um jogo de DOM puro nao e um jogo onde empatia nao faz sentido. Um
    // padrao deixaria o ESQUECIMENTO passar como se fosse escolha.
    const p = conformanceProblems(valida({ world: undefined }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/world: missing/);
    expect(p[0]).toMatch(/none/); // diz que existe a saida declarada
  });

  it('⚠️ `none` PASSA, e e a escolha escrita — atividade sem espaco', () => {
    // O caso que o Dev nomeou: "atividades como paint nao sao exatamente jogos, mas podem ser feitas
    // com a engine e sonar nao vai funcionar muito bem".
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
    // Uma atividade pode trocar de superficie em tempo de execucao — um editor que abre uma tela de
    // pintura por cima do tabuleiro. Ler uma vez congelaria o alcance da simulacao no que era antes.
    let alvo = '#game-region';
    const d = valida({ world: () => ({ kind: 'element', selector: alvo }) });
    expect(d.world().selector).toBe('#game-region');
    alvo = '#paint-surface';
    expect(d.world().selector).toBe('#paint-surface');
    expect(conformanceProblems(d)).toEqual([]);
  });
});
