// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME DECLARES THE BUTTON MAP — and the child who remapped still wins (ADR-0115, issue #127).
//
// ========================= WHY TWO ASSERTIONS =========================
// `GAMEPAD_STANDARD` is read in one place only, and at that point the SEAT has to be known — so the poll loop resolves
// the `owner` before reading the table. That is why this file asserts TWO things and not one: the table, and that the
// loop asks for it by the right seat.
//
// ⚠️ THE PRECEDENCE DIFFERS IN PLACE from the keyboard's, and that is the most important case here: on the controller,
// the map the child recorded in the wizard is not a layer on top of the game's default — it is a whole BRANCH of
// `padActions`. If it exists, the game's default is not even consulted. On both devices she wins; just not the same way,
// and one day someone will «arrumar» that.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createPadTable } from '../app/js/input/pad-defaults.js';
import { padActions } from '../app/js/input/pad-reading.js';
import { GAMEPAD_STANDARD } from '../app/js/input/default-bindings.js';

/** A fake pad with the requested buttons pressed. */
const pad = (...premidos) => ({
  id: 'std', index: 0, mapping: 'standard',
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: premidos.includes(i) })),
  axes: [0, 0, 0, 0],
});

describe('a tabela de botões deste jogo', () => {
  it('[Zero] sem declaração, é a fábrica da engine — e é o MESMO objecto, não uma cópia', () => {
    expect(createPadTable(null)(1, 0)).toBe(GAMEPAD_STANDARD);
  });

  it('[Right] o jogo troca UMA posição e o resto continua a ser da engine', () => {
    const t = createPadTable(() => ({ action1: 3 }))(1, 0);
    expect(t.action1, 'o padrão do jogo não chegou').toBe(3);
    expect(t.action2, 'parcial virou substituição').toBe(GAMEPAD_STANDARD.action2);
  });

  it('🎯 [Boundary] o ASSENTO chega ao jogo — dois assentos podem querer arranjos diferentes', () => {
    const padTable = createPadTable((jogadores, assento) => ({ action1: jogadores * 10 + assento }));
    expect(padTable(2, 0).action1).toBe(20);
    expect(padTable(2, 1).action1).toBe(21);
  });

  it('📌 `null` para um arranjo deixa esse arranjo com a fábrica', () => {
    const padTable = createPadTable((jogadores) => (jogadores === 1 ? { action1: 3 } : null));
    expect(padTable(1, 0).action1).toBe(3);
    expect(padTable(2, 0)).toBe(GAMEPAD_STANDARD);
  });

  it('⚠️ cada tabela tem a SUA memória — senão o jogo seguinte (ou outra raiz) lia a tabela do anterior', () => {
    // ADR-0232 D4: the memo was one for the page, and every writer had to remember to clear it. Now a second mapping
    // builds a second table, and the first table's memo cannot answer for it.
    const primeira = createPadTable(() => ({ action1: 3 }));
    expect(primeira(1, 0).action1).toBe(3);
    const segunda = createPadTable(() => ({ action1: 7 }));
    expect(segunda(1, 0).action1, 'a memória da primeira tabela respondeu pela segunda').toBe(7);
    expect(primeira(1, 0).action1, 'e a primeira passou a responder com a segunda').toBe(3);
  });

  it('[Interface] a mesma pergunta duas vezes devolve o MESMO objecto — isto corre por quadro', () => {
    const padTable = createPadTable(() => ({ action1: 3 }));
    expect(padTable(1, 0)).toBe(padTable(1, 0));
  });
});

describe('a leitura dos botões, com a tabela do jogo', () => {
  it('[Right] o botão que o JOGO escolheu levanta a acção, e o da fábrica já não', () => {
    const t = { ...GAMEPAD_STANDARD, action1: 3 };
    expect(padActions(pad(3), null, t).action1, 'o botão declarado pelo jogo não respondeu').toBe(true);
    expect(padActions(pad(GAMEPAD_STANDARD.action1), null, t).action1, 'o botão da fábrica continuou a valer').toBe(false);
  });

  it('[Zero] sem tabela, a assinatura devolve o comportamento de sempre', () => {
    expect(padActions(pad(GAMEPAD_STANDARD.action1), null).action1).toBe(true);
  });

  it('🔴 o mapa que a CRIANÇA gravou no assistente ignora o padrão do jogo — e é assim que tem de ser', () => {
    // ⚠️ The `custom` branch does not even consult the table. A game declaring `action1: 3` must not rewrite the button
    // she chose in the wizard because she could not reach the other one.
    const custom = { action1: { b: 9 } };
    const t = { ...GAMEPAD_STANDARD, action1: 3 };
    expect(padActions(pad(9), custom, t).action1, 'a escolha dela deixou de valer').toBe(true);
    expect(padActions(pad(3), custom, t).action1, 'o padrão do jogo passou por cima dela').toBe(false);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. `padTable` ignoring the `assento` (key with `jogadores` only) → the SEAT case fails, and it is what justifies
//    resolving the `owner` inside the poll loop.
// 2. the memo hoisted out of `createPadTable` (one for every table) → the own-memory case fails. Without it, the second
//    game mounted on the page reads the first one's table — and the reading is right everywhere except in the value.
// 3. `padActions` reading `GAMEPAD_STANDARD` instead of the parameter → the first case of the second section fails.
// 4. the `custom` branch merging the game's table on top → the child's case fails. It is not a hypothesis: it is exactly
//    the «arrumação» someone does on seeing two similar paths.
