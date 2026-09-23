// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY NAME A TEST IMPORTS IS A NAME ITS MODULE PUBLISHES.
//
// ========================= THE DEFECT, MEASURED AND NOT IMAGINED =========================
// 🔴 On 2026-09-23 the `ui/motion-choices` cut found `tests/settings-motion.node.test.js` importing SIX names the
// module no longer exported — `motionRowHtml`, `buildCharRowsHtml`, `buildSceneRowsHtml`, `crtToggleRowHtml`,
// `crtRoundRowHtml`, `RM_SOON` — with the suite GREEN. A named import of something that does not exist resolves
// to `undefined` under the transform, and nothing fails until a case USES the name. The edit that should have
// cleaned the list had matched nothing, in silence, and the green hid it.
//
// 🎯 THE `tsc` GIVES THIS FOR FREE TO THE `.ts` TREE AND NOT TO THE TESTS, which are `.js`. That asymmetry is the
// whole reason this file exists: the part of the repository that decides whether everything else is correct is
// the part the type checker does not check.
//
// 📏 AND IT WAS NOT ONE FILE. Measured when this gate was written: FOUR dead named imports in four files, and
// three of them were WORSE than dead — `PADRAO` came from `core/visual-state`, which exports nothing but types,
// so three icon-bar files were passing `visual: undefined` into the icon computation and calling it a snapshot.
// The fourth, `PAUSE_COLS`, names something that exists nowhere in `app/js` at all.
//
// ========================= WHY THE PARSER AND NOT A REGULAR EXPRESSION =========================
// ⚠️ A reader that MISSES an export produces a false alarm — loud, and someone deletes a good import to silence
// it. That is the expensive direction, and it is exactly what a regular expression does with `export { x } from`,
// with `export const A = 1, B = 2`, and with a declaration that spans lines. This repository has had FIVE
// hand-rolled scanners be wrong about where a construct ends; the answer written down after the fifth is the
// TypeScript parser, and it is what reads both sides here.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();

function sweep(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sweep(p, out);
    else if (name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const treeOf = (f) => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
const short = (p) => relative(ROOT, p).split('\\').join('/');

/**
 * A specifier as WRITTEN (`'../app/js/ui/x.js'`) → the file on disk (`…/ui/x.ts`).
 *
 * 📌 The `.js` of an import is the EMITTED name; the source beside it is `.ts`. Resolving the written name
 * literally would find nothing and the gate would quietly check no module at all — the failure mode this file
 * exists to catch, one floor up.
 */
function fileOf(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const cand of [base.replace(/\.js$/, '.ts'), base, `${base}.ts`, `${base}.js`]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

/** Every name a module publishes as a VALUE, and every name it publishes only as a TYPE. Follows re-exports. */
function exportsOf(file, seen = new Set()) {
  const values = new Set();
  const types = new Set();
  const unread = [];
  if (seen.has(file)) return { values, types, unread };
  seen.add(file);
  const tree = treeOf(file);
  const published = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  tree.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && published(node) && node.name) values.add(node.name.text);
    else if (ts.isClassDeclaration(node) && published(node) && node.name) values.add(node.name.text);
    else if (ts.isEnumDeclaration(node) && published(node)) values.add(node.name.text);
    else if (ts.isVariableStatement(node) && published(node)) {
      // ⚠️ EVERY DECLARATOR, not the first: `export const A = 1, B = 2` publishes two, and reading one of them is
      // how the public-surface portrait once hid eight names that two games import.
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) values.add(d.name.text);
        else for (const el of d.name.elements ?? []) if (el.name && ts.isIdentifier(el.name)) values.add(el.name.text);
      }
    } else if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && published(node)) types.add(node.name.text);
    else if (ts.isExportDeclaration(node)) {
      if (!node.exportClause) {
        // `export * from …`: 📏 no module in this tree has one. It is NAMED rather than followed, because a reader
        // that met one and stayed quiet would report every name of that module as missing — the expensive direction.
        unread.push(node.getText(tree).trim());
        return;
      }
      if (!ts.isNamedExports(node.exportClause)) return;
      const from = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? fileOf(file, node.moduleSpecifier.text) : null;
      for (const el of node.exportClause.elements) {
        const name = el.name.text;
        if (node.isTypeOnly || el.isTypeOnly) { types.add(name); continue; }
        // `export { hasNavIntent as hasIntent } from './edges.js'` publishes `hasIntent` as a VALUE, and whether it
        // is one is a fact about the OTHER module — so it is asked there, not assumed here.
        if (!from) { values.add(name); continue; }
        const other = exportsOf(from, seen);
        unread.push(...other.unread);
        const original = (el.propertyName ?? el.name).text;
        if (other.types.has(original) && !other.values.has(original)) types.add(name);
        else values.add(name);
      }
    }
  });
  return { values, types, unread };
}

/** Every named import a test makes from a module of this repository, with what that module publishes. */
function namedImports() {
  const out = [];
  for (const t of sweep(join(ROOT, 'tests'))) {
    const tree = treeOf(t);
    tree.forEachChild((node) => {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
      const target = fileOf(t, node.moduleSpecifier.text);
      const bindings = node.importClause?.namedBindings;
      if (!target || !bindings || !ts.isNamedImports(bindings)) return;
      const { values, types, unread } = exportsOf(target);
      for (const el of bindings.elements) {
        const name = (el.propertyName ?? el.name).text;
        out.push({ test: short(t), module: short(target), name, isValue: values.has(name), isType: types.has(name), unread });
      }
    });
  }
  return out;
}

const ALL = namedImports();

describe('every name a test imports exists (the `tsc` checks the modules, nobody checks the tests)', () => {
  it('[Interface] the sweep finds tests, resolves modules and reads names — an empty result cannot come from matching nothing', () => {
    expect(ALL.length, 'no named import found: the gate would be green for measuring nothing').toBeGreaterThan(300);
    expect(new Set(ALL.map((x) => x.test)).size).toBeGreaterThan(50);
    expect(new Set(ALL.map((x) => x.module)).size).toBeGreaterThan(50);
  });

  it('⚠️ [Cross-check] the reader FOLLOWS a re-export — otherwise it would accuse good imports and someone would delete them', () => {
    // `ui/menu-nav` publishes `hasIntent` and `stepInRing` with `export { … } from`, and `tests/menu-nav.node`
    // imports exactly those. It is the reader's expensive direction pinned against a real pair in the tree.
    const forName = (n) => ALL.find((x) => x.module === 'app/js/ui/menu-nav.ts' && x.name === n);
    for (const n of ['hasIntent', 'stepInRing']) {
      expect(forName(n), `${n} is no longer imported from menu-nav; this case lost its subject`).toBeTruthy();
      expect(forName(n).isValue, `${n} comes by re-export and the reader did not follow it`).toBe(true);
    }
  });

  it('🔴 [Zero] no test imports a name its module does not publish', () => {
    const dead = ALL.filter((x) => !x.isValue).map((x) => `${x.test} ← ${x.module} :: ${x.name}`
      + (x.isType ? ' (TYPE only: `undefined` as a value)' : ' (not exported)'));
    expect(dead, 'a named import resolving to `undefined`: nothing fails until a case USES the name').toEqual([]);
  });

  it('⚠️ [Error] an `export *` the reader cannot follow is SAID, never swallowed', () => {
    // A reader that met one and stayed quiet would call every name of that module missing. Naming it turns a
    // silent false alarm into an instruction; 📏 no module in this tree has one today.
    const blind = [...new Set(ALL.flatMap((x) => x.unread))];
    expect(blind, 'an `export *` appeared: teach the reader to follow it before trusting this gate').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   M1 a test imports a name that does not exist            🔴 Zero
//   M2 a test imports a name exported only as a TYPE        🔴 Zero
//   M3 a re-exported name stops counting as a value         🔴 Cross-check · Zero
//   M4 only the FIRST declarator of a multi-name
//      `export const` is read                               🔴 Zero
//   M5 the specifier is resolved literally (`.js`), so no
//      module is ever found                                 🔴 Interface · Cross-check
//   M6 a module gains an `export *`                         🔴 Error
