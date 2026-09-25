// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/aac-sets.ts — THE AUGMENTATIVE AND ALTERNATIVE COMMUNICATION CATALOGUE (ADR-0233, which replaces ADR-0028's roster
// and tiers). Leaf module: pure data and a few predicates, zero DOM, zero I/O. ui/settings-aac draws the menu; this file
// decides what it offers, because the decision is about LICENSING and not about interface.
//
// WHO THIS EXISTS FOR: there are children who read symbols and not letters. For them, a pictogram is neither
// decoration nor a crutch — it is writing. An educational game that can only show letters does not speak to them.
//
// THE RULE THAT ORGANISES THE LIST (ADR-0233): only two sets are candidates, ARASAAC and PCS, and each only ONCE A LICENCE
// IS OBTAINED. No licence exists today, so officially no set is used — and the AAC menu's door is DISABLED, saying only
// that it is disabled, with no licence explanation (ADR-0233 erratum; `aacMenuLocked`). The two sets and their «no
// licence» rows stay in the catalogue for the panel, which no child reaches until a set is licensed.
//
// `tier` is the whole legal fact, in two values: a set is LICENSED (a licence is recorded, the set may be chosen) or it
// is not (it is shown locked, with the reason). ARASAAC's CC BY-NC-SA terms do not make it licensed: the project uses it
// only with a licence, not by asking the player to download it (ADR-0233). The gate that holds this — a set with no
// recorded licence can never be selectable — is `tests/aac-sets.node.test.js`.
import type { Translate } from '../core/i18n.js';

export type AacTier =
  /** A licence is RECORDED in `license`: the set may be chosen. */
  | 'licensed'
  /** No licence: the set appears in the menu, locked, with the reason. */
  | 'unlicensed';

interface AacSetBase {
  readonly key: string;
  readonly name: string;
  /** Pictograms only: one line about the origin, when it changes what the choice means. */
  readonly note?: string;
}

/**
 * A pictogram set. The tier and the licence travel together BY TYPE: a licensed set names its licence (short text, to
 * fit on screen), and an unlicensed one has none to name.
 */
export type AacSet =
  | (AacSetBase & { readonly tier: 'licensed'; readonly license: string })
  | (AacSetBase & { readonly tier: 'unlicensed'; readonly license: null });

// LETTERS ARE NOT IN THIS LIST, and the absence is the Dev's decision: letter case is ONE switch (upper case, on or
// off, with off meaning both cases), not two entries. A binary choice presented as two options makes the child compare
// two rows to discover they are the same question; a switch asks once.
//
// What remains here is genuinely a LIST: the pictogram sets, of which one is chosen. «PCS» is the Picture Communication
// Symbols set (ADR-0233 reads the Dev's «PECS» as PCS: PECS is a teaching method, not a symbol set).
export const AAC_SETS: readonly AacSet[] = [
  { key: 'arasaac', name: 'ARASAAC', tier: 'unlicensed', license: null },
  { key: 'pcs', name: 'PCS', tier: 'unlicensed', license: null },
];

export const AAC_BY_KEY: Readonly<Record<string, AacSet>> = Object.fromEntries(AAC_SETS.map((s) => [s.key, s]));

/** Can the child choose this set? Only when it is licensed — the tier is the one fact the menu reads. */
export function aacSelectable(s: AacSet): boolean {
  return s.tier === 'licensed';
}

/** Which SETS the child can choose today: none, because no licence has been obtained (ADR-0233). */
export function aacAvailable(): AacSet[] {
  return AAC_SETS.filter(aacSelectable);
}

/**
 * Is the AAC menu's DOOR disabled? Yes while no set is licensed (ADR-0233 erratum): the menu exists for pictogram
 * exercises and a pictogram keyboard, and with no set it has nothing to offer. The door then says only that the menu is
 * disabled (`pause.motivo.caa`) — never the licence reason. Letter case does not wait for it: it lives in the quick bar's
 * communication cycle (ADR-0151).
 */
export function aacMenuLocked(): boolean {
  return aacAvailable().length === 0;
}

/**
 * Why this set cannot be chosen — an i18n key, never finished text. One answer, because there is one reason: no
 * licence. A selectable set has nothing to explain.
 */
export function aacReason(s: AacSet): string | null {
  return aacSelectable(s) ? null : 'aac.noLicence';
}

/** A label ready for the menu row: the name + the reason, when there is one. */
export function aacLabel(t: Translate, s: AacSet): string {
  const reason = aacReason(s);
  return reason ? `${s.name} — ${t(reason)}` : s.name;
}
