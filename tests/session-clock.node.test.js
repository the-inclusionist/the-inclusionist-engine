// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SESSION CLOCK IS A TIME TIMER (ADR-0236 and its erratum of 2026-09-25; ADR-0050 §3; issue #94) — what it reads, with no
// browser, and the two stored options it reads from.
//
// The decisions under test: an hour by default, and at the end the clock turns red — the screen does not lock; the ending is
// an option (red · red pulsing gently · lock); the pulse never runs under reduced motion; the disc empties continuously and
// the name a screen reader hears is words, rewritten by the whole minute.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  readSession, clockLook, clockWords, clockFormat, clockDigits, toSessionMinutes, toSessionEnding, sessionEndingProblems,
} from '../app/js/core/session-clock.js';
import { DEFAULTS } from '../app/js/core/setting-defaults.js';
import { createSettingsStore } from '../app/js/core/state.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

const MIN = 60_000;
/** A store of its own over a backend this case filled (ADR-0232 D4). */
function storeWith(entries = {}) {
  const backend = memoryBackend();
  for (const [k, v] of Object.entries(entries)) backend.setItem(k, v);
  const store = createStorage(backend);
  return { store, state: createSettingsStore({ ...store, KEYS }) };
}

describe('the defaults, when no adult has set a value (ADR-0236 erratum)', () => {
  it('🔴 [Right] a session is an hour, and its end turns the clock red', () => {
    expect(DEFAULTS.sessionMinutes).toBe(60);
    expect(DEFAULTS.sessionEnding).toBe('red');
    const { state } = storeWith();
    expect(state.sessionMinutes, 'an empty store does not read as an hour').toBe(60);
    expect(state.sessionEnding, 'an empty store does not end in red').toBe('red');
  });
});

describe('the two options are stored settings with writers', () => {
  it('🔴 [Right] each is read back from what was stored', () => {
    const { state } = storeWith({ [KEYS.sessionMinutes]: '45', [KEYS.sessionEnding]: 'pulse' });
    expect(state.sessionMinutes).toBe(45);
    expect(state.sessionEnding).toBe('pulse');
  });

  it('🔴 [Right] each writer persists under its `incl_*` key and tells its event', () => {
    const { store, state } = storeWith();
    const heard = [];
    state.on('sessionMinutes', (v) => heard.push(['sessionMinutes', v]));
    state.on('sessionEnding', (v) => heard.push(['sessionEnding', v]));
    state.setSessionMinutesValue(30);
    state.setSessionEndingValue('lock');
    expect(store.getNum('incl_session_minutes')).toBe(30);
    expect(store.get('incl_session_ending', null)).toBe('lock');
    expect(heard).toEqual([['sessionMinutes', 30], ['sessionEnding', 'lock']]);
  });

  it('🔴 [Range] corrupted storage and a caller\'s nonsense read as the default, never as a zero-minute session', () => {
    for (const bad of ['0', '-5', 'abc', 'NaN']) {
      expect(storeWith({ [KEYS.sessionMinutes]: bad }).state.sessionMinutes, `stored «${bad}»`).toBe(60);
    }
    expect(storeWith({ [KEYS.sessionEnding]: 'explode' }).state.sessionEnding).toBe('red');
    const { state } = storeWith();
    state.setSessionMinutesValue(20);
    state.setSessionMinutesValue(Number.NaN);
    expect(state.sessionMinutes, 'a NaN written became the length').toBe(60);
    expect(toSessionMinutes(12.4, 60), 'a length is whole minutes').toBe(12);
    expect(toSessionMinutes(0.4, 60), 'rounded to zero, it is no length at all').toBe(60);
    expect(toSessionEnding('lock', 'red')).toBe('lock');
    expect(toSessionEnding(undefined, 'red')).toBe('red');
  });
});

describe('the disc empties continuously, and never below empty', () => {
  it('🔴 [Right] full at the start, half at half the length, empty and over at the end', () => {
    expect(readSession(0, 60)).toEqual({ left: 1, leftMs: 60 * MIN, minutesLeft: 60, over: false });
    expect(readSession(30 * MIN, 60).left).toBeCloseTo(0.5, 6);
    expect(readSession(60 * MIN, 60)).toEqual({ left: 0, leftMs: 0, minutesLeft: 0, over: true });
    expect(readSession(90 * MIN, 60), 'past the end the disc went negative').toEqual({ left: 0, leftMs: 0, minutesLeft: 0, over: true });
  });

  it('🔴 [Right] CONTINUOUS — one second moves the disc, not only a whole minute', () => {
    const a = readSession(10 * MIN, 60).left;
    const b = readSession(10 * MIN + 1000, 60).left;
    expect(b, 'a second passed and the disc stood still').toBeLessThan(a);
  });

  it('🔴 [Boundary] the minutes left round UP: a second before the end is still «1 minute», not «0»', () => {
    expect(readSession(60 * MIN - 1000, 60).minutesLeft).toBe(1);
    expect(readSession(1, 60).minutesLeft, 'a millisecond in, the name dropped to 59').toBe(60);
    expect(readSession(60 * MIN - 1000, 60).over).toBe(false);
  });

  it('🔴 [Cross-check] a longer length, the same elapsed time: more disc left', () => {
    expect(readSession(20 * MIN, 90).left).toBeGreaterThan(readSession(20 * MIN, 60).left);
  });
});

describe('the digits: one format for the whole session (ADR-0239, ADR-0236)', () => {
  it('🔴 [Right] an hour or more reads H:MM:SS; less reads MM:SS', () => {
    expect(clockFormat(60)).toBe('hms');
    expect(clockFormat(90)).toBe('hms');
    expect(clockFormat(59)).toBe('ms');
    expect(clockDigits(60 * MIN, 'hms')).toBe('1:00:00');
    expect(clockDigits(45 * MIN, 'ms')).toBe('45:00');
    expect(clockDigits(3 * MIN + 7000, 'hms')).toBe('0:03:07');
  });

  it('🔴 [Right] a format never changes unit on its own: MM:SS past an hour, H:MM:SS under a minute', () => {
    expect(clockDigits(75 * MIN, 'ms'), 'MM:SS switched to hours').toBe('75:00');
    expect(clockDigits(30_000, 'hms'), 'H:MM:SS dropped its hours near the end').toBe('0:00:30');
  });

  it('🔴 [Boundary] whole seconds rounded UP — the last second is not «0» early — and never below zero', () => {
    expect(clockDigits(1, 'ms')).toBe('00:01');
    expect(clockDigits(999, 'hms')).toBe('0:00:01');
    expect(clockDigits(0, 'ms')).toBe('00:00');
    expect(clockDigits(-5000, 'hms')).toBe('0:00:00');
  });
});

describe('what the clock shows at the end', () => {
  const over = readSession(61 * MIN, 60);
  const running = readSession(1 * MIN, 60);

  it('🔴 [Right] while time is left it runs, whatever the ending', () => {
    for (const ending of ['red', 'pulse', 'lock']) expect(clockLook(running, ending, false)).toBe('running');
  });

  it('🔴 [Right] red by default; pulse when chosen and motion is welcome', () => {
    expect(clockLook(over, 'red', false)).toBe('red');
    expect(clockLook(over, 'pulse', false)).toBe('pulse');
  });

  it('🔴 [Right] under reduced motion the pulse stops and the clock stays plain red', () => {
    expect(clockLook(over, 'pulse', true)).toBe('red');
  });

  it('🔴 [Right] «lock» is stored and NOT built: the clock turns red, and `problems` says why', () => {
    expect(clockLook(over, 'lock', false), 'a lock with no way to lift it would shut the child out').toBe('red');
    expect(sessionEndingProblems('lock')).toHaveLength(1);
    expect(sessionEndingProblems('lock')[0]).toMatch(/lock.*ADR-0050 point 4.*issue #94/);
    expect(sessionEndingProblems('red')).toEqual([]);
    expect(sessionEndingProblems('pulse')).toEqual([]);
  });
});

describe('the name a screen reader hears', () => {
  it('🔴 [Right] minutes in words, the singular at one, and the end', () => {
    expect(clockWords(readSession(0, 60))).toEqual({ key: 'clock.left', minutes: 60 });
    expect(clockWords(readSession(59 * MIN + 1, 60))).toEqual({ key: 'clock.left.one', minutes: 1 });
    expect(clockWords(readSession(60 * MIN, 60))).toEqual({ key: 'clock.over', minutes: 0 });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each applied to the code, seen RED here, and undone (the results are in the commit that brought this file):
//   M1 DEFAULTS.sessionMinutes 50 (ADR-0236 before its erratum)           🔴 an hour by default
//   M2 DEFAULTS.sessionEnding 'lock'                                      🔴 an hour by default
//   M3 `minutes >= 1` → `minutes >= 0` in toSessionMinutes                 🔴 [Range]
//   M4 readSession without the `Math.max(0, …)` floor                      🔴 past the end
//   M5 minutesLeft with Math.floor                                        🔴 [Boundary]
//   M6 clockLook ignoring reducedMotion                                    🔴 under reduced motion
//   M7 clockLook returning 'lock' as its own look                          🔴 «lock» is stored and not built
//   M8 setSessionEndingValue without its emit                              🔴 each writer persists and tells
