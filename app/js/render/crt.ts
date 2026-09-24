// SPDX-License-Identifier: AGPL-3.0-or-later
// render/crt.ts — the CRT look (visual sensitivity menu): scanlines/vignette/corners, CSS only (classes on
// #game-region). CRT = the config {scan,vig,round} (0=off,1,2; scan/vig are on/off) loaded from localStorage, migrating
// the old boolean format. crtScanVars anchors the scanline to REAL PIXELS (recomputed from #game-region's real height +
// dpr → 1 line per art pixel, regular spacing).
// Self-contained: depends on core/dom-query ($). The player count comes in through `initCrt` (see below).
import { $ } from '../core/dom-query.js';

import { screenGrid } from '../core/screens.js';
import * as store from '../platform/storage.js';

type CrtCfg = { scan: number; vig: number; round: number };
// scanlines ON by default (the Dev's decision). Migrates incl_crt (boolean) → incl_crt2 (levels 0..2).
/** The factory CRT. Named because the menu's "restore defaults" (ADR-0028) needs the SAME value the boot load uses when
 *  nothing was saved — two copies would be two chances for the reset to return a CRT the game never showed. Frozen: a
 *  default someone can write at runtime is not a default. */
export const CRT_DEFAULT: Readonly<CrtCfg> = Object.freeze({ scan: 1, vig: 0, round: 1 });

// THE PLAYER COUNT comes in by injection, not as a live binding to a module `let`: a module `let` is shared by any second
// game the same page loads (ADR-0038). What comes in here is the GETTER of the round the root owns; the `let` left
// keeps the function, not the number.
let _playerCount: () => number = () => 1;
/**
 * Is ANY player in a visual accessibility mode? (anything other than `normal`.)
 *
 * ADR-0020 decides that accessibility modes SUPPRESS the CRT and decorative effects — accessibility takes precedence
 * over aesthetics. Without it, `crt-vig-1` survived in `hc-direto`, `fix-deuter`, `lv-blur` and `blind` with the
 * vignette on: a vignette darkening the edges works against the mode that exists to RAISE contrast.
 *
 * `ANY` and not "player 1": the CRT is GLOBAL decoration, one for the whole screen. There is no darkening the edges of
 * half a screen. If the decoration and any child's accessibility contradict each other, the decoration yields — which
 * is literally what accessibility-over-aesthetics means.
 */
let _a11yVisualActive: () => boolean = () => false;
/** Wires the player count and the accessibility question. Called once by the root, before the 1st `applyCrt()`. */
export function initCrt(deps: { numPlayers: () => number; a11yVisualOn: () => boolean }): void {
  _playerCount = deps.numPlayers;
  _a11yVisualActive = deps.a11yVisualOn;
}

export const CRT: CrtCfg = crtFromStored(store.get(store.KEYS.crt, null), store.get(store.KEYS.crtLegacy, null));

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

// Anchors the scanline to REAL px: 1 line per ART pixel (an integer kDev) → ALWAYS regular spacing at any dpr.
export function crtScanVars(): void {
  const g = $<HTMLElement>('#game-region'); if (!g || !CRT.scan) return;
  const { rows } = screenGrid(_playerCount()), dpr = window.devicePixelRatio || 1;
  const perDev = Math.max(2, Math.round((g.clientHeight || 360) * dpr / (180 * rows))); // kDev = REAL px per art line (INTEGER)
  g.style.setProperty('--scan-per', (perDev / dpr) + 'px'); // period = kDev real px (1 art line)
  g.style.setProperty('--scan-line', (Math.max(1, Math.round(dpr)) / dpr) + 'px'); // line = 1 REAL px
}

// Applies the CRT CSS classes to #game-region and persists. Called at boot and when the menu changes.
export function applyCrt(): void {
  const g = $<HTMLElement>('#game-region'); if (!g) return;
  ['crt-scan-1', 'crt-vig-1', 'crt-round-0', 'crt-round-2'].forEach((c) => g.classList.remove(c));
  // BOTH EFFECTS YIELD TO ACCESSIBILITY, WITH NO EXCEPTION (ADR-0020 + ADR-0047).
  //
  // A version with a per-effect escape switch existed, at the Dev's request. They removed it after SEEING the result
  // on screen: «Ceder fez muito bem ao jogo nos modos de acessibilidade». It is noted because the switch's absence is a
  // decision, not an oversight — and because pillar 2 is back to having no exception at all.
  //
  // The stored value is NOT changed: the preference stays and counts again by itself on leaving the accessibility
  // mode. Suppressing is not turning off — it is the distinction that keeps the child from losing what they chose every
  // time they turn high contrast on.
  const a11y = _a11yVisualActive();
  if (CRT.scan && !a11y) { g.classList.add('crt-scan-' + CRT.scan); crtScanVars(); }
  if (CRT.vig && !a11y) g.classList.add('crt-vig-' + CRT.vig);
  if (CRT.round !== 1) g.classList.add('crt-round-' + CRT.round); // 1 = the default look (8px), no class
  store.setJSON(store.KEYS.crt, CRT);
}
