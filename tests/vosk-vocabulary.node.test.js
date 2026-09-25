// SPDX-License-Identifier: AGPL-3.0-or-later
// THE WORDS A VOSK MODEL KNOWS, READ FROM ITS ARCHIVE (ADR-0194 §4, ADR-0169).
//
// The recogniser drops a grammar word its model lacks inside its worker and tells the page nothing, so the page reads the
// vocabulary itself: the output symbol table of the model's `Gr.fst`. These cases build the archive in memory
// (`fixtures/vosk-archive.js`) — no model is downloaded. What the real pt archive answered is written in the module's header;
// that the read STOPS once the table is read is measured in the browser (`vosk-vocabulary.browser.test.js`), where the
// decompressor has backpressure.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readModelVocabulary } from '../app/js/platform/vosk-vocabulary.js';
import { modelArchive, modelTar, gzip, wordGraph, streamOf, paxFor, noise, text } from './fixtures/vosk-archive.js';

const WORDS = ['<eps>', 'configurações', 'de', 'inclusão', 'voltar', 'ao', 'jogo', 'ação', '#0'];
const read = (bytes, chunk) => readModelVocabulary(streamOf(bytes, chunk).stream);

describe('platform/vosk-vocabulary — the model\'s words, from its word graph', () => {
  it('🔴 [Right] `Gr.fst` first in the archive (the pt layout): every word of its table, as the model spells them', async () => {
    const words = await read(await modelArchive([{ path: 'vosk-model-small-pt-0.3/Gr.fst', data: wordGraph({ input: WORDS, output: WORDS }) }]));
    expect(words, 'the vocabulary was not read').not.toBeNull();
    expect([...words].sort()).toEqual([...WORDS].sort());
    expect(words.has('configurações'), 'the accents are the model\'s spelling and must survive the read').toBe(true);
    expect(words.has('configuracoes')).toBe(false);
  });

  it('🔴 [Right] `Gr.fst` AFTER other entries (the en layout: `am/final.mdl` first) — the entries before it are walked past', async () => {
    const bytes = await modelArchive([
      { path: 'vosk-model-small-en-us-0.15/README', data: text('small english model\n') },
      { path: 'vosk-model-small-en-us-0.15/am/final.mdl', data: noise(300_001) },
      { path: 'vosk-model-small-en-us-0.15/graph/Gr.fst', data: wordGraph({ input: ['<eps>', 'back'], output: ['<eps>', 'back'] }) },
    ]);
    expect([...(await read(bytes))].sort()).toEqual(['<eps>', 'back']);
  });

  it('🔴 [Right] the OUTPUT table is the vocabulary — what a grammar is matched against — not the input one', async () => {
    const words = await read(await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: ['<eps>', 'phone'], output: ['<eps>', 'word'] }) }]));
    expect([...words].sort()).toEqual(['<eps>', 'word']);
  });

  it('⚠️ [Boundary] an acceptor written with ONE table (input only) answers with that table', async () => {
    const words = await read(await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: ['<eps>', 'jogo'] }) }]));
    expect([...words].sort()).toEqual(['<eps>', 'jogo']);
  });

  it('⚠️ [Boundary] a path given by a pax header (Python\'s PAX_FORMAT for a long name) is the entry\'s path', async () => {
    const long = `${'a-very-long-model-folder-name/'.repeat(4)}graph/Gr.fst`;
    const words = await read(await modelArchive([
      paxFor(long),
      { path: 'PaxHeader-truncated', data: wordGraph({ input: ['<eps>', 'sair'], output: ['<eps>', 'sair'] }) },
    ]));
    expect(words, 'the pax path was ignored and the word graph not found').not.toBeNull();
    expect(words.has('sair')).toBe(true);
  });

  it('📌 [Boundary] the chunks the network hands over can split any field — 7 bytes at a time reads the same words', async () => {
    const bytes = await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: WORDS, output: WORDS }) }]);
    expect([...(await read(bytes, 7))].sort()).toEqual([...WORDS].sort());
  });
});

describe('platform/vosk-vocabulary — what it cannot read is «unknown», never «no words»', () => {
  // ⚠️ An empty set would report every word of every name as missing; `null` makes the caller say nothing.
  it('🎯 [Zero] an archive with no `Gr.fst` (a model with no runtime grammar) → null', async () => {
    expect(await read(await modelArchive([{ path: 'm/HCLG.fst', data: new Uint8Array(100) }]))).toBeNull();
  });

  it('🎯 [Zero] a `Gr.fst` that is not an OpenFst file → null', async () => {
    expect(await read(await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: WORDS, output: WORDS, magic: 1234 }) }]))).toBeNull();
  });

  it('🎯 [Zero] an OpenFst header whose symbol table is not one (its magic is wrong) → null, not what the bytes spell', async () => {
    expect(await read(await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: WORDS, output: WORDS, tableMagic: 99 }) }]))).toBeNull();
  });

  it('⚠️ [Error] an archive cut in the middle of the table → null, not the words read so far', async () => {
    const whole = wordGraph({ input: WORDS, output: WORDS, tail: new Uint8Array(0) });
    const tar = modelTar([{ path: 'm/Gr.fst', data: whole }]);
    expect(await read(await gzip(tar.subarray(0, 512 + whole.length - 20)))).toBeNull();
  });

  it('⚠️ [Error] bytes that are not gzip → null, and nothing throws', async () => {
    await expect(read(text('not an archive at all'))).resolves.toBeNull();
  });
});

// ============================== MUTATIONS CHECKED (2026-09-25) ==============================
//   V1 the input table answered instead of the output one             🔴 the OUTPUT table …; an archive cut in the middle …
//   V2 no word graph answers an empty set instead of null              🔴 an archive with no `Gr.fst`
//   V3 a pax header's path ignored                                     🔴 a path given by a pax header
//   V4 an entry skipped by its size, not its 512-byte blocks           🔴 `Gr.fst` AFTER other entries
//   V6 a table cut short answers the words read so far                 🔴 an archive cut in the middle of the table
//   V7 the OpenFst magic not checked                                   🔴 a `Gr.fst` that is not an OpenFst file
//   V8 a failing stream rethrows                                       🔴 bytes that are not gzip; not OpenFst; cut in the middle
//   V9 the symbol table's magic not checked                           🔴 a symbol table that is not one — it survived until that case
//   (V5 — the early stop — is the browser file's)
