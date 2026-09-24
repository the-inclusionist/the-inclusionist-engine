// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "node" project: the stored settings are loaded as a composition root loads them (ADR-0178), so a module tested
// on its own reads and writes them as it does in a game. `estado-carregado-pela-raiz` checks the order without this setup.
// 📌 From THIS FILE'S OWN storage (ADR-0232, `tests/fixtures/file-storage.js`): no file inherits another's settings.
import { filePort } from './tests/fixtures/file-storage.js';
import { loadState } from './app/js/core/state.js';
import { loadLocale } from './app/js/core/i18n.js';
loadState(filePort);
loadLocale(filePort);
