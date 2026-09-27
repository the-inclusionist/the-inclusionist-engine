// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MIXER'S DOOR TO LISTEN (ADR-0247): `audio.onCatChange` hears every change of a category, whoever writes it — and a game's
// door to a category is a plain property write on `Engine.audio.audioCat`, with no call after it. So the write itself is what
// is heard: `on`, `vol`, and the category replaced whole. The root's own listener and what it draws are measured in
// `the-mixer-tells-every-change.browser.test.js`.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { createAudio } from '../app/js/platform/audio.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const fresh = () => {
  const store = createStorage(memoryBackend());
  return { audio: createAudio({ newContext: () => null, store }), store };
};

describe('every write that changes a category is told, with its key', () => {
  it('🎯 [Right] `on` and `vol`, each once', () => {
    const { audio } = fresh();
    const heard = [];
    audio.onCatChange((k) => { heard.push([k, audio.audioCat[k].on, audio.audioCat[k].vol]); });
    audio.audioCat.tts.on = true;
    audio.audioCat.music.vol = 0.3;
    expect(heard, 'told before the value changed, or not at all').toEqual([['tts', true, 0.8], ['music', true, 0.3]]);
  });

  it('🔴 [Right] a category REPLACED whole is copied into the mixer\'s own object, and told', () => {
    const { audio } = fresh();
    const live = audio.audioCat.sonar;
    const heard = [];
    audio.onCatChange((k) => { heard.push(k); });
    audio.audioCat.sonar = { on: false, vol: 0.2 };
    expect(audio.audioCat.sonar, 'the replacement took the mixer\'s object away from every reader').toBe(live);
    expect({ on: live.on, vol: live.vol }).toEqual({ on: false, vol: 0.2 });
    expect(heard).toEqual(['sonar', 'sonar']);
    live.on = true; // a later write on the same object is still heard
    expect(heard).toEqual(['sonar', 'sonar', 'sonar']);
  });

  it('📌 [Boundary] the value already there is no change: nothing is told', () => {
    const { audio } = fresh();
    const heard = [];
    audio.onCatChange((k) => { heard.push(k); });
    audio.audioCat.tts.on = audio.audioCat.tts.on;
    audio.audioCat.tts.vol = audio.audioCat.tts.vol;
    expect(heard).toEqual([]);
  });
});

describe('listening ends, and the mixer keeps working as it did', () => {
  it('🔴 [Cardinality] `off()` stops that listener and no other', () => {
    const { audio } = fresh();
    const a = [], b = [];
    const offA = audio.onCatChange((k) => { a.push(k); });
    audio.onCatChange((k) => { b.push(k); });
    audio.audioCat.guide.on = true;
    offA();
    audio.audioCat.guide.on = false;
    expect(a).toEqual(['guide']);
    expect(b).toEqual(['guide', 'guide']);
  });

  it('📌 [Conformance] the category still reads, compares and stores as `{ on, vol }`', () => {
    const { audio, store } = fresh();
    audio.audioCat.earcons.on = false;
    audio.audioCat.earcons.vol = 0.4;
    audio.setCatGain('earcons');
    expect(audio.audioCat.earcons).toEqual({ on: false, vol: 0.4 });
    expect(Object.keys(audio.audioCat.earcons)).toEqual(['on', 'vol']);
    expect(store.getJSON('incl_audiocat_earcons', null), 'the store kept something other than the category').toEqual({ on: false, vol: 0.4 });
  });

  it('📌 [Independence] a second root\'s mixer tells its own listeners, not the first one\'s', () => {
    const one = fresh().audio, two = fresh().audio;
    const heard = [];
    one.onCatChange((k) => { heard.push(k); });
    two.audioCat.tts.on = true;
    expect(heard).toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script, with the occurrence count checked BEFORE each one; restored from a copy and checked by sha256 (2026-09-26,
// each alone, all red; the list with the browser file's is at the end of `the-mixer-tells-every-change.browser.test.js`).
//   M5  `on`'s setter tells nobody                        🔴 «`on` and `vol`…», the replacement, `off()`
//   M6  `vol`'s setter tells nobody                       🔴 «`on` and `vol`…», the replacement
//   M7  the category key a plain property                 🔴 the replacement
//   M8  `off()` does nothing                              🔴 «`off()` stops that listener…»
//   M9  the no-change guard gone from `on`'s setter        🔴 «the value already there is no change»
