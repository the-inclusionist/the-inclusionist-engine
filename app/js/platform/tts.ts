// SPDX-License-Identifier: GPL-3.0-or-later
// platform/tts — narração por voz. Motor NEURAL Piper pt-BR carregado LAZY (import de CDN + cache OPFS → a 2ª sessão fala
// offline), com FALLBACK imediato p/ a voz nativa do navegador (Web Speech) enquanto o neural não chega. narrate() é o
// ponto de entrada, gated pelo toggle 'Narração (TTS)' do mixer (audioCat.tts.on) — independe das legendas. As funções de
// PAINEL (populateTTSEngines/Voices/reflectTTS) ficam no game.js (→ ui/settings-audio, #38→#54) e usam get/setEngineSel +
// get/setVoiceObj daqui. Injeção por closure. Ver docs/plano-tts-fase-f5.md + docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from './storage.js';

interface TtsEngine { id: string; speak: (text: string) => void; }

export interface TtsCtx {
  srSay: (t: string) => void;
  srAlert: (t: string) => void;
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;
  audioOut: () => AudioNode | null;
  getSoundOn: () => boolean;
  getVolume: () => number;
  getAudioCat: () => Record<string, { on: boolean }> | null; // narrate checa audioCat.tts.on
}

export interface Tts {
  narrate: (text: string) => void;         // ponto de entrada (gated); usado em todo o game.js + injetado no audio-nav
  ttsSpeak: (text: string) => boolean;
  loadTTS: () => void;
  speakWebSpeech: (text: string) => boolean;
  getEngineSel: () => string;
  setEngineSel: (v: string) => void;
  getEngine: () => TtsEngine | null;
  getVoiceObj: () => SpeechSynthesisVoice | null;
  setVoiceObj: (v: SpeechSynthesisVoice | null) => void;
  readonly loading: boolean;
  readonly failed: boolean;
  readonly narrateCount: number;
}

// ⚠️ MIGRAÇÃO PENDENTE (ADR-0022): esta implementação com @mintplex-labs/piper-tts-web será SUBSTITUÍDA por
// sherpa-onnx-wasm (loader universal, modelos VITS/Piper + Kokoro-multi-lang carregados de qq URL R2 em runtime via
// FS.writeFile; lazy-fetch; eSpeak/Web Speech de fallback). @mintplex-labs foi descontinuado e só carrega 2 vozes pt-BR.
// Enquanto a migração não vem: a lib vem do npm (code-split pelo Vite no 1º uso), modelo do HF em cache OPFS. (#69→#38)
const TTS_SOURCES = { 'pt-BR': { engine: 'piper', voice: 'pt_BR-faber-medium' } };

export function createTts(ctx: TtsCtx): Tts {
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _ttsPct = 0, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // voz do Web Speech selecionada
  let ttsEngineSel = store.get(store.KEYS.ttsEngine, null) || 'webspeech'; // webspeech | piper | kokoro | kitten | espeak

  function speakWebSpeech(text: string): boolean {
    try {
      const ss = window.speechSynthesis; if (!ss) return false; ss.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; if (_ttsVoiceObj) u.voice = _ttsVoiceObj; u.rate = 1; u.volume = Math.min(1, ctx.getVolume() * 1.4); ss.speak(u); return true;
    } catch (e) { return false; }
  }

  function loadTTS(): void {
    if (ttsEngine || ttsLoading || ttsFailed) return;
    if (ttsEngineSel !== 'piper') { // Kokoro/Kitten não têm pt-BR (ficam p/ os builds i18n); eSpeak NG entra depois
      if (ttsEngineSel !== 'webspeech') ctx.srAlert('Este motor ainda não fala português — por enquanto, use Piper (neural) ou a voz do navegador.');
      return;
    }
    ttsLoading = true; const t0 = performance.now(); ctx.srSay('Baixando a voz neural (precisa de internet só no 1º uso)…');
    import('@mintplex-labs/piper-tts-web').then(async (mod) => { // npm → Vite code-split num chunk LOCAL (sem CDN, sem warning). Ver ADR-0021
      const session = await mod.TtsSession.create({ voiceId: TTS_SOURCES['pt-BR'].voice,
        progress: (p: { loaded: number; total: number }) => { if (!p || !p.total) return; const pct = Math.round(p.loaded * 100 / p.total); if (pct >= _ttsPct + 25 && pct < 100) { _ttsPct = pct; ctx.srSay('Voz neural: ' + pct + '%.'); } },
        logger: () => {} });
      let playing: AudioBufferSourceNode | null = null, busy = false, next: string | null = null; // fila de 1: só a ÚLTIMA pendente vale
      const speakNow = async (text: string): Promise<void> => { busy = true;
        try { const wav = await session.predict(text); const ac = ctx.ensureAC();
          if (ac) { const buf = await ac.decodeAudioData(await wav.arrayBuffer());
            if (playing) { try { playing.stop(); } catch (e) { /* noop */ } }
            const src = ac.createBufferSource(); src.buffer = buf; src.connect(ctx.catNode('tts') || ctx.audioOut() || ac.destination);
            src.onended = () => { if (playing === src) playing = null; const nx = next; next = null; if (nx) speakNow(nx); else busy = false; };
            src.start(); playing = src; return; } } catch (e) { /* fala neural falhou p/ este texto */ }
        const nx = next; next = null; if (nx) speakNow(nx); else busy = false; };
      ttsEngine = { id: 'piper', speak: (text: string) => { if (busy) next = text; else speakNow(text); } };
      ttsLoading = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      narrate('Voz neural pronta, em ' + ((performance.now() - t0) / 1000).toFixed(0) + ' segundos.'); // já sai NA voz nova
    }).catch(() => { ttsLoading = false; ttsFailed = true; ctx.srAlert('Não deu para carregar a voz neural (precisa de internet no 1º uso) — seguindo com a voz do navegador.'); });
  }

  function ttsSpeak(text: string): boolean {
    if (ttsEngineSel !== 'webspeech') {
      if (ttsEngine && ttsEngine.id === ttsEngineSel && ttsEngine.speak) { try { ttsEngine.speak(text); } catch (e) { /* noop */ } return true; }
      loadTTS(); // motor neural (baixando/indisponível) → cai no fallback
    }
    return speakWebSpeech(text); // fallback imediato: Web Speech (nativo pt-BR)
  }

  function narrate(text: string): void { // gated pelo toggle 'Narração (TTS)' do mixer, independente das legendas
    const cat = ctx.getAudioCat(); if (!ctx.getSoundOn() || !cat || !cat.tts || !cat.tts.on || !text) return; _narrateCount++; ttsSpeak(text);
  }

  return {
    narrate, ttsSpeak, loadTTS, speakWebSpeech,
    getEngineSel: () => ttsEngineSel, setEngineSel: (v) => { ttsEngineSel = v; },
    getEngine: () => ttsEngine, getVoiceObj: () => _ttsVoiceObj, setVoiceObj: (v) => { _ttsVoiceObj = v; },
    get loading() { return ttsLoading; }, get failed() { return ttsFailed; }, get narrateCount() { return _narrateCount; },
  };
}
