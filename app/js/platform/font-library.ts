// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/font-library.ts — THE FONT LIBRARY: every family the engine does not draw with itself (ADR-0255).
//
// The engine packages and precaches only its own faces — the typography button's and the mathematics face (`vendor/fonts.css`).
// Every other family of the typographic catalogue lives with the heavy files: one folder per family in `the-inclusionist-lfs`
// (`fonts/<folder>/`, with its licence and notice), catalogued here with each face's file, weight, style, unicode-range, bytes
// and sha256 (`font-library.json`). A cartridge DECLARES the families it draws with (`uses.fonts`); the delivery copies them into
// `heavy/` (`inclusionist-heavy --fonts`), checked against this catalogue; and at boot the engine writes their `@font-face` rules
// itself and keeps each file in the checked cache (`platform/heavy`), so they are there on the days without a network.
//
// 📌 THE CATALOGUE IS A CHUNK OF ITS OWN, loaded only when a cartridge declares a family: 194 families of sha256s are not what
// every page should import to draw the three faces the engine uses.
import type { HeavyFile } from './heavy-catalogue.js';

/** One face of a family: one file, and what its `@font-face` rule says of it. */
export interface LibraryFace {
  readonly file: string;
  /** A weight (`400`) or a variable range (`100 900`), as `font-weight` takes it. */
  readonly weight: string;
  readonly style: string;
  /** A key of `FontLibrary.ranges`; absent = the file covers the whole family (an author's original, ADR-0254). */
  readonly range?: string;
  readonly bytes: number;
  readonly sha256: string;
  /** The author's original this file was compressed from, for a family with a Reserved Font Name (ADR-0254). */
  readonly from?: string;
}

/** A family of the library: its folder in the mirror, the licence its fonts state, and its faces. */
export interface LibraryFamily {
  readonly folder: string;
  readonly licence: string;
  readonly faces: readonly LibraryFace[];
}

/** The catalogue: the mirror's address, the unicode-ranges the faces share, and the families by name. */
export interface FontLibrary {
  readonly mirror: string;
  readonly ranges: Readonly<Record<string, string>>;
  readonly families: Readonly<Record<string, LibraryFamily>>;
}

/** Loads the catalogue — its own chunk, fetched from the page's origin the first time a cartridge declares a family. */
async function loadFontLibrary(): Promise<FontLibrary> {
  return (await import('./font-library.json')).default as FontLibrary;
}

/** The address a face is kept under in the checked cache — the mirror's, as every heavy file's upstream address is. */
function libraryFaceUrl(library: FontLibrary, family: LibraryFamily, face: LibraryFace): string {
  return `${library.mirror}/${family.folder}/${face.file}`;
}

/** The heavy-file id of a face: `font:<folder>:<file>`. */
export const libraryFaceId = (family: LibraryFamily, face: LibraryFace): string => `font:${family.folder}:${face.file}`;

/**
 * Each FILE of these families as a heavy file: its address, its bytes and the sha256 its body must have to be kept. Once each —
 * a variable file may be declared at two weights, and is kept once.
 */
export function libraryFiles(library: FontLibrary, families: readonly string[]): HeavyFile[] {
  const files = families.flatMap((name) => {
    const family = library.families[name];
    return family ? family.faces.map((face) => ({
      id: libraryFaceId(family, face), url: libraryFaceUrl(library, family, face), bytes: face.bytes, sha256: face.sha256,
    })) : [];
  });
  return files.filter((f, i) => files.findIndex((g) => g.id === f.id) === i);
}

/**
 * The `@font-face` rules of these families, each `src` at `href(address)` — the delivery's `heavy/` path, resolved against the
 * page, where the service worker answers from the checked cache. A face with no range covers the whole family (ADR-0254).
 */
export function libraryFaceRules(library: FontLibrary, families: readonly string[], href: (url: string) => string): string {
  return families.flatMap((name) => {
    const family = library.families[name];
    if (!family) return [];
    return family.faces.map((face) => {
      const range = face.range ? `unicode-range:${library.ranges[face.range]};` : '';
      return `@font-face{font-family:'${name}';font-style:${face.style};font-weight:${face.weight};font-display:swap;`
        + `src:url('${href(libraryFaceUrl(library, family, face))}') format('woff2');${range}}`;
    });
  }).join('\n');
}

/**
 * THE FAMILIES A CARTRIDGE DECLARED (`uses.fonts`), less the engine's own — they are packaged, and declaring one asks for
 * nothing. `problem` names a declaration that is not a list of family names, which the engine cannot read.
 */
export function declaredFamilies(value: unknown, engineFamilies: ReadonlySet<string>): { readonly asked: string[]; readonly problem: string | null } {
  if (value === undefined || value === null) return { asked: [], problem: null };
  if (!Array.isArray(value) || value.some((f) => typeof f !== 'string' || !f.trim())) {
    return { asked: [], problem: `fonts: \`uses.fonts\` is ${JSON.stringify(value)}, not a list of family names — no library face was `
      + 'loaded, so the text the game draws in them falls back to the next face of its stack; declare `uses: { fonts: [\'Lato\'] }`' };
  }
  return { asked: [...new Set(value.map((f: string) => f.trim()))].filter((f) => !engineFamilies.has(f)), problem: null };
}

/** The line of `problems` for a declared family the library does not hold (ADR-0169: the subject, the cost, the fix). */
export function unknownFamilyLine(family: string): string {
  return `font «${family}»: the game declares it in \`uses.fonts\`, and the engine's font library has no such family — the text `
    + 'the game draws in it falls back to the next face of its stack; declare a family the library holds '
    + '(`platform/font-library.json`), or leave it out';
}

/** The line of `problems` for a declared family the delivery did not carry, or whose file was refused. */
function undeliveredLine(family: string, error: string): string {
  return `font «${family}»: the game declares it in \`uses.fonts\`, and it was not kept (${error}) — the text the game draws in it `
    + 'falls back to the next face of its stack, and on a day without a network the face is not there at all; build the delivery '
    + `with \`inclusionist-heavy <folder> --fonts "${family}"\``;
}

/** What the root lends the library's start: where the rules go, how a delivery path becomes an address, and where lines go. */
export interface LibraryFontsPorts {
  /** The families declared, the engine's own left out (`declaredFamilies`). */
  readonly asked: readonly string[];
  /** Writes the rules into the document (a `<style>` of the root's). */
  readonly declare: (css: string) => void;
  /** An upstream address → the address the page asks for it at (`heavy/` under the page). */
  readonly href: (url: string) => string;
  /** A line of `problems`. */
  readonly report: (line: string) => void;
  /** The catalogue; `loadFontLibrary` unless a case hands its own. */
  readonly load?: () => Promise<FontLibrary>;
}

/** What the start answers: the files to keep in the checked cache, and the listener that turns their refusals into lines. */
export interface LibraryFontsStarted {
  readonly files: readonly HeavyFile[];
  readonly onReport: (r: { readonly id: string; readonly outcome: string; readonly error?: string }) => void;
}

/**
 * DECLARES THE ASKED FAMILIES' FACES, and answers the files to keep. A family the library does not hold is said in `problems`;
 * a file the delivery did not carry, or whose sha256 differs, is said once per family when its report arrives. Never throws: a
 * catalogue that does not load is one line, and the game plays in its stack's next face.
 */
export async function startLibraryFonts(p: LibraryFontsPorts): Promise<LibraryFontsStarted> {
  try {
    const library = await (p.load ?? loadFontLibrary)();
    const held = p.asked.filter((f) => library.families[f]);
    for (const f of p.asked) if (!library.families[f]) p.report(unknownFamilyLine(f));
    if (held.length) p.declare(libraryFaceRules(library, held, p.href));
    const familyOf = new Map(held.flatMap((f) => library.families[f]!.faces.map((face) => [libraryFaceId(library.families[f]!, face), f])));
    const said = new Set<string>();
    return {
      files: libraryFiles(library, held),
      onReport: (r) => {
        const family = familyOf.get(r.id);
        if (!family || r.outcome !== 'falhou' || said.has(family)) return;
        said.add(family);
        p.report(undeliveredLine(family, r.error ?? 'refused'));
      },
    };
  } catch (e) {
    for (const f of p.asked) p.report(undeliveredLine(f, `the font catalogue did not load: ${e instanceof Error ? e.message : String(e)}`));
    return { files: [], onReport: () => {} };
  }
}
