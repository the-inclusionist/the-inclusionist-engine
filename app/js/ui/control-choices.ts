// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/control-choices.ts — WHAT A KEY IS AND WHOSE IT ALREADY IS, with no document anywhere near it.
//
// Three questions and only three: what a key code is called, which OTHER player already has that code, and which
// OTHER position of the same scheme already has it. Zero DOM, zero ctx, zero state.
//
// 📌 The same cut `ui/audio-choices` and `ui/typo-choices` received, marked by the same thing:
// `tests/settings-controls.node.test.js` exercises these functions in a project WITHOUT a document, and the browser
// test drives the rest. The seam was drawn in the test folder before it existed in the code (ADR-0221).
import type { Translate } from '../core/i18n.js';
import { ACTIONS, type Action } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';

/**
 * THE FOUR ARROWS, one per direction.
 *
 * 🔴 The Dev asked for exactly these: «Por que está escrevendo "↔Up", "↔Down" etc ao invés de simplesmente "↑",
 * "↓", "←" e "→"? Não escolha poluir a UI.» A chain of `replace` calls over the physical code is a hidden table, and a
 * hidden table writes what nobody chose — so the table is written out.
 *
 * 📌 And there is nothing to translate here: an arrow is the same in pt, en and es, which is exactly why it is a
 * glyph and not a word. The child who remaps sees the key they have in hand.
 */
const GLYPH: Readonly<Record<string, string>> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

/**
 * Physical key code → short readable label.
 *
 * `Space` is the only one with a word to translate; the arrows are glyphs and the rest are the bare letter or
 * digit, identical in every language.
 *
 * ⚠️ A TABLE AND A LADDER, and not a chain of replacements, which leaks the MACHINE's name whenever a prefix is not
 * foreseen (`Digit1`, `Numpad5`). What is not recognised still passes through untouched on purpose: `Comma` is ugly
 * and honest, and inventing a name for it would be guessing.
 */
export function keyName(t: Translate, code: string): string {
  const c = String(code);
  if (GLYPH[c]) return GLYPH[c];
  if (c === 'Space') return t('key.space');
  if (c.startsWith('Shift')) return 'Shift';
  if (c.startsWith('Key')) return c.slice(3);
  if (c.startsWith('Digit')) return c.slice(5);
  // «Num 5», «Num Add»: the numeric keypad is a different PHYSICAL place, and saying only «5» would make two
  // distinct keys show the same label in the same list.
  if (c.startsWith('Numpad')) return `Num ${c.slice(6)}`;
  return c;
}

/**
 * Which OTHER player already owns `code`, among `schemes` (one entry per player, same order as player index) —
 * or -1 if free. `mapRef` (the scheme currently being edited) is excluded BY REFERENCE. Built over a Map (code →
 * owner index) so a scheme with many bound keys does not cost a full re-scan per lookup.
 */
export function keyUsedByOther(code: string, mapRef: KeyScheme, schemes: readonly KeyScheme[]): number {
  const owners = new Map<string, number>();
  schemes.forEach((m, i) => {
    if (m === mapRef) return;
    for (const a of ACTIONS) for (const c of m[a] || []) if (!owners.has(c)) owners.set(c, i);
  });
  return owners.get(code) ?? -1;
}

/**
 * Which OTHER action OF THE SAME scheme already has `code` — or `null` if none.
 *
 * ⚠️ THE SIBLING `keyUsedByOther` NEEDS, AND ITS ABSENCE IS INVISIBLE IN A ONE-PLAYER GAME (#126). That function
 * excludes the scheme being edited **by reference**; with a single player, `schemesFor()` returns exactly that
 * scheme, so its guard scans an empty list and **can never fire**. A child who puts `W` on a new action would keep
 * `W` on the old one too, and play the whole game with both firing together.
 *
 * ⚠️ AND THAT IS THE WORST SHAPE A DEFECT CAN TAKE, as the `input/default-bindings` header says: the two actions fire
 * together, and the child sees an intermittent double action nobody can reproduce on purpose — on a screen they
 * opened **because** they could not use the default controls.
 *
 * Returns the ACTION and not a boolean, because the announcement has to say which one — saying only that the key is
 * in use sends the child looking for what the function already knows.
 */
export function actionAlreadyBound(code: string, mapRef: KeyScheme, except: Action): Action | null {
  for (const a of ACTIONS) {
    if (a === except) continue;
    if ((mapRef[a] || []).includes(code)) return a;
  }
  return null;
}
