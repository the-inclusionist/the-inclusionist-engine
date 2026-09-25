// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/aac-sets.ts — THE AUGMENTATIVE AND ALTERNATIVE COMMUNICATION CATALOGUE (ADR-0028). Leaf module: pure data and
// two predicates, zero DOM, zero I/O. ui/settings-aac draws the menu; this file decides what it offers, because the
// decision is about LICENSING and not about interface.
//
// WHO THIS EXISTS FOR: there are children who read symbols and not letters. For them, a pictogram is neither
// decoration nor a crutch — it is writing. An educational game that can only show letters does not speak to them.
//
// THE RULE THAT ORGANISES THE LIST: each set's tier is decided by ITS LICENCE and nothing else — not quality, not
// size, not ease of integration. The moment a set changes tier for another reason, this file stops being true.
//
// `tier` is the LEGAL FACT (may we redistribute? must it be downloaded? is permission missing?). `available` is
// TODAY's FACT (does it work in this build?). They are two different questions and the menu needs both: the first
// says who has to act, the second says what the child can choose now.
import type { Translate } from '../core/i18n.js';

export type AacTier =
  /** CC BY-SA or ours: it may travel inside the game and works with no network at all. */
  | 'bundled'
  /** The licence allows use, not redistribution: the person downloads it, once, and it stays cached. */
  | 'fetched'
  /** Permission is missing. It appears in the menu and is not selectable. */
  | 'negotiating';

export interface AacSet {
  readonly key: string;
  readonly name: string;
  readonly tier: AacTier;
  /** The licence as it was VERIFIED, or null when there is none yet. Short text, to fit on screen. */
  readonly license: string | null;
  /** Does it work IN THIS build? The pictograms are files that have not arrived yet. */
  readonly available: boolean;
  /** Pictograms only: one line about the origin, when it changes what the choice means. */
  readonly note?: string;
}

// LETTERS ARE NOT IN THIS LIST, and the absence is the Dev's decision: letter case is ONE switch (upper case, on or
// off, with off meaning both cases), not two entries. A binary choice presented as two options makes the child compare
// two rows to discover they are the same question; a switch asks once.
//
// What remains here is genuinely a LIST: the pictogram sets, of which one is chosen.
export const AAC_SETS: readonly AacSet[] = [
  // --- PICTOGRAMS that MAY travel with the game (CC BY-SA, verified by the Dev). ---
  { key: 'mulberry', name: 'Mulberry Symbols', tier: 'bundled', license: 'CC BY-SA', available: false },
  { key: 'blissymbolics', name: 'Blissymbolics', tier: 'bundled', license: 'CC BY-SA 4.0', available: false,
    note: 'Escrita simbólica própria: os símbolos se combinam para formar sentidos novos.' },
  { key: 'tawasol', name: 'Tawasol', tier: 'bundled', license: 'CC BY-SA 4.0', available: false,
    note: 'Desenhado na e para a cultura árabe. Um pictograma não é neutro — a criança reconhece mais depressa os objetos, as roupas e os rostos do próprio mundo.' },

  // --- PICTOGRAMS that must be DOWNLOADED. ---
  { key: 'arasaac', name: 'ARASAAC', tier: 'fetched', license: 'baixado à parte', available: false },

  // --- AWAITING NEGOTIATION. Visible on purpose: see `aacReason`. ---
  { key: 'sclera', name: 'Sclera', tier: 'negotiating', license: null, available: false },
  { key: 'pcs', name: 'PCS', tier: 'negotiating', license: null, available: false },
  { key: 'symbolstix', name: 'SymbolStix', tier: 'negotiating', license: null, available: false },
  { key: 'widgit', name: 'Widgit Symbols', tier: 'negotiating', license: null, available: false },
];

export const AAC_BY_KEY: Readonly<Record<string, AacSet>> = Object.fromEntries(AAC_SETS.map((s) => [s.key, s]));

/** Which SETS the child can choose today: none. The menu does not pretend otherwise — the pictograms are thousands
 *  of files that have not entered the repository, and four of the sets depend on negotiation. */
export function aacAvailable(): AacSet[] {
  return AAC_SETS.filter((s) => s.available);
}

/**
 * Why this set is not available — an i18n key, never finished text.
 *
 * The two answers tell the reader different things, which is why there are two: "in preparation" means the licence
 * is settled and the work is OURS; "awaiting negotiation" means the permission belongs to SOMEONE ELSE and no effort
 * of ours brings it forward.
 *
 * And that is why the unavailable ones are shown instead of hidden: they are exactly the sets a Brazilian school is
 * most likely to already use in another product. The educator who looks for PCS and does not find it concludes the
 * game cannot do it — when the obstacle is a licence, not a capability. Hiding would answer the wrong question, and
 * answer it wrongly.
 */
export function aacReason(s: AacSet): string | null {
  if (s.available) return null;
  return s.tier === 'negotiating' ? 'aac.aguardandoNegociacao' : 'aac.emPreparo';
}

/** A label ready for the menu row: the name + the reason, when there is one. */
export function aacLabel(t: Translate, s: AacSet): string {
  const reason = aacReason(s);
  return reason ? `${s.name} — ${t(reason)}` : s.name;
}
