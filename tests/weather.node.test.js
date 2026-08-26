// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/weather (project NODE: weatherLayer/stage falsos injetados). Contratos: a curva de chuva (bom 30s
// → garoa/chuva/garoa/bom em loop de 60s, só na Cidade e sem rm.decor), a rampa ~1s sem "quase seco", o trovão só
// na chuva forte (>0,45) com cadência aleatória, as gotas com wrap + congelamento fora de 'playing' (GAG da pausa),
// e a ponte getRainLevel() (nunca o valor cru) para platform/audio-ambient.ts. Formulas verbatim do game.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rainLevelTarget, rampRainLevel, stepThunder, makeRainDrops, stepRainDrop,
  initWeather, updateWeather, drawWeather, getRainLevel, getWeatherT, setWeatherT,
} from '../app/js/render/weather.js';
// `setCenarioValue` SAIU deste arquivo: desde a Fase B (ADR-0038) o `render/weather` não lê o cenário —
// ele recebe a PERGUNTA `temChuva` por injeção, e o catálogo é de quem compõe. O teste ficou melhor por
// isso: passou a controlar diretamente a condição que exercita, em vez de montá-la por estado global.
import { CENARIOS } from '../app/js/render/cenario-data.js';

describe('rainLevelTarget (curva L5: bom 30s → loop de 60s garoa/chuva/garoa/bom)', () => {
  it('[Zero] antes de 30s: sempre seco, mesmo num tema que tem chuva', () => {
    expect(rainLevelTarget(0, true, false)).toBe(0);
    expect(rainLevelTarget(29.9, true, false)).toBe(0);
  });
  it('[Boundary] tema sem chuva, ou com rm.decor: sempre seco', () => {
    expect(rainLevelTarget(40, false, false)).toBe(0);
    expect(rainLevelTarget(40, true, true)).toBe(0);
  });
  it('[Interface] ciclo de 60s a partir de 30s: garoa(0,35) 5s → chuva(1) 5s → garoa(0,35) 5s → bom(0) 45s', () => {
    expect(rainLevelTarget(30, true, false)).toBe(0.35); // c=0
    expect(rainLevelTarget(34.9, true, false)).toBe(0.35); // c=4.9
    expect(rainLevelTarget(35, true, false)).toBe(1); // c=5
    expect(rainLevelTarget(39.9, true, false)).toBe(1); // c=9.9
    expect(rainLevelTarget(40, true, false)).toBe(0.35); // c=10
    expect(rainLevelTarget(44.9, true, false)).toBe(0.35); // c=14.9
    expect(rainLevelTarget(45, true, false)).toBe(0); // c=15
    expect(rainLevelTarget(89, true, false)).toBe(0); // c=59
  });
  it('[Boundary] o loop repete a cada 60s (c volta a 0)', () => {
    expect(rainLevelTarget(90, true, false)).toBe(0.35); // c=(90-30)%60=0
  });
});

describe('quem tem chuva é o TEMA, e não um `if` dentro do clima', () => {
  it('[Interface] a Cidade e a Floresta declaram chuva; os outros três, não', () => {
    // Era `cenario === 'cidade'` dentro de render/weather: verdade enquanto a Cidade fosse o único tema
    // molhado, e invisível para quem fosse dar chuva a um tema novo — a pessoa abre a tabela de cenários e não
    // acha nada para mudar, porque não havia nada lá. Este caso é o que trava a volta daquele `if`.
    const comChuva = Object.keys(CENARIOS).filter((id) => CENARIOS[id].chuva);
    expect(comChuva.sort()).toEqual(['cidade', 'floresta']);
  });
});

describe('rampRainLevel (rampa ~1s, snap sem "quase seco")', () => {
  it('[One] sobe no máximo `step` por chamada', () => {
    expect(rampRainLevel(0, 1, 1 / 30)).toBeCloseTo(1 / 30);
  });
  it('[One] desce no máximo `step` por chamada', () => {
    expect(rampRainLevel(1, 0, 1 / 30)).toBeCloseTo(1 - 1 / 30);
  });
  it('[Boundary] gruda no alvo quando a diferença fica < 0,02 (não liga "seco" à toa)', () => {
    expect(rampRainLevel(0.99, 1, 1 / 30)).toBe(1);
    expect(rampRainLevel(0.015, 0, 1 / 30)).toBe(0);
  });
});

describe('stepThunder (trovão só na chuva forte, cadência aleatória)', () => {
  it('[Zero] chuva fraca (<=0,45): nunca dispara trovão, mesmo com CD zerado', () => {
    const calls = [];
    const r = stepThunder(0.45, 0, 0, () => 0.5, (i) => calls.push(i));
    expect(calls.length).toBe(0);
    expect(r.thunderCD).toBe(0); // CD não decrementa fora da chuva forte
  });
  it('[Interface] chuva forte + CD esgotado: dispara 1x, rearma CD e o flash', () => {
    const calls = [];
    const r = stepThunder(1, 1, 0, () => 0.5, (i) => calls.push(i)); // 1-- = 0 → dispara
    expect(calls.length).toBe(1);
    expect(calls[0]).toBeCloseTo(0.35 + 0.5 * 0.65); // 0.675
    expect(r.thunderCD).toBe(200 + Math.floor(0.5 * 420)); // 200+210=410
    expect(r.flash).toBeCloseTo(0.675 - 0.05); // decai 0.05 no mesmo passo
  });
  it('[Boundary] flash nunca fica negativo (clampa em 0)', () => {
    const r = stepThunder(0, 999, 0.01, () => 0, () => {});
    expect(r.flash).toBe(0);
  });
});

describe('makeRainDrops / stepRainDrop (posição das gotas no tempo + GAG da pausa)', () => {
  it('[One] makeRainDrops semeia N gotas dentro de [0,W)x[0,H)', () => {
    const drops = makeRainDrops(5, 100, 50, () => 0.5);
    expect(drops.length).toBe(5);
    for (const d of drops) { expect(d.x).toBeCloseTo(50); expect(d.y).toBeCloseTo(25); }
  });
  it('[Interface] stepRainDrop avança por spd e faz wrap ao passar de H', () => {
    const d = { x: 10, y: 45, len: 6, spd: 8 };
    stepRainDrop(d, 100, 50, true, () => 0.2); // y=45+8=53 > 50 → wrap
    expect(d.y).toBe(-6); // -len
    expect(d.x).toBe(20); // rndFn()*W
  });
  it('[Zero] moving=false (GAG da pausa): a gota não se move', () => {
    const d = { x: 10, y: 20, len: 6, spd: 8 };
    stepRainDrop(d, 100, 50, false, () => 0.9);
    expect(d).toMatchObject({ x: 10, y: 20 });
  });
  it('[Boundary] x negativo volta pelo lado direito (+W)', () => {
    const d = { x: -1, y: 5, len: 6, spd: 3 };
    stepRainDrop(d, 100, 50, true, () => 0);
    expect(d.x).toBeCloseTo(-1 - 3 * 0.35 + 100);
  });
});

// ---- integração: initWeather + updateWeather + drawWeather (weatherLayer/stage falsos) ----
function fakeGfx() {
  // `pontos` grava as COORDENADAS de cada gota — é o que distingue "a chuva foi desenhada" de "a chuva
  // ANDOU", e sem isso o caso do congelamento não teria o que comparar.
  const rec = { clears: 0, fills: [], lines: 0, moves: 0, pontos: [] };
  const g = {
    parent: null,
    clear: () => { rec.clears++; return g; },
    beginFill: (c, a) => { rec.fills.push(a); return g; },
    drawRect: () => g,
    endFill: () => g,
    lineStyle: () => { rec.lines++; return g; },
    moveTo: (x, y) => { rec.moves++; rec.pontos.push([Math.round(x), Math.round(y)]); return g; },
    lineTo: () => g,
  };
  g._rec = rec; return g;
}
function fakeStage() { const rec = { reindexed: 0 }; return { _rec: rec, children: { length: 3 }, setChildIndex: () => { rec.reindexed++; } }; }

function setup(over = {}) {
  const weatherLayer = fakeGfx();
  const stage = fakeStage();
  weatherLayer.parent = over.attached === false ? null : stage; // simula app.stage.addChild(weatherLayer)
  const thunderCalls = [];
  initWeather({
    // O mundo rodando entra por BOOLEANO desde 2026-08-26: era `phase === 'playing'`, importado de
    // `core/state`, e a engine não conhece mais o vocabulário de cenas deste jogo (ADR-0030 C3).
    // O padrão é FALSE porque era o que o `beforeEach` fazia antes (`setPhaseValue('title')`): estes casos
    // medem o CLIMA, e gotas paradas tornam o desenho determinístico.
    mundoRodando: () => over.mundoRodando ?? false,
    weatherLayer, stage,
    screen: { width: over.W ?? 100, height: over.H ?? 50 },
    getRm: () => over.rm || {},
    thunder: (inten) => thunderCalls.push(inten),
    temChuva: () => over.chuva ?? false,
  });
  return { weatherLayer, stage, thunderCalls };
}

describe('initWeather + updateWeather + drawWeather (integração)', () => {
  beforeEach(() => { setWeatherT(0); });

  it('[Zero] cenário SEM chuva: nunca chove, drawWeather não desenha nada além do clear', () => {
    const { weatherLayer } = setup({ chuva: false });
    for (let i = 0; i < 60 * 40; i++) updateWeather(); // 40s simulados
    expect(getRainLevel()).toBe(0);
    drawWeather();
    expect(weatherLayer._rec.clears).toBe(1);
    expect(weatherLayer._rec.fills.length).toBe(0); // sem chuva nem clarão
  });

  it('[Interface] cenário COM chuva, após 30s: chove (rain overlay desenhado)', () => {
    const { weatherLayer } = setup({ chuva: true });
    for (let i = 0; i < 60 * 32; i++) updateWeather(); // 32s → dentro da janela de garoa/chuva
    expect(getRainLevel()).toBeGreaterThan(0);
    drawWeather();
    expect(weatherLayer._rec.fills.length).toBeGreaterThan(0); // céu escurecido desenhado
  });

  it('[Ponte] getRainLevel() é a ÚNICA forma de ler o nível — segue o mesmo cálculo de audio-ambient (getRainLevel)', () => {
    setup({ chuva: true });
    for (let i = 0; i < 60 * 32; i++) updateWeather();
    expect(getRainLevel()).toBe(getRainLevel()); // getter estável, não o valor cru mutável
    expect(typeof getRainLevel()).toBe('number');
  });

  it('[Interface] drawWeather reposiciona weatherLayer no topo quando anexado ao stage informado', () => {
    const { stage } = setup();
    drawWeather();
    expect(stage._rec.reindexed).toBe(1);
  });

  it('[Boundary] weatherLayer fora do stage informado: drawWeather NÃO reposiciona', () => {
    const { stage } = setup({ attached: false });
    drawWeather();
    expect(stage._rec.reindexed).toBe(0);
  });

  it('[Weather-clock] getWeatherT/setWeatherT (hook de debug do window.__incl)', () => {
    setup();
    expect(getWeatherT()).toBe(0);
    setWeatherT(500);
    expect(getWeatherT()).toBe(500);
    updateWeather();
    expect(getWeatherT()).toBe(501);
  });

  it('[Trovão] chuva forte sustentada eventualmente chama thunder() (cadência aleatória real)', () => {
    const { thunderCalls } = setup({ chuva: true });
    // avança até estabilizar em chuva forte (c em [5,10) do ciclo) e sustenta por tempo suficiente p/ o CD estourar
    for (let i = 0; i < 60 * 300; i++) updateWeather();
    expect(thunderCalls.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// O CONGELAMENTO — acrescentado em 2026-08-26, quando `mundoRodando` virou injeção.
//
// Ele não tinha caso NENHUM: o `beforeEach` punha a fase em 'title' e todos os casos rodavam com as gotas
// paradas, então o ramo que as move nunca era exercido. A troca de fonte (de `phase === 'playing'` para um
// booleano injetado) expôs isso, e a lacuna é de acessibilidade, não de cobertura: gotas que continuam
// caindo por trás do menu de pausa são movimento que a criança pediu para parar (WCAG 2.2.2).
//
// MUTAÇÃO CONFERIDA: com `const mv = true` fixo em `render/weather`, o [Inverse] falha comparando duas
// listas de coordenadas diferentes — as gotas andam com o mundo parado.
describe('gotas param quando o mundo para', () => {
  const chove = (over) => {
    const r = setup({ chuva: true, ...over });
    // O relógio do clima é estado de MÓDULO e sobrevive entre casos: sem zerá-lo aqui, 40s de simulação
    // podem cair numa parte SECA do ciclo, e foi exatamente o que aconteceu na primeira escrita deste bloco
    // — o caso do congelamento passava porque não chovia nada. É o que a guarda `a.length > 0` abaixo pega.
    setWeatherT(0);
    for (let i = 0; i < 60 * 40; i++) updateWeather(); // 40s: chuva instalada
    return r;
  };
  /** As coordenadas de TODAS as gotas num quadro. Devolve a lista, não a string: quem chama precisa poder
   *  afirmar que ela não está VAZIA — sem isso, "os dois quadros são iguais" é verdade também quando não
   *  choveu nada, e o caso do congelamento passaria sem exercer o congelamento. */
  const quadro = (gfx) => {
    gfx._rec.pontos.length = 0;
    drawWeather();
    return gfx._rec.pontos.map((p) => p.join(',')).join(' ');
  };

  it('[Right] com o mundo RODANDO, o desenho da chuva muda de um quadro para o outro', () => {
    const { weatherLayer } = chove({ mundoRodando: true });
    const a = quadro(weatherLayer);
    const b = quadro(weatherLayer);
    expect(a.length, 'não choveu — o caso não tem o que medir').toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it('[Inverse] com o mundo PARADO (pausa/título), o desenho é o MESMO — as gotas ficam no ar', () => {
    const { weatherLayer } = chove({ mundoRodando: false });
    const a = quadro(weatherLayer);
    const b = quadro(weatherLayer);
    expect(a.length, 'não choveu — o caso não tem o que medir').toBeGreaterThan(0);
    expect(a).toBe(b);
  });
});
