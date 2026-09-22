// SPDX-License-Identifier: AGPL-3.0-or-later
// A LEGENDA DA PAUSA DEIXA DE SER INVISÍVEL PARA QUEM MAIS PRECISA DELA — item 4 do ADR-0044.
//
// ========================= O ACHADO =========================
// `.pause-legend` é a linha que diz QUAL BOTÃO FAZ O QUÊ, e ela carregava `aria-hidden="true"`. É exatamente
// o que a XAG 106 manda narrar ("A to Select"), explicitamente removido da árvore de acessibilidade.
//
// Dá para adivinhar por que alguém pôs o atributo, e a intenção era boa: a legenda mostra GLIFOS de controle
// — `✕`, `○`, `□`, `△` no PlayStation —, e um leitor de tela lê `✕` como "sinal de multiplicação", ou não lê
// nada. Esconder o ruído parece a saída. Mas o preço foi esconder a INFORMAÇÃO junto com o ruído: quem não
// enxerga passou a não ter como saber qual botão confirma.
//
// ========================= POR QUE NÃO BASTA TIRAR O ATRIBUTO =========================
// Tirar `aria-hidden` e parar aí devolveria o ruído: "sinal de multiplicação Sim, círculo Não". A decisão do
// ADR diz isso com todas as letras — "It has to be written so it reads well, which is a rewrite and not an
// attribute removal".
//
// Então são DUAS camadas no mesmo elemento: os chips ficam visíveis e MUDOS (`aria-hidden` desce para eles),
// e ao lado nasce uma frase só para leitor de tela — "Botão xis para confirmar, botão bola para voltar." O
// glifo continua na tela para quem o reconhece; a palavra existe para quem o escuta.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { pauseLegendHtml, spokenGlyph } from '../app/js/ui/shell.js';
import { PAD_DESIGNS } from '../app/js/input/devices.js';

/** A pad design's (yes, no) pair: the south button (index 0) and the east one (index 1) on every design, no swap (ADR-0013 erratum). */
function par(desenho) {
  const s = PAD_DESIGNS[desenho];
  return [s['0'], s['1']];
}

describe('legenda da pausa · o glifo fica na tela, a palavra vai para o ouvido', () => {
  it('[Right] os chips visíveis ficam MUDOS e a frase falada nasce ao lado', () => {
    const [sim, nao] = par('microsoft');
    const html = pauseLegendHtml(sim, nao);
    // O que se vê: dois chips com o glifo e a palavra, marcados para o leitor de tela ignorar.
    expect(html).toContain('<span class="lg" aria-hidden="true">');
    expect(html).toContain('>A<');
    expect(html).toContain('>B<');
    // O que se ouve: UMA frase, e ela diz o que cada botão FAZ.
    expect(html).toContain('<span class="sr-only">Botão A para confirmar, botão B para voltar.</span>');
  });

  it('[Right] o glifo do PlayStation vira PALAVRA na frase falada — e continua glifo na tela', () => {
    // O caso que justifica o item inteiro. `✕` na tela é reconhecível para quem enxerga; no ouvido ele é
    // "sinal de multiplicação" ou silêncio. As duas coisas têm de valer ao mesmo tempo.
    const [sim, nao] = par('sony'); // yes is the south button on PlayStation too: cross (ADR-0013 erratum)
    const html = pauseLegendHtml(sim, nao);
    expect(html).toContain('>○<');
    expect(html).toContain('>✕<');
    expect(html).toContain('<span class="sr-only">Botão xis para confirmar, botão bola para voltar.</span>');
  });

  it('[Zero] NADA na legenda carrega `aria-hidden` no elemento de fora — só nos chips', () => {
    // A regressão que este caso impede é a volta do atributo para o `<p>`: bastaria isso para a frase falada
    // sumir junto, e o teste de cima continuaria verde, porque a frase estaria lá — apenas inalcançável.
    const [sim, nao] = par('generic');
    const html = pauseLegendHtml(sim, nao);
    expect(html.startsWith('<span class="lg"')).toBe(true); // sem invólucro nenhum: quem monta o `<p>` é o DOM
    expect(html).toContain('class="sr-only"');
    expect(html.indexOf('aria-hidden')).toBeGreaterThan(-1);
    expect(html.split('sr-only')).toHaveLength(2); // uma frase, não uma por chip
  });

  it('[Boundary] glifo que já se lê passa INTOCADO — a tradução é só para os quatro que não se leem', () => {
    // Traduzir "A" para "letra A" seria ruído acrescentado em nome de acessibilidade, que é o defeito que
    // este item conserta pelo avesso.
    expect(spokenGlyph('A')).toBe('A');
    expect(spokenGlyph('0')).toBe('0');
    expect(spokenGlyph('✕')).toBe('xis');
    expect(spokenGlyph('○')).toBe('bola');
    expect(spokenGlyph('□')).toBe('quadrado');
    expect(spokenGlyph('△')).toBe('triângulo');
  });

  it('[Interface] a cor do chip continua saindo do desenho do controle', () => {
    // A legenda é a única pista de cor que casa a tela com o controle físico na mão da criança. Ela não pode
    // ser vítima da mudança de acessibilidade.
    const [sim, nao] = par('microsoft');
    const html = pauseLegendHtml(sim, nao);
    expect(html).toContain('background:' + sim[1]);
    expect(html).toContain('background:' + nao[1]);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o `aria-hidden` dos chips → "[Right] os chips visíveis ficam MUDOS" reprova, e o efeito real
//     seria o leitor lendo o glifo E a frase, em dobro.
//   · devolvendo o glifo cru à frase falada (sem `spokenGlyph`) → "[Right] o glifo do PlayStation" reprova
//     com "Botão ○ para confirmar".
//   · trocando a frase por dois `sr-only`, um por chip → "[Zero] uma frase, não uma por chip" reprova.
