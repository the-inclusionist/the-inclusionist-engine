// SPDX-License-Identifier: GPL-3.0-or-later
// A MANTA DE NUVENS DA FLORESTA (project node: só a conta, sem PIXI).
//
// O pedido do Dev foi de um MOVIMENTO com causa: cúmulos brancos abundantes que se JUNTAM, chove, e depois se
// SEPARAM mostrando o pôr do sol nas frestas. Isso tem duas metades, e as duas são aferíveis sem tela:
//   · `aglomeracaoAlvo` — QUANDO fecha e QUANDO abre, no mesmo relógio da chuva;
//   · `nuvensDeTela`    — o que "fechado" e "aberto" querem dizer em pixels.
//
// O que estes casos NÃO conseguem dizer é se está bonito. Isso continua precisando de olho, e está declarado
// como verificado na tela no commit.
import { describe, it, expect } from 'vitest';
import { nuvensDeTela, NUVEM_W, NUVEM_H } from '../app/js/render/scene-sky.js';
import { aglomeracaoAlvo, faseDoClima, rainLevelTarget } from '../app/js/render/weather.js';

/** Os números da Floresta: 27 nuvens (3 fileiras de 9) numa tela de 320. Os casos de vizinhança e de
 *  cobertura dependem desses números, e é de propósito — com metade delas a manta não fecharia. */
const N = 27, VW = 320;

describe('faseDoClima — onde estamos dentro do ciclo de 60s', () => {
  it('[Right] 0 é a primeira gota, e o ciclo repete', () => {
    expect(faseDoClima(30)).toBeCloseTo(0);
    expect(faseDoClima(90)).toBeCloseTo(0);
    expect(faseDoClima(45)).toBeCloseTo(15);
  });

  it('[Zero] ANTES dos 30s o resultado ainda é um número de 0 a 60, e não negativo', () => {
    // `(sec - 30) % 60` em JS dá NEGATIVO para sec < 30, e uma fase negativa faria a rampa de aglomeração
    // começar do lado errado — as nuvens abririam antes de fechar. O `+60 %60` é o que evita isso.
    for (const sec of [0, 10, 22, 29.9]) {
      expect(faseDoClima(sec), 'sec=' + sec).toBeGreaterThanOrEqual(0);
      expect(faseDoClima(sec), 'sec=' + sec).toBeLessThan(60);
    }
    expect(faseDoClima(22)).toBeCloseTo(52);
  });
});

describe('aglomeracaoAlvo — quando o céu fecha e quando abre', () => {
  it('[Zero] antes dos 22s o céu está aberto: nada aconteceu ainda', () => {
    for (const sec of [0, 10, 21.9]) expect(aglomeracaoAlvo(sec, true, false), 'sec=' + sec).toBe(0);
  });

  it('[Boundary] tema sem chuva, ou movimento reduzido: nunca fecha', () => {
    // Movimento reduzido não é "menos bonito", é uma opção de acessibilidade contra gatilho vestibular. Um céu
    // que fecha e abre é justamente movimento de fundo em larga escala — o que a opção existe para eliminar.
    expect(aglomeracaoAlvo(35, false, false)).toBe(0);
    expect(aglomeracaoAlvo(35, true, true)).toBe(0);
  });

  it('[Right] fecha em 8s (22→30), fica fechado na chuva, e abre em 10s (42→52)', () => {
    expect(aglomeracaoAlvo(22, true, false)).toBeCloseTo(0);
    expect(aglomeracaoAlvo(26, true, false)).toBeCloseTo(0.5);
    expect(aglomeracaoAlvo(30, true, false)).toBeCloseTo(1);
    expect(aglomeracaoAlvo(36, true, false)).toBeCloseTo(1);
    expect(aglomeracaoAlvo(42, true, false)).toBeCloseTo(1);
    expect(aglomeracaoAlvo(47, true, false)).toBeCloseTo(0.5);
    expect(aglomeracaoAlvo(52, true, false)).toBeCloseTo(0);
    expect(aglomeracaoAlvo(70, true, false)).toBeCloseTo(0); // meio do tempo bom
  });

  it('[Interface] A CAUSA: o céu já está fechado quando cai a primeira gota', () => {
    // É o caso central deste arquivo. Se a manta fechasse JUNTO com a chuva, a chuva pareceria vir do nada e a
    // nuvem pareceria reagir a ela; fechando antes, é a nuvem que traz a chuva — que é o que uma criança já
    // sabe do mundo, e o motivo de a cena poder ser lida sem ninguém explicar.
    const primeiraGota = 30;
    expect(rainLevelTarget(primeiraGota - 0.1, true, false)).toBe(0); // ainda seco
    expect(rainLevelTarget(primeiraGota, true, false)).toBeGreaterThan(0); // molhou
    expect(aglomeracaoAlvo(primeiraGota - 4, true, false)).toBeGreaterThan(0.4); // e já estava meio fechado
    expect(aglomeracaoAlvo(primeiraGota, true, false)).toBe(1);
  });

  it('[Boundary] a rampa é CONTÍNUA — nenhum salto de quadro para quadro', () => {
    // Um degrau aqui apareceria como as nuvens saltando de tamanho num único quadro. Vale a pena cobrar:
    // as três emendas (22, 42, 52) são exatamente onde um erro de sinal ou de divisor se esconderia.
    let anterior = aglomeracaoAlvo(0, true, false);
    for (let sec = 0; sec <= 180; sec += 1 / 60) {
      const v = aglomeracaoAlvo(sec, true, false);
      expect(Math.abs(v - anterior), 'sec=' + sec.toFixed(2)).toBeLessThan(0.02);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      anterior = v;
    }
  });
});

describe('nuvensDeTela — o que "fechado" e "aberto" querem dizer em pixels', () => {
  /** Extremos horizontais das nuvens de UMA fileira, ordenados. A fresta que importa é dentro da fileira. */
  function faixasDaFileira(nuvens, f) {
    return nuvens.filter((_c, i) => i % 3 === f).map((c) => [c.x, c.x + NUVEM_W * c.esc]).sort((a, b) => a[0] - b[0]);
  }
  /** Retângulo de uma nuvem contém o ponto? É como se afere "o sol está escondido". */
  const cobre = (cs, px, py) => cs.some((c) => c.alpha > 0.2
    && px >= c.x && px <= c.x + NUVEM_W * c.esc && py >= c.y && py <= c.y + NUVEM_H * c.esc);

  it('[Right] devolve exatamente `n` nuvens, e é determinístico', () => {
    expect(nuvensDeTela(120, VW, N, 0.3)).toHaveLength(N);
    expect(nuvensDeTela(120, VW, N, 0.3)).toEqual(nuvensDeTela(120, VW, N, 0.3));
  });

  it('[Interface] ABERTO: só a fileira de cima está lá, e ela deixa o céu à mostra', () => {
    // Nove nuvens numa faixa alta. Se todas as 27 aparecessem no tempo bom, não haveria tempo bom.
    const vis = nuvensDeTela(0, VW, N, 0).filter((c) => c.alpha > 0.2);
    expect(vis).toHaveLength(N / 3);
    const base = Math.max(...vis.map((c) => c.y + NUVEM_H * c.esc));
    expect(base).toBeLessThan(60); // a metade de baixo do céu — sol e horizonte — fica livre
  });

  it('[Interface] FECHADO: as 27 aparecem e a manta vai do TOPO até a linha do horizonte', () => {
    // A primeira versão juntava tudo numa faixa alta, e o Dev viu o que aquilo era: uma tarja branca com o
    // pôr do sol inteiro à mostra embaixo. Fechar é COBRIR O CÉU, e a linha do horizonte fica em y=90.
    const vis = nuvensDeTela(0, VW, N, 1).filter((c) => c.alpha > 0.2);
    expect(vis).toHaveLength(N);
    expect(Math.min(...vis.map((c) => c.y))).toBeLessThanOrEqual(1);
    expect(Math.max(...vis.map((c) => c.y + NUVEM_H * c.esc))).toBeGreaterThanOrEqual(90);
  });

  it('[Interface] FECHADO esconde o SOL na esmagadora maioria dos instantes', () => {
    // O pedido do Dev, na letra: "escondendo o Sol". Não em 100% dos quadros de propósito — as fileiras
    // andam em velocidades diferentes, e é isso que abre e fecha as frestas por onde ele espia. Um céu que
    // tampasse o sol o tempo todo seria uma chapa branca, não tempo fechado.
    const solX = 0.30 * 320, solY = 0.46 * 180; // onde a Floresta põe o sol (ver CENARIOS.floresta.sol)
    let tampado = 0, total = 0;
    for (let t = 0; t < 3000; t += 17) { total++; if (cobre(nuvensDeTela(t, VW, N, 1), solX, solY)) tampado++; }
    expect(tampado / total).toBeGreaterThan(0.75);
  });

  it('[Interface] ABERTO o sol aparece — é o que a criança vê voltar quando para de chover', () => {
    const solX = 0.30 * 320, solY = 0.46 * 180;
    let tampado = 0, total = 0;
    for (let t = 0; t < 3000; t += 17) { total++; if (cobre(nuvensDeTela(t, VW, N, 0), solX, solY)) tampado++; }
    expect(tampado / total).toBeLessThan(0.05);
  });

  it('[Interface] FECHADO não sobra fresta DENTRO de nenhuma fileira; ABERTO sobra', () => {
    // A fresta que conta é a da fileira, não a do conjunto: as três fileiras ficam defasadas em x, então um
    // buraco de uma é tapado por outra — mas se a PRÓPRIA fileira tem buraco, ele aparece como uma coluna de
    // céu atravessando a manta. Medido em t=0, onde o passo é uniforme; com as velocidades diferentes ele
    // varia depois, e é essa variação que faz as frestas se abrirem e fecharem sozinhas.
    const pior = (nuvens, f) => { const fs = faixasDaFileira(nuvens, f); let p = -Infinity;
      for (let i = 1; i < fs.length; i++) p = Math.max(p, fs[i][0] - fs[i - 1][1]); return p; };
    for (const f of [0, 1, 2]) expect(pior(nuvensDeTela(0, VW, N, 1), f), 'fileira ' + f).toBeLessThanOrEqual(0);
    expect(pior(nuvensDeTela(0, VW, N, 0), 0)).toBeGreaterThan(4);
  });

  it('[Boundary] dentro de UMA fileira as nuvens não são clones', () => {
    // A fileira é `i % 3`, então toda variação tirada de `i` com fator múltiplo de 3 sai CONSTANTE dentro
    // dela: a fileira 0 — a única que se vê no tempo bom — ficaria com nove nuvens do mesmo tamanho, à mesma
    // altura e à mesma velocidade, enfileiradas como uma cerca. Aconteceu, e é por isso que os fatores são
    // primos com 3. Este caso é quem cobra.
    const cs = nuvensDeTela(0, VW, N, 0).filter((_c, i) => i % 3 === 0);
    expect(new Set(cs.map((c) => c.esc.toFixed(4))).size).toBeGreaterThan(2);
    expect(new Set(cs.map((c) => c.y.toFixed(4))).size).toBeGreaterThan(4);
  });

  it('[Right] as nuvens CRESCEM ao fechar, sem saltos', () => {
    let tamAnterior = 0;
    for (let j = 0; j <= 1.0001; j += 0.1) {
      const tam = nuvensDeTela(0, VW, N, j).reduce((a, c) => a + c.esc, 0);
      expect(tam, 'j=' + j.toFixed(1)).toBeGreaterThan(tamAnterior);
      tamAnterior = tam;
    }
  });

  it('[Boundary] a opacidade sobe ao fechar — nuvem de chuva é mais densa que nuvem de tempo bom', () => {
    expect(nuvensDeTela(0, VW, N, 0)[0].alpha).toBeLessThan(nuvensDeTela(0, VW, N, 1)[0].alpha);
    for (const j of [0, 0.5, 1]) for (const c of nuvensDeTela(0, VW, N, j)) {
      expect(c.alpha).toBeGreaterThanOrEqual(0);
      expect(c.alpha).toBeLessThanOrEqual(1);
    }
  });

  it('[Boundary] `junta` fora de [0,1] é grampeado, não explode', () => {
    expect(nuvensDeTela(0, VW, N, -5)).toEqual(nuvensDeTela(0, VW, N, 0));
    expect(nuvensDeTela(0, VW, N, 9)).toEqual(nuvensDeTela(0, VW, N, 1));
  });

  it('[Zero] zero nuvens não quebra, e uma nuvem não divide por zero', () => {
    expect(nuvensDeTela(50, VW, 0, 0.5)).toEqual([]);
    expect(nuvensDeTela(50, VW, 1, 0.5)).toHaveLength(1);
  });

  it('[Boundary] nenhuma nuvem reentra pela esquerda antes de ter saído INTEIRA pela direita', () => {
    // O bug #21, e ele volta fácil: quem escreve o wrap com a largura fixa de 26 esquece que a nuvem CRESCE
    // com `esc`, e a maior passa a piscar na borda. Aqui a largura do wrap tem de ser a largura DESTA nuvem.
    for (let t = 0; t < 4000; t += 37) {
      for (const c of nuvensDeTela(t, VW, N, 1)) {
        const larg = NUVEM_W * c.esc;
        expect(c.x, 't=' + t).toBeGreaterThanOrEqual(-larg - 1e-6);
        expect(c.x, 't=' + t).toBeLessThanOrEqual(VW + 1e-6);
      }
    }
  });
});
