// SPDX-License-Identifier: AGPL-3.0-or-later
// core/loop.ts — driver do loop de jogo. Registra a função de frame num "ticker" (o app.ticker do PixiJS, ou
// qualquer objeto com .add(fn) e .deltaTime) e passa o dt CLAMPADO (evita saltos gigantes após a aba ficar em
// segundo plano). Módulo-folha. Mantém a cadência ATUAL (não muda o timing) — o fixed-timestep determinístico
// fica para depois, pois mudaria a física.
//
// ========================= O BOUNDARY DE ERRO (D16), E POR QUE ELE FALHA ALTO =========================
// Sem ele, um quadro que lança lança OUTRA VEZ no quadro seguinte, para sempre: tela congelada, console cheio, e
// nada na tela dizendo o que houve. A spec do `demos` pede isto por escala — "across 383 games, one bad game has
// to be distinguishable from a broken engine". A razão daqui é mais urgente: **criança cega não vê tela
// congelada.** Sem anúncio, o modo cego não distingue "travou" de "está pensando".
//
// ⚠️ E A TENTAÇÃO É O CONTRÁRIO DO CONSERTO. `try { frame() } catch { /* segue */ }` é pior que o defeito: vira
// jogo silenciosamente errado, rodando para sempre computando lixo. A regra aqui é a mesma que o ADR-0047 aplicou
// ao CRT — pega UMA vez, PARA, e ANUNCIA.

import { gameSpeed } from './state.js';

type Ticker = { add: (fn: () => void) => void; deltaTime: number; remove?: (fn: () => void) => void };

export interface LoopOptions {
  /**
   * Chamado UMA vez, com o erro, quando o quadro lança. É o canal de quem não enxerga a tela parar.
   *
   * A raiz de composição liga isto ao `srAlert` e a uma mensagem visível. Opcional de propósito: um consumidor
   * que monte o laço sem casca (um teste, o quiz) continua parando — o anúncio é opcional, **parar não é**.
   */
  onFailure?: (failure: unknown) => void;
}

/**
 * THE NOTICE A LOOP USES WHEN ITS CALLER PASSED NONE (study item D1; ADR-0054: «stops the loop and says so»).
 * 📏 Measured on 2026-09-13: `game-soccer` calls `startLoop` without `aoFalhar`, so its frame would stop in silence — the
 * announcement depended on each game remembering it. `createGame` registers its own notice here and withdraws it on
 * `unmount`; a caller's own `aoFalhar` still wins. The same shape as `registerKeyboardMapping`.
 */
let registeredNotice: ((failure: unknown) => void) | null = null;
export function registerCrashNotice(notice: ((failure: unknown) => void) | null): void { registeredNotice = notice; }

export function startLoop(ticker: Ticker, frame: (dt: number) => void, maxDt = 2, opcoes: LoopOptions = {}): void {
  let stopped = false;
  const step = (): void => {
    if (stopped) return; // ticker sem `remove` não desregistra — a trava é o que faz o laço parar mesmo assim
    try {
      // the game speed (ADR-0180) applies to the clamped time, read each frame: a change is felt on the next one
      frame(Math.min(ticker.deltaTime, maxDt) * gameSpeed);
    } catch (failure) {
      stopped = true;
      ticker.remove?.(step); // some do ticker quando dá: callback que roda 60×/s para nada custa em hardware fraco
      // O anúncio não pode ressuscitar o problema. Se o próprio aviso quebrar — sem leitor de tela, sem DOM —,
      // uma exceção aqui voltaria a ser invisível dentro do ticker, que é exatamente o defeito que isto fecha.
      // read at the throw, not at the start: a root mounted after the loop began still announces it
      try { (opcoes.onFailure ?? registeredNotice)?.(failure); } catch { /* noop: o aviso falhou; o laço já parou, que é o essencial */ }
    }
  };
  ticker.add(step);
}
