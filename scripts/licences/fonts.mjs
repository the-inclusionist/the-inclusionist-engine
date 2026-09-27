// SPDX-License-Identifier: AGPL-3.0-or-later
//
// WHAT THE ENGINE OWES THE PEOPLE WHOSE FONTS IT CARRIES (the fonts' twin of `third-party.mjs`).
//
// Two homes, one set of readers (ADR-0255):
// · THE ENGINE'S OWN FACES — every family `app/public/vendor/fonts.css` declares: the typography button's cycle and the
//   mathematics face. The PWA precaches them into each install and the npm package ships `app/public/vendor`, so every copy is a
//   redistribution. `app/public/vendor/fonts-licences/`, beside `fonts/`, carries `NOTICE.txt` and the licence texts they use.
// · THE FONT LIBRARY — every other family, one folder per family in `the-inclusionist-lfs/fonts/`, catalogued (files, sha256,
//   weights, licence) in `app/js/platform/font-library.json`. Each folder carries its licence text, a `NOTICE.txt` and a
//   `SHA256SUMS`; `inclusionist-heavy --fonts` writes the same licence text and notice beside each family it delivers.
//
// SIL OFL 1.1 §2 lets a font travel «provided that each copy contains the above copyright notice and this license», as a
// stand-alone text file or as metadata «easily viewed by the user»; Apache-2.0 §4(a) asks for the licence text; the Ubuntu Font
// Licence 1.0 §1 asks for the notice and the licence as the OFL does. So each notice names every family, its files, its licence
// and its copyright line AS THE FONT ITSELF STATES IT (name ID 0 of its `name` table).
//
// 📏 MEASURED 2026-09-27 on the 346 files then packaged: every one kept its copyright line (name ID 0); only OpenDyslexic kept its
// licence description (name ID 13); 331 kept a licence URL (name ID 14). The web subsets strip the licence text, which is why the
// text has to travel as a file. Three families are NOT under the OFL — Luckiest Guy and Smokum (Apache-2.0) and Ubuntu (Ubuntu
// Font Licence 1.0) — although the typographic catalogue records «OFL 1.1» for all three.
//
// 📌 THE LICENCE IS READ FROM THE FONT, never from a list kept by hand: its URL (ID 14), its licence description (ID 13) and the
// words of its copyright line (ID 0). Where these disagree the family is refused; where the font says nothing, the family must be
// DECLARED below with the evidence, or it is refused too. `tests/font-licences.node.test.js` holds the committed `NOTICE.txt`
// equal to what this module builds, and the library's folders equal to what it writes.
//
// Use:
//   `node scripts/licences/fonts.mjs` rewrites `app/public/vendor/fonts-licences/NOTICE.txt` from `fonts.css` and the fonts.
//   `node scripts/licences/fonts.mjs --library <the-inclusionist-lfs>` rewrites, in every family folder of `<lfs>/fonts/`, the
//   licence text, `NOTICE.txt` and `SHA256SUMS`, and `<lfs>/fonts/SHA256SUMS` — refusing a font whose bytes are not the ones the
//   catalogue pins, and a family whose licence nobody can name.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LICENCE_TEXTS } from './third-party.mjs';

export const VENDOR = fileURLToPath(new URL('../../app/public/vendor/', import.meta.url));
export const FONTS_DIR = fileURLToPath(new URL('../../app/public/vendor/fonts/', import.meta.url));
export const NOTICE_FILE = 'NOTICE.txt';
/** Where the notice and the licence texts ship: beside `fonts/`, not in it — /vendor/fonts/* is cached for a year as immutable,
 * and the notice changes whenever a family does (_headers gives this folder a rule that revalidates). */
export const LICENCES_DIR = fileURLToPath(new URL('../../app/public/vendor/fonts-licences/', import.meta.url));
/** The library's catalogue in the repository; the package carries the compiled copy at `dist-pkg/platform/font-library.json`. */
export const LIBRARY_CATALOGUE = fileURLToPath(new URL('../../app/js/platform/font-library.json', import.meta.url));
/** The folder of `the-inclusionist-lfs` the library lives in, one sub-folder per family. */
export const LIBRARY_FOLDER = 'fonts';

/**
 * The licence texts, each kept HERE beside this module (the npm package ships `scripts/licences`, so a school's build machine has
 * them) and pinned (sha256 of the copy, CRLF read as LF). The engine's faces ship the ones they use in `fonts-licences/`; every
 * library folder and every delivered family gets its own.
 * · OFL-1.1: the licence body — from the «SIL OPEN FONT LICENSE Version 1.1» banner to the end — of the licence field (name ID
 *   13) of OpenDyslexic's `OpenDyslexic-Regular.woff2` (antijingoist/opendyslexic, now in the library). Byte-identical to the
 *   same body in three other local copies of upstream `OFL.txt` files (game-chess: Pecita, STIX Two Math, Noto Sans Symbols 2),
 *   and to a fourth (game-pinball's Press Start 2P) but for the final newline.
 * · Apache-2.0: `scripts/licences/Apache-2.0.txt`, the same file and the same pin as the heavy files'.
 * · Ubuntu-font-1.0: the `License: Ubuntu-Font-Licence-1.0` paragraph of the Debian package `fonts-ubuntu`'s
 *   `/usr/share/doc/fonts-ubuntu/copyright` (sha256 bca346a5…8ef8cf, the same in three WSL installs, packages 0.83-6ubuntu1 and
 *   0.869+git20240321-0ubuntu1), decoded as the Debian copyright format writes it: one leading space removed from each line, a
 *   line holding only « .» read as an empty line. ✅ VERIFIED 2026-09-27 byte for byte (same sha256) against
 *   `google/fonts` `ufl/ubuntu/UFL.txt`, the licence that travels with the very files the library carries.
 */
export const FONT_LICENCE_TEXTS = Object.freeze({
  'OFL-1.1': { file: 'OFL-1.1.txt', name: 'SIL Open Font License, Version 1.1',
    sha256: 'f05e84c3000faf09cf8e445d35018b01fc0d6026953840e9398aeab501b86da2',
    from: 'OpenDyslexic-Regular.woff2 (antijingoist/opendyslexic), name ID 13, from the «SIL OPEN FONT LICENSE Version 1.1» banner' },
  'Apache-2.0': { file: 'Apache-2.0.txt', name: 'Apache License, Version 2.0',
    sha256: LICENCE_TEXTS['Apache-2.0'].sha256,
    from: 'scripts/licences/Apache-2.0.txt' },
  'Ubuntu-font-1.0': { file: 'UFL-1.0.txt', name: 'Ubuntu Font Licence, Version 1.0',
    sha256: '2f0015108d68627bd788d313f529c21ff4da2c2c42a5e1f3883acc83480f9002',
    from: 'Debian package fonts-ubuntu, /usr/share/doc/fonts-ubuntu/copyright, the Ubuntu-Font-Licence-1.0 paragraph' },
});

/** A licence text as this module keeps it (beside it, in `scripts/licences/`). */
export function licenceText(spdx, texts = FONT_LICENCE_TEXTS) {
  return readFileSync(new URL(texts[spdx].file, import.meta.url), 'utf8');
}

/**
 * Families whose files carry NO licence in their metadata, with the evidence the project holds instead. A family listed here
 * whose font later names a licence is refused (the entry would be a second, older truth), and so is an entry no family uses.
 */
export const DECLARED_WITHOUT_METADATA = Object.freeze({
  // none: the three faces that carried no licence in their files left the package (ADR-0251)
});

// ===================== READING A WOFF2's `name` TABLE =====================

// WOFF2's known-table index (the spec's table, in order); a flag of 63 means the tag follows as four bytes.
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function uintBase128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.p++];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error('woff2: UIntBase128 longer than five bytes');
}

/**
 * The tables of a WOFF2 file, decompressed: `[{ tag, transformed, data }]` in the file's order. A table written with a WOFF2
 * transform (glyf/loca by default, hmtx optionally) is returned as the transformed stream and flagged, never reconstructed.
 */
export function woff2Tables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  if (buf.toString('latin1', 4, 8) === 'ttcf') throw new Error('woff2: font collections are not read here');
  const numTables = buf.readUInt16BE(12);
  const compressedLength = buf.readUInt32BE(20);
  const at = { p: 48 };
  const directory = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at.p++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', at.p, at.p + 4); at.p += 4; }
    const version = flags >> 6;
    let length = uintBase128(buf, at);
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    if (transformed) length = uintBase128(buf, at);
    directory.push({ tag, transformed, length });
  }
  const stream = brotliDecompressSync(buf.subarray(at.p, at.p + compressedLength));
  let offset = 0;
  return directory.map(({ tag, transformed, length }) => {
    const data = stream.subarray(offset, offset + length);
    offset += length;
    return { tag, transformed, data };
  });
}

/**
 * Name IDs 0 (copyright), 1 (family), 13 (licence description) and 14 (licence URL) of a WOFF2 file, English (Windows) record
 * preferred. The `name` table is never transformed in WOFF2, so the table directory and the Brotli stream are enough.
 */
export function readFontNames(buf) {
  const table = woff2Tables(buf).find((t) => t.tag === 'name')?.data;
  if (!table) throw new Error('woff2: no name table');
  const count = table.readUInt16BE(2);
  const strings = table.readUInt16BE(4);
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = table.readUInt16BE(r);
    const language = table.readUInt16BE(r + 4);
    const id = table.readUInt16BE(r + 6);
    if (![0, 1, 13, 14].includes(id)) continue;
    const start = strings + table.readUInt16BE(r + 10);
    const raw = table.subarray(start, start + table.readUInt16BE(r + 8));
    const text = platform === 1 ? raw.toString('latin1') : Buffer.from(raw).swap16().toString('utf16le');
    if (!(id in out) || (platform === 3 && language === 0x409)) out[id] = text;
  }
  return out;
}

// ===================== WHICH LICENCE A FONT STATES =====================

/** Each signal a font can give, and the licence it names. A URL outside this list is refused, not guessed. */
const LICENCE_URLS = [
  [/^https?:\/\/scripts\.sil\.org\/OFL\/?$/i, 'OFL-1.1'],
  [/^https?:\/\/(www\.)?openfontlicense\.org\/?$/i, 'OFL-1.1'],
  [/^https?:\/\/www\.apache\.org\/licenses\/LICENSE-2\.0(\.html)?$/i, 'Apache-2.0'],
];
const LICENCE_WORDS = [
  [/SIL Open ?Font License,? (Version )?1\.1/i, 'OFL-1.1'],
  [/Apache 2\.0 licen[cs]e/i, 'Apache-2.0'],
  [/Ubuntu Font Licence 1\.0/i, 'Ubuntu-font-1.0'],
];

/** The licences a font's own metadata names, with where each was read: `[{ spdx, source }]`, possibly empty. */
export function licencesStated(names) {
  const found = [];
  const url = (names[14] || '').trim();
  if (url) {
    const hit = LICENCE_URLS.find(([re]) => re.test(url));
    if (!hit) throw new Error(`licence URL «${url}» is not one this module knows — register it, do not guess`);
    found.push({ spdx: hit[1], source: `licence URL (name ID 14): ${url}` });
  }
  for (const [id, label] of [[13, 'licence description (name ID 13)'], [0, 'copyright notice (name ID 0)']]) {
    const hit = LICENCE_WORDS.find(([re]) => re.test(names[id] || ''));
    if (hit) found.push({ spdx: hit[1], source: label });
  }
  return found;
}

// ===================== THE FAMILIES `fonts.css` DECLARES =====================

/** `[{ family, files: [...] }]` in the order `fonts.css` first declares each family; comments are not read. */
export function familiesOf(css) {
  const families = new Map();
  for (const [, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = body.match(/font-family:\s*'([^']+)'/)?.[1];
    if (!family) throw new Error(`an @font-face with no quoted font-family: ${body.slice(0, 80)}`);
    if (!families.has(family)) families.set(family, []);
    for (const [, file] of body.matchAll(/url\('fonts\/([^']+)'\)/g)) {
      if (!families.get(family).includes(file)) families.get(family).push(file);
    }
  }
  return [...families].map(([family, files]) => ({ family, files }));
}

/**
 * One entry per family: its files, its licence, where the licence was read, and its copyright line(s). THROWS — the refusal —
 * for a family with no licence stated or declared, with two licences, with a licence no shipped text covers, with files that
 * disagree about their copyright, or declared although its font now states a licence.
 */
function entryOf({ family, files }, { readNames, declared, texts }) {
  const perFile = files.map((file) => ({ file, names: readNames(file, family) }));
  const stated = perFile.flatMap(({ names }) => licencesStated(names));
  const spdxStated = [...new Set(stated.map((s) => s.spdx))];
  if (spdxStated.length > 1) throw new Error(`«${family}»: its files state more than one licence (${spdxStated.join(', ')})`);
  if (spdxStated.length && declared[family]) {
    throw new Error(`«${family}» is declared by hand although its font states ${spdxStated[0]} — delete the declaration`);
  }
  const spdx = spdxStated[0] ?? declared[family]?.spdx;
  if (!spdx) throw new Error(`«${family}»: no licence stated in its files and none declared — refused`);
  if (!texts[spdx]) throw new Error(`«${family}»: ${spdx} has no licence text shipped beside the fonts — refused`);
  const copyrights = [...new Set(perFile.map(({ names }) => (names[0] || '').trim()))];
  if (copyrights.length !== 1 || !copyrights[0]) {
    throw new Error(`«${family}»: its files do not carry one copyright line (${copyrights.length} different)`);
  }
  const sources = spdxStated.length ? [...new Set(stated.map((s) => s.source))] : [declared[family].evidence];
  // A licence field that holds a whole OFL.txt starts with the notice the licence calls «the above copyright notice»
  // (OpenDyslexic's names its Reserved Font Name there and nowhere else): it travels too.
  const headers = [...new Set(perFile.map(({ names }) => {
    const at = (names[13] || '').indexOf('SIL OPEN FONT LICENSE Version 1.1');
    return at < 0 ? '' : names[13].slice(0, at).replace(/-+\s*$/, '').trim();
  }).filter(Boolean))];
  return { family, files, spdx, sources, copyright: copyrights[0], licenceHeader: headers.join('\n\n') };
}

/** The engine's entries, one per family `fonts.css` declares (see `entryOf`); a hand declaration no family uses is refused. */
export function fontEntries({
  css, readFont, declared = DECLARED_WITHOUT_METADATA, texts = FONT_LICENCE_TEXTS,
  readNames = (file) => readFontNames(readFont(file)), // a case describes a font's `name` table without shipping one
}) {
  const entries = familiesOf(css).map((f) => entryOf(f, { readNames, declared, texts }));
  const unused = Object.keys(declared).filter((f) => !entries.some((e) => e.family === f));
  if (unused.length) throw new Error(`declared without metadata but not in fonts.css: ${unused.join(', ')} — delete the entry`);
  return entries;
}

// A font's strings end lines in CR, LF or both (Luckiest Guy's copyright uses a lone CR): each becomes one line here.
const indent = (text) => text.replace(/\r\n?/g, '\n').split('\n').map((l) => `    ${l}`.trimEnd()).join('\n');

/** One family's block of a notice. `original` is where the files come from when they are the author's original, compressed. */
function familyBlock(e, texts, original) {
  return [
    '-------------------------------------------------------------------------------',
    `Family:    ${e.family}`,
    `Files:     ${e.files.join(', ')}`,
    `Licence:   ${texts[e.spdx].name} (${e.spdx}), see ${texts[e.spdx].file}`,
    `Read from: ${e.sources.join('; ')}`,
    ...(original.length ? [`Original:  ${original.join('; ')} — the author's file, compressed to WOFF2 and nothing else`] : []),
    'Copyright:',
    indent(e.copyright),
    ...(e.licenceHeader ? ['Notice at the head of its licence field (name ID 13):', indent(e.licenceHeader)] : []),
  ].join('\n');
}

/** The text of the engine's `NOTICE.txt` for these entries. */
export function noticeText(entries, texts = FONT_LICENCE_TEXTS) {
  const files = entries.reduce((n, e) => n + e.files.length, 0);
  const used = Object.keys(texts).filter((spdx) => entries.some((e) => e.spdx === spdx));
  const head = [
    'The fonts in vendor/fonts/: notices and licences',
    '=============================================',
    '',
    `The Inclusionist engine redistributes ${entries.length} font families, in ${files} files, from this directory. Each`,
    'family is listed below with the files it covers, its licence, where that licence was read, and its copyright',
    'notice as the font\'s own `name` table states it (name ID 0). The licence texts sit beside this file:',
    '',
    ...used.map((spdx) => {
      const n = entries.filter((e) => e.spdx === spdx).length;
      return `    ${texts[spdx].file.padEnd(16)}${texts[spdx].name} (${n} ${n === 1 ? 'family' : 'families'})`;
    }),
    '',
    'Written by scripts/licences/fonts.mjs from vendor/fonts.css and the fonts themselves;',
    'tests/font-licences.node.test.js refuses a family without an entry here or a licence without its text.',
    '',
    'Every other family The Inclusionist offers lives in its font library, one folder per family with its own notice',
    'and licence, and reaches a game only through a delivery that carries it (ADR-0255).',
  ];
  return `${[head.join('\n'), ...entries.map((e) => familyBlock(e, texts, []))].join('\n\n')}\n`;
}

/** The notice as the repository's `fonts.css` and fonts make it today. */
export function currentNotice() {
  const css = readFileSync(`${VENDOR}fonts.css`, 'utf8');
  return noticeText(fontEntries({ css, readFont: (file) => readFileSync(`${FONTS_DIR}${file}`) }));
}

// ===================== THE FONT LIBRARY =====================

/** The library's catalogue: `{ mirror, ranges, families: { [family]: { folder, licence, faces: [...] } } }`. */
export function readLibrary(path = LIBRARY_CATALOGUE) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * THE FILES A FAMILY'S FOLDER OWES ITS AUTHORS, beside its fonts: the licence text its fonts state and `NOTICE.txt` — the same
 * two whether the folder is the library's or a delivery's (`inclusionist-heavy --fonts`). `readFont(file)` returns the font's
 * bytes, which are read for their `name` table. THROWS when the fonts state no licence, another licence than the catalogue
 * records, or one with no text here: a family nobody can account for is not written.
 */
export function familyLicenceFiles(family, entry, readFont, texts = FONT_LICENCE_TEXTS) {
  const files = [...new Set(entry.faces.map((f) => f.file))]; // one file may serve two weights (a variable font's 400 and 700)
  const e = entryOf({ family, files }, { readNames: (file) => readFontNames(readFont(file)), declared: {}, texts });
  if (e.spdx !== entry.licence) throw new Error(`«${family}»: its fonts state ${e.spdx}, the catalogue records ${entry.licence}`);
  const original = [...new Set(entry.faces.map((f) => f.from).filter(Boolean))];
  const notice = [
    [
      `${family}: notice and licence`,
      '='.repeat(family.length + 20),
      '',
      `The font family ${family}, in ${files.length} ${files.length === 1 ? 'file' : 'files'}, as The Inclusionist's font library`,
      'distributes it (ADR-0255). Its licence, where that licence was read, and its copyright notice as the font\'s own',
      `\`name\` table states it (name ID 0). The licence text sits beside this file: ${texts[e.spdx].file}.`,
      '',
      'Written by scripts/licences/fonts.mjs from the engine\'s font catalogue and the fonts themselves.',
    ].join('\n'),
    familyBlock(e, texts, original),
  ].join('\n\n');
  return { [texts[e.spdx].file]: licenceText(e.spdx, texts), [NOTICE_FILE]: `${notice}\n` };
}

/** `SHA256SUMS` in the mirror's format — `<sha256>  <name>` per line, names in code-unit order. */
export function sha256Sums(files) {
  return Object.keys(files).sort().map((name) => `${sha256(files[name])}  ${name}\n`).join('');
}

/**
 * A library folder as it must be: the catalogue's fonts, checked against their pinned sha256, then the licence text, the notice
 * and `SHA256SUMS` over every other file in the folder. Returns `{ [name]: Buffer|string }` of what to write; THROWS on a font
 * missing or whose bytes are not the pinned ones.
 */
export function libraryFolder(family, entry, dir) {
  const read = (file) => readFileSync(join(dir, file));
  for (const face of entry.faces) {
    const got = sha256(read(face.file));
    if (got !== face.sha256) throw new Error(`«${family}» ${face.file}: sha256 ${got}, the catalogue pins ${face.sha256}`);
  }
  const owed = familyLicenceFiles(family, entry, read);
  const onDisk = Object.fromEntries(readdirSync(dir).filter((n) => n !== 'SHA256SUMS' && statSync(join(dir, n)).isFile())
    .map((n) => [n, read(n)]));
  const owedBytes = Object.fromEntries(Object.entries(owed).map(([n, text]) => [n, Buffer.from(text)]));
  return { ...owed, SHA256SUMS: sha256Sums({ ...onDisk, ...owedBytes }) };
}

/** Writes every library folder's owed files, and `<lfs>/fonts/SHA256SUMS` over the whole library (the mirror's upload checks it). */
export function writeLibrary(lfs, library = readLibrary()) {
  const root = join(lfs, LIBRARY_FOLDER);
  const all = {};
  for (const [family, entry] of Object.entries(library.families)) {
    const dir = join(root, entry.folder);
    const files = libraryFolder(family, entry, dir);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    for (const name of readdirSync(dir)) all[`${entry.folder}/${name}`] = readFileSync(join(dir, name));
  }
  const kept = readdirSync(root).filter((n) => statSync(join(root, n)).isFile() && n !== 'SHA256SUMS');
  for (const name of kept) all[name] = readFileSync(join(root, name));
  writeFileSync(join(root, 'SHA256SUMS'), sha256Sums(all));
  return Object.keys(library.families).length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const at = process.argv.indexOf('--library');
  if (at >= 0) {
    const lfs = process.argv[at + 1];
    if (!lfs) { console.error('usage: node scripts/licences/fonts.mjs --library <the-inclusionist-lfs>'); process.exit(2); }
    console.log(`wrote ${writeLibrary(lfs)} library folders under ${join(lfs, LIBRARY_FOLDER)}`);
  } else {
    const text = currentNotice();
    writeFileSync(`${LICENCES_DIR}${NOTICE_FILE}`, text);
    console.log(`wrote ${NOTICE_FILE}: ${Buffer.byteLength(text)} bytes`);
  }
}
