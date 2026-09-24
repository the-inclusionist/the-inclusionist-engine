# Security in the pipeline (SDD phase f)

## SAST — static analysis  ✅ adopt now (light)

For a client-only TS app the classic SAST payoff is small (no server, no secret handling yet), but the **supply
chain** is real (we pull npm deps). So adopt the light, high-value pieces now:

> ⚠️ **Rewritten 2026-09-06.** This section described GitLab's own SAST and Secret-Detection templates. Two
> things about them turned out to be false, and the second is the reason the whole section changed.

- **SAST** — **semgrep**, pinned to an exact version, as a step in `.github/workflows/ci.yml` ✅. It replaced
  GitLab's Semgrep-based template, which had itself replaced **CodeQL** when the project left GitHub in
  August. ⚠️ **And GitHub's CodeQL did NOT come back with the move, for a price rather than a preference:**
  code scanning is free only on **public** repositories, and on a private one it needs GitHub Advanced
  Security, which is paid — and this repository is still private (checked 2026-09-24): ADR-0125 decided on
  2026-09-09 that the organisation goes public, superseding ADR-0066 §3's visibility clause, but that has not
  happened yet. So the honest
  statement is the same as before, with a different owner: semgrep's JS/TS analysis is shallower than
  CodeQL's, and for a client-only app the delta is small but real.
- **Secret detection** — **gitleaks**, pinned, as a step ✅, and it scans the **whole history**
  (`fetch-depth: 0`) rather than the tip: a secret committed and later deleted is still in the history, and
  the history is what becomes public. GitHub's native secret scanning is free on public repositories only,
  same clause as above.
  ⚠️ **AND THE PREVIOUS PAIR NEVER RAN. Not once.** Measured 2026-09-05: both GitLab template jobs died on
  `/bin/sh: npm: not found`, exit 127 — a `before_script` inherited from a `default:` block, in analyzer
  images that have no Node — and both carried `allow_failure: true`, so the failure showed as a grey ✗ that
  nobody read for weeks. This document said "✅" about two gates that had never produced a result. The
  replacements are NOT `continue-on-error`.
- **`npm audit`** — ✅ in `ci.yml` as a fast gate (`--omit=dev --audit-level=high`: fails on high+ in the
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
  - **Revisit trigger:** MVP shipped, or a backend appears, whichever comes first. Tracked as a GitHub issue
    so "after the MVP" has somewhere to be checked instead of being remembered.
  - ⚠️ **And Dependabot is available again**, since the project is back on GitHub — it was ruled out in August
    for being GitHub-only. Whether to switch it on is the same decision as before and has not been retaken;
    what changed is that the reason it was impossible has gone.

Full application SAST scales up **with the backend** (server code, auth, data handling).

## DAST — dynamic analysis  ⏸ defer

Scans a **running** app for vulnerabilities — needs server endpoints. The static site has almost no attack surface
(see [`../2-Architecture/STRIDE.md`](../2-Architecture/STRIDE.md)). Runs in CI/CD or pre-prod **once the backend
exists**.

## Pentest  ⏸ scheduled activity (not a pipeline stage)

A point-in-time / scheduled engagement, **not** a CI stage. Trigger: the backend + **child personal data** surface
exists (LGPD/COPPA — a T3-leaning concern). Scope it against the DFD/STRIDE trust boundaries at that point.
