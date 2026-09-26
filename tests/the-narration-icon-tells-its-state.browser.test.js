// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 🗣 TELLS THE STATE NARRATION IS IN, whichever surface flipped it (ADR-0159 rules 1 and 10, ADR-0167 rule 3).
//
// The quick bar's icon is spoken as «name: state, N de M» when the cursor reaches it, and that string is its `aria-label`,
// which the bar rewrites on every reflection. The other icons whose state another surface also changes — 🦯, 📷, 👄 — are
// reflected when that surface changes it (`stateOn` in `boot/create-game`). Narration is not a setting of the store: it is the
// mixer's `tts` category, which the icon, the hearing panel's switch and its volume slider all write, and nothing reflected the
// bar after the panel wrote it. So the child turned narration on in the panel, came back to the bar, and the 🗣 under her cursor
// said «desligado» — and `aria-pressed="false"` — over a voice that was speaking.
//
// 📌 ONE ROOT PER FILE, with its own storage (`vitest.setup.browser.js`): narration starts off. The host lends ONE pt-BR voice,
// so the 🗣 is not locked by a device that lists none (GitHub's Linux runner lists none, ADR-0185).
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }
const MARIA = { name: 'Microsoft Maria - Portuguese (Brazil)', lang: 'pt-BR' };
/** The real window, with a speech engine that lists one voice of the page's language; the rest bound to the window. */
const voicedHost = () => {
  const own = { speechSynthesis: { cancel() {}, speak() {}, getVoices: () => [MARIA], onvoiceschanged: null }, SpeechSynthesisUtterance: HostUtterance };
  return new Proxy(window, {
    get(target, prop) {
      if (Object.hasOwn(own, prop)) return own[prop];
      const v = Reflect.get(target, prop);
      return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(target) : v;
    },
  });
};

let motor;
let root;
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

/** The key as the child gives it, on the game region. */
function press(code) {
  root.querySelector('#game-region').dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}
/** The announcer writes on the NEXT frame (clear, then write): wait a few. */
const frames = (n = 3) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });
const said = () => document.getElementById('sr-status').textContent;
const icon = (k) => document.querySelector(`#title-icons .pi-btn[data-pi="${k}"]`);
const cursor = () => document.querySelector('.pi-sel');
/** What the icon says in the page's language: «Narração por voz: ligado». */
const label = (k, on) => motor.t('icon.state', { nome: motor.t(`icon.${k}`), v: motor.t(on ? 'state.on' : 'state.off') });
const narrationOn = () => !!motor.audio.audioCat.tts.on;

/** START puts the d-pad on the bar (ADR-0155); then the right arrow walks it, in a ring, to icon `k`. */
async function cursorTo(k) {
  if (!cursor()) press('KeyH');
  for (let n = 0; n < 30 && cursor()?.dataset.pi !== k; n++) press('KeyD');
  await frames();
  expect(cursor()?.dataset.pi, `the cursor never reached ${k}`).toBe(k);
}
/**
 * Each case starts with narration OFF and the icon SAYING off, set through the bar — whose press reflects — so no case leans
 * on what the one before it left, which with this defect would be a stale label that happens to match.
 */
async function narrationOffAndSaid() {
  await cursorTo('tts');
  for (let n = 0; n < 3 && (narrationOn() || icon('tts').getAttribute('aria-label') !== label('tts', false)); n++) {
    press('KeyJ');
    await frames();
  }
  expect(narrationOn()).toBe(false);
  expect(icon('tts').getAttribute('aria-label')).toBe(label('tts', false));
}
/** Off the icon and back onto it: what the child hears on ARRIVING, which is the `aria-label`. */
async function arriveAgainAt(k) {
  press('KeyD'); press('KeyA');
  await frames();
  expect(cursor()?.dataset.pi).toBe(k);
  return said();
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  root = document.createElement('div');
  root.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(root);
  motor = createGame({ declaration: declaration(), host: { doc: document, win: voicedHost() }, downloadHeavy: false, accommodations: SEM_ASSUNTO });
});

describe('the 🗣 flipped FROM THE BAR says its new state', () => {
  it('🎯 [Right] on and off, the live region ends on the icon\'s new state', async () => {
    await narrationOffAndSaid();

    press('KeyJ'); // action2: the press on the icon under the cursor
    await frames();
    expect(narrationOn()).toBe(true);
    expect(said(), 'turning narration ON from the bar said nothing of it').toContain(label('tts', true));

    press('KeyJ');
    await frames();
    expect(narrationOn()).toBe(false);
    // ⚠️ OFF is the case that matters: the voice is gone, so the live region is the only channel left
    expect(said(), 'turning narration OFF from the bar left the live region without the new state').toContain(label('tts', false));
  });
});

describe('the 🗣 flipped ELSEWHERE tells the truth under the bar\'s cursor', () => {
  it('🔴 [Zero → Right] the hearing panel\'s switch turns narration on: the icon says «ligado» and is pressed', async () => {
    await narrationOffAndSaid();

    document.getElementById('opt-tts').click();
    await frames();

    expect(narrationOn(), 'the panel\'s switch did not turn narration on').toBe(true);
    expect(icon('tts').getAttribute('aria-label'), 'the 🗣 went on saying «desligado» with narration on').toBe(label('tts', true));
    expect(icon('tts').getAttribute('aria-pressed')).toBe('true');
    expect(icon('tts').classList.contains('pi-on'), 'the 🗣 is not lit for whoever sees it').toBe(true);
    expect(await arriveAgainAt('tts'), 'the cursor arriving on the 🗣 spoke the state narration had left').toContain(label('tts', true));
  });

  it('🔴 [Right] and back off by the panel: the live region carries «off», and the icon says it', async () => {
    await narrationOffAndSaid();
    // ON through the BAR, so the icon is known to say «ligado» before the panel turns it off
    press('KeyJ');
    await frames();
    expect(narrationOn()).toBe(true);
    expect(icon('tts').getAttribute('aria-label'), 'the case would measure nothing').toBe(label('tts', true));

    document.getElementById('opt-tts').click();
    await frames();

    expect(narrationOn()).toBe(false);
    expect(said(), 'narration turned off and nothing in the live region said so').toMatch(new RegExp(motor.t('sr.audio.ttsOff').replace('.', '\\.')));
    expect(icon('tts').getAttribute('aria-label'), 'the 🗣 went on saying «ligado» with narration off').toBe(label('tts', false));
    expect(icon('tts').getAttribute('aria-pressed')).toBe('false');
    expect(await arriveAgainAt('tts')).toContain(label('tts', false));
  });

  it('🔴 [Right] the MIXER: raising narration\'s volume turns it on, and the icon follows', async () => {
    await narrationOffAndSaid();
    const volume = document.getElementById('tts-vol');
    volume.value = '70';
    volume.dispatchEvent(new Event('input', { bubbles: true }));
    await frames();

    expect(narrationOn(), 'the volume slider no longer turns narration on; the case would measure nothing').toBe(true);
    expect(icon('tts').getAttribute('aria-label'), 'the mixer turned narration on and the 🗣 said «desligado»').toBe(label('tts', true));
    expect(await arriveAgainAt('tts')).toContain(label('tts', true));
  });

  it('📌 [the sibling that already works] the 🦯 flipped by the panel follows the same way', async () => {
    await cursorTo('blind');
    const before = motor.settings.blindMode;
    document.getElementById('opt-modocego').click();
    await frames();
    expect(icon('blind').getAttribute('aria-label')).toBe(label('blind', !before));
    expect(await arriveAgainAt('blind')).toContain(label('blind', !before));
    document.getElementById('opt-modocego').click();
    await frames();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script, with the occurrence count checked BEFORE each one; restored from a copy.
//   M1  the hearing panel's `setCatGain` no longer reflects the bar (the defect)     🔴 panel on, panel off, volume slider
//   M2  it reflects on another category (`'sonar'`) instead of `'tts'`                🔴 the same three
//   M3  the bar's click no longer says the icon's label after the reflection        🔴 the press from the bar
