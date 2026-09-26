// SPDX-License-Identifier: AGPL-3.0-or-later
// consumer-quiz/quiz-round — THE RULES OF THE DEMO QUIZ'S ROUND, pure: where the cursor goes, what an attempt counts, how the
// options come round again and what lands on the skill's bar. No DOM, no engine: the node gates call these directly.
//
// 📌 THE BAR'S THRESHOLDS ARE NOT HERE, and that is the point: the verdict is `educational/adaptive-engine.bandOf`'s and the
// projection `educational/segment-bar.barOf`'s (ADR-0049 §5). What this module decides is only the quiz's own: three attempts
// per phase, the options turned back on after the explanation, and the rotation.
import { bandOf, guessFloor, resultadoDaQuestao, type ResultadoDaQuestao } from '../educational/adaptive-engine.js';
import { afterSignalling, barOf, type Bar } from '../educational/segment-bar.js';
import type { QuizSkill } from './quiz-skills.js';

/* ===================================== THE GRID ===================================== */

/** O próximo índice do foco, com as pontas dando a volta. Puro — é a regra que o teclado e o pad compartilham. */
export function nextFocus(currentIdx: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return ((currentIdx + delta) % total + total) % total;
}

export type Move = 'up' | 'down' | 'left' | 'right';

/**
 * THE CURSOR ON A GRID, with every item reachable by either pair of arrows alone. `rows` lists the item indices as they are
 * laid out, row by row. Left and right walk the rows in reading order; up and down walk the COLUMNS, top to bottom, going on to
 * the next column after the last row. Both wrap at the ends (`nextFocus`): a child whose scheme has only one pair still reaches
 * every item, which is what the welcome line promises when it names only up and down.
 */
export function gridStep(rows: readonly (readonly number[])[], index: number, move: Move): number {
  const across = rows.flat();
  const columns = Math.max(0, ...rows.map((r) => r.length));
  const down: number[] = [];
  for (let c = 0; c < columns; c++) for (const r of rows) if (c < r.length) down.push(r[c]!);
  const order = move === 'left' || move === 'right' ? across : down;
  const at = order.indexOf(index);
  if (at < 0) return order[0] ?? 0;
  return order[nextFocus(at, move === 'right' || move === 'down' ? 1 : -1, order.length)]!;
}

/** `count` items in rows of `columns`, in reading order: `[[0, 1, 2], [3, 4]]` for five in three. */
export function gridRows(count: number, columns: number, first = 0): number[][] {
  const rows: number[][] = [];
  for (let k = 0; k < count; k += columns) rows.push(Array.from({ length: Math.min(columns, count - k) }, (_, i) => first + k + i));
  return rows;
}

/**
 * HOW MANY OPTIONS SIT SIDE BY SIDE: three, so five options take two rows — «1 2 3» over «4 5», read left to right.
 * 📏 In one column the fifth option ended under the HUD row at 640×360, and in two columns of three rows a two-line statement
 * with the explanation under it did too (tests/quiz-bench-layout.browser.test.js).
 */
export const OPTION_COLUMNS = 3;

/** The two groups of the start screen, in the order they are shown. */
export const STAGES = ['infantil', 'ef5'] as const;
/** How many skill codes sit side by side. 📏 Measured at 640×360 with the footer's two lines (quiz-bench-layout). */
export const SKILL_COLUMNS = 5;

/** The skills as the start screen shows them: Educação Infantil first, then Ensino Fundamental, each in the data's order. */
export function skillsInOrder(skills: readonly QuizSkill[]): QuizSkill[] {
  return STAGES.flatMap((stage) => skills.filter((s) => s.stage === stage));
}

/** The start screen's rows: each group in rows of `columns`, a group never sharing a row with the next. */
export function skillRows(ordered: readonly QuizSkill[], columns = SKILL_COLUMNS): number[][] {
  const rows: number[][] = [];
  let first = 0;
  for (const stage of STAGES) {
    const n = ordered.filter((s) => s.stage === stage).length;
    rows.push(...gridRows(n, columns, first));
    first += n;
  }
  return rows;
}

/* ===================================== THE ATTEMPTS ===================================== */

/**
 * THE OPTIONS OF PASS `pass`, rotated one place per pass — the option shown first on pass 1 was the second on pass 0. No
 * randomness (ADR-0049 §4): the same sitting always shows the same screen, so a test can walk the ten-question window.
 */
export function rotated<T>(options: readonly T[], correct: number, pass: number): { readonly options: T[]; readonly correct: number } {
  const n = options.length;
  if (!n) return { options: [], correct: 0 };
  const shift = ((pass % n) + n) % n;
  return { options: options.map((_, p) => options[(p + shift) % n]!), correct: (((correct - shift) % n) + n) % n };
}

/** Attempts per phase: three before the explanation, three after it (ADR-0049 §6). */
export const ATTEMPTS = 3;
export type AttemptPhase = 'trying' | 'explained' | 'copying';
/** Where a question stands: the phase, the wrong attempts in it, and the options already tried (off, not picked twice). */
export interface Attempts {
  readonly phase: AttemptPhase;
  readonly wrong: number;
  readonly off: readonly number[];
}
export const FIRST_ATTEMPT: Attempts = { phase: 'trying', wrong: 0, off: [] };
export type AttemptOutcome =
  | { readonly kind: 'refused' }
  | { readonly kind: 'wrong' | 'failed' | 'copy'; readonly next: Attempts }
  | { readonly kind: 'right'; readonly result: ResultadoDaQuestao | null; readonly copied: boolean };

/**
 * ONE ATTEMPT, by ADR-0049 §5–§6. Right in the first phase is `resultadoDaQuestao(attempt)` — blue on the first, green on the
 * second or third (the engine's rule, not a copy of it). The third wrong one FAILS the question: red, and the explanation.
 * After the explanation, three more attempts worth nothing; a sixth wrong one marks the answer for her to COPY.
 *
 * 📌 THE EXPLANATION TURNS EVERY OPTION BACK ON. With five options, three tried leave two, and «three more attempts» could
 * never fail again: the copy of §6 would be unreachable. Six misses with an explanation between them is the child clicking at
 * random that §6 describes, and that is what this lets happen.
 */
export function attempt(state: Attempts, picked: number, correct: number, options: number): AttemptOutcome {
  if (state.off.includes(picked)) return { kind: 'refused' };
  if (picked === correct) {
    return { kind: 'right', result: state.phase === 'trying' ? resultadoDaQuestao(state.wrong + 1) : null, copied: state.phase === 'copying' };
  }
  const wrong = state.wrong + 1;
  if (wrong < ATTEMPTS) return { kind: 'wrong', next: { phase: state.phase, wrong, off: [...state.off, picked] } };
  if (state.phase === 'trying') return { kind: 'failed', next: { phase: 'explained', wrong: 0, off: [] } };
  return { kind: 'copy', next: { phase: 'copying', wrong: 0, off: Array.from({ length: options }, (_, i) => i).filter((i) => i !== correct) } };
}

/* ===================================== THE BAR ===================================== */

/** The floor of chance of this quiz's questions: five options, three attempts — 0.60 (ADR-0049 §5, `guessFloor`). */
export const QUIZ_FLOOR = guessFloor(5, ATTEMPTS);

/** A skill's reading in this sitting: its questions' results and the bar they paint. Kept in memory only (ADR-0103). */
export interface SkillReading {
  readonly history: readonly ResultadoDaQuestao[];
  readonly bar: Bar;
}

/**
 * A QUESTION'S RESULT LANDS ON ITS SKILL'S BAR: the verdict is `bandOf`'s, the projection `barOf`'s — no threshold of the
 * quiz's own. After a bar that SIGNALLED (purple up, orange down) the count starts again (`afterSignalling`).
 */
export function withResult(skill: string, reading: SkillReading | undefined, result: ResultadoDaQuestao): SkillReading {
  const history = [...(reading ? afterSignalling(reading.history, reading.bar) : []), result];
  return { history, bar: barOf(skill, history, bandOf(history, QUIZ_FLOOR)) };
}

/** She copied the answer: «the level drops immediately — the bar goes orange at once» (ADR-0049 §6), `barOf`'s own context. */
export function afterCopying(skill: string, reading: SkillReading): SkillReading {
  return { history: reading.history, bar: barOf(skill, reading.history, bandOf(reading.history, QUIZ_FLOOR), { copiouAResposta: true }) };
}
