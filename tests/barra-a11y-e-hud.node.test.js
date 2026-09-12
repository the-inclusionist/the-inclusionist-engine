// SPDX-License-Identifier: AGPL-3.0-or-later
// A BARRA DE ACESSIBILIDADE É HUD: o rectângulo dela é reservado (ADR-0148 §3).
//
// ========================= O DEFEITO, MEDIDO NUM NAVEGADOR ANTES DE SER ESCRITO =========================
// 🔴 Em 2026-09-12, no `dist/quiz.html`: `#title-icons` é `position:absolute` DENTRO do `#game-region`, em
// (123,15) com 337×44 — e o `H2.quiz-pergunta`, o título da pergunta, ocupa os mesmos pixels. A criança que
// procura o modo cego, o TTS ou o Libras encontra texto do jogo por cima dos botões.
//
// ⚠️ E NADA FALHAVA: sem erro, sem tipo, sem consola. Só uma fila de botões tapada — e quem mais depende dela
// é precisamente quem não vê que ela está tapada. Foi o Dev que o apontou, não um crivo.
//
// 📌 A DECISÃO QUE ESTE FICHEIRO PRENDE É O QUE CONTA COMO INVASÃO, que é a parte que se erra: a barra
// intersecta-se a si mesma e aos próprios botões, e um crivo que os contasse acusaria SEMPRE.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { invasoresDaBarra } from '../app/js/ui/layout.js';

const BARRA = { x: 100, y: 10, w: 300, h: 44 };
const no = (nome, caixa, daBarra = false) => ({ nome, caixa, daBarra });

describe('invasoresDaBarra — quem escreve por cima do HUD', () => {
  it('🔴 [Right] o título que cobre a barra é ACUSADO, pelo nome', () => {
    // O caso do Dev, com os números que o navegador deu.
    // ⚠️ Os NOMES dos nós são neutros de propósito, e o crivo `engine-boundary` reprovou a primeira versão
    // deles: um fixture de engine não pode precisar do vocabulário de um género para correr. O que este caso
    // afirma é geométrico — um título por cima da barra —, e isso vale para qualquer jogo.
    const invasores = invasoresDaBarra(BARRA, [
      no('h2#.titulo-da-atividade', { x: 90, y: 5, w: 340, h: 60 }),
      no('div#app.raiz-do-jogo', { x: 80, y: 0, w: 420, h: 400 }),
    ]);
    expect(invasores).toEqual(['h2#.titulo-da-atividade', 'div#app.raiz-do-jogo']);
  });

  it('🔴 [Zero] os BOTÕES da própria barra não contam — senão o crivo acusa sempre', () => {
    // ⚠️ Eles intersectam-na por definição. Um crivo que os contasse ficaria vermelho em todo jogo, e um
    // crivo que acusa sempre é o mesmo que crivo nenhum — é o «afogar o que se pode resolver» do ADR-0106 §2.
    expect(invasoresDaBarra(BARRA, [
      no('button#.pi-btn', { x: 110, y: 15, w: 40, h: 40 }, true),
      no('div#title-icons.pause-icons', BARRA, true),
    ])).toEqual([]);
  });

  it('📌 [Boundary] encostar NÃO é invadir — nos DOIS eixos', () => {
    // Um nó que acaba exactamente onde a barra começa está ao lado dela, não por cima. Sem isto, todo jogo
    // com um elemento colado à barra seria acusado, e o consumidor aprenderia a ignorar a linha.
    //
    // ⚠️ OS DOIS EIXOS, e o segundo par entrou depois: uma mutação que afrouxava só a comparação em X ficou
    // VERDE, porque o caso original só encostava em Y. Um crivo que prende uma fronteira e não a outra
    // autoriza metade do defeito.
    expect(invasoresDaBarra(BARRA, [no('div#.abaixo', { x: 100, y: 54, w: 300, h: 20 })])).toEqual([]);
    expect(invasoresDaBarra(BARRA, [no('div#.um-px-dentro', { x: 100, y: 53, w: 300, h: 20 })]))
      .toEqual(['div#.um-px-dentro']);
    expect(invasoresDaBarra(BARRA, [no('div#.a-direita', { x: 400, y: 10, w: 50, h: 44 })])).toEqual([]);
    expect(invasoresDaBarra(BARRA, [no('div#.a-esquerda', { x: 50, y: 10, w: 50, h: 44 })])).toEqual([]);
    expect(invasoresDaBarra(BARRA, [no('div#.um-px-a-direita', { x: 399, y: 10, w: 50, h: 44 })]))
      .toEqual(['div#.um-px-a-direita']);
  });

  it('[Zero] um nó SEM ÁREA não invade nada', () => {
    // Contentores de zero altura são comuns em markup gerado, e acusá-los seria ruído puro.
    //
    // 🔴 E A SEGUNDA LINHA É A QUE IMPORTA, porque ela apanhou um erro MEU: eu tinha lido que as
    // desigualdades estritas já excluíam quem não tem área, e tirei o guarda. É falso — elas excluem o caso
    // DEGENERADO NA FRONTEIRA (a primeira linha), não um em geral. Uma risca de largura zero a atravessar a
    // barra passa nas quatro comparações. O guarda voltou, e esta linha é o que o prende.
    expect(invasoresDaBarra(BARRA, [no('div#.vazio', { x: 100, y: 10, w: 0, h: 0 })])).toEqual([]);
    expect(invasoresDaBarra(BARRA, [no('div#.risca', { x: 150, y: 20, w: 0, h: 60 })])).toEqual([]);
  });

  it('🔴 [Zero] sem barra — ou com barra de área zero — NÃO se acusa ninguém', () => {
    // ⚠️ É o par que impede o crivo de ser um acusador universal: contra um rectângulo de zero, tudo
    // «intersecta» pela regra ingénua. Um jogo sem barra montada não tem nada reservado.
    const tudo = [no('div#.qualquer', { x: 0, y: 0, w: 999, h: 999 })];
    expect(invasoresDaBarra(null, tudo)).toEqual([]);
    expect(invasoresDaBarra({ x: 100, y: 10, w: 0, h: 44 }, tudo)).toEqual([]);
    expect(invasoresDaBarra({ x: 100, y: 10, w: 300, h: 0 }, tudo)).toEqual([]);
  });
});

// ============================== MUTAÇÕES CONFERIDAS ==============================
// Aplicadas por script ao ficheiro, com a contagem de ocorrências conferida ANTES de cada uma. Oito, oito
// vermelhas — e DUAS delas só ficaram vermelhas depois de o plano me apanhar:
//
//   G1  os botões da própria barra passam a contar        🔴 o crivo acusaria SEMPRE
//   G2a a fronteira em X afrouxa para `<=`                🔴 encostar viraria invadir
//   G2b a fronteira em Y afrouxa para `<=`                🔴 idem, no outro eixo
//   G3  barra de área zero deixa de ser recusada          🔴 acusaria toda a gente
//   G4  o guarda de área zero sai                         🔴 a risca de largura zero
//   G5  a engine não acusa a sobreposição (alvo: browser) 🔴 o silêncio volta
//   G6  a faixa reservada não é declarada (idem)          🔴 o jogo não tem o que ler
//
// ⚠️ A G2 SOBREVIVEU À PRIMEIRA VOLTA porque o caso de fronteira só encostava num eixo. Um crivo que prende
// uma fronteira e não a outra autoriza metade do defeito — e foi por isso que o caso passou a ter os quatro
// lados.
//
// 🔴 E A G4 APANHOU UM ERRO MEU, que é o achado mais útil deste ficheiro. Ela sobreviveu, eu li isso como
// «o guarda de área zero é inerte porque as desigualdades estritas já o fazem», e TIREI o guarda. A leitura
// era falsa: as estritas excluem o caso DEGENERADO NA FRONTEIRA, não um em geral — uma risca de largura zero
// a atravessar a barra passa nas quatro comparações. O guarda voltou, e o caso da risca é o que o prende.
// 📌 A lição não é sobre geometria: uma mutação que sobrevive diz «o crivo não vê isto», e NÃO diz «o código
// é inerte». As duas conclusões parecem a mesma e levam a lados opostos.
