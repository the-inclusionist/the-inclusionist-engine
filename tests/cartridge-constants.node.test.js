// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT `core/constants.ts` EXPORTS AND THE ENGINE DOES NOT USE (issue #63, step B).
//
// ========================= WHAT THIS FILE MEASURES, AND WHY MEASURE AND NOT CUT =========================
// Step B of #63 is «cortar `core/constants.ts` em engine (resolução, grade) e jogo (`TUNE`, `EASY`, `ANIM`,
// `TILE_TYPES`, `COIN_TARGET`)».
//
// ⚠️ AN EXPORT WITH NO IMPORTER INSIDE THE ENGINE IS NOT FREE TO DELETE: a game imports it from the published package
// (`@the-inclusionist/engine/core/constants.js`), and deleting it breaks that consumer and is a semver break of a
// published package — a major, and an edit in two trees in the same step. So each symbol left by MOVING HOUSE into the
// game first, and only then out of the engine.
//
// ⚠️ This file cannot name the game's modules: `engine-boundary` forbids an engine test from saying the game's words.
// Whoever wants the list greps `core/constants.js` in `game-platformer`; what matters here is the REPOSITORY that
// consumes.
//
// So what this file does is what can be done without deciding anything: **keep the number visible and shrinking**. It
// is ADR-0043's pattern — known debt with a ceiling that only goes down —, and the LEDGER below is at the same time the
// gate and the worksheet of step B's cut.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as CONSTANTES from '../app/js/core/constants.js';

const RAIZ = process.cwd();
const CONST_REL = 'app/js/core/constants.ts';

/** All the engine's `.ts` files, with forward slashes — the Windows glob does not forgive the backslash. */
function ficheirosTs(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheirosTs(p, out);
    else if (nome.endsWith('.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const MODULOS = ficheirosTs(join(RAIZ, 'app', 'js'))
  .map((f) => f.slice(RAIZ.replace(/\\/g, '/').length + 1))
  .filter((f) => f !== CONST_REL);

/**
 * How many engine modules import each name.
 *
 * ⚠️ THE PATTERN ACCEPTS `./constants.js` AND `../core/constants.js`: a first version demanded `core/constants.js` and so
 * did not see a `core/` neighbour importing through `./constants.js`, which made names look ownerless — a narrow check
 * INVENTING debt. The `[Zero]` case below exists because of this.
 */
function importadoresPorNome() {
  const conta = new Map(Object.keys(CONSTANTES).map((n) => [n, 0]));
  for (const rel of MODULOS) {
    const txt = readFileSync(join(RAIZ, rel), 'utf8');
    for (const m of txt.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*constants\.js['"]/g)) {
      for (const bruto of m[1].split(',')) {
        const n = bruto.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (conta.has(n)) conta.set(n, conta.get(n) + 1);
      }
    }
  }
  return conta;
}

/**
 * THE LEDGER: what the engine exports and does not use, and who consumes it on the other side of the boundary.
 *
 * Each line is a line of #63's step B. An entry leaves when the symbol MOVES HOUSE (to the cartridge) or when an engine
 * module starts needing it — never by raising the ceiling.
 */
const SO_DO_CARTUCHO = {
  // ⚠️ EMPTY since issue #63's step B. The ledger stays — EMPTY — for the same reason `validate-adr.py`'s `STATUS_DEBT`
  // stayed: **a budget that reaches zero and disappears stops proving it got there**, and the next entry has to be a
  // decision and not an oversight.
  //
  // Who left, and where to:
  //   · `JUMP_BASE`, `ehChave`                        → deleted; zero consumers anywhere
  //   · `TUNE`, `COIN_TARGET`                         → `game-platformer`'s `game/tuning.ts`
  //   · `ehAgua`, `ehEscada`, `ehPortao`, `ehSecreto` → the same game's `game/tile-flags.ts`
  //
  // Every time the GAME was edited FIRST: it consumes the published package, so stopping depending on the exports while
  // the published version still has them is what makes nothing break in the interval.
};

/**
 * 📌 WHAT core/constants PUBLISHES TODAY: the logical resolution and the grid (`LOGICAL_W`, `LOGICAL_H`, `TILE`) — what
 * any 2D pixel game shares. `TILE_TYPES` and the geometry that consulted it went to `game-platformer` (ADR-0228); a game
 * declares its roles through `core/contract` (`roleAt`).
 */

/**
 * A ceiling that only goes down (ADR-0043). It is zero: the ledger is empty.
 *
 * ⚠️ This number is neither a target nor a tolerance: it is the most the cartridge-only surface may become again. It goes
 * down when a symbol moves house, and the equality assertion below keeps it from sitting above what is measured — slack
 * above is where the next debt fits without anything failing.
 */
const TETO = 0;

describe('core/constants: o que a engine exporta e só o cartucho usa (#63 etapa B)', () => {
  const conta = importadoresPorNome();
  const semDono = [...conta.entries()].filter(([, n]) => n === 0).map(([nome]) => nome).sort();

  it('[Zero] o crivo de imports está mesmo a ver imports — senão TUDO pareceria sem dono', () => {
    // ⚠️ This file fails by the check matching zero and the ledger looking complete. These pairs are known imports:
    // `LOGICAL_W` through `../core/constants.js`, and `TILE`, which `render/high-contrast` imports the same long way.
    // 📌 The `./constants.js` short form has no pair in this tree today — no `core/` module imports its neighbour. If one
    // does again, the pattern already accepts it.
    expect(conta.get('LOGICAL_W'), 'ninguém importa LOGICAL_W? o crivo partiu-se').toBeGreaterThanOrEqual(4);
    expect(conta.get('TILE'), 'ninguém importa TILE? o crivo partiu-se').toBeGreaterThanOrEqual(1);
    // ⚠️ THESE FLOORS DO NOT MEASURE DEBT — they measure that the `import` resolved, which is why they are the only numbers
    // of this file that may GO DOWN with the cut (they did, as modules moved out). A broken import returns ZERO, and that
    // is what they catch. What really guards are the assertions that pin CONCRETE names — an empty module or a narrow
    // check fails on them first.
    //
    // 📏 The module exports three values: `LOGICAL_W`, `LOGICAL_H` and `TILE`.
    expect(Object.keys(CONSTANTES).length, 'o módulo deixou de exportar valores').toBeGreaterThanOrEqual(3);
  });

  it('⚠️ [Right] o livro está completo — nenhum export NOVO fica sem dono em silêncio', () => {
    // A new export the engine does not use is a cartridge piece being born inside the engine. It must be written in the
    // ledger, with the name of whoever consumes it, and not simply appear.
    const naoListados = semDono.filter((n) => !(n in SO_DO_CARTUCHO));
    expect(naoListados, 'export sem importador na engine e fora do livro: ' + naoListados.join(', ')).toEqual([]);
  });

  it('[Interface] e o livro não tem entradas mortas — quem ganhou dono na engine sai dele', () => {
    // The other half, and without it the ledger would grow forever: a line that no longer describes the tree is ghost
    // debt, and ghost debt makes the ceiling look tight when it is not.
    const fantasmas = Object.keys(SO_DO_CARTUCHO).filter((n) => !semDono.includes(n));
    expect(fantasmas, 'no livro mas já com dono na engine (ou já apagado): ' + fantasmas.join(', ')).toEqual([]);
  });

  it('⚠️ [Boundary] o tecto SÓ DESCE — oito é o máximo, nunca o alvo', () => {
    expect(semDono.length, `a superfície só-do-cartucho cresceu para ${semDono.length}: ` + semDono.join(', '))
      .toBeLessThanOrEqual(TETO);
    // And the ceiling follows reality: leaving it above what is measured would hide slack where new debt fits without
    // anything failing. When the ledger shrinks, this line is the one that forces the number down.
    expect(TETO, 'o tecto ficou acima do medido — há folga escondida').toBe(semDono.length);
  });
});

// ========================= MUTATIONS CHECKED =========================
// Checked while the ledger still had entries:
//   · putting `export const NOVA_COISA = 1;` in `core/constants.ts` (no importer) → the [Right] ledger-is-complete case
//     fails naming `NOVA_COISA`, and the [Boundary] ceiling case fails on both assertions.
//   · removing an entry from the `SO_DO_CARTUCHO` ledger → [Right] fails. It is the case that keeps someone from emptying
//     the ledger instead of emptying the debt.
//   · putting `LOGICAL_W` in the ledger (a ghost entry, which has an owner) → [Interface] fails naming it.
//   · narrowing the check's pattern to `core\/constants\.js` — the first version, and the real defect made while
//     measuring → THREE cases fail: [Zero], [Right] accusing the neighbour-imported names of being outside the ledger,
//     and [Boundary].
//     ⚠️ Without the `[Zero]`, this mutation would have INVENTED debts and the ledger would have grown to hold them — a
//     gate manufacturing the problem it exists to measure.
