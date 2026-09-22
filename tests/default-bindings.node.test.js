// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate das tabelas de binding. A asserção central é UMA: nada é atribuído duas vezes.
//
// ⚠️ ELE NÃO É HIPOTÉTICO. A especificação do padrão chegou com `I` em duas ações — `action4` e R2 — e um
// binding duplicado não produz erro em lado nenhum: as duas ações disparam juntas e a criança vê uma ação
// dupla intermitente que ninguém reproduz de propósito.
import { describe, it, expect } from 'vitest';
import { ACTIONS } from '../app/js/core/actions.js';
import {
  KEYBOARD_SOLO, KEYBOARD_DUO, GAMEPAD_STANDARD, bindingProblems, conflictsBetweenTables, unreachable,
} from '../app/js/input/default-bindings.js';
// Só o último bloco os usa. Estão aqui porque a pergunta que ele faz atravessa os dois ficheiros: uma tecla
// pode estar livre nas TABELAS e já ser reclamada por uma constante de módulo do `input/keydown`.
import { KB_DEFAULTS } from '../app/js/input/keyboard.js';
import { PAUSE_KEYS, EASY_SHORTCUTS, SCREEN_DIGITS, isEasyShortcut } from '../app/js/input/keydown.js';

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
    expect(conflictsBetweenTables(KEYBOARD_DUO)).toEqual([]);
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
    const achados = conflictsBetweenTables([p1ComSeta, P2]);
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
    expect(conflictsBetweenTables(KEYBOARD_DUO)).toEqual([]);
    // ⚠️ ESTE CRIVO ERA UMA LISTA BRANCA DO QUE A TABELA JÁ TINHA, e não do que é um `code` válido: aceitava
    // `Key|Digit|Numpad|Arrow|Space|Enter` e mais nada. Em 2026-09-07 a #122 acrescentou `ShiftRight` — um
    // código legítimo da especificação — e ele reprovou. Um gate que recusa mudança CORRETA não protege
    // ninguém; empurra quem tem pressa a apagá-lo.
    //
    // O que ele existe para apanhar continua a valer, e é o que ficou: alguém a escrever um `key` (`'a'`,
    // `'7'`, `'Shift'`) onde se pede um `code`. Um `key` é um caractere solto ou um nome SEM LADO — daí a
    // recusa explícita de `Shift`/`Control`/`Alt`/`Meta` nus, que são a forma mais fácil de cometer o erro.
    const FAMILIAS = /^(Key[A-Z]|Digit\d|Numpad|Arrow(Up|Down|Left|Right)$|F\d{1,2}$)/;
    const NOMEADAS = new Set(['Space', 'Enter', 'Escape', 'Tab', 'Backspace', 'Backquote', 'Minus', 'Equal',
      'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash',
      'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'CapsLock', 'ContextMenu',
      'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
    const SEM_LADO = new Set(['Shift', 'Control', 'Alt', 'Meta']); // estes são `key`, nunca `code`
    const todas = KEYBOARD_DUO.flatMap((t) => ACTIONS.flatMap((a) => t[a] ?? []));
    const maus = todas.filter((c) => SEM_LADO.has(c) || !(FAMILIAS.test(c) || NOMEADAS.has(c)));
    expect(maus, 'binding que não é um `KeyboardEvent.code` reconhecível').toEqual([]);
    // E o crivo tem de saber recusar: sem isto ele podia estar verde por aceitar tudo.
    expect(['a', '7', 'Shift', 'Escape '].filter((c) => SEM_LADO.has(c) || !(FAMILIAS.test(c) || NOMEADAS.has(c))))
      .toEqual(['a', '7', 'Shift', 'Escape ']);
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

// ==========================================================================================================
// ⚠️ NENHUM ASSENTO FICA SEM PORTA PARA O REMAPEAMENTO (#122)
//
// Medido em 2026-09-07, no `KB_DEFAULTS.p2[1]`: das catorze posicoes do segundo assento, **DEZ so se
// alcancam pelo bloco numerico** — as oito acoes mais o `start` e o `select`. Um Chromebook nao tem esse
// bloco, e um Chromebook e o hardware que o pilar 1 nomeia.
//
// ⚠️ O QUE ISSO FAZ A UMA CRIANCA: ela anda pelas setas (que existem), nao age em nada, e **nao consegue
// abrir o menu para consertar** — porque a tecla que abre o menu esta no mesmo bloco que falta. E a
// definicao de «um padrao do qual a crianca nao escapa».
//
// ⚠️ E O CONSERTO NAO E TROCAR AS TECLAS. A auditoria e explicita: «tornar o proprio padrao remapeavel, e
// nao trocar as teclas que ele escolheu». O layout do numpad e MELHOR onde ele existe — um bloco fisico sob
// uma mao — e nao tira nada ao primeiro jogador. O que faltava era UMA porta.
//
// MUTACOES CONFERIDAS (no fim do bloco).
// ==========================================================================================================
describe('input/default-bindings — toda cadeira tem porta para o remapeamento (#122)', () => {
  const soNumpad = (v) => (v ?? []).length > 0 && (v ?? []).every((c) => c.startsWith('Numpad'));

  it('⚠️ [Cross-check] o segundo assento E MESMO quase todo numpad — senao nao ha defeito a consertar', () => {
    // Ancora a premissa: se um dia este assento deixar de depender do numpad, o caso abaixo passa a proteger
    // uma coisa que ja nao e verdade, e este aqui avisa antes disso.
    const p2 = KEYBOARD_DUO[1];
    const presas = ACTIONS.filter((a) => soNumpad(p2[a]));
    expect(presas.length, 'o segundo assento deixou de depender do numpad; reler a #122').toBeGreaterThanOrEqual(8);
    expect(presas).toContain('select');
  });

  it('⚠️ [Right] o `start` de CADA esquema de dupla e alcancavel SEM bloco numerico', () => {
    // `start` e a pausa, e da pausa alcanca-se a tela de remapeamento — de onde todas as outras treze
    // posicoes se mudam. Uma porta chega para escapar; e chegar a ZERO portas nao chega.
    for (const [i, esquema] of KEYBOARD_DUO.entries()) {
      const semNumpad = (esquema.start ?? []).filter((c) => !c.startsWith('Numpad'));
      expect(semNumpad.length, `p${i + 1}: o start so se alcanca pelo numpad — num Chromebook esta crianca nao abre o menu`)
        .toBeGreaterThan(0);
    }
  });

  it('[Boundary] e a porta nova nao tira tecla de ninguem', () => {
    expect(conflictsBetweenTables(KEYBOARD_DUO), 'a porta nova colide com outra cadeira').toEqual([]);
    expect(bindingProblems(KEYBOARD_DUO[1]), 'a porta nova repete uma tecla dentro do proprio esquema').toEqual([]);
  });

  it('[Right] as teclas do numpad FICAM — o conserto e acrescentar, nao trocar', () => {
    // A auditoria pediu isto por escrito, e um caso a menos aqui deixaria o proximo a "arrumar" o esquema.
    const p2 = KEYBOARD_DUO[1];
    expect(p2.start).toContain('Numpad1');
    expect(p2.action1).toEqual(['Numpad8']);
    expect(p2.up).toEqual(['ArrowUp']);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · voltando `start: ['Numpad1']` (tirando a porta) → "[Right] o `start` de CADA esquema" reprova nomeando
//     `p2`. E a #122 reproduzida: a crianca do segundo assento sem forma de abrir o menu num Chromebook.
//   · trocando a porta por outra tecla ja usada (ex.: `KeyH`) → reprovam QUATRO, e tres deles sao gates que
//     ja existiam antes desta issue. E a melhor noticia deste bloco: a propriedade "nenhuma tecla tem dois
//     donos" nao dependia de eu me lembrar dela ao acrescentar uma porta.
//   · trocando `Numpad1` por `ShiftRight` em vez de acrescentar → "[Right] as teclas do numpad FICAM"
//     reprova. O conserto pedido era acrescentar uma porta, nao mudar o layout que funciona onde ha numpad.

// ==========================================================================================================
// ⚠️ UM BINDING PADRAO NAO COLIDE COM UMA TECLA QUE O MODULO JA RECLAMA
//
// ⚠️ ESTE BLOCO NASCEU DE UM ERRO MEU, e vale escrever assim. Ao consertar a #122 acrescentei `ShiftRight`
// ao `start` do segundo assento e verifiquei que a tecla estava livre — nas QUATRO TABELAS. Nao olhei os
// conjuntos de modulo do `input/keydown`, e `ShiftRight` esta em `EASY_SHORTCUTS`.
//
// Nao ha colisao viva: o `isEasyShortcut` exige `numPlayers <= 1` e o `p2[1]` so existe com dois. Mas isso e
// «verdade por acidente de uma guarda noutro ficheiro» — exatamente o feitio de defeito que a #121 acabou de
// pagar, em que o pan estava certo na plataforma por o mundo dela ser medido em pixels.
//
// Entao a seguranca deixa de ser acidente e passa a ser AFIRMADA: a sobreposicao esta nomeada com o motivo, e
// ha um caso que prende a guarda que a torna inofensiva. Se alguem tirar o `numPlayers <= 1`, a suite fica
// vermelha antes de a tecla de pausa da segunda crianca virar «trocar poder» do primeiro.
//
// MUTACOES CONFERIDAS (no fim do bloco).
// ==========================================================================================================
describe('binding padrao x teclas que o modulo ja reclama (#122, achado de 2026-09-07)', () => {
  const TABELAS = [
    ['solo', KB_DEFAULTS.solo],
    ...KB_DEFAULTS.p2.map((s, i) => [`p2[${i}]`, s]),
    ...KB_DEFAULTS.p3.map((s, i) => [`p3[${i}]`, s]),
    ...KB_DEFAULTS.p4.map((s, i) => [`p4[${i}]`, s]),
  ];
  const CONJUNTOS = [
    ['PAUSE_KEYS', (c) => PAUSE_KEYS.has(c)],
    ['EASY_SHORTCUTS', (c) => EASY_SHORTCUTS.has(c)],
    ['SCREEN_DIGITS', (c) => SCREEN_DIGITS.test(c)],
  ];

  /** As sobreposicoes CONHECIDAS, cada uma com o motivo. A lista nao cresce sem alguem escrever porque. */
  const CONHECIDAS = new Map([
    ['solo.start=Enter∩PAUSE_KEYS', 'deliberado: o `Enter` JA pausava antes de o esquema o nomear'],
    ['p2[0].start=Enter∩PAUSE_KEYS', 'o mesmo, para o primeiro assento da dupla'],
    ['p2[1].start=ShiftRight∩EASY_SHORTCUTS', 'inofensivo por exclusao mutua: os atalhos do Facil exigem `numPlayers <= 1` e este esquema so existe com dois — e ha caso abaixo a prender essa guarda'],
  ]);

  const sobreposicoes = () => {
    const out = [];
    for (const [nome, esquema] of TABELAS) {
      for (const [acao, teclas] of Object.entries(esquema)) {
        for (const c of teclas ?? []) {
          for (const [conj, tem] of CONJUNTOS) if (tem(c)) out.push(`${nome}.${acao}=${c}∩${conj}`);
        }
      }
    }
    return out.sort();
  };

  it('⚠️ [Zero] NENHUMA sobreposicao nova — e cada conhecida carrega o motivo', () => {
    const novas = sobreposicoes().filter((s) => !CONHECIDAS.has(s));
    expect(novas, 'binding padrao numa tecla que o modulo ja reclama; nomeie a sobreposicao com o motivo').toEqual([]);
    for (const [, motivo] of CONHECIDAS) expect(motivo.length, 'motivo curto demais para ser motivo').toBeGreaterThan(30);
  });

  it('⚠️ [Cross-check] o crivo ACHA as tres de hoje — senao o [Zero] estaria verde por nao olhar nada', () => {
    expect(sobreposicoes()).toEqual([...CONHECIDAS.keys()].sort());
  });

  it('⚠️ [Interface] a guarda que torna a de `ShiftRight` inofensiva EXISTE, e e ela que a torna', () => {
    // Sem `numPlayers <= 1`, a tecla de pausa da segunda crianca vira «trocar poder» do primeiro jogador.
    const jogador = { easy: true };
    expect(isEasyShortcut('ShiftRight', { players: [jogador], numPlayers: 1 }),
      'a premissa do caso morreu: os atalhos do Facil ja nao valem no solo').toBe(true);
    expect(isEasyShortcut('ShiftRight', { players: [jogador, jogador], numPlayers: 2 }),
      'os atalhos do Facil passaram a valer em dupla, e a excecao acima deixou de ser inofensiva').toBe(false);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · tirando `s.numPlayers <= 1` do `isEasyShortcut` → "[Interface] a guarda ... EXISTE" reprova. E o unico
//     caminho pelo qual a excecao do `ShiftRight` deixaria de ser inofensiva, e agora ele esta fechado.
//   · pondo `Digit1` no `select` do jogador 1 → reprovam TRES, entre eles o "[Zero] NENHUMA sobreposicao
//     nova" contra `SCREEN_DIGITS`. E a forma exata do erro que eu cometi na #122, apanhada desta vez — e um
//     dos tres e um caso ANTERIOR a este bloco, o que mostra que a propriedade tem mais de um dono.
//   · tirando `ShiftRight` do `p2[1].start` → reprovam DOIS: o "[Cross-check]" daqui, porque a lista de
//     conhecidas passa a prometer uma sobreposicao que ja nao existe (entrada orfa faz a tabela mentir sobre
//     o tamanho da excecao), e o caso da porta da #122.
