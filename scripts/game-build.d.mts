// SPDX-License-Identifier: AGPL-3.0-or-later
// The types of `@the-inclusionist/engine/build` (`scripts/game-build.mjs`, ADR-0253). Written by hand because the module is a
// build script the game's Vite loads in Node, not a module of the engine's browser code that `tsconfig.pkg.json` compiles.
// `vite` is named only as a TYPE: the game has it, since it is what the game builds with.
import type { ConfigEnv, UserConfig, UserConfigFnPromise } from 'vite';

/** The Vite mode that builds the cartridge; every other mode is the app, Vitest's `test` included. */
export declare const CARTRIDGE_MODE: 'cartridge';
/** Where the cartridge lands, relative to the game's root. */
export declare const CARTRIDGE_DIR: 'dist-lib';
/** The cartridge's module inside `CARTRIDGE_DIR`; `cartridge.d.ts` is its types. */
export declare const CARTRIDGE_FILE: 'cartridge.js';
/** The engine and the shared render libraries (ADR-0140 §4): external in the cartridge, as prefixes. */
export declare const CARTRIDGE_EXTERNAL: readonly RegExp[];

export interface GameBuild {
  /** The cartridge's entry, relative to the game's root — e.g. `src/index.ts`. Its default export is the cartridge. */
  readonly cartridge: string;
  /** The game's Vite config for the APP (the standalone PWA), exactly as it would be written without this wrapper. */
  readonly config?: UserConfig | ((env: ConfigEnv) => UserConfig | Promise<UserConfig>);
}

/** The one declaration a game writes: `vite build` builds its app, `vite build --mode cartridge` its cartridge. */
export declare function defineGameBuild(build: GameBuild): UserConfigFnPromise;

