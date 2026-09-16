// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EYE CONTROL PRESSES KEYS, STAMPED AS THE EYES (ADR-0213, ADR-0109; issue #196).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { gazeKeyEvents, dispatchGazeKeys } from '../app/js/input/gaze-keys.js';
import { origemDoEvento } from '../app/js/input/origem-sintetica.js';
import { createGazeCycle } from '../app/js/input/gaze-cycle.js';

const SCHEME = { up: ['KeyW', 'ArrowUp'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], action1: ['KeyJ'], action2: ['KeyK'],
  action3: ['KeyL'], action4: ['KeyI'], leftShoulder: null, leftTrigger: null, rightShoulder: ['KeyE'], rightTrigger: null,
  start: ['Enter'], select: ['Tab'] };

describe('from what is pressed to key events', () => {
  it('a press is a keydown on the first key the child has for that action, and its end a keyup', () => {
    expect(gazeKeyEvents(null, 'up', SCHEME)).toEqual([{ type: 'keydown', code: 'KeyW' }]);
    expect(gazeKeyEvents('up', null, SCHEME)).toEqual([{ type: 'keyup', code: 'KeyW' }]);
  });
  it('the same action on consecutive frames sends nothing', () => {
    expect(gazeKeyEvents('up', 'up', SCHEME)).toEqual([]); expect(gazeKeyEvents(null, null, SCHEME)).toEqual([]);
  });
  it('one action straight after another lets the first go before pressing the second', () => {
    expect(gazeKeyEvents('up', 'action4', SCHEME)).toEqual([{ type: 'keyup', code: 'KeyW' }, { type: 'keydown', code: 'KeyI' }]);
  });
  it('an action the game gives no key presses nothing', () => {
    expect(gazeKeyEvents(null, 'leftShoulder', SCHEME)).toEqual([]);
  });
  it('the cycle\'s pulse, frame by frame, is one keydown and one keyup', () => {
    const cycle = createGazeCycle({ requireOpposite: false, cancelFirst: false });
    let before = null;
    const events = [];
    for (const [ms, zone] of [[0, 'up'], [900, 'up'], [1000, null], [1200, null], [1500, null], [1600, null]]) {
      const now = cycle(ms, { zone }).pressed;
      events.push(...gazeKeyEvents(before, now, SCHEME)); before = now;
    }
    expect(events).toEqual([{ type: 'keydown', code: 'KeyW' }, { type: 'keyup', code: 'KeyW' }]);
  });
});

describe('dispatching', () => {
  it('each event reaches the target stamped as the eyes, bubbling', () => {
    const sent = [];
    const target = { dispatchEvent: (ev) => { sent.push(ev); return true; } };
    dispatchGazeKeys(target, [{ type: 'keydown', code: 'KeyW' }, { type: 'keyup', code: 'KeyW' }], (type, init) => ({ type, ...init }));
    expect(sent.map((e) => [e.type, e.code, e.bubbles])).toEqual([['keydown', 'KeyW', true], ['keyup', 'KeyW', true]]);
    expect(sent.map(origemDoEvento)).toEqual(['olhos', 'olhos']);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-keys.py`:
//   · the last key instead of the first                       → «first key the child has»
//   · no release before the next press                        → «lets the first go»
//   · events sent on every frame                              → «consecutive frames sends nothing», «one keydown and one keyup»
//   · not stamped                                             → «stamped as the eyes»
