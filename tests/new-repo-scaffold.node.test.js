// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SCAFFOLD OF A NEW REPOSITORY — the gate for `scripts/new-repo-scaffold.mjs` (ADR-0067 §2, §3, §5).
//
// ========================= WHAT THIS FILE HOLDS, AND WHY IT IS NOT COSMETIC =========================
// ADR-0067 §3 does not merely list four things a README says — it fixes their ORDER, and the order IS the
// answer the record gives to ADR-0058 §10. A visitor has to learn that the repository is empty BEFORE
// learning anything else, or the README becomes the thing §10 feared: a name that reads as progress.
// A generator that emits the four sections in the wrong order passes every «does it contain» check and
// fails the decision, so the order is asserted directly.
//
// 🎯 AND THE CASE THAT CARRIES §5 IS THE REFUSAL. The script will not run without a record identifier. That
// is the whole difference between a gate and a form field: §5 refuses ACCRETION, not the Dev, and asking
// «which record» costs nothing once the record is written in the same turn as the decision (ADR-0128).
//
// MUTATIONS CONFIRMED at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScaffold, RECORD_PATTERN, REMAINING_ACTS } from '../scripts/new-repo-scaffold.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const OK = Object.freeze({
  name: 'the-inclusionist-art-editor',
  record: 'ADR-0134',
  what: 'A browser annotator and a batch CLI that turn pixel art into semantic images.',
  before: 'The engine art/ subsystem has to exist and be published.',
  licenseText: 'GNU AFFERO GENERAL PUBLIC LICENSE\n Version 3, 19 November 2007\n',
});

describe('ADR-0067 · the scaffold of a new repository', () => {
  it('⚠️ [Vácuo] the four files ADR-0067 §2 names, and no fifth', () => {
    // First, because every case below reads one of these paths: if the shape changed, they would all be
    // asserting about keys that no longer exist and would say nothing while passing.
    expect(Object.keys(buildScaffold(OK)).sort()).toEqual(
      ['.github/workflows/ci.yml', 'LICENSE', 'README.md', 'docs/LICENSES.md'],
    );
  });

  it('🔴 [Right] it REFUSES without a record identifier — §5, and the message says «name it», not «no»', () => {
    // The case that carries the erratum of 2026-09-11. §5 refuses accretion; it does not gate the Dev. The
    // refusal has to read as a missing field, because a message that reads as a prohibition is exactly how
    // this section came to be quoted at him.
    for (const falta of ['record', 'name', 'what', 'before']) {
      const opts = { ...OK, [falta]: '' };
      expect(() => buildScaffold(opts), `«${falta}» empty should refuse`).toThrow();
    }
    let msg = '';
    try { buildScaffold({ ...OK, record: '' }); } catch (e) { msg = e.message; }
    expect(msg, 'the refusal does not name the field').toContain('record');
    expect(msg, 'the refusal does not say the record is NAMED rather than awaited').toContain('not for permission');
  });

  it('[Boundary] a record identifier has a shape — «the art one» is not one', () => {
    expect(RECORD_PATTERN.test('ADR-0134')).toBe(true);
    for (const mau of ['adr-0134', 'ADR-134', 'ADR-01345', 'the art one', '0134']) {
      expect(() => buildScaffold({ ...OK, record: mau }), `«${mau}» should refuse`).toThrow(/--record/);
    }
  });

  it('🎯 [Right] the README says the four things IN THE ORDER of §3', () => {
    // The order is the decision. Reordered, every «toContain» below would still pass.
    const r = buildScaffold(OK)['README.md'];
    const iQue = r.indexOf(OK.what);
    const iVazio = r.indexOf('This has NOT been built');
    const iRegisto = r.indexOf(OK.record);
    const iAntes = r.indexOf(OK.before);
    for (const [nome, i] of [['what it is', iQue], ['not built', iVazio], ['record', iRegisto], ['before', iAntes]]) {
      expect(i, `the README does not carry «${nome}»`).toBeGreaterThan(-1);
    }
    expect(iQue, 'what it is must come first').toBeLessThan(iVazio);
    expect(iVazio, 'the emptiness must precede the record').toBeLessThan(iRegisto);
    expect(iRegisto, 'the record must precede what has to exist first').toBeLessThan(iAntes);
  });

  it('⚠️ [Right] the README carries the debt with its due date — §3 last paragraph', () => {
    // Without this sentence the README survives its own falsification, which the record names as the
    // failure mode it creates and which nothing else checks today.
    const r = buildScaffold(OK)['README.md'];
    expect(r).toContain('becomes false on the commit that lands product code');
    expect(r).toContain('not a follow-up');
  });

  it('🎯 [Right] the CI caller INVOKES the reusable workflow and copies no step of it', () => {
    // ADR-0068 §4: «Nothing is copied», because copies drift and the ones that drift silently stop gating.
    const y = buildScaffold(OK)['.github/workflows/ci.yml'];
    expect(y).toContain('uses: the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml@main');
    for (const passoCopiado of ['npm ci', 'npm run typecheck', 'npx playwright install', 'npm run build']) {
      expect(y, `the caller COPIED «${passoCopiado}» instead of invoking the workflow`).not.toContain(passoCopiado);
    }
  });

  it('⚠️ [Right] the `adr` job is local, fetches the records, and is DORMANT without the token', () => {
    // ADR-0123 clause 4: the gate is local to every repository; the script comes from the records repo.
    // And a job that silently passes when it checked nothing is worse than no job — it has to say so.
    const y = buildScaffold(OK)['.github/workflows/ci.yml'];
    expect(y).toContain('repository: the-inclusionist/the-inclusionist-docs');
    expect(y).toContain('validate-adr.py');
    expect(y).toContain('DOCS_READ_TOKEN');
    expect(y, 'a dormant gate that does not announce itself reads as a pass').toContain('DORMANT');
  });

  it('[Right] `a11y` reaches the caller in both directions', () => {
    expect(buildScaffold({ ...OK, a11y: true })['.github/workflows/ci.yml']).toContain('a11y: true');
    expect(buildScaffold(OK)['.github/workflows/ci.yml']).toContain('a11y: false');
  });

  it('⚠️ [Right] `docs/LICENSES.md` says art is NOT AGPL — the omission §2 exists to prevent', () => {
    const l = buildScaffold(OK)['docs/LICENSES.md'];
    expect(l).toContain('AGPL-3.0-or-later');
    expect(l, 'it does not say art is outside the code licence').toMatch(/Art is NOT AGPL/);
    expect(l, 'it does not name the record that governs art').toContain('ADR-0133');
  });

  it('⚠️ [Interface] the LICENSE is the engine’s own, not a paraphrase', () => {
    // The one file that must not be generated. A licence retyped is a licence that can drift from the one
    // `package.json` declares, and ADR-0064’s confirmation asserts those two agree.
    const real = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
    expect(real, 'the engine LICENSE is not AGPL — the whole premise moved').toContain('AFFERO');
    expect(buildScaffold({ ...OK, licenseText: real })['LICENSE']).toBe(real);
  });

  it('📌 [Interface] what is left for a person is stated, and none of it is a file', () => {
    // The script writes files and stops. Creating the repository, protecting `main` and adding the secret
    // are acts on the host — irreversible, and the Dev’s.
    const texto = REMAINING_ACTS.join(' ');
    for (const acto of ['Create the repository', 'Protect `main`', 'DOCS_READ_TOKEN']) {
      expect(texto, `the remaining acts do not mention «${acto}»`).toContain(acto);
    }
  });
});

// ========================= MUTATIONS CONFIRMED =========================
// Each applied by script to the file, with an occurrence count checked before applying.
//   · 🎯 dropping `record` from the required list -> the refusal case fails. It is the erratum of 2026-09-11
//     in one line: §5 stops being enforced anywhere, and the rule goes back to living in prose that somebody
//     quotes at somebody else.
//   · reordering the README sections (emptiness after the record) -> ONLY the order case fails; every
//     `toContain` still passes. That is the mutation worth having, because the order is the decision and a
//     containment check cannot see it.
//   · replacing `uses:` with the workflow's own steps -> the caller case fails on the copied `npm ci`. It is
//     ADR-0068 §4 measured rather than trusted.
//   · deleting the «becomes false on the commit» paragraph -> the debt case fails. Without it the README
//     survives its own falsification, which ADR-0067 names as the failure mode it creates.
//   · dropping the DORMANT step from the `adr` job -> the dormancy case fails. A gate that checked nothing
//     and said nothing is the shape this repository already paid for once.
