// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SECOND CONSUMER — pure logic (node project). ADR-0027 step 6, brought forward by the Dev on 2026-08-25.
//
// This file has a function the other tests do not: it is part of the INSTRUMENT. The consumer exists to measure the
// engine↔game boundary, and a consumer that is neither tested nor built measures nothing — it becomes a folder of good
// intentions, which is exactly what the ADR says "engine" becomes without it.
//
// The most important case here is not about any quiz: it is the one that checks this module does NOT IMPORT FROM
// `game/`. It is the experiment's whole rule, and without it the first hurry undoes it without anyone noticing.
//
// 📌 SINCE THE TEST BENCH (the Dev: «O quiz está ineficiente para teste») the quiz plays BNCC skills from `quiz-skills`; the
// cases here lend their own questions and skills (`tests/fixtures/quiz-skills.js`), never the data. The round's rules — the
// grid, the attempts, the rotation, the bar — are `quiz-round`'s, gated in `quiz-round.node.test.js`.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import ts from 'typescript';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';
import {
  questionHtml, questionView, questionNarration, narrationOnDraw, optionNarration, bootQuiz, joinParts,
  statementParts, optionFace, inLanguage, startHtml, skillLabel, skillExplanation, skillNarration,
} from '../app/js/consumer-quiz/main-quiz.js';
import { FIRST_ATTEMPT } from '../app/js/consumer-quiz/quiz-round.js';
import { QUIZ_DICTIONARIES } from '../app/js/consumer-quiz/quiz-words.js';
import { MATH, ENGLISH, INFANT, SPANISH, THREE_SKILLS } from './fixtures/quiz-skills.js';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', 'main-quiz.ts'), 'utf8');
/**
 * The root's `t` (ADR-0232 D3), played by the test: the quiz's own dictionary first, then the engine's pt dictionary READ AS A
 * FILE — importing `core/i18n` or an engine dictionary would make this the test of an ENGINE module, and the boundary gate
 * would then count the consumer's own key names as a debt (measured). A key it does not find is itself, as the engine's is.
 */
const PT = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', 'pt.ts'), 'utf8');
const translate = (key, params = {}) => {
  const found = QUIZ_DICTIONARIES.pt[key]
    ?? PT.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`))?.[1]?.replace(/\\'/g, "'");
  let text = found ?? key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
};
/** Every specifier the consumer names, read by the parser in every form. Type-only imports count. */
const SPECS = specifiersOf(FONTE, 'main-quiz.ts').map((s) => s.spec).filter(Boolean);
const ALVOS = SPECS.filter((s) => s.startsWith('.')).map((s) => posix.normalize(posix.join('consumer-quiz', s)));

describe('o consumidor obedece à própria regra', () => {
  it('[Right] NÃO importa de game/ — é a regra que faz dele um instrumento e não um jogo a mais', () => {
    expect(ALVOS.filter((a) => a.startsWith('game/'))).toEqual([]);
  });

  it('[Interface] e também não importa PIXI: quem não desenha mundo não paga 467 kB por isso', () => {
    expect(SPECS.filter((s) => s === 'pixi.js' || s.startsWith('pixi.js/') || s.startsWith('@pixi/'))).toEqual([]);
  });

  it('[Interface] a camada de a11y é alcançável sem trazer o jogo junto — pelo MOTOR que o quiz montou (ADR-0232 D4)', () => {
    expect(FONTE).not.toMatch(/from '\.\.\/core\/a11y-sr\.js'/);
    expect(FONTE).toMatch(/motor\?\.alert\(/);
    expect(FONTE).toMatch(/motor\?\.say\(/);
    expect(FONTE).toMatch(/from '\.\.\/core\/i18n\.js'/);
  });

  it('🔴 [Right] it boots only when the PAGE calls it, with the page\'s document and window — never at import (ADR-0232 D4)', () => {
    expect(FONTE, 'the module boots itself at import again').not.toMatch(/^\s*if\s*\(.*\bdocument\b.*\)\s*bootQuiz\(/m);
    expect(typeof bootQuiz, 'the page has no entry to call').toBe('function');
    // the page's document and window, the optional interpreter and skills a test lends — nothing read from a global
    expect(FONTE).toMatch(/export function bootQuiz\(\{ doc, win, interpreter, skills = QUIZ_SKILLS \}: QuizHost\): Engine/);
    const pagina = readFileSync(join(process.cwd(), 'app', 'quiz.html'), 'utf8');
    expect(pagina, 'the page does not hand the quiz its document and window')
      .toMatch(/import \{ bootQuiz \} from '\.\/js\/consumer-quiz\/main-quiz\.ts';[^]*?bootQuiz\(\{ doc: document, win: window \}\);/);
  });

  it('📌 [Right] the quiz builds no interpreter of its own and reads nothing from its address for Libras', () => {
    expect(FONTE, 'the quiz builds its own Libras player beside the engine\'s').not.toMatch(/createLibrasAvatarInterpreter/);
    const pagina = readFileSync(join(process.cwd(), 'app', 'quiz.html'), 'utf8');
    expect(pagina, 'the page reads `?libras` again').not.toMatch(/URLSearchParams\(location\.search\)\.get\('libras'\)/);
    const config = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(config, 'an old `?libras=avatar` link no longer finds the precached page offline').toMatch(/ignoreURLParametersMatching:[^\n]*\/\^libras\$\//);
  });

  it('🔴 [Right] the bar\'s verdict is the ENGINE\'s: the quiz writes no threshold of its own (ADR-0049 §5)', () => {
    // the round imports `bandOf` and `barOf`; a literal 0.8, «8 blues» or «4 in a row» here would be a second copy of the rule
    const round = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', 'quiz-round.ts'), 'utf8');
    expect(round).toMatch(/import \{[^}]*\bbandOf\b[^}]*\} from '\.\.\/educational\/adaptive-engine\.js'/);
    expect(round).toMatch(/import \{[^}]*\bbarOf\b[^}]*\} from '\.\.\/educational\/segment-bar\.js'/);
    const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const [name, src] of [['quiz-round', round], ['main-quiz', FONTE]]) {
      expect(code(src), `${name} writes a threshold of its own`).not.toMatch(/\b0\.8\b|LEVEL_UP_TARGET|MISSES_IN_A_ROW|falhasSeguidas/);
    }
  });
});

describe('the quiz\'s own sentences come from ITS dictionary, in pt, en and es (ADR-0010 pillar 3)', () => {
  const CHAVES = ['quiz.right', 'quiz.wrong', 'quiz.tried', 'quiz.option.off', 'quiz.explained', 'quiz.copy', 'quiz.copy.note',
    'quiz.copied', 'quiz.start.title', 'quiz.stage.infantil', 'quiz.stage.ef5', 'quiz.skill.explain', 'quiz.hud.skill',
    'quiz.pos.left', 'quiz.pos.right', 'quiz.name.question', 'quiz.name.questions', 'quiz.name.skill', 'quiz.notAnOption'];

  it('🔴 [Right] every key the quiz asks for resolves — in its own dictionary or the engine\'s — never shown as the key', () => {
    // The engine's gate for this (`no-key-reaches-the-child-unresolved`) leaves the proof consumer to this file: its keys live
    // in its own dictionary. PARSED, `t('…')` and `translate('…')` with a literal first argument; a built key is not claimed.
    const keys = [];
    for (const f of ['main-quiz.ts', 'quiz-round.ts']) {
      const text = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', f), 'utf8');
      const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
      (function walk(n) {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['t', 'translate'].includes(n.expression.text)
          && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) keys.push(`${f} ${n.arguments[0].text}`);
        ts.forEachChild(n, walk);
      })(sf);
    }
    expect(keys.length, 'no call found — the walk is broken, not the quiz clean').toBeGreaterThan(15);
    const declared = (k) => k in QUIZ_DICTIONARIES.pt || new RegExp(`'${k.replace(/\./g, '\\.')}':`).test(PT);
    expect(keys.filter((k) => !declared(k.split(' ')[1]))).toEqual([]);
  });

  it('🔴 [Right] no frame is a Portuguese literal in the source', () => {
    expect(FONTE).not.toMatch(/Certo!|Ainda não|Fim!|aria-label="Alternativas"|Escolha a habilidade|Copie a resposta/);
  });

  it('🔴 [Right] each frame exists in pt, en and es — and English is not Portuguese where the words differ', () => {
    for (const k of CHAVES) {
      for (const l of ['pt', 'en', 'es']) expect(QUIZ_DICTIONARIES[l][k], `${k} missing in ${l}`).toBeTruthy();
      // the explanation's frame is the same in every language: only what it carries translates
      if (k !== 'quiz.skill.explain') expect(QUIZ_DICTIONARIES.en[k], `${k}: the English is the Portuguese`).not.toBe(QUIZ_DICTIONARIES.pt[k]);
    }
  });

  it('🎯 [Right] in Portuguese the child hears these words — literals, not the dictionary read back', () => {
    expect(translate('quiz.right', { answer: '24' })).toBe('Certo! 24.');
    expect(translate('quiz.wrong', { option: '10' })).toBe('Ainda não: 10 sai da lista. Tente outra.');
    expect(translate('quiz.copy', { answer: '24' })).toBe('A resposta é 24. Copie: confirme a resposta marcada.');
    expect(questionHtml(translate, questionView(translate, MATH, MATH.questions[1], 0, FIRST_ATTEMPT, 'pt'), 0)).toContain('aria-label="Alternativas"');
  });
});

describe('words and parts — the frame translates, the content keeps its language («A FRONTEIRA», ADR-0243)', () => {
  it('🔴 [Right] the words follow the page\'s language, and an unknown one reads the Portuguese', () => {
    const w = { pt: 'Matemática', en: 'Mathematics', es: 'Matemáticas' };
    expect([inLanguage(w, 'pt'), inLanguage(w, 'en'), inLanguage(w, 'es'), inLanguage(w, 'fr')]).toEqual(['Matemática', 'Mathematics', 'Matemáticas', 'Matemática']);
  });

  it('🔴 [Right] a statement with {content}: the frame in the page\'s language around the content, which carries its language', () => {
    const q = ENGLISH.questions[0];
    expect(statementParts(q, 'es', 'en')).toEqual([
      { text: 'Completa la frase 1: «' }, { text: 'My ___ is Ana.', language: 'en' }, { text: '»' },
    ]);
    // no content, one part in the page's language
    expect(statementParts(MATH.questions[1], 'en')).toEqual([{ text: 'EF05MA08: pergunta 2? (en)' }]);
  });

  it('🔴 [Right] a string option is content, in the skill\'s language; words are the page\'s', () => {
    expect(optionFace('sister', 'pt', 'en')).toEqual({ text: 'sister', language: 'en' });
    expect(optionFace({ pt: 'Um', en: 'One', es: 'Uno' }, 'es', 'en')).toEqual({ text: 'Uno' });
  });

  it('🔴 [Right] the parts join in order into the text on screen; the voice is handed the PARTS, by one door (ADR-0243)', () => {
    expect(joinParts([{ text: 'Complete: «' }, { text: 'My ___ is Ana.', language: 'en' }, { text: '»' }])).toBe('Complete: «My ___ is Ana.»');
    // every narration of the quiz leaves by `speak`, and `speak` hands the engine the parts, not a joined text
    const narrates = FONTE.match(/tts\.narrate\(/g) ?? [];
    expect(narrates.length, 'narration leaves the quiz by more than one door').toBe(1);
    expect(FONTE).toMatch(/const speak = \(parts: readonly SpokenPart\[\]\): void => \{[^}]*tts\.narrate\(parts\)/);
  });
});

describe('the question screen — markup', () => {
  const view = (skill = MATH, at = FIRST_ATTEMPT, pass = 0, n = 1, lang = 'pt') => questionView(translate, skill, skill.questions[n], pass, at, lang);

  it('[Right] cada alternativa é um rádio com estado, não um botão mudo — cinco, a certa entre elas', () => {
    const html = questionHtml(translate, view(), 1);
    expect(html).toMatch(/role="radiogroup"/);
    expect(html.match(/role="radio"/g)).toHaveLength(5);
    expect(html).toMatch(/data-alt="1"[^>]*aria-checked="true"/);
    expect(html).toMatch(/data-alt="0"[^>]*aria-checked="false"/);
  });

  it('🔴 [Right] content carries `lang` — in the statement and on each string option (WCAG 3.1.2)', () => {
    const html = questionHtml(translate, view(ENGLISH, FIRST_ATTEMPT, 0, 0), 0);
    expect(html).toContain('<span lang="en">My ___ is Ana.</span>');
    expect(html.match(/role="radio"[^>]*lang="en"/g), 'an English option has no lang').toHaveLength(5);
    // and a skill where everything translates marks nothing
    expect(questionHtml(translate, view(), 0)).not.toMatch(/lang=/);
  });

  it('🔴 [Right] a tried option is off — `aria-disabled` — and the explanation shows under the statement', () => {
    const tried = questionHtml(translate, view(MATH, { phase: 'trying', wrong: 1, off: [3] }), 0);
    expect(tried).toMatch(/data-alt="3"[^>]*aria-disabled="true"/);
    expect(tried.match(/aria-disabled/g)).toHaveLength(1);
    expect(tried).not.toContain('quiz-note');
    const explained = questionHtml(translate, view(MATH, { phase: 'explained', wrong: 0, off: [] }), 0);
    expect(explained).toContain(`<p class="quiz-note">${MATH.questions[1].explanation.pt}</p>`);
  });

  it('🔴 [Right] the answer to copy is MARKED, and only it is on', () => {
    // the fixture's first question is right on its second option
    const v = view(MATH, { phase: 'copying', wrong: 0, off: [0, 2, 3, 4] }, 0, 0);
    const html = questionHtml(translate, v, 1);
    expect(html).toMatch(/is-answer" data-alt="1"/);
    expect(html.match(/is-answer/g)).toHaveLength(1);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(4);
    expect(html).toContain('Copie a resposta marcada: confirme-a.');
  });

  it('🔴 [Right] the options follow the pass: pass 1 shows each one place up', () => {
    const texts = (pass) => view(MATH, FIRST_ATTEMPT, pass, 1).options.map((o) => o.text);
    expect(texts(1)).toEqual([...texts(0).slice(1), texts(0)[0]]);
  });

  it('[Right] ⚠️ o CONTEÚDO DA PERGUNTA não vira marcação (issue #106)', () => {
    const FUGA = '"><i id="fugiu"></i><b>x';
    const hostile = { ...MATH.questions[0], statement: { pt: FUGA, en: FUGA, es: FUGA }, options: Array(5).fill({ pt: FUGA, en: FUGA, es: FUGA }) };
    const html = questionHtml(translate, questionView(translate, MATH, hostile, 0, FIRST_ATTEMPT, 'pt'), 0);
    expect(html, 'o conteúdo fechou um atributo e injetou um elemento').not.toContain('<i id=');
    expect(html).toContain('&lt;');
  });
});

describe('the voice of a question — the statement, then each option with its place after its name (ADR-0167)', () => {
  const v = questionView(translate, ENGLISH, ENGLISH.questions[0], 0, FIRST_ATTEMPT, 'pt');
  const ABERTA = 'Complete a frase 1: «My ___ is Ana.» sister, 1 de 5. pencil, 2 de 5. Monday, 3 de 5. kitchen, 4 de 5. rainy, 5 de 5';

  it('🔴 [Right] opening a question says the statement and then «sister, 1 de 5. pencil, 2 de 5. …», content in its own part', () => {
    const parts = questionNarration(translate, v, true);
    expect(joinParts(parts)).toBe(ABERTA);
    expect(parts.filter((p) => p.language === 'en').map((p) => p.text)).toEqual(['My ___ is Ana.', 'sister', 'pencil', 'Monday', 'kitchen', 'rainy']);
  });

  it('🔴 [Right] the WHOLE question only when it opens; a move on the same question says only the option reached', () => {
    const abre = narrationOnDraw(translate, v, 'k1', 0, '', true);
    expect(joinParts(abre.parts)).toBe(ABERTA);
    expect(abre.narrated).toBe('k1');
    expect(joinParts(narrationOnDraw(translate, v, 'k1', 1, 'k1', true).parts)).toBe('pencil, 2 de 5');
  });

  it('🔴 [Right] an option already tried says so, and the place is said only while the child keeps the index on', () => {
    const tried = questionView(translate, ENGLISH, ENGLISH.questions[0], 0, { phase: 'trying', wrong: 1, off: [1] }, 'pt');
    expect(joinParts(optionNarration(translate, tried, 1, true))).toBe('pencil, já tentada, 2 de 5');
    expect(joinParts(optionNarration(translate, tried, 0, false))).toBe('sister');
  });
});

describe('the start screen — the skills by BNCC code, grouped, explained in the footer', () => {
  it('🔴 [Right] Educação Infantil first, then Ensino Fundamental, each under its name, one button per skill', () => {
    const html = startHtml(translate, [INFANT, MATH, ENGLISH], 'pt', 1);
    const infantil = html.indexOf('Educação Infantil');
    const fundamental = html.indexOf('Ensino Fundamental');
    expect(infantil).toBeGreaterThan(-1);
    expect(fundamental).toBeGreaterThan(infantil);
    expect([...html.matchAll(/data-skill="(\d)"[^>]*>([^<]*)</g)].map((m) => `${m[1]}:${m[2]}`)).toEqual(['0:EI03EF01', '1:EF05MA08', '2:EF06LI17']);
    expect(html).toMatch(/is-on" data-skill="1"[^>]*aria-current="true"/);
    // the button's name starts with what is written on it, and adds the component (WCAG 2.5.3)
    expect(html).toContain('aria-label="EF05MA08, Matemática"');
  });

  it('🔴 [Right] a skill with no BNCC code shows its component\'s name, in the page\'s language', () => {
    expect(skillLabel(SPANISH, 'en')).toBe('Spanish');
    expect(startHtml(translate, [SPANISH], 'pt', 0)).toMatch(/aria-label="Língua Espanhola"[^>]*>Língua Espanhola</);
  });

  it('🔴 [Right] the footer\'s text is component · grade — the skill, in the page\'s language', () => {
    expect(skillExplanation(translate, MATH, 'pt')).toBe(`Matemática · 5º ano — ${MATH.skillText.pt}`);
    const en = (key, p) => QUIZ_DICTIONARIES.en[key].replace(/\{(\w+)\}/g, (_, k) => p[k]);
    expect(skillExplanation(en, MATH, 'en')).toBe(`Mathematics · 5th grade — ${MATH.skillText.en}`);
  });

  it('🔴 [Right] the voice says the code, the component and «N de M»', () => {
    const ordered = [INFANT, MATH, ENGLISH];
    expect(joinParts(skillNarration(translate, ordered, 1, 'pt', true))).toBe('EF05MA08, Matemática, 2 de 3');
    expect(joinParts(skillNarration(translate, [SPANISH], 0, 'pt', true))).toBe('Língua Espanhola, 1 de 1');
    expect(joinParts(skillNarration(translate, ordered, 1, 'pt', false))).toBe('EF05MA08, Matemática');
  });

  it('[Right] ⚠️ a skill\'s code and words do not become markup either (issue #106)', () => {
    const FUGA = '"><i id="fugiu"></i><b>x';
    const hostile = { ...MATH, code: FUGA, component: { pt: FUGA, en: FUGA, es: FUGA } };
    const html = startHtml(translate, [hostile, { ...SPANISH, component: hostile.component }], 'pt', 0);
    expect(html, 'a code or a component closed an attribute and injected an element').not.toContain('<i id=');
    expect(html).toContain('&lt;');
  });

  it('[Zero] no skills, a screen with its title and no button', () => {
    expect(startHtml(translate, [], 'pt', 0)).not.toContain('data-skill');
    expect(THREE_SKILLS.length).toBe(3);
  });
});

// The rule on which option a child said moved into the engine with the matching (ADR-0256): `tests/choosing-by-voice.node.test.js`.
// MUTATIONS CHECKED (2026-09-26, ADR-0234 phase B3): Q1 the service worker no longer ignoring `?libras` when matching —
// 🔴 «builds no interpreter of its own and reads nothing from its address».
// MUTATIONS CHECKED (2026-09-26, the test bench; tables in quiz-round.node and quiz-bench.browser): M4, M5, M6, M7, M8, M9, M10,
// M19, M26 and W1 are red HERE too, in node — the grade, the place, `lang`, the content part, `aria-disabled`, the note, the join,
// the frame and a key missing in en.
