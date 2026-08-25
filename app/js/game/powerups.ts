// SPDX-License-Identifier: AGPL-3.0-or-later
// game/powerups — collection-state predicates for power-ups (Estágio 4, Tier 2). Pure: they operate on a
// power-up object + a player index. The gate KEY is GLOBAL (one key opens the gate for the whole team);
// every other power-up is PER-PLAYER (tracked in `by[i]`). The spawn/render/gate logic (setupExtras/
// rebuildExtras/pupTexFor) stays in game.js for a later round — it is coupled to PIXI + the gate + the
// texture pipeline. See docs/5-Refactoring/plano-modularizacao-mapa.md.

/** A power-up item. `key` uses the global `taken`; the others track per-player pickup in `by`. */
export interface Powerup {
  kind: string;
  taken?: boolean;
  by?: number[];
}

/** Whether player `pi` has taken `pu` (the gate key is global; other power-ups are per-player). */
export function puTaken(pu: Powerup, pi: number): boolean {
  if (pu.kind === 'key') return !!pu.taken;
  return pu.by ? !!pu.by[pi] : !!pu.taken;
}

/** Mark `pu` taken by player `pi` (key → global; others → per-player, mirrored to `taken` for player 0). */
export function takePu(pu: Powerup, pi: number): void {
  if (pu.kind === 'key') {
    pu.taken = true;
    return;
  }
  if (!pu.by) pu.by = [];
  pu.by[pi] = 1;
  if (pi === 0) pu.taken = true;
}
