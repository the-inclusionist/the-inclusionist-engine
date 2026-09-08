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
  topology: () => ({ kind: 'continuous', size: [896, 992], unit: 16, move: 'free', frame: 'clock' }),
  tick: 'clock',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  // Três: correr, andar e pular ao mesmo tempo. É o número que o ADR-0104 usa como exemplo, e é o que faz
  // o toque (que segura dois) reprovar — ver o caso do segundo eixo em `transports`.
  holdsAtOnce: () => 3,
  roleAt: () => 'structure',
  nameAt: () => ({ text: 'parede', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'e' }),
  objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 10 }),
  targetsOf: () => [{ x: 100, y: 200 }],
});

/** A mesma coisa num gênero que não tem espaço nenhum — só ordem. */
const lista = () => ({
  ...plataforma(),
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  // UM, e a diferença com a plataforma é o ponto do campo: escolher uma alternativa é um comando de cada vez.
  holdsAtOnce: () => 1,
});

// -----------------------------------------------------------------------------------------------------------
describe('speakableProblems — o nome falável (campo 3)', () => {
  it('[Zero] nome ausente é UM problema, e não uma exceção', () => {
    expect(speakableProblems(null)).toEqual(['name missing']);
    expect(speakableProblems(undefined)).toEqual(['name missing']);
  });

  it('[Right] nome bem-formado não tem problema nenhum', () => {
    expect(speakableProblems({ text: 'portão', gender: 'm', plural: false })).toEqual([]);
    expect(speakableProblems({ text: 'chaves', gender: 'f', plural: true })).toEqual([]);
  });

  it('[Boundary] texto SÓ DE ESPAÇO é vazio — é o defeito que cala o leitor de tela sem falhar em nada', () => {
    // O caso que mais importa do arquivo inteiro: '' e '   ' produzem o MESMO silêncio, e só o primeiro
    // pareceria defeito a quem lesse o objeto. `trim()` é o que junta os dois.
    expect(speakableProblems({ text: '   ', gender: 'm', plural: false })[0]).toMatch(/empty/);
    expect(speakableProblems({ text: '', gender: 'm', plural: false })[0]).toMatch(/empty/);
    expect(speakableProblems({ text: '\t\n', gender: 'm', plural: false })[0]).toMatch(/empty/);
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
    expect(conformanceProblems(null)).toEqual(['declaration missing']);
    expect(conformanceProblems(undefined)).toEqual(['declaration missing']);
  });

  it('[Right] as duas declarações conformes passam — e são de gêneros diferentes', () => {
    expect(conformanceProblems(plataforma())).toEqual([]);
    expect(conformanceProblems(lista())).toEqual([]);
  });

  it('[Boundary] grade com medida zero ou negativa é reprovada', () => {
    const grade = (...size) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size, move: 'diagonal', frame: 'compass' }),
    });
    expect(grade(8, 8)).toEqual([]);
    expect(grade(0, 8)).toHaveLength(1);
    expect(grade(8, 0)).toHaveLength(1);
    expect(grade(-1, 8)).toHaveLength(1);
    expect(grade(1, 1)).toEqual([]); // uma célula é uma grade legítima
    expect(grade(8, 8, 4)).toEqual([]); // três dimensões é uma grade legítima também
  });

  it('[Boundary] ⚠️ a DIMENSÃO é `size.length`, e só 2 ou 3 são representáveis', () => {
    // Não é medida ruim, é espaço que `Spot` (x, y, z?) não sabe representar — e sem esta recusa o quarto eixo
    // seria simplesmente IGNORADO por `distance`, que é o defeito que não deixa rasto.
    const dim = (size) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size, move: 'diagonal', frame: 'compass' }),
    });
    expect(dim([8])).toHaveLength(1);           // uma dimensão não é um espaço navegável
    expect(dim([8, 8, 8, 8])).toHaveLength(1);  // quatro é mais do que `Spot` carrega
    expect(dim([])).toHaveLength(1);
    expect(dim([8, 8])).toEqual([]);
    expect(dim([8, 8, 8])).toEqual([]);
  });

  it('[Boundary] ⚠️ `move` AUSENTE é reprovado — é a métrica, e adivinhá-la sub-relata até 2×', () => {
    // O achado §3 do ADR-0080: a grade contava sempre em passos de rei, e num quebra-cabeça deslizante nada
    // anda na diagonal. Deixar o campo opcional com padrão faria ESQUECER passar por ESCOLHER, e o preço do
    // esquecimento é o sonar mandar uma criança cega para o lado errado com confiança.
    const mv = (move) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size: [8, 8], move, frame: 'compass' }),
    });
    expect(mv(undefined)).toHaveLength(1);
    expect(mv('chebyshev')).toHaveLength(1); // o nome da métrica não é o nome da regra
    for (const bom of ['orthogonal', 'diagonal', 'free']) expect(mv(bom), bom).toEqual([]);
  });

  it('[Boundary] ⚠️ `frame` AUSENTE é reprovado — em que palavras a direção é dita é do JOGO', () => {
    const fr = (frame) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size: [8, 8], move: 'diagonal', frame }),
    });
    expect(fr(undefined)).toHaveLength(1);
    expect(fr('cardinal')).toHaveLength(1);
    expect(fr('compass')).toEqual([]);
    expect(fr('clock')).toEqual([]);
  });

  it('[Boundary] contínuo SEM `unit` é reprovado — unit é a métrica da narração, não decoração', () => {
    // Sem `unit`, "a dois passos" não tem como ser dito: sobra pixel, que não é unidade de ninguém que joga.
    const semUnit = { kind: 'continuous', size: [100, 100], move: 'free', frame: 'clock' };
    expect(conformanceProblems({ ...plataforma(), topology: () => semUnit })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: () => ({ ...semUnit, unit: 0 }) })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: () => ({ ...semUnit, unit: 16 }) })).toEqual([]);
  });

  it('[Boundary] lista de hotspots vazia é reprovada — não há para onde navegar', () => {
    const hot = (order) => conformanceProblems({ ...plataforma(), topology: () => ({ kind: 'hotspots', order }) });
    expect(hot([])).toHaveLength(1);
    expect(hot(['q1'])).toEqual([]); // um único item é uma lista legítima
  });

  it('[Interface] hotspot repetido é reprovado — a distância é diferença de ÍNDICE, e id repetido a quebra', () => {
    const p = conformanceProblems({ ...plataforma(), topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q1'] }) });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/repeated/);
  });

  it('[Interface] kind desconhecido é reprovado — um gênero novo declara topologia, não inventa uma', () => {
    expect(conformanceProblems({ ...plataforma(), topology: () => ({ kind: 'isometrico' }) })).toHaveLength(1);
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

  it('[Many] uma declaração vazia acusa os NOVE campos de uma vez', () => {
    // topology + world + holdsAtOnce + tick + as CINCO funções. É o número que diz a quem escreve um preset
    // quanto falta, de uma vez só — e é a diferença entre "faltam nove coisas" e nove rodadas de conserto às
    // cegas. Era SEIS até `targetsOf` completar o campo 5 (a metade "alvo", que o sonar cobrou), SETE até
    // `world` (o ADR-0087) parar de deixar a engine adivinhar que o mundo é a canvas, e OITO até o
    // `holdsAtOnce` (o ADR-0104) parar de deixar a acessibilidade motora ser decidida por omissão.
    expect(conformanceProblems({})).toHaveLength(9);
  });

  it('⚠️ [Boundary] `holdsAtOnce` AUSENTE é reprovado — omitir é decidir pela criança, em silêncio', () => {
    // Na frase do Dev: «os 300 jogos precisam declarar sim! Não declarar é ter a acessibilidade programada
    // no controle pro sorte». Um campo opcional é respondido por silêncio, e o silêncio decide.
    const semCampo = { ...plataforma() };
    delete semCampo.holdsAtOnce;
    const p = conformanceProblems(semCampo);
    expect(p).toHaveLength(1);
    expect(p[0], 'a mensagem não diz o que perguntar a si próprio').toMatch(/holdsAtOnce/);
    expect(p[0], 'a mensagem não dá o exemplo que torna a pergunta respondível').toMatch(/three fingers/i);
    // ⚠️ E ela não nomeia GÊNERO nenhum — mas quem o afirma é o `engine-boundary`, e não este caso. A
    // primeira escrita da mensagem dizia «a quiz is 1» e aquele gate reprovou-a, com razão. Escrevi aqui uma
    // segunda asserção sobre a mesma regra, e ela reprovou também — porque para nomear os gêneros proibidos
    // eu tinha de os escrever. As duas recusas eram a mesma, e a lição é a do `segment-bar`: uma regra tem
    // UM dono, e o dono desta é o crivo de fronteira, que a aplica a TODOS os módulos em vez de a um.
  });

  it('⚠️ [Zero] ZERO é reprovado, e não lido como «não usa controle»', () => {
    // Um jogo que não segura posição nenhuma não é jogável. Aceitar zero faria a aritmética do alcance passar
    // por vacuidade — exactamente o que o `reachable` recusa fazer com um conjunto de ações vazio.
    for (const mau of [0, -1, 1.5, NaN, '3']) {
      expect(conformanceProblems({ ...plataforma(), holdsAtOnce: () => mau }), `aceitou ${mau}`).toHaveLength(1);
    }
    expect(conformanceProblems({ ...plataforma(), holdsAtOnce: 3 }), 'aceitou um NÚMERO no lugar da função').toHaveLength(1);
  });

  it('[Cross-check] conformidade é FORMA, não verdade — um `roleAt` que mente passa, e tem de passar', () => {
    // A fronteira do que este módulo pode saber. Um `roleAt` que devolve 'free' para a lava é conforme aqui e
    // errado no jogo; quem pega isso é o teste do PRESET. Deixar este caso escrito evita que alguém "reforce"
    // a conformidade até ela tentar adivinhar o jogo — que é exatamente o defeito que o ADR-0030 cortou.
    expect(conformanceProblems({ ...plataforma(), roleAt: () => 'free' })).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('needsPointer — o campo OPCIONAL que não é impune (ADR-0112)', () => {
  it('[Zero] ausente não é problema — a ausência É a resposta `false`', () => {
    // ⚠️ E A OPCIONALIDADE É DECISÃO, não descuido. O `holdsAtOnce` é obrigatório porque não tem padrão seguro
    // e falha INVISIVELMENTE a quem escreve o jogo — ele tem teclado completo, o jogo corre, e quem paga é a
    // criança no telemóvel de dois dedos. Este tem padrão seguro e falha VISIVELMENTE: um jogo de desenho que
    // se esqueça de o declarar é inoperável no próprio aparelho de quem o escreve.
    expect(conformanceProblems(plataforma()).filter((x) => /needsPointer/.test(x))).toEqual([]);
  });

  it('[Right] declarado como função devolvendo booleano não é problema', () => {
    expect(conformanceProblems({ ...plataforma(), needsPointer: () => true })).toEqual([]);
    expect(conformanceProblems({ ...plataforma(), needsPointer: () => false })).toEqual([]);
  });

  it('⚠️ [Boundary] declarado como VALOR e não função é recusado', () => {
    // `needsPointer: true` parece declarar «sim» e não declara nada: o alcance chamaria uma coisa que não é
    // função. O jogo julgaria ter respondido, e ninguém saberia — o defeito silencioso que esta função existe
    // para não deixar acontecer.
    const p = conformanceProblems({ ...plataforma(), needsPointer: true });
    expect(p.some((x) => /needsPointer: must be a function/.test(x))).toBe(true);
  });

  it('⚠️ [Boundary] devolver algo que não é booleano é recusado', () => {
    // `() => 'sim'` é verdadeiro por ser uma string não vazia, então o jogo passaria a recusar aparelhos que
    // ele consegue usar — e a recusa é a coisa mais cara que este campo pode fazer errado.
    const p = conformanceProblems({ ...plataforma(), needsPointer: () => 'sim' });
    expect(p.some((x) => /needsPointer: must return a boolean/.test(x))).toBe(true);
  });
});

describe('distance — a métrica, que é o que faz "mais perto" existir', () => {
  const GRADE = { kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' };
  const DESLIZANTE = { kind: 'grid', size: [4, 4], move: 'orthogonal', frame: 'compass' };
  const CONT = { kind: 'continuous', size: [100, 100], unit: 16, move: 'free', frame: 'clock' };
  const LISTA = { kind: 'hotspots', order: ['q1', 'q2', 'q3', 'q4'] };
  const P = (x, y = 0, z) => (z === undefined ? { x, y } : { x, y, z });

  it('[Right] grade de DIAGONAL conta passos de rei: a diagonal custa 1, não 2 e não √2', () => {
    // Continua a ser verdade — onde a diagonal é legal. O que mudou é que deixou de ser a única verdade.
    expect(distance(GRADE, P(0, 0), P(1, 1))).toBe(1);
    expect(distance(GRADE, P(0, 0), P(3, 1))).toBe(3);
    expect(distance(GRADE, P(2, 5), P(2, 5))).toBe(0);
  });

  it('[Right] ⚠️ grade ORTOGONAL conta MOVIMENTOS: duas à direita e duas abaixo são QUATRO, não 2', () => {
    // É o achado §3 do ADR-0080, medido no `game-15puzzle`: nada anda na diagonal num quebra-cabeça
    // deslizante, e Chebyshev sub-relatava a distância até 2×. Sub-relatar distância a quem não vê a tela não
    // é imprecisão — é dizer "está perto" de uma coisa que está longe, e a criança confia.
    expect(distance(DESLIZANTE, P(0, 0), P(2, 2))).toBe(4);
    expect(distance(DESLIZANTE, P(0, 0), P(1, 1))).toBe(2);
    expect(distance(DESLIZANTE, P(0, 0), P(3, 0))).toBe(3); // no eixo, as duas regras concordam
  });

  it('[Right] a MESMA grade com regras diferentes dá respostas diferentes — é o campo que decide', () => {
    // O par que prova que a regra é lida, e não que os dois fixtures por acaso diferem noutra coisa.
    const size = [8, 8], frame = 'compass';
    const a = P(0, 0), b = P(3, 3);
    expect(distance({ kind: 'grid', size, frame, move: 'diagonal' }, a, b)).toBe(3);
    expect(distance({ kind: 'grid', size, frame, move: 'orthogonal' }, a, b)).toBe(6);
    expect(distance({ kind: 'grid', size, frame, move: 'free' }, a, b)).toBeCloseTo(Math.hypot(3, 3), 10);
  });

  it('[Boundary] três dimensões: o terceiro eixo entra na conta, e só quando declarado', () => {
    const cubo = { kind: 'grid', size: [4, 4, 4], move: 'orthogonal', frame: 'compass' };
    expect(distance(cubo, P(0, 0, 0), P(1, 1, 1))).toBe(3);
    // ⚠️ O MESMO PONTO numa topologia de DUAS dimensões: o `z` é ignorado, porque a dimensão é `size.length`
    // e não o que o ponto por acaso carrega. Sem isto, um `z` esquecido num fixture mudaria distâncias 2D.
    expect(distance(DESLIZANTE, P(0, 0, 0), P(1, 1, 99))).toBe(2);
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
      // ⚠️ `decl.topology()` COM OS PARÊNTESES, e eles faltavam. Passar a função onde vai a topologia dava
      // `t.kind === undefined` e o `distance` antigo caía no ramo contínuo, dividindo por `t.unit` ausente:
      // NaN em toda distância, e um `sort` por NaN que devolvia o primeiro item — o teste passava por acaso.
      // A forma nova estoura em vez de mentir, que é a única razão de isto ter aparecido.
      .map((c) => ({ at: c, d: distance(decl.topology(), de, c), nome: decl.nameAt(c) }))
      .sort((x, y) => x.d - y.d)[0] ?? null;

  /** Um mapa de grade de mentira: só a coluna 5 é objetivo. */
  const gradeDecl = {
    ...plataforma(),
    topology: () => ({ kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' }),
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
