// SPDX-License-Identifier: AGPL-3.0-or-later
// consumer-quiz/quiz-skills — THE SKILLS THE DEMO QUIZ PLAYS, as data: one BNCC skill each, three questions of five options.
//
// 📌 The quiz is a TEST BENCH (the Dev: «O quiz está ineficiente para teste»): a skill opened from the start screen by its BNCC
// code, three questions that come round again with their options rotated, and the ten-segment bar of ADR-0049 §5 filling as she
// answers. Nothing reads this file but the quiz; the gates use their own fixtures, so a skill can change here without a test
// following it.
//
// 📌 WHAT TRANSLATES AND WHAT DOES NOT («A FRONTEIRA», CLAUDE.md): the statement always translates — it is `Words`. Only the
// CONTENT of a language discipline keeps its language: `content` enters the statement through `{content}`, and a string option
// is content too, drawn with `lang` and spoken by a voice of `contentLanguage` (ADR-0243). Mathematics is not a language
// discipline: its numbers are `Words`, because «1,5» and «1.5» are how each language writes the same number.

export type Words = Readonly<{ pt: string; en: string; es: string }>;
/** Words that translate, or content in the skill's `contentLanguage` (a plain string, never translated). */
export type QuizOption = Words | string;
export interface QuizQuestion {
  /** Frame; translates. May hold `{content}`, where `content` enters untranslated. */
  readonly statement: Words;
  readonly content?: string;
  /** Five options: ADR-0049's thresholds are the five-alternative case. */
  readonly options: readonly [QuizOption, QuizOption, QuizOption, QuizOption, QuizOption];
  readonly correct: 0 | 1 | 2 | 3 | 4;
  /** After the third wrong attempt (ADR-0049 §6): explains the idea, never names the answer. */
  readonly explanation: Words;
}
export interface QuizSkill {
  /** The BNCC code the start screen shows; null where the BNCC has none. */
  readonly code: string | null;
  readonly stage: 'infantil' | 'ef5';
  /** The grade the footer shows beside the component — the BNCC codes are not all of one year. */
  readonly grade: Words;
  readonly component: Words;
  /** pt verbatim from the BNCC; en/es translations. Where `code` is null, why there is none. */
  readonly skillText: Words;
  readonly source: string;
  /** BCP-47 of the linguistic content in a language discipline; absent where everything translates. */
  readonly contentLanguage?: 'pt-BR' | 'en' | 'es';
  readonly questions: readonly [QuizQuestion, QuizQuestion, QuizQuestion];
}

/** The same word in the three languages — a number, which every language here writes alike. */
const same = (text: string): Words => ({ pt: text, en: text, es: text });

export const QUIZ_SKILLS: readonly QuizSkill[] = [
  {
    code: 'EF05MA08',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Matemática', en: 'Mathematics', es: 'Matemáticas' },
    skillText: {
      pt: 'Resolver e elaborar problemas de multiplicação e divisão envolvendo números naturais e números racionais cuja representação decimal é finita (com multiplicador natural e divisor natural e diferente de zero), utilizando estratégias diversas, como cálculo por estimativa, cálculo mental e algoritmos.',
      en: 'Solve and create multiplication and division problems involving natural numbers and rational numbers whose decimal representation is finite (with a natural multiplier and a natural, non-zero divisor), using various strategies such as estimation, mental calculation and algorithms.',
      es: 'Resolver y elaborar problemas de multiplicación y división con números naturales y números racionales cuya representación decimal es finita (con multiplicador natural y divisor natural distinto de cero), utilizando estrategias diversas, como el cálculo por estimación, el cálculo mental y los algoritmos.',
    },
    source: 'BNCC (MEC, 2018), Ensino Fundamental, Matemática, 5º ano, unidade temática Números',
    questions: [
      {
        statement: {
          pt: 'Uma caixa tem 6 pacotes com 4 lápis em cada um. Quantos lápis há na caixa?',
          en: 'A box has 6 packs with 4 pencils in each. How many pencils are in the box?',
          es: 'Una caja tiene 6 paquetes con 4 lápices en cada uno. ¿Cuántos lápices hay en la caja?',
        },
        options: [same('10'), same('24'), same('20'), same('28'), same('64')],
        correct: 1,
        explanation: {
          pt: 'Seis pacotes de 4 lápis é o mesmo que somar 4 seis vezes. Multiplique o número de pacotes pelo número de lápis de cada pacote.',
          en: 'Six packs of 4 pencils is the same as adding 4 six times. Multiply the number of packs by the number of pencils in each pack.',
          es: 'Seis paquetes de 4 lápices es lo mismo que sumar 4 seis veces. Multiplica el número de paquetes por el número de lápices de cada paquete.',
        },
      },
      {
        statement: {
          pt: 'Ana repartiu 18 figurinhas igualmente entre 3 amigos. Quantas figurinhas cada amigo recebeu?',
          en: 'Ana shared 18 stickers equally among 3 friends. How many stickers did each friend get?',
          es: 'Ana repartió 18 cromos en partes iguales entre 3 amigos. ¿Cuántos cromos recibió cada amigo?',
        },
        options: [same('15'), same('21'), same('6'), same('54'), same('9')],
        correct: 2,
        explanation: {
          pt: 'Repartir igualmente é dividir: dê uma figurinha a cada amigo, de novo e de novo, até acabarem, e conte com quantas cada um ficou.',
          en: 'Sharing equally is dividing: give one sticker to each friend, again and again until none are left, and count how many each one has.',
          es: 'Repartir en partes iguales es dividir: da un cromo a cada amigo, una y otra vez hasta que no quede ninguno, y cuenta cuántos tiene cada uno.',
        },
      },
      {
        statement: {
          pt: 'Um suco custa R$ 2,50. Quanto custam 3 sucos?',
          en: 'A juice costs R$ 2.50. How much do 3 juices cost?',
          es: 'Un jugo cuesta R$ 2,50. ¿Cuánto cuestan 3 jugos?',
        },
        options: [
          { pt: 'R$ 5,50', en: 'R$ 5.50', es: 'R$ 5,50' },
          { pt: 'R$ 6,50', en: 'R$ 6.50', es: 'R$ 6,50' },
          { pt: 'R$ 7,50', en: 'R$ 7.50', es: 'R$ 7,50' },
          { pt: 'R$ 2,53', en: 'R$ 2.53', es: 'R$ 2,53' },
          { pt: 'R$ 75,00', en: 'R$ 75.00', es: 'R$ 75,00' },
        ],
        correct: 2,
        explanation: {
          pt: 'Três sucos são o preço de um somado três vezes. Multiplique primeiro os reais por 3, depois os centavos por 3, e junte os dois.',
          en: 'Three juices cost the price of one added three times. Multiply the reais by 3 first, then the cents by 3, and put the two together.',
          es: 'Tres jugos cuestan el precio de uno sumado tres veces. Multiplica primero los reales por 3, luego los centavos por 3, y junta los dos.',
        },
      },
    ],
  },
  {
    code: 'EF06LI17',
    stage: 'ef5',
    grade: { pt: '6º ano', en: '6th grade', es: '6.º año' },
    component: { pt: 'Língua Inglesa', en: 'English', es: 'Lengua Inglesa' },
    skillText: {
      pt: 'Construir repertório lexical relativo a temas familiares (escola, família, rotina diária, atividades de lazer, esportes, entre outros).',
      en: 'Build a vocabulary related to familiar topics (school, family, daily routine, leisure activities, sports, among others).',
      es: 'Construir un repertorio léxico relativo a temas familiares (escuela, familia, rutina diaria, actividades de ocio, deportes, entre otros).',
    },
    source: 'BNCC (MEC, 2018), Ensino Fundamental, Língua Inglesa, 6º ano, eixo Conhecimentos linguísticos',
    contentLanguage: 'en',
    questions: [
      {
        statement: {
          pt: 'Qual palavra em inglês nomeia uma pessoa da família?',
          en: 'Which English word names a person in the family?',
          es: '¿Qué palabra en inglés nombra a una persona de la familia?',
        },
        options: ['pencil', 'sister', 'Monday', 'football', 'kitchen'],
        correct: 1,
        explanation: {
          pt: 'A família são as pessoas da sua casa e do seu parentesco: mãe, pai, irmãos, avós. Procure a palavra que é uma pessoa, e não um objeto, um dia, um esporte ou um lugar.',
          en: 'Your family is the people you are related to: mother, father, brothers, grandparents. Look for the word that is a person, not an object, a day, a sport or a place.',
          es: 'La familia son las personas con las que tienes parentesco: madre, padre, hermanos, abuelos. Busca la palabra que es una persona, y no un objeto, un día, un deporte o un lugar.',
        },
      },
      {
        statement: {
          pt: 'Complete a frase: «{content}»',
          en: 'Complete the sentence: «{content}»',
          es: 'Completa la frase: «{content}»',
        },
        content: 'On Saturdays I play ___ with my friends.',
        options: ['soccer', 'breakfast', 'teacher', 'homework', 'Tuesday'],
        correct: 0,
        explanation: {
          pt: 'Depois de «play» vem algo que se joga: um esporte ou um jogo. Procure a palavra que é um esporte.',
          en: 'After «play» comes something you play: a sport or a game. Look for the word that is a sport.',
          es: 'Después de «play» viene algo que se juega: un deporte o un juego. Busca la palabra que es un deporte.',
        },
      },
      {
        statement: {
          pt: 'Qual destas palavras também é da escola, como «{content}»?',
          en: 'Which of these words also belongs to school, like «{content}»?',
          es: '¿Cuál de estas palabras también es de la escuela, como «{content}»?',
        },
        content: 'teacher',
        options: ['grandmother', 'dinner', 'notebook', 'swimming', 'Sunday'],
        correct: 2,
        explanation: {
          pt: 'Pense no que você leva na mochila para a aula. Uma das palavras nomeia uma coisa da sala de aula; as outras são da família, da comida, do esporte e da semana.',
          en: 'Think of what you carry in your backpack to class. One of the words names a thing from the classroom; the others belong to family, food, sport and the week.',
          es: 'Piensa en lo que llevas en la mochila a clase. Una de las palabras nombra una cosa del aula; las otras son de la familia, la comida, el deporte y la semana.',
        },
      },
    ],
  },
];
