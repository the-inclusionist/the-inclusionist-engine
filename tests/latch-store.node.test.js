// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-store — the latch read from and written to storage (ADR-0113).
//
// 🎯 THIS FILE ASSERTS CLAUSE 1 OF ADR-0113 IN CODE: «trocar de transporte troca o valor como troca o mapa de
// teclas». The gate the record asks for is literally that — *the same player, with two transports, gives two answers,
// and switching transport switches the answer WITHOUT any write to storage*.
//
// 📌 AND IT IS A MODULE APART FROM THE RULE on purpose. `latch-scope` is pure and has its own gate; if storage lived in
// it, every case of the rule would have to build a fake `localStorage` to assert things that do not depend on it. The
// split is the same as `render/viz-axes` (model) and `render/viz-setters` (writing).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  readTriState, readLatch, storedLatch, writeLatch,
} from '../app/js/input/latch-store.js';
import { latchKey, legacyLatchKey } from '../app/js/input/latch-scope.js';

/** A fake store with the minimum surface — which RECORDS the writes, because one of them is the defect. */
function armazem(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  const set = (k, v) => { dados[k] = v; escritas.push([k, v]); };
  return {
    get: (k) => (k in dados ? dados[k] : null),
    set,
    // ⚠️ THE SHAPE `writeLatch` ASKS FOR: a WRITER, not a store. `ui/settings-mobility` already has an injected
    // `store.setBool`, and demanding an object with raw `get`/`set` would force an adapter at the call site — which is
    // where a second way of writing the same key is born.
    _escrever: (k, on) => set(k, on ? '1' : '0'),
    _dados: dados,
    _escritas: escritas,
  };
}

const BASE = 'togglemove';

describe('latch-store · três estados, e não dois', () => {
  it('[Right] `1` é ligado, `0` é desligado, ausente é NULO', () => {
    const a = armazem({ x: '1', y: '0' });
    expect(readTriState(a, 'x')).toBe(true);
    expect(readTriState(a, 'y')).toBe(false);
    expect(readTriState(a, 'z')).toBe(null);
  });

  // 🔴 THE CASE THAT NAMES THE MODULE. With `getBool`, «nunca escrito» would become `false`, the rule would stop at its
  // first line and NEVER consult the legacy key — and the child would lose the setting they already had.
  it('🔴 [Zero] nunca escrito NÃO é `false`: o legado ainda é consultado, e é o ajuste da criança', () => {
    const a = armazem({ [legacyLatchKey(BASE, 0)]: '1' });
    const l = readLatch(a, BASE, 0, 'teclado', false);
    expect(l.fromTransport, 'nunca escrito virou um valor').toBe(null);
    expect(l.fromLegacy).toBe(true);
    expect(storedLatch(a, BASE, 0, 'teclado', false), 'a criança perdeu o ajuste que já tinha').toBe(true);
  });

  it('⚠️ [Boundary] `0` guardado NESTE transporte é um VALOR e vence o legado ligado', () => {
    const a = armazem({
      [latchKey(BASE, 0, 'teclado')]: '0',
      [legacyLatchKey(BASE, 0)]: '1',
    });
    expect(storedLatch(a, BASE, 0, 'teclado', false)).toBe(false);
  });
});

describe('latch-store · a cláusula 1 do ADR-0113: trocar de controle troca o valor', () => {
  // 🎯 THE GATE THE RECORD ASKS FOR, and its second half is the one that matters: NO write happens. If switching
  // transport needed a write, the value would not belong to the mapping — it would belong to the session.
  it('🎯 [Right] o mesmo jogador dá duas respostas em dois transportes, sem escrever nada', () => {
    const a = armazem({
      [latchKey(BASE, 0, 'teclado')]: '1',
      [latchKey(BASE, 0, 'gamepad')]: '0',
    });
    expect(storedLatch(a, BASE, 0, 'teclado', false)).toBe(true);
    expect(storedLatch(a, BASE, 0, 'gamepad', false)).toBe(false);
    expect(storedLatch(a, BASE, 0, 'teclado', false), 'voltar ao primeiro deu outra resposta').toBe(true);
    expect(a._escritas, 'ler trocou de transporte E GRAVOU — o valor deixou de ser do mapeamento').toEqual([]);
  });

  it('[Right] jogadores diferentes não partilham chave no mesmo transporte', () => {
    const a = armazem({ [latchKey(BASE, 0, 'teclado')]: '1' });
    expect(storedLatch(a, BASE, 0, 'teclado', false)).toBe(true);
    expect(storedLatch(a, BASE, 1, 'teclado', false), 'o jogador 1 leu a chave do jogador 0').toBe(false);
  });

  it('[Zero] sem nada guardado, responde o padrão de fábrica', () => {
    const a = armazem();
    expect(storedLatch(a, BASE, 0, 'teclado', false)).toBe(false);
    expect(storedLatch(a, BASE, 0, 'teclado', true), 'o padrão de fábrica foi ignorado').toBe(true);
  });
});

describe('latch-store · a escrita, e onde ela se recusa', () => {
  it('[Right] gravar escreve na chave DESTE transporte, e só nela', () => {
    const a = armazem();
    expect(writeLatch(a._escrever, BASE, 0, 'gamepad', true)).toBe(true);
    expect(a._escritas).toEqual([[latchKey(BASE, 0, 'gamepad'), '1']]);
    expect(a._dados[legacyLatchKey(BASE, 0)], 'a escrita tocou na chave legada').toBeUndefined();
  });

  // ⚠️ CLAUSE 3 OF ADR-0113: on the four assisted transports there is no choice to store, because the latch is what makes
  // the input work. And the refusal is a RETURNED `false` — the caller uses it to disable the control with the reason
  // stated, which is the half that lives in the interface.
  it('⚠️ [Zero] nos quatro assistidos a escrita RECUSA-SE, e não grava nada', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const a = armazem();
      expect(writeLatch(a._escrever, BASE, 0, t, false), `${t} aceitou uma escolha que não existe`).toBe(false);
      expect(a._escritas, `${t} gravou um valor que o jogo vai ignorar`).toEqual([]);
    }
  });

  // 📌 THE PAIR: on those four the READ keeps answering on, whatever is on disk. Without this case, «recusar a escrita»
  // could mean «deixar a criança sem alternância», which is the opposite.
  it('📌 [Boundary] e a leitura deles responde LIGADA mesmo com `0` no disco', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      const a = armazem({
        [latchKey(BASE, 0, t)]: '0',
        [legacyLatchKey(BASE, 0)]: '0',
      });
      expect(storedLatch(a, BASE, 0, t, false), `${t} pôde ficar sem alternância`).toBe(true);
    }
  });

  it('[Right] os três de hoje aceitam a escolha', () => {
    for (const t of ['teclado', 'gamepad', 'toque']) {
      const a = armazem();
      expect(writeLatch(a._escrever, BASE, 0, t, true), `${t} recusou uma escolha legítima`).toBe(true);
      expect(storedLatch(a, BASE, 0, t, false)).toBe(true);
    }
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. `readTriState` returning `v === '1'` without the null branch (= the `getBool` this module exists to avoid)
//                                                      → 🔴 the LEGACY case fails: the child loses the setting
// 2. `readLatch` ignoring the legacy key        → the same case fails, by another path
// 3. `latchKey` without the transport in the name → the TWO TRANSPORTS case fails
// 4. `writeLatch` without the `latchIsOptional` guard → the REFUSAL case fails on all four
// 5. `writeLatch` always returning `false`      → the case of today's three fails
//    📌 it is the pair of 4: without it, «recusar sempre» would pass the refusal case and kill everyone's choice
// 6. `storedLatch` writing the value it read (a «cache») → 🎯 the clause-1 case fails on the WRITES assertion, not on
//    the value — which is why that assertion exists
