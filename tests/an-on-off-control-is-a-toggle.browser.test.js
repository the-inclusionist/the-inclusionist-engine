// SPDX-License-Identifier: AGPL-3.0-or-later
// AN ON/OFF CONTROL IS A TOGGLE, AND SAYS ITS STATE WITH `aria-pressed` (ADR-0130 rule 4, issue #134).
//
// «Toggles are for options that turn something on or off.» The record calls it a constraint — a toggle is what an on/off
// control MEANS — and says the code already does it, with `aria-pressed` carrying the state. This file is the gate it
// never had, and it is a SIEVE over what a real root offers rather than a promise per panel:
//   · every offered control whose visible text is the on/off word («Ligado»/«Desligado») is a `<button>` whose
//     `aria-pressed` says the same thing — the screen reader hears the state the eye reads;
//   · every offered `aria-pressed` control TOGGLES: one press flips the state and its word, a second puts both back.
// A panel added later is read by the same loop.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { comAssunto } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)
/** The root's words (`core/i18n` holds no state, ADR-0232 D3): read through the engine this file boots. */
const t = (key, params) => motor.t(key, params);

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' }), holdsAtOnce: () => 1,
  holdsKeys: () => false, tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal', nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const guardado = { dicas: false };
const GAME_OPTIONS = [{ id: 'dicas', kind: 'switch', label: 'Dicas', read: () => guardado.dicas, write: (v) => { guardado.dicas = v; } }];

const offered = (el) => el.getClientRects().length > 0 && !el.closest('[hidden]') && el.getAttribute('aria-disabled') !== 'true' && !el.disabled;
const nameOf = (el) => el.id || el.dataset.acat || el.dataset.rm || el.getAttribute('aria-label') || '?';
const card = () => document.getElementById('vp-pause-0');
const openOverlays = () => [...document.querySelectorAll('#game-region .overlay')].filter((o) => !o.hidden);
function closeAll() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
/** Opens each panel of the settings list and the game's own options in turn, and hands it to `visit` while it is open. */
function eachPanel(visit) {
  motor.pause.show(0);
  card().querySelector('.pm-btn[data-act="options"]').click();
  const doors = [...card().querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn')].map((b) => b.dataset.act).filter((a) => a !== 'pmback');
  for (const act of doors) {
    card().querySelector(`.pm-btn[data-act="${act}"]`).click();
    for (const o of openOverlays()) visit(o);
    for (const o of openOverlays()) o.hidden = true;
  }
  card().querySelector('.pause-menu[data-sub="opcoes"] .pm-btn[data-act="pmback"]').click();
  card().querySelector('.pm-btn[data-act="opcoesdojogo"]').click();
  for (const o of openOverlays()) visit(o);
  closeAll();
}

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }],
    // the game's words are KEYS of its dictionary (ADR-0232 D3): `keyed` writes the words above under keys
    ...keyed({
      accommodations: comAssunto({ caneSpacing: { label: 'Bengala' }, reducedCharacterMotion: { label: 'Personagem' } }),
      gameOptions: GAME_OPTIONS,
    }),
  });
});

describe('an on/off control is a toggle', () => {
  it('🔴 [Right] every control that SHOWS on or off says the same with aria-pressed', () => {
    const [on, off] = [t('ui.toggle.on'), t('ui.toggle.off')];
    const seen = [];
    const wrong = [];
    eachPanel((panel) => {
      for (const b of panel.querySelectorAll('button, [role="button"], [role="switch"]')) {
        if (!offered(b)) continue;
        const word = (b.textContent ?? '').trim();
        if (word !== on && word !== off) continue;
        seen.push(`#${panel.id} ${nameOf(b)}`);
        if (b.tagName !== 'BUTTON') wrong.push(`#${panel.id} ${nameOf(b)} is a ${b.tagName}, not a button`);
        else if (b.getAttribute('aria-pressed') !== String(word === on)) {
          wrong.push(`#${panel.id} ${nameOf(b)} shows «${word}» and says aria-pressed=${b.getAttribute('aria-pressed')}`);
        }
      }
    });
    expect(seen.length, 'the sieve found no on/off control — it would measure nothing').toBeGreaterThan(10);
    expect(wrong.join('\n')).toBe('');
  });

  it('🔴 [Right] every aria-pressed control TOGGLES: a press flips the state and its word, a second puts both back', () => {
    const [on, off] = [t('ui.toggle.on'), t('ui.toggle.off')];
    const wrong = [];
    let pressed = 0;
    eachPanel((panel) => {
      for (const b of [...panel.querySelectorAll('[aria-pressed]')]) {
        if (!offered(b)) continue;
        const id = b.id;
        const before = b.getAttribute('aria-pressed');
        b.click();
        // a panel may redraw its rows on a press: the control is found again by its id
        const after = (id && panel.querySelector(`#${CSS.escape(id)}`)) || b;
        const flipped = after.getAttribute('aria-pressed');
        if (flipped === before) wrong.push(`#${panel.id} ${nameOf(b)}: a press left aria-pressed=${before}`);
        const word = (after.textContent ?? '').trim();
        if ((word === on || word === off) && String(word === on) !== flipped) {
          wrong.push(`#${panel.id} ${nameOf(b)}: after a press it shows «${word}» and says aria-pressed=${flipped}`);
        }
        after.click();
        const back = ((id && panel.querySelector(`#${CSS.escape(id)}`)) || after).getAttribute('aria-pressed');
        if (back !== before) wrong.push(`#${panel.id} ${nameOf(b)}: a second press did not put it back (${before} → ${flipped} → ${back})`);
        pressed++;
      }
    });
    expect(pressed, 'the sieve pressed no toggle — it would measure nothing').toBeGreaterThan(10);
    expect(wrong.join('\n')).toBe('');
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy):
 *   · `toggleBtn` writing the opposite state → both cases red.
 *   · the game's own switch (`ui/game-options`) not writing `aria-pressed` → the toggling case red.
 *   · an audio category's switch not reflecting its press → the toggling case red.
 */