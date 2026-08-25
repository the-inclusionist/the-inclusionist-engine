// SPDX-License-Identifier: AGPL-3.0-or-later
// core/screens — a grade de telas do multiplayer, num só lugar.
//
// O jogo divide a janela em uma tela por jogador (pilar: multiplayer em telas SEPARADAS, sem split-screen —
// ADR-0010). Quantas colunas e quantas linhas isso dá era uma conta de uma linha copiada em CINCO lugares:
// ui/layout.ts (escala inteira), render/crt.ts (só as linhas, para o passo do scanline), ui/hud.ts (posição
// de cada `.player-screen`), e no game.js em configureRender() e fitsN().
//
// A quinta cópia estava DIVERGENTE: `cols = n<=2 ? n : 2`, sem a guarda de `n<=1`. Para n>=1 as duas contas
// concordam, então a divergência nunca chegou a aparecer — com n=0 uma devolve 1 e a outra devolve 0, e
// dividir por 0 colunas daria NaN em toda a geometria. Vale a pena guardar essa história: a cópia errada
// sobreviveu justamente porque o caso onde ela erra é inalcançável hoje, e não porque alguém a conferiu.
//
// Módulo FOLHA de propósito: zero dependências, nem de estado. `n` é parâmetro, nunca `numPlayers` global —
// é isso que deixa a conta testável e que permite o render, o layout e o HUD importarem daqui sem que um
// passe a depender do outro.

/** Colunas e linhas da grade para `n` telas. */
export interface ScreenGrid { cols: number; rows: number }

/**
 * A grade para `n` jogadores: 1 -> 1x1 · 2 -> 2x1 · 3 e 4 -> 2x2.
 * `n` menor que 1 devolve a grade de uma tela, e não zero colunas.
 */
export function screenGrid(n: number): ScreenGrid {
  return { cols: n <= 1 ? 1 : (n <= 2 ? n : 2), rows: n <= 2 ? 1 : 2 };
}

/** Dimensões em pixels de arte da grade de `n` telas (320x180 por tela — o pixel canônico do ADR-0010). */
export function screenBaseSize(n: number): { w: number; h: number } {
  const { cols, rows } = screenGrid(n);
  return { w: 320 * cols, h: 180 * rows };
}
