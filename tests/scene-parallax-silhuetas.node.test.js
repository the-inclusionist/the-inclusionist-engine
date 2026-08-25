// SPDX-License-Identifier: AGPL-3.0-or-later
// AS SILHUETAS DO FUNDO (project node: sem canvas real — um contexto 2D de mentira registra o que foi pedido).
//
// As duas faixas de morro eram lisas: uma floresta e um campo tinham o mesmo desenho em cores diferentes.
// Agora cada tema planta uma silhueta em cima da faixa, na MESMA cor — recorte contra o céu, não pintura.
//
// TESTAR ARTE É POSSÍVEL quando a arte é DETERMINÍSTICA, e é por isso que ela é. Sem `Math.random`, a mesma
// fase desenha o mesmo horizonte em toda máquina, e o teste pode afirmar coisas sobre o desenho em vez de
// afirmar que a função não lançou. O que ele NÃO consegue dizer é se está bonito — isso continua precisando
// de olho, e está declarado como não verificado no commit.
import { describe, it, expect } from 'vitest';
import { hash01, SILHUETAS } from '../app/js/render/scene-parallax.js';

/** Contexto 2D de mentira: registra as chamadas em vez de pintar. */
function ctxFalso() {
  const ops = [];
  return {
    ops,
    fillStyle: '',
    fillRect: (x, y, w, h) => ops.push(['rect', Math.round(x), Math.round(y), Math.round(w), Math.round(h)]),
    beginPath: () => ops.push(['begin']),
    moveTo: (x, y) => ops.push(['move', Math.round(x), Math.round(y)]),
    lineTo: (x, y) => ops.push(['line', Math.round(x), Math.round(y)]),
    arc: (x, y, r) => ops.push(['arc', Math.round(x), Math.round(y), Math.round(r)]),
    closePath: () => ops.push(['close']),
    fill: () => ops.push(['fill']),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
}

/** Roda um elemento de silhueta e devolve as operações que ele pediu. */
function desenhar(sil, x = 100, topo = 100, alt = 20) {
  const c = ctxFalso();
  sil.el(c, x, topo, alt);
  return c.ops;
}

describe('hash01 — a sujeira reprodutível que substitui Math.random', () => {
  it('[Right] fica em [0,1)', () => {
    for (let n = 0; n < 500; n += 7) {
      const v = hash01(n);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('[Right] é DETERMINÍSTICO — a mesma entrada, sempre a mesma saída', () => {
    // É o que torna a arte testável e o que impede o horizonte de mudar entre dois carregamentos do mesmo
    // cenário. Uma criança que reconhece a paisagem não deve encontrá-la diferente ao voltar.
    expect(hash01(42)).toBe(hash01(42));
    expect(hash01(1234567)).toBe(hash01(1234567));
  });

  it('[Boundary] entradas vizinhas dão saídas DIFERENTES — senão os elementos saem enfileirados', () => {
    // Um hash que não espalha faz todas as árvores nascerem com a mesma altura, em fila. Pareceria grade,
    // não paisagem.
    const vizinhos = [10, 11, 12, 13, 14].map(hash01);
    expect(new Set(vizinhos).size).toBe(5);
  });
});

describe('SILHUETAS — o catálogo por tema', () => {
  it('[Right] os quatro temas de fundo gerado têm silhueta nas DUAS faixas', () => {
    for (const id of ['campo', 'cemiterio', 'espaco', 'floresta']) {
      expect(SILHUETAS[id], id).toBeTruthy();
      expect(SILHUETAS[id].far, id + '.far').toBeTruthy();
      expect(SILHUETAS[id].near, id + '.near').toBeTruthy();
    }
  });

  it('[Interface] campo, cemitério e espaço COMPARTILHAM a silhueta — é a mesma terra em três horas', () => {
    // "Cemitério" e "espaço" são ids que MENTEM: os temas viraram "Amanhecer no Campo" e "Noite no Campo".
    // Se alguém der silhuetas próprias a eles, ou renomeou os ids (bom) ou voltou a acreditar neles (ruim).
    expect(SILHUETAS.cemiterio).toBe(SILHUETAS.campo);
    expect(SILHUETAS.espaco).toBe(SILHUETAS.campo);
  });

  it('[Boundary] a MATA DISTANTE da floresta é densa; a do campo é rala — é aí que a diferença mora', () => {
    // Escrevi "a floresta é mais densa nas DUAS faixas" e ver na tela mostrou que isso é falso e indesejável:
    // a faixa da FRENTE da floresta é de troncos individuais, ESPARSOS, e são eles que dão escala. A mata
    // fechada é a de trás. Densidade nas duas faixas produziria uma parede verde sem profundidade nenhuma.
    expect(SILHUETAS.floresta.far.passo).toBeLessThan(SILHUETAS.campo.far.passo);
  });

  it('[Interface] na floresta a frente é ESPARSA e ALTA — troncos, não parede', () => {
    const f = SILHUETAS.floresta;
    expect(f.near.passo).toBeGreaterThan(f.far.passo);   // menos elementos
    expect(f.near.alt[0]).toBeGreaterThan(f.far.alt[1]); // e cada um bem maior que qualquer um do fundo
  });

  it('[Boundary] onde o ELEMENTO é o mesmo nas duas faixas, a da frente é maior', () => {
    // Escrevi este caso como regra geral ("a frente é sempre mais alta") e ele reprovou o campo — com razão.
    // Lá a frente é uma CERCA (7–9 px) e o fundo são ÁRVORES (10–16), e uma cerca mais baixa que as árvores
    // atrás dela é exatamente o certo. A profundidade no campo vem do TIPO de elemento, não da altura.
    // A regra só vale onde o elemento se repete, que é a floresta: conífera perto é maior que conífera longe.
    const f = SILHUETAS.floresta;
    expect(f.near.el).toBe(f.far.el);
    expect(f.near.alt[0]).toBeGreaterThan(f.far.alt[0]);
    expect(f.near.alt[1]).toBeGreaterThan(f.far.alt[1]);
  });

  it('[Interface] no campo a profundidade vem do TIPO: cerca na frente, árvore no fundo', () => {
    expect(SILHUETAS.campo.near.el).not.toBe(SILHUETAS.campo.far.el);
  });
});

describe('os elementos desenham algo, e desenham para CIMA', () => {
  const casos = [['campo far', SILHUETAS.campo.far], ['campo near', SILHUETAS.campo.near],
    ['floresta far', SILHUETAS.floresta.far], ['floresta near', SILHUETAS.floresta.near]];

  for (const [nome, sil] of casos) {
    it(`[Right] ${nome}: pede desenho e nada desce abaixo da linha do morro`, () => {
      // Um elemento que descesse abaixo da linha pintaria por cima do próprio morro — invisível na cor
      // igual, mas ele apareceria como mancha no dia em que a cor mudasse. Melhor pegar agora.
      const ops = desenhar(sil, 100, 100, 20);
      expect(ops.length).toBeGreaterThan(0);
      const ys = ops.flatMap((o) => (o[0] === 'rect' ? [o[2], o[2] + o[4]] : o[0] === 'arc' ? [o[2] + o[3]] : o.slice(2)));
      expect(Math.max(...ys.filter((n) => typeof n === 'number'))).toBeLessThanOrEqual(101);
    });
  }
});

// O `themeHillsTexture` em si NÃO é testado aqui: ele chama `makeCanvas`, que precisa de `document`. O caso
// "tema desconhecido não quebra" tentou rodar neste projeto e falhou com `ReferenceError: document is not
// defined` — o teste estava certo, o LUGAR é que estava errado. Ele vive em scene-parallax.browser.test.js.
