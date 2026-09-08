// SPDX-License-Identifier: AGPL-3.0-or-later
// input/transporte-em-uso — A ALTERNÂNCIA SEGUE O APARELHO EM USO (ADR-0109), na metade pura.
//
// ========================= O QUE ESTE MÓDULO É =========================
// O autómato das quatro regras do ADR-0109 §1, sem DOM, sem armazenamento e sem eventos. Recebe ARESTAS com
// origem e devolve estado; quem pergunta «há alternância agora?» pergunta ao estado.
//
//   1. Por padrão, controle e teclado, ambos SEM alternância.
//   2. Clique de mouse ou toque na tela → controles de tela COM alternância.
//   3. Apertar tecla devolve o teclado SEM alternância; usar o controle faz o mesmo.
//   4. Câmera e microfone precisam ser habilitados; habilitados, ligam a alternância em TODOS os outros
//      controles, SEM possibilidade de desligar. São prioridade.
//
// ⚠️ POR QUE ISTO É UM AUTÓMATO E NÃO UM VALOR GUARDADO — e é o que o ADR-0109 supersede do ADR-0104 §C. A
// alternância era uma ESCOLHA guardada por transporte, e a issue #114 mediu que a fiação dela não era
// escrevível: a origem da aresta é apagada à porta (`input/state.keys` é `Set<string>` de CÓDIGOS, e o toque
// e a webcam escrevem lá dentro). O Dev decidiu o COMPORTAMENTO, e o comportamento escolhe o mecanismo.
//
// ⚠️ E A REGRA 3 É A RAZÃO DE PRECISAR DE DUAS COISAS, não de uma. «Apertar uma tecla devolve o teclado sem
// alternância» são DOIS factos: um EVENTO cuja origem tem de ser conhecida, e um MODO que persiste até à
// troca seguinte. Uma aresta não guarda estado; um modo guardado não detecta a própria troca. Nenhuma metade
// exprime a regra; juntas exprimem. Este ficheiro é a segunda metade — o MODO.
//
// 📌 A imagem do Dev, mantida porque diz a coisa: é um CAPS-LOCK NUM TECLADO COM MEMÓRIA. Modo e não estado
// momentâneo; lembrado por aparelho; trocar de aparelho não apaga o que o outro lembra.

/** Os aparelhos por onde uma criança joga. Fechado: um transporte novo tem de decidir a sua regra aqui. */
export type Transporte = 'teclado' | 'gamepad' | 'toque' | 'olhos' | 'rosto' | 'gestos' | 'fala';

/**
 * OS QUATRO QUE EXIGEM HABILITAÇÃO EXPLÍCITA e, uma vez habilitados, mandam em todos (regra 4).
 *
 * ⚠️ É a mesma lista do `UM_COMANDO_DE_CADA_VEZ` do `input/latch-scope`, e a coincidência não é acaso: são
 * os transportes de quem NÃO CONSEGUE SEGURAR NADA. O que o ADR-0109 acrescenta é que eles não ligam a
 * alternância só para si — ligam-na para o resto, porque quem usa a webcam pode também tocar na tela, e uma
 * alternância que se desliga ao mudar de aparelho é uma armadilha para exactamente essa pessoa.
 */
export const EXIGEM_HABILITACAO: ReadonlySet<Transporte> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/** O transporte que liga a alternância por si só, sem prioridade nenhuma envolvida (regra 2). */
export const COM_ALTERNANCIA_PROPRIA: ReadonlySet<Transporte> = new Set(['toque']);

export interface EstadoDaEntrada {
  /** Qual aparelho está a ser usado AGORA por este jogador. */
  readonly emUso: Transporte;
  /**
   * A câmera/microfone foi habilitada? ⚠️ Uma vez `true`, NUNCA volta a `false` por uma aresta — só uma
   * decisão explícita a desliga, e o ADR-0109 §4 diz que a criança não tem essa decisão. Ver `desabilitar`.
   */
  readonly assistidaLigada: boolean;
}

/**
 * O ESTADO INICIAL: teclado, sem alternância.
 *
 * ⚠️ A regra 1 diz «controle E teclado, ambos sem alternância», e é por isso que o padrão pode nomear um só
 * sem mentir: entre os dois a resposta à única pergunta que este módulo faz — há alternância? — é a MESMA.
 * O `emUso` só passa a distingui-los quando alguém quiser MOSTRAR o aparelho corrente, que é outra questão
 * e o ADR-0109 deixa-a explicitamente por decidir.
 */
export const PADRAO: EstadoDaEntrada = Object.freeze({ emUso: 'teclado', assistidaLigada: false });

/**
 * HÁ ALTERNÂNCIA AGORA?
 *
 * ⚠️ A prioridade da assistida vem PRIMEIRO, e a ordem é a regra 4 inteira: enquanto ela estiver ligada,
 * nenhum outro aparelho a desliga — nem o teclado, que noutro caso a desligaria. Inverter estas duas linhas
 * é o defeito que trancaria uma criança fora do próprio jogo, e é silencioso.
 */
export function alternanciaAgora(estado: EstadoDaEntrada): boolean {
  if (estado.assistidaLigada) return true;
  return COM_ALTERNANCIA_PROPRIA.has(estado.emUso);
}

/**
 * UMA ARESTA CHEGOU, com a sua origem. Devolve o estado NOVO.
 *
 * ⚠️ Uma aresta de um transporte assistido NÃO o habilita. Habilitar é um acto explícito (regra 4: «precisam
 * ser habilitados»), e deixar uma aresta fazê-lo significaria que um falso positivo da webcam — uma sombra,
 * um segundo rosto a passar — trancava a alternância de toda a gente sem ninguém ter pedido.
 */
export function aposAresta(estado: EstadoDaEntrada, origem: Transporte): EstadoDaEntrada {
  if (estado.emUso === origem) return estado; // sem mudança: devolve o MESMO objecto, não uma cópia
  return { emUso: origem, assistidaLigada: estado.assistidaLigada };
}

/** A criança (ou quem a acompanha) habilitou câmera/microfone. Daqui em diante a alternância é lei. */
export function habilitarAssistida(estado: EstadoDaEntrada): EstadoDaEntrada {
  return estado.assistidaLigada ? estado : { emUso: estado.emUso, assistidaLigada: true };
}

/**
 * DESABILITAR a assistida. Existe, e o ADR-0109 diz de quem é: NÃO é da criança durante a partida.
 *
 * ⚠️ Fica exportada porque desligar a câmera tem de ser possível em algum lugar — trocar de utilizador,
 * fechar o jogo, um adulto a reconfigurar. O que o §4 proíbe é oferecê-la como um botão ao lado do jogo.
 * Uma função que existe e não é oferecida é diferente de uma função que não existe: a primeira diz onde a
 * decisão mora.
 */
export function desabilitarAssistida(estado: EstadoDaEntrada): EstadoDaEntrada {
  return estado.assistidaLigada ? { emUso: estado.emUso, assistidaLigada: false } : estado;
}
