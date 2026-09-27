// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO DOORS OF OPTIONS DO NOT START ALIKE (ADR-0146 §3). The pause root has two doors to options — the settings that
// travel with the child (`options`) and this game's own (`opcoesdojogo`) — and a child who hears the menu, or scans it one
// item at a time, decides by the FIRST word. So the word that tells them apart comes first, in every language the game
// speaks: two names that open alike make her wait for the rest of the sentence to know which door she is on.
//
// The name of a pause item is `pause.<act>` (`ui/pause-markup`, one rule for every item), so the dictionaries ARE the names.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';
import { PM_BTNS } from '../app/js/ui/pause-buttons.js';

const DOORS = ['options', 'opcoesdojogo'];
/** The first word as it is heard: case and accents do not tell two words apart to the ear. */
const firstWord = (name) => name.trim().split(/\s+/)[0].normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

describe('the two doors of options start with different words (ADR-0146 §3)', () => {
  it('🎯 [Existence] both doors are items of the pause root — the case measures real names', () => {
    const acts = PM_BTNS.map((b) => b.act);
    for (const act of DOORS) expect(acts, `«${act}» is not a pause-root item`).toContain(act);
  });

  for (const [language, dict] of [['pt', pt], ['en', en], ['es', es]]) {
    it(`🔴 [Right] ${language}: «${dict['pause.options']}» and «${dict['pause.opcoesdojogo']}» open with different words`, () => {
      const [general, game] = DOORS.map((act) => dict[`pause.${act}`]);
      expect(general && game, 'a door has no name in this language').toBeTruthy();
      expect(firstWord(general), 'the two doors open alike: the child hears the same first word for both').not.toBe(firstWord(game));
    });
  }
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-27, each applied to a dictionary and restored from a copy)
//   P1 pt `pause.opcoesdojogo` → «Configurações do jogo»            🔴 pt
//   P2 en `pause.opcoesdojogo` → «Inclusion options»                🔴 en (both would open with «Inclusion»)
//   P3 es `pause.options` → «Opciones de inclusión»                  🔴 es
