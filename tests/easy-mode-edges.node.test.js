// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DO MODO FÁCIL NA ENTRADA, e ele é a pré-condição da migração da issue #103.
//
// ========================= POR QUE ELE NÃO EXISTIA E PRECISA DE EXISTIR AGORA =========================
// `tests/alternancia-do-correr.node.test.js` cobre `correndoAgora` — o ESTADO de corrida. Ninguém cobria
// `edgeAllowed`, que é a guarda na BORDA, e é onde o defeito original morava: o cabeçalho de `input/edges.ts`
// conta que os três caminhos de entrada tinham cada um a sua cópia da tabela, que a cópia do toque não tinha
// a guarda do Modo Fácil, e que o resultado foi uma criança em Modo Fácil sem conseguir escalar com teclado
// nem com controle — e conseguindo com o botão da tela.
//
// ⚠️ NO TABLET DE ESCOLA PÚBLICA O TOQUE NÃO É O CAMINHO ALTERNATIVO: É O ÚNICO. Uma divergência entre os
// três não é inconsistência estética; é uma criança com dificuldade motora recebendo um jogo diferente do
// que a decisão pedagógica desenhou.
//
// A migração vai MOVER esta regra (ela é do jogo, não da engine). Este ficheiro existe para que a mudança
// seja provada e não confiada.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDGE_BY_ACTION, edgeAllowed } from '../app/js/input/edges.js';

describe('a regra: no Modo Fácil o `run` não levanta borda', () => {
  it('[Right] `run` é bloqueado quando `easy` é verdadeiro', () => {
    expect(edgeAllowed('action1', true)).toBe(false);
  });

  it('[Inverse] sem Modo Fácil, `run` passa', () => {
    expect(edgeAllowed('action1', false)).toBe(true);
    expect(edgeAllowed('action1', undefined)).toBe(true);
  });

  it('[Boundary] ⚠️ o Modo Fácil tira SÓ a corrida — as outras cinco continuam a passar', () => {
    // O conserto óbvio e errado seria bloquear tudo. A decisão pedagógica é sobre correr (que é o
    // gatilho da escalada de parede), não sobre deixar a criança sem jogo.
    for (const [acao] of EDGE_BY_ACTION) {
      if (acao === 'action1') continue;
      expect(edgeAllowed(acao, true), `${acao} não devia ser bloqueada pelo Modo Fácil`).toBe(true);
    }
  });

  it('a tabela cobre as seis ações que levantam borda, e a ORDEM é observável', () => {
    expect(EDGE_BY_ACTION.map(([a]) => a)).toEqual(['action2', 'action1', 'left', 'right', 'action4', 'action3']);
  });
});

describe('⚠️ os TRÊS caminhos passam pela guarda — a asserção estrutural, e é o coração deste ficheiro', () => {
  // Uma asserção de comportamento não apanha o defeito que aconteceu: `edgeAllowed` estava certa e UM dos
  // caminhos não a chamava. O que falhou foi a ligação, não a regra — então é a ligação que se afirma.
  const CAMINHOS = [
    ['input/gamepad.ts', 'o controle'],
    ['input/keydown.ts', 'o teclado'],
    ['input/touch-bindings.ts', 'o toque — o único caminho no tablet de escola'],
  ];

  it.each(CAMINHOS)('%s (%s) chama `edgeAllowed` ao levantar borda', (modulo) => {
    const fonte = readFileSync(join(process.cwd(), 'app', 'js', modulo), 'utf8');
    const semComentarios = fonte
      .split(String.fromCharCode(13)).join('')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(semComentarios, `${modulo} deixou de consultar a guarda do Modo Fácil`).toMatch(/edgeAllowed\s*\(/);
  });

  it('e nenhum deles traz a sua PRÓPRIA cópia da regra', () => {
    // A forma exata do defeito antigo: uma guarda escrita à mão, que diverge da tabela sem ninguém notar.
    for (const [modulo] of CAMINHOS) {
      const fonte = readFileSync(join(process.cwd(), 'app', 'js', modulo), 'utf8')
        .split(String.fromCharCode(13)).join('')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      expect(fonte, `${modulo} tem uma guarda de Modo Fácil escrita à mão`).not.toMatch(/===\s*'action1'\s*&&/);
    }
  });
});
