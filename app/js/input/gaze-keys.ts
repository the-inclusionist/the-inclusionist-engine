// SPDX-License-Identifier: AGPL-3.0-or-later
// input/gaze-keys — THE EYE CONTROL PRESSES KEYS, STAMPED AS THE EYES (ADR-0213, ADR-0109; issue #196).
//
// The cycle's pulse becomes a keydown when an action starts being pressed and a keyup when it stops, on the key the child has for that
// action (`kbFor(0)`, so a remapped key is the one pressed). They go through the same path as a keyboard's: `input/keydown` marks the key
// with its origin, the menus move by it, START pauses by it, and the one-command-at-a-time latch and the transport in use (ADR-0211,
// ADR-0109) apply to `'olhos'` with no code of their own here.
// ⚠️ Stamped BEFORE dispatch: an unstamped synthetic key is read as the keyboard, and pressing the keyboard switches the toggles off —
// the eyes would silently undo the accommodation the child plays with.

import type { Action } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';
import { carimbarOrigem } from './origem-sintetica.js';

export interface GazeKeyEvent { readonly type: 'keydown' | 'keyup'; readonly code: string }

/** The key events between what was pressed on the last frame and what is pressed now. An action with no key presses nothing. */
export function gazeKeyEvents(before: Action | null, now: Action | null, scheme: KeyScheme): GazeKeyEvent[] {
  if (before === now) return [];
  const code = (a: Action | null): string | undefined => (a ? scheme[a]?.[0] : undefined);
  const out: GazeKeyEvent[] = [];
  const up = code(before), down = code(now);
  if (up) out.push({ type: 'keyup', code: up });
  if (down) out.push({ type: 'keydown', code: down });
  return out;
}

/** Dispatch them where the keyboard's arrive, each stamped `'olhos'`. The event constructor is injected so a test needs no DOM. */
export function dispatchGazeKeys(
  target: { dispatchEvent(ev: Event): boolean },
  events: readonly GazeKeyEvent[],
  makeEvent?: (type: string, init: KeyboardEventInit) => Event,
): void {
  for (const { type, code } of events) {
    const init = { code, key: code, bubbles: true, cancelable: true };
    target.dispatchEvent(carimbarOrigem(makeEvent ? makeEvent(type, init) : new KeyboardEvent(type, init), 'olhos'));
  }
}
