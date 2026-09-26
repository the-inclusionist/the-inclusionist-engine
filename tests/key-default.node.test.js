// SPDX-License-Identifier: AGPL-3.0-or-later
// input/key-default — the decision alone: which key is play's to hear, and which belongs to what has the focus and keeps its
// browser default (ADR-0111 errata of 2026-09-26). The real keys, the real buttons and the real fields are in
// `a-delivered-key-does-not-also-click.browser.test.js`; this pins the branches a browser case cannot reach, such as a target
// with no `closest`.
import { describe, it, expect } from 'vitest';
import { keyGoesToGame, keyPressesOwnControl, keyTypedIntoField, BUTTON_ACTIVATION_KEYS } from '../app/js/input/key-default.js';

const OWN = '.pi-btn';
/** A target that matches the selectors it is told to. */
const alvo = (matches, extra = {}) => ({ closest: (sel) => (sel.split(',').some((s) => matches.includes(s.trim())) ? {} : null), ...extra });

describe('keyGoesToGame', () => {
  it('🔴 [Right] a key on a game button is play\'s', () => {
    expect(keyGoesToGame('Space', alvo([]), OWN)).toBe(true);
  });

  it('🔴 [Boundary] no element had the focus (a target with no `closest`): nothing else to go to, it is play\'s', () => {
    expect(keyGoesToGame('Space', null, OWN)).toBe(true);
    expect(keyGoesToGame('Space', {}, OWN)).toBe(true);
  });

  it('🔴 [Boundary] typing into an editable field is the field\'s, whatever the key: input, textarea, select, contenteditable', () => {
    for (const code of ['Space', 'KeyS', 'ArrowDown']) {
      for (const tag of ['input', 'textarea', 'select']) expect(keyGoesToGame(code, alvo([tag]), OWN), `${code} in ${tag}`).toBe(false);
      expect(keyGoesToGame(code, alvo([], { isContentEditable: true }), OWN), `${code} in contenteditable`).toBe(false);
    }
  });

  it("🔴 [Right] a key that ACTIVATES the engine's own focused control is the control's: Space, Enter, NumpadEnter", () => {
    expect([...BUTTON_ACTIVATION_KEYS].sort()).toEqual(['Enter', 'NumpadEnter', 'Space']);
    for (const code of BUTTON_ACTIVATION_KEYS) expect(keyGoesToGame(code, alvo([OWN]), OWN), code).toBe(false);
  });

  it("🔴 [Boundary] any other key with the focus on the engine's own control is still play's — an arrow, a letter", () => {
    for (const code of ['ArrowDown', 'ArrowUp', 'KeyS', 'KeyJ', 'Digit8']) expect(keyGoesToGame(code, alvo([OWN]), OWN), code).toBe(true);
  });

  it("🔴 [Boundary] an activation key on a control that is NOT the engine's is play's (the game's own button)", () => {
    expect(keyGoesToGame('Enter', alvo(['.game-option']), OWN)).toBe(true);
  });
});

// The question START's listener asks before it opens the quick pause: is this Enter the press of the engine's focused control?
describe('keyPressesOwnControl', () => {
  it("🔴 [Right] Space, Enter and NumpadEnter on the engine's own focused control press it", () => {
    for (const code of BUTTON_ACTIVATION_KEYS) expect(keyPressesOwnControl(code, alvo([OWN]), OWN), code).toBe(true);
  });

  it("🔴 [Boundary] any other key there does not — H, the other START key, still pauses from ☰", () => {
    for (const code of ['KeyH', 'ArrowDown', 'KeyF']) expect(keyPressesOwnControl(code, alvo([OWN]), OWN), code).toBe(false);
  });

  it("🔴 [Boundary] Enter anywhere else does not: the game's button, a field, no element at all", () => {
    expect(keyPressesOwnControl('Enter', alvo(['.game-option']), OWN)).toBe(false);
    expect(keyPressesOwnControl('Enter', alvo(['input']), OWN)).toBe(false);
    expect(keyPressesOwnControl('Enter', null, OWN)).toBe(false);
    expect(keyPressesOwnControl('Enter', {}, OWN)).toBe(false);
  });
});

// The question START's, SELECT's and the quick pause's `action4` listeners ask first: is this key being typed into a field?
describe('keyTypedIntoField', () => {
  it('🔴 [Right] input, textarea, select and contenteditable are fields', () => {
    for (const tag of ['input', 'textarea', 'select']) expect(keyTypedIntoField(alvo([tag])), tag).toBe(true);
    expect(keyTypedIntoField(alvo([], { isContentEditable: true })), 'contenteditable').toBe(true);
  });

  it("🔴 [Boundary] a button — the game's or the engine's own — is not a field", () => {
    expect(keyTypedIntoField(alvo(['.game-option']))).toBe(false);
    expect(keyTypedIntoField(alvo([OWN]))).toBe(false);
  });

  it('🔴 [Boundary] no element had the focus (a target with no `closest`): no field', () => {
    expect(keyTypedIntoField(null)).toBe(false);
    expect(keyTypedIntoField({})).toBe(false);
    expect(keyTypedIntoField({ isContentEditable: true })).toBe(false);
  });
});
