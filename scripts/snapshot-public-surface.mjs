#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Writes the PORTRAIT of the package's public surface: each module of `app/js/**` and the names it exports.
//
// ⚠️ THIS IS NOT AN INDEX, IT IS A COMMITMENT. `tests/superficie-publica.node.test.js` compares the tree with the portrait
// and fails when a name DISAPPEARS. Running this script is therefore the way to say that a removal is deliberate — and
// the test's failure message asks for the `BREAKING CHANGE:` footer in the commit, the information a release's breaking
// changes need.
//
// Uso: `node scripts/snapshot-public-surface.mjs` (reescreve o retrato)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { formaDe, RETRATO_FORMA } from './shape-surface.mjs';

export const RETRATO = 'docs/6-DevOps-SRE/public-surface.json';

/** A NAMED `export`. Re-exports (`export { x } from …`) and `export default` are left out on purpose:
 *  the first is an indirection of the same name, and this project does not use the second. */
const RE = /^export\s+(?:declare\s+)?(?:async\s+)?(?:(function|const|let|var|class|interface|type|enum)\s+)([A-Za-z_$][\w$]*)/gm;

/*
 * 🔴 AND THE FOLLOWING DECLARATORS OF THE SAME LINE: `export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;` publishes
 * three names, and games import the second and third. Without this, the surface check — which exists to fail when a
 * public name DISAPPEARS — could not protect them: deleting them passed green.
 *
 * ⚠️ ONLY THE NAMES AT THE TOP COMMA LEVEL ARE READ, because an initialiser may itself have commas — in parentheses,
 * braces and brackets, and ALSO inside a string. 🔴 Counting only the delimiters published a name that does not exist:
 * `export const ITEM_SELECTOR = 'button:not([disabled]), select:not(…)'` entered the portrait with an export called
 * `select`. A portrait that INVENTS a name is worse than one that loses one: the check would demand forever a name no
 * module has.
 */
const CONTINUA = /^export\s+(?:declare\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*/;

function declaradoresDaLinha(linha) {
  if (!CONTINUA.test(linha)) return [];
  const corpo = linha.replace(/^export\s+(?:declare\s+)?(?:const|let|var)\s+/, '');
  const nomes = [];
  let profundidade = 0, actual = '', aspas = '', escapado = false;
  for (const ch of corpo) {
    if (aspas) {
      // inside a string nothing is structure: neither a comma nor a parenthesis
      if (escapado) escapado = false;
      else if (ch === '\\') escapado = true;
      else if (ch === aspas) aspas = '';
      actual += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { aspas = ch; actual += ch; continue; }
    if ('([{'.includes(ch)) profundidade += 1;
    else if (')]}'.includes(ch)) profundidade -= 1;
    if (ch === ',' && profundidade === 0) { nomes.push(actual); actual = ''; continue; }
    actual += ch;
  }
  nomes.push(actual);
  // of each declarator, only the name before the type's `:` or the `=`
  // 📌 THE FIRST ONE COMES IN TWICE — through here and through `RE` — and that was MEASURED as equivalent: the portrait
  // goes through a `Set`, so skipping it with a `slice(1)` gave exactly the same file. The mutation that removed it
  // survived, and a guard no case can tell apart is inert code: it goes, instead of asking for a case that does not exist.
  return nomes
    .map((d) => /^\s*([A-Za-z_$][\w$]*)\s*(?::|=|$)/.exec(d)?.[1])
    .filter((n) => typeof n === 'string');
}

function ficheiros(raiz, dir = raiz, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(raiz, p, fora);
    else if (nome.endsWith('.ts')) fora.push(relative(raiz, p).split('\\').join('/'));
  }
  return fora;
}

/** The portrait: `{ 'core/route.ts': ['WALKABLE_ROLES', 'isWalkable', …], … }`, sorted. */
export function superficieDe(raizAppJs) {
  const fora = {};
  for (const rel of ficheiros(raizAppJs).sort()) {
    const txt = readFileSync(join(raizAppJs, rel), 'utf8');
    const nomes = [...txt.matchAll(RE)].map((m) => m[2]);
    for (const linha of txt.split(/\r?\n/)) nomes.push(...declaradoresDaLinha(linha));
    if (nomes.length) fora[rel] = [...new Set(nomes)].sort();
  }
  return fora;
}

// ⚠️ The comparison is by the file's NAME and not by `import.meta.url === 'file://' + argv[1]`: on Windows the path comes
// with backslashes and a drive letter, the equality never matches, and the script exits silently without writing
// anything.
if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'snapshot-public-surface.mjs') {
  const raiz = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
  const s = superficieDe(join(raiz, 'app', 'js'));
  writeFileSync(join(raiz, RETRATO), JSON.stringify(s, null, 2) + '\n');
  const n = Object.values(s).reduce((t, v) => t + v.length, 0);
  console.log(`retrato escrito: ${Object.keys(s).length} módulos, ${n} nomes`);

  // ⚠️ BOTH PORTRAITS COME OUT OF THE SAME COMMAND, on purpose: declaring is ONE act. Two separate commands would give
  // half a declaration — the names updated and the shape stale —, and the shape gate would go on failing over a removal
  // someone thought they had declared.
  const f = formaDe(join(raiz, 'app', 'js'));
  writeFileSync(join(raiz, RETRATO_FORMA), JSON.stringify(f, null, 2) + '\n');
  const tipos = Object.values(f).reduce((t, v) => t + Object.keys(v).length, 0);
  console.log(`forma escrita:   ${Object.keys(f).length} módulos, ${tipos} tipos`);
}
