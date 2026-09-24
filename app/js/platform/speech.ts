// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/speech.ts — the LITERACY voice (gameSay): pt-BR speech that is ALWAYS on (independent of the mixer's
// narration toggle), through the browser's native voice. It picks a pt-BR voice and avoids pt-PT. A leaf module (audio only).
// The MENU's TTS (narrate/ttsSpeak and the Kokoro neural engine) is another path, gated by the mixer — `platform/tts`.
import { soundOn, volume } from './audio.js';

function ptbrVoice(): SpeechSynthesisVoice | null {
  try {
    const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; if (!vs.length) return null;
    return vs.find((v) => /pt[-_]?br/i.test(v.lang)) || vs.find((v) => /pt/i.test(v.lang) && /bras|brazil/i.test(v.name)) || vs.find((v) => /pt/i.test(v.lang) && !/pt[-_]?pt/i.test(v.lang)) || null;
  } catch (e) { return null; }
}

// FORCES pt-BR (not the mixer's voice, which may be pt-PT). Volume ×1.4 so the speech sits above the effects.
export function gameSay(text: string): void {
  if (!text || !soundOn) return;
  try {
    const ss = window.speechSynthesis; if (!ss) return; ss.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; const v = ptbrVoice(); if (v) u.voice = v; u.volume = Math.min(1, volume * 1.4); ss.speak(u);
  } catch (e) { /* noop */ }
}
