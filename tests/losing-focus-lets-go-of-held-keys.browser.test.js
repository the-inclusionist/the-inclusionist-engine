// SPDX-License-Identifier: AGPL-3.0-or-later
// LOSING FOCUS LETS GO OF WHAT THE KEYBOARD WAS HOLDING.
//
// When the window loses focus with a key down, the keyup never reaches the page: the child clicked the browser's
// own bar, an on-screen keyboard or a switch-access program took focus, the tab changed. Without a release, the
// key stays held — the character keeps walking, and the cartridge keeps believing a button is down, with nothing
// on screen saying why. The window's `blur` is the only signal the page gets, so it stands for every keyup that
// will not come.
//
// ⚠️ ONLY WHAT THE KEYBOARD HOLDS. A press from the camera or the voice does not depend on the window's focus —
// the camera keeps reading the eyes — and letting go of it would take a held position from whoever cannot press it
// again quickly.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)

let engine;
let root;
const commands = [];
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => true, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const PRESET = { up: { label: 'Up' }, down: { label: 'Down' } };
/** The solo scheme's keys for the two positions. */
const KEY = { up: 'KeyW', down: 'KeyS' };

/** A real key is born on the focused element and bubbles up to the window, where the engine listens. */
const press = (code) => document.getElementById('game-region')
  .dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
const release = (code) => document.getElementById('game-region')
  .dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true }));
const loseFocus = () => window.dispatchEvent(new Event('blur'));
const received = () => commands.map((c) => `${c.action}:${c.pressed}`);

beforeAll(async () => {
  root = document.createElement('div');
  root.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  document.body.appendChild(root);
  const { createGame } = await import('../app/js/boot/create-game.js');
  engine = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), host: { doc: document, win: window },
    downloadHeavy: false, players: [{ ctrl: 0 }], ...keyed({ preset: PRESET }),
    onCommand: (c) => commands.push(c),
  });
});
afterAll(() => {
  engine?.dispose?.();
  root?.remove();
});
beforeEach(() => {
  release(KEY.up); release(KEY.down);
  commands.length = 0;
});

describe('the window losing focus is the keyup that never arrives', () => {
  it('🔴 [Right] a key the keyboard holds is let go of, and the game hears the release', () => {
    press(KEY.up);
    expect(engine.input.keys.has(KEY.up), 'the premise: the key is held').toBe(true);
    loseFocus();
    expect(engine.input.keys.has(KEY.up), 'the key is still held after the window lost focus').toBe(false);
    expect(received(), 'the game was left believing the button is still down').toEqual(['up:true', 'up:false']);
  });

  it('🔴 [Right] every key the keyboard holds, not only the last', () => {
    press(KEY.up);
    press(KEY.down);
    loseFocus();
    expect([engine.input.keys.has(KEY.up), engine.input.keys.has(KEY.down)]).toEqual([false, false]);
    expect(received().filter((c) => c.endsWith(':false')).sort()).toEqual(['down:false', 'up:false']);
  });

  it('🔴 [Boundary] a position the CAMERA holds is not let go of', () => {
    engine.controller.press('up', 'olhos', 0);
    expect(engine.input.sourceOf(KEY.up), 'the premise: the key is held by the camera').toBe('olhos');
    loseFocus();
    expect(engine.input.keys.has(KEY.up), 'losing focus took a held position from the camera').toBe(true);
    expect(received(), 'a release reached the game for a press that is still held').toEqual(['up:true']);
    engine.controller.release('up', 'olhos', 0);
  });

  it('[Zero] with nothing held, losing focus reaches the game with nothing', () => {
    loseFocus();
    expect(received()).toEqual([]);
  });
});

/*
 * MUTATIONS CHECKED, 6 of 6 red:
 *   1. the `blur` listener not registered                          → both [Right] cases red
 *   2. every held key released, whatever its source                → [Boundary] red
 *   3. `keys` cleared directly instead of dispatching the keyups   → both [Right] cases red (the game hears no release)
 *   4. only the first held key released                            → the second [Right] case red
 *   5. the keyup stamped as the camera                             → both [Right] cases red (the conductor ignores it)
 *   6. the keyup not stamped at all                                → red in `the-keys-source-survives-the-door.node`
 *
 * 📌 No case asks whether the key presses again once focus is back: it did before the fix too — the conductor delivers a
 * fresh press either way — so such a case could never fail.
 */
