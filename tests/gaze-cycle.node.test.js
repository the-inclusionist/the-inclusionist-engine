// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAZE CYCLE: TWELVE ACTIONS AND START FROM FOUR ZONES (ADR-0213; issue #194). Ported from the lab's `ciclo.check.mjs`, where each rule
// was found on a run of the Dev's.
//
// Most cases switch the lab's rules on one at a time (`LAB` is the cycle with every rule off and START at 3 s), because a case written
// against all the defaults at once cannot tell which rule made it pass; the engine's defaults are pinned apart.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createGazeCycle, GAZE_GROUPS, GAZE_CYCLE_DEFAULTS, CANCEL } from '../app/js/input/gaze-cycle.js';

const LAB = { closeMs: 3000, cancelFirst: false, repeat: false, requireOpposite: false, deadMs: 0 };
const OPPOSITE = { requireOpposite: true, oppositeMs: 2000 };
const DEAD = { ...OPPOSITE, deadMs: 700 };

/** Frames `[ms, zone, eyesClosed?, frozen?]`; `shown` lists each preview as it first appears, `commanded` each action as it leaves. */
const run = (frames, opts = {}) => {
  const cycle = createGazeCycle({ ...LAB, ...opts });
  const shown = [], commanded = [];
  let last = null;
  const outs = frames.map(([ms, zone, eyesClosed = false, frozen = false]) => {
    const r = cycle(ms, { zone, eyesClosed, frozen });
    const key = r.preview && `${r.preview.zone}:${r.preview.item}`;
    if (r.preview && (!last || last.zone !== r.preview.zone || last.index !== r.preview.index)) shown.push(key);
    last = r.preview;
    if (r.commanded) commanded.push(r.commanded);
    return r;
  });
  return { shown, commanded, outs };
};

describe('the preview and the command', () => {
  it('the preview walks every step while the gaze stays, and nothing is pressed meanwhile', () => {
    const r = run([[0, 'up'], [700, 'up'], [900, 'up'], [1900, 'up'], [2900, 'up'], [3900, 'up']]);
    expect(r.shown).toEqual(['up:up', 'up:action4', 'up:rightShoulder', `up:${CANCEL}`]);
    expect(r.outs.every((o) => o.pressed === null)).toBe(true);
  });
  it('leaving presses what the preview showed, and nothing else, as a pulse', () => {
    const r = run([[0, 'up'], [900, 'up'], [1900, 'up'], [2000, null], [2100, null], [2500, null]]);
    expect(r.commanded).toEqual(['action4']);
    expect(r.outs[3].pressed).toBe('action4'); expect(r.outs[5].pressed).toBeNull();
  });
  it('a short look presses its direction; a glance shorter than the settling time presses nothing', () => {
    expect(run([[0, 'right'], [900, 'right'], [1000, null]]).commanded).toEqual(['right']);
    expect(run([[0, 'down'], [700, 'down'], [750, null], [800, null]]).commanded).toEqual([]);
  });
  it('stopping on cancel presses nothing', () => {
    const r = run([[0, 'left'], [900, 'left'], [1900, 'left'], [2900, 'left'], [3900, 'left'], [4000, null]]);
    expect(r.shown.at(-1)).toBe(`left:${CANCEL}`); expect(r.commanded).toEqual([]);
  });
  it('from one zone straight into another commands the first and starts the second', () => {
    expect(run([[0, 'up'], [900, 'up'], [1000, 'right'], [1900, 'right'], [2000, null]]).commanded).toEqual(['up', 'right']);
  });
  it('the groups are direction, the face button on that side and a shoulder', () => {
    expect(GAZE_GROUPS).toEqual({
      up: ['up', 'action4', 'rightShoulder'], right: ['right', 'action3', 'rightTrigger'],
      down: ['down', 'action2', 'leftTrigger'], left: ['left', 'action1', 'leftShoulder'],
    });
  });
});

describe('both eyes closed', () => {
  it('freeze the preview, report the time, and after closeMs press START', () => {
    const r = run([[0, 'up'], [900, 'up'], [1000, 'up', true], [2000, 'up', true], [3900, 'up', true], [4100, 'up', true], [4200, 'up']]);
    expect(r.shown).toEqual(['up:up']);
    expect(r.commanded).toContain('start'); expect(r.outs.some((o) => o.pressed === 'start')).toBe(true);
    expect(r.outs[3].closedMs).toBe(1000);
  });
  it('the cycle carries on from where it froze, and a blink presses no START', () => {
    expect(run([[0, 'up'], [900, 'up'], [1000, 'up', true], [2000, 'up'], [2100, 'up'], [2600, 'up']]).shown).toEqual(['up:up']);
    expect(run([[0, 'up'], [900, 'up'], [1000, 'up', true], [1500, 'up']]).commanded).not.toContain('start');
  });
});

describe('cancel first', () => {
  const CF = { cancelFirst: true };
  it('a look that settles and leaves commands nothing', () => {
    const r = run([[0, 'up'], [900, 'up'], [1000, null], [1100, null]], CF);
    expect(r.shown[0]).toBe(`up:${CANCEL}`); expect(r.commanded).toEqual([]);
  });
  it('the direction comes one step later, and the whole group is still reachable', () => {
    expect(run([[0, 'up'], [900, 'up'], [1900, 'up'], [2000, null]], CF).commanded).toEqual(['up']);
    const r = run([[0, 'up'], [900, 'up'], [1900, 'up'], [2900, 'up'], [3900, 'up'], [4000, null]], CF);
    expect(r.shown).toEqual([`up:${CANCEL}`, 'up:up', 'up:action4', 'up:rightShoulder']); expect(r.commanded).toEqual(['rightShoulder']);
  });
});

describe('a frame that could not be read', () => {
  it('does not command — the gaze never left — and the preview stays on its item', () => {
    const r = run([[0, 'left'], [900, 'left'], [1900, 'left'], [1930, 'left', false, true], [1960, 'left', false, true], [2000, 'left'], [2100, 'left']]);
    expect(r.commanded).toEqual([]); expect(r.shown).toEqual(['left:left', 'left:action1']);
  });
  it('gives its time back to the preview', () => {
    const plain = run([[0, 'left'], [900, 'left'], [1900, 'left'], [2400, 'left'], [3000, 'left']]);
    const frozen = run([[0, 'left'], [900, 'left'], [1900, 'left'], [2400, 'left', false, true], [3400, 'left', false, true], [3900, 'left'], [4500, 'left']]);
    expect(frozen.shown).toEqual(plain.shown); expect(plain.shown).toHaveLength(3);
  });
  it('presses no START either, but closed eyes through it still reach START once the reading is back', () => {
    expect(run([[0, null, true], [1000, null, true], [2000, null, true, true], [5000, null, true, true], [5100, null, true]]).commanded).toEqual([]);
    expect(run([[0, null, true], [1000, null, true, true], [2000, null, true], [4100, null, true]]).commanded).toEqual(['start']);
  });
  it('keeps showing the item, and the close it reports does not grow', () => {
    const r = run([[0, 'left'], [900, 'left'], [1900, 'left'], [2400, 'left', false, true], [3400, 'left', false, true]]);
    expect(r.outs.slice(3).every((o) => o.preview?.item === 'action1')).toBe(true);
    const f = run([[0, null, true], [1000, null, true], [1500, null, true, true], [3000, null, true, true]]).outs.slice(2);
    expect(f.every((o) => o.closedMs === 1500)).toBe(true);
  });
  it('a gaze that really leaves right after it still commands', () => {
    expect(run([[0, 'left'], [900, 'left'], [1900, 'left'], [1930, 'left', false, true], [2000, null], [2100, null]]).commanded).toEqual(['action1']);
  });
  it('cancel drops the gesture in hand without commanding', () => {
    const cycle = createGazeCycle(LAB);
    cycle(0, { zone: 'up' }); cycle(1900, { zone: 'up' });
    expect(cycle(2000, { zone: 'up', cancel: true }).preview).toBeNull();
    expect(cycle(2100, { zone: null }).commanded).toBeNull();
  });
});

describe('the command is born of the movement: from the opposite zone', () => {
  it('a gaze that lands from the middle shows nothing, commands nothing and says it is not armed', () => {
    const r = run([[0, 'up'], [900, 'up'], [1900, 'up'], [2900, 'up'], [3000, null]], OPPOSITE);
    expect(r.shown).toEqual([]); expect(r.commanded).toEqual([]);
    expect(r.outs[1].armed).toBe(false); expect(r.outs[1].preview).toBeNull();
  });
  it('down first, then up and held, arms it: the preview walks and leaving commands', () => {
    const r = run([[0, 'down'], [300, 'down'], [600, null], [900, 'up'], [1800, 'up'], [2800, 'up'], [2900, null]], OPPOSITE);
    expect(r.shown).toEqual(['up:up', 'up:action4']); expect(r.commanded).toEqual(['action4']);
  });
  it('a zone that is not the opposite arms nothing, and a preparation older than the window is spent', () => {
    expect(run([[0, 'right'], [300, 'right'], [600, null], [900, 'up'], [1900, 'up'], [2000, null]], OPPOSITE).commanded).toEqual([]);
    expect(run([[0, 'down'], [300, 'down'], [600, null], [3000, 'up'], [3900, 'up'], [4900, 'up'], [5000, null]], OPPOSITE).commanded).toEqual([]);
  });
  it('an armed visit spends the preparation: coming back commands nothing, nor does a second look at the same zone', () => {
    expect(run([[0, 'down'], [300, 'down'], [600, null], [900, 'up'], [1800, 'up'], [2800, 'up'], [2900, 'down'], [3800, 'down'], [4800, 'down'], [4900, null]], OPPOSITE).commanded)
      .toEqual(['action4']);
    expect(run([[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [1400, 'up'], [1500, null], [1600, 'up'], [2500, 'up'], [2600, null]], OPPOSITE).commanded)
      .toEqual(['up']);
  });
  it('the next down-and-up is a new command', () => {
    expect(run([[0, 'down'], [300, 'down'], [600, null], [900, 'up'], [1800, 'up'], [1900, null], [2000, 'down'], [2300, 'down'], [2500, null],
      [2800, 'up'], [3700, 'up'], [3800, null]], OPPOSITE).commanded).toEqual(['up', 'up']);
  });
  it('START ends the gesture: a preparation from before the eyes closed arms nothing after', () => {
    expect(run([[0, 'down'], [300, 'down'], [600, null], [700, null, true], [2200, null, true], [2300, 'up'], [3200, 'up'], [4200, 'up'], [4300, null]],
      { ...OPPOSITE, closeMs: 1500 }).commanded).toEqual(['start']);
  });
  it('a flicker through the target zone does not spend the preparation', () => {
    expect(run([[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [600, null], [700, 'up'], [1600, 'up'], [1700, null]], OPPOSITE).commanded).toEqual(['up']);
  });
  it('with the rule off, a zone reached from the middle still commands', () => {
    expect(run([[0, 'up'], [900, 'up'], [1900, 'up'], [2000, null]]).commanded).toEqual(['action4']);
  });
});

describe('the end of a command is not the start of another', () => {
  it('the rebound inside the dead time prepares nothing: one gesture, one command', () => {
    expect(run([[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [1400, 'up'], [2300, 'up'], [2400, null],
      [2500, 'down'], [2900, 'down'], [3000, null], [3100, 'up'], [4000, 'up'], [4100, null]], DEAD).commanded).toEqual(['action4']);
  });
  it('a gesture that waits out the dead time commands again', () => {
    expect(run([[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [1400, 'up'], [2300, 'up'], [2400, null],
      [3200, 'down'], [3600, 'down'], [3700, null], [3800, 'up'], [4700, 'up'], [4800, null]], DEAD).commanded).toEqual(['action4', 'up']);
  });
  it('START counts as a command: the dead time holds after it too', () => {
    expect(run([[0, null], [400, null], [500, null, true], [2000, null, true], [2100, 'down'], [2400, 'down'], [2500, null],
      [2600, 'up'], [3500, 'up'], [3600, null]], { ...DEAD, closeMs: 1500 }).commanded).toEqual(['start']);
  });
  it('a gesture read zone to zone, with no middle in between, still commands', () => {
    expect(run([[0, 'down'], [300, 'down'], [400, 'up'], [1300, 'up'], [2200, 'up'], [2300, null]], DEAD).commanded).toEqual(['action4']);
  });
  it('a visit that will prepare says so, and an armed one does not', () => {
    const r = run([[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [1400, 'up']], DEAD);
    expect([r.outs[1].preparing, r.outs[1].armed, r.outs[3].preparing, r.outs[3].armed]).toEqual([true, false, false, true]);
  });
});

describe('the cycle goes round again', () => {
  const R = { cancelFirst: true, repeat: true };
  const HOLD = [[0, 'up'], [900, 'up'], [1900, 'up'], [2900, 'up'], [3900, 'up'], [4900, 'up'], [5900, 'up']];
  it('without repeat it stops on its last item; with it, it goes round', () => {
    expect(run(HOLD).shown).toEqual(['up:up', 'up:action4', 'up:rightShoulder', `up:${CANCEL}`]);
    expect(run(HOLD, R).shown).toEqual([`up:${CANCEL}`, 'up:up', 'up:action4', 'up:rightShoulder', `up:${CANCEL}`, 'up:up']);
  });
  it('leaving on the second round commands what it shows then, and nothing while it passes cancel', () => {
    expect(run([...HOLD, [6000, null]], R).commanded).toEqual(['up']);
    expect(run([...HOLD.slice(0, 6), [5000, null]], R).commanded).toEqual([]);
  });
});

describe('the engine defaults (ADR-0213)', () => {
  it('are the lab\'s: settle 0.8 s, step 1 s, START 2 s, cancel first, repeat, from the opposite within 2 s, 0.7 s dead', () => {
    expect(GAZE_CYCLE_DEFAULTS).toEqual({
      entryMs: 800, stepMs: 1000, closeMs: 2000, pulseMs: 400,
      cancelFirst: true, repeat: true, requireOpposite: true, oppositeMs: 2000, deadMs: 700,
    });
    const cycle = createGazeCycle();
    const outs = [[0, 'down'], [300, 'down'], [400, null], [500, 'up'], [1400, 'up'], [2400, 'up']].map(([ms, zone]) => cycle(ms, { zone }));
    expect(outs[4].preview.item).toBe(CANCEL); expect(outs[5].preview.item).toBe('up');
    expect(cycle(2500, { zone: null }).commanded).toBe('up');
    expect(cycle(4600, { eyesClosed: true }).commanded).toBeNull();
    expect(cycle(6600, { eyesClosed: true }).commanded).toBe('start');
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-cycle.py`:
//   · the action pressed on the way (commanded on every preview change)   → «leaving presses what the preview showed»
//   · the pulse never ends                                                 → «as a pulse»
//   · the preview not frozen with the eyes closed                          → «freeze the preview», «carries on»
//   · START not waiting for closeMs                                        → «a blink presses no START»
//   · a frozen frame read as the gaze leaving                              → «does not command — the gaze never left»
//   · the frozen time not given back                                       → «gives its time back»
//   · START while frozen                                                   → «presses no START either»
//   · cancel ignored                                                       → «cancel drops the gesture»
//   · armed from any zone (not only the opposite)                          → «not the opposite arms nothing»
//   · the opposite window ignored                                          → «older than the window»
//   · the preparation not spent                                            → «spends the preparation»
//   · a flicker spends the preparation                                     → «a flicker through the target»
//   · START not clearing the gesture                                       → «START ends the gesture»
//   · no dead time                                                         → «the rebound … one command»
//   · cancel always at the end                                             → «cancel first»
//   · repeat ignored                                                       → «goes round»
//   · closeMs default back to 3 s                                          → «engine defaults»
