// SPDX-License-Identifier: AGPL-3.0-or-later
// ITEM 18 — "nenhum PNG fora de sprites/", como gate (project node: só lê arquivos; roda no CI via `npm test`).
//
// ========================= O QUE ESTE ARQUIVO TORNA VERIFICÁVEL =========================
// O ADR-0010 declara "arte = dados". Enquanto isso for prosa, é intenção: qualquer PNG novo entra sem que
// ninguém perceba, e o pilar vira uma frase que o repositório contradiz em silêncio. Aqui ele vira reprovação.
//
// ========================= POR QUE UMA LISTA DE DÍVIDA, E NÃO UMA PROIBIÇÃO SECA =========================
// Restam TRÊS PNG fora de `sprites/`: os fundos de parallax da Cidade. Um teste que simplesmente reprovasse
// hoje seria afrouxado na primeira pressa — e o mais provável é que fosse afrouxado para sempre, porque o
// conserto deles não é refatoração: é ARTE NOVA, e é decisão do Dev (issue #74).
//
// A lista faz três coisas de uma vez, que é o mesmo desenho de `engine-boundary`: deixa a suíte verde hoje,
// torna a dívida CONTÁVEL, e faz qualquer PNG NOVO reprovar na hora. Ela SÓ ENCOLHE.
//
// ========================= O QUE ELE NÃO PROMETE =========================
// Não diz que todo PNG em `sprites/` é usado — 38 dos 77 são variantes `_hc` que nada carrega (issue #71).
// Estar no lugar certo e ser carregado são perguntas diferentes, e misturá-las faria este gate reprovar por
// um motivo que ele não sabe explicar. A segunda pergunta tem issue própria.
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = process.cwd();
const APP = join(RAIZ, 'app');

function pngs(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...pngs(p));
    else if (nome.toLowerCase().endsWith('.png')) out.push(p);
  }
  return out;
}

const rel = (p) => relative(APP, p).split(sep).join('/');

/** O único lugar onde PNG é permitido: a arte de PERSONAGEM, que ainda não é procedural. */
const PERMITIDO = 'public/assets/sprites/';

/**
 * Dívida CONHECIDA em 2026-08-25 — os três fundos de parallax da Cidade. SÓ ENCOLHE.
 *
 * Medidos antes de virarem linha aqui: uma cobertura gulosa 2D por retângulos de cor uniforme precisa de
 * 2.065, 2.899 e 6.418 retângulos (11.382 no total), contra os "44 e 62" que a pipeline supunha — aqueles
 * números são dos TILES, que já são dados em `render/city-tiles` a 100% de fidelidade. Reproduzi-los como
 * dados não está disponível a custo razoável; gerá-los é arte nova. Ver a issue #74.
 */
const PNG_CONHECIDOS = [
  'public/assets/cenarios/cidade/c2.png',
  'public/assets/cenarios/cidade/c3.png',
  'public/assets/cenarios/cidade/c4.png',
];

const FORA = pngs(APP).map(rel).filter((p) => !p.startsWith(PERMITIDO)).sort();

describe('item 18 — "arte = dados" deixa de ser promessa', () => {
  it('[Right] NENHUM PNG fora de sprites/ além da dívida conhecida', () => {
    const novos = FORA.filter((p) => !PNG_CONHECIDOS.includes(p));
    expect(novos, 'PNG NOVO fora de sprites/ — o pilar diz que arte é DADO; ver ADR-0010 e a issue #74')
      .toEqual([]);
  });

  it('[Interface] a dívida conhecida ainda EXISTE — arquivo convertido é linha apagada daqui', () => {
    // Sem este caso a lista viraria cemitério: entradas de arquivos já convertidos continuariam autorizando
    // que voltassem, e ninguém saberia que o gate parou de proteger aquele caminho.
    for (const p of PNG_CONHECIDOS) {
      expect(FORA, `'${p}' não existe mais — apague-o de PNG_CONHECIDOS`).toContain(p);
    }
  });

  it('[Boundary] a dívida cabe em TRÊS arquivos — o número é o que diz quanto falta para o pilar valer', () => {
    // Não é decoração: é a diferença entre "o pilar não vale" e "o pilar está a três arquivos de valer".
    expect(FORA).toHaveLength(3);
  });

  it('[Right] os três são do MESMO cenário — a exceção é uma, não um hábito', () => {
    // Se um segundo tema começasse a trazer fundos em PNG, o caso acima ainda passaria por um tempo (o
    // contador subiria e alguém o ajustaria). Este diz o que realmente importa: a exceção não se espalha.
    const temas = new Set(FORA.map((p) => p.split('/').slice(-2)[0]));
    expect([...temas]).toEqual(['cidade']);
  });
});
