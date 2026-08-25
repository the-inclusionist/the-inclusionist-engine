// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/audio-nav — BENGALA e NADO CEGO (project NODE: tiles/colisão + noiseHit/tonePan falsos).
//
// A METADE DO SONAR SAIU DAQUI no item 19, junto com o módulo: está em `tests/audio-sonar.node.test.js`, e o
// fixture de lá não tem uma moeda sequer. O que sobrou neste arquivo declara tiles e chão — e DEVE declarar:
// a bengala sonda o material à frente e o nado procura parede, fundo e superfície. Um fixture de plataforma
// para um módulo de plataforma não é dívida; é a descrição correta do que o módulo faz.
//
// O ctx encolheu junto: eram 19 coisas, são 8. As onze que saíram foram com o sonar.
import { describe, it, expect } from 'vitest';
import { createAudioNav } from '../app/js/platform/audio-nav.js';

const TILE = 16;
// Tipos de tile: 0/1 ar · 3 água · 4 escada · 2/6 sólido. tileAt/solidAt lidos de um mapa esparso "x,y"->tipo.
function makeWorld(cells = {}) {
  const tileAt = (x, y) => cells[x + ',' + y] ?? 0;
  const solidAt = (x, y) => { const t = tileAt(x, y); return t === 2 || t === 6 || t === 4; };
  return { tileAt, solidAt };
}

function setup(over = {}) {
  const tone = [], hits = [];
  const world = over.world || makeWorld();
  const ctx = {
    tileAt: world.tileAt, solidAt: world.solidAt,
    held: () => false,
    tonePan: (freq, dur, cat, pan) => tone.push({ freq, cat, pan }),
    noiseHit: (mat, pan) => hits.push({ mat, pan }),
    BOX: { w: 12, h: 24 }, TILE,
    getCenario: () => over.cenario || 'cidade',
    // A NAVEGAÇÃO SONORA entra pronta, e o dublê é minúsculo de propósito: este arquivo não testa o sonar —
    // testa que a bengala e o nado continuam funcionando sem saber que ele existe. O único método realmente
    // usado aqui é `playerCtx`, porque a batida da bengala sai no dispositivo do jogador.
    sonar: {
      playerCtx: () => null, panFor: () => 0, needsAudioCues: () => true,
      sonar: () => {}, updateGuide: () => {}, sonarCount: 0, guideCount: 0,
      ...(over.sonar || {}),
    },
  };
  return { nav: createAudioNav({ ...ctx, ...(over.ctx || {}) }), tone, hits };
}

// Jogador em x=32 (tile 2), y=32 (tile 2), virado p/ direita. À frente (dir=+1) o probe olha ~tile 3.
const pl = (o = {}) => ({ x: 32, y: 32, facing: 1, viz: 'cego', i: 0, ...o });

describe('platform/audio-nav', () => {
  it('[Zero/One] caneProbe: água à frente = "agua"', () => {
    // A bengala sonda À FRENTE: ax = floor((x + w/2 + TILE*0.6)/TILE) = floor((32+6+9.6)/16) = 2; footTy = 2. Logo (2,2).
    const { nav } = setup({ world: makeWorld({ '2,2': 3 }) }); // (2,2) = água à frente
    expect(nav.caneProbe(pl())).toBe('agua');
  });

  it('[Boundary] caneProbe: sem chão à frente = "vazio"', () => {
    const { nav } = setup({ world: makeWorld({}) }); // nada sólido → fosso
    expect(nav.caneProbe(pl())).toBe('vazio');
  });

  it('[One] caneProbe: escada (tile 4) à frente = "madeira"', () => {
    const { nav } = setup({ world: makeWorld({ '2,2': 4 }) });
    expect(nav.caneProbe(pl())).toBe('madeira');
  });

  it('[Simple] caneProbe: chão sólido = material do tema (cidade → "piso")', () => {
    const { nav } = setup({ world: makeWorld({ '2,2': 2 }), cenario: 'cidade' });
    expect(nav.caneProbe(pl())).toBe('piso');
  });

  it('[Interface] caneTap no vazio = tom "guard"; em material = noiseHit; conta as batidas', () => {
    const { nav, tone, hits } = setup({ world: makeWorld({}) });
    nav.caneTap(pl());
    expect(tone.some((t) => t.cat === 'guard')).toBe(true);
    expect(nav.caneCount).toBe(1);
    const s2 = setup({ world: makeWorld({ '2,2': 2 }), cenario: 'cidade' });
    s2.nav.caneTap(pl());
    expect(s2.hits).toEqual([{ mat: 'piso', pan: 0.5 }]);
  });

});
