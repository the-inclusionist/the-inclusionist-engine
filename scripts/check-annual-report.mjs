// SPDX-License-Identifier: AGPL-3.0-or-later
// Annual compliance report gate (ADR-0053, issue #95) — fails (exit 1) when a year that owed a report has none.
//
// ========================= WHAT THIS GUARANTEES, AND WHAT IT DOES NOT =========================
// ⚠️ IT CHECKS EXISTENCE. IT CANNOT JUDGE WHETHER THE REPORT IS ANY GOOD, and this line is here so a green
// run is never read as conformity. ADR-0053 says it in the record: "the gate buys the ritual, not the
// quality". A report that says nothing satisfies this script, and only a person can catch that.
//
// What it does buy is the one thing a person reliably fails at: the year cannot pass without somebody being
// made to write one. Of the twenty-two divergences found between the filed document and the ADRs, the annual
// report was the ONLY obligation that RECURS — every other one is done once and stays done. This one is
// undone by the passage of time, quietly, and by nobody's decision. §51.j says why in its own words:
// "compromisso sem prestação de contas periódica degrada silenciosamente".
//
// ========================= WHY IT IS DORMANT TODAY, AND HOW IT WAKES =========================
// ADR-0053 fixes the mechanism and deliberately leaves one thing open: "the first report is due for the
// first calendar year in which the systems are in use, not now." No date exists in this repository for that,
// and inventing one would be a second opinion about a fact only the Dev has.
//
// So the first year is DECLARED, not guessed, and there are two ways it gets declared — one deliberate and
// one automatic:
//
//   1. `docs/compliance/PRIMEIRO-ANO` holds a four-digit year. Writing it ARMS the gate, which is the way to
//      arm it BEFORE the first report is due — the case ADR-0053 asks for by name, "written before the first
//      report is due, so that the first failure is a reminder rather than a discovery".
//   2. Failing that, the EARLIEST report present arms it. Once a `relatorio-2027.md` exists, every year from
//      2027 onward owes one. This exists so the obligation cannot be started and then dropped: the act of
//      writing the first report is itself what makes the second one mandatory.
//
// With neither, the gate is DORMANT — and says so loudly on every run, because a gate that goes quiet is the
// same silent decay §51.j is about. A dormant gate is a notice, not a pass.
//
//   node scripts/check-annual-report.mjs
//
// Overrides, for the gate's own tests: COMPLIANCE_DIR (where to look) and ANO_ATUAL (what year it is).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** `relatorio-2027.md` and nothing else. A stray `relatorio-27.md` is not a report for 2027; it is a typo. */
export const NOME_DO_RELATORIO = /^relatorio-(\d{4})\.md$/;

/**
 * The years that owe a report and have none, from `primeiroAno` up to and including `anoAtual`.
 *
 * ⚠️ IT LOOKS BACKWARDS, and not only at the current year. A pipeline that ran green in 2028 because
 * `relatorio-2028.md` exists, while 2027 was never written, would be reporting that the commitment was kept
 * when a whole year of it was skipped. The obligation is annual, so the check is every year since the first.
 */
export function anosEmFalta(primeiroAno, anoAtual, anosPresentes) {
  if (primeiroAno === null || primeiroAno > anoAtual) return [];
  const tem = new Set(anosPresentes);
  const falta = [];
  for (let a = primeiroAno; a <= anoAtual; a++) if (!tem.has(a)) falta.push(a);
  return falta;
}

/**
 * The first year that owes a report: the declaration if there is one, else the earliest report present,
 * else `null` (dormant).
 *
 * The declaration WINS over the earliest report on purpose. If someone back-fills a report for a year before
 * the obligation started — a voluntary one, an example — the declared start is still the start; the file is
 * the decision and the reports are evidence.
 */
export function primeiroAnoDevido(declarado, anosPresentes) {
  if (declarado !== null) return declarado;
  return anosPresentes.length ? Math.min(...anosPresentes) : null;
}

/** The four-digit year in `PRIMEIRO-ANO`, or `null` when the file is absent. Anything else throws. */
export function lerDeclaracao(texto) {
  const m = String(texto).trim().match(/^(\d{4})$/);
  if (!m) throw new Error(`PRIMEIRO-ANO must hold a four-digit year and holds ${JSON.stringify(String(texto).trim())}`);
  return Number(m[1]);
}

function principal() {
  const dir = process.env.COMPLIANCE_DIR || join(process.cwd(), 'docs', 'compliance');
  const anoAtual = Number(process.env.ANO_ATUAL) || new Date().getFullYear();

  const arquivos = existsSync(dir) ? readdirSync(dir) : [];
  const anosPresentes = arquivos
    .map((f) => NOME_DO_RELATORIO.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]));

  const decl = join(dir, 'PRIMEIRO-ANO');
  let declarado = null;
  if (existsSync(decl)) {
    try {
      declarado = lerDeclaracao(readFileSync(decl, 'utf8'));
    } catch (e) {
      console.error(`annual report gate: ${decl} is unreadable — ${e.message}`);
      process.exit(1);
    }
  }

  const primeiro = primeiroAnoDevido(declarado, anosPresentes);

  if (primeiro === null) {
    // Dormant. Loud on purpose: this notice is the only thing standing between "not due yet" and "forgotten".
    console.log('annual report gate: DORMANT — no first year declared and no report present.');
    console.log('');
    console.log('  §51.j of the requerimento commits this project to an annual public report on the eleven');
    console.log('  child-protection principles. ADR-0053 leaves the START open: it is due for the first');
    console.log('  calendar year in which the systems are in USE, which no file here knows.');
    console.log('');
    console.log(`  To arm it, write that year into  ${join(dir, 'PRIMEIRO-ANO')}`);
    console.log('  From then on this gate fails every year that has no report.');
    return;
  }

  const falta = anosEmFalta(primeiro, anoAtual, anosPresentes);
  if (falta.length > 0) {
    console.error(`annual report gate: ${falta.length} year(s) owe a compliance report and have none:`);
    for (const a of falta) console.error(`  · ${join(dir, `relatorio-${a}.md`)}`);
    console.error('');
    console.error('For each of the eleven principles of Anexo III: the parameter as implemented, where it');
    console.error('lives, and the gate that holds it. Most of those gates already run (ADR-0049, ADR-0050,');
    console.error('ADR-0048 §8) — the report is largely an index of them, and a principle with no gate is');
    console.error('supposed to show up here as a hole. See ADR-0053.');
    process.exit(1);
  }

  const desde = primeiro === anoAtual ? `${anoAtual}` : `${primeiro}–${anoAtual}`;
  console.log(`annual report gate: every year from ${desde} has a report. (Existence only — nobody checked the text.)`);
}

// Only when RUN, never when imported: the gate's own tests import the pure functions above.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) principal();
