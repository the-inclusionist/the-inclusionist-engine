// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FOUR RULES OF ADR-0109 §1, tested as what they are: an AUTOMATON.
//
// ⚠️ SEQUENCES AND NOT LOOSE CALLS. These rules are about what happens AFTER something else happened — «apertar uma tecla
// DEVOLVE o teclado» only means something if you had left it before. A case calling a function once measures the
// function; what makes the child stumble is the order.
//
// ⚠️ AND THE CASE THAT MATTERS MOST IS THE CAMERA'S. §4 says it turns the latch on for everyone and there is no way to
// turn it off — and the way that fails is not an error: it is a child who plays by webcam, touches the screen once, and is
// left without the latch she depends on. Silent, and mid-game.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INPUT_STATE, latchNow, afterEdge, enableAssisted, disableAssisted,
  NEED_ENABLING, LATCH_OF_THEIR_OWN,
} from '../app/js/input/transport-in-use.js';

/** Runs a sequence of edges from the default, and returns the final state. */
const correr = (...origens) => origens.reduce(afterEdge, DEFAULT_INPUT_STATE);

describe('ADR-0109 §1 · a alternância segue o aparelho em uso', () => {
  it('[Right] REGRA 1 — por padrão, teclado e controle, ambos SEM alternância', () => {
    expect(latchNow(DEFAULT_INPUT_STATE)).toBe(false);
    expect(latchNow(correr('gamepad'))).toBe(false);
    expect(latchNow(correr('teclado'))).toBe(false);
  });

  it('⚠️ [Right] REGRA 2 — tocar na tela liga os controles de tela COM alternância', () => {
    expect(latchNow(correr('toque'))).toBe(true);
  });

  it('⚠️ [Right] REGRA 3 — apertar tecla DEVOLVE o teclado sem alternância; o controle também', () => {
    // The rule only exists as a sequence: leave the keyboard, and come back. A loose call does not express it.
    expect(latchNow(correr('toque', 'teclado'))).toBe(false);
    expect(latchNow(correr('toque', 'gamepad'))).toBe(false);
    // And there and back several times — it is caps-lock with memory: each device remembers its own.
    expect(latchNow(correr('toque', 'teclado', 'toque'))).toBe(true);
    expect(latchNow(correr('toque', 'teclado', 'toque', 'gamepad'))).toBe(false);
  });

  it('⚠️ [Zero] REGRA 4 — com a assistida ligada, NENHUM aparelho desliga a alternância', () => {
    // The case whose failure locks a child out of her own game. She plays by webcam, touches the screen once, and without
    // this rule is left without the latch she depends on — mid-game and with nothing saying so.
    const ligada = enableAssisted(DEFAULT_INPUT_STATE);
    for (const t of ['teclado', 'gamepad', 'toque', 'olhos', 'rosto', 'gestos', 'fala']) {
      expect(latchNow(afterEdge(ligada, t)), `${t} desligou a alternância da assistida`).toBe(true);
    }
    // And along a whole sequence, not just one edge.
    const depois = ['teclado', 'toque', 'gamepad', 'teclado'].reduce(afterEdge, ligada);
    expect(latchNow(depois)).toBe(true);
  });

  it('⚠️ [Zero] uma ARESTA de transporte assistido NÃO o habilita — habilitar é acto explícito', () => {
    // A webcam false positive (a shadow, a second face passing by) would lock everyone's latch without anyone asking. §4
    // says «precisam ser habilitados», and this is that word.
    for (const t of NEED_ENABLING) {
      expect(afterEdge(DEFAULT_INPUT_STATE, t).assistedOn, `${t} habilitou-se sozinho`).toBe(false);
      expect(latchNow(afterEdge(DEFAULT_INPUT_STATE, t)), `${t} ligou a alternância sem habilitação`).toBe(false);
    }
  });

  it('[Right] habilitar é idempotente, e desabilitar existe — mas não é oferecido à criança', () => {
    const ligada = enableAssisted(DEFAULT_INPUT_STATE);
    expect(enableAssisted(ligada)).toBe(ligada); // the SAME object: no change, no copy
    expect(latchNow(disableAssisted(ligada))).toBe(false);
    expect(disableAssisted(DEFAULT_INPUT_STATE)).toBe(DEFAULT_INPUT_STATE);
  });

  it('[Boundary] uma aresta do transporte que já está em uso não cria estado novo', () => {
    const s = correr('toque');
    expect(afterEdge(s, 'toque')).toBe(s); // identity, not equality
  });

  it('⚠️ [Interface] as duas listas não se sobrepõem — um transporte não pode ter duas regras', () => {
    // If `toque` went into `NEED_ENABLING`, it would stop turning the latch on until enabled, and rule 2 would die in
    // silence. The lists say different things and have to stay disjoint.
    for (const t of LATCH_OF_THEIR_OWN) {
      expect(NEED_ENABLING.has(t), `${t} está nas duas listas`).toBe(false);
    }
    expect([...LATCH_OF_THEIR_OWN]).toEqual(['toque']);
    expect([...NEED_ENABLING].sort()).toEqual(['fala', 'gestos', 'olhos', 'rosto']);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ SWAPPING the two lines of `latchNow` (the `emUso` before the assisted one) -> fails RULE 4. It is the mutation
//     that matters most in the whole file: it is the defect that locks a child out of the game, and it gives no error —
//     she touches the screen, goes back to the keyboard, and the latch she depends on is gone.
//   · `latchNow` returning only `LATCH_OF_THEIR_OWN.has(...)` (without the assisted one) -> fails RULE 4 too, from the
//     other side.
//   · `afterEdge` enabling the assisted mode when the source is in `NEED_ENABLING` -> fails "uma ARESTA nao habilita".
//     It is the naive reading of rule 4, and the one a webcam false positive exploits.
//   · `afterEdge` ignoring the source (always returning the state) -> RULES 2 and 3 fail.
//   · `DEFAULT_INPUT_STATE` with `inUse: 'toque'` -> fails RULE 1: the default would have the latch, which is exactly the
//     opposite of what the ADR says.
//   · putting `'toque'` in `NEED_ENABLING` -> RULE 2 and the disjoint-lists case fail.
