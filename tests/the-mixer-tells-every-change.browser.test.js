// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MIXER TELLS THE ENGINE EVERY CHANGE, WHOEVER MADE IT (ADR-0247).
//
// The engine hands the mixer itself to the game (`Engine.audio`), and narration on or off is one of its categories
// (`audioCat.tts.on`). A game that switches narration there — a mute button of its own, a cut-scene — changed what the child
// hears while the engine's surfaces went on saying the old state: the bar's 🗣 said «desligado» over a voice that spoke, and
// the hearing panel's switch said it too. The root now LISTENS to the mixer (`audio.onCatChange`) and reflects the bar and the
// panels from that one listener, which is also how the bar and the panel reflect each other.
//
// 📌 ONE ROOT PER FILE, with its own storage (`vitest.setup.browser.js`): narration starts off. The host lends ONE pt-BR voice,
// so the 🗣 is not locked by a device that lists none (ADR-0185). The last case disposes the root.
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

function press(code) {
  root.querySelector('#game-region').dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}
const frames = (n = 3) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); });
const icon = (k) => document.querySelector(`#title-icons .pi-btn[data-pi="${k}"]`);
const cursor = () => document.querySelector('.pi-sel');
const caption = () => document.querySelector('#title-icons .pause-icons-cap').textContent;
/** What the icon says in the page's language: «Narração por voz: ligado». */
const label = (k, on) => motor.t('icon.state', { nome: motor.t(`icon.${k}`), v: motor.t(on ? 'state.on' : 'state.off') });
const panelSwitch = () => document.getElementById('opt-tts');
const mixer = () => motor.audio.audioCat;

/** What the child meets on each surface: the bar's 🗣 and the hearing panel's narration switch. */
function surfacesSay(on) {
  expect(icon('tts').getAttribute('aria-label'), `the bar's 🗣 does not say «${on ? 'ligado' : 'desligado'}»`).toBe(label('tts', on));
  expect(icon('tts').getAttribute('aria-pressed'), 'the bar\'s 🗣 is pressed for the wrong state').toBe(String(on));
  expect(panelSwitch().getAttribute('aria-pressed'), 'the panel\'s narration switch says the old state').toBe(String(on));
  expect(panelSwitch().textContent, 'the panel\'s narration switch names the old state').toBe(motor.t(on ? 'ui.toggle.on' : 'ui.toggle.off'));
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  root = document.createElement('div');
  root.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(root);
  motor = createGame({ declaration: declaration(), host: { doc: document, win: voicedHost() }, downloadHeavy: false, accommodations: SEM_ASSUNTO });
  // the cursor on the 🗣, so its caption — the visible half of what the cursor says — is measured too
  press('KeyH');
  for (let n = 0; n < 30 && cursor()?.dataset.pi !== 'tts'; n++) press('KeyD');
  await frames();
  expect(cursor()?.dataset.pi, 'the cursor never reached the 🗣').toBe('tts');
});

describe('a GAME switches narration on `Engine.audio`, with no call at all', () => {
  it('🔴 [Zero → Right] `audio.audioCat.tts.on = true`: the bar\'s 🗣 and the panel\'s switch say «ligado»', async () => {
    expect(mixer().tts.on, 'narration is born off; the case would measure nothing').toBe(false);
    expect(icon('tts').getAttribute('aria-label'), 'the case would measure nothing').toBe(label('tts', false));

    mixer().tts.on = true;
    await frames();

    surfacesSay(true);
    expect(caption(), 'the name under the bar kept the state the game left').toBe(label('tts', true));
  });

  it('🔴 [Right] and back off: the surfaces say «desligado» — the case where the voice is gone and they are all that is left', async () => {
    mixer().tts.on = true;
    await frames();
    mixer().tts.on = false;
    await frames();
    surfacesSay(false);
    expect(caption()).toBe(label('tts', false));
  });

  it('🔴 [Right] a game that REPLACES the category (`audioCat.tts = {…}`) is heard too, and the mixer keeps its own object', async () => {
    const live = mixer().tts;
    mixer().tts = { on: true, vol: 0.4 };
    await frames();
    surfacesSay(true);
    expect(mixer().tts, 'the replacement detached the mixer\'s category: later writes would be heard by nobody').toBe(live);
    mixer().tts.on = false; // and a write after it is still heard
    await frames();
    surfacesSay(false);
  });

  it('🔴 [Right] a VOLUME change reflects too: the panel\'s narration slider goes where the game put it', async () => {
    mixer().tts.vol = 0.35;
    await frames();
    expect(document.getElementById('tts-vol').value, 'the panel\'s narration volume stayed where it was').toBe('35');
    mixer().tts.vol = 0.8;
    await frames();
    expect(document.getElementById('tts-vol').value).toBe('80');
  });
});

describe('the bar and the panel still reflect each other — now through the same listener', () => {
  it('🎯 [Right] the bar\'s press moves the panel\'s switch; the panel\'s switch moves the bar', async () => {
    expect(mixer().tts.on).toBe(false);
    press('KeyJ'); // action2 on the 🗣 under the cursor
    await frames();
    expect(mixer().tts.on).toBe(true);
    surfacesSay(true);

    panelSwitch().click();
    await frames();
    expect(mixer().tts.on).toBe(false);
    surfacesSay(false);
  });
});

describe('a game may listen too, and stop', () => {
  it('🎯 [Right] `onCatChange` hears the engine\'s own writers with the category, and `off()` ends it', async () => {
    const heard = [];
    const off = motor.audio.onCatChange((k) => { heard.push(k); });
    panelSwitch().click();
    await frames();
    panelSwitch().click();
    await frames();
    off();
    panelSwitch().click();
    await frames();
    expect(heard, 'the listener heard the panel\'s two switches, and nothing after `off()`').toEqual(['tts', 'tts']);
    panelSwitch().click(); // back off, as the next case expects
    await frames();
    expect(mixer().tts.on).toBe(false);
  });
});

describe('the other categories, in the OPEN hearing panel', () => {
  it('🔴 [Right] a game moves the sonar\'s volume and switch: its row in the open panel follows', async () => {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(document.querySelector('#audio').hidden, 'the hearing panel did not open; the case would measure nothing').toBe(false);
    const volume = () => document.querySelector('#navsound-list input[data-avol="sonar"]');
    const toggle = () => document.querySelector('#navsound-list button[data-acat="sonar"]');
    expect(volume(), 'the panel opened without the sonar row').not.toBeNull();

    mixer().sonar.vol = 0.25;
    mixer().sonar.on = false;
    await frames();

    expect(volume().value, 'the sonar\'s slider stayed where the game did not leave it').toBe('25');
    expect(toggle().getAttribute('aria-pressed'), 'the sonar\'s switch says «on» after the game turned it off').toBe('false');
    mixer().sonar.on = true;
    await frames();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });
});

describe('the root\'s listener ends with the root', () => {
  it('🔴 [Cardinality] after `dispose()`, a write on the mixer no longer reaches the surfaces the root drew', async () => {
    const before = icon('tts').getAttribute('aria-label');
    const panelBefore = panelSwitch().getAttribute('aria-pressed');
    motor.dispose();
    mixer().tts.on = !mixer().tts.on;
    await frames();
    expect(icon('tts').getAttribute('aria-label'), 'the disposed root still heard the mixer: its listener leaked').toBe(before);
    expect(panelSwitch().getAttribute('aria-pressed')).toBe(panelBefore);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script, with the occurrence count checked BEFORE each one; restored from a copy and checked by sha256 (2026-09-26,
// each alone — 11 of 11 red; `.node` is the sibling file).
//   M1  the root's listener no longer reflects the bar                    🔴 the game's write, the replacement, the bar⇄panel case,
//                                                                            `onCatChange`; and the narration-icon file's three panel cases
//   M2  it reflects the bar on `'sonar'` instead of `'tts'`               🔴 the same seven
//   M3  the listener not handed to `whenDisposed`                         🔴 «after `dispose()`…»
//   M4  the listener no longer reflects the panels                        🔴 seven here, and «ligar o TTS pelo ÍCONE…» in boot-create-game
//   M5  `on`'s setter tells nobody · M6 `vol`'s setter tells nobody       🔴 nine · three (with the volume case here)
//   M7  the category key a plain property (a replacement detaches)       🔴 the replacement, here and in `.node`, and what follows it
//   M8  `off()` does nothing                                             🔴 `onCatChange`'s `off()`, and «after `dispose()`…»
//   M10 the narration slider not drawn from the mixer (`ui/voice-settings`) 🔴 «a VOLUME change reflects too…»
//   M11 `reflectCategory` draws no category row (`ui/settings-audio`)     🔴 «a game moves the sonar's volume…»
