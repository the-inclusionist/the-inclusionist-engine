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
import { formaDe, formaDoTexto, memberKeys, quebrasDeForma, RETRATO_FORMA } from '../scripts/shape-surface.mjs';

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
      { 'm.ts': { 'type A': '{ x: number; }' } },
    );
    expect(q).toEqual(['m.ts  interface A  changed kind to «type A»']);
  });

  it('🔴 [Right] and the reverse — a type alias that becomes an interface — fails too', () => {
    const q = quebrasDeForma({ 'm.ts': { 'type A': '{ x: number; }' } }, { 'm.ts': { 'interface A': ['x'] } });
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
    // The index signature is a member now, keyed by its key type: an implementer has to satisfy it.
    expect(memberKeys(f['interface A'])).toEqual(['LOGICAL_W?', '[string]', 'holdsAtOnce', 'i', 'topology']);
    expect(f['type U']).toBe('"a" | "b"');
  });

  /*
   * 🔴 AN ALIAS WAS READ UP TO ITS FIRST `;`, and a union of object types has one inside its first member. The portrait
   * kept `| { readonly mode: 'glide'` for the whole union, so every change AFTER that semicolon — a member's field, a
   * member added or removed, the second member entirely — left the recorded shape identical and passed this gate green.
   */
  it('🔴 [Right] a multi-line union whose SECOND member changes has another shape', () => {
    const union = (segundo) => [
      'export type Plan =',
      "  | { readonly mode: 'glide'; readonly waitMs: number }",
      `  | { readonly mode: 'pages'; ${segundo} };`,
      'export const after = 1;',
    ].join('\n');
    const antes = { 'm.ts': formaDoTexto(union('readonly pageMs: number')) };
    const agora = { 'm.ts': formaDoTexto(union('readonly pageMs: string')) };
    expect(antes['m.ts']['type Plan'], 'the alias was cut before its end').toContain('pageMs: number');
    expect(quebrasDeForma(antes, agora)).toHaveLength(1);
  });

  // ⚠️ The leading `|` is formatting too: a formatter adds it when a union wraps onto several lines.
  it('[Right] and formatting alone — line breaks, indentation, comments, a leading `|` — is not a change of shape', () => {
    const umaLinha = formaDoTexto("export type P = { a: number; b: 'x' | 'y' } | null;");
    const outra = formaDoTexto([
      'export type P =',
      '  // why it is a union',
      '  | {',
      '      a: number; /* the count */',
      "      b: 'x' |   'y'",
      '    }',
      '  | null;',
    ].join('\n'));
    expect(umaLinha['type P']).toBe("{ a: number; b: 'x' | 'y'; } | null");
    expect(outra['type P']).toBe(umaLinha['type P']);
  });
});

// ========================= AN INTERFACE, READ BY THE PARSER =========================
// 🔴 Interfaces used to be read by a regex up to the first `{` and one member per line, counting braces. 📏 On the tree of
// 2026-09-27, 49 of the 420 exported interfaces had a wrong list of names — `Spot { readonly x; readonly y; readonly z? }`
// was `['x']`, `CameraStartDeps<T extends { close(): void }, F>` was `['close']` — and no member TYPE, type parameter or
// `extends` was recorded at all, so a member whose type changed passed this gate green.
describe('an interface is read by the parser — its type parameters, its extends and each member typed', () => {
  const shapeOf = (src) => ({ 'm.ts': formaDoTexto(src) });
  const breaks = (before, now) => quebrasDeForma(shapeOf(before), shapeOf(now));
  const formaArvore = formaDe(join(RAIZ, 'app', 'js'));

  it('🔴 [Right] braces inside a string-literal type, an object-literal type and a type-parameter constraint are read right', () => {
    const box = formaDoTexto([
      'export interface Box<T extends { id: string } = { id: "}" }, U = T> extends Base<T>, Other {',
      "  readonly label: '{' | '}';",
      '  style: { color: string; nested: { depth: number } }; after: number;',
      '  greet<K extends keyof T>(key: K, loud?: boolean): string;',
      '  (now: number): U;',
      '  new (seed: string): Box<T, U>;',
      '  [key: string]: unknown;',
      '}',
    ].join('\n'))['interface Box'];
    expect(box.typeParameters, 'the generic is not recorded').toBe('T extends { id: string; } = { id: "}"; }, U = T');
    expect(box.extends).toBe('Base<T>, Other');
    expect(box.members).toEqual({
      '()': '(now: number): U',
      '[string]': '[key: string]: unknown',
      after: 'after: number',
      greet: 'greet<K extends keyof T>(key: K, loud?: boolean): string',
      label: "readonly label: '{' | '}'",
      'new()': 'new (seed: string): Box<T, U>',
      style: 'style: { color: string; nested: { depth: number; }; }',
    });
  });

  it('🔴 [Right] the real tree: an interface written on one line keeps every member', () => {
    // `core/contract.ts` `Spot` was recorded as `['x']` by the old reader — deleting `y` passed green.
    expect(memberKeys(formaArvore['core/contract.ts']?.['interface Spot'])).toEqual(['x', 'y', 'z?']);
    expect(formaArvore['ui/camera-control.ts']?.['interface CameraStartDeps']?.typeParameters).toBe('T extends { close(): void; }, F');
  });

  it('⚠️ [Right] a member whose TYPE changes fails — a parameter added, or `string` becoming `number`', () => {
    expect(breaks('export interface A { on: (a: number) => void }', 'export interface A { on: (a: number, b: number) => void }'))
      .toEqual(['m.ts  interface A.on  changed type: «on: (a: number) => void» → «on: (a: number, b: number) => void»']);
    expect(breaks('export interface A { readonly n: string }', 'export interface A { readonly n: number }'))
      .toEqual(['m.ts  interface A.n  changed type: «readonly n: string» → «readonly n: number»']);
  });

  it('⚠️ [Right] a type parameter added fails', () => {
    expect(breaks('export interface A { x: number }', 'export interface A<T = number> { x: T }')).toEqual([
      'm.ts  interface A  type parameters changed: «» → «T = number»',
      'm.ts  interface A.x  changed type: «x: number» → «x: T»',
    ]);
    expect(breaks('export interface A<T> { x: number }', 'export interface A { x: number }'))
      .toEqual(['m.ts  interface A  type parameters changed: «T» → «»']);
  });

  it('⚠️ [Right] an `extends` that changes fails', () => {
    expect(breaks('export interface A extends B { x: number }', 'export interface A extends C { x: number }'))
      .toEqual(['m.ts  interface A  extends changed: «B» → «C»']);
  });

  it('⚠️ [Right] a member that leaves fails — from an interface written on one line', () => {
    expect(breaks('export interface A { x: number; y: string }', 'export interface A { x: number }'))
      .toEqual(['m.ts  interface A.y  SAIU']);
  });

  it('⚠️ [Right] a member that becomes required fails ONCE — not a second time as a type change', () => {
    expect(breaks('export interface A { x?: number }', 'export interface A { x: number }'))
      .toEqual(['m.ts  interface A.x  era opcional e passou a OBRIGATÓRIO']);
    // 📌 The `?` lives in the KEY only, so the reverse keeps the rule this gate always had: required → optional does not
    // break whoever builds the type, and it is not turned into a «type change» by the question mark alone.
    expect(breaks('export interface A { x: number }', 'export interface A { x?: number }')).toEqual([]);
  });

  it('[Right] a new OPTIONAL member passes, and a new required one does not', () => {
    expect(breaks('export interface A { x: number }', 'export interface A { x: number; y?: (a: string) => void }')).toEqual([]);
    expect(breaks('export interface A { x: number }', 'export interface A { x: number; y(): void }'))
      .toEqual(['m.ts  interface A.y  ENTROU como obrigatório']);
  });

  it('[Right] formatting alone — line breaks, comments, `,` against `;` — is not a change of an interface', () => {
    const oneLine = 'export interface A<T extends object = {}> extends B<T> { readonly f: (a: number, b: string) => void; g(): void; }';
    const spread = [
      'export interface A<',
      '  T extends object = {},',
      '> extends B<T> {',
      '  // why f is readonly',
      '  readonly f: (a: number,',
      '     b: string) => void,',
      '  /** the other */ g(): void',
      '}',
    ].join('\n');
    expect(breaks(oneLine, spread)).toEqual([]);
    expect(shapeOf(spread)).toEqual(shapeOf(oneLine));
  });

  it('📌 [Right] a portrait from before the parser (a plain list of names) is still compared by name', () => {
    // A published tag's portrait is that form, and `Breaking-Changes.md` audits a tag against `HEAD`.
    const legacy = { 'm.ts': { 'interface A': ['x', 'y?'] } };
    expect(quebrasDeForma(legacy, shapeOf('export interface A { x: string; y?: number; [k: string]: unknown }'))).toEqual([]);
    expect(quebrasDeForma(legacy, shapeOf('export interface A { x: string; y: number }')))
      .toEqual(['m.ts  interface A.y  era opcional e passou a OBRIGATÓRIO']);
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
//
// ========================= MUTATIONS OF THE WHOLE ALIAS =========================
// Applied by script, one occurrence each, all RED:
//   · `hour: number` → `hour: string` in the SECOND member of `core/contract.ts` `Bearing` → `[Zero] NENHUM tipo mudou de
//     forma` fails. Before the parser read the alias, `Bearing` was recorded as `| { readonly kind: 'compass'`, and this
//     edit could not change that text.
//   · the alias read by the old regex again (up to the first `;`) → the multi-line union case, the formatting case and the
//     real-tree case fail.
//   · the alias kept as its raw source text instead of printed → the formatting case and the real-tree case fail.
//
// ========================= MUTATIONS OF THE INTERFACE READ BY THE PARSER =========================
// Applied by script, anchor counted (=1 in all fourteen), restored from a copy and compared byte for byte; all RED.
// ⚠️ The last two are against the REAL TREE, and both passed the old reader GREEN: it recorded `Spot` as `['x']`.
//   · the member-type comparison removed          → the type-change case and the type-parameter case (its `x: T`)
//   · the type-parameter comparison removed       → the type-parameter case
//   · the `extends` comparison removed            → the `extends` case
//   · the member-left rule removed                → both member-left cases (list form and one-line interface)
//   · the optional → required rule removed        → its case, the «fails ONCE» case and the plain-list case
//   · a new OPTIONAL member counted as a break    → both new-optional cases
//   · type parameters not recorded                → `[Zero]` on the real tree, the braces case, the real-tree case, the
//                                                   type-parameter case
//   · a property's type not recorded              → `[Zero]`, the braces case, the type-change and type-parameter cases
//   · method signatures not read as methods       → `[Zero]`, both extractor cases, the new-member case, and the ORPHAN
//                                                   case of `a-setting-announces-itself`
//   · optionality dropped from the member's key   → seven, among them `a-setting-announces-itself`'s SOLVED-example case
//   · the `?` kept inside the signature           → `[Zero]` and the «fails ONCE» case (required → optional became a
//                                                   «type change»)
//   · a plain list's missing signatures reported as new → the plain-list case
//   · `core/contract.ts` `Spot.y: number` → `string`    → `[Zero] NENHUM tipo mudou de forma`
//   · `core/contract.ts` `Spot.y` deleted               → `[Zero]` and the real-tree case
