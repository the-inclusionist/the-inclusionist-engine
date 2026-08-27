// SPDX-License-Identifier: AGPL-3.0-or-later
// game/run-toggle — A ALTERNÂNCIA DO BOTÃO DE CORRER, e o que ela desloca.
//
// ========================= O PROBLEMA =========================
// A alternância de MOVIMENTO resolvia metade: "para quem não consegue manter pressionado (1 dedo): toque a
// direção para andar sem segurar". Metade, porque o botão de CORRER continuava exigindo exatamente o que ela
// dispensa — manter pressionado. Quem toca com um dedo andava sem segurar e não corria.
//
// Com esta alternância, correr vira ESTADO: a borda do botão liga, a borda seguinte desliga.
//
// ========================= O QUE ISSO TIRA DO BOTÃO, E PARA ONDE VAI =========================
// A BORDA do Correr era o que gruda e solta na parede com o poder de aranha (`updateCling`). Se ela passa a
// significar "liga/desliga corrida", grudar precisa de outra porta.
//
// A porta é o PULO EM CONTEXTO: no ar, encostado numa parede, com o poder de aranha. E a escolha do contexto
// não é arbitrária — nesse instante PULAR não tem o que fazer de útil (o pulo aéreo já está gasto), então o
// botão está ocioso e pode receber a função sem tirar nada de ninguém. Fora desse contexto o pulo pula.
//
// ⚠️ QUEM NÃO LIGA O AJUSTE NÃO PERDE NADA. `pularVaiGrudar` devolve `false` sem `toggleRun`, e grudar
// continua sendo do Correr. Um ajuste de acessibilidade que muda o jogo de quem não pediu por ele é um ajuste
// que a professora desliga na primeira aula.
//
// ========================= O QUE NÃO ESTÁ AQUI =========================
// O Dev descreveu também o objeto que se segura e se arremessa com o pulo. Esse mecanismo NÃO EXISTE no jogo
// — não há pegar, carregar nem arremessar em lugar nenhum. O contrato está registrado em issue; este módulo
// implementa o que dá para verificar hoje.

/** A fatia do jogador que as duas decisões leem. Estrutural: o teste monta um objeto literal. */
export interface JogadorDaCorrida {
  /** A alternância do correr está ligada para este jogador? */
  toggleRun?: boolean;
  /** A trava: com `toggleRun`, é ela que diz se está correndo. */
  runLatch?: boolean;
  /** Modo Fácil — não corre, por decisão pedagógica. */
  easy?: boolean;
  /** Alternância de MOVIMENTO: com ela, segurar é "ir mais rápido" e não corrida. */
  toggleMove?: boolean;
}

/** O contexto do quadro que decide se este pulo gruda. */
export interface ContextoDeGrude {
  noAr: boolean;
  /** Há parede grudável do lado? */
  encostado: boolean;
  temAranha: boolean;
  jaGrudado: boolean;
}

/**
 * Está correndo NESTE quadro?
 *
 * A inversão é o ponto: quem usa a alternância não consegue manter pressionado, então "está segurando?" não
 * pode ser a pergunta — o que vale é a trava. Sem a alternância, nada muda: continua sendo segurar.
 *
 * `easy` e `toggleMove` continuam vencendo os dois caminhos, e isso é preservação e não zelo: as duas regras
 * já existiam em `stepPlayer` e desligar a corrida é o ponto delas. Uma trava que as furasse pela porta dos
 * fundos daria à criança do Modo Fácil uma velocidade que o modo existe para não ter.
 */
export function correndoAgora(pl: JogadorDaCorrida, segurando: boolean): boolean {
  if (pl.easy || pl.toggleMove) return false;
  return pl.toggleRun ? !!pl.runLatch : segurando;
}

/**
 * Este pulo vai GRUDAR (ou soltar) em vez de pular?
 *
 * Só com a alternância ligada, e só no contexto em que o pulo estaria ocioso. O ramo do `jaGrudado` é o que
 * impede o modo de virar armadilha: sem ele a criança gruda e não tem como descer, porque o botão que soltava
 * agora significa outra coisa — exatamente o tipo de beco que o ADR-0044 passou sete itens desfazendo.
 */
export function pularVaiGrudar(pl: JogadorDaCorrida, ctx: ContextoDeGrude): boolean {
  if (!pl.toggleRun || !ctx.temAranha) return false;
  if (ctx.jaGrudado) return true;                       // soltar tem de caber sempre
  return ctx.noAr && ctx.encostado;
}
