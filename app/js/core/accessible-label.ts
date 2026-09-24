// SPDX-License-Identifier: AGPL-3.0-or-later
// core/accessible-label — WHAT A CONTROL IS CALLED, and one answer for whoever sees and whoever listens.
//
// ========================= THE DEFECT THIS CLOSES =========================
// MEASURED in the built game, with the cursor on the menu's number-of-players button:
//
//     the game narrated:        "◀ Number of players: 1 ▶, 1 of 4"
//     the screen reader said:   "Number of players: 1. Click on the left for fewer, on the right for more."
//
// Two different sentences for the SAME item at the same instant. A child using a screen reader AND the game's
// narration hears the item twice, two ways — and the game's version reads the `◀` and `▶` glyphs, the very noise
// item 4 of ADR-0044 took out of the pause legend. The rule already existed for the bar's icons (hovering or focusing
// says the SAME truth a screen reader would announce); here it becomes one function every menu calls.
//
// ========================= WHY A LEAF MODULE =========================
// Its consumers sit in different modules of `ui/`, and `ui/menu-nav` already reaches `ui/pause-icons` — putting the rule
// in one of them would close a cycle or make someone import from where it should not. The lesson of `core/ring`: a
// cycle in ESM does not blow up at once, it blows up at boot in the TDZ, once, in production.
//
// No dependencies, no I/O, no global `document`: it takes the element and returns text.

/** The minimal slice of `Element` this module reads. Structural, so a node test needs no real DOM. */
export interface LabelledElement {
  getAttribute(name: string): string | null;
  textContent: string | null;
}

/** Markup whitespace becomes ONE space; the ends go. */
const tidy = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

/**
 * The control's name: `aria-label` when there is one, the visible text when not.
 *
 * THE ORDER IS THE DECISION, and it is not arbitrary: `aria-label` is what the accessibility platform is ALREADY going
 * to announce. Narrating something else adds no information — it creates a second version of the same item, and whoever
 * hears both has no way to know which is true.
 *
 * The visible text comes in when no label is declared, which is most buttons: there the two sources agree by
 * construction.
 */
export function accessibleLabel(el: LabelledElement | null | undefined): string {
  if (!el) return '';
  return tidy(el.getAttribute('aria-label')) || tidy(el.textContent);
}
