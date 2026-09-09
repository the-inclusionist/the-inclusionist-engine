# Data model — Normalization policy

**Default:** normalize to **3NF**. Denormalization is the exception and must be **justified in a YADR ADR** (see
`the-inclusionist-docs · docs/2-Architecture/adr/`), never done ad hoc.

This doc is the policy; each concrete "here we do NOT normalize to the last step" decision is its own ADR, linked below.

## When we may stop short of full normalization

Record the reason per case, but the usual, defensible triggers are:

- **Read-heavy corpus lookups** — the word/corpus tables are written rarely and read constantly by activities;
  duplicating a derived attribute (e.g. a precomputed syllable count) to avoid a join can be worth it.
- **Analytics / reporting** — if a Star Schema warehouse appears, its fact/dimension tables are denormalized **by
  design** (that is the model), separate from the normalized operational corpus.
- **Immutable snapshots** — an assessment record may copy the word text it tested, so history survives a later edit
  of the corpus (audit integrity > storage).

## When we must NOT denormalize

- Anything touching **child personal data** — keep it normalized and single-sourced; duplication multiplies the LGPD
  surface and the places a consent revocation must reach.

## Records

| ADR | Table / case | Decision |
|---|---|---|
| _(none yet)_ | | |
