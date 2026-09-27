// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-store.ts — THE TOGGLE, READ FROM AND WRITTEN TO STORAGE (ADR-0113).
//
// ========================= WHAT THIS MODULE IS, AND WHY IT IS APART =========================
// `input/latch-scope` is the RULE and touches nothing: it takes a finished `LatchReading` and answers. This module is the
// one thing that was missing between it and the world — whoever goes to storage for the two stored values the rule asks
// for, and whoever writes what the child chooses. The two defaults (the factory's and the game's) arrive as an argument.
//
// 📌 APART ON PURPOSE, not for tidiness: the rule is pure and has its own gate; mixing storage into it would make every
// case of the rule build a fake `localStorage` to assert something that does not depend on it. The same split
// `render/viz-axes` (model) and `render/viz-setters` (writing) make in this repository.
//
// ⚠️ AND WHAT IT DOES NOT DO: it does not know WHICH transport is in use. That is `input/transport-in-use`'s, and it
// arrives here as an argument. A storage module that guessed the transport would write one child's choice under another
// device's key — in silence, the defect ADR-0113 exists to prevent.
import {
  latchKey, legacyLatchKey, latchOf,
  type LatchReading, type LatchDefaults,
} from './latch-scope.js';

/** The minimum of `platform/storage` this needs. Injected, so the gate needs no browser. */
export interface LatchStore {
  /** ⚠️ The RAW read, not `getBool`. See `readTriState`. */
  get(key: string, fallback?: null): string | null;
  set(key: string, value: string): void;
}

/**
 * THREE STATES, NOT TWO: `true`, `false`, and NEVER WRITTEN.
 *
 * 🔴 THIS FUNCTION EXISTS SO `getBool` IS NOT USED, and the difference costs a child's setting. `getBool` collapses
 * "never written" into `false`. With it, the per-transport value of a child who never touched this device would reach the
 * rule as `false` — and the rule answers at the FIRST line that finds a value, so it would return `false` and **never
 * consult the legacy key**, where the setting they already had lives.
 *
 * ⚠️ That is why `latch-scope` types both fields `boolean | null` and has a case of its own saying "a stored `false` is a
 * VALUE, not an absence". This is the storage side of the same sentence.
 */
export function readTriState(store: LatchStore, key: string): boolean | null {
  const v = store.get(key, null);
  return v == null ? null : v === '1';
}

/**
 * THE WHOLE READING the rule asks for, built from storage.
 *
 * `base` is `togglemove` or `togglerun` — the two names that already exist in the child's storage. `defaults` carries what
 * storage does not know: the factory default and the game's `holdsKeys()` answer now (ADR-0249).
 */
export function readLatch(
  store: LatchStore,
  base: string,
  player: number,
  transport: string,
  defaults: LatchDefaults,
): LatchReading {
  return {
    fromTransport: readTriState(store, latchKey(base, player, transport)),
    fromLegacy: readTriState(store, legacyLatchKey(base, player)),
    byDefault: defaults.byDefault,
    gameHoldsKeys: defaults.gameHoldsKeys,
  };
}

/**
 * THIS PLAYER'S TOGGLE ON THIS TRANSPORT — the whole question, in one call.
 *
 * 📌 SWITCHING TRANSPORT SWITCHES THE ANSWER WITHOUT WRITING ANYTHING, clause 1 of ADR-0113 in code: the value belongs to
 * the controls' mapping, like a caps lock, and changing controls is changing mapping.
 */
export function storedLatch(
  store: LatchStore,
  base: string,
  player: number,
  transport: string,
  defaults: LatchDefaults,
): boolean {
  return latchOf(transport, readLatch(store, base, player, transport, defaults));
}

/**
 * WRITES THE CHILD'S CHOICE for the transport in use — on EVERY transport (ADR-0249).
 *
 * 📌 Eyes, face, gestures and speech included: their latch starts as the game answers `holdsKeys()`, and what is written
 * here is the child changing that default for that device. The stored value is what `latchOf` reads first.
 */
// ⚠️ IT TAKES THE WRITER AND NOT A STORE: the mobility panel already has a `store: { setBool }` injected, and demanding an
// object with raw `get`/`set` would force an adapter at the call site — where a second way of writing the same key is
// born. A function is the minimum the write needs.
export function writeLatch(
  write: (key: string, isOn: boolean) => void,
  base: string,
  player: number,
  transport: string,
  isOn: boolean,
): void {
  write(latchKey(base, player, transport), isOn);
}
