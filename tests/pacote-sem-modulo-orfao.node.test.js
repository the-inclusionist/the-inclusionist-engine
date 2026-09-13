// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PACKAGE PUBLISHES NO MODULE THE SOURCE NO LONGER HAS.
//
// 📏 Measured on 2026-09-13: after `ui/activities-menu` left `app/js` (issue #171), `npm run build:pkg` left
// `dist-pkg/ui/activities-menu.js` in place — `tsc` writes and never deletes — and `prepack` would have published it.
// `scripts/clean-dist-pkg.mjs` now empties the folder first.
//
// 📌 Runs against a `dist-pkg/` that exists (a local build, or CI after `npm ci`, whose `prepare` builds it); without one
// there is nothing to compare, and the case says so instead of passing on an empty folder.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const PKG = join(RAIZ, 'dist-pkg');

function arquivos(dir, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, fora); else fora.push(relative(dir === PKG ? PKG : PKG, p).split('\\').join('/'));
  }
  return fora;
}

describe('the compiled package mirrors the source', () => {
  it('🔴 [Right] build:pkg empties dist-pkg before compiling', () => {
    const script = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).scripts['build:pkg'];
    expect(script, 'build:pkg compiles over what the last build left').toMatch(/^node scripts\/clean-dist-pkg\.mjs && /);
  });

  it.skipIf(!existsSync(PKG))('🔴 [Right] every compiled module has its source in app/js', () => {
    const orfaos = arquivos(PKG).filter((f) => /\.js$/.test(f))
      .filter((f) => !existsSync(join(RAIZ, 'app', 'js', f.replace(/\.js$/, '.ts'))));
    expect(orfaos, 'dist-pkg holds modules app/js no longer has — prepack would publish them').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   O1 build:pkg without the cleaning step                         🔴 empties first
//   O2 a stale `dist-pkg/ui/fantasma.js` left by an earlier build    🔴 every compiled module has its source
