// SPDX-License-Identifier: AGPL-3.0-or-later
// game/carry — PEGAR, CARREGAR E ARREMESSAR: qual botão faz o quê, e em que contexto.
//
// ========================= O QUE ESTE MÓDULO É, E O QUE ELE NÃO É =========================
// É a metade do mecanismo que NÃO depende de decisões de jogo ainda em aberto: de onde vêm os objetos
// (postos no mapa? surgem de algo?) e para que servem (abrir caminho? atingir algo?). Essas são do Dev, e
// inventá-las aqui seria escrever regra de jogo que não é minha.
//
// O que não depende delas é o ROTEAMENTO DE BOTÃO, que é justamente onde os becos se escondem — e é a parte
// que a alternância do correr desloca. Por isso ela vem primeiro, pura e testável sem tela.
//
// Não há sprite, não há física, não há mundo aqui. Entra o contexto de um quadro, sai uma intenção.
//
// ========================= O CONTRATO, NAS PALAVRAS DO DEV =========================
// "Botão de interação continua sendo botão de interação e servindo para conversar, pegar e jogar mesmo nos
// outros modos. O que muda é que a parte de correr (que precisa que ele seja mantido apertado) vira toggle
// em modo de teclas de alternância, controle touch, controle pelo rosto, controle por olhos e controle por
// fala."
//
// ⚠️ ISSO REVOGA, EM 2026-08-28, O CONTRATO ANTERIOR DELE, e vale registrar o que caiu. Até aqui, com a
// alternância do correr ligada, o gatilho da carga MUDAVA para o botão de pulo — e o preço, escrito desde o
// primeiro dia justamente para ninguém descobrir na tela, era que perto de um objeto o pulo PEGAVA em vez de
// pular. O Dev desfez: "desfaço o que pedi".
//
// O que sobrou é mais simples e não tem preço nenhum: o BOTÃO DE INTERAÇÃO é sempre o botão de interação, em
// todo modo de entrada. A alternância mexe só na parte de CORRER — a que exige manter apertado —, que é
// exatamente a que precisa virar estado para quem não consegue manter apertado. As duas coisas moram no mesmo
// botão sem disputar: correr é ESTADO, interagir é EVENTO.
//
// ⚠️ E POR ISSO `acaoDeCarga` NÃO RECEBE MAIS O JOGADOR. Ela recebia para perguntar `pl.toggleRun` e escolher
// a borda; sem essa escolha, o que decide a ação é só o contexto do quadro. Um parâmetro a menos é um
// caminho a menos por onde um ajuste de acessibilidade poderia mudar o jogo de quem não pediu por ele.
//
// ========================= A DIREÇÃO SEPARA ARREMESSAR DE SOLTAR (2026-08-28) =========================
// "Arremesso = apertar a direção da esquerda ou direita e apertar o botão de interação / corrida quando se
// está segurando algo." E, no mesmo turno, o motivo de SOLTAR existir: "ela deve poder pegar lixo e soltar
// para administrar seus assuntos e também poderá voltar e pegar o que ficou para trás com o poder de vôo."
//
// ⚠️ E ISSO TORNOU O PEGAR OBRIGATORIAMENTE DE BOTÃO, o que não era óbvio. A primeira ligação da reciclagem
// pegava por PROXIMIDADE — encostou, pegou. Com o soltar existindo, proximidade vira armadilha: a criança
// solta o lixo para resolver outra coisa, dá um passo, e o item volta para a mão sozinho, porque ela ainda
// está ao alcance dele. Soltar deixaria de significar qualquer coisa. Quem decide pegar é ela.
//
// ORDEM COM O GRUDE: os dois moram no botão de interação e não se atropelam porque os contextos são
// disjuntos — grudar exige estar NO AR e encostado numa parede, e pegar exige um objeto ao alcance no chão.
// Se um dia colidirem, é aqui que a ordem tem de ser escrita.

/* ===================== O QUE SE PODE FAZER COM CADA COISA (2026-08-28) =====================
 *
 * Carregar deixou de ser uma coisa só: o que é permitido depende DO QUE está na mão, e o Dev listou as
 * quatro classes com as regras de cada uma.
 *
 *   · LIXO — "Uma vez que segura o lixo ele só poderá soltar na lixeira e não poderá seguir após a placa.
 *     Ou seja, pegar o lixo trava ele de soltá-lo ou arremessá-lo." Não solta, não arremessa. A única saída
 *     é a lixeira certa.
 *   · SEMENTE — arremessável: "se ele arremessar sementes, vem pássaros comer e nascem flores e mato no
 *     lugar onde ela cai".
 *   · BOLA — arremessável: "não acontece nada de errado, ela quica e ricocheteia dependendo do lugar".
 *   · PERDIDO (relógio, molho de chaves, filhote, celular, carteira) — pode ser deixado no chão, para
 *     devolver ao dono. NÃO se arremessa: é de alguém, e um filhote não é projétil.
 *
 * ⚠️ E A LISTA É FECHADA POR DECISÃO, não por falta de imaginação: "nenhum outro objeto além de sementes e
 * bolas (futebol, tênis, neve em fase de gelo, o que não é o caso) são arremessáveis". Quem for acrescentar
 * uma classe nova arremessável está mexendo numa decisão dele, e é aqui que ela está escrita.
 *
 * ⚠️ POR QUE ISTO É UMA TABELA E NÃO UM `if` NO LIXO: porque a próxima classe entra sem tocar em regra
 * nenhuma, e porque a pergunta "o que se pode fazer com isto?" passa a ter UM lugar. Espalhada, ela viraria
 * um `tipo === 'lixo'` em cada ponto que solta, arremessa ou desenha. */

/** As classes de coisa que se carrega. Fechada de propósito — ver acima. */
export type TipoDeCarga = 'lixo' | 'semente' | 'bola' | 'perdido';

/** O que cada classe permite. */
export const PODE: Readonly<Record<TipoDeCarga, { soltar: boolean; arremessar: boolean }>> = Object.freeze({
  lixo: { soltar: false, arremessar: false },
  semente: { soltar: true, arremessar: true },
  bola: { soltar: true, arremessar: true },
  perdido: { soltar: true, arremessar: false },
});

/** O contexto do quadro. */
export interface ContextoDeCarga {
  /** Há objeto pegável ao alcance? */
  objetoPerto: boolean;
  /** As mãos já estão ocupadas? */
  carregando: boolean;
  /** A borda do BOTÃO DE INTERAÇÃO (o mesmo do correr) neste quadro. Único gatilho da carga, em todo modo. */
  bordaDeInteracao: boolean;
  /** A direção SEGURADA no instante do botão: -1 esquerda, +1 direita, 0 nenhuma. É ela que separa
   *  ARREMESSAR de SOLTAR (ver `acaoDeCarga`). */
  direcao: -1 | 0 | 1;
  /** O que está na mão, se há algo. É ele que decide o que é permitido (ver `PODE`). */
  tipoDaCarga: TipoDeCarga | null;
}

export type AcaoDeCarga = 'pegar' | 'arremessar' | 'soltar' | 'nada';

/**
 * O que este quadro faz com a carga. Um gatilho só — o botão de interação —, em todo modo de entrada.
 *
 *   1. mãos livres + objeto ao alcance → pega
 *   2. carregando + direção segurada   → arremessa, se a classe permitir
 *   3. carregando, sem direção         → solta, se a classe permitir
 *
 * ⚠️ O "NÃO PISAR NO SOLO" SAIU JUNTO com o roteamento pelo pulo. Ele existia para separar o primeiro toque
 * (pular) do segundo (jogar) num botão que fazia as duas coisas; num botão que só interage não há dois
 * toques para separar, e exigi-lo seria dificuldade inventada.
 */
export function acaoDeCarga(ctx: ContextoDeCarga): AcaoDeCarga {
  if (!ctx.bordaDeInteracao) return 'nada';
  if (ctx.carregando) {
    // O que está na mão decide o que é permitido. Com lixo, os dois são 'não' — e o botão simplesmente não
    // responde, que é o silêncio certo: nada é tirado dela, ela só não tem essa saída.
    const pode = ctx.tipoDaCarga ? PODE[ctx.tipoDaCarga] : { soltar: true, arremessar: true };
    if (ctx.direcao === 0) return pode.soltar ? 'soltar' : 'nada';
    return pode.arremessar ? 'arremessar' : 'nada';
  }
  return ctx.objetoPerto ? 'pegar' : 'nada';
}
