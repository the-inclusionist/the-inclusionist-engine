// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-edge.ts — A ARESTA E A ALTERNÂNCIA, NUMA FUNÇÃO SÓ (ADR-0113, issue #127).
//
// ========================= POR QUE O PAR NÃO PODE SEPARAR-SE =========================
// Registar de que aparelho veio a aresta e resolver a alternância desse aparelho são duas metades de UM
// acontecimento: a criança mudou de controle. Feitas em sítios diferentes, a segunda pode faltar — e o
// resultado é a forma de defeito que este projecto já pagou várias vezes: o autómato sabe que ela pegou no
// controle, e o jogo continua a andar com a alternância do teclado. Sem erro, e só ela dá por isso.
//
// 📌 É o mesmo movimento do `consumir` no `ui/menu-nav` («uma função só para o par nunca se separar») e da
// escrita dupla no `ui/settings-mobility`.
//
// ⚠️ E É UMA FÁBRICA, NÃO UM CAMPO NOVO NO CONTEXTO DE CADA MÓDULO DE ENTRADA. O `input/keydown` e o
// `input/touch-bindings` já recebem `playerEdge(jogador, origem)`; esta função devolve uma com essa
// mesma assinatura, e por isso a fiação passa a estar certa sem nenhum dos dois saber que a alternância
// existe. Um segundo campo obrigatório em dois contextos seria mais superfície pública, mais uma coisa que um
// cartucho pode esquecer, e a mesma pergunta feita duas vezes.
import * as store from '../platform/storage.js';
import { DEFAULTS } from '../core/state.js';
import { playerEdge, inputOf } from './state.js';
import { syncLatch, type LatchPlayer } from './latch-sync.js';
import type { LatchStore } from './latch-store.js';
import type { TransportName } from './transport-in-use.js';

export interface LatchedEdgeOptions {
  /**
   * O armazenamento. Injectável **para o gate**, e com padrão para o consumidor não poder esquecê-lo.
   *
   * ⚠️ Padrão e não campo obrigatório, e a razão é a mesma do `ui/pause-icons`: um armazém injectado é uma
   * coisa que um cartucho pode omitir, e omiti-la faria a criança perder a escolha guardada — em silêncio, e
   * só naquele jogo.
   */
  readonly store?: LatchStore;
  /** O padrão de fábrica. `DEFAULTS.toggleMove`, e não `false` escrito à mão: há UMA fonte (ADR-0029). */
  readonly padrao?: boolean;
}

/**
 * DEVOLVE O `playerEdge` QUE TAMBÉM RESOLVE A ALTERNÂNCIA — para passar a `initKeydown` e a
 * `initTouchBindings` no lugar do cru.
 *
 * ⚠️ RESOLVE CONTRA `inputOf(jogador).inUse` E NÃO CONTRA `origin`, e a distinção é de desenho e não de
 * comportamento: hoje o `afterEdge` põe sempre `emUso = origem`, logo trocar uma pela outra é uma mutação
 * EQUIVALENTE — está registada como tal no gate, em vez de fingir cobertura. O que a escolha compra é o
 * futuro: quem decide que aparelho está em uso é o autómato, e o dia em que ele ganhar uma regra que RECUSE
 * uma aresta (um falso positivo da webcam a ser filtrado, por exemplo) esta linha segue-o sem ser editada.
 * Ler `origin` seria uma segunda resposta à pergunta que o `input/transport-in-use` existe para responder.
 */
export function createLatchedEdge(
  getPlayers: () => readonly (LatchPlayer | null | undefined)[],
  opts: LatchedEdgeOptions = {},
): (jogador: number, origin: TransportName) => void {
  const latchStore = opts.store ?? store;
  const padrao = opts.padrao ?? DEFAULTS.toggleMove;
  return (jogador: number, origin: TransportName): void => {
    playerEdge(jogador, origin);
    // 📌 O JOGADOR PODE NÃO EXISTIR — uma tela em espera, um assento que ainda não entrou —, e isso não torna
    // a aresta inválida: o transporte em uso é facto sobre a ENTRADA e fica registado à mesma. O que não
    // acontece é a segunda metade, porque não há onde a escrever.
    const p = getPlayers()[jogador];
    if (p) syncLatch(p, latchStore, jogador, inputOf(jogador).inUse, padrao);
  };
}
