// SPDX-License-Identifier: AGPL-3.0-or-later
// render/high-contrast — Direct Rendering: the accessibility high-contrast engine (ADR-0011) — outline + color-blocking
// by role + a pushed-back background (desaturated/darkened), 3 contrast levels (3:1/4.5:1/7:1).
// worldToTextureDirect/directBgTexture/directSprite{Canvas,Texture} + the caches (worldTexFor/spriteTexFor) + the HC_ROLE
// palette (persisted) live here. INJECTED through initHighContrast: the grid's bounds (W/H), the tile lookup, the two
// outline levels (outlineFg/outlineBg, which the host changes) and the NORMAL world canvas/texture (the scenery can swap
// it → getter). The "mode already applied" cache that the host's static render pipeline uses to decide when to reapply
// textures per viewport is NOT here: it is not a high-contrast cache, and several subsystems outside write into it.
// See the ADR-0011 record (visual accessibility).

import { makeCanvas, tex } from './canvas.js';
import { outlineCanvas } from './sprite-fx.js';
import { TILE } from '../core/constants.js';
import { HC_ROLE_DEF, type HcRoleKey, type PaintableRole } from './hc-role-data.js';
import type { Store } from '../platform/storage.js';
import { KEYS } from '../platform/storage-keys.js';

/* ===================== role → colour (color-blocking) ===================== */
// The roles and their default colours live in render/hc-role-data (a leaf, no dependencies), because the visual
// accessibility panel needs the SAME list to offer a colour picker per role. Re-exported here so this module's importers
// need not know there was a split.
export type { PaintableRole, HcRoleKey } from './hc-role-data.js';
export { HC_ROLE_KEYS, HC_ROLE_DEF } from './hc-role-data.js';
/** The LIVE role palette: the defaults until `initHighContrast` lays the child's stored colours over them (ADR-0232). */
export const HC_ROLE: Record<HcRoleKey, [number, number, number]> =
  JSON.parse(JSON.stringify(HC_ROLE_DEF)) as Record<HcRoleKey, [number, number, number]>;
/** Lays the stored colours over `HC_ROLE`, each clamped to 0–255; a malformed entry keeps its default. */
function loadHcRole(store: HighContrastStore): void {
  const s = store.getJSON<Partial<Record<HcRoleKey, number[]>>>(KEYS.hcrole, null);
  if (!s || typeof s !== 'object') return;
  for (const k of Object.keys(HC_ROLE) as HcRoleKey[]) {
    const v = s[k];
    if (Array.isArray(v) && v.length === 3) HC_ROLE[k] = v.map((n) => Math.max(0, Math.min(255, n | 0))) as [number, number, number];
  }
}
/** Persists HC_ROLE (called by whoever changes or resets a role colour), through the store `initHighContrast` received. */
export function saveHcRole(): void { ctx?.store.setJSON(KEYS.hcrole, HC_ROLE); }

/* ===================== 3 contrast levels ===================== */
export interface DirectCfg { off: number; mul: number; bgMul: number }
// off/mul = the platform map (more off = lighter → more contrast); bgMul = the background (lower = darker/pushed back).
// Platform×background contrast ≈ 3 / 4.5 / 7 (see ADR-0011: 3:1 is the default, and 7:1 looks ugly).
export const DIRECT_CFG: Record<string, DirectCfg> = {
  'hc-direto': { off: 55, mul: 0.5, bgMul: 0.30 },
  'hc-direto-45': { off: 66, mul: 0.5, bgMul: 0.28 },
  'hc-direto-7': { off: 100, mul: 0.48, bgMul: 0.13 },
};
export function dcfg(mode: string): DirectCfg { return DIRECT_CFG[mode] || DIRECT_CFG['hc-direto']; }

/* ===================== desaturation/darkening (background/structure) ===================== */
export function dimDesat(c: CanvasRenderingContext2D, w: number, h: number, mul: number, blue: number, off?: number): void {
  off = off || 0;
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], g = off + l * mul;
    d[i] = Math.min(255, g) | 0; d[i + 1] = Math.min(255, g * 1.02) | 0; d[i + 2] = Math.min(255, g * blue) | 0;
  }
  c.putImageData(img, 0, 0);
}

/* ===================== DI: the grid's bounds + outlines + the NORMAL canvases/textures ===================== */
export interface HighContrastCtx {
  W: number; H: number; // the world's width/height in tiles — `tileAt` already resolves off-grid; the loops use W/H as the bound
  /**
   * WHICH TILE IS AT (tx,ty) — a QUESTION and not an import. This module is the engine's (its subject is WCAG 1.4.6's
   * high contrast), but to paint role by role it needs to know what is in each cell — and that is ONE game's grid.
   * By asking, the engine does not import tile geometry: whoever has a grid answers, and whoever does not never mounts
   * this module.
   * ⚠️ REQUIRED, by ADR-0224's precedent: an optional door is one more field a game can forget, and forgetting this one
   * would paint the whole world one colour.
   */
  tileAt: (tx: number, ty: number) => number;
  outlineFg: () => number; // the foreground outline level (0/1/2) — the host changes it
  outlineBg: () => number; // the background outline level (0/1/2) — the host changes it
  getWorldCanvasNormal: () => HTMLCanvasElement; // the host may redraw the world canvas when the scenery changes → getter
  getWorldTexNormal: () => unknown; // the world texture, likewise
  /**
   * THE SPRITES THE GAME WANTS RECOLOURED, BY ID. The engine caches per `(id, mode)` and never knows what the id means
   * — it may be a coin, a syllable, a board piece.
   *
   * Not a fixed pair shaped like one game's coin: a second game wanting to recolour its piece would have no way in —
   * it would have to call the piece a "coin", or reimplement the cache.
   *
   * A function and not a value because a sprite's canvas may be redrawn at boot (the same reason as
   * `getWorldCanvasNormal`), and a value read once would freeze the first instant's.
   */
  sprites: () => Record<string, { canvas: HTMLCanvasElement | null; tex: unknown }>;
  /**
   * TILE → SEMANTIC ROLE, and the consumer is who knows. `null` = structure (no repaint).
   *
   * Not a table fixed IN HERE (`9` hazard, `4|5|10` climbable, `3` water): ADR-0027 named that the base's no. 1
   * coupling. "Hazard is tile 9" is true of ONE MAP, not of the engine; a second game with another numbering would
   * paint the floor orange and the lava grey — no error, no red test, for whoever can least check it by looking.
   *
   * Swapping the table is swapping the game, and nothing more.
   */
  roleOf: (t: number) => PaintableRole | null;
  /**
   * Where the child's role colours are kept — the page's store, built by the root (ADR-0232, issue #207). Required: colours
   * read from nowhere come back to the defaults at every visit, and a child who chose them because that is how they see
   * would lose them in silence.
   */
  store: HighContrastStore;
}
/** What the role palette is read and written through. */
export type HighContrastStore = Pick<Store, 'getJSON' | 'setJSON'>;
let ctx: HighContrastCtx | null = null;
/** Wires the host and READS the stored role colours into `HC_ROLE` — at init, never at import (ADR-0232). */
export function initHighContrast(c: HighContrastCtx): void { ctx = c; loadHcRole(c.store); }
function requireCtx(): HighContrastCtx {
  if (!ctx) throw new Error('render/high-contrast: initHighContrast(ctx) has not been called yet');
  return ctx;
}

/* ===================== Direct Rendering: world + background + foreground sprites ===================== */

/** The world in high contrast: a desaturated/lightened base + repaint by role (with the ladder as a special case:
 *  rails/rungs, not a solid band) + a background outline on the outer perimeter (walkable × not walkable). */
export function worldToTextureDirect(srcCanvas: HTMLCanvasElement, mode: string): unknown {
  const hc = requireCtx();
  const cfg = dcfg(mode);
  const cv = makeCanvas(srcCanvas.width, srcCanvas.height), c = cv.getContext('2d')!;
  c.drawImage(srcCanvas, 0, 0);
  dimDesat(c, cv.width, cv.height, cfg.mul, 1.22, cfg.off); // base: structure turns blue-grey (lighter = more contrast)
  for (let y = 0; y < hc.H; y++) for (let x = 0; x < hc.W; x++) {
    const t = hc.tileAt(x, y), role = hc.roleOf(t); if (!role) continue; // repaint non-structural tiles in the role's colour
    // ⚠️ WHAT PLATFORMER IS LEFT HERE. The ladder is drawn with rails and rungs because a solid band does not READ as a
    // ladder — an accessibility decision that would serve any game with something climbable. But the shape of the
    // injected question ("does this tile draw as a ladder?" · "which painter does this role use?") has no evidence to
    // choose it yet, and a consumer showed, in menu-nav, that the shape matters more than the existence of the
    // injection. Declared instead of guessed.
    if (t === 4) drawLadder(c, x * TILE, y * TILE);
    else repaintByRole(c, x * TILE, y * TILE, role);
  }
  outlineSecondPlane(c, hc, hc.outlineBg());
  return tex(cv);
}

/** LADDER: black + rails and rungs in the role's colour → it reads as a ladder, not a solid band. */
function drawLadder(c: CanvasRenderingContext2D, X: number, Y: number): void {
  c.fillStyle = '#0a0e14'; c.fillRect(X, Y, TILE, TILE);
  c.fillStyle = 'rgb(' + HC_ROLE.climb.join(',') + ')'; c.fillRect(X + 1, Y, 2, TILE); c.fillRect(X + TILE - 3, Y, 2, TILE); // side rails (the role's colour, customisable)
  for (let ry = 2; ry < TILE - 1; ry += 5) c.fillRect(X + 1, Y + ry, TILE - 2, 2); // rungs
}

/** A tile repainted in its role's colour, by the brightness of each pixel (BT.601 luma); a hazard starts from brighter. */
function repaintByRole(c: CanvasRenderingContext2D, X: number, Y: number, role: PaintableRole): void {
  const rc = HC_ROLE[role], img = c.getImageData(X, Y, TILE, TILE), d = img.data, lo = role === 'hazard' ? 0.58 : 0.44;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, f = lo + (1 - lo) * g;
    d[i] = Math.min(255, rc[0] * f) | 0; d[i + 1] = Math.min(255, rc[1] * f) | 0; d[i + 2] = Math.min(255, rc[2] * f) | 0;
  }
  c.putImageData(img, X, Y);
}

/** Tiles 0 and 1 are this map's air (see the note in the loop above: a platformer's numbering, declared, not generalised). */
const isAir = (t: number): boolean => t === 0 || t === 1;

/** The background outline: ONLY the outer perimeter — a block's edges that face the air —, not every block. */
function outlineSecondPlane(c: CanvasRenderingContext2D, hc: HighContrastCtx, th: number): void {
  if (th <= 0) return;
  const air = (x: number, y: number): boolean => isAir(hc.tileAt(x, y));
  c.fillStyle = 'rgba(200,222,255,0.97)';
  for (let y = 0; y < hc.H; y++) for (let x = 0; x < hc.W; x++) {
    if (air(x, y)) continue;
    const X = x * TILE, Y = y * TILE;
    if (air(x, y - 1)) c.fillRect(X, Y, TILE, th);
    if (air(x, y + 1)) c.fillRect(X, Y + TILE - th, TILE, th);
    if (air(x - 1, y)) c.fillRect(X, Y, th, TILE);
    if (air(x + 1, y)) c.fillRect(X + TILE - th, Y, th, TILE);
  }
}

/** The minimal PIXI.Texture surface directBgTexture/directSpriteTexture touch (resource.source may be a canvas OR an
 *  image — a parallax loaded from a PNG through PIXI.Texture.from(img)). Structural, so PIXI's Resource union types are
 *  not dragged in here. */
interface DirectTexSource {
  orig: { width: number; height: number };
  /**
   * The frame's CLIP inside the base — a character packed in an atlas is a clip, not a canvas of its own. Optional
   * because `directBgTexture` gets textures that really fill the whole base (parallax, tree) and does not need it.
   */
  frame?: { x: number; y: number; width: number; height: number };
  baseTexture: {
    valid: boolean;
    resource?: { source?: (HTMLCanvasElement | HTMLImageElement) | null } | null;
    once(event: 'loaded', cb: () => void): void;
  };
}

/** Background/decoration in high contrast: only desaturation/darkening (it steps back) — no repaint by role and no
 *  outline. Used by render/viewports for decoration (treeTexFor) and parallax (parallaxTexFor). */
export function directBgTexture(srcTex: DirectTexSource, mode: string): unknown {
  const cfg = dcfg(mode);
  const cv = makeCanvas(Math.max(1, srcTex.orig.width), Math.max(1, srcTex.orig.height)), dst = tex(cv);
  const paint = (): void => {
    const s = srcTex.baseTexture.resource && srcTex.baseTexture.resource.source;
    if (!s || !s.width) return;
    cv.width = s.width; cv.height = s.height;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height); c.drawImage(s, 0, 0); dimDesat(c, cv.width, cv.height, cfg.bgMul, 1.2);
    dst.update();
  };
  if (srcTex.baseTexture.valid) paint(); else srcTex.baseTexture.once('loaded', paint);
  return dst;
}

/** A foreground sprite (player/coin/power-up) in high contrast: it keeps the art's colour + a DARK outline (WCAG 2.4.7 —
 *  it "jumps" off the pushed-back background). `mode` is unused (kept only for signature parity with the other 3
 *  "direct*" functions — the dispatch by DIRECT_CFG[mode] already happened in the caller). fg=0 → no outline. */
export function directSpriteCanvas(srcCanvas: HTMLCanvasElement, mode: string): HTMLCanvasElement {
  void mode;
  const fg = requireCtx().outlineFg();
  return fg > 0 ? outlineCanvas(srcCanvas, fg) : srcCanvas;
}
/** The PIXI.Texture variant of directSpriteCanvas (player: the source texture is already a PIXI.Texture, not a raw
 *  canvas). `mode` likewise — unused, kept for signature parity. */
export function directSpriteTexture(srcTex: DirectTexSource, mode: string): unknown {
  void mode;
  const fg = requireCtx().outlineFg();
  if (fg <= 0) return srcTex;
  const th = fg;
  const cv = makeCanvas(Math.max(1, srcTex.orig.width), Math.max(1, srcTex.orig.height)), dst = tex(cv);
  const paint = (): void => {
    const s = srcTex.baseTexture.resource && srcTex.baseTexture.resource.source;
    if (!s || !s.width) return;
    // ===================== THE CLIP COMES BEFORE THE OUTLINE =====================
    // Reading the BASE and ignoring the `frame` draws, for a frame packed in an atlas, the whole atlas: every frame of the
    // character at once, in a grid — the "kage bunshin" defect. It happened once the character's sprites were packed
    // into an atlas, where only the frames that go through the seam fixer (idle/walk/run) become canvases of their own
    // and jump, ladder, wall, ceiling, swim and flight are CLIPS.
    //
    // The seam fixer is asynchronous, so the idle frame showed it too: with high contrast on early, the outlined-frame
    // cache memorises the atlas-based version and keeps it forever.
    const f = srcTex.frame;
    const needsClipping = !!f && (f.x !== 0 || f.y !== 0 || f.width !== s.width || f.height !== s.height);
    let drawSource: HTMLCanvasElement | HTMLImageElement = s;
    if (needsClipping && f) {
      const rec = makeCanvas(Math.max(1, f.width), Math.max(1, f.height));
      const rc = rec.getContext('2d')!;
      rc.imageSmoothingEnabled = false; // pixel art: resampling here would blur the outline the mode promises
      rc.drawImage(s, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
      drawSource = rec;
    }
    // outlineCanvas only declares HTMLCanvasElement; the clip already returns a canvas, and an unclipped base is
    // canvas-sourced on the paths that remain. The cast changes nothing at runtime.
    const o = outlineCanvas(drawSource as HTMLCanvasElement, th);
    cv.width = o.width; cv.height = o.height;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height); c.drawImage(o, 0, 0);
    dst.update();
  };
  if (srcTex.baseTexture.valid) paint(); else srcTex.baseTexture.once('loaded', paint);
  return dst;
}

/* ===================== lazy caches (world/sprites) + per-mode selector ===================== */
const _worldTexHC: Record<string, unknown> = {};
/** The recoloured-sprite cache, keyed by `id|mode` — one cache for every game, not one per game's coin. */
const _spriteTexHC: Record<string, unknown> = {};

/** The WORLD texture for `mode` (normal → the live texture; hc-* → Direct Rendering, cached). */
export function worldTexFor(mode: string): unknown {
  const hc = requireCtx();
  if (DIRECT_CFG[mode]) {
    if (!_worldTexHC[mode]) _worldTexHC[mode] = worldToTextureDirect(hc.getWorldCanvasNormal(), mode);
    return _worldTexHC[mode];
  }
  return hc.getWorldTexNormal();
}
/**
 * Sprite `id`'s texture for `mode` (the same logic as `worldTexFor`, cached by `id|mode`).
 *
 * Outside the direct rendering modes it returns the normal texture the game declared — and it returns `undefined` for
 * an id the game did not declare, instead of throwing: a missing sprite becomes "no texture" in the drawing, which is
 * degradation; throwing here would take the whole frame down because of one item.
 */
export function spriteTexFor(id: string, mode: string): unknown {
  const hc = requireCtx();
  const src = hc.sprites()[id];
  if (!src) return undefined;
  if (DIRECT_CFG[mode]) {
    const key = id + '|' + mode;
    if (!_spriteTexHC[key] && src.canvas) _spriteTexHC[key] = tex(directSpriteCanvas(src.canvas, mode));
    return _spriteTexHC[key] ?? src.tex;
  }
  return src.tex;
}
/** Invalidates the world cache (the theme/scenery changed → the normal world canvas is another canvas). */
export function clearWorldTexCache(): void { for (const k in _worldTexHC) delete _worldTexHC[k]; }
/**
 * Invalidates the sprite cache (a role colour changed → the host re-bakes). With no argument it clears EVERYTHING; with
 * an `id`, only that sprite's entries — what a game with many sprites will want, and what a cache keyed only by mode
 * could not offer.
 */
export function clearSpriteTexCache(id?: string): void {
  for (const k in _spriteTexHC) {
    if (id === undefined || k.startsWith(id + '|')) delete _spriteTexHC[k];
  }
}
