// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/visual-choices — WHAT A VISUAL CHOICE IS, with no document anywhere near it.
//
// 📌 THE SUITE HAD ALREADY DRAWN THIS SEAM, which is what makes the cut a reading and not an opinion:
// `tests/settings-visual.node.test.js` imports exactly these names and nothing else, and the node project mounts no
// document — so whoever wrote those cases had to know where the panel stopped being a panel. It is the fourth module to
// come out this way, after `ui/audio-choices`, `ui/typo-choices` and `ui/control-choices`.
//
// What lives here answers «what are the positions, what is each one called, and what does a value mean»; what stayed in
// `ui/settings-visual` is the work its name never mentioned — finding the controls, wiring them, and reflecting the
// choice on three surfaces.

import { toggleLabel } from './dom.js';
import { CONTRAST_LEVELS } from '../core/visual-cycles.js';
import type { HcRoleKey } from '../render/hc-role-data.js';
import { HC_ROLE_KEYS } from '../render/hc-role-data.js';
import { VIZ_CORRECTIONS, VIZ_MODES, type VizMode } from '../render/viz-modes.js';

export type { HcRoleKey as RoleKey } from '../render/hc-role-data.js';
type RoleKey = HcRoleKey;
export type RGB = readonly [number, number, number];

/**
 * EVERYTHING this menu writes into `p.viz`: the 4 contrast levels PLUS the 3 colour-blindness corrections, which live
 * here by the Dev's decision (#60) — in the empathy panel a colour-blind child would have had to enter the menu for
 * "feeling what a disability is like" to find the correction for the one they have.
 *
 * The seven live in ONE control, and that is not about saving space: `p.viz` holds ONE value. Two separate controls
 * would overwrite each other silently — the child would pick the correction, then the contrast, and lose the
 * correction with nothing saying so. One list tells the truth about the exclusivity.
 */
export const VISUAL_MODES: readonly string[] = [...CONTRAST_LEVELS, ...VIZ_CORRECTIONS.map((m) => m.key)];
const VISUAL_MODE_SET: ReadonlySet<string> = new Set(VISUAL_MODES);

/** Short announcement labels. */
// i18n keys, not text. The ratios look like universal numbers, but '4,5:1' uses the pt-BR decimal comma and becomes
// '4.5:1' in English — and 'off' is a word in each language.
export const CONTRAST_LABELS: Readonly<Record<string, string>> = { normal: 'contrast.off', 'hc-direto': 'contrast.3', 'hc-direto-45': 'contrast.45', 'hc-direto-7': 'contrast.7' };

export const ROLE_KEYS: readonly RoleKey[] = HC_ROLE_KEYS;
/** Readable labels for the color-blocking roles. */
export const ROLE_LABELS: Readonly<Record<RoleKey, string>> = { hazard: 'perigo (lava)', climb: 'escalável (escada/trampolim)', water: 'água', gate: 'portão' };

/**
 * The 7 modes as the panel OFFERS them: a radio list, with a name and a description on each row.
 *
 * Not a `<select>`, and the Dev caught that immediately: inside a `<select>` the corrections become one closed line in
 * a closed box. For a control whose reason to exist is to be FOUND by someone who sees poorly, hiding it behind a
 * click is almost the same as not offering it.
 *
 * Radio, and not seven buttons: `p.viz` holds ONE value, and the exclusivity is said by the shape of the control
 * instead of being discovered by losing the correction just chosen.
 */
export const VISUAL_MODE_LIST: readonly VizMode[] =
  VIZ_MODES.filter((m) => m.kind === 'normal' || m.kind === 'hcnew').concat(VIZ_CORRECTIONS);

/**
 * `viz` when it is a mode of THIS menu (contrast or correction), otherwise 'normal'.
 *
 * Named for what it returns: a name that said "contrast" would lie when it returns `fix-deuter`, and a name that lies
 * about what it returns is worse than a long one.
 */
export function resolveVisualMode(viz: string): string {
  return VISUAL_MODE_SET.has(viz) ? viz : 'normal';
}

/** i18n KEY of a contrast level's label; unknown modes fall back to the 'off' key. Resolve with `t()`. */
export function contrastLabel(mode: string): string {
  return CONTRAST_LABELS[mode] ?? CONTRAST_LABELS.normal;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * i18n KEY of the L->Q slider label ('lq.off'/'lq.linear'/'lq.mixed'/'lq.quadratic'). The label belongs to the L->Q
 * feature, so it lives with the filter that owns it (render/lq-filter) and is re-exported here under the name this
 * overlay has always used. Two copies of one rule is one copy too many: only the owner may change what the levels
 * mean. Callers resolve with `t()` — see the note on lqName about the `t` shadowing.
 */
export { lqName as lqLabel } from '../render/lq-filter.js';
import { lqName } from '../render/lq-filter.js';

/**
 * THE FOUR POSITIONS OF THE CONTRAST BOOST, chosen with left and right (ADR-0151): off, linear, mixed and quadratic —
 * «da mesma forma que se troca o número de jogadores, e não através de uma barra».
 *
 * ⚠️ THE "LINEAR" VALUE CANNOT BE ZERO: `setLq(0)` turns the filter off, and any value above turns the curve on. 0.05
 * is the most linear value that still turns the filter on. Mixed is the middle, and quadratic is the whole S-curve.
 * Each position falls within the range `lqName` already gives its name.
 */
export const LQ_STEPS: readonly number[] = [0, 0.05, 0.5, 1];

/**
 * Which position a continuous value is in — including one STORED by the old slider (0.35, 0.7…). By `lqName`'s range,
 * not by the nearest value: the NAME the child heard has to stay the name now.
 */
export function lqPosition(amount: number): number {
  return Math.max(0, ['lq.off', 'lq.linear', 'lq.mixed', 'lq.quadratic'].indexOf(lqName(amount)));
}

/** t (0..1) -> slider percent (0..100, rounded) — mirrors `Math.round(lqT*100)`.
 *  @deprecated Since ADR-0151 the boost is chosen by STEPS (`LQ_STEPS`/`lqPosition`); kept for consumers.
 *  ⚠️ It has no reader inside the engine: that debt is said here so that it stays in view. */
export function lqPercent(t: number): number {
  return Math.round(clamp01(t) * 100);
}

/** slider percent (any number) -> clamped t (0..1) — mirrors `+lq.value/100` fed into setLq's clamp.
 *  @deprecated Since ADR-0151 the boost is chosen by STEPS; kept for consumers. */
export function lqFromPercent(pct: number): number {
  return clamp01(pct / 100);
}

/** Defensive clamp when the player count shrank — mirrors `if(selVizPlayer>=numPlayers)selVizPlayer=0`. */
export function clampSelectedPlayer(selected: number, playerCount: number): number {
  return selected >= playerCount ? 0 : selected;
}

/** [r,g,b] (0..255) -> '#rrggbb'. */
export function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Shared on/off button label used by this panel's toggle buttons. */
export function onOffLabel(on: boolean): string {
  return toggleLabel(on);
}
