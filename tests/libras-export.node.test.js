// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VLIBRAS EXPORT DRIVER'S PURE PARTS (ADR-0234, route B, phase B1; `scripts/libras-export.mjs`). Blender does not run here:
// the glTF it would write is built by hand, small enough to know every answer. What is held: which signs and where their
// sources are (the name list, the percent-encoded URL at the pinned commit, a download that is not a .blend refused); the
// names three.js will give the avatar's nodes; the clip (tracks named the way the loaded avatar binds them, rest-pose tracks
// dropped, keys reduced within the stated tolerance and never beyond it); the numeric check (a clip that does not bind is
// caught, forward kinematics agrees with a hand computation); avatar identity by tolerance and shape; the manifest (sha256,
// frames, duration); and the safety flags that keep a .blend's embedded Python from running.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  signNames, blendUrl, isBlend, sanitizeNodeName, parseGlb, readAccessor, reduceKeys, continuousQuaternions, clipFromGlb,
  avatarBindings, checkClip, worldPosition, avatarIdentity, timing, clipEntry, manifest, BLENDER_FLAGS, EXPORT_PY, COMMIT,
  DISCRETE, IDENTITY_TOLERANCE, pinsText, PINS, MANUAL_ALPHABET, exportNames, defaultSigns,
} from '../scripts/libras-export.mjs';
import { readAvatarPins } from '../scripts/libras-avatar.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** A .glb from a glTF JSON whose accessors are given as plain arrays: `{ type, data }`, each packed as FLOAT. */
function glb(json, arrays) {
  const chunks = [];
  let offset = 0;
  json.bufferViews = [];
  json.accessors = arrays.map(({ type, data }, i) => {
    const bytes = Buffer.from(new Float32Array(data).buffer);
    chunks.push(bytes);
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    offset += bytes.length;
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
    return { bufferView: i, componentType: 5126, count: data.length / width, type };
  });
  const bin = Buffer.concat(chunks);
  json.buffers = [{ byteLength: bin.length }];
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  const chunk = (type, body) => { const h = Buffer.alloc(8); h.writeUInt32LE(body.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, body]); };
  return Buffer.concat([header, chunk(0x4e4f534a, text), chunk(0x004e4942, bin)]);
}

const S = Math.SQRT1_2; // a quarter turn about Z is (0, 0, S, S)
/** The avatar: Armature.001 → Bn.A (1 up) → Bn.B (1 up); Head carries two morph targets, both at 0. */
const avatarJson = () => ({
  asset: { version: '2.0' },
  nodes: [
    { name: 'Armature.001', children: [1, 3] },
    { name: 'Bn.A', translation: [0, 1, 0], children: [2] },
    { name: 'Bn.B', translation: [0, 1, 0] },
    { name: 'Head', mesh: 0 },
  ],
  meshes: [{ name: 'Head', weights: [0, 0], extras: { targetNames: ['Smile', 'Key 22'] }, primitives: [{ attributes: {}, targets: [{}, {}] }] }],
});
/** A sign: Bn.A turns a quarter about Z in 1 s through a midpoint; Bn.B's translation sits at rest; Bn.A's scale is a constant
 *  1.5 (not rest); Smile rises 0 → 1 → 0; `Key 22` stays 0 (rest); Bn.B's rotation STEPS once. */
function signGlb() {
  const json = avatarJson();
  const half = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
  json.animations = [{
    name: 'Animation',
    samplers: [
      { input: 0, output: 1, interpolation: 'LINEAR' },
      { input: 0, output: 2, interpolation: 'LINEAR' },
      { input: 0, output: 3, interpolation: 'LINEAR' },
      { input: 0, output: 4, interpolation: 'LINEAR' },
      { input: 0, output: 5, interpolation: 'STEP' },
    ],
    channels: [
      { sampler: 0, target: { node: 1, path: 'rotation' } },
      { sampler: 1, target: { node: 2, path: 'translation' } },
      { sampler: 2, target: { node: 1, path: 'scale' } },
      { sampler: 3, target: { node: 3, path: 'weights' } },
      { sampler: 4, target: { node: 2, path: 'rotation' } },
    ],
  }];
  return glb(json, [
    { type: 'SCALAR', data: [0, 0.5, 1] },
    { type: 'VEC4', data: [0, 0, 0, 1, ...half, 0, 0, S, S] },
    { type: 'VEC3', data: [0, 1, 0, 0, 1, 0, 0, 1, 0] },
    { type: 'VEC3', data: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5] },
    { type: 'SCALAR', data: [0, 0, 1, 0, 0, 0] },
    { type: 'VEC4', data: [0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0] },
  ]);
}

describe('which signs, and where their sources are', () => {
  it('🔴 [Right] the names of a pins document, sorted, each once — and the export\'s own source pins hold the 655 the free player carries', () => {
    expect(signNames({ signs: { SIM: {}, CASA: {}, 'OLÁ': {} } })).toEqual(['CASA', 'OLÁ', 'SIM']);
    const pinned = signNames(JSON.parse(readFileSync(PINS, 'utf8')));
    expect(pinned).toHaveLength(655);
    expect(pinned).toEqual(expect.arrayContaining(['CASA', 'NÃO', 'PRIMEIRO&ORDINAL', 'Ç']));
  });

  it('🔴 [Right] with no --signs the export makes every pinned sign AND the whole manual alphabet, A to Z and Ç: 655', () => {
    expect(MANUAL_ALPHABET).toHaveLength(27);
    expect(MANUAL_ALPHABET).toContain('Ç');
    expect(exportNames({ signs: { CASA: {}, A: {} } })).toEqual(['A', 'B', 'C', 'CASA', ...'DEFGHIJKLMNOPQRSTUVWXYZÇ']);
    const names = defaultSigns();
    expect(names).toHaveLength(655);
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZÇ') expect(names, `the letter ${letter} is not exported`).toContain(letter);
    // the same names the delivered clips carry: a sign pinned for export and never delivered, or the other way, is a drift
    expect(names).toEqual(Object.keys(readAvatarPins().clips).sort());
  });

  it('🎯 [Error] a document with no `signs` is refused, not read as zero signs', () => {
    expect(() => signNames({})).toThrow(/no `signs`/);
    expect(() => signNames(null)).toThrow(/no `signs`/);
  });

  it('🔴 [Right] a source is the repository at the PINNED commit, the name percent-encoded (`&` and accents)', () => {
    expect(blendUrl('CASA')).toBe(`https://gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources/-/raw/${COMMIT}/FILES/BLENDS/BR/CASA.blend`);
    expect(blendUrl('PRIMEIRO&ORDINAL').endsWith('/BR/PRIMEIRO%26ORDINAL.blend')).toBe(true);
    expect(blendUrl('OLÁ').endsWith('/BR/OL%C3%81.blend')).toBe(true);
    expect(COMMIT).toBe('f8ddb378affd0d6da42f04c9fc888dafe1cc1299');
  });

  it('🎯 [Boundary] a download is a .blend only if it is one: gzip or `BLENDER`, never an LFS pointer or a page', () => {
    expect(isBlend(Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
    expect(isBlend(Buffer.from('BLENDER-v279REND....'))).toBe(true);
    expect(isBlend(Buffer.from('version https://git-lfs.github.com/spec/v1\noid sha256:abc'))).toBe(false);
    expect(isBlend(Buffer.from('<!DOCTYPE html><html>'))).toBe(false);
    expect(isBlend(Buffer.from([0x1f, 0x8b]))).toBe(false);
  });
});

describe('the names three.js gives the avatar', () => {
  it('🔴 [Right] GLTFLoader\'s rule: whitespace becomes `_`, and `[ ] . : /` are removed', () => {
    expect(sanitizeNodeName('BnMao.L')).toBe('BnMaoL');
    expect(sanitizeNodeName('BnDedo.1.L.004')).toBe('BnDedo1L004');
    expect(sanitizeNodeName('Key 22')).toBe('Key_22');
    expect(sanitizeNodeName('a/b:c[d]')).toBe('abcd');
    expect(sanitizeNodeName('BnCol-01')).toBe('BnCol-01');
  });
});

describe('reading a glb', () => {
  it('🔴 [Right] the JSON and the FLOAT accessors come back as written', () => {
    const { json, bin } = parseGlb(signGlb());
    expect(json.nodes.map((n) => n.name)).toEqual(['Armature.001', 'Bn.A', 'Bn.B', 'Head']);
    expect([...readAccessor(json, bin, 0)]).toEqual([0, 0.5, 1]);
    expect(readAccessor(json, bin, 1)).toHaveLength(12);
  });

  it('🎯 [Error] not a glb, or a non-FLOAT accessor, is refused by name', () => {
    expect(() => parseGlb(Buffer.from('not a glb at all, really'))).toThrow(/magic/);
    const { json, bin } = parseGlb(signGlb());
    json.accessors[0].componentType = 5123;
    expect(() => readAccessor(json, bin, 0)).toThrow(/only FLOAT/);
  });
});

describe('reducing keys', () => {
  const times = [0, 1, 2, 3, 4];

  it('🔴 [Right] a straight line keeps only its ends; a bump beyond the tolerance keeps its key', () => {
    expect(reduceKeys(times, [0, 1, 2, 3, 4], 1, 1e-4)).toEqual([0, 4]);
    expect(reduceKeys(times, [0, 1, 5, 3, 4], 1, 1e-4)).toEqual([0, 1, 2, 3, 4]);
    expect(reduceKeys(times, [0, 0, 1, 0, 0], 1, 1e-4)).toEqual([0, 1, 2, 3, 4]);
  });

  it('🎯 [Boundary] a key exactly at the tolerance from the chord is dropped; just past it, kept — on EVERY component', () => {
    expect(reduceKeys([0, 1, 2], [0, 0.5, 0], 1, 0.5)).toEqual([0, 2]);
    expect(reduceKeys([0, 1, 2], [0, 0.5001, 0], 1, 0.5)).toEqual([0, 1, 2]);
    expect(reduceKeys([0, 1, 2], [0, 0, 0, 0.3, 0, 0], 2, 0.2)).toEqual([0, 1, 2]); // only the 2nd component moves
  });

  it('🔴 [Right] a discrete (STEP) track keeps only its changes', () => {
    expect(reduceKeys(times, [0, 0, 1, 1, 1], 1, 1e-4, true)).toEqual([0, 2, 4]);
  });

  it('🔴 [Right] quaternions are made continuous — q and −q are one rotation, so a chord must not cross through zero', () => {
    expect([...continuousQuaternions([0, 0, 0, 1, 0, 0, 0, -1])]).toEqual([0, 0, 0, 1, -0, -0, -0, 1]);
  });
});

describe('the clip', () => {
  const avatar = avatarJson();
  const clip = clipFromGlb(signGlb(), 'TESTE', avatar);
  const byName = Object.fromEntries(clip.tracks.map((t) => [t.name, t]));

  it('🔴 [Right] tracks named as the loaded avatar binds them: sanitized node, three.js property, morph target by name', () => {
    expect(Object.keys(byName).sort()).toEqual(['BnA.quaternion', 'BnA.scale', 'BnB.quaternion', 'Head.morphTargetInfluences[Smile]']);
    expect(byName['BnA.quaternion'].type).toBe('quaternion');
    expect(byName['BnA.scale'].type).toBe('vector');
    expect(byName['Head.morphTargetInfluences[Smile]'].type).toBe('number');
    expect(clip).toMatchObject({ name: 'TESTE', duration: 1 });
  });

  it('🔴 [Right] a track constant at the AVATAR\'s rest value is dropped (Bn.B translation, `Key 22`); a constant elsewhere keeps ONE key', () => {
    expect(byName['BnB.position']).toBeUndefined();
    expect(byName['Head.morphTargetInfluences[Key 22]']).toBeUndefined();
    expect(byName['BnA.scale']).toEqual({ name: 'BnA.scale', type: 'vector', times: [0], values: [1.5, 1.5, 1.5] });
  });

  it('🎯 [Cross-check] rest is the AVATAR\'s, not the sign file\'s: against an avatar whose `Key 22` rests at 1 and whose Bn.B sits 2 up, both constants are kept', () => {
    const other = avatarJson();
    other.meshes[0].weights = [0, 1];
    other.nodes[2].translation = [0, 2, 0];
    const tracks = clipFromGlb(signGlb(), 'TESTE', other).tracks;
    expect(tracks.find((x) => x.name === 'Head.morphTargetInfluences[Key 22]')).toEqual({ name: 'Head.morphTargetInfluences[Key 22]', type: 'number', times: [0], values: [0] });
    expect(tracks.find((x) => x.name === 'BnB.position')).toEqual({ name: 'BnB.position', type: 'vector', times: [0], values: [0, 1, 0] });
  });

  it('🔴 [Right] a curve keeps the keys it needs, rounded; a STEP that really steps stays discrete', () => {
    expect(byName['Head.morphTargetInfluences[Smile]']).toMatchObject({ times: [0, 0.5, 1], values: [0, 1, 0] });
    expect(byName['BnA.quaternion'].times).toEqual([0, 0.5, 1]);
    expect(byName['BnA.quaternion'].values.slice(8)).toEqual([0, 0, 0.7071, 0.7071]);
    expect(byName['BnB.quaternion']).toMatchObject({ times: [0, 1], interpolation: DISCRETE });
  });

  it('🔴 [Right] THE FACE from Blender\'s own per-frame values: one track per moving target, frame i at i / fps, rest dropped', () => {
    const face = { fps: 30, morphs: [{ mesh: 'Head', names: ['Smile', 'Key 22'], values: [[0, 0], [0.5, 0], [1, 0], [1, 0]] }] };
    const json = avatarJson();
    json.animations = [{ name: 'A', samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }], channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }] }];
    const c = clipFromGlb(glb(json, [{ type: 'SCALAR', data: [0, 0.1] }, { type: 'VEC4', data: [0, 0, 0, 1, 0, 0, S, S] }]), 'ROSTO', avatar, face);
    expect(c.tracks.map((t) => t.name)).toEqual(['BnA.quaternion', 'Head.morphTargetInfluences[Smile]']);
    expect(c.tracks[1]).toEqual({ name: 'Head.morphTargetInfluences[Smile]', type: 'number', times: [0, 0.0667, 0.1], values: [0, 1, 1] });
    expect(c.duration).toBe(0.1);
  });

  it('🎯 [Error] an export with no animation, or with two, is refused by the sign\'s name', () => {
    const json = avatarJson();
    expect(() => clipFromGlb(glb(json, [{ type: 'SCALAR', data: [0] }]), 'VAZIO', avatar)).toThrow(/VAZIO: 0 animations/);
  });
});

describe('the numeric check: a clip against the avatar', () => {
  const avatar = avatarJson();
  const bindings = avatarBindings(avatar);
  const clip = clipFromGlb(signGlb(), 'TESTE', avatar);

  it('🔴 [Right] every track of the clip binds on the avatar — nothing unknown, nothing malformed', () => {
    expect(checkClip(bindings, clip)).toEqual({ unknownNode: [], unknownMorph: [], badTrack: [], duplicates: [] });
  });

  it('🎯 [Error] an unknown bone, an unknown morph target, a track of the wrong width are each named', () => {
    const bad = { tracks: [
      { name: 'BnZ.quaternion', type: 'quaternion', times: [0], values: [0, 0, 0, 1] },
      { name: 'Head.morphTargetInfluences[Pout]', type: 'number', times: [0], values: [1] },
      { name: 'BnA.position', type: 'vector', times: [0, 1], values: [0, 0, 0] },
    ] };
    expect(checkClip(bindings, bad)).toEqual({ unknownNode: ['BnZ.quaternion'], unknownMorph: ['Head.morphTargetInfluences[Pout]'], badTrack: ['BnA.position'], duplicates: [] });
  });

  it('🎯 [Error] two nodes that three.js would give the same name are reported — a track could bind to either', () => {
    const json = avatarJson();
    json.nodes.push({ name: 'BnA' });
    expect(avatarBindings(json).duplicates).toEqual(['BnA']);
  });

  it('🔴 [Cross-check] forward kinematics agrees with the hand computation: a quarter turn of Bn.A moves Bn.B from (0,2,0) to (−1,1,0)', () => {
    const at = (t) => worldPosition(avatar, clip, 'Bn.B', t).map((v) => Math.round(v * 1e4) / 1e4 + 0);
    expect(worldPosition(avatar, { tracks: [] }, 'Bn.B', 0)).toEqual([0, 2, 0]); // the avatar alone
    // the clip's scale 1.5 on Bn.A stretches Bn.B's offset: (0, 1 + 1.5, 0) before the turn, (−1.5, 1, 0) after it
    expect(at(0)).toEqual([0, 2.5, 0]);
    expect(at(1)).toEqual([-1.5, 1, 0]);
  });
});

describe('avatar identity', () => {
  const report = (name, maxDiff) => ({ name, identity: { maxDiff } });

  it('🔴 [Right] a sign whose every part is within the tolerance carries THE avatar; the largest difference is reported', () => {
    const r = avatarIdentity([report('CASA', { armature: 0, 'mesh:Head': 0 }), report('SIM', { armature: 4e-6, 'mesh:Head': 1e-5 })]);
    expect(r).toEqual({ same: ['CASA', 'SIM'], differing: {}, maxDiff: 1e-5 });
  });

  it('🎯 [Boundary] exactly at the tolerance is the same; past it, the sign is listed with the part', () => {
    const r = avatarIdentity([report('A', { armature: IDENTITY_TOLERANCE }), report('B', { armature: 2 * IDENTITY_TOLERANCE })]);
    expect(r.same).toEqual(['A']);
    expect(r.differing).toEqual({ B: ['armature: 2.00e-4'] });
  });

  it('🎯 [Error] a part that cannot be compared (shape differs, missing) is a difference, whatever the numbers', () => {
    const r = avatarIdentity([report('X', { armature: 0, 'mesh:Head': 'shape differs' }), report('Y', {})]);
    expect(r.differing).toEqual({ X: ['mesh:Head: shape differs'], Y: ['no part compared'] });
    expect(r.same).toEqual([]);
  });
});

describe('the manifest', () => {
  const rep = { frameStart: 1, frameEnd: 75, fps: 30, action: 'CASA' };

  it('🔴 [Right] frames count both keyed ends; duration is from first to last frame, in seconds', () => {
    expect(timing(rep)).toEqual({ fps: 30, frames: 75, duration: 2.4667 });
  });

  it('🔴 [Right] an entry carries the file\'s bytes and sha256 and its source\'s — the Corresponding Source, pinned', () => {
    const bytes = Buffer.from('{"name":"CASA"}');
    const source = { sha256: 'ab'.repeat(32), bytes: 1797820 };
    expect(clipEntry('CASA', 'clips/CASA.json', bytes, rep, source)).toEqual({
      file: 'clips/CASA.json', bytes: bytes.length, sha256: sha(bytes), fps: 30, frames: 75, duration: 2.4667, action: 'CASA', source,
    });
  });

  it('🔴 [Right] the source pins read back as written, sorted, one line per sign — and the committed file is in that form', () => {
    const signs = { SIM: { bytes: 2, sha256: 'b'.repeat(64) }, CASA: { bytes: 1, sha256: 'a'.repeat(64) } };
    const text = pinsText(signs);
    const doc = JSON.parse(text);
    expect(doc).toMatchObject({ commit: COMMIT, signs: { CASA: signs.CASA, SIM: signs.SIM } });
    expect(Object.keys(doc.signs)).toEqual(['CASA', 'SIM']);
    expect(text).toContain(`"CASA": { "bytes": 1, "sha256": "${'a'.repeat(64)}" }`);
    const committed = readFileSync(PINS, 'utf8');
    expect(pinsText(JSON.parse(committed).signs)).toBe(committed);
    // every sign the export makes by default has its source pinned, the manual alphabet's letters among them, and nothing else
    expect(Object.keys(JSON.parse(committed).signs)).toEqual(defaultSigns());
  });

  it('🔴 [Right] the manifest names the pinned commit and the GPL source, and lists clips sorted', () => {
    const m = manifest({ blender: '5.2.2 LTS', exporter: 'x', avatar: {}, clips: { SIM: {}, CASA: {} } });
    expect(Object.keys(m.clips)).toEqual(['CASA', 'SIM']);
    expect(m.commit).toBe(COMMIT);
    expect(m.comment.join(' ')).toMatch(/GPL-3\.0/);
  });
});

describe('the safety of running Blender on these files', () => {
  it('🔴 [Right] Blender runs headless, factory settings, AUTO-EXEC OFF — and the script opens each file with scripts off', () => {
    expect(BLENDER_FLAGS).toEqual(['--background', '--factory-startup', '--disable-autoexec']);
    const py = readFileSync(EXPORT_PY, 'utf8');
    expect(py).toMatch(/open_mainfile\(filepath=sign\["blend"\], load_ui=False, use_scripts=False\)/);
    expect(py).not.toMatch(/\.as_module\(|exec\(|eval\(/);
  });
});

// MUTATIONS CHECKED (each applied alone to scripts/libras-export.mjs or libras-export/export.py, this file run, the source
// restored; every one RED):
//   sanitizeNodeName keeps dots · blendUrl without encodeURIComponent · isBlend accepts 2 bytes · reduceKeys `>` → `>=` ·
//   the chord checks only the first component · the hemisphere flip inverted · rest tracks kept · rest TRS read from the
//   sign's file, not the avatar · rest weights read from the sign's file · an unknown morph target not caught · a part that
//   cannot be compared ignored · frames miss one end · names unsorted · `--disable-autoexec` dropped · forward kinematics
//   multiplies in the wrong order · STEP becomes linear · duplicate names not reported · a constant off rest keeps two keys ·
//   sha256 of the path instead of the bytes · face times in frames, not seconds · pins unsorted · the face ignored ·
//   export.py opens files with `use_scripts=True`.
// And for the manual alphabet (2026-09-25, scripted, each file restored from a copy and checked by sha256; all 4 red):
//   the alphabet without Ç · the default export the sign list alone · the letter Q's source unpinned in sources.json ·
//   the default names not deduplicated.
// And for the default names read from the export's own source pins (2026-09-26, phase B3; scripted, restored and checked by sha256):
//   E1 the default names read from no pins (the alphabet alone) · E2 a pinned sign dropped from the defaults — both red
