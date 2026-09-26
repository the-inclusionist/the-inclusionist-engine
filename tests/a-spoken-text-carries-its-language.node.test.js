// SPDX-License-Identifier: AGPL-3.0-or-later
// A SPOKEN TEXT CARRIES ITS LANGUAGE (ADR-0243) — `platform/tts` in the NODE project: the browser's speech is a lent port, so
// what each utterance asked of the browser (its text, its tag, its voice) can be read in order.
//
// The translator is played by the case with a MUTABLE language: `bcp47()` is read at every utterance, so a switch is one
// assignment, and `t` is the Portuguese dictionary's (what the engine announces is not the subject here).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const LUCIANA = { name: 'Luciana', lang: 'pt-BR' };
const SAMANTHA = { name: 'Samantha', lang: 'en-US' };
const MONICA = { name: 'Monica', lang: 'es-ES' };

let spoke, voices, language;
beforeEach(() => {
  spoke = []; language = 'pt-BR';
  voices = [LUCIANA, SAMANTHA, MONICA];
});

/** The browser's speech, lent the way the root lends it (ADR-0232 D4): `speak` records, nothing sounds. */
const synth = { cancel: () => {}, speak: (u) => spoke.push(u), getVoices: () => voices };
const speech = { synth: () => synth, utterance: (text) => ({ text, lang: '', rate: 0, volume: 0, voice: null }) };

function setup() {
  const { t } = createTranslator();
  return createTts({
    store: createStorage(memoryBackend()),
    translator: { t, bcp47: () => language },
    srSay: () => {}, srAlert: () => {},
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
    speech, now: () => 0, createAudio: () => { throw new Error('no neural utterance plays in these cases'); },
    loadKokoro: () => new Promise(() => {}),
  });
}

describe('§5 · narration follows the language of now', () => {
  it('🔴 [Right] a voice chosen in Portuguese does not read the English narration after a switch', () => {
    const tts = setup();
    expect(tts.setVoice('webspeech:Luciana'), 'the Portuguese voice was not chosen — the case would measure nothing').toBe(true);
    tts.narrate('bom dia');
    expect(spoke[0].voice).toBe(LUCIANA);
    language = 'en-US';
    tts.narrate('good morning');
    expect(spoke[1].lang).toBe('en-US');
    expect(spoke[1].voice, 'English narration came out of the pt-BR voice').toBe(SAMANTHA);
  });

  it('🔴 [Right] the page\'s system-voice object of the old language is dropped, not kept for the way back', () => {
    const tts = setup();
    tts.setVoiceObj(LUCIANA); // what the page's `#tts-voice` list hands `tts` (ui/voice-settings)
    language = 'es-MX';
    tts.narrate('buenos días');
    expect(spoke[0].voice).toBe(MONICA);
    expect(tts.getVoiceObj(), 'the old language\'s voice object outlived the switch').toBeNull();
  });

  it('🎯 [Right] a voice object of the language of now is kept — the fix does not drop every choice', () => {
    const tts = setup();
    const otherPortuguese = { name: 'Felipe', lang: 'pt_BR' }; // an Android-style tag is the same language
    voices = [LUCIANA, otherPortuguese, SAMANTHA];
    tts.setVoiceObj(otherPortuguese);
    tts.narrate('bom dia');
    expect(spoke[0].voice).toBe(otherPortuguese);
  });
});

const DANIEL = { name: 'Daniel', lang: 'en-GB' };
const HELIA = { name: 'Helia', lang: 'pt-PT' };

const texts = () => spoke.map((u) => u.text);
const settle = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

/** A Kokoro module that does not exist: it records the voices asked for and the texts phonemized, in their espeak language. */
function fakeKokoro(record) {
  return () => Promise.resolve({
    phonemize: async (text, espeak) => { record.phonemized.push(`${text}|${espeak}`); return 'a'; },
    vocabulary: async () => ({ a: 1 }),
    voice: async (id) => { record.voices.push(id); return new Float32Array(256); },
    session: async () => ({ synthesize: async () => Float32Array.from({ length: 2400 }, (_, i) => Math.sin(i / 8) * 0.4) }),
  });
}

function setupNeural(record) {
  const { t } = createTranslator();
  return createTts({
    store: createStorage(memoryBackend()),
    translator: { t, bcp47: () => language },
    srSay: () => {}, srAlert: () => {},
    ensureAC: () => null, catNode: () => null, audioOut: () => null, // no audio context: a neural utterance ends at synthesis
    getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
    speech, now: () => 0, createAudio: () => { throw new Error('no neural utterance plays here'); },
    neuralVoice: true, loadKokoro: fakeKokoro(record),
  });
}

describe('§1 · a game speaks in parts, in order', () => {
  it('🔴 [Right] the frame in the interface\'s voice, the content in a voice of its own language, in the order given', () => {
    const tts = setup();
    tts.narrate([{ text: 'Escreva a palavra:' }, { text: 'apple', language: 'en-US' }, { text: 'e depois' }, { text: 'manzana', language: 'es' }]);
    expect(texts()).toEqual(['Escreva a palavra:', 'apple', 'e depois', 'manzana']);
    expect(spoke.map((u) => u.lang)).toEqual(['pt-BR', 'en-US', 'pt-BR', 'es']);
    expect(spoke.map((u) => u.voice), 'an English word read by the Portuguese voice').toEqual([LUCIANA, SAMANTHA, LUCIANA, MONICA]);
    expect(tts.narrateCount, 'one narration, however many parts').toBe(1);
  });

  it('🎯 [Right] a text alone is still one utterance in the interface\'s language', () => {
    const tts = setup();
    tts.narrate('bom dia');
    expect(spoke).toHaveLength(1);
    expect(spoke[0].lang).toBe('pt-BR');
  });

  it('🎯 [Zero] empty parts are not spoken, and a list of nothing narrates nothing', () => {
    const tts = setup();
    tts.narrate([{ text: '' }, { text: '', language: 'en' }]);
    tts.narrate([]);
    expect(spoke).toEqual([]);
    expect(tts.narrateCount).toBe(0);
  });

  it('🎯 [Right] the frame obeys the narration lock of its language, the content does not borrow it (ADR-0185 §4)', () => {
    voices = [SAMANTHA];
    const tts = setup(); // Portuguese interface, no Portuguese voice: the frame is locked
    tts.narrate([{ text: 'Escreva:' }, { text: 'apple', language: 'en' }]);
    expect(texts()).toEqual(['apple']);
    expect(spoke[0].voice).toBe(SAMANTHA);
  });
});

describe('§2 · the voice of a language', () => {
  it('🔴 [Right] the exact tag before the same language: a pt-BR part is read by the pt-BR voice, not the first Portuguese one', () => {
    voices = [HELIA, LUCIANA, SAMANTHA];
    language = 'en-US';
    setup().narrate([{ text: 'lata', language: 'pt-BR' }]);
    expect(spoke[0].voice).toBe(LUCIANA);
  });

  it('🔴 [Right] with no exact tag, a voice of the same language reads it — pt-PT for a pt-BR part when it is the only one', () => {
    voices = [SAMANTHA, HELIA];
    language = 'en-US';
    setup().narrate([{ text: 'lata', language: 'pt-BR' }]);
    expect(spoke[0].voice).toBe(HELIA);
  });

  it('🔴 [Right] the child\'s chosen voice reads its language, even in a part of an interface in another language', () => {
    voices = [SAMANTHA, DANIEL, LUCIANA];
    language = 'en-GB';
    const tts = setup();
    expect(tts.setVoice('webspeech:Samantha')).toBe(true); // chosen while the interface was English
    language = 'pt-BR';
    tts.narrate([{ text: 'Leia:' }, { text: 'colour', language: 'en-GB' }]);
    expect(spoke[1].voice, 'the exact tag won over the child\'s choice').toBe(SAMANTHA);
  });

  it('🔴 [Right] no voice of another language ever reads a part: with no French voice, the French part is not spoken', () => {
    const tts = setup();
    tts.narrate([{ text: 'Leia:' }, { text: 'bonjour', language: 'fr-FR' }]);
    expect(texts()).not.toContain('bonjour');
    expect(spoke.every((u) => u.voice !== null && u.voice.lang.startsWith('pt')), 'a voice of another language read the part').toBe(true);
  });

  it('🔴 [Right] a neural voice of the exact tag reads the part once the model is loaded — after the frame before it ended', async () => {
    const record = { voices: [], phonemized: [] };
    voices = [LUCIANA, SAMANTHA]; // the device speaks en-US, not en-GB; Kokoro has British voices
    const tts = setupNeural(record);
    tts.narrate([{ text: 'Leia:' }, { text: 'colour', language: 'en-GB' }]);
    // the model is not loaded yet: the part starts the load and the device's English voice reads it meanwhile
    expect(texts()).toEqual(['Leia:', 'colour']);
    expect(spoke[1].voice).toBe(SAMANTHA);
    await settle();
    expect(record.voices, 'the British voice was not the one loaded').toEqual(['bf_alice']);
    spoke.length = 0; record.phonemized.length = 0;
    tts.narrate([{ text: 'Leia:' }, { text: 'colour', language: 'en-GB' }]);
    expect(texts(), 'the neural part spoke through the browser').toEqual(['Leia:']);
    await settle();
    expect(record.phonemized, 'the neural part did not wait for the frame before it').toEqual([]);
    spoke[0].onend();
    await settle();
    expect(record.phonemized).toEqual(['colour|en-gb']);
  });

  it('🔴 [Right] one loaded model reads each part with its own voice and phonemizer: pt-BR frame, en-GB content, in order', async () => {
    const record = { voices: [], phonemized: [] };
    voices = []; // the device lists no voice: the interface speaks neurally (pf_dora) and so does the content
    const tts = setupNeural(record);
    tts.narrate('bom dia'); // loads the model with the interface's voice
    await settle();
    expect(record.voices).toEqual(['pf_dora']);
    record.phonemized.length = 0;
    tts.narrate([{ text: 'Leia:' }, { text: 'colour', language: 'en-GB' }]);
    await settle();
    expect(record.phonemized, 'each part in its own language, in order').toEqual(['Leia:|pt-br', 'colour|en-gb']);
    expect(record.voices, 'the British voice\'s style table was never asked for').toEqual(['pf_dora', 'bf_alice']);
  });

  it('🔴 [Right] a newer narration ends the parts an older one still had to speak', async () => {
    const record = { voices: [], phonemized: [] };
    voices = [LUCIANA];
    const tts = setupNeural(record);
    tts.narrate([{ text: 'x', language: 'en-GB' }]); // loads the model; no English browser voice, so nothing speaks now
    await settle();
    spoke.length = 0; record.phonemized.length = 0;
    tts.narrate([{ text: 'Leia:' }, { text: 'colour', language: 'en-GB' }, { text: 'agora' }]);
    tts.narrate('outra coisa');
    spoke[0].onend();
    await settle();
    expect(record.phonemized, 'the old narration went on after a newer one').toEqual([]);
    expect(texts()).toEqual(['Leia:', 'outra coisa']);
  });
});

describe('§3 · no voice for it, no wrong voice', () => {
  /** A `tts` whose reported `problems` lines are kept. */
  function setupReporting(over = {}) {
    const reported = [];
    const { t } = createTranslator();
    const tts = createTts({
      store: createStorage(memoryBackend()),
      translator: { t, bcp47: () => language },
      srSay: () => {}, srAlert: () => {},
      ensureAC: () => null, catNode: () => null, audioOut: () => null,
      getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
      speech, now: () => 0, createAudio: () => { throw new Error('no neural utterance plays here'); },
      loadKokoro: () => new Promise(() => {}),
      report: (line) => reported.push(line),
      ...over,
    });
    return { tts, reported };
  }
  const notice = (name) => createTranslator().t('sr.tts.noVoiceForLanguage', { language: name });

  it('🔴 [Right] the part is not spoken; the interface\'s voice says, in its place, that the device has no voice for it', () => {
    const { tts } = setupReporting();
    tts.narrate([{ text: 'Leia:' }, { text: 'bonjour', language: 'fr-FR' }, { text: 'agora' }]);
    expect(texts()).toEqual(['Leia:', notice('francês'), 'agora']);
    expect(spoke[1].voice, 'the notice is the interface\'s, in its voice').toBe(LUCIANA);
    expect(spoke[1].lang).toBe('pt-BR');
  });

  it('🔴 [Right] one `problems` line naming the language, the cost for the child and the fix', () => {
    const { tts, reported } = setupReporting();
    tts.narrate([{ text: 'bonjour', language: 'fr' }]);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatch(/lacks a voice for French \(fr\)/);
    expect(reported[0]).toMatch(/child who listens does not hear it/);
    expect(reported[0]).toMatch(/install a voice for French on the device/);
  });

  it('🔴 [Cardinality] ONCE per language: said and written the first time, silent after; another language is said too', () => {
    const { tts, reported } = setupReporting();
    tts.narrate([{ text: 'bonjour', language: 'fr-FR' }]);
    tts.narrate([{ text: 'merci', language: 'fr-CA' }]);
    tts.narrate([{ text: 'danke', language: 'de' }]);
    expect(texts()).toEqual([notice('francês'), notice('alemão')]);
    expect(reported).toHaveLength(2);
  });

  it('🎯 [Right] a neural voice still loading is not «no voice»: nothing is said and nothing is written', async () => {
    const record = { voices: [], phonemized: [] };
    const { tts, reported } = setupReporting({ neuralVoice: true, loadKokoro: fakeKokoro(record) });
    voices = [LUCIANA]; // no English browser voice; Kokoro has English ones
    tts.narrate([{ text: 'apple', language: 'en' }]);
    expect(texts()).toEqual([]);
    expect(reported).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time to `platform/tts.ts` by a script that counts the occurrences before replacing, each restored from a copy
// and verified by SHA-256:
// §5-1. the drop removed — `_ttsVoiceObj ?? …` as before (the defect)  → red: the Portuguese voice after the switch, the dropped object
// §5-2. every voice object dropped                                      → red: the object of the language of now
// §5-3. the browser's `pt_BR` read without `_` → `-`                     → red: the object of the language of now
// §1/§2, in `platform/voice-plan.ts`, `platform/tts.ts` and `platform/interruptible-speech.ts`:
// 1. `voiceOfLanguage` without the exact-tag step                          → red: exact tag, the two neural cases
// 2. `voiceOfLanguage` ignoring the child's choice                          → red: the chosen voice
// 3. `voiceOfLanguage` without the language filter                          → red: parts in order, pt-PT, no French, neural
// 4. every part read as frame                                               → red: nine cases
// 5. a neural part not waiting for the browser parts before it              → red: the neural part after the frame, the newer narration
// 6. the parts' loop not asking whether a newer narration came              → red: the newer narration
// 7. the loaded model not used for a content part                            → red: the two neural cases, the newer narration
// 8. every part phonemized in the loaded voice's language                   → red: one model, each part its own phonemizer
// 9. every part styled by the loaded voice's table                          → red: the same case
// 12. a text alone not ending an older list's parts                         → red: the newer narration
// (10 and 11 are `finished` in `tests/interruptible-speech.node.test.js`.)
// §3, in `platform/tts.ts`:
// 1. the line not reported                                  → red: the `problems` line, once per language
// 3. said and written at every part, not once               → red: once per language
// 4. the notice not said                                    → red: the part not spoken, once per language
// 5. the language named in English whatever the interface   → red: the part not spoken, once per language
// 6. a part with no voice read by the interface's voice     → red: no French voice, and the three §3 cases
// (2, the root not wiring `report`, is red in the browser file.)
