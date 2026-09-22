// SPDX-License-Identifier: AGPL-3.0-or-later
// O CANVAS TEM PRIORIDADE SOBRE OS BOTÕES — a quarta cláusula do ADR-0001, que era REGRA e passa a ser FACTO.
//
// ========================= A REGRA, NAS PALAVRAS DO DEV =========================
// A issue #86 guarda a bronca que a originou, depois de o layout ter invertido a prioridade:
//
//     «o canvas deve ocupar o maior espaço possível sem que haja barra de rolagem, e no centro… você dá mais
//      prioridade aos botões do que ao canvas do jogo! OS BOTÕES QUE SE ESPALHEM! Há espaço na tela para isso.»
//
// O ADR-0001 ganhou três cláusulas medidas no código e deixou esta como REGRA, dizendo-o em vez de o esconder.
// A fórmula de `ui/layout` honra o que o `wrap.clientHeight` entregar; quem ganha o espaço ANTES disso é CSS, e
// ninguém tinha verificado.
//
// 📏 MEDIDO ANTES DE ESCREVER, e é o CSS desta árvore que decide as três:
//     body       → flex column, 100dvh, overflow:hidden
//     main       → flex:1, column, min-height:0, overflow:hidden
//     .stage-wrap→ flex:1, align-items:center, justify-content:center, min-height:0
//     .game-region→ flex:none            ← o palco NÃO encolhe por si
//     .topbar/.hud→ flex-wrap:wrap        ← «os botões que se espalhem», literalmente
//
// ⚠️ E A PRIMEIRA CLÁUSULA É VERDADEIRA PELA RAZÃO ERRADA, o que é o achado deste ficheiro. `overflow:hidden`
// garante «sem barra de rolagem» ESCONDENDO o que não cabe: a regra fica satisfeita à letra e pode ser violada
// no espírito, porque um botão que não cabe não gera barra — é CORTADO. Para uma criança, um botão cortado é um
// botão que não existe. Por isso há um caso do RECORTE ao lado do caso da barra: sem ele, este ficheiro
// certificaria exactamente o defeito que a regra quer impedir.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach } from 'vitest';
import css from '../app/css/style.css?raw';

/** A folha da engine, injectada uma vez — é ela o sujeito, não uma cópia das regras dentro do teste. */
beforeEach(() => {
  if (!document.getElementById('css-da-engine')) {
    const s = document.createElement('style');
    s.id = 'css-da-engine';
    s.textContent = css;
    document.head.appendChild(s);
  }
});

const botoes = (n) => Array.from({ length: n }, (_, i) =>
  `<button class="mode-btn" type="button">b${i}</button>`).join('');

/** A estrutura do `app/quiz.html`, com a faixa de botões que o `.topbar` da engine estiliza. */
function montar(quantosBotoes, alturaDoPalco = 360) {
  document.body.innerHTML =
    `<div class="topbar">${botoes(quantosBotoes)}</div>`
    + '<main><div class="stage-wrap"><div id="stage" class="stage">'
    + `<section id="game-region" class="game-region" style="width:640px;height:${alturaDoPalco}px"></section>`
    + '</div></div></main>';
  return {
    barra: document.querySelector('.topbar'),
    wrap: document.querySelector('.stage-wrap'),
    palco: document.querySelector('#game-region'),
    main: document.querySelector('main'),
  };
}

describe('ADR-0001 §4 · o palco tem prioridade sobre os botões (issue #86)', () => {
  it('[Right] a página não rola — nem em altura nem em largura', () => {
    montar(4);
    const raiz = document.documentElement;
    expect(raiz.scrollHeight, 'a página ganhou barra de rolagem vertical').toBeLessThanOrEqual(raiz.clientHeight);
    expect(raiz.scrollWidth, 'a página ganhou barra de rolagem horizontal').toBeLessThanOrEqual(raiz.clientWidth);
  });

  it('⚠️ [Zero] e NADA fica cortado — a regra não se cumpre escondendo o que não cabe', () => {
    // 🎯 O caso que impede este ficheiro de certificar o defeito. `body{overflow:hidden}` faz o caso acima
    // passar sempre; sem este, uma faixa de botões que transbordasse seria «sem barra de rolagem» e a criança
    // ficaria com botões invisíveis. `scrollHeight > clientHeight` num contentor com `overflow:hidden` é
    // exactamente isso: conteúdo cortado.
    const { main, barra } = montar(4);
    expect(main.scrollHeight, 'o palco transborda o `main` e é cortado').toBeLessThanOrEqual(main.clientHeight + 1);
    expect(barra.scrollHeight, 'a faixa de botões está a ser cortada').toBeLessThanOrEqual(barra.clientHeight + 1);
  });

  it('[Right] o `#game-region` fica CENTRADO no espaço que sobra', () => {
    const { wrap, palco } = montar(4);
    const rw = wrap.getBoundingClientRect(), rp = palco.getBoundingClientRect();
    // Tolerância de 1px: um espaço ímpar não se divide em dois inteiros iguais, e exigi-lo seria um gate a
    // reprovar por aritmética em vez de por desenho.
    expect(Math.abs((rp.left + rp.right) / 2 - (rw.left + rw.right) / 2), 'fora do centro horizontal').toBeLessThanOrEqual(1);
    expect(Math.abs((rp.top + rp.bottom) / 2 - (rw.top + rw.bottom) / 2), 'fora do centro vertical').toBeLessThanOrEqual(1);
  });

  it('🎯 [Right] OS BOTÕES ESPALHAM-SE, e o palco NÃO encolhe enquanto houver largura', () => {
    // ⚠️ A frase do Dev virada medição. Com espaço horizontal de sobra, dobrar o número de botões tem de os
    // fazer ocupar a MESMA fileira — e não roubar altura ao palco. O que garante isto é o `flex-wrap:wrap` do
    // `.topbar` mais o `flex:none` do `.game-region`; se a faixa crescesse em altura, o `flex:1` do
    // `.stage-wrap` daria menos espaço e o palco encolheria, que é a inversão que originou a issue.
    const poucos = montar(3);
    const alturaComPoucos = poucos.palco.getBoundingClientRect().height;
    const alturaDaBarraComPoucos = poucos.barra.getBoundingClientRect().height;

    const muitos = montar(8);
    expect(
      muitos.barra.getBoundingClientRect().height,
      'a faixa cresceu em ALTURA em vez de os botões se espalharem em largura',
    ).toBeCloseTo(alturaDaBarraComPoucos, 0);
    expect(
      muitos.palco.getBoundingClientRect().height,
      'o palco encolheu para dar espaço aos botões — é a inversão de prioridade que a #86 relata',
    ).toBeCloseTo(alturaComPoucos, 0);
  });

  it('⚠️ [Boundary] com o palco MAIOR que a tela, a cadeia flex encolhe em vez de empurrar', () => {
    // ⚠️ CASO ACHADO POR MUTAÇÃO SOBREVIVENTE, e o buraco era real: nenhum outro caso põe a cadeia SOB PRESSÃO,
    // que é exactamente quando o `min-height:0` do `main` morde. Num flex de coluna, um item tem
    // `min-height:auto` por padrão e RECUSA encolher abaixo do seu conteúdo — então, sem aquela declaração, o
    // `main` cresce até ao tamanho do palco e empurra a página para fora da tela.
    //
    // 📌 E o defeito NÃO apareceria como barra de rolagem, por causa do `body{overflow:hidden}`: apareceria
    // como o fundo do jogo simplesmente cortado. É a mesma armadilha que o caso do recorte já persegue, agora
    // no ponto onde ela é causada.
    const { main } = montar(4, 4000);
    const alturaDaTela = document.documentElement.clientHeight;
    expect(
      main.getBoundingClientRect().bottom,
      'o `main` empurrou a página para fora da tela — a cadeia flex deixou de encolher',
    ).toBeLessThanOrEqual(alturaDaTela + 1);
  });

  it('⚠️ [Interface] e o sujeito é a folha da ENGINE, não regras copiadas para o teste', () => {
    // Sem isto, um `style.css` que perdesse as regras deixaria os casos acima verdes por o navegador aplicar
    // os seus padrões — e um gate que passa sem o sujeito presente é a pior espécie de verde.
    expect(document.getElementById('css-da-engine'), 'a folha da engine não foi injectada').not.toBeNull();
    montar(3);
    expect(getComputedStyle(document.querySelector('.stage-wrap')).justifyContent).toBe('center');
    expect(getComputedStyle(document.querySelector('.topbar')).flexWrap).toBe('wrap');
    expect(getComputedStyle(document.querySelector('#game-region')).flexGrow).toBe('0');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Cinco, aplicadas AO CSS DA ENGINE — que e o sujeito. Mutar o teste provaria que o teste esta vivo; mutar a
// folha prova que ela e que decide.
//
//   1. 🎯 `.topbar` a perder o `flex-wrap:wrap` -> reprova o caso dos botoes. E a inversao de prioridade que a
//      issue #86 relata, na linha exacta que a impede: sem o wrap a faixa cresce em ALTURA, o `flex:1` do
//      `.stage-wrap` recebe menos, e o palco encolhe para dar espaco aos botoes.
//   2. `.stage-wrap` sem centrar -> reprovam DOIS.
//   3. `.game-region` a passar de `flex:none` para `flex:1` -> reprova o caso dos botoes: o palco deixa de ser
//      o item que NAO cede.
//   4. ⚠️ `main` a perder so o `min-height:0` -> SOBREVIVE, e e uma EQUIVALENCIA com mecanismo nomeado, nao um
//      buraco. A especificacao de flexbox faz `min-height:auto` resolver para ZERO num item cujo `overflow`
//      nao e `visible` — e a mesma regra ja traz `overflow:hidden`, entao a declaracao explicita e redundancia
//      defensiva. ⚠️ NAO FOI DEDUZIDO: foi medido, tirando cada um sozinho (nenhum reprova) e depois os dois.
//   5. `main` a perder `min-height:0` E `overflow:hidden` -> reprova o caso da PRESSAO. E o par que carrega o
//      peso, e e por isso que aquele caso existe: nenhum outro deste ficheiro poe a cadeia flex sob pressao.
