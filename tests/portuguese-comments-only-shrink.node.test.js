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
import {
  inventory, readBaseline, isPortugueseLine, portugueseCommentLines, sources, EXCLUSIONS, isExcluded,
} from '../scripts/comment-language.mjs';

const PT = 'a criança não consegue segurar o botão quando o jogo pausa';

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

  it('🔴 [Right] the WHOLE tree is read, by kind — the files phase 4 never opened are measured now', () => {
    const measured = sources();
    // 🎯 One file of every kind, by name: a scope that silently shrinks back to three folders must turn this red.
    for (const f of ['app/css/style.css', 'app/quiz.html', '.github/workflows/ci.yml', 'vite.config.ts', 'tsconfig.json',
      'package.json', 'tools/build-hc.py', 'tools/png-write.mjs', '.gitignore', 'app/public/_headers', 'app/js/core/i18n.ts',
      // the records' validator too: its comments are English at home, so a copy must not bring Portuguese back
      'scripts/validate-adr.py']) {
      expect(measured, `${f} is no longer measured`).toContain(f);
    }
    expect(measured.filter(isExcluded), 'an excluded file entered the measurement').toEqual([]);
    expect(measured.length, 'nothing was measured — the gate would approve anything').toBeGreaterThan(400);
  });

  it('⚠️ [Zero] the exclusions are exactly the decided ones, each with its reason', () => {
    // 🎯 A literal set, not read back from the script: an exclusion added beside the others must turn this red.
    expect(new Set(EXCLUSIONS.map(([p]) => p))).toEqual(new Set(['app/js/i18n/**', 'app/js/educational/**',
      'app/js/consumer-quiz/**', 'research/**']));
    expect(EXCLUSIONS.length, 'an exclusion listed twice').toBe(4);
    for (const [pattern, reason] of EXCLUSIONS) expect(reason.length, `${pattern}: an exclusion without a reason is a hole`).toBeGreaterThan(30);
    expect(isExcluded('docs/research/README.md')).toBe(false); // `docs/research/` is not the Dev's `research/`
  });

  it('🔴 [Right] CSS: a `/* */` comment is read; the same words inside a string are not', () => {
    expect(portugueseCommentLines(`/* ${PT} */\n.a { color: red; }\n`, 'x.css')).toBe(1);
    expect(portugueseCommentLines(`.a::after { content: "/* ${PT} */"; }\n`, 'x.css')).toBe(0);
    // and a `//` is not a CSS comment: a url after it is still the rule
    expect(portugueseCommentLines(`.a { background: url(//x/${PT.replace(/ /g, '-')}.png); }\n`, 'x.css')).toBe(0);
  });

  it('🔴 [Right] HTML: `<!-- -->`, and the inline script and style, are read; what the page SHOWS is not', () => {
    expect(portugueseCommentLines(`<!-- ${PT} -->\n<p>ok</p>\n`, 'x.html')).toBe(1);
    expect(portugueseCommentLines(`<script type="module">\n// ${PT}\nconst a = 1;\n</script>\n`, 'x.html')).toBe(1);
    expect(portugueseCommentLines(`<style>\n/* ${PT} */\n</style>\n`, 'x.html')).toBe(1);
    // visible text belongs in the dictionaries, and a JSON island is data
    expect(portugueseCommentLines(`<p>${PT}</p>\n<script type="application/json">{"a": "// ${PT}"}</script>\n`, 'x.html')).toBe(0);
  });

  it('🔴 [Right] `#` kinds: YAML, shell and `.gitignore` comments are read; a `#` inside a quote or a word is not', () => {
    expect(portugueseCommentLines(`jobs:\n  # ${PT}\n  a: 1 # ${PT}\n`, 'x.yml')).toBe(2);
    expect(portugueseCommentLines(`run: echo "# ${PT}"\nurl: https://x/#${PT.replace(/ /g, '-')}\n`, 'x.yml')).toBe(0);
    expect(portugueseCommentLines(`# ${PT}\ndist/\n`, '.gitignore')).toBe(1);
    // an apostrophe inside a word opens no quote, so the comment after it is still read
    expect(portugueseCommentLines(`name: the child's run # ${PT}\n`, 'x.yml')).toBe(1);
  });

  it('🔴 [Right] Python: `#` and docstrings are read; a string that is an argument is code', () => {
    expect(portugueseCommentLines(`def f():\n    """${PT}.\n\n    ${PT}.\n    """\n    return 1  # ${PT}\n`, 'x.py')).toBe(3);
    expect(portugueseCommentLines(`print('# ${PT}')\nx = """${PT}"""\nf(\n    """${PT}"""\n)\n`, 'x.py')).toBe(0);
  });

  it('🔴 [Right] JSON: `//` where the parser allows it, and the comment KEYS; any other value is data', () => {
    expect(portugueseCommentLines(`{\n  // ${PT}\n  "a": 1,\n}\n`, 'tsconfig.json')).toBe(1);
    expect(portugueseCommentLines(JSON.stringify({ '//': PT, '//2': PT, 'comment:x': [PT, 'in English'], a: 1 }), 'x.json')).toBe(3);
    expect(portugueseCommentLines(JSON.stringify({ description: PT, url: `https://x/// ${PT}` }), 'x.json')).toBe(0);
  });

  it('🔴 [Boundary] the Dev\'s words between «» stay Portuguese in every kind — and stay green', () => {
    expect(portugueseCommentLines(`/* The Dev: «${PT}» */\n`, 'x.css')).toBe(0);
    expect(portugueseCommentLines(`<!-- The Dev: «${PT}» -->\n`, 'x.html')).toBe(0);
    expect(portugueseCommentLines(`# The Dev:\n# «${PT}\n# ${PT}»\n`, 'x.yml')).toBe(0);
    expect(portugueseCommentLines(JSON.stringify({ 'comment:x': ['The Dev:', `«${PT}`, `${PT}» — so this waits`] }), 'x.json')).toBe(0);
  });
});

// MUTATIONS CHECKED against the whole-tree baseline, each file restored from a copy afterwards:
//   · a Portuguese `/* */` in app/css/style.css (0 in the baseline)   → RED  «no file carries more» (0 -> 1)
//   · a Portuguese `<!-- -->` in app/quiz.html                         → RED  (0 -> 1)
//   · a Portuguese `#` comment in .github/workflows/ci.yml             → RED  (0 -> 1)
//   · a Portuguese `//` in the root vite.config.ts                     → RED  (0 -> 1)
//   · a Portuguese `#` comment in tools/build-hc.py                    → RED  (0 -> 1)
//   · a Portuguese `//` inside tsconfig.json's compilerOptions         → RED  (0 -> 1)
//   · the same Portuguese words between «» in app/css/style.css        → GREEN
//   · the CSS kind removed from the scanner                            → RED  «the WHOLE tree is read» and «CSS»
