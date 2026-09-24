> Historical plan (2026-07-05, corrected 2026-08-26): kept as a record; the current state lives in [`CI-CD.md`](CI-CD.md#release-versioning), `vite.config.ts` and `.release-it.json`.

# Build versioning — release-it + git stamp

Decision (2026-07-05, the Dev): **release-it** (industry standard; you trigger it locally) + a **build stamp from
`git describe`** injected into Vite. A single scheme serves both environments:

> **CORRECTED ON 2026-08-26.** The version NO LONGER comes from `git describe` — it comes from `package.json`. The reason is
> a defect that stayed live for two months: `git describe --tags` only returns a version if there is a REACHABLE TAG, and the
> repository had no tag at all (neither local nor on the remote). `--always` did what it promised and fell back to the
> short SHA, so the game showed `vbbfa193` in the title instead of the version. `package.json` is versioned and
> reaches any clone — shallow, tagless, on CF Pages. It cannot be missing.
>
> `git describe` STAYS, for what it is good at: saying whether this build corresponds to a published version.

| Context | `__BUILD__.version` displayed |
|---|---|
| On the version's tag commit, clean tree | `6.36.1` ← clean "marketing" version |
| Ahead of the tag | `6.36.1+ab12cd3` (version + short SHA, semver build metadata) |
| With uncommitted changes | `6.36.1+ab12cd3-dirty` |
| No readable `package.json` and no git | CF's SHA, or `dev` |

## How it works

- **`vite.config.ts`** computes `BUILD = { version, sha, date, env }` at build time (Node) and injects it via `define:
  { __BUILD__: … }`. `version` comes from `package.json`; `git describe` decides whether it comes out clean or with `+sha`/`-dirty`. Fallbacks:
  `CF_PAGES_COMMIT_SHA` (CF's shallow clone) → `dev`. `date` = the **commit** date (stable across rebuilds of the same commit → does not re-hash the
  bundle for nothing). `env` = `prod` on CF, `local` here.
- **`app/js/env.d.ts`** declares `__BUILD__` for `tsc`. **`main.ts`** reads `__BUILD__.version` (strips the leading `v`; the
  display already prefixes it) with a defensive fallback to the `package.json` version.
- **`.release-it.json`**: `@release-it/conventional-changelog` auto-bumps the version from the **Conventional Commits**
  we already write (`feat`→minor, `fix`→patch, `BREAKING CHANGE`→major) and generates `CHANGELOG.md`. It does **not** publish
  to a registry (it is an app, not a package) and does **not** push by itself (you control the push).

## Bootstrap — DONE on 2026-08-26

The base tag exists: **`v6.36.1`**, annotated, on the commit that created it. And the number was not chosen — it was
COUNTED from the 462 commits in Conventional Commits that had accumulated since `package.json` started saying
`4.164.25` without ever being bumped (`release-it` never ran a release: the only `chore(release)` in the
history is a config fix).

The replay, commit by commit, starting from `4.164.25`:

| type | how many | effect |
|---|---|---|
| `!` / `BREAKING CHANGE` | 2 | major (resets minor and patch) |
| `feat` | 38 | minor |
| `fix` / `perf` | 65 | patch |
| `refactor`/`docs`/`test`/`chore`/… | 357 | none |

→ **6.36.1**. The two `!` are `build!: remove tts-lab submodule` and `chore!: remove the TTS lab code from the
game repo`. It is on record that they are what take the version from 4 to 6; read as repository hygiene instead
of a break, the number would be `4.202.1`. The decision was to read what the commits SAY.

Without the base tag, the first run of `release-it` would have had nowhere to delimit from, and the first entry of
`CHANGELOG.md` would have come out with 462 items.

## Cutting a release (you run it, when you decide)

```powershell
npm run release            # bumps package.json + CHANGELOG.md + commit chore(release) + tag vX.Y.Z (clean tree)
git push --follow-tags     # sends commits + the tag → CF builds and the game starts showing vX.Y.Z
```
`release-it` shows a preview and asks for confirmation before touching anything.

## Cloudflare Pages — adjusting the build command (you, in the dashboard)

For production to show the **clean tag** (and not the SHA), the tags have to come in CF's shallow clone. Prefix the build:
```
git fetch --tags --force && npm run test:node && npm run build
```
If you do not, the fallback still works: production shows `CF_PAGES_COMMIT_SHA` (short) instead of the tag.

## Sources

- [Cloudflare Pages — build env vars](https://developers.cloudflare.com/pages/configuration/build-configuration/) (has `CF_PAGES_COMMIT_SHA`, does **not** have the tag) · [request for the tag as an env var](https://community.cloudflare.com/t/git-tag-available-as-environment-variable-at-build-time/650715)
- [git describe on a shallow clone needs the tags](https://github.com/actions/checkout/issues/338)
- [Injection via Vite `define`](https://vite.dev/guide/env-and-mode) · [git hash in the Vite build](https://zegnat.bearblog.dev/adding-the-git-commit-hash-to-my-vite-build/)
- [release-it](https://github.com/release-it/release-it) · [@release-it/conventional-changelog](https://github.com/release-it/conventional-changelog) · [`standard-version` discontinued](https://github.com/conventional-changelog/standard-version)
