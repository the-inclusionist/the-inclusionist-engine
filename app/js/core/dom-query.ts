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
// And it costs no dependency: `Element` is a `lib.dom` global, and a type is erased at build.
// 📌 It holds only the TYPE. The two global queries that lived here (`$`, `$$` over `globalThis.document`) left in
// ADR-0232 D4: every module now queries the document it is GIVEN, and the root builds its `$` over the host's.

/**
 * `document.querySelector`, in the shape modules receive it by INJECTION — never importing `document`.
 *
 * The default is `HTMLElement` and not `Element` because that is what callers use: `.hidden`, `.textContent`,
 * `.dataset`, `.focus()`. Whoever needs something else instantiates it — there is a `$<SVGElement>` in the tree, and
 * it is why the CONSTRAINT stays `Element`.
 */
export type DomQuery = <T extends Element = HTMLElement>(sel: string) => T | null;
