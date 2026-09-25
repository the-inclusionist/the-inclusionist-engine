// SPDX-License-Identifier: AGPL-3.0-or-later
// THE INTERPRETER OVER THE VLIBRAS PLAYER (ADR-0234, route A; `ui/vlibras-player`), against a FAKE player page that speaks the
// same `postMessage` protocol as the one the delivery writes (`tests/fixtures/delivery/libras/player/`). No Unity here: what is
// held is the order route A measured — the player loads, THEN it is told where the signs are, THEN it is asked to play — the
// answer arriving only when the last token was played, a frame that LEAVES the screen a pause after it — hidden, the player kept
// loaded for the next call — and one that leaves at once when deaf mode or the root does.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVlibrasInterpreter } from '../app/js/ui/vlibras-player.js';

const TITLE = 'Intérprete de Libras';
const BASE = `${location.origin}/`;
const FAKE = 'tests/fixtures/delivery/libras/player/';

const made = [];
function interpreter(extra = {}) {
  const it = createVlibrasInterpreter({
    doc: document, win: window, fetch: (u) => fetch(u), base: BASE, title: () => TITLE, playerFolder: FAKE, ...extra,
  });
  made.push(it);
  return it;
}
const frame = () => document.querySelector(`iframe[title="${TITLE}"]`);
/** What the fake player received from the interpreter, once its page is up. */
const received = () => frame()?.contentWindow?.received ?? [];
const methods = () => received().map((m) => m.method);
/**
 * Waits for a condition on the fake player. ⚠️ Ten seconds, not vitest's one: the fixture page is transformed on its first load,
 * and under a whole suite at once that alone took over three (measured) — a red from the machine, not from the interpreter.
 */
const until = (check) => vi.waitFor(check, { timeout: 10_000, interval: 20 });
/** A promise's state without waiting for it: `pending`, or what it resolved with. */
const peek = async (p) => Promise.race([p, new Promise((r) => { setTimeout(() => r('pending'), 100); })]);

afterEach(() => {
  for (const it of made.splice(0)) it.dispose();
  delete window.fakeVlibras;
});

describe('ui/vlibras-player — the protocol, in the order route A measured', () => {
  it('🔴 [Right] the player loads, is told where the signs are, and only then is asked to play — the text as capitals without accents', async () => {
    const vl = interpreter();
    void vl.sign('Avião, casa!');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow']); });
    const [base, play] = received();
    expect(base).toEqual({ object: 'PlayerManager', method: 'setBaseUrl', params: `${location.origin}/libras/signs/` });
    expect(play, 'the text reached the player as something other than its words in capitals, accents stripped')
      .toEqual({ object: 'PlayerManager', method: 'playNow', params: 'AVIAO CASA' });
    expect(frame().hidden, 'the interpreter is not in front of the screen while it signs').toBe(false);
    expect(frame().tabIndex, 'the player took the keyboard from the game').toBe(-1);
  });

  it('🔴 [Right] the player is handed the GLOSS the delivery wrote beside it — a template\'s value fingerspelled in its hole', async () => {
    const vl = interpreter();
    const first = vl.sign('Bem-vindo à escola.');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow']); });
    expect(received()[1].params, 'the text was spelled where the delivery had its gloss').toBe('BEM VIR ESCOLA [PONTO]');
    frame().contentWindow.emit('counter_gloss', [3, 3]);
    await first;
    void vl.sign('Jogador 2 entrou!');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'playNow']); });
    expect(received()[2].params).toBe('JOGADOR 2 ENTRAR [EXCLAMAÇÃO]');
  });

  it('🔴 [Right] with a player slow to load, nothing is sent before `on_load_player` — and then the base URL goes first', async () => {
    window.fakeVlibras = { load: 'never' };
    const vl = interpreter();
    void vl.sign('escola');
    await until(() => { expect(frame()?.contentWindow?.emit).toBeTypeOf('function'); });
    await new Promise((r) => { setTimeout(r, 50); });
    expect(methods(), 'the player was spoken to before it said it had loaded').toEqual([]);
    frame().contentWindow.emit('on_load_player');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow']); });
  });

  it('🔴 [Right] the request resolves when the LAST token was played — not at the [0, 0] the player starts with, nor half-way', async () => {
    const vl = interpreter();
    const answer = vl.sign('casa escola');
    await until(() => { expect(methods()).toContain('playNow'); });
    const player = frame().contentWindow;
    player.emit('counter_gloss', [0, 0]);
    expect(await peek(answer), 'resolved on the counter the player sends as it starts').toBe('pending');
    player.emit('counter_gloss', [1, 2]);
    expect(await peek(answer), 'resolved half-way through the text').toBe('pending');
    player.emit('counter_gloss', [2, 2]);
    expect(await answer).toEqual({ signed: true });
  });

  it('📌 [Boundary] the base URL is sent once: a second request is only played', async () => {
    const vl = interpreter();
    const first = vl.sign('casa');
    await until(() => { expect(methods()).toContain('playNow'); });
    frame().contentWindow.emit('counter_gloss', [1, 1]);
    await first;
    void vl.sign('escola');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'playNow']); });
  });

  it('📌 [Right] a new press replaces what was being signed, and the one replaced is not reported as a failure', async () => {
    const vl = interpreter();
    const first = vl.sign('casa');
    await until(() => { expect(methods()).toContain('playNow'); });
    void vl.sign('escola');
    expect(await first).toEqual({ signed: true });
  });

  it('🎯 [Zero] a counter from anything but the player frame is not heard', async () => {
    const vl = interpreter();
    const answer = vl.sign('casa');
    await until(() => { expect(methods()).toContain('playNow'); });
    window.postMessage({ type: 'unity_event', event: 'counter_gloss', data: [1, 1] }, location.origin);
    expect(await peek(answer), 'the page\'s own message was taken for the player\'s').toBe('pending');
  });

  it('🎯 [Zero] text with no word asks nothing of the player', async () => {
    const vl = interpreter();
    expect(await vl.sign(' … !')).toEqual({ signed: true });
    expect(frame(), 'a frame was opened for nothing').toBeNull();
  });
});

describe('ui/vlibras-player — where there is no player, or it cannot run', () => {
  it('🔴 [Right] a delivery that shipped no player answers as `NO_INTERPRETER` does, and opens no frame', async () => {
    const vl = interpreter({ playerFolder: 'tests/fixtures/no-such-player/' });
    const result = await vl.sign('casa');
    expect(result.signed).toBe(false);
    expect(result.reason).toMatch(/a Libras player is not installed in this delivery .*--libras/);
    expect(frame(), 'a frame was opened where the delivery shipped no player').toBeNull();
  });

  it('🔴 [Right] a player that cannot run here says why, and leaves the screen', async () => {
    window.fakeVlibras = { load: 'error' };
    const vl = interpreter();
    const result = await vl.sign('casa');
    expect(result).toEqual({ signed: false, reason: 'the Libras player cannot run here: this device has no WebGL' });
    expect(frame(), 'a player that cannot run stayed in front of the screen').toBeNull();
  });

  it('🔴 [Right] a player that never loads is given up on, and the next press tries a fresh frame', async () => {
    window.fakeVlibras = { load: 'never' };
    // long enough for the retry's page to come up on a loaded machine (a whole suite at once), short enough for a test
    const vl = interpreter({ loadTimeoutMs: 2000 });
    const result = await vl.sign('casa');
    expect(result.signed).toBe(false);
    expect(result.reason).toMatch(/did not load within/);
    expect(frame()).toBeNull();
    window.fakeVlibras = { load: 'ok' };
    void vl.sign('casa');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow']); });
  });
});

describe('ui/vlibras-player — hide and dispose', () => {
  it('🔴 [Right] `hide()` stops the player and takes it off the screen, and the request it cut is answered', async () => {
    const vl = interpreter();
    const answer = vl.sign('casa escola');
    await until(() => { expect(methods()).toContain('playNow'); });
    vl.hide();
    expect((await answer).signed).toBe(false);
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'stopAll']); });
    expect(frame().hidden, 'deaf mode is off and the interpreter is still in front of the screen').toBe(true);
    void vl.sign('casa');
    await until(() => { expect(frame().hidden, 'the next press did not bring it back').toBe(false); });
  });

  it('📌 [Boundary] a request still waiting for the player when deaf mode goes off is never played', async () => {
    window.fakeVlibras = { load: 'never' };
    const vl = interpreter();
    const answer = vl.sign('casa');
    await until(() => { expect(frame()?.contentWindow?.emit).toBeTypeOf('function'); });
    vl.hide();
    frame().contentWindow.emit('on_load_player');
    expect((await answer).signed).toBe(false);
    await new Promise((r) => { setTimeout(r, 50); });
    expect(methods(), 'a request cut by `hide()` was played when the player came up').not.toContain('playNow');
  });

  it('🔴 [Right] `dispose()` removes the frame, answers what was pending, and nothing is heard after it', async () => {
    const vl = interpreter();
    const answer = vl.sign('casa');
    await until(() => { expect(methods()).toContain('playNow'); });
    vl.dispose();
    expect(frame(), 'the root is gone and its interpreter is still on the page').toBeNull();
    expect((await answer).signed).toBe(false);
    expect(await vl.sign('escola'), 'a released interpreter signed').toEqual(expect.objectContaining({ signed: false }));
    expect(frame(), 'a released interpreter opened a new frame').toBeNull();
  });
});

describe('ui/vlibras-player — on the screen only while it signs (the Dev; interface log, «bottom right, and only while it signs»)', () => {
  const PAUSE = 400;
  const frames = () => document.querySelectorAll(`iframe[title="${TITLE}"]`).length;
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

  /** Signs `text` through: waits for its `playNow`, then the player says the last of `n` tokens was played. */
  async function signThrough(vl, text, n, plays) {
    const answer = vl.sign(text);
    await until(() => { expect(methods().filter((m) => m === 'playNow')).toHaveLength(plays); });
    frame().contentWindow.emit('counter_gloss', [n, n]);
    expect(await answer).toEqual({ signed: true });
  }

  it('🔴 [Right] it LEAVES the screen a pause after the last token — not at it — and the player is NOT unloaded', async () => {
    const vl = interpreter({ leaveAfterMs: PAUSE });
    await signThrough(vl, 'casa escola', 2, 1);
    const shown = frame();
    expect(shown.hidden, 'the last sign was cut: the frame left at the last token, with no pause').toBe(false);
    await wait(PAUSE / 2);
    expect(frame().hidden, 'the frame left before the pause was over').toBe(false);
    await until(() => { expect(frame()?.hidden, 'the interpreter stayed on the screen with nothing to sign').toBe(true); });
    expect(frame(), 'the player was unloaded when it left the screen').toBe(shown);
    expect(frames()).toBe(1);
  });

  it('🔴 [Right] the next call shows the SAME player at once: no new frame, no new load, only the new text played', async () => {
    const vl = interpreter({ leaveAfterMs: PAUSE });
    await signThrough(vl, 'casa', 1, 1);
    const shown = frame();
    const page = shown.contentWindow;
    await until(() => { expect(frame().hidden).toBe(true); });
    void vl.sign('escola');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'playNow']); });
    expect(frame(), 'a new frame was made for the second call').toBe(shown);
    expect(frame().contentWindow, 'the player page was loaded again').toBe(page);
    expect(frames()).toBe(1);
    expect(frame().hidden, 'the second call did not bring the interpreter back').toBe(false);
  });

  it('🔴 [Right] a call DURING the pause cancels the leaving: the interpreter stays while it signs the new text', async () => {
    const vl = interpreter({ leaveAfterMs: PAUSE });
    await signThrough(vl, 'casa', 1, 1);
    void vl.sign('escola');
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'playNow']); });
    await wait(PAUSE * 2);
    expect(frame().hidden, 'the first text\'s pause took the interpreter off while it signed the second').toBe(false);
    frame().contentWindow.emit('counter_gloss', [1, 1]);
    await until(() => { expect(frame().hidden, 'the second text\'s end did not take it off').toBe(true); });
  });

  it('📌 [Boundary] a call while it SIGNS replaces the text and it stays on the screen, past the pause', async () => {
    const vl = interpreter({ leaveAfterMs: PAUSE });
    const first = vl.sign('casa');
    await until(() => { expect(methods()).toContain('playNow'); });
    void vl.sign('escola');
    expect(await first).toEqual({ signed: true });
    await until(() => { expect(methods()).toEqual(['setBaseUrl', 'playNow', 'playNow']); });
    await wait(PAUSE * 2);
    expect(frame().hidden, 'the interpreter left while the replacing text was still being signed').toBe(false);
  });

  it('📌 [Boundary] turning deaf mode off still takes it off at once, pause or not', async () => {
    const vl = interpreter({ leaveAfterMs: 60_000 });
    await signThrough(vl, 'casa', 1, 1);
    vl.hide();
    expect(frame().hidden, 'deaf mode is off and the interpreter waits for its pause').toBe(true);
  });

  it('🎯 [Zero] `dispose()` in the pause leaves no timer of the root running on the host window', async () => {
    const pending = new Set();
    const win = {
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
      setTimeout: (fn, ms) => { const id = window.setTimeout(() => { pending.delete(id); fn(); }, ms); pending.add(id); return id; },
      clearTimeout: (id) => { pending.delete(id); window.clearTimeout(id); },
    };
    const vl = interpreter({ win, leaveAfterMs: 60_000 });
    await signThrough(vl, 'casa', 1, 1);
    expect(pending.size, 'no pause was started after the last token').toBe(1);
    vl.dispose();
    expect(frame()).toBeNull();
    expect(pending.size, 'the pause outlived the root').toBe(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (each run on `app/js/ui/vlibras-player.ts` and restored; the red is the case that caught it)
//   I1 `setBaseUrl` not sent on load                                   🔴 told where the signs are · slow to load · sent once
//   I2 `playNow` sent at once, without waiting for the load            🔴 nothing is sent before `on_load_player`
//   I3 resolved on any `counter_gloss` (no done = total > 0 check)      🔴 resolves when the LAST token was played
//   I4 the accents kept (no NFD strip)                                  🔴 capitals without accents
//   I5 the shipped-player probe skipped (always opens a frame)          🔴 a delivery that shipped no player
//   I6 the message source not checked                                   🔴 a counter from anything but the player frame
//   I7 `hide()` not sending `stopAll` · I8 not hiding the frame         🔴 `hide()` stops the player
//   I9 the generation check after the load removed                      🔴 a request still waiting … is never played
//   I10 `dispose()` not removing the frame                              🔴 `dispose()` removes the frame
//   I11 the load timer never armed                                      🔴 a player that never loads is given up on
//   I12 the glosses never read (`glossOf` replaced by today's rule)      🔴 the player is handed the GLOSS the delivery wrote
//   L1 the frame never leaves after the pause                           🔴 it LEAVES the screen · the next call shows the SAME player
//                                                                       · a call DURING the pause
//   L2 it leaves at the last token, with no pause (`0` for the pause)   🔴 it LEAVES the screen a pause after the last token — not at it
//   L3 leaving UNLOADS the player (`removeFrame()` instead of hiding)     🔴 it LEAVES the screen · the next call shows the SAME player
//                                                                       · a call DURING the pause
//   L4 a call in the pause does not cancel the leaving                  🔴 a call DURING the pause cancels the leaving
//   L5 `dispose()` leaves the pause's timer running                     🎯 `dispose()` in the pause leaves no timer
