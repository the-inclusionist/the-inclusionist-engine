// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-axes-labels — THE VISUAL MENU WITH TWO CONTROLS (ADR-0076, issue #104), the pure half.
//
// ========================= WHY TWO CONTROLS AND NOT ONE =========================
// A SINGLE control was the honest way to state a REAL exclusivity while `p.viz` kept ONE value: two separate controls
// would overwrite each other silently — the child would pick the correction, then the contrast, and lose the correction
// with nothing saying so. ⚠️ THAT REASON IS GONE: `p.viz` keeps two axes plus the simulation, and the per-axis writers
// (`setPlayerTheme`/`setPlayerCorrection`) change one without touching the other. Keeping the single control would state
// an exclusivity that no longer exists — and keep denying both to whoever needs both.
//
// ========================= THE DEFAULTS' NAMES ARE A DECISION, NOT ROUTINE =========================
// ⚠️ «Tema padrão» and «Visão tricromática», and ADR-0076 closes its *definition of done* with the rule that chose them:
// **no default label diagnoses the reader**. `modo sem deficiência visual` was offered and refused — it tells the child
// what they are NOT, in the menu they opened to be able to play. A default is named by what it IS.
//
// And `Modo padrão` (`viz.normal`) does not serve here: it was the SHARED neutral from when the two axes were one. With
// two controls, a «padrão» that does not say the default of WHAT is ambiguous in both.
//
// A pure module: it returns HTML and i18n keys and touches no document. `render/viz-setters`, in the same layer,
// mounts it (issue #167).
import { THEMES, CORRECTIONS, type Theme, type Correction, type VisualState } from './viz-axes.js';

/** Each theme's label. An i18n key — whoever shows it resolves it, like the rest of the menu. */
export const THEME_LABEL: Readonly<Record<Theme, string>> = Object.freeze({
  padrao: 'eixo.tema.padrao',
  hc3: 'viz.hc-direto',
  hc45: 'viz.hc-direto-45',
  hc7: 'viz.hc-direto-7',
});

/** Each colour correction's label. */
export const CORRECTION_LABEL: Readonly<Record<Correction, string>> = Object.freeze({
  tricro: 'eixo.correcao.tricro',
  protan: 'viz.fix-protan',
  deuter: 'viz.fix-deuter',
  tritan: 'viz.fix-tritan',
});

/**
 * The SHORT labels, for the quick bar's icons — «7:1», «deuteranopia».
 *
 * ⚠️ THEY ARE THE KEYS THAT ALREADY EXISTED (`contrast.*`, `cvd.*`), rekeyed per axis. The quick bar speaks short
 * because it announces ONE icon at a time, and the panel speaks in full because the child is reading a list — the
 * difference is one of context. Reusing instead of translating again keeps the same word in both places.
 */
export const SHORT_THEME: Readonly<Record<Theme, string>> = Object.freeze({
  padrao: 'contrast.off', hc3: 'contrast.3', hc45: 'contrast.45', hc7: 'contrast.7',
});
export const SHORT_CORRECTION: Readonly<Record<Correction, string>> = Object.freeze({
  tricro: 'cvd.off', protan: 'cvd.protan', deuter: 'cvd.deuter', tritan: 'cvd.tritan',
});

/** The two axes, as the panel identifies them in the DOM (stored values, and so Portuguese). */
export type VisualAxis = 'tema' | 'correcao';

/** A translator, the same the rest of the interface gets. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * ONE axis's rows, in the radio shape the panel already uses.
 *
 * ⚠️ A RADIO AND NOT SEVEN BUTTONS: WITHIN an axis the values stay exclusive — one theme at a time, one correction at a
 * time. What stopped being exclusive is the relation BETWEEN the axes, which is why they become two radios instead of
 * one.
 *
 * ⚠️ AND THE VISIBLE-ROW SHAPE STAYS, not a `<select>`. The visual panel records the mistake the Dev caught on the first
 * attempt: inside a closed box, a control whose reason to exist is to be FOUND by whoever sees poorly becomes «quase o
 * mesmo que não ter movido».
 */
export function axisRows(
  axisName: VisualAxis,
  options: readonly string[],
  optionLabels: Readonly<Record<string, string>>,
  selected: string,
  t: Translator,
): string {
  return options.map((valueName) => {
    const sel = valueName === selected;
    return `<div class="ctrl-row"><span><strong>${t(optionLabels[valueName]!)}</strong></span>`
      + `<button class="mode-btn${sel ? ' is-on' : ''}" role="radio" aria-checked="${sel}"`
      + ` data-eixo="${axisName}" data-valor="${valueName}" type="button">${sel ? t('viz.escolhido') : t('viz.escolher')}</button></div>`;
  }).join('');
}

/**
 * The TWO axes, one after the other, with a title each.
 *
 * The title exists because two unnamed radios in a row are one radio of eight for whoever reads fast — and that reading
 * is exactly the misunderstanding the split exists to undo.
 */
export function axesHtml(v: VisualState, t: Translator): string {
  return `<h3 class="opt-sub">${t('eixo.tema.titulo')}</h3>`
    + axisRows('tema', THEMES, THEME_LABEL, v.tema, t)
    + `<h3 class="opt-sub">${t('eixo.correcao.titulo')}</h3>`
    + axisRows('correcao', CORRECTIONS, CORRECTION_LABEL, v.correcao, t);
}

/** What a click on a panel button means. `null` when the button belongs to no axis. */
export interface AxisChoice {
  readonly axis: VisualAxis;
  readonly value: string;
}
export function buttonChoice(dataset: { eixo?: string; valor?: string }): AxisChoice | null {
  const { eixo: axisName, valor: valueName } = dataset;
  if (axisName !== 'tema' && axisName !== 'correcao') return null;
  if (!valueName) return null;
  const allowed: readonly string[] = axisName === 'tema' ? THEMES : CORRECTIONS;
  return allowed.includes(valueName) ? { axis: axisName, value: valueName } : null;
}
