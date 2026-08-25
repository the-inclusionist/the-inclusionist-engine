// SPDX-License-Identifier: AGPL-3.0-or-later
// Setup do project "browser". Os módulos de render (render/canvas, render/sprites, …) agora fazem
// `import * as PIXI from 'pixi.js'` diretamente (o global vendor/pixi.min.js foi aposentado), então não precisam
// mais de global. Mantemos globalThis.PIXI como shim inócuo p/ qualquer acesso legado. Ver docs/plano-testes.md.
import * as PIXI from 'pixi.js';
globalThis.PIXI = PIXI;
// Sem supressão de erros: os módulos de render são importados de forma PURA (sprites.js só carrega texturas em
// initCharacterSprites(), que os testes NÃO chamam), então não há mais rejeição de load de asset para ignorar.
