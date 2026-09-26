// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY KEY A MODULE ASKS FOR IS DECLARED (ADR-0074; ADR-0169; issue #164).
//
// 🔴 WHY THIS GATE EXISTS, and it is a hole this repository could not see. `tests/i18n-dicts.node.test.js` makes the three
// dictionaries agree WITH EACH OTHER, and `lacunasDosDicionarios` reports a cartridge key registered in one language and not
// another. Neither can see a key that exists in NONE of them: there is nothing to compare it against. And `t()` falls back to
// returning the key, so the failure is silent by construction — the child is simply shown `motor.cooldown.dica`.
//
// 📏 Measured on 2026-09-23, in a booted engine with the panels open: TWO of them, and both had shipped.
//   · `boot/create-game` asked for `motor.cooldown.dica`; the dictionaries declare `motor.espera.dica`. The mobility panel's
//     footer showed the key to a child who focused «Esperar entre toques».
//   · `ui/vlibras` asked for `sr.libras.on`, which was never added to any dictionary — introduced with the code in
//     `b0239e91` and broken since. The text goes to the VLibras widget to be SIGNED, so the first thing the interpreter
//     signed to a deaf child turning the mode on was the identifier.
//
// 📌 WHAT IS CHECKED, and what deliberately is not: a `t()` whose first argument is a plain string literal. A key BUILT at
// runtime (`t('sr.nav.dir.' + r.heading)`, `t(`sim.indisponivel.${motivo}`)`) cannot be resolved by reading the source, and
// pretending otherwise would make the gate lie. Those live behind their own cases. 📏 Seven such sites today.
//
// ⚠️ The source is PARSED, never matched with an expression: this repository learned in phase 2 of the English plan, five
// times over, that telling code from text is lexing. A `t('…')` inside a comment is not a call.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import pt from '../app/js/i18n/pt.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Tracked AND untracked, for the reason the code-health gate already records: `git ls-files` answers «what is stored» and the
 * question here is «what exists». A module still outside the index is exactly where a key typed yesterday is hiding.
 */
function modulesOfTheEngine() {
  // ONE `git` process asks both questions: `--cached` is what `ls-files` lists by default, and `--others` adds what is not
  // yet in the index — the union two processes used to build by hand.
  const list = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  // 📌 The proof consumer (`app/js/consumer-quiz/`) asks for ITS OWN keys, which live in its own dictionary (ADR-0232 D3) and not
  // in the engine's: they are held by `consumer-quiz.node.test.js` against both dictionaries, `translate(…)` calls included.
  // This engine gate reading the consumer's dictionary would make it an engine test that needs the consumer to run.
  return [...new Set(list('ls-files', '--cached', '--others', '--exclude-standard', 'app/js'))]
    .filter((f) => f.endsWith('.ts') && !f.startsWith('app/js/i18n/') && !f.startsWith('app/js/consumer-quiz/'));
}

// ⚠️ The predicates are bound once, and neither JSDoc nor parent links are built, for the reasons
// `scripts/lib/module-specifiers.mjs` gives: under Vitest each `ts.isX` in a walk over every node of the tree is a read
// through a transformed module; `forEachChild` never enters a JSDoc node, so a `t()` inside a comment was never a call; and
// the walk never climbs to a parent — `getStart(sf)` reads the text it is handed.
const {
  createSourceFile, ScriptTarget, ScriptKind, JSDocParsingMode, isCallExpression, isIdentifier, isStringLiteral, forEachChild,
} = ts;
const PARSE = { languageVersion: ScriptTarget.Latest, jsDocParsingMode: JSDocParsingMode.ParseNone };

/**
 * ⚠️ A FILE THAT CANNOT HOLD A CALL TO `t` IS NOT PARSED — and that is not the expression this header refuses, because it
 * never says what IS a call: the parser still decides that, in every file this lets through. It only says which files
 * cannot have one, and it is exact. A call the walk counts is the identifier `t`, then only what may stand between a callee
 * and its arguments — whitespace, a comment (which opens with `/`), type arguments (`<`) or an optional call (`?.`) — then
 * `(`. The identifier is spelled `t`, not glued to a word character before it (that would be a longer name), or through an
 * escape (`t`), which puts a backslash in the text. 📏 2026-09-25: 65 of 181 modules, ~1.2 of ~2.0 MB, are parsed.
 */
const CAN_CALL_T = /\bt\s*[(<?/]/;
const canCallT = (text) => CAN_CALL_T.test(text) || text.includes('\\');

/** Every `t('key')` in a file, by position — a literal first argument, and nothing else. */
function literalKeysOf(file) {
  const text = readFileSync(join(ROOT, file), 'utf8');
  if (!canCallT(text)) return [];
  const sf = createSourceFile(file, text, PARSE, false, ScriptKind.TS);
  const found = [];
  const walk = (node) => {
    if (isCallExpression(node) && isIdentifier(node.expression) && node.expression.text === 't') {
      const arg = node.arguments[0];
      if (arg && isStringLiteral(arg)) {
        const { line } = sf.getLineAndCharacterOfPosition(arg.getStart(sf));
        found.push({ key: arg.text, where: `${file}:${line + 1}` });
      }
    }
    forEachChild(node, walk);
  };
  walk(sf);
  return found;
}

/**
 * Every literal call site of the engine, the tree listed and parsed ONCE for the whole file. Both cases below read the same
 * tree, and each used to list it (two `git` processes) and parse it again — the repeat that pushed them past the 5 s
 * ceiling under the load of several suites at once. A red that comes from the machine and not the code invalidates
 * whatever is measured beside it; the fix is the work shrinking, never the clock growing.
 */
let callSites;
const literalKeysOfTheEngine = () => (callSites ??= modulesOfTheEngine().flatMap((f) => literalKeysOf(f)));

describe('every key a module asks for is declared', () => {
  it('🔴 [Right] no `t(\'literal\')` in app/js resolves to nothing', () => {
    const missing = [];
    for (const { key, where } of literalKeysOfTheEngine()) if (!(key in pt)) missing.push(`${where}  ${key}`);
    expect(missing, 'a key with no entry is shown to the child AS THE KEY — `t()` falls back to it').toEqual([]);
  });

  it('🎯 [Cross-check] the gate is reading real call sites — a case that finds nothing would pass empty', () => {
    // Without this, a walk that never matched a `t()` would report zero missing keys and look like a clean tree.
    const all = literalKeysOfTheEngine();
    expect(all.length, 'no `t()` call site was found at all — the walk is broken, not the tree clean').toBeGreaterThan(200);
    expect(all.some(({ key }) => key === 'motor.espera.dica')).toBe(true);
  });

  it('⚠️ [Boundary] a key BUILT at runtime is not claimed to be checked', () => {
    // `t('sr.nav.dir.' + r.heading)` passes a BinaryExpression, not a literal, so it never enters the list above — and the
    // prefix `sr.nav.dir.` is not a key. A gate that counted it would fail on code that is correct.
    const sonar = literalKeysOf('app/js/platform/audio-sonar.ts').map((x) => x.key);
    expect(sonar).not.toContain('sr.nav.dir.');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   K1 the root's key back to `motor.cooldown.dica` (the shipped typo)  🔴 resolves to nothing · Cross-check
//   K2 `sr.libras.on` removed from pt.ts (the shipped hole)             🔴 resolves to nothing
//      📌 re-pointed 2026-09-25: the greeting left with ADR-0234; its successor `sr.deaf.noSigning` removed from pt.ts
//      🔴 resolves to nothing (and `i18n-dicts` goes red too)
//   K3 GATE: `forEachChild` dropped, so the walk stops descending   🔴 Cross-check — 0 call sites found, and that is
//                                                                          exactly the empty pass the case exists to refuse
//   K4 GATE: any first argument taken as a key, built ones included     🔴 resolves to nothing
//   (2026-09-25, when a file that cannot call `t` stopped being parsed — each in a module with no `t(` and no backslash:)
//   P1 `t /* why */ ('missing')`                                        🔴 resolves to nothing
//   P2 `t?.('missing')`                                                 🔴 resolves to nothing
//   P3 `t<string>('missing')`                                           🔴 resolves to nothing
//   P4 `t('missing')` — the callee spelled with an escape          🔴 resolves to nothing
//   P5 GATE: the filter answering «cannot» for every file              🔴 Cross-check — 0 call sites found
//
//   ⚠️ [Boundary] is NOT red under K4, and my prediction that it would be was wrong. Measured: with any argument accepted,
//   a built key arrives as a BinaryExpression whose `.text` is `undefined` — so it is reported as a missing key and not as
//   the prefix `sr.nav.dir.`. What that case actually pins is PARSER over expression, and the thing that makes it red is an
//   implementation that reads the argument's SOURCE instead of a literal's VALUE. 📏 That implementation was written first,
//   on 2026-09-23, and it reported `sr.nav.dir.`, `pause.` and `reach.nome.` as missing keys — three call sites that are
//   correct. Left as a boundary the file DECLARES rather than a mutation contrived to make it red.
