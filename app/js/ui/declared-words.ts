// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/declared-words — every KEY a game declares for its words, and the ones its own dictionaries lack (ADR-0232 D3, erratum
// of 2026-09-25; ADR-0169).
//
// A game declares its words as keys of its own dictionary — the action labels of its `preset`, the words of its
// `accommodations`, its `gameOptions` rows, its `howToPlay` slides and its `hud` numbers — and the root's translator resolves
// them each time the engine draws or speaks them. A key the dictionaries lack is never shown: what needed it is left out
// (a row not drawn, a slide skipped, a position unnamed). That absence would be silent, so it is a line of `problems`: the
// subject by name, what the child loses, and the fix.
//
// 📌 WHAT IS NOT HERE, on purpose: the declaration's `Speakable`s (`nameAt`, `objectiveOf`). They are returned by FUNCTIONS
// the engine calls at every reading, so they are never frozen at boot, and a name can be content that is not a dictionary
// word at all (the word a literacy game spells, which pillar 3 does not translate).
//
// No I/O on import: this runs in node.
import type { ActionPreset } from '../core/actions.js';
import type { AccommodationAnswers } from '../core/accommodations.js';
import type { GameOption } from './game-options.js';
import type { HowToPlaySlide } from './help-panel.js';
import type { HudNumber } from './hud-bands.js';

/** The game's fields that carry declared words — a `Pick` of `CreateGameOptions`, written here so `ui` does not import `boot`. */
interface DeclaredWords {
  readonly preset?: ActionPreset;
  readonly accommodations?: AccommodationAnswers;
  readonly gameOptions?: readonly GameOption[];
  readonly howToPlay?: readonly HowToPlaySlide[];
  readonly hud?: readonly HudNumber[];
}

/** One declared key: where it was declared, the key (whatever was written there), and what the child loses without it. */
interface DeclaredKey {
  readonly subject: string;
  readonly key: unknown;
  readonly cost: string;
  /** An optional key may be absent; a name may not. */
  readonly optional: boolean;
}

const ACTION_NAME = 'the child sees this button unnamed: the help, the remap screen, the pad and the scan leave it out';
const ACTION_SHORT = 'the pad shows the long name squeezed under the glyph';
const ACTION_HINT = 'the help shows this button without its sentence';
const ACCOMMODATION_NAME = 'this accommodation has its row left out, and the child who needs it cannot reach it';
const ACCOMMODATION_SHORT = 'where only a short name fits, the long one is squeezed';
const ACCOMMODATION_HINT = 'the row explains itself in the engine\'s general words, or not at all';
const OPTION_NAME = 'this option has its row left out, and the child cannot change it';
const OPTION_HINT = 'the row shows without its explanation';
const SLIDE_TEXT = 'this slide is left out of the help';
const HUD_NAME = 'this number is hidden from the child';

function presetKeys(preset: ActionPreset | undefined): DeclaredKey[] {
  if (!preset) return [];
  return Object.entries(preset).flatMap(([action, keys]) => (keys ? [
    { subject: `preset.${action}.labelKey`, key: keys.labelKey, cost: ACTION_NAME, optional: false },
    { subject: `preset.${action}.shortKey`, key: keys.shortKey, cost: ACTION_SHORT, optional: true },
    { subject: `preset.${action}.hintKey`, key: keys.hintKey, cost: ACTION_HINT, optional: true },
  ] : []));
}

function accommodationKeys(answers: AccommodationAnswers | undefined): DeclaredKey[] {
  if (!answers) return [];
  return Object.entries(answers).flatMap(([accommodation, keys]) => (keys ? [
    { subject: `accommodations.${accommodation}.labelKey`, key: keys.labelKey, cost: ACCOMMODATION_NAME, optional: false },
    { subject: `accommodations.${accommodation}.shortKey`, key: keys.shortKey, cost: ACCOMMODATION_SHORT, optional: true },
    { subject: `accommodations.${accommodation}.hintKey`, key: keys.hintKey, cost: ACCOMMODATION_HINT, optional: true },
  ] : []));
}

function optionKeys(options: readonly GameOption[] | undefined): DeclaredKey[] {
  return (options ?? []).flatMap((o) => [
    { subject: `gameOptions «${o.id}».labelKey`, key: o.labelKey, cost: OPTION_NAME, optional: false },
    { subject: `gameOptions «${o.id}».hintKey`, key: o.hintKey, cost: OPTION_HINT, optional: true },
    ...(o.kind === 'switch' ? [] : o.values.map((v) => (
      { subject: `gameOptions «${o.id}».values «${v.value}».labelKey`, key: v.labelKey, cost: OPTION_NAME, optional: false }))),
  ]);
}

function slideKeys(slides: readonly HowToPlaySlide[] | undefined): DeclaredKey[] {
  return (slides ?? []).map((s, i) => ({ subject: `howToPlay[${i}].textKey`, key: s.textKey, cost: SLIDE_TEXT, optional: false }));
}

function hudKeys(numbers: readonly HudNumber[] | undefined): DeclaredKey[] {
  return (numbers ?? []).map((n, i) => ({ subject: `hud[${i}].nameKey`, key: n.nameKey, cost: HUD_NAME, optional: false }));
}

/** What is wrong with ONE declared key, or `null`: it must be text, and it must be in the game's dictionaries. */
function keyProblem(k: DeclaredKey, declares: (key: string) => boolean): string | null {
  if (k.optional && k.key === undefined) return null;
  const fix = 'add it to CreateGameOptions.dictionaries, in pt, en and es';
  if (typeof k.key !== 'string' || !k.key.trim()) {
    return `${k.subject} is not a key (since ADR-0232 D3 a game declares the KEY of each word, never the word): ${k.cost} — name a key, and ${fix}`;
  }
  return declares(k.key) ? null : `${k.subject} «${k.key}» is in none of this game's dictionaries: ${k.cost} — ${fix}`;
}

/**
 * THE DECLARED KEYS THIS GAME'S DICTIONARIES LACK, one line each for `problems` (ADR-0169). `declares` is the root's
 * translator's (`Translator.declares`): a key in ANY language counts as present, because a key given in one language and not
 * another is already a line of its own (`Translator.dictionaryGaps`).
 */
export function missingDeclaredKeys(declared: DeclaredWords, declares: (key: string) => boolean): string[] {
  return [
    ...presetKeys(declared.preset),
    ...accommodationKeys(declared.accommodations),
    ...optionKeys(declared.gameOptions),
    ...slideKeys(declared.howToPlay),
    ...hudKeys(declared.hud),
  ].map((k) => keyProblem(k, declares)).filter((line): line is string => line !== null);
}
