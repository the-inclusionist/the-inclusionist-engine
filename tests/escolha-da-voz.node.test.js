// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHILD PICKS THE VOICE, AMONG THE VOICES THAT SPEAK THE LANGUAGE (ADR-0185; issue #180) — the pure half: which voices a
// language has, and what `platform/tts` does with the choice.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vozesDoIdioma } from '../app/js/platform/voice-plan.js';
import { createTts } from '../app/js/platform/tts.js';
import * as store from '../app/js/platform/storage.js';

describe('the voices of a language', () => {
  it('🔴 [Right] Portuguese lists its Piper voice and no English one', () => {
    expect(vozesDoIdioma('pt-BR').map((v) => v.voice)).toEqual(['pt_BR-faber-medium']);
  });
  it('🔴 [Right] English lists both English voices, Spanish its own — by the LANGUAGE, not the region', () => {
    expect(vozesDoIdioma('en').map((v) => v.voice)).toEqual(['en_US-ryan-medium', 'en_US-amy-medium']);
    expect(vozesDoIdioma('es-ES').map((v) => v.voice), 'a Mexican voice reads Spanish from Spain too').toEqual(['es_MX-claude-high']);
  });
  it('🎯 [Zero] a language with no voice lists none', () => {
    expect(vozesDoIdioma('fr-FR')).toEqual([]);
  });
});

let guardado;
beforeEach(() => {
  guardado = {};
  globalThis.localStorage = { getItem: (k) => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = String(v); }, removeItem: (k) => { delete guardado[k]; } };
  globalThis.window = { speechSynthesis: { cancel: () => {}, speak: () => {} } };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
});
afterEach(() => { delete globalThis.localStorage; delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; });

function montar(comPorta) {
  const registro = {};
  const ctx = {
    srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
  };
  if (comPorta) {
    ctx.carregarVozNeural = () => Promise.resolve({ TtsSession: { create: (o) => { registro.voiceId = o.voiceId; return Promise.resolve({ predict: () => Promise.reject(new Error('no audio')) }); } } });
  }
  return { tts: createTts(ctx), registro };
}
const assentar = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('platform/tts — the voice choice', () => {
  it('🔴 [Right] the panel asks the voices of the current language, with or without the neural engine', () => {
    expect(montar(true).tts.vozes().map((v) => v.voice)).toEqual(['pt_BR-faber-medium']);
    // ADR-0185 §2: a Piper voice is listed by its language alone; without the engine the browser's voice narrates (ADR-0094)
    expect(montar(false).tts.vozes().map((v) => v.voice)).toEqual(['pt_BR-faber-medium']);
  });

  it('🔴 [Right] without a choice, the first voice of the language is the one in use', () => {
    expect(montar(true).tts.vozAtual()?.voice).toBe('pt_BR-faber-medium');
  });

  it('🔴 [Right] a choice is stored, and a voice of another language is refused', () => {
    const { tts } = montar(true);
    expect(tts.setVoz('en_US-amy-medium'), 'an English voice was accepted for Portuguese').toBe(false);
    expect(localStorage.getItem(store.KEYS.ttsVoz)).toBeNull();
    expect(tts.setVoz('pt_BR-faber-medium')).toBe(true);
    expect(localStorage.getItem(store.KEYS.ttsVoz)).toBe('pt_BR-faber-medium');
  });

  it('🔴 [Right] with the neural engine, the voice in use is the one that loads — without an engine choice first', async () => {
    const { tts, registro } = montar(true);
    tts.narrate('bom dia');
    await assentar();
    expect(registro.voiceId, 'the neural voice never loaded: the browser voice was still the default').toBe('pt_BR-faber-medium');
  });

  it('📌 [Boundary] without the neural engine the default stays the browser voice, so no «not bundled» alert on the first word', () => {
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