// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CAMERA'S FRAME LOOP CANNOT STOP IN SILENCE (ADR-0213; issue #196). The browser's frame callback, clock and timer are injected, so
// frames arrive exactly when a case says.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createVisionLoop } from '../app/js/platform/vision-loop.js';

/** A fake browser: `frames(n, gapMs)` delivers n frames, `wait(ms)` lets time pass without frames. Timers fire as time passes. */
const fakeBrowser = () => {
  let t = 0, nextId = 1, pending = new Map(), timers = new Map();
  const advance = (to) => {
    for (const tm of timers.values()) while (tm.due <= to) { t = tm.due; tm.due += tm.ms; tm.cb(); }
    t = to;
  };
  return {
    deps: {
      requestFrame: (cb) => { const id = nextId++; pending.set(id, cb); return id; },
      cancelFrame: (id) => pending.delete(id),
      now: () => t,
      every: (cb, ms) => { const id = nextId++; timers.set(id, { cb, ms, due: t + ms }); return id; },
      stopEvery: (id) => timers.delete(id),
    },
    frames(n, gapMs) {
      for (let i = 0; i < n; i++) {
        advance(t + gapMs);
        const due = [...pending.entries()]; pending = new Map();
        for (const [, cb] of due) cb(t);
      }
    },
    wait(ms) { advance(t + ms); },
    pending: () => pending.size,
    timers: () => timers.size,
  };
};

describe('the frame loop', () => {
  it('calls onFrame on every frame', () => {
    const b = fakeBrowser(), seen = [];
    createVisionLoop(b.deps, { onFrame: (ms) => seen.push(ms) }).start();
    b.frames(3, 20);
    expect(seen).toEqual([20, 40, 60]);
  });
  it('a frame that throws is reported and the loop goes on', () => {
    const b = fakeBrowser(), errors = [];
    let n = 0;
    createVisionLoop(b.deps, { onFrame: () => { n++; throw new Error('boom'); }, onError: (e) => errors.push(e.message) }).start();
    b.frames(5, 20);
    expect(n).toBe(5); expect(errors).toHaveLength(5); expect(b.pending()).toBe(1);
  });
  it('stop books no more frames and stops the watchdog; start twice does not double the loop', () => {
    const b = fakeBrowser();
    let n = 0;
    const loop = createVisionLoop(b.deps, { onFrame: () => n++ });
    loop.start(); loop.start();
    b.frames(2, 20);
    expect(n).toBe(2);
    loop.stop();
    b.frames(3, 20);
    expect(n).toBe(2); expect(b.pending()).toBe(0); expect(b.timers()).toBe(0);
  });
});

describe('the watchdog, on its own clock', () => {
  it('stays ok at camera speed and says nothing', () => {
    const b = fakeBrowser(), said = [];
    createVisionLoop(b.deps, { onFrame: () => {}, onHealth: (h) => said.push(h) }).start();
    b.frames(100, 33);
    expect(said).toEqual([]);
  });
  it('says stalled when frames stop arriving, and ok when they come back', () => {
    const b = fakeBrowser(), said = [];
    const loop = createVisionLoop(b.deps, { onFrame: () => {}, onHealth: (h) => said.push(h) });
    loop.start();
    b.frames(40, 33);
    b.wait(1600);
    expect(loop.health()).toBe('stalled');
    b.frames(40, 33);
    expect(said).toEqual(['stalled', 'ok']);
  });
  it('says slow under the floor of frames a second, with the count', () => {
    const b = fakeBrowser(), said = [];
    createVisionLoop(b.deps, { onFrame: () => {}, onHealth: (h, fps) => said.push([h, fps]), floorFps: 8 }).start();
    b.frames(20, 500); // two frames a second, the rate of a hidden tab
    expect(said[0][0]).toBe('slow'); expect(said[0][1]).toBeLessThan(8);
  });
  it('a loop that dies right away is still reported — the watchdog does not ride on the frames', () => {
    const b = fakeBrowser(), said = [];
    createVisionLoop(b.deps, { onFrame: () => {}, onHealth: (h) => said.push(h) }).start();
    b.wait(2000);
    expect(said).toEqual(['stalled']);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-vision-loop.py`:
//   · the next frame booked after onFrame                              → «a frame that throws … goes on»
//   · the error rethrown instead of reported                           → «a frame that throws»
//   · stop not cancelling the frame                                    → «stop books no more frames»
//   · start not guarded                                                → «start twice»
//   · stall never detected                                             → «says stalled», «dies right away»
//   · slow never detected                                              → «says slow»
//   · health reported on every check instead of on change              → «says nothing», «ok when they come back»
//   · the rate judged at once after a stall (passes through «slow»)     → «ok when they come back»
