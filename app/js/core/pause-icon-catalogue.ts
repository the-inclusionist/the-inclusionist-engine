// SPDX-License-Identifier: AGPL-3.0-or-later
// core/pause-icon-catalogue — WHICH ICONS THE ACCESSIBILITY BAR HAS, and in what order (ADR-0221; issue #203).
//
// The list, what each entry declares, and the lookup by key. 🔴 It left `ui/pause-icons` because that module had grown to 666
// lines and 122 decision nodes, and because this is DATA: it draws nothing, listens to nothing, stores nothing. A leaf module
// with zero imports, which is why the bar's contents can be read without mounting a document.
//
// ⚠️ AND IT LEFT FIRST FOR A REASON OF DIRECTION, not of size: the next cut is the MARKUP, and the markup needs the catalogue.
// With both in the same file, extracting the markup alone would make the two modules import each other — the cycle ADR-0173
// forbids. Data at the bottom, drawing above it.
//
// 📌 THE ORDER IS THE INTERFACE. A child who navigates the bar by keyboard has learnt where each icon is, and inserting one in
// the middle displaces every other — the same cost §2 of ADR-0044 refuses to pay in the pause card. A new icon goes at the END.
//
// 📌 What this module does NOT decide: which icons the bar actually mounts. That is `iconsThatAct` in `ui/pause-icons`, by the
// rule of ADR-0106 §5 — an icon exists only where something acts on it.

export interface PauseIcon {
  /** `data-pi` key — the dispatch key of iconAct/iconLabel/reflectIconBtn. */
  k: string;
  /** The emoji glyph rendered inside the button. */
  e: string;
  /** i18n KEY of the base name; also the `aria-label` when the icon carries no state. */
  n: string;
  // 📌 `soon` LEFT THIS INTERFACE on 2026-09-21 (issue #184): the 👄 was the last icon using it, and a mechanism nobody uses is
  // debt wearing the clothes of a feature. What remains is the narrower rule of ADR-0106 §5 — an icon is only mounted where
  // something acts on it. Whoever needs «under construction» again takes it back out of git, with that day's reason written down.
}

/** The accessibility shortcut bar at the top of every pause screen (and of the splash `#title-icons`).
 *  Sound-bound icons (blind/TTS) require a private audio output; the webcam and the voice require the device to have one.
 *  The order and behaviour came verbatim from the monolith, which left with the cartridge (#111); the names became
 *  i18n keys in the Phase-5 pass. */
// `n` is the i18n KEY of the icon's name (the emoji `e` is NOT translated — it is the same glyph in every language).
export const PAUSE_ICONS: readonly PauseIcon[] = [
  // FIRST, the menus (the Dev, 2026-09-16: «Menu deve ser o primeiro ícone»): the SELECT door as an icon, for a hand with no
  // SELECT under it. Mounted only where there is a card to open (`abrirMenus`).
  { k: 'menu', e: '☰', n: 'icon.menu' },
  { k: 'blind', e: '🦯', n: 'icon.blind' },
  { k: 'tts', e: '🗨️', n: 'icon.tts' },
  { k: 'libras', e: '🦻', n: 'icon.libras' }, // 🦻 (the Dev, 2026-09-16): 🤟 is playing by hand gestures
  { k: 'tea', e: '🧩', n: 'icon.tea' },
  { k: 'altmove', e: '☝️', n: 'icon.altmove' }, // ☝️ and not 🦾 (the Dev): the gesture is ONE FINGER pressing, which is what toggling asks for
  { k: 'contrast', e: '🌗', n: 'icon.contrast' },
  { k: 'cvd', e: '🚥', n: 'icon.cvd' },
  // playing through the webcam, ONE icon (ADR-0215): off · hands · face · eyes, each with its lines; where 🧑 and 👀 were
  { k: 'camera', e: '📷', n: 'icon.camera' },
  // playing by SPEAKING (ADR-0189, issue #184): it left «em construção» on 2026-09-21, when the words, the recogniser, the
  // microphone and the wiring existed — not a day before, because an icon that announces itself and changes nothing is the
  // defect ADR-0106 §5 names.
  { k: 'voice', e: '👄', n: 'icon.voice' },
  /*
   * THE ELEVENTH (ADR-0149 §1), at the END for the reason of order written in this file's header, not of importance.
   *
   * 📌 A CYCLE AND NOT A DOOR. The typography panel still exists in the Settings with its thirty faces; this button is the
   * choice a child makes WITHOUT leaving the screen, in one press, and that is why it is a short curated list and not a menu.
   */
  { k: 'tipografia', e: '🔤', n: 'icon.tipografia' },
  // THE TWELFTH (ADR-0180): the game speed, its own button beside toggle keys, at the end for the same reason as the eleventh.
  // An hourglass and no animal: a snail, a turtle or a hare can read as an insult to the child who needs the slower game.
  { k: 'velocidade', e: '⏳', n: 'icon.velocidade' },
  // THE LAST BUTTON, the language (the Dev, 2026-09-16): Brazil → United States → Mexico, each press; menus, the footer, speech and
  // recognition follow it. Its glyph is a DRAWN flag (`ui/locale-flags`), since flag emoji show as letters on Windows.
  { k: 'idioma', e: '🇧🇷', n: 'icon.idioma' },
];

const ICON_BY_KEY: ReadonlyMap<string, PauseIcon> = new Map(PAUSE_ICONS.map((ic) => [ic.k, ic]));
export function pauseIcon(k: string): PauseIcon | undefined { return ICON_BY_KEY.get(k); }
