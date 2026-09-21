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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LISTS = join(raiz, 'scripts/word-lists.json');
export const BASELINE = join(raiz, 'docs/6-DevOps-SRE/language-debt.json');

/** A declaration's name: what a reader of this repository has to read in English. */
const DECL = /\b(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
/**
 * ⚠️ IMPORTS ARE NOT DECLARATIONS, and this was measured: `import { type OnDeviceAvailability }` matched `type X` and made
 * `platform/reading` — written entirely in English — carry three Portuguese names belonging to the module it imports from.
 * A file answers for the names it CREATES; the neighbour's names are the neighbour's debt.
 */
const semImports = (src) => src.replace(/^\s*import\b[^;]*;/gms, '');

export const EXCEPTIONS = [
  ['app/js/i18n/', 'the dictionaries ARE Portuguese, English and Spanish — pilar 3 of ADR-0010'],
  ['app/js/educational/', 'curriculum content is written in pt-BR, not translated (ADR-0032)'],
  ['app/js/consumer-quiz/', 'the demo cartridge: it is a game, and games are not this package'],
];

export const source = () => execFileSync('git', ['ls-files', 'app/js'], { cwd: raiz }).toString()
  .split(/\r?\n/).filter((f) => f.endsWith('.ts') && !EXCEPTIONS.some(([p]) => f.startsWith(p)));

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
    const src = semImports(readFileSync(join(raiz, f), 'utf8'));
    const nomes = [];
    for (const m of src.matchAll(DECL)) {
      const ws = words(m[1]);
      if (ws.some((w) => lists.pt.has(w))) nomes.push(m[1]);
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
    for (const f of source()) for (const m of semImports(readFileSync(join(raiz, f), 'utf8')).matchAll(DECL)) for (const w of words(m[1])) todas.add(w);
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
