// SPDX-License-Identifier: AGPL-3.0-or-later
// core/calm-mode — SENSORY COMFORT IN THREE LEVELS, and what each one silences (ADR-0028; issue #203).
//
// 🔴 WHY THIS LEFT `ui/pause-icons`: that module had reached 695 lines of code and 127 decision nodes (ADR-0221), and this
// group is not about ICONS. It is about what a child who cannot bear noise needs the engine to silence — the icon is one of
// the surfaces she asks through; the panel row is another. A module that answers «what does level 2 do to the audio?» should
// not require reading a file about the accessibility bar to be found.
//
// ⚠️ A LEAF MODULE: zero imports, zero DOM, zero storage. Everything here is a question with an answer — which is what makes
// the destructive clamp of level 1 testable without mounting anything.
//
// 📌 WHAT IT NEVER TOUCHES, and it is the decision that defines it: TTS, sonar, ledge guard and guide. The calm level is about
// NOISE, not about losing navigation — a child in silent mode still needs to hear where she is.

/** The calm cycle: 0 = normal · 1 = quiet (reduces) · 2 = silent (switches off). */
export const CALM_NAMES: readonly string[] = ['calm.off', 'calm.quiet', 'calm.silent'];

/** The audio categories calm mode governs. The others are left intact on purpose (see the header). */
export const CALM_AUDIO_CATS: readonly string[] = ['ambient', 'music', 'earcons', 'interact'];

/** One step of the cycle. */
export const nextCalmMode = (cur: number): number => (cur + 1) % CALM_NAMES.length;

/**
 * The stored level, sanitised, with the caller's fallback.
 *
 * ⚠️ Data from the browser is data from OUTSIDE: an invented level would pick `CALM_NAMES[3]`, which is `undefined`, and the
 * announcement to the screen reader would come out empty — the child who depends on it would hear silence and not know which
 * level she is in.
 */
export function sanitiseTeaLevel(raw: number, fallback: number): number {
  return Number.isInteger(raw) && raw >= 0 && raw < CALM_NAMES.length ? raw : fallback;
}

/**
 * What the level does to ONE audio category.
 *
 * 📌 The clamp of level 1 is DESTRUCTIVE, and it is in plain sight for that reason: it writes 0.3 over the volume the child
 * chose, and going back to level 0 returns the stored value, not the one she had before. Extracted so that this can be
 * measured by a case.
 */
export function calmAudioPlan(calmMode: number, vol: number): { on: boolean; vol: number } {
  if (calmMode === 0) return { on: true, vol };
  if (calmMode === 1) return { on: true, vol: Math.min(vol, 0.3) };
  return { on: false, vol };
}

/** What the level does to the two reduced-motion flags. */
export function calmMotionPlan(calmMode: number): { sceneReduced: boolean; charFrozen: boolean } {
  return { sceneReduced: calmMode >= 1, charFrozen: calmMode === 2 };
}
