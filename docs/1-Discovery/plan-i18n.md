> Historical plan (2026-07-03): kept as a record; the current state lives in `app/js/core/i18n.ts` and the three dictionaries under `app/js/i18n/`, and the rule in pillar 3 of ADR-0010 (`the-inclusionist-docs`).

# Plan — Internationalization (i18n) and localization (l10n)

The Dev's request on 2026-07-03: the game needs to support several languages. Start with **pt-BR**, add
**English** and **Spanish** right away (the two languages of the BNCC), and in the future the commercial list
(Mandarin, Hindi, Indonesian, Japanese, Korean, French, German, Finnish). Integrated with the modularization
(`../5-Refactoring/plan-modularization.md`) — i18n becomes one of the first modules, because it touches everything.

---

## 1. The distinction that changes the scope: UI × curriculum

Translating **is not** localizing the pedagogical content. There are two very different layers:

- **Chrome / UI** (menus, buttons, ARIA labels, footers, HUD, messages): direct translation. Cheap per language.
- **Universal content** (Mathematics, Play): almost universal — only numbers/words and labels to translate.
- **Curriculum content (Literacy):** it is **language-specific curriculum**, not translation. The syllables
  of Portuguese (`ga`/`to`), Ferreiro's psychogenesis applied to PT words, the PT grapheme↔phoneme relation, the
  "write GATO" — **none of it maps** to English (which is phonic, not syllabic) or Spanish (its own
  syllabification). Localizing literacy = **authoring a new curriculum per language**, with pedagogical care.

**Recommendation:** localize **now** the UI + Mathematics + Play for pt/en/es; keep **Literacy in pt
only**, with the framework ready to receive per-language "curriculum packs", authored later (en with
*phonics*, es with *silabeo*). That way we deliver en/es for real without rushing wrong pedagogy.

## 2. Languages — recommendation (you said "I accept suggestions")

All the languages on your list are **LTR** (no RTL/bidi) — great, it simplifies. The cost has two axes:
**script/font** and **depth of content**. Grouped by effort:

| Wave | Languages | Cost | Notes |
|---|---|---|---|
| **0 (now)** | pt · en · es | low | BNCC + huge reach. Reuse the current accessible font stack (Atkinson/Andika/Lexend). |
| **1 (cheap, Latin)** | fr · de · id · fi | low | Indonesian is Latin script; Finnish is the *Work on Finland* "courtesy". Only UI JSON + TTS voice. |
| **2 (new script/font)** | ja · ko · zh-Hans · hi | **high** | They need dedicated webfonts (Noto Sans JP/KR/SC/Devanagari, **multi-MB**), per-script line breaking and accessible variants. Conflicts with the "lean/offline" pillar → **load the font only when the language is chosen**. Do it when there is demand/funding. |

The suggested order differs from the commercial one on purpose: Wave 1 is cheap UI wins; Wave 2 is a font
infrastructure project in itself. The commercial priority (Japan/Korea ARPU etc.) comes in as soon as the CJK
script infrastructure exists.

## 3. Architecture (no build, offline/PWA, ES Modules)

- **Module `app/js/core/i18n.js`** — API: `t(key, params?)`, `getLocale()`, `setLocale(code)`, `applyDom(root)`.
  Chained fallback: `locale → pt → the key itself`. Interpolation `{nome}`.
- **Language files as ES Modules** (not .json): `app/js/i18n/pt.js` → `export default { … }`.
  - The **default** language is a **static `import`** (resolved before game.js runs) → **synchronous boot, no async**
    (the game builds menus on load; avoids refactoring to an asynchronous init).
  - The others come in through **dynamic `import()`** when the language changes; they are cached by the SW.
  - Rationale: no-build + offline + zero fetch at boot. A translator edits a JS object (trivial).
- **Key namespaces:** `menu.*`, `title.*`, `pause.*`, `a11y.*` (dialogs), `hud.*`, `power.*`,
  `activity.<id>.{name,sub,footer}`, `content.*` (curriculum, per locale).
- **Static HTML** (`index.html`, ~100 strings): declarative attributes
  `data-i18n="menu.play"` (textContent) and `data-i18n-aria="a11y.gameRegion"` (aria-label). The i18n walks
  `[data-i18n]`/`[data-i18n-aria]` on load and on every language change.
- **Dynamic strings** (game.js): replace literals with `t('...')`; menus built by JS re-render on the
  change event.
- **Voice/TTS:** `localeVoice()` replaces `ptbrVoice()` — it picks the voice by the active locale (pt-BR, en-US/GB,
  es-ES/MX). It connects i18n to the speech adapter.
- **Persistence + default:** `incl_lang` in localStorage; default from `navigator.language`, limited to the
  available languages (fallback pt).
- **Language selector:** 🌐 icon in the title shortcuts + in the pause menu; the change applies without reloading.
- **Accessibility:** set `document.documentElement.lang` per locale (screen readers); accessible fonts
  per script in Wave 2; a correct `lang` also improves hyphenation/pronunciation.
- **SW/offline:** precache pt (static) + en + es in the `SHELL`; later Waves cache on demand.

## 4. Execution in steps (each = 1 verified commit, with no behaviour change in pt)
1. **Foundation:** `core/i18n.js` + `i18n/pt.js` (seed) + `applyDom`; convert **one** subset (the title
   menu) to `data-i18n`; game.js does the 1st `import`. Check: identical title, coming from the dictionary.
2. **Localization PER MODULE (during Phase B of the modularization) — do NOT sweep the monolith.** Course
   correction (2026-07-03): extracting strings from the 3800-line `game.js` before modularizing meant digging + touching the same
   code twice. Instead, **each module with UI extracted in Phase B** (`ui/menus`, `ui/pause`,
   dialogs…) already comes out with its literals replaced by `t()`/`data-i18n` and the keys in `pt.js` — **one touch
   per piece of code**. The batches already done (title, pause) are the starting point of the future `ui/*` (keys ready,
   not rework). The static strings of `index.html` (dialogs) go with the extraction of the module that
   controls them. See `../5-Refactoring/plan-modularization.md`.
3. **Voice per locale:** `localeVoice()`; 🌐 selector; persistence + browser default.
4. **en + es (UI + Mathematics + Play):** `i18n/en.js`, `i18n/es.js`; TTS en/es; Literacy stays pt
   (label "available in Portuguese") until the curriculum packs.
5. **Wave 1 (fr/de/id/fi):** only language files + voices.
6. **Wave 2 (ja/ko/zh/hi):** per-script font infrastructure (lazy-load), line breaking, layout review.
7. **Literacy curriculum packs** per language (en phonics, es silabeo…), when there is authoring.

## 5. Risks
- **Asynchronous boot** — avoided by the static import of the default locale.
- **Font explosion (Wave 2)** vs. the lean pillar — lazy-load per script; never embed CJK in the shell.
- **Mis-localized curriculum** — mitigated by the UI×curriculum separation (§1): do not fake en/es literacy.
- **Orphan / missing keys** — fallback to pt and a key-audit script (tools/) in Wave 1.

## 6. Pending decision (the Dev)
Confirm §1: **UI + Mathematics + Play** localized for en/es now, **Literacy in pt only** for the time being
(framework ready for curriculum packs later). If you want to try en/es literacy now, the effort is
**pedagogical authoring**, not translation — I plan it separately.
