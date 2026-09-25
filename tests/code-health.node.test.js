// SPDX-License-Identifier: AGPL-3.0-or-later
// CODE HEALTH ONLY IMPROVES — the ratchet of the SEVEN measures (ADR-0221 and ADR-0232, issues #203 and #207).
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
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { runtimeSpecifiersOf } from '../scripts/lib/module-specifiers.mjs';
import {
  measureTree, measureModule, readBaseline, isExempt, ceilingFrom, ceilingToRecord, statefulSet, MEASURES, BASELINE,
} from '../scripts/code-health.mjs';

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
    // ADR-0232 point 4: constructing the state everything else receives is the root's job, so it is exempt from
    // `statefulEdges` too — and it is still MEASURED, so the wiring it does is visible. 📌 Since D3's last step (erratum of
    // 2026-09-25) no module is stateful, so the root's measure is ZERO and must still be a measure: a number, not absent.
    expect(isExempt('boot/create-game.ts', 'statefulEdges'), 'the root lost its statefulEdges exemption').toBe(true);
    expect(typeof arvore['boot/create-game.ts'].statefulEdges, 'the root stopped being measured on stateful edges').toBe('number');
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
      statefulEdges: 0,
    });
    // A plain `--write` keeps every recorded ceiling; only a measure the file has never recorded takes its rule's.
    const previous = { takenOn: '2026-01-01', ceiling: { codeLines: 1 } };
    expect(ceilingToRecord(arvore, previous, false), 'a plain `--write` re-derived the ceiling').toEqual(
      { ceiling: { ...ceilingFrom(arvore), codeLines: 1 }, takenOn: previous.takenOn });
    expect(ceilingToRecord(arvore, previous, true).ceiling, 'the explicit re-measure did not re-measure').toEqual(ceilingFrom(arvore));
  });

  /*
   * 🔴 THE SEVENTH MEASURE HAS A CEILING OF ZERO BY DECISION (ADR-0232 point 4): state arrives by injection, so a new
   * module that imports a stateful one by value is undoing that decision, not sitting above an average. The RULE is
   * checked and not only the recorded number — a case that reads the file does not see the script change (mutation 13).
   */
  it('🔴 [Right] a new module imports no stateful module by value: the ceiling is 0 by decision', () => {
    expect(ceilingFrom(arvore).statefulEdges, 'the RULE of the statefulEdges ceiling stopped being zero').toBe(0);
    expect(base.ceiling.statefulEdges, 'the RECORDED statefulEdges ceiling stopped being zero').toBe(0);
  });

  /*
   * 🔴 THE STATEFUL SET IS WRITTEN BY NAME, AND THE TREE MUST MATCH IT BOTH WAYS (ADR-0232 point 4). A module that starts
   * holding state reddens here until someone writes it into the set and says why; a module that stopped holding state
   * reddens until the payment is written down. Either way the classification is a line a reviewer reads in a diff —
   * never a number derived in silence.
   */
  it('🔴 [Right] the stateful set written in the baseline is the set measured today, both ways', () => {
    const measured = statefulSet(arvore);
    const written = base.stateful ?? [];
    expect(measured.filter((m) => !written.includes(m)), `modules that hold state or reach a global and are not written in `
      + `${BASELINE} \`stateful\` — state arrives by injection (ADR-0232); if it must stay, run \`--write\` and say why`).toEqual([]);
    expect(written.filter((m) => !measured.includes(m)), `modules written as stateful in ${BASELINE} that no longer are — `
      + 'a debt was paid: run `--write` and say so').toEqual([]);
    // And every edge the measure counts points into that written set.
    for (const [mod, m] of Object.entries(arvore)) {
      expect(m.statefulImports ?? [], `${mod}: statefulEdges and the listed imports disagree`).toHaveLength(m.statefulEdges);
      for (const t of m.statefulImports ?? []) expect(written, `${mod} imports ${t}, which is not written as stateful`).toContain(t);
    }
  });

  /*
   * 🔴 ADR-0232'S END STATE, MEASURED: NO MODULE OUTSIDE THE ROOT HOLDS STATE OR REACHES A GLOBAL (D3's last step, erratum
   * of 2026-09-25: `core/i18n`'s module-level `t`/`registerDict` left, and with them the last stateful module). A module that
   * starts holding state again reddens here even if someone wrote it into the baseline, because the end state is the
   * decision and not the file.
   */
  it('🔴 [Right] no module outside the root is stateful — ADR-0232\'s end state (D3 and D4)', () => {
    const outside = statefulSet(arvore).filter((m) => m !== 'boot/create-game.ts');
    expect(outside, 'a module outside the composition root holds state again').toEqual([]);
    expect(base.stateful ?? [], 'the baseline writes a stateful module again').toEqual([]);
  });

  /*
   * 🔴 FAN-OUT COUNTS VALUE IMPORTS ONLY (ADR-0232 point 3): a type import is a dependence on a contract, erased at build,
   * and it is what injection asks a module to depend on. Every form is here, because the defect this prevents is the
   * rule quietly counting one of them again.
   */
  it('🔴 [Right] fan-out counts value imports only: every type-only form is left out', () => {
    const m = measureModule([
      "import type { A } from './a.js';",
      "import { type B, type C } from './b.js';",
      "export type { D } from './d.js';",
      "export { type E } from './e.js';",
      "import { f, type G } from './f.js';", // one value binding makes it a value import
      "import './side-effect.js';", // a side effect loads the module
      "import H from './h.js';",
      "export { i } from './i.js';",
      "import ts from 'typescript';", // a package is not coupling inside this tree
    ].join('\n'));
    expect(m.imports.sort(), 'the value imports').toEqual(['./f.js', './h.js', './i.js', './side-effect.js']);
    expect(m.fanOut, 'fan-out counted a type-only import').toBe(4);
  });

  /*
   * 🔴 AND IT COUNTS EVERY FORM THAT LOADS CODE, not only the ones with `from`. The measure read `import`/`export`
   * declarations alone, and so missed the lazy `import()` edges of `core/i18n` (the two dictionaries), `platform/tts` (the
   * Kokoro runtime) and the root (reading, microphone) — the same blind spot the import gates had before they moved to
   * the shared parser. A lazy import defers WHEN a module loads, not WHETHER this one depends on it (ADR-0228's count
   * followed them on purpose).
   */
  it('🔴 [Right] fan-out counts a lazy import(), require() and a worker URL; a non-literal import() and a type query are not edges', () => {
    const m = measureModule([
      "export const load = () => import('./lazy.js');",
      'export const again = () => import("./lazy.js");', // double quotes, same module: counted once
      "const fs = require('./req.js');",
      "import legacy = require('./legacy.js');",
      "new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });",
      'export const byUrl = (u: string) => import(u);', // names no module of this tree
      "let t: typeof import('./only-type.js');", // erased, like `import type`
      "export * from './star.js';",
    ].join('\n'));
    expect(m.imports.sort(), 'the edges').toEqual(['./lazy.js', './legacy.js', './req.js', './star.js', './worker.js']);
    expect(m.fanOut, 'fan-out missed a form that loads code, or counted one that does not').toBe(5);
  });

  /*
   * 🔴 ONE READER, CHECKED ON THE REAL TREE: fan-out and `statefulEdges` agree, module by module, with what the import gates'
   * reader says the module loads. Two readers for the same question is how the gates went blind before; this case is what
   * reddens if the measure grows a private one again.
   */
  it('🔴 [Right] fan-out and statefulEdges read the same edges the import gates read, in every module', () => {
    const stateful = new Set(statefulSet(arvore));
    const disagree = [];
    for (const [mod, m] of Object.entries(arvore)) {
      const text = readFileSync(new URL(`../app/js/${mod}`, import.meta.url), 'utf8');
      const specs = [...new Set(runtimeSpecifiersOf(text, mod)
        .filter((s) => s.spec?.startsWith('.')).map((s) => s.spec))];
      const targets = [...new Set(specs.map((s) => posix.join(posix.dirname(mod), s).replace(/\.js$/, '.ts')))];
      const intoState = targets.filter((t) => stateful.has(t)).sort();
      if (m.fanOut !== specs.length) disagree.push(`${mod} fanOut ${m.fanOut}, the reader ${specs.length}`);
      if (JSON.stringify(m.statefulImports ?? []) !== JSON.stringify(intoState)) {
        disagree.push(`${mod} statefulImports ${JSON.stringify(m.statefulImports ?? [])}, the reader ${JSON.stringify(intoState)}`);
      }
    }
    expect(disagree, 'the measure and scripts/lib/module-specifiers.mjs disagree on what a module loads').toEqual([]);
  });

  /*
   * 🔴 REACH SEES EVERY DOOR TO THE BROWSER THE TREE USES, AND ONLY THE GLOBAL ONE (ADR-0232 point 2). A local that
   * shadows a global name is injection, not reach; a name in a type or as a member is not a reach either.
   */
  it('🔴 [Right] reach sees globalThis, the frame clock, caches, workers, audio and speech — and not a shadowing local', () => {
    const reached = (src) => measureModule(src).reached;
    expect(reached('const d = (globalThis as { document?: Document }).document;')).toEqual(['globalThis']);
    expect(reached('requestAnimationFrame(() => 0);')).toEqual(['requestAnimationFrame']);
    expect(reached("const c = await caches.open('x'); new Worker('w.js'); WebAssembly.instantiate(b);"))
      .toEqual(['WebAssembly', 'Worker', 'caches']);
    expect(reached('new (window.AudioContext ?? webkitAudioContext)(); new AudioContext();'))
      .toEqual(['AudioContext', 'webkitAudioContext', 'window']);
    expect(reached("location.search; speechSynthesis.speak(new SpeechSynthesisUtterance('a')); crypto.subtle;"))
      .toEqual(['SpeechSynthesisUtterance', 'crypto', 'location', 'speechSynthesis']);
    // Shadowing: a parameter, a local const, a destructured name, a catch binding, a module-level import.
    expect(reached('function f(document: Document) { return document.body; }')).toEqual([]);
    expect(reached('const g = (w: Window) => { const window = w; return window.innerWidth; };')).toEqual([]);
    expect(reached('export function h(p: { location: Location }) { const { location } = p; return location.href; }')).toEqual([]);
    expect(reached("import { fetch } from './port.js'; fetch('x');")).toEqual([]);
    // ⚠️ And shadowing is SCOPED: the global read outside the function that shadows it still counts.
    expect(reached('function f(document: Document) { return document; }\nconst b = document.body;')).toEqual(['document']);
    // Types and member names reach nothing.
    expect(reached('let r: ReturnType<typeof requestAnimationFrame>; const o = { location: 1 }; o.location; interface I { crypto: 1 }'))
      .toEqual([]);
  });

  /*
   * 🔴 WHAT MAKES A MODULE STATEFUL (ADR-0232 point 4), one line per rule and one per thing that must NOT count, so the
   * written set cannot drift by the rule changing under it.
   */
  it('🔴 [Right] a module holds state by a module-level let, a mutated const, or a createX() singleton — and nothing else', () => {
    const holds = (src) => measureModule(src).holds;
    expect(holds('let current = 0; export var legacy = 1;')).toEqual(['let current', 'var legacy']);
    expect(holds('const cache = new Map(); export const put = (k, v) => { cache.set(k, v); };')).toEqual(['mutated cache']);
    expect(holds('const list = []; export const add = (x) => list.push(x);')).toEqual(['mutated list']);
    expect(holds('const conf = { a: 1 }; export const set = (v) => { conf.a = v; };')).toEqual(['mutated conf']);
    expect(holds('const byKey = {}; export const put = (k, v) => { byKey[k] = v; };')).toEqual(['mutated byKey']);
    expect(holds('const shared = createRng(1); export const rnd = shared.rnd;')).toEqual(['singleton shared']);
    // Not state: a table nobody writes, a Set only read, state inside a factory, and a local that shadows the const.
    expect(holds('export const TABLE = Object.freeze({ a: 1 }); export const KEYS = new Set(["a"]); KEYS.has("a");')).toEqual([]);
    expect(holds('export const createX = () => { let n = 0; const m = new Map(); return () => { n++; m.set(n, n); }; };')).toEqual([]);
    expect(holds('const cache = new Map(); export const f = () => { const cache = new Map(); cache.set(1, 1); };')).toEqual([]);
    expect(holds('declare const __BUILD__: string;')).toEqual([]);
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
 *
 * ========================= and those of ADR-0232 (value-only fan-out, wider reach, `statefulEdges`) =========================
 * 17. a stateless baseline module (`core/ring`) gains a value import of `core/i18n` ................ RED on the 1st
 * 18. the same while GIVING a line and a branch, so the fan-out +1 clause forgives the import ...... RED on the 1st
 *     — and the only line is `core/ring.ts statefulEdges: 0 → 1`: the clause forgives fan-out, never state.
 * 19. fan-out counts a type-only import again ..................................................... RED on the 1st and the fan-out case
 * 20. a module removed from the written `stateful` set ............................................ RED on the stateful-set case
 * 21. a stateless module added to the written `stateful` set ...................................... RED on the stateful-set case
 * 22. a NEW module imports `core/i18n` by value .................................................... RED on the 2nd
 *     📌 CONTROL: the same new module importing `core/i18n` by TYPE only ran GREEN.
 * 23. `core/actions`, imported by eight modules, gains a module-level `let` ........................ RED on the 1st and the stateful-set case
 * 24. the root loses its `statefulEdges` exemption ................................................. RED on the exemption case
 *     — with the tree standing still the root's 22 edges do not grow, so only the exemption case can see this.
 * 25. the `statefulEdges` ceiling becomes the tree's p90 ........................................... RED on the zero-ceiling case
 * 26. the `createX()` singleton rule is removed .................................................... RED on the stateful-set and the holds case
 * 27. reach ignores shadowing ...................................................................... RED on the reach case
 * 28. a mutated module-level const is never seen ................................................... RED on the stateful-set and the holds case
 * 29. `globalThis` leaves the list of globals ...................................................... RED on the stateful-set and the reach case
 * 30. `statefulEdges` counts type-only imports too ................................................. RED on the 1st
 * 31. names in type positions count as reach ....................................................... RED on the 1st, the stateful-set and the reach case
 * 32. a plain `--write` stops filling a measure the file never recorded ............................ RED on the ceiling case
 * 33. a module-level `var` is not state ............................................................ RED on the holds case
 *
 * ========================= and those of the ONE READER (every form that loads code is an edge) =========================
 * 34. the measure reads `import`/`export` declarations only again ................................. RED on the forms and the one-reader case
 * 35. a lazy `import()` is dropped ................................................................ RED on the forms and the one-reader case
 * 36. `require()` is dropped ....................................................................... RED on the forms case
 *     — only there: `app/js` has no `require` today, so the tree cannot see it and the fixture must.
 * 37. a worker's `new URL(…, import.meta.url)` is dropped ......................................... RED on the forms and the one-reader case
 * 38. `statefulEdges` gets a second, static-only reader of its own ................................ RED on the one-reader case
 *     — only there: the ratchet reads it as an improvement, which is exactly how a blind reader passes.
 * 39. a non-literal `import(url)` is counted as an edge ........................................... RED on the 1st, the forms and the one-reader case
 * 40. type-only forms are counted (`specifiersOf` instead of `runtimeSpecifiersOf`) ............... RED on the 1st, the type-only, the forms and the one-reader case
 */
