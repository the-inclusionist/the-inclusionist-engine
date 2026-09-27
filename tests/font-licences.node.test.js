// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FONTS TRAVEL WITH THEIR NOTICES AND LICENCES (scripts/licences/fonts.mjs).
//
// 📌 SIL OFL 1.1 §2, Apache-2.0 §4(a) and the Ubuntu Font Licence §1 attach to the COPY, and every install of the PWA and every
// copy of the npm package is one: `app/public/vendor/fonts-licences/` carries `NOTICE.txt` (each family, its files, its licence and its
// copyright line as the font states it) and the licence texts beside the 346 `.woff2`. 📏 The web subsets keep their copyright
// line but only one of 346 keeps its licence text (measured 2026-09-27), so the texts cannot be left to the metadata.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  FONT_LICENCE_TEXTS, DECLARED_WITHOUT_METADATA, NOTICE_FILE, fontEntries, currentNotice, readFontNames,
} from '../scripts/licences/fonts.mjs';

const ROOT = process.cwd();
const FONTS = join(ROOT, 'app', 'public', 'vendor', 'fonts');
const LICENCES = join(ROOT, 'app', 'public', 'vendor', 'fonts-licences');
const CSS = readFileSync(join(ROOT, 'app', 'public', 'vendor', 'fonts.css'), 'utf8');
const NOTICE = readFileSync(join(LICENCES, NOTICE_FILE), 'utf8');
const readFont = (file) => readFileSync(join(FONTS, file));
const sha = (text) => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');

// The families, read here with a regex of this file's own — not the module's parser, which the gate is checking.
const CSS_FAMILIES = [...new Set([...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
/** NOTICE.txt as entries: `{ family: { licence: '…', file: 'OFL-1.1.txt' } }`. */
const NOTICE_ENTRIES = Object.fromEntries(NOTICE.split(/^-{79}$/m).slice(1).map((block) => {
  const family = block.match(/^Family: {4}(.+)$/m)?.[1];
  const licence = block.match(/^Licence: {3}.+ \(([^)]+)\), see (\S+)$/m);
  return [family, { spdx: licence?.[1], file: licence?.[2] }];
}));

// The licence each text must be, by words of the text itself — not through the table that names the file.
const MARKERS = {
  'OFL-1.1': ['SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007', 'contains the above copyright notice and this license',
    'OTHER DEALINGS IN THE FONT SOFTWARE.'],
  'Apache-2.0': ['Apache License', 'Version 2.0, January 2004', 'END OF TERMS AND CONDITIONS'],
  'Ubuntu-font-1.0': ['UBUNTU FONT LICENCE Version 1.0', 'Each copy of the Font Software must contain the above copyright',
    'DEALINGS IN THE FONT SOFTWARE.'],
};

describe('the fonts carry their notices and licences', () => {
  it('🎯 [Vacuum] fonts.css and NOTICE.txt are read as what they are, not as empty', () => {
    expect(CSS_FAMILIES.length, 'fonts.css read as nearly empty — the gate would pass by checking nothing').toBeGreaterThan(200);
    expect(Object.keys(NOTICE_ENTRIES).length, 'NOTICE.txt parsed as nearly empty').toBeGreaterThan(200);
    const woff2 = readdirSync(FONTS).filter((f) => f.endsWith('.woff2'));
    expect(NOTICE.match(/^Files: {5}(.+)$/gm).join(',').split(',').length, 'NOTICE.txt does not cover every file').toBe(woff2.length);
  });

  it('🔴 [Right] every family fonts.css declares has an entry in NOTICE.txt, under a licence whose text ships beside it', () => {
    const missing = CSS_FAMILIES.filter((f) => !NOTICE_ENTRIES[f]);
    expect(missing, `families with no notice: run \`node scripts/licences/fonts.mjs\``).toEqual([]);
    expect(Object.keys(NOTICE_ENTRIES).filter((f) => !CSS_FAMILIES.includes(f)), 'a notice for a family fonts.css no longer has').toEqual([]);
    const bad = Object.entries(NOTICE_ENTRIES).filter(([, e]) => !e.spdx || !FONT_LICENCE_TEXTS[e.spdx]
      || FONT_LICENCE_TEXTS[e.spdx].file !== e.file || !existsSync(join(LICENCES, e.file)));
    expect(bad.map(([f, e]) => `${f}: ${e.spdx} / ${e.file}`)).toEqual([]);
  });

  it('🔴 [Right] NOTICE.txt is what the fonts say today: each copyright line as its own name table states it', () => {
    expect(NOTICE === currentNotice(), 'NOTICE.txt is stale: run `node scripts/licences/fonts.mjs`').toBe(true);
    // one literal from the font, so the comparison above cannot be two readings of the same wrong table
    expect(NOTICE).toContain('    Copyright 2020 Braille Institute of America, Inc.');
  });

  it('🔴 [Right] the three families outside the OFL are under the licence their fonts state, not the catalogue\'s «OFL 1.1»', () => {
    expect(NOTICE_ENTRIES['Luckiest Guy']).toEqual({ spdx: 'Apache-2.0', file: 'Apache-2.0.txt' });
    expect(NOTICE_ENTRIES.Smokum).toEqual({ spdx: 'Apache-2.0', file: 'Apache-2.0.txt' });
    expect(NOTICE_ENTRIES.Ubuntu).toEqual({ spdx: 'Ubuntu-font-1.0', file: 'UFL-1.0.txt' });
    const counts = Object.values(NOTICE_ENTRIES).reduce((n, e) => ({ ...n, [e.spdx]: (n[e.spdx] ?? 0) + 1 }), {});
    expect(counts).toEqual({ 'OFL-1.1': CSS_FAMILIES.length - 3, 'Apache-2.0': 2, 'Ubuntu-font-1.0': 1 });
  });

  it('🔴 [Right] a family with no licence in its files and none declared is REFUSED, and so is a licence with no text', () => {
    // Monoton's files carry no licence field: under another name, nobody declared it.
    const orphan = "@font-face{font-family:'Nobody';src:url('fonts/cat-monoton-400.woff2') format('woff2');}";
    expect(() => fontEntries({ css: orphan, readFont, declared: {} })).toThrow(/no licence stated in its files and none declared/);
    const ubuntu = "@font-face{font-family:'Ubuntu';src:url('fonts/ubuntu-400.woff2') format('woff2');}";
    const { 'Ubuntu-font-1.0': _dropped, ...withoutUfl } = FONT_LICENCE_TEXTS;
    expect(() => fontEntries({ css: ubuntu, readFont, declared: {}, texts: withoutUfl })).toThrow(/no licence text shipped/);
  });

  it('📌 [Boundary] a hand declaration is refused when the font states a licence, and when no family uses it', () => {
    const lexend = "@font-face{font-family:'Lexend';src:url('fonts/lexend-400.woff2') format('woff2');}";
    expect(() => fontEntries({ css: lexend, readFont, declared: { Lexend: { spdx: 'OFL-1.1', evidence: 'x' } } }))
      .toThrow(/declared by hand although its font states/);
    expect(() => fontEntries({ css: lexend, readFont, declared: { Ghost: { spdx: 'OFL-1.1', evidence: 'x' } } }))
      .toThrow(/declared without metadata but not in fonts.css: Ghost/);
    for (const family of Object.keys(DECLARED_WITHOUT_METADATA)) expect(CSS_FAMILIES).toContain(family);
  });

  it('🔴 [Right] the shipped texts are the bytes they were copied from, and say what they are', () => {
    for (const [spdx, t] of Object.entries(FONT_LICENCE_TEXTS)) {
      const text = readFileSync(join(LICENCES, t.file), 'utf8');
      expect(sha(text), `${t.file} no longer matches ${t.from}`).toBe(t.sha256);
      for (const m of MARKERS[spdx]) expect(text, `${t.file} lacks «${m}»`).toContain(m);
    }
    // two independent witnesses: the OFL body inside a font of this directory, and the heavy files' Apache text
    const inFont = readFontNames(readFont('opendyslexic-400.woff2'))[13].replaceAll('\r\n', '\n');
    const ofl = readFileSync(join(LICENCES, 'OFL-1.1.txt'), 'utf8');
    expect(inFont.endsWith(ofl), 'OFL-1.1.txt is not the OFL body OpenDyslexic carries').toBe(true);
    expect(readFileSync(join(LICENCES, 'Apache-2.0.txt'), 'utf8')).toBe(readFileSync(join(ROOT, 'scripts', 'licences', 'Apache-2.0.txt'), 'utf8'));
  });

  it('📌 [Boundary] the notice is never frozen at the edge: its folder revalidates, and the year-long `/vendor/fonts/*` is not its folder', () => {
    const headers = readFileSync(join(ROOT, 'app', 'public', '_headers'), 'utf8');
    const rule = headers.match(/^\/vendor\/fonts-licences\/\*\r?\n\s+Cache-Control:\s*([^\r\n]+)/m)?.[1] ?? '';
    expect(rule, 'the licence folder has no cache rule of its own').toMatch(/no-cache/);
    expect(rule).not.toMatch(/immutable/);
    expect(existsSync(join(FONTS, NOTICE_FILE)), 'the notice sits under /vendor/fonts/*, cached a year as immutable').toBe(false);
  });

  it('📌 [Boundary] the texts reach every copy: the precache takes `.txt`, and the package ships `app/public/vendor`', () => {
    const globs = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8').match(/globPatterns:\s*\[([^\]]*)\]/)?.[1] ?? '';
    expect(globs, 'the precache would leave the licence texts out of every install').toMatch(/[{,]txt[,}]/);
    expect(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).files).toContain('app/public/vendor');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   F1 one family's block deleted from NOTICE.txt (Lexend)                🔴 every family has an entry · NOTICE.txt is what the fonts say
//   F2 Monoton's hand declaration deleted                                  🔴 NOTICE.txt is what the fonts say (the build refuses it)
//   F3 the «no licence stated and none declared» refusal removed           🔴 a family with no licence is REFUSED
//   F4 the «no licence text shipped» refusal removed                        🔴 a family with no licence is REFUSED
//   F5 one character of OFL-1.1.txt changed                                 🔴 the shipped texts are the bytes they were copied from
//   F6 `txt` removed from the precache globPatterns                        🔴 the texts reach every copy
//   F7 the Apache URL dropped from the recognised licence URLs             🔴 NOTICE.txt is what the fonts say (unknown URL refused)
//   F8 the «declared by hand although its font states» refusal removed     🔴 a hand declaration is refused
//   F9 (2026-09-27) the `/vendor/fonts-licences/*` rule removed from `_headers`   🔴 the notice is never frozen at the edge
