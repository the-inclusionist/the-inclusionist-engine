// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ STARTS BELOW THE QUICK BAR, AND ITS FOOTER ZONE HOLDS NO CONTROLS (ADR-0148, `CLAUDE.md` §4).
//
// 🔴 Seen on a screenshot by the Dev: the statement drawn BEHIND the accessibility bar, and a «Tipografia» button and a
// «Visão» select sitting where the explanation footer belongs. No test failed for either — the bar's intersection is
// only reported in `problems`, which the quiz prints to the console.
//
// 📌 A BROWSER FILE with the REAL page and the REAL stylesheet: the overlap is geometry, and without the stylesheet the
// bar is not positioned and the case would measure nothing.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const corpo = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = corpo;
  // importing the module boots it, because the page now has #quiz-app — the same path as the real page
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

describe('the quiz page', () => {
  it('🔴 [Right] the statement is BELOW the quick bar — they do not overlap', () => {
    const barra = document.getElementById('title-icons').getBoundingClientRect();
    const enunciado = document.querySelector('.quiz-pergunta').getBoundingClientRect();
    expect(barra.height, 'the bar has no height — the case would measure nothing').toBeGreaterThan(0);
    expect(enunciado.top, `statement top ${Math.round(enunciado.top)} is above the bar bottom ${Math.round(barra.bottom)}`)
      .toBeGreaterThanOrEqual(barra.bottom);
  });

  it('🔴 [Zero] no «Tipografia» button and no «Visão» select in the page — the footer zone is the explanation\'s', () => {
    expect(pagina).not.toMatch(/id="q-abrir-typo"|id="q-viz"/);
    expect(document.getElementById('q-abrir-typo')).toBeNull();
    expect(document.getElementById('q-viz')).toBeNull();
    // 📌 and the filter host stays: it is what the 🚥 correction needs
    expect(document.getElementById('q-cvd')).not.toBeNull();
  });

  it('🔴 [Right] the touch door to the menus is the bar\'s FIRST icon, ☰ — and the quiz draws no Menu button of its own', () => {
    // The Dev: «crie um botão para menu (não faz sentido pausar um quiz)» (ADR-0166 erratum), then «Menu deve ser o primeiro
    // ícone» (interface log 2026-09-16). Without the pad, it is the touch door to «Sair» and to the settings.
    expect(document.getElementById('quiz-menu'), 'the quiz still draws its own Menu button').toBeNull();
    const icones = [...document.querySelectorAll('#title-icons .pi-btn')];
    const botao = icones[0];
    expect(botao?.dataset.pi, 'the bar does not open with Menu').toBe('menu');
    expect(botao.getAttribute('aria-label')).toBe('Menu');
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao.hidden, 'the card was already open').toBe(true);
    botao.click();
    try {
      expect(cartao.hidden, 'the menu button did not open the menus').toBe(false);
    } finally {
      cartao.hidden = true;
    }
  });

  it('🔴 [Right] the bar\'s icons TOUCH — no gap between one and the next (interface log 2026-09-16)', () => {
    const icones = [...document.querySelectorAll('#title-icons .pi-btn')].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect());
    expect(icones.length, 'no icons — the case would measure nothing').toBeGreaterThan(2);
    for (let i = 1; i < icones.length; i++) expect(Math.abs(icones[i].left - icones[i - 1].right), `gap after icon ${i}`).toBeLessThan(0.5);
    // and at the smallest screen the whole bar fits the region, with every icon this quiz mounts
    const regiao = document.getElementById('game-region').getBoundingClientRect();
    expect(icones[0].left).toBeGreaterThanOrEqual(regiao.left - 0.5);
    expect(icones.at(-1).right).toBeLessThanOrEqual(regiao.right + 0.5);
  });

  it('🔴 [Right] every option is the ENGINE\'s target — `--alvo-min`, not a size the quiz computes (ADR-0163 rule 2)', () => {
    const regiao = document.getElementById('game-region');
    const alvo = parseFloat(regiao.style.getPropertyValue('--alvo-min'));
    expect(alvo, 'createGame wrote no target floor').toBeGreaterThanOrEqual(44);
    const alturas = [...document.querySelectorAll('.quiz-alt')].map((b) => b.getBoundingClientRect().height);
    expect(alturas.length, 'no options — the case would measure nothing').toBeGreaterThan(1);
    for (const h of alturas) expect(Math.round(h), `an option of ${h.toFixed(1)} px under a floor of ${alvo}`).toBeGreaterThanOrEqual(alvo);
    // and not the quiz's own 9 mm (54 px on a desktop), which pushed the last option out of a 360 px region
    expect(document.documentElement.style.getPropertyValue('--quiz-alt-min')).toBe('');
  });

  it('🔴 [Right] the last option ENDS INSIDE the region, above the footer zone (ADR-0163, ADR-0164 D1)', () => {
    const regiao = document.getElementById('game-region').getBoundingClientRect();
    const opcoes = [...document.querySelectorAll('.quiz-alt')];
    const ultima = opcoes.at(-1).getBoundingClientRect();
    // the footer height is a calc() on the region: resolve it through a probe, not by parsing the declaration
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:absolute;height:var(--rodape-h,0px)';
    document.getElementById('game-region').appendChild(sonda);
    const rodape = sonda.getBoundingClientRect().height;
    sonda.remove();
    expect(rodape, 'the footer zone resolved to nothing — the case would not see it').toBeGreaterThan(0);
    expect(Math.round(regiao.height), 'the region is not at its 640×360 floor here').toBe(360);
    expect(Math.round(ultima.bottom), `last option ends at ${Math.round(ultima.bottom - regiao.top)} of ${Math.round(regiao.height)} (footer ${rodape.toFixed(0)} px)`)
      .toBeLessThanOrEqual(Math.round(regiao.bottom - rodape));
  });
});

// A FACE WITH A 20 px FLOOR ENLARGES ITS OWN TEXT, NOT THE WHOLE DOCUMENT (interface log 2026-09-13; issue #172).
// 📏 Measured in dist/quiz.html at 640×360 with Playwrite BR (scale 1.25): the last option ended 40.6 px past the footer —
// the options' `em` padding grew with the text (+24), the `rem` gaps with the root (+4), the statement and the name line
// under the bar with the text (+15). The Dev, after zooming out to 25%: the text held its size while «uma série de espaços»
// shrank, «mantendo o design muito bom» — those spaces are the ones that yield.
const alturaDoRodape = () => {
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:absolute;height:var(--rodape-h,0px)';
  document.getElementById('game-region').appendChild(sonda);
  const h = sonda.getBoundingClientRect().height;
  sonda.remove();
  return h;
};
const espacos = () => {
  const alt = document.querySelector('.quiz-alt'), cs = getComputedStyle(alt);
  return {
    raiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
    letraOpcao: parseFloat(cs.fontSize),
    letraEnunciado: parseFloat(getComputedStyle(document.querySelector('.quiz-pergunta')).fontSize),
    paddingOpcao: parseFloat(cs.paddingTop),
    paddingNome: parseFloat(getComputedStyle(document.querySelector('#title-icons .pause-icons-cap')).paddingTop),
    vaoOpcoes: parseFloat(getComputedStyle(document.querySelector('.quiz-alts')).rowGap),
    margemEnunciado: parseFloat(getComputedStyle(document.querySelector('.quiz-pergunta')).marginBottom),
    topoDaBarra: parseFloat(getComputedStyle(document.getElementById('title-icons')).top),
  };
};
async function ateAEscala(valor) {
  const botao = [...document.querySelectorAll('#title-icons .pi-btn')].find((b) => /comunica/i.test(b.getAttribute('aria-label') ?? ''));
  expect(botao, 'no communication button on the bar').toBeTruthy();
  for (let i = 0; i < 6 && (document.documentElement.style.getPropertyValue('--fonte-escala') || '1') !== valor; i++) {
    botao.click();
    await new Promise((r) => setTimeout(r, 60));
  }
  expect(document.documentElement.style.getPropertyValue('--fonte-escala') || '1', `the cycle never reached scale ${valor}`).toBe(valor);
}

describe('the quiz with a face whose floor is 20 px (issue #172)', () => {
  let base;
  it('📌 [Right] at the base scale the approved spacing stands: options and statement 4 px apart, the bar on the top edge', () => {
    base = espacos();
    expect(base.vaoOpcoes).toBe(4);
    expect(base.margemEnunciado).toBe(4);
    // since the Dev's «eleve este painel para que compartilhe a borda com a tela» (interface log 2026-09-13) the bar has no offset
    expect(Math.round(base.topoDaBarra)).toBe(0);
  });

  it('🔴 [Right] the hand enlarges its own text, and neither the document nor the text-bound spaces', async () => {
    await ateAEscala('1.25');
    const e = espacos();
    expect(e.letraOpcao, 'the options\' text did not grow to the floor').toBeCloseTo(base.letraOpcao * 1.25, 1);
    expect(e.letraEnunciado).toBeCloseTo(base.letraEnunciado * 1.25, 1);
    expect(e.raiz, 'the whole document grew with the hand').toBe(base.raiz);
    expect(e.paddingOpcao, 'the options\' padding grew with the text').toBeCloseTo(base.paddingOpcao, 1);
    expect(e.paddingNome, 'the padding of the icon name under the bar grew with the text').toBeCloseTo(base.paddingNome, 1);
  });

  it('🔴 [Right] the spaces that shrink under zoom-out yield while the text is larger', () => {
    const e = espacos();
    expect(e.vaoOpcoes, 'the gap between options did not yield').toBeLessThan(base.vaoOpcoes);
    expect(e.margemEnunciado).toBeLessThan(base.margemEnunciado);
    expect(e.topoDaBarra, 'the bar left the top edge').toBe(0);
  });

  it('🔴 [Right] and the last option still ends above the footer at 640×360', async () => {
    const regiao = document.getElementById('game-region').getBoundingClientRect();
    const ultima = [...document.querySelectorAll('.quiz-alt')].at(-1).getBoundingClientRect();
    const rodape = alturaDoRodape();
    try {
      expect(Math.round(regiao.height)).toBe(360);
      expect(Math.round(ultima.bottom - regiao.top), `last option ends at ${Math.round(ultima.bottom - regiao.top)} (footer from ${Math.round(regiao.height - rodape)})`)
        .toBeLessThanOrEqual(Math.round(regiao.height - rodape));
    } finally {
      await ateAEscala('1');
    }
  });

  it('📌 [Inverse] back at the base scale, the spaces come back', () => {
    const e = espacos();
    expect(e.vaoOpcoes).toBe(base.vaoOpcoes);
    expect(Math.round(e.topoDaBarra)).toBe(Math.round(base.topoDaBarra));
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   Q1 `.quiz-app` loses the bar offset                 🔴 statement behind the bar
//   Q2 the «Visão» select comes back to quiz.html       🔴 a control in the footer zone
//   M1 the ☰ goes back to the end of PAUSE_ICONS         🔴 the bar does not open with Menu
//   M2 `abrirMenus` not passed by createGame             🔴 the bar does not open with Menu
//   M3 the ☰'s action does nothing                       🔴 did not open the menus
//   M4 the bar's gap back to .3 of the text              🔴 gap after icon 1
// the face with a 20 px floor (issue #172), with `settings-typo`'s scale case:
//   F1 the root scales with the face again              🔴 the document grew (both files)
//   F2 the options' padding back to `em`                🔴 padding grew · last option in the footer
//   F3 `--espaco-fixo` fixed at 1                        🔴 spaces yield · last option in the footer
//   F4 the options' gap does not yield                  🔴 spaces yield · last option in the footer
//   F5 the bar's offset does not yield                  🔴 spaces yield · last option in the footer
//   F6 the gap under the bar is the name's quarter      🔴 last option in the footer
//   F7 the name's padding back to `em`                  🔴 the name's padding grew (survived before that assertion existed)
//   F8 the spaces yield only to half                    🔴 last option in the footer
