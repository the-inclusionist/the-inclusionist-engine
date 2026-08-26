// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-parallax.desenharPredios — o SKYLINE da Cidade como regra (ADR-0042, project node).
//
// A textura em si precisa de canvas e só se vê no boot. O que se pode afirmar aqui, sem navegador, é o que
// de fato importa: que a faixa não deixa buraco onde o original tinha parede, que ela é determinística, e
// que a janela só aparece onde a distância permite resolvê-la.
//
// O contexto entra por parâmetro — mesmo precedente do `pintarSol` —, então um contexto falso que grava os
// `fillRect` transforma "a imagem está certa" numa pergunta que um teste responde.
import { describe, it, expect } from 'vitest';
import { desenharPredios } from '../app/js/render/scene-parallax.js';
import { CENARIOS } from '../app/js/render/cenario-data.js';

const W = 1280, H = 180;

/** Contexto 2D falso: guarda cada retângulo pintado com a cor que estava valendo. */
function ctxFalso() {
  const rects = [];
  return {
    rects,
    fillStyle: '',
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, cor: this.fillStyle }); },
  };
}

/** Cobertura por coluna: em quais linhas a coluna `x` foi pintada com algum tom de CORPO. */
function coberturaDeCorpo(rects, corpo, x) {
  const linhas = new Set();
  for (const r of rects) {
    if (!corpo.includes(r.cor)) continue;
    if (x < r.x || x >= r.x + r.w) continue;
    for (let y = r.y; y < r.y + r.h; y++) linhas.add(y);
  }
  return linhas;
}

describe('desenharPredios — a faixa cobre o que prometeu', () => {
  for (const [i, faixa] of CENARIOS.cidade.predios.entries()) {
    it(`faixa ${i}: NENHUMA coluna fica sem parede abaixo da linha \`base\` (${faixa.base})`, () => {
      const c = ctxFalso();
      desenharPredios(c, W, H, faixa, 977);
      // Amostragem larga o bastante para pegar uma emenda: 1280 colunas de 7 em 7, mais as duas bordas.
      for (const x of [0, 1, ...Array.from({ length: 182 }, (_, k) => k * 7), W - 1]) {
        const linhas = coberturaDeCorpo(c.rects, faixa.corpo, x);
        for (let y = faixa.base; y < H; y++) {
          expect(linhas.has(y), `coluna ${x}, linha ${y}`).toBe(true);
        }
      }
    });

    it(`faixa ${i}: os prédios ENCOSTAM — não sobra vão entre um e o seguinte`, () => {
      const c = ctxFalso();
      desenharPredios(c, W, H, faixa, 977);
      const corpos = c.rects.filter((r) => faixa.corpo.includes(r.cor));
      // Os retângulos de corpo saem em ordem de x; o `x` de cada um é o fim do anterior.
      let x = 0;
      for (const r of corpos) {
        if (r.x < x) continue;          // o preenchimento do pé repete o mesmo x
        expect(r.x, `vão antes de x=${r.x}`).toBe(x);
        x = r.x + r.w;
      }
      expect(x).toBe(W); // e a faixa chega à borda: um resto viraria ripa fina na emenda do azulejo
    });

    it(`faixa ${i}: nenhum topo passa dos limites medidos [${faixa.topo[0]}, ${faixa.topo[1]}]`, () => {
      const c = ctxFalso();
      desenharPredios(c, W, H, faixa, 977);
      for (const r of c.rects.filter((r) => faixa.corpo.includes(r.cor))) {
        expect(r.y).toBeGreaterThanOrEqual(Math.min(faixa.topo[0], faixa.base));
        expect(r.y).toBeLessThanOrEqual(Math.max(faixa.topo[1], faixa.base));
      }
    });
  }
});

describe('desenharPredios — determinismo', () => {
  it('a mesma semente devolve exatamente a mesma faixa', () => {
    const faixa = CENARIOS.cidade.predios[1];
    const a = ctxFalso(), b = ctxFalso();
    desenharPredios(a, W, H, faixa, 977);
    desenharPredios(b, W, H, faixa, 977);
    expect(a.rects).toEqual(b.rects);
  });
  it('sementes diferentes dão faixas diferentes — senão as três camadas seriam a mesma imagem', () => {
    const faixa = CENARIOS.cidade.predios[1];
    const a = ctxFalso(), b = ctxFalso();
    desenharPredios(a, W, H, faixa, 977);
    desenharPredios(b, W, H, faixa, 131);
    expect(a.rects).not.toEqual(b.rects);
  });
});

describe('desenharPredios — as janelas', () => {
  it('a camada DISTANTE não desenha janela nenhuma: a essa distância ela não resolve', () => {
    const faixa = CENARIOS.cidade.predios[0];
    expect(faixa.janela).toBeUndefined();
    const c = ctxFalso();
    desenharPredios(c, W, H, faixa, 311);
    const forasteiras = c.rects.filter((r) => !faixa.corpo.includes(r.cor));
    expect(forasteiras).toEqual([]);
  });
  it('as camadas com janela desenham as DUAS cores, e todas de 2×2', () => {
    for (const i of [1, 2]) {
      const faixa = CENARIOS.cidade.predios[i];
      const c = ctxFalso();
      desenharPredios(c, W, H, faixa, 977);
      const janelas = c.rects.filter((r) => faixa.janela.includes(r.cor));
      expect(janelas.length, `faixa ${i}`).toBeGreaterThan(100);
      for (const j of janelas) { expect(j.w).toBe(2); expect(j.h).toBe(2); }
      const cores = new Set(janelas.map((j) => j.cor));
      expect([...cores].sort(), `faixa ${i}`).toEqual([...faixa.janela].sort());
    }
  });
  it('a camada PRÓXIMA tem mais janela que a distante — é o que a distância faz com o detalhe', () => {
    const conta = (i) => {
      const faixa = CENARIOS.cidade.predios[i], c = ctxFalso();
      desenharPredios(c, W, H, faixa, 977);
      return c.rects.filter((r) => (faixa.janela || []).includes(r.cor)).length;
    };
    expect(conta(2)).toBeGreaterThan(conta(1));
  });
});
