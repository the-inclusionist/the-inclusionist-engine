// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate da issue #107. Duas propriedades, porque foram dois defeitos numa migração só.
//
// ⚠️ ESTE FICHEIRO NÃO FIXA VALORES. Fixar a saída do LCG faria um teste que passa a ser a razão de a
// aritmética não poder ser corrigida — foi exatamente o que quase impediu esta correção. O que ele fixa
// são as duas propriedades que os consumidores precisam: correntes INDEPENDENTES, e multiplicação que
// não perde bits.
import { describe, it, expect } from 'vitest';
import { createRng, SEMENTE_PADRAO, rnd as rndPartilhado, reseed as reseedPartilhado } from '../app/js/core/rng.js';

describe('createRng: cada consumidor tem a sua corrente (ADR-0038 D13, issue #107)', () => {
  it('duas correntes com a MESMA semente dão a mesma sequência', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const sa = Array.from({ length: 20 }, () => a.rnd());
    const sb = Array.from({ length: 20 }, () => b.rnd());
    expect(sa).toEqual(sb);
  });

  it('desenhar de UMA corrente não move a outra — é o defeito que o game-15puzzle mediu', () => {
    const jogo = createRng(777);
    const particulas = createRng(777);

    // O jogo tira três números. Entre o primeiro e o segundo, o motor de partículas desenha 500 vezes,
    // que é o que `render/fx.ts` faz — uma partícula por chamada, num quadro qualquer.
    const primeiro = jogo.rnd();
    for (let i = 0; i < 500; i++) particulas.rnd();
    const segundo = jogo.rnd();
    const terceiro = jogo.rnd();

    // A mesma semente, sem ninguém a desenhar no meio, tem de dar os mesmos três.
    const sozinho = createRng(777);
    expect([primeiro, segundo, terceiro]).toEqual([sozinho.rnd(), sozinho.rnd(), sozinho.rnd()]);
  });

  it('reseed de uma corrente não alcança as outras', () => {
    const a = createRng(5);
    const b = createRng(5);
    a.reseed(99);
    // `b` continua onde estava: a sua próxima saída é a primeira de uma corrente semeada com 5.
    expect(b.rnd()).toBe(createRng(5).rnd());
  });

  it('shuffle devolve cópia e não toca no original', () => {
    const r = createRng(42);
    const original = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const baralhado = r.shuffle(original);
    expect(baralhado).not.toBe(original);
    expect([...baralhado].sort((x, y) => x - y)).toEqual([...original]);
  });
});

describe('a aritmética do LCG não perde bits (issue #107, defeito 2)', () => {
  it('a corrente bate com o LCG verdadeiro, calculado em BigInt — passo a passo', () => {
    // ⚠️ ESTE É O GATE, e a primeira versão dele não era. Ela comparava `Math.imul` com `Math.imul` e
    // passava mesmo com a mutação aplicada: afirmava uma propriedade da linguagem, não do módulo.
    //
    // Agora a referência é calculada por OUTRO caminho — BigInt, que não tem 2^53 nenhum — e a asserção
    // é sobre o que o módulo devolve. É a vantagem estrutural que um verificador precisa ter sobre o
    // que verifica: o BigInt não pode errar do mesmo jeito que o ponto flutuante erra.
    const r = createRng(SEMENTE_PADRAO);
    let s = BigInt(SEMENTE_PADRAO >>> 0);
    const A = 1103515245n, C = 12345n, MASCARA = 0x7fffffffn;
    for (let i = 0; i < 5000; i++) {
      s = (s * A + C) & MASCARA;
      expect(r.rnd()).toBe(Number(s) / 0x7fffffff);
    }
  });

  it('a aritmética ANTIGA era de facto insegura — o defeito não era teórico', () => {
    // Sem esta medida, o teste acima poderia estar a defender contra nada. Ela diz que na esmagadora
    // maioria dos passos o produto de 64 bits saía da faixa exata de inteiros do JavaScript.
    let s = SEMENTE_PADRAO >>> 0;
    let inseguros = 0;
    for (let i = 0; i < 5000; i++) {
      if (!Number.isSafeInteger(s * 1103515245)) inseguros++;
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    }
    expect(inseguros).toBeGreaterThan(4000);
  });

  it('o período passa de 12 mil e o gerador cobre a faixa', () => {
    // Com a aritmética antiga a corrente reentrava em 12.354 passos, num gerador cujo período nominal é
    // 2^31. Não medimos 2^31 aqui (levaria minutos); medimos que passou MUITO do que era.
    const r = createRng(SEMENTE_PADRAO);
    const vistos = new Set();
    for (let i = 0; i < 60000; i++) vistos.add(r.rnd());
    expect(vistos.size).toBe(60000);
  });

  it('rnd fica em [0, 1) e randInt respeita os dois extremos', () => {
    const r = createRng(2026);
    for (let i = 0; i < 10000; i++) {
      const v = r.rnd();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const vistos = new Set();
    for (let i = 0; i < 3000; i++) vistos.add(r.randInt(3, 7));
    expect([...vistos].sort()).toEqual([3, 4, 5, 6, 7]);
  });
});

describe('enfeite não move o sorteio do jogo (issue #107, a consequência concreta)', () => {
  it('desenhar centenas de partículas não desloca a corrente das moedas', async () => {
    const { rngDecoracao } = await import('../app/js/core/rng.js');

    reseedPartilhado(4242);
    const semEnfeite = [rndPartilhado(), rndPartilhado(), rndPartilhado(), rndPartilhado()];

    reseedPartilhado(4242);
    const comEnfeite = [];
    for (let i = 0; i < 4; i++) {
      // Um quadro qualquer: dezenas de partículas entre dois sorteios do jogo.
      for (let p = 0; p < 60; p++) rngDecoracao.rnd();
      comEnfeite.push(rndPartilhado());
    }

    // ⚠️ A igualdade É a decisão. Antes desta mudança as duas listas divergiam, e divergiam de um jeito
    // que dependia de quantas partículas a tela tinha desenhado — quer dizer, de coisa nenhuma que
    // alguém controle. Repor uma corrente só faz isto ficar vermelho.
    expect(comEnfeite).toEqual(semEnfeite);
  });

  it('a corrente da decoração é outra, e não é a mesma sequência deslocada', async () => {
    const { rngDecoracao, SEMENTE_PADRAO: S } = await import('../app/js/core/rng.js');
    rngDecoracao.reseed(S ^ 0x5eed);
    const enfeite = Array.from({ length: 5 }, () => rngDecoracao.rnd());
    const jogo = createRng(S);
    const doJogo = Array.from({ length: 200 }, () => jogo.rnd());
    // Nenhum dos cinco primeiros do enfeite aparece nos duzentos primeiros do jogo: as correntes não
    // estão só desfasadas, estão separadas.
    for (const v of enfeite) expect(doJogo).not.toContain(v);
  });
});

describe('a corrente partilhada continua a existir, e continua a ser a do jogo próprio', () => {
  it('os quatro exports antigos ainda funcionam — game/ ainda vive aqui (issue #111)', () => {
    reseedPartilhado(1234);
    const doPartilhado = [rndPartilhado(), rndPartilhado(), rndPartilhado()];
    const daFabrica = createRng(1234);
    expect(doPartilhado).toEqual([daFabrica.rnd(), daFabrica.rnd(), daFabrica.rnd()]);
  });
});
