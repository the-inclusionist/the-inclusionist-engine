// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/latch-refusal.ts — WHEN LATCHING IS NOT A CHOICE, and what to say to whoever pressed the button.
//
// ========================= CLAUSE 3 OF ADR-0113 =========================
// «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — the Dev's sentence. With
// eyes, face, gestures and speech, latching is what makes the input work: without it, one command at a time means
// the child cannot move and act.
//
// ⚠️ AND THE CONTROL DOES NOT DISAPPEAR — IT IS DISABLED, WITH THE REASON SAID. Disappearing teaches that the thing
// does not exist: an adult concludes it was removed, not that the webcam requires it. It is the same «never silently
// removed» half that ADR-0076 wrote for the simulation, and this file is the sibling of `ui/simulation-refusal` on
// purpose — same shape, same place in the layer, and so checkable in the `node` project, with no document.
//
// 🔴 AND THE REASON IS A FACT ABOUT THE DEVICE, NEVER A REPRIMAND. "Gaze control needs tap-to-move to work." says why
// the button does not respond; telling the child not to turn it off scolds them for touching a setting they depend
// on. ADR-0076 already paid for this distinction once.
//
// Leaf module: it imports only the pure latching rule.
import { latchIsOptional, ONE_COMMAND_AT_A_TIME } from '../input/latch-scope.js';

/** A line ready to translate. `null` = there is a choice, and nothing to say. */
export interface LatchRefusal {
  readonly key: string;
  /** The transport that requires it — available to whoever wants to compose the sentence another way. */
  readonly transport: string;
}

/**
 * The i18n key of the reason, PER TRANSPORT.
 *
 * ⚠️ FOUR KEYS AND NOT ONE WITH `{aparelho}`, and the reason is translation, not style: «os gestos» is plural and
 * «o olhar» is not, so a single sentence would force each language to build agreement from a loose noun. It is
 * exactly the defect `sr.nav.clockOne` recorded for «às 1 horas», and that `ui/simulation-refusal` already refused
 * for the same reason with its three axes.
 */
export const REFUSAL_KEY: Readonly<Record<string, string>> = Object.freeze({
  olhos: 'alt.exigida.olhos',
  rosto: 'alt.exigida.rosto',
  gestos: 'alt.exigida.gestos',
  fala: 'alt.exigida.fala',
});

/**
 * Can latching be turned off on this device? And if not, what to say.
 *
 * `null` = it can; the interface shows nothing, because a warning that always appears stops being read.
 */
export function latchRefusal(transportName: string): LatchRefusal | null {
  if (latchIsOptional(transportName)) return null;
  const refusalKey = REFUSAL_KEY[transportName];
  // 📌 A transport that requires latching and has no sentence would be a button disabled WITHOUT a reason — worse
  // than the defect this fixes, because the child would not even know there is a reason. The gate asserts that the
  // two sets match; here the absence degrades to "do not refuse", which keeps the control alive.
  return refusalKey ? { key: refusalKey, transport: transportName } : null;
}

/**
 * Does the control stay ON SCREEN when latching is required?
 *
 * ⚠️ ALWAYS, and it is the "does not disappear" half of clause 3. It exists as a function with its own name, and
 * not as a negated refusal at the point of use, because it answers another question: `latchRefusal` says *why* it
 * cannot; this says *that the row stays on screen*. Merging them would make "no reason" look like "do not draw the
 * row".
 */
export function showsEvenWhenRequired(): boolean {
  return true;
}

/** The transports that require latching, for whoever needs to enumerate them. It comes from the RULE, not a copy. */
export const NEED_LATCH: ReadonlySet<string> = ONE_COMMAND_AT_A_TIME;
