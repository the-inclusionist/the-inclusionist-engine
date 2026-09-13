// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/visual-axes-panel — the two visual axes' labels, rows and click reading (ADR-0076): the names cartridges import from ui.
//
// The module lives in `render/viz-axes-labels` since issue #167: `render/viz-setters` uses it, and render may not import ui
// (ADR-0173). These names stay, bound to the same values and types.
import {
  ROTULO_DO_TEMA as ROTULO_DO_TEMADeRender, ROTULO_DA_CORRECAO as ROTULO_DA_CORRECAODeRender,
  CURTO_DO_TEMA as CURTO_DO_TEMADeRender, CURTO_DA_CORRECAO as CURTO_DA_CORRECAODeRender,
  linhasDoEixo as linhasDoEixoDeRender, eixosHtml as eixosHtmlDeRender, escolhaDoBotao as escolhaDoBotaoDeRender,
  type EixoVisual as EixoVisualDeRender, type Tradutor as TradutorDeRender,
  type EscolhaDeEixo as EscolhaDeEixoDeRender,
} from '../render/viz-axes-labels.js';

export const ROTULO_DO_TEMA = ROTULO_DO_TEMADeRender;
export const ROTULO_DA_CORRECAO = ROTULO_DA_CORRECAODeRender;
export const CURTO_DO_TEMA = CURTO_DO_TEMADeRender;
export const CURTO_DA_CORRECAO = CURTO_DA_CORRECAODeRender;
export const linhasDoEixo = linhasDoEixoDeRender;
export const eixosHtml = eixosHtmlDeRender;
export const escolhaDoBotao = escolhaDoBotaoDeRender;
export type EixoVisual = EixoVisualDeRender;
export type Tradutor = TradutorDeRender;
export type EscolhaDeEixo = EscolhaDeEixoDeRender;
