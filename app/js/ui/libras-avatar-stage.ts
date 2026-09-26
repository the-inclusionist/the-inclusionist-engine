// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-stage — THE FREE PLAYER'S STAGE: three.js, the avatar and its clips (ADR-0234, route B, phase B2).
//
// 📌 THE ONLY MODULE THAT NAMES three.js, and it is reached only by the dynamic `import()` in `ui/libras-avatar-player`, at the
// first sign in deaf mode (ADR-0234 errata): a child who never turns deaf mode on never downloads three.js. three.js 0.186.1,
// MIT, a runtime `dependency` pinned to that exact version; the types are `three-subset.d.ts`, beside this file.
//
// WHAT IT DOES: parses the delivery's `avatar.glb` (GLTFLoader, from the bytes the player fetched — no loader fetches anything),
// frames the signing space, and plays clips on one `AnimationMixer`, each once, its last frame held. Two things the export
// hands over are answered here and not hidden:
//   · the face: a morph track names the head's node, which three.js loads as a group of two meshes — `bindFaceTracks` writes
//     it once for each mesh that carries the targets;
//   · the bones a clip does not move: the export dropped the tracks at the avatar's rest, so a clip that follows one that moved
//     them must bring them back. The mixer does it: a property no running clip drives is blended back to the value it had when
//     it was first bound — the avatar's rest, since nothing else ever poses it — and an action whose fade-out ended is stopped,
//     which restores it outright (`tests/libras-avatar.browser.test.js` holds it).
//
// 🔴 TEXTURES ARE DECODED HERE, NOT BY THE LOADER'S OWN IMAGE LOADER: three.js reads an embedded image by `fetch`ing a `blob:`
// URL, which the delivery's `connect-src 'self'` refuses. `createImageBitmap` over the bytes fetches nothing, and it is also
// where the avatar's 2048² textures are brought down to `TEXTURE_SIZE` — the interpreter is a few hundred pixels tall.

import {
  AnimationClip, AnimationMixer, Box3, DirectionalLight, HemisphereLight, LoopOnce, PerspectiveCamera, Scene, Vector3,
  WebGLRenderer, type AnimationAction, type Mesh, type Object3D,
} from 'three';
import { GLTFLoader, type GLTFParser, type GLTFLoaderPlugin } from 'three/addons/loaders/GLTFLoader.js';
import { bindFaceTracks, clipFrom, type ClipJson } from './libras-avatar-clip.js';

/**
 * The longest side a texture keeps, in pixels. 📏 The export's head and body textures are 2048² each: 16 MiB of pixels apiece
 * once decoded, 21 with mipmaps; at 1024² a quarter of that. The avatar is drawn a few hundred pixels tall.
 */
const TEXTURE_SIZE = 1024;

/** What the player drives. */
export interface AvatarStage {
  /** The avatar's three.js root, for a test or a measurement that reads the pose. Nothing in the engine reads it. */
  readonly scene: object;
  /** Makes a clip playable, from `from` seconds of it on. */
  readonly prepare: (name: string, clip: ClipJson, from: number) => void;
  readonly has: (name: string) => boolean;
  /** Puts a prepared clip on the stage, fading in over `fade` seconds from what is there, `at` seconds into it. */
  readonly start: (name: string, fade: number, at: number) => void;
  /** Moves the clips `dt` seconds and draws. */
  readonly advance: (dt: number) => void;
  /** The canvas's size in CSS pixels and the pixel ratio it is drawn at. */
  readonly resize: (width: number, height: number, pixelRatio: number) => void;
  /** What the drawing costs, for a measurement: the renderer's own counters. */
  readonly stats: () => { readonly textures: number; readonly geometries: number; readonly calls: number; readonly triangles: number };
  /** Releases the GPU and everything the avatar holds. */
  readonly dispose: () => void;
}

export interface AvatarStageOptions {
  /** The canvas the avatar is drawn on: the player's, already in its document. */
  readonly canvas: HTMLCanvasElement;
  /** The delivery's `avatar.glb`, as bytes. */
  readonly avatar: ArrayBuffer;
  readonly textureSize?: number;
}

const isMesh = (o: Object3D): o is Mesh => (o as Partial<Mesh>).isMesh === true;

/** The loader's texture step, replaced: the embedded image decoded from its bytes (no `blob:` fetch), then brought down to `size`. */
function decodedTextures(size: number): (parser: GLTFParser) => GLTFLoaderPlugin {
  return (parser) => ({
    name: 'incl_decoded_textures',
    loadTexture: (textureIndex) => {
      const texture = parser.json.textures?.[textureIndex];
      const source = texture?.source;
      const image = source === undefined ? undefined : parser.json.images?.[source];
      if (source === undefined || image?.bufferView === undefined) return null; // not embedded: the loader's own path
      return parser.getDependency('bufferView', image.bufferView).then(async (bytes) => {
        const blob = new Blob([bytes], { type: image.mimeType ?? 'image/png' });
        let bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
        if (scale < 1) {
          const full = bitmap;
          bitmap = await createImageBitmap(full, {
            premultiplyAlpha: 'none', colorSpaceConversion: 'none', resizeQuality: 'high',
            resizeWidth: Math.max(1, Math.round(full.width * scale)), resizeHeight: Math.max(1, Math.round(full.height * scale)),
          });
          full.close();
        }
        const decoded = bitmap;
        return parser.loadTextureImage(textureIndex, source, {
          isImageBitmapLoader: true,
          load: (_url, onLoad) => { onLoad(decoded); },
        });
      });
    },
  });
}

/**
 * The meshes a morph track on each node must reach: for a node that is not itself a mesh with morph targets but holds meshes
 * that have them (the head, loaded as a group of two), their uuids — three.js binds a track by uuid as well as by name.
 */
function faceMeshes(root: Object3D): Map<string, string[]> {
  const out = new Map<string, string[]>();
  root.traverse((node) => {
    if (isMesh(node) && node.morphTargetDictionary) return;
    const meshes = node.children.filter((c) => isMesh(c) && !!c.morphTargetDictionary).map((c) => c.uuid);
    if (meshes.length && node.name) out.set(node.name, meshes);
  });
  return out;
}

/**
 * The signing space, framed on the head (the mesh with morph targets): from just above it to below the waist, where Libras signs
 * are made. 📏 Tuned on the export's avatar (screenshot of 2026-09-25): its head mesh runs from the hair's base to the neck, and
 * 1.45 of its heights below it is a little under the belt — the face about a quarter of the frame's height.
 */
function frame(root: Object3D, camera: PerspectiveCamera): void {
  root.updateMatrixWorld(true);
  const face = new Box3();
  root.traverse((node) => { if (isMesh(node) && node.morphTargetDictionary) face.expandByObject(node); });
  const box = face.isEmpty() ? new Box3().setFromObject(root) : face;
  const center = box.getCenter(new Vector3());
  const head = box.getSize(new Vector3()).y || 1;
  const top = box.max.y + 0.15 * head;
  const bottom = box.min.y - 1.45 * head;
  const middle = (top + bottom) / 2;
  const tall = top - bottom;
  const fov = 30;
  const distance = (tall / 2) / Math.tan((fov / 2) * Math.PI / 180);
  camera.position.set(center.x, middle, box.max.z + distance);
  camera.lookAt(center.x, middle, center.z);
  camera.updateProjectionMatrix();
}

/**
 * Builds the stage over `canvas`. THROWS where it cannot draw — no WebGL, an avatar three.js cannot read — and the player turns
 * that into «signing unavailable», with the reason.
 */
export async function createAvatarStage({ canvas, avatar, textureSize = TEXTURE_SIZE }: AvatarStageOptions): Promise<AvatarStage> {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  let root: Object3D;
  try {
    const loader = new GLTFLoader().register(decodedTextures(textureSize));
    root = (await loader.parseAsync(avatar, '')).scene;
  } catch (failure) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw failure;
  }
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.05, 200);
  const sky = new HemisphereLight(0xffffff, 0x8a8a9a, 2.2);
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(2, 6, 10);
  scene.add(root, sky, key);
  frame(root, camera);

  const mixer = new AnimationMixer(root);
  const meshesOf = faceMeshes(root);
  /** Each clip twice: the same sign signed twice in a row fades into its own copy, not into itself. */
  const clips = new Map<string, readonly [AnimationClip, AnimationClip]>();
  let current: AnimationAction | null = null;
  /** Actions fading out or held: stopped once their weight reaches nothing, which returns what they drove to rest. */
  const leaving = new Set<AnimationAction>();

  const draw = (): void => { renderer.render(scene, camera); };

  return {
    scene: root,
    prepare: (name, json, from) => {
      const bound = bindFaceTracks(clipFrom(json, from), (node) => meshesOf.get(node) ?? null);
      // 🔴 `AnimationClip.parse` copies the JSON's `uuid`, and the export writes none: every parsed clip has the SAME uuid
      // (`undefined`), and the mixer keys its actions by uuid — so every clip played as the first one ever asked for. A clone
      // is built by the constructor, which gives it a uuid of its own.
      const clip = AnimationClip.parse(bound).clone();
      clip.name = name;
      clips.set(name, [clip, clip.clone()]);
    },
    has: (name) => clips.has(name),
    start: (name, fade, at) => {
      const pair = clips.get(name);
      if (!pair) return;
      const clip = current?.getClip() === pair[0] ? pair[1] : pair[0];
      const action = mixer.clipAction(clip);
      leaving.delete(action);
      action.reset();
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.time = at;
      action.play();
      if (current) {
        if (fade > 0) { action.crossFadeFrom(current, fade, false); leaving.add(current); } else current.stop();
      }
      current = action;
    },
    advance: (dt) => {
      mixer.update(dt);
      for (const action of leaving) {
        if (!action.enabled) { action.stop(); leaving.delete(action); }
      }
      draw();
    },
    resize: (width, height, pixelRatio) => {
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), false);
      camera.aspect = width > 0 && height > 0 ? width / height : 1;
      camera.updateProjectionMatrix();
      draw();
    },
    stats: () => ({
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries,
      calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
    }),
    dispose: () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.traverse((node) => {
        if (!isMesh(node)) return;
        node.geometry.dispose();
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          for (const value of Object.values(material)) {
            const texture = value as { isTexture?: boolean; image?: { close?: () => void }; dispose?: () => void } | null;
            if (texture?.isTexture) { texture.dispose?.(); texture.image?.close?.(); }
          }
          material.dispose();
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
