// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PROVES THAT A CHANGE TOUCHED ONLY COMMENTS — the safety net of phase 4 of the English plan (translating comments).
 *
 * Translating 13 000 comment lines by hand is exactly the kind of edit where a stray keystroke lands in code and the
 * suites stay green because nothing exercises that line. So every file changed against a base revision is scanned with
 * TypeScript's scanner, trivia skipped, and its CODE token stream must be identical before and after. Whitespace and
 * comments may change; nothing else may.
 *
 * Usage: node scripts/only-comments-changed.mjs [base]   (base defaults to HEAD; exits 1 and names the file if code moved)
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString();

/**
 * The code tokens of a source text: the LEAVES of its syntax tree, JSDoc nodes left out.
 *
 * 🔴 Not the raw scanner, and that was measured: a raw scan cannot resume a template after `${…}`, so it reads template
 * text as code — and a `//` inside a template URL as a COMMENT, where a change would be invisible to this check. The
 * parser knows where a template ends; its leaves are exactly the tokens, and trivia is never one of them.
 */
export function codeTokens(text, fileName = 'x.ts') {
  // the extension picks JS or TS parsing, so the name is passed through and not decorative
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const out = [];
  (function leaves(n) {
    const kids = n.getChildren(sf).filter((c) => !ts.isJSDoc(c));
    if (!kids.length) { out.push(`${n.kind}:${n.getText(sf)}`); return; }
    kids.forEach(leaves);
  })(sf);
  return out;
}

export function codeMoved(base = 'HEAD') {
  // the whole tree, as the comment measure reads it: a root config or a `tools/` script is code too
  const changed = git('-c', 'core.quotepath=off', 'diff', '--name-only', base).split(/\r?\n/).filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f));
  const moved = [];
  for (const f of changed) {
    let before;
    try { before = git('show', `${base}:${f}`); } catch { continue; } // a new file has no «before»
    let after;
    try { after = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; } // a deleted file is another kind of change
    const a = codeTokens(before, f), b = codeTokens(after, f);
    if (a.length !== b.length || a.some((t, i) => t !== b[i])) {
      const i = a.findIndex((t, k) => t !== b[k]);
      moved.push(`${f}: first difference at token ${i} — «${a[i] ?? '∅'}» became «${b[i] ?? '∅'}»`);
    }
  }
  return { changed: changed.length, moved };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { changed, moved } = codeMoved(process.argv[2] ?? 'HEAD');
  for (const m of moved) console.error('CODE MOVED ' + m);
  console.log(`${changed} files changed, ${moved.length} with code moved`);
  process.exit(moved.length ? 1 : 0);
}
