// SPDX-License-Identifier: AGPL-3.0-or-later
// core/i18n — internationalisation.
// The default language (pt) is a STATIC import, so its dictionary is ready before anything renders (a synchronous boot).
// The others load on demand when the language changes, as their own chunks (see the loaders below).
//
// 🔴 THIS MODULE HOLDS NO STATE (ADR-0232 D3, erratum of 2026-09-25). Everything that changes — the language in use, the
// dictionaries loaded, the game's own dictionary, who listens to a change, the boot's pending load, the port the choice is
// kept through — lives in the TRANSLATOR a composition root builds (`createTranslator`). What stays at module level is
// constant: the base dictionary, the list of languages, their loaders and their regions. Two roots on one page, or two
// test files, share nothing through this module.
import pt from '../i18n/pt.js';

/** One language's dictionary: a key and its text. */
type LocaleDict = Record<string, string>;

const AVAILABLE: readonly string[] = ['pt', 'en', 'es'];
const base: LocaleDict = pt;                // the base dictionary (fallback), typed

/** The languages a page can switch to — a constant, so it stays a function of the module (ADR-0232 D3). */
export function availableLocales(): string[] { return AVAILABLE.slice(); }

/**
 * The port the chosen language is kept through (ADR-0178): `platform/storage` has this shape.
 *
 * 🔴 AND IT CARRIES THE BROWSER TOO (ADR-0221 step 7g): the page effects arrive as optional hooks that
 * `platform/locale-host` builds and the composition root passes in, so `core` reaches no `document` or `window`.
 *
 * ⚠️ The hooks are OPTIONAL, and absent they mean «no page to tell»: a node test, a worker, a second engine in the same
 * process.
 */
export interface LocalePort {
  get(key: string, fallback: string | null): string | null;
  set(key: string, value: string): unknown;
  readonly KEYS: { readonly lang: string };
  /** What the HOST does once a language is kept: `<html lang>`, re-translating the markup, telling the page. */
  readonly applied?: (locale: string, tag: string) => void;
  /** The language the host prefers when nothing is stored (the browser's `navigator.language`). */
  readonly preferred?: () => string | null;
  /**
   * Hears a language ANOTHER root on the same page switched to — the page's signal to its host (`i18n:change`).
   * The LANGUAGE is the page's (`<html lang>` is one attribute), so every root follows it (ADR-0232 D3 erratum point 3).
   */
  readonly follow?: (react: (locale: string) => void) => void;
}

/** A game's dictionary, one entry per language: the translator's own layer (ADR-0232 D3), one per root. */
type GameLayer = Record<string, LocaleDict>;

/** Puts `entries` into `layer` for `code`, refusing what carries markup (see `hasMarkup`); returns the refused keys. */
function addEntries(layer: GameLayer, code: string, entries: LocaleDict): string[] {
  const refused: string[] = [];
  const accepted: LocaleDict = {};
  for (const key in entries) {
    if (hasMarkup(entries[key])) refused.push(key);
    else accepted[key] = entries[key]!;
  }
  if (refused.length) {
    // Loud, not silent: whoever wrote the string has to know it did not go in. Dropping it quietly would put the raw
    // key on screen with nothing explaining it, and that reads as an engine defect.
    try {
      console.error('[inclusionist] i18n: keys refused because they contain markup — ' + refused.join(', '));
    } catch { /* noop */ }
  }
  layer[code] = { ...layer[code], ...accepted };
  return refused;
}

/**
 * THE KEYS A CARTRIDGE REGISTERED IN ONE OF THE THREE LANGUAGES AND NOT IN ANOTHER (study item E4; ADR-0010 pillar 3),
 * one line per missing language, for `problems`. 📏 Measured: the games that register a dictionary do it in pt, en and es,
 * and nothing checked it — a key forgotten in one language shows Portuguese there, and nobody is told.
 * A cartridge that registered nothing is not accused: strings it never gave the engine, the engine cannot see.
 */
function gapsIn(layer: GameLayer): string[] {
  const registered = new Set<string>();
  for (const code of AVAILABLE) for (const key in layer[code] ?? {}) registered.add(key);
  if (!registered.size) return [];
  const SHOW = 5;
  const gapLines: string[] = [];
  for (const code of AVAILABLE) {
    const missing = [...registered].filter((key) => !(key in (layer[code] ?? {})));
    if (!missing.length) continue;
    const rest = missing.length > SHOW ? ` (and ${missing.length - SHOW} more)` : '';
    gapLines.push(`the cartridge's dictionary lacks ${code} for ${missing.slice(0, SHOW).join(', ')}${rest}: `
      + `a child playing in ${code} reads the fallback there (CreateGameOptions.dictionaries)`);
  }
  return gapLines;
}

/**
 * Does a string carry markup?
 *
 * ⚠️ WHY THIS LIVES HERE, AND NOT IN THE ~15 SINKS THAT CONSUME i18n. The gate `tests/i18n-without-markup.node.test.js`
 * sweeps THIS tree's dictionaries and proves no entry has a tag. It does not reach — and cannot reach — a game's own
 * dictionary: those are strings a GAME registers at run time, from another repository (ADR-0083), and a test in this tree
 * never sees them.
 *
 * ⚠️ AND THEY WIN OVER THE ENGINE'S DICTIONARY. The resolver looks at the game's dictionary first, so a game can override
 * ANY key — including the ones the engine pastes into markup. Without this check "i18n" would have stopped meaning "text
 * someone in this tree reviewed", and nothing would record the change.
 *
 * The check sits at the BOUNDARY and not in the sinks because the boundary is ONE: every string from a game passes here.
 *
 * The sieve is deliberately coarse — `<` followed by a letter or a slash, and `&` of an entity. `a < b` with a space and
 * "5<10" pass; what it refuses is what looks like a tag, and an interface sentence that needs one needs another sentence.
 */
function hasMarkup(value: string | undefined): boolean {
  return typeof value === 'string' && (/<[a-zA-Z/!?]/.test(value) || /&[a-zA-Z#][a-zA-Z0-9]*;/.test(value));
}

/* ===================== THE LOADERS, AND WHY THEY ARE NOT A GLOB =====================
 *
 * This used to be `import.meta.glob('../i18n/*.ts')`. ⚠️ In the PACKAGE build (`tsc -p tsconfig.pkg.json`) that line
 * survives the emit intact, and there it is false twice over: `tsc` copies `import.meta.glob(...)` as an ordinary call
 * (undefined in a consumer that does not transform the module), and the pattern says `*.ts` next to emitted `.js` files —
 * every language but pt would silently become Portuguese.
 *
 * ENUMERATED, THEN — and code splitting is not lost, because what Vite splits is the dynamic `import()`: `en` and `es`
 * still ship as their own chunks, and a child who stays in pt never evaluates them. The one cost is three lines to keep
 * by hand the day a fourth language arrives — the same day and the same file as `AVAILABLE`. */
const loaders: Readonly<Record<string, () => Promise<{ default: LocaleDict }>>> = {
  en: () => import('../i18n/en.js'),
  es: () => import('../i18n/es.js'),
};

/** What a module that only TRANSLATES receives (ADR-0232 D3): a key and its `{param}`s in, the text of the page's language out. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Interpolates `{param}` into a resolved string. */
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', String(params[k]));
  return s;
}

/**
 * THE BCP-47 TAG OF A LANGUAGE — what `<html lang>` says and what the browser's speech and recognition are given.
 *
 * Each language carries the REGION its flag stands for (the Dev, 2026-09-16: «Brasil, Estados Unidos e México. Cada bandeira indica a
 * localização para qual o app está configurado»): pt-BR, en-US, es-MX. Voices are still matched on the language alone
 * (`voicesForLocale`), so a region narrows nothing a child can hear. A translator answers it for the page's language.
 */
const REGION_OF: Readonly<Record<string, string>> = { pt: 'pt-BR', en: 'en-US', es: 'es-MX' };
export function bcp47(code: string): string { return REGION_OF[code] ?? code; }

/**
 * THE TRANSLATOR A ROOT BUILDS AND HANDS DOWN (ADR-0232 D3, and its errata).
 *
 * It holds everything that changes: the page's language as this root knows it, the dictionaries loaded, and the GAME's own
 * dictionary, which no other root on the page reads. A module that only translates receives the bare `t`; one that reads or
 * sets the language receives this object.
 */
export interface Translator {
  readonly t: Translate;
  /** The page's language code (`pt`, `en`, `es`). */
  readonly locale: () => string;
  /** The BCP-47 tag of a language, the page's by default — what speech and recognition are given. */
  readonly bcp47: (code?: string) => string;
  /** Switches the PAGE's language; every root on the page follows (through the port's `follow`). */
  readonly setLocale: (code: string) => Promise<void>;
  /** Hears a language change; returns the release (the root passes this through its disposing door, ADR-0220). */
  readonly onChange: (react: (locale: string) => void) => () => void;
  /** Translates the declarative markup (`data-i18n`, `data-i18n-aria`) under `root`. */
  readonly applyDom: (root: ParentNode) => void;
  /**
   * Boot: translates `root` in pt (synchronously, so the page is never blank) and, if the stored or preferred language is
   * another, ASKS for the switch — asynchronous, because the other locales are on-demand chunks. Returns the locale now;
   * whoever needs to wait calls `ready()`. `root` comes in, never the global `document` (finding 15 of `boot/create-game`).
   */
  readonly init: (root: ParentNode) => string;
  /** Resolves when the language chosen at boot has loaded. */
  readonly ready: () => Promise<void>;
  /**
   * Registers a game's keys for a language IN THIS TRANSLATOR — its root's dictionary, which no other root on the page
   * reads (ADR-0232 D3 erratum); returns the refused ones (markup).
   */
  readonly registerDict: (code: string, entries: LocaleDict) => string[];
  /** The keys this translator's game registered in one language and not another, for `problems` (study item E4). */
  readonly dictionaryGaps: () => string[];
  /**
   * A WORD THE GAME DECLARED, by its key (ADR-0232 D3 erratum of 2026-09-25): resolved in the page's language from THIS
   * game's dictionary, falling back to its pt — and `null` when the game's dictionary has it in neither. Never the key: a
   * key on screen is an identifier in front of a child. Whoever draws decides what an absent word means (a row not drawn).
   */
  readonly word: (key: string) => string | null;
  /** Does this game's dictionary have `key` in any language? What `problems` asks of every declared key. */
  readonly declares: (key: string) => boolean;
}

/**
 * Builds a translator. `port` keeps the chosen language and tells the page (ADR-0178); without one there is no page to tell
 * and nothing to keep, and `setLocale` refuses — a test that only translates needs none.
 */
export function createTranslator(port?: LocalePort): Translator {
  let locale = 'pt';
  let dict: LocaleDict = base;
  /** Dictionaries already loaded (pt built in). */
  const loaded: Record<string, LocaleDict> = { pt: base };
  /** THIS game's dictionary. A separate layer and not a merge into `loaded`: `loaded.pt` IS the imported engine object. */
  const own: GameLayer = {};
  const listeners = new Set<(locale: string) => void>();
  let pending: Promise<void> = Promise.resolve();

  /*
   * The resolution chain, in five steps: 1. game in the current language · 2. engine in the current language · 3. game in pt ·
   * 4. engine in pt · 5. the key itself. Step 3 keeps a game that only wrote pt READABLE in English (degrading beats going
   * quiet); step 2 before step 3 because the engine's right language is worth more than the game's wrong one.
   */
  const resolveKey = (key: string): string => {
    const fromGame = own[locale];
    if (fromGame && key in fromGame) return fromGame[key]!;
    if (key in dict) return dict[key]!;
    const fromGameInPt = own.pt;
    if (fromGameInPt && key in fromGameInPt) return fromGameInPt[key]!;
    return key in base ? base[key]! : key;
  };
  const t: Translate = (key, params) => interpolate(resolveKey(key), params);

  const applyDom = (root: ParentNode): void => {
    root.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', t(k)); });
  };

  const ensure = async (code: string): Promise<LocaleDict> => {
    if (loaded[code]) return loaded[code];
    const load = loaders[code];
    if (!load) return base; // a language with no file → falls back to pt
    const mod = await load();
    loaded[code] = mod.default;
    return loaded[code];
  };

  const tellListeners = (): void => {
    for (const listener of [...listeners]) { try { listener(locale); } catch { /* a listener failed; the language changed */ } }
  };

  const setLocale = async (requested: string): Promise<void> => {
    // first, before anything changes: a language switched and then refused would leave the page half moved (ADR-0178)
    if (!port) throw new Error('core/i18n: setLocale on a translator without a port — the composition root builds it with the stored settings (ADR-0178)');
    const code = AVAILABLE.includes(requested) ? requested : 'pt';
    dict = await ensure(code);
    locale = code;
    port.set(port.KEYS.lang, code);
    // 📌 The three page effects — `<html lang>`, re-translating the markup, telling the page — in ONE call to the host, which
    // is what keeps this module free of `document` and `window` (ADR-0173, ADR-0221 step 7g).
    port.applied?.(locale, bcp47(code));
    tellListeners();
  };

  // 📌 ANOTHER ROOT SWITCHED THE PAGE: this one follows without keeping or telling again — the root that switched did both.
  port?.follow?.((code) => {
    if (code === locale || !AVAILABLE.includes(code)) return;
    void ensure(code).then((d) => { dict = d; locale = code; tellListeners(); });
  });

  const pickDefault = (): string => {
    const saved = port ? port.get(port.KEYS.lang, null) : null;
    if (saved && AVAILABLE.includes(saved)) return saved;
    const nav = ((port?.preferred?.() || 'pt').slice(0, 2)).toLowerCase();
    return AVAILABLE.includes(nav) ? nav : 'pt';
  };

  const init = (root: ParentNode): string => {
    applyDom(root);
    const def = pickDefault();
    // A silent `.catch` on purpose: a locale chunk that fails to load degrades to pt, and degrading is FAR better than
    // freezing the boot. Without it, an `await ready()` outside would bring the whole game down over the language.
    if (def !== 'pt') pending = setLocale(def).catch(() => { /* stays in pt */ });
    return locale;
  };

  const word = (key: string): string | null => {
    const inLocale = own[locale];
    if (inLocale && key in inLocale) return inLocale[key]!;
    const inPt = own.pt;
    return inPt && key in inPt ? inPt[key]! : null;
  };

  return {
    t,
    locale: () => locale,
    bcp47: (code = locale) => bcp47(code),
    setLocale,
    onChange: (react) => { listeners.add(react); return () => { listeners.delete(react); }; },
    applyDom,
    init,
    ready: () => pending,
    registerDict: (code, entries) => addEntries(own, code, entries),
    dictionaryGaps: () => gapsIn(own),
    word,
    declares: (key) => Object.values(own).some((entries) => key in entries),
  };
}
