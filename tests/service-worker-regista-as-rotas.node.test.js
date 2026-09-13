// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SERVICE WORKER REGISTERS ITS RUNTIME ROUTES — its navigation fallback names a page the build emits.
//
// 🔴 Measured on 2026-09-13 in the engine's dist: a request to a missing Hugging Face model reached Hugging Face (their 404,
// their headers) instead of failing in the `CacheOnly` route, and the delivery's `pesados/` route never answered from the
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

// ============================== MUTATIONS CHECKED ==============================
//   S1 `navigateFallback` removed (the plugin's index.html)   🔴 [Right]
//   S2 `navigateFallback: 'index.html'`                        🔴 [Right]
//   S3 the input emptied                                        🔴 [Zero]
