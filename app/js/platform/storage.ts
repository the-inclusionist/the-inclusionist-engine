// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage.ts — the single persistence layer (localStorage), a leaf module but for its key table. Exception-proof: localStorage
// THROWS on file:// and in some browsers' private mode, and that used to bring the whole boot down (hence every access
// is try/catch). Centralised here: one place to change the strategy (namespacing, IndexedDB…) without hunting dozens of
// call sites.

import { KEYS as KEY_TABLE } from './storage-keys.js';

// OVERLOADS BECAUSE THE DEFAULT DECIDES THE RETURN TYPE. With a `fallback: string` the result CANNOT be null — a single
// signature returned `string | null` regardless, and every caller with a default paid for an impossible `null`.
export function get(key: string, fallback: string): string;
export function get(key: string, fallback?: null): string | null;
export function get(key: string, fallback: string | null = null): string | null {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function set(key: string, value: string | number | boolean): boolean {
  try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
export function remove(key: string): void { try { localStorage.removeItem(key); } catch { /* noop */ } }

export function getBool(key: string, fallback = false): boolean { const v = get(key, null); return v == null ? fallback : v === '1'; }
export function setBool(key: string, on: boolean): void { set(key, on ? '1' : '0'); }

export function getNum(key: string, fallback = 0): number {
  const v = get(key, null); const n = v == null ? NaN : parseFloat(v);
  return isFinite(n) ? n : fallback;
}

export function getJSON<T = unknown>(key: string, fallback: T | null = null): T | null {
  try { const s = get(key, null); return s == null ? fallback : (JSON.parse(s) as T); } catch { return fallback; }
}
export function setJSON(key: string, obj: unknown): void { try { set(key, JSON.stringify(obj)); } catch { /* noop */ } }

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

/**
 * Reads the NEW key; if it does not exist yet, inherits the LEGACY one's value. Read-only: whoever writes, writes to the
 * new one. It is what lets a key be renamed without a migration step and without anyone losing a setting.
 */
export function getWithLegacy(newKey: string, legacyKey: string, fallback: string): string;
export function getWithLegacy(newKey: string, legacyKey: string, fallback?: null): string | null;
export function getWithLegacy(newKey: string, legacyKey: string, fallback: string | null = null): string | null {
  const v = get(newKey, null);
  if (v !== null) return v;
  const inherited = get(legacyKey, null);
  return inherited !== null ? inherited : fallback;
}

/** `getWithLegacy`'s pair for a JSON value — the inheritance has to hold for both formats, or half the keys migrate and
 *  the other half vanish, the worst of both worlds. */
export function getJsonWithLegacy<T = unknown>(newKey: string, legacyKey: string, fallback: T | null = null): T | null {
  const v = getJSON<T>(newKey, null);
  if (v !== null) return v;
  const inherited = getJSON<T>(legacyKey, null);
  return inherited !== null ? inherited : fallback;
}

/**
 * The register of known keys and `gameKey` live in `platform/storage-keys`, a stateless module (ADR-0232, issue #207).
 *
 * ⚠️ `KEYS` IS STILL PUBLISHED HERE, as an alias and not a re-export (the surface snapshot does not see re-exports), and it
 * is measured, not habit: two games read `KEYS` from this module, eight engine modules read `store.KEYS` through the
 * namespace they store with, and this namespace is the port `core/state.loadState` receives. It ends with D2b, when the
 * root builds the storage and nothing imports this module by value.
 */
export const KEYS = KEY_TABLE;
