// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/dom.ts — the two halves of a toggle button: its state (`toggleBtn`) and its text (`toggleLabel`/`toggleAria`).
// PURE on import: it only defines functions, so it is importable in node.
//
// 📌 The global selectors `$`/`$$` that lived here left in ADR-0232 D4: every module queries the document it is
// GIVEN (the root builds its `$` over the host's), and a query over the page-wide `document` is the reach D4 removed.
import type { Translate } from '../core/i18n.js';

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
export function toggleLabel(t: Translate, on: boolean): string {
  return t(on ? 'ui.toggle.on' : 'ui.toggle.off');
}

/** The `aria-label` of the same toggle: '{alvo}: on' (`{alvo}` is the dictionary's interpolation key). Separate from
 *  the visible label because a screen reader needs the NAME of the target with it, and the screen does not (the
 *  name is already on the row beside the button). */
export function toggleAria(t: Translate, target: string, on: boolean): string {
  return t(on ? 'ui.toggle.ariaOn' : 'ui.toggle.ariaOff', { alvo: target });
}
