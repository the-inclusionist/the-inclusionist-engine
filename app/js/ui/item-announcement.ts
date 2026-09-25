// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/item-announcement — HOW A MENU ITEM ANNOUNCES ITSELF (ADR-0044, item 3; ADR-0167).
//
// XAG 106 describes the whole sentence — "Gamma, slider, 38%, 6 of 9" — and this module builds the part the game
// controls: LABEL, STATE and INDEX, in that order, with the index at the END.
//
// WHY THE INDEX GOES LAST. Whoever scans a menu by ear interrupts as soon as they recognise the item — which the
// interruptible narration allows. With the number first, the count would be the one part there is ALWAYS time to
// hear, and the label, the only part that matters, the one that never arrives.
//
// WHY IT CAN BE TURNED OFF. For someone who knows the menu by heart, the number is noise on every pass. XAG asks
// for the option explicitly, and the principle is the one the whole project follows: accessibility that cannot be
// turned off is an imposition, not a setting.
//
// THIS MODULE DOES NOT TOUCH THE DOM. The caller separates the parts (the button's label, the sub-label, the
// toggle's state) and gets a sentence back. That is what keeps the rule the SAME on every screen, without each
// one reinventing the punctuation.

import type { Translate } from '../core/i18n.js';

export interface ItemDeMenu {
  /** What the item is. Markup whitespace is normalised here. */
  label: string;
  /** The value or state: "on", "38%", the game's example word. Optional. */
  state?: string;
  /** Position in the list, counted from 1 — the number the child hears, not the array index. */
  position: number;
  /** How many items the list has. */
  total: number;
}

/** Markup whitespace (line breaks, indentation) becomes ONE space; the ends are trimmed. */
const tidy = (s: string | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

/**
 * The sentence the item narrates.
 *
 * An out-of-range position is NOT announced, and that is a decision, not a defensive guard: an item filtered out
 * by visibility leaves the list and can leave the index of the ones that remain out of range. "0 of 7" teaches a
 * false geography of the menu, and the child trusts it — a wrong number is worse than no number.
 */
export function announceItem(t: Translate, item: ItemDeMenu, withIndex: boolean): string {
  const indexApplies = withIndex && item.total >= 1 && item.position >= 1 && item.position <= item.total;
  const parts = [
    tidy(item.label),
    tidy(item.state),
    indexApplies ? t('sr.menu.index', { n: item.position, m: item.total }) : '',
  ];
  return parts.filter(Boolean).join(', ');
}
