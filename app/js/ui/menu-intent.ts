// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-intent — what a key MEANS inside a menu, and how far one step goes, with no menu: the generic key tables, a key's
// intent given its owner's remapped action, and the steps of a list, a select, a range and the pause card (ADR-0221; issue
// #203).
//
// It left `ui/menu-nav` for the reason the `*-choices` modules left their panels: the node test drove exactly these names with
// no document, so the seam was already drawn. What stays there is the navigation that needs a page — finding the focused item,
// moving the focus, announcing it.
import type { NavKeys } from '../input/edges.js';
import type { Action } from '../core/actions.js';
import { stepInRing } from '../core/ring.js';

/**
 * The position a menu reads as «yes»: confirming the item under the cursor. Named once because a second reader presses it —
 * the voice, which puts the cursor on an item said by name and confirms it the way every transport does (ADR-0194 §2).
 */
export const MENU_CONFIRM: Action = 'action2';

/* The GENERIC key tables (the ones that hold for any player, even with no remap). They are `Set`s because that is
   what they are — membership, not order — and because a named `Set` keeps the table auditable from outside (the
   test imports the constant instead of repeating the literals). */
/** Confirm/enter. `NumpadEnter` counts here (but does NOT pause — see `input/keydown`). */
export const KEY_YES: ReadonlySet<string> = new Set(['Space', 'KeyJ', 'Enter', 'NumpadEnter']);
/** Back. ⚠️ DEFECT 2: `Escape` is the SAME intent as the gamepad's "special" action. */
export const KEY_NO: ReadonlySet<string> = new Set(['Escape']);
export const KEY_UP: ReadonlySet<string> = new Set(['ArrowUp', 'KeyW']);
export const KEY_DOWN: ReadonlySet<string> = new Set(['ArrowDown', 'KeyS']);
export const KEY_LEFT: ReadonlySet<string> = new Set(['ArrowLeft', 'KeyA']);
export const KEY_RIGHT: ReadonlySet<string> = new Set(['ArrowRight', 'KeyD']);

/**
 * Translates (physical key, the key owner's remapped action) → intent. `act` is `null` when the key belongs to no
 * player (a generic key).
 */
export function menuKeyIntent(code: string, act: string | null): NavKeys {
  return {
    yes: KEY_YES.has(code) || act === MENU_CONFIRM,
    no: KEY_NO.has(code) || act === 'action3',
    up: KEY_UP.has(code) || act === 'up',
    down: KEY_DOWN.has(code) || act === 'down',
    left: KEY_LEFT.has(code) || act === 'left',
    right: KEY_RIGHT.has(code) || act === 'right',
  };
}

/** A step of a menu one-button scanning offers — what a menu does, not a key (ADR-0218 erratum of 2026-09-26). */
export type MenuStep = 'next' | 'previous' | 'confirm' | 'back' | 'increase' | 'decrease';

/**
 * WHAT ONE-BUTTON SCANNING OFFERS INSIDE A MENU, in order after «cancel» (interface log 2026-09-26). By how often a child needs
 * each: every menu here is a ring, so «next» alone reaches every item, and it comes first; «confirm» ends every choice; «back»
 * leaves — the quick pause, a sub-list, a panel, the card —; «previous» is a shortcut the ring already covers, so it waits last.
 */
export const MENU_SCAN: readonly MenuStep[] = ['next', 'confirm', 'back', 'previous'];

/**
 * WHAT THE CONTROL UNDER A MENU'S CURSOR LETS A SIDEWAYS STEP DO — the question `ui/menu-nav` answers with the rule its left
 * and right keys follow: `item` has no value (a button, a switch, the quick bar, the pause card); `list` is a `<select>`, whose
 * value left and right step and whose «confirm» goes round; `value` is a slider or a ⯇ ⯈ steps control, which left and right
 * adjust and «confirm» leaves untouched.
 */
export type MenuCursor = 'item' | 'list' | 'value';

/**
 * THE PASS IN A MENU, for the control under its cursor (ADR-0218 erratum; interface log 2026-09-26, the sideways step). Only a
 * control with a value offers «increase» and «decrease» — they come right after «next», which keeps its place as the first
 * step of every menu — and a slider or a steps control does not offer «confirm», which does nothing there: a cycle never
 * stops on a position that does nothing (ADR-0155).
 */
export function menuScanFor(cursor: MenuCursor): readonly MenuStep[] {
  if (cursor === 'item') return MENU_SCAN;
  const sideways: readonly MenuStep[] = ['next', 'increase', 'decrease'];
  return cursor === 'list' ? [...sideways, 'confirm', 'back', 'previous'] : [...sideways, 'back', 'previous'];
}

/**
 * The intent a step is — the one a key with that meaning would carry, so it moves a menu the way the key does. «increase» is the
 * right key and «decrease» the left one: the same step a keyboard adjusts a value with.
 */
const STEP_INTENT: Readonly<Record<MenuStep, NavKeys>> = {
  next: { down: true }, previous: { up: true }, confirm: { yes: true }, back: { no: true },
  increase: { right: true }, decrease: { left: true },
};
export function menuStepKeys(step: MenuStep): NavKeys {
  return { ...STEP_INTENT[step] };
}

/** `select` with left/right: one step, WITHOUT wrapping — adjusting a VALUE is not navigating a list. */
export function selectStep(selectedIndex: number, optionsLen: number, delta: number): number {
  return Math.max(0, Math.min(optionsLen - 1, selectedIndex + delta));
}

/** `select` with "yes": one step, WITH wrapping. That is the deliberate difference between confirming and adjusting. */
export function selectWrap(selectedIndex: number, optionsLen: number): number {
  return (selectedIndex + 1) % optionsLen;
}

/** `input[type=range]` with left/right: one `step` (default 1), clamped between `min` and `max`. */
export function rangeStep(value: number, min: number, max: number, step: number, delta: number): number {
  const st = step || 1; // a missing/0/NaN step becomes 1
  return Math.max(min, Math.min(max, value + delta * st));
}

/**
 * THE CURSOR STEP IN THE PAUSE MENU — a RING, because the pause card is one list (ADR-0044, items 1 and 7).
 *
 * XAG 106 allows wrapping for a LINEAR menu and FORBIDS it for a two-dimensional grid — in a grid, wrapping
 * teleports the cursor to the other corner and the person loses track of where they are. With the icon bar in the
 * HUD, the card is a single list, so wrapping is the recommended behaviour rather than a forbidden one — and there
 * are no zone-crossing rules for a child to discover without seeing.
 *
 * What it buys: `quit` is ONE key UP from `resume`. Last to be read, next to the finger.
 */
export function stepInPause(len: number, idx: number, k: NavKeys): number {
  const d = (k.down || k.right) ? 1 : -1;
  return stepInRing(len, idx < 0 ? 0 : idx, d);
}
