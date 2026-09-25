// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VOICE FOLLOWS THE PAGE'S LANGUAGE (ADR-0185; issue #180): in English the child's pick among two voices is the one that loads,
// and a new pick reloads the engine; in a language no voice speaks, narration is locked and no other language's voice is borrowed.
//
// 📌 The engine's three languages all have a Kokoro voice, so the page's language is replaced here by one that has none — through
// the translator the narration receives (ADR-0232 D3), whose `bcp47` answers the page's tag: the same port the root fills.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const lingua = { tag: 'fr-FR' };

let spoke, store;
beforeEach(() => {
  spoke = []; lingua.tag = 'fr-FR';
  store = createStorage(memoryBackend()); // each case its own store (ADR-0232): a voice picked in one is not read in the next
  globalThis.window = { speechSynthesis: { cancel: () => {}, speak: (u) => spoke.push(u), getVoices: () => [] } };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
});
afterEach(() => { delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; });

const montar = (over = {}) => createTts({
  store, translator: { ...createTranslator(), bcp47: () => lingua.tag },
  srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
  getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }), ...over,
});

describe('a language no voice speaks', () => {
  it('🔴 [Right] lists no voice, and has none in use', () => {
    const tts = montar();
    expect(tts.voices()).toEqual([]);
    expect(tts.currentVoice()).toBeNull();
  });

  it('🔴 [Right] narration is locked: nothing is spoken, not even by the browser voice', () => {
    const tts = montar();
    tts.narrate('bonjour');
    expect(spoke, 'narration spoke in a language the lock covers').toEqual([]);
    expect(tts.narrateCount).toBe(0);
  });

  it('🔴 [Right] no voice of another language is fetched', async () => {
    const pedidas = [];
    const tts = montar({ neuralVoice: true, loadKokoro: porta(pedidas) });
    tts.setEngineSel('kokoro');
    tts.loadTTS();
    await assentar();
    expect(pedidas, 'a Portuguese voice was fetched to read French').toEqual([]);
    expect(tts.setVoice('pf_dora'), 'a Portuguese voice was accepted for French').toBe(false);
  });
});

/** A Kokoro port whose voices are recorded as the engine asks for them; WebGPU returns speech. */
const porta = (pedidas) => () => Promise.resolve({
  phonemize: async () => 'a', vocabulary: async () => ({ a: 1 }),
  voice: async (id) => { pedidas.push(id); return new Float32Array(256); },
  session: async () => ({ synthesize: async () => Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 8) * 0.4) }),
});
const assentar = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

describe('English, where many voices speak', () => {
  it('🔴 [Right] the stored pick is the voice in use, not the first of the language', async () => {
    lingua.tag = 'en';
    const pedidas = [];
    const tts = montar({ neuralVoice: true, loadKokoro: porta(pedidas) });
    expect(tts.voices()[0]?.voice, 'Heart first (ADR-0198 §3)').toBe('af_heart');
    expect(tts.setVoice('af_bella')).toBe(true);
    expect(tts.currentVoice()?.voice).toBe('af_bella');
    tts.narrate('hello');
    await assentar();
    expect(pedidas, 'the first voice loaded instead of the pick').toEqual(['af_bella']);
  });

  it('🔴 [Right] a new pick after the engine loaded loads the new voice', async () => {
    lingua.tag = 'en';
    const pedidas = [];
    const tts = montar({ neuralVoice: true, loadKokoro: porta(pedidas) });
    tts.narrate('hello');
    await assentar();
    expect(pedidas).toEqual(['af_heart']);
    tts.setVoice('af_bella');
    tts.narrate('hello again');
    await assentar();
    expect(pedidas, 'the engine kept speaking the old voice').toEqual(['af_heart', 'af_bella']);
  });
});
