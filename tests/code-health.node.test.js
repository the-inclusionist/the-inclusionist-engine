// SPDX-License-Identifier: AGPL-3.0-or-later
// CODE HEALTH ONLY IMPROVES — the ratchet of the SIX measures (ADR-0221, issue #203).
//
// ========================= WHY THIS EXISTS, AND IT ANSWERS A QUESTION OF THE DEV'S =========================
// The Dev reread the article that guided this engine's modularisation (arXiv:2409.15152) and said the problems it had
// cured had come back. They had, and the cause is mechanical, not a lack of care: this engine had gates for the language,
// for the DIRECTION of dependencies (ADR-0173), for the public surface, for exports without a consumer and for the
// records' pointers — and NONE for size, complexity or coupling. The layer check asks which way an import points, never
// how many there are: a module can import 77 things downward and pass green.
//
// 📏 And one did: `boot/create-game.ts` reached 2185 lines — 11% of all the engine's code in one file — with 330 decision
// nodes and fan-out 77, all green. What nothing measures comes back.
//
// ⚠️ AND THIS IS NOT A SCORE, which is the decision and not a limitation. The article measured its own experts:
// maintainability has an ICC of 0.52 among ten people with ten years of experience each, and r = 0.30 against their
// model. A number presented as quality would be obeyed more than it deserves. This file asks ONE question — did anything
// get worse? — and the answer is yes or no.
//
// ⚠️ AND COHESION IS NOT HERE, on purpose: LCOM and family assume classes with fields, and this tree is made of modules of
// functions. In its place is the co-change table of `docs/ARCHITECTURE.md` §3.3.
//
// MUTATIONS CHECKED at the end of the file.
import { describe, it, expect } from 'vitest';
import { measureTree, readBaseline, isExempt, ceilingFrom, ceilingToRecord, MEASURES, BASELINE } from '../scripts/code-health.mjs';

const arvore = measureTree();
const base = readBaseline();

describe('a saúde do código só melhora', () => {
  it('🔴 [Right] nenhum módulo piorou em nenhuma das seis medidas', () => {
    const piores = [];
    for (const [mod, agora] of Object.entries(arvore)) {
      const antes = base.modules[mod];
      if (!antes) continue; // a new module is the next case, and has another ruler
      /*
       * 🔴 FAN-OUT MAY GO UP BY ONE WHEN SIZE GOES DOWN AND BRANCHES DO NOT GO UP, and this exception exists because the gate
       * refused exactly the work it exists to cause. Every honest extraction costs +1 to the module the subject leaves:
       * that module now imports what left (📏 taking the calm mode out of `ui/pause-icons`: fewer lines and branches,
       * fan-out +1). Without this clause the only way to pay debt would be rewriting the baseline at every cut, and a
       * ratchet that is loosened by routine stops being one.
       *
       * 🔴 AND IT WAS ONCE TOO NARROW: it demanded that BRANCHES go down too, and taking DATA out of a module moves no branch
       * — a list has no `if`. Demanding that branches go down forbids exactly the cheapest and cleanest extraction there
       * is. It became: lines GO DOWN and branches do NOT GO UP.
       *
       * ⚠️ And it stays NARROW: ONE import, and only for a module that gave something in return. Whoever gains imports
       * giving nothing still fails, which is the case the measure exists to catch (mutations 8 and 9). 📌 The root of this
       * was already measured: fan-out counts HOW MANY modules, never how much of each.
       */
      const trocou = agora.codeLines < antes.codeLines && agora.decisionNodes <= antes.decisionNodes;
      for (const m of MEASURES) {
        if (isExempt(mod, m)) continue;
        if (m === 'fanOut' && trocou && agora[m] === antes[m] + 1) continue;
        if (agora[m] > antes[m]) piores.push(`${mod} ${m}: ${antes[m]} → ${agora[m]}`);
      }
    }
    expect(piores, 'um módulo piorou. Se o crescimento é o trabalho — uma funcionalidade nova num módulo que já a tinha —, '
      + `pague a dívida no mesmo commit ou corra \`node scripts/code-health.mjs --write\` e DIGA porquê na mensagem. Reescrever `
      + `${BASELINE} para tornar verde um build vermelho é desapertar a catraca.`).toEqual([]);
  });

  it('🔴 [Right] um módulo NOVO nasce abaixo do tecto', () => {
    /*
     * ⚠️ THE CEILING IS THIS TREE'S p90, not a number from the literature — the article prescribes none, and borrowing one
     * would dress it in an authority the article did not give.
     * 📌 That is why it lives in the baseline file WITH THE DATE it was taken: it is a fact about this repository, and it
     * changes when someone measures again and says so.
     */
    const acima = [];
    for (const [mod, agora] of Object.entries(arvore)) {
      if (base.modules[mod]) continue;
      for (const m of MEASURES) {
        if (isExempt(mod, m)) continue;
        if (agora[m] > base.ceiling[m]) acima.push(`${mod} ${m}: ${agora[m]} > ${base.ceiling[m]}`);
      }
    }
    expect(acima, 'um módulo NOVO nasceu acima do tecto do p90 desta árvore. Um módulo que nasce grande nunca encolhe: '
      + 'parta-o agora, que é quando é barato').toEqual([]);
  });

  it('⚠️ [Zero] a linha de base não guarda módulo que já não existe', () => {
    // An entry that matches zero looks like coverage and is not: it stops demanding what it demanded, silently. It is the
    // same defect phase 3 found in three ledgers keyed by file name.
    const fantasmas = Object.keys(base.modules).filter((m) => !arvore[m]);
    expect(fantasmas, `${BASELINE} descreve módulos que saíram — corra \`node scripts/code-health.mjs --write\``).toEqual([]);
  });

  it('🔴 [Right] a raiz é isenta no que é FIAÇÃO e não no que é dívida', () => {
    /*
     * 🔴 THIS CASE WAS BORN OF A SURVIVING MUTATION, and the mutation was removing the 1st case's exemption: with the tree
     * standing still, nothing gets worse, so the exemption is never exercised and deleting it stays green. The claim it
     * carries is THIS, and it is an ADR-0221 decision that deserves a case: the composition root is exempt from FAN-OUT,
     * because wiring everything is its job (ADR-0173) — and it is NOT exempt from lines, branches or depth, which is
     * exactly where its debt is.
     */
    expect(isExempt('boot/create-game.ts', 'fanOut'), 'a raiz perdeu a isenção do fan-out, que é o trabalho dela').toBe(true);
    for (const m of ['codeLines', 'decisionNodes', 'maxDepth']) {
      expect(isExempt('boot/create-game.ts', m), `a raiz ficou isenta de ${m}, que é a dívida dela e não o trabalho`).toBe(false);
    }
    // And the dictionaries are exempt from everything, because they are DATA: hundreds of lines of sentences are not
    // complexity.
    for (const m of MEASURES) expect(isExempt('i18n/pt.ts', m), 'um dicionário deixou de ser dado').toBe(true);
  });

  /*
   * 🔴 THE SIXTH MEASURE HAS AN OUTSIDE THRESHOLD, and it is the only one. The Dev read the proposal of a LINES ceiling for
   * the root and refused it for the right reason: «isso é arbitrário, precisamos de uma referência melhor». 📏 The
   * literature has none for file size — what it has is McCabe's cyclomatic complexity (1976), with a threshold of 10 per
   * FUNCTION, codified in NIST SP 500-235 (Watson & McCabe, 1996), which allows 15 with a written justification.
   *
   * 🎯 And that is why this case exists: a p90 of this tree would take the threshold from the defect itself, and the first
   * hurry would change the 10 to whatever we already have. The number is tied to a source, not to a percentile.
   *
   * ⚠️ AND THE ROOT IS NOT EXEMPT FROM IT, the other half of the decision: the dependency-injection literature describes a
   * composition root as a place expected to be BIG and holding only WIRING — and wiring does not decide. `createGame`'s
   * branches in a single function are what this measure sees and a lines ceiling never saw.
   */
  it('🔴 [Right] o tecto da pior função é 10, vem de FORA da árvore, e a raiz não é isenta dele', () => {
    /*
     * 🔴 THE RULE AND NOT ONLY THE RECORDED NUMBER, and the difference was measured: reading only `base.ceiling`, which
     * comes from the FILE, let the mutation that makes the ceiling the tree's p90 stay GREEN, because changing the script
     * does not touch the JSON until someone runs `--write`. A case that only reads the record does not see the rule change.
     */
    expect(ceilingFrom(arvore).worstFunction, 'a REGRA do tecto mudou: ele deixou de ser o 10 de McCabe').toBe(10);
    expect(base.ceiling.worstFunction, 'o tecto GRAVADO deixou de ser 10 — se é decisão, ela precisa de fonte').toBe(10);
    expect(isExempt('boot/create-game.ts', 'worstFunction'), 'a raiz ficou isenta da medida que mede a LÓGICA dela').toBe(false);
    expect(arvore['boot/create-game.ts'].worstFunction, 'a raiz deixou de ser medida por função').toBeGreaterThan(0);
  });

  /*
   * 🔴 THE CEILING MOVES ONLY WHEN SOMEONE SAYS SO (ADR-0221: «it moves only when someone re-measures and says so»).
   * 📏 Until 2026-09-23 every `--write` re-derived it from today's tree, and in two days it moved in ten commits, in both
   * directions — lines 187 → 182 → 187 → 200, depth 4 → 3 — each time inside a commit that was about something else. A
   * p90 rises when modules grow or when small ones leave, so a ceiling that follows the tree is the ratchet unscrewing.
   * 📌 The literal below is how a re-measure «says so»: changing the ceiling means changing THIS line, in the diff, where a
   * reviewer reads it. A gate on commit messages cannot do it — CI checks out one commit.
   */
  it('🔴 [Right] o tecto gravado é o que alguém DISSE, e só `--remeasure-ceiling` o muda', () => {
    expect({ takenOn: base.takenOn, ...base.ceiling }, 'the recorded ceiling changed without this line changing').toEqual({
      takenOn: '2026-09-22', codeLines: 187, decisionNodes: 37, maxDepth: 4, fanOut: 6, globalReach: 0, worstFunction: 10,
    });
    const previous = { takenOn: '2026-01-01', ceiling: { codeLines: 1 } };
    expect(ceilingToRecord(arvore, previous, false), 'a plain `--write` re-derived the ceiling').toEqual(
      { ceiling: previous.ceiling, takenOn: previous.takenOn });
    expect(ceilingToRecord(arvore, previous, true).ceiling, 'the explicit re-measure did not re-measure').toEqual(ceilingFrom(arvore));
  });

  it('📌 [Interface] toda isenção nomeia um módulo que existe, e o tecto cobre as quatro medidas', () => {
    // An orphan exemption is the quietest way for the list to grow: nobody reads it, and it authorises what no longer exists.
    const isencoesOrfas = Object.keys(base.exempt).filter((m) => !arvore[m]);
    expect(isencoesOrfas, 'uma isenção aponta para um módulo que saiu').toEqual([]);
    expect(Object.keys(base.ceiling).sort(), 'o tecto não cobre as quatro medidas').toEqual([...MEASURES].sort());
    expect(Object.keys(arvore).length, 'a árvore não foi medida — o crivo não está a medir nada').toBeGreaterThan(100);
  });
});

/*
 * ========================= MUTATIONS CHECKED =========================
 * 1. adding an `if` to a module already in the baseline ........................................... RED on the 1st case
 * 2. creating a new module with 300 lines and 60 branches ......................................... RED on the 2nd
 * 3. deleting a module without rewriting the baseline ............................................. RED on the 3rd
 * 4. adding an exemption for a module that does not exist ......................................... RED on the 4th
 * 5. the root becomes exempt from EVERYTHING, and not only from wiring ............................ RED on the exemption case
 * 6. a NEW module that reaches `document` (step 7d) ............................................... RED on the 2nd
 *    — the reach ceiling is ZERO, not a p90: a new module that touches a global undoes a decision (ADR-0178), it does not
 *      sit above an average.
 * 7. a module already in the baseline gains a reach to `window` ................................... RED on the 1st
 *    — the modules that already reach are frozen and can only shrink: debt does not become a licence.
 * 8. a module gains TWO imports and GROWS in lines ................................................ RED on the 1st
 *    — proves the fan-out clause is narrow: it forgives ONE, and only to whoever gave something in return. Gaining imports
 *      giving nothing still fails, which is the case the measure exists to catch.
 *
 * ========================= and the two of the WIDENED clause (after the icon-catalogue cut) =========================
 * 9.  a module gives lines and gains TWO imports .................................................. RED on the 1st
 *     — the widening did not open the door to the number: it is still ONE.
 * 10. a module gives lines, gains ONE import and GAINS A BRANCH .................................... RED on the 1st
 *     — by two paths, and the second is the point: branches going up are an error on their own AND knock down the
 *     fan-out tolerance.
 *     📌 The control ran green before both, which is what makes them a reading and not decoration.
 *
 * ========================= and the three of the SIXTH measure (McCabe per function) =========================
 * 11. a baseline module gains a function of 13 branches ........................................... RED on the 1st
 * 12. a NEW module is born with a function of 13 branches ......................................... RED on the 2nd
 * 13. the worst-function ceiling becomes the tree's own p90 ....................................... RED on the ceiling case
 *     🔴 AND THIS ONE SURVIVED THE FIRST TIME, which changed the case: it read only `base.ceiling`, from the FILE, and
 *     changing the rule in the script does not touch the JSON until someone runs `--write`. A case that reads the record
 *     does not see the rule change. Now it calls `ceilingFrom` and checks both — the rule and what was recorded.
 *
 * ========================= and the three of the ceiling that changes only when someone says so =========================
 * 14. `--write` derives the ceiling from today's tree again ....................................... RED on the ceiling case
 * 15. the JSON gains a new ceiling without the literal line changing .............................. RED on the ceiling case
 * 16. `--remeasure-ceiling` keeps the old one ..................................................... RED on the ceiling case
 */
