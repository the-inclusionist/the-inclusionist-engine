// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/kokoro — THE KOKORO VOICES, in their pure half (ADR-0186, ADR-0198; issue #181).
//
// Kokoro speaks by three steps, each measured in the lab on 2026-09-13/14: the text becomes phonemes (espeak-ng, the language's
// voice), the phonemes become the model's token ids (its tokenizer vocabulary), and the model turns the ids and a voice's style row
// into a 24 kHz waveform. The phonemizer, the runtime and the model arrive from the delivery (ADR-0216 §1); this module holds what
// the engine decides: which voices exist for a language and which two are good, how the ids are built, which style row a sentence
// takes, whether a synthesis is speech, and the WAV the player plays.
//
// No I/O on import.
import type { NeuralVoice } from './voice-plan.js';

/** A Kokoro inference session on one device: token ids and a style row in, a 24 kHz waveform out. */
export interface KokoroSession {
  readonly synthesize: (ids: readonly number[], styleVector: Float32Array) => Promise<Float32Array>;
}
/**
 * WHAT SPEAKING NEEDS OF KOKORO — `platform/kokoro-runtime` fills it from the delivery (ADR-0216 §1).
 * `phonemize` is espeak-ng in the voice's language (`pt-br`, `es-419`, `en-us`, `en-gb`); `vocabulary` the model tokenizer's symbols;
 * `voice` a voice's style table; `session` a session on WebGPU or WASM.
 *
 * 📌 IT LIVES IN THIS LEAF and not beside the speaking, so that the runtime that builds one can be reached from `platform/tts` by
 * `import()` without the two naming each other — a cycle the direction gate (ADR-0173) refuses, and rightly: the loader must not
 * have to load the speaker to be loaded by it.
 */
export interface KokoroModule {
  readonly phonemize: (texto: string, espeak: string) => Promise<string>;
  readonly vocabulary: () => Promise<Readonly<{ [symbol: string]: number }>>;
  readonly voice: (id: string) => Promise<Float32Array>;
  readonly session: (device: 'webgpu' | 'wasm') => Promise<KokoroSession>;
}
/** How the neural voice arrives. Until ADR-0216 every game wrote one of these; now the engine has its own. */
export type LoadKokoro = () => Promise<KokoroModule>;

/** A Kokoro voice of the engine's three languages. `recommended` marks the two the Dev rated good (ADR-0198 §3). */
export interface KokoroVoice extends NeuralVoice {
  readonly engine: 'kokoro';
  /** The espeak-ng voice that phonemizes this voice's text. */
  readonly espeak: string;
  readonly recommended: boolean;
}

const voiceEntry = (id: string, locale: string, espeak: string, isRecommended = false): KokoroVoice =>
  Object.freeze({ locale, engine: 'kokoro', voice: id, espeak, recommended: isRecommended });

/**
 * Kokoro-82M v1.0's voices for Portuguese, Spanish and English, as the model repository lists them (read 2026-09-14). The model's
 * first letter is the language — `p` Brazilian Portuguese, `e` Spanish, `a` American and `b` British English — and the second the
 * voice's gender. The others (French, Hindi, Italian, Japanese, Chinese) are not the engine's languages.
 */
export const KOKORO_VOICES: readonly KokoroVoice[] = Object.freeze([
  voiceEntry('pf_dora', 'pt-BR', 'pt-br'), voiceEntry('pm_alex', 'pt-BR', 'pt-br'), voiceEntry('pm_santa', 'pt-BR', 'pt-br'),
  voiceEntry('ef_dora', 'es', 'es-419'), voiceEntry('em_alex', 'es', 'es-419'), voiceEntry('em_santa', 'es', 'es-419'),
  voiceEntry('af_heart', 'en-US', 'en-us', true), voiceEntry('af_bella', 'en-US', 'en-us', true),
  ...['af_alloy', 'af_aoede', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
    'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa'].map((id) => voiceEntry(id, 'en-US', 'en-us')),
  ...['bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'].map((id) => voiceEntry(id, 'en-GB', 'en-gb')),
]);

/**
 * WHERE KOKORO COMES FROM, in one place (ADR-0114's rule for hosts): the model repository the catalogue fetches at build time; the
 * delivery serves the same paths from its own origin (ADR-0177), and a game's port asks for them there.
 */
const REPOSITORIO_KOKORO = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
export const KOKORO_MODEL_URL = `${REPOSITORIO_KOKORO}/onnx/model.onnx`;
export const URL_DO_TOKENIZADOR_KOKORO = `${REPOSITORIO_KOKORO}/tokenizer.json`;
export const kokoroVoiceUrl = (id: string): string => `${REPOSITORIO_KOKORO}/voices/${id}.bin`;

/**
 * Each voice file's SHA-256 and size, read from the repository's LFS metadata on 2026-09-14 (all 522 240 bytes); `pf_dora` also
 * measured on the downloaded file. The model: 325 532 232 bytes, measured on the file. Checked before anything is kept (#168).
 */
export const KOKORO_VOICES_SHA256: Readonly<{ [id: string]: string }> = Object.freeze({
  pf_dora: '3da7b5b2d91847ebf5646f57631af6ececae3c29a89cd300f06edf9aa6cfe9ee',
  pm_alex: '0175c753f59c54e7fd5a995bedef0c5ff2fb67e0043dd3dcb2ae74ec2acbeb2a',
  pm_santa: '8b012db3185778afe2e45a62cbad69db73021774fe68dda634bcc748a982eede',
  ef_dora: 'f66ec66bd295acb18372e37008533a9a3228483ccd294e7538d5d9294ac9a532',
  em_alex: '27809e9eafdcbcfff90a3016c697568676531de2a2c39cee29c96c7bd6b83e95',
  em_santa: 'ad43b774e1ca24d05c6161297d8aeb770ac3d29bb95daf516727af5f7d543683',
  af_heart: 'd583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b',
  af_bella: 'f69d836209b78eb8c66e75e3cda491e26ea838a3674257e9d4e5703cbaf55c8b',
  af_alloy: 'c4a6b876047fd7fb472edf4ebd63cfac7c3b958a7cae7c106e8f038ca6308c45',
  af_aoede: '4a004c33430762e2461eedb2013fad808ef4ab3121f5300f554476caf58d8361',
  af_jessica: 'a240a5e3c15b43563d6e923bdca8ef5613a23471d9b77653694012435df23bd8',
  af_kore: '9be5221b6a941c04b561959b8ff0b06e809444dcc4ab7e75a7b23606f691819e',
  af_nicole: 'cd2191ab31b914ed7b318416b0e4440fdf392ddad9106a060819aa600a64f59a',
  af_nova: '18778272caa0d0eebaea251c35fd635f038434f9eee5e691d02a174bd328414f',
  af_river: '00a2bcf82b1d86e8f19902ede58c65ccf6c0e43b44b7d74fad54e5d8933c9c30',
  af_sarah: '4409fbc125afabacc615d94db5398d847006a737b0247d6892b7a9a0007a2f0a',
  af_sky: '4435255c9744f3f31659e0d714ab7689bf65d9e77ec1cce060f083912614f0b9',
  am_adam: '162b035ed91cfc48b6046982184c645f72edcdd1b82843347f605d7bf7b15716',
  am_echo: '3968b92c3c4cd1c4416dbded36c13eaa388a90d5788d02a13e4d781f5f8cf3c3',
  am_eric: 'e8b5be17edd1e3636901ce7598baafe2dc8dd8ff707a0c23bf9e461add7e2832',
  am_fenrir: 'c27989f741f7ee34d273a39d8a595cc0837d35f5ced9a29b7cc162614616df43',
  am_liam: '52403be32fd047c6a44517cb0bcd6b134f2a18baa73e70ef41651e0eab921ade',
  am_michael: '1d1f21dd8da39c30705cd4c75d039d265e9bc4a2a93ed09bc9e1b1225eb95ba1',
  am_onyx: 'da5d135b424164916d75a68ffb4c2abce3d7d5ccc82dd1ee6cf447ce286145e6',
  am_puck: 'fcf73c989033e9233e0b98713eca600c8c74dcc1614b37009d5450ff4a2274a0',
  am_santa: '61150cf726ab6c5ed7a99f90a304f91f5a72c00c592e89ec94e5df11c319227a',
  bf_alice: '08afa6ba24da61ea5e8efa139e5aadc938d83f0a6da5a900adaf763ac1da5573',
  bf_emma: '669fe0647f9dd04fcab92f1439a40eeb4c8b4ab1f82e4996fe3d918ce4a63b73',
  bf_isabella: '3754352c4aaa46d17f27654ab7518d65b62ad6163a0f55a5f4330c2da2c4e94f',
  bf_lily: '5e0ee32ebe64a467124976b14e69590746f1c4ce41a12b587a50c862edfea335',
  bm_daniel: '6b3194bbceffb746733cbc22c8f593dd44e401a71d53895a2dca891bc595a1e8',
  bm_fable: 'f889083196807b4adb15e9204252165f503b8d33d3982e681c52443c49d798f1',
  bm_george: 'c4b235a4c1f2cd3b939fed08b899ce9385638b763f7b73a59616c4fc9bd6c9bc',
  bm_lewis: 'b8f671cef828c30e66fdf0b0756a76bba58f6bb3398cbbf27058642acbcedb97',
});
export const KOKORO_VOICE_BYTES = 522_240;
export const KOKORO_MODEL_SHA256 = '8fbea51ea711f2af382e88c833d9e288c6dc82ce5e98421ea61c058ce21a34cb';
export const KOKORO_MODEL_BYTES = 325_532_232;
export const SHA256_DO_TOKENIZADOR_KOKORO = '77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34';
export const BYTES_DO_TOKENIZADOR_KOKORO = 3_497;

/** The model's context: ids between the two pad tokens. A longer sentence is cut here (the caller splits text by sentence). */
export const MAX_KOKORO_TOKENS = 510;
/** A voice file is a table of style rows, one per token count, 256 numbers each. */
export const STYLE_DIMENSION = 256;
const KOKORO_SAMPLE_RATE = 24_000;

/** The token ids of a phoneme string: each symbol the vocabulary knows, in order, between two pad tokens (id 0). */
export function tokenizar(phonemes: string, symbolIds: Readonly<{ [symbol: string]: number }>): number[] {
  const ids: number[] = [];
  for (const symbol of phonemes) {
    const id = symbolIds[symbol];
    if (id !== undefined) ids.push(id);
    if (ids.length === MAX_KOKORO_TOKENS) break;
  }
  return [0, ...ids, 0];
}

/** The style row a sentence of `tokens` ids (pads excluded) takes from a voice table. */
export function sentenceStyle(styleTable: Float32Array, tokens: number): Float32Array {
  const rowCount = Math.floor(styleTable.length / STYLE_DIMENSION);
  const row = Math.max(0, Math.min(rowCount - 1, tokens));
  return styleTable.slice(row * STYLE_DIMENSION, (row + 1) * STYLE_DIMENSION);
}

/**
 * Is a synthesis speech? Measured on 2026-09-14: WebGPU on one AMD GPU gave a waveform whose samples ran to 2×10⁷ — noise a child
 * would hear as a burst. A speech waveform stays within ±1 (a sample or two past it is clipping, not noise) and is not silent.
 */
export function eFala(waveform: ArrayLike<number>): boolean {
  if (waveform.length === 0) return false;
  let outside = 0, energy = 0;
  for (let i = 0; i < waveform.length; i++) {
    const s = waveform[i]!;
    if (!Number.isFinite(s)) return false;
    if (Math.abs(s) > 1.5) outside++;
    energy += s * s;
  }
  return outside === 0 && Math.sqrt(energy / waveform.length) > 1e-3;
}

/** A 16-bit mono PCM WAV of a waveform, clipped to ±1 — what the narration's media element plays. */
export function wavDe(waveform: ArrayLike<number>, sampleRate = KOKORO_SAMPLE_RATE): ArrayBuffer {
  const n = waveform.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const texto = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); texto(8, 'WAVE'); texto(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); texto(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, waveform[i]!)) * 32767), true);
  return buf;
}
