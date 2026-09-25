// SPDX-License-Identifier: AGPL-3.0-or-later
// The gate of issue #107. Two properties, because there were two defects in a single migration.
//
// ⚠️ THIS FILE DOES NOT PIN VALUES. Pinning the LCG's output would make a test that becomes the reason the arithmetic
// cannot be corrected — which is exactly what nearly blocked this correction. What it pins are the two properties the
// consumers need: INDEPENDENT streams, and multiplication that does not lose bits.
import { describe, it, expect } from 'vitest';
import * as rngModule from '../app/js/core/rng.js';
import { createRng, DEFAULT_SEED } from '../app/js/core/rng.js';

describe('createRng: cada consumidor tem a sua corrente (ADR-0038 D13, issue #107)', () => {
  it('duas correntes com a MESMA semente dão a mesma sequência', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const sa = Array.from({ length: 20 }, () => a.rnd());
    const sb = Array.from({ length: 20 }, () => b.rnd());
    expect(sa).toEqual(sb);
  });

  it('desenhar de UMA corrente não move a outra — é o defeito que o game-15puzzle mediu', () => {
    const jogo = createRng(777);
    const particulas = createRng(777);

    // The game draws three numbers. Between the first and the second, a particle effect draws 500 times — one particle
    // per call, on any frame.
    const primeiro = jogo.rnd();
    for (let i = 0; i < 500; i++) particulas.rnd();
    const segundo = jogo.rnd();
    const terceiro = jogo.rnd();

    // The same seed, with nobody drawing in between, has to give the same three.
    const sozinho = createRng(777);
    expect([primeiro, segundo, terceiro]).toEqual([sozinho.rnd(), sozinho.rnd(), sozinho.rnd()]);
  });

  it('reseed de uma corrente não alcança as outras', () => {
    const a = createRng(5);
    const b = createRng(5);
    a.reseed(99);
    // `b` stays where it was: its next output is the first of a stream seeded with 5.
    expect(b.rnd()).toBe(createRng(5).rnd());
  });

  it('shuffle devolve cópia e não toca no original', () => {
    const r = createRng(42);
    const original = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const baralhado = r.shuffle(original);
    expect(baralhado).not.toBe(original);
    expect([...baralhado].sort((x, y) => x - y)).toEqual([...original]);
  });
});

describe('a aritmética do LCG não perde bits (issue #107, defeito 2)', () => {
  it('a corrente bate com o LCG verdadeiro, calculado em BigInt — passo a passo', () => {
    // ⚠️ THIS IS THE GATE: comparing `Math.imul` with `Math.imul` would pass even with the mutation applied — it would
    // assert a property of the language, not of the module.
    //
    // The reference is computed by ANOTHER path — BigInt, which has no 2^53 at all — and the assertion is about what the
    // module returns. It is the structural advantage a checker needs over what it checks: BigInt cannot be wrong the
    // same way floating point is.
    const r = createRng(DEFAULT_SEED);
    let s = BigInt(DEFAULT_SEED >>> 0);
    const A = 1103515245n, C = 12345n, MASCARA = 0x7fffffffn;
    for (let i = 0; i < 5000; i++) {
      s = (s * A + C) & MASCARA;
      expect(r.rnd()).toBe(Number(s) / 0x7fffffff);
    }
  });

  it('a aritmética ANTIGA era de facto insegura — o defeito não era teórico', () => {
    // Without this measurement, the test above could be defending against nothing. It says that in the overwhelming
    // majority of steps the 64-bit product left JavaScript's exact integer range.
    let s = DEFAULT_SEED >>> 0;
    let inseguros = 0;
    for (let i = 0; i < 5000; i++) {
      if (!Number.isSafeInteger(s * 1103515245)) inseguros++;
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    }
    expect(inseguros).toBeGreaterThan(4000);
  });

  it('o período passa de 12 mil e o gerador cobre a faixa', () => {
    // With the old arithmetic the stream re-entered in 12,354 steps, in a generator whose nominal period is 2^31. We do
    // not measure 2^31 here (it would take minutes); we measure that it went WELL past what it was.
    const r = createRng(DEFAULT_SEED);
    const vistos = new Set();
    for (let i = 0; i < 60000; i++) vistos.add(r.rnd());
    expect(vistos.size).toBe(60000);
  });

  it('rnd fica em [0, 1) e randInt respeita os dois extremos', () => {
    const r = createRng(2026);
    for (let i = 0; i < 10000; i++) {
      const v = r.rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const vistos = new Set();
    for (let i = 0; i < 3000; i++) vistos.add(r.randInt(3, 7));
    expect([...vistos].sort()).toEqual([3, 4, 5, 6, 7]);
  });
});


describe('the module holds no stream (ADR-0232 D4, issue #207)', () => {
  it('its values are the factory and the default seed, and nothing a second game on the page would share', () => {
    // 🔴 The shared `rnd`/`randInt`/`shuffle`/`reseed` and `decorationRng` were module state: two games on one page drew
    // from one stream. A stream is now always a game's own, built with `createRng`.
    expect(Object.keys(rngModule).sort()).toEqual(['DEFAULT_SEED', 'createRng']);
  });

  it('ornament gets its own stream by seed, and drawing it does not move the game draw', () => {
    // What `decorationRng` gave, built the way a game builds it now (the platformer's seed).
    const game = createRng(4242);
    const ornament = createRng(DEFAULT_SEED ^ 0x5eed);
    const alone = createRng(4242);
    const withOrnament = [];
    for (let i = 0; i < 4; i++) {
      for (let p = 0; p < 60; p++) ornament.rnd();
      withOrnament.push(game.rnd());
    }
    expect(withOrnament).toEqual([alone.rnd(), alone.rnd(), alone.rnd(), alone.rnd()]);
  });
});