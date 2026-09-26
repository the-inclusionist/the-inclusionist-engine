// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-load — WHAT THE DELIVERY SHIPPED FOR THE FREE PLAYER, AND OPENING IT (ADR-0234, route B, phase B2).
//
// The half of `ui/libras-avatar-player` that talks to the delivery: where its files are, whether it shipped the avatar at all
// (its manifest, which only `inclusionist-heavy --libras-avatar` writes), the canvas the avatar is drawn on, the stage built on
// it from the avatar's bytes — within a time, or not at all — and the clips, each fetched and prepared once. Every answer is a
// value, never a throw: a delivery without the avatar, a device without WebGL and a clip that cannot be read are reasons, which
// the player hands to deaf mode and deaf mode to `problems` (ADR-0169).

import { LIBRAS_PLAYER_FOLDER } from '../platform/heavy-catalogue.js';
import { LIBRAS_GLOSSES_FILE } from './libras-glosses.js';
import { LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_MANIFEST, avatarManifestOf, type AvatarManifest } from './libras-avatar-plan.js';
import type { ClipJson } from './libras-avatar-clip.js';
import type { AvatarStage } from './libras-avatar-stage.js';

/** The host's `fetch`, lent unbound — and called bare, never as a method of what carries it. */
export type FetchFile = ((url: string) => Promise<Response>) | undefined;

/** Why a delivery with no avatar cannot sign, and the fix (ADR-0169). */
export const NOT_SHIPPED = 'the Libras avatar is not installed in this delivery — build it with `inclusionist-heavy <folder> --libras-avatar`';
/** Why a request that waited across a `hide()` or the root's end was not signed. */
export const RELEASED = 'the interpreter was taken off the screen before it signed';

/** Where the delivery's files are: the avatar's folder, its manifest, and the glosses `--libras` writes beside route A's page. */
export interface AvatarPlace {
  readonly folder: string;
  readonly manifest: string;
  readonly glosses: string;
}

/** The addresses under `base`, or `null` where it resolves nothing — a host whose document has no address finds no avatar. */
export function avatarPlace(base: string, folder = LIBRAS_AVATAR_FOLDER, glossesFolder = LIBRAS_PLAYER_FOLDER): AvatarPlace | null {
  try {
    const at = new URL(folder, base);
    return { folder: at.href, manifest: new URL(LIBRAS_AVATAR_MANIFEST, at).href,
      glosses: new URL(LIBRAS_GLOSSES_FILE, new URL(glossesFolder, base)).href };
  } catch {
    return null;
  }
}

/** A JSON file of the delivery, or `null` — no fetch, no file, not JSON. */
async function readJson(fetchFile: FetchFile, url: string): Promise<unknown> {
  if (!fetchFile) return null;
  try {
    const resp = await fetchFile(url);
    return resp.ok ? await resp.json() : null;
  } catch {
    return null;
  }
}

/** The delivery's manifest, or `null` for a delivery that did not ship the avatar. */
export const readManifest = async (fetchFile: FetchFile, place: AvatarPlace): Promise<AvatarManifest | null> =>
  avatarManifestOf(await readJson(fetchFile, place.manifest));

/** The canvas the avatar is drawn on: route A's place and size, in front of the screen, watched and never operated. */
export function avatarCanvas(doc: Document, title: string): HTMLCanvasElement {
  const canvas = doc.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', title);
  canvas.tabIndex = -1; // the keyboard stays with the game
  canvas.hidden = true;
  Object.assign(canvas.style, {
    position: 'fixed', right: '0', bottom: '0', width: 'max(25vw, 200px)', height: 'max(50vh, 200px)', border: '0',
    background: 'transparent', pointerEvents: 'none', zIndex: '2147483000',
  });
  doc.body.append(canvas);
  return canvas;
}

export interface AvatarOpening {
  readonly fetchFile: FetchFile;
  /** The avatar's address, from the manifest. */
  readonly avatarUrl: string;
  readonly loadStage: (canvas: HTMLCanvasElement, avatar: ArrayBuffer) => Promise<AvatarStage>;
  readonly timeoutMs: number;
  readonly win: Pick<Window, 'setTimeout' | 'clearTimeout'>;
}

/** A stage, or why there is none. */
export type Opened = { readonly stage: AvatarStage } | { readonly reason: string };

const reasonOf = (failure: unknown): string => (failure instanceof Error ? failure.message : String(failure));

async function build(canvas: HTMLCanvasElement, o: AvatarOpening, wanted: () => boolean): Promise<Opened> {
  const { fetchFile } = o; // called bare, as `FetchFile` says
  if (!fetchFile) return { reason: NOT_SHIPPED };
  try {
    const resp = await fetchFile(o.avatarUrl);
    if (!resp.ok) {
      return { reason: `the Libras avatar could not be read from the delivery (HTTP ${resp.status}) — build it again with `
        + '`inclusionist-heavy <folder> --libras-avatar`' };
    }
    const stage = await o.loadStage(canvas, await resp.arrayBuffer());
    if (!wanted()) { stage.dispose(); return { reason: RELEASED }; } // given up on or released meanwhile: nothing is kept
    return { stage };
  } catch (failure) {
    return { reason: `the Libras avatar cannot be drawn here: ${reasonOf(failure)}` };
  }
}

/**
 * Builds the stage on `canvas` from the delivery's avatar: the stage, or why not — an avatar the delivery cannot give, a device
 * that cannot draw it, a load past `timeoutMs`. `wanted()` is asked when the stage arrives: false, and it is released at once.
 * `cancel()` answers «released» now and clears the timer, so nothing of a released root outlives it.
 */
export function openAvatar(canvas: HTMLCanvasElement, o: AvatarOpening, wanted: () => boolean): {
  readonly done: Promise<Opened>; readonly cancel: () => void;
} {
  let answer: (r: Opened) => void = () => { /* replaced below, synchronously */ };
  const stopped = new Promise<Opened>((resolve) => { answer = resolve; });
  const timer = o.win.setTimeout(() => {
    answer({ reason: `the Libras avatar did not load within ${Math.round(o.timeoutMs / 1000)} s` });
  }, o.timeoutMs);
  const done = Promise.race([build(canvas, o, wanted), stopped]).then((r) => { o.win.clearTimeout(timer); return r; });
  return { done, cancel: () => { o.win.clearTimeout(timer); answer({ reason: RELEASED }); } };
}

const isClipJson = (data: unknown): data is ClipJson => {
  const c = data as Partial<ClipJson> | null;
  return !!c && typeof c.duration === 'number' && Array.isArray(c.tracks);
};

/**
 * Makes each clip of `names` playable on `stage`, fetching the ones it has not got — once each, remembered in `ready` — and
 * answers the names whose file could not be read or prepared.
 */
export async function prepareClips(stage: AvatarStage, names: readonly string[], manifest: AvatarManifest, place: AvatarPlace,
  fetchFile: FetchFile, ready: Map<string, Promise<boolean>>): Promise<string[]> {
  const one = async (name: string): Promise<boolean> => {
    const w = manifest.clips.get(name);
    if (!w) return false;
    const file = w.file.split('/').map(encodeURIComponent).join('/');
    const json = await readJson(fetchFile, new URL(file, place.folder).href);
    if (!isClipJson(json)) return false;
    try { stage.prepare(name, json, w.from); return true; } catch { return false; }
  };
  const read = await Promise.all(names.map((name) => {
    let loading = ready.get(name);
    if (!loading) { loading = one(name); ready.set(name, loading); }
    return loading;
  }));
  return names.filter((_, i) => !read[i]);
}
