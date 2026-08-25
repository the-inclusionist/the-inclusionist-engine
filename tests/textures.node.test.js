// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/textures — geradores de textura procedural (project node). ZOMBIES + Right-BICEP.
// Os geradores em si usam canvas/PIXI (project browser: textures.browser.test.js); aqui testamos a parte PURA:
// isPix, shapePoints (geometria dos glifos das formas) e a integridade dos dados PIP_* (arte indexada adiada).
// Importar este módulo NÃO deve tocar document/PIXI (SHAPE_TEX/PUP_TEX só enchem em initTextures) — ver o
// header de render/textures.ts. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/textures).
import { describe, it, expect } from 'vitest';
import {
  isPix, shapePoints, SHAPE_TEX, PUP_TEX,
  PIP_W, PIP_H, PIP_PAL, PIP_IDLE, PIP_WALK,
  PLAYER_IDLE, PLAYER_WALK, PLAYER_CLIMB, PLAYER_HURT,
} from '../app/js/render/textures.js';

describe('import puro', () => {
  it('não enche os caches de textura antes de initTextures (zero I/O no import)', () => {
    expect(Object.keys(SHAPE_TEX)).toHaveLength(0);
    expect(Object.keys(PUP_TEX)).toHaveLength(0);
  });
});

describe('isPix', () => {
  it('[Right] dígitos 0-9 exceto 7 são válidos', () => {
    for (const d of '012345689') expect(isPix(d)).toBe(true);
  });
  it('[Boundary] "7" é o fundo vazado → inválido', () => {
    expect(isPix('7')).toBe(false);
  });
  it('[Error] caracteres fora do dígito (ponto, vazio, letra) são inválidos — robusto p/ linhas curtas', () => {
    expect(isPix('.')).toBe(false);
    expect(isPix('')).toBe(false);
    expect(isPix('a')).toBe(false);
    expect(isPix(undefined)).toBe(false); // r[x] além do fim da linha
  });
});

describe('shapePoints', () => {
  it('[Zero] formas sem vértices (arco/elipse/retângulo) retornam null', () => {
    for (const id of ['circulo', 'oval', 'quadrado', 'retangulo', 'id-desconhecido']) {
      expect(shapePoints(id, 8, 8, 6)).toBeNull();
    }
  });
  it('[Right] triângulo: 3 vértices, ápice no topo', () => {
    expect(shapePoints('triangulo', 8, 8, 6)).toEqual([[8, 2], [14, 14], [2, 14]]);
  });
  it('[Right] losango: 4 vértices em cruz (N/L/S/O)', () => {
    expect(shapePoints('losango', 8, 8, 6)).toEqual([[8, 2], [14, 8], [8, 14], [2, 8]]);
  });
  it('[Right] paralelogramo/trapézio: 4 vértices, fórmula verbatim do game.js', () => {
    const flat = (pts) => pts.flat();
    expect(flat(shapePoints('paralelogramo', 8, 8, 6))).toEqual(
      flat([[5, 4.4], [14, 4.4], [11, 11.6], [2, 11.6]]).map((n) => expect.closeTo(n, 9)),
    );
    expect(flat(shapePoints('trapezio', 8, 8, 6))).toEqual(
      flat([[5, 3.8], [11, 3.8], [14, 12.2], [2, 12.2]]).map((n) => expect.closeTo(n, 9)),
    );
  });
  it('[Right] pentágono: 5 vértices equidistantes, primeiro no topo (-90°)', () => {
    const pts = shapePoints('pentagono', 8, 8, 6);
    expect(pts).toHaveLength(5);
    expect(pts[0][0]).toBeCloseTo(8, 9); // -90° → cos=0 → x=cx
    expect(pts[0][1]).toBeCloseTo(2, 9); // -90° → sin=-1 → y=cy-r
  });
  it('[Right] hexágono: 6 vértices equidistantes, primeiro à direita (0°)', () => {
    const pts = shapePoints('hexagono', 8, 8, 6);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual([14, 8]); // 0° → cos=1,sin=0 → (cx+r, cy)
  });
  it('[Invariant] losango/pentágono/hexágono são inscritos no círculo de raio r (todo vértice a exatamente r)', () => {
    for (const id of ['losango', 'pentagono', 'hexagono']) {
      for (const [x, y] of shapePoints(id, 8, 8, 6)) {
        expect(Math.hypot(x - 8, y - 8)).toBeCloseTo(6, 9);
      }
    }
  });
});

describe('dados PIP_* (arte indexada adiada — ver comentário "DEFERRED" em render/textures.ts)', () => {
  it('[Zero] PIP_W/PIP_H batem com as dimensões usadas por indexedToCanvas/silhouetteCanvasIdx', () => {
    expect(PIP_W).toBe(24);
    expect(PIP_H).toBe(32);
  });
  it('[Right] PIP_PAL tem 10 cores (dígitos 0-9, "7" é o vazado)', () => {
    expect(PIP_PAL).toHaveLength(10);
    for (const c of PIP_PAL) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('[Right] PIP_IDLE tem PIP_H linhas', () => {
    expect(PIP_IDLE).toHaveLength(PIP_H);
  });
  it('[Right] PIP_WALK tem 6 quadros de PIP_H linhas cada', () => {
    expect(PIP_WALK).toHaveLength(6);
    for (const frame of PIP_WALK) expect(frame).toHaveLength(PIP_H);
  });
  it('[Invariant] todo caractere de PIP_IDLE/PIP_WALK é um dígito de paleta válido ou "." (transparente)', () => {
    const rows = [...PIP_IDLE, ...PIP_WALK.flat()];
    for (const row of rows) for (const ch of row) expect(ch === '.' || /[0-9]/.test(ch)).toBe(true);
  });
});

describe('dados PLAYER_* (achado: vestígio pré-PixelLab, ZERO chamadores — ver comentário em render/textures.ts)', () => {
  it('as 4 animações têm 32 linhas de 16 colunas (mesma geometria de spriteToCanvas)', () => {
    for (const art of [PLAYER_IDLE, PLAYER_WALK, PLAYER_CLIMB, PLAYER_HURT]) {
      expect(art).toHaveLength(32);
      for (const row of art) expect(row).toHaveLength(16);
    }
  });
});
