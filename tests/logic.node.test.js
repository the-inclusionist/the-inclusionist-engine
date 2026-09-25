// SPDX-License-Identifier: AGPL-3.0-or-later
// PURE-LOGIC tests (node project — no PIXI/document/localStorage). Patterns: ZOMBIES (order/teaching) + Right-BICEP
// (rigour). Labels in the test name. See docs/3-Sprint-Design/plan-unit-tests-at-extraction.md. Modules: core/constants, input/state,
// platform/audio (the mixer), core/rng.
import { describe, it, expect } from 'vitest';
import * as C from '../app/js/core/constants.js';
import { createInputState } from '../app/js/input/state.js';
import * as AUDIO from '../app/js/platform/audio.js';
import { AUDIO_CATS } from '../app/js/platform/audio-mixer.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { createRng } from '../app/js/core/rng.js';

describe('core/constants', () => {
  it('[Right] o que qualquer jogo 2D em pixel usa', () => {
    // ⚠️ No `C.TUNE.jumpVel` (issue #63) and no `C.ANIM` (ADR-0228): the cadences of a character that walks, runs, swims
    // and climbs belong to a game. What stays is the grid, the one thing on this line every cartridge shares.
    expect(C.TILE).toBe(16);
  });
  it('⚠️ [Interface] o que DESCREVE UM MUNDO DE TILES saiu do catálogo, e voltar por engano reprova aqui', () => {
    /*
     * 🎯 Shrinking the public surface is a major, and a constant that comes back by accident undoes it silently.
     * 🔴 `TILE_TYPES`, `isHazard` and `isTrampoline` were kept while a collision rule in the engine read them (hazard
     * and trampoline solid in the blind and wheelchair modes); that rule left with the geometry it queries, and the
     * three were left with no reader in the engine.
     * 📌 The engine still knows what a hazard is — it asks the contract for the ROLE (`roleOf`). What it no longer has
     * is a table of tile NUMBERS, which is only true in one map.
     */
    for (const n of ['ANIM', 'EASY', 'TILE_COLOR', 'TILE_TYPES', 'isHazard', 'isTrampoline']) {
      expect(n in C, `${n} voltou ao catálogo — ele descreve um jogo`).toBe(false);
    }
    expect(C.TILE, 'a GRADE em pixels fica: é o que qualquer jogo 2D em pixel partilha').toBe(16);
  });
  it('⚠️ [Interface] `JUMP_BASE` e `ehChave` SAÍRAM, e este caso é o que impede que voltem por engano', () => {
    // Both left with issue #63: `JUMP_BASE` had no consumer anywhere, and the only case about it restated its own
    // definition, so it could not fail for any reason that mattered.
    //
    // What stands here asserts the ABSENCE: the engine's public surface shrank, and shrinking public surface is a
    // major — not something to undo by distraction.
    expect('JUMP_BASE' in C, 'JUMP_BASE voltou ao catálogo').toBe(false);
    expect('ehChave' in C, 'ehChave voltou ao catálogo').toBe(false);
  });
  it('[Interface] canvas lógico 320×180 (16:9)', () => {
    expect(C.LOGICAL_W).toBe(320);
    expect(C.LOGICAL_H).toBe(180);
    expect(C.LOGICAL_W / C.LOGICAL_H).toBeCloseTo(16 / 9, 4);
  });
});


describe('platform/audio — mixer (import PURO, init explícito; dívida paga Fase 2.25)', () => {
  // [Zero] runs BEFORE any init (it is the block's 1st test and nothing else calls initAudioMixer):
  it('[Zero] import não carrega o mixer — audioCat === null até initAudioMixer() (sem I/O no import)', () => {
    expect(AUDIO.audioCat).toBe(null);
    expect(typeof AUDIO.initAudioMixer).toBe('function');
  });
  it('[Interface] após init, audioCat tem exatamente as 9 categorias do AUDIO_CATS', () => {
    AUDIO.initAudioMixer(createStorage(memoryBackend()));
    expect(Object.keys(AUDIO.audioCat).sort()).toEqual(AUDIO_CATS.map((c) => c.k).sort());
  });
  it('[Right/a11y] TTS geral nasce DESLIGADO (TEA-safe) e as demais LIGADAS', () => {
    AUDIO.initAudioMixer(createStorage(memoryBackend())); // idempotente
    expect(AUDIO.audioCat.tts.on).toBe(false);
    expect(AUDIO.audioCat.music.on).toBe(true);
    expect(AUDIO.audioCat.ambient.on).toBe(true);
  });
});


describe('core/rng — LCG semeado (determinístico)', () => {
  // a stream of this block's own: the module holds none (ADR-0232 D4)
  const RNG = createRng();
  it('[Right/reprodutibilidade] mesma semente → mesma sequência', () => {
    RNG.reseed(20260601);
    const a = [RNG.rnd(), RNG.rnd(), RNG.rnd()];
    RNG.reseed(20260601);
    expect([RNG.rnd(), RNG.rnd(), RNG.rnd()]).toEqual(a);
  });
  it('[Range] rnd() sempre em [0, 1)', () => {
    RNG.reseed(1);
    for (let i = 0; i < 100; i++) { const v = RNG.rnd(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('[Boundary] randInt(5,5)===5; randInt(1,6) sempre em [1,6]', () => {
    expect(RNG.randInt(5, 5)).toBe(5);
    RNG.reseed(42);
    for (let i = 0; i < 200; i++) { const v = RNG.randInt(1, 6); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6); }
  });
  it('[Zero/One] shuffle([])=[] e shuffle([x])=[x]; [Many] preserva o multiset', () => {
    expect(RNG.shuffle([])).toEqual([]);
    expect(RNG.shuffle([7])).toEqual([7]);
    const src = [1, 2, 3, 4, 5];
    expect(RNG.shuffle(src).slice().sort((a, b) => a - b)).toEqual(src);
  });
});


describe('input/state — held(pl, act)', () => {
  const S = createInputState(); // one root's input state (ADR-0232 D4)
  const mkPlayer = (over = {}) => ({ ctrl: { jump: ['KeyL'], left: ['KeyA'] }, pad: -1, ...over });

  it('[Zero] nada pressionado → held=false', () => {
    expect(S.held(mkPlayer(), 'jump')).toBe(false);
  });
  it('[One] tecla do esquema aciona held; some ao soltar; não vaza p/ outra ação', () => {
    const pl = mkPlayer();
    S.keys.add('KeyL');
    expect(S.held(pl, 'jump')).toBe(true);
    expect(S.held(pl, 'left')).toBe(false);
    S.keys.delete('KeyL');
    expect(S.held(pl, 'jump')).toBe(false);
  });
  it('[Interface] gamepad associado (pl.pad) aciona held pela padCur', () => {
    const pl = mkPlayer({ pad: 0 });
    S.padCur[0] = { jump: true };
    expect(S.held(pl, 'jump')).toBe(true);
    S.padCur[0] = { jump: false };
    expect(S.held(pl, 'jump')).toBe(false);
    delete S.padCur[0];
  });
  it('[Boundary] pl.pad = -1 ignora o gamepad mesmo com padCur ocupada', () => {
    const pl = mkPlayer({ pad: -1 });
    S.padCur[0] = { jump: true }; // it exists, but it is not their pad
    expect(S.held(pl, 'jump')).toBe(false);
    delete S.padCur[0];
  });
});

// ⚠️ The sprite-contract assertions live in `game-platformer/tests/sprites-contrato.node.test.js`, with the module
// (issue #111): `render/sprites` imports `virtual:sprite-atlas`, which exists only inside the GAME's build plugin.

