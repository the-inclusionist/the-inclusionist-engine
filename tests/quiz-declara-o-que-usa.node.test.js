// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO SAYS WHAT IT WANTS, AND NOT HOW (ADR-0216 §3; issue #200) — the Dev, 2026-09-21: «O jogo não deve precisar saber como
// isso funciona».
//
// The quiz demo is where the neural voice is tried (ADR-0198 erratum: «Apenas teste neste quiz demo»), so it is also where the
// promise is measurable: one line asks for the voice, and NOTHING in the demo names the phonemizer, the runtime or a path under
// `pesados/`. 📏 Until this commit it named all three — `kokoro-porta.ts` and `kokoro-carregar.ts`, ~200 lines every game that
// wanted a voice would have copied, and 45 MiB of espeak-ng and onnxruntime in its bundle (precache 55.9 → 10.9 MiB).
//
// ⚠️ IT READS THE SOURCE, and that is the point: the demo boots a browser, PIXI and a camera, so a case that ran it would measure
// everything but this. What is asserted here is the shape of the declaration, which is what a game copies.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'app/js/consumer-quiz';
const ficheiros = () => readdirSync(PASTA).filter((f) => f.endsWith('.ts'));
const fonte = (f) => readFileSync(join(PASTA, f), 'utf8');

describe('the quiz demo declares what it uses', () => {
  it('🔴 [Right] it asks for the neural voice in ONE line, with no loader of its own', () => {
    const quiz = fonte('main-quiz.ts');
    expect(quiz, 'the demo stopped asking for the neural voice and nobody would hear it go')
      .toMatch(/uses:\s*\{[^}]*neuralVoice:\s*true/);
    expect(quiz, 'a loader came back into the game: that is the ~200 lines ADR-0216 deleted')
      .not.toMatch(/carregarKokoro|loadKokoro/);
  });

  it('🎯 [Zero] no file of the demo names a phonemizer, a runtime or a delivery path', () => {
    // The three shapes the old port had: the npm packages, the `?url` assets only a Vite build understands, and the path under
    // `pesados/` that the engine alone is allowed to build (ADR-0177).
    const acusados = ficheiros().filter((f) => /espeak-ng|onnxruntime|\?url|caminhoNaEntrega/.test(fonte(f)));
    expect(acusados, 'the delivery and the runtime are the engine\'s business, and a file of the demo took them back').toEqual([]);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-voz-declarada.py`:
//   · the declaration dropped from the demo        → «it asks for the neural voice in ONE line»
//   · a loader handed in beside the declaration    → «with no loader of its own»
//   · a file of the demo importing espeak-ng again → «no file of the demo names a phonemizer»
