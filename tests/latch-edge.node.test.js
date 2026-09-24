// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EDGE AND THE LATCH ARRIVE TOGETHER — ADR-0113's whole chain, end to end (issue #127).
//
// ========================= WHAT THIS FILE CLOSES =========================
// The other gates of this chain each assert their own piece: the RULE (`latch-scope`), the STORAGE (`latch-store`), the
// AUTOMATON (`transport-in-use`) and the RESOLUTION (`latch-sync`). All can be green while nothing wires them — pieces
// that were measured are not a wiring (on 2026-09-09 `playerEdge` and `storedLatch` had ZERO production callers).
//
// 🎯 This is the case that passes only when all four are connected: a child switches devices, and the player the
// physics reads changes with them.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLatchedEdge } from '../app/js/input/latch-edge.js';
import { inputOf, forgetInputs } from '../app/js/input/state.js';
import { latchKey, legacyLatchKey } from '../app/js/input/latch-scope.js';
import { BASE_DA_MARCHA } from '../app/js/input/latch-sync.js';

function armazemFalso(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  return {
    get: (chave) => (chave in dados ? dados[chave] : null),
    set: (chave, valor) => { escritas.push(chave); dados[chave] = valor; },
    escritas,
  };
}

const jogador = () => ({ toggleMove: false, walkDir: 0 });
const chave = (i, transporte) => latchKey(BASE_DA_MARCHA, i, transporte);

beforeEach(() => { forgetInputs(); });
afterEach(() => { forgetInputs(); });

describe('a aresta que também resolve a alternância', () => {
  it('[Right] a aresta chega ao autómato E o jogador recebe a alternância daquele aparelho', () => {
    const armazem = armazemFalso({ [chave(0, 'gamepad')]: '1' });
    const p = jogador();
    const aresta = createLatchedEdge(() => [p], { store: armazem, byDefault: false });

    aresta(0, 'gamepad');

    expect(inputOf(0).inUse, 'o autómato não soube do controle').toBe('gamepad');
    expect(p.toggleMove, 'a alternância guardada para o controle não chegou ao jogador').toBe(true);
  });

  it('🎯 [Sequência] trocar de aparelho troca a resposta — e o armazenamento não é tocado', () => {
    const armazem = armazemFalso({ [chave(0, 'gamepad')]: '1', [chave(0, 'teclado')]: '0' });
    const p = jogador();
    const aresta = createLatchedEdge(() => [p], { store: armazem, byDefault: false });

    aresta(0, 'gamepad');
    expect(p.toggleMove).toBe(true);
    p.walkDir = -1;                       // she was walking by latch

    aresta(0, 'teclado');
    expect(p.toggleMove, 'o teclado herdou a alternância do controle').toBe(false);
    expect(p.walkDir, '🔴 perdeu a alternância e a personagem continuou a andar sozinha').toBe(0);

    expect(armazem.escritas, 'trocar de aparelho GRAVOU — apagaria a escolha do outro controle').toEqual([]);
  });

  it('🔴 uma aresta de OLHOS traz a alternância ligada mesmo com `0` guardado — cláusula 3, pela cadeia toda', () => {
    const armazem = armazemFalso({
      [chave(0, 'olhos')]: '0', [legacyLatchKey(BASE_DA_MARCHA, 0)]: '0',
    });
    const p = jogador();
    createLatchedEdge(() => [p], { store: armazem, byDefault: false })(0, 'olhos');
    expect(p.toggleMove, 'quem joga por olhar ficou sem a alternância de que a entrada dela depende').toBe(true);
  });

  it('[Muitos] cada assento resolve o seu — a aresta do J2 não mexe no J1', () => {
    const armazem = armazemFalso({ [chave(1, 'toque')]: '1' });
    const p0 = jogador(); const p1 = jogador();
    const aresta = createLatchedEdge(() => [p0, p1], { store: armazem, byDefault: false });

    aresta(1, 'toque');

    expect([p0.toggleMove, p1.toggleMove], 'a alternância foi para o assento errado').toEqual([false, true]);
    expect(inputOf(0).inUse, 'a aresta do J2 mexeu no transporte do J1').toBe('teclado');
    expect(inputOf(1).inUse).toBe('toque');
  });

  it('[Zero] assento sem jogador: a aresta fica registada à mesma, e nada rebenta', () => {
    const armazem = armazemFalso();
    const aresta = createLatchedEdge(() => [], { store: armazem, byDefault: false });
    expect(() => aresta(3, 'toque')).not.toThrow();
    expect(inputOf(3).inUse, 'o transporte em uso é facto sobre a ENTRADA, não sobre quem já entrou').toBe('toque');
  });

  it('📌 [Boundary] o padrão de fábrica é o do `DEFAULTS`, não um `false` escrito à mão', async () => {
    const { DEFAULTS } = await import('../app/js/core/state.js');
    const armazem = armazemFalso();
    const p = { toggleMove: !DEFAULTS.toggleMove, walkDir: 0 };
    createLatchedEdge(() => [p], { store: armazem })(0, 'teclado');
    expect(p.toggleMove, 'sem nada guardado, a resposta tem de ser a de fábrica').toBe(DEFAULTS.toggleMove);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. removing `playerEdge(jogador, origem)` → the [Sequência] case fails: without the automaton, `emUso` stays at
//    `teclado` forever and the pad's latch is never read. It was the missing half.
// 2. removing `syncLatch(...)` → the [Right] case fails: the automaton knows, and the player does not.
// 3. always resolving player 0 (`getPlayers()[0]`) → the [Muitos] case fails. The latch is the setting of whoever
//    cannot keep a key pressed; giving it to the wrong seat gives it to someone who did not ask and takes it from
//    someone who needs it.
// 4. ⚠️ replacing `inputOf(jogador).emUso` with `origem` → SURVIVES, and is recorded for that: `afterEdge` always sets
//    `emUso = origem`, so the two expressions are the same value. The code keeps reading the automaton — not for
//    coverage, but because WHICH transport is in use is the question that module exists to answer, and a second
//    answer would drift the day it gained a rule.
//    (`emUso` is today's `inUse`.)
