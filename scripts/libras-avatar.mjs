// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE FREE PLAYER'S FILES INTO A DELIVERY (ADR-0234, route B, phase B2): `inclusionist-heavy <folder> --libras-avatar` puts the
// avatar and every sign clip of the B1 export (`scripts/libras-export.mjs`) into `<folder>/libras/avatar/`, each checked by
// sha256 against `libras-avatar.json`, and writes the manifest the player reads (`ui/libras-avatar-plan`), the GPL-3.0 text
// and the notice beside them. Nothing unchecked is written: a file whose bytes differ stops the delivery by name.
//
// WHERE FROM: the pins' `source`, the project's own mirror — the exports were made by this project, so there is no upstream
// (like the reading models, ADR-0203) — or, with `--base`, the folder `mirror` names under it. ⚠️ THE MIRROR DOES NOT HOLD THEM
// YET: nothing was uploaded, so a delivery without a base answers 404 for the avatar and stops, and a FOLDER on the build machine
// laid out as `<base>/<mirror>/avatar.glb` and `<base>/<mirror>/clips/<NAME>.json` (the B1 export's own layout) is what works.
//
// THE WINDOWS: one clip does not start where its sign starts. The export of FALA begins at a keyframe 1404 frames before the
// sign — its action spans frames −1404 to 60 in the .blend — so the clip holds 46.8 s of a slow drift toward the sign before
// the sign itself. It is not trimmed out of the file (its bytes are the export's, pinned); the pins say where the sign starts,
// with why, and the player plays from there (`ClipWindow.from`). `--pins-from` writes that into the pins it regenerates.
//
// OFFLINE (ADR-0234, phase B3; pillar 8): none of these files is in the precache — they are written after the build — and neither
// is the stage chunk that carries three.js, which the precache leaves out on purpose. `writeAvatarList` names them all in
// `libras/offline-avatar.json` with the sha256 of what is on the disk, and a device with deaf mode on keeps each file only if its
// bytes are the listed ones (`platform/heavy`), where the service worker answers the free player from offline.
//
// USAGE (regenerating the pins from an export; the repository never holds the export itself):
//   node scripts/libras-avatar.mjs --pins-from <the export's --out folder>

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AVATAR_PINS = fileURLToPath(new URL('./libras-avatar.json', import.meta.url));
const GPL_3 = new URL('./licences/GPL-3.0.txt', import.meta.url);
const sha256OfNode = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The avatar's file in the delivery's folder, as the manifest names it. */
export const AVATAR_FILE = 'avatar.glb';
/** The manifest the player reads in the delivery's folder (`ui/libras-avatar-plan.LIBRAS_AVATAR_MANIFEST`). */
const MANIFEST_FILE = 'manifest.json';
/** A clip's file in the delivery's folder: the sign's name as the export wrote it. */
export const clipFile = (name) => `clips/${name}.json`;

/**
 * WHERE A SIGN STARTS, for the clips whose export does not start with it, and why — a clip missing here plays from its start.
 * `frame` is the first frame of the sign counted from the export's first; the pins keep it in seconds, at the clip's rate.
 */
export const WINDOWS = Object.freeze({
  FALA: { frame: 1404, why: 'the .blend\'s action spans frames -1404 to 60: a stray keyframe 1404 frames before the sign, '
    + 'which the export sampled from, so the sign starts 46.8 s into the clip' },
});

/**
 * The pins, from a B1 export's `manifest.json`: the commit and tools that made it, the avatar and every clip with its bytes,
 * sha256 and length, and `from` for the clips `windows` names.
 */
export function avatarPinsFromExport(exported, windows = WINDOWS) {
  const clips = {};
  for (const name of Object.keys(exported.clips).sort()) {
    const c = exported.clips[name];
    if (c.file !== clipFile(name)) throw new Error(`the export names ${name}'s clip ${c.file}, not ${clipFile(name)}`);
    const w = windows[name];
    clips[name] = { bytes: c.bytes, sha256: c.sha256, duration: c.duration, ...(w ? { from: Math.round((w.frame / c.fps) * 1e4) / 1e4 } : {}) };
  }
  return {
    comment: [
      'THE FREE LIBRAS PLAYER\'S FILES (ADR-0234, route B; scripts/libras-avatar.mjs): the avatar and one three.js clip per sign,',
      'exported by scripts/libras-export.mjs from LAViD-UFPB vlibras-dictionary-sources (GPL-3.0) at `commit`, each pinned by sha256',
      'and byte count. Their Corresponding Source is each sign\'s .blend (scripts/libras-export/sources.json) plus the two export',
      'scripts, run with the Blender named here. `from` is where a sign starts in a clip whose export does not start with it',
      '(`windows`, and why). Written by `node scripts/libras-avatar.mjs --pins-from <export>`.',
    ],
    commit: exported.commit,
    blender: exported.blender,
    exporter: exported.exporter,
    source: `https://lfs-oinclusionista.jrocha.dev.br/vlibras-avatar-${exported.commit.slice(0, 7)}/`,
    mirror: `vlibras-avatar-${exported.commit.slice(0, 7)}/`,
    windows: Object.fromEntries(Object.entries(windows).filter(([n]) => clips[n]).map(([n, w]) => [n, w.why])),
    avatar: { bytes: exported.avatar.bytes, sha256: exported.avatar.sha256 },
    clips,
  };
}

/** The pins as the repository keeps them: one line per clip, so a changed sign is a one-line diff. */
export function avatarPinsText(pins) {
  const { clips, ...head } = pins;
  const lines = Object.keys(clips).map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(clips[k]).replace(/,"/g, ', "').replace(/":/g, '": ')}`);
  return JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "clips": {\n${lines.join(',\n')}\n  }\n}\n`);
}

export function readAvatarPins(path = AVATAR_PINS) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Where the files are read from: the pins' `source`, or — with a delivery's `--base` — the folder `mirror` names under it. */
export function avatarSourceOf(pins, base = '') {
  if (!base) return pins.source;
  return `${base.replace(/[/\\]+$/, '')}/${pins.mirror}`;
}

/** The manifest the player reads (`ui/libras-avatar-plan` `avatarManifestOf`): the avatar's file and each clip with its window. */
export function deliveredManifest(pins) {
  const clips = {};
  for (const [name, c] of Object.entries(pins.clips)) {
    clips[name] = { file: clipFile(name), duration: c.duration, ...(c.from ? { from: c.from } : {}) };
  }
  return { format: 1, commit: pins.commit, avatar: AVATAR_FILE, clips };
}

/**
 * Puts the avatar and every pinned clip into `<destino>/<folder>`, checked by sha256 — from `base` (see `avatarSourceOf`) when
 * one is given, else from the pins' `source` — then the manifest, `LICENSE` (GPL-3.0) and `NOTICE`. Returns `{ files, bytes }`.
 * THROWS on a file whose bytes are not the pinned ones, or that cannot be read: nothing unchecked reaches a delivery.
 */
export async function deliverLibrasAvatar({ destino, folder, pins, base = '', fetch: fetchFile = fetch,
  read = (p) => readFileSync(p), sha256 = sha256OfNode }) {
  const from = avatarSourceOf(pins, base);
  const remote = /^https?:\/\//i.test(from);
  const bytesOf = async (rel) => {
    if (!remote) return read(join(from, rel));
    const address = `${from.replace(/\/?$/, '/')}${rel.split('/').map(encodeURIComponent).join('/')}`;
    const resp = await fetchFile(address);
    if (!resp.ok) throw new Error(`the Libras avatar's ${rel} could not be fetched: HTTP ${resp.status} — ${address}`);
    return Buffer.from(await resp.arrayBuffer());
  };
  const files = [[AVATAR_FILE, pins.avatar], ...Object.entries(pins.clips).map(([name, c]) => [clipFile(name), c])];
  let bytes = 0;
  for (const [rel, pin] of files) {
    const target = join(destino, folder, rel);
    if (existsSync(target) && sha256(readFileSync(target)) === pin.sha256) { bytes += pin.bytes; continue; }
    const body = await bytesOf(rel);
    const got = sha256(body);
    if (got !== pin.sha256) throw new Error(`REFUSED the Libras avatar's ${rel}: sha256 ${got}, pinned ${pin.sha256} — not written`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    bytes += body.length;
  }
  writeFileSync(join(destino, folder, MANIFEST_FILE), `${JSON.stringify(deliveredManifest(pins), null, 1)}\n`);
  writeFileSync(join(destino, folder, 'LICENSE'), readFileSync(GPL_3));
  writeFileSync(join(destino, folder, 'NOTICE'), 'The avatar (avatar.glb) and the sign clips (clips/) in this folder are derived from '
    + 'LAViD-UFPB\'s VLibras dictionary sources (vlibras-dictionary-sources, GPL-3.0, '
    + `https://gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources, commit ${pins.commit}): each sign's `
    + `.blend file, exported with Blender ${pins.blender} (${pins.exporter}) by The Inclusionist's scripts/libras-export.mjs and `
    + 'scripts/libras-export/export.py. Their Corresponding Source is those .blend files (pinned by sha256 in '
    + 'scripts/libras-export/sources.json) and the two scripts, in the engine\'s repository, '
    + 'https://github.com/the-inclusionist/the-inclusionist-engine. Licensed under the GPL-3.0, whose text is LICENSE, beside this file.\n');
  return { files: files.length, bytes };
}

/**
 * THE STAGE CHUNK THE BUILD EMITTED, relative to the delivery: the one file under `start`'s folder whose name begins with `start`'s
 * last segment and ends in `.js` (`platform/heavy-catalogue.LIBRAS_AVATAR_STAGE_CHUNK`; the bundler adds a content hash). THROWS
 * when there is none — this build never emitted the free player, or put it elsewhere — or more than one, left by an earlier build:
 * listing a stale chunk would keep bytes the page never asks for, and guessing would keep the wrong one.
 */
export function stageChunkOf(destino, start, list = (dir) => readdirSync(dir)) {
  const folder = posix.dirname(start);
  const begins = posix.basename(start);
  let names = [];
  try { names = list(join(destino, folder)); } catch { /* no such folder: none found, said below */ }
  const found = names.filter((name) => name.startsWith(begins) && name.endsWith('.js') && name.length > begins.length + 3);
  if (found.length !== 1) {
    throw new Error(`the free Libras player's stage chunk (${start}<hash>.js) was found ${found.length} times in ${join(destino, folder)}`
      + `${found.length ? `: ${found.join(', ')}` : ''} — build the page again (with an emptied output folder) before \`--libras-avatar\`, `
      + 'so the delivery can list the one chunk the page loads');
  }
  return `${folder}/${found[0]}`;
}

/** What the free player's list names, in the order it opens them: the manifest, the avatar, every clip, then the stage chunk. */
export function avatarListPaths({ folder, pins, stageChunk }) {
  return [`${folder}${MANIFEST_FILE}`, `${folder}${AVATAR_FILE}`, ...Object.keys(pins.clips).map((name) => `${folder}${clipFile(name)}`),
    stageChunk];
}

/**
 * WRITES A LIST A DEVICE KEEPS A DELIVERY'S OWN FILES OFFLINE BY (`platform/heavy-catalogue.DELIVERY_LISTS`): each of `paths`,
 * relative to `destino`, with the sha256 and size of the bytes on the disk — what this delivery wrote, read back. Returns the
 * list's path, the number of files and their bytes. THROWS, writing nothing, on a path outside the list's folders: the device
 * would refuse it.
 */
export function writeDeliveryList({ destino, list, paths, read = (p) => readFileSync(p), sha256 = sha256OfNode }) {
  const files = paths.map((path) => {
    if (!list.folders.some((folder) => path.startsWith(folder)) || path.split('/').includes('..')) {
      throw new Error(`the list ${list.path} cannot name ${path}: only files under ${list.folders.join(', ')} are kept from it`);
    }
    const bytes = read(join(destino, path));
    return { path, sha256: sha256(bytes), bytes: bytes.length };
  });
  mkdirSync(dirname(join(destino, list.path)), { recursive: true });
  writeFileSync(join(destino, list.path), `${JSON.stringify({ format: 1, files }, null, 1)}\n`);
  return { path: list.path, files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0) };
}

/**
 * WRITES THE LIST A DEVICE KEEPS THE FREE PLAYER OFFLINE BY (`list`, the catalogue's `libras:avatar:delivery`): each file of
 * `avatarListPaths` with the sha256 and size of the bytes on the disk (`writeDeliveryList`). `stageChunk` is found first
 * (`stageChunkOf`), so a build with no chunk stops the step before any list is written.
 */
export function writeAvatarList({ destino, list, folder, pins, stageStart, stageChunk = stageChunkOf(destino, stageStart), read }) {
  return writeDeliveryList({ destino, list, paths: avatarListPaths({ folder, pins, stageChunk }), ...(read ? { read } : {}) });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf('--pins-from');
  if (at < 0 || !process.argv[at + 1]) {
    console.error('usage: node scripts/libras-avatar.mjs --pins-from <the export\'s --out folder>');
    process.exit(2);
  }
  const exported = JSON.parse(readFileSync(join(process.argv[at + 1], 'manifest.json'), 'utf8'));
  writeFileSync(AVATAR_PINS, avatarPinsText(avatarPinsFromExport(exported)));
  console.log(`${AVATAR_PINS}: the avatar and ${Object.keys(exported.clips).length} clips`);
}
