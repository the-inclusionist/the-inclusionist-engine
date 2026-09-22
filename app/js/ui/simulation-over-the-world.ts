// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/simulation-over-the-world — A SIMULATION RUNS IN THE GAME, NEVER IN A MENU (ADR-0187; ADR-0151 §2; issue #182).
//
// The Dev, 2026-09-13: «Simulação de deficiência não pode funcionar no menu! Só no jogo!» 📏 And the reason is measured,
// not stylistic: a CSS filter reaches every descendant and clearing it on a child does NOT undo it, so a simulated
// blindness put on an ancestor of a menu blacks out the panel where a child turns it off. That happened, in the quiz.
//
// TWO HALVES OF ONE SUBJECT, which is why they live together: the FILTER (what the eye of the simulated condition does
// to colour and light) and the LAYER (what three of them draw over the world — a tunnel, a central scotoma, scattered
// scotomas). Both answer «where does this go so that it covers the game and nothing else», and both have to know what
// the world is and where its menus are.
//
// WHY IT IS NOT IN THE COMPOSITION ROOT
// It was ~30 branches of `boot/create-game`, and none of them wiring: «descend into a box that holds a door», «a canvas
// has no children, so the layer goes to its parent», «what HELPS stays under what SIMULATES» are rules with reasons.
// ADR-0221's erratum measures a root's debt in BRANCHES.
//
// ⚠️ PROBED BEFORE IT MOVED, and five of eleven decisions were blind — three of them the whole canvas-world path, which
// no case in the tree drove. They have cases now (`tests/a-canvas-world-is-simulated-too.browser.test.js`).

import { drawLowVision } from '../render/low-vision-drawing.js';
import { VIZ_BY_KEY } from '../render/viz-modes.js';
import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import type { WorldScope } from '../core/contract.js';

/**
 * WHAT COUNTS AS A MENU, and therefore never gets a simulation on it or above it.
 *
 * 📌 `[data-incl-menu]` is the CARTRIDGE's own door (ADR-0187): the engine cannot tell which of a game's buttons opens
 * the pause card, and a simulation over that door is the one a child playing by touch cannot turn off.
 */
const ENGINE_MENUS = '.overlay, .screen-pause, .screen-a11y, #title-icons, .rodape-da-tela, .pausa-rapida, .touch, #viz-overlay, [data-incl-menu]';

/**
 * The three simulations that are DRAWN rather than filtered: a colour filter can only blur for them.
 *
 * 📌 By the `lv` of the mode and not by its key, because the key is what a panel stores and the `lv` is what the
 * drawing understands — the two have drifted apart before.
 */
const DRAWN: ReadonlySet<string> = new Set(['tunnel', 'macular', 'diabetic']);

export interface SimulationOverTheWorldCtx {
  /** What this cartridge declared as its world (`GameDeclaration.world`). */
  readonly world: () => WorldScope;
  /** The host's DOM query — this module never reaches a global. */
  readonly find: <T extends Element>(selector: string) => T | null;
  /** Makes the drawing layer. Injected for the same reason: no `document` in here. */
  readonly createCanvas: () => HTMLCanvasElement;
}

export interface SimulationOverTheWorld {
  /**
   * Puts `css` on the game and nowhere else, with `improvement` kept underneath it.
   *
   * ⚠️ `improvement` is what the child turned on to SEE — her colour correction, her contrast enhancement. It composes
   * under the simulation on a world that holds no menu; dropping it would take her own setting away for as long as an
   * adult is looking through her eyes.
   */
  onlyInPlay(css: string, improvement: string): void;
  /** Shows, moves and draws the layer for a DRAWN simulation — and hides it for anything else. */
  drawLayer(key: string | null): void;
}

export function createSimulationOverTheWorld(ctx: SimulationOverTheWorldCtx): SimulationOverTheWorld {
  /** The elements this module filtered last time, so the next call can clear exactly those and no others. */
  let filtered: HTMLElement[] = [];

  /** The declared world, when it is an element that is actually in the page. */
  const worldElement = (): HTMLElement | null => {
    const world = ctx.world();
    if (world.kind !== 'element') return null;
    return ctx.find<HTMLElement>(world.selector); // `null` is already a line of `problems`
  };

  const holdsNoMenu = (n: HTMLElement): boolean => typeof n.querySelector !== 'function' || !n.querySelector(ENGINE_MENUS);

  /** Down through the world, filtering what is ordinary and stepping over — and into — what is or holds a menu. */
  const parts = (parent: HTMLElement, css: string): void => {
    for (const child of Array.from(parent.children) as HTMLElement[]) {
      if (child.matches(ENGINE_MENUS)) continue;
      // 🔴 A BOX THAT HOLDS A DOOR IS WALKED INTO, not filtered: filtering it would reach the door inside, and clearing
      // the filter on the door does not undo it. This is the defect of ADR-0187, one level down.
      if (holdsNoMenu(child)) { child.style.filter = css; filtered.push(child); } else parts(child, css);
    }
  };

  return {
    onlyInPlay(css, improvement) {
      for (const n of filtered) n.style.filter = '';
      filtered = [];
      const el = worldElement();
      if (!css || !el) return;
      if (holdsNoMenu(el)) {
        el.style.filter = [improvement, css].filter(Boolean).join(' '); // the world itself, over what helps
        return; // recomposed from `improvement` on the next call, so it is not tracked here
      }
      parts(el, css);
    },

    drawLayer(key) {
      const lv = key ? VIZ_BY_KEY[key]?.lv : undefined;
      const existing = ctx.find<HTMLCanvasElement>('#viz-overlay');
      if (!lv || !DRAWN.has(lv)) { if (existing) existing.hidden = true; return; }
      const el = worldElement();
      if (!el) return;
      const host = hostFor(el);
      if (!host) return;
      const layer = existing ?? newLayer(ctx);
      if (layer.parentElement !== host) host.appendChild(layer);
      placeOver(layer, el);
      const c = layer.getContext('2d');
      if (!c) return;
      c.clearRect(0, 0, layer.width, layer.height);
      drawLowVision(c, lv, layer.width, layer.height);
      layer.hidden = false;
    },
  };
}

/**
 * WHERE THE LAYER LIVES. ⚠️ A canvas HAS NO CHILDREN, so its layer is a sibling — putting it inside means it never
 * appears at all, and nothing on screen says why.
 */
const hostFor = (el: HTMLElement): HTMLElement | null => (el.tagName === 'CANVAS' ? el.parentElement : el);

/** A fresh layer, at the world's logical size. */
function newLayer(ctx: SimulationOverTheWorldCtx): HTMLCanvasElement {
  const layer = ctx.createCanvas();
  layer.id = 'viz-overlay';
  layer.setAttribute('aria-hidden', 'true');
  // inline and not only in style.css: a page without the stylesheet must still let the clicks through to the game
  // z 4: over the game, under the quick bar (5), the pause card (6) and the panels (60) — a simulation is never over a menu
  Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '4' });
  layer.width = LOGICAL_W;
  layer.height = LOGICAL_H;
  return layer;
}

/**
 * Over the world and not over its host: a canvas world may sit anywhere inside its parent, and a layer that took the
 * parent's box would cover the wrong pixels — and, where the parent is bigger, the menus beside it.
 */
function placeOver(layer: HTMLCanvasElement, el: HTMLElement): void {
  if (el.tagName !== 'CANVAS') { Object.assign(layer.style, { width: '100%', height: '100%' }); return; }
  Object.assign(layer.style, { inset: 'auto', left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: `${el.offsetWidth}px`, height: `${el.offsetHeight}px` });
}
