// SPDX-License-Identifier: AGPL-3.0-or-later
// A NEW EXPORT SAYS WHO NEEDS IT (issue #164, ADR-0170 §3).
//
// 📏 Measured on 2026-09-13 with `node scripts/exports-without-consumer.mjs --catalogue ..`: of the exported values, 43
// are imported by no engine module, test or script and by no sibling game repository — and `numerarItens` had been one
// of them until its removal cost a `BREAKING CHANGE` that broke nobody. 48 more are imported only by a cartridge.
//
// 📌 CI has no sibling repositories, so the catalogue half is measured locally and written to
// `docs/6-DevOps-SRE/exports-without-consumer.json`; this gate holds the list against the tree. Types are out of scope
// (see the script).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { semImportadorNoRepositorio, importacoesDoTexto, LISTA_DE_CONSUMIDORES } from '../scripts/exports-without-consumer.mjs';

const RAIZ = process.cwd();
const LISTA = JSON.parse(readFileSync(join(RAIZ, LISTA_DE_CONSUMIDORES), 'utf8'));
const semImportador = new Set(Object.entries(semImportadorNoRepositorio(RAIZ)).flatMap(([m, ns]) => ns.map((n) => `${m} ${n}`)));
const divida = new Set(Object.entries(LISTA.debt).flatMap(([m, ns]) => ns.map((n) => `${m} ${n}`)));
const doCartucho = LISTA.cartridgeConsumers;

describe('exports without a consumer (issue #164, ADR-0170 §3)', () => {
  it('🎯 [Zero] the scanner sees imports of every form, or every export would look unused', () => {
    const r = (e) => (e === './m.js' ? 'm.ts' : null);
    const achados = importacoesDoTexto([
      "import { a, type B, c as d } from './m.js';",
      "export { e } from './m.js';",
      "const { f } = await import('./m.js');",
      "import * as ns from './m.js'; ns.g();",
      "const mod = await import('./m.js'); mod.h;",
      "import { z } from './outro.js';",
    ].join('\n'), r);
    expect(achados.sort()).toEqual(['m.ts B', 'm.ts a', 'm.ts c', 'm.ts e', 'm.ts f', 'm.ts g', 'm.ts h']);
    expect(semImportador.has('boot/create-game.ts createGame'), 'createGame is imported by tests; the scan is blind').toBe(false);
  });

  it('🔴 [Right] every export nothing here imports is either the debt or names the cartridge that imports it', () => {
    const semDono = [...semImportador].filter((k) => !divida.has(k) && !(k in doCartucho));
    expect(semDono, 'a new export with no consumer: import it, make it internal, or name its cartridge in ' +
      `${LISTA_DE_CONSUMIDORES} (cartridgeConsumers) — measured with \`node scripts/exports-without-consumer.mjs --catalogue ..\``).toEqual([]);
  });

  it('🎯 [Zero] the debt only shrinks — a name that gained an importer or left the package leaves the list', () => {
    expect(divida.size, 'the debt is empty; was the list rewritten without the catalogue?').toBeGreaterThan(0);
    expect([...divida].filter((k) => !semImportador.has(k)), 'paid debt still listed').toEqual([]);
  });

  it('🔴 [Right] a cartridge consumer names a repository and a file', () => {
    const malformados = Object.entries(doCartucho).filter(([, onde]) => !/^[\w.-]+ \S+\.(ts|tsx|js|mjs)$/.test(onde)).map(([k]) => k);
    expect(malformados).toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 a new exported function nothing imports              🔴 [Right] no consumer
//   E2 namespace imports no longer read by the scanner      🔴 [Zero] scanner
//   E3 types no longer left out                             🔴 [Right] no consumer
//   E4 the debt emptied                                     🔴 [Zero] shrinks
//   E5 a debt name gains an importer, list untouched        🔴 [Zero] shrinks
//   E6 a cartridge consumer without its file                🔴 [Right] names a repository
