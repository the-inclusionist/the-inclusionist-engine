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

/*
 * THE FIFTEEN SKILLS (the Dev, 2026-09-26): the five «campos de experiência» of Educação Infantil, then the ten components in
 * the order the Dev named them. Each code and each `skillText.pt` was read in MEC's final BNCC PDF (the page is in `source`);
 * the BNCC has no Spanish skills and no English before 6th grade, which is why the Spanish entry has no code and the English
 * one is EF06LI17, at a 5th-grade difficulty (interface log, 2026-09-26).
 */
export const QUIZ_SKILLS: readonly QuizSkill[] = [
  {
    code: 'EI03EO01',
    stage: 'infantil',
    grade: { pt: 'Educação Infantil, 4 a 5 anos', en: 'Early childhood, ages 4 to 5', es: 'Educación Infantil, 4 a 5 años' },
    component: { pt: 'O eu, o outro e o nós', en: 'The self, the other and us', es: 'El yo, el otro y el nosotros' },
    skillText: {
      pt: 'Demonstrar empatia pelos outros, percebendo que as pessoas têm diferentes sentimentos, necessidades e maneiras de pensar e agir.',
      en: 'Show empathy for others, perceiving that people have different feelings, needs and ways of thinking and acting.',
      es: 'Demostrar empatía por los demás, percibiendo que las personas tienen diferentes sentimientos, necesidades y maneras de pensar y actuar.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 47',
    questions: [
      {
        statement: {
          pt: 'Dandara deixou o sorvete cair no chão e está chorando. Como Dandara se sente?',
          en: 'Dandara dropped her ice cream on the floor and is crying. How does Dandara feel?',
          es: 'A Dandara se le cayó el helado al suelo y está llorando. ¿Cómo se siente Dandara?',
        },
        options: [
          { pt: '😀 feliz', en: '😀 happy', es: '😀 feliz' },
          { pt: '😴 com sono', en: '😴 sleepy', es: '😴 con sueño' },
          { pt: '😢 triste', en: '😢 sad', es: '😢 triste' },
          { pt: '🤩 animada', en: '🤩 excited', es: '🤩 emocionada' },
          { pt: '😌 calma', en: '😌 calm', es: '😌 tranquila' },
        ],
        correct: 2,
        explanation: {
          pt: 'O choro e o rosto mostram o que a pessoa sente por dentro. Pense em como você fica quando perde algo de que gosta.',
          en: 'Crying and our face show what we feel inside. Think about how you feel when you lose something you like.',
          es: 'El llanto y la cara muestran lo que la persona siente por dentro. Piensa en cómo te sientes cuando pierdes algo que te gusta.',
        },
      },
      {
        statement: {
          pt: 'Caio ganhou um presente e está pulando e sorrindo. Como Caio se sente?',
          en: 'Caio got a present and is jumping and smiling. How does Caio feel?',
          es: 'Caio recibió un regalo y está saltando y sonriendo. ¿Cómo se siente Caio?',
        },
        options: [
          { pt: '😀 feliz', en: '😀 happy', es: '😀 feliz' },
          { pt: '😢 triste', en: '😢 sad', es: '😢 triste' },
          { pt: '😨 com medo', en: '😨 scared', es: '😨 con miedo' },
          { pt: '😠 com raiva', en: '😠 angry', es: '😠 enojado' },
          { pt: '😴 com sono', en: '😴 sleepy', es: '😴 con sueño' },
        ],
        correct: 0,
        explanation: {
          pt: 'Pular e sorrir são sinais do que a gente sente. Pense em como você fica quando ganha um presente.',
          en: 'Jumping and smiling are signs of what we feel. Think about how you feel when you get a present.',
          es: 'Saltar y sonreír son señales de lo que sentimos. Piensa en cómo te sientes cuando recibes un regalo.',
        },
      },
      {
        statement: {
          pt: 'Um cachorro chega correndo. Kauã adora cachorros, mas Iara tem medo deles. Como Iara se sente?',
          en: 'A dog comes running. Kauã loves dogs, but Iara is afraid of them. How does Iara feel?',
          es: 'Llega un perro corriendo. A Kauã le encantan los perros, pero Iara les tiene miedo. ¿Cómo se siente Iara?',
        },
        options: [
          { pt: '😀 alegre', en: '😀 cheerful', es: '😀 alegre' },
          { pt: '🤩 animada', en: '🤩 excited', es: '🤩 emocionada' },
          { pt: '😴 com sono', en: '😴 sleepy', es: '😴 con sueño' },
          { pt: '😋 com fome', en: '😋 hungry', es: '😋 con hambre' },
          { pt: '😨 com medo', en: '😨 scared', es: '😨 con miedo' },
        ],
        correct: 4,
        explanation: {
          pt: 'Cada pessoa pode sentir uma coisa diferente diante da mesma coisa. Pense no que Iara sente pelos cachorros.',
          en: 'Different people can feel different things about the same thing. Think about what Iara feels about dogs.',
          es: 'Cada persona puede sentir algo distinto ante la misma cosa. Piensa en lo que Iara siente por los perros.',
        },
      },
    ],
  },
  {
    code: 'EI03CG04',
    stage: 'infantil',
    grade: { pt: 'Educação Infantil, 4 a 5 anos', en: 'Early childhood, ages 4 to 5', es: 'Educación Infantil, 4 a 5 años' },
    component: { pt: 'Corpo, gestos e movimentos', en: 'Body, gestures and movements', es: 'Cuerpo, gestos y movimientos' },
    skillText: {
      pt: 'Adotar hábitos de autocuidado relacionados a higiene, alimentação, conforto e aparência.',
      en: 'Adopt self-care habits related to hygiene, eating, comfort and appearance.',
      es: 'Adoptar hábitos de autocuidado relacionados con la higiene, la alimentación, la comodidad y la apariencia.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 49',
    questions: [
      {
        statement: {
          pt: 'Antes de comer, o que fazemos para não levar sujeira à boca?',
          en: 'Before eating, what do we do so we don\'t put dirt in our mouth?',
          es: '¿Qué hacemos antes de comer para no llevar suciedad a la boca?',
        },
        options: [
          { pt: '🎨 pintar as mãos de tinta', en: '🎨 paint our hands', es: '🎨 pintarnos las manos' },
          { pt: '🐶 fazer carinho no cachorro', en: '🐶 pet the dog', es: '🐶 acariciar al perro' },
          { pt: '🌱 mexer na terra', en: '🌱 play in the dirt', es: '🌱 jugar con la tierra' },
          { pt: '🧼 lavar as mãos', en: '🧼 wash our hands', es: '🧼 lavarnos las manos' },
          { pt: '⚽ pegar a bola do chão', en: '⚽ pick the ball up off the ground', es: '⚽ recoger la pelota del suelo' },
        ],
        correct: 3,
        explanation: {
          pt: 'As mãos pegam sujeira e germes que a gente não vê. Pense no que tira essa sujeira antes da comida.',
          en: 'Our hands pick up dirt and germs we cannot see. Think about what gets that dirt off before we eat.',
          es: 'Las manos juntan suciedad y gérmenes que no vemos. Piensa en qué quita esa suciedad antes de comer.',
        },
      },
      {
        statement: {
          pt: 'Está muito frio lá fora. O que vestimos para sair?',
          en: 'It is very cold outside. What do we put on to go out?',
          es: 'Hace mucho frío afuera. ¿Qué nos ponemos para salir?',
        },
        options: [
          { pt: '🩳 um short', en: '🩳 shorts', es: '🩳 un short' },
          { pt: '🧥 um casaco', en: '🧥 a coat', es: '🧥 un abrigo' },
          { pt: '🩱 roupa de banho', en: '🩱 a swimsuit', es: '🩱 un traje de baño' },
          { pt: '🕶️ óculos de sol', en: '🕶️ sunglasses', es: '🕶️ lentes de sol' },
          { pt: '🩴 chinelos', en: '🩴 flip-flops', es: '🩴 chanclas' },
        ],
        correct: 1,
        explanation: {
          pt: 'No frio, o corpo precisa ficar quentinho. Escolha a roupa que cobre e esquenta o corpo.',
          en: 'When it is cold, the body needs to stay warm. Choose the clothing that covers and warms the body.',
          es: 'Con frío, el cuerpo necesita estar calentito. Elige la ropa que cubre y abriga el cuerpo.',
        },
      },
      {
        statement: {
          pt: 'Depois de comer, o que usamos para limpar os dentes?',
          en: 'After eating, what do we use to clean our teeth?',
          es: 'Después de comer, ¿qué usamos para limpiarnos los dientes?',
        },
        options: [
          { pt: '🖍️ giz de cera', en: '🖍️ a crayon', es: '🖍️ un crayón' },
          { pt: '🥄 uma colher', en: '🥄 a spoon', es: '🥄 una cuchara' },
          { pt: '🧦 uma meia', en: '🧦 a sock', es: '🧦 un calcetín' },
          { pt: '🧸 um ursinho', en: '🧸 a teddy bear', es: '🧸 un osito de peluche' },
          { pt: '🪥 escova de dentes', en: '🪥 a toothbrush', es: '🪥 un cepillo de dientes' },
        ],
        correct: 4,
        explanation: {
          pt: 'Restinhos de comida nos dentes podem causar cáries. Pense no que você usa no banheiro, de manhã e à noite.',
          en: 'Bits of food left on our teeth can cause cavities. Think about what you use in the bathroom, morning and night.',
          es: 'Los restos de comida en los dientes pueden causar caries. Piensa en lo que usas en el baño, en la mañana y en la noche.',
        },
      },
    ],
  },
  {
    code: 'EI03TS03',
    stage: 'infantil',
    grade: { pt: 'Educação Infantil, 4 a 5 anos', en: 'Early childhood, ages 4 to 5', es: 'Educación Infantil, 4 a 5 años' },
    component: { pt: 'Traços, sons, cores e formas', en: 'Traces, sounds, colors and shapes', es: 'Trazos, sonidos, colores y formas' },
    skillText: {
      pt: 'Reconhecer as qualidades do som (intensidade, duração, altura e timbre), utilizando-as em suas produções sonoras e ao ouvir músicas e sons.',
      en: 'Recognize the qualities of sound (intensity, duration, pitch and timbre), using them in their own sound productions and when listening to music and sounds.',
      es: 'Reconocer las cualidades del sonido (intensidad, duración, altura y timbre), utilizándolas en sus producciones sonoras y al escuchar músicas y sonidos.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 50',
    questions: [
      {
        statement: {
          pt: 'Qual destes faz o som mais forte?',
          en: 'Which of these makes the loudest sound?',
          es: '¿Cuál de estos hace el sonido más fuerte?',
        },
        options: [
          { pt: '🐜 uma formiga andando', en: '🐜 an ant walking', es: '🐜 una hormiga caminando' },
          { pt: '🪶 uma pena caindo', en: '🪶 a feather falling', es: '🪶 una pluma cayendo' },
          { pt: '🚒 a sirene dos bombeiros', en: '🚒 a fire truck siren', es: '🚒 la sirena de los bomberos' },
          { pt: '🤫 alguém cochichando', en: '🤫 someone whispering', es: '🤫 alguien susurrando' },
          { pt: '🐈 um gato ronronando', en: '🐈 a cat purring', es: '🐈 un gato ronroneando' },
        ],
        correct: 2,
        explanation: {
          pt: 'Som forte a gente ouve de longe; som fraco quase não se escuta. Pense em qual barulho faz a gente tapar os ouvidos.',
          en: 'A loud sound can be heard from far away; a soft one can barely be heard. Think about which noise makes us cover our ears.',
          es: 'Un sonido fuerte se oye desde lejos; uno débil casi no se escucha. Piensa en qué ruido nos hace taparnos los oídos.',
        },
      },
      {
        statement: {
          pt: 'Qual destes faz um som fino (agudo)?',
          en: 'Which of these makes a high-pitched sound?',
          es: '¿Cuál de estos hace un sonido agudo (fino)?',
        },
        options: [
          { pt: '🐤 um pintinho piando', en: '🐤 a chick peeping', es: '🐤 un pollito piando' },
          { pt: '🦁 um leão rugindo', en: '🦁 a lion roaring', es: '🦁 un león rugiendo' },
          { pt: '🐄 uma vaca mugindo', en: '🐄 a cow mooing', es: '🐄 una vaca mugiendo' },
          { pt: '🐻 um urso rosnando', en: '🐻 a bear growling', es: '🐻 un oso gruñendo' },
          { pt: '⛈️ um trovão roncando', en: '⛈️ thunder rumbling', es: '⛈️ un trueno retumbando' },
        ],
        correct: 0,
        explanation: {
          pt: 'Som fino (agudo) parece um apito; som grosso (grave) parece um ronco. Tente imitar cada um com a sua voz.',
          en: 'A high-pitched sound is like a whistle; a low-pitched sound is like a rumble. Try copying each one with your voice.',
          es: 'Un sonido agudo se parece a un silbato; uno grave se parece a un ronquido. Intenta imitar cada uno con tu voz.',
        },
      },
      {
        statement: {
          pt: 'Tum, tum, tum! Qual instrumento faz esse som?',
          en: 'Boom, boom, boom! Which instrument makes this sound?',
          es: '¡Pum, pum, pum! ¿Qué instrumento hace este sonido?',
        },
        options: [
          { pt: '🔔 o sino', en: '🔔 the bell', es: '🔔 la campana' },
          { pt: '🎺 o trompete', en: '🎺 the trumpet', es: '🎺 la trompeta' },
          { pt: '🪇 o chocalho', en: '🪇 the maracas', es: '🪇 las maracas' },
          { pt: '🪈 a flauta', en: '🪈 the flute', es: '🪈 la flauta' },
          { pt: '🥁 o tambor', en: '🥁 the drum', es: '🥁 el tambor' },
        ],
        correct: 4,
        explanation: {
          pt: 'Cada instrumento tem sua própria voz: uns a gente sopra, outros sacode, outros bate. Imagine o som de cada um.',
          en: 'Each instrument has its own voice: some we blow, some we shake, some we hit. Imagine the sound of each one.',
          es: 'Cada instrumento tiene su propia voz: unos se soplan, otros se sacuden, otros se golpean. Imagina el sonido de cada uno.',
        },
      },
    ],
  },
  {
    code: 'EI03EF02',
    stage: 'infantil',
    grade: { pt: 'Educação Infantil, 4 a 5 anos', en: 'Early childhood, ages 4 to 5', es: 'Educación Infantil, 4 a 5 años' },
    component: { pt: 'Escuta, fala, pensamento e imaginação', en: 'Listening, speaking, thinking and imagination', es: 'Escucha, habla, pensamiento e imaginación' },
    skillText: {
      pt: 'Inventar brincadeiras cantadas, poemas e canções, criando rimas, aliterações e ritmos.',
      en: 'Invent sung games, poems and songs, creating rhymes, alliterations and rhythms.',
      es: 'Inventar juegos cantados, poemas y canciones, creando rimas, aliteraciones y ritmos.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 51',
    contentLanguage: 'pt-BR',
    questions: [
      {
        statement: {
          pt: 'Qual palavra rima com {content}?',
          en: 'Which word rhymes with {content}?',
          es: '¿Qué palabra rima con {content}?',
        },
        content: 'gato',
        options: [
          '⚽ bola',
          '☀️ sol',
          '🌙 lua',
          '🦆 pato',
          '🍌 banana',
        ],
        correct: 3,
        explanation: {
          pt: 'Palavras que rimam terminam com o mesmo som. Diga «gato» devagar e escute o fim da palavra.',
          en: 'Words that rhyme end with the same sound. Say «gato» slowly and listen to how it ends.',
          es: 'Las palabras que riman terminan con el mismo sonido. Di «gato» despacio y escucha cómo termina.',
        },
      },
      {
        statement: {
          pt: 'Qual palavra rima com {content}?',
          en: 'Which word rhymes with {content}?',
          es: '¿Qué palabra rima con {content}?',
        },
        content: 'mão',
        options: [
          '🦶 pé',
          '🍞 pão',
          '🐟 peixe',
          '🌳 árvore',
          '🚗 carro',
        ],
        correct: 1,
        explanation: {
          pt: 'Palavras que rimam terminam com o mesmo som. Diga «mão» devagar e escute o fim da palavra.',
          en: 'Words that rhyme end with the same sound. Say «mão» slowly and listen to how it ends.',
          es: 'Las palabras que riman terminan con el mismo sonido. Di «mão» despacio y escucha cómo termina.',
        },
      },
      {
        statement: {
          pt: 'Qual palavra rima com {content}?',
          en: 'Which word rhymes with {content}?',
          es: '¿Qué palabra rima con {content}?',
        },
        content: 'janela',
        options: [
          '🐴 cavalo',
          '👟 sapato',
          '🐸 sapo',
          '🍍 abacaxi',
          '🍲 panela',
        ],
        correct: 4,
        explanation: {
          pt: 'Palavras que rimam terminam com o mesmo som. Diga «janela» devagar e escute o fim da palavra.',
          en: 'Words that rhyme end with the same sound. Say «janela» slowly and listen to how it ends.',
          es: 'Las palabras que riman terminan con el mismo sonido. Di «janela» despacio y escucha cómo termina.',
        },
      },
    ],
  },
  {
    code: 'EI03ET07',
    stage: 'infantil',
    grade: { pt: 'Educação Infantil, 4 a 5 anos', en: 'Early childhood, ages 4 to 5', es: 'Educación Infantil, 4 a 5 años' },
    component: { pt: 'Espaços, tempos, quantidades, relações e transformações', en: 'Spaces, times, quantities, relations and transformations', es: 'Espacios, tiempos, cantidades, relaciones y transformaciones' },
    skillText: {
      pt: 'Relacionar números às suas respectivas quantidades e identificar o antes, o depois e o entre em uma sequência.',
      en: 'Relate numbers to their respective quantities and identify the before, the after and the between in a sequence.',
      es: 'Relacionar los números con sus respectivas cantidades e identificar el antes, el después y el entre en una secuencia.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 54',
    questions: [
      {
        statement: {
          pt: 'Quantas maçãs tem aqui? 🍎🍎🍎🍎',
          en: 'How many apples are here? 🍎🍎🍎🍎',
          es: '¿Cuántas manzanas hay aquí? 🍎🍎🍎🍎',
        },
        options: [
          { pt: '1', en: '1', es: '1' },
          { pt: '2', en: '2', es: '2' },
          { pt: '3', en: '3', es: '3' },
          { pt: '4', en: '4', es: '4' },
          { pt: '5', en: '5', es: '5' },
        ],
        correct: 3,
        explanation: {
          pt: 'Conte as maçãs uma por uma, apontando com o dedo. O último número que você disser é o total.',
          en: 'Count the apples one by one, pointing with your finger. The last number you say is the total.',
          es: 'Cuenta las manzanas una por una, señalando con el dedo. El último número que digas es el total.',
        },
      },
      {
        statement: {
          pt: 'Que número vem logo antes do 3?',
          en: 'Which number comes just before 3?',
          es: '¿Qué número va justo antes del 3?',
        },
        options: [
          { pt: '2', en: '2', es: '2' },
          { pt: '3', en: '3', es: '3' },
          { pt: '4', en: '4', es: '4' },
          { pt: '5', en: '5', es: '5' },
          { pt: '6', en: '6', es: '6' },
        ],
        correct: 0,
        explanation: {
          pt: 'Conte desde o 1 bem devagar e pare quando chegar ao 3. Lembre qual número você disse logo antes.',
          en: 'Count slowly from 1 and stop when you reach 3. Remember which number you said just before it.',
          es: 'Cuenta despacio desde el 1 y detente al llegar al 3. Recuerda qué número dijiste justo antes.',
        },
      },
      {
        statement: {
          pt: 'Que número fica entre o 8 e o 10?',
          en: 'Which number is between 8 and 10?',
          es: '¿Qué número está entre el 8 y el 10?',
        },
        options: [
          { pt: '5', en: '5', es: '5' },
          { pt: '6', en: '6', es: '6' },
          { pt: '7', en: '7', es: '7' },
          { pt: '8', en: '8', es: '8' },
          { pt: '9', en: '9', es: '9' },
        ],
        correct: 4,
        explanation: {
          pt: 'Conte do 8 até o 10 bem devagar. O número que você fala no meio fica entre os dois.',
          en: 'Count slowly from 8 to 10. The number you say in the middle is between the two.',
          es: 'Cuenta despacio del 8 al 10. El número que dices en medio está entre los dos.',
        },
      },
    ],
  },
  {
    code: 'EF05LP05',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Língua Portuguesa', en: 'Portuguese Language', es: 'Lengua Portuguesa' },
    skillText: {
      pt: 'Identificar a expressão de presente, passado e futuro em tempos verbais do modo indicativo.',
      en: 'Identify the expression of present, past and future in verb tenses of the indicative mood.',
      es: 'Identificar la expresión de presente, pasado y futuro en tiempos verbales del modo indicativo.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 119',
    contentLanguage: 'pt-BR',
    questions: [
      {
        statement: {
          pt: 'Em qual destas frases em português o verbo está no futuro?',
          en: 'Which Portuguese sentence has a verb in the future tense?',
          es: '¿Qué oración en portugués tiene el verbo en futuro?',
        },
        options: [
          'Dandara canta na escola.',
          'Os meninos jogaram bola.',
          'Eu li um livro novo.',
          'Nós visitaremos a vovó.',
          'O gato dorme no sofá.',
        ],
        correct: 3,
        explanation: {
          pt: 'O futuro fala do que ainda vai acontecer. Em português, ele costuma terminar em -rei, -rá, -remos ou -rão.',
          en: 'The future tense tells about something that has not happened yet. In Portuguese, it often ends in -rei, -rá, -remos or -rão.',
          es: 'El futuro habla de lo que todavía va a pasar. En portugués, suele terminar en -rei, -rá, -remos o -rão.',
        },
      },
      {
        statement: {
          pt: 'Em qual destas frases em português o verbo está no passado?',
          en: 'Which Portuguese sentence has a verb in the past tense?',
          es: '¿Qué oración en portugués tiene el verbo en pasado?',
        },
        options: [
          'Kauê plantou uma árvore.',
          'Kauê plantará uma flor.',
          'A professora explica a lição.',
          'A chuva cairá à noite.',
          'Eu moro perto do rio.',
        ],
        correct: 0,
        explanation: {
          pt: 'O passado conta uma ação que já terminou. Muitos verbos no passado terminam em -ou, -eu ou -iu.',
          en: 'The past tense tells about an action that is already over. In Portuguese, many past-tense verbs end in -ou, -eu or -iu.',
          es: 'El pasado cuenta una acción que ya terminó. En portugués, muchos verbos en pasado terminan en -ou, -eu o -iu.',
        },
      },
      {
        statement: {
          pt: 'Em qual destas frases em português o verbo está no presente?',
          en: 'Which Portuguese sentence has a verb in the present tense?',
          es: '¿Qué oración en portugués tiene el verbo en presente?',
        },
        options: [
          'Iara desenhou um peixe.',
          'Iara desenhará um peixe.',
          'Iara desenha um peixe.',
          'Os pássaros voaram alto.',
          'O ônibus chegará cedo.',
        ],
        correct: 2,
        explanation: {
          pt: 'O presente fala do que acontece agora ou costuma acontecer; descarte o que já passou e o que ainda virá.',
          en: 'The present tells what happens now or usually happens; rule out what is over and what is still to come.',
          es: 'El presente habla de lo que pasa ahora o suele pasar; descarta lo que ya pasó y lo que todavía vendrá.',
        },
      },
    ],
  },
  {
    code: 'EF15AR02',
    stage: 'ef5',
    grade: { pt: '1º ao 5º ano', en: '1st to 5th grade', es: '1.º a 5.º año' },
    component: { pt: 'Arte', en: 'Art', es: 'Arte' },
    skillText: {
      pt: 'Explorar e reconhecer elementos constitutivos das artes visuais (ponto, linha, forma, cor, espaço, movimento etc.).',
      en: 'Explore and recognize the constituent elements of the visual arts (point, line, shape, color, space, movement, etc.).',
      es: 'Explorar y reconocer elementos constitutivos de las artes visuales (punto, línea, forma, color, espacio, movimiento, etc.).',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 203',
    questions: [
      {
        statement: {
          pt: 'Na mistura de tintas, quais são as três cores primárias?',
          en: 'When mixing paints, which are the three primary colors?',
          es: 'Al mezclar pinturas, ¿cuáles son los tres colores primarios?',
        },
        options: [
          { pt: 'Verde, laranja e roxo', en: 'Green, orange and purple', es: 'Verde, naranja y morado' },
          { pt: 'Vermelho, amarelo e azul', en: 'Red, yellow and blue', es: 'Rojo, amarillo y azul' },
          { pt: 'Preto, branco e cinza', en: 'Black, white and gray', es: 'Negro, blanco y gris' },
          { pt: 'Rosa, marrom e verde', en: 'Pink, brown and green', es: 'Rosa, marrón y verde' },
          { pt: 'Azul, verde e roxo', en: 'Blue, green and purple', es: 'Azul, verde y morado' },
        ],
        correct: 1,
        explanation: {
          pt: 'Cores primárias são as que não conseguimos fazer misturando outras tintas. Misturando só elas, fazemos muitas outras cores.',
          en: 'Primary colors are the ones we cannot make by mixing other paints. By mixing only them, we can make many other colors.',
          es: 'Los colores primarios no se obtienen mezclando otras pinturas; mezclando solo ellos, se obtienen muchos otros.',
        },
      },
      {
        statement: {
          pt: 'Se misturarmos tinta azul com tinta amarela, que cor vamos obter?',
          en: 'If we mix blue paint with yellow paint, what color do we get?',
          es: 'Si mezclamos pintura azul con pintura amarilla, ¿qué color obtenemos?',
        },
        options: [
          { pt: 'Laranja', en: 'Orange', es: 'Naranja' },
          { pt: 'Roxo', en: 'Purple', es: 'Morado' },
          { pt: 'Rosa', en: 'Pink', es: 'Rosa' },
          { pt: 'Vermelho', en: 'Red', es: 'Rojo' },
          { pt: 'Verde', en: 'Green', es: 'Verde' },
        ],
        correct: 4,
        explanation: {
          pt: 'Duas cores primárias misturadas formam uma cor secundária. Se puder, teste com lápis de cor, pintando uma cor por cima da outra.',
          en: 'Two primary colors mixed together make a secondary color. If you can, test it with colored pencils, coloring one on top of the other.',
          es: 'Dos colores primarios mezclados forman un color secundario. Si puedes, pruébalo con lápices de colores, pintando uno encima del otro.',
        },
      },
      {
        statement: {
          pt: 'Se você encosta a ponta do lápis no papel e tira logo, que elemento visual faz?',
          en: 'If you touch the paper with a pencil tip and lift it right away, which visual element do you make?',
          es: 'Si tocas el papel con la punta del lápiz y lo levantas enseguida, ¿qué elemento visual haces?',
        },
        options: [
          { pt: 'Ponto', en: 'Point', es: 'Punto' },
          { pt: 'Linha', en: 'Line', es: 'Línea' },
          { pt: 'Forma', en: 'Shape', es: 'Forma' },
          { pt: 'Movimento', en: 'Movement', es: 'Movimiento' },
          { pt: 'Espaço', en: 'Space', es: 'Espacio' },
        ],
        correct: 0,
        explanation: {
          pt: 'É a marca mais simples e menor do desenho, quase sem tamanho. Se o lápis se arrastasse pelo papel, surgiria outro elemento.',
          en: 'It is the simplest and smallest mark in a drawing, with almost no size. If the pencil slid across the paper, a different element would appear.',
          es: 'Es la marca más simple y pequeña del dibujo, casi sin tamaño. Si el lápiz se deslizara por el papel, aparecería otro elemento.',
        },
      },
    ],
  },
  {
    code: 'EF35EF05',
    stage: 'ef5',
    grade: { pt: '3º ao 5º ano', en: '3rd to 5th grade', es: '3.º a 5.º año' },
    component: { pt: 'Educação Física', en: 'Physical Education', es: 'Educación Física' },
    skillText: {
      pt: 'Experimentar e fruir diversos tipos de esportes de campo e taco, rede/parede e invasão, identificando seus elementos comuns e criando estratégias individuais e coletivas básicas para sua execução, prezando pelo trabalho coletivo e pelo protagonismo.',
      en: 'Experience and enjoy various types of field and bat, net/wall and invasion sports, identifying their common elements and creating basic individual and collective strategies for playing them, valuing teamwork and protagonism.',
      es: 'Experimentar y disfrutar diversos tipos de deportes de campo y bate, de red/pared y de invasión, identificando sus elementos comunes y creando estrategias individuales y colectivas básicas para su ejecución, valorando el trabajo colectivo y el protagonismo.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 231',
    questions: [
      {
        statement: {
          pt: 'Vôlei e tênis são esportes de qual tipo?',
          en: 'What type of sport are volleyball and tennis?',
          es: '¿Qué tipo de deporte son el vóleibol y el tenis?',
        },
        options: [
          { pt: 'Invasão', en: 'Invasion', es: 'Invasión' },
          { pt: 'Campo e taco', en: 'Field and bat', es: 'Campo y bate' },
          { pt: 'Rede/parede', en: 'Net/wall', es: 'Red/pared' },
          { pt: 'Precisão', en: 'Precision', es: 'Precisión' },
          { pt: 'Combate', en: 'Combat', es: 'Combate' },
        ],
        correct: 2,
        explanation: {
          pt: 'Pense em como se joga: cada lado fica no seu espaço e manda a bola por cima de uma divisória, sem invadir o lado do outro.',
          en: 'Think about how they are played: each side stays in its own space and sends the ball over a divider, without entering the other side.',
          es: 'Piensa en cómo se juegan: cada lado se queda en su espacio y manda la pelota por encima de una división, sin entrar en el lado del otro.',
        },
      },
      {
        statement: {
          pt: 'Qual destes esportes é de invasão?',
          en: 'Which of these sports is an invasion sport?',
          es: '¿Cuál de estos deportes es de invasión?',
        },
        options: [
          { pt: 'Vôlei', en: 'Volleyball', es: 'Vóleibol' },
          { pt: 'Tênis', en: 'Tennis', es: 'Tenis' },
          { pt: 'Beisebol', en: 'Baseball', es: 'Béisbol' },
          { pt: 'Basquete', en: 'Basketball', es: 'Básquetbol' },
          { pt: 'Badminton', en: 'Badminton', es: 'Bádminton' },
        ],
        correct: 3,
        explanation: {
          pt: 'Nos esportes de invasão, as duas equipes dividem o mesmo espaço e tentam entrar na área do adversário para marcar ponto.',
          en: 'In invasion sports, both teams share the same space and try to get into the other team\'s area to score.',
          es: 'En los deportes de invasión, los dos equipos comparten el mismo espacio e intentan entrar en el área del rival para anotar.',
        },
      },
      {
        statement: {
          pt: 'Em qual tipo de esporte um time rebate a bola com um taco e corre entre as bases?',
          en: 'In which type of sport does a team hit the ball with a bat and run between the bases?',
          es: '¿En qué tipo de deporte un equipo golpea la pelota con un bate y corre entre las bases?',
        },
        options: [
          { pt: 'Campo e taco', en: 'Field and bat', es: 'Campo y bate' },
          { pt: 'Invasão', en: 'Invasion', es: 'Invasión' },
          { pt: 'Rede/parede', en: 'Net/wall', es: 'Red/pared' },
          { pt: 'Precisão', en: 'Precision', es: 'Precisión' },
          { pt: 'Combate', en: 'Combat', es: 'Combate' },
        ],
        correct: 0,
        explanation: {
          pt: 'Nesses jogos, um time rebate a bola e corre para pontuar, enquanto o outro se espalha pelo terreno para pegá-la.',
          en: 'In these games, one team hits the ball and runs to score, while the other team spreads out over the field to catch it.',
          es: 'En estos juegos, un equipo golpea la pelota y corre para anotar, mientras el otro se reparte por el terreno para atraparla.',
        },
      },
    ],
  },
  {
    code: 'EF06LI17',
    stage: 'ef5',
    grade: { pt: '6º ano', en: '6th grade', es: '6.º año' },
    component: { pt: 'Língua Inglesa', en: 'English Language', es: 'Lengua Inglesa' },
    skillText: {
      pt: 'Construir repertório lexical relativo a temas familiares (escola, família, rotina diária, atividades de lazer, esportes, entre outros).',
      en: 'Build a lexical repertoire related to familiar topics (school, family, daily routine, leisure activities, sports, among others).',
      es: 'Construir un repertorio léxico relativo a temas familiares (escuela, familia, rutina diaria, actividades de ocio, deportes, entre otros).',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 253',
    contentLanguage: 'en',
    questions: [
      {
        statement: {
          pt: 'Qual destas palavras em inglês nomeia um objeto da escola?',
          en: 'Which of these English words names a school object?',
          es: '¿Cuál de estas palabras en inglés nombra un objeto de la escuela?',
        },
        options: [
          'grandmother',
          'pencil',
          'breakfast',
          'river',
          'sleep',
        ],
        correct: 1,
        explanation: {
          pt: 'Objetos escolares são coisas que usamos para estudar, como as que levamos na mochila. Leia cada palavra e pense no que ela significa.',
          en: 'School objects are things we use to study, like the ones we carry in a backpack. Read each word and think about what it means.',
          es: 'Los objetos escolares son cosas que usamos para estudiar, como las que llevamos en la mochila. Lee cada palabra y piensa qué significa.',
        },
      },
      {
        statement: {
          pt: 'Qual destas palavras em inglês nomeia uma pessoa da família?',
          en: 'Which of these English words names a family member?',
          es: '¿Cuál de estas palabras en inglés nombra a un miembro de la familia?',
        },
        options: [
          'notebook',
          'lunch',
          'desk',
          'brother',
          'wake up',
        ],
        correct: 3,
        explanation: {
          pt: 'Da família são as pessoas com quem temos parentesco, como mãe, avô ou prima. Procure a palavra que nomeia uma pessoa, não um objeto nem uma ação.',
          en: 'Family members are the people we are related to, like a mother, a grandfather or a cousin. Look for the word that names a person, not an object or an action.',
          es: 'La familia son las personas con quienes tenemos parentesco, como la madre, el abuelo o la prima. Busca la palabra que nombra a una persona, no un objeto ni una acción.',
        },
      },
      {
        statement: {
          pt: 'Qual destas expressões em inglês é uma ação da rotina diária?',
          en: 'Which of these English phrases is a daily routine action?',
          es: '¿Cuál de estas expresiones en inglés es una acción de la rutina diaria?',
        },
        options: [
          'brush your teeth',
          'uncle',
          'ruler',
          'classroom',
          'cousin',
        ],
        correct: 0,
        explanation: {
          pt: 'Uma ação da rotina é algo que fazemos quase todo dia, como tomar banho ou comer. Procure a expressão que indica uma ação, não uma pessoa, um objeto ou um lugar.',
          en: 'A routine action is something we do almost every day, like taking a shower or eating. Look for the phrase that shows an action, not a person, an object or a place.',
          es: 'Una acción de la rutina es algo que hacemos casi todos los días, como bañarnos o comer. Busca la expresión que indica una acción, no una persona, un objeto o un lugar.',
        },
      },
    ],
  },
  {
    code: null,
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Língua Espanhola', en: 'Spanish Language', es: 'Lengua Española' },
    skillText: {
      pt: 'A BNCC não tem habilidades de língua espanhola: a Lei 13.415/2017 revogou a oferta obrigatória do espanhol. Estas perguntas usam vocabulário de temas familiares, no nível do 5º ano.',
      en: 'The BNCC has no Spanish-language skills: Law 13,415/2017 revoked the mandatory offer of Spanish. These questions use vocabulary from familiar topics, at the 5th-grade level.',
      es: 'La BNCC no tiene habilidades de lengua española: la Ley 13.415/2017 revocó la oferta obligatoria del español. Estas preguntas usan vocabulario de temas familiares, en el nivel de 5.º año.',
    },
    source: 'Lei nº 13.415/2017, art. 22 (revoga a Lei nº 11.161/2005)',
    contentLanguage: 'es',
    questions: [
      {
        statement: {
          pt: 'Qual destas palavras em espanhol nomeia um objeto da escola?',
          en: 'Which of these Spanish words names a school object?',
          es: '¿Cuál de estas palabras en español nombra un objeto de la escuela?',
        },
        options: [
          'abuela',
          'desayuno',
          'regla',
          'perro',
          'dormir',
        ],
        correct: 2,
        explanation: {
          pt: 'Objetos escolares são coisas que usamos para estudar ou desenhar na sala de aula. Leia cada palavra e pense no que ela significa.',
          en: 'School objects are things we use to study or draw in the classroom. Read each word and think about what it means.',
          es: 'Los objetos escolares son cosas que usamos para estudiar o dibujar en el salón de clases. Lee cada palabra y piensa qué significa.',
        },
      },
      {
        statement: {
          pt: 'Qual destas palavras em espanhol nomeia uma pessoa da família?',
          en: 'Which of these Spanish words names a family member?',
          es: '¿Cuál de estas palabras en español nombra a un miembro de la familia?',
        },
        options: [
          'hermano',
          'cuaderno',
          'almuerzo',
          'silla',
          'despertarse',
        ],
        correct: 0,
        explanation: {
          pt: 'Da família são as pessoas com quem temos parentesco, como pai, avó ou tio. Procure a palavra que nomeia uma pessoa, não um objeto nem uma ação.',
          en: 'Family members are the people we are related to, like a father, a grandmother or an uncle. Look for the word that names a person, not an object or an action.',
          es: 'La familia son las personas con quienes tenemos parentesco, como el padre, la abuela o el tío. Busca la palabra que nombra a una persona, no un objeto ni una acción.',
        },
      },
      {
        statement: {
          pt: 'Qual destas expressões em espanhol é uma ação da rotina diária?',
          en: 'Which of these Spanish phrases is a daily routine action?',
          es: '¿Cuál de estas expresiones en español es una acción de la rutina diaria?',
        },
        options: [
          'tía',
          'pizarra',
          'abuelo',
          'escritorio',
          'cepillarse los dientes',
        ],
        correct: 4,
        explanation: {
          pt: 'Uma ação da rotina é algo que fazemos quase todo dia, como comer. Procure uma ação, não uma pessoa nem um objeto.',
          en: 'A routine action is something we do almost every day, like eating. Look for an action, not a person or an object.',
          es: 'Una acción de rutina es algo que hacemos casi a diario, como comer. Busca una acción, no una persona ni un objeto.',
        },
      },
    ],
  },
  {
    code: 'EF05MA08',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Matemática', en: 'Mathematics', es: 'Matemáticas' },
    skillText: {
      pt: 'Resolver e elaborar problemas de multiplicação e divisão com números naturais e com números racionais cuja representação decimal é finita (com multiplicador natural e divisor natural e diferente de zero), utilizando estratégias diversas, como cálculo por estimativa, cálculo mental e algoritmos.',
      en: 'Solve and create multiplication and division problems with natural numbers and with rational numbers whose decimal representation is finite (with a natural multiplier and a natural, non-zero divisor), using various strategies, such as estimation, mental calculation and algorithms.',
      es: 'Resolver y elaborar problemas de multiplicación y división con números naturales y con números racionales cuya representación decimal es finita (con multiplicador natural y divisor natural y distinto de cero), utilizando estrategias diversas, como cálculo por estimación, cálculo mental y algoritmos.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 297',
    questions: [
      {
        statement: {
          pt: 'A escola comprou 24 caixas de lápis, com 15 lápis em cada caixa. Quantos lápis foram comprados?',
          en: 'The school bought 24 boxes of pencils, with 15 pencils in each box. How many pencils did it buy?',
          es: 'La escuela compró 24 cajas de lápices, con 15 lápices en cada caja. ¿Cuántos lápices compró?',
        },
        options: [
          { pt: '39', en: '39', es: '39' },
          { pt: '240', en: '240', es: '240' },
          { pt: '300', en: '300', es: '300' },
          { pt: '360', en: '360', es: '360' },
          { pt: '345', en: '345', es: '345' },
        ],
        correct: 3,
        explanation: {
          pt: 'Caixas iguais pedem multiplicação: número de caixas × lápis em cada caixa. Dica: calcule 24 × 10 e 24 × 5, e depois some.',
          en: 'Equal boxes call for multiplication: number of boxes × pencils in each box. Tip: work out 24 × 10 and 24 × 5, then add them.',
          es: 'Cajas iguales piden una multiplicación: número de cajas × lápices en cada caja. Pista: calcula 24 × 10 y 24 × 5, y luego súmalos.',
        },
      },
      {
        statement: {
          pt: 'Dona Benedita dividiu 132 figurinhas igualmente entre 6 netos. Quantas figurinhas cada neto ganhou?',
          en: 'Grandma Benedita shared 132 stickers equally among her 6 grandchildren. How many did each one get?',
          es: 'Doña Benedita repartió 132 figuritas en partes iguales entre sus 6 nietos. ¿Cuántas recibió cada uno?',
        },
        options: [
          { pt: '126', en: '126', es: '126' },
          { pt: '22', en: '22', es: '22' },
          { pt: '20', en: '20', es: '20' },
          { pt: '792', en: '792', es: '792' },
          { pt: '138', en: '138', es: '138' },
        ],
        correct: 1,
        explanation: {
          pt: 'Repartir igualmente é dividir: 132 ÷ 6. Dica: comece por 120 ÷ 6 e depois divida o que sobrou.',
          en: 'Sharing equally means dividing: 132 ÷ 6. Tip: start with 120 ÷ 6, then divide what is left over.',
          es: 'Repartir en partes iguales es dividir: 132 ÷ 6. Pista: empieza por 120 ÷ 6 y luego divide lo que sobra.',
        },
      },
      {
        statement: {
          pt: 'Luana comprou 3 cadernos que custam 4,50 reais cada um. Quanto ela gastou?',
          en: 'Luana bought 3 notebooks that cost 4.50 reais each. How much did she spend?',
          es: 'Luana compró 3 cuadernos que cuestan 4,50 reales cada uno. ¿Cuánto gastó?',
        },
        options: [
          { pt: '12,50 reais', en: '12.50 reais', es: '12,50 reales' },
          { pt: '7,50 reais', en: '7.50 reais', es: '7,50 reales' },
          { pt: '1,50 reais', en: '1.50 reais', es: '1,50 reales' },
          { pt: '135,00 reais', en: '135.00 reais', es: '135,00 reales' },
          { pt: '13,50 reais', en: '13.50 reais', es: '13,50 reales' },
        ],
        correct: 4,
        explanation: {
          pt: 'Três cadernos de mesmo preço: multiplique o preço por 3. Dica: faça 4 reais × 3 e 50 centavos × 3, e depois some.',
          en: 'Three notebooks at the same price: multiply the price by 3. Tip: do 4 reais × 3 and 50 cents × 3, then add them.',
          es: 'Tres cuadernos del mismo precio: multiplica el precio por 3. Pista: haz 4 reales × 3 y 50 centavos × 3, y luego súmalos.',
        },
      },
    ],
  },
  {
    code: 'EF05CI11',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Ciências', en: 'Science', es: 'Ciencias' },
    skillText: {
      pt: 'Associar o movimento diário do Sol e das demais estrelas no céu ao movimento de rotação da Terra.',
      en: 'Associate the daily movement of the Sun and the other stars in the sky with the Earth\'s rotation.',
      es: 'Asociar el movimiento diario del Sol y de las demás estrellas en el cielo con el movimiento de rotación de la Tierra.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 343',
    questions: [
      {
        statement: {
          pt: 'Por que o Sol e as estrelas parecem cruzar o céu todo dia?',
          en: 'Why do the Sun and stars seem to cross the sky each day?',
          es: '¿Por qué el Sol y las estrellas parecen cruzar el cielo a diario?',
        },
        options: [
          { pt: 'A Terra gira sobre si mesma', en: 'The Earth spins on itself', es: 'La Tierra gira sobre sí misma' },
          { pt: 'O Sol gira em volta da Terra', en: 'The Sun circles the Earth', es: 'El Sol rodea la Tierra' },
          { pt: 'O vento empurra o Sol', en: 'The wind pushes the Sun', es: 'El viento empuja al Sol' },
          { pt: 'A Lua puxa as estrelas', en: 'The Moon pulls the stars', es: 'La Luna jala a las estrellas' },
          { pt: 'O Sol se apaga à noite', en: 'The Sun turns off at night', es: 'El Sol se apaga de noche' },
        ],
        correct: 0,
        explanation: {
          pt: 'Estamos sobre a Terra. Num carrossel, a paisagem parece passar, mas quem gira é você.',
          en: 'We live on the Earth. On a merry-go-round, the scenery seems to pass by, but you are the one turning.',
          es: 'Vivimos sobre la Tierra. En un carrusel, el paisaje parece pasar, pero quien gira eres tú.',
        },
      },
      {
        statement: {
          pt: 'Mais ou menos quanto tempo a Terra leva para dar uma volta completa em torno de si mesma?',
          en: 'About how long does the Earth take to spin once all the way around on itself?',
          es: '¿Más o menos cuánto tarda la Tierra en dar una vuelta completa sobre sí misma?',
        },
        options: [
          { pt: '1 ano', en: '1 year', es: '1 año' },
          { pt: '24 horas', en: '24 hours', es: '24 horas' },
          { pt: '1 mês', en: '1 month', es: '1 mes' },
          { pt: '1 hora', en: '1 hour', es: '1 hora' },
          { pt: '1 semana', en: '1 week', es: '1 semana' },
        ],
        correct: 1,
        explanation: {
          pt: 'Cada volta da Terra em torno de si mesma traz um dia e uma noite. Pense em quanto tempo passa de um nascer do Sol até o seguinte.',
          en: 'Each spin of the Earth on itself brings one day and one night. Think about how much time passes from one sunrise to the next.',
          es: 'Cada vuelta de la Tierra sobre sí misma trae un día y una noche. Piensa cuánto tiempo pasa de un amanecer al siguiente.',
        },
      },
      {
        statement: {
          pt: 'Por causa da rotação da Terra, o Sol parece nascer de qual lado do horizonte?',
          en: 'Because of the Earth\'s rotation, on which side of the horizon does the Sun seem to rise?',
          es: 'Por la rotación de la Tierra, ¿de qué lado del horizonte parece salir el Sol?',
        },
        options: [
          { pt: 'Oeste', en: 'West', es: 'Oeste' },
          { pt: 'Norte', en: 'North', es: 'Norte' },
          { pt: 'Sul', en: 'South', es: 'Sur' },
          { pt: 'Leste', en: 'East', es: 'Este' },
          { pt: 'Um lado diferente a cada dia', en: 'A different side every day', es: 'Un lado distinto cada día' },
        ],
        correct: 3,
        explanation: {
          pt: 'A Terra gira sempre no mesmo sentido, então o Sol surge sempre do mesmo lado. Observe-o de manhã.',
          en: 'The Earth always spins the same way, so the Sun always rises on the same side. Watch it in the morning.',
          es: 'La Tierra gira siempre en el mismo sentido, así que el Sol sale siempre del mismo lado. Obsérvalo en la mañana.',
        },
      },
    ],
  },
  {
    code: 'EF05GE06',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Geografia', en: 'Geography', es: 'Geografía' },
    skillText: {
      pt: 'Identificar e comparar transformações dos meios de transporte e de comunicação.',
      en: 'Identify and compare transformations of means of transportation and communication.',
      es: 'Identificar y comparar transformaciones de los medios de transporte y de comunicación.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 381',
    questions: [
      {
        statement: {
          pt: 'Qual destes meios de transporte existe há mais tempo?',
          en: 'Which of these means of transportation has existed the longest?',
          es: '¿Cuál de estos medios de transporte existe desde hace más tiempo?',
        },
        options: [
          { pt: 'Avião', en: 'Airplane', es: 'Avión' },
          { pt: 'Carro a gasolina', en: 'Gasoline car', es: 'Auto a gasolina' },
          { pt: 'Trem a vapor', en: 'Steam train', es: 'Tren de vapor' },
          { pt: 'Carroça puxada por animais', en: 'Animal-drawn cart', es: 'Carreta tirada por animales' },
          { pt: 'Metrô', en: 'Subway', es: 'Metro' },
        ],
        correct: 3,
        explanation: {
          pt: 'Os primeiros meios de transporte usavam a força de pessoas e animais; os motores vieram muito depois.',
          en: 'The first means of transportation used the strength of people and animals; engines came much later.',
          es: 'Los primeros medios de transporte usaban la fuerza de personas y animales; los motores llegaron mucho después.',
        },
      },
      {
        statement: {
          pt: 'Kauã vai viajar de São Paulo a Manaus. Qual meio de transporte o leva mais rápido?',
          en: 'Kauã is traveling from São Paulo to Manaus. Which means of transportation gets him there fastest?',
          es: 'Kauã va a viajar de São Paulo a Manaos. ¿Qué medio de transporte lo lleva más rápido?',
        },
        options: [
          { pt: 'Avião', en: 'Airplane', es: 'Avión' },
          { pt: 'Ônibus', en: 'Bus', es: 'Autobús' },
          { pt: 'Barco', en: 'Boat', es: 'Barco' },
          { pt: 'Bicicleta', en: 'Bicycle', es: 'Bicicleta' },
          { pt: 'Cavalo', en: 'Horse', es: 'Caballo' },
        ],
        correct: 0,
        explanation: {
          pt: 'Os meios de transporte ficaram mais rápidos ao longo do tempo. Compare quantos dias ou horas cada um levaria para cruzar o Brasil.',
          en: 'Means of transportation have become faster over time. Compare how many days or hours each one would take to cross Brazil.',
          es: 'Los medios de transporte se han vuelto más rápidos con el tiempo. Compara cuántos días u horas tardaría cada uno en cruzar Brasil.',
        },
      },
      {
        statement: {
          pt: 'Antes da internet, como as pessoas mandavam notícias escritas para quem morava longe?',
          en: 'Before the internet, how did people send written news to someone who lived far away?',
          es: 'Antes de internet, ¿cómo enviaban las personas noticias escritas a quien vivía lejos?',
        },
        options: [
          { pt: 'Por mensagem de celular', en: 'By cell phone message', es: 'Por mensaje de celular' },
          { pt: 'Por e-mail', en: 'By email', es: 'Por correo electrónico' },
          { pt: 'Por carta, pelo correio', en: 'By letter, through the post', es: 'Por carta, por correo postal' },
          { pt: 'Por videochamada', en: 'By video call', es: 'Por videollamada' },
          { pt: 'Por redes sociais', en: 'On social media', es: 'Por redes sociales' },
        ],
        correct: 2,
        explanation: {
          pt: 'Celular, e-mail e redes sociais dependem da internet, que é uma invenção recente. Pense em qual meio já existia muito antes dela.',
          en: 'Cell phones, email and social media depend on the internet, which is a recent invention. Think about which one existed long before it.',
          es: 'El celular, el correo electrónico y las redes sociales dependen de internet, que es un invento reciente. Piensa cuál existía mucho antes.',
        },
      },
    ],
  },
  {
    code: 'EF05HI08',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'História', en: 'History', es: 'Historia' },
    skillText: {
      pt: 'Identificar formas de marcação da passagem do tempo em distintas sociedades, incluindo os povos indígenas originários e os povos africanos.',
      en: 'Identify ways of marking the passage of time in different societies, including the original Indigenous peoples and African peoples.',
      es: 'Identificar formas de marcar el paso del tiempo en distintas sociedades, incluidos los pueblos indígenas originarios y los pueblos africanos.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 417',
    questions: [
      {
        statement: {
          pt: 'O antigo relógio de sol marca as horas usando o quê?',
          en: 'What does the old sundial use to tell the time?',
          es: '¿Qué usa el antiguo reloj de sol para marcar las horas?',
        },
        options: [
          { pt: 'A areia que escorre', en: 'Sand that trickles down', es: 'La arena que cae' },
          { pt: 'A sombra de uma vareta', en: 'The shadow of a stick', es: 'La sombra de una varilla' },
          { pt: 'A água da chuva', en: 'Rainwater', es: 'El agua de lluvia' },
          { pt: 'O canto dos pássaros', en: 'Birdsong', es: 'El canto de los pájaros' },
          { pt: 'As ondas do mar', en: 'Ocean waves', es: 'Las olas del mar' },
        ],
        correct: 1,
        explanation: {
          pt: 'Durante o dia, o Sol muda de lugar no céu, e as sombras mudam de tamanho e de direção com as horas.',
          en: 'During the day, the Sun changes place in the sky, and shadows change size and direction as the hours pass.',
          es: 'Durante el día, el Sol cambia de lugar en el cielo, y las sombras cambian de tamaño y dirección con las horas.',
        },
      },
      {
        statement: {
          pt: 'Muitos povos, entre eles povos indígenas do Brasil, contam o tempo em luas. Por que a Lua serve para isso?',
          en: 'Many peoples, including Indigenous peoples of Brazil, count time in moons. Why is the Moon useful for this?',
          es: 'Muchos pueblos, entre ellos pueblos indígenas de Brasil, cuentan el tiempo en lunas. ¿Por qué sirve la Luna?',
        },
        options: [
          { pt: 'Ela nunca muda de forma', en: 'It never changes shape', es: 'Nunca cambia de forma' },
          { pt: 'Ela só aparece no verão', en: 'It only appears in summer', es: 'Solo aparece en verano' },
          { pt: 'Ela é maior que o Sol', en: 'It is bigger than the Sun', es: 'Es más grande que el Sol' },
          { pt: 'Ela aparece só uma vez por ano', en: 'It appears only once a year', es: 'Aparece solo una vez al año' },
          { pt: 'Suas fases se repetem sempre', en: 'Its phases always repeat', es: 'Sus fases se repiten siempre' },
        ],
        correct: 4,
        explanation: {
          pt: 'Observe a Lua mês após mês: o que ela faz de novo?',
          en: 'Watch the Moon month after month: what does it do again?',
          es: 'Observa la Luna mes tras mes: ¿qué vuelve a hacer?',
        },
      },
      {
        statement: {
          pt: 'No antigo Egito, na África, o calendário se organizava por um acontecimento que voltava todo ano. Qual?',
          en: 'In ancient Egypt, in Africa, the calendar was organized around an event that returned every year. Which one?',
          es: 'En el antiguo Egipto, en África, el calendario se organizaba por un suceso que volvía cada año. ¿Cuál?',
        },
        options: [
          { pt: 'A primeira neve', en: 'The first snow', es: 'Primera nevada' },
          { pt: 'Eclipse do Sol', en: 'A solar eclipse', es: 'Eclipse de Sol' },
          { pt: 'A cheia do Nilo', en: 'The Nile flood', es: 'Crecida del Nilo' },
          { pt: 'A erupção de um vulcão', en: 'A volcano erupting', es: 'La erupción de un volcán' },
          { pt: 'A queda das folhas', en: 'Leaves falling', es: 'La caída de las hojas' },
        ],
        correct: 2,
        explanation: {
          pt: 'Os egípcios dividiam o ano em três estações: uma de água, uma de plantio e uma de colheita.',
          en: 'The Egyptians split the year into three seasons: one of water, one of planting and one of harvest.',
          es: 'Los egipcios dividían el año en tres estaciones: una de agua, una de siembra y una de cosecha.',
        },
      },
    ],
  },
  {
    code: 'EF05ER01',
    stage: 'ef5',
    grade: { pt: '5º ano', en: '5th grade', es: '5.º año' },
    component: { pt: 'Ensino Religioso', en: 'Religious Education', es: 'Educación Religiosa' },
    skillText: {
      pt: 'Identificar e respeitar acontecimentos sagrados de diferentes culturas e tradições religiosas como recurso para preservar a memória.',
      en: 'Identify and respect sacred events of different cultures and religious traditions as a resource for preserving memory.',
      es: 'Identificar y respetar acontecimientos sagrados de diferentes culturas y tradiciones religiosas como recurso para preservar la memoria.',
    },
    source: 'BNCC, versão final (MEC, 2018), PDF p. 453',
    questions: [
      {
        statement: {
          pt: 'No judaísmo, a festa de Pessach relembra qual acontecimento?',
          en: 'In Judaism, what event does Passover (Pesach) recall?',
          es: 'En el judaísmo, ¿qué acontecimiento recuerda la fiesta de Pésaj?',
        },
        options: [
          { pt: 'O nascimento de Jesus', en: 'The birth of Jesus', es: 'El nacimiento de Jesús' },
          { pt: 'A saída dos hebreus do Egito', en: 'The Hebrews leaving Egypt', es: 'Los hebreos dejan Egipto' },
          { pt: 'O fim do Ramadã', en: 'The end of Ramadan', es: 'El fin del Ramadán' },
          { pt: 'A luz vencendo as trevas', en: 'Light defeating darkness', es: 'La luz vence a la oscuridad' },
          { pt: 'A ressurreição de Jesus', en: 'The resurrection of Jesus', es: 'La resurrección de Jesús' },
        ],
        correct: 1,
        explanation: {
          pt: 'No judaísmo, o Pessach conta a libertação de um povo escravizado. A ceia do Seder recorda essa história.',
          en: 'In Judaism, Passover tells how an enslaved people was set free. The Seder meal recalls that story.',
          es: 'En el judaísmo, Pésaj cuenta la liberación de un pueblo esclavizado. La cena del Séder recuerda esa historia.',
        },
      },
      {
        statement: {
          pt: 'Na Festa de Iemanjá, das religiões afro-brasileiras, o que muitos fiéis entregam ao mar?',
          en: 'At the Festival of Iemanjá, in Afro-Brazilian religions, what do many followers give to the sea?',
          es: 'En la Fiesta de Iemanjá, de las religiones afrobrasileñas, ¿qué entregan muchos fieles al mar?',
        },
        options: [
          { pt: 'Um presépio', en: 'A nativity scene', es: 'Un pesebre' },
          { pt: 'Pó colorido', en: 'Colored powder', es: 'Polvo de colores' },
          { pt: 'Pão sem fermento', en: 'Unleavened bread', es: 'Pan sin levadura' },
          { pt: 'Flores e presentes', en: 'Flowers and gifts', es: 'Flores y regalos' },
          { pt: 'Velas por oito noites', en: 'Candles for eight nights', es: 'Velas durante ocho noches' },
        ],
        correct: 3,
        explanation: {
          pt: 'Iemanjá é a orixá do mar. Em 2 de fevereiro, em Salvador, os fiéis levam a ela coisas bonitas para agradecer.',
          en: 'Iemanjá is the orixá of the sea. On 2 February, in Salvador, the faithful bring her beautiful things as thanks.',
          es: 'Iemanjá es la orixá del mar. El 2 de febrero, en Salvador, los fieles le llevan cosas bonitas para agradecer.',
        },
      },
      {
        statement: {
          pt: 'No islã, o que muitos muçulmanos fazem no Ramadã?',
          en: 'In Islam, what do many Muslims do during Ramadan?',
          es: 'En el islam, ¿qué hacen muchos musulmanes en el Ramadán?',
        },
        options: [
          { pt: 'Jejuam do nascer ao pôr do sol', en: 'Fast from dawn to sunset', es: 'Ayunan de sol a sol' },
          { pt: 'Montam um presépio', en: 'Set up a nativity scene', es: 'Arman un pesebre' },
          { pt: 'Acendem velas por oito noites', en: 'Light candles for eight nights', es: 'Encienden velas ocho noches' },
          { pt: 'Jogam pó colorido', en: 'Throw colored powder', es: 'Se lanzan polvo de colores' },
          { pt: 'Comem só pão sem fermento', en: 'Eat only unleavened bread', es: 'Comen solo pan sin levadura' },
        ],
        correct: 0,
        explanation: {
          pt: 'No islã, o Ramadã lembra quando o Alcorão começou a ser revelado: tempo de oração, caridade e autocontrole.',
          en: 'In Islam, Ramadan recalls when the Quran began to be revealed: a time of prayer, charity and self-control.',
          es: 'En el islam, el Ramadán recuerda cuando comenzó a revelarse el Corán: tiempo de oración, caridad y autocontrol.',
        },
      },
    ],
  },
];
