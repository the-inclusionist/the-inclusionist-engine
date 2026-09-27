// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FONTS TRAVEL WITH THEIR NOTICES AND LICENCES (scripts/licences/fonts.mjs) — the engine's faces and the library's.
//
// 📌 SIL OFL 1.1 §2, Apache-2.0 §4(a) and the Ubuntu Font Licence §1 attach to the COPY. The engine's own faces are copied into
// every install of the PWA and every npm package: `app/public/vendor/fonts-licences/` carries `NOTICE.txt` (each family, its files,
// its licence and its copyright line as the font states it) and the licence texts beside the `.woff2` files. The font library
// (ADR-0255) is copied into the mirror and into each delivery that carries a family: every library folder carries its licence text,
// `NOTICE.txt` and `SHA256SUMS`, and `inclusionist-heavy --fonts` writes the same two beside each family it delivers.
// 📏 The web subsets keep their copyright line but only one of 346 kept its licence text (measured 2026-09-27), so the texts
// cannot be left to the metadata.
//
// 📌 THE MIRROR IS READ WHERE IT IS ON THE MACHINE: `INCLUSIONIST_LFS`, else `the-inclusionist-lfs` beside the repository. Without
// it the cases that open the folders SKIP; the catalogue's own cases run everywhere.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  FONT_LICENCE_TEXTS, DECLARED_WITHOUT_METADATA, NOTICE_FILE, LIBRARY_FOLDER, fontEntries, currentNotice, readFontNames,
  licenceText, familyLicenceFiles, libraryFolder, sha256Sums, woff2Tables,
} from '../scripts/licences/fonts.mjs';

const ROOT = process.cwd();
const FONTS = join(ROOT, 'app', 'public', 'vendor', 'fonts');
const LICENCES = join(ROOT, 'app', 'public', 'vendor', 'fonts-licences');
const CSS = readFileSync(join(ROOT, 'app', 'public', 'vendor', 'fonts.css'), 'utf8');
const NOTICE = readFileSync(join(LICENCES, NOTICE_FILE), 'utf8');
const LIBRARY = JSON.parse(readFileSync(join(ROOT, 'app', 'js', 'platform', 'font-library.json'), 'utf8'));
const ORIGINALS = JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'reserved-name-originals.json'), 'utf8')).faces;
const LFS = process.env.INCLUSIONIST_LFS ?? join(ROOT, '..', 'the-inclusionist-lfs');
const HAS_LFS = existsSync(join(LFS, LIBRARY_FOLDER, 'SHA256SUMS'));
const readFont = (file) => readFileSync(join(FONTS, file));
const sha = (text) => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex');
const shaOf = (buf) => createHash('sha256').update(buf).digest('hex');

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

describe('the engine\'s faces carry their notices and licences', () => {
  it('🎯 [Vacuum] fonts.css and NOTICE.txt are read as what they are, not as empty', () => {
    expect(CSS_FAMILIES.length, 'fonts.css read as nearly empty — the gate would pass by checking nothing').toBeGreaterThanOrEqual(5);
    expect(Object.keys(NOTICE_ENTRIES).length, 'NOTICE.txt parsed as nearly empty').toBeGreaterThanOrEqual(5);
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

  it('📌 [Boundary] the engine\'s folder ships exactly the texts its notice names — no text for a family it no longer carries', () => {
    const used = [...new Set(Object.values(NOTICE_ENTRIES).map((e) => e.file))].sort();
    expect(readdirSync(LICENCES).filter((f) => f !== NOTICE_FILE).sort()).toEqual(used);
    for (const file of used) {
      const spdx = Object.keys(FONT_LICENCE_TEXTS).find((s) => FONT_LICENCE_TEXTS[s].file === file);
      expect(readFileSync(join(LICENCES, file), 'utf8'), `${file} is not the text scripts/licences keeps`).toBe(licenceText(spdx));
    }
  });

  it('🔴 [Right] a family with no licence in its files and none declared is REFUSED, and so is a licence with no text', () => {
    // A font whose `name` table has a copyright line and no licence field (IDs 13/14) — as Monoton's, Yatra One's and iA Writer
    // Quattro's did before they left the package (ADR-0251) — and nobody declared it.
    const orphan = "@font-face{font-family:'Nobody';src:url('fonts/nobody-400.woff2') format('woff2');}";
    const copyrightOnly = () => ({ 0: 'Copyright 2011 Nobody', 1: 'Nobody' });
    expect(() => fontEntries({ css: orphan, readFont, readNames: copyrightOnly, declared: {} }))
      .toThrow(/no licence stated in its files and none declared/);
    const ubuntu = "@font-face{font-family:'Ubuntu';src:url('fonts/ubuntu-400.woff2') format('woff2');}";
    const ubuntuNames = () => ({ 0: 'Copyright 2011 Canonical Ltd.  Licensed under the Ubuntu Font Licence 1.0', 1: 'Ubuntu' });
    const { 'Ubuntu-font-1.0': _dropped, ...withoutUfl } = FONT_LICENCE_TEXTS;
    expect(() => fontEntries({ css: ubuntu, readFont, readNames: ubuntuNames, declared: {}, texts: withoutUfl })).toThrow(/no licence text shipped/);
  });

  it('📌 [Boundary] a hand declaration is refused when the font states a licence, and when no family uses it', () => {
    const lexend = "@font-face{font-family:'Lexend';src:url('fonts/lexend-400.woff2') format('woff2');}";
    expect(() => fontEntries({ css: lexend, readFont, declared: { Lexend: { spdx: 'OFL-1.1', evidence: 'x' } } }))
      .toThrow(/declared by hand although its font states/);
    expect(() => fontEntries({ css: lexend, readFont, declared: { Ghost: { spdx: 'OFL-1.1', evidence: 'x' } } }))
      .toThrow(/declared without metadata but not in fonts.css: Ghost/);
    for (const family of Object.keys(DECLARED_WITHOUT_METADATA)) expect(CSS_FAMILIES).toContain(family);
  });

  it('🔴 [Right] the kept texts are the bytes they were copied from, and say what they are', () => {
    for (const [spdx, t] of Object.entries(FONT_LICENCE_TEXTS)) {
      const text = licenceText(spdx);
      expect(sha(text), `${t.file} no longer matches ${t.from}`).toBe(t.sha256);
      for (const m of MARKERS[spdx]) expect(text, `${t.file} lacks «${m}»`).toContain(m);
    }
    expect(licenceText('Apache-2.0')).toBe(readFileSync(join(ROOT, 'scripts', 'licences', 'Apache-2.0.txt'), 'utf8'));
  });

  it('📌 [Boundary] the notice is never frozen at the edge: its folder revalidates, and the year-long `/vendor/fonts/*` is not its folder', () => {
    const headers = readFileSync(join(ROOT, 'app', 'public', '_headers'), 'utf8');
    const rule = headers.match(/^\/vendor\/fonts-licences\/\*\r?\n\s+Cache-Control:\s*([^\r\n]+)/m)?.[1] ?? '';
    expect(rule, 'the licence folder has no cache rule of its own').toMatch(/no-cache/);
    expect(rule).not.toMatch(/immutable/);
    expect(existsSync(join(FONTS, NOTICE_FILE)), 'the notice sits under /vendor/fonts/*, cached a year as immutable').toBe(false);
  });

  it('📌 [Boundary] the texts reach every copy: the precache takes `.txt`, and the package ships `app/public/vendor` and `scripts/licences`', () => {
    const globs = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8').match(/globPatterns:\s*\[([^\]]*)\]/)?.[1] ?? '';
    expect(globs, 'the precache would leave the licence texts out of every install').toMatch(/[{,]txt[,}]/);
    const files = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).files;
    expect(files).toContain('app/public/vendor');
    expect(files, 'a delivery built from the package would have no licence text to write beside a library family').toContain('scripts/licences');
  });
});

describe('the font library: every family with its licence (ADR-0255)', () => {
  const families = Object.entries(LIBRARY.families);

  it('🔴 [Right] the catalogue names a licence for EVERY library family, and a text for each licence is kept', () => {
    expect(families.length, 'the library was not read').toBeGreaterThan(150);
    const without = families.filter(([, e]) => !FONT_LICENCE_TEXTS[e.licence]).map(([f, e]) => `${f}: ${e.licence}`);
    expect(without, 'a library family whose licence nobody can write beside it').toEqual([]);
  });

  it('🔴 [Right] the three families outside the OFL are under the licence their fonts state, not the catalogue\'s «OFL 1.1»', () => {
    expect(LIBRARY.families['Luckiest Guy'].licence).toBe('Apache-2.0');
    expect(LIBRARY.families.Smokum.licence).toBe('Apache-2.0');
    expect(LIBRARY.families.Ubuntu.licence).toBe('Ubuntu-font-1.0');
    const counts = families.reduce((n, [, e]) => ({ ...n, [e.licence]: (n[e.licence] ?? 0) + 1 }), {});
    expect(counts).toEqual({ 'OFL-1.1': families.length - 3, 'Apache-2.0': 2, 'Ubuntu-font-1.0': 1 });
  });

  it('🔴 [Right] a family whose fonts state another licence than the catalogue records is refused', () => {
    const lexend = { licence: 'Apache-2.0', faces: [{ file: 'lexend-400.woff2' }] };
    expect(() => familyLicenceFiles('Lexend', lexend, readFont)).toThrow(/its fonts state OFL-1.1, the catalogue records Apache-2.0/);
    const right = familyLicenceFiles('Lexend', { licence: 'OFL-1.1', faces: [{ file: 'lexend-400.woff2' }] }, readFont);
    expect(Object.keys(right).sort()).toEqual([NOTICE_FILE, 'OFL-1.1.txt']);
    expect(right[NOTICE_FILE]).toContain('Copyright 2019 The Lexend Project Authors');
  });

  it('🔴 [Right] every reserved-name family is its author\'s original — no subset, no range, a source named (ADR-0254)', () => {
    const originals = families.filter(([, e]) => e.faces.some((f) => f.from));
    expect(originals.length, 'the reserved-name families lost their originals').toBe(22);
    for (const [family, e] of originals) {
      for (const f of e.faces) {
        expect(f.from, `${family} ${f.file}: a face with no original`).toBeTruthy();
        expect(f.range, `${family} ${f.file}: an original is never cut by unicode-range`).toBeUndefined();
        expect(ORIGINALS[`${e.folder}/${f.file}`], `${family} ${f.file}: no table hashes of its original`).toBeTruthy();
      }
    }
  });

  describe.skipIf(!HAS_LFS)(`the library's folders in the mirror (${LFS})`, () => {
    const root = join(LFS, LIBRARY_FOLDER);

    it('🔴 [Right] EVERY folder has its licence text, a NOTICE.txt as the writer makes it, and a SHA256SUMS that matches it', () => {
      const wrong = [];
      for (const [family, e] of families) {
        const dir = join(root, e.folder);
        if (!existsSync(dir)) { wrong.push(`${family}: no folder ${e.folder}`); continue; }
        const owed = libraryFolder(family, e, dir); // throws on a font whose bytes are not the pinned ones
        for (const [name, body] of Object.entries(owed)) {
          const onDisk = existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null;
          if (onDisk !== String(body)) wrong.push(`${family}: ${name} is not what scripts/licences/fonts.mjs --library writes`);
        }
      }
      expect(wrong).toEqual([]);
    });

    it('🔴 [Right] the mirror\'s own SHA256SUMS covers every file of the library, and nothing else', () => {
      const files = {};
      const walk = (d, prefix) => {
        for (const n of readdirSync(d)) {
          const p = join(d, n);
          if (statSync(p).isDirectory()) walk(p, `${prefix}${n}/`);
          else if (`${prefix}${n}` !== 'SHA256SUMS') files[`${prefix}${n}`] = readFileSync(p);
        }
      };
      walk(root, '');
      expect(readFileSync(join(root, 'SHA256SUMS'), 'utf8'), 'fonts/SHA256SUMS is stale: run `node scripts/licences/fonts.mjs --library <lfs>`')
        .toBe(sha256Sums(files));
      expect(readdirSync(root).filter((n) => statSync(join(root, n)).isDirectory()).sort(), 'a folder the catalogue does not hold, or the reverse')
        .toEqual(families.map(([, e]) => e.folder).sort());
    });

    it('🔴 [Right] each reserved-name face, decompressed, has every table of its author\'s original, byte for byte (ADR-0254)', () => {
      const differ = [];
      for (const [key, o] of Object.entries(ORIGINALS)) {
        const buf = readFileSync(join(root, key));
        if (o.sha256) { if (shaOf(buf) !== o.sha256) differ.push(`${key}: not the author's file`); continue; }
        const tables = woff2Tables(buf);
        if (tables.some((t) => t.transformed)) { differ.push(`${key}: written with a table transform`); continue; }
        const got = Object.fromEntries(tables.map(({ tag, data }) => {
          const d = Buffer.from(data);
          // the whole-file checksum WOFF2 recomputes; flags bit 11 is NOT set here — the fixture has it set, so a file without it
          // (which the WOFF2 specification §5.1 requires) differs
          if (tag === 'head') d.fill(0, 8, 12);
          return [tag, shaOf(d)];
        }));
        if (JSON.stringify(Object.keys(got).sort()) !== JSON.stringify(Object.keys(o.tables).sort())) differ.push(`${key}: other tables`);
        for (const [tag, h] of Object.entries(o.tables)) if (got[tag] !== h) differ.push(`${key}: table ${tag} differs from ${o.from}`);
      }
      expect(Object.keys(ORIGINALS).length).toBe(24);
      expect(differ).toEqual([]);
    });

    it('📌 [Boundary] the OFL text kept here is the body OpenDyslexic\'s own licence field carries — an independent witness', () => {
      const od = LIBRARY.families.OpenDyslexic;
      const inFont = readFontNames(readFileSync(join(root, od.folder, od.faces[0].file)))[13].replaceAll('\r\n', '\n');
      expect(inFont.endsWith(licenceText('OFL-1.1')), 'OFL-1.1.txt is not the OFL body OpenDyslexic carries').toBe(true);
    });
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   F1 one family's block deleted from NOTICE.txt (Lexend)                🔴 every family has an entry · NOTICE.txt is what the fonts say
//   F2 (before ADR-0251) Monoton's hand declaration deleted              🔴 NOTICE.txt is what the fonts say (the build refuses it)
//   F3 the «no licence stated and none declared» refusal removed           🔴 a family with no licence is REFUSED
//   F4 the «no licence text shipped» refusal removed                        🔴 a family with no licence is REFUSED
//   F5 one character of OFL-1.1.txt changed                                 🔴 the kept texts are the bytes they were copied from
//   F6 `txt` removed from the precache globPatterns                        🔴 the texts reach every copy
//   F7 the Apache URL dropped from the recognised licence URLs             🔴 NOTICE.txt is what the fonts say (unknown URL refused)
//   F8 the «declared by hand although its font states» refusal removed     🔴 a hand declaration is refused
//   F9 (2026-09-27) the `/vendor/fonts-licences/*` rule removed from `_headers`   🔴 the notice is never frozen at the edge
// (2026-09-27, ADR-0255; each applied by script, the anchor counted, and restored by sha256 — the mirror's files renamed aside and back)
//   G1 the library notice stops naming its licence file                    🔴 EVERY folder … a NOTICE.txt as the writer makes it
//   G2 Smokum recorded under a licence with no text kept (GPL-3.0)         🔴 a licence for EVERY family · the three outside the OFL · EVERY folder
//   G3 the originals' comparison stops zeroing the checksum WOFF2 recomputes 🔴 each reserved-name face … every table of its original
//   F1 `fonts/lato/OFL-1.1.txt` taken out of the mirror                     🔴 EVERY folder · the mirror's own SHA256SUMS
//   F2 Lato's original in the mirror replaced by the web subset packaged before 🔴 EVERY folder (sha256) · SHA256SUMS · every table of its original
// (⚠️ A first G3 — flags bit 11 left alone on the mirror's side — SURVIVED: WOFF2 always sets it, so that half was inert and left.)
