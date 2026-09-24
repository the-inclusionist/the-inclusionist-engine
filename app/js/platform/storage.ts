// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage.ts — the single persistence layer, as a FACTORY: `createStorage(backend)` wraps the browser object it is
// given (ADR-0232 point 2). The composition root builds the one store of a page from what the HOST lends it, and every
// module that persists receives that store through its ctx or deps (issue #207).
//
// Exception-proof: `localStorage` THROWS on file:// and in some browsers' private mode, and that used to bring the whole
// boot down (hence every access is try/catch). Centralised here: one place to change the strategy (namespacing,
// IndexedDB…) without hunting dozens of call sites.

/**
 * What the store wraps: the three methods of the Web Storage API it calls. A window's `localStorage` has this shape, and so
 * does `memoryBackend()` — which is how a test, or a second root on the same page, gets storage nobody else writes.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The store every persisting module receives: typed reads with a fallback, writes that never throw. */
export interface Store {
  // OVERLOADS BECAUSE THE DEFAULT DECIDES THE RETURN TYPE. With a `fallback: string` the result CANNOT be null — a single
  // signature returned `string | null` regardless, and every caller with a default paid for an impossible `null`.
  get(key: string, fallback: string): string;
  get(key: string, fallback?: null): string | null;
  /** `false` when the backend refused the write (quota, private mode, no storage at all). */
  set(key: string, value: string | number | boolean): boolean;
  remove(key: string): void;
  getBool(key: string, fallback?: boolean): boolean;
  setBool(key: string, on: boolean): void;
  getNum(key: string, fallback?: number): number;
  getJSON<T = unknown>(key: string, fallback?: T | null): T | null;
  setJSON(key: string, obj: unknown): void;
  /**
   * Reads the NEW key; if it does not exist yet, inherits the LEGACY one's value. Read-only: whoever writes, writes to the
   * new one. It is what lets a key be renamed without a migration step and without anyone losing a setting.
   */
  getWithLegacy(newKey: string, legacyKey: string, fallback: string): string;
  getWithLegacy(newKey: string, legacyKey: string, fallback?: null): string | null;
  /** `getWithLegacy`'s pair for a JSON value — the inheritance has to hold for both formats, or half the keys migrate and
   *  the other half vanish, the worst of both worlds. */
  getJsonWithLegacy<T = unknown>(newKey: string, legacyKey: string, fallback?: T | null): T | null;
}

/**
 * THE STORE, built around the backend it is GIVEN (ADR-0232). `null` is a host with no storage at all: every read gives its
 * fallback and every write reports `false` — the same answer a throwing `localStorage` gives, so the two cannot differ.
 *
 * 📌 CLOSURES AND NOT METHODS ON `this`: `loadLocale({ ...store, ...hooks })` spreads the store into another object, and a
 * method that read `this` would lose its backend in the spread.
 */
export function createStorage(backend: StorageLike | null): Store {
  function get(key: string, fallback: string): string;
  function get(key: string, fallback?: null): string | null;
  function get(key: string, fallback: string | null = null): string | null {
    try { const v = backend ? backend.getItem(key) : null; return v == null ? fallback : v; } catch { return fallback; }
  }
  const set = (key: string, value: string | number | boolean): boolean => {
    if (!backend) return false;
    try { backend.setItem(key, String(value)); return true; } catch { return false; }
  };
  const remove = (key: string): void => { try { backend?.removeItem(key); } catch { /* noop */ } };
  const getJSON = <T = unknown>(key: string, fallback: T | null = null): T | null => {
    try { const s = get(key, null); return s == null ? fallback : (JSON.parse(s) as T); } catch { return fallback; }
  };
  function getWithLegacy(newKey: string, legacyKey: string, fallback: string): string;
  function getWithLegacy(newKey: string, legacyKey: string, fallback?: null): string | null;
  function getWithLegacy(newKey: string, legacyKey: string, fallback: string | null = null): string | null {
    const v = get(newKey, null);
    if (v !== null) return v;
    const inherited = get(legacyKey, null);
    return inherited !== null ? inherited : fallback;
  }
  return {
    get, set, remove, getJSON, getWithLegacy,
    getBool: (key, fallback = false) => { const v = get(key, null); return v == null ? fallback : v === '1'; },
    setBool: (key, on) => { set(key, on ? '1' : '0'); },
    getNum: (key, fallback = 0) => {
      const v = get(key, null); const n = v == null ? NaN : parseFloat(v);
      return isFinite(n) ? n : fallback;
    },
    setJSON: (key, obj) => { try { set(key, JSON.stringify(obj)); } catch { /* noop */ } },
    getJsonWithLegacy: <T = unknown>(newKey: string, legacyKey: string, fallback: T | null = null): T | null => {
      const v = getJSON<T>(newKey, null);
      if (v !== null) return v;
      const inherited = getJSON<T>(legacyKey, null);
      return inherited !== null ? inherited : fallback;
    },
  };
}

/**
 * A backend kept in memory, seeded with `entries` — for a host with no storage worth writing to, and for a test: a file that
 * builds its own cannot inherit another file's keys nor race it for them (ADR-0232 driver D4, the browser suite's F9).
 */
export function memoryBackend(entries: Iterable<readonly [string, string]> = []): StorageLike {
  const kept = new Map<string, string>(entries);
  return {
    getItem: (key) => kept.get(key) ?? null,
    setItem: (key, value) => { kept.set(key, String(value)); },
    removeItem: (key) => { kept.delete(key); },
  };
}

/* ===================== the TWO scopes (namespaced saves, ADR-0027 step 7) ===================== */
//
// The obvious namespacing — a per-game prefix on EVERYTHING — would be a serious accessibility defect, and it is worth
// saying why before saying what was done.
//
// A blind child sets up blind mode, the cane, the voice, the narration speed. A colour-blind child picks the correction.
// A dyslexic child picks the font. If every game had its own namespace, they would have to REDO all of that in every
// game — and whoever depends most on the settings is exactly whoever has the least margin to redo them.
//
// So there are TWO scopes, and the line between them is not technical, it is about whom the thing belongs to:
//
//   · SHARED (`incl_*`) — what belongs to the CHILD: accessibility, typography, language, voice, controls, touch. It
//     follows them from game to game, on purpose: a second game reading the font chosen in the first is RIGHT.
//   · THE GAME'S (`incl.<game>.*`) — what belongs to THIS play-through: activity, level, scenery, the demo recording.
//     Two games with a "level 3" do not have the same level 3.
//
// THE READ INHERITS FROM THE OLD KEY and the write goes to the new one only (`getWithLegacy`). No migration step, because
// a scheduled migration would arrive after the reads. And the old key stays where it is: it is the child's data, not mine
// to delete, and keeping it is what makes a way back possible.

/**
 * THE KEYS OUTSIDE EVERY ENGINE SCOPE (study item E2): not the child's `incl_*` (and the older `inclusionist.*`), not a
 * game's `incl.<game>.*`. 📏 Measured: pinball stores `pinball:*`. ⚠️ A game's data stored in the CHILD's scope
 * (chess's `incl_chess_*`) is not seen: the engine's own `incl_` keys are not one closed list, so that question would
 * accuse the engine.
 */
export function keysOutsideScopes(storedKeys: Iterable<string>): string[] {
  return [...storedKeys].filter((k) => !k.startsWith('incl_') && !k.startsWith('inclusionist.') && !k.startsWith('incl.'));
}
