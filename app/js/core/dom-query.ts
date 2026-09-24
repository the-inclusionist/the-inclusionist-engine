// SPDX-License-Identifier: AGPL-3.0-or-later
// core/dom-query — THE INJECTED DOM SELECTOR, declared ONCE.
//
// ========================= WHY THIS FILE EXISTS =========================
// The same `DomQuery` declaration — a generic arrow over `Element`, returning `T | null` — was written in SIXTEEN
// modules: ADR-0039's defect one step up (there a FIELD described twice, here a TYPE described sixteen times).
//
// And, as copies do, they diverged. One declared it NON-generic. A generic function assigned to a non-generic
// signature is instantiated at its CONSTRAINT, not its default: the real `$`, `<T extends Element = HTMLElement>`,
// became `Element` — and `Element` has no `hidden`. Two type errors came from it, and neither mentioned a selector.
//
// ========================= WHY IN `core/` =========================
// Because it is the layer everyone may import without inverting anything — `input/`, `render/` and `ui/` (ADR-0173).
// And it costs no dependency: `Element` is a `lib.dom` global, and the two queries below touch no DOM at import, so
// `core/` stays testable without a browser.
// 📌 The two global queries (`$`, `$$`) live here and not in `ui/dom` so that `core/a11y-sr` and `render/crt` can use them
// without importing upward (issue #167); `ui/dom` still exports them under the same names.

/**
 * `document.querySelector`, in the shape modules receive it by INJECTION — never importing `document`.
 *
 * The default is `HTMLElement` and not `Element` because that is what callers use: `.hidden`, `.textContent`,
 * `.dataset`, `.focus()`. Whoever needs something else instantiates it — there is a `$<SVGElement>` in the tree, and
 * it is why the CONSTRAINT stays `Element`.
 */
export type DomQuery = <T extends Element = HTMLElement>(sel: string) => T | null;

/**
 * ⚠️ RESOLVED THROUGH `globalThis` AND NOT THE BARE GLOBAL, and the difference is between returning `null` and THROWING.
 *
 * `document.querySelector(...)` with no `document` is a `ReferenceError` — not `undefined` — and these two functions
 * promise `T | null`. A query that throws where it promises `null` is a defect by its own signature, and it travelled
 * far: `core/a11y-sr.srAlert` calls this `$`, and `createGame` calls `srAlert` when it shows the reach warning — so
 * booting the engine against an INJECTED document (an iframe, an editor beside the game, a test) blew up the whole boot
 * on an announcement. It survived because while every root was a page in a browser, the global WAS the right document.
 *
 * ⚠️ AND THEY STILL LOOK AT THE GLOBAL, on purpose: whoever needs to query ANOTHER document injects their own (the
 * composition root has a `$` bound to the host's document). What this changes is not WHERE they look — it is what
 * happens when there is nowhere to look.
 */
const docGlobal = (): Document | undefined => (globalThis as { document?: Document }).document;
export const $ = <T extends Element = HTMLElement>(s: string): T | null => docGlobal()?.querySelector<T>(s) ?? null;
export const $$ = <T extends Element = HTMLElement>(s: string): T[] => [...(docGlobal()?.querySelectorAll<T>(s) ?? [])];
