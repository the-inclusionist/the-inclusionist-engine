// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/focus-trap.ts — THE FOCUS TRAP (issue #109).
//
// ⚠️ THE DOCUMENT ALREADY PROMISES IT. Every `.overlay__card` carries `aria-modal="true"`, which tells assistive
// technology the rest of the page is inert. Without a trap, Tab disagrees: it leaves the dialog and enters the board
// underneath. That is the worst shape of accessibility defect — not the absence of a promise, but a promise the keyboard
// contradicts. A screen-reader user steps out into a game whose state they cannot perceive, with no way back they can
// perceive.
//
// ⚠️ IT ONLY INTERVENES AT THE EDGES, and that is a decision, not thrift. Reimplementing the whole tab order would mean
// reproducing rules the browser already gets right — positive `tabindex`, DOM order in a shadow root, elements made
// focusable by `contenteditable`. A trap that steps into the middle errs while walking; one that only closes the cycle
// at the ends cannot err in the middle, because it does not touch it.
//
// The rule lives in ONE pure function (`nextInTrap`), testable in the node project with no DOM. What needs a browser is
// only reading who is focused and calling `.focus()`.

/**
 * What counts as focusable. Deliberately WITHOUT `[contenteditable]` and without positive `tabindex`: both exist, but
 * appear in no dialog of this engine, and a selector that promises more than was verified is a selector that lies at
 * the next review.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Where focus has to go when Tab is about to leave the dialog — or `null` when there is nothing to do and the browser
 * should carry on by itself.
 *
 * The four cases, and the third is why this exists:
 *
 *   1. EMPTY list → `null`. A dialog with nothing focusable is the dialog's defect, and trapping focus in it would
 *      leave the child with no way out at all. Better to let it leave than to lock it in a mute place.
 *   2. focus on the LAST going forward → back to the first; on the FIRST going backwards → to the last. That is the
 *      cycle, which is what "trap" means.
 *   3. ⚠️ focus OUTSIDE the list → bring it back. The case the other three do not cover: focus may have escaped by a
 *      click on the board, or because the dialog opened without focusing anything. Without it the trap only works for
 *      whoever was already inside.
 *   4. focus in the MIDDLE → `null`, and the browser walks. See the header.
 */
export function nextInTrap<T>(
  focusables: readonly T[],
  current: T | null,
  backwards: boolean,
): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;

  const i = current === null ? -1 : focusables.indexOf(current);
  if (i < 0) return backwards ? last : first; // case 3: focus was outside
  if (!backwards && i === focusables.length - 1) return first;
  if (backwards && i === 0) return last;
  return null; // case 4: the middle belongs to the browser
}

interface KeydownTarget {
  addEventListener: (kind: 'keydown', fn: (e: KeyboardEvent) => void, capture?: boolean) => void;
  removeEventListener?: (kind: 'keydown', fn: (e: KeyboardEvent) => void, capture?: boolean) => void;
}

export interface FocusTrapCtx {
  /** The highest VISIBLE dialog in the stack, or `null`. It is `ui/settings-panel`'s `topVisibleOverlay`. */
  topOverlay: () => HTMLElement | null;
  /** Who has focus now — `() => document.activeElement`. Injected: the node project has no document. */
  currentFocus: () => Element | null;
  /** The focusables INSIDE the dialog, in document order and already filtered by visibility. */
  focusablesIn: (isInside: HTMLElement) => HTMLElement[];
  win: KeydownTarget;
}

export interface FocusTrapApi {
  /** The handler, exposed so the test can call it without installing anything. */
  onKeydown: (e: KeyboardEvent) => void;
  /** Installs in the CAPTURE phase, for the same reason as `menu-nav`: see the key before whoever is underneath. */
  attach: () => void;
  /**
   * Uninstalls.
   *
   * ⚠️ A trap that does not uninstall is a leak for any page that mounts the engine twice — one that switches games
   * without reloading is exactly that: the first trap keeps holding focus during the second.
   */
  detach: () => void;
}

export function initFocusTrap(ctx: FocusTrapCtx): FocusTrapApi {
  function trapKey(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const dialogo = ctx.topOverlay();
    if (!dialogo) return; // with no dialog open, Tab belongs to the game, and has to stay that way

    const target = nextInTrap(ctx.focusablesIn(dialogo), ctx.currentFocus() as HTMLElement | null, e.shiftKey);
    if (!target) return;

    e.preventDefault();
    target.focus();
  }

  return {
    onKeydown: trapKey,
    attach: () => ctx.win.addEventListener('keydown', trapKey, true),
    detach: () => ctx.win.removeEventListener?.('keydown', trapKey, true),
  };
}

/**
 * The focusables of a container, in the browser. It lives here and not in a root so that two roots do not write two
 * versions that would drift silently — one trapping focus and the other letting it escape, in the same product.
 *
 * ⚠️ VISIBILITY IS BY `getClientRects()`, not by `offsetParent`: `getClientRects()` answers "does this draw any box?",
 * which covers `display:none` on ANY ancestor, zero-size elements and the fixed-container case — without the reader
 * needing to know where `offsetParent` has holes (it is `null` for a FIXED element itself, while its descendants return
 * the container).
 */
export function focusablesInDom(isInside: HTMLElement): HTMLElement[] {
  const candidates = [...isInside.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  return candidates.filter((el) => !el.hidden && el.getClientRects().length > 0);
}
