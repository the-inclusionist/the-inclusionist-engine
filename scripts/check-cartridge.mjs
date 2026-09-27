#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CARTRIDGE CHECKER — `inclusionist-check-cartridge [built entry]` (ADR-0253). Default entry: `dist-lib/cartridge.js`, where
// the engine's build (`@the-inclusionist/engine/build`, `vite build --mode cartridge`) puts it.
//
// It IMPORTS the built cartridge and runs on what it exports the SAME list `createGame` and `mount()` refuse a cartridge with —
// `cartridgeRefusals`, from the engine this script ships in. A cartridge that compiles and breaks the contract is refused here,
// in the game's CI, instead of in the platform the day it is installed. One line per problem, in the `problems` shape: the subject
// by name, and the fix.
//
// ⚠️ WHAT IT READS IS ADR-0139 §2's `Cartridge`, as the entry's DEFAULT export: `{ slug, declaration, hooks, create }`. The
// declaration and the hooks are read at import, before `create(ctx)` runs, because that is when `createGame` reads them too.
// ⚠️ AND IT IMPORTS IN NODE, WITH NO PAGE. A cartridge runs nothing until `create(ctx)` (ADR-0139 §2): one whose import needs a
// `document` would already be touching the platform's page when it is merely installed, and the import's error is the line.
//
// Exit codes: 0 the contract holds · 1 the cartridge is refused (the lines say why) · 2 this engine was never built (`dist-pkg/`).
import { existsSync, realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Where the engine's build writes the cartridge — `CARTRIDGE_DIR/CARTRIDGE_FILE` of `game-build.mjs`. */
export const DEFAULT_ENTRY = 'dist-lib/cartridge.js';

/** The compiled composition root of the package this script ships in, which owns the refusals. */
export const REFUSALS_MODULE = new URL('../dist-pkg/boot/create-game.js', import.meta.url);

/**
 * The problems of a built cartridge, EMPTY when it holds. `refusals` is the engine's `cartridgeRefusals`.
 * The four shape lines come first because without them there is nothing to hand the engine's list.
 */
export async function checkCartridge(entryPath, refusals) {
  const shown = shownPath(entryPath);
  if (!existsSync(entryPath)) {
    return [`${shown}: missing - this game does not build its cartridge with the engine's build: wrap vite.config in defineGameBuild from @the-inclusionist/engine/build and run \`vite build --mode cartridge\` (ADR-0253)`];
  }
  let mod;
  try {
    mod = await import(pathToFileURL(entryPath).href);
  } catch (e) {
    return [`importing the cartridge threw: ${messageOf(e)} - a cartridge runs nothing until create(ctx) (ADR-0139 §2), so importing it must need no page`];
  }
  const cartridge = mod.default;
  if (!cartridge || typeof cartridge !== 'object') {
    return ['default export: missing - the built entry exports the cartridge as its default, { slug, declaration, hooks, create } (ADR-0139 §2)'];
  }
  const shape = [];
  if (typeof cartridge.slug !== 'string' || !cartridge.slug.trim()) shape.push('slug: missing - the repository and package name, one word (ADR-0082 §1)');
  if (typeof cartridge.create !== 'function') shape.push('create: must be a function - the shell calls create(ctx) to start the game, and nothing runs before it (ADR-0139 §2)');
  try {
    return [...shape, ...refusals(cartridge.declaration, cartridge.hooks)];
  } catch (e) {
    return [...shape, `the declaration threw while the engine checked it: ${messageOf(e)} - createGame and mount read it at boot, before create(ctx) runs`];
  }
}

/** A path as the reader typed it: relative to where the check runs, with forward slashes on every system. */
const shownPath = (p) => (relative(process.cwd(), p) || p).split(sep).join('/');

const messageOf = (e) => (e instanceof Error ? e.message : String(e));

// Run as a program (directly, or through the `inclusionist-check-cartridge` shim, which may be a symlink): compare real paths.
const run = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (run) {
  if (!existsSync(fileURLToPath(REFUSALS_MODULE))) {
    console.error('dist-pkg/boot/create-game.js is missing beside this script: in the engine repository, run `npm run build:pkg` first');
    process.exit(2);
  }
  const { cartridgeRefusals } = await import(REFUSALS_MODULE.href);
  const entry = resolve(process.argv[2] ?? DEFAULT_ENTRY);
  const problems = await checkCartridge(entry, cartridgeRefusals);
  const shown = shownPath(entry);
  if (problems.length) {
    console.error(`✗ cartridge ${shown}: ${problems.length} problem(s) — createGame and mount would refuse it (ADR-0253):`);
    for (const p of problems) console.error(`  · ${p}`);
    process.exit(1);
  }
  console.log(`✓ cartridge ${shown}: the engine's contract holds.`);
}
