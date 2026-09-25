// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TRANSPORT IN USE, PER PLAYER — the missing half between the automaton and the latch (ADR-0109/0113).
//
// ========================= WHAT THIS PIECE IS, AND WHERE IT LIVES =========================
// `input/transport-in-use` is the PURE automaton: it receives a state and an edge, returns the new state, and keeps
// nothing. `input/latch-store` knows how to read and write ONE TRANSPORT's latch. What was missing was something that
// knew WHICH transport is each player's — and this is it.
//
// ⚠️ IT LIVES IN `input/state` AND NOT IN `PlayerBase`, and the choice was measured against what already exists: that
// module already keeps per-player input state with exactly this shape (`padCur: Record<number, PadState>`). Putting it in
// `PlayerBase` would make it part of the CONTRACT, and every cartridge would have to declare a field it decides nothing
// about — one more break in a major.
//
// 📌 What the player CARRIES is still the resolved latch (`toggleMove`), which is what the physics reads. This is what is
// upstream of it.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach } from 'vitest';
import { createInputState } from '../app/js/input/state.js';
import { DEFAULT_INPUT_STATE } from '../app/js/input/transport-in-use.js';

const {
  inputOf, playerEdge, enableAssistedFor, disableAssistedFor, forgetInputs, releaseAllKeys,
} = createInputState();

beforeEach(() => { forgetInputs(); });

/*
 * TWO ROOTS SHARE NOTHING (ADR-0232 D4, ADR-0142). As module state, a second root on the page read the first root's held
 * keys, the first child's device and a pad's previous frame. Each structure is asserted, because each was one module-level
 * container and any one of them left shared keeps the leak.
 */
describe('input/state — two instances, two roots', () => {
  it('🔴 [Cross-check] what one root holds, the other does not', () => {
    const a = createInputState();
    const b = createInputState();
    a.markKey('KeyA', 'olhos');
    a.playerEdge(0, 'gamepad');
    a.enableAssistedFor(1);
    a.padCur[0] = { action1: true };
    a.padPrevAct[0] = { action1: true };
    a.padPrevStart[0] = true;
    expect(b.keys.has('KeyA'), 'the second root holds the first root\'s key').toBe(false);
    expect(b.sourceOf('KeyA'), 'the second root knows who pressed the first root\'s key').toBeUndefined();
    expect(b.inputOf(0), 'the second root\'s child is on the first child\'s device').toEqual(DEFAULT_INPUT_STATE);
    expect(b.inputOf(1).assistedOn, 'enabling assistance in one root enabled it in the other').toBe(false);
    expect(b.held({ ctrl: { action1: [] }, pad: 0 }, 'action1'), 'the second root reads the first root\'s pad').toBe(false);
    expect(b.padPrevAct[0], 'a pad\'s previous frame is shared').toBeUndefined();
    expect(b.padPrevStart[0], 'a pad\'s previous START is shared').toBeUndefined();
    // 📌 THE PAIR: the first root still holds all of it — otherwise a factory that kept nothing would pass above
    expect(a.held({ ctrl: { action1: ['KeyA'] }, pad: -1 }, 'action1')).toBe(true);
    expect(a.inputOf(0).inUse).toBe('gamepad');
  });
});

describe('entrada por jogador · quem nunca tocou em nada tem uma resposta', () => {
  // ⚠️ `DEFAULT_INPUT_STATE` AND NOT `undefined`, and the contrast with the same module's `sourceOf` is deliberate: there
  // «não sei» is honest because the question is about a KEY that already exists; here the question is about a PLAYER, and
  // a player who has not touched anything yet really is on the keyboard with no assisted mode.
  it('[Zero] jogador desconhecido responde o PADRÃO, e não `undefined`', () => {
    expect(inputOf(0)).toEqual(DEFAULT_INPUT_STATE);
    expect(inputOf(7)).toEqual(DEFAULT_INPUT_STATE);
  });

  it('[Interface] o padrão é teclado, sem assistida', () => {
    expect(inputOf(0).inUse).toBe('teclado');
    expect(inputOf(0).assistedOn).toBe(false);
  });
});

describe('entrada por jogador · a aresta troca o transporte, e só o daquele jogador', () => {
  it('[Right] a aresta define o transporte em uso', () => {
    playerEdge(0, 'toque');
    expect(inputOf(0).inUse).toBe('toque');
  });

  // 🎯 THE CASE THAT GIVES THE `Record` ITS MEANING — without per-player separation, the child in the second seat would
  // inherit the first one's device, and with it her latch.
  it('🎯 [Right] dois jogadores, dois aparelhos, e nenhum lê o do outro', () => {
    playerEdge(0, 'teclado');
    playerEdge(1, 'gamepad');
    expect(inputOf(0).inUse).toBe('teclado');
    expect(inputOf(1).inUse).toBe('gamepad');
    playerEdge(1, 'toque');
    expect(inputOf(0).inUse, 'a aresta do jogador 1 mexeu no jogador 0').toBe('teclado');
  });

  it('📌 [Right] sem mudança, o MESMO objecto volta — não se aloca por quadro', () => {
    playerEdge(0, 'toque');
    const antes = inputOf(0);
    playerEdge(0, 'toque');
    expect(inputOf(0), 'uma aresta repetida alocou um estado novo').toBe(antes);
  });
});

describe('entrada por jogador · habilitar a assistida é um acto explícito (ADR-0109 regra 4)', () => {
  // ⚠️ THE WHOLE RULE IN A SEQUENCE: an edge from an assisted transport does NOT enable it. A webcam false positive — a
  // shadow, a second face passing by — would lock everyone's latch.
  it('⚠️ [Zero] uma aresta de `olhos` NÃO habilita a assistida', () => {
    playerEdge(0, 'olhos');
    expect(inputOf(0).inUse).toBe('olhos');
    expect(inputOf(0).assistedOn, 'a webcam habilitou-se sozinha').toBe(false);
  });

  it('[Right] habilitada, ela sobrevive a arestas de outros aparelhos', () => {
    enableAssistedFor(0);
    playerEdge(0, 'teclado');
    expect(inputOf(0).inUse, 'a tecla devolveu o teclado, como manda a regra 3').toBe('teclado');
    expect(inputOf(0).assistedOn, 'uma tecla desligou a assistida de quem depende dela').toBe(true);
  });

  it('[Right] desabilitar é a outra metade, e é simétrica', () => {
    enableAssistedFor(0);
    disableAssistedFor(0);
    expect(inputOf(0).assistedOn).toBe(false);
  });

  // ⚠️ THIS PAIR WAS BORN FROM A SURVIVING MUTATION, and the hole was real. The case was only «habilitar o 0 não habilita
  // o 1» — and `enableAssistedFor` ALWAYS writing to player 0 passed, because 1 stayed off for the wrong reason. The other
  // end was missing: that enabling 1 REALLY enables 1.
  it('[Zero] habilitar um jogador não habilita o outro — nos DOIS sentidos', () => {
    enableAssistedFor(0);
    expect(inputOf(0).assistedOn).toBe(true);
    expect(inputOf(1).assistedOn).toBe(false);

    forgetInputs();
    enableAssistedFor(1);
    expect(inputOf(1).assistedOn, 'habilitar o jogador 1 não chegou ao jogador 1').toBe(true);
    expect(inputOf(0).assistedOn).toBe(false);
  });
});

describe('entrada por jogador · o que o `blur` NÃO faz', () => {
  // 🔴 THE CASE THAT PROTECTS A CONCRETE CHILD. `releaseAllKeys` is the window's `blur`: the keys really stopped being
  // pressed. But nobody switched device by changing tab — and resetting the transport in use there would send everyone
  // back to the keyboard. Whoever plays by gaze would lose the latch mid-game, with no error and nothing on screen saying so.
  it('🔴 [Zero] `soltarTodas` solta as teclas e NÃO esquece o aparelho em uso', () => {
    playerEdge(0, 'olhos');
    enableAssistedFor(0);
    releaseAllKeys();
    expect(inputOf(0).inUse, 'o blur devolveu a criança ao teclado').toBe('olhos');
    expect(inputOf(0).assistedOn, 'o blur desligou a assistida').toBe(true);
  });

  // 📌 THE PAIR: there is also a door that FORGETS, for the end of a match, where the question is asked again.
  it('📌 [Right] `esquecerEntradas` devolve toda a gente ao padrão', () => {
    playerEdge(0, 'gamepad');
    playerEdge(1, 'toque');
    forgetInputs();
    expect(inputOf(0)).toEqual(DEFAULT_INPUT_STATE);
    expect(inputOf(1)).toEqual(DEFAULT_INPUT_STATE);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. `inputOf` returning the raw `entradaPorJogador[jogador]`   → the unknown-player [Zero] fails (undefined)
// 2. `playerEdge` writing to one place only (no index)          → 🎯 the TWO PLAYERS case fails
// 3. `releaseAllKeys` calling `forgetInputs`                     → 🔴 the BLUR case fails, which is the defect it exists to
//    prevent: the child who plays by gaze goes back to the keyboard when switching tab
// 4. `enableAssistedFor` always marking player 0                 → 🔴 SURVIVED THE FIRST ROUND, and it was a HOLE and not
//    an equivalence. The case only asserted «habilitar o 0 não habilita o 1», and always writing to 0 passed — because 1
//    stayed off for the wrong reason. With the other end added (enabling 1 REALLY reaches 1), the same mutation fails. It
//    is the mutation finding what the reading did not.
// 5. `afterEdge` enabling the assisted mode when the source is its own → ⚠️ the webcam [Zero] fails
