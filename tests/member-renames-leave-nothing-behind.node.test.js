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
import ts from 'typescript';
import { leftovers, isMember, keyOf } from '../scripts/apply-member-rename.mjs';
import { source, words, readLists } from '../scripts/language-inventory.mjs';

const ROOT = process.cwd();
const map = JSON.parse(readFileSync(join(ROOT, 'scripts/member-rename-map.json'), 'utf8'));

describe('a renamed member leaves nothing behind', () => {
  it('🔴 [Right] no old member name of an applied layer is left in an object key, an access, a destructuring or a type string', () => {
    const left = leftovers().map((l) => `${l.file}:${l.line} ${l.name} (${l.kind})`);
    expect(left, 'rename these by the table in scripts/member-rename-map.json — the engine reads the NEW name').toEqual([]);
  }, 60_000);

  it('⚠️ [Interface] every data-key exemption names a file that exists and still uses that name — an exemption cannot outlive its reason', () => {
    const stale = Object.keys(map.dataKeys ?? {}).filter((k) => {
      const [file, name] = k.split(' ');
      return !existsSync(join(ROOT, file)) || !new RegExp(`\\b${name}\\b`).test(readFileSync(join(ROOT, file), 'utf8'));
    });
    expect(stale).toEqual([]);
  });

  it('🔴 [Right] PHASE 7 IS DONE: every Portuguese member left in app/js is an EXCLUDED one, and each says why', () => {
    // The end state ADR-0230 set: «the language gate reports `membro` at the count of the excluded list and nothing
    // more». Held here as a SET and not a count — a new Portuguese member and a renamed excluded one would cancel out
    // in a number and stay visible in a set.
    const lists = readLists();
    const left = [];
    for (const f of source()) {
      const sf = ts.createSourceFile(f, readFileSync(join(ROOT, f), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      (function walk(n) {
        if (isMember(n) && n.name && ts.isIdentifier(n.name) && words(n.name.text).some((w) => lists.pt.has(w))) left.push(keyOf(n, f.replace('app/js/', '')));
        n.forEachChild(walk);
      })(sf);
    }
    expect(left.filter((k) => !map.excluded[k]), 'a Portuguese member outside the excluded list: name it in English').toEqual([]);
    expect(Object.keys(map.excluded).filter((k) => !left.includes(k)), 'an exclusion whose member is gone: remove it').toEqual([]);
    expect(Object.values(map.excluded).every((why) => typeof why === 'string' && why.length > 20)).toBe(true);
  });

  it('⚠️ [Interface] a stored shape is never both excluded and renamed', () => {
    const renamed = new Set(Object.values(map.layers).flatMap((l) => Object.keys(l)));
    expect(Object.keys(map.excluded).filter((k) => renamed.has(k))).toEqual([]);
  });
});
