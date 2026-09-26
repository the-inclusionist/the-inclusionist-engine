// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE CARRIES THE VIRTUAL BUTTON TO THE GAME (ADR-0111 erratum of 2026-09-16; issue #197).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createVirtualController } from '../app/js/input/virtual-controller.js';

const SCHEME = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA'], right: ['KeyD'], action1: ['KeyZ'], action2: ['KeyX'],
  action3: ['KeyV'], action4: ['KeyC'], leftShoulder: null, leftTrigger: null, rightShoulder: null, rightTrigger: null, start: ['Enter'], select: ['Tab'] };

const make = ({ menu = false } = {}) => {
  const log = [];
  let menuOpen = menu;
  const vc = createVirtualController({
    scheme: () => SCHEME, menuOpen: () => menuOpen,
    holdKey: (code, source) => log.push(['hold', code, source]), releaseKey: (code) => log.push(['release', code]),
    menuKey: (code, source) => log.push(['menu', code, source]), deliver: (c) => log.push(['deliver', c]),
  });
  return { vc, log, setMenu: (v) => { menuOpen = v; } };
};

describe('in play', () => {
  it('a press holds the child\'s first key for the position and delivers the position, pressed, with its source and seat', () => {
    const { vc, log } = make();
    vc.press('down', 'olhos');
    expect(log).toEqual([['hold', 'KeyS', 'olhos'], ['deliver', { action: 'down', pressed: true, source: 'olhos', player: 0 }]]);
  });
  it('the release lets go of the same key and delivers the release', () => {
    const { vc, log } = make();
    vc.press('action2', 'olhos', 1); log.length = 0;
    vc.release('action2', 'olhos', 1);
    expect(log).toEqual([['release', 'KeyX'], ['deliver', { action: 'action2', pressed: false, source: 'olhos', player: 1 }]]);
  });
  it('a key remapped while held is still released: the release lets go of the key that was pressed', () => {
    const log = [];
    let scheme = SCHEME;
    const vc = createVirtualController({
      scheme: () => scheme, menuOpen: () => false, holdKey: (c) => log.push(['hold', c]), releaseKey: (c) => log.push(['release', c]),
      menuKey: () => {}, deliver: () => {},
    });
    vc.press('down', 'olhos');
    scheme = { ...SCHEME, down: ['KeyK'] };
    vc.release('down', 'olhos');
    expect(log).toEqual([['hold', 'KeyS'], ['release', 'KeyS']]);
  });
  it('a position the scheme gives no key still reaches the game — the map is the game\'s', () => {
    const { vc, log } = make();
    vc.press('rightShoulder', 'olhos'); vc.release('rightShoulder', 'olhos');
    expect(log.map((l) => l[0])).toEqual(['deliver', 'deliver']);
  });
  // 🔴 THE ANSWER, and it is the reason `press` stopped returning nothing (ADR-0223). Every transport was asking
  // this question for itself — the touch pad had its own `emMenu()` — and two answers to one question is how the
  // two doors came to disagree. A transport that raises an edge, hides its tips or announces something now reads it.
  it('a press that reached play ANSWERS true', () => {
    const { vc } = make();
    expect(vc.press('down', 'toque')).toBe(true);
  });
  // 🔴 ONE PRESS, ONE ACTION (ADR-0111 erratum of 2026-09-26): a key typed into a field, or pressing the engine's own control,
  // is that thing's. The keyboard says so (`input/key-default`), and play hears nothing — not the press, not its release.
  it('a press held back from play (`toPlay` false) holds nothing, delivers nothing, answers false — and its release delivers nothing', () => {
    const { vc, log } = make();
    expect(vc.press('action2', undefined, 0, false)).toBe(false);
    vc.release('action2', undefined, 0);
    expect(log).toEqual([]);
  });
  // 🔴 THE SYSTEM POSITIONS ARE THE ENGINE'S (ADR-0144 §4, ADR-0155 §4): START is the quick pause, SELECT the menus, and a cartridge
  // may not declare either — so play never hears them, from any transport, whatever the keyboard says about the focus.
  for (const action of ['start', 'select']) {
    for (const source of [undefined, 'teclado', 'olhos', 'toque', 'gamepad']) {
      it(`${action} from ${source ?? 'an unsigned key'} in play holds nothing, delivers nothing, answers false — nor its release`, () => {
        const { vc, log } = make();
        expect(vc.press(action, source, 0, true)).toBe(false);
        vc.release(action, source, 0);
        expect(log).toEqual([]);
      });
    }
  }
  it('[Boundary] the rule names the two system positions only: a verb beside them in play still reaches the game', () => {
    const { vc, log } = make();
    expect(vc.press('action4', undefined, 0, true)).toBe(true);
    expect(log.at(-1)).toEqual(['deliver', { action: 'action4', pressed: true, source: undefined, player: 0 }]);
  });
});

describe('with a menu open', () => {
  it('the position moves the menu by its key and the game hears nothing', () => {
    const { vc, log } = make({ menu: true });
    vc.press('down', 'olhos'); vc.release('down', 'olhos');
    expect(log).toEqual([['menu', 'KeyS', 'olhos']]);
  });
  it('the press ANSWERS false — a menu took it, and the transport is told instead of guessing', () => {
    const { vc } = make({ menu: true });
    expect(vc.press('down', 'toque')).toBe(false);
  });
  it('...and it answers false even for a position with no key, which moves no menu at all', () => {
    const { vc, log } = make({ menu: true });
    expect(vc.press('rightShoulder', 'toque')).toBe(false);
    expect(log).toEqual([]);
  });
  it('a press held back from play is still the menu\'s: the menu is asked first, as for every press', () => {
    const { vc, log } = make({ menu: true });
    expect(vc.press('down', 'olhos', 0, false)).toBe(false);
    expect(log).toEqual([['menu', 'KeyS', 'olhos']]);
  });
  it('START is still the menu\'s key there — the way a camera\'s START leaves the quick pause', () => {
    const { vc, log } = make({ menu: true });
    expect(vc.press('start', 'olhos')).toBe(false);
    expect(log).toEqual([['menu', 'Enter', 'olhos']]);
  });
  it('a press the game heard is released to it even if a menu opened meanwhile', () => {
    const { vc, log, setMenu } = make();
    vc.press('up', 'olhos'); setMenu(true); log.length = 0;
    vc.release('up', 'olhos');
    expect(log).toEqual([['release', 'KeyW'], ['deliver', { action: 'up', pressed: false, source: 'olhos', player: 0 }]]);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-virtual-controller.py`:
//   · the menu not checked (a menu press reaches the game)     → «the game hears nothing»
//   · a release delivered without a press the game heard       → «the game hears nothing»
//   · the release looking up the key again instead of the held → «remapped while held» (survived until that case existed)
//   · no delivery without a key                                → «still reaches the game»
//   · the source not carried                                   → «with its source»
// And (2026-09-26, the system positions are the engine's) — `scratchpad/keys-start/spec1.mjs`, restored and checked by SHA-256:
//   · the system rule removed                                  → the ten system cases (and three real-key cases in the browser)
//   · only `start` in the rule / only `select` in the rule     → the five cases of the one left out
//   · `action4` added to the rule                              → «[Boundary] … a verb beside them»
//   · the rule asked before the menu                           → «START is still the menu's key there»
