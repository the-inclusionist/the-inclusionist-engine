// SPDX-License-Identifier: AGPL-3.0-or-later
// TEXT GROWS WITH THE SCALE THE ENGINE FORCES (ADR-0163 rule 3).
//
// 🔴 Seen by the Dev on a larger screen: «emojis dos botões de acessibilidade rápida continuam minúsculos, assim como as
// fontes das opções do quiz». Measured in dist/quiz.html at 1280×720: `--ui-fs` was 32 px on the region, and the options
// stayed at 16 px, the bar's emoji at 20 px and the statement at 24 px — everything read the ROOT size, not the region's.
//
// 📌 The REAL page and stylesheet, booted twice over the same document: once with a stage that gives 640×360 and once
// with one that gives 1280×720. A size is right when it DOUBLES, whatever it was at k = 2 — the case pins proportion,
// not a list of pixel values someone could update to match a wrong layout.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

const ALVOS = {
  opcao: '.quiz-alt',
  enunciado: '.quiz-pergunta',
  emoji: '#title-icons .pi-btn',
};

let palco;
let regiao;

/** Resizes the stage and lets `createGame` re-apply the scale, as a window resize does. */
function palcoDe(w, h) {
  palco.style.cssText = `width:${w}px;height:${h}px;display:flex;flex:none`;
  window.dispatchEvent(new Event('resize'));
}

function tamanhos() {
  return Object.fromEntries(Object.entries(ALVOS).map(([nome, sel]) => {
    const el = document.querySelector(sel);
    return [nome, el ? parseFloat(getComputedStyle(el).fontSize) : NaN];
  }));
}

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  palco = document.querySelector('.stage-wrap');
  regiao = document.getElementById('game-region');
  palco.style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
});

describe('text inside the game region follows the scale', () => {
  it('🔴 [Right] at twice the scale, the options, the statement and the bar\'s emoji are twice the size', () => {
    palcoDe(700, 420);
    expect(Math.round(regiao.getBoundingClientRect().width), 'not at 640×360').toBe(640);
    const k2 = tamanhos();
    for (const [nome, px] of Object.entries(k2)) expect(px, `${nome}: nothing measured`).toBeGreaterThan(0);

    palcoDe(1300, 760);
    expect(Math.round(regiao.getBoundingClientRect().width), 'not at 1280×720').toBe(1280);
    const k4 = tamanhos();
    for (const nome of Object.keys(ALVOS)) {
      expect(k4[nome], `${nome}: ${k2[nome]} px at 640×360 and ${k4[nome]} px at 1280×720`).toBeCloseTo(k2[nome] * 2, 0);
    }
  });

  it('🔴 [Boundary] and at 640×360 the options are at the 16 px floor, not under it', () => {
    palcoDe(700, 420);
    expect(tamanhos().opcao).toBeGreaterThanOrEqual(16);
  });

  it('⚠️ [Right] the communication cycle\'s type scale still applies on top of it (the handwriting step is 1.25×)', () => {
    // The root size carries `--fonte-escala`; a region size of `--ui-fs` alone would drop the 25 % the Playwrite step
    // needs to reach its own 20 px floor.
    palcoDe(700, 420);
    document.documentElement.style.setProperty('--fonte-escala', '1.25');
    try {
      expect(tamanhos().opcao).toBeCloseTo(20, 0);
    } finally {
      document.documentElement.style.removeProperty('--fonte-escala');
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 no font size on the region                         🔴 the proportion case
//   T2 region size without `--fonte-escala`                🔴 the type-scale case
//   T3 region size fixed at 16 px                          🔴 the proportion case
//   T4 `aplicarEscala` writes no `--ui-fs`                 🔴 the proportion case