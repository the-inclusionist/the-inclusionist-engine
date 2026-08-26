// SPDX-License-Identifier: AGPL-3.0-or-later
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

/* ===================== SECOND QUESTION: does every real PAGE survive the SPA fallback? =====================
 *
 * `generateSW` registers a `NavigationRoute` that answers EVERY navigation with the precached shell
 * (`index.html`). For a single-page game that is right — it is what makes a deep link open the game. But this
 * build emits more than one page on purpose: the game, and the SECOND CONSUMER of ADR-0027 step 6, which
 * exists to MEASURE the engine↔game boundary. An instrument that is built and then unreachable in production
 * measures nothing.
 *
 * Today the extra page survives because the precache route matches its URL BEFORE the navigation catch-all.
 * That is route ORDER, not a guarantee: let the page be missing from the manifest for an instant — an old
 * service worker, a partial precache, an update in flight — and the navigation falls into the game's shell.
 * Issue #73 recorded exactly that symptom on 2026-08-25.
 *
 * So the rule is stated positively and checked here: EVERY precached page other than the shell must be in
 * `navigateFallbackDenylist`. Written as a rule and not as a list, so a third page gets the protection or
 * this gate goes red. */
const SHELL = 'index.html';
const paginas = entradas.map((e) => e.url).filter((u) => u.endsWith('.html') && u !== SHELL);

const denylist = (fonte.match(/denylist:\[([^\]]*)\]/) || [, ''])[1];
// Compara o NOME CRU do arquivo dentro do texto do denylist. A regex do denylist escapa o ponto
// (`quiz\.html`), então procurar `quiz` e `.html` separadamente é o que sobrevive a qualquer escape.
const desprotegidas = paginas.filter((u) => { const base = u.replace(/\.html$/, ''); return !(denylist.includes(base) && denylist.includes('html')); });

if (desprotegidas.length > 0) {
  console.error(`precache gate: ${desprotegidas.length} page(s) precached but NOT excluded from the SPA fallback:`);
  for (const u of desprotegidas) console.error(`  · ${u}`);
  console.error('');
  console.error('A navigation to these can be answered with index.html — the page is built and then invisible.');
  console.error('Add it to `navigateFallbackDenylist` in vite.config.ts (see issue #73).');
  process.exit(1);
}

const semHash = entradas.filter((e) => e.revisao !== null).length;
const nota = paginas.length ? ` ${paginas.length} extra page(s) excluded from the SPA fallback.` : '';
console.log(`precache gate: ${entradas.length} entries — ${semHash} with a content revision, ${entradas.length - semHash} hash-named. None frozen.${nota}`);
