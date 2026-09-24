// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-axes — THE TWO AXES, and the simulation that is NOT one of them (ADR-0076). Only dependency: the shapes,
// from `core/visual-state`.
//
// ========================= THE DEFECT THIS FIXES =========================
// With ONE radio and `p.viz` keeping ONE string, choosing `fix-deuter` turned 7:1 contrast off, and choosing a contrast
// level turned the correction off. ⚠️ A COLOUR-BLIND CHILD WHO ALSO NEEDS HIGH CONTRAST COULD NOT HAVE BOTH — and the
// two needs often coexist in one person. Two axes let them.
//
// ========================= WHY THE SIMULATION IS NOT AN AXIS =========================
// Correction and simulation are both implemented as a filter and serve OPPOSITE PURPOSES: one lets a child PLAY, the
// other lets someone FEEL what not being able to is like. Grouping them by mechanism merged them twice — in ADR-0011
// (the corrections listed in the Empathy panel, so that *«a criança que PRECISAVA da correção tinha de a procurar no
// menu sobre fingir»*) and in ADR-0075.
//
// ⚠️ A GROUP OF SETTINGS IS NAMED FOR WHAT IT SERVES, NEVER FOR HOW IT IS IMPLEMENTED.
//
// ========================= AND WHY THE SIMULATION IS LOCKED TO BOTH DEFAULTS =========================
// Over an already corrected screen, a simulation shows neither the disability nor the correction; over a high-contrast
// theme, it shows what the theme does and not what deuteranopia does. A demonstration running over an adaptation is not
// a weaker demonstration — **it teaches something false**.

// The shapes live in `core/visual-state` (issue #167: `core/entity` holds them and may not import upward); the names
// stay exported here, where cartridges import them.
import type {
  Theme as TemaDoCore, Correction as CorrecaoDoCore, Simulation as SimulacaoDoCore, VisualState as VisualStateDoCore,
} from '../core/visual-state.js';
/** The CONTRAST axis (`core/visual-state`). */
export type Theme = TemaDoCore;
/** The COLOUR CORRECTION axis (`core/visual-state`). */
export type Correction = CorrecaoDoCore;
/** The simulation, which is NOT an axis (`core/visual-state`). */
export type Simulation = SimulacaoDoCore;
/** ONE player's visual state (`core/visual-state`). The field names and values stay Portuguese: they are stored. */
export type VisualState = VisualStateDoCore;

export const DEFAULT_VISUAL: VisualState = Object.freeze({ tema: 'padrao', correcao: 'tricro', simulacao: null });

/**
 * Are both axes at their default?
 *
 * ⚠️ IT IS THE QUESTION THAT RELEASES THE SIMULATION, which is why it is a function and not a stored boolean: storing the
 * result would let the two drift apart, and here a drift means a demonstration running over an adaptation — which
 * teaches something false.
 */
export function bothAxesAtDefault(v: VisualState): boolean {
  return v.tema === 'padrao' && v.correcao === 'tricro';
}

/**
 * Can this simulation run NOW? And if not, why?
 *
 * ⚠️ IT RETURNS THE REASON AND NOT JUST `false`. ADR-0076 requires the refusal to be VISIBLE and explained — never
 * silently removed, never accepted then ignored. And the reason is a FACT ABOUT THE DEMONSTRATION, not a reproach to
 * whoever chose: whoever turned high contrast on did so because they need it.
 */
export type UnavailableReason = 'tema' | 'correcao' | 'ambos';
export function simulationUnavailable(v: VisualState): UnavailableReason | null {
  const t = v.tema !== 'padrao';
  const c = v.correcao !== 'tricro';
  if (t && c) return 'ambos';
  if (t) return 'tema';
  if (c) return 'correcao';
  return null;
}

/* ===================== THE COMPOSITION ===================== */
//
// ⚠️ IT WAS ALWAYS MECHANICALLY POSSIBLE, which is what made the defect costlier than it looked: the high-contrast THEME
// goes through DIRECT RENDERING (`DIRECT_CFG`/PIXI) and the CORRECTION through a CSS FILTER (`url(#cvd-fix-*)`). Two
// mechanisms that do not collide. What kept them from coexisting was not the machine — it was the single field that
// held one value.

/** The DIRECT mode key this theme uses, or `null` for the default theme. */
function directTheme(v: VisualState): string | null {
  return v.tema === 'hc3' ? 'hc-direto'
    : v.tema === 'hc45' ? 'hc-direto-45'
      : v.tema === 'hc7' ? 'hc-direto-7'
        : null;
}

/**
 * The CSS FILTER key this state uses, or `null`.
 *
 * ⚠️ SIMULATION BEATS CORRECTION HERE, and it is not a hidden precedence rule: the two cannot coexist because
 * `simulationUnavailable` already keeps them apart — a simulation only runs with the correction at its default. This
 * branch is what happens when someone builds by hand a state the interface would not let them build, and picking the
 * simulation is the less wrong of the two: it is the most recent and most visible intent.
 */
export function filterKey(v: VisualState): string | null {
  if (v.simulacao) return v.simulacao;
  return v.correcao === 'tricro' ? null : 'fix-' + (v.correcao === 'deuter' ? 'deuter' : v.correcao);
}

/**
 * The TWO things the root needs to apply, in one object.
 *
 * ⚠️ Returning both TOGETHER is the point of issue #104: while they were one field, applying one erased the other. Here
 * a state with theme `hc7` and correction `deuter` returns both filled in, and that is what the gate asserts.
 */
export interface HowItApplies {
  /** The direct mode key (high contrast), or `null`. */
  readonly direct: string | null;
  /** The CSS filter key (correction or simulation), or `null`. */
  readonly filter: string | null;
}
export function howItApplies(v: VisualState): HowItApplies {
  return { direct: directTheme(v), filter: filterKey(v) };
}

/* ===================== WHAT THE READERS ACTUALLY ASK ===================== */
//
// ⚠️ THESE FUNCTIONS CAME FROM A MEASUREMENT, not from an a-priori design: the readers of `p.viz` were sorted by what they
// ASK, and the short list below is the result — whether it is a simulation, blindness, low vision, high contrast, which
// texture. A reader that needs something outside this list is a sign its question deserves a name.
//
// ⚠️ And the interface already thought in two axes: the quick bar's two icons always cycled WITHIN their own axis; it
// was the STORAGE that collapsed them into one field. The cycle functions below are those two, now with a place to keep
// the result.

/** Is a simulation running? The question `simulatesDisability` asked of the string. */
export function isSimulation(v: VisualState): boolean {
  return v.simulacao !== null;
}

/** Is it the BLINDNESS simulation? The quiz and the sonar ask this to behave without a screen. */
export function isBlind(v: VisualState): boolean {
  return v.simulacao === 'blind';
}

/** Is it one of the five LOW-VISION simulations? They need the overlay as a texture, not only a filter. */
export function isLowVision(v: VisualState): boolean {
  return v.simulacao !== null && v.simulacao.startsWith('lv-');
}

/** Is the theme off its default? It replaces a `/^hc-direto/` test on the old string. */
export function hasHighContrast(v: VisualState): boolean {
  return v.tema !== 'padrao';
}

/** The next THEME in the quick bar icon's cycle. It moves only on its own axis and does not touch the correction. */
export function nextTheme(v: VisualState): VisualState {
  const i = THEMES.indexOf(v.tema);
  return { ...v, tema: THEMES[(i < 0 ? 0 : i + 1) % THEMES.length]! };
}

/**
 * The next CORRECTION in the icon's cycle. It moves only on its own axis and does not touch the theme.
 *
 * ⚠️ AN UNKNOWN VALUE STARTS AT THE DEFAULT, on both axes. (One old cycle mapped it to index 1 and the other to 0 — a
 * difference nobody had decided.) An unknown value is exactly the case where nobody knows what the child wanted — and
 * the default is the only answer that does not choose for them.
 */
export function nextCorrection(v: VisualState): VisualState {
  const i = CORRECTIONS.indexOf(v.correcao);
  return { ...v, correcao: CORRECTIONS[(i < 0 ? 0 : i + 1) % CORRECTIONS.length]! };
}

/**
 * The key the player's sprite uses to pick a texture.
 *
 * ⚠️ It is the SIMULATION when there is one, and the THEME when there is not — in this order because it is the order of
 * what the child sees: a simulated blindness blanks the whole screen, and at that moment the theme changes nothing they
 * perceive.
 */
export function textureKey(v: VisualState): string {
  return v.simulacao ?? directTheme(v) ?? 'normal';
}

/**
 * The ONE key that best describes this state in the OLD vocabulary — for whoever can only read one.
 *
 * ⚠️ IT IS NOT `textureKey`, and the difference took a red gate to show. The texture one returns `normal` for a colour
 * correction, because a correction changes no texture — and using it as the mirror would make a child in `fix-deuter`
 * start writing `'normal'` into the legacy key. **An old reader would lose their correction**, which is exactly the
 * damage the whole migration exists not to do.
 *
 * The order is simulation → theme → correction → default, and it keeps EVERY setting that already existed: no old state
 * had two axes, so none of them loses anything here.
 *
 * ⚠️ THE ONLY LOSSY CASE IS THE NEW ONE — `hc7 + fix-deuter` fits only as one of its two halves, and the chosen one is
 * the theme. There is no possible regression in that: this state DID NOT EXIST before, and a reader that understands one
 * key never could express it. Whoever wants both halves reads the new key, which exists precisely for that.
 */
export function legacyKey(v: VisualState): string {
  return v.simulacao ?? directTheme(v) ?? filterKey(v) ?? 'normal';
}

/* ===================== THE MIGRATION ===================== */
//
// ⚠️ IT IS NOT OPTIONAL AND IT COMES BEFORE THE FIRST READ OF THE NEW SHAPE. The saved setting keeps the old single value;
// without the translation, the visual mode each child already chose is DISCARDED — and whoever chose one of those values
// chose it because that is how they see.

/** The old single value → the two-axis state. An unknown key falls to the default and never throws. */
const FROM_SINGLE_KEY: Readonly<Record<string, VisualState>> = Object.freeze({
  normal: DEFAULT_VISUAL,

  // The three contrast levels become a THEME, and the correction stays at its default.
  'hc-direto': { tema: 'hc3', correcao: 'tricro', simulacao: null },
  'hc-direto-45': { tema: 'hc45', correcao: 'tricro', simulacao: null },
  'hc-direto-7': { tema: 'hc7', correcao: 'tricro', simulacao: null },

  // The three corrections become a CORRECTION, and the theme stays at its default.
  'fix-protan': { tema: 'padrao', correcao: 'protan', simulacao: null },
  'fix-deuter': { tema: 'padrao', correcao: 'deuter', simulacao: null },
  'fix-tritan': { tema: 'padrao', correcao: 'tritan', simulacao: null },

  // ⚠️ THE NINE SIMULATIONS COME BACK WITH BOTH AXES AT THEIR DEFAULT, and no information is lost: a simulation was only
  // possible from the default anyway, because it REPLACED everything else. The new shape says so instead of leaving it
  // implicit.
  'sim-protan': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-protan' },
  'sim-deuter': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-deuter' },
  'sim-tritan': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-tritan' },
  'lv-blur': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-blur' },
  'lv-haze': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-haze' },
  'lv-tunnel': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-tunnel' },
  'lv-macular': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-macular' },
  'lv-diabetic': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-diabetic' },
  blind: { tema: 'padrao', correcao: 'tricro', simulacao: 'blind' },
});

/**
 * Translates the saved value. It accepts the old one (a string) and the new one (an object), and always returns a
 * valid state.
 *
 * ⚠️ IDEMPOTENT BY CONSTRUCTION: an already migrated object passes through with its fields checked. It matters because
 * the read happens per player and more than once a session.
 *
 * ⚠️ AND THE UNKNOWN FALLS TO THE DEFAULT INSTEAD OF THROWING. The data comes from a child's browser and may be from a
 * future version, another machine, or garbage. A `throw` here would take the game down over a preference; the default
 * just gives the game back as it is born.
 */
export function migrateVisual(saved: unknown): VisualState {
  if (typeof saved === 'string') return FROM_SINGLE_KEY[saved] ?? DEFAULT_VISUAL;
  if (saved && typeof saved === 'object') {
    const o = saved as Partial<VisualState>;
    return {
      tema: THEMES.includes(o.tema as Theme) ? (o.tema as Theme) : DEFAULT_VISUAL.tema,
      correcao: CORRECTIONS.includes(o.correcao as Correction) ? (o.correcao as Correction) : DEFAULT_VISUAL.correcao,
      simulacao: SIMULATIONS.includes(o.simulacao as Simulation) ? (o.simulacao as Simulation) : null,
    };
  }
  return DEFAULT_VISUAL;
}

export const THEMES: readonly Theme[] = ['padrao', 'hc3', 'hc45', 'hc7'];
export const CORRECTIONS: readonly Correction[] = ['tricro', 'protan', 'deuter', 'tritan'];
export const SIMULATIONS: readonly Simulation[] = [
  null, 'sim-protan', 'sim-deuter', 'sim-tritan',
  'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind',
];

/** The old keys the migration knows — exported so the gate can demand that ALL of them are covered. */
export const LEGACY_KEYS: readonly string[] = Object.keys(FROM_SINGLE_KEY);
