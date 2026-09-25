// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME DECLARES THE KEYBOARD'S DEFAULT MAPPING — and «restaurar padrões» goes back TO ITS (ADR-0115, issue #127).
//
// ========================= THE TRAP THIS FILE GUARDS =========================
// 🔴 There are TWO places that materialise keyboard defaults, and only one of them is obvious:
//
//   · `loadKB()` — factory + what the child stored. The place everyone thinks of.
//   · `reset()`  — the controls panel's «restaurar padrões», on the root's `createKeyboardConfig`.
//
// If only the first knew the game's default, «restaurar padrões» would erase the mapping the GAME chose and give back
// the ENGINE's. The child presses the button expecting to return to what the game gave her, and returns to something
// else — and in a game whose author chose the layout for an accessibility reason, she loses that reason with nothing
// saying so. So the resolution is ONE FUNCTION (`factoryWithGame`), used by both.
//
// 📌 The precedence asserted here is the record's: **engine factory → the GAME's default → the CHILD's remap**. What she
// stored always comes last, because it is the only one of the three she chose.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  factoryWithGame, loadKB, createKeyboardConfig, KB_DEFAULTS,
} from '../app/js/input/keyboard.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

// The SAME key `input/keyboard` uses. Written by hand here on purpose: if it changes there, this case stops exercising
// the saved data and the gate says so instead of starting to measure nothing.
const CKEY = 'inclusionist.kbcontrols.v3';

/**
 * ⚠️ A store WITH a backend, and without it half this file would measure nothing: over none, a case's `setJSON` would not
 * write, `loadKB` would not read, and the assertion «o que ela gravou vence» would compare the factory with itself. Each case
 * builds its own (ADR-0232), so none inherits another's remap.
 */
let store;
beforeEach(() => { store = createStorage(memoryBackend()); });
/** «Restaurar padrões» as the controls panel reaches it: the root's config, built with the game's mapping (ADR-0232 D4). */
const resetKB = (s, mapping) => createKeyboardConfig({ store: s, mapping }).reset();

describe('o padrão do jogo entra entre a fábrica e a criança', () => {
  it('[Zero] sem declaração, a fábrica da engine fica intacta', () => {
    expect(factoryWithGame(null).solo.action1).toEqual(KB_DEFAULTS.solo.action1);
  });

  it('[Right] o jogo troca UMA posição e o resto continua a ser da engine', () => {
    const d = factoryWithGame(() => ({ action1: ['KeyQ'] }));
    expect(d.solo.action1, 'o padrão do jogo não chegou').toEqual(['KeyQ']);
    expect(d.solo.action2, 'parcial virou substituição: o resto da fábrica desapareceu').toEqual(KB_DEFAULTS.solo.action2);
  });

  it('🎯 [Boundary] o ASSENTO chega ao jogo — o teclado de dois não é o de um', () => {
    // ⚠️ The defect this pins: a default that did not know the seat would give the same keys to two children sitting at
    // the same keyboard, and neither of them could play.
    const vistos = [];
    const d = factoryWithGame((jogadores, assento) => {
      vistos.push([jogadores, assento]);
      return { action1: [`J${jogadores}A${assento}`] };
    });
    expect(vistos, 'a fábrica não perguntou por cada arranjo e assento').toEqual([
      [1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [3, 2], [4, 0], [4, 1], [4, 2], [4, 3],
    ]);
    expect(d.p2[1].action1).toEqual(['J2A1']);
    expect(d.p4[3].action1).toEqual(['J4A3']);
  });

  it('📌 devolver `null` para um arranjo deixa esse arranjo com a fábrica', () => {
    const d = factoryWithGame((jogadores) => (jogadores === 1 ? { action1: ['KeyQ'] } : null));
    expect(d.solo.action1).toEqual(['KeyQ']);
    expect(d.p2[0].action1).toEqual(KB_DEFAULTS.p2[0].action1);
  });
});

describe('a precedência, e o botão que a punha em causa', () => {
  it('[Right] o remapeamento da CRIANÇA vence o padrão do jogo', () => {
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });
    expect(loadKB(store, () => ({ action1: ['KeyQ'] })).solo.action1, 'o que ela gravou tem de vir por último').toEqual(['KeyZ']);
  });

  it('[Right] e o `load()` do config da raiz põe a mesma precedência no mapa VIVO — o jogo por baixo, ela por cima', () => {
    // 📌 The root's live map comes from here (ADR-0232 D4): a config that loaded without its mapping would boot every game
    // on the ENGINE's keys wherever the child had not remapped, and only «restaurar» would bring the game's back.
    store.setJSON(CKEY, { solo: { action2: ['KeyZ'] } });
    const config = createKeyboardConfig({ store, mapping: () => ({ action1: ['KeyQ'] }) });
    config.load();
    expect(config.kb().solo.action1, 'the live map booted without the game\'s default').toEqual(['KeyQ']);
    expect(config.kb().solo.action2, 'and without what the child stored').toEqual(['KeyZ']);
  });

  it('🔴 «restaurar padrões» volta ao padrão do JOGO, não ao da ENGINE', () => {
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });

    const d = resetKB(store, () => ({ action1: ['KeyQ'] }));

    expect(d.solo.action1, 'o reset devolveu a fábrica da engine e apagou a escolha do jogo').toEqual(['KeyQ']);
    expect(store.get(CKEY, null), 'o reset tem de apagar o que ela guardou — é isso que ele é').toBeNull();
  });

  it('[Zero] e sem jogo declarado o reset continua a devolver a fábrica da engine', () => {
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });
    expect(resetKB(store, null).solo.action1).toEqual(KB_DEFAULTS.solo.action1);
  });

  it('⚠️ [Interface] a fábrica devolve CÓPIAS: mexer no resultado não contamina o `KB_DEFAULTS`', () => {
    const d = factoryWithGame(null);
    d.solo.action1 = ['KeyX'];
    expect(factoryWithGame(null).solo.action1, 'a fábrica foi mutada por quem a leu').toEqual(KB_DEFAULTS.solo.action1);
  });
});

describe('o contrato recusa uma declaração que seria ignorada em silêncio', () => {
  it('⚠️ um VALOR em vez de função é acusado — senão o mapeamento é descartado e ninguém sabe', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const d = { ...declaracaoMinima(), keyboardMapping: { action1: ['KeyQ'] } };
    expect(conformanceProblems(d).join(' | ')).toContain('keyboardMapping');
  });

  it('⚠️ e um retorno que não é objecto nem `null` também — a fusão engoli-lo-ia sem escrever nada', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const d = { ...declaracaoMinima(), keyboardMapping: () => 'KeyQ' };
    expect(conformanceProblems(d).join(' | ')).toContain('keyboardMapping');
  });

  it('[Zero] uma declaração correcta — e uma ausente — não acusam nada', async () => {
    const { conformanceProblems } = await import('../app/js/core/contract.js');
    const bom = { ...declaracaoMinima(), keyboardMapping: () => ({ action1: ['KeyQ'] }) };
    const nulo = { ...declaracaoMinima(), keyboardMapping: () => null };
    expect(conformanceProblems(bom).filter((x) => x.includes('keyboardMapping'))).toEqual([]);
    expect(conformanceProblems(nulo).filter((x) => x.includes('keyboardMapping'))).toEqual([]);
    expect(conformanceProblems(declaracaoMinima()).filter((x) => x.includes('keyboardMapping'))).toEqual([]);
  });
});

/** The minimum the contract accepts — copied from the other gates, not invented. */
function declaracaoMinima() {
  return {
    topology: () => ({ kind: 'hotspots', order: ['q1'] }),
    holdsAtOnce: () => 1,
    holdsKeys: () => false,
    tick: 'player',
    world: () => ({ kind: 'none' }),
    roleAt: () => 'goal',
    nameAt: () => ({ text: 'x', gender: 'm', plural: false }),
    focusOf: () => null,
    objectiveOf: () => ({ name: { text: 'x', gender: 'm', plural: false }, have: 0, need: 1 }),
    targetsOf: () => [],
  };
}

// ================================ MUTATIONS CHECKED ================================
// 1. `reset` going back to `JSON.parse(JSON.stringify(KB_DEFAULTS))` → 🔴 the «restaurar padrões» case fails. It is the
//    whole trap, and the only mutation on this list that describes a defect a child meets with one click.
// 2. `factoryWithGame` calling the game only for `solo` → the SEAT case fails, in the list of questions.
// 3. `Object.assign(alvo, parcial)` → `alvo = parcial` (replace instead of merge) → the partial case fails: the rest of
//    the factory would vanish and the game would have to declare all fourteen positions.
// 4. the game's default applied AFTER the saved data, in `loadKB` → the precedence case fails: the child's remap would
//    be erased by the game at every boot.
