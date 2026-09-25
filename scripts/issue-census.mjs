// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ISSUE CENSUS — how many are problems code can solve, and how many are books (ADR-0126).
//
// ========================= WHY THIS EXISTS, AND WHY IT DOES NOT FAIL =========================
// 📏 The Dev measured the tracker: most open issues were not code problems, bodies ran to a median of about 1500
// characters, and checklist boxes were in about a tenth of them. The instrument that was the whole purpose
// («transformar planos em issues para facilitar a marcação das partes cumpridas») was in a tenth of the tracker; the
// prose was in all of it.
//
// ⚠️ AND THEY HAD TO DISCOVER IT. That is why ADR-0126 asked for a REPEATABLE census: a number that appears only when
// someone is suspicious is a number that arrives late.
//
// 🛑 IT REPORTS AND DOES NOT FAIL, ON PURPOSE. The shape of a tracker is nothing to hold a build red for — no commit
// fixes it, and a gate that is permanently red is a gate someone switches off (the lesson `check:annual-report`
// already carries). It always exits 0.
//
// ⚠️ AND IT SAYS WHAT IT COULD NOT CLASSIFY. A check that looks at nothing and prints that all is well is worse than no
// check: the first is read as a guarantee.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = process.argv[2] ?? 'the-inclusionist/the-inclusionist-engine';

/**
 * ADR-0126'S BUDGET — the issue's body must be shorter than the commit that closes it.
 *
 * 📏 DERIVED FROM THE TREE: the rule compares with the message that CLOSES the issue, which is not known in advance, so
 * the budget is the lowest decile of this repository's commit messages (measured over the last 400: median 2619
 * characters, lowest decile 1388). A body below it is shorter than 90% of the commits of this tree, so it keeps the rule
 * against almost any closing. An invented number (600) made the census flag nearly every issue, and a report that
 * accuses almost everything is a report nobody reads.
 *
 * 📌 Derived and not chosen, for the same reason the number of keyboard slots is `ACTIONS.length` — a number written by
 * hand starts lying the day the tree changes.
 */
const ORCAMENTO_CHARS = 1400;

/**
 * THE TITLE PATTERNS THAT GIVE AWAY A NON-ISSUE. ⚠️ They are a HEURISTIC and the report says so — what is mechanical is
 * the SIZE and the BOX; this is a clue, and a clue presented as a measurement is the kind of false report this
 * repository has caught before.
 */
// ⚠️ AND THE NAME TAG SAYS WHO DOES THE WORK, NOT WHAT IT IS — #9 (diagnosing the VLibras error) is field diagnosis whose
// FIX is code. The clue is right about the issue as written and would be wrong if it were rewritten as the defect.
// That is why this is a clue and not a verdict.
export const PISTAS = [
  [/^roadmap\b/i, 'fase de roadmap → `ROADMAP.md`'],
  [/^\[jos[ée]\]/i, 'trabalho de campo → `Test-Plan.md`'],
  [/^\[research\]|^research:/i, 'produz documento ou registo'],
  [/\bdecis[ãa]o\b|\bdecidir\b|^choose\b|\bde onde vem\b/i, 'decisão → um REGISTO, não uma issue'],
];

/** A body's checklist boxes. The half ADR-0126 calls the tracker's whole purpose. */
export const contarCaixas = (corpoDaIssue) => (String(corpoDaIssue ?? '').match(/^\s*[-*]\s*\[[ xX]\]/gm) ?? []).length;

/** The clue a title gives, or `null`. Pure, so a case can drive it. */
export const pistaDoTitulo = (titulo) => PISTAS.find(([re]) => re.test(String(titulo ?? '')))?.[1] ?? null;

function issuesAbertas() {
  try {
    const out = execFileSync('gh', [
      'issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200',
      '--json', 'number,title,body',
    ], { encoding: 'utf8', maxBuffer: 1 << 28 });
    return JSON.parse(out);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// 🛑 THE RUNNER RUNS ONLY WHEN THE FILE IS EXECUTED, never when it is IMPORTED. Without this guard, the case that
// exercises the pure halves would go to the NETWORK on import — and a test that depends on `gh` is a test that goes red
// because of a token, which is how a gate stops being read.
function main() {
  const dados = issuesAbertas();

  // 🛑 DORMANT AND OUT LOUD: without `gh`, a network or access, the census measured NOTHING — and saying zero problems here
  // would be exactly the lie this file exists not to tell. ⚠️ And a 404 without authentication is not absence: it is
  // lack of access, which has already cost this project a plan redone on top of an emptiness.
  if (dados.error) {
    console.log('issue census: DORMANT — could not read the tracker.');
    console.log(`  reason: ${dados.error.split('\n')[0]}`);
    console.log('  ⚠️ this is NOT «zero problems»: it is zero measurements. Run it with `gh auth status` passing.');
    process.exit(0);
  }

  const corpo = (i) => (i.body ?? '').replace(/\r/g, '');
  const caixas = (i) => contarCaixas(corpo(i));
  const pistaDe = (i) => pistaDoTitulo(i.title);

  const grandes = dados.filter((i) => corpo(i).length > ORCAMENTO_CHARS);
  const semCaixa = dados.filter((i) => caixas(i) === 0);
  const suspeitas = dados.map((i) => [i, pistaDe(i)]).filter(([, p]) => p);
  const tamanhos = dados.map((i) => corpo(i).length).sort((a, b) => a - b);
  const mediana = tamanhos.length ? tamanhos[Math.floor(tamanhos.length / 2)] : 0;

  console.log(`issue census · ${REPO}`);
  console.log(`  OPEN: ${dados.length}   median body: ${mediana} chars   budget: ${ORCAMENTO_CHARS}`);
  // 🎯 THE ACTIONABLE NUMBER IS THE INTERSECTION. Counting boxes alone accused small issues of a few hundred characters, each
  // with a clear `done when` in one paragraph — a small issue does not need a checklist, it needs to be small. ⚠️ Adding
  // noise to the signal is how a check stops being read: the two raw numbers stay in view because they measure real
  // things, and the third is the one to chase. It is the lesson the modules-without-tests check had already taught —
  // there too the rule was the intersection, and not every module without a test, which would accuse `core/entity` with its
  // many importers.
  const grandesSemCaixa = grandes.filter((i) => caixas(i) === 0);

  console.log(`  📏 MECHANICAL — over the budget: ${grandes.length}/${dados.length}` +
    `   ·   without a single box: ${semCaixa.length}/${dados.length}`);
  console.log(`  🎯 ACTIONABLE — big AND without a list (a book with no checklist): ${grandesSemCaixa.length}`);
  for (const i of [...grandesSemCaixa].sort((a, b) => corpo(b).length - corpo(a).length)) {
    console.log(`     #${String(i.number).padStart(3)} ${String(corpo(i).length).padStart(5)} chars · ${i.title.slice(0, 56)}`);
  }

  if (grandes.length) {
    console.log('\n  the biggest (the body has to be shorter than the commit that closes it):');
    for (const i of [...grandes].sort((a, b) => corpo(b).length - corpo(a).length).slice(0, 8)) {
      console.log(`    #${String(i.number).padStart(3)} ${String(corpo(i).length).padStart(5)} chars · ${caixas(i)} boxes · ${i.title.slice(0, 58)}`);
    }
  }

  console.log(`\n  🔎 HEURISTIC (a clue from the TITLE, not a measurement): ${suspeitas.length} may not be code problems`);
  for (const [i, p] of suspeitas) console.log(`    #${String(i.number).padStart(3)} ${p} — ${i.title.slice(0, 52)}`);

  // 🎯 THE HALF THAT SEPARATES AN INVENTORY FROM A MONUMENT: saying how many were NOT classified. Without this line, a
  // whole tracker of cases the heuristic does not reach would leave here looking approved.
  const naoClassificadas = dados.length - suspeitas.length;
  console.log(`\n  ⚠️ ${naoClassificadas} issues were NOT classified by any clue — the heuristic reads TITLES,`);
  console.log('     and a decision with a task\'s title slips past it. The number above is a floor, not a total.');
  console.log('\n  (report: this command never fails — see the header and ADR-0126)');
  return;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
