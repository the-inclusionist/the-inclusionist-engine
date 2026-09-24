// SPDX-License-Identifier: AGPL-3.0-or-later
// A RENAMED MEMBER LEAVES NOTHING BEHIND (ADR-0230 §4, issue #206).
//
// Phase 7 renames published members through TypeScript's language service, which follows a member through its TYPE. What
// it cannot follow is an object nothing types — and the tests are full of them: 📏 on the day the `core` layer landed, some
// sixty game declarations in `tests/*.js` were built by untyped helpers (`declaracaoValida()`), and the service renamed
// none of their keys. A declaration with the old key does not fail by itself: the engine reads the new key, finds
// `undefined`, and quietly uses a default. That is the case this file makes loud.
//
// It reads `scripts/apply-member-rename.mjs`'s `leftovers()`: every applied old name still sitting in a member position.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leftovers } from '../scripts/apply-member-rename.mjs';

const ROOT = process.cwd();
const map = JSON.parse(readFileSync(join(ROOT, 'scripts/member-rename-map.json'), 'utf8'));

describe('a renamed member leaves nothing behind', () => {
  it('🔴 [Right] no old member name of an applied layer is left in an object key, an access, a destructuring or a type string', () => {
    const left = leftovers().map((l) => `${l.file}:${l.line} ${l.name} (${l.kind})`);
    expect(left, 'rename these by the table in scripts/member-rename-map.json — the engine reads the NEW name').toEqual([]);
  }, 60_000);

  it('⚠️ [Interface] every data-read exemption names a file that exists and still reads that name — an exemption cannot outlive its reason', () => {
    const stale = Object.keys(map.dataReads ?? {}).filter((k) => {
      const [file, name] = k.split(' ');
      return !existsSync(join(ROOT, file)) || !new RegExp(`\\.${name}\\b`).test(readFileSync(join(ROOT, file), 'utf8'));
    });
    expect(stale).toEqual([]);
  });

  it('⚠️ [Interface] a stored shape is never both excluded and renamed', () => {
    const renamed = new Set(Object.values(map.layers).flatMap((l) => Object.keys(l)));
    expect(Object.keys(map.excluded).filter((k) => renamed.has(k))).toEqual([]);
  });
});
