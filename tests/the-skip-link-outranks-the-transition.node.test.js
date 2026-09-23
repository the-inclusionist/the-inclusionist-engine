// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EXIT IS NEVER BEHIND A CURTAIN (ADR-0102) — the skip link outranks everything a game can draw over the page.
//
// ========================= WHY THIS FILE EXISTS =========================
// 🔴 ADR-0102's proof used to be `tests/z-order-css.node.test.js`, which tied every `--z-*` variable to the `Z`
// table in `core/layers.ts`. That table was the platformer's world order, and it left with the tile world
// (ADR-0228) — and the gate went with it, deleted rather than moved, because half of what it checked was no
// longer the engine's. The half that IS the engine's stayed behind unguarded: the `:root` slots in
// `app/css/style.css` and the skip link that adopts one of them. Nothing failed when the gate died, which is
// exactly the silence ADR-0123 exists to break.
//
// 📌 What is held here is the ORDER, read from the stylesheet the engine ships, and nothing about the platformer:
//   1. the skip link sits on its slot, not on a literal;
//   2. its slot is above the transition slot and every other slot, except the two the record names as
//      correct to outrank it — the dead-loop notice (nothing left to skip to) and the debug panel;
//   3. no literal `z-index` in the stylesheet reaches it.
//
// MUTATIONS CHECKED are at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');
// Comments first: the stylesheet explains its own stacking in prose (`z-index:4` inside a sentence), and a
// sentence is not a declaration.
const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const slots = new Map(
  [...DECLARATIONS.matchAll(/--z-([a-z-]+)\s*:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
);
const literals = [...DECLARATIONS.matchAll(/z-index\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
const ALLOWED_ABOVE = new Set(['loop-crash', 'debug']);

describe('the skip link outranks the transition (ADR-0102)', () => {
  it('reads the slots and the literals it is about', () => {
    expect(slots.has('skip-link')).toBe(true);
    expect(slots.has('transition')).toBe(true);
    expect(literals.length).toBeGreaterThan(0);
  });

  it('the skip link adopts its slot instead of a number', () => {
    expect(DECLARATIONS).toMatch(/\.skip-link\s*\{[^}]*z-index\s*:\s*var\(--z-skip-link\)/);
  });

  it('its slot is above every other slot except the dead-loop notice and the debug panel', () => {
    const skip = slots.get('skip-link');
    expect(skip).toBeGreaterThan(slots.get('transition'));
    for (const [name, value] of slots) {
      if (name === 'skip-link') continue;
      if (ALLOWED_ABOVE.has(name)) expect(value, name).toBeGreaterThan(skip);
      else expect(value, name).toBeLessThan(skip);
    }
  });

  it('no literal z-index in the stylesheet reaches it', () => {
    const skip = slots.get('skip-link');
    for (const value of literals) expect(value).toBeLessThan(skip);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. `--z-skip-link` set to 39000 (below the transition) → the slot case fails.
// 2. `.skip-link` back to a literal `z-index:41000` → the adoption case fails; the order cases alone would
//    stay green, which is why it exists.
// 3. a literal `z-index:50000` anywhere in the stylesheet → the literal case fails.
// 4. `--z-debug` lowered to 30500 → the slot case fails: the record NAMES who may outrank the exit, and a
//    list of exceptions that stops being checked would let anyone join it.
