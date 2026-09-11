// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SCAFFOLD OF A NEW REPOSITORY — the four files ADR-0067 §2 requires, written once instead of by hand.
//
// ========================= WHY THIS EXISTS =========================
// The Dev asked, on 2026-09-11, why ADR-0067 obstructs him every time he creates a repository. Two answers
// came out of reading it, and this script is the second one.
//
// The first is that §5 was being read as a permission gate and never said that — it is a scope limit on §1,
// aimed at ACCRETION (a name in a backlog item, a folder somebody made), which in this project means the AI.
// That went into the record as errata.
//
// 🔴 THE SECOND IS A REAL COST THE ERRATA DOES NOT TOUCH: §2 asks for four files and the host settings, and
// ADR-0123 adds a fifth thing — an `adr` job local to the repository. Doing that by hand is an afternoon per
// repository, and an afternoon per repository is why a rule that was written to make creation CHEAP feels
// expensive. 📌 ADR-0068 §6 has a template for the three hundred game repositories; the eleven infrastructure
// addresses of ADR-0058 never got one. This is it.
//
// ========================= WHAT IT REFUSES, AND WHY THAT IS THE POINT =========================
// ⚠️ IT WILL NOT RUN WITHOUT A RECORD IDENTIFIER. That is §5, enforced in the only place where enforcing it
// costs the Dev nothing: the record is written in the same turn as the decision (ADR-0128), so by the time
// anyone runs this, the identifier exists. The flag turns «you may not» into «name it», which is the whole
// difference between a gate and a form field.
//
// 🎯 AND IT DOES NOT CREATE ANYTHING ON GITHUB. Creating the repository, protecting `main` and setting team
// permissions are acts on the host — irreversible, and the Dev's. This writes files into a directory and
// prints what is left to do.
//
// Usage:
//   node scripts/new-repo-scaffold.mjs \
//     --dir=../the-inclusionist-art-editor \
//     --name=the-inclusionist-art-editor \
//     --record=ADR-0134 \
//     --what="A browser annotator and a batch CLI that turn pixel art into semantic images." \
//     --before="The engine's art/ subsystem (semantic, palettes, recolor) has to exist and be published." \
//     [--a11y]
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The record identifier is the one field with a shape, because §5 is about naming a record, not any string. */
export const RECORD_PATTERN = /^ADR-\d{4}$/;

/**
 * The four files, built from options alone.
 *
 * ⚠️ `licenseText` arrives by injection rather than being read here: the pure half must be drivable by a
 * fixture, and a function that reads the repository root cannot be. It is the same reason `PanelShellCtx`
 * never reaches the global `document`.
 */
export function buildScaffold(options) {
  const missing = ['name', 'record', 'what', 'before'].filter((k) => !String(options[k] ?? '').trim());
  if (missing.length) {
    throw new Error(
      `missing required option(s): ${missing.join(', ')}. `
      + 'ADR-0067 §5 asks which record declares this address — not for permission. '
      + 'The record is written in the same turn as the decision (ADR-0128), so name it.',
    );
  }
  if (!RECORD_PATTERN.test(options.record)) {
    throw new Error(`--record must look like ADR-0134, got «${options.record}»`);
  }
  const { name, record, what, before, a11y = false, licenseText = '' } = options;

  // ⚠️ THE ORDER OF THESE FOUR SECTIONS IS ADR-0067 §3 AND IS NOT COSMETIC. A visitor who lands here must
  // learn that it is empty BEFORE learning anything else; that is the whole answer this record gives to
  // ADR-0058 §10's objection that a named empty repository reads as progress.
  const readme = [
    `# ${name}`,
    '',
    what.trim(),
    '',
    '## This has NOT been built',
    '',
    'This repository holds no product code. It carries a README, a licence, a licence statement for art and',
    'a CI caller, and nothing else. Emptiness here is a fact about the project, not a step in it.',
    '',
    `## Declared by ${record}`,
    '',
    `The address exists because ${record} declares it (ADR-0067 §1). A repository is created when a record`,
    'names its address; the first commit is only the first consequence.',
    '',
    '## Before the first product commit',
    '',
    before.trim(),
    '',
    '> ⚠️ The section **This has NOT been built** becomes false on the commit that lands product code, and a',
    '> README that lies about being empty is worse than the empty repository. Removing it is part of that',
    '> commit, not a follow-up (ADR-0067 §3).',
    '',
  ].join('\n');

  const licenses = [
    '# Licences',
    '',
    '**Code is AGPL-3.0-or-later** (ADR-0064). See `LICENSE` at the root.',
    '',
    '⚠️ **Art is NOT AGPL, and never inherits it.** A program is what Lei 9.609 defines; art is a work under',
    'Lei 9.610 and belongs to whoever made it (ADR-0010, pillar 10). Art enters this project by the three',
    'doors of **ADR-0133** — the author’s grant, a public licence that passes four questions, or the CC BY-SA',
    'bridge that converts to `GPL-3.0-only` on our side — and ND and NC have no door at all.',
    '',
    'The full statement, with the ledger schema and the sources already measured, lives in the engine:',
    '[`the-inclusionist-engine/docs/LICENSES.md`](https://github.com/the-inclusionist/the-inclusionist-engine/blob/main/docs/LICENSES.md).',
    '',
    '📌 This file exists because a repository carrying only the code licence teaches the wrong thing by',
    'omission (ADR-0067 §2).',
    '',
  ].join('\n');

  // 🎯 `uses:` AND NOT A COPY. ADR-0068 §4: «Nothing is copied», because copies drift and the ones that
  // drift silently are the ones that stop gating.
  const workflow = [
    '# SPDX-License-Identifier: AGPL-3.0-or-later',
    '# The gate is the organisation’s reusable workflow, INVOKED and never copied (ADR-0068 §4).',
    '# The `adr` job is local to this repository on purpose (ADR-0123 clause 4): the gate reddens here, on',
    '# this repository’s push, and the SCRIPT it runs comes from the records repository — one implementation,',
    '# N gates, instead of N copies.',
    'name: ci',
    '',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'concurrency:',
    '  group: ci-${{ github.ref }}',
    '  cancel-in-progress: true',
    '',
    'jobs:',
    '  gate:',
    '    uses: the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml@main',
    '    with:',
    `      a11y: ${a11y ? 'true' : 'false'}`,
    '',
    '  adr:',
    '    runs-on: ubuntu-latest',
    '    env:',
    '      # ⚠️ A secret cannot be read in a job-level `if:`, so it becomes a boolean here and the steps read it.',
    "      HAS_TOKEN: ${{ secrets.DOCS_READ_TOKEN != '' }}",
    '    steps:',
    '      - uses: actions/checkout@v7',
    '',
    '      - name: DORMANT — the records could not be fetched, so nothing here was checked',
    "        if: env.HAS_TOKEN != 'true'",
    '        run: |',
    '          echo "::warning title=ADR gate dormant::the secret DOCS_READ_TOKEN is not set, so the records" \\',
    '               "were NOT fetched and NOTHING was validated. This job is a notice, not a pass."',
    '',
    '      - name: the records',
    "        if: env.HAS_TOKEN == 'true'",
    '        uses: actions/checkout@v7',
    '        with:',
    '          repository: the-inclusionist/the-inclusionist-docs',
    '          path: adr-tree',
    '          token: ${{ secrets.DOCS_READ_TOKEN }}',
    '',
    '      - uses: actions/setup-python@v7',
    "        if: env.HAS_TOKEN == 'true'",
    '        with:',
    '          python-version: "3.12"',
    "      - if: env.HAS_TOKEN == 'true'",
    '        run: pip install --quiet pyyaml',
    "      - if: env.HAS_TOKEN == 'true'",
    '        run: python adr-tree/scripts/validate-adr.py adr-tree/docs/2-Architecture/adr --repo docs=adr-tree',
    '',
  ].join('\n');

  return {
    'README.md': readme,
    'LICENSE': licenseText,
    'docs/LICENSES.md': licenses,
    '.github/workflows/ci.yml': workflow,
  };
}

/** What is left for a person, because none of it is a file. */
export const REMAINING_ACTS = [
  'Create the repository on GitHub under the-inclusionist, and push this scaffold to `main`.',
  'Protect `main` and set the organisation’s team permissions — ADR-0067 §2 says this is cheapest now,',
  '  on an empty repository, and most expensive after someone has pushed to it wrongly.',
  'Add the `DOCS_READ_TOKEN` secret, or the `adr` job stays dormant and says so on every run.',
  'Write the record that declares the address, if it is not written yet — ADR-0128 puts it in the same turn.',
];

function parseArgs(argv) {
  const out = { a11y: false };
  for (const a of argv) {
    if (a === '--a11y') { out.a11y = true; continue; }
    const m = /^--([a-z]+)=([\s\S]*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.dir) {
    console.error('--dir=<path> is required. Nothing is created on GitHub; this writes files into a directory.');
    process.exit(2);
  }
  // Poka-yoke: refuse a directory that already holds something. Overwriting a scaffold is how a README that
  // was corrected gets un-corrected.
  if (existsSync(opts.dir) && readdirSync(opts.dir).length > 0) {
    console.error(`${opts.dir} exists and is not empty — refusing to overwrite.`);
    process.exit(2);
  }
  let files;
  try {
    files = buildScaffold({ ...opts, licenseText: readFileSync(join(ROOT, 'LICENSE'), 'utf8') });
  } catch (e) {
    console.error(String(e.message));
    process.exit(2);
  }
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(opts.dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
    console.log(`  wrote ${rel}`);
  }
  console.log(`\n${Object.keys(files).length} files in ${opts.dir}. What is left is not a file:\n`);
  for (const line of REMAINING_ACTS) console.log(`  · ${line}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('new-repo-scaffold.mjs')) main();
