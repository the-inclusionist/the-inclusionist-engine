// SPDX-License-Identifier: AGPL-3.0-or-later
// core/visual-cycles — THE TWO CYCLES OF VISUAL ACCESSIBILITY, and the asymmetry between them (ADR-0221; issue #203).
//
// High contrast and colour correction are two choices a child steps through from the quick bar, and they used to live in two
// different modules: the list of levels in `ui/settings-visual`, the steps and the names in `ui/pause-icons`. 🔴 They are here
// together because the thing that costs most to maintain only reads when both are in sight — their ASYMMETRY, written below
// and deliberate.
//
// ⚠️ A LEAF MODULE: zero imports, zero DOM, zero storage. Two lists and two small sums.
//
// 📌 What it does NOT decide: which cycle the bar offers, or when. That belongs to the icon (`ui/pause-icons`) and to the panel
// (`ui/settings-visual`), the two surfaces through which the same choice is asked for.

/** The high-contrast levels, as `player.viz` values. The first one is «off». */
export const CONTRAST_LEVELS: readonly string[] = ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7'];

/** The colour-correction cycle, as `player.viz` values. */
export const CVD_SEQ: readonly string[] = ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan'];

/**
 * The i18n keys of the announced colour-correction names, indexed like `CVD_SEQ`.
 *
 * ⚠️ POSITION 0 IS `cvd.tricro` AND NOT `cvd.off`, AND THE TWO KEYS DO NOT SWAP. This list names the four CHOICES of the
 * cycle, so position 0 is a way of seeing — trichromatic vision, the one that needs no correction — and it says so. `cvd.off`
 * is the FALLBACK for `viz` values that are no correction at all, and 13 of the 16 modes are exactly that: the three
 * simulations, the three contrast levels, the five low-vision ones and blind mode. Announcing «trichromatic vision» there
 * would be the software asserting what the child sees while she simulates not seeing. The choice is named; the fallback is off.
 */
export const CVD_NAMES: readonly string[] = ['cvd.tricro', 'cvd.protan', 'cvd.deuter', 'cvd.tritan'];

/*
 * 🔴 `CVD_LABELS` DID NOT COME ALONG — IT WAS DELETED. It sat in the declared debt of `ui/pause-icons`
 * (`docs/6-DevOps-SRE/exports-without-consumer.json`) — published and measured to have no consumer anywhere — and its own
 * comment called it «the label `iconLabel` uses», which had stopped being true at some point with nobody noticing. A debt
 * ledger exists to SHRINK: moving it house would have carried it another year. What `iconLabel` uses is `CVD_NAMES`.
 */

/** The next contrast step. A `viz` that is not in the list — a correction filter, say — counts as index 0. */
export function nextContrast(cur: string | undefined): string {
  let idx = CONTRAST_LEVELS.indexOf(cur as string);
  idx = idx < 0 ? 0 : idx;
  return CONTRAST_LEVELS[(idx + 1) % CONTRAST_LEVELS.length]!;
}

/**
 * The next colour-correction step.
 *
 * 🔴 NOTE THE ASYMMETRY WITH `nextContrast`, and it is the reason the two live in one file: an unknown `viz` lands on index
 * **1** (`fix-protan`) and not on 0. It is verbatim from `game.js` (`idx = idx<0 ? 1 : (idx+1)%seq.length`), and the effect on
 * the child is concrete: starting from a mode that is not a correction, contrast switches on at its first level while
 * correction skips «normal» and goes straight into protanopia. Apart, a reader fixes one by the other and deletes a decision
 * without knowing it existed.
 */
export function nextCvd(cur: string | undefined): { idx: number; mode: string } {
  let idx = CVD_SEQ.indexOf(cur as string);
  idx = idx < 0 ? 1 : (idx + 1) % CVD_SEQ.length;
  return { idx, mode: CVD_SEQ[idx]! };
}
