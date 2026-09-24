// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/loop-crash.ts — THE ANNOUNCEMENT THAT THE LOOP STOPPED. The other half of ADR-0054.
//
// `core/loop.startLoop` STOPS when a frame throws and calls its failure handler. This module builds that handler, and
// the composition root registers it with `core/loop.registerCrashNotice`, so every loop without an `onFailure` of its
// own announces the stop too.
//
// ⚠️ AND IT IS THE HALF THAT MATTERS. A frozen screen is a VISUAL symptom. In blind mode, a stopped game and a thinking
// game produce the same thing: silence. The child waits for a game that has already died, with nothing telling them to
// reload — and a console error is a notice they do not read.
//
// ⚠️ WHY A MODULE AND NOT A LINE INSIDE `createGame`: a shell that mounts the engine by hand and calls `startLoop`
// itself imports the same handler from here, instead of writing a second one.
//
// ⚠️ AND IT DOES NOT USE `srAlert` FROM `core/a11y-sr`, which is a choice and not an oversight:
//
//   · `srAlert` clears, waits one `requestAnimationFrame` and only then writes. That dance exists to force the reader
//     to RE-ANNOUNCE repeated text; a crash is announced once and never repeats, so it buys nothing here — and it
//     would make the notice depend on a future frame, at the instant frames stopped.
//   · `srAlert` searches the GLOBAL document. Whoever receives the document by injection (the engine, a test, a second
//     game on the same page) would lose the notice. The announcement that everything stopped is the last place that
//     should depend on a global search.
import { t } from '../core/i18n.js';

/** The id of the notice box. Stable because the stylesheet and the test look for it. */
const CRASH_NOTICE_ID = 'incl-parou';

export interface CrashNoticeCtx {
  /** `querySelector` of this game's document. Injected: the engine receives its own. */
  find: (sel: string) => HTMLElement | null;
  /** `document.createElement` — the notice box is a real element, not a pseudo-element. */
  create: (tag: string) => HTMLElement;
  /** The spoken narration, when the game has one. Absent = the written notice is enough. */
  narrate?: (text: string) => void;
}

/**
 * Builds the handler for `startLoop(ticker, frame, maxDt, { onFailure })` or for `registerCrashNotice`.
 *
 * THE ORDER OF THE CHANNELS IS DELIBERATE: the console FIRST, because whoever debugs must not lose the error if the DOM
 * is broken — and a broken DOM is one plausible reason the frame threw. Then the screen reader, which has no other clue
 * at all. The visible one last, because whoever sees it has already seen the screen stop.
 *
 * Each channel is isolated from the next: if narration throws, the written notice has already gone out. A notice that
 * fails halfway must deliver the other half — the same rule `startLoop` applies to this very callback.
 */
export function createCrashNotice(ctx: CrashNoticeCtx): (failure: unknown) => void {
  return (failure: unknown): void => {
    try { console.error('[inclusionist] the frame threw; the loop stopped.', failure); } catch { /* noop */ }

    const msg = t('sr.laco.parou');

    // The screen reader: assertive, because interrupting is exactly the point.
    const alert = ctx.find('#sr-alert');
    if (alert) alert.textContent = msg;

    try { ctx.narrate?.(msg); } catch { /* noop: narration failed; the written notice has already gone out */ }

    // THE VISIBLE ONE, and it is a REAL ELEMENT — not a pseudo-element, for two reasons:
    //
    // ⚠️ the region's `::after` and `::before` are already taken by the CRT scanlines and the vignette, and an element
    // has ONE of each — a notice there competes for an occupied place and loses;
    //
    // ⚠️ and `content` text does not reliably enter the accessibility tree. The notice that the game died is exactly
    // what cannot depend on that.
    //
    // The sentence comes from `t()` and goes in through `textContent`, so it arrives translated and escaped.
    const region = ctx.find('#game-region');
    if (!region) return;
    const previous = ctx.find('#' + CRASH_NOTICE_ID);
    const notice = previous ?? ctx.create('div');
    notice.id = CRASH_NOTICE_ID;
    notice.setAttribute('role', 'alert');
    notice.textContent = msg;
    if (!previous) region.appendChild(notice);
  };
}
