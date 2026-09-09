# Engineering rules (SDD phase e — refactoring & finalization)

Rules for refactoring under good engineering/architecture practice: **DRY**, **SOLID**, high cohesion / low coupling,
dependency injection over globals, adapters/DAO at the edges.

## Governing source (for now, this is enough)

These are **already operationalized** by the modularization plan — [`plano-modularizacao.md`](plano-modularizacao.md),
grounded in **arXiv:2409.15152** — which is the ADR for how we break `game.js` apart: cohesion up, coupling down, DI
over globals, adapters at the edges, each extraction superseding the monolith a piece at a time. Until a case isn't
covered by it, we do **not** add a separate rules doc — that plan carries them.

## How decisions are recorded

- A deliberate architectural change is a **new YADR ADR** that **supersedes** the one it replaces — never an
  edit to an accepted record, never a pile of additive ADRs.
  ⚠️ **The SHAPE of that sentence aged and is corrected here** (2026-09-04, ADR-0057): it used to read
  `metadata.status: "superseded by ADR-NNNN"`, and `status` is now an ENUM that holds nothing else. The
  narrative moved to `superseded-by`, `supersedes`, `superseded-in-part` and `errata` — and the validator
  checks the pair in BOTH directions, so a supersession without its back-pointer fails.
- **ADRs are modified during a sprint** and live in
  [`the-inclusionist-docs`](https://github.com/the-inclusionist/the-inclusionist-docs) (`docs/2-Architecture/adr/`)
  — **not** in the sprints folder, and 🔴 since 2026-09-09 (ADR-0123) **not in this repository either**.

> Author's guardrail: *"an LLM 'likes' to solve a problem by writing more, not by revising."* The antidote is
> **tiering** (only the artifacts a Tier-2 project needs) + **supersede-don't-append**, so the record shrinks as it
> corrects instead of growing.
