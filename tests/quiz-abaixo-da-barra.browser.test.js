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

// ============================== MUTATIONS CHECKED ==============================
//   Q1 `.quiz-app` loses the bar offset                 🔴 statement behind the bar
//   Q2 the «Visão» select comes back to quiz.html       🔴 a control in the footer zone
