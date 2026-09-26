// SPDX-License-Identifier: AGPL-3.0-or-later
// A WORKFLOW'S BLOCK SCALARS END WHERE THEIR INDENTATION ENDS — NOT AT A STRAY LINE IN THE MIDDLE.
//
// b764c41b (2026-09-24) translated the workflow's comments and left three lines of a comment at column 0 inside the
// gitleaks step's `run: |` block. In YAML a less-indented line ENDS a block scalar, so the lines after it were no longer
// shell: they were YAML, and invalid. GitHub does not report that as a red run — it runs the workflow with NO JOBS, and
// the engine went two days with no gate at all while every push looked like it had been checked (fixed in 2a922c1b).
//
// 📌 WHY IT IS A TEST AND NOT A CI STEP: a workflow that does not parse runs nothing, including the step that would say it
// does not parse. The only place this check can speak is the suite a person runs before pushing.
//
// ⚠️ WHAT IT IS NOT: a YAML parser. The engine has none among its dependencies, and adding one for this is a dependency
// decision, not a test. It checks the shape of that defect — a block scalar (`run: |`, `key: >`) cut by a line less
// indented than its content, after which a line still sits deeper than the key — plus tabs in indentation, which YAML
// forbids. PyYAML read both workflows as valid on 2026-09-26, the day this was written, and read the mutation below as
// invalid.
//
// MUTATIONS CHECKED (2026-09-26):
//   · b764c41b's defect restored in ci.yml (`git show 2a922c1b | git apply -R`) → RED, naming the gitleaks step's
//     `run: |` and the first column-0 line; PyYAML refused the same file («while parsing a block mapping»);
//   · `blocksCut` made to return [] → the [Right] fixture case RED;
//   · comments no longer skipped after a block ends → the [Boundary] fixture case RED (and both real files, whose
//     comments follow blocks).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

const indentOf = (line) => /^ */.exec(line)[0].length;
const blank = (line) => line.trim() === '';
const comment = (line) => line.trimStart().startsWith('#');
/** `key: |`, `- run: >-`, with an optional trailing comment — a block scalar opens on this line. */
const HEADER = /^ *(?:- +)?[^\s#'"][^:#]*: +[|>][+-]?[1-9]?[+-]?\s*(?:#.*)?$/;
/** What may legitimately follow a block: a mapping key or a sequence entry. */
const STRUCTURE = /^ *(?:- |-$|[^\s#][^:]*:(?: |$))/;

/**
 * Every block scalar cut before its indentation ends, as «line: reason». Pure over the text, so the detector is tested on
 * fixtures as well as run on the real files.
 */
function blocksCut(text) {
  const lines = text.split(/\r?\n/);
  const problems = [];
  lines.forEach((line, i) => {
    if (/^ *\t/.test(line)) problems.push(`${i + 1}: a tab in the indentation, which YAML forbids`);
  });
  for (let i = 0; i < lines.length; i++) {
    if (!HEADER.test(lines[i])) continue;
    // The key's column: its indentation, plus the «- » of a sequence entry (`- run: |` → the column of `run`).
    const keyCol = indentOf(lines[i]) + (/^ *(- +)/.exec(lines[i])?.[1].length ?? 0);
    let first = i + 1;
    while (first < lines.length && blank(lines[first])) first++;
    if (first >= lines.length || indentOf(lines[first]) <= keyCol) continue; // an empty block
    const content = indentOf(lines[first]);
    let end = first;
    while (end < lines.length && (blank(lines[end]) || indentOf(lines[end]) >= content)) end++;
    if (end >= lines.length) continue;
    // YAML ends the block at `end`. That is right only if what follows the comments there belongs to the parent.
    let next = end;
    while (next < lines.length && (blank(lines[next]) || comment(lines[next]))) next++;
    if (next >= lines.length) continue;
    if (indentOf(lines[next]) > keyCol) {
      problems.push(`${i + 1}: the block opened here is cut at line ${end + 1} (${JSON.stringify(lines[end].trim().slice(0, 40))}), `
        + `and line ${next + 1} is still indented as its content — indent line ${end + 1} to column ${content}`);
    } else if (!STRUCTURE.test(lines[next])) {
      problems.push(`${i + 1}: the block opened here is cut at line ${next + 1}, which is neither a key nor a list entry — `
        + `indent it to column ${content}`);
    }
  }
  return problems;
}

describe('the workflows\' block scalars are not cut', () => {
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));

  it('🎯 [Existence] there are workflows to check — a check over zero files proves nothing', () => {
    expect(files).toContain('ci.yml');
    expect(files).toContain('game-ci.yml');
  });

  it.each(files)('🔴 [Right] %s: every block scalar runs to the end of its indentation', (f) => {
    const text = readFileSync(WORKFLOWS + f, 'utf8');
    expect(text, `${f} has no block scalar — the check would measure nothing`).toMatch(/^ *(?:- +)?run: +\|/m);
    expect(blocksCut(text), `${f}: GitHub runs a workflow that does not parse with NO jobs, and says nothing`).toEqual([]);
  });

  it('🔴 [Right] the detector sees b764c41b\'s defect: a comment at column 0 inside `run: |`', () => {
    const cut = [
      'jobs:',
      '  secrets:',
      '    steps:',
      '      - name: gitleaks',
      '        run: |',
      '          # a comment that begins well,',
      '# and goes on at column 0',
      '          ./gitleaks detect --source .',
    ].join('\n');
    expect(blocksCut(cut)).toHaveLength(1);
    expect(blocksCut(cut)[0]).toMatch(/^5: .*cut at line 7/);
  });

  it('🎯 [Boundary] a comment at column 0 AFTER a block, before the next step, is only a comment — no cry of wolf', () => {
    const fine = [
      'jobs:',
      '  a11y:',
      '    steps:',
      '      - name: build',
      '        run: |',
      '          npm run build',
      '      # a note about the next step,',
      '# carried on at column 0',
      '      - name: axe',
      '        run: |',
      '          npm run preview &',
      '          npm run test:a11y',
      '',
      '  dco:',
      '    runs-on: ubuntu-latest',
    ].join('\n');
    expect(blocksCut(fine)).toEqual([]);
  });
});
