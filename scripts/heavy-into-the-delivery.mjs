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
// WHAT THE FILES OWE TRAVELS WITH THEM (`licences/third-party.mjs`): every folder of `heavy/` that holds a file also gets its
// project's `LICENSE` and `NOTICE` (eSpeak NG's also a `SOURCE`), and `heavy/THIRD-PARTY-NOTICES.md` lists each project. A
// catalogue entry whose licence nobody recorded there is refused like a file whose sha256 differs.

import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { THIRD_PARTY, groupOf, writeLicences } from './licences/third-party.mjs';
import { deliverLibrasPlayer, writeDeliveryList, librasListPaths } from './vlibras-player.mjs';
import { deliverLibrasGlosses, readSignPins, readTexts, runGlosser, setUpGlosser } from './libras-glosses.mjs';
import { deliverLibrasAvatar, readAvatarPins } from './libras-avatar.mjs';

/** The compiled catalogue of the package this script ships in — beside it, whatever folder the build runs from. */
export function moduloDoPacote() {
  return new URL('../dist-pkg/platform/heavy.js', import.meta.url).href;
}

const sha256DoNode = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

/**
 * Fetches, checks and writes every entry with an address, then the licence files beside them. Returns one line per entry and
 * the licence folders written (`licences`); `ok` is false when any file — or the licences — failed.
 * Everything is injected so a gate can run it without the network.
 */
export async function levarPesadosParaEntrega({ destino, pesados, deliveryPath, fetch: buscar = fetch, sha256 = sha256DoNode,
  base = '', fonteDe = (url) => url, lerLocal = (caminho) => readFileSync(caminho), thirdParty = THIRD_PARTY }) {
  const linhas = [];
  const present = [];
  for (const p of pesados) {
    if (!p.url) { linhas.push({ id: p.id, outcome: 'sem-fonte' }); continue; }
    // made HERE from another entry, after this loop (the patched VLibras framework): nothing upstream serves its address
    if (p.madeFrom) { linhas.push({ id: p.id, outcome: 'derived', note: `made by the delivery from ${p.madeFrom}` }); continue; }
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
    const fonte = fonteDe(p.url, base);
    const daRede = /^https?:\/\//i.test(fonte);
    try {
      let corpo;
      if (daRede) {
        const resp = await buscar(fonte);
        if (!resp.ok) { linhas.push({ id: p.id, outcome: 'falhou', error: `HTTP ${resp.status} — ${fonte}` }); continue; }
        corpo = await resp.arrayBuffer();
      } else {
        corpo = lerLocal(fonte);
      }
      const obtido = sha256(corpo);
      if (!p.sha256 || obtido !== p.sha256) {
        linhas.push({ id: p.id, outcome: 'falhou', error: `sha256 mismatch at ${fonte}: expected ${p.sha256}, got ${obtido} — not written` });
        continue;
      }
      mkdirSync(dirname(alvo), { recursive: true });
      writeFileSync(alvo, Buffer.from(corpo));
      linhas.push({ id: p.id, outcome: 'escrito', bytes: corpo.byteLength });
      present.push({ id: p.id, path: deliveryPath(p.url) });
    } catch (e) {
      linhas.push({ id: p.id, outcome: 'falhou', error: e instanceof Error ? e.message : String(e) });
    }
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
 * · `--reading <pt|en|es>`, repeatable, for a game that declares `uses: { reading: true }`: each language named puts ITS model in
 *   the delivery (pt 378 MiB, en 162, es 310). A delivery for a school that reads in one language carries one.
 * · `--commands <pt|en|es>`, repeatable: the voice COMMANDS (issue #184), 31–39 MiB a language plus 3.1 MiB of runtime. No game
 *   declares this one — saying «menu» is a way into the controller, not a feature (ADR-0111). WITHOUT THE FLAG THE DELIVERY
 *   CARRIES EVERY LANGUAGE the catalogue has a command model for — pt, en and es, 108 MiB (ADR-0225 erratum, the Dev: «A entrega
 *   leva as três línguas.») — because the child can switch language mid-game and her model must already be there. The flag
 *   NARROWS: the languages named, and only those; `--commands none` carries no command model at all. A language left out is
 *   said to the child who speaks it, and named in `problems` with this fix.
 * · `--libras`: the Libras player deaf mode's interpreter drives (ADR-0234, route A) — the four published VLibras files, 19.3 MiB,
 *   and then the player page with the patched framework (`scripts/vlibras-player.mjs`). No game declares it: deaf mode is the
 *   person's, like speaking is, so the DELIVERY says whether it can sign. Without it the sonar in deaf mode says «signing
 *   unavailable», as it always did. The same step GLOSSES the text a child can be shown (`scripts/libras-glosses.mjs`): the engine's
 *   Portuguese dictionary, always, and the game's own with `--libras-texts <file>`, repeatable (which implies `--libras`) — and
 *   delivers the signs those glosses use that `scripts/libras-signs.json` pins (the engine's: 632, 15.1 MB), from LAViD's
 *   dictionary at a pinned commit or from the pins' `mirror` folder under `--base`, each checked by sha256. It
 *   needs the glosser's environment, built once by `--libras-setup`; without it the delivery STOPS instead of shipping a player
 *   with nothing to sign but letters. Last, it writes `libras/offline.json`, the list of the page, glosses and signs with their
 *   sha256, by which a device with deaf mode on keeps the player for the days without a network.
 * · `--libras-setup`: builds that environment (uv and Python 3.12), and does nothing else.
 * · `--libras-avatar`: the FREE player's files (ADR-0234, route B, phase B2) — the avatar and the 632 sign clips of the B1 export,
 *   32.1 MiB, into `libras/avatar/`, each checked against `scripts/libras-avatar.json` (`scripts/libras-avatar.mjs`). Beside route
 *   A, not instead of it: a host lends the free player through `EngineHost.interpreter`. It reads the glosses `--libras` writes,
 *   so the two go together. Read here, apart from the answers above, so this list's shape stays route A's until phase B3.
 */
export function argumentosDaEntrega(args, ambiente = process.env) {
  // ⚠️ `--base <value>` eats the token after it: without that, the value was read as the delivery folder (caught by its case).
  let destino, base;
  const reading = [];
  const commands = [];
  let libras = false;
  const librasTexts = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--libras') { libras = true; continue; }
    if (args[i] === '--libras-texts') { const v = args[++i]; if (v) { librasTexts.push(v); libras = true; } continue; }
    if (args[i] === '--base') { base = args[++i]; continue; }
    if (args[i] === '--reading') { const v = args[++i]; if (v) reading.push(v); continue; }
    if (args[i] === '--commands') { const v = args[++i]; if (v) commands.push(v); continue; }
    if (!args[i].startsWith('--') && destino === undefined) destino = args[i];
  }
  return { destino, kokoro: args.includes('--kokoro'), reading, commands, libras, librasTexts, librasSetup: args.includes('--libras-setup'),
    base: base ?? ambiente.INCLUSIONIST_HEAVY_BASE ?? '' };
}

/**
 * THE SPOKEN LANGUAGES A DELIVERY CARRIES: those `--commands` named (less `none`, which names nothing), or — when the flag was
 * not given — every language the catalogue has a command model for (ADR-0225 erratum). `languageOf` is the catalogue's
 * `commandsLanguageOf`, so a fourth language with a model is carried by default the day it enters the catalogue.
 */
export function commandLanguagesOfTheDelivery(asked, catalogue, languageOf) {
  if (asked.length) return asked.filter((lingua) => lingua !== 'none');
  return [...new Set(catalogue.map((p) => languageOf(p.id)).filter(Boolean))];
}

/**
 * THE IDS A DELIVERY CARRIES, from the command's answers. One pass per reading language, because the start asks for ONE and the
 * delivery may hold several; the spoken languages go in one list, as the start asks for them.
 */
export function idsOfTheDelivery({ kokoro, reading, commands, libras }, { heavyAtBoot, catalogue, commandsLanguageOf }) {
  const spoken = commandLanguagesOfTheDelivery(commands, catalogue, commandsLanguageOf);
  return [...new Set([
    ...heavyAtBoot({ kokoro }),
    ...reading.flatMap((lingua) => heavyAtBoot({ kokoro: false, reading: lingua })),
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
  const { destino, kokoro, reading, commands, libras, librasTexts, librasSetup, base } = argumentosDaEntrega(process.argv.slice(2));
  if (librasSetup) {
    try { console.log(`the Libras glosser's environment is ready: ${setUpGlosser()}`); process.exit(0); }
    catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); }
  }
  if (!destino) { console.error('usage: inclusionist-heavy <delivery folder, e.g. dist> [--kokoro] [--reading pt|en|es]… [--commands pt|en|es|none]… [--libras] [--libras-texts <file>]… [--libras-avatar] | --libras-setup'); process.exit(2); }
  const modulo = moduloDoPacote();
  if (!existsSync(fileURLToPath(modulo))) { console.error('dist-pkg/platform/heavy.js is missing beside this script: in the engine repository, run `npm run build:pkg` first'); process.exit(2); }
  const { HEAVY_FILES, deliveryPath, heavyAtBoot } = await import(modulo);
  const { heavySourceOf } = await import(new URL('../dist-pkg/platform/heavy-mirror.js', import.meta.url).href);
  // 📌 THE GLOSSES FIRST, before a byte is downloaded: a build machine with no glosser learns it in a second, not after 19 MiB
  const { LIBRAS_PLAYER_FOLDER, LIBRAS_SIGNS_FOLDER, DELIVERY_LISTS, commandsLanguageOf } = await import(new URL('../dist-pkg/platform/heavy-catalogue.js', import.meta.url).href);
  let librasSigns = [];
  let librasGlosses = '';
  if (libras) {
    const { LIBRAS_GLOSSES_FILE } = await import(new URL('../dist-pkg/ui/libras-glosses.js', import.meta.url).href);
    const { default: enginePt } = await import(new URL('../dist-pkg/i18n/pt.js', import.meta.url).href);
    try {
      const games = await Promise.all(librasTexts.map((file) => readTexts(file)));
      const made = await deliverLibrasGlosses({
        destino, playerFolder: LIBRAS_PLAYER_FOLDER, signsFolder: LIBRAS_SIGNS_FOLDER, glossesFile: LIBRAS_GLOSSES_FILE,
        dictionaries: [enginePt, ...games], translate: (inputs) => runGlosser(inputs), pins: readSignPins(), base,
      });
      console.log(`glosses   ${made.path} — ${made.texts} texts (the engine's${games.length ? ` and ${games.length} of the game's` : ''}), `
        + `${made.tokens} sign names`);
      console.log(`signs     ${made.signs.length} carried; ${made.unpinned.length} with no pinned sign are fingerspelled `
        + '(scripts/libras-signs.json)');
      const { spelled } = made;
      console.log(`spelled   ${spelled.tokens} tokens: ${spelled.asWritten} as written on the screen (${spelled.ambiguous} of them `
        + `chosen by sentence order among several spellings, ${spelled.byStem} by the word's start), ${spelled.asTranslated} `
        + 'as the translator wrote them (no written word gives them)');
      librasSigns = made.signs;
      librasGlosses = made.path;
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error('the Libras glosses were not made: a delivery built with --libras is not written without them');
      process.exit(1);
    }
  }
  const ids = idsOfTheDelivery({ kokoro, reading, commands, libras },
    { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf });
  const spoken = commandLanguagesOfTheDelivery(commands, HEAVY_FILES, commandsLanguageOf);
  console.log(`commands  ${spoken.length ? spoken.join(', ') : 'none'}${commands.length ? '' : ' (every language, the default)'}`);
  if (base) console.log(`base: ${base}`);
  const { ok, linhas, licences } = await levarPesadosParaEntrega({
    destino, pesados: HEAVY_FILES.filter((p) => ids.includes(p.id)), deliveryPath, base, fonteDe: heavySourceOf,
  });
  for (const l of linhas) console.log(`${l.outcome.padEnd(9)} ${l.id}${(l.error ?? l.note) ? ` — ${l.error ?? l.note}` : ''}`);
  for (const l of licences) console.log(`licence   ${l.key} — ${l.folders.length} folder(s)`);
  if (licences.length) console.log('notices   heavy/THIRD-PARTY-NOTICES.md');
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
  if (libras) {
    try {
      const written = deliverLibrasPlayer({ destino, catalogue: HEAVY_FILES, deliveryPath, playerFolder: LIBRAS_PLAYER_FOLDER,
        signs: librasSigns });
      for (const path of written) console.log(`player    ${path}`);
      // LAST, so it names what is really on the disk: the list a device keeps the player offline by (pillar 8)
      const list = DELIVERY_LISTS.find((l) => l.id === 'libras:delivery');
      const listed = writeDeliveryList({ destino, list, paths: librasListPaths({ written, glosses: librasGlosses, signs: librasSigns,
        playerFolder: LIBRAS_PLAYER_FOLDER, signsFolder: LIBRAS_SIGNS_FOLDER }) });
      console.log(`offline   ${listed.path} — ${listed.files} files, ${listed.bytes} bytes, each with its sha256`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error('the Libras player was not delivered: this delivery cannot sign');
      process.exit(1);
    }
  }
  if (process.argv.includes('--libras-avatar')) {
    const { LIBRAS_AVATAR_FOLDER } = await import(new URL('../dist-pkg/ui/libras-avatar-plan.js', import.meta.url).href);
    try {
      const { files, bytes } = await deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins: readAvatarPins(), base });
      console.log(`avatar    ${LIBRAS_AVATAR_FOLDER} — ${files} files, ${(bytes / 1048576).toFixed(1)} MiB (ADR-0234, route B)`);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      console.error('the Libras avatar was not delivered: the free player cannot sign in this delivery');
      process.exit(1);
    }
  }
}
