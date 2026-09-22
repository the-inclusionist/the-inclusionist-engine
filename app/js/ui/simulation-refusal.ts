// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/simulation-refusal — the refusal of a simulation that would teach something false (ADR-0076): the names cartridges import from ui.
//
// The module lives in `render/viz-refusal` since issue #167: `render/viz-setters` uses it, and render may not import ui
// (ADR-0173). These names stay, bound to the same values and types.
import {
  REASON_KEY as CHAVE_DO_MOTIVODeRender, simulationRefusal as recusaDaSimulacaoDeRender,
  showsEvenWhenUnavailable as mostraMesmoIndisponivelDeRender, type Refusal as RecusaDeRender,
} from '../render/viz-refusal.js';

export const REASON_KEY = CHAVE_DO_MOTIVODeRender;
export const simulationRefusal = recusaDaSimulacaoDeRender;
export const showsEvenWhenUnavailable = mostraMesmoIndisponivelDeRender;
export type Refusal = RecusaDeRender;
