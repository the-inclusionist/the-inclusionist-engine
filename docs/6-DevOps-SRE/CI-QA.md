# QA in CI/CD (SDD phase f)

The automated quality gates that run in the pipeline (`.github/workflows/ci.yml`). Split by "now" vs "with backend".

## a11y — axe-core  ✅ adopt now (!4)

**`scripts/axe-check.mjs`** runs axe-core against the **RUNNING app** (Playwright → the `vite preview` server) — the
reliable method (live DOM **with CSS**; a DOM-injection unit test gives false contrast/visibility results). Matches the
old AUDITORIA-E13 (which found 0 violations). Excludes the third-party **VLibras** widget. **Purpose: verify the WCAG
requirements *declared* in [`../1-Discovery/NFR.md`](../1-Discovery/NFR.md)** — without this, NFR states the target but
nothing enforces it.

- Scope: the DOM shell (menus, `aria-live`, roles, labels, contrast on DOM UI). The **canvas** render isn't
  axe-testable — its a11y IS the DOM shell + captions, which axe covers.
- Gate: fails CI on any WCAG-A/AA violation in our app.
- **In CI:** the `a11y` job builds, serves `dist/` with `npm run preview -- --port 4173`, waits for
  `/quiz.html` and runs `AXE_URL=http://localhost:4173/quiz.html npm run test:a11y`. ⚠️ The target is `/quiz.html`,
  not `/`: `dist/` no longer emits an `index.html` (it left with the cartridge, #111).
- **Locally:** `npm run build && npm run preview`, then the same `AXE_URL=… npm run test:a11y`
  (`@axe-core/playwright` is already a dev dependency).

## Load / performance — k6  ⏸ defer to backend

**k6** (Grafana; preferred over Gatling for a JS/TS team — scripts in JS). **Purpose: verify the targets defined by the
SLIs/SLOs** in [`SLO.md`](SLO.md) (e.g. p99 < 200 ms under load). Deferred because there is no server to load today
(static PWA on Cloudflare). Owner when active: the perf gate fails if a run misses an SLO target.

> Client-side performance targets (boot time, FPS on target hardware, offline) are **not** load tests — they live as
> NFR thresholds and hardware batteries (`../3-Sprint-Design/Test-Plan.md`).
