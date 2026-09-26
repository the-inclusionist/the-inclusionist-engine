// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-nav.ts — UNIVERSAL menu and dialog navigation: move, choose and go back without a mouse.
//
// Operation by keyboard (WCAG 2.1.1) and focus order (2.4.3). Any open menu — the pause card or a settings panel —
// answers the SAME six intents, whether they come from the keyboard, a controller, the eyes or speech:
//   · up/down/left/right — move between items; on a list, a slider or a steps control, left/right ADJUST the value
//   · yes — confirm, toggle, enter
//   · no  — back one level; at the pause card's root, back to the game
// So the module speaks of INTENT (`NavKeys`), never of keys. The keyboard is one translator (`menuNavKey`, below);
// `input/gamepad` builds the same `NavKeys` and calls `navDialog`/`navPause` from here. That shared shape is what makes
// «every menu works six ways» true by construction rather than by discipline.
//
// TWO KINDS OF MENU. A settings panel selects by browser FOCUS (`navDialog`). The pause card is drawn inside the player's
// screen and selects by a CLASS (`.pm-sel`, `navPause`) — and a class fires no announcement, which is why the pause card
// speaks its items through `srSay` and a panel does not need to for its focus.
//
// `sharedDialogOpen` is an ALIAS of `ui/settings-panel.topVisibleOverlay`, not a copy: the two were once the same function
// written twice, and a scope fix applied to one would not have reached the other.
//
// ======================= TWO KNOWN DEFECTS, PINNED BY TESTS — DO NOT FIX ONE WITHOUT THE OTHER =======================
//
// DEFECT 1 — `sharedDialogOpen`'s scope does not see the pause card (WCAG 2.4.3, focus lost). The scope is
// `#game-region .overlay`; the pause card is `.screen-pause`, never `.overlay`. When the last dialog closes over an open
// pause card, `menuFocus(sharedDialogOpen())` receives `null`, leaves at its guard, and the focus stays on a button that
// has just become hidden — the browser drops it on `<body>`.
//
// DEFECT 2 — Escape is resolved in CAPTURE, by z-index, and consumed with `stopPropagation()`. `menuNavKey` runs before
// any bubble listener on the window, so the topmost visible dialog is the one that closes, and the registration-order
// chain (`overlays.escapeTarget()`, read by `input/keydown`) never decides while a dialog is open. Escape is also the same
// intent as action3 (`no`): at the pause card's root it means «back to the game», and nothing tells «close a dialog» from
// «leave the pause» apart. The capture and the `stopPropagation()` are also what keep a later window listener — a game's
// own keydown — from acting on the same Escape: removing them without a replacement lets one key do two things.
//
// `tests/menu-nav.browser.test.js` and `tests/menu-nav.node.test.js` pin both as they are today, and fail on purpose if
// the region is «improved» without the whole fix. `menuNavKey` is exported on its own so a test can fire it without
// depending on the propagation phase; `attach()` installs it.
// ======================================================================================================================
//
// WHAT IS NOT HERE: the overlay stack, the registry and closing by id belong to `ui/settings-panel` — this module
// consumes `topVisibleOverlay` and `closeById` and reimplements nothing. The quick bar belongs to `ui/pause-icons`; this
// module only asks whether a screen is on it (`onBar`) and hands it a step (`navBar`).
//
// INJECTION: nothing is reached. `isNavigable`, `withIndex` and `onBar` are QUESTIONS asked of the ctx rather than state
// read from `core/state`, so a game answers in its own model — a quiz whose settings are always open answers
// `isNavigable(): true` without pretending to be paused. `getPauseMenu`, `closePadWiz`, `isCapturing` and `setPhase` are
// resolved at call time, because what they reach is built in the root after this module.
//
// NO I/O ON IMPORT: the module body only declares data and pure functions. Every effect goes through `initMenuNav`.

/* ===================== minimal interfaces ===================== */

/** The intent, not the key. Defined once in input/edges. */
import type { NavKeys } from '../input/edges.js';

/** What this module reads from a `KeyboardEvent`. */
export interface NavKeyEvent {
  code: string;
  preventDefault(): void;
  stopPropagation(): void;
}

// ---------------------------------------------------------------------------------------------------------
// PURE — the navigation decision, without a DOM. Testable in the `node` project.
// ---------------------------------------------------------------------------------------------------------

/** Was any intent expressed? Defined once in input/edges; here under the name this module has always used. */
import { hasNavIntent as hasIntent } from '../input/edges.js';
import type { EventTargetLike } from '../input/touch-bindings.js'; // the listening port, generic over WindowEventMap
import type { DomQuery } from '../core/dom-query.js';
import { backToRoot, markPauseItem, PM_VISIBLE_ITEMS } from './pause-icons.js';
import { announceItem } from './item-announcement.js';
import { accessibleLabel } from '../core/accessible-label.js';
import { stepInRing } from '../core/ring.js';
import { navigableItems } from './menu-items.js';
import type { Translate } from '../core/i18n.js';
import { menuKeyIntent, selectStep, selectWrap, rangeStep, stepInPause } from './menu-intent.js';
export { hasNavIntent as hasIntent } from '../input/edges.js';

// The ring's arithmetic lives in `core/ring`: `ui/pause-icons` needs it too, and this module imports that one, so keeping
// it here would close an import cycle — which in ESM does not fail on the spot, it fails at boot in the TDZ. The public
// name stays here because the menus and the tests import it from here.
export { stepInRing } from '../core/ring.js';

// ---------------------------------------------------------------------------------------------------------
// ctx / api
// ---------------------------------------------------------------------------------------------------------

export interface MenuNavCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** ui/dom.ts `$` — only to find `#padwiz`. */
  $: DomQuery;
  /** `document.activeElement` — injected so a node test can simulate focus without a DOM. */
  getActiveElement: () => Element | null;

  /* --- ui/settings-panel.ts: the overlay stack. Reimplement none of it here. --- */
  /** The VISIBLE overlay with the highest z-index inside `#game-region`. */
  topVisibleOverlay: () => HTMLElement | null;
  /** `overlays.closeById(id)` — true if that dialog had a registered entry. */
  closeById: (id: string) => boolean;

  /** The pause card of player `i`'s screen, looked up when asked. */
  getPauseMenu: (playerIndex: number) => HTMLElement | null | undefined;

  /* --- neighbours, all resolved at call time (see the header) --- */
  /** Changes the game phase. `no` at the pause card's root goes back to the game. */
  setPhase: (p: 'title' | 'playing' | 'paused') => void;
  /** «Yes» on the pause card marks WHO acted (the options open on that player's tab). `ui/pause-icons` receives the
   *  same setter. */
  setPauseActor: (playerIndex: number) => void;
  /**
   * IS THIS A MOMENT TO NAVIGATE A MENU? If `false`, every key passes through.
   *
   * A boolean on purpose, not the phase: asking for the phase would oblige every game to answer with the string
   * `'paused'`, a platformer's concept. Asked «can a menu be navigated now?», a platformer answers `phase === 'paused'`
   * and a quiz whose settings are always open answers `true` — each in its own terms, neither pretending.
   */
  isNavigable: () => boolean;
  /**
   * `core/a11y-sr.srSay` — the «polite» `aria-live` region. INJECTED because it reaches the `document` when called, and
   * this module reaches no document on its own.
   *
   * The PAUSE card needs it and the dialogs do not: dialogs select by FOCUS, which a screen reader announces by itself.
   * The pause card selects by CLASS (`.pm-sel`), because it is drawn inside the player's screen — and no class fires an
   * announcement. Without this the card is silent to whoever navigates it by ear.
   */
  srSay: (text: string) => void;
  /**
   * Is the «N of M» index on? (ADR-0044 item 3; XAG 106 requires that it can be turned off.)
   *
   * ASKED of the ctx rather than read from `core/state`, for the same reason as `isNavigable`: a game answers in its own
   * model. `tests/menu-nav.node.test.js` fails if the import of `core/state` comes back.
   */
  withIndex: () => boolean;
  /** Writes the reason of a locked pause item in the screen footer, or clears it with `null` (ADR-0161). Optional. */
  explainItem?: (text: string | null) => void;
  /**
   * Is screen `i` on the quick bar (ADR-0044 item 7)? Asked BEFORE `isNavigable`, because the bar works with the game
   * RUNNING — the only thing in this module that acts outside the pause.
   */
  onBar: (i: number) => boolean;
  /** One step inside screen `i`'s quick bar. */
  navBar: (i: number, k: NavKeys) => void;
  /** ui/settings-controls.ts: a remap in progress consumes the key — the menu must not steal it. */
  isCapturing: () => boolean;
  /** Closes the controller-mapping panel (`#padwiz`), which sits ON TOP of everything; only Escape (cancel) reaches it. */
  closePadWiz: (save: boolean) => void;
  /** input/keyboard-runtime.ts: whose key is this? (-1 = generic). */
  whichPlayer: (code: string) => number;
  /** input/keyboard-runtime.ts: which action is this key FOR that player (honouring the remap)? */
  actionOf: (code: string, playerIndex: number) => string | null;
  /** Where `attach()` installs the menus' listeners, in CAPTURE. See `EventTargetLike` in input/touch-bindings. */
  win: EventTargetLike;
}

export interface MenuNavApi {
  /** The highest visible overlay (an alias of `topVisibleOverlay` — see the header). */
  sharedDialogOpen: () => HTMLElement | null;
  /** A menu's NAVIGABLE controls: enabled AND visible (`offsetParent !== null`). */
  menuItems: (menu: HTMLElement) => HTMLElement[];
  /** Focuses the current item (if the focus is already on one) or the first. Leaves quietly with a null `menu` — see DEFECT 1. */
  menuFocus: (menu: HTMLElement | null) => void;
  /** Closes the dialog and tries to give the focus back to what is left underneath. */
  dialogBack: (menu: HTMLElement) => void;
  /** One navigation step INSIDE a settings dialog. */
  navDialog: (menu: HTMLElement, k: NavKeys) => void;
  /** Marks `el` as `menu`'s selected item. */
  pauseSetSel: (menu: HTMLElement, el: HTMLElement | null | undefined) => void;
  /** One navigation step INSIDE a pause card (its items; the quick bar is not in the card). */
  navPause: (menu: HTMLElement, playerIndex: number, k: NavKeys) => void;
  /** The keyboard translator. Exported on its own so a test can fire it without depending on the propagation phase. */
  menuNavKey: (e: NavKeyEvent) => void;
  /**
   * Did the menus CONSUME this key event? `stopPropagation()` keeps it from the nodes further on, not from the listeners after
   * `menuNavKey` on the same window capture — and the keyboard conductor is one. It asks here, so a key that moved, confirmed
   * or CLOSED a menu is never also played in the same event (ADR-0111 erratum of 2026-09-26): with the menu already closed,
   * «is a menu open?» answers no, and resume was answering a question too.
   */
  consumed: (e: object) => boolean;
  /**
   * ONE STEP OF A MENU WITH NO KEY: the intents move the menu a key of player `playerIndex` would move now — the quick bar,
   * the dialog on top or that player's open pause card — through the same path and guards as `menuNavKey`. Answers whether a
   * menu took it. One-button scanning is the caller (ADR-0218 erratum of 2026-09-26): its press is not a menu key.
   */
  navIntent: (playerIndex: number, keys: NavKeys) => boolean;
  /**
   * THE NAMES A CHILD CAN SAY (ADR-0194 §1): the accessible names of the items a key of player `playerIndex` would move now —
   * the dialog on top, else that player's open pause card — and none while a key would move no menu. LOCKED items are in it
   * (ADR-0194 §5): saying one confirms it like any transport, and a locked item confirmed says its reason and does nothing.
   */
  itemNames: (playerIndex: number) => string[];
  /**
   * PUTS THE CURSOR on the item with this accessible name, without activating it and without announcing it — the menu the
   * name belongs to is the one `itemNames` reads. The caller then confirms through the virtual controller like any
   * transport (ADR-0194 §2). `false` when no such item is there now: nothing moved.
   */
  pointAt: (name: string, playerIndex: number) => boolean;
  /** Installs `menuNavKey` on the window, in CAPTURE. */
  attach: () => void;
}

// The items' selector lives in `ui/menu-items` (ADR-0158): what counts as an item is defined once, and the spoken
// «N of M» and the panel shell read the same list.
/**
 * The parts a panel control SAYS (ADR-0159 rule 1, XAG 106: «Gamma, slider, 38%, 6 of 9»): the label with the ROLE, and
 * the VALUE. The index is added by `announceItem`.
 *
 * The label is the row's `<strong>` when the control lives in one (it is what is SEEN, and a switch's text is its state,
 * not its name); outside a row, or on a slider with a name of its own («Volume de Música»), it is the accessible name.
 */
export function controlParts(t: Translate, el: HTMLElement): { label: string; state: string } {
  const row = el.closest('.ctrl-row')?.querySelector('strong')?.textContent?.trim() || '';
  const [, role, read] = CONTROL_KINDS.find(([recognises]) => recognises(el))!;
  const { label, value } = read(el, row, accessibleLabel(el), t);
  return { label: `${label}, ${t(role)}`, state: value };
}

/** A slider's position as a whole percentage: a missing maximum reads as 100, and a range of zero width as 0. */
function sliderPercent(r: HTMLInputElement): string {
  const min = +r.min || 0, max = +r.max || 100;
  const pct = max > min ? Math.round(((+r.value - min) / (max - min)) * 100) : 0;
  return `${pct}%`;
}

/** What a control says: its label and its value. `row` is the `<strong>` of the row it lives in, `name` its accessible name. */
type ControlReading = (el: HTMLElement, row: string, name: string, t: Translate) => { label: string; value: string };

/**
 * HOW EACH KIND OF CONTROL IS RECOGNISED AND READ, and the ORDER is the rule: the first row that recognises the element reads
 * it, and the last — a button — recognises everything. A stepper and a slider prefer their own name (a slider can be «Music
 * volume» on a row called «Sound»); the others prefer the row's label, because the text of a switch is its state, not its name.
 */
const CONTROL_KINDS: readonly (readonly [(el: HTMLElement) => boolean, string, ControlReading])[] = [
  [(el) => el.hasAttribute('data-passos'), 'sr.papel.passos',
    (el, row) => ({ label: el.getAttribute('aria-label') || row, value: el.getAttribute('aria-valuetext') ?? '' })],
  [(el) => el.tagName === 'SELECT', 'sr.papel.lista',
    (el, row, name) => ({ label: row || name, value: (el as HTMLSelectElement).selectedOptions?.[0]?.textContent?.trim() ?? '' })],
  [(el) => el.tagName === 'INPUT', 'sr.papel.cursor',
    (el, row) => ({ label: el.getAttribute('aria-label') || row, value: sliderPercent(el as HTMLInputElement) })],
  [(el) => el.hasAttribute('aria-pressed'), 'sr.papel.interruptor',
    (el, row, name, t) => ({ label: row || name, value: t(el.getAttribute('aria-pressed') === 'true' ? 'state.on' : 'state.off') })],
  [(el) => el.getAttribute('role') === 'radio', 'sr.papel.opcao',
    (el, row, name, t) => ({ label: row || name, value: el.getAttribute('aria-checked') === 'true' ? t('sr.estado.selecionado') : '' })],
  [() => true, 'sr.papel.botao', (_el, _row, name) => ({ label: name, value: '' })],
];

/** Where the items live: the dialog's card (`.overlay__card`) or the pause card (`.pause-card`). */
const CARD_SELECTOR = '.overlay__card, .pause-card';

export function initMenuNav(ctx: MenuNavCtx): MenuNavApi {
  const { t } = ctx;
  /* ===================== settings dialogs ===================== */

  // An ALIAS, not a copy: the body lives in ui/settings-panel.ts (see the header).
  const sharedDialogOpen = (): HTMLElement | null => ctx.topVisibleOverlay();

  function menuItems(menu: HTMLElement): HTMLElement[] {
    const card = menu.querySelector<HTMLElement>(CARD_SELECTOR) || menu;
    // The VISIBILITY filter (`offsetParent`) lives with the selector in `ui/menu-items`.
    return navigableItems(card);
  }

  function menuFocus(menu: HTMLElement | null): void {
    if (!menu) return; // ⚠️ DEFECT 1: with the pause card outside the scope, this guard is the end of the line
    const it = menuItems(menu);
    if (!it.length) return;
    const cur = it.indexOf(ctx.getActiveElement() as HTMLElement);
    (cur >= 0 ? it[cur] : it[0]).focus();
  }

  function dialogBack(menu: HTMLElement): void {
    if (!ctx.closeById(menu.id)) menu.hidden = true; // no registered entry: hide it outright
    menuFocus(sharedDialogOpen());
  }

  /** Adjusts a `select` (left/right = a step that stops at the ends; yes = a step that wraps) and fires `change`. */
  function tweakSelect(el: HTMLSelectElement, delta: number | 'wrap'): void {
    el.selectedIndex = delta === 'wrap' ? selectWrap(el.selectedIndex, el.options.length) : selectStep(el.selectedIndex, el.options.length, delta);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Moves an `input[type=range]` by one `step` and fires `input` (the event the panels listen to). */
  function tweakRange(el: HTMLInputElement, delta: number): void {
    el.value = String(rangeStep(+el.value, +el.min, +el.max, +el.step, delta));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * THE ITEM REACHED SAYS ITSELF (ADR-0159 rule 1): label, role, value and «N de M», in that order.
   *
   * The browser's focus moves by itself, but the engine's narration (the one a child playing in blind mode hears) does
   * not listen to focus; it listens to this.
   */
  function sayItem(items: readonly HTMLElement[], n: number): void {
    const el = items[n];
    if (!el) return;
    const { label: partLabel, state: partState } = controlParts(t, el);
    ctx.srSay(announceItem(t, { label: partLabel, state: partState, position: n + 1, total: items.length }, ctx.withIndex()));
  }

  function focusAndSay(items: readonly HTMLElement[], n: number): void {
    items[n]?.focus();
    sayItem(items, n);
  }

  /** Where the cursor is. With the focus outside the dialog (or on its card), it enters by the first item — and says it. */
  function cursorIn(items: readonly HTMLElement[]): number {
    const idx = items.indexOf(ctx.getActiveElement() as HTMLElement);
    if (idx >= 0) return idx;
    focusAndSay(items, 0);
    return 0;
  }

  /**
   * Left or right: a list, a slider or a steps control is ADJUSTED, and the new value is said — someone adjusting by ear has
   * no other way to know where it stopped; anything else walks the ring, like up and down.
   */
  function sideways(items: readonly HTMLElement[], idx: number, d: 1 | -1): void {
    const cur = items[idx]!;
    if (cur.tagName === 'SELECT') {
      const before = (cur as HTMLSelectElement).value;
      tweakSelect(cur as HTMLSelectElement, d);
      // an adjustment its owner refused (and put back) says nothing here: the owner already said why
      if ((cur as HTMLSelectElement).value !== before) sayItem(items, idx);
      return;
    }
    if (cur.tagName === 'INPUT') { tweakRange(cur as HTMLInputElement, d); sayItem(items, idx); return; }
    // A steps control ⯇ ⯈ (ADR-0151): left and right are the adjustment itself; its owner listens to `passo` (and announces).
    if (cur.hasAttribute('data-passos')) { cur.dispatchEvent(new CustomEvent('passo', { detail: d, bubbles: true })); return; }
    focusAndSay(items, stepInRing(items.length, idx, d));
  }

  /** «Yes»: a list goes round and says the new option; a slider or a steps control has nothing to confirm; anything else is clicked. */
  function confirm(items: readonly HTMLElement[], idx: number): void {
    const cur = items[idx]!;
    if (cur.tagName === 'SELECT') { tweakSelect(cur as HTMLSelectElement, 'wrap'); sayItem(items, idx); return; }
    if (cur.tagName === 'INPUT' || cur.hasAttribute('data-passos')) return;
    cur.click();
  }

  function navDialog(menu: HTMLElement, k: NavKeys): void {
    const items = menuItems(menu);
    if (!items.length) return;
    const idx = cursorIn(items);
    if (k.no) { dialogBack(menu); return; }
    if (k.left || k.right) { sideways(items, idx, k.right ? 1 : -1); return; }
    if (k.up || k.down) { focusAndSay(items, stepInRing(items.length, idx, k.down ? 1 : -1)); return; }
    if (k.yes) confirm(items, idx);
  }

  /* ===================== pause card (selected by class, not by focus) ===================== */

  /**
   * Moves the pause card's cursor. Items only: since ADR-0044 item 7 the quick bar lives in the HUD and keeps its own
   * cursor — writing the bar's caption from here would be one module drawing on another's screen.
   */
  function pauseSetSel(menu: HTMLElement, el: HTMLElement | null | undefined): void {
    if (!el) return; // an index outside the list (an empty card): touch nothing
    markPauseItem(menu, el); // the one place the card's cursor moves, and is kept in view (issue #134)
  }

  function navPause(menu: HTMLElement, playerIndex: number, k: NavKeys): void {
    if (k.no) {
      // «No» inside any sub-list goes up ONE level, to the root, and not back to the game (ADR-0044 item 5) — the same
      // «back leaves one level» the settings dialogs have (`dialogBack`). The question is «is this NOT the root?», not
      // «is this the options list?»: with three lists (ADR-0146), asking the second would make «no» from the game's own
      // options resume the game when the child asked to go back.
      const open = menu.querySelector<HTMLElement>('.pause-menu:not([hidden])');
      // ⚠️ AND THE CURSOR LANDS ON THE DOOR THAT OPENED THE LIST (ADR-0130 rule 1), not on the root's first item.
      if (open && open.dataset.sub && open.dataset.sub !== 'raiz') { backToRoot(menu); return; }
      ctx.setPhase('playing'); return; // «no» at the root → back to the game (resumes everyone)
    }

    const items = [...menu.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
    const cur = menu.querySelector<HTMLElement>('.pm-sel') || items[0];

    // «Yes»: the player who acted becomes the `pauseActor` (the accessibility options open on their tab) and the item is clicked.
    if (k.yes) { ctx.setPauseActor(playerIndex); if (cur) cur.click(); return; }
    // A card with no item at all: nothing to move (without this guard the next line throws on `cur`).
    if (!cur) return;

    // ONE list, one ring: the quick bar is not in the card (ADR-0044 item 7), so there are no borders between zones to cross.
    const n = stepInPause(items.length, items.indexOf(cur), k);
    selectAndSayInPause(menu, items, n);
  }

  function selectAndSayInPause(menu: HTMLElement, items: readonly HTMLElement[], n: number): void {
    pauseSetSel(menu, items[n]);
    // AND THE NEW ITEM IS SPOKEN. This card selects by class, not by browser focus — it is drawn inside the player's
    // screen — so nothing announces it by itself: no focus, no `aria-activedescendant`, no live region. ADR-0044 item 3
    // asks for position and total everywhere.
    // `accessibleLabel` and not `textContent`: an item with an `aria-label` would otherwise be narrated one way by the
    // game and another by the screen reader, and whoever hears both could not tell which is true.
    // 🔴 A LOCKED ITEM SAYS WHY when it is reached (ADR-0161): right after its name, and written in the footer.
    const reason = items[n].getAttribute('aria-disabled') === 'true' ? (items[n].dataset.motivo ?? '') : '';
    const announcement = announceItem(t, { label: accessibleLabel(items[n]), position: n + 1, total: items.length }, ctx.withIndex());
    ctx.srSay(reason ? `${announcement}. ${reason}` : announcement);
    ctx.explainItem?.(reason || null);
  }

  /* ===================== keyboard ===================== */

  const padWizOpen = (): boolean => { const pw = ctx.$<HTMLElement>('#padwiz'); return !!pw && !pw.hidden; };

  /** The controller-mapping panel sits ON TOP of everything: while it is open, only Escape gets through (and cancels). */
  function padWizKey(e: NavKeyEvent): boolean {
    if (!padWizOpen()) return false;
    if (e.code === 'Escape') { ctx.closePadWiz(false); consume(e); }
    return true; // open = consumed (even when it is not Escape: no menu underneath navigates while it is open)
  }

  /** The key events the menus consumed, for `consumed` — weak, so an event is forgotten with it. */
  const consumedKeys = new WeakSet<object>();
  /** Consumes the key: it was ours, and nobody else should see it. One function, so the three never come apart. */
  const consume = (e: NavKeyEvent): void => { e.preventDefault(); e.stopPropagation(); consumedKeys.add(e); };

  function menuNavKey(e: NavKeyEvent): void {
    if (ctx.isCapturing()) return;   // a remap in progress: the key is its
    if (padWizKey(e)) return;

    // ===================== THE QUICK BAR COMES BEFORE THE «NAVIGABLE» GUARD =====================
    // `isNavigable()` can be false while the game runs (a platformer answers `phase === 'paused'`), and the bar works
    // with the game RUNNING — that is what it is for: adjusting accessibility DURING play. After the guard, the
    // direction would fall to the character and the bar would do nothing, silently.
    //
    // On the KEYBOARD the way out is Escape (the project's `no`). A controller's START is the second way out and comes
    // through `input/gamepad`; the keyboard has no pair of its own for it, because Enter is already «confirm» and taking
    // it would leave the child no way to ACTIVATE the icon under the cursor.
    const { player, keys } = intentOf(e.code);
    // on the bar, a key with no intent is not consumed either — it simply moves nothing
    if (!hasIntent(keys) || !menusTake(player)) return;
    // THE KEY IS CONSUMED BEFORE THE MENU MOVES: a step that closes the last menu leaves no menu for a later listener to see
    consume(e);
    steerMenus(player, keys);
  }

  /**
   * Would a key of player `pi` with an intent move a menu now? The quick bar first — it works with the game RUNNING — then the
   * dialog on top or that player's open pause card, and only where a menu may be navigated.
   *
   * 📌 THE KEY IS CONSUMED ONLY IF THERE IS SOMETHING TO NAVIGATE. A game whose settings are always open answers
   * `isNavigable(): true`, and consuming before knowing would swallow every key with a menu intent — the arrows that choose
   * an answer in the quiz, for one. DEFECT 2's safety net stays: with a dialog open the key IS consumed, so one Escape closes
   * the dialog and no later listener sees it.
   */
  function menusTake(pi: number): boolean {
    return ctx.onBar(pi) || (ctx.isNavigable() && !!menuUnderKeys(pi));
  }

  /** One step of the menu a key of `pi` moves: the bar, else the dialog on top, else that player's own pause card. */
  function steerMenus(pi: number, k: NavKeys): void {
    if (ctx.onBar(pi)) { ctx.navBar(pi, k); return; }
    const open = menuUnderKeys(pi);
    if (open?.inPause) navPause(open.menu, pi, k); else if (open) navDialog(open.menu, k);
  }

  /**
   * AN INTENT WITH NO KEY (ADR-0218 erratum of 2026-09-26): one-button scanning offers a menu's own steps and takes one with a
   * press that is not a menu key — so it asks here, and the step goes the way a key's would, under the same guards.
   * The controller-mapping panel on top takes only «back», which cancels it, as Escape does.
   */
  function navIntent(pi: number, k: NavKeys): boolean {
    if (ctx.isCapturing()) return false;
    if (padWizOpen()) { if (k.no) ctx.closePadWiz(false); return true; }
    if (!hasIntent(k) || !menusTake(pi)) return false;
    steerMenus(pi, k);
    return true;
  }

  /** Whose key this is — a key no player owns is Player 1's — and what it asks of a menu. */
  function intentOf(code: string): { readonly player: number; readonly keys: NavKeys } {
    const owner = ctx.whichPlayer(code);
    const player = owner < 0 ? 0 : owner;
    return { player, keys: menuKeyIntent(code, owner >= 0 ? ctx.actionOf(code, player) : null) };
  }

  /** The menu a key of player `pi` moves: the dialog on top if there is one, else that player's OWN open pause card. */
  function menuUnderKeys(pi: number): { readonly menu: HTMLElement; readonly inPause: boolean } | null {
    const dlg = sharedDialogOpen();
    if (dlg) return { menu: dlg, inPause: false };
    const menu = ctx.getPauseMenu(pi);
    return menu && !menu.hidden ? { menu, inPause: true } : null;
  }

  /* ===================== an item said by name (ADR-0194) ===================== */

  /**
   * The stops of the menu a key of `pi` would move NOW, under the same guards `menuNavKey` applies before moving one: a name is
   * sayable exactly where confirming would reach it, so the confirm that follows `pointAt` lands on the named item.
   *
   * 🔴 LOCKED STOPS INCLUDED (ADR-0194 §5, ADR-0161): the cursor stops on a locked item, so its name is sayable too — and what
   * saying it does is what confirming it does, because it IS a confirm: the item's own press says its reason and acts on nothing
   * (`ui/pause-icons.pressPauseItem`, a panel's refusal). No second, voice-only «say the reason» exists to drift from that one.
   */
  function sayableItems(pi: number): { readonly menu: HTMLElement; readonly inPause: boolean; readonly items: HTMLElement[] } | null {
    if (ctx.isCapturing() || padWizOpen() || ctx.onBar(pi) || !ctx.isNavigable()) return null;
    const open = menuUnderKeys(pi);
    if (!open) return null;
    return { ...open, items: open.inPause ? [...open.menu.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)] : menuItems(open.menu) };
  }

  function itemNames(pi: number): string[] {
    return (sayableItems(pi)?.items ?? []).map((el) => accessibleLabel(el)).filter(Boolean);
  }

  function pointAt(name: string, pi: number): boolean {
    const open = sayableItems(pi);
    const el = open?.items.find((it) => accessibleLabel(it) === name);
    if (!open || !el) return false;
    if (open.inPause) { pauseSetSel(open.menu, el); ctx.explainItem?.(null); } else el.focus();
    return true;
  }

  /* ===================== holding on an item ===================== */

  /*
   * A PRESS HELD ON AN ITEM PLACES THE CURSOR THERE AND SAYS IT, WITHOUT ACTIVATING IT (ADR-0159 rule 2, erratum of
   * 2026-09-13). «Deixar o dedo apertado ou o botão do mouse apertado sobre o item deve dar a função de posicionar o
   * cursor sem "apertar".» (Dev) — the pad left the menus (ADR-0166), and a pointer had one meaning only: activation.
   * 📌 A short press is untouched; after a hold, the ONE click the browser fires on release is swallowed, in capture,
   * before the item's own listener. Threshold: the iOS long-press default, 0.5 s.
   */
  const HOLD_MS = 500;
  let holding: { id: number; timer: ReturnType<typeof setTimeout> } | null = null;
  let clickToSwallow: HTMLElement | null = null;

  /** The open menu and the item under `target`, when `target` is inside one: the top dialog first, else a pause card. */
  function itemUnder(target: EventTarget | null): { menu: HTMLElement; items: HTMLElement[]; n: number; inPause: boolean } | null {
    const no = target as HTMLElement | null;
    if (!no || typeof no.closest !== 'function') return null;
    const dlg = sharedDialogOpen();
    if (dlg) {
      const items = menuItems(dlg);
      const n = items.findIndex((el) => el.contains(no));
      return n >= 0 ? { menu: dlg, items, n, inPause: false } : null;
    }
    const menu = no.closest<HTMLElement>('.screen-pause');
    if (!menu || menu.hidden) return null;
    const items = [...menu.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
    const n = items.findIndex((el) => el.contains(no));
    return n >= 0 ? { menu, items, n, inPause: true } : null;
  }

  function release(): void {
    if (holding) clearTimeout(holding.timer);
    holding = null;
  }

  function onPress(e: PointerEvent): void {
    release();
    clickToSwallow = null;
    const under = itemUnder(e.target);
    if (!under) return;
    const id = e.pointerId;
    holding = {
      id,
      timer: setTimeout(() => {
        holding = null;
        clickToSwallow = under.items[under.n] ?? null;
        if (under.inPause) selectAndSayInPause(under.menu, under.items, under.n);
        else focusAndSay(under.items, under.n);
      }, HOLD_MS),
    };
  }

  function onRelease(e: PointerEvent): void {
    if (holding && holding.id === e.pointerId) release();
  }

  function onClick(e: MouseEvent): void {
    const swallowed = clickToSwallow;
    clickToSwallow = null;
    if (swallowed && e.target instanceof Node && swallowed.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
  }

  function attach(): void {
    ctx.win.addEventListener('keydown', menuNavKey, true);
    ctx.win.addEventListener('pointerdown', onPress, true);
    ctx.win.addEventListener('pointerup', onRelease, true);
    ctx.win.addEventListener('pointercancel', onRelease, true);
    ctx.win.addEventListener('click', onClick, true);
  }

  const consumed = (e: object): boolean => consumedKeys.has(e);

  return { sharedDialogOpen, menuItems, menuFocus, dialogBack, navDialog, pauseSetSel, navPause, menuNavKey, consumed, navIntent, itemNames, pointAt, attach };
}
