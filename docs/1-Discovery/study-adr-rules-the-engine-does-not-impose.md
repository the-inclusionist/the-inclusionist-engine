# What the ADRs require that the engine does not impose on a cartridge

> Study requested by the Dev on 2026-09-12: «Tudo que estiver em ADR a engine precisa impor para o desenvolvedor do
> cartucho. Exemplo: o comportamento das telas em pixel art, que deve ser 320x180 mas aparecer sempre em múltiplos
> inteiros de acordo com o espaço disponível na tela, com uma tolerância (descrita em ADR) sendo o tamanho mínimo
> 640x360, e nesse tamanho a fonte mínima é 16px. Estude e liste tudo que a engine deve fazer e ainda não faz segundo
> essa regra caso ela passe a valer.»
>
> **The rule is hypothetical** («caso ela passe a valer»). This file lists; it decides nothing. If the Dev adopts the
> rule, it becomes an ADR, and each gap below becomes an issue with its gate.

## Method

- The cartridge path is `createGame` (`app/js/boot/create-game.ts`); a rule counts as **imposed** only if a game that
  calls `createGame` gets it without doing anything, or is refused/told when it breaks it.
- **MEASURED** = checked in the built `dist/quiz.html` (service worker unregistered, caches cleared) or by a targeted
  `git grep` of the engine, on 2026-09-12. **NOT MEASURED** = read in the ADR, not checked in running code.
- ADRs read: the 162 titles of the index, and the decision text of ADR-0001, 0010, 0011, 0012, 0020, 0031, 0044, 0047,
  0049, 0050, 0054, 0059, 0095, 0102, plus those already built during the current plan (0144–0162).
- Out of scope: ADRs about repositories, licences, hosting, process and data governance outside the running game
  (0003–0005, 0007, 0009, 0017, 0019, 0021–0026, 0035–0036, 0048, 0052–0053, 0055–0058, 0063–0073, 0078, 0081–0083,
  0093, 0097, 0107, 0117–0118, 0123, 0125–0128, 0133–0138, 0152).

## A. Screen and scale — the Dev's example

| # | ADR | Rule | Under `createGame` today | Evidence |
|---|---|---|---|---|
| A1 | ADR-0001, pillar 5 (ADR-0010) | Pixel art at 320×180, shown at an **integer multiple of REAL pixels** that fits the space, with a crop tolerance of **≤5 logical px per side** | 🔴 **Not imposed.** The rule exists as `ui/layout.layout()` (`kDev = floor(avail·dpr/(base−10))`), but `createGame` never calls `initLayout`/`layout`. | MEASURED: `#game-region` of the quiz is **569×395** at dpr 1 — not a multiple of 320×180. `git grep` finds only `barIntruders` imported from `ui/layout`. |
| A2 | ADR-0001 (`MIN_K = 2`) | Each viewport is **at least 640×360** | 🔴 **Not imposed** (same cause). | MEASURED: 569×395 — below 640 wide. |
| A3 | `ui/layout` (`--ui-fs = 8·k`) | UI text **at least 16 px** at 640×360, growing with k | 🟡 **Partly.** `:root{--ui-fs:16px}` gives 16 px by default, but it never grows with the scale, and **18 declarations** in `style.css` go below 1em. | MEASURED: pause items and quiz options 16 px; the quick bar's name caption **13.6 px**; panel hints and footer `.9em` (14.4 px). |
| A4 | ADR-0095 | Touch target floor by viewport **height** (24 / 34 / 44 px) | 🔴 **Not imposed** (written by `layout()`). | MEASURED: `--alvo-min` empty; items fall back to 44 px; in 569×395 the settings submenu scrolls 8 px and the visual panel 37 px. |
| A5 | ADR-0001 / ADR-0020 | Scanlines aligned to real pixels (`crtScanVars`) | 🔴 **Not imposed** (runs inside `layout()`). | grep. |

**What imposing A1–A5 would take:** `createGame` runs the layout (host-injected, not the global `document`/`window`
`ui/layout` reads today — the same fault as finding 15 in `create-game.ts`), re-runs it on resize, and a browser gate
measures, at several window sizes and dprs: an integer real-pixel multiple, ≥640×360, the crop tolerance, target floor,
and **no computed font size under 16 px** in engine UI. The 18 sub-1em declarations need a decision each.

## B. Post-processing and visual comfort

| # | ADR | Rule | Under `createGame` today | Evidence |
|---|---|---|---|---|
| B1 | ADR-0047, ADR-0020 | The decorative CRT (scanlines, vignette) **yields to every visual accessibility mode**, no exception | 🔴 **Not imposed.** The CRT is not applied at boot at all: the «Visual sensitivity» panel says *Scanlines: On* and the region has no CRT class until a toggle is pressed. The yield rule has nothing to act on. | MEASURED: `class="game-region"` at boot; after toggling scanlines, `game-region crt-round-0`. |
| B2 | ADR-0020 (`FLASH_LIMIT`, WCAG 2.3.1) | A **safety pass** limits flashes, after the colour correction | 🔴 **Not imposed.** Nothing in `createGame` limits what a cartridge flashes. | grep: no `flash` in `create-game.ts`. |
| B3 | ADR-0011 | High contrast by **direct rendering** (outline, colour-blocking, receding background) | 🟡 **Game's.** The engine cannot repaint a cartridge's textures; the 🌗 stays the game's (ADR-0148 erratum). Not a gap the engine can close by itself — it would be a contract field. | Recorded. |
| B4 | ADR-0012 | Canonical faces and BDA spacing on the document | 🟡 **Only if the page links the engine stylesheet.** `createGame` injects no CSS; the quiz page links `css/style.css` itself. A cartridge page without it gets unstyled panels, and no line in `problems` says so. | grep: no stylesheet import in `create-game.ts`. |

## C. Menus, HUD and navigation

| # | ADR | Rule | Under `createGame` today | Evidence |
|---|---|---|---|---|
| C1 | ADR-0044, 0158, 0161 | One menu per screen, exit first, numbered, interruptible narration | 🟢 **Imposed for the ENGINE's menus** (pause card, panels). 🔴 A cartridge's own menus are not checked. | Built in this plan. |
| C2 | ADR-0159 | The 12 UI rules (narration «N of M», contrast 4.5:1/3:1/7:1, focus ≥2 px at 3:1, text at 200%, no glyph-only labels…) | 🟡 **Partly, for engine UI only.** MEASURED: inside a settings panel the cursor moves and `#sr-status` says nothing (the spoken index exists only in the pause card). Cartridge UI not checked. | Issue #153. |
| C3 | ADR-0148 | The accessibility bar is HUD; the game does not draw over it | 🟡 **Reported, not prevented** (`problems`). | Built (1g). |
| C4 | ADR-0059 | HUD numbers in four bands (identity top-left, session top-centre, round top-right, learning bottom-centre) | 🔴 **Not imposed.** `createGame` mounts no HUD. | grep: no `ui/hud` in `create-game.ts`. |
| C5 | ADR-0102 | A skip link above the transition | 🔴 **Not imposed.** The quiz page writes its own `.skip-link`; `createGame` mounts none. | grep. |
| C6 | ADR-0031 | Every panel, activity and text menu **redraws itself on a language or font change, restoring focus** | 🟡 **Boot only.** `localeReady()` covers the boot language; a runtime `i18n:change` is not handled (the code names it the Dev's question). | grep. |

## D. Time, loop, sound

| # | ADR | Rule | Under `createGame` today | Evidence |
|---|---|---|---|---|
| D1 | ADR-0054 | A frame that throws **stops the loop and says so** | 🔴 **Not imposed.** The engine offers `createCrashNotice`, but the game owns `startLoop`; nothing checks a cartridge uses it. | grep. |
| D2 | ADR-0050 (and WCAG 2.2.1) | The clock belongs to the adult; `tick` declares who drives time | 🔴 **Declared, never read.** `tick` is validated and has no reader (plan phase 5a). | grep (known). |
| D3 | ADR-0014 | Sounds that carry information have captions | 🔴 **Not imposed.** Captions exist only through `createAudioEarcons`, which the game creates; `createGame` mounts no caption host. | grep. |

## E. Ethics, data, determinism

| # | ADR | Rule | Under `createGame` today | Evidence |
|---|---|---|---|---|
| E1 | ADR-0006, 0049, 0098 | No compulsion loop; every reward deterministic; points change nothing | 🔴 **Not enforceable at runtime.** Could only be a declaration plus review. Nothing today. | NOT MEASURED in cartridges. |
| E2 | ADR-0037, 0080, 0103 | No child data stored; nothing kept per game beyond the declared namespace; the bar does not persist | 🟡 **Gated for ENGINE modules** (`no-stored-history` inventory), not for a cartridge's own storage writes. | Test inventory. |
| E3 | ADR-0141 | A cartridge owns its random stream | 🔴 **Not built** (the lint the ADR names). | ADR status. |
| E4 | Pillar 3 (ADR-0010) | Every UI string in pt, en and es | 🔴 **Not imposed on cartridge strings.** The i18n gates cover engine modules; the quiz's questions and feedback are Portuguese only. | MEASURED in dist: English page, Portuguese questions; grep: `respostaTexto` writes «Certo!» / «Ainda não» as literals. |
| E5 | ADR-0116, 0140 | Offline after the first day; the standalone build is not a delivery route | 🔴 **Build-level, not checked for a cartridge** (ADR-0140's gate not built). | ADR status. |

## F. Already imposed — for contrast

`createGame` **refuses to boot** when the declaration breaks: the world element (ADR-0087), `topology` as a function
(ADR-0084), `holdsAtOnce` (ADR-0104), the accommodation answers (ADR-0153), `start`/`select` taken by a preset
(ADR-0144, 0155). It **reports in `problems`**: missing hosts, the bar overlap (ADR-0148), missing words for the pad
(ADR-0162), reach (ADR-0091). These are the model for the gaps above: a rule is imposed when breaking it either stops
the boot or leaves a named line.

## Summary — if the rule is adopted

| Kind | Count | Items |
|---|---|---|
| 🔴 Not imposed | 15 | A1, A2, A4, A5, B1, B2, C4, C5, D1, D2, D3, E1, E3, E4, E5 |
| 🟡 Partly | 7 | A3, B3, B4, C2, C3, C6, E2 |
| 🟢 Imposed (engine UI) | 1 | C1 |

**The biggest single step is A1–A5:** they all fall out of `createGame` not running `ui/layout`, and they are what the
Dev's example describes. Two measured facts make it concrete: the quiz renders at 569×395 — neither an integer multiple
of 320×180 nor 640×360 — and the settings cards scroll because the height-based target floor never runs.

**Not measured, and worth saying:** pillar 7 (separate screens, no split-screen) against `screenBaseSize` for 2–4
players; ADR-0013's motor rules beyond what the pad and toggle keys already do; the text of ADR-0010 pillars 1, 6 and 9
against runtime behaviour.
