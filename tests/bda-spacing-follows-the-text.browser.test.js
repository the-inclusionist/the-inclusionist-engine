// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BDA SPACING IS THE TEXT'S, WHEREVER THE TEXT IS (ADR-0149 erratum, issue #187).
//
// 🔴 The Dev: «Onde houver ESCRITA ele precisa valer, não células ou bordas. Se dentro de um botão tem texto, as regras de
// espaçamento valem para este texto, mesmo que seja uma única palavra.» 📏 Measured on 2026-09-13: the browser's stylesheet gives
// every `<button>` `letter-spacing: normal` — the pause items and the quiz options had none, while the panels' text had 0.18 em.
//
// 📌 The REAL quiz page and stylesheet, measured as a ratio to each element's own font size: the BDA numbers are in em.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const razao = (el, prop) => {
  const s = getComputedStyle(el);
  return s[prop] === 'normal' ? 0 : +(parseFloat(s[prop]) / parseFloat(s.fontSize)).toFixed(2);
};

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
});

afterEach(() => { document.documentElement.removeAttribute('data-cursiva'); });

describe('the BDA spacing in the text of controls', () => {
  it('🔴 [Right] a quiz option carries 0.18 em between letters and 0.63 em between words', () => {
    // the quiz's Menu button was measured here too; it left for the bar's ☰ (interface log 2026-09-16), a glyph with no words
    const opcao = document.querySelector('.quiz-alt');
    expect(opcao, 'no quiz option — the case would measure nothing').toBeTruthy();
    expect([razao(opcao, 'letterSpacing'), razao(opcao, 'wordSpacing')], opcao.className).toEqual([0.18, 0.63]);
  });

  it('🔴 [Right] a pause item, a panel\'s «Voltar» and a panel\'s select carry it too', async () => {
    for (const type of ['keydown', 'keyup']) regiao.dispatchEvent(new KeyboardEvent(type, { code: 'KeyF', key: 'f', bubbles: true }));
    await esperar(50);
    const cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
    const item = cartao.querySelector('.pm-btn:not([hidden])');
    expect([razao(item, 'letterSpacing'), razao(item, 'wordSpacing')], 'pause item').toEqual([0.18, 0.63]);
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    await esperar(50);
    // the first panel of the submenu that holds a select (the hearing panel's voice list)
    const portas = [...cartao.querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn:not([aria-disabled="true"])')]
      .map((b) => b.dataset.act).filter((a) => a && a !== 'pmback');
    let painel = null, lista = null;
    for (const act of portas) {
      cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
      await esperar(100);
      painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
      lista = [...(painel?.querySelectorAll('select') ?? [])].find((s) => s.offsetParent) ?? null;
      if (lista) break;
      painel?.querySelector('.overlay__back')?.click();
      await esperar(50);
    }
    const voltar = painel.querySelector('.overlay__back');
    expect([razao(voltar, 'letterSpacing'), razao(voltar, 'wordSpacing')], '«Voltar»').toEqual([0.18, 0.63]);
    expect(lista, 'the hearing panel has no select — the case would measure nothing').toBeTruthy();
    expect(razao(lista, 'letterSpacing'), 'a select').toBe(0.18);
  });

  it('⚠️ [Boundary] a joined (cursive) face takes it off in the controls as in the text (ADR-0149 §4)', () => {
    document.documentElement.setAttribute('data-cursiva', '1');
    const item = document.querySelector('.pm-btn');
    expect([getComputedStyle(item).letterSpacing, getComputedStyle(document.querySelector('.quiz-alt')).letterSpacing]).toEqual(['normal', 'normal']);
  });

  it('🔴 [Right] the fixed spacings written by hand follow the BDA: PAUSADO and the START and SELECT pills', () => {
    const regras = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } });
    const declarado = (seletor) => regras.find((r) => r.selectorText && r.selectorText.split(',').map((x) => x.trim()).includes(seletor))?.style.letterSpacing;
    for (const seletor of ['.pausa-rapida', '.touch-start', '.game-title']) expect(declarado(seletor), seletor).toBe('var(--ls)');
  });

  it('⚠️ [Boundary] at 640×360 no pause item\'s text overflows its button', () => {
    expect(Math.round(regiao.getBoundingClientRect().width), 'not at 640×360').toBe(640);
    const cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden) ?? document.querySelector('.screen-pause');
    const transbordam = [...cartao.querySelectorAll('.pm-btn')].filter((b) => b.offsetParent && b.scrollWidth > b.clientWidth + 1)
      .map((b) => `${b.textContent.trim()} ${b.scrollWidth}>${b.clientWidth}`);
    expect(transbordam).toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 the controls' inherit rule removed        🔴 quiz option · pause item/panel
//   E2 only letter-spacing inherited             🔴 word spacing in both
//   E3 `.pausa-rapida` back to .12em             🔴 hand-written spacings
