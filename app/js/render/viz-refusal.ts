// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-refusal — WHY THE SIMULATION IS NOT AVAILABLE, told to the child (ADR-0076, issue #104).
//
// ========================= WHAT THE REFUSAL HAS TO DO, AND WHAT IT MUST NOT DO =========================
// ADR-0076 requires an unavailable simulation to appear **VISIBLE and explained** — «never silently removed, never
// accepted then ignored». The two halves of that sentence describe two different defects:
//
//   · REMOVING SILENTLY teaches that the thing does not exist. An adult who showed the simulation to a class yesterday
//     and cannot find it today concludes it was taken away, not that they themselves turned high contrast on.
//   · ACCEPTING AND IGNORING is worse: the demonstration SEEMS to be running. Over an already corrected screen it shows
//     neither the disability nor the correction; over a high-contrast theme it shows what the THEME does and not what
//     deuteranopia does. ⚠️ It is not a weaker demonstration — **it teaches something false**.
//
// ⚠️ AND THE REASON IS A FACT ABOUT THE DEMONSTRATION, NEVER A REPROACH TO WHOEVER CHOSE. Whoever turned high contrast
// on did so because they need it; whoever turned colour correction on sees better with it. The sentence says what the
// demonstration needs to be honest, and how to go back — never "turn that off".
//
// ========================= WHY THIS IS A PURE MODULE =========================
// The same shape as `ui/reach-notice`: it returns DATA (an i18n key + parameters), not ready text. The sentence belongs
// to the interface and has to go through `t()`; returning prose from here would put a language in a module that has
// none. And, being pure, the refusal's design can be checked in the `node` project, with no document.
//
// A leaf module: it imports only the types and the predicate of the two-axis model.
import { simulationUnavailable, type UnavailableReason, type VisualState } from './viz-axes.js';

/** A line ready to translate: the key and what it needs. `null` = nothing to say. */
export interface Refusal {
  readonly key: string;
  /** What the child has to undo for the demonstration to be honest. */
  readonly axis: UnavailableReason;
}

/**
 * The reason's i18n key, per axis off its default.
 *
 * ⚠️ THREE KEYS AND NOT ONE WITH A PARAMETER, and the difference is one of translation, not style: in Portuguese
 * «o tema» and «a correção de cor» take different articles, and «os dois» is the plural of neither. A sentence with an
 * axis parameter would force each language to build agreement from a loose noun — exactly the defect `sr.nav.clockOne`
 * already recorded for «às 1 horas».
 */
export const REASON_KEY: Readonly<Record<UnavailableReason, string>> = Object.freeze({
  tema: 'sim.indisponivel.tema',
  correcao: 'sim.indisponivel.correcao',
  ambos: 'sim.indisponivel.ambos',
});

/**
 * Can this simulation be offered? And if not, what to say.
 *
 * `null` = it can; the interface shows nothing, because a notice that always appears stops being read.
 */
export function simulationRefusal(v: VisualState): Refusal | null {
  const reason = simulationUnavailable(v);
  return reason === null ? null : { key: REASON_KEY[reason], axis: reason };
}

/**
 * Should the simulation appear DISABLED instead of vanishing?
 *
 * ⚠️ ALWAYS, AND IT IS ADR-0076's «never silently removed» HALF. It exists as a function with a name of its own, and not
 * as a `!refusal` at the call site, because it answers a different question: `simulationRefusal` says *why* it cannot;
 * this one says *that the line stays on screen*. Whoever draws needs both, and merging them would make the answer
 * "there is no reason" look like "do not draw the line".
 */
export function showsEvenWhenUnavailable(): boolean {
  return true;
}
