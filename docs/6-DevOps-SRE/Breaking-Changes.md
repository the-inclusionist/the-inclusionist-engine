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

> ⚠️ **RE-MEASURED ON 2026-09-08, and both halves of the number moved.** There are now **14** commits marking
> themselves breaking with `!`, and **9 of them do write the footer** — the rule above took. Six do not, and
> they are the original five plus one new:
>
> | | |
> |---|---|
> | `b55b88e` `7ab9658` `91b4cd2` `40f2dd9` `3726087` | the original five, written before the rule existed |
> | `a270854` | the global pause is gone — `PhaseView.pauseOverlayHidden` left with it |
>
> ⚠️ **The footers were NOT added by rewriting history, and that is a decision rather than an omission.**
> Fixing six footers means an interactive rebase across ~50 unpushed commits — a rewrite of shared history to
> repair a generated changelog section. What the footers would have said is written in this file instead,
> which is the reason this file exists. **Whether to rewrite is the Dev's call**, and the list above is what
> he would need.

## The fourteen breaking commits (five when this file was first written)

| | |
|---|---|
| `b55b88e` | the cartridge leaves — this repository becomes the engine (ADR-0036) |
| `7ab9658` | the two dead constants leave |
| `91b4cd2` | gravity and the coin quota leave the engine |
| `40f2dd9` | water, ladder, gate and secret area leave |
| `3726087` | `KeyScheme` closes on the fourteen positions |
| `6489888` | the wide `./assets/*` door is gone |
| `c3b3235` | a game declares `holdsAtOnce()` |
| `d644164` | the guide stops beeping — `guideT` leaves the entity |
| `465a3dd` `abc1235` `3d0d385` `b0e725f` `e170846` `a270854` | the two visual axes (#104) and the global pause |

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

## 5 · Changes of SHAPE — the half no name gate could see

> ⚠️ **This heading used to say «Twenty-three», and the number went stale within the day.** It was measured
> once, against `v7.0.1`, and every shape change committed afterwards made it a little more wrong while
> looking precise. The table below is the list; the count lives in the portrait
> (`docs/6-DevOps-SRE/public-shape.json`), which is regenerated rather than remembered.

**Measured on 2026-09-08** by extracting the members of every exported `interface` and the right-hand side of
every exported `type` at `v7.0.1` and at `HEAD`, and diffing them.

⚠️ **The two measurements do not overlap by a single entry.** The name diff finds 32 removed modules and 8
removed constants; the shape diff finds the 23 below; **no item appears in both**. In every one of the 23 the
exported *name* is exactly as it was — what changed is what a consumer has to write inside it. That is why
`§1`–`§4` of this file, all measured from names, missed the changes that actually break the four games.

| module | change | what a consumer sees |
|---|---|---|
| `core/contract.ts` | `GameDeclaration.holdsAtOnce` **added, required** | every game's declaration literal stops type-checking until it declares the field |
| `core/entity.ts` | `PlayerBase.visual` **added, required** | a consumer that builds its own players must supply `VisualState` |
| `core/entity.ts` | `Player.guideT` **removed** | the field that timed the 48 frames between beeps; the guide is continuous now |
| `core/entity.ts` | `KeyScheme` narrowed | `Record<string, string[]>` → `Record<Action, readonly string[] \| null>` — see §3, which measured this from the source rather than from the shape |
| `input/transports.ts` | `Alcance.seguraPedidas`, `.naoSeguram` **added, required** | anyone constructing an `Alcance` literal |
| `platform/audio-sonar.ts` | `SonarPlayer.viz`, `.guideT` **removed**; `SonarCtx.VIZ_BY_KEY` **removed**, `visaoComprometida` **added, required** | the sonar stopped knowing what a visual mode is; the question arrives answered. ⚠️ **This one already broke a repository in the tree** — `game-chess` consumes by `file:` and was red for four commits |
| `render/draw.ts` | `DrawPlayer` slice `'viz'` → `'visual'` | a consumer passing its own draw player |
| `render/viz-setters.ts` | `VizSettersApi` gains `setTemaDoJogador`, `setCorrecaoDoJogador`, `setVisualDoJogador`, `renderEixosVisuais` — all required | the writers are per axis now, because one field meant "touching one erases the other" |
| `ui/pause-icons.ts` | `IconStateSnapshot.viz` → `.visual`; `PauseIconsCtx` gains `setTemaDoJogador`/`setCorrecaoDoJogador`; `PausePlayer` slice `'viz'` → `'visual'` | the quick-bar icons stopped overwriting each other |
| `ui/settings-visual.ts` | `SettingsVisualCtx.renderVizGroup` → `renderEixosVisuais` | the visual panel draws two radios; the empathy panel keeps `renderVizGroup` |
| `ui/shell.ts` | `PhaseView.pauseOverlayHidden` **removed** | the engine no longer looks for a global pause overlay at all |
| `input/touch-bindings.ts` | `TouchBindingsCtx` gains `marcarTecla`, `soltarTecla` — both required; `heldKeys` narrows `Set` → `readonly ReadonlySet` | pass the pair from `input/state` instead of the bare set. ⚠️ **This row was MISSING until 2026-09-08**, and the gap is worth naming: the shape portrait was refreshed in that commit, so the gate went green — but this file, which is the only thing a game author reads, never got the line. Declaring to the gate and telling the consumer are two acts, and only one of them happened |
| `input/keydown.ts` | `KeydownCtx` gains `marcarTecla`, `marcarTeclaSemOrigem`, `soltarTecla` — all required; `heldKeys` narrows `Set` → `readonly ReadonlySet`; `KeydownEventLike` gains `isTrusted?` (optional, breaks nothing) | same pair, same reason (ADR-0109): writing into the key set erased who pressed. ⚠️ The narrowing of `heldKeys` is **not** a break for anyone *providing* the ctx — a `Set` satisfies `ReadonlySet` — and that is deliberate: what it forbids is the engine writing through the injected reference |

### And the gate now sees it

`tests/superficie-publica.node.test.js` gained a second half, backed by `scripts/shape-surface.mjs`. It fails
on a member that leaves, a member that goes from optional to required, a **required member that arrives**, and
a type alias whose right-hand side changes.

⚠️ **The asymmetry is not the same as the name gate's.** There, adding is always safe. Here it is not: a new
*required* member breaks everyone who constructs the type, which is exactly what `holdsAtOnce` did. Optional
additions stay silent; required ones ask to be declared, like removals.

Declaring is one command, and it writes both snapshots at once — `node scripts/snapshot-public-surface.mjs`.

## ⚠️ Before cutting the major, read this

Two pieces of work are **waiting for a major that has not been cut yet**, and cutting `8.0.0` without them
turns each into a `9.0.0`:

- **#104** — the two visual axes. `p.viz` is a field of a published entity that the cartridge also *writes*;
  the measurement on #104 shows the migration has to run in the cartridge's boot, so it is a lockstep edit
  across both repositories. Its own recommendation, written before this file, was to batch it with the #63
  boundary work — and that batching is still available only until this major is cut.
- **#63's deeper boundary** — `TILE_TYPES` moving and `core/collision` splitting in two.
- ✅ **`exports["./assets/*"]`** (#119) — **REMOVED on 2026-09-07, by the Dev's decision.** It promised the
  whole of `app/public/` while `files` ships only `app/public/vendor`. `./assets/vendor/*` is now the only
  assets door and it tells the truth; **nobody's import line changes**, because
  `engine/assets/vendor/fonts.css` still matches it. The gate no longer exempts anything: putting the wide
  door back fails `[Boundary] toda porta do exports aponta para algo que o pacote realmente EMBARCA` on its
  own merits.
  ⚠️ **Measured, and it contradicts what #119 assumed:** `app/public/` holds three entries (`vendor/`,
  `_headers`, `icon.svg`) and only `vendor` ships, so everything the wide door can resolve in a published
  tarball is already covered by the narrow one — the rest already 404s. **Removing it breaks no npm
  consumer.** It stays for now because a `file:` consumer reaches the whole tree, and that is the Dev's call.
- **`platform/audio-sonar.SonarCtx.LOGICAL_W`** (#121) — no longer read; the pan width comes from the
  topology. Already optional and `@deprecated`, so removing the field is the only step left.
- **`ui/settings-controls.ACT_LABEL`** — the platformer's eight words living inside the engine, and the
  direct cause of #125: the remap screen built its `aria-label` from it and announced *"Alterar tecla de
  undefined"* in a game that is not the platformer. That use is gone.
  ⚠️ This entry was wrong twice in one day and both corrections are kept, because the second only makes sense
  after the first. **(1)** It first claimed the export had *no consumer at all* — false; that came from a
  search whose pattern excluded `main.ts`. `game-platformer` used it in the pause menu's HELP screen, so
  removal was a **migration**, not a cleanup. **(2)** That migration is now DONE: the cartridge's help screen
  reads its own `acoesDoJogo()` instead, which also fixes a defect of its own — the table showed eight fixed
  positions while the vocabulary has fourteen.
  Re-measured with `git grep` across both repositories: every remaining mention is a COMMENT; the only line of
  code is the declaration. **Removing it is a clean removal with no prerequisite.**
  **Measured across all seven repositories** (2026-09-07, read through the GitHub API without cloning):
  nothing imports it. `game-soccer` mentions it only in a comment describing the defect it repairs from the
  outside; none of `game-2048`, `game-15puzzle`, `game-whackwhack` even has a file with "control" in its name.
  ⚠️ Coverage is honest rather than exhaustive: paths were filtered (`ui/`, `input/`, `main`, `control`,
  `help`), then each repo's full file list was read to find gaps in the filter — one was found
  (`game-2048/app/js/boot/boot.ts`) and closed. A file with an unexpected name importing the table would
  escape; that is judgement, not measurement.
  ⚠️ Also worth knowing before that removal: `gh search code` does NOT index this organisation's private
  repositories. It returns empty for terms that certainly exist, so an empty result from it proves nothing.

This is a decision for the Dev, not a task: cutting the major sooner ships the accessibility fixes that are
already done; cutting it later lets two breaking changes ride one release instead of three.
