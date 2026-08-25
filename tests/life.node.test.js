// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/life — vida ambiente (pombos/gatos/cães/adultos) (project node). ZOMBIES + Right-BICEP.
// PIXI é injetado como fakes estruturais (sprite/layer); lifeSurfaceAt/lifeSurfaceLowAt/streetCols também são
// injetados (a implementação REAL continua em game.js, compartilhada com render/scene-city — não é escopo
// deste módulo). solidAt/tileAt vêm ligados via core/collision.initCollision, como em elevators.node.test.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/life).
import { describe, it, expect, beforeEach } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import { reseed } from '../app/js/core/rng.js';
import { players, setNumPlayersValue, setCenarioValue } from '../app/js/core/state.js';
import { TILE } from '../app/js/core/constants.js';
import { initLife, spawnCreature, stepLife, getCreatures } from '../app/js/game/life.js';

const W = 200, H = 12;

function wireCollision() {
  // grade rasa: linha `groundRow` sólida (tipo 6), tudo acima é ar (0) — dá piso p/ o passo de andar/beirada.
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, () => (y === 6 ? 6 : 0)));
  COL.initCollision({
    world: grid, W, H,
    isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
    wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
  });
  return grid;
}

function makeSprite(t) {
  return { anchor: { set() {} }, alpha: 1, x: 0, y: 0, scale: { x: 1 }, texture: t, destroyed: false, destroy() { this.destroyed = true; } };
}
function makeLayer() {
  const children = [];
  return { children, addChild: (s) => children.push(s), removeChild: (s) => { const i = children.indexOf(s); if (i >= 0) children.splice(i, 1); }, removeChildren: () => { children.length = 0; } };
}
const LIFE_TEX = { pombo: ['p0', 'p1'], pomboFly: ['pf0', 'pf1'], gato: ['g0', 'g1'], cao: ['c0', 'c1'] };
const ADULT_TEX = [['a0', 'a1']];

// Wire padrão: sem cão-perto-de-árvore (decoSprites vazio), streetCols cobre o mapa inteiro em ty=8 (baixo),
// lifeSurfaceAt cobre o mapa inteiro em ty=2 (alto) — assim TODO kind consegue achar um spot válido.
function wireLife(overrides = {}) {
  const layer = makeLayer();
  const rm = { decor: false };
  const ctx = {
    layer, makeSprite, lifeTex: LIFE_TEX, adultTex: ADULT_TEX,
    lifeSurfaceAt: () => 2, lifeSurfaceLowAt: () => 8,
    streetCols: () => Array.from({ length: W - 4 }, (_, i) => [i + 2, 8]),
    decoSprites: [], rm, W, pxW: W * TILE, pxH: H * TILE,
    ...overrides,
  };
  initLife(ctx);
  return { layer, rm, ctx };
}

beforeEach(() => {
  wireCollision();
  players.length = 0; players.push({ x: 100 * TILE, y: 6 * TILE });
  setNumPlayersValue(1);
  setCenarioValue('cidade');
  getCreatures().length = 0; // drena o pool (estado do módulo é singleton entre testes)
  reseed(20260601);
});

describe('spawnCreature — cap do pool', () => {
  it('recusa a 11ª criatura (pool cap = 10)', () => {
    wireLife();
    for (let i = 0; i < 10; i++) getCreatures().push({ K: {}, s: makeSprite(null) });
    expect(spawnCreature()).toBe(false);
    expect(getCreatures().length).toBe(10);
  });
});

describe('spawnCreature — vida de rua só na cidade', () => {
  it('cão/adulto (street) nunca nascem fora de "cidade"', () => {
    wireLife();
    setCenarioValue('campo');
    const kinds = new Set();
    for (let i = 0; i < 80; i++) {
      if (spawnCreature()) { kinds.add(getCreatures().at(-1).K.k); getCreatures().length = 0; }
    }
    expect(kinds.has('cao')).toBe(false);
    expect(kinds.has('adulto')).toBe(false);
    expect(kinds.size).toBeGreaterThan(0); // pombo/gato continuam nascendo (vida não-street)
  });

  it('em "cidade", os 4 tipos aparecem (pool de kinds pesado 3× em pombo)', () => {
    wireLife();
    const kinds = new Set();
    for (let i = 0; i < 200; i++) {
      if (spawnCreature()) { kinds.add(getCreatures().at(-1).K.k); getCreatures().length = 0; }
    }
    expect(kinds).toEqual(new Set(['pombo', 'gato', 'cao', 'adulto']));
  });
});

describe('spawnCreature — cidade: pombo/gato só na parte ALTA', () => {
  it('rejeita quando lifeSurfaceAt aponta pra banda baixa (sem opção de rua)', () => {
    wireLife({ lifeSurfaceAt: () => 9, streetCols: () => [], decoSprites: [] }); // 9*TILE=144 ≥ 0.55*pxH(192*0.55≈105.6)
    for (let i = 0; i < 40; i++) expect(spawnCreature()).toBe(false);
    expect(getCreatures().length).toBe(0);
  });

  it('aceita quando lifeSurfaceAt aponta pra banda alta', () => {
    wireLife({ lifeSurfaceAt: () => 2, streetCols: () => [], decoSprites: [] }); // só pombo/gato conseguem (street sem opções)
    const kinds = new Set();
    let anySuccess = false;
    for (let i = 0; i < 60; i++) {
      if (spawnCreature()) { anySuccess = true; kinds.add(getCreatures().at(-1).K.k); getCreatures().length = 0; }
    }
    expect(anySuccess).toBe(true);
    expect(kinds.has('cao')).toBe(false);
    expect(kinds.has('adulto')).toBe(false);
  });
});

describe('spawnCreature — cão prefere perto de árvore', () => {
  it('com decoSprites presente, o cão nasce ancorado numa coluna próxima da árvore', () => {
    const treeX = 100 * TILE;
    wireLife({ decoSprites: [{ x: treeX }], lifeSurfaceLowAt: () => 7, streetCols: () => [] }); // sem streetCols: só a rota da árvore resolve pro cão
    let dogSpawned = false;
    for (let i = 0; i < 300 && !dogSpawned; i++) {
      if (spawnCreature()) {
        const c = getCreatures().at(-1);
        if (c.K.k === 'cao') {
          dogSpawned = true;
          expect(Math.abs(c.x - treeX)).toBeLessThanOrEqual(3 * TILE + 8); // randInt(1,3) colunas de distância da árvore
          expect(c.y).toBe(7 * TILE); // veio de lifeSurfaceLowAt
        }
      }
      getCreatures().length = 0;
    }
    expect(dogSpawned).toBe(true);
  });
});

describe('spawnCreature — sprite/fade', () => {
  it('spawn de rua nasce com alpha 0 (fade=30) e some do fade ao longo do tempo em stepLife', () => {
    wireLife({ streetCols: () => [[90, 8]], decoSprites: [], lifeSurfaceAt: () => -1 }); // rota de rua perto do jogador padrão (ptx=100); pombo/gato falham sem superfície
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) ok = spawnCreature();
    expect(ok).toBe(true);
    const c = getCreatures().at(-1);
    expect(c.fade).toBe(30);
    expect(c.s.alpha).toBe(0);
    expect(c.x).toBe(90 * TILE + 8);
    expect(c.y).toBe(8 * TILE);
  });

  it('adiciona o sprite na layer injetada', () => {
    const { layer } = wireLife();
    let ok = false;
    for (let i = 0; i < 30 && !ok; i++) ok = spawnCreature();
    expect(ok).toBe(true);
    expect(layer.children.length).toBe(1);
  });
});

describe('stepLife — rm.decor limpa o pool', () => {
  it('destrói todos os sprites e esvazia creatures/layer', () => {
    const { layer, rm } = wireLife();
    const s1 = makeSprite('x'); layer.addChild(s1);
    getCreatures().push({ K: { alpha: 1 }, s: s1, fade: 0, x: 0, y: 0, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    rm.decor = true;
    stepLife(1);
    expect(getCreatures().length).toBe(0);
    expect(layer.children.length).toBe(0);
    expect(s1.destroyed).toBe(true);
  });
});

describe('stepLife — anima e avança', () => {
  it('decai o fade proporcionalmente (alpha = K.alpha*(1-fade/30))', () => {
    wireLife();
    players.length = 0; players.push({ x: 40 * TILE, y: 6 * TILE }); // perto da criatura (senão despawna por distância)
    const s = makeSprite('t');
    getCreatures().push({ K: { alpha: 0.9, spd: 0 }, s, tex2: ['t0', 't1'], fade: 30, x: 40 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(10); // fade 30→20
    const c = getCreatures()[0];
    expect(c.fade).toBe(20);
    expect(c.s.alpha).toBeCloseTo(0.9 * (1 - 20 / 30));
  });

  it('alterna o quadro (f) quando animT atinge 12', () => {
    wireLife();
    players.length = 0; players.push({ x: 40 * TILE, y: 6 * TILE });
    const s = makeSprite('t');
    getCreatures().push({ K: { alpha: 1, spd: 0 }, s, tex2: ['t0', 't1'], fade: 0, x: 40 * TILE, y: 6 * TILE, dir: 1, animT: 11, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(2); // animT 11+2=13 ≥12 → zera e alterna f
    expect(getCreatures()[0].f).toBe(1);
    expect(getCreatures()[0].animT).toBe(0);
  });

  it('anda: x += dir*spd*dt no estado walk', () => {
    wireLife();
    players.length = 0; players.push({ x: 40 * TILE, y: 6 * TILE });
    const s = makeSprite('t');
    getCreatures().push({ K: { alpha: 1, spd: 0.3 }, s, tex2: ['t0', 't1'], fade: 0, x: 40 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(5);
    expect(getCreatures()[0].x).toBeCloseTo(40 * TILE + 0.3 * 5);
  });

  it('faz meia-volta na beirada (perde o chão à frente)', () => {
    wireLife();
    players.length = 0; players.push({ x: 1 * TILE, y: 6 * TILE });
    const s = makeSprite('t');
    // x=8*TILE(perto da beirada esquerda do piso, que existe só a partir de tx>=1); dir=-1 → nx cai em tx=0..1
    getCreatures().push({ K: { alpha: 1, spd: 0.1 }, s, tex2: ['t0', 't1'], fade: 0, x: 1 * TILE + 2, y: 6 * TILE, dir: -1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(1);
    expect(getCreatures()[0].dir).toBe(1); // meia-volta: -1 → 1
  });

  it('faz meia-volta ao encontrar LAVA (tile 9) à frente', () => {
    const grid = wireCollision();
    grid[5][51] = 9; // lava logo acima do piso na coluna 51 (linha 6 é sólida)
    wireLife();
    players.length = 0; players.push({ x: 50 * TILE, y: 6 * TILE });
    const s = makeSprite('t');
    // spd=TILE ⇒ x cruza um tile inteiro nesse dt=1, garantindo nx=51 (a coluna com lava) na checagem de beirada
    getCreatures().push({ K: { alpha: 1, spd: TILE }, s, tex2: ['t0', 't1'], fade: 0, x: 50 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(1);
    expect(getCreatures()[0].dir).toBe(-1);
  });

  it('pombo foge (state=fly) quando um jogador chega perto', () => {
    wireLife();
    const s = makeSprite('t');
    players.length = 0; players.push({ x: 40 * TILE + 5, y: 6 * TILE });
    getCreatures().push({ K: { alpha: 1, spd: 0, fly: true, peck: true }, s, tex2: ['t0', 't1'], fade: 0, x: 40 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(1);
    expect(getCreatures()[0].state).toBe('fly');
    expect(getCreatures()[0].vy).toBe(-1.2);
  });

  it('estado fly: sobe/avança e desacelera vy', () => {
    wireLife();
    players.length = 0; players.push({ x: 40 * TILE, y: 6 * TILE });
    const s = makeSprite('t');
    getCreatures().push({ K: { alpha: 1, spd: 0, fly: true }, s, fade: 0, x: 40 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'fly', stateT: 0, vy: -1.2 });
    stepLife(1);
    const c = getCreatures()[0];
    expect(c.y).toBeCloseTo(6 * TILE - 1.2);
    expect(c.x).toBeCloseTo(40 * TILE + 0.9);
    expect(c.vy).toBeCloseTo(-1.24); // vy = max(-1.6, -1.2 - 0.04*1)
    expect(c.s.texture).toBe('pf0');
  });

  it('despawna quando nenhum jogador está por perto', () => {
    const { layer } = wireLife();
    const s = makeSprite('t'); layer.addChild(s);
    players.length = 0; players.push({ x: 0, y: 0 }); // bem longe
    getCreatures().push({ K: { alpha: 1, spd: 0 }, s, tex2: ['t0', 't1'], fade: 0, x: 190 * TILE, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(1);
    expect(getCreatures().length).toBe(0);
    expect(layer.children.length).toBe(0);
    expect(s.destroyed).toBe(true);
  });

  it('despawna ao sair pela borda do mundo (x > pxW-8)', () => {
    wireLife();
    const s = makeSprite('t');
    players.length = 0; players.push({ x: (W - 1) * TILE, y: 6 * TILE });
    getCreatures().push({ K: { alpha: 1, spd: 0 }, s, tex2: ['t0', 't1'], fade: 0, x: W * TILE - 4, y: 6 * TILE, dir: 1, animT: 0, f: 0, state: 'walk', stateT: 0, vy: 0 });
    stepLife(1);
    expect(getCreatures().length).toBe(0);
  });

  it('auto-spawn: a cada 60 ticks tenta spawnCreature() mesmo sem chamada manual', () => {
    wireLife(); // cobertura total (streetCols/lifeSurfaceAt cobrem o mapa inteiro) → a tentativa sempre acha vaga
    expect(getCreatures().length).toBe(0);
    // 130 ticks garante cruzar um limiar de 60 mesmo com o contador _lifeSpawnT já avançado por testes anteriores
    for (let i = 0; i < 130; i++) stepLife(1);
    expect(getCreatures().length).toBeGreaterThanOrEqual(1);
  });
});
