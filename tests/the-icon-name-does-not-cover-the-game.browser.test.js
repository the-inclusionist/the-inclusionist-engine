// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUICK BAR'S RESERVED ROOM COUNTS THE ICON'S NAME AND A LIGHT GAP (ADR-0148 §3 erratum of 2026-09-13; issue #160).
//
// 📏 Measured in dist/quiz.html at 640×360: while an icon is pointed at, its name (the line under the row, on a dark
// chip) sat at 57–87 px and the quiz statement at 54–84 — covered whole. `--barra-a11y-h` said 44 px, the bar alone, and
// the quiz added 12 px by eye. Asked whether it may stay, the Dev: «Não, é necessário que exista um leve espaçamento
// abaixo da barra de acessibilidade rápida.»
//
// 📌 The REAL quiz page and stylesheet — it is geometry. The name is shown the way a child shows it, by pointing at an
// icon, and measured against every node of the game; then again after the scale grows and after the typography cycle
// makes the text 25% larger, because a room measured once at boot is wrong the moment the text grows.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';

const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
let palco;

/** Points at the first icon and measures its name against the statement and the options. */
async function medir() {
  const barra = document.getElementById('title-icons');
  const icone = barra.querySelector('.pi-btn');
  icone.focus();
  icone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await esperar();
  const nome = barra.querySelector('.pause-icons-cap');
  const caixa = nome.getBoundingClientRect();
  const jogo = [document.querySelector('.quiz-pergunta'), ...document.querySelectorAll('.quiz-alt')].map((el) => el.getBoundingClientRect());
  return { texto: nome.textContent.trim(), box: caixa, jogo };
}
const cruza = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  palco = document.querySelector('.stage-wrap');
  palco.style.cssText = 'width:640px;height:360px;display:flex;flex:none';
  await import('../app/js/consumer-quiz/main-quiz.ts');
  await esperar(150);
});

describe('the icon name under the quick bar', () => {
  it('🔴 [Right] at 640×360, the pointed icon\'s name covers nothing of the game, with a gap before the statement', async () => {
    const { texto, box: caixa, jogo } = await medir();
    expect(texto, 'no name shown — the case would measure an empty box').not.toBe('');
    jogo.forEach((r, i) => { expect(cruza(caixa, r), `the name covers game node ${i} (0 = statement)`).toBe(false); });
    expect(jogo[0].top - caixa.bottom, 'no gap between the name and the statement').toBeGreaterThanOrEqual(1);
  });

  it('🔴 [Right] after the scale grows (1280×720), the room grows with it', async () => {
    palco.style.width = '1280px';
    palco.style.height = '720px';
    window.dispatchEvent(new Event('resize'));
    await esperar(150);
    const { box: caixa, jogo } = await medir();
    expect(caixa.height, 'the name did not grow with the scale — the case would measure the old size').toBeGreaterThan(40);
    jogo.forEach((r, i) => { expect(cruza(caixa, r), `at 1280×720 the name covers game node ${i}`).toBe(false); });
    expect(jogo[0].top - caixa.bottom).toBeGreaterThanOrEqual(1);
  });

  it('🔴 [Right] after the typography cycle makes the text 25% larger, the room grows with it', async () => {
    const tipo = document.querySelector('#title-icons [data-pi="tipografia"]')
      ?? [...document.querySelectorAll('#title-icons .pi-btn')].at(-1);
    for (let i = 0; i < 6 && document.documentElement.style.getPropertyValue('--fonte-escala') !== '1.25'; i++) {
      tipo.click();
      await esperar();
    }
    expect(document.documentElement.style.getPropertyValue('--fonte-escala'), 'the cycle never reached the larger hand').toBe('1.25');
    const { box: caixa, jogo } = await medir();
    jogo.forEach((r, i) => { expect(cruza(caixa, r), `with the larger text the name covers game node ${i}`).toBe(false); });
    expect(jogo[0].top - caixa.bottom).toBeGreaterThanOrEqual(1);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with `quiz-abaixo-da-barra`'s «last option above the footer», which holds what the room costs the quiz at 640×360)
//   N1 the room is the bar alone                          🔴 all three
//   N2 no light gap                                       🔴 all three
//   N3 not measured again when the scale is applied       🔴 all four (it is also the boot's only path)
//   N4 not measured again on a typography step            🔴 the larger text
//   N5 a second measure at boot                           SURVIVED — the resolution pass already ran with the bar mounted; it left
//   N6 the name's padding only while a name shows         🔴 1280×720 (the empty line was under-counted)
//   N7 the quiz adds its own 12 px again                  🔴 last option in the footer (320 of 360)
//   N8 the options' own margins back                      🔴 last option in the footer (336)
//   N9 the name line inherits the 1.5 line height         🔴 last option in the footer (312)
//   N10 the name 0.2rem below the row again               🔴 last option in the footer (312)
