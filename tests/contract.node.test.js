// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/contract — os SETE CAMPOS do ADR-0030 como interface (project node). ZOMBIES + Right-BICEP.
//
// O RISCO DESTE ARQUIVO, dito de saída: um contrato sem consumidor tenta virar teste tautológico — "a função
// devolve o que a função devolve". Só três coisas aqui têm como estar erradas de verdade, e são elas que os
// casos perseguem:
//
//   · `conformanceProblems` REPROVAR o que deveria reprovar (e não parar no primeiro problema);
//   · `distance` ser uma MÉTRICA de verdade em cada topologia — sem simetria e desigualdade triangular não
//     existe "mais perto", e sem "mais perto" não existe sonar (ADR-0027);
//   · o mesmo código de acessibilidade rodar sobre DUAS topologias sem saber qual é.
//
// O terceiro é um ENSAIO, não a prova: o ADR-0030 diz que "o contrato basta" só vira resultado quando dois
// PRESETS existirem, e duas declarações escritas dentro de um teste não são presets. O que ele mostra é mais
// modesto e ainda assim é o que se podia mostrar hoje — que a forma da pergunta serve aos dois gêneros.
//
// ========================= POR QUE OS FIXTURES NÃO DIZEM "MOEDA" NEM "QUIZ" =========================
// A primeira versão deste arquivo dizia. Chamava a coisa a juntar de "moedas" e a segunda declaração de
// `quiz`, e o gate de fixtures (`engine-boundary`) reprovou na hora — sete linhas. A tentação era listá-las
// como dívida conhecida, e teria sido errado: nada aqui PRECISA de moeda, eu é que estendi a mão para o
// vocabulário do jogo por hábito, no arquivo cuja tese inteira é que a engine não sabe o que é uma moeda.
// Um contrato que se explica com o exemplo do próprio jogo já começou a adivinhá-lo. Os nomes ficaram
// neutros — 'alvos', 'lista' — e o defeito era meu, não do gate.
import { describe, it, expect } from 'vitest';
import { conformanceProblems, speakableProblems, distance } from '../app/js/core/contract.js';

/** Uma declaração conforme, de plataforma. As funções devolvem constantes: aqui só a FORMA está sob teste. */
const plataforma = () => ({
  topology: { kind: 'continuous', width: 896, height: 992, unit: 16 },
  tick: 'clock',
  roleAt: () => 'structure',
  nameAt: () => ({ text: 'parede', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'e' }),
  objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 10 }),
  targetsOf: () => [{ x: 100, y: 200 }],
});

/** A mesma coisa num gênero que não tem espaço nenhum — só ordem. */
const lista = () => ({
  ...plataforma(),
  topology: { kind: 'hotspots', order: ['q1', 'q2', 'q3'] },
  tick: 'player',
});

// -----------------------------------------------------------------------------------------------------------
describe('speakableProblems — o nome falável (campo 3)', () => {
  it('[Zero] nome ausente é UM problema, e não uma exceção', () => {
    expect(speakableProblems(null)).toEqual(['nome ausente']);
    expect(speakableProblems(undefined)).toEqual(['nome ausente']);
  });

  it('[Right] nome bem-formado não tem problema nenhum', () => {
    expect(speakableProblems({ text: 'portão', gender: 'm', plural: false })).toEqual([]);
    expect(speakableProblems({ text: 'chaves', gender: 'f', plural: true })).toEqual([]);
  });

  it('[Boundary] texto SÓ DE ESPAÇO é vazio — é o defeito que cala o leitor de tela sem falhar em nada', () => {
    // O caso que mais importa do arquivo inteiro: '' e '   ' produzem o MESMO silêncio, e só o primeiro
    // pareceria defeito a quem lesse o objeto. `trim()` é o que junta os dois.
    expect(speakableProblems({ text: '   ', gender: 'm', plural: false })[0]).toMatch(/vazio/);
    expect(speakableProblems({ text: '', gender: 'm', plural: false })[0]).toMatch(/vazio/);
    expect(speakableProblems({ text: '\t\n', gender: 'm', plural: false })[0]).toMatch(/vazio/);
  });

  it('[Interface] gênero fora de m/f/n é problema — sem ele a moldura em pt-BR concorda errado', () => {
    expect(speakableProblems({ text: 'porta', gender: 'x', plural: false })).toHaveLength(1);
    expect(speakableProblems({ text: 'porta', gender: 'n', plural: false })).toEqual([]); // 'n' é válido
  });

  it('[Interface] plural precisa ser BOOLEANO — `undefined` não é "falso", é campo esquecido', () => {
    expect(speakableProblems({ text: 'porta', gender: 'f' })).toHaveLength(1);
    expect(speakableProblems({ text: 'porta', gender: 'f', plural: false })).toEqual([]);
  });

  it('[Many] dois defeitos produzem DOIS problemas — a lista não para no primeiro', () => {
    // Parar no primeiro faria a conformidade virar um jogo de esconde-esconde: consertar um defeito revelaria
    // o próximo, um por vez, e quem escreve o preset descobriria o tamanho do buraco só no fim.
    expect(speakableProblems({ text: '', gender: 'z', plural: 1 })).toHaveLength(3);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('conformanceProblems — os sete campos, em FORMA', () => {
  it('[Zero] declaração ausente', () => {
    expect(conformanceProblems(null)).toEqual(['declaração ausente']);
    expect(conformanceProblems(undefined)).toEqual(['declaração ausente']);
  });

  it('[Right] as duas declarações conformes passam — e são de gêneros diferentes', () => {
    expect(conformanceProblems(plataforma())).toEqual([]);
    expect(conformanceProblems(lista())).toEqual([]);
  });

  it('[Boundary] grade com medida zero ou negativa é reprovada', () => {
    const grade = (cols, rows) => conformanceProblems({ ...plataforma(), topology: { kind: 'grid', cols, rows } });
    expect(grade(8, 8)).toEqual([]);
    expect(grade(0, 8)).toHaveLength(1);
    expect(grade(8, 0)).toHaveLength(1);
    expect(grade(-1, 8)).toHaveLength(1);
    expect(grade(1, 1)).toEqual([]); // uma célula é uma grade legítima
  });

  it('[Boundary] contínuo SEM `unit` é reprovado — unit é a métrica da narração, não decoração', () => {
    // Sem `unit`, "a dois passos" não tem como ser dito: sobra pixel, que não é unidade de ninguém que joga.
    const semUnit = { kind: 'continuous', width: 100, height: 100 };
    expect(conformanceProblems({ ...plataforma(), topology: semUnit })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: { ...semUnit, unit: 0 } })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: { ...semUnit, unit: 16 } })).toEqual([]);
  });

  it('[Boundary] lista de hotspots vazia é reprovada — não há para onde navegar', () => {
    const hot = (order) => conformanceProblems({ ...plataforma(), topology: { kind: 'hotspots', order } });
    expect(hot([])).toHaveLength(1);
    expect(hot(['q1'])).toEqual([]); // um único item é uma lista legítima
  });

  it('[Interface] hotspot repetido é reprovado — a distância é diferença de ÍNDICE, e id repetido a quebra', () => {
    const p = conformanceProblems({ ...plataforma(), topology: { kind: 'hotspots', order: ['q1', 'q2', 'q1'] } });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/repetido/);
  });

  it('[Interface] kind desconhecido é reprovado — um gênero novo declara topologia, não inventa uma', () => {
    expect(conformanceProblems({ ...plataforma(), topology: { kind: 'isometrico' } })).toHaveLength(1);
  });

  it('[Interface] tick só aceita player ou clock', () => {
    expect(conformanceProblems({ ...plataforma(), tick: 'clock' })).toEqual([]);
    expect(conformanceProblems({ ...plataforma(), tick: 'player' })).toEqual([]);
    expect(conformanceProblems({ ...plataforma(), tick: undefined })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), tick: 'turno' })).toHaveLength(1);
  });

  it('[Interface] cada uma das quatro funções ausente é UM problema, e o nome dela aparece', () => {
    for (const f of ['roleAt', 'nameAt', 'focusOf', 'objectiveOf', 'targetsOf']) {
      const d = plataforma();
      delete d[f];
      const p = conformanceProblems(d);
      expect(p, `${f} ausente deveria ser reprovado`).toHaveLength(1);
      expect(p[0], 'o problema tem de DIZER qual campo falta').toContain(f);
    }
  });

  it('[Interface] campo que existe mas NÃO é função é reprovado igual — um objeto não responde `roleAt(at)`', () => {
    expect(conformanceProblems({ ...plataforma(), roleAt: 'hazard' })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), roleAt: null })).toHaveLength(1);
  });

  it('[Many] uma declaração vazia acusa os SETE campos de uma vez', () => {
    // topology + tick + as CINCO funções. É o número que diz a quem escreve um preset quanto falta, de uma vez
    // só — e é a diferença entre "faltam sete coisas" e sete rodadas de conserto às cegas.
    // Era SEIS até `targetsOf` completar o campo 5 (a metade "alvo", que o sonar cobrou).
    expect(conformanceProblems({})).toHaveLength(7);
  });

  it('[Cross-check] conformidade é FORMA, não verdade — um `roleAt` que mente passa, e tem de passar', () => {
    // A fronteira do que este módulo pode saber. Um `roleAt` que devolve 'free' para a lava é conforme aqui e
    // errado no jogo; quem pega isso é o teste do PRESET. Deixar este caso escrito evita que alguém "reforce"
    // a conformidade até ela tentar adivinhar o jogo — que é exatamente o defeito que o ADR-0030 cortou.
    expect(conformanceProblems({ ...plataforma(), roleAt: () => 'free' })).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('distance — a métrica, que é o que faz "mais perto" existir', () => {
  const GRADE = { kind: 'grid', cols: 8, rows: 8 };
  const CONT = { kind: 'continuous', width: 100, height: 100, unit: 16 };
  const LISTA = { kind: 'hotspots', order: ['q1', 'q2', 'q3', 'q4'] };
  const P = (x, y = 0) => ({ x, y });

  it('[Right] grade conta PASSOS DE REI: a diagonal custa 1, não 2 e não √2', () => {
    // É uma decisão, não um detalhe. Chebyshev é como quem joga numa grade conta a distância — e trocá-la por
    // Manhattan faria o sonar apontar para o alvo errado sempre que houvesse empate na diagonal.
    expect(distance(GRADE, P(0, 0), P(1, 1))).toBe(1);
    expect(distance(GRADE, P(0, 0), P(3, 1))).toBe(3);
    expect(distance(GRADE, P(2, 5), P(2, 5))).toBe(0);
  });

  it('[Right] contínuo devolve PASSOS, não pixels — é `unit` que faz a tradução', () => {
    expect(distance(CONT, P(0, 0), P(48, 64))).toBe(5); // hipotenusa 80, unit 16
    expect(distance({ ...CONT, unit: 80 }, P(0, 0), P(48, 64))).toBe(1);
  });

  it('[Right] lista é diferença de índice, e o `y` é ignorado', () => {
    expect(distance(LISTA, P(0, 99), P(3, -7))).toBe(3);
    expect(distance(LISTA, P(2), P(1))).toBe(1);
  });

  const TOPOLOGIAS = [['grade', GRADE], ['contínuo', CONT], ['lista', LISTA]];

  it.each(TOPOLOGIAS)('[Interface] em %s: distância de um ponto a ele mesmo é ZERO', (_nome, t) => {
    for (const p of [P(0, 0), P(3, 2), P(7, 7)]) expect(distance(t, p, p)).toBe(0);
  });

  it.each(TOPOLOGIAS)('[Interface] em %s: é SIMÉTRICA — "a está perto de b" é "b está perto de a"', (_nome, t) => {
    // Sem simetria o sonar diria uma coisa ao aproximar e outra ao afastar, com os mesmos dois pontos.
    expect(distance(t, P(1, 2), P(6, 5))).toBe(distance(t, P(6, 5), P(1, 2)));
    expect(distance(t, P(0, 0), P(7, 0))).toBe(distance(t, P(7, 0), P(0, 0)));
  });

  it.each(TOPOLOGIAS)('[Interface] em %s: vale a desigualdade triangular — o desvio nunca encurta', (_nome, t) => {
    const a = P(0, 0), b = P(3, 1), c = P(7, 6);
    expect(distance(t, a, c)).toBeLessThanOrEqual(distance(t, a, b) + distance(t, b, c) + 1e-9);
  });

  it('[Performance-free] distância é PURA: chamar duas vezes dá o mesmo, e não mexe nos pontos', () => {
    const a = P(1, 2), b = P(5, 9);
    const primeira = distance(CONT, a, b);
    expect(distance(CONT, a, b)).toBe(primeira);
    expect(a).toEqual({ x: 1, y: 2 });
    expect(b).toEqual({ x: 5, y: 9 });
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('ENSAIO: o mesmo código de acessibilidade sobre duas topologias (ADR-0030)', () => {
  // Um "sonar" mínimo, escrito CONTRA O CONTRATO e contra nada mais. Se este código precisasse saber o gênero,
  // o contrato estaria errado — é essa a única coisa que o ensaio tem como mostrar.
  //
  // O que ele NÃO é: prova. O ADR-0030 pede dois PRESETS, e duas declarações num arquivo de teste não são
  // presets — não desenham, não recebem entrada, não vivem fora deste `describe`. A diferença fica escrita
  // aqui para ninguém confundir um ensaio verde com o passo 6 do ADR-0027.
  const alvoMaisProximo = (decl, de, candidatos) =>
    candidatos
      .filter((c) => decl.roleAt(c) === 'goal')
      .map((c) => ({ at: c, d: distance(decl.topology, de, c), nome: decl.nameAt(c) }))
      .sort((x, y) => x.d - y.d)[0] ?? null;

  /** Um mapa de grade de mentira: só a coluna 5 é objetivo. */
  const gradeDecl = {
    ...plataforma(),
    topology: { kind: 'grid', cols: 8, rows: 8 },
    roleAt: (at) => (at.x === 5 ? 'goal' : 'structure'),
    nameAt: (at) => ({ text: `alvo ${at.x},${at.y}`, gender: 'm', plural: false }),
  };

  /** Uma lista de mentira: só o item de índice 3 está em aberto. */
  const listaDecl = {
    ...lista(),
    roleAt: (at) => (at.x === 3 ? 'goal' : 'free'),
    nameAt: (at) => ({ text: `pergunta ${at.x + 1}`, gender: 'f', plural: false }),
  };

  const CANDIDATOS = [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }, { x: 5, y: 6 }];

  it('[Right] na grade, acha o objetivo mais perto pela métrica de grade', () => {
    const r = alvoMaisProximo(gradeDecl, { x: 5, y: 0 }, CANDIDATOS);
    expect(r.at).toEqual({ x: 5, y: 2 }); // 2 passos, contra 6 do outro
    expect(r.nome.text).toBe('alvo 5,2');
  });

  it('[Right] na lista ordenada, o MESMO código acha o item em aberto pela métrica de índice', () => {
    const r = alvoMaisProximo(listaDecl, { x: 0, y: 0 }, CANDIDATOS);
    expect(r.at).toEqual({ x: 3, y: 0 });
    expect(r.nome.text).toBe('pergunta 4');
  });

  it('[Zero] sem objetivo em campo, devolve nulo em vez de inventar alvo', () => {
    const semAlvo = { ...gradeDecl, roleAt: () => 'structure' };
    expect(alvoMaisProximo(semAlvo, { x: 0, y: 0 }, CANDIDATOS)).toBeNull();
  });

  it('[Cross-check] as duas declarações do ensaio são conformes — ensaio sobre forma inválida não vale nada', () => {
    expect(conformanceProblems(gradeDecl)).toEqual([]);
    expect(conformanceProblems(listaDecl)).toEqual([]);
  });
});
