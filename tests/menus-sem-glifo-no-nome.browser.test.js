// SPDX-License-Identifier: AGPL-3.0-or-later
// A GLYPH IN A MENU IS DECORATION, NOT PART OF THE NAME (ADR-0159 rule 12).
//
// «An emoji or symbol in a menu is decorative and hidden from narration, or it carries a real label.» 📏 Measured in
// dist/quiz.html on 2026-09-12: the pause card's items and every panel's «Back» carried their glyph in the text —
// «⚙ Inclusion settings», «❓ Help — How to play», «↩ Back» — so the narration and a screen reader said the symbol.
//
// 📌 The REAL quiz page and stylesheet: the glyph is still drawn (by the stylesheet, with empty alternative text), and
// what is measured is the accessible name the engine speaks and a screen reader reads.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { rotuloAcessivel } from '../app/js/core/rotulo-acessivel.js';

/** Pictographs, arrows, geometric shapes, dingbats and miscellaneous symbols — what a menu glyph is made of. */
const GLIFO = /[\p{Extended_Pictographic}←-⇿■-◿✀-➿☀-⛿]/u;
let regiao;
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await esperar();
  regiao = document.getElementById('game-region');
});

describe('menu names carry no glyph', () => {
  it('🔴 [Right] the pause card\'s items: names without their glyph, and the glyph still drawn', async () => {
    regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true })); // SELECT
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const nomes = [];
    for (const sub of ['raiz', 'opcoes']) {
      cartao.querySelectorAll('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
      for (const b of cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')) nomes.push(rotuloAcessivel(b));
    }
    expect(nomes.length, 'no items — the case would measure nothing').toBeGreaterThan(10);
    expect(nomes.filter((n) => GLIFO.test(n)), 'item names that speak a symbol').toEqual([]);
    const ajustes = cartao.querySelector('.pm-btn[data-act="options"]');
    expect(getComputedStyle(ajustes, '::before').content, 'the glyph is no longer drawn').toContain('⚙');
    // drawn with EMPTY alternative text — without the / "" a screen reader puts the generated glyph in the name
    expect(getComputedStyle(ajustes, '::before').content, 'the drawn glyph enters the accessible name').toMatch(/ \/ ""$/);
    cartao.hidden = true;
  });

  it('🔴 [Right] a panel\'s «Back»: its name without the arrow, and the arrow still drawn', async () => {
    regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true })); // SELECT
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    cartao.querySelector('.pm-btn[data-act="som"]').click();
    await esperar();
    const voltar = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden).querySelector('.overlay__back');
    expect(rotuloAcessivel(voltar)).toBe('Voltar');
    expect(getComputedStyle(voltar, '::before').content, 'the arrow is no longer drawn').toContain('↩');
    for (const ov of regiao.querySelectorAll('.overlay')) ov.hidden = true;
    for (const c of regiao.querySelectorAll('.screen-pause')) c.hidden = true;
  });

  it('🔴 [Right] every control of every panel: no glyph in its name — switches\' state words included', async () => {
    // Measured in the dist: «❚❚ On» / «▶ Off» on the switches, «🔇 Off» on the master sound, «⏸ Stop all animations».
    const nomes = [];
    for (const act of ['empatia', 'audio', 'som', 'motora', 'visual', 'anim']) {
      regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true }));
      const cartao = document.querySelector('.screen-pause:not([hidden])');
      cartao.querySelector('.pm-btn[data-act="options"]').click();
      cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
      await esperar();
      const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
      for (const el of painel.querySelectorAll('button, select, input[type=range], [data-passos]')) {
        if (el.offsetParent) nomes.push(`${painel.id}: ${rotuloAcessivel(el)}`);
      }
      painel.hidden = true;
      cartao.hidden = true;
      await esperar();
    }
    expect(nomes.length, 'no controls — the case would measure nothing').toBeGreaterThan(20);
    expect(nomes.filter((n) => GLIFO.test(n)), 'control names that speak a symbol').toEqual([]);
    // the master motion button speaks the page's words, not a Portuguese literal on every page
    expect(nomes.some((n) => /^animation: Parar todas as animações$/.test(n)), 'the motion master button is not in the dictionary').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   G1 the item carries no glyph attribute          🔴
//   G2 the stylesheet draws no item glyph           🔴
//   G3 the panel «Back» carries no arrow             🔴
//   G4 a glyph back in a dictionary value          🔴
//   G5 the glyph drawn WITH alternative text        🔴 (after the `/ ""` assertion was added)
// ---- second cut: the switches (2026-09-12) ----
//   T1 a glyph back in the off word                 🔴 five cases across three files
//   T2 the motion master label with its glyph       🔴
//   T3 the master sound literal back                 🔴 (settings-audio)
//   T4 the motion row with its old text              🔴 (settings-motion)
//   ⚠️ NOT caught here: the master motion label as a Portuguese literal WITHOUT glyph — these files run in pt.
