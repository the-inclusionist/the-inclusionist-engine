#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// RENAMES A MODULE'S INTERNAL NAMES — the non-breaking half of the language debt (ADR-0219, issue #202).
//
// ========================= WHY THIS EXISTS BESIDE `apply-rename.mjs` =========================
// That one applies the MAP of phase 2: published names, across the whole tree, layer by layer. This one is for
// what never leaves a file — a local, a parameter, a private helper. Those need no migration note and no
// consumer warning, and they are most of what the language gate still counts.
//
// ========================= THE THREE GUARDS, EACH PAID FOR BY A REAL MISTAKE =========================
//  1. 📌 IT RENAMES BY POSITION, USING THE PARSER. Five hand-rolled scanners in this repository have been
//     wrong about where a construct ends — a glob read as a comment, a regex read as a string, a phrase read
//     as a name, the gate's own dictionary rewritten. Identifier NODES are collected and rewritten from the
//     end backwards, so nothing inside a comment, a string or a regular expression can be touched.
//  2. 🔴 IT REFUSES A NAME THAT IS ALSO A MEMBER, anywhere in `app/js`, or an i18n interpolation key (`{alvo}`).
//     Measured on 2026-09-23, three names cost three reverts: `ui/dom.alvo` IS the key the dictionaries write
//     as `{alvo}`, so renaming the parameter put `'{alvo}: ligado'` on screen; `ui/latch-refusal.transporte`
//     and `render/scene-city.applyCenarioVida` are members of published interfaces that the inventory counts
//     as a parameter and a declaration. Renaming a member is phase 7, which is a breaking release.
//     ⚠️ Deliberately over-conservative: a local `jogador` is skipped because some interface elsewhere has
//     that member. Skipping a safe rename costs one line of debt; taking an unsafe one costs a revert.
//  3. 🔴 IT REFUSES A TARGET NAME THE FILE ALREADY HAS. The first run on `boot/create-game` chose 22 names that
//     were already imported there, produced duplicate bindings, and was found by the compiler AFTER the file
//     was broken. Now every identifier in the file is collected first and a collision is REPORTED BY NAME
//     before a single byte is written.
//
// Usage:
//   node scripts/rename-internals.mjs --list <file...>        prints the safe names of each file
//   node scripts/rename-internals.mjs --apply <map.json>      applies { "<file>": { "<from>": "<to>" } }
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { EXCEPTIONS } from './language-inventory.mjs';

const APP = 'app/js';

/*
 * 🔴 THE SAME TREES THE LANGUAGE GATE EXCLUDES, AND THE LIST IS IMPORTED RATHER THAN COPIED. Measured on 2026-09-23: this
 * tool walked every file under `app/js` and so offered names from `educational/`, which the inventory excludes by decision
 * (ADR-0032) — and one of the names it offered, `corDoSegmento`, is PUBLISHED. Renaming it emptied a published name out of
 * a commit that called itself internal, and three gates went red at once. A tool that proposes work the gate beside it does
 * not measure will keep proposing it; a second copy of the list would drift, which is how this repository's own dictionary
 * got rewritten in English once.
 *
 * ⚠️ IT FILTERS THE OFFER AND NEVER THE SCAN. `everyTsFile` also feeds guard 2, which asks whether a name is a member
 * ANYWHERE in `app/js` — a member declared under `educational/` has to keep blocking a rename in `ui/`, so narrowing the
 * walk would quietly widen what this tool is willing to touch. Excluding on the way out is safe; excluding on the way in
 * is a hole.
 */
const isExcluded = (file) => {
  const p = file.split('\\').join('/');
  return EXCEPTIONS.some(([prefix]) => p.startsWith(prefix));
};
const words = JSON.parse(readFileSync('scripts/word-lists.json', 'utf8'));
const PORTUGUESE = new Set(words.portuguese);
const tokens = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
const isPortuguese = (n) => tokens(n).some((w) => PORTUGUESE.has(w));

function everyTsFile(dir = APP, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) everyTsFile(p, out);
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

const parse = (f) => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);

/** Every name used as a MEMBER anywhere, plus every i18n interpolation key — guard 2's subject. */
function namesThatArePhase7() {
  const out = new Set();
  for (const f of everyTsFile()) {
    const text = readFileSync(f, 'utf8');
    const src = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true);
    const walk = (node) => {
      if ((ts.isPropertySignature(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)
        || ts.isMethodSignature(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node)
        || ts.isGetAccessor(node) || ts.isSetAccessor(node)) && node.name && ts.isIdentifier(node.name)) out.add(node.name.text);
      node.forEachChild(walk);
    };
    src.forEachChild(walk);
    for (const m of text.matchAll(/\{(\w+)\}/g)) out.add(m[1]);
  }
  return out;
}

function safeNamesOf(file, phase7) {
  const src = parse(file);
  const seen = new Set();
  const out = [];
  const push = (name) => {
    if (!isPortuguese(name) || seen.has(name) || phase7.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  const walk = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) push(node.name.text);
    else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) push(node.name.text);
    else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) push(node.name.text);
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) push(node.name.text);
    node.forEachChild(walk);
  };
  src.forEachChild(walk);
  return out.sort();
}

function apply(file, map) {
  const text = readFileSync(file, 'utf8');
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const present = new Set();
  (function scan(n) { if (ts.isIdentifier(n)) present.add(n.text); n.forEachChild(scan); })(src);
  const clash = Object.entries(map).filter(([from, to]) => present.has(to) && from !== to);
  if (clash.length) return { clash: clash.map(([f, t]) => `${f}->${t}`) };
  const edits = [];
  (function walk(node) {
    if (ts.isIdentifier(node) && Object.hasOwn(map, node.text)) edits.push([node.getStart(src), node.getEnd(), map[node.text]]);
    node.forEachChild(walk);
  })(src);
  edits.sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [a, b, to] of edits) out = out.slice(0, a) + to + out.slice(b);
  writeFileSync(file, out, 'utf8');
  return { renamed: edits.length };
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === '--list') {
  const phase7 = namesThatArePhase7();
  for (const f of rest) {
    if (isExcluded(f)) { console.log(`\n${f}: OUTSIDE the language measurement — this file is not offered.`); continue; }
    const names = safeNamesOf(f, phase7);
    console.log(`\n${f} (${names.length}): ${names.join('  ')}`);
  }
} else if (mode === '--apply') {
  const jobs = JSON.parse(readFileSync(rest[0], 'utf8'));
  /*
   * ⚠️ EVERY FILE IS CHECKED BEFORE A SINGLE ONE IS WRITTEN. Applying in order and stopping at the first clash left the
   * batch HALF DONE — half renamed, half not, and the next fix hitting guard 3 again because of what had already landed.
   * A batch is one decision: it goes in whole, or it does not go in.
   */
  const clashes = [];
  for (const [file, map] of Object.entries(jobs)) {
    const src = parse(file);
    const present = new Set();
    (function scan(n) { if (ts.isIdentifier(n)) present.add(n.text); n.forEachChild(scan); })(src);
    for (const [from, to] of Object.entries(map)) if (present.has(to) && from !== to) clashes.push(`${file}: ${from}->${to}`);
  }
  if (clashes.length) { console.error(`CLASHES (nothing was written):\n  ${clashes.join('\n  ')}`); process.exit(3); }
  let total = 0;
  for (const [file, map] of Object.entries(jobs)) {
    const r = apply(file, map);
    console.log(`${file}: ${r.renamed}`);
    total += r.renamed;
  }
  console.log(`occurrences renamed: ${total}`);
} else if (mode === '--count') {
  // How much of the debt is still renameable WITHOUT a breaking release: the rest is phase 7 (ADR-0219).
  const phase7 = namesThatArePhase7();
  let safe = 0;
  const byFile = [];
  for (const f of everyTsFile().filter((f) => !isExcluded(f))) {
    const n = safeNamesOf(f, phase7).length;
    if (n) { safe += n; byFile.push([relative(APP, f).split('\\').join('/'), n]); }
  }
  byFile.sort((a, b) => b[1] - a[1]);
  console.log(`DISTINCT names still renameable without breaking: ${safe} in ${byFile.length} files`);
  for (const [f, n] of byFile.slice(0, 20)) console.log(`   ${String(n).padStart(3)}  ${f}`);
  if (byFile.length > 20) console.log(`   … and ${byFile.length - 20} more files`);
} else {
  console.error('usage: --list <file...>  |  --apply <map.json>  |  --count');
  process.exit(2);
}
