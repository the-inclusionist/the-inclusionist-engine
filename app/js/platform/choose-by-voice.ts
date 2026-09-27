// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/choose-by-voice — A CHILD ANSWERS BY SAYING ONE OF THE OPTIONS THE GAME SHOWS (ADR-0256).
//
// The game passes the options it is showing and gets back which one was said. The recogniser hears a grammar of exactly those
// options plus `[unk]`, so it can only answer with one of them or with «none of these» — never with the nearest option to a word
// that was not one. 📏 Why not the reading (Whisper): the lab measured it at 1 of 7 on words said alone, and an option is one or
// two words; the command recogniser, closed, heard 7 of 7.
//
// 🔴 TWO OPTIONS IN ONE SENTENCE ARE NOT AN ANSWER (the quiz's own rule, which moved here with the matching): a child who says
// «gato ou galinha» is thinking out loud, and picking one of them would answer FOR her — and mark it wrong. So the choice is
// decided at the END of a sentence, never on its first word: one option chooses, two or more end the choice unanswered, none
// goes on listening. 📏 It costs the end of the sentence — the lab measured 1.3 s after the word against 0.4 s on the partial.
//
// What this module decides, and nothing else: the grammar an option set becomes, which options a sentence names, when the
// listening ends, and that one choice at a time holds the microphone. Opening the recogniser and the microphone is the root's
// (`open`), which lends the delivery, the cache and the browser (ADR-0232 D4).

import { spokenText, compareKey } from './speech-recognition.js';
import { loadVoskRuntime, type VoskDeps } from './vosk-runtime.js';
import { startVoiceListening, type VoiceListenerDeps } from './voice-listener.js';

/** What a choice gives back: the index of the option said, or `null`; what was heard; why it ended. */
export interface ChoiceHeard {
  readonly chosen: number | null;
  readonly heard: string;
  /** One option said · more than one said in one sentence · no option in time · asked to stop. */
  readonly ended: 'chosen' | 'unclear' | 'timeout' | 'asked';
}

export interface ChooseSettings {
  /** The language the options are in — the content's, when it is not the page's (ADR-0225). Default: the page's. */
  readonly language?: string;
  /** How long to wait for an option. Default 10 s: time to think, and a microphone that is never forgotten open. */
  readonly maxMs?: number;
}

/** A recogniser listening with a grammar: it can be stopped, and it may say which words its model knows. */
export interface OpenedChoice {
  stop(): Promise<void>;
  /** The words the language's model knows, when they can be read — an option with a word outside them can never be chosen. */
  readonly vocabulary?: () => Promise<ReadonlySet<string> | null>;
}

export interface VoiceChooserDeps {
  /** The page's language (`core/i18n.bcp47`). */
  readonly language: () => string;
  /**
   * Opens the command recogniser for `language` with this grammar and the microphone, calling `onHeard` with every text it hears
   * — `final` when the sentence ended. REJECTS, with the reason, when the model or the microphone cannot be had.
   */
  readonly open: (language: string, grammar: readonly string[], onHeard: (text: string, final: boolean) => void) => Promise<OpenedChoice>;
  readonly after: (fn: () => void, ms: number) => unknown;
  readonly cancel: (handle: unknown) => void;
  /** A line for `problems`, written once per reason (ADR-0169). */
  readonly report: (line: string) => void;
  /** Called before the microphone is opened and after it is let go: the root pauses the 👄 in between (one ear per word). */
  readonly pause?: () => void;
  readonly resume?: () => void;
}

export interface VoiceChooser {
  choose(options: readonly string[], settings?: ChooseSettings): Promise<ChoiceHeard>;
  /** Ends the choice in hand now: it answers `null`, `ended: 'asked'`. */
  stop(): void;
}

const MAX_MS = 10_000;

/** What opening the command recogniser for a choice uses of the delivery and the browser, lent by the root (ADR-0232 D4). */
export type CommandRecogniserDeps = Omit<VoskDeps, 'language'> & Pick<VoiceListenerDeps, 'getUserMedia' | 'createContext'>;

/**
 * THE `open` A CHOOSER IS GIVEN WHERE THE COMMAND RECOGNISER IS THE EAR: the language's model from the delivery, then the
 * microphone with the grammar. A model that opened for a microphone that did not is let go before the refusal travels.
 */
export function openWithCommandRecogniser(d: CommandRecogniserDeps): VoiceChooserDeps['open'] {
  return async (language, grammar, onHeard) => {
    // a device with no microphone is refused before 31 MiB of model are opened for nothing
    if (!d.getUserMedia) throw new Error('this device cannot open a microphone');
    const load = await loadVoskRuntime({ ...d, language });
    if (!load.ok) throw new Error(`${load.missing.join(', ')} not on this device`);
    try {
      const listening = await startVoiceListening({
        model: load.model, grammar, getUserMedia: d.getUserMedia, createContext: d.createContext,
        onPartial: (text) => onHeard(text, false), onFinal: (text) => onHeard(text, true),
      });
      return { stop: () => listening.stop(), ...(load.vocabulary ? { vocabulary: load.vocabulary } : {}) };
    } catch (e) {
      load.model.terminate?.();
      throw e;
    }
  };
}

/**
 * The options a sentence names, in the order said, each once: read word by word, the LONGEST option that starts at each word —
 * so «cavalo marinho» is one option and not also «cavalo» — accents and case aside, whole words only.
 */
export function optionsNamed(options: readonly string[], sentence: string): number[] {
  const keys = options.map((o) => compareKey(o).split(' ').filter(Boolean));
  const said = compareKey(sentence).split(' ').filter(Boolean);
  const named: number[] = [];
  for (let i = 0; i < said.length;) {
    let best = -1;
    keys.forEach((k, o) => {
      if (k.length && k.every((w, j) => said[i + j] === w) && (best < 0 || k.length > keys[best]!.length)) best = o;
    });
    if (best < 0) { i += 1; continue; }
    if (!named.includes(best)) named.push(best);
    i += keys[best]!.length;
  }
  return named;
}

export function createVoiceChooser(d: VoiceChooserDeps): VoiceChooser {
  const said = new Set<string>();
  const once = (kind: string, line: string): void => { if (!said.has(kind)) { said.add(kind); d.report(line); } };
  let inFlight: Promise<ChoiceHeard> | null = null;
  let askToStop: (() => void) | null = null;

  /** An option with a word the model does not know can never be heard: said to the adult, once per option and language. */
  const reportUnsayable = async (opened: OpenedChoice, options: readonly string[], language: string): Promise<void> => {
    const known = await opened.vocabulary?.().catch(() => null);
    if (!known) return;
    for (const option of options) {
      const lacking = spokenText(option).split(' ').filter((w) => w && !known.has(w));
      if (lacking.length) {
        once(`unsayable:${language}:${option}`, `choosing by voice: the option "${option}" has ${lacking.length === 1 ? 'a word' : 'words'} `
          + `the ${language} speech model does not know (${lacking.map((w) => `"${w}"`).join(', ')}) — the child cannot choose it by saying `
          + 'it, only with the arrows; reword it with words the model knows (ADR-0256)');
      }
    }
  };

  const run = async (options: readonly string[], settings: ChooseSettings): Promise<ChoiceHeard> => {
    const language = settings.language ?? d.language();
    const grammar = [...new Set(options.map((o) => spokenText(o)).filter(Boolean))];
    let heard = '';
    let settle: (r: ChoiceHeard) => void = () => {};
    const answer = new Promise<ChoiceHeard>((resolve) => { settle = resolve; });
    const end = (chosen: number | null, ended: ChoiceHeard['ended']): void => settle({ chosen, heard, ended });
    // asked to stop while the microphone is still opening counts too: it is let go as soon as it opens
    askToStop = () => end(null, 'asked');
    const onHeard = (text: string, final: boolean): void => {
      const clean = text.replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean) heard = clean;
      if (!final || !clean) return;
      const named = optionsNamed(options, clean);
      if (named.length === 1) end(named[0]!, 'chosen');
      else if (named.length > 1) end(null, 'unclear');
    };
    d.pause?.();
    try {
      let opened: OpenedChoice;
      try {
        opened = await d.open(language, grammar, onHeard);
      } catch (e) {
        const why = e instanceof Error ? e.message : String(e);
        once(`open:${language}`, `choosing by voice: the recogniser did not open for ${language} (${why}) — the child cannot answer an `
          + `option by saying it; build the delivery with \`--commands ${language.split('-')[0]}\` and allow the microphone (ADR-0256)`);
        throw e;
      }
      void reportUnsayable(opened, options, language);
      const timer = d.after(() => end(null, 'timeout'), settings.maxMs ?? MAX_MS);
      const result = await answer;
      d.cancel(timer);
      await opened.stop().catch(() => {});
      return result;
    } finally {
      askToStop = null;
      d.resume?.();
    }
  };

  return {
    choose(options, settings = {}) {
      // one microphone, one choice: a second caller waits on the first
      if (inFlight) return inFlight;
      inFlight = run(options, settings).finally(() => { inFlight = null; });
      return inFlight;
    },
    stop() { askToStop?.(); },
  };
}
