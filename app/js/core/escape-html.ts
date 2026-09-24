// SPDX-License-Identifier: AGPL-3.0-or-later
// core/escape-html.ts — ESCAPING TEXT THAT ENDS UP IN MARKUP. A leaf module: one function, no dependencies.
//
// ⚠️ It lives in the engine, not in a cartridge, because a security helper on the wrong side of a boundary is one the
// next consumer rewrites — and two versions of an escape diverge in silence.
//
// ⚠️ AND ESCAPING IS THE SECOND RESORT, NOT THE FIRST. Where the value fits a node — `textContent`, `setAttribute` —
// that is how it goes in, because then there is nothing to forget. This exists for text inside a dense markup
// builder, and there it always comes with a gate fed hostile content: an escape without a trace is worse than
// building nodes.

/**
 * The FIVE characters, covering both contexts: element (`<` `>`) and ATTRIBUTE (`"` `'`).
 *
 * The attribute is the one usually missing, and the worst: inside an element a quote is harmless; inside
 * `aria-label="…"` it CLOSES the attribute and what follows becomes an attribute — an `onmouseover` without a single tag.
 *
 * ⚠️ `&` GOES FIRST, AND THE ORDER IS THIS HELPER'S CLASSIC DEFECT. Escaped last, the `&` of the `&lt;` just produced is
 * escaped again and the screen shows a literal `&lt;`. It is silent because a test with only `<b>` never sees it: the
 * output still "looks" escaped.
 *
 * And it escapes, it does not delete. Deleting would change the word the child typed, and an activity whose text changes
 * by itself is a different defect, and just as serious.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
