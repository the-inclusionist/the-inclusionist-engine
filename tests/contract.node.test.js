// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of core/contract — ADR-0030's SEVEN FIELDS as an interface (node project). ZOMBIES + Right-BICEP.
//
// THIS FILE'S RISK, said up front: a contract without a consumer tends to become a tautological test — the function
// returns what the function returns. Only three things here can really be wrong, and they are what the cases chase:
//
//   · `conformanceProblems` FAILING what it should fail (and not stopping at the first problem);
//   · `distance` being a real METRIC in each topology — without symmetry and the triangle inequality there is no nearer,
//     and without nearer there is no sonar (ADR-0027);
//   · the same accessibility code running over TWO topologies without knowing which.
//
// The third is a REHEARSAL, not the proof: ADR-0030 says the contract being enough becomes a result only when two
// PRESETS exist, and two declarations written inside a test are not presets. What it shows is more modest and still what
// could be shown — that the shape of the question serves both genres.
//
// ========================= WHY THE FIXTURES SAY NEITHER COIN NOR QUIZ =========================
// A first version did. It called the thing to collect coins and the second declaration `quiz`, and the fixtures gate
// (`engine-boundary`) failed it at once — seven lines. Listing them as known debt would have been wrong: nothing here
// NEEDS a coin; reaching for the game's vocabulary was habit, in the file whose whole thesis is that the engine does not
// know what a coin is. A contract explained with its own game's example has already started guessing it. The names
// became neutral — 'alvos', 'lista' — and the defect was the file's, not the gate's.
import { describe, it, expect } from 'vitest';
import { conformanceProblems, speakableProblems, distance } from '../app/js/core/contract.js';

/** A conforming platformer declaration. The functions return constants: only the SHAPE is under test here. */
const plataforma = () => ({
  topology: () => ({ kind: 'continuous', size: [896, 992], unit: 16, move: 'free', frame: 'clock' }),
  tick: 'clock',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  // Three: run, walk and jump at the same time. It is the number ADR-0104 uses as an example, and it is what makes touch
  // (which holds two) fail — see the second-axis case in `transports`.
  holdsAtOnce: () => 3,
  // TRUE: running is holding. It is the side of the pair that OFFERS the toggle (ADR-0115).
  holdsKeys: () => true,
  roleAt: () => 'structure',
  nameAt: () => ({ text: 'parede', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'e' }),
  objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 10 }),
  targetsOf: () => [{ x: 100, y: 200 }],
});

/** The same thing in a genre with no space at all — only order. */
const lista = () => ({
  ...plataforma(),
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  // ONE, and the difference from the platformer is the field's point: choosing an option is one command at a time.
  holdsAtOnce: () => 1,
  // 🎯 AND FALSE — the pair that makes the two fields visibly different. This game declares `1` and holds NOTHING; the
  // platformer above declares `3` and holds. Reading the number to know whether something is held gives the right answer
  // here by chance and the wrong one there, which is ADR-0115's finding.
  holdsKeys: () => false,
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
    // The case that matters most in the whole file: '' and '   ' produce the SAME silence, and only the first would look
    // like a defect to whoever read the object. `trim()` is what joins the two.
    expect(speakableProblems({ text: '   ', gender: 'm', plural: false })[0]).toMatch(/empty/);
    expect(speakableProblems({ text: '', gender: 'm', plural: false })[0]).toMatch(/empty/);
    expect(speakableProblems({ text: '\t\n', gender: 'm', plural: false })[0]).toMatch(/empty/);
  });

  it('[Interface] gênero fora de m/f/n é problema — sem ele a moldura em pt-BR concorda errado', () => {
    expect(speakableProblems({ text: 'porta', gender: 'x', plural: false })).toHaveLength(1);
    expect(speakableProblems({ text: 'porta', gender: 'n', plural: false })).toEqual([]); // 'n' is valid
  });

  it('[Interface] plural precisa ser BOOLEANO — `undefined` não é "falso", é campo esquecido', () => {
    expect(speakableProblems({ text: 'porta', gender: 'f' })).toHaveLength(1);
    expect(speakableProblems({ text: 'porta', gender: 'f', plural: false })).toEqual([]);
  });

  it('[Many] dois defeitos produzem DOIS problemas — a lista não para no primeiro', () => {
    // Stopping at the first would turn conformance into hide-and-seek: fixing one defect would reveal the next, one at a
    // time, and whoever writes the preset would find the size of the hole only at the end.
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
    expect(grade(1, 1)).toEqual([]); // one cell is a legitimate grid
    expect(grade(8, 8, 4)).toEqual([]); // three dimensions is a legitimate grid too
  });

  it('[Boundary] ⚠️ a DIMENSÃO é `size.length`, e só 2 ou 3 são representáveis', () => {
    // It is not a bad measure, it is a space `Spot` (x, y, z?) cannot represent — and without this refusal the fourth axis
    // would simply be IGNORED by `distance`, the defect that leaves no trace.
    const dim = (size) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size, move: 'diagonal', frame: 'compass' }),
    });
    expect(dim([8])).toHaveLength(1);           // one dimension is not a navigable space
    expect(dim([8, 8, 8, 8])).toHaveLength(1);  // four is more than `Spot` carries
    expect(dim([])).toHaveLength(1);
    expect(dim([8, 8])).toEqual([]);
    expect(dim([8, 8, 8])).toEqual([]);
  });

  it('[Boundary] ⚠️ `move` AUSENTE é reprovado — é a métrica, e adivinhá-la sub-relata até 2×', () => {
    // ADR-0080's §3 finding: the grid always counted in king's steps, and in a sliding puzzle nothing moves diagonally.
    // Leaving the field optional with a default would let FORGETTING pass as CHOOSING, and the price of forgetting is the
    // sonar sending a blind child the wrong way with confidence.
    const mv = (move) => conformanceProblems({
      ...plataforma(), topology: () => ({ kind: 'grid', size: [8, 8], move, frame: 'compass' }),
    });
    expect(mv(undefined)).toHaveLength(1);
    expect(mv('chebyshev')).toHaveLength(1); // the metric's name is not the rule's name
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
    // Without `unit`, two steps away cannot be said: pixels remain, and pixels are nobody's unit who plays.
    const semUnit = { kind: 'continuous', size: [100, 100], move: 'free', frame: 'clock' };
    expect(conformanceProblems({ ...plataforma(), topology: () => semUnit })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: () => ({ ...semUnit, unit: 0 }) })).toHaveLength(1);
    expect(conformanceProblems({ ...plataforma(), topology: () => ({ ...semUnit, unit: 16 }) })).toEqual([]);
  });

  it('[Boundary] lista de hotspots vazia é reprovada — não há para onde navegar', () => {
    const hot = (order) => conformanceProblems({ ...plataforma(), topology: () => ({ kind: 'hotspots', order }) });
    expect(hot([])).toHaveLength(1);
    expect(hot(['q1'])).toEqual([]); // a single item is a legitimate list
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

  it('[Many] uma declaração vazia acusa os DEZ campos de uma vez', () => {
    // topology + world + holdsAtOnce + holdsKeys + tick + the FIVE functions. It is the number that tells whoever writes
    // a preset how much is missing, all at once — the difference between ten things missing and ten rounds of fixing
    // blind. Each field added to the contract (`targetsOf`, `world` in ADR-0087, `holdsAtOnce` in ADR-0104, `holdsKeys` in
    // ADR-0115) raised it by one.
    expect(conformanceProblems({})).toHaveLength(10);
  });

  it('⚠️ [Boundary] `holdsAtOnce` AUSENTE é reprovado — omitir é decidir pela criança, em silêncio', () => {
    // In the Dev's words: «os 300 jogos precisam declarar sim! Não declarar é ter a acessibilidade programada
    // no controle pro sorte». An optional field is answered by silence, and silence decides.
    const semCampo = { ...plataforma() };
    delete semCampo.holdsAtOnce;
    const p = conformanceProblems(semCampo);
    expect(p).toHaveLength(1);
    expect(p[0], 'a mensagem não diz o que perguntar a si próprio').toMatch(/holdsAtOnce/);
    expect(p[0], 'a mensagem não dá o exemplo que torna a pergunta respondível').toMatch(/three fingers/i);
    // ⚠️ And it names NO genre — but the one that asserts that is `engine-boundary`, not this case. A first writing of the
    // message named a genre and that gate failed it, rightly. A second assertion here about the same rule failed too —
    // because naming the forbidden genres meant writing them. The two refusals were one, and the lesson is
    // `segment-bar`'s: a rule has ONE owner, and this one's is the boundary check, which applies it to ALL modules
    // instead of to one.
  });

  it('⚠️ [Zero] ZERO é reprovado, e não lido como «não usa controle»', () => {
    // A game that holds no position is not playable. Accepting zero would make the reach arithmetic pass by vacuity —
    // exactly what `reachable` refuses to do with an empty set of actions.
    for (const mau of [0, -1, 1.5, NaN, '3']) {
      expect(conformanceProblems({ ...plataforma(), holdsAtOnce: () => mau }), `aceitou ${mau}`).toHaveLength(1);
    }
    expect(conformanceProblems({ ...plataforma(), holdsAtOnce: 3 }), 'aceitou um NÚMERO no lugar da função').toHaveLength(1);
  });

  it('[Cross-check] conformidade é FORMA, não verdade — um `roleAt` que mente passa, e tem de passar', () => {
    // The boundary of what this module can know. A `roleAt` that returns 'free' for lava conforms here and is wrong in the
    // game; what catches that is the PRESET's test. Keeping this case written stops someone from strengthening
    // conformance until it tries to guess the game — exactly the defect ADR-0030 cut.
    expect(conformanceProblems({ ...plataforma(), roleAt: () => 'free' })).toEqual([]);
  });

  it('⚠️ [Interface] `holdsKeys` tem de devolver um BOOLEANO — truthy oferece a alternância a toda a gente', () => {
    /*
     * 🔴 A value that is not a boolean is truthy, so a game that holds nothing would OFFER the toggle — an accessibility
     * control that does nothing, ADR-0106 §5 in person. The argument was written beside the code; a probe of this module's
     * behaviours found three blind ones, and this is the first.
     */
    for (const mau of ['sim', 1, 0, null, {}]) {
      expect(conformanceProblems({ ...plataforma(), holdsKeys: () => mau }), `aceitou ${String(mau)}`).toHaveLength(1);
    }
    expect(conformanceProblems({ ...plataforma(), holdsKeys: () => false }), 'recusou um booleano legítimo').toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------------------
/*
 * 🔴 THE KEYBOARD'S TWIN, AND IT HAD NO CASE. 📏 A probe of `conformanceProblems`' decisions found the TWO for
 * `keyboardMapping` held and the TWO for `padMapping` blind — the same check written twice, one guarded and the other not.
 * It is what the Dev's question («há duas funções para resolver o mesmo problema?») exists to find, and the coverage's
 * asymmetry is how it shows.
 *
 * 📌 The cases go by SUBJECT and not by the shared function: when the two checks become one, a mutation in it would go
 * red by the KEYBOARD case and the pad would be covered by accident. A gate covered only by gold is no gate.
 */
describe('padMapping — o mapeamento que seria ignorado em silêncio', () => {
  it('⚠️ um VALOR em vez de função é acusado — senão a fábrica fica e o autor julga tê-la mudado', () => {
    expect(conformanceProblems({ ...plataforma(), padMapping: { action1: 3 } }).join(' | ')).toContain('padMapping');
  });

  it('⚠️ e um retorno que não é objecto nem `null` também — a fusão engoli-lo-ia sem escrever nada', () => {
    expect(conformanceProblems({ ...plataforma(), padMapping: () => 3 }).join(' | ')).toContain('padMapping');
    expect(conformanceProblems({ ...plataforma(), padMapping: () => [3] }).join(' | ')).toContain('padMapping');
  });

  it('[Zero] uma declaração correcta — e uma ausente — não acusam nada', () => {
    expect(conformanceProblems({ ...plataforma(), padMapping: () => ({ action1: 3 }) })).toEqual([]);
    expect(conformanceProblems({ ...plataforma(), padMapping: () => null })).toEqual([]);
    expect(conformanceProblems(plataforma())).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('needsPointer — o campo OPCIONAL que não é impune (ADR-0112)', () => {
  it('[Zero] ausente não é problema — a ausência É a resposta `false`', () => {
    // ⚠️ AND BEING OPTIONAL IS A DECISION, not carelessness. `holdsAtOnce` is required because it has no safe default and
    // fails INVISIBLY to whoever writes the game — they have a full keyboard, the game runs, and whoever pays is the child
    // on a two-finger phone. This one has a safe default and fails VISIBLY: a drawing game that forgets to declare it is
    // unusable on its own author's device.
    expect(conformanceProblems(plataforma()).filter((x) => /needsPointer/.test(x))).toEqual([]);
  });

  it('[Right] declarado como função devolvendo booleano não é problema', () => {
    expect(conformanceProblems({ ...plataforma(), needsPointer: () => true })).toEqual([]);
    expect(conformanceProblems({ ...plataforma(), needsPointer: () => false })).toEqual([]);
  });

  it('⚠️ [Boundary] declarado como VALOR e não função é recusado', () => {
    // `needsPointer: true` looks like declaring yes and declares nothing: the reach would call something that is not a
    // function. The game would believe it had answered, and nobody would know — the silent defect this function exists
    // not to let happen.
    const p = conformanceProblems({ ...plataforma(), needsPointer: true });
    expect(p.some((x) => /needsPointer: must be a function/.test(x))).toBe(true);
  });

  it('⚠️ [Boundary] devolver algo que não é booleano é recusado', () => {
    // `() => 'sim'` is true for being a non-empty string, so the game would refuse devices it can use — and refusing is the
    // most expensive thing this field can get wrong.
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
    // Still true — where the diagonal is legal. What changed is that it stopped being the only truth.
    expect(distance(GRADE, P(0, 0), P(1, 1))).toBe(1);
    expect(distance(GRADE, P(0, 0), P(3, 1))).toBe(3);
    expect(distance(GRADE, P(2, 5), P(2, 5))).toBe(0);
  });

  it('[Right] ⚠️ grade ORTOGONAL conta MOVIMENTOS: duas à direita e duas abaixo são QUATRO, não 2', () => {
    // It is ADR-0080's §3 finding, measured in `game-15puzzle`: nothing moves diagonally in a sliding puzzle, and Chebyshev
    // under-reported the distance up to 2×. Under-reporting distance to someone who cannot see the screen is not
    // imprecision — it is saying something far is close, and the child trusts it.
    expect(distance(DESLIZANTE, P(0, 0), P(2, 2))).toBe(4);
    expect(distance(DESLIZANTE, P(0, 0), P(1, 1))).toBe(2);
    expect(distance(DESLIZANTE, P(0, 0), P(3, 0))).toBe(3); // no eixo, as duas regras concordam
  });

  it('[Right] a MESMA grade com regras diferentes dá respostas diferentes — é o campo que decide', () => {
    // The pair that proves the rule is read, and not that the two fixtures happen to differ in something else.
    const size = [8, 8], frame = 'compass';
    const a = P(0, 0), b = P(3, 3);
    expect(distance({ kind: 'grid', size, frame, move: 'diagonal' }, a, b)).toBe(3);
    expect(distance({ kind: 'grid', size, frame, move: 'orthogonal' }, a, b)).toBe(6);
    expect(distance({ kind: 'grid', size, frame, move: 'free' }, a, b)).toBeCloseTo(Math.hypot(3, 3), 10);
  });

  it('[Boundary] três dimensões: o terceiro eixo entra na conta, e só quando declarado', () => {
    const cubo = { kind: 'grid', size: [4, 4, 4], move: 'orthogonal', frame: 'compass' };
    expect(distance(cubo, P(0, 0, 0), P(1, 1, 1))).toBe(3);
    // ⚠️ THE SAME POINT in a TWO-dimensional topology: the `z` is ignored, because the dimension is `size.length` and not
    // what the point happens to carry. Without this, a `z` forgotten in a fixture would change 2D distances.
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
    // Without symmetry the sonar would say one thing when approaching and another when moving away, with the same two points.
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
  // A minimal sonar, written AGAINST THE CONTRACT and against nothing else. If this code needed to know the genre, the
  // contract would be wrong — that is the only thing the rehearsal can show.
  //
  // What it is NOT: proof. ADR-0030 asks for two PRESETS, and two declarations in a test file are not presets — they do
  // not draw, take no input, do not live outside this `describe`. The difference is written here so nobody confuses a
  // green rehearsal with ADR-0027's step 6.
  const alvoMaisProximo = (decl, de, candidatos) =>
    candidatos
      .filter((c) => decl.roleAt(c) === 'goal')
      // ⚠️ `decl.topology()` WITH THE PARENTHESES, and they were missing. Passing the function where the topology goes
      // gave `t.kind === undefined` and the old `distance` fell into the continuous branch, dividing by a missing `t.unit`:
      // NaN in every distance, and a `sort` by NaN that returned the first item — the test passed by chance. The new shape
      // throws instead of lying, which is the only reason this showed up.
      .map((c) => ({ at: c, d: distance(decl.topology(), de, c), nome: decl.nameAt(c) }))
      .sort((x, y) => x.d - y.d)[0] ?? null;

  /** A make-believe grid map: only column 5 is a goal. */
  const gradeDecl = {
    ...plataforma(),
    topology: () => ({ kind: 'grid', size: [8, 8], move: 'diagonal', frame: 'compass' }),
    roleAt: (at) => (at.x === 5 ? 'goal' : 'structure'),
    nameAt: (at) => ({ text: `alvo ${at.x},${at.y}`, gender: 'm', plural: false }),
  };

  /** A make-believe list: only the item at index 3 is open. */
  const listaDecl = {
    ...lista(),
    roleAt: (at) => (at.x === 3 ? 'goal' : 'free'),
    nameAt: (at) => ({ text: `pergunta ${at.x + 1}`, gender: 'f', plural: false }),
  };

  const CANDIDATOS = [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }, { x: 5, y: 6 }];

  it('[Right] na grade, acha o objetivo mais perto pela métrica de grade', () => {
    const r = alvoMaisProximo(gradeDecl, { x: 5, y: 0 }, CANDIDATOS);
    expect(r.at).toEqual({ x: 5, y: 2 }); // 2 steps, against 6 for the other
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
