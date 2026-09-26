// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MAP TELLS THE TRUTH — the two sieves of `docs/ARCHITECTURE.md`, and only those two.
//
// ========================= WHY TWO, AND NOT A GENERATOR =========================
// `CLAUDE.md` says to read this document in ANY prompt, and 📏 measured on 2026-09-22 it named 81 of the 181 modules, cited
// a `webcam` deleted six days earlier and a `game/` folder that does not exist. The obvious cure — generate the table
// from the tree and require it to match — was weighed and refused: 📏 205 modules were born or died in 30 days, in 156 of
// 1056 commits, so one commit in seven would wake the sieve to ask for a regeneration. Worse than the cost: a sieve
// satisfied by running a script teaches regenerating without reading, and what it guarantees is EXACTNESS, not usefulness.
//
// 🎯 SO WHAT IS CHECKED ARE THE CLAIMS THE MAP MAKES, and it no longer claims to be an inventory:
//
//   1. every path the document names EXISTS — it catches exactly the `webcam`, the `cenario-data` and the
//      `settings-motor` that were dead there, and catches it the day the file moves;
//   2. every folder of `app/js` has a row in the layers table — it catches `boot/`, `i18n/` and `consumer-quiz/`, which
//      had none, and `game/`, which had a row and no folder.
//
// 📏 Both are STABLE: they do not wake when a module is born (the cost that was refused), they wake when a LAYER is born —
// three times in the project's whole life — or when someone deletes a file the map cites, which is when waking is wanted.
//
// MUTATIONS CHECKED at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
const MAPA = 'docs/ARCHITECTURE.md';
const texto = readFileSync(join(RAIZ, MAPA), 'utf8');

/*
 * A path the map NAMES: inside backticks, with a folder and an extension. Backticks are the criterion because that is how
 * this house writes an identifier or a file in a document — and without them the sieve would read prose («o `game/` que
 * não existe») as a promise. ⚠️ A folder (`core/`) is not a path: it is checked by the second case, which knows the
 * difference.
 */
const CAMINHOS = /`([A-Za-z0-9_@./-]+\/[A-Za-z0-9_.@-]+\.[a-z0-9]{1,5})`/g;

/**
 * The paths a text NAMES.
 *
 * ⚠️ It is a function and not a loose expression inside the case, and the reason was measured: with the backtick rule
 * buried in the case, the mutation removing it stayed GREEN — today's document happens to have no non-existent path
 * without backticks in its prose. A rule no case can turn red is a rule nobody defends the day someone deletes it.
 */
export const caminhosCitados = (t) => [...new Set([...t.matchAll(CAMINHOS)].map((m) => m[1]))];

describe('o mapa não nomeia o que não existe', () => {
  it('🔴 [Right] todo ficheiro que o `ARCHITECTURE.md` cita está na árvore', () => {
    const citados = caminhosCitados(texto);
    expect(citados.length, 'o mapa não cita caminho nenhum — o crivo não está a medir nada').toBeGreaterThan(15);
    /*
     * ⚠️ WHAT IS LEFT OUT, and each line has a reason that is not convenience:
     *   · `node_modules/**` and package addresses (`@the-inclusionist/engine/…`) are not files of this tree;
     *   · the records tree (`docs/2-Architecture/adr/…`) is here again since ADR-0242, and is checked like any path;
     *   · `app/js/game/**` is NOT here on purpose: that folder left with the cartridge, and that is precisely what the
     *     sieve caught.
     */
    const foraDaArvore = (c) => c.startsWith('@') || c.startsWith('node_modules/') || c.includes('://');
    /*
     * ⚠️ THE MAP WRITES A PATH RELATIVE TO THE SECTION IT IS IN, and that is the document's convention and not sloppiness:
     * the code section says `ui/pause-icons.ts` and the docs one says `1-Discovery/NFR.md`, because repeating `app/js/` and
     * `docs/` in every cell of a table costs the reader and gives them nothing. The sieve learns the convention instead of
     * forbidding it — what it guards is that the file EXISTS, not where the sentence anchors it.
     */
    const RAIZES = ['', 'app/js/', 'docs/', 'app/'];
    const mortos = citados.filter((c) => !foraDaArvore(c) && !RAIZES.some((r) => existsSync(join(RAIZ, r + c))));
    expect(mortos, `o mapa nomeia ficheiros que já não existem — quem o lê vai procurá-los. Em ${MAPA}`).toEqual([]);
  });
});

describe('o mapa não esconde uma camada', () => {
  it('🔴 [Right] toda pasta de `app/js` tem linha na tabela de camadas', () => {
    const pastas = readdirSync(join(RAIZ, 'app/js'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
    expect(pastas.length, 'não há pastas em app/js — o crivo não está a medir nada').toBeGreaterThan(5);
    // A layer's row opens with the folder's name in backticks, with the slash: `| `core/` | … |`
    const semLinha = pastas.filter((p) => !texto.includes(`| \`${p}/\` |`));
    expect(semLinha, 'uma camada existe na árvore e não existe no mapa — quem lê o mapa não sabe que ela existe').toEqual([]);
  });

  it('🔴 [Zero] e nenhuma linha de camada fala de uma pasta que não existe', () => {
    /*
     * ⚠️ ONLY THE LAYERS TABLE, and the first run showed why: section 2 has a table with the SAME row shape for the DOCS'
     * folders (`game-design/`, `research/`), which are not code layers and do not exist in `app/js`. A sieve reading the
     * whole document would accuse two correct rows and teach people to switch it off.
     */
    const seccao = texto.slice(texto.indexOf('### 3.1'), texto.indexOf('### 3.2'));
    expect(seccao.length, 'a secção 3.1 não foi encontrada').toBeGreaterThan(200);
    const naTabela = [...seccao.matchAll(/^\| `([a-z-]+)\/` \|/gm)].map((m) => m[1]);
    expect(naTabela.length, 'a tabela de camadas não foi encontrada').toBeGreaterThan(5);
    const fantasmas = naTabela.filter((p) => !existsSync(join(RAIZ, 'app/js', p)));
    expect(fantasmas, 'o mapa tem linha para uma pasta que saiu — foi assim que a `game/` sobreviveu meses').toEqual([]);
  });
});

describe('a regra das crases, e o piso, medidos onde o documento de hoje não os exerce', () => {
  /*
   * 🔴 THESE TWO CASES WERE BORN FROM SURVIVING MUTATIONS, and they are the difference between a written rule and a
   * defended one. Against the REAL document, removing the backticks from the expression and removing the floor from the
   * count both stayed GREEN — not because the rules are inert, but because today's text does not have the case that
   * exercises them. A synthetic text does.
   */
  it('🔴 [Zero] um caminho na PROSA, sem crases, não é promessa do mapa', () => {
    const prosa = 'a pasta app/js/game/physics.ts saiu com o cartucho, e o `app/js/core/state.ts` ficou';
    expect(caminhosCitados(prosa), 'o crivo leu prosa como promessa — passa a acusar frases sobre o passado')
      .toEqual(['app/js/core/state.ts']);
  });

  it('⚠️ [Zero] um mapa que não cita nada reprova, em vez de passar por não ter o que medir', () => {
    // Without the floor, an EMPTY document satisfies «nenhum caminho morto» — the empty is this repository's classic false green.
    expect(caminhosCitados('um mapa sem um único caminho'), 'texto sem caminhos deu caminhos').toEqual([]);
    expect(caminhosCitados(texto).length, 'o piso é o que impede o vazio de passar').toBeGreaterThan(15);
  });
});

/*
 * ========================= MUTATIONS CHECKED (2026-09-22) =========================
 * 1. putting `app/js/ui/webcam.ts` in a row of the map (the file F10 deleted on 16/09) ......... RED in the 1st case
 *    — it is the historical defect itself, reproduced.
 * 2. removing the `| \`boot/\` |` row from the layers table .......................................... RED in the 2nd
 * 3. putting the `| \`game/\` |` row back in the map (the folder left with the cartridge) ....................... RED in the 3rd
 * 4. removing the backticks from the paths expression ................................................... RED in the 4th
 * 5. removing the floor from the 1st case's count ........................................................ EQUIVALENT, and measured
 *    — the floor is asserted TWICE (in the 1st and the 5th case), so removing it from one place leaves nothing
 *      unprotected. It stays written instead of being «consertado»: the rule is defended, and it is the duplicated
 *      assertion that makes it equivalent.
 *
 * 🔴 AND TWO OF THEM ONLY TURNED RED AFTER CASES 4 AND 5 EXISTED. Against the REAL document, 4 and 5 passed — not because
 * the rules were inert, but because today's text does not exercise them: there is no non-existent path without backticks
 * in the prose, nor an empty map. A rule no case can turn red is a rule nobody defends the day someone deletes it, and it
 * was the surviving mutation that said so.
 *
 * ⚠️ AND THE MUTATION SCRIPT ITSELF DELETED THESE TWO CASES when restoring: it keeps a copy on the first run and always
 * restores it, so a case WRITTEN BETWEEN two runs is reverted without warning. The second time in the same day that a
 * mutation tool damaged the tree it measures.
 */
