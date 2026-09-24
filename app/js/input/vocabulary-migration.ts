// SPDX-License-Identifier: AGPL-3.0-or-later
// input/vocabulary-migration — THE ONLY PLACE IN THE ENGINE ALLOWED TO SAY `jump`, AND FOR HOW LONG.
//
// ========================= WHY THIS MODULE STANDS APART =========================
// The `action-vocabulary-boundary` gate fails the engine for naming the game's verbs, and it was right to fail
// this table when it was born inside `input/keyboard.ts`. But the table HAS to name them: translating the old
// vocabulary is literally its job.
//
// ⚠️ AND THE WAY OUT WAS NOT RAISING THE CEILING. Raising a ceiling that "only shrinks" is the loosening the gate
// exists to prevent, and an exception with no address becomes a precedent for the next one. The way out was
// QUARANTINE: the whole coupling lives here, in a file whose name says it is historical, with a ceiling of its
// own and a date of death.
//
// ⚠️ WHEN THIS GETS DELETED: when no data saved in the old format remains. The code side has no way to know that
// — the data is in each child's browser — so the criterion is time, and it is the Dev's. While any remains,
// deleting this file deletes the remapping of whoever made one.
//
// ========================= WHAT IS LOST IF THIS IS WRONG =========================
// Whoever remapped keys usually remapped out of NEED — hand reach, a finger that does not stretch, a keyboard
// without a numpad. A saved scheme that stops matching raises no error: the keys simply stop responding, and the
// child concludes the game is broken. It is the loss of an adaptation, not of a preference.

/**
 * ⚠️ THE SAVED DATA IS NOT A `KeyScheme`, and issue #118 made that a compile error instead of an assumption. A
 * `KeyScheme` is CLOSED over the fourteen positions and complete; what sits in the child's browser is an
 * OVERLAY — partial by construction (`loadKB` merges it over the defaults with `Object.assign`) and able to
 * carry keys this code does not know, which the header of `migrateScheme` already says in so many words: an
 * unknown key passes through untouched.
 *
 * Giving it the closed type would force this file to invent the positions missing from the old data — that is,
 * to write keys the child never chose, in the very module that exists so as not to lose their remapping. The
 * open type is the honest one here, and only here.
 */
export type SavedScheme = Record<string, readonly string[]>;

/**
 * Platform name → abstract position. **ADR-0086 §2**, not ADR-0074.
 *
 * ⚠️ THE DIFFERENCE BETWEEN THE TWO RECORDS IS THE CHILD'S KEY. ADR-0074 said `jump → action1` and
 * `run → action4`; ADR-0086 corrected it to `run → action1` and `jump → action2`, having measured that the
 * correction is the CONSERVATIVE reading — it leaves each verb on the key and the button it already held.
 * Translating by mistake with 0074's table would raise no error at all: it would move jump from `J` to `U`
 * silently.
 */
export const OLD_VOCABULARY: Readonly<Record<string, string>> = Object.freeze({
  run: 'action1',
  jump: 'action2',
  especial: 'action3',
  swap: 'action4',
  // ⚠️ AND A FIFTH ENTRY THAT IS NOT A PLATFORM VERB. The touch layer called `pause` the position everything
  // else calls `start` — two words for the same thing, and the touch one was the only one missing from the
  // abstract set. A touch map saved before this has `start: 'pause'` in the START slot, and without this line
  // that button would stop pausing: `decide()` now looks for `'start'` and would get `'pause'`, which is no
  // longer anything — no error, no warning, and the only pause button a tablet has.
  pause: 'start',
});

/**
 * ⚠️ THE SECOND SAVED DATA, and it nearly slipped through. The touch map (`incl_touchmap`) stores SLOT → ACTION,
 * so the action name is in the VALUE and not the key: `{ b0: 'jump', b1: 'especial' }`. The keyboard scheme
 * translator, which translates KEYS, would pass over it without touching anything.
 *
 * ⚠️ AND THE DAMAGE WOULD BE WORSE THAN ON THE KEYBOARD. `normalizeTouchMap` merges what is stored OVER the
 * default, so a saved `b0: 'jump'` would overwrite the correct `b0: 'action2'` — and the on-screen button would
 * stop doing anything. On a public-school tablet, touch is not the alternative path: it is the only one.
 *
 * A BROWSER test found it (`tests/touch.browser.test.js`), after the `node` suite was already green — which is
 * the argument for having both projects.
 */
export function migrateTouchMap(touchMap: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!touchMap) return null;
  const migrated: Record<string, string> = {};
  for (const [slot, action] of Object.entries(touchMap)) {
    migrated[slot] = OLD_VOCABULARY[action] ?? action;
  }
  return migrated;
}

/**
 * ⚠️ THE THIRD SAVED DATA, found by a sweep and not by accident. After the second turned up in a browser test,
 * the right question stopped being "is this one migrated?" and became "HOW MANY persisted formats exist?". There
 * are three, and this is the pad wizard's: `incl_padmap_<id>` stores ACTION → PHYSICAL BINDING,
 * `{ jump: { b: 0 }, run: { b: 2 } }`, one per pad model.
 *
 * ⚠️ AND IT IS THE MOST EXPENSIVE OF THE THREE TO LOSE. Such a map exists because the child (or whoever is with
 * them) went through the wizard pressing button after button, one step per position the game names — probably
 * because their pad is not "standard", and generic and adapted pads rarely are. Losing it sends that person back
 * through the whole wizard.
 *
 * `_skip` and any unknown key pass through, for the same reason as the other two migrations.
 */
export function migrateControlMap<T>(touchMap: Record<string, T> | null | undefined): Record<string, T> | null {
  if (!touchMap) return null;
  const migrated: Record<string, T> = {};
  for (const [key, value] of Object.entries(touchMap)) {
    migrated[OLD_VOCABULARY[key] ?? key] = value;
  }
  return migrated;
}

/** The saved object, as `input/keyboard` persists it. `p34` is the oldest format of all. */
export interface SavedKB {
  solo?: SavedScheme;
  p2?: SavedScheme[];
  p3?: SavedScheme[];
  p4?: SavedScheme[];
  p34?: (SavedScheme | null)[];
}

/**
 * Translates ONE saved scheme from the old vocabulary to the abstract one.
 *
 * ⚠️ AN UNKNOWN KEY PASSES THROUGH UNTOUCHED, and that is a decision, not carelessness: `up`, `down`, `left` and
 * `right` never changed names, and a scheme may carry a key this code does not know — data from a future
 * version, or garbage. Deleting it would destroy data we do not understand, and it is what would make the four
 * directions vanish. It is also what makes this function IDEMPOTENT: applied to an already migrated scheme, no
 * key matches and the result equals the input, which matters because `loadKB` may run more than once a session.
 */
export function migrateScheme(saved: SavedScheme | null | undefined): SavedScheme | null {
  if (!saved) return null;
  const migrated: SavedScheme = {};
  for (const [key, keys] of Object.entries(saved)) {
    const newKey = OLD_VOCABULARY[key] ?? key;
    // ⚠️ A HALF-migrated scheme (both keys present): the UNION, never the overwrite. Losing a key is the damage
    // this module exists to prevent; having the same key twice is no damage at all.
    migrated[newKey] = migrated[newKey] ? [...new Set([...migrated[newKey], ...keys])] : [...keys];
  }
  return migrated;
}

/** Translates the whole saved object — the solo scheme and the lists per player count. */
export function migrateSaved(s: SavedKB | null | undefined): SavedKB | null {
  if (!s) return null;
  const list = (arr: (SavedScheme | null)[] | undefined): SavedScheme[] | undefined =>
    (Array.isArray(arr) ? arr.map((m) => migrateScheme(m) as SavedScheme) : undefined);
  const out: SavedKB = {};
  const solo = migrateScheme(s.solo);
  if (solo) out.solo = solo;
  for (const g of ['p2', 'p3', 'p4'] as const) {
    const v = list(s[g]);
    if (v) out[g] = v;
  }
  // `p34` migrates its VOCABULARY here and its SHAPE in `loadKB`, which already did that before this module
  // existed. Without this line, the oldest data of all would be the only one to get lost.
  if (Array.isArray(s.p34)) out.p34 = s.p34.map((m) => migrateScheme(m));
  return out;
}
