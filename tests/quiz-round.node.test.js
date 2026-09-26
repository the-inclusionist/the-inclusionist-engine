// SPDX-License-Identifier: AGPL-3.0-or-later
// THE RULES OF THE DEMO QUIZ'S ROUND (consumer-quiz/quiz-round) — pure, in node.
//
// 📌 What the test bench promises, each rule by a literal: the cursor reaches every item by either pair of arrows; an attempt
// counts by ADR-0049 §5–§6 (blue first time, green on the second or third, red on the third wrong, the explanation, three
// attempts worth nothing, then the answer to copy); the options come round rotated one place per pass, with no randomness
// (§4); and the bar is `bandOf` projected by `barOf` over the skill's own history — the ten-question window reached in a
// sitting, the copy turning it orange at once.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  nextFocus, gridStep, gridRows, skillRows, skillsInOrder, rotated, attempt, FIRST_ATTEMPT, ATTEMPTS, QUIZ_FLOOR, withResult,
  afterCopying, OPTION_COLUMNS, SKILL_COLUMNS,
} from '../app/js/consumer-quiz/quiz-round.js';
import { FIFTEEN_SKILLS, THREE_SKILLS } from './fixtures/quiz-skills.js';

describe('nextFocus — a regra que o teclado e o pad compartilham', () => {
  it('[Right] anda para frente e para trás, e dá a volta nas duas pontas', () => {
    expect(nextFocus(0, 1, 4)).toBe(1);
    expect(nextFocus(2, -1, 4)).toBe(1);
    // Wrapping is not a convenience: whoever navigates only by keyboard or by ONE button has no other way back.
    expect(nextFocus(3, 1, 4)).toBe(0);
    expect(nextFocus(0, -1, 4)).toBe(3);
  });

  it('[Zero] lista vazia devolve 0 em vez de NaN', () => {
    expect(nextFocus(0, 1, 0)).toBe(0);
    expect(nextFocus(2, -1, 0)).toBe(0);
  });
});

describe('the grid — every item reachable by either pair of arrows', () => {
  const FIVE = gridRows(5, OPTION_COLUMNS);

  it('🔴 [Right] five options sit «1 2 3» over «4 5», in reading order', () => {
    expect(OPTION_COLUMNS).toBe(3);
    expect(FIVE).toEqual([[0, 1, 2], [3, 4]]);
  });

  it('🔴 [Right] left and right walk the reading order, and wrap', () => {
    const walk = (from, move, n) => Array.from({ length: n }, () => (from = gridStep(FIVE, from, move)));
    expect(walk(0, 'right', 5)).toEqual([1, 2, 3, 4, 0]);
    expect(walk(0, 'left', 2)).toEqual([4, 3]);
  });

  it('🔴 [Right] up and down go down a column and on to the next one — below «1» is «4», then «2»', () => {
    const walk = (from, move, n) => Array.from({ length: n }, () => (from = gridStep(FIVE, from, move)));
    expect(walk(0, 'down', 5)).toEqual([3, 1, 4, 2, 0]);
    expect(walk(0, 'up', 2)).toEqual([2, 4]);
  });

  it('[Boundary] a cursor off the grid comes back to its first item; an empty grid answers 0', () => {
    expect(gridStep(FIVE, 9, 'down')).toBe(0);
    expect(gridStep([], 0, 'right')).toBe(0);
  });

  it('🔴 [Right] the start screen: Educação Infantil first, then Ensino Fundamental, each group in rows of its own', () => {
    const ordered = skillsInOrder(THREE_SKILLS);
    // the data lists the infantil skill LAST; the screen still shows its group first
    expect(ordered.map((s) => s.code)).toEqual(['EI03EF01', 'EF05MA08', 'EF06LI17']);
    expect(skillRows(ordered)).toEqual([[0], [1, 2]]);
    expect(SKILL_COLUMNS).toBe(5);
    // fifteen: five of Educação Infantil in one row, ten of the fundamental in two
    expect(skillRows(skillsInOrder(FIFTEEN_SKILLS))).toEqual([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14]]);
    expect(skillRows(skillsInOrder(FIFTEEN_SKILLS.slice(1)))).toEqual([[0, 1, 2, 3], [4, 5, 6, 7, 8], [9, 10, 11, 12, 13]]);
  });
});

describe('the options come round rotated one place per pass (ADR-0049 §4: nothing random)', () => {
  it('🔴 [Right] pass 0 is the data; each pass moves every option one place up, and the right one with it', () => {
    const o = ['a', 'b', 'c', 'd', 'e'];
    expect(rotated(o, 1, 0)).toEqual({ options: ['a', 'b', 'c', 'd', 'e'], correct: 1 });
    expect(rotated(o, 1, 1)).toEqual({ options: ['b', 'c', 'd', 'e', 'a'], correct: 0 });
    expect(rotated(o, 1, 2)).toEqual({ options: ['c', 'd', 'e', 'a', 'b'], correct: 4 });
    // five passes and the screen is the first one again
    expect(rotated(o, 3, 5)).toEqual(rotated(o, 3, 0));
  });

  it('[Zero] no options, no rotation', () => {
    expect(rotated([], 0, 3)).toEqual({ options: [], correct: 0 });
  });
});

describe('an attempt, by ADR-0049 §5–§6', () => {
  const RIGHT = 2;
  const play = (picks) => {
    let state = FIRST_ATTEMPT;
    const kinds = [];
    let last;
    for (const p of picks) {
      last = attempt(state, p, RIGHT, 5);
      kinds.push(last.kind);
      if ('next' in last) state = last.next;
    }
    return { kinds, last, state };
  };

  it('🔴 [Right] right on the first attempt is BLUE (`primeira`), on the second or third GREEN (`mediada`)', () => {
    expect(play([2]).last).toEqual({ kind: 'right', result: 'primeira', copied: false });
    expect(play([0, 2]).last).toEqual({ kind: 'right', result: 'mediada', copied: false });
    expect(play([0, 1, 2]).last).toEqual({ kind: 'right', result: 'mediada', copied: false });
  });

  it('🔴 [Right] a wrong attempt turns that option off, and picking it again is refused — not a second attempt', () => {
    const { kinds, state } = play([0, 0]);
    expect(kinds).toEqual(['wrong', 'refused']);
    expect(state).toEqual({ phase: 'trying', wrong: 1, off: [0] });
  });

  it('🔴 [Right] the THIRD wrong attempt fails the question and opens the explanation, with every option back on', () => {
    expect(ATTEMPTS).toBe(3);
    const { kinds, state } = play([0, 1, 3]);
    expect(kinds).toEqual(['wrong', 'wrong', 'failed']);
    // back on: with three off, two remain and «three more attempts» could never fail again (see `attempt`)
    expect(state).toEqual({ phase: 'explained', wrong: 0, off: [] });
  });

  it('🔴 [Right] after the explanation a right answer is worth NOTHING — no segment', () => {
    expect(play([0, 1, 3, 2]).last).toEqual({ kind: 'right', result: null, copied: false });
    expect(play([0, 1, 3, 0, 2]).last).toEqual({ kind: 'right', result: null, copied: false });
  });

  it('🔴 [Right] three more wrong mark the answer to COPY: every other option off; confirming it is a copy', () => {
    const { kinds, state } = play([0, 1, 3, 4, 0, 1]);
    expect(kinds).toEqual(['wrong', 'wrong', 'failed', 'wrong', 'wrong', 'copy']);
    expect(state).toEqual({ phase: 'copying', wrong: 0, off: [0, 1, 3, 4] });
    expect(attempt(state, 3, RIGHT, 5)).toEqual({ kind: 'refused' });
    expect(attempt(state, RIGHT, RIGHT, 5)).toEqual({ kind: 'right', result: null, copied: true });
  });
});

describe('the bar — `bandOf` projected by `barOf`, per skill, in memory (ADR-0049 §5, ADR-0103)', () => {
  const answer = (results, reading) => results.reduce((r, x) => withResult('EF05MA08', r, x), reading);
  const colours = (reading) => reading.bar.segmentos.join(' ');

  it('🔴 [Right] the floor is five options with three attempts: 0.60', () => {
    expect(QUIZ_FLOOR).toBeCloseTo(0.6, 10);
  });

  it('🔴 [Right] each result paints one segment: blue, green, red — and the bar belongs to its skill', () => {
    const r = answer(['primeira', 'mediada', 'falhou']);
    expect(colours(r)).toBe('azul verde vermelho');
    expect(r.bar.cor).toBe('nenhuma');
    expect(r.bar.skill).toBe('EF05MA08');
  });

  it('🔴 [Right] EIGHT blues in the window of ten turn it PURPLE — reachable in a sitting — and the count starts again', () => {
    const r = answer(['mediada', 'mediada', ...Array(8).fill('primeira')]);
    expect(r.history.length).toBe(10);
    expect(r.bar.cor, 'eight blues in ten did not raise the bar').toBe('roxa');
    // the next result starts a new count (`afterSignalling`): a signal is one decision, not one per question after it
    expect(withResult('EF05MA08', r, 'primeira').history).toEqual(['primeira']);
  });

  it('🔴 [Right] FOUR failed in a row turn it ORANGE, even before the window fills', () => {
    const r = answer(['primeira', 'falhou', 'falhou', 'falhou', 'falhou']);
    expect(r.bar.cor).toBe('laranja');
  });

  it('🔴 [Right] copying the answer turns it orange AT ONCE, over a history that alone would not (ADR-0049 §6)', () => {
    const r = answer(['primeira', 'falhou']);
    expect(r.bar.cor).toBe('nenhuma');
    const copied = afterCopying('EF05MA08', r);
    expect(copied.bar.cor).toBe('laranja');
    expect(copied.history).toEqual(r.history);
    // and it counts again from the next question
    expect(withResult('EF05MA08', copied, 'primeira').history).toEqual(['primeira']);
  });

  it('[Zero] the first result of a skill starts its bar', () => {
    expect(withResult('X', undefined, 'falhou')).toMatchObject({ history: ['falhou'], bar: { segmentos: ['vermelho'], cor: 'nenhuma' } });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/mutate.mjs`: each occurrence counted first, applied alone, this file with consumer-quiz.node,
// quiz-bench and quiz-bench-layout run, restored from a copy and checked by sha256) — all red:
//   R1 up/down walk the rows like left/right   R2 no wrap at the ends   R3 the start screen in the data's order
//   R4 no rotation   R5 the right answer not rotated with the options   R6 a wrong option stays on   R7 a tried option counted again
//   R8 every right answer blue   R9 the second wrong fails the question   R10 the explanation keeps the options off
//   R11 a right answer after the explanation paints a segment   R12 the copy leaves the other options on
//   R13 the count not restarted after a signal   R14 the copy does not turn the bar orange   R15 the floor of four options
//   R16 the fundamental group first   R17 three codes to a row (the layout case too)   R18 options in one column
