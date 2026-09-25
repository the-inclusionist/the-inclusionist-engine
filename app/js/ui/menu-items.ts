// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-items — WHAT COUNTS AS A MENU ITEM: the stops of the cursor, whose position the spoken index says.
//
// The list of stops lives HERE, once, and everything that speaks a place or keeps focus by place reads it: a second
// copy of the selector is how «2 de 7» and the item the cursor is on drift apart. (Until ADR-0167 it also drew a
// visible number per stop; that left — the place is heard, after the name.)
//
// And how a stop is kept in view inside the card that scrolls it (`keepInView`), which every mover of a cursor shares.
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

/**
 * KEEPS A MENU ITEM WHOLLY IN VIEW inside the box that scrolls it — the card, never the page (the Dev: the page itself
 * does not scroll). A cursor that walks off the visible part of a list is a cursor the child has lost: this is what makes
 * a list longer than the screen usable, whatever moved the cursor (issue #134, the Dev's «os menus não rolam»).
 *
 * The box's `scroll-padding` is honoured, so the band of explanation at the bottom of the screen, which the card runs
 * under, never covers the item. Nothing moves when the item is already in view. A document with no layout (a node
 * double) is left alone.
 */
export function keepInView(item: HTMLElement): void {
  const view = item.ownerDocument?.defaultView;
  if (!view || typeof item.getBoundingClientRect !== 'function') return;
  let box = item.parentElement;
  while (box && !(/(auto|scroll)/.test(view.getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
  if (!box || box === item.ownerDocument.documentElement || box === item.ownerDocument.body) return;
  const style = view.getComputedStyle(box);
  const top = box.getBoundingClientRect().top + box.clientTop + (parseFloat(style.scrollPaddingTop) || 0);
  const bottom = box.getBoundingClientRect().top + box.clientTop + box.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0);
  const r = item.getBoundingClientRect();
  if (r.top < top) box.scrollTop -= top - r.top;
  else if (r.bottom > bottom) box.scrollTop += Math.min(r.bottom - bottom, r.top - top); // a tall item shows its top
}