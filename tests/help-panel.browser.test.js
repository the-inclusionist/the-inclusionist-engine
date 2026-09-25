// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HELP SLIDE SHOW — one slide per position the game names (interface log, 2026-09-13).
//
// 🔴 The Dev: the help screen «se assemelha a um menu e inclusive tem um botão "restaurar padrões deste menu" quando na verdade
// deveria conter uma "apresentação de slides" (textos, figuras e no máximo animações)». The route a child takes through the pause
// card is `boot-create-game.browser`; this file holds the slide itself — the figure, the words, the dots, what is heard.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { helpRows, mountSlides, showSlide, animateFigure, howToPlayProblems, playSlidesOf, NO_KEY } from '../app/js/ui/help-panel.js';

const PRESET = {
  action2: { label: 'Pular', hint: 'Sai do chão e volta.' },
  left: { label: 'Ir para a esquerda' },
  start: { label: 'Pausa' },
};
const ESQUEMA = { action2: ['KeyZ'], left: ['ArrowLeft'], start: null };
const linhas = helpRows(PRESET, (a) => ESQUEMA[a], (c) => `«${c}»`);
const ctx = {
  create: (tag) => document.createElement(tag),
  t: (k, p) => (k === NO_KEY ? 'sem tecla' : k === 'help.slide.tecla' ? `Tecla ${p.k}` : k),
  title: 'Ajuda',
};
const novo = () => mountSlides(ctx);

describe('the help slide show', () => {
  it('🔴 [Right] is ONE stop of the cursor, with the page arrows as finger targets and no button inside', () => {
    const el = novo();
    expect(el.hasAttribute('data-passos'), 'left and right would not turn the page').toBe(true);
    expect(el.querySelectorAll('button').length, 'a button inside makes the cursor stop twice').toBe(0);
    expect([...el.querySelectorAll('[data-passo]')].map((s) => s.dataset.passo)).toEqual(['-1', '1']);
  });

  it('🔴 [Right] a slide draws the child\'s key, the game\'s word and its sentence', () => {
    const el = novo();
    showSlide(el, linhas, 1, ctx);
    expect(el.querySelector('.slide').dataset.act).toBe('action2');
    expect(el.querySelector('.slide-tecla').textContent).toBe('«KeyZ»');
    expect(el.querySelector('.slide-palavra').textContent).toBe('Pular');
    expect(el.querySelector('.slide-texto').textContent).toBe('Sai do chão e volta.');
    expect(el.querySelector('.slide-texto').hidden).toBe(false);
  });

  it('📌 [Boundary] a position the keyboard does not reach SAYS so, and is marked — only that one', () => {
    const el = novo();
    showSlide(el, linhas, 2, ctx);
    const tecla = el.querySelector('.slide-tecla');
    expect([tecla.textContent, tecla.getAttribute('data-sem-tecla')]).toEqual(['sem tecla', '1']);
    showSlide(el, linhas, 0, ctx);
    expect(el.querySelector('.slide-tecla').hasAttribute('data-sem-tecla'), 'the mark stayed on a slide with a key').toBe(false);
  });

  it('⚠️ [Zero] a position without a sentence shows no empty paragraph', () => {
    const el = novo();
    showSlide(el, linhas, 0, ctx);
    expect(el.querySelector('.slide-texto').hidden).toBe(true);
  });

  it('🔴 [Right] one dot per slide, the current one filled — the place without a number (ADR-0167)', () => {
    const el = novo();
    showSlide(el, linhas, 1, ctx);
    const pontos = [...el.querySelectorAll('.slide-ponto')];
    expect(pontos.map((p) => p.classList.contains('is-on'))).toEqual([false, true, false]);
    expect(el.textContent).not.toMatch(/\d\s*(de|of)\s*\d/);
  });

  it('🔴 [Right] what is heard: the word, the sentence and the key, and where the show is', () => {
    const el = novo();
    const { spoken: falado } = showSlide(el, linhas, 1, ctx);
    // the sentence's own full stop is not doubled
    expect(falado).toBe('Pular. Sai do chão e volta. Tecla «KeyZ»');
    expect(el.getAttribute('aria-valuetext')).toBe(falado);
    expect([el.getAttribute('aria-valuenow'), el.getAttribute('aria-valuemax')]).toEqual(['1', '2']);
  });

  it('⚠️ [Boundary] held at the ends: the first and last slides are walls, marked as such', () => {
    const el = novo();
    expect(showSlide(el, linhas, 9, ctx).index).toBe(2);
    expect(el.querySelector('[data-passo="1"]').classList.contains('no-limite')).toBe(true);
    expect(showSlide(el, linhas, -3, ctx).index).toBe(0);
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

describe('a cartridge\'s «how to play» slide (ADR-0195)', () => {
  const figurasDesenhadas = [];
  // the slides as SHOWN: their texts already resolved from the game's keys (`playSlidesOf`, below)
  const COMO_JOGAR = [
    { text: 'Leia a pergunta.', figure: (s) => figurasDesenhadas.push([s.width > 0, s.height > 0, typeof s.ctx.fillRect, s.time]) },
    { text: 'Escolha a resposta!' },
  ];
  const todos = [...COMO_JOGAR, ...linhas];

  it('🔴 [Right] shows the game\'s text, no key cap and no word, and says the text', () => {
    const el = novo();
    const { spoken: falado } = showSlide(el, todos, 1, ctx);
    expect(el.querySelector('.slide').dataset.kind).toBe('play');
    expect(el.querySelector('.slide-texto').textContent).toBe('Escolha a resposta!');
    expect([el.querySelector('.slide-tecla').hidden, el.querySelector('.slide-palavra').hidden]).toEqual([true, true]);
    expect(falado).toBe('Escolha a resposta');
    expect(el.querySelectorAll('.slide-ponto').length, 'one dot per slide, the game\'s and the buttons\'').toBe(5);
  });

  it('🔴 [Right] a button slide after it shows the key again — the kinds do not leak into each other', () => {
    const el = novo();
    showSlide(el, todos, 0, ctx);
    showSlide(el, todos, 3, ctx);
    expect(el.querySelector('.slide').dataset.kind).toBe('button');
    expect([el.querySelector('.slide-tecla').hidden, el.querySelector('.slide-figura').hidden]).toEqual([false, true]);
  });

  it('🔴 [Right] and the other way round: a game slide after a button with no sentence shows its text again, and names no action', () => {
    // The case above goes game → button; this one goes button → game. A button slide with no sentence HIDES the text, and sets
    // the action it shows — a game slide after it that kept either would show nothing, or say it is a button.
    const el = novo();
    showSlide(el, todos, 2, ctx);                                   // a button with no sentence
    expect(el.querySelector('.slide-texto').hidden).toBe(true);
    showSlide(el, todos, 1, ctx);                                   // the game's text
    expect(el.querySelector('.slide-texto').hidden, 'the game\'s text stayed hidden').toBe(false);
    expect(el.querySelector('.slide').hasAttribute('data-act'), 'a game slide still names the button\'s action').toBe(false);
  });

  it('🔴 [Right] the slide show is named by the help\'s title — a screen reader says what the control is before its value', () => {
    const el = novo();
    showSlide(el, todos, 0, ctx);
    expect(el.getAttribute('aria-label')).toBe('Ajuda');
  });

  it('⚠️ [Error] a slide show missing one of its parts draws nothing and does not throw', () => {
    const el = novo();
    el.querySelector('.slide-pontos').remove();
    expect(() => showSlide(el, todos, 1, ctx)).not.toThrow();
  });

  it('🔴 [Right] the figure is shown and drawn on the engine\'s surface; a slide without one hides it', () => {
    const el = novo();
    document.body.appendChild(el);
    showSlide(el, todos, 0, ctx);
    expect(el.querySelector('.slide-figura').hidden).toBe(false);
    const parar = animateFigure(el, COMO_JOGAR[0], { requestFrame: () => 1, cancelFrame: () => {}, reduced: false });
    parar();
    expect(figurasDesenhadas.at(-1).slice(0, 3)).toEqual([true, true, 'function']);
    showSlide(el, todos, 1, ctx);
    expect(el.querySelector('.slide-figura').hidden).toBe(true);
    el.remove();
  });

  it('⚠️ [Boundary] under reduced motion the figure is drawn once, at time 0, and no frame is asked', () => {
    const el = novo();
    document.body.appendChild(el);
    showSlide(el, todos, 0, ctx);
    let pedidos = 0;
    const antes = figurasDesenhadas.length;
    animateFigure(el, COMO_JOGAR[0], { requestFrame: () => { pedidos++; return 1; }, cancelFrame: () => {}, reduced: true });
    expect([figurasDesenhadas.length - antes, figurasDesenhadas.at(-1)[3], pedidos]).toEqual([1, 0, 0]);
    let quadros = 0;
    const loop = animateFigure(el, COMO_JOGAR[0], { requestFrame: () => { quadros++; return quadros; }, cancelFrame: () => {}, reduced: false });
    loop();
    expect(quadros, 'with motion allowed the figure asks for the next frame').toBe(1);
    el.remove();
  });

  it('🔴 [Zero] howToPlayProblems: absent is well formed; a slide without a text KEY, or a figure that is not a function, is not', () => {
    expect(howToPlayProblems(undefined)).toEqual([]);
    expect(howToPlayProblems([{ textKey: 'g.read', figure: () => {} }, { textKey: 'g.choose' }])).toEqual([]);
    expect(howToPlayProblems([{ figure: () => {} }]).join(' ')).toMatch(/howToPlay\[0\]\.textKey/);
    expect(howToPlayProblems([{ textKey: '  ' }]).join(' '), 'a blank key names no text').toMatch(/textKey/);
    // 🔴 the old shape, a function returning words: frozen in the language it was written in (ADR-0232 D3)
    expect(howToPlayProblems([{ text: () => 'Leia' }]).join(' ')).toMatch(/howToPlay\[0\]\.textKey .*key of the game's dictionary/);
    expect(howToPlayProblems([{ textKey: 'g.x', figure: 'desenho.png' }]).join(' ')).toMatch(/figure/);
    expect(howToPlayProblems('slides')).toEqual(['howToPlay must be a list of slides']);
  });
});

describe('the cartridge\'s slides resolved at each showing (ADR-0232 D3, erratum of 2026-09-25)', () => {
  const DECLARED = [{ textKey: 'g.read', figure: () => {} }, { textKey: 'g.missing' }, { textKey: 'g.choose' }];

  it('🔴 [Right] each text comes from the dictionary it is resolved through — the same slides, two languages', () => {
    const pt = { 'g.read': 'Leia a pergunta.', 'g.choose': 'Escolha.' };
    const en = { 'g.read': 'Read the question.', 'g.choose': 'Choose.' };
    expect(playSlidesOf(DECLARED, (k) => pt[k] ?? null).map((s) => s.text)).toEqual(['Leia a pergunta.', 'Escolha.']);
    expect(playSlidesOf(DECLARED, (k) => en[k] ?? null).map((s) => s.text), 'the text was frozen').toEqual(['Read the question.', 'Choose.']);
    expect(typeof playSlidesOf(DECLARED, (k) => pt[k] ?? null)[0].figure, 'the figure did not travel with its slide').toBe('function');
  });

  it('🔴 [Right] a slide whose key the dictionary lacks is LEFT OUT — never shown as its key', () => {
    const slides = playSlidesOf(DECLARED, (k) => (k === 'g.missing' ? null : 'x'));
    expect(slides).toHaveLength(2);
    expect(slides.map((s) => s.text), 'a key reached the slide show').not.toContain('g.missing');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   H1 the key always drawn as «no key»          🔴 draws the key · boundary
//   H2 the mark never removed                    🔴 boundary (the pair)
//   H3 the empty sentence left visible           🔴 zero
//   H4 every dot filled                          🔴 dots
//   H5 no clamp in mostrarSlide                  🔴 held at the ends
//   H6 the trailing full stop kept               🔴 what is heard («volta.. Tecla»)
