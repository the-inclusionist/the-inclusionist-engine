# Contributing

## How we work

- **Language:** English for code, comments, docs, and commit messages (open-source lingua franca). **pt-BR only for
  intrinsically-Brazilian domain content** — BNCC-mapped learning objectives and literacy pedagogy, which are
  Portuguese by nature.
- **Commits:** atomic (one logical change each), **Conventional Commits** (`feat`, `fix`, `refactor`, `docs`,
  `build`, `test`, `chore`). Small team: direct to `main`; grows to PRs as the team grows. AI-authored commits carry
  a `Co-Authored-By` trailer.
- **Tests:** every module ships with tests — **Vitest**, two projects: `node` (pure logic, no PIXI/DOM) and
  `browser`/Playwright (render/DOM). Patterns: **ZOMBIES** (didactic) + **Right-BICEP** (rigor).
- **Validation before "done":** `npm run build` + `npx vitest run` + `npx tsc --noEmit` green.
- **Backlog & issues:** the executable backlog lives in **GitLab Issues + the issue board**
  (`jrocha-dev/inclusionist-engine`), **not** in a Markdown file. The roadmap is the board's **Fase 0–6** issues;
  `docs/ROADMAP.md` holds only the strategy / why-this-order.
  Priority is carried by labels **`P0`/`P1`/`P2`** (until a Project single-select field is set up); area/type labels
  (`a11y`, `curriculum`, `engine`, `docs`, `infra`, `bug`, `feature`, `research`, `pillar`, …) classify them. Commits
  close issues with **`Closes #N`** — the light commit↔requirement trace (the heavy FEAT-### traceability is deferred).
- **Documentation is actionable:** a doc change becomes a **test** (that verifies it), a **task** (a GitLab issue), or
  an **ADR** (that decides it). With very few exceptions, a doc that transforms into none of these earns its keep only
  as a map/index. Ask "what does this become?" and create it.
- The **map of where everything lives** is [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **the first doc to open**
  for any task, to find what to read/change. Any structure/name/convention change is reflected there the same commit.
  The AI agent's operating rules are in [`CLAUDE.md`](CLAUDE.md).

## Contribution terms — read this before your first patch

Two of them, and the second one exists because you would otherwise assume the wrong thing.

### 1 · Code: sign off every commit (DCO)

Every commit carries a trailer:

```
Signed-off-by: Your Name <you@example.com>
```

which `git commit -s` adds for you (`git rebase --signoff` fixes a branch you already wrote). It is the
[Developer Certificate of Origin](https://developercertificate.org/): you are stating that you wrote the
patch, or that you have the right to submit it under this project's licence. **CI fails a pull request
whose commits lack it.**

⚠️ **It transfers nothing, and that is deliberate.** The patrimonial owner of this software is the
Município (Lei nº 9.609/1998, art. 4º), and publication is still a *pedido* in an administrative process —
so there is no party a contributor agreement could assign rights to. A CLA assigning to the developer would
have a public servant receive rights over his employer's work. See **ADR-0078**.

### 2 · Art: it is NOT free, and you should know that before you draw

The **code** is AGPL-3.0-or-later. The **art is not**, and this is a decision rather than an oversight
(`docs/LICENSES.md` §2): the characters must not be free to use anywhere — not in an adult product, for
instance — and **no free licence can carry a restriction on the field of use**. There is no such thing as
art that is simultaneously free and restricted.

So, if you contribute art:

- **you keep authorship** (Lei nº 9.610/1998). You are granting this project the right to use, modify and
  distribute your work under the project's art regime, not giving the work away;
- **it will not be redistributable as free culture**, and people who receive the game will not be free to
  reuse it;
- ⚠️ **one restriction travels with part of the existing art**: pieces generated with PixelLab may not be
  used to train a model (`docs/LICENSES.md` §4). The project cannot grant downstream more than it received.

⚠️ **We are saying this at the door on purpose.** Somebody who volunteers art to a public-good project
reasonably expects it to end up free. Here it does not, and finding that out afterwards would be our fault.

---

## Documentation model (why our docs look the way they do)

Tier **T2** (educational platform, LGPD/child-data). We adopt a **lean subset** of a fullstack SDD schema — each
artifact is either **adopted now**, a **deferred-but-homed stub** (records where/when/how it activates), or an
**explicit rejection**. The governing decision, with the full adopt/defer/reject matrix and rationale, is
**[ADR-0003](docs/2-Architecture/adr/ADR-0003-tiered-sdd-documentation-subset.yaml)** — read it before adding or
dropping a doc type.

**Cut rule:** every statement in a doc is **either** (a) reducible to a machine-verifiable checklist/test
(threshold/schema) **or** (b) a decision record an auditor needs to reconstruct reasoning. Anything else is noise and
is cut.

## Requirements — a two-layer model (deliberate, and unusual)

> Experienced engineers usually expect **one** requirements form: a formal **SRS** or a backlog of **user stories**.
> We use **neither** as the primary form for the curriculum. Here is the rationale — read it before objecting.

This is a **curriculum engine**. Its requirements are hundreds→thousands of learning targets across **3 early-
childhood years + 9 fundamental years + 3 secondary years**, many disciplines, all bound to **BNCC** skill codes
(the Brazilian national curriculum — i.e. regulation, not a negotiable backlog).

- A classic **SRS / EARS** ("when X, the system shall Y") is built for *system behaviour*, not pedagogical mastery
  targets; a single SRS at this scale is unwieldy and does not map cleanly to BNCC codes.
- **User stories** are for *small, negotiable, evolving* feature sets. A national curriculum is *large, fixed, and
  standards-bound* — user stories lose structure, traceability, and coverage analysis ("is every year-1 Portuguese
  BNCC skill covered by a game?") at this scale.

So we **split by layer**:

| Layer | Form | Where |
|---|---|---|
| **Curriculum** (large, fixed, BNCC-bound) | **Curriculum Map (Scope & Sequence)** + **Learning Objectives** — each objective = a BNCC skill code + a *measurable* criterion (e.g. "given a phoneme, selects the correct grapheme in ≥80% of attempts") | `docs/educational/` (pt-BR) |
| **Engine / game** (small, negotiable software features) | light **User Stories** | `docs/1-Discovery/User-Stories.md` + the GitLab backlog |

> **Layer boundary (Dev's rule):** `1-Discovery/` is **software/engine only**; all pedagogical content — activities,
> learning objectives, curriculum, pedagogical fundamentals — lives in `docs/educational/`. Which educational
> artifacts we adopt/defer/reject is recorded in
> [ADR-0004](docs/2-Architecture/adr/ADR-0004-educational-documentation-subset.yaml).

The curriculum layer *is* the SRS of learning software, in the domain-native form. Curriculum Map + Learning
Objectives are recognized instructional-design artifacts, structured/traceable/auditable — which matters for
public-education procurement. This is not us avoiding rigor; it is choosing the rigor that fits the domain.
