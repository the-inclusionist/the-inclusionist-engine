// SPDX-License-Identifier: AGPL-3.0-or-later
// PORTUGUESE IN COMMENTS ONLY SHRINKS — phase 1 of the English plan for comments («nada novo em português»).
//
// The identifier gate (`portuguese-stays-out`) made names English and keeps them so. Comments had no gate, and the rule
// «artefacts are in English» was kept by memory alone — which is how a Portuguese comment keeps being written into a
// file the next commit touches. This reads `scripts/comment-language.mjs` against its baseline: no file may carry MORE
// Portuguese comment lines than it did, and a file that is not in the baseline starts at zero.
//
// ⚠️ The measure is a heuristic that undercounts (see the script's header), so this is a ratchet: it can let a short
// Portuguese line through; it cannot let the count grow.
import { describe, it, expect } from 'vitest';
import { inventory, readBaseline, isPortugueseLine, portugueseCommentLines } from '../scripts/comment-language.mjs';

describe('Portuguese in comments only shrinks', () => {
  const now = inventory();
  const base = readBaseline();

  it('🔴 [Right] no file carries more Portuguese comment lines than its baseline — a new file starts at zero', () => {
    const grew = Object.entries(now).filter(([f, n]) => n > (base.files[f] ?? 0)).map(([f, n]) => `${f}: ${base.files[f] ?? 0} -> ${n}`);
    expect(grew, 'write the comment in English (the Dev\'s own words stay between «» in the language he said them)').toEqual([]);
  }, 60_000);

  it('📌 [Boundary] the baseline is the tree, not a wish: its total is what its files add up to', () => {
    expect(Object.values(base.files).reduce((s, n) => s + n, 0)).toBe(base.total);
  });

  it('⚠️ [Interface] the classifier reads a Portuguese sentence as Portuguese and an English one as English', () => {
    expect(isPortugueseLine('// a criança não consegue segurar o botão quando o jogo pausa')).toBe(true);
    expect(isPortugueseLine('// the child cannot hold the button while the game is paused')).toBe(false);
    // quotations stay in the language they were said in, and code in backticks is not prose
    expect(isPortugueseLine('// The Dev: «não é na rodada de agora» — so this waits')).toBe(false);
    expect(isPortugueseLine('// `nao` and `que` are identifiers here, and the line is English')).toBe(false);
    // a word joined by an apostrophe is neither: split, `o'clock` would hand Portuguese its article twice
    expect(isPortugueseLine('//   `clock`    "at 2 o\'clock", "at 10 o\'clock" — a side view')).toBe(false);
    // and letters glued to digits are neither: split, the note `E5` would hand Portuguese its "and"
    expect(isPortugueseLine('// a rising jingle (C5 E5 G5 C6 B5 E6) over a C6')).toBe(false);
  });

  it('📌 [Boundary] a quotation of the Dev across two `//` comments is quoted on both lines', () => {
    expect(portugueseCommentLines('// The Dev: «a criança não consegue segurar\n// o botão quando o jogo pausa» — so this waits\nconst a = 1;\n')).toBe(0);
    // and the quotation ends where it closes, on the next line or the same one: the prose after it is read again
    expect(portugueseCommentLines('// The Dev: «keep it\n// short» e a criança não consegue segurar o botão quando o jogo pausa\nconst a = 1;\n')).toBe(1);
    expect(portugueseCommentLines('// «isto»\n// a criança não consegue segurar o botão quando o jogo pausa\nconst a = 1;\n')).toBe(1);
  });

  it('🔴 [Boundary] a comment AFTER a template with an interpolation is read — a raw scanner loses its place there', () => {
    const pt = '// a criança não consegue segurar o botão quando o jogo pausa\n';
    expect(portugueseCommentLines('const s = `a${x}b`;\n' + pt)).toBe(1);
    // a comment closing a line of code belongs to the token before it, not to the one after
    expect(portugueseCommentLines('const a = 1; ' + pt + 'const b = 2;\n')).toBe(1);
    // and text inside a template is not a comment, however much it looks like one
    expect(portugueseCommentLines('const s = `${x} // a criança não consegue segurar o botão quando o jogo pausa`;\n')).toBe(0);
  });

  it('📌 [Boundary] a quotation spanning lines is the Dev\'s words on every line; a JSDoc is one comment, read once', () => {
    expect(portugueseCommentLines('/* The Dev:\n * «a criança não consegue segurar\n * o botão quando o jogo pausa» — so this waits */\nconst a = 1;\n')).toBe(0);
    // a tag has tokens INSIDE the comment, and a `//` after one of them would read as a second comment
    expect(portugueseCommentLines('/** @param a // a criança não consegue segurar o botão quando o jogo pausa */\nexport function f(a) {}\n')).toBe(1);
  });
});
