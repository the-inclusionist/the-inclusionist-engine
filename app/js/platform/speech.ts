// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/speech.ts — voz do LETRAMENTO (gameSay): fala pt-BR SEMPRE-ativa (independe do toggle 'Narração
// (TTS)' do mixer), pela voz nativa do navegador. Escolhe uma voz pt-BR e evita pt-PT. Módulo-folha (só áudio).
// The MENU's TTS (narrate/ttsSpeak and the Kokoro neural engine) is another path, gated by the mixer — `platform/tts`.
import { soundOn, volume } from './audio.js';

function ptbrVoice(): SpeechSynthesisVoice | null {
  try {
    const vs = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; if (!vs.length) return null;
    return vs.find((v) => /pt[-_]?br/i.test(v.lang)) || vs.find((v) => /pt/i.test(v.lang) && /bras|brazil/i.test(v.name)) || vs.find((v) => /pt/i.test(v.lang) && !/pt[-_]?pt/i.test(v.lang)) || null;
  } catch (e) { return null; }
}

// FORÇA pt-BR (não usa a voz do mixer, que pode ser pt-PT). Volume ×1.4 para a fala soar acima dos efeitos.
export function gameSay(text: string): void {
  if (!text || !soundOn) return;
  try {
    const ss = window.speechSynthesis; if (!ss) return; ss.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; const v = ptbrVoice(); if (v) u.voice = v; u.volume = Math.min(1, volume * 1.4); ss.speak(u);
  } catch (e) { /* noop */ }
}
