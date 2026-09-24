// SPDX-License-Identifier: AGPL-3.0-or-later
// EACH TEST FILE'S OWN STORAGE (ADR-0232 driver D4, issue #207).
//
// The browser project runs ~115 files on ONE origin, and they used to share its one `localStorage`: a file wrote a key
// while another booted, and the second read the first one's choice (F9, the suite's instability). Since D2b nothing in the
// engine reaches `localStorage` by import — the root builds the store from what its HOST lends, `host.storage` or the host
// window's `localStorage` — so a file can simply lend its own. This module is evaluated once per test file (each file has
// its own module graph, and in the browser its own window), so `fileBackend` is that file's and nobody else's:
//   · the setups load `core/state` and `core/i18n` from it;
//   · the browser setup makes it the file's WINDOW storage, so every root a case boots with `win: window` — and the quiz
//     page, which is its own root — is lent this file's storage by its host, and a case that reads `localStorage` to see
//     what the engine kept reads the same place.
import { createStorage } from '../../app/js/platform/storage.js';
import { KEYS } from '../../app/js/platform/storage-keys.js';

/**
 * A backend in memory with the whole `Storage` shape — `key(i)` and `length` too, because the root photographs the host
 * window's keys to name the ones a cartridge stored outside the engine's scopes (study item E2).
 */
function fileLocalStorage() {
  const kept = new Map();
  return {
    getItem: (key) => (kept.has(String(key)) ? kept.get(String(key)) : null),
    setItem: (key, value) => { kept.set(String(key), String(value)); },
    removeItem: (key) => { kept.delete(String(key)); },
    clear: () => { kept.clear(); },
    key: (i) => [...kept.keys()][i] ?? null,
    get length() { return kept.size; },
  };
}

/** This file's backend: what a case reads back to see what the engine stored. */
export const fileBackend = fileLocalStorage();
/** The store over it. */
export const fileStore = createStorage(fileBackend);
/** The port `core/state.loadState` and `core/i18n.loadLocale` receive (ADR-0178): the store and the key names. */
export const filePort = { ...fileStore, KEYS };
