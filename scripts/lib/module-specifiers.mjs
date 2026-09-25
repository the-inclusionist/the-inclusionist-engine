// SPDX-License-Identifier: AGPL-3.0-or-later
//
// EVERY MODULE A SOURCE FILE NAMES, READ BY THE TYPESCRIPT PARSER — the one reader the import gates share (ADR-0173 for
// the layering, ADR-0027 for the engine↔game boundary, ADR-0032 for the curriculum).
//
// ⚠️ WHY NOT A REGULAR EXPRESSION. Each gate used to read imports with its own pattern, and a pattern written around
// `from '…'` does not see the forms that have no `from`: a side-effect `import '../game/x.js'`, an `import('…')`, a
// `require('…')`. Those forms LOAD CODE just the same, and the side-effect one is the worst of them, because `tsc` does not
// even check that its file exists (`noUncheckedSideEffectImports` is off by default) — only the build fails. A pattern also
// reads comments and strings as imports. The parser knows where a construct begins and ends, which is the question.
//
// WHAT IS RETURNED, one entry per specifier, in source order:
//   kind          what the construct is:
//     'import'        `import x from '…'`, `import { a } from '…'`, `import * as n from '…'`, `import type … from '…'`
//     'side-effect'   `import '…'` — no bindings, run for its effects
//     're-export'     `export { a } from '…'`, `export * from '…'`, `export * as n from '…'`, `export type … from '…'`
//     'dynamic'       `import('…')` — `spec` is null when the argument is not a literal (the gate decides what that means)
//     'require'       `require('…')` and `import x = require('…')`
//     'worker-url'    `new URL('…', import.meta.url)` — the form a bundler follows to a worker or an asset
//     'type-query'    `typeof import('…')` in a type position — erased, like `import type`
//   spec          the specifier as written, or null for a non-literal `import(…)`
//   typeOnly      true when nothing survives to run time: `import type`, `export type`, named bindings that are ALL
//                 `type`, and `type-query`. A bare `import '…'` and a default or namespace import load the module.
//   line          1-based line of the construct, for a failure message that quotes where it is
//
// A gate about RUN-TIME dependency filters `typeOnly` out; a gate about a module's SHAPE (a lower layer knowing an upper
// one's types, a folder that must import nothing) keeps it. Each gate says which, in its own header.
import ts from 'typescript';

// ⚠️ THE PREDICATES ARE BOUND ONCE, HERE, and that is the cost of the whole walk, not style. Under Vitest this module is
// transformed, and every `ts.isX` in the walk becomes a property read through the transformed module's namespace — several
// per node, for every node of every file a gate reads. Measured on 2026-09-25 over the 184 modules of `app/js`: the same
// walk took ~300 ms inside a Vitest worker and ~150 ms in plain Node, while the bare parse took ~110 ms in both.
const {
  createSourceFile, ScriptTarget, ScriptKind, SyntaxKind, JSDocParsingMode,
  isExportDeclaration, isNamedExports, isNamedImports, isStringLiteral, isNoSubstitutionTemplateLiteral,
  isImportDeclaration, isImportEqualsDeclaration, isExternalModuleReference, isImportTypeNode, isLiteralTypeNode,
  isCallExpression, isIdentifier, isNewExpression, isPropertyAccessExpression, isMetaProperty,
} = ts;

/**
 * Is this import or re-export declaration TYPE-ONLY? `import type …`, `export type … from`, or named bindings that are ALL
 * marked `type`. A bare `import './x'` and a default or namespace import load the module, so they are value imports.
 */
export const isTypeOnlyImport = (node) => {
  if (isExportDeclaration(node)) {
    if (node.isTypeOnly) return true;
    const c = node.exportClause;
    return !!c && isNamedExports(c) && c.elements.length > 0 && c.elements.every((e) => e.isTypeOnly);
  }
  const c = node.importClause;
  if (!c) return false;
  if (c.isTypeOnly) return true;
  return !c.name && !!c.namedBindings && isNamedImports(c.namedBindings)
    && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly);
};

const literal = (n) => (n && (isStringLiteral(n) || isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

const scriptKind = (fileName) => (/\.tsx$/.test(fileName) ? ScriptKind.TSX
  : /\.(m?js|cjs)$/.test(fileName) ? ScriptKind.JS : /\.jsx$/.test(fileName) ? ScriptKind.JSX : ScriptKind.TS);

/**
 * Two pieces of the parse no entry used, left out:
 *   · the JSDoc inside comments (`ParseNone`) — the walk goes by `forEachChild`, which never enters a JSDoc node, so an
 *     `import('…')` written in a `@type` was never an entry; and this tree's comments are long;
 *   · the parent links (`setParentNodes: false`) — nothing below climbs to a parent; `getStart(sf)` reads the text it is
 *     handed.
 * 📏 Checked when they left (2026-09-25): the entries of all 569 tracked `.ts`/`.js`/`.mjs` files are byte-for-byte the
 * same with and without them.
 */
const PARSE = { languageVersion: ScriptTarget.Latest, jsDocParsingMode: JSDocParsingMode.ParseNone };

/** Every module specifier `text` names (see the header for the shape of an entry). */
export function specifiersOf(text, fileName = 'x.ts') {
  const sf = createSourceFile(fileName, text, PARSE, false, scriptKind(fileName));
  const out = [];
  const add = (node, kind, spec, typeOnly) =>
    out.push({ kind, spec, typeOnly, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });

  const walk = (node) => {
    if (isImportDeclaration(node)) {
      add(node, node.importClause ? 'import' : 'side-effect', literal(node.moduleSpecifier), isTypeOnlyImport(node));
    } else if (isExportDeclaration(node) && node.moduleSpecifier) {
      add(node, 're-export', literal(node.moduleSpecifier), isTypeOnlyImport(node));
    } else if (isImportEqualsDeclaration(node) && isExternalModuleReference(node.moduleReference)) {
      add(node, 'require', literal(node.moduleReference.expression), node.isTypeOnly);
    } else if (isImportTypeNode(node)) {
      const arg = node.argument;
      add(node, 'type-query', isLiteralTypeNode(arg) ? literal(arg.literal) : null, true);
    } else if (isCallExpression(node)) {
      if (node.expression.kind === SyntaxKind.ImportKeyword) add(node, 'dynamic', literal(node.arguments[0]), false);
      else if (isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1) {
        add(node, 'require', literal(node.arguments[0]), false);
      }
    } else if (isNewExpression(node) && isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.length === 2 && isPropertyAccessExpression(node.arguments[1])
      && isMetaProperty(node.arguments[1].expression) && node.arguments[1].name.text === 'url') {
      add(node, 'worker-url', literal(node.arguments[0]), false);
    }
    node.forEachChild(walk);
  };
  sf.forEachChild(walk);
  return out;
}

/** Only the entries that load code at run time — what a gate about run-time dependency reads. */
export const runtimeSpecifiersOf = (text, fileName) => specifiersOf(text, fileName).filter((s) => !s.typeOnly);
