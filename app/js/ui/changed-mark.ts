// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/changed-mark.ts — MARKS WHAT LEFT THE DEFAULT (ADR-0029). Leaf module: only DOM and i18n, no state dependency.
// Each panel knows what the default is, having read DEFAULTS (ADR-0028); only HOW to mark lives here.
//
// The problem it solves: ADR-0028's per-menu reset only serves whoever knows there is something to undo. Many menus,
// dozens of controls, and what the child changed looks exactly like what they did not. The menus were not badly
// labelled — they were UNSEARCHABLE.
//
// THREE CHANNELS, and none is decoration. ADR-0029 explains why; in short: a white frame alone does not serve whoever
// does not tell colours apart, disappears in high contrast (where `--ink-soft` IS ALREADY white) and does not exist for
// whoever cannot see. So:
//
//   1. COLOUR — `--changed` on the frame (CSS; it switches by itself in high contrast).
//   2. SHAPE  — an inner ring, a double frame. It survives greyscale and any palette, because it is a COUNT OF RINGS
//               and not a hue.
//   3. NAME   — the control's accessible name gets a suffix. It is the channel that does the most work for the least:
//               a blind child WALKS the menu and HEARS, in order, what left the default.
//
// Channel 3 has two paths because panels build the name in two ways, and an `aria-label` beats the button's content.
// Marking only one would leave half the controls mute — silently, which is the worst way for an accessibility mark to
// fail, because nothing on screen reveals the gap.
//
// The suffix NEVER touches `textContent`: the panels rewrite `textContent` whole on every reflect, so a suffix there
// would live at the mercy of the call order. The path without an `aria-label` CREATES one from the content, and
// unmarking simply removes it.
//
// And idempotence is STRUCTURAL, not case by case: every call first returns the control to its original state —
// removing any trace of ours, on both paths — and only then applies. A mark that only knew how to add would end up on
// everything, and a mark on everything is no mark.
import { t } from '../core/i18n.js';

export const CHANGED_CLASS = 'is-changed';
/** Keeps the ORIGINAL `aria-label` when it is the panel's, to give it back without guessing from text. */
const BASE_ATTR = 'markBase';
/** Marks that the `aria-label` was created by US: unmarking removes the whole attribute instead of restoring one. */
const OWNED_ATTR = 'markOwnsLabel';

/**
 * The node whose accessible NAME gets the suffix: the row's FIRST control in document order, or the row itself when it
 * has no control inside.
 *
 * "The first" is a decision, not chance. A mixer row has TWO controls: the volume and the on/off. The suffix goes on the
 * volume, which comes first in the markup, for two reasons: it is the control the child reaches first when tabbing, so
 * they hear the mark BEFORE deciding whether to stop on this row; and repeating the suffix on both would make the
 * screen reader say the same thing twice across one row, which is noise dressed as information.
 *
 * What this leaves fragile, and why a test holds it: reordering the markup moves the suffix to another control without
 * breaking anything visible.
 */
function namedNode(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>('button, select, input, [role="button"]') ?? el;
}

/** Returns the control to its original state, whether the label came from the panel or from us. The base of every call. */
function clearMark(node: HTMLElement): void {
  if (node.dataset[OWNED_ATTR] !== undefined) {
    node.removeAttribute('aria-label');
    delete node.dataset[OWNED_ATTR];
  } else if (node.dataset[BASE_ATTR] !== undefined) {
    node.setAttribute('aria-label', node.dataset[BASE_ATTR]);
    delete node.dataset[BASE_ATTR];
  }
}

/**
 * Marks (or unmarks) ONE control. Idempotent by construction: clears and only then applies. The panels call this from
 * inside the same `reflect*` that already redraws the control, so it runs many times in a row.
 */
export function markChanged(el: HTMLElement | null, changed: boolean): void {
  if (!el) return;
  el.classList.toggle(CHANGED_CLASS, changed);
  const node = namedNode(el);
  clearMark(node);
  if (!changed) return;

  const suffix = t('a11y.changed');
  const label = node.getAttribute('aria-label');
  if (label !== null) {
    node.dataset[BASE_ATTR] = label;               // the panel's label: keep it and give it back later
    node.setAttribute('aria-label', label + ', ' + suffix);
  } else {
    node.dataset[OWNED_ATTR] = '1';                // the label came from the content: create one and own it
    node.setAttribute('aria-label', (node.textContent ?? '').trim() + ', ' + suffix);
  }
}

/**
 * Raises the mark one level: the button that OPENS the menu stays marked while any option inside it is. Without this
 * the trail would start inside the menu, and finding the right menu would still cost opening every one.
 *
 * `changes` is a list of booleans and not of elements because the panel is the one that knows how to compare with the
 * default; this module must have no opinion on what the default is — there is one source, ADR-0028's DEFAULTS.
 */
export function markMenuChanged(opener: HTMLElement | null, changes: readonly boolean[]): void {
  markChanged(opener, changes.some(Boolean));
}
