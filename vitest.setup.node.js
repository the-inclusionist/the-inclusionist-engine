// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup of the "node" project: the stored settings are loaded as a composition root loads them (ADR-0178), so a module tested
// on its own reads and writes them as it does in a game. `estado-carregado-pela-raiz` checks the order without this setup.
import * as store from './app/js/platform/storage.js';
import { carregarEstado } from './app/js/core/state.js';
import { carregarIdioma } from './app/js/core/i18n.js';
carregarEstado(store);
carregarIdioma(store);
