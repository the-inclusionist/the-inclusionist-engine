// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LIBRAS PLAYER'S DELIVERY STEP, AND THE PARSER THAT REPLACES ITS `eval` (ADR-0234, route A; `scripts/vlibras-player.mjs`).
//
// 🔴 The patch is the declared, temporary exception route A carries, so what is held here is its GUARD: a framework that is not
// the pinned file is refused before a byte is decompressed, the one `eval(str)` must be there exactly once, the result evaluates
// no text anywhere, and what the page calls instead runs NOTHING — it parses `name(JSON arguments)` for five known names and
// refuses the rest. No Unity file is read here: the framework is a synthetic one, compressed the way Unity published it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { brotliCompressSync } from 'node:zlib';
import {
  patchFramework, deliverLibrasPlayer, signSetRevision, LIBRAS_PLAYER_IDS, PATCHED_FRAMEWORK,
} from '../scripts/vlibras-player.mjs';
import { parseExternalCall, PLAYER_CALLS } from '../scripts/vlibras-player/external-call.js';
import { installCspShim, PATCHED_FRAMEWORK as SHIM_PATCHED_FRAMEWORK, FRAMEWORK_GLOBAL } from '../scripts/vlibras-player/csp-shim.js';
import { deliveryPath } from '../app/js/platform/heavy.js';
import { HEAVY_FILES, LIBRAS_PLAYER_FOLDER } from '../app/js/platform/heavy-catalogue.js';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const EVAL_CALL = 'try{eval(str)}catch(exception){console.error(exception)}';
/** A framework shaped like Unity's: one module function, with the `_JS_Eval_EvalJS` statement in it. */
const FRAMEWORK = `(function(Module) {function _JS_Eval_EvalJS(ptr){var str=Pointer_stringify(ptr);${EVAL_CALL}}})`;
const compressed = (text) => brotliCompressSync(Buffer.from(text, 'utf8'));

describe('the patch step — refuses what it was not written for', () => {
  it('🔴 [Right] the pinned framework becomes the parser-calling file: prefixed, its eval replaced, no text evaluated', () => {
    const input = compressed(FRAMEWORK);
    const out = patchFramework(input, { expectedSha256: sha(input) });
    expect(out.startsWith('UnityLoader["__vlFramework"]=(function(Module) {'), 'the file does not assign itself to the loader').toBe(true);
    expect(out).toContain('try{window.__vlExternalCall(str)}catch(exception){console.error(exception)}');
    expect(out, 'an eval survived the patch').not.toMatch(/\beval\s*\(/);
  });

  it('🔴 [Right] a framework whose sha256 is not the pinned one is REFUSED, loudly, before it is decompressed', () => {
    const input = compressed(FRAMEWORK);
    const decompress = vi.fn();
    expect(() => patchFramework(input, { expectedSha256: 'f'.repeat(64), decompress })).toThrow(/REFUSED .*sha256 .*expected f{64}/);
    expect(decompress, 'a file that is not the pinned one was decompressed before being refused').not.toHaveBeenCalled();
    expect(() => patchFramework(input, { expectedSha256: undefined }), 'no pin at all was taken as a match').toThrow(/REFUSED/);
  });

  it('🔴 [Boundary] the `eval(str)` statement must be there exactly once — none or two is refused', () => {
    for (const [text, times] of [[FRAMEWORK.replace(EVAL_CALL, 'try{}catch(e){}'), 0], [FRAMEWORK + EVAL_CALL, 2]]) {
      const input = compressed(text);
      expect(() => patchFramework(input, { expectedSha256: sha(input) })).toThrow(new RegExp(`appears ${times} times, expected exactly one`));
    }
  });

  it('🔴 [Right] a framework that still evaluates text elsewhere is refused: it would fail under the policy anyway', () => {
    for (const extra of ['eval("1")', 'new Function("return 1")']) {
      const input = compressed(`${FRAMEWORK};${extra}`);
      expect(() => patchFramework(input, { expectedSha256: sha(input) }), extra).toThrow(/still evaluates text/);
    }
  });
});

describe('the parser the patched framework calls — data in, nothing run', () => {
  it('🔴 [Right] it accepts the calls the player was measured sending, with their arguments as data', () => {
    expect(parseExternalCall('CounterGloss(1, 2);')).toEqual({ name: 'CounterGloss', args: [1, 2] });
    expect(parseExternalCall('onLoadPlayer();')).toEqual({ name: 'onLoadPlayer', args: [] });
    expect(parseExternalCall('GetAvatar("icaro");')).toEqual({ name: 'GetAvatar', args: ['icaro'] });
    expect(parseExternalCall('onPlayingStateChange("False", "False", "False", "False", "True");').args)
      .toEqual(['False', 'False', 'False', 'False', 'True']);
  });

  it('🔴 [Right] it rejects anything else — never evaluating it', () => {
    const refused = [
      'alert(1);', // a real global, not one of the player's calls
      'window.location.assign("https://example.org");', // a dotted path
      'CounterGloss(1, 2); alert(1);', // a second statement
      'CounterGloss(1, 2), alert(1)', // a sequence
      'CounterGloss(1 + 1);', // an expression
      'CounterGloss(x);', // a name, not data
      "GetAvatar('icaro');", // a JavaScript string, not JSON
      'CounterGloss(1, 2)//', // a comment
      'onLoadPlayer()();', // a call of the result
      '(function(){ return 1; })();',
      'constructor("return 1")();',
      '',
    ];
    const tripwire = vi.fn();
    globalThis.__vlTripwire = tripwire;
    try {
      for (const text of [...refused, 'CounterGloss(__vlTripwire());']) expect(() => parseExternalCall(text), text).toThrow(/refused/);
      expect(() => parseExternalCall(42)).toThrow(TypeError);
      expect(tripwire, 'a refused string was evaluated').not.toHaveBeenCalled();
    } finally { delete globalThis.__vlTripwire; }
  });

  it('📌 [Interface] the five names are the published glue\'s, and nothing more', () => {
    expect([...PLAYER_CALLS].sort()).toEqual(['CounterGloss', 'FinishWelcome', 'GetAvatar', 'onLoadPlayer', 'onPlayingStateChange']);
  });
});

describe('the CSP shim — what the page installs over the loader', () => {
  function fakePage() {
    const appended = [];
    const doc = { baseURI: 'https://school.example/game/libras/player/index.html', body: { appendChild: (s) => { appended.push(s); } },
      createElement: (tag) => ({ tag }) };
    const original = vi.fn(() => 'original');
    const loader = { loadCode: original };
    const handlers = Object.fromEntries(PLAYER_CALLS.map((n) => [n, vi.fn()]));
    const win = {};
    const failures = [];
    installCspShim({ win, doc, loader, handlers, onFailure: (why) => { failures.push(why); } });
    return { doc, appended, original, loader, handlers, win, failures };
  }

  it('🔴 [Right] the framework is loaded from the patched same-origin FILE beside the published one — never a blob', () => {
    const p = fakePage();
    const done = vi.fn();
    const Module = { wasmFrameworkUrl: '../../heavy/h/public/unity/playerweb.wasm.framework.unityweb', resolveBuildUrl: (u) => u };
    p.loader.loadCode('code', done, { Module, url: Module.wasmFrameworkUrl });
    expect(p.original, 'the framework went to the loader\'s own blob injection').not.toHaveBeenCalled();
    expect(p.appended.map((s) => s.src)).toEqual([`https://school.example/game/heavy/h/public/unity/${PATCHED_FRAMEWORK}`]);
    p.appended[0].onload();
    expect(done).toHaveBeenCalledWith(FRAMEWORK_GLOBAL);
    p.appended[0].onerror();
    expect(p.failures.join(' ')).toMatch(/patched framework did not load/);
  });

  it('📌 [Boundary] every other `loadCode` goes to the loader\'s own, untouched', () => {
    const p = fakePage();
    const Module = { wasmFrameworkUrl: 'f.unityweb', asmCodeUrl: 'a.js', resolveBuildUrl: (u) => u };
    expect(p.loader.loadCode('code', () => {}, { Module, url: Module.asmCodeUrl })).toBe('original');
    expect(p.loader.loadCode('code', () => {})).toBe('original');
    expect(p.appended).toEqual([]);
  });

  it('🔴 [Right] `__vlExternalCall` hands the parsed arguments to the page\'s handler, and refuses what the parser refuses', () => {
    const p = fakePage();
    p.win.__vlExternalCall('CounterGloss(1, 2);');
    expect(p.handlers.CounterGloss).toHaveBeenCalledWith(1, 2);
    expect(() => p.win.__vlExternalCall('alert(1);')).toThrow(/refused/);
  });

  it('📌 [Interface] the shim loads the file the delivery writes, under the name it assigns itself to', () => {
    expect(SHIM_PATCHED_FRAMEWORK).toBe(PATCHED_FRAMEWORK);
    const input = compressed(FRAMEWORK);
    expect(patchFramework(input, { expectedSha256: sha(input) }).startsWith(`UnityLoader["${FRAMEWORK_GLOBAL}"]=`)).toBe(true);
  });
});

describe('the player, written into a delivery', () => {
  /** A catalogue of four fake player files whose framework is the synthetic one, laid in `heavy/` as the delivery would. */
  function delivery() {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-libras-'));
    const input = compressed(FRAMEWORK);
    const base = 'https://example.org/vlibras/0123abc/public/unity';
    const catalogue = [
      { id: LIBRAS_PLAYER_IDS.loader, url: `${base}/unity-loader.js`, sha256: sha('loader') },
      { id: LIBRAS_PLAYER_IDS.framework, url: `${base}/playerweb.wasm.framework.unityweb`, sha256: sha(input) },
      { id: LIBRAS_PLAYER_IDS.code, url: `${base}/playerweb.wasm.code.unityweb`, sha256: sha('code') },
      { id: LIBRAS_PLAYER_IDS.data, url: `${base}/playerweb.data.unityweb`, sha256: sha('data') },
    ];
    const at = join(destino, deliveryPath(catalogue[1].url));
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, input);
    const patchedSha256 = sha(Buffer.from(patchFramework(input, { expectedSha256: sha(input) }), 'utf8'));
    return { destino, catalogue, patchedSha256, heavyFolder: posix.dirname(deliveryPath(catalogue[1].url)) };
  }

  it('🔴 [Right] the patched framework lands beside the original, and the page points Unity at `heavy/` from its own folder', () => {
    const d = delivery();
    try {
      const written = deliverLibrasPlayer({ destino: d.destino, catalogue: d.catalogue, deliveryPath, playerFolder: LIBRAS_PLAYER_FOLDER,
        patchedSha256: d.patchedSha256 });
      expect(written.sort()).toEqual([`${d.heavyFolder}/${PATCHED_FRAMEWORK}`, ...['csp-shim.js', 'external-call.js', 'index.html',
        'player.js', 'playerweb.json'].map((f) => `${LIBRAS_PLAYER_FOLDER}${f}`)].sort());
      const page = new URL(`https://school.example/game/${LIBRAS_PLAYER_FOLDER}index.html`);
      const config = JSON.parse(readFileSync(join(d.destino, LIBRAS_PLAYER_FOLDER, 'playerweb.json'), 'utf8'));
      for (const [key, id] of [['dataUrl', 'data'], ['wasmCodeUrl', 'code'], ['wasmFrameworkUrl', 'framework']]) {
        const url = d.catalogue.find((p) => p.id === LIBRAS_PLAYER_IDS[id]).url;
        expect(new URL(config[key], page).pathname, key).toBe(`/game/${deliveryPath(url)}`);
      }
      expect(config.cacheControl, 'Unity would keep a second copy in its own IndexedDB').toBeUndefined();
      const html = readFileSync(join(d.destino, LIBRAS_PLAYER_FOLDER, 'index.html'), 'utf8');
      expect(html, 'a placeholder was left in the page').not.toMatch(/%[A-Z_]+%/);
      expect(html).toContain(`<script src="../../${deliveryPath(d.catalogue[0].url)}"></script>`);
      expect(html).toContain(`<meta name="libras-sign-set" content="${signSetRevision([])}">`);
    } finally { rmSync(d.destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a delivered framework that is not the pinned file writes NOTHING, and says so', () => {
    const d = delivery();
    try {
      writeFileSync(join(d.destino, deliveryPath(d.catalogue[1].url)), compressed(`${FRAMEWORK}/* upstream moved on */`));
      expect(() => deliverLibrasPlayer({ destino: d.destino, catalogue: d.catalogue, deliveryPath, playerFolder: LIBRAS_PLAYER_FOLDER,
        patchedSha256: d.patchedSha256 })).toThrow(/REFUSED to patch the VLibras framework: sha256/);
      expect(existsSync(join(d.destino, d.heavyFolder, PATCHED_FRAMEWORK)), 'a patched file was written from the wrong input').toBe(false);
      expect(existsSync(join(d.destino, LIBRAS_PLAYER_FOLDER)), 'a player page was written for a framework never patched').toBe(false);
    } finally { rmSync(d.destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a patched file whose sha256 is not the measured one is refused too', () => {
    const d = delivery();
    try {
      expect(() => deliverLibrasPlayer({ destino: d.destino, catalogue: d.catalogue, deliveryPath, playerFolder: LIBRAS_PLAYER_FOLDER,
        patchedSha256: '0'.repeat(64) })).toThrow(/REFUSED to write the patched VLibras framework/);
      expect(existsSync(join(d.destino, d.heavyFolder, PATCHED_FRAMEWORK))).toBe(false);
    } finally { rmSync(d.destino, { recursive: true, force: true }); }
  });

  /**
   * 🔴 THE PIN THE DELIVERY CHECKS IS THE CATALOGUE'S, the one the device checks before keeping the file. Two copies of one hash
   * would drift apart, and the first sign of it would be a device refusing the file every delivery writes.
   */
  it('🔴 [Right] without a hash of its own, the step checks the patched file against the CATALOGUE\'s pin, at the catalogue\'s address', () => {
    const d = delivery();
    const patchedAt = `${d.catalogue[1].url.slice(0, d.catalogue[1].url.lastIndexOf('/'))}/${PATCHED_FRAMEWORK}`;
    const pinned = (sha256, url = patchedAt) => [...d.catalogue,
      { id: LIBRAS_PLAYER_IDS.patched, url, sha256, madeFrom: LIBRAS_PLAYER_IDS.framework }];
    const deliver = (catalogue) => deliverLibrasPlayer({ destino: d.destino, catalogue, deliveryPath, playerFolder: LIBRAS_PLAYER_FOLDER });
    try {
      expect(() => deliver(pinned('0'.repeat(64))), 'the step wrote a patch the catalogue does not pin')
        .toThrow(/REFUSED to write the patched VLibras framework: sha256 [0-9a-f]{64}, expected 0{64}/);
      expect(existsSync(join(d.destino, d.heavyFolder, PATCHED_FRAMEWORK))).toBe(false);
      expect(() => deliver(pinned(d.patchedSha256, `${patchedAt}.elsewhere.js`)), 'the device would ask for a file no delivery holds')
        .toThrow(/keeps libras:player:framework:noeval at .*\.elsewhere\.js, but the patch is written to/);
      expect(() => deliver(d.catalogue), 'a catalogue with no pin for the patch let it through').toThrow(/no address for libras:player:framework:noeval/);
      expect(deliver(pinned(d.patchedSha256))).toContain(`${d.heavyFolder}/${PATCHED_FRAMEWORK}`);
      expect(sha(readFileSync(join(d.destino, d.heavyFolder, PATCHED_FRAMEWORK)))).toBe(d.patchedSha256);
    } finally { rmSync(d.destino, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] the sign set\'s revision changes when a sign\'s bytes change under the same name — what clears the player\'s cache', () => {
    const one = signSetRevision([{ name: 'CASA', sha256: sha('a') }]);
    expect(signSetRevision([{ name: 'CASA', sha256: sha('b') }])).not.toBe(one);
    expect(signSetRevision([{ name: 'ESCOLA', sha256: sha('e') }, { name: 'CASA', sha256: sha('a') }]))
      .toBe(signSetRevision([{ name: 'CASA', sha256: sha('a') }, { name: 'ESCOLA', sha256: sha('e') }]));
    expect(signSetRevision([])).toBe(sha(''));
  });

  it('🔴 [Right] the real catalogue carries the four files at one pinned folder, and the package ships the step and the page', () => {
    const ids = Object.values(LIBRAS_PLAYER_IDS);
    const entries = ids.map((id) => HEAVY_FILES.find((p) => p.id === id));
    expect(entries.every(Boolean), 'a player file left the catalogue').toBe(true);
    expect(new Set(entries.map((p) => posix.dirname(p.url))).size, 'the player files are not one folder: the page cannot find them').toBe(1);
    expect(entries[0].url, 'the address is not pinned to a commit').toMatch(/\/[0-9a-f]{40}\/public\/unity\//);
    // the file the page RUNS is where the shim asks for it and the step writes it, and it is made, never fetched upstream
    const patched = HEAVY_FILES.find((p) => p.id === LIBRAS_PLAYER_IDS.patched);
    expect(posix.basename(patched.url), 'the device keeps the patch under another name than the one the shim loads').toBe(SHIM_PATCHED_FRAMEWORK);
    expect(patched.madeFrom, 'the build would try to download the patch from upstream').toBe(LIBRAS_PLAYER_IDS.framework);
    expect(patched.sha256).toMatch(/^[0-9a-f]{64}$/);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.files).toEqual(expect.arrayContaining(['scripts/vlibras-player.mjs', 'scripts/vlibras-player']));
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (each run on the module named and restored; the red is the case that caught it)
//   P1 the input sha256 check removed from `patchFramework`             🔴 refused before decompressed · writes NOTHING
//   P2 the check moved AFTER decompressing                               🔴 «before it is decompressed»
//   P3 the exactly-once count removed (replace whatever is there)        🔴 none or two is refused
//   P4 the «still evaluates text» check removed                          🔴 refused: it would fail under the policy
//   P5 the patched-file sha256 check removed from `deliverLibrasPlayer`  🔴 a patched file whose sha256 is not the measured one
//   P6 the patched file checked only when a hash is handed in             🔴 checks against the CATALOGUE's pin (2026-09-25)
//   P7 the check that the catalogue keeps the patch where it is written   🔴 same case
//   P8 the patched framework's entry removed from the catalogue           🔴 the real catalogue carries … (and `heavy.node`)
//   X1 the allowed-name check removed from the parser                    🔴 rejects anything else (`alert(1);`)
//   X2 the name pattern admitting dots                                   ✅ SURVIVED, equivalent: no allowed name has a dot, so the
//      allow-list already refuses every dotted path. The pattern stays as a second wall, not as the one that holds.
//   X3 the arguments split on commas instead of `JSON.parse`             🔴 rejects anything else (`CounterGloss(x);`)
//   S1 the shim passing the framework to the loader's own `loadCode`     🔴 loaded from the patched FILE
//   S2 `__vlExternalCall` calling `window[name]` without the parser      🔴 refuses what the parser refuses
