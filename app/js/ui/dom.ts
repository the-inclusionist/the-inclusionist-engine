// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/dom.ts — DOM selection shortcuts, used across the whole UI (menus/HUD/pause/quiz/options). PURE on import:
// it only defines functions (it does not touch the DOM → importable in node). $ = querySelector; $$ =
// querySelectorAll as an Array. Generic: $<HTMLInputElement>('#x') already types the result.
//
// IT IS NOT A LEAF, on purpose: it imports `core/i18n` so that `toggleLabel` (the text of a toggle button) lives
// beside `toggleBtn` (the class and `aria-pressed`). The property that matters — importable in node, no I/O on
// import — still holds; what it gave up is having zero dependencies, and what it gained is written on
// `toggleLabel`.
import { t } from '../core/i18n.js';
import { $ as consultar, $$ as consultarTodos } from '../core/dom-query.js';

// THE DEFAULT IS `HTMLElement`, NOT `Element`: `.hidden`, `.focus()` and `.value` do not exist on `Element`, and
// they are exactly what an application does with what it selects. `Element` is lib.dom's default because
// `querySelector` also serves SVG and MathML — no selector in this project picks one of those. Whoever needs a
// narrower type passes the parameter: `$<HTMLSelectElement>('#pad-design')`.
// The two global queries moved to `core/dom-query` (issue #167); the names stay here for whoever imports them from ui.
export const $ = consultar;
export const $$ = consultarTodos;

/**
 * Reflects an on/off state onto a toggle button: the visual class AND `aria-pressed`.
 * Lives here because the two must never drift apart — a button that looks pressed but does not
 * say so is invisible to a screen reader, which is a pillar violation, not a style slip.
 */
export function toggleBtn(b: Element | null, on: boolean): void {
  if (!b) return;
  b.classList.toggle('is-on', on);
  b.setAttribute('aria-pressed', String(on));
}

/**
 * The TEXT of a toggle button: 'On' / 'Off' in English.
 *
 * It lives here for the same reason as `toggleBtn` just above — the two are halves of one gesture, and must not
 * drift apart. A text copied into each panel is a text that translating the game has to find everywhere, and the
 * one copy it misses leaves a button in the wrong language — with no error and no red test.
 */
export function toggleLabel(on: boolean): string {
  return t(on ? 'ui.toggle.on' : 'ui.toggle.off');
}

/** The `aria-label` of the same toggle: '{alvo}: on' (`{alvo}` is the dictionary's interpolation key). Separate from
 *  the visible label because a screen reader needs the NAME of the target with it, and the screen does not (the
 *  name is already on the row beside the button). */
export function toggleAria(target: string, on: boolean): string {
  return t(on ? 'ui.toggle.ariaOn' : 'ui.toggle.ariaOff', { alvo: target });
}
