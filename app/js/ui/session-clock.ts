// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/session-clock — the SESSION CLOCK the engine mounts in the centre of the HUD row at the bottom (ADR-0239, ADR-0236;
// issue #94): a small label over the time left in digits, and the Time Timer pie to their right.
//
// The pie empties continuously over the session's length — green on a white face (ADR-0050 §3), drawn by the stylesheet
// from `--left`, the share still to go. The digits count down in ONE format for the whole session (`core/session-clock`
// `clockFormat`), so they never change unit as a warning. When the length runs out the pie turns red: a full red disc where
// an almost empty white one was, so the end is told by more than colour (WCAG 1.4.1).
//
// 📌 FOR A LISTENER: the clock is ONE `role="img"` with a name in words («Play time: 45 minutes left»), rewritten only when
// the whole minute changes — its label and digits are the picture, not text read out every second. It is STATE, consulted and
// not announced, so there is no live region on it. The ONE thing said aloud is the end, once, because a child who cannot see
// the pie turn red has no other way to learn it.
//
// 📌 THE TIME IS THE ROOT'S (ADR-0232): the clock and the one-second tick arrive as ports, and so do the options, read LIVE on
// every tick — an adult's new length applies within a second, with no event to wire.
import type { Translate } from '../core/i18n.js';
import {
  readSession, clockLook, clockWords, clockFormat, clockDigits, type SessionEnding, type ClockLook,
} from '../core/session-clock.js';

/**
 * What the clock needs, all lent by the root. The three host ports are REQUIRED and may carry `undefined` — a host without
 * them is answered here, not with a branch in the root (ADR-0232 erratum of 2026-09-25): with no clock or no tick there is no
 * session to measure, and nothing is mounted, silently, as a capability of the environment (ADR-0169).
 */
export interface SessionClockCtx {
  readonly doc: Document;
  /** Where the clock goes: the HUD row's centre cell. Absent, or a node that takes no children, and nothing is mounted. */
  readonly slot: HTMLElement | null;
  readonly t: Translate;
  /** The host's `performance`, milliseconds and monotonic. The session starts at the mount. */
  readonly performance: { now(): number } | undefined;
  readonly setInterval: ((fn: () => void, ms: number) => number) | undefined;
  readonly clearInterval: ((handle: number) => void) | undefined;
  /** The store's live values. */
  readonly minutes: () => number;
  readonly ending: () => SessionEnding;
  /** `prefers-reduced-motion`, asked at every tick so a change with the game open is followed. */
  readonly systemReducedMotion: () => boolean;
  /** The engine's own reduced-motion switches (`ui/motion-scene`'s live flags): any one of them on stops the pulse. */
  readonly sceneMotion: Readonly<Record<string, boolean>>;
  /** The polite announcer: said once, when the length runs out. */
  readonly announce: (text: string) => void;
  /** Called after every redraw, so the root can measure the row again when the clock's size changed. */
  readonly drawn: () => void;
}

export interface SessionClockMounted {
  readonly el: HTMLElement;
  /** Reads the time again and redraws what changed (the tick calls it; a language change too). */
  refresh(): void;
  /** Stops the tick and takes the clock off the page. */
  remove(): void;
}

/** One tick a second: the digits move by the second, and a 60-minute pie by a tenth of a degree, which reads as continuous. */
const TICK_MS = 1000;

/** Writes `text` into `node` only when it changed — a rewrite is a repaint, and on school hardware a repaint costs. */
function write(node: Element, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

/** Builds the clock's three parts: the label and the digits in a column, the pie to their right. */
function build(doc: Document): { el: HTMLElement; label: HTMLElement; digits: HTMLElement; pie: HTMLElement } {
  const part = (cls: string): HTMLElement => { const n = doc.createElement('span'); n.className = cls; return n; };
  const el = doc.createElement('div');
  el.className = 'session-clock';
  el.setAttribute('role', 'img');
  const text = part('session-clock-text');
  const label = part('session-clock-label');
  const digits = part('session-clock-digits');
  const pie = part('session-clock-pie');
  text.append(label, digits);
  el.append(text, pie);
  return { el, label, digits, pie };
}

/** Mounts the clock in its slot, draws it now, and redraws it every second until `remove()`; `null` where it cannot. */
export function mountSessionClock(ctx: SessionClockCtx): SessionClockMounted | null {
  const { slot, performance: clock, setInterval: every } = ctx;
  if (!slot || typeof slot.appendChild !== 'function' || !clock || typeof every !== 'function') return null;
  const { el, label, digits, pie } = build(ctx.doc);
  slot.appendChild(el);
  const timer: { now(): number } = clock; // the guard's answer, kept for the tick
  const start = timer.now();
  const format = clockFormat(ctx.minutes()); // ONCE per session: the digits never change unit (ADR-0239)
  let look: ClockLook | null = null;

  function refresh(): void {
    const reading = readSession(timer.now() - start, ctx.minutes());
    const reduced = ctx.systemReducedMotion() || Object.values(ctx.sceneMotion).some(Boolean);
    const next = clockLook(reading, ctx.ending(), reduced);
    pie.style.setProperty('--left', reading.left.toFixed(4));
    write(label, ctx.t('clock.label'));
    write(digits, clockDigits(reading.leftMs, format));
    const words = clockWords(reading);
    const name = ctx.t(words.key, { minutes: words.minutes });
    if (el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
    if (next !== 'running' && look === 'running') ctx.announce(name);
    if (next !== look) el.dataset.look = next;
    look = next;
    ctx.drawn();
  }

  refresh();
  const handle = every(refresh, TICK_MS);
  return {
    el,
    refresh,
    remove: () => { ctx.clearInterval?.(handle); el.remove(); },
  };
}
