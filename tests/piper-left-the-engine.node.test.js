// SPDX-License-Identifier: AGPL-3.0-or-later
// PIPER LEFT THE ENGINE (ADR-0207; issue #193): three of its four voices are fine-tuned from lessac, whose Blizzard 2013 training
// data is licensed for research only and not to be distributed, and the delivery had been copying them into every build. Nothing
// the engine ships or builds from — its code, its scripts, its dependencies, its build and service-worker configuration, its
// headers — names the Piper runtime, its voices or its phonemizer again.
//
// 📌 Tests are outside the scan: a gate that names what it forbids, and the package gate that refuses a model file by name, have to.
// The one line inside is a stored preference read as retired (`platform/tts`), named here with its reason.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN = /piper|pt_BR-faber|en_US-amy|en_US-ryan|es_MX-claude|diffusionstudio/i;
const TEXT_FILE = /\.(ts|mts|js|mjs|cjs|json|html|css|txt|webmanifest)$|^_headers$/;

/** Every text file the engine ships or builds from. */
function tree() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
      if (TEXT_FILE.test(name)) out.push(relative(ROOT, p).replaceAll('\\', '/'));
    }
  };
  walk(join(ROOT, 'app'));
  walk(join(ROOT, 'scripts'));
  for (const f of ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.pkg.json']) out.push(f);
  return out;
}

/** The lines allowed to name it, each with its reason: a key a child's device may still hold. */
const ALLOWED = new Map([
  ["app/js/platform/tts.ts|const MOTORES_QUE_SAIRAM: readonly string[] = ['piper'];",
    'a stored engine choice from before ADR-0207, read as no choice so the voice in use speaks instead of an alert on every word'],
]);

describe('Piper left the engine (ADR-0207)', () => {
  const FILES = tree();

  it('🎯 [Vacuum] the scan reads the engine: its code, its scripts, its package and build configuration', () => {
    expect(FILES.length, 'the scan found almost nothing — it would pass by reading nothing').toBeGreaterThan(150);
    expect(FILES).toEqual(expect.arrayContaining(['app/js/platform/tts.ts', 'app/public/_headers', 'package.json', 'vite.config.ts']));
  });

  it('🔴 [Zero] no file names the Piper runtime, its voices or its phonemizer — outside the named lines', () => {
    const found = [];
    for (const f of FILES) {
      let text;
      try { text = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
      text.split(/\r?\n/).forEach((line, i) => {
        if (FORBIDDEN.test(line) && !ALLOWED.has(`${f}|${line.trim()}`)) found.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(found, 'Piper is back in the engine — ADR-0207 took it out for its voices\' licence').toEqual([]);
  });

  it('📌 [Boundary] every allowed line still exists — an allowance whose line left excuses the next one in advance', () => {
    for (const key of ALLOWED.keys()) {
      const [f, line] = key.split('|');
      const lines = readFileSync(join(ROOT, f), 'utf8').split(/\r?\n/).map((l) => l.trim());
      expect(lines, `the allowed line left ${f}: remove it from ALLOWED`).toContain(line);
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 `"@mintplex-labs/piper-tts-web"` back in devDependencies   🔴 [Zero]
//   S2 a Piper voice id back in `platform/kokoro`                  🔴 [Zero]
//   S3 the HF piper-voices route back in `vite.config`             🔴 [Zero]
//   S4 the allowed line reworded in `platform/tts`                 🔴 [Zero] and [Boundary]
//   S5 the scan limited to `app/js`                                🔴 [Vacuum]
