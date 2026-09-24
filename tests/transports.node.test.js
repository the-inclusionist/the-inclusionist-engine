// SPDX-License-Identifier: AGPL-3.0-or-later
// The gate of the TRANSPORT REGISTRY (ADR-0079), the last piece of issue #103.
//
// ⚠️ THE CASE THIS FILE EXISTS TO CATCH IS NOT HYPOTHETICAL: the on-screen control has fewer slots than the fourteen
// actions of the vocabulary. A game using more positions than touch carries is a real combination, and the honest answer
// is a sentence BEFORE starting — not half a playable screen. The child who finds out midway that she cannot reach an
// action concludes the game is broken, and has no way of knowing it is not.
import { describe, it, expect } from 'vitest';
import { carries, carriedBy, reachable, reach } from '../app/js/input/transports.js';
import { SLOTS, defaultTransports } from '../app/js/input/transports.js';
import { ACTIONS } from '../app/js/core/actions.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';

const t = (id, slots, available = true) => ({ id, slots, available: () => available });

// Transports with fixed numbers, for the arithmetic cases.
const GAMEPAD = t('gamepad', 17);   // a Gamepad API "standard" declara 17 botões
const TECLADO = t('keyboard', 40);  // the per-player scheme is not the limit; the keyboard is wide
const TOQUE = t('touch', 9);        // the on-screen control's classic nine slots (the real `TOUCH_DEFAULT` has 13 since ADR-0160)
const ACIONADOR = t('switch', 2);   // a two-press switch — ADR-0079's narrow transport

const NOVE = ['up', 'down', 'left', 'right', 'action1', 'action2', 'action3', 'action4', 'start'];
const DOZE = [...NOVE, 'leftShoulder', 'leftTrigger', 'rightShoulder'];

// ========================= THE POINTER AS A DECLARED CAPABILITY (ADR-0112) =========================
// ⚠️ THE HALF THAT MATTERS, in the record's words: the declaration is what lets a device REFUSE BEFORE the child starts.
// Without it, the child picks «Desenho livre» on a Chromebook with no mouse and finds out midway.
//
// 📌 AND IT COMES IN THROUGH THE MACHINE THAT ALREADY EXISTS — ADR-0079's reach by SET — instead of through a mechanism of
// its own. Two mechanisms for the same question would be two answers, and they drift.
//
// 📌 `aponta` IS A FUNCTION and not a boolean, for the SAME reason written on the `available` field beside it: a mouse is
// plugged in mid-game, just like a controller.
const tp = (id, slots, available = true, aponta = undefined) => ({
  id, slots, available: () => available, ...(aponta === undefined ? {} : { points: () => aponta }),
});

describe('ADR-0112 · um jogo que pede PONTEIRO é recusado por quem não tem', () => {
  const TRES = ['up', 'down', 'action1'];

  it('[Right] o TOQUE aponta por natureza — a superfície é o ponteiro', () => {
    const r = reach([tp('toque', 9, true, true)], TRES, 1, true);
    expect(r.ok).toBe(true);
    expect(r.needsPointer).toBe(true);
    expect(r.cannotPoint).toEqual([]);
  });

  it('🔴 [Zero] TECLADO SEM RATO não serve um jogo que pede ponteiro, e diz qual é o problema', () => {
    // 🔴 The case this file exists to pin. The keyboard carries the three actions and holds them all — by the old
    // arithmetic, `ok` said YES. But «Desenho livre» is not played with keys, and the child would only find that out after
    // choosing.
    const r = reach([tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok, 'o alcance disse sim a um jogo que esta criança não consegue jogar').toBe(false);
    expect(r.cannotPoint, 'a frase precisa de saber QUEM chegou perto e falhou só nisto').toEqual(['teclado']);
    // ⚠️ and it does NOT appear on the other lists: it is neither short of slots nor failing to hold. A transport on two
    // lists would make the card state two problems where there is one — the same rule `naoSeguram` already follows.
    expect(r.short).toEqual([]);
    expect(r.cannotHold).toEqual([]);
  });

  it('⚠️ [Right] o MESMO teclado COM RATO serve — «no caso do teclado, o sinal contínuo é o rato»', () => {
    // The Dev's clause, as a case. It is what gives a foundation to ADR-0074's transports 8 and 9, which that record
    // declared as «sem fundação nenhuma».
    const r = reach([tp('teclado', 40, true, true)], TRES, 1, true);
    expect(r.ok).toBe(true);
    expect(r.cannotPoint).toEqual([]);
  });

  it('⚠️ [Zero] um jogo que NÃO pede ponteiro não é afectado por nada disto', () => {
    // The additivity guarantee: games that do not draw must not feel this change.
    const r = reach([tp('teclado', 40, true, false)], TRES, 1);
    expect(r.ok).toBe(true);
    expect(r.needsPointer).toBe(false);
    expect(r.cannotPoint).toEqual([]);
  });

  it('[Boundary] «ligue um controle» não é oferecido quando o controle também não aponta', () => {
    // `serviriamSeLigados` is ACTIONABLE information; offering a way out that does not solve anything is worse than not
    // offering one.
    const r = reach([tp('gamepad', 17, false, false), tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.wouldServeIfOn, 'mandou ligar um controle que também não desenha').toEqual([]);
  });

  it('[Right] mas É oferecido quando o que está desligado aponta', () => {
    const r = reach([tp('toque', 9, false, true), tp('teclado', 40, true, false)], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.wouldServeIfOn).toEqual(['toque']);
  });

  it('⚠️ [Zero] quem OMITE o campo não aponta — ausência é «não oferece», e é a forma do gamepad', () => {
    // ⚠️ A CASE FOUND BY A SURVIVING MUTATION, and the hole was real: every other case DECLARES `aponta`, so reading the
    // absence as «sim» went unnoticed. It is precisely the gamepad's shape in `defaultTransports`, which does not declare
    // the field — and ADR-0112 says that here absence means «não oferece», unlike `holds`, where it means «não há tecto
    // conhecido».
    const semCampo = { id: 'gamepad', slots: 17, available: () => true };
    const r = reach([semCampo], TRES, 1, true);
    expect(r.ok).toBe(false);
    expect(r.cannotPoint).toEqual(['gamepad']);
  });

  it('⚠️ [Boundary] quem falha por LUGARES não entra também na lista de quem não aponta', () => {
    // A transport on two lists would make the card state two problems where there is one. Without this case, the guard
    // preventing it could fall with nothing failing — which is what the mutation showed.
    const estreito = tp('acionador', 2, true, false); // two slots for three actions, and no pointer
    const r = reach([estreito], TRES, 1, true);
    expect(r.short).toEqual([{ id: 'acionador', slots: 2 }]);
    expect(r.cannotPoint, 'o mesmo transporte acusado duas vezes').toEqual([]);
  });
});

describe('ADR-0112 · a cláusula do Dev, na FÁBRICA e não num fixture', () => {
  // ⚠️ THIS BLOCK EXISTS BECAUSE TWO MUTATIONS SURVIVED: the cases above build transports by hand, so deleting the
  // keyboard's `points: d.mouse` from `defaultTransports` failed nothing. «No caso do teclado, o sinal contínuo passa a ser o
  // mouse» has to be asserted on the list the game receives.
  const disp = (over) => ({
    gamepad: () => false, touch: () => false, keyboard: () => true, mouse: () => false, ...over,
  });
  const acha = (lista, id) => lista.find((x) => x.id === id);

  it('⚠️ [Right] o TECLADO aponta quando há rato, e não aponta quando não há', () => {
    expect(acha(defaultTransports(disp({ mouse: () => true })), 'teclado').points()).toBe(true);
    expect(acha(defaultTransports(disp({ mouse: () => false })), 'teclado').points()).toBe(false);
  });

  it('⚠️ [Right] o TOQUE aponta por natureza — a mesma sonda que o torna disponível', () => {
    const lista = defaultTransports(disp({ touch: () => true }));
    expect(acha(lista, 'toque').points()).toBe(true);
    expect(acha(lista, 'toque').available()).toBe(true);
  });

  it('⚠️ [Zero] o GAMEPAD não declara ponteiro, e a ausência é medida e não esquecimento', () => {
    // The stick has the continuous signal and the engine throws it away at the source (`PAD_DEAD = 0.5`). Wiring it is
    // possible and brings back the question ADR-0112 already named — half the travel dead suits a BUTTON and not a CURSOR.
    // Until it is wired, declaring that it points would be lying to the card of #112.
    expect(acha(defaultTransports(disp({ gamepad: () => true })), 'gamepad').points).toBeUndefined();
  });

  // ===================== MUTATIONS CHECKED (the pointer, ADR-0112) =====================
  // Five, by script and with occurrence counts. ⚠️ FOUR SURVIVED THE FIRST ROUND, and all four were COVERAGE HOLES and not
  // equivalences — it was the harness finding what reading does not:
  //
  //   1. the pointer out of `serve` (`ok` lies again) -> FOUR fail. It was the only one already dying.
  //   2. the absence of `aponta` read as YES -> survived because ALL fixtures declared the field. There was never one that
  //      OMITTED it, which is exactly the gamepad's shape. A new case; now it fails.
  //   3. and 4. deleting `aponta` from `defaultTransports` -> survived because the cases built transports by hand and
  //      never exercised the FACTORY. ⚠️ And that line IS the commit: «no caso do teclado, o sinal continuo passa a ser o
  //      mouse». A new block asserts it on the list the game really receives.
  //   5. `naoApontam` without excluding whoever already failed by slots -> survived because there was no case of a
  //      transport failing for TWO reasons. The rule «um problema, uma lista» was not measured; now it is.
});

describe('um transporte carrega um conjunto quando tem lugares para ele', () => {
  it('aritmética, e nada mais', () => {
    expect(carries(TOQUE, NOVE)).toBe(true);
    expect(carries(TOQUE, DOZE)).toBe(false);
    expect(carries(GAMEPAD, DOZE)).toBe(true);
  });

  it('⚠️ o caso REAL: nove slots de toque contra doze ações', () => {
    // The fixture's classic nine touch slots against twelve actions.
    expect(carries(TOQUE, DOZE)).toBe(false);
    expect(carriedBy([TOQUE], DOZE)).toEqual([]);
  });

  it('o acionador de dois toques carrega um jogo de um botão, e é para isso que ele existe', () => {
    // ADR-0079 §3 says the guarantee changed shape precisely so a narrow transport can exist without failing the product:
    // it carries the games that fit in it.
    expect(carries(ACIONADOR, ['action1'])).toBe(true);
    expect(carries(ACIONADOR, ['action1', 'action2'])).toBe(true);
    expect(carries(ACIONADOR, NOVE)).toBe(false);
  });
});

describe('a garantia é sobre o CONJUNTO, não sobre cada transporte', () => {
  it('basta UM disponível que carregue', () => {
    // Touch does not carry twelve, and the guarantee is still satisfied because the controller does.
    expect(reachable([TOQUE, GAMEPAD], DOZE)).toBe(true);
  });

  it('⚠️ um transporte que CABERIA mas está desligado NÃO satisfaz a garantia', () => {
    // The order — availability before capacity — is a decision: a controller kept in the drawer is no answer for a child
    // who is in front of the device now.
    expect(reachable([TOQUE, t('gamepad', 17, false)], DOZE)).toBe(false);
  });

  it('nenhum disponível que caiba → a garantia falha, que é o ponto', () => {
    expect(reachable([TOQUE, ACIONADOR], DOZE)).toBe(false);
  });

  it('⚠️ conjunto de ações VAZIO devolve false, e não true por vacuidade', () => {
    // «Todo transporte serve» would be technically true and practically a lie: a game with no action at all is not a game
    // any transport serves, it is one nobody can play. Returning `true` here would hide that defect behind this function.
    expect(reachable([GAMEPAD, TECLADO], [])).toBe(false);
  });
});

describe('o que a tela de seleção precisa saber ANTES de a criança começar', () => {
  it('quando serve, diz que serve', () => {
    const a = reach([TOQUE, GAMEPAD], NOVE);
    expect(a.ok).toBe(true);
    expect(a.asked).toBe(9);
  });

  it('⚠️ quando NÃO serve, diz o número e diz o que ligar', () => {
    // The information has to be ACTIONABLE: «faltam lugares» helps nobody; «o toque tem 9 e este jogo pede 12; um controle
    // resolveria» says what to do.
    const a = reach([TOQUE, t('gamepad', 17, false)], DOZE);
    expect(a.ok).toBe(false);
    expect(a.asked).toBe(12);
    expect(a.short).toEqual([{ id: 'touch', slots: 9 }]);
    expect(a.wouldServeIfOn).toEqual(['gamepad']);
  });

  it('devolve DADO e não texto', () => {
    // The sentence belongs to the interface and has to go through `t()`. Returning Portuguese from here would repeat the
    // defect `PADWIZ_STEPS` no longer commits.
    const a = reach([TOQUE], DOZE);
    for (const v of Object.values(a)) expect(typeof v).not.toBe('string');
  });

  it('um transporte disponível que CABE não aparece como curto', () => {
    const a = reach([TOQUE, GAMEPAD], DOZE);
    expect(a.short.map((c) => c.id)).toEqual(['touch']);
    expect(a.ok).toBe(true);
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A LISTA REAL de transportes — os números saem do aparelho, não de um teste (issue #112)', () => {
  // ⚠️ These cases check PROPERTIES and not the literals. `expect(SLOTS.teclado).toBe(ACTIONS.length)` would be tautological
  // — the code IS `ACTIONS.length` —, and a case that moves together with the implementation never fails. What matters is
  // what each number DOES when the arithmetic uses it.
  const sempre = () => true, nunca = () => false;
  const todos = (v) => defaultTransports({ gamepad: v, keyboard: v, touch: v, mouse: v });
  const acha = (lista, id) => lista.find((x) => x.id === id);

  it('[Right] ⚠️ o TOQUE não carrega as catorze — é a combinação que a issue #112 existe para avisar', () => {
    // Thirteen slots against a vocabulary of fourteen. A child on a public-school tablet has no alternative path: touch is
    // the only one.
    expect(carries(acha(todos(sempre), 'toque'), ACTIONS)).toBe(false);
  });

  it('[Right] e o TECLADO carrega — é isso que «o teclado é largo» quer dizer em aritmética', () => {
    // The property, not the number: a transport covering every position the engine can name has no way to be the short
    // one. If the vocabulary grows and this case fails, the keyboard stopped being wide.
    expect(carries(acha(todos(sempre), 'teclado'), ACTIONS)).toBe(true);
  });

  it('[Right] o GAMEPAD carrega, e sobra — dezassete botões da Gamepad API «standard»', () => {
    expect(carries(acha(todos(sempre), 'gamepad'), ACTIONS)).toBe(true);
    expect(SLOTS.gamepad).toBeGreaterThan(ACTIONS.length);
  });

  it('[Interface] ⚠️ o número do toque vem da TABELA de toque, e não de um literal repetido aqui', () => {
    // If someone adds a slot to `TOUCH_DEFAULT` and forgets `SLOTS`, this case fails. Without it, the two numbers would
    // drift apart in silence and the guarantee would start lying in the product's favour.
    expect(SLOTS.toque).toBe(Object.keys(TOUCH_DEFAULT).length);
  });

  it('[Zero] ⚠️ num tablet SEM controle ligado, o conjunto de catorze NÃO é alcançável', () => {
    // The issue's case, whole: only touch available, and it is short. This `false` is what makes the screen appear.
    const tablet = defaultTransports({ gamepad: nunca, keyboard: nunca, touch: sempre, mouse: nunca });
    expect(reachable(tablet, ACTIONS)).toBe(false);

    const a = reach(tablet, ACTIONS);
    expect(a.ok).toBe(false);
    // ⚠️ And the information has to be ACTIONABLE: «faltam lugares» helps nobody. Who is short, with how many slots, and
    // what would solve it if plugged in — that is what becomes a sentence.
    expect(a.short).toEqual([{ id: 'toque', slots: 13 }]); // nine up to ADR-0160's shoulders
    expect(a.wouldServeIfOn).toEqual(['gamepad', 'teclado']);
    expect(a.asked).toBe(ACTIONS.length);
  });

  it('[Right] e ligar um controle resolve — a mesma lista, com o gamepad disponível', () => {
    const comPad = defaultTransports({ gamepad: sempre, keyboard: nunca, touch: sempre, mouse: nunca });
    expect(reachable(comPad, ACTIONS)).toBe(true);
    expect(reach(comPad, ACTIONS).ok).toBe(true);
  });

  it('[Boundary] um jogo de NOVE ações cabe no toque, e a tela não tem por que aparecer', () => {
    // The screen warns when needed, and stays quiet when not. A warning that always appears stops being read.
    const tablet = defaultTransports({ gamepad: nunca, keyboard: nunca, touch: sempre, mouse: nunca });
    expect(reachable(tablet, NOVE)).toBe(true);
  });

  it('[Zero] ⚠️ um transporte CURTO e DESLIGADO não entra na frase — ela falaria de um aparelho ausente', () => {
    // `curtos` exists to say «o que você TEM não chega». A two-press switch that is not plugged in is not what she has,
    // and naming it would make the sentence point at an object that is not in the room — the opposite of actionable. It is
    // the line separating «o toque tem 9 lugares» from a list of everything that exists in the world.
    const acionador = { id: 'acionador', slots: 2, available: () => false };
    const lista = [...defaultTransports({ gamepad: nunca, keyboard: nunca, touch: sempre, mouse: nunca }), acionador];
    const a = reach(lista, ACTIONS);
    expect(a.short.map((c) => c.id), 'a frase citou um aparelho desligado').toEqual(['toque']);
    // And it does not enter «serviria se ligado» either, because it would not serve: two slots for fourteen actions.
    expect(a.wouldServeIfOn).not.toContain('acionador');
  });

  it('[Interface] a disponibilidade é PERGUNTADA a cada vez — um controle liga-se no meio da partida', () => {
    let ligado = false;
    const lista = defaultTransports({ gamepad: () => ligado, keyboard: nunca, touch: sempre, mouse: nunca });
    expect(reachable(lista, ACTIONS)).toBe(false);
    ligado = true;
    expect(reachable(lista, ACTIONS), 'a lista memorizou a resposta de antes').toBe(true);
  });
});
