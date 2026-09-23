// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/audio-choices — WHAT THE AUDIO PANELS OFFER, computed without a document (ADR-0221; issue #203).
//
// The sound categories and their volumes, the cane's tap spacing, the speech engines, the system voices and the audio
// outputs: each one answered as a value or a string, with no `document`, no ctx and no state. `ui/settings-audio` keeps the
// other half — finding the thirteen controls, wiring them and reflecting what the child chose.
//
// 🔴 AND THE SUITE HAD ALREADY MADE THIS CUT, which is what made it obvious. `tests/settings-audio.node.test.js` imported
// exactly these fifteen names and nothing else, while `settings-audio.browser.test.js` drove the DOM half: the file was two
// modules wearing one name, and the only place that said so was the test folder. 📏 The module it left was 568 lines and 112
// decision nodes, the third largest in the engine.
//
// 📌 WHY IT IS `ui/` AND NOT `core/`: half of these resolve i18n KEYS (`t`) into the words a child reads, and a label is
// interface. What is genuinely free of language — the category lists and the volume arithmetic — stays here beside the rest
// rather than being split again for the sake of a layer.

import { t } from '../core/i18n.js';

/** `lbl` is an i18n key (a key missing from the dictionaries is shown as written). */
export interface AudioCatDef { k: string; lbl: string; }
export interface AudioCatState { on: boolean; vol: number; }

/** The SOUND-NAVIGATION categories (cane/sonar/guard/guide) — their master volume is separate from the game's sound. */
export const NAV_CATS = ['sonar', 'guard', 'guide'] as const;
/** The game's GENERAL categories (TTS lives in the Voice section, outside this list). */
// ⚠️ THEY BELONG TO THE «AUDIO» PANEL since ADR-0151, not to the hearing one: what is taste (music, ambience) does not live
// beside what is accessibility (sonar, guard, guide). And `other` left — it controlled no sound at all.
export const GEN_CATS = ['music', 'ambient', 'interact', 'earcons'] as const;

/** 0..1 -> 0..100 rounded (slider display value). */
export function volPercent(v: number): number {
  return Math.round(v * 100);
}

/*
 * 🔴 `catRowHTML` E `catsListHTML` SAÍRAM (BREAKING, nota BV): a lista de categorias do painel auditivo passou a
 * ser montada em NÓS (ADR-0129), e uma construtora de markup sem consumidor é dívida publicada — não muda de
 * morada, apaga-se. O que ela dizia continua dito, num sítio onde a linha também se RECONCILIA em vez de
 * renascer: `ui/settings-audio.buildCatRow`.
 *
 * 📌 E não fica apelido: um re-export manteria vivo um caminho que nada importa e faria o retrato da superfície
 * mentir, porque ele não vê re-exports (issue #204). É o precedente do corte do `pause-icons`.
 */

/** #navsound-master's value: the loudest of the nav categories, as a 0..100 slider value. */
export function navMasterVolume(state: Readonly<Record<string, AudioCatState>>, navCats: readonly string[] = NAV_CATS): number {
  return volPercent(Math.max(...navCats.map((k) => state[k].vol)));
}

/** Cane-hit spacing select -> validated int (garbage/empty -> 1, "one tap per block"). */
export function parseCaneDiv(raw: string): number {
  return (+raw) || 1;
}

/** srSay text for a cane-hit spacing choice. The two halves are ONE sentence per case, not a shared prefix
 *  plus a tail: a language that renders this as "One tap per block (cane)" needs to move the word "cane". */
export function caneDivMessage(div: number): string {
  return t(div === 2 ? 'sr.audio.caneHalfBlock' : 'sr.audio.canePerBlock');
}

/** #tts-engine's option catalog: (value, i18n KEY of the label). The engine NAMES are proper nouns and stay
 *  put; what translates is the parenthetical that explains each one. Keys, not text — see input/devices. */
export const TTS_ENGINE_OPTIONS: readonly (readonly [string, string])[] = [
  ['webspeech', 'tts.engine.webspeech'],
  ['kokoro', 'tts.engine.kokoro'],
  ['kitten', 'tts.engine.kitten'],
  ['espeak', 'tts.engine.espeak'],
];

/**
 * The engines THIS assembly can offer (ADR-0094): the neural one arrives through the game's Kokoro port (ADR-0198, ADR-0207), so
 * without it Kokoro is not offered — a choice that cannot work leaves whoever picks it waiting for a download that never starts.
 * `kitten`/`espeak` are not built and stay as they were.
 */
export function voiceEngineOptions(neuralAvailable: boolean): readonly (readonly [string, string])[] {
  return neuralAvailable ? TTS_ENGINE_OPTIONS : TTS_ENGINE_OPTIONS.filter(([v]) => v !== 'kokoro');
}

export interface VoiceLike { name: string; lang: string; }

/**
 * The system voices in the language asked for; with none of them, the whole list.
 *
 * It was called `pickPtVoices` and filtered a hard-coded `/^pt/i`, so a game in English offered a child a list of PORTUGUESE
 * voices to read English text. The name told the truth about what it did and lied about what it should do.
 *
 * The comparison is by language PREFIX and not by the whole tag: a child playing in pt-BR should also be able to choose a
 * pt-PT voice if that is the only one installed, and a school's browser rarely has the exact variant. The fallback to the
 * whole list stays: an empty list would be worse than a list in the wrong language, which at least she can hear and reject.
 */
export function pickVoicesFor<T extends VoiceLike>(voices: readonly T[], lang: string): readonly T[] {
  const pref = lang.slice(0, 2).toLowerCase();
  const sameTag = voices.filter((v) => v.lang.slice(0, 2).toLowerCase() === pref);
  return sameTag.length ? sameTag : voices;
}

/** "<name> (<lang>)" option label. */
export function voiceLabel(v: VoiceLike): string {
  return v.name + ' (' + v.lang + ')';
}

/** Whether the browser can list/switch audio outputs at all (gates the #audio-sinks hint copy). */
export function sinksSupported(hasEnumerateDevices: boolean, hasAudioContextCtor: boolean): boolean {
  return hasEnumerateDevices && hasAudioContextCtor;
}

export interface SinkDeviceLike { deviceId: string; label?: string; }

/** A device's option label, falling back to a 1-based "Output N" when the browser withholds the real label
 *  (no getUserMedia permission granted yet). */
export function sinkOptionLabel(d: SinkDeviceLike, index: number): string {
  return d.label || t('audio.sinkFallback', { n: index + 1 });
}

/** A player's current sink select value ('' = default/shared). */
export function sinkSelectValue(p: { audioSink?: string | null } | undefined): string {
  return (p && p.audioSink) || '';
}
