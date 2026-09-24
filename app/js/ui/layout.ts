// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/layout.ts — the game's SCALE. Locks #game-region to a whole multiple of REAL PIXELS of 320×180 (per player) and
// rescales the UI variables scoped to the canvas. Deps: ui/dom ($), core/screens, render/crt (crtScanVars). The player
// count comes in through `initLayout`.
//
// IT RESERVES NO SPACE FOR THE INTERPRETER: the Dev decided the interpreter appears IN FRONT of the screen while audio
// plays, and disappears (see ui/vlibras), so the layout does not shift the game for it.
import { $ } from './dom.js';
import { screenBaseSize } from '../core/screens.js';

import { crtScanVars } from '../render/crt.js';

/**
 * THE TOUCH TARGET FLOOR, in CSS px, for a CSS scale factor `k` (ADR-0163).
 *
 * 🔴 IT WAS A RULER BY VIEWPORT HEIGHT (ADR-0095: 24 px under 540, 34 under 720, 44 above), because a 640×360 pause
 * card with 44 px items scrolled. ADR-0163 made the resolution the engine's — never under 640×360 — and the Dev set the
 * target — «44px é o correto, eu errei quando disse 42px» — so the floor is 44 px at the minimum (k = 2) and
 * grows with the scale, like the text; there is no smaller screen left to shrink for.
 */
export function minimumTarget(k: number): number {
  return 22 * (Number.isFinite(k) && k > 2 ? k : 2);
}

/** One node inside the region, as measured by whoever calls: its computed font size if it holds text, its box if it is a target. */
export interface NodeMeasure {
  readonly name: string;
  readonly daEngine: boolean;
  readonly fontPx: number | null;
  readonly target: { readonly w: number; readonly h: number } | null;
}

/**
 * WHAT A CARTRIDGE DRAWS UNDER THE FLOOR (ADR-0163 rule 4): text under 8·k px (16 at 640×360) and targets whose SMALLER
 * side is under 22·k px (44 at 640×360). The engine's own nodes are not the cartridge's to answer for, and a node with no
 * area is not drawn. Half a pixel of slack absorbs subpixel layout.
 */
export function belowFloor(nodes: readonly NodeMeasure[], k: number): { text: string[]; targets: string[] } {
  const ratio = minimumTarget(k) / 22;
  const smallText: string[] = [];
  const smallTargets: string[] = [];
  for (const n of nodes) {
    if (n.daEngine) continue;
    if (n.fontPx !== null && n.fontPx > 0 && n.fontPx < 8 * ratio - 0.5) smallText.push(n.name);
    if (n.target && n.target.w > 0 && n.target.h > 0 && Math.min(n.target.w, n.target.h) < minimumTarget(k) - 0.5) smallTargets.push(n.name);
  }
  return { text: smallText, targets: smallTargets };
}

/**
 * THE GAME'S NODES THAT INVADE THE ACCESSIBILITY BAR'S RECTANGLE (ADR-0148 §3).
 *
 * 🔴 The bar is `position:absolute` INSIDE `#game-region`, so a game can draw right over it — a question title on top
 * of the buttons, and the child looking for blind mode finds text over them.
 *
 * ⚠️ AND NOTHING FAILS. No error, no type, no console: just a row of covered buttons — and whoever depends on it most is
 * precisely whoever cannot see it is covered.
 *
 * 📌 PURE AND WITH THE BOXES INJECTED, so the gate can drive it with no browser. Whoever calls measures; what this
 * function decides is what COUNTS as an invasion, which is the part people get wrong.
 *
 * ⚠️ IT IGNORES THE BAR'S OWN DESCENDANTS: its buttons intersect it by definition, and counting them would make the gate
 * accuse always — the defect ADR-0106 §2 calls drowning what can be fixed.
 */
export interface NamedBox { readonly name: string; readonly box: Box; readonly isBar: boolean; }
export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

export function barIntruders(barBox: Box | null, nodes: readonly NamedBox[]): string[] {
  // A bar with no area reserves nothing — and accusing against a zero rectangle would accuse everyone.
  if (!barBox || barBox.w <= 0 || barBox.h <= 0) return [];
  // ⚠️ THE ZERO-AREA GUARD DOES WORK: the strict inequalities exclude a node that is DEGENERATE AT THE BOUNDARY, not one
  // in general — a zero-width stripe crossing the bar passes all four comparisons. 📌 Containers of zero height or width
  // are common in generated markup, and accusing them would be pure noise — which is how a consumer learns to ignore
  // the line.
  return nodes
    .filter((n) => !n.isBar && n.box.w > 0 && n.box.h > 0)
    .filter((n) => n.box.x < barBox.x + barBox.w && barBox.x < n.box.x + n.box.w
      && n.box.y < barBox.y + barBox.h && barBox.y < n.box.y + n.box.h)
    .map((n) => n.name);
}


// THE PLAYER COUNT COMES IN BY INJECTION. A module `let` imported as a live binding would be shared by any second game
// the same page loads (ADR-0038). What comes in is the GETTER of the round the root owns; the remaining `let` holds the
// function, not the number.
let _countPlayers: () => number = () => 1;
/** Wires the player count. Meant to be called once by the root, before the first `layout()`. */
export function initLayout(deps: { numPlayers: () => number }): void { _countPlayers = deps.numPlayers; }

/**
 * THE SHELL THAT GIVES THE AVAILABLE SPACE — by id OR by class, and both forms count the same.
 *
 * ⚠️ BY ID ONLY, a host with `<div class="stage-wrap">` (the quiz) got no scale at all: `layout()` returned early and
 * nothing reported anything — a silent `return` is indistinguishable from "there was nothing to do".
 *
 * The consumer is not wrong to use the class: a document can have several screens, and an id is unique. Accepting both
 * is what makes the engine consumable by whoever did not copy its markup.
 */
function findStageWrap(): HTMLElement | null {
  return $<HTMLElement>('#stage-wrap') ?? $<HTMLElement>('.stage-wrap');
}

/**
 * The scale ADR-0001 gives a stage: the factor in REAL pixels (whole, except at the floor — ADR-0179), the CSS factor, and
 * the region's CSS size.
 */
export interface Scale { readonly kDev: number; readonly k: number; readonly width: number; readonly height: number }

/**
 * ADR-0001 AS A PURE FUNCTION — so the engine can apply it to every cartridge (ADR-0163) and a test can pin it.
 *
 * Integer multiple of 320×180 (per the screen grid) in REAL pixels; up to 5 logical px of crop per side when that buys one
 * more step (the `−10`: `base·kDev − avail·dpr ≤ 10·kDev`). Never under 2 CSS px per logical pixel — 640×360 CSS, text 16 px,
 * targets 44 px: where the whole multiple gives less (a fractional display scale on the minimum window) the scale is exactly
 * 2 CSS px, whole in real pixels or not, because WCAG 2.2 AA decides (ADR-0179).
 */
export function stageScale(availW: number, availH: number, dpr: number, baseW: number, baseH: number): Scale {
  const MIN_K = 2;
  const integerK = Math.floor(Math.min(availW * dpr / (baseW - 10), availH * dpr / (baseH - 10)));
  const kDev = integerK / dpr >= MIN_K ? integerK : MIN_K * dpr;
  const k = kDev / dpr;
  return { kDev, k, width: baseW * k, height: baseH * k };
}

/**
 * Writes a scale onto the game region: its size, and the UI variables that grow with it.
 *
 * ⚠️ HOST-INJECTED (the region is passed in): `createGame` serves documents that
 * are not the global one — the fault the root's finding 15 names about reaching `document` from under the injection.
 */
export function applyScale(region: HTMLElement, e: Scale): void {
  region.style.width = e.width + 'px'; region.style.height = e.height + 'px';
  region.style.setProperty('--hud-fs', Math.max(9, Math.round(180 * e.k * 0.052)) + 'px');
  region.style.setProperty('--ui-fs', (8 * e.k) + 'px');   // LOGICAL base 8px × k (16px at k=2)
  // One ruler (plan phase 5b): `--tap` is the name three sibling games read, `--alvo-min` the engine's (ADR-0163); both come
  // from `minimumTarget`, so a display scale that gives k under 2 (Windows 110%) no longer drops `--tap` under 44 px.
  region.style.setProperty('--tap', minimumTarget(e.k) + 'px');
  region.style.setProperty('--alvo-min', minimumTarget(e.k) + 'px'); // 44 px at 640×360, growing with k (ADR-0163)
}

export function layout(): void {
  const wrap = findStageWrap(); if (!wrap) return;
  wrap.style.paddingRight = '0px';
  const availW = wrap.clientWidth || 320;
  const availH = wrap.clientHeight || 180;
  // The screen grid sets the base (1=320×180, 2=640×180, 3-4=640×360).
  const n = _countPlayers();
  const { w: baseW, h: baseH } = screenBaseSize(n);
  // Floor k=2: EACH viewport is at least 640×360, so 2×2 = 1280×720 fits a government Chromebook (1366×768).
  // ADR-0001: SCALE locked to WHOLE REAL PIXELS. Each art pixel = kDev PHYSICAL pixels (whole) → scanlines ALWAYS regular
  // and uniform art at ANY dpr. Tolerates ≤5 logical px of crop per side (the −10): base·kDev − avail·dpr ≤ 10·kDev ⇒
  // kDev ≤ avail·dpr/(base−10). (The Dev chose whole REAL pixels.) The arithmetic lives in `stageScale` (ADR-0163), so the
  // engine applies it to every cartridge.
  const dpr = window.devicePixelRatio || 1;
  const ratio = stageScale(availW, availH, dpr, baseW, baseH);
  const { kDev, k } = ratio;
  // The UI variables' SCALE is SCOPED to #game-region: only the UI INSIDE the canvas (menus/HUD/pause/quiz) scales with
  // k. Outside the canvas (top bar, debug panel) it inherits :root → text ALWAYS 16px, touch 44px (the Dev).
  const gr = $<HTMLElement>('#game-region'); if (gr) {
    // `--tap` is the PREFERRED size (22·k) and `--alvo-min` the FLOOR (22·k, 44 px at 640×360 — ADR-0163), written in `applyScale`.
    applyScale(gr, ratio);
  }
  crtScanVars(); // scanlines realign when the scale k changes
  if (/[?&]debug=true/.test(location.search)) console.info(`[escala] kDev=${kDev}× px REAIS (canvas físico ${baseW * kDev}×${baseH * kDev} = múltiplo INTEIRO de ${baseW}×${baseH}); CSS ${Math.round(baseW * k)}×${Math.round(baseH * k)} (k=${k.toFixed(3)}, dpr=${dpr})`);
}
