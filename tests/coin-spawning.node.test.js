// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de game/coin-spawning — materialização e ciclo das moedas (project node). Padrões: ZOMBIES + Right-BICEP.
// PIXI (container/fábrica de sprite/texturas) é 100% fake (o módulo nunca importa PIXI) — as fábricas devolvem
// só uma etiqueta string, o suficiente pra afirmar QUAL textura foi pedida. O mundo/colisão usa o mesmo mundo
// falso do teste de game/coins (findCoinCandidates é IMPORTADO de lá, não reimplementado aqui).
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, game/coin-spawning).
import { describe, it, expect, beforeEach } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import * as COINS from '../app/js/game/coins.js';
import * as CS from '../app/js/game/coin-spawning.js';
import { setCoins, coins, players } from '../app/js/core/state.js';
import { reseed } from '../app/js/core/rng.js';

// (1,1)=ar com chão em (1,2); (3,1)=água com chão em (3,3) → 2 células candidatas (mesmo mundo do teste de coins).
const COINWORLD = [
  [0, 0, 0, 0, 0, 0],
  [0, 1, 0, 3, 0, 1],
  [0, 2, 0, 0, 0, 0],
  [0, 0, 0, 2, 0, 0],
  [0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0],
];
const useWorld = (grid, flags = {}) => {
  const ctx = { world: grid, W: grid[0].length, H: grid.length };
  COL.initCollision({ ...ctx, isWheelchair: () => !!flags.wheelchair, isModoCego: () => false, caneDiv: () => 1, wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true });
  COINS.initCoins({ ...ctx, anyEasy: () => !!flags.easy, isWheelchair: () => !!flags.wheelchair });
};

// container PIXI falso: só junta/esvazia a lista de sprites (o suficiente p/ afirmar o que rebuildCoins fez).
function fakeContainer() {
  let list = [];
  return {
    all: () => list,
    removeChildren() { const removed = list; list = []; return removed; },
    addChild(s) { list.push(s); },
  };
}
// fábrica de sprite falsa: devolve um objeto simples com os campos que rebuildCoins escreve, + um marcador da textura pedida.
function fakeSprite(tex) { return { tex, x: 0, y: 0, tint: 0, visible: true, destroyed: false, destroy() { this.destroyed = true; } }; }

let container, mode, ownerColors, pcolor, invalidated, elByHudPower;
const baseCtx = () => ({
  coinContainer: container,
  createSprite: fakeSprite,
  coinTexFor: (m) => `coin:${m}`,
  shapeTexFor: (id) => `shape:${id}`,
  letterTexFor: (ch) => `letter:${ch}`,
  pcolor,
  getMode: () => mode,
  getOwnerColors: () => ownerColors,
  invalidateSharedViz: () => { invalidated = true; },
  powerShort: { off: '—', superjump: '🐇 Super-pulo' },
  $: (sel) => (sel === '#hud-power' ? elByHudPower : null),
});

beforeEach(() => {
  useWorld(COINWORLD);
  setCoins([]);
  container = fakeContainer();
  mode = 'ludico'; ownerColors = true; pcolor = [0xff0000, 0x00ff00]; invalidated = false;
  elByHudPower = { textContent: '' };
  CS.initCoinSpawning(baseCtx());
});

describe('game/coin-spawning — rebuildCoins (materialização dos sprites)', () => {
  it('[Zero] sem moedas → container fica vazio, coinSprites vazio', () => {
    CS.rebuildCoins();
    expect(container.all()).toEqual([]);
    expect(CS.getCoinSprites()).toEqual([]);
  });

  it('[Right] Lúdico: 1 sprite por moeda, na posição exata (x,y), textura = coinTexFor(vizMode)', () => {
    setCoins([{ x: 10, y: 20, owner: 0, taken: false, shape: '', letter: '' }]);
    CS.rebuildCoins();
    const s = CS.getCoinSprites()[0];
    expect(s.x).toBe(10); expect(s.y).toBe(20); expect(s.tex).toBe('coin:normal'); expect(s.visible).toBe(true);
    expect(container.all()).toEqual([s]); // o mesmo sprite foi ATÉ o container
  });

  it('[Right] Soma-Sub: usa shapeTexFor, tamanho 15×15, offset -3 (não a textura de moeda)', () => {
    setCoins([{ x: 10, y: 20, owner: 0, taken: false, shape: 'circulo', letter: '' }]);
    mode = 'somasub'; CS.initCoinSpawning(baseCtx());
    CS.rebuildCoins();
    const s = CS.getCoinSprites()[0];
    expect(s.tex).toBe('shape:circulo'); expect(s.width).toBe(15); expect(s.height).toBe(15); expect(s.x).toBe(7); expect(s.y).toBe(17);
  });

  it('[Right] Sílabas: usa letterTexFor, tamanho 14×14, offset -2', () => {
    setCoins([{ x: 10, y: 20, owner: 0, taken: false, shape: '', letter: 'g' }]);
    mode = 'silabas'; CS.initCoinSpawning(baseCtx());
    CS.rebuildCoins();
    const s = CS.getCoinSprites()[0];
    expect(s.tex).toBe('letter:g'); expect(s.width).toBe(14); expect(s.height).toBe(14); expect(s.x).toBe(8); expect(s.y).toBe(18);
  });

  it('[Boundary] Soma-Sub sem shape na moeda (silabas/ludico misturados) cai na textura de moeda comum', () => {
    setCoins([{ x: 1, y: 1, owner: 0, taken: false, shape: '', letter: '' }]);
    mode = 'somasub'; CS.initCoinSpawning(baseCtx());
    CS.rebuildCoins();
    expect(CS.getCoinSprites()[0].tex).toBe('coin:normal');
  });

  it('[Boundary] moeda já coletada (taken) → sprite criado mas invisível', () => {
    setCoins([{ x: 1, y: 1, owner: 0, taken: true, shape: '', letter: '' }]);
    CS.rebuildCoins();
    expect(CS.getCoinSprites()[0].visible).toBe(false);
  });

  it('[Right/a11y] cor do dono ligada → tint = pcolor[owner]', () => {
    setCoins([{ x: 1, y: 1, owner: 1, taken: false, shape: '', letter: '' }]);
    CS.rebuildCoins();
    expect(CS.getCoinSprites()[0].tint).toBe(0x00ff00);
  });

  it('[Inverse/a11y] cor do dono desligada → tint sempre branco, mesmo com pcolor definido', () => {
    setCoins([{ x: 1, y: 1, owner: 1, taken: false, shape: '', letter: '' }]);
    ownerColors = false; CS.initCoinSpawning(baseCtx());
    CS.rebuildCoins();
    expect(CS.getCoinSprites()[0].tint).toBe(0xffffff);
  });

  it('[Cross-check] moedas antigas são destruídas e removidas do container ao reconstruir', () => {
    setCoins([{ x: 1, y: 1, owner: 0, taken: false, shape: '', letter: '' }]);
    CS.rebuildCoins();
    const old = CS.getCoinSprites()[0];
    setCoins([{ x: 2, y: 2, owner: 0, taken: false, shape: '', letter: '' }]);
    CS.rebuildCoins();
    expect(old.destroyed).toBe(true);
    expect(container.all().length).toBe(1);
    expect(container.all()[0]).not.toBe(old);
  });

  it('[Many] reconstrução sempre invalida o cache de viz compartilhado do game.js', () => {
    CS.rebuildCoins();
    expect(invalidated).toBe(true);
  });
});

describe('game/coin-spawning — addCoinsForOwner (gera+renova o conjunto de UM dono)', () => {
  it('[Right] anexa itens novos do dono pedido, preservando o item pré-existente de outro dono', () => {
    setCoins([{ x: 99, y: 99, owner: 1, taken: false, shape: '', letter: '' }]); // item de outro dono, já existente
    reseed(1); CS.addCoinsForOwner(0);
    expect(coins.some((c) => c.owner === 1 && c.x === 99)).toBe(true); // intacto
    expect(coins.filter((c) => c.owner === 0).length).toBeGreaterThan(0); // novos, do dono certo
    expect(coins.filter((c) => c.owner === 0).every((c) => c.taken === false)).toBe(true);
  });

  it('[Boundary] só há 2 candidatos no mundo falso → no máx. 2 itens novos (mesmo COIN_TARGET=10)', () => {
    reseed(1); CS.addCoinsForOwner(0);
    expect(coins.length).toBe(2);
    expect(CS.getCoinSprites().length).toBe(2); // rebuildCoins() já refletiu no render
  });

  it('[Interface] Lúdico: shape/letter ficam vazios', () => {
    reseed(2); CS.addCoinsForOwner(0);
    expect(coins.every((c) => c.shape === '' && c.letter === '')).toBe(true);
  });

  it('[Interface] Soma-Sub: cada item novo recebe uma shape do catálogo (não a textura de moeda)', () => {
    mode = 'somasub'; CS.initCoinSpawning(baseCtx());
    reseed(3); CS.addCoinsForOwner(0);
    expect(CS.getCoinSprites().every((s) => String(s.tex).startsWith('shape:'))).toBe(true);
  });

  it('[Interface] Sílabas: cada item novo recebe uma letra inicial (não a textura de moeda)', () => {
    mode = 'silabas'; CS.initCoinSpawning(baseCtx());
    reseed(4); CS.addCoinsForOwner(0);
    expect(CS.getCoinSprites().every((s) => String(s.tex).startsWith('letter:'))).toBe(true);
  });

  it('[Right] chama rebuildCoins ao final (o container reflete os itens recém-anexados)', () => {
    reseed(5); CS.addCoinsForOwner(0);
    expect(container.all().length).toBe(2);
  });
});

describe('game/coin-spawning — respawnCoinsForOwner (recomeço de UM jogador)', () => {
  it('[Right] descarta só os itens do dono e sorteia um conjunto novo (mesma contagem, mundo com 2 candidatos)', () => {
    reseed(1); CS.addCoinsForOwner(0); CS.addCoinsForOwner(1); // 2 donos, 2 itens cada
    reseed(9); CS.respawnCoinsForOwner(0);
    expect(CS.getCoinSprites().length).toBe(4); // 2 (dono 0 renovado) + 2 (dono 1 intacto)
  });

  it('[Many] dono sem itens prévios → também funciona (só cria)', () => {
    reseed(1); CS.respawnCoinsForOwner(0);
    expect(CS.getCoinSprites().length).toBe(2);
  });
});

describe('game/coin-spawning — showPower (HUD do poder ativo, só a tela 1)', () => {
  it('[Right] jogador 1 (players[0]) → escreve o rótulo curto no #hud-power', () => {
    players.length = 0; const p1 = { activePower: 'superjump', owned: ['superjump'] }; players.push(p1);
    CS.initCoinSpawning(baseCtx());
    CS.showPower(p1);
    expect(elByHudPower.textContent).toBe('🐇 Super-pulo');
  });

  it('[Boundary] poder desconhecido → cai no traço', () => {
    players.length = 0; const p1 = { activePower: 'wallcling', owned: [] }; players.push(p1);
    CS.initCoinSpawning(baseCtx());
    CS.showPower(p1);
    expect(elByHudPower.textContent).toBe('—');
  });

  it('[Right] mais de 1 poder possuído → sufixo com a contagem', () => {
    players.length = 0; const p1 = { activePower: 'superjump', owned: ['superjump', 'fly'] }; players.push(p1);
    CS.initCoinSpawning(baseCtx());
    CS.showPower(p1);
    expect(elByHudPower.textContent).toBe('🐇 Super-pulo (2)');
  });

  it('[Inverse] jogador 2+ (não é players[0]) → não toca o DOM (multiplayer não tem #hud-power por tela)', () => {
    players.length = 0; const p1 = { activePower: 'off', owned: [] }; players.push(p1);
    const p2 = { activePower: 'superjump', owned: ['superjump'] };
    CS.initCoinSpawning(baseCtx());
    elByHudPower.textContent = 'intacto';
    CS.showPower(p2);
    expect(elByHudPower.textContent).toBe('intacto');
  });

  it('[Boundary] #hud-power ausente no DOM → não lança (multiplayer/telas sem esse elemento)', () => {
    players.length = 0; const p1 = { activePower: 'off', owned: [] }; players.push(p1);
    elByHudPower = null;
    CS.initCoinSpawning(baseCtx());
    expect(() => CS.showPower(p1)).not.toThrow();
  });
});
