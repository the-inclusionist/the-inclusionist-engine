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
- **Scheduled dependency updates** — ⛔ **gap opened by the move.** Dependabot was GitHub-only and GitLab's
  Dependency Scanning is Ultimate-tier, so nothing proposes updates on a schedule any more; `npm audit` only
  catches what is already known-vulnerable at build time. **Open decision** (candidates: Renovate as a scheduled
  CI job, or a recurring manual `npm outdated` review). Until it is closed, this is a real hole, named here rather
  than left to be discovered.

Full application SAST scales up **with the backend** (server code, auth, data handling).

## DAST — dynamic analysis  ⏸ defer

Scans a **running** app for vulnerabilities — needs server endpoints. The static site has almost no attack surface
(see [`../2-Architecture/STRIDE.md`](../2-Architecture/STRIDE.md)). Runs in CI/CD or pre-prod **once the backend
exists**.

## Pentest  ⏸ scheduled activity (not a pipeline stage)

A point-in-time / scheduled engagement, **not** a CI stage. Trigger: the backend + **child personal data** surface
exists (LGPD/COPPA — a T3-leaning concern). Scope it against the DFD/STRIDE trust boundaries at that point.
