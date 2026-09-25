// SPDX-License-Identifier: AGPL-3.0-or-later
// core/setting-defaults.ts — WHAT A DEFAULT IS, for every setting the child keeps (ADR-0028, ADR-0029): one source, read by the
// boot when nothing is stored and by each panel's «restore defaults».
//
// 📌 A STATELESS MODULE ON PURPOSE (ADR-0232, issue #207): outside the composition root a module imports by value only what
// holds no state and reaches no global. The defaults are a frozen table and a function of what the operating system answers,
// so a panel that only compares against them must not import `core/state`, the page's one settings store, to read them.
// `core/state` imports them from here.
import type { CameraControl } from './camera-cycle.js';
import type { SessionEnding } from './session-clock.js';

/**
 * The browser's media-query question, as the composition root passes it (`win.matchMedia`). Only `matches` is read.
 * A test passes a double; nothing here reaches `window`.
 */
export type MediaQuery = (query: string) => { readonly matches: boolean };

/**
 * The REDUCED MOTION default is not a constant — it is what the operating system asks for, asked NOW and not at boot.
 *
 * It lives beside `DEFAULTS` because ADR-0029's rule is ONE source for what a default is, and a computed default is no less
 * a default for not fitting a frozen object. Its readers are the help slides, the scene flags when nothing is stored, and the
 * motion panel's mark and «restore defaults».
 *
 * Why the reset must read this and not `false`: on a machine whose owner asked for less motion, `false` would TURN THE
 * ANIMATION BACK ON — the reset would do, by itself, exactly what WCAG 2.3.3 exists to prevent, on the screen of someone who
 * already said they cannot take it.
 *
 * 📌 THE QUESTION ARRIVES AS A PARAMETER (ADR-0232): whoever calls passes `matchMedia`; the query itself stays here, once.
 */
export function defaultReducedMotion(matchMedia: MediaQuery): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * THE DEFAULTS, named. One value per line, each used in TWO places: the boot's read (when nothing is stored) and the
 * "restore defaults" of the panel that holds it (ADR-0028).
 *
 * The alternative is writing each default twice — once in the stored read, once in the reset — and two copies nobody
 * forces to agree diverge. Here the divergence would be worse than elsewhere: a reset that restores a value DIFFERENT
 * from what the game uses when nothing was set leaves the child in a third state, neither theirs nor the factory's, that
 * they have no name for when asking for help.
 *
 * `as const` + `Object.freeze` on purpose: a default someone can write at run time stops being a default.
 */
export const DEFAULTS = Object.freeze({
  // hearing
  blindMode: false,
  caneBlockDiv: 1,
  captionsOn: true,
  menuIndexOn: true, // the index is born ON: whoever does not know it exists is whoever needs it most
  // motor
  wheelchair: false,
  oneButton: false,
  inputCooldown: 0,
  switchScan: false,
  voiceControl: false,
  gameSpeed: 1,
  captionPpm: 125,
  speechPpm: 254, // the voice's normal speed, the minimum (ADR-0196)
  noGripStrength: false,
  cameraControl: 'off' as CameraControl,
  easy: false,       // per player (Easy mode)
  toggleMove: false,  // per player (movement by toggling)
  // The run-button toggle is born off at the FACTORY — and switches itself on with the on-screen pad, which is context,
  // not choice. The difference matters to ADR-0029's mark, which marks the stored CHOICE and not the state.
  toggleRun: false,   // per player (run-button toggle)
  // visual
  cbSafe: false,
  ownerColors: true,
  lq: 0,              // the L→Q contrast boost, off
  hcOutlineFg: 1,
  hcOutlineBg: 1,
  // communication (the letter case today; the AAC panel of ADR-0028 widens this)
  letterCase: 'upper',
  // ⚠️ THE LAST TWO are here because they were missing and it had a cost (issue #61): ADR-0029's mark reads `DEFAULTS`
  // and nothing else, so a value with no named default here is one the mark CANNOT mark.
  //   · `calmMode` — the autism-support level (0 normal · 1 calm · 2 quiet).
  //   · `viz` — the vision mode. `'normal'` is the mode that does nothing, now said instead of deduced from an empty
  //     string that happened to match no mode.
  calmMode: 0,
  viz: 'normal',
  // the session clock (ADR-0236 and its erratum of 2026-09-25): an hour, and at the end the clock turns red — the screen does
  // not lock. Both apply whenever no adult has set a value.
  sessionMinutes: 60,
  sessionEnding: 'red' as SessionEnding,
} as const);
