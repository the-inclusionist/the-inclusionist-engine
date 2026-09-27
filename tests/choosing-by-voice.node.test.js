// SPDX-License-Identifier: AGPL-3.0-or-later
// A CHILD ANSWERS BY SAYING ONE OF THE OPTIONS THE GAME SHOWS (ADR-0256).
//
// `platform/choose-by-voice` with the recogniser and the microphone replaced by a fake `open`: what is asserted is the grammar an
// option set becomes, which options a sentence names, when a choice ends and that the 👄 is paused around it. The matching rule
// came from the quiz (its cases were in `consumer-quiz.node.test.js`), and it moved with the matching.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createVoiceChooser, optionsNamed } from '../app/js/platform/choose-by-voice.js';

const ANIMALS = ['Gato', 'Galinha', 'Cavalo', 'Peixe'];
const NUMBERS = ['Três', 'Quatro', 'Cinco', 'Dois'];

/** A chooser whose recogniser is a fake: `hear(text, final)` is the child speaking, `fire()` runs the timers. */
function harness({ openFails = null, vocabulary = null } = {}) {
  const log = { opened: [], stopped: 0, reports: [], pauses: 0, resumes: 0, timers: [] };
  let onHeard = () => {};
  const chooser = createVoiceChooser({
    language: () => 'pt-BR',
    open: async (language, grammar, heard) => {
      if (openFails) throw new Error(openFails);
      log.opened.push({ language, grammar });
      onHeard = heard;
      return { stop: async () => { log.stopped += 1; }, ...(vocabulary ? { vocabulary: async () => new Set(vocabulary) } : {}) };
    },
    after: (fn, ms) => { const t = { fn, ms, on: true }; log.timers.push(t); return t; },
    cancel: (t) => { t.on = false; },
    report: (line) => log.reports.push(line),
    pause: () => { log.pauses += 1; },
    resume: () => { log.resumes += 1; },
  });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    chooser, log,
    hear: async (text, final) => { await tick(); onHeard(text, final); },
    fire: async () => { await tick(); for (const t of log.timers) if (t.on) t.fn(); },
  };
}

describe('which options a sentence names', () => {
  it('🔴 [Right] the option said by itself, and an option said inside a sentence', () => {
    expect(optionsNamed(ANIMALS, 'galinha')).toEqual([1]);
    expect(optionsNamed(ANIMALS, 'eu acho que é a galinha')).toEqual([1]);
  });

  it('🔴 [Right] case, accent and punctuation are not part of the answer — with the accent on ONE side only', () => {
    expect(optionsNamed(NUMBERS, 'tres')).toEqual([0]);
    expect(optionsNamed(NUMBERS, 'Três.')).toEqual([0]);
    expect(optionsNamed(ANIMALS, 'GALINHA!')).toEqual([1]);
  });

  it('🔴 [Right] a pictogram before the option is not said', () => {
    expect(optionsNamed(['😀 feliz', '😴 com sono', '😢 triste'], 'triste')).toEqual([2]);
  });

  it('🔴 [Boundary] whole words, in order, and the LONGEST option at each word', () => {
    expect(optionsNamed(NUMBERS, 'doisel')).toEqual([]);
    expect(optionsNamed(['Cavalo marinho', 'Gato'], 'é um cavalo marinho')).toEqual([0]);
    expect(optionsNamed(['Cavalo marinho', 'Gato'], 'marinho cavalo')).toEqual([]);
    expect(optionsNamed(['Cavalo', 'Cavalo marinho'], 'cavalo marinho'), '«cavalo marinho» counted as «cavalo» too').toEqual([1]);
  });

  it('[Zero] nothing, a word that is no option, and an empty option name nothing', () => {
    expect(optionsNamed(ANIMALS, '')).toEqual([]);
    expect(optionsNamed(ANIMALS, 'elefante')).toEqual([]);
    expect(optionsNamed(['', 'Gato'], 'gato')).toEqual([1]);
  });
});

describe('a choice by voice', () => {
  it('🔴 [Right] the grammar is exactly the options as said — no pictogram, lower case, accents kept — in the page\'s language', async () => {
    const h = harness();
    const p = h.chooser.choose(['😀 Feliz', '😴 com sono', 'Três']);
    await h.hear('', false);
    expect(h.log.opened).toEqual([{ language: 'pt-BR', grammar: ['feliz', 'com sono', 'três'] }]);
    await h.hear('feliz', true);
    await p;
  });

  it('🔴 [Right] one option said in a sentence chooses it, and the microphone is let go', async () => {
    const h = harness();
    const p = h.chooser.choose(ANIMALS);
    await h.hear('galinha', false);
    await h.hear('galinha', true);
    expect(await p).toEqual({ chosen: 1, heard: 'galinha', ended: 'chosen' });
    expect(h.log.stopped).toBe(1);
  });

  it('🔴 [Right] it is decided at the END of the sentence, never on its first word', async () => {
    const h = harness();
    let answered = false;
    const p = h.chooser.choose(ANIMALS).then((r) => { answered = true; return r; });
    await h.hear('gato', false);
    await new Promise((r) => setTimeout(r, 0));
    expect(answered, 'a partial «gato» answered before the sentence could go on to «ou galinha»').toBe(false);
    await h.hear('gato galinha', true);
    await p;
  });

  it('🔴 [Right] TWO options in one sentence are not an answer: a child thinking out loud is not choosing', async () => {
    const h = harness();
    const p = h.chooser.choose(ANIMALS);
    await h.hear('gato [unk] galinha', true);
    expect(await p).toEqual({ chosen: null, heard: 'gato galinha', ended: 'unclear' });
  });

  it('🔴 [Right] a sentence with no option goes on listening, and the time ends it unanswered', async () => {
    const h = harness();
    const p = h.chooser.choose(ANIMALS, { maxMs: 4000 });
    await h.hear('[unk]', true);
    expect(h.log.timers.map((t) => t.ms)).toEqual([4000]);
    await h.fire();
    expect(await p).toEqual({ chosen: null, heard: '', ended: 'timeout' });
    expect(h.log.stopped).toBe(1);
  });

  it('🔴 [Right] stop() ends it unanswered — also while the microphone is still opening', async () => {
    const h = harness();
    const p = h.chooser.choose(ANIMALS);
    h.chooser.stop(); // before `open` has answered
    expect((await p).ended).toBe('asked');
    expect(h.log.stopped, 'a microphone asked to stop while opening stayed open').toBe(1);
  });

  it('🔴 [Right] the 👄 is paused around the choice, and resumed on every way out', async () => {
    const chosen = harness();
    const p = chosen.chooser.choose(ANIMALS);
    await chosen.hear('peixe', true);
    await p;
    expect([chosen.log.pauses, chosen.log.resumes]).toEqual([1, 1]);
    const failed = harness({ openFails: 'no model' });
    await expect(failed.chooser.choose(ANIMALS)).rejects.toThrow('no model');
    expect([failed.log.pauses, failed.log.resumes], 'the 👄 stayed paused after a choice that could not open').toEqual([1, 1]);
  });

  it('🔴 [Right] a recogniser that cannot open is said to the adult once, with the fix', async () => {
    const h = harness({ openFails: 'commands:model:en not on this device' });
    await expect(h.chooser.choose(ANIMALS, { language: 'en-US' })).rejects.toThrow();
    await expect(h.chooser.choose(ANIMALS, { language: 'en-US' })).rejects.toThrow();
    expect(h.log.reports).toHaveLength(1);
    expect(h.log.reports[0]).toMatch(/en-US.*commands:model:en not on this device.*--commands en/);
  });

  it('🔴 [Right] an option with a word the model does not know is named to the adult', async () => {
    const h = harness({ vocabulary: ['gato', 'peixe'] });
    const p = h.chooser.choose(['Gato', 'Ornitorrinco', 'Peixe']);
    await h.hear('gato', true);
    await p;
    expect(h.log.reports).toHaveLength(1);
    expect(h.log.reports[0]).toMatch(/"Ornitorrinco".*"ornitorrinco"/);
  });

  it('🔴 [Right] what was heard is the END of the sentence — a partial the recogniser took back is not shown as heard', async () => {
    const h = harness();
    const p = h.chooser.choose(ANIMALS, { maxMs: 4000 });
    await h.hear('gato', false);
    await h.hear('', true); // the recogniser withdrew its guess
    await h.fire();
    expect(await p, 'a withdrawn partial was reported as what the child said').toEqual({ chosen: null, heard: '', ended: 'timeout' });
  });

  it('🔴 [Right] an ear already listening is BORROWED: nothing is opened, nothing paused, and it is given back', async () => {
    const log = { opened: 0, pauses: 0, resumes: 0, given: 0, lentWith: null };
    let heard = () => {};
    const chooser = createVoiceChooser({
      language: () => 'pt-BR',
      open: async () => { log.opened += 1; return { stop: async () => {} }; },
      borrow: (language, grammar, onHeard) => { log.lentWith = { language, grammar }; heard = onHeard; return { stop: async () => { log.given += 1; } }; },
      after: () => ({}), cancel: () => {}, report: () => {},
      pause: () => { log.pauses += 1; }, resume: () => { log.resumes += 1; },
    });
    const p = chooser.choose(['😀 Feliz', 'Triste']);
    await new Promise((r) => setTimeout(r, 0));
    heard('feliz', true);
    expect((await p).chosen).toBe(0);
    expect(log.lentWith).toEqual({ language: 'pt-BR', grammar: ['feliz', 'triste'] });
    expect([log.opened, log.pauses, log.resumes], 'a second ear was opened, or the lent one paused').toEqual([0, 0, 0]);
    expect(log.given, 'the borrowed ear was not given back').toBe(1);
  });

  it('🔴 [Consistency] one microphone, one choice: a second caller waits on the first', async () => {
    const h = harness();
    const a = h.chooser.choose(ANIMALS);
    const b = h.chooser.choose(NUMBERS);
    await h.hear('cavalo', true);
    expect(await b).toEqual(await a);
    expect(h.log.opened).toHaveLength(1);
  });
});

// ===== MUTATIONS CHECKED (2026-09-27) — `scratchpad/mutate-choose-by-voice.mjs`, 13 of 13 red =====
// decided on the partial · two options answering the first · not the longest option · the word order ignored · the accents
// compared · `maxMs` ignored · a stop before the microphone opened lost · the 👄 not resumed · a reason reported every time · an
// unsayable option unreported · two microphones · the grammar as written (pictogram and case kept) · the microphone kept open
// And (2026-09-27, one ear): the borrow ignored · paused while borrowed · a withdrawn partial kept as heard — 3 of 3 red
