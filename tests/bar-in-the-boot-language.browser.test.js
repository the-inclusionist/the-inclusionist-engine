// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BAR SPEAKS THE BOOT LANGUAGE, not the fallback one.
//
// ========================= THE DEFECT, MEASURED IN A BROWSER BEFORE IT WAS WRITTEN =========================
// 🔴 With `quiz.html` served from `dist` and `documentElement.lang === 'en'`, the bar `createGame` mounts served FIVE
// labels in English (`Blind mode (audio navigation): off`) and THREE still in Portuguese (`Webcam — rosto (em
// construção)`), on the same row of icons.
//
// 📏 AND THE CAUSE IS NOT A MISSING STRING: the three keys (`icon.face`/`icon.eyes`/`icon.voice`) exist in all THREE
// dictionaries. It is ORDER. `initI18n` applies pt synchronously and asks for en/es ASYNCHRONOUSLY (they are chunks of
// their own); the bar's markup is born in that interval, and afterwards only the labels WITH STATE were corrected,
// because the reflection skipped the `soon` ones on a premise — same string — that stopped being true when the ENGINE
// started mounting the bar (ADR-0106 step 2).
//
// 📌 THIS FILE STANDS ALONE AND IS NOT A CASE IN `boot-create-game.browser`: the `en` chunk must be COLD for the gap to
// exist, and a file where an earlier case loaded it would pass with the fix undone. (`core/i18n` holds no state since
// ADR-0232 D3's last step; the module registry is what keeps the chunk cold.)
//
// ⚠️ AND IT EXERCISES THE BOOT, not a change at run time: the smaller claim, which has only one answer — the interface is
// not built before the language is ready.
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

// THE SAME declaration as `boot-create-game.browser` — copied and not invented: a first hand-written version was
// malformed (`topology` as a VALUE, which ADR-0084 forbade, and `tick` as a function) and `createGame` refused it. The
// contract failing a fixture is §A's gate doing its job.
const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // A hotspots fixture holds nothing — ADR-0115's pair, beside the number that does not say so.
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

describe('a barra da primeira tela fala o idioma do arranque', () => {
  it('🔴 [Zero] com `en` guardado, NENHUM dos oito rótulos fica no idioma de recuo', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const raiz = palco();

    const motor = createGame({ accommodations: SEM_ASSUNTO,
      declaration: declaracaoValida(),
      host: { doc: document, win: window, a11yBarHost: raiz.querySelector('#title-icons') },
      downloadHeavy: false,
      // ⚠️ NO PAUSE-MENU DECLINE: the field left the contract (ADR-0122). The stage HAS `#game-region`, so the pause card
      // mounts there — and this case still measures what it measured, because it counts `#title-icons .pi-btn` and the card
      // brings `.pm-btn` into another host.
      declines: { noPauseActor: true, noNeuralVoice: true },
    });

    // ⚠️ THE `await` IS THE HALF THAT WAS MISSING IN THE CODE, which is why it is here and not in a `beforeEach`: the
    // defect lives exactly in the interval between mounting and the dictionary arriving.
    await motor.localeReady();
    expect(motor.locale(), 'o chunk de en não carregou; o caso mediria o nada').toBe('en');

    const botoes = [...raiz.querySelectorAll('#title-icons .pi-btn')];
    expect(botoes.length, 'a barra não montou').toBeGreaterThan(0);

    const encalhados = botoes
      .map((b) => ({ k: b.dataset.pi, label: b.getAttribute('aria-label') || '' }))
      .filter((x) => /construção|desligado|ligado|Modo cego|Narração/.test(x.label));

    expect(encalhados, `ícones encalhados no idioma de recuo: ${encalhados.map((x) => `${x.k}=«${x.label}»`).join(' · ')}`)
      .toEqual([]);

    // 📌 THE PAIR: demanding nothing in Portuguese would pass if the labels were EMPTY. The whole bar must say something —
    // the same trap as the silent twin of the touch announcement.
    for (const b of botoes) {
      expect((b.getAttribute('aria-label') || '').trim().length, `${b.dataset.pi} sem rótulo`).toBeGreaterThan(0);
    }

    raiz.remove();
  });
});

// ===== MUTATIONS CHECKED =====
// Checked when the boot repaint was a `localeReady()` call in `create-game`; today the `i18n:change` listener does it.
// 1. removing the boot repaint from `create-game`              → fails, with all EIGHT icons stuck
// 2. putting back the `if (!…soon)` guard in `reflectIconBtn`   → fails, with the THREE `soon` ones stuck
//    🎯 it is the pair that shows both halves of the fix are needed and neither is enough alone
// 3. `reflectIconsIn` clearing the label instead of writing it  → fails by the PAIR (empty label), not by the rule — which
//    is why the pair exists
