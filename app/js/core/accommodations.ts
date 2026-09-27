// SPDX-License-Identifier: AGPL-3.0-or-later
// core/accommodations — THE ACCOMMODATION CATALOGUE. The closed vocabulary of what the engine can adapt.
//
// ========================= WHAT THIS IS =========================
// ADR-0145 decided that the catalogue is GENERAL and that a game declares which entries have a subject in it,
// with its own words — «this record is that contract [`ActionPreset`] one level up». This module is the list
// and the partial map over it, and nothing else: zero imports, zero I/O, importable from both sides of the
// engine boundary. It is `core/actions.ts` copied shape for shape, on purpose.
//
// ========================= WHERE THE LIST COMES FROM =========================
// Not from what the engine happened to build. It is the catalogue of the study
// `docs/1-Discovery/study-accommodations-by-genre.md` — 380 games in 35 categories, keyed one accommodation at
// a time (section 0.1) and cross-checked against all 105 Game Accessibility Guidelines (section 0.2). The
// study scripts keep Portuguese ids; `tests/accommodations.node.test.js` ties the two by family size, so an
// accommodation added to one and not the other fails a gate instead of drifting.
//
// ========================= THE THREE FAMILIES — the study's finding, as types =========================
// What decides whether an accommodation has a SUBJECT in a game is not always the genre. Keyed one by one, the
// catalogue fell into three families, and they need three different answers from the engine:
//
//   · GENERAL — there is text, sound, a screen and a menu in every game. The engine mounts these always.
//   · CONTRACT_KEYED — the subject is answered by a declaration the contract ALREADY asks every game
//     (`tick`, `holdsKeys()`, `needsPointer()`, `world()` × `topology()`, the players list). The engine can
//     derive these without a genre, by the rule the engine keeps for what a contract already answers: absent ⇒ derive from the contract.
//   · GAME_KEYED — nothing the engine holds answers it (genre, perspective, avatar, text, pieces, timing).
//     The game — or the template of its genre — declares it.
//
// ⚠️ Being in the catalogue is NOT being built. `macros` is here and no writer exists; the row mounts when
// the action works, and not before (ADR-0106 §5). The catalogue names what can be asked for.

/** Every accommodation the engine knows by name. None of these ids is a word a child reads. */
export const ACCOMMODATIONS = [
  // — general —
  'typography', 'letterCase', 'narration', 'spokenMenuIndex', 'signLanguage', 'soundMix',
  'hearingLossSimulation', 'highContrast', 'colorVisionCorrection', 'reducedSceneMotion', 'remapControls',
  'targetSize', 'controlsHelp', 'objectiveReminder', 'repeatInstruction', 'soundCaptions', 'screenReader',
  'monoAudio', 'interfaceScale', 'interfaceLayout', 'difficulty', 'skipSection', 'settingsProfiles',
  // — keyed by the contract —
  'visionSimulation', 'audioDescription', 'virtualPad', 'oneButton', 'inputCooldown', 'macros', 'gameSpeed',
  'blindMode', 'navigationSound', 'moveLatch', 'holdLatch', 'pointerSmoothing', 'pointerSensitivity',
  'pointerStyle', 'perPlayerAudioOutput',
  // — keyed by the game —
  'cameraSway', 'easyMode', 'wheelchairMode', 'detectionLeniency', 'intensity', 'hints',
  'reducedCharacterMotion', 'caneSpacing', 'textPace', 'lexicalDifficulty', 'wordHighlight', 'pieceSets',
  'distinguishableSuits', 'timingWindow', 'aimAssist', 'repeatedInput',
  // ADR-0188, the Dev: «Criar os dois assuntos.» Only the game knows whether items have an owner, or a drawing to outline.
  'ownerColors', 'contrastOutlines',
] as const;

export type Accommodation = (typeof ACCOMMODATIONS)[number];

/**
 * Subject in EVERY game: there is text, sound, a screen, a menu and a way to confirm in all of them.
 *
 * 📌 `difficulty`, `skipSection` and `objectiveReminder` are here although the engine cannot make a game
 * easier: what it can do is keep, persist and announce the choice, and the game reads it. The GAG asks for
 * difficulty at Basic level, and «wide choice of difficulty levels» has a subject in any game with a goal.
 */
export const GENERAL = [
  'typography', 'letterCase', 'narration', 'spokenMenuIndex', 'signLanguage', 'soundMix',
  'hearingLossSimulation', 'highContrast', 'colorVisionCorrection', 'reducedSceneMotion', 'remapControls',
  'targetSize', 'controlsHelp', 'objectiveReminder', 'repeatInstruction', 'soundCaptions', 'screenReader',
  'monoAudio', 'interfaceScale', 'interfaceLayout', 'difficulty', 'skipSection', 'settingsProfiles',
] as const satisfies readonly Accommodation[];

/**
 * Subject answered by something the contract ALREADY asks, so the engine can derive it with no genre:
 *
 *   · `gameSpeed` ← `tick === 'clock'` (WCAG 2.2.1; the GAG's Basic «adjust the game speed»)
 *   · `moveLatch`, `holdLatch` ← `holdsKeys()` and the positions the preset declares
 *   · `virtualPad`, `oneButton`, `inputCooldown`, `macros` ← action input (`needsPointer()` false)
 *   · `pointerSmoothing`, `pointerSensitivity`, `pointerStyle` ← `needsPointer()` true
 *   · `visionSimulation`, `audioDescription` ← `world().kind === 'element'`
 *   · `blindMode`, `navigationSound` ← a world AND a direction: `bearing` is `none` on `hotspots`
 *   · `perPlayerAudioOutput` ← more than one entry in `CreateGameOptions.players`
 */
export const CONTRACT_KEYED = [
  'visionSimulation', 'audioDescription', 'virtualPad', 'oneButton', 'inputCooldown', 'macros', 'gameSpeed',
  'blindMode', 'navigationSound', 'moveLatch', 'holdLatch', 'pointerSmoothing', 'pointerSensitivity',
  'pointerStyle', 'perPlayerAudioOutput',
] as const satisfies readonly Accommodation[];

/**
 * Subject nothing in the engine can answer: the game declares it.
 *
 * ⚠️ `easyMode` and `wheelchairMode` are PLATFORM vocabulary — lower gravity, coins on the ground, no jump —
 * and that is why they sit here and not in GENERAL: in a chess game they are switches with no subject, the
 * exact defect ADR-0145 was written about.
 */
export const GAME_KEYED = [
  'cameraSway', 'easyMode', 'wheelchairMode', 'detectionLeniency', 'intensity', 'hints',
  'reducedCharacterMotion', 'caneSpacing', 'textPace', 'lexicalDifficulty', 'wordHighlight', 'pieceSets',
  'distinguishableSuits', 'timingWindow', 'aimAssist', 'repeatedInput',
  'ownerColors', 'contrastOutlines',
] as const satisfies readonly Accommodation[];

/* ===================== THE PRESET: WHERE A GAME'S WORDS LIVE ===================== */

/**
 * What the child reads and hears for an accommodation: the name, and the sentence that explains it — RESOLVED, in the page's
 * language. A cartridge's ANSWER declares keys (`AccommodationKeys`), and `subjectWord` resolves them at every drawing.
 */
export interface AccommodationWord {
  /** «Wheelchair mode», «Board pieces». NEVER `wheelchairMode` — an id that reaches a person is a defect. */
  readonly label: string;
  /** The SHORT form, for where the long one does not fit. Falls back to `label` when absent. */
  readonly short?: string;
  /** Optional: what this setting does, in one sentence — the footer text of the menu row (`CLAUDE.md` §4). */
  readonly hint?: string;
}

/**
 * One game's vocabulary: for each accommodation it names, its word.
 *
 * ⚠️ PARTIAL ON PURPOSE, as `ActionPreset` is. Requiring all entries would make a quiz invent a word for a
 * wheelchair it has no concept of, and an invented word ends up in a menu in front of a child.
 *
 * 📌 A game's OWN accommodation — one the catalogue does not contain (ADR-0145 §2) — is not declared here: a
 * closed record cannot hold it, and that is what keeps an id typo from passing as an addition. The addition
 * has its own place in the declaration (phase 2c).
 */
export type AccommodationPreset = Partial<Readonly<Record<Accommodation, AccommodationWord>>>;

/** Is it a known accommodation? Boundary guard for data that came from outside (a saved setting, a game). */
export function isAccommodation(x: unknown): x is Accommodation {
  return typeof x === 'string' && (ACCOMMODATIONS as readonly string[]).includes(x);
}

/** The accommodations this preset names, in the canonical order of `ACCOMMODATIONS`. */
export function presetAccommodations(p: AccommodationPreset): Accommodation[] {
  return ACCOMMODATIONS.filter((a) => p[a] !== undefined);
}

/**
 * The question the engine asks a game when it must SHOW an accommodation: «what is this called here?».
 *
 * ⚠️ Returns `null` for an entry the game does not name, never the id — the `labellerFrom` rule. Whoever calls
 * decides; for a GAME_KEYED entry the answer is not to mount the row, because a game that has no word for it
 * has no subject for it either.
 */
export function accommodationLabellerFrom(p: AccommodationPreset): (a: Accommodation) => string | null {
  return (a) => {
    const w = p[a];
    return w && w.label.trim() ? w.label : null;
  };
}

/**
 * Is a preset well formed? Returns the problems — EMPTY means conformant.
 *
 * ⚠️ AN ABSENT PRESET IS NOT A PROBLEM, and that is the difference from `presetProblems`. A game with no
 * action cannot be played; a game that names no accommodation still gets every GENERAL one in the engine's
 * words. What IS a problem is the silent kind: a blank label (a row with no name for a screen reader) and an
 * unknown key (a typo that would vanish instead of mounting — or a game's own accommodation put in the wrong
 * place, which the message says).
 */
export function accommodationPresetProblems(p: AccommodationPreset | null | undefined): string[] {
  if (p === null || p === undefined) return [];
  if (!isKeyed(p)) return [NOT_KEYED];
  const strangers = Object.keys(p).filter((key) => !isAccommodation(key)).map((key) =>
    `accommodations: «${key}» is not in the catalogue - a game's own accommodation is an addition (ADR-0145 §2), not a preset entry`);
  const nameless = presetAccommodations(p).filter((a) => !isWord(p[a])).map((a) =>
    `accommodations: ${a} has an empty label - the menu would show a nameless row`);
  return [...strangers, ...nameless];
}

const NOT_KEYED = 'accommodations: must be an object keyed by accommodation';

/** An object keyed by name, and not a list: the one shape a preset and an answer both take. */
function isKeyed(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A WORD: an object whose label is text and not blank — a row that mounts must have a name to show. */
function isWord(v: unknown): boolean {
  return !!v && typeof v === 'object' && typeof (v as { label?: unknown }).label === 'string'
    && (v as { label: string }).label.trim() !== '';
}

/* ===================== THE CARTRIDGE'S ANSWER (ADR-0153) ===================== */

/** The accommodations only the game can answer. */
export type GameKeyedAccommodation = (typeof GAME_KEYED)[number];

/**
 * What a cartridge DECLARES for an accommodation it has a subject for: the KEYS of its words in its own dictionary
 * (`CreateGameOptions.dictionaries`). Keys and not words, so the row follows a language change (ADR-0232 D3, erratum of
 * 2026-09-25; the rule and its measured defect are written on `core/actions.ActionKeys`).
 */
export interface AccommodationKeys {
  /** The key of the name: «Wheelchair mode», «Board pieces». */
  readonly labelKey: string;
  /** The key of the SHORT form. Falls back to the name when absent. */
  readonly shortKey?: string;
  /** The key of the sentence the menu row explains itself with, in the footer (`CLAUDE.md` §4). */
  readonly hintKey?: string;
}

/**
 * THE CARTRIDGE'S ANSWER, for every GAME_KEYED accommodation: the KEYS of its word when the accommodation has a subject in
 * this game, or `false` when it has none.
 *
 * 🔴 COMPLETE, NOT PARTIAL — and that is the difference from `AccommodationPreset`, and the decision. The Dev:
 * «Gênero não precisa responder todas as acomodações, mas sim o cartucho, obrigatoriamente.» A partial map lets
 * SILENCE answer, and silence here decides for the child: it would mount a wheelchair in chess, or hide one from a
 * platformer, with nothing anywhere to say which. So a missing key is not «no»; it is a malformed declaration.
 *
 * 📌 `false` and not `null`/absence, so a «no» is always something somebody wrote. GENERAL accommodations mount
 * always and CONTRACT_KEYED ones are derived from the contract, so neither is asked here — asking twice would let
 * the two answers disagree.
 */
export type AccommodationAnswers = Readonly<Record<GameKeyedAccommodation, AccommodationKeys | false>>;

/** Is it one of the accommodations the cartridge must answer? */
export function isGameKeyed(x: unknown): x is GameKeyedAccommodation {
  return typeof x === 'string' && (GAME_KEYED as readonly string[]).includes(x);
}

/**
 * Is the cartridge's answer well formed? Returns the problems — EMPTY means conformant.
 *
 * ⚠️ UNLIKE `accommodationPresetProblems`, AN ABSENT ANSWER IS A PROBLEM: the answer is mandatory (ADR-0153), and a
 * boot that accepted its absence would be the optional field the Dev refused. The messages go to whoever INTEGRATES
 * the engine; each one names the accommodation and what to write.
 */
export function accommodationAnswersProblems(a: unknown): string[] {
  if (a === null || a === undefined) {
    return ['accommodations: missing - the cartridge must answer every game-keyed accommodation (ADR-0153): the keys of its word, or false'];
  }
  if (!isKeyed(a)) return [NOT_KEYED];
  const unanswered = GAME_KEYED.map((k) => answerProblem(a, k)).filter((p): p is string => p !== null);
  const strangers = Object.keys(a).filter((k) => !isGameKeyed(k)).map((k) => (isAccommodation(k)
    ? `accommodations: ${k} is not the cartridge's to answer - general ones mount always and contract ones are derived`
    : `accommodations: «${k}» is not in the catalogue - a game's own accommodation is an addition (ADR-0145 §2)`));
  return [...unanswered, ...strangers];
}

/** What is wrong with the cartridge's answer to ONE accommodation, or `null`: it must be written, and be `false` or keys. */
function answerProblem(answers: Record<string, unknown>, k: GameKeyedAccommodation): string | null {
  if (!(k in answers)) return `accommodations: ${k} is not answered - write the keys of its word if it has a subject in this game, or false`;
  const v = answers[k];
  return v === false || isDeclared(v) ? null : `accommodations: ${k} must be false or { labelKey } naming a key of the game's dictionary`;
}

/** DECLARED KEYS: an object whose `labelKey` is text and not blank, and whose optional keys are text when present. */
function isDeclared(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const { labelKey, shortKey, hintKey } = v as Record<string, unknown>;
  const optionalKey = (k: unknown): boolean => k === undefined || typeof k === 'string';
  return typeof labelKey === 'string' && labelKey.trim() !== '' && optionalKey(shortKey) && optionalKey(hintKey);
}

/**
 * Does this accommodation have a subject in this game — and what is it called NOW? The question a panel asks before
 * mounting a row, at every drawing.
 *
 * 📌 It returns the WORD, resolved through `word` (the root's translator, ADR-0232 D3), or `null` — never the id, never the
 * key, never `true`: a row that mounts must have a name to show, and «has a subject» without a word is the `action2` defect
 * one level up. A key the game's dictionaries lack is `null` here and a line of `problems` (`ui/declared-words`).
 */
export function subjectWord(
  answers: AccommodationAnswers,
  k: GameKeyedAccommodation,
  word: (key: string) => string | null,
): AccommodationWord | null {
  const v = answers[k];
  if (!v) return null;
  const label = word(v.labelKey);
  if (!label || !label.trim()) return null;
  const short = v.shortKey ? word(v.shortKey) : null;
  const hint = v.hintKey ? word(v.hintKey) : null;
  return { label, ...(short ? { short } : {}), ...(hint ? { hint } : {}) };
}
