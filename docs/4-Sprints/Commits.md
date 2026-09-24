# Commits (SDD phase d)

- **Conventional Commits** — `feat`, `fix`, `refactor`, `docs`, `build`, `test`, `chore` (+ scope). Drives the
  `release-it` changelog (see `../2-Architecture/plan-versioning.md`).
- **Atomic** — one logical change per commit; never a single giant "initial".
- **Branch** — small team: direct to `main`; grows to PRs as the team grows.
- **AI-authored commits** carry a `Co-Authored-By:` trailer naming the model that wrote them (today `Claude Opus 5.5 <noreply@anthropic.com>`), and a `BREAKING CHANGE:` footer goes LAST, after `Refs` and the trailer.
- **`Closes #N`** in the footer closes the GitHub issue — the **light commit↔requirement
  trace**. The heavy **FEAT-###** id/CI-gate traceability is deferred (see `../CONTRIBUTING.md`).
- No absolute user paths in versioned files; personal to-dos stay in a git-ignored file, not the repo.
