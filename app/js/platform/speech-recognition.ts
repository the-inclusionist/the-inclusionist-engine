// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/speech-recognition — which recogniser hears the child, and what a command is in what was heard (ADR-0200 and its
// erratum, ADR-0193, ADR-0194; issue #190).
//
// The browser's recognition comes first, and ONLY on the device: the Dev, «Só local, voz da criança não deve sair do aparelho». So
// Web Speech is the route only where the browser can say it recognises on the device (`processLocally`) AND the language is
// installed there; anything else — no API, a browser that would ignore the flag and send the voice to its servers, a language to
// download — falls back to the recognisers the engine carries (Vosk for commands). The words heard, whoever heard them, become
// commands the same way: the direction words and the open menu's item names, the longest name first, a partial hypothesis firing
// what it already holds and a name another item's name continues waiting for the end (ADR-0194 §3).

/** What the browser answers about recognising a language on the device (Chrome's `SpeechRecognition.available`). */
export type OnDeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

/** The part of the browser's `SpeechRecognition` constructor this module reads. */
export interface RecognitionApi {
  new (): RecognitionInstance;
  readonly prototype: object;
  readonly available?: (options: { langs: readonly string[]; processLocally: boolean }) => Promise<OnDeviceAvailability>;
}

export interface RecognitionInstance {
  lang: string;
  processLocally?: boolean;
  continuous: boolean;
  interimResults: boolean;
}

export interface RecognitionRoute {
  /** `webspeech-local`: the browser recognises on the device. `recuo`: the engine's own recogniser. */
  readonly route: 'webspeech-local' | 'recuo';
  /** Why: the browser's answer, or what is missing. */
  readonly status: OnDeviceAvailability | 'sem-api' | 'sem-processamento-local';
}

/**
 * THE ROUTE, measured on the device (ADR-0200 §3). ⚠️ A browser whose recognition object has no `processLocally` would take the
 * flag as an unknown property and recognise on its servers — it is never the route, whatever it says about availability.
 */
export async function recognitionRoute(language: string, api: RecognitionApi | null | undefined): Promise<RecognitionRoute> {
  if (!api) return { route: 'recuo', status: 'sem-api' };
  if (!('processLocally' in api.prototype) || typeof api.available !== 'function') return { route: 'recuo', status: 'sem-processamento-local' };
  let availability: OnDeviceAvailability;
  try { availability = await api.available({ langs: [language], processLocally: true }); } catch { return { route: 'recuo', status: 'unavailable' }; }
  return { route: availability === 'available' ? 'webspeech-local' : 'recuo', status: availability };
}

/** A recognition object set to recognise on the device, continuously, with partial hypotheses. Refuses a browser that cannot. */
export function createOnDeviceRecognition(api: RecognitionApi, language: string): RecognitionInstance {
  if (!('processLocally' in api.prototype)) throw new Error('speech recognition on the device is not supported here: the voice would leave the device');
  const rec = new api();
  rec.lang = language;
  rec.processLocally = true;
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}

/** A command heard: a direction word, or the name of an item of the open menu. */
export type HeardCommand = { readonly kind: 'palavra'; readonly word: string } | { readonly kind: 'item'; readonly name: string };

/** How a heard text is compared: lower case, letters and spaces only. */
export const spokenText = (t: string): string => t.toLowerCase().normalize('NFC').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

export interface CommandReader {
  /** The menu's item names now on screen (already as spoken). */
  items(names: readonly string[]): void;
  /**
   * One hypothesis of utterance `index`: returns the commands it completes that were not returned before for that utterance. A
   * partial one holds back its last name while another item's name continues it («voltar» may become «voltar ao jogo»).
   */
  read(index: number, text: string, final: boolean): readonly HeardCommand[];
}

export function createCommandReader(vocabulary: readonly string[]): CommandReader {
  const spokenForms = vocabulary.map(spokenText);
  let spokenItems: readonly string[] = [];
  const firedCount = new Map<number, number>();
  const phrasesIn = (text: string): string[] => {
    const p = spokenText(text).split(' ').filter(Boolean);
    const found: string[] = [];
    for (let i = 0; i < p.length;) {
      let matched: string | null = null;
      for (let n = p.length - i; n >= 1; n--) {
        const f = p.slice(i, i + n).join(' ');
        if (spokenItems.includes(f) || spokenForms.includes(f)) { matched = f; i += n; break; }
      }
      if (matched) found.push(matched); else i++;
    }
    return found;
  };
  return {
    items(names) { spokenItems = names.map(spokenText); },
    read(index, text, final) {
      const found = phrasesIn(text);
      const alreadyFired = firedCount.get(index) ?? 0;
      const newCommands: HeardCommand[] = [];
      for (let i = alreadyFired; i < found.length; i++) {
        const f = found[i]!;
        if (!final && i === found.length - 1 && spokenItems.some((o) => o !== f && o.startsWith(f + ' '))) break;
        newCommands.push(spokenItems.includes(f) ? { kind: 'item', name: f } : { kind: 'palavra', word: f });
        firedCount.set(index, i + 1);
      }
      if (final) firedCount.delete(index);
      return newCommands;
    },
  };
}
