// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HOURGLASS ON THE QUICK BAR (ADR-0180; issue #176) — the pure half: which icons mount, what the icon says, how it looks.
//
// 📌 Its own button, beside and never inside toggle keys — the Dev: «Um botão para alternância e outro para velocidade.» An
// hourglass and no animal: «caracol, tartaruga e lebre podem ser ofensivos». It exists only where time runs by itself.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { iconsThatAct, computeIconLabel, computeIconVisual } from '../app/js/ui/pause-icons.js';
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.js';
import { DEFAULTS } from '../app/js/core/setting-defaults.js';
import { DEFAULT_VISUAL } from '../app/js/render/viz-axes.js';
import { createTranslator } from '../app/js/core/i18n.js';
const translator = createTranslator(); // the root's translator, played by the test (ADR-0232 D3)
const translate = translator.t;

const snap = (over = {}) => ({ blindMode: false, ttsOn: false, librasOn: false, calmMode: 0, toggleMove: false, visual: DEFAULT_VISUAL, privateOutput: true, speed: DEFAULTS.gameSpeed, ...over });
const todos = { theme: true, correction: true, holdsKeys: () => true, typography: true };

describe('the hourglass icon', () => {
  it('📌 [Right] it is its own icon, an hourglass, after the eleven — never the finger icon', () => {
    const ampulheta = PAUSE_ICONS.find((ic) => ic.k === 'velocidade');
    expect(ampulheta?.e).toBe('⏳');
    // after the eleven, before the language button that came after it (2026-09-16): a new icon goes at the end and moves none
    expect(PAUSE_ICONS.at(-2)?.k, 'a new icon displaces the ones children already learned').toBe('velocidade');
    expect(PAUSE_ICONS.at(-1)?.k).toBe('idioma');
    expect(PAUSE_ICONS.find((ic) => ic.k === 'altmove')?.e).toBe('☝️');
    expect(PAUSE_ICONS.some((ic) => /[🐌🐢🐇]/u.test(ic.e)), 'an animal stands for slowness').toBe(false);
  });

  it('🔴 [Right] it mounts in a game whose time runs by itself, and not in a turn game', () => {
    expect(iconsThatAct({ ...todos, clock: () => true }).map((ic) => ic.k)).toContain('velocidade');
    expect(iconsThatAct({ ...todos, clock: () => false }).map((ic) => ic.k)).not.toContain('velocidade');
    expect(iconsThatAct(todos).map((ic) => ic.k), 'no clock answer is no hourglass').not.toContain('velocidade');
  });

  it('🔴 [Right] its name says the speed', () => {
    expect(computeIconLabel(translate, 'velocidade', snap({ speed: 0.8 }))).toMatch(/80\s?%/);
    expect(computeIconLabel(translate, 'velocidade', snap({ speed: 1 }))).toMatch(/100\s?%/);
  });

  it('🎯 [Right] it shows as on while the game is slowed, and off at 100%', () => {
    expect(computeIconVisual('velocidade', snap({ speed: 0.6 }))).toMatchObject({ on: true, active: true });
    expect(computeIconVisual('velocidade', snap({ speed: 1 }))).toMatchObject({ on: false, active: false });
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   A1 the icon mounted in every game                      🔴 turn game
//   A2 the label without the value                         🔴 says the speed
//   A3 never shown as on                                   🔴 on while slowed
