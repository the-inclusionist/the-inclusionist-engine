// SPDX-License-Identifier: AGPL-3.0-or-later
// A HEAVY FILE IS SERVED FROM THE DELIVERY'S OWN `heavy/` (ADR-0177, issue #173): a delivery path maps back to the upstream
// address the fetcher keeps it under, and the service worker answers that path from the checked cache without writing it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEAVY_FILES, deliveryPath, deliveryCacheKey } from '../app/js/platform/heavy.js';
import { DELIVERY_LISTS } from '../app/js/platform/heavy-catalogue.js';

const CONFIG = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
const CONFIG_LIMPA = CONFIG.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

describe('heavy files, from the delivery', () => {
  it('🔴 [Right] a delivery path maps back to the upstream address the fetcher keeps it under', () => {
    for (const p of HEAVY_FILES.filter((x) => x.url)) {
      expect(deliveryCacheKey(`https://escola.example/jogo/${deliveryPath(p.url)}`)).toBe(p.url);
    }
  });

  it('📌 [Boundary] an address outside `heavy/` has no key — the route leaves it alone', () => {
    expect(deliveryCacheKey('https://escola.example/jogo/assets/index.js')).toBeNull();
    expect(deliveryCacheKey('https://escola.example/heavyx/cdn.jsdelivr.net/a.wasm')).toBeNull();
  });

  it('🔴 [Right] the service worker answers `heavy/` from the checked cache, through that mapping, and never writes it', () => {
    const rota = CONFIG_LIMPA.match(/\{[^{}]*urlPattern:[^\n]*heavy[\s\S]*?cacheKeyWillBeUsed[\s\S]*?\n\s{10}\},/)?.[0];
    expect(rota, 'no service worker route for the delivery\'s `heavy/`').toBeTruthy();
    expect(rota).toMatch(/handler:\s*'CacheFirst'/);
    expect(rota).toMatch(/cacheName:\s*'incl-pesados-v2'/);
    expect(rota).toMatch(/cacheKeyWillBeUsed:[^\n]*deliveryCacheKey/);
    expect(rota, 'the route would cache an unchecked body').toMatch(/cacheWillUpdate:\s*async \(\) => null/);
  });
});

/**
 * 🔴 THE PLAYER'S PAGE AND THE SIGNS ARE SERVED FROM WHAT THE START KEPT (ADR-0234, pillar 8). 📏 Measured on a served delivery
 * (2026-09-25): no route matched `libras/`, so the frame's page, its scripts and every sign went to the network even with all
 * of them kept, and offline the frame never loaded. The route's own function is evaluated here from the configuration's source,
 * which is what the PWA plugin copies into `sw.js`.
 */
describe('the Libras player\'s page and signs, from the delivery\'s list', () => {
  const LIST = DELIVERY_LISTS.find((l) => l.id === 'libras:delivery');
  const rota = CONFIG_LIMPA.match(/\{[^{}]*urlPattern:[^\n]*libras[\s\S]*?\n\s{10}\},/)?.[0];
  const source = rota?.match(/urlPattern:\s*(\(\{[^)]*\}\)\s*=>[^\n]*),\n/)?.[1];
  // the configuration's own text, evaluated as the plugin serializes it — never input from anywhere else
  const matches = source ? new Function(`return (${source});`)() : () => false; // eslint-disable-line no-new-func
  const page = 'https://escola.example/jogo/';
  const asked = (path, sameOrigin = true) => matches({ sameOrigin, url: new URL(path, page) });

  it('🔴 [Right] the route answers every file the list may name from the checked cache, and never writes it', () => {
    expect(rota, 'no service worker route for the player\'s page and signs').toBeTruthy();
    expect(rota).toMatch(/handler:\s*'CacheFirst'/);
    expect(rota).toMatch(/cacheName:\s*'incl-pesados-v2'/);
    expect(rota, 'the route would cache an unchecked body').toMatch(/cacheWillUpdate:\s*async \(\) => null/);
    expect(rota, 'the key is the address itself: the list keeps each file under it').not.toMatch(/cacheKeyWillBeUsed/);
    for (const folder of LIST.folders) {
      for (const name of ['index.html', 'playerweb.json', 'A%C3%87%C3%83O', 'PRIMEIRO&ORDINAL']) {
        expect(asked(`${folder}${name}`), `${folder}${name} goes to the network offline`).toBe(true);
      }
    }
  });

  it('📌 [Boundary] the list itself, the folders, `heavy/`, the game\'s page and another origin are left alone', () => {
    expect(source, 'the route\'s function was not found: the cases below would measure nothing').toBeTruthy();
    expect(asked(LIST.path), 'an old list would be served from the cache, and the device would never learn of a new delivery').toBe(false);
    for (const folder of LIST.folders) expect(asked(folder), folder).toBe(false);
    expect(asked('heavy/raw.githubusercontent.com/x/playerweb.data.unityweb')).toBe(false);
    expect(asked('quiz.html')).toBe(false);
    expect(asked(`${LIST.folders[0]}index.html`, false), 'a route that may answer another origin').toBe(false);
  });
});

/**
 * 🔴 THE FREE PLAYER'S FILES AND ITS THREE.JS CHUNK ARE SERVED FROM WHAT THE START KEPT (ADR-0234, phase B3). 📏 Measured on a
 * served delivery (2026-09-25): the avatar, the clips and `assets/libras-avatar-stage-<hash>.js` went to the network at every sign
 * — no precache entry (the chunk is left out on purpose) and no route — so offline the free player could not open. ⚠️ The chunk
 * sits under `assets/`, the precache's: the route must match its NAME and nothing else there.
 */
describe('the free Libras player\'s avatar, clips and stage chunk, from the delivery\'s list', () => {
  const LIST = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
  const rota = CONFIG_LIMPA.match(/\{[^{}]*urlPattern:[^\n]*libras[\s\S]*?\n\s{10}\},/)?.[0];
  const source = rota?.match(/urlPattern:\s*(\(\{[^)]*\}\)\s*=>[^\n]*),\n/)?.[1];
  const matches = source ? new Function(`return (${source});`)() : () => false; // eslint-disable-line no-new-func
  const page = 'https://escola.example/jogo/quiz.html?libras=avatar';
  const asked = (path, sameOrigin = true) => matches({ sameOrigin, url: new URL(path, page) });

  it('🔴 [Right] every file the list may name is answered by the checked-cache route — the avatar, the clips and the chunk', () => {
    expect(source, 'the route\'s function was not found: the cases below would measure nothing').toBeTruthy();
    const names = {
      'libras/avatar/': ['manifest.json', 'avatar.glb', 'clips/GATO.json', 'clips/PRIMEIRO&ORDINAL.json', 'clips/N%C3%83O_ABRIR.json'],
      'assets/libras-avatar-stage-': ['fyxZVSPc.js', 'a_B-9.js'],
    };
    expect(LIST.folders).toEqual(Object.keys(names));
    for (const place of LIST.folders) {
      for (const name of names[place]) expect(asked(`${place}${name}`), `${place}${name} goes to the network offline`).toBe(true);
    }
  });

  it('📌 [Boundary] the precache\'s own assets, the list, the bare folder and another origin are left alone', () => {
    expect(source).toBeTruthy();
    for (const path of ['assets/pixi-B1a2c3d4.js', 'assets/index-abc12345.css', 'assets/libras-avatar-stage-fyxZVSPc.js.map',
      'assets/libras-avatar-stage-.js', 'assets/deep/libras-avatar-stage-fyxZVSPc.js', 'libras-avatar-stage-fyxZVSPc.js', LIST.path,
      'libras/avatar/', 'quiz.html']) {
      expect(asked(path), `${path} would be answered by the Libras route`).toBe(false);
    }
    expect(asked('assets/libras-avatar-stage-fyxZVSPc.js', false), 'a route that may answer another origin').toBe(false);
    expect(asked('libras/avatar/avatar.glb', false), 'a route that may answer another origin').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   P2 the key keeps the delivery path                          🔴 maps back
//   P3 any path gets a key                                      🔴 [Boundary]
//   P4 the route writes the cache                               🔴 route
//   P5 the route without the mapping                            🔴 route
//   P6 the route matches any origin                             🔴 `rota-dos-modelos`: a route that can reach a third party
//   (2026-09-25, the Libras route, 7 of 7 red)
//   L1 no route for the player's page and signs                 🔴 [Right] and [Boundary]
//   L2 the route writes the cache                               🔴 [Right] (and `model-routes`)
//   L3 the route takes the list too                             🔴 [Boundary]
//   L4 the signs left out                                       🔴 [Right]
//   L5 any origin                                               🔴 [Boundary] (and `model-routes`)
//   L6 `CacheOnly`: the player dead online until the list came  🔴 [Right]
//   L7 heavy/'s key mapping on it                               🔴 [Right]
//   (2026-09-25, the free player's route, phase B3: scripted, the file restored from a copy and checked by hash — 5 of 5 red)
//   W1 the avatar's folder left out                             🔴 [Right] every file the list may name
//   W2 the stage chunk left out                                  🔴 [Right] every file the list may name
//   W3 the chunk matched by `assets/` (precache shadowed)        🔴 [Boundary] the precache's own assets
//   W4 the chunk's name not anchored at its end (`.js.map`)      🔴 [Boundary] the precache's own assets
//   W5 any origin                                                🔴 [Boundary] both describes
