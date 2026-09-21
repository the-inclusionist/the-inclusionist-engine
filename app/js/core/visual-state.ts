// SPDX-License-Identifier: AGPL-3.0-or-later
// core/visual-state — the SHAPE of a child's visual state: the two axes and the simulation that is not one (ADR-0076).
//
// Types only, in core because `core/entity` holds a player's state and may not import upward (ADR-0173, issue #167);
// `render/viz-axes` keeps the same names and the functions that apply them.

/** O eixo do CONTRASTE. `padrao` não é ausência de tema: é o tema desenhado do jogo. */
export type Theme = 'padrao' | 'hc3' | 'hc45' | 'hc7';

/** O eixo da CORREÇÃO DE COR. `tricro` = visão tricromática, e é um nome, não uma ausência. */
export type Correction = 'tricro' | 'protan' | 'deuter' | 'tritan';

/** A simulação, que NÃO é eixo. `null` = nenhuma a correr. */
export type Simulation = null | 'sim-protan' | 'sim-deuter' | 'sim-tritan'
  | 'lv-blur' | 'lv-haze' | 'lv-tunnel' | 'lv-macular' | 'lv-diabetic' | 'blind';

/** O estado visual de UM jogador. Substitui a string única de `p.viz`. */
export interface VisualState {
  readonly tema: Theme;
  readonly correcao: Correction;
  readonly simulacao: Simulation;
}
