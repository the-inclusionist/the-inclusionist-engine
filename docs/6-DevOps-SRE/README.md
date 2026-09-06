# 6 — DevOps / SRE (SDD phase f)

Artifacts:

- **[CI-QA.md](CI-QA.md)** — QA gates in CI: **axe-core a11y** (✅ now, verifies the WCAG in NFR) · **k6 load/perf**
  (⏸ backend, verifies the SLOs).
- **[Security-Pipeline.md](Security-Pipeline.md)** — **SAST/Dependabot/CodeQL** (✅ now, light) · **DAST** (⏸ backend)
  · **Pentest** (⏸ scheduled, at the child-data surface).
- **[SLO.md](SLO.md)** — **SLI/SLO/Error-Budget/SLA** (⏸ backend, rigor by tier).

**Live today:** only CI/CD itself — typecheck + Vitest + build on GitHub Actions, Cloudflare Pages deploys `dist/`
(detail in [`../2-Architecture/CI-CD.md`](../2-Architecture/CI-CD.md)).

**Deferred to the backend stages** (see `../2-Architecture/backend-cloud-roadmap.md`): OpenTelemetry (stage 3),
Platform Playbook · Canary/Argo · SRE runbooks · dashboards (stage 4).

> Learning **telemetry** (xAPI/Caliper/LTI) is a **separate, educational** concern (store-and-forward, privacy-first),
> scoped in `../1-Discovery/Event-Storming.md` — not infra observability.
