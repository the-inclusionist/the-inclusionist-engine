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
export type DecisaoDeTecla = 'passar' | 'barrar' | 'tocar';
export interface SimulacaoMotora { readonly umPorVez: boolean; readonly semForca: boolean }

export interface FiltroMotor {
  /** A game key goes down. `tocar`: let it through and release it at once. */
  keydown(code: string, repeat: boolean, sim: SimulacaoMotora): DecisaoDeTecla;
  /** A game key comes up. */
  keyup(code: string): DecisaoDeTecla;
}

export function criarFiltroMotor(): FiltroMotor {
  const aceitas = new Set<string>();   // held, and the game saw them go down
  const tocadas = new Set<string>();   // physically held, already released to the game as a tap
  const barradas = new Set<string>();  // held, and the game never saw them
  const outraSegurada = (code: string): boolean => [...aceitas, ...tocadas].some((k) => k !== code);
  return {
    keydown(code, repeat, sim) {
      if (tocadas.has(code) || barradas.has(code)) return 'barrar';
      if (sim.umPorVez && outraSegurada(code)) { barradas.add(code); return 'barrar'; }
      if (sim.semForca) {
        if (repeat && aceitas.has(code)) return 'barrar';
        aceitas.delete(code);
        tocadas.add(code);
        return 'tocar';
      }
      aceitas.add(code);
      return 'passar';
    },
    keyup(code) {
      if (tocadas.delete(code)) return 'barrar';
      if (barradas.delete(code)) return 'barrar';
      aceitas.delete(code);
      return 'passar';
    },
  };
}
