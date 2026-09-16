// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAZE READ FROM ITS OWN REST (ADR-0213; issue #194). Ported from the lab's `relativo.check.mjs`, where every rule was found on a run of
// the Dev's and each case was made to bite.
//
// 📏 The numbers come from measuring the reader: with this jitter the tremor lands on the floor (0.02 on both axes), so 0.02 of displacement
// is one tremor. Most cases run with the lab's 3 tremors on both axes (entry 0.06, exit 1.8 tremors = 0.036), because a case that holds with
// much more than the threshold measures nothing; the engine's own defaults are pinned apart.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createGazeReader, GAZE_DEFAULTS } from '../app/js/input/gaze-relative.js';

const jitter = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.02;
const POSE = { yaw: 2, pitch: -5 };
const lab = (opts = {}) => createGazeReader({ vertical: 3, sideways: 3, parkedMs: 5000, ...opts });

/** Three seconds of rest at ten frames a second. */
const rest = (read, base = { h: 0.1, v: -0.05 }) => {
  let ms = 0, last = null;
  for (let i = 0; i < 31; i++, ms += 100) last = read(ms, { h: base.h + jitter(i), v: base.v + jitter(i * 3), pose: POSE });
  return { ms, last };
};

describe('the rest', () => {
  it('measures itself in three still seconds and reports its tremor, and a gaze at rest reads no zone', () => {
    const read = lab();
    const { ms, last } = rest(read);
    expect(last.ready).toBe(true); expect(last.reason).toBe('rest-measured');
    expect(Math.abs(last.rest.h - 0.1)).toBeLessThan(0.02); expect(last.tremor.h).toBeGreaterThan(0); expect(last.tremor.h).toBeLessThan(0.05);
    const still = read(ms + 100, { h: 0.1, v: -0.05, pose: POSE });
    expect(still.zone).toBeNull(); expect(still.strength).toBeLessThan(3);
  });
  it('with no measurable jitter the tremor is the floor, never zero, and the threshold still holds', () => {
    const read = lab();
    let ms = 0, last = null;
    for (let i = 0; i < 31; i++, ms += 100) last = read(ms, { h: 0.1, v: -0.05, pose: POSE });
    expect(last.tremor).toEqual({ h: 0.02, v: 0.02 });
    expect(read(ms + 100, { h: 0.14, v: -0.05, pose: POSE }).zone).toBeNull(); // 2 tremors
    expect(read(ms + 200, { h: 0.2, v: -0.05, pose: POSE }).zone).toBe('left'); // 5 tremors
  });
  it('a still but not perfect rest sets the threshold to its own spread (MAD × 1.4826)', () => {
    const read = lab();
    let ms = 0, last = null;
    for (let i = 0; i < 31; i++, ms += 100) last = read(ms, { h: 0.1 + ((i % 11) - 5) * 0.01, v: -0.05, pose: POSE });
    expect(last.ready).toBe(true); expect(last.tremor.h).toBeCloseTo(0.03 * 1.4826, 3);
    expect(read(ms + 100, { h: 0.2, v: -0.05, pose: POSE }).zone, '2.2 tremors of this face').toBeNull();
  });
  it('a gaze that keeps moving never becomes a rest, and says so', () => {
    const read = lab();
    let ms = 0, out = null;
    for (let i = 0; i < 120; i++, ms += 100) out = read(ms, { h: 0.1 + Math.sin(i / 2) * 0.15, v: -0.05 + Math.cos(i / 3) * 0.12, pose: POSE });
    expect(out.ready).toBe(false); expect(['gaze-moving', 'measuring-rest']).toContain(out.reason);
  });
  it('counts the three seconds from when the gaze settled, and rests where it settled — not on the average of the hunt', () => {
    const read = lab();
    let ms = 0, out = null;
    for (let i = 0; i < 50; i++, ms += 100) out = read(ms, { h: 0.3 + Math.sin(i / 2) * 0.2, v: 0.2, pose: POSE });
    expect(out.ready).toBe(false);
    for (let i = 0; i < 35; i++, ms += 100) out = read(ms, { h: -0.4 + jitter(i), v: 0.02 + jitter(i * 3), pose: POSE });
    expect(out.ready).toBe(true);
    expect(Math.abs(out.rest.h + 0.4)).toBeLessThan(0.02); expect(Math.abs(out.rest.v - 0.02)).toBeLessThan(0.02); expect(out.tremor.h).toBeLessThan(0.05);
  });
  it('a blink in the middle of the measurement does not restart it', () => {
    const read = lab();
    let ms = 0, out = null;
    for (let i = 0; i < 31; i++, ms += 100) out = read(ms, { h: 0.1 + (i === 12 || i === 13 ? 0.4 : jitter(i)), v: -0.05 + jitter(i * 3), pose: POSE });
    expect(out.ready).toBe(true); expect(Math.abs(out.rest.h - 0.1)).toBeLessThan(0.02);
  });
  it('frames from before the eye settled do not move the rest, and the reading that follows is right', () => {
    const read = lab();
    let ms = 0, last = null;
    for (let i = 0; i < 40; i++, ms += 100) last = read(ms, { h: i < 5 ? 0.5 : 0.1 + jitter(i), v: -0.05 + jitter(i * 3), pose: POSE });
    expect(Math.abs(last.rest.h - 0.1)).toBeLessThan(0.02); expect(last.tremor.h).toBeLessThan(0.05);
    expect(read(ms + 100, { h: -0.2, v: -0.05, pose: POSE }).zone).toBe('right');
  });
  it('two head jerks do not move the rest, but a head that keeps moving keeps the request up', () => {
    const read = lab();
    let ms = 0, out = null;
    for (let i = 0; i < 34; i++, ms += 100) {
      const jerk = i === 10 || i === 20;
      out = read(ms, { h: 0.1 + (jerk ? 0.4 : jitter(i)), v: -0.05 + jitter(i * 3), pose: { yaw: jerk ? 40 : 2, pitch: -5 } });
    }
    expect(out.ready).toBe(true); expect(Math.abs(out.rest.h - 0.1)).toBeLessThan(0.02);
    const other = lab();
    let m2 = 0, s2 = null;
    for (let i = 0; i < 80; i++, m2 += 100) s2 = other(m2, { h: 0.1 + Math.sin(i / 2) * 0.2, v: -0.05, pose: { yaw: 2 + Math.sin(i / 2) * 25, pitch: -5 } });
    expect(s2.ready).toBe(false);
  });
});

describe('the zone', () => {
  it('is the axis that moved further, and its strength is large for a real look', () => {
    const read = lab();
    const { ms } = rest(read);
    const right = read(ms + 100, { h: -0.2, v: -0.05, pose: POSE });
    const left = read(ms + 400, { h: 0.4, v: -0.05, pose: POSE });
    const up = read(ms + 700, { h: 0.1, v: -0.3, pose: POSE });
    const down = read(ms + 1000, { h: 0.1, v: 0.3, pose: POSE });
    expect([right.zone, left.zone, up.zone, down.zone]).toEqual(['right', 'left', 'up', 'down']);
    expect(right.strength).toBeGreaterThan(5); expect(up.strength).toBeGreaterThan(5);
  });
  it('a movement smaller than the threshold reads nothing', () => {
    const read = lab();
    const { ms } = rest(read);
    expect(read(ms + 100, { h: 0.15, v: -0.05, pose: POSE }).zone).toBeNull();
  });
  it('once in a zone it holds with less than it took to enter, and lets go below that', () => {
    const read = lab({ exit: 0.6 });
    const { ms } = rest(read);
    const entered = read(ms + 100, { h: 0.1, v: 0.3, pose: POSE });
    const held = read(ms + 200, { h: 0.1, v: 0.0, pose: POSE }); // 2.36 tremors: under the entry (3), over the exit (1.8)
    const released = read(ms + 300, { h: 0.1, v: -0.05, pose: POSE });
    expect(entered.zone).toBe('down');
    expect(held.strength).toBeGreaterThan(1.8); expect(held.strength).toBeLessThan(3); expect(held.zone).toBe('down');
    expect(released.zone).toBeNull();
  });
  it('a frame where the head turned fast is not read, and the next settled frame is', () => {
    const read = lab();
    const { ms } = rest(read);
    const fast = read(ms + 100, { h: 0.5, v: -0.05, pose: { yaw: 22, pitch: -5 } }); // 200°/s
    expect(fast.zone).toBeNull(); expect(fast.reason).toBe('head-moving');
    expect(read(ms + 600, { h: 0.5, v: -0.05, pose: { yaw: 23, pitch: -5 } }).zone).toBe('left');
  });
  it('a frame without eyes says so and reads nothing; reset forgets the rest', () => {
    const read = lab();
    const { ms } = rest(read);
    const blind = read(ms + 100, { h: null, v: null });
    expect(blind.zone).toBeNull(); expect(blind.reason).toBe('no-eyes');
    read.reset();
    expect(read.state().rest).toBeNull();
  });
  it('a gaze sitting between two zones keeps the one it is in, but an axis that clearly wins takes it', () => {
    const read = lab({ axisSwitch: 1.3 });
    const { ms } = rest(read);
    const entered = read(ms + 100, { h: 0.1, v: 0.14, pose: POSE }); // 9.5 tremors down
    const almost = read(ms + 200, { h: 0.3, v: 0.14, pose: POSE }); // 10.0 sideways: wins by 5%
    const clear = read(ms + 300, { h: 0.4, v: 0.14, pose: POSE }); // 15.0 sideways
    expect([entered.zone, almost.zone, clear.zone]).toEqual(['down', 'down', 'left']);
  });
  it('crossing to the other side of the same axis is not held back, and an axis under the exit does not keep the zone', () => {
    const read = lab({ axisSwitch: 1.3 });
    const { ms } = rest(read);
    expect(read(ms + 100, { h: 0.1, v: 0.2, pose: POSE }).zone).toBe('down');
    expect(read(ms + 300, { h: 0.1, v: -0.3, pose: POSE }).zone).toBe('up');
    expect(read(ms + 500, { h: 0.138, v: -0.018, pose: POSE }).zone, 'vertical 1.6 under the 1.8 exit, horizontal 1.9').toBe('left');
  });
});

describe('the sides have their own threshold', () => {
  it('the same four tremors command downwards and not sideways, and a real look sideways still commands', () => {
    const read = lab({ sideways: 6 });
    const { ms } = rest(read);
    const side4 = read(ms + 100, { h: 0.18, v: -0.05, pose: POSE });
    const back = read(ms + 200, { h: 0.1, v: -0.05, pose: POSE });
    const down4 = read(ms + 300, { h: 0.1, v: 0.03, pose: POSE });
    expect([side4.zone, back.zone, down4.zone]).toEqual([null, null, 'down']);
    const side8 = read(ms + 600, { h: 0.26, v: -0.05, pose: POSE });
    expect(side8.zone).toBe('left'); expect(side8.displacement.h).toBeCloseTo(8, 0);
  });
  it('the contest between the axes is fought in the same units', () => {
    const read = lab({ sideways: 6 });
    const { ms } = rest(read);
    expect(read(ms + 100, { h: 0.2, v: 0.03, pose: POSE }).zone, '5 sideways is less than 4 down').toBe('down');
  });
  it('the engine defaults are 4 up and down and 8 to the sides, over three still seconds (ADR-0213)', () => {
    expect([GAZE_DEFAULTS.vertical, GAZE_DEFAULTS.sideways, GAZE_DEFAULTS.restMs, GAZE_DEFAULTS.parkedMs]).toEqual([4, 8, 3000, 10000]);
    const read = createGazeReader();
    const { ms } = rest(read);
    expect(read(ms + 100, { h: 0.1 + 0.14, v: -0.05, pose: POSE }).zone, '7 tremors sideways').toBeNull();
    expect(read(ms + 200, { h: 0.1, v: -0.05, pose: POSE }).zone).toBeNull();
    expect(read(ms + 300, { h: 0.1 + 0.18, v: -0.05, pose: POSE }).zone, '9 tremors sideways').toBe('left');
  });
});

describe('the rest follows and re-centres', () => {
  it('a slow drift is followed and commands nothing, but a real look still commands', () => {
    const read = lab({ followMs: 2000 });
    const { ms } = rest(read);
    let out = null;
    for (let i = 1; i <= 200; i++) out = read(ms + i * 100, { h: 0.1 + i * 0.00025, v: -0.05, pose: POSE });
    expect(out.zone).toBeNull(); expect(Math.abs(out.rest.h - 0.15)).toBeLessThan(0.02);
    expect(read(ms + 21000, { h: 0.45, v: -0.05, pose: POSE }).zone).toBe('left');
  });
  it('a gaze that walks away in steps smaller than the threshold still adds up to a command', () => {
    const read = lab();
    const { ms } = rest(read);
    const steps = [];
    for (let i = 1; i <= 6; i++) steps.push(read(ms + i * 100, { h: 0.1 - i * 0.025, v: -0.05, pose: POSE }));
    expect(steps[0].zone).toBeNull(); expect(steps[5].zone).toBe('right');
  });
  it('a zone held through a whole cycle stays held: the rest does not creep towards a commanding gaze', () => {
    const read = lab();
    const { ms } = rest(read);
    let out = null;
    for (let i = 1; i <= 40; i++) out = read(ms + i * 100, { h: 0.1, v: 0.3, pose: POSE });
    expect(out.zone).toBe('down'); expect(out.strength).toBeGreaterThan(15); expect(Math.abs(out.rest.v + 0.05)).toBeLessThan(0.01);
  });
  it('a gaze parked past parkedMs re-centres the rest and the zone lets go; from the new middle a look still commands', () => {
    const read = lab({ parkedFollowMs: 1500 });
    const { ms } = rest(read);
    let out = null;
    for (let i = 1; i <= 45; i++) out = read(ms + i * 100, { h: 0.1, v: 0.3 + jitter(i) / 4, pose: POSE });
    expect(out.zone).toBe('down');
    for (let i = 46; i <= 110; i++) out = read(ms + i * 100, { h: 0.1, v: 0.3 + jitter(i) / 4, pose: POSE });
    expect(out.zone).toBeNull(); expect(out.parked).toBe(true); expect(out.reason).toBe('recentring');
    expect(Math.abs(out.rest.v - 0.3)).toBeLessThan(0.03);
    expect(read(ms + 12000, { h: 0.1, v: 0.1, pose: POSE }).zone).toBe('up');
  });
  it('a gaze that keeps moving inside a zone is not parked, and the zone stays', () => {
    const read = lab();
    const { ms } = rest(read);
    let out = null;
    for (let i = 1; i <= 120; i++) out = read(ms + i * 100, { h: 0.1, v: 0.32 + Math.sin(i / 2) * 0.08, pose: POSE });
    expect(out.zone).toBe('down'); expect(out.parked).toBe(false);
  });
  it('a gaze that keeps making excursions is not parked, however much time it spends in the middle', () => {
    const read = lab();
    let { ms } = rest(read), out = null;
    for (let k = 0; k < 12; k++) {
      for (let i = 0; i < 6; i++, ms += 100) out = read(ms, { h: 0.1, v: -0.05, pose: POSE });
      for (let i = 0; i < 4; i++, ms += 100) out = read(ms, { h: 0.3, v: -0.05, pose: POSE });
    }
    expect(out.parked).toBe(false); expect(Math.abs(out.rest.h - 0.1)).toBeLessThan(0.02);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-relative.py`:
//   · the stretch not restarted on a moving gaze                       → «never becomes a rest»
//   · the tremor floor dropped                                         → «tremor is the floor»
//   · the MAD not scaled (× 1)                                         → «its own spread»
//   · the exit hysteresis dropped (always the entry threshold)          → «holds with less than it took»
//   · the axis hysteresis dropped                                      → «between two zones»
//   · the held axis kept even under the exit                           → «an axis under the exit»
//   · the sides not scaled                                             → «same four tremors», «same units»
//   · the head turn not refused                                        → «head turned fast»
//   · parked measured by the MAD instead of the range                  → «keeps making excursions»
//   · parked never re-centres                                          → «parked past parkedMs»
//   · the rest follows even while a zone is held                       → «stays held»
//   · the follow instant (k = 1)                                       → «walks away in steps»
//   · defaults 4/8 swapped                                             → «engine defaults»
