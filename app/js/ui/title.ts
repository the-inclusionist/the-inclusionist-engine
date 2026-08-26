// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/title — title-screen submenu NAVIGATION (Estágio 4): extracted from game.js's showTitleMenu(). Shows one
// submenu (`tm-main`/`tm-alf`/`tm-mat`/`tm-tab`/`tm-fr`/`tm-cen`) and hides the rest, toggles the footer legend
// (only on `tm-main`) and the game-title block (only on `tm-main` — submenus show their own `.tm-title` instead),
// then focuses the first button of the now-visible submenu. DI via initTitle(ctx): only `$` (DOM selector,
// ui/dom.ts shape) is needed — the transition carries no message of its own (callers picked the srSay text
// per-transition in game.js; duplicating an announcement here would double-speak). Everything else that used to
// live under "menu inicial" in game.js — building the submenu markup (buildTitleMenus), the footer legend
// (updateTitleLegend), arrow-key focus traversal (navTitle/titleButtons) and the click/keydown wiring — belongs to
// other Estágio-4 slices and stays in game.js for now.

import type { DomQuery } from '../core/dom-query.js';
/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

export type TitleMenuId = 'tm-main' | 'tm-alf' | 'tm-mat' | 'tm-tab' | 'tm-fr' | 'tm-cen';

/**
 * The 6 submenus of the title screen, in the order game.js has always hidden/shown them.
 *
 * The ORDERED array is the source and the Set is derived from it, not the other way round. A Set carries no
 * order in its type, so ui/activities-menu - which has to scan the submenus in order to find the visible one -
 * had declared its own array of the same six ids, kept in step by discipline alone. One list now.
 */
export const TITLE_MENU_IDS_ORDERED: readonly TitleMenuId[] = [
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
  /** Shows `which` and hides the other 5 submenus; toggles legend/title-block; focuses the first button. */
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

/** Pure view-model for showTitleMenu(which). Verbatim port of the old function's branching. */
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

export function initTitle(ctx: TitleCtx): TitleApi {
  function show(which: TitleMenuId): void {
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
    const b = activeEl && activeEl.querySelector<HTMLElement>('button');
    if (b) b.focus();
  }
  return { show };
}
