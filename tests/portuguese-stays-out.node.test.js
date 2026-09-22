// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING NEW IN PORTUGUESE — phase 0 of the English plan (the Dev, 2026-09-21: «De que adianta pedir pra tirar se você continua
// colocando?»).
//
// The project's rule is English artefacts, and the debt is old: measured today, 1487 declared identifiers in 111 of 161 files
// carry a Portuguese word. This gate renames nothing. It holds two lines:
//   · no file may carry MORE than the baseline, and a file that has none may not start;
//   · every word a declaration uses is classified English or Portuguese — an unknown word fails, which is what stops a
//     Portuguese word nobody has listed yet from entering quietly.
// When a file drops below its number, `node scripts/language-inventory.mjs --bootstrap` writes the smaller number back: the
// baseline only shrinks, like the one of `exports-sem-consumidor`.
//
// ⚠️ Three trees are outside this gate, and each for a rule of the project, not for convenience: the dictionaries
// (`app/js/i18n`, pilar 3), the curriculum (`app/js/educational`, ADR-0032) and the demo cartridge (`app/js/consumer-quiz`).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { inventory, readBaseline, readLists, words, source, declaredNames, EXCEPTIONS } from '../scripts/language-inventory.mjs';

const { debt, unknown } = inventory();
const baseline = readBaseline();

describe('Portuguese in the engine only shrinks', () => {
  it('🔴 [Right] no file carries more Portuguese identifiers than its baseline', () => {
    const piorou = Object.entries(debt)
      .filter(([f, n]) => n > (baseline.files[f] ?? 0))
      .map(([f, n]) => `${f}: ${n} against ${baseline.files[f] ?? 0}`);
    expect(piorou, 'a name in Portuguese entered — rename it, or say why in the commit').toEqual([]);
  });

  it('🔴 [Zero] a file the baseline does not name carries none', () => {
    const novos = Object.keys(debt).filter((f) => !(f in baseline.files));
    expect(novos, 'a new file was born speaking Portuguese').toEqual([]);
  });

  it('🔴 [Right] every word a declaration uses is classified — an unknown word is how Portuguese slips in', () => {
    expect(unknown, 'classify these in scripts/word-lists.json, as `english` or `portuguese`').toEqual([]);
  });

  it('📌 [Boundary] the baseline is the tree, not a wish: its total matches what the files add up to', () => {
    const soma = Object.values(baseline.files).reduce((a, b) => a + b, 0);
    expect(baseline.total).toBe(soma);
    expect(Object.values(debt).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(baseline.total);
  });

  it('📌 [Right] the reader splits names the way a reader reads them, and ignores what says nothing', () => {
    expect(words('setCameraControlValue')).toEqual(['set', 'camera', 'control', 'value']);
    expect(words('NOME_DA_CAMERA')).toEqual(['nome', 'camera']);
    expect(words('kbFor'), 'two letters are noise, not a word').toEqual(['for']);
  });

  it('⚠️ [Zero] the three exceptions are outside the measurement, and they are the project\'s rules', () => {
    const medidos = source();
    for (const [prefixo, porque] of EXCEPTIONS) {
      expect(medidos.some((f) => f.startsWith(prefixo)), `${prefixo} entered the measurement`).toBe(false);
      expect(porque.length, 'an exception without a reason is a hole').toBeGreaterThan(20);
    }
    expect(medidos.length, 'nothing was measured — the gate would approve anything').toBeGreaterThan(100);
  });

  it('⚠️ [Boundary] the lists do not disagree: no word is both English and Portuguese', () => {
    const { pt, en } = readLists();
    expect([...pt].filter((w) => en.has(w))).toEqual([]);
  });

  /*
   * 🔴 PROSE IS NOT A DECLARATION, and this case exists because the absence of it cost a red commit on 2026-09-22: the
   * sentence «Every function here takes what it needs», in a module header, was read as a declaration named `here`, and the
   * gate asked for an English word to be classified that no code had ever declared. 📏 It was not one word: 558 of the 1001
   * «Portuguese identifiers» reported that morning were prose.
   *
   * ⚠️ The nested `const` in the last expectation is the other half, and it is what stops the fix from being a subtraction:
   * a declaration INSIDE a function is still a name a reader has to read, and the expression that came before never saw one.
   */
  it('🔴 [Right] a name comes from the parser, not from prose or from a string', () => {
    const fonte = [
      '// Every function here takes what it needs — and `const aqui` in a comment is still prose.',
      "const real = 'const dentroDaCadeia = 1; function tambemNao() {}';",
      '/** @example type ExemploNoComentario = 1 */',
      'export function aFuncao(): void { const dentroDaFuncao = 1; return dentroDaFuncao; }',
    ].join('\n');
    expect(declaredNames(fonte).sort()).toEqual(['aFuncao', 'dentroDaFuncao', 'real']);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-portugues.py`:
//   · a Portuguese name added to a measured file      → «no file carries more»
//   · a new file with a Portuguese name               → «a file the baseline does not name»
//   · a word in neither list                          → «every word … is classified»
//   · the word splitter keeping the whole identifier  → «splits names the way a reader reads them»
//   · an exception widened to `app/js/ui/`            → «the three exceptions»
//   · the baseline's total raised by hand             → «the baseline is the tree, not a wish»
