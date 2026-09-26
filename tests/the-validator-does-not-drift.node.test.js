// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO COPIES OF THE RECORDS TOOLING DO NOT DRIFT — the countermeasure for the drift ADR-0123 bought, widened by ADR-0242.
//
// ========================= WHY THIS EXISTS, AND WHAT IT COSTS IF IT DOES NOT =========================
// 🔴 The Dev's rule is «cada repositório precisa ter seus validadores e gates para ADRs», and it wins over my objection
// for a reason written in ADR-0123 §4: a gate that lives somewhere else is a gate that does not run here. The price is
// what ADR-0068 §4 refused for `game-ci.yml` — TWO copies of a tool, and two copies drift.
//
// 📏 AND IT IS NOT A HYPOTHESIS: it drifted on day one. `--repo` was born on the records' side, this repository's copy
// still only had `--root`, and the first cross run returned NINE false failures.
//
// ⚠️ AND THE DEFECT IS NOT THE OUT-OF-DATE COPY — it is the VERDICT. With two versions, the same tree is green in one
// repository and red in the other, and nothing says which of the two is right.
//
// 📌 SINCE ADR-0242 BOTH REPOSITORIES KEEP RECORDS, so both keep the whole kit: the validator, its test, and the two
// sieves of the records' debt and tempo with the debt's test. Five files, and each pair is compared here. The records
// repository arrives through `DOCS_ROOT` (what the `adr` job passes after checking it out) or through a sibling clone
// named `the-inclusionist-docs`. With neither, the comparison SKIPS — and `DOCS_ROOT_REQUIRED`, set by the job that
// fetched it, turns that skip into a failure.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATAS = [
  process.env.DOCS_ROOT,
  fileURLToPath(new URL('../../the-inclusionist-docs/', import.meta.url)),
].filter(Boolean);
const LA_RAIZ = CANDIDATAS.find((p) => existsSync(join(p, 'scripts', 'validate-adr.py')))
  ?? CANDIDATAS[CANDIDATAS.length - 1];
const TEM_OUTRO = existsSync(join(LA_RAIZ, 'scripts', 'validate-adr.py'));
const AQUI_RAIZ = fileURLToPath(new URL('../', import.meta.url));

/** The records tooling that exists in both repositories, byte for byte (ADR-0242 §5). */
const KIT = [
  'scripts/validate-adr.py',
  'scripts/test-validate-adr.py',
  'scripts/tempo-dos-registos.py',
  'scripts/divida-dos-registos.py',
  'scripts/test-divida-dos-registos.py',
];

/**
 * ⚠️ LINE ENDINGS NORMALISED, and it is not leniency: the two repositories are cloned on machines with different
 * `core.autocrlf` settings, and an extra `\r` is not a behaviour drift. What this file guards is the CODE that decides
 * the verdict.
 */
const corpo = (caminho) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

describe('the records repository, where this job declares it needs it', () => {
  it('🔴 [Interface] where it is REQUIRED, skipping fails — a gate that skips by itself is not a gate', () => {
    // A failing checkout brings the job down by itself; what nobody would catch is `DOCS_ROOT` holding a wrong path.
    // 📌 `DOCS_ROOT_REQUIRED` and not `CI`: the whole suite also runs in the `gate` job, which does not fetch the
    // records repository and must not fail for lacking what it never meant to fetch.
    expect(
      TEM_OUTRO || !process.env.DOCS_ROOT_REQUIRED,
      `the records repository was not found at ${LA_RAIZ}, and this job declared itself responsible for it `
      + '(`DOCS_ROOT_REQUIRED`). It comes by checkout of `the-inclusionist-docs`, with `DOCS_ROOT` pointing at its '
      + 'root; locally, a sibling clone serves.',
    ).toBe(true);
  });
});

describe.skipIf(!TEM_OUTRO)('the records tooling here and in the-inclusionist-docs', () => {
  it.each(KIT)('📌 [Vacuum] %s exists on both sides and has code — otherwise this compares two empties', (f) => {
    const aqui = join(AQUI_RAIZ, f);
    const la = join(LA_RAIZ, f);
    expect(existsSync(aqui), `${f} is missing here (${aqui})`).toBe(true);
    expect(existsSync(la), `${f} is missing in the records repository (${la})`).toBe(true);
    expect(corpo(aqui).length, `${f} is empty here`).toBeGreaterThan(1000);
    expect(corpo(la).length, `${f} is empty in the records repository`).toBeGreaterThan(1000);
    // 🔴 AND THE TWO PATHS HAVE TO BE DIFFERENT FILES — CI once resolved the other root one level too high, and the
    // comparison read this repository's file twice and passed.
    expect(resolve(aqui), `both paths resolve to the SAME file (${aqui}) — the comparison would be with itself`)
      .not.toBe(resolve(la));
  });

  it.each(KIT)('🎯 [Interface] %s is the SAME in both repositories — two versions give two verdicts on one tree', (f) => {
    expect(
      corpo(join(AQUI_RAIZ, f)) === corpo(join(LA_RAIZ, f)),
      `the two copies of \`${f}\` diverged. The same tree will be green in one repository and red in the other, and `
      + 'nothing will say which is right. Make them equal in the same change, in both repositories — or, if the '
      + 'difference is deliberate, this file is the place to declare it with its reason.',
    ).toBe(true);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. adding a line to `scripts/validate-adr.py` (the real drift) → [Interface] fails for that file, with the sentence that
//    says what to do. It is the mutation that describes the defect that already happened once.
// 2. the same for `scripts/tempo-dos-registos.py` → [Interface] fails for that file: the kit is compared file by file.
// 3. emptying one copy → [Vacuum] fails instead of [Interface] comparing two empties.
// 4. `DOCS_ROOT` pointing at a folder with no tooling, with `DOCS_ROOT_REQUIRED=1` → the required case fails.
