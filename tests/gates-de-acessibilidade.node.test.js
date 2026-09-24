// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CRITERIA INDEX POINTS AT GATES THAT EXIST (issue #13).
//
// ========================= WHAT THIS FILE PREVENTS =========================
// `docs/compliance/gates-de-acessibilidade.md` says which WCAG criteria this repository measures and which it only
// cites. It is the automatable half of #13 and raw material for the annual report (ADR-0053).
//
// ⚠️ AND IT IS EXACTLY THE KIND OF DOCUMENT THAT ROTS FIRST: it names test files, and a test file that is renamed or
// disappears leaves the row claiming coverage that no longer exists. In a compliance index that silence is worse,
// because someone will read it to answer an audit.
//
// ⚠️ WHAT IT DOES NOT MEASURE: whether the gate pointed at REALLY measures that criterion. That is not decidable by
// machine — which is why the document separates «aferido» from «citado» instead of giving a single conformance number.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every `app/js` module, for a question about the TREE and not about a named file. */
function todosOsModulos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) todosOsModulos(p, out);
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

const RAIZ = process.cwd();
const DOC = readFileSync(join(RAIZ, 'docs', 'compliance', 'gates-de-acessibilidade.md'), 'utf8');

/** A repository path quoted between backticks. */
const RE_CAMINHO = /`((?:app|tests|scripts|docs|\.github)\/[A-Za-z0-9_\-./]+\.[a-z]+)`/g;
const caminhos = [...new Set([...DOC.matchAll(RE_CAMINHO)].map((m) => m[1]))];

/** As linhas de tabela: `| **N.N.N** … |`. */
const linhasDeCriterio = DOC.split(/\r?\n/).filter((l) => /^\|\s*\*\*\d\.\d+\.\d+\*\*/.test(l));

describe('o índice de critérios de acessibilidade (#13)', () => {
  it('[Zero] o crivo está mesmo a ler o documento', () => {
    expect(DOC.length).toBeGreaterThan(2000);
    expect(caminhos.length, 'nenhum caminho citado').toBeGreaterThanOrEqual(12);
    expect(linhasDeCriterio.length, 'nenhuma linha de critério').toBeGreaterThanOrEqual(12);
  });

  it('⚠️ [Right] todo ficheiro citado EXISTE', () => {
    const mortos = caminhos.filter((c) => !existsSync(join(RAIZ, c)));
    expect(mortos, 'o índice aponta para ficheiro inexistente:\n  ' + mortos.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] toda linha da tabela de AFERIDOS nomeia pelo menos um ficheiro de `tests/`', () => {
    // The distinction that gives the document its meaning: a criterion in the measured table with no case pointing at it
    // is a citation passing for a gate — precisely what the table below exists to separate.
    const corte = DOC.indexOf('## ⚠️ Citados e NÃO aferidos');
    expect(corte, 'a secção dos buracos desapareceu do documento').toBeGreaterThan(0);
    const aferidos = DOC.slice(0, corte).split(/\r?\n/).filter((l) => /^\|\s*\*\*\d\.\d+\.\d+\*\*/.test(l));
    /*
     * 🔴 2.2.2 and 2.4.1 are in the table of HOLES, not the measured one: the cases that proved them left the repository
     * with ADR-0228 (the weather gate and the layer-order gates). That is where a criterion with no case HERE belongs.
     *
     * 📌 The floor exists to catch the document COLLAPSING (a scan that stops matching returns zero and nothing fails), not
     * to pin how many criteria are proven. So it follows the table.
     */
    expect(aferidos.length).toBeGreaterThanOrEqual(8);
    const fracas = aferidos.filter((l) => !/`tests\/[^`]+\.test\.js`/.test(l)).map((l) => l.slice(0, 60));
    expect(fracas, 'critério na tabela de AFERIDOS sem caso em tests/:\n  ' + fracas.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Interface] o buraco do 2.3.1 continua nomeado enquanto o `FLASH_LIMIT` não existir', () => {
    /*
     * 🔴 NO MODULE OF THE ENGINE DECLARES A `FLASH_LIMIT` pass: the layer order that gave it an address left with ADR-0228
     * (a z-order is a game's layer order), and with it the only place in the engine where the flash limiter had a marked
     * home. And this is SAFETY about photosensitive epilepsy, not comfort.
     *
     * 🎯 So the case measures the absence: while NO module of this tree declares `FLASH_LIMIT`, 2.3.1 must stay named as a
     * hole. The day the engine declares it again — the next boundary — this case fails and forces the row to be reviewed.
     */
    /*
     * ⚠️ DECLARATION, NOT MENTION: `core/flash-threshold` NAMES `FLASH_LIMIT` in a comment — «ADR-0020 names a FLASH_LIMIT
     * pass and the engine limits nothing a cartridge flashes: it does not own the render» — which is precisely a sentence
     * about what the engine does NOT have. Searching the text would make the case fail over the sentence that proves it.
     */
    const DECLARA = /(?:const|let|var|export\s+const)\s+FLASH_LIMIT\b|\bFLASH_LIMIT\s*:/;
    const declarado = todosOsModulos(join(RAIZ, 'app', 'js')).some((f) => DECLARA.test(readFileSync(f, 'utf8')));
    expect(declarado, 'a engine voltou a declarar o FLASH_LIMIT — reveja a linha do 2.3.1 neste índice').toBe(false);
    expect(DOC, 'o buraco do 2.3.1 saiu do índice sem o limitador ter sido escrito').toContain('2.3.1');
    expect(DOC, 'o índice deixou de dizer que a própria DECLARAÇÃO do limitador saiu').toContain('ADR-0228');
  });

  it('[Error] o crivo APANHA um caminho inventado — senão os casos acima não provam nada', () => {
    const falso = '`tests/nao-existe.node.test.js`';
    const achado = [...falso.matchAll(RE_CAMINHO)].map((m) => m[1]);
    expect(achado).toEqual(['tests/nao-existe.node.test.js']);
    expect(existsSync(join(RAIZ, achado[0]))).toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · replacing `tests/weather.node.test.js` with `tests/weather-x.node.test.js` in the document → the [Right] case of
//     every cited file EXISTING fails, naming it.
//   · removing the `tests/` file from the 1.3.1 row (leaving only the promise) → the [Right] case of every MEASURED row
//     fails, the case that keeps a citation from passing for a gate.
//   · deleting from `core/layers.ts` the sentence «FLASH_LIMIT ainda NÃO está implementado» → the [Interface] case of
//     the 2.3.1 hole fails with the message telling to move the criterion to the table above. ⚠️ It is the mutation that
//     makes this file useful the day the debt is paid, instead of it describing a past. (Measured against the earlier
//     form of the case, which read `core/layers.ts`; the module has since left, ADR-0228.)
//   · replacing `RE_CAMINHO` with one that matches nothing → [Zero] and [Error] fail. Without [Zero], a broken check
//     would leave the [Right] case of every cited file green over an empty set.
