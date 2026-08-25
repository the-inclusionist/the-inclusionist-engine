// SPDX-License-Identifier: AGPL-3.0-or-later
// core/loop.ts — driver do loop de jogo. Registra a função de frame num "ticker" (o app.ticker do PixiJS, ou
// qualquer objeto com .add(fn) e .deltaTime) e passa o dt CLAMPADO (evita saltos gigantes após a aba ficar em
// segundo plano). Módulo-folha. Mantém a cadência ATUAL (não muda o timing) — o fixed-timestep determinístico
// fica para depois, pois mudaria a física.
type Ticker = { add: (fn: () => void) => void; deltaTime: number };
export function startLoop(ticker: Ticker, frame: (dt: number) => void, maxDt = 2): void {
  ticker.add(() => frame(Math.min(ticker.deltaTime, maxDt)));
}
