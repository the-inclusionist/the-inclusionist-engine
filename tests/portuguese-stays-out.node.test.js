// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING NEW IN PORTUGUESE — phase 0 of the English plan (the Dev, 2026-09-21: «De que adianta pedir pra tirar se você continua
// colocando?»).
//
// The project's rule is English artefacts, and the debt is old. This gate renames nothing. It holds two lines:
//   · no file may carry MORE than the baseline IN EITHER CATEGORY, and a file that has none may not start;
//   · every word a name uses is classified English or Portuguese — an unknown word fails, which is what stops a
//     Portuguese word nobody has listed yet from entering quietly.
//
// 🔴 PARAMETERS ENTERED ON 2026-09-22 — the Dev's «Parâmetros e membros no plano, por favor», first half of step 7h. Until
// then this gate read DECLARATIONS only, and `sanitiseTeaLevel(bruto, padrao)` lived a whole day inside a module the gate
// itself had required to be born at zero. 📏 Every number it ever reported was a LOWER BOUND.
//
// 📏 What the widening cost, said before it ran: the debt goes from **1002 in 89 files to 1480 in 103** — 976 declarations
// and 504 parameters — and **107 new words had to be classified**, each one read at the declaration where it is born. It is
// not payment and it is not new debt: it is the measure catching up with what already existed.
//
// 📌 TWO NUMBERS PER FILE AND NOT ONE, and that is a decision: on a blended total a new Portuguese declaration hides behind
// a renamed parameter, and the ratchet would report progress while the surface got worse.
//
// ⏸ MEMBERS ARE STILL OUT — the 310 the Dev left for phase 7, and the second half of this step. Splitting 7h in two was to
// keep the classification honest: 310 words in one sitting is how a dictionary gets poisoned, and this one already was once.
// When a file drops below its number, `node scripts/language-inventory.mjs --bootstrap` writes the smaller number back: the
// baseline only shrinks, like the one of `exports-sem-consumidor`.
//
// ⚠️ Three trees are outside this gate, and each for a rule of the project, not for convenience: the dictionaries
// (`app/js/i18n`, pilar 3), the curriculum (`app/js/educational`, ADR-0032) and the demo cartridge (`app/js/consumer-quiz`).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  inventory, readBaseline, readLists, words, source, declaredNames, parameterNames, EXCEPTIONS, CATEGORIES, debtOf,
} from '../scripts/language-inventory.mjs';

const { debt, unknown } = inventory();
const baseline = readBaseline();
const soma = (mapa, cat) => Object.values(mapa).reduce((a, d) => a + debtOf(d)[cat], 0);

describe('Portuguese in the engine only shrinks', () => {
  it('🔴 [Right] no file carries more Portuguese identifiers than its baseline, in EITHER category', () => {
    const piorou = [];
    for (const [f, d] of Object.entries(debt)) {
      const base = debtOf(baseline.files[f]);
      for (const cat of CATEGORIES) if (d[cat] > base[cat]) piorou.push(`${f} ${cat}: ${d[cat]} against ${base[cat]}`);
    }
    expect(piorou, 'a name in Portuguese entered — rename it, or say why in the commit').toEqual([]);
  });

  it('🔴 [Zero] a file the baseline does not name carries none', () => {
    const novos = Object.keys(debt).filter((f) => !(f in baseline.files));
    expect(novos, 'a new file was born speaking Portuguese').toEqual([]);
  });

  it('🔴 [Right] every word a name uses is classified — an unknown word is how Portuguese slips in', () => {
    expect(unknown, 'classify these in scripts/word-lists.json, as `english` or `portuguese`, by READING the '
      + 'declaration where each word is born — the list was poisoned once by classifying in bulk').toEqual([]);
  });

  it('🔴 [Right] a PARAMETER counts, and a destructured one too — the hole that let `(bruto, padrao)` in', () => {
    // 📏 O defeito, medido em 22/09: `sanitiseTeaLevel(bruto, padrao)` viveu um dia inteiro num ficheiro que este portão
    // chamava limpo, e num módulo que o próprio portão exigira que nascesse a zero. Um parâmetro não é uma declaração, e
    // era só isso que ele lia. ⚠️ O segundo caso é a desestruturação: sem ele o mesmo buraco reabre uma sintaxe abaixo.
    expect(parameterNames('export function f(bruto: number, padrao = 1): void {}').sort()).toEqual(['bruto', 'padrao']);
    expect(parameterNames('const g = ({ raiz, filhos }) => raiz + filhos;').sort()).toEqual(['filhos', 'raiz']);
    expect(parameterNames('const naoEParametro = 1;'), 'uma declaração não é um parâmetro').toEqual([]);
    expect(declaredNames('export function f(bruto: number): void {}'), 'e um parâmetro não é uma declaração').toEqual(['f']);
  });

  it('📌 [Boundary] the baseline is the tree, not a wish: its totals match what the files add up to', () => {
    for (const cat of CATEGORIES) {
      expect(baseline.totals[cat], `the recorded ${cat} total is not the sum of the files`).toBe(soma(baseline.files, cat));
      expect(soma(debt, cat), `the tree carries more ${cat} debt than the baseline records`)
        .toBeLessThanOrEqual(baseline.totals[cat]);
    }
    expect(baseline.total).toBe(CATEGORIES.reduce((a, c) => a + baseline.totals[c], 0));
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
//
// MUTATIONS CHECKED (2026-09-22, the parameters half of step 7h) — `scratchpad/mutar-7h.mjs`, 7 of 7 red, control green:
//   · a Portuguese PARAMETER in a measured file       → «no file carries more … in EITHER category»   ← the original defect
//   · the same one DESTRUCTURED                       → same case (the hole one syntax down)
//   · a new file born with a Portuguese parameter     → «a file the baseline does not name»
//   · the baseline back to ONE number per file        → «the baseline is the tree» (the blend the decision refuses)
//   · the parameter total raised by hand              → «the baseline is the tree»
//   · a classified word taken out of the lists        → «every word a name uses is classified»
//   · `parameterNames` blinded to return nothing      → «a PARAMETER counts»
