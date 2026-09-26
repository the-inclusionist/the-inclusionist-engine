// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY SKILL THE DEMO QUIZ PLAYS IS WELL FORMED (consumer-quiz/quiz-skills).
//
// 📌 The data will be replaced by a file of fifteen skills with the same shape; this is what that file must pass. What the type
// cannot say, and a malformed entry would cost a child:
//   · three questions of FIVE options, the right one among them — ADR-0049's thresholds are the five-alternative case, and the
//     quiz's floor is `guessFloor(5, 3)`;
//   · every word in pt, en and es — the statement ALWAYS translates («A FRONTEIRA», CLAUDE.md);
//   · `{content}` in the statement exactly when there is `content` to put there, in all three languages — a frame without it
//     drops the content, and content without the frame shows a key-like hole;
//   · a plain-string option only in a language discipline (`contentLanguage`): anywhere else a string is a word that does not
//     translate;
//   · the explanation never names the answer (ADR-0049 §6: «an EXPLANATION so she can get there»).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { QUIZ_SKILLS } from '../app/js/consumer-quiz/quiz-skills.js';

const LANGUAGES = ['pt', 'en', 'es'];
const isWords = (w) => !!w && typeof w === 'object' && LANGUAGES.every((l) => typeof w[l] === 'string');
const wordsProblems = (w, where) => (!isWords(w)
  ? [`${where}: not words in pt, en and es`]
  : LANGUAGES.filter((l) => !w[l].trim()).map((l) => `${where}: empty in ${l}`));
/** Is `phrase` inside `text` as whole words — «6» is not found inside «16», «R$ 7,50» is found in «custa R$ 7,50.». */
const namesIt = (text, phrase) => {
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped !== '' && new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
};

/** What is wrong with one skill, as sentences; empty when it is well formed. */
function skillProblems(s, i) {
  const at = `skill ${i} (${s?.code ?? 'no code'})`;
  const out = [];
  if (!(s.code === null || (typeof s.code === 'string' && s.code.trim()))) out.push(`${at}: code is neither a BNCC code nor null`);
  if (!['infantil', 'ef5'].includes(s.stage)) out.push(`${at}: stage is not infantil or ef5`);
  for (const f of ['grade', 'component', 'skillText']) out.push(...wordsProblems(s[f], `${at}.${f}`));
  if (typeof s.source !== 'string' || !s.source.trim()) out.push(`${at}: no source`);
  if (s.contentLanguage !== undefined && !['pt-BR', 'en', 'es'].includes(s.contentLanguage)) out.push(`${at}: contentLanguage is not pt-BR, en or es`);
  if (!Array.isArray(s.questions) || s.questions.length !== 3) out.push(`${at}: ${s.questions?.length ?? 0} questions, not 3`);
  (s.questions ?? []).forEach((q, n) => {
    const qat = `${at} question ${n + 1}`;
    out.push(...wordsProblems(q.statement, `${qat}.statement`), ...wordsProblems(q.explanation, `${qat}.explanation`));
    const hasContent = typeof q.content === 'string' && q.content.trim() !== '';
    if (q.content !== undefined && !hasContent) out.push(`${qat}: content is empty`);
    if (isWords(q.statement)) {
      for (const l of LANGUAGES) {
        const holes = q.statement[l].split('{content}').length - 1;
        if (hasContent && holes !== 1) out.push(`${qat}: content, and the ${l} statement has ${holes} {content}`);
        if (!hasContent && holes > 0) out.push(`${qat}: {content} in the ${l} statement with no content`);
      }
    }
    if (!Array.isArray(q.options) || q.options.length !== 5) out.push(`${qat}: ${q.options?.length ?? 0} options, not 5`);
    if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 4) out.push(`${qat}: correct ${q.correct} is not 0–4`);
    (q.options ?? []).forEach((o, k) => {
      if (typeof o === 'string') {
        if (!o.trim()) out.push(`${qat} option ${k + 1}: empty`);
        if (s.contentLanguage === undefined) out.push(`${qat} option ${k + 1}: a string option where nothing is content — it would not translate`);
      } else out.push(...wordsProblems(o, `${qat} option ${k + 1}`));
    });
    const right = q.options?.[q.correct];
    if (right !== undefined && isWords(q.explanation)) {
      for (const l of LANGUAGES) {
        const said = typeof right === 'string' ? right : right?.[l];
        if (said && namesIt(q.explanation[l], said)) out.push(`${qat}: the ${l} explanation names the answer «${said}»`);
      }
    }
  });
  return out;
}

describe('the demo quiz\'s skills are well formed', () => {
  it('🎯 [Right] there are skills, and among them one where everything translates and one language discipline', () => {
    expect(QUIZ_SKILLS.length, 'no skill — the start screen would be empty').toBeGreaterThan(0);
    // the two kinds the quiz exists to exercise (ADR-0243): without both, half of the rules below measure nothing
    expect(QUIZ_SKILLS.some((s) => s.contentLanguage === undefined), 'no skill where everything translates').toBe(true);
    expect(QUIZ_SKILLS.some((s) => s.contentLanguage !== undefined), 'no language discipline').toBe(true);
  });

  it('🔴 [Right] every skill passes: three questions of five options, every word in three languages, {content} iff content', () => {
    expect(QUIZ_SKILLS.flatMap(skillProblems)).toEqual([]);
  });

  it('🔴 [Right] the sieve refuses what it exists to refuse — each rule red on a malformed skill', () => {
    // The checker is this file's own code: a rule that could never fire would pass the data above for nothing.
    const base = QUIZ_SKILLS.find((s) => s.contentLanguage === undefined);
    const lingua = QUIZ_SKILLS.find((s) => s.contentLanguage !== undefined);
    const withQuestion = (s, n, patch) => ({ ...s, questions: s.questions.map((q, i) => (i === n ? { ...q, ...patch } : q)) });
    const cases = [
      [{ ...base, questions: base.questions.slice(0, 2) }, /2 questions, not 3/],
      [withQuestion(base, 0, { options: base.questions[0].options.slice(0, 4) }), /4 options, not 5/],
      [withQuestion(base, 0, { correct: 5 }), /correct 5 is not 0–4/],
      [{ ...base, component: { ...base.component, es: ' ' } }, /component: empty in es/],
      [withQuestion(base, 1, { options: ['a', ...base.questions[1].options.slice(1)] }), /a string option where nothing is content/],
      [withQuestion(lingua, 0, { content: 'x' }), /content, and the pt statement has 0 \{content\}/],
      [withQuestion(lingua, 1, { content: undefined }), /\{content\} in the pt statement with no content/],
      [withQuestion(base, 0, { explanation: { ...base.questions[0].explanation, en: `It is ${base.questions[0].options[base.questions[0].correct].en}.` } }), /the en explanation names the answer/],
      [{ ...base, code: '' }, /neither a BNCC code nor null/],
      [{ ...base, stage: 'ef9' }, /stage is not infantil or ef5/],
    ];
    for (const [skill, rule] of cases) expect(skillProblems(skill, 0).join('\n'), String(rule)).toMatch(rule);
    // and a null code is allowed: a component the BNCC gives no code (the start screen shows its name)
    expect(skillProblems({ ...base, code: null }, 0)).toEqual([]);
  });

  it('[Boundary] «names the answer» is whole words — «6» is not inside «16» nor «R$ 6,50» inside «R$ 16,50»', () => {
    expect(namesIt('Some 16 vezes.', '6')).toBe(false);
    expect(namesIt('Custa R$ 16,50.', 'R$ 6,50')).toBe(false);
    expect(namesIt('Custa R$ 6,50.', 'R$ 6,50')).toBe(true);
    expect(namesIt('The word is Sister.', 'sister')).toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; on the DATA, by script, each occurrence counted first, restored from a copy and checked by sha256) — 9 of 9 red:
//   S1 a question with four options          S2 `correct` out of range       S3 a component empty in es
//   S4 `{content}` gone from the es frame    S5 a string option in mathematics
//   S6 the explanation names the answer      S7 `{content}` with no content   S8 the language discipline loses `contentLanguage`
//   S9 content that is only spaces
