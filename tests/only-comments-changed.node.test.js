// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHECK THAT A CHANGE TOUCHED ONLY COMMENTS TELLS COMMENT FROM CODE — the tool phase 4 of the English plan leans on.
//
// Every comment translation is proven by `scripts/only-comments-changed.mjs`: the code token stream before and after must
// be identical. That proof is only as good as the tokenizer's idea of where a comment ends, so these cases pin the places a
// lexer gets wrong — template text after `${…}`, a `//` inside a template or a regex, a JSDoc block — in both directions:
// a comment edit must read as nothing, and a code edit that LOOKS like a comment must read as code.
import { describe, it, expect } from 'vitest';
import { codeTokens } from '../scripts/only-comments-changed.mjs';

const same = (a, b, f = 'x.ts') => expect(codeTokens(b, f)).toEqual(codeTokens(a, f));
const differ = (a, b, f = 'x.ts') => expect(codeTokens(b, f)).not.toEqual(codeTokens(a, f));

describe('only comments changed: what counts as code', () => {
  it('✅ [Right] rewriting a line comment, a block comment and a JSDoc block changes no code token', () => {
    same(
      '// desenha a tela\nconst a = 1; /* e a tela é dele */\n/** @returns o total */\nexport function f() { return a; }\n',
      '// draws the screen\nconst a = 1; /* and the screen is theirs */\n/** @returns the total */\nexport function f() { return a; }\n',
    );
  });

  it('✅ [Right] whitespace and line breaks around the code are not code', () => {
    same('const a = 1;\nconst b = 2;\n', 'const a = 1;\n\n\n   const b = 2;\n');
  });

  it('🔴 [Right] a code edit is seen: an identifier, a literal and an operator', () => {
    differ('const a = 1;', 'const b = 1;');
    differ('const a = 1;', 'const a = 2;');
    differ('const a = x + y;', 'const a = x - y;');
  });

  it('🔴 [Boundary] text of a template AFTER an interpolation is code — a raw scanner reads it as tokens and loses its place', () => {
    differ('const s = `a${x} depois`;', 'const s = `a${x} after`;');
  });

  it('🔴 [Boundary] a `//` inside template text is not a comment — an edit after it is code', () => {
    differ('const u = `${base}//host/velho`;', 'const u = `${base}//host/new`;');
  });

  it('🔴 [Boundary] a `//` inside a string and a regex is not a comment either', () => {
    differ("const u = 'https://a.b/velho';", "const u = 'https://a.b/new';");
    differ('const r = /a\\/\\/b/;', 'const r = /a\\/\\/c/;');
  });

  it('⚠️ [Interface] the file name picks the parser: in a .js file JSX is JSX, and its trailing comment stays a comment', () => {
    // read as TypeScript, `<b>` is a type assertion and the `/` that follows opens a regex that swallows the comment
    same('const a = <b>x</b>; // velho\nconst z = 1;\n', 'const a = <b>x</b>; // old\nconst z = 1;\n', 'x.js');
    same('/** @type {string} */\nconst a = f();\n', '/** @type {number} */\nconst a = f();\n', 'x.js');
  });
});
