// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "node" project: the stored language is loaded as a composition root loads it (ADR-0178), so a module tested
// on its own reads it as it does in a game. The settings store is a factory (ADR-0232 D4): a file that needs one builds it.
// 📌 From THIS FILE'S OWN storage (ADR-0232, `tests/fixtures/file-storage.js`): no file inherits another's settings.
import { filePort } from './tests/fixtures/file-storage.js';
import { loadLocale } from './app/js/core/i18n.js';
loadLocale(filePort);
