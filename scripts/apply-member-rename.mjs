// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PHASE 7 OF THE ENGLISH PLAN — published MEMBERS, renamed by TYPE and not by name (ADR-0230, issue #206).
 *
 * Phase 2 renamed NAMES from a map (`apply-rename.mjs`): a public name is one binding in one module, so its spelling is
 * enough to find it. A member is not: 📏 `nome` is a member of six unrelated types, `rotulo` of eight. Renaming by spelling
 * renames all of them, including one that mirrors a foreign API or is the shape of something stored on a child's machine.
 * So an entry here is `"<file> <Type>.<member>"` and the rename is asked of TypeScript's language service, which follows
 * the member through the TYPE — into object literals, shorthand properties, destructuring and accesses — in `app/js` AND
 * `tests/` (the tsconfig includes both, with `allowJs`).
 *
 * 🔴 IT REFUSES, BEFORE WRITING, A RENAME THAT DRAGS A DECLARATION THE MAP DID NOT NAME. The language service renames
 * related symbols together: a member of a union, of a type that is spread into another, of an interface a class
 * implements. Each of those is a DECLARATION it touches; every one must be an entry of the map with the same new name,
 * or the run stops and names it. A rename that quietly reaches an excluded type (ADR-0230 §3) is the failure this guards.
 *
 * ⚠️ What the language service cannot follow is an object it cannot type — plain JS built as `any`, a key computed at
 * runtime. That is the silent case of ADR-0230, and the gate that makes it loud lives in the tests, not here.
 *
 * Usage:
 *   node scripts/apply-member-rename.mjs --list <layer>    the Portuguese members of a layer, as map keys
 *   node scripts/apply-member-rename.mjs --apply <layer>   renames that layer's entries and records it as applied
 *   node scripts/apply-member-rename.mjs --table [layer]   the old→new table, printed from the map (never typed twice)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { words, readLists, EXCEPTIONS } from './language-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAP = join(ROOT, 'scripts/member-rename-map.json');
const APP = join(ROOT, 'app/js');
const readMap = () => JSON.parse(readFileSync(MAP, 'utf8'));

/** The layer a module belongs to is its first folder under `app/js`. */
const layerOf = (rel) => rel.split('/')[0];
const relOf = (abs) => relative(APP, abs).split('\\').join('/');

/**
 * A member declaration: a property or method signature or declaration, a get or set accessor, an enum member.
 *
 * ⚠️ ONE LOOKUP OF THE NODE'S KIND, and not seven `ts.isX` calls — each `ts.isX` is exactly `node.kind === SyntaxKind.X`,
 * so the set says the same thing. The difference is the cost: the gates call this on EVERY node of ~560 files, and under
 * Vitest each `ts.isX` is a read through a transformed module. 📏 Measured inside a Vitest worker on 2026-09-25: the walk
 * took ~590 ms with the seven calls and ~50 ms with the set.
 */
const MEMBER_KINDS = new Set([
  ts.SyntaxKind.PropertySignature, ts.SyntaxKind.PropertyDeclaration, ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.MethodDeclaration, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor, ts.SyntaxKind.EnumMember,
]);
export const isMember = (n) => MEMBER_KINDS.has(n.kind);

/** The parse the gates below ask for: JSDoc is left out, because every walk here goes by `forEachChild`, which never enters
 *  a JSDoc node — so a name inside a comment was never read, and parsing it was work nobody used. */
const PARSE = { languageVersion: ts.ScriptTarget.Latest, jsDocParsingMode: ts.JSDocParsingMode.ParseNone };

/**
 * The name a member is filed under: the nearest named type-like declaration around it — interface, type alias, class,
 * enum, or the variable whose annotation holds an anonymous object type. A member nested in an anonymous type inside a
 * member is filed under the outer member's path (`Outer.inner.member`), so two identical spellings never share a key.
 */
export function keyOf(node, rel) {
  const path = [];
  for (let n = node; n; n = n.parent) {
    if (isMember(n) && n.name && ts.isIdentifier(n.name)) path.unshift(n.name.text);
    else if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)
      || ts.isEnumDeclaration(n) || ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name && ts.isIdentifier(n.name)) {
      path.unshift(n.name.text);
      break;
    }
  }
  return `${rel} ${path.join('.')}`;
}

function languageService() {
  const cfg = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const files = new Map(cfg.fileNames.map((f) => [f.split('\\').join('/'), 0]));
  const host = {
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: (f) => String(files.get(f) ?? 0),
    getScriptSnapshot: (f) => (ts.sys.fileExists(f) ? ts.ScriptSnapshot.fromString(ts.sys.readFile(f)) : undefined),
    getCurrentDirectory: () => ROOT,
    getCompilationSettings: () => cfg.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists, readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists, getDirectories: ts.sys.getDirectories,
  };
  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

/** Every Portuguese member DECLARED in the modules of one layer, as the key the map files it under. */
function portugueseMembersOf(layer, service) {
  const lists = readLists();
  const out = [];
  for (const sf of service.getProgram().getSourceFiles()) {
    const abs = sf.fileName;
    if (!abs.startsWith(APP.split('\\').join('/'))) continue;
    const rel = relOf(abs);
    if (layerOf(rel) !== layer || EXCEPTIONS.some(([p]) => `app/js/${rel}`.startsWith(p))) continue;
    const walk = (n) => {
      if (isMember(n) && n.name && ts.isIdentifier(n.name) && words(n.name.text).some((w) => lists.pt.has(w))) out.push(keyOf(n, rel));
      n.forEachChild(walk);
    };
    walk(sf);
  }
  return [...new Set(out)].sort();
}

/** The declaration node a map key names, or null. */
function findDeclaration(program, key) {
  const [rel] = key.split(' ');
  const sf = program.getSourceFile(join(APP, rel).split('\\').join('/'));
  if (!sf) return null;
  let found = null;
  const walk = (n) => {
    if (!found && isMember(n) && n.name && keyOf(n, rel) === key) found = n;
    n.forEachChild(walk);
  };
  walk(sf);
  return found;
}

/** The member declaration a rename location sits on, if it is one. */
function declarationAt(sf, pos) {
  let hit = null;
  const walk = (n) => {
    if (pos >= n.getStart(sf) && pos < n.getEnd()) {
      if (isMember(n) && n.name && n.name.getStart(sf) === pos) hit = n;
      n.forEachChild(walk);
    }
  };
  walk(sf);
  return hit;
}

/**
 * The key an entry has AFTER the map ran: every segment of its path translated by the map, not only the last one.
 * 📏 `input/touch.ts TouchCtx.acoesDoJogo.acao` lives at `TouchCtx.gameActions.action` once applied — its parent moved too.
 */
function renamedKey(key, to, everyEntry) {
  const [rel, path] = key.split(' ');
  const segs = path.split('.');
  const out = [segs[0]];
  for (let i = 1; i < segs.length; i++) {
    const oldPrefix = `${rel} ${segs.slice(0, i + 1).join('.')}`;
    out.push(i === segs.length - 1 ? to : (everyEntry[oldPrefix] ?? segs[i]));
  }
  return `${rel} ${out.join('.')}`;
}

function apply(layer) {
  const map = readMap();
  const entries = Object.entries(map.layers[layer] ?? {});
  if (!entries.length) throw new Error(`no entries for layer ${layer}`);
  const service = languageService();
  const program = service.getProgram();
  const edits = new Map(); // file -> Map(start -> {end, text})
  const refusals = [];
  const everyEntry = Object.assign({}, ...Object.values(map.layers));
  for (const [key, to] of entries) {
    const decl = findDeclaration(program, key);
    // Already applied: the declaration answers to the NEW name at the same path. A layer can be re-run after an entry is
    // added to it — which is how a mirror found late joins the layer it mirrors.
    if (!decl && findDeclaration(program, renamedKey(key, to, everyEntry))) continue;
    if (!decl) { refusals.push(`${key}: no such member declaration`); continue; }
    const file = decl.getSourceFile().fileName;
    const locs = service.findRenameLocations(file, decl.name.getStart(), false, false, { providePrefixAndSuffixTextForRename: true }) ?? [];
    if (!locs.length) { refusals.push(`${key}: the language service found nothing to rename`); continue; }
    for (const l of locs) {
      const sf = program.getSourceFile(l.fileName);
      const other = sf && declarationAt(sf, l.textSpan.start);
      if (other && sf.fileName.startsWith(APP.split('\\').join('/'))) {
        const otherKey = keyOf(other, relOf(sf.fileName));
        if (otherKey !== key && everyEntry[otherKey] !== to) {
          refusals.push(`${key} -> ${to} also renames ${otherKey}, which the map ${everyEntry[otherKey] ? `sends to ${everyEntry[otherKey]}` : 'does not name'}`);
        }
      }
      const perFile = edits.get(l.fileName) ?? edits.set(l.fileName, new Map()).get(l.fileName);
      perFile.set(l.textSpan.start, { end: l.textSpan.start + l.textSpan.length, text: `${l.prefixText ?? ''}${to}${l.suffixText ?? ''}` });
    }
  }
  if (refusals.length) {
    console.error('REFUSED (nothing was written):');
    for (const r of [...new Set(refusals)]) console.error('  ' + r);
    process.exit(3);
  }
  let total = 0;
  for (const [file, perFile] of edits) {
    let text = readFileSync(file, 'utf8');
    for (const [start, { end, text: to }] of [...perFile].sort((a, b) => b[0] - a[0])) text = text.slice(0, start) + to + text.slice(end);
    writeFileSync(file, text, 'utf8');
    total += perFile.size;
    console.log(`${relative(ROOT, file).split('\\').join('/')}: ${perFile.size}`);
  }
  if (!map.layersApplied.includes(layer)) map.layersApplied.push(layer);
  writeFileSync(MAP, JSON.stringify(map, null, 2) + '\n', 'utf8');
  console.log(`occurrences renamed: ${total}`);
}

/**
 * THE SILENT CASE, MADE LOUD (ADR-0230 §4): every place an applied OLD member name still sits in a member position — an
 * object key, a shorthand, a `.x` access, a destructured property, a string literal used as a type — in `app/js` or
 * `tests/`. The language service follows a member through its TYPE; an object nothing types (a JS helper in a test that
 * builds `{ t, luminancias }`) is invisible to it, and the module then reads `undefined` without failing anything.
 *
 * Three things are not leftovers, each for a stated reason:
 *   · an old spelling that is STILL DECLARED as a member somewhere (a layer not yet applied, or an excluded stored shape):
 *     its accesses may be the other type's. The check tightens by itself as the layers land.
 *   · the object passed as the params of a `t(…)` call: its keys are interpolation keys, written in three dictionaries.
 *   · a (file, name) the map lists under `dataKeys`: a key of DATA, not a member name — the Dev's
 *     typographic catalogue calls a family `familia` (a JSON not to be edited), and the pause's action ids (`tipo`) are the
 *     `data-act` values games read. Listed one file at a time, with the reason, so an exemption can never cover a module
 *     that did not ask for it.
 */
/**
 * Is this string literal type a MEMBER NAME, and not a value? `Pick<T, 'x'>`, `Omit<T, 'x'>` and `T['x']` name a member;
 * `kind: 'palavra' | 'item'` is a union of VALUES, which phase 7 does not rename. 📏 Measured on the platform layer: without
 * this, the gate called the value `'palavra'` of `HeardCommand.kind` a leftover of the member `palavra`.
 */
function namesAMember(lit) {
  let n = lit.parent;
  while (n && ts.isUnionTypeNode(n)) n = n.parent; // Pick<T, 'a' | 'b'>
  if (n && ts.isIndexedAccessTypeNode(n)) return true;
  return !!n && ts.isTypeReferenceNode(n) && /^(Pick|Omit)$/.test(n.typeName.getText()) && n.typeArguments?.[0] !== lit;
}

export function leftovers() {
  const map = readMap();
  const applied = Object.assign({}, ...map.layersApplied.map((l) => map.layers[l] ?? {}));
  const oldNames = new Set(Object.keys(applied).map((k) => k.split('.').at(-1)));
  const cfg = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  // `scripts/` is outside the tsconfig, so outside the language service — and the delivery `bin` lives there. 📏 Measured on
  // the platform layer: its report rows and its `fetch` option were invisible to both the rename and this gate. The tool
  // and the map themselves are left out: they carry the old names as DATA, by design.
  const scripts = ts.sys.readDirectory(join(ROOT, 'scripts'), ['.mjs', '.js'], undefined, undefined, 1)
    .filter((f) => !/apply-member-rename|\.tmp\./.test(f));
  // Parents are kept (`namesAMember` and `isTParams` climb to them); JSDoc is not (see `PARSE`).
  const sources = [...cfg.fileNames, ...scripts].filter((f) => !f.includes('/app/js/i18n/'))
    .map((f) => ts.createSourceFile(f, readFileSync(f, 'utf8'), PARSE, true, f.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS));
  // ⚠️ Bound once, for the reason `isMember` gives: this walk runs on every node of every file.
  const {
    isIdentifier, isCallExpression, isPropertyAssignment, isShorthandPropertyAssignment, isMethodDeclaration,
    isObjectLiteralExpression, isPropertyAccessExpression, isBindingElement, isObjectBindingPattern, isLiteralTypeNode,
    isStringLiteral, isBinaryExpression, SyntaxKind,
  } = ts;
  const stillDeclared = new Set();
  for (const sf of sources) (function walk(n) {
    if (isMember(n) && n.name && isIdentifier(n.name) && oldNames.has(n.name.text)) stillDeclared.add(n.name.text);
    n.forEachChild(walk);
  })(sf);
  const watched = new Set([...oldNames].filter((n) => !stillDeclared.has(n)));
  const isTParams = (lit) => isCallExpression(lit.parent) && lit.parent.arguments[1] === lit
    && /(^|\.)t$/.test(lit.parent.expression.getText());
  const out = [];
  for (const sf of sources) (function walk(n) {
    let name = null, kind = '';
    if ((isPropertyAssignment(n) || isShorthandPropertyAssignment(n) || isMethodDeclaration(n)) && n.name && isIdentifier(n.name)
      && !(isObjectLiteralExpression(n.parent) && isTParams(n.parent))) { name = n.name.text; kind = 'object key'; }
    else if (isPropertyAccessExpression(n)) { name = n.name.text; kind = 'access'; }
    else if (isBindingElement(n) && n.propertyName && isIdentifier(n.propertyName)) { name = n.propertyName.text; kind = 'destructured'; }
    else if (isBindingElement(n) && !n.propertyName && isIdentifier(n.name) && isObjectBindingPattern(n.parent)) { name = n.name.text; kind = 'destructured'; }
    else if (isLiteralTypeNode(n) && isStringLiteral(n.literal) && namesAMember(n)) { name = n.literal.text; kind = 'string in a type'; }
    // `'x' in obj` names a member as a STRING. 📏 Measured on the ui layer: `'contentor' in piece` survived the language
    // service and this gate, and only the type checker noticed — because the narrowing it did stopped working.
    else if (isBinaryExpression(n) && n.operatorToken.kind === SyntaxKind.InKeyword && isStringLiteral(n.left)) { name = n.left.text; kind = 'string in an `in` check'; }
    // The file's path only where a name was found — it was built for every node, and nodes are ~80 thousand.
    const file = name && watched.has(name) ? relative(ROOT, sf.fileName).split('\\').join('/') : null;
    if (file && !map.dataKeys?.[`${file} ${name}`]) {
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      out.push({ file, line: line + 1, name, kind });
    }
    n.forEachChild(walk);
  })(sf);
  return out;
}

/**
 * Where an applied OLD name is still DECLARED as a member, and whether that declaration is OPTIONAL — the list to read
 * after each layer, because the gate above deliberately does not police a spelling that is still declared.
 * 📏 Measured on the platform layer: `ui/voice-settings` declared its own view of the voice engine with every member
 * optional; the renamed engine stayed assignable to it, `tsc` was clean, and the panel saw no voices. An optional member
 * with an old name is the first place to look.
 */
export function stillDeclared() {
  const map = readMap();
  const applied = Object.assign({}, ...map.layersApplied.map((l) => map.layers[l] ?? {}));
  const oldNames = new Set(Object.keys(applied).map((k) => k.split('.').at(-1)));
  const cfg = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} });
  const out = [];
  for (const f of cfg.fileNames.filter((x) => x.includes('/app/js/'))) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    (function walk(n) {
      if (isMember(n) && n.name && ts.isIdentifier(n.name) && oldNames.has(n.name.text)) {
        const key = keyOf(n, relOf(f));
        out.push({ key, optional: !!n.questionToken, excluded: !!map.excluded?.[key] });
      }
      n.forEachChild(walk);
    })(sf);
  }
  return out;
}

function table(layer) {
  const map = readMap();
  const layers = layer ? [layer] : Object.keys(map.layers);
  console.log('| module | type | old member | new member |\n|---|---|---|---|');
  for (const l of layers) for (const [key, to] of Object.entries(map.layers[l] ?? {})) {
    const [rel, path] = key.split(' ');
    const parts = path.split('.');
    console.log(`| \`${rel.replace(/\.ts$/, '.js')}\` | \`${parts.slice(0, -1).join('.')}\` | \`${parts.at(-1)}\` | \`${to}\` |`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, arg] = process.argv.slice(2);
  if (mode === '--list') {
    const map = readMap();
    for (const k of portugueseMembersOf(arg, languageService())) {
      const note = map.excluded?.[k] ? `   (excluded: ${map.excluded[k]})` : map.layers[arg]?.[k] ? `   -> ${map.layers[arg][k]}` : '';
      console.log(k + note);
    }
  } else if (mode === '--apply') apply(arg);
  else if (mode === '--table') table(arg);
  else if (mode === '--leftovers') for (const l of leftovers()) console.log(`${l.file}:${l.line}  ${l.name}  (${l.kind})`);
  else if (mode === '--declared') for (const d of stillDeclared()) console.log(`${d.optional ? 'OPTIONAL ' : '         '}${d.key}${d.excluded ? '   (excluded)' : ''}`);
  else { console.error('usage: --list <layer> | --apply <layer> | --table [layer]'); process.exit(2); }
}
