// SPDX-License-Identifier: AGPL-3.0-or-later
// A NEW EXPORT SAYS WHO NEEDS IT — AND «WHO» MEANS SOMEONE IN THIS REPOSITORY (issue #164, ADR-0170 §3).
//
// 🔴 THE GATE STOPPED ASKING THE GAMES ON 2026-09-22, by the Dev's correction: «ESQUEÇA QUE VOCÊ VÊ CONSUMIDORES!
// NENHUMA ENGINE É FEITA COM REPOSITÓRIOS DE CONSUMIDORES VISÍVEIS!» A published name that nothing inside the engine
// imports is DEBT, declared or deleted; whoever consumes adapts to the new version.
//
// 📏 What that cost while it lasted, measured rather than remembered: 50 names were excused because one sibling game
// imported them, the ledger could not be regenerated while any of those repositories lagged, and it was edited BY HAND
// three times in two days (issue #205). And the 50 were not the intended API — they were reach: `platform/audio.
// _footCount`, `core/collision.isWcRampRiser`, `render/recycling-tex.BIN_H`.
//
// 📌 The whole measurement now runs in CI, because it needs nothing outside this tree. Types stay out of scope (see the
// script). The debt is the ONE list, and it only shrinks.
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

  it('🔴 [Right] every export nothing here imports is in the debt — there is no other excuse', () => {
    const semDono = [...semImportador].filter((k) => !divida.has(k));
    expect(semDono, 'a new export with no consumer IN THIS REPOSITORY: import it, make it internal, or delete it. '
      + `Declaring it in ${LISTA_DE_CONSUMIDORES} is the last resort and says the name waits for a consumer — `
      + 'regenerate with `node scripts/exports-without-consumer.mjs`').toEqual([]);
  });

  it('🎯 [Zero] the debt only shrinks — a name that gained an importer or left the package leaves the list', () => {
    expect(divida.size, 'the debt is empty; was the list rewritten over a broken measurement?').toBeGreaterThan(0);
    expect([...divida].filter((k) => !semImportador.has(k)), 'paid debt still listed').toEqual([]);
  });

  it('🔴 [Zero] the ledger has no memory of the games — a repository we cannot see cannot excuse a name', () => {
    // The Dev's correction of 22/09, held and not just written: while the key exists, a name can again be excused by a
    // repository this tree does not control — and the ledger again cannot be regenerated when that repository lags.
    // The check asserts ABSENCE, which is the form the plan requires for a decision of this kind.
    expect(LISTA.cartridgeConsumers, 'a chave `cartridgeConsumers` voltou ao livro').toBeUndefined();
    const fonte = readFileSync(join(RAIZ, 'scripts/exports-without-consumer.mjs'), 'utf8');
    expect(/--catalogue/.test(fonte), 'a bandeira `--catalogue` voltou ao script').toBe(false);
    expect(/importadoresNoCatalogo/.test(fonte), 'o leitor dos repositórios irmãos voltou').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 a new exported function nothing imports              🔴 [Right] no consumer
//   E2 namespace imports no longer read by the scanner      🔴 [Zero] scanner
//   E3 types no longer left out                             🔴 [Right] no consumer
//   E4 the debt emptied                                     🔴 [Zero] shrinks
//   E5 a debt name gains an importer, list untouched        🔴 [Zero] shrinks
//   E6 `cartridgeConsumers` back in the ledger              🔴 [Zero] no memory of the games   (22/09)
//   E7 `--catalogue` back in the script                     🔴 [Zero] no memory of the games   (22/09)
//   E8 `export { edgeAllowed } from` back in input/keydown  🔴 [Right] no consumer             (#204: re-exports weighed)
//   E9 `export type { ScreenGrid } from` back in ui/hud     🔴 [Right] no consumer             (#204: a re-exported type is
//      debt too — the name still lives at its origin, so the reason types are left out does not reach it)
