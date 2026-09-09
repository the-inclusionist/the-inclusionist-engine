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
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';

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

/* ===================== THIRD QUESTION: is the FLOOR actually a floor? =====================
 *
 * The two questions above are both about entries that ARE in the manifest — can they be updated, and do the
 * pages among them survive the SPA fallback. Neither one can see a file that never got in. That gap is the
 * gate ADR-0114 asks for in writing: «AND THE FLOOR IS ASSERTED AS A FLOOR … without it, "offline works"
 * degrades one convenient exclusion at a time and nobody notices until a school does».
 *
 * 📏 MEASURED ON 2026-09-09, and the two ways a file leaves the manifest are NOT the same failure:
 *
 *   · TOO BIG for `maximumFileSizeToCacheInBytes` — NOT silent. A 33 MB `.wasm` planted under `app/public/`
 *     makes `vite-plugin-pwa` throw `PLUGIN_ERROR` and the build exits 1. This gate is belt and braces there.
 *   · EXTENSION OUTSIDE `globPatterns` — COMPLETELY SILENT. A 2 KB `sonda.data` planted the same way reached
 *     `dist/`, stayed out of the manifest, and the build AND this gate both exited 0.
 *
 * ⚠️ AND THE SILENT ONE IS THE CASE THE NEXT COMMIT WILL HIT. The runtime ADR-0114 decided to vendor is, if
 * it is the piper/ort pair measured for issue #129, `ort-wasm-simd-threaded.wasm` (12.9 MB) plus
 * `piper_phonemize.data` (18.1 MB) — and `data` is not in `globPatterns`. The single biggest artefact of the
 * offline voice would land in `dist`, never enter the precache, and a school with no network would get a
 * child who presses the speech button and hears nothing, with every gate green.
 *
 * So the rule is stated as COMPLETENESS and not as a list of things to look for: every file the build emits
 * is either precached or EXCUSED HERE, in writing. A new extension, a narrowed `globPatterns` or a dropped
 * file all fail the same way — by not being either. */
const DIST = dirname(SW);

/**
 * The only files that may sit in `dist` and outside the precache. Each one carries the reason by hand,
 * because a list of exceptions nobody has to justify is how a floor is lowered one entry at a time.
 *
 * ⚠️ An entry that matches NOTHING also fails, below: the list has to SHRINK when its reason dies, or it
 * becomes a monument that quietly excuses whatever grows into its shape.
 */
const FORA_DO_PRECACHE = [
  {
    padrao: /^sw\.js$/,
    porque: 'the service worker itself — it cannot precache the file it is',
  },
  {
    padrao: /^workbox-[A-Za-z0-9]+\.js$/,
    porque: 'the Workbox runtime, loaded by `importScripts` from inside the SW scope, not fetched by the page',
  },
  {
    padrao: /^_headers$/,
    porque: 'a host deploy directive (Cloudflare Pages) read by the SERVER — the browser never requests it',
  },
];

function emitidos(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) { out.push(...emitidos(p)); continue; }
    out.push(relative(DIST, p).split(sep).join('/'));
  }
  return out;
}

const noDisco = emitidos(DIST);
const urls = new Set(entradas.map((e) => e.url));
const excusado = (u) => FORA_DO_PRECACHE.some((x) => x.padrao.test(u));

/* ⚠️ VACUUM GUARD, and the first one written here could not fire: `dist` cannot be empty when `sw.js` was
 * just read out of it. The reachable emptiness is the OTHER one — a completeness check whose exclusions have
 * grown to cover everything passes while precaching nothing, which is this repository's blind-sieve failure
 * wearing a floor's clothes. Widen any pattern below to `/./` and it is this line that says so. */
if (noDisco.every(excusado)) {
  console.error(`precache gate: every file in ${DIST} is excused — the exclusions cover the whole build.`);
  console.error('A completeness check that excuses everything reports a floor it never looked at.');
  process.exit(1);
}

const inuteis = FORA_DO_PRECACHE.filter((x) => !noDisco.some((u) => x.padrao.test(u)));

if (inuteis.length > 0) {
  console.error(`precache gate: ${inuteis.length} exclusion(s) match no file the build emits:\n`);
  for (const x of inuteis) console.error(`  · ${x.padrao}  —  "${x.porque}"`);
  console.error('\nThe reason it was written for is gone. Delete the entry rather than leaving it to excuse');
  console.error('whatever grows into its shape later.');
  process.exit(1);
}

const semPrecache = noDisco.filter((u) => !urls.has(u) && !excusado(u));

if (semPrecache.length > 0) {
  console.error(`precache gate: ${semPrecache.length} file(s) shipped in ${DIST} but NOT precached:\n`);
  for (const u of semPrecache) {
    const kib = (statSync(join(DIST, u)).size / 1024).toFixed(1);
    console.error(`  · ${u}  (${kib} KiB)`);
  }
  console.error('\nA machine that has never had a network will not have these. If the file is needed offline,');
  console.error('add its extension to `globPatterns` in vite.config.ts; if it is genuinely not, excuse it in');
  console.error('FORA_DO_PRECACHE above WITH THE REASON — silence is what lowers the floor.');
  process.exit(1);
}

const semHash = entradas.filter((e) => e.revisao !== null).length;
const nota = paginas.length ? ` ${paginas.length} extra page(s) excluded from the SPA fallback.` : '';
const piso = ` Floor complete: ${noDisco.length} file(s) emitted, ${FORA_DO_PRECACHE.length} excused by name.`;
console.log(`precache gate: ${entradas.length} entries — ${semHash} with a content revision, ${entradas.length - semHash} hash-named. None frozen.${nota}${piso}`);
