// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/speech.ts — the LITERACY voice (gameSay): speech that is ALWAYS on (independent of the mixer's narration toggle),
// through the browser's native voice, in the language the game says its words are in (ADR-0243 §4). A helper that holds
// nothing: it takes the browser's speech and the master sound as a parameter (ADR-0232 D4, erratum D3 point 2).
// The MENU's TTS (narrate/ttsSpeak and the Kokoro neural engine) is another path, gated by the mixer — `platform/tts`.

import { voiceOfLanguage } from './voice-plan.js';

/**
 * THE BROWSER'S SPEECH, lent by whoever holds the window (the composition root, from `host.win`). The same port
 * `platform/tts` receives. `synth()` is asked at every utterance and may answer `null`: a browser without speech synthesis.
 */
export interface SpeechPort {
  synth(): SpeechSynthesis | null;
  utterance(text: string): SpeechSynthesisUtterance;
}

/** What the literacy voice reads: the browser's speech, and the master sound it obeys. */
export interface GameVoice extends SpeechPort {
  soundOn(): boolean;
  volume(): number;
}

/** The device's voices, or none where the browser has not listed them yet or throws. */
function listedVoices(ss: SpeechSynthesis): readonly SpeechSynthesisVoice[] {
  try { return ss.getVoices() || []; } catch (e) { return []; }
}

/**
 * Says `text`, a word the game gives in `language` (BCP-47), with a voice of that language chosen by the rule narration's parts
 * use (ADR-0243 §2): the exact tag, else a voice of the same language. REQUIRED, because an optional language would default to
 * one, and that default — pt-BR whatever the page said — is what ADR-0243 §4 removed.
 *
 * 🔴 A DEVICE THAT LISTS VOICES AND NONE OF THE LANGUAGE says nothing (§3): a wrong accent is learned. A device that lists NONE
 * yet — the browser fills the list late — is asked by the tag alone, and it picks its own voice for the language.
 * Volume ×1.4 so the speech sits above the effects, capped at 1.
 */
export function gameSay(voice: GameVoice, text: string, language: string): void {
  if (!text || !voice.soundOn()) return;
  try {
    const ss = voice.synth(); if (!ss) return; ss.cancel();
    const listed = listedVoices(ss);
    const own = voiceOfLanguage(language, listed.map((v) => ({ locale: v.lang.replace('_', '-'), engine: 'webspeech', voice: v.name })));
    if (listed.length && !own) return;
    const u = voice.utterance(text); u.lang = language;
    const v = listed.find((x) => x.name === own?.voice); if (v) u.voice = v;
    u.volume = Math.min(1, voice.volume() * 1.4); ss.speak(u);
  } catch (e) { /* noop */ }
}
