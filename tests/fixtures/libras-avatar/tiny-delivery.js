// SPDX-License-Identifier: AGPL-3.0-or-later
// A TINY DELIVERY OF THE FREE LIBRAS PLAYER (ADR-0234, route B), for the browser tests of `ui/libras-avatar-player`: an avatar
// built here as a real glTF binary — three nodes, a two-primitive «head» with one morph target (the shape the export's head has,
// which three.js loads as a group of two meshes), and an embedded PNG texture — and clips in the export's three.js JSON, short so
// a case runs in a second. It is served through the `fetch` the interpreter is given: no file, no network.

/** The avatar's rest: where `Hand` stands when no clip drives it. */
export const HAND_REST_Y = 1;

function glb(json, bin) {
  const enc = new TextEncoder();
  const text = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (text.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + text.length + jsonPad + 8 + bin.length + binPad;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, text.length + jsonPad, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.length, 20 + text.length + jsonPad);
  const at = 20 + text.length + jsonPad;
  view.setUint32(at, bin.length + binPad, true);
  view.setUint32(at + 4, 0x004e4942, true);
  out.set(bin, at + 8);
  return out.buffer;
}

/** A 64×64 PNG, drawn and encoded by the browser itself. */
async function png() {
  const canvas = new OffscreenCanvas(64, 64);
  const g = canvas.getContext('2d');
  g.fillStyle = '#c8906a';
  g.fillRect(0, 0, 64, 64);
  return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}

/** The avatar as `avatar.glb` bytes. */
export async function tinyAvatar() {
  const floats = [
    // primitive 0 and its morph target, primitive 1 and its morph target: a triangle each, the target lifting one corner
    -0.5, 1.5, 0, 0, 1.5, 0, -0.25, 2, 0, /**/ 0, 0, 0, 0, 0, 0, 0, 0.3, 0,
    0, 1.5, 0, 0.5, 1.5, 0, 0.25, 2, 0, /**/ 0, 0, 0, 0, 0, 0, 0, 0.3, 0,
    // uv for both
    0, 0, 1, 0, 0.5, 1,
  ];
  const geometry = new Uint8Array(new Float32Array(floats).buffer);
  const image = await png();
  const imagePad = (4 - (geometry.length % 4)) % 4;
  const bin = new Uint8Array(geometry.length + imagePad + image.length);
  bin.set(geometry, 0);
  bin.set(image, geometry.length + imagePad);
  const vec3 = (offset) => ({ bufferView: 0, byteOffset: offset, componentType: 5126, count: 3, type: 'VEC3' });
  const json = {
    asset: { version: '2.0', generator: 'the-inclusionist tests' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Avatar', children: [1, 2] },
      { name: 'Hand', translation: [0, HAND_REST_Y, 0] },
      { name: 'Head', mesh: 0 },
    ],
    meshes: [{
      name: 'Head', weights: [0], extras: { targetNames: ['Smile'] },
      primitives: [
        { attributes: { POSITION: 0, TEXCOORD_0: 4 }, targets: [{ POSITION: 1 }], material: 0 },
        { attributes: { POSITION: 2, TEXCOORD_0: 4 }, targets: [{ POSITION: 3 }], material: 0 },
      ],
    }],
    materials: [{ name: 'Skin', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.7 } }],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987 }],
    images: [{ bufferView: 1, mimeType: 'image/png', name: 'skin' }],
    accessors: [
      { ...vec3(0), min: [-0.5, 1.5, 0], max: [0, 2, 0] },
      { ...vec3(36), min: [0, 0, 0], max: [0, 0.3, 0] },
      { ...vec3(72), min: [0, 1.5, 0], max: [0.5, 2, 0] },
      { ...vec3(108), min: [0, 0, 0], max: [0, 0.3, 0] },
      { bufferView: 0, byteOffset: 144, componentType: 5126, count: 3, type: 'VEC2' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: geometry.length },
      { buffer: 0, byteOffset: geometry.length + imagePad, byteLength: image.length },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  return glb(json, bin);
}

/** A clip moving `Hand` up from its rest to `to` and holding it there, `duration` seconds long. */
export const raise = (name, duration, to = 3) => ({
  name, duration, tracks: [{ name: 'Hand.position', type: 'vector', times: [0, duration], values: [0, HAND_REST_Y, 0, 0, to, 0] }],
});
/** A clip that leaves `Hand` alone and smiles — the head's morph target, on the head's NODE as the export names it. */
export const smile = (name, duration) => ({
  name, duration, tracks: [{ name: 'Head.morphTargetInfluences[Smile]', type: 'number', times: [0, duration], values: [0, 1] }],
});

/** The clips the tiny delivery carries: four signs, two digits, a smile — each a fraction of a second. */
export const CLIPS = {
  GATO: raise('GATO', 0.4, 2),
  GALINHA: raise('GALINHA', 0.4, 2.5),
  CAVALO: raise('CAVALO', 0.4, 3),
  PEIXE: raise('PEIXE', 0.4, 3.5),
  1: raise('1', 0.3, 1.5),
  2: raise('2', 0.3, 1.6),
  SORRIR: smile('SORRIR', 0.4),
};

/**
 * The delivery as a `fetch`: the manifest, the avatar, the clips and the glosses under `base`, and what was asked. `drop` names
 * files the delivery does not have; `glosses` the `[text, gloss]` pairs its `glosses.json` holds.
 */
export async function tinyDelivery(base, { drop = [], glosses = [] } = {}) {
  const avatar = await tinyAvatar();
  const files = new Map([
    ['libras/avatar/manifest.json', JSON.stringify({ format: 1, avatar: 'avatar.glb', clips: Object.fromEntries(
      Object.entries(CLIPS).map(([n, c]) => [n, { file: `clips/${n}.json`, duration: c.duration }])) })],
    ['libras/avatar/avatar.glb', avatar],
    ...Object.entries(CLIPS).map(([n, c]) => [`libras/avatar/clips/${encodeURIComponent(n)}.json`, JSON.stringify(c)]),
    ['libras/player/glosses.json', JSON.stringify({ format: 1, made: 'test', glosses })],
  ]);
  const asked = [];
  // behaves as the host's `window.fetch` does when lent unbound: called as a method of anything else, it refuses
  const fetch = async function fetch(url) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    const path = url.slice(base.length);
    asked.push(path);
    const body = drop.includes(path) ? undefined : files.get(path);
    return body === undefined ? new Response('not here', { status: 404 }) : new Response(body);
  };
  return { fetch, asked };
}
