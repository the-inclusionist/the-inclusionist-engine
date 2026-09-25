// SPDX-License-Identifier: AGPL-3.0-or-later
// core/session-clock.ts — what the SESSION CLOCK reads, with no browser (ADR-0236, ADR-0240, ADR-0050 §3; issue #94).
//
// The clock is a Time Timer: a disc that empties continuously over ONE HOUR, beside the time left in digits (ADR-0239) — never
// numbers only, and the digits never change unit as a warning. It measures the SESSION, never an activity (ADR-0050 §3,
// ADR-0048 §7b): nothing here knows a question, a round or a game.
//
// 📌 THE HOUR IS FIXED, AND NOTHING ABOUT IT IS A SETTING (ADR-0240): the clock always shows, always measures one hour, and at the
// end it turns red. What limits the child's session is the adult's to set, on the adult's surface — Bússola Escolar's menu,
// which the student cannot reach — so the engine keeps no length and no ending in the child's settings or storage.
//
// 📌 A STATELESS MODULE (ADR-0232): the hour and the arithmetic. The root measures the time, `ui/session-clock` draws.

const MINUTE_MS = 60_000;

/** The session: one hour, the Time Timer's whole disc (ADR-0240). */
const SESSION_MS = 60 * MINUTE_MS;

/**
 * Where the session stands: the share of the disc left (1 → 0), the milliseconds and whole minutes left (rounded UP), and
 * whether it is over.
 */
export interface SessionReading {
  readonly left: number;
  readonly leftMs: number;
  readonly minutesLeft: number;
  readonly over: boolean;
}

/**
 * The time left as digits, whole seconds rounded UP — the last second reads «00:01», never «00:00» early. Hours show only while
 * there are hours (`1:00:00`, then `59:59`): the Dev, «Se não houver horas, não coloque 0: no começo» (ADR-0239 errata).
 */
export function clockDigits(leftMs: number): string {
  const total = Math.ceil(Math.max(0, leftMs) / 1000);
  const two = (n: number): string => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const minutesAndSeconds = `${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
  return hours > 0 ? `${hours}:${minutesAndSeconds}` : minutesAndSeconds;
}

/** Reads the session `elapsedMs` after it started. The disc never goes below empty nor above full. */
export function readSession(elapsedMs: number): SessionReading {
  const leftMs = Math.min(SESSION_MS, Math.max(0, SESSION_MS - elapsedMs));
  return { left: leftMs / SESSION_MS, leftMs, minutesLeft: Math.ceil(leftMs / MINUTE_MS), over: leftMs === 0 };
}

/** The dictionary key and the minutes for the clock's accessible name — words a screen reader says, never a `H:MM`. */
export function clockWords(reading: SessionReading): { readonly key: string; readonly minutes: number } {
  if (reading.over) return { key: 'clock.over', minutes: 0 };
  return { key: reading.minutesLeft === 1 ? 'clock.left.one' : 'clock.left', minutes: reading.minutesLeft };
}
