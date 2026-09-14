// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HELP SLIDE SHOW — one slide per position the game names (interface log, 2026-09-13).
//
// 🔴 The Dev: the help screen «se assemelha a um menu e inclusive tem um botão "restaurar padrões deste menu" quando na verdade
// deveria conter uma "apresentação de slides" (textos, figuras e no máximo animações)». The route a child takes through the pause
// card is `boot-create-game.browser`; this file holds the slide itself — the figure, the words, the dots, what is heard.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { helpRows, montarSlides, mostrarSlide, SEM_TECLA } from '../app/js/ui/help-panel.js';

const PRESET = {
  action2: { label: 'Pular', hint: 'Sai do chão e volta.' },
  left: { label: 'Ir para a esquerda' },
  start: { label: 'Pausa' },
};
const ESQUEMA = { action2: ['KeyZ'], left: ['ArrowLeft'], start: null };
const linhas = helpRows(PRESET, (a) => ESQUEMA[a], (c) => `«${c}»`);
const ctx = {
  criar: (tag) => document.createElement(tag),
  t: (k, p) => (k === SEM_TECLA ? 'sem tecla' : k === 'help.slide.tecla' ? `Tecla ${p.k}` : k),
  titulo: 'Ajuda',
};
const novo = () => montarSlides(ctx);

describe('the help slide show', () => {
  it('🔴 [Right] is ONE stop of the cursor, with the page arrows as finger targets and no button inside', () => {
    const el = novo();
    expect(el.hasAttribute('data-passos'), 'left and right would not turn the page').toBe(true);
    expect(el.querySelectorAll('button').length, 'a button inside makes the cursor stop twice').toBe(0);
    expect([...el.querySelectorAll('[data-passo]')].map((s) => s.dataset.passo)).toEqual(['-1', '1']);
  });

  it('🔴 [Right] a slide draws the child\'s key, the game\'s word and its sentence', () => {
    const el = novo();
    mostrarSlide(el, linhas, 1, ctx);
    expect(el.querySelector('.slide').dataset.act).toBe('action2');
    expect(el.querySelector('.slide-tecla').textContent).toBe('«KeyZ»');
    expect(el.querySelector('.slide-palavra').textContent).toBe('Pular');
    expect(el.querySelector('.slide-texto').textContent).toBe('Sai do chão e volta.');
    expect(el.querySelector('.slide-texto').hidden).toBe(false);
  });

  it('📌 [Boundary] a position the keyboard does not reach SAYS so, and is marked — only that one', () => {
    const el = novo();
    mostrarSlide(el, linhas, 2, ctx);
    const tecla = el.querySelector('.slide-tecla');
    expect([tecla.textContent, tecla.getAttribute('data-sem-tecla')]).toEqual(['sem tecla', '1']);
    mostrarSlide(el, linhas, 0, ctx);
    expect(el.querySelector('.slide-tecla').hasAttribute('data-sem-tecla'), 'the mark stayed on a slide with a key').toBe(false);
  });

  it('⚠️ [Zero] a position without a sentence shows no empty paragraph', () => {
    const el = novo();
    mostrarSlide(el, linhas, 0, ctx);
    expect(el.querySelector('.slide-texto').hidden).toBe(true);
  });

  it('🔴 [Right] one dot per slide, the current one filled — the place without a number (ADR-0167)', () => {
    const el = novo();
    mostrarSlide(el, linhas, 1, ctx);
    const pontos = [...el.querySelectorAll('.slide-ponto')];
    expect(pontos.map((p) => p.classList.contains('is-on'))).toEqual([false, true, false]);
    expect(el.textContent).not.toMatch(/\d\s*(de|of)\s*\d/);
  });

  it('🔴 [Right] what is heard: the word, the sentence and the key, and where the show is', () => {
    const el = novo();
    const { falado } = mostrarSlide(el, linhas, 1, ctx);
    // the sentence's own full stop is not doubled
    expect(falado).toBe('Pular. Sai do chão e volta. Tecla «KeyZ»');
    expect(el.getAttribute('aria-valuetext')).toBe(falado);
    expect([el.getAttribute('aria-valuenow'), el.getAttribute('aria-valuemax')]).toEqual(['1', '2']);
  });

  it('⚠️ [Boundary] held at the ends: the first and last slides are walls, marked as such', () => {
    const el = novo();
    expect(mostrarSlide(el, linhas, 9, ctx).indice).toBe(2);
    expect(el.querySelector('[data-passo="1"]').classList.contains('no-limite')).toBe(true);
    expect(mostrarSlide(el, linhas, -3, ctx).indice).toBe(0);
    expect(el.querySelector('[data-passo="-1"]').classList.contains('no-limite')).toBe(true);
  });

  it('🔴 [Right] a finger on an arrow asks for the page, as the keyboard does', () => {
    const el = novo();
    const pedidos = [];
    el.addEventListener('passo', (e) => pedidos.push(e.detail));
    el.querySelector('[data-passo="1"]').click();
    el.querySelector('[data-passo="-1"]').click();
    expect(pedidos).toEqual([1, -1]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   H1 the key always drawn as «no key»          🔴 draws the key · boundary
//   H2 the mark never removed                    🔴 boundary (the pair)
//   H3 the empty sentence left visible           🔴 zero
//   H4 every dot filled                          🔴 dots
//   H5 no clamp in mostrarSlide                  🔴 held at the ends
//   H6 the trailing full stop kept               🔴 what is heard («volta.. Tecla»)
