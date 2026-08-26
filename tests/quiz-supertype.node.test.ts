// SPDX-License-Identifier: AGPL-3.0-or-later
// A PROVA que o ADR-0039 exige, e ela existe porque a afirmação já estava no código — em prosa.
//
// `game/entity.ts` diz, no comentário do `PlayerQuiz`: "Todas as cinco variantes de `Quiz` (game/quiz)
// satisfazem isto por construção". A frase é verdadeira hoje e não era verificável: nada quebrava se uma
// sexta variante nascesse sem `revealed`, ou se `coinIndex` virasse `string` numa delas. A discordância só
// apareceria no `main.ts`, meses depois, como um erro que fala de vistas de jogador e não da causa.
//
// O ADR-0039 fixou a regra de que este arquivo é a metade verificável: quando um módulo que NÃO é dono do
// tipo precisa mencionar um campo, ou não o declara, ou declara um SUPERTIPO VERDADEIRO — e "verdadeiro"
// quer dizer provado, não comentado.
//
// DUAS METADES, e as duas são necessárias:
//   · a de COMPILAÇÃO (`Estende<...>`) falha no `tsc`, e portanto no gate `typecheck`, que exige zero
//     erros fora do `main.ts`. É ela que pega uma variante que deixou de satisfazer o supertipo.
//   · a de EXECUÇÃO (o `it` abaixo) falha no `vitest`, e pega o que o compilador não vê: um campo renomeado
//     em quem CONSTRÓI o objeto, com o tipo ainda declarando o nome antigo como opcional.
import { describe, it, expect } from 'vitest';
import type { PlayerQuiz } from '../app/js/game/entity.js';
import type { MathQuiz, SilabasQuiz, PreQuiz, AlfQuiz, BrailleQuiz, Quiz, QuizComCursor } from '../app/js/game/quiz.js';

/**
 * `true` só quando A é atribuível a B. Escrito assim, e não com um `satisfies`, porque a falha precisa cair
 * NA LINHA da variante culpada: `const _math: Estende<MathQuiz, PlayerQuiz> = true` diz qual das cinco
 * quebrou, enquanto uma asserção sobre a união diria apenas que "a união" quebrou.
 */
type Estende<A, B> = A extends B ? true : false;

// MUTAÇÃO CONFERIDA, e o resultado corrige o que eu tinha previsto: trocado `revealed: boolean` por
// `revealed?: boolean` no `QuizCommon`, o `tsc` acusa SETE erros — as seis asserções abaixo e a atribuição
// do terceiro `it` —, todos com `Type 'true' is not assignable to type 'false'`. Herdando todas de
// `QuizCommon`, as cinco variantes caem juntas; a graça de uma linha por variante é o caso em que só UMA
// muda. E elas derrubam o `typecheck`, que desde 2026-08-26 não tem orçamento nenhum em lugar nenhum.
const _math: Estende<MathQuiz, PlayerQuiz> = true;
const _silabas: Estende<SilabasQuiz, PlayerQuiz> = true;
const _pre: Estende<PreQuiz, PlayerQuiz> = true;
const _alf: Estende<AlfQuiz, PlayerQuiz> = true;
const _braille: Estende<BrailleQuiz, PlayerQuiz> = true;

/** E a união inteira, que é o que os consumidores realmente atravessam. */
const _uniao: Estende<Quiz, PlayerQuiz> = true;

/**
 * E o NEGATIVO, que é a metade que quase nunca se escreve: o ditado Braille não tem cursor, e a assinatura
 * de `selRange` passou a dizer isso. Enquanto havia um `as MathQuiz | PreQuiz` lá dentro, o `BrailleQuiz`
 * caía no ramo falso e `q.choices.length` teria sido `undefined.length`. Se alguém devolver o Braille ao
 * tipo, esta linha cai antes do primeiro `undefined`.
 */
const _brailleSemCursor: Estende<BrailleQuiz, QuizComCursor> = false;

// Os seis acima existem para o `tsc`; o `void` é para o `noUnusedLocals` do dia em que ele for ligado.
void [_math, _silabas, _pre, _alf, _braille, _uniao, _brailleSemCursor];

/**
 * Um exemplar de cada variante, construído com os campos MÍNIMOS. Não é uma fixture do jogo — é o menor
 * objeto que o tipo aceita, e por isso ele prova a forma e não o conteúdo.
 */
const EXEMPLARES: ReadonlyArray<readonly [string, Quiz]> = [
  ['somasub', { kind: 'somasub', coinIndex: 0, revealed: false, shape: 'circulo', sel: 0, tries: 0, prob: '1+1', answer: '2', choices: [] }],
  ['silabas', { kind: 'silabas', coinIndex: 1, revealed: false, hearSyl: true, letter: 'b', word: 'bola', emoji: '⚽', correct: ['bo', 'la'], options: ['bo', 'la'], boxes: [null, null], sel: 0, tries: 0 }],
  ['pre', { kind: 'pre', coinIndex: 2, revealed: false, word: 'bola', emoji: '⚽', choices: ['bola'], sel: 0, tries: 0 }],
  ['alf', { kind: 'alf', coinIndex: 3, revealed: false, braille: false, word: 'bola', emoji: '⚽', options: ['b'], boxes: [null], sel: 0, tries: 0 }],
  ['braille', { kind: 'braille', coinIndex: 4, revealed: false, letter: 'b', word: 'bola', emoji: '⚽', cells: [] }],
];

describe('PlayerQuiz é supertipo VERDADEIRO da união Quiz (ADR-0039)', () => {
  it('as cinco variantes carregam os três campos do supertipo, com os tipos certos', () => {
    for (const [nome, q] of EXEMPLARES) {
      expect(typeof q.kind, nome).toBe('string');
      expect(typeof q.coinIndex, nome).toBe('number');
      expect(typeof q.revealed, nome).toBe('boolean');
    }
  });

  it('os cinco discriminantes são distintos — é o que permite estreitar sem `as`', () => {
    const kinds = EXEMPLARES.map(([, q]) => q.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds.sort()).toEqual(['alf', 'braille', 'pre', 'silabas', 'somasub']);
  });

  it('um exemplar atravessa como PlayerQuiz sem perder nada que o supertipo declare', () => {
    // A atribuição é o ponto do teste: se a relação de supertipo cair, ESTA LINHA não compila.
    const comoMinimo: PlayerQuiz = EXEMPLARES[0][1];
    expect(comoMinimo.kind).toBe('somasub');
    expect(comoMinimo.coinIndex).toBe(0);
    expect(comoMinimo.revealed).toBe(false);
  });
});
