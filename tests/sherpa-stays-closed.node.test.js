// SPDX-License-Identifier: AGPL-3.0-or-later
// SHERPA-ONNX IS CLOSED FOR GOOD (ADR-0132; the Dev: «Deixe isso em ADR para não voltar mais.»), and nothing that DIRECTS
// work may name it again. The records and the research keep its history, and a history is not a direction; what directs
// work is the code, its configuration and its tests. The rule was true when measured on 2026-09-27 — and no sieve would
// have failed on a new comment that revived it, which is what this file closes.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Where work is directed: the engine's code, the scripts, the tests and the build's configuration. */
const DIRECTS_WORK = ['app/', 'scripts/', 'tests/', 'vite.config.ts', 'vitest.config.ts', 'package.json', 'tsconfig.json'];
/**
 * The files that name it ON PURPOSE, each with its reason. Not a wildcard: a line here whose file no longer names it
 * fails the second case, so the exemption leaves with the fact that justified it.
 */
const ON_PURPOSE = {
  'scripts/word-lists.json': 'the language gate\'s dictionary classifies the word, which is data about words',
  'tests/no-voice-model-in-the-package.node.test.js': 'it REFUSES sherpa\'s files in the package, by name',
  'tests/sherpa-stays-closed.node.test.js': 'this file',
};

/** The tracked files under `DIRECTS_WORK` that name sherpa, case-insensitively. A failing grep is thrown, never read as none. */
function namingIt() {
  try {
    return execFileSync('git', ['grep', '-l', '-i', 'sherpa', '--', ...DIRECTS_WORK], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch (e) {
    if (e.status === 1) return [];
    throw e;
  }
}

describe('sherpa-onnx is closed for good (ADR-0132)', () => {
  it('🔴 [Right] no code, script, test or build configuration names it, beyond the files that refuse it on purpose', () => {
    const found = namingIt().filter((f) => !Object.hasOwn(ON_PURPOSE, f));
    expect(found, 'sherpa is named again where work is directed — ADR-0132 closed it for good').toEqual([]);
  });

  it('⚠️ [Zero] every exemption still names it — an exemption that outlived its reason is a free pass', () => {
    const found = new Set(namingIt());
    expect(Object.keys(ON_PURPOSE).filter((f) => !found.has(f)), 'these no longer name sherpa: take them off the list').toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-27, each applied and restored from a copy)
//   S1 a comment naming sherpa added to an engine module (`app/js/core/ring.ts`)      🔴 [Right]
//   S2 the vite.config.ts comment restored to its old wording, which named it          🔴 [Right]
//   S3 an exemption for a file that no longer names it                                 🔴 [Zero]
//   S4 the failing-grep guard swallowed, with a broken command                          🔴 [Zero] (the grep that never ran
//      answers «none», and the exemptions then all read as stale)
