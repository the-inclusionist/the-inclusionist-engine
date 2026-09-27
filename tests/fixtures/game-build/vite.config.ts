// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FIXTURE GAME'S ONE DECLARATION (ADR-0253) — what a game's `vite.config.ts` looks like once it adopts the engine's build: its
// own app config, wrapped, and the cartridge's entry named. The PWA plugin is here so the test can see the APP keep its service
// worker and the CARTRIDGE lose it. The one line a game would not write is the import path: a game imports
// `@the-inclusionist/engine/build`, and this fixture lives inside the engine.
import { VitePWA } from 'vite-plugin-pwa';
import { defineGameBuild } from '../../../scripts/game-build.mjs';

export default defineGameBuild({
  cartridge: 'src/index.ts',
  config: {
    root: 'app',
    logLevel: 'warn',
    plugins: [VitePWA({ registerType: 'autoUpdate', manifest: { name: 'game-build fixture', short_name: 'fixture', lang: 'pt-BR', scope: './', start_url: './' } })],
    build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  },
});
