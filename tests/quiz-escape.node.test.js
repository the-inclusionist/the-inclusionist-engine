// SPDX-License-Identifier: AGPL-3.0-or-later
// CONTEÚDO DE ATIVIDADE NÃO VIRA MARCAÇÃO (issue #106) — o sink que a issue nomeia, nos cinco tipos.
//
// ⚠️ HOJE NÃO HÁ CAMINHO DE INJEÇÃO, e é por isso que este ficheiro tem de existir AGORA. A palavra, as
// sílabas e as contas vêm do catálogo em código (`game/activity-content`). O ADR-0052 diz que o profissional
// AUTORA atividades e que uma atividade autorada é DADO — e no dia em que texto autorado chegar ao
// `quizHtml`, cada interpolação renderiza o que alguém digitou. A issue é explícita: *"antes de a autoria do
// ADR-0052 chegar, não depois. Assim que um profissional puder digitar numa atividade, isto deixa de ser
// censo e vira incidente."*
//
// ⚠️ E O ESCAPE PRECISA DE UM RASTO, senão é pior do que construir nós: um escape esquecido não deixa nenhum.
// Este ficheiro É o rasto — passa conteúdo hostil pelos CINCO tipos e pelos dois contextos, elemento e
// ATRIBUTO. O atributo é o pior: uma aspa fecha-o e o que vem a seguir vira atributo, sem precisar de tag.
import { describe, it, expect } from 'vitest';
import { quizHtml, escAtividade } from '../app/js/game/quiz.js';

/** O que um atacante escreve: fecha o que estiver aberto e injeta um elemento identificável. */
const FUGA = '"><i id="fugiu"></i><b>x';
const cru = (s) => s; // um `disp` que não transforma nada — o pior caso para quem escapa

const QL = { 1: 'Pré-leitura', 4: 'Escrevendo palavras', 5: 'Braille' };

/** Um desafio de cada tipo, com o conteúdo hostil em todos os campos que a marcação toca. */
const DESAFIOS = {
  pre: { kind: 'pre', word: FUGA, emoji: FUGA, choices: [FUGA, 'boa'], sel: 0, tries: 0, revealed: true },
  silabas: {
    kind: 'silabas', word: FUGA, emoji: FUGA, letter: FUGA,
    boxes: [FUGA, null], options: [FUGA, 'ba'], sel: 0, revealed: true,
  },
  alf: {
    kind: 'alf', word: FUGA, emoji: FUGA, braille: false,
    boxes: [FUGA, null], options: [FUGA, 'a'], sel: 0, revealed: true,
  },
  braille: { kind: 'braille', word: FUGA, emoji: FUGA, cells: [{ l: FUGA, dots: [1, 2] }] },
  somasub: { kind: 'somasub', prob: FUGA, choices: [{ disp: FUGA, key: 'x' }], sel: 0, answer: 'x', tries: 0, dots: 0, revealed: false },
};

describe('quizHtml — o conteúdo hostil não escapa do texto, em nenhum dos cinco tipos', () => {
  it.each(Object.keys(DESAFIOS))('[Right] %s', (tipo) => {
    const html = quizHtml(DESAFIOS[tipo], cru, QL);
    // ⚠️ A ASSERÇÃO É SOBRE A MARCAÇÃO GERADA, e não sobre um DOM já montado: é aqui que o defeito vive, e um
    // DOM montado esconderia o que a análise fez pelo caminho (foi assim que duas mutações sobreviveram no
    // conserto irmão de `settings-controls`).
    expect(html, 'o conteúdo fechou um atributo e injetou um elemento').not.toContain('<i id=');
    expect(html, 'uma aspa crua sobrou dentro de um atributo').not.toMatch(/aria-label="[^"]*"[^>]*id=/);
    // e o texto continua lá, escapado — escapar não pode ser o mesmo que apagar
    expect(html).toContain('&lt;');
  });

  it('[Zero] ⚠️ texto normal atravessa INTACTO — um escape que estraga a palavra não serve a ninguém', () => {
    // A criança tem de ver «pão», não «p&atilde;o». O escape toca nos cinco caracteres de marcação e em mais
    // nenhum; um caso que só verificasse a recusa deixaria passar uma versão que escapa demais.
    const bom = { ...DESAFIOS.pre, word: 'pão', emoji: '🍞', choices: ['pão', 'pao'] };
    const html = quizHtml(bom, cru, QL);
    expect(html).toContain('pão');
    expect(html).toContain('🍞');
    expect(html).not.toContain('&amp;');
  });
});

describe('escAtividade — os cinco caracteres, e a ordem entre eles', () => {
  it('[Right] cobre os dois contextos: elemento (< >) e atributo (" \')', () => {
    expect(escAtividade('<b>')).toBe('&lt;b&gt;');
    expect(escAtividade('a"b')).toBe('a&quot;b');
    expect(escAtividade("a'b")).toBe('a&#39;b');
  });

  it('[Boundary] ⚠️ o `&` é escapado PRIMEIRO — na outra ordem, `&lt;` vira `&amp;lt;`', () => {
    // O erro clássico deste helper, e ele é silencioso: a tela mostra `&lt;` literal em vez de `<`, e quem
    // testar só com `<b>` nunca o vê, porque o resultado ainda «parece» escapado.
    expect(escAtividade('&')).toBe('&amp;');
    expect(escAtividade('&lt;')).toBe('&amp;lt;'); // um `&lt;` que a criança digitou é texto, e assim continua
    expect(escAtividade('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });

  it('[Zero] texto sem marcação sai igual', () => {
    expect(escAtividade('pão com manteiga 3 + 4')).toBe('pão com manteiga 3 + 4');
  });
});
