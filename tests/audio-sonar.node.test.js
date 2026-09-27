// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/audio-sonar — NAVIGATION SOUND after the item-19 cut (node project).
//
// ========================= THE FIXTURE IS THE PROOF =========================
// ADR-0027 calls this the decisive heuristic: a test of an ENGINE module whose fixture needs a COIN is proof that the cut
// did not take. The sonar's old fixture needed one — an array of coins with `owner` and `taken`, plus `tileAt`,
// `solidAt`, `BOX`, `TILE` and a scene, six platformer things to ask which target is nearest.
//
// This one needs none. It DECLARES topology, targets and name, which is what any game does. And the cases below run the
// SAME sonar over three topologies — continuous, grid and list — because that is the only way to assert that it travels:
// if a genre needed a special case, the cut would be in the wrong place.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import { createAudioSonar, worldStep, PAN_PACES } from '../app/js/platform/audio-sonar.js';

// ========================= THE FAKE AUDIO CONTEXT =========================
// A child with an audio device of their own gets a context of their own (`playerCtx`), and that context builds a gain: the
// cases below question those nodes. (The continuous guide, whose graph this fake was first built for, left for the
// platformer with its cases — ADR-0257.)
function param() {
  return { value: 0, alvos: [], setTargetAtTime(v) { this.value = v; this.alvos.push(v); } };
}

function fakeAC() {
  const osciladores = [], filtros = [], ganhos = [], panners = [], destinos = [];
  const liga = (self) => (n) => { destinos.push({ de: self, para: n }); return n; };
  const ac = {
    currentTime: 0,
    destination: { _nome: 'destination', connect() {} },
    createOscillator() {
      const o = { _nome: 'osc', type: '', frequency: param(), inicios: 0, parouEm: null, start() { o.inicios++; }, stop(t) { o.parouEm = t; } };
      o.connect = liga(o); osciladores.push(o); return o;
    },
    createBiquadFilter() { const f = { _nome: 'filtro', type: '', frequency: param(), Q: param() }; f.connect = liga(f); filtros.push(f); return f; },
    createGain() { const g = { _nome: 'ganho', gain: param() }; g.connect = liga(g); ganhos.push(g); return g; },
    createStereoPanner() { const p = { _nome: 'panner', pan: param() }; p.connect = liga(p); panners.push(p); return p; },
  };
  return { ac, osciladores, filtros, ganhos, panners, destinos };
}

const CONTINUO = { kind: 'continuous', size: [896, 992], unit: 16, move: 'free', frame: 'clock' };
// `move: 'diagonal'` made explicit: it is the rule this fixture ALWAYS assumed, and it is no longer the only one
// (ADR-0089). Without the field, the diagonal case would be asserting a default instead of a declaration.
const GRADE = { kind: 'grid', size: [20, 20], move: 'diagonal', frame: 'compass' };
const LISTA = { kind: 'hotspots', order: ['q1', 'q2', 'q3', 'q4'] };

function setup(over = {}) {
  const tone = [], said = [], narrated = [];
  const ctx = {
    t: translate, // the root's translator, played by the test (ADR-0232 D3)
    // `over.topology` is a VALUE (the topology), not a function. Worth saying: passing `() => GRADE` here made the ctx
    // hand the FUNCTION to the module, `t.kind` became undefined, `distance` fell into the continuous branch and divided
    // by `undefined` — NaN, no target chosen, nothing nearby. A wrong fixture that fails as if the module were wrong costs
    // more than one that breaks.
    topology: () => over.topology || CONTINUO,
    targetsOf: (i) => (over.targetsOf ? over.targetsOf(i) : (over.alvos || [])),
    // A generic DEFAULT name, not the platformer's: a sonar fixture that said coin on every line would reassert by habit
    // what the cut has just taken out of the module. The cases that need a concrete name declare one, and a different
    // one each time.
    nameAt: over.nameAt || (() => ({ text: 'alvo', gender: 'm', plural: false })),
    tonePan: (freq, dur, cat, pan) => tone.push({ freq, cat, pan }),
    srSay: (t) => said.push(t), narrate: (t) => narrated.push(t),
    // What is on screen (ADR-0234). OMITTED by default: a sonar without a reader keeps the navigation sentence.
    screenText: over.screenText,
    // ⚠️ THE MODES TABLE LEFT (#104), and the fixture got better for it. It declared `{ normal, cego, baixa }` — three keys
    // that do NOT EXIST in the real catalogue (`normal`, `blind`, `lv-*`) — and the module went through it with `pl.viz`.
    // That is: the test invented a vocabulary for the module to consult, and passed because of it. Now the ctx answers
    // the QUESTION, and the fixture says which players have impaired vision (`vePouco`), which is what the cases always
    // meant to say.
    visionImpaired: (pl) => (over.visionImpaired ? over.visionImpaired(pl) : !!pl.vePouco),
    getBlindMode: () => over.blindMode || false,
    LOGICAL_W: 320,
    getNumPlayers: () => over.numPlayers || 1,
    // The root's context maker (ADR-0232 D4). A host with none by default: only the per-player cases below make one.
    newContext: over.newContext || (() => null),
  };
  return { som: createAudioSonar(ctx), tone, said, narrated };
}

const pl = (o = {}) => ({ x: 32, y: 32, vePouco: true, i: 0, ...o });

describe('platform/audio-sonar · o que não depende de gênero', () => {
  it('[Boundary] needsAudioCues: o modo cego LIGA para toda a gente; fora dele, quem vê pouco recebe', () => {
    // ⚠️ THE RULE THAT STAYED IN THIS MODULE IS THE FIRST, and it is the only one truly its own: blind mode beats the
    // declared vision, because it is a choice of whoever is playing and not a measure of what she sees.
    expect(setup({ blindMode: true }).som.needsAudioCues(pl({ vePouco: false }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ vePouco: true }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ vePouco: false }))).toBe(false);
    // And the visual half is INJECTED: the module does not compute it, and a ctx that answers otherwise rules.
    expect(setup({ visionImpaired: () => true }).som.needsAudioCues(pl({ vePouco: false }))).toBe(true);
  });

  it('[Simple] panFor: à direita > 0, à esquerda < 0, centrado ~0', () => {
    const { som } = setup();
    expect(som.panFor(320, pl({ x: 0 }))).toBeGreaterThan(0);
    expect(som.panFor(0, pl({ x: 320 }))).toBeLessThan(0);
    expect(som.panFor(32, pl({ x: 32 }))).toBe(0);
  });
});

describe('platform/audio-sonar · o alvo vem do CONTRATO, não de um array de moedas', () => {
  it('[Many] escolhe o mais próximo entre os alvos DECLARADOS, e conta', () => {
    // The filter by owner and by already-collected is GONE from here, and that absence is what matters: what still
    // counts is the game's decision, in `targetsOf`. The sonar receives a list and compares distances.
    const { som, said, narrated } = setup({ alvos: [{ x: 300, y: 32 }, { x: 48, y: 32 }] });
    som.sonar(pl());
    expect(som.sonarCount).toBe(1);
    // `às 3 horas` and not `à direita`: the fixture declares `frame: 'clock'`, the frame of reference of a 2D platformer
    // seen from the side. The word comes from the GAME, not from arithmetic on raw `x` (ADR-0089).
    expect(said[0]).toContain('às 3 horas');
    expect(narrated.length).toBe(1);
  });

  it('[Interface] cada jogador recebe a SUA lista — o índice atravessa', () => {
    const { som, said } = setup({ targetsOf: (i) => (i === 0 ? [{ x: 300, y: 32 }] : [{ x: 8, y: 32 }]) });
    som.sonar(pl({ i: 0 }));
    som.sonar(pl({ i: 1 }));
    expect(said[0]).toContain('às 3 horas'); // 300 is to the right of 32 → 3 o'clock
    expect(said[1]).toContain('às 9 horas'); // 8 is to the left → 9 o'clock
  });

  it('[Zero] lista de alvos VAZIA é resposta legítima: avisa e não quebra', () => {
    const { som, said } = setup({ alvos: [] });
    som.sonar(pl());
    expect(said).toEqual(['Nada por perto.']);
  });

  it('[Right] o NOME do alvo vem do jogo — a engine não diz mais "moeda" por conta própria', () => {
    // The case that measures field 3. The announcement used to carry a hard-coded `t('sr.nav.coin')`; in a quiz game that
    // would have a blind child's sonar talk about coins that do not exist.
    const { som, said } = setup({
      alvos: [{ x: 48, y: 32 }],
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
    });
    som.sonar(pl());
    expect(said[0]).toContain('pergunta');
    expect(said[0]).not.toContain('alvo'); // not even the generic fallback: the game names it
  });

  it('[Error] alvo declarado SEM nome cai numa palavra genérica, e não numa chave crua', () => {
    const { som, said } = setup({ alvos: [{ x: 48, y: 32 }], nameAt: () => null });
    som.sonar(pl());
    expect(said[0]).toContain('alvo');
    expect(said[0]).not.toContain('sr.nav');
  });
});

describe('platform/audio-sonar · a MÉTRICA é a declarada (é o que faz o sonar viajar)', () => {
  // The three cases below run the SAME code over three topologies. It is item 19's central claim, and the only honest way
  // to make it: if any of them needed a branch of its own in the module, the sonar would not be the engine's — it would
  // be the platformer's in disguise.

  it('[Right] contínuo: distância em UNIDADES, então 4 e 9 tiles seguem sendo os limiares de antes', () => {
    const perto = setup({ alvos: [{ x: 32 + 3 * 16, y: 32 }] });   // 3 unidades → "muito perto"
    perto.som.sonar(pl());
    const longe = setup({ alvos: [{ x: 32 + 12 * 16, y: 32 }] });  // 12 unidades → "longe"
    longe.som.sonar(pl());
    expect(perto.said[0]).not.toEqual(longe.said[0]);
    expect(perto.said[0]).toContain('bem perto');
    expect(longe.said[0]).toContain('longe');
  });

  it('[Right] grade: a distância é em CASAS, e a diagonal custa uma só', () => {
    const { som, said } = setup({ topology: GRADE, alvos: [{ x: 3, y: 3 }] });
    som.sonar(pl({ x: 2, y: 2 })); // Chebyshev: 1 casa → "muito perto"
    expect(said[0]).toContain('bem perto');
  });

  it('[Right] lista: a distância é diferença de ÍNDICE — um quiz usa o mesmo sonar', () => {
    const { som, said } = setup({
      topology: LISTA,
      alvos: [{ x: 3, y: 0 }],
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
    });
    som.sonar(pl({ x: 0, y: 0 })); // 3 away → very close
    expect(said[0]).toContain('pergunta');
    expect(said[0]).toContain('bem perto');
  });

  it('[Cross-check] a MESMA separação em unidades dá a MESMA frase em qualquer topologia', () => {
    // If this case falls, some topology got special treatment inside the module — exactly what the cut exists to prevent.
    const cont = setup({ alvos: [{ x: 32 + 6 * 16, y: 32 }] }); cont.som.sonar(pl());
    const grade = setup({ topology: GRADE, alvos: [{ x: 6, y: 0 }] }); grade.som.sonar(pl({ x: 0, y: 0 }));
    const lista = setup({ topology: LISTA, alvos: [{ x: 6, y: 0 }] }); lista.som.sonar(pl({ x: 0, y: 0 }));
    const dist = (t) => t.replace(/^.*?,\s*/, ''); // drops the side, keeps the distance
    expect(dist(grade.said[0])).toBe(dist(cont.said[0]));
    expect(dist(lista.said[0])).toBe(dist(cont.said[0]));
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('a NARRAÇÃO diz o RUMO, e o rumo vem do referencial que o jogo declarou (ADR-0089)', () => {
  // What this replaces: `alvo.at.x < pl.x - 4 ? 'left' : alvo.at.x > pl.x + 4 ? 'right' : 'ahead'`. Three words where the
  // contract has eight, mixing a SCREEN frame of reference (left, right) with a BODY one (ahead) — whoever listens has no
  // way to know which origin each one speaks from.
  const acima = { x: 32, y: 0 }, abaixo = { x: 32, y: 64 };

  it('[Right] ⚠️ ACIMA e ABAIXO deixam de virar «à frente» — é o defeito, em uma linha', () => {
    // With the ±4 dead zone, EVERYTHING in the same column became ahead, whether above or below. It was exactly the
    // information most missing for someone who cannot see the screen, erased by arithmetic on `x` that never looked at `y`.
    expect(sonarDe([acima])).toContain('às 12 horas');
    expect(sonarDe([abaixo])).toContain('às 6 horas');
  });

  it('[Interface] o MESMO alvo dá palavras diferentes conforme o referencial declarado', () => {
    // The pair that proves the `frame` field is read, and not that two fixtures happen to differ in something else.
    expect(sonarDe([acima])).toContain('às 12 horas');            // CONTINUO declares `frame: 'clock'`
    expect(sonarDe([acima], GRADE)).toContain('ao norte');        // GRADE declara `frame: 'compass'`
  });

  it('[Many] num jogo de bússola, as quatro direções saem com o nome próprio', () => {
    expect(sonarDe([{ x: 32, y: 0 }], GRADE)).toContain('ao norte');
    expect(sonarDe([{ x: 32, y: 64 }], GRADE)).toContain('ao sul');
    expect(sonarDe([{ x: 64, y: 32 }], GRADE)).toContain('a leste');
    expect(sonarDe([{ x: 0, y: 32 }], GRADE)).toContain('a oeste');
  });

  it('[Zero] alvo no MESMO lugar não ganha direção inventada', () => {
    expect(sonarDe([{ x: 32, y: 32 }])).toContain('aqui mesmo');
  });

  it('[Boundary] ⚠️ a hora 1 tem forma PRÓPRIA — «às 1 horas» não é português', () => {
    // A key with `{h}` covers eleven of the twelve hours, which is why the twelfth goes unnoticed: the case exists only if
    // someone picks a target ~30° from the top. Without it, the mutation that deletes the singular stays green — and the
    // screen reader reads an ungrammatical sentence at every sonar on hour 1.
    const frase = sonarDe([{ x: 37, y: 23 }]); // ~30° clockwise from the top
    expect(frase).toContain('à 1 hora');
    expect(frase).not.toContain('às 1 horas');
  });

  /** Fires the sonar once and returns the sentence said. */
  function sonarDe(alvos, topology) {
    const { som, said } = setup(topology ? { alvos, topology } : { alvos });
    som.sonar(pl());
    return said[0];
  }
});

// ==========================================================================================================
// ⚠️ THE STEREO WIDTH IS MEASURED ON THE WORLD'S RULER, NOT THE SCREEN'S (#121)
//
// The pan divided by `LOGICAL_W * 0.55` = 320 × 0.55 = **176 SCREEN pixels**, and what it divides (`wx - pl.x`) comes
// from the TOPOLOGY. The two rulers agree only when the world is also measured in pixels.
//
// Measured while building `game-soccer`: on a 90-METRE pitch, a teammate ten metres to the right gave `10 / 176 = 0.057`
// — mono, in practice. The sonar would be **right and inaudible**, the same class of defect the quiz recorded as right
// and useless. For the platformer it was true by chance, and for `grid`/`hotspots` it was vacuous — which is why nobody
// saw it.
//
// ⚠️ ELEVEN IS NOT A NEW NUMBER: 176 px / `unit: TILE` = 16 is exactly 11 tiles. The first case below asserts that the
// platformer's child still hears EXACTLY what she heard.
//
// MUTATIONS CHECKED (at the end of the block).
// ==========================================================================================================
describe('platform/audio-sonar — o pan na regua declarada (#121)', () => {
  const CAMPO = { kind: 'continuous', size: [90, 60], unit: 1, move: 'free', frame: 'compass' };

  it('⚠️ [Right] a plataforma ouve EXATAMENTE o que ouvia — 11 passos de 16 sao os 176 px de antes', () => {
    const { som } = setup(); // CONTINUO, unit: 16
    expect(som.panFor(0 + 176, pl({ x: 0 })), 'a saturacao mudou de sitio').toBe(1);
    expect(som.panFor(0 + 88, pl({ x: 0 })), 'meia largura deixou de ser meio pan').toBeCloseTo(0.5, 6);
    expect(som.panFor(0 - 176, pl({ x: 0 }))).toBe(-1);
  });

  it('⚠️ [Right] no campo de metros dez metros a direita JA SE OUVEM', () => {
    // The issue's number: with the screen denominator it gave 0.057. With 11 paces of 1 metre it gives 0.909.
    const { som } = setup({ topology: CAMPO });
    const pan = som.panFor(10, pl({ x: 0, y: 0 }));
    expect(pan).toBeCloseTo(10 / 11, 6);
    expect(pan, 'continua praticamente mono').toBeGreaterThan(0.5);
  });

  it('⚠️ [Cross-check] e a formula ANTIGA dava mesmo 0,057 — o defeito, em aritmetica', () => {
    // Without this, the case above could be green because the issue's number was wrong, and nobody would know.
    expect(10 / (320 * 0.55)).toBeCloseTo(0.057, 3);
  });

  it('[Right] na grade um passo e uma celula', () => {
    const { som } = setup({ topology: GRADE });
    expect(som.panFor(11, pl({ x: 0, y: 0 }))).toBe(1);
    expect(som.panFor(5.5, pl({ x: 0, y: 0 }))).toBeCloseTo(0.5, 6);
  });

  it('⚠️ [Zero] `hotspots` nao tem lado — o pan e ZERO, e nao um numero calculado sobre indices', () => {
    // A list is an ORDER, not a geometry. The contract's `bearing` already answers `none` for the same reason; pointing
    // right in a list of questions is pointing at nothing.
    const { som } = setup({ topology: LISTA });
    expect(som.panFor(3, pl({ x: 0, y: 0 }))).toBe(0);
    expect(som.panFor(-3, pl({ x: 0, y: 0 }))).toBe(0);
  });

  it('[Boundary] o pan continua preso entre -1 e 1 em qualquer topologia', () => {
    for (const topology of [CONTINUO, GRADE, CAMPO]) {
      const { som } = setup({ topology });
      expect(som.panFor(1e9, pl({ x: 0, y: 0 }))).toBe(1);
      expect(som.panFor(-1e9, pl({ x: 0, y: 0 }))).toBe(-1);
    }
  });

  it('⚠️ [Interface] `worldStep` responde pelas tres topologias, e a lista responde ZERO', () => {
    expect(worldStep(CONTINUO)).toBe(16);
    expect(worldStep(CAMPO)).toBe(1);
    expect(worldStep(GRADE)).toBe(1);
    expect(worldStep(LISTA)).toBe(0);
    expect(PAN_PACES, '11 e a releitura de 176/16; mudar isto muda o que a crianca ja ouve').toBe(11);
  });
});

describe('playerCtx — a child with an audio device of their own gets a context of their own (ADR-0232 D4)', () => {
  // The context comes from the ROOT's maker (`newContext`, from `host.win`), no longer from `window`: these cases are what
  // tell whether the injected maker is the one used, and that a sink is honoured on the context it made.
  function sinkContext() {
    const sinks = [];
    const f = fakeAC();
    const ac = Object.assign(f.ac, { state: 'running', setSinkId: (id) => { sinks.push(id); return Promise.resolve(); } });
    return { ac, sinks, ganhos: f.ganhos, destinos: f.destinos };
  }

  it('🔴 [Right] the context is the one the root\'s maker made, sent to the child\'s device, with an output of its own', () => {
    const { ac, sinks, ganhos, destinos } = sinkContext();
    let made = 0;
    const { som } = setup({ newContext: () => { made++; return ac; } });
    const pl = { i: 0, x: 0, y: 0, audioSink: 'fones-da-ana' };
    const out = som.playerCtx(pl);
    expect(out?.ac, 'the context did not come from the injected maker').toBe(ac);
    expect(out.out).toBe(ganhos[0]);
    expect(destinos.at(-1)).toEqual({ de: ganhos[0], para: ac.destination });
    expect(sinks).toEqual(['fones-da-ana']);
    som.playerCtx(pl);
    expect(made, 'a second cue made a second context for the same child').toBe(1);
  });

  it('📌 [Zero] a host with no audio context: no player context, and nothing thrown', () => {
    const { som } = setup({ newContext: () => null });
    expect(som.playerCtx({ i: 0, x: 0, y: 0, audioSink: 'fones' })).toBeNull();
  });

  it('📌 [Zero] a child without a device of their own is not given a context: the maker is not even asked', () => {
    let made = 0;
    const { som } = setup({ newContext: () => { made++; return sinkContext().ac; } });
    expect(som.playerCtx({ i: 0, x: 0, y: 0 })).toBeNull();
    expect(made).toBe(0);
  });
});

/*
 * THE SONAR OF WHAT IS ON SCREEN (ADR-0234): «O sonar, ao ser apertado com texto na tela faz com que o texto seja lido». The
 * words are the screen's, read at the press; the TONE is the navigation sonar's, unchanged — it still points at the target.
 */
describe('platform/audio-sonar · with text on screen, the words are the screen\'s (ADR-0234)', () => {
  const SCREEN = 'Qual animal põe ovos e tem bico? Gato. Galinha.';

  it('🔴 [Right] the words are the text on screen — said and narrated — and no navigation sentence', () => {
    const { som, said, narrated } = setup({ alvos: [{ x: 48, y: 32 }], screenText: () => SCREEN });
    som.sonar(pl());
    expect(narrated, 'the voice (or, in deaf mode, the interpreter) was not handed the screen').toEqual([SCREEN]);
    expect(said, 'the screen reader was not handed the screen').toEqual([SCREEN]);
  });

  it('🔴 [Right] the tone still points at the target: the same pitch and side as without text on screen', () => {
    const sem = setup({ alvos: [{ x: 300, y: 32 }] });
    sem.som.sonar(pl());
    const com = setup({ alvos: [{ x: 300, y: 32 }], screenText: () => SCREEN });
    com.som.sonar(pl());
    expect(com.tone, 'reading the screen changed or silenced the navigation tone').toEqual(sem.tone);
    expect(com.tone[0].pan, 'the tone stopped pointing to the right').toBeGreaterThan(0);
  });

  it('🔴 [Right] the screen is read at EVERY press — never a copy taken earlier', () => {
    let screen = 'Pergunta um.';
    const { som, narrated } = setup({ alvos: [{ x: 48, y: 32 }], screenText: () => screen });
    som.sonar(pl());
    screen = 'Pergunta dois.';
    som.sonar(pl());
    expect(narrated).toEqual(['Pergunta um.', 'Pergunta dois.']);
  });

  it('🔴 [Zero] no text the engine can read (`\'\'`): the navigation sentence, as before', () => {
    const { som, said, narrated } = setup({ alvos: [{ x: 300, y: 32 }], screenText: () => '' });
    som.sonar(pl());
    expect(said[0]).toContain('às 3 horas');
    expect(narrated).toEqual(said);
  });

  it('🔴 [Zero] no target, text on screen: the low tone that says «nothing to find», and the screen\'s words', () => {
    const { som, said, narrated, tone } = setup({ alvos: [], screenText: () => SCREEN });
    som.sonar(pl());
    expect(tone.map((x) => x.freq)).toEqual([300]);
    expect(narrated).toEqual([SCREEN]);
    expect(said, '«nothing nearby» was said over a screen that has text').toEqual([SCREEN]);
  });
});

// ========================= MUTATIONS CHECKED =========================
// THE SCREEN'S WORDS (ADR-0234), each run on its own against the block above:
//   · the words stay the navigation sentence (`screenText` never read) → the [Right] words, every-press and no-target cases fail;
//   · the text is read at the FIRST press and kept → the every-press case fails («Pergunta um.» twice);
//   · only `narrate` gets the text (no `srSay`) → the [Right] words and no-target cases fail;
//   · the tone is skipped when there is text → the tone case fails (`[]` against the navigation tone);
//   · an empty text is taken as text → the [Zero] navigation case fails (it narrates `''`).
//   · putting back `(ctx.LOGICAL_W * 0.55)` as the denominator → TWO fail: the metres-pitch case with **0.0568** — the
//     exact number the audit measured — and the one-step-is-one-cell grid case. It is #121 reproduced, and the
//     `[Cross-check]` beside it confirms the issue's number was right.
//   · changing `PAN_PACES` from 11 to 12 → FOUR fail, including the platformer-hears-EXACTLY-what-it-heard case. It is
//     what keeps the fix from touching, in passing, what already worked for a child.
//   · making `worldStep` return 1 for `hotspots` → TWO fail: the `hotspots`-has-no-side case and the [Interface]. A pan
//     computed over list indices points to a side that does not exist.
//   · removing the `Math.max(-1, Math.min(1, ...))` → the [Boundary] pan-stays-clamped case fails in all three.

