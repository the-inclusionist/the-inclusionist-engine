// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT TRAVELS INSIDE THE PACKAGE — the engine's own faces, and nothing else (ADR-0255; the gates ADR-0108 §confirmation owed).
//
// ========================= WHY THE PACKAGE DESERVES A SIEVE =========================
// ⚠️ EVERY FACE THAT TRAVELS IS A DOWNLOAD A SCHOOL PAYS ON FIRST LOAD, on the machines pillar 1 of ADR-0010 names:
// public-school Positivo and Chromebook. ADR-0255 cut the package to the faces the engine draws with ITSELF — the typography
// button's cycle (ADR-0149, ADR-0150) and the mathematics face; every other family lives in the font library, delivered in
// `heavy/` when a cartridge declares it. A package kept by memory grows by itself, and nobody notices because each face alone
// looks cheap — which is how it reached 214 families.
//
// ========================= THE ANCHOR IS `fonts.css`, NOT THE FOLDER =========================
// ⚠️ The folder is not the truth — a `.woff2` without `@font-face` is usable by no browser, and an `@font-face` pointing
// at a file that does not exist is a dead face the browser tries to fetch and fails. Both failures are silent, so both
// directions have a case here.
//
// ========================= WHAT IS ASSERTED =========================
//   · the package is EXACTLY the engine's faces (`ENGINE_FAMILIES`), and every hand the cycle can pick for any tag is in it;
//   · the PROHIBITION: nothing of the Ronde, no closed Fontshare face, Merriweather nowhere;
//   · no face OFFERED without a way to get it: packaged, in the library, or `off` with an actionable remedy.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The catalogue and the three dictionaries, read from the MODULES and not a copy — the sentence the child and the adult
// read is the one here, and asserting it against a literal beside it would measure the copy.
import {
  FONT_GROUPS, ENGINE_FAMILIES, ENGINE_FACE_KEYS, FONT_BY_KEY, MATHEMATICS_FAMILY, faceAvailable, faceFamilies, handsForTag,
} from '../app/js/ui/fonts.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const VENDOR = fileURLToPath(new URL('../app/public/vendor/', import.meta.url));
const CSS = readFileSync(join(VENDOR, 'fonts.css'), 'utf8');
const NA_PASTA = readdirSync(join(VENDOR, 'fonts'));
const LIBRARY = JSON.parse(readFileSync(new URL('../app/js/platform/font-library.json', import.meta.url), 'utf8'));
const TYPE_CATALOGUE = JSON.parse(readFileSync(new URL('../research/catalogo_tipografico.json', import.meta.url), 'utf8'));

/**
 * EVERY TAG THE CYCLE CAN MEET, as a country and as a language: `handsForTag` reads the region first and then the language, so
 * a hand is reachable through a region the table names or a language it falls back by. Built from the TAGS a child's browser
 * can report, not from the table the function reads — a hand added to the table without a file is caught through its tag.
 */
const TAGS = ['pt-BR', 'pt-PT', 'pt', 'en-US', 'en-GB', 'en', 'es-ES', 'es-MX', 'es-AR', 'es-CL', 'es-CO', 'es-CU', 'es-PE', 'es',
  'en-CA', 'fr-CA', 'pt-AO', 'es-BO', 'en-AU'];

/** The ronde's three faces. NONE can be bundled — they are free for PERSONAL use only (ADR-0012). */
const A_RONDE = Object.freeze(['Ronde Script', 'OPTIFrench-Script', 'Merveille']);
/** The ronde's fallback (ADR-0154): a library family since ADR-0255. */
const RONDE_FALLBACK = 'Cookie';

/* ---------- the pure halves, so fixtures can drive them ---------- */

/** The family names declared in a CSS. */
export function familiasDe(css) {
  return [...new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
}

/** The files the `src:` refer to, without the folder. */
export function referidosPor(css) {
  return [...new Set([...css.matchAll(/url\('fonts\/([^']+)'\)/g)].map((m) => m[1]))];
}

/**
 * Any sign of the ronde — family OR file name.
 *
 * ⚠️ Both, because the two doors are different: a `.woff2` dropped in the folder without `@font-face` is still a file
 * this repository DISTRIBUTES, and distributing is exactly what the licence does not allow.
 */
export function sinaisDeRonde(familias, ficheiros) {
  const porFamilia = familias.filter((f) => A_RONDE.some((r) => f.trim().toLowerCase() === r.toLowerCase()));
  const chaves = ['ronde', 'optifrench', 'merveille'];
  const porFicheiro = ficheiros.filter((n) => chaves.some((c) => n.toLowerCase().includes(c)));
  return [...porFamilia, ...porFicheiro];
}

/**
 * Any sign of a Fontshare «Closed Source» face — family OR file.
 *
 * 🔴 THE LICENCE WAS READ ON 2026-09-12 (ITF Free Font License, version 2.0 of 17/08/2026) and fails twice: §02 forbids
 * making the file available to third parties through a public repository, application, platform or server, and forbids
 * offering it as a selectable font to third-party users. The engine is a public AGPL repository and a library for
 * third-party games. And the definition of derivative work includes format conversion — the `.woff2` we bundle would
 * already be one.
 */
export function sinaisDeFontshareFechada(familias, ficheiros) {
  const porFamilia = familias.filter((f) => /^clash\b/i.test(f.trim()));
  const porFicheiro = ficheiros.filter((n) => n.toLowerCase().includes('clash'));
  return [...porFamilia, ...porFicheiro];
}

const familias = familiasDe(CSS);
const referidos = referidosPor(CSS);
const LIBRARY_FAMILIES = Object.keys(LIBRARY.families);
const LIBRARY_FILES = Object.values(LIBRARY.families).flatMap((f) => f.faces.map((x) => x.file));

describe('ADR-0255 · the package carries the engine\'s own faces, and nothing else', () => {
  it('⚠️ [Interface] o crivo está VIVO: lê famílias e ficheiros de verdade', () => {
    // The vacuum case, first for the usual reason: without it, the absence cases below would pass for having nothing to
    // examine. The proof is real code — the faces the repository bundles.
    expect(NA_PASTA.length, 'a pasta de fontes veio vazia — o caminho morreu').toBeGreaterThan(15);
    expect(referidos.length, 'nenhum `src` foi lido — a regex morreu').toBeGreaterThan(15);
    expect(familias, 'a família âncora não foi lida').toContain('Atkinson Hyperlegible');
    expect(LIBRARY_FAMILIES.length, 'the library was not read').toBeGreaterThan(150);
  });

  it('🔴 [Right] fonts.css declares EXACTLY the engine\'s faces — the cycle\'s and the mathematics face', () => {
    expect([...familias].sort(), 'a family packaged that the engine does not draw with, or one it draws with and does not package')
      .toEqual([...ENGINE_FAMILIES].sort());
    expect(familias).toContain(MATHEMATICS_FAMILY);
    // 📌 the pair: the engine's list is not empty by accident — the three reading faces and a hand at least
    expect(ENGINE_FAMILIES.size).toBeGreaterThanOrEqual(5);
  });

  it('🔴 [Right] EVERY hand the cycle can pick, for any tag, is packaged — the typography button never reaches a missing face', () => {
    const picked = [...new Set(TAGS.flatMap((tag) => handsForTag(tag)))];
    expect(picked.length, 'no tag picked a hand — the list of tags died').toBeGreaterThan(10);
    const missing = picked.map((k) => FONT_BY_KEY[k]?.fam ?? `(no catalogue entry for ${k})`).filter((fam) => !familias.includes(fam));
    expect(missing, 'a hand the cycle can pick is not in the package: the button would draw the system cursive').toEqual([]);
    // and ENGINE_FACE_KEYS holds every hand the table names, which is what `faceAvailable` trusts
    for (const k of picked) expect(ENGINE_FACE_KEYS, `${k} is picked by the cycle but not an engine face`).toContain(k);
  });

  it('🔴 [Zero] no family is BOTH packaged and in the library — one home per family', () => {
    expect(familias.filter((f) => LIBRARY.families[f])).toEqual([]);
    expect(NA_PASTA.filter((n) => LIBRARY_FILES.includes(n)), 'a library file left in the package').toEqual([]);
  });

  it('⚠️ [Zero] NENHUMA face da ronde é empacotada — é uso PESSOAL, não distribuição', () => {
    expect(
      sinaisDeRonde([...familias, ...LIBRARY_FAMILIES], [...NA_PASTA, ...LIBRARY_FILES]),
      'ronde no pacote ou na biblioteca: as três são gratuitas só para uso pessoal, e distribuí-las é distribuir o que não '
      + 'foi licenciado para distribuição (ADR-0012, mantido pelo ADR-0108 §3)',
    ).toEqual([]);
  });

  it('🔴 [Zero] a Clash Display NÃO é distribuída — a ITF Free Font License proíbe (ADR-0150)', () => {
    expect(
      sinaisDeFontshareFechada([...familias, ...LIBRARY_FAMILIES], [...NA_PASTA, ...LIBRARY_FILES]),
      'face Closed Source da Fontshare no pacote ou na biblioteca: a ITF FFL §02 proíbe distribuí-la por repositório, '
      + 'aplicação ou servidor público, e servi-la como fonte selecionável a terceiros',
    ).toEqual([]);
    // 📌 The pair: the detector SEES the family and the file, or the absence above would pass through blindness.
    expect(sinaisDeFontshareFechada(['Clash Display', 'Lexend'], ['clashdisplay-var.woff2', 'lexend-var.woff2']))
      .toEqual(['Clash Display', 'clashdisplay-var.woff2']);
  });

  it('🔴 [Zero] Merriweather is NOWHERE — package, library, kit, dictionaries — and the catalogue says it left (ADR-0254)', () => {
    expect(familias).not.toContain('Merriweather');
    expect(LIBRARY.families.Merriweather, 'Merriweather entered the library').toBeUndefined();
    expect(NA_PASTA.filter((n) => /merriweather/i.test(n))).toEqual([]);
    expect(FONT_GROUPS.flatMap((g) => g.items).filter((it) => /merriweather/i.test(`${it.k} ${it.fam} ${it.id}`))).toEqual([]);
    for (const d of [pt, en, es]) expect(Object.keys(d).filter((k) => /merriweather/i.test(k))).toEqual([]);
    const entry = TYPE_CATALOGUE.fontes.find((f) => f.id === 'merriweather');
    expect(entry.status, 'the typographic catalogue still holds Merriweather as active').toBe('removida');
    expect(entry.motivo, 'removed with no reason written').toBeTruthy();
  });

  it('⚠️ [Interface] todo `@font-face` aponta para um ficheiro que EXISTE', () => {
    // An orphan face raises no error: the browser fetches, fails, and falls to the next font in the stack. The child who
    // needs Andika to read gets something else, and nobody sees.
    const naPasta = new Set(NA_PASTA);
    expect(referidos.filter((f) => !naPasta.has(f)), '`src` a apontar para ficheiro inexistente').toEqual([]);
  });

  it('⚠️ [Interface] todo ficheiro empacotado é REFERIDO — não há peso morto', () => {
    // The other direction, which catches growth: a `.woff2` without `@font-face` is usable by nobody and still travels,
    // is downloaded and paid for. It is the cheapest way for a package to put on weight silently.
    const usados = new Set(referidos);
    expect(NA_PASTA.filter((n) => n.endsWith('.woff2') && !usados.has(n)), 'ficheiro empacotado que ninguém declara').toEqual([]);
  });

  /* ===================== 🎯 NO FACE IS OFFERED WITHOUT A WAY TO GET IT =====================
   *
   * ADR-0108's fourth gate, reshaped by ADR-0255: a face of the kit is got by one of THREE legs — packaged (the engine's), in the
   * font library (delivered where its game declares it), or `off` with a remedy the adult can act on. A face with none of the three
   * is the `learningcurve` defect: the menu offers, the child chooses, and the browser falls to the next font with nothing saying so. */
  it('🎯 [Right] NENHUMA face é oferecida sem forma de a obter — empacotada, na biblioteca, ou `off` com remédio', () => {
    const semSaida = [];
    for (const item of FONT_GROUPS.flatMap((g) => g.items)) {
      const obtivel = faceFamilies(item).some((f) => familias.includes(f.trim()) || LIBRARY.families[f.trim()]);
      if (obtivel) continue;
      const remedio = item.off && [pt, en, es].every((d) => typeof d[item.off] === 'string' && d[item.off].length > 8);
      if (!remedio) semSaida.push(`${item.k} («${item.fam}»)`);
    }
    expect(semSaida, 'face no catálogo que ninguém consegue obter: nem no pacote, nem na biblioteca, nem `off` com remédio').toEqual([]);
    // 📌 THE PAIR, without which the case passes vacuously.
    expect(FONT_GROUPS.flatMap((g) => g.items).length, 'o catálogo esvaziou — o caso mediria o nada').toBeGreaterThanOrEqual(26);
  });

  /* ===================== ADR-0154 · THE RONDE FALLS BACK TO COOKIE, AND STILL NAMES THE THREE =====================
   *
   * ADR-0012 decided the licence — the three faces are free for PERSONAL use only and are never bundled. ADR-0154 ends the
   * ronde's stack in Cookie, so the option works offline wherever Cookie is; since ADR-0255 Cookie is a LIBRARY family, there
   * where the game declares it. 🔴 Cookie is a related joined hand, NOT the ronde a French classroom teaches, and the notice is
   * the only thing that says so — which is why it still names the three. */
  describe('ADR-0154 · the ronde falls back to Cookie and names the three faces', () => {
    const RONDE = FONT_GROUPS.flatMap((g) => g.items).find((it) => it.k === 'ronde');

    it('[Zero] the `ronde` entry exists in the catalogue, and is not `off`', () => {
      expect(RONDE, 'the ronde entry left the catalogue — ADR-0154 has no subject').toBeTruthy();
      expect(RONDE.off, 'the ronde is `off` again: Cookie answers wherever the game declares it').toBeUndefined();
      // 📌 `geral` and not `caligrafica`, although it is calligraphic: the menu filters out the calligraphic ones.
      expect(RONDE.role, 'a ronde foi marcada como caligráfica e desapareceu do menu').toBeUndefined();
    });

    it('🎯 [Right] the notice names ALL THREE, in the three languages', () => {
      expect(RONDE.notice, 'the ronde lost its notice: Cookie shows with nothing saying it is not the ronde').toBeTruthy();
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        const msg = dic[RONDE.notice];
        expect(msg, `${nome}: a chave \`${RONDE.notice}\` não existe no dicionário`).toBeTruthy();
        for (const face of A_RONDE) expect(msg, `${nome}: a mensagem não nomeia «${face}»`).toContain(face);
      }
    });

    it('🎯 [Right] the stack is the three, in the Dev\'s order, and ENDS in Cookie', () => {
      expect(faceFamilies(RONDE), 'the ronde stack is not «the three, then Cookie»').toEqual([...A_RONDE, RONDE_FALLBACK]);
    });

    it('🔴 [Right] Cookie is IN THE LIBRARY, as its author\'s original (ADR-0254, ADR-0255)', () => {
      const cookie = LIBRARY.families[RONDE_FALLBACK];
      expect(cookie, 'Cookie is not in the library — the ronde stack falls to the generic').toBeTruthy();
      expect(cookie.faces.every((f) => f.from && !f.range), 'Cookie is a subset again, not its author\'s original').toBe(true);
    });

    it('🎯 [Right] available where the game declared Cookie; not where nothing draws it', () => {
      expect(faceAvailable(RONDE, (f) => f === RONDE_FALLBACK)).toBe(true);
      expect(faceAvailable(RONDE, () => false), 'the ronde is offered with nothing to draw it').toBe(false);
      expect(faceAvailable(RONDE, undefined)).toBe(false);
    });

    it('📌 [Boundary] an ENGINE face is available with no detector at all', () => {
      const atkinson = FONT_BY_KEY.atkinson;
      expect(faceAvailable(atkinson, undefined)).toBe(true);
      expect(faceAvailable(atkinson, () => false)).toBe(true);
    });

    it('⚠️ [Right] e uma frase que nomeia a CATEGORIA reprovaria — a forma que o ADR-0108 recusa', () => {
      const nomeiaAsTres = (texto) => A_RONDE.every((f) => texto.includes(f));
      expect(nomeiaAsTres('Instale uma fonte ronde no aparelho.')).toBe(false);
      expect(nomeiaAsTres('Instale Ronde Script, OPTIFrench-Script ou Merveille.')).toBe(true);
      expect(nomeiaAsTres('Instale Ronde Script ou Merveille.')).toBe(false);
    });
  });

  it('[Right] a ronde é apanhada pela FAMÍLIA e também pelo FICHEIRO solto', () => {
    expect(sinaisDeRonde(['Merveille'], [])).toEqual(['Merveille']);
    expect(sinaisDeRonde([], ['ronde-script-400.woff2'])).toEqual(['ronde-script-400.woff2']);
    expect(sinaisDeRonde(['Atkinson Hyperlegible'], ['atkinson-400.woff2'])).toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-27, ADR-0255; each applied by script — the anchor counted, exactly once — and restored from a copy by sha256.)
//   P1. a library face (Lato, pointed at a packaged file) declared in fonts.css again → 🔴 «EXACTLY the engine's faces», «one home».
//   P2. Playwrite PE's @font-face removed from fonts.css → 🔴 four: «EXACTLY», «EVERY hand» (es-PE picks it), the dead-weight case
//       (its file left undeclared) and «no face offered without a way to get it».
//   P3. `faceAvailable` answering true for every face not `off` (the rule before ADR-0255) → 🔴 «available where the game declared
//       Cookie» here, and the library-row and ronde-row cases in `settings-typo.node`.
//   P4. Merriweather's `status` put back to `ativo` in the typographic catalogue → 🔴 «Merriweather is NOWHERE».
//   P5. Cookie's entry renamed away in font-library.json → 🔴 «Cookie is IN THE LIBRARY» and «no face offered without a way to get it».
