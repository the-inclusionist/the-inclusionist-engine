// SPDX-License-Identifier: AGPL-3.0-or-later
// A PANEL'S EXPLANATION IS A FOOTER OF THE SCREEN, NOT OF THE CARD (ADR-0164 rule 1).
//
// 🔴 The Dev, on a platformer screenshot of a settings panel: «duas linhas, fundo escurecido» right, but «está ajustado
// ao menu, não ao canvas». Measured before this change: `.opt-explain` was `position:sticky` inside `.overlay__card`,
// as wide as the card and at the card's bottom.
//
// 📌 The REAL quiz page and stylesheet, and a panel opened the way a child opens it — SELECT, the settings submenu, the
// hearing comfort panel — because the band's geometry depends on the overlay the engine mounts, not on a fixture.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  regiao = document.getElementById('game-region');
  regiao.focus();
  for (const type of ['keydown', 'keyup']) regiao.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF', key: 'f', bubbles: true }));
  await esperar(50);
  const cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
  cartao.querySelector('.pm-btn[data-act="options"]').click();
  await esperar(50);
  cartao.querySelector('.pm-btn[data-act="som"]').click();
  await esperar(100);
});

describe('the explanation of an open panel', () => {
  it('🔴 [Right] sits at the REGION\'s lowest edge, side to side — not fitted to the card', () => {
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    expect(painel, 'no panel opened — the case would measure nothing').toBeTruthy();
    const faixa = painel.querySelector('.opt-explain').getBoundingClientRect();
    const r = regiao.getBoundingClientRect();
    expect(Math.round(r.width), 'not at 640×360').toBe(640);
    expect(Math.abs(faixa.bottom - r.bottom), 'the band is not at the region\'s lowest edge').toBeLessThan(1);
    expect([Math.round(faixa.left - r.left), Math.round(r.right - faixa.right)], 'the band is fitted to the card').toEqual([0, 0]);
    expect(getComputedStyle(painel.querySelector('.opt-explain')).backgroundColor).toBe('rgba(0, 0, 0, 0.82)');
  });

  // The card runs under the band at the pause card's height (interface log, 2026-09-13); what must not happen is a row the
  // child reaches staying hidden behind it — the last row, scrolled into view the way the cursor scrolls, rests above.
  it('🔴 [Right] the last row, brought into view, rests ABOVE the band', () => {
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const card = painel.querySelector('.overlay__card');
    const linhas = [...card.querySelectorAll('.ctrl-row, .overlay__actions button')].filter((e) => e.offsetParent);
    const ultima = linhas[linhas.length - 1];
    ultima.scrollIntoView({ block: 'nearest' });
    const faixa = painel.querySelector('.opt-explain').getBoundingClientRect();
    const b = ultima.getBoundingClientRect();
    expect(b.bottom, `the last row ends ${Math.round(b.bottom - faixa.top)} px into the band`).toBeLessThanOrEqual(faixa.top + 0.5);
    card.scrollTop = 0;
  });

  it('⚠️ [Boundary] two lines at most, whatever the row explains', () => {
    const f = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden).querySelector('.opt-explain');
    const s = getComputedStyle(f);
    // the box less its padding and borders — the edge margin under the words is a transparent border (interface log 2026-09-26)
    const texto = f.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)
      - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
    expect(texto).toBeLessThanOrEqual(2 * parseFloat(s.lineHeight) + 0.5);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 the band back inside the card (sticky)       🔴 both geometry cases
//   R2 no room at the card's end (no `::after`)    🔴 the last row rests inside the band
