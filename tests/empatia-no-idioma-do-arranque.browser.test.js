// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EMPATHY PANEL'S HEARING ROW SPEAKS THE BOOT LANGUAGE (ADR-0151).
//
// 🔴 Measured in dist on 2026-09-12, page in English: the panel's simulations were in English and its first row said
// «Simular perda auditiva». The row is built at boot, BEFORE `init` wires its click, so it is built in the gap where
// `initI18n` has applied the fallback and not yet the preferred language; nothing rewrote it.
//
// 📌 OWN FILE with a clean module registry: a file where an earlier case awaited `localeReady()` would have the `en`
// chunk warm, and the row would be born in English with the fix undone.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let anterior = null;
beforeAll(() => { anterior = localStorage.getItem('incl_lang'); localStorage.setItem('incl_lang', 'en'); });
afterAll(() => { if (anterior === null) localStorage.removeItem('incl_lang'); else localStorage.setItem('incl_lang', anterior); });

describe('the empathy panel speaks the boot language', () => {
  it('🔴 [Zero] with `en` stored, the hearing-loss row opens in English', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const { localeReady, getLocale } = await import('../app/js/core/i18n.js');
    const raiz = document.createElement('div');
    raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
      + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
    document.body.appendChild(raiz);
    const motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: {
        topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
        world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
        nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
        objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
      },
      host: { doc: document, win: window },
      downloadHeavy: false,
    });
    await localeReady();
    expect(getLocale(), 'the en chunk did not load; the case would measure nothing').toBe('en');
    motor.pausa.mostrar(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
    const linha = document.getElementById('opt-hearing').closest('.ctrl-row');
    expect(linha.querySelector('strong').textContent).toBe('Simulate hearing loss');
    expect(document.getElementById('opt-hearing').getAttribute('aria-label')).toBe('Simulate hearing loss');
    raiz.remove();
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// 1. the panel's `render` without `labelRow(linhaDaAudicao, …)`  → red: «Simular perda auditiva» on an English page
