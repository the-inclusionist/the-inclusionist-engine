// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO COPIES OF THE VALIDATOR DO NOT DRIFT — the countermeasure for the drift ADR-0123 bought.
//
// ========================= WHY THIS EXISTS, AND WHAT IT COSTS IF IT DOES NOT =========================
// 🔴 The Dev's rule is «cada repositório precisa ter seus validadores e gates para ADRs», and it wins over my objection
// for a reason written in ADR-0123 §4: a gate that lives somewhere else is a gate that does not run here. The price is
// what ADR-0068 §4 refused for `game-ci.yml` — TWO copies of a tool, and two copies drift.
//
// 📏 AND IT IS NOT A HYPOTHESIS: it drifted on day one. `--repo` was born on the records' side, this repository's copy
// still only had `--root`, and the first cross run returned NINE false failures. I saw them because I was looking at
// the output; next time nobody may be looking.
//
// ⚠️ AND THE DEFECT IS NOT THE OUT-OF-DATE COPY — it is the VERDICT. With two versions, the same tree is green in one
// repository and red in the other, and nothing says which of the two is right. A gate that disagrees with itself is
// worse than one gate fewer: it produces confidence where there is none.
//
// 📌 The tree arrives as in `ponteiros-de-registo`: through `ADR_TREE` (what CI passes) or through the sibling clone.
// With neither, the cases SKIP — and the `ADR_TREE_REQUIRED` case, in that file, is what refuses the skip in the job
// that declares itself responsible for the tree.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATAS = [
  process.env.ADR_TREE,
  fileURLToPath(new URL('../../the-inclusionist-docs/docs/2-Architecture/adr/', import.meta.url)),
].filter(Boolean);
const ADR = CANDIDATAS.find((p) => existsSync(p)) ?? CANDIDATAS[CANDIDATAS.length - 1];
const TEM_ARVORE = existsSync(ADR);
const RAIZ_DOS_REGISTOS = TEM_ARVORE ? resolve(ADR, '..', '..', '..') : '';

const AQUI = fileURLToPath(new URL('../scripts/validate-adr.py', import.meta.url));
const LA = TEM_ARVORE ? join(RAIZ_DOS_REGISTOS, 'scripts', 'validate-adr.py') : '';

/**
 * ⚠️ LINE ENDINGS NORMALISED, and it is not leniency: the two repositories are cloned on machines with different
 * `core.autocrlf` settings, and an extra `\r` is not a behaviour drift. What this file guards is the CODE that decides
 * the verdict.
 */
const corpo = (caminho) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');

describe.skipIf(!TEM_ARVORE)('o validador deste repositório e o dos registos', () => {
  it('📌 [Vácuo] os dois ficheiros existem e têm código — senão isto compara dois vazios', () => {
    // Without this case, deleting one of the two would leave [Interface] comparing `''` with `''` and passing. It is the
    // WAY-OUT half: a sieve that reads nothing is green for the worst reason.
    expect(existsSync(AQUI), `o validador deste repositório sumiu (${AQUI})`).toBe(true);
    expect(existsSync(LA), `o validador dos registos não está em ${LA}`).toBe(true);
    expect(corpo(AQUI).length, 'o validador daqui está vazio').toBeGreaterThan(2000);
    expect(corpo(LA).length, 'o validador dos registos está vazio').toBeGreaterThan(2000);
    // 🔴 AND THE TWO PATHS HAVE TO BE DIFFERENT FILES — CI proved this assertion was missing.
    //
    // The records' root was computed with `new URL('../../../', …)`, which depends on the TRAILING SLASH: the sibling
    // clone had it, CI's `ADR_TREE` did not. There, the root resolved one level up and `LA` pointed at THIS repository's
    // validator — the case compared the file with itself and passed. A blind gate, and blind exactly where only CI
    // exercises it.
    //
    // ⚠️ The vacuum check did not catch it because both files EXISTED: it was the same one, twice. «Existe» is not the
    // whole question when two paths can collapse into one.
    expect(resolve(AQUI), `os dois caminhos resolvem para o MESMO ficheiro (${AQUI}) — a comparação seria consigo própria`)
      .not.toBe(resolve(LA));
  });

  it('🎯 [Interface] as duas cópias são a MESMA — duas versões dão dois veredictos sobre a mesma árvore', () => {
    expect(
      corpo(AQUI) === corpo(LA),
      'as duas cópias do `validate-adr.py` divergiram. A mesma árvore vai ficar verde num repositório e '
      + 'vermelha no outro, e nada dirá qual está certo. Copie a do `the-inclusionist-docs` para aqui — ela '
      + 'é a que vive com os registos —, ou, se a diferença for deliberada, este caso é o sítio para a '
      + 'declarar com o motivo.',
    ).toBe(true);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. adding a line to `scripts/validate-adr.py` (the real drift) → [Interface] fails, with the sentence that says what
//    to do. It is the mutation that describes the defect that already happened once.
// 2. comparing by SIZE instead of by content → two versions of the same size would pass; the mutation survives the happy
//    case and is caught by 1, which changes the size — that is why the comparison is on the body.
// 3. removing the `[Vácuo]` and deleting one of the copies → [Interface] would compare two empties and stay GREEN. That is
//    why the vacuum comes first and is not decoration.
