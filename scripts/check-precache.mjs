// SPDX-License-Identifier: GPL-3.0-or-later
// Precache gate — runs against the BUILT `dist/sw.js`, and answers one question: can every precached file
// ever be updated? Fails (exit 1) when one cannot.
//
// ========================= THE DEFECT THIS EXISTS FOR =========================
// In Workbox's precache manifest, `revision: null` is a CONTRACT, not an absence: it means "this URL carries
// a content hash in its filename, so a changed file arrives under a different URL". When that is true the
// entry updates by cache-busting. When it is false the entry is frozen: the URL never changes, the revision
// never changes, so an installed service worker keeps serving the ORIGINAL bytes forever.
//
// `vite-plugin-pwa` defaults `dontCacheBustURLsMatching` to `/^assets/` — correct for what Vite emits, and
// wrong for `app/public/assets/**`, which is copied verbatim and carries no hash. On 2026-08-25 this project
// had 97 of 141 entries at `revision: null`: every sprite of the character, the three City backdrops and the
// level file. Changing the art would have reached nobody who had installed the PWA — and in a school lab that
// install is exactly what survives the machine being restored.
//
// Nothing in the build complained, and nothing could have: a frozen precache is invisible in the build, in
// the tests and in the browser on the day of the change. It only shows up as a child looking at last term's
// art on a machine nobody can debug.
//
// ========================= WHY A SCRIPT AND NOT A VITEST CASE =========================
// It reads the OUTPUT of a build. A vitest case would either need a build to have happened (a gate that
// silently does nothing on a clean checkout, which is worse than no gate) or would test the config's source
// text instead of its effect. This runs in CI right after `npm run build`, like `scripts/axe-check.mjs`.
//
//   npm run build && node scripts/check-precache.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SW = process.env.SW_PATH || join(process.cwd(), 'dist', 'sw.js');

if (!existsSync(SW)) {
  console.error(`precache gate: ${SW} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const fonte = readFileSync(SW, 'utf8');

/** The manifest as Workbox writes it: `{url:"…",revision:null}` or `{url:"…",revision:"…"}`. */
const entradas = [...fonte.matchAll(/\{url:"([^"]+)",revision:(null|"[^"]*")\}/g)]
  .map(([, url, rev]) => ({ url, revisao: rev === 'null' ? null : rev.slice(1, -1) }));

if (entradas.length === 0) {
  console.error('precache gate: no manifest entry found in sw.js — the parser no longer matches Workbox output.');
  process.exit(1); // failing loudly beats reporting "0 problems" from a broken parser
}

/**
 * Does the URL carry a build hash? One segment under `assets/`, ending in `-<hash of 8+>`.
 *
 * Deliberately the same shape as `dontCacheBustURLsMatching` in `vite.config.ts`, and deliberately DUPLICATED
 * rather than imported: this gate must be able to disagree with the config. If someone widens the config to
 * silence a failure, this file still holds the original claim and the pipeline still goes red.
 */
const temHash = (url) => /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(url);

const congelados = entradas.filter((e) => e.revisao === null && !temHash(e.url));

if (congelados.length > 0) {
  console.error(`precache gate: ${congelados.length} entry(ies) can NEVER be updated — \`revision: null\` on a URL with no build hash:\n`);
  for (const e of congelados) console.error(`  · ${e.url}`);
  console.error('\nAn installed service worker will serve these bytes forever. Fix `dontCacheBustURLsMatching`');
  console.error('in vite.config.ts so the file gets a content revision — do not widen the hash pattern here.');
  process.exit(1);
}

const semHash = entradas.filter((e) => e.revisao !== null).length;
console.log(`precache gate: ${entradas.length} entries — ${semHash} with a content revision, ${entradas.length - semHash} hash-named. None frozen.`);
