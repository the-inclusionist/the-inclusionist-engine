// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY HEADING OF `docs/6-DevOps-SRE/Breaking-Changes.md` APPEARS ONCE, AND SO DOES EVERY NOTE CODE.
//
// ========================= WHAT THIS EXISTS TO CATCH =========================
// This file is edited by scripts, one note at a time, and two scripted edits damaged it without any gate noticing:
//   · an insertion through `String.replace` with a replacement STRING read `$\`` inside the note as «the text before the
//     match» and pasted the file into itself five times (commit f15ce7ff repaired it);
//   · an insertion overwrote one section's title with a copy of another's.
// Both leave the same fingerprint: a heading that appears twice. A duplicated note code (`## DE · …` twice, even with two
// different titles) is the second fingerprint — two notes that a migration guide, a commit footer or another note would
// cite by the same letters.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
const DOC = 'docs/6-DevOps-SRE/Breaking-Changes.md';

/** The ATX headings outside fenced code, with their 1-based line: `[{ line, level, text }]`. */
function headingsOf(markdown) {
  const out = [];
  let fence = null;
  markdown.split(/\r?\n/).forEach((raw, i) => {
    const opener = /^\s{0,3}(`{3,}|~{3,})/.exec(raw);
    if (opener) {
      // a fence closes only with the same character, at least as long as the one that opened it
      if (!fence) fence = opener[1];
      else if (opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
      return;
    }
    if (fence) return;
    const m = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(raw);
    if (m) out.push({ line: i + 1, level: m[1].length, text: m[2].replace(/\s+/g, ' ') });
  });
  return out;
}

/** The note code of a heading — `D2` in `## D2 · The start action…`, `3` in `## 3 · KeyScheme narrowed…`. */
const codeOf = (h) => /^([A-Z]{1,2}\d*|\d+) · /.exec(h.text)?.[1] ?? null;

/** Every key that appears more than once, as «key» (lines a, b, …). */
function repeated(items, keyOf) {
  const lines = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (k === null) continue;
    lines.set(k, [...(lines.get(k) ?? []), it.line]);
  }
  return [...lines].filter(([, ls]) => ls.length > 1).map(([k, ls]) => `«${k}» (lines ${ls.join(', ')})`);
}

const headings = headingsOf(readFileSync(join(ROOT, DOC), 'utf8'));
const notes = headings.filter((h) => h.level === 2 && codeOf(h) !== null);

describe('Breaking-Changes.md has no duplicated heading', () => {
  it('[Interface] the parser reads the real file — headings and note codes are there to compare', () => {
    // Without this, a path that moved or a regex that died would leave the two cases below green for having nothing to
    // compare.
    expect(headings.length, 'no headings read: wrong path, or the parser died').toBeGreaterThan(100);
    expect(notes.length, 'no note codes read').toBeGreaterThan(90);
    expect(notes.map(codeOf), 'the notes the file has had since it was written').toEqual(expect.arrayContaining(['A', 'D2', 'DE']));
  });

  it('🔴 [Zero] NO heading text appears twice', () => {
    expect(repeated(headings, (h) => h.text), 'a heading appears twice: a scripted edit duplicated a section or copied a title '
      + 'over another. Compare with the file before the last commit that touched it').toEqual([]);
  });

  it('🔴 [Zero] NO note code appears twice, even under different titles', () => {
    expect(repeated(notes, codeOf), 'two notes answer to the same code: whoever cites it cannot tell which one').toEqual([]);
  });
});

describe('the parser behind the gate', () => {
  it('[Right] it finds a repeated heading and a repeated code, and names the lines', () => {
    const h = headingsOf(['# T', '## A · one', 'x', '## A · one', '## B · two', '## B · three'].join('\n'));
    expect(repeated(h, (x) => x.text)).toEqual(['«A · one» (lines 2, 4)']);
    expect(repeated(h.filter((x) => codeOf(x) !== null), codeOf)).toEqual(['«A» (lines 2, 4)', '«B» (lines 5, 6)']);
  });

  it('[Boundary] a heading inside a fenced block is example text, not a heading', () => {
    // The notes quote code, and a `# comment` line in a shell example repeated across two notes is not a duplicate.
    const h = headingsOf(['## A · one', '```sh', '# run this', '```', '~~~', '# run this', '~~~', '## B · two'].join('\n'));
    expect(h.map((x) => x.text)).toEqual(['A · one', 'B · two']);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied with the Edit tool to the real file, and restored the same way:
//   · the heading of note DF replaced by a copy of note DE's heading (the «title overwritten» defect)
//     → both [Zero] cases fail: the text and the code repeat.
//   · the code of note DF changed to `DE`, title kept → only the code case fails: the texts differ.
//   · the section `## DE · …` pasted again right after itself, with its body → both [Zero] cases fail.
//   · the heading regex broken (`#{7}`) → the [Interface] case fails, and so do the parser cases: without the vacuum
//     case the two [Zero] cases would stay green over an empty list.
//   · the fence skip removed → only the [Boundary] case fails (the file has no `#` line inside a fence today).
//   · the file as commit 00f292a7 left it (18222 lines, five copies) → both [Zero] cases fail, the first naming
//     «O · The engine sizes the game region…» at five lines.
