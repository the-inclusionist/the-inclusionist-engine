// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/scene-parallax.desenharPredios — o SKYLINE da Cidade como regra (ADR-0042, project node).
//
// ⚠️ ESTE ARQUIVO FOI REESCRITO depois que a primeira arte gerada foi reprovada na tela, e a lição está aqui
// tanto quanto no gerador: os casos antigos afirmavam a estrutura ERRADA e alguns passavam VAZIOS.
//
// O que eles diziam e por que estava errado:
//   · "os prédios ENCOSTAM — não sobra vão entre um e o seguinte". Falso, e é o defeito central: a medição
//     do original mostra que na linha y=148 do `c2.png` a fileira da frente ocupa 279 das 400 colunas, a de
//     trás aparece em 76 e 45 ficam vazias. São os VÃOS que separam prédio de parede. Pior: depois que a
//     faixa sólida passou a ser um retângulo de largura inteira, esse caso passou a PASSAR VAZIO — o
//     retângulo tem a mesma cor e satisfazia o filtro sozinho.
//   · "todas de 2×2". Falso: as janelas do original são 2 px de largura por 3 a 5 de altura.
//   · "as camadas com janela desenham as DUAS cores". Falso: não existe cor de janela apagada. A apagada é a
//     parede, e desenhar todas as células é o que produziu o quadriculado cinza.
//
// O que se afirma agora é o que faz a arte ler como cidade — vãos, luz quente calibrada e eventos de topo.
import { describe, it, expect } from 'vitest';
import { desenharPredios } from '../app/js/render/scene-parallax.js';
import { CENARIOS } from '../app/js/render/cenario-data.js';

const W = 1280, H = 180;
const FAIXAS = CENARIOS.cidade.predios;

/** Contexto 2D falso: guarda cada retângulo pintado com a cor que estava valendo. */
function ctxFalso() {
  const rects = [];
  return {
    rects,
    fillStyle: '',
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, cor: this.fillStyle }); },
  };
}

/** Pinta a faixa e devolve os retângulos. */
function pintar(faixa, semente = 977) {
  const c = ctxFalso();
  desenharPredios(c, W, H, faixa, semente);
  return c.rects;
}

/** Em quais linhas a coluna `x` foi coberta por algum dos tons de massa? */
function cobertura(rects, faixa, x) {
  const massa = new Set(faixa.corpo);
  const linhas = new Set();
  for (const r of rects) {
    if (!massa.has(r.cor) || x < r.x || x >= r.x + r.w) continue;
    for (let y = r.y; y < r.y + r.h; y++) linhas.add(y);
  }
  return linhas;
}

describe('desenharPredios — a linha sólida e os VÃOS', () => {
  for (const [i, faixa] of FAIXAS.entries()) {
    it(`faixa ${i}: abaixo de \`base\` (${faixa.base}) nenhuma coluna fica sem parede`, () => {
      const rects = pintar(faixa);
      for (const x of [0, 1, 7, 63, 311, 640, 999, W - 2, W - 1]) {
        const linhas = cobertura(rects, faixa, x);
        for (let y = faixa.base; y < H; y++) expect(linhas.has(y), `coluna ${x}, linha ${y}`).toBe(true);
      }
    });

    it(`faixa ${i}: ACIMA da base existem VÃOS — é por eles que a fileira de trás aparece`, () => {
      // O caso mais importante do arquivo, e o inverso exato do que a versão anterior afirmava. Sem vão, a
      // fileira da frente cobre a de trás por inteiro e a camada vira um bloco com janelas boiando nele.
      const rects = pintar(faixa);
      const frente = rects.filter((r) => r.cor === faixa.corpo[1] && r.h < H); // exclui a faixa sólida
      const y = faixa.base - 6;
      const cobertas = new Set();
      for (const r of frente) {
        if (y < r.y || y >= r.y + r.h) continue;
        for (let x = r.x; x < r.x + r.w; x++) cobertas.add(x);
      }
      expect(cobertas.size, `faixa ${i}: a fileira da frente cobriu TUDO em y=${y}`).toBeLessThan(W);
      expect(cobertas.size, `faixa ${i}: a fileira da frente quase sumiu em y=${y}`).toBeGreaterThan(W * 0.25);
    });
  }
});

describe('desenharPredios — os eventos de topo', () => {
  it('há pixel ACIMA do corpo em parte dos prédios: mastro, antena, caixa, degrau', () => {
    // Sem isto a linha do horizonte é uma serra de retângulos, que foi a reprovação da primeira versão.
    for (const [i, faixa] of FAIXAS.entries()) {
      const rects = pintar(faixa).filter((r) => faixa.corpo.includes(r.cor));
      // um "evento" é um retângulo mais estreito ou mais baixo que um corpo de prédio inteiro
      const eventos = rects.filter((r) => r.h < 12 || r.w <= 2);
      expect(eventos.length, `faixa ${i} sem evento de topo`).toBeGreaterThan(8);
    }
  });

  it('o topo mais alto de cada faixa fica ACIMA do menor topo declarado — são as torres marcantes', () => {
    for (const [i, faixa] of FAIXAS.entries()) {
      const rects = pintar(faixa).filter((r) => faixa.corpo.includes(r.cor));
      const maisAlto = Math.min(...rects.map((r) => r.y));
      expect(maisAlto, `faixa ${i}`).toBeLessThan(faixa.topoFundo[0]);
    }
  });
});

describe('desenharPredios — a luz', () => {
  it('NÃO existe cor de janela apagada: toda cor pintada é massa ou é luz declarada', () => {
    // A regra que a primeira versão quebrou. A janela apagada é a parede — não se desenha.
    for (const [i, faixa] of FAIXAS.entries()) {
      const permitidas = new Set([...faixa.corpo, ...(faixa.luz || [])]);
      const forasteiras = [...new Set(pintar(faixa).map((r) => r.cor))].filter((c) => !permitidas.has(c));
      expect(forasteiras, `faixa ${i}`).toEqual([]);
    }
  });

  it('as janelas são 2 px de largura por 3 a 5 de altura, como as medidas no original', () => {
    for (const [i, faixa] of FAIXAS.entries()) {
      if (!faixa.luz) continue;
      const janelas = pintar(faixa).filter((r) => faixa.luz.includes(r.cor));
      expect(janelas.length, `faixa ${i} sem janela`).toBeGreaterThan(0);
      for (const j of janelas) {
        expect(j.w, `faixa ${i}`).toBe(2);
        expect(j.h, `faixa ${i}`).toBeGreaterThanOrEqual(3);
        expect(j.h, `faixa ${i}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('a luz CRESCE com a proximidade — é ela que carrega a profundidade', () => {
    // A calibragem da 1a versão saiu INVERTIDA (luz demais nas distantes, de menos na de perto), e uma
    // cidade com o brilho no lugar errado perde a profundidade inteira.
    const area = (i) => {
      const faixa = FAIXAS[i];
      return pintar(faixa)
        .filter((r) => (faixa.luz || []).includes(r.cor))
        .reduce((s, r) => s + r.w * r.h, 0);
    };
    expect(area(2)).toBeGreaterThan(area(1) * 3);
    expect(area(1)).toBeGreaterThan(area(0) * 2);
  });

  it('nenhuma janela cai fora da tela', () => {
    for (const [i, faixa] of FAIXAS.entries()) {
      for (const j of pintar(faixa).filter((r) => (faixa.luz || []).includes(r.cor))) {
        expect(j.y, `faixa ${i}`).toBeGreaterThanOrEqual(0);
        expect(j.y + j.h, `faixa ${i}`).toBeLessThanOrEqual(H);
      }
    }
  });
});

describe('desenharPredios — determinismo', () => {
  it('a mesma semente devolve exatamente a mesma faixa', () => {
    expect(pintar(FAIXAS[1], 977)).toEqual(pintar(FAIXAS[1], 977));
  });
  it('sementes diferentes dão faixas diferentes — senão as três camadas seriam a mesma imagem', () => {
    expect(pintar(FAIXAS[1], 977)).not.toEqual(pintar(FAIXAS[1], 131));
  });
});
