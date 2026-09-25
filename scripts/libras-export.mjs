// SPDX-License-Identifier: AGPL-3.0-or-later
//
// VLIBRAS ROUTE B, PHASE B1 — THE EXPORT PIPELINE (ADR-0234, errata «ROUTE A NOW, ROUTE B NEXT»). Route B replaces the closed
// Unity player with a free one built from LAViD-UFPB's GPL-3.0 sign sources: every sign of `vlibras-dictionary-sources` is a
// Blender 2.79 file `FILES/BLENDS/BR/<NAME>.blend` holding the WHOLE avatar plus one Action named after the sign. This script
// turns the signs the engine's glosses use into what a three.js player loads:
//
//   <out>/avatar.glb          ONE avatar (glTF 2.0 binary: meshes, skeleton, skin, morph targets, materials with the head's and
//                             the body's textures, taken from a sign file that packs them — `--textures-from`), exported once.
//   <out>/clips/<NAME>.json   ONE clip per sign, in three.js's own AnimationClip JSON (`THREE.AnimationClip.parse`).
//   <out>/manifest.json       name, duration, frame rate, frames, bytes and sha256 of every file, and the sha256 of its source.
//   <out>/report.json         what the run measured: fidelity, losses, avatar identity, sizes, the numeric check.
//
// HOW: Blender (5.2 measured) opens each `.blend` HEADLESS and with its embedded Python OFF —
//     blender --background --factory-startup --disable-autoexec --python libras-export/export.py -- --job <job.json>
// and its own glTF exporter writes the avatar + that action, SAMPLED every frame, so the rig's constraints are baked into plain
// bone tracks; the face's shape keys, which drivers move from facial bones, are evaluated by Blender at every frame and handed
// over beside it (the exporter bakes those drivers only for some signs). This script then keeps only the animation of each of
// those files plus the face (`clipFromGlb`) and throws the rest away.
//
// WHY A three.js CLIP JSON AND NOT A `.glb` PER SIGN (measured on the spike, see the report): a glTF animation can only target
// nodes of its OWN file, and a morph-weight channel needs a mesh with those morph targets — so a `.glb` clip would carry the
// skeleton and the whole head mesh again, sign after sign. The JSON names its targets (`BnMaoL.quaternion`,
// `cabecaModifAlisson.morphTargetInfluences[Sorriso]`), binds to the ONE avatar by name, loads with no loader at all, and
// compresses well (the host serves it gzip/brotli). Keys are reduced within a stated tolerance (`reduceKeys`) and rounded.
//
// NAMES: three.js's GLTFLoader renames every node with `PropertyBinding.sanitizeNodeName` (whitespace → `_`, `[ ] . : /`
// removed: `BnMao.L` → `BnMaoL`), so the clip tracks use the SANITIZED names — the ones the loaded avatar has. `checkClip` holds
// that every track resolves on the avatar.
//
// CORRESPONDING SOURCE of the exports (GPL-3.0): the `.blend` files at the pinned commit (`libras-export/sources.json`, sha256 of
// each) plus this script and `libras-export/export.py`, run with the Blender version the manifest names.
//
// USAGE (downloads into --cache, NEVER into the repository):
//   node scripts/libras-export.mjs --cache <dir> --out <dir> [--signs CASA,ESCOLA] [--blender <exe>] [--jobs 4]
//        [--avatar-from CASA] [--textures-from 0] [--write-pins]
// With no --signs, the names are the 632 of `libras-signs.json` (the signs the engine's glosses use).

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const COMMIT = 'f8ddb378affd0d6da42f04c9fc888dafe1cc1299';
export const SOURCE = `https://gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources/-/raw/${COMMIT}/FILES/BLENDS/BR/`;
const HERE = fileURLToPath(new URL('./', import.meta.url));
export const EXPORT_PY = join(HERE, 'libras-export', 'export.py');
export const PINS = join(HERE, 'libras-export', 'sources.json');
export const SIGN_LIST = join(HERE, 'libras-signs.json');
/** The flags that keep a `.blend`'s embedded Python from running. Never run Blender on these files without them. */
export const BLENDER_FLAGS = Object.freeze(['--background', '--factory-startup', '--disable-autoexec']);

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The sign names of a `libras-signs.json`-shaped document (`{ signs: { NAME: … } }`), sorted, each once. */
export function signNames(doc) {
  if (!doc || typeof doc.signs !== 'object' || doc.signs === null) throw new Error('no `signs` object in the sign list');
  return [...new Set(Object.keys(doc.signs))].sort();
}

/** Where a sign's `.blend` is published: the repository at the pinned commit, the name percent-encoded (`&`, accents). */
export const blendUrl = (name, source = SOURCE) => source + encodeURIComponent(name) + '.blend';

/** A `.blend` is `BLENDER…` raw or gzip; an LFS pointer (text) or an HTML page means the download did not bring the file. */
export function isBlend(bytes) {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return true;
  return bytes.subarray(0, 7).toString('latin1') === 'BLENDER';
}

// ── three.js's node naming ─────────────────────────────────────────────────────────────────────────────────────────────────

/** `THREE.PropertyBinding.sanitizeNodeName`, which GLTFLoader applies to every node name. */
export const sanitizeNodeName = (name) => name.replace(/\s/g, '_').replace(/[[\].:/]/g, '');

// ── glTF reading ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A `.glb` split into its JSON and its binary chunk. */
export function parseGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb (magic)');
  if (buf.readUInt32LE(4) !== 2) throw new Error('not glTF 2.0');
  let off = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
    else if (type === 0x004e4942) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error('glb without a JSON chunk');
  return { json, bin };
}

const WIDTH = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** A FLOAT accessor as a Float32Array (strides and sparse substitution honoured); other component types are refused. */
export function readAccessor(gltf, bin, index) {
  const a = gltf.accessors[index];
  const n = WIDTH[a.type];
  if (a.componentType !== 5126 || !n) throw new Error(`accessor ${index}: only FLOAT ${Object.keys(WIDTH)} are read`);
  const out = new Float32Array(a.count * n);
  if (a.bufferView !== undefined) {
    const bv = gltf.bufferViews[a.bufferView];
    const stride = bv.byteStride || n * 4;
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = bin.readFloatLE(base + i * stride + c * 4);
  }
  if (a.sparse) {
    const { count, indices, values } = a.sparse;
    const ib = gltf.bufferViews[indices.bufferView];
    const vb = gltf.bufferViews[values.bufferView];
    const size = { 5121: 1, 5123: 2, 5125: 4 }[indices.componentType];
    const read = { 1: (o) => bin.readUInt8(o), 2: (o) => bin.readUInt16LE(o), 4: (o) => bin.readUInt32LE(o) }[size];
    for (let k = 0; k < count; k++) {
      const at = read((ib.byteOffset || 0) + (indices.byteOffset || 0) + k * size);
      for (let c = 0; c < n; c++) out[at * n + c] = bin.readFloatLE((vb.byteOffset || 0) + (values.byteOffset || 0) + (k * n + c) * 4);
    }
  }
  return out;
}

// ── the clip ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** three.js `InterpolateDiscrete`: a STEP sampler that really steps keeps stepping. */
export const DISCRETE = 2300;

/** Decimals kept and the reduction tolerance, per kind of value. Rounding error (half a unit of the last decimal) is inside it. */
export const PRECISION = Object.freeze({
  quaternion: { decimals: 4, tolerance: 2e-4 }, // ≈ 0.02° per component
  vector: { decimals: 4, tolerance: 1e-4 }, //     0.1 mm in the avatar's metres
  number: { decimals: 3, tolerance: 1e-3 }, //     a morph weight in 0…1
});

const roundTo = (v, d) => { const k = 10 ** d; const r = Math.round(v * k) / k; return r === 0 ? 0 : r; };

/**
 * The keys of a track that linear interpolation cannot rebuild within `tolerance` (every component, every dropped key checked
 * against the chord between the keys kept around it). First and last are always kept. A discrete track keeps only changes.
 */
export function reduceKeys(times, values, stride, tolerance, discrete = false) {
  const n = times.length;
  if (n <= 2) return [...Array(n).keys()];
  const at = (i, c) => values[i * stride + c];
  const keep = [0];
  if (discrete) {
    for (let i = 1; i < n - 1; i++) {
      const prev = keep[keep.length - 1];
      let same = true;
      for (let c = 0; c < stride; c++) if (Math.abs(at(i, c) - at(prev, c)) > tolerance) same = false;
      if (!same) keep.push(i);
    }
    keep.push(n - 1);
    return keep;
  }
  let a = 0;
  for (let b = 2; b < n; b++) {
    let fits = true;
    for (let i = a + 1; i < b && fits; i++) {
      const u = (times[i] - times[a]) / (times[b] - times[a]);
      for (let c = 0; c < stride; c++) {
        const line = at(a, c) + (at(b, c) - at(a, c)) * u;
        if (Math.abs(at(i, c) - line) > tolerance) { fits = false; break; }
      }
    }
    if (!fits) { keep.push(b - 1); a = b - 1; }
  }
  keep.push(n - 1);
  return keep;
}

/** Quaternions made hemisphere-continuous (q and −q are one rotation), so a chord between two keys means the short way. */
export function continuousQuaternions(values) {
  const out = Float64Array.from(values);
  for (let i = 4; i < out.length; i += 4) {
    const dot = out[i] * out[i - 4] + out[i + 1] * out[i - 3] + out[i + 2] * out[i - 2] + out[i + 3] * out[i - 1];
    if (dot < 0) for (let c = 0; c < 4; c++) out[i + c] = -out[i + c];
  }
  return out;
}

const constantAt = (values, stride, rest, tolerance) => {
  for (let i = 0; i < values.length; i++) {
    const r = rest[i % stride];
    let d = Math.abs(values[i] - r);
    if (stride === 4) d = Math.min(d, Math.abs(values[i] + r)); // −q
    if (d > tolerance) return false;
  }
  return true;
};

function track(name, type, times, values, stride, rest, discrete) {
  const { decimals, tolerance } = PRECISION[type];
  const vals = type === 'quaternion' ? continuousQuaternions(values) : values;
  if (rest && constantAt(vals, stride, rest, tolerance)) return null; // the avatar's rest pose already says it
  const keep = reduceKeys(times, vals, stride, tolerance, discrete);
  const out = { name, type, times: [], values: [] };
  if (keep.length === 2) { // constant but not at rest: one key
    let constant = true;
    for (let c = 0; c < stride; c++) if (Math.abs(vals[c] - vals[(times.length - 1) * stride + c]) > tolerance) constant = false;
    if (constant) keep.pop();
  }
  for (const i of keep) {
    out.times.push(roundTo(times[i], 4));
    for (let c = 0; c < stride; c++) out.values.push(roundTo(vals[i * stride + c], decimals));
  }
  if (discrete && keep.length > 1) out.interpolation = DISCRETE;
  return out;
}

const PATHS = { translation: ['position', 'vector', 3], rotation: ['quaternion', 'quaternion', 4], scale: ['scale', 'vector', 3] };
const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };

/**
 * The one animation of a sign's exported `.glb` as a three.js AnimationClip JSON: `{ name, duration, tracks }`, tracks named
 * by SANITIZED node name. A track constant at the AVATAR's rest value (`avatar`, the glTF JSON of avatar.glb: its node TRS and
 * its default morph weights) is dropped, because the loaded avatar already holds it; a constant elsewhere keeps one key.
 * THE FACE comes from `face` — `{ fps, morphs: [{ mesh, names, values: [[…per frame]] }] }`, what Blender evaluated at every
 * frame (`export.py` → `sample_morphs`) — because the exporter bakes the face's drivers only for some signs. A morph-weight
 * channel in the `.glb` itself is still read, for a file exported otherwise.
 */
export function clipFromGlb(buf, name, avatar, face) {
  const { json: gltf, bin } = parseGlb(buf);
  const restNode = new Map((avatar ?? gltf).nodes.map((n) => [n.name, n]));
  const restWeights = (nodeName) => { const n = restNode.get(nodeName); return n?.mesh === undefined ? [] : (avatar ?? gltf).meshes[n.mesh].weights ?? []; };
  const anims = gltf.animations ?? [];
  if (anims.length !== 1) throw new Error(`${name}: ${anims.length} animations in the export, 1 expected`);
  const anim = anims[0];
  const tracks = [];
  let duration = 0;
  for (const ch of anim.channels) {
    const node = gltf.nodes[ch.target.node];
    const sampler = anim.samplers[ch.sampler];
    if (sampler.interpolation === 'CUBICSPLINE') throw new Error(`${name}: CUBICSPLINE sampler not handled`);
    const discrete = sampler.interpolation === 'STEP';
    const times = readAccessor(gltf, bin, sampler.input);
    const values = readAccessor(gltf, bin, sampler.output);
    duration = Math.max(duration, times[times.length - 1] ?? 0);
    const nodeName = sanitizeNodeName(node.name);
    if (ch.target.path === 'weights') {
      const mesh = gltf.meshes[node.mesh];
      const targets = mesh.extras?.targetNames;
      const width = mesh.primitives[0].targets?.length ?? 0;
      if (!targets || targets.length !== width) throw new Error(`${name}: morph targets of ${node.name} have no names`);
      for (let k = 0; k < width; k++) {
        const one = new Float32Array(times.length);
        for (let i = 0; i < times.length; i++) one[i] = values[i * width + k];
        const rest = [restWeights(node.name)[k] ?? 0];
        const t = track(`${nodeName}.morphTargetInfluences[${targets[k]}]`, 'number', times, one, 1, rest, discrete);
        if (t) tracks.push(t);
      }
      continue;
    }
    const [prop, type, stride] = PATHS[ch.target.path];
    const rest = restNode.get(node.name)?.[ch.target.path] ?? REST[ch.target.path];
    const t = track(`${nodeName}.${prop}`, type, times, values, stride, rest, discrete);
    if (t) tracks.push(t);
  }
  for (const set of face?.morphs ?? []) {
    const node = restNode.get(set.mesh);
    const targets = node?.mesh === undefined ? [] : (avatar ?? gltf).meshes[node.mesh].extras?.targetNames ?? [];
    const times = set.values.map((_, i) => i / face.fps);
    duration = Math.max(duration, times[times.length - 1] ?? 0);
    set.names.forEach((key, k) => {
      const one = set.values.map((row) => row[k]);
      const rest = [restWeights(set.mesh)[targets.indexOf(key)] ?? 0];
      const t = track(`${sanitizeNodeName(set.mesh)}.morphTargetInfluences[${key}]`, 'number', times, one, 1, rest, false);
      if (t) tracks.push(t);
    });
  }
  tracks.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { name, duration: roundTo(duration, 4), tracks };
}

// ── the numeric check: a clip against the avatar ───────────────────────────────────────────────────────────────────────────

/** Names the loaded avatar will have: sanitized node names (refused if two collide), and each mesh node's morph targets. */
export function avatarBindings(gltf) {
  const nodes = new Map();
  const duplicates = [];
  gltf.nodes.forEach((n, i) => {
    const s = sanitizeNodeName(n.name ?? '');
    if (nodes.has(s)) duplicates.push(s);
    nodes.set(s, i);
  });
  const morphs = new Map();
  for (const [s, i] of nodes) {
    const m = gltf.nodes[i].mesh;
    if (m !== undefined && gltf.meshes[m].extras?.targetNames) morphs.set(s, new Set(gltf.meshes[m].extras.targetNames));
  }
  return { nodes, morphs, duplicates };
}

const TRACK = /^([^[\].:/]+)\.(position|quaternion|scale|morphTargetInfluences)(?:\[(.+)\])?$/;

/** Every track of `clip` that does not resolve on the avatar, by reason. Empty lists mean the clip binds whole. */
export function checkClip(bindings, clip) {
  const problems = { unknownNode: [], unknownMorph: [], badTrack: [], duplicates: bindings.duplicates };
  for (const t of clip.tracks) {
    const m = TRACK.exec(t.name);
    if (!m) { problems.badTrack.push(t.name); continue; }
    const [, node, prop, index] = m;
    if (!bindings.nodes.has(node)) { problems.unknownNode.push(t.name); continue; }
    if (prop === 'morphTargetInfluences' && !bindings.morphs.get(node)?.has(index)) problems.unknownMorph.push(t.name);
    const width = { position: 3, scale: 3, quaternion: 4, morphTargetInfluences: 1 }[prop];
    if (t.values.length !== t.times.length * width) problems.badTrack.push(t.name);
  }
  return problems;
}

function sample(t, time) {
  const w = t.values.length / t.times.length;
  const v = (i) => t.values.slice(i * w, i * w + w);
  if (time <= t.times[0] || t.times.length === 1) return v(0);
  const last = t.times.length - 1;
  if (time >= t.times[last]) return v(last);
  let i = 0;
  while (t.times[i + 1] < time) i++;
  if (t.interpolation === DISCRETE) return v(i);
  const u = (time - t.times[i]) / (t.times[i + 1] - t.times[i]);
  const a = v(i);
  const b = v(i + 1);
  if (t.type !== 'quaternion') return a.map((x, c) => x + (b[c] - x) * u);
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = dot < 0 ? b.map((x) => -x) : b;
  dot = Math.abs(dot);
  if (dot > 0.9995) { const q = a.map((x, c) => x + (bb[c] - x) * u); const l = Math.hypot(...q); return q.map((x) => x / l); }
  const th = Math.acos(dot);
  const s = Math.sin(th);
  return a.map((x, c) => (Math.sin((1 - u) * th) * x + Math.sin(u * th) * bb[c]) / s);
}

const compose = ([tx, ty, tz], [x, y, z, w], [sx, sy, sz]) => [
  (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
  2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
  2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
  tx, ty, tz, 1,
]; // column-major, as glTF

const multiply = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};

/** The world position of a node of the avatar posed by `clip` at `time` (forward kinematics over the glTF hierarchy). */
export function worldPosition(gltf, clip, nodeName, time) {
  const parent = new Map();
  gltf.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parent.set(c, i)));
  const byName = new Map(clip.tracks.map((t) => [t.name, t]));
  let i = gltf.nodes.findIndex((n) => n.name === nodeName);
  if (i < 0) throw new Error(`no node ${nodeName}`);
  let m = null;
  while (i !== undefined) {
    const n = gltf.nodes[i];
    if (n.matrix) throw new Error(`node ${n.name} carries a matrix; TRS expected`);
    const s = sanitizeNodeName(n.name);
    const get = (path, prop) => (byName.has(`${s}.${prop}`) ? sample(byName.get(`${s}.${prop}`), time) : n[path] ?? REST[path]);
    const local = compose(get('translation', 'position'), get('rotation', 'quaternion'), get('scale', 'scale'));
    m = m ? multiply(local, m) : local;
    i = parent.get(i);
  }
  return [m[12], m[13], m[14]];
}

/** A morph weight of the avatar posed by `clip` at `time` (the mesh's default weight where the clip has no track). */
export function morphWeight(gltf, clip, meshNodeName, target, time) {
  const t = clip.tracks.find((x) => x.name === `${sanitizeNodeName(meshNodeName)}.morphTargetInfluences[${target}]`);
  if (t) return sample(t, time)[0];
  const node = gltf.nodes.find((n) => n.name === meshNodeName);
  const mesh = gltf.meshes[node.mesh];
  return mesh.weights?.[mesh.extras.targetNames.indexOf(target)] ?? 0;
}

/**
 * The clip against what Blender itself computed (`report.probe`: bone world heads and shape-key values at a few frames), as the
 * largest distance (avatar units, metres) and the largest weight difference. This checks the export and the conversion together.
 */
export function probeError(gltf, clip, report) {
  let position = 0;
  let weight = 0;
  for (const p of report.probe ?? []) {
    const time = (p.frame - report.frameStart) / report.fps;
    for (const [bone, want] of Object.entries(p.bones)) {
      const got = worldPosition(gltf, clip, bone, time);
      position = Math.max(position, Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]));
    }
    const names = gltf.meshes.flatMap((m) => m.extras?.targetNames ?? []);
    for (const [key, want] of Object.entries(p.shapeKeys?.values ?? {})) {
      if (!names.includes(key)) continue; // the Basis
      weight = Math.max(weight, Math.abs(morphWeight(gltf, clip, p.shapeKeys.mesh, key, time) - want));
    }
  }
  return { position, weight };
}

// ── avatar identity and the manifest ───────────────────────────────────────────────────────────────────────────────────────

/** How far (Blender units, i.e. metres; weights and colours are 0…1) a file's avatar may be from the avatar sign's and be it. */
export const IDENTITY_TOLERANCE = 1e-4;

/**
 * Which signs carry THE avatar. Blender reports, per part of each file (armature, rig, materials, `mesh:<name>`), the largest
 * difference from the avatar sign's file, or why it cannot compare (`shape differs`, `missing …`). A sign is the same avatar
 * when every part compares and none is beyond `tolerance`; any other is listed with the parts that are not.
 */
export function avatarIdentity(reports, tolerance = IDENTITY_TOLERANCE) {
  const same = [];
  const differing = {};
  let maxDiff = 0;
  for (const r of reports) {
    if (!r.identity) continue;
    const parts = Object.entries(r.identity.maxDiff);
    const bad = parts.filter(([, d]) => typeof d !== 'number' || d > tolerance);
    if (!parts.length) differing[r.name] = ['no part compared'];
    else if (bad.length) differing[r.name] = bad.map(([k, d]) => `${k}: ${typeof d === 'number' ? d.toExponential(2) : d}`);
    else { same.push(r.name); maxDiff = Math.max(maxDiff, ...parts.map(([, d]) => d)); }
  }
  return { same: same.sort(), differing, maxDiff };
}

/** The frames an action spans (both ends keyed) and the clip's length in seconds at the file's frame rate. */
export const timing = (report) => ({
  fps: report.fps,
  frames: Math.round(report.frameEnd - report.frameStart) + 1,
  duration: roundTo((report.frameEnd - report.frameStart) / report.fps, 4),
});

/** One manifest entry: the published file, its bytes and sha256, its timing, and the sha256 of the `.blend` it came from. */
export function clipEntry(name, file, bytes, report, source) {
  return { file, bytes: bytes.length, sha256: sha256(bytes), ...timing(report), action: report.action, source };
}

export function manifest({ blender, exporter, avatar, clips, failed = {} }) {
  const sorted = Object.fromEntries(Object.keys(clips).sort().map((k) => [k, clips[k]]));
  return {
    comment: [
      'VLibras signs for the free player (ADR-0234, route B). Derived from LAViD-UFPB `vlibras-dictionary-sources` (GPL-3.0) at',
      `commit ${COMMIT}; the Corresponding Source is each sign's .blend (sha256 under \`source\`) plus scripts/libras-export.mjs`,
      'and scripts/libras-export/export.py, run with the Blender named here. Clips are three.js AnimationClip JSON bound by name to',
      'avatar.glb (node names sanitized as three.js GLTFLoader does).',
    ],
    commit: COMMIT,
    blender,
    exporter,
    avatar,
    clips: sorted,
    failed,
  };
}

/** `libras-export/sources.json`: the pinned commit and one line per `.blend` (bytes, sha256), in the shape of libras-signs.json. */
export function pinsText(signs) {
  const head = {
    comment: [
      'THE .blend SOURCES OF THE EXPORTED SIGNS (ADR-0234, route B; scripts/libras-export.mjs): LAViD-UFPB vlibras-dictionary-sources',
      '(GPL-3.0) at `commit`, path FILES/BLENDS/BR/<NAME>.blend, each pinned by sha256 and byte count. They are the Corresponding',
      'Source of the exported avatar and clips, with the two export scripts. Written by `libras-export.mjs --write-pins`.',
    ],
    commit: COMMIT,
    source: SOURCE,
  };
  const lines = Object.keys(signs).sort().map((k) => `  ${JSON.stringify(k)}: { "bytes": ${signs[k].bytes}, "sha256": "${signs[k].sha256}" }`);
  return JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "signs": {\n${lines.map((l) => '  ' + l).join(',\n')}\n  }\n}\n`);
}

// ── the run ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function options(argv) {
  const o = { jobs: 4, avatarFrom: 'CASA', texturesFrom: '0', blender: process.env.BLENDER || 'blender' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--cache') o.cache = v();
    else if (k === '--out') o.out = v();
    else if (k === '--signs') o.signs = v().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--blender') o.blender = v();
    else if (k === '--jobs') o.jobs = Number(v());
    else if (k === '--avatar-from') o.avatarFrom = v();
    else if (k === '--textures-from') o.texturesFrom = v();
    else if (k === '--write-pins') o.writePins = true;
    else throw new Error(`unknown argument ${k}`);
  }
  if (!o.cache || !o.out) throw new Error('--cache <dir> and --out <dir> are required (both OUTSIDE the repository)');
  return o;
}

async function download(names, cache, pins, concurrency = 4) {
  mkdirSync(cache, { recursive: true });
  const failed = {};
  let next = 0;
  const worker = async () => {
    while (next < names.length) {
      const name = names[next++];
      const file = join(cache, `${name}.blend`);
      if (!existsSync(file)) {
        const res = await fetch(blendUrl(name));
        if (!res.ok) { failed[name] = `HTTP ${res.status}`; continue; }
        const bytes = Buffer.from(await res.arrayBuffer());
        if (!isBlend(bytes)) { failed[name] = 'not a .blend (LFS pointer or page?)'; continue; }
        writeFileSync(file + '.part', bytes);
        renameSync(file + '.part', file);
      }
      const pin = pins?.signs?.[name];
      if (pin) {
        const bytes = readFileSync(file);
        if (sha256(bytes) !== pin.sha256 || bytes.length !== pin.bytes) failed[name] = 'differs from the pinned sha256';
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return failed;
}

function runBlender(blender, jobFile, log) {
  return new Promise((resolve, reject) => {
    const p = spawn(blender, [...BLENDER_FLAGS, '--python', EXPORT_PY, '--', '--job', jobFile], { stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const on = (d) => { const s = d.toString(); tail = (tail + s).slice(-4000); for (const l of s.split(/\r?\n/)) if (l.startsWith('LIBRAS-EXPORT')) log(l); };
    p.stdout.on('data', on);
    p.stderr.on('data', on);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`blender exited ${code}\n${tail}`))));
  });
}

async function main() {
  const o = options(process.argv.slice(2));
  const names = o.signs ?? signNames(JSON.parse(readFileSync(SIGN_LIST, 'utf8')));
  const pins = existsSync(PINS) ? JSON.parse(readFileSync(PINS, 'utf8')) : null;
  console.log(`${names.length} signs; downloading what the cache lacks into ${o.cache}`);
  // The avatar's textures come from a sign file that PACKS them (export.py, TEXTURED): fetched even when not exported.
  const failed = await download([...new Set([...names, o.texturesFrom])], o.cache, o.writePins ? null : pins);
  if (failed[o.texturesFrom]) throw new Error(`the textures' source ${o.texturesFrom} could not be read: ${failed[o.texturesFrom]}`);
  if (!names.includes(o.texturesFrom)) delete failed[o.texturesFrom];
  const texturesBlend = join(o.cache, `${o.texturesFrom}.blend`);
  const ok = names.filter((n) => !failed[n]);
  if (o.writePins) {
    const all = { ...(pins?.signs ?? {}) };
    for (const n of ok) { const b = readFileSync(join(o.cache, `${n}.blend`)); all[n] = { bytes: b.length, sha256: sha256(b) }; }
    writeFileSync(PINS, pinsText(all));
  }
  for (const stale of ['raw', 'report', 'clips', 'avatar.glb', 'reference.json']) rmSync(join(o.out, stale), { recursive: true, force: true });
  mkdirSync(join(o.out, 'clips'), { recursive: true });
  const avatarName = ok.includes(o.avatarFrom) ? o.avatarFrom : ok[0];
  const entries = ok.map((name, index) => ({ index, name, blend: join(o.cache, `${name}.blend`), avatar: name === avatarName, textures: texturesBlend }));
  const started = Date.now();
  let done = 0;
  const log = (l) => { done++; if (done % 25 === 0 || /error/.test(l)) console.log(`[${done}/${entries.length}] ${l}`); };
  const batch = (signs, j) => {
    const jobFile = join(o.out, `job-${j}.json`);
    writeFileSync(jobFile, JSON.stringify({ out: o.out, signs }));
    return runBlender(o.blender, jobFile, log);
  };
  // The avatar sign first and alone: it writes avatar.glb and the reference every other file is compared with.
  await batch(entries.filter((e) => e.avatar), 'avatar');
  const first = JSON.parse(readFileSync(join(o.out, 'report', `${entries.find((e) => e.avatar).index}.json`), 'utf8'));
  if (first.error) throw new Error(`the avatar sign ${avatarName} failed, so no sign can be exported: ${first.error}\n${first.trace}`);
  const rest = entries.filter((e) => !e.avatar);
  const jobs = Array.from({ length: Math.max(1, Math.min(o.jobs, rest.length)) }, () => []);
  rest.forEach((e, i) => jobs[i % jobs.length].push(e));
  await Promise.all(jobs.filter((j) => j.length).map(batch));
  console.log(`blender: ${((Date.now() - started) / 1000).toFixed(0)} s`);

  const reports = entries.map((e) => JSON.parse(readFileSync(join(o.out, 'report', `${e.index}.json`), 'utf8')));
  const avatarBytes = readFileSync(join(o.out, 'avatar.glb'));
  const avatarGltf = parseGlb(avatarBytes).json;
  const bindings = avatarBindings(avatarGltf);
  const identity = avatarIdentity(reports);
  const clips = {};
  const checks = {};
  const sizes = [];
  let binaryEquivalent = 0;
  for (const [i, e] of entries.entries()) {
    const r = reports[i];
    if (r.error) { failed[e.name] = r.error; continue; }
    const raw = readFileSync(join(o.out, 'raw', `${e.index}.glb`));
    const clip = clipFromGlb(raw, e.name, avatarGltf, { fps: r.fps, morphs: r.morphs });
    const bytes = Buffer.from(JSON.stringify(clip));
    const file = `clips/${e.name}.json`;
    writeFileSync(join(o.out, file), bytes);
    const src = readFileSync(e.blend);
    clips[e.name] = clipEntry(e.name, file, bytes, r, { sha256: sha256(src), bytes: src.length });
    const problems = checkClip(bindings, clip);
    const error = probeError(avatarGltf, clip, r);
    const bad = problems.unknownNode.length + problems.unknownMorph.length + problems.badTrack.length;
    checks[e.name] = { bad, ...error, tracks: clip.tracks.length, keys: clip.tracks.reduce((s, t) => s + t.times.length, 0), problems: bad ? problems : undefined };
    sizes.push({ name: e.name, json: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length, rawAnimation: rawAnimationBytes(raw) });
    binaryEquivalent += clip.tracks.reduce((s, t) => s + 4 * (t.times.length + t.values.length), 0);
  }
  const exporter = parseGlb(readFileSync(join(o.out, 'raw', `${entries[0].index}.glb`))).json.asset.generator;
  const avatar = {
    file: 'avatar.glb', bytes: avatarBytes.length, sha256: sha256(avatarBytes), gzip: gzipSync(avatarBytes, { level: 9 }).length,
    from: avatarName, sameAvatarWithin: IDENTITY_TOLERANCE,
    textures: { from: o.texturesFrom, sha256: sha256(readFileSync(texturesBlend)), images: reports.find((r) => r.textures)?.textures },
  };
  writeFileSync(join(o.out, 'manifest.json'), JSON.stringify(manifest({ blender: reports.find((r) => r.blender)?.blender, exporter, avatar, clips, failed }), null, 1));
  const stat = (k) => { const v = sizes.map((s) => s[k]).sort((a, b) => a - b); const sum = v.reduce((a, b) => a + b, 0); return { n: v.length, sum, mean: Math.round(sum / v.length), median: v[v.length >> 1], max: v[v.length - 1], maxSign: sizes.find((s) => s[k] === v[v.length - 1])?.name }; };
  const summary = {
    signs: names.length, exported: Object.keys(clips).length, failed,
    avatar, identity: { same: identity.same.length, maxDiff: identity.maxDiff, differing: identity.differing },
    sizes: { json: stat('json'), gzip: stat('gzip'), rawAnimation: stat('rawAnimation'), binaryEquivalent },
    check: {
      clipsThatDoNotBind: Object.entries(checks).filter(([, c]) => c.bad).map(([n]) => n),
      maxPositionError: Math.max(...Object.values(checks).map((c) => c.position)),
      maxWeightError: Math.max(...Object.values(checks).map((c) => c.weight)),
      worstPosition: Object.entries(checks).sort((a, b) => b[1].position - a[1].position)[0]?.[0],
    },
    fidelity: reports.filter((r) => !r.error).map((r) => ({ name: r.name, action: r.action, fileVersion: r.fileVersion, range: [r.frameStart, r.frameEnd], fps: r.fps, fcurves: r.fcurves, actions: r.actions })),
    losses: mergeLosses(reports),
    checks,
  };
  writeFileSync(join(o.out, 'report.json'), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify({ ...summary, fidelity: undefined, checks: undefined }, null, 1));
}

function rawAnimationBytes(raw) {
  const { json } = parseGlb(raw);
  const views = new Set();
  for (const s of json.animations[0].samplers) { views.add(json.accessors[s.input].bufferView); views.add(json.accessors[s.output].bufferView); }
  return [...views].reduce((sum, v) => sum + json.bufferViews[v].byteLength, 0);
}

function mergeLosses(reports) {
  const out = {};
  for (const r of reports) {
    for (const [k, v] of Object.entries(r.losses ?? {})) {
      const key = `${k}=${JSON.stringify(v)}`;
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
