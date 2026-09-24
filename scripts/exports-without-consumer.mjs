#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Which exported names does nothing in THIS repository import — no engine module, no engine test, no script
// (ADR-0170 §3, issue #164)?
//
// 🔴 IT STOPPED ASKING THE GAMES ON 2026-09-22, and the correction is the Dev's, in his own words: «ESQUEÇA QUE VOCÊ VÊ
// CONSUMIDORES! NENHUMA ENGINE É FEITA COM REPOSITÓRIOS DE CONSUMIDORES VISÍVEIS! SE ESSA ENGINE SOBE NUM REPOSITÓRIO,
// NEM VERÍAMOS QUEM A CONSOME!» He is right, and the price of the old rule is measured: the ledger could not be
// regenerated while a sibling repository lagged behind, so it was edited BY HAND three times in two days, and that is
// what issue #205 was about.
//
// 🎯 The rule is now internal: a published name that nothing inside the engine imports is DEBT — declared here, or
// deleted. Whoever consumes the engine adapts to the new version, which is how every published engine works.
//
// ⚠️ And the 50 names that used to be excused by «a cartridge imports it» were not the intended API — they were reach:
// `platform/audio._footCount`, `core/collision.isWcRampRiser`, `render/recycling-tex.BIN_H`. Letting a consumer's reach
// define legitimate surface is exactly what the Dev's correction removes.
//
// ⚠️ An export used by an engine test counts as consumed: the pure halves are exported to be tested in node, and the
// ADR asks that a name be NEEDED, not that only games need it.

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
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
  // 🔴 A DEFAULT BINDING BEFORE THE BRACES USED TO HIDE THE WHOLE LIST: `import i18n, { initI18n, dictionaryGaps } from …`
  // did not match, because the expression demanded the brace right after `import` — and both names showed up as having
  // no consumer the moment the root also imported the object. A ledger that loses importers because of the SHAPE an
  // import is written in lets names be deleted that somebody uses.
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

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'exports-without-consumer.mjs') {
  const raiz = process.cwd();
  const debt = semImportadorNoRepositorio(raiz);
  const sobre = 'Published names nothing in THIS repository imports — no engine module, no test, no script '
    + '(ADR-0170 §3, issue #164). Each one is DEBT: make it internal, delete it, or give it a consumer here. '
    + 'The list only shrinks, and it is regenerated with `node scripts/exports-without-consumer.mjs`; the gate is '
    + '`tests/exports-without-consumer.node.test.js`. 🔴 It used to excuse a name because a sibling GAME imported it, '
    + 'and that ended on 2026-09-22 by the Dev\'s correction: an engine is published without its consumers in sight, '
    + 'so what a cartridge reaches for cannot define legitimate surface — and waiting for those repositories is what '
    + 'made this file un-regenerable (issue #205).';
  writeFileSync(join(raiz, LISTA_DE_CONSUMIDORES), JSON.stringify({ about: sobre, debt }, null, 2) + '\n');
  const nDebt = Object.values(debt).reduce((t, v) => t + v.length, 0);
  console.log(`debt: ${nDebt} names in ${Object.keys(debt).length} modules`);
}
