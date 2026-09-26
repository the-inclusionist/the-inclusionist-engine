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
    systemPress: (action, player) => log.push(['system', action, player]),
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
  // may not declare either — so play never hears them, from any transport. In play they go to the ENGINE instead (`systemPress`):
  // that is how START and SELECT open the pause «from any transport» (ADR-0144 §1, erratum of 2026-09-26).
  for (const action of ['start', 'select']) {
    for (const source of [undefined, 'teclado', 'olhos', 'rosto', 'gestos', 'fala', 'toque', 'gamepad']) {
      it(`${action} from ${source ?? 'an unsigned key'} in play goes to the ENGINE: nothing held, nothing delivered, false — nor its release`, () => {
        const { vc, log } = make();
        expect(vc.press(action, source, 0, true)).toBe(false);
        vc.release(action, source, 0);
        expect(log).toEqual([['system', action, 0]]);
      });
    }
  }
  it('[Right] the engine is told the SEAT that pressed: player N\'s transport opens player N\'s pause', () => {
    const { vc, log } = make();
    vc.press('select', 'olhos', 2);
    expect(log).toEqual([['system', 'select', 2]]);
  });
  it('[Zero] a system position held back from play (`toPlay` false) reaches nobody — not even the engine', () => {
    const { vc, log } = make();
    expect(vc.press('start', undefined, 0, false)).toBe(false);
    expect(log).toEqual([]);
  });
  it('[Boundary] the rule names the two system positions only: a verb beside them in play still reaches the game', () => {
    const { vc, log } = make();
    expect(vc.press('action4', undefined, 0, true)).toBe(true);
    expect(log.at(-1)).toEqual(['deliver', { action: 'action4', pressed: true, source: undefined, player: 0 }]);
    expect(log.some((l) => l[0] === 'system'), 'a verb was handed to the engine as if it were START').toBe(false);
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
  // 🔴 A SYSTEM POSITION IS NEVER TRANSLATED INTO A KEY (ADR-0144 erratum of 2026-09-26). This scheme's `start` is `Enter`, which on
  // the quick pause's bar is «confirm»: handed to the menu as its first key, a camera's START confirmed the icon under the cursor
  // instead of leaving. The engine is told the POSITION, as in play, and answers it the way its own START and SELECT keys do.
  for (const action of ['start', 'select']) {
    it(`${action.toUpperCase()} with a menu open goes to the ENGINE as the position — never as its first key — and answers false`, () => {
      const { vc, log } = make({ menu: true });
      expect(vc.press(action, 'olhos', 1)).toBe(false);
      vc.release(action, 'olhos', 1);
      expect(log).toEqual([['system', action, 1]]);
    });
  }
  it('[Right] with a menu open even a press held back from play (`toPlay` false) reaches the engine: the menu is the press\'s', () => {
    const { vc, log } = make({ menu: true });
    vc.press('start', 'olhos', 0, false);
    expect(log).toEqual([['system', 'start', 0]]);
  });
  it('a press the game heard is released to it even if a menu opened meanwhile', () => {
    const { vc, log, setMenu } = make();
    vc.press('up', 'olhos'); setMenu(true); log.length = 0;
    vc.release('up', 'olhos');
    expect(log).toEqual([['release', 'KeyW'], ['deliver', { action: 'up', pressed: false, source: 'olhos', player: 0 }]]);
  });
});

/*
 * ===================== ONE BUTTON ONLY: EVERY PRESS TAKES THE ONE SHOWN (ADR-0218 §4) =====================
 * «With one button only on, every key, every touch on the game region and every press a camera or speech transport sends
 * collapses into "take the one shown".» The controller is the door every transport that reads positions presses — the eyes, the
 * face, the hands, the voice, the on-screen pad, the gamepad — so it asks ONCE, first, whether one-button scanning takes the
 * press; the scan answers, and a taken press reaches nothing else.
 */
describe('with one-button scanning on, a press is the scan\'s and nothing else', () => {
  const makeScan = ({ menu = false } = {}) => {
    const log = [];
    const asked = [];
    let takes = true;
    const vc = createVirtualController({
      scheme: () => SCHEME, menuOpen: () => menu,
      holdKey: (code, source) => log.push(['hold', code, source]), releaseKey: (code) => log.push(['release', code]),
      menuKey: (code, source) => log.push(['menu', code, source]), deliver: (c) => log.push(['deliver', c]),
      systemPress: (action, player) => log.push(['system', action, player]),
      takeShown: (source) => { asked.push(source); return takes; },
    });
    return { vc, log, asked, setTakes: (v) => { takes = v; } };
  };

  for (const source of [undefined, 'teclado', 'olhos', 'rosto', 'gestos', 'fala', 'toque', 'gamepad']) {
    it(`🔴 [Right] a press from ${source ?? 'an unsigned key'} is asked of the scan with its source, and taken it reaches NOTHING`, () => {
      const { vc, log, asked } = makeScan();
      expect(vc.press('action2', source, 1), 'a taken press answered that it reached play').toBe(false);
      vc.release('action2', source, 1);
      expect(asked, 'the scan was not asked, or not told who pressed').toEqual([source]);
      expect(log, 'a taken press held a key, reached the game, a menu or the engine').toEqual([]);
    });
  }

  it('🔴 [Right] START and SELECT are presses like any other: taken, the engine opens no pause', () => {
    const { vc, log } = makeScan();
    vc.press('start', 'olhos'); vc.press('select', 'fala');
    expect(log, 'a camera\'s START opened the pause although the scan took it').toEqual([]);
  });

  it('🔴 [Right] with a menu open too: a taken press is not the menu\'s key', () => {
    const { vc, log } = makeScan({ menu: true });
    vc.press('down', 'olhos');
    expect(log).toEqual([]);
  });

  it('🔴 [Zero] a press the scan does NOT take is itself, as without the scan', () => {
    const { vc, log, setTakes } = makeScan();
    setTakes(false);
    expect(vc.press('down', 'olhos')).toBe(true);
    expect(log).toEqual([['hold', 'KeyS', 'olhos'], ['deliver', { action: 'down', pressed: true, source: 'olhos', player: 0 }]]);
  });

  it('🔴 [Boundary] a press the game heard BEFORE the scan went on is still released to it — no child is left holding a button', () => {
    const { vc, log, asked, setTakes } = makeScan();
    setTakes(false);
    vc.press('up', 'rosto');
    setTakes(true); log.length = 0; asked.length = 0;
    vc.release('up', 'rosto');
    expect(log).toEqual([['release', 'KeyW'], ['deliver', { action: 'up', pressed: false, source: 'rosto', player: 0 }]]);
    expect(asked, 'a release was offered to the scan: letting go is not a press').toEqual([]);
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
// And (2026-09-26, START and SELECT from every transport) — `scratchpad/start-any/mutate.mjs`, restored and checked by SHA-256:
//   · `systemPress` never called                                → the sixteen «goes to the ENGINE» cases
//   · the seat not forwarded (always 0)                        → «the engine is told the SEAT»
//   · `systemPress` asked before `toPlay`                       → «held back from play reaches nobody»
//   · `systemPress` asked with a menu open too                  → «START is still the menu's key there» (a case the erratum below retired)
// And (2026-09-26, a system position is never a key) — `scratchpad/scan-doors/mutate-vc.mjs`, restored and checked by SHA-256:
//   · with a menu open, the system position handed to the menu as its first key again → the two «never as its first key» cases
//     and «even a press held back» (3 red; 1 red in `start-and-select-from-every-transport.browser`)
//   · with a menu open, `systemPress` asked only when `toPlay`  → «even a press held back from play reaches the engine»
//   · `systemPress` asked in play whatever `toPlay` says        → «held back from play reaches nobody»
// And (2026-09-26, one button only: every press takes the one shown) — `scratchpad/scan-rest/mutate2.mjs`, same discipline:
//   · the controller never asks the scan (Q1)                   → the ten «taken it reaches NOTHING» cases
//   · START and SELECT let through untaken (Q2)                 → «START and SELECT are presses like any other»
