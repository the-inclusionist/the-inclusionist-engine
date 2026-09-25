// SPDX-License-Identifier: AGPL-3.0-or-later
// A MENU ITEM SHOWS NO NUMBER; ITS PLACE IS SPOKEN AFTER ITS NAME (ADR-0167, issue #161; supersedes ADR-0158 items 1–3).
//
// The Dev: «não é necessário um numeração anterior sobre as opções, mas sim fazer com que o TTS leia "1 de 9"… Retire
// também "1 de 9"… no fim do nome dos itens de acessibilidade rápida: isso deve ser falado pelo TTS, não lido».
// 📏 Measured before: the pause card and the quiz options drew a CSS counter, panel rows a `data-item-num`, and the name
// under the quick bar read «Modo cego: desligado, 1 de 9».
//
// 📌 THE PAIR is what keeps this from passing by silence: the number leaves the SCREEN, and «N de M» is still HEARD — the
// live region is read after each reach. A digit is looked for in what is drawn (`::before`) and in what is written.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { screenPauseMarkup } from '../app/js/ui/pause-markup.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/pause-buttons.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

let regiao;
const falas = [];
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const tecla = (code) => (document.activeElement && document.activeElement !== document.body ? document.activeElement : regiao)
  .dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
/** What is DRAWN before an element: a glyph may be, a digit may not. */
const desenhoAntes = (el) => getComputedStyle(el, '::before').content;
// ⚠️ A computed `content` keeps `counter(item-menu)` and `attr(data-item-num)` unresolved — no digit in the string. The
// first version of this check looked for digits only, and passed a card that still drew its counter.
const temDigito = (s) => /counter\(|item-num|\d/.test(s.replace(/\/\s*""$/, ''));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:640px;height:360px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await esperar();
  regiao = document.getElementById('game-region');
  const status = document.getElementById('sr-status');
  new MutationObserver(() => { if (status.textContent) falas.push(status.textContent); })
    .observe(status, { childList: true, characterData: true, subtree: true });
  regiao.focus();
});

describe('the quick bar', () => {
  it('🔴 [Right] the name under the row is name and state only — and «1 de 9» is still HEARD', async () => {
    falas.length = 0;
    tecla('KeyH'); // START: the quick pause puts the cursor on the first icon
    await esperar();
    const nome = document.querySelector('#title-icons .pause-icons-cap').textContent.trim();
    const icones = document.querySelectorAll('#title-icons .pi-btn');
    expect(nome, 'no name shown — the case would measure nothing').not.toBe('');
    expect(nome, 'the visible name carries the spoken index').not.toMatch(/\d+ de \d+/);
    expect(falas.join(' | '), 'the index left the speech too').toContain(`, 1 de ${icones.length}`);
    tecla('KeyH');
    await esperar();
  });

  it('🔴 [Right] a click — a mouse or a finger — writes name and state only, too', async () => {
    // 📏 Seen in the dist on 2026-09-13: after clicking «Comunicação» the line read «COMUNICAÇÃO, 9 DE 9» — the hover and
    // focus paths wrote the name, the click path of the bar the engine mounts wrote the spoken legend.
    const botao = document.querySelector('#title-icons [data-pi="tipografia"]');
    const raiz = document.documentElement;
    const antes = [raiz.dataset.fonte, raiz.dataset.letras, raiz.style.getPropertyValue('--fonte-escala')].join('|');
    botao.click();
    await esperar();
    const nome = document.querySelector('#title-icons .pause-icons-cap').textContent.trim();
    expect(nome, 'no name shown — the case would measure nothing').not.toBe('');
    expect(nome, 'the click wrote the spoken index under the row').not.toMatch(/\d+ (de|of) \d+/);
    // put the typography back where the other cases expect it: once around the ring
    for (let i = 0; i < 7 && [raiz.dataset.fonte, raiz.dataset.letras, raiz.style.getPropertyValue('--fonte-escala')].join('|') !== antes; i++) {
      botao.click();
      await esperar();
    }
  });
});

describe('the pause card', () => {
  it('🔴 [Right] no item draws a number before its name — the glyph stays — and reaching one says «N de M»', async () => {
    tecla('KeyF');
    await esperar();
    const itens = [...document.querySelectorAll('.screen-pause:not([hidden]) .pause-menu:not([hidden]) .pm-btn')];
    expect(itens.length, 'the card did not open').toBeGreaterThan(1);
    for (const b of itens) expect(temDigito(desenhoAntes(b)), `${b.dataset.act} draws «${desenhoAntes(b)}»`).toBe(false);
    expect(itens.some((b) => b.dataset.glifo && desenhoAntes(b).includes(b.dataset.glifo)), 'the glyphs left with the numbers').toBe(true);
    falas.length = 0;
    tecla('ArrowDown');
    await esperar();
    expect(falas.at(-1) ?? '', 'reaching item 2 did not say its place').toMatch(new RegExp(`, 2 de ${itens.length}$`));
  });
});

describe('a settings panel', () => {
  it('🔴 [Right] no row and no control carries a number — and reaching one says «N de M»', async () => {
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="options"]').click();
    await esperar();
    document.querySelector('.screen-pause:not([hidden]) .pm-btn[data-act="som"]').click();
    await esperar();
    const painel = [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
    const card = painel.querySelector('.overlay__card');
    expect(card.querySelectorAll('[data-item-num], .item-num'), 'a row still carries a number').toHaveLength(0);
    const voltar = card.querySelector('.overlay__back');
    expect(desenhoAntes(voltar), '«Voltar» lost its glyph with the number').toContain(voltar.dataset.glifo);
    for (const el of card.querySelectorAll('.ctrl-row, button')) {
      expect(temDigito(desenhoAntes(el)), `«${el.textContent.trim().slice(0, 30)}» draws «${desenhoAntes(el)}»`).toBe(false);
    }
    falas.length = 0;
    tecla('ArrowDown');
    await esperar();
    expect(falas.at(-1) ?? '', 'reaching the next control did not say its place').toMatch(/, 2 de \d+$/);
  });
});

describe('the pause card fits without numbers', () => {
  it('⚠️ [Boundary] at 640×360 no label spills out of its item — in pt, en and es', () => {
    for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
      const palco = document.createElement('div');
      palco.className = 'player-screen';
      palco.style.cssText = 'position:relative;width:640px;height:360px';
      const sp = document.createElement('div');
      sp.className = 'screen-pause';
      sp.innerHTML = screenPauseMarkup({
        player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS, dynLabel: () => null, t: (k) => dic[k] ?? k,
      });
      palco.appendChild(sp);
      document.body.appendChild(palco);
      for (const sub of ['raiz', 'opcoes']) {
        sp.querySelectorAll('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
        for (const b of sp.querySelectorAll('.pause-menu:not([hidden]) .pm-btn')) {
          expect(b.scrollWidth - b.clientWidth, `${nome} ${b.dataset.act} «${b.textContent}» spills`).toBeLessThanOrEqual(0);
        }
      }
      palco.remove();
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (with `quiz-le-as-opcoes`, `consumer-quiz.node` and `pause-icons.browser`)
//   X1  the card's counter back                        🔴 card — FIRST PASSED: the check looked for digits, and a computed
//       `content` keeps `counter(item-menu)` unresolved; it now looks for the counter and the attribute too
//   X2  the quiz options' counter back                 🔴 quiz options
//   X3  the panel glyph rule gone with the numbers     🔴 panel («Voltar» lost ↩)
//   X4  the bar cursor writes «N de M» under the row   🔴 bar (+ pause-icons)
//   X5  hover/focus writes «N de M»                    🔴 pause-icons ×3
//   X6  a click writes «N de M»                        🔴 pause-icons ×3
//   X7  the bar's speech loses «N de M»                🔴 bar — the pair: the index left the screen, not the ear
//   X8  the quiz says «1 Gato» again                   🔴 quiz ×4
//   X9  the quiz joins options with commas              🔴 quiz ×3
//   X10 the quiz ignores the index setting (off)        🔴 quiz ×4
