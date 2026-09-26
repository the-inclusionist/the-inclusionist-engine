// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/voice-plan.ts — the shape of a voice a child may pick, and which of them speak a language (ADR-0185).
//
// 📌 The engine owns no neural voice catalogue of its own (ADR-0207) and Kokoro's voices come through the
// game's port (`platform/kokoro`, ADR-0198). What stays here is the rule every list obeys — the browser's and Kokoro's.

/** A voice a child may pick. `voice` is its identifier in its engine; `engine` is the engine that reads it. */
export interface NeuralVoice {
  readonly locale: string;
  readonly engine: string;
  readonly voice: string;
}

/**
 * The voices a child may pick for a language (ADR-0185): matched on the LANGUAGE of the tag, not the region — a Mexican
 * voice reads Spanish from Spain, and a Brazilian game tagged `pt` is still Portuguese. A voice reading another language
 * is not offered: Portuguese text through English phonemes is noise.
 */
export function voicesForLocale(tag: string, catalogue: readonly NeuralVoice[]): readonly NeuralVoice[] {
  return catalogue.filter((v) => speaksLanguageOf(v.locale, tag));
}

/** The primary language of a BCP-47 tag, lower case: `pt` of `pt-BR`. A browser's `en_US` is normalised by whoever reads it. */
const primaryLanguage = (tag: string): string => (tag.split('-')[0] ?? '').toLowerCase();

/** Does a voice tagged `locale` speak the language of `tag`? By the primary language, as `voicesForLocale` matches. */
export function speaksLanguageOf(locale: string, tag: string): boolean {
  return primaryLanguage(locale) === primaryLanguage(tag);
}
