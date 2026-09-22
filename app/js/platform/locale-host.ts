// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/locale-host — WHAT A PAGE DOES WHEN THE LANGUAGE CHANGES, and what language it would prefer (ADR-0221 step 7g).
//
// 🔴 WHY THIS MODULE EXISTS: `core/i18n` used to write `document.documentElement.lang`, dispatch `i18n:change` on `window`,
// read `navigator.language` and hang itself on `window.__i18n` — four reaches into globals from `core`, which ADR-0173
// defines as «what the engine IS, without a browser». The health ratchet measured them (step 7d) and the Dev chose to SPLIT
// rather than to move the module (option B, 2026-09-22): the decisions — which languages exist, which one is kept, what a
// key resolves to — stay in `core`, and the three things only a page can do live here.
//
// 📌 WHY NOT INJECT AND LEAVE IT AT THAT, which was the cheaper option C: the sentence «core is what the engine is, without a
// browser» would have stayed a rule with an exception nobody reads. 📏 The cost measured before choosing was 8 sites; this
// module is what those 8 became.
//
// ⚠️ It touches `document` and `window` ON PURPOSE and that is why it is `platform/`: this is the layer whose job is the
// browser. What it must never do is decide anything about language — it receives the locale and the tag already chosen.

/** The two hooks `core/i18n`'s port takes. A host that has no page passes neither, and the engine runs without one. */
export interface LocaleHostHooks {
  readonly applied: (locale: string, tag: string) => void;
  readonly preferred: () => string | null;
}

/** What a browser can offer `core/i18n`: the page effects of a change, and the language the person's browser is set to. */
export function localeHostHooks(doc: Document, win: Window, applyDom: (root: ParentNode) => void): LocaleHostHooks {
  return {
    applied: (locale, tag) => {
      // 📌 THE THREE EFFECTS IN THE ORDER THEY WERE WRITTEN IN `core/i18n`, and the order matters to a screen reader: the
      // document's language is announced before the text it governs changes.
      doc.documentElement.lang = tag;
      applyDom(doc);
      win.dispatchEvent(new CustomEvent('i18n:change', { detail: { locale } }));
    },
    // ⚠️ `navigator` through the window, not the global: a host that hands the engine another window — a second document, an
    // iframe — means that window's language, and reading the global would silently answer for the wrong one.
    preferred: () => win.navigator?.language ?? null,
  };
}

/** Hangs the i18n object on the window for tests and the preview, which is what `core/i18n` used to do to itself. */
export function exposeI18n(win: Window, i18n: unknown): void {
  (win as Window & { __i18n?: unknown }).__i18n = i18n;
}
