// SPDX-License-Identifier: AGPL-3.0-or-later
// A TREMOR IS NOT A SECOND PRESS (ADR-0217; GAG Advanced/Motor, issue #182).
//
// The rule is pure and the clock is the case's, so what is measured is the decision itself. And the cases that matter most are
// the REFUSALS THIS MUST NOT MAKE: a release refused leaves a character walking after the child let go, and a held key whose
// repeats are refused is a child who has to press again to keep going. Either one turns an accommodation into a new disability.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createInputCooldown, COOLDOWN_MS } from '../app/js/input/input-cooldown.js';

const MS = COOLDOWN_MS;

describe('the wait after an accepted key', () => {
  it('🔴 [Right] the second press of a hand that bounces is refused, and the first is not', () => {
    const espera = createInputCooldown();
    expect(espera.keydown('KeyZ', 1000, MS, false)).toBe('accept');
    expect(espera.keydown('KeyZ', 1040, MS, false), 'the bounce 40 ms later reached the game').toBe('refuse');
  });

  it('🔴 [Right] a DIFFERENT key inside the window is refused too — «between inputs», not «between repeats»', () => {
    const espera = createInputCooldown();
    expect(espera.keydown('KeyZ', 0, MS, false)).toBe('accept');
    expect(espera.keydown('KeyX', 100, MS, false)).toBe('refuse');
  });

  it('🔴 [Right] once the time has passed the same key is accepted again', () => {
    const espera = createInputCooldown();
    espera.keydown('KeyZ', 0, MS, false);
    expect(espera.keydown('KeyZ', MS - 1, MS, false), 'a millisecond early is still inside the wait').toBe('refuse');
    expect(espera.keydown('KeyZ', MS, MS, false), 'the wait ended and the press was still refused').toBe('accept');
  });

  /**
   * 🔴 THE WINDOW IS COUNTED FROM THE LAST ACCEPTED PRESS, never from the last one seen. A tremor of ten bounces would
   * otherwise push it forward ten times, and the child would be locked out for as long as her hand shook.
   */
  it('🔴 [Right] a refused press does not start a new wait', () => {
    const espera = createInputCooldown();
    espera.keydown('KeyZ', 0, MS, false);
    for (let t = 50; t < MS; t += 50) expect(espera.keydown('KeyZ', t, MS, false)).toBe('refuse');
    expect(espera.keydown('KeyZ', MS, MS, false), 'the bounces pushed the wait forward').toBe('accept');
  });

  it('🔴 [Zero] a RELEASE is never refused — a character would walk on after the child let go', () => {
    const espera = createInputCooldown();
    espera.keydown('KeyZ', 0, MS, false);
    expect(espera.keyup('KeyZ')).toBe('accept');
    expect(espera.keyup('KeyX'), 'the release of a key that was refused on the way down').toBe('accept');
  });

  it('🔴 [Zero] a key she is HOLDING is never refused — holding is one input, however often the system repeats it', () => {
    const espera = createInputCooldown();
    espera.keydown('ArrowRight', 0, MS, false);
    for (let t = 30; t < 3 * MS; t += 30) {
      expect(espera.keydown('ArrowRight', t, MS, true), `the repeat at ${t} ms was refused`).toBe('accept');
    }
  });

  it('🔴 [Zero] off (0 ms): nothing is ever refused, which is how it leaves the factory', () => {
    const espera = createInputCooldown();
    for (let t = 0; t < 1000; t += 10) expect(espera.keydown('KeyZ', t, 0, false)).toBe('accept');
  });

  it('📌 [Boundary] turning it off forgets the wait: the next press is not refused by an old one', () => {
    const espera = createInputCooldown();
    espera.keydown('KeyZ', 0, MS, false);
    espera.reset();
    expect(espera.keydown('KeyZ', 10, MS, false), 'a press refused by a wait the child had already turned off').toBe('accept');
  });

  it('📌 [Right] the number is the GAG\'s, and it is the only one offered', () => {
    expect(COOLDOWN_MS, 'the guideline says 0.5 s; another number needs a hand to measure it on').toBe(500);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-input-cooldown.py`:
//   · the release refused inside the window        → «a RELEASE is never refused»
//   · a held key's repeat refused                  → «a key she is HOLDING is never refused»
//   · the window counted from the last press SEEN  → «a refused press does not start a new wait»
//   · `<` turned into `<=` at the edge             → «once the time has passed»
//   · only the SAME key refused                    → «a DIFFERENT key inside the window is refused too»
//       ⚠️ written twice: the first version named a variable it never declared, so the suite went red on a type error and not
//       on a case — a red that proves nothing. `scratchpad/mutar-mesma-tecla.py` compiles first and says so.
//   · `reset` doing nothing                        → «turning it off forgets the wait»
//   · the root never applying the rule             → `nao-precisa-segurar.browser`, «the second press … never reaches the game»
//   · the row writing something other than 500 ms  → same file, «is offered beside it, off, and the choice survives»
//   · the row shown where nothing is held          → `controle-virtual-no-arranque`, «built and HIDDEN»
//
// 📌 AND ONE MUTATION WAS EQUIVALENT, which is a finding and not a gap: an `if (ms <= 0) return 'accept'` guard stood above the
// comparison, and removing it changed nothing — with `ms` at 0 no elapsed time is ever less than it. The line was deleted.
