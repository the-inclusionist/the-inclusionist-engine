// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate do ADR-0085: as quatorze ações, e as duas coisas que a lista NÃO pode virar.
import { describe, it, expect } from 'vitest';
import { ACTIONS, DIRECTIONS, VERBS, SYSTEM, isAction, actionSetProblems } from '../app/js/core/actions.js';

describe('as quatorze posições (ADR-0085, que supersede o ADR-0074 §1)', () => {
  it('são quatorze, sem repetição', () => {
    expect(ACTIONS).toHaveLength(14);
    expect(new Set(ACTIONS).size).toBe(14);
  });

  it('as três famílias cobrem a lista inteira e não se sobrepõem', () => {
    // ⚠️ ESTA É A ASSERÇÃO QUE IMPEDE UMA AÇÃO ÓRFÃ. Acrescentar uma posição e esquecer de a pôr numa
    // família produziria uma ação que existe, passa em `isAction`, e não aparece em nenhuma tela de
    // remapeamento — presente para o código e invisível para a criança.
    const familias = [...DIRECTIONS, ...VERBS, ...SYSTEM];
    expect(familias).toHaveLength(ACTIONS.length);
    expect([...familias].sort()).toEqual([...ACTIONS].sort());
  });

  it('os oito verbos incluem os quatro novos', () => {
    expect(VERBS).toContain('action5');
    expect(VERBS).toContain('action6');
    expect(VERBS).toContain('action7');
    expect(VERBS).toContain('action8');
  });

  it('`select` existe e é de SISTEMA, ao lado de `start`', () => {
    expect(SYSTEM).toEqual(['start', 'select']);
  });
});

describe('⚠️ nenhum nome de gamepad entrou no vocabulário abstrato', () => {
  it('L1, L2, R1, R2 e SELECT não são ações', () => {
    // O pedido veio nesses nomes; adotá-los repetiria o defeito que o ADR-0074 corrigiu, uma camada
    // adiante — `jump` era significado de plataforma, `L1` seria significado de gamepad. Eles são o
    // BINDING PADRÃO de um transporte, e não o nome da posição.
    for (const fisico of ['L1', 'L2', 'R1', 'R2', 'SELECT', 'l1', 'r2']) {
      expect(isAction(fisico)).toBe(false);
    }
    // `select` minúsculo É ação: é função de sistema, como `start`.
    expect(isAction('select')).toBe(true);
  });

  it('nenhum verbo de plataforma sobreviveu na lista abstrata', () => {
    for (const verbo of ['jump', 'run', 'swap', 'especial', 'pause']) {
      expect(isAction(verbo)).toBe(false);
    }
  });
});

describe('o conjunto de ações de um jogo', () => {
  it('um jogo escolhe o seu conjunto, e NÃO precisa das quatro direções', () => {
    // Um quiz navega em cima/baixo e confirma. Exigir left/right inventaria uma tecla que não faz nada.
    expect(actionSetProblems(['up', 'down', 'action1'])).toEqual([]);
    // Um jogo de um botão.
    expect(actionSetProblems(['action1'])).toEqual([]);
  });

  it('conjunto vazio é reprovado — um jogo sem ação não tem como ser jogado', () => {
    expect(actionSetProblems([])).toHaveLength(1);
    expect(actionSetProblems([])[0]).toMatch(/empty/);
  });

  it('ausente é reprovado, e com outra mensagem', () => {
    expect(actionSetProblems(null)[0]).toMatch(/missing/);
    expect(actionSetProblems(undefined)[0]).toMatch(/missing/);
  });

  it('ação desconhecida é reprovada e NOMEADA', () => {
    const p = actionSetProblems(['up', 'jump', 'L1']);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/jump/);
    expect(p[0]).toMatch(/L1/);
  });

  it('repetição é reprovada', () => {
    expect(actionSetProblems(['up', 'up'])[0]).toMatch(/repeated/);
  });
});
