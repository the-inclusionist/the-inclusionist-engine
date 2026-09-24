// SPDX-License-Identifier: AGPL-3.0-or-later
// core/rng.ts — a seeded RNG (deterministic LCG) for reproducibility (placement, stable tests).
// A PURE leaf module, no dependencies.
//
// ⚠️ TWO THINGS ARE HERE ON PURPOSE (issue #107).
//
// 1. `createRng(seed)`. ADR-0038's D13 — "a module that keeps state exports a `createX()` factory" — named this
//    module. With one stream shared by every consumer, "a deterministic shuffle from seed S" is reproducible only on a
//    page where nothing else draws — and the engine exists precisely so the game is NOT alone on the page. Each
//    consumer makes its own stream.
//
// 2. `Math.imul`, not `*`. `_seed * 1103515245` with `_seed` near 2³¹ reaches ~2.37×10¹⁸, above 2⁵³: the LOW bits —
//    exactly the ones `& 0x7fffffff` keeps — were rounded away before the mask ran. `Math.imul` multiplies in 32 bits,
//    which is what a 32-bit LCG always meant.
//
// ⚠️ Both changed the seeded sequence, so they landed together: one migration, one sequence change, one explanation.
// The old arithmetic was reproducible too (floating point is deterministic), which is why the defect never showed:
// not wrong randomness, a WORSE generator than the one written.

/** A stream of pseudo-random numbers independent of any other. */
export interface Rng {
  /** [0, 1). */
  readonly rnd: () => number;
  /** An integer in [lo, hi], both inclusive. */
  readonly randInt: (lo: number, hi: number) => number;
  /** A shuffled copy (Fisher-Yates); the original is untouched. */
  readonly shuffle: <T>(arr: readonly T[]) => T[];
  /** Repositions THIS stream. Reaches no other. */
  readonly reseed: (s: number) => void;
}

/** The seed of the engine's own game. An outside consumer picks its own. */
export const DEFAULT_SEED = 20260601;

export const createRng = (seed: number = DEFAULT_SEED): Rng => {
  let _seed = seed >>> 0;
  // `Math.imul` and not `*`: see the header. The `+ 12345` fits safely because `imul` already returned a signed 32-bit
  // integer, and the `& 0x7fffffff` mask undoes the sign.
  const rnd = (): number => (_seed = (Math.imul(_seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
  const randInt = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const reseed = (s: number): void => { _seed = s >>> 0; };
  return { rnd, randInt, shuffle, reseed };
};

// ⚠️ THE SHARED STREAM. It is published surface, so removing it is a breaking change with its own migration, not a
// cleanup. And the warning still holds, which is the discomfort: it is shared module state, exactly the defect the
// factory above fixes — a second game on the same page shares this stream with the first. The way out is for a
// consumer to move to `createRng(itsSeed)`.
const sharedRng = createRng(DEFAULT_SEED);
export const reseed = sharedRng.reseed;
export const rnd = sharedRng.rnd;
export const randInt = sharedRng.randInt;
export const shuffle = sharedRng.shuffle;

// ⚠️ THE DECORATION STREAM, apart from the one above because mixing them was the CONCRETE defect. Particles, raindrops
// and camera shake draw dozens of numbers a frame; from the same stream as the game's draws, "seed with S and the map
// comes out the same" depended on how many particles the screen had drawn before, which nobody controls or notices.
// Ornament must NOT move the game's draw. Two subjects, two streams. The seed differs on purpose: with the same one the
// two streams would run in step and the ornament would correlate with the map — deterministic, but visibly repetitive.
export const decorationRng = createRng(DEFAULT_SEED ^ 0x5eed);
