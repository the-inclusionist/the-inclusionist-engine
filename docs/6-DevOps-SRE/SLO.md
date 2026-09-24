# SLI / SLO / Error Budget → SLA (SDD phase f)  ⏸ defer to backend

**Deferred.** SRE reliability targets measure a **service we operate**. Today there is no such service — the PWA is
static, and today it is not deployed anywhere (no Cloudflare Pages project is connected; when one is, CF owns its own
uptime), and there is no SLA to any customer. Nothing to instrument yet.

## When

Activates at stage >= 1 of [`../2-Architecture/backend-cloud-roadmap.md`](../2-Architecture/backend-cloud-roadmap.md)
(a backend we run — Nakama/services). **Rigor by tier:** a light SLO for a school-pilot backend; tighter as it grows
toward T3 (child data, availability guarantees to schools).

## What to define then

- **SLIs** — availability, latency (p50/p99), error rate of the backend endpoints the games consume.
- **SLOs** — the target per SLI (e.g. p99 < 200 ms; 99.9% availability), set per tier.
- **Error budget** — the allowed miss; when burned, feature work yields to reliability work.
- **SLA** — only if/when there is a contractual promise to a school/partner.

The SLOs here are what **k6** load tests verify (see [`CI-QA.md`](CI-QA.md)) — the SLO defines the target, k6 proves it.

> Client-side targets (boot, FPS, offline) are **NFR thresholds** (`../1-Discovery/NFR.md`), not service SLOs.
