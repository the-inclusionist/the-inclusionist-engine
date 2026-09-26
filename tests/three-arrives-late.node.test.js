// SPDX-License-Identifier: AGPL-3.0-or-later
// THREE.JS ARRIVES LATE, AND BY ONE DOOR (ADR-0234 errata, route B): the Dev let three.js in as a run-time dependency on one
// condition — it is reached ONLY through a dynamic `import()` from the free Libras player when deaf mode first signs, so no child
// without deaf mode downloads it. This holds the condition in the source, where a bundler reads it: exactly one module names
// three.js (`ui/libras-avatar-stage`), and nothing loads that module but a dynamic `import()` — a static import of it, anywhere,
// would pull three.js into the page's first download. Read by the TypeScript parser (`scripts/lib/module-specifiers.mjs`), so
// comments and strings are not imports and `import type` is erased, as it is at run time.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';
import { sourceText } from './fixtures/parsed-sources.js';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const STAGE = 'js/ui/libras-avatar-stage.ts';

function sources(dir = APP, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'public' && name !== 'vendor') sources(p, out); continue; }
    if (/\.(ts|html)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const rel = (p) => relative(APP, p).split('\\').join('/');
/** What each source loads at run time: its value specifiers (type-only ones are erased), with their kind. */
const loads = (p) => specifiersOf(p.endsWith('.html') ? (sourceText(p).match(/<script[^>]*>([\s\S]*?)<\/script>/g) ?? []).join('\n').replace(/<\/?script[^>]*>/g, '') : sourceText(p))
  .filter((s) => !s.typeOnly && s.spec);
const isThree = (spec) => spec === 'three' || spec.startsWith('three/');

describe('three.js is reached only by the free player\'s dynamic import (ADR-0234 errata)', () => {
  it('🔴 [Right] exactly one module names three.js: the avatar\'s stage', () => {
    const naming = sources().filter((p) => loads(p).some((s) => isThree(s.spec))).map(rel);
    expect(naming, 'three.js is named outside the avatar\'s stage: it would reach a page that never signs').toEqual([STAGE]);
  });

  it('🎯 [Right] and nothing loads the stage but a dynamic `import()` — a static import would put three.js in the first download', () => {
    const reaching = sources().flatMap((p) => loads(p)
      .filter((s) => /libras-avatar-stage(\.js)?$/.test(s.spec))
      .map((s) => `${rel(p)}:${s.line} ${s.kind}`));
    expect(reaching.length, 'nothing reaches the stage: the free player cannot draw').toBeGreaterThan(0);
    expect(reaching.filter((r) => !r.endsWith(' dynamic')), 'the stage is loaded statically somewhere').toEqual([]);
  });

  it('🔴 [Right] and no install downloads it either: the service worker\'s precache leaves the stage\'s chunk out', () => {
    // 📏 measured on the build of 2026-09-25: without this, the precache held `assets/libras-avatar-stage-<hash>.js`, 627 KB of
    // three.js, and every install downloaded it — the one thing the decision that let three.js in forbids
    const config = sourceText(fileURLToPath(new URL('../vite.config.ts', import.meta.url)));
    const ignores = /globIgnores:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';
    const stageName = STAGE.split('/').pop().replace(/\.ts$/, '');
    expect(ignores, 'the precache takes every chunk, three.js\'s included').toContain(`'**/${stageName}-*.js'`);
  });

  it('🔴 [Right] and its MIT notice travels with it: the build keeps the `@license` comments the minifier would strip', () => {
    // 📏 measured on the build of 2026-09-25: without this, the stage's chunk carried three.js with zero `@license` comments —
    // the MIT licence's one condition is that its notice goes with every copy; with it, the chunk keeps three.js's two
    const config = sourceText(fileURLToPath(new URL('../vite.config.ts', import.meta.url)));
    expect(config, 'the build strips the licence comments, and three.js ships without its notice')
      .toMatch(/comments:\s*\{\s*legal:\s*true\s*\}/);
  });

  it('⚠️ [Interface] and the sweep is alive: it reads the tree, the pages included, and sees both forms', () => {
    expect(sources().length).toBeGreaterThan(100);
    expect(sources().map(rel)).toContain('quiz.html');
    expect(specifiersOf("const { a } = await import('./libras-avatar-stage.js');")[0]).toMatchObject({ kind: 'dynamic' });
    expect(specifiersOf("import { WebGLRenderer } from 'three';")[0]).toMatchObject({ kind: 'import', spec: 'three' });
    expect(specifiersOf("import type { AvatarStage } from './libras-avatar-stage.js';")[0].typeOnly).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-25, scripted: each applied, this file run, the file restored from a copy — all 3 red)
//   T1 the player importing the stage statically                         🔴 «nothing loads the stage but a dynamic import»
//   T2 another module naming three.js                                    🔴 «exactly one module names three.js»
//   T3 the precache taking the stage's chunk                             🔴 «no install downloads it either»
//   T4 the build's `comments: { legal: true }` removed                   🔴 «its MIT notice travels with it»
// And in `tests/engine-package.node.test.js`: E1 three.js declared as `^0.186.1` 🔴 «FIXA na versão exacta».
