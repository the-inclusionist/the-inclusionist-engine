// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/title — title-screen submenu NAVIGATION. Shows one submenu (`tm-main`/`tm-alf`/`tm-mat`/`tm-tab`/`tm-fr`/`tm-cen`)
// and hides the rest, toggles the footer legend (only on `tm-main`) and the game-title block (only on `tm-main` —
// submenus show their own `.tm-title` instead), then focuses the first button of the now-visible submenu — or, coming
// back to a menu left on the way in, the item that opened the next one (ADR-0130 rule 1). DI via
// initTitle(ctx): only `$` (DOM selector, ui/dom.ts shape) is needed — the transition carries no message of its own
// (the caller picks what to announce per transition; announcing here too would double-speak). Building the submenu
// markup, the footer legend, arrow-key traversal and the click/keydown wiring belong to the game that owns the title
// screen, not to this module.

import type { DomQuery } from '../core/dom-query.js';

export type TitleMenuId = 'tm-main' | 'tm-alf' | 'tm-mat' | 'tm-tab' | 'tm-fr' | 'tm-cen';

/**
 * The 6 submenus of the title screen, in the order they are hidden/shown.
 *
 * The ORDERED array is the source and the Set is derived from it, not the other way round. A Set carries no
 * order in its type, so a reader that has to scan the submenus in order to find the visible one would otherwise
 * declare its own array of the same six ids, kept in step by discipline alone. One list.
 */
const TITLE_MENU_IDS_ORDERED: readonly TitleMenuId[] = [
  'tm-main', 'tm-alf', 'tm-mat', 'tm-tab', 'tm-fr', 'tm-cen',
];
export const TITLE_MENU_IDS: ReadonlySet<TitleMenuId> = new Set(TITLE_MENU_IDS_ORDERED);

export function isTitleMenuId(v: string): v is TitleMenuId {
  return TITLE_MENU_IDS.has(v as TitleMenuId);
}

export interface TitleCtx {
  /** DOM selector (querySelector), injected — this module never reaches `document` globally. */
  $: DomQuery;
}

export interface TitleApi {
  /** Shows `which` and hides the other 5 submenus; toggles legend/title-block. Focus: going IN, the first button; coming
   *  BACK to a menu left on the way in, the item that opened the next one (ADR-0130 rule 1). */
  show: (which: TitleMenuId) => void;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node) — a tiny "goto" state machine: any TitleMenuId can
// transition to any other in one step (no history-dependent transitions), so the whole view is a
// pure projection of the target id.
// ---------------------------------------------------------------------------------------------

export interface TitleMenuView {
  /** The submenu that becomes visible. */
  active: TitleMenuId;
  /** hidden.get(id) === true means that submenu's `hidden` attribute should be set. */
  hidden: ReadonlyMap<TitleMenuId, boolean>;
  /** #title-legend is hidden everywhere except tm-main (submenus show their own description footer instead). */
  legendHidden: boolean;
  /** .title-block (the game's title art) shows only on tm-main; submenus render their own `.tm-title` heading. */
  titleBlockDisplay: '' | 'none';
}

/** Pure view-model for show(which). */
export function computeTitleMenuView(which: TitleMenuId): TitleMenuView {
  const hidden = new Map<TitleMenuId, boolean>();
  for (const id of TITLE_MENU_IDS) hidden.set(id, id !== which);
  return {
    active: which,
    hidden,
    legendHidden: which !== 'tm-main',
    titleBlockDisplay: which === 'tm-main' ? '' : 'none',
  };
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

/**
 * One step of the way in: the menu that was left, and the item that opened the next one. Kept so «back» can put the cursor
 * on that item (ADR-0130 rule 1); `null` when the menu was left without focus inside it, and back then lands on item 1.
 */
interface TrailStep {
  readonly menu: TitleMenuId;
  readonly opener: HTMLElement | null;
}

export function initTitle(ctx: TitleCtx): TitleApi {
  /*
   * THE WAY IN, so the way out lands where the child was (ADR-0130 rule 1). `show` stays a «goto» — a game calls
   * `show('tm-main')` for its «Voltar» and nothing else — and the trail tells the two apart: a menu already on the trail is
   * a way BACK, which pops to it and returns the cursor to the item that opened the next menu; any other is a way IN,
   * which records the item that opened it. The menus stay one at a time on screen: whether the cards behind stay visible
   * is left open by the record.
   */
  const trail: TrailStep[] = [];

  /** The menu on screen now, and the item inside it that has focus — the opener, if the next `show` goes in. */
  function where(): TrailStep | null {
    for (const id of TITLE_MENU_IDS_ORDERED) {
      const el = ctx.$<HTMLElement>('#' + id);
      if (!el || el.hidden) continue;
      const focused = el.ownerDocument.activeElement as HTMLElement | null;
      return { menu: id, opener: focused && focused !== el && el.contains(focused) ? focused : null };
    }
    return null;
  }

  /** Where the cursor lands: the recorded opener when coming back to a menu on the trail, else `null` (item 1). */
  function walk(which: TitleMenuId): HTMLElement | null {
    const back = trail.findIndex((step) => step.menu === which);
    if (back >= 0) {
      const { opener } = trail[back]!;
      trail.length = back;
      return opener;
    }
    const here = where();
    if (here && here.menu !== which) trail.push(here);
    return null;
  }

  function show(which: TitleMenuId): void {
    const opener = walk(which);
    const view = computeTitleMenuView(which);
    for (const [id, hide] of view.hidden) {
      const el = ctx.$<HTMLElement>('#' + id);
      if (el) el.hidden = hide;
    }
    const lg = ctx.$<HTMLElement>('#title-legend');
    if (lg) lg.hidden = view.legendHidden;
    const tb = ctx.$<HTMLElement>('#title-overlay .title-block');
    if (tb) tb.style.display = view.titleBlockDisplay;
    const activeEl = ctx.$<HTMLElement>('#' + which);
    // the opener only while it is still an item of this menu: a game may have rebuilt the menu since
    const cameFrom = opener && activeEl?.contains(opener) ? opener : null;
    const b = cameFrom ?? (activeEl && activeEl.querySelector<HTMLElement>('button'));
    if (b) b.focus();
  }
  return { show };
}
