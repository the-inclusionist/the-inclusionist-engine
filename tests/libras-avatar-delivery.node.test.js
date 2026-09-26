// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FREE PLAYER'S FILES INTO A DELIVERY (ADR-0234, route B, phase B2; `scripts/libras-avatar.mjs`, run by
// `inclusionist-heavy <folder> --libras-avatar`). No network and no export here: the files are fakes whose sha256 the case pins
// itself, and the real pins (`scripts/libras-avatar.json`) are held for their shape and for the one window they declare.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  avatarPinsFromExport, avatarPinsText, avatarSourceOf, deliverLibrasAvatar, deliveredManifest, readAvatarPins, WINDOWS,
  stageChunkOf, writeAvatarList,
} from '../scripts/libras-avatar.mjs';
import { DELIVERY_LISTS, LIBRAS_AVATAR_STAGE_CHUNK } from '../app/js/platform/heavy-catalogue.js';
import { COMMIT } from '../scripts/libras-export.mjs';
import { avatarManifestOf, LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_MANIFEST, playedLength } from '../app/js/ui/libras-avatar-plan.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const FILES = {
  'avatar.glb': Buffer.from('glTF fake avatar'),
  'clips/GATO.json': Buffer.from('{"name":"GATO","duration":2,"tracks":[]}'),
  'clips/NÃO_ABRIR.json': Buffer.from('{"name":"NÃO_ABRIR","duration":2,"tracks":[]}'),
  'clips/FALA.json': Buffer.from('{"name":"FALA","duration":48.8,"tracks":[]}'),
};
const pin = (rel) => ({ bytes: FILES[rel].length, sha256: sha(FILES[rel]) });
const PINS = {
  commit: COMMIT, blender: '5.2.2 LTS', exporter: 'Khronos glTF Blender I/O v5.2.40',
  source: 'https://mirror.example/vlibras-avatar-f8ddb37/', mirror: 'vlibras-avatar-f8ddb37/',
  avatar: pin('avatar.glb'),
  clips: {
    GATO: { ...pin('clips/GATO.json'), duration: 2 },
    NÃO_ABRIR: { ...pin('clips/NÃO_ABRIR.json'), duration: 2 },
    FALA: { ...pin('clips/FALA.json'), duration: 48.8, from: 46.8 },
  },
};

function delivery() {
  const destino = mkdtempSync(join(tmpdir(), 'libras-avatar-'));
  return { destino, done: () => rmSync(destino, { recursive: true, force: true }) };
}

describe('scripts/libras-avatar — the avatar and the clips, checked, into `libras/avatar/`', () => {
  it('🔴 [Right] every pinned file is written where the player asks for it, with the manifest it reads, the GPL-3.0 and the notice', async () => {
    const { destino, done } = delivery();
    try {
      const read = (p) => { const rel = p.split(/[\\/]vlibras-avatar-f8ddb37[\\/]/)[1].split('\\').join('/'); return FILES[rel]; };
      const got = await deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, base: 'D:\\lfs', read });
      expect(got.files).toBe(4);
      for (const rel of Object.keys(FILES)) {
        expect(readFileSync(join(destino, LIBRAS_AVATAR_FOLDER, rel)).equals(FILES[rel]), rel).toBe(true);
      }
      // read where the PLAYER looks for it: the script writes the name itself, and the two must agree
      const manifest = avatarManifestOf(JSON.parse(readFileSync(join(destino, LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_MANIFEST), 'utf8')));
      expect(manifest, 'the player does not read the manifest the delivery writes').not.toBeNull();
      expect(manifest.clips.get('NÃO_ABRIR')).toEqual({ file: 'clips/NÃO_ABRIR.json', duration: 2, from: 0 });
      expect(playedLength(manifest.clips.get('FALA')), 'FALA\'s window did not reach the player').toBeCloseTo(2, 9);
      expect(readFileSync(join(destino, LIBRAS_AVATAR_FOLDER, 'LICENSE'), 'utf8')).toMatch(/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
      const notice = readFileSync(join(destino, LIBRAS_AVATAR_FOLDER, 'NOTICE'), 'utf8');
      expect(notice).toMatch(/LAViD-UFPB/);
      expect(notice).toContain(COMMIT);
      expect(notice, 'the notice does not say where the Corresponding Source is').toMatch(/Corresponding Source .*libras-export\/sources\.json/s);
    } finally { done(); }
  });

  it('🔴 [Right] a file whose bytes are not the pinned ones is REFUSED by name, and not written', async () => {
    const { destino, done } = delivery();
    try {
      const read = (p) => (p.includes('GATO') ? Buffer.from('other bytes') : FILES[p.split(/[\\/]vlibras-avatar-f8ddb37[\\/]/)[1].split('\\').join('/')]);
      await expect(deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, base: 'D:\\lfs', read }))
        .rejects.toThrow(/REFUSED the Libras avatar's clips\/GATO\.json/);
      expect(existsSync(join(destino, LIBRAS_AVATAR_FOLDER, 'clips', 'GATO.json'))).toBe(false);
    } finally { done(); }
  });

  it('🔴 [Right] from an address, each file is asked by its encoded name, and a 404 stops the delivery by name', async () => {
    const { destino, done } = delivery();
    try {
      const asked = [];
      const fetch = async (url) => {
        asked.push(url);
        const rel = decodeURIComponent(url.slice(PINS.source.length));
        return FILES[rel] ? new Response(FILES[rel]) : new Response('', { status: 404 });
      };
      await deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, fetch });
      expect(asked).toContain(`${PINS.source}clips/N%C3%83O_ABRIR.json`);
      const missing = { ...PINS, clips: { ...PINS.clips, PEIXE: { bytes: 1, sha256: 'x', duration: 1 } } };
      await expect(deliverLibrasAvatar({ destino, folder: LIBRAS_AVATAR_FOLDER, pins: missing, fetch }))
        .rejects.toThrow(/clips\/PEIXE\.json could not be fetched: HTTP 404/);
    } finally { done(); }
  });

  it('[Right] a base reads the mirror\'s folder under it; no base, the pins\' source', () => {
    expect(avatarSourceOf(PINS, 'D:\\lfs\\')).toBe('D:\\lfs/vlibras-avatar-f8ddb37/');
    expect(avatarSourceOf(PINS)).toBe(PINS.source);
  });
});

/**
 * 🔴 THE LIST A DEVICE KEEPS THE FREE PLAYER OFFLINE BY (ADR-0234, phase B3). 📏 Measured on a served delivery (2026-09-25): with
 * deaf mode on, nothing of route B reached the checked cache — the delivery named none of it — and the stage chunk, left out of
 * the precache on purpose, was fetched from the network at the first sign.
 */
describe('scripts/libras-avatar — the list of the free player\'s files, the stage chunk among them', () => {
  const LIST = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
  const STAGE = 'libras-avatar-stage-fyxZVSPc.js';
  const withFiles = (extra = {}) => {
    const d = delivery();
    const all = { ...Object.fromEntries(Object.entries(FILES).map(([rel, b]) => [`${LIBRAS_AVATAR_FOLDER}${rel}`, b])),
      [`${LIBRAS_AVATAR_FOLDER}manifest.json`]: Buffer.from('{"format":1}'), [`assets/${STAGE}`]: Buffer.from('three'),
      'assets/pixi-X1y2Z3w4.js': Buffer.from('the page'), ...extra };
    for (const [rel, b] of Object.entries(all)) { mkdirSync(dirname(join(d.destino, rel)), { recursive: true }); writeFileSync(join(d.destino, rel), b); }
    return { ...d, all };
  };

  it('🔴 [Right] it names the manifest, the avatar, every clip and the ONE stage chunk the build emitted, each with the sha256 on the disk', () => {
    const d = withFiles();
    try {
      const made = writeAvatarList({ destino: d.destino, list: LIST, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, stageStart: LIBRAS_AVATAR_STAGE_CHUNK });
      const written = JSON.parse(readFileSync(join(d.destino, LIST.path), 'utf8'));
      const paths = [`${LIBRAS_AVATAR_FOLDER}manifest.json`, `${LIBRAS_AVATAR_FOLDER}avatar.glb`,
        ...Object.keys(PINS.clips).map((n) => `${LIBRAS_AVATAR_FOLDER}clips/${n}.json`), `assets/${STAGE}`];
      expect(written).toEqual({ format: 1, files: paths.map((path) => ({ path, sha256: sha(d.all[path]), bytes: d.all[path].length })) });
      expect(made).toEqual({ path: LIST.path, files: paths.length, bytes: paths.reduce((s, p) => s + d.all[p].length, 0) });
      expect(written.files.map((f) => f.path), 'a precached asset of the page was listed').not.toContain('assets/pixi-X1y2Z3w4.js');
    } finally { d.done(); }
  });

  it('🔴 [Right] no stage chunk, or two, stops the step by name — and no list is written', () => {
    for (const [what, extra] of [['none', null], ['two', { [`assets/libras-avatar-stage-0ld0ne12.js`]: Buffer.from('stale') }]]) {
      const d = withFiles(extra ?? {});
      try {
        if (!extra) rmSync(join(d.destino, 'assets', STAGE));
        expect(() => writeAvatarList({ destino: d.destino, list: LIST, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, stageStart: LIBRAS_AVATAR_STAGE_CHUNK }), what)
          .toThrow(new RegExp(`stage chunk \\(assets/libras-avatar-stage-<hash>\\.js\\) was found ${extra ? 2 : 0} times`));
        expect(existsSync(join(d.destino, LIST.path)), `${what}: a list was written`).toBe(false);
      } finally { d.done(); }
    }
  });

  it('📌 [Boundary] only a `.js` whose name carries more than the start counts: a map, a bare name or another folder do not', () => {
    const names = ['libras-avatar-stage-.js', 'libras-avatar-stage-abc.js.map', 'libras-avatar-stage-abc.css', 'other-libras-avatar-stage-abc.js',
      'libras-avatar-stage-abc.js'];
    expect(stageChunkOf('D:\\x', LIBRAS_AVATAR_STAGE_CHUNK, () => names)).toBe('assets/libras-avatar-stage-abc.js');
    expect(() => stageChunkOf('D:\\x', LIBRAS_AVATAR_STAGE_CHUNK, () => { throw new Error('ENOENT'); })).toThrow(/found 0 times/);
  });
});

describe('scripts/libras-avatar.json — the pins the repository keeps', () => {
  const pins = readAvatarPins();

  it('🔴 [Right] they are the B1 export at the pinned commit: the avatar and the 632 clips, the digits among them', () => {
    expect(pins.commit).toBe(COMMIT);
    expect(pins.mirror).toBe(`vlibras-avatar-${COMMIT.slice(0, 7)}/`);
    expect(pins.avatar).toEqual({ bytes: 2175208, sha256: '60a166b6ac3af4c9bc773193c32bccd45536746b195ee85d597484f2653d26f8' });
    expect(Object.keys(pins.clips)).toHaveLength(632);
    for (const d of '0123456789') expect(pins.clips[d], `the digit ${d} has no clip`).toBeDefined();
    for (const [name, c] of Object.entries(pins.clips)) {
      expect(c.sha256, name).toMatch(/^[0-9a-f]{64}$/);
      expect(c.duration, name).toBeGreaterThan(0);
    }
  });

  it('🎯 [Right] FALA plays from its sign, 46.8 s in, and the pins say why; no other clip has a window', () => {
    expect(pins.clips.FALA.from).toBe(46.8);
    expect(pins.windows.FALA).toMatch(/-1404/);
    expect(Object.entries(pins.clips).filter(([, c]) => c.from !== undefined).map(([n]) => n)).toEqual(['FALA']);
    expect(avatarManifestOf(deliveredManifest(pins)).clips.size).toBe(632);
  });

  it('[Right] regenerated from an export\'s manifest, the pins carry the window at the clip\'s own rate, as text one clip a line', () => {
    const exported = { commit: COMMIT, blender: 'b', exporter: 'e', avatar: { bytes: 1, sha256: 'a' }, clips: {
      FALA: { file: 'clips/FALA.json', bytes: 2, sha256: 'f', duration: 48.8, fps: 30 },
      GATO: { file: 'clips/GATO.json', bytes: 3, sha256: 'g', duration: 2, fps: 30 } } };
    const made = avatarPinsFromExport(exported, WINDOWS);
    expect(made.clips.FALA.from).toBe(46.8);
    expect(made.clips.GATO.from).toBeUndefined();
    const text = avatarPinsText(made);
    expect(JSON.parse(text)).toEqual(made);
    expect(text).toMatch(/\n {4}"GATO": \{"bytes": 3, "sha256": "g", "duration": 2\}/);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-25, scripted: each applied to `scripts/libras-avatar.mjs`, this file run, the script restored from a copy — all 5 red)
//   D1 the sha256 not checked                                            🔴 «REFUSED by name»
//   D2 a clip asked for by its raw name                                  🔴 «encoded name»
//   D3 the regenerated pins without FALA's window                        🔴 «regenerated from an export»
//   D4 the delivered manifest without `from`                             🔴 «every pinned file is written»
//   D5 the notice without the Corresponding Source                       🔴 «every pinned file is written»
// (2026-09-25, phase B3, the same script: each applied, this file run, the file restored from a copy and checked by hash — 5 of 5 red)
//   L1 the stage chunk left out of the list                              🔴 «the ONE stage chunk the build emitted»
//   L2 two stage chunks accepted, the first one listed                   🔴 «no stage chunk, or two»
//   L3 the manifest left out of the list                                 🔴 «the ONE stage chunk the build emitted»
//   L4 any file with the chunk's start taken, not only a .js             🔴 «only a `.js`»
//   L5 the list hashing something other than the bytes on the disk      🔴 «the sha256 on the disk» (in `scripts/vlibras-player.mjs`)
