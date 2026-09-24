// SPDX-License-Identifier: AGPL-3.0-or-later
// render/screen-pipeline — HOW MANY SCREENS EXIST, WHERE THEY SIT, AND WHICH PIXI OBJECTS EACH ONE GETS.
//
// It runs whenever the number of players changes and when a round restarts, and it is the one function that changes the
// render TOPOLOGY: from "one camera drawn straight onto the stage" to "N render textures, one per player, each becoming a
// sprite placed on the grid" — and back.
//
// ======================= IT IS ENGINE, NOT ONE GAME'S =======================
// "N players on SEPARATE screens, no split-screen" is ADR-0010's pillar 7: it holds for every game, not one. A second
// game reuses this WHOLE — nothing here knows what a coin, a power-up, a gate or a secret area is. What the module knows
// is: a stage, a renderer, a camera, and `core/screens.ts`'s arithmetic. That is why it lives in `render/`, beside
// `render/viewports.ts`, and why everything else (the HUD, the accessibility filters, the dots) comes in by INJECTION,
// as a callback — whoever swaps the pipeline does not need to know what else the game wants to redo when it swaps.
//
// ======================= WHY A SIBLING FILE, AND NOT INSIDE render/viewports.ts =======================
// Both speak of "viewport", but they answer different questions, and the difference is exactly the boundary:
//   · `render/viewports.ts` is the IMAGE FACTORY — given an accessible vision MODE, how the pixel comes out
//     (colour-blindness matrix, cataract haze, high-contrast outline). It CONSUMES the viewport textures by getter and
//     never creates them. It is a question about COLOUR and FILTER.
//   · here is the TOPOLOGY — how many render textures exist, how big the canvas is, where each sprite sits, where the
//     frame is drawn, where the indicator dot is anchored. It is a question about GEOMETRY and LIFECYCLE (destroying the
//     previous set before building the new one).
// Merging them would give a module whose `ctx` had ~25 fields and whose name could only be "viewport stuff", which is a
// theme, not a responsibility — exactly the argument of `input/touch-bindings.ts`'s header. There is also a mechanical
// reason: `viewports.ts` READS the viewport textures (`getVpTex()`); this module REASSIGNS them. Keeping reader and writer
// in one file would erase the only clue that the array changes identity on every change in the number of screens. The
// real link between the two is narrow and explicit: `applyVpFilters()` and `updateVpDots()`, two reapply callbacks called
// at the end of the multi-screen path.
//
// ======================= THE PURE PART: PLANNING ≠ BUILDING =======================
// The grid arithmetic lives entirely in `planScreens(n)`, which returns, touching nothing: the canvas size, and for each
// screen its position, the frame's rectangle and the dot's anchor. `configureRender()` is the execution of a plan.
// `planScreens` carries the three rules nobody could see among the sprite constructions:
//   · the grid comes from `core/screens.ts` (`screenGrid`) — the SAME source as the layout, the HUD and the CRT (a local
//     copy once diverged: `cols = n<=2 ? n : 2`, without the `n<=1` guard);
//   · with 3 screens, the third is CENTRED on the bottom row — `x = (LOGICAL_W*cols - LOGICAL_W)/2`;
//   · the frame is drawn on the half pixel (`+0.5`) and 1px smaller on both sides, or the 1-logical-px line comes out
//     blurred or eaten by the canvas edge when the integer scale multiplies everything.
//
// ======================= WHAT STAYED OUT =======================
//  · `buildGameHud`, `applyVpFilters`, `updateVpDots` and `setMinimapVisible` are CALLBACKS. The HUD is overlaid DOM, the
//    filters are accessibility policy (render/viz-setters.ts) and a minimap is a game's own; this module only knows WHEN
//    they need to run again, not HOW.
//  · The host creates the `camera` and welds its z-order. From here the camera only moves between "the stage's child"
//    (one screen) and "an orphan, drawn by hand into the render textures" (several screens).
//  · The per-viewport render LOOP (whoever calls `renderer.render(camera,{renderTexture:vpTex[i]})` every frame) is the
//    host's drawing. Here the infrastructure is built; there it is used.
//
// ======================= BOOT-ORDER TRAPS =======================
//  · `applyVpFilters` and `updateVpDots` may be built after this init, so they enter the `ctx` as LAZY ARROWS
//    (`() => applyVpFilters()`): passing them by value would read them before they exist. That is safe because
//    `configureRender` is never called during boot — only when the player count changes or a round restarts.
//  · The viewport textures, sprites, frames and dots are the host's, REASSIGNED by this module and read by getter
//    elsewhere (`viewports`, `viz-setters`). That is why the `ctx` carries a getter+setter pair for each, instead of the
//    module owning the arrays: were it the owner, the host would have to swap the getters it already handed out, and the
//    rewiring would stop being local.
//  · NO I/O on import: no `document`, no canvas in the body. `planScreens` is pure arithmetic and runs in the `node`
//    project; everything touching PIXI only happens inside `configureRender()`.
//
// PIXI comes in through a STRUCTURAL INTERFACE, not `import * as PIXI` — the same precedent as render/viewports. The
// reason is stronger than usual here: this is the module that touches the most concrete engine types (`RenderTexture`,
// `Sprite`, `Graphics`, `SCALE_MODES`), and importing them would drag 445KB of PixiJS into Vitest's `node` project.

import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import { screenGrid } from '../core/screens.js';
import type { CreateSprite, CreateDrawing, WithFilter, DrawingWithCircle } from './port.js';

/* ===================== the PURE part: the grid plan ===================== */

/** A rectangle in logical pixels. */
export interface Rect { x: number; y: number; w: number; h: number }

/** Where a screen sits and what is drawn around it. */
export interface ViewportPlacement {
  /** The top-left corner of the screen's sprite, on the canvas. */
  x: number;
  y: number;
  /** The frame's rectangle (half a pixel in, 1px smaller on both sides — see the header). */
  frame: Rect;
  /** The anchor of the vision mode's indicator dot (the screen's top RIGHT corner, inwards). */
  dot: { x: number; y: number };
}

/** The complete render plan for `n` players. */
export interface ScreenPlan {
  /** `true` = the SINGLE-SCREEN path: the camera goes straight onto the stage, with no render texture. */
  single: boolean;
  cols: number;
  rows: number;
  /** The size the renderer is resized to. */
  canvas: { w: number; h: number };
  /** One entry per screen — EMPTY on the single-screen path, which has no viewport. */
  viewports: ViewportPlacement[];
}

/** The screen frame's colour (the same blue-grey as the canvas border on a single screen). */
export const FRAME_COLOR = 0xcdd6f2;
/** The frame's opacity. */
export const FRAME_ALPHA = 0.95;
/** The frame's thickness, in LOGICAL pixels (it scales with the canvas). */
export const FRAME_WIDTH = 1;
/** The indicator dot's inset from the screen's right edge. */
export const DOT_INSET_X = 9;
/** The indicator dot's inset from the screen's top. */
export const DOT_INSET_Y = 9;

/**
 * The render geometry for `n` players, touching nothing.
 *
 * `n <= 1` returns `single: true` and NO viewport: on a single screen the camera is the stage's child and PIXI draws
 * straight onto the canvas — there is no render texture, no frame and no dot (the single screen's vision-mode indicator
 * is another one, in the DOM).
 *
 * `w`/`h` are parameters defaulting to the canonical pixel (320×180, ADR-0010) — not for the game to change them, but so
 * the arithmetic can be checked with small numbers in the test.
 */
export function planScreens(n: number, w: number = LOGICAL_W, h: number = LOGICAL_H): ScreenPlan {
  const { cols, rows } = screenGrid(n); // the single source: core/screens.ts
  if (n <= 1) return { single: true, cols, rows, canvas: { w, h }, viewports: [] };

  const viewports: ViewportPlacement[] = [];
  for (let i = 0; i < n; i++) {
    let x = (i % cols) * w;
    const y = Math.floor(i / cols) * h;
    if (n === 3 && i === 2) x = (w * cols - w) / 2; // 3 screens: the 3rd centred on the bottom row
    viewports.push({
      x, y,
      frame: { x: x + 0.5, y: y + 0.5, w: w - 1, h: h - 1 },
      dot: { x: x + w - DOT_INSET_X, y: y + DOT_INSET_Y },
    });
  }
  return { single: false, cols, rows, canvas: { w: w * cols, h: h * rows }, viewports };
}

/* ===================== structural interfaces (PIXI without importing PIXI) ===================== */

/** What is touched of a `PIXI.BaseTexture`: only the scale mode (NEAREST = pixel art without blur). */
interface BaseTextureLike { scaleMode: number }
/** What is touched of a `PIXI.RenderTexture`: the baseTexture and disposal (`true` = destroys the base too). */
export interface RenderTextureLike { baseTexture: BaseTextureLike; destroy(destroyBase?: boolean): void }
/** `PIXI.RenderTexture` as a FACTORY — it is `RenderTexture.create({width,height})`, not a constructor. */
export interface RenderTextureFactory { create(opts: { width: number; height: number }): RenderTextureLike }
/** The minimum of a positionable, disposable scene object. */
export interface DisplayLike { x: number; y: number; visible: boolean; destroy(): void }
/** `PIXI.Sprite` — here it is only born from a render texture and positioned.
 *  `filters` is NOT touched here: whoever puts a per-screen GPU filter is `render/viz-setters`, and that is where these
 *  sprites go (`getVpSpr`). THE MINIMAL SLICE INVERTS again — in handing-over position, the slice that counts is the
 *  RECEIVER's, not the reader's. See `render/port`'s header. */
export type SpriteLike = DisplayLike & WithFilter;
/** `PIXI.Graphics` — the frame draws; the dots are only positioned (viz-setters paints them).
 *  And because they are painted THERE, the declaration includes the whole drawing: the dots leave through `getVpDots`
 *  and `viz-setters` calls `clear`/`beginFill`/`drawCircle` on them. */
export interface GraphicsLike extends DisplayLike, DrawingWithCircle {}
/** `PIXI.Container` in the role of a scene parent. */
export interface ContainerLike {
  addChild(child: unknown): unknown;
  addChildAt(child: unknown, index: number): unknown;
  removeChild(child: unknown): unknown;
}
/** The camera, seen from here: only its PARENTHOOD matters (the stage's child or an orphan). */
export interface CameraLike { parent: ContainerLike | null }
/** `app.renderer` — from here only the canvas is resized. */
export interface ResizableRenderer { resize(w: number, h: number): void }

export interface ScreenPipelineCtx {
  /* --- PIXI through a structural interface --- */
  RenderTexture: RenderTextureFactory;                    // PIXI.RenderTexture
  /** Factories, not constructors: `new (texture: unknown)` does not take the real `PIXI.Sprite`, whose constructor only
   *  accepts a `Texture`. See `CreateSprite` in `render/port`'s header. */
  createSprite: CreateSprite<SpriteLike>;
  createDrawing: CreateDrawing<GraphicsLike>;
  NEAREST: number;                                         // PIXI.SCALE_MODES.NEAREST

  /* --- the scene --- */
  stage: ContainerLike;        // app.stage
  renderer: ResizableRenderer; // app.renderer
  camera: CameraLike;          // the world container (the host's; only its parenthood changes)

  /* --- the host's live state --- */
  getNumPlayers: () => number;                       // reassigned when the player count changes
  getVpTex: () => RenderTextureLike[]; setVpTex: (a: RenderTextureLike[]) => void; // the host's: a getter+setter pair
  getVpSpr: () => SpriteLike[]; setVpSpr: (a: SpriteLike[]) => void;
  getVpFrames: () => GraphicsLike | null; setVpFrames: (g: GraphicsLike | null) => void;
  getVpDots: () => GraphicsLike[]; setVpDots: (a: GraphicsLike[]) => void;

  /* --- what must run again when the topology changes (callbacks, not knowledge) --- */
  setMinimapVisible: (on: boolean) => void; // a game's minimap — it only exists on a single screen
  buildGameHud: () => void;                 // one DOM HUD per screen
  applyVpFilters: () => void;               // render/viz-setters.ts — a LAZY ARROW (see the header)
  updateVpDots: () => void;                 // render/viz-setters.ts — likewise
}

export interface ScreenPipelineApi {
  /** Rebuilds the render pipeline for the CURRENT player count. Idempotent: it destroys the previous set. */
  configureRender(): void;
}

export function initScreenPipeline(ctx: ScreenPipelineCtx): ScreenPipelineApi {
  function configureRender(): void {
    // 1) dispose of the previous set — ALWAYS, including when going back to a single screen, or the previous
    //    configuration's render textures would stay on the GPU with nobody to draw them.
    ctx.getVpSpr().forEach((s) => s.destroy()); ctx.setVpSpr([]);
    ctx.getVpTex().forEach((t) => t.destroy(true)); ctx.setVpTex([]);
    const frames = ctx.getVpFrames();
    if (frames) { frames.destroy(); ctx.setVpFrames(null); }
    ctx.getVpDots().forEach((g) => g.destroy()); ctx.setVpDots([]);

    const plan = planScreens(ctx.getNumPlayers());

    // 2) single screen: the camera is the stage's child again (beneath everything) and PIXI draws straight onto the canvas.
    if (plan.single) {
      if (ctx.camera.parent !== ctx.stage) ctx.stage.addChildAt(ctx.camera, 0);
      ctx.setMinimapVisible(true);
      ctx.renderer.resize(plan.canvas.w, plan.canvas.h);
      ctx.buildGameHud();
      return;
    }

    // 3) several screens: the camera LEAVES the scene — it is drawn by hand, once per viewport, into each player's
    //    render texture (the loop itself is the host's drawing).
    if (ctx.camera.parent) ctx.camera.parent.removeChild(ctx.camera);
    ctx.setMinimapVisible(false); // a minimap is single-screen (it does not fit replicated in 4 screens of 320×180)
    ctx.renderer.resize(plan.canvas.w, plan.canvas.h);

    const vpTex: RenderTextureLike[] = [], vpSpr: SpriteLike[] = [];
    for (const vp of plan.viewports) {
      const rt = ctx.RenderTexture.create({ width: LOGICAL_W, height: LOGICAL_H });
      rt.baseTexture.scaleMode = ctx.NEAREST; // pixel art: enlarge without interpolating
      const s = ctx.createSprite(rt); s.x = vp.x; s.y = vp.y;
      ctx.stage.addChild(s); vpTex.push(rt); vpSpr.push(s);
    }
    ctx.setVpTex(vpTex); ctx.setVpSpr(vpSpr);

    // the frame: one line per screen, in a single Graphics (it separates and frames like the single screen's border)
    const vpFrames = ctx.createDrawing();
    for (const vp of plan.viewports) {
      vpFrames.lineStyle(FRAME_WIDTH, FRAME_COLOR, FRAME_ALPHA);
      vpFrames.drawRect(vp.frame.x, vp.frame.y, vp.frame.w, vp.frame.h);
    }
    ctx.stage.addChild(vpFrames); ctx.setVpFrames(vpFrames);

    // the vision mode's indicator dots: ABOVE everything and OUTSIDE the render texture, so outside the viewport's
    // filter — which is why they stay visible in blindness mode (see updateVpDots in viz-setters).
    ctx.setVpDots(plan.viewports.map((vp) => {
      const g = ctx.createDrawing();
      g.x = vp.dot.x; g.y = vp.dot.y; g.visible = false;
      ctx.stage.addChild(g);
      return g;
    }));

    ctx.buildGameHud(); ctx.applyVpFilters(); ctx.updateVpDots();
  }

  return { configureRender };
}
