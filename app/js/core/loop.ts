// SPDX-License-Identifier: AGPL-3.0-or-later
// core/loop.ts — the game loop driver. Registers the frame function on a "ticker" (PixiJS's app.ticker, or any object
// with .add(fn) and .deltaTime) and passes a CLAMPED dt (no giant jump after the tab was in the background). A leaf
// module. It keeps the CURRENT cadence — a deterministic fixed timestep would change the physics, so it waits.
//
// ========================= THE ERROR BOUNDARY (D16), AND WHY IT FAILS LOUD =========================
// Without it, a frame that throws throws AGAIN on the next frame, forever: a frozen screen, a full console, and nothing
// on screen saying what happened. The `demos` spec asks for it by scale — "across 383 games, one bad game has to be
// distinguishable from a broken engine". The reason here is more urgent: **a blind child does not see a frozen
// screen.** Without an announcement, blind mode cannot tell "it froze" from "it is thinking".
//
// ⚠️ AND THE TEMPTATION IS THE OPPOSITE OF THE FIX. `try { frame() } catch { /* carry on */ }` is worse than the defect:
// it becomes a silently wrong game, computing garbage forever. The rule is the one ADR-0047 applied to the CRT — catch
// ONCE, STOP, and ANNOUNCE.

type Ticker = { add: (fn: () => void) => void; deltaTime: number; remove?: (fn: () => void) => void };

export interface LoopOptions {
  /**
   * THE GAME SPEED the child chose (ADR-0180): 1 is 100%, down to 0.5. Read EACH FRAME, so a change is felt on the next
   * one. A game beside `createGame` passes `engine.gameSpeed`; a game that is its own root passes
   * `() => state.gameSpeed`.
   *
   * 🔴 REQUIRED (ADR-0232 D2c erratum; ADR-0224/0227's precedent): the loop no longer reads the settings store by import,
   * and an optional port defaulting to 100% would ignore the child's choice in every game that forgot it — silently.
   */
  speed: () => number;
  /**
   * Called ONCE, with the error, when the frame throws. It is the channel of whoever cannot see the screen stop.
   *
   * The composition root wires it to `srAlert` and a visible message. Optional on purpose: a consumer that mounts the
   * loop without a shell (a test, the quiz) still stops — the announcement is optional, **stopping is not**.
   */
  onFailure?: (failure: unknown) => void;
}

/**
 * THE NOTICE A LOOP USES WHEN ITS CALLER PASSED NONE (study item D1; ADR-0054: «stops the loop and says so»).
 * 📏 Measured on 2026-09-13: a game called `startLoop` without a failure notice, so its frame would stop in silence — the
 * announcement depended on each game remembering it. `createGame` registers its own notice here and withdraws it on
 * `unmount`; a caller's own `onFailure` still wins. The same shape as `registerKeyboardMapping`.
 */
let registeredNotice: ((failure: unknown) => void) | null = null;
export function registerCrashNotice(notice: ((failure: unknown) => void) | null): void { registeredNotice = notice; }

export function startLoop(ticker: Ticker, frame: (dt: number) => void, maxDt = 2, options: LoopOptions): void {
  let stopped = false;
  const step = (): void => {
    if (stopped) return; // a ticker without `remove` cannot unregister — this latch is what stops the loop anyway
    try {
      // the game speed (ADR-0180) applies to the clamped time, read each frame: a change is felt on the next one
      frame(Math.min(ticker.deltaTime, maxDt) * options.speed());
    } catch (failure) {
      stopped = true;
      ticker.remove?.(step); // leave the ticker when possible: a callback running 60×/s for nothing costs on weak hardware
      // The announcement must not revive the problem. If the notice itself breaks — no screen reader, no DOM — an
      // exception here would be invisible inside the ticker again, which is exactly the defect this closes.
      // read at the throw, not at the start: a root mounted after the loop began still announces it
      try { (options.onFailure ?? registeredNotice)?.(failure); } catch { /* noop: the notice failed; the loop already stopped, which is what matters */ }
    }
  };
  ticker.add(step);
}
