#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE FOUR MEASURES OF CODE HEALTH, AND THE BASELINE THEY RATCHET AGAINST (ADR-0221, issue #203).
//
// 🔴 WHY THIS EXISTS. The engine gates the language, the DIRECTION of its dependencies (ADR-0173), its public surface, its
// exports without a consumer and the pointers its records make — and gates NOTHING about size, complexity or coupling. The
// layer gate asks which way an import points, never how many there are: a module may import 77 things downward and pass green.
// 📏 And one did: `boot/create-game.ts` reached 2185 lines — 11% of all the engine's code in one file — with 330 decision nodes
// and fan-out 77, while every gate stayed green. What nothing measures comes back.
//
// ⚠️ NOTHING HERE IS A SCORE, and that is the decision and not a limitation. The paper these dimensions come from
// (arXiv:2409.15152) measured its own raters: maintainability has ICC 0.52 among ten experts with ten years each, and r = 0.30
// against their model. A number presented as quality would be obeyed more than it deserves. The gate built on this file answers
// one question — «did anything get worse?» — and the answer is yes or no.
//
// ⚠️ AND COHESION IS NOT HERE, on purpose. LCOM and its family assume classes with fields; this tree is modules of functions,
// and a number that means nothing is worse than none, because it would be obeyed anyway. What stands in its place is the
// co-change table of `docs/ARCHITECTURE.md` §3.3 — files edited in the same commit are the honest evidence of what belongs
// together, and a long row there is a hypothesis about a missing abstraction.
//
// Use: `node scripts/code-health.mjs` prints the tree's state · `--write` rewrites the baseline, which is a DECISION and not a
// routine: a baseline rewritten to make a red build green is the ratchet being unscrewed.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
export const BASELINE = 'docs/6-DevOps-SRE/code-health.json';
const posix = (p) => p.split('\\').join('/');

/**
 * ⚠️ THE EXEMPTIONS ARE TWO, EACH WITH ITS REASON, AND THERE ARE NO OTHERS (ADR-0221). An exemption list that grows on demand
 * is how a gate stops being one.
 */
export const EXEMPT = {
  // The composition root wires everything, which is its job (ADR-0173) — so fan-out is not its debt. Its LINES, BRANCHES and
  // DEPTH are, and it is not exempt on those: 2185 lines and 330 decision nodes are logic, not wiring.
  'boot/create-game.ts': ['fanOut'],
  // The three dictionaries are DATA. 621 lines of sentences a child reads is not complexity, and splitting them would only
  // make a translator open three files instead of one.
  'i18n/pt.ts': ['*'], 'i18n/en.ts': ['*'], 'i18n/es.ts': ['*'],
};

export const MEASURES = ['codeLines', 'decisionNodes', 'maxDepth', 'fanOut', 'globalReach'];

/*
 * 🔴 A QUINTA MEDIDA É O QUE UM MÓDULO ALCANÇA, e ela entrou porque as outras quatro não a viam (ADR-0221, passo 7d, issue
 * #203). O artigo lista a INJECÇÃO DE DEPENDÊNCIA entre as dimensões que pesa, e esta engine pratica-a — o hospedeiro é
 * injectado (ADR-0178), o relógio é injectado, o `fetch` é injectado. O defeito que VOLTA é o alcance directo: `rotularLinha`
 * a ler `CSS.escape` foi exactamente isso, em 21/09.
 *
 * ⚠️ E O PORTÃO DAS CAMADAS NÃO O APANHA, que é a razão de esta medida existir: o `dependencies-point-downward` confere
 * IMPORTS, e um módulo que não importa ninguém e toca no `document` passa verde. 📏 Medido em 22/09: 23 de 188 módulos
 * alcançam um global — e dois deles estão em `core/`, a camada que o ADR-0173 descreve como «o que a engine É, SEM navegador».
 */
const BROWSER_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'performance', 'fetch', 'CSS'];

/** Is this module exempt from this measure? */
export const isExempt = (mod, measure) => {
  const e = EXEMPT[mod];
  return !!e && (e.includes('*') || e.includes(measure));
};

/*
 * WHAT EACH MEASURE IS, defined by what the parser can see rather than by its name — the names are borrowed and the definitions
 * have to be ours:
 *   · codeLines     — lines that are neither blank nor a comment. Comments are 55% of some files here and are not complexity.
 *   · decisionNodes — `if`, the four loops, `switch`, `catch` and the ternary: every place a reader has to hold a branch.
 *   · maxDepth      — the deepest nesting of those. 📏 Depth 11 exists in this tree, in `input/gamepad.ts`.
 *   · fanOut        — DISTINCT relative imports. A package import is not coupling inside this tree.
 */
export function measureModule(text) {
  const sf = ts.createSourceFile('m.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let decisionNodes = 0, maxDepth = 0;
  const imports = new Set();

  const walk = (node, depth) => {
    let d = depth;
    if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)
      || ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isSwitchStatement(node) || ts.isCatchClause(node)
      || ts.isConditionalExpression(node)) {
      d += 1; decisionNodes += 1; maxDepth = Math.max(maxDepth, d);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.startsWith('.')) imports.add(node.moduleSpecifier.text);
    node.forEachChild((k) => walk(k, d));
  };
  sf.forEachChild((n) => walk(n, 0));

  /*
   * ⚠️ LIDO PELO PARSER E NÃO POR GREP, e a diferença é o que torna a medida utilizável: `document` aparece em comentários,
   * em nomes de propriedade (`o.document`), em parâmetros (`doc = document`) e em cadeias. O que conta é um IDENTIFICADOR NU
   * que se resolve no global — o resto é prosa ou é injecção, que é precisamente o contrário do defeito.
   */
  const reached = new Set();
  const look = (node) => {
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.includes(node.text)) {
      const p = node.parent;
      const isPropertyName = p && ts.isPropertyAccessExpression(p) && p.name === node;
      const isDeclared = p && (ts.isParameter(p) || ts.isPropertySignature(p) || ts.isPropertyAssignment(p) || ts.isBindingElement(p));
      if (!isPropertyName && !isDeclared) reached.add(node.text);
    }
    node.forEachChild(look);
  };
  sf.forEachChild(look);

  const codeLines = text.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
  return {
    codeLines, decisionNodes, maxDepth, fanOut: imports.size, globalReach: reached.size,
    imports: [...imports], reached: [...reached].sort(),
  };
}

/** The whole tree: `{ 'core/ring.ts': {codeLines, decisionNodes, maxDepth, fanOut, fanIn} }`, keyed as the portrait keys. */
export function measureTree() {
  /*
   * 🔴 RASTREADOS **E** POR RASTREAR, e isto é um defeito conhecido desta casa a ser fechado à nascença: o portão do português
   * ficou verde sobre um módulo com seis identificadores portugueses porque a suíte correu com ele ainda fora do índice
   * (21/09). `git ls-files` sozinho responde «o que já está guardado», e a pergunta aqui é «o que existe» — um módulo novo tem
   * de ser medido no minuto em que nasce, que é quando parti-lo ainda é barato. O `--exclude-standard` mantém o `.gitignore`
   * a valer, logo nada de `dist/` nem de temporários entra.
   */
  const lista = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  const files = [...new Set([...lista('ls-files', 'app/js'), ...lista('ls-files', '--others', '--exclude-standard', 'app/js')])]
    .filter((f) => f.endsWith('.ts'));
  const raw = new Map();
  for (const f of files) raw.set(f, measureModule(readFileSync(join(ROOT, f), 'utf8')));

  // fan-in is counted here and NEVER limited: `core/dom-query.ts` is 4 lines with fan-in 17, which is the shape to copy.
  const fanIn = new Map();
  for (const [f, m] of raw) {
    for (const spec of m.imports) {
      const target = posix(relative(ROOT, resolve(join(ROOT, dirname(f)), spec))).replace(/\.js$/, '.ts');
      fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
    }
  }
  const out = {};
  for (const [f, m] of [...raw].sort(([a], [b]) => a.localeCompare(b))) {
    const key = f.replace('app/js/', '');
    out[key] = {
      codeLines: m.codeLines, decisionNodes: m.decisionNodes, maxDepth: m.maxDepth, fanOut: m.fanOut,
      globalReach: m.globalReach, fanIn: fanIn.get(f) ?? 0,
      // 📌 QUAIS os globais, e não só quantos: uma catraca sobre um número diz que piorou, e esta linha diz o que muda para o
      // pagar. Só aparece onde há algum, para a linha de base não engordar com listas vazias.
      ...(m.reached.length ? { reached: m.reached } : {}),
    };
  }
  return out;
}

/** The p90 of a measure over the modules that are NOT exempt from it — the ceiling a new module is born under. */
export function ceilingFrom(modules) {
  const teto = {};
  for (const measure of MEASURES) {
    /*
     * ⚠️ O ALCANCE A GLOBAIS NÃO TEM p90: o tecto é ZERO, e por uma razão que não vem da literatura nem de um percentil. Esta
     * engine DECIDIU que o hospedeiro é injectado (ADR-0178) e que `core` não conhece navegador (ADR-0173); um módulo novo que
     * alcança o `document` está a desfazer uma decisão, não a ficar acima de uma média. 📏 Os 23 que já o fazem ficam
     * congelados pela catraca e só podem encolher — é dívida, e dívida não vira licença.
     */
    if (measure === 'globalReach') { teto[measure] = 0; continue; }
    const vals = Object.entries(modules).filter(([m]) => !isExempt(m, measure)).map(([, v]) => v[measure]).sort((a, b) => a - b);
    teto[measure] = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))];
  }
  return teto;
}

export const readBaseline = () => JSON.parse(readFileSync(join(ROOT, BASELINE), 'utf8'));

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'code-health.mjs') {
  const modules = measureTree();
  const ceiling = ceilingFrom(modules);
  const nomes = Object.keys(modules);
  const soma = (k) => nomes.reduce((a, n) => a + modules[n][k], 0);

  if (process.argv.includes('--write')) {
    writeFileSync(join(ROOT, BASELINE), `${JSON.stringify({
      about: 'ADR-0221 — the four measures of code health. A RATCHET, never a score: `tests/code-health.node.test.js` refuses a '
        + 'module that got worse and a new module above the ceiling. Rewrite this file only when a debt is PAID or a module is '
        + 'legitimately split — rewriting it to green a red build is the ratchet being unscrewed.',
      takenOn: new Date().toISOString().slice(0, 10),
      ceiling, exempt: EXEMPT, modules,
    }, null, 2)}\n`);
    console.log(`baseline escrita: ${nomes.length} módulos`);
  }
  console.log(`📏 ${nomes.length} módulos · ${soma('codeLines')} linhas de código · ${soma('decisionNodes')} nós de decisão`);
  console.log(`   tecto (p90): ${MEASURES.map((m) => `${m} ${ceiling[m]}`).join(' · ')}`);
  for (const m of MEASURES) {
    const pior = [...nomes].sort((a, b) => modules[b][m] - modules[a][m]).slice(0, 3);
    console.log(`   ${m.padEnd(14)} ${pior.map((p) => `${p} ${modules[p][m]}`).join(' · ')}`);
  }
}
