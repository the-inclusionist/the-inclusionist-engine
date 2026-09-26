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

/**
 * A language's name, written in another language: `languageName('en-GB', 'pt-BR')` is «inglês» — the primary language, because a
 * voice of the same language would have read the part (ADR-0243 §3). Where the platform cannot name it, the tag's language code.
 */
export function languageName(tag: string, inLanguage: string): string {
  const code = primaryLanguage(tag);
  try { return new Intl.DisplayNames([inLanguage], { type: 'language' }).of(code) ?? code; } catch { return code; }
}

/** Does a voice tagged `locale` speak the language of `tag`? By the primary language, as `voicesForLocale` matches. */
export function speaksLanguageOf(locale: string, tag: string): boolean {
  return primaryLanguage(locale) === primaryLanguage(tag);
}

/** The engine of a browser (Web Speech) voice in a list; every other engine is neural (ADR-0200). */
const BROWSER_ENGINE = 'webspeech';

/** One step of the voice order: which voices of a list it takes, for a part in `tag`. */
type VoiceStep = (voice: NeuralVoice, tag: string) => boolean;
const browser = (v: NeuralVoice): boolean => v.engine === BROWSER_ENGINE;
const exactTag = (v: NeuralVoice, tag: string): boolean => v.locale.toLowerCase() === tag.toLowerCase();

/**
 * THE VOICE ORDER (ADR-0243 §2, errata 2026-09-26 — the Dev: «Se a do navegador (mais leve) pode ser usada, a do navegador, senão
 * ganha a voz neural (backup)»), after the child's chosen voice: a BROWSER voice that can read the tag, then a NEURAL one. Every
 * step is tried over the whole list, in order; within a step the list's own order decides.
 * ⏸ THE REGION QUESTION IS OPEN (same erratum): does a pt-PT browser voice read a pt-BR part before the neural pt-BR voice? The line
 * marked below answers «yes» — within the browser voices, the exact tag and then the same primary language, as before. Should the
 * Dev answer «no», that line moves below the neural exact tag, and nothing else changes.
 */
const VOICE_ORDER: readonly VoiceStep[] = [
  (v, tag) => browser(v) && exactTag(v, tag),
  (v) => browser(v), // ⏸ the region question: a browser voice of the same language, another region
  (v, tag) => !browser(v) && exactTag(v, tag),
  (v) => !browser(v),
];

/**
 * THE VOICE OF A LANGUAGE (ADR-0243 §2): the child's chosen voice when it speaks that language; else the first voice `VOICE_ORDER`
 * reaches — a browser voice before a neural one. `chosen` comes in order of precedence.
 * 🔴 No voice of another language is ever returned: `null` means the list has none for it, and the part is not spoken (§3).
 */
export function voiceOfLanguage(
  tag: string, voices: readonly NeuralVoice[], chosen: readonly (string | null | undefined)[] = [],
): NeuralVoice | null {
  const own = voicesForLocale(tag, voices);
  for (const id of chosen) {
    const picked = id ? own.find((v) => v.voice === id) : undefined;
    if (picked) return picked;
  }
  for (const step of VOICE_ORDER) {
    const found = own.find((v) => step(v, tag));
    if (found) return found;
  }
  return null;
}
