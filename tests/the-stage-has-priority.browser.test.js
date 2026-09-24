// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CANVAS HAS PRIORITY OVER THE BUTTONS — the fourth clause of ADR-0001, which was a RULE and becomes a FACT.
//
// ========================= THE RULE, IN THE DEV'S WORDS =========================
// Issue #86 keeps the telling-off that started it, after the layout had inverted the priority:
//
//     «o canvas deve ocupar o maior espaço possível sem que haja barra de rolagem, e no centro… você dá mais
//      prioridade aos botões do que ao canvas do jogo! OS BOTÕES QUE SE ESPALHEM! Há espaço na tela para isso.»
//
// ADR-0001 got three clauses measured in the code and left this one as a RULE, saying so instead of hiding it. The
// formula of `ui/layout` honours whatever `wrap.clientHeight` delivers; what wins the space BEFORE that is CSS, and nobody
// had checked it.
//
// 📏 MEASURED BEFORE WRITING, and it is this tree's CSS that decides the three:
//     body       → flex column, 100dvh, overflow:hidden
//     main       → flex:1, column, min-height:0, overflow:hidden
//     .stage-wrap→ flex:1, align-items:center, justify-content:center, min-height:0
//     .game-region→ flex:none            ← the stage does NOT shrink by itself
//     .topbar/.hud→ flex-wrap:wrap        ← «os botões que se espalhem», literally
//
// ⚠️ AND THE FIRST CLAUSE IS TRUE FOR THE WRONG REASON, which is this file's finding. `overflow:hidden` guarantees «sem
// barra de rolagem» by HIDING what does not fit: the rule is satisfied to the letter and can be broken in spirit, because
// a button that does not fit makes no scrollbar — it is CUT. For a child, a cut button is a button that does not exist.
// That is why there is a CLIPPING case beside the scrollbar case: without it, this file would certify exactly the defect
// the rule wants to prevent.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach } from 'vitest';
import css from '../app/css/style.css?raw';

/** The engine's sheet, injected once — it is the subject, not a copy of the rules inside the test. */
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

/** The structure of `app/quiz.html`, with the button band the engine's `.topbar` styles. */
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
    // 🎯 The case that stops this file from certifying the defect. `body{overflow:hidden}` makes the case above always
    // pass; without this one, a button band that overflowed would be «sem barra de rolagem» and the child would be left
    // with invisible buttons. `scrollHeight > clientHeight` on a container with `overflow:hidden` is exactly that:
    // content cut off.
    const { main, barra } = montar(4);
    expect(main.scrollHeight, 'o palco transborda o `main` e é cortado').toBeLessThanOrEqual(main.clientHeight + 1);
    expect(barra.scrollHeight, 'a faixa de botões está a ser cortada').toBeLessThanOrEqual(barra.clientHeight + 1);
  });

  it('[Right] o `#game-region` fica CENTRADO no espaço que sobra', () => {
    const { wrap, palco } = montar(4);
    const rw = wrap.getBoundingClientRect(), rp = palco.getBoundingClientRect();
    // 1px tolerance: an odd space does not split into two equal integers, and requiring it would be a gate failing by
    // arithmetic instead of by design.
    expect(Math.abs((rp.left + rp.right) / 2 - (rw.left + rw.right) / 2), 'fora do centro horizontal').toBeLessThanOrEqual(1);
    expect(Math.abs((rp.top + rp.bottom) / 2 - (rw.top + rw.bottom) / 2), 'fora do centro vertical').toBeLessThanOrEqual(1);
  });

  it('🎯 [Right] OS BOTÕES ESPALHAM-SE, e o palco NÃO encolhe enquanto houver largura', () => {
    // ⚠️ The Dev's sentence turned into a measurement. With horizontal room to spare, doubling the number of buttons has
    // to make them take the SAME row — and not steal height from the stage. What guarantees this is the `.topbar`'s
    // `flex-wrap:wrap` plus the `.game-region`'s `flex:none`; if the band grew in height, the `.stage-wrap`'s `flex:1`
    // would give less room and the stage would shrink, which is the inversion that started the issue.
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
    // ⚠️ A CASE FOUND BY A SURVIVING MUTATION, and the hole was real: no other case puts the chain UNDER PRESSURE, which is
    // exactly when `main`'s `min-height:0` bites. In a column flex, an item has `min-height:auto` by default and REFUSES
    // to shrink below its content — so, without that declaration, `main` grows to the stage's size and pushes the page
    // off the screen.
    //
    // 📌 And the defect would NOT show as a scrollbar, because of `body{overflow:hidden}`: it would show as the bottom of
    // the game simply cut off. The same trap the clipping case already chases, now at the point where it is caused.
    const { main } = montar(4, 4000);
    const alturaDaTela = document.documentElement.clientHeight;
    expect(
      main.getBoundingClientRect().bottom,
      'o `main` empurrou a página para fora da tela — a cadeia flex deixou de encolher',
    ).toBeLessThanOrEqual(alturaDaTela + 1);
  });

  it('⚠️ [Interface] e o sujeito é a folha da ENGINE, não regras copiadas para o teste', () => {
    // Without this, a `style.css` that lost the rules would leave the cases above green by the browser applying its
    // defaults — and a gate that passes without its subject present is the worst kind of green.
    expect(document.getElementById('css-da-engine'), 'a folha da engine não foi injectada').not.toBeNull();
    montar(3);
    expect(getComputedStyle(document.querySelector('.stage-wrap')).justifyContent).toBe('center');
    expect(getComputedStyle(document.querySelector('.topbar')).flexWrap).toBe('wrap');
    expect(getComputedStyle(document.querySelector('#game-region')).flexGrow).toBe('0');
  });
});

// ========================= MUTATIONS CHECKED =========================
// Five, applied TO THE ENGINE'S CSS — which is the subject. Mutating the test would prove the test is alive; mutating the
// sheet proves the sheet is what decides.
//
//   1. 🎯 `.topbar` losing `flex-wrap:wrap` -> fails the buttons case. It is the priority inversion issue #86 reports, on
//      the exact line that prevents it: without the wrap the band grows in HEIGHT, the `.stage-wrap`'s `flex:1` gets less,
//      and the stage shrinks to make room for the buttons.
//   2. `.stage-wrap` not centring -> TWO fail.
//   3. `.game-region` going from `flex:none` to `flex:1` -> fails the buttons case: the stage stops being the item that
//      does NOT give way.
//   4. ⚠️ `main` losing only `min-height:0` -> SURVIVES, and it is an EQUIVALENCE with a named mechanism, not a hole. The
//      flexbox spec makes `min-height:auto` resolve to ZERO on an item whose `overflow` is not `visible` — and the same
//      rule already carries `overflow:hidden`, so the explicit declaration is defensive redundancy. ⚠️ NOT DEDUCED: it was
//      measured, removing each alone (neither fails) and then both.
//   5. `main` losing `min-height:0` AND `overflow:hidden` -> fails the PRESSURE case. It is the pair that carries the
//      weight, and that is why that case exists: no other in this file puts the flex chain under pressure.
