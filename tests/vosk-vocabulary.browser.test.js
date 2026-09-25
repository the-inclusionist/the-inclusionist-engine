// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MODEL'S VOCABULARY IS READ FROM THE START OF ITS ARCHIVE, AND THE READ STOPS THERE (ADR-0194 §4).
//
// The table sits at the head of `Gr.fst`, and the rest of that file (16 MB in the pt model) and of the archive is the model the
// worker opens. Reading all of it a second time on a school machine to learn four megabytes would be a cost for nothing. This is
// measured HERE, in the browser, because it depends on the platform's `DecompressionStream` holding back what it is not asked for:
// Node's pulls its whole source at once (measured on 2026-09-25), so the same case in the node project would say nothing.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readModelVocabulary } from '../app/js/platform/vosk-vocabulary.js';
import { modelArchive, wordGraph, streamOf, noise } from './fixtures/vosk-archive.js';

describe('platform/vosk-vocabulary in the browser', () => {
  it('🔴 [Right] it STOPS once the table is read: the states after it are never pulled, and the archive is let go', async () => {
    const words = ['<eps>', 'configurações', 'de', 'inclusão'];
    const bytes = await modelArchive([{ path: 'm/Gr.fst', data: wordGraph({ input: words, output: words, tail: noise(2_000_000) }) }]);
    const { stream, counter } = streamOf(bytes, 16 * 1024);
    const read = await readModelVocabulary(stream);
    expect([...read].sort()).toEqual([...words].sort());
    expect(counter.pulled, 'the whole archive was read to learn a table at its start').toBeLessThan(counter.total / 4);
    await new Promise((r) => { setTimeout(r, 50); });
    expect(counter.cancelled, 'the archive was left open after the table was read').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED (2026-09-25) ==============================
//   V5  the archive is never let go (no `cancel`)                      🔴 it STOPS once the table is read
//   V5b the rest of the archive is read to the end                     🔴 it STOPS once the table is read
