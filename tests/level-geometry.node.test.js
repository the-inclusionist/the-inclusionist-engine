// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/level-geometry — geometria derivada do nível (project node). ZOMBIES + Right-BICEP.
// Cobre só a parte PURA (sem PIXI): detecção de degrau→rampa, chão de lava/trampolim, cordas, regiões escuras
// e a lista de power-ups + portão. tileAt/solidTile vêm de core/collision (ligado a um mundo FALSO por teste).
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/level-geometry).
import { describe, it, expect } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import {
  computeRampSteps, computeFloorOverlay, buildWcGeom, computeRopeAnchors, buildDarkRegions,
  buildPowerupList, computeGateTiles, computeGate, isGateInitiallyOpen, setupExtras,
} from '../app/js/game/level-geometry.js';
import { TILE } from '../app/js/core/constants.js';

// 0/1=ar, 2=pedra sólida, 3=água, 5=trampolim, 9=lava. wire() liga core/collision a um mundo FALSO (mesmo
// padrão de tests/collision.node.test.js e tests/elevators.node.test.js).
function wire(grid, wheelchair = false) {
  const W = grid[0].length, H = grid.length;
  COL.initCollision({
    world: grid, W, H,
    isWheelchair: () => wheelchair, isModoCego: () => false, caneDiv: () => 1,
    wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
  });
  return { W, H };
}

describe('computeRampSteps — degrau simples', () => {
  it('acha o degrau SOBE (a plataforma elevada de largura 1 gera subida à esquerda e descida à direita)', () => {
    // col0-1: chão baixo (topo em row2); col2: plataforma elevada (topo em row1); col3: chão baixo de novo.
    const { W, H } = wire([
      [0, 0, 0, 0],
      [0, 0, 2, 0],
      [2, 2, 2, 2],
    ]);
    const steps = computeRampSteps(W, H);
    expect(steps).toContainEqual({ x: 1, y: 2, dir: 'up' });   // sobe da base (x1,y2) para o topo (x2,y1)
    expect(steps).toContainEqual({ x: 2, y: 1, dir: 'down' }); // desce do topo (x2,y1) de volta à base
    expect(steps.length).toBe(2); // nada mais no mapa gera degrau
  });
});

describe('computeRampSteps — degrau duplo (escada de 2)', () => {
  it('cada subida de 1 tile vira o SEU próprio degrau — uma escada de 2 gera 2 entradas', () => {
    // col0: topo em row3; col1: topo em row2 (+1); col2: topo em row1 (+1 de novo) — escada de 2 degraus.
    const { W, H } = wire([
      [0, 0, 0, 0],
      [0, 0, 2, 0],
      [0, 2, 2, 0],
      [2, 2, 2, 2],
    ]);
    const steps = computeRampSteps(W, H);
    expect(steps).toContainEqual({ x: 0, y: 3, dir: 'up' }); // 1º degrau (base → meio)
    expect(steps).toContainEqual({ x: 1, y: 2, dir: 'up' }); // 2º degrau (meio → topo)
  });
});

describe('computeRampSteps — borda do mapa', () => {
  it('não estoura os limites nem inventa degrau na última coluna (fora do mapa = parede natural, não ar)', () => {
    // topo em row1 encostado na borda direita (x=W-1): não há "queda" fantasma além do mapa.
    const { W, H } = wire([
      [0, 0, 0],
      [0, 0, 2],
      [2, 2, 2],
    ]);
    expect(() => computeRampSteps(W, H)).not.toThrow();
    const steps = computeRampSteps(W, H);
    expect(steps.find((s) => s.x === W - 1)).toBeUndefined(); // a coluna x=W-1 nunca é ORIGEM de degrau (loop x<W-1)
  });
});

describe('computeRampSteps — ausência de espaço', () => {
  it('chão liso (sem desnível): nenhum degrau', () => {
    const { W, H } = wire([
      [0, 0, 0, 0, 0],
      [2, 2, 2, 2, 2],
    ]);
    expect(computeRampSteps(W, H)).toEqual([]);
  });
  it('mapa degenerado (1 coluna): loop nunca roda, sem crash', () => {
    const { W, H } = wire([[0], [2]]);
    expect(() => computeRampSteps(W, H)).not.toThrow();
    expect(computeRampSteps(W, H)).toEqual([]);
  });
});

describe('computeFloorOverlay', () => {
  it('marca lava(9) com borda e trampolim(5) sem borda; ignora o resto', () => {
    const { W, H } = wire([[9, 5, 2, 0]]);
    const tiles = computeFloorOverlay(W, H);
    expect(tiles).toContainEqual({ x: 0, y: 0, lava: true });
    expect(tiles).toContainEqual({ x: 1, y: 0, lava: false });
    expect(tiles.find((t) => t.x === 2 || t.x === 3)).toBeUndefined(); // pedra/ar não entram
  });
});

describe('buildWcGeom', () => {
  it('fora do modo cadeirante: nenhuma plataforma só-cadeirante', () => {
    expect(buildWcGeom(false)).toEqual(new Set());
  });
  it('no modo cadeirante: as pontes fixas do corredor (x23-24,y47)', () => {
    const s = buildWcGeom(true);
    expect(s.has('23,47')).toBe(true);
    expect(s.has('24,47')).toBe(true);
    expect(s.size).toBe(2);
  });
});

describe('computeRopeAnchors', () => {
  it('ancora na SUPERFÍCIE da água (água sob ar/estrutura), não no meio da poça', () => {
    const { W, H } = wire([
      [0, 0],
      [3, 3], // superfície (row1: água, row0 acima não é água)
      [3, 3], // meio da poça (row0 acima TAMBÉM é água) — não ancora aqui
    ]);
    const anchors = computeRopeAnchors(W, H);
    expect(anchors).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }]);
  });
  it('poça na primeira linha (y=0): nunca ancora (loop começa em y=1 — sem "acima" pra comparar)', () => {
    const { W, H } = wire([[3, 3]]);
    expect(computeRopeAnchors(W, H)).toEqual([]);
  });
});

describe('buildDarkRegions', () => {
  it('agrupa tiles escuros (0) conectados; ignora bolsão de 1 tile', () => {
    const { W, H } = wire([
      [0, 0, 1, 0],
      [1, 1, 1, 1],
    ]);
    const regions = buildDarkRegions(W, H);
    expect(regions.length).toBe(1); // só o par (0,0)-(1,0); o (3,0) isolado (tamanho 1) é ignorado
    expect(regions[0]).toHaveLength(2);
  });
  it('mapa sem nenhum tile escuro: nenhuma região', () => {
    const { W, H } = wire([[1, 1], [1, 1]]);
    expect(buildDarkRegions(W, H)).toEqual([]);
  });
});

describe('buildPowerupList', () => {
  const mapItems = [
    { tx: 5, ty: 2, kind: 'superjump' },
    { tx: 6, ty: 2, kind: 'fly' },
    { tx: 7, ty: 2, kind: 'turbo' },
    { tx: 8, ty: 2, kind: 'key' },
    { tx: 9, ty: 2, kind: 'wallcling' },
  ];
  it('modo normal: todos os itens, posicionados em px (tx*TILE+2, ty*TILE+2)', () => {
    const list = buildPowerupList(mapItems, { wheelchair: false, blind: false });
    expect(list).toHaveLength(5);
    expect(list[0]).toMatchObject({ x: 5 * TILE + 2, y: 2 * TILE + 2, kind: 'superjump', taken: false, by: [], sprite: null });
  });
  it('cadeirante: só voo/super-corrida/chave sobrevivem', () => {
    const list = buildPowerupList(mapItems, { wheelchair: true, blind: false });
    expect(list.map((p) => p.kind).sort()).toEqual(['fly', 'key', 'turbo']);
  });
  it('cego: o super-pulo vira bengala de corrida (runcane)', () => {
    const list = buildPowerupList(mapItems, { wheelchair: false, blind: true });
    expect(list.find((p) => p.kind === 'superjump')).toBeUndefined();
    expect(list.find((p) => p.kind === 'runcane')).toBeDefined();
  });
  it('lista vazia: sem itens no mapa, sem crash', () => {
    expect(buildPowerupList([], { wheelchair: false, blind: false })).toEqual([]);
  });
});

describe('gate: computeGateTiles / computeGate / isGateInitiallyOpen', () => {
  it('sem portão no mapa: sem tiles, gate=null, já começa aberto', () => {
    expect(computeGateTiles([])).toEqual(new Set());
    expect(computeGate([])).toBeNull();
    expect(isGateInitiallyOpen([])).toBe(true);
  });
  it('com portão: tiles em "tx,ty", gate = a lista, começa FECHADO', () => {
    const mapGate = [{ tx: 10, ty: 4 }, { tx: 10, ty: 5 }];
    expect(computeGateTiles(mapGate)).toEqual(new Set(['10,4', '10,5']));
    expect(computeGate(mapGate)).toBe(mapGate);
    expect(isGateInitiallyOpen(mapGate)).toBe(false);
  });
});

describe('setupExtras — orquestrador puro', () => {
  it('combina a lista de power-ups + o estado do portão num só resultado', () => {
    const mapItems = [{ tx: 1, ty: 1, kind: 'fly' }];
    const mapGate = [{ tx: 2, ty: 2 }];
    const ex = setupExtras(mapItems, mapGate, { wheelchair: false, blind: false });
    expect(ex.powerups).toHaveLength(1);
    expect(ex.gateTiles).toEqual(new Set(['2,2']));
    expect(ex.gate).toBe(mapGate);
    expect(ex.gateOpen).toBe(false);
  });
});
