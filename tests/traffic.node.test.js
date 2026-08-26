// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/traffic — trânsito da Cidade: cadência do semáforo, nascimento/física dos carros e a camada
// PIXI injetada (project NODE: Graphics/Sprite falsos). Padrões: ZOMBIES + Right-BICEP. Comportamento verbatim
// do monólito (game.js drawSemaforo/initTraffic/spawnCar/setFrontDim/stepTraffic). Ver docs/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { reseed } from '../app/js/core/rng.js';
import { setCenarioValue } from '../app/js/game/state.js'; // GAME desde a Fase B (ADR-0038)
import {
  lightStateAt, planCarSpawn, nextSpawnThreshold, isBeforeStopLine, shouldBrake, advanceCar, isOffscreen,
  initTraffic, drawSemaforo, spawnCar, setFrontDim, stepTraffic, clearCars, getCars, getStreetY, SEM,
} from '../app/js/game/traffic.js';

/* ===================== helpers: camadas PIXI falsas (estruturais — sem depender do PIXI real) ===================== */
function fakeGfx() {
  const rec = { clears: 0, fills: 0, rects: 0 };
  const g = {
    clear: () => { rec.clears++; }, beginFill: () => { rec.fills++; return g; },
    drawRect: () => { rec.rects++; return g; }, endFill: () => g,
  };
  g._rec = rec; return g;
}
function fakeLayer() {
  const rec = { added: 0, removed: 0 };
  const layer = { children: [], addChild: (c) => { rec.added++; layer.children.push(c); }, removeChild: (c) => { rec.removed++; layer.children = layer.children.filter((x) => x !== c); } };
  layer._rec = rec; return layer;
}
class FakeSprite { constructor(tex) { this.texture = tex; this.x = 0; this.y = 0; this.tint = 0xffffff; this.alpha = 1; this.scale = { x: 1 }; this._destroyed = false; this.anchor = { set: () => {} }; }
  destroy() { this._destroyed = true; } }

function setup(over = {}) {
  const carLayer = fakeLayer();
  const CAR_TEX = [{}, {}, {}, {}];
  const ctx = {
    // Construtor virou FÁBRICA (Fase D): a porta pede o verbo, não a classe. Ver `render/port`.
    carLayer, CAR_TEX, criarSprite: (t) => new FakeSprite(t), criarDesenho: () => new fakeGfx(),
    WORLD_PX_W: 100, WORLD_PX_H: 200, WORLD_W: 20,
    getRm: () => over.rm || {},
  };
  initTraffic(ctx);
  return { carLayer };
}

beforeEach(() => { reseed(20260601); setCenarioValue('cidade'); setFrontDim(false); clearCars(); }); // isola _frontDim/cars entre testes (SEM.t/state/pole ficam por conta de cada teste — só o boot os fixa de novo)

/* ===================== PURE: cadência do semáforo ===================== */
describe('lightStateAt (cadência do semáforo — ciclo de 16s, sem flashes/WCAG 2.3.1)', () => {
  it('[Zero] t=0 → green', () => { expect(lightStateAt(0)).toBe('green'); });
  it('[Happy] green por 8s (0..479 em unidades de 60), depois yellow por 2s, depois red por 6s', () => {
    expect(lightStateAt(479)).toBe('green');
    expect(lightStateAt(480)).toBe('yellow');
    expect(lightStateAt(599)).toBe('yellow');
    expect(lightStateAt(600)).toBe('red');
    expect(lightStateAt(959)).toBe('red');
  });
  it('[Boundary] o ciclo de 16s se repete (t e t+16·60 dão o mesmo estado)', () => {
    expect(lightStateAt(100)).toBe(lightStateAt(100 + 16 * 60));
  });
});

/* ===================== PURE: nascimento do carro ===================== */
describe('planCarSpawn (quando/onde nasce um carro)', () => {
  it('[Interface] rnd<0.5 → nasce à direita da tela, indo p/ dir=+1', () => {
    expect(planCarSpawn(() => 0.1, 100)).toEqual({ dir: 1, x: -90 });
  });
  it('[Interface] rnd>=0.5 → nasce fora à direita do mundo, indo p/ dir=-1', () => {
    expect(planCarSpawn(() => 0.9, 100)).toEqual({ dir: -1, x: 190 });
  });
});
describe('nextSpawnThreshold', () => {
  it('[Range] sempre em [420, 720)', () => {
    for (const r of [0, 150, 299]) expect(nextSpawnThreshold((lo, hi) => { expect(lo).toBe(0); expect(hi).toBe(300); return r; })).toBe(420 + r);
  });
});

/* ===================== PURE: linha de parada + frenagem + avanço por dt ===================== */
describe('isBeforeStopLine / shouldBrake (colisão com a faixa de retenção)', () => {
  it('[Boundary] exatamente 44px à frente NÃO conta como "antes" (>44, estrito)', () => {
    expect(isBeforeStopLine(56, 1, 100)).toBe(false); // 100-56=44
    expect(isBeforeStopLine(55, 1, 100)).toBe(true);  // 45 > 44
  });
  it('[Happy] freia no amarelo/vermelho dentro da janela (44,140); não freia no verde', () => {
    expect(shouldBrake(50, 1, 100, 'red')).toBe(true);   // dist=50, em (44,140)
    expect(shouldBrake(50, 1, 100, 'yellow')).toBe(true);
    expect(shouldBrake(50, 1, 100, 'green')).toBe(false);
  });
  it('[Boundary] fora da janela de frenagem (muito longe ou já passou) não freia mesmo no vermelho', () => {
    expect(shouldBrake(-50, 1, 100, 'red')).toBe(false); // dist=150 ≥ 140
    expect(shouldBrake(120, 1, 100, 'red')).toBe(false); // já passou a linha (dist=-20)
  });
  it('[Direction] o sentido -1 espelha a lógica (carro vindo da direita)', () => {
    expect(shouldBrake(150, -1, 100, 'red')).toBe(true); // dist=(100-150)*-1=50
  });
});
describe('advanceCar (avanço físico por dt)', () => {
  it('[Happy] em verde, acelera rumo à velocidade de cruzeiro (±0,08/quadro) e integra x', () => {
    const r = advanceCar({ x: 0, dir: 1, vx: 0 }, 1, 1000, 'green'); // sem semáforo por perto
    expect(r.vx).toBeCloseTo(0.08);
    expect(r.x).toBeCloseTo(0.08);
  });
  it('[Boundary] freando, some a velocidade some perto de 0 (satura em 0 quando |vx|<0.03)', () => {
    const r = advanceCar({ x: 50, dir: 1, vx: 0.02 }, 1, 100, 'red'); // dentro da janela de frenagem
    expect(r.vx).toBe(0);
  });
  it('[Zero] dt=0 não move nem acelera', () => {
    const r = advanceCar({ x: 10, dir: 1, vx: 1 }, 0, 1000, 'green');
    expect(r).toEqual({ x: 10, vx: 1 });
  });
});
describe('isOffscreen', () => {
  it('[Boundary] margem de 100px em cada lado', () => {
    expect(isOffscreen(-100, 100)).toBe(false);
    expect(isOffscreen(-100.01, 100)).toBe(true);
    expect(isOffscreen(200, 100)).toBe(false);
    expect(isOffscreen(200.01, 100)).toBe(true);
  });
});

/* ===================== DI + PIXI: initTraffic/drawSemaforo/spawnCar/setFrontDim/stepTraffic ===================== */
describe('initTraffic (DI — camadas injetadas, nunca globais)', () => {
  it('[Boot] centra o semáforo, desenha o poste + placas de PARE (2 Graphics no carLayer)', () => {
    const { carLayer } = setup();
    expect(SEM.x).toBe(50); // round(WORLD_PX_W/2) = round(100/2)
    expect(SEM.y).toBe(200); // STREET_Y = WORLD_PX_H
    expect(getStreetY()).toBe(200);
    expect(carLayer._rec.added).toBe(2); // SEM.pole + placas
    expect(SEM.pole._rec.fills).toBeGreaterThan(0); // drawSemaforo já rodou
  });
});

describe('drawSemaforo', () => {
  it('[Happy] limpa e redesenha a cada chamada (não acumula)', () => {
    setup();
    const before = SEM.pole._rec.clears;
    drawSemaforo();
    expect(SEM.pole._rec.clears).toBe(before + 1);
  });
});

describe('spawnCar', () => {
  it('[Happy] nasce fora da tela, com anchor/scale corretos, e some para a camada', () => {
    const { carLayer } = setup();
    const added0 = carLayer._rec.added;
    const ok = spawnCar();
    expect(ok).toBe(true);
    expect(carLayer._rec.added).toBe(added0 + 1);
    expect(getCars().length).toBe(1);
    const c = getCars()[0];
    expect(Math.abs(c.x)).toBeGreaterThan(80); // nasce fora do mundo (WORLD_PX_W=100)
  });
  it('[Boundary] satura em 3 carros', () => {
    setup();
    spawnCar(); spawnCar(); spawnCar();
    expect(getCars().length).toBe(3);
    expect(spawnCar()).toBe(false);
    expect(getCars().length).toBe(3);
  });
  it('[Interface] se front-dim já está ligado, o carro nasce já escurecido', () => {
    setup();
    setFrontDim(true);
    clearCars(); // setFrontDim não mexe em cars; garante estado limpo antes de nascer 1
    spawnCar();
    const s = getCars()[0].s;
    expect(s.tint).toBe(0x4a5058);
    expect(s.alpha).toBe(0.55);
  });
});

describe('setFrontDim (alto contraste: frente escurece como o fundo)', () => {
  it('[Happy] escurece TODOS os filhos do carLayer (semáforo/placas/carros)', () => {
    const { carLayer } = setup();
    spawnCar();
    setFrontDim(true);
    for (const ch of carLayer.children) { expect(ch.tint).toBe(0x4a5058); expect(ch.alpha).toBe(0.55); }
    setFrontDim(false);
    for (const ch of carLayer.children) { expect(ch.tint).toBe(0xffffff); expect(ch.alpha).toBe(1); }
  });

  // 2026-08-26: o módulo passou a esmaecer O QUE ELE CRIOU (`_ambientes`) em vez de varrer
  // `carLayer.children`. Os dois conjuntos coincidem hoje — e é justamente por coincidirem que o caso
  // acima não distingue um do outro. Este distingue.
  //
  // A camada é da raiz de composição: ela solda o z-order do `carLayer` e pode pendurar qualquer coisa
  // ali. "Escureça tudo o que estiver nesta camada" nunca foi a regra — a regra é que a SINALIZAÇÃO e os
  // CARROS são ambiente e recuam junto com o fundo (WCAG 1.4.11: o que compete com plataforma e item
  // precisa parar de competir no alto contraste). Um filho alheio não é ambiente deste módulo.
  //
  // MUTAÇÃO CONFERIDA: com `_ambientes.forEach` de volta em `ctx.carLayer.children.forEach`, este caso
  // falha em `intruso.tint` — "expected 4870232 to be 16711680".
  it('[Regra] NÃO escurece o que outro módulo pendurou na mesma camada', () => {
    const { carLayer } = setup();
    spawnCar();
    const intruso = { tint: 0xff0000, alpha: 1 }; // p.ex. um efeito que a raiz decida pôr na frente
    carLayer.addChild(intruso);
    setFrontDim(true);
    expect(intruso.tint).toBe(0xff0000);
    expect(intruso.alpha).toBe(1);
    const meus = carLayer.children.filter((c) => c !== intruso);
    expect(meus.length).toBeGreaterThan(0);
    for (const ch of meus) expect(ch.tint).toBe(0x4a5058);
  });
});

describe('clearCars', () => {
  it('[Happy] destrói e esvazia; é seguro chamar de novo (idempotente)', () => {
    const { carLayer } = setup();
    spawnCar(); spawnCar();
    const removed0 = carLayer._rec.removed;
    clearCars();
    expect(getCars().length).toBe(0);
    expect(carLayer._rec.removed).toBe(removed0 + 2);
    clearCars(); // não deve lançar nem remover de novo
    expect(carLayer._rec.removed).toBe(removed0 + 2);
  });
});

describe('stepTraffic', () => {
  it('[Gate] fora da Cidade, não faz nada (trânsito é peculiaridade L6 da Cidade)', () => {
    setup();
    setCenarioValue('campo');
    const stBefore = SEM.state;
    stepTraffic(100000);
    expect(SEM.state).toBe(stBefore);
    expect(getCars().length).toBe(0);
  });
  it('[Happy] o tempo avança o relógio do semáforo e troca de estado ao cruzar o limiar (SEM.t/60=8 → yellow)', () => {
    setup();
    expect(SEM.state).toBe('green');
    stepTraffic(480); // SEM.t: 0→480 → cyc=(480/60)%16=8 → yellow (mesmo limiar do teste puro de lightStateAt)
    expect(SEM.state).toBe('yellow');
  });
  it('[Zero] rm.decor nunca deixa nascer/permanecer carro (sinalização fica, trânsito sai)', () => {
    const { carLayer } = setup({ rm: { decor: true } });
    stepTraffic(1);
    expect(getCars().length).toBe(0);
    expect(carLayer._rec.added).toBe(2); // só o poste + placas — nenhum carro
  });
  it('[Happy] um carro nascido avança em x com o passo do tempo', () => {
    setup();
    spawnCar();
    const c = getCars()[0];
    const x0 = c.x;
    stepTraffic(10);
    expect(c.x).not.toBe(x0);
    expect(c.s.x).toBe(Math.round(c.x));
  });
});
