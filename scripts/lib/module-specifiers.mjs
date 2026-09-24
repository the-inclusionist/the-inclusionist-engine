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

/**
 * Is this import or re-export declaration TYPE-ONLY? `import type …`, `export type … from`, or named bindings that are ALL
 * marked `type`. A bare `import './x'` and a default or namespace import load the module, so they are value imports.
 */
export const isTypeOnlyImport = (node) => {
  if (ts.isExportDeclaration(node)) {
    if (node.isTypeOnly) return true;
    const c = node.exportClause;
    return !!c && ts.isNamedExports(c) && c.elements.length > 0 && c.elements.every((e) => e.isTypeOnly);
  }
  const c = node.importClause;
  if (!c) return false;
  if (c.isTypeOnly) return true;
  return !c.name && !!c.namedBindings && ts.isNamedImports(c.namedBindings)
    && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly);
};

const literal = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null);

const scriptKind = (fileName) => (/\.tsx$/.test(fileName) ? ts.ScriptKind.TSX
  : /\.(m?js|cjs)$/.test(fileName) ? ts.ScriptKind.JS : /\.jsx$/.test(fileName) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);

/** Every module specifier `text` names (see the header for the shape of an entry). */
export function specifiersOf(text, fileName = 'x.ts') {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  const out = [];
  const add = (node, kind, spec, typeOnly) =>
    out.push({ kind, spec, typeOnly, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });

  const walk = (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node, node.importClause ? 'import' : 'side-effect', literal(node.moduleSpecifier), isTypeOnlyImport(node));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node, 're-export', literal(node.moduleSpecifier), isTypeOnlyImport(node));
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node, 'require', literal(node.moduleReference.expression), node.isTypeOnly);
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      add(node, 'type-query', ts.isLiteralTypeNode(arg) ? literal(arg.literal) : null, true);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node, 'dynamic', literal(node.arguments[0]), false);
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1) {
        add(node, 'require', literal(node.arguments[0]), false);
      }
    } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.length === 2 && ts.isPropertyAccessExpression(node.arguments[1])
      && ts.isMetaProperty(node.arguments[1].expression) && node.arguments[1].name.text === 'url') {
      add(node, 'worker-url', literal(node.arguments[0]), false);
    }
    node.forEachChild(walk);
  };
  sf.forEachChild(walk);
  return out;
}

/** Only the entries that load code at run time — what a gate about run-time dependency reads. */
export const runtimeSpecifiersOf = (text, fileName) => specifiersOf(text, fileName).filter((s) => !s.typeOnly);
