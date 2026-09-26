# Where the records live

**The engine's records live here, in [`adr/`](adr/README.md)** — one YADR file per decision, and `README.md`, the
index. They came home on 2026-09-26 by **ADR-0242**, in the Dev's words of 2026-09-23: «(i) a engine fica com eles».
The records that belong to the whole project — the pillars, compliance, the organisation and its repositories,
licences and art, the catalogue, the project's governance — stay in
[`the-inclusionist-docs`](https://github.com/the-inclusionist/the-inclusionist-docs), at the same path. A game keeps
the records that are its own in its own repository (ADR-0226 §1); `game-platformer` has six.

## Which tree a new record goes to

One question decides it: **whose repository breaks or must change if this decision changes?** The engine's — its
code, the contract it publishes, the UI it draws, delivery, accessibility, its tooling — goes here. Every repository,
or none in particular, goes to `the-inclusionist-docs`. One game only goes to that game. A record that merely CITES a
game is usually not that game's. The reading of every record, one line each, is in
[`record-ownership-triage.md`](record-ownership-triage.md).

Numbers are one sequence for the whole project: a new record takes the next number free in **both** trees.

## How a citation crosses a repository

- **Every index keeps a row for every record.** A record that lives elsewhere has a row whose link names its
  repository — `| [ADR-0010](docs:docs/2-Architecture/adr/ADR-0010-….yaml) |` — and that row answers for the number.
- **`--repo name=path` declares another repository's root**: the validator reads its tree and index, and opens the
  files the rows point at.
- **A `confirmed-by` carries its repository** (`engine:tests/x`) when the record lives away from the code; a record
  that lives with its code writes the path without a prefix.
- **A supersession pair may cross.** The validator reads the other half from the declared tree and checks the
  mirror; without that root it counts the pointer and says so on every run.

```bash
python scripts/validate-adr.py docs/2-Architecture/adr                     # this tree; what crosses is counted
python scripts/validate-adr.py docs/2-Architecture/adr --repo engine=. \
    --repo docs=../the-inclusionist-docs --repo game-platformer=../game-platformer   # and opened
```

## The gates

The `adr` job in `.github/workflows/ci.yml` validates this tree on every push, with no token, and runs the
validator's own test (`scripts/test-validate-adr.py`), the tempo sieve (`scripts/tempo-dos-registos.py`) and the debt
census (`scripts/divida-dos-registos.py`, with its test). With the `DOCS_READ_TOKEN` secret it also checks out
`the-inclusionist-docs`: it opens what crosses into it, validates the project-wide records there with
`--repo engine=.` — this is the only repository that can open the confirmations naming the engine — and compares the
five files of the records kit, which exist in both repositories and must stay identical
(`tests/the-validator-does-not-drift.node.test.js`). Without the secret those steps are a notice, not a pass.

The prose sieve `tests/records-pointing-at-dead-gates.node.test.js` reads this tree in the ordinary suite: a record
naming a file of this repository that no longer exists is a break of this repository.

A game's records are checked by `game-ci.yml` (`adr-records: true`) against a checkout of this repository, which holds
both the validator and an index that answers for every number in the project.

To run the drift gate locally, clone the records repository beside this one or point at it:

```bash
DOCS_ROOT=/path/to/the-inclusionist-docs npx vitest run --project node tests/the-validator-does-not-drift.node.test.js
```
