#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Escreve o RETRATO da superfície pública do pacote: cada módulo de `app/js/**` e os nomes que ele exporta.
//
// ⚠️ ISTO NÃO É UM ÍNDICE, É UM COMPROMISSO. `tests/superficie-publica.node.test.js` compara a árvore com o
// retrato e reprova quando um nome DESAPARECE. Correr este script é, portanto, a forma de dizer «sim, esta
// remoção é deliberada» — e o teste manda, na mensagem de reprovação, escrever o rodapé `BREAKING CHANGE:`
// no commit, que é a informação que faltava nos cinco quebrantes de 2026-09-07.
//
// Uso: `node scripts/snapshot-public-surface.mjs` (reescreve o retrato)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const RETRATO = 'docs/6-DevOps-SRE/public-surface.json';

/** Um `export` NOMEADO. Re-exports (`export { x } from …`) e `export default` ficam de fora de propósito:
 *  o primeiro é indireção do mesmo nome, e este projeto não usa o segundo. */
const RE = /^export\s+(?:declare\s+)?(?:async\s+)?(?:(function|const|let|var|class|interface|type|enum)\s+)([A-Za-z_$][\w$]*)/gm;

function ficheiros(raiz, dir = raiz, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(raiz, p, fora);
    else if (nome.endsWith('.ts')) fora.push(relative(raiz, p).split('\\').join('/'));
  }
  return fora;
}

/** O retrato: `{ 'core/route.ts': ['PAPEIS_ATRAVESSAVEIS', 'atravessavel', …], … }`, ordenado. */
export function superficieDe(raizAppJs) {
  const fora = {};
  for (const rel of ficheiros(raizAppJs).sort()) {
    const txt = readFileSync(join(raizAppJs, rel), 'utf8');
    const nomes = [...txt.matchAll(RE)].map((m) => m[2]).sort();
    if (nomes.length) fora[rel] = [...new Set(nomes)];
  }
  return fora;
}

// ⚠️ A comparação é pelo NOME do ficheiro e não por `import.meta.url === 'file://' + argv[1]`: no Windows o
// caminho vem com barras invertidas e letra de unidade, a igualdade nunca casa, e o script sai em silêncio
// sem escrever nada — que foi exactamente o que aconteceu ao escrevê-lo.
if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'snapshot-public-surface.mjs') {
  const raiz = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
  const s = superficieDe(join(raiz, 'app', 'js'));
  writeFileSync(join(raiz, RETRATO), JSON.stringify(s, null, 2) + '\n');
  const n = Object.values(s).reduce((t, v) => t + v.length, 0);
  console.log(`retrato escrito: ${Object.keys(s).length} módulos, ${n} nomes`);
}
