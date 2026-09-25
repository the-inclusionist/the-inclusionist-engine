// SPDX-License-Identifier: AGPL-3.0-or-later
// A SOURCE FILE IS READ ONCE AND PARSED ONCE per test file — the helper the whole-tree gates share.
//
// ⚠️ WHY IT EXISTS: the gates over `app/js` asked the same question of the same file several times, one case after
// another — `engine-boundary` parsed every module once for its `game/` edges and again for its `educational/` edges,
// `engine-package` parsed the package three times over. Each pass is the TypeScript parser over ~2 MB of source, and under
// the load of several suites at once those repeats were what pushed the cases past the 5 s ceiling. A red that comes from
// the machine and not the code invalidates whatever is measured beside it; the fix is the work shrinking, never the clock
// growing (`tests/rename-map.node.test.js`).
//
// 📌 WHAT THE CACHE IS NOT: shared between test files. Vitest evaluates this module afresh for each file, so a file can
// never read another's stale answer — and a mutation applied on disk before a run is read by that run.
import { readFileSync } from 'node:fs';
import { specifiersOf } from '../../scripts/lib/module-specifiers.mjs';

// LINE ENDINGS ARE NORMALISED on reading: with CRLF each line ends in CR, a line terminator for a regex, and the comment
// strippers the gates run over this text would stop matching (`engine-boundary` writes the full reason). The parser is
// indifferent: it counts CRLF and LF as one line break alike, and a specifier holds no line break.
const CR = String.fromCharCode(13);
const texts = new Map();
const specifiers = new Map();

/** The text of the file at `path`, without CR, read once. */
export function sourceText(path) {
  let text = texts.get(path);
  if (text === undefined) {
    text = readFileSync(path, 'utf8').split(CR).join('');
    texts.set(path, text);
  }
  return text;
}

/**
 * CAN the file at `path` name a module whose specifier contains `needle`? `false` only when parsing it could not find one,
 * so a gate asking about ONE module may skip the parse of every file this answers `false` for.
 *
 * 📌 WHY IT IS EXACT, and not a guess from the text: the parser hands back a specifier's COOKED value, and a cooked value
 * holds a character the source does not spell out only through an escape (`-`, `\x2d`, a line continuation) — each
 * of which puts a backslash in the source. So a text holding neither the needle nor a single backslash cannot yield it.
 * The needle must itself hold no backslash, quote or line break, which a module path never does.
 */
export function canNameSpecifierContaining(path, needle) {
  const text = sourceText(path);
  return text.includes(needle) || text.includes('\\');
}

/** `specifiersOf` (`scripts/lib/module-specifiers.mjs`) over the file at `path`, parsed once. The path's extension picks
 *  the script kind, exactly as a file name passed to `specifiersOf` does. */
export function specifiersOfFile(path) {
  let found = specifiers.get(path);
  if (found === undefined) {
    found = specifiersOf(sourceText(path), path);
    specifiers.set(path, found);
  }
  return found;
}
