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
    return ctx.direcao === 0 ? 'soltar' : 'arremessar';
  }
  return ctx.objetoPerto ? 'pegar' : 'nada';
}
