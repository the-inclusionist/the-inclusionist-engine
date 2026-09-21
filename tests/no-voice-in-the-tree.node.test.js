// SPDX-License-Identifier: AGPL-3.0-or-later
// A VOICE NEVER ENTERS THE TREE — recordings are personal data, and a commit is public and permanent.
//
// The Dev records himself so the reading and the command tests have real speech to measure (`research/`, ADR-0191). Those files are
// HIS VOICE: a biometric of a named person, which the project's own pillars would refuse to collect from a child and must equally
// refuse to publish from him. They are read where they sit and never tracked.
//
// 🔴 WHY THIS GATE EXISTS, and it is not a hypothetical: on 2026-09-21 a `git add -A` staged all six recordings into a commit about
// something else, and nothing in the repository objected — the commit was made and had to be undone by hand. The rule had been
// written down for a week; what was missing was a brake that does not depend on remembering it. The `.gitignore` line is the first
// brake and this case is the second, because a `git add -f`, a rename or a new extension walks straight past the first.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Sound a person's voice arrives in. Not a guess: the six files in `research/` are `.m4a`, the lab's exports are `.wav`. */
const SOM = /\.(m4a|wav|mp3|ogg|oga|opus|flac|aac|amr|weba)$/i;

const rastreados = () => execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

describe('a recorded voice never enters the tree', () => {
  it('🔴 [Zero] no tracked file is a sound recording', () => {
    const achados = rastreados().filter((f) => SOM.test(f));
    expect(achados, 'a recording is tracked: it is someone\'s voice, and a push publishes it for good').toEqual([]);
  });

  it('🔴 [Right] and the working copy is measured — a case that read a folder that is not there would pass for ever', () => {
    // The gate above answers «none», which is also what it would answer with git broken or the repository empty. This one holds
    // the instrument up: there ARE files, and the extension rule does recognise a recording when it sees one.
    expect(rastreados().length, 'nothing is tracked — the case above measured nothing').toBeGreaterThan(100);
    expect(SOM.test('research/pt-Maos-Dadas.m4a'), 'the rule stopped recognising a recording').toBe(true);
    expect(SOM.test('docs/6-DevOps-SRE/models.md'), 'the rule calls a document a recording').toBe(false);
  });

  it('🔴 [Right] the first brake is written down too: `.gitignore` keeps recordings out of `git add -A`', () => {
    const ignore = readFileSync('.gitignore', 'utf8');
    for (const ext of ['m4a', 'wav', 'mp3', 'ogg']) {
      expect(ignore, `\`research/*.${ext}\` is not ignored — a \`git add -A\` would stage a voice again`)
        .toMatch(new RegExp(`^research/\\*\\.${ext}$`, 'm'));
    }
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-a-voz-nao-entra.py`:
//   · one of the Dev's recordings staged (`git add research/pt-Comandos.m4a`) → «no tracked file is a sound recording»
//   · the `research/*.m4a` line taken out of `.gitignore`                     → «the first brake is written down too»
//   · the extension rule narrowed to `.mp3`                                   → «the rule stopped recognising a recording»
