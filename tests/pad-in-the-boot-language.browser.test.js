// SPDX-License-Identifier: AGPL-3.0-or-later
// THE VIRTUAL PAD SPEAKS THE BOOT LANGUAGE, not the fallback one (ADR-0157).
//
// ========================= THE DEFECT, MEASURED IN A BROWSER BEFORE IT WAS WRITTEN =========================
// 🔴 On 2026-09-12, with `quiz.html` served from `dist`, the service worker gone and `documentElement.lang ===
// 'en'`, the arms of the pad `createGame` mounts were announced as «Cima», «Baixo», «Esquerda», «Direita».
// For whoever sees, arrows; for whoever listens, another language.
//
// 📏 Same cause as `barra-no-idioma-do-arranque`: `initI18n` applies pt synchronously and fetches en/es
// asynchronously, and the pad is drawn in that gap. The labels are written as attributes at draw time, so
// nothing corrects them afterwards unless the pad is drawn again.
//
// 🔴 SINCE ADR-0162 THE ENGINE NAMES NO BUTTON — only named ones are drawn, with the game's word. The redraw still
// matters: a game whose words follow the language (the quiz reads them through getters) was drawn in the gap too.
//
// 📌 OWN FILE, for the reason the pause-card file measured: a clean module registry is what makes the gap
// exist. In a file where an earlier case already awaited `localeReady()`, the `en` chunk is warm and this case
// would pass with the fix undone.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const CHAVES = { lang: 'incl_lang', dir: 'incl_paddir' };
const anteriores = {};

beforeAll(() => {
  for (const [k, chave] of Object.entries(CHAVES)) anteriores[k] = localStorage.getItem(chave);
  localStorage.setItem(CHAVES.lang, 'en');
  // the cross: its four arms are the named nodes this case reads
  localStorage.setItem(CHAVES.dir, 'cross');
});
afterAll(() => {
  for (const [k, chave] of Object.entries(CHAVES)) {
    if (anteriores[k] === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, anteriores[k]);
  }
});

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

describe('the virtual pad speaks the boot language', () => {
  it('🔴 [Zero] with `en` stored, the pad shows the game\'s words in English — drawn again once the language arrives', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { localeReady, getLocale } = await import('../app/js/core/i18n.js');
    const raiz = document.createElement('div');
    raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
      + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
    document.body.appendChild(raiz);

    // ⚠️ Engine keys stand in for a game's words — what is measured is the LANGUAGE, not the meaning (an engine test may
    // not lean on the quiz's vocabulary, ADR-0027). The quiz's shape: words read through GETTERS, so they follow the language — and the pad was drawn before it came.
    const { t } = await import('../app/js/core/i18n.js');
    const motor = createGame({ accommodations: SEM_ASSUNTO, onScreenPad: true,
      declaration: declaracaoValida(),
      host: { doc: document, win: window },
      downloadHeavy: false,
      preset: {
        up: { get label() { return t('menu.visual'); } }, down: { get label() { return t('menu.empathy'); } },
        action2: { get label() { return t('menu.close'); } }, action3: { get label() { return t('menu.back'); } },
      },
    });

    await localeReady();
    expect(getLocale(), 'the en chunk did not load; the case would measure nothing').toBe('en');

    const nomes = ['up', 'down']
      .map((d) => document.querySelector(`#touch-cross .dpad-${d}`)?.getAttribute('aria-label') ?? '');
    // ADR-0165: «name, function» — the direction's NAME and the game's word both follow the language that arrived
    expect(nomes).toEqual(['Up, Visual accessibility', 'Down, Empathy mode']);
    const funcao = (b) => (b.getAttribute('aria-label') ?? '').split(', ').slice(1).join(', ');
    expect([...document.querySelectorAll('#touch-controls .touch-btn[data-btn]')].map(funcao).sort()).toEqual(['Back', 'Close']);

    // 📌 THE PAIR: the rebuilt buttons must still be wired, or the language fix would leave a dead pad.
    const confirmar = [...document.querySelectorAll('#touch-controls .touch-btn[data-btn]')].find((b) => funcao(b) === 'Close');
    const { keys } = motor.input; // the ROOT's held keys (ADR-0232 D4)
    const antes = new Set(keys);
    confirmar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
    expect([...keys].filter((k) => !antes.has(k)), 'the redrawn button does nothing').toHaveLength(1);
    confirmar.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }));

    raiz.remove();
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// 1. remove the `void localeReady().then(…)` redraw from `create-game`   → red: the pad stays in the fallback language
// 2. redraw without `ligacoesDoToque.rewire()`                            → red, by the PAIR only: the labels are
//    right and the redrawn buttons are dead. 🎯 It first SURVIVED, while the pair only counted buttons — a count
//    does not prove a wire.
