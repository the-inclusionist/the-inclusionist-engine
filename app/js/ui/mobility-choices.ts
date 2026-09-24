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

/** Whether ANY player currently uses Modo Fácil or alternância — lights the #opt-movement bar button. */
export function anyMobilityActive(players: readonly { readonly easy?: boolean; readonly toggleMove?: boolean }[]): boolean {
  return players.some((p) => p.easy || p.toggleMove);
}

/** '❚❚ Ligado' / '▶ Desligado' para #opt-facil e #opt-altmove. Reexporta o de ui/dom, que é o único que
 *  existe desde o item 14 — o corpo daqui era uma cópia, e o comentário já dizia "shared" sem sê-lo. */
export const onOffLabel = toggleLabel;

/**
 * Full innerHTML for #movement-players, given the player count and the active index. Pure string building —
 * no DOM. NOTE (verbatim from game.js, E3): the panel keeps this list `hidden` — a single player edits only
 * their own screen (scope = pauseActor) — but the tabs/buttons are still built and wired for >1 player.
 */
export function playerTabsHTML(numPlayers: number, selected: number): string {
  if (numPlayers <= 1) return '';
  return Array.from(
    { length: numPlayers },
    (_, p) => `<button class="mode-btn${p === selected ? ' is-on' : ''}" data-mp="${p}" type="button">Jogador ${p + 1}</button>`,
  ).join('');
}

/**
 * O 'Jogador N: ' que abre um anúncio quando há mais de uma tela. Uma tela só não leva prefixo — dizer
 * "Jogador 1" para quem está sozinho é ruído, e ruído no leitor de tela custa tempo de escuta.
 */
export function playerPrefix(i: number, numPlayers: number): string {
  return numPlayers > 1 ? t('sr.player.prefix', { n: i + 1 }) : '';
}

/** srSay text for a Modo Fácil change. A frase inteira vem do dicionário — ver `sr.motor.easyOn`. */
export function easyAnnouncement(i: number, numPlayers: number, on: boolean): string {
  return playerPrefix(i, numPlayers) + t(on ? 'sr.motor.easyOn' : 'sr.motor.easyOff');
}
