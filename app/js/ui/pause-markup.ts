// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-markup — THE HTML OF THE PAUSE CARD AND OF THE ACCESSIBILITY BAR, as pure strings (ADR-0221; issue #203).
//
// Every function here takes what it needs and returns a string: no `document`, no injected ctx, no state. That is what lets a
// node test read the card's markup without mounting a browser, and it is the half of `ui/pause-icons` that never had to know
// anything about the DOM.
//
// 🔴 WHY IT LEFT: `ui/pause-icons` was 645 lines and 122 decision nodes after the catalogue left, and it held two jobs that do
// not need each other — BUILDING the strings, and then wiring, reflecting and navigating the elements the browser made from
// them. 📌 And the DATA had to leave FIRST: the markup needs the icon catalogue, so with all three in one file the markup
// could not be extracted without the two modules importing each other — the cycle ADR-0173 forbids. Catalogue in `core`,
// markup here, DOM next door.
//
// ⚠️ THE i18n KEY IS RESOLVED HERE, and that is not a matter of style: this markup is rendered ONCE and assigned to
// `innerHTML`, so a key left unresolved would ship the literal `icon.blind` to a screen reader. Where a label is rewritten
// later (state, seat, dynamic rows) the element that carries it is rendered with its own `<span>` or `data-i18n`, which is the
// seam `ui/pause-icons` writes through.

import { t, getLocale } from '../core/i18n.js';
import { type PauseIcon, PAUSE_ICONS } from '../core/pause-icon-catalogue.js';
import { flagOf } from './locale-flags.js';
import { PM_GAME_BTNS } from './pause-buttons.js';

/** One `.pm-btn` descriptor — the shape of game.js's PM_BTNS (owned by ui/pause-buttons). */
export interface PauseMenuButton {
  act: string;
  /** Read ONLY when the button has a dynamic label; see the note on `PauseBtnDef` (ui/pause-buttons). */
  lbl?: string;
  /** Dynamic label (the ABC cycle) — rendered from `lbl`, not from i18n, and NOT given `data-i18n`. */
  letra?: boolean;
  /** Dynamic label (the literacy level) — rendered from quizLevel + qlName. Currently dormant: no PM_BTNS
   *  entry sets it, but the branch is live code and is ported verbatim. */
  nivel?: boolean;
}

/** One `.pi-btn`. The label is the RESTING one: reflectIconBtn overwrites it with the stateful label as soon as the bar is
 *  reflected. `ic.n` is an i18n key, so it must be resolved here too — the markup is rendered once at build
 *  time and would otherwise ship the raw key to a screen reader. */
export function iconBtnMarkup(ic: PauseIcon): string {
  return '<button class="pi-btn" type="button" data-pi="' + ic.k +
    '" aria-label="' + t(ic.n) + '">' + (ic.k === 'idioma' ? flagOf(getLocale()) : ic.e) + '</button>';
}

/** The whole icon bar. Used by the pause screen AND by the splash `#title-icons` (which built the same string
 *  by hand in game.js — that duplication dies with this export).
 *  The parameter is ADDITIVE and the default is the whole list: whoever already called it with no arguments gets the same
 *  string back. */
export function iconsMarkup(icones: readonly PauseIcon[] = PAUSE_ICONS): string {
  return icones.map(iconBtnMarkup).join('');
}

/**
 * One `.pm-btn`. Dynamic labels (`letra`/`nivel`) are rendered eagerly and carry NO `data-i18n`, so `i18n.applyDom()` cannot
 * overwrite them.
 *
 * ⚠️ THE DYNAMIC LABEL ARRIVES READY-MADE, and that change fixed TWO things at once.
 *
 * The line used to be `'📚 Nível ' + level + ' · ' + qlName[level]`, and it had two defects that only show together:
 *
 *   1. BOUNDARY. `level` came from `core/state.quizLevel` and `qlName` from a table owned by the game. An ENGINE pause menu
 *      was assembling the label of a literacy activity — pedagogical content, not mechanics.
 *   2. LANGUAGE. «Nível» is raw pt-BR inside an engine module. The gate of that time watched `main.js` and did not reach
 *      `ui/`, so this line crossed the whole i18n pass unseen. In an English build, a child's pause menu said «📚 Nível 2 · …».
 *
 * Now the game hands over the finished phrase (`dynLabel`) and the engine only puts it on the button. The game is the one who
 * knows what a level is, what it is called, and in which language to say it.
 */
export function pmBtnMarkup(
  b: PauseMenuButton, dynLabel: (b: PauseMenuButton) => string | null, tr: (key: string) => string,
): string {
  const dyn = b.letra || b.nivel;
  const lbl = dynLabel(b) ?? (dyn ? (b.lbl ?? '') : tr('pause.' + b.act));
  const glifo = ITEM_GLYPH[b.act];
  return '<button class="pm-btn' + (b.letra ? ' pm-letra' : '') + (b.nivel ? ' pm-nivel' : '') +
    '" role="menuitem" type="button" data-act="' + b.act + '"' +
    (glifo ? ' data-glifo="' + glifo + '"' : '') +
    (dyn ? '' : (' data-i18n="pause.' + b.act + '"')) + '>' + lbl + '</button>';
}

/**
 * THE GLYPH OF EACH PAUSE ITEM, drawn by the stylesheet and never part of the name (ADR-0159 rule 12: «An emoji or
 * symbol in a menu is decorative and hidden from narration»). It lived at the start of each dictionary value, so the
 * engine's narration and a screen reader both said «⚙ Inclusion settings». The glyph is the same in every language;
 * the words stay in the dictionary.
 *
 * 📌 NOT exported any more, and the `exports-without-consumer` gate is what said so: it sat in the declared debt of
 * `ui/pause-icons` — published with nobody importing it — and moving house was the moment to stop publishing it. Its only
 * reader is `pmBtnMarkup`, one screen above.
 */
const ITEM_GLYPH: Readonly<Record<string, string>> = {
  resume: '▶', acessibilidade: '♿', options: '⚙', opcoesdojogo: '🎮', pmback: '↩', tipo: '🔤', addplayer: '👥',
  audio: '🦻', som: '🔊', motora: '♿', anim: '🎞', visual: '🎨', empatia: '🫂', ajuda: '❓', print: '📷', quit: '🚪',
  caa: '🔠',
};

/**
 * WHICH of the lists the pause card is showing.
 *
 * THREE lists in the markup, ONE visible — and the hidden ones carry `hidden`, which takes them out of the accessibility
 * tree entirely. That is what makes «one menu per screen» (ADR-0044 §5) true for whoever listens and not only for whoever
 * sees, and it is what lets the ring wrap around INSIDE the visible list without ever crossing into another.
 *
 * ⚠️ THREE since 2026-09-12 (ADR-0146): `jogo` is the list of what belongs to THIS game, beside the list of what the child
 * carries between games. The rule above does not change for being three.
 */
export type PauseSub = 'raiz' | 'opcoes' | 'jogo';

/** The innerHTML of ONE `.pause-menu`: the list, and nothing else.
 *  📌 Also no longer exported, by the same measurement as `ITEM_GLYPH`: it was in the declared debt, and what calls it is
 *  `screenPauseMarkup`, three times, right below. */
function pauseMenuHtml(
  bs: readonly PauseMenuButton[], sub: PauseSub, dynLabel: (b: PauseMenuButton) => string | null,
  tr: (key: string) => string,
): string {
  return '<div class="pause-menu" role="menu" data-sub="' + sub + '"' + (sub === 'raiz' ? '' : ' hidden') + '>' +
    bs.map((b) => pmBtnMarkup(b, dynLabel, tr)).join('') + '</div>';
}

/**
 * THE ACCESSIBILITY QUICK BAR — the toggles and the caption that explains them (ADR-0044, item 7).
 *
 * It left the pause card and went to live in the HUD. The reason is about use, not tidiness: it is DURING the game that a
 * child needs to change a setting that is getting in her way, not after pausing. The secondary reason is structural — without
 * it, the card stops having two zones and becomes a LIST, which is what finally authorises the ring (XAG 106 allows wrapping
 * for a linear menu and forbids it for a grid).
 *
 * THE CAPTION TRAVELS WITH IT. It is the hint that replaces, for whoever does not see, the `title` only a mouse reveals;
 * leaving it behind in the card would have made the HUD bar mute.
 */
export function quickBarMarkup(icones: readonly PauseIcon[] = PAUSE_ICONS): string {
  return '<div class="pause-icons" role="group" aria-label="' + t('pause.iconBarAria') + '">' + iconsMarkup(icones) +
    '</div><p class="pause-icons-cap" aria-live="polite"></p>';
}

export interface ScreenPauseMarkupOpts {
  /** Screen/player index (0-based); the dialog label and the seat suffix are 1-based. */
  player: number;
  /** Live player count — the suffix only appears in multiplayer. */
  numPlayers: number;
  /** The ROOT list: the items of ADR-0044, `resume` first and `quit` last. */
  pmButtons: readonly PauseMenuButton[];
  /** The settings submenu: the adjustment panels, with «back» in front. */
  optionsButtons: readonly PauseMenuButton[];
  /** The GAME's submenu (ADR-0146). Absent = only «back», which is the case of a game that declares nothing of its own. */
  jogoButtons?: readonly PauseMenuButton[];
  /** The finished label of a DYNAMIC button, or `null` if that button has none. The game is who builds the phrase. */
  dynLabel: (b: PauseMenuButton) => string | null;
  t: (key: string) => string;
}

/** The full innerHTML of a `.screen-pause`. Pure — every input is a parameter. */
export function screenPauseMarkup(o: ScreenPauseMarkupOpts): string {
  // THE DIALOG'S ACCESSIBLE NAME goes through the dictionary. It was raw text, and MEASURED in an English game the effect was
  // this: the visible title said «Paused» and the dialog's name «Menu de pausa do jogador 1». Whoever saw read English;
  // whoever listened got the menu announced in Portuguese — the same asymmetry as item 4 of ADR-0044, one level up. And
  // `aria-label`, not `aria-labelledby`: the `<h2>` is a VISUAL label, which is why hiding it in a tight frame does not take
  // the dialog's name away from whoever listens.
  return '<div class="pause-card" role="dialog" aria-modal="true" aria-label="' + t('pause.cardAria', { n: o.player + 1 }) + '">' +
    '<h2><span data-i18n="pause.title">' + o.t('pause.title') + '</span>'
    // ⚠️ THE SEAT SUFFIX USED TO BE `' · Jogador ' + (o.player + 1)` — raw Portuguese inside an engine module, and an English
    // game read «Paused · Jogador 2». It is a key now, and it lives in a `<span>` of its own because the item refresh needs
    // somewhere to REPAINT it: since `pause.cardSeat` takes a parameter, the `data-i18n` path of `applyDom` — which calls
    // `t(k)` with no parameters — does not serve here.
    // 📌 The module's `t` and not `o.t`, for the same reason the `aria-label` line above already uses it: the injected port is
    // `(key) => string` and does not carry parameters across.
    + '<span class="pause-seat">' + (o.numPlayers > 1 ? t('pause.cardSeat', { n: o.player + 1 }) : '') + '</span></h2>' +
    pauseMenuHtml(o.pmButtons, 'raiz', o.dynLabel, o.t) +
    pauseMenuHtml(o.optionsButtons, 'opcoes', o.dynLabel, o.t) +
    // ⚠️ THE THIRD LIST IS ALWAYS IN THE MARKUP, even for a game that declares nothing — and it is not waste: it is the same
    // reason the other two are built whole and hidden afterwards (see the note on `buildScreenPause`). The game's table
    // arrives LATE, and a list filtered at mount time would erase for ever what only came to exist after boot. What decides
    // what is SEEN is the item refresh.
    pauseMenuHtml(o.jogoButtons ?? PM_GAME_BTNS, 'jogo', o.dynLabel, o.t) +
    '<p class="pause-legend"></p></div>';
}
