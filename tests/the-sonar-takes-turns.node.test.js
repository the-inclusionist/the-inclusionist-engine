// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SONAR TAKES TURNS (ADR-0234, errata 2026-09-26 — the Dev: «em fila, não junto ao mesmo tempo com outro sonar em andamento»,
// and then «outro jogador não corta, mas um jogador corta a si mesmo»). `platform/tts` in the NODE project, over a lent browser
// speech that behaves as the browser's does: `speak` queues, one utterance plays at a time, `cancel` ends the one playing and the
// ones queued with an error, and the case says when the one playing reaches its end.
//
// A narration that names the player who asked (`{ seat }`, what the sonar passes) waits behind ANOTHER player's still being
// spoken, and cuts its OWN player's; one that names nobody (a question, a notice) cuts everything, as it always has.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { createTts } from '../app/js/platform/tts.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const LUCIANA = { name: 'Luciana', lang: 'pt-BR' };

let spoken, playing, cut, refuses;
beforeEach(() => { spoken = []; playing = []; cut = []; refuses = false; });

/** The browser's speech: what was handed to it (`spoken`), what is still to finish (`playing`), and what `cancel` ended (`cut`). */
const synth = {
  speak: (u) => { if (refuses) throw new Error('the device refused to speak'); spoken.push(u); playing.push(u); },
  cancel: () => { for (const u of playing.splice(0)) { cut.push(u.text); u.onerror?.({ error: 'interrupted' }); } },
  getVoices: () => [LUCIANA],
};
const speech = { synth: () => synth, utterance: (text) => ({ text, lang: '', rate: 0, volume: 0, voice: null }) };
const said = () => spoken.map((u) => u.text);
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
/** The utterance playing reaches its end, and what waited on it goes on. */
const ends = async () => { playing.shift()?.onend?.({}); await settle(); };

function setup() {
  const { t } = createTranslator();
  return createTts({
    store: createStorage(memoryBackend()),
    translator: { t, bcp47: () => 'pt-BR' },
    srSay: () => {}, srAlert: () => {},
    ensureAC: () => null, catNode: () => null, audioOut: () => null,
    getSoundOn: () => true, getVolume: () => 0.6, getAudioCat: () => ({ tts: { on: true } }),
    speech, now: () => 0, createAudio: () => { throw new Error('no neural utterance plays in these cases'); },
    loadKokoro: () => new Promise(() => {}),
  });
}

describe('another player\'s sonar does not cut: it waits its turn', () => {
  it('🔴 [Right] seat 0 then seat 1: the second is spoken after the first ends, and both complete', async () => {
    const tts = setup();
    tts.narrate('jogador 1 lê', { seat: 0 });
    tts.narrate('jogador 2 lê', { seat: 1 });
    expect(said(), 'the second player\'s reading was spoken on top of the first').toEqual(['jogador 1 lê']);
    expect(cut, 'the second player\'s reading cut the first').toEqual([]);
    await settle();
    expect(said(), 'the second player\'s reading did not wait for the first to END').toEqual(['jogador 1 lê']);
    expect(cut).toEqual([]);
    await ends();
    expect(said(), 'the waiting reading was not spoken when the first ended').toEqual(['jogador 1 lê', 'jogador 2 lê']);
    await ends();
    expect(cut, 'a reading was cut').toEqual([]);
    expect(playing, 'a reading did not complete').toEqual([]);
    tts.narrate('jogador 2 de novo', { seat: 1 });
    expect(said().at(-1), 'with nobody being spoken, a reading waited for nothing').toBe('jogador 2 de novo');
  });

  it('🔴 [Right] three players in a row are spoken in the order they asked', async () => {
    const tts = setup();
    tts.narrate('um', { seat: 0 });
    tts.narrate('dois', { seat: 1 });
    tts.narrate('três', { seat: 2 });
    await ends();
    await ends();
    await ends();
    expect(said()).toEqual(['um', 'dois', 'três']);
    expect(cut).toEqual([]);
  });

  it('🔴 [Right] a player pressing again while waiting: only its latest waits, in its place in the line', async () => {
    const tts = setup();
    tts.narrate('jogador 1 lê', { seat: 0 });
    tts.narrate('jogador 2, primeira', { seat: 1 });
    tts.narrate('jogador 3 lê', { seat: 2 });
    tts.narrate('jogador 2, última', { seat: 1 });
    await ends();
    await ends();
    await ends();
    expect(said()).toEqual(['jogador 1 lê', 'jogador 2, última', 'jogador 3 lê']);
  });

  it('🔴 [Right] a reading the device refused to speak holds nobody\'s turn: the next player is spoken at once', async () => {
    const tts = setup();
    refuses = true;
    tts.narrate('jogador 1 lê', { seat: 0 });
    refuses = false;
    await settle();
    tts.narrate('jogador 2 lê', { seat: 1 });
    expect(said(), 'the next player waited forever behind a reading nobody could hear').toEqual(['jogador 2 lê']);
  });
});

describe('a player\'s sonar cuts its own', () => {
  it('🔴 [Right] the same seat twice: the second replaces the first at once', () => {
    const tts = setup();
    tts.narrate('primeira', { seat: 0 });
    tts.narrate('segunda', { seat: 0 });
    expect(said(), 'the same player\'s newer reading waited behind its own').toEqual(['primeira', 'segunda']);
    expect(cut, 'the older reading was not cut').toEqual(['primeira']);
  });

  it('🔴 [Right] cutting its own does not cut the line: another player waiting is spoken after the newer reading', async () => {
    const tts = setup();
    tts.narrate('jogador 1, primeira', { seat: 0 });
    tts.narrate('jogador 2 lê', { seat: 1 });
    tts.narrate('jogador 1, segunda', { seat: 0 });
    await settle();
    expect(said()).toEqual(['jogador 1, primeira', 'jogador 1, segunda']);
    await ends();
    expect(said(), 'the other player\'s reading was lost when the first cut its own').toEqual(['jogador 1, primeira', 'jogador 1, segunda', 'jogador 2 lê']);
  });
});

describe('a narration that names no player keeps today\'s behaviour', () => {
  it('🔴 [Right] a new question cuts a sonar reading at once, and the readings waiting are not spoken after it', async () => {
    const tts = setup();
    tts.narrate('jogador 1 lê', { seat: 0 });
    tts.narrate('jogador 2 lê', { seat: 1 });
    tts.narrate('Pergunta 2');
    expect(said(), 'the question waited for the sonar').toEqual(['jogador 1 lê', 'Pergunta 2']);
    expect(cut).toEqual(['jogador 1 lê']);
    await ends();
    expect(said(), 'a reading of the old screen was spoken after the question').toEqual(['jogador 1 lê', 'Pergunta 2']);
    tts.narrate('jogador 1 lê de novo', { seat: 0 });
    await ends();
    expect(said(), 'the reading ended by the question came back behind the next sonar')
      .toEqual(['jogador 1 lê', 'Pergunta 2', 'jogador 1 lê de novo']);
  });

  it('🎯 [Right] a sonar reading still cuts a question being spoken, and a question still cuts a question', async () => {
    const tts = setup();
    tts.narrate('Pergunta 1');
    tts.narrate('Pergunta 2');
    tts.narrate('jogador 2 lê', { seat: 1 });
    expect(said()).toEqual(['Pergunta 1', 'Pergunta 2', 'jogador 2 lê']);
    expect(cut).toEqual(['Pergunta 1', 'Pergunta 2']);
    await settle();
    tts.narrate('jogador 1 lê', { seat: 0 });
    expect(said(), 'the reading that cut the question did not hold the turn against another player').toHaveLength(3);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time to `platform/tts.ts` by a script that counts the occurrences before replacing, each restored from a copy
// and verified by SHA-256:
// T1. a text's seat ignored — every reading cuts (the defect)           → red: six, all but «the same seat twice»
// T2. another seat cuts instead of waiting                               → red: the same six
// T3. the same seat waits behind its own                                 → red: the same seat twice, cutting its own
// T4. a seat's second press queued beside its first                      → red: only its latest waits
// T5. the waiting kept after a narration that names no player            → red: a new question cuts
// T6. a seat cutting its own drops the line                              → red: cutting its own
// T7. the last browser utterance not waited on                           → red: seat 0 then 1, three in a row, cutting its own,
//                                                                          a sonar reading still cuts a question
// T8. the line going on after it was cut                                 → red: cutting its own
// T9. a refused utterance still waited on                                → red: the refused reading
