// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SESSION CLOCK IS A TIME TIMER OF ONE HOUR (ADR-0236, ADR-0240; ADR-0050 §3; issue #94) — what it reads, with no browser.
//
// The decisions under test: the session is one hour, always — nothing on the child's side sets its length or its ending, and
// nothing about it is stored (ADR-0240); the disc empties continuously; the digits show hours only while there are hours; the
// name a screen reader hears is words, rewritten by the whole minute.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readSession, clockWords, clockDigits } from '../app/js/core/session-clock.js';
import { fiveDigits } from '../app/js/ui/hud-bands.js';
import { DEFAULTS } from '../app/js/core/setting-defaults.js';
import { createSettingsStore } from '../app/js/core/state.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

const MIN = 60_000;

describe('one hour, and nothing about it is a setting (ADR-0240)', () => {
  it('🔴 [Right] the session is ONE HOUR: full at the start, still running a second before sixty minutes, over at sixty', () => {
    expect(readSession(0)).toEqual({ left: 1, leftMs: 60 * MIN, minutesLeft: 60, over: false });
    expect(readSession(60 * MIN - 1000).over).toBe(false);
    expect(readSession(60 * MIN)).toEqual({ left: 0, leftMs: 0, minutesLeft: 0, over: true });
  });

  it('🔴 [Zero] the child\'s side keeps nothing of the clock: no default, no storage key, no store member, no writer', () => {
    expect(Object.keys(DEFAULTS).filter((k) => /session/i.test(k)), 'a default for the clock is a setting').toEqual([]);
    const keys = Object.entries(KEYS).filter(([k, v]) => /session/i.test(k) || (typeof v === 'string' && /^incl_session/.test(v)));
    expect(keys, 'a storage key for the clock').toEqual([]);
    const backend = memoryBackend([['incl_session_minutes', '45'], ['incl_session_ending', 'lock']]);
    const store = createStorage(backend);
    const state = createSettingsStore({ ...store, KEYS });
    expect(Object.keys(state).filter((k) => /session/i.test(k)), 'the settings store reads or writes the clock').toEqual([]);
  });
});

describe('the disc empties continuously, and never below empty', () => {
  it('🔴 [Right] half at half the hour, and past the end it stays empty', () => {
    expect(readSession(30 * MIN).left).toBeCloseTo(0.5, 6);
    expect(readSession(90 * MIN), 'past the end the disc went negative').toEqual({ left: 0, leftMs: 0, minutesLeft: 0, over: true });
  });

  it('🔴 [Right] CONTINUOUS — one second moves the disc, not only a whole minute', () => {
    const a = readSession(10 * MIN).left;
    const b = readSession(10 * MIN + 1000).left;
    expect(b, 'a second passed and the disc stood still').toBeLessThan(a);
  });

  it('🔴 [Boundary] the minutes left round UP: a second before the end is still «1 minute», not «0»', () => {
    expect(readSession(60 * MIN - 1000).minutesLeft).toBe(1);
    expect(readSession(1).minutesLeft, 'a millisecond in, the name dropped to 59').toBe(60);
  });
});

describe('the digits: hours only while there are hours (ADR-0239 errata — «Se não houver horas, não coloque 0: no começo»)', () => {
  it('🔴 [Right] an hour or more reads H:MM:SS; under an hour, MM:SS with no «0:» in front', () => {
    expect(clockDigits(60 * MIN)).toBe('1:00:00');
    expect(clockDigits(75 * MIN)).toBe('1:15:00');
    expect(clockDigits(45 * MIN)).toBe('45:00');
    expect(clockDigits(3 * MIN + 7000)).toBe('03:07');
  });

  it('🔴 [Boundary] the hour drops exactly when the last hour runs out: 1:00:00, then 59:59', () => {
    expect(clockDigits(60 * MIN)).toBe('1:00:00');
    expect(clockDigits(60 * MIN - 1000)).toBe('59:59');
    expect(clockDigits(60 * MIN - 1000)).not.toMatch(/^0:/);
  });

  it('🔴 [Boundary] whole seconds rounded UP — the last second is not «0» early — and never below zero', () => {
    expect(clockDigits(1)).toBe('00:01');
    expect(clockDigits(999)).toBe('00:01');
    expect(clockDigits(0)).toBe('00:00');
    expect(clockDigits(-5000)).toBe('00:00');
  });
});

describe('the score: five digits with leading zeros (ADR-0238)', () => {
  it('🔴 [Right] 12 is 00012, and the number said is 12', () => {
    expect(fiveDigits(12)).toEqual({ digits: '00012', shown: 12 });
    expect(fiveDigits(0)).toEqual({ digits: '00000', shown: 0 });
  });

  it('🔴 [Boundary] clamped at 99999 — no sixth digit — and at zero; a fraction and a NaN are not digits', () => {
    expect(fiveDigits(99_999)).toEqual({ digits: '99999', shown: 99_999 });
    expect(fiveDigits(100_000)).toEqual({ digits: '99999', shown: 99_999 });
    expect(fiveDigits(-1)).toEqual({ digits: '00000', shown: 0 });
    expect(fiveDigits(7.9)).toEqual({ digits: '00007', shown: 7 });
    expect(fiveDigits(Number.NaN)).toEqual({ digits: '00000', shown: 0 });
  });
});

describe('the name a screen reader hears', () => {
  it('🔴 [Right] minutes in words, the singular at one, and the end', () => {
    expect(clockWords(readSession(0))).toEqual({ key: 'clock.left', minutes: 60 });
    expect(clockWords(readSession(59 * MIN + 1))).toEqual({ key: 'clock.left.one', minutes: 1 });
    expect(clockWords(readSession(60 * MIN))).toEqual({ key: 'clock.over', minutes: 0 });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each applied to the code, seen RED here, and undone (the results are in the commits that brought and changed this file):
//   M4 readSession without the `Math.max(0, …)` floor                      🔴 past the end
//   M5 minutesLeft with Math.floor                                        🔴 [Boundary]
//   M9 clockDigits always drawing the hour («0:59:59»)                  🔴 hours only while there are hours (3 cases)
//   N1 the session 50 minutes instead of 60                                🔴 the session is ONE HOUR
//   N2 `sessionMinutes: 'incl_session_minutes'` back in KEYS               🔴 the child's side keeps nothing
//   N3 `sessionMinutes: 60` back in DEFAULTS                               🔴 the child's side keeps nothing
//   N4 a `sessionMinutes` getter back in the settings store                🔴 the child's side keeps nothing
