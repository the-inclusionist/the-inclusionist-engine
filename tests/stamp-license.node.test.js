// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LICENCE STAMP — the guarantee that what is published carries the AGPL in every file.
//
// ========================= THE FINDING =========================
// The engine's 114 sources all open with the SPDX identifier. Measured on 2026-09-06: THREE of the 112 emitted `.js`
// came out WITHOUT it, and ALL 112 `.d.ts` came out without it. `tsc` attaches the top comment to the file's first node
// and, when that node is ELIDED (`import type`), the comment goes with it; and for the declaration it simply does not
// copy it.
//
// ⚠️ AND THE EXACT RULE CANNOT BE STATED WITH CONFIDENCE — `core/contract.ts` and `render/viz-modes.ts` both open with
// `export type` and only one lost the header. A sieve on the SOURCE trying to predict that accused 24 files when 3 were
// broken. So the licence no longer depends on the compiler: it is STAMPED.
//
// ========================= WHY THE TEST IS HERE AND NOT ON `dist-pkg` =========================
// The same reason as `engine-package.node.test.js`: a gate that only works after a build someone may forget fails OPEN,
// which is the worst kind — it looks green. What is checked here is the FUNCTION, which is pure, plus its WIRING into
// `build:pkg` (and `prepack` calls `build:pkg`, so the `npm publish` path necessarily goes through here).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { carimbar, CABECALHO } from '../scripts/stamp-license.mjs';

describe('carimbar — o ficheiro emitido leva a licença, venha ele como vier', () => {
  it('[Right] põe o cabeçalho em quem não o tem', () => {
    expect(carimbar('export const x = 1;\n')).toBe(`${CABECALHO}\nexport const x = 1;\n`);
  });

  it('[Right] ⚠️ IDEMPOTENTE — o carimbo corre a cada build, e empilhar a linha seria o defeito óbvio', () => {
    const uma = carimbar('export const x = 1;\n');
    expect(carimbar(uma)).toBe(uma);
    expect(carimbar(carimbar(uma))).toBe(uma);
  });

  it('[Boundary] ⚠️ MENCIONAR o identificador não é ESTAR carimbado', () => {
    // The easy mistake here is testing with `includes`: a file that talks about the subject in the middle — this very
    // script, or a comment explaining the licence — would pass as stamped and go out without the first line. The
    // comparison is with the FIRST line, and this case is what stops a return to `includes`.
    const fala = `export const nota = 'usa ${CABECALHO}';\n`;
    expect(carimbar(fala).startsWith(CABECALHO + '\n')).toBe(true);
    expect(carimbar(fala)).not.toBe(fala);
  });

  it('[Boundary] uma linha só, sem quebra no fim, também é carimbada', () => {
    expect(carimbar('export const x = 1;')).toBe(`${CABECALHO}\nexport const x = 1;`);
  });

  it('[Zero] ficheiro vazio ganha o cabeçalho e nada mais', () => {
    expect(carimbar('')).toBe(`${CABECALHO}\n`);
  });

  it('[Interface] espaço à direita na primeira linha não engana', () => {
    expect(carimbar(`${CABECALHO}   \nexport const x = 1;\n`)).toBe(`${CABECALHO}   \nexport const x = 1;\n`);
  });
});

describe('e o carimbo está LIGADO ao caminho do publish', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

  it('[Right] ⚠️ `build:pkg` chama o carimbo — sem isto ele e um script que ninguem corre', () => {
    expect(pkg.scripts['build:pkg']).toContain('stamp-license.mjs');
  });

  it('[Interface] e o `prepack` chama o `build:pkg`, entao `npm publish` passa por aqui', () => {
    // This chain is what makes it a BUILD guarantee: whoever publishes has no way to skip the stamp, even if they forget
    // to run the build by hand.
    expect(pkg.scripts.prepack).toContain('build:pkg');
  });

  it('[Right] e o pacote continua a DECLARAR a AGPL, que é o que a lei e o npm leem', () => {
    // The per-file header travels with a file copied elsewhere; the field and `LICENSE` are what any tool reads. They are
    // different guarantees and all three have to exist.
    expect(pkg.license).toBe('AGPL-3.0-or-later');
    expect(pkg.files).toContain('LICENSE');
    expect(readFileSync(join(process.cwd(), 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  });
});
