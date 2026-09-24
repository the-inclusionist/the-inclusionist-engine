// SPDX-License-Identifier: AGPL-3.0-or-later
// The ADR-0085 gate: the fourteen actions, and the two things the list must NOT become.
import { describe, it, expect } from 'vitest';
import {
  ACTIONS, DIRECTIONS, VERBS, SYSTEM, isAction, actionSetProblems,
  presetActions, presetProblems, labellerFrom, shortLabellerFrom,
} from '../app/js/core/actions.js';

describe('as quatorze posições (ADR-0085, que supersede o ADR-0074 §1)', () => {
  it('são quatorze, sem repetição', () => {
    expect(ACTIONS).toHaveLength(14);
    expect(new Set(ACTIONS).size).toBe(14);
  });

  it('as três famílias cobrem a lista inteira e não se sobrepõem', () => {
    // ⚠️ THIS IS THE ASSERTION THAT PREVENTS AN ORPHAN ACTION. Adding a position and forgetting to put it in a family
    // would produce an action that exists, passes `isAction`, and appears on no remapping screen — present to the code and
    // invisible to the child.
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
    // ADR-0086 accepted naming the four by shoulder and trigger, and refused naming them by ONE manufacturer's labels.
    // `L1` is Sony's and Xbox's; Nintendo writes `L`/`ZL`, and a generic controller writes whatever it likes. Shoulder and
    // trigger describe the HAND, which is the same on all of them.
    for (const marca of ['L1', 'L2', 'R1', 'R2', 'SELECT', 'l1', 'r2', 'ZL', 'LB', 'RT']) {
      expect(isAction(marca)).toBe(false);
    }
    // Lower-case `select` IS an action: a system function, like `start`.
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
    // A quiz moves up/down and confirms. Demanding left/right would invent a key that does nothing.
    expect(actionSetProblems(['up', 'down', 'action1'])).toEqual([]);
    // A one-button game.
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
  // The platformer's preset, as ADR-0086 corrected it.
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
    // The platformer uses no shoulders or triggers, and need not invent names for them.
    expect(presetActions(PLATAFORMA)).not.toContain('leftShoulder');
    expect(presetActions(PLATAFORMA)).not.toContain('select');
  });

  it('as posições saem na ordem canônica, não na ordem em que foram escritas', () => {
    // The remapping screen reads this order; if it followed the object's order, two games with the same actions would show
    // different lists and the child would lose her bearings when changing game.
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
    // Returning the abstract name would put `action5` in front of a child, which ADR-0074 calls a defect in so many words.
    // The caller decides what to do with the absence; the controller wizard SKIPS it.
    expect(labellerFrom(PRESET)('leftShoulder')).toBeNull();
    expect(labellerFrom(PRESET)('select')).toBeNull();
  });

  it('⚠️ rótulo só de espaço conta como AUSENTE, não como nome', () => {
    // Returning it would silence the screen reader — the silent defect `speakableProblems` chases in the contract, here
    // again.
    expect(labellerFrom(PRESET)('action7')).toBeNull();
  });

  it('preset vazio não nomeia nada, e não estoura', () => {
    expect(labellerFrom({})('action1')).toBeNull();
  });
});

describe('shortLabellerFrom: a palavra CURTA da legenda', () => {
  it('usa `short` quando existe', () => {
    expect(shortLabellerFrom({ action1: { label: 'Correr / interagir', short: 'correr' } })('action1')).toBe('correr');
  });

  it('⚠️ RECUA para `label` quando `short` falta — apertada é melhor que vazia', () => {
    // Empty would vanish for screen-reader users too; tight is only ugly. That is the reason for the fallback.
    expect(shortLabellerFrom({ action1: { label: 'Correr / interagir' } })('action1')).toBe('Correr / interagir');
  });

  it('`short` só de espaço também recua para `label`', () => {
    expect(shortLabellerFrom({ action2: { label: 'Pular', short: '  ' } })('action2')).toBe('Pular');
  });

  it('posição não nomeada continua `null` — não vira ficha na legenda', () => {
    expect(shortLabellerFrom({ action1: { label: 'Correr' } })('action4')).toBeNull();
  });
});
