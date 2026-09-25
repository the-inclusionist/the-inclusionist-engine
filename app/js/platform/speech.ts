// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/speech.ts — the LITERACY voice (gameSay): pt-BR speech that is ALWAYS on (independent of the mixer's
// narration toggle), through the browser's native voice. It picks a pt-BR voice and avoids pt-PT. A helper that holds nothing:
// it takes the browser's speech and the master sound as a parameter (ADR-0232 D4, erratum D3 point 2).
// The MENU's TTS (narrate/ttsSpeak and the Kokoro neural engine) is another path, gated by the mixer — `platform/tts`.

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

function ptbrVoice(ss: SpeechSynthesis): SpeechSynthesisVoice | null {
  try {
    const vs = ss.getVoices() || []; if (!vs.length) return null;
    return vs.find((v) => /pt[-_]?br/i.test(v.lang)) || vs.find((v) => /pt/i.test(v.lang) && /bras|brazil/i.test(v.name)) || vs.find((v) => /pt/i.test(v.lang) && !/pt[-_]?pt/i.test(v.lang)) || null;
  } catch (e) { return null; }
}

// FORCES pt-BR (not the mixer's voice, which may be pt-PT). Volume ×1.4 so the speech sits above the effects.
export function gameSay(voice: GameVoice, text: string): void {
  if (!text || !voice.soundOn()) return;
  try {
    const ss = voice.synth(); if (!ss) return; ss.cancel();
    const u = voice.utterance(text); u.lang = 'pt-BR'; const v = ptbrVoice(ss); if (v) u.voice = v; u.volume = Math.min(1, voice.volume() * 1.4); ss.speak(u);
  } catch (e) { /* noop */ }
}
