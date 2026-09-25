// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/where-the-child-is — WHERE THE CHILD IS NOW, AND WHAT THAT PLACE SAYS (ADR-0159 rule 3; ADR-0221 step 7c).
//
// «Opening a menu or panel speaks its title; closing it speaks where the child is back to; entering play is announced.»
// 📏 Measured in the dist on 2026-09-12, before that rule was built: SELECT opened the card in silence, and a panel
// opened, closed and went back to the root without a word. A child who plays by ear was moved without being told.
//
// WHAT THIS ANSWERS, AND WHY IT IS ONE QUESTION
// Two things at once, and they belong together: a KEY, which is what «did she move?» is decided on, and the SENTENCE
// to say when she did. Splitting them would let a caller compare one and speak the other, which is the defect the key
// exists to prevent — an arrow inside a menu changes no `hidden`, so it must not read as a change of place.
//
// WHY IT IS NOT IN THE COMPOSITION ROOT
// It used to be, and it was the densest function in `boot/create-game` after the root's own body: 19 branches in 24
// lines. A root holds WIRING (ADR-0221's erratum: its debt is paid when the BRANCHES tend to zero), and «is this a
// panel, a list of the pause card, or play, and what is its name» is a rule with a reason, not a wire.
//
// ⚠️ THE DOM ARRIVES BY QUESTION AND NOT BY GLOBAL: the overlay on top, the open card and the focused element are
// asked of whoever owns the document. That is what lets a case drive it without a root, and what keeps the module out
// of the `globalReach` ratchet (ADR-0221 step 7d).

import { navigableItems } from './menu-items.js';
import { announceItem } from './item-announcement.js';
import { controlParts } from './menu-nav.js';
import { PM_VISIBLE_ITEMS, LIST_DOOR } from './pause-icons.js';
import { accessibleLabel } from '../core/accessible-label.js';
import type { Translate } from '../core/i18n.js';

export interface WhereTheChildIsCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** The overlay on top, if any — the same one the focus trap and the menu navigation treat as «the open menu». */
  readonly topVisibleOverlay: () => HTMLElement | null;
  /** The pause card, when it is showing. */
  readonly pauseCard: () => HTMLElement | null;
  /** Who has the focus right now: it decides WHICH item of a panel is named. */
  readonly focused: () => Element | null;
  /**
   * Does this cartridge want «N of M» spoken (ADR-0167)? It is only ever SPOKEN — never drawn — and a cartridge may
   * silence it.
   */
  readonly withIndex: () => boolean;
}

/** Where the child is: a key to compare, and the sentence to say when it changed. */
export interface Place {
  /** What «did she move?» is decided on. It names the panel or the card's open list, never just «a panel». */
  readonly key: string;
  /** What to say on arriving here — `null` in play, which is announced by the caller in its own words. */
  readonly sentence: string | null;
}

/** Title and item joined the way a screen reader reads them: the place first, then where the cursor is in it. */
const say = (title: string, item: string): string => [title, item].filter(Boolean).join('. ');

/** A PANEL: its title, and the item the focus is on — not the first, because the child may have walked into it. */
function panelPlace(panel: HTMLElement, ctx: WhereTheChildIsCtx): Place {
  const title = panel.querySelector('h2')?.textContent?.trim() ?? '';
  const items = navigableItems(panel.querySelector<HTMLElement>('.overlay__card') ?? panel);
  const focused = items.indexOf(ctx.focused() as HTMLElement);
  const n = focused >= 0 ? focused : 0;
  const item = items[n] ? announceItem(ctx.t, { ...controlParts(ctx.t, items[n]!), position: n + 1, total: items.length }, ctx.withIndex()) : '';
  // ⚠️ THE KEY NAMES WHICH PANEL. Two panels reading as the same place is a child moving from the sound panel to the
  // visual one in silence — and going from one panel straight to another is a real path: «map the keyboard» opens the
  // controls panel on top of the motor one.
  return { key: `painel:${panel.id}`, sentence: say(title, item) };
}

/** THE PAUSE CARD: which list of it is showing, named by the item that opens it, and the item under the cursor. */
function cardPlace(card: HTMLElement, ctx: WhereTheChildIsCtx): Place {
  const sub = card.querySelector<HTMLElement>('.pause-menu:not([hidden])')?.dataset.sub ?? 'raiz';
  // a submenu is named by the item that opens it; the root by the card's title
  const door = LIST_DOOR[sub as keyof typeof LIST_DOOR] ?? null;
  const button = door ? card.querySelector<HTMLElement>(`.pm-btn[data-act="${door}"]`) : null;
  const title = button ? accessibleLabel(button) : (card.querySelector('h2')?.textContent?.trim() ?? '');
  const items = [...card.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
  // 📌 THE MARKED ITEM AND NOT THE FIRST: coming back from a panel, the cursor is on the row that opened it. Naming
  // the first row would send a child who cannot see the mark looking where she is not.
  const marked = card.querySelector<HTMLElement>('.pm-sel') ?? items[0];
  const item = marked ? announceItem(ctx.t, { label: accessibleLabel(marked), position: items.indexOf(marked) + 1, total: items.length }, ctx.withIndex()) : '';
  // ⚠️ AND THE KEY CARRIES THE LIST: the root and a submenu are the same card with different rows, so a key that
  // stopped at the card's id would make entering the settings a non-event.
  return { key: `cartao:${card.id}:${sub}`, sentence: say(title, item) };
}

/**
 * The place, in the order the screen reads: a panel sits over the card, the card sits over the game.
 *
 * 📌 PLAY HAS NO SENTENCE HERE and that is deliberate: «back to the game» is the caller's word for its own world, and
 * this module has no business naming a game it does not know.
 */
export function whereTheChildIs(ctx: WhereTheChildIsCtx): Place {
  const panel = ctx.topVisibleOverlay();
  if (panel) return panelPlace(panel, ctx);
  const card = ctx.pauseCard();
  if (card) return cardPlace(card, ctx);
  return { key: 'jogo', sentence: null };
}
