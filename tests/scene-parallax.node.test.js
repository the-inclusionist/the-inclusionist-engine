// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-parallax — matemática pura do relevo (project node). ZOMBIES + Right-BICEP.
// Os geradores de textura usam canvas/PIXI (verificados no boot); aqui testamos o helper puro hillHeight.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/scene-parallax).
import { describe, it, expect } from 'vitest';
import { hillHeight, paradasDoCeu, larguraDoCeu, pintarSol } from '../app/js/render/scene-parallax.js';

// Réplica da fórmula (v3 drawHillBand) para validar o valor exato num ponto.
const ref = (x, near) => {
  const amp = near ? 9 : 5, freq = near ? 0.013 : 0.018, phase = near ? 0 : 140;
  return Math.sin((x + phase) * freq) * amp + Math.sin((x + phase) * freq * 2.3 + 1.7) * amp * 0.4;
};

describe('hillHeight', () => {
  it('bate com a fórmula v3 em pontos concretos', () => {
    for (const x of [0, 37, 200, 999]) {
      expect(hillHeight(x, true)).toBeCloseTo(ref(x, true), 10);
      expect(hillHeight(x, false)).toBeCloseTo(ref(x, false), 10);
    }
  });
  it('é determinístico (mesmo x → mesmo valor)', () => {
    expect(hillHeight(123, true)).toBe(hillHeight(123, true));
  });
  it('Boundary: limitado por amp*1.4 (banda perto=9→12.6, longe=5→7)', () => {
    for (let x = 0; x < 1280; x++) {
      expect(Math.abs(hillHeight(x, true))).toBeLessThanOrEqual(12.6 + 1e-9);
      expect(Math.abs(hillHeight(x, false))).toBeLessThanOrEqual(7 + 1e-9);
    }
  });
  it('a banda da FRENTE (near) oscila mais que a do fundo', () => {
    let mNear = 0, mFar = 0;
    for (let x = 0; x < 1280; x++) { mNear = Math.max(mNear, Math.abs(hillHeight(x, true))); mFar = Math.max(mFar, Math.abs(hillHeight(x, false))); }
    expect(mNear).toBeGreaterThan(mFar);
  });
});

/* ===================== o céu: paradas do gradiente, largura e o sol ===================== */
//
// O DESENHO precisa de canvas; a CONTA que decide onde uma cor cai, não. É a conta que este bloco afere, e é
// ela que estava faltando quando o céu da Floresta saiu verde: nada além do olho conferia a altura de uma cor.

describe('paradasDoCeu — onde cada cor do céu cai, em pixels', () => {
  it('[Right] duas cores continuam significando topo e rodapé, exatamente como antes', () => {
    // O céu era um PAR, e três temas ainda são. Se este caso reprovar, a mudança para lista quebrou o que já
    // existia — o que seria pior do que não ter feito a mudança.
    expect(paradasDoCeu(['#000000', '#ffffff'], 180)).toEqual([
      { y: 0, cor: '#000000' }, { y: 180, cor: '#ffffff' },
    ]);
  });

  it('[Right] sete cores caem de 30 em 30 px — é o que põe o vermelho da Floresta no horizonte', () => {
    const ys = paradasDoCeu(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 180).map((p) => p.y);
    expect(ys).toEqual([0, 30, 60, 90, 120, 150, 180]);
  });

  it('[Boundary] a primeira parada é sempre 0 e a última é sempre a altura inteira', () => {
    for (const n of [2, 3, 5, 7, 13]) {
      const ps = paradasDoCeu(Array.from({ length: n }, (_v, i) => 'c' + i), 180);
      expect(ps[0].y, 'n=' + n).toBe(0);
      expect(ps[ps.length - 1].y, 'n=' + n).toBe(180);
      expect(ps).toHaveLength(n);
    }
  });

  it('[Zero] uma cor só não divide por zero — vira um céu chapado', () => {
    // `i/(n-1)` com n=1 é 0/0 = NaN, e `addColorStop(NaN)` LANÇA. Um tema com uma cor só é um erro de dado,
    // mas o erro que ele merece é um céu feio, não um cenário que não abre.
    expect(paradasDoCeu(['#123456'], 180)).toEqual([{ y: 0, cor: '#123456' }]);
  });
});

describe('larguraDoCeu — 64 px de gradiente, ou a tela inteira quando há sol', () => {
  it('[Right] sem sol, a textura é estreita: o gradiente é constante em x, repetir 64 px basta', () => {
    expect(larguraDoCeu({ sky: ['#000', '#fff'], hills: ['#111', '#222'] })).toBe(64);
  });

  it('[Interface] com sol, a textura tem a largura do viewport', () => {
    // Um sol numa textura de 64 px apareceria CINCO vezes lado a lado na tela. A largura não é decoração: é o
    // que impede o azulejamento de multiplicar o sol.
    expect(larguraDoCeu({ sky: ['#000', '#fff'], hills: ['#111', '#222'], sol: { cor: '#fff', x: 0.3, y: 0.46 } })).toBe(320);
  });
});

/** Contexto 2D de mentira: registra o que foi pedido, sem pintar nada. */
function ctxFalso() {
  const ops = [], pontos = [];
  const grad = () => ({ addColorStop: () => {} });
  return {
    ops, pontos, fillStyle: '', globalAlpha: 1,
    save: () => ops.push('save'), restore: () => ops.push('restore'),
    beginPath: () => ops.push('begin'), closePath: () => ops.push('close'), fill: () => ops.push('fill'),
    moveTo: (x, y) => pontos.push([x, y]), lineTo: (x, y) => pontos.push([x, y]),
    arc: (x, y, r) => { ops.push('arc'); pontos.push([x - r, y - r], [x + r, y + r]); },
    fillRect: () => ops.push('rect'),
    createLinearGradient: grad, createRadialGradient: grad,
  };
}

describe('pintarSol — o leque de raios', () => {
  const SOL = { cor: '#ffe9a8', x: 0.30, y: 0.46 };

  it('[Right] desenha o leque e o disco, e devolve o contexto como o encontrou', () => {
    // `save`/`restore` porque `pintarSol` mexe em `globalAlpha` e `fillStyle`. Sem o par, o próximo a pintar
    // neste contexto herdaria alfa 1 e a cor do sol — e o sintoma seria em OUTRO desenho, não neste.
    const c = ctxFalso();
    pintarSol(c, 320, 180, SOL);
    expect(c.ops[0]).toBe('save');
    expect(c.ops[c.ops.length - 1]).toBe('restore');
    expect(c.ops.filter((o) => o === 'fill').length).toBeGreaterThanOrEqual(9); // 9 raios + brilho + disco
  });

  it('[Boundary] nada do leque encosta nas bordas da textura — a emenda do azulejo é o defeito mais visível', () => {
    // Um raio cortado na borda reaparece do outro lado a cada repetição, e o olho lê isso como uma cicatriz
    // vertical no céu. A abertura de ±35° e o alcance de 0,85·h existem para isso; este caso é quem cobra.
    const c = ctxFalso();
    pintarSol(c, 320, 180, SOL);
    const xs = c.pontos.map((p) => p[0]);
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.max(...xs)).toBeLessThan(320);
  });

  it('[Interface] o leque aponta para CIMA — luz que desce do céu, não um sol de meio-dia', () => {
    const c = ctxFalso();
    pintarSol(c, 320, 180, SOL);
    const sy = 180 * SOL.y;
    // Todo ponto do leque (moveTo/lineTo) está na altura do sol ou ACIMA dela. Os arcos do disco entram nesta
    // lista pelos cantos, e por isso a folga: o disco tem raio, o leque não desce.
    const abaixo = c.pontos.filter((p) => p[1] > sy + 27);
    expect(abaixo).toEqual([]);
  });
});
