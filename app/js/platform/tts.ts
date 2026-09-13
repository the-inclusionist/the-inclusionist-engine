// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/tts — narração por voz. Motor NEURAL pt-BR carregado LAZY pela PORTA que o jogo fornece (ADR-0094; modelo
// em cache OPFS → a 2ª sessão fala offline), com FALLBACK imediato p/ a voz nativa do navegador (Web Speech) — que é
// também o que se ouve quando não há porta nenhuma, e é por isso que a ausência dela não cala nada. narrate() é o
// ponto de entrada, gated pelo toggle 'Narração (TTS)' do mixer (audioCat.tts.on) — independe das legendas. As funções de
// PAINEL (populateTTSEngines/Voices/reflectTTS) ficam no game.js (→ ui/settings-audio, #38→#54) e usam get/setEngineSel +
// get/setVoiceObj daqui. Injeção por closure. Ver docs/plano-tts-fase-f5.md + docs/5-Refactoring/plano-modularizacao-mapa.md.

import * as store from './storage.js';
import { t, bcp47 } from '../core/i18n.js';
import { criarFalaInterrompivel } from './interruptible-speech.js';
import { caminhoNaEntrega } from './pesados.js';
import { vozesDoIdioma, type VozNeural } from './voice-plan.js';

interface TtsEngine { id: string; speak: (text: string) => void; }

/**
 * O QUE A ENGINE PRECISA DE UM MOTOR NEURAL — e nada mais. Duas chamadas, escritas aqui em vez de importadas
 * do fornecedor, porque importar o TIPO obrigaria o pacote a estar instalado para o `tsc` do consumidor
 * correr: seria o mesmo defeito do ADR-0093 mudado de campo, do `dependencies` para o espaço de tipos.
 */
export interface SessaoNeural {
  predict: (texto: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>;
}
export interface LocaisDoRuntime {
  onnxWasm: string;
  piperData: string;
  piperWasm: string;
}
export interface ModuloNeural {
  TtsSession: {
    create: (o: {
      voiceId: string;
      progress?: (p: { loaded: number; total: number }) => void;
      logger?: (...a: unknown[]) => void;
      wasmPaths?: LocaisDoRuntime;
    }) => Promise<SessaoNeural>;
    /** The provider's default runtime addresses; read so the engine overrides one of them and writes none (#173). */
    WASM_LOCATIONS?: LocaisDoRuntime;
  };
}
/** A PORTA (ADR-0094). Uma linha do lado do jogo: `() => import('@mintplex-labs/piper-tts-web')`. */
export type CarregarVozNeural = () => Promise<ModuloNeural>;

export interface TtsCtx {
  srSay: (t: string) => void;
  srAlert: (t: string) => void;
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;
  audioOut: () => AudioNode | null;
  getSoundOn: () => boolean;
  getVolume: () => number;
  getAudioCat: () => Record<string, { on: boolean }> | null; // narrate checa audioCat.tts.on
  /**
   * COMO SE CARREGA O MOTOR NEURAL — fornecido pelo JOGO, ausente por omissão (ADR-0094).
   *
   * ⚠️ A engine NÃO NOMEIA O FORNECEDOR, e o motivo é medido: o `@mintplex-labs/piper-tts-web` traz
   * `onnxruntime-web` como peer NÃO-opcional, que o npm instala sozinho — **135,4 MB** no `node_modules` de
   * todo consumidor, incluindo um que nunca fale por voz neural. Nomeá-lo aqui obrigaria os 135 MB, e
   * declará-lo em `devDependencies` (como estava até 06/09) publica um pacote que não compila.
   *
   * Ausente = a narração cai na voz do navegador (Web Speech), que fala o idioma certo e não pesa nada.
   */
  carregarVozNeural?: CarregarVozNeural;
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
  /**
   * ESTA MONTAGEM TEM MOTOR NEURAL? (ADR-0094) O painel de áudio pergunta antes de o oferecer: uma opção
   * que não pode funcionar é pior que uma opção a menos — quem a escolhe fica à espera de um download que
   * nunca começa, e quem navega por escuta não tem como ver que não começou.
   */
  readonly neuralDisponivel: boolean;
  /** The voices of the current language the child may pick (ADR-0185); empty locks the speech rows and the bar's button. */
  vozes: () => readonly VozNeural[];
  /** The voice in use: the stored choice when it speaks the language, else the language's first voice, else none. */
  vozAtual: () => VozNeural | null;
  /** Stores the choice. A voice that does not speak the current language is refused (`false`). */
  setVoz: (id: string) => boolean;
}

// ⚠️ MIGRAÇÃO PENDENTE (ADR-0022): a implementação neural de hoje é o @mintplex-labs/piper-tts-web e será SUBSTITUÍDA
// por sherpa-onnx-wasm (loader universal, modelos VITS/Piper + Kokoro-multi-lang carregados de qq URL R2 em runtime via
// FS.writeFile; lazy-fetch; eSpeak/Web Speech de fallback).
// 🔴 O MOTIVO ESCRITO AQUI ERA «@mintplex-labs foi descontinuado e só carrega 2 vozes pt-BR», E AS DUAS METADES
// FORAM MEDIDAS FALSAS EM 2026-09-09 — não pela leitura de um registo, que é como elas se propagaram por seis
// sítios, mas pelo registo npm e pelo pacote instalado:
//   · DESCONTINUADO: nenhuma versão tem campo `deprecated`, e a 1.0.5 foi publicada em 2026-08-11 — depois de
//     o ADR-0022 (2026-07-06) a dar por morta. A frase é de Julho e está atribuída ao Dev; o registo não a nega
//     no passado, nega-a HOJE.
//   · DUAS VOZES pt-BR: o `VoiceId` da 1.0.4 instalada traz 118 vozes, e entre elas as QUATRO exactas do
//     ADR-0110 — `pt_BR-faber-medium`, `en_US-ryan-medium`, `en_US-amy-medium`, `es_MX-claude-high`.
// ⚠️ O QUE CONTINUA VERDADEIRO, e é mais afiado do que o motivo velho: o bundle prende `HF_BASE` a
// `huggingface.co/diffusionstudio/piper-voices` COM UMA GUARDA (`if (!url.match("https://huggingface.co")) return`),
// logo nenhum espelho de escola é alcançável por ele; e ele busca o PRÓPRIO runtime de cdnjs/jsDelivr por
// omissão, que é o que o ADR-0114 retira. A montante, o Piper mudou para `OHF-Voice/piper1-gpl` e a Open Home
// Foundation procura mantenedores — o risco existe, mas está noutro sítio.
// 📌 A ESCOLHA CONTINUA A SER A #129, e este comentário não a toma: descreve o que foi medido para que o
// próximo leitor não herde o motivo velho como se fosse medição.
// ⚠️ E DESDE O ADR-0094 ESTE MÓDULO NÃO NOMEIA FORNECEDOR NENHUM — quem o nomeia é o JOGO, por `ctx.carregarVozNeural`.
// O nome estava aqui num `import()` e o pacote em `devDependencies`, o que publicou uma engine que não compilava
// (ADR-0093); pô-lo em `dependencies` consertava o build e obrigava todo consumidor a 135,4 MB de `onnxruntime-web`,
// que o fornecedor traz como peer não-opcional. A porta é o que faz a troca do ADR-0022 não ser um segundo abalo.
export function createTts(ctx: TtsCtx): Tts {
  let ttsEngine: TtsEngine | null = null, ttsLoading = false, ttsFailed = false, _ttsPct = 0, _narrateCount = 0;
  let _ttsVoiceObj: SpeechSynthesisVoice | null = null; // voz do Web Speech selecionada
  // With the neural engine the voice of the language speaks by default (ADR-0185 §3); without it, the browser's voice —
  // defaulting to Piper there would open every game without the engine on a «not bundled» alert.
  let ttsEngineSel = store.get(store.KEYS.ttsEngine, null) || (ctx.carregarVozNeural ? 'piper' : 'webspeech'); // webspeech | piper | kokoro | kitten | espeak
  let vozCarregada: string | null = null; // the voice the loaded engine speaks; another choice reloads it

  const vozes = (): readonly VozNeural[] => vozesDoIdioma(bcp47());
  function vozAtual(): VozNeural | null {
    const lista = vozes();
    const guardada = store.get(store.KEYS.ttsVoz, null);
    return lista.find((v) => v.voice === guardada) ?? lista[0] ?? null;
  }
  function setVoz(id: string): boolean {
    if (!vozes().some((v) => v.voice === id)) return false;
    store.set(store.KEYS.ttsVoz, id);
    if (ctx.carregarVozNeural) ttsEngineSel = 'piper';
    return true;
  }

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
    // ESTA MONTAGEM NÃO TRAZ MOTOR NEURAL (ADR-0094). Vem ANTES da pergunta do idioma de propósito: sem
    // porta, não há voz neural em idioma nenhum, e dizer «não há voz para o teu idioma» faria a criança
    // pensar que trocar de idioma resolveria. `ttsFailed` para não repetir a pergunta a cada fala.
    const carregar = ctx.carregarVozNeural;
    if (!carregar) { ttsFailed = true; ctx.srAlert(t('sr.tts.neuralNotBundled')); return; }
    // The voice in use for the current language (ADR-0185). None: another language's voice is NOT fetched — it would read
    // this text with the wrong phonetics.
    const fonte = vozAtual();
    if (!fonte) { ctx.srAlert(t('sr.tts.noNeuralForLanguage')); return; }
    ttsLoading = true; vozCarregada = fonte.voice; const t0 = performance.now(); ctx.srSay(t('sr.tts.downloading'));
    carregar().then(async (mod) => { // o jogo é que sabe de onde; o Vite dele faz o code-split. Ver ADR-0021 e ADR-0094
      // 🎯 onnxruntime runs the wasm the GAME bundled (ADR-0177, issue #173): the provider otherwise points
      // `ort.env.wasm.wasmPaths` at cdnjs 1.18.0 — a host outside the policy, and not the version the game imports.
      // `undefined` lets onnxruntime resolve the file Vite emitted next to it. The phonemizer is asked at the DELIVERY path
      // of the provider's own addresses (read from the module, never written here): the delivery carries it in `pesados/`
      // and the service worker answers from the checked cache. Without those addresses no wasmPaths goes, since a partial
      // one would leave the phonemizer with none.
      const locais = mod.TtsSession.WASM_LOCATIONS;
      const wasmPaths = locais ? {
        onnxWasm: undefined as unknown as string,
        piperWasm: caminhoNaEntrega(locais.piperWasm),
        piperData: caminhoNaEntrega(locais.piperData),
      } : undefined;
      const session = await mod.TtsSession.create({ voiceId: fonte.voice,
        progress: (p: { loaded: number; total: number }) => { if (!p || !p.total) return; const pct = Math.round(p.loaded * 100 / p.total); if (pct >= _ttsPct + 25 && pct < 100) { _ttsPct = pct; ctx.srSay(t('sr.tts.progress', { pct })); } },
        logger: () => {}, ...(wasmPaths ? { wasmPaths } : {}) });
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
          if (!ac) throw new Error('AudioContext unavailable'); // o `catch` de lá trata: silêncio deste item, motor vivo
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
      // another voice picked, or the language changed, since the engine loaded: load the voice in use
      if (ttsEngine && vozCarregada !== vozAtual()?.voice) { ttsEngine = null; ttsFailed = false; }
      if (ttsEngine && ttsEngine.id === ttsEngineSel && ttsEngine.speak) { try { ttsEngine.speak(text); } catch (e) { /* noop */ } return true; }
      loadTTS(); // motor neural (baixando/indisponível) → cai no fallback
    }
    return speakWebSpeech(text); // fallback imediato: Web Speech, no idioma do jogo
  }

  function narrate(text: string): void { // gated pelo toggle 'Narração (TTS)' do mixer, independente das legendas
    const cat = ctx.getAudioCat(); if (!ctx.getSoundOn() || !cat || !cat.tts || !cat.tts.on || !text) return;
    if (vozes().length === 0) return; // no voice speaks this language: narration is locked (ADR-0185 §4)
    _narrateCount++; ttsSpeak(text);
  }

  return {
    narrate, ttsSpeak, loadTTS, speakWebSpeech,
    getEngineSel: () => ttsEngineSel, setEngineSel: (v) => { ttsEngineSel = v; },
    getEngine: () => ttsEngine, getVoiceObj: () => _ttsVoiceObj, setVoiceObj: (v) => { _ttsVoiceObj = v; },
    get loading() { return ttsLoading; }, get failed() { return ttsFailed; }, get narrateCount() { return _narrateCount; },
    get neuralDisponivel() { return !!ctx.carregarVozNeural; },
    vozes, vozAtual, setVoz,
  };
}
