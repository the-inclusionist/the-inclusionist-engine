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
// "Caso tenha um objeto que possa segurar e apertou o botão de pulo com o toggle habilitado, o botão de pulo
// fará com que o personagem segure/carregue o objeto e jogue apertando o botão de pulo duas vezes (pois o
// contexto para jogar o objeto fora com esta opção ligada é não estar pisando no solo)."
//
// ⚠️ E ISSO CUSTA UMA COISA, dita aqui para ninguém descobrir na tela: com a alternância ligada e um objeto
// por perto, o pulo PEGA em vez de pular. É consequência direta do contrato e é escolha do Dev — mas quem
// for mexer precisa saber que foi escolhida, e não esquecida.
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
// ORDEM COM O GRUDE: `pularVaiGrudar` (game/run-toggle) decide primeiro. Grudar na parede exige estar no ar,
// encostado e com o poder de aranha; se esse contexto vale, a borda de pulo é dele. Só o que sobra chega aqui.

/** A fatia do jogador que a decisão lê. */
export interface JogadorDeCarga {
  /** A alternância do botão de correr está ligada? É ela que move o gatilho do Correr para o Pulo. */
  toggleRun?: boolean;
}

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
  noChao: boolean;
  bordaDePulo: boolean;
  bordaDeCorrer: boolean;
  /** A direção SEGURADA no instante do botão: -1 esquerda, +1 direita, 0 nenhuma. É ela que separa
   *  ARREMESSAR de SOLTAR (ver `acaoDeCarga`). */
  direcao: -1 | 0 | 1;
  /** O que está na mão, se há algo. É ele que decide o que é permitido (ver `PODE`). */
  tipoDaCarga: TipoDeCarga | null;
}

export type AcaoDeCarga = 'pegar' | 'arremessar' | 'soltar' | 'nada';

/**
 * O que este quadro faz com a carga.
 *
 * COM a alternância, tudo mora no PULO, e a ordem é a decisão:
 *   1. carregando NO AR   → arremessa (o segundo dos "dois toques")
 *   2. carregando NO CHÃO → nada: o pulo é pulo, e é o PRIMEIRO dos dois toques. Arremessar aqui faria a
 *      criança perder o objeto toda vez que tentasse pular com ele.
 *   3. objeto perto       → pega
 *
 * SEM a alternância, tudo mora no CORRER — que é quem tem a borda livre fora do contexto de grudar. E ali
 * arremessar NÃO exige estar no ar: a regra do "não pisar no solo" existe para separar os dois toques do
 * pulo, e no Correr não há dois toques para separar. Exigi-lo seria dificuldade inventada.
 *
 * QUEM NÃO LIGA O AJUSTE NÃO PERDE NADA: sem `toggleRun`, a borda de pulo não pega nem arremessa. Mesma
 * regra do grude, e pelo mesmo motivo — um ajuste de acessibilidade que muda o jogo de quem não pediu por
 * ele é um ajuste que a professora desliga na primeira aula.
 */
export function acaoDeCarga(pl: JogadorDeCarga, ctx: ContextoDeCarga): AcaoDeCarga {
  const borda = pl.toggleRun ? ctx.bordaDePulo : ctx.bordaDeCorrer;
  if (!borda) return 'nada';
  if (ctx.carregando) {
    // O "não pisar no solo" é do PULO, e só dele: é o que separa o primeiro toque (pular) do segundo (jogar).
    if (pl.toggleRun && ctx.noChao) return 'nada';
    // O que está na mão decide o que é permitido. Com lixo, os dois são 'não' — e o botão simplesmente não
    // responde, que é o silêncio certo: nada é tirado dela, ela só não tem essa saída.
    const pode = ctx.tipoDaCarga ? PODE[ctx.tipoDaCarga] : { soltar: true, arremessar: true };
    if (ctx.direcao === 0) return pode.soltar ? 'soltar' : 'nada';
    return pode.arremessar ? 'arremessar' : 'nada';
  }
  return ctx.objetoPerto ? 'pegar' : 'nada';
}
