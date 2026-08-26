// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/tts — narração por voz. Motor NEURAL Piper pt-BR carregado LAZY (import de CDN + cache OPFS → a 2ª sessão fala
// offline), com FALLBACK imediato p/ a voz nativa do navegador (Web Speech) enquanto o neural não chega. narrate() é o
// ponto de entrada, gated pelo toggle 'Narração (TTS)' do mixer (audioCat.tts.on) — independe das legendas. As funções de
// PAINEL (populateTTSEngines/Voices/reflectTTS) ficam no game.js (→ ui/settings-audio, #38→#54) e usam get/setEngineSel +
// get/setVoiceObj daqui. Injeção por closure. Ver docs/plano-tts-fase-f5.md + docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from './storage.js';
import { t, bcp47 } from '../core/i18n.js';
import { criarFalaInterrompivel } from './interruptible-speech.js';

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
/**
 * Voz NEURAL por idioma, indexada pela etiqueta BCP-47 de core/i18n. Só o pt-BR tem uma hoje, e essa ausência
 * é agora CONSULTÁVEL em vez de presumida: `loadTTS` pergunta à tabela se existe voz para o idioma corrente,
 * em vez de carregar a portuguesa aconteça o que acontecer.
 *
 * Era `TTS_SOURCES['pt-BR']` escrito à mão no ponto de uso, o que fazia o jogo em inglês baixar 25,6 MB de
 * voz portuguesa para ler texto em inglês com fonética errada — pior que não ter voz neural nenhuma, porque
 * gasta a banda da escola para entregar algo ininteligível.
 */
const TTS_SOURCES: Readonly<Record<string, { engine: string; voice: string } | undefined>> = {
  'pt-BR': { engine: 'piper', voice: 'pt_BR-faber-medium' },
};

export function createTts(ctx: TtsCtx): Tts {
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _ttsPct = 0, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // voz do Web Speech selecionada
  let ttsEngineSel = store.get(store.KEYS.ttsEngine, null) || 'webspeech'; // webspeech | piper | kokoro | kitten | espeak

  function speakWebSpeech(text: string): boolean {
    try {
      const ss = window.speechSynthesis; if (!ss) return false; ss.cancel();
      // `u.lang` era 'pt-BR' fixo. Com o jogo em inglês ou espanhol isso pedia ao navegador uma voz
      // PORTUGUESA para um texto que não é português — e o resultado não é sotaque, é ininteligível: a
      // fonética errada aplicada às letras erradas. Segue o idioma do jogo.
      const u = new SpeechSynthesisUtterance(text); u.lang = bcp47(); if (_ttsVoiceObj) u.voice = _ttsVoiceObj; u.rate = 1; u.volume = Math.min(1, ctx.getVolume() * 1.4); ss.speak(u); return true;
    } catch (e) { return false; }
  }

  function loadTTS(): void {
    if (ttsEngine || ttsLoading || ttsFailed) return;
    if (ttsEngineSel !== 'piper') { // Kokoro/Kitten/eSpeak NG ainda não entraram
      if (ttsEngineSel !== 'webspeech') ctx.srAlert(t('sr.tts.engineNoLanguage'));
      return;
    }
    // O Piper só tem voz para os idiomas em TTS_SOURCES. Sem voz para o idioma corrente, NÃO se baixa a de
    // outro idioma: avisa e segue na voz do navegador, que fala a língua certa.
    const fonte = TTS_SOURCES[bcp47()];
    if (!fonte) { ctx.srAlert(t('sr.tts.noNeuralForLanguage')); return; }
    ttsLoading = true; const t0 = performance.now(); ctx.srSay(t('sr.tts.downloading'));
    import('@mintplex-labs/piper-tts-web').then(async (mod) => { // npm → Vite code-split num chunk LOCAL (sem CDN, sem warning). Ver ADR-0021
      const session = await mod.TtsSession.create({ voiceId: fonte.voice,
        progress: (p: { loaded: number; total: number }) => { if (!p || !p.total) return; const pct = Math.round(p.loaded * 100 / p.total); if (pct >= _ttsPct + 25 && pct < 100) { _ttsPct = pct; ctx.srSay(t('sr.tts.progress', { pct })); } },
        logger: () => {} });
      // A FILA DE UM SAIU (ADR-0044, item 2). Ela era `if (busy) next = text; else speakNow(text)`, e o
      // efeito, varrendo cinco itens de menu, era ouvir o PRIMEIRO inteiro e depois o ÚLTIMO — os três do
      // meio sumiam, porque cada pedido sobrescrevia o `next`. Lento e lacunar, e quem não enxerga navega
      // POR ESCUTA: a escuta ficava vários itens atrás do foco.
      //
      // A política agora mora em `platform/interruptible-speech`, pura e testada com falsos. Aqui só se
      // diz COMO sintetizar, tocar e parar — o quando é lá, com a guarda de geração que impede uma síntese
      // lenta de atropelar a mais nova.
      const fala = criarFalaInterrompivel<AudioBuffer, AudioBufferSourceNode>({
        sintetizar: async (texto) => {
          const wav = await session.predict(texto);
          const ac = ctx.ensureAC();
          if (!ac) throw new Error('sem AudioContext'); // o `catch` de lá trata: silêncio deste item, motor vivo
          return ac.decodeAudioData(await wav.arrayBuffer());
        },
        tocar: (buf, aoTerminar) => {
          const ac = ctx.ensureAC();
          if (!ac) return null;
          const src = ac.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.catNode('tts') || ctx.audioOut() || ac.destination);
          src.onended = aoTerminar;
          src.start();
          return src;
        },
        parar: (src) => { src.stop(); },
      });
      ttsEngine = { id: 'piper', speak: (text: string) => { fala.falar(text); } };
      ttsLoading = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
      narrate(t('sr.tts.ready', { s: ((performance.now() - t0) / 1000).toFixed(0) })); // já sai NA voz nova
    }).catch(() => { ttsLoading = false; ttsFailed = true; ctx.srAlert(t('sr.tts.loadFailed')); });
  }

  function ttsSpeak(text: string): boolean {
    if (ttsEngineSel !== 'webspeech') {
      if (ttsEngine && ttsEngine.id === ttsEngineSel && ttsEngine.speak) { try { ttsEngine.speak(text); } catch (e) { /* noop */ } return true; }
      loadTTS(); // motor neural (baixando/indisponível) → cai no fallback
    }
    return speakWebSpeech(text); // fallback imediato: Web Speech, no idioma do jogo
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
