// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/keyboard — the KEY MAP and its owner (node project: no DOM, no PIXI). The live map sits beside
// `loadKB`/`saveKB`/`resetKB`, the functions that manage it (#50).
//
// Two properties matter more than the others, and both fail silently if they break:
//   · the module does NOT read storage on import — or any test importing it inherits the environment's keyboard;
//   · `resetKB` returns a COPY — or remapping writes into the defaults and the reset stops resetting.
import { describe, it, expect } from 'vitest';
import { kb, initKB, setKB, resetKB, saveKB, loadKB, KB_DEFAULTS } from '../app/js/input/keyboard.js';

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

  it('[Right] initKB() lê o persistido e o objeto que ele devolve é o que passa a valer', () => {
    const lido = initKB();
    expect(kb).toBe(lido);
    expect(kb.solo).toBeTruthy();
  });

  it('[Right] setKB troca o mapa INTEIRO — é o que o "restaurar padrões" do painel precisa', () => {
    const antes = kb;
    const novo = resetKB();
    setKB(novo);
    expect(kb).toBe(novo);
    expect(kb).not.toBe(antes);
    setKB(antes);
  });
});

describe('input/keyboard — resetKB', () => {
  it('[Right] devolve os padrões, e uma cópia nova a cada chamada', () => {
    const a = resetKB(), b = resetKB();
    expect(a).toEqual(KB_DEFAULTS);
    expect(a).not.toBe(b); // two calls, two objects: one cannot contaminate the other
  });
});

describe('input/keyboard — loadKB sem armazenamento', () => {
  // This test project is `node`: there is no `localStorage`, so `store` is inert. That is not a limit of the test — it is
  // the REAL scenario of `file://` and private mode, where the game must still open playable.
  it('[Zero] sem nada salvo (ou sem poder salvar), devolve os padrões íntegros', () => {
    expect(loadKB()).toEqual(KB_DEFAULTS);
  });

  it('[Zero/Error] gravar sem armazenamento não lança — o boot não pode morrer por isso', () => {
    expect(() => saveKB(KB_DEFAULTS)).not.toThrow();
    expect(loadKB()).toEqual(KB_DEFAULTS);
  });

  // The PARTIAL overlay of saved data on the defaults (whoever remapped only the jump keeps the arrows) and the shape
  // migration of the old `p34` format need real storage and are not measured here. What the child saved winning over
  // the factory is held in the-game-declares-its-keyboard.node.test.js.
});
