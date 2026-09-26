# CI / CD

The pipeline in one page. The **source of truth is the workflow file** — `.github/workflows/ci.yml`; this doc
explains *intent* and points there, it does not restate the YAML.

> ⚠️ **Rewritten on 2026-09-06.** This page described `.gitlab-ci.yml` as the source of truth. That file
> was **removed**: the GitLab project is archived (ADR-0066 §5) and could no longer run. The port to
> GitHub Actions is what ADR-0066 §4 called *work, not a copy* — and two things really changed, not
> just their address. They are marked with ⚠️ below.

`game-ci.yml`, next to it, is a different thing: the reusable gate every **game** repository calls
(ADR-0068 §4). The engine itself does not use it.

⚠️ **A workflow that does not parse is not a red run — GitHub runs it with no jobs**, and says nothing. That is
how `ci.yml` checked nothing from `b764c41b` (2026-09-24) to `2a922c1b`: a comment at column 0 had cut a
`run: |` block. The check therefore lives in the suite a person runs before pushing, not in CI:
`tests/workflow-run-blocks-are-not-cut.node.test.js` reads every workflow for a cut block scalar and for tabs.

## CI (on every push to `main` and every pull request)

Runs on **GitHub Actions**, Node pinned by `.node-version`. **Six jobs**, and what each one blocks:

| job | what it blocks |
|---|---|
| `gate` | supply chain, types, tests, build, the precache budget and the annual compliance report |
| `adr` | the records — eight checks, among them the bidirectional supersession pointer |
| `a11y` | axe against the **served** app |
| `dco` | `Signed-off-by` on every pull request |
| `secrets` | a secret anywhere in **the whole history** |
| `sast` | static analysis |

Inside `gate`, in order, and the order is an argument:

1. **Supply chain** — `npm audit --omit=dev --audit-level=high`. Only the production dependencies, which
   are the ones that reach a child's browser. First, because a vulnerable dependency makes the rest
   moot.
2. **Typecheck** — `npm run typecheck` (`tsc --noEmit`), with no budget. The 273-error debt of the conversion
   reached zero on 2026-08-26 and the budget gate left; a new error is your error.
3. **Tests** — `npm test` (`vitest run`), both *projects*: **node** (pure logic) and **browser**/Playwright
   (render/DOM), after installing Chromium.
4. **Build** — `npm run build` (`vite build`), which has to produce a clean `dist/`.
5. **Precache budget** — `npm run check:precache`. ⚠️ A `revision: null` on a URL with no build hash makes
   the installed service worker serve those bytes **forever**; 97 of 141 entries were frozen on
   2026-08-25, on devices nobody can reach.
6. **Annual compliance report** — `npm run check:annual-report` (ADR-0053). **Dormant** until a first year is
   declared, and it prints a notice saying so on every run — a dormant gate is a notice, not a pass. See
   [`../compliance/README.md`](../compliance/README.md).

And outside `gate`:

7. **a11y** — axe-core against the preview serving `dist/`, which is what a school would receive (see
   `../6-DevOps-SRE/CI-QA.md`). ⚠️ The target is **`/quiz.html`**, not `/`: `dist/` no longer emits an
   `index.html` (it left with the cartridge, #111), and the readiness probe hits the same page the gate audits.
8. **ADR** — the records' validator. A gate that did not exist on GitLab: the index promised
   machine-readable records and nothing checked, and five of twenty-six did not parse.
   🔴 **The engine's tree lives here again (ADR-0242)**, so the job validates `docs/2-Architecture/adr/` on every
   push with no token, and runs the validator's own test, the tempo sieve and the debt census. What crosses into
   `the-inclusionist-docs` — index rows and supersession pointers — is counted and said. With the
   `DOCS_READ_TOKEN` secret it also checks that repository out and: opens what crosses; validates the project-wide
   records there with `--repo engine=.`, the part **only this side can do** (open the `confirmed-by` paths marked
   `engine:`); and runs `tests/the-validator-does-not-drift.node.test.js` with `DOCS_ROOT_REQUIRED=1`, so the five
   files of the records kit cannot drift between the two repositories. The prose sieve over dead gates
   (`tests/records-pointing-at-dead-gates.node.test.js`) runs in the `gate` job's suite, since its tree is local.
   ⚠️ **Without the `DOCS_READ_TOKEN` secret the cross-repository steps are DORMANT**: they announce that they
   fetched nothing, and they **do not fail**. It is the shape of `check:annual-report` — a dormant gate is a
   notice, not a pass — and the reason is the one in `ci.yml`'s own header: a `main` that is red for an
   administrative reason teaches people not to read red. A workflow's `GITHUB_TOKEN` does not reach another
   private repository (measured in run `34352635399`, `Not Found`).
9. **DCO** — `Signed-off-by` on every PR (ADR-0078). Pull requests only: the maintainer's push is already
   attributed by git.
10. ⚠️ **SAST + secret detection — THEY CHANGED TOOLS, and for a price.** They were the GitLab templates.
    GitHub's native equivalents — *code scanning* (CodeQL) and *secret scanning* — are free **only on
    public repositories**; on a private one they require GitHub Advanced Security, which is paid, and this
    repository is **still private** (checked 2026-09-24). ADR-0125 (2026-09-09) decided that the organisation
    goes public, superseding the visibility clause of ADR-0066 §3, but that has not happened yet, and the
    scanners must not wait for it. So they are **gitleaks** (8.30.1) and **semgrep**
    (image 1.176.0), open source, **pinned to an exact version** — a scanner that changes its rules on its own
    is a gate whose verdict nobody can reproduce. gitleaks scans the **whole history** (`fetch-depth: 0`),
    because a secret committed and then deleted is still in the history, and it is the history that becomes
    public. See `../6-DevOps-SRE/Security-Pipeline.md`.
    📌 gitleaks reads **`.gitleaks.toml`** at the root: every default rule (`useDefault = true`), plus an
    allowance per false positive that names the file, the rule and the reason. The first one is the SHA-256
    digest of Kokoro's public `tokenizer.json`, which `generic-api-key` read as a key because the constant's
    name contains «TOKEN»; it kept the job red from 2026-09-14 on. The second is a line of prose in the
    modularisation plan, «access to localStorage: keys+defaults+validation», which the first one hid. A finding
    is allowed there, never by loosening a rule.

⚠️ **And neither of them is `continue-on-error`.** On GitLab both carried `allow_failure: true` and had been
**red since they were added** — they died on an `npm: not found` inherited from a `default:` block, and the grey
✗ went unread for weeks. Porting them means precisely that they now fail.

A red pipeline blocks the merge. Keep it fast; heavy suites (target-hardware batteries, for example) are
separate and opt-in.

## CD (deploy)

⚠️ **There is NO deploy connected today.** The Dev measured on 2026-09-07 that **no Cloudflare Pages project is
attached to any repository**. While that holds, **a push is not a publication**, and `dist/` reaches somebody
only through a manual step.

When a deploy is connected, it will be **Cloudflare Pages**, in one of two forms that are **mutually exclusive** —
exactly one may be live:

- **git-connected**: CF watches the repository, builds and publishes `dist/` on every push to `main`.
- **direct upload**: CF keeps no repository; a step runs `wrangler pages deploy dist/` with
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as secrets.

The former git connection pointed at **GitLab**, which is archived, and a Pages project does not switch its
source repository — recreating the project is the way.

The service worker (vite-plugin-pwa, by content hash) handles cache invalidation in both cases, so
no client needs a manual bump to update.

## Release (versioning)

Not part of CI. Cutting a version is a **local, human** step: `release-it` (Conventional Commits changelog +
tag; `git.push` is `false`, so it does not push). The build stamps `__BUILD__`: the version from `package.json`,
and `git describe` decides whether it is clean or carries `+sha`/`-dirty`. See `plan-versioning.md`.

⚠️ **And `.release-it.json` has had `npm.publish` set to `true` since 2026-09-05 (ADR-0072)**, which makes
`npm run release` publish the package **publicly** on npmjs — `@the-inclusionist/engine` is there, at `9.0.0` when
this was checked (2026-09-24). A release is therefore a publication, not only a version cut, and the `npm publish`
step spends something that cannot be taken back: the Dev runs it.

## Notes / TODO

- [ ] Connect a deploy: recreate a Cloudflare Pages project pointed at the GitHub repository (or set up direct
  upload).
- [ ] A Node environment for an antivirus that re-signs TLS, **if** CI ever runs on a self-hosted runner
  behind one. GitHub's runners are clean, so it is not needed today.
