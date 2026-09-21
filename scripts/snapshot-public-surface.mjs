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
import { formaDe, RETRATO_FORMA } from './shape-surface.mjs';

export const RETRATO = 'docs/6-DevOps-SRE/public-surface.json';

/** Um `export` NOMEADO. Re-exports (`export { x } from …`) e `export default` ficam de fora de propósito:
 *  o primeiro é indireção do mesmo nome, e este projeto não usa o segundo. */
const RE = /^export\s+(?:declare\s+)?(?:async\s+)?(?:(function|const|let|var|class|interface|type|enum)\s+)([A-Za-z_$][\w$]*)/gm;

/*
 * 🔴 E OS DECLARADORES SEGUINTES DA MESMA LINHA, que o retrato não via — achado em 2026-09-21 ao medir o que os jogos
 * IMPORTAM: `export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;` publicava três nomes e o retrato guardava um. Os
 * outros dois são importados pelo game-platformer e pelo pixi-15-puzzle, e o crivo da superfície — que existe para reprovar
 * quando um nome público DESAPARECE — não tinha como os proteger: apagá-los passava verde.
 *
 * 📏 Medidos oito assim: LOGICAL_H, TILE, ADULT_H, CAR_H, LIXEIRA_H, PLACA_H, NUVEM_H, PIP_H.
 *
 * ⚠️ SÓ SE LEEM OS NOMES AO NÍVEL DE VÍRGULA DO TOPO, porque um inicializador pode ele próprio ter vírgulas — em
 * parênteses, chavetas e rectos, e TAMBÉM dentro de uma cadeia. 🔴 A primeira versão contava só os delimitadores e
 * publicou um nome que não existe: `export const ITEM_SELECTOR = 'button:not([disabled]), select:not(…)'` entrou no
 * retrato com um export chamado `select`. Um retrato que INVENTA um nome é pior do que um que perde: o crivo passaria a
 * exigir para sempre um nome que nenhum módulo tem.
 */
const CONTINUA = /^export\s+(?:declare\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*/;

function declaradoresDaLinha(linha) {
  if (!CONTINUA.test(linha)) return [];
  const corpo = linha.replace(/^export\s+(?:declare\s+)?(?:const|let|var)\s+/, '');
  const nomes = [];
  let profundidade = 0, actual = '', aspas = '', escapado = false;
  for (const ch of corpo) {
    if (aspas) {
      // dentro de uma cadeia nada é estrutura: nem vírgula, nem parêntese
      if (escapado) escapado = false;
      else if (ch === '\\') escapado = true;
      else if (ch === aspas) aspas = '';
      actual += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { aspas = ch; actual += ch; continue; }
    if ('([{'.includes(ch)) profundidade += 1;
    else if (')]}'.includes(ch)) profundidade -= 1;
    if (ch === ',' && profundidade === 0) { nomes.push(actual); actual = ''; continue; }
    actual += ch;
  }
  nomes.push(actual);
  // de cada declarador, só o nome antes do `:` do tipo ou do `=`
  // 📌 O PRIMEIRO ENTRA DUAS VEZES — por aqui e pelo `RE` — e isso foi MEDIDO como equivalente: o retrato passa por um
  // `Set`, logo saltá-lo com um `slice(1)` dava exactamente o mesmo ficheiro. A mutação que o tirava sobreviveu, e um
  // guarda que nenhum caso consegue distinguir é código inerte: sai, em vez de ficar a pedir um caso que não existe.
  return nomes
    .map((d) => /^\s*([A-Za-z_$][\w$]*)\s*(?::|=|$)/.exec(d)?.[1])
    .filter((n) => typeof n === 'string');
}

function ficheiros(raiz, dir = raiz, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(raiz, p, fora);
    else if (nome.endsWith('.ts')) fora.push(relative(raiz, p).split('\\').join('/'));
  }
  return fora;
}

/** O retrato: `{ 'core/route.ts': ['WALKABLE_ROLES', 'isWalkable', …], … }`, ordenado. */
export function superficieDe(raizAppJs) {
  const fora = {};
  for (const rel of ficheiros(raizAppJs).sort()) {
    const txt = readFileSync(join(raizAppJs, rel), 'utf8');
    const nomes = [...txt.matchAll(RE)].map((m) => m[2]);
    for (const linha of txt.split(/\r?\n/)) nomes.push(...declaradoresDaLinha(linha));
    if (nomes.length) fora[rel] = [...new Set(nomes)].sort();
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

  // ⚠️ OS DOIS RETRATOS SAEM DO MESMO COMANDO, de propósito: declarar é UM acto. Dois comandos separados
  // dariam a declaração pela metade — os nomes actualizados e a forma velha —, e o gate da forma passaria a
  // reprovar por uma remoção que alguém julgava ter declarado.
  const f = formaDe(join(raiz, 'app', 'js'));
  writeFileSync(join(raiz, RETRATO_FORMA), JSON.stringify(f, null, 2) + '\n');
  const tipos = Object.values(f).reduce((t, v) => t + Object.keys(v).length, 0);
  console.log(`forma escrita:   ${Object.keys(f).length} módulos, ${tipos} tipos`);
}
