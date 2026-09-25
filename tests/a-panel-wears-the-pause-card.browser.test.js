// SPDX-License-Identifier: AGPL-3.0-or-later
// A SETTINGS PANEL WEARS THE PAUSE CARD (interface log, 2026-09-13).
//
// 🔴 The Dev: the settings submenu «mantém a mesma altura e identidade visual», and every panel it opens had «outra
// identidade visual, com alturas menores, título maior e cores diferentes». 📏 Measured at 640×360 before the change: the
// pause card 472×355 on #0e1626 with a 2 px gold border and a 16 px gold title; the visual panel 596×274 on #1b2440 with a
// 3 px border, a 24 px white title and rows on #0e1326 with a 2 px light border.
//
// 📌 The REAL quiz page and stylesheet, a panel opened the way a child opens it (SELECT, the settings submenu, a panel), and
// the pause card that stays behind it as the ruler — so the case follows the pause card if the pause card changes.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao, cartaoDePausa;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const painelAberto = () => [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);

async function abrir(act) {
  cartaoDePausa.querySelector(`.pm-btn[data-act="${act}"]`).click();
  await esperar(100);
  const p = painelAberto();
  expect(p, `the ${act} panel did not open — the case would measure nothing`).toBeTruthy();
  return p;
}

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
  cartaoDePausa = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
  cartaoDePausa.querySelector('.pm-btn[data-act="options"]').click();
  await esperar(50);
});

describe('a settings panel opened from the pause card', () => {
  it('🔴 [Right] has the pause card\'s height: same top, same bottom', async () => {
    const painel = await abrir('som');
    const pausa = cartaoDePausa.querySelector('.pause-card').getBoundingClientRect();
    const card = painel.querySelector('.overlay__card').getBoundingClientRect();
    expect(Math.round(regiao.getBoundingClientRect().width), 'not at 640×360').toBe(640);
    expect([Math.abs(Math.round(card.top - pausa.top)), Math.abs(Math.round(card.bottom - pausa.bottom))], 'top and bottom against the pause card').toEqual([0, 0]);
  });

  // Every panel of the submenu, since the narrowest content is the one that would shrink the card.
  it('🔴 [Right] is never narrower than the pause card — no panel of the submenu', async () => {
    const aberto = painelAberto();
    const pausa = cartaoDePausa.querySelector('.pause-card').getBoundingClientRect();
    aberto.querySelector('.overlay__back').click();
    await esperar(50);
    const acts = [...cartaoDePausa.querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn:not([aria-disabled="true"])')]
      .map((b) => b.dataset.act).filter((a) => a && a !== 'pmback');
    expect(acts.length, 'no panel doors — the case would measure nothing').toBeGreaterThan(2);
    const estreitos = [];
    for (const act of acts) {
      const painel = await abrir(act);
      const w = painel.querySelector('.overlay__card').getBoundingClientRect().width;
      if (w < pausa.width - 1) estreitos.push(`${act} ${Math.round(w)} px`);
      painel.querySelector('.overlay__back').click();
      await esperar(50);
    }
    expect(estreitos, `pause card ${Math.round(pausa.width)} px`).toEqual([]);
    await abrir('som');
  });

  it('🔴 [Right] wears the pause card: background, border, radius', () => {
    const p = getComputedStyle(cartaoDePausa.querySelector('.pause-card'));
    const c = getComputedStyle(painelAberto().querySelector('.overlay__card'));
    for (const prop of ['backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderTopLeftRadius']) expect(c[prop], prop).toBe(p[prop]);
  });

  it('🔴 [Right] its title is the pause card\'s title: size and colour', () => {
    const p = getComputedStyle(cartaoDePausa.querySelector('.pause-card h2'));
    const c = getComputedStyle(painelAberto().querySelector('.overlay__card h2'));
    expect([c.fontSize, c.color]).toEqual([p.fontSize, p.color]);
  });

  it('🔴 [Right] its items are the pause items: fill, border, radius — «Voltar» and every row', () => {
    const p = getComputedStyle(cartaoDePausa.querySelector('.pm-btn:not([aria-disabled="true"])'));
    const card = painelAberto().querySelector('.overlay__card');
    const itens = [card.querySelector('.overlay__back'), ...card.querySelectorAll('.ctrl-row')];
    expect(itens.length, 'no rows — the case would compare nothing').toBeGreaterThan(2);
    for (const el of itens) {
      if (el.matches(':focus, :focus-within, :hover')) continue; // the marked item wears the marked colours, as a pause item does
      const s = getComputedStyle(el);
      expect([s.backgroundColor, s.borderTopColor, s.borderTopWidth, s.borderTopLeftRadius], el.textContent.trim().slice(0, 30))
        .toEqual([p.backgroundColor, p.borderTopColor, p.borderTopWidth, p.borderTopLeftRadius]);
    }
  });

  it('⚠️ [Cross-check] the visual panel too — the one that had a card of its own background and position', async () => {
    painelAberto().querySelector('.overlay__back').click();
    await esperar(50);
    const painel = await abrir('visual');
    const pausa = cartaoDePausa.querySelector('.pause-card').getBoundingClientRect();
    const card = painel.querySelector('.overlay__card').getBoundingClientRect();
    expect([Math.abs(Math.round(card.top - pausa.top)), Math.abs(Math.round(card.bottom - pausa.bottom))]).toEqual([0, 0]);
  });
});

describe('the help, opened from the pause card', () => {
  // The help is a slide show (interface log, 2026-09-13): it wears the same card, and shows no menu footer telling the child to
  // point at an option. Measured here because this file carries the real stylesheet.
  it('🔴 [Zero] shows no «point at an option» band', async () => {
    const aberto = painelAberto();
    if (aberto) { aberto.querySelector('.overlay__back').click(); await esperar(50); }
    cartaoDePausa.querySelector('.pm-btn[data-act="pmback"]:not([hidden])')?.click();
    await esperar(50);
    const painel = await abrir('ajuda');
    expect(painel.id, 'the help did not open').toBe('help');
    const faixa = painel.querySelector('.opt-explain');
    expect(faixa === null || getComputedStyle(faixa).display === 'none', 'the help shows a menu\'s band').toBe(true);
    const pausa = cartaoDePausa.querySelector('.pause-card').getBoundingClientRect();
    const card = painel.querySelector('.overlay__card').getBoundingClientRect();
    expect([Math.abs(Math.round(card.top - pausa.top)), Math.abs(Math.round(card.bottom - pausa.bottom))], 'the help\'s card').toEqual([0, 0]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   P1 the panel card rule removed (height/background/border)   🔴 height · background/border/radius · visual cross-check
//   P2 the title rule removed                                     🔴 title
//   P3 the row rule removed                                       🔴 items
//   P4 min-width removed                                          🔴 never narrower
//   P5 the help's band rule removed                               🔴 no band
