// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PORTUGUESE IN COMMENTS, MEASURED — phases 0 and 1 of the English plan, for the half the identifier gate never read.
 *
 * `scripts/language-inventory.mjs` measures NAMES; its debt reached eleven, all decided exclusions (ADR-0230). Comments
 * were in the plan's phase 0 from the start («mede o português por ficheiro — nome, identificadores, comentários e
 * docs») and nothing measured them: 📏 on 2026-09-24, 13 523 of 25 109 comment lines, in 355 of 536 files.
 *
 * ⚠️ THIS IS A HEURISTIC, AND IT SAYS SO. A line is Portuguese when it carries at least two common Portuguese words and
 * more of them than common English ones — or one, an accent, and no English word at all. Words shared by both languages
 * (`a`, `as`, `no`, `on`) count for neither, and so do code in backticks and the Dev's own words between «» (quotations
 * stay in the language they were said in). Measured by sampling both ways before it was trusted: the flagged lines were
 * Portuguese; what it misses is SHORT Portuguese lines («desenha a tela.»), so it UNDERCOUNTS. That is why it is a
 * ratchet and never a verdict: a number that only shrinks is honest even when it is low.
 *
 * Exceptions are the identifier gate's (the dictionaries, the pt-BR curriculum, the demo cartridge).
 *
 * Usage:
 *   node scripts/comment-language.mjs              prints the inventory
 *   node scripts/comment-language.mjs --bootstrap  rewrites the baseline from the tree
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = join(ROOT, 'docs/6-DevOps-SRE/comment-language-debt.json');

const PT = new Set(('o os um uma de do da dos das em nos nas ao aos à é e que não nao se por para com pelo pela pelos pelas ' +
  'mas ou quando porque também tambem isso isto está esta são sao já ja só sem sobre entre cada ainda onde como seu sua ' +
  'seus suas foi ser tem têm fica ficou pode deve precisa quem qual quais então entao ela ele elas eles aqui lá depois ' +
  'antes assim porém mesmo mesma muito pouco nunca sempre nada tudo outro outra fazer feito faz vai vão coisa jogo ' +
  'criança crianca dele dela desde até agora hoje era essa esse este num numa lo').split(/\s+/));
const EN = new Set(('the of and to is it that this for with not are be was were by from which when because also but or ' +
  'if its their there what one only into than then so does do has have had been would should can will every each where ' +
  'how who why here after before never always nothing').split(/\s+/));
const ACCENT = /[ãõçáéíóúâêôà]/i;

/** Is this comment line Portuguese? Quotations («…») and code (`…`) are not read. */
export function isPortugueseLine(line) {
  const text = line.replace(/«[^»]*»?/g, ' ').replace(/`[^`]*`/g, ' ').toLowerCase();
  const words = text.split(/[^a-zà-ÿ]+/).filter(Boolean);
  const pt = words.filter((w) => PT.has(w)).length;
  const en = words.filter((w) => EN.has(w)).length;
  return (pt >= 2 && pt > en) || (pt >= 1 && en === 0 && ACCENT.test(text));
}

/** The Portuguese comment lines of one source text, read with TypeScript's scanner (a comment is lexing, not a regex). */
export function portugueseCommentLines(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  let n = 0, kind;
  while ((kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (kind !== ts.SyntaxKind.SingleLineCommentTrivia && kind !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    for (const l of scanner.getTokenText().split(/\r?\n/)) if (l.trim() && isPortugueseLine(l)) n++;
  }
  return n;
}

const EXCLUDED = /^app\/js\/(i18n|educational|consumer-quiz)\//;
const listed = (...args) => execFileSync('git', args, { cwd: ROOT }).toString().split(/\r?\n/).filter(Boolean);
/** Tracked AND untracked, as the identifier gate learned: a file is measured the minute it is born. */
export const sources = () => [...new Set([
  ...listed('ls-files', 'app/js', 'tests', 'scripts'),
  ...listed('ls-files', '--others', '--exclude-standard', 'app/js', 'tests', 'scripts'),
])].filter((f) => /\.(ts|js|mjs)$/.test(f) && !EXCLUDED.test(f));

export function inventory() {
  const debt = {};
  for (const f of sources()) {
    const n = portugueseCommentLines(readFileSync(join(ROOT, f), 'utf8'));
    if (n) debt[f] = n;
  }
  return debt;
}

export const readBaseline = () => JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const debt = inventory();
  const total = Object.values(debt).reduce((s, n) => s + n, 0);
  if (process.argv.includes('--bootstrap')) {
    const sorted = Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE, JSON.stringify({
      about: 'Portuguese comment lines per file (scripts/comment-language.mjs). Only shrinks; a new file starts at zero. A heuristic that undercounts — a ratchet, never a verdict.',
      total, files: sorted,
    }, null, 2) + '\n');
  }
  console.log(`${total} Portuguese comment lines in ${Object.keys(debt).length} files`);
}
