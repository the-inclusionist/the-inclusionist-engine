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
 * A LISTA ESTÁ VAZIA, e este é o dia em que o item 18 deixou de ser promessa.
 *
 * Ela guardava os três fundos de parallax da Cidade, medidos antes de virarem linha aqui: uma cobertura
 * gulosa 2D por retângulos de cor uniforme precisa de 2.065, 2.899 e 6.418 (11.382 no total), contra os
 * "44 e 62" que a pipeline supunha — aqueles números eram dos TILES, que já eram dados em
 * `render/city-tiles` a 100% de fidelidade. Reproduzi-los como dados nunca esteve disponível a custo
 * razoável, e por isso o ADR-0042 escolheu a outra saída: REDESENHÁ-LOS por regra.
 *
 * O que decidiu não foi arquitetura, foi acessibilidade. O fundo da Cidade é a maior superfície da tela, e
 * enquanto era PNG era a única coisa que o alto contraste jamais repintava — uma criança com baixa visão
 * recebia o jogo inteiro repintado e um fundo intacto atrás, que é pior que não ter o modo.
 *
 * ⚠️ ELA SÓ ENCOLHE, e agora só pode crescer com uma decisão registrada. Uma linha nova aqui é uma exceção
 * PERMANENTE ao pilar 1, e um pilar com exceção permanente é uma frase, não uma regra.
 */
const PNG_CONHECIDOS = [];

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

  it('[Boundary] a dívida é ZERO — o pilar 1 vale, e este número é a diferença entre valer e quase valer', () => {
    // O caso dizia "a dívida cabe em TRÊS arquivos", e o número era a distância que faltava. Ele chegou.
    // Continua sendo um contador e não uma decoração: o dia em que voltar a subir, sobe aqui primeiro.
    expect(FORA).toHaveLength(0);
  });

  it('[Right] o único lugar com PNG é a arte de PERSONAGEM, e ela é a exceção declarada', () => {
    // Antes este caso dizia "os três são do mesmo cenário — a exceção é uma, não um hábito". Zerada a
    // dívida, o que resta afirmar é o outro lado da mesma frase: que TODO PNG que existe está no lugar
    // onde o pilar admite que ele esteja, e nenhum fora.
    const dentro = pngs(APP).map(rel).filter((p) => p.startsWith(PERMITIDO));
    expect(dentro.length, 'a arte de personagem sumiu — isto não é um gate de PNG a menos').toBeGreaterThan(0);
    expect(FORA).toEqual([]);
  });
});
