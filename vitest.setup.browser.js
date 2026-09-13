// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup do project "browser". Os módulos de render (render/canvas, render/sprites, …) agora fazem
// `import * as PIXI from 'pixi.js'` diretamente (o global vendor/pixi.min.js foi aposentado), então não precisam
// mais de global. Mantemos globalThis.PIXI como shim inócuo p/ qualquer acesso legado. Ver docs/plano-testes.md.
import * as PIXI from 'pixi.js';
globalThis.PIXI = PIXI;
// Sem supressão de erros: os módulos de render são importados de forma PURA (sprites.js só carrega texturas em
// initCharacterSprites(), que os testes NÃO chamam), então não há mais rejeição de load de asset para ignorar.
// The stored settings are loaded as a composition root loads them (ADR-0178); `createGame` loads them again from the page's
// storage, and `estado-carregado-pela-raiz` checks the order without this setup.
import * as store from './app/js/platform/storage.js';
import { carregarEstado } from './app/js/core/state.js';
import { carregarIdioma } from './app/js/core/i18n.js';
carregarEstado(store);
carregarIdioma(store);

// EACH FILE STARTS WITH NO TYPOGRAPHY CHOSEN. The browser project shares one localStorage across files, and five of them walk the
// typography cycle: since ADR-0176 a stored face with a 20 px floor is applied at boot (25% larger text), and the next file
// opened the quiz with its last option in the footer — failing about one full run in three, never alone.
import { beforeAll } from 'vitest';
beforeAll(() => {
  for (const chave of ['incl_font_k', 'incl_lettercase']) localStorage.removeItem(chave);
  document.documentElement.style.removeProperty('--fonte-escala');
  delete document.documentElement.dataset.letras;
  carregarEstado(store);
});
