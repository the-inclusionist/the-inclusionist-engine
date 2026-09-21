// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAGE WITHOUT A SKIP LINK GETS THE ENGINE'S (study item C5; WCAG 2.4.1 Bypass Blocks; ADR-0102).
//
// 📏 Study, 2026-09-12: the quiz page writes its own `.skip-link`, and `createGame` mounts none — a cartridge page that did
// not copy it had no way for a keyboard to jump over whatever precedes the game. The stylesheet rule, the dictionary
// sentence (`skip.toGame`) and the layer (ADR-0102) existed; the element depended on the page remembering.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

describe('the skip link', () => {
  it('🔴 [Right] a page with none gets one FIRST in the body, aiming at the game region, with the dictionary\'s words', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { t } = await import('../app/js/core/i18n.js');
    document.body.innerHTML = '<nav><a href="#x">a link before the game</a></nav><p id="sr-status"></p><div id="game-region" tabindex="-1"></div>';
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    const links = document.querySelectorAll('.skip-link');
    expect(links, 'no skip link, or more than one').toHaveLength(1);
    expect(document.body.firstElementChild, 'the skip link is not the first thing a keyboard reaches').toBe(links[0]);
    expect(links[0].getAttribute('href')).toBe('#game-region');
    expect(links[0].textContent).toBe(t('skip.toGame'));
    expect(links[0].getAttribute('data-i18n'), 'a language change would leave it in the boot language').toBe('skip.toGame');
  });

  it('🎯 [Zero] a page that already has one keeps it, and gets no second', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    document.body.innerHTML = '<a class="skip-link" href="#game-region">Da página</a><p id="sr-status"></p><div id="game-region" tabindex="-1"></div>';
    createGame({ acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
    const links = document.querySelectorAll('.skip-link');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Da página');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   L1 no link mounted                         🔴 the page-without-one case
//   L2 a second link over the page's own        🔴 the [Zero] case
//   L3 appended last instead of first           🔴 the page-without-one case
