// SPDX-License-Identifier: AGPL-3.0-or-later
// A STATE IS NEVER SHOWN BY COLOUR ALONE, AND A LOCKED ITEM SAYS WHY (ADR-0159 rule 10; WCAG 1.4.1).
//
// 📏 Measured in dist/quiz.html on 2026-09-12: a quick-bar icon switched on changed ONLY its background (dark → yellow) —
// its «on» lived in the accessible name and in the caption shown while pointed; the quiz's marked option changed only its
// background too. The pause card's locked items already carry a reason and a dashed border; icons under construction say
// so in their name; no panel control is disabled.
//
// 📌 The REAL page and stylesheet. What is compared is everything drawn EXCEPT colour: border and outline widths and
// styles, the SHAPE of box shadows (their colours removed), generated content, text and opacity.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

let regiao;
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const semCores = (s) => s.replace(/rgba?\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
/** What an element draws, with every colour taken out. */
const formaDe = (el) => {
  const cs = getComputedStyle(el);
  const depois = getComputedStyle(el, '::after');
  const antes = getComputedStyle(el, '::before');
  return JSON.stringify({
    borda: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderBottomWidth} ${cs.borderBottomStyle}`,
    contorno: `${cs.outlineStyle} ${cs.outlineWidth}`,
    sombra: semCores(cs.boxShadow),
    depois: `${depois.content} ${semCores(depois.boxShadow)}`,
    antes: antes.content,
    texto: el.textContent.trim(),
    opacidade: cs.opacity,
  });
};

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

describe('state beyond colour', () => {
  it('🔴 [Right] a quick-bar icon switched ON looks different in something other than colour', async () => {
    const icone = document.querySelector('#title-icons .pi-btn[data-pi="tts"]');
    expect(icone.classList.contains('pi-on'), 'the icon was already on — the case would compare on with on').toBe(false);
    const desligado = formaDe(icone);
    icone.click();
    await esperar();
    try {
      expect(icone.classList.contains('pi-on'), 'the click did not switch the icon on').toBe(true);
      expect(formaDe(icone), 'on and off differ only in colour').not.toBe(desligado);
    } finally {
      icone.click();
    }
  });

  it('🔴 [Right] the quiz\'s marked option looks different from the others in something other than colour', () => {
    const opcoes = [...regiao.querySelectorAll('.quiz-alt')];
    const marcada = opcoes.find((o) => o.classList.contains('is-on'));
    const outra = opcoes.find((o) => !o.classList.contains('is-on'));
    expect(marcada && outra, 'no marked and unmarked option — the case would measure nothing').toBeTruthy();
    // the marked option also holds the page focus, and its focus ring is not the MARK: measure without focus
    document.activeElement?.blur();
    // the text and the number differ between two options by nature; compare the shape without them
    const semTexto = (el) => { const f = JSON.parse(formaDe(el)); delete f.texto; delete f.antes; return JSON.stringify(f); };
    expect(semTexto(marcada), 'the marked option differs only in colour').not.toBe(semTexto(outra));
  });

  it('🔴 [Right] that mark is SYMMETRIC — the fill sits centred inside the border, not shifted up (#166)', () => {
    // The Dev at 640×360: «ao selecionar com teclado, a opção selecionada está ficando com o preenchimento levemente acima
    // da região com borda». Measured: the mark was `inset 0 -5px 0` — a dark strip at the bottom only, so the yellow fill
    // ended 5 px above the bottom border and read as shifted up.
    const marcada = regiao.querySelector('.quiz-alt.is-on');
    const sombra = getComputedStyle(marcada).boxShadow;
    expect(sombra, 'the mark left with the fix — rule 10 still needs it').not.toBe('none');
    const [dx, dy] = (sombra.replace(/rgba?\([^)]*\)/g, '').match(/-?\d+(\.\d+)?px/g) ?? []).map(parseFloat);
    expect([dx, dy], `the mark «${sombra}» is offset`).toEqual([0, 0]);
  });

  it('🎯 [Right] a locked pause item says WHY, and does not rely on colour to look locked', async () => {
    regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true }));
    await esperar();
    const cartao = document.querySelector('.screen-pause:not([hidden])');
    const travados = [...cartao.querySelectorAll('.pm-btn[aria-disabled="true"]')];
    expect(travados.length, 'no locked item — the case would measure nothing').toBeGreaterThan(0);
    const livre = [...cartao.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')]
      .find((b) => b.getAttribute('aria-disabled') !== 'true' && !b.classList.contains('pm-sel'));
    for (const b of travados) {
      expect(b.dataset.motivo, `«${b.textContent.trim()}» is locked without a reason`).toBeTruthy();
      expect(getComputedStyle(b).borderTopStyle, 'a locked item looks locked by colour only').not.toBe(getComputedStyle(livre).borderTopStyle);
    }
    cartao.hidden = true;
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   N1 an icon switched on without its base stripe   🔴
//   N2 the marked option without its base stripe     🔴 (red only once the case blurred the page focus — the focus
//      ring had made the first run pass by accident)
//   N3 a locked item without its dashed border        🔴
