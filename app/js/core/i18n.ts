// SPDX-License-Identifier: AGPL-3.0-or-later
// core/i18n — internationalisation.
// The default language (pt) is a STATIC import, so its dictionary is ready before anything renders (a synchronous boot).
// The others load on demand when the language changes, as their own chunks (see the loaders below).
import pt from '../i18n/pt.js';

type LocaleDict = Record<string, string>;

const AVAILABLE = ['pt', 'en', 'es'];
const base: LocaleDict = pt;                // the base dictionary (fallback), typed
const DICTS: Record<string, LocaleDict> = { pt: base }; // dictionaries already loaded (pt built in)
/**
 * The port the chosen language is kept through (ADR-0178): `platform/storage` has this shape.
 *
 * 🔴 AND IT CARRIES THE BROWSER TOO, since 2026-09-22 (ADR-0221 step 7g). This module used to write
 * `document.documentElement.lang`, dispatch on `window` and read `navigator.language` — three reaches into globals from
 * `core`, the layer ADR-0173 defines as «what the engine IS, without a browser». The health ratchet measured them (step 7d)
 * and the Dev chose to split rather than to move the module: the decisions stay here, the page effects arrive as two
 * optional hooks that `platform/locale-host` builds and the composition root passes in.
 *
 * ⚠️ Both are OPTIONAL, and absent they mean «no page to tell»: a node test, a worker, a second engine in the same process.
 * Before this split those three lines threw there instead.
 */
export interface LocalePort {
  get(key: string, fallback: string | null): string | null;
  set(key: string, value: string): unknown;
  readonly KEYS: { readonly lang: string };
  /** What the HOST does once a language is kept: `<html lang>`, re-translating the markup, telling the page. */
  readonly applied?: (locale: string, tag: string) => void;
  /** The language the host prefers when nothing is stored (the browser's `navigator.language`). */
  readonly preferred?: () => string | null;
}
let localePort: LocalePort | null = null;
/** Gives this module the port for the chosen language; the composition root calls it before `initI18n`. */
export function loadLocale(p: LocalePort): void { localePort = p; }

/* ===================== THE DICTIONARY OF WHOEVER CONSUMES THE ENGINE =====================
 *
 * ⚠️ FROM OUTSIDE, THE ENGINE'S DICTIONARIES ARE A WALL. The locales are resolved AT THIS ENGINE'S BUILD, against THIS
 * folder. A game that installs `@the-inclusionist/engine` cannot put a file in there, and `DICTS` is private. Without
 * this layer it would have NO way to its own keys — and pillar 3 makes no exception for a consumer.
 *
 * A SEPARATE LAYER, and not `DICTS[code] = {...DICTS[code], ...extra}`: `DICTS.pt` IS the object imported from
 * `../i18n/pt.ts`. Merging there would mutate the engine's own dictionary, and two games on the same page would inherit
 * each other's strings. `tests/i18n-consumer-dict.node.test.js` pins exactly that.
 */
const EXTRA: Record<string, LocaleDict> = {};

/**
 * Registers THIS game's keys for a language. Callable before the language exists — whoever registers `en` before any
 * `setLocale('en')` is served when the switch happens.
 *
 * ⚠️ IT DOES NOT RE-APPLY THE DOM, on purpose. `applyDom` needs a ROOT, and reaching the global `document` under the
 * caller's feet is a defect that already cost one fix. A consumer registering after the static markup was translated
 * calls `applyDom(root)` itself — and the normal case is to register at boot, before any text is on screen.
 */
export function registerDict(code: string, entries: LocaleDict): string[] {
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
  EXTRA[code] = { ...EXTRA[code], ...accepted };
  return refused;
}

/**
 * THE KEYS A CARTRIDGE REGISTERED IN ONE OF THE THREE LANGUAGES AND NOT IN ANOTHER (study item E4; ADR-0010 pillar 3),
 * one line per missing language, for `problems`. 📏 Measured: the games that register a dictionary do it in pt, en and es,
 * and nothing checked it — a key forgotten in one language shows Portuguese there, and nobody is told.
 * A cartridge that registered nothing is not accused: strings it never gave the engine, the engine cannot see.
 */
export function dictionaryGaps(): string[] {
  const registered = new Set<string>();
  for (const code of AVAILABLE) for (const key in EXTRA[code] ?? {}) registered.add(key);
  if (!registered.size) return [];
  const SHOW = 5;
  const gapLines: string[] = [];
  for (const code of AVAILABLE) {
    const missing = [...registered].filter((key) => !(key in (EXTRA[code] ?? {})));
    if (!missing.length) continue;
    const rest = missing.length > SHOW ? ` (and ${missing.length - SHOW} more)` : '';
    gapLines.push(`the cartridge's dictionary lacks ${code} for ${missing.slice(0, SHOW).join(', ')}${rest}: `
      + `a child playing in ${code} reads the fallback there (registerDict)`);
  }
  return gapLines;
}

/**
 * Does a string carry markup?
 *
 * ⚠️ WHY THIS LIVES HERE, AND NOT IN THE ~15 SINKS THAT CONSUME i18n. The gate `tests/i18n-without-markup.node.test.js`
 * sweeps THIS tree's dictionaries and proves no entry has a tag. It does not reach — and cannot reach — `EXTRA`: those
 * are strings a GAME registers at run time, from another repository (ADR-0083), and a test in this tree never sees them.
 *
 * ⚠️ AND THEY WIN OVER THE ENGINE'S DICTIONARY. The resolver looks at `EXTRA` first, so a game can override ANY key —
 * including the ones the engine pastes into markup. Without this check "i18n" would have stopped meaning "text someone
 * in this tree reviewed", and nothing would record the change.
 *
 * The check sits at the BOUNDARY and not in the sinks because the boundary is ONE: every string from a game passes
 * here. Fifteen sinks would be fifteen places to forget, and forgetting leaves no trace.
 *
 * The sieve is deliberately coarse — `<` followed by a letter or a slash, and `&` of an entity. Does it refuse `a < b`
 * written with a space? No: `< ` does not match. "5<10"? No, the digit does not match. What it refuses is what looks
 * like a tag, and an interface sentence that needs one needs another sentence.
 */
function hasMarkup(value: string | undefined): boolean {
  return typeof value === 'string' && (/<[a-zA-Z/!?]/.test(value) || /&[a-zA-Z#][a-zA-Z0-9]*;/.test(value));
}

/**
 * The resolution chain, in five steps. It MIRRORS the one that already existed (`locale → pt → the key itself`), with
 * the consumer glued to each step instead of stacked on top:
 *
 *   1. consumer in the current language · 2. engine in the current language ·
 *   3. consumer in pt · 4. engine in pt · 5. the key itself
 *
 * Step 3 is what keeps a game that only wrote pt READABLE when the child switches to English: they read Portuguese,
 * exactly as they already do when the engine lacks a key. Degrading beats going quiet, the same choice the silent
 * `.catch` in `initI18n` makes for a chunk that does not load.
 *
 * Step 2 coming BEFORE step 3 is the only defensible order: the engine's right language is worth more than the
 * consumer's wrong one. Inverting it would show Portuguese in a Spanish interface that had the translation to hand.
 */
function resolveKey(key: string, extra: Record<string, LocaleDict> = EXTRA): string {
  const fromGame = extra[locale];
  if (fromGame && key in fromGame) return fromGame[key];
  if (key in dict) return dict[key];
  const fromGameInPt = extra.pt;
  if (fromGameInPt && key in fromGameInPt) return fromGameInPt[key];
  return key in base ? base[key] : key;
}

/* ===================== THE LOADERS, AND WHY THEY ARE NOT A GLOB =====================
 *
 * This used to be `import.meta.glob('../i18n/*.ts')`. ⚠️ In the PACKAGE build (`tsc -p tsconfig.pkg.json`) that line
 * survives the emit intact, and there it is false twice over:
 *   · `tsc` is not Vite: it copies `import.meta.glob(...)` as an ordinary call. In a consumer that does not transform
 *     the module, `import.meta.glob` is `undefined` and the call blows up on load.
 *   · And even transformed, the pattern says `*.ts` — next to the EMITTED file there are only `.js` files. The glob
 *     would match nothing, `ensure()` would fall to `return base`, and every language but pt would become Portuguese
 *     WITHOUT ANY ERROR — the silent failure mode this project already paid for once.
 *
 * ENUMERATED, THEN — and it costs little: the glob swept three files that `AVAILABLE` above ALREADY lists. Code
 * splitting is not lost either, because what Vite splits is the dynamic `import()`, which stays: `en` and `es` still
 * ship as their own chunks, and a child who stays in pt never evaluates them. The one cost is three lines to keep by
 * hand the day a fourth language arrives — the same day and the same file as `AVAILABLE`. */
const loaders: Record<string, () => Promise<{ default: LocaleDict }>> = {
  en: () => import('../i18n/en.js'),
  es: () => import('../i18n/es.js'),
};

let locale = 'pt';
let dict: LocaleDict = base;

/** What a module that only TRANSLATES receives (ADR-0232 D3): a key and its `{param}`s in, the text of the page's language out. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Interpolates `{param}` into a resolved string. */
function interpolate(s: string, params?: Record<string, string | number>): string {
  if (params) for (const k in params) s = s.replaceAll('{' + k + '}', String(params[k]));
  return s;
}

// Translates a key; the fallback chain is in `resolveKey()` above. Interpolates {param}.
export function t(key: string, params?: Record<string, string | number>): string {
  return interpolate(resolveKey(key), params);
}

export function getLocale(): string { return locale; }

/**
 * THE BCP-47 TAG OF THE CURRENT LANGUAGE — what `<html lang>` says and what the browser's speech and recognition are given.
 *
 * Each language carries the REGION its flag stands for (the Dev, 2026-09-16: «Brasil, Estados Unidos e México. Cada bandeira indica a
 * localização para qual o app está configurado»): pt-BR, en-US, es-MX. It was pt-BR with `en` and `es` bare, so the browser picked the
 * variant; the language button now states the place. Voices are still matched on the language alone (`voicesForLocale`), so a region
 * narrows nothing a child can hear.
 */
const REGION_OF: Readonly<Record<string, string>> = { pt: 'pt-BR', en: 'en-US', es: 'es-MX' };
export function bcp47(code: string = locale): string { return REGION_OF[code] ?? code; }
function availableLocales(): string[] { return AVAILABLE.slice(); }

// Applies the declarative translations of the markup: [data-i18n] → textContent; [data-i18n-aria] → aria-label.
function applyDom(root: ParentNode): void {
  root.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = t(k); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', t(k)); });
}

async function ensure(code: string): Promise<LocaleDict> {
  if (DICTS[code]) return DICTS[code];
  const load = loaders[code];
  if (!load) return base; // a language with no file → falls back to pt
  const mod = await load();
  DICTS[code] = mod.default;
  return DICTS[code];
}

// Switches the language (loading on demand), keeps it, and hands the page effects to the host.
export async function setLocale(code: string): Promise<void> {
  // first, before anything changes: a language switched and then refused would leave the page half moved (ADR-0178)
  const port = localePort;
  if (!port) throw new Error('core/i18n: setLocale kept a language before loadLocale — the composition root loads the stored settings first (ADR-0178)');
  if (!AVAILABLE.includes(code)) code = 'pt';
  dict = await ensure(code);
  locale = code;
  port.set(port.KEYS.lang, code);
  // 📌 The three page effects — `<html lang>`, re-translating the markup, telling the page — in ONE call to the host, which
  // is what keeps this module free of `document` and `window` (ADR-0173, ADR-0221 step 7g).
  port.applied?.(locale, bcp47(code));
  // and then every translator's listeners, each root's through its own disposing door (ADR-0232 D3, ADR-0220)
  for (const listener of [...changeListeners]) { try { listener(locale); } catch { /* a listener failed; the language changed */ } }
}

/** Who hears a language change — the PAGE's, as the language is (ADR-0232 D3 erratum): each translator subscribes here. */
const changeListeners = new Set<(locale: string) => void>();

function pickDefault(): string {
  const saved = localePort ? localePort.get(localePort.KEYS.lang, null) : null;
  if (saved && AVAILABLE.includes(saved)) return saved;
  const nav = ((localePort?.preferred?.() || 'pt').slice(0, 2)).toLowerCase();
  return AVAILABLE.includes(nav) ? nav : 'pt';
}

/** The promise of the load asked for at boot. Resolves at once when the language is pt (static dictionary). */
let pending: Promise<void> = Promise.resolve();

/**
 * Boot: applies pt (synchronously, so the page is never blank) and, if the preferred language is another, ASKS for the
 * switch — which is asynchronous, because the other locales are on-demand chunks.
 *
 * It still returns the locale synchronously and does NOT block on its own: whoever needs to wait calls `localeReady()`.
 *
 * `root` COMES IN instead of being read from the global: the composition root receives the host's document by
 * injection and had no way to pass it on while this line reached the global `document` under it. In a browser it is
 * the same; in the `node` project it is the difference between booting against a fake DOM and not booting.
 */
export function initI18n(root: ParentNode): string {
  applyDom(root);
  const def = pickDefault();
  // A silent `.catch` on purpose: a locale chunk that fails to load degrades to pt, and degrading is FAR better than
  // freezing the boot. Without it, an `await localeReady()` outside would bring the whole game down over the language.
  if (def !== 'pt') pending = setLocale(def).catch(() => { /* stays in pt */ });
  return locale;
}

/**
 * Resolves when the language chosen at boot has finished loading (at once, if it is pt).
 *
 * ========================= WHY THIS HAD TO EXIST =========================
 * When the language loaded LAST, after the HUD and the menus were built, pt cost nothing — and en/es cost half the
 * interface: `applyDom` fixes the STATIC markup (`data-i18n`), but what JavaScript builds had captured the pt text and
 * nobody rebuilt it. `t()` answered "City" and the button on screen said "Cidade".
 *
 * This answers the narrow question, which has one answer: the interface is not built before the language is known.
 * Switching language AT RUN TIME is a different question, answered by the redraw on `i18n:change` (ADR-0225).
 */
export function localeReady(): Promise<void> { return pending; }

/**
 * THE TRANSLATOR A ROOT BUILDS AND HANDS DOWN (ADR-0232 D3, and its erratum of docs dac7a6d).
 *
 * The LANGUAGE is the page's — `<html lang>` is one attribute, so two roots in two languages would tell a screen reader one
 * of them wrongly — and it stays in this module. What a translator adds is the root's side: its `t`, its markup pass, and
 * the subscription to a change that its root can release. A module that only translates receives the bare `t`; one that
 * reads or sets the language receives this object.
 */
export interface Translator {
  readonly t: Translate;
  /** The page's language code (`pt`, `en`, `es`). */
  readonly locale: () => string;
  /** The BCP-47 tag of a language, the page's by default — what speech and recognition are given. */
  readonly bcp47: (code?: string) => string;
  /** Switches the PAGE's language; every root on the page follows. */
  readonly setLocale: (code: string) => Promise<void>;
  /** Hears a language change; returns the release (the root passes this through its disposing door, ADR-0220). */
  readonly onChange: (react: (locale: string) => void) => () => void;
  /** Translates the declarative markup (`data-i18n`, `data-i18n-aria`) under `root`. */
  readonly applyDom: (root: ParentNode) => void;
  /** Resolves when the language chosen at boot has loaded. */
  readonly ready: () => Promise<void>;
  /** Registers a game's keys for a language; returns the refused ones (markup). */
  readonly registerDict: (code: string, entries: LocaleDict) => string[];
  /** The keys registered in one language and not another, for `problems` (study item E4). */
  readonly dictionaryGaps: () => string[];
}

/**
 * Builds a translator. ⚠️ TRANSITIONAL: it resolves against the page-wide game dictionary (`EXTRA`) that the module-level
 * `t` and `registerDict` still use, until every module receives its `t` from the root and each root keeps its own
 * dictionary (ADR-0232 D3, issue #207).
 */
export function createTranslator(): Translator {
  const tr: Translate = (key, params) => interpolate(resolveKey(key, EXTRA), params);
  const applyTo = (root: ParentNode): void => {
    root.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.getAttribute('data-i18n'); if (k) el.textContent = tr(k); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => { const k = el.getAttribute('data-i18n-aria'); if (k) el.setAttribute('aria-label', tr(k)); });
  };
  return {
    t: tr,
    locale: () => locale,
    bcp47,
    setLocale,
    onChange: (react) => { changeListeners.add(react); return () => { changeListeners.delete(react); }; },
    applyDom: applyTo,
    ready: () => pending,
    registerDict,
    dictionaryGaps,
  };
}

const i18n = { t, getLocale, availableLocales, applyDom, setLocale, initI18n, localeReady, registerDict };
export default i18n;
// 🔴 Exposing this on `window.__i18n` is not done here (ADR-0221 step 7g): hanging off a window is the job of whoever
// HAS one. `platform/locale-host.exposeI18n` does it, called by the root — and the object exposed is exactly this default.
