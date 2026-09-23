// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/audio-rows-that-apply — A ROW WITH NO SUBJECT IS NOT OFFERED, AND THE ONE THAT APPLIES CARRIES THE GAME'S WORD
// (ADR-0153; ADR-0106 §5; ADR-0113 clause 3; ADR-0145).
//
// Two rows of the hearing panel, and two different ways of knowing whether this cartridge has anything to say with them:
//
//   · THE CANE. The cartridge ANSWERS for it (`acomodacoes.caneSpacing`), because whether anybody walks in this game is
//     not derivable from a contract — a board game and a platformer both have a world. When the answer is a word, the row
//     carries the GAME's word and the GAME's explanation; when it is `false`, nobody walks and the row is not offered.
//   · THE SOUND NAVIGATION. DERIVED and never asked (ADR-0153): the sonar needs a world AND a bearing, and `bearing`
//     answers `none` on `hotspots`. In a list-of-points game the sonar, the edge guard and the guide were three sliders
//     with no subject, and asking the cartridge again would let the two answers disagree.
//
// ⚠️ `hidden` ON THE ROW, and never the row out of the document, and the reason is measured: `initSettingsAudio` wires
// `#cane-div` ONCE, at boot. A row that did not exist then and that a later `mount()` brought in would arrive with no
// listener — a dead control with the look of a live one. `hidden` takes it out of the accessibility tree entirely, which
// is the «not offered» of ADR-0113 clause 3, and leaves the listener alive for the cartridge that does have it.
//
// 📌 THE ANSWERS ARRIVE AS QUESTIONS AND NOT AS A CARTRIDGE, so this module has no opinion about where they come from and
// a case can drive it without a root. It is also what keeps the derivation in the composition root, where the contract
// lives: 📏 measured on 2026-09-23, this rule asks the subject set for ONE membership, and two of the three fields that
// set is built from cannot change that answer — passing them here would be carrying weight that never does anything.

import type { AccommodationWord } from '../core/accommodations.js';

export interface AudioRowsThatApplyCtx {
  /** The host's DOM query — this module never reaches a global (ADR-0221 step 7d). */
  readonly find: <T extends Element>(selector: string) => T | null;
  /** The word this cartridge gives the cane row, or `null` when nobody walks in this game. */
  readonly caneWord: () => AccommodationWord | null;
  /** Does sound navigation have a subject here? A world AND a direction — read NOW, because a game changes between phases. */
  readonly hasNavigationSound: () => boolean;
}

/** Offers the rows this cartridge has a subject for, and hides the rest. Safe to call at every open. */
export function showOnlyRowsThatApply(ctx: AudioRowsThatApplyCtx): void {
  const row = ctx.find<HTMLElement>('#cane-div')?.closest<HTMLElement>('.ctrl-row');
  const cane = ctx.caneWord();
  if (row) {
    row.hidden = cane === null;
    // 🔴 WHAT APPLIES CARRIES THE GAME'S WORD (ADR-0153's confirmation), and BOTH halves of it. `mountAudioInside`
    // re-labels in the engine's own words at every open and this runs after it, so the game's label wins the `<strong>`
    // and the game's explanation wins the `.opt-hint` the footer reads. ⚠️ An absent hint keeps the engine's sentence:
    // «this game has nothing to add» is not «this row has nothing to say».
    const label = row.querySelector<HTMLElement>('strong');
    if (cane && label) label.textContent = cane.label;
    const hint = row.querySelector<HTMLElement>('.opt-hint');
    if (cane?.hint && hint) hint.textContent = cane.hint;
  }
  const navigation = ctx.find<HTMLElement>('#navsound-list');
  if (navigation) navigation.hidden = !ctx.hasNavigationSound();
}
