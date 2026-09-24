// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/mobility-choices — what the mobility panel's choices ARE, with no panel: the selected player clamped to the players there
// are, whether any of them uses easy mode or a toggle, the player tabs, and the easy-mode announcement with its player prefix
// (ADR-0221; issue #203).
//
// It left `ui/settings-mobility` as the five `*-choices` modules before it did, and for the same reason: the node test drove
// these names with no document — the seam was already drawn by the suite. The stored KEYS stay there, beside the writers that
// use them. What stays is the panel: finding its controls, wiring them, writing the toggles, reflecting the choice.
import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';

/** Clamps the selected player back to 0 once it falls outside 0..numPlayers-1 (e.g. player count dropped). */
export function clampSelPlayer(sel: number, numPlayers: number): number {
  return sel >= numPlayers ? 0 : sel;
}

/** Whether ANY player currently uses Easy Mode or a toggle — lights the #opt-movement bar button. */
export function anyMobilityActive(players: readonly { readonly easy?: boolean; readonly toggleMove?: boolean }[]): boolean {
  return players.some((p) => p.easy || p.toggleMove);
}

/** The on/off label for #opt-facil and #opt-altmove. A re-export of ui/dom's, which is the only one — a local body would
 *  be a copy. */
export const onOffLabel = toggleLabel;

/**
 * Full innerHTML for #movement-players, given the player count and the active index. Pure string building —
 * no DOM. NOTE: the panel keeps this list `hidden` — a single player edits only their own screen
 * (scope = pauseActor) — but the tabs/buttons are still built and wired for >1 player.
 */
export function playerTabsHTML(numPlayers: number, selected: number): string {
  if (numPlayers <= 1) return '';
  return Array.from(
    { length: numPlayers },
    (_, p) => `<button class="mode-btn${p === selected ? ' is-on' : ''}" data-mp="${p}" type="button">Jogador ${p + 1}</button>`,
  ).join('');
}

/**
 * The player prefix that opens an announcement when there is more than one screen. A single screen gets no prefix —
 * naming the player to whoever is alone is noise, and noise on a screen reader costs listening time.
 */
export function playerPrefix(i: number, numPlayers: number): string {
  return numPlayers > 1 ? t('sr.player.prefix', { n: i + 1 }) : '';
}

/** srSay text for an Easy Mode change. The whole sentence comes from the dictionary — see `sr.motor.easyOn`. */
export function easyAnnouncement(i: number, numPlayers: number, on: boolean): string {
  return playerPrefix(i, numPlayers) + t(on ? 'sr.motor.easyOn' : 'sr.motor.easyOff');
}
