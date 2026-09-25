// SPDX-License-Identifier: AGPL-3.0-or-later
// core/session-clock.ts — what the SESSION CLOCK reads, with no browser (ADR-0236, ADR-0050 §3; issue #94).
//
// The clock is a Time Timer: a disc that empties continuously over the session's length, beside the time left in digits
// (ADR-0239) — never numbers only, and the digits keep ONE format for the whole session, so they never change unit as a
// warning. It measures the SESSION, never an activity (ADR-0050 §3, ADR-0048 §7b): nothing here knows a question, a round
// or a game.
//
// Two stored options, both with a default that always applies until an adult sets one (ADR-0236 erratum of 2026-09-25):
//   · the LENGTH, in whole minutes — 60 by default (`core/setting-defaults`);
//   · the ENDING — what the clock does when the length runs out: turn red (the default), turn red and pulse gently, or lock
//     the screen.
//
// 📌 A STATELESS MODULE (ADR-0232): the vocabulary, the sanitisers and the arithmetic. The store keeps the values
// (`core/state`), the root measures the time, `ui/session-clock` draws.

/** What the clock does at the end of the length (ADR-0236 erratum): red · red pulsing gently · screen lock. */
export type SessionEnding = 'red' | 'pulse' | 'lock';
const ENDINGS: readonly SessionEnding[] = ['red', 'pulse', 'lock'];

/** What the clock SHOWS: the disc while time is left, and at the end plain red or red pulsing gently. */
export type ClockLook = 'running' | 'red' | 'pulse';

const MINUTE_MS = 60_000;

// 📌 THE FALLBACKS ARRIVE AS PARAMETERS: what a default IS lives in `core/setting-defaults` alone (ADR-0029), and the store
// passes it; a second copy here is the divergence that table exists to prevent.

/** A stored or written ending; anything that is not one of the three reads as `fallback`. */
export function toSessionEnding(v: unknown, fallback: SessionEnding): SessionEnding {
  return ENDINGS.includes(v as SessionEnding) ? v as SessionEnding : fallback;
}

/** A length in WHOLE minutes, at least one; anything else — corrupted storage, a caller's NaN — reads as `fallback`. */
export function toSessionMinutes(v: number, fallback: number): number {
  const minutes = Math.round(v);
  return Number.isFinite(minutes) && minutes >= 1 ? minutes : fallback;
}

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

/**
 * Reads the session after `elapsedMs` of a `minutes`-long length (the store's value, already whole and at least one). The disc
 * never goes below empty nor above full.
 */
export function readSession(elapsedMs: number, minutes: number): SessionReading {
  const total = minutes * MINUTE_MS;
  const leftMs = Math.min(total, Math.max(0, total - elapsedMs));
  return { left: leftMs / total, leftMs, minutesLeft: Math.ceil(leftMs / MINUTE_MS), over: leftMs === 0 };
}

/**
 * What the clock shows. At the end, `pulse` pulses only where motion is welcome; under reduced motion it is plain red.
 *
 * ⚠️ `lock` SHOWS RED, and it is not an oversight: ADR-0050 §4 says a lock is lifted only by an adult's command, and no record
 * says how an adult commands it when none is logged in — there is no adult login here yet. A lock with no way out would shut a
 * child out of the machine until the page is reloaded, so the option is STORED and the screen is NOT locked; the root reports
 * it in `problems` (`sessionEndingProblems`).
 */
export function clockLook(reading: SessionReading, ending: SessionEnding, reducedMotion: boolean): ClockLook {
  if (!reading.over) return 'running';
  return ending === 'pulse' && !reducedMotion ? 'pulse' : 'red';
}

/** The dictionary key and the minutes for the clock's accessible name — words a screen reader says, never a `H:MM`. */
export function clockWords(reading: SessionReading): { readonly key: string; readonly minutes: number } {
  if (reading.over) return { key: 'clock.over', minutes: 0 };
  return { key: reading.minutesLeft === 1 ? 'clock.left.one' : 'clock.left', minutes: reading.minutesLeft };
}

/** The `problems` line for an ending that is stored but not built (see `clockLook`). */
export function sessionEndingProblems(ending: SessionEnding): string[] {
  if (ending !== 'lock') return [];
  return ["the session ending is set to 'lock', and nothing in the records says how an adult lifts a lock while none is logged "
    + 'in (ADR-0050 point 4): the screen is NOT locked and the clock only turns red, so a child is never shut out '
    + "— the lock is built once the adult's command is decided (issue #94)"];
}
