// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BUILD OF BOTH TARGETS OF A GAME — published as `@the-inclusionist/engine/build` (ADR-0253, ADR-0140 §1).
//
// ========================= WHAT A GAME WRITES =========================
// Its `vite.config.ts` wraps the config it already has and names its cartridge's entry — one declaration:
//
//     import { defineGameBuild } from '@the-inclusionist/engine/build';
//     export default defineGameBuild({ cartridge: 'src/index.ts', config: { root: 'app', plugins: [VitePWA({ … })], … } });
//
//   · `vite build`                  → the APP: the game's own config, untouched — the standalone PWA with the engine bundled.
//   · `vite build --mode cartridge` → the CARTRIDGE: `dist-lib/cartridge.js` + `dist-lib/cartridge.d.ts`, the engine and the
//                                     shared render libraries external. Everything else in the game's config (plugins,
//                                     `define`, `resolve`, `css`) still applies, so a plugin both targets need is written once.
//
// ========================= WHY THE ENGINE OWNS THE CARTRIDGE AND NOT THE APP =========================
// Measured on 2026-09-27, before this existed: five of seven games declared a `build:lib`, each differently — a mode, a second
// config file, an npm lifecycle variable, an environment variable, a script — and one had none. What they were all writing is
// the same four decisions, and each is the engine's to make, because each is about what the PLATFORM receives:
//   1. the engine, PixiJS and Zdog stay EXTERNAL, matched as PREFIXES — an exact string externalises the bare name and silently
//      inlines every subpath, which is how every game imports (the 15-puzzle measured 35 kB turning into 74.5 kB);
//   2. no `public/`: Vite copies it into every build, and a cartridge declares no delivery (ADR-0117) — chess once shipped 7 MB;
//   3. no service worker: the PWA plugin is dropped, since a second worker would claim the platform's origin (ADR-0140 §1);
//   4. types emitted, for the one entry: a platform that cannot type the cartridge has a contract that is a comment.
// The APP stays the game's: its manifest, colours and precache budget are statements about THAT game (ADR-0140 §3).
//
// ⚠️ THIS FILE IMPORTS NO PACKAGE, on purpose. A Vite config is data, so nothing here needs `vite`; the types are emitted with the
// GAME's own `typescript`, resolved from the game's root, because a game builds with its own tools and the engine declares no
// build-time dependency on anyone's behalf (ADR-0119).
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** The Vite mode that builds the cartridge. The app is every other mode, which is what keeps `vite build` and Vitest untouched. */
export const CARTRIDGE_MODE = 'cartridge';

/** Where the cartridge lands, relative to the game's root — one place, so the shared CI and the checker need no argument. */
export const CARTRIDGE_DIR = 'dist-lib';

/** The cartridge's module; its types are `cartridge.d.ts` beside it, and its stylesheet, when it has one, `cartridge.css`. */
export const CARTRIDGE_FILE = 'cartridge.js';

/**
 * What a cartridge never carries: the engine and the shared render libraries of ADR-0140 §4. A platform installs ONE of each for
 * every game, and one bundled into a cartridge is a second copy of its module state — two blind-mode flags, two dictionary
 * tables, two random streams on one page.
 */
export const CARTRIDGE_EXTERNAL = [/^@the-inclusionist\/engine(\/|$)/, /^pixi\.js(\/|$)/, /^zdog(\/|$)/];

/**
 * THE ONE DECLARATION. `cartridge` is the entry, relative to the game's root (where `package.json` is and where npm and CI run);
 * `config` is the game's Vite config for the app, an object or a function of Vite's `env`, exactly as it was written before.
 */
export function defineGameBuild({ cartridge, config } = {}) {
  if (typeof cartridge !== 'string' || !cartridge.trim()) {
    throw new Error('defineGameBuild: `cartridge` must name the cartridge entry, e.g. "src/index.ts" - it is the one thing the engine cannot guess (ADR-0253)');
  }
  return async (env) => {
    const app = (typeof config === 'function' ? await config(env) : config) ?? {};
    return env.mode === CARTRIDGE_MODE ? cartridgeConfig(app, cartridge, process.cwd()) : app;
  };
}

/** The app's config turned into the cartridge's: the game's settings, with the four decisions above laid over them. */
function cartridgeConfig(app, cartridge, root) {
  const entry = resolve(root, cartridge);
  return {
    ...app,
    publicDir: false,
    plugins: [...withoutServiceWorker(app.plugins), cartridgeTypes(entry, root)],
    build: {
      outDir: join(root, CARTRIDGE_DIR),
      emptyOutDir: true,
      target: 'es2022',
      lib: { entry, formats: ['es'], fileName: () => CARTRIDGE_FILE, cssFileName: 'cartridge' },
      rolldownOptions: { external: CARTRIDGE_EXTERNAL },
    },
  };
}

/**
 * The game's plugins minus `vite-plugin-pwa` (every plugin it registers is named `vite-plugin-pwa` or `vite-plugin-pwa:…`).
 * Arrays are flattened, because `VitePWA()` returns one; a plugin that is still a promise is kept, since its name is unknown.
 */
function withoutServiceWorker(plugins) {
  return [plugins ?? []].flat(Infinity).filter((p) => !(p && typeof p === 'object' && /^vite-plugin-pwa(:|$)/.test(String(p.name ?? ''))));
}

/** The plugin that writes the cartridge's types once the bundle is on disk. */
function cartridgeTypes(entry, root) {
  return { name: 'inclusionist:cartridge-types', apply: 'build', writeBundle: () => emitCartridgeTypes(entry, root) };
}

/**
 * THE TYPES OF THE CARTRIDGE, from the game's own `tsconfig.json`, for the entry's import graph and nothing else — the tests and
 * the standalone shell are not reached from the entry, so they are not published (a platform would be invited to call the shell).
 *
 * ⚠️ `.ts` SPECIFIERS ARE REWRITTEN TO `.js` IN THE EMITTED `.d.ts`. The games import `./board.ts` with the extension, and
 * TypeScript 5.9 keeps a type-only re-export's specifier as written (measured in `game-2048`): a consumer resolving it finds no
 * `.ts`, and the package installs cleanly with no types.
 */
function emitCartridgeTypes(entry, root) {
  const ts = createRequire(join(root, 'package.json'))('typescript');
  const configPath = join(root, 'tsconfig.json');
  if (!existsSync(configPath)) throw new Error(`cartridge types: there is no tsconfig.json in ${root} - the cartridge's types are emitted with the game's own settings`);
  const host = { getCanonicalFileName: (f) => f, getCurrentDirectory: () => root, getNewLine: () => '\n' };
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(`cartridge types: ${ts.formatDiagnostics([d], host)}`); },
  });
  const outDir = join(root, CARTRIDGE_DIR, 'types');
  const options = {
    ...parsed.options,
    noEmit: false, declaration: true, emitDeclarationOnly: true, declarationMap: false, sourceMap: false,
    inlineSourceMap: false, composite: false, incremental: false, tsBuildInfoFile: undefined, noEmitOnError: false,
    outDir, rootDir: root,
  };
  const program = ts.createProgram({ rootNames: [entry], options });
  const result = program.emit();
  const failures = [...program.getOptionsDiagnostics(), ...result.diagnostics];
  if (failures.length) throw new Error(`cartridge types: ${ts.formatDiagnostics(failures, host)}`);

  for (const file of declarationsUnder(outDir)) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/((?:from|import\()\s*['"])(\.{1,2}\/[^'"]*?)\.([cm]?)ts(['"])/g, '$1$2.$3js$4');
    if (after !== before) writeFileSync(file, after);
  }

  const entryTypes = join(outDir, relative(root, entry)).replace(/\.[cm]?[jt]sx?$/, '.d.ts');
  if (!existsSync(entryTypes)) throw new Error(`cartridge types: TypeScript emitted no declaration for ${relative(root, entry)}`);
  const from = './' + relative(join(root, CARTRIDGE_DIR), entryTypes).split(sep).join('/').replace(/\.d\.ts$/, '.js');
  const hasDefault = /\bexport\s+default\b|\bas\s+default\b/.test(readFileSync(entryTypes, 'utf8'));
  writeFileSync(join(root, CARTRIDGE_DIR, 'cartridge.d.ts'),
    `export * from '${from}';\n${hasDefault ? `export { default } from '${from}';\n` : ''}`);
}

/** Every `.d.ts` under a folder, at any depth. */
function declarationsUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return declarationsUnder(path);
    return path.endsWith('.d.ts') ? [path] : [];
  });
}
