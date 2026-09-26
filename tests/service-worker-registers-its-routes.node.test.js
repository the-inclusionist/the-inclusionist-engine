// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SERVICE WORKER REGISTERS ITS RUNTIME ROUTES — its navigation fallback names a page the build emits.
//
// 🔴 Measured on 2026-09-13 in the engine's dist: a request to a missing Hugging Face model reached Hugging Face (their 404,
// their headers) instead of failing in the `CacheOnly` route, and the delivery's `heavy/` route never answered from the
// cache. The generated `sw.js` runs its routes inside the `define(...)` promise: `precacheAndRoute`, then
// `createHandlerBoundToURL("index.html")` — the plugin's default fallback — which THROWS when `index.html` is not precached.
// Inside a promise the throw is a silent rejection: the worker installs, the precache works, and every runtime route after it
// is never registered. The engine builds no `index.html` since the cartridge left (b55b88e).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

/** The pages the build emits, from `rollupOptions.input`. */
const paginas = () => {
  const input = CONFIG_LIMPA.match(/input:\s*\{([^}]*)\}/)?.[1] ?? '';
  return [...input.matchAll(/'app\/([^']+\.html)'/g)].map((m) => m[1]);
};

describe('the service worker\'s navigation fallback', () => {
  it('🎯 [Zero] the build names its pages — the case below would compare against nothing', () => {
    expect(paginas().length).toBeGreaterThan(0);
  });

  it('🔴 [Right] the fallback is written, and it is null or a page the build emits', () => {
    const m = CONFIG_LIMPA.match(/navigateFallback:\s*(null|'([^']+)')/);
    expect(m, 'no `navigateFallback`: the plugin falls back to index.html, and the runtime routes after it never register').toBeTruthy();
    if (m[1] !== 'null') expect(paginas(), `the fallback ${m[2]} is not a page this build emits`).toContain(m[2]);
  });
});

/**
 * 🔴 THE QUIZ OPENED WITH `?libras=avatar` OPENS OFFLINE (ADR-0234, route B, phase B3). 📏 Measured on a served delivery
 * (2026-09-25): with the free player's files all kept, the offline navigation to `quiz.html?libras=avatar` failed with
 * `ERR_INTERNET_DISCONNECTED` — the precache matches the whole address, and only `quiz.html` is precached.
 */
describe('the precache finds the page under the demo\'s own query', () => {
  const source = CONFIG_LIMPA.match(/ignoreURLParametersMatching:\s*(\[[^\n]*\]),/)?.[1];
  // the configuration's own text, evaluated as the plugin serializes it — never input from anywhere else
  const ignored = source ? new Function(`return ${source};`)() : []; // eslint-disable-line no-new-func
  const ignores = (name) => ignored.some((r) => r.test(name));

  it('🔴 [Right] `libras` is ignored when a navigation is matched, and Workbox\'s own defaults still are', () => {
    expect(source, 'no `ignoreURLParametersMatching`: `quiz.html?libras=avatar` is never found in the precache').toBeTruthy();
    for (const name of ['libras', 'utm_source', 'utm_campaign', 'fbclid']) expect(ignores(name), name).toBe(true);
  });

  it('📌 [Boundary] nothing else is: a query that changes the answer — the list\'s `sha256` — still reaches the network', () => {
    for (const name of ['sha256', 'libras-avatar', 'librasx', 'lang', 'v']) expect(ignores(name), name).toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 `navigateFallback` removed (the plugin's index.html)   🔴 [Right]
//   S2 `navigateFallback: 'index.html'`                        🔴 [Right]
//   S3 the input emptied                                        🔴 [Zero]
//   (2026-09-25, the demo's query, ADR-0234 phase B3: scripted, restored from a copy and checked by hash — 5 of 5 red)
//   Q1 `libras` not ignored                                      🔴 [Right]
//   Q2 the setting removed (Workbox's defaults only)               🔴 [Right]
//   Q3 Workbox's defaults dropped by the setting                   🔴 [Right]
//   Q4 `libras` not anchored at its end                           🔴 [Boundary]
//   Q5 every query ignored                                         🔴 [Boundary]
