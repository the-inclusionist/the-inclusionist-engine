// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/motion-choices — WHAT A MOVEMENT CHOICE IS, with no document anywhere near it.
//
// 📌 THE SUITE HAD ALREADY DRAWN THIS SEAM, which is what makes the cut a reading and not an opinion:
// `tests/settings-motion.node.test.js` exercises exactly these names, and the node project mounts no document — so
// whoever wrote those cases had to know where the panel stops being a panel. It is the fifth module to come out this
// way, after `ui/audio-choices`, `ui/typo-choices`, `ui/control-choices` and `ui/visual-choices`.
//
// What lives here answers «what is each target called, is everything already frozen, and what does the screen reader
// hear»; what stays in `ui/settings-motion` is the work its name never mentioned — mounting the rows, reconciling
// them with the cartridge, wiring them and reflecting the choice.

import { t } from '../core/i18n.js';
import type { MotionSceneKey, MotionCharDef, MotionPlayer, MotionSceneFlags } from './motion-scene.js';

/**
 * Target → i18n KEY of the label. KEYS, and not text, for the usual reason: a `const` table of text resolves ONCE, on
 * import, and stays frozen in the boot language.
 *
 * And it is ONE table: `rmChar[].lbl` holds a key of THIS table rather than a copy of the label, because copies of the
 * same labels with nothing linking them make changing one label a multi-file edit where forgetting one is silent.
 */
export const RM_LABEL: Record<string, string> = {
  parallax: 'rm.parallax', decor: 'rm.decor', items: 'rm.items',
  walk: 'rm.walk', breath: 'rm.breath', flavor: 'rm.flavor', particles: 'rm.particles',
};

/** i18n KEYS of the three CRT effects (see `RM_LABEL`). */
export const CRT_LBL: Record<'scan' | 'vig' | 'round', string> = { scan: 'rm.crt.scan', vig: 'rm.crt.vig', round: 'rm.crt.round' };

// ⚠️ KEYS, because the levels are words the child hears: a raw word here would announce a level in one language inside a
// game running in another (ADR-0151 made the corners steps ⯇ ⯈).
export const CRT_ROUND_LEVELS: readonly string[] = ['crt.round.off', 'crt.round.small', 'crt.round.large'];

/** The selected player never points outside the current number of screens. */
export function clampSelectedPlayer(selected: number, total: number): number {
  return selected >= total ? 0 : selected;
}

/** true when EVERYTHING (scene + selected character) already has reduced motion ON, that is, frozen — the name follows
 *  `rm[k]`/`player[prop]`, which mean "reduced", not "animated". Decides whether the master button offers "Resume"
 *  (true) or "Stop" (false). */
export function allMotionFrozen(rmKeys: readonly MotionSceneKey[], rm: MotionSceneFlags, rmChar: readonly MotionCharDef[], player: MotionPlayer | undefined): boolean {
  // 🔴 WITH NO CHARACTER, THE CHARACTER HALF DOES NOT COUNT. Requiring `player && player[c.prop]` for every target is
  // ALWAYS FALSE when there is no player: in a game that declares no `players` — a quiz, a puzzle — `allFrozen` would
  // stay `false`, the master button would compute `next = true` on EVERY click, and a child who stopped all the
  // animations would have no way to bring them back. That costs most to whoever froze them because they needed to:
  // that person does not press the button out of curiosity, they press it feeling sick.
  //
  // 📌 With a player nothing changes: `!player` is false and the count is target by target.
  return rmKeys.every((k) => rm[k]) && (!player || rmChar.every((c) => !!player[c.prop]));
}

/** allFrozen=true (everything already frozen) → offers "Resume"; otherwise → offers "Stop". */
export function motionMasterLabel(allFrozen: boolean): string {
  return t(allFrozen ? 'a11y.resumeAll' : 'a11y.stopAll'); // no glyph in the name (ADR-0159 rule 12), in the page's language
}

/** `label` arrives ALREADY TRANSLATED, and the state is a frame with `{alvo}` rather than a concatenated suffix — which
 *  lets a language put the state BEFORE the target, something a concatenation does not allow. */
export function sceneMotionAnnouncement(label: string, frozen: boolean): string {
  return t(frozen ? 'sr.rm.frozen' : 'sr.rm.animated', { alvo: label });
}

export function crtToggleAnnouncement(label: string, on: boolean): string {
  return t(on ? 'sr.crt.on' : 'sr.crt.off', { efeito: label });
}

export function crtLevelLabel(level: number): string {
  const key = CRT_ROUND_LEVELS[level];
  return key ? t(key) : '';
}

export function crtRoundAnnouncement(label: string, level: number): string {
  return t('sr.crt.round', { efeito: label, nivel: crtLevelLabel(level) });
}

/** `nowFrozen` = the NEW value of rm[k]/player[prop] applied by the master button (true = everything was just frozen;
 *  false = everything was just resumed). */
export function stopResumeAllAnnouncement(nowFrozen: boolean): string {
  return t(nowFrozen ? 'sr.rm.allStopped' : 'sr.rm.allResumed');
}
