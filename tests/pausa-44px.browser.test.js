// SPDX-License-Identifier: AGPL-3.0-or-later
// O TAMANHO DO ALVO, MEDIDO NO LAYOUT DE VERDADE — item 6 do ADR-0044.
//
// ========================= POR QUE ESTE GATE É DE NAVEGADOR, E NÃO DE TEXTO =========================
// Os outros gates de CSS deste repositório leem o `style.css` e conferem declarações. Aqui isso não bastaria:
// a altura de um botão não está declarada em lugar nenhum — ela SAI de `padding` + `line-height` + `font-size`
// + o que a cascata fizer com os três. Foi assim que os 35,6 px do cartão de pausa apareceram: ninguém os
// escreveu, eles resultaram. Um gate que lesse `min-height:44px` no arquivo provaria que a linha existe, não
// que o botão tem 44 px.
//
// Então este arquivo IMPORTA O `style.css` de verdade, monta um cartão de pausa com a marcação de produção e
// MEDE com `getBoundingClientRect`. É a mesma diferença entre "o modo promete 7:1" e "o par mede 7,80:1".
//
// ========================= O QUE 44 É, E O QUE NÃO É =========================
// 44 NÃO é o mínimo da WCAG — o 2.5.8 pede 24×24 CSS px, e o cartão já passava nisso com folga. 44 é a
// recomendação da Apple (HIG), e este projeto trata piso como piso: um mínimo atendido não é razão para
// parar. A decisão é do Dev, e é uma escolha, não a correção de uma violação.
//
// E vale para as telas por jogador TAMBÉM. Era ali que a regra quebrava: `.screen-pause .pm-btn` apertava o
// `padding` para caber mais coisa no quadro menor, e o quadro menor é justamente o do jogo com quatro
// crianças — onde os dedos disputam espaço. O cartão rola; o alvo não encolhe.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { screenPauseMarkup } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';

/** O alvo do ADR-0044 §6, em CSS px. */
const ALVO_PX = 44;

let palco;

/** Monta um cartão de pausa REAL dentro de um quadro do tamanho pedido, e devolve o `.screen-pause`. */
function montar(largura, altura) {
  palco = document.createElement('div');
  palco.className = 'player-screen';
  palco.style.cssText = `position:relative;width:${largura}px;height:${altura}px`;
  const sp = document.createElement('div');
  sp.className = 'screen-pause';
  sp.innerHTML = screenPauseMarkup({
    player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS,
    dynLabel: () => null, t: (k) => k,
  });
  palco.appendChild(sp);
  document.body.appendChild(palco);
  return sp;
}

const itensVisiveis = (sp) => [...sp.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];

beforeEach(() => { document.body.innerHTML = ''; });
afterEach(() => { if (palco) palco.remove(); palco = null; });

describe('menu de pausa · 44 px, centrado e mais largo (ADR-0044, item 6)', () => {
  it('[Zero] o gate está medindo layout de verdade', () => {
    // Sem isto, um `style.css` que não carregasse deixaria todo caso abaixo medindo caixas de altura zero —
    // e um gate que passa por não medir nada é pior que nenhum.
    const sp = montar(900, 700);
    const itens = itensVisiveis(sp);
    expect(itens).toHaveLength(PM_BTNS.length);
    expect(itens[0].getBoundingClientRect().width).toBeGreaterThan(0);
    expect(getComputedStyle(sp).position, 'o style.css não foi aplicado').toBe('absolute');
  });

  it('[Right] todo item da lista tem ao menos 44 px de altura', () => {
    const sp = montar(900, 700);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Boundary] o quadro APERTADO de quatro jogadores não encolhe o alvo', () => {
    // A regra quebrava exatamente aqui: `.screen-pause .pm-btn` apertava o padding para caber mais coisa no
    // quadro menor. O quadro menor é o do jogo com quatro crianças, onde os dedos disputam espaço — é o pior
    // lugar possível para encolher um alvo de toque. O cartão rola; o botão não diminui.
    const sp = montar(420, 300);
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'no quadro apertado, item abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
  });

  it('[Right] a lista é UMA coluna — o que se vê é a ordem em que se anda', () => {
    // Era `grid-template-columns:1fr 1fr`. Numa grade de duas colunas a seta anda em ordem de DOM, então
    // "para baixo" pula para a coluna da direita — a mesma mentira que os submenus da abertura contavam.
    const sp = montar(900, 700);
    const esquerdas = new Set(itensVisiveis(sp).map((b) => Math.round(b.getBoundingClientRect().left)));
    expect([...esquerdas], 'a lista voltou a ter mais de uma coluna').toHaveLength(1);
  });

  it('[Right] a lista é CENTRADA no cartão e mais larga que um botão de antes', () => {
    const sp = montar(900, 700);
    const card = sp.querySelector('.pause-card').getBoundingClientRect();
    const lista = sp.querySelector('.pause-menu:not([hidden])').getBoundingClientRect();
    const desvio = Math.abs((lista.left + lista.right) / 2 - (card.left + card.right) / 2);
    expect(desvio, 'a lista saiu do centro do cartão').toBeLessThan(2);
    // 262 px era a largura MEDIDA de um item antes desta decisão (ver o ADR-0044). "Mais larga" tem de ser
    // um número, senão é opinião.
    expect(lista.width, 'a lista não ficou mais larga que os 262 px medidos antes').toBeGreaterThan(262);
  });

  it('[Interface] o submenu de opções obedece à MESMA régua', () => {
    // Ele é a lista onde a criança passa mais tempo, item por item, ajustando o que a atrapalha. Seria o
    // último lugar a merecer botão menor — e o primeiro a escapar de um gate que só olhasse a raiz.
    const sp = montar(900, 700);
    sp.querySelector('.pause-menu[data-sub="raiz"]').hidden = true;
    sp.querySelector('.pause-menu[data-sub="opcoes"]').hidden = false;
    const baixos = itensVisiveis(sp)
      .map((b) => [b.dataset.act, b.getBoundingClientRect().height])
      .filter(([, h]) => h < ALVO_PX - 0.5)
      .map(([a, h]) => `${a}: ${h.toFixed(1)}px`);
    expect(baixos, 'item do submenu abaixo de 44 px: ' + baixos.join(' | ')).toEqual([]);
    expect(itensVisiveis(sp).length).toBe(PM_OPTIONS_BTNS.length);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando `min-height:44px` de `.pm-btn` → "[Right] todo item" reprova medindo ~35,6 px.
//   · devolvendo `.screen-pause .pm-btn{padding:.3rem .5rem}` sem altura mínima → "[Boundary] o quadro
//     apertado" reprova, e os outros casos continuam verdes — que é exatamente o buraco que ele fecha.
//   · devolvendo `grid-template-columns:1fr 1fr` a `.pause-menu` → "[Right] a lista é UMA coluna" reprova
//     com duas larguras distintas.
