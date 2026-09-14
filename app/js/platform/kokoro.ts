// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/kokoro — THE KOKORO VOICES, in their pure half (ADR-0186, ADR-0198; issue #181).
//
// Kokoro speaks by three steps, each measured in the lab on 2026-09-13/14: the text becomes phonemes (espeak-ng, the language's
// voice), the phonemes become the model's token ids (its tokenizer vocabulary), and the model turns the ids and a voice's style row
// into a 24 kHz waveform. The phonemizer, the runtime and the model come through the game's port (ADR-0198 §5) — the engine names
// none of them; this module holds what the engine decides: which voices exist for a language and which two are good, how the ids
// are built, which style row a sentence takes, whether a synthesis is speech, and the WAV the player plays.
//
// No I/O on import.
import type { VozNeural } from './voice-plan.js';

/** A Kokoro voice of the engine's three languages. `boa` marks the two the Dev rated good (ADR-0198 §3). */
export interface VozKokoro extends VozNeural {
  readonly engine: 'kokoro';
  /** The espeak-ng voice that phonemizes this voice's text. */
  readonly espeak: string;
  readonly boa: boolean;
}

const voz = (id: string, locale: string, espeak: string, boa = false): VozKokoro =>
  Object.freeze({ locale, engine: 'kokoro', voice: id, espeak, boa });

/**
 * Kokoro-82M v1.0's voices for Portuguese, Spanish and English, as the model repository lists them (read 2026-09-14). The model's
 * first letter is the language — `p` Brazilian Portuguese, `e` Spanish, `a` American and `b` British English — and the second the
 * voice's gender. The others (French, Hindi, Italian, Japanese, Chinese) are not the engine's languages.
 */
export const VOZES_KOKORO: readonly VozKokoro[] = Object.freeze([
  voz('pf_dora', 'pt-BR', 'pt-br'), voz('pm_alex', 'pt-BR', 'pt-br'), voz('pm_santa', 'pt-BR', 'pt-br'),
  voz('ef_dora', 'es', 'es-419'), voz('em_alex', 'es', 'es-419'), voz('em_santa', 'es', 'es-419'),
  voz('af_heart', 'en-US', 'en-us', true), voz('af_bella', 'en-US', 'en-us', true),
  ...['af_alloy', 'af_aoede', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky',
    'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa'].map((id) => voz(id, 'en-US', 'en-us')),
  ...['bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'].map((id) => voz(id, 'en-GB', 'en-gb')),
]);

/** The model's context: ids between the two pad tokens. A longer sentence is cut here (the caller splits text by sentence). */
export const TOKENS_MAXIMOS = 510;
/** A voice file is a table of style rows, one per token count, 256 numbers each. */
export const DIMENSAO_DO_ESTILO = 256;
const TAXA_KOKORO = 24_000;

/** The token ids of a phoneme string: each symbol the vocabulary knows, in order, between two pad tokens (id 0). */
export function tokenizar(fonemas: string, vocabulario: Readonly<{ [simbolo: string]: number }>): number[] {
  const ids: number[] = [];
  for (const simbolo of fonemas) {
    const id = vocabulario[simbolo];
    if (id !== undefined) ids.push(id);
    if (ids.length === TOKENS_MAXIMOS) break;
  }
  return [0, ...ids, 0];
}

/** The style row a sentence of `tokens` ids (pads excluded) takes from a voice table. */
export function estiloDaFrase(tabela: Float32Array, tokens: number): Float32Array {
  const linhas = Math.floor(tabela.length / DIMENSAO_DO_ESTILO);
  const linha = Math.max(0, Math.min(linhas - 1, tokens));
  return tabela.slice(linha * DIMENSAO_DO_ESTILO, (linha + 1) * DIMENSAO_DO_ESTILO);
}

/**
 * Is a synthesis speech? Measured on 2026-09-14: WebGPU on one AMD GPU gave a waveform whose samples ran to 2×10⁷ — noise a child
 * would hear as a burst. A speech waveform stays within ±1 (a sample or two past it is clipping, not noise) and is not silent.
 */
export function eFala(onda: ArrayLike<number>): boolean {
  if (onda.length === 0) return false;
  let fora = 0, energia = 0;
  for (let i = 0; i < onda.length; i++) {
    const s = onda[i]!;
    if (!Number.isFinite(s)) return false;
    if (Math.abs(s) > 1.5) fora++;
    energia += s * s;
  }
  return fora === 0 && Math.sqrt(energia / onda.length) > 1e-3;
}

/** A 16-bit mono PCM WAV of a waveform, clipped to ±1 — what the narration's media element plays. */
export function wavDe(onda: ArrayLike<number>, taxa = TAXA_KOKORO): ArrayBuffer {
  const n = onda.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const texto = (o: number, s: string): void => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); texto(8, 'WAVE'); texto(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); texto(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, onda[i]!)) * 32767), true);
  return buf;
}
