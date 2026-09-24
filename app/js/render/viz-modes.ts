// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-modes.ts — the 16 visual accessibility modes (data) + derived indexes. A leaf module, ZERO deps. High
// contrast (direct rendering, 3 levels), colour-blindness simulation/correction, low vision, blindness. Applying the
// modes belongs to `render/viz-setters` and the root. See docs/research/RESEARCH-HIGH-CONTRAST.md.
// NO `filter` field here, on purpose: VIZ_FILTER, just below, is what says "mode -> CSS filter". A per-record copy of
// `url(#cvd-*)` nobody read would be two copies with one read: if they diverged, the wrong one would be the silent one,
// and an optional field would keep the type silent too.
/**
 * `sim` — this mode SIMULATES a disability in someone who does not have it, instead of CORRECTING the screen for someone
 * who does.
 *
 * `kind` does not answer that: `sim-deuter` (simulating colour blindness) and `fix-deuter` (correcting it) share
 * `kind:'filter'`, though they serve two opposite people. It matters because the empathy menu's "restore defaults"
 * (ADR-0028) turns the simulations off, and turning the corrections off with them would take from a colour-blind child
 * the only correction they have — from the menu that exists for whoever does NOT have the disability. A reset that does
 * that is worse than the trap it should undo.
 *
 * Only the 9 marked modes simulate. The 3 `fix-*` correct, the 3 `hc-direto*` correct, and `normal` does nothing.
 */
/**
 * A vision mode. `name` and `desc` keep an i18n KEY, not text — the same decision as `SceneryTheme.name` and
 * `RM_LABEL`, for the same reason: a `const` table with text resolves ONCE, on import, and stays frozen in the boot's
 * language. This menu is what a low-vision or colour-blind child reads to configure their OWN game; leaving it in
 * Portuguese in an English build takes from them the one page they needed to read.
 *
 * Whoever SHOWS it resolves it (`render/viz-setters`, `consumer-quiz`), and that is why this module stays a LEAF: pure
 * data, no dependency, importable from both sides of the boundary.
 */
export type VizMode = { key: string; kind: string; name: string; desc: string; lv?: string; sim?: true };
export const VIZ_MODES: VizMode[] = [
  {key:'normal', kind:'normal', name:'viz.normal',        desc:'viz.desc.normal'},
  {key:'hc-direto', kind:'hcnew', name:'viz.hc-direto', desc:'viz.desc.hc-direto'},
  {key:'hc-direto-45', kind:'hcnew', name:'viz.hc-direto-45', desc:'viz.desc.hc-direto-45'},
  {key:'hc-direto-7', kind:'hcnew', name:'viz.hc-direto-7', desc:'viz.desc.hc-direto-7'},
  {key:'sim-deuter', sim:true, kind:'filter', name:'viz.sim-deuter', desc:'viz.desc.sim-deuter'},
  {key:'sim-protan', sim:true, kind:'filter', name:'viz.sim-protan',   desc:'viz.desc.sim-protan'},
  {key:'sim-tritan', sim:true, kind:'filter', name:'viz.sim-tritan',   desc:'viz.desc.sim-tritan'},
  {key:'fix-protan', kind:'filter', name:'viz.fix-protan', desc:'viz.desc.fix-protan'},
  {key:'fix-deuter', kind:'filter', name:'viz.fix-deuter', desc:'viz.desc.fix-deuter'},
  {key:'fix-tritan', kind:'filter', name:'viz.fix-tritan', desc:'viz.desc.fix-tritan'},
  {key:'lv-blur',     sim:true, kind:'lowvision', lv:'blur',     name:'viz.lv-blur',         desc:'viz.desc.lv-blur'},
  {key:'lv-haze',     sim:true, kind:'lowvision', lv:'haze',     name:'viz.lv-haze',            desc:'viz.desc.lv-haze'},
  {key:'lv-tunnel',   sim:true, kind:'lowvision', lv:'tunnel',   name:'viz.lv-tunnel',   desc:'viz.desc.lv-tunnel'},
  {key:'lv-macular',  sim:true, kind:'lowvision', lv:'macular',  name:'viz.lv-macular',   desc:'viz.desc.lv-macular'},
  {key:'lv-diabetic', sim:true, kind:'lowvision', lv:'diabetic', name:'viz.lv-diabetic',desc:'viz.desc.lv-diabetic'},
  {key:'blind', sim:true, kind:'blind', name:'viz.blind', desc:'viz.desc.blind'},
];
export const VIZ_BY_KEY: Record<string, VizMode> = Object.fromEntries(VIZ_MODES.map((m): [string, VizMode] => [m.key, m]));
export const VIZ_FILTER: Record<string, string> = {'sim-deuter':'url(#cvd-deuter)','sim-protan':'url(#cvd-protan)','sim-tritan':'url(#cvd-tritan)',
  'fix-protan':'url(#cvd-fix-protan)','fix-deuter':'url(#cvd-fix-deuter)','fix-tritan':'url(#cvd-fix-tritan)',
  'lv-blur':'blur(2.4px)', 'lv-haze':'contrast(.58) brightness(1.14) blur(.6px)', 'lv-tunnel':'blur(.5px)', 'lv-macular':'', 'lv-diabetic':'blur(.8px)', 'blind':'brightness(0)'};
export const VIZ_CYCLE: string[] = VIZ_MODES.map((m) => m.key);

/**
 * Does this mode simulate a disability? An unknown (or empty) key → false, because the question the caller is asking is
 * "can I turn this off without taking anything from anyone?", and the honest answer in front of the unknown is no.
 */
export function simulatesDisability(key: string): boolean {
  return VIZ_BY_KEY[key]?.sim === true;
}

/**
 * The colour-blindness CORRECTIONS: they daltonise the screen for whoever HAS the condition. Derived from the catalogue,
 * never listed by hand — they are exactly the filters that do not simulate.
 *
 * They exist as a list of their own because they live in the VISUAL ACCESSIBILITY menu, and not in the empathy one (the
 * Dev's decision, issue #60). With `kind` not telling simulating from correcting, the empathy panel, which cuts itself
 * by `kind:'filter'`, dragged the three along: two opposite audiences in one list — whoever wants to feel what being
 * colour-blind is like, and whoever is.
 */
export const VIZ_CORRECTIONS: readonly VizMode[] = VIZ_MODES.filter((m) => m.kind === 'filter' && !m.sim);

/* ===================== TWO STACKS UNDER ONE NAME ===================== */
//
// What the menu calls "visual accessibility" is TWO stacks under one name — the engine's second consumer measured it:
// the `hcnew` modes REPAINT tile TEXTURES in PIXI, and a quiz has no tiles to repaint. One stack is DOM/CSS
// (colour-blindness filters, typography, letter case) and serves any game; the other is CANVAS (direct rendering,
// outlines, role colours) and only exists where there is a world.
//
// This is the cut, and it is one of DATA, not of files — the files were already apart (`render/cvd-matrices` is pure
// DOM; `render/high-contrast` repaints a world whose tiles it is handed). What was missing was the table SAYING which
// stack each mode belongs to, so nobody rebuilds the answer in their head.
//
// And it was being rebuilt: the second consumer wrote
//     `VIZ_MODES.filter((m) => m.kind === 'normal' || (m.kind === 'filter' && !simulatesDisability(m.key)))`
// — an expression mixing TWO different questions ("does it need a canvas?" and "does it simulate a disability?") that
// every future consumer would have to reinvent, with the chance of getting one right and the other wrong.

/** Does this mode need a world CANVAS to exist? Only the `hcnew` ones do: they repaint textures. */
export function needsCanvas(key: string): boolean {
  return VIZ_BY_KEY[key]?.kind === 'hcnew';
}

/**
 * The modes that work in ANY game — the ones applied as a CSS filter over an element.
 *
 * Derived, never listed by hand: a new mode enters the right stack because of the `kind` it declares, not because
 * someone remembered to add it here. The same rule as `VIZ_CORRECTIONS`.
 */
export const VIZ_DOM_ONLY: readonly VizMode[] = VIZ_MODES.filter((m) => !needsCanvas(m.key));

/** The modes that REQUIRE a world. The exact complement of `VIZ_DOM_ONLY` — together, the 16, no leftover and no repeat. */
export const VIZ_CANVAS_ONLY: readonly VizMode[] = VIZ_MODES.filter((m) => needsCanvas(m.key));
