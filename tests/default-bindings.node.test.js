// SPDX-License-Identifier: AGPL-3.0-or-later
// The gate of the binding tables. The central assertion is ONE: nothing is assigned twice.
//
// ⚠️ IT IS NOT HYPOTHETICAL. The default's specification arrived with `I` on two actions — `action4` and R2 — and a
// duplicated binding raises no error anywhere: both actions fire together and the child sees an intermittent double
// action nobody reproduces on purpose.
import { describe, it, expect } from 'vitest';
import { ACTIONS } from '../app/js/core/actions.js';
import {
  KEYBOARD_SOLO, KEYBOARD_DUO, GAMEPAD_STANDARD, bindingProblems, conflictsBetweenTables, unreachable,
} from '../app/js/input/default-bindings.js';
// Only the last block uses these. They are here because the question it asks crosses both files: a key may be free in
// the TABLES and already claimed by a module constant of `input/keydown`.
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
// THE TWO-PLAYER SCHEME (ADR-0096)
// ===================================================================================================
// ⚠️ THE RISK THIS BLOCK EXISTS TO CATCH IS OF ANOTHER FAMILY than the double-in-one-table. Each `KEYBOARD_DUO` scheme
// passes `bindingProblems` ALONE; the defect exists only between the two. The arrows are the concrete case: in
// `KEYBOARD_SOLO` they are a second path to player 1's d-pad, and in a pair they are player 2's d-pad. Left in both,
// both characters would walk together — no error, no warning, and visible only when playing as two.
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
    // The case that names the problem. `KEYBOARD_SOLO` has `ArrowUp` on `up`; in a pair, it must not.
    expect(KEYBOARD_SOLO.up).toContain('ArrowUp');
    expect(P1.up, 'a seta ficou com o jogador 1 e vai mover os dois bonecos').not.toContain('ArrowUp');
    expect(P2.up).toEqual(['ArrowUp']);
    // And the rest of player 1 is the solo scheme: the pair does not reinvent it, only takes the arrows away.
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
    // The Dev wrote «7 (alphanumeric)» and «7 (numeric)» in full, and the scheme only works because `code` separates
    // them: `Digit7` is player 1's (L1) and `Numpad7` is player 2's (L2). Read by `key` they would be the SAME — and with
    // Num Lock off the numeric block arrives under yet another name.
    expect(P1.leftShoulder).toEqual(['Digit7']);
    expect(P2.leftTrigger).toEqual(['Numpad7']);
    expect(conflictsBetweenTables(KEYBOARD_DUO)).toEqual([]);
    // ⚠️ This check accepts what a valid `code` is, not a whitelist of what the table already had: a whitelist refused
    // `ShiftRight` (#122), a legitimate code of the specification. A gate that refuses a CORRECT change protects nobody;
    // it pushes whoever is in a hurry to delete it.
    //
    // What it exists to catch: someone writing a `key` (`'a'`, `'7'`, `'Shift'`) where a `code` is asked for. A `key` is
    // a loose character or a name WITHOUT A SIDE — hence the explicit refusal of bare `Shift`/`Control`/`Alt`/`Meta`,
    // the easiest way to make the mistake.
    const FAMILIAS = /^(Key[A-Z]|Digit\d|Numpad|Arrow(Up|Down|Left|Right)$|F\d{1,2}$)/;
    const NOMEADAS = new Set(['Space', 'Enter', 'Escape', 'Tab', 'Backspace', 'Backquote', 'Minus', 'Equal',
      'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash',
      'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'CapsLock', 'ContextMenu',
      'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
    const SEM_LADO = new Set(['Shift', 'Control', 'Alt', 'Meta']); // these are `key`, never `code`
    const todas = KEYBOARD_DUO.flatMap((t) => ACTIONS.flatMap((a) => t[a] ?? []));
    const maus = todas.filter((c) => SEM_LADO.has(c) || !(FAMILIAS.test(c) || NOMEADAS.has(c)));
    expect(maus, 'binding que não é um `KeyboardEvent.code` reconhecível').toEqual([]);
    // And the check must know how to refuse: without this it could be green by accepting everything.
    expect(['a', '7', 'Shift', 'Escape '].filter((c) => SEM_LADO.has(c) || !(FAMILIAS.test(c) || NOMEADAS.has(c))))
      .toEqual(['a', '7', 'Shift', 'Escape ']);
  });

  it('⚠️ [Interface] a geometria do jogador 2 espelha a do jogador 1 — é o que torna o padrão ensinável', () => {
    // `U I / J K` and `8 9 / 5 6` have the SAME shape on the keyboard, so muscle memory crosses the table:
    //   action1 top-left · action4 top-right · action2 bottom-left · action3 bottom-right
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
    // `I` on `action4` and on `rightTrigger` (R2), literally what the specification said.
    const comErro = { ...KEYBOARD_SOLO, rightTrigger: ['KeyI'] };
    const p = bindingProblems(comErro);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/KeyI/);
    expect(p[0]).toMatch(/action4/);
    expect(p[0]).toMatch(/rightTrigger/);
  });

  it('apanha o duplo dentro de uma lista de várias teclas, não só entre ações', () => {
    const comErro = { ...KEYBOARD_SOLO, action1: ['KeyU', 'ArrowUp'] }; // ArrowUp is already `up`
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
    // ⚠️ `Space` is on the jump too: the Dev said (ADR-0086) the jump lives in `action2`, so the space bar follows the
    // right verb instead of an arbitrarily chosen position.
    expect(KEYBOARD_SOLO.action2).toEqual(['KeyJ', 'Space']);
    expect(KEYBOARD_SOLO.action3).toEqual(['KeyK']);
    expect(KEYBOARD_SOLO.action4).toEqual(['KeyI']);
  });

  it('os ombros e gatilhos, na simetria do QWERTY', () => {
    // 7 above U, 8 above I; Y left of U, O right of I.
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
    // X(west)→U(north-west) · Y(north)→I(north-east) · B(east)→K(south-east) · A(south)→J(south-west).
    // Not decoration: it is what makes muscle memory cross from one transport to the other.
    const XBOX_ROSA = { 2: 'W', 3: 'N', 1: 'E', 0: 'S' };            // face → cardinal point
    const TECLA_ROSA = { KeyU: 'NW', KeyI: 'NE', KeyK: 'SE', KeyJ: 'SW' };
    const HORARIO = { W: 'NW', N: 'NE', E: 'SE', S: 'SW' };          // 45° no sentido horário

    for (const a of ['action1', 'action2', 'action3', 'action4']) {
      const face = XBOX_ROSA[GAMEPAD_STANDARD[a]];
      const tecla = TECLA_ROSA[KEYBOARD_SOLO[a][0]];
      expect(tecla, `${a}: ${face} deveria virar ${HORARIO[face]}`).toBe(HORARIO[face]);
    }
  });

  it('start e select no teclado, na simetria de MÃO', () => {
    // `F` by the thumb of the moving hand (WASD); `H` by the acting hand (UIJK).
    expect(KEYBOARD_SOLO.select).toEqual(['KeyF']);
    expect(KEYBOARD_SOLO.start).toEqual(['KeyH', 'Enter']);
  });
});

describe('o que um transporte NÃO alcança é dito, não escondido', () => {
  it('⚠️ o teclado passou a alcançar as quatorze — a dívida do ADR-0074 §1 fechou', () => {
    // The record said `start` existed on two transports of nine and was missing on the keyboard.
    expect(unreachable(KEYBOARD_SOLO)).toEqual([]);
  });

  it('o gamepad alcança as quatorze', () => {
    expect(unreachable(GAMEPAD_STANDARD)).toEqual([]);
  });

  it('`unreachable` continua a apanhar uma ausência de verdade', () => {
    // Without this one, the test above would pass with an `unreachable` that always returned empty.
    expect(unreachable({ ...KEYBOARD_SOLO, leftTrigger: null })).toEqual(['leftTrigger']);
  });
});

// ==========================================================================================================
// ⚠️ NO SEAT IS LEFT WITHOUT A DOOR TO REMAPPING (#122)
//
// In `KB_DEFAULTS.p2[1]`, of the second seat's fourteen positions, **most are reachable only through the numeric
// block** — the eight actions plus `start` and `select` (measured on 2026-09-07). A Chromebook has no such block, and a
// Chromebook is the hardware pillar 1 names.
//
// ⚠️ WHAT THAT DOES TO A CHILD: they walk with the arrows (which exist), act on nothing, and **cannot open the menu to
// fix it** — because the key that opens the menu is in the same missing block. It is the definition of
// «um padrao do qual a crianca nao escapa».
//
// ⚠️ AND THE FIX IS NOT CHANGING THE KEYS. The audit is explicit: «tornar o proprio padrao remapeavel, e nao trocar as
// teclas que ele escolheu». The numpad layout is BETTER where it exists — a physical block under one hand — and takes
// nothing from the first player. What was missing was ONE door.
//
// MUTATIONS CHECKED — at the end of the block.
// ==========================================================================================================
describe('input/default-bindings — toda cadeira tem porta para o remapeamento (#122)', () => {
  const soNumpad = (v) => (v ?? []).length > 0 && (v ?? []).every((c) => c.startsWith('Numpad'));

  it('⚠️ [Cross-check] o segundo assento E MESMO quase todo numpad — senao nao ha defeito a consertar', () => {
    // Anchors the premise: if this seat ever stops depending on the numpad, the case below would be protecting
    // something no longer true, and this one warns before that.
    const p2 = KEYBOARD_DUO[1];
    const presas = ACTIONS.filter((a) => soNumpad(p2[a]));
    expect(presas.length, 'o segundo assento deixou de depender do numpad; reler a #122').toBeGreaterThanOrEqual(8);
    expect(presas).toContain('select');
  });

  it('⚠️ [Right] o `start` de CADA esquema de dupla e alcancavel SEM bloco numerico', () => {
    // `start` is the pause, and from the pause the remapping screen is reachable — where all the other thirteen
    // positions can be changed. One door is enough to escape; ZERO doors is not.
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
    // The audit asked for this in writing, and one case fewer here would leave the next person "tidying up" the scheme.
    const p2 = KEYBOARD_DUO[1];
    expect(p2.start).toContain('Numpad1');
    expect(p2.action1).toEqual(['Numpad8']);
    expect(p2.up).toEqual(['ArrowUp']);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · going back to `start: ['Numpad1']` (removing the door) → the [Right] case of EACH scheme's `start` fails naming
//     `p2`. It is #122 reproduced: the second seat's child with no way to open the menu on a Chromebook.
//   · replacing the door with a key already used (e.g. `KeyH`) → FOUR fail, and three of them are gates that existed
//     before this issue. It is this block's best news: the property "no key has two owners" did not depend on
//     remembering it when adding a door.
//   · replacing `Numpad1` with `ShiftRight` instead of adding → the [Right] case of the numpad keys STAYING fails. The
//     fix asked for was adding a door, not changing the layout that works where there is a numpad.

// ==========================================================================================================
// ⚠️ A DEFAULT BINDING DOES NOT COLLIDE WITH A KEY THE MODULE ALREADY CLAIMS
//
// ⚠️ A key can be free in all FOUR TABLES and still be claimed by an `input/keydown` module set: `ShiftRight`, the
// second seat's `start` door (#122), is in `EASY_SHORTCUTS`.
//
// There is no live collision: `isEasyShortcut` requires `numPlayers <= 1` and `p2[1]` only exists with two. But that is
// «verdade por acidente de uma guarda noutro ficheiro» — exactly the shape of defect #121 paid for, where the pan was
// right on the platformer because its world was measured in pixels.
//
// So safety stops being an accident and is ASSERTED: the overlap is named with its reason, and a case holds the guard
// that makes it harmless. If someone removes `numPlayers <= 1`, the suite turns red before the second child's pause
// key becomes the first player's «trocar poder».
//
// MUTATIONS CHECKED — at the end of the block.
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

  /** The KNOWN overlaps, each with its reason. The list does not grow without someone writing why. */
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
    // Without `numPlayers <= 1`, the second child's pause key becomes the first player's «trocar poder».
    const jogador = { easy: true };
    expect(isEasyShortcut('ShiftRight', { players: [jogador], numPlayers: 1 }),
      'a premissa do caso morreu: os atalhos do Facil ja nao valem no solo').toBe(true);
    expect(isEasyShortcut('ShiftRight', { players: [jogador, jogador], numPlayers: 2 }),
      'os atalhos do Facil passaram a valer em dupla, e a excecao acima deixou de ser inofensiva').toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing `s.numPlayers <= 1` from `isEasyShortcut` → the [Interface] case of the guard fails. It is the only path
//     by which the `ShiftRight` exception would stop being harmless, and now it is closed.
//   · putting `Digit1` on player 1's `select` → THREE fail, among them the [Zero] case of no new overlap against
//     `SCREEN_DIGITS`. It is the exact shape of the mistake made in #122, caught this time — and one of the three is a
//     case OLDER than this block, which shows the property has more than one owner.
//   · removing `ShiftRight` from `p2[1].start` → TWO fail: this block's [Cross-check], because the known list would
//     promise an overlap that no longer exists (an orphan entry makes the table lie about the exception's size), and
//     #122's door case.
