// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CURSOR IS ALWAYS VISIBLE: at least 2 px, at 3:1 against its surroundings (ADR-0159 rule 9; WCAG 2.4.7, 2.4.13).
//
// «A focus indicator at least 2 px thick and 3:1 against its surroundings; the focused item is never hidden.» The pause
// card and the quick bar select by CLASS (`.pm-sel`, `.pi-sel`); the panels move the browser's FOCUS. Both are measured
// the same way: the indicator is an outline of ≥2 px at ≥3:1 against what surrounds the control, or a border of ≥2 px
// whose colour changes by ≥3:1 between the unfocused and the focused state.
//
// 📌 A VITEST BROWSER FILE, not the preview: in a tab without system focus Chromium does not apply `:focus` to the
// computed style, and the preview measured every control as having no indicator.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const tecla = (code) => regiao.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const cor = (c) => {
  const m = c && c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const linear = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
const sobre = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
const razao = (a, b) => { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function fundo(el) {
  const camadas = [];
  for (let e = el; e; e = e.parentElement) {
    const c = cor(getComputedStyle(e).backgroundColor);
    if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
  }
  return camadas.reverse().reduce((base, c) => sobre(c, base), { r: 5, g: 7, b: 15, a: 1 });
}
const estilo = (el) => {
  const cs = getComputedStyle(el);
  return { ow: cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth), oc: cor(cs.outlineColor), bw: parseFloat(cs.borderTopWidth), bc: cor(cs.borderTopColor) };
};
/** Why `el` in its current state shows no valid indicator, compared with `antes` (its unfocused style) — or null. */
function semIndicador(el, antes) {
  const agora = estilo(el);
  const volta = fundo(el.parentElement);
  if (agora.ow >= 2 && agora.oc && razao(sobre(agora.oc, volta), volta) >= 3) return null;
  if (agora.bw >= 2 && antes.bc && agora.bc && razao(sobre(agora.bc, volta), sobre(antes.bc, volta)) >= 3) return null;
  return `outline ${agora.ow}px, border ${antes.bw}→${agora.bw}px`;
}
const nome = (el) => (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 28);

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

describe('the cursor is visible everywhere', () => {
  it('⚠️ [Cross-check] the page has system focus — without it `:focus` is not applied and every case would fail', () => {
    expect(document.hasFocus()).toBe(true);
  });

  it('🔴 [Right] the pause card\'s cursor (.pm-sel) and the quick bar\'s (.pi-sel)', async () => {
    tecla('KeyF');
    await esperar();
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const itens = [...cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')];
    const livre = itens.find((b) => !b.classList.contains('pm-sel'));
    const antes = estilo(livre);
    livre.classList.add('pm-sel');
    expect(semIndicador(livre, antes), `«${nome(livre)}»`).toBeNull();
    livre.classList.remove('pm-sel');
    cartao.hidden = true;
    tecla('KeyH');
    await esperar();
    const icone = document.querySelector('#title-icons .pi-sel');
    expect(icone, 'the quick pause put no cursor on the bar').not.toBeNull();
    icone.classList.remove('pi-sel');
    const antesDoIcone = estilo(icone);
    icone.classList.add('pi-sel');
    expect(semIndicador(icone, antesDoIcone), `«${nome(icone)}»`).toBeNull();
    tecla('KeyH');
    await esperar();
  });

  it('🔴 [Right] every control of the six panels shows its focus', async () => {
    const falhas = [];
    let medidos = 0;
    tecla('KeyF');
    await esperar();
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    cartao.querySelector('.pm-btn[data-act="options"]').click();
    for (const act of ['empatia', 'audio', 'som', 'motora', 'visual', 'anim']) {
      cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
      await esperar();
      const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
      for (const el of painel.querySelectorAll('button:not([disabled]), select, input[type=range], [data-passos]')) {
        if (!el.offsetParent) continue;
        el.blur();
        const antes = estilo(el);
        el.focus();
        if (document.activeElement !== el) { falhas.push(`${painel.id}: «${nome(el)}» takes no focus`); continue; }
        medidos++;
        const porque = semIndicador(el, antes);
        if (porque) falhas.push(`${painel.id}: «${nome(el)}» ${el.tagName} — ${porque}`);
      }
      painel.hidden = true;
      await esperar();
    }
    expect(medidos, 'no controls measured').toBeGreaterThan(30);
    expect(falhas).toEqual([]);
  });
});

// ⚠️ «NEVER HIDDEN» IS NOT ASSERTED HERE, and it is known: at 640×360 the button legend on the pause card (ADR-0164 rule 3)
// covers the lower 19 px of the settings submenu's seventh item. The Dev asked for the legend first and will analyse it
// (ADR-0164 erratum); WCAG 2.4.11 (AA) is met — the item is not entirely hidden — and 2.4.12 (AAA) is not.
//
// ============================== MUTATIONS CHECKED ==============================
//   F1 no global `:focus-visible` ring            🔴 the panels case
//   F2 the card cursor without outline            🔴 the cursor case
//   F3 the bar cursor at 1 px, no border change   🔴 the cursor case
//   F4 a switch ring in the panel's own colour     🔴 the panels case
