# The records moved

**The ADR tree of this project lives in [`the-inclusionist-docs`](https://github.com/the-inclusionist/the-inclusionist-docs)**, in `docs/2-Architecture/adr/` — the same path it had here, so every link written inside a record still works.

The decision is **ADR-0123**, and it declares that address. It supersedes ADR-0068 §5 in part: that record's
argument was always *one place*, and the engine was the incumbent rather than the conclusion.

## What stayed here, and why

📌 **The tree was concentrated; the validators and the gates were not** — the Dev's rule: *«cada repositório
precisa ter seus validadores e gates para ADRs»*. So this repository keeps an `adr` job of its own, and it is
the one that can do what the records' own repository cannot:

- it checks out the tree and runs the validator with **`--repo engine=.`**, which OPENS the `confirmed-by`
  paths marked `engine:` — 24 of them, across 9 records. Without a root they can only be counted;
- it runs `tests/ponteiros-de-registo.node.test.js`, the sieve over prose citations, because a record naming
  a file of THIS tree that no longer exists is a breakage of THIS tree, and it has to go red where somebody
  can fix it.

## Working on both at once

Clone the records beside the engine and everything resolves by itself:

```bash
git clone https://github.com/the-inclusionist/the-inclusionist-docs.git ../the-inclusionist-docs
```

Or point at any checkout explicitly:

```bash
ADR_TREE=/path/to/the-inclusionist-docs/docs/2-Architecture/adr npx vitest run --project node tests/ponteiros-de-registo.node.test.js
python scripts/validate-adr.py /path/to/.../adr --repo engine=.
```

⚠️ Without either, the pointer sieve **skips** — visibly, in the Vitest output — and the CI job that
declares itself responsible for the tree (`ADR_TREE_REQUIRED`) fails instead of skipping.
