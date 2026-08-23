// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/city-tex + o pintor `pixelCanvas`/`pixelTexture` de render/canvas (project node).
//
// O QUE ESTE ARQUIVO EXISTE PARA PEGAR: isto é ARTE. Se um retângulo sair 1px fora do lugar, se duas cores
// trocarem de lugar ou se os dois quadros de um bicho forem invertidos, NENHUM tipo reclama, nenhum teste de
// comportamento fica vermelho e o defeito só aparece na tela de alguém. A âncora aqui é literal: para cada
// figura da rua existe a SEQUÊNCIA EXATA de retângulos, transcrita à mão do bloco original do main.js
// (`LIFE_TEX`/`ADULT_TEX`/`CAR_TEX`). Se a extração tiver mudado um número, a lista bate de frente.
//
// Como se testa canvas no project `node`: `document` é FALSIFICADO por um objeto que devolve um canvas de
// mentira cujo contexto 2D REGISTRA as chamadas (`fillStyle` e `fillRect`, com o estilo vigente no momento do
// `fillRect`). É esse registro que prova que o pintor não esqueceu o `fillStyle`. `pixi.js` é falsificado por
// `vi.mock` — a textura vira o próprio canvas embrulhado, o que permite testar `createCityTextures()` inteira
// (inclusive a ORDEM dos quadros) sem navegador.
//
// ZOMBIES + Right-BICEP. Arte verbatim do main.js (Onda D3-a).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// PIXI de mentira: `tex(cv)` passa a devolver `{ cv, scaleMode }` — dá para ir da textura de volta ao bitmap.
vi.mock('pixi.js', () => ({
  SCALE_MODES: { NEAREST: 'NEAREST' },
  Texture: { from: (cv) => ({ cv, baseTexture: { scaleMode: null } }) },
}));

const { pixelCanvas, pixelTexture } = await import('../app/js/render/canvas.js');
const {
  paintPombo, paintPomboFly, paintGato, paintCao, CREATURE_ART,
  ADULT_W, ADULT_H, ADULT_COL, ADULT_SHAPES,
  CAR_W, CAR_H, CAR_PALETTES, paintCar,
  createCityTextures,
} = await import('../app/js/render/city-tex.js');

/* ===================== fakes: document + contexto 2D que registra ===================== */

let created = [];      // todo canvas fabricado na chamada corrente
let prevDocument;      // o `document` que havia antes (normalmente undefined no project node)

function fakeCanvas() {
  const ops = [];      // ['fillStyle', cor] | ['fillRect', x, y, w, h, corVigente]
  return {
    width: 0, height: 0, ops,
    getContext(kind) {
      if (kind !== '2d') return null;
      let style = null; // o estado que o pintor TEM de manter — se ele esquecer o fillStyle, fica null/velho
      return {
        get fillStyle() { return style; },
        set fillStyle(v) { style = v; ops.push(['fillStyle', v]); },
        fillRect(x, y, w, h) { ops.push(['fillRect', x, y, w, h, style]); },
      };
    },
  };
}

beforeEach(() => {
  created = [];
  prevDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('fake document: só sei criar <canvas>, pediram <' + tag + '>');
      const cv = fakeCanvas(); created.push(cv); return cv;
    },
  };
});
afterEach(() => { globalThis.document = prevDocument; });

/** Registrador de `px`: devolve os retângulos como "x,y,w,h,cor" na ordem em que foram pedidos. */
function record(painter) {
  const log = [];
  painter((x, y, w, h, col) => log.push([x, y, w, h, col].join(',')));
  return log;
}
/** Mesma leitura, mas a partir do canvas: só os `fillRect`, com a cor VIGENTE (não a pedida). */
const rectsOf = (cv) => cv.ops.filter((o) => o[0] === 'fillRect').map((o) => [o[1], o[2], o[3], o[4], o[5]].join(','));

/* ===================== 1. o pintor (render/canvas) ===================== */

describe('pixelCanvas', () => {
  it('dimensiona o canvas e devolve o próprio canvas (não a textura)', () => {
    const cv = pixelCanvas(7, 6, (px) => px(0, 0, 1, 1, '#fff'));
    expect(cv).toBe(created[0]);
    expect([cv.width, cv.height]).toEqual([7, 6]);
  });
  it('pinta na ordem pedida, e cada fillRect é PRECEDIDO pelo fillStyle da sua cor', () => {
    const cv = pixelCanvas(4, 4, (px) => { px(0, 0, 2, 2, '#111'); px(2, 2, 1, 1, '#222'); });
    expect(cv.ops).toEqual([
      ['fillStyle', '#111'], ['fillRect', 0, 0, 2, 2, '#111'],
      ['fillStyle', '#222'], ['fillRect', 2, 2, 1, 1, '#222'],
    ]);
  });
  it('a cor vigente em cada fillRect é a cor pedida — mesmo repetindo a cor anterior', () => {
    const cv = pixelCanvas(4, 4, (px) => { px(0, 0, 1, 1, '#abc'); px(1, 1, 1, 1, '#abc'); px(2, 2, 1, 1, '#def'); });
    expect(rectsOf(cv)).toEqual(['0,0,1,1,#abc', '1,1,1,1,#abc', '2,2,1,1,#def']);
  });
  it('pintura vazia = canvas dimensionado e nenhuma operação (ZERO)', () => {
    const cv = pixelCanvas(3, 3, () => { });
    expect(cv.ops).toEqual([]);
    expect([cv.width, cv.height]).toEqual([3, 3]);
  });
  it('pixelTexture embrulha o MESMO canvas e marca NEAREST (pixel art)', () => {
    const t = pixelTexture(2, 2, (px) => px(0, 0, 2, 2, '#0f0'));
    expect(t.cv).toBe(created[0]);
    expect(t.baseTexture.scaleMode).toBe('NEAREST');
    expect(rectsOf(t.cv)).toEqual(['0,0,2,2,#0f0']);
  });
});

/* ===================== 2. a arte dos bichos (âncora literal) ===================== */

const POMBO = {
  0: ['1,2,4,2,#9aa3b2', '0,3,2,1,#7d8695', '4,1,2,2,#b9c2d0', '6,2,1,1,#e0a23c', '2,5,1,1,#c96a2e', '4,5,1,1,#c96a2e'],
  1: ['1,2,4,2,#9aa3b2', '0,3,2,1,#7d8695', '4,3,2,2,#b9c2d0', '6,4,1,1,#e0a23c', '2,5,1,1,#c96a2e', '4,5,1,1,#c96a2e'],
};
const POMBO_FLY = {
  0: ['2,3,4,2,#9aa3b2', '6,2,2,2,#b9c2d0', '7,3,1,1,#e0a23c', '1,0,4,2,#c8d0dc'],
  1: ['2,3,4,2,#9aa3b2', '6,2,2,2,#b9c2d0', '7,3,1,1,#e0a23c', '1,5,4,2,#c8d0dc'],
};
const GATO = {
  0: ['1,3,8,3,#454b58', '8,1,3,3,#454b58', '8,0,1,1,#454b58', '10,0,1,1,#454b58', '0,2,1,3,#454b58', '9,2,1,1,#9fe07a', '2,6,1,2,#454b58', '7,6,1,2,#454b58'],
  1: ['1,3,8,3,#454b58', '8,1,3,3,#454b58', '8,0,1,1,#454b58', '10,0,1,1,#454b58', '0,2,1,3,#454b58', '9,2,1,1,#9fe07a', '3,6,1,2,#454b58', '6,6,1,2,#454b58'],
};
const CAO = {
  0: ['1,3,9,4,#8a6a44', '9,1,4,4,#8a6a44', '12,2,1,2,#3a2d1c', '9,0,2,2,#6d5334', '0,2,1,3,#8a6a44', '2,7,1,2,#6d5334', '8,7,1,2,#6d5334'],
  1: ['1,3,9,4,#8a6a44', '9,1,4,4,#8a6a44', '12,2,1,2,#3a2d1c', '9,0,2,2,#6d5334', '0,2,1,3,#8a6a44', '3,7,1,2,#6d5334', '7,7,1,2,#6d5334'],
};
const CREATURE_EXPECT = { pombo: POMBO, pomboFly: POMBO_FLY, gato: GATO, cao: CAO };
const CREATURE_SIZE = { pombo: [7, 6], pomboFly: [8, 7], gato: [12, 8], cao: [13, 9] };

describe('arte dos bichos (retângulo a retângulo, verbatim do main.js)', () => {
  it.each([['pombo', paintPombo], ['pomboFly', paintPomboFly], ['gato', paintGato], ['cao', paintCao]])(
    '%s: os dois quadros batem com a lista original', (k, painter) => {
      expect(record(painter(0))).toEqual(CREATURE_EXPECT[k][0]);
      expect(record(painter(1))).toEqual(CREATURE_EXPECT[k][1]);
    });
  it('os quadros 0 e 1 são DIFERENTES em todo bicho (senão a animação fica estática)', () => {
    for (const k of Object.keys(CREATURE_ART)) expect(record(CREATURE_ART[k].paint(0)), k).not.toEqual(record(CREATURE_ART[k].paint(1)));
  });
  it('CREATURE_ART carrega o tamanho de canvas de cada bicho', () => {
    for (const [k, [w, h]] of Object.entries(CREATURE_SIZE)) expect([CREATURE_ART[k].w, CREATURE_ART[k].h]).toEqual([w, h]);
  });
  it('nenhum retângulo escapa do canvas do seu bicho (BOUNDARY)', () => {
    for (const [k, art] of Object.entries(CREATURE_ART)) {
      for (const f of [0, 1]) for (const r of record(art.paint(f))) {
        const [x, y, w, h] = r.split(',').map(Number);
        expect(x >= 0 && y >= 0 && x + w <= art.w && y + h <= art.h, k + ' f' + f + ': ' + r).toBe(true);
      }
    }
  });
});

/* ===================== 3. a arte dos adultos (6 silhuetas × 2 quadros) ===================== */

const A = (s) => s.map((r) => r + ',' + ADULT_COL);
// membros compartilhados — as MESMAS listas que `arms`/`legs` produzem no módulo
const ARMS = { 0: A(['2,10,2,8', '12,10,2,8']), 1: A(['2,11,2,7', '12,9,2,8']) };
const LEGS_CALCA = { 0: A(['5,20,3,12', '9,20,3,11']), 1: A(['4,20,3,11', '10,20,3,12']) };
const LEGS_SAIA = { 0: A(['4,20,8,6', '5,26,2,6', '9,26,2,6']), 1: A(['4,20,8,6', '4,26,2,6', '10,26,2,6']) };
const ADULT_EXPECT = [
  (f) => [...A(['4,0,8,6', '3,6,10,14']), ...ARMS[f], ...LEGS_CALCA[f]],                                     // M1: ombros largos
  (f) => [...A(['5,0,6,5', '3,1,10,2', '5,5,6,15']), ...ARMS[f], ...LEGS_CALCA[f]],                          // M2: magro, de boné
  (f) => [...A(['4,1,8,5', '2,6,12,14']), ...ARMS[f], ...LEGS_CALCA[f]],                                     // M3: troncudo
  (f) => [...A(['4,0,8,6', '11,3,3,10', '4,6,8,10', '3,16,10,5']), ...ARMS[f], ...LEGS_SAIA[f]],             // F1: rabo de cavalo + saia
  (f) => [...A(['3,0,10,6', '2,4,3,13', '11,4,3,13', '5,6,6,10', '4,16,8,5']), ...LEGS_SAIA[f]],             // F2: cabelo longo + vestido (SEM braços)
  (f) => [...A(['3,0,10,7', '4,7,8,9', '3,16,10,5']), ...ARMS[f], ...LEGS_SAIA[f]],                          // F3: chanel + saia
];

describe('arte dos adultos', () => {
  it('são exatamente 6 silhuetas, 16×32', () => {
    expect(ADULT_SHAPES).toHaveLength(6);
    expect([ADULT_W, ADULT_H]).toEqual([16, 32]);
  });
  it.each([0, 1, 2, 3, 4, 5])('silhueta %i: os dois quadros batem com a lista original', (i) => {
    expect(record(ADULT_SHAPES[i](0))).toEqual(ADULT_EXPECT[i](0));
    expect(record(ADULT_SHAPES[i](1))).toEqual(ADULT_EXPECT[i](1));
  });
  it('toda silhueta é monocromática na cor #262b38', () => {
    for (const v of ADULT_SHAPES) for (const f of [0, 1]) for (const r of record(v(f))) expect(r.endsWith(',' + ADULT_COL)).toBe(true);
    expect(ADULT_COL).toBe('#262b38');
  });
  it('a F2 (índice 4) é a ÚNICA sem braços — verbatim, não é esquecimento', () => {
    const semBracos = ADULT_SHAPES.map((v, i) => [i, ARMS[0].every((r) => !record(v(0)).includes(r))]).filter(([, s]) => s).map(([i]) => i);
    expect(semBracos).toEqual([4]);
  });
  it('nenhum retângulo escapa do 16×32 (BOUNDARY)', () => {
    for (const v of ADULT_SHAPES) for (const f of [0, 1]) for (const r of record(v(f))) {
      const [x, y, w, h] = r.split(',').map(Number);
      expect(x >= 0 && y >= 0 && x + w <= ADULT_W && y + h <= ADULT_H, r).toBe(true);
    }
  });
});

/* ===================== 4. a arte dos carros ===================== */

const carExpect = (body, dark, top) => [
  '3,14,72,13,' + body, '3,25,72,2,' + dark,              // corpo + saia escura
  '1,16,2,8,' + dark, '75,16,2,8,' + dark,                // para-choques
  '15,4,40,11,' + top, '17,6,36,9,' + body,               // cabine (teto escuro + faixa)
  '19,7,14,7,#bcd6ee', '37,7,14,7,#bcd6ee',               // vidros
  '20,8,4,2,#eef6ff', '38,8,4,2,#eef6ff',                 // brilho dos vidros
  '34,7,3,7,' + top, '53,10,4,4,' + dark,                 // coluna B + retrovisor
  '3,14,72,1,rgba(255,255,255,.28)',                      // realce superior da lataria
  '0,17,3,5,#ffd9a0', '75,17,3,5,#ff6a5a',                // farol / lanterna
  '9,22,18,6,' + dark, '11,24,14,11,#10131a', '14,27,8,5,#2b3140', '16,29,4,2,#8a93a8',   // roda dianteira (wheel(11))
  '51,22,18,6,' + dark, '53,24,14,11,#10131a', '56,27,8,5,#2b3140', '58,29,4,2,#8a93a8',  // roda traseira (wheel(53))
];

describe('arte dos carros', () => {
  it('o carro é 78×36 (3× nativo — game/traffic conta com os 78px)', () => {
    expect([CAR_W, CAR_H]).toEqual([78, 36]);
  });
  it('as 4 paletas de fábrica são as do original, na mesma ordem', () => {
    expect(CAR_PALETTES.map((p) => p.join('|'))).toEqual([
      '#c8452e|#7d2717|#a03a24', '#2e6fc8|#193f7d|#2757a0', '#3aa15b|#1f6336|#2f8a4c', '#c8a12e|#7d641a|#a8862a',
    ]);
  });
  it.each([0, 1, 2, 3])('carro %i: retângulo a retângulo, verbatim', (i) => {
    const [body, dark, top] = CAR_PALETTES[i];
    expect(record(paintCar(body, dark, top))).toEqual(carExpect(body, dark, top));
  });
  it('vidros, brilhos, farol e lanterna NÃO seguem a lataria (são fixos nas 4 paletas)', () => {
    const fixos = CAR_PALETTES.map(([b, d, t]) => record(paintCar(b, d, t)).filter((r) => !r.endsWith(b) && !r.endsWith(d) && !r.endsWith(t)));
    for (const f of fixos) expect(f).toEqual(fixos[0]);
    expect(fixos[0]).toContain('19,7,14,7,#bcd6ee');
  });
  it('nenhum retângulo escapa do 78×36 (BOUNDARY)', () => {
    for (const r of record(paintCar('#a', '#b', '#c'))) {
      const [x, y, w, h] = r.split(',').map(Number);
      expect(x >= 0 && y >= 0 && x + w <= CAR_W && y + h <= CAR_H, r).toBe(true);
    }
  });
});

/* ===================== 5. a fábrica: forma, ordem dos quadros e ZERO I/O no import ===================== */

describe('createCityTextures', () => {
  // O erro que já custou caro aqui: as texturas nasciam de IIFE no corpo do módulo. Como `makeCanvas` toca
  // `document`, um módulo assim derruba o project `node` inteiro no import. `resetModules` + reimport com o
  // document falso instalado é o que torna esta afirmação capaz de ficar VERMELHA (sem isso o módulo já está
  // em cache e o teste não testaria nada).
  it('importar o módulo não fabrica canvas nenhum (ZERO I/O no import)', async () => {
    vi.resetModules();
    await import('../app/js/render/city-tex.js');
    expect(created).toEqual([]);
  });
  it('entrega o atlas que LifeCtx/TrafficCtx pedem: 4 bichos × 2, 6 adultos × 2, 4 carros', () => {
    const { lifeTex, adultTex, carTex } = createCityTextures();
    expect(Object.keys(lifeTex).sort()).toEqual(['cao', 'gato', 'pombo', 'pomboFly']);
    for (const k of Object.keys(lifeTex)) expect(lifeTex[k]).toHaveLength(2);
    expect(adultTex).toHaveLength(6);
    for (const p of adultTex) expect(p).toHaveLength(2);
    expect(carTex).toHaveLength(4);
    expect(created).toHaveLength(4 * 2 + 6 * 2 + 4); // 24 canvases, nem um a mais
  });
  it('cada textura carrega o BITMAP certo, no quadro certo (pega par invertido)', () => {
    const { lifeTex, adultTex, carTex } = createCityTextures();
    for (const k of Object.keys(CREATURE_EXPECT)) for (const f of [0, 1]) {
      expect(rectsOf(lifeTex[k][f].cv), k + ' f' + f).toEqual(CREATURE_EXPECT[k][f]);
      expect([lifeTex[k][f].cv.width, lifeTex[k][f].cv.height]).toEqual(CREATURE_SIZE[k]);
    }
    for (let i = 0; i < 6; i++) for (const f of [0, 1]) expect(rectsOf(adultTex[i][f].cv), 'adulto ' + i + ' f' + f).toEqual(ADULT_EXPECT[i](f));
    for (let i = 0; i < 4; i++) expect(rectsOf(carTex[i].cv), 'carro ' + i).toEqual(carExpect(...CAR_PALETTES[i]));
  });
  it('todas as texturas saem NEAREST (pixel art crisp)', () => {
    const { lifeTex, adultTex, carTex } = createCityTextures();
    const todas = [...Object.values(lifeTex).flat(), ...adultTex.flat(), ...carTex];
    for (const t of todas) expect(t.baseTexture.scaleMode).toBe('NEAREST');
  });
  it('duas chamadas devolvem texturas NOVAS (não memoiza — CONFORMANCE do contrato documentado)', () => {
    const a = createCityTextures(), b = createCityTextures();
    expect(a.carTex[0]).not.toBe(b.carTex[0]);
    expect(rectsOf(a.carTex[0].cv)).toEqual(rectsOf(b.carTex[0].cv));
  });
});
