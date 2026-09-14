// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VOICE FOLLOWS THE PAGE'S LANGUAGE (ADR-0185; issue #180): in English the child's pick among two voices is the one that loads,
// and a new pick reloads the engine; in a language no voice speaks, narration is locked and no other language's voice is borrowed.
//
// 📌 The engine's three languages all have a voice, so the page's language is replaced here by one that has none — through
// the module that answers it (`core/i18n.bcp47`), and not through a hook in `platform/tts` that only a test would use.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const lingua = vi.hoisted(() => ({ tag: 'fr-FR' }));
vi.mock(import('../app/js/core/i18n.js'), async (original) => ({ ...(await original()), bcp47: () => lingua.tag }));
const { createTts } = await import('../app/js/platform/tts.js');

let spoke, guardado;
beforeEach(() => {
  spoke = []; guardado = {}; lingua.tag = 'fr-FR';
  globalThis.localStorage = { getItem: (k) => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = String(v); }, removeItem: (k) => { delete guardado[k]; } };
  globalThis.window = { speechSynthesis: { cancel: () => {}, speak: (u) => spoke.push(u) } };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
});
afterEach(() => { delete globalThis.localStorage; delete globalThis.window; delete globalThis.SpeechSynthesisUtterance; });

const montar = (over = {}) => createTts({
  srSay: () => {}, srAlert: () => {}, ensureAC: () => null, catNode: () => null, audioOut: () => null,
  getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }), ...over,
});

describe('a language no voice speaks', () => {
  it('🔴 [Right] lists no voice, and has none in use', () => {
    const tts = montar();
    expect(tts.vozes()).toEqual([]);
    expect(tts.vozAtual()).toBeNull();
  });

  it('🔴 [Right] narration is locked: nothing is spoken, not even by the browser voice', () => {
    const tts = montar();
    tts.narrate('bonjour');
    expect(spoke, 'narration spoke in a language the lock covers').toEqual([]);
    expect(tts.narrateCount).toBe(0);
  });

  it('🔴 [Right] no voice of another language is fetched', async () => {
    const pedidas = [];
    const tts = montar({ carregarVozNeural: () => Promise.resolve({ TtsSession: { create: (o) => { pedidas.push(o.voiceId); return Promise.resolve({ predict: () => Promise.reject(new Error('x')) }); } } }) });
    tts.setEngineSel('piper');
    tts.loadTTS();
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(pedidas, 'a Portuguese voice was fetched to read French').toEqual([]);
    expect(tts.setVoz('pt_BR-faber-medium'), 'a Portuguese voice was accepted for French').toBe(false);
  });
});

describe('English, where two voices speak', () => {
  const porta = (pedidas) => () => Promise.resolve({ TtsSession: { create: (o) => { pedidas.push(o.voiceId); return Promise.resolve({ predict: () => Promise.reject(new Error('x')) }); } } });
  const assentar = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

  it('🔴 [Right] the stored pick is the voice in use, not the first of the language', async () => {
    lingua.tag = 'en';
    const pedidas = [];
    const tts = montar({ carregarVozNeural: porta(pedidas) });
    expect(tts.vozes().map((v) => v.voice), 'Amy first (ADR-0198 erratum)').toEqual(['en_US-amy-medium', 'en_US-ryan-medium']);
    expect(tts.setVoz('en_US-ryan-medium')).toBe(true);
    expect(tts.vozAtual()?.voice).toBe('en_US-ryan-medium');
    tts.narrate('hello');
    await assentar();
    expect(pedidas, 'the first voice loaded instead of the pick').toEqual(['en_US-ryan-medium']);
  });

  it('🔴 [Right] a new pick after the engine loaded loads the new voice', async () => {
    lingua.tag = 'en';
    const pedidas = [];
    const tts = montar({ carregarVozNeural: porta(pedidas) });
    tts.narrate('hello');
    await assentar();
    expect(pedidas).toEqual(['en_US-amy-medium']);
    tts.setVoz('en_US-ryan-medium');
    tts.narrate('hello again');
    await assentar();
    expect(pedidas, 'the engine kept speaking the old voice').toEqual(['en_US-amy-medium', 'en_US-ryan-medium']);
  });
});