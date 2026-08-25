// SPDX-License-Identifier: AGPL-3.0-or-later
// game/entity — o que ESTE JOGO acrescenta ao jogador da engine (ADR-0033).
//
// ========================= POR QUE ESTE ARQUIVO EXISTE =========================
// `core/entity.Player` é a entidade canônica da ENGINE, e o ADR-0033 fixou a regra que ela obedece:
//
//     A entidade da engine pode declarar o que a ENGINE possui. Não pode declarar o que o JOGO possui.
//
// O campo `quiz` era a única exceção. Dos onze campos que `input/keydown` pedia do jogador, dez eram
// conceitos da engine — identidade, esquema de teclas, tela em espera, modo Fácil, os seis flags de borda —
// e um nomeava conteúdo do jogo. A camada de entrada precisou dele por muito tempo porque ELA roteava a tecla
// para dentro do desafio; deixou de precisar quando passou a entregar uma INTENÇÃO e deixar o jogo decidir.
//
// Sobrou quem legitimamente precisa: `game/physics` (quem está em desafio não corre), `game/session` (só abre
// um desafio se não houver outro) e `game/quiz` (o dono). Os três são do jogo. O campo veio com eles.
//
// ========================= A FORMA, E POR QUE NÃO É UM SEGUNDO `Player` =========================
// `GamePlayer` ESTENDE `Player` em vez de o substituir: o jogador é o mesmo objeto em memória, e a engine
// continua vendo dele a fatia que declara. O que muda é quem pode PEDIR o campo — `PlayerView<'quiz'>` não
// compila mais, e é essa impossibilidade que faz a regra valer sem depender de disciplina.
import type { Player, ControlledPlayer } from '../core/entity.js';

/**
 * O mínimo que qualquer camada DO JOGO precisa saber de um desafio aberto. Todas as cinco variantes de `Quiz`
 * (game/quiz) satisfazem isto por construção: `kind` é o discriminante da união e `coinIndex`/`revealed` vêm
 * de `QuizCommon`. Quem precisa do quiz de verdade — só game/quiz — usa a união, não isto.
 *
 * Estava em `core/entity` como `PlayerQuiz`. O tipo não mudou; mudou de lado da fronteira.
 */
export interface PlayerQuiz {
  kind: string;
  coinIndex: number;
  revealed: boolean;
}

/** O jogador COM o que este jogo acrescenta. */
export interface GamePlayer extends Player {
  /** Desafio aberto, ou `null`. `game/quiz` estreita isto para a união `Quiz`. */
  quiz: PlayerQuiz | null;
}

/**
 * Fatia mínima do jogador DO JOGO — o `PlayerView` de `core/entity`, um degrau adiante.
 *
 * Mesma regra e mesmo motivo: cada módulo declara só o que toca, e um módulo que peça mais do que usa é um
 * módulo que não se move sozinho depois.
 */
export type GamePlayerView<K extends keyof GamePlayer> = Pick<GamePlayer, K>;

/** `ControlledPlayer` (jogador + esquema de teclas) com o que este jogo acrescenta. */
export type ControlledGamePlayer = ControlledPlayer & GamePlayer;
