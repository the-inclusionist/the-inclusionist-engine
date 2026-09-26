// SPDX-License-Identifier: AGPL-3.0-or-later
// core/actions — THE FOURTEEN ABSTRACT ACTIONS. The single source of the engine's input vocabulary.
//
// ========================= WHAT THIS IS =========================
// ADR-0074 decided that the engine knows POSITIONS, not verbs, and that the GAME supplies the words. This module is
// the list of those positions and nothing else: no dependencies, no I/O, importable from both sides of the boundary.
// It was written before the transports migrated to it (issue #103), so the migration had a destination instead of
// inventing one.
//
// ========================= WHY FOURTEEN AND NOT NINE =========================
// ADR-0074 recorded nine and wrote, among its own drawbacks, that nine is a CEILING a genre may want to exceed and
// that the record must say what happens then. The Dev exceeded it, asking for five more for richer games.
//
// ⚠️ AND THE FOUR NEW ONES ARE `leftShoulder`, `leftTrigger`, `rightShoulder`, `rightTrigger` — NOT
// `action5`..`action8`. I argued for numbers and the Dev decided against, for a reason ADR-0086 records: `action7` is
// unreadable where someone programs, and a vocabulary nobody can read aloud is not abstraction, it is cipher.
//
// ⚠️ AND THE OBJECTION STAYS WRITTEN, because it does not vanish when the decision went the other way: shoulder and
// trigger are a GAMEPAD's shape. On a keyboard `leftTrigger` is a key; on touch, a slot; for a speech recogniser, a
// word. ADR-0086 answers that the shape is ANATOMICAL before it is a gamepad's — two fingers per hand, one above the
// other — and that this crosses transports better than a number does. Whoever disagrees should read both records.
//
// `start` and `select` keep names by the criterion that already held for `start`: they are a FUNCTION, not a
// position — what belongs to the system and not to the game's world.

/** The fourteen positions the engine knows. None of them is a word a child reads. */
export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'action1', 'action2', 'action3', 'action4',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
  'start', 'select',
] as const;

export type Action = (typeof ACTIONS)[number];

/** The four directions, which every transport has to reach. */
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const satisfies readonly Action[];

/**
 * The eight verbs, in TWO halves named by different criteria, and that is a decision, not carelessness:
 *
 * · `action1`..`action4` — the diamond. NUMBERED, because four positions in a cross have no names that cross genres:
 *   what a platformer calls jump, a quiz calls confirm.
 * · `leftShoulder`, `leftTrigger`, `rightShoulder`, `rightTrigger` — NAMED by the hand's anatomy: two fingers per
 *   hand, one above the other. ADR-0086.
 *
 * ⚠️ THERE IS NO HIERARCHY BETWEEN THEM in the contract. The order is that of presentation — in the gamepad wizard, on
 * the remap screen — and not a scale of importance: a game may use `rightShoulder` and nothing else.
 */
export const VERBS = [
  'action1', 'action2', 'action3', 'action4',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
] as const satisfies readonly Action[];

/**
 * The two SYSTEM ones. They do not belong to the game's world: `start` pauses and resumes, `select` opens what belongs
 * to the session.
 *
 * ⚠️ AND THAT IS WHY THE ENGINE MAY NAME THEM and may not name the others. ADR-0074 forbids an abstract name reaching a
 * person because `action1` says nothing to anyone — but "start" and "select" are what has been printed on the pad
 * itself since 1983, and the child reads that legend before ours.
 */
export const SYSTEM = ['start', 'select'] as const satisfies readonly Action[];

/* ===================== THE PRESET: WHERE THE GAME'S WORDS LIVE ===================== */
//
// ⚠️ THIS IS THE OTHER SIDE OF THE CUT, and without it the list above separates nothing. The engine knows POSITIONS;
// the game knows WORDS; and someone has to say which word sits at which position. That someone is the game, and what
// it hands over is this.
//
// ⚠️ AND THE DEFECT THIS EXISTS TO FIX WAS MEASURED: the engine's input layer used to say `jump`, `run`, `swap` in over
// a hundred places — the transports could not read a pad, only a pad for THIS game. A second game that does not jump
// would rewrite the transports or inherit a vocabulary that is not its own.

/**
 * What the child reads and hears for a position: the name, and the sentence that explains it when they ask — RESOLVED, in
 * the page's language. The engine builds these from the game's KEYS (`wordsOf`) each time it draws; a game declares keys.
 */
export interface ActionWord {
  /** "Jump", "Confirm", "Place piece". NEVER `action2` — an abstract name reaching a person is a defect. */
  readonly label: string;
  /**
   * The SHORT version, for where the long one does not fit. Falls back to `label` when absent.
   *
   * ⚠️ NOT A STYLE PREFERENCE: MEASURED WIDTH. A legend puts the word under a glyph, in a row of four, where the longer
   * remap-screen wording does not fit — which is why the dictionary once had TWO families of keys for the same four
   * actions. The distinction is the game's, not the engine's, so it crosses with the words.
   *
   * ⚠️ AND THE FALLBACK TO `label` DEGRADES VISUALLY, not functionally: a game that declares no `short` gets the long
   * word squeezed, not an empty legend. Chosen because a mute legend is worse than a tight one — the first vanishes for
   * a screen reader user, the second does not.
   */
  readonly short?: string;
  /** Optional, for the remap screen: what this button does, in one sentence. */
  readonly hint?: string;
}

/**
 * What a game DECLARES for a position: the KEYS of its words in its own dictionary (`CreateGameOptions.dictionaries`).
 *
 * 🔴 KEYS AND NOT WORDS (ADR-0232 D3, erratum of 2026-09-25). A word handed over at boot is in the boot language forever:
 * 📏 measured, a preset built with `t` in Portuguese still read «Acima» after `setLocale('en')`. A key is resolved by the
 * root's translator each time the engine draws or speaks it, so changing the language changes every word at once
 * (ADR-0225), and the game never needs to know how (ADR-0216).
 */
export interface ActionKeys {
  /** The key of the name: «Jump», «Confirm». A key the game's dictionaries lack leaves the position unnamed, and `problems` says so. */
  readonly labelKey: string;
  /** The key of the SHORT name, for a legend under a glyph. Falls back to the name when absent. */
  readonly shortKey?: string;
  /** The key of the sentence that says what this button does, for the help and the remap screen. */
  readonly hintKey?: string;
}

/**
 * The vocabulary of ONE game: for each position it uses, the keys of its words.
 *
 * ⚠️ PARTIAL ON PURPOSE. A game declares ONLY the positions it uses. Requiring all fourteen would make a quiz invent a
 * name for a trigger it does not have, and an invented name ends up on a remap screen in front of a child.
 */
export type ActionPreset = Partial<Readonly<Record<Action, ActionKeys>>>;

/** A preset RESOLVED into words, in the page's language — what the engine's surfaces read (`wordsOf`). */
export type ActionWords = Partial<Readonly<Record<Action, ActionWord>>>;

/** The positions this preset names, in the canonical order of `ACTIONS`. */
export function presetActions(p: ActionPreset | ActionWords): Action[] {
  return ACTIONS.filter((a) => p[a] !== undefined);
}

/** Resolves one declared key through `word`; a key that is not text resolves to nothing. */
const resolved = (word: (key: string) => string | null, key: unknown): string | null =>
  (typeof key === 'string' && key.trim() ? word(key) : null);

/**
 * THE GAME'S KEYS, RESOLVED NOW — called at every drawing, never kept (ADR-0232 D3 erratum).
 *
 * A position whose NAME resolves to nothing is left out, so every surface treats it as unnamed — the rule `labellerFrom`
 * already applies: an absence is one step fewer, never a mute step, and never the key itself on screen.
 */
export function wordsOf(p: ActionPreset, word: (key: string) => string | null): ActionWords {
  const words: Partial<Record<Action, ActionWord>> = {};
  for (const a of presetActions(p)) {
    const keys = p[a]!;
    const label = resolved(word, keys.labelKey);
    if (!label) continue;
    const short = resolved(word, keys.shortKey);
    const hint = resolved(word, keys.hintKey);
    words[a] = { label, ...(short ? { short } : {}), ...(hint ? { hint } : {}) };
  }
  return words;
}

/**
 * The question the engine asks the game when it has to SHOW an action: "what is this called?".
 *
 * It is the cut's boundary in the shape of a function. The engine knows a position exists; only the game knows the
 * word, and this function is what crosses.
 */
export type ActionLabeller = (a: Action) => string;

/**
 * Builds the translator from a preset.
 *
 * ⚠️ AND WHAT IT DOES WITH AN UNNAMED ACTION IS THE WHOLE DECISION. Returning `action7` would put an abstract name in
 * front of a child, which ADR-0074 calls a defect in so many words. Returning empty would silence the screen reader,
 * the silent defect `speakableProblems` already chases elsewhere.
 *
 * It returns `null`, and the caller decides: the pad wizard DOES NOT ASK for an action the game does not name — if the
 * game does not use it, there is nothing to map. An absence becomes one step fewer, never a mute step. (`SYSTEM` is the
 * exception there: the wizard asks START and SELECT in its own words, since no preset may name them — ADR-0144 erratum.)
 */
export function labellerFrom(p: ActionWords): (a: Action) => string | null {
  return (a) => {
    const w = p[a];
    return w && w.label.trim() ? w.label : null;
  };
}

/**
 * The same, in the SHORT version — for a legend, where the word lives under a glyph.
 *
 * ⚠️ IT FALLS BACK TO `label`, and the fallback is the decision: a tight legend is worse than a neat one and better than
 * an empty one. Empty would also vanish for a screen reader user, which is the cost not accepted here.
 */
export function shortLabellerFrom(p: ActionWords): (a: Action) => string | null {
  return (a) => {
    const w = p[a];
    if (!w) return null;
    const short = w.short && w.short.trim() ? w.short : w.label;
    return short && short.trim() ? short : null;
  };
}

/**
 * Is a preset well formed? Returns the problems — EMPTY means conformant.
 *
 * ⚠️ WHAT IT CATCHES IS THE EMPTY KEY, the same silent defect as `speakableProblems` in `core/contract`: a blank
 * `labelKey` breaks nothing, warns nobody, and leaves the remap screen with a mute row — for a screen reader user, a button
 * that exists and has no name. Whether the key is IN the game's dictionaries is the root's question (`ui/declared-words`).
 */
export function presetProblems(p: ActionPreset | null | undefined): string[] {
  if (!p) return ['preset: missing'];
  const problemas: string[] = [];
  const named = presetActions(p);
  if (named.length === 0) problemas.push('preset: names no action - the child would see an unlabelled control');
  for (const key of Object.keys(p)) {
    if (!isAction(key)) problemas.push(`preset: ${key} is not an action`);
  }
  for (const a of named) {
    const w = p[a];
    if (!w || typeof w.labelKey !== 'string' || !w.labelKey.trim()) {
      problemas.push(`preset: ${a} has an empty labelKey - the remap screen would show a nameless button`);
    }
  }
  return problemas;
}

/**
 * `start` IS THE PAUSE'S, AND A GAME DOES NOT TAKE IT (ADR-0144 §4). Returns the reason, or `null`.
 *
 * ⚠️ THIS IS THE ONE CLAUSE OF THAT RECORD THAT ADDS A RESTRICTION instead of reusing something that was
 * already there, and it is written down — rather than discovered in a conflict — because the record asked
 * for exactly that. Since ADR-0122 the pause is not declinable, and `start` is the only position that
 * reaches it: a game that claimed it for something else would be declining the pause by the back door, and
 * the child would get four settings panels that are mounted, in the document, and unreachable.
 *
 * 📌 SEPARATE FROM `presetProblems`, and on purpose. That one answers «is this preset well formed?» and
 * nobody calls it yet (issue for the wiring); this one is a PRE-CONDITION the boot refuses on, which is a
 * different rubric — a malformed label degrades a remap screen, a stolen `start` removes the pause.
 *
 * 📌 `select` has its own sibling below, since ADR-0155 made it the door to the pause menus. Until then it stayed
 * free on purpose: refusing it would have been deciding, in advance, something nobody had decided.
 */
export function startClaimProblem(p: ActionPreset | null | undefined): string | null {
  if (!p || p.start === undefined) return null;
  return 'preset: «start» is the position that opens the pause (ADR-0144 §4) and a game may not claim it; '
    + 'use one of the eight verb positions instead (action1..action4, leftShoulder, leftTrigger, rightShoulder, rightTrigger)';
}

/**
 * `select` OPENS THE PAUSE MENUS, AND A GAME DOES NOT TAKE IT EITHER (ADR-0155 §4). Returns the reason, or `null`.
 *
 * ⚠️ The same argument as `start`, one door over: START is now the quick pause and SELECT the six-item card, so
 * a game claiming `select` would leave quitting, the number of players and the inclusion settings unreachable.
 * 📏 Measured when written: no game repository declares `select` in a preset.
 */
export function selectClaimProblem(p: ActionPreset | null | undefined): string | null {
  if (!p || p.select === undefined) return null;
  return 'preset: «select» is the position that opens the pause menus (ADR-0155 §4) and a game may not claim it; '
    + 'use one of the eight verb positions instead (action1..action4, leftShoulder, leftTrigger, rightShoulder, rightTrigger)';
}

/** Is it a known action? A boundary guard for data that came from outside (a saved map, a remap). */
export function isAction(x: unknown): x is Action {
  return typeof x === 'string' && (ACTIONS as readonly string[]).includes(x);
}

/**
 * Is a declaration of the actions a game uses well formed? Returns the problems — EMPTY means conformant.
 *
 * ⚠️ REQUIRING THE FOUR DIRECTIONS WOULD BE WRONG, and the temptation is strong: a quiz walks by `up`/`down` and uses
 * no `left`/`right`; a one-button game uses none. The game decides the set. What this checks is that the set is
 * NAMEABLE and not empty — a game with no action cannot be played, and that would otherwise fail in silence in the
 * first transport that tried to bind to nothing.
 */
export function actionSetProblems(used: readonly string[] | null | undefined): string[] {
  const p: string[] = [];
  if (!used) return ['action set: missing'];
  if (used.length === 0) return ['action set: empty - a game with no action cannot be played'];
  const unknown = used.filter((a) => !isAction(a));
  if (unknown.length) p.push(`action set: unknown action(s) ${unknown.join(', ')}`);
  if (new Set(used).size !== used.length) p.push('action set: has a repeated action');
  return p;
}
