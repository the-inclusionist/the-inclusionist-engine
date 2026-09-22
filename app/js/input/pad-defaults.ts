// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-defaults.ts — O MAPA DE BOTÕES QUE ESTE JOGO QUER, por arranjo e por assento (ADR-0115).
//
// ========================= POR QUE É UM MÓDULO E NÃO UMA LINHA NO `input/gamepad` =========================
// Quem REGISTA e quem LÊ estão em lados diferentes da montagem, e essa é a razão inteira:
//
//   · quem regista é o `boot/create-game`, a partir da declaração do jogo;
//   · quem lê é o `input/gamepad`, que o `createGame` **não** monta — o cartucho é que chama `initGamepad`.
//
// 📏 Medido em 2026-09-09: `createGame` inicia i18n, mixer, painel, ícones, teclado, navegação e armadilha de
// foco, e NÃO inicia gamepad, toque nem `keydown`. Pôr o registo dentro do `input/gamepad` obrigaria o
// cartucho a passá-lo, que é a coisa que um cartucho esquece — e esquecê-lo devolve o mapa da ENGINE a um jogo
// que declarou outro, em silêncio.
//
// ⚠️ E A PRECEDÊNCIA É A MESMA DO TECLADO, com uma diferença de sítio que vale escrever: no controle, o
// remapeamento da CRIANÇA não é uma camada por cima desta tabela — é um RAMO inteiro do `padActions` (o mapa
// que o assistente gravou para aquele `gp.id`). Logo o padrão do jogo só decide quando ela não remapeou nada,
// que é exactamente o que «padrão» quer dizer.
//
// 📌 FÁBRICA DA ENGINE → PADRÃO DO JOGO → REMAPEAMENTO DA CRIANÇA. A mesma frase do `input/keyboard`.
import type { Action } from '../core/actions.js';
import { GAMEPAD_STANDARD, type Binding } from './default-bindings.js';

/** O que o jogo declara: só o que ele quer mudar. `null` num botão é «esta posição não existe neste jogo». */
export type PadMapping = (jogadores: number, assento: number) => Partial<Record<Action, number | null>> | null;

export type PadTable = Readonly<Record<Action, Binding<number>>>;

let mapeamentoDoJogo: PadMapping | null = null;
const memo = new Map<string, PadTable>();

/**
 * REGISTA O PADRÃO DO JOGO. Chamado uma vez pelo arranque; `null` limpa (é o que um jogo sem opinião produz).
 *
 * ⚠️ LIMPA A MEMÓRIA, e sem esta linha o registo seria pior do que não existir: uma segunda montagem — outro
 * jogo na mesma página, um teste a seguir a outro — leria a tabela do jogo anterior, e a leitura estaria
 * certa em toda parte menos no valor.
 */
export function registerPadMapping(f: PadMapping | null): void {
  mapeamentoDoJogo = f;
  memo.clear();
}

/**
 * A TABELA DE BOTÕES PARA ESTE ARRANJO E ESTE ASSENTO — fábrica da engine com o padrão do jogo por cima.
 *
 * 📌 MEMOIZADA porque isto é lido no laço de sondagem, uma vez por controle e por quadro: fundir dois objectos
 * sessenta vezes por segundo por jogador é lixo que nenhuma criança vê e que o coletor paga. A chave é
 * `arranjo:assento`, e o registo limpa-a — que é o único momento em que a resposta pode mudar.
 */
export function padTable(jogadores: number, assento: number): PadTable {
  if (!mapeamentoDoJogo) return GAMEPAD_STANDARD;
  const chave = `${jogadores}:${assento}`;
  const guardada = memo.get(chave);
  if (guardada) return guardada;
  const parcial = mapeamentoDoJogo(jogadores, assento);
  const tabela: PadTable = parcial ? Object.freeze({ ...GAMEPAD_STANDARD, ...parcial }) : GAMEPAD_STANDARD;
  memo.set(chave, tabela);
  return tabela;
}
