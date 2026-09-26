// SPDX-License-Identifier: AGPL-3.0-or-later
// input/key-default — A KEY THE ENGINE DELIVERED TO THE GAME DOES NOT ALSO DO THE BROWSER'S DEFAULT (ADR-0111 erratum of 2026-09-26).
//
// The engine owns the keyboard (ADR-0111): it turns a key into a position and carries the position to the game. A key it
// carried is spent. Left with its default, Space on a focused `<button>` was two actions — the game's `action2`, then the
// button's native click on the release — and every game with a focusable button got the double.
//
// WHAT KEEPS ITS DEFAULT, and why each one is here:
//   · A key the engine did NOT deliver — unmapped (Tab), refused by an open menu, taken by another transport. It was never the
//     game's, so it is the browser's or whoever else decides it (`ui/menu-nav` consumes the menus' keys itself).
//   · A key typed into an editable field (input, textarea, select, contenteditable): typing is never taken.
//   · A key on one of the engine's OWN controls in play (`ownControls`, the accessibility bar): its native activation is how a
//     keyboard or screen-reader user presses it, and cancelling it would leave that control with no key at all — `Enter` is
//     `start` and already opens the quick pause.
//
// Pure: it is told whether the key was delivered and where the focus was; it answers a decision. No document, no event.

/** The part of a key event's target this reads — an `Element` satisfies it; `window`/`document` have no `closest`. */
export interface KeyTargetLike {
  readonly isContentEditable?: boolean;
  closest?(selector: string): unknown;
}

const EDITABLE = 'input, textarea, select';

/** Whether the engine cancels the browser's default of a key it just handled. */
export function cancelsKeyDefault(delivered: boolean, target: KeyTargetLike | null, ownControls: string): boolean {
  if (!delivered) return false;
  if (!target || typeof target.closest !== 'function') return true; // no element had the focus: nothing native to keep
  if (target.isContentEditable || target.closest(EDITABLE)) return false;
  return !target.closest(ownControls);
}
