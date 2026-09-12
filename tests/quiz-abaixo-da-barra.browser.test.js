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
});

// ============================== MUTATIONS CHECKED ==============================
//   Q1 `.quiz-app` loses the bar offset                 🔴 statement behind the bar
//   Q2 the «Visão» select comes back to quiz.html       🔴 a control in the footer zone
