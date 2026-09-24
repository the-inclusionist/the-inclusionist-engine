// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/drawing-problems — WHAT A CARTRIDGE DREW THAT THE CHILD PAYS FOR, named (ADR-0163 rule 4, ADR-0148 §3; issue #203).
//
// Two questions the engine asks about its own region, and both answer with the sentence a `problems` line needs: text and
// targets drawn UNDER the floor, and the nodes drawn OVER the accessibility bar. They are one subject — the engine measuring
// what somebody else drew — and they lived inside `boot/create-game`, which is why this module exists: 📏 that file reached
// 2185 lines and 330 decision nodes (ADR-0221), and the debt is paid by SUBJECT, never by slicing.
//
// ⚠️ THE READERS ARE FUNCTIONS AND NOT VALUES, and that is the whole care in this file. `#game-region`, the bar and the applied
// scale are all things the root REPLACES: a `mount()` swaps the cartridge and the bar is built after the root is. Taking them
// as values here would freeze the first answer and report, forever, about a region that is no longer on the page — silently,
// because a stale element still answers `getBoundingClientRect()`.

import { barIntruders, belowFloor, minimumTarget, type Box, type NodeMeasure, type Scale } from './layout.js';

/** The engine's OWN nodes inside the region — their sizes are held by their own gates — and what is not drawn for the eye. */
const ENGINE_NODES = '#title-icons, .screen-pause, .overlay, #touch-controls, .rodape-da-tela, .pausa-rapida, #incl-parou, .sr-only, .hud-faixa';
/** What a finger is meant to hit; anything else has no target floor to fail. */
const TOUCH_TARGET = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

export interface DrawingProblemsCtx {
  /** `#game-region`, read at EVERY call — see the note at the top of this file. */
  readonly region: () => HTMLElement | null;
  /** The accessibility bar, or `null` where the game declined it. Read at every call, for the same reason. */
  readonly bar: () => Element | null;
  /** The scale the engine forced, or `null` before the first layout has run. */
  readonly scale: () => Scale | null;
  /** `window.getComputedStyle`, absent in a host that has none — then a node is counted rather than guessed about. */
  readonly computedStyle?: (el: Element) => CSSStyleDeclaration;
}

/**
 * A node named the way a developer finds it: `tag#id.firstClass`.
 *
 * 📌 It is NOT exported, and the `exports-without-consumer` gate is what said so: exporting it would publish a name only this
 * file uses, and an export with no consumer is surface somebody has to maintain with nobody needing it (ADR-0170 §3).
 */
function nodeName(el: Element): string {
  return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')
    + (el.className ? `.${String(el.className).trim().split(/\s+/)[0]}` : '');
}

/**
 * ADR-0163 rule 4, second half: the text and the targets the CARTRIDGE draws under the floor, named — read when `problems` is.
 * `null` when there is nothing to say, which is what a clean page answers.
 */
export function drawnBelowTheFloor(ctx: DrawingProblemsCtx): string | null {
  const region = ctx.region();
  const scale = ctx.scale();
  if (!scale || !region || typeof region.querySelectorAll !== 'function' || !ctx.computedStyle) return null;
  const nodes: NodeMeasure[] = [...region.querySelectorAll<HTMLElement>('*')].map((el) => {
    const b = el.getBoundingClientRect();
    const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim() !== '');
    return {
      name: nodeName(el),
      daEngine: el.closest(ENGINE_NODES) !== null,
      fontPx: hasText && b.width > 0 && b.height > 0 ? parseFloat(ctx.computedStyle!(el).fontSize) : null,
      target: el.matches(TOUCH_TARGET) ? { w: b.width, h: b.height } : null,
    };
  });
  const { text: smallText, targets: smallTargets } = belowFloor(nodes, scale.k);
  if (!smallText.length && !smallTargets.length) return null;
  const k = minimumTarget(scale.k) / 22;
  const parts = [
    smallText.length ? `text under ${8 * k} px (${smallText.slice(0, 4).join(', ')})` : '',
    smallTargets.length ? `targets under ${22 * k} px (${smallTargets.slice(0, 4).join(', ')})` : '',
  ].filter(Boolean);
  return `the cartridge draws ${parts.join(' and ')} in #game-region: a child with low vision or unsteady hands cannot `
    + 'read or hit them — text and targets start at 16 and 44 px at 640×360 and grow with the scale (ADR-0163): size them '
    + 'from `--ui-fs` and `--alvo-min`';
}

/**
 * The nodes that PAINT over the accessibility bar's rectangle (ADR-0148 §3).
 *
 * 📏 ONLY WHAT PAINTS, and it was measured in `dist/quiz.html`: the quiz was accused at every boot because `#quiz-app` — a
 * transparent box the size of the region, whose top padding IS the bar's room — intersects the bar's rectangle and draws
 * nothing there. A node counts when it has text of its own, is a control or a medium, or paints a background.
 */
export function barIntruderProblems(ctx: DrawingProblemsCtx): string[] {
  const region = ctx.region();
  const bar = ctx.bar();
  if (!bar || !region || typeof bar.getBoundingClientRect !== 'function') return [];
  const boxOf = (el: Element): Box => {
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };
  const paints = (el: Element): boolean => {
    if ([...el.childNodes].some((c) => c.nodeType === 3 && (c.textContent ?? '').trim() !== '')) return true;
    if (/^(img|canvas|svg|video|input|button|select|textarea)$/i.test(el.tagName)) return true;
    if (!ctx.computedStyle) return true; // no way to tell: count it, as before
    const cs = ctx.computedStyle(el);
    return (cs.backgroundColor !== '' && cs.backgroundColor !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)')
      || (cs.backgroundImage !== '' && cs.backgroundImage !== 'none');
  };
  const nodes = [...region.querySelectorAll('*')].filter((el) => paints(el)).map((el) => ({
    name: nodeName(el),
    box: boxOf(el),
    // the engine's HUD bands are placed by the ENGINE: if one reaches the bar, that is the engine's defect and not the game's
    isBar: el === bar || bar.contains(el) || el.closest('.hud-faixa') !== null,
  }));
  return barIntruders(boxOf(bar), nodes);
}
