// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MENUS GROW WITH THEIR TEXT (2026-09-16). The Dev: «a largura do design padrão de menu está fixa! Em resoluções maiores ele acaba
// ficando estreito demais para as opções, seja qual menu estiver sendo desenhado na tela». 📏 Measured at 1920×1080 before the fix: the
// menus' text at 48 px (`--ui-fs`) in a pause list held at 416 px (26rem of the root's 16 px), every item wrapped onto two lines.
//
// The real quiz page and stylesheet on a large stage; the pause card and a settings panel, measured against their own text size.
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao, cartao;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const letra = (el) => parseFloat(getComputedStyle(el).fontSize);
/** Lines a button's TEXT takes, from the text's own boxes — the button's height is not it, since the target floor grows too. */
const linhas = (el) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size;
};

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:1940px;height:1100px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  regiao = document.getElementById('game-region');
  regiao.focus();
  for (const type of ['keydown', 'keyup']) regiao.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF', key: 'f', bubbles: true }));
  await esperar(50);
  cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
});

describe('on a large screen', () => {
  it('the stage is large and the menus\' text grew with it — otherwise the case measures nothing', () => {
    expect(cartao, 'the pause card did not open').toBeTruthy();
    expect(letra(cartao.querySelector('.pause-menu')), 'the text did not grow').toBeGreaterThanOrEqual(40);
  });
  it('🔴 [Right] the pause list is 26 of its letters wide, and no item wraps', () => {
    const lista = cartao.querySelector('.pause-menu:not([hidden])');
    expect(lista.getBoundingClientRect().width).toBeCloseTo(26 * letra(lista), -1);
    const quebrados = [...lista.querySelectorAll('.pm-btn')].filter((b) => b.offsetParent && linhas(b) > 1).map((b) => b.textContent.trim());
    expect(quebrados, 'items wrapped').toEqual([]);
  });
  it('🔴 [Right] a settings panel\'s list grows the same way', async () => {
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    await esperar(50);
    cartao.querySelector('.pm-btn[data-act="som"]').click();
    await esperar(100);
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    expect(painel, 'the panel did not open').toBeTruthy();
    const lista = painel.querySelector('.ctrl-list');
    expect(lista.getBoundingClientRect().width).toBeGreaterThanOrEqual(26 * letra(lista) - 1);
  });
});

// MUTATIONS CHECKED (2026-09-16):
//   · `.pause-menu` back to 26rem                   → «26 of its letters wide», «no item wraps»
//   · the panel lists' floor back to 26rem          → «a settings panel's list grows»
