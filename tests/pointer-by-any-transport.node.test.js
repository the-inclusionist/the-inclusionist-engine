// SPDX-License-Identifier: AGPL-3.0-or-later
// «CAPACIDADE DECLARADA» MUST NOT MEAN «SÓ RATO» — two of the four gates ADR-0112 asks for.
//
// The other two are the refusal by a device with no pointer and the fourteen discrete actions. These two are
// properties of the MODEL, and need no wiring:
//
//   · «UM PONTEIRO ALCANÇADO PELO OLHAR OFERECE AS MESMAS OPERAÇÕES QUE UM ALCANÇADO PELO RATO»
//   · «O PONTEIRO CARREGA A SUA FONTE, como todo comando (ADR-0111)»
//
// 📏 AND WHERE EACH CAN BE ASSERTED TODAY is not where it seems. `defaultTransports` has THREE rows — gamepad,
// keyboard, touch —, and the four assisted ones of ADR-0074 (eyes, face, gestures, speech) are not transports there
// (issue #11). So nothing can be asserted about the REAL gaze. What can be, and it is what the rule asks, is the two
// things the gaze will depend on the day it arrives:
//
//   (a) the operations of `input/pointer` are BLIND to the source — none behaves differently by who produced the
//       sample; and the only one that reads it, reads it to ANSWER about it;
//   (b) `reach` accepts a pointer declared by ANY transport, and not only by the two that declare one today. An
//       «optimisation» asking `t.id === 'teclado' || t.id === 'toque'` would pass today's whole suite and close the
//       door on the gaze before it exists.
//
// ⚠️ AND THAT IS THE SHAPE OF THE DEFECT THE RECORD FORESEES: not a written refusal, but a path only the mouse walks,
// discovered when someone turns on the webcam and the drawing game says the device will not do.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isInside, clampInside, pressEdge, switchedTransport, DEFAULT_POINTER } from '../app/js/input/pointer.js';
import { TRANSPORT_NAMES } from '../app/js/input/transport-in-use.js';
import { reach } from '../app/js/input/transports.js';

const FONTE_PONTEIRO = readFileSync(fileURLToPath(new URL('../app/js/input/pointer.ts', import.meta.url)), 'utf8');

const amostra = (fx, fy, apertado, origem) => ({ fx, fy, source: origem, pressed: apertado });

/** Points that exercise inside, outside on all four sides, and the edges inclusive. */
const PONTOS = [
  [0.5, 0.5], [0, 0], [1, 1], [0.5, 0], [0, 0.5],
  [-0.2, 0.5], [1.2, 0.5], [0.5, -0.3], [0.5, 1.4], [-2, 3],
];

describe('ADR-0112 · as operações do ponteiro são cegas à origem', () => {
  it('[Vácuo] há sete transportes e o módulo é mesmo lido', () => {
    expect(TRANSPORT_NAMES.length).toBe(7);
    expect(TRANSPORT_NAMES).toContain('olhos');
    expect(FONTE_PONTEIRO).toContain('export function clampInside');
  });

  it('[Happy] `isInside` and `clampInside` answer the SAME for all seven transports', () => {
    for (const [fx, fy] of PONTOS) {
      const refDentro = isInside(amostra(fx, fy, false, 'rato-inexistente'));
      const refPreso = clampInside({ fx, fy });
      for (const origem of TRANSPORT_NAMES) {
        const a = amostra(fx, fy, false, origem);
        expect(isInside(a), `isInside answered differently because the source was ${origem}`).toBe(refDentro);
        const preso = clampInside(a);
        expect(preso.fx, `clampInside moved x differently because the source was ${origem}`).toBe(refPreso.fx);
        expect(preso.fy, `clampInside moved y differently because the source was ${origem}`).toBe(refPreso.fy);
      }
    }
  });

  // ⚠️ THE EDGE IS THE OPERATION A DRAWING GAME USES MOST — it is what says «a caneta desceu». If it depended on the
  // source, a child drawing by gaze dwell would get a stroke that never starts.
  it('[Feliz] a borda do aperto é a mesma para os sete transportes', () => {
    for (const origem of TRANSPORT_NAMES) {
      const solto = amostra(0.5, 0.5, false, origem);
      const preso = amostra(0.5, 0.5, true, origem);
      expect(pressEdge(solto, preso), `descida perdida em ${origem}`).toBe('desceu');
      expect(pressEdge(preso, solto), `subida perdida em ${origem}`).toBe('subiu');
      expect(pressEdge(preso, preso), `${origem} inventou uma borda`).toBe(null);
    }
  });

  // 🎯 THE STRUCTURAL SIEVE, and it is what holds the rule in the future: a NEW operation branching by transport
  // would pass the cases above (they enumerate today's operations) and silently take drawing away from the gaze.
  // Only `switchedTransport` may read `.source` — and it reads it to ANSWER about it, not to decide anything else.
  it('[Fronteira] só `switchedTransport` lê `.source` neste módulo', () => {
    const semComentarios = FONTE_PONTEIRO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
    const partes = semComentarios.split(/export function /);
    const leitores = partes
      .filter((p) => p.includes('.source'))
      .map((p) => p.slice(0, p.indexOf('(')));
    expect(leitores, `operação que ramifica por transporte: ${leitores.join(', ')}`).toEqual(['switchedTransport']);
  });

  it('[Interface] a origem é obrigatória na amostra — o padrão traz uma', () => {
    expect(TRANSPORT_NAMES).toContain(DEFAULT_POINTER.source);
    expect(switchedTransport(DEFAULT_POINTER, { ...DEFAULT_POINTER, source: 'olhos' })).toBe(true);
  });
});

describe('ADR-0112 · o alcance aceita ponteiro de QUALQUER transporte', () => {
  const ACOES = ['up', 'down', 'left', 'right'];
  // ⚠️ `slots: 14` AND NOT 1, and the [Zero] case is what showed it: with one slot, the gaze would fail by SLOTS and
  // not by pointer, and the three cases above would measure the wrong thing with the right answer. Fourteen is
  // also what ADR-0074 claims for the assisted transports — the fixture describes a device that can exist, not a
  // convenient one.
  const olhar = (aponta) => ({
    id: 'olhos', slots: 14, available: () => true,
    ...(aponta === undefined ? {} : { points: () => aponta }),
  });

  // 🎯 The case that closes the door before it is opened: when the assisted transports of #11 arrive, `reach`
  // already accepts them as a pointer, with no new line and no list of privileged ids.
  it('[Feliz] um transporte assistido que declara apontar SERVE um jogo que pede ponteiro', () => {
    const a = reach([olhar(true)], ACOES, 1, true);
    expect(a.ok, 'o olhar declarou apontar e foi recusado').toBe(true);
    expect(a.cannotPoint).toEqual([]);
  });

  // 📌 THE PAIR. Without it, «aceitar sempre» would pass the case above — and a drawing game would say «serve» to a
  // device with no way to draw, which is the lie `ok` must not tell (ADR-0112, and the reason `serve` became three
  // things).
  it('[Fronteira] o mesmo transporte SEM declarar não serve, e o cartão diz porquê', () => {
    const a = reach([olhar(undefined)], ACOES, 1, true);
    expect(a.ok).toBe(false);
    expect(a.cannotPoint).toEqual(['olhos']);
  });

  // ⚠️ `aponta` IS A FUNCTION and not a boolean: the webcam can be turned on mid-game. A transport answering
  // `false` now is refused now, and that must not be frozen in a boot-time reading.
  it('[Fronteira] quem declara apontar mas responde `false` agora é recusado agora', () => {
    const a = reach([olhar(false)], ACOES, 1, true);
    expect(a.ok).toBe(false);
    expect(a.cannotPoint).toEqual(['olhos']);
  });

  it('[Zero] sem pedir ponteiro, o mesmo transporte serve na mesma', () => {
    expect(reach([olhar(undefined)], ACOES, 1, false).ok).toBe(true);
  });
});

// ===== MUTATIONS CHECKED (2026-09-08, by script, with occurrence counts) =====
// What follows is what was MEASURED, and one of them contradicts what I had predicted — usefully.
//
// 1. `clampInside` returning the same object only when `origem === 'rato'`
//    → fails ONLY the STRUCTURAL sieve. 🎯 And it is the most informative mutation of the batch: the behaviour
//    cases do NOT catch it, because `clampInside` receives `AsFraction` (only `fx`/`fy`) and the mutation changes
//    the IDENTITY of the returned object, not the coordinates — and the coordinates are what they compare. That
//    is: the structural sieve catches a class the enumeration of operations cannot reach, which is exactly why it
//    exists and is not a duplicate of it.
// 2. `pressEdge` returning `null` for anyone who is neither 'teclado' nor 'toque' — the EXACT shape of the defect
//    the record fears → the edge's [Feliz] **and** the structural sieve fail
// 3. `apontaSeFor` → `!pedePonteiro || t.id === 'teclado' || t.id === 'toque'` → the reach's [Feliz] fails
// 4. `apontaSeFor` → `true`                                          → BOTH [Fronteira] of the reach fail
// 5. `TRANSPORT_NAMES` cut down to three                             → [Vácuo] fails
//    🎯 with the list blinded, the loops would run over fewer transports and stay green saying nothing about the
//    gaze — a sieve that enumerates is as strong as its list.
