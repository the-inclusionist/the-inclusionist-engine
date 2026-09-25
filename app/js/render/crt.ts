// SPDX-License-Identifier: AGPL-3.0-or-later
// render/crt.ts — the CRT look (visual sensitivity menu): scanlines/vignette/corners, CSS only (classes on the game
// region). `createCrt` builds one per root (ADR-0232 D4, issue #207): its `cfg` is the config {scan,vig,round} (0=off,1,2;
// scan/vig are on/off) read from the injected store at build, migrating the old boolean format. `scanVars` anchors the
// scanline to REAL PIXELS (recomputed from the region's real height + dpr → 1 line per art pixel, regular spacing).
// Everything it touches arrives by injection: the region, the window's pixel ratio, the player count, the two
// accessibility answers (does the scanline yield? does the vignette?) and the store.

import { screenGrid } from '../core/screens.js';
import type { Store } from '../platform/storage.js';
import { KEYS } from '../platform/storage-keys.js';

export type CrtCfg = { scan: number; vig: number; round: number };
// scanlines ON by default (the Dev's decision). Migrates incl_crt (boolean) → incl_crt2 (levels 0..2).
/** The factory CRT. Named because the menu's "restore defaults" (ADR-0028) needs the SAME value the boot load uses when
 *  nothing was saved — two copies would be two chances for the reset to return a CRT the game never showed. Frozen: a
 *  default someone can write at runtime is not a default. */
export const CRT_DEFAULT: Readonly<CrtCfg> = Object.freeze({ scan: 1, vig: 0, round: 1 });

/** Where the CRT is kept: the page's store, built by the root (ADR-0232, issue #207). */
type CrtStore = Pick<Store, 'get' | 'setJSON'>;

export interface CrtCtx {
  /** The element the classes go on (`#game-region`) — a GETTER, because a `mount()` may swap it; `null` = nothing to draw on. */
  region: () => HTMLElement | null;
  /** The window, for its pixel ratio only (the scanline period is one art pixel in REAL pixels). */
  win: Pick<Window, 'devicePixelRatio'>;
  /**
   * THE PLAYER COUNT, as the GETTER of the round the root owns: the screen grid sets how many art lines tall the region is.
   * A getter and not a number because players join and leave.
   */
  numPlayers: () => number;
  /**
   * Does the SCANLINE yield now? The ROOT answers, because the root is where the visual modes are known (ADR-0232): under
   * every visual accessibility mode but a colour-vision one on its own (ADR-0241). A correction or a simulation of colour
   * blindness changes hue; a stripe costs a low-vision child half the vertical resolution of a glyph (ADR-0047).
   *
   * A question for the whole screen and not for "player 1": the CRT is GLOBAL decoration, and if it contradicts any
   * child's accessibility, the decoration yields.
   */
  scanlineYields: () => boolean;
  /**
   * Does the VIGNETTE yield now? Under EVERY visual accessibility mode, the colour-vision ones included (ADR-0047,
   * kept by ADR-0241): darkened edges work against a mode that exists to raise contrast, whatever it does to hue.
   */
  vignetteYields: () => boolean;
  /** Where the CRT is read from at build and kept at every `apply()`. Required: a look read from nowhere resets each visit. */
  store: CrtStore;
}

/** One root's CRT. */
export interface Crt {
  /** The LIVE config, shared by reference with the motion panel: the stored CRT, or the factory one. */
  readonly cfg: CrtCfg;
  /** Applies the CRT CSS classes to the region and persists `cfg`. Called at boot and when the menu changes. */
  apply(): void;
  /** Re-anchors the scanline to real pixels — call it after every change of scale (a layout's `afterScale`). */
  scanVars(): void;
}

/**
 * The CRT a machine kept, from the two formats it may hold. The current one wins; the OLD one (all booleans) is migrated:
 * the vignette and the corners come across, and the scanlines come back ON once, because they became the default after
 * that format existed. Scanlines and vignette are on/off; only the corners have three levels.
 */
function crtFromStored(current: string | null, legacy: string | null): CrtCfg {
  const d: CrtCfg = { ...CRT_DEFAULT };
  const record = storedRecord(current, legacy);
  const migrating = !current;
  for (const k of Object.keys(d) as (keyof CrtCfg)[]) {
    if (record && k in record && !(migrating && k === 'scan')) d[k] = levelOf(k, record[k]);
  }
  d.scan = d.scan ? 1 : 0; d.vig = d.vig ? 1 : 0;
  return d;
}

/** The record a machine kept, the current format first — or `null` where there is none a CRT can be read from. */
function storedRecord(current: string | null, legacy: string | null): Record<string, unknown> | null {
  try {
    const s: unknown = JSON.parse(current || legacy || 'null');
    // a number or a string is not a record: reading keys in it would throw, and the answer is the factory CRT
    return s && typeof s === 'object' ? s as Record<string, unknown> : null;
  } catch { return null; } // a record that cannot be read is the factory CRT, never a broken boot
}

/** One stored value as a level: the old format's `true`/`false` mapped (round corners on are the ROUNDEST), the rest 0–2. */
function levelOf(k: keyof CrtCfg, v: unknown): number {
  if (v === true) return k === 'round' ? 2 : 1;
  if (v === false) return k === 'round' ? 1 : 0;
  return Math.max(0, Math.min(2, (v as number) | 0));
}

/**
 * Builds the CRT and READS the stored one into `cfg` — at build, never at import (ADR-0232). The config lives in this
 * closure, so a second root on the page keeps its own.
 */
export function createCrt(ctx: CrtCtx): Crt {
  const { store } = ctx;
  const cfg: CrtCfg = crtFromStored(store.get(KEYS.crt, null), store.get(KEYS.crtLegacy, null));

  // Anchors the scanline to REAL px: 1 line per ART pixel (an integer kDev) → ALWAYS regular spacing at any dpr.
  function scanVars(): void {
    const g = ctx.region(); if (!g || !cfg.scan) return;
    const { rows } = screenGrid(ctx.numPlayers()), dpr = ctx.win.devicePixelRatio || 1;
    const perDev = Math.max(2, Math.round((g.clientHeight || 360) * dpr / (180 * rows))); // kDev = REAL px per art line (INTEGER)
    g.style.setProperty('--scan-per', (perDev / dpr) + 'px'); // period = kDev real px (1 art line)
    g.style.setProperty('--scan-line', (Math.max(1, Math.round(dpr)) / dpr) + 'px'); // line = 1 REAL px
  }

  function apply(): void {
    const g = ctx.region(); if (!g) return;
    ['crt-scan-1', 'crt-vig-1', 'crt-round-0', 'crt-round-2'].forEach((c) => g.classList.remove(c));
    // EACH EFFECT YIELDS TO ITS OWN ANSWER (ADR-0047, ADR-0241): the vignette to every visual mode, the scanline to every
    // one but a colour-vision mode on its own. There is no escape switch for the child, by the Dev's decision (ADR-0047).
    //
    // The stored value is NOT changed: the preference stays and counts again by itself on leaving the accessibility
    // mode. Suppressing is not turning off — it is the distinction that keeps the child from losing what they chose every
    // time they turn high contrast on.
    if (cfg.scan && !ctx.scanlineYields()) { g.classList.add('crt-scan-' + cfg.scan); scanVars(); }
    if (cfg.vig && !ctx.vignetteYields()) g.classList.add('crt-vig-' + cfg.vig);
    if (cfg.round !== 1) g.classList.add('crt-round-' + cfg.round); // 1 = the default look (8px), no class
    store.setJSON(KEYS.crt, cfg);
  }

  return { cfg, apply, scanVars };
}
