// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/keyboard — the KEY MAP and its owner (node project: no DOM, no PIXI). The live map sits beside
// `loadKB`/`saveKB`/`resetKB`, the functions that manage it (#50).
//
// Two properties matter more than the others, and both fail silently if they break:
//   · the module does NOT read storage on import — or any test importing it inherits the environment's keyboard;
//   · `resetKB` returns a COPY — or remapping writes into the defaults and the reset stops resetting.
import { describe, it, expect, beforeEach } from 'vitest';
import { kb, initKB, setKB, resetKB, saveKB, loadKB, KB_DEFAULTS } from '../app/js/input/keyboard.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

// Each case builds the store it reads (ADR-0232): the module reaches no storage of its own, so nothing is inherited.
const aStore = () => createStorage(memoryBackend());

describe('input/keyboard — o mapa vivo, com dono (#50)', () => {
  it('[Zero] no import ele JÁ é utilizável e NÃO leu disco: nasce dos padrões', () => {
    expect(kb.solo).toBeTruthy();
    expect(kb).toEqual(KB_DEFAULTS);
  });

  it('[Boundary] e nasce como CÓPIA, não como os próprios defaults', () => {
    // Were it the reference, remapping a key would write into KB_DEFAULTS and "restore defaults" would restore what the
    // child just changed — a reset that does not reset, with no visible symptom.
    expect(kb).not.toBe(KB_DEFAULTS);
  });

  it('[Right] initKB(store) lê o persistido e o objeto que ele devolve é o que passa a valer', () => {
    const lido = initKB(aStore());
    expect(kb).toBe(lido);
    expect(kb.solo).toBeTruthy();
  });

  it('[Right] setKB troca o mapa INTEIRO — é o que o "restaurar padrões" do painel precisa', () => {
    const antes = kb;
    const novo = resetKB(aStore());
    setKB(novo);
    expect(kb).toBe(novo);
    expect(kb).not.toBe(antes);
    setKB(antes);
  });
});

describe('input/keyboard — resetKB', () => {
  it('[Right] devolve os padrões, e uma cópia nova a cada chamada', () => {
    const store = aStore();
    const a = resetKB(store), b = resetKB(store);
    expect(a).toEqual(KB_DEFAULTS);
    expect(a).not.toBe(b); // two calls, two objects: one cannot contaminate the other
  });
});

describe('input/keyboard — loadKB sem armazenamento', () => {
  // A store with NO backend is the REAL scenario of `file://` and private mode, where the game must still open playable.
  it('[Zero] sem nada salvo (ou sem poder salvar), devolve os padrões íntegros', () => {
    expect(loadKB(createStorage(null))).toEqual(KB_DEFAULTS);
  });

  it('[Zero/Error] gravar sem armazenamento não lança — o boot não pode morrer por isso', () => {
    const none = createStorage(null);
    expect(() => saveKB(none, KB_DEFAULTS)).not.toThrow();
    expect(loadKB(none)).toEqual(KB_DEFAULTS);
  });

  // With storage, the next describe measures the overlay itself; what the child saved winning over the GAME's default
  // is held in the-game-declares-its-keyboard.node.test.js.
});

describe('input/keyboard — loadKB lays what was saved OVER the defaults', () => {
  // The SAME key `input/keyboard` uses, written by hand: if it changes there, these cases stop reading the saved data and
  // go red instead of comparing the defaults with themselves.
  const CKEY = 'inclusionist.kbcontrols.v3';
  // ⚠️ A store WITH a backend: over none, `setJSON` would write nothing and every case below would pass by reading the defaults.
  let store;
  beforeEach(() => { store = aStore(); });

  it('[Right] the overlay is PARTIAL: remapping one action keeps every other key of the defaults', () => {
    store.setJSON(CKEY, { solo: { action1: ['KeyZ'] } });
    const d = loadKB(store);
    expect(d.solo.action1, 'the saved key did not arrive').toEqual(['KeyZ']);
    expect({ ...d.solo, action1: KB_DEFAULTS.solo.action1 }, 'the overlay replaced the scheme: the arrows went with it')
      .toEqual(KB_DEFAULTS.solo);
  });

  it('[Right] the saved scheme of a seat lands on THAT seat, and a null seat keeps its defaults', () => {
    store.setJSON(CKEY, { p2: [null, { action1: ['KeyK'] }] });
    const d = loadKB(store);
    expect(d.p2[1].action1).toEqual(['KeyK']);
    expect(d.p2[0], 'a null entry is "nothing saved for this seat", not "empty it"').toEqual(KB_DEFAULTS.p2[0]);
  });

  it('🔴 [Cross-check] the old `p34` shape migrates into BOTH p3 and p4, seat by seat, and p3 stops at three', () => {
    const seats = [0, 1, 2, 3].map((i) => ({ action1: [`KeyF${i + 1}`] }));
    store.setJSON(CKEY, { p34: seats });
    const d = loadKB(store);
    expect(d.p4.map((s) => s.action1), 'p4 did not receive the four seats').toEqual([['KeyF1'], ['KeyF2'], ['KeyF3'], ['KeyF4']]);
    expect(d.p3.map((s) => s.action1), 'p3 did not receive its three seats').toEqual([['KeyF1'], ['KeyF2'], ['KeyF3']]);
    // ⚠️ `loadKB`'s `i < 3` guard is EQUIVALENT to its `d.p3[i]` check (p3 has three seats): dropping it changes nothing
    // this case, or any, can see. The length line holds the outcome both guards protect.
    expect(d.p3, 'p3 grew a fourth seat from p34').toHaveLength(KB_DEFAULTS.p3.length);
  });
});
