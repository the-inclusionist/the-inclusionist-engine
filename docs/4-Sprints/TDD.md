# TDD / XP (SDD phase d)

How we test while building. **Already our practice** — this doc is the canonical statement of it.

- **Test-driven:** every module is **born with a test** (write the test with, or before, the code). No module lands
  untested.
- **Runner:** **Vitest**, two projects — `node` (pure logic, no PIXI/DOM) and `browser`/Playwright (render/DOM).
- **Patterns:** **ZOMBIES** (Zero, One, Many, Boundaries, Interfaces, Exceptions, Simple — didactic scaffolding) +
  **Right-BICEP** (Right results, Boundary, Inverse, Cross-check, Error conditions, Performance — rigor).
- **The AI runs Node** (measured 2026-09-04): it runs `npx tsc --noEmit` and both Vitest projects itself, and proves
  every gate red by mutation before it counts; the Dev reviews results rather than running them.
- **Test Case as a checklist:** the human/manual checklist (and the prospective hardware batteries) live in
  [`../3-Sprint-Design/Test-Plan.md`](../3-Sprint-Design/Test-Plan.md). The automated suites are the source of truth;
  the checklist covers what a machine can't run yet.

Language of tests/target: this is a TypeScript + Vitest codebase — **not** Jest/PyTest/JUnit (those belong to other
stacks the SDD schema lists generically).
