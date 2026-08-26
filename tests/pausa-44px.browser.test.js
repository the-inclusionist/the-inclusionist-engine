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
// recomendação da Apple (HIG), e este projeto trata piso como piso.
//
// MAS A DEFESA MAIS FORTE NÃO É NENHUMA DAS DUAS NORMAS — é a régua física que este projeto já tinha. O Dev
// questionou o número ("44 é exagero"), e a resposta que sobreviveu ao questionamento veio do painel de toque
// dele mesmo: "11–12,5 mm = mão de criança (6–12 anos)… mínimo 11 mm: abaixo disso o polegar erra mais e
// segurar cansa antes (base: alvo de polegar ~9,6 mm)". A 96 px/pol, 44 CSS px = 11,6 mm — dentro da faixa.
// O caso [Interface] no fim prende esse RACIOCÍNIO, e não só o número: quando alguém propuser baixar o alvo,
// o que se perde não é "a recomendação da Apple", são milímetros de polegar.
//
// ========================= O QUE EU TINHA ERRADO, E ELE CORRIGIU =========================
// O questionamento foi: "a tela é desenhada para 320×180 e o mínimo em uso é 640×360, logo o botão precisa de
// 22 no desenho de base". O raciocínio é CERTO — para o que é desenhado DENTRO da canvas. Não é o caso
// destes botões, e a medição diz por quê: o 320×180 é o buffer da canvas, e `#game-region`/`#dom-layer` são
// 640×360 CSS com `transform: none`. A camada DOM nunca entra naquele sistema de coordenadas.
//
// O que ele acertou em cheio foi o TAMANHO DO QUADRO: o gate media 420×300, um número que eu inventei. O piso
// de verdade é 640×360, e é ele que o [Boundary] usa agora. Medir num quadro que ninguém vive é não medir.
//
// ⚠️ E A MEDIÇÃO EXPÔS UM CUSTO ainda não resolvido: a 640×360 o cartão tem 413px de conteúdo para 353
// visíveis — os sete itens de 44px NÃO CABEM e a lista rola. Para quem navega às cegas a rolagem é inofensiva
// (o anel dá a volta e cada item se anuncia); para o dedo é uma rolagem a mais. A escolha entre rolar,
// encolher espaçamentos ou esconder o cabeçalho é do Dev.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../app/css/style.css';
import { screenPauseMarkup } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';

/** O alvo do ADR-0044 §6, em CSS px. */
const ALVO_PX = 44;

/**
 * O MENOR QUADRO EM USO, e ele não é o 320×180 do desenho.
 *
 * Isto foi corrigido pelo Dev depois de eu ter escrito o gate com um "420×300" que era invenção minha. O
 * 320×180 é o BUFFER da canvas; o navegador o amplia 2× e a região fica em 640×360 CSS. E a camada DOM — o
 * cartão de pausa, a barra de acessibilidade, os controles de toque — não entra nesse sistema de
 * coordenadas: MEDIDO no jogo construído, `#game-region` e `#dom-layer` são 640×360 CSS com
 * `transform: none`. Um botão declarado 44px mede 44 CSS px na tela, não 88.
 *
 * Medir num quadro que a produção não tem é medir uma coisa que ninguém vive. O gate passa a usar o piso de
 * verdade.
 */
const MENOR_QUADRO = { w: 640, h: 360 };

/**
 * POR QUE 44, e a defesa mais forte não é a norma — é a régua do próprio projeto.
 *
 * A WCAG 2.5.8 pede 24×24 e a Apple recomenda 44; as duas são argumentos de autoridade. O que decide aqui é
 * a MEDIDA FÍSICA, que o painel de toque deste jogo já fixou: "11–12,5 mm = mão de criança (6–12 anos)…
 * mínimo 11 mm: abaixo disso o polegar erra mais e segurar cansa antes (base: alvo de polegar ~9,6 mm)".
 *
 * A 96 px/pol, 44 CSS px = 11,6 mm — dentro da faixa da mão de criança. E 22 px, que seria a conta se estes
 * botões vivessem no espaço 320×180, dariam 5,8 mm: abaixo do alvo de polegar que o próprio painel cita, e
 * abaixo do piso de 24 px da WCAG. A conversão supõe 96 px/pol; no hardware de escola só o aparelho responde.
 */
const MM_POR_PX = 25.4 / 96;

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

  it('[Boundary] no MENOR quadro em uso (640×360) o alvo não encolhe', () => {
    // A regra quebrava exatamente aqui: `.screen-pause .pm-btn` apertava o padding para caber mais coisa no
    // quadro menor — que é o pior lugar possível para encolher um alvo de toque. O cartão rola; o botão não.
    //
    // E o quadro é o de VERDADE agora: 640×360, o piso que a produção usa. A primeira versão media 420×300,
    // um número que eu inventei — e medir um quadro que ninguém vive é não medir.
    const sp = montar(MENOR_QUADRO.w, MENOR_QUADRO.h);
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

  it('[Interface] 44 CSS px é a MEDIDA FÍSICA que o painel de toque deste jogo já exigia', () => {
    // O caso existe para prender o RACIOCÍNIO, e não só o número. Quando alguém propuser baixar o alvo — e a
    // proposta é razoável à primeira vista, porque 44px de 360 é 12% da altura da tela —, é esta linha que
    // diz o que se perde: não "a recomendação da Apple", mas milímetros de polegar.
    expect(+(ALVO_PX * MM_POR_PX).toFixed(1), '44 CSS px saiu da faixa da mão de criança (11–12,5 mm)').toBeGreaterThanOrEqual(11);
    expect(+(22 * MM_POR_PX).toFixed(1), 'a alternativa de 22 px daria menos que o alvo de polegar (9,6 mm)').toBeLessThan(9.6);
    expect(ALVO_PX, 'abaixo de 24 o alvo furaria o piso da WCAG 2.5.8, não só a recomendação da Apple').toBeGreaterThanOrEqual(24);
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
//   · baixando `ALVO_PX` para 22 (a proposta que o Dev levantou) → "[Interface] 44 CSS px é a MEDIDA FÍSICA"
//     reprova em DUAS asserções: 5,8 mm fica abaixo do alvo de polegar e 22 fura o piso de 24 da WCAG.
