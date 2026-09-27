// SPDX-License-Identifier: AGPL-3.0-or-later
// THE NAME UNDER THE BAR'S CURSOR TELLS THE STATE THE ICON IS IN NOW, whichever surface changed it (ADR-0159 rule 10,
// ADR-0167).
//
// The bar's `.pause-icons-cap` is the VISIBLE half of what the cursor says: the icon's name and state, written under the row
// while the `accessibility` mode's cursor sits on it (`wireBarCaption`, `selectIcon`). It was written only when the cursor
// MOVED or a press landed — never when the icon was REFLECTED. So when the icon under the cursor changed state from elsewhere
// (the 🦯 through the root's `stateOn`, the 🗣 through the hearing panel's `setCatGain`), the `aria-label` said the new state
// and the name under the row went on showing the old one until the cursor moved: the child who sees heard one thing and
// read the opposite.
//
// 📌 ONE ROOT PER FILE, with its own storage (`vitest.setup.browser.js`). The host lends ONE pt-BR voice, so the 🗣 is not
// locked by a device that lists none (GitHub's Linux runner lists none, ADR-0185).
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeAll } from 'vitest';
import { userEvent } from '@vitest/browser/context';
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
const icon = (k) => document.querySelector(`#title-icons .pi-btn[data-pi="${k}"]`);
const cursor = () => document.querySelector('#title-icons .pi-sel');
const caption = () => document.querySelector('#title-icons .pause-icons-cap');
/** What the icon says in the page's language, which is what the caption writes: «Modo cego: ligado». */
const label = (k, on) => motor.t('icon.state', { nome: motor.t(`icon.${k}`), v: motor.t(on ? 'state.on' : 'state.off') });
const blindOn = () => !!motor.settings.blindMode;
const narrationOn = () => !!motor.audio.audioCat.tts.on;
/** The two switches of the hearing panel — the OTHER surface that writes these two states. */
const flipBlindInPanel = () => document.getElementById('opt-modocego').click();
const flipNarrationInPanel = () => document.getElementById('opt-tts').click();

/**
 * START puts the d-pad on the bar (ADR-0155); then the right arrow walks it, in a ring, to icon `k` — always ARRIVING by a move,
 * even when the cursor is already there, so the caption each case starts from was written by the move and no case leans on
 * what the one before it left.
 */
async function cursorTo(k) {
  if (!cursor()) press('KeyH');
  if (cursor()?.dataset.pi === k) press('KeyD');
  for (let n = 0; n < 30 && cursor()?.dataset.pi !== k; n++) press('KeyD');
  await frames();
  expect(cursor()?.dataset.pi, `the cursor never reached ${k}`).toBe(k);
  // the case measures nothing unless the caption starts on the icon's CURRENT state, written by the move
  expect(caption().textContent).toBe(icon(k).getAttribute('aria-label'));
}
/** START again: the d-pad goes back to the character, and the bar has no cursor. */
async function leaveTheBar() {
  if (cursor()) press('KeyH');
  await frames();
  expect(cursor(), 'the bar kept a cursor; the case would measure nothing').toBeNull();
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  root = document.createElement('div');
  root.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(root);
  /*
   * ⚠️ THE MACHINE'S REAL POINTER IS NOT THIS FILE'S SUBJECT. Hovering an icon writes its name under the row — by design
   * (`wireBarCaption`) — and this page has no stylesheet, so the bar sits in the flow where another file's real click can
   * leave the browser's pointer. In one full-suite run (2026-09-26) all four cases below read «Menu»: the failure screenshot
   * shows the ☰ in the native `:hover` state, and «Menu» came back even after leaving the bar had cleared the caption, which
   * only a pointer entering the ☰ writes. Not reproduced alone nor in five runs beside the files that use `userEvent`. So the
   * TRUSTED pointer boundary events stop at this root; the ones a case dispatches (untrusted) pass, and no case here hovers.
   */
  for (const type of ['mouseover', 'mouseout', 'mouseenter', 'mouseleave']) {
    root.addEventListener(type, (e) => { if (e.isTrusted) e.stopPropagation(); }, true);
  }
  motor = createGame({ declaration: declaration(), host: { doc: document, win: voicedHost() }, downloadHeavy: false, accommodations: SEM_ASSUNTO });
});

describe('the machine\'s pointer does not write what this file measures', () => {
  it('🎯 [Environment] a REAL pointer entering the ☰ while the cursor is on the 🦯 leaves the caption naming the 🦯', async () => {
    await cursorTo('blind');
    const away = document.createElement('div');
    away.style.cssText = 'width:40px;height:40px';
    document.body.appendChild(away);
    try {
      await userEvent.hover(away);
      await userEvent.hover(icon('menu'));
      expect(icon('menu').matches(':hover'), 'the pointer never reached the ☰; the case measures nothing').toBe(true);
      expect(caption().textContent, 'a real pointer rewrote the caption under the cursor').toBe(label('blind', blindOn()));
    } finally {
      await userEvent.hover(away);
      away.remove();
      await leaveTheBar();
    }
  });
});

describe('the name under the cursor follows a state changed ELSEWHERE', () => {
  it('🔴 [Right] 🦯 under the cursor, blind mode flipped in the hearing panel: the caption shows the new state at once', async () => {
    await cursorTo('blind');
    const before = blindOn();
    expect(caption().textContent).toBe(label('blind', before));

    flipBlindInPanel();
    expect(blindOn(), 'the panel did not flip blind mode; the case would measure nothing').toBe(!before);
    // «at once»: no frame awaited — the reflection that rewrote the label is the same call that must rewrite the caption
    expect(caption().textContent, 'the caption under the 🦯 went on showing the state blind mode had left').toBe(label('blind', !before));
    expect(cursor()?.dataset.pi, 'the cursor moved; the caption would have been rewritten by the move, not the reflection').toBe('blind');

    flipBlindInPanel(); // and back, through the same path
    expect(caption().textContent).toBe(label('blind', before));
  });

  it('🔴 [Right] 🗣 under the cursor, narration flipped in the hearing panel: the caption shows the new state at once', async () => {
    await cursorTo('tts');
    const before = narrationOn();
    expect(caption().textContent).toBe(label('tts', before));

    flipNarrationInPanel();
    expect(narrationOn(), 'the panel did not flip narration; the case would measure nothing').toBe(!before);
    expect(caption().textContent, 'the caption under the 🗣 went on showing the state narration had left').toBe(label('tts', !before));
    expect(cursor()?.dataset.pi).toBe('tts');

    flipNarrationInPanel();
    expect(caption().textContent).toBe(label('tts', before));
  });
});

describe('ONLY the icon under the cursor, and only when there is a cursor', () => {
  it('🔴 [Boundary] 🗣 under the cursor, the 🦯 flipped elsewhere: the caption keeps naming the 🗣, text node untouched', async () => {
    await cursorTo('tts');
    const shown = caption().textContent;
    const node = caption().firstChild;

    flipBlindInPanel();
    expect(icon('blind').getAttribute('aria-label'), 'the 🦯 did not reflect; the case would measure nothing').toBe(label('blind', blindOn()));
    expect(caption().textContent, 'the caption left the icon under the cursor for one the cursor is not on').toBe(shown);
    // ⚠️ the same text REWRITTEN is not the same: the per-screen bar's caption is a live region, and a rewrite is a repeat
    expect(caption().firstChild, 'a reflection that changed nothing under the cursor rewrote the caption').toBe(node);
    flipBlindInPanel();
  });

  it('🔴 [Zero] no cursor on the bar: flipping the 🦯 and the 🗣 elsewhere writes no caption', async () => {
    await leaveTheBar();
    expect(caption().textContent, 'leaving the bar left a caption; the case would measure nothing').toBe('');

    flipBlindInPanel();
    flipNarrationInPanel();
    expect(caption().textContent, 'a bar with no cursor showed a name under the row').toBe('');
    flipBlindInPanel();
    flipNarrationInPanel();
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script, with the occurrence count checked BEFORE each one; restored from a copy.
//   M1  the reflection no longer writes the cursor's caption (the defect)                 🔴 🦯 and 🗣 flipped in the panel
//   M2  the caption is written for EVERY reflected icon, not only the cursor's            🔴 all four
//   M3  the caption is rewritten even when its text did not change                       🔴 the text node untouched
//   M4  (2026-09-27) the trusted-pointer guard at the root off                            🔴 [Environment] — a real pointer entering the ☰ rewrites the caption
