// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAD WITH NOWHERE TO MOUNT IS SAID IN `problems`, AND NOTHING IS MOUNTED (ADR-0143, ADR-0169; issue #141).
//
// The engine hangs the virtual pad on `host.touchHost`, falling back to `#game-region`. A page with neither, whose cartridge
// asks for the pad (`onScreenPad`), has no place for it: a child on a tablet with no keyboard cannot play, nor reach the
// pause. Issue #141 was opened because that case was SILENT — the bindings gave up on a missing `#touch-controls` and
// nothing reached `problems`. These cases hold the answer the engine gives now: one line that names the fix, and no pad
// hung anywhere else behind the game's back.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)

let createGame;
let page;
const roots = [];

/** A quiz whose world is `#stage` — so the only thing missing from the page is a place for the pad. */
const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#stage' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'question', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'questions', gender: 'f', plural: true }, have: 0, need: 2 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

const PRESET = { up: { label: 'Up' }, down: { label: 'Down' }, action2: { label: 'Confirm' } };
const NOWHERE = /the virtual pad has nowhere to mount/;

const open = (extra = {}, host = {}) => {
  const root = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false, ...keyed({ preset: PRESET }),
    host: { doc: document, win: window, ...host }, ...extra,
  });
  roots.push(root);
  return root;
};

beforeAll(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
});

beforeEach(() => {
  // ⚠️ NO `#game-region` and no `touchHost`: that is the case. The screen-reader regions and the world are there, so no
  // other gap stands in for the one measured.
  page = document.createElement('div');
  page.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p><div id="stage"></div>';
  document.body.appendChild(page);
});

afterEach(() => {
  for (const r of roots.splice(0)) r.dispose();
  page.remove();
  document.getElementById('touch-controls')?.remove();
});

describe('a cartridge that asks for the pad, on a page with no place for it', () => {
  it('🔴 [Right] `problems` says so, and names `host.touchHost` as the fix', () => {
    expect(document.getElementById('game-region'), 'the page has a #game-region: the case would measure nothing').toBeNull();
    const root = open({ onScreenPad: true });
    const line = root.problems.find((l) => NOWHERE.test(l));
    expect(line, 'the pad could not be mounted and the engine kept quiet').toBeTruthy();
    expect(line, 'a line without the fix is a complaint').toMatch(/host\.touchHost/);
  });

  it('🔴 [Zero] and NOTHING is mounted — no pad hung elsewhere, no button in the page', () => {
    open({ onScreenPad: true });
    expect(document.getElementById('touch-controls'), 'a pad was hung somewhere the game never offered').toBeNull();
    expect(document.querySelector('.touch-btn, #touch-start, #touch-select'), 'a pad button exists outside any pad').toBeNull();
  });

  it('🎯 [Boundary] the pair: the same page WITH `host.touchHost` gets the pad there, and no such line', () => {
    const slot = document.createElement('div');
    page.appendChild(slot);
    const root = open({ onScreenPad: true }, { touchHost: slot });
    expect(slot.querySelector('#touch-controls'), 'the pad did not go where the game said').not.toBeNull();
    expect(root.problems.filter((l) => NOWHERE.test(l)), 'the line accuses a host that has a place').toEqual([]);
  });

  it('[Zero] a cartridge that does NOT ask for the pad is not told it has nowhere to go (ADR-0166)', () => {
    const root = open();
    expect(root.problems.filter((l) => NOWHERE.test(l)), 'a pad gap reported for a game without a pad').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each in `app/js/boot/create-game.ts`, applied with the Edit tool and restored the same way:
//   N1 `padGapProblems` returns `touchGaps(…)` even when the host is unusable (the nowhere line dropped)
//      → the [Right] case fails: the silence issue #141 was opened for.
//   N2 `drawPad` hangs the pad on `doc.body` when there is no host, the line kept
//      → the [Zero] «nothing is mounted» case fails.
//   N3 `host.touchHost` ignored (`const touchHostEl = $('#game-region')`)
//      → the [Boundary] pair fails: the pad goes nowhere and the line accuses a host that has a place.
//   N4 the `!cartridge.onScreenPad` guard removed from `padGapProblems`
//      → the last [Zero] case fails.
