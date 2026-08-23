// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/parallax — a MATEMÁTICA do fundo e o vestir das 3 camadas (project node). ZOMBIES + Right-BICEP.
//
// O que este arquivo protege são três propriedades que, quebradas, NÃO derrubam nada — nem build, nem tsc,
// nem um teste de física — e só aparecem para quem olhar a tela com atenção:
//
//  1. A CONTRA-POSIÇÃO. As camadas vivem dentro do container `camera`, que fica em `-camX`. Cada camada é
//     posta em `+camX` para cancelar exatamente esse movimento e ficar PARADA na tela. Inverter o sinal faz o
//     céu correr ao contrário, com o dobro da velocidade — e nenhuma asserção do repositório notava.
//  2. A PROPORCIONALIDADE. A rolagem da textura é `-camX * fator`. Fator menor = camada mais distante = menos
//     movimento. Trocar dois fatores, ou ignorar o fator, achata a profundidade sem sintoma nenhum.
//  3. O MOVIMENTO REDUZIDO. Com `rm.parallax`, a ROLAGEM trava em zero e a CONTRA-POSIÇÃO continua. Travar a
//     coisa errada gruda o fundo no mundo e produz justamente o deslizamento que a opção existe para tirar —
//     para quem pediu, por acessibilidade, para não ver deslizamento.
//
// A parte impura (`aplicarTemaParallax`) também roda aqui, com PIXI de mentira: o que está em jogo nela é a
// GUARDA DE CORRIDA do PNG da Cidade (tema trocado enquanto a imagem baixava) e a regra de que o sprite só é
// pintado no modo 'normal' — nos modos acessíveis quem pinta é render/viz-setters, lendo a textura crua.
import { describe, it, expect } from 'vitest';
import { PARALLAX, ARQUIVO_POR_CAMADA, posicoesParallax, createParallax } from '../app/js/render/parallax.js';
import { LOGICAL_W, LOGICAL_H } from '../app/js/core/constants.js';

/* ===================== dublês ===================== */

class FakeTiling {
  constructor(texture, w, h) {
    this.texture = texture; this.w = w; this.h = h; this.x = 0; this.y = 0;
    this.tilePosition = { x: 0, y: 0, set(a, b) { this.x = a; this.y = b; } };
  }
}
const decor = () => { const d = { pos: null }; d.position = { set: (x, y) => { d.pos = [x, y]; } }; return d; };

function ambiente(over = {}) {
  const log = { addChildAt: [], clearCache: 0, imgs: [] };
  const camera = { addChildAt: (c, i) => log.addChildAt.push([c, i]) };
  const estado = { cenario: over.cenario || 'cidade', viz: over.viz || 'normal', rm: over.rm || {} };
  class FakeImg {
    constructor() { this.onload = null; this.onerror = null; this._src = ''; log.imgs.push(this); }
    set src(v) { this._src = v; } get src() { return this._src; }
  }
  const ctx = {
    camera, TilingSprite: FakeTiling,
    placeholderTex: (i) => 'PLACEHOLDER:' + i,
    skyTex: (T) => 'SKY:' + T.sky[0],
    hillsTex: (T, near) => 'HILLS:' + T.hills[near ? 1 : 0] + ':' + (near ? 'near' : 'far'),
    Imagem: FakeImg,
    texturaDeImagem: (img) => ({ nome: 'TEX(' + img.src + ')', baseTexture: { scaleMode: -1 } }),
    escalaNearest: 0,
    rm: estado.rm,
    getCenario: () => estado.cenario,
    getVizMode: () => estado.viz,
    clearParallaxTexCache: () => { log.clearCache++; },
    getDecorDeTela: over.getDecorDeTela || (() => []),
    ...over.ctx,
  };
  return { ctx, log, estado, api: createParallax(ctx) };
}

const TEMA_V3 = { nome: 'Campo', v3: true, sky: ['#86c5e8', '#cfeecb'], cloud: ['#fff', '#eee'], hills: ['#9fd47e', '#6fb84e'], decor: ['nuvens'] };
const TEMA_CIDADE = { nome: 'Cidade', v3: false };

/* ===================== PARALLAX (dado) ===================== */

describe('PARALLAX — os fatores de profundidade', () => {
  it('são três camadas, do mais distante ao mais próximo', () => {
    expect(PARALLAX).toHaveLength(3);
    expect(PARALLAX.map((p) => p.key)).toEqual(['sky', 'far', 'near']);
  });
  it('os fatores CRESCEM com o índice — trocar dois deles inverte a profundidade', () => {
    for (let i = 1; i < PARALLAX.length; i++) expect(PARALLAX[i].factor).toBeGreaterThan(PARALLAX[i - 1].factor);
  });
  it('Boundary: todo fator está em (0,1) — 0 seria imóvel, 1 seria colado no mundo', () => {
    for (const p of PARALLAX) { expect(p.factor).toBeGreaterThan(0); expect(p.factor).toBeLessThan(1); }
  });
  it('nenhuma camada rola na vertical (fy=0: a textura tem a altura do viewport)', () => {
    for (const p of PARALLAX) expect(p.fy).toBe(0);
  });
  it('cada camada tem o seu PNG da Cidade, na ordem c4/c3/c2', () => {
    expect(ARQUIVO_POR_CAMADA).toEqual([4, 3, 2]);
    expect(ARQUIVO_POR_CAMADA).toHaveLength(PARALLAX.length);
  });
});

/* ===================== posicoesParallax (pura) ===================== */

describe('posicoesParallax — a conta', () => {
  it('CONTRA-POSIÇÃO: x/y são EXATAMENTE camX/camY (o camera está em -camX → soma zero na tela)', () => {
    for (const [cx, cy] of [[0, 0], [37, 12], [1280, 180], [-40, -7], [0.5, 0.25]]) {
      for (const q of posicoesParallax(cx, cy)) { expect(q.x).toBe(cx); expect(q.y).toBe(cy); }
    }
  });

  it('ROLAGEM: tileX = -camX * fator, camada a camada', () => {
    const camX = 200;
    const pos = posicoesParallax(camX, 0);
    PARALLAX.forEach((p, i) => expect(pos[i].tileX).toBeCloseTo(-camX * p.factor, 10));
  });

  it('tileY = -camY * fy — com fy=0 nas três, a rolagem vertical é sempre zero', () => {
    for (const q of posicoesParallax(0, 999)) expect(Math.abs(q.tileY)).toBe(0);
  });

  it('PROFUNDIDADE: a camada mais distante (sky) se move MENOS que as da frente', () => {
    const pos = posicoesParallax(500, 0);
    expect(Math.abs(pos[0].tileX)).toBeLessThan(Math.abs(pos[1].tileX));
    expect(Math.abs(pos[1].tileX)).toBeLessThan(Math.abs(pos[2].tileX));
  });

  it('PROPORCIONALIDADE: a razão entre duas camadas é a razão dos fatores, em qualquer camX', () => {
    for (const camX of [1, 33, 640, 5000]) {
      const pos = posicoesParallax(camX, 0);
      expect(pos[2].tileX / pos[0].tileX).toBeCloseTo(PARALLAX[2].factor / PARALLAX[0].factor, 10);
      expect(pos[1].tileX / pos[0].tileX).toBeCloseTo(PARALLAX[1].factor / PARALLAX[0].factor, 10);
    }
  });

  it('LINEARIDADE: dobrar camX dobra a rolagem (Right-BICEP: relação inversa)', () => {
    const a = posicoesParallax(150, 0), b = posicoesParallax(300, 0);
    PARALLAX.forEach((_p, i) => expect(b[i].tileX).toBeCloseTo(2 * a[i].tileX, 10));
  });

  it('Zero: camera na origem → tudo zerado', () => {
    for (const q of posicoesParallax(0, 0)) { expect(q.x).toBe(0); expect(q.y).toBe(0); expect(Math.abs(q.tileX)).toBe(0); expect(Math.abs(q.tileY)).toBe(0); }
  });

  it('SENTIDO: câmera indo para a DIREITA rola a textura para a esquerda (tileX negativo)', () => {
    for (const q of posicoesParallax(100, 0)) expect(q.tileX).toBeLessThan(0);
    for (const q of posicoesParallax(-100, 0)) expect(q.tileX).toBeGreaterThan(0);
  });

  it('MOVIMENTO REDUZIDO: a rolagem trava em ZERO e a contra-posição CONTINUA valendo', () => {
    const camX = 640, camY = 90;
    for (const q of posicoesParallax(camX, camY, PARALLAX, true)) {
      expect(q.tileX).toBe(0); expect(q.tileY).toBe(0);
      expect(q.x).toBe(camX); expect(q.y).toBe(camY); // <- o fundo continua PARADO na tela, não grudado no mundo
    }
  });

  it('é determinística e não muta a tabela de camadas', () => {
    const antes = JSON.stringify(PARALLAX);
    expect(posicoesParallax(77, 3)).toEqual(posicoesParallax(77, 3));
    expect(JSON.stringify(PARALLAX)).toBe(antes);
  });

  it('devolve uma posição por camada, respeitando uma tabela sob medida', () => {
    const custom = [{ key: 'a', factor: 0.5, fy: 0.25 }];
    const pos = posicoesParallax(10, 8, custom);
    expect(pos).toHaveLength(1);
    expect(pos[0]).toEqual({ x: 10, y: 8, tileX: -5, tileY: -2 });
  });
});

/* ===================== createParallax: montagem ===================== */

describe('createParallax — montagem no render-graph', () => {
  it('cria uma camada por fator, no tamanho lógico, e a insere no camera na ordem-z do array', () => {
    const { log, api } = ambiente();
    expect(api.layers).toHaveLength(3);
    api.layers.forEach((ts, i) => { expect(ts.w).toBe(LOGICAL_W); expect(ts.h).toBe(LOGICAL_H); expect(log.addChildAt[i]).toEqual([ts, i]); });
  });
  it('nasce com os placeholders, e texNormal começa espelhando as texturas dos sprites', () => {
    const { api } = ambiente();
    expect(api.layers.map((t) => t.texture)).toEqual(['PLACEHOLDER:0', 'PLACEHOLDER:1', 'PLACEHOLDER:2']);
    expect(api.texNormal).toEqual(['PLACEHOLDER:0', 'PLACEHOLDER:1', 'PLACEHOLDER:2']);
  });
});

/* ===================== createParallax: updateParallax ===================== */

describe('updateParallax — o carimbo nos sprites', () => {
  it('escreve nos sprites exatamente o que posicoesParallax devolve', () => {
    const { api } = ambiente();
    api.updateParallax(320, 45);
    const esperado = posicoesParallax(320, 45, PARALLAX, false);
    api.layers.forEach((ts, i) => {
      expect(ts.x).toBe(esperado[i].x); expect(ts.y).toBe(esperado[i].y);
      expect(ts.tilePosition.x).toBeCloseTo(esperado[i].tileX, 10);
      expect(ts.tilePosition.y).toBeCloseTo(esperado[i].tileY, 10);
    });
  });

  it('CONTRA-POSIÇÃO no sprite: x = +camX (não -camX), senão o fundo corre ao contrário', () => {
    const { api } = ambiente();
    api.updateParallax(500, 60);
    for (const ts of api.layers) { expect(ts.x).toBe(500); expect(ts.y).toBe(60); }
  });

  it('cada camada recebe uma ROLAGEM diferente — a mais distante, a menor', () => {
    const { api } = ambiente();
    api.updateParallax(800, 0);
    const rol = api.layers.map((t) => Math.abs(t.tilePosition.x));
    expect(rol[0]).toBeLessThan(rol[1]);
    expect(rol[1]).toBeLessThan(rol[2]);
    expect(new Set(rol).size).toBe(3); // nenhuma repetida: o fator NÃO foi ignorado
  });

  it('MOVIMENTO REDUZIDO: tilePosition zera nos três, x/y seguem em camX/camY', () => {
    const { api, estado } = ambiente({ rm: { parallax: true } });
    api.updateParallax(640, 90);
    for (const ts of api.layers) { expect(ts.tilePosition.x).toBe(0); expect(ts.tilePosition.y).toBe(0); expect(ts.x).toBe(640); expect(ts.y).toBe(90); }
    estado.rm.parallax = false; // `rm` entra por VALOR e é mutado in place: o quadro seguinte já volta a rolar
    api.updateParallax(640, 90);
    expect(api.layers[2].tilePosition.x).toBeCloseTo(-640 * PARALLAX[2].factor, 10);
  });

  it('contra-posiciona também a decor de TELA da v3 (estrelas/nuvens/névoa)', () => {
    const a = decor(), b = decor(), c = decor();
    const { api } = ambiente({ getDecorDeTela: () => [a, b, c] });
    api.updateParallax(120, 34);
    for (const g of [a, b, c]) expect(g.pos).toEqual([120, 34]);
  });

  it('Boot: decor ainda inexistente (undefined) não derruba o quadro', () => {
    const d = decor();
    const { api } = ambiente({ getDecorDeTela: () => [undefined, null, d] });
    expect(() => api.updateParallax(9, 9)).not.toThrow();
    expect(d.pos).toEqual([9, 9]);
  });

  it('é idempotente: chamar duas vezes com a mesma câmera dá o mesmo estado', () => {
    const { api } = ambiente();
    api.updateParallax(77, 3);
    const snap = api.layers.map((t) => [t.x, t.y, t.tilePosition.x, t.tilePosition.y]);
    api.updateParallax(77, 3);
    expect(api.layers.map((t) => [t.x, t.y, t.tilePosition.x, t.tilePosition.y])).toEqual(snap);
  });
});

/* ===================== createParallax: aplicarTemaParallax ===================== */

describe('aplicarTemaParallax — tema v3 (síncrono)', () => {
  it('veste céu + as duas bandas de morro, na ordem sky/far/near', () => {
    const { api } = ambiente();
    api.aplicarTemaParallax('campo', TEMA_V3);
    expect(api.texNormal).toEqual(['SKY:#86c5e8', 'HILLS:#9fd47e:far', 'HILLS:#6fb84e:near']);
    expect(api.layers.map((t) => t.texture)).toEqual(['SKY:#86c5e8', 'HILLS:#9fd47e:far', 'HILLS:#6fb84e:near']);
  });

  it('troca os ELEMENTOS de texNormal in place — o ARRAY é o mesmo objeto (initViewports o tem por valor)', () => {
    const { api } = ambiente();
    const ref = api.texNormal;
    api.aplicarTemaParallax('campo', TEMA_V3);
    expect(api.texNormal).toBe(ref);
  });

  it('invalida o cache de recolor uma vez por camada', () => {
    const { api, log } = ambiente();
    log.clearCache = 0;
    api.aplicarTemaParallax('campo', TEMA_V3);
    expect(log.clearCache).toBe(3);
  });

  it('fora do modo normal grava a textura CRUA mas NÃO pinta o sprite (quem pinta é viz-setters)', () => {
    const { api } = ambiente({ viz: 'hc-direto' });
    api.aplicarTemaParallax('campo', TEMA_V3);
    expect(api.texNormal[0]).toBe('SKY:#86c5e8');
    expect(api.layers[0].texture).toBe('PLACEHOLDER:0'); // intocado
  });
});

describe('aplicarTemaParallax — Cidade (PNG assíncrono)', () => {
  it('pede c4/c3/c2 do tema, uma imagem por camada', () => {
    const { api, log } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    expect(log.imgs.map((i) => i.src)).toEqual([
      'assets/cenarios/cidade/c4.png', 'assets/cenarios/cidade/c3.png', 'assets/cenarios/cidade/c2.png',
    ]);
  });

  it('nada muda antes de a imagem chegar', () => {
    const { api } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    expect(api.texNormal).toEqual(['PLACEHOLDER:0', 'PLACEHOLDER:1', 'PLACEHOLDER:2']);
  });

  it('ao carregar: textura em NEAREST (pixel art), gravada e pintada', () => {
    const { api, log, ctx } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    log.imgs[0].onload();
    expect(api.texNormal[0].nome).toBe('TEX(assets/cenarios/cidade/c4.png)');
    expect(api.texNormal[0].baseTexture.scaleMode).toBe(ctx.escalaNearest);
    expect(api.layers[0].texture).toBe(api.texNormal[0]);
  });

  it('ao FALHAR: cai no placeholder daquela camada (o jogo nunca fica sem fundo)', () => {
    const { api, log } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    log.imgs[1].onerror();
    expect(api.texNormal[1]).toBe('PLACEHOLDER:1');
    expect(api.layers[1].texture).toBe('PLACEHOLDER:1');
  });

  it('GUARDA DE CORRIDA: PNG que chega DEPOIS de trocar de cenário é descartado', () => {
    const { api, log, estado } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    api.aplicarTemaParallax('campo', TEMA_V3); // a pessoa trocou; o v3 é síncrono e já pintou
    estado.cenario = 'campo';
    const antes = [...api.texNormal];
    log.imgs[0].onload();  // o PNG atrasado da Cidade chega agora
    log.imgs[2].onerror(); // e outro falha
    expect(api.texNormal).toEqual(antes); // o céu do Campo continua de pé
    expect(api.layers[0].texture).toBe('SKY:#86c5e8');
  });

  it('a guarda vale para o caminho de ERRO também (não só para o de sucesso)', () => {
    const { api, log, estado } = ambiente();
    api.aplicarTemaParallax('cidade', TEMA_CIDADE);
    estado.cenario = 'floresta';
    const antes = [...api.texNormal];
    log.imgs[0].onerror();
    expect(api.texNormal).toEqual(antes);
  });
});
