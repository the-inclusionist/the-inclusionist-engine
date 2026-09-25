// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE LIBRAS PLAYER, PUT INTO A DELIVERY (ADR-0234, route A): run by `inclusionist-heavy --libras` after the four published player
// files are in `heavy/`, checked by sha256 like every heavy file.
//
// 🔴 THE PATCH IS A DELIVERY STEP, NOT A FILE IN THE REPOSITORY, and it is the declared, temporary exception route A carries
// (ADR-0234 erratum: «route A now, route B next»). Unity 2018's framework JavaScript answers the player's calls to the page with
// `eval(str)`, which the delivery's policy refuses; the policy never gains `unsafe-eval`, so the framework is rewritten instead:
//   1. the DELIVERED `playerweb.wasm.framework.unityweb` is read and its sha256 checked against the catalogue — a different
//      file is REFUSED, loudly, so an upstream change can never be patched blind;
//   2. it is decompressed (brotli, as Unity published it);
//   3. its single `eval(str)` — exactly one, or the step refuses — becomes `window.__vlExternalCall(str)`, a parser of plain
//      `name(JSON arguments)` calls (`vlibras-player/external-call.js`) that evaluates nothing;
//   4. the result is checked to evaluate no string anywhere, prefixed so it assigns itself to `UnityLoader.__vlFramework`, its
//      sha256 checked against the one measured here, and written beside the original as `playerweb.framework.noeval.js`.
// It sits in the same `heavy/` folder as the file it came from, under that project's LICENSE and a NOTICE that says what changed.
//
// THE PAGE AROUND IT IS OURS (AGPL): `vlibras-player/index.html`, `player.js`, `csp-shim.js` and `external-call.js`, written to
// `libras/player/` beside the game's page together with the `playerweb.json` that points Unity at `heavy/`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';

const HERE = new URL('./vlibras-player/', import.meta.url);

/** The catalogue ids of the four published files (`app/js/platform/heavy-catalogue.ts`). */
export const LIBRAS_PLAYER_IDS = Object.freeze({
  loader: 'libras:player:loader',
  framework: 'libras:player:framework',
  code: 'libras:player:code',
  data: 'libras:player:data',
});

/** The one statement rewritten, exactly as Unity 2018 wrote it in `_JS_Eval_EvalJS`, and what it becomes. */
const EVAL_CALL = 'try{eval(str)}catch(exception){console.error(exception)}';
const PARSED_CALL = 'try{window.__vlExternalCall(str)}catch(exception){console.error(exception)}';

/** The file written beside the original, and the `UnityLoader` name it assigns itself to — both `csp-shim.js`'s too. */
export const PATCHED_FRAMEWORK = 'playerweb.framework.noeval.js';
const FRAMEWORK_GLOBAL = '__vlFramework';
/**
 * The sha256 of what the patch writes from the pinned framework. 📏 Measured 2026-09-25: the same bytes as the variant that ran
 * under the delivery's policy with zero violations in route A's measurement.
 */
export const PATCHED_FRAMEWORK_SHA256 = '4621a32c6d2abd1d0e00a2114405514c9623db59d608aabfb3bf6fefa93911af';

/** Our own files, copied into the player's folder as they are (`index.html` is filled first). */
const PAGE_FILES = Object.freeze(['player.js', 'csp-shim.js', 'external-call.js']);

const sha256OfNode = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');

/** Anything in the patched framework that still turns a string into code. */
const EVALUATES_TEXT = /\beval\s*\(|\bnew\s+Function\b/;

/**
 * Rewrites the published framework (its compressed bytes) into the file the player page loads, or THROWS saying why not.
 * The input's sha256 is checked FIRST, before a byte of it is decompressed.
 */
export function patchFramework(compressed, { expectedSha256, sha256 = sha256OfNode, decompress = (b) => brotliDecompressSync(b) }) {
  const got = sha256(compressed);
  if (!expectedSha256 || got !== expectedSha256) {
    throw new Error(`REFUSED to patch the VLibras framework: sha256 ${got}, expected ${expectedSha256} — this is not the file the `
      + 'patch was written and measured for; pin the new file in the catalogue and measure the player again (ADR-0234)');
  }
  const code = Buffer.from(decompress(compressed)).toString('utf8');
  const found = code.split(EVAL_CALL).length - 1;
  if (found !== 1) {
    throw new Error(`REFUSED to patch the VLibras framework: its \`eval(str)\` statement appears ${found} times, expected exactly one`);
  }
  const patched = `UnityLoader["${FRAMEWORK_GLOBAL}"]=${code.replace(EVAL_CALL, () => PARSED_CALL)}`;
  if (EVALUATES_TEXT.test(patched)) {
    throw new Error('REFUSED: the patched VLibras framework still evaluates text somewhere else — it would fail under the policy');
  }
  return patched;
}

/**
 * The revision of the sign set a delivery carries: the sha256 of its sorted `NAME sha256` lines. A delivery whose set differs from
 * the one a device last started with makes the player page delete Unity's sign cache once (`vlibras-player/player.js`).
 */
export function signSetRevision(signs, sha256 = sha256OfNode) {
  return sha256(signs.map((s) => `${s.name} ${s.sha256}`).sort().join('\n'));
}

/**
 * Writes the player into the delivery `destino`, whose `heavy/` already holds the four published files: the patched framework
 * beside them, and the page, glue, shim, parser and Unity configuration in `playerFolder`. Returns the paths written, relative to
 * `destino`. THROWS on a missing catalogue entry, a refused patch, or a patched file whose sha256 is not the measured one.
 * `signs` is the sign set the delivery carries (`deliverLibrasSigns`).
 */
export function deliverLibrasPlayer({ destino, catalogue, deliveryPath, playerFolder, signs = [], read = (p) => readFileSync(p),
  sha256 = sha256OfNode, patchedSha256 = PATCHED_FRAMEWORK_SHA256, pageSource = HERE }) {
  const entry = (id) => {
    const found = catalogue.find((p) => p.id === id);
    if (!found || !found.url) throw new Error(`the catalogue has no address for ${id}: this package cannot deliver the Libras player`);
    return found;
  };
  const framework = entry(LIBRAS_PLAYER_IDS.framework);
  const heavyFolder = dirname(deliveryPath(framework.url)).replaceAll('\\', '/');

  const patched = patchFramework(read(join(destino, deliveryPath(framework.url))), { expectedSha256: framework.sha256, sha256 });
  const patchedGot = sha256(Buffer.from(patched, 'utf8'));
  if (patchedGot !== patchedSha256) {
    throw new Error(`REFUSED to write the patched VLibras framework: sha256 ${patchedGot}, expected ${patchedSha256}`);
  }
  const written = [];
  const write = (relative, text) => {
    mkdirSync(dirname(join(destino, relative)), { recursive: true });
    writeFileSync(join(destino, relative), text);
    written.push(relative);
  };
  write(`${heavyFolder}/${PATCHED_FRAMEWORK}`, patched);

  // from the player's folder back to the delivery's root, where `heavy/` is
  const up = '../'.repeat(playerFolder.split('/').filter(Boolean).length);
  const at = (id) => `${up}${deliveryPath(entry(id).url)}`;
  /*
   * 📌 NO `cacheControl`: Unity would keep a second copy of 19 MiB in its own IndexedDB. The files are the delivery's, served
   * from the checked cache by the service worker (ADR-0177); the upstream repository turned Unity's cache off too.
   */
  const unityConfig = {
    companyName: 'Vlibras',
    productName: 'Vlibras',
    dataUrl: at(LIBRAS_PLAYER_IDS.data),
    wasmCodeUrl: at(LIBRAS_PLAYER_IDS.code),
    wasmFrameworkUrl: at(LIBRAS_PLAYER_IDS.framework),
    TOTAL_MEMORY: 268435456,
    graphicsAPI: ['WebGL 1.0'],
    webglContextAttributes: { preserveDrawingBuffer: false },
    splashScreenStyle: 'Light',
    backgroundColor: 'transparent',
  };
  write(`${playerFolder}playerweb.json`, `${JSON.stringify(unityConfig, null, 2)}\n`);
  const page = readFileSync(new URL('index.html', pageSource), 'utf8')
    .split('%LOADER%').join(at(LIBRAS_PLAYER_IDS.loader))
    .split('%SIGN_SET%').join(signSetRevision(signs, sha256));
  write(`${playerFolder}index.html`, page);
  for (const name of PAGE_FILES) write(`${playerFolder}${name}`, readFileSync(new URL(name, pageSource), 'utf8'));
  return written;
}
