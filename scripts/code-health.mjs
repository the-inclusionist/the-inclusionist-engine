#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE SEVEN MEASURES OF CODE HEALTH, AND THE BASELINE THEY RATCHET AGAINST (ADR-0221, ADR-0232, issues #203 and #207).
//
// 🔴 WHY THIS EXISTS. The engine gates the language, the DIRECTION of its dependencies (ADR-0173), its public surface, its
// exports without a consumer and the pointers its records make — and gates NOTHING about size, complexity or coupling. The
// layer gate asks which way an import points, never how many there are: a module may import 77 things downward and pass green.
// 📏 And one did: `boot/create-game.ts` reached 2185 lines — 11% of all the engine's code in one file — with 330 decision nodes
// and fan-out 77, while every gate stayed green. What nothing measures comes back.
//
// ⚠️ NOTHING HERE IS A SCORE, and that is the decision and not a limitation. The paper these dimensions come from
// (arXiv:2409.15152) measured its own raters: maintainability has ICC 0.52 among ten experts with ten years each, and r = 0.30
// against their model. A number presented as quality would be obeyed more than it deserves. The gate built on this file answers
// one question — «did anything get worse?» — and the answer is yes or no.
//
// ⚠️ AND COHESION IS NOT HERE, on purpose. LCOM and its family assume classes with fields; this tree is modules of functions,
// and a number that means nothing is worse than none, because it would be obeyed anyway. What stands in its place is the
// co-change table of `docs/ARCHITECTURE.md` §3.3 — files edited in the same commit are the honest evidence of what belongs
// together, and a long row there is a hypothesis about a missing abstraction.
//
// Use: `node scripts/code-health.mjs` prints the tree's state · `--write` rewrites the baseline, which is a DECISION and not a
// routine: a baseline rewritten to make a red build green is the ratchet being unscrewed.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
// The one reader of module specifiers, shared with the import gates: every form that loads code, and one «type-only».
import { runtimeSpecifiersOf } from './lib/module-specifiers.mjs';

const ROOT = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
export const BASELINE = 'docs/6-DevOps-SRE/code-health.json';
const posix = (p) => p.split('\\').join('/');

/**
 * ⚠️ THE EXEMPTIONS ARE TWO, EACH WITH ITS REASON, AND THERE ARE NO OTHERS (ADR-0221). An exemption list that grows on demand
 * is how a gate stops being one.
 */
export const EXEMPT = {
  // The composition root wires everything, which is its job (ADR-0173) — so fan-out is not its debt. Its LINES, BRANCHES and
  // DEPTH are, and it is not exempt on those: 2185 lines and 330 decision nodes are logic, not wiring.
  // 📌 And it is exempt from `statefulEdges` for the same reason (ADR-0232 point 4): constructing the state everything else
  // receives is what a composition root is for.
  'boot/create-game.ts': ['fanOut', 'statefulEdges'],
  // The three dictionaries are DATA. 621 lines of sentences a child reads is not complexity, and splitting them would only
  // make a translator open three files instead of one.
  'i18n/pt.ts': ['*'], 'i18n/en.ts': ['*'], 'i18n/es.ts': ['*'],
};

export const MEASURES = ['codeLines', 'decisionNodes', 'maxDepth', 'fanOut', 'globalReach', 'worstFunction', 'statefulEdges'];

/*
 * 🔴 THE FIFTH MEASURE IS WHAT A MODULE REACHES, and it is here because the other four did not see it (ADR-0221, step 7d,
 * issue #203). The article lists DEPENDENCY INJECTION among the dimensions it weighs, and this engine practises it — the
 * host is injected (ADR-0178), the clock is injected, `fetch` is injected. The defect that COMES BACK is the direct reach:
 * a row labeller reading `CSS.escape` was exactly that.
 *
 * ⚠️ AND THE LAYER GATE DOES NOT CATCH IT, which is why this measure exists: `dependencies-point-downward` checks IMPORTS,
 * and a module that imports nothing and touches `document` passes green — even in `core/`, the layer ADR-0173 describes
 * as what the engine IS, without a browser.
 */
const BROWSER_GLOBALS = [
  'document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'performance', 'fetch', 'CSS',
  /*
   * 📌 ADR-0232 point 2 names the root as the only module that touches the browser, so the list has to see every door to
   * it the tree actually uses: `globalThis` (a `(globalThis as …).document` reaches the document as surely as the bare
   * name), the frame clock, the cache and worker APIs, WebAssembly, audio and speech synthesis, the page's address and
   * `crypto`. A name missing here is a reach the ratchet cannot see.
   */
  'globalThis', 'requestAnimationFrame', 'cancelAnimationFrame', 'caches', 'Worker', 'WebAssembly',
  'AudioContext', 'webkitAudioContext', 'location', 'SpeechSynthesisUtterance', 'speechSynthesis', 'crypto',
];

/*
 * ⚠️ A NAME IS THE GLOBAL ONLY WHEN NO ENCLOSING SCOPE DECLARES IT. A parameter called `document`, or a local `const window`
 * built from what was injected, is the OPPOSITE of the defect — it is the injection ADR-0232 asks for — and counting it
 * would punish exactly the shape the measure exists to cause. The same resolution tells a module-level binding from a
 * local that shadows it, which is what the stateful test below needs.
 */
const FUNCTION_LIKE = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)
  || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n);

/** Every identifier a binding name declares — `a`, `{ a, b: [c] }`, `[d, ...e]`. */
const bindingNames = (name, out = []) => {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
  return out;
};

/** The names a statement list declares at its own level (let/const/var, functions, classes, enums, imports). */
const namesOfStatements = (statements) => {
  const out = [];
  for (const st of statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bindingNames(d.name, out);
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) out.push(st.name.text);
    else if (ts.isImportDeclaration(st) && st.importClause) {
      const c = st.importClause;
      if (c.name) out.push(c.name.text);
      if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) out.push(c.namedBindings.name.text);
      else if (c.namedBindings) for (const e of c.namedBindings.elements) out.push(e.name.text);
    }
  }
  return out;
};

/** The names a scope-making node declares, or null when the node makes no scope. */
const scopeNames = (n) => {
  if (ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n)) return namesOfStatements(n.statements);
  if (ts.isCaseBlock(n)) return n.clauses.flatMap((c) => namesOfStatements(c.statements));
  if (FUNCTION_LIKE(n)) {
    const out = n.parameters.flatMap((p) => bindingNames(p.name));
    if (ts.isFunctionExpression(n) && n.name) out.push(n.name.text);
    return out;
  }
  if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) && n.initializer
    && ts.isVariableDeclarationList(n.initializer)) return n.initializer.declarations.flatMap((d) => bindingNames(d.name));
  if (ts.isCatchClause(n) && n.variableDeclaration) return bindingNames(n.variableDeclaration.name);
  if (ts.isClassExpression(n) && n.name) return [n.name.text];
  return null;
};

/** The node whose scope declares this identifier's name, or undefined when it resolves to a global. */
const declaringScope = (id) => {
  for (let n = id.parent; n; n = n.parent) {
    const names = scopeNames(n);
    if (names && names.includes(id.text)) return n;
  }
  return undefined;
};

/** Is this identifier written where a TYPE is, or where a NAME is declared or read as a member? Neither reaches anything. */
const isTypeOrNamePosition = (id) => {
  const p = id.parent;
  if (p && 'name' in p && p.name === id && !ts.isShorthandPropertyAssignment(p)) return true; // `o.document`, `{ window: … }`, `const x`
  if (p && ts.isBindingElement(p) && p.propertyName === id) return true; // `const { document: d } = …`
  if (p && ts.isQualifiedName(p) && p.right === id) return true;
  for (let n = p; n && !ts.isStatement(n) && !ts.isSourceFile(n); n = n.parent) if (ts.isTypeNode(n)) return true;
  return false;
};

/*
 * 🔴 WHAT MAKES A MODULE STATEFUL (ADR-0232 point 4), read by the parser so a reviewer can argue with each line of it. A
 * module holds state when, at MODULE level, it has:
 *   · a `let` or `var` — a binding that changes after import;
 *   · a `const` that the module's own code MUTATES — `.set/.add/.delete/.clear/.push/…`, an assignment or `++` through
 *     it (`x.k = …`, `x[k] = …`), `delete x.k`, or `Object.assign(x, …)`. A frozen table that nobody writes is not state;
 *   · a `const` built by a `createX(…)` call at import — ADR-0038's D13 names `createX()` as the shape of a module that
 *     keeps state, so calling one at module level is a SINGLETON (`core/rng`'s `sharedRng`);
 *   · or a browser global reached (`globalReach > 0`), because the browser is the state it reads.
 * ⚠️ What the parser cannot see: a const exported and mutated by ANOTHER module, or aliased before it is mutated. That is
 * why the set is written into the baseline BY NAME — a misclassification is a line in a diff, reviewed, never trusted.
 */
const MUTATORS = new Set(['set', 'add', 'delete', 'clear', 'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
const isAssignmentOperator = (k) => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;

/** Is this reference the root of a write — `x.k = …`, `x[k]++`, `delete x.k`, `x.push(…)`, `Object.assign(x, …)`? */
const isMutatedThrough = (id) => {
  let top = id;
  while (top.parent && (ts.isPropertyAccessExpression(top.parent) || ts.isElementAccessExpression(top.parent))
    && top.parent.expression === top) top = top.parent;
  const p = top.parent;
  if (!p) return false;
  if (top !== id && ts.isBinaryExpression(p) && p.left === top && isAssignmentOperator(p.operatorToken.kind)) return true;
  if (top !== id && (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p))
    && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(p.operator)) return true;
  if (top !== id && ts.isDeleteExpression(p)) return true;
  if (ts.isCallExpression(p) && p.expression === top && ts.isPropertyAccessExpression(top) && top !== id
    && MUTATORS.has(top.name.text)) return true;
  if (ts.isCallExpression(p) && p.arguments[0] === top && p.expression.getText() === 'Object.assign') return true;
  return false;
};

/** Is this module exempt from this measure? */
export const isExempt = (mod, measure) => {
  const e = EXEMPT[mod];
  return !!e && (e.includes('*') || e.includes(measure));
};

/*
 * WHAT EACH MEASURE IS, defined by what the parser can see rather than by its name — the names are borrowed and the definitions
 * have to be ours:
 *   · codeLines     — lines that are neither blank nor a comment. Comments are 55% of some files here and are not complexity.
 *   · decisionNodes — `if`, the four loops, `switch`, `catch` and the ternary: every place a reader has to hold a branch.
 *   · maxDepth      — the deepest nesting of those. 📏 Depth 11 exists in this tree, in `input/gamepad.ts`.
 *   · fanOut        — DISTINCT relative imports BY VALUE (ADR-0232 point 3). A package import is not coupling inside this
 *                     tree, and a type-only import is not coupling either: it is a dependence on a contract, erased at
 *                     build, and it is what injection asks a module to depend on.
 *                     ⚠️ EVERY FORM THAT LOADS CODE is an edge — `import … from`, `import '…'`, `export … from`, a lazy
 *                     `import('…')`, `require('…')` and a worker's `new URL('…', import.meta.url)` — read by the same parser
 *                     the import gates use (`scripts/lib/module-specifiers.mjs`). A lazy import defers WHEN the module
 *                     loads, not WHETHER this one depends on it; the reachability count of ADR-0228 followed them on
 *                     purpose. A non-literal `import(url)` names no module of this tree and is not counted.
 *   · statefulEdges — DISTINCT value imports of a module that holds state (ADR-0232 point 4), in every form fan-out reads:
 *                     the two are one edge set. Computed over the tree in `measureTree`, because it needs to know which
 *                     modules are stateful.
 */

export function measureModule(text) {
  const sf = ts.createSourceFile('m.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let decisionNodes = 0, maxDepth = 0;
  const imports = new Set(runtimeSpecifiersOf(text, 'm.ts').filter((s) => s.spec?.startsWith('.')).map((s) => s.spec));

  const walk = (node, depth) => {
    let d = depth;
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)
      || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isSwitchStatement(node) || ts.isCatchClause(node)
      || ts.isConditionalExpression(node)) {
      d += 1; decisionNodes += 1; maxDepth = Math.max(maxDepth, d);
    }
    node.forEachChild((k) => walk(k, d));
  };
  sf.forEachChild((n) => walk(n, 0));

  /*
   * ⚠️ READ BY THE PARSER AND NOT BY GREP, and the difference is what makes the measure usable: `document` appears in
   * comments, in property names (`o.document`), in parameters (`doc = document`) and in strings. What counts is a BARE
   * IDENTIFIER that resolves to the global — the rest is prose or injection, which is precisely the opposite of the defect.
   * 📌 The bare global handed over AS A VALUE — a parameter default (`doc = document`) or a port field
   * (`{ storage: localStorage }`) — is read as injection and does not count; `document.body` in the same place does.
   */
  const reached = new Set();
  const look = (node) => {
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.includes(node.text)) {
      const p = node.parent;
      const handedOver = p && (ts.isParameter(p) || ts.isPropertyAssignment(p) || ts.isBindingElement(p)) && p.initializer === node;
      if (!isTypeOrNamePosition(node) && !handedOver && !declaringScope(node)) reached.add(node.text);
    }
    node.forEachChild(look);
  };
  sf.forEachChild(look);

  /*
   * The state this module holds, as `kind name` lines (see "WHAT MAKES A MODULE STATEFUL" above). Only MODULE-level
   * bindings: state inside a factory is per instance, which is the shape ADR-0232 asks for.
   */
  const holds = [];
  const moduleConsts = new Map();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    if (st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)) continue; // an ambient declaration holds nothing
    const isConst = !!(st.declarationList.flags & ts.NodeFlags.Const);
    for (const d of st.declarationList.declarations) {
      if (!isConst) {
        const kind = st.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var';
        for (const n of bindingNames(d.name)) holds.push(`${kind} ${n}`);
        continue;
      }
      let init = d.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)
        || ts.isNonNullExpression(init))) init = init.expression;
      if (ts.isIdentifier(d.name) && init && ts.isCallExpression(init)) {
        const callee = ts.isPropertyAccessExpression(init.expression) ? init.expression.name : init.expression;
        if (ts.isIdentifier(callee) && /^create[A-Z]/.test(callee.text)) { holds.push(`singleton ${d.name.text}`); continue; }
      }
      for (const n of bindingNames(d.name)) moduleConsts.set(n, false);
    }
  }
  const findWrites = (node) => {
    if (ts.isIdentifier(node) && moduleConsts.get(node.text) === false && !isTypeOrNamePosition(node)
      && ts.isSourceFile(declaringScope(node) ?? node) && isMutatedThrough(node)) moduleConsts.set(node.text, true);
    node.forEachChild(findWrites);
  };
  sf.forEachChild(findWrites);
  for (const [n, written] of moduleConsts) if (written) holds.push(`mutated ${n}`);

  /*
   * 🔴 THE CYCLOMATIC COMPLEXITY OF THE WORST FUNCTION, the only measure in this file with a BORROWED threshold instead of
   * one taken from the tree itself: McCabe (1976) proposed 10 per function, and NIST SP 500-235 (Watson & McCabe, 1996)
   * codified it, allowing up to 15 with a written justification. 📌 The Dev asked for a better reference than an invented
   * line ceiling, and the literature has none for file size — it has this one, per FUNCTION.
   *
   * ⚠️ PER FUNCTION, and the branches of a NESTED function do not count for the outer one: a function that returns an
   * object of ten methods is not complex for having them, and adding them up would make every factory in this tree look
   * like its worst module. Many functions are already above the threshold, so this is a RATCHET and not a gate, like
   * everything else here.
   */
  const ehFuncao = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n);
  let worstFunction = 0;
  const porFuncao = (n) => {
    if (ehFuncao(n)) {
      let ramos = 1; // cyclomatic complexity is branches + 1: one path always exists
      const conta = (x) => {
        if (x !== n && ehFuncao(x)) return; // what is inside a nested function is that function's
        if (ts.isIfStatement(x) || ts.isForStatement(x) || ts.isForOfStatement(x) || ts.isForInStatement(x)
          || ts.isWhileStatement(x) || ts.isDoStatement(x) || ts.isCaseClause(x) || ts.isCatchClause(x)
          || ts.isConditionalExpression(x)) ramos += 1;
        if (ts.isBinaryExpression(x) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken].includes(x.operatorToken.kind)) ramos += 1;
        x.forEachChild(conta);
      };
      n.forEachChild(conta);
      worstFunction = Math.max(worstFunction, ramos);
    }
    n.forEachChild(porFuncao);
  };
  sf.forEachChild(porFuncao);

  const codeLines = text.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
  return {
    codeLines, decisionNodes, maxDepth, fanOut: imports.size, globalReach: reached.size, worstFunction,
    imports: [...imports], reached: [...reached].sort(), holds: holds.sort(),
  };
}

/** A module is STATEFUL when it holds state or reaches a browser global (ADR-0232 point 4). */
export const isStateful = (m) => m.holds.length > 0 || m.reached.length > 0;

/** The whole tree: `{ 'core/ring.ts': {codeLines, decisionNodes, maxDepth, fanOut, fanIn} }`, keyed as the portrait keys. */
export function measureTree() {
  /*
   * 🔴 TRACKED **AND** UNTRACKED: a gate once stayed green over a module with Portuguese identifiers because the suite ran
   * while the module was still outside the index. `git ls-files` alone answers «what is already stored», and the question
   * here is «what exists» — a new module must be measured the minute it is born, which is when splitting it is still
   * cheap. `--exclude-standard` keeps `.gitignore` in force, so nothing from `dist/` or temporary files gets in.
   */
  const lista = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  const files = [...new Set([...lista('ls-files', 'app/js'), ...lista('ls-files', '--others', '--exclude-standard', 'app/js')])]
    .filter((f) => f.endsWith('.ts'));
  const raw = new Map();
  for (const f of files) raw.set(f, measureModule(readFileSync(join(ROOT, f), 'utf8')));

  // fan-in is counted here and NEVER limited: `core/dom-query.ts` is 4 lines with fan-in 17, which is the shape to copy.
  // Like fan-out it counts VALUE imports (ADR-0232 point 3): a module read only for its types is not loaded by anyone.
  const key = (f) => f.replace('app/js/', '');
  const targetsOf = (f, m) => [...new Set(m.imports.map((spec) =>
    posix(relative(ROOT, resolve(join(ROOT, dirname(f)), spec))).replace(/\.js$/, '.ts')))];
  const fanIn = new Map();
  for (const [f, m] of raw) for (const target of targetsOf(f, m)) fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
  const stateful = new Set([...raw].filter(([, m]) => isStateful(m)).map(([f]) => f));
  const out = {};
  for (const [f, m] of [...raw].sort(([a], [b]) => a.localeCompare(b))) {
    const intoState = targetsOf(f, m).filter((t) => stateful.has(t)).map(key).sort();
    out[key(f)] = {
      codeLines: m.codeLines, decisionNodes: m.decisionNodes, maxDepth: m.maxDepth, fanOut: m.fanOut,
      globalReach: m.globalReach, worstFunction: m.worstFunction, statefulEdges: intoState.length, fanIn: fanIn.get(f) ?? 0,
      // 📌 WHICH globals, not only how many: a ratchet on a number says it got worse, and this line says what to change to
      // pay it back. It appears only where there is one, so the baseline does not grow with empty lists.
      ...(m.reached.length ? { reached: m.reached } : {}),
      // 📌 And the same for state (ADR-0232 point 5, «the edges listed»): what this module holds, and which stateful
      // modules it imports by value — the list each later phase of issue #207 pays down to zero.
      ...(m.holds.length ? { holds: m.holds } : {}),
      ...(intoState.length ? { statefulImports: intoState } : {}),
    };
  }
  return out;
}

/**
 * The stateful set BY NAME, as the baseline writes it (ADR-0232 point 4): a module holding state or reaching a global.
 * Derived from what `measureTree` records, so the set and the edges can never be computed by two different rules.
 */
export const statefulSet = (modules) => Object.entries(modules)
  .filter(([, m]) => (m.holds?.length ?? 0) > 0 || (m.reached?.length ?? 0) > 0).map(([k]) => k).sort();

/** The p90 of a measure over the modules that are NOT exempt from it — the ceiling a new module is born under. */
export function ceilingFrom(modules) {
  const teto = {};
  for (const measure of MEASURES) {
    /*
     * ⚠️ REACH TO GLOBALS HAS NO p90: the ceiling is ZERO, for a reason that comes neither from the literature nor from a
     * percentile. This engine DECIDED that the host is injected (ADR-0178) and that `core` knows no browser (ADR-0173); a
     * new module that reaches `document` is undoing a decision, not sitting above an average. 📏 The modules that already
     * do are frozen by the ratchet and can only shrink — it is debt, and debt does not become a licence.
     */
    if (measure === 'globalReach') { teto[measure] = 0; continue; }
    /*
     * ⚠️ AND THE WORST FUNCTION HAS NO p90 EITHER, for the opposite reason: the threshold comes from OUTSIDE and has a
     * source — McCabe (1976), codified in NIST SP 500-235, which allows 15 with a written justification. 📌 The Dev asked
     * for a better reference than an invented number, and a p90 of this tree would be exactly that: taking the threshold
     * from the defect itself.
     */
    if (measure === 'worstFunction') { teto[measure] = 10; continue; }
    /*
     * ⚠️ AND A VALUE IMPORT OF STATE HAS NO p90 EITHER: ADR-0232 decided that state arrives by injection, so a new module
     * that imports a stateful one by value is undoing that decision — the ceiling is ZERO, like reach to globals.
     */
    if (measure === 'statefulEdges') { teto[measure] = 0; continue; }
    const vals = Object.entries(modules).filter(([m]) => !isExempt(m, measure)).map(([, v]) => v[measure]).sort((a, b) => a - b);
    teto[measure] = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))];
  }
  return teto;
}

export const readBaseline = () => JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));

/**
 * The ceiling a baseline carries. 🔴 ADR-0221: the p90 is «written into the baseline file with the date it was taken … and it
 * moves only when someone re-measures and says so». `--write` is what records a PAID module, so it keeps the recorded ceiling;
 * only `--remeasure-ceiling` takes a new one. 📏 Before this, every `--write` re-derived it in silence, and between 2026-09-22
 * and 2026-09-23 it moved in ten commits, in both directions — lines 187 → 182 → 187 → 200, depth 4 → 3 — with nobody saying so.
 * A ceiling that follows the tree rises when modules grow or small ones leave, which is the ratchet unscrewing itself.
 */
export function ceilingToRecord(modules, previous, remeasure) {
  if (remeasure || !previous?.ceiling) return { ceiling: ceilingFrom(modules), takenOn: new Date().toISOString().slice(0, 10) };
  /*
   * 📌 A measure NEW to the file (ADR-0232's `statefulEdges`) has no recorded ceiling yet, so it takes its rule's; every
   * measure already recorded keeps what was recorded. The literal in `tests/code-health.node.test.js` is what says so.
   */
  const rule = ceilingFrom(modules);
  const ceiling = Object.fromEntries(MEASURES.map((m) => [m, m in previous.ceiling ? previous.ceiling[m] : rule[m]]));
  return { ceiling, takenOn: previous.takenOn };
}

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'code-health.mjs') {
  const modules = measureTree();
  const remeasure = process.argv.includes('--remeasure-ceiling');
  const { ceiling, takenOn } = ceilingToRecord(modules, readBaseline(), remeasure);
  const nomes = Object.keys(modules);
  const soma = (k) => nomes.reduce((a, n) => a + modules[n][k], 0);

  if (process.argv.includes('--write') || remeasure) {
    writeFileSync(join(ROOT, BASELINE), `${JSON.stringify({
      about: 'ADR-0221 and ADR-0232 — the seven measures of code health. A RATCHET, never a score: '
        + '`tests/code-health.node.test.js` refuses a module that got worse and a new module above the ceiling. Rewrite this '
        + 'file only when a debt is PAID, a module is legitimately split, or the growth BUYS something no measure here can '
        + 'see — and in that third case the commit has to name the purchase and the falsifiable criterion that will show it '
        + 'landed (ADR-0221 point 6: the criterion is the co-change falling, not the number). Rewriting it to green a red '
        + 'build is the ratchet being unscrewed. `stateful` is the set of modules that hold state or reach a browser global '
        + '(ADR-0232 point 4), written BY NAME so that a module entering or leaving it is a line a reviewer reads.',
      takenOn, ceiling, exempt: EXEMPT, stateful: statefulSet(modules), modules,
    }, null, 2)}\n`);
    console.log(`baseline escrita: ${nomes.length} módulos`);
  }
  console.log(`📏 ${nomes.length} módulos · ${soma('codeLines')} linhas de código · ${soma('decisionNodes')} nós de decisão`);
  const outsideRoot = nomes.filter((n) => !isExempt(n, 'statefulEdges'));
  console.log(`   stateful ${statefulSet(modules).length}: ${statefulSet(modules).join(', ')}`);
  console.log(`   value edges into stateful modules outside the root: ${outsideRoot.reduce((a, n) => a + modules[n].statefulEdges, 0)}`);
  console.log(`   tecto (gravado em ${takenOn}): ${MEASURES.map((m) => `${m} ${ceiling[m]}`).join(' · ')}`);
  const today = ceilingFrom(modules);
  const drift = MEASURES.filter((m) => today[m] !== ceiling[m]).map((m) => `${m} ${ceiling[m]} → ${today[m]}`);
  if (drift.length) console.log(`   p90 de hoje difere (só muda com --remeasure-ceiling, e o commit diz porquê): ${drift.join(' · ')}`);
  for (const m of MEASURES) {
    const pior = [...nomes].sort((a, b) => modules[b][m] - modules[a][m]).slice(0, 3);
    console.log(`   ${m.padEnd(14)} ${pior.map((p) => `${p} ${modules[p][m]}`).join(' · ')}`);
  }
}
