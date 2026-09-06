// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate do ADR-0085: as quatorze ações, e as duas coisas que a lista NÃO pode virar.
import { describe, it, expect } from 'vitest';
import {
  ACTIONS, DIRECTIONS, VERBS, SYSTEM, isAction, actionSetProblems,
  presetActions, presetProblems, labellerFrom,
} from '../app/js/core/actions.js';

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
    expect(VERBS).toContain('leftShoulder');
    expect(VERBS).toContain('leftTrigger');
    expect(VERBS).toContain('rightShoulder');
    expect(VERBS).toContain('rightTrigger');
  });

  it('`select` existe e é de SISTEMA, ao lado de `start`', () => {
    expect(SYSTEM).toEqual(['start', 'select']);
  });
});

describe('os nomes são anatômicos, não de marca (ADR-0086)', () => {
  it('⚠️ `L1`, `R2` e `SELECT` continuam FORA — a fronteira mudou de sítio, não desapareceu', () => {
    // O ADR-0086 aceitou nomear os quatro por ombro e gatilho, e recusou nomeá-los pelas etiquetas de UM
    // fabricante. `L1` é Sony e Xbox; a Nintendo escreve `L`/`ZL`, e um controle genérico escreve o que
    // quiser. Ombro e gatilho descrevem a MÃO, que é a mesma em todos.
    for (const marca of ['L1', 'L2', 'R1', 'R2', 'SELECT', 'l1', 'r2', 'ZL', 'LB', 'RT']) {
      expect(isAction(marca)).toBe(false);
    }
    // `select` minúsculo É ação: é função de sistema, como `start`.
    expect(isAction('select')).toBe(true);
  });

  it('os quatro nomeiam a mão: dois lados, dois dedos', () => {
    for (const a of ['leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger']) {
      expect(isAction(a)).toBe(true);
    }
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

describe('o preset: onde as PALAVRAS do jogo moram (o corte do Dev, 2026-09-06)', () => {
  // O preset da plataforma, tal como o ADR-0086 o corrigiu.
  const PLATAFORMA = {
    up: { label: 'Cima' }, down: { label: 'Baixo' },
    left: { label: 'Esquerda' }, right: { label: 'Direita' },
    action1: { label: 'Correr', hint: 'Segure para correr e para grudar na parede.' },
    action2: { label: 'Pular' },
    action3: { label: 'Especial' },
    action4: { label: 'Trocar poder' },
    start: { label: 'Pausar' },
  };

  it('um jogo nomeia SÓ as posições que usa', () => {
    expect(presetProblems(PLATAFORMA)).toEqual([]);
    // A plataforma não usa ombros nem gatilhos, e não precisa de inventar nome para eles.
    expect(presetActions(PLATAFORMA)).not.toContain('leftShoulder');
    expect(presetActions(PLATAFORMA)).not.toContain('select');
  });

  it('as posições saem na ordem canônica, não na ordem em que foram escritas', () => {
    // A tela de remapeamento lê esta ordem; se ela seguisse a ordem do objeto, dois jogos com as mesmas
    // ações mostrariam listas diferentes e a criança perderia a referência ao trocar de jogo.
    const foraDeOrdem = { action3: { label: 'C' }, up: { label: 'A' }, action1: { label: 'B' } };
    expect(presetActions(foraDeOrdem)).toEqual(['up', 'action1', 'action3']);
  });

  it('um quiz nomeia três posições e está conforme', () => {
    expect(presetProblems({ up: { label: 'Anterior' }, down: { label: 'Seguinte' }, action1: { label: 'Confirmar' } })).toEqual([]);
  });

  it('⚠️ rótulo vazio é REPROVADO — é o botão sem nome no leitor de tela', () => {
    const p = presetProblems({ ...PLATAFORMA, action2: { label: '   ' } });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/action2/);
    expect(p[0]).toMatch(/empty label/);
  });

  it('preset que não nomeia nada é reprovado', () => {
    expect(presetProblems({})[0]).toMatch(/names no action/);
  });

  it('ausente é reprovado, com outra mensagem', () => {
    expect(presetProblems(null)[0]).toMatch(/missing/);
  });

  it('⚠️ uma chave que não é ação é reprovada e NOMEADA — é o `jump` a tentar voltar', () => {
    const p = presetProblems({ ...PLATAFORMA, jump: { label: 'Pular' } });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/jump/);
    expect(p[0]).toMatch(/is not an action/);
  });
});

describe('labellerFrom: a pergunta que a engine faz ao jogo', () => {
  const PRESET = { up: { label: 'Cima' }, action2: { label: 'Pular' }, action7: { label: '   ' } };

  it('devolve a palavra do jogo', () => {
    expect(labellerFrom(PRESET)('action2')).toBe('Pular');
  });

  it('⚠️ devolve `null` para uma posição que o jogo NÃO nomeia — nunca `action7`', () => {
    // Devolver o nome abstrato poria `action5` à frente de uma criança, que o ADR-0074 chama de defeito
    // em tantas palavras. Quem chama decide o que fazer com a ausência; o assistente de controle SALTA.
    expect(labellerFrom(PRESET)('leftShoulder')).toBeNull();
    expect(labellerFrom(PRESET)('select')).toBeNull();
  });

  it('⚠️ rótulo só de espaço conta como AUSENTE, não como nome', () => {
    // Devolvê-lo calaria o leitor de tela — o defeito silencioso que `speakableProblems` persegue no
    // contrato, aqui outra vez.
    expect(labellerFrom(PRESET)('action7')).toBeNull();
  });

  it('preset vazio não nomeia nada, e não estoura', () => {
    expect(labellerFrom({})('action1')).toBeNull();
  });
});
