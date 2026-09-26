// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/voice-control — PLAYING BY VOICE, PUT TOGETHER (ADR-0189, ADR-0193, ADR-0194, ADR-0204 erratum; issues #184, #190).
//
// The four pieces that existed separately, joined: the Dev's vocabulary and the firing rule (`input/voice-map`), the recogniser
// opened from the delivery (`platform/vosk-runtime`), the microphone that stays open (`platform/voice-listener`), and the
// presses on the virtual controller with the source `fala` (ADR-0111). The 👄 of the quick bar drives it; what cannot start is
// SAID, written once in `problems`, and puts the icon back to off — a child must never meet a button that does nothing.
//
// 📌 THE GRAMMAR FOLLOWS THE MENU (ADR-0194): saying the name of an item activates it, so the words the open menu is showing
// join the closed grammar while it is open and leave with it.
//
// 🎯 A NAME HEARD IS A CURSOR AND A CONFIRM, NOT A CLICK (ADR-0194 §2): the root's menu navigation puts the cursor on the
// named item (`pointAt`), and the confirm position is pressed on the virtual controller like any other spoken word — so the
// item is activated by the same path, with the same spoken feedback, as a child confirming it with the cursor on it. WHEN a
// name fires is the reader's (`input/voice-map` over `platform/speech-recognition`): at once, unless another item's name
// continues it («voltar» / «voltar ao jogo»), which waits for the end of the utterance (§3). A LOCKED item's name is heard
// too and takes the same path: the confirm reaches the item's own press, which says its reason and does nothing (§5, ADR-0161).
// A name with a word the loaded model lacks cannot be heard at all, and is a line of `problems` (§4).
// ⚠️ EXCEPT WITH ONE BUTTON ONLY ON (ADR-0218 §4): then every word heard, a name included, is the child's switch and nothing more
// — one press, which the controller takes as «take the one shown», and no cursor put anywhere first.
//
// ⚠️ A SPOKEN COMMAND IS A TAP, NOT A HOLD. The word arrives, the position is pressed and let go — and the latch (ADR-0211,
// always on for speech) is what keeps a direction held afterwards. That division is the whole reason the latch is forced there:
// a child who says «acima» cannot also say «and keep holding it».

import type { Translate } from '../core/i18n.js';
import type { Action } from '../core/actions.js';
import { voiceGrammar, createVoiceCommands, type VoiceCommands, type VoiceCommand } from '../input/voice-map.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadVoskRuntime, type VoskDeps, type VoskLoad } from '../platform/vosk-runtime.js';
import { startVoiceListening, type VoiceListener, type VoiceListenerDeps } from '../platform/voice-listener.js';
import { spokenText } from '../platform/speech-recognition.js';
import type { SwitchableControl } from './switchable-control.js';
import { MENU_CONFIRM } from './menu-intent.js';

/** How long a spoken position stays pressed. The same pulse the scan uses: long enough for a game to see a press and a release. */
export const VOICE_PULSE_MS = 400;

export interface VoiceControlDeps {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  readonly base: string;
  /** The child's language (`core/i18n.bcp47`): it chooses the model AND the words. */
  readonly language: () => string;
  readonly controller: VirtualController;
  /** The names the open menu is showing right now, if any (ADR-0194) — `ui/menu-nav.itemNames`. */
  readonly menuWords: () => readonly string[];
  /**
   * Puts the open menu's cursor on the item with this name, WITHOUT activating it — `ui/menu-nav.pointAt`. REQUIRED: it is
   * what makes a name heard reach its item. `false` when that item is no longer there; then nothing is confirmed.
   */
  readonly pointAt: (name: string) => boolean;
  /**
   * ONE BUTTON ONLY is on (ADR-0218 §4): whatever the child says is her switch, one press the controller takes as «take the one
   * shown» — so a name heard is not a place and nothing is pointed at. REQUIRED: without it a name is a cursor move AND a take.
   */
  readonly oneButtonOnly: () => boolean;
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  readonly report: (line: string) => void;
  /** Puts the 👄 back to off when nothing could start. */
  readonly turnOff: () => void;
  readonly after: (fn: () => void, ms: number) => void;
  /*
   * 📌 WHAT THE RECOGNISER AND THE MICROPHONE USE OF THE BROWSER, lent by the root and handed on (ADR-0232 D4): the checked
   * cache and the bundle's loader to `platform/vosk-runtime`, the microphone and the audio context to `platform/voice-listener`.
   */
  readonly hasFile: VoskDeps['hasFile'];
  readonly loadBundle: VoskDeps['loadBundle'];
  /** The host's `fetch`, handed on to read the loaded model's vocabulary (ADR-0194 §4). Without it an unsayable name goes unreported. */
  readonly fetch?: VoskDeps['fetch'];
  readonly getUserMedia: VoiceListenerDeps['getUserMedia'];
  readonly createContext: VoiceListenerDeps['createContext'];
  readonly loadRuntime?: (deps: VoskDeps) => Promise<VoskLoad>;
  readonly listen?: (deps: VoiceListenerDeps) => Promise<VoiceListener>;
}

/**
 * 🎯 THE VOICE IS IN THE FAMILY AND NOT IN THE CAMERA'S CYCLE (ADR-0221 step 7f): it answers the 👄 and not the 📷, and has
 * one more method. Declaring the family is what makes the compiler see it turns on and off like the other three.
 */
export interface VoiceControl extends SwitchableControl {
  /** The open menu changed: the words it shows join the grammar, or leave it. */
  refreshGrammar(): void;
  /**
   * THE CHILD'S LANGUAGE CHANGED (ADR-0225): the model, the vocabulary and the grammar are chosen again.
   *
   * 📌 A listening recogniser is restarted, which costs the model being opened once more; one that is off has nothing to do,
   * because the next start already reads the new language.
   */
  languageChanged(): Promise<void>;
}

export function createVoiceControl(d: VoiceControlDeps): VoiceControl {
  const { t } = d;
  const loadRuntime = d.loadRuntime ?? loadVoskRuntime;
  const listen = d.listen ?? startVoiceListening;
  const said = new Set<string>();

  let on = false, starting: Promise<void> | null = null;
  let listener: VoiceListener | null = null;
  let commands: VoiceCommands | null = null;
  let grammarGiven = '';
  /** The words the model now listening knows, once read (`platform/vosk-vocabulary`); `null` while unknown. */
  let vocabulary: ReadonlySet<string> | null = null;
  /** Bumped by every stop, so a vocabulary that arrives for a recogniser already replaced is dropped. */
  let generation = 0;

  /** The open menu's names that can enter the grammar. A one-letter name stays out: in a closed grammar every short noise lands on it. */
  const sayableNames = (): readonly string[] => d.menuWords().filter((n) => spokenText(n).length > 1);

  /**
   * 🔴 A NAME THE MODEL CANNOT HEAR IS SAID TO THE ADULT (ADR-0194 §4, ADR-0169): Kaldi drops a grammar word its vocabulary lacks,
   * in silence, and the item goes mute for the child — she can still walk to it with the direction words. One line per item and
   * language, naming the words, the cost and the fix. Nothing is said while the vocabulary is unknown: no line beats a false one.
   */
  const reportUnsayable = (names: readonly string[]): void => {
    const known = vocabulary;
    if (!known) return;
    const language = d.language();
    for (const name of names) {
      const lacking = [...new Set(spokenText(name).split(' '))].filter((w) => w && !known.has(w));
      const kind = `unsayable:${language}:${name}`;
      if (!lacking.length || said.has(kind)) continue;
      said.add(kind);
      d.report(`voice control: the menu item "${name}" has ${lacking.length === 1 ? 'a word' : 'words'} the ${language} speech `
        + `model does not know (${lacking.map((w) => `"${w}"`).join(', ')}) — the child cannot choose this item by saying its name, `
        + `only by walking to it with the direction words; reword the item's label in the ${language} dictionary with words the `
        + 'model knows (ADR-0194 §4)');
    }
  };

  /** The open menu's names, handed to the reader and checked against the model, and the grammar with them. */
  const followMenu = (): readonly string[] => {
    const names = sayableNames();
    commands?.items(names);
    reportUnsayable(names);
    return voiceGrammar(d.language(), names);
  };

  const command = (action: Action): void => {
    d.controller.press(action, 'fala');
    d.after(() => d.controller.release(action, 'fala'), VOICE_PULSE_MS);
  };

  /*
   * 🔴 ONE WORD HEARD IS ONE ACTION (ADR-0111 errata, ADR-0218 §4). With one button only on, the controller takes every press as
   * «take the one shown», so a word may do nothing BESIDES its press: asked here, first, for every word — a position, a name, any
   * kind a later reader adds. 📏 Before, a name was still pointed at: with the chip on «próximo» the cursor jumped to the named
   * item and then stepped on from it; on «cancelar» the press meant nothing and the cursor had moved anyway.
   */
  const obey = (heard: readonly VoiceCommand[] | undefined): void => {
    for (const c of heard ?? []) {
      if (d.oneButtonOnly()) command(c.kind === 'position' ? c.action : MENU_CONFIRM);
      else if (c.kind === 'position') command(c.action);
      else if (d.pointAt(c.name)) command(MENU_CONFIRM);
    }
  };

  const stop = (): void => {
    const going = listener;
    listener = null;
    commands = null;
    vocabulary = null;
    generation += 1;
    void going?.stop();
  };

  /**
   * Nothing started: the child hears why, the adult reads it once, and the icon goes back to off. A failure that arrives after
   * the 👄 was turned off (or the root disposed, ADR-0220) has nobody waiting for it and says and writes nothing.
   */
  const failed = (kind: string, line: string, spoken: string): void => {
    if (!on) return;
    if (!said.has(kind)) { said.add(kind); d.report(line); }
    d.alert(spoken);
    d.turnOff();
  };

  const start = async (): Promise<void> => {
    /*
     * 🔴 THE LOAD IS INSIDE A `try` AND THIS WAS MEASURED, not foreseen: on 2026-09-21 the delivery's bundle turned out to be an
     * ES module and the loader threw. Nothing here caught it, so the rejection died as an unhandled promise and the 👄 STAYED
     * LIT over a microphone that had never opened — the exact defect this module exists to prevent, one layer above where it
     * was being prevented. A failure that has no name is still a failure the child has to be told about.
     */
    let load: VoskLoad;
    const language = d.language();
    try {
      load = await loadRuntime({
        base: d.base, language, hasFile: d.hasFile, loadBundle: d.loadBundle, ...(d.fetch ? { fetch: d.fetch } : {}),
      });
    } catch (e) {
      failed('runtime', `voice control: the recogniser did not open (${e instanceof Error ? e.message : String(e)}) — the child `
        + 'cannot play by speaking; check that the delivery carries the command files', t('sr.voice.failed'));
      return;
    }
    if (!load.ok) {
      /*
       * 📌 ONE LINE PER LANGUAGE, NAMING THAT LANGUAGE'S FIX (ADR-0225 and its erratum, ADR-0169). The delivery carries every
       * language unless its `--commands` list narrowed it, and the install fetches every one the delivery carries — so a model
       * missing here was left out of the delivery or has not come down yet, and «open it online» alone sends the adult after a
       * download that cannot happen in the first case. The reading's line names its two fixes the same way.
       */
      const lang = language.split('-')[0]!.toLowerCase();
      failed(`files:${lang}`, `voice control: ${load.missing.join(', ')} not on this device for ${language} — the child cannot play `
        + `by speaking in this language; build the delivery with \`npx inclusionist-heavy\` without \`--commands\` (it carries every `
        + `language) or with \`--commands ${lang}\` in its list, and open the game once online so the install fetches them`,
        t('sr.voice.needsInternet'));
      return;
    }
    commands = createVoiceCommands(d.language());
    const grammar = followMenu();
    grammarGiven = grammar.join('\n');
    try {
      listener = await listen({
        model: load.model,
        grammar,
        getUserMedia: d.getUserMedia,
        createContext: d.createContext,
        onPartial: (text) => { obey(commands?.partial(text)); },
        onFinal: (text) => { obey(commands?.final(text)); },
      });
    } catch {
      failed('microphone', 'voice control: the microphone did not open — the child cannot play by speaking; allow the microphone '
        + 'for this page, or plug one in', t('sr.voice.noMicrophone'));
      return;
    }
    // ⚠️ TURNED OFF WHILE IT WAS STARTING: the microphone opened after the child let go of the icon, and a listener nobody asked
    // for would go on hearing her. The check is here and not only in `apply`, because starting is not instantaneous.
    if (!on) { stop(); return; }
    // a menu that opened or closed while the microphone was opening changed the names after the grammar above was built
    api.refreshGrammar();
    d.say(t('sr.voice.ready'));
    // 📌 THE VOCABULARY IS READ AFTER THE CHILD CAN SPEAK, never before: it is a report for the adult, and reading the model's
    // archive a second time must not delay the first command. It checks the names showing when it arrives and every later menu.
    const mine = generation;
    void load.vocabulary?.().then((words) => {
      if (mine !== generation || !listener) return;
      vocabulary = words;
      reportUnsayable(sayableNames());
    });
  };

  const api: VoiceControl = {
    async apply(next) {
      on = next;
      if (!next) { stop(); return; }
      if (listener || starting) return;
      starting = start().finally(() => { starting = null; });
      await starting;
    },
    refreshGrammar() {
      if (!listener) return;
      // 📌 A new grammar is a new recogniser (`platform/voice-listener`), and the root asks on every menu change it sees —
      // most of which change no name. Only a grammar that differs is handed on.
      const grammar = followMenu();
      const given = grammar.join('\n');
      if (given === grammarGiven) return;
      grammarGiven = given;
      listener.setGrammar(grammar);
    },
    async languageChanged() {
      /*
       * 🔴 THE RECOGNISER STOPS CHOOSING ITS LANGUAGE ONCE (ADR-0225). `start()` reads `d.language()` for the MODEL and for the
       * vocabulary, and it used to read it only at the moment the 👄 was switched on — so a child who changed language while
       * listening went on being heard in the old one.
       * ⚠️ AND THAT IS WORSE THAN STOPPING, which is why this is not cosmetic: the grammar DOES follow, because it is rebuilt
       * whenever a menu opens (ADR-0194). So after a change the new language's words were fed to the old language's model, and
       * a closed grammar answers with the nearest candidate — measured in the lab on 2026-09-14, where «configurações de
       * inclusão» came back as «quatro». A microphone that acts on a word the child did not say is the defect here.
       * 📌 OFF IS ALREADY RIGHT: the next start reads the language then. This only has work to do while it is listening.
       */
      if (!on) return;
      // ⚠️ A START IN FLIGHT IS IN THE OLD LANGUAGE. Letting it finish and replacing it costs one opening; skipping it would
      // leave `starting` to install the old model on top of the new one, which is the race the `if (!on)` in `start` exists for.
      await starting;
      stop();
      await api.apply(true);
    },
  };
  return api;
}
