// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT TRAVELS INSIDE THE PACKAGE — the gates ADR-0108 §confirmation owed.
//
// ========================= WHY THE PACKAGE DESERVES A SIEVE =========================
// ⚠️ EVERY FACE THAT TRAVELS IS A DOWNLOAD A SCHOOL PAYS ON FIRST LOAD, on the machines pillar 1 of ADR-0010 names:
// public-school Positivo and Chromebook. ADR-0012 cut the roster «uma segunda vez, por ENTREGA», with that reason
// written; ADR-0108 fixed the Playwrite list. A delivery list kept by memory is a package that grows by itself, and
// nobody notices because each face alone looks cheap.
//
// ========================= THE ANCHOR IS `fonts.css`, NOT THE FOLDER =========================
// ⚠️ The folder is not the truth — a `.woff2` without `@font-face` is usable by no browser, and an `@font-face` pointing
// at a file that does not exist is a dead face the browser tries to fetch and fails. Both failures are silent, so both
// directions have a case here.
//
// ========================= WHAT IS ASSERTED =========================
//   · the PROHIBITION: no Playwrite beyond the declared ones, nothing of the Ronde, no closed Fontshare face;
//   · a FLOOR that only rises: the eight of ADR-0108 have arrived, and the floor cannot go back without someone writing
//     it here by hand — this repository's «teto que só desce», the other way round;
//   · no face OFFERED without a way to get it: bundled, or `off` with an actionable remedy (the fourth gate, below).
//
// 📌 The Ronde option is a `geral` entry with `off` and the `font.off.ronde` key in all three languages: a `geral` entry
// with `off` RENDERS (the typography panel filters by role, not state), while a `caligrafica` one would be invisible.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The catalogue and the three dictionaries, read from the MODULES and not a copy — the sentence the child and the adult
// read is the one here, and asserting it against a literal beside it would measure the copy.
import { FONT_GROUPS, faceAvailable, faceFamilies } from '../app/js/ui/fonts.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const VENDOR = fileURLToPath(new URL('../app/public/vendor/', import.meta.url));
const CSS = readFileSync(join(VENDOR, 'fonts.css'), 'utf8');
const NA_PASTA = readdirSync(join(VENDOR, 'fonts'));

/**
 * THE ONES THAT TRAVEL. Written as they appear in the Google Fonts family name.
 *
 * ⚠️ The list's shape IS the argument: it changed TWICE by the Dev's decision — so the two layers are written apart,
 * instead of merged into a list of fifteen that says where none came from.
 *
 * 📌 THE ORIGINAL EIGHT (ADR-0108 §2) are the Americas with BOTH American hands, because the US teaches two and choosing
 * one would be choosing for the child.
 *
 * 🔴 THE SEVEN NEW ONES (ADR-0150) enter by a different rule, and revoke ADR-0108's «nada de empacotar»: three are the
 * FALLBACK BY LANGUAGE — a country without a hand of its own gets the coloniser's, so Spain, Portugal and England cover
 * EVERY missing country —, two were asked for by name (Cuba, Peru), and two are the second hand of a country that
 * teaches two, exactly like US Trad/Modern.
 *
 * ⚠️ AND THE SIEVE STILL ASKS BY PREFIX, which keeps it alive: a sixteenth («Playwrite IE», «Playwrite NG», or any
 * `Guides`) is caught without having to be predicted by name.
 */
const AS_OITO = Object.freeze([
  'Playwrite BR', 'Playwrite US Trad', 'Playwrite US Modern', 'Playwrite CA',
  'Playwrite MX', 'Playwrite AR', 'Playwrite CL', 'Playwrite CO',
]);
const AS_SETE_NOVAS = Object.freeze([
  'Playwrite ES', 'Playwrite PT', 'Playwrite GB J',   // the fallbacks by language
  'Playwrite CU', 'Playwrite PE',                      // asked for by name
  'Playwrite ES Deco', 'Playwrite GB S',               // the second hand of a country that teaches two
]);
const AS_EMPACOTADAS = Object.freeze([...AS_OITO, ...AS_SETE_NOVAS]);

/**
 * Since the ADR-0176 erratum («Engine empacota tudo por enquanto») the package is every `ativo` family of the typographic
 * catalogue, the Guides included; the fifteen above stay as the ones the reading menu grew from.
 */
const ATIVAS_DO_CATALOGO = Object.freeze(new Set(JSON.parse(readFileSync(new URL('../research/catalogo_tipografico.json', import.meta.url), 'utf8'))
  .fontes.filter((f) => f.status === 'ativo').map((f) => f.familia)));

/** The three faces of the French ronde. NONE can be bundled — they are free for PERSONAL use only. */
const A_RONDE = Object.freeze(['Ronde Script', 'OPTIFrench-Script', 'Merveille']);

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
 * Is a family Playwrite? Asked by PREFIX and not by equality, on purpose: that is how an undeclared one («Playwrite IE»,
 * «Playwrite NG») is caught without having to be predicted by name.
 */
export function ehPlaywrite(familia) {
  return /^playwrite\b/i.test(familia.trim());
}

/** The packaged Playwrite families that are NOT `ativo` in the typographic catalogue (ADR-0176). */
export function playwriteForaDoCatalogo(familias, ativas = ATIVAS_DO_CATALOGO) {
  return familias.filter((f) => ehPlaywrite(f) && !ativas.has(f.trim()));
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

describe('ADR-0108 · o que viaja dentro do pacote', () => {
  it('⚠️ [Interface] o crivo está VIVO: lê famílias e ficheiros de verdade', () => {
    // The vacuum case, first for the usual reason: without it, the absence cases below would pass for having nothing to
    // examine. The proof is real code — the faces the repository bundles.
    expect(NA_PASTA.length, 'a pasta de fontes veio vazia — o caminho morreu').toBeGreaterThan(30);
    expect(referidos.length, 'nenhum `src` foi lido — a regex morreu').toBeGreaterThan(30);
    expect(familias, 'a família âncora não foi lida').toContain('Atkinson Hyperlegible');
  });

  it('⚠️ [Zero] NO Playwrite outside the catalogue\'s active families travels in the package (ADR-0176 erratum)', () => {
    expect(
      playwriteForaDoCatalogo(familias),
      'a packaged Playwrite the typographic catalogue does not mark `ativo`: the catalogue is the source of which fonts exist',
    ).toEqual([]);
  });

  it('⚠️ [Zero] NENHUMA face da ronde é empacotada — é uso PESSOAL, não distribuição', () => {
    expect(
      sinaisDeRonde(familias, NA_PASTA),
      'ronde no pacote: as três são gratuitas só para uso pessoal, e empacotá-las é distribuir o que não '
      + 'foi licenciado para distribuição (ADR-0012, mantido pelo ADR-0108 §3)',
    ).toEqual([]);
  });

  it('🔴 [Zero] a Clash Display NÃO é empacotada — a ITF Free Font License proíbe distribuí-la (ADR-0150)', () => {
    // ADR-0150 refused it «até a licença ser lida». It was read, and the wait became a refusal with a reason.
    expect(
      sinaisDeFontshareFechada(familias, NA_PASTA),
      'face Closed Source da Fontshare no pacote: a ITF FFL §02 proíbe distribuí-la por repositório, aplicação '
      + 'ou servidor público, e servi-la como fonte selecionável a terceiros — que é o que a engine faz',
    ).toEqual([]);
    // 📌 The pair: the detector SEES the family and the file, or the absence above would pass through blindness.
    expect(sinaisDeFontshareFechada(['Clash Display', 'Lexend'], ['clashdisplay-var.woff2', 'lexend-var.woff2']))
      .toEqual(['Clash Display', 'clashdisplay-var.woff2']);
  });

  it('✅ [Boundary] o PISO das oito só sobe — hoje são OITO, e a decisão está entregue', () => {
    // ⚠️ THIS IS THE CASE THAT TELLS THE TRUTH ABOUT THE STATE. A FLOOR records what has arrived and prevents going back:
    // lowering it requires someone writing it here by hand.
    const PISO = 8;
    const presentes = familias.filter((f) => AS_OITO.includes(f.trim()));
    expect(presentes.length, `o pacote PERDEU Playwrite: tinha ${PISO}, tem ${presentes.length}`)
      .toBeGreaterThanOrEqual(PISO);
    // ✅ The eight are delivered (one variable file per family), so the floor is EIGHT and asserted by equality: ADR-0108's
    // decision is delivered, not only recorded.
    expect(presentes.length, 'as oito são o piso: falta alguma').toBe(AS_OITO.length);
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

  /* ===================== 🎯 ADR-0108'S FOURTH GATE, and it changed shape when measured =====================
   *
   * #87 asked for «a CHEGADA POR DOWNLOAD de uma face fora das oito». ⚠️ **Building a download mechanism would be a
   * defect**, for three measured reasons, not laziness:
   *
   *   1. The game speaks **three languages** (`pt`, `en`, `es`), and ADR-0012 limits the roster by LANGUAGE: nobody can
   *      ask for a face outside it.
   *   2. An ON-DEMAND download is, in shape, a lazy fetch — a machine that never asked for that face does not have it,
   *      and without a network nothing happens. It is what nothing-comes-from-outside accuses.
   *   3. A gate over a mechanism whose TRIGGER cannot occur is born empty, and a gate that cannot turn red is one someone
   *      switches off.
   *
   * 🎯 SO WHAT IS ASSERTED IS THE RULE THE DOWNLOAD WOULD BE A CONSEQUENCE OF, and it measures today's tree: **no face is
   * OFFERED without a way to get it.** An undeclared Playwrite cannot enter the catalogue without a file or a remedy —
   * and the day someone wants to add one, this case forces them to build its arrival BEFORE offering it, which is the
   * right order.
   *
   * ⚠️ AND THIS IS NOT AN INVENTED RULE: it is the lesson `ui/fonts`' header records, paid for with entries that were
   * `.off` WITHOUT A FILE — «o menu oferecia-as e ninguém as podia obter». The invariant has TWO legs (bundled, or `off`
   * with an actionable remedy) and needs no third for system faces. */
  it('🎯 [Right] NENHUMA face é oferecida sem forma de a obter — empacotada, ou `off` com remédio', () => {
    const semSaida = [];
    for (const item of FONT_GROUPS.flatMap((g) => g.items)) {
      const empacotada = faceFamilies(item).some((f) => familias.includes(f.trim()));
      if (empacotada) continue;
      // The other leg: `off` with a key that RESOLVES in all three dictionaries. An `off` without a message is the grey
      // row that does not say what to do — the child loses the face and the adult does not know why.
      const remedio = item.off && [pt, en, es].every((d) => typeof d[item.off] === 'string' && d[item.off].length > 8);
      if (!remedio) semSaida.push(`${item.k} («${item.fam}»)`);
    }
    expect(
      semSaida,
      'face no catálogo que ninguém consegue obter: nem viaja no pacote, nem tem `off` com remédio nos três '
      + 'idiomas. É o defeito da `learningcurve` a voltar — o menu oferece, a criança escolhe, e o navegador '
      + 'cai na fonte seguinte da pilha sem nada o dizer. Se é uma Playwrite fora das oito, ela precisa da '
      + 'CHEGADA antes da oferta (ADR-0108 §2).',
    ).toEqual([]);

    // 📌 THE PAIR, without which the case passes vacuously: if the catalogue empties or the CSS stops being read, the list
    // of missing ones is empty for having nothing to measure. The same trap as the empty result.
    expect(FONT_GROUPS.flatMap((g) => g.items).length, 'o catálogo esvaziou — o caso mediria o nada')
      .toBeGreaterThanOrEqual(26);
  });

  it('[Right] a Playwrite the catalogue does not hold is refused — and one it holds as active is not', () => {
    // «Playwrite IE» was outside the ADR-0108 package; the catalogue marks it active, so it travels now. A name the
    // catalogue does not have is still caught by its prefix.
    expect(playwriteForaDoCatalogo(['Playwrite BR', 'Playwrite IE', 'Playwrite ZZ'])).toEqual(['Playwrite ZZ']);
    expect(playwriteForaDoCatalogo([...AS_OITO])).toEqual([]);
  });

  /* ===================== ADR-0108 §4 · THE RONDE OPTION SPEAKS, AND NAMES THE THREE =====================
   *
   * ADR-0012 decided the licence — the three faces are free for PERSONAL use only and are never bundled — and decided the
   * control: it stays DISABLED while none is present. This block holds what the option SAYS. A grey button with no
   * explanation teaches an adult the feature is broken, when it is one installation away.
   *
   * 🎯 AND THE RULE IS NAMING THE THREE, not the category. «Instale uma fonte ronde» is not actionable — an adult does not
   * act on a category — and it is exactly the form ADR-0108 refuses in writing. This block exists so the sentence cannot
   * slide there.
   *
   * ⚠️ AND IT IS WHAT SEPARATES THIS `.off` ENTRY FROM THOSE THE CATALOGUE REMOVED, which said «ainda não», which nobody can
   * resolve (the reason is written in `ui/fonts`' header). This one says what to do. Actionability is the difference, and
   * this gate measures it — without it, the next person removes the row citing the right comment for the wrong reason. */
  describe('ADR-0108 §4 · a opção desabilitada nomeia as três faces', () => {
    const RONDE = FONT_GROUPS.flatMap((g) => g.items).find((it) => it.k === 'ronde');

    it('[Vácuo] a entrada `ronde` existe no catálogo e está DESLIGADA', () => {
      expect(RONDE, 'a entrada da ronde saiu do catálogo — o ADR-0108 §4 ficou sem sujeito').toBeTruthy();
      expect(RONDE.off, 'a ronde ficou selecionável: as três faces não podem ser empacotadas').toBeTruthy();
      // 📌 `geral` and not `caligrafica`, although it is calligraphic: the menu filters out the calligraphic ones, and a
      // filtered row says nothing to anyone. The «right» role would erase the only thing it does.
      expect(RONDE.role, 'a ronde foi marcada como caligráfica e desapareceu do menu').toBeUndefined();
    });

    it('🎯 [Right] a mensagem nomeia AS TRÊS, nos três idiomas', () => {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        const msg = dic[RONDE.off];
        expect(msg, `${nome}: a chave \`${RONDE.off}\` não existe no dicionário`).toBeTruthy();
        for (const face of A_RONDE) {
          expect(msg, `${nome}: a mensagem não nomeia «${face}»`).toContain(face);
        }
      }
    });

    /* 🎯 ADR-0012'S «ENQUANTO». The record says the control stays disabled «enquanto nenhuma fonte estiver presente» —
     * which implies STOPPING being disabled when one is. Without this the option would never enable: the adult followed the
     * instruction, installed the face, and the row stayed grey telling them to install what they had just installed. */
    it('🎯 [Right] com UMA das três instalada, a face fica disponível', () => {
      const so = (alvo) => (f) => f === alvo;
      for (const face of A_RONDE) {
        expect(faceAvailable(RONDE, so(face)), `${face} instalada e a ronde continua indisponível`).toBe(true);
      }
    });

    it('⚠️ [Zero] sem nenhuma das três, continua indisponível — e SEM detector também', () => {
      expect(faceAvailable(RONDE, () => false)).toBe(false);
      // 📌 The default without a detector is «indisponível», and it is safe for a reason that does not hold for every
      // default in this repository: the row stays disabled WITH the message, and the message is actionable.
      expect(faceAvailable(RONDE, undefined)).toBe(false);
    });

    it('📌 [Boundary] uma face que NÃO é `off` está disponível sem detector nenhum', () => {
      // The pair that keeps the rule from becoming «tudo depende do detector»: the other faces never depended on it.
      const atkinson = FONT_GROUPS.flatMap((g) => g.items).find((it) => it.k === 'atkinson');
      expect(faceAvailable(atkinson, undefined)).toBe(true);
      expect(faceAvailable(atkinson, () => false)).toBe(true);
    });

    it('⚠️ [Interface] a PILHA de três é lida como três famílias, não como uma', () => {
      // The ronde's `fam` is `'Ronde Script, OPTIFrench-Script, Merveille'`. Treating it as a single name would do
      // `check('16px "Ronde Script, OPTIFrench-Script, Merveille"')` — which always returns false, and the option would
      // never enable however many fonts the adult installed.
      expect(faceFamilies(RONDE)).toEqual(A_RONDE);
    });

    it('⚠️ [Right] e uma frase que nomeia a CATEGORIA reprovaria — a forma que o ADR-0108 recusa', () => {
      // The rule as a function, driven by a fixture: without this the case above would pass because today's sentence is
      // right, and nothing would say the WRONG one is detectable. It is the wording the record rejects, word for word.
      const nomeiaAsTres = (texto) => A_RONDE.every((f) => texto.includes(f));
      expect(nomeiaAsTres('Instale uma fonte ronde no aparelho.')).toBe(false);
      expect(nomeiaAsTres('Instale Ronde Script, OPTIFrench-Script ou Merveille.')).toBe(true);
      // ⚠️ AND TWO OF THE THREE ARE NOT ENOUGH: whoever has only the other one reads a list that does not serve them.
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
// Six, each applied by script to the file with occurrence counts (=1 in all six).
//   · `ehPlaywrite` always returning false -> the NINTH fails. Without it the sieve stops recognising the family it
//     exists to recognise, and approves anything.
//   · `playwriteForaDasOito` ignoring `AS_OITO` -> the NINTH fails from the other side: it also accuses the ones that MUST
//     travel, and a gate that accuses the correct is switched off the following week.
//   · `sinaisDeRonde` without the FILES half -> the ronde case fails. The two doors are different: a `.woff2` dropped in
//     the folder without `@font-face` is still distributed, and distributing is what the licence does not allow.
//   · killing the FAMILIES regex -> the VACUUM case fails, and only it. Without that case, the two `[Zero]`s would pass
//     for having nothing to examine.
//   · killing the `src` regex -> TWO fail: the vacuum and the DEAD WEIGHT. The second is the measure that it is alive —
//     with no `src` read, every file looks unreferenced.
//   · ⚠️ pointing a REAL `src` of `fonts.css` at a file that does not exist -> TWO fail, not one: the ORPHAN (the face the
//     browser fetches and does not find) and the DEAD WEIGHT (the file left with nobody declaring it). Applied to the
//     real asset and restored from a copy. Both failures are silent in production: the browser falls to the next font
//     in the stack, and the child who needs Andika to read gets something else with nothing saying so.
//
// ===== MUTATIONS OF THE FOURTH GATE (2026-09-09) =====
//  N1. a NINTH Playwrite in the catalogue with no file or remedy (`{k:'pwie', fam:'Playwrite IE', …}` — Ireland, which
//      is English, so INSIDE the roster by language) -> fails, and fails ALONE. 🎯 That loneliness is the measure of the
//      hole: the existing «uma NONA Playwrite reprova» case drives the PURE half with a fixture, so it stayed GREEN with
//      the ninth really in the catalogue. One asserts the function can tell; the other asserts the tree has none. They
//      are not the same, and only the second catches the offer.
//  N2. the ronde losing its `off` -> FOUR fail. The face stops being unbundled-with-a-message and says nothing, which is
//      exactly the removed `learningcurve` back: the menu offers and nobody can get it.
