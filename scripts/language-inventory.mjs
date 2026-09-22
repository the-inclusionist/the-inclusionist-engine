// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE PORTUGUESE DEBT, MEASURED — phase 0 of the English plan (the Dev, 2026-09-21: «De que adianta pedir pra tirar se você
 * continua colocando?»).
 *
 * The project's rule is English artefacts (`CLAUDE.md`), and the debt is old and large. This does NOT rename anything: it
 * measures, per file, how many declared identifiers carry a Portuguese word, and the gate that reads it
 * (`tests/portuguese-stays-out.node.test.js`) refuses any increase. What shrinks is written back with `--bootstrap`.
 *
 * ⚠️ WHY A WORD LIST AND NOT A GUESS: «ler» and «read», «porta» and «port» are three letters apart, and a heuristic over
 * accents cannot see a stripped one (`correcao`, `botao`). So every word a declaration uses is CLASSIFIED: Portuguese, English,
 * or unknown. An unknown word fails the gate — that is what stops a Portuguese word nobody has seen yet from entering
 * quietly. Classifying costs one line in `scripts/word-lists.json`.
 *
 * Exceptions, and each one is a rule of the project, not a convenience:
 *   · `app/js/i18n/**`       — the dictionaries ARE Portuguese (pilar 3)
 *   · `app/js/educational/**` — curriculum content in pt-BR (ADR-0032)
 *   · `app/js/consumer-quiz/**` — the demo cartridge, which the engine does not publish
 *
 * Usage:
 *   node scripts/language-inventory.mjs             prints the inventory and what is unknown
 *   node scripts/language-inventory.mjs --bootstrap rewrites the English list and the baseline from the tree
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LISTS = join(raiz, 'scripts/word-lists.json');
export const BASELINE = join(raiz, 'docs/6-DevOps-SRE/language-debt.json');

/**
 * THE NAMES A FILE DECLARES, asked of the PARSER and not of a regular expression.
 *
 * 🔴 IT TOOK A RED BUILD TO PROVE THIS FILE NEEDED IT. The rule was `/(const|let|var|function|class|interface|type|enum)\s+
 * (\w+)/`, and the sentence «Every function here takes what it needs», in a module header, made this script report an
 * identifier called `here`. 📏 And the damage was not one word: measured on the day, **558 of the 1001 «Portuguese
 * identifiers» it reported were PROSE** — `boot/create-game.ts` alone went from 367 to 20 — because a repository whose
 * comments are half in Portuguese and quote code in backticks feeds that expression all day long.
 *
 * 🎯 It is the same family of defect the rename tool hit five times in phase 2 — not telling a NAME from a WORD — and the
 * answer is the one that ended it there: the repository ships a parser, and a parser knows what a declaration is.
 *
 * ⚠️ IMPORTS ARE NOT DECLARATIONS, and that was measured before: `import { type OnDeviceAvailability }` matched `type X` and
 * made `platform/reading` — written entirely in English — carry three Portuguese names belonging to the module it imports
 * from. With the parser it falls out for free: an import clause is not a declaration node.
 *
 * 📌 What counts, and it is the same set the expression tried to cover: variables, functions, classes, interfaces, type
 * aliases and enums, at any depth. Parameters and members do NOT count — they are the debt the Dev left out of this release
 * (310 public members), and widening this is a decision, not a fix.
 */
export const declaredNames = (src) => {
  const sf = ts.createSourceFile('m.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const nomes = [];
  const anda = (n) => {
    const declara = ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)
      || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isEnumDeclaration(n);
    if (declara && n.name && ts.isIdentifier(n.name)) nomes.push(n.name.text);
    n.forEachChild(anda);
  };
  sf.forEachChild(anda);
  return nomes;
};

export const EXCEPTIONS = [
  ['app/js/i18n/', 'the dictionaries ARE Portuguese, English and Spanish — pilar 3 of ADR-0010'],
  ['app/js/educational/', 'curriculum content is written in pt-BR, not translated (ADR-0032)'],
  ['app/js/consumer-quiz/', 'the demo cartridge: it is a game, and games are not this package'],
];

/*
 * 🔴 TRACKED **AND** UNTRACKED, and this gate is where the defect was first paid for. `git ls-files` alone answers «what is
 * already stored», and the question here is «what exists»: on 21/09 six Portuguese identifiers passed because the suite ran
 * with the module still outside the index, and on 22/09 it happened AGAIN — `ui/pause-markup.ts` was born with a Portuguese
 * name and a sentence this script read as a declaration, the suite was green while the file was untracked, and the commit
 * went in red. A module has to be measured the minute it is born, which is when renaming it is still free.
 *
 * ⚠️ `--exclude-standard` keeps `.gitignore` in force, so `dist/` and temporaries stay out. `code-health.mjs` was given the
 * same treatment at birth for the same reason; this file is the one that taught it.
 */
const listar = (...args) => execFileSync('git', args, { cwd: raiz }).toString().split(/\r?\n/).filter(Boolean);
export const source = () => [...new Set([...listar('ls-files', 'app/js'), ...listar('ls-files', '--others', '--exclude-standard', 'app/js')])]
  .filter((f) => f.endsWith('.ts') && !EXCEPTIONS.some(([p]) => f.startsWith(p)));

/** camelCase, PascalCase and snake_case into the words a reader actually reads; anything under three letters is noise. */
export const words = (identifier) => identifier
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z]+/)
  .map((w) => w.toLowerCase()).filter((w) => w.length >= 3);

export function readLists() {
  const l = JSON.parse(readFileSync(LISTS, 'utf8'));
  return { pt: new Set(l.portuguese), en: new Set(l.english) };
}

/** Per file: the identifiers with a Portuguese word, and the words no list knows. */
export function inventory(lists = readLists()) {
  const debt = {}, unknown = new Map();
  for (const f of source()) {
    const nomes = [];
    for (const nome of declaredNames(readFileSync(join(raiz, f), 'utf8'))) {
      const ws = words(nome);
      if (ws.some((w) => lists.pt.has(w))) nomes.push(nome);
      for (const w of ws) if (!lists.pt.has(w) && !lists.en.has(w)) unknown.set(w, (unknown.get(w) ?? 0) + 1);
    }
    if (nomes.length) debt[f] = nomes.length;
  }
  return { debt, unknown: [...unknown.keys()].sort() };
}

export const readBaseline = () => JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arranque = process.argv.includes('--bootstrap');
  const lists = readLists();
  if (arranque) {
    // every word a declaration uses and the Portuguese list does not claim is English, once — after that, a new word is unknown
    const todas = new Set();
    for (const f of source()) for (const nome of declaredNames(readFileSync(join(raiz, f), 'utf8'))) for (const w of words(nome)) todas.add(w);
    const en = [...todas].filter((w) => !lists.pt.has(w)).sort();
    const atual = JSON.parse(readFileSync(LISTS, 'utf8'));
    writeFileSync(LISTS, `${JSON.stringify({ ...atual, english: en }, null, 2)}\n`);
    lists.en = new Set(en);
  }
  const { debt, unknown } = inventory(lists);
  const total = Object.values(debt).reduce((a, b) => a + b, 0);
  if (arranque) {
    writeFileSync(BASELINE, `${JSON.stringify({
      measured: new Date().toISOString().slice(0, 10),
      what: 'Declared identifiers carrying a Portuguese word, per file. The gate refuses any increase; run --bootstrap to record a decrease.',
      total,
      files: Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b))),
    }, null, 2)}\n`);
  }
  console.log(`${source().length} files · ${total} identifiers with a Portuguese word in ${Object.keys(debt).length} files`);
  if (unknown.length) console.log(`unknown words (classify them in scripts/word-lists.json): ${unknown.join(' ')}`);
}
