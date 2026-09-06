// SPDX-License-Identifier: AGPL-3.0-or-later
// O CARIMBO DE LICENÇA — a garantia de que o que se publica leva a AGPL em cada ficheiro.
//
// ========================= O ACHADO =========================
// Os 114 fontes de engine abrem todos com o identificador SPDX. Medido em 2026-09-06: TRÊS dos 112 `.js`
// emitidos saíam SEM ele, e os 112 `.d.ts` saíam TODOS sem ele. O `tsc` anexa o comentário de topo ao primeiro
// nó do ficheiro e, quando esse nó é ELIDIDO (`import type`), o comentário vai junto; e para a declaração ele
// simplesmente não o copia.
//
// ⚠️ E A REGRA EXATA NÃO É ENUNCIÁVEL COM CONFIANÇA — `core/contract.ts` e `render/viz-modes.ts` abrem os dois
// com `export type` e só um perdia o cabeçalho. Um crivo na FONTE que tentasse prever isso acusou 24 ficheiros
// quando 3 estavam partidos. Por isso a licença deixou de depender do compilador e passou a ser CARIMBADA.
//
// ========================= POR QUE O TESTE É AQUI E NÃO SOBRE `dist-pkg` =========================
// É a mesma razão do `engine-package.node.test.js`: um gate que só funciona depois de um build que alguém pode
// esquecer falha ABERTO, que é o pior tipo — parece verde. O que se afere aqui é a FUNÇÃO, que é pura, mais a
// LIGAÇÃO dela ao `build:pkg` (e o `prepack` chama o `build:pkg`, então o caminho do `npm publish` passa por
// aqui obrigatoriamente).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { carimbar, CABECALHO } from '../scripts/stamp-license.mjs';

describe('carimbar — o ficheiro emitido leva a licença, venha ele como vier', () => {
  it('[Right] põe o cabeçalho em quem não o tem', () => {
    expect(carimbar('export const x = 1;\n')).toBe(`${CABECALHO}\nexport const x = 1;\n`);
  });

  it('[Right] ⚠️ IDEMPOTENTE — o carimbo corre a cada build, e empilhar a linha seria o defeito óbvio', () => {
    const uma = carimbar('export const x = 1;\n');
    expect(carimbar(uma)).toBe(uma);
    expect(carimbar(carimbar(uma))).toBe(uma);
  });

  it('[Boundary] ⚠️ MENCIONAR o identificador não é ESTAR carimbado', () => {
    // O erro fácil aqui é testar com `includes`: um ficheiro que fale do assunto no meio — este próprio
    // script, ou um comentário a explicar a licença — passaria como carimbado e sairia sem a primeira linha.
    // A comparação é com a PRIMEIRA linha, e este caso é o que impede a volta ao `includes`.
    const fala = `export const nota = 'usa ${CABECALHO}';\n`;
    expect(carimbar(fala).startsWith(CABECALHO + '\n')).toBe(true);
    expect(carimbar(fala)).not.toBe(fala);
  });

  it('[Boundary] uma linha só, sem quebra no fim, também é carimbada', () => {
    expect(carimbar('export const x = 1;')).toBe(`${CABECALHO}\nexport const x = 1;`);
  });

  it('[Zero] ficheiro vazio ganha o cabeçalho e nada mais', () => {
    expect(carimbar('')).toBe(`${CABECALHO}\n`);
  });

  it('[Interface] espaço à direita na primeira linha não engana', () => {
    expect(carimbar(`${CABECALHO}   \nexport const x = 1;\n`)).toBe(`${CABECALHO}   \nexport const x = 1;\n`);
  });
});

describe('e o carimbo está LIGADO ao caminho do publish', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

  it('[Right] ⚠️ `build:pkg` chama o carimbo — sem isto ele e um script que ninguem corre', () => {
    expect(pkg.scripts['build:pkg']).toContain('stamp-license.mjs');
  });

  it('[Interface] e o `prepack` chama o `build:pkg`, entao `npm publish` passa por aqui', () => {
    // É esta cadeia que torna a garantia de CONSTRUÇÃO: quem publica não tem como saltar o carimbo, mesmo
    // que se esqueça de correr o build à mão.
    expect(pkg.scripts.prepack).toContain('build:pkg');
  });

  it('[Right] e o pacote continua a DECLARAR a AGPL, que é o que a lei e o npm leem', () => {
    // O cabeçalho por ficheiro acompanha um ficheiro copiado para fora; o campo e o `LICENSE` são o que
    // qualquer ferramenta lê. São garantias diferentes e as três têm de existir.
    expect(pkg.license).toBe('AGPL-3.0-or-later');
    expect(pkg.files).toContain('LICENSE');
    expect(readFileSync(join(process.cwd(), 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  });
});
