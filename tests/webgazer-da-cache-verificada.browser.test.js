// SPDX-License-Identifier: AGPL-3.0-or-later
// EYE CONTROL RUNS WEBGAZER ONLY FROM THE CHECKED CACHE, NEVER FROM THE NETWORK ON FIRST USE (issue #169; STRIDE client pass).
//
// 📏 Measured on 2026-09-13: `ui/webcam.loadWebGazer` appended `<script src="https://webgazer.cs.brown.edu/webgazer.js">`
// when a child turned eye control on — third-party code with no integrity check, run with the page's powers (storage,
// DOM, the camera stream), and fetched on first use against pillar 8. Since #168 the same file is downloaded at install,
// checked by sha256, into `incl-pesados-v2` — and nothing read it from there (ADR-0132 asked for exactly that).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { loadWebGazer } from '../app/js/ui/webcam.ts';
import { PESADOS, CACHE_PESADOS } from '../app/js/platform/pesados.ts';
import { t } from '../app/js/core/i18n.ts';

const URL_WG = PESADOS.find((p) => p.id === 'visao:olhar').url;
const esperar = (ms = 150) => new Promise((r) => setTimeout(r, ms));
/** Scripts from another origin — the runner's own come from this origin, and a `blob:` is what the cache path makes. */
const scriptsDeRede = () => [...document.querySelectorAll('script[src]')].filter((s) => !s.src.startsWith(location.origin) && !s.src.startsWith('blob:'));

beforeEach(async () => {
  document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert" role="alert"></p><div id="game-region"></div>';
  delete window.webgazer;
  await caches.delete(CACHE_PESADOS);
});
afterAll(async () => { await caches.delete(CACHE_PESADOS); delete window.webgazer; });

describe('WebGazer comes from the checked cache', () => {
  it('🔴 [Right] with the file in the checked cache, it runs from there — and no script reaches the network', async () => {
    const corpo = 'window.webgazer = { marca: "da-cache" };';
    await (await caches.open(CACHE_PESADOS)).put(URL_WG, new Response(corpo, { headers: { 'content-type': 'text/javascript' } }));
    let chamado = false;
    loadWebGazer(() => { chamado = true; });
    await esperar(400);
    expect(scriptsDeRede(), 'a script was fetched from the network').toEqual([]);
    expect(window.webgazer?.marca, 'WebGazer did not come from the cache').toBe('da-cache');
    expect(chamado, 'the callback did not run once it loaded').toBe(true);
  });

  it('🎯 [Zero] with nothing in the checked cache, nothing runs and the child hears why', async () => {
    let chamado = false;
    loadWebGazer(() => { chamado = true; });
    await esperar(400);
    expect(scriptsDeRede(), 'it fell back to the network').toEqual([]);
    expect(window.webgazer, 'something ran').toBeUndefined();
    expect(chamado).toBe(false);
    expect(document.getElementById('sr-alert').textContent).toBe(t('sr.eyes.needsInternet'));
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with `webcam.browser` and `nada-de-cdn-a-mao`)
//   W1 back to the network when the cache lacks it     🔴 [Zero] + the two inventory cases
//   W2 run the URL instead of the checked bytes         🔴 [Right] + [Zero] + the inventory pair
//   W3 silent when nothing is cached                    🔴 [Zero]
// ⚠️ #170 (CSP) must allow `blob:` in script-src for this path.
