// SPDX-License-Identifier: AGPL-3.0-or-later
// A NAME DOES NOT LEAVE THE PACKAGE WITHOUT SOMEONE SAYING IT LEFT.
//
// ========================= WHAT THIS EXISTS TO CATCH =========================
// Measured on 2026-09-07, comparing the surface published in `v7.0.1` with the tree: since that tag **33 modules** and
// **8 constants** had left, and the `KeyScheme` type had closed on fourteen positions. Five commits marked themselves
// breaking with `!` in the subject — and **none** wrote the `BREAKING CHANGE:` footer.
//
// ⚠️ THE CONSEQUENCE IS NOT ONE OF STYLE. This repository's `CHANGELOG.md` is generated from the Conventional Commits,
// and the `v7.0.0` entry shows what it can say when the footers exist: paragraphs telling whoever consumes what they have
// to change. Without them, what is left is a one-line subject — and a subject is not a migration.
// `docs/6-DevOps-SRE/Breaking-Changes.md` had to be written after the fact, from a measurement, because the information
// was nowhere.
//
// This gate is so there is no «depois do facto» again. It compares the tree with a committed SNAPSHOT and fails when a
// name disappears. It does not prevent the removal: it asks for it to be DECLARED — running
// `node scripts/snapshot-public-surface.mjs` is the declaration, and the message below says the rest.
//
// ⚠️ ADDING DOES NOT FAIL, and the asymmetry is the design. A new name is backwards compatible, and a gate requiring
// equality would be pushed at every innocent `export` — which is how a ceiling «que só desce» ends up loosened. What is
// forbidden is the one thing that breaks someone: **disappearing**.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { superficieDe, RETRATO } from '../scripts/snapshot-public-surface.mjs';
import { formaDe, formaDoTexto, quebrasDeForma, RETRATO_FORMA } from '../scripts/shape-surface.mjs';

const RAIZ = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const retrato = JSON.parse(readFileSync(join(RAIZ, RETRATO), 'utf8'));
const arvore = superficieDe(join(RAIZ, 'app', 'js'));

const COMO_DECLARAR = [
  '',
  'Isto é uma MUDANÇA QUEBRANTE do pacote. Se for deliberada, faça as duas coisas:',
  '  1. escreva o rodapé `BREAKING CHANGE:` no commit, dirigido a quem tem de editar o código dele;',
  '  2. corra `node scripts/snapshot-public-surface.mjs` para declarar a remoção.',
  'E se houver mais de uma a caminho, veja `docs/6-DevOps-SRE/Breaking-Changes.md`: elas querem o MESMO major.',
].join('\n');

describe('a superfície pública do pacote só encolhe por declaração (docs/6-DevOps-SRE/Breaking-Changes.md)', () => {
  it('[Interface] o retrato e a árvore falam do mesmo repositório', () => {
    // Without this, an empty snapshot or a wrong path would leave every case below green for free.
    expect(Object.keys(retrato).length, 'o retrato está vazio; correu o script?').toBeGreaterThan(50);
    expect(Object.keys(arvore).length, 'a varredura não achou módulos').toBeGreaterThan(50);
    expect(arvore['core/contract.ts'], 'a varredura não vê o contrato').toBeTruthy();
  });

  it('⚠️ [Zero] NENHUM módulo saiu do pacote sem declaração', () => {
    const foram = Object.keys(retrato).filter((m) => !arvore[m]);
    expect(foram, 'módulos que o pacote publicava e já não publica:' + COMO_DECLARAR).toEqual([]);
  });

  it('⚠️ [Zero] NENHUM nome exportado desapareceu de um módulo que ficou', () => {
    const sumidos = [];
    for (const [m, nomes] of Object.entries(retrato)) {
      const agora = new Set(arvore[m] ?? []);
      if (!arvore[m]) continue; // the whole module is the case above; do not count twice
      for (const n of nomes) if (!agora.has(n)) sumidos.push(`${m}  ${n}`);
    }
    expect(sumidos, 'nomes que o pacote publicava e já não publica:' + COMO_DECLARAR).toEqual([]);
  });

  it('[Right] acrescentar NÃO reprova — só desaparecer', () => {
    // The asymmetry said in prose, asserted in code: a name that exists today and is not in the snapshot is backwards
    // compatible, and this case exists so nobody «fixes» it by requiring equality.
    const novos = [];
    for (const [m, nomes] of Object.entries(arvore)) {
      const antes = new Set(retrato[m] ?? []);
      for (const n of nomes) if (!antes.has(n)) novos.push(`${m} ${n}`);
    }
    expect(Array.isArray(novos), 'nomes novos são informação, não reprovação').toBe(true);
  });

  /*
   * 🔴 THE SNAPSHOT USED TO SEE ONE NAME PER LINE, and a line publishes as many as it likes. Found on 2026-09-21 while
   * measuring what the games IMPORT from the engine: `export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;` publishes
   * three names and the snapshot kept one. 📏 Eight like that, and two of them — `LOGICAL_H` and `TILE` — are imported by
   * game-platformer and pixi-15-puzzle: deleting them passed GREEN in the very sieve that exists to fail when a public name
   * disappears.
   *
   * ⚠️ AND THE PAIR THAT STOPS THE FIX FROM OVERDOING IT: a snapshot that INVENTS a name is worse than one that loses one,
   * because it starts requiring forever something no module has. Counting only parentheses and braces, the comma INSIDE a
   * string («'button:not([disabled]), select:not(…)'») published an export called `select`.
   */
  it('🔴 [Right] uma linha que declara vários nomes publica TODOS — e nenhuma vírgula de dentro de uma cadeia vira nome', () => {
    const constantes = new Set(arvore['core/constants.ts'] ?? []);
    for (const n of ['LOGICAL_W', 'LOGICAL_H', 'TILE']) {
      expect(constantes.has(n), `${n} é público e o retrato não o vê — apagá-lo passaria verde`).toBe(true);
    }
    const itens = new Set(arvore['ui/menu-items.ts'] ?? []);
    expect(itens.has('ITEM_SELECTOR')).toBe(true);
    expect(itens.has('select'), 'a vírgula de dentro do selector CSS virou um nome público que não existe').toBe(false);
  });

  /*
   * 🔴 A RE-EXPORT IS PUBLISHED, AND THE PORTRAIT USED TO BE BLIND TO IT (issue #204): deleting `export { x } from …`
   * passed GREEN here, because the name was never in that module's portrait — and nothing weighed whether it had a consumer.
   * The four forms the tree uses, each publishing the name a consumer WRITES (after `as`), never the origin's.
   */
  it('🔴 [Right] a re-export publishes the name after `as`, in every form the tree uses', () => {
    const keydown = new Set(arvore['input/keydown.ts'] ?? []);
    expect(keydown.has('EDGE_BY_ACTION'), '`export { X } from` is not read').toBe(true);
    expect(keydown.has('hasTitleIntent'), '`export { a as b } from` lost the published name').toBe(true);
    expect(keydown.has('hasNavIntent'), 'the ORIGIN\'s name was published — no module here exports it').toBe(false);
    expect(new Set(arvore['boot/create-game.ts'] ?? []).has('VirtualCommand'), '`export type { T } from` is not read').toBe(true);
    expect(new Set(arvore['platform/heavy.ts'] ?? []).has('CACHE_HEAVY'), 'the list form `export { a, b };` is not read').toBe(true);
  });

  it('⚠️ [Interface] o retrato guarda os oito que já saíram — a medição não se perde', () => {
    // The eight constants of `core/constants.ts` left BEFORE this gate existed, and the snapshot was taken afterwards.
    // This case asserts they stay out: if someone brings them back without thinking, the gate above would say nothing
    // (adding does not fail), and `Breaking-Changes.md` would start lying.
    // 🔴 THERE ARE ELEVEN SINCE 23/09: `TILE_TYPES`, `isHazard` and `isTrampoline` used to be required to stay, for an
    // accessibility reason — `core/collision.isSolidType` made hazard and trampoline solid in blind and wheelchair modes.
    // That stopped being true when that rule went with the geometry that consults it (ADR-0228): the three had no reader
    // left here. 📌 The engine still knows what a hazard is — it asks the contract for the ROLE, through `roleOf`; what it
    // no longer has is a table of tile NUMBERS.
    const FORAM = ['JUMP_BASE', 'TUNE', 'COIN_TARGET', 'ehAgua', 'ehEscada', 'ehPortao', 'ehChave', 'ehSecreto',
      'TILE_TYPES', 'isHazard', 'isTrampoline'];
    const constantes = new Set(arvore['core/constants.ts'] ?? []);
    for (const n of FORAM) {
      expect(constantes.has(n), `${n} voltou a core/constants.ts; a doc de quebras precisa de ser corrigida`).toBe(false);
    }
    // And what STAYS is the logical resolution and the grid, which is what any 2D pixel game shares.
    expect(constantes.has('TILE'), 'a grade saiu: sem ela a engine não sabe desenhar em múltiplos inteiros').toBe(true);
  });
});

// ========================= THE SHAPE, THE HALF THE NAMES DO NOT SEE =========================
// ⚠️ MEASURED ON 2026-09-08, comparing `v7.0.1` with the tree: the names gate finds **32 modules** that left and
// **8 constants**, and the two sets DO NOT TOUCH the 23 that follow. It is blind to all of them, because in all of them the
// exported name stayed exactly the same — what changed is what is INSIDE:
//
//   · `GameDeclaration.holdsAtOnce` came in as required (it is what makes the four games not compile);
//   · `PlayerBase.visual` likewise; `Player.guideT` left;
//   · `SonarPlayer.viz`/`.guideT` and `SonarCtx.VIZ_BY_KEY` left, `SonarCtx.visaoComprometida` came in;
//   · `IconStateSnapshot.viz` → `.visual`, and `PauseIconsCtx` gained two required fields;
//   · `PhaseView.pauseOverlayHidden` left; `SettingsVisualCtx.renderVizGroup` → `renderEixosVisuais`;
//   · and three ALIASES narrowed: `KeyScheme` closed on the fourteen positions, `DrawPlayer` and `PausePlayer` swapped
//     the `'viz'` slice for `'visual'`.
//
// ⚠️ AND THE ASYMMETRY HERE IS ANOTHER ONE. In the names gate, adding is always safe. Not here: a new REQUIRED member
// breaks everyone who builds the type — which is what `holdsAtOnce` did. Optional passes silently; required asks for a
// declaration, as removal does.
describe('a FORMA dos tipos exportados também só muda por declaração', () => {
  const forma = JSON.parse(readFileSync(join(RAIZ, RETRATO_FORMA), 'utf8'));
  const formaArvore = formaDe(join(RAIZ, 'app', 'js'));

  it('[Interface] o retrato de forma e a árvore falam do mesmo repositório', () => {
    expect(Object.keys(forma).length, 'o retrato de forma está vazio; correu o script?').toBeGreaterThan(50);
    expect(Object.keys(formaArvore).length, 'a varredura não achou tipo nenhum').toBeGreaterThan(50);
    expect(formaArvore['core/contract.ts']?.['interface GameDeclaration'], 'a varredura não vê a declaração').toBeTruthy();
  });

  it('⚠️ [Zero] NENHUM tipo exportado mudou de forma sem declaração', () => {
    expect(quebrasDeForma(forma, formaArvore), 'a forma publicada mudou:' + COMO_DECLARAR).toEqual([]);
  });

  it('⚠️ [Right] um membro que SAI reprova — é a quebra que o gate dos nomes não vê', () => {
    const antes = { 'm.ts': { 'interface A': ['x', 'y'] } };
    const agora = { 'm.ts': { 'interface A': ['x'] } };
    expect(quebrasDeForma(antes, agora)).toEqual(['m.ts  interface A.y  SAIU']);
  });

  it('⚠️ [Right] um membro OBRIGATÓRIO novo reprova — foi o que o `holdsAtOnce` fez aos quatro jogos', () => {
    const q = quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': { 'interface A': ['x', 'y'] } });
    expect(q).toEqual(['m.ts  interface A.y  ENTROU como obrigatório']);
  });

  it('[Right] um membro OPCIONAL novo NÃO reprova — é compatível para trás', () => {
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': { 'interface A': ['x', 'y?'] } })).toEqual([]);
  });

  it('⚠️ [Right] um opcional que passa a OBRIGATÓRIO reprova — quebra quem não o preenchia', () => {
    const q = quebrasDeForma({ 'm.ts': { 'interface A': ['x?'] } }, { 'm.ts': { 'interface A': ['x'] } });
    expect(q).toEqual(['m.ts  interface A.x  era opcional e passou a OBRIGATÓRIO']);
  });

  it('⚠️ [Right] um alias que ESTREITA reprova — é o caso do `KeyScheme`', () => {
    const q = quebrasDeForma(
      { 'm.ts': { 'type K': 'Record<string, string[]>' } },
      { 'm.ts': { 'type K': 'Record<Action, readonly string[] | null>' } },
    );
    expect(q).toHaveLength(1);
    expect(q[0]).toContain('mudou de forma');
  });

  /*
   * 🔴 A DECLARATION THAT CHANGES KIND KEEPS ITS NAME AND ITS MEMBERS, so neither the name gate nor the member rules saw
   * it: `interface A` left the module, which read as «the type left», and the name `A` was still exported. For a consumer
   * the two kinds are not the same thing — an interface merges with their own declaration of `A`, an alias does not.
   */
  it('🔴 [Right] an interface that becomes a type alias fails, with every member unchanged', () => {
    const q = quebrasDeForma(
      { 'm.ts': { 'interface A': ['x', 'y?'] } },
      { 'm.ts': { 'type A': '{ x: number' } },
    );
    expect(q).toEqual(['m.ts  interface A  changed kind to «type A»']);
  });

  it('🔴 [Right] and the reverse — a type alias that becomes an interface — fails too', () => {
    const q = quebrasDeForma({ 'm.ts': { 'type A': '{ x: number' } }, { 'm.ts': { 'interface A': ['x'] } });
    expect(q).toEqual(['m.ts  type A  changed kind to «interface A»']);
  });

  it('[Right] um tipo que desaparece INTEIRO não é contado aqui — já é caso do gate dos nomes', () => {
    // The same `continue` the names gate has, and for the same reason: counting it in both would make a six-line list
    // look like twelve, and the second half would say nothing the first had not said.
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': {} })).toEqual([]);
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, {})).toEqual([]);
  });

  it('⚠️ [Interface] o extractor lê membros de verdade — opcional, método, readonly e assinatura de índice', () => {
    // Without this case, an extractor returning empty lists would leave ALL the cases above green: two empty lists have
    // no differences. It is this half's vacuum case.
    const f = formaDoTexto([
      'export interface A {',
      '  readonly i: number;',
      '  topology: () => Topology;',
      '  LOGICAL_W?: number;',
      '  holdsAtOnce(): number;',
      '  [k: string]: unknown;',
      '}',
      'export type U = "a" | "b";',
    ].join('\n'));
    expect(f['interface A']).toEqual(['LOGICAL_W?', 'holdsAtOnce', 'i', 'topology']);
    expect(f['type U']).toBe('"a" | "b"');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · deleting any `export` from `app/js/core/route.ts` → `[Zero] NENHUM nome exportado desapareceu`
//     fails naming the module and the name, with both instructions on how to declare.
//   · renaming `app/js/core/route.ts` → `[Zero] NENHUM módulo saiu do pacote` fails with the old path,
//     and the names case does NOT fail with it — the `continue` exists so the same disappearance is not counted twice,
//     which is what would make a 6-line list look like 60.
//   · giving `export const TUNE = …` back to `core/constants.ts` → `[Interface] o retrato guarda os oito`
//     fails. It is the only way for the gate to speak about a removal EARLIER than the snapshot, and that is why it is
//     written out in full instead of derived.
//   · emptying `public-surface.json` to `{}` → `[Interface] o retrato e a árvore` fails. Without it the two `[Zero]`
//     cases would stay green for having nothing to compare.
//
// ========================= MUTATIONS OF THE RE-EXPORT READING (issue #204) =========================
// Applied by script, one occurrence each, all RED:
//   R1 the portrait stops reading re-exports            → the re-export case AND `[Zero] NENHUM nome` fail
//   R2 the name BEFORE `as` is published                → the same two (`hasTitleIntent` disappears)
//   R3 `export type { T } from` no longer read          → the same two (`VirtualCommand` disappears)
//   R4 the list form `export { a, b };` no longer read  → the same two (`CACHE_HEAVY` disappears)
//   R8 BOTH sides of `as` published                     → only the re-export case: the origin's `hasNavIntent` appears in
//                                                         `input/keydown`, a name no module there exports
//   R5 `export { stepInRing } from` deleted from `ui/menu-nav` → `[Zero] NENHUM nome` fails. Before #204 this deletion
//      passed green: it is the blind spot the issue named.
//
// ========================= MUTATIONS OF THE SHAPE HALF =========================
// Six, applied by script to the file and with occurrence counts (=1 in all six). ⚠️ The first two are against the REAL
// TREE and not against fixtures — the gate catches a shape break in real code.
//   · renaming `holdsAtOnce(): number` in `core/contract.ts` → `[Zero] NENHUM tipo mudou de forma` fails.
//     ⚠️ And the NAMES gate says nothing: `GameDeclaration` is still exported under the same name. It is the
//     demonstration of the blindness this half exists to cover.
//   · making `SonarCtx.LOGICAL_W?` required → fails with "was optional and became REQUIRED". A field that was already
//     `@deprecated` and optional closing up would break whoever never filled it.
//   · killing the member extractor → TWO fail, and the second is the vacuum one: without it, two empty lists have no
//     differences and every shape case would pass for having nothing to compare.
//   · removing the NEW REQUIRED MEMBER rule → the case of the same name fails. It is the rule that separates this gate
//     from the names one: there adding is always safe, here adding a required member breaks whoever builds.
//   · removing the ALIAS comparison → the `KeyScheme` case fails. Without it, a union narrowing passes — and it was a
//     union narrowing that §3 of that doc had to describe by hand.
//   · removing the OPTIONAL→REQUIRED rule → the case of the same name fails.
//
// ========================= MUTATIONS OF THE DECLARATION KIND =========================
//   · turning `export interface Spot { … }` in `core/contract.ts` into `export type Spot = { … }` (members untouched) →
//     `[Zero] NENHUM tipo mudou de forma` fails with «interface Spot changed kind to «type Spot»». Before the kind rule
//     the same edit passed the whole file green: the name gate still saw `Spot`, and the shape gate read «the type left».
//   · removing the kind rule (the `push` inside `nova === undefined`) → the two kind cases fail, and so does the real-tree
//     mutation above: it goes back to green.
//   · keying aliases as `interface …` in the extractor → the real-tree case and the extractor case fail: the kind the
//     rule reads comes from that key.
