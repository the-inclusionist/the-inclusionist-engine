// SPDX-License-Identifier: AGPL-3.0-or-later
// game/coins.ts — POSICIONAMENTO dos coletáveis no mapa (Estágio 4). findCoinCandidates acha as células onde
// cabe um item (tile de ar(1)/água(3) com chão sólido logo abaixo, fora da zona de spawn); pickCoins sorteia n
// posições POR JOGADOR (Lote C: cada dono tem seu conjunto) e carimba shape/letter dos POOLS RECEBIDOS;
// positionEasyCoins rebaixa cada moeda até o chão no modo Fácil/cadeirante (acessibilidade). Corte limpo: NÃO
// conhece MODE nem os dados de quiz — o game.js calcula os pools e os passa; anyEasy/wheelchair entram por ctx.
// O render (coinTexFor/rebuildCoins/coinSprites) e os distratores (malform/ferreiroDistractors) ficam fora (quiz/render).
import { TILE } from '../core/constants.js';
import { solidAt } from '../core/collision.js';
import { shuffle } from '../core/rng.js';
import { numPlayers } from '../core/state.js';
import { coins } from './state.js'; // item 19: `coins`/`quizLevel` sao estado do JOGO

// mundo + flags de acessibilidade injetados no boot (mesma referência do game.js/colisão). Closures = estado vivo.
let _world: number[][] = [], _W = 0, _H = 0;
let _anyEasy: () => boolean = () => false;      // algum jogador no modo Fácil? (efeito de MUNDO: moedas no chão)
let _isWheelchair: () => boolean = () => false; // cadeirante também rebaixa as moedas (alcançáveis sentado)
export function initCoins(ctx: { world: number[][]; W: number; H: number; anyEasy: () => boolean; isWheelchair: () => boolean }): void {
  _world = ctx.world; _W = ctx.W; _H = ctx.H; _anyEasy = ctx.anyEasy; _isWheelchair = ctx.isWheelchair;
}

// Células candidatas a receber um item: ar(1)/água(3) com chão sólido em até 10 tiles abaixo (alcançável),
// exceto a zona de spawn/queda (tx≤4 & ty≥16 → evita auto-coleta ao nascer).
export function findCoinCandidates(): { tx: number; ty: number }[] {
  const cand: { tx: number; ty: number }[] = [], maxJ = 10;
  for (let ty = 0; ty < _H; ty++) for (let tx = 0; tx < _W; tx++) {
    // ⚠️ PAR ESPECÍFICO, não classe semântica — mesmo caso do `isBouncyGroundBelow` em game/player. Moeda
    // nasce no AR ILUMINADO(1) ou na ÁGUA(3). "Não sólido" pareceria a pergunta certa e incluiria a ESCADA(4)
    // e o AR SECRETO(0) — a escada ganharia moedas penduradas, e a região secreta deixaria de ser recompensa
    // para virar rota obrigatória. O ar iluminado é um tile, não um papel.
    const t = _world[ty][tx]; if (t !== 1 && t !== 3) continue;
    if (tx <= 4 && ty >= 16) continue; // zona de spawn/queda: sem moeda (evita auto-coleta)
    let below = -1;
    for (let dy = 1; dy <= maxJ && ty + dy < _H; dy++) { if (solidAt(tx, ty + dy)) { below = dy; break; } }
    if (below >= 1) cand.push({ tx, ty });
  }
  return cand;
}

export type Coin = {
  x: number; y: number; owner: number; taken: boolean; shape: string; letter: string;
  /**
   * O `y` ORIGINAL, guardado na primeira vez que o modo Fácil (ou a cadeira de rodas) rebaixa a moeda até
   * o chão, para que desligar devolva a altura de antes. Opcional porque nasce preguiçoso: só existe depois
   * que `positionEasyCoins` roda uma vez.
   *
   * ESTAVA FALTANDO AQUI, e a falta tinha um preço visível: este mesmo arquivo declarava um segundo tipo,
   * `EasyCoin = { x, y, y0? }`, com um cast, só para poder tocar no campo. Duas descrições concorrentes do
   * mesmo objeto no mesmo arquivo, e a canônica era a incompleta.
   */
  y0?: number;
};
// Sorteia n itens POR JOGADOR (posições independentes por dono). pools.shapes/letters vêm do game.js (derivados
// do MODE): 'somasub' passa as formas; 'silabas' passa as iniciais; 'ludico' passa vazio → shape/letter = ''.
export function pickCoins(n: number, pools: { shapes?: string[]; letters?: string[] } = {}): Coin[] {
  const shapes = pools.shapes ?? [], letters = pools.letters ?? [];
  const out: Coin[] = [], np = Math.max(1, numPlayers);
  for (let owner = 0; owner < np; owner++) {
    const a = shuffle(findCoinCandidates());                 // sorteio de posições independente por jogador
    const sh = shapes.length ? shuffle(shapes.slice()) : [], lt = letters.length ? shuffle(letters.slice()) : [];
    a.slice(0, Math.min(n, a.length)).forEach((p, i) => out.push({
      x: p.tx * TILE + 3, y: p.ty * TILE + 3, owner, taken: false,
      shape: sh.length ? sh[i % sh.length] : '',
      letter: lt.length ? lt[i % lt.length] : '',
    }));
  }
  return out;
}

// Fácil/cadeirante: rebaixa cada moeda até o chão logo abaixo (scan ≤10 tiles); guarda y0 p/ reverter ao desligar.
// A moeda (10px) repousa com 1px de folga (fy-11). Sem Fácil nem cadeira: volta ao y0 original.
export function positionEasyCoins(): void {
  coins.forEach((cn) => {
    const y0 = (cn.y0 ??= cn.y);
    if (_anyEasy() || _isWheelchair()) {
      const tx = Math.floor((cn.x + 5) / TILE); let fy: number | null = null;
      for (let ty = Math.floor(y0 / TILE); ty < _H && ty < Math.floor(y0 / TILE) + 10; ty++) { if (solidAt(tx, ty)) { fy = ty * TILE; break; } }
      cn.y = fy != null ? fy - 11 : y0;
    } else cn.y = y0;
  });
}

// Coletar = marca 1 dono; some do mundo em TODAS as telas (o item tem um único dono).
export function takeCoin(cn: { taken: boolean }): void { cn.taken = true; }
