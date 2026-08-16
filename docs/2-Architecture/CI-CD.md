# CI / CD

The pipeline in one page. The **source of truth is the pipeline file** — `.gitlab-ci.yml`; this doc
explains *intent* and points there, it does not restate the YAML.

## CI (on every push to `main` / merge request)

Runs on GitLab CI (Node 24, pinned to `.node-version`):

1. **Supply chain** — `npm audit --omit=dev --audit-level=high` (only the deps that reach the browser).
2. **Typecheck** — `tsc --noEmit` (the code is TypeScript; types are a gate, not decoration).
3. **Tests** — `vitest run` (both projects: **node** logic + **browser**/Playwright render/DOM).
4. **Build** — `vite build` (must produce `dist/` cleanly).
5. **a11y** — axe-core against the running preview (own job; see `../6-DevOps-SRE/CI-QA.md`).
6. **SAST + secret detection** — GitLab's own templates (see `../6-DevOps-SRE/Security-Pipeline.md`).

A red pipeline blocks merge. Keep it fast; heavier suites (e.g. future hardware-battery runs) are separate, opt-in.

## CD (deploy)

**Cloudflare Pages.** Two shapes are possible and they are mutually exclusive — exactly one must be live:

- **git-connected** (the historical setup): CF watches the repo, builds and publishes `dist/` on every push to
  `main`. The `pages_deploy` job in `.gitlab-ci.yml` must stay disabled, or each push deploys twice.
- **direct upload**: CF holds no repo; `pages_deploy` runs `wrangler pages deploy dist/` with
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as masked CI variables.

The PWA service worker (vite-plugin-pwa, content-hash) handles cache-busting either way, so no manual version bump
is needed for clients to update.

## Release (versioning)

Not part of CI. Cutting a version is a **local, human-run** step: `release-it` (Conventional-Commits changelog +
tag). The build stamps `__BUILD__` from `git describe`. See `plano-versionamento.md`.

## Notes / TODO

- [ ] Add Node env for the local TLS-intercepting antivirus if CI ever runs on a self-hosted runner behind it
  (see `../../CLAUDE.md` §6). GitLab's shared runners are clean, so not needed today.
