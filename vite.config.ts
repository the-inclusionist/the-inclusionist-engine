import { defineConfig } from 'vitest/config'; // (not from 'vite': vitest/config is what types the `test` field)
import { VitePWA } from 'vite-plugin-pwa';
import { playwright } from '@vitest/browser-playwright'; // Vitest 4: the provider became a factory from its own package
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { deliveryCacheKey } from './app/js/platform/heavy.js'; // the `heavy/` route's cache key (issue #173)
// a page's precache revision carries the hash of `_headers`, so a header change refreshes it (issue #186)
import { hashDosCabecalhos, revisarPaginasPelosCabecalhos } from './scripts/page-revisions.mjs';
// ⚠️ NO ATLAS PLUGIN IS IMPORTED HERE: it left with the cartridge (issue #111). It generated `virtual:sprite-atlas`,
// which only `render/sprites` imported — and `render/sprites` was not engine: `tsconfig.pkg.json` already kept it out
// of the package in writing. Both live in `game-platformer` now, together with `scripts/atlas.mjs`.


// ========================= BUILD STAMP (docs/2-Architecture/plan-versioning.md) =========================
// THE VERSION COMES FROM `package.json`, not from `git describe`. `git describe --tags` only returns a version when a
// TAG IS REACHABLE, and a shallow CI clone or a tagless copy has none: `--always` then falls back to the short SHA, and
// the title showed `vbbfa193` instead of the real version (it did, before the first release tag existed).
// `package.json` states the version, is VERSIONED, and reaches every clone: shallow, tagless, on a CI builder,
// anywhere. It cannot be missing.
//
// `git describe` stays, and keeps doing what it is good at: saying whether this build matches a published version or
// not. The `+<sha>` suffix appears when the build is AHEAD of the version's tag, and `-dirty` when there are
// uncommitted changes — and that warning matters: an artefact marked `-dirty` matches no commit, and cannot be asked
// for again.
//
// semver's build-metadata syntax (`6.36.1+bbfa193`), which is the right place for it.
//
// Fallbacks: without git, `CF_PAGES_COMMIT_SHA` (a Cloudflare Pages build) is what is left; without it, 'dev'.
const sh = (cmd: string): string => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const cfSha = (process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);
const RAIZ_REPO = dirname(fileURLToPath(import.meta.url));
const versaoDoPacote = ((): string => {
  try { return String(JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8')).version || ''); } catch { return ''; }
})();
const descricaoGit = sh('git describe --tags --always --dirty'); // vX.Y.Z · vX.Y.Z-3-gabc1234 · abc1234-dirty
const shaCurto = sh('git rev-parse --short HEAD') || cfSha || 'dev';
/** `6.36.1` on a release build; `6.36.1+bbfa193` ahead of it; `+bbfa193-dirty` with a dirty tree. */
const versaoDeExibicao = ((): string => {
  if (!versaoDoPacote) return descricaoGit || cfSha || 'dev';        // no readable package.json: whatever there is
  if (descricaoGit === 'v' + versaoDoPacote) return versaoDoPacote;   // exactly on this version's tag
  const sujo = descricaoGit.endsWith('-dirty') ? '-dirty' : '';
  return versaoDoPacote + '+' + shaCurto + sujo;
})();
const BUILD = {
  version: versaoDeExibicao,
  sha: shaCurto,
  date: sh('git log -1 --format=%cd --date=short') || '', // the COMMIT's date (stable across rebuilds of the same commit)
  env: process.env.CF_PAGES ? 'prod' : 'local',
};

// TS+Vite (docs/2-Architecture/plan-typescript-vite.md). root=app/, where the page (`quiz.html`) lives, for dev and build.
// PWA: vite-plugin-pwa generates the service worker (Workbox) and the manifest. Shell and assets are precached by
// CONTENT HASH → the cache invalidates itself; registerType 'autoUpdate' applies the new version on the next load
// (a stale build cannot stay stuck, by construction).
// The TEST config lives here too (Vitest 3 deprecated the workspace → test.projects; each project uses the repo root).
export default defineConfig({
  root: 'app',
  define: { __BUILD__: JSON.stringify(BUILD) }, // build stamp (version/sha/date/env), declared in `app/js/env.d.ts`; since `main.ts` left with the cartridge (#111) no module here reads it
  plugins: [
    // VitePWA is the only plugin: the sprite atlas that stood here left with the cartridge (see the note at the top).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // the plugin injects the service worker's registration into the built page (offline)
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'The Inclusionist',
        short_name: 'Inclusionist',
        description: 'Demonstração da engine The Inclusionist: um quiz acessível (WCAG 2.2 + GAG).', // the manifest's language is the demo's base language, pt-BR (a manifest is not localised per locale)
        lang: 'pt-BR',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#0b1020',
        theme_color: '#0b1020',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        // precaches EVERYTHING the page uses offline: the bundle (js/css/html), images (png/svg), fonts (woff2), text and data
// (txt/json) and the manifest. The pixi chunk (~445 KB) is far below Workbox's default 2 MB ceiling.
// `wasm` and the ceiling below were added so the neural TTS runtime (sherpa-onnx/ort, ~25.6 MB) was PRECACHED. Without
// them the file stayed out of the PWA cache — and out of `runtimeCaching` too — so it depended on the ordinary HTTP
// cache, which the browser evicts when it likes: in a school lab with restored machines the neural voice simply did
// not load offline (pillar 8). The per-file ceiling rises with it because Workbox's default is 2 MB: adding the
// extension alone would make it SKIP the file with a warning, and the symptom would be identical. Since ADR-0216 that
// runtime comes from `heavy/` (the route below); the extension and the ceiling stay for any WebAssembly a page emits,
// for the same reason as `mjs`:
        // `mjs`: a module a worker loads by URL. onnxruntime's thread script is no longer one of them — since ADR-0216 it comes
        // from `heavy/`, which the delivery fills and the rule below caches — but the extension stays: a page that emits one and
        // leaves it outside the precache loses it offline, and the symptom is a feature that simply never starts.
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2,txt,json,webmanifest,wasm}'],
        // 🔴 NOT the free Libras player's stage (ADR-0234 errata, route B): it carries three.js, 627 KB, and the decision that let
        // three.js in is that only a child whose deaf mode signs downloads it — a precache entry is downloaded by every install.
        // `tests/three-arrives-late.node.test.js` holds this line. Deaf mode keeps it offline instead: the delivery lists it
        // (`libras/offline-avatar.json`) and the Libras route below answers it from the checked cache (phase B3).
        globIgnores: ['**/libras-avatar-stage-*.js'],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024, // 32 MB: room for a 25.6 MB runtime with margin
        cleanupOutdatedCaches: true,
        // The precache keeps a page's whole response, headers included (measured: COOP, COEP and CSP on the cached `quiz.html`);
        // its revision hashed only the file, so a changed `_headers` never reached an install (ADR-0192, issue #186).
        manifestTransforms: [async (entradas) => revisarPaginasPelosCabecalhos(entradas, hashDosCabecalhos(readFileSync(join(RAIZ_REPO, 'app', 'public', '_headers'), 'utf8')))],
        runtimeCaching: [
          // The delivery's own `heavy/` (ADR-0177, issue #173): what a page asks at the delivery path — Kokoro's model
          // and voices, and the runtime that speaks them (ADR-0216) — is answered from the checked cache, where the fetcher keeps it under the upstream address. On a miss
          // the request goes to this origin, never a third party; the fetcher's own download passes through the same way.
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.includes('/heavy/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'incl-pesados-v2',
              cacheableResponse: { statuses: [200] },
              // the key is never null here: the pattern above already admits `heavy/` paths only
              plugins: [{ cacheWillUpdate: async () => null, cacheKeyWillBeUsed: deliveryCacheKey as unknown as (p: { request: Request }) => Promise<string> }],
            },
          },
          // The Libras player's files a delivery writes after the build, outside the precache (ADR-0234, pillar 8): the avatar, its
          // clips, their manifest and the glosses (`--libras`), and the stage chunk with three.js, which the precache leaves out on
          // purpose. Answered from the checked cache, where the start keeps each file the delivery's list names, checked, under its
          // own address — the key is the request's. On a miss the request goes to this origin, so the player works online before
          // its list has come down; nothing is written here. The list itself (`libras/offline-avatar.json`) is outside the folder
          // and always goes to the network. ⚠️ The chunk is matched by its NAME alone, never by `assets/`: every other asset is the
          // precache's, and its route answers them first. The places are `DELIVERY_LISTS`'s, written out because the plugin copies
          // this function's source into `sw.js`, where no import exists.
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && (/\/libras\/avatar\/[^/]/.test(url.pathname) || /\/assets\/libras-avatar-stage-[\w-]+\.js$/.test(url.pathname)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'incl-pesados-v2',
              cacheableResponse: { statuses: [200] },
              plugins: [{ cacheWillUpdate: async () => null }],
            },
          },
          // The pinned RUNTIME (MediaPipe), for the same reason and with the same cache: the fetcher brings it down at install,
// and without a route its `import()` would go to the network again. ⚠️ The reach is by PACKAGE and not by domain — the
// whole of `cdn.jsdelivr.net` would be the wide door #119 closed.
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/tasks-vision@/, // the voice runtime left the catalogue (ADR-0184)
            handler: 'CacheOnly',
            options: {
              cacheName: 'incl-pesados-v2',
              cacheableResponse: { statuses: [200] },
              // #168: the route READS the checked cache and never WRITES it — only `platform/heavy` writes, after the sha256.
              // Without this a library request that came first would be cached unchecked, and the fetcher would then trust it.
              plugins: [{ cacheWillUpdate: async () => null }],
            },
          },
        ],
        // ART THAT NEVER UPDATES AGAIN, and nobody would see it: vite-plugin-pwa's default is
// `dontCacheBustURLsMatching = /^assets/` — it assumes EVERYTHING under `assets/` has a hash in its name, which holds
// for what Vite emits and does NOT hold for `app/public/assets/**`, copied verbatim. Such a file enters the precache
// with `revision: null`, and `revision: null` means "the hash is in the name": Workbox stores it once and never fetches
// it again. Changing the art would leave the child with the old art forever — and in a school lab that is exactly the
// cache that survives. (It happened to the platformer's character sprites, backgrounds and map while they lived here.)
// The pattern below matches ONLY what Vite really hashes: ONE segment under `assets/`, ending in `-<hash of 8+>`.
// Everything else gets a revision by CONTENT, which is what makes the cache turn over.
// A possible false positive, accepted: a file of `public/assets/` at its root named `foo-abcdefgh.png` would be read
// as hashed. `scripts/check-precache.mjs` is the gate that watches the result, not the rule.
        dontCacheBustURLsMatching: /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^.]+$/,
        // NO NAVIGATION FALLBACK: the engine builds `quiz.html` alone, and the plugin's default fallback is `index.html`.
        // `createHandlerBoundToURL` throws for a page not in the precache, and the generated `sw.js` runs inside a promise —
        // so the throw was silent, the precache still worked, and NO runtime route below was ever registered (measured
        // 2026-09-13: the models' `CacheOnly` route let a request reach Hugging Face). A cartridge that builds its own
        // single-page shell sets its own fallback. Gate: `tests/service-worker-registers-its-routes.node.test.js`.
        navigateFallback: null,
        // AN OLD DEMO LINK IS NOT ANOTHER PAGE: `quiz.html?libras=avatar` chose the free Libras player while it was not yet the
        // engine's (ADR-0234, route B); the page now ignores it, and the precache matches a navigation by its whole address — so
        // without this the page it is precached under, `quiz.html`, is never found for such a link, and offline it does not open
        // (📏 measured 2026-09-25: `ERR_INTERNET_DISCONNECTED`). `libras` is ignored when matching, beside Workbox's own two
        // defaults, which setting this replaces and so are written again.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^libras$/],
      },
      // The PWA is OFF in dev (the default) — no service worker or cache getting in the HMR's way; test with `npm run build` + `preview`.
    }),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    // PixiJS (~445KB) in its OWN chunk (Vite 8/rolldown: output.codeSplitting.groups). Reason: the renderer almost never
// changes, the page's own code changes with every commit. With pixi apart, its hash stays stable across deploys → the
// Workbox precache does NOT download the 445KB again on every update (only the small chunk does) — a real bandwidth
// gain for the offline/weak-machine pillar. Side effect: both chunks stay < 500KB → no size warning.
    rolldownOptions: {
      // ONE page: the SECOND CONSUMER (ADR-0027 step 6). It lives here, and not in `rollupOptions`, because this project
// builds with ROLLDOWN — the rollup field is ignored silently, and the only symptom is a `dist/quiz.html` that does
// not appear. The consumer exists to measure the engine↔game boundary, and a consumer that is not really built
// measures nothing.
      input: { quiz: 'app/quiz.html' }, // ⚠️ `main` left with the cartridge (#111): the engine has no app of its own
      output: {
        // The MIT and similar licences travel with the code they cover: a bundled library's `@license` comment stays in its
        // chunk (three.js: two in the free Libras player's chunk). Without this line the minifier strips them and the delivery
        // carries the code without the notice its licence requires. Gate: `tests/three-arrives-late.node.test.js`.
        comments: { legal: true },
        codeSplitting: {
          groups: [
            { name: 'pixi', test: /node_modules[\\/](@pixi|pixi\.js)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        // pure logic (fast, no browser)
        root: import.meta.dirname,
        // NO PLUGIN HERE, and none is needed: the test projects do NOT inherit the top-level plugins, which mattered while
// `render/sprites` imported the atlas's virtual module — a suite then failed to RESOLVE rather than to assert, the most
// confusing way a suite can break. Both left with the cartridge (#111).
        test: {
          name: 'node',
          environment: 'node',
          // `.ts` is included because of the TYPE tests (ADR-0039): their compile half is checked by `tsc`, but the record
// requires them to run in the command the pipeline already runs, not in a separate ritual — a test nobody runs is
// decoration.
          include: ['tests/**/*.node.test.{js,ts}'],
          setupFiles: ['./vitest.setup.node.js'],
        },
      },
      {
        // render/DOM real via Chromium/Playwright (Vitest 3: browser.instances)
        root: import.meta.dirname,
        test: {
          name: 'browser',
          include: ['tests/**/*.browser.test.js'],
          setupFiles: ['./vitest.setup.browser.js'],
          browser: {
            enabled: true,
            // 🔴 THE BROWSER SPEAKS THE BASE LANGUAGE ON EVERY MACHINE. With nothing stored, a root takes the language the
            // browser reports (`platform/locale-host` → `navigator.language`), and an unpinned Chromium reports the HOST's:
            // pt-BR on the Dev's Windows, en-US on GitHub's runner. The suite's expectations are written in pt-BR, the base
            // language, so the same tree was green here and red in CI (45 cases in 19 files, «expected 'Hearing comfort' to
            // contain 'Conforto auditivo'»). A case that means another language switches it through its engine. Gate:
            // `tests/the-suite-speaks-the-base-language.browser.test.js`.
            provider: playwright({ contextOptions: { locale: 'pt-BR' } }),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
