// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-city (project NODE: camadas Graphics/Layer falsas injetadas). Cobre a seleção de
// tile/decoração por posição (funções puras, hash em tx/ty — sem PIXI) e o contrato de initSceneCity:
// buildCityDeco (fachada/caixa-d'água/abandonado), applyCenarioVida (orquestrador fino, chama onCenarioChange
// em vez de tocar carLayer/cars de game/traffic) e stepTileFx (água/lava, com dedupe por célula entre jogadores).
// Ver docs/game-design/plano-cenario-cidade.md e docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import {
  initSceneCity,
  isStreetlampColumn, isSignageColumn, signageColor, SIGNAGE_COLORS,
  abandonedDecorKind, graffitiColor, GRAFFITI_COLORS,
  lavaStreakOffset, waterBedHash, waterBedKind, coralColor, CORAL_COLORS,
  fishHash, fishSpawnsAt, fishColor, FISH_COLORS,
} from '../app/js/render/scene-city.js';

// ---- camadas falsas (mesmo padrão de tests/scene-sky-decor.node.test.js) ----
function fakeGfx() {
  const rec = { clears: 0, fills: 0, rects: 0 };
  const g = {
    visible: true,
    clear: () => { rec.clears++; },
    beginFill: () => { rec.fills++; return g; },
    drawRect: () => { rec.rects++; return g; },
    endFill: () => g,
  };
  g._rec = rec; return g;
}
function fakeLayer() { return { visible: true }; }

function setup(over = {}) {
  const cityDecoG = fakeGfx(), abandonG = fakeGfx(), lavaFxG = fakeGfx(), waterFxG = fakeGfx(), skyLayer = fakeLayer();
  const WORLD_W = over.WORLD_W ?? 4, WORLD_H = over.WORLD_H ?? 4, TILE = 16;
  const ctx = {
    cityDecoG, abandonG, lavaFxG, waterFxG, skyLayer,
    darkRegions: over.darkRegions ?? [],
    solidAt: over.solidAt ?? (() => false), tileAt: over.tileAt ?? (() => 0),
    lifeSurfaceAt: over.lifeSurfaceAt ?? (() => WORLD_H - 9),
    WORLD_W, WORLD_H, TILE,
    WORLD_PX_W: over.WORLD_PX_W ?? WORLD_W * TILE, WORLD_PX_H: over.WORLD_PX_H ?? WORLD_H * TILE,
    LOGICAL_W: over.LOGICAL_W ?? WORLD_W * TILE, LOGICAL_H: over.LOGICAL_H ?? WORLD_H * TILE, BOX: { h: 16 },
    DIRECT_CFG: over.DIRECT_CFG ?? {},
    getCenario: () => over.cenario ?? 'cidade', getVizMode: () => over.vizMode ?? 'normal',
    getPlayers: () => over.players ?? [], getFxClock: () => over.t ?? 0, getRm: () => over.rm ?? {},
    onCenarioChange: over.onCenarioChange,
  };
  return { city: initSceneCity(ctx), layers: { cityDecoG, abandonG, lavaFxG, waterFxG, skyLayer } };
}

describe('render/scene-city · seleção de tile/decoração (funções puras)', () => {
  it('[Zero/Interface] isStreetlampColumn: só tx % 11 === 4', () => {
    expect(isStreetlampColumn(4)).toBe(true);
    expect(isStreetlampColumn(15)).toBe(true); // 15 % 11 === 4
    expect(isStreetlampColumn(5)).toBe(false);
  });
  it('[Zero/Interface] isSignageColumn: só tx % 9 === 2', () => {
    expect(isSignageColumn(2)).toBe(true);
    expect(isSignageColumn(11)).toBe(true); // 11 % 9 === 2
    expect(isSignageColumn(3)).toBe(false);
  });
  it('[Boundary] signageColor cicla pelas 4 cores por tx % 4', () => {
    for (let tx = 0; tx < 8; tx++) expect(signageColor(tx)).toBe(SIGNAGE_COLORS[tx % 4]);
  });
  it('[Determinismo] abandonedDecorKind é puro e bate com a fórmula (tx*13+ty*7)%10', () => {
    expect(abandonedDecorKind(0, 2)).toBe(4); // viga exposta
    expect(abandonedDecorKind(0, 1)).toBe(7); // pichação
    expect(abandonedDecorKind(0, 0)).toBe(0); // candidato a entulho (depende de solidAt no chamador)
    expect(abandonedDecorKind(3, 5)).toBe(abandonedDecorKind(3, 5)); // mesmo input → mesmo output
  });
  it('[Boundary] graffitiColor cicla pelas 3 cores por tx % 3', () => {
    for (let tx = 0; tx < 6; tx++) expect(graffitiColor(tx)).toBe(GRAFFITI_COLORS[tx % 3]);
  });
  it('[Interface] lavaStreakOffset avança 1 a cada 8 ticks do fxClock e dá wrap em 4', () => {
    expect(lavaStreakOffset(0, 0)).toBe(0);
    expect(lavaStreakOffset(8, 0)).toBe(1);
    expect(lavaStreakOffset(0, 4)).toBe(0); // wrap: (0+4)%4
    expect(lavaStreakOffset(0, 5)).toBe(1);
  });
  it('[Determinismo] waterBedHash/waterBedKind e coralColor são puros e estáveis', () => {
    expect(waterBedHash(7)).toBe(waterBedHash(7));
    expect(waterBedKind(7)).toBe(waterBedHash(7) % 3);
    expect(coralColor(7)).toBe(CORAL_COLORS[(waterBedHash(7) >>> 3) % 3]);
  });
  it('[Boundary] fishSpawnsAt é ~1/7 das células (hash % 7 === 0)', () => {
    let n = 0; for (let tx = 0; tx < 700; tx++) if (fishSpawnsAt(tx, 3)) n++;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(700);
    expect(fishSpawnsAt(1, 3)).toBe(fishHash(1, 3) % 7 === 0);
  });
  it('[Interface] fishColor deriva do mesmo hash de fishSpawnsAt', () => {
    expect(fishColor(1, 3)).toBe(FISH_COLORS[fishHash(1, 3) % 3]);
  });
});

describe('render/scene-city · initSceneCity/buildCityDeco', () => {
  it('[Zero] sempre limpa cityDecoG e abandonG primeiro', () => {
    const { city, layers } = setup({ lifeSurfaceAt: () => -100 }); // nada elegível → só o clear conta
    city.buildCityDeco();
    expect(layers.cityDecoG._rec.clears).toBe(1);
    expect(layers.abandonG._rec.clears).toBe(1);
  });

  it('[Boundary] coluna com ty < BASE_TY (WORLD_H-9) não desenha calçada', () => {
    const { city, layers } = setup({ WORLD_H: 20, lifeSurfaceAt: () => 5 }); // BASE_TY=11 > 5 → sempre pula
    city.buildCityDeco();
    expect(layers.cityDecoG._rec.fills).toBe(0);
  });

  it('[Happy] coluna elegível desenha calçada+meio-fio (2 fills mínimo por coluna)', () => {
    const { city, layers } = setup({ WORLD_W: 3, lifeSurfaceAt: () => 3 }); // BASE_TY = 4-9 = -5 → toda ty>=BASE_TY
    city.buildCityDeco();
    expect(layers.cityDecoG._rec.fills).toBeGreaterThanOrEqual(2); // ao menos 1 coluna interna (tx=1..WORLD_W-2)
  });

  it('[Interface] coluna de poste (tx%11===4) soma fills extras de lâmpada/halo', () => {
    const base = setup({ WORLD_W: 3, lifeSurfaceAt: () => 3 });
    base.city.buildCityDeco();
    const lamp = setup({ WORLD_W: 16, lifeSurfaceAt: () => 3 }); // inclui tx=4 (poste)
    lamp.city.buildCityDeco();
    // por coluna a base é 2 fills; com 14 colunas internas (tx=1..14) e 1 poste em tx=4 → 14*2+4 fills
    expect(lamp.layers.cityDecoG._rec.fills).toBe(14 * 2 + 4);
  });

  it('[Interface] coluna de letreiro (tx%9===2) só desenha com solidAt(tx,ty-3)', () => {
    const solidAt = (tx, ty) => tx === 2; // só a coluna 2 tem parede acima → habilita o letreiro
    const { city, layers } = setup({ WORLD_W: 4, lifeSurfaceAt: () => 3, solidAt });
    city.buildCityDeco();
    // tx=1..2 internas: tx=1 → 2 fills (sem poste/letreiro); tx=2 → 2 (calçada) + 3 (letreiro) = 5
    expect(layers.cityDecoG._rec.fills).toBe(2 + 5);
  });

  it('[Happy] caixa d\'água: bounding box de tiles===3 desenha paredes + linha d\'água', () => {
    const tileAt = (tx, ty) => (tx === 2 && ty === 1 ? 3 : 0);
    const { city, layers } = setup({ WORLD_W: 4, WORLD_H: 4, lifeSurfaceAt: () => -100, tileAt });
    city.buildCityDeco();
    expect(layers.cityDecoG._rec.fills).toBeGreaterThan(0); // paredes (1) + rebite (1x, laço de 1 iteração) + linha d'água (1)
  });

  it('[Zero] sem tile de água (tileAt nunca 3), a caixa d\'água não desenha nada', () => {
    const { city, layers } = setup({ lifeSurfaceAt: () => -100 });
    city.buildCityDeco();
    expect(layers.cityDecoG._rec.fills).toBe(0);
  });

  it('[Happy] darkRegions: h===4 desenha viga exposta em abandonG', () => {
    const darkRegions = [{ set: new Set(['0,2']) }]; // abandonedDecorKind(0,2) === 4
    const { city, layers } = setup({ lifeSurfaceAt: () => -100, darkRegions });
    city.buildCityDeco();
    expect(layers.abandonG._rec.fills).toBe(1);
  });

  it('[Happy] darkRegions: h===7 desenha pichação em abandonG', () => {
    const darkRegions = [{ set: new Set(['0,1']) }]; // abandonedDecorKind(0,1) === 7
    const { city, layers } = setup({ lifeSurfaceAt: () => -100, darkRegions });
    city.buildCityDeco();
    expect(layers.abandonG._rec.fills).toBe(1);
  });

  it('[Boundary] darkRegions: h<3 só desenha entulho se solidAt(tx,ty+1)', () => {
    const darkRegions = [{ set: new Set(['0,0']) }]; // abandonedDecorKind(0,0) === 0 (<3)
    const off = setup({ lifeSurfaceAt: () => -100, darkRegions, solidAt: () => false });
    off.city.buildCityDeco();
    expect(off.layers.abandonG._rec.fills).toBe(0);
    const on = setup({ lifeSurfaceAt: () => -100, darkRegions, solidAt: () => true });
    on.city.buildCityDeco();
    expect(on.layers.abandonG._rec.fills).toBe(2); // entulho = 2 beginFill (base + sombra)
  });
});

describe('render/scene-city · initSceneCity/applyCenarioVida (orquestrador fino)', () => {
  it('[Happy] cenário "cidade": liga cityDecoG/skyLayer e avisa onCenarioChange(true)', () => {
    let called;
    const { city, layers } = setup({ cenario: 'cidade', onCenarioChange: (city2) => { called = city2; } });
    layers.cityDecoG.visible = false; layers.skyLayer.visible = false;
    city.applyCenarioVida();
    expect(layers.cityDecoG.visible).toBe(true);
    expect(layers.skyLayer.visible).toBe(true);
    expect(called).toBe(true);
  });

  it('[Boundary] outro cenário: desliga as camadas e avisa onCenarioChange(false)', () => {
    let called;
    const { city, layers } = setup({ cenario: 'floresta', onCenarioChange: (city2) => { called = city2; } });
    city.applyCenarioVida();
    expect(layers.cityDecoG.visible).toBe(false);
    expect(layers.skyLayer.visible).toBe(false);
    expect(called).toBe(false);
  });

  it('[Exception] sem onCenarioChange injetado, não lança (hook é opcional)', () => {
    const { city } = setup({ cenario: 'cidade' });
    expect(() => city.applyCenarioVida()).not.toThrow();
  });

  it('[Fronteira] applyCenarioVida NUNCA toca carLayer/cars — só chama o hook injetado', () => {
    // Contrato de módulo: game/traffic reage sozinho via onCenarioChange (o coordenador liga os dois).
    const seen = [];
    const { city } = setup({ cenario: 'cidade', onCenarioChange: (c) => seen.push(c) });
    city.applyCenarioVida();
    expect(seen).toEqual([true]); // única forma de efeito fora do módulo é o hook
  });
});

describe('render/scene-city · initSceneCity/stepTileFx', () => {
  const player = (x = 32, y = 32) => ({ x, y, quit: false });

  it('[Zero] sempre limpa lavaFxG e waterFxG primeiro', () => {
    const { city, layers } = setup({ players: [] });
    city.stepTileFx();
    expect(layers.lavaFxG._rec.clears).toBe(1);
    expect(layers.waterFxG._rec.clears).toBe(1);
  });

  it('[Gate] alto contraste (DIRECT_CFG[vizMode]) sai após limpar, sem desenhar', () => {
    const tileAt = () => 9;
    const { city, layers } = setup({ players: [player()], tileAt, vizMode: 'hc-direto', DIRECT_CFG: { 'hc-direto': {} } });
    city.stepTileFx();
    expect(layers.lavaFxG._rec.fills).toBe(0);
  });

  it('[Gate] rm.decor sai após limpar, sem desenhar', () => {
    const tileAt = () => 9;
    const { city, layers } = setup({ players: [player()], tileAt, rm: { decor: true } });
    city.stepTileFx();
    expect(layers.lavaFxG._rec.fills).toBe(0);
  });

  it('[Zero] jogador de fora (pl.quit) é ignorado', () => {
    const tileAt = () => 9;
    const { city, layers } = setup({ players: [{ x: 32, y: 32, quit: true }], tileAt });
    city.stepTileFx();
    expect(layers.lavaFxG._rec.fills).toBe(0);
  });

  it('[Happy] tile de lava (9) desenha no lavaFxG e nunca no waterFxG', () => {
    const tileAt = (tx, ty) => (tx === 1 && ty === 1 ? 9 : 0);
    const { city, layers } = setup({ players: [player()], tileAt });
    city.stepTileFx();
    expect(layers.lavaFxG._rec.fills).toBe(1);
    expect(layers.waterFxG._rec.fills).toBe(0);
  });

  it('[Happy] tile de água (3) com leito sólido abaixo desenha onda+leito no waterFxG', () => {
    const tileAt = (tx, ty) => (tx === 1 && ty === 1 ? 3 : 0);
    const solidAt = (tx, ty) => tx === 1 && ty === 2; // leito embaixo da água
    const { city, layers } = setup({ players: [player()], tileAt, solidAt });
    city.stepTileFx();
    expect(layers.waterFxG._rec.fills).toBeGreaterThan(0);
    expect(layers.lavaFxG._rec.fills).toBe(0);
  });

  it('[Happy] água aberta (sem leito) desenha peixe só quando fishSpawnsAt', () => {
    const tileAt = (tx, ty) => (tx === 1 && ty === 1 ? 3 : 0);
    const withFish = fishSpawnsAt(1, 1);
    const { city, layers } = setup({ players: [player()], tileAt, solidAt: () => false });
    city.stepTileFx();
    // onda de superfície (1) + linha de topo (1) sempre; +2 (peixe+olho) só se fishSpawnsAt(1,1)
    expect(layers.waterFxG._rec.fills).toBe(withFish ? 4 : 2);
  });

  it('[Dedupe] dois jogadores cobrindo a mesma célula não desenham em dobro', () => {
    const tileAt = (tx, ty) => (tx === 1 && ty === 1 ? 9 : 0);
    const one = setup({ players: [player(32, 32)], tileAt });
    one.city.stepTileFx();
    const two = setup({ players: [player(32, 32), player(30, 30)], tileAt });
    two.city.stepTileFx();
    expect(two.layers.lavaFxG._rec.fills).toBe(one.layers.lavaFxG._rec.fills);
  });
});
