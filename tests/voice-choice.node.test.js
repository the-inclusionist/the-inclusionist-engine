// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHILD PICKS THE VOICE, AMONG THE VOICES THAT SPEAK THE LANGUAGE (ADR-0185; issue #180) — the pure half: which voices a
// language has, and what `platform/tts` does with the choice. The neural voices are Kokoro's, through the game's port (ADR-0207).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { voicesForLocale } from '../app/js/platform/voice-plan.js';
import { KOKORO_VOICES } from '../app/js/platform/kokoro.js';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

describe('the voices of a language', () => {
  it('🔴 [Right] Portuguese lists its Kokoro voices and no English one', () => {
    expect(voicesForLocale('pt-BR', KOKORO_VOICES).map((v) => v.voice)).toEqual(['pf_dora', 'pm_alex', 'pm_santa']);
  });
  it('🔴 [Right] by the LANGUAGE, not the region: `en` lists the US and GB voices, `es-MX` the voices tagged `es`', () => {
    const ingles = voicesForLocale('en', KOKORO_VOICES).map((v) => v.voice);
    expect(ingles[0], 'Heart speaks first in English (ADR-0198 §3)').toBe('af_heart');
    expect(ingles).toContain('bf_emma');
    expect(voicesForLocale('es-MX', KOKORO_VOICES).map((v) => v.voice)).toEqual(['ef_dora', 'em_alex', 'em_santa']);
  });
  it('🎯 [Zero] a language with no voice lists none', () => {
    expect(voicesForLocale('fr-FR', KOKORO_VOICES)).toEqual([]);
  });
});

// each case its own backend (ADR-0232): the store `platform/tts` receives is built over it, and a case reads it directly
let guardado;
beforeEach(() => { guardado = memoryBackend(); });
// the browser's speech, lent the way the root lends it (ADR-0232 D4); it offers no voice of its own here
const speech = { synth: () => ({ cancel: () => {}, speak: () => {}, getVoices: () => [] }), utterance: (t) => ({ text: t }) };

function montar(comPorta) {
  const registro = {};
  const ctx = {
    store: createStorage(guardado),
    translator: createTranslator(), // the root's translator, played by the test (ADR-0232 D3)
    srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
    speech, now: () => 0, createAudio: () => { throw new Error('no neural utterance plays here'); },
    loadKokoro: () => new Promise(() => {}), // required (ADR-0232 D4); without the declaration it is never asked
  };
  if (comPorta) { // the game declared `uses: { neuralVoice: true }` (ADR-0216 §3); the loader is only this case's stand-in
    ctx.neuralVoice = true;
    ctx.loadKokoro = () => Promise.resolve({
      phonemize: async () => 'a', vocabulary: async () => ({ a: 1 }),
      voice: async (id) => { registro.voice = id; return new Float32Array(256); },
      session: async () => { throw new Error('no session here'); },
    });
  }
  return { tts: createTts(ctx), registro };
}
const assentar = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('platform/tts — the voice choice', () => {
  it('🔴 [Right] the panel lists the Kokoro voices of the current language with the port, and none without it', () => {
    expect(montar(true).tts.voices().map((v) => v.voice)).toEqual(['pf_dora', 'pm_alex', 'pm_santa']);
    expect(montar(false).tts.voices(), 'a voice listed without the port could never load').toEqual([]);
  });

  it('🔴 [Right] without a choice, the first voice of the language is the one in use', () => {
    expect(montar(true).tts.currentVoice()?.voice).toBe('pf_dora');
  });

  it('🔴 [Right] a choice is stored, and a voice of another language is refused', () => {
    const { tts } = montar(true);
    expect(tts.setVoice('af_heart'), 'an English voice was accepted for Portuguese').toBe(false);
    expect(guardado.getItem(KEYS.ttsVoz)).toBeNull();
    expect(tts.setVoice('pm_alex')).toBe(true);
    expect(guardado.getItem(KEYS.ttsVoz)).toBe('pm_alex');
  });

  it('🔴 [Right] with the port, the voice in use is the one that loads — without an engine choice first', async () => {
    const { tts, registro } = montar(true);
    tts.narrate('bom dia');
    await assentar();
    expect(registro.voice, 'the neural voice never loaded: the browser voice was still the default').toBe('pf_dora');
  });

  it('📌 [Boundary] without the port the default stays the browser voice, so no «not bundled» alert on the first word', () => {
    expect(montar(false).tts.getEngineSel()).toBe('webspeech');
  });

  it('🔴 [Zero] an engine stored before it left the engine (ADR-0207) is no choice: the voice in use speaks, no alert', () => {
    guardado.setItem(KEYS.ttsEngine, 'piper');
    expect(montar(true).tts.getEngineSel()).toBe('kokoro');
    expect(montar(false).tts.getEngineSel()).toBe('webspeech');
  });
});

// ============================== MUTATIONS CHECKED (all of #180, across its five test files) ==============================
//   V1 no language filter                         🔴 voices of a language, the lock
//   V2 region instead of language                 🔴 English (`en` is not `en-US`)
//   T1 stored pick ignored                        🔴 English pick
//   T2 a voice of another language accepted      🔴 refused
//   T3 default stays the browser voice            🔴 the voice that loads
//   T4 narration not locked                       🔴 locked
//   T5 no reload on a new pick                    🔴 new pick loads
//   I1 icon ignores semVoz · I2 icon act not refused · I3 snapshot without semVoz · R1 root passes no semVoz   🔴 each
//   P1 lock not applied · P2 locked row still acts · P3 no reason · P4 option shows the id · P5 no row · P6 pick not set   🔴 each
//   P7 list not set to the voice in use           🔴 — FIRST SURVIVED: a <select> opens on its first option by itself, and the
//                                                    case picked the first voice; it now picks the second
//   ADR-0207 (#193): K1 a retired stored engine still read as explicit   🔴 the retired engine case
