// SPDX-License-Identifier: AGPL-3.0-or-later
// input/key-default — WHICH KEY THE GAME HEARS, AND WHICH KEEPS ITS BROWSER DEFAULT (ADR-0111 errata of 2026-09-26).
//
// The engine owns the keyboard (ADR-0111): it turns a key into a position and carries the position to the game. One key press
// is one action, and that makes two rules, which are one rule seen from two sides:
//   · A KEY THE GAME HEARD IS SPENT. The keyboard conductor cancels its default, or Space on a focused `<button>` was the game's
//     `action2` AND the button's click on the release.
//   · A KEY THAT WENT TO SOMETHING ELSE IS NOT ALSO PLAYED. It keeps its default, and the game does not hear it. That is what
//     this module answers, before the engine delivers:
//       · a key typed into an editable field (input, textarea, select, contenteditable): typing is the field's;
//       · a key that ACTIVATES one of the engine's own focused controls (`ownControls`, the accessibility bar, in the tab order
//         in play): Space and Enter press a focused button, and that press is the control's.
//     📏 Both used to keep their default AND be delivered. On the served quiz, Space on ☰ opened the menus and answered a
//     question; Space typed into a text field answered one too.
//
// 📌 ONLY THE ACTIVATION KEYS on the engine's control, and not every key: a focused button does nothing native with an arrow or
// a letter, so an arrow pressed after Tab left the focus on ☰ is still the child moving in the game — held back, it would be
// lost, and the game would stop answering until she clicked somewhere else.
//
// Not decided here: a key refused by an open menu, or consumed by the engine's menus, is the menus' (`input/virtual-controller`,
// `ui/menu-nav`); a key mapped to no position was never the game's.
//
// Pure: it is told the key and where the focus was; it answers a decision. No document, no event.

/** The part of a key event's target this reads — an `Element` satisfies it; `window`/`document` have no `closest`. */
export interface KeyTargetLike {
  readonly isContentEditable?: boolean;
  closest?(selector: string): unknown;
}

const EDITABLE = 'input, textarea, select';

/** The keys a focused button answers natively: Enter presses it on the key's press, Space on its release. */
export const BUTTON_ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Space', 'Enter', 'NumpadEnter']);

/**
 * Whether the key `code`, pressed with the focus on `target`, is play's to hear. `false`: it belongs to what has the focus — a
 * field, or the engine's own control it activates (`ownControls`, a selector) — and keeps its default.
 */
export function keyGoesToGame(code: string, target: KeyTargetLike | null, ownControls: string): boolean {
  if (!target || typeof target.closest !== 'function') return true; // no element had the focus: nothing else to go to
  if (target.isContentEditable || target.closest(EDITABLE)) return false;
  return !(BUTTON_ACTIVATION_KEYS.has(code) && target.closest(ownControls));
}
