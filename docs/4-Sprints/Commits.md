# Commits (SDD phase d)

- **Conventional Commits** — `feat`, `fix`, `refactor`, `docs`, `build`, `test`, `chore` (+ scope). Drives the
  `release-it` changelog (see `../2-Architecture/plano-versionamento.md`).
- **Atomic** — one logical change per commit; never a single giant "initial".
- **Branch** — small team: direct to `main`; grows to PRs as the team grows.
- **AI-authored commits** carry `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **`Closes #N`** in the footer closes the GitLab issue and moves its card to Done — the **light commit↔requirement
  trace**. The heavy **FEAT-###** id/CI-gate traceability is deferred (see `../CONTRIBUTING.md`).
- No absolute user paths in versioned files; personal to-dos stay in a git-ignored file, not the repo.
