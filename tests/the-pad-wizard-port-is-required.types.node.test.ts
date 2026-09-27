// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PAD WIZARD'S CLOSING PORT IS REQUIRED (ADR-0248) — the TYPE half, checked by `tsc` (the project's `include` holds `tests`).
//
// 🔴 A `GamepadCtx` WITHOUT `wizardClosed` DOES NOT COMPILE. The Dev chose a required field over an optional one: an optional
// port is one more field a game that builds the ctx by hand can forget, and forgetting it leaves a screen-reader child's focus
// on `<body>` every time the transport's own wizard closes. The `@ts-expect-error` below is the gate: if the port became
// optional (or left the interface), the directive would be unused and `tsc` would fail.
//
// The behaviour — called once per close, after the overlay is hidden and the game resumed — is held in `gamepad.node.test.js`;
// the focus it brings back, through the real root, in `the-pad-wizard-gives-the-focus-back.browser.test.js`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import type { GamepadCtx } from '../app/js/input/gamepad.js';

type WithoutThePort = Omit<GamepadCtx, 'wizardClosed'>;

/** What a game that builds the ctx by hand and has not added the port hands over: it must not pass for a `GamepadCtx`. */
function forgotThePort(ctx: WithoutThePort): GamepadCtx {
  // @ts-expect-error — `wizardClosed` is REQUIRED (ADR-0248)
  return ctx;
}
/** The one-line migration the Breaking-Changes note gives: add the port, and the ctx is whole again. */
function addedThePort(ctx: WithoutThePort): GamepadCtx {
  return { ...ctx, wizardClosed: () => {} };
}

describe('the types a game that builds `GamepadCtx` writes (ADR-0248)', () => {
  it('🔴 [Right] without `wizardClosed` the ctx does not compile; with it, it does', () => {
    const whole = addedThePort({} as WithoutThePort);
    expect(() => whole.wizardClosed(), 'the migrated ctx carries a callable port').not.toThrow();
    expect(typeof forgotThePort, 'the type-level case exists for `tsc` to read').toBe('function');
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// `GamepadCtx.wizardClosed` made optional (and the transport's call guarded with `?.()`, so only this file can notice) → `tsc`
// exit 2: «Unused '@ts-expect-error' directive» at `forgotThePort`. Applied by a counting script, restored from a copy and
// checked by SHA-256.
