// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE RENAME MAP, AND THE RULE THAT STOPS IT FROM SPOILING PROSE (ADR-0219; issue #202).
//
// The public surface moves to English in a single breaking release, and what renames is a FILE — the map —, because the
// migration table is printed from it: a name cannot be renamed without being written down. What this sieve measures is
// what a big suite would not see in a 93-file commit.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { renameInText, readMap } from '../scripts/apply-rename.mjs';

const RAIZ = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();

describe('o mapa é declaração, não adivinhação', () => {
  /*
   * ⚠️ ONLY THE LAYERS NOT YET APPLIED, and the reason is mechanical: after a layer runs, the NEW name exists in the tree on
   * purpose, and a collision check that did not know it would accuse yesterday's own work. Each layer's `done` field is
   * what separates «ainda vai renomear» from «já renomeou» — and that is why it is data in the map and not memory.
   */
  it('🔴 [Right] todo nome novo é inglês, e nenhum choca com um nome que já existe', () => {
    const mapa = readMap();
    const porAplicar = Object.values(mapa.layers).filter((l) => !l.done);
    const pares = porAplicar.flatMap((l) => Object.entries(l.names));
    const aplicadas = Object.values(mapa.layers).filter((l) => l.done);
    expect(pares.length + aplicadas.length, 'o mapa está vazio').toBeGreaterThan(0);

    const retrato = JSON.parse(readFileSync(join(RAIZ, 'docs/6-DevOps-SRE/public-surface.json'), 'utf8'));
    const existentes = new Set(Object.values(retrato).flat());
    const { pt } = (() => {
      const l = JSON.parse(readFileSync(join(RAIZ, 'scripts/word-lists.json'), 'utf8'));
      return { pt: new Set(l.portuguese) };
    })();
    const palavras = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

    const aindaPortugues = pares.filter(([, novo]) => palavras(novo).some((w) => pt.has(w)));
    expect(aindaPortugues, 'um nome «novo» que continua português renomeia para o mesmo problema').toEqual([]);
    // 🔴 A COLLISION is the silent way to spoil this: two modules publishing the same name, and `tsc` only complains where
    // the two meet — which may be in no file at all.
    const colisoes = pares.filter(([velho, novo]) => existentes.has(novo) && novo !== velho);
    expect(colisoes, 'o nome novo já é de outra coisa').toEqual([]);
    const destinos = pares.map(([, novo]) => novo);
    expect(new Set(destinos).size, 'dois nomes velhos apontam para o mesmo nome novo').toBe(destinos.length);
  });
});

/*
 * ========================= PHASE 3: THE FILE NAME IS SURFACE TOO =========================
 * A game writes `from '@the-inclusionist/engine/core/anel.js'`, so a PATH is as much a contract as a name. What changes
 * from phase 2 is what can be measured: a name lives in the surface snapshot, but a file lives on DISK — so these cases
 * ask the file system, which is the only witness that does not repeat what the map says.
 */
/*
 * 🔴 WHAT WAS RENAMED AND THEN CHANGED REPOSITORY. The phase-3 map records «X passou a Y», and for seven files the Y no
 * longer exists here — not because the rename failed, but because ADR-0228 took out of the engine the modules that
 * describe one game, and these went with them to `game-platformer`.
 *
 * 📌 DECLARED WITH THE REASON, not deleted from the map: the map is the record of a migration that happened, and
 * rewriting it would make phase 3 look smaller than it was. It is the same choice the book of dead pointers makes, for
 * the same reason — «X virou Y» is data ABOUT paths, and a book that lets itself be rewritten stops being a book.
 *
 * ⚠️ And the OLD half of the pair is still required: the file with the old name cannot be back here. Only the NEW one's
 * existence is excused, and only for these seven.
 */
const SAIRAM = {
  'app/js/render/scenery-data.ts': 'ADR-0228: os cenários são de um jogo',
  'app/js/render/set-scenery.ts': 'ADR-0228: idem — quem escolhe o cenário é o cartucho',
  'tests/scenery-data.node.test.js': 'ADR-0228: foi com o módulo',
  'tests/set-scenery.node.test.js': 'ADR-0228: foi com o módulo',
  'tests/cloud-blanket.node.test.js': 'ADR-0228: nuvens são cenário — foi com `render/scene-sky`',
  'tests/scene-parallax-buildings.node.test.js': 'ADR-0228: foi com `render/scene-parallax`',
  'tests/scene-parallax-silhouettes.node.test.js': 'ADR-0228: foi com `render/scene-parallax`',
};

describe('o mapa dos FICHEIROS diz a verdade sobre o disco', () => {
  const fileLayers = () => Object.entries(readMap().fileLayers ?? {});

  it('🔴 [Right] o que uma camada aplicada moveu ESTÁ movido: o novo existe, o velho não', () => {
    const feitas = fileLayers().filter(([, l]) => l.done);
    expect(feitas.length, 'nenhuma camada de ficheiros foi aplicada ainda — este caso não mede nada').toBeGreaterThan(0);
    const errados = [];
    for (const [camada, l] of feitas) {
      for (const [velho, novo] of Object.entries(l.files)) {
        if (existsSync(join(RAIZ, velho))) errados.push(`${camada}: ${velho} continua lá`);
        if (!existsSync(join(RAIZ, novo)) && !(novo in SAIRAM)) errados.push(`${camada}: ${novo} não existe`);
      }
    }
    expect(errados, 'o mapa diz que moveu e o disco diz que não').toEqual([]);
  });

  it('⚠️ [Zero] uma entrada de `SAIRAM` que VOLTOU reprova — senão a lista de excepções vira coringa', () => {
    /*
     * 🔴 A list of exceptions that outlives the fact that justified it is worse than having none: it authorises for
     * free. This case is the pair of the one above, and it keeps the exemption tied to reality — if one of these seven
     * comes back to the tree, the line excusing it has to leave with it.
     */
    const voltaram = Object.keys(SAIRAM).filter((p) => existsSync(join(RAIZ, p)));
    expect(voltaram, 'está de volta na árvore e continua declarado como tendo saído').toEqual([]);
  });

  it('🔴 [Right] o caminho novo é inglês, e nenhum ficheiro velho aponta para dois sítios', () => {
    const todas = fileLayers().flatMap(([, l]) => Object.entries(l.files));
    const pt = new Set(JSON.parse(readFileSync(join(RAIZ, 'scripts/word-lists.json'), 'utf8')).portuguese);
    // A file name splits the way an identifier does: by `-`, `.` and `_`, and what is left is words.
    const palavras = (p) => p.split('/').pop().replace(/\.[a-z.]+$/i, '').split(/[-._]/).map((w) => w.toLowerCase());
    const aindaPortugues = todas.filter(([, novo]) => palavras(novo).some((w) => pt.has(w)));
    expect(aindaPortugues, 'um caminho «novo» que continua português move para o mesmo problema').toEqual([]);
    const destinos = todas.map(([, novo]) => novo);
    expect(new Set(destinos).size, 'dois ficheiros velhos apontam para o mesmo ficheiro novo').toBe(destinos.length);
  });

  it('🎯 [Zero] e NINGUÉM na árvore ainda importa um caminho que já não existe', () => {
    /*
     * ⚠️ THIS IS THE CASE `tsc` DOES NOT DO, and that is why it is here: an `import` of a file that vanished is a type error,
     * yes — but a path written in a STRING (a sieve naming the module it guards, a ledger keyed by path, a `.md`) is read
     * by no compiler. That is how the debt inventory kept talking about `core/anel.ts` after `core/anel.ts` no longer existed.
     */
    const movidos = fileLayers().filter(([, l]) => l.done).flatMap(([, l]) => Object.keys(l.files));
    expect(movidos.length, 'nada movido — este caso não mede nada').toBeGreaterThan(0);
    // The two forms of each moved path (`.ts` on disk, `.js` in an import), in one alternation. The `Set` keeps one entry
    // per distinct FORM found in the file, not per occurrence.
    const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const FORMAS_MOVIDAS = new RegExp(
      [...new Set(movidos.flatMap((v) => [v, v.replace(/\.ts$/, '.js')]))].map(escapar).join('|'), 'g');
    const rastreados = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' }).trim().split(/\r?\n/);
    const sobras = [];
    for (const f of rastreados) {
      if (f === 'scripts/rename-map.json' || f === 'scripts/apply-file-rename.mjs') continue; // they CITE the old ones on purpose
      if (f === 'docs/6-DevOps-SRE/Breaking-Changes.md' || f === 'CHANGELOG.md') continue;    // the migration table lives in them
      if (f === 'tests/rename-map.node.test.js') continue;                                     // and this file cites them too
      if (f === 'tests/records-pointing-at-dead-gates.node.test.js') continue;
      const texto = readFileSync(join(RAIZ, f), 'utf8');
      // ⚠️ ONE PASS PER FILE, not one per moved path: an `includes` for each of the ~320 forms inside the loop over the
      // ~1050 tracked files — ~335 thousand scans of the whole text — blew the 5 s ceiling in about one run in five under
      // the suite's load. A red that comes from the machine and not from the code invalidates whatever is being measured
      // beside it; the fix is the work shrinking, never the clock growing.
      for (const forma of new Set([...texto.matchAll(FORMAS_MOVIDAS)].map((m) => m[0]))) sobras.push(`${f} → ${forma}`);
    }
    expect(sobras, 'alguém ainda escreve um caminho que foi movido').toEqual([]);
  });
});

describe('a renomeação não estraga prosa', () => {
  const nomes = { LINHAS: 'ROWS', modoCego: 'blindMode' };

  it('🔴 [Right] em código renomeia tudo — inclusive dentro de cadeias, porque um nome de evento É a superfície', () => {
    const antes = "import { LINHAS } from './x.js';\nstate.on('modoCego', () => LINHAS);\n";
    expect(renameInText(antes, nomes).text)
      .toBe("import { ROWS } from './x.js';\nstate.on('blindMode', () => ROWS);\n");
  });

  /*
   * 🔴 THIS IS THE CASE THAT MADE THE RULE EXIST. 📏 Measured before renaming a single line: `LINHAS` is the number of rows
   * of the flash grid AND the Portuguese word in seventeen prose comments of this repository. A whole-word substitution
   * would leave «🎯 TRÊS ROWS, UM PAINEL» — prose spoiled inside a commit too big for anyone to see it.
   */
  it('🔴 [Zero] num comentário, a PALAVRA fica e o identificador entre crases muda', () => {
    const antes = '// 🎯 TRÊS LINHAS, UM PAINEL: o `LINHAS` da grelha é outra coisa\nconst n = LINHAS;\n';
    const depois = renameInText(antes, nomes).text;
    expect(depois, 'a prosa do comentário foi reescrita').toContain('TRÊS LINHAS, UM PAINEL');
    expect(depois, 'o identificador citado entre crases ficou com o nome velho').toContain('`ROWS`');
    expect(depois, 'o código não foi renomeado').toContain('const n = ROWS;');
  });

  it('⚠️ [Boundary] num `.md` é o contrário: tudo é prosa menos o que está entre crases', () => {
    const antes = 'As LINHAS do rodapé mudaram, e `LINHAS` passou a ser lido do catálogo.\n';
    expect(renameInText(antes, nomes, { prose: true }).text)
      .toBe('As LINHAS do rodapé mudaram, e `ROWS` passou a ser lido do catálogo.\n');
  });

  it('🎯 [Zero] palavra INTEIRA: um nome que contém outro não é partido ao meio', () => {
    const antes = 'const LINHAS_DO_RODAPE = 2; const x = modoCegoDica; const y = LINHAS;\n';
    expect(renameInText(antes, nomes).text)
      .toBe('const LINHAS_DO_RODAPE = 2; const x = modoCegoDica; const y = ROWS;\n');
  });

  /*
   * 🔴 THE CASE THAT WAS MISSING, and it cost a DATA value already committed: `'dentro-da-zona'` — the reason the adaptive
   * engine gives for keeping the level — came out as `'isInside-da-zona'`, half in English, in a string no migration table
   * mentions and that a game may have stored. The rule then said «cadeia sem espaços é um nome»; the right rule is
   * narrower: a string is renamed when it IS the name, whole. That is what tells an event's name («modoCego», which the
   * surface publishes) from a piece of a compound value.
   */
  it('🔴 [Zero] numa cadeia só se renomeia o nome INTEIRO — um valor composto é dado, não nome', () => {
    const nomes = { dentro: 'isInside', modoCego: 'blindMode' };
    expect(renameInText("const m = 'dentro-da-zona';", nomes).text,
      'um pedaço de um valor composto foi renomeado').toBe("const m = 'dentro-da-zona';");
    expect(renameInText("state.on('modoCego', f);", nomes).text,
      'o nome de um evento É a superfície pública, e ficou por renomear').toBe("state.on('blindMode', f);");
    expect(renameInText('if (dentro(f)) return;', nomes).text).toBe('if (isInside(f)) return;');
  });

  it('📌 [Interface] e a conta do que mudou é por nome — é ela que diz se um nome do mapa não existe na árvore', () => {
    const { counted } = renameInText('LINHAS + LINHAS + modoCego', nomes);
    expect(counted).toEqual({ LINHAS: 2, modoCego: 1 });
  });
});

/*
 * ========================= MUTATIONS CHECKED =========================
 * The PHASE 2 ones are written in the messages of the eight layer commits, where they were born; the PHASE 3 ones are
 * here (2026-09-22).
 *
 * PHASE 3 — the three cases of FILE names:
 *   1. the map says it moved and the disk disagrees (`ring.ts` given back to `anel.ts`) ......... 2 REDS (the disk one and the leftovers one)
 *   2. a «new» path that is still Portuguese (`anel-novo.ts`) ........................ 3 REDS
 *   3. an obsolete reference left written in a tracked file ................... 1 RED, and it is ONLY the leftovers case
 *      — it is the mutation that matters most, because it is the only one `tsc` would never see: a path inside a STRING (a
 *        sieve naming the module it guards, a ledger keyed by path, a `.md`) is read by no compiler.
 *   4. two old files pointing at the same new file ...................... 3 REDS
 *
 * 🔴 AND THE MUTATION SCRIPT ITSELF DAMAGED THE TREE on the first round: the «undo» deleted the restored file without asking
 * whether it existed, and with mutation 1 applied (the new one no longer exists) it deleted it for good. Restored by hand,
 * and the guard went into the script. A mutation tool with no net is worse than no mutation at all — it measures and
 * destroys in the same pass.
 */
