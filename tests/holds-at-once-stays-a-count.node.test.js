// SPDX-License-Identifier: AGPL-3.0-or-later
// `holdsAtOnce` REMAINS A COUNT — the protective gate ADR-0115 owes.
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 ADR-0115 came from the Dev's correction — «nem todo jogo precisa de alternância, somente os que precisam de tecla
// segurando» — and writing it, the measurement caught a trap: **`holdsAtOnce()` SEEMS to answer «este jogo segura
// teclas?» and does not.**
//
//   · `conformanceProblems` REFUSES zero, with a written reason that is about the REACH ARITHMETIC — «a game that holds
//     nothing cannot be played» — and not about latching;
//   · `consumer-quiz` declares **1 while holding nothing**, because the contract obliges ≥ 1.
//
// That is: «um de cada vez» and «um SEGURADO» are the same number. Whoever comes next to build ADR-0115 will look at
// this field, and the wrong reading raises no error: it makes the reach pass vacuously and #112's card never appear,
// which is exactly the defect `holdsAtOnce` exists to fix (ADR-0104 §A).
//
// ⚠️ THIS GATE DOES NOT PREVENT THE DECISION — it prevents the ACCIDENTAL decision. If the field is ever split in two,
// the record that splits it deletes this file and writes its own; what cannot happen is the meaning changing because
// someone read fast.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { conformanceProblems } from '../app/js/core/contract.js';

/** The minimal valid declaration, with `holdsAtOnce` as the parameter — the thing this file varies. */
function declaracao(segura) {
  return {
    topology: () => ({ kind: 'hotspots', order: ['a', 'b', 'c'] }),
    holdsAtOnce: () => segura,
    tick: 'player',
    world: () => ({ kind: 'none' }),
    roleAt: () => 'goal',
    nameAt: () => ({ text: 'alvo', gender: 'm', plural: false }),
    focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
    objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 3 }),
    targetsOf: () => [{ x: 0, y: 0 }],
  };
}

const problemasDoCampo = (segura) => conformanceProblems(declaracao(segura)).filter((p) => p.startsWith('holdsAtOnce'));

describe('`holdsAtOnce` é uma CONTAGEM e o piso é 1', () => {
  it('[Right] um, dois e três são declarações válidas', () => {
    for (const n of [1, 2, 3, 9]) {
      expect(problemasDoCampo(n), `${n} deixou de ser uma contagem válida`).toEqual([]);
    }
  });

  // 🔴 ZERO IS STILL REFUSED, and the reason matters more than the refusal: it is about the reach arithmetic. Letting
  // zero through would make `reach()` pass VACUOUSLY — the same defect `reachable` refuses — and the card telling the
  // child their device cannot run the game would never appear.
  it('🔴 [Zero] zero é RECUSADO, e não passa a significar «não segura nada»', () => {
    expect(problemasDoCampo(0), 'zero passou a ser aceite — o alcance passa a aprovar por vacuidade').toHaveLength(1);
  });

  it('[Fronteira] negativo e fraccionário também são recusados', () => {
    expect(problemasDoCampo(-1)).toHaveLength(1);
    expect(problemasDoCampo(1.5)).toHaveLength(1);
  });

  // ⚠️ THE MESSAGE IS PART OF THE CONTRACT, and it is what teaches the next author. «How many» and not «whether»: whoever
  // reads the complaint must understand the field asks for a NUMBER of fingers, not a yes/no.
  it('⚠️ [Interface] a acusação diz QUANTAS, e não SE', () => {
    const [msg] = conformanceProblems({ ...declaracao(1), holdsAtOnce: undefined })
      .filter((p) => p.startsWith('holdsAtOnce'));
    expect(msg, 'a mensagem deixou de pedir uma contagem').toContain('how many');
    expect(msg.toLowerCase(), 'a mensagem passou a sugerir uma pergunta de sim/não').not.toContain('whether');
  });
});

describe('o número é usado como MAGNITUDE, e não como bandeira', () => {
  // 🎯 THE CASE THAT TELLS THE TWO READINGS APART, and no other does. If someone starts reading this field as
  // «segura / não segura», 1 and 3 behave the same — and nothing else in this suite notices. Here the difference is
  // observable: a device that holds TWO serves whoever asks for two and not whoever asks for three.
  it('🎯 [Right] pedir 3 e pedir 1 dão respostas DIFERENTES no alcance', async () => {
    const { reach } = await import('../app/js/input/transports.js');
    const acoes = ['up', 'down', 'left', 'right'];
    // A transport with slots to spare and a ceiling of TWO at once — the shape of touch (SEGURA_TOQUE).
    const doisDedos = [{ id: 'toque', slots: 14, holds: 2, available: () => true }];

    expect(reach(doisDedos, acoes, 1).ok, 'quem pede um deixou de ser servido por dois dedos').toBe(true);
    expect(reach(doisDedos, acoes, 2).ok, 'quem pede dois deixou de ser servido por dois dedos').toBe(true);
    expect(reach(doisDedos, acoes, 3).ok, 'quem pede TRÊS passou a ser servido por dois dedos').toBe(false);
  });

  // 📌 And the pair: the refusal names the transport that does not hold, instead of just saying «não». It is what #112's
  // screen shows the child, and without it `ok: false` would be a dead end.
  it('📌 [Right] quem não segura o bastante é NOMEADO, com o número dele', async () => {
    const { reach } = await import('../app/js/input/transports.js');
    const a = reach([{ id: 'toque', slots: 14, holds: 2, available: () => true }], ['up', 'down'], 3);
    expect(a.cannotHold).toEqual([{ id: 'toque', holds: 2 }]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// 1. `conformanceProblems` accepting zero            → 🔴 the ZERO case fails
// 2. the message saying «whether the game holds»     → ⚠️ the complaint case fails, on both halves
// 3. `input/transports`' `holds()` always returning
//    `true` (the ceiling stops counting)             → 🎯 the MAGNITUDE case fails, and it is the only one that catches
//    it: nothing else in this suite tells «lê como número» from «lê como bandeira»
// 4. `naoSeguram` not naming the transport           → the pair fails
