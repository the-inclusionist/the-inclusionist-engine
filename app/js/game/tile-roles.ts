// SPDX-License-Identifier: GPL-3.0-or-later
// game/tile-roles — O QUE CADA TILE SIGNIFICA PARA A ACESSIBILIDADE, e por que isto é do JOGO.
//
// ========================= O ACOPLAMENTO Nº 1 DO ADR-0027 =========================
// O registro nomeia esta tabela como o caso mais grave da base, e vale citar ao pé da letra:
//
//   "as três funções que MAIS parecem genéricas são as três mais acopladas ao jogo de plataforma.
//    `roleOf(t)` em render/high-contrast.ts é uma tabela fixa de tiles (9 perigo, 4|5|10 escalável, 3 água)
//    da qual TODO o alto contraste depende."
//
// Quatro linhas, e delas dependia a repintura inteira do mundo em alto contraste — o subsistema que existe
// para a criança de baixa visão. Elas moravam DENTRO do `render/high-contrast`, o que dizia, na estrutura,
// que "perigo é o tile 9" era uma verdade da ENGINE. Não é. É uma verdade DESTE MAPA: um segundo jogo de
// plataforma com outra numeração já quebrava, sem erro de tipo, sem teste vermelho — o alto contraste
// simplesmente pintaria o chão de laranja e a lava de cinza, para quem menos pode conferir isso na tela.
//
// ========================= POR QUE MUDA AGORA, E SEM DECIDIR O EIXO =========================
// O corte da engine (por gênero · por subsistema · por contrato declarado) ainda é decisão do Dev, e ESTA
// mudança não a antecipa — ela é o prefixo comum de todas:
//   · por GÊNERO: quem passa a tabela é `engine-platform`; o alto contraste, que serve a qualquer gênero, a recebe.
//   · por CONTRATO declarado: papel por célula é o campo 2 dos sete; o alto contraste lê a declaração.
//   · tilemap em CAMADAS ou célula-registro: o papel passa a vir do mapa; o alto contraste recebe a consulta.
// Nas três, quem NÃO define a tabela é o `render/high-contrast`. É só isso que este arquivo faz.
//
// ========================= O QUE AINDA NÃO SE RESOLVEU =========================
// Sobra um `t === 4` no meio do repinte: a ESCADA é desenhada com trilhos e degraus em vez de faixa sólida,
// porque uma faixa verde sólida não LÊ como escada. A decisão é de acessibilidade e serve a qualquer jogo com
// algo escalável — mas a forma da pergunta injetada ("este tile se desenha como escada?" ou "que pintor este
// papel usa?") ainda não tem evidência que a escolha. Foi um consumidor que mostrou, no `menu-nav`, que
// `getPhase()` e `isNavigable()` não eram a mesma coisa; sem um segundo jogo com algo escalável, escolher aqui
// seria chutar. Fica declarado em vez de adivinhado.

import type { PaintableRole } from '../render/hc-role-data.js';
import { ehPerigo, ehAgua, ehEscada, ehTrampolim, ehPortao } from '../core/constants.js';

/**
 * Tile → papel semântico. `null` = ESTRUTURA (pedra, parede, ar): não recebe repintura, fica no cinza-azulado
 * do nível, e é esse contraste entre "estrutura" e "coisa que faz algo" que o color-blocking constrói.
 *
 * ⚠️ `t === 10` (portão) não chega aqui na prática: o boot do main.js tira o tile 10 da grade (vira MAP_GATE
 * mais ar). A linha fica porque é VERBATIM do original, e apagá-la seria uma mudança de comportamento
 * escondida dentro de uma mudança de lugar.
 */
export function roleOf(t: number): PaintableRole | null {
  if (ehPerigo(t)) return 'hazard';
  // ESCADA, TRAMPOLIM e PORTÃO dividem o ciano, e a linha agora diz POR QUÊ em vez de listar 4, 5 e 10: os
  // três são coisas com que se INTERAGE para mudar de altura. Um trampolim não se escala no sentido literal,
  // mas para o color-blocking ele pertence ao mesmo grupo — e essa é uma decisão de acessibilidade que
  // merecia estar escrita, não codificada em três números.
  if (ehEscada(t) || ehTrampolim(t) || ehPortao(t)) return 'climb';
  if (ehAgua(t)) return 'water';
  return null;
}
