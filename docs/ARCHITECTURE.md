# ARCHITECTURE — project & documentation map

> **START HERE — this is THE map.** The first doc to open on **any** prompt (for the AI and any LLM it coordinates) to
> find *what to read and what to change*. Where every file lives, what each canonical document holds, and how each role
> (programmer, AI, reviewer) uses it. **Any change to structure, a filename, or a naming convention is reflected here
> in the same commit** — a stale map is worse than none. For *why* we document the way we do (the artifact model, the
> two-layer requirements, "a doc becomes a test/task/ADR"), see [`CONTRIBUTING.md`](CONTRIBUTING.md).
>
> **Naming conventions:** ADRs = `ADR-NNNN-slug.yaml` (YADR); domain blueprints = `<domain>.idd.md` (Instructional
> Design) / `.ld.md` (Learning Design); studies that back decisions live in `research/`, and studies that prepare a
> decision of the Dev's about the engine live in `1-Discovery/`; dead docs are deleted (git history is the archive).

## 1. Repository layout

```
the-inclusionist-engine/      # published as the npm package @the-inclusionist/engine
├── app/                      # the engine's source and its demo page (Vite root)
│   ├── quiz.html             #   the demo cartridge's page: the only page the build emits
│   ├── css/style.css         #   the engine stylesheet, shipped in the package as style.css
│   ├── js/                   #   ES modules (TypeScript) — see §3
│   └── public/               #   static: vendor/ (fonts.css + the font files) icon.svg _headers
├── art/                      # imported art and its ledger, ATTRIBUTION.csv (empty today) — see art/README.md
├── research/                 # the Dev's typography catalogue
├── scripts/                  # build, delivery and measurement scripts (the inclusionist-heavy bin lives here)
├── tools/                    # dev tools: map editor, PNG writer, history audits
├── dist/                     # app build output (git-ignored); NO deploy is connected to it today
├── dist-pkg/                 # package build output of tsc -p tsconfig.pkg.json (git-ignored)
├── docs/                     # documentation — see §2
├── tests/                    # Vitest: *.node.test.js (logic) + *.browser.test.js (render/DOM)
├── .github/workflows/        # ci.yml — the engine's gates · game-ci.yml — the workflow the GAMES call
├── vite.config.ts  tsconfig.json  tsconfig.pkg.json  package.json  .release-it.json  .node-version
├── README.md  LICENSE  CHANGELOG.md
└── CLAUDE.md                 # AI operating rules (entry index for the agent)
```

> **Community-health files** (`CONTRIBUTING.md`, `CREDITS.md`, `SECURITY.md`, `LICENSES.md`) live in **`docs/`**, not the root,
> which keeps the root lean. ⚠️ **The reason changed with the host and the practice did not:** GitLab
> auto-detected them in `docs/`; GitHub looks in the root, `docs/` and `.github/`, so `docs/` is still one of
> the places it finds them. `LICENSES.md` is ours rather than a platform convention, and lives there too.

## 2. Documentation layout (`docs/`)

**The structure as it is** — the flat `docs/` of the early days has been consolidated into it.

Organized by **SDD lifecycle phase** (numbered), mirroring the schema we adopt (Discovery → Architecture → …).

```
docs/
├── ARCHITECTURE.md            # THIS FILE — the map (start here)
├── ROADMAP.md                 # THE roadmap: phases, steps, done-criteria and why-this-order (ADR-0126)
├── CONTRIBUTING.md            # how we work + our documentation model      (community-health file)
├── CREDITS.md                 # acknowledgements / attributions             (ships in the package)
├── LICENSES.md                # which licence governs what: code, own art, third parties (ships in the package)
├── SECURITY.md                # vulnerability reporting policy             (community-health file)
├── INVENTORY.md               # documentation inventory against a catalogue of 108 problems (dated survey, 2026-09-03)
├── 1-Discovery/               # SOFTWARE / engine requirements & design (NOT pedagogy — that's educational/)
│   ├── User-Stories.md        #   engine-layer features — negotiable layer, paths checked by a test
│   ├── NFR.md                 #   non-functional reqs + the 10 pillars      ← ADR-0010
│   ├── Event-Storming.md      #   DDD events — deferred (telemetry + Student Manager)
│   ├── plan-accessibility.md · plan-audio-phase-f.md · plan-tts-phase-f5.md · plan-i18n.md   # historical a11y/audio/TTS/i18n plans
│   ├── study-accommodations-by-genre.md  # 35 genres × 380 games → which accommodation is general and which is the genre's (ADR-0145 §3)
│   └── study-*.md             #   studies for a Dev decision: ADR rules createGame does not impose; microphone; webcam
├── educational/               # CURRICULUM / pedagogy layer (pt-BR domain) — see ADR-0004
│   ├── Learning-Objectives.md #   measurable objectives (BNCC + Mager) — absorbs old SRS
│   ├── Curriculum-Map.md      #   scope & sequence, BNCC coverage (+ Instituto Reúna focus-map)
│   ├── Pedagogical-Model.md   #   learning theory (Ferreiro & Teberosky, mastery, ZPD)
│   └── alfabetizacao.idd.md   #   domain IDD (Ferreiro & Teberosky); `<domain>.idd.md`/`.ld.md` convention
├── game-design/               # GAME CRAFT layer — see ADR-0009
│   ├── Art-Bible.md           #   visual system index
│   ├── character-animation.md #   layered character + animation spec (was ANIMACOES-PERSONAGEM)
│   ├── typography.md          #   canonical font system (was referencia-tipografica-v6)
│   ├── Game-Feel.md           #   juice/feel/camera (ADR-0018)
│   ├── genre-catalog.md       #   the 35-genre minigame backlog
│   ├── LM-GM-Map.md           #   learning-mechanic ↔ game-mechanic — the activity insertion points
│   ├── plan-procedural-art.md · study-tiled-aseprite.md · plan-map-editor.md   # art pipeline · importers · map editor
│   └── plan-city-scenery.md   #   city level design
├── 2-Architecture/            # system architecture & decisions
│   ├── C4-Context.md          #   C4 Level 1 (L2 with backend)
│   ├── ADR.md                 #   🔴 the records MOVED (ADR-0123): they live in `the-inclusionist-docs`.
│   │                          #   This file says where, and what stayed here — the `adr` CI job, which is
│   │                          #   the only one that can OPEN the `engine:` confirmations (`--repo engine=.`)
│   ├── Feature-Flags.md · DFD.md · STRIDE.md · CI-CD.md
│   ├── K8s-Manifests.md       #   note: when K8s becomes worth it (deferred)
│   ├── learning-interop.md    #   xAPI/Caliper/LTI/AfA… e-learning standards (deferred) — ADR-0004
│   ├── backend-cloud-roadmap.md   # staged AWS/backend adoption + which docs when
│   └── plan-engine.md · plan-typescript-vite.md · plan-versioning.md   # engine TDD · toolchain · release
├── 3-Sprint-Design/           # per-feature design
│   ├── data-model/            #   DBML.md · Migrations.md · Normalization.md
│   ├── api/                   #   OpenAPI.md · Pact.md
│   ├── bdd/                   #   Gherkin acceptance for activities (pt-BR features)
│   ├── Test-Plan.md
│   ├── Field-Test-M7.md       #   field-test script on a Multilaser M7 with a child (pt-BR by declared exception)
│   └── plan-unit-tests-at-extraction.md  #   test strategy (Vitest projects, ZOMBIES/Right-BICEP)
├── 4-Sprints/                 # execution (phase d)
│   ├── TDD.md                 #   TDD/XP + Vitest (ZOMBIES/Right-BICEP); Test Case → Test-Plan
│   ├── Commits.md             #   Conventional Commits + Closes #N
│   └── Frontend.md            #   DOM activities: light-DOM WC + Atomic + Storybook (→ ADR-0002); canvas excluded
├── 5-Refactoring/             # improving (phase e)
│   ├── Engineering-Rules.md   #   DRY/SOLID/cohesion↑; supersede-don't-append; ADRs change in-sprint
│   ├── plan-modularization.md · plan-modularization-map.md   # the modularization plan (arXiv:2409.15152) + extraction map
│   └── plan-rewiring-z-layers.md · plan-tts-lab-modularization.md   # z-order rewiring plan · cutting the TTS lab into packages
├── 6-DevOps-SRE/              # phase f
│   ├── Breaking-Changes.md    #   what left the PACKAGE since v7.0.1, by CHANGE: what moved, and why
│   ├── Adopting-8.0.md        #   the SAME facts by REPOSITORY: which consumer edits what, on which line.
│   │                          #   Measured in the six trees; no gate here, on purpose (ADR-0121)
│   ├── public-surface.json    #   the committed snapshot the gate compares against — NOT hand-edited:
│   │                          #   `node scripts/snapshot-public-surface.mjs` rewrites it, and running it
│   │                          #   IS the declaration that a removal was deliberate
│   ├── public-page-surface.json #  the CSS variables, classes, ids, data-* and keys cartridges read, each with its
│   │                          #   reader (ADR-0170); hand-kept, held by `public-page-surface`
│   ├── exports-without-consumer.json # published values nothing IN THIS REPOSITORY imports — all of it debt,
│   │                          #   and it only shrinks. `node scripts/exports-without-consumer.mjs`
│   ├── public-shape.json · code-health.json · language-debt.json · comment-language-debt.json   # other committed
│   │                          #   measurements the gates compare against, each rewritten by its script in scripts/
│   ├── models.md              #   the voice, recognition and vision models: role, source, use, how to rebuild them
│   ├── CI-QA.md               #   axe-core a11y (now, verifies NFR) · k6 load (backend, verifies SLO)
│   ├── Security-Pipeline.md   #   SAST + secret detection + npm audit (now) · DAST (backend) · Pentest (scheduled)
│   └── SLO.md                 #   SLI/SLO/Error-Budget/SLA (backend, rigor by tier)
├── 7-Async-Systems/           # phase g — message contracts · idempotency · ordering · DLQ · chaos (all deferred)
├── compliance/                # the annual child-protection reports (ADR-0053) + which WCAG criteria the gates measure
├── notices/                   # public notices (2026-09-14: the Piper voices withdrawn)
├── art-ref/                   # reference art (the City scenery's tileset)
└── research/                  # cross-cutting: studies that back decisions  ← RESEARCH-*, STUDY-FONTS, tts-*.md
```

> **Labs leave `research/` and become product (ADR-0023/0024/0025).** The inclusion experiments live in their own
> **hub** repo, **`inclusionist-lab`** (a **multi-page** Vite/TS app; one **sub-page per lab** — `/tts/` ready,
> Libras/vision planned), consuming the **versioned packages** (`tts`/`audio`/`logging`/`model-fetch`) of the
> `inclusionist-commons` repo, to be published under `@the-inclusionist/*` on **public npmjs** (ADR-0072; ADR-0026 said
> GitLab). Its own deploy on Cloudflare (the `labs.` domain).
> **`the-inclusionist-engine` keeps only the ENGINE** (ADR-0036, which amends ADR-0025). The game left, and **each game is
> its own repository** (ADR-0068) — the platformer is `game-platformer`, and the tile-world stack went with it (ADR-0228);
> `the-inclusionist-demos` no longer holds games, only the manifest of which games and versions enter a delivery. The demo
> cartridge that stays here, `consumer-quiz/`, exists to exercise the contract from outside.
> ⚠️ **THE WHOLE TOPOLOGY was decided on 2026-08-28 — ADR-0058** (which supersedes ADR-0055): **NINE**
> repositories for **FIVE systems**, **two mechanisms**
> (a package for a library, an API for a boundary) and **zero submodules**. The SHELL changes destination: it goes to
> `the-inclusionist-site` and not to `demos`, and `educational/` follows it to `the-inclusionist-knowledge-tree`.
> What the compass backends may store is **ADR-0063** (which supersedes ADR-0056), and it is the one in charge there. The
> **studies** (`research/tts-*.md`) stay here; the labs' **code** lives in `inclusionist-lab`. Plan: `5-Refactoring/plan-tts-lab-modularization.md`.

> **Dead docs are NOT kept in the tree (YAGNI).** `git history` is the archive — retired docs (the E1–E13 roadmap,
> VERTICAL-SLICE, TODO, PLANO-EXECUCAO, DIRETRIZES-VISUAIS, README-app-v4, reorganizacao-deploy, and the `imagens-ref/`
> screenshots) were **deleted** after their salvage was extracted; recover any via `git log --all`/`git show`. The
> per-file salvage trail lives in the archival commit messages.

> **Deferred-but-homed:** many 2-/3-/6- artifacts are stubs that record *where/when/how* an artifact activates
> (e.g. DBML at the corpus DB, OpenAPI/Pact at the backend, K8s at stage 4). The stub **is** the decision — it exists
> so the choice isn't improvised later; it is not empty ceremony.
>
> **Not in `docs/`:** the **executable backlog** — problems solvable by code — lives in **GitHub Issues**
> (`the-inclusionist/the-inclusionist-engine`), not in a Markdown file. The **roadmap** is not there: since ADR-0126
> (2026-09-09) the phases *Fase 0–6*, their steps and done-criteria live in `ROADMAP.md`. See `CONTRIBUTING.md`.

| File / folder | Holds | Used by |
|---|---|---|
| `ARCHITECTURE.md` | This map (files, code layout, system context) | everyone — the entry point |
| `ROADMAP.md` | The roadmap: phases, steps, done-criteria and the dependency-order rationale (ADR-0126) | dev (next work), reviewer (scope) |
| `LICENSES.md` · `CREDITS.md` | Which licence governs what · the attributions of third-party parts | anyone reusing the code or the art, reviewer |
| `educational/` | Curriculum layer (pt-BR): Learning Objectives (BNCC + measurable), Curriculum Map, Pedagogical Model | curriculum author, reviewer |
| `1-Discovery/User-Stories.md` | Engine-layer feature stories (small, negotiable), each path held by `tests/user-stories.node.test.js` | dev |
| `1-Discovery/NFR.md` | The 10 pillars as testable non-functional requirements | dev (constraints), reviewer (audit) |
| `game-design/` | Game craft: Art Bible, character/animation, typography, genre catalog, LM-GM map, game feel | dev, designer |
| `1-Discovery/Event-Storming.md` | Deferred DDD scope for telemetry + Student Manager | (future) |
| `1-Discovery/study-accommodations-by-genre.md` | Which accommodation has a subject in which genre, measured over 35 categories and 380 games (ADR-0145 §3, 2026-09-12) | Dev (decision), dev |
| `1-Discovery/study-adr-rules-the-engine-does-not-impose.md` | What the ADRs require that `createGame` does not impose on a cartridge (hypothetical rule, 2026-09-12) | Dev (decision), dev |
| `1-Discovery/study-microphone-control.md` | Which recogniser a microphone control transport can use: on-device, offline, restricted to the game's words (issue #182, 2026-09-13) | Dev (decision), dev |
| `1-Discovery/study-webcam-control.md` | What a gesture, a face movement and a gaze do in a game: positions, mappings, dwell, consent (issue #182, 2026-09-13) | Dev (decision), dev |
| `2-Architecture/` … `6-DevOps-SRE/` | The remaining SDD phases — decided section by section | dev, reviewer |
| `research/` | Studies with sources that justify decisions | reviewer (evidence), dev |

> **Migration: complete.** The flat `docs/` was consolidated file-by-file into this structure; dead docs were deleted
> (git is the archive). `docs/` root now holds the top-level documents of the tree in §2 (ARCHITECTURE, ROADMAP,
> CONTRIBUTING, CREDITS, LICENSES, SECURITY, INVENTORY) + the phase/layer folders. The pillars are not a file here: they
> are ADR-0010, in `the-inclusionist-docs`.

## 3. Code layout (`app/js/`) — the layers, and where to go to change something

⚠️ **This section used to be an inventory of module names, and it had stopped being true.** 📏 Measured on 2026-09-22: of the
181 modules in `app/js` it listed **81**; it still named `webcam`, deleted six days earlier, and a `game/` folder that no longer
exists; and `boot/`, `i18n/` and `consumer-quiz/` had no row at all. An inventory kept by hand loses to `git ls-files app/js/ui`,
which is always right — so the inventory is gone, and what replaced it is the part a listing cannot give: **which files you touch
to change a thing.**

### 3.1 The layers, and what each may import

The direction is `i18n → core → platform → input/render → ui → boot`: a module imports its own layer or below, never above, and
never in a cycle. That rule is **ADR-0173** and it is enforced by `tests/dependencies-point-downward.node.test.js` — this table
does not repeat it, it says what kind of thing lives where.

| layer | what lives there |
|---|---|
| `i18n/` | The three dictionaries: every sentence a child reads or hears, in pt-BR, English and Spanish. Data, no logic. |
| `core/` | What the engine IS, with no browser: the contract, the accommodation catalogue, the scene stack, the stored state, the ring, geometry and constants. Imports nothing above it. |
| `platform/` | The browser, wrapped: storage, audio, speech, the heavy delivery, the vision and speech runtimes, the window a root listens on. |
| `input/` | What a press MEANS: the transports (keyboard, gamepad, touch, camera, voice), the maps a game declares, latching, the virtual controller that carries a command to the cartridge. |
| `render/` | What the world looks like: the canvas, the scenery, the sprites, the colour-blindness and high-contrast filters, the Z-order. |
| `ui/` | What the child operates: the pause card, the quick bar, the settings panels, menu navigation, the HUD, layout and typography. |
| `boot/` | `create-game` — the composition root. It builds everything above, wires it and hands the game an engine. One module, on purpose. |
| `educational/` | The curriculum in code: the adaptive engine, the learning bands. Outside the stack — it imports nothing and nothing but a game imports it (ADR-0032). |
| `consumer-quiz/` | The demo cartridge. Not the engine: it is what exercises the contract from outside. |

### 3.2 Two rules that hold everywhere

📏 Both were measured from the history, not decided: they are what nearly every commit does.

- **What the child READS touches the three dictionaries.** `i18n/pt`, `en` and `es` move as one — 100% and 99% of each other's
  commits — and travel in ~37% of all commits. A key added to one and missing from another is caught by `problems`
  (`lacunasDosDicionarios`), not by review.
- **What the engine MOUNTS touches the root.** `boot/create-game.ts` is the most-edited file in the tree (155 commits). If you
  are adding something the child can see or operate, expect to pass through it.

### 3.3 Where do I go to change…

📏 **Measured, not designed.** Each row is the set of files that are edited in the SAME commit as the first one, over the whole
history, ignoring sweeps (commits touching more than 25 files, which say nothing about what belongs together). The percentage is
how often the second file came along. The two rules of §3.2 are left out of every row — otherwise every answer would be «the
dictionaries and the root».

| to change… | go to | and usually also |
|---|---|---|
| **the pause card, the quick bar and menu navigation** | `ui/pause-icons.ts` | `ui/menu-nav.ts` 35% · `app/css/style.css` 21% · `ui/pause-buttons.ts` for the card's own buttons |
| **a setting the child keeps** | `core/state.ts` | `platform/storage.ts` 31% — and the lifetime rule of ADR-0038, gated in `tests/lifetime-gate.node.test.ts` |
| **what a key, a button, a finger does** | `input/keydown.ts` | `input/gamepad.ts` 53% · `input/touch-bindings.ts` 47% · `input/touch.ts` 40% · `ui/shell.ts` 27% — ⚠️ see the debt in §3.4 |
| **a row in a settings panel** | `ui/settings-audio.ts`, `-motion`, `-mobility`, `-visual`, `-typo`, `-empathy`, `-caa`, `-controls` | `ui/mount-panel.ts` and `ui/panel-widgets.ts` build the row — ⚠️ see the debt in §3.4 |
| **which face the text is drawn in** | `ui/fonts.ts` | `app/public/vendor/fonts.css` 47% · `ui/settings-typo.ts` 46% · the catalogue `research/catalogo_tipografico.json` (the Dev's) |
| **how the engine speaks** | `platform/tts.ts` | `ui/settings-audio.ts` 35% · `platform/kokoro-runtime.ts` for the neural voice |
| **what gets downloaded, and from where** | `platform/heavy-catalogue.ts` | `platform/heavy.ts` 60% · `platform/heavy-mirror.ts` 30% · `scripts/heavy-into-the-delivery.mjs` fills a delivery |
| **playing through the camera or by voice** | `ui/eye-control.ts`, `ui/face-control.ts`, `ui/hand-control.ts`, `ui/voice-control.ts` | `input/virtual-controller.ts` 50% · `input/face-map.ts`, `input/hand-map.ts`, `input/voice-map.ts` · `platform/vision.ts` |
| **the size of the screen and of a target** | `ui/layout.ts` | `app/css/style.css` 23% — ADR-0001 (whole multiples of 320×180) and ADR-0163 (≥640×360, text ≥16 px) |
| **what the contract asks a cartridge** | `core/contract.ts` | `consumer-quiz/main-quiz.ts` 50% — the demo is what exercises the contract, and a field with no reader is a field nobody keeps |

📌 **`render/viz-setters.ts` is not in the table, and that is information**: it has no neighbour above 25%. It is changed alone.
⚠️ The frame-drawing module used to sit beside it here and **left the repository in the F12 move** (ADR-0228, 2026-09-23):
drawing a tile world is a game's work, and it is the platformer's now. The co-change reading survives the departure — a module
nothing changes with is a module nobody else's work touches — but the EXAMPLE does not. 📌 Its path is deliberately not written
here: this file is a MAP, and a map that names something this tree no longer has sends its reader looking for nothing. Where a
departed pointer IS named on purpose is the dead-pointer book in `tests/records-pointing-at-dead-gates.node.test.js`.

### 3.4 Two lines that are long because something is missing

A row above with many files is a HYPOTHESIS: either the subject genuinely has several faces, or the same decision is written
down more than once. Two of them are the second kind, and naming them here is cheaper than pretending the spread is the design.

- 🔴 **There are two doors to the cartridge.** `input/virtual-controller` exists to be the only one (ADR-0111, erratum), and
  📏 measured on 2026-09-22 it is imported by `boot/create-game` and by the four newest transports —
  `ui/eye-control`, `ui/face-control`, `ui/hand-control`, `ui/voice-control`. The keyboard, the gamepad and the touch pad still
  arrive as synthesised KEYS (`markKey`/`releaseKey`), which is why `keydown`, `gamepad` and `touch-bindings` still change
  together 40–53% of the time. Whether to unify is a decision, not a cleanup.
- ✅ **THE PANEL LINE IS PAID, on 2026-09-22.** `ui/mount-panel` and `ui/panel-widgets` exist so that a menu row is written
  once, and now **every panel that builds rows builds them through the kit**. The work took the shape the measurement gave
  it rather than the shape the plain count suggested: of the five that were outside, only `-controls`, `-typo` and `-caa`
  BUILT rows — as HTML STRINGS (`'<div class="ctrl-row">…'`), which is the duplication the kit exists to end. `-empathy`
  builds none (it wires `#opt-hearing`, `#opt-onebtn` and `#opt-wheelchair`, which the composition root already builds WITH
  the kit) and `-panel` is not a panel at all — it is the shared overlay infrastructure. Converting those two would have
  converted nothing.
  📌 **The kit grew by what the panels asked for, and only that** — the rule written at the top of `ui/panel-widgets`:
  `sectionHeader` (four modules were hand-writing `.panel-sub`), and two `ControlShape`s, `'radio'` for the font menu (a
  choice is not a toggle, ADR-0012 erratum) and `'button'` for the remapping panel (a control that DOES something instead
  of holding a value).
  📏 What it cost and bought, per module: `settings-audio` 837 → **339** lines across the cuts of ADR-0221 step 7c;
  `settings-typo` 137 → 183 with the adoption and then **134** once `ui/typo-choices` took its pure half;
  `settings-controls` 184 → 195 and then **173** once `ui/control-choices` took its. Both times the ratchet was what pointed
  at the cut — the module landed one line under the ceiling, and the answer was to split rather than to ask for an exception.
  📌 **And «does anything mount it» stopped being a criterion**, by the Dev's correction of the same day: «E nem é pra medir
  se alguém monta ou não! Se eu vou fazer um cartucho que monta será após isso estar funcionando!»

⚠️ **The experiment that will settle the remaining line is running, and its criterion was fixed before the answer existed:**
when an abstraction is adopted, the files it unifies must stop changing together (`node scripts/co-change.mjs --group …`).
📏 Measured on 2026-09-22, right after the panel work landed: the `panels` group is together in **6 of the 34 commits that
touch it (18%)**, and that number is the BASELINE of the adoption, not its verdict — the commits that converted them
necessarily touch them. Whoever reads this in a month reads the answer. The `transports` group is 25% before the virtual
controller and 50% after, over **four commits**, which is not a result and the script says so. The one group with enough
data confirmed the opposite case: the three dictionaries were 100% together before and after, which is what an IRREDUCIBLE
spread looks like.

Engine constants (TILE_TYPES, TUNE, dimensions) live only in `app/js/core/constants.ts` — never duplicated in docs.
The **canonical render Z-order** (named layers, world + overlay scopes; PIXI `zIndex` + DOM `z-index`) and the
**post-process filter chain** (`POST_FX_ORDER`, a11y-correction-last) lived in the layer-order module, which **left in the F12
move** (ADR-0228): a z-order is the order of ONE game's layers. ⚠️ The rule of ADR-0020 — the accessibility correction is applied
LAST — is the ENGINE's and outlives the table it was written in; it is now stated only inside the platformer, and where the
engine will state it again is the boundary after this one.

> ⚠️ **Contested by ADR-0027**: a measured flash limiter (WCAG 2.3.1) must run AFTER `A11Y_CORRECTION`,
> because the correction *increases* inter-frame luminance delta and nothing measures downstream of it. Today 2.3.1
> is met by content discipline, which does not scale to 35 games. ADR-0020 needs an amendment.
