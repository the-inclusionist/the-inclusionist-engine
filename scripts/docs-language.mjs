// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PORTUGUESE IN THE DOCUMENTATION, MEASURED — phase 5 of the English plan, which had a goal and no measure.
 *
 * Phase 4 (code comments) got `scripts/comment-language.mjs` and a ratchet; the Markdown had nothing, so «the docs are
 * in English» had no end state anyone could check. This measures, per Markdown file, how many PROSE lines are
 * Portuguese, and `tests/portuguese-docs-only-shrink.node.test.js` refuses any increase.
 *
 * ⚠️ THE CLASSIFIER IS NOT WRITTEN HERE. A line is judged by `isPortugueseLine` from `scripts/comment-language.mjs` — the
 * same word sets, the same thresholds — so the two measures cannot drift apart. What this file adds is only what
 * Markdown needs before a line reaches that classifier:
 *   · fenced code blocks (``` or ~~~, at any indentation, inside a blockquote too) are not prose;
 *   · inline code between backticks of any length is not prose;
 *   · URLs, link targets and reference definitions are addresses, not prose;
 *   · the Dev's own words between «» stay in the language they said them in, across lines, until the paragraph ends.
 * It is a heuristic that UNDERCOUNTS (short Portuguese lines, headings of two words), so the gate is a ratchet and
 * never a verdict — see the classifier's header for how it was sampled.
 *
 * 📌 FILE NAMES are a second, separate measure: a Markdown file whose name carries a word that `scripts/word-lists.json`
 * classifies as Portuguese (the identifier gate's list, split by the identifier gate's `words`). Names are held as a
 * set that only shrinks, not counted per line.
 *
 * Usage:
 *   node scripts/docs-language.mjs              prints the inventory (top files and Portuguese names)
 *   node scripts/docs-language.mjs --bootstrap  rewrites the baseline from the tree
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPortugueseLine } from './comment-language.mjs';
import { words, readLists } from './language-inventory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BASELINE = join(ROOT, 'docs/6-DevOps-SRE/docs-language-debt.json');

/**
 * Markdown that is Portuguese ON PURPOSE, each with the reason it stays so. `dir/**` is everything under a folder; any
 * other entry is one exact path. The gate holds this list as a literal set: adding an exclusion is a decision the test
 * has to be told about, not a line that slips in beside the others.
 */
export const EXCLUSIONS = [
  ['docs/educational/**', 'curriculum and pedagogy for Brazilian educators, in pt-BR by rule: curriculum is rewritten per language, never translated (ADR-0032)'],
  ['CLAUDE.md', 'the AI\'s operating manual, kept in pt-BR on purpose; the conversation with the Dev is in pt-BR and the file says so in its first lines'],
  ['research/**', 'the Dev\'s own research material, kept in the language it was gathered in'],
  ['CHANGELOG.md', 'generated release history: the notes of a published release are not rewritten, and new entries come from English commit messages'],
  ['.claude/plans/**', 'the working plan the AI keeps with the Dev, in pt-BR like the conversation it tracks; the Dev asked for it in the repository (2026-09-24)'],
];

export const isExcluded = (file) => EXCLUSIONS.some(([pattern]) =>
  pattern.endsWith('/**') ? file.startsWith(pattern.slice(0, -2)) : file === pattern);

const FENCE = /^\s*(?:>\s*)*(`{3,}|~{3,})/;

/**
 * One Markdown line with everything that is not prose taken out: inline code, URLs, link targets and a reference
 * definition's address. The «» are handled by the caller, which carries them across lines.
 */
function prose(line) {
  return line
    .replace(/(`+).*?\1(?!`)/g, ' ')
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<?(?:https?|ftp|mailto):[^\s<>)\]]+>?/gi, ' ')
    .replace(/\bwww\.[^\s<>)\]]+/gi, ' ');
}

/**
 * The 1-based numbers of the Portuguese prose lines of one Markdown text.
 *
 * ⚠️ A «» left open closes at the end of its PARAGRAPH (a blank line or a fence), not at the end of the file: a stray «
 * must not silence every line after it — that would be a hole the size of the rest of the document.
 * ⚠️ A fence left open does run to the end of the file, and that is what a Markdown renderer does too: it shows the
 * rest as code, so it is not prose a reader reads.
 */
export function portugueseProseLines(text) {
  const found = [];
  let fence = null;
  let quoted = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    const f = FENCE.exec(raw);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !raw.slice(f[0].length).trim()) fence = null;
      return;
    }
    if (f) { fence = f[1]; quoted = false; return; }
    if (!raw.trim()) { quoted = false; return; }
    let line = prose(raw);
    if (quoted) {
      const end = line.indexOf('»');
      if (end < 0) return;
      quoted = false;
      line = line.slice(end + 1);
    }
    line = line.replace(/«[^»]*»/g, ' ');
    const open = line.indexOf('«');
    if (open >= 0) { quoted = true; line = line.slice(0, open); }
    if (line.trim() && isPortugueseLine(line)) found.push(i + 1);
  });
  return found;
}

/** The Portuguese words a Markdown file's NAME carries, by the identifier gate's list. */
export function portugueseNameWords(file, pt = readLists().pt) {
  return words(basename(file).replace(/\.md$/i, '')).filter((w) => pt.has(w));
}

const listed = (...args) => execFileSync('git', args, { cwd: ROOT }).toString().split('\0').filter(Boolean);

/** Tracked AND untracked, as the other language gates learned: a document is measured the minute it is born. */
export const measuredFiles = () => [...new Set([
  ...listed('ls-files', '-z', '--', '*.md'),
  ...listed('ls-files', '-z', '--others', '--exclude-standard', '--', '*.md'),
])].filter((f) => existsSync(join(ROOT, f)) && !isExcluded(f)).sort();

/** Portuguese prose lines per measured file; a file with none is left out. */
export function inventory() {
  const debt = {};
  for (const f of measuredFiles()) {
    const n = portugueseProseLines(readFileSync(join(ROOT, f), 'utf8')).length;
    if (n) debt[f] = n;
  }
  return debt;
}

/** The measured files whose name carries a Portuguese word. */
export function portugueseNames() {
  const { pt } = readLists();
  return measuredFiles().filter((f) => portugueseNameWords(f, pt).length > 0);
}

export const readBaseline = () => JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const debt = inventory();
  const names = portugueseNames();
  const total = Object.values(debt).reduce((s, n) => s + n, 0);
  if (process.argv.includes('--bootstrap')) {
    const files = Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE, JSON.stringify({
      about: 'Portuguese prose lines per Markdown file, and the Markdown files whose NAME carries a Portuguese word '
        + '(scripts/docs-language.mjs). Both only shrink; a new file starts at zero. A heuristic that undercounts — a '
        + 'ratchet, never a verdict.',
      total, files, names,
    }, null, 2) + '\n');
  }
  console.log(`${total} Portuguese prose lines in ${Object.keys(debt).length} of ${measuredFiles().length} Markdown files`);
  for (const [f, n] of Object.entries(debt).sort(([, a], [, b]) => b - a).slice(0, 15)) console.log(`  ${String(n).padStart(5)}  ${f}`);
  console.log(`${names.length} Markdown file names carry a Portuguese word:`);
  for (const f of names) console.log(`  ${f}  (${portugueseNameWords(f).join(', ')})`);
}
