# ARCHITECTURE — project & documentation map

> **START HERE — this is THE map.** The first doc to open on **any** prompt (for the AI and any LLM it coordinates) to
> find *what to read and what to change*. Where every file lives, what each canonical document holds, and how each role
> (programmer, AI, reviewer) uses it. **Any change to structure, a filename, or a naming convention is reflected here
> in the same commit** — a stale map is worse than none. For *why* we document the way we do (the artifact model, the
> two-layer requirements, "a doc becomes a test/task/ADR"), see [`CONTRIBUTING.md`](CONTRIBUTING.md).
>
> **Naming conventions:** ADRs = `ADR-NNNN-slug.yaml` (YADR); domain blueprints = `<domain>.idd.md` (Instructional
> Design) / `.ld.md` (Learning Design); studies live in `research/`; dead docs are deleted (git history is the archive).

## 1. Repository layout

```
SP-the-inclusionist-tracer/
├── app/                      # the publishable game (Vite root)
│   ├── index.html
│   ├── css/style.css
│   ├── js/                   # ES modules (TypeScript) — see §3
│   └── public/               # static: assets/ vendor/ manifest.webmanifest icon.svg _headers
├── dist/                     # build output (git-ignored) → deployed to Cloudflare Pages
├── docs/                     # documentation — see §2
├── tests/                    # Vitest: *.node.test.js (logic) + *.browser.test.js (render/DOM)
├── .gitlab-ci.yml            # the pipeline: test · a11y (axe) · SAST + secret detection · optional CF deploy
├── vite.config.ts  tsconfig.json  package.json  .release-it.json  .node-version
└── CLAUDE.md                 # AI operating rules (entry index for the agent)
```

> **Community-health files** (`CONTRIBUTING.md`, `CREDITS.md`, `SECURITY.md`) live in **`docs/`**, not the root:
> GitLab auto-detects them there (root · `docs/` · `.gitlab/` are all valid), which keeps the root lean.

## 2. Documentation layout (`docs/`)

**Target structure** (the consolidation is migrating the current flat `docs/` into this):

Organized by **SDD lifecycle phase** (numbered), mirroring the schema we adopt (Discovery → Architecture → …).

```
docs/
├── ARCHITECTURE.md            # THIS FILE — the map (start here)
├── ROADMAP.md                 # strategy + why-this-order; phases live on the GitLab issue board (Fase 0–6)
├── CONTRIBUTING.md            # how we work + our documentation model      (GitLab health file)
├── CREDITS.md                 # acknowledgements / attributions
├── SECURITY.md                # vulnerability reporting policy             (GitLab health file)
├── 1-Discovery/               # SOFTWARE / engine requirements & design (NOT pedagogy — that's educational/)
│   ├── User-Stories.md        #   engine/game features — negotiable layer
│   ├── NFR.md                 #   non-functional reqs + the 10 pillars      ← ADR-0010
│   ├── Event-Storming.md      #   DDD events — deferred (telemetry + Student Manager)
│   └── plano-acessibilidade.md · plano-audio-fase-f.md · plano-tts-fase-f5.md · plano-i18n.md   # a11y/audio/i18n design
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
│   ├── plano-arte-procedural.md · plano-tiled-aseprite.md · plano-editor-mapa.md   # art pipeline · importers · map editor
│   └── plano-cenario-cidade.md #   city level design
├── 2-Architecture/            # system architecture & decisions
│   ├── C4-Context.md          #   C4 Level 1 (L2 with backend)
│   ├── adr/                   #   decisions in YADR (YAML) + index README
│   ├── Feature-Flags.md · DFD.md · STRIDE.md · CI-CD.md
│   ├── K8s-Manifests.md       #   note: when K8s becomes worth it (deferred)
│   ├── learning-interop.md    #   xAPI/Caliper/LTI/AfA… e-learning standards (deferred) — ADR-0004
│   ├── backend-cloud-roadmap.md   # staged AWS/backend adoption + which docs when
│   └── plano-engine.md · plano-typescript-vite.md · plano-versionamento.md   # engine TDD · toolchain · release
├── 3-Sprint-Design/           # per-feature design
│   ├── data-model/            #   DBML.md · Migrations.md · Normalization.md
│   ├── api/                   #   OpenAPI.md · Pact.md
│   ├── bdd/                   #   Gherkin acceptance for activities (pt-BR features)
│   ├── Test-Plan.md
│   └── plano-testes.md        #   test strategy (Vitest projects, ZOMBIES/Right-BICEP)
├── 4-Sprints/                 # execution (phase d)
│   ├── TDD.md                 #   TDD/XP + Vitest (ZOMBIES/Right-BICEP); Test Case → Test-Plan
│   ├── Commits.md             #   Conventional Commits + Closes #N
│   └── Frontend.md            #   DOM activities: light-DOM WC + Atomic + Storybook (→ ADR-0002); canvas excluded
├── 5-Refactoring/             # improving (phase e)
│   ├── Engineering-Rules.md   #   DRY/SOLID/cohesion↑; supersede-don't-append; ADRs change in-sprint
│   └── plano-modularizacao.md · plano-modularizacao-mapa.md   # the modularization ADR (arXiv:2409.15152) + extraction map
├── 6-DevOps-SRE/              # phase f
│   ├── CI-QA.md               #   axe-core a11y (now, verifies NFR) · k6 load (backend, verifies SLO)
│   ├── Security-Pipeline.md   #   SAST + secret detection + npm audit (now) · DAST (backend) · Pentest (scheduled)
│   └── SLO.md                 #   SLI/SLO/Error-Budget/SLA (backend, rigor by tier)
├── 7-Async-Systems/           # phase g — message contracts · idempotency · ordering · DLQ · chaos (all deferred)
└── research/                  # cross-cutting: studies that back decisions  ← PESQUISA-*, ESTUDO-FONTES, tts-*.md
```

> **Labs saem de `research/` e viram produto (ADR-0023/0024/0025).** Os experimentos de inclusão vivem num repo
> **hub** próprio, **`inclusionist-lab`** (app **multi-página** Vite/TS; uma **subpágina por lab** — `/tts/` pronto,
> Libras/visão planejados), consumindo **pacotes versionados** `@jrocha-io/*` (`tts`/`audio`/`logging`/`model-fetch`)
> do repo `inclusionist-commons` publicado no **registry npm do GitLab** (ADR-0026). Deploy próprio no Cloudflare
> (domínio `labs.`).
> **`inclusionist-engine` fica só com a ENGINE** — o jogo saiu para `inclusionist-demos` (ADR-0036, que emenda o ADR-0025; a frase anterior, "fica só com o jogo", valia enquanto o jogo era o produto).
> ⚠️ **A TOPOLOGIA INTEIRA foi decidida em 2026-08-28 — ADR-0058** (que supersede o ADR-0055): **NOVE**
> repositórios para **CINCO sistemas**, **dois mecanismos**
> (pacote para biblioteca, API para fronteira) e **zero submódulos**. A CASCA muda de destino: vai para
> `the-inclusionist-site` e não para o `demos`, e o `educational/` a segue até `the-inclusionist-knowledge-tree`.
> O que os backends do compass podem guardar é o **ADR-0056** (privacidade), e ele é quem manda ali. Os **estudos** (`research/tts-*.md`) permanecem
> aqui; o **código** dos labs vive em `inclusionist-lab`. Plano: `5-Refactoring/plano-tts-lab-modularizacao.md`.

> **Dead docs are NOT kept in the tree (YAGNI).** `git history` is the archive — retired docs (the E1–E13 roadmap,
> VERTICAL-SLICE, TODO, PLANO-EXECUCAO, DIRETRIZES-VISUAIS, README-app-v4, reorganizacao-deploy, and the `imagens-ref/`
> screenshots) were **deleted** after their salvage was extracted; recover any via `git log --all`/`git show`. The
> per-file salvage trail lives in the archival commit messages.

> **Deferred-but-homed:** many 2-/3-/6- artifacts are stubs that record *where/when/how* an artifact activates
> (e.g. DBML at the corpus DB, OpenAPI/Pact at the backend, K8s at stage 4). The stub **is** the decision — it exists
> so the choice isn't improvised later; it is not empty ceremony.
>
> **Not in `docs/`:** the **executable backlog** lives in **GitLab Issues + the issue board**
> (`jrocha-dev/inclusionist-engine`), not in a Markdown file. The **roadmap** is the board's *Fase 0–6* issues;
> `ROADMAP.md` keeps only the strategy/why-this-order. See `CONTRIBUTING.md`.

| File / folder | Holds | Used by |
|---|---|---|
| `ARCHITECTURE.md` | This map (files, code layout, system context) | everyone — the entry point |
| `ROADMAP.md` | Roadmap strategy + dependency-order rationale (phases are issues !15–!21 on the board) | dev (next work), reviewer (scope) |
| `educational/` | Curriculum layer (pt-BR): Learning Objectives (BNCC + measurable), Curriculum Map, Pedagogical Model | curriculum author, reviewer |
| `1-Discovery/User-Stories.md` | Engine/game feature stories (small, negotiable) | dev |
| `1-Discovery/NFR.md` | The 10 pillars as testable non-functional requirements | dev (constraints), reviewer (audit) |
| `game-design/` | Game craft: Art Bible, character/animation, typography, genre catalog, LM-GM map, game feel | dev, designer |
| `1-Discovery/Event-Storming.md` | Deferred DDD scope for telemetry + Student Manager | (future) |
| `2-Architecture/` … `6-DevOps-SRE/` | The remaining SDD phases — decided section by section (see §… of this doc's evaluation) | dev, reviewer |
| `research/` | Studies with sources that justify decisions | reviewer (evidence), dev |

> **Migration: complete.** The flat `docs/` was consolidated file-by-file into this structure; dead docs were deleted
> (git is the archive). `docs/` root now holds only the four canonical top-level docs (ARCHITECTURE, ROADMAP, PILARES,
> REGISTRO) + the phase/layer folders.

## 3. Code layout (`app/js/`)

*Where* the code lives, by folder (ES modules, TypeScript). The architecture **rules** behind this layout (cohesion,
dependency injection, adapters) and the **system design** (C4, backend) belong in `2-Architecture/` — **not here**.
This file is structure only.

| Folder | Modules |
|---|---|
| `core/` | a11y-sr · collision · constants · **entity** · i18n · layers · loop · rng · screens · state · tiles · world |
| `platform/` | audio · audio-ambient · audio-earcons · audio-jingles · audio-mixer · audio-nav · speech · storage · tts |
| `input/` | devices · edges · gamepad · keyboard · keyboard-runtime · keydown · **latch** · state · touch · touch-bindings |
| `render/` | canvas · cenario-data · city-tex · crt · cvd-matrices · draw · fx · hc-role-data · high-contrast · lq-filter · minimap · parallax · player-anim · props · scene-city · scene-parallax · scene-sky · screen-pipeline · set-cenario · sprite-fx · sprites · textures · title-scene · viewports · viz-modes · viz-setters · weather · wheelchair-sprites · world-tex |
| `ui/` | activities-menu · debug-panel · dom · fonts · hud · layout · map-hub · menu-nav · pause-icons · settings-audio · settings-controls · settings-empathy · settings-motion · settings-motor · settings-panel · settings-typo · settings-visual · shell · title · vlibras · webcam |
| `game/` | activities-registry · activity-content · attract · braille · coin-spawning · coins · elevators · fractions · level-geometry · life · literacy-distractors · physics · player · powerups · quiz · secret-areas · session · traffic |
| (root) | `main.js` — composition root: builds the instances, wires them together, registers the listeners. Was `game.js` until D2; typing it as `main.ts` is the step that remains. |

Engine constants (TILE_TYPES, TUNE, dimensions) live only in `app/js/core/constants.ts` — never duplicated in docs.
The **canonical render Z-order** (named layers, world + overlay scopes; PIXI `zIndex` + DOM `z-index`) and the
**post-process filter chain** (`POST_FX_ORDER`, a11y-correction-last) live only in `app/js/core/layers.ts` — see ADR-0020.
> ⚠️ **Contested by ADR-0027**: a measured flash limiter (WCAG 2.3.1) must run AFTER `A11Y_CORRECTION`,
> because the correction *increases* inter-frame luminance delta and nothing measures downstream of it. Today 2.3.1
> is met by content discipline, which does not scale to 35 games. ADR-0020 needs an amendment.
