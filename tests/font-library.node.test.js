// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FONT LIBRARY: ITS CATALOGUE, THE RULES THE ENGINE WRITES, AND THE FILES IT KEEPS (ADR-0255, platform/font-library).
//
// A cartridge declares the library families it draws with; the root writes their `@font-face` at the delivery's `heavy/` and keeps
// each face in the checked cache — through the SAME download as the heavy files (`platform/heavy`), so a face whose sha256 is not
// the catalogue's is never kept, and one the delivery did not carry is a line of `problems`. The rendering half (a real document)
// is `a-cartridge-declares-a-library-font.browser.test.js`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  libraryFiles, libraryFaceRules, declaredFamilies, startLibraryFonts, libraryFaceId, unknownFamilyLine,
} from '../app/js/platform/font-library.js';
import { downloadHeavy, deliveryPath, CACHE_HEAVY } from '../app/js/platform/heavy.js';
import { MIRROR_FOLDERS } from '../app/js/platform/heavy-mirror.js';
import { ENGINE_FAMILIES } from '../app/js/ui/fonts.js';

const LIBRARY = JSON.parse(readFileSync(new URL('../app/js/platform/font-library.json', import.meta.url), 'utf8'));
const hex = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');
const BASE = 'https://escola.example/jogo/';
const href = (url) => new URL(deliveryPath(url), BASE).href;

/** A Cache Storage of one cache, as the browser's: `put` keeps, `match` finds by address. */
function fakeCaches() {
  const kept = new Map();
  const cache = { match: async (u) => kept.get(String(u)), put: async (u, r) => { kept.set(String(u), r); } };
  return { kept, storage: { open: async (name) => { expect(name).toBe(CACHE_HEAVY); return cache; } } };
}

describe('the catalogue', () => {
  const families = Object.entries(LIBRARY.families);

  it('🎯 [Zero] it is read, and every face names a file, a weight, a style, its bytes and a sha256', () => {
    expect(families.length).toBeGreaterThan(150);
    const bad = families.flatMap(([f, e]) => e.faces.filter((x) => !x.file.endsWith('.woff2') || !x.weight || !x.style
      || !(x.bytes > 0) || !/^[0-9a-f]{64}$/.test(x.sha256) || (x.range && !LIBRARY.ranges[x.range])).map((x) => `${f}: ${x.file}`));
    expect(bad).toEqual([]);
    const folders = families.map(([, e]) => e.folder);
    expect(new Set(folders).size, 'two families share a folder').toBe(folders.length);
  });

  it('🔴 [Right] the mirror it names is the one `heavy-mirror` reads a local base under — a folder build finds the fonts', () => {
    expect(MIRROR_FOLDERS.find(([up]) => up === LIBRARY.mirror)?.[1]).toBe('fonts');
  });

  it('🔴 [Right] it holds none of the engine\'s own faces — those are packaged, one home per family', () => {
    expect(families.map(([f]) => f).filter((f) => ENGINE_FAMILIES.has(f))).toEqual([]);
  });
});

describe('what the engine writes and keeps for a declared family', () => {
  it('🔴 [Right] each face is a heavy file at the mirror\'s address, with the catalogue\'s bytes and sha256', () => {
    const files = libraryFiles(LIBRARY, ['Lato']);
    expect(files.map((f) => f.id)).toEqual(['font:lato:lato-400.woff2', 'font:lato:lato-700.woff2']);
    expect(files[0].url).toBe(`${LIBRARY.mirror}/lato/lato-400.woff2`);
    expect(files[0].sha256).toBe(LIBRARY.families.Lato.faces[0].sha256);
    expect(libraryFiles(LIBRARY, ['Nobody'])).toEqual([]);
  });

  it('🔴 [Right] the @font-face rules point at the delivery\'s heavy/ under the page, with the subset\'s range and none for an original', () => {
    const css = libraryFaceRules(LIBRARY, ['Lato', 'Inter'], href);
    expect(css).toContain(`src:url('${BASE}heavy/lfs-oinclusionista.jrocha.dev.br/fonts/lato/lato-400.woff2') format('woff2');}`);
    expect(css).toContain("font-family:'Lato';font-style:normal;font-weight:700;");
    expect(css.split('\n').filter((r) => r.includes("'Inter'")).length).toBe(LIBRARY.families.Inter.faces.length);
    // a SUBSET face carries its range, or the browser downloads every subset for every letter and draws Latin from the wrong one
    const fredoka = LIBRARY.families.Fredoka.faces;
    const rules = libraryFaceRules(LIBRARY, ['Fredoka'], href).split('\n');
    expect(fredoka.every((f) => f.range), 'the case needs a family of subsets').toBe(true);
    fredoka.forEach((f, i) => expect(rules[i], `${f.file} lost its unicode-range`).toContain(`unicode-range:${LIBRARY.ranges[f.range]};`));
    expect(css.split('\n').filter((r) => r.includes("'Lato'")).every((r) => !r.includes('unicode-range'))).toBe(true);
  });

  it('🔴 [Right] a declaration leaves the engine\'s faces out, and one that is not a list of names is said, not guessed', () => {
    expect(declaredFamilies(['Lato', 'Andika', 'Lato', ' Cookie '], ENGINE_FAMILIES)).toEqual({ asked: ['Lato', 'Cookie'], problem: null });
    expect(declaredFamilies(undefined, ENGINE_FAMILIES)).toEqual({ asked: [], problem: null });
    // a string where a list was meant — spread, it would be asked for letter by letter
    const once = declaredFamilies('Lato', ENGINE_FAMILIES);
    expect(once.asked).toEqual([]);
    expect(once.problem).toMatch(/^fonts: `uses.fonts` is "Lato", not a list of family names/);
  });

  it('🔴 [Right] a declared family is written, kept CHECKED in the cache, before the heavy files — and an unknown one is said', async () => {
    const lines = []; let css = '';
    const started = await startLibraryFonts({ asked: ['Lato', 'Nobody Sans'], declare: (c) => { css = c; }, href, report: (l) => lines.push(l),
      load: async () => LIBRARY });
    expect(css).toContain("font-family:'Lato'");
    expect(lines).toEqual([unknownFamilyLine('Nobody Sans')]);
    // the delivery serves Lato's two faces; bodies are fakes pinned by a catalogue of the same shape
    const bodies = { 'lato-400.woff2': new Uint8Array([1, 2, 3]), 'lato-700.woff2': new Uint8Array([4, 5]) };
    const pinned = started.files.map((f) => ({ ...f, sha256: hex(bodies[f.url.split('/').pop()]) }));
    const { kept, storage } = fakeCaches();
    const asked = [];
    const reports = await downloadHeavy({
      also: pinned, only: ['visao:runtime'], cacheStorage: storage, base: BASE, onProgress: started.onReport,
      digest: async (b) => hex(b),
      fetch: async (u) => { asked.push(String(u)); const body = bodies[String(u).split('/').pop()];
        return body ? new Response(body, { status: 200 }) : new Response('', { status: 404 }); },
    });
    expect(reports.map((r) => r.id).slice(0, 2), 'the fonts do not come first').toEqual(pinned.map((f) => f.id));
    expect(reports.slice(0, 2).map((r) => r.outcome)).toEqual(['baixado', 'baixado']);
    expect(asked[0], 'asked somewhere other than the delivery\'s heavy/').toBe(`${BASE}heavy/lfs-oinclusionista.jrocha.dev.br/fonts/lato/lato-400.woff2`);
    expect(kept.has(`${LIBRARY.mirror}/lato/lato-400.woff2`), 'not kept under the address the service worker answers').toBe(true);
    expect(lines.length, 'a kept family was reported').toBe(1);
  });

  it('🔴 [Right] a face the delivery did not carry, or whose sha256 differs, is NOT kept and its family is said ONCE, with the fix', async () => {
    const lines = [];
    const started = await startLibraryFonts({ asked: ['Lato'], declare: () => {}, href, report: (l) => lines.push(l), load: async () => LIBRARY });
    const { kept, storage } = fakeCaches();
    await downloadHeavy({
      also: started.files, only: [], cacheStorage: storage, base: BASE, onProgress: started.onReport, digest: async (b) => hex(b),
      // 400: another body than the pinned one (a tampered or stale file); 700: not in the delivery
      fetch: async (u) => (String(u).endsWith('lato-400.woff2') ? new Response(new Uint8Array([9]), { status: 200 }) : new Response('', { status: 404 })),
    });
    expect(kept.size, 'a body that is not the pinned one was kept').toBe(0);
    expect(lines.length, 'the family was said more than once, or not at all').toBe(1);
    expect(lines[0]).toMatch(/^font «Lato»: the game declares it in `uses.fonts`, and it was not kept \(sha256 mismatch/);
    expect(lines[0]).toContain('inclusionist-heavy <folder> --fonts "Lato"');
  });

  it('📌 [Boundary] a catalogue that does not load is one line per family, and nothing is declared or kept', async () => {
    const lines = []; let declared = false;
    const started = await startLibraryFonts({ asked: ['Lato'], declare: () => { declared = true; }, href, report: (l) => lines.push(l),
      load: async () => { throw new Error('offline'); } });
    expect(declared).toBe(false);
    expect(started.files).toEqual([]);
    expect(lines).toEqual([expect.stringMatching(/^font «Lato».*the font catalogue did not load: offline/)]);
    expect(libraryFaceId(LIBRARY.families.Lato, LIBRARY.families.Lato.faces[0])).toBe('font:lato:lato-400.woff2');
  });
});

// MUTATIONS CHECKED (2026-09-27), each applied by script — the anchor counted, exactly once — and restored from a copy by sha256:
//   L1 `libraryFaceRules` drops a subset face's unicode-range            🔴 the rules point at heavy/, with the subset's range
//   L2 `downloadHeavy` ignores `also`                                  🔴 kept CHECKED · not kept and said ONCE
//   L7 `also` kept LAST, behind the catalogue's files                  🔴 kept CHECKED … before the heavy files
//   L3 a refused font file never said                                  🔴 said ONCE, with the fix
//   L4 the family said for every failed file                           🔴 said ONCE, with the fix
//   L5 `declaredFamilies` keeps the engine's own faces                 🔴 a declaration leaves the engine's faces out
//   L6 a declaration that is not a list accepted                       🔴 a declaration … that is not a list of names is said
// (⚠️ L1 SURVIVED the first draft: its loop looked for `-ext` in Inter's files, which have none — vacuous; the case now holds Fredoka.)
