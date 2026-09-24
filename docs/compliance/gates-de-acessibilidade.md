<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Which WCAG criteria this repository MEASURES — and which it only cites

First surveyed on **2026-09-07** by sweeping `tests/`, `app/js/`, `app/css/` and `scripts/` for criterion citations
(`\d\.\d+\.\d+`), and classifying each one by where it appears; brought up to date on **2026-09-24**. It is the
automatable half of **#13** (the final WCAG 2.2 + GAG audit), and it exists so that the manual audit knows **what it does
not need to re-measure** — and, more importantly, **what nobody has measured**.

⚠️ **A CITATION IS NOT A GATE.** A comment that says «WCAG 2.1.1» describes an intention; a case in
`tests/` that fails when the intention stops holding is the only thing that keeps the intention from ageing. The
right-hand column is the one that matters.

This document is also raw material for the **annual report** (ADR-0053), which the record itself describes as
«em boa parte, um índice de gates que já correm» (largely an index of gates that already run).

## Measured — there is a case that fails

| criterion | what it promises | where it is measured |
|---|---|---|
| **1.3.1** Info and Relationships | the structure reaches the screen reader | `tests/menu-nav.browser.test.js` |
| **1.4.1** Use of Color | colour is never the only carrier | `tests/state-never-by-colour-alone.browser.test.js` (the two gates of the title menu went with it to `game-platformer`, ADR-0174) |
| **1.4.11** Non-text Contrast (3:1) | visible non-text indicator | `tests/menu-contrast-measured.node.test.js`, `tests/changed-mark-contrast.node.test.js` |
| **2.3.3** Animation from Interactions | interaction motion can be switched off | `tests/settings-motion.browser.test.js`, `tests/state.node.test.js` |
| **2.4.1** Bypass Blocks | a page with no skip link gets the engine's, first in the body, aimed at the game region (ADR-0102) | `tests/skip-link-at-boot.browser.test.js` |
| **2.4.3** Focus Order | focus order follows reading order | `tests/menu-nav.browser.test.js` |
| **2.4.7** Focus Visible (and 2.4.13) | an indicator of at least 2 px at 3:1 against its surroundings (ADR-0159 rule 9) — ⚠️ not measured under high contrast | `tests/visible-focus.browser.test.js` |
| **2.5.5** Target Size (Enhanced, AAA) | 44 px where the screen allows | `tests/pause-target-44px.browser.test.js`, `tests/touch.browser.test.js` |
| **2.5.8** Target Size (Minimum, AA) | a 24 px floor, and the spacing that stands in for it | `tests/pause-target-44px.browser.test.js` |
| **1.4.6** Contrast (Enhanced, AAA) | menus at 7:1, not only 4.5:1 | `tests/menu-contrast-measured.node.test.js` |
| **2.3.1** Three Flashes (measurement only) | `measureFlashes(ms)` reads the world's canvas on request and reports a general-flash failure in `problems` — it limits nothing (see below) | `tests/limiar-de-flashes.node.test.js`, `tests/measure-flashes.browser.test.js` |

And the gate that runs against the BUILT application, covering A/AA as a block: `scripts/axe-check.mjs`, in the
`a11y` job of `.github/workflows/ci.yml`.

<!-- The heading below keeps its Portuguese words on purpose: `tests/gates-de-acessibilidade.node.test.js` locates the
     boundary between the two tables by that exact text. -->
## ⚠️ Citados e NÃO aferidos — cited and NOT measured: the holes

These criteria appear in the code as a declared intention and **no case measures them**. Each row is work
that the manual audit of #13 will have to do by hand, or a gate still to be written.

| criterion | where it is cited | why the hole matters |
|---|---|---|
| **2.2.2** Pause, Stop, Hide | proved by the weather gate, which left | 🔴 **THE CASE LEFT IN F12** (ADR-0228): it measured ONE game's rain stopping under reduced motion, and it went with `render/weather` to `game-platformer`. The RULE belongs to the engine — automatic motion must be stoppable — and it no longer has anything here to fail it |
| **1.4.12** Text Spacing | `app/css/style.css` | the default values (`--ls`, `--ws`, `--lh`) are pinned on the computed style by `tests/settings-typo.browser.test.js`, but nothing measures that they survive a theme change |
| **2.1.1** Keyboard | `app/js/ui/menu-nav.ts` | it is the most structural criterion of the project and the only one measured only in parts — each panel has its own case, nobody asserts the whole |
| **2.2.1** Timing Adjustable | `app/js/core/contract.ts` | the game speed (ADR-0180) slows the whole game down to 50% and is gated by `tests/game-speed.node.test.js`, which is less than the criterion's tenfold adjustment; the screen-time clock (#94) does not exist yet, and when it does, this is where it is proved |

### ⚠️ And one that is worse than a hole: 2.3.1 Three Flashes

🔴 **AND IT GOT WORSE ON 23/09**: the module that declared `FLASH_LIMIT` as the outermost pass left this repository in
F12 (ADR-0228), so the paragraphs below describe a decision that is no longer written here. ⚠️ The flash limit is
health — it is WCAG 2.3.1 — and it belongs to the ENGINE; where the engine declares it again is the next boundary.

The layer-order module declared `FLASH_LIMIT` as the **outermost pass** of the post-processing chain, and
explained why in so many words: *«ele decide se a imagem pode FAZER MAL […] o único quadro cuja
luminância importa é o que chega ao olho»* (it decides whether the image can do harm; the only frame whose luminance
matters is the one that reaches the eye).

**It was not implemented.** The file itself said so — *«FLASH_LIMIT ainda NÃO está implementado; está
declarado aqui, e aferido por teste, para que quem o implementar encontre o lugar certo já ocupado»* (declared and
tested for position so that whoever implements it finds the place already taken) — and what the test measured was the
**order** in the list, not the effect.

What exists today is the other half: `core/flash-threshold` and `platform/flash-sampler` **measure** what a game draws
against the general flash threshold, only when `measureFlashes(ms)` is called, and a failure becomes a line of
`problems`. The red flash is not measured, and nothing **limits** a flash: the engine does not own a cartridge's render.

In other words: a flash can now be detected on request, and the limiter does not exist. It is a
safety promise (not a comfort one) about photosensitive epilepsy, and it is the most urgent line on this page.

## What this document is not

It is not a conformance verdict, and §53 of the requerimento requires the two levels to be kept apart: **AA on
all content, AAA on the entry screens and the accessibility menus**. A document that gave a single
number would be hiding exactly the distinction the promise makes.

⚠️ And the survey finds what is WRITTEN. A criterion that nobody cited does not appear here — neither as
measured, nor as a hole. That is a third category, invisible to this sweep, and it is the reason the
manual audit of #13 remains necessary after every hole above is closed.
