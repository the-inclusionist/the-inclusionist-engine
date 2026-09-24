// SPDX-License-Identifier: AGPL-3.0-or-later
// core/visual-state — the SHAPE of a child's visual state: the two axes and the simulation that is not one (ADR-0076).
//
// Types only, in core because `core/entity` holds a player's state and may not import upward (ADR-0173, issue #167);
// `render/viz-axes` keeps the same names and the functions that apply them.

/** The CONTRAST axis. `padrao` is not the absence of a theme: it is the game's own drawn theme. */
export type Theme = 'padrao' | 'hc3' | 'hc45' | 'hc7';

/** The COLOUR CORRECTION axis. `tricro` = trichromatic vision, and it is a name, not an absence. */
export type Correction = 'tricro' | 'protan' | 'deuter' | 'tritan';

/** The simulation, which is NOT an axis. `null` = none running. */
export type Simulation = null | 'sim-protan' | 'sim-deuter' | 'sim-tritan'
  | 'lv-blur' | 'lv-haze' | 'lv-tunnel' | 'lv-macular' | 'lv-diabetic' | 'blind';

/** The visual state of ONE player. Replaces the single `p.viz` string. */
export interface VisualState {
  readonly tema: Theme;
  readonly correcao: Correction;
  readonly simulacao: Simulation;
}
