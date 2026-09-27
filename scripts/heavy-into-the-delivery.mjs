#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Puts the heavy files into a delivery (ADR-0177, issue #173): each upstream address of the download catalogue is fetched at
// BUILD time, checked against its pinned sha256, and written to `<destination>/heavy/<host><path>` — where the page asks for
// it. A file whose hash differs stops the build: nothing unchecked reaches a delivery.
//
// Usage (after `npm run build`): `npm run heavy:delivery` — builds the package, then `node scripts/heavy-into-the-delivery.mjs dist`.
// A cartridge, after its own build, runs the published command: `npx inclusionist-heavy dist`. The catalogue is read from the
// package beside this script, never from the caller's folder.
// ⚠️ It downloads about 300 MB from Hugging Face, jsDelivr and Google Storage: the build machine
// contacts them once, and the child's device never does.
//
// WHERE FROM IS A CHOICE (the Dev, 2026-09-21): `--base <address or folder>`, the variable `INCLUSIONIST_HEAVY_BASE`, or a `.env`
// beside the build. With a base, each file comes from the project's mirror, a school's server or a folder on this machine
// (`platform/heavy-mirror`); without one, from upstream. The sha256 check does not move: a base that serves other bytes writes
// nothing, which is why pointing elsewhere is safe and needs no trust.
//
// THE FONT LIBRARY TRAVELS THE SAME WAY (ADR-0255): `--fonts` puts the families the cartridges declare into `heavy/`, each face
// checked against the engine's font catalogue, each family with its licence text and notice (`licences/fonts.mjs`).
//
// WHAT THE FILES OWE TRAVELS WITH THEM (`licences/third-party.mjs`): every folder of `heavy/` that holds a file also gets its
// project's `LICENSE` and `NOTICE` (eSpeak NG's also a `SOURCE`), and `heavy/THIRD-PARTY-NOTICES.md` lists each project. A
// catalogue entry whose licence nobody recorded there is refused like a file whose sha256 differs.

import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { THIRD_PARTY, groupOf, writeLicences } from './licences/third-party.mjs';
import { familyLicenceFiles } from './licences/fonts.mjs';
import { deliverLibrasGlosses, readTexts, runGlosser, setUpGlosser } from './libras-glosses.mjs';
import { deliverLibrasAvatar, readAvatarPins, stageChunkOf, writeAvatarList } from './libras-avatar.mjs';

/** The compiled catalogue of the package this script ships in — beside it, whatever folder the build runs from. */
export function moduloDoPacote() {
  return new URL('../dist-pkg/platform/heavy.js', import.meta.url).href;
}

const sha256DoNode = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

/**
 * ONE FILE, FETCHED (or read from a local base), CHECKED AGAINST ITS PINNED SHA256 AND WRITTEN — or refused with the reason, and
 * nothing written. The one rule the catalogue's files and the library's fonts go through.
 */
async function trazerVerificado(p, alvo, { fonte, buscar, lerLocal, sha256 }) {
  try {
    let corpo;
    if (/^https?:\/\//i.test(fonte)) {
      const resp = await buscar(fonte);
      if (!resp.ok) return { id: p.id, outcome: 'falhou', error: `HTTP ${resp.status} — ${fonte}` };
      corpo = await resp.arrayBuffer();
    } else {
      corpo = lerLocal(fonte);
    }
    const obtido = sha256(corpo);
    if (!p.sha256 || obtido !== p.sha256) {
      return { id: p.id, outcome: 'falhou', error: `sha256 mismatch at ${fonte}: expected ${p.sha256}, got ${obtido} — not written` };
    }
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, Buffer.from(corpo));
    return { id: p.id, outcome: 'escrito', bytes: corpo.byteLength };
  } catch (e) {
    return { id: p.id, outcome: 'falhou', error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * THE FONT LIBRARY'S FAMILIES A DELIVERY CARRIES (ADR-0255), from `--fonts`: each value a family or a comma-separated list of
 * them; `all` is every family of the library, `none` nothing. A family the library does not hold STOPS the command (exit 2),
 * naming it, instead of delivering nothing for it in silence.
 */
export function fontFamiliesOfTheDelivery(asked, library) {
  const names = asked.flatMap((v) => v.split(',')).map((f) => f.trim()).filter(Boolean);
  if (names.includes('all')) return Object.keys(library.families);
  const named = [...new Set(names.filter((f) => f !== 'none'))];
  const unknown = named.filter((f) => !library.families[f]);
  if (unknown.length) {
    throw new Error(`--fonts ${unknown.join(', ')}: the engine's font library has no ${unknown.length > 1 ? 'such families' : 'such family'} `
      + '(app/js/platform/font-library.json). Name families as the library writes them — «Press Start 2P» — or `--fonts all`');
  }
  return named;
}

/**
 * PUTS THE DECLARED FAMILIES OF THE FONT LIBRARY INTO THE DELIVERY (ADR-0255): each face is fetched (or read from a local base),
 * checked against the sha256 the ENGINE'S catalogue pins, and written at `heavy/<host>/fonts/<folder>/<file>` — where the page
 * asks for it. Beside each family whose every face is there, its licence text and `NOTICE.txt`, written from the delivered fonts'
 * own `name` tables (`licences/fonts.mjs`, the same writer as the library's folders). A face refused leaves its family without a
 * notice and the run not `ok`.
 */
export async function levarFontesParaEntrega({ destino, families, library, deliveryPath, fetch: buscar = fetch, sha256 = sha256DoNode,
  base = '', fonteDe = (url) => url, lerLocal = (caminho) => readFileSync(caminho), licenceFiles = familyLicenceFiles }) {
  const linhas = [];
  for (const family of families) {
    const entry = library.families[family];
    let whole = true;
    let folder = '';
    // one file may serve two weights (a variable font declared at 400 and 700): each file once
    const faces = entry.faces.filter((f, i) => entry.faces.findIndex((g) => g.file === f.file) === i);
    for (const face of faces) {
      const url = `${library.mirror}/${entry.folder}/${face.file}`;
      const p = { id: `font:${entry.folder}:${face.file}`, sha256: face.sha256 };
      const alvo = join(destino, deliveryPath(url));
      folder = dirname(alvo);
      const linha = existsSync(alvo) && sha256(readFileSync(alvo)) === face.sha256
        ? { id: p.id, outcome: 'ja-tinha' }
        : await trazerVerificado(p, alvo, { fonte: fonteDe(url, base), buscar, lerLocal, sha256 });
      linhas.push(linha);
      if (linha.outcome === 'falhou') whole = false;
    }
    if (!whole) continue;
    try {
      const owed = licenceFiles(family, entry, (file) => readFileSync(join(folder, file)));
      for (const [name, text] of Object.entries(owed)) writeFileSync(join(folder, name), text);
    } catch (e) {
      linhas.push({ id: `font:${entry.folder}:licence`, outcome: 'falhou', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: linhas.every((l) => l.outcome !== 'falhou'), linhas };
}

/**
 * Fetches, checks and writes every entry with an address, then the licence files beside them. Returns one line per entry and
 * the licence folders written (`licences`); `ok` is false when any file — or the licences — failed.
 * Everything is injected so a gate can run it without the network.
 */
export async function levarPesadosParaEntrega({ destino, pesados, deliveryPath, fetch: buscar = fetch, sha256 = sha256DoNode,
  base = '', fonteDe = (url) => url, lerLocal = (caminho) => readFileSync(caminho), thirdParty = THIRD_PARTY, catalogue = [] }) {
  const linhas = [];
  const present = [];
  for (const p of pesados) {
    if (!p.url) { linhas.push({ id: p.id, outcome: 'sem-fonte' }); continue; }
    if (!groupOf(p.id, thirdParty)) {
      linhas.push({ id: p.id, outcome: 'falhou', error: 'no licence recorded for it in scripts/licences/third-party.mjs — not written' });
      continue;
    }
    const alvo = join(destino, deliveryPath(p.url));
    if (existsSync(alvo) && sha256(readFileSync(alvo)) === p.sha256) {
      linhas.push({ id: p.id, outcome: 'ja-tinha' });
      present.push({ id: p.id, path: deliveryPath(p.url) });
      continue;
    }
    const escrito = await trazerVerificado(p, alvo, { fonte: fonteDe(p.url, base), buscar, lerLocal, sha256 });
    linhas.push(escrito);
    if (escrito.outcome === 'escrito') present.push({ id: p.id, path: deliveryPath(p.url) });
  }
  // 📌 THE NOTICES SPEAK FOR THE WHOLE DELIVERY, not for this run: a delivery may be built by several runs (`--reading pt`, then
  // `--kokoro`), and `THIRD-PARTY-NOTICES.md` is rewritten each time. So every catalogue file ALREADY in the delivery with its
  // pinned bytes keeps its notice; a file whose bytes are not the pinned ones gets none from here.
  const listed = new Set(present.map((f) => f.id));
  for (const p of catalogue) {
    if (listed.has(p.id) || !p.url || !p.sha256 || !groupOf(p.id, thirdParty)) continue;
    const alvo = join(destino, deliveryPath(p.url));
    if (existsSync(alvo) && sha256(readFileSync(alvo)) === p.sha256) present.push({ id: p.id, path: deliveryPath(p.url) });
  }
  let licences = [];
  try {
    licences = writeLicences({ destination: destino, present, groups: thirdParty });
  } catch (e) {
    linhas.push({ id: 'licences', outcome: 'falhou', error: e instanceof Error ? e.message : String(e) });
  }
  return { ok: linhas.every((l) => l.outcome !== 'falhou'), linhas, licences };
}

/**
 * The command's arguments, which are the game's answers (ADR-0216 §3) said to the build:
 *
 * · `--kokoro` for a game that declares `uses: { neuralVoice: true }` — without it Kokoro's model, voices and runtime stay out of
 *   the delivery, as they stay out of the start's download.
 * · `--reading`, for a game that declares `uses: { reading: true }`: ALONE (or `--reading all`) it carries every language the
 *   catalogue has a reading model for — pt 378 MiB, en 162, es 310 — because the start of such a game asks for the three, and a
 *   child tries the three at once (ADR-0225 erratum, the Dev: «Negativo, baixar os três.»). `--reading <pt|en|es>`, repeatable,
 *   NARROWS to the languages named, with the same bytes as before; a language left out is a quiet 404 at the device's start and,
 *   when she reads in it, a sentence to her and a line of `problems` naming this fix. `--reading none` carries none, as no flag
 *   does. A language the catalogue has no reading model for STOPS the command (exit 2) instead of carrying nothing.
 * · `--commands <pt|en|es>`, repeatable: the voice COMMANDS (issue #184), 31–39 MiB a language plus 3.1 MiB of runtime. No game
 *   declares this one — saying «menu» is a way into the controller, not a feature (ADR-0111). WITHOUT THE FLAG THE DELIVERY
 *   CARRIES EVERY LANGUAGE the catalogue has a command model for — pt, en and es, 108 MiB (ADR-0225 erratum, the Dev: «A entrega
 *   leva as três línguas.») — because the child can switch language mid-game and her model must already be there. The flag
 *   NARROWS: the languages named, and only those; `--commands none` carries no command model at all. A language left out is
 *   said to the child who speaks it, and named in `problems` with this fix. A language the catalogue has no command model for
 *   STOPS the command (exit 2) instead of carrying the runtime alone.
 * · `--libras`: the Libras player deaf mode's interpreter signs with (ADR-0234, route B) — LAViD-UFPB's signs exported to one
 *   avatar and 655 clips, the whole manual alphabet among them, 32.7 MiB, into `libras/avatar/`, each checked against
 *   `scripts/libras-avatar.json` (`scripts/libras-avatar.mjs`), from the pins' `source` or from their `mirror` folder under
 *   `--base`. No game declares it: deaf mode is the person's, like speaking is, so the DELIVERY says whether it can sign. Without
 *   it the sonar in deaf mode says «signing unavailable». The same step GLOSSES the text a child can be shown
 *   (`scripts/libras-glosses.mjs`): the engine's Portuguese dictionary, always, and the game's own with `--libras-texts <file>`,
 *   repeatable (which implies `--libras`); a token the avatar carries no clip for is fingerspelled as written. It needs the
 *   glosser's environment, built once by `--libras-setup`; without it the delivery STOPS instead of shipping a player with nothing
 *   to sign but letters. Last, it writes `libras/offline-avatar.json`, the list of the avatar, clips, manifest, glosses and the
 *   build's three.js chunk with their sha256, by which a device with deaf mode on keeps the player for the days without a
 *   network — run after the build, which is what names the chunk.
 * · `--libras-setup`: builds that environment (uv and Python 3.12), and does nothing else.
 * · `--fonts <family,…|all|none>`, repeatable: the font LIBRARY's families the cartridges declare in `uses.fonts` (ADR-0255) —
 *   the engine packages only its own faces. Each face checked against the engine's catalogue (`platform/font-library.json`), each
 *   family with its licence and notice. Without the flag the delivery carries no library font, and a game that declares one is
 *   told so in `problems`. A family the library does not hold STOPS the command (exit 2).
 */
export function argumentosDaEntrega(args, ambiente = process.env) {
  // ⚠️ `--base <value>` eats the token after it: without that, the value was read as the delivery folder (caught by its case).
  let destino, base;
  const reading = [];
  const commands = [];
  const fonts = [];
  let libras = false;
  const librasTexts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--libras') { libras = true; continue; }
    if (args[i] === '--libras-texts') { const v = args[++i]; if (v) { librasTexts.push(v); libras = true; } continue; }
    if (args[i] === '--base') { base = args[++i]; continue; }
    // `--reading` alone — last, or before another flag — is every language; a value after it is a language, never the folder
    if (args[i] === '--reading') {
      const v = args[i + 1];
      if (v === undefined || v.startsWith('--')) reading.push('all'); else { reading.push(v); i++; }
      continue;
    }
    if (args[i] === '--commands') { const v = args[++i]; if (v) commands.push(v); continue; }
    if (args[i] === '--fonts') { const v = args[++i]; if (v) fonts.push(v); continue; }
    if (!args[i].startsWith('--') && destino === undefined) destino = args[i];
  }
  return { destino, kokoro: args.includes('--kokoro'), reading, commands, libras, librasTexts, librasSetup: args.includes('--libras-setup'),
    fonts, base: base ?? ambiente.INCLUSIONIST_HEAVY_BASE ?? '' };
}

/**
 * THE SPOKEN LANGUAGES A DELIVERY CARRIES: those `--commands` named (less `none`, which names nothing), or — when the flag was
 * not given — every language the catalogue has a command model for (ADR-0225 erratum). `languageOf` is the catalogue's
 * `commandsLanguageOf`, so a fourth language with a model is carried by default the day it enters the catalogue. Named languages
 * are base languages (`pt-BR` is `pt`).
 * ⚠️ A NAMED LANGUAGE WITH NO MODEL THROWS, naming it, as `--reading` does: `--commands xx` used to carry the command runtime and
 * no model at all, in silence.
 */
export function commandLanguagesOfTheDelivery(asked, catalogue, languageOf) {
  const known = [...new Set(catalogue.map((p) => languageOf(p.id)).filter(Boolean))];
  if (!asked.length) return known;
  const base = (tag) => tag.split('-')[0].toLowerCase();
  const named = asked.filter((lingua) => lingua !== 'none');
  const unknown = named.filter((lingua) => !known.includes(base(lingua)));
  if (unknown.length) {
    throw new Error(`--commands ${unknown.join(', ')}: the catalogue has no command model for ${unknown.length > 1 ? 'these languages' : 'this language'} `
      + `— it has ${known.join(', ')}. Name one of them, \`--commands none\` for no command model, or leave the flag out for every language`);
  }
  return [...new Set(named.map(base))];
}

/**
 * THE READING LANGUAGES A DELIVERY CARRIES: none without `--reading` (a game that does not listen carries no model); every
 * language the catalogue has a reading model for with `--reading` alone or `all` (ADR-0225 erratum); else those named, as base
 * languages (`pt-BR` is `pt`), less `none`. `languageOf` is the catalogue's `readingLanguageOf`, so a fourth language with a model
 * is carried by `all` the day it enters the catalogue.
 * ⚠️ A NAMED LANGUAGE WITH NO MODEL THROWS, naming it: it used to carry nothing in silence — and a folder written after the flag
 * (`--reading dist`) was read as a language and carried nothing just as quietly.
 */
export function readingLanguagesOfTheDelivery(asked, catalogue, languageOf) {
  const known = [...new Set(catalogue.map((p) => languageOf(p.id)).filter(Boolean))];
  const named = asked.filter((lingua) => lingua !== 'none' && lingua !== 'all');
  const base = (tag) => tag.split('-')[0].toLowerCase();
  const unknown = named.filter((lingua) => !known.includes(base(lingua)));
  if (unknown.length) {
    throw new Error(`--reading ${unknown.join(', ')}: the catalogue has no reading model for ${unknown.length > 1 ? 'these languages' : 'this language'} `
      + `— it has ${known.join(', ')}. Name one of them, or pass \`--reading\` alone for every language (the delivery folder goes `
      + 'before the flag: `inclusionist-heavy dist --reading`)');
  }
  if (asked.includes('all')) return known;
  return [...new Set(named.map(base))];
}

/**
 * THE IDS A DELIVERY CARRIES, from the command's answers: the reading languages go in one list and the spoken ones in another,
 * as the start asks for them. `readingLanguageOf` is needed only when `reading` names something.
 */
export function idsOfTheDelivery({ kokoro, reading, commands, libras }, { heavyAtBoot, catalogue, commandsLanguageOf, readingLanguageOf }) {
  const spoken = commandLanguagesOfTheDelivery(commands, catalogue, commandsLanguageOf);
  const read = reading.length ? readingLanguagesOfTheDelivery(reading, catalogue, readingLanguageOf) : [];
  return [...new Set([
    ...heavyAtBoot({ kokoro }),
    ...(read.length ? heavyAtBoot({ kokoro: false, reading: read }) : []),
    ...heavyAtBoot({ kokoro: false, commands: spoken }),
    ...(libras ? heavyAtBoot({ kokoro: false, libras: true }) : []),
  ])];
}

/** A `.env` beside the build, if there is one: Node reads it into `process.env`, and the command line still wins. */
export function carregarEnv(caminho = join(process.cwd(), '.env'), carregar = process.loadEnvFile) {
  try { if (existsSync(caminho)) carregar.call(process, caminho); return true; } catch { return false; }
}

// Run as a program (directly, or through the `inclusionist-heavy` shim, which may be a symlink): compare real paths.
const executado = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (executado) {
  carregarEnv();
  const { destino, kokoro, reading, commands, libras, librasTexts, librasSetup, fonts, base } = argumentosDaEntrega(process.argv.slice(2));
  if (librasSetup) {
    try { console.log(`the Libras glosser's environment is ready: ${setUpGlosser()}`); process.exit(0); }
    catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); }
  }
  if (!destino) {
    console.error('usage: inclusionist-heavy <delivery folder, e.g. dist> [--kokoro] [--reading [all|pt|en|es|none]]… '
      + '[--commands pt|en|es|none]… [--fonts <family,…|all|none>]… [--libras] [--libras-texts <file>]… | --libras-setup');
    if (reading.some((v) => v !== 'all')) console.error(`(the value after --reading is read as a language: «${reading.join(' ')}» — put the folder first)`);
    process.exit(2);
  }
  const modulo = moduloDoPacote();
  if (!existsSync(fileURLToPath(modulo))) { console.error('dist-pkg/platform/heavy.js is missing beside this script: in the engine repository, run `npm run build:pkg` first'); process.exit(2); }
  const { HEAVY_FILES, deliveryPath, heavyAtBoot } = await import(modulo);
  const { heavySourceOf } = await import(new URL('../dist-pkg/platform/heavy-mirror.js', import.meta.url).href);
  const { LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_STAGE_CHUNK, DELIVERY_LISTS, commandsLanguageOf, readingLanguageOf } = await import(new URL('../dist-pkg/platform/heavy-catalogue.js', import.meta.url).href);
  // 📌 THE LANGUAGES FIRST, reading and command, before a byte is downloaded: a language the catalogue has no model for stops
  // here, named
  let read, spoken, typefaces;
  // the ENGINE's font catalogue, from the package beside this script — the sha256 every delivered face must have (ADR-0255)
  const library = JSON.parse(readFileSync(new URL('../dist-pkg/platform/font-library.json', import.meta.url), 'utf8'));
  try {
    read = readingLanguagesOfTheDelivery(reading, HEAVY_FILES, readingLanguageOf);
    spoken = commandLanguagesOfTheDelivery(commands, HEAVY_FILES, commandsLanguageOf);
    typefaces = fontFamiliesOfTheDelivery(fonts, library);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
  let librasGlosses = '';
  let stageChunk = '';
  if (libras) {
    const { LIBRAS_GLOSSES_FILE } = await import(new URL('../dist-pkg/ui/libras-glosses.js', import.meta.url).href);
    const { default: enginePt } = await import(new URL('../dist-pkg/i18n/pt.js', import.meta.url).href);
    try {
      // 📌 THE STAGE CHUNK AND THE GLOSSES FIRST, before a byte is downloaded: a build that never emitted the player, or a build
      // machine with no glosser, learns it in a second, not after 32 MiB
      stageChunk = stageChunkOf(destino, LIBRAS_AVATAR_STAGE_CHUNK);
      const games = await Promise.all(librasTexts.map((file) => readTexts(file)));
      const made = await deliverLibrasGlosses({
        destino, folder: LIBRAS_AVATAR_FOLDER, glossesFile: LIBRAS_GLOSSES_FILE, dictionaries: [enginePt, ...games],
        translate: (inputs) => runGlosser(inputs),
      });
      console.log(`glosses   ${made.path} — ${made.texts} texts (the engine's${games.length ? ` and ${games.length} of the game's` : ''}), `
        + `${made.tokens} sign names`);
      console.log(`signs     ${made.signed.length} signed by the avatar's clips; ${made.fingerspelled.length} with no clip are fingerspelled `
        + '(scripts/libras-avatar.json)');
      const { spelled } = made;
      console.log(`spelled   ${spelled.tokens} tokens: ${spelled.asWritten} as written on the screen (${spelled.ambiguous} of them `
        + `chosen by sentence order among several spellings, ${spelled.byStem} by the word's start), ${spelled.asTranslated} `
        + 'as the translator wrote them (no written word gives them)');
      librasGlosses = made.path;
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error('the Libras glosses were not made: a delivery built with --libras is not written without them');
      process.exit(1);
    }
  }
  const ids = idsOfTheDelivery({ kokoro, reading, commands, libras },
    { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf, readingLanguageOf });
  console.log(`commands  ${spoken.length ? spoken.join(', ') : 'none'}${commands.length ? '' : ' (every language, the default)'}`);
  console.log(`reading   ${read.length ? read.join(', ') : 'none'}${reading.includes('all') ? ' (every language)' : ''}`);
  if (base) console.log(`base: ${base}`);
  const { ok, linhas, licences } = await levarPesadosParaEntrega({
    destino, pesados: HEAVY_FILES.filter((p) => ids.includes(p.id)), deliveryPath, base, fonteDe: heavySourceOf, catalogue: HEAVY_FILES,
  });
  for (const l of linhas) console.log(`${l.outcome.padEnd(9)} ${l.id}${(l.error ?? l.note) ? ` — ${l.error ?? l.note}` : ''}`);
  for (const l of licences) console.log(`licence   ${l.key} — ${l.folders.length} folder(s)`);
  if (licences.length) console.log('notices   heavy/THIRD-PARTY-NOTICES.md');
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
  if (typefaces.length) {
    const made = await levarFontesParaEntrega({ destino, families: typefaces, library, deliveryPath, base, fonteDe: heavySourceOf });
    const written = made.linhas.filter((l) => l.outcome === 'escrito');
    for (const l of made.linhas.filter((x) => x.outcome === 'falhou')) console.log(`falhou    ${l.id} — ${l.error}`);
    console.log(`fonts     ${typefaces.length} families of the library — ${written.length} faces written, `
      + `${made.linhas.filter((l) => l.outcome === 'ja-tinha').length} already there, each checked by sha256`
      + `${made.ok ? ', each family with its licence and NOTICE.txt' : ''}`);
    if (!made.ok) { console.error('a library font failed: its family is not delivered whole, and nothing unchecked was written'); process.exit(1); }
  }
  if (libras) {
    try {
      const pins = readAvatarPins();
      const { files, bytes } = await deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins, base });
      console.log(`avatar    ${LIBRAS_AVATAR_FOLDER} — ${files} files, ${(bytes / 1048576).toFixed(1)} MiB (ADR-0234)`);
      // LAST, so it names what is really on the disk: the list a device keeps the player offline by (pillar 8)
      const list = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
      const listed = writeAvatarList({ destino, list, folder: LIBRAS_AVATAR_FOLDER, pins, stageChunk, glosses: librasGlosses });
      console.log(`offline   ${listed.path} — ${listed.files} files (${stageChunk} among them), ${listed.bytes} bytes, each with its sha256`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error('the Libras player was not delivered: this delivery cannot sign');
      process.exit(1);
    }
  }
}
