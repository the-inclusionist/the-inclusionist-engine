// SPDX-License-Identifier: GPL-3.0-or-later
// Locale en — SEED (só as chaves-piloto; completar UI+Matemática+Lúdico na Etapa 4). Ver docs/plano-i18n.md.
// Parcial de propósito: as chaves ausentes caem no fallback pt (core/i18n).
const en: Record<string, string> = {
  // ===================== SCREEN-READER ANNOUNCEMENTS (`sr.*`) =====================
  // THE FRAME TRANSLATES; THE CONTENT DOES NOT. Anything arriving through `{param}` passes through untranslated —
  // player name, screen count, and above all CURRICULUM CONTENT (word, syllable, letter, braille cell). The literacy
  // curriculum is language-specific: spelling, grapheme-phoneme mapping and Ferreiro's psychogenesis are not
  // translated, they are rewritten per language (ADR-0010, pillar 3). A new key embedding curriculum is a bug.
  'sr.pad.mapSaved': 'Mapping saved for: {id}.',
  'sr.pad.assigned': 'Controller assigned to Player {n}. The keyboard still works.',
  'sr.title.waitP1': 'Wait for Player 1 to choose the game.',
  'sr.player.entered': 'Player {n} joined!',
  'sr.print.on': 'Print mode: see the screen without menus. Press any button to go back.',
  'sr.player.pressToJoin': 'Player {n}: press a button to join.',
  'sr.libras.loading': 'The sign-language interpreter is still loading — try again in a moment.',
  'sr.eyes.loadFailed': 'WebGazer did not load.',
  'sr.eyes.calibrate': 'Play with your eyes: look around the screen and click a few spots to calibrate. Looking left and right walks; looking up jumps.',
  'sr.eyes.needsInternet': 'WebGazer could not be loaded (it needs the internet the first time).',
  'sr.typo.font': 'Typeface: {fam}.',
  'sr.visual.contrast': 'High contrast: {v}.',
  'sr.visual.lq': 'Contrast boost: {v}.',
  'sr.gate.open': 'Gate open!',
  'sr.key.taken': '{who}picked up the key. Touch the gate to open it.',
  'sr.key.returned': 'The key went back to where it started.',
  'sr.power.swapHint': '{msg} (Swap power cycles through the ones you have.)',

  'sr.round.multi': '{n} players, one per screen. Race for the coins.',
  'sr.round.somasub': 'Add-and-Subtract mode. Touch the shapes and solve the sums.',
  'sr.round.silabas': 'Syllables mode. Touch the letters and build the words.',
  'sr.round.ludico': 'New round. Collect 10 coins.',

  'sr.screens.mobileOnly': 'On a phone the game runs on a single screen.',
  'sr.screens.alreadyN': '{n} screens already active.',
  'sr.screens.already1': 'One screen.',
  'sr.screens.wontFitN': '{n} screens do not fit in this window — each screen needs at least 640 by 360. Make the window bigger or go full screen.',
  'sr.screens.wontFitOneMore': 'One more screen does not fit in this window — each screen needs at least 640 by 360. Make the window bigger or go full screen.',
  'sr.screens.activeN': '{n} screens active.',
  'sr.screens.newRoundN': '{n} screens active — new round.',
  'sr.screens.newRound1': 'One screen — new round.',
  'sr.screens.maxPlayers': 'There are already 4 players.',

  'sr.player.restarted': 'Player {n} started over on this screen.',
  'sr.player.joined': 'Player {n} joined the game in progress.',
  'sr.player.quit': 'Player {n} left the game.',

  // HUD objective (DOM text; same decision tree as the round announcement)
  'hud.objective.multi': '{n} players — race for the {alvo} coins',
  'hud.objective.somasub': 'Solve 10 sums',
  'hud.objective.silabas': 'Build 10 words',
  'hud.objective.ludico': 'Collect 10 coins',

  'skip.toGame': 'Skip to the game',
  'menu.ludico': 'Free Play',
  'menu.alfabetizacao': 'Literacy',
  'menu.matematica': 'Math',

  // Touch controls — the 9 slot labels, the 9 mappable actions (#touchcfg panel) and the announcements.
  'touch.slot.up': 'D-pad ↑ (up)',
  'touch.slot.down': 'D-pad ↓ (down)',
  'touch.slot.left': 'D-pad ← (left)',
  'touch.slot.right': 'D-pad → (right)',
  'touch.slot.start': 'START (enter)',
  'touch.slot.b0': 'Button 0 (bottom)',
  'touch.slot.b1': 'Button 1 (right)',
  'touch.slot.b2': 'Button 2 (left)',
  'touch.slot.b3': 'Button 3 (top)',
  'touch.slot.fallback': 'Button',
  'touch.act.left': 'Walk left',
  'touch.act.right': 'Walk right',
  'touch.act.up': 'Climb up / ladder',
  'touch.act.down': 'Climb down / ladder',
  'touch.act.jump': 'Jump',
  'touch.act.run': 'Run / interact',
  'touch.act.especial': 'Special',
  'touch.act.swap': 'Swap power',
  'touch.act.pause': 'Pause (START)',
  'touch.dir.cross': 'cross (D-pad)',
  'touch.dir.stick': 'analogue stick',
  'sr.touch.slotSet': '{slot}: {acao}.',
  'sr.touch.dirSet': 'Directional: {tipo}.',
  'sr.touch.presetChild': 'Controls sized for a child hand (6 to 12 years).',
  'sr.touch.presetAdult': 'Controls sized for an adult hand.',
};
export default en;
