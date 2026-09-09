# 6 — DevOps / SRE (SDD phase f)

Artifacts:

- **[CI-QA.md](CI-QA.md)** — QA gates in CI: **axe-core a11y** (✅ now, verifies the WCAG in NFR) · **k6 load/perf**
  (⏸ backend, verifies the SLOs).
- **[Security-Pipeline.md](Security-Pipeline.md)** — **SAST/Dependabot/CodeQL** (✅ now, light) · **DAST** (⏸ backend)
  · **Pentest** (⏸ scheduled, at the child-data surface).
- **[SLO.md](SLO.md)** — **SLI/SLO/Error-Budget/SLA** (⏸ backend, rigor by tier).
- **[Breaking-Changes.md](Breaking-Changes.md)** — what left the PACKAGE since `7.0.1`, by CHANGE: what moved
  and why. Written as the major is built, not reconstructed after it.
- **[Adopting-8.0.md](Adopting-8.0.md)** — the same facts by **REPOSITORY**: which change touches which
  consumer, and on which line. ⚠️ It has no gate in this repository, and that is deliberate — the catalogue is
  five other repositories, and a test that read them would make this repo's CI depend on their state
  (ADR-0121). It is a step in the procedure.

**Live today:** only CI/CD itself — typecheck + Vitest + build on GitHub Actions. ⚠️ **There is NO deploy
connected**: this line used to say «Cloudflare Pages deploys `dist/`», and the Dev measured otherwise on
2026-09-07 — no Cloudflare Pages project is attached to any repository. While that holds, **a push is not a
publication**, and `dist/` reaches somebody only by a manual step
(detail in [`../2-Architecture/CI-CD.md`](../2-Architecture/CI-CD.md)).

**Deferred to the backend stages** (see `../2-Architecture/backend-cloud-roadmap.md`): OpenTelemetry (stage 3),
Platform Playbook · Canary/Argo · SRE runbooks · dashboards (stage 4).

> Learning **telemetry** (xAPI/Caliper/LTI) is a **separate, educational** concern (store-and-forward, privacy-first),
> scoped in `../1-Discovery/Event-Storming.md` — not infra observability.
