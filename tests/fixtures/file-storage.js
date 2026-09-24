// SPDX-License-Identifier: AGPL-3.0-or-later
// EACH TEST FILE'S OWN STORAGE (ADR-0232 driver D4, issue #207).
//
// The browser project runs ~115 files on ONE origin, and they used to share its one `localStorage`: a file wrote a key
// while another booted, and the second read the first one's choice (F9, the suite's instability). Since D2b nothing in the
// engine reaches `localStorage` by import — the root builds the store from what its HOST lends — so a file can simply lend
// its own. This module is evaluated once per test file (each file has its own module graph), so `fileBackend` is that
// file's and nobody else's; the setup loads the settings from it, and a file passes it to `createGame` as `host.storage`.
import { createStorage, memoryBackend } from '../../app/js/platform/storage.js';
import { KEYS } from '../../app/js/platform/storage-keys.js';

/** This file's backend: what a case reads back to see what the engine stored. */
export const fileBackend = memoryBackend();
/** The store over it. */
export const fileStore = createStorage(fileBackend);
/** The port `core/state.loadState` and `core/i18n.loadLocale` receive (ADR-0178): the store and the key names. */
export const filePort = { ...fileStore, KEYS };
