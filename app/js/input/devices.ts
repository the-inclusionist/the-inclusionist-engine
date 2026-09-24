// SPDX-License-Identifier: AGPL-3.0-or-later
// input/devices.ts — gamepad and touch labels and mappings (data). A leaf module, NO dependencies.
// PAD_DESIGNS: how to label the 4 action buttons per pad model (the browser detects a generic one on Windows).
// TOUCH_DEFAULT: the default map of the 13 touch slots (the 4 shoulder ones since ADR-0160).
//
// WHY KEYS AND NOT TEXT: the table is a module `const`, evaluated ONCE at import. If it held an already resolved `t('…')`,
// the language would freeze at boot — whoever read before a switch would never see the switch. Holding the key, the
// place of use resolves it. This module stays dependency-free on purpose: a key is data, `t` is behaviour and lives in
// the consumer.
export const PAD_DESIGNS: Record<string, Record<string, string[]>> = { // per button: [label, colour]
  generic:{'0':['0','#3a4a6a'],'1':['1','#3a4a6a'],'2':['2','#3a4a6a'],'3':['3','#3a4a6a']},
  microsoft:{'0':['A','#2fae4e'],'1':['B','#d23b3b'],'2':['X','#2f6fd2'],'3':['Y','#d9a400']},
  sony:{'0':['✕','#4f8fd0'],'1':['○','#d23b3b'],'2':['□','#d76fae'],'3':['△','#2fae7e']},
  nintendo:{'0':['B','#d9a400'],'1':['A','#d23b3b'],'2':['Y','#2fae4e'],'3':['X','#2f6fd2']},
};
/**
 * Pad glyphs that CANNOT BE READ ALOUD — the i18n key of each one's spoken name (ADR-0044, item 4).
 *
 * A screen reader reads `✕` as "multiplication sign", or reads nothing, and `△` usually comes out mute. That is why the
 * pause legend carried `aria-hidden="true"`: the noise AND the information were hidden together. Here is the half that
 * was missing to take the attribute off — the glyph stays on screen for whoever recognises it, and the WORD exists for
 * whoever hears it.
 *
 * Only the four PlayStation ones are here. `A`, `B`, `X`, `Y` and `0`–`3` already read, and translating them to "letter
 * A" would add noise in accessibility's name — the defect this item fixes, inside out.
 */
export const PAD_GLYPH_SPOKEN: Record<string, string> = {
  '✕': 'pad.glyph.cross', '○': 'pad.glyph.circle', '□': 'pad.glyph.square', '△': 'pad.glyph.triangle',
};
export const TOUCH_DEFAULT: Record<string, string> = { up:'up',down:'down',left:'left',right:'right',start:'start',b0:'action2',b1:'action3',b2:'action1',b3:'action4',
  // The SHOULDERS (ADR-0160): L1/L2 in the top-left corner, R1/R2 in the right. They show only if the game names them (ADR-0162).
  bl1:'leftShoulder',bl2:'leftTrigger',br1:'rightShoulder',br2:'rightTrigger' };
