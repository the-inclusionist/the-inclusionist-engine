#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// APPLIES ONE LAYER OF THE RENAME MAP TO THIS REPOSITORY (ADR-0219, issue #202).
//
// The map (`scripts/rename-map.json`) is the source of both the rename and the migration table, so a name cannot be renamed
// without being written down — which a hand-typed table cannot promise. Nothing outside this repository is touched: the games
// get the table, and the Dev adapts each one when he goes to it (his decision, 2026-09-21).
//
// Use: `node scripts/apply-rename.mjs <layer>` · `--dry` lists what it would change and writes nothing.
//
// ⚠️ WHOLE WORD, and the boundary is the whole point: `Tema` must not turn `TemaDoJogador` into `ThemeDoJogador` halfway, and
// `modoCego` must not touch `modoCegoDica`. Every replacement is `(?<![\w$])name(?![\w$])`.
//
// ⚠️ THE DICTIONARIES ARE NOT REWRITTEN. `app/js/i18n/*.ts` is key→sentence data, and a key that happens to spell an
// identifier («audio.modoCego») is a promise to three languages, not a name — renaming it silently would leave the interface
// asking for a key nobody has. 📏 Measured: the i18n layer exports no Portuguese name at all, so nothing is lost by leaving it out.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
export const MAP = 'scripts/rename-map.json';

export const readMap = () => JSON.parse(readFileSync(join(ROOT, MAP), 'utf8'));

/*
 * The tracked files a rename may touch. 🔴 THE WHOLE REPOSITORY AND NOT A LIST OF FOLDERS, measured the hard way: the first
 * version walked `app/js`, `tests`, `scripts` and `docs`, and `vitest.setup.node.js` — which lives at the ROOT and imports
 * `carregarEstado` — was left behind. Every one of the 200 test files then failed to LOAD, with `tsc` perfectly clean, because
 * a setup file is not type-checked against the tree the way a module is.
 *
 * What is left out, and each for its own reason:
 *   · `app/js/i18n/` — key→sentence data; a key that spells an identifier is a promise to three languages, not a name;
 *   · the map, the tool and its gate — they QUOTE the old names on purpose, and renaming a quotation erases the evidence;
 *   · `docs/6-DevOps-SRE/Breaking-Changes.md` — the migration table is where the old names have to survive.
 */
const LEFT_OUT = [MAP, 'scripts/apply-rename.mjs', 'tests/rename-map.node.test.js', 'docs/6-DevOps-SRE/Breaking-Changes.md'];

export function filesToRename() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .trim().split(/\r?\n/)
    .filter((f) => /\.(ts|js|mjs|cjs|md|json|html)$/.test(f))
    .filter((f) => !f.startsWith('app/js/i18n/'))
    .filter((f) => !LEFT_OUT.includes(f));
}

const wholeWord = (name) => new RegExp(`(?<![\\w$])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`, 'g');

/*
 * 🔴 INSIDE A COMMENT, ONLY WHAT IS IN BACKTICKS. Measured before a single line was renamed: `LINHAS` is the number of rows of
 * the flash grid AND the Portuguese word in seventeen comments of prose in this repository («🎯 TRÊS LINHAS, UM PAINEL»). A
 * whole-word replacement over the file would leave «TRÊS ROWS, UM PAINEL» — prose broken inside a commit far too large for
 * anybody to see it.
 *
 * This house's own rule settles the ambiguity, which is why it serves as the criterion: a comment names identifiers in
 * backticks. Outside comments everything is renamed — INCLUDING inside strings, because an event's name («modoCego») IS the
 * public surface, and renaming the binding without the string would cut `emit`/`on` in half.
 */
function commentRanges(text) {
  const ranges = [];
  for (const m of text.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

const inside = (ranges, i) => ranges.some(([a, b]) => i >= a && i < b);

/**
 * Renames in one text, and answers how many times each name was replaced.
 *
 * `prose: true` — for a `.md`, where there is no comment delimiter and the whole file is prose: there, only what is in
 * backticks is renamed, which is how this house writes an identifier in a document.
 */
export function renameInText(text, names, { prose = false } = {}) {
  const counted = {};
  let out = text;
  for (const [old, fresh] of Object.entries(names)) {
    const ranges = prose ? [[0, out.length]] : commentRanges(out);
    const backticks = [];
    for (const m of out.matchAll(/`[^`\n]*`/g)) backticks.push([m.index, m.index + m[0].length]);
    let n = 0;
    out = out.replace(wholeWord(old), (found, i) => {
      if (inside(ranges, i) && !inside(backticks, i)) return found; // prose: left alone
      n += 1;
      return fresh;
    });
    if (n) counted[old] = n;
  }
  return { text: out, counted };
}

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'apply-rename.mjs') {
  const layer = process.argv[2];
  const dry = process.argv.includes('--dry');
  const map = readMap();
  const block = map.layers[layer];
  if (!block) {
    console.error(`apply-rename: no layer «${layer}» in ${MAP}. There are: ${Object.keys(map.layers).join(', ')}`);
    process.exit(2);
  }
  const total = {};
  let files = 0;
  for (const rel of filesToRename()) {
    const before = readFileSync(join(ROOT, rel), 'utf8');
    const { text, counted } = renameInText(before, block.names, { prose: rel.endsWith('.md') });
    if (text === before) continue;
    files += 1;
    for (const [n, q] of Object.entries(counted)) total[n] = (total[n] ?? 0) + q;
    if (!dry) writeFileSync(join(ROOT, rel), text);
  }
  const unused = Object.keys(block.names).filter((n) => !(n in total));
  console.log(`${dry ? '[dry] ' : ''}${Object.keys(block.names).length} names · ${files} files · `
    + `${Object.values(total).reduce((a, b) => a + b, 0)} occurrences`);
  // 🔴 A NAME THE MAP CARRIES AND THE TREE DOES NOT HAVE is either already renamed or a typo in the map — and a typo here is a
  // name that never gets renamed and that nothing reports, which is the failure mode this file exists to prevent.
  if (unused.length) console.log(`⚠️  found nowhere (${unused.length}): ${unused.join(', ')}`);
}
