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
//    📌 And the module holds NO stream of its own (ADR-0232 D4, issue #207): the shared `rnd`/`randInt`/`shuffle`/`reseed`
//    and the decoration stream were module state a second game on the page shared. A game that wants ornament apart from
//    its draws builds a second stream with another seed — the platformer's is `createRng(DEFAULT_SEED ^ 0x5eed)` — because
//    particles drawn from the game's stream would move the game's draw.
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
