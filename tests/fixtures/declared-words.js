// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/declared-words — a case's WORDS, turned into what a game declares since ADR-0232 D3 (erratum of 2026-09-25):
// KEYS of its own dictionary, and the dictionary they live in.
//
// A case that measures something ELSE than the language writes its game's words as words — «Pular», «Dicas» — and asserts
// them on screen. `keyed` turns every declared word into a key and puts the word under that key in pt, en and es (the same
// word in the three, because the case measures the surface, not the translation), so the case keeps reading as it did and
// the boot has the dictionaries that resolve the keys. A case that measures the LANGUAGE writes its keys and dictionaries
// by hand.
//
// What it turns: `label`/`short`/`hint` text → `labelKey`/`shortKey`/`hintKey` (a preset's positions, an accommodation's
// answer, a game-option row and its positions); a slide's `text` function → `textKey`; a HUD number's `name` Speakable →
// `nameKey`. Everything else is copied as it is.

const RENAMED = { label: 'labelKey', short: 'shortKey', hint: 'hintKey' };

/**
 * `{ ...declared, dictionaries }`: spread it into `createGame`'s options or a `mount()`'s hooks. The dictionaries of several
 * calls do not collide — each call numbers its keys from a prefix of its own.
 */
export function keyed(declared, prefix = `w${keyed.calls = (keyed.calls ?? 0) + 1}`) {
  const words = {};
  let n = 0;
  const keyOf = (word) => { const key = `${prefix}.${n += 1}`; words[key] = word; return key; };
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [field, v] of Object.entries(value)) {
      if (Object.hasOwn(RENAMED, field) && typeof v === 'string') out[RENAMED[field]] = keyOf(v);
      else if (field === 'text' && typeof v === 'function') out.textKey = keyOf(v());
      else if (field === 'name' && v && typeof v === 'object' && typeof v.text === 'string') out.nameKey = keyOf(v.text);
      else out[field] = typeof v === 'function' ? v : walk(v);
    }
    return out;
  };
  const converted = walk(declared);
  return { ...converted, dictionaries: { pt: { ...words }, en: { ...words }, es: { ...words } } };
}
