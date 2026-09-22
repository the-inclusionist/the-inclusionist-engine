#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Which exported names does nothing import — no engine module, no engine test, no cartridge (ADR-0170 §3, issue #164)?
//
// Two uses:
//  • `tests/exports-without-consumer.node.test.js` calls `semImportadorNoRepositorio()`: the half that runs in CI, where
//    the sibling game repositories are not checked out.
//  • `node scripts/exports-without-consumer.mjs --catalogue ..` measures the sibling repositories too and rewrites
//    `docs/6-DevOps-SRE/exports-without-consumer.json`: the names a cartridge imports (named, with the place) and the
//    debt of names nobody imports, which only shrinks.
//
// ⚠️ An export used by an engine test counts as consumed: the pure halves are exported to be tested in node, and the
// ADR asks that a name be NEEDED, not that only games need it.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';
import { execFileSync } from 'node:child_process';
import { superficieDe } from './snapshot-public-surface.mjs';

export const LISTA_DE_CONSUMIDORES = 'docs/6-DevOps-SRE/exports-without-consumer.json';

function ficheiros(dir, fora = []) {
  if (!existsSync(dir)) return fora;
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === 'dist' || nome === 'dist-pkg') continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(p, fora);
    else if (/\.(ts|tsx|js|mjs)$/.test(nome)) fora.push(p);
  }
  return fora;
}

const nomesDe = (lista) => lista.split(',').map((s) => s.trim().replace(/^type\s+/, '').split(/\s+as\s+|\s*:\s*/)[0]).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));

/**
 * Every `module name` a source file imports, given how it spells a module path → `app/js`-relative `.ts` (or null).
 * Named imports, `export {…} from`, `const {…} = await import(…)`, and namespaces (`import * as m`, `const m = await
 * import(…)`) read as every `m.name` in the same file.
 */
export function importacoesDoTexto(txt, resolver) {
  const fora = [];
  const pares = (lista, esp) => { const mod = resolver(esp); if (mod) for (const n of nomesDe(lista)) fora.push(`${mod} ${n}`); };
  // 🔴 O LIGAMENTO PADRÃO ANTES DAS CHAVES ESCONDIA A LISTA INTEIRA, medido em 2026-09-22: `import i18n, { initI18n,
  // dictionaryGaps } from …` não casava, porque a expressão exigia a chaveta colada ao `import` — e os dois nomes
  // apareceram como «sem consumidor» no instante em que a raiz passou a importar também o objecto. Um livro que perde
  // importadores por causa da FORMA de escrever o import deixa apagar nomes que alguém usa.
  for (const m of txt.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) pares(m[1], m[2]);
  for (const m of txt.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) pares(m[1], m[2]);
  const espacos = [
    ...[...txt.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g)].map((m) => [m[1], m[2]]),
    ...[...txt.matchAll(/const\s+(\w+)\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => [m[1], m[2]]),
  ];
  for (const [ns, esp] of espacos) {
    const mod = resolver(esp); if (!mod) continue;
    for (const m of txt.matchAll(new RegExp(`\\b${ns}\\.([A-Za-z_$][\\w$]*)`, 'g'))) fora.push(`${mod} ${m[1]}`);
  }
  return fora;
}

/** The `module name` pairs the engine's own code, tests and scripts import. */
export function importadoresNoRepositorio(raiz) {
  const appJs = join(raiz, 'app', 'js');
  const usados = new Set();
  for (const f of [...ficheiros(appJs), ...ficheiros(join(raiz, 'tests')), ...ficheiros(join(raiz, 'scripts'))]) {
    const resolver = (esp) => {
      if (!esp.startsWith('.')) return null;
      const alvo = relative(appJs, join(dirname(f), esp)).split('\\').join('/');
      return alvo.startsWith('..') ? null : alvo.replace(/\.js$/, '.ts');
    };
    for (const k of importacoesDoTexto(readFileSync(f, 'utf8'), resolver)) usados.add(k);
  }
  return usados;
}

/**
 * Exported VALUES nothing in this repository imports, as `{ module: [names] }`.
 * 📌 Types and interfaces are left out: most of them name a parameter or a return of an exported function, and a
 * cartridge that wants to write that type down needs the name even when no one imports it today.
 */
export function semImportadorNoRepositorio(raiz) {
  const usados = importadoresNoRepositorio(raiz);
  const fora = {};
  for (const [mod, nomes] of Object.entries(superficieDe(join(raiz, 'app', 'js')))) {
    const src = readFileSync(join(raiz, 'app', 'js', mod), 'utf8');
    const ehTipo = (n) => new RegExp(`^export\\s+(?:declare\\s+)?(?:interface|type)\\s+${n}\\b`, 'm').test(src);
    const sem = nomes.filter((n) => !ehTipo(n) && !usados.has(`${mod} ${n}`));
    if (sem.length) fora[mod] = sem;
  }
  return fora;
}

/** What the sibling repositories import from the package, as `module name` → `repo file`. */
export function importadoresNoCatalogo(pastaDosIrmaos) {
  const fora = {};
  for (const repo of readdirSync(pastaDosIrmaos)) {
    const dir = join(pastaDosIrmaos, repo);
    if (repo === 'the-inclusionist-engine' || !existsSync(join(dir, 'package.json'))) continue;
    if (!/@the-inclusionist\/engine/.test(readFileSync(join(dir, 'package.json'), 'utf8'))) continue;
    let rastreados;
    try { rastreados = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n'); } catch { continue; }
    for (const rel of rastreados.filter((r) => /\.(ts|tsx|js|mjs)$/.test(r) && !r.startsWith('dist'))) {
      const resolver = (esp) => { const m = esp.match(/^@the-inclusionist\/engine(?:\/(.+))?$/); return m ? (m[1] ? m[1].replace(/\.js$/, '.ts') : 'boot/create-game.ts') : null; };
      for (const k of importacoesDoTexto(readFileSync(join(dir, rel), 'utf8'), resolver)) fora[k] ??= `${repo} ${rel}`;
    }
  }
  return fora;
}

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'exports-without-consumer.mjs') {
  const i = process.argv.indexOf('--catalogue');
  if (i < 0) { console.error('usage: node scripts/exports-without-consumer.mjs --catalogue <folder holding the game repositories>'); process.exit(2); }
  const raiz = process.cwd();
  const catalogo = importadoresNoCatalogo(process.argv[i + 1]);
  const cartridgeConsumers = {};
  const debt = {};
  for (const [mod, nomes] of Object.entries(semImportadorNoRepositorio(raiz))) {
    for (const n of nomes) {
      const onde = catalogo[`${mod} ${n}`];
      if (onde) cartridgeConsumers[`${mod} ${n}`] = onde;
      else (debt[mod] ??= []).push(n);
    }
  }
  const sobre = 'Exports no engine module, test or script imports (ADR-0170 §3, issue #164). cartridgeConsumers: the ones a sibling game repository imports, with the place. debt: the ones nothing imports — candidates to become internal; the list only shrinks. A new export with no importer in this repository names its cartridge here. Rewritten by `node scripts/exports-without-consumer.mjs --catalogue ..`; held by tests/exports-without-consumer.node.test.js.';
  writeFileSync(join(raiz, LISTA_DE_CONSUMIDORES), JSON.stringify({ about: sobre, cartridgeConsumers, debt }, null, 2) + '\n');
  const nDebt = Object.values(debt).reduce((t, v) => t + v.length, 0);
  console.log(`cartridge consumers: ${Object.keys(cartridgeConsumers).length} · debt: ${nDebt} names in ${Object.keys(debt).length} modules`);
}
