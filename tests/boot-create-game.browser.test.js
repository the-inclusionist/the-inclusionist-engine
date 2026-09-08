// SPDX-License-Identifier: AGPL-3.0-or-later
// A RAIZ DE COMPOSIÇÃO CONTRA UM DOCUMENTO DE VERDADE (ADR-0106 etapa 2).
//
// ========================= POR QUE ESTE FICHEIRO EXISTE =========================
// Em 2026-09-08 uma varredura achou SEIS defeitos na montagem da barra e do cartão de pausa, e CINCO deles
// eram meus, introduzidos no próprio dia em que fiz a engine montá-los. Os cinco passaram pelo mesmo sítio: o
// `domFalso` do `boot-create-game.node.test.js`, que precisou de ser remendado TRÊS VEZES SEPARADAS por ser
// mais pobre do que a coisa real — primeiro sem `innerHTML`, depois sem `appendChild`, e por fim com
// `HTMLElement` a ser um global de navegador que, lido onde não existe, LANÇA em vez de devolver `false`.
//
// ⚠️ ISSO NÃO É UMA CRÍTICA AO DUPLO: é a definição dele. Um duplo só sabe o que quem o escreveu sabia, e por
// isso ele é forte exactamente onde a lógica decide e cego exactamente onde o DOM decide. O padrão não se
// conserta remendando o duplo pela quarta vez — conserta-se tendo um documento a sério onde a montagem mora.
//
// 🎯 A REGRA DE CADA CASO AQUI, e ela é o que impede este ficheiro de ser uma duplicata cara: **um caso só
// entra se o `domFalso` NÃO CONSEGUISSE fazê-lo.** Onde o duplo já responde — a ordem do mixer, o que entra em
// `problems`, declarar mal explodir —, o node continua a ser o sítio certo: corre em milissegundos e não
// precisa de navegador. O que fica para aqui é o que só um documento sabe: se a marcação PARSEIA, se o
// elemento está mesmo NA ÁRVORE, se dá para lá chegar com o teclado, e se um clique de verdade percorre o
// caminho todo.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

let createGame;
let repor;

/** O documento mínimo que um jogo oferece: a região do mundo e o hospedeiro da barra da primeira tela. */
function montarHospedeiro() {
  const raiz = document.createElement('div');
  raiz.id = 'raiz-de-teste';
  raiz.innerHTML = '<div id="game-region"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  return raiz;
}

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

const abrir = (extra = {}) => createGame({
  declaration: declaracaoValida(),
  host: { doc: document, win: window },
  ...extra,
});

describe('createGame num documento de verdade', () => {
  let raiz;

  beforeEach(async () => {
    // `await import` e não estático, pela mesma razão do ficheiro node: o grafo de boot é grande e um módulo
    // partido não deve derrubar a colecção inteira antes de o primeiro caso correr.
    if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
    // ⚠️ O MODO CEGO É ESTADO DE MÓDULO E PERSISTE — em `core/state` e no armazenamento. Sem esta reposição,
    // um caso que o liga deixa o seguinte a começar ligado, e o seguinte mede o contrário do que diz. Foi o
    // que aconteceu na primeira volta, e apanhá-lo aqui é mais barato do que voltar a caçá-lo.
    if (!repor) ({ setModoCegoValue: repor } = await import('../app/js/core/state.js'));
    repor(false);
    raiz = montarHospedeiro();
  });

  afterEach(() => { raiz.remove(); document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove()); });

  it('⚠️ [Right] a marcação da barra PARSEIA — o duplo só sabia que uma string foi atribuída', () => {
    // ⚠️ O `domFalso` guarda `innerHTML` como texto. Num documento a sério, atribuir `innerHTML` ANALISA a
    // marcação, e uma que não fecha uma tag produz ZERO elementos — sem erro, sem aviso, e com o duplo verde.
    // A criança que depende do modo cego abre o jogo e a barra simplesmente não está lá.
    abrir();
    const barra = document.querySelector('#title-icons');
    const botoes = barra.querySelectorAll('[data-pi]');
    expect(botoes.length, 'a barra montou marcação que o navegador não conseguiu ler').toBeGreaterThan(0);
    // e são ELEMENTOS na árvore, não texto: cada um responde ao documento que o contém
    expect(botoes[0].isConnected).toBe(true);
  });

  it('⚠️ [Right] os ícones da primeira tela são ALCANÇÁVEIS PELO TECLADO', () => {
    // ⚠️ É O ARGUMENTO DA ETAPA 2 VIRADO AFIRMAÇÃO, e nenhum duplo o alcança. A montagem deliberadamente NÃO
    // usa `buildQuickBar`, que põe `tabIndex = -1` porque durante a partida dez paradas separam a criança do
    // jogo. Na PRIMEIRA tela ninguém está a jogar, e tirar os ícones da ordem de tabulação ali seria
    // escondê-los de quem navega por teclado — exactamente a pessoa para quem eles existem.
    abrir();
    const alvo = document.querySelector('#title-icons [data-pi]');
    expect(alvo.tabIndex, 'ícone fora da ordem de tabulação na tela onde ninguém está a jogar').toBeGreaterThanOrEqual(0);
    // e focar de verdade: `tabIndex` é uma promessa, `activeElement` é o cumprimento dela
    alvo.focus();
    expect(document.activeElement).toBe(alvo);
  });

  it('⚠️ [Right] o cartão de pausa é ENCONTRÁVEL pelo id que a própria engine procura', () => {
    // ⚠️ ESTE É O CASO MAIS FORTE DO FICHEIRO, e é o único que fecha o laço de verdade. O `getPauseMenu` da
    // engine procura `#vp-pause-0` no DOCUMENTO. Pôr `cartao.id = 'vp-pause-0'` satisfaz qualquer duplo — mas
    // um cartão com id certo pendurado num hospedeiro DESLIGADO da árvore é invisível a `querySelector`, e a
    // engine voltaria a concluir, em silêncio, que este jogo não tem menu de pausa. Só um documento sabe a
    // diferença entre «tem o id» e «está lá».
    abrir();
    expect(document.querySelector('#vp-pause-0'), 'a engine monta o cartão e depois não o encontra').not.toBeNull();
  });

  it('⚠️ [Right] MONTAR não é MOSTRAR, e `pausa.mostrar` mostra DE FACTO', () => {
    // O cartão nasce escondido — uma pausa ABRE. O duplo só consegue ver a propriedade `hidden` mudar; aqui
    // pergunta-se ao layout, que é quem a criança consulta.
    const motor = abrir();
    const cartao = document.querySelector('#vp-pause-0');
    expect(cartao.offsetParent, 'o cartão nasceu visível — uma pausa ABRE, não está sempre aberta').toBeNull();
    motor.pausa.mostrar(0);
    expect(cartao.hidden).toBe(false);
    expect(cartao.offsetParent, '`hidden` saiu mas o cartão continua sem ocupar espaço nenhum').not.toBeNull();
    motor.pausa.esconder(0);
    expect(cartao.offsetParent).toBeNull();
  });

  it('⚠️ [Right] um clique DE VERDADE num ícone percorre o caminho todo', () => {
    // ⚠️ O duplo regista que `addEventListener` foi chamado; ele não pode disparar o ouvinte com um evento que
    // BORBULHA a partir de um filho, que é como um clique real chega. O `iconAct` lê `e.target.closest(...)`,
    // e um alvo que não é elemento — ou um ouvinte pendurado no sítio errado — só falha aqui.
    // 📌 O ÍCONE ESCOLHIDO É O MODO CEGO de propósito: é o que a etapa 1b deu à engine por padrão
    // (`setModoCegoValue`), logo um jogo que não injecta nada tem de o ver funcionar — e foi exactamente ali
    // que o botão ficou mudo em 2026-09-08. O caminho medido é o inteiro: clique real → `iconAct` →
    // `setModoCego` → evento de estado → `reflectIconsIn` → o DOM diz o estado novo.
    abrir();
    const barra = document.querySelector('#title-icons');
    const alvo = barra.querySelector('[data-pi="blind"]');
    expect(alvo, 'o modo cego não está na primeira tela').not.toBeNull();
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // ⚠️ Relê do DOCUMENTO e não da referência: reflectir pode ter REESCRITO a barra, e um nó guardado antes
    // do clique seria um órfão a dizer o estado velho — a forma de defeito do `reflectTTS`.
    const depois = document.querySelector('#title-icons [data-pi="blind"]');
    expect(depois.getAttribute('aria-pressed'), 'o clique chegou mas o ícone não diz o estado novo').toBe('true');
  });

  it('🔴 [Zero] o modo cego DESLIGA — sem isto ele liga uma vez e a criança fica lá dentro', () => {
    // 🔴 ESTE CASO EXISTE POR CAUSA DE UM DEFEITO REAL QUE SÓ UM DOM REAL PODIA MOSTRAR, e ele era meu.
    //
    // O par do modo cego ganhou os dois padrões em dias diferentes e eles não se falavam: o ESCRITOR ficou
    // com `setModoCegoValue` (etapa 1b do ADR-0106), que escreve no `core/state`; o LEITOR ficou com
    // `() => false`, uma CONSTANTE que já lá estava. Com um jogo que não injecta `isBlindMode`:
    //
    //   1. a criança carrega → `setModoCego(!false)` → o modo LIGA de verdade;
    //   2. o reflexo lê `false` → o ícone continua a dizer «desligado» e o anúncio também;
    //   3. ela carrega outra vez → `setModoCegoValue(!false)` = `true` OUTRA VEZ → a guarda de igualdade
    //      devolve cedo → nada acontece.
    //
    // ⚠️ Ou seja: o modo cego ligava uma vez e NÃO HAVIA COMO DESLIGAR. Para quem não depende dele, é um jogo
    // que de repente descreve tudo em voz alta e não se cala. Não há erro em lado nenhum.
    //
    // 📌 E o `domFalso` não podia apanhá-lo NUNCA: o `addEventListener` dele é um stub, então o corpo do
    // ouvinte — onde o par é exercitado — jamais correu em teste algum.
    abrir();
    const q = () => document.querySelector('#title-icons [data-pi="blind"]');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'não ligou').toBe('true');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'ligou e não há como voltar').toBe('false');
  });

  it('⚠️ [Boundary] a barra monta no hospedeiro DECLARADO, e não caça um id fixo', () => {
    // O jogo diz onde ela cabe no desenho dele; a engine não adivinha. Num documento a sério isto prova-se
    // pelo sítio onde os nós ficaram, que é a única coisa que um duplo com um mapa de ids não distingue.
    const meu = document.createElement('nav');
    meu.id = 'a-minha-barra';
    raiz.appendChild(meu);
    abrir({ host: { doc: document, win: window, a11yBarHost: meu } });
    expect(meu.querySelectorAll('[data-pi]').length).toBeGreaterThan(0);
    expect(document.querySelector('#title-icons').children.length, 'montou nos DOIS sítios').toBe(0);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Seis, aplicadas por script ao ficheiro e sempre com contagem de ocorrencias.
//
//   1. ⚠️ `getModoCego` a voltar a ser `() => false` -> reprovam DOIS. E ela nao e uma mutacao inventada: e o
//      ESTADO EM QUE O CODIGO ESTAVA quando este ficheiro nasceu. Todo o resto da suite continua verde com
//      ela aplicada, que e a medida exacta de quanto o duplo nao alcancava.
//   2. a barra a montar marcacao VAZIA -> reprovam CINCO. E o caso do vacuo deste ficheiro: sem barra, quase
//      tudo o que ele afirma deixa de ter sujeito, e um crivo que nao acha nada nao prova ausencia nenhuma.
//   3. o cartao com outro id -> reprovam DOIS. A engine procura `#vp-pause-0`; montar com outro nome reabre
//      o laco que a etapa 2 fechou, e em silencio.
//   4. `mostrar` a nao revelar -> reprova UM. Montar nao e mostrar, e a distincao tem de custar alguma coisa.
//   5. o hospedeiro DECLARADO ignorado -> reprova UM. A engine nao adivinha onde a barra cabe num jogo alheio.
//   6. `tabindex="-1"` nos icones -> reprova UM. E o argumento da etapa 2 a pagar-se: na primeira tela ninguem
//      esta a jogar, e tirar os icones da tabulacao esconde-os de quem navega por teclado.
