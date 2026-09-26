// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUICK BAR SAYS THE NAME BELOW ITS ROW AND WHAT THE ICON DOES IN THE FOOTER (`CLAUDE.md` §4, the three zones).
//
// 🔴 The Dev: «O menu de acessibilidade rápida deveria mostrar o nome do item embaixo da fileira ao se navegar por ele
// via controle/teclado ou passar o mouse por cima, e a explicação do que faz no rodapé. Isso não está acontecendo.»
// 📏 Measured: the bar `createGame` mounts in `#title-icons` had no caption element and no hover/focus wiring — the
// caption and its listeners lived only in the per-screen quick bars (`buildQuickBar`), which this root does not mount.
//
// 📌 With the REAL stylesheet: «below the row», «the explanation at the lowest edge, the legend above it» and «a band
// behind the explanation, a chip behind each legend name» (ADR-0164 as the Dev corrected it) are geometry.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let raiz;
const barra = () => raiz.querySelector('#title-icons');
const legenda = () => barra().querySelector('.pause-icons-cap');
const explicacao = () => raiz.querySelector('#game-region .barra-explicacao');
const icone = (k) => barra().querySelector(`.pi-btn[data-pi="${k}"]`);
/**
 * The height of an element's TEXT: its box without the vertical padding and borders (the band's padding is not a line, nor the
 * transparent border that keeps its words the edge margin off the bottom — interface log 2026-09-26).
 */
const alturaDoTexto = (el) => {
  const s = getComputedStyle(el);
  return el.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)
    - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth);
};

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  document.body.appendChild(raiz);
  createGame({ accommodations: SEM_ASSUNTO, onScreenPad: true,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    },
    host: { doc: document, win: window },
    downloadHeavy: false,
  });
});

describe('the quick bar: name below, explanation in the footer', () => {
  it('🔴 [Right] hovering an icon writes its NAME below the row and its EXPLANATION in the footer', () => {
    icone('blind').dispatchEvent(new MouseEvent('mouseenter'));
    expect(legenda()?.textContent, 'no name below the row').toMatch(/^Modo cego/);
    // the explanation is a literal: reading it through `t()` would move with the dictionary and prove nothing
    expect(explicacao()?.textContent).toBe('Joga-se pelo som: a navegação sonora diz o que a tela mostra.');
    expect(explicacao().hidden).toBe(false);
    // geometry: the name is BELOW the row, and the explanation in the lower half of the screen
    const fileira = icone('blind').getBoundingClientRect();
    expect(legenda().getBoundingClientRect().top, 'the name is not below the row').toBeGreaterThanOrEqual(fileira.bottom);
    const regiao = raiz.querySelector('#game-region').getBoundingClientRect();
    expect(explicacao().getBoundingClientRect().top, 'the explanation is not in the footer').toBeGreaterThan(regiao.top + regiao.height / 2);
  });

  it('🔴 [Right] the footer sits at the BOTTOM edge, over a DARK band, and holds at most TWO lines (ADR-0164)', () => {
    // The Dev: «O rodapé deve ocupar no máximo duas linhas de texto e estar na parte mais baixa da tela (canvas), na
    // frente de uma faixa escurecida». Seen on their screenshot: three lines, mid-screen, over a quiz option, no background.
    icone('tipografia').dispatchEvent(new MouseEvent('mouseenter')); // a long explanation (the 🚥 needs a filter host)
    const rodape = raiz.querySelector('#game-region .rodape-da-tela');
    const regiao = raiz.querySelector('#game-region').getBoundingClientRect();
    const caixa = rodape.getBoundingClientRect();
    expect(Math.abs(caixa.bottom - regiao.bottom), 'the footer is not at the bottom edge').toBeLessThan(1);
    // the band is the EXPLANATION's, side to side (ADR-0164 rules 1–2); the column around it paints nothing
    expect(getComputedStyle(explicacao()).backgroundColor, 'no dark band behind the explanation').toBe('rgba(0, 0, 0, 0.82)');
    const faixa = explicacao().getBoundingClientRect();
    expect([Math.round(faixa.left - regiao.left), Math.round(regiao.right - faixa.right)], 'the band is not side to side').toEqual([0, 0]);
    expect(Math.abs(faixa.bottom - regiao.bottom), 'the explanation is not at the lowest edge').toBeLessThan(1);
    const linha = parseFloat(getComputedStyle(explicacao()).lineHeight);
    expect(alturaDoTexto(explicacao()), 'the explanation runs past two lines').toBeLessThanOrEqual(2 * linha + 0.5);
    // ⚠️ and a text that WOULD run longer is cut at two: at 640 px this explanation fits anyway, and the clamp removed
    // stayed green — so the region is narrowed for a moment until the same words need three lines or more
    const elRegiao = raiz.querySelector('#game-region');
    elRegiao.style.width = '240px';
    try {
      expect(explicacao().scrollHeight, 'the case would not measure the cut').toBeGreaterThan(2 * linha + 0.5);
      expect(alturaDoTexto(explicacao()), 'a long explanation grows the band past two lines').toBeLessThanOrEqual(2 * linha + 0.5);
    } finally {
      elRegiao.style.width = '640px';
    }
    icone('tipografia').dispatchEvent(new MouseEvent('mouseleave'));
    expect(getComputedStyle(rodape).display, 'an empty dark band stays over the game').toBe('none');
  });

  it('🎯 [Zero] leaving the icon clears both — no strip of text left over the game', () => {
    icone('blind').dispatchEvent(new MouseEvent('mouseleave'));
    expect(legenda().textContent).toBe('');
    expect(explicacao().hidden, 'the explanation stayed over the game').toBe(true);
  });

  it('🔴 [Right] the button legend has NO band — a dark background behind each «name: function» only (ADR-0164 rule 3)', () => {
    document.getElementById('touch-start').click();
    try {
      const pausaLegenda = raiz.querySelector('#game-region .pausa-legenda');
      expect(getComputedStyle(pausaLegenda).backgroundColor, 'the legend is on a band').toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(raiz.querySelector('#game-region .rodape-da-tela')).backgroundColor, 'the footer column paints a band').toBe('rgba(0, 0, 0, 0)');
      const nomes = [...pausaLegenda.querySelectorAll('.lg-nome')];
      expect(nomes.map((n) => n.textContent), 'the legend names the buttons, not «Ação 2»').toEqual(['2: confirmar', '3: voltar', '4: menu', 'START: voltar ao jogo']);
      for (const n of nomes) expect(getComputedStyle(n).backgroundColor, `no dark background behind «${n.textContent}»`).toBe('rgba(0, 0, 0, 0.82)');
      const regiao = raiz.querySelector('#game-region').getBoundingClientRect();
      const caixa = pausaLegenda.getBoundingClientRect();
      expect([Math.round(caixa.left - regiao.left), Math.round(regiao.right - caixa.right)], 'the legend is not side to side').toEqual([0, 0]);
    } finally {
      document.getElementById('touch-start').click();
    }
  });

  it('🔴 [Right] with the CURSOR of the quick pause, the name and the explanation follow it — the explanation at the lowest edge, the legend above it', () => {
    document.getElementById('touch-start').click(); // START: the quick pause puts the cursor on the first icon
    try {
      const primeiro = barra().querySelector('.pi-sel');
      expect(primeiro, 'the quick pause did not put the cursor on the bar').not.toBeNull();
      expect(legenda().textContent.length, 'the cursor has no name below the row').toBeGreaterThan(0);
      expect(explicacao().hidden, 'the cursor has no explanation in the footer').toBe(false);
      const pausaLegenda = raiz.querySelector('#game-region .pausa-legenda');
      expect(pausaLegenda.hidden, 'the explanation took the legend\'s place').toBe(false);
      // ADR-0164 rule 4: the explanation is at the lowest edge; the legend sits above it and neither covers the other
      expect(pausaLegenda.getBoundingClientRect().bottom, 'the legend covers the explanation').toBeLessThanOrEqual(explicacao().getBoundingClientRect().top + 0.5);
      // ADR-0164: with the legend showing too, the band still holds TWO lines in all
      const linhaDoRodape = parseFloat(getComputedStyle(pausaLegenda).lineHeight);
      const textos = alturaDoTexto(explicacao()) + alturaDoTexto(pausaLegenda);
      expect(textos, 'explanation and legend together run past two lines').toBeLessThanOrEqual(2 * linhaDoRodape + 0.5);
      // hovering another icon and leaving it goes back to the CURSOR, not to nothing
      const nomeDoCursor = legenda().textContent;
      icone('tts').dispatchEvent(new MouseEvent('mouseenter'));
      expect(legenda().textContent, 'hovering did not show the hovered icon').not.toBe(nomeDoCursor);
      icone('tts').dispatchEvent(new MouseEvent('mouseleave'));
      expect(legenda().textContent, 'leaving an icon lost the cursor\'s name').toBe(nomeDoCursor);
      expect(explicacao().hidden, 'leaving an icon lost the cursor\'s explanation').toBe(false);
    } finally {
      document.getElementById('touch-start').click();
    }
    expect(explicacao().hidden, 'leaving the quick pause left the explanation').toBe(true);
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// B1 the engine's bar without the caption element        → red (3)
// B2 no hover/focus wiring on the engine's bar            → red (3)
// B3 the cursor asks no explanation                        → red
// B4 leaving an icon does not fall back to the cursor      → red
// B5 leaving the bar leaves the explanation on screen      → red
// B6 the footer as loose absolute strips                   → red (the explanation covers the legend)
// B7 an icon name back with its parentheses                → red (node dictionary case)
// B8 the name laid out inside the row instead of below     → red
// R3 no dark background behind each legend name          → red
// R4 the band back on the whole footer column            → red
// R5 the legend below the explanation                    → red
// R6 the legend written as one string                    → red (no name chips)
// R7 the legend says «Ação 2» again                      → red
// R8 the explanation band not side to side               → red
