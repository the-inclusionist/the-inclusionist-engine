// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/coins — posicionamento dos coletáveis (project node). Padrões: ZOMBIES + Right-BICEP.
// coins lê o mundo via initCoins(ctx) e a colisão via solidAt → inicializamos ambos com um mundo FALSO.
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, game/coins — só posicionamento).
import { describe, it, expect } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import * as COINS from '../app/js/game/coins.js';
import { setNumPlayersValue } from '../app/js/core/state.js';
import { setCoins } from '../app/js/game/state.js'; // item 19: `coins`/`quizLevel` mudaram para `game/state`
import { reseed } from '../app/js/core/rng.js';

// liga colisão (p/ solidAt) + coins no MESMO mundo falso. flags.easy/wheelchair alimentam positionEasyCoins.
const useWorld = (grid, flags = {}) => {
  const ctx = { world: grid, W: grid[0].length, H: grid.length };
  COL.initCollision({ ...ctx, isWheelchair: () => !!flags.wheelchair, isModoCego: () => false, caneDiv: () => 1, wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true });
  COINS.initCoins({ ...ctx, anyEasy: () => !!flags.easy, isWheelchair: () => !!flags.wheelchair });
};

// (1,1)=ar com chão em (1,2); (3,1)=água com chão em (3,3) (dy=2); (5,1)=ar FLUTUANTE (sem chão) → não candidato.
const COINWORLD = [
  [0, 0, 0, 0, 0, 0],
  [0, 1, 0, 3, 0, 1],
  [0, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

describe('game/coins — findCoinCandidates (células que recebem item)', () => {
  it('[Right] ar(1)/água(3) com chão sólido alcançável abaixo → candidatos (ordem varredura ty,tx)', () => {
    useWorld(COINWORLD);
    expect(COINS.findCoinCandidates()).toEqual([{ tx: 1, ty: 1 }, { tx: 3, ty: 1 }]);
  });
  it('[Inverse] tile flutuante (sem chão em 10 abaixo) NÃO é candidato', () => {
    useWorld(COINWORLD);
    expect(COINS.findCoinCandidates().some((c) => c.tx === 5)).toBe(false);
  });
  it('[Boundary/a11y] zona de spawn (tx≤4 & ty≥16) é excluída (evita auto-coleta ao nascer)', () => {
    const W = 6, H = 18, g = Array.from({ length: H }, () => new Array(W).fill(0));
    g[16][2] = 1; g[17][2] = 2; // ar com chão, MAS na zona de spawn (tx=2≤4, ty=16≥16) → excluído
    g[16][5] = 1; g[17][5] = 2; // idem fora da zona (tx=5>4) → candidato
    useWorld(g);
    expect(COINS.findCoinCandidates()).toEqual([{ tx: 5, ty: 16 }]);
  });
});

describe('game/coins — pickCoins (sorteio por jogador + pools recebidos)', () => {
  const POS = new Set([1 * 16 + 3, 3 * 16 + 3]); // x possíveis (dos 2 candidatos do COINWORLD)
  it('[Right] n itens (1 jogador), do-nada nos pools → shape/letter vazios, owner 0, não coletado', () => {
    useWorld(COINWORLD); reseed(1);
    const coins = COINS.pickCoins(2, {});
    expect(coins.length).toBe(2);
    for (const c of coins) { expect(c.owner).toBe(0); expect(c.taken).toBe(false); expect(c.shape).toBe(''); expect(c.letter).toBe(''); expect(POS.has(c.x)).toBe(true); }
  });
  it('[Boundary] n maior que os candidatos → limita ao nº de candidatos', () => {
    useWorld(COINWORLD); reseed(2);
    expect(COINS.pickCoins(5, {}).length).toBe(2); // só há 2 candidatos
  });
  it('[Interface] pools de formas (somasub) → cada item recebe uma shape do pool; letter vazio', () => {
    useWorld(COINWORLD); reseed(3);
    const coins = COINS.pickCoins(2, { shapes: ['circulo', 'quadrado'] });
    for (const c of coins) { expect(['circulo', 'quadrado']).toContain(c.shape); expect(c.letter).toBe(''); }
  });
  it('[Many] multiplayer: n itens POR jogador, um conjunto por dono (owners 0..np-1)', () => {
    useWorld(COINWORLD); reseed(4); setNumPlayersValue(2);
    const coins = COINS.pickCoins(2, {});
    expect(coins.length).toBe(4); // 2 candidatos × 2 jogadores
    expect([...new Set(coins.map((c) => c.owner))].sort()).toEqual([0, 1]);
    setNumPlayersValue(1); // restaura p/ não vazar estado a outros testes
  });
});

// Mundo com chão sólido só em (1,4). Moeda em x=24 (tx=1), y=20 → rebaixa até fy=4*16=64 → y=64-11=53.
const EASYWORLD = [
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 2, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];

describe('game/coins — positionEasyCoins (Fácil/cadeirante: moeda ao chão)', () => {
  it('[Right/a11y] modo Fácil rebaixa a moeda até o chão (y=53) e guarda o y0 original', () => {
    useWorld(EASYWORLD, { easy: true });
    const cs = [{ x: 24, y: 20 }]; setCoins(cs);
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(53);
    expect(cs[0].y0).toBe(20);
  });
  it('[Inverse] sem Fácil nem cadeira → moeda fica na posição original', () => {
    useWorld(EASYWORLD, {});
    const cs = [{ x: 24, y: 20 }]; setCoins(cs);
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(20);
  });
  it('[Right/a11y] cadeirante (sem Fácil) também rebaixa', () => {
    useWorld(EASYWORLD, { wheelchair: true });
    const cs = [{ x: 24, y: 20 }]; setCoins(cs);
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(53);
  });
  it('[Boundary] sem chão abaixo (10 tiles) → fica no y0', () => {
    useWorld([[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], { easy: true });
    const cs = [{ x: 24, y: 20 }]; setCoins(cs);
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(20);
  });
  it('[Cross-check/y0] liga (rebaixa) e depois desliga → volta ao y0 ORIGINAL, não à posição rebaixada', () => {
    const flags = { easy: true, wheelchair: false };
    useWorld(EASYWORLD, flags);
    const cs = [{ x: 24, y: 20 }]; setCoins(cs);
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(53);
    flags.easy = false;               // desliga sem reinit (closure lê o estado vivo)
    COINS.positionEasyCoins();
    expect(cs[0].y).toBe(20);         // volta ao original (20), não fica em 53
  });
});

describe('game/coins — takeCoin', () => {
  it('[Right] marca o item como coletado', () => {
    const cn = { taken: false };
    COINS.takeCoin(cn);
    expect(cn.taken).toBe(true);
  });
});
