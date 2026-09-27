// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE BUILDS BOTH TARGETS OF A GAME, AND ITS CHECKER HOLDS THE CARTRIDGE TO THE BOOT'S OWN CONTRACT (ADR-0253).
//
// The fixture game `tests/fixtures/game-build` is a game that adopted the engine's build: its `vite.config.ts` wraps its app config
// in `defineGameBuild` and names its cartridge's entry. The builds run ONCE, in `beforeAll`, through Vite's own command line in the
// fixture's folder — the way a game's npm script and the shared CI run them — and every case reads what landed on disk. About five
// seconds on the Dev's machine for both, so the proof is the real build and not a stand-in for it.
//
// ⚠️ THE ENGINE IS RESOLVED BY ITS OWN NAME: the fixture sits inside this package, so `@the-inclusionist/engine/…` is Node's and
// Vite's package self-reference, landing in `dist-pkg/` exactly as a game's lands in `node_modules`. So `npm run build:pkg` must
// have run, which `prepare` does on every `npm ci`.
//
// MUTATIONS CHECKED (2026-09-27), each restored from a copy in the scratchpad:
//   · `CARTRIDGE_EXTERNAL` narrowed to the exact string '@the-inclusionist/engine' → the external case RED (the subpath inlined:
//     no bare specifier, and the contract's own sentence inside the cartridge);
//   · `publicDir: false` removed → the no-delivery case RED;
//   · the PWA filter disabled → the no-service-worker case RED;
//   · the types plugin left out → the types case RED;
//   · `cartridgeRefusals` made to drop `conformanceProblems`' lines (then `build:pkg`) → the broken-variant case and the
//     same-list case RED;
//   · the checker's default export read as the module namespace → the no-default case RED (and the accepting one);
//   · the checker's missing-file branch disabled → the never-built case RED;
//   · the import's error rethrown instead of reported → the import-needs-a-page case RED.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'game-build');
const APP = join(FIXTURE, 'dist');
const CARTRIDGE = join(FIXTURE, 'dist-lib');
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const CHECKER = join(ROOT, 'scripts', 'check-cartridge.mjs');

/** Runs a Node program; the result's `status`, `stdout` and `stderr` are what a CI log would show. */
const node = (args, cwd = ROOT) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });

/** Every file under a folder, at any depth. */
const filesUnder = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? filesUnder(path) : [path];
});

/** The JavaScript a target emitted, concatenated. */
const javascriptOf = (dir) => filesUnder(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');

/** A sentence only `core/contract.conformanceProblems` holds: it appears in a bundle iff the engine's module is INSIDE it. */
const ENGINE_CODE = 'topology: missing';
/** The engine named at a module's edge, for whoever installs it to resolve. */
const ENGINE_IMPORT = /\bfrom\s*["']@the-inclusionist\/engine\/core\/contract\.js["']/;

const clean = () => { for (const dir of [APP, CARTRIDGE]) rmSync(dir, { recursive: true, force: true }); };

beforeAll(() => {
  if (!existsSync(join(ROOT, 'dist-pkg', 'boot', 'create-game.js'))) throw new Error('dist-pkg/ is missing: run `npm run build:pkg` first');
  clean();
  for (const mode of [[], ['--mode', 'cartridge']]) {
    const r = node([VITE, 'build', ...mode], FIXTURE);
    if (r.status !== 0) throw new Error(`vite build ${mode.join(' ')} failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
}, 120_000);

afterAll(clean);

describe('the CARTRIDGE target — `vite build --mode cartridge`', () => {
  it('[Right] lands in dist-lib/cartridge.js, where the checker and the shared CI look', () => {
    expect(existsSync(join(CARTRIDGE, 'cartridge.js'))).toBe(true);
    expect(existsSync(join(APP, 'index.html')), 'the app build came first and must be untouched').toBe(true);
  });

  it('🔴 [Right] the engine stays EXTERNAL: its import survives at the edge, and its code is not inside', () => {
    const js = javascriptOf(CARTRIDGE);
    expect(js, 'no bare engine specifier — the engine was inlined').toMatch(ENGINE_IMPORT);
    expect(js.includes(ENGINE_CODE), 'the contract module\'s own sentence is inside the cartridge').toBe(false);
  });

  it('[Zero] declares no delivery: the app\'s public/ is not copied (ADR-0117)', () => {
    const names = filesUnder(CARTRIDGE).map((f) => f.slice(CARTRIDGE.length + 1).split('\\').join('/'));
    expect(names).not.toContain('delivery.txt');
  });

  it('[Zero] carries no service worker and no manifest: the PWA plugin is the app\'s alone (ADR-0140 §1)', () => {
    const names = filesUnder(CARTRIDGE).map((f) => f.slice(CARTRIDGE.length + 1));
    expect(names.filter((n) => /sw\.js$|workbox|manifest\.webmanifest|registerSW/.test(n))).toEqual([]);
  });

  it('[Right] emits types for the entry\'s graph, with a stable `cartridge.d.ts` that re-exports the default', () => {
    const stub = readFileSync(join(CARTRIDGE, 'cartridge.d.ts'), 'utf8');
    expect(stub).toContain("export * from './types/src/index.js';");
    expect(stub).toContain("export { default } from './types/src/index.js';");
    expect(readFileSync(join(CARTRIDGE, 'types', 'src', 'index.d.ts'), 'utf8')).toMatch(/export default cartridge/);
    // the standalone shell is not reached from the entry, so a platform is never offered its types
    expect(existsSync(join(CARTRIDGE, 'types', 'app'))).toBe(false);
  });
});

describe('the APP target — `vite build`, the game\'s own config', () => {
  it('🔴 [Right] BUNDLES the engine: its code is inside, and nothing is left for anyone to resolve', () => {
    const js = javascriptOf(APP);
    expect(js.includes(ENGINE_CODE), 'the engine is missing from the standalone app').toBe(true);
    expect(js).not.toMatch(/["']@the-inclusionist\/engine/);
  });

  it('[Right] stays the standalone PWA: a service worker, a manifest and the public/ files (ADR-0140 gate 3)', () => {
    for (const f of ['sw.js', 'manifest.webmanifest', 'delivery.txt', 'index.html']) expect(existsSync(join(APP, f)), f).toBe(true);
  });
});

describe('`inclusionist-check-cartridge` — the boot\'s refusals over a built cartridge', () => {
  it('[Right] accepts the fixture, whose contract holds', () => {
    const r = node([CHECKER, join(CARTRIDGE, 'cartridge.js')]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("the engine's contract holds");
  });

  it('🔴 [Wrong] refuses a built cartridge with a REQUIRED declaration field missing, naming it and its fix', () => {
    writeFileSync(join(CARTRIDGE, 'broken.js'),
      "import good from './cartridge.js';\nconst { holdsKeys, ...declaration } = good.declaration;\nexport default { ...good, declaration };\n");
    const r = node([CHECKER, join(CARTRIDGE, 'broken.js')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/· holdsKeys: missing - declare whether any key is HELD/);
    expect(r.stderr.match(/^ {2}· /gm), 'one field missing is one line').toHaveLength(1);
  });

  it('[Right] its lines ARE the boot\'s: the same list `createGame` throws with, not a copy of it', async () => {
    const { cartridgeRefusals } = await import('../app/js/boot/create-game.js');
    const { default: good } = await import('./fixtures/game-build/src/index.ts');
    const { holdsKeys: _dropped, ...declaration } = good.declaration;
    expect(cartridgeRefusals(good.declaration, good.hooks)).toEqual([]);
    const lines = cartridgeRefusals(declaration, good.hooks);
    expect(lines).toHaveLength(1);
    const r = node([CHECKER, join(CARTRIDGE, 'broken.js')]);
    expect(r.stderr).toContain(`· ${lines[0]}`);
  });

  it('[Boundary] a cartridge without hooks is refused for its unanswered accommodations (ADR-0153), before anything mounts', () => {
    writeFileSync(join(CARTRIDGE, 'no-hooks.js'),
      "import good from './cartridge.js';\nexport default { ...good, hooks: undefined };\n");
    const r = node([CHECKER, join(CARTRIDGE, 'no-hooks.js')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/· accommodations: missing - the cartridge must answer/);
  });

  it('[Wrong] refuses an entry with no default export — the shape ADR-0139 §2 names', () => {
    writeFileSync(join(CARTRIDGE, 'named-only.js'), "export { default as cartridge } from './cartridge.js';\n");
    const r = node([CHECKER, join(CARTRIDGE, 'named-only.js')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/· default export: missing/);
  });

  it('[Wrong] refuses a cartridge whose IMPORT needs a page: nothing runs before create(ctx) (ADR-0139 §2)', () => {
    writeFileSync(join(CARTRIDGE, 'page-at-import.js'),
      "import good from './cartridge.js';\ndocument.title = 'mine';\nexport default good;\n");
    const r = node([CHECKER, join(CARTRIDGE, 'page-at-import.js')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/· importing the cartridge threw: document is not defined - a cartridge runs nothing until create\(ctx\)/);
  });

  it('[Zero] refuses a game that never built its cartridge with the engine, and says how to adopt it', () => {
    const r = node([CHECKER, join(CARTRIDGE, 'not-built.js')]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/not-built\.js: missing - this game does not build its cartridge with the engine's build: wrap vite\.config in defineGameBuild/);
  });
});
