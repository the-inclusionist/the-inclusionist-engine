// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LIBRAS PLAYER'S FILES INTO A DELIVERY (ADR-0234, route B; `scripts/libras-avatar.mjs`, run by
// `inclusionist-heavy <folder> --libras`). No network and no export here: the files are fakes whose sha256 the case pins
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
  stageChunkOf, writeAvatarList, avatarListPaths, writeDeliveryList, heldWindowsOf, isSpelledClip,
} from '../scripts/libras-avatar.mjs';
import { avatarPlace, prepareClips } from '../app/js/ui/libras-avatar-load.js';
import { LIBRAS_GLOSSES_FILE } from '../app/js/ui/libras-glosses.js';
import { DELIVERY_LISTS, LIBRAS_AVATAR_STAGE_CHUNK } from '../app/js/platform/heavy-catalogue.js';
import { COMMIT, MANUAL_ALPHABET, PINS as SOURCE_PINS } from '../scripts/libras-export.mjs';
import {
  avatarManifestOf, LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_MANIFEST, planSigns, playedLength,
} from '../app/js/ui/libras-avatar-plan.js';

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
  const GLOSSES = `${LIBRAS_AVATAR_FOLDER}glosses.json`;
  const withFiles = (extra = {}) => {
    const d = delivery();
    const all = { ...Object.fromEntries(Object.entries(FILES).map(([rel, b]) => [`${LIBRAS_AVATAR_FOLDER}${rel}`, b])),
      [`${LIBRAS_AVATAR_FOLDER}manifest.json`]: Buffer.from('{"format":1}'), [GLOSSES]: Buffer.from('{"format":1,"glosses":[]}'),
      [`assets/${STAGE}`]: Buffer.from('three'),
      'assets/pixi-X1y2Z3w4.js': Buffer.from('the page'), ...extra };
    for (const [rel, b] of Object.entries(all)) { mkdirSync(dirname(join(d.destino, rel)), { recursive: true }); writeFileSync(join(d.destino, rel), b); }
    return { ...d, all };
  };

  it('🔴 [Right] it names the manifest, the avatar, the glosses, every clip and the ONE stage chunk the build emitted, each with the sha256 on the disk', () => {
    const d = withFiles();
    try {
      const made = writeAvatarList({ destino: d.destino, list: LIST, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, glosses: GLOSSES,
        stageStart: LIBRAS_AVATAR_STAGE_CHUNK });
      const written = JSON.parse(readFileSync(join(d.destino, LIST.path), 'utf8'));
      const paths = [`${LIBRAS_AVATAR_FOLDER}manifest.json`, `${LIBRAS_AVATAR_FOLDER}avatar.glb`, GLOSSES,
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
        expect(() => writeAvatarList({ destino: d.destino, list: LIST, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, glosses: GLOSSES,
          stageStart: LIBRAS_AVATAR_STAGE_CHUNK }), what)
          .toThrow(new RegExp(`stage chunk \\(assets/libras-avatar-stage-<hash>\\.js\\) was found ${extra ? 2 : 0} times`));
        expect(existsSync(join(d.destino, LIST.path)), `${what}: a list was written`).toBe(false);
      } finally { d.done(); }
    }
  });

  /**
   * 🔴 THE GLOSSES ARE KEPT WITH THE AVATAR (ADR-0234, phase B3): they live beside it now, and without them kept a device offline
   * would fingerspell every word the build glossed. A list with no glosses named is not written.
   */
  it('🔴 [Right] no glosses named stops the step — and no list is written', () => {
    const d = withFiles();
    try {
      expect(() => writeAvatarList({ destino: d.destino, list: LIST, folder: LIBRAS_AVATAR_FOLDER, pins: PINS, stageStart: LIBRAS_AVATAR_STAGE_CHUNK }))
        .toThrow(/names no glosses/);
      expect(existsSync(join(d.destino, LIST.path))).toBe(false);
    } finally { d.done(); }
  });

  it('🔴 [Right] a path outside the list\'s folders is refused, and no list is written — the device would never keep it', () => {
    const { destino, done } = delivery();
    try {
      writeFileSync(join(destino, 'quiz.html'), 'the game');
      for (const path of ['quiz.html', 'assets/pixi-X1y2Z3w4.js', 'heavy/x/avatar.glb', `${LIBRAS_AVATAR_FOLDER}../../quiz.html`]) {
        expect(() => writeDeliveryList({ destino, list: LIST, paths: [path], read: () => Buffer.from('x') }), path).toThrow(/cannot name/);
      }
      expect(existsSync(join(destino, LIST.path))).toBe(false);
    } finally { done(); }
  });

  it('📌 [Boundary] only a `.js` whose name carries more than the start counts: a map, a bare name or another folder do not', () => {
    const names = ['libras-avatar-stage-.js', 'libras-avatar-stage-abc.js.map', 'libras-avatar-stage-abc.css', 'other-libras-avatar-stage-abc.js',
      'libras-avatar-stage-abc.js'];
    expect(stageChunkOf('D:\\x', LIBRAS_AVATAR_STAGE_CHUNK, () => names)).toBe('assets/libras-avatar-stage-abc.js');
    expect(() => stageChunkOf('D:\\x', LIBRAS_AVATAR_STAGE_CHUNK, () => { throw new Error('ENOENT'); })).toThrow(/found 0 times/);
  });
});

/**
 * 🔴 THE PLAYER ASKS EACH CLIP AT THE ADDRESS THE LIST KEEPS IT UNDER (ADR-0234, phase B3). The two sides are different code —
 * the delivery's list (`avatarListPaths`, resolved by the device as `new URL(path, page)`) and the player's `prepareClips` — and a
 * cache answers only an address it holds. 📏 Found by comparing them over the real 632 clips: the player encoded every name with
 * `encodeURIComponent`, so it asked `PRIMEIRO%26ORDINAL.json` where the list kept `PRIMEIRO&ORDINAL.json`, and offline those two
 * signs were left out.
 */
describe('the free player asks every clip where the delivery\'s list keeps it', () => {
  const pins = readAvatarPins();
  const BASE = 'https://escola.example/jogo/quiz.html?libras=avatar';

  it('🔴 [Right] for each of the real clips, the address fetched is the address kept — the `&` in two names included', async () => {
    const manifest = avatarManifestOf(deliveredManifest(pins));
    const place = avatarPlace(BASE);
    const fetched = [];
    const fetchFile = async (url) => { fetched.push(url); return new Response('{"duration":1,"tracks":[]}'); };
    const stage = { prepare: () => {} };
    const names = Object.keys(pins.clips);
    expect(await prepareClips(stage, names, manifest, place, fetchFile, new Map())).toEqual([]);
    const kept = avatarListPaths({ folder: LIBRAS_AVATAR_FOLDER, pins, stageChunk: 'assets/x.js', glosses: `${LIBRAS_AVATAR_FOLDER}glosses.json` })
      .filter((p) => p.includes('/clips/')).map((p) => new URL(p, BASE).href);
    expect(fetched.length).toBe(655); // the 632 signs the glosses use and the manual alphabet's 23 missing letters
    expect(fetched.filter((u) => !kept.includes(u)), 'the player asks these where the checked cache holds nothing').toEqual([]);
    expect(fetched).toContain('https://escola.example/jogo/libras/avatar/clips/PRIMEIRO&ORDINAL.json');
    expect(fetched).toContain('https://escola.example/jogo/libras/avatar/clips/N%C3%83O.json');
  });

  /**
   * 🔴 THE GLOSSES MOVED BESIDE THE AVATAR (ADR-0234, phase B3), and three sides must agree on where: the player reads them
   * (`avatarPlace`), the delivery writes them (`deliverLibrasGlosses` into `LIBRAS_AVATAR_FOLDER`), and the list keeps them under
   * a folder it may name. A player reading the old place online would get a 404 and fingerspell every word.
   */
  it('🔴 [Right] the player reads the glosses at the address the list keeps them under, inside the avatar\'s folder', () => {
    const glosses = `${LIBRAS_AVATAR_FOLDER}${LIBRAS_GLOSSES_FILE}`;
    expect(avatarPlace(BASE).glosses).toBe(new URL(glosses, BASE).href);
    expect(avatarListPaths({ folder: LIBRAS_AVATAR_FOLDER, pins, stageChunk: 'assets/x.js', glosses })).toContain(glosses);
    const list = DELIVERY_LISTS.find((l) => l.id === 'libras:avatar:delivery');
    expect(list.folders.some((f) => glosses.startsWith(f)), 'the list may not name the glosses: the device would refuse it').toBe(true);
  });

  it('📌 [Boundary] no real clip name carries `%`, `#`, `?` or `\\` — a URL reads them as something other than a name, and the player asks the name as a URL spells it', () => {
    expect(Object.keys(pins.clips).filter((n) => /[%#?\\]/.test(n))).toEqual([]);
  });
});

describe('scripts/libras-avatar.json — the pins the repository keeps', () => {
  const pins = readAvatarPins();

  it('🔴 [Right] they are the B1 export at the pinned commit: the avatar and the 655 clips, the digits and the whole manual alphabet among them', () => {
    expect(pins.commit).toBe(COMMIT);
    expect(pins.mirror).toBe(`vlibras-avatar-${COMMIT.slice(0, 7)}/`);
    expect(pins.avatar).toEqual({ bytes: 2175208, sha256: '60a166b6ac3af4c9bc773193c32bccd45536746b195ee85d597484f2653d26f8' });
    expect(Object.keys(pins.clips)).toHaveLength(655);
    for (const d of '0123456789') expect(pins.clips[d], `the digit ${d} has no clip`).toBeDefined();
    for (const letter of MANUAL_ALPHABET) expect(pins.clips[letter], `the letter ${letter} has no clip`).toBeDefined();
    for (const [name, c] of Object.entries(pins.clips)) {
      expect(c.sha256, name).toMatch(/^[0-9a-f]{64}$/);
      expect(c.duration, name).toBeGreaterThan(0);
    }
  });

  it('🎯 [Right] FALA plays from its sign, 46.8 s in, and the pins say why; no other clip has a window', () => {
    expect(pins.clips.FALA.from).toBe(46.8);
    expect(pins.windows.FALA).toMatch(/-1404/);
    expect(Object.entries(pins.clips).filter(([, c]) => c.from !== undefined).map(([n]) => n)).toEqual(['FALA']);
    expect(avatarManifestOf(deliveredManifest(pins)).clips.size).toBe(655);
  });

  it('🔴 [Right] every delivered clip has its .blend pinned: the Corresponding Source of each is in libras-export/sources.json', () => {
    const sources = JSON.parse(readFileSync(SOURCE_PINS, 'utf8')).signs;
    const unsourced = Object.keys(pins.clips).filter((name) => !sources[name]);
    expect(unsourced, 'a clip is delivered whose source is not pinned').toEqual([]);
  });

  it('🎯 [Right] a word with no sign is spelled whole from the delivery\'s letters: «PÕE» P-O-E, and a word of letters it lacked before', () => {
    const carried = (name) => name in pins.clips;
    // the quiz's first question, as the delivery's glosses hand it over (PÕE has no sign; the build wrote it as the child reads it)
    expect(planSigns('QUAL ANIMAL POE OVO TER BICO [INTERROGAÇÃO]', carried)).toEqual({
      steps: ['QUAL', 'ANIMAL', 'P', 'O', 'E', 'OVO', 'TER', 'BICO'].map((clip) => (clip.length === 1 ? { clip, spells: 'POE' } : { clip })),
      unsigned: [],
    });
    // «CRT», of the visual sensitivity panel: none of its letters was carried before the manual alphabet
    expect(planSigns('ESTÉTICA CRT', carried).steps.slice(-3)).toEqual([{ clip: 'C', spells: 'CRT' }, { clip: 'R', spells: 'CRT' }, { clip: 'T', spells: 'CRT' }]);
    // no word of Portuguese letters is left out any more: every letter, accented or not, reaches a clip
    expect(planSigns('ÁGUA JÁ ÇÃO XÍCARA WEB KIWI ÊXITO ÔNIBUS ÜBER', carried).unsigned).toEqual([]);
    // «CAÇA» has no sign: its Ç is the delivery's own Ç clip, not a C
    expect(planSigns('CAÇA', carried).steps.map((s) => s.clip), 'the Ç clip the delivery carries was never played').toEqual(['C', 'A', 'Ç', 'A']);
  });

  it('[Right] regenerated from an export\'s manifest, the pins carry the window at the clip\'s own rate, as text one clip a line', () => {
    const exported = { commit: COMMIT, blender: 'b', exporter: 'e', avatar: { bytes: 1, sha256: 'a' }, clips: {
      FALA: { file: 'clips/FALA.json', bytes: 2, sha256: 'f', duration: 48.8, fps: 30 },
      GATO: { file: 'clips/GATO.json', bytes: 3, sha256: 'g', duration: 2, fps: 30 },
      A: { file: 'clips/A.json', bytes: 4, sha256: 'h', duration: 1.5667, fps: 30 } } };
    const made = avatarPinsFromExport(exported, WINDOWS, { A: [0.42, 1.15] });
    expect(made.clips.FALA.from).toBe(46.8);
    expect(made.clips.GATO.from).toBeUndefined();
    expect(made.clips.A.held, 'the measured window did not reach the pins').toEqual([0.42, 1.15]);
    expect(made.clips.GATO.held).toBeUndefined();
    const text = avatarPinsText(made);
    expect(JSON.parse(text)).toEqual(made);
    expect(text).toMatch(/\n {4}"GATO": \{"bytes": 3, "sha256": "g", "duration": 2\}/);
  });
});

/**
 * 🔴 WHERE A LETTER'S HAND IS HELD UP, CARRIED FROM THE EXPORT TO THE PLAYER (the Dev, 2026-09-26: a spelled word is signed with
 * the hand held up between its letters). The pins hold it for every clip a word is spelled with, measured on the clip
 * (`heldWindow`, `tests/libras-export.node.test.js`), and the delivered manifest hands it to the player that chains the letters.
 */
describe('scripts/libras-avatar — where each letter and digit is held up', () => {
  const pins = readAvatarPins();
  const spelled = Object.keys(pins.clips).filter(isSpelledClip);

  it('🔴 [Right] every letter of the manual alphabet and every digit carries its window, inside its clip; no sign does', () => {
    expect(spelled.sort()).toEqual([...'0123456789', ...MANUAL_ALPHABET].sort());
    for (const name of spelled) {
      const [up, down] = pins.clips[name].held ?? [];
      expect(up, `${name} has no window`).toBeGreaterThanOrEqual(0);
      expect(down, name).toBeGreaterThan(up);
      expect(down, name).toBeLessThanOrEqual(pins.clips[name].duration);
    }
    expect(Object.entries(pins.clips).filter(([n, c]) => c.held && !isSpelledClip(n)).map(([n]) => n), 'a sign was given a window').toEqual([]);
  });

  it('🎯 [Right] E is still — held up from its first frame to its last — and the rest rise and fall around their window', () => {
    expect(pins.clips.E.held).toEqual([0, pins.clips.E.duration]);
    for (const name of spelled.filter((n) => n !== 'E')) {
      const [up, down] = pins.clips[name].held;
      expect(up, `${name} has no rise`).toBeGreaterThan(0.25);
      expect(pins.clips[name].duration - down, `${name} has no fall`).toBeGreaterThan(0.25);
    }
  });

  it('🔴 [Right] the delivered manifest carries each window', () => {
    const { clips } = deliveredManifest(pins);
    expect(clips.P.held, 'the window did not reach the delivery').toEqual(pins.clips.P.held);
    expect(clips.E.held).toEqual([0, pins.clips.E.duration]);
    expect(clips.GATO.held).toBeUndefined();
  });

  it('🔴 [Right] regenerating the pins measures the spelled clips of the export folder, and only them', async () => {
    const read = (path) => {
      const rel = path.split(/[\\/]export[\\/]/)[1].split('\\').join('/');
      if (rel === 'avatar.glb') return jsonGlb({ asset: { version: '2.0' }, nodes: [{ name: 'BnMao.R', translation: [0.3, -0.8, 0] }, { name: 'BnMao.L' }] });
      const name = rel.slice('clips/'.length, -'.json'.length);
      const still = name === 'E';
      return Buffer.from(JSON.stringify({ name, duration: 1.9, tracks: [{ name: 'BnMaoR.position', type: 'vector', times: [0, 0.4, 1.5, 1.9],
        values: [0.3, still ? 2 : -0.8, 0, 0.3, 2, 0, 0.3, 2, 0, 0.3, still ? 2 : -0.8, 0] }] }));
    };
    expect(await heldWindowsOf('D:\\x\\export', ['GATO', 'A', 'E', '7', 'NÃO'], read)).toEqual({ 7: [0.37, 1.53], A: [0.37, 1.53], E: [0, 1.9] });
  });
});

/** A `.glb` holding only a JSON chunk: enough for the export's forward kinematics, which reads the nodes. */
function jsonGlb(json) {
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, text]);
}

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
//   L5 the list hashing something other than the bytes on the disk      🔴 «the sha256 on the disk» (then in `scripts/vlibras-player.mjs`)
// (2026-09-26, phase B3: `writeDeliveryList` moved here from `scripts/vlibras-player.mjs`, its cases with it; scripted the same way)
//   W1 the list's folder check removed                                    🔴 «a path outside the list's folders is refused»
//   W2 its `..` check removed                                             🔴 same case (`libras/avatar/../../quiz.html`)
//   W3 the listed hash taken from the path, not the bytes                 🔴 «the sha256 on the disk»
// (2026-09-26, phase B3: the glosses beside the avatar; scripted the same way — 3 of 3 red)
//   L1 a list written with no glosses named                               🔴 «no glosses named stops the step»
//   L2 the glosses left out of the list                                   🔴 «the glosses, every clip…» · «reads the glosses at the address…»
//   P2 the player reading the glosses at route A's old place (`ui/libras-avatar-load`)  🔴 «reads the glosses at the address…»
//   K1 the player encoding each clip name with encodeURIComponent again  🔴 «the address fetched is the address kept» (in `ui/libras-avatar-load`)
//   K2 a pinned clip whose name carries a `#`                              🔴 «no real clip name carries…» (in `scripts/libras-avatar.json`)
// (2026-09-25, the manual alphabet; scripted the same way, the pins or the plan restored from a copy — all 4 red)
//   D6 the pins without P's clip                                          🔴 «the 655 clips» · «spelled whole»
//   D7 the pins without Ç's clip                                          🔴 «the 655 clips»
//   D8 Z's .blend unpinned in libras-export/sources.json                  🔴 «every delivered clip has its .blend pinned»
//   D9 planSigns spelling a word with its accents kept                    🔴 «spelled whole»
// (2026-09-25, Ç spelled as written; scripted the same way, the file restored from a copy and checked by sha256 — both red)
//   D10 the spelling rule strips Ç's cedilla (`ui/libras-glosses`)        🔴 «spelled whole» («CAÇA» C-A-Ç-A)
//   D11 the pins without Ç's clip (D7 again)                              🔴 «the 655 clips» · «spelled whole» and 2 more
