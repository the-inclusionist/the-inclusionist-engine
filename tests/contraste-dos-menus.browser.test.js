// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE'S MENUS MEET THEIR CONTRAST FLOORS (ADR-0159 rule 8; WCAG 1.4.3 and 1.4.11).
//
// Text 4.5:1; large text (≥24 px, or ≥18.66 px bold) and inactive text 3:1; the boundary that identifies a control 3:1
// against what surrounds it. 📏 Measured in dist/quiz.html on 2026-09-12 over the quiz, the quick pause, the pause card
// and the six panels: every text passed (lowest 3.09:1, a stepper's inactive end arrow); the pause card's items did NOT —
// a 1 px #3a4a6a border on the #0e1626 card is 2.04:1, and the item's own fill is 1.21:1 against the card.
//
// 📌 The REAL page and stylesheet, colours read from `getComputedStyle` and composed down to the region's ground through
// every translucent layer and opacity — a ratio read off one declaration measures a colour nobody sees.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const tecla = (code) => regiao.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));

const cor = (c) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const linear = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminancia = (c) => 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
const sobre = (cima, baixo) => ({ r: cima.r * cima.a + baixo.r * (1 - cima.a), g: cima.g * cima.a + baixo.g * (1 - cima.a), b: cima.b * cima.a + baixo.b * (1 - cima.a), a: 1 });
const razao = (a, b) => { const x = luminancia(a); const y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** The colour actually behind an element: every translucent background up to an opaque one, over the region's ground. */
function fundo(el) {
  const camadas = [];
  for (let e = el; e; e = e.parentElement) {
    const c = cor(getComputedStyle(e).backgroundColor);
    if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
  }
  return camadas.reverse().reduce((base, c) => sobre(c, base), cor(getComputedStyle(regiao).backgroundColor) ?? { r: 0, g: 0, b: 0, a: 1 });
}

/** Every text node laid out under `raiz` whose contrast is under its floor. */
function textosAbaixo(onde, raiz) {
  const fora = [];
  const passeio = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = passeio.nextNode())) {
    const el = n.parentElement;
    if (!el || !n.textContent.trim() || !el.offsetParent) continue;
    // a colour emoji draws its own colours and ignores CSS `color`: it is an icon, measured as its control's boundary
    if (/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(n.textContent)) continue;
    const cs = getComputedStyle(el);
    const px = parseFloat(cs.fontSize);
    const tinta = cor(cs.color);
    if (!tinta || tinta.a === 0 || px === 0) continue; // text drawn invisible on purpose (a switch's word)
    let opacidade = 1;
    for (let e = el; e; e = e.parentElement) opacidade *= parseFloat(getComputedStyle(e).opacity);
    const atras = fundo(el);
    const r = razao(sobre({ ...tinta, a: tinta.a * opacidade }, atras), atras);
    const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const inativo = !!el.closest('[aria-disabled="true"], [disabled]') || opacidade < 1;
    const piso = grande || inativo ? 3 : 4.5;
    if (r < piso - 0.005) fora.push(`${onde}: «${n.textContent.trim().slice(0, 24)}» ${r.toFixed(2)} < ${piso}`);
  }
  return fora;
}

/** The boundary of a control against what surrounds it: its border or its own fill, whichever shows more. */
function limiteDoControle(el) {
  const cs = getComputedStyle(el);
  const volta = fundo(el.parentElement);
  const borda = cor(cs.borderTopColor);
  const pelaBorda = parseFloat(cs.borderTopWidth) > 0 && borda && borda.a > 0 ? razao(sobre(borda, volta), volta) : 0;
  return Math.max(pelaBorda, razao(fundo(el), volta));
}

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
  regiao.focus();
});

describe('contrast floors in the engine\'s menus', () => {
  it('🎯 [Right] every text of the quick pause, the pause card and the six panels meets its floor', async () => {
    const fora = [];
    tecla('KeyH'); // START: the quick pause
    await esperar();
    fora.push(...textosAbaixo('quick pause', regiao));
    tecla('KeyH');
    tecla('KeyF'); // SELECT: the card
    await esperar();
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    fora.push(...textosAbaixo('card', regiao));
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    let medidos = 0;
    for (const act of ['empatia', 'audio', 'som', 'motora', 'visual', 'anim']) {
      cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
      await esperar();
      const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
      fora.push(...textosAbaixo(painel.id, painel));
      medidos++;
      painel.hidden = true;
      await esperar();
    }
    expect(medidos, 'no panel opened — the case would measure nothing').toBe(6);
    expect(fora).toEqual([]);
  });

  it('🔴 [Right] each pause item\'s boundary is at least 3:1 against the card (WCAG 1.4.11)', () => {
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const itens = [...cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    expect(itens.length, 'no items — the case would measure nothing').toBeGreaterThan(3);
    const fracos = itens.map((b) => [b.textContent.trim(), limiteDoControle(b)]).filter(([, r]) => r < 3)
      .map(([n, r]) => `«${n}» ${r.toFixed(2)}`);
    expect(fracos).toEqual([]);
  });
});

// ⚠️ NOT MEASURED HERE: the 7:1 of the high-contrast levels — the 🌗 repaints the game's textures and is the game's
// (ADR-0148 erratum); the engine's menus have no high-contrast mode of their own.
// ⚠️ EXCLUDED, and why: a colour emoji ignores CSS `color` (an icon — its control's boundary counts); a stepper row has
// no box by the Dev's decision (ADR-0151 erratum), and its ◀ ▶ arrows are text measured at 3:1.
//
// ============================== MUTATIONS CHECKED ==============================
//   K1 the item border back to #3a4a6a       🔴 the boundary case
//   K2 the item text dimmed to #56627a        🔴 the text case
//   K3 a locked item dimmed under 3:1          🔴 the text case
