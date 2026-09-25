// SPDX-License-Identifier: AGPL-3.0-or-later
// consumer-quiz/quiz-words — THE WORDS THIS QUIZ DECLARES, in its own dictionary (ADR-0232 D3, erratum of 2026-09-25).
//
// The quiz hands `createGame` KEYS for the words it declares — its positions' names, its accommodations' names and its «how
// to play» texts — and these dictionaries through `CreateGameOptions.dictionaries`. The engine's translator resolves each key
// every time it draws or speaks it, so a language change reaches them all at once (ADR-0225).
//
// 📌 THEY LEFT THE ENGINE'S DICTIONARIES FOR THIS FILE: a declared word is the game's (the engine resolves a declared key only
// in the game's own dictionary), and the engine's three files are not where a game's words live.
// ⚠️ Only the DECLARED words moved. The quiz's other sentences (the questions, the answers, the listening lines) are still read
// through the handle's `t` from the engine's dictionaries — finding 2 of `main-quiz`, a separate debt.
export const QUIZ_DICTIONARIES: Readonly<Record<'pt' | 'en' | 'es', Readonly<Record<string, string>>>> = {
  pt: {
    'quiz.pos.up': 'Acima',
    'quiz.pos.down': 'Abaixo',
    'quiz.pos.confirm': 'Confirmar',
    'quiz.pos.back': 'Voltar',
    'quiz.pos.sonar': 'Sonar',
    'quiz.pos.falar': 'Dizer a resposta',
    'quiz.comoJogar.ler': 'Leia a pergunta no alto da tela.',
    'quiz.comoJogar.escolher': 'Escolha a resposta com as setas e confirme.',
    'quiz.acom.hints': 'Dicas',
    'quiz.acom.textPace': 'Ritmo do texto',
    'quiz.acom.lexicalDifficulty': 'Dificuldade das palavras',
    'quiz.acom.wordHighlight': 'Realce de palavras',
  },
  en: {
    'quiz.pos.up': 'Up',
    'quiz.pos.down': 'Down',
    'quiz.pos.confirm': 'Confirm',
    'quiz.pos.back': 'Back',
    'quiz.pos.sonar': 'Sonar',
    'quiz.pos.falar': 'Say the answer',
    'quiz.comoJogar.ler': 'Read the question at the top of the screen.',
    'quiz.comoJogar.escolher': 'Choose the answer with the arrows and confirm.',
    'quiz.acom.hints': 'Hints',
    'quiz.acom.textPace': 'Text pace',
    'quiz.acom.lexicalDifficulty': 'Word difficulty',
    'quiz.acom.wordHighlight': 'Word highlight',
  },
  es: {
    'quiz.pos.up': 'Arriba',
    'quiz.pos.down': 'Abajo',
    'quiz.pos.confirm': 'Confirmar',
    'quiz.pos.back': 'Volver',
    'quiz.pos.sonar': 'Sonar',
    'quiz.pos.falar': 'Decir la respuesta',
    'quiz.comoJogar.ler': 'Lee la pregunta arriba de la pantalla.',
    'quiz.comoJogar.escolher': 'Elige la respuesta con las flechas y confirma.',
    'quiz.acom.hints': 'Pistas',
    'quiz.acom.textPace': 'Ritmo del texto',
    'quiz.acom.lexicalDifficulty': 'Dificultad de las palabras',
    'quiz.acom.wordHighlight': 'Resaltado de palabras',
  },
};
