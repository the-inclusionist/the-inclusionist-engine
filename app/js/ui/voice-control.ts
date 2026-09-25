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
// ⚠️ A SPOKEN COMMAND IS A TAP, NOT A HOLD. The word arrives, the position is pressed and let go — and the latch (ADR-0211,
// always on for speech) is what keeps a direction held afterwards. That division is the whole reason the latch is forced there:
// a child who says «acima» cannot also say «and keep holding it».

import type { Translate } from '../core/i18n.js';
import type { Action } from '../core/actions.js';
import { voiceGrammar, createVoiceCommands, type VoiceCommands } from '../input/voice-map.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadVoskRuntime, type VoskDeps, type VoskLoad } from '../platform/vosk-runtime.js';
import { startVoiceListening, type VoiceListener, type VoiceListenerDeps } from '../platform/voice-listener.js';
import type { SwitchableControl } from './switchable-control.js';

/** How long a spoken position stays pressed. The same pulse the scan uses: long enough for a game to see a press and a release. */
export const VOICE_PULSE_MS = 400;

export interface VoiceControlDeps {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  readonly base: string;
  /** The child's language (`core/i18n.bcp47`): it chooses the model AND the words. */
  readonly language: () => string;
  readonly controller: VirtualController;
  /** The names the open menu is showing right now, if any (ADR-0194). */
  readonly menuWords: () => readonly string[];
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  readonly report: (line: string) => void;
  /** Puts the 👄 back to off when nothing could start. */
  readonly turnOff: () => void;
  readonly after: (fn: () => void, ms: number) => void;
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

  const grammarNow = (): readonly string[] => voiceGrammar(d.language(), d.menuWords());

  const command = (action: Action): void => {
    d.controller.press(action, 'fala');
    d.after(() => d.controller.release(action, 'fala'), VOICE_PULSE_MS);
  };

  const stop = (): void => {
    const going = listener;
    listener = null;
    commands = null;
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
      load = await loadRuntime({ base: d.base, language });
    } catch (e) {
      failed('runtime', `voice control: the recogniser did not open (${e instanceof Error ? e.message : String(e)}) — the child `
        + 'cannot play by speaking; check that the delivery carries the command files', t('sr.voice.failed'));
      return;
    }
    if (!load.ok) {
      /*
       * 📌 ONE LINE PER LANGUAGE, NAMING THAT LANGUAGE'S FIX (ADR-0225, ADR-0169). The install fetches the command model of the
       * BOOT language only, so a child who switches can ask for one the delivery never carried; «open it online» alone sends
       * the adult after a download that cannot happen. The reading's line names `--reading <language>` the same way.
       */
      const lang = language.split('-')[0]!.toLowerCase();
      failed(`files:${lang}`, `voice control: ${load.missing.join(', ')} not on this device for ${language} — the child cannot play `
        + `by speaking in this language; build the delivery with \`npx inclusionist-heavy --commands ${lang}\` and open the game `
        + 'once online in this language so the install fetches them', t('sr.voice.needsInternet'));
      return;
    }
    commands = createVoiceCommands(d.language());
    try {
      listener = await listen({
        model: load.model,
        grammar: grammarNow(),
        onPartial: (text) => { const a = commands?.partial(text); if (a) command(a); },
        onFinal: () => commands?.reset(),
      });
    } catch {
      failed('microphone', 'voice control: the microphone did not open — the child cannot play by speaking; allow the microphone '
        + 'for this page, or plug one in', t('sr.voice.noMicrophone'));
      return;
    }
    // ⚠️ TURNED OFF WHILE IT WAS STARTING: the microphone opened after the child let go of the icon, and a listener nobody asked
    // for would go on hearing her. The check is here and not only in `apply`, because starting is not instantaneous.
    if (!on) { stop(); return; }
    d.say(t('sr.voice.ready'));
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
      listener?.setGrammar(grammarNow());
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
