// SPDX-License-Identifier: AGPL-3.0-or-later
//
// WHAT THE ENGINE OWES THE PEOPLE WHOSE FONTS IT CARRIES (the fonts' twin of `third-party.mjs`).
//
// The engine packages every font family `app/public/vendor/fonts.css` declares — 214 families in 340 `.woff2` files — and
// every copy of it is a redistribution: the PWA precaches them into each install, and the npm package ships `app/public/vendor`.
// SIL OFL 1.1 §2 lets a font travel «provided that each copy contains the above copyright notice and this license», as a
// stand-alone text file or as metadata «easily viewed by the user»; Apache-2.0 §4(a) asks for the licence text; the Ubuntu Font
// Licence 1.0 §1 asks for the notice and the licence as the OFL does. So `app/public/vendor/fonts-licences/`, beside `fonts/`,
// carries each licence text they are under and `NOTICE.txt`: every family, its files, its licence and its copyright line AS THE FONT
// ITSELF STATES IT (name ID 0 of its `name` table), so the obligation holds whether or not a viewer can open the metadata.
//
// 📏 MEASURED 2026-09-27, all 346 files then packaged: every one keeps its copyright line (name ID 0); only ONE keeps its licence
// description (name ID 13, OpenDyslexic, the whole OFL text); 331 keep a licence URL (name ID 14). The web subsets strip the
// licence text, which is why the text has to travel as a file. Three families are NOT under the OFL — Luckiest Guy and Smokum
// (Apache-2.0) and Ubuntu (Ubuntu Font Licence 1.0) — although the typographic catalogue records «OFL 1.1» for all three.
//
// 📌 THE LICENCE IS READ FROM THE FONT, never from a list kept by hand: its URL (ID 14), its licence description (ID 13) and
// the words of its copyright line (ID 0). Where these disagree the family is refused; where the font says nothing, the family
// must be DECLARED below with the evidence, or it is refused too — `NOTICE.txt` is not written with a family nobody accounted for.
// `tests/font-licences.node.test.js` holds the committed `NOTICE.txt` equal to what this module builds, so a family added to
// `fonts.css` without its entry turns the suite red.
//
// Use: `node scripts/licences/fonts.mjs` rewrites `app/public/vendor/fonts-licences/NOTICE.txt` from `fonts.css` and the fonts.

import { readFileSync, writeFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { LICENCE_TEXTS } from './third-party.mjs';

export const VENDOR = fileURLToPath(new URL('../../app/public/vendor/', import.meta.url));
export const FONTS_DIR = fileURLToPath(new URL('../../app/public/vendor/fonts/', import.meta.url));
export const NOTICE_FILE = 'NOTICE.txt';
/** Where the notice and the licence texts ship: beside onts/, not in it — /vendor/fonts/* is cached for a year as immutable,
 * and the notice changes whenever a family does (_headers gives this folder a rule that revalidates). */
export const LICENCES_DIR = fileURLToPath(new URL('../../app/public/vendor/fonts-licences/', import.meta.url));

/**
 * The licence texts that ship beside the fonts, each COPIED from a local file and pinned (sha256 of the copy, CRLF read as LF).
 * · OFL-1.1: the licence body — from the «SIL OPEN FONT LICENSE Version 1.1» banner to the end — of the licence field (name ID
 *   13) of this directory's own `opendyslexic-400.woff2`. Byte-identical to the same body in three other local copies of
 *   upstream `OFL.txt` files (game-chess: Pecita, STIX Two Math, Noto Sans Symbols 2), and to a fourth (game-pinball's Press
 *   Start 2P) but for the final newline.
 * · Apache-2.0: `scripts/licences/Apache-2.0.txt`, the same file and the same pin as the heavy files'.
 * · Ubuntu-font-1.0: the `License: Ubuntu-Font-Licence-1.0` paragraph of the Debian package `fonts-ubuntu`'s
 *   `/usr/share/doc/fonts-ubuntu/copyright` (sha256 bca346a5…8ef8cf, the same in three WSL installs, packages 0.83-6ubuntu1 and
 *   0.869+git20240321-0ubuntu1), decoded as the Debian copyright format writes it: one leading space removed from each line, a
 *   line holding only « .» read as an empty line. ✅ VERIFIED 2026-09-27 byte for byte (same sha256) against
 *   `google/fonts` `ufl/ubuntu/UFL.txt`, the licence that travels with the very files this engine packages.
 */
export const FONT_LICENCE_TEXTS = Object.freeze({
  'OFL-1.1': { file: 'OFL-1.1.txt', name: 'SIL Open Font License, Version 1.1',
    sha256: 'f05e84c3000faf09cf8e445d35018b01fc0d6026953840e9398aeab501b86da2',
    from: 'app/public/vendor/fonts/opendyslexic-400.woff2, name ID 13, from the «SIL OPEN FONT LICENSE Version 1.1» banner' },
  'Apache-2.0': { file: 'Apache-2.0.txt', name: 'Apache License, Version 2.0',
    sha256: LICENCE_TEXTS['Apache-2.0'].sha256,
    from: 'scripts/licences/Apache-2.0.txt' },
  'Ubuntu-font-1.0': { file: 'UFL-1.0.txt', name: 'Ubuntu Font Licence, Version 1.0',
    sha256: '2f0015108d68627bd788d313f529c21ff4da2c2c42a5e1f3883acc83480f9002',
    from: 'Debian package fonts-ubuntu, /usr/share/doc/fonts-ubuntu/copyright, the Ubuntu-Font-Licence-1.0 paragraph' },
});

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
 * Name IDs 0 (copyright), 1 (family), 13 (licence description) and 14 (licence URL) of a WOFF2 file, English (Windows) record
 * preferred. The `name` table is never transformed in WOFF2, so the table directory and the Brotli stream are enough.
 */
export function readFontNames(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  if (buf.toString('latin1', 4, 8) === 'ttcf') throw new Error('woff2: font collections are not read here');
  const numTables = buf.readUInt16BE(12);
  const compressedLength = buf.readUInt32BE(20);
  const at = { p: 48 };
  let offset = 0;
  let name = null;
  for (let i = 0; i < numTables; i++) {
    const flags = buf[at.p++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', at.p, at.p + 4); at.p += 4; }
    const version = flags >> 6;
    let length = uintBase128(buf, at);
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    if (transformed) length = uintBase128(buf, at);
    if (tag === 'name') name = { offset, length };
    offset += length;
  }
  if (!name) throw new Error('woff2: no name table');
  const table = brotliDecompressSync(buf.subarray(at.p, at.p + compressedLength)).subarray(name.offset, name.offset + name.length);
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
export function fontEntries({
  css, readFont, declared = DECLARED_WITHOUT_METADATA, texts = FONT_LICENCE_TEXTS,
  readNames = (file) => readFontNames(readFont(file)), // a case describes a font's `name` table without shipping one
}) {
  const entries = familiesOf(css).map(({ family, files }) => {
    const perFile = files.map((file) => ({ file, names: readNames(file) }));
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
  });
  const unused = Object.keys(declared).filter((f) => !entries.some((e) => e.family === f));
  if (unused.length) throw new Error(`declared without metadata but not in fonts.css: ${unused.join(', ')} — delete the entry`);
  return entries;
}

// A font's strings end lines in CR, LF or both (Luckiest Guy's copyright uses a lone CR): each becomes one line here.
const indent = (text) => text.replace(/\r\n?/g, '\n').split('\n').map((l) => `    ${l}`.trimEnd()).join('\n');

/** The text of `NOTICE.txt` for these entries. */
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
  ];
  const body = entries.map((e) => [
    '-------------------------------------------------------------------------------',
    `Family:    ${e.family}`,
    `Files:     ${e.files.join(', ')}`,
    `Licence:   ${texts[e.spdx].name} (${e.spdx}), see ${texts[e.spdx].file}`,
    `Read from: ${e.sources.join('; ')}`,
    'Copyright:',
    indent(e.copyright),
    ...(e.licenceHeader ? ['Notice at the head of its licence field (name ID 13):', indent(e.licenceHeader)] : []),
  ].join('\n'));
  return `${[head.join('\n'), ...body].join('\n\n')}\n`;
}

/** The notice as the repository's `fonts.css` and fonts make it today. */
export function currentNotice() {
  const css = readFileSync(`${VENDOR}fonts.css`, 'utf8');
  return noticeText(fontEntries({ css, readFont: (file) => readFileSync(`${FONTS_DIR}${file}`) }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = currentNotice();
  writeFileSync(`${LICENCES_DIR}${NOTICE_FILE}`, text);
  console.log(`wrote ${NOTICE_FILE}: ${Buffer.byteLength(text)} bytes`);
}
