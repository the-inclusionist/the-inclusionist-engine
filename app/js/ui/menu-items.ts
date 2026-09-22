// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-items — WHAT COUNTS AS A MENU ITEM: the stops of the cursor, whose position the spoken index says.
//
// The list of stops lives HERE, once, and everything that speaks a place or keeps focus by place reads it: a second
// copy of the selector is how «2 de 7» and the item the cursor is on drift apart. (Until ADR-0167 it also drew a
// visible number per stop; that left — the place is heard, after the name.)
//
// 📌 A LEAF, importing nothing: `ui/mount-panel` needs the stops and must not pull `ui/menu-nav`, which pulls the
// whole pause slice.

/** The controls that are a stop of the cursor. `[data-passos]` is ONE stop: its arrows are finger targets. */
export const ITEM_SELECTOR = 'button:not([disabled]), select:not([disabled]), input[type=range]:not([disabled]), [data-passos]';

/**
 * The stops of a card, in reading order — only the ones laid out.
 *
 * `offsetParent === null` = out of the layout flow (hidden, `display:none`, or inside a hidden tab). Without it the
 * cursor lands on an invisible control and the screen reader announces something nobody sees.
 */
export function navigableItems(card: ParentNode): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter((el) => el.offsetParent !== null);
}

// 🔴 `numerarItens` AND `ATRIBUTO_DO_NUMERO` LEFT (ADR-0167): no stop shows a number. The list above still gives the
// spoken index its position — «…, 2 de 7» after the name, from `ui/item-announcement.announceItem`.
