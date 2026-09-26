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
//
// 📌 SINCE ADR-0232 D4 THE LITERAL LIVES IN THE ROOT, and the last case below is the one that opens the thread THROUGH it:
// `createGame` is booted on a host that reads, and what comes back into `problems` could only have come from inside the thread
// the root's own `new Worker(new URL(…))` opened. The two cases before it open the file with this test's own literal.
import { describe, it, expect } from 'vitest';
import { createReadingInWorker } from '../app/js/platform/reading-in-worker.js';
import { createGame } from '../app/js/boot/create-game.js';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

/** The worker's file, opened the way a bundler recognises (ADR-0232 D4: the spawn is REQUIRED; the root writes its own). */
const spawn = () => new Worker(new URL('../app/js/platform/reading-worker.js', import.meta.url), { type: 'module' });

describe('o worker da leitura existe, abre e responde', () => {
  it('🔴 [Right] o navegador abre o ficheiro do worker e a recusa volta de lá pelo nome da língua', async () => {
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'fr-FR', spawn });
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
    const leitura = createReadingInWorker({ base: document.baseURI, language: 'pt-BR', spawn });
    try {
      await expect(leitura.transcribe(new Float32Array(16))).rejects.toThrow(/HTTP|delivery|fetch|Failed/i);
    } finally {
      leitura.close();
    }
  });
});

/** The smallest game the engine accepts, as `reading-no-createGame.browser` builds it: what is measured here is the thread. */
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

/**
 * The page's window, with the parts this case decides: no recogniser of the browser's own (so the reading takes the MODEL
 * route), and a microphone that refuses (so nobody is left waiting on the thread, and its failure to open is REPORTED).
 * ⚠️ Every other function is bound to the real window: called with a proxy as `this`, the browser answers «Illegal invocation».
 */
function hostThatReads() {
  const navigator = { mediaDevices: { getUserMedia: async () => { throw new Error('no microphone in this case'); } } };
  return new Proxy(window, {
    get(target, prop) {
      if (prop === 'SpeechRecognition' || prop === 'webkitSpeechRecognition') return undefined;
      if (prop === 'navigator') return navigator;
      const value = Reflect.get(target, prop);
      return typeof value === 'function' && !Object.hasOwn(value, 'prototype') ? value.bind(target) : value;
    },
  });
}

describe('the root opens the reading thread (ADR-0232 D4)', () => {
  it('🔴 [Right] the thread the ROOT\'s literal opens exists, runs, and its failure to open reaches `problems` and the child', async () => {
    document.body.innerHTML = '<p id="sr-alert" role="alert"></p><div id="game-region"></div>';
    const motor = createGame({
      accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: hostThatReads() },
      downloadHeavy: false, uses: { reading: true },
    });
    try {
      await motor.reading.listen().catch(() => {}); // the microphone refuses: nobody waits on the thread
      const daThread = () => motor.problems.find((l) => l.includes('the transcription thread could not open'));
      const alerta = () => document.querySelector('#sr-alert').textContent;
      for (let i = 0; i < 400 && !(daThread() && alerta()); i++) await new Promise((r) => { setTimeout(r, 25); });
      // 📌 The reason came from INSIDE the thread: the model's runtime was asked of this test server's delivery, which has none.
      expect(daThread(), 'no answer came back from the thread the root opened — the worker file did not open')
        .toMatch(/could not open for [a-z]{2}(-[A-Z]{2})? — .*(HTTP|delivery|fetch|Failed|import)/i);
      // and BOTH fixes (ADR-0225 erratum): `--reading <language>` alone would now narrow the delivery to that one language
      expect(daThread()).toMatch(/`npx inclusionist-heavy --reading` alone .* or with `--reading [a-z]{2}` in its list/);
      expect(alerta(), 'the child who pressed «read» was not told it could not start').toBe(motor.t('sr.reading.failed'));
    } finally {
      motor.dispose();
      document.body.innerHTML = '';
    }
  });
});
