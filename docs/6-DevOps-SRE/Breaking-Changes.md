# Breaking changes since v7.0.1 — what a consumer must do

**Measured on 2026-09-07 by comparing the published surface at `v7.0.1` against `HEAD`**, not read off the
commit subjects. The script walks every `.ts` under `app/js/**` (which is what `package.json`'s `exports`
publishes) at both revisions and diffs the exported names.

> ⚠️ **This file exists because the commits do not carry the information.** Five commits since `v7.0.1` mark
> themselves breaking with `!` in the subject, and **none of them has a `BREAKING CHANGE:` footer**. The
> `v7.0.0` entry in `CHANGELOG.md` shows what this repository's changelog looks like when the footers are
> there: paragraphs telling a consumer what to change. Without them the generated section can only carry a
> subject line, and a subject line is not a migration.
>
> The rule for next time is one line: **a commit that breaks the package writes the footer, and the footer
> is addressed to whoever has to edit their code because of it.**

## The five commits

| | |
|---|---|
| `b55b88e` | the cartridge leaves — this repository becomes the engine (ADR-0036) |
| `7ab9658` | the two dead constants leave |
| `91b4cd2` | gravity and the coin quota leave the engine |
| `40f2dd9` | water, ladder, gate and secret area leave |
| `3726087` | `KeyScheme` closes on the fourteen positions |

## 1 · Thirty-three modules left the package

| where | count | what |
|---|---|---|
| `app/js/game/**` | 31 | the platformer itself — `carry`, `physics`, `coins`, `life`, `quiz`, … |
| `app/js/main.ts` | 1 | the root that wired the platformer |
| `app/js/render/sprites.ts` | 1 | the platformer's sprite sheet loader |

**What to do:** they live in `the-inclusionist/game-platformer` now. A consumer that imported any of them was
importing a *game* from an *engine*, which is the coupling ADR-0036 ordered removed. There is no shim and
there deliberately is not one — a shim here would re-create the dependency in a form nobody could measure.

## 2 · Eight constants left `core/constants.ts`

`JUMP_BASE` · `TUNE` · `COIN_TARGET` · `ehAgua` · `ehEscada` · `ehPortao` · `ehChave` · `ehSecreto`

**What to do:** they are questions only a platformer asks, and the platformer now answers them itself —
`game/tuning.ts` for `TUNE` and `COIN_TARGET`, `game/tile-flags.ts` for the four predicates, written over the
engine's still-published `TILE_TYPES`. A consumer of another genre never used them; a platform-game consumer
copies those two small modules, which is roughly forty lines.

⚠️ `ehPerigo` and `ehTrampolim` **stay**, and the reason is not symmetry: `core/collision.isSolidType` makes
hazard and trampoline solid in wheelchair mode, and hazard solid in blind mode. They are an accessibility
rule, not a tile taste.

## 3 · `KeyScheme` narrowed, and it breaks in three ways at once

```ts
// v7.0.1
export type KeyScheme = Record<string, string[]>;
// HEAD
export type KeyScheme = Record<Action, readonly string[] | null>;
```

| what changed | what a consumer sees |
|---|---|
| the keys are **closed** to the fourteen `Action` positions | a scheme with any other key stops type-checking |
| the values are **`readonly`** | `scheme.jump.push(code)` stops type-checking |
| `null` is now a legal value | `scheme.start.length` stops type-checking without a guard |

**What to do.** `null` means *this transport cannot reach this position* — a split keyboard has no shoulders,
and saying `null` is how the type says so instead of leaving the position quietly absent. Guard before
reading, and build new schemes rather than mutating them.

⚠️ **For data read back from storage, use `EsquemaSalvo`, not `KeyScheme`.** `input/vocabulary-migration.ts`
exports `Record<string, readonly string[]>` precisely for this: a scheme saved by an older version can hold
keys that no longer exist, and the closed type would be lying about what came off the disk. Migrate first,
then hold it as a `KeyScheme`.

## 4 · What is new, and none of it breaks anything

`core/route.ts` (#84) · `ui/panel-shell.ts` (#62/#115) · `educational/adaptive-engine.ts` (#92)

## ⚠️ Before cutting the major, read this

Two pieces of work are **waiting for a major that has not been cut yet**, and cutting `8.0.0` without them
turns each into a `9.0.0`:

- **#104** — the two visual axes. `p.viz` is a field of a published entity that the cartridge also *writes*;
  the measurement on #104 shows the migration has to run in the cartridge's boot, so it is a lockstep edit
  across both repositories. Its own recommendation, written before this file, was to batch it with the #63
  boundary work — and that batching is still available only until this major is cut.
- **#63's deeper boundary** — `TILE_TYPES` moving and `core/collision` splitting in two.
- **`exports["./assets/*"]`** (#119) — it promises the whole of `app/public/` and `files` ships only
  `app/public/vendor`. The narrow door `./assets/vendor/*` now sits beside it and tells the truth.
  ⚠️ **Measured, and it contradicts what #119 assumed:** `app/public/` holds three entries (`vendor/`,
  `_headers`, `icon.svg`) and only `vendor` ships, so everything the wide door can resolve in a published
  tarball is already covered by the narrow one — the rest already 404s. **Removing it breaks no npm
  consumer.** It stays for now because a `file:` consumer reaches the whole tree, and that is the Dev's call.
- **`platform/audio-sonar.SonarCtx.LOGICAL_W`** (#121) — no longer read; the pan width comes from the
  topology. Already optional and `@deprecated`, so removing the field is the only step left.
- **`ui/settings-controls.ACT_LABEL`** — the platformer's eight words living inside the engine, and the
  direct cause of #125: the remap screen built its `aria-label` from it and announced *"Alterar tecla de
  undefined"* in a game that is not the platformer. That use is gone.
  ⚠️ **Correction to what this file said on 2026-09-07.** It claimed the export had *no consumer at all*.
  That was wrong: the claim came from a search whose pattern excluded `main.ts` (it sits directly in
  `app/js/` and the glob required a subdirectory). `game-platformer/app/js/main.ts` imports it and uses it in
  the pause menu's HELP screen. So **removing it is a migration, not a cleanup**: the cartridge has
  `acoesDoJogo()` already and the help screen must move to it first. Listed here so the order is not
  discovered the hard way, and no longer marked `@deprecated`.

This is a decision for the Dev, not a task: cutting the major sooner ships the accessibility fixes that are
already done; cutting it later lets two breaking changes ride one release instead of three.
