// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO QUIZ'S SKILLS, AS THE GATES LEND THEM — never `QUIZ_SKILLS`, which a file of fifteen will replace (quiz-skills.ts).
//
// 📌 The shape is `consumer-quiz/quiz-skills.QuizSkill`. The words are the test's own, chosen for what they measure: the
// widest labels a start screen of fifteen holds (a component's name where the BNCC gives no code), a statement of two lines,
// English content in a Portuguese frame. The codes are real BNCC codes; the questions are not the BNCC's.

const w = (pt, en = `${pt} (en)`, es = `${pt} (es)`) => ({ pt, en, es });

/** Three questions of five options whose right one is `correct`, with `content` for a language discipline. */
function questions(topic, { content = false, longStatement = false } = {}) {
  return [0, 1, 2].map((n) => {
    const statement = content
      ? { pt: `Complete a frase ${n + 1}: «{content}»`, en: `Complete sentence ${n + 1}: «{content}»`, es: `Completa la frase ${n + 1}: «{content}»` }
      : w(longStatement && n === 0
        ? `${topic}: um enunciado de três linhas, que mede a caixa inteira do quiz na menor tela que a engine aceita ${n + 1}?`
        : `${topic}: pergunta ${n + 1}?`);
    return {
      statement,
      ...(content ? { content: ['My ___ is Ana.', 'I play ___ on Sundays.', 'Open your ___, please.'][n] } : {}),
      options: content
        ? [['sister', 'pencil', 'Monday', 'kitchen', 'rainy'], ['soccer', 'breakfast', 'teacher', 'homework', 'Tuesday'], ['book', 'grandmother', 'dinner', 'swimming', 'Sunday']][n]
        : ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco'].map((o) => w(`${o} ${n + 1}`)),
      correct: [1, 0, 2][n],
      // two lines at 640 px: the longest an explanation should run, since it stands between the statement and the options
      explanation: w(`${topic}: a ideia da pergunta ${n + 1}, explicada em duas linhas inteiras de texto, sem nunca dizer qual das cinco alternativas é a certa.`),
    };
  });
}

function skill(code, stage, component, extra = {}) {
  return {
    code, stage,
    grade: stage === 'infantil' ? w('4 a 5 anos', '4 to 5 years', '4 a 5 años') : w('5º ano', '5th grade', '5.º año'),
    component: typeof component === 'string' ? w(component) : component,
    // as long as the BNCC's: two lines of the footer at 640 px, where the band clamps it and the voice says it whole (ADR-0244 §3)
    skillText: w(`${code ?? component.pt ?? component}: o texto da habilidade, longo como os da BNCC, que ocupa as duas linhas do rodapé na menor tela e é dito inteiro pela voz.`),
    source: 'test fixture',
    questions: questions(code ?? String(component), extra),
    ...(extra.contentLanguage ? { contentLanguage: extra.contentLanguage } : {}),
  };
}

/** One skill where everything translates, and one language discipline — the two kinds the quiz exercises. */
export const MATH = skill('EF05MA08', 'ef5', w('Matemática', 'Mathematics', 'Matemáticas'), { longStatement: true });
export const ENGLISH = skill('EF06LI17', 'ef5', w('Língua Inglesa', 'English', 'Lengua Inglesa'), { content: true, contentLanguage: 'en' });
/** A skill of Educação Infantil, listed AFTER the fundamental ones: the start screen puts its group first anyway. */
export const INFANT = skill('EI03EF01', 'infantil', w('Escuta, fala, pensamento e imaginação', 'Listening, speaking, thought and imagination', 'Escucha, habla, pensamiento e imaginación'));
/** A component the BNCC gives no code: its name is its label. */
export const SPANISH = skill(null, 'ef5', w('Língua Espanhola', 'Spanish', 'Lengua Española'), { content: true, contentLanguage: 'es' });

export const THREE_SKILLS = [MATH, ENGLISH, INFANT];

/** FIFTEEN, as the final file will have: five of Educação Infantil and ten of the fundamental, the widest labels among them. */
export const FIFTEEN_SKILLS = [
  skill('EI03EO03', 'infantil', 'O eu, o outro e o nós'),
  skill('EI03CG02', 'infantil', 'Corpo, gestos e movimentos'),
  skill('EI03TS01', 'infantil', 'Traços, sons, cores e formas'),
  INFANT,
  skill('EI03ET04', 'infantil', 'Espaços, tempos, quantidades, relações e transformações'),
  skill('EF05LP01', 'ef5', 'Língua Portuguesa'),
  skill('EF15AR04', 'ef5', 'Arte'),
  skill('EF35EF01', 'ef5', 'Educação Física'),
  ENGLISH,
  SPANISH,
  MATH,
  skill('EF05CI01', 'ef5', 'Ciências'),
  skill('EF05GE01', 'ef5', 'Geografia'),
  skill('EF05HI01', 'ef5', 'História'),
  skill('EF05ER01', 'ef5', 'Ensino Religioso'),
];
