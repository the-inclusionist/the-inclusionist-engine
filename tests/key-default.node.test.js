// SPDX-License-Identifier: AGPL-3.0-or-later
// input/key-default — the decision alone: which key the engine handled keeps its browser default (ADR-0111 erratum of
// 2026-09-26). The real keys, the real buttons and the real fields are in `a-delivered-key-does-not-also-click.browser.test.js`;
// this pins the branches a browser case cannot reach, such as a target with no `closest`.
import { describe, it, expect } from 'vitest';
import { cancelsKeyDefault } from '../app/js/input/key-default.js';

const OWN = '.pi-btn';
/** A target that matches the selectors it is told to. */
const alvo = (matches, extra = {}) => ({ closest: (sel) => (sel.split(',').some((s) => matches.includes(s.trim())) ? {} : null), ...extra });

describe('cancelsKeyDefault', () => {
  it('🔴 [Right] a delivered key on a game button is cancelled', () => {
    expect(cancelsKeyDefault(true, alvo([]), OWN)).toBe(true);
  });

  it('🔴 [Boundary] a key the engine did not deliver keeps its default, wherever the focus is', () => {
    expect(cancelsKeyDefault(false, alvo([]), OWN)).toBe(false);
    expect(cancelsKeyDefault(false, null, OWN)).toBe(false);
  });

  it('🔴 [Boundary] no element had the focus (a target with no `closest`): nothing native to keep, it is cancelled', () => {
    expect(cancelsKeyDefault(true, null, OWN)).toBe(true);
    expect(cancelsKeyDefault(true, {}, OWN)).toBe(true);
  });

  it('🔴 [Boundary] an editable field keeps it: input, textarea, select, contenteditable', () => {
    for (const tag of ['input', 'textarea', 'select']) expect(cancelsKeyDefault(true, alvo([tag]), OWN), tag).toBe(false);
    expect(cancelsKeyDefault(true, alvo([], { isContentEditable: true }), OWN)).toBe(false);
  });

  it("🔴 [Boundary] the engine's own control keeps it", () => {
    expect(cancelsKeyDefault(true, alvo([OWN]), OWN)).toBe(false);
  });
});
