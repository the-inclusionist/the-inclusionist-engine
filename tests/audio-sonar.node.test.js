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
import {
  createAudioSonar, worldStep, PAN_PACES, GUIDE_WAVE, GUIDE_VOL, FRAMES_BETWEEN_ROUTES,
} from '../app/js/platform/audio-sonar.js';
import { FAR_CUT, NEAR_CUT } from '../app/js/platform/guide-intensity.js';
import { routeTo } from '../app/js/core/route.js';
import { distance } from '../app/js/core/contract.js';

// ========================= THE FAKE AUDIO CONTEXT =========================
// ⚠️ IT HAD TO EXIST, and the reason is the whole change of #84 item 2. While the guide was a BEEP it went out through the
// injected `tonePan` and the fixture needed only an array — `getAudioCtx: () => ({})` was enough, because nobody called
// any method on it. A CONTINUOUS presence is a GRAPH that stays, and a graph does not go through `tonePan`: it is
// `createOscillator` + `createBiquadFilter` + `createGain`, and those nodes are what the cases below question.
//
// ⚠️ AND THAT IS WHY THIS BLOCK'S FOUR OLD CASES WERE REWRITTEN, not adjusted: three of them asserted through the `tone`
// (`tonePan`) — and with the guide out of `tonePan` they would pass forever, green, without touching the code they claim
// to cover. A test that reads through the binding does not fail when the binding changes.
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
    // ⚠️ THE MODES TABLE LEFT (#104), and the fixture got better for it. It declared `{ normal, cego, baixa }` — three keys
    // that do NOT EXIST in the real catalogue (`normal`, `blind`, `lv-*`) — and the module went through it with `pl.viz`.
    // That is: the test invented a vocabulary for the module to consult, and passed because of it. Now the ctx answers
    // the QUESTION, and the fixture says which players have impaired vision (`vePouco`), which is what the cases always
    // meant to say.
    visionImpaired: (pl) => (over.visionImpaired ? over.visionImpaired(pl) : !!pl.vePouco),
    getBlindMode: () => over.blindMode || false,
    LOGICAL_W: 320,
    getPlayers: () => over.players || [],
    getNumPlayers: () => over.numPlayers || 1,
    getAudioCtx: () => (over.audioCtx === undefined ? {} : over.audioCtx),
    getSoundOn: () => (over.soundOn === undefined ? true : over.soundOn),
    getAudioCat: () => (over.audioCat === undefined ? { guide: { on: true } } : over.audioCat),
    // The guide's four. `roleAt` OMITTED by default: the old fixture did not have it, and the module must keep working
    // without it — the compatibility promise the optional field makes.
    roleAt: over.roleAt,
    catNode: over.catNode, audioOut: over.audioOut, getVolume: over.getVolume,
  };
  return { som: createAudioSonar(ctx), tone, said, narrated };
}

/** A setup with a real audio context (the fake one) — everything that questions the GRAPH goes through here. */
function setupGuia(over = {}) {
  const f = fakeAC();
  return { ...setup({ audioCtx: f.ac, ...over }), ...f };
}

/** Runs `n` frames, advancing the clock as a real engine would. */
function quadros(som, f, n) {
  for (let i = 0; i < n; i++) { f.ac.currentTime += 1 / 60; som.updateGuide(); }
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

describe('platform/audio-sonar · updateGuide, a PRESENÇA CONTÍNUA (#84 item 2)', () => {
  it('⚠️ [Right] O BIPE MORREU: um oscilador SÓ, que começa uma vez e nunca para sozinho', () => {
    // THIS IS THE CASE THAT DEFINES THE CHANGE. The old guide created a 0.12 s `triangle` every 48 frames and threw it
    // away; in 120 frames there were TWO oscillators, each a shot. The Dev's verdict on that: «um ping é a pior escolha
    // possível, tenebroso para quem tem TEA». If someone goes back to creating an oscillator per event, this count
    // passes 1 and the case falls.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }] });
    quadros(g.som, g, 120);
    expect(g.osciladores.length, 'nasceu mais de um oscilador — isto voltou a disparar').toBe(1);
    expect(g.osciladores[0].inicios).toBe(1);
    expect(g.osciladores[0].parouEm, 'o guia parou sozinho: virou um som com fim, que é um bipe').toBe(null);
    expect(g.som.guideCount).toBe(120); // counts FRAMES that sound, not beeps
  });

  it('⚠️ [Right] o timbre tem HARMÓNICOS e o filtro é passa-baixo — sem isso o eixo do brilho não existe', () => {
    // A low-pass over a `sine` cuts nothing: there are no harmonics above the fundamental. The guide would be left with its
    // main axis dead and only the volume working, with nothing failing. And the `sawtooth` is also what sets it apart
    // from the sonar and the cane, which are `sine`.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }] });
    quadros(g.som, g, FRAMES_BETWEEN_ROUTES);
    expect(g.osciladores[0].type).toBe(GUIDE_WAVE);
    expect(GUIDE_WAVE, 'uma senoide não tem o que filtrar').not.toBe('sine');
    expect(g.filtros[0].type).toBe('lowpass');
  });

  it('⚠️ [Right] aproximar-se ABRE o filtro; afastar-se fecha-o, e nenhum dos dois cala', () => {
    const perto = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 32 + 16, y: 32 }] });      // 1 passo
    const longe = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 32 + 20 * 16, y: 32 }] }); // 20 passos
    quadros(perto.som, perto, FRAMES_BETWEEN_ROUTES + 2);
    quadros(longe.som, longe, FRAMES_BETWEEN_ROUTES + 2);
    expect(perto.filtros[0].frequency.value).toBeGreaterThan(longe.filtros[0].frequency.value);
    expect(perto.ganhos[0].gain.value).toBeGreaterThan(longe.ganhos[0].gain.value);
    // ⚠️ AND FAR IS NOT SILENCE. If it were, far would be indistinguishable from no target.
    expect(longe.ganhos[0].gain.value, 'o guia calou ao longe').toBeGreaterThan(0);
    expect(longe.filtros[0].frequency.value).toBeGreaterThanOrEqual(FAR_CUT);
    expect(perto.filtros[0].frequency.value).toBeLessThanOrEqual(NEAR_CUT);
  });

  it('[Zero] categoria `guide` desligada: nenhum grafo nasce', () => {
    const g = setupGuia({ audioCat: { guide: { on: false } }, players: [pl()], alvos: [{ x: 48, y: 32 }] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length).toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('[Zero] jogador que enxerga não ganha guia, mesmo com alvo ao lado', () => {
    const g = setupGuia({ players: [pl({ vePouco: false })], alvos: [{ x: 40, y: 32 }] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length).toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('⚠️ [Zero] SEM ALVO o guia nem chega a acender — e nasceu vermelho a acender 60× por segundo', () => {
    // Silence is the ONLY statement the guide can make, and it means there is no target (`guide-intensity`'s `FAR_VOL`
    // exists so that far never makes it). The first writing of this lit the graph and only then asked for the target:
    // sixty oscillators created and destroyed per second, inaudible and costly. It is the new cost of PERMANENCE — the
    // beep could not have this defect because nothing of it lasted.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length, 'acendeu um grafo para não ter nada a apontar').toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('⚠️ [Interface] o alvo DESAPARECER a meio apaga o grafo — apanhar a última moeda cala o guia', () => {
    // The teardown path the case above does not exercise: here the guide does sound, and it is losing the target (not the
    // category, not the visual mode) that switches it off.
    let alvos = [{ x: 60, y: 32 }];
    const g = setupGuia({ players: [pl({ vePouco: true })], targetsOf: () => alvos });
    quadros(g.som, g, FRAMES_BETWEEN_ROUTES + 2);
    expect(g.osciladores.length).toBe(1);
    expect(g.osciladores[0].parouEm).toBe(null);
    alvos = [];
    quadros(g.som, g, FRAMES_BETWEEN_ROUTES + 1);
    expect(g.osciladores[0].parouEm, 'o alvo sumiu e o guia continuou a apontar para ele').not.toBe(null);
    expect(g.osciladores.length, 'apagou e acendeu outro — o laço voltou a girar').toBe(1);
  });

  it('⚠️ [Interface] desligar a categoria a MEIO apaga o grafo — um som que fica é um som que vaza', () => {
    // While the guide was a beep, switching off meant not firing the next one and the problem did not exist. A permanent
    // oscillator nobody stops goes on playing with the slider at zero.
    const cat = { guide: { on: true } };
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }], audioCat: cat });
    quadros(g.som, g, 30);
    expect(g.osciladores[0].parouEm).toBe(null);
    cat.guide.on = false;
    quadros(g.som, g, 2);
    expect(g.osciladores[0].parouEm, 'a categoria desligou e o oscilador continuou vivo').not.toBe(null);
  });

  it('[Interface] o volume MESTRE multiplica o guia, e não o desliga do grafo', () => {
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 48, y: 32 }], getVolume: () => 0 });
    quadros(g.som, g, FRAMES_BETWEEN_ROUTES + 2);
    expect(g.ganhos[0].gain.value).toBe(0);
    expect(g.osciladores[0].parouEm, 'baixar o volume matou o grafo em vez de o silenciar').toBe(null);
  });

  it.each([
    ['the game\'s sound off', { soundOn: false }],
    ['no categories at all', { audioCat: null }],
    ['no `guide` category', { audioCat: {} }],
  ])('🔴 [Zero] %s: no graph is built, and nothing throws', (_titulo, over) => {
    // Only the category switched OFF had a case; a mixer with the whole sound off, or one that never named the category,
    // either lit the guide anyway or threw on `cat.guide`.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 48, y: 32 }], ...over });
    expect(() => quadros(g.som, g, 30)).not.toThrow();
    expect(g.osciladores.length).toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('⚠️ [Error] a device that refuses to build the graph leaves the guide off, and the frame goes on', () => {
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 48, y: 32 }] });
    g.ac.createOscillator = () => { throw new Error('no oscillator on this device'); };
    expect(() => quadros(g.som, g, 30)).not.toThrow();
    expect(g.som.guideCount).toBe(0);
  });

  it('🔴 [Right] the route is measured every FRAMES_BETWEEN_ROUTES frames — no sooner, no later — and the pan follows it', () => {
    // The pan says WHICH SIDE the target is on. It is the route's answer, and the route is asked on a cadence: every frame
    // would be the BFS sixty times a second, and never would leave the guide pointing where the target used to be.
    let alvos = [{ x: 32 + 4 * 16, y: 32 }];                              // to the right
    const g = setupGuia({ players: [pl({ vePouco: true })], targetsOf: () => alvos });
    quadros(g.som, g, 1);                                                  // the first frame measures
    expect(g.panners[0].pan.value, 'the pan does not say the target is to the right').toBeGreaterThan(0);
    alvos = [{ x: 32 - 4 * 16, y: 32 }];                                   // it moves to the left
    quadros(g.som, g, FRAMES_BETWEEN_ROUTES - 1);
    expect(g.panners[0].pan.value, 'the route was measured before its cadence').toBeGreaterThan(0);
    quadros(g.som, g, 1);
    expect(g.panners[0].pan.value, 'the route was not measured on its cadence').toBeLessThan(0);
  });

  it('[Simple] o ganho de base é MAIS BAIXO do que o do bipe que substitui', () => {
    // A sound that never stops is perceived as louder than a transient of the same peak. The beep used 0.11.
    expect(GUIDE_VOL).toBeLessThan(0.11);
    expect(GUIDE_VOL, 'o piso de volume não pode ser zero').toBeGreaterThan(0);
  });
});

// ========================= MUTATIONS CHECKED (the guide's wiring) =========================
// Applied by script to the file, with an occurrence count, one at a time.
//   · the graph no longer surviving the frame (`pl._guide` not kept) → THREE fail: `O BIPE MORREU` (60 oscillators
//     instead of 1) and the two teardown cases, which now look at the wrong oscillator. The mutation literally produces
//     the defect this item exists to remove, sixty times worse.
//   · `GUIDE_WAVE` from `sawtooth` to `sine` → the harmonics case fails. The guide would still sound and the filter still
//     move; what would die silently is the MAIN AXIS, because a sine has no harmonics for a low-pass to cut.
//   · removing `stopGuide(pl)` from the guard above → the switch-the-category-off-midway case fails. The oscillator stays
//     alive with the slider at zero — a sound that lasts is a sound that leaks.
//   · `if (roleAt)` → `if (roleAt && false)` (everything falls to the straight line) → the distance-the-child-WALKS case
//     fails. The guide would again say almost there about a target behind a wall.
//   · `GUIDE_VOL * i.volume * vol` → `GUIDE_VOL * i.volume` → the MASTER-volume case fails. The guide would ignore the
//     game's volume slider, and only that one.
//   · removing the no-target check before lighting (`nearestSpot`) → TWO fail: the no-target-never-lights case and the
//     vanishing-target one. It is the defect this battery caught by itself: the first writing lit and put out a graph
//     per frame.

describe('platform/audio-sonar · a rota, quando o jogo a permite (#84 item 2)', () => {
  // A 20×20 grid with a vertical WALL at x = 5, open only at y = 19. The target is just on the other side: in a straight
  // line that is 2 cells; on foot it is many, because one must go down, round and back.
  const PAREDE = (at) => (at.x === 5 && at.y !== 19 ? 'solid' : 'free');
  const GRADE_ORTO = { kind: 'grid', size: [20, 20], move: 'orthogonal', frame: 'compass' };

  it('⚠️ [Right] com `roleAt`, a distância é a que a criança ANDA — não a reta que atravessa a parede', () => {
    const comRota = setupGuia({
      topology: GRADE_ORTO, roleAt: PAREDE,
      players: [pl({ x: 4, y: 0, vePouco: true })], alvos: [{ x: 6, y: 0 }],
    });
    const semRota = setupGuia({ // SAME scene, without field 2 injected
      topology: GRADE_ORTO,
      players: [pl({ x: 4, y: 0, vePouco: true })], alvos: [{ x: 6, y: 0 }],
    });
    quadros(comRota.som, comRota, FRAMES_BETWEEN_ROUTES + 2);
    quadros(semRota.som, semRota, FRAMES_BETWEEN_ROUTES + 2);
    // The straight line says 2 cells and opens the filter almost fully; the route knows about the wall and keeps it closed.
    expect(
      comRota.filtros[0].frequency.value,
      'a rota não foi usada: o guia diz «quase lá» de um alvo atrás de uma parede',
    ).toBeLessThan(semRota.filtros[0].frequency.value);
  });

  it('⚠️ [Interface] as DUAS distâncias já estão na mesma unidade: passos', () => {
    // It is the assertion that prevents the extra conversion. `distance()` divides by `unit` in the continuous branch, and
    // `routeTo().steps` counts steps by definition — dividing again by the world's step would put the guide at full
    // brightness forever in a game with `unit = 16`. It is the defect #121 took out of `panFor`.
    const semParede = { topology: GRADE_ORTO, roleAt: () => 'free' };
    const rota = routeTo({ ...semParede, topology: GRADE_ORTO }, { x: 0, y: 0 }, [{ x: 7, y: 0 }]);
    expect(rota.steps).toBe(distance(GRADE_ORTO, { x: 0, y: 0 }, { x: 7, y: 0 }));
    // And with a wall the route is STRICTLY longer — never shorter than the straight line, in any case.
    const desvio = routeTo({ topology: GRADE_ORTO, roleAt: PAREDE }, { x: 4, y: 0 }, [{ x: 6, y: 0 }]);
    expect(desvio.steps).toBeGreaterThan(distance(GRADE_ORTO, { x: 4, y: 0 }, { x: 6, y: 0 }));
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

// ========================= MUTATIONS CHECKED =========================
//   · putting back `(ctx.LOGICAL_W * 0.55)` as the denominator → TWO fail: the metres-pitch case with **0.0568** — the
//     exact number the audit measured — and the one-step-is-one-cell grid case. It is #121 reproduced, and the
//     `[Cross-check]` beside it confirms the issue's number was right.
//   · changing `PAN_PACES` from 11 to 12 → FOUR fail, including the platformer-hears-EXACTLY-what-it-heard case. It is
//     what keeps the fix from touching, in passing, what already worked for a child.
//   · making `worldStep` return 1 for `hotspots` → TWO fail: the `hotspots`-has-no-side case and the [Interface]. A pan
//     computed over list indices points to a side that does not exist.
//   · removing the `Math.max(-1, Math.min(1, ...))` → the [Boundary] pan-stays-clamped case fails in all three.
//
// PROBED AGAIN (2026-09-23), nineteen decisions of `updateGuide` disabled one at a time — `scratchpad/sonda-guia.py`. Nine were
// green: the game's sound off, no categories, no `guide` category (the last two THREW on `cat.guide`), a device that refuses the
// graph (it threw on `++g.desdeARota`), the route's CADENCE both ways, and the pan — following the target and gliding to it.
// Held now by «%s: no graph is built…», «a device that refuses…» and «the route is measured every FRAMES_BETWEEN_ROUTES…».
// One is declared rather than caught: without the ENGINE's audio context the guide stays off even for a player with an output
// device of their own. It is reachable only by that player, and whether they should hear the guide before the engine's audio
// starts is not a decision anyone has written — pinning today's answer would make it one by accident.
