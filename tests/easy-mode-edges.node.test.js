// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EASY-MODE GATE AT INPUT, the precondition of the migration in issue #103.
//
// `edgeAllowed` is the guard at the EDGE, where the original defect lived: as the header of `input/edges.ts` tells,
// each of the three input paths had its own copy of the table, the touch copy lacked the Easy-mode guard, and a child
// in Easy mode could not climb with keyboard or pad — and could with the on-screen button.
//
// ⚠️ ON A PUBLIC-SCHOOL TABLET, TOUCH IS NOT THE ALTERNATIVE PATH: IT IS THE ONLY ONE. A divergence among the three is
// not a cosmetic inconsistency; it is a child with a motor difficulty getting a different game from the one the
// pedagogical decision designed.
//
// The migration will MOVE this rule (it belongs to the game, not the engine). This file exists so that the change is
// proven, not trusted.
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
    // The obvious wrong fix would block everything. The pedagogical decision is about running (the trigger of wall
    // climbing), not about leaving the child without a game.
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
  // A behaviour assertion does not catch the defect that happened: `edgeAllowed` was right and ONE of the paths did not
  // call it. What failed was the wiring, not the rule — so the wiring is what is asserted.
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
    // The exact shape of the old defect: a hand-written guard that drifts from the table with nobody noticing.
    for (const [modulo] of CAMINHOS) {
      const fonte = readFileSync(join(process.cwd(), 'app', 'js', modulo), 'utf8')
        .split(String.fromCharCode(13)).join('')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      expect(fonte, `${modulo} tem uma guarda de Modo Fácil escrita à mão`).not.toMatch(/===\s*'action1'\s*&&/);
    }
  });
});
