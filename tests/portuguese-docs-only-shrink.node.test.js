// SPDX-License-Identifier: AGPL-3.0-or-later
// PORTUGUESE IN THE DOCS ONLY SHRINKS — phase 5 of the English plan, which until now had a goal and no end state.
//
// Comments got a ratchet in phase 4 (`portuguese-comments-only-shrink`); the Markdown had none, so «the docs are in
// English» was kept by memory alone. This reads `scripts/docs-language.mjs` against its baseline: no document may carry
// MORE Portuguese prose lines than it did, a document the baseline does not name starts at zero, and no Markdown file
// may be born with a Portuguese NAME. The files that are pt-BR on purpose are a literal set here, each with its reason.
//
// ⚠️ The line classifier is the comment gate's (`isPortugueseLine`), a heuristic that undercounts: this can let a short
// Portuguese line through; it cannot let the count grow.
//
// MUTATIONS CHECKED at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  inventory, readBaseline, portugueseNames, portugueseProseLines, portugueseNameWords, measuredFiles, EXCLUSIONS, isExcluded,
} from '../scripts/docs-language.mjs';

const PT_PARAGRAPH = 'A criança não consegue segurar o botão quando o jogo pausa, e isso é um problema.\n'
  + 'Por isso a engine deve soltar as teclas quando a janela perde o foco.\n';

describe('Portuguese in the docs only shrinks', () => {
  const now = inventory();
  const base = readBaseline();

  it('🔴 [Right] no document carries more Portuguese prose lines than its baseline — a new one starts at zero', () => {
    const grew = Object.entries(now).filter(([f, n]) => n > (base.files[f] ?? 0)).map(([f, n]) => `${f}: ${base.files[f] ?? 0} -> ${n}`);
    expect(grew, 'write the prose in English (the Dev\'s own words stay between «», in the language they said them)').toEqual([]);
  }, 60_000);

  it('🔴 [Zero] no Markdown file carries a Portuguese NAME the baseline did not already list', () => {
    const born = portugueseNames().filter((f) => !base.names.includes(f));
    expect(born, 'name the document in English; the Portuguese words found are '
      + born.map((f) => `${f} (${portugueseNameWords(f).join(', ')})`).join('; ')).toEqual([]);
  });

  it('📌 [Boundary] the baseline is the tree, not a wish: its total is what its files add up to', () => {
    expect(Object.values(base.files).reduce((s, n) => s + n, 0)).toBe(base.total);
  });

  it('⚠️ [Zero] the exclusions are exactly the five decided ones, each with its reason, and none is stale', () => {
    // 🎯 A literal set, not read back from the script: an exclusion added beside the others must turn this red.
    expect(new Set(EXCLUSIONS.map(([p]) => p))).toEqual(new Set(['docs/educational/**', 'CLAUDE.md', 'research/**', 'CHANGELOG.md', '.claude/plans/**']));
    expect(EXCLUSIONS.length, 'an exclusion listed twice').toBe(5);
    for (const [pattern, reason] of EXCLUSIONS) {
      expect(reason.length, `${pattern}: an exclusion without a reason is a hole`).toBeGreaterThan(30);
    }
    const measured = measuredFiles();
    expect(measured.filter(isExcluded), 'an excluded file entered the measurement').toEqual([]);
    expect(measured.length, 'nothing was measured — the gate would approve anything').toBeGreaterThan(50);
    // and the prose documents stay measured: `docs/research/` is NOT the Dev's `research/`
    expect(isExcluded('docs/research/README.md')).toBe(false);
    expect(isExcluded('docs/CLAUDE.md')).toBe(false);
    expect(isExcluded('docs/educational/Curriculum-Map.md')).toBe(true);
    expect(isExcluded('.claude/plans/mellow-questing-riddle.md')).toBe(true);
    expect(isExcluded('.claude/README.md'), 'only the plans are the working document, not the whole folder').toBe(false);
  });

  it('⚠️ [Interface] a Portuguese paragraph counts, line by line; an English one does not', () => {
    expect(portugueseProseLines(PT_PARAGRAPH)).toEqual([1, 2]);
    expect(portugueseProseLines('The child cannot hold the button while the game is paused.\nSo the engine lets go.\n')).toEqual([]);
  });

  it('🔴 [Boundary] a Portuguese paragraph inside a fenced code block is code, not prose — it stays green', () => {
    expect(portugueseProseLines('Intro in English.\n\n```text\n' + PT_PARAGRAPH + '```\n\nThe end.\n')).toEqual([]);
    expect(portugueseProseLines('~~~~\n' + PT_PARAGRAPH + '~~~~\n')).toEqual([]);
    // a fence inside a list item or a blockquote is still a fence
    expect(portugueseProseLines('- step:\n    ```sh\n' + PT_PARAGRAPH.replace(/^/gm, '    ') + '    ```\n')).toEqual([]);
    expect(portugueseProseLines('> ```\n> ' + PT_PARAGRAPH.split('\n')[0] + '\n> ```\n')).toEqual([]);
    // and the fence closes: prose after it is read again
    expect(portugueseProseLines('```\ncode\n```\n' + PT_PARAGRAPH)).toEqual([4, 5]);
    // a shorter or different run does not close a fence
    expect(portugueseProseLines('````\n```\n' + PT_PARAGRAPH + '````\n')).toEqual([]);
  });

  it('🔴 [Boundary] the Dev\'s words between «» stay in Portuguese — across lines too — and it stays green', () => {
    expect(portugueseProseLines('The Dev: «' + PT_PARAGRAPH.trimEnd() + '» — so the engine waits.\n')).toEqual([]);
    // the quotation ends where it closes: the prose after it is read again
    expect(portugueseProseLines('The Dev: «keep it\nshort» e a criança não consegue segurar o botão quando o jogo pausa\n')).toEqual([2]);
    // ⚠️ a stray « closes at the end of its paragraph, never at the end of the file
    expect(portugueseProseLines('A stray « here.\n\n' + PT_PARAGRAPH)).toEqual([3, 4]);
  });

  it('📌 [Boundary] inline code and addresses are not prose', () => {
    expect(portugueseProseLines('The `não é que` key and ``a criança não consegue`` are identifiers here.\n')).toEqual([]);
    expect(portugueseProseLines('See https://example.org/a-crianca-nao-e-que-se-o-jogo and [the doc](../docs/o-que-e-da-crianca.md).\n'))
      .toEqual([]);
  });

  it('📌 [Right] a name is Portuguese by the identifier gate\'s word list, split as that gate splits', () => {
    // Made-up paths, not pointers: the two real files these once named were renamed (see the `docs` layer of
    // `scripts/rename-map.json`), and an input to the classifier must not look like a path somebody still writes.
    expect(portugueseNameWords('docs/plano-engine.md')).toEqual(['plano']);
    expect(portugueseNameWords('docs/PESQUISA-ALTO-CONTRASTE.md')).toEqual(['pesquisa', 'alto', 'contraste']);
    expect(portugueseNameWords('docs/1-Discovery/study-webcam-control.md')).toEqual([]);
  });
});

// MUTATIONS CHECKED, each in a throwaway clone of the tree (no tracked document was edited):
//   · a Portuguese paragraph appended to a clean doc (docs/ROADMAP.md)   → RED  «no document carries more»
//   · a new doc born with a Portuguese paragraph (docs/new-note.md)       → RED  «no document carries more» (0 -> 2)
//   · a new doc born with a Portuguese name (docs/plano-novo.md)          → RED  «no Markdown file carries a Portuguese NAME»
//   · the reason of the `CLAUDE.md` exclusion emptied                     → RED  «the exclusions are exactly the five»
//   · a sixth exclusion added beside the others                           → RED  «the exclusions are exactly the five»
//   · the .claude/plans/** exclusion removed (the plan in the tree)      → RED  «no document carries more» (0 -> 1839)
//   · a Portuguese paragraph inside a fence in docs/ROADMAP.md            → GREEN (and a case above)
//   · a Portuguese paragraph between «» in docs/ROADMAP.md                → GREEN (and a case above)
//   · a stray « and, after a blank line, a Portuguese paragraph           → RED  «no document carries more» (the « closed)
