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
 * ESTE JOGADOR USA A TRAVA no botão de correr, em vez de segurar?
 *
 * A regra é do ADR-0033, na formulação corrigida pelo Dev em 2026-08-27, e ela é INVERTIDA de propósito:
 * SEGURAR é a exceção, válida só no modo padrão com teclado ou gamepad. Todo outro modo de entrada recebe a
 * trava automaticamente — teclas de alternância, rosto, olhos, voz, tela de toque.
 *
 * Hoje isso são dois campos, e os dois estão aqui em vez de espalhados: `toggleRun` (a alternância explícita,
 * automática no emulador de toque) e `toggleMove` (teclas de alternância). Rosto, olhos e voz são a issue #11
 * e entram AQUI quando existirem — uma linha, num lugar só, que é o motivo de esta função existir em vez de
 * `pl.toggleRun` aparecer em cinco pontos.
 *
 * ⚠️ POR QUE `toggleMove` ENTROU, e a razão é dele: "Teclas de alternância não é só para quem tem rigidez nas
 * mãos e perde agilidade e destreza, mas para quem tem um ou mais dedos a menos e não consegue manter apertado
 * três botões ao mesmo tempo." Quem não tem dedos para segurar três botões não tem dedos para segurar o Correr.
 */
export function usaTravaDeCorrer(pl: JogadorDaCorrida): boolean {
  return !!pl.toggleRun || !!pl.toggleMove;
}

/**
 * O BOTÃO DE CORRER ESTÁ ENGATADO? — e esta pergunta NÃO é "está correndo".
 *
 * A diferença nasceu de uma regressão minha. Parado, SEGURAR o Correr é a sondagem da bengala no modo cego:
 * é assim que a criança varre o que está em volta sem andar. Com a alternância ligada ela nunca segura — ela
 * toca —, e a sondagem sumiria justamente para quem depende dela.
 *
 * E não dava para reusar `correndoAgora`: `easy` e `toggleMove` desligam a CORRIDA, e não podem desligar o
 * TATO. Usá-la aqui teria sido o conserto óbvio e teria calado a bengala de toda criança em Modo Fácil ou
 * alternância de movimento — que hoje podem sondar.
 *
 * Então são duas perguntas: esta (o botão está engatado?) e a de baixo (isso resulta em correr?).
 */
export function botaoDeCorrerEngatado(pl: JogadorDaCorrida, segurando: boolean): boolean {
  return usaTravaDeCorrer(pl) ? !!pl.runLatch : segurando;
}

/**
 * Está correndo NESTE quadro? É o botão engatado, menos o Modo Fácil.
 *
 * ⚠️ `toggleMove` SAIU DESTA LISTA EM 2026-08-27, e a mudança é do Dev. Até então, teclas de alternância
 * desligava a corrida inteira — segurar a direção já significava "ir mais rápido", e a corrida era considerada
 * substituída por isso. Ele decidiu o contrário, e com uma frase que corrige a premissa: "Aperta o botão de
 * corrida uma vez, liga a corrida, aperta outra vez volta a andar."
 *
 * O motivo é quem usa o modo. Teclas de alternância não é só para quem tem rigidez e perde destreza — é também
 * para quem tem um ou mais dedos a menos. Tirar a corrida dessa criança não é simplificar o controle dela; é
 * dar-lhe um jogo mais lento que o das outras, e chamar isso de acessibilidade.
 *
 * `easy` continua vencendo, e agora é o ÚNICO que vence: ele desliga a corrida por decisão pedagógica, e o
 * ponto do modo é não ter essa velocidade. Uma trava que o furasse pela porta dos fundos desfaria o modo.
 */
export function correndoAgora(pl: JogadorDaCorrida, segurando: boolean): boolean {
  if (pl.easy) return false;
  return botaoDeCorrerEngatado(pl, segurando);
}

/**
 * Este pulo vai GRUDAR (ou soltar) em vez de pular?
 *
 * Só com a alternância ligada, e só no contexto em que o pulo estaria ocioso. O ramo do `jaGrudado` é o que
 * impede o modo de virar armadilha: sem ele a criança gruda e não tem como descer, porque o botão que soltava
 * agora significa outra coisa — exatamente o tipo de beco que o ADR-0044 passou sete itens desfazendo.
 */

/* ===================== `pularVaiGrudar` E `botaoDeGrude` FORAM EMBORA (2026-08-28) =====================
 *
 * As duas nasceram do contrato de 27/08: com a alternância ligada, a borda do Correr virava a trava da
 * corrida, então GRUDAR na parede passava para o pulo em contexto, e a frase falada tinha de nomear o botão
 * certo em cada caso. O Dev revogou o contrato inteiro — "botão de interação continua sendo botão de
 * interação [...] o que muda é que a parte de correr vira toggle" —, e depois viu na tela o resquício:
 * "climb está funcionando não somente apertando o botão de contexto na parede, mas também o botão de pulo.
 * O correto é só o primeiro caso."
 *
 * Sem a bifurcação não há o que decidir: grudar é sempre o botão de interação, e a frase falada nomeia
 * sempre `act.run`. Duas funções provadas, gateadas e corretas que deixaram de ter pergunta — o que se
 * apaga aqui é a pergunta, não a resposta.
 *
 * ⚠️ E O QUE FICA NO LUGAR É A REGRA GERAL: o botão de interação age POR CONTEXTO. Encostado numa parede com
 * a ventosa, o contexto é grudar; perto de um objeto, é pegar; sem contexto nenhum, ele alterna a corrida.
 * O pulo pula, sempre. `usaTravaDeCorrer` e `correndoAgora` continuam — a alternância da CORRIDA é o que o
 * ajuste sempre foi, e é só isso que ele é. */
