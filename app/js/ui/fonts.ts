// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/fonts.ts — the font catalogue (data) + index by key + loading/persisting the choice. A leaf module WITH NO IMPORTS:
// whoever stores comes in as a parameter (`FontStore`), in `resolveFontKey` and `persistFontKey` — so the decision of
// WHERE it is stored belongs entirely to the caller.

/**
 * A face's ROLE — the ADR-0012 amendment turned into data (issue #87).
 *
 * ⚠️ IT IS NOT THE SAME AS THE GROUP. The group (`sans`/`serif`/`hand`) is APPEARANCE and serves to read the list; the
 * role is WHERE THE FACE MAY BE USED, and it is a rule:
 *
 *   · `geral` — anywhere. The only ones the typography menu offers.
 *   · `caligrafica` — **only INSIDE school activities**, never in the HUD or menus, and so **not in the font menu**. They
 *     exist for the child to LEARN to read cursive, which is subject matter; using them as interface would hand the
 *     child the subject as an obstacle everywhere they only want to navigate.
 *   · `jogo` — the face the GAME uses in the HUD, the title and short arcade labels. Not in the menu either, for the same
 *     kind of reason: an 8-bit pixel face is drawn to say FEW words at a large size. As an interface face it contradicts
 *     the argument that makes Atkinson Hyperlegible the default — little differentiation between letters, a wide
 *     advance, no height variation. Right in a pixel-art game's HUD, wrong in a menu the child has to READ.
 *
 * ⚠️ AND THE CUT IS NOT THE `hand` GROUP. `pwbr` is there by appearance — it is the group's GENERAL face (ADR-0176) and
 * often recommended for dyslexia. Removing it from the menu would remove a legitimately accessible option. The good
 * definition is the list in #87 item 2, which names the handwriting faces by giving them a minimum size.
 */
export type FontRole = 'geral' | 'caligrafica' | 'jogo';

/**
 * THIS CHILD'S COUNTRY HAND, and the COLONISER's fallback when the country has none of its own (ADR-0150 §1).
 *
 * 🎯 The rule is the Dev's and is truer than the one it replaced: ADR-0012 says the hand one learns to write is NATIONAL,
 * not linguistic, and never said what to do with nations without a face of their own. Falling back to what the United
 * States teaches was a default dressed as a country; the coloniser's hand is a true statement about how that child's
 * school taught them to write.
 *
 * 📌 AND THREE FACES CLOSE THE WHOLE GAP, because the repertoire is already limited to English, Portuguese and Spanish
 * (ADR-0012). That is what makes the truer rule also the cheapest to bundle.
 *
 * ⚠️ WHERE THE COUNTRY TEACHES TWO HANDS, IT RETURNS BOTH, in the Dev's order — the traditional first. That gives the
 * eleventh button's cycle SIX positions in those countries instead of five.
 */
const HAND_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = Object.freeze({
  BR: ['pwbr'],
  US: ['pwustrad', 'pwusmod'],   // the US teaches two, and choosing one would be choosing for the child
  GB: ['pwgbj', 'pwgbs'],        // joined and semi-joined
  ES: ['pwes', 'pwesdeco'],
  PT: ['pwpt'],
  CA: ['pwca'], MX: ['pwmx'], AR: ['pwar'], CL: ['pwcl'], CO: ['pwco'], CU: ['pwcu'], PE: ['pwpe'],
});

/** The fallback by LANGUAGE: the coloniser's hand. Three entries cover every country the repertoire admits. */
const HAND_BY_LANGUAGE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  es: ['pwes', 'pwesdeco'],
  pt: ['pwpt'],
  en: ['pwgbj', 'pwgbs'],
});

/** One position of the eleventh button's typography cycle: the CASE and the FACE, together (ADR-0149 §1). */
export interface TypographyStep {
  /** `upper` = UPPER CASE; `mixed` = upper and lower case. The values of `core/state.letterCase`. */
  readonly letterCase: 'upper' | 'mixed';
  /** The face's key in the catalogue. */
  readonly font: string;
  /**
   * This position's size multiplier — 1 on the reading faces, **1.25 on the country hand** (ADR-0149 §1).
   *
   * 🔴 NOT A PREFERENCE, IT IS THE LEGIBILITY FLOOR ALREADY MEASURED. The Playwrite faces declare `minPx: 20` (ADR-0012
   * amendment): below it the face stops being DIFFICULT and becomes ILLEGIBLE — difficulty is the exercise, illegibility
   * is the child giving up. The document's base is 16 px, and 16 × 1.25 = 20 — the multiplier IS the floor, written as a
   * ratio instead of a loose number.
   */
  readonly scale: number;
}

/** The country hand's increase. Named so the gate can assert it against `minPx` instead of repeating it. */
export const HANDWRITING_SCALE = 1.25;
/** The document's base, in px — the `font-size` of `html,body`. The floor comes from multiplying it by the scale. */
export const BASE_EM_PX = 16;

/**
 * THE ELEVENTH BUTTON'S CYCLE — five positions, or six where the country teaches two hands (ADR-0149 §1, ADR-0150 §2).
 *
 * 🎯 EACH STEP CHANGES THE CASE **AND** THE FACE, and that is the whole decision: `letterCase` (`core/state`, ADR-0028)
 * and the face are two settings, but Andika in upper case is ONE pedagogical choice of whoever teaches literacy, not
 * two. A child should not have to know the model to make it.
 *
 * 📌 IT STARTS AT ATKINSON, which is position (c) and the project's default. The cycle is a ring: from it, one press goes
 * to Lexend and the last goes back to the start.
 *
 * ⚠️ THE COUNTRY HAND MAY NOT EXIST — a tag with no region and a language outside the repertoire returns nothing. Then the
 * cycle has FOUR positions, which is the right answer: one position fewer is better than one showing the hand of a
 * country that is not that child's.
 *
 * 🔴 ARASAAC AND PCS ARE NOT POSITIONS, a decision and not an oversight: ADR-0155 §3 says to skip them — while the licence
 * does not allow, the cycle neither stops on them nor announces them. A position existing only to be skipped would be
 * data with no reader; they enter the day they work.
 */
export function typographyCycle(tag: string | null | undefined): readonly TypographyStep[] {
  const hands = handsForTag(tag);
  return Object.freeze([
    { letterCase: 'upper', font: 'andika', scale: 1 } as const,   // (a) the literacy pair
    { letterCase: 'mixed', font: 'andika', scale: 1 } as const,   // (b)
    { letterCase: 'mixed', font: 'atkinson', scale: 1 } as const, // (c) the default — the cycle starts here
    { letterCase: 'mixed', font: 'lexend', scale: 1 } as const,   // (d)
    // (e), and (f) where the country teaches two. ⚠️ 25% LARGER, and the number is not taste: the document's base is
    // 16 px, the Playwrite faces declare `minPx: 20`, and 16 × 1.25 is exactly 20. The scale IS the floor.
    ...hands.map((face) => ({ letterCase: 'mixed', font: face, scale: HANDWRITING_SCALE } as const)),
  ]);
}

/** The index where the cycle STARTS — position (c). Named so the gate can assert it without recounting. */
export const CYCLE_START = 2;

/**
 * The handwriting font keys for a BCP-47 tag — `pt-BR` → `['pwbr']`, `es-MX` → `['pwmx']`.
 *
 * ⚠️ IT READS THE REGION AND THEN THE LANGUAGE, in that order, and the forgotten case is the tag WITHOUT a region: `en`
 * alone names no country, and falling back is the right answer — not an error, a child whose browser did not say where
 * they are.
 *
 * 📌 It returns a LIST and not one face: where the country teaches two hands, both enter the cycle.
 * 📌 It returns NOTHING for a language outside the repertoire, and nothing is sayable: the caller drops the position
 * from the cycle instead of showing a hand that is nobody's.
 */
export function handsForTag(tag: string | null | undefined): readonly string[] {
  if (!tag) return [];
  const parts = String(tag).split('-');
  const language = (parts[0] ?? '').toLowerCase();
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  if (region && HAND_BY_COUNTRY[region]) return HAND_BY_COUNTRY[region]!;
  return HAND_BY_LANGUAGE[language] ?? [];
}

/**
 * A catalogue font. `fam` is the FONT'S NAME — a proper noun, never translated. `d` holds the i18n KEY of the description,
 * not the text: the same decision as `VIZ_MODES` and `RM_LABEL`, for the same reason — a `const` table of text resolves
 * once, on import, and stays frozen in the boot language.
 */
export type FontItem = {
  /** The face's `id` in `catalogo_tipografico.json` (ADR-0176): the key that holds it to the catalogue's status, layer, floor and coverage. */
  id: string;
  k: string; fam: string; fb: string; d?: string; off?: string;
  /** Absent = `geral`. Only the handwriting faces declare it, because they are the exception. */
  role?: FontRole;
  /**
   * The smallest size, in px, at which this face is still legible (#87 item 2, the Dev's numbers).
   *
   * ⚠️ Below it the face stops being DIFFICULT and becomes ILLEGIBLE, which are different things: difficulty is the
   * exercise, illegibility is the child giving up. That is why it is a gate and not a recommendation.
   */
  minPx?: number;
};
/** A catalogue group. `g` holds a KEY too ('font.group.sans'), for the same reason. */
export type FontGroup = { g: string; items: FontItem[] };
export const FONT_GROUPS: FontGroup[] = [
  {g:'font.group.sans', items:[
    {k:'atkinson', id:'atkinson_hyperlegible',   fam:'Atkinson Hyperlegible', fb:'sans', d:'font.desc.atkinson'},
    {k:'lexend', id:'lexend',     fam:'Lexend',                fb:'sans', d:'font.desc.lexend'},
    {k:'quattro', id:'ia_writer_quattro',    fam:'iA Writer Quattro',     fb:'sans', d:'font.desc.quattro'},
    {k:'andika', id:'andika',     fam:'Andika',                fb:'sans', d:'font.desc.andika'},
    // ⚠️ OPENDYSLEXIC IS OFFERED WITH NO CLAIM OF EFFICACY — issue #87 item 3 and `docs/game-design/typography.md`: offer
    // Dyslexie and OpenDyslexic only as a user's choice, because research shows no reading gain from them. Its description
    // speaks of the DESIGN (heavy stems at the bottom), never of the effect — promising better reading would sell a
    // dyslexic child something the evidence does not support, and they are who can least afford it.
    {k:'opendyslexic', id:'opendyslexic', fam:'OpenDyslexic',       fb:'sans', d:'font.desc.opendyslexic'},
    {k:'sourcesans', id:'source_sans_3', fam:'Source Sans 3',         fb:'sans'},
    {k:'inter', id:'inter',      fam:'Inter',                 fb:'sans'},
    {k:'opensans', id:'open_sans',   fam:'Open Sans',             fb:'sans'},
    {k:'lato', id:'lato',       fam:'Lato',                  fb:'sans'},
    // ⚠️ THE FOUR ROUNDED FACES are here at the Dev's request, WITHOUT a description on purpose: a `d` exists when there
    // is something to say the name does not — Atkinson has one because the Braille Institute designed it for this,
    // OpenDyslexic because its description has to speak of the DESIGN and never the effect. Rounded is not a claim, it is
    // what you see.
    //
    // 📌 `geral` (implicit role): interface faces, neither handwriting nor game — so they follow the BDA spacing ADR-0149
    // §2 generalises, and appear in the typography menu like the others.
    //
    // ⚠️ `Fredoka` AND NOT "Fredoka One": that is the legacy name. Google publishes the variable family as `Fredoka`; the
    // old static one was its 600 weight. See the matching block in `fonts.css`.
    {k:'fredoka', id:'fredoka',    fam:'Fredoka',               fb:'sans'},
    {k:'quicksand', id:'quicksand',  fam:'Quicksand',             fb:'sans'},
    {k:'nunito', id:'nunito',     fam:'Nunito',                fb:'sans'},
    {k:'teachers', id:'teachers',   fam:'Teachers',              fb:'sans'},
    /*
     * SEVEN MORE SANS FACES (ADR-0150, the Dev's request).
     *
     * 🔴 CLASH DISPLAY IS NOT HERE, and the absence is read, not forgotten: it is **not on Google Fonts** — it comes from
     * Fontshare (Indian Type Foundry), and `LICENSES.md` §3 requires the licence checked BEFORE bundling. Read, it FAILS:
     * it is «Closed Source» under the ITF Free Font License, whose §02 forbids distributing the file through a repository,
     * an application or a public server and serving it as a selectable font to third parties. The gate is in
     * `tests/fontes-empacotadas.node.test.js`.
     */
    {k:'robotoflex', id:'roboto_flex', fam:'Roboto Flex',           fb:'sans'},
    {k:'ubuntu', id:'ubuntu',     fam:'Ubuntu',                fb:'sans'},
    {k:'notosans', id:'noto_sans',   fam:'Noto Sans',             fb:'sans'},
    {k:'spacegrotesk', id:'space_grotesk', fam:'Space Grotesk',       fb:'sans', minPx:20},
    {k:'sora', id:'sora',       fam:'Sora',                  fb:'sans', minPx:20},
    {k:'jakarta', id:'plus_jakarta_sans',    fam:'Plus Jakarta Sans',     fb:'sans', minPx:20} ]},
    // ⚠️ NO COMFORTAA, by the Dev's decision: «ruim para dislexia». The reason is in the face — its near-geometric shapes
    // reduce the differentiation between letters, the very axis that makes Atkinson Hyperlegible this project's default.
    // Written down because a face that leaves no trace gets proposed again by the next person who thinks a rounded one is
    // missing.
  {g:'font.group.serif', items:[
    {k:'literata', id:'literata',    fam:'Literata',       fb:'serif'},
    {k:'sourceserif', id:'source_serif_4', fam:'Source Serif 4', fb:'serif'},
    {k:'newsreader', id:'newsreader',  fam:'Newsreader',     fb:'serif'},
    // Five READING faces: serifs for running text, like the three above.
    {k:'merriweather', id:'merriweather', fam:'Merriweather',  fb:'serif'},
    {k:'lora', id:'lora',        fam:'Lora',           fb:'serif'},
    {k:'spectral', id:'spectral',    fam:'Spectral',       fb:'serif'},
    {k:'domine', id:'domine',      fam:'Domine',         fb:'serif'},
    {k:'bitter', id:'bitter',      fam:'Bitter',         fb:'serif'},
    /*
     * ⚠️ THE FOUR DISPLAY FACES ARE SOMETHING ELSE, and come with the warning written instead of mixed with the reading
     * ones. Playfair Display, DM Serif Display, Fraunces and Bodoni Moda have HIGH CONTRAST — thick stems beside very thin
     * ones — and Bodoni is the extreme of the axis. It is exactly what Atkinson Hyperlegible was designed NOT to be, and at
     * small sizes the thin stems disappear first for whoever sees least.
     *
     * 📌 They stay, because OFFERING is not applying: the default is still Atkinson, and whoever picks one of these is
     * choosing. The defect would be the engine ADOPTING one by itself.
     * 🔴 And they are not for activity body text; a game using them for a long prompt is using a title face as a reading
     * face.
     */
    {k:'playfair', id:'playfair_display',    fam:'Playfair Display', fb:'serif', minPx:20},
    {k:'dmserifdisplay', id:'dm_serif_display', fam:'DM Serif Display', fb:'serif', minPx:20},
    {k:'fraunces', id:'fraunces',    fam:'Fraunces',       fb:'serif', minPx:20},
    {k:'bodonimoda', id:'bodoni_moda',  fam:'Bodoni Moda',    fb:'serif', minPx:20} ]},
  // ⚠️ NO `.off` ENTRY WITHOUT A FILE (issue #87 item 3): a row that only exists to say "not yet" is a row the child
  // reads and cannot use.
  {g:'font.group.hand', items:[
    {k:'pinyon', id:'pinyon_script',     fam:'Pinyon Script',       fb:'cursive', d:'font.desc.pinyon', role:'caligrafica', minPx:24},
    {k:'ufmag', id:'unifrakturmaguntia',      fam:'UnifrakturMaguntia',  fb:'cursive', d:'font.desc.ufmag',  role:'caligrafica', minPx:20},
    // Fondamento comes through the ADR-0012 amendment (#87 item 3) with the minimum the Dev set. Handwriting, so out of
    // the menu — it is for the buttons INSIDE school activities, not for the interface.
    {k:'fondamento', id:'fondamento', fam:'Fondamento',          fb:'cursive', d:'font.desc.fondamento', role:'caligrafica', minPx:20},
    /*
     * THE FRENCH RONDE — #87 item 4, decided in ADR-0108 §4. It is NEVER bundled: the three faces are free for PERSONAL
     * use only (ADR-0012), and distributing them would distribute what was not licensed for distribution. What the entry
     * does is SPEAK.
     *
     * ⚠️ AND IT IS NOT A "NOT YET" ROW. The difference is ACTIONABILITY, the reason ADR-0108 gives in full: a "not yet"
     * nobody can resolve; this names WHICH THREE FONTS TO INSTALL, which an adult resolves in an afternoon. 📌 "Install a
     * ronde font" would be the defect back — an adult does not act on a category —, which is why the message names all
     * three.
     *
     * ⚠️ `role` ABSENT, so `geral`, deliberately, although the ronde is handwriting by nature: handwriting faces are
     * filtered out of the menu (`fontRole === 'geral'`), and a filtered row can say nothing to anyone. Marking the
     * "right" role here would erase the one thing this entry exists to do.
     */
    /*
     * THE PLAYWRITE FACES — #87 item 3, decided in ADR-0108 §2.
     *
     * ⚠️ `role: caligrafica`, so OUT OF THE MENU: they are the hand one learns to write, for the buttons INSIDE school
     * activities, not an interface option.
     *
     * 📌 `minPx: 20` is the same floor the other cursive faces carry. #87's list of minimums does not name the
     * Playwrite — the number is its siblings', not a measurement of its own; correctable in one line.
     */
    // THE HANDWRITING GROUP'S GENERAL FACE (ADR-0176 §6, the Dev): in the menu, drawn at `minPx` by the face's scale.
    {k:'pwbr', id:'playwrite_br', fam:'Playwrite BR', fb:'cursive', d:'font.desc.pw.br', minPx:20},
    {k:'pwustrad', id:'playwrite_us_trad', fam:'Playwrite US Trad', fb:'cursive', d:'font.desc.pw.ustrad', role:'caligrafica', minPx:20},
    {k:'pwusmod', id:'playwrite_us_modern', fam:'Playwrite US Modern', fb:'cursive', d:'font.desc.pw.usmod', role:'caligrafica', minPx:20},
    {k:'pwca', id:'playwrite_ca', fam:'Playwrite CA', fb:'cursive', d:'font.desc.pw.ca', role:'caligrafica', minPx:20},
    {k:'pwmx', id:'playwrite_mx', fam:'Playwrite MX', fb:'cursive', d:'font.desc.pw.mx', role:'caligrafica', minPx:20},
    {k:'pwar', id:'playwrite_ar', fam:'Playwrite AR', fb:'cursive', d:'font.desc.pw.ar', role:'caligrafica', minPx:20},
    {k:'pwcl', id:'playwrite_cl', fam:'Playwrite CL', fb:'cursive', d:'font.desc.pw.cl', role:'caligrafica', minPx:20},
    {k:'pwco', id:'playwrite_co', fam:'Playwrite CO', fb:'cursive', d:'font.desc.pw.co', role:'caligrafica', minPx:20},
    /*
     * SEVEN MORE, and they exist by a RULE and not by taste (ADR-0150, the Dev's decision).
     *
     * 🎯 `pwes`, `pwpt` and `pwgbj` are the FALLBACK BY LANGUAGE: a country without its own Playwrite gets the
     * COLONISER's — Spanish → Spain, Portuguese → Portugal, English → England.
     * 📌 `pwcu` and `pwpe` were asked for by name; `pwesdeco` and `pwgbs` come through the other half of the rule: where
     * the country has more than one STROKE, both appear — like US Trad and US Modern.
     *
     * ⚠️ NO "GUIDES" FACES, by the Dev's decision: a `Playwrite XX Guides` is not a second stroke, it is the SAME stroke
     * with handwriting ruling on top. The engine does not use them; a game that needs them brings its own font.
     *
     * 🔴 AND THEY ARE BUNDLED, which REVOKES ADR-0108's P3. The newer decision is the Dev's, literally: «estas fontes
     * devem ser baixadas no primeiro dia para fazer parte do PWA». Written down because the old record still says the
     * opposite.
     */
    {k:'pwes', id:'playwrite_es', fam:'Playwrite ES', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwesdeco', id:'playwrite_es_deco', fam:'Playwrite ES Deco', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwpt', id:'playwrite_pt', fam:'Playwrite PT', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwgbj', id:'playwrite_gb_j', fam:'Playwrite GB J', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwgbs', id:'playwrite_gb_s', fam:'Playwrite GB S', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwcu', id:'playwrite_cu', fam:'Playwrite CU', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'pwpe', id:'playwrite_pe', fam:'Playwrite PE', fb:'cursive', role:'caligrafica', minPx:20},
    {k:'ronde', id:'ronde_script', fam:'Ronde Script, OPTIFrench-Script, Merveille', fb:'cursive',
      d:'font.desc.ronde', off:'font.off.ronde', minPx:18} ]},
  // ⚠️ THE GAME'S FACE has its own group because it is neither sans, nor serif, nor handwriting — it is a PIXEL face,
  // and putting it in any of the three would say the wrong thing about it in the list.
  //
  // It does NOT appear in the menu (`role:'jogo'`). See the `@font-face` note in `vendor/fonts.css`: the wrong subset of
  // this family loads, declares itself and reports as correct, and draws not a single Latin letter.
  {g:'font.group.arcade', items:[
    {k:'pressstart', id:'press_start_2p', fam:'Press Start 2P', fb:'monospace', d:'font.desc.pressstart', role:'jogo'} ]},
];

/**
 * How much larger the text is drawn with this face: enough to reach its `minPx` from the document's base, never smaller.
 * A face whose catalogue floor is above the base (a display sans, the handwriting) is offered at that size, not under it
 * (ADR-0176 §4, the catalogue's rule R2). The cycle's hand of the country is the same rule (`HANDWRITING_SCALE`).
 */
export function faceScale(it: FontItem): number { return Math.max(1, (it.minPx ?? BASE_EM_PX) / BASE_EM_PX); }

/** A face's role; absent in the catalogue means `geral`. */
export function fontRole(it: FontItem): FontRole { return it.role ?? 'geral'; }

/**
 * THE FAMILIES A FACE ACCEPTS, from a `fam` that may be a STACK.
 *
 * 📌 The Ronde declares three (`'Ronde Script, OPTIFrench-Script, Merveille'`) because any of them will do — three
 * drawings of the same hand, and an adult installs whichever they find. The other faces declare one, and for them this
 * returns a list of one.
 */
export function faceFamilies(it: FontItem): string[] {
  return it.fam.split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/**
 * CAN THIS FACE BE USED NOW? — `off` stops being a sentence and becomes a CONDITION.
 *
 * ADR-0012 decided the ronde option stays DISABLED WHILE no font is present, and ADR-0108 §4 added what it says. The word
 * "while" is what this function builds: an `off` face becomes available again the instant the adult installs one of the
 * ones the message names.
 *
 * ⚠️ THE DETECTOR IS INJECTED, and `document.fonts` is never read here: this module is the catalogue, it runs in node in
 * the gates, and reading a browser global here would be a boot waiting to crash against an injected document.
 * 📌 And the DEFAULT is not installed, which is safe for a reason that does not hold for every default in this repository:
 * with no detector the option stays disabled WITH the message, and the message tells the adult exactly what to do. The
 * silence decides nothing against the child — it keeps a state that already existed and is actionable.
 */
export function faceAvailable(it: FontItem, installed?: (family: string) => boolean): boolean {
  if (!it.off) return true;
  return !!installed && faceFamilies(it).some((f) => installed(f));
}

/** The faces the MENU may offer: only the general ones (ADR-0012 amendment). */
export const OFERECIVEIS: FontItem[] = FONT_GROUPS.flatMap((g) => g.items).filter((it) => fontRole(it) === 'geral');
export const FONT_BY_KEY: Record<string, FontItem> = {}; FONT_GROUPS.forEach((g) => g.items.forEach((it) => { FONT_BY_KEY[it.k] = it; }));

/** Narrow store shape these need — lets a caller inject a fake without touching real storage. */
export interface FontStore { get(key: string, fallback: string | null): string | null; set(key: string, v: string): void; }

const FONT_KEY = 'incl_font_k';
const FONT_KEY_LEGACY = 'incl_fonte'; // pre-Fase-2: 'alfabetizacao' | 'dislexia'

/**
 * The factory font, named. Atkinson Hyperlegible was designed by the Braille Institute precisely for low vision — it
 * tells apart the shapes most often confused (I/l/1, O/0). That is why it is the default and not an aesthetic preference,
 * and why typography's reset (ADR-0028) returns here: the way back from an accessibility menu has to end at the most
 * legible choice, not at any one. Used in TWO places — the end of the boot chain just below and the panel's reset —, and
 * a constant because two copies of a default are two chances for the reset to return something the game never used.
 */
export const DEFAULT_FONT_KEY = 'atkinson';

/**
 * Boot choice: validated persisted key (ignores .off fonts) -> legacy-key migration -> DEFAULT_FONT_KEY.
 *
 * ⚠️ AND A STORED HANDWRITING FACE GOES BACK TO THE DEFAULT (issue #87). A child may have one stored from when the menu
 * offered them, and a stored value is their choice, not ours to undo without a reason. The reason exists: the ADR-0012
 * amendment says a handwriting face **cannot be the interface face**, and the menu no longer offers it. Letting it stand
 * would give a whole interface in cursive to someone with no way out of it through the menu — a trap, and a silent one.
 *
 * ⚠️ AND A DELETED KEY GOES BACK TOO, by the same path: a face no longer in `FONT_BY_KEY` falls back to the default
 * instead of leaving the child with no face at all.
 */
export function resolveFontKey(s: FontStore): string {
  const k = s.get(FONT_KEY, null);
  if (k && FONT_BY_KEY[k] && !FONT_BY_KEY[k].off && fontRole(FONT_BY_KEY[k]) === 'geral') return k;
  const leg = s.get(FONT_KEY_LEGACY, null);
  if (leg === 'alfabetizacao') return 'andika';
  if (leg === 'dislexia') return 'lexend';
  return DEFAULT_FONT_KEY;
}
export function persistFontKey(s: FontStore, k: string): void { s.set(FONT_KEY, k); }

// ⚠️ `loadFontKey` AND `saveFontKey` ARE GONE (R3 of the plan, 2026-09-23): they were conveniences over
// `resolveFontKey` and `persistFontKey` — the same two lines with `store` already filled in — and NOBODY took
// them, not even a test. A shortcut nobody takes is not a convenience: it is published surface that asks whoever
// reads it to migrate.
