// SPDX-License-Identifier: AGPL-3.0-or-later
// A NAME SAID IN A MENU ACTIVATES ITS ITEM — THROUGH THE ROOT THE CHILD ACTUALLY USES (ADR-0194 §1–§3; issue #184).
//
// `tests/voice-control.node.test.js` proves the control against doubles of the menu. What only a real root can prove is the
// WIRING: that the 👄 path hands the open menu's names to the reader, that a menu opening is what refreshes them, and that a name
// heard reaches its item through the menu navigation's cursor and the virtual controller's confirm — the same path a key, the
// pad or the scan takes. This file boots `createGame` in a real page with the recogniser replaced: no model is downloaded, the
// runtime answers «loaded» and the microphone is a double that hands this file the recogniser's two callbacks.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { accessibleLabel } from '../app/js/core/accessible-label.js';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

/** What the fake microphone received: the grammars, and the recogniser's two callbacks. `vi.mock` is hoisted, so it reads this. */
const heard = { listens: 0, grammars: [], onPartial: null, onFinal: null };
vi.mock('../app/js/platform/vosk-runtime.js', async (original) => ({
  ...(await original()),
  loadVoskRuntime: async () => ({ ok: true, model: { KaldiRecognizer: function () { /* never built: the listener is a double */ } } }),
}));
vi.mock('../app/js/platform/voice-listener.js', async (original) => ({
  ...(await original()),
  startVoiceListening: async (d) => {
    heard.listens += 1;
    heard.grammars.push([...d.grammar]);
    heard.onPartial = d.onPartial;
    heard.onFinal = d.onFinal;
    return { setGrammar: (g) => { heard.grammars.push([...g]); }, stop: async () => {} };
  },
}));

const declaracaoMinima = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

const tick = () => new Promise((r) => { setTimeout(r, 0); });
async function until(cond) { for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => { setTimeout(r, 10); }); }

/** The recogniser heard `text` as a partial hypothesis — the call the microphone makes. */
const say = (text) => heard.onPartial(text);
const lastGrammar = () => heard.grammars.at(-1) ?? [];
const pauseItem = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
const visible = (el) => !!el && el.offsetParent !== null;

let motor;
beforeEach(async () => {
  Object.assign(heard, { listens: 0, grammars: [], onPartial: null, onFinal: null });
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoMinima(), host: { doc: document, win: window },
    downloadHeavy: false, players: [{ ctrl: 0 }] });
  motor.settings.setVoiceControlValue(true);
  await until(() => heard.onPartial);
});
afterEach(() => { motor?.settings.setVoiceControlValue(false); motor?.dispose(); motor = null; });

describe('the 👄 in a real root: a name said activates its item', () => {
  it('🔴 [Right] opening the pause card puts its names in the grammar — the root refreshes on the menu, not on a setting', async () => {
    expect(heard.listens, 'the 👄 never reached the microphone in this root').toBe(1);
    motor.pause.show(0);
    await tick();
    const name = accessibleLabel(pauseItem('options'));
    expect(name.length).toBeGreaterThan(1);
    expect(lastGrammar(), 'the pause card opened and its names never reached the recogniser').toContain(name.toLowerCase());
  });

  it('🔴 [Right] saying a pause item\'s name activates it, as confirming it with the cursor would', async () => {
    motor.pause.show(0);
    await tick();
    const options = pauseItem('options');
    const audio = pauseItem('audio');
    expect(visible(audio), 'the options list was already open — the case would measure nothing').toBe(false);
    say(accessibleLabel(options));
    expect(visible(pauseItem('audio')), 'the name was heard and the item was not activated').toBe(true);
  });

  it('🔴 [Right] and in a PANEL: its item\'s name activates it — the dialog path of the same navigation', async () => {
    motor.pause.show(0);
    await tick();
    pauseItem('options').click();
    pauseItem('audio').click();
    await tick();
    const panel = document.querySelector('#audio');
    expect(panel.hidden, 'the hearing panel did not open').toBe(false);
    // ⚠️ NOT the back item: «Voltar» is also the Dev's word for button 3, which closes a panel by itself — a case on it passes
    // with no name ever reaching the reader. A switch has a name no word of the vocabulary shares, and says whether it fired.
    const toggle = [...panel.querySelectorAll('button[aria-pressed]')].find(visible);
    expect(toggle, 'the hearing panel has no switch to say').toBeTruthy();
    const was = toggle.getAttribute('aria-pressed');
    say(accessibleLabel(toggle));
    expect(toggle.getAttribute('aria-pressed'), 'the switch\'s name was said and the switch did not change').not.toBe(was);
    toggle.click(); // the child's stored answer goes back as it was: the page's storage outlives this case
  });

  it('🔴 [Right] with the card open, a direction word still moves its cursor — the names did not take the words\' place', async () => {
    motor.pause.show(0);
    await tick();
    const selected = () => document.querySelector('#vp-pause-0 .pm-sel');
    const before = selected();
    say('abaixo');
    expect(selected(), '«abaixo» was heard with the card open and the cursor stayed').not.toBe(before);
  });
  // 📌 §3 («voltar» waits while «voltar ao jogo» may follow) is held with a fixed pair in the node suites
  // (`speech-recognition`, `voice-map`, `voice-control`): the engine's own pause card has no two names where one continues the
  // other, so a case here would pass by having nothing to wait for.
});

// ============================== MUTATIONS CHECKED ==============================
//   W1 the root lends no cursor (`pointAt: () => false`)                  🔴 pause item; panel switch
//   W2 the region's observer does not refresh the grammar                 🔴 names in the grammar; pause item; panel switch
//   W3 the root hands no names (`menuWords: () => []`)                     🔴 names in the grammar; pause item
//   W4 `ui/menu-nav.pointAt` moves no cursor                               🔴 pause item; panel switch
//   W4b `pointAt` moves the pause cursor but not a panel's focus           🔴 panel switch
//   W5 the cursor is moved and the confirm is never pressed                🔴 pause item; panel switch
//   W6 the reader is never given the menu's names                          🔴 pause item; panel switch
//   (the panel case first said the back item, «Voltar», and survived W2 and W6: «voltar» is also the word for button 3,
//    which closes a panel by itself — so it said a switch instead)
