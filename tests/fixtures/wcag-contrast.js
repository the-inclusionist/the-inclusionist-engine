// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/wcag-contrast — THE WCAG ARITHMETIC, written here and nowhere else. Several gates use it (the menu
// contrast, the changed mark of ADR-0029 / issue #61, the palettes).
//
// ⚠️ A TEST FILE IS NOT IMPORTED FROM ANOTHER, the obvious shortcut: importing a `.test.js` would pull its `describe`s
// into the importer and the same assertions would run twice, under two names. A helper is a module; a test file is a
// side effect.
//
// The arithmetic is WCAG 2.x §1.4.3's (relative luminance + contrast ratio), and holds the same for 1.4.11 (non-text
// component contrast) — what changes between the criteria is the TARGET, not the arithmetic. The consumer picks the
// target and names the pair; this file has no opinion on either.

/** sRGB channel → linear. The step that separates "light-ish" from LUMINANCE — without it the arithmetic is badly off in the dark. */
function linear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminancia([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The ratio between two `[r,g,b]` colours, in either order: the formula already orders them by luminance. */
export function razaoDeContraste(a, b) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** `#rgb` ou `#rrggbb` → `[r,g,b]`. */
export function hex(s) {
  const h = s.replace('#', '').trim();
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}

/**
 * Reads `--name:#rrggbb` from a stylesheet, starting at `desde` (a character index).
 *
 * ⚠️ `desde` is what makes this usable for HIGH CONTRAST. The base theme's tokens live in the `:root` at the top of the
 * file, and those of `@media (prefers-contrast: more)` REDECLARE the same names further down. A search from the start
 * always returns the first, and a gate judging high contrast by the base theme's values would measure the wrong theme
 * with nothing to give it away.
 *
 * Throws — does not return `undefined` — when the token does not exist: measuring `undefined` gives a `NaN` that crosses
 * the comparison silently and comes out green.
 */
export function lerToken(css, nome, desde = 0) {
  const m = css.slice(desde).match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{3,8})'));
  if (!m) throw new Error(`token --${nome} não existe no style.css a partir do índice ${desde}`);
  return hex(m[1]);
}
