// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/guide-intensity — HOW NEAR IT SOUNDS, without a beep (#84 item 2).
//
// ========================= WHAT THIS REPLACES =========================
// The guide used to play a beep at a fixed interval, FOREVER, whether or not anything moved. The Dev's verdict: «um ping
// é a pior escolha possível, tenebroso para quem tem TEA». It was not the frequency that was wrong — it was the beep.
// Playing it "only while walking" would have left the same thing hurting less often.
//
// What replaces it is a CONTINUOUS presence that grows more intense as the child approaches, along the mapped route
// (`core/route`). Nothing fires; the sound simply becomes more present.
//
// ========================= THE AXIS IS BRIGHTNESS, AND THE DECISION IS THE DEV'S =========================
// Four axes were put on the table — volume, brightness (filter cutoff), layers and tempo — and the choice was
// **brightness as the main one, with a small share of volume as secondary**. The reasons, for whoever reopens it:
//
//   · VOLUME ALONE collides with the mixer's slider: a child who turned the `guide` category down would lose the whole
//     signal, and volume change is the most tiring of the four.
//   · TEMPO reads as HURRY, the opposite of what autism-support mode exists to protect.
//   · LAYERS needs composed material, and this engine synthesises.
//   · BRIGHTNESS is continuous, comes from a `BiquadFilter` Web Audio already has, and does not fight the slider.
//
// ⚠️ AND THE SHARE OF VOLUME IS NOT DECORATION: for a child with hearing loss the brightness may fall exactly in the band
// they cannot reach. Two redundant axes mean neither decides alone.
//
// ========================= WHAT THIS MODULE DOES NOT DO =========================
// It plays nothing. It returns two numbers from ONE: how many steps remain along the route. Whoever builds the graph
// plays them, and `core/route` computes the route — it already knows how to go round a wall, and that is what makes the
// intensity honest: it grows with the distance the child will REALLY walk.
//
// A leaf module: it imports nothing.

/** What the guide sounds like, for a given distance. */
export interface Intensity {
  /** The low-pass cutoff, in hertz. Low and muffled far away; open and bright up close. */
  readonly cutoff: number;
  /** A factor on the `guide` category's volume, between `FAR_VOL` and 1. NEVER zero. */
  readonly volume: number;
}

/**
 * From how many steps on the guide stops getting darker.
 *
 * Twelve, and the number is not new: the sonar's distance words cut "very near" at 4 steps and "near" at 9, and its pan
 * saturates the stereo at 11. The guide saturates just after — fine detail serves whoever is arriving, and beyond that
 * "far" is enough.
 */
export const STEPS_TO_FLOOR = 12;

/** The cutoff at the bottom of the scale: muffled, present, never an alarm sound. */
export const FAR_CUT = 320;
/** The cutoff at the target: open. Above this the timbre starts to hiss, and a hiss draws attention like a beep. */
export const NEAR_CUT = 3200;

/**
 * The lowest volume factor.
 *
 * ⚠️ NEVER ZERO, AND IT IS THE MOST IMPORTANT ASSERTION IN THIS FILE. If the guide went mute far away, "far" would be
 * indistinguishable from "there is no target" — and the child who depends on it would conclude there is nothing to find,
 * exactly when there is and it is distant. Silence is a statement, and here it would be a false one.
 */
export const FAR_VOL = 0.55;

/**
 * The intensity for `stepsAway` steps along the route.
 *
 * ⚠️ THE CUTOFF INTERPOLATES EXPONENTIALLY, not linearly, for the reason of #124's earcon: the ear perceives pitch and
 * brightness as a RATIO, not a difference. A linear ramp from 320 to 3200 would open almost everything in the first third
 * of the way and then seem to stand still — the child would feel they had arrived with half the way to go.
 *
 * The volume interpolates LINEARLY, and the asymmetry is deliberate: it is the secondary axis, and an exponential curve
 * there too would make both accelerate at the same point, the opposite of having two axes.
 */
export function guideIntensity(stepsAway: number): Intensity {
  if (!Number.isFinite(stepsAway) || stepsAway < 0) return { cutoff: FAR_CUT, volume: FAR_VOL };
  // 0 = right on the target; 1 = at the bottom of the scale or beyond.
  const far = Math.min(1, stepsAway / STEPS_TO_FLOOR);
  const near = 1 - far;
  return {
    cutoff: FAR_CUT * Math.pow(NEAR_CUT / FAR_CUT, near),
    volume: FAR_VOL + (1 - FAR_VOL) * near,
  };
}
