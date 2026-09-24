#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// RENAMES FILES BY THE MAP, AND MOVES EVERY REFERENCE WITH THEM (ADR-0219 phase 3, issue #202).
//
// Phase 2 renamed what a module EXPORTS; this renames what a module IS CALLED, which is public surface too: a game writes
// `import { … } from '@the-inclusionist/engine/core/anel.js'`, and a path is as much a contract as a name.
//
// ⚠️ `git mv` AND NOT «write the new, delete the old», so the history follows the file. A file that is rewritten instead of
// moved loses the blame of every line in it, and the reason a line exists is the most expensive thing in this repository.
//
// Use: `node scripts/apply-file-rename.mjs <layer>` · `--dry` says what it would do and moves nothing.
//
// ========================= HOW A REFERENCE IS FOUND, AND WHY IN TWO PASSES =========================
// A path is written two different ways in this tree, and one rule cannot catch both without catching what it should not.
//
//   1. AS A MODULE SPECIFIER — `'../core/anel.js'` — which is RELATIVE to the file it is written in. This pass RESOLVES each
//      specifier and rewrites it only when it lands on a file being renamed. 🔴 A basename match would be wrong and the tree
//      already proves it: there are two `port.ts`, two `state.ts` and two `vision.ts` in different layers, and `pesados.ts`
//      has a namesake in `scripts/`. The resolution is the only thing that tells them apart.
//   2. AS DATA — the repo-relative path itself, inside `public-surface.json`, `language-debt.json`, a doc, or a gate that
//      names the module it guards. Those are literal strings and are replaced literally, extension included.
//
// A file the map does not name is never written to unless one of those two passes has something to change in it.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, resolve } from 'node:path';
import { readMap, MAP } from './apply-rename.mjs';

const ROOT = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
const posix = (p) => p.split('\\').join('/');

/** Every tracked text file a path may be written in. The map and this tool are left out: they QUOTE the old paths on purpose. */
/*
 * ⚠️ AND THE LEDGER OF DEAD POINTERS IS LEFT OUT, learned by damaging it twice in one afternoon.
 * `tests/records-pointing-at-dead-gates.node.test.js` exists to say «this path no longer exists, and here is where it went»: rewriting
 * the old half of that sentence turns «X became Y» into «Y became Y», and rewriting the KEY declares a dead pointer for a file
 * that is alive. Its entries are data ABOUT paths, exactly as `word-lists.json` is data about words — the same mistake phase 2
 * made when it rewrote the gate's own dictionary into English.
 */
const LEFT_OUT = [MAP, 'scripts/apply-file-rename.mjs', 'docs/6-DevOps-SRE/Breaking-Changes.md', 'CHANGELOG.md',
  'tests/records-pointing-at-dead-gates.node.test.js'];
const filesToTouch = () => execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  .trim().split(/\r?\n/)
  // 📌 `.css` IS IN THE LIST BECAUSE A STYLESHEET NAMES ITS GATE. Measured on the first tests batch: `app/css/style.css`
  // cites `tests/contraste-menu.node.test.js` in a comment, and the file type was not being read at all — the gate of this
  // phase caught it, which is the whole reason that gate scans the tracked tree rather than only the imports.
  .filter((f) => /\.(ts|js|mjs|cjs|md|json|html|py|yaml|yml|css)$/.test(f))
  .filter((f) => !LEFT_OUT.includes(f));

/**
 * The specifiers a file writes, with their position: `from '…'`, a bare `import '…'`, a dynamic `import('…')` and `require('…')`.
 * 📌 The quote is captured so the rewrite puts back the one that was there — a repository that mixes them would otherwise get a
 * diff about quotes on top of a diff about paths, and a reviewer reads the second one worse for the first.
 */
const SPECIFIER = /(\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\2/g;

/** `'../core/anel.js'` written in `app/js/ui/menu-nav.ts` → `app/js/core/anel.ts`, or `null` when it lands nowhere we renamed. */
function resolveSpecifier(fromFile, spec) {
  if (!spec.startsWith('.')) return null;             // a package, not a file of ours
  const asked = posix(relative(ROOT, resolve(join(ROOT, dirname(fromFile)), spec)));
  // ⚠️ THE EXTENSION IS A LIE ON PURPOSE, and it is the house's rule and not this tool's: TypeScript source is imported with
  // `.js` because that is what will exist after the build. So a specifier ending in `.js` is asked of the tree as `.ts` first.
  const asTs = asked.replace(/\.js$/, '.ts');
  return [asTs, asked];
}

export function rewriteReferences(text, fromFile, moves) {
  let changed = 0;
  let out = text.replace(SPECIFIER, (all, head, quote, spec) => {
    const landed = resolveSpecifier(fromFile, spec);
    if (!landed) return all;
    const alvo = landed.find((p) => moves[p]);
    if (!alvo) return all;
    // The new specifier keeps the shape of the old one: same relative style, same extension.
    const novo = posix(relative(dirname(fromFile), moves[alvo].replace(/\.ts$/, spec.endsWith('.js') ? '.js' : '.ts')));
    changed += 1;
    return `${head}${quote}${novo.startsWith('.') ? novo : `./${novo}`}${quote}`;
  });
  // Pass 2: the path written as DATA. Longest first, so `a/b/c.ts` is not half-replaced by a rule about `a/b`.
  for (const [de, para] of dataForms(moves)) {
    if (de instanceof RegExp) {
      // ⚠️ COUNTED BY MATCHING, not by picking the literal head out of `source`: V8 ESCAPES THE SLASH in the source of a
      // `RegExp` built from a string, so `platform/pesados` comes back as `platform\/pesados` and a text search for it finds
      // nothing. The count was zero, the caller reads the count to decide whether to write, and the file was silently skipped —
      // a rewrite that happened and was thrown away.
      changed += out.match(de)?.length ?? 0;
      out = out.replace(de, para);
      continue;
    }
    if (de === para || !out.includes(de)) continue;
    changed += out.split(de).length - 1;
    out = out.split(de).join(para);
  }
  return { text: out, changed };
}

/*
 * THE THREE SHAPES A PATH IS WRITTEN IN HERE, and the third one was learned the expensive way — by nearly shipping a broken
 * `bin`. Renaming `app/js/platform/pesados.ts` left `scripts/…` asking for `../dist-pkg/platform/pesados.js`, which is the
 * COMPILED MIRROR of the same file: the tool had never heard of it, the typecheck cannot see inside a string, and the published
 * command would have died on a school's machine at the one moment it matters.
 *
 *   1. `app/js/platform/pesados.ts` — the repo-relative path, as a ledger keyed by path writes it;
 *   2. `platform/pesados.ts` — the same without the `app/js/` prefix, which is how the surface portrait, the i18n ceiling and
 *      the CDN gate key a module, AND how the `dist-pkg/` mirror is reached;
 *   3. `platform/pesados` — extensionless, which is how PROSE names a module, in backticks.
 *
 * ⚠️ The extensionless form is the one that can bite: `core/ring` is a prefix of a `core/ring-buffer` that does not exist today
 * but could tomorrow. So it is the only one matched by expression rather than by text, and it refuses to match when what follows
 * is a letter, a digit, a dash or a dot — it renames a NAME, never the head of a longer one.
 *
 * 🔴 AND THERE IS A FOURTH SHAPE THIS TOOL REFUSES TO HANDLE, deliberately: the BARE BASENAME, `transporte-em-uso` with no
 * folder in front of it, which is how a comment sometimes names a module and how one gate keys its ledger. It is refused
 * because it cannot be told apart from anything else with that name, and this tree has two `port.ts`, two `state.ts` and two
 * `vision.ts` — a rule about `state` would rewrite the wrong half of the engine and nothing would fail until much later. Those
 * are found by reading the report of what is left and changed by hand, which costs minutes and cannot be silently wrong.
 */
export function dataForms(moves) {
  const pares = [];
  for (const [velho, novo] of Object.entries(moves)) {
    /*
     * EVERY SUFFIX OF THE PATH THAT STILL CARRIES A SLASH, and the generalisation was earned twice. First `app/js/…` was
     * stripped, because that is how a ledger and the `dist-pkg/` mirror name a module (`platform/heavy.ts`). Then the scripts
     * layer showed the same thing one folder in: a comment says «a tabela mora em `lib/taxonomia.mjs`» and a test says the
     * WCAG count moved to `fixtures/contraste-wcag.js`. One slash is what keeps this safe — a suffix with no slash is the bare
     * basename, which this tool refuses for the reason written below.
     */
    const pedacos = velho.split('/');
    const curtos = pedacos.map((_, i) => [pedacos.slice(i).join('/'), novo.split('/').slice(i).join('/')])
      .filter(([v]) => v.includes('/'));
    for (const [v, n] of curtos) {
      pares.push([v, n]);
      pares.push([v.replace(/\.ts$/, '.js'), n.replace(/\.ts$/, '.js')]);
      const semExt = v.replace(/\.[a-z.]+$/i, '');
      pares.push([new RegExp(`${semExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'g'), n.replace(/\.[a-z.]+$/i, '')]);
    }
  }
  // Longest first, and a literal before the expression that contains it, so a short rule never eats a long one's prefix.
  return pares
    .filter(([de, para]) => de instanceof RegExp || de !== para)
    .sort(([a], [b]) => (b instanceof RegExp ? b.source.length : b.length) - (a instanceof RegExp ? a.source.length : a.length));
}

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'apply-file-rename.mjs') {
  const layer = process.argv[2];
  const dry = process.argv.includes('--dry');
  const bloco = readMap().fileLayers?.[layer];
  if (!bloco) {
    const haveria = Object.keys(readMap().fileLayers ?? {}).join(', ') || '(none)';
    console.error(`apply-file-rename: no file layer «${layer}» in ${MAP}. There are: ${haveria}`);
    process.exit(2);
  }
  const moves = bloco.files;
  // 🔴 EVERYTHING IS CHECKED BEFORE ANYTHING MOVES. A half-applied rename leaves a tree that neither compiles nor reverts
  // cleanly, and the map is exactly the kind of file a typo hides in.
  const problemas = [];
  for (const [velho, novo] of Object.entries(moves)) {
    if (!existsSync(join(ROOT, velho))) problemas.push(`missing: ${velho}`);
    if (existsSync(join(ROOT, novo))) problemas.push(`already there: ${novo}`);
  }
  if (problemas.length) { console.error(`apply-file-rename:\n  ${problemas.join('\n  ')}`); process.exit(1); }

  let ficheiros = 0, referencias = 0;
  for (const rel of filesToTouch()) {
    const antes = readFileSync(join(ROOT, rel), 'utf8');
    const { text, changed } = rewriteReferences(antes, rel, moves);
    if (!changed || text === antes) continue;
    ficheiros += 1; referencias += changed;
    if (!dry) writeFileSync(join(ROOT, rel), text);
  }
  if (!dry) for (const [velho, novo] of Object.entries(moves)) execFileSync('git', ['mv', velho, novo], { cwd: ROOT });
  console.log(`${dry ? '[dry] ' : ''}${Object.keys(moves).length} files moved · ${referencias} references in ${ficheiros} files`);
}
