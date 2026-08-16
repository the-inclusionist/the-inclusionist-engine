# Security in the pipeline (SDD phase f)

## SAST — static analysis  ✅ adopt now (light)

For a client-only TS app the classic SAST payoff is small (no server, no secret handling yet), but the **supply
chain** is real (we pull npm deps). So adopt the light, high-value pieces now:

- **SAST** — `Security/SAST.gitlab-ci.yml` ✅ (Semgrep-based, Free tier). Replaced **CodeQL** when the project left
  GitHub. Be honest about the trade: CodeQL's JS/TS analysis was deeper. This is what Free-tier GitLab offers, and
  for a client-only app with no server and no secret handling the delta is small — but it is a delta, not a wash.
- **Secret detection** — `Security/Secret-Detection.gitlab-ci.yml` ✅. New: there was no equivalent before, so the
  move bought us this one.
- **`npm audit`** — ✅ in `.gitlab-ci.yml` as a fast gate (`--omit=dev --audit-level=high`: fails on high+ in the
  deps that actually ship to the browser).
- **Scheduled dependency updates** — ⏸ **deliberately absent until the MVP ships** (Dev's call, 2026-08-06).
  Dependabot was GitHub-only and GitLab's Dependency Scanning is Ultimate-tier, so the move left no scheduled
  updater. Rather than adopt Renovate mid-flight, we run without one until the MVP is done. What this costs, stated
  so the choice stays informed rather than forgotten:
  - **What still protects us:** `npm audit --omit=dev --audit-level=high` fails the pipeline on every push, so a
    *known* high/critical vulnerability in a shipping dependency cannot land silently.
  - **What we give up:** nothing proposes upgrades. Audit only reacts to advisories already published; a dependency
    that is merely stale, or vulnerable-but-unadvised, goes unnoticed. And the gap compounds — the longer nothing
    updates, the larger and riskier the eventual bump becomes.
  - **Why it is acceptable now:** the app is client-only, has no server, no auth and handles no data at rest; the
    attack surface is a static bundle (see `../2-Architecture/STRIDE.md`). That reasoning **expires with the
    backend** — the moment there is a server or child data in transit, this cannot wait for a milestone.
  - **Revisit trigger:** MVP shipped, or a backend appears, whichever comes first. Tracked as a GitLab issue so
    "after the MVP" has somewhere to be checked instead of being remembered.

Full application SAST scales up **with the backend** (server code, auth, data handling).

## DAST — dynamic analysis  ⏸ defer

Scans a **running** app for vulnerabilities — needs server endpoints. The static site has almost no attack surface
(see [`../2-Architecture/STRIDE.md`](../2-Architecture/STRIDE.md)). Runs in CI/CD or pre-prod **once the backend
exists**.

## Pentest  ⏸ scheduled activity (not a pipeline stage)

A point-in-time / scheduled engagement, **not** a CI stage. Trigger: the backend + **child personal data** surface
exists (LGPD/COPPA — a T3-leaning concern). Scope it against the DFD/STRIDE trust boundaries at that point.
