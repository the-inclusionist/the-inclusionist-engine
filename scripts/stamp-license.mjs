// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/stamp-license.mjs — STAMPS THE LICENCE on what goes into the tarball, and makes it a BUILD guarantee instead of
// a side effect of the compiler.
//
// ========================= THE FINDING, AND IT IS SILENT =========================
// Every engine source opens with `// SPDX-License-Identifier: AGPL-3.0-or-later`, and some emitted `.js` came out
// WITHOUT it. `tsc` attaches a top comment to the file's first node, and when that node is ELIDED (`import type`, and
// sometimes an `export type`) the comment goes with it.
//
// ⚠️ AND THE EXACT RULE CANNOT BE STATED WITH CONFIDENCE: two files that both open with `export type` behaved
// differently. A check on the SOURCE that tried to predict it accused many files where only a few were broken — too
// wide, and a gate built on a rule nobody can write is worse than no gate.
//
// ⚠️ AND THE `.d.ts` FILES CARRIED NO HEADER AT ALL. `tsc` does not copy the top comment into the declaration, so half of
// what is published travelled without the line — and a `.d.ts` copied out of the package is code like any other.
//
// ========================= WHY STAMP, AND NOT FIX THE SOURCE =========================
// A blank line before the first `import type` makes `tsc` emit the comment — tested, it works. But it leaves the licence
// depending on a formatting detail that the next reordering of imports undoes with nobody seeing. Stamping is
// deterministic: what leaves the build HAS the line, whatever the compiler's habits, and it covers the `.d.ts` for free.
//
// ⚠️ THIS DOES NOT REPLACE `LICENSE` OR THE `license` FIELD. Both exist and are what the law and npm read; the per-file
// header is what goes with a file someone copies out — exactly the case the AGPL most needs to cover.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CABECALHO = '// SPDX-License-Identifier: AGPL-3.0-or-later';

/**
 * The content, stamped. Pure, and it is what the test exercises.
 *
 * ⚠️ IDEMPOTENT BY DESIGN: the stamp runs at every build, and a second stamp would stack the line. The comparison is with
 * the FIRST line and not with `includes`, because a file that MENTIONS the identifier in the middle (this very script,
 * for example) is not stamped — it is talking about the subject.
 */
export function carimbar(texto) {
  const primeira = texto.slice(0, texto.indexOf('\n') === -1 ? texto.length : texto.indexOf('\n')).trim();
  if (primeira === CABECALHO) return texto;
  return CABECALHO + '\n' + texto;
}

/** The `.js` and `.d.ts` files of a folder, recursively. */
export function emitidos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) saida.push(...emitidos(cheio));
    else if (nome.endsWith('.js') || nome.endsWith('.d.ts')) saida.push(cheio);
  }
  return saida;
}

// Runs as a script; importable as a module by the test (Node's `main` does not match on import).
if (process.argv[1] && process.argv[1].endsWith('stamp-license.mjs')) {
  const dir = process.argv[2] || 'dist-pkg';
  let tocados = 0;
  for (const f of emitidos(dir)) {
    const antes = readFileSync(f, 'utf8');
    const depois = carimbar(antes);
    if (depois !== antes) { writeFileSync(f, depois); tocados++; }
  }
  console.log(`[licença] ${tocados} ficheiro(s) carimbado(s) em ${dir}`);
}
