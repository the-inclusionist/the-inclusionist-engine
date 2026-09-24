// SPDX-License-Identifier: AGPL-3.0-or-later
// Build environment types. __BUILD__ is injected by Vite (`define`) in vite.config.ts — the version stamp.
declare const __BUILD__: { version: string; sha: string; date: string; env: string };

/**
 * The VIRTUAL sprite-atlas module (item 22, X2), which the game's atlas build plugin generates.
 *
 * It exists only at build/dev time, so `tsc` needs the declaration not to report a missing module. ⚠️ Nothing under
 * `app/js` imports it today: the sprite renderer and the plugin left with the game (ADR-0036).
 */
declare module 'virtual:sprite-atlas' {
  /** Path of the packed PNG, relative to the served root. */
  export const ATLAS_URL: string;
  /** `anim/idx` → the frame's rectangle inside the atlas. */
  export const FRAMES: Record<string, { x: number; y: number; w: number; h: number }>;
}

/**
 * THE TEST HOOKS HUNG ON `window`, declared because a game's entry point creates and extends them.
 *
 * `__incl` is the object this project's VERIFICATION PROTOCOL uses: checking the boot is checking that
 * `typeof window.__incl === 'object'`, and reading `phase`, `players`, `canvas` from it. It is not an implementation
 * detail — it is a contract, which is why it is here and not in an `as any` where it is used.
 *
 * ⚠️ THE DECLARATION IS A FLOOR, NOT THE WHOLE CONTRACT, and that is said instead of disguised: the object has some
 * fifty members built in one literal, and the browser tests read them at run time, untyped. The `[k: string]` index is
 * what lets that literal be assigned; the three named ones are those added AFTER creation, and those the compiler
 * checks. `__incl` belongs to the game, which left this repository (ADR-0036); nothing under `app/js` creates it now.
 */
interface InclTestHooks {
  [k: string]: unknown;
  layout?: () => void;
  showTouch?: () => void;
  get_librasOpen?: () => boolean;
}

interface Window {
  /** The glyph map parser, exposed for the browser harness. ⚠️ The tile stack left with the game; nothing sets it now. */
  __tiles?: unknown;
  __incl?: InclTestHooks;
}

/**
 * VENDOR-PREFIXED FULLSCREEN, declared instead of cast because it is a REAL API: Safari — including the iPad's, the
 * machine of several schools — offers only `webkitRequestFullscreen`. A caller detects it
 * (`el.requestFullscreen || el.webkitRequestFullscreen`); what `lib.dom` lacked was the second name.
 *
 * Optional because Chrome and Firefox do not have it — and being optional is what keeps the detection mandatory. A
 * cast would have silenced the compiler and erased that duty. ⚠️ No module under `app/js` calls it today: the caller
 * was the game's `main.ts`, which left with the game (ADR-0036).
 */
interface HTMLElement {
  webkitRequestFullscreen?: () => void;
}
