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

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time to `platform/tts.ts` by a script that counts the occurrences before replacing, each restored from a copy
// and verified by SHA-256:
// §5-1. the drop removed — `_ttsVoiceObj ?? …` as before (the defect)  → red: the Portuguese voice after the switch, the dropped object
// §5-2. every voice object dropped                                      → red: the object of the language of now
// §5-3. the browser's `pt_BR` read without `_` → `-`                     → red: the object of the language of now
