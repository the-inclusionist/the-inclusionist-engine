// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/locale-flags — THE LANGUAGE BUTTON'S THREE FLAGS (the Dev, 2026-09-16: «três bandeiras que se intercalam cada vez que o botão é
// apertado: Brasil, Estados Unidos e México. Cada bandeira indica a localização para qual o app está configurado»).
//
// The flags are DRAWN, not emoji: 📏 measured in Chromium on Windows, 🇧🇷 🇺🇸 🇲🇽 render as the letters BR, US and MX (zero coloured pixels,
// against 716 for 🧑) — a school's Windows machine would show the child two letters where a flag was promised. Simplified to their shapes
// and colours at icon size. Each language is named in itself, so a child who does not read the current language still finds their own.

/** The locales the button cycles, in the Dev's order. */
export const LOCALE_CYCLE = ['pt', 'en', 'es'] as const;
export type CycleLocale = (typeof LOCALE_CYCLE)[number];

/** The next locale of the cycle; a locale outside it starts the cycle again. */
export const nextLocale = (current: string): CycleLocale => {
  const i = (LOCALE_CYCLE as readonly string[]).indexOf(current);
  return LOCALE_CYCLE[(i + 1) % LOCALE_CYCLE.length]!;
};

/** Each language in its own words, with the place its flag stands for. */
export const LANGUAGE_NAME: { readonly [L in CycleLocale]: string } = {
  pt: 'Português (Brasil)', en: 'English (United States)', es: 'Español (México)',
};

const svg = (inner: string): string =>
  `<svg class="pi-flag" viewBox="0 0 30 20" width="1.4em" height="0.93em" aria-hidden="true" focusable="false">${inner}</svg>`;

/** Brazil, the United States and Mexico, simplified to icon size. */
export const FLAG_SVG: { readonly [L in CycleLocale]: string } = {
  pt: svg('<rect width="30" height="20" fill="#009c3b"/><polygon points="15,2.2 27.4,10 15,17.8 2.6,10" fill="#ffdf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/>'),
  en: svg('<rect width="30" height="20" fill="#b22234"/>'
    + [1, 3, 5, 7, 9, 11].map((r) => `<rect y="${(r * 20) / 13}" width="30" height="${20 / 13}" fill="#fff"/>`).join('')
    + '<rect width="12" height="10.77" fill="#3c3b6e"/>'
    + [[2, 2], [6, 2], [10, 2], [4, 5.4], [8, 5.4], [2, 8.8], [6, 8.8], [10, 8.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".7" fill="#fff"/>`).join('')),
  es: svg('<rect width="10" height="20" fill="#006847"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce1126"/><circle cx="15" cy="10" r="2.6" fill="#8b5a2b"/>'),
};

/** The flag of a locale, or Brazil's for one outside the cycle (the engine's base language). */
export const flagOf = (locale: string): string => FLAG_SVG[(LOCALE_CYCLE as readonly string[]).includes(locale) ? locale as CycleLocale : 'pt'];
