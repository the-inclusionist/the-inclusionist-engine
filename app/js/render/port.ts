// SPDX-License-Identifier: AGPL-3.0-or-later
// render/port — THE RENDERER'S PORT (ADR-0035).
//
// ========================= WHAT THIS FILE SOLVES =========================
// ADR-0035 bet the reversibility of the renderer choice on an adapter: modules do not import PixiJS, they get what they
// will draw by injection. Without one declaration, each module described the shape of what it gets ON ITS OWN, and the
// descriptions drift — a graphics type was once written FIVE times with four different definitions (some with
// `clear(): void`, others with `clear(): Gfx`; one with `visible`, another with `lineStyle`/`moveTo`/`lineTo`).
//
// It is the same defect as `DomQuery` (sixteen copies) and `KeyScheme` (six), in the renderer: a truth written in many
// places drifts, and the drift shows at the composition root — the one point where the real PixiJS meets all of them at
// once.
//
// ========================= WHAT THE PORT IS NOT =========================
// It is NOT the `Scene`/`Handle` implementation the `demos` plan's D14 specifies — only the port, and only where the
// modules already are. This describes what the CURRENT renderer offers, in one declaration, in a way PixiJS satisfies
// with no adapter. The `Scene` comes later, and can reuse these names.
//
// ========================= WHY THE RETURNS CHAIN =========================
// `beginFill(…): this` and not `: void`. PixiJS chains (`g.beginFill(c).drawRect(…).endFill()`), and consumers depend on
// it. `this` instead of the type's name is what lets a derived interface keep chaining without redeclaring each method
// — the lack of it is what made the copies drift.

/** The MINIMUM of a vector drawing layer: clear, fill, rectangle. */
export interface Drawing {
  clear(): this;
  beginFill(color: number, alpha?: number): this;
  drawRect(x: number, y: number, w: number, h: number): this;
  endFill(): this;
}

/** A drawing that also strokes lines — rain, cables, lava dashes. */
export interface DrawingWithLine extends Drawing {
  lineStyle(width: number, color?: number, alpha?: number): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
}

/** What can be hidden. Separate from `Drawing` because not every layer is hidden by whoever draws it. */
export interface Visible {
  visible: boolean;
}

/** A scene-graph container, from the point of view of whoever only adds and removes children. */
export interface Layer {
  addChild(c: unknown): unknown;
  removeChild(c: unknown): unknown;
}

/** What has a swappable texture — the high-contrast recolour writes here. */
export interface WithTexture {
  texture: unknown;
}

/**
 * DRAW AN OBJECT INTO A TEXTURE — each player's screen capture in multi-screen.
 *
 * A FUNCTION and not a `{ render(...) }` object, and the difference is what makes the port work. An
 * `interface RendererLike { render(displayObject: unknown, options: { renderTexture: unknown }) }` is refused by the real
 * PixiJS: its `render` asks for an `IRenderableObject`, and `unknown` is not assignable to that. By contravariance,
 * whoever DECLARES the wider parameter is who does not fit.
 *
 * Asking for the CAPABILITY solves it: the module says what it wants to happen, and the composition root — the one place
 * where PixiJS is already known — hands in the function. It is the adapter ADR-0035 promised, and the promise only
 * becomes fact when the request has the shape of a verb, not of a borrowed object.
 *
 * ⚠️ `clearFirst` IS REQUIRED. Drawing into a render texture without saying whether it should be cleared first is the
 * difference between a frame and a SMEAR: without clearing, each frame piles on the previous one and the character shows
 * several times, in several places. One caller passes `false` on purpose (the extra low-vision pass, which composes ON
 * TOP); an optional parameter would let another leave the decision to a default nobody wrote.
 *
 * An implicit default here is expensive twice over: it changes with the renderer's version, and its symptom is visual —
 * no logic test sees it. A required parameter makes the compiler demand each caller's intent, once, and forever.
 */
export type RenderInto = (displayObject: unknown, target: unknown, clearFirst: boolean) => void;

/**
 * CREATE A SPRITE from a texture, and a TILE from one.
 *
 * Factories, not constructors — for the same reason as `RenderInto` above. An `interface SpriteCtor { new (tex:
 * unknown): Sprite }` does not fit the real `PIXI.Sprite`: its constructor accepts `Texture | undefined`, and a
 * parameter declared `unknown` is WIDER — by contravariance, whoever promises to accept anything cannot receive a
 * constructor that only accepts a texture.
 *
 * A function erases the problem: the caller passes the texture it already has, and the composer closes the difference
 * once. `T` is what the module expects back — each knows which slice of the sprite it will touch.
 */
export type CreateSprite<T> = (sourceTexture: unknown) => T;

/** Likewise for the parallax tile, which also gets a width and a height. */
export type CreateTile<T> = (sourceTexture: unknown, tileWidth: number, tileHeight: number) => T;

/** And the empty vector drawing (`new PIXI.Graphics()`), for the same reason. */
export type CreateDrawing<T> = () => T;

/**
 * WHAT GETS TINTED — a sprite from the point of view of whoever only WRITES its colour.
 *
 * `tint: unknown`, and `unknown` here is right, not lazy. `tint: number` does NOT fit the real `PIXI.Sprite`: its
 * `tint` is a `ColorSource`, which accepts a number, text (`'red'`), an array and more. `number` is a strict SUBTYPE of
 * that, and a module that does not own the field declaring something NARROWER than the truth is exactly what ADR-0039
 * forbids: narrowing is what breaks the assignment.
 *
 * The true supertype provable without importing PixiJS is `unknown`. The price is known and small: whoever writes here
 * is no longer checked by the compiler — nothing in the engine writes a tint today, and the hex constants a game writes
 * are all `ColorSource`s anyway.
 */
export interface Tintable {
  tint: unknown;
}

/** What gets disposed. PixiJS's `DisplayObject.destroy(options?)` satisfies it — the optional does not get in the way. */
export interface Disposable {
  destroy(): void;
}

/**
 * A layer that also EMPTIES, returning what came out to whoever needs to destroy the removed children.
 *
 * Separate from `Layer` because only one consumer empties, and because the return is the delicate part: asking for
 * `removeChildren(): CoinSprite[]` asks back for something more SPECIFIC than PixiJS delivers (`DisplayObject[]`) — and
 * a return is covariant, so the specific request is what does not fit. `Disposable` is what the caller actually uses.
 */
export interface ClearableLayer extends Layer {
  removeChildren(): Disposable[];
}

/** What has a GPU filter — the camera and each multi-screen output sprite. */
export interface WithFilter {
  filters: unknown;
}

/** A drawing that also draws a CIRCLE — each viewport's indicator dot. */
export interface DrawingWithCircle extends DrawingWithLine {
  drawCircle(x: number, y: number, r: number): this;
}

/**
 * APPLY A CSS FILTER TO THE GROUND — the screen's global filter, composing colour blindness, low vision, blindness and
 * the luminance/quantisation enhancement.
 *
 * Not `app: AppLike | null` with `AppLike { view?: { style: { filter: string } } }`: that reached THREE levels into an
 * object that is not the module's, and the real `PIXI.Application` did not fit — PixiJS's `ICanvas` `style` is an
 * `ICanvasStyle`, which does not even HAVE `filter` (it exists for `OffscreenCanvas`, where there is no CSS). In
 * production the `view` is a real `HTMLCanvasElement` and the field exists — but only the composition root knows that,
 * and that is where the conversion belongs.
 *
 * The same lesson as `RenderInto` and `CreateSprite`: asking for the VERB fits where borrowing the object does not.
 */
export type ApplyCssFilter = (css: string, reach: FilterReach) => void;

/**
 * WHERE the accessibility filter lands — and the distinction is one of PRODUCT, decided by the Dev.
 *
 * The frame is half canvas and half DOM, and a PIXI filter does not reach the DOM. With the filter landing ONLY on the
 * canvas, the menus stayed raw: the colour-blind child got the game corrected and the words not (issue #82). But the
 * correction is not the only mode, and not all of them should reach the menu:
 *
 *   · ENHANCEMENT (`normal`, `hc-direto*`, `fix-*`) — exists so the child SEES BETTER. It has to reach everything they
 *     read, menus included.
 *   · EMPATHY (`sim-*`, `lv-*`, `blind`) — exists so an adult FEELS what it is like. It stays in the world. The menu is
 *     the instrument for LEAVING the simulation, and a blindness that blanked the pause menu would lock the child
 *     inside it.
 *
 * The catalogue already knew this before the rule was written: `VIZ_MODES` carries `sim: true` exactly on the nine
 * empathy modes, and `simulatesDisability(key)` is the ready-made question. No new taxonomy. (The values stay
 * Portuguese: `mundo` is "world", `mundo-e-menus` "world and menus".)
 */
export type FilterReach = 'mundo' | 'mundo-e-menus';

/**
 * TURN HIGH CONTRAST ON/OFF IN THE DOM — the half the filter does not reach.
 *
 * High contrast is not a CSS filter: it is Direct Rendering, and it repaints the canvas's TEXTURES. The DOM has no
 * texture, so there is nothing to propagate — the equivalent has to be written, and it lives in `style.css` under
 * `#dom-layer.hc`. Here only WHETHER it is on is said; the drawing belongs to the CSS, with the measured reasons (issue
 * #83).
 */
export type ApplyHighContrastToDom = (isOn: boolean) => void;
