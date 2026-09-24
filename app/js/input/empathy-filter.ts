// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE TWO MOTOR EMPATHY SIMULATIONS, AS DECISIONS ON GAME KEYS (ADR-0181). Pure: the root applies the decision to the event
 * before any cartridge hears it.
 *
 * A simulation makes play harder on purpose, to show what a motor disability costs; it is never an accommodation.
 *   · «um botão por vez»: while one game key is held, a second is never accepted — nor its release;
 *   · «sem força para segurar»: a held key reads as one tap — the press passes and is released at once; its repeats and its
 *     real release do not reach the game.
 */
export type KeyDecision = 'passar' | 'barrar' | 'tocar';
export interface EmpathySimulation { readonly noChords: boolean; readonly noGripStrength: boolean }

export interface EmpathyFilter {
  /** A game key goes down. `tocar`: let it through and release it at once. */
  keydown(code: string, repeat: boolean, sim: EmpathySimulation): KeyDecision;
  /** A game key comes up. */
  keyup(code: string): KeyDecision;
}

export function createEmpathyFilter(): EmpathyFilter {
  const accepted = new Set<string>();   // held, and the game saw them go down
  const touched = new Set<string>();   // physically held, already released to the game as a tap
  const blocked = new Set<string>();  // held, and the game never saw them
  const anotherHeld = (code: string): boolean => [...accepted, ...touched].some((k) => k !== code);
  return {
    keydown(code, repeat, sim) {
      if (touched.has(code) || blocked.has(code)) return 'barrar';
      if (sim.noChords && anotherHeld(code)) { blocked.add(code); return 'barrar'; }
      if (sim.noGripStrength) {
        if (repeat && accepted.has(code)) return 'barrar';
        accepted.delete(code);
        touched.add(code);
        return 'tocar';
      }
      accepted.add(code);
      return 'passar';
    },
    keyup(code) {
      if (touched.delete(code)) return 'barrar';
      if (blocked.delete(code)) return 'barrar';
      accepted.delete(code);
      return 'passar';
    },
  };
}
