// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE REAL THREAD (issue #185). `tests/reading-in-worker.node.test.js` measures the protocol on both sides with a fake
// thread; what IT cannot measure is the one thing that fails on delivery day: **the worker exists as a file, the browser
// can open it, and what is inside answers**.
//
// 🔴 It is a shape of defect this repository has met twice: a double shaped by its author's belief (`platform/vosk-runtime`,
// 2026-09-21), and a `new URL(…, import.meta.url)` path the bundler did not recognise would resolve against the PAGE and
// give a 404 in every game except the one whose folders happened to match.
//
// ⚠️ WITH NO MODEL AT ALL, on purpose: a language the project does not speak is requested, and what is measured is that the
// refusal comes back from the thread by name. A case bringing Portuguese's 378 MiB into a test browser would measure the
// machine's patience, not the worker.
import { describe, it, expect } from 'vitest';
import { createReadingInWorker } from '../app/js/platform/reading-in-worker.js';

describe('o worker da leitura existe, abre e responde', () => {
  it('🔴 [Right] o navegador abre o ficheiro do worker e a recusa volta de lá pelo nome da língua', async () => {
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'fr-FR' });
    try {
      await expect(leitura.transcribe(new Float32Array(16)), 'nada voltou da thread — o ficheiro não abriu')
        .rejects.toThrow(/fr-FR/);
    } finally {
      leitura.close();
    }
  });

  /*
   * ⚠️ THE PAIR OF THE REFUSAL, and without it the case above would pass with a worker that rejected EVERYTHING: a language
   * the project speaks opens the model — and here it goes as far as this test server's delivery reaches, which is a 404 of
   * the model file. What is asserted is the DIFFERENCE between the two refusals: one names the language, the other the file.
   */
  it('⚠️ [Boundary] uma língua que o projeto fala chega ao ficheiro do modelo — e é ele que falta, não a língua', async () => {
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'pt-BR' });
    try {
      await expect(leitura.transcribe(new Float32Array(16))).rejects.toThrow(/HTTP|delivery|fetch|Failed/i);
    } finally {
      leitura.close();
    }
  });
});
