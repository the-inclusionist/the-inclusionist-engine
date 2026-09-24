// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAUSE CARD SPEAKS THE BOOT LANGUAGE — including to whoever LISTENS to it.
//
// ========================= THE DEFECT, MEASURED IN A BROWSER BEFORE IT WAS WRITTEN =========================
// 🔴 On 2026-09-12, with `quiz.html` served from `dist`, the service worker killed and `documentElement.lang ===
// 'en'`, the card `createGame` mounts showed **«Paused», «▶ Resume», «♿ Accessibility», «🔤
// Typography»** — all English — and announced itself to screen-reader users as
// **«Menu de pausa do jogador 1»**.
//
// ⚠️ ONLY THE LISTENER LOST, and that puts the defect in the family item 4 of ADR-0044 names: for whoever sees,
// there was nothing to notice. The broken channel was another child's only channel.
//
// 📏 AND THE CAUSE IS NOT A MISSING STRING — `pause.cardAria` exists in all three dictionaries. It is ORDER, the same
// one `tests/bar-in-the-boot-language.browser.test.js` documents: `initI18n` applies pt synchronously and asks for
// en/es asynchronously, and the markup is born in that gap. What makes it worse here is that a PASTED `aria-label`
// cannot be corrected later: `applyDom` only reaches `[data-i18n]` and `[data-i18n-aria]` — and the second does not
// serve, because it calls `t(k)` WITHOUT parameters and this key carries the seat number. The child would hear the braces.
//
// 📌 THIS FILE IS ITS OWN, and the reason was MEASURED rather than copied. Inside the bar file this case stayed GREEN
// with the fix undone: that file's previous case does `await localeReady()`, the `en` chunk is warm, and the card is
// born already in English — the sieve would assert the fix and measure the ORDER OF THE CASES. A clean module registry
// is what makes the gap exist, and the gap is where the defect lives.
//
// ⚠️ It matters because the card opens (ADR-0144): a card nothing opens, nobody hears.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const CHAVE_LANG = 'incl_lang';
let anterior = null;

beforeAll(() => {
  anterior = localStorage.getItem(CHAVE_LANG);
  localStorage.setItem(CHAVE_LANG, 'en');
});
afterAll(() => {
  if (anterior === null) localStorage.removeItem(CHAVE_LANG);
  else localStorage.setItem(CHAVE_LANG, anterior);
});

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

function palco() {
  const raiz = document.createElement('div');
  raiz.innerHTML = [
    '<p id="sr-status" role="status"></p>',
    '<p id="sr-alert" role="alert"></p>',
    '<section id="game-region" tabindex="-1"></section>',
    '<div id="title-icons"></div>',
  ].join('');
  document.body.appendChild(raiz);
  return raiz;
}

describe('o cartão de pausa fala o idioma do arranque', () => {
  it('🔴 [Zero] o NOME ACESSÍVEL e o sufixo do assento saem do idioma de recuo', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { localeReady, getLocale } = await import('../app/js/core/i18n.js');
    const raiz = palco();

    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc: document, win: window, a11yBarHost: raiz.querySelector('#title-icons') },
      downloadHeavy: false,
      // ⚠️ TWO SEATS on purpose: the title's «· Jogador N» suffix only exists in multiplayer, and with one player
      // the case would measure an empty `<span>` — which stays green with the Portuguese literal back.
      players: [{ ctrl: {} }, { ctrl: {} }],
    });

    // ⚠️ THE CARD WAS BORN IN THE FALLBACK LANGUAGE, and asserting it is half the case: without this line, an environment
    // that resolved `en` before mounting would have the sieve approve an engine that fixes nothing.
    const aoMontar = document.querySelector('#vp-pause-0 .pause-card')?.getAttribute('aria-label') || '';
    expect(aoMontar, 'o cartão nasceu já em inglês: este ambiente não tem o intervalo onde o defeito vive')
      .toMatch(/Menu de pausa/);

    await localeReady();
    expect(getLocale(), 'o chunk de en não carregou; o caso mediria o nada').toBe('en');

    // ⚠️ OPENING is what repaints: `pause.show` calls `reflectPauseIcons()`, and that is where the name is redone. The
    // language counts at the instant the child opens the pause, which is the right instant.
    motor.pause.show(0);

    const nome = document.querySelector('#vp-pause-0 .pause-card')?.getAttribute('aria-label') || '';
    expect(nome, 'o cartão anuncia-se no idioma de recuo a quem usa leitor de tela').not.toMatch(/Menu de pausa/);
    // 📌 THE PAIR, for the trap the sibling file already paid for: requiring «nada em português» would pass with an
    // EMPTY name, and a dialog with no accessible name is worse than one named in the wrong language.
    expect(nome, 'o cartão ficou SEM nome acessível').toMatch(/Player 1/);

    // 🔴 AND WHAT IS SEEN, by the same cause and in the same `<h2>`: a suffix `' · Jogador ' + n` pasted into the markup
    // of an ENGINE module. In pt the key and the literal give the same string — only a boot in `en` tells them apart.
    const sufixo = document.querySelector('#vp-pause-0 h2 .pause-seat')?.textContent || '';
    expect(sufixo, 'o sufixo do assento ficou em português cru').not.toMatch(/Jogador/);
    expect(sufixo, 'o sufixo do assento sumiu com dois jogadores').toMatch(/Player 1/);

    raiz.remove();
    document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// N1 `renomearCartao(cartao, i)` removed from `refrescarItensDaPausa`  → fails: the name stays in pt
// N2 the repaint writes `''` instead of the key                        → fails by the PAIR (empty name)
// N4 the suffix repaint goes back to the literal `' · Jogador '`       → fails: the suffix stays in pt
// N5 the `<span class="pause-seat">` loses its name (target: `pause-icons.node`) → fails: nowhere to repaint
//
// ⚠️ AND TWO SURVIVED, said here instead of hidden — neither is a hole, and knowing which is which is what tells a
// mutation plan from a ritual:
//
//   N3 putting the literal back in the MARKUP (and not in the repaint) stays GREEN, because the repaint corrects it
//      before anyone sees it. It is the same thing written twice; the one that counts runs when the pause opens. The
//      mount value is translated anyway because `screenPauseMarkup` is EXPORTED — someone can draw the card with
//      no engine around, and then there is no repaint at all.
//   N6 `renomearCartao(cartao, 0)` — renumbering every seat as the first — stays GREEN because this root mounts ONE
//      card only (`buildScreenPause(0)`). The indexed loop exists for the day it mounts the second; today it is
//      correct and INERT code, and a sieve proving it would have to mount a card the engine does not mount yet.
