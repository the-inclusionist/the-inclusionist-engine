// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/visual-axes-panel — the two visual axes' labels, rows and click reading (ADR-0076): the names cartridges import from ui.
//
// The module lives in `render/viz-axes-labels` since issue #167: `render/viz-setters` uses it, and render may not import ui
// (ADR-0173). These names stay, bound to the same values and types.
import {
  THEME_LABEL as ROTULO_DO_TEMADeRender, CORRECTION_LABEL as ROTULO_DA_CORRECAODeRender,
  SHORT_THEME as CURTO_DO_TEMADeRender, SHORT_CORRECTION as CURTO_DA_CORRECAODeRender,
  axisRows as linhasDoEixoDeRender, axesHtml as eixosHtmlDeRender, buttonChoice as escolhaDoBotaoDeRender,
  type VisualAxis as EixoVisualDeRender, type Translator as TradutorDeRender,
  type AxisChoice as EscolhaDeEixoDeRender,
} from '../render/viz-axes-labels.js';

export const THEME_LABEL = ROTULO_DO_TEMADeRender;
export const CORRECTION_LABEL = ROTULO_DA_CORRECAODeRender;
export const SHORT_THEME = CURTO_DO_TEMADeRender;
export const SHORT_CORRECTION = CURTO_DA_CORRECAODeRender;
export const axisRows = linhasDoEixoDeRender;
export const axesHtml = eixosHtmlDeRender;
export const buttonChoice = escolhaDoBotaoDeRender;
export type VisualAxis = EixoVisualDeRender;
export type Translator = TradutorDeRender;
export type AxisChoice = EscolhaDeEixoDeRender;
