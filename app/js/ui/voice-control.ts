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

import { t } from '../core/i18n.js';
import type { Action } from '../core/actions.js';
import { voiceGrammar, createVoiceCommands, type VoiceCommands } from '../input/voice-map.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadVoskRuntime, type VoskDeps, type VoskLoad } from '../platform/vosk-runtime.js';
import { startVoiceListening, type VoiceListener, type VoiceListenerDeps } from '../platform/voice-listener.js';

/** How long a spoken position stays pressed. The same pulse the scan uses: long enough for a game to see a press and a release. */
export const VOICE_PULSE_MS = 400;

export interface VoiceControlDeps {
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

export interface VoiceControl {
  apply(on: boolean): Promise<void>;
  /** The open menu changed: the words it shows join the grammar, or leave it. */
  refreshGrammar(): void;
}

export function createVoiceControl(d: VoiceControlDeps): VoiceControl {
  const loadRuntime = d.loadRuntime ?? loadVoskRuntime;
  const listen = d.listen ?? startVoiceListening;
  const said = new Set<string>();
  const once = (kind: string, line: string, spoken: string): void => {
    if (!said.has(kind)) { said.add(kind); d.report(line); }
    d.alert(spoken);
  };

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

  const start = async (): Promise<void> => {
    const load = await loadRuntime({ base: d.base, language: d.language() });
    if (!load.ok) {
      once('files', `voice control: ${load.missing.join(', ')} not on this device — the child cannot play by speaking; open the `
        + 'game once online so the install fetches them', t('sr.voice.needsInternet'));
      d.turnOff();
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
      once('microphone', 'voice control: the microphone did not open — the child cannot play by speaking; allow the microphone '
        + 'for this page, or plug one in', t('sr.voice.noMicrophone'));
      d.turnOff();
      return;
    }
    // ⚠️ TURNED OFF WHILE IT WAS STARTING: the microphone opened after the child let go of the icon, and a listener nobody asked
    // for would go on hearing her. The check is here and not only in `apply`, because starting is not instantaneous.
    if (!on) { stop(); return; }
    d.say(t('sr.voice.ready'));
  };

  return {
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
  };
}
