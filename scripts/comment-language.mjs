// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PORTUGUESE IN COMMENTS, MEASURED — phases 0 and 1 of the English plan, for the half the identifier gate never read.
 *
 * `scripts/language-inventory.mjs` measures NAMES; its debt reached eleven, all decided exclusions (ADR-0230). Comments
 * were in the plan's phase 0 from the start («mede o português por ficheiro — nome, identificadores, comentários e
 * docs») and nothing measured them: 📏 on 2026-09-24, 18 937 of 34 205 comment lines, in 362 of 540 files.
 *
 * ⚠️ THIS IS A HEURISTIC, AND IT SAYS SO. A line is Portuguese when it carries at least two common Portuguese words and
 * more of them than common English ones — or one, an accent, and no English word at all. Words shared by both languages
 * (`a`, `as`, `no`, `on`) count for neither, and so do code in backticks and the Dev's own words between «» (quotations
 * stay in the language they were said in). Measured by sampling both ways before it was trusted: the flagged lines were
 * Portuguese; what it misses is SHORT Portuguese lines («desenha a tela.»), so it UNDERCOUNTS. That is why it is a
 * ratchet and never a verdict: a number that only shrinks is honest even when it is low.
 *
 * 📌 THE WHOLE TREE, READ BY KIND. Phase 4 closed at zero inside `app/js`, `tests` and `scripts` — and only there: the
 * stylesheet, the page, the workflow, the root configs, `tools/` and the Python in `scripts/` held 699 Portuguese comment
 * lines in 20 files (📏 2026-09-24) that the gate never opened. Now every file whose kind has comments is read the way that kind writes them: JS/TS by the parser (below), CSS
 * `/* *\/`, HTML `<!-- -->` plus its inline `<script>` and `<style>`, JSON's `//` where the parser allows it and its
 * `"//…"`/`"comment:…"` keys, Python `#` and docstrings, and `#` for YAML, shell, PowerShell, `.gitignore` and `_headers`.
 * Strings and visible text are NOT comments and are not read: a page's words belong in the dictionaries.
 *
 * Exceptions are the identifier gate's (the dictionaries, the pt-BR curriculum, the demo cartridge) and the Dev's
 * `research/` — `EXCLUSIONS` says why, one by one. The validator copied byte for byte from the records' repository is
 * measured like any other file: its comments are English at its home, and a Portuguese line copied here fails.
 *
 * Usage:
 *   node scripts/comment-language.mjs              prints the inventory
 *   node scripts/comment-language.mjs --bootstrap  rewrites the baseline from the tree
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

/**
 * Is this comment line Portuguese? Quotations («…») and code (`…`) are not read, and neither are two kinds of token that
 * split into Portuguese articles by accident: words joined by an apostrophe (`o'clock` → `o`) and letters glued to digits
 * (the note `E5` → `e`, the Portuguese "and"). Measured, each was a false positive on an English line; Portuguese itself
 * almost never writes either.
 */
export function isPortugueseLine(line) {
  const text = line.replace(/«[^»]*»?/g, ' ').replace(/`[^`]*`/g, ' ').replace(/[a-zà-ÿ]+['’][a-zà-ÿ]+/gi, ' ')
    .replace(/[a-zà-ÿ]*\d[a-zà-ÿ\d]*/gi, ' ').toLowerCase();
  const words = text.split(/[^a-zà-ÿ]+/).filter(Boolean);
  const pt = words.filter((w) => PT.has(w)).length;
  const en = words.filter((w) => EN.has(w)).length;
  return (pt >= 2 && pt > en) || (pt >= 1 && en === 0 && ACCENT.test(text));
}

/**
 * The comments of one source text, found by the PARSER: the trivia around each token of the tree.
 *
 * 🔴 Not the raw scanner, and that was measured: a raw scan cannot resume a template after `${…}`, falls out of phase and
 * reads the rest of the file wrong — it saw 13 523 Portuguese comment lines where there are 18 937, and a Portuguese
 * comment written in the region it lost passed the gate green. JSDoc nodes are not walked into: a position inside a
 * comment would be read as the start of more comments.
 */
function scriptComments(text, fileName) {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const found = new Map();
  const take = (ranges) => { for (const r of ranges ?? []) found.set(r.pos, text.slice(r.pos, r.end)); };
  (function walk(n) {
    const kids = n.getChildren(sf).filter((c) => !ts.isJSDoc(c));
    if (kids.length) { kids.forEach(walk); return; }
    take(ts.getLeadingCommentRanges(text, n.pos));
    take(ts.getTrailingCommentRanges(text, n.end));
  })(sf);
  return [...found.values()];
}

/**
 * `/* … *\/` blocks — and `//` lines when `line` is set (JSONC) — with strings stepped over, so a `/*` inside a CSS
 * `content: "…"` or a JSON value is not a comment. A string stops at the end of its line: an unclosed quote costs one
 * line, not the rest of the file. Returns the ranges, because JSON needs them blanked before it can be parsed.
 */
function cRanges(text, { line = false } = {}) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c && text[i] !== '\n'; i++) if (text[i] === '\\') i++;
    } else if (c === '/' && (text[i + 1] === '*' || (line && text[i + 1] === '/'))) {
      const block = text[i + 1] === '*';
      const end = text.indexOf(block ? '*/' : '\n', i + 2);
      const stop = end < 0 ? text.length : end + (block ? 2 : 0);
      out.push([i, stop]);
      i = stop - 1;
    }
  }
  return out;
}
const cssComments = (text) => cRanges(text).map(([a, b]) => text.slice(a, b));

/**
 * JSON has no comments, so this repository writes them two ways and both are read: `//` and `/* *\/` where the parser
 * allows them (the tsconfigs, which `tsc` reads as JSONC), and the keys that are comments by convention — `"//"`, `"//2"`,
 * `"comment:exports"` — whose value is a string or an array of strings, one line each.
 */
function jsonComments(text, fileName) {
  const ranges = cRanges(text, { line: true });
  const out = ranges.map(([a, b]) => text.slice(a, b));
  let blanked = text;
  for (const [a, b] of ranges) blanked = blanked.slice(0, a) + text.slice(a, b).replace(/[^\n]/g, ' ') + blanked.slice(b);
  let data;
  try { data = JSON.parse(blanked); } catch {
    try { data = JSON.parse(blanked.replace(/,(\s*[}\]])/g, '$1')); } catch (e) {
      throw new Error(`${fileName}: not JSON even with its comments blanked, so its comment keys cannot be read (${e.message})`);
    }
  }
  (function walk(v) {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (!/^(\/\/|comment:)/.test(k)) walk(x);
      else if (typeof x === 'string') out.push(x);
      else if (Array.isArray(x)) out.push(x.filter((s) => typeof s === 'string').join('\n'));
    }
  })(data);
  return out;
}

/**
 * `#` to the end of the line — YAML, shell, PowerShell, `.gitignore`, `_headers`, `.env.example`. A `#` is a comment when
 * it opens the line or follows a blank and is not inside a quote on that line; an apostrophe glued to a letter (`it's`)
 * opens no quote. Line by line on purpose: a shell `run: |` block in YAML is shell, and its `#` lines are comments too.
 */
function hashComments(text) {
  const out = [];
  for (const l of text.split('\n')) {
    let q = null;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) { if (c === '\\') i++; else if (c === q) q = null; }
      else if (c === '"' || (c === "'" && !/[a-z]/i.test(l[i - 1] ?? ''))) q = c;
      else if (c === '#' && (i === 0 || /\s/.test(l[i - 1]))) { out.push(l.slice(i)); break; }
    }
  }
  return out;
}

/**
 * Python: `#` comments and DOCSTRINGS — a triple-quoted string standing alone as a statement, outside any bracket, is
 * documentation whatever the interpreter thinks of it. Every other string is stepped over, so a `#` in a string is not
 * a comment and a string's prose is not measured (a `print` message is code).
 */
function pythonComments(text) {
  const out = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '#') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      out.push(text.slice(i, stop));
      i = stop - 1;
    } else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === '"' || c === "'") {
      const triple = text.startsWith(c.repeat(3), i);
      const q = triple ? c.repeat(3) : c;
      let j = i + q.length;
      for (; j < text.length && !text.startsWith(q, j) && (triple || text[j] !== '\n'); j++) if (text[j] === '\\') j++;
      const stop = Math.min(text.length, j + q.length);
      const before = text.slice(text.lastIndexOf('\n', i - 1) + 1, i);
      if (triple && depth === 0 && /^\s*[rRuU]?$/.test(before)) out.push(text.slice(i, stop));
      i = stop - 1;
    }
  }
  return out;
}

/**
 * HTML: `<!-- … -->`, and the comments of every inline `<script>` (read by the parser, as JavaScript) and `<style>` (as
 * CSS). What a page SHOWS is not a comment and is not measured here — visible text belongs in the dictionaries.
 */
function htmlComments(text) {
  const out = [];
  const re = /<!--([\s\S]*?)-->|<(script|style)\b([^>]*)>([\s\S]*?)<\/\2\s*>/gi;
  for (let m; (m = re.exec(text));) {
    if (m[1] !== undefined) out.push(m[0]);
    else if (m[2].toLowerCase() === 'style') out.push(...cssComments(m[4]));
    else if (!/\btype\s*=\s*["']?(?!["']|module|text\/javascript)/i.test(m[3])) out.push(...scriptComments(m[4], 'inline.js'));
  }
  return out;
}

/** The kinds of file the measure reads, by name. A file of no kind here has no comments this measure can find. */
const KINDS = [
  [/\.(ts|tsx|js|mjs|cjs)$/, (t, f) => scriptComments(t, f)],
  [/\.css$/, cssComments],
  [/\.html?$/, htmlComments],
  [/\.json$/, jsonComments],
  [/\.py$/, pythonComments],
  [/\.(ya?ml|sh|ps1|toml)$|(^|\/)(\.gitignore|\.gitattributes|_headers|\.env\.example)$/, hashComments],
];
export const kindOf = (fileName) => KINDS.find(([re]) => re.test(fileName))?.[1] ?? null;

/** The comments of one file's text, read the way its kind writes them (the file NAME picks the kind). */
export function commentsOf(text, fileName = 'x.ts') {
  const read = kindOf(fileName);
  return read ? read(text, fileName) : [];
}

/**
 * The Portuguese comment lines of one source text. A quotation that spans lines is the Dev's words on every line of it —
 * inside one block comment, and across consecutive `//` comments too, where each line is a comment of its own: a «
 * left open in one stays open in the next until its ».
 */
export function portugueseCommentLines(text, fileName = 'x.ts') {
  const blank = (q) => q.replace(/[^\n]/g, ' ');
  let n = 0, open = false;
  for (const comment of commentsOf(text, fileName)) {
    let c = comment;
    if (open) {
      const end = c.indexOf('»');
      open = end < 0;
      c = open ? blank(c) : blank(c.slice(0, end + 1)) + c.slice(end + 1);
    }
    c = c.replace(/«[^»]*»/g, blank);
    const start = c.indexOf('«');
    if (start >= 0) { open = true; c = c.slice(0, start) + blank(c.slice(start)); }
    for (const l of c.split(/\r?\n/)) if (l.trim() && isPortugueseLine(l)) n++;
  }
  return n;
}

/**
 * What is Portuguese ON PURPOSE, each with the reason it stays so. `dir/**` is everything under a folder; any other entry
 * is one exact path. The gate holds this list as a literal set: an exclusion is a decision the test has to be told about.
 */
export const EXCLUSIONS = [
  ['app/js/i18n/**', 'the dictionaries ARE Portuguese, English and Spanish: pillar 3 of ADR-0010 (the identifier gate excludes them too)'],
  ['app/js/educational/**', 'curriculum content is written in pt-BR, not translated: curriculum is rewritten per language (ADR-0032)'],
  ['app/js/consumer-quiz/**', 'the demo cartridge: it is a game, and games are not this package (the identifier gate excludes it too)'],
  ['research/**', 'the Dev\'s own research material, kept in the language it was gathered in (the docs gate excludes it too)'],
];
export const isExcluded = (file) => EXCLUSIONS.some(([pattern]) =>
  pattern.endsWith('/**') ? file.startsWith(pattern.slice(0, -2)) : file === pattern);

const listed = (...args) => execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString().split(/\r?\n/).filter(Boolean);
/**
 * Every file of the tree whose kind has comments — tracked AND untracked, as the identifier gate learned: a file is
 * measured the minute it is born. The whole tree and not three folders: the root configs, `tools/`, the stylesheet, the
 * page and the workflow carried 690 Portuguese comment lines while this measure read only `app/js`, `tests` and `scripts`.
 */
export const sources = () => [...new Set([...listed('ls-files'), ...listed('ls-files', '--others', '--exclude-standard')])]
  .filter((f) => kindOf(f) && !isExcluded(f) && existsSync(join(ROOT, f)));

export function inventory() {
  const debt = {};
  for (const f of sources()) {
    const n = portugueseCommentLines(readFileSync(join(ROOT, f), 'utf8'), f);
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
