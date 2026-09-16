// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vision-loop — THE CAMERA'S FRAME LOOP, WHICH CANNOT STOP IN SILENCE (ADR-0213; issue #196).
//
// · The next frame is booked BEFORE anything that could throw. The lab's loop booked it at the end, one item threw on every frame, and the
//   eye control stopped on its first frame with nothing on screen saying so — every measurement taken after that was of a stopped page.
// · A frame that throws is handed to `onError` and the loop goes on.
// · A watchdog on its OWN clock (a stopped loop cannot report itself) says whether frames are arriving: `stalled` when none came for
//   `stallMs`, `slow` under `floorFps` in the last second, `ok` otherwise. A reading taken while it is not `ok` is not a reading, and the
//   child must be told, not left gazing at a control that no longer listens. It reports on change only.

export type LoopHealth = 'ok' | 'slow' | 'stalled';

export interface VisionLoopDeps {
  readonly requestFrame: (cb: (ms: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly now: () => number;
  readonly every: (cb: () => void, ms: number) => number;
  readonly stopEvery: (handle: number) => void;
}

export interface VisionLoopOptions {
  readonly onFrame: (ms: number) => void;
  readonly onError?: (error: unknown) => void;
  readonly onHealth?: (health: LoopHealth, framesPerSecond: number) => void;
  readonly floorFps?: number;
  readonly stallMs?: number;
  readonly watchMs?: number;
}

export interface VisionLoop {
  start(): void;
  stop(): void;
  health(): LoopHealth;
}

export function createVisionLoop(deps: VisionLoopDeps, { onFrame, onError = () => {}, onHealth = () => {}, floorFps = 8, stallMs = 1000, watchMs = 500 }: VisionLoopOptions): VisionLoop {
  let frame: number | null = null, watch: number | null = null, health: LoopHealth = 'ok', startedAt = 0;
  const times: number[] = [];

  const tick = (ms: number): void => {
    frame = deps.requestFrame(tick);
    times.push(deps.now());
    try { onFrame(ms); } catch (e) { onError(e); }
  };
  const check = (): void => {
    const now = deps.now();
    while (times.length && now - times[0]! > 1000) times.shift();
    const last = times.at(-1) ?? startedAt;
    if (health === 'stalled' && now - last < stallMs) startedAt = now; // back from a stall: judge the rate on a full second of the new frames
    const next: LoopHealth = now - last >= stallMs ? 'stalled' : now - startedAt >= 1000 && times.length < floorFps ? 'slow' : 'ok';
    if (next !== health) { health = next; onHealth(health, times.length); }
  };
  return {
    start() {
      if (frame !== null) return;
      startedAt = deps.now(); health = 'ok'; times.length = 0;
      frame = deps.requestFrame(tick);
      watch = deps.every(check, watchMs);
    },
    stop() {
      if (frame !== null) deps.cancelFrame(frame);
      if (watch !== null) deps.stopEvery(watch);
      frame = null; watch = null;
    },
    health: () => health,
  };
}
