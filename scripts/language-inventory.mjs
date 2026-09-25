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
 * aliases and enums, at any depth. MEMBERS still do not count — they are the 310 the Dev left out of this release, and they
 * enter with the second half of step 7h; PARAMETERS entered on 2026-09-22 and live in `parameterNames` below.
 */
export const declaredNames = (src) => colher(src, (n) => ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)
  || ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isEnumDeclaration(n));

/**
 * THE NAMES A FILE'S PARAMETERS USE — the Dev's «Parâmetros e membros no plano, por favor» (2026-09-22), first half.
 *
 * 🔴 IT TOOK A NAME LIVING A WHOLE DAY IN A FILE THE GATE CALLED CLEAN. `sanitiseTeaLevel(bruto, padrao)` was written into a
 * module this very gate had required to be born at zero, and the gate saw neither word: it read DECLARATIONS, and a parameter
 * is not one. 📏 Which means every number this file ever reported was a LOWER BOUND, the same way the «185 file names» of
 * phase 3 turned out to be.
 *
 * 📌 Destructuring counts too (`({ raiz, filhos })`): each binding element is a name a reader reads, and leaving them out
 * would reopen the same hole one syntax down.
 *
 * ⚠️ MEASURED AND COUNTED APART from the declarations, and that is a decision rather than bookkeeping: on one blended number
 * a new Portuguese declaration hides behind a renamed parameter, and the ratchet would report progress while the surface got
 * worse. Each category holds its own line.
 */
export const parameterNames = (src) => colher(src, (n) => ts.isParameter(n) || ts.isBindingElement(n));

/**
 * THE MEMBERS A FILE DECLARES — the second half of the Dev's «Parâmetros e membros no plano, por favor».
 *
 * 📌 These are the 310 he left out of the renaming release (ADR-0219): `CreateGameOptions.baixarPesados`,
 * `Declinios.semVozNeural`, the ctx fields a cartridge fills. MEASURING them is a commit; RENAMING them is phase 7, and the
 * split is what keeps this cheap.
 *
 * ⚠️ AND MANY MEMBERS ARE NOT NAMES THIS TREE CHOSE, which was measured and not supposed: `clientX`, `getChannelData`,
 * `num_attention_heads`, `webkitRequestFullscreen` are foreign API surfaces this engine merely MIRRORS in an interface so
 * the type checker can see them. They are counted anyway, and that is the honest answer rather than a carve-out: the debt
 * this file reports is «identifiers carrying a PORTUGUESE word», and a foreign API contributes zero to it — the only cost
 * of counting them is that their words had to be classified, and `client`, `channel` and `attention` ARE English. A rule
 * that tried to exclude them would need to guess which interface mirrors what, and a guess in a sieve is worse than a
 * number that is merely larger.
 */
export const memberNames = (src) => colher(src, (n) => ts.isPropertySignature(n) || ts.isPropertyDeclaration(n)
  || ts.isMethodSignature(n) || ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n)
  || ts.isSetAccessorDeclaration(n) || ts.isEnumMember(n));

/** The identifier names of every node the predicate accepts, at any depth. One walk, one rule. */
function colher(src, aceita) {
  const sf = ts.createSourceFile('m.ts', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const nomes = [];
  const anda = (n) => {
    if (aceita(n) && n.name && ts.isIdentifier(n.name)) nomes.push(n.name.text);
    n.forEachChild(anda);
  };
  sf.forEachChild(anda);
  return nomes;
}

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
// ONE `git` process asks both questions: `--cached` is what `ls-files` lists by default and `--others` adds what is not yet
// in the index — the same union two processes used to build.
const listar = (...args) => execFileSync('git', args, { cwd: raiz }).toString().split(/\r?\n/).filter(Boolean);
export const source = () => [...new Set(listar('ls-files', '--cached', '--others', '--exclude-standard', 'app/js'))]
  .filter((f) => f.endsWith('.ts') && !EXCEPTIONS.some(([p]) => f.startsWith(p)));

/** camelCase, PascalCase and snake_case into the words a reader actually reads; anything under three letters is noise. */
export const words = (identifier) => identifier
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z]+/)
  .map((w) => w.toLowerCase()).filter((w) => w.length >= 3);

export function readLists() {
  const l = JSON.parse(readFileSync(LISTS, 'utf8'));
  return { pt: new Set(l.portuguese), en: new Set(l.english) };
}

/**
 * Per file: how many identifiers carry a Portuguese word, SPLIT by what kind of name it is, and the words no list knows.
 *
 * 📌 `{ decl, param }` and not one number, for the reason written at `parameterNames`: a blended total lets a new Portuguese
 * declaration hide behind a renamed parameter.
 */
export function inventory(lists = readLists()) {
  const debt = {}, unknown = new Map();
  const conta = (nomes) => {
    let n = 0;
    for (const nome of nomes) {
      const ws = words(nome);
      if (ws.some((w) => lists.pt.has(w))) n += 1;
      for (const w of ws) if (!lists.pt.has(w) && !lists.en.has(w)) unknown.set(w, (unknown.get(w) ?? 0) + 1);
    }
    return n;
  };
  for (const f of source()) {
    const src = readFileSync(join(raiz, f), 'utf8');
    const d = { decl: conta(declaredNames(src)), param: conta(parameterNames(src)), membro: conta(memberNames(src)) };
    if (CATEGORIES.some((c) => d[c])) debt[f] = d;
  }
  return { debt, unknown: [...unknown.keys()].sort() };
}

/** The three categories a file's debt is counted in, each holding its own line in the ratchet. */
export const CATEGORIES = ['decl', 'param', 'membro'];

/** The debt of one file in the shape the baseline stores, tolerating the shapes the baseline used to hold. */
export const debtOf = (entrada) => {
  const base = { decl: 0, param: 0, membro: 0 };
  return typeof entrada === 'number' ? { ...base, decl: entrada } : { ...base, ...(entrada ?? {}) };
};

export const readBaseline = () => JSON.parse(readFileSync(BASELINE, 'utf8'));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arranque = process.argv.includes('--bootstrap');
  const lists = readLists();
  /*
   * ⚠️ `--bootstrap` CLASSIFIES NOTHING. Declaring English every word the Portuguese list did not claim is how PROSE read
   * as a declaration taught the gate that `cor`, `ela`, `derivada`, `trampolim` and `ojogo` were English — an identifier
   * named `cor` would have passed. Classifying is the act of READING the declaration where the word is born, so it is done
   * by hand: `--bootstrap` only writes the baseline, which is a count and not a judgement.
   */
  const { debt, unknown } = inventory(lists);
  const somaDe = (cat) => Object.values(debt).reduce((a, d) => a + d[cat], 0);
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, somaDe(c)]));
  const total = CATEGORIES.reduce((a, c) => a + totals[c], 0);
  if (arranque) {
    writeFileSync(BASELINE, `${JSON.stringify({
      measured: new Date().toISOString().slice(0, 10),
      what: 'Identifiers carrying a Portuguese word, per file, split by what kind of name it is: `decl` (variables, functions, '
        + 'classes, interfaces, type aliases, enums), `param` (parameters and destructured bindings) and `membro` (properties, '
        + 'methods, accessors and enum members). The gate refuses any increase IN ANY of the three, so a renamed parameter '
        + 'cannot hide a new Portuguese declaration. Run --bootstrap to record a decrease. 📌 `membro` is the debt phase 7 of '
        + 'the English plan renames (ADR-0219); measuring it is this file, renaming it is a breaking release.',
      total,
      totals,
      files: Object.fromEntries(Object.entries(debt).sort(([a], [b]) => a.localeCompare(b))),
    }, null, 2)}\n`);
  }
  console.log(`${source().length} files · ${total} identifiers with a Portuguese word in ${Object.keys(debt).length} files`);
  console.log(`   ${CATEGORIES.map((c) => `${c} ${totals[c]}`).join(' · ')}`);
  if (unknown.length) console.log(`unknown words (classify them in scripts/word-lists.json, by READING where each is born): ${unknown.join(' ')}`);
}
