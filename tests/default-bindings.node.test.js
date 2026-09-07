// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate das tabelas de binding. A asserção central é UMA: nada é atribuído duas vezes.
//
// ⚠️ ELE NÃO É HIPOTÉTICO. A especificação do padrão chegou com `I` em duas ações — `action4` e R2 — e um
// binding duplicado não produz erro em lado nenhum: as duas ações disparam juntas e a criança vê uma ação
// dupla intermitente que ninguém reproduz de propósito.
import { describe, it, expect } from 'vitest';
import { ACTIONS } from '../app/js/core/actions.js';
import {
  KEYBOARD_SOLO, KEYBOARD_DUO, GAMEPAD_STANDARD, bindingProblems, conflitosEntreTabelas, unreachable,
} from '../app/js/input/default-bindings.js';

describe('as tabelas cobrem as quatorze ações, sem buraco', () => {
  it.each([['teclado solo', KEYBOARD_SOLO], ['gamepad padrão', GAMEPAD_STANDARD]])(
    '%s declara TODAS as quatorze — ausência é `null`, nunca campo faltando',
    (_nome, tabela) => {
      for (const a of ACTIONS) expect(a in tabela, `${a} não declarada`).toBe(true);
      expect(Object.keys(tabela).sort()).toEqual([...ACTIONS].sort());
    },
  );
});

// ===================================================================================================
// O ESQUEMA DE DOIS JOGADORES (ADR-0096)
// ===================================================================================================
// ⚠️ O RISCO QUE ESTE BLOCO EXISTE PARA APANHAR É DE OUTRA FAMÍLIA que o do duplo-numa-tabela. Cada esquema
// do `KEYBOARD_DUO` passa em `bindingProblems` SOZINHO; o defeito só existe entre os dois. As setas são o
// caso concreto: no `KEYBOARD_SOLO` elas são um segundo caminho para o direcional do jogador 1, e em dupla
// são o direcional do jogador 2. Se ficassem nos dois, os dois bonecos andariam juntos — sem erro, sem aviso,
// e visível só jogando a dois.
describe('o esquema de DOIS jogadores (ADR-0096)', () => {
  const [P1, P2] = KEYBOARD_DUO;

  it('[Interface] são DOIS esquemas, e cada um declara as quatorze', () => {
    expect(KEYBOARD_DUO).toHaveLength(2);
    for (const tabela of KEYBOARD_DUO) expect(Object.keys(tabela).sort()).toEqual([...ACTIONS].sort());
  });

  it('[Zero] nenhum dos dois alcança MENOS que as quatorze — dupla não é modo reduzido', () => {
    for (const tabela of KEYBOARD_DUO) expect(unreachable(tabela)).toEqual([]);
  });

  it('[Right] cada esquema é são por si', () => {
    expect(bindingProblems(P1)).toEqual([]);
    expect(bindingProblems(P2)).toEqual([]);
  });

  it('⚠️ [Right] e os DOIS não se atropelam — nenhuma tecla tem dois donos', () => {
    expect(conflitosEntreTabelas(KEYBOARD_DUO)).toEqual([]);
  });

  it('⚠️ [Boundary] as SETAS saem do jogador 1 — é a única diferença obrigatória para o solo', () => {
    // O caso que dá nome ao problema. `KEYBOARD_SOLO` tem `ArrowUp` no `up`; em dupla, não pode ter.
    expect(KEYBOARD_SOLO.up).toContain('ArrowUp');
    expect(P1.up, 'a seta ficou com o jogador 1 e vai mover os dois bonecos').not.toContain('ArrowUp');
    expect(P2.up).toEqual(['ArrowUp']);
    // E o resto do jogador 1 é o solo: a dupla não reinventa o esquema, só lhe tira as setas.
    for (const a of ['action1', 'action2', 'action3', 'action4', 'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger', 'start', 'select']) {
      expect(P1[a], `${a} divergiu do esquema solo sem motivo`).toEqual(KEYBOARD_SOLO[a]);
    }
  });

  it('⚠️ [Interface] o crivo cruzado PEGA a seta repetida — senão ele não prova nada', () => {
    const p1ComSeta = { ...P1, up: ['KeyW', 'ArrowUp'] };
    const achados = conflitosEntreTabelas([p1ComSeta, P2]);
    expect(achados).toHaveLength(1);
    expect(achados[0]).toContain('ArrowUp');
    expect(achados[0]).toContain('p1.up');
    expect(achados[0]).toContain('p2.up');
  });

  it('[Interface] alfanumérico e numérico são teclas DIFERENTES, e é disso que o esquema depende', () => {
    // O Dev escreveu «7 (alphanumeric)» e «7 (numeric)» por extenso, e o esquema só fecha porque `code` os
    // separa: `Digit7` é do jogador 1 (L1) e `Numpad7` é do jogador 2 (L2). Lido por `key` seriam a MESMA
    // coisa — e com Num Lock desligado o bloco numérico chega ainda por outro nome.
    expect(P1.leftShoulder).toEqual(['Digit7']);
    expect(P2.leftTrigger).toEqual(['Numpad7']);
    expect(conflitosEntreTabelas(KEYBOARD_DUO)).toEqual([]);
    const todas = KEYBOARD_DUO.flatMap((t) => ACTIONS.flatMap((a) => t[a] ?? []));
    expect(todas.every((c) => /^(Key|Digit|Numpad|Arrow)|^(Space|Enter)$/.test(c)),
      'binding que não é um `KeyboardEvent.code` reconhecível: ' + todas.join(' ')).toBe(true);
  });

  it('⚠️ [Interface] a geometria do jogador 2 espelha a do jogador 1 — é o que torna o padrão ensinável', () => {
    // `U I / J K` e `8 9 / 5 6` têm a MESMA forma no teclado, então a memória muscular atravessa a mesa:
    //   action1 cima-esquerda · action4 cima-direita · action2 baixo-esquerda · action3 baixo-direita
    const forma = (t, digito) => [t.action1[0], t.action4[0], t.action2[0], t.action3[0]].map((c) => c.replace(digito, ''));
    expect(forma(P1, /^Key/)).toEqual(['U', 'I', 'J', 'K']);
    expect(forma(P2, /^Numpad/)).toEqual(['8', '9', '5', '6']);
  });
});

describe('⚠️ nada é atribuído duas vezes', () => {
  it('teclado solo', () => {
    expect(bindingProblems(KEYBOARD_SOLO)).toEqual([]);
  });

  it('gamepad padrão', () => {
    expect(bindingProblems(GAMEPAD_STANDARD)).toEqual([]);
  });

  it('e o detector APANHA o duplo — com o caso real que chegou na especificação', () => {
    // `I` em `action4` e em `rightTrigger` (R2), que foi literalmente o que veio escrito.
    const comErro = { ...KEYBOARD_SOLO, rightTrigger: ['KeyI'] };
    const p = bindingProblems(comErro);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/KeyI/);
    expect(p[0]).toMatch(/action4/);
    expect(p[0]).toMatch(/rightTrigger/);
  });

  it('apanha o duplo dentro de uma lista de várias teclas, não só entre ações', () => {
    const comErro = { ...KEYBOARD_SOLO, action1: ['KeyU', 'ArrowUp'] }; // ArrowUp já é `up`
    expect(bindingProblems(comErro)).toHaveLength(1);
  });

  it('lista vazia é reprovada — quem não alcança escreve `null`', () => {
    const comErro = { ...KEYBOARD_SOLO, leftShoulder: [] };
    expect(bindingProblems(comErro)[0]).toMatch(/empty list/);
  });

  it('campo faltando é reprovado, e a mensagem ensina o `null`', () => {
    const semCampo = { ...KEYBOARD_SOLO };
    delete semCampo.leftTrigger;
    const p = bindingProblems(semCampo);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/leftTrigger/);
    expect(p[0]).toMatch(/null/);
  });
});

describe('o padrão especificado pelo Dev, tecla a tecla', () => {
  it('o quadrado UIJK do teclado', () => {
    expect(KEYBOARD_SOLO.action1).toEqual(['KeyU']);
    // ⚠️ `Space` volta ao pulo. Ela era um segundo atalho para `jump` e ficou de fora da primeira versão
    // desta tabela porque ninguém sabia onde o pulo morava; o Dev disse (ADR-0086) que mora em `action2`,
    // então a barra segue o verbo certo em vez de seguir uma posição escolhida por mim.
    expect(KEYBOARD_SOLO.action2).toEqual(['KeyJ', 'Space']);
    expect(KEYBOARD_SOLO.action3).toEqual(['KeyK']);
    expect(KEYBOARD_SOLO.action4).toEqual(['KeyI']);
  });

  it('os ombros e gatilhos, na simetria do QWERTY', () => {
    // 7 sobre U, 8 sobre I; Y à esquerda de U, O à direita de I.
    expect(KEYBOARD_SOLO.leftShoulder).toEqual(['Digit7']); // L1
    expect(KEYBOARD_SOLO.leftTrigger).toEqual(['KeyY']);   // L2
    expect(KEYBOARD_SOLO.rightShoulder).toEqual(['Digit8']); // R1
    expect(KEYBOARD_SOLO.rightTrigger).toEqual(['KeyO']);   // R2
  });

  it('o losango do Xbox, no mapa padrão da Gamepad API', () => {
    expect(GAMEPAD_STANDARD.action1).toBe(2); // X
    expect(GAMEPAD_STANDARD.action2).toBe(0); // A
    expect(GAMEPAD_STANDARD.action3).toBe(1); // B
    expect(GAMEPAD_STANDARD.action4).toBe(3); // Y
    expect(GAMEPAD_STANDARD.leftShoulder).toBe(4); // L1
    expect(GAMEPAD_STANDARD.leftTrigger).toBe(6); // L2
    expect(GAMEPAD_STANDARD.rightShoulder).toBe(5); // R1
    expect(GAMEPAD_STANDARD.rightTrigger).toBe(7); // R2
  });

  it('⚠️ a rotação de 45° entre teclado e Xbox é consistente nos quatro', () => {
    // X(oeste)→U(noroeste) · Y(norte)→I(nordeste) · B(leste)→K(sudeste) · A(sul)→J(sudoeste).
    // Não é enfeite: é o que faz a memória muscular atravessar de um transporte para o outro.
    const XBOX_ROSA = { 2: 'W', 3: 'N', 1: 'E', 0: 'S' };            // face → ponto cardeal
    const TECLA_ROSA = { KeyU: 'NW', KeyI: 'NE', KeyK: 'SE', KeyJ: 'SW' };
    const HORARIO = { W: 'NW', N: 'NE', E: 'SE', S: 'SW' };          // 45° no sentido horário

    for (const a of ['action1', 'action2', 'action3', 'action4']) {
      const face = XBOX_ROSA[GAMEPAD_STANDARD[a]];
      const tecla = TECLA_ROSA[KEYBOARD_SOLO[a][0]];
      expect(tecla, `${a}: ${face} deveria virar ${HORARIO[face]}`).toBe(HORARIO[face]);
    }
  });

  it('start e select no teclado, na simetria de MÃO', () => {
    // `F` ao lado do polegar da mão que se move (WASD); `H` ao lado da mão que age (UIJK).
    expect(KEYBOARD_SOLO.select).toEqual(['KeyF']);
    expect(KEYBOARD_SOLO.start).toEqual(['KeyH', 'Enter']);
  });
});

describe('o que um transporte NÃO alcança é dito, não escondido', () => {
  it('⚠️ o teclado passou a alcançar as quatorze — a dívida do ADR-0074 §1 fechou', () => {
    // O registro dizia que `start` existia em dois transportes de nove e faltava no teclado.
    expect(unreachable(KEYBOARD_SOLO)).toEqual([]);
  });

  it('o gamepad alcança as quatorze', () => {
    expect(unreachable(GAMEPAD_STANDARD)).toEqual([]);
  });

  it('`unreachable` continua a apanhar uma ausência de verdade', () => {
    // Sem esta, o teste acima passaria com um `unreachable` que devolvesse sempre vazio.
    expect(unreachable({ ...KEYBOARD_SOLO, leftTrigger: null })).toEqual(['leftTrigger']);
  });
});
