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

> ⚠️ **RE-MEASURED ON 2026-09-09, and the rule has clearly taken.** There are now **28** commits that declare
> a break, and **22 of them write the footer**. The six that do not are exactly the six named below — the set
> has not grown since 2026-09-08, which is the number that says the rule is being followed rather than
> remembered.
>
> 📏 **AND THE COUNT HAD TO BE MEASURED BY THE FOOTER, NOT BY GREP.** `git log --grep='BREAKING CHANGE'`
> returns **25**, and three of those merely MENTION the phrase — one of them is the commit that documents the
> footer rule itself. The honest detector reads a LINE that starts with `BREAKING CHANGE:`; counting mentions
> is the same defect this repository has now paid for in a comment sieve and in a CDN sweep.
>
> 📌 **And the footer goes LAST**, after `Refs` and `Co-Authored-By` — measured on 2026-09-09 with
> `conventional-commits-parser` 6.4.0, the one `release-it` loads: the note captures everything to the END of
> the message, so trailers placed after it are swallowed into the changelog entry. The `8.0.0-rc.1` dry run
> printed them inside seven BREAKING CHANGES paragraphs. See `CLAUDE.md` §0.
>
> ⚠️ **The earlier re-measurement said 14 and 9.** Both numbers moved because eleven more breaking commits
> landed, and every one of them wrote its footer.
>
> The six without footers are the original five plus one:
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
> they would need.

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

`core/route.ts` (#84) · `ui/panel-shell.ts` (#62/#115) · `educational/adaptive-engine.ts` (#92) ·
`input/transporte-em-uso.ts` and `input/origem-sintetica.ts` (ADR-0109) · `input/pointer.ts` (ADR-0112)

And one ADDED FIELD that is deliberately optional: `GameDeclaration.needsPointer?()`. ⚠️ The contrast with
`holdsAtOnce` — required, in the same interface, two lines above — is the decision and not an oversight.
`holdsAtOnce` has no safe default AND fails invisibly to whoever writes the game: they have a full keyboard,
the game runs, and the child on a two-finger phone is the one who pays. `needsPointer` has a safe default
(`false`) and fails visibly — a drawing game that forgets to declare it is unusable on the author's own
device. Making three hundred games write `needsPointer: () => false` would charge `holdsAtOnce`'s price
without its reason.

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
| `input/transports.ts` | `Disponibilidade.rato` **added, required**; `Alcance.pedePonteiro`, `.naoApontam` **added, required**; `Transport.aponta` added, optional; `alcance()` gains a 4th parameter, optional | a consumer that supplies its own `Disponibilidade` must answer whether there is a MOUSE (ADR-0112). ⚠️ The engine's default probe is `(any-pointer:fine)` and not `(pointer:fine)`: the latter describes the PRIMARY pointer, so a tablet with a mouse attached would answer "coarse" and lose the mouse — the very device the question exists to find. `alcance()`'s new parameter defaults to `false`, so a game that does not declare a pointer is unaffected |
| `platform/audio-sonar.ts` | `SonarPlayer.viz`, `.guideT` **removed**; `SonarCtx.VIZ_BY_KEY` **removed**, `visaoComprometida` **added, required** | the sonar stopped knowing what a visual mode is; the question arrives answered. ⚠️ **This one already broke a repository in the tree** — `game-chess` consumes by `file:` and was red for four commits |
| `render/draw.ts` | `DrawPlayer` slice `'viz'` → `'visual'` | a consumer passing its own draw player |
| `render/viz-setters.ts` | `VizSettersApi` gains `setTemaDoJogador`, `setCorrecaoDoJogador`, `setVisualDoJogador`, `renderEixosVisuais` — all required | the writers are per axis now, because one field meant "touching one erases the other" |
| `ui/pause-icons.ts` | `IconStateSnapshot.viz` → `.visual`; `PauseIconsCtx` gains `setTemaDoJogador`/`setCorrecaoDoJogador`; `PausePlayer` slice `'viz'` → `'visual'` | the quick-bar icons stopped overwriting each other |
| `ui/settings-visual.ts` | `SettingsVisualCtx.renderVizGroup` → `renderEixosVisuais` | the visual panel draws two radios; the empathy panel keeps `renderVizGroup` |
| `ui/settings-controls.ts` | `SettingsControlsCtx.kbPadraoFor` **added, required** | answer what this seat's keys would be FROM THE FACTORY, so the remap screen can mark what the child changed (ADR-0029). ⚠️ Injected rather than read from `input/keyboard` for the same reason `kbFor` already is: the «player count → bucket» mapping (`solo`/`p2`/`p3`/`p4`) is the consumer's, and a second copy inside the engine would diverge. 🎯 **Do NOT implement it with `resetKB()`** — that one is destructive (`store.remove(CKEY)` before returning the copy), so using it as a reader wipes the child's remap on every render |
| `ui/shell.ts` | `PhaseView.pauseOverlayHidden` **removed** | the engine no longer looks for a global pause overlay at all |
| `input/touch-bindings.ts` | `TouchBindingsCtx` gains `marcarTecla`, `soltarTecla` — both required; `heldKeys` narrows `Set` → `readonly ReadonlySet` | pass the pair from `input/state` instead of the bare set. ⚠️ **This row was MISSING until 2026-09-08**, and the gap is worth naming: the shape portrait was refreshed in that commit, so the gate went green — but this file, which is the only thing a game author reads, never got the line. Declaring to the gate and telling the consumer are two acts, and only one of them happened |
| `input/keydown.ts` | `KeydownCtx` gains `marcarTecla`, `marcarTeclaSemOrigem`, `soltarTecla` — all required; `heldKeys` narrows `Set` → `readonly ReadonlySet`; `KeydownEventLike` gains `isTrusted?` (optional, breaks nothing) | same pair, same reason (ADR-0109): writing into the key set erased who pressed. ⚠️ The narrowing of `heldKeys` is **not** a break for anyone *providing* the ctx — a `Set` satisfies `ReadonlySet` — and that is deliberate: what it forbids is the engine writing through the injected reference |

### And the gate now sees it

`tests/public-surface-shrinks-by-declaration.node.test.js` holds the shape half, backed by `scripts/shape-surface.mjs`,
which reads every exported interface and type alias with the TypeScript parser (since 2026-09-27; before that,
interfaces were read by counting braces and 52 of 420 were misread — a member left from a one-line interface passed
unseen). It fails on a member that leaves, a member that goes from optional to required **or from required to
optional**, a **required member that arrives**, a member whose printed **type** changes, a changed type-parameter list
or `extends` clause, a type that changes kind (`interface` ↔ `type`), and a type alias whose right-hand side changes.
It compares printed syntax, not resolved types: renaming a parameter reads as a change, and the note for it says so.

⚠️ **The asymmetry is not the same as the name gate's.** There, adding is always safe. Here it is not: a new
*required* member breaks everyone who constructs the type, which is exactly what `holdsAtOnce` did. Optional
additions stay silent; required ones ask to be declared, like removals.

Declaring is one command, and it writes both snapshots at once — `node scripts/snapshot-public-surface.mjs`.

## 6 · The ACCESSIBILITY contract of 2026-09-09 — one question every cartridge now answers

📏 Five shape changes landed on 2026-09-09, and four of them are the same field arriving in three places.
They exist because of a defect with a child in it: **latching** — press once to walk, press again to stop —
was offered in every game, including a quiz, a board and a tile puzzle where nothing is ever held. A child who
cannot keep a key pressed opened the accessibility menu, switched on the adjustment she depends on, and
nothing happened. She learned that the adjustment was broken (ADR-0115, ADR-0106 §5).

| what changed | what a consumer does |
|---|---|
| **`GameDeclaration` gains `seguraTeclas(): boolean`, REQUIRED** | Answer whether any key is HELD in your game. `false` for a quiz, a board, a tile puzzle; `true` wherever a direction, a run or a charge is held. ⚠️ **Do NOT derive it from `holdsAtOnce`** — that counts simultaneous positions, refuses zero, and a game that holds nothing still declares 1. `conformanceProblems({})` now reports TEN fields, not nine. |
| **`PauseIconsCtx` gains `seguraTeclas: boolean`, REQUIRED** | Only for a consumer that calls `initPauseIcons` DIRECTLY. Through `createGame` nothing is written — the root reads the declaration. With `false` the `altmove` icon is not mounted. |
| **`SettingsMotorCtx` gains `seguraTeclas: boolean`, REQUIRED** | Same answer. With `false` the engine hides the `#opt-altmove` row — the row belongs to the cartridge's markup, so the engine hides it rather than removing it. |
| **`EscritoresVisuais` → `AccionaveisDoJogo`, and it gains `seguraTeclas`** | The old name survives as a deprecated type alias, so existing annotations keep compiling. Rename when convenient. The name stopped being true when a field that is not visual joined it. |
| **`Declinios` LOSES `semMenuDePausa`** | Delete the line. Your game now receives the engine's pause card, mounted at `host.pauseHost` or `#game-region`, offering only what your `getPauseActs()` can action. There is no replacement field — the pause and the HUD's accessibility icons are the engine's, in every game (ADR-0120, reverted by ADR-0121, decided again by the Dev in ADR-0122). ⚠️ **`game-chess` has more to do than delete a line**: its own `ui/pause-menu.ts` holds «leave the lesson», and those items are `getPauseActs()` material. |

⚠️ **AND THE THREE REQUIRED FIELDS HAVE NO SAFE DEFAULT, which is why they are required rather than optional.**
`true` mounts a control that may do nothing; `false` hides one a child depends on. Both sides are wrong, and
that is the same condition that made `holdsAtOnce` mandatory. 📌 Contrast `SettingsTypoCtx.fonteInstalada`,
added the same day and OPTIONAL: without it a font row stays disabled WITH its message, and the message tells
the adult what to install. There the silence keeps a state that is already actionable.

📌 **What a game that holds nothing gets is ABSENCE, not a disabled control** — and that is a different absence
from ADR-0113 clause 3, which lives in the same file. There the DEVICE requires latching, the control exists,
and it is disabled with the reason, reachable so the child can read it. Here there is no reason that helps.

### 🔴 `KeydownCtx` and `TouchBindingsCtx` gain `arestaDoJogador`, REQUIRED — the automaton had no feeder

| what changed | what a consumer does |
|---|---|
| **`KeydownCtx` gains `arestaDoJogador(jogador, origem)`** | Pass `criarArestaComAlternancia(() => players)` from `@the-inclusionist/engine/input/latch-edge.js`. It has the same signature as the raw `arestaDoJogador` and does the second half too — resolving that device's latching into the player the physics reads. ⚠️ Passing the raw one from `input/state.js` compiles and feeds the automaton, but leaves `p.toggleMove` frozen on the keyboard's value. |
| **`TouchBindingsCtx` gains `arestaDoJogador(jogador, origem)`** | The same one line, in the touch context — the same instance, so both transports write the same player. |
| **`GamepadCtx` gains `arestaDoJogador(jogador, 'gamepad')`** | The same one line again. ⚠️ This one reaches **two** repositories: `game-platformer` and `game-soccer` both call `initGamepad`. |

📏 **Measured, and it is why the field is required rather than optional:** before 2026-09-09
`input/state.arestaDoJogador` had **zero callers in production**, so `entradaDe(i).emUso` answered `teclado`
for everybody, for ever, with no error anywhere. With that, ADR-0113 clause 3 can never fire — the child who
plays by webcam can switch **off** the latching her input depends on, and nothing says so. A silent default
here is not the status quo made safe; it is an accessibility rule that cannot run.

📌 **Measured across the catalogue, not assumed:** `game-platformer` consumes all three (`initKeydown`,
`initTouchBindings`, `initGamepad`); `game-soccer` consumes `initGamepad` only; `pixi-15-puzzle`, `2048`,
`whackwhack` and `game-chess` handle their own keys and none of them holds a key to latch.

📌 And when it is passed, the cartridge's `onTouchControlsShown` patch (`main.ts:1695`) becomes removable: it
exists today to compensate for exactly this missing edge.

### 📌 One entry in the shape portrait moved and is NOT a break — say so before someone reads the diff

`ui/settings-motor.JogadorDaAlternancia` reads `JogadorDaAlternanciaDaAresta` in the portrait instead of
`PlayerView<'toggleMove' | 'walkDir'>`. **Nothing a consumer writes has to change**: the definition moved to
`input/latch-sync` (where the edge-synchronisation rule that touches those two fields lives) and the panel
keeps publishing the NAME by alias, so the resolved type is character-for-character the same.

⚠️ **The gate reported it because the gate compares TEXT, not resolved types** — its own header says so: «não
é um analisador de TypeScript … um crivo grosso e não uma prova». That is the right trade: a sieve that
over-reports a rename is worth having next to one that would have missed `holdsAtOnce`. It is declared here
so the over-report is visible as one, and does not become a fifth line in a migration note that costs
somebody an afternoon.

## 📏 Audited against the published `8.0.0-rc.1` — 2026-09-09

Before cutting another pre-release, the question that matters is not «did we write things down» but «does the
list cover every break that actually happened». It was measured rather than assumed, with the repository's own
instrument: the shape portrait at the tag versus the portrait at `HEAD`, compared by `quebrasDeForma`.

**Eight breaks since `v8.0.0-rc.1`, and all eight are in this file:**

| break | where it is written |
|---|---|
| `Declinios.semMenuDePausa` LEFT | §6 |
| `GameDeclaration.seguraTeclas` entered as REQUIRED | §6 |
| `PauseIconsCtx.seguraTeclas` · `SettingsMotorCtx.seguraTeclas` entered as REQUIRED | §6 |
| `KeydownCtx` · `TouchBindingsCtx` · `GamepadCtx` gained `arestaDoJogador`, REQUIRED | §6 |
| `ui/settings-motor.JogadorDaAlternancia` changed shape | §6, declared as a NON-break |

📌 `mapeamentoDoTeclado` and `mapeamentoDoPad` are absent from that list on purpose: an OPTIONAL member is
additive, the portrait says so, and a consumer has nothing to edit.

⚠️ **AND THE GATE THIS AUDIT WANTED DOES NOT EXIST.** The portrait proves a break HAPPENED and the commit
footer says it was intended, but nothing asserts it was EXPLAINED here — a break can land declared and
undocumented, and the reader who needs it is the one person not in the room. 📏 The obstacle is measured
rather than guessed: the baseline is a TAG, and `actions/checkout` fetches none at depth 1, so the gate needs
`fetch-tags` and a skip path for a clone that has none. It is named here so the next audit starts from a
number instead of from scratch.

## 📌 The other cut of these facts

This file answers «what changed, and why». **[Adopting-8.0.md](Adopting-8.0.md)** answers the question a
consumer actually asks — «what do *I* have to edit» — with each repository's file and line, measured in the
six trees on 2026-09-09. Neither repeats the other: the reasons live here, the addresses live there.

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

---

# Since v9.0.0 — the engine starts mounting the pause panels (ADR-0106 §1)

**Measured on 2026-09-12** by diffing `docs/6-DevOps-SRE/public-shape.json` and `public-surface.json` between
the `v9.0.0` tag and `HEAD`, plus a hand pass for the one class of change those snapshots cannot see. Thirteen
commits; three of them break something.

🔴 **READ §A FIRST EVEN IF YOU READ NOTHING ELSE.** It is the only change here that can break a game whose
source you never touched, and it does not show up in any type error.

## A · If your game already mounts `#typo`, `#caa`, `#animation` or `#audio`, the engine now REBUILDS it

`createGame` now mounts four settings panels by itself. It builds each one through
`ui/panel-shell.montarCasca`, which is idempotent **by id**: given an existing `#typo`, it REUSES that element
and then empties it — `while (overlay.firstChild) overlay.removeChild(overlay.firstChild)`.

So a consumer that already has one of those four overlays in its own markup gets it **emptied and rebuilt**,
and every listener that consumer had wired inside it is gone. There is no error, no warning, and the panel
still opens — it just opens as the engine's panel instead of yours.

**What to do:** delete your own markup for those four overlays and stop calling their `initSettings*`
yourself. The engine now supplies the shell, the interior and the wiring; your `getPauseActs` still wins for
the matching item if you provide one, so a game with a genuinely different typography panel keeps it by
supplying `getPauseActs().tipo` — it is the engine's *default* that a cartridge overrides, not a mandate.

📌 The four are `typo`, `caa`, `animation` (whose list is `#motion-list`, not `#animation-list`) and `audio`.
The remaining four are NOT mounted yet: `movement`, `ctrl`, `visual` and `empathy`.

## B · `PanelShell` gained a required field

| | |
|---|---|
| before | `{ overlay, card, lista, reset, fechar, ids }` |
| after | `{ overlay, card, titulo, lista, reset, fechar, ids }` |

`titulo` is the card's `<h2>`, exposed because whoever retranslates a panel writes into it.

**What to do:** nothing, if you only READ what `montarCasca` returns. If you CONSTRUCT a `PanelShell` by hand
— a test double is the realistic case — add the field.

## C · `EXPLAIN_IDLE` changed VALUE, and no gate could see it

`ui/settings-panel.EXPLAIN_IDLE` was the Portuguese sentence itself; it is now the i18n key
`'menu.explainIdle'`.

**What to do:** wrap it — `t(EXPLAIN_IDLE)` — anywhere you displayed it directly. If you only pass it to
`fillExplain`, or set `data-explain-idle` on a card, you are unaffected.

⚠️ **AND THIS IS THE CLASS OF BREAK THE SURFACE GATE CANNOT CATCH**, which is worth more than the change
itself. `tests/superficie-publica.node.test.js` compares exported NAMES and type SHAPES. A string constant
whose value changes keeps both, so it passed green. It was caught by measuring the surface by hand to write
this section — which is to say, by the ritual this file exists for, and not by the machine.

## D · `allMotionFrozen` answers differently with no player

`allMotionFrozen(rmKeys, rm, rmChar, undefined)` returned `false` always; it now returns `true` when every
scene key is frozen.

**What to do:** nothing, unless you render the master toggle's label from it directly. If you do, you will see
«Retomar» offered where «Parar» used to be — which is the point: 📏 measured, the old label offered an action
that could not be undone, because with `allFrozen` stuck at `false` the master button computed `next = true`
on every press. A child could stop every animation and had no way back.

## D2 · The `start` action now opens the pause — and `Enter` is `start` (ADR-0144)

🔴 **This one changes BEHAVIOUR without changing a single exported name or shape**, which is the same blind
spot section C above already paid for. Nothing in the surface gate can see it; the only place it can be
written down is here.

**What changed.** `createGame` now listens for the `start` ACTION and, when it fires, reveals the seat's pause
card and calls `cartucho.setPhase?.('paused')`. Before this, nothing in the engine opened the card: the four
settings panels it mounts were in the document and unreachable unless the game called `pausa.mostrar` itself.

**What a consumer will actually notice:** the solo keyboard scheme puts `start` on **`KeyH` and `Enter`**
(`input/default-bindings.ts:89`), so **`Enter` now opens the pause during play**, and the engine calls
`preventDefault()` on it when it does. 📏 That is the behaviour the monolith always had — `input/keydown.ts`
carries `PAUSE_KEYS = {Escape, Enter}`, and it is the stated reason `Enter` was bound to `start` in the first
place — but a game that grew to rely on `Enter` reaching it while the pause card was closed will feel this.

**What to do:** nothing, if `Enter` was not one of your play keys. If it was, remap it: the child's own scheme
is the source of truth, and `start` is remappable like any other position.

⚠️ **AND ONE THING IS NOW REFUSED AT BOOT.** A cartridge that declares `start` in its `preset` is rejected —
by `createGame` and by `mount()` — with the reason said (`core/actions.startClaimProblem`). Since ADR-0122 the
pause is not declinable, and `start` is the only position that reaches it, so a game claiming it for something
else would be declining the pause by the back door. 📏 Measured: no game in the catalogue declares `start`
today, so this refuses nothing that exists — it is written here so the first one to try finds a sentence
instead of a puzzle. Use one of the eight verb positions instead.

📌 **Additive, in the same change:** the engine now also supplies `resume` in its own pause-action table, so
the «continue» item is alive and Escape closes the card even for a game that declares no hooks at all. A
cartridge that supplies its own `resume` still wins — `getPauseActs` spreads the game over the engine.

## G · Every cartridge now ANSWERS its accommodations, and the boot refuses one that does not (ADR-0153)

🔴 **This breaks every game at boot, on purpose.** `CreateGameOptions.acomodacoes` is REQUIRED, and so is the
second argument of `mount()`. The Dev: «Gênero não precisa responder todas as acomodações, mas sim o cartucho,
obrigatoriamente.»

**What changed.** For each of the sixteen accommodations only the game can answer (`GAME_KEYED` in
`core/accommodations`), the cartridge writes its WORD when the accommodation has a subject in this game, or
`false` when it has none. A missing answer, a missing key, `true` or a blank label is a malformed declaration:
`createGame` and `mount()` throw, with the accommodation named. General accommodations still mount always and
the contract-keyed ones are derived — neither is answered here.

**Why it is mandatory and not optional:** there is no safe default. «Yes» mounts a wheelchair in chess; «no»
hides it from a platformer; and forgetting fails invisibly to whoever writes the game. It is the rubric of
`holdsAtOnce`.

**The first readers**, so the answer is not a field nobody reads: the cane row of the hearing panel
(`caneSpacing`) and the «Character» section of the visual sensitivity panel (`reducedCharacterMotion`) no longer
mount in a game that answers `false`.

**What to do:** add `acomodacoes` to your `createGame` call, all sixteen keys. The plainest honest start is
`false` everywhere, then a word for each accommodation your game really has:

```ts
acomodacoes: {
  cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false, intensity: false,
  hints: false, reducedCharacterMotion: false, caneSpacing: false, textPace: false, lexicalDifficulty: false,
  wordHighlight: false, pieceSets: false, distinguishableSuits: false, timingWindow: false, aimAssist: false,
  repeatedInput: false,
},
```

A `mount()` call passes the same object in its second argument: `motor.mount(declaration, { acomodacoes, … })`.

## H · Section A is out of date: `#typo` and `#caa` are no longer mounted (ADR-0151)

The pause's inclusion settings lost «Comunicação» and «Tipografia», and `createGame` stopped mounting those two
panels (`e9bea8a`). The typography WRITER still runs, because the eleventh quick-bar button writes the face
through it. **What to do:** nothing, unless you relied on the engine's `#typo` or `#caa` existing; if you mount
your own, the engine no longer empties it.

## I · Section D2 is out of date: `start` is the QUICK PAUSE, and `select` opens the card (ADR-0155)

🔴 **Behaviour again, with no name or shape changed** — the blind spot of sections C and D2.

**What changed.** The `start` action no longer reveals the pause card. It freezes the game
(`cartucho.setPhase?.('paused')`), puts the directional on the quick bar and shows the word PAUSED at the centre
of `#game-region` (`.pausa-rapida`, localised); `start` again returns to the game, and so does «back» inside the
bar. The **`select`** action (`KeyF` in the solo scheme) now opens the six-item card. The touch pad's START pill
is the quick pause too, and the pad stays visible while it lasts, because the pill is the way out.

**`ui/pause-icons.entrarNaBarra` no longer calls `acts.resume()`.** The bar is used with the game frozen now.
📏 Measured in the game repositories: none calls `entrarNaBarra` directly; they reach it through the
`acessibilidade` pause item, which still closes the card first — that call moved to the item.

**What to do:** if your game's help or tutorial says «press START for the menu», it now means SELECT. If `KeyF`
was a play key, remap it. `sairDaBarra` gained an optional second argument and `PauseIconsCtx` an optional
`aoSairDaBarra` — both additive.

⚠️ **AND `select` IS NOW REFUSED IN A PRESET**, like `start` (section D2): `createGame` and `mount()` throw with
the reason said (`core/actions.selectClaimProblem`). 📏 Measured in the game repositories: none declares
`select`, so this refuses nothing that exists.

## J · The hearing panel split in two, and the `other` sound category is gone (ADR-0151)

**Behaviour and a VALUE, no shape.** The engine's `#audio` panel keeps blind mode, cane taps, the sonar/guard/guide
list (now its shell list, `#navsound-list`), narration and the spoken index. A new `#som` panel («Áudio», item `som`
in the settings submenu) holds the general sound switch and volume (`#audio-master`, `#audio-master-vol`) and the
four taste categories (`#audio-list`). `#navsound-master` is no longer built. `AUDIO_CATS`, `GEN_CATS` and
`CALM_AUDIO_CATS` lost `other` — 📏 measured, no sound in the engine or the game repositories was routed through it.

**What to do:** nothing, unless your game played sounds on the `other` category (it will now have no gain node
state) or relied on `#navsound-master` existing.

## K · The virtual pad is always the minimum, and it drives the menus (ADR-0157)

**Behaviour, no shape.** `input/touch.montarControleDeToque` no longer filters the directions and action buttons by
the game's actions: every game gets the four directions and four action buttons, plus SELECT and START. Positions
the game names keep its short word; the others show the face label of the chosen pad design (via the root's
`rotuloDoSlot`). While a menu, a panel or the quick pause has the directional, a pad press is delivered to it as a
keydown stamped `toque` (ADR-0109) instead of a held key; in play nothing changes. The pad no longer hides when the
pause card or a panel opens. `TouchBindingsCtx` gains two optional fields, `emMenu` and `teclaDeMenu`.

**What to do:** nothing, unless your game relied on the pad drawing only its declared positions, or on the pad
hiding under a menu.

## L · A panel opens on «Voltar», its item 1, and has no close button at the bottom (ADR-0158)

**Shape and behaviour.** `ui/panel-shell.montarCasca` now builds `#X-close` right after the title and before the
list, with the class `overlay__back`; `.overlay__actions` holds only `#X-reset`. The ids did not change. The engine
passes the back word (`pause.pmback`) as `rotuloFechar`. `ui/mount-panel` always puts the focus on `#X-close` when a
panel opens, and **`MountPanelSpec.primeiroFoco` is removed**. `ui/settings-audio`'s two interiors insert their rows
before `.overlay__actions` instead of appending them after it.

**What to do:** drop `primeiroFoco` from your `montarPainel` calls. If you build a panel interior that appends to
the card, insert before `.overlay__actions`, or the reset stops being the last item. If your markup relied on
`#X-close` sitting inside `.overlay__actions`, move that styling to `.overlay__back`.

## M · Pause items with no action are locked, not hidden (ADR-0161)

**Behaviour and VALUES, no shape.** `ui/pause-icons.refrescarItensDaPausa` no longer sets `hidden` on a `.pm-btn`
nothing acts on: it sets `aria-disabled="true"` and `data-motivo` (the reason, from `pause.motivo.*`). Activating a
locked item announces the reason and does nothing; the menu navigation says the reason after the item's name and
passes it to the new optional `MenuNavCtx.explicarItem` / `PauseIconsCtx.explicarItem`. The values of `pause.som` and
`menu.som` changed to «Conforto auditivo» / «Hearing comfort» / «Confort auditivo».

**What to do:** if your code or tests read `.pm-btn[hidden]` to know what a game offers, read
`[aria-disabled="true"]` instead.

## N · The virtual pad draws only what the game names, by action number (ADR-0162, ADR-0160)

**Behaviour, no shape — and it reverses the minimum of section K.** `input/touch.montarControleDeToque` draws a
direction or an action button only when the game's `preset` names the action its slot fires; SELECT and START stay
unconditional. Unnamed buttons no longer get the physical face label. Each action button carries `data-acao`, and the
stylesheet places them in a 2×2 block by action number: 1 and 4 on top, 2 and 3 below. The `touch.dir.*` keys for
up/down/left/right are gone.

**What to do:** declare in `preset` every position your game — and its menus — needs by touch: at least the
directions and `action2`/`action3` if a touch-only child must move through the pause card and panels.

**And the touch transport gains the four shoulders (ADR-0160).** `TOUCH_DEFAULT` has 13 slots (`bl1`/`bl2`/`br1`/`br2`
→ `leftShoulder`/`leftTrigger`/`rightShoulder`/`rightTrigger`), `TOUCH_SLOTS` and `TOUCH_ACTS` grow with them, and
`transports.LUGARES.toque` is 13 — so a game of up to 13 positions now fits the touch transport in the reach notice.
`#touch-controls` covers the whole region (`inset:0`, still `pointer-events:none`), so the shoulder pairs sit in its top
corners. A stored touch map from before keeps working: the new slots fall back to their defaults.

## O · The engine sizes the game region, and the target floor is 22 × k (ADR-0163)

**Behaviour, VALUES and two removed names.** `createGame` sizes `#game-region` itself — the largest integer multiple of
320×180 in real pixels that fits the stage, never under 640×360, with ADR-0001's crop tolerance — on boot and on every
window resize, and writes `--ui-fs`, `--tap`, `--hud-fs` and `--alvo-min` on it. A width or height the cartridge set on
the region is overwritten. ADR-0095's height ruler is gone: **`ui/layout.REGUA_DE_ALVO` and
`ui/layout.alvoMinimoDeToque` are removed**, replaced by `alvoMinimo(k)` (44 px at k = 2, growing with the scale), and
`ui/layout.aplicarEscala(regiao, escala)` takes no height. `--alvo-min` is therefore never 24 or 34 px any more. The pause
card's title is 1em with a 1.25 line. `#game-region`'s font size is `--ui-fs` × `--fonte-escala`, and no size in
`style.css` is under 1em or 16 px, or written in `rem`: text that was .8em–.95em (captions, hints, tags, the START pill)
is now 1em, and a `rem` size became the same number in `em`, so it grows with the scale.

**What to do:** stop sizing `#game-region`; put your layout inside it and read `--ui-fs` / `--alvo-min`. Replace
`alvoMinimoDeToque(altura)` with `alvoMinimo(k)`. If your screens counted on 24 or 34 px items to fit a small viewport,
they now get 44 px or more — shorten the list, not the target.

## P · The footer: a band for explanations, chips for the button legend (ADR-0164, ADR-0165)

**Behaviour and VALUES, no shape.** `.rodape-da-tela` paints no background; `.barra-explicacao` has the dark band and
sits at the lowest edge, `.pausa-legenda` above it with one `.lg-nome` chip per item. The value of `pause.quick.legenda`
names buttons, not actions: «2: confirmar · 3: voltar · 4: menu · START: voltar ao jogo» (and en/es). Inside
`#game-region`, a panel's `.opt-explain` is absolutely positioned at the region's bottom, full width, and its overlay
keeps `--rodape-h` free below the card.

**What to do:** if your styles or tests read the band on `.rodape-da-tela`, read it on `.barra-explicacao`; if you
matched «Ação 2» in the legend, match «2:».

## Q · A pad button's face is its name; the game's word is its function (ADR-0165)

**Behaviour, no shape.** `input/touch.montarControleDeToque` writes on each face the NAME of the position the slot fires
(`1`–`4`, `L1`/`L2`/`R1`/`R2`, `SELECT`, `START`), and sets `aria-label` to «name, function», where the function is what
`rotuloDoSlot` returns; a direction arm says its direction name (`touch.nome.*`) before the function. New export
`nomeDoBotao(acao)`.

**What to do:** if your tests find pad buttons by the game's word in `textContent`, read it after «, » in `aria-label`.

## R · The on-screen pad only on request, and out of the menus (ADR-0166)

**Behaviour and one new optional field.** `createGame` mounts `#touch-controls` only when the cartridge passes
`controleNaTela: true` (also through `mount()`); without it there is no pad and no pad line in `problems`. With it, the pad
hides while the pause card or a settings panel is open and comes back in play when the child was on touch; it stays on
the quick pause. A touch inside a menu no longer reveals the pad. This undoes section K's «the pad stays in view above
the menus».

**What to do:** a game that does not play well by mouse or touch passes `controleNaTela: true`. Menus need nothing: their
items take clicks and touches.

## S · Pause item glyphs left the dictionary (ADR-0159 rule 12)

**VALUES, no shape.** The seventeen `pause.<act>` values in pt/en/es no longer start with a glyph («Inclusion settings»,
not «⚙ Inclusion settings»). The glyph is `ui/pause-icons.GLIFO_DO_ITEM`, written as `data-glifo` on each `.pm-btn` and on
a panel's `.overlay__back`, and drawn by `style.css` in the number's `::before` with empty alternative text.

**What to do:** if your own menu shows `t('pause.<act>')` and relied on its glyph, draw the glyph yourself out of the name
(`data-glifo` with the engine stylesheet does it); if you matched a glyph in those strings, match the words.

**And the switch words.** `ui.toggle.on` / `ui.toggle.off` are «Ligado» / «Desligado» (en «On» / «Off», es «Activado» /
«Desactivado») without «❚❚» / «▶». `ui/settings-audio`'s master sound button uses them instead of «🔊 Ligado» /
«🔇 Desligado»; `ui/settings-motion.motionRowHtml` writes them instead of «▶ Animado» / «❄ Congelado» and names the switch
by its row only (`aria-label="<row>"`, the state is `aria-pressed`); `motionMasterLabel` returns the new
`a11y.resumeAll` / `a11y.stopAll` instead of Portuguese literals with «▶» / «⏸».

## T · Menu items show no number; the place is spoken after the name (ADR-0167)

**Two names removed, and behaviour.** `ui/menu-items.numerarItens` and `ui/menu-items.ATRIBUTO_DO_NUMERO` are gone, and
`ui/mount-panel` no longer writes `data-item-num` on panel rows nor `.item-num` spans. `style.css` drops the `item-menu`
counter on `.pause-menu`/`.pm-btn` and `.quiz-alts`/`.quiz-alt`; a glyph (`data-glifo`) is still drawn before the name.
The name written under the quick bar (`.pause-icons-cap`) is the icon's accessible name alone — «Modo cego: desligado»,
not «…, 1 de 9»; `legendaDoIcone` still returns the spoken form with the index. This undoes ADR-0158's visible numbers.

**What to do:** a game that numbered its own rows with `numerarItens` or styled `[data-item-num]` drops it; to say a
place, speak `ui/item-announcement.anunciarItem({ rotulo, estado, posicao, total }, comIndice)`. Tests that read
«, N de M» in the bar's visible name read it from what is spoken instead.

## U · Every line of `problems` is in English, with the child's cost and the fix (ADR-0169)

**VALUES, no shape.** The Portuguese lines of `createGame`'s `problems` and of `input/touch.lacunasDoToque` are rewritten
in English, and every line now says what is wrong by name, what it costs the child, and the fix: «there is no neural
voice…», «the pause menu has nowhere to mount…», «the declared world #x is not in the page…», «the virtual pad shows only
SELECT and START…». Measured across the sibling games: none matches the old wording in a test (pinball asserts an empty
list), only comments quote it.

**What to do:** a test or tool that matched a Portuguese line matches the English one, or better, matches the name it
carries (`carregarVozNeural`, `host.pauseHost`, the selector).

## V · Heavy downloads are checked by sha256; the cache is `incl-pesados-v2` (issue #168)

**A value and a behaviour.** `platform/pesados.CACHE_PESADOS` is `incl-pesados-v2`: what `v1` held was never checked, so
it is not trusted and is fetched again (once, ~275 MB). `baixarPesados` keeps a body only when its SHA-256 is the entry's
pinned `sha256`; a mismatch, an entry with no hash, or a host without `crypto.subtle` is reported as `falhou` and nothing
is kept. The service worker routes on that cache now only READ it (`cacheWillUpdate` returns `null`). Additive with it:
`Pesado.sha256`, `OpcoesDosPesados.digest`, `sha256Hex`.

**What to do:** nothing, unless a tool read `incl-pesados-v1` by name. A deployment served over plain HTTP (no secure
context) keeps no heavy file — serve it over HTTPS or localhost.

## W · WebGazer runs only from the checked cache (issue #169)

**Behaviour.** `ui/webcam.loadWebGazer` no longer appends `<script src="https://webgazer.cs.brown.edu/webgazer.js">`. It
reads the file from `CACHE_PESADOS` — downloaded at install by `baixarPesados` and kept only when its sha256 matches (#168)
— and runs it from a `blob:`. When the file is not there yet, nothing runs and `#sr-alert` says eye control has not
reached the device. The value of `sr.eyes.needsInternet` changes accordingly in pt, en and es.

**What to do:** a game that passes `baixarPesados: false` to `createGame` gets no eye control; leave the download on, or
call `baixarPesados` yourself. A Content-Security-Policy must allow `blob:` in `script-src`.

## X · The touch controls no longer move the minimap (issue #167)

**Behaviour.** `input/touch` called `render/minimap.setMinimapCorner` itself when the on-screen controls appeared (top
right) and left (bottom left) — an import from `input/` up into `render/` (ADR-0173). It now tells the root instead:
`onTouchControlsShown` as before, and the new optional `TouchCtx.onTouchControlsHidden`. No type breaks.

**What to do:** only a game that mounts the minimap moves it. 📏 Measured: `game-platformer` alone (`app/js/main.ts`,
`initTouch({ … })` near line 1874). Without this, its minimap stays in the bottom-left corner, under the pad:

```ts
onTouchControlsShown: () => { setMinimapCorner(true); /* …what it already does… */ },
onTouchControlsHidden: () => setMinimapCorner(false),
```

## Y · The platformer's title menu and its sentences left the engine (ADR-0174, issue #171)

**Removed.** `ui/activities-menu` — the title menu of Lúdico, Alfabetização and Matemática, its fraction notations and
tabuada picker — and **161 keys** of the pt/en/es dictionaries that only `game-platformer` used (`sr.physics.*`,
`sr.screens.*`, `sr.round.*`, `hud.objective.*`, `a11y.btnJump`…). Measured with git grep across the sibling
repositories; a key the engine's code, pages or tests still name stayed (15 of the 176 the platformer registers).

**Moved.** The pause card's buttons — `PauseBtnDef`, `PM_BTNS`, `PM_JOGO_BTNS`, `PM_OPTIONS_BTNS` — now live in
`ui/pause-buttons`: the card is the engine's.

**What to do:** only `game-platformer` is affected, and it already carries both halves (`game-platformer:636aa5b`:
`app/js/ui/activities-menu.ts` and `app/js/i18n/game-keys.ts`, registered in `create()`). On this version it changes one
import in `app/js/main.ts`:

```ts
import { PM_BTNS, PM_OPTIONS_BTNS } from '@the-inclusionist/engine/ui/pause-buttons.js';
```

## Z · The faces answer to the typographic catalogue (ADR-0176, issue #172)

**Behaviour.** `catalogo_tipografico.json` is the source for which faces exist.
- **Comic Neue left** — it is not in the catalogue: its `@font-face`, its two woff2 files and `font.desc.comicneue` are gone.
  A child who had chosen it lands on Atkinson Hyperlegible (`resolveFontKey`'s fallback), with nothing lost but the face.
- **Playwrite BR is offered in the reading menu** — the handwriting group's general face (the Dev).
- **A face whose catalogue floor is above the 16 px base is drawn at that floor**: Playwrite BR, Space Grotesk, Sora, Plus
  Jakarta Sans, Playfair Display, DM Serif Display, Fraunces and Bodoni Moda declare `minPx: 20`, and choosing one in the menu
  writes `--fonte-escala: 1.25` on the document (`ui/fonts.escalaDaFace`); a reading face writes 1.

**Shape.** `FontItem` gains a required `id`, the catalogue's key. 📏 Measured: no sibling repository builds a `FontItem`
(`game-platformer` reads `FONT_GROUPS`).

**What to do:** nothing, unless a game draws its own text in a face of the menu and assumed 16 px after the child chose one
of the eight above — the document is 25% larger then.

## AA · The stored settings are loaded by the root, not at import (ADR-0178, issue #174)

**Behaviour.** `core/state` and `core/i18n` no longer import `platform/storage`. Their bindings start from what an empty
storage gives (the defaults) until the composition root calls `carregarEstado(store)` and `carregarIdioma(store)`;
`createGame` calls both first. A setter that would write before `carregarEstado` **throws**, naming itself, and changes
nothing; `setLocale` before `carregarIdioma` is refused the same way. A setter that changes nothing writes nothing and does
not throw. ⚠️ A READ before the load is not an error: it gives the default, so a root that reads a setting before loading sees
the default, not the child's choice.

**What to do** — measured in the sibling repositories on 2026-09-13:
- `game-platformer` does not go through `createGame`: `app/js/main.ts` calls `i18n.initI18n()` (line 312) and thirteen setters
  from its own boot. Call `carregarEstado(store)` and `carregarIdioma(store)` before line 312 —
  `import { carregarEstado } from '@the-inclusionist/engine/core/state.js'`,
  `import { carregarIdioma } from '@the-inclusionist/engine/core/i18n.js'`,
  `import * as store from '@the-inclusionist/engine/platform/storage.js'`.
- `game-pinball` `app/js/standalone.ts:34` calls `initI18n(document)` before `createGame` (line 134): it picks the browser's
  language until `createGame` loads and initialises again. Load first, or drop the early call.
- `game-soccer`, `game-chess`, `game-whackwhack` write settings only after `createGame`: nothing to change.

## AB · The heavy files come from the delivery's own origin (ADR-0177, issue #173 — first cut)

**Behaviour.** `platform/pesados.baixarPesados` no longer fetches from Hugging Face, jsDelivr, Google Storage or
webgazer.cs.brown.edu. It asks the page's own origin for `pesados/<host><path>` (`caminhoNaEntrega(url)`) and keeps the body,
after the sha256 check, under the upstream address — the one the voice and vision libraries request. The service worker
routes on the checked cache are `CacheOnly`: a library request is answered from the cache or fails, and never reaches the
upstream host. 📏 Measured in the rebuilt dist: every request of the quiz page went to its own origin.

**What to do:** a delivery that offers neural voices, vision or eye control carries the files in `pesados/`. For the engine's
own dist: `npm run build`, then `npm run pesados:entrega` (fetches about 300 MB once, checks each sha256, writes into
`dist/pesados/`, and fails the run on a mismatch). A cartridge's delivery needs the same step: after its own build,
`npx inclusionist-pesados dist` (the package's command; it reads the catalogue from the installed engine). Kokoro's model
and voices (327 MB) enter only with `--kokoro`, for a game that fills `carregarKokoro` — the start leaves them out of its
download too when the port is absent (ADR-0198 §5). The
Content-Security-Policy keeps only `huggingface.co` in `connect-src` (the voice provider hardcodes its models' host; the
service worker answers from the checked cache); the voice's phonemizer is catalogued and asked for at `pesados/`, and a
delivery with neural voice carries it too (18.7 MB). ⚠️ Until the same day, the engine's own service worker registered NONE
of its runtime routes (a navigation fallback to an `index.html` the engine does not build threw inside the worker's promise):
a build without an `index.html` has the same fault — set `navigateFallback`. 📏 The seven sibling games all have `app/index.html`.

## AC · Two more game-keyed accommodations to answer: `ownerColors` and `contrastOutlines` (ADR-0188, issue #183)

**Behaviour.** `core/accommodations.GAME_KEYED` grows from sixteen to eighteen. `createGame` and `mount()` refuse an
`acomodacoes` answer that lacks either, naming it (ADR-0153). Answered with a word (`{ label, hint? }`), owner colours is a row
in the visual panel in that word, writing `core/state.ownerColors`; contrast outlines are two step rows (foreground,
background) writing `hcOutlineFg` / `hcOutlineBg`. Answered `false`, no row.

**What to do:** add both keys to the `acomodacoes` answer — `ownerColors: false, contrastOutlines: false` where the game has no
owned items and draws no outlines, or its word where it does. 📏 Measured in the sibling repositories on 2026-09-13: none of the
seven passes `acomodacoes` yet (they consume an engine from before ADR-0153), so the change reaches them with that one.

## AD · A caption's time is read at the child's rate (ADR-0183 §4, issue #179)

**Behaviour.** `core/caption-duration.duracaoDaLegenda(texto, ppm)` takes the reading rate, one of `RITMOS_DA_LEGENDA` (125, 145,
175 words a minute; anything else reads as 125); `MS_POR_PALAVRA` (a fixed 500 ms, 120 words a minute) left. The rate is
`core/state.captionPpm` (`incl_caption_ppm`, 125 by default), set in the visual panel; `EventoDoJogo` gains `captionPpm`.

**What to do:** a caller of `duracaoDaLegenda(texto)` passes `state.captionPpm`; a reader of `MS_POR_PALAVRA` computes
`60 000 / state.captionPpm`. 📏 Measured on 2026-09-13: no sibling repository imports either — the module entered on the same day
(`engine:2bd2826`) and is in no published version.

## AE · The help is a slide show; `helpListHtml` left (interface log, 2026-09-13)

**Behaviour.** The help panel the engine mounts shows one slide per position the game names — the child's key drawn as a key
cap, the game's word and its sentence, dots for the place — turned with left and right, with no «restore defaults» and no footer
band. `ui/help-panel.helpListHtml` (the rows as settings-menu markup) left; `montarSlides`, `mostrarSlide` and `SlideCtx` entered.
`helpRows` is unchanged. The panel's shape is the engine's: `#help-list` now holds one `.slides` element, not `.ctrl-row`s.

**What to do:** a caller of `helpListHtml(rows, t)` builds the frame with `montarSlides({ criar })` and shows a row with
`mostrarSlide(el, rows, i, { criar, t, titulo })`. 📏 Measured on 2026-09-13: none of the seven game repositories imports
`ui/help-panel`.

## AF · Piper left the engine; Kokoro is the only neural voice (ADR-0207, issue #193)

**Why.** Three of the four Piper voices are fine-tuned from `lessac`, trained on the Blizzard 2013 dataset, licensed for research only
and not to be distributed; the fourth states no starting checkpoint. The public notice: `docs/notices/2026-09-14-piper-voices-withdrawn.md`.

**What left.**

| | |
|---|---|
| `CreateGameOptions.carregarVozNeural` · `TtsCtx.carregarVozNeural` | the Piper port; a game passing it no longer compiles against the typed options |
| `platform/tts` types `CarregarVozNeural`, `ModuloNeural`, `SessaoNeural`, `LocaisDoRuntime` | the Piper provider's shape |
| `platform/voice-plan` exports `VOZES_NEURAIS`, `HOST_DOS_MODELOS`, `caminhoDoModelo`, `urlDoModelo`, `urlDaConfig`, `EstadoDaVoz`, `EstadosDasVozes`, `estadoDe`, `ordemDeBusca`, `VozEmUso`, `vozEmUso` | the Piper catalogue and its readiness; `VozNeural` and `vozesDoIdioma` stay, and `vozesDoIdioma` now takes the catalogue as a required second argument |
| `platform/vozes-prontas` | the whole module |
| heavy-file catalogue entries `voz:pt_BR-faber-medium`, `voz:en_US-amy-medium`, `voz:en_US-ryan-medium`, `voz:es_MX-claude-high` (and `:cfg`), `voz:fonemizador`, `voz:fonemizador:dados` | no longer fetched by the start or copied by `inclusionist-pesados` |
| `TTS_ENGINE_OPTIONS` row `piper` · i18n keys `tts.engine.piper`, `sr.tts.progress` | the engine list has four engines |
| service-worker route for `huggingface.co/diffusionstudio/piper-voices` · `connect-src https://huggingface.co` | the page contacts no third party by itself |

**Behaviour.** `Tts.neuralDisponivel` is `!!carregarKokoro`; without the Kokoro port the audio panel does not offer `kokoro`, and a
language the browser has no voice for has no voice at all (narration locked with its reason, ADR-0185 §4). A stored engine choice of
`piper` reads as no choice. The `problems` line for a missing neural voice names `carregarKokoro`.

**What to do:** remove `carregarVozNeural` and the `@mintplex-labs/piper-tts-web` dependency; fill `carregarKokoro` for a neural voice
(the quiz demo's `app/js/consumer-quiz/kokoro-porta.ts` is the example); rebuild the delivery. 📏 Measured on 2026-09-14: `game-platformer`
(`app/js/main.ts`) and `pixi-15-puzzle` (`app/js/boot/standalone.ts`, with the dependency) pass the port; the other game repositories
only mention it in comments.

## AG · `input/camera-gestures` left: the face and the hands read by the Dev's map (ADR-0210, ADR-0213, issue #191)

**What left.** The whole module `input/camera-gestures` — `criarLeitorDaCamera`, `criarLeitorDoRosto`, `criarLeitorDosOlhos`,
`criarLeitorDosGestosEstaticos`, `criarLeitorDosGestosDinamicos`, `formaDaMao`, `tresDedos`, `poseDaCabeca`, `GESTOS_ESTATICOS`,
`GRUPOS_DA_CAMERA`, `ESPERA_MS`, `FIRMEZA_MS`, `REPOUSO_MS` and its types. It spoke a seven-command vocabulary
(`up/down/left/right/confirm/back/menu`) the controller map replaced, and nothing wired it.

**What to do:** read a face with `input/face-map` (`createFaceMapReader`), hands with `input/hand-map` (`createHandMapReader`,
`gesturesSeen`), the eyes with `input/gaze-relative` and `input/gaze-cycle`; all answer in the engine's fourteen actions. 📏 Measured on
2026-09-16: no sibling repository imports `input/camera-gestures`.

## AH · The eye control presses the virtual controller; `input/gaze-keys` left (ADR-0111 erratum, issue #197)

**What left.** `input/gaze-keys` — `gazeKeyEvents`, `dispatchGazeKeys`, `GazeKeyEvent`. It turned the eye control's presses into synthetic
key events, the disguise ADR-0111 §4 refuses. `ui/eye-control`'s `EyeControlDeps.scheme` became `controller: VirtualController`.

**What entered (additive).** `CreateGameOptions.onCommand(command)`: the engine carries each press and release of a virtual button — the
keyboard through the child's scheme, the eyes — with its source and seat; `input/virtual-controller` (`createVirtualController`,
`VirtualCommand`, re-exported from `boot/create-game`).

**What to do:** nothing for a game that does not use the eyes; a game that wants commands declares `onCommand` and maps the positions it
names in its `preset`. 📏 Measured on 2026-09-16: no sibling repository imports `input/gaze-keys` or `ui/eye-control`.

## AI · WebGazer left the engine (ADR-0214, issue #198)

**What left.** `ui/webcam` — `eyeMode`, `setEyeMode`, `eyeSet`, `onGaze`, `startEyeControl`, `stopEyeControl`, `loadWebGazer`; the heavy-file
catalogue entry `visao:olhar` (1 895 169 bytes), so the install and `inclusionist-pesados` no longer fetch it; `blob:` in the page's
`script-src`; the i18n keys `sr.eyes.loadFailed` and `sr.eyes.calibrate`.

**What to do:** remove the imports from `ui/webcam` and the eye button that used them; a child plays with the eyes through the 👀 on the
engine's quick bar (ADR-0213), and a game that wants the commands declares `onCommand` (note AH). 📏 Measured on 2026-09-16:
`game-platformer` imports five names from `ui/webcam` (`app/js/main.ts`) and has `#opt-eyes` (`app/index.html`); no other sibling does.

## AJ · The engine loads the neural voice; the Kokoro port left (ADR-0216, issue #200)

**What left.** `CreateGameOptions.carregarKokoro`. It was the port a game filled with its own phonemizer, ONNX runtime and paths —
about 200 lines each game copied, and the Dev, 2026-09-21: «O jogo não deve precisar saber como isso funciona». `TtsCtx.carregarKokoro`
stays, as the seam a test injects; nothing in a game passes it. `ModuloKokoro`, `SessaoKokoro` and `CarregarKokoro` moved from
`platform/tts` to `platform/kokoro` and are still re-exported from `platform/tts`, so an import of either path keeps working.

**What entered (additive).** `CreateGameOptions.uses.neuralVoice` — the game says a child is read TO by it, and the engine loads
Kokoro from the delivery at the first such utterance (`platform/kokoro-runtime`, `platform/kokoro-port`). The declaration, and no
longer the port, is what lists the Kokoro voices, offers the neural engine in the hearing panel and puts the model, the voices and
the runtime (372 MB) in the delivery.

**Also in this release, and in the same decision.** `OnnxRuntime` left `platform/kokoro-port` for `platform/onnx-runtime`, which is
now the one place that loads the graph runner from the delivery and points its worker threads at it — the voice and the reading
load the same one the same way, so the rule about those threads is written once (`OnnxSession` and `atDelivery` are new there).

**What to do:** replace `carregarKokoro: …` with `uses: { neuralVoice: true }` and delete the loader, the port and the npm
dependencies they needed (`espeak-ng`, `onnxruntime-web` — the engine reads both from `pesados/`, so nobody installs them). A game
that does not want a neural voice declares `declines.semVozNeural`, as before. 📏 Measured on 2026-09-21: the only consumer of the
port was this repository's quiz demo, deleted in the same commit; no sibling repository names `carregarKokoro`.

## AK · Playing by SPEAKING arrives, and «under construction» leaves the bar (ADR-0189, ADR-0193, ADR-0194; issue #184)

**What left.** `PauseIcon.soon`. It marked an icon that announced itself «under construction» and did nothing else — the
button was painted at 55% by `.pi-btn.pi-soon` and its `aria-label` carried the suffix from `icon.soon`. The 👄 was the last
icon using it (the 👀 and the 🧑 left it with ADR-0213 and ADR-0212), and with the voice transport built nothing does. The
class went out of `app/css/style.css` and the key `icon.soon` out of the three dictionaries in the same commit: a mechanism
with no user is debt wearing the clothes of a feature, and a key nobody reads is a promise to a child that no code keeps.
📏 Measured on 2026-09-21 across the seven game repositories: none names `pi-soon`, `icon.soon` or the field `soon` of a
`PauseIcon` — the only hits are the English word in prose and the chess's own key `view.soon`. The panels' own tag (`ui.soon`,
added after a label by `motionRowHtml`) is a different mechanism and stays.

**What entered as required.** `EventoDoJogo.voiceControl` — the event a surface listens to in order to follow the child's
answer, beside `switchScan` and `cameraControl`. Whoever writes their own map of the state's events adds this member.

**What entered (additive).** `core/state.voiceControl` and `setVoiceControlValue` (stored under `incl_voice_control`, off by
default, because it opens a MICROPHONE and nothing may do that by itself) · `AccionaveisDoJogo.microfone` and
`PauseIconsCtx.microfone` — the 👄 is mounted where there IS a microphone to ask for, the same rule as the 📷's (ADR-0106 §5)
· `ui/voice-control` (`createVoiceControl`, `VoiceControl`, `VoiceControlDeps`, `VOICE_PULSE_MS`), which joins the
vocabulary (`input/voice-map`), the recogniser from the delivery (`platform/vosk-runtime`), the microphone that stays open
(`platform/voice-listener`) and the virtual controller — a heard word is a press stamped `fala` and a release 400 ms later,
because a spoken command is a tap and what holds a direction afterwards is the latch (ADR-0211).

**And the recogniser's loader changed shape, one day after it landed.** `VoskDeps.doc` and `VoskDeps.loadScript` left, and
`VoskDeps.loadBundle` entered; `VoskApi.createModel` takes the resolver as its second argument. 📏 The reason is a measurement
and not a preference: the delivery's bundle is an ES module that ends in `export { createModel, … }` and asks for its worker
and its wasm through a resolver we pass — the first version loaded it as a classic script and looked for a global, so the 👄
could never start. Nothing outside this repository reads these names (they exist for the gate to inject a double).

**What to do:** nothing, unless you read `PauseIcon.soon` or the key `icon.soon`. An icon that has nothing to act on is
ABSENT from the bar, which is what ADR-0106 §5 asks for and what `iconesQueAccionam` already did.

## AL · The public surface starts speaking English: the `core` layer (ADR-0219, issue #202)

**What this is.** The first layer of the rename decided in ADR-0219: every public name of `core/**` that carried a Portuguese
word now has an English one. There are no deprecated aliases — the old names are gone. 📏 Measured: 67 names, 95 files, 927
occurrences inside this repository, and the Portuguese debt of the tree fell from 1453 identifiers to 1384.

**What to do.** Rename on your side by the table below. Nothing in the games was touched (the Dev, 2026-09-21: «quando eu for
consertá-los eu adequo o código à nova versão da engine»), so a game keeps working on the engine it already has until it
upgrades. 📌 Two names in this table are events, not just bindings — `'modoCego'` is the name a listener passes to
`state.on`, and it is now `'blindMode'`: renaming the binding without the string would cut `emit`/`on` in half.

⚠️ **The table is PRINTED, never typed** (`node scripts/print-rename-table.mjs`): it comes from the same file the engine
renames itself from, so a name cannot be renamed without appearing here.

**core** — 67 names, applied 2026-09-21

| was | is |
|---|---|
| `ALFABETO` | `ALPHABET` |
| `analisarFlashes` | `analyseFlashes` |
| `atravessavel` | `isWalkable` |
| `CampoSenha` | `PasswordField` |
| `carregarEstado` | `loadState` |
| `carregarIdioma` | `loadLocale` |
| `CodecSenha` | `PasswordCodec` |
| `COLUNAS` | `COLUMNS` |
| `Correcao` | `Correction` |
| `criarCodec` | `createPasswordCodec` |
| `criarGrade` | `createLetterGrid` |
| `criarPilha` | `createSceneStack` |
| `Direcao` | `Direction` |
| `duracaoDaLegenda` | `captionDuration` |
| `ehPerigo` | `isHazard` |
| `ehTrampolim` | `isTrampoline` |
| `ElementoComRotulo` | `LabelledElement` |
| `escaparHtml` | `escapeHtml` |
| `EventoDoJogo` | `GameEvent` |
| `ExtrasDoNivel` | `LevelExtras` |
| `FatosDaCena` | `SceneFacts` |
| `formatar` | `formatPassword` |
| `Genero` | `Genre` |
| `generoAviso` | `genreWarning` |
| `generoProblems` | `genreProblems` |
| `GENEROS` | `GENRES` |
| `GradeDeLetras` | `LetterGrid` |
| `idiomaPronto` | `localeReady` |
| `lacunasDosDicionarios` | `dictionaryGaps` |
| `LEGENDA_MINIMA_MS` | `CAPTION_MIN_MS` |
| `LINHAS` | `ROWS` |
| `modoCego` | `blindMode` |
| `OpcoesDaGrade` | `LetterGridOptions` |
| `OpcoesDaRodada` | `RunOptions` |
| `OpcoesDoLaco` | `LoopOptions` |
| `palavrasFaladas` | `spokenWords` |
| `PAPEIS_ATRAVESSAVEIS` | `WALKABLE_ROLES` |
| `passoNoAnel` | `stepInRing` |
| `PortaDoEstado` | `StatePort` |
| `PortaDoIdioma` | `LocalePort` |
| `Posicao` | `Position` |
| `proximaVelocidade` | `nextGameSpeed` |
| `QuadroDeLuminancia` | `LuminanceFrame` |
| `registrarAvisoDeQueda` | `registerCrashNotice` |
| `RitmoDaFala` | `SpeechRate` |
| `ritmoDaFalaValido` | `isSpeechRate` |
| `RitmoDaLegenda` | `CaptionRate` |
| `ritmoDaLegendaValido` | `isCaptionRate` |
| `RITMOS_DA_FALA` | `SPEECH_RATES` |
| `RITMOS_DA_LEGENDA` | `CAPTION_RATES` |
| `rngDecoracao` | `decorationRng` |
| `Rota` | `Route` |
| `rotaAte` | `routeTo` |
| `rotuloAcessivel` | `accessibleLabel` |
| `segundosDeFala` | `speechSeconds` |
| `SEMENTE_PADRAO` | `DEFAULT_SEED` |
| `semForca` | `noGripStrength` |
| `setModoCegoValue` | `setBlindModeValue` |
| `setSemForcaValue` | `setNoGripStrengthValue` |
| `Simulacao` | `Simulation` |
| `TAXA_MAXIMA` | `MAX_PLAYBACK_RATE` |
| `TAXA_MINIMA` | `MIN_PLAYBACK_RATE` |
| `taxaDaFala` | `speechPlaybackRate` |
| `Tema` | `Theme` |
| `VELOCIDADES_DO_JOGO` | `GAME_SPEEDS` |
| `velocidadeValida` | `isGameSpeed` |
| `VeredictoDeFlashes` | `FlashVerdict` |

## AM · The public surface of `platform` speaks English (ADR-0219, issue #202)

**What this is.** The second layer of the rename. 📏 54 names, 92 files, 633 occurrences; the tree's Portuguese debt falls from
1384 identifiers to 1328. No aliases: the old names are gone, and the table below is printed from the same map the engine
renames itself from.

**What to do.** Rename on your side by the table. 📌 Three of these are what a game touches most: `baixarPesados` is now
`downloadHeavy` (and it is a field of `CreateGameOptions` too), `kJogo` is `gameKey`, and `getComLegado` /
`getJSONComLegado` are `getWithLegacy` / `getJsonWithLegacy`.

⚠️ **The delivery folder `pesados/` and the `bin` keep their names in this commit** and change in the next one, which is
where the line about rebuilding the delivery belongs — the folder is a PATH a built `dist` already carries, and mixing it
with a rename of identifiers would put two different migrations under one heading.

**platform** — 54 names, applied 2026-09-21

| was | is |
|---|---|
| `ApiDeReconhecimento` | `RecognitionApi` |
| `baixarPesados` | `downloadHeavy` |
| `BYTES_DA_VOZ_KOKORO` | `KOKORO_VOICE_BYTES` |
| `BYTES_DO_MODELO_KOKORO` | `KOKORO_MODEL_BYTES` |
| `CACHE_PESADOS` | `CACHE_HEAVY` |
| `caminhoNaEntrega` | `deliveryPath` |
| `chaveDaEntrega` | `deliveryCacheKey` |
| `chavesForaDosEscopos` | `keysOutsideScopes` |
| `ComandoOuvido` | `HeardCommand` |
| `CORTE_LONGE` | `FAR_CUT` |
| `CORTE_PERTO` | `NEAR_CUT` |
| `criarFalaInterrompivel` | `createInterruptibleSpeech` |
| `criarLeitorDeComandos` | `createCommandReader` |
| `criarReconhecimentoLocal` | `createOnDeviceRecognition` |
| `DIMENSAO_DO_ESTILO` | `STYLE_DIMENSION` |
| `EstadoLocal` | `OnDeviceAvailability` |
| `estiloDaFrase` | `sentenceStyle` |
| `FalaInterrompivel` | `InterruptibleSpeech` |
| `getComLegado` | `getWithLegacy` |
| `getJSONComLegado` | `getJsonWithLegacy` |
| `GUIA_HZ` | `GUIDE_HZ` |
| `GUIA_TIPO` | `GUIDE_WAVE` |
| `GUIA_VOL` | `GUIDE_VOL` |
| `GuiaVivo` | `LiveGuide` |
| `InstanciaDeReconhecimento` | `RecognitionInstance` |
| `Intensidade` | `Intensity` |
| `intensidadeDoGuia` | `guideIntensity` |
| `kJogo` | `gameKey` |
| `LeitorDeComandos` | `CommandReader` |
| `MotorDeFala` | `SpeechEngine` |
| `OpcoesDosPesados` | `HeavyOptions` |
| `ORCAMENTO_DA_ROTA` | `ROUTE_BUDGET` |
| `passoDoMundo` | `worldStep` |
| `PASSOS_ATE_O_FUNDO` | `STEPS_TO_FLOOR` |
| `Pesado` | `HeavyFile` |
| `PESADOS` | `HEAVY_FILES` |
| `pesadosDoArranque` | `heavyAtBoot` |
| `pesoPorBaixar` | `bytesLeftToDownload` |
| `QUADROS_ENTRE_ROTAS` | `FRAMES_BETWEEN_ROUTES` |
| `RelatorioPesado` | `HeavyReport` |
| `rotaDoReconhecimento` | `recognitionRoute` |
| `RotaDoReconhecimento` | `RecognitionRoute` |
| `SHA256_DAS_VOZES_KOKORO` | `KOKORO_VOICES_SHA256` |
| `SHA256_DO_MODELO_KOKORO` | `KOKORO_MODEL_SHA256` |
| `TAU_DO_GUIA` | `GUIDE_TAU` |
| `textoFalado` | `spokenText` |
| `TOKENS_MAXIMOS` | `MAX_KOKORO_TOKENS` |
| `URL_DO_MODELO_KOKORO` | `KOKORO_MODEL_URL` |
| `urlDaVozKokoro` | `kokoroVoiceUrl` |
| `VOL_LONGE` | `FAR_VOL` |
| `VOZES_KOKORO` | `KOKORO_VOICES` |
| `vozesDoIdioma` | `voicesForLocale` |
| `VozKokoro` | `KokoroVoice` |
| `VozNeural` | `NeuralVoice` |

## AN · The delivery folder is `heavy/` and the command is `inclusionist-heavy` (ADR-0219, issue #202)

**What changed.** The heavy files are served from `heavy/<host><path>` beside the page instead of `pesados/<host><path>`,
and the published command that writes them into a delivery is `npx inclusionist-heavy <folder>` instead of
`npx inclusionist-pesados`.

**What a school does NOT pay.** 📏 Measured before the change: the verified cache keeps every entry under its UPSTREAM address
(`deliveryCacheKey`), so nothing is downloaded again — and the cache's own name stays `incl-pesados-v2` for exactly that
reason. Renaming the cache would orphan 814 MiB a school already has, and stored keys are out of this release by the record's
own words.

**What to do.** After bumping the engine, **build the delivery again** with the new command. A `dist` written by the old
command has its files under `pesados/` and the new engine asks for `heavy/` — the page gets a 404 for every model, and the
child meets a game with no voice, no reading and no camera. Nothing else changes: the catalogue, the sha256 of each file and
the upstream addresses are the same.

⚠️ One name stays in Portuguese on purpose, and it is not the folder: `incl-pesados-v2`, the cache. See above.

## AO · The public surface of `input` speaks English (ADR-0219, issue #202)

**What this is.** The third layer. 📏 84 names, 85 files, 1206 occurrences; the tree's Portuguese debt falls from 1328
identifiers in 104 files to 1238 in 99. The table below is printed from the map the engine renames itself from.

**What to do.** Rename on your side by the table. 📌 The ones a game is most likely to hold: `marcarTecla`/`soltarTecla` are
`markKey`/`releaseKey`, `carimbarOrigem` is `stampSource`, `entradaDe` is `inputOf`, and the whole «alternância»
family is now the LATCH — `alternanciaDe` → `latchOf`, `chaveDaAlternancia` → `latchKey`,
`criarArestaComAlternancia` → `createLatchedEdge`.

📌 **Two names did not take the obvious English word, and the reason is written here rather than guessed later.**
`Transporte` became `TransportName` and not `Transport`, because `Transport` already exists in `input/transports` as
something else — what a transport CAN do, not what it is called. And `SimulacaoMotora`/`FiltroMotor` became
`EmpathySimulation`/`EmpathyFilter`: «motor» is the same word in both languages with different meanings — the engine
itself is «o motor» in this repository — so the name would have read as «the engine's filter» to half its readers. The panel
already calls these the empathy simulations (ADR-0181).

**input** — 84 names, applied 2026-09-21

| was | is |
|---|---|
| `alcance` | `reach` |
| `Alcance` | `Reach` |
| `alternanciaAgora` | `latchNow` |
| `alternanciaDe` | `latchOf` |
| `alternanciaEhEscolha` | `latchIsOptional` |
| `alternanciaGuardada` | `storedLatch` |
| `alternanciaSempreLigada` | `latchAlwaysOn` |
| `AmostraDoPonteiro` | `PointerSample` |
| `aplicarAlternancia` | `applyLatch` |
| `aposAresta` | `afterEdge` |
| `ArestaComAlternanciaOpts` | `LatchedEdgeOptions` |
| `arestaDoJogador` | `playerEdge` |
| `ArmazemDaAlternancia` | `LatchStore` |
| `bordaDoAperto` | `pressEdge` |
| `BordaDoAperto` | `PressEdge` |
| `carimbarOrigem` | `stampSource` |
| `CHAVE_DE_ORIGEM` | `SOURCE_KEY` |
| `chaveDaAlternancia` | `latchKey` |
| `ChaveDaPersona` | `PersonaKey` |
| `chaveLegadaDaAlternancia` | `legacyLatchKey` |
| `COM_ALTERNANCIA_PROPRIA` | `LATCH_OF_THEIR_OWN` |
| `conflitosEntreTabelas` | `conflictsBetweenTables` |
| `criarArestaComAlternancia` | `createLatchedEdge` |
| `criarAssistenteDoPad` | `createPadWizard` |
| `criarFiltroMotor` | `createEmpathyFilter` |
| `DecisaoDeTecla` | `KeyDecision` |
| `dentro` | `isInside` |
| `desabilitarAssistida` | `disableAssisted` |
| `desabilitarAssistidaDe` | `disableAssistedFor` |
| `Disponibilidade` | `Availability` |
| `doCentro` | `fromCentre` |
| `DoCentro` | `FromCentre` |
| `ehTransporte` | `isTransportName` |
| `emFracao` | `asFraction` |
| `EmFracao` | `AsFraction` |
| `entradaDe` | `inputOf` |
| `esquecerEntradas` | `forgetInputs` |
| `EsquemaSalvo` | `SavedScheme` |
| `EstadoDaEntrada` | `InputState` |
| `EventoDeTeclaLike` | `KeyEventLike` |
| `EXIGEM_HABILITACAO` | `NEED_ENABLING` |
| `fabricaComOJogo` | `factoryWithGame` |
| `FiltroMotor` | `EmpathyFilter` |
| `gravarAlternancia` | `writeLatch` |
| `habilitarAssistida` | `enableAssisted` |
| `habilitarAssistidaDe` | `enableAssistedFor` |
| `JogadorDaAlternancia` | `LatchPlayer` |
| `lacunasDoToque` | `touchGaps` |
| `leituraDaAlternancia` | `readLatch` |
| `LeituraDaAlternancia` | `LatchReading` |
| `lerTriEstado` | `readTriState` |
| `LUGARES` | `SLOTS` |
| `mapaDoPad` | `padMap` |
| `MapeamentoDoPad` | `PadMapping` |
| `MapeamentoDoTeclado` | `KeyboardMapping` |
| `marcarTecla` | `markKey` |
| `marcarTeclaSemOrigem` | `markKeyWithoutSource` |
| `migrarEsquema` | `migrateScheme` |
| `migrarMapaDeControle` | `migrateControlMap` |
| `migrarMapaDeToque` | `migrateTouchMap` |
| `migrarSalvo` | `migrateSaved` |
| `montarControleDeToque` | `mountTouchControls` |
| `nomeDoBotao` | `buttonName` |
| `origemDaTecla` | `keySource` |
| `origemDe` | `sourceOf` |
| `origemDoEvento` | `sourceOfEvent` |
| `personaMaisProxima` | `closestPersona` |
| `prender` | `clampInside` |
| `registrarMapeamentoDoPad` | `registerPadMapping` |
| `registrarMapeamentoDoTeclado` | `registerKeyboardMapping` |
| `SEGURA_TOQUE` | `HOLDS_TOUCH` |
| `SimulacaoMotora` | `EmpathySimulation` |
| `sincronizarAlternancia` | `syncLatch` |
| `soltarTecla` | `releaseKey` |
| `soltarTodas` | `releaseAllKeys` |
| `tabelaDoPad` | `padTable` |
| `TabelaDoPad` | `PadTable` |
| `Transporte` | `TransportName` |
| `TRANSPORTES` | `TRANSPORT_NAMES` |
| `transportesPadrao` | `defaultTransports` |
| `trocouDeTransporte` | `switchedTransport` |
| `UM_COMANDO_DE_CADA_VEZ` | `ONE_COMMAND_AT_A_TIME` |
| `umBotaoPorVez` | `oneButtonAtOnce` |
| `VOCABULARIO_ANTIGO` | `OLD_VOCABULARY` |

## AP · The public surface of `render` speaks English (ADR-0219, issue #202)

**What this is.** The fourth layer. 📏 103 names, 60 files, 1047 occurrences; the tree's Portuguese debt falls from 1238
identifiers in 99 files to 1123 in 95.

**What to do.** Rename on your side by the table. 📌 The heaviest for a cartridge is the RENDER PORT — the shapes a game
implements to let the engine draw: `Desenho`→`Drawing`, `Camada`→`Layer`, `CriarSprite`→`CreateSprite`,
`Tingivel`→`Tintable`, `Visivel`→`Visible`, `Descartavel`→`Disposable`. A game that implements the port renames
its own types; nothing else about the port changed.

📌 **One line disappeared rather than being renamed**: `render/scene-sky` carried `type Layer = Camada` — an alias whose
only job was to translate the imported name. With the import renamed, the alias was the name pointing at itself.

**render** — 103 names, applied 2026-09-21

| was | is |
|---|---|
| `aglomeracaoAlvo` | `targetCrowding` |
| `AlcanceDoFiltro` | `FilterReach` |
| `alcanceDoModo` | `reachOfMode` |
| `aplicacao` | `howItApplies` |
| `Aplicacao` | `HowItApplies` |
| `AplicarAltoContrasteNoDom` | `ApplyHighContrastToDom` |
| `AplicarFiltroCss` | `ApplyCssFilter` |
| `ARQUIVO_POR_CAMADA` | `FILE_PER_LAYER` |
| `Camada` | `Layer` |
| `CamadaEsvaziavel` | `ClearableLayer` |
| `CamadaParallax` | `ParallaxLayer` |
| `CENARIO_PADRAO` | `DEFAULT_SCENERY` |
| `CENARIOS` | `SCENERIES` |
| `CenarioTema` | `SceneryTheme` |
| `CHAVE_DO_MOTIVO` | `REASON_KEY` |
| `chaveDeTextura` | `textureKey` |
| `chaveLegada` | `legacyKey` |
| `CHAVES_ANTIGAS` | `LEGACY_KEYS` |
| `ComFiltro` | `WithFilter` |
| `ComTextura` | `WithTexture` |
| `COR_DA_LIXEIRA` | `BIN_COLOUR` |
| `CORRECOES` | `CORRECTIONS` |
| `createSetCenario` | `createSetScenery` |
| `CriarAzulejo` | `CreateTile` |
| `criarCamera` | `createCamera` |
| `CriarDesenho` | `CreateDrawing` |
| `CriarSprite` | `CreateSprite` |
| `CURTO_DA_CORRECAO` | `SHORT_CORRECTION` |
| `CURTO_DO_TEMA` | `SHORT_THEME` |
| `Descartavel` | `Disposable` |
| `desenharBaixaVisao` | `drawLowVision` |
| `desenharPredios` | `drawBuildings` |
| `Desenho` | `Drawing` |
| `DesenhoComCirculo` | `DrawingWithCircle` |
| `DesenhoComLinha` | `DrawingWithLine` |
| `DesenhoDeBaixaVisao` | `LowVisionDrawing` |
| `ehBaixaVisao` | `isLowVision` |
| `ehCego` | `isBlind` |
| `ehSimulacao` | `isSimulation` |
| `eixosHtml` | `axesHtml` |
| `EixoVisual` | `VisualAxis` |
| `enquadrar` | `frameOn` |
| `EscolhaDeEixo` | `AxisChoice` |
| `escolhaDoBotao` | `buttonChoice` |
| `FaixaDePredios` | `BuildingBand` |
| `faseDoClima` | `weatherPhase` |
| `filtroChave` | `filterKey` |
| `getAglomeracao` | `getCrowding` |
| `larguraDoCeu` | `skyWidth` |
| `lerVisualGuardado` | `readStoredVisual` |
| `linhasDoEixo` | `axisRows` |
| `Lixeira` | `Bin` |
| `LIXEIRA_H` | `BIN_H` |
| `LIXEIRA_W` | `BIN_W` |
| `LIXO_ART` | `LITTER_ART` |
| `migrarVisual` | `migrateVisual` |
| `mostraMesmoIndisponivel` | `showsEvenWhenUnavailable` |
| `MotivoIndisponivel` | `UnavailableReason` |
| `normalizarCenario` | `normaliseScenery` |
| `NUVEM_H` | `CLOUD_H` |
| `NUVEM_W` | `CLOUD_W` |
| `NuvemDeTela` | `ScreenCloud` |
| `nuvensDeTela` | `screenClouds` |
| `paintCaixaDePapelao` | `paintCardboardBox` |
| `paintCao` | `paintDog` |
| `paintGarrafaPet` | `paintPetBottle` |
| `paintGato` | `paintCat` |
| `paintLatinha` | `paintCan` |
| `paintLixeira` | `paintBin` |
| `paintPlaca` | `paintSign` |
| `paintPombo` | `paintPigeon` |
| `paintPomboFly` | `paintPigeonFly` |
| `paintPoteDeVidro` | `paintGlassJar` |
| `paradasDoCeu` | `skyStops` |
| `pintarSol` | `paintSun` |
| `PLACA_H` | `SIGN_H` |
| `PLACA_W` | `SIGN_W` |
| `PosicaoParallax` | `ParallaxPosition` |
| `posicoesParallax` | `parallaxPositions` |
| `proximaCorrecao` | `nextCorrection` |
| `proximoTema` | `nextTheme` |
| `Recusa` | `Refusal` |
| `recusaDaSimulacao` | `simulationRefusal` |
| `RenderizarEm` | `RenderInto` |
| `ROTULO_DA_CORRECAO` | `CORRECTION_LABEL` |
| `ROTULO_DO_TEMA` | `THEME_LABEL` |
| `SetCenarioApi` | `SetSceneryApi` |
| `SetCenarioCtx` | `SetSceneryCtx` |
| `SILHUETAS` | `SILHOUETTES` |
| `simulacaoIndisponivel` | `simulationUnavailable` |
| `SIMULACOES` | `SIMULATIONS` |
| `Tamanho` | `Size` |
| `temaDireto` | `directTheme` |
| `temAltoContraste` | `hasHighContrast` |
| `TemaMorros` | `HillsTheme` |
| `TemaPredios` | `BuildingsTheme` |
| `TEMAS` | `THEMES` |
| `TilesDoTema` | `ThemeTiles` |
| `Tingivel` | `Tintable` |
| `Tradutor` | `Translator` |
| `tremer` | `shake` |
| `Visivel` | `Visible` |
| `ZonaMorta` | `DeadZone` |

## AQ · The public surface of `ui` speaks English (ADR-0219, issue #202)

**What this is.** The fifth layer, and the largest. 📏 101 names, 92 files, 1102 occurrences; the tree's Portuguese debt falls
from 1123 identifiers in 95 files to 1022 in 93.

**What to do.** Rename on your side by the table. 📌 What a cartridge holds most of is the PANEL KIT — `montarPainel`
→ `mountPanel`, `linhaDeControle` → `controlRow`, `montarPassos`/`atualizarPassos`/`passoSeguinte` →
`mountSteps`/`updateSteps`/`nextStep`, `rotularLinha` → `labelRow` — and the quick bar's own vocabulary:
`iconesQueAccionam` → `iconsThatAct`, `ITENS_DA_ENGINE` → `ENGINE_ITEMS`, `anunciarItem` → `announceItem`.

📌 **Two names avoided a word that means different things in the two languages.** `mostrarSubmenuDaPausa` became
`showPauseOptions` («submenu» is the same word in both), and the motor panel's family became the MOBILITY one —
`MotorPlayer` → `MobilityPlayer`, `initSettingsMotor` → `initSettingsMobility`, `montarInteriorDoMotor` →
`mountMobilityInside`. In this repository «o motor» is the engine itself, so `MotorStore` would have read as the engine's
store; «mobility» is the accessibility term with no such double.

**ui** — 101 names, applied 2026-09-21

| was | is |
|---|---|
| `abaixoDoPiso` | `belowFloor` |
| `acaoNaBarra` | `barAction` |
| `AcaoNaBarra` | `BarAction` |
| `acaoQueJaTem` | `actionAlreadyBound` |
| `AccionaveisDoJogo` | `ActionableIcons` |
| `alvoMinimo` | `minimumTarget` |
| `AmostraDoPersonagem` | `CharacterSample` |
| `ANIMACOES_DO_PERSONAGEM` | `CHARACTER_ANIMATIONS` |
| `animarFigura` | `animateFigure` |
| `anunciarItem` | `announceItem` |
| `anyMotorActive` | `anyMobilityActive` |
| `aplicarEscala` | `applyScale` |
| `aplicarRotuloDoContador` | `applyCounterLabel` |
| `aplicarRotulos` | `applyLabels` |
| `atualizarPassos` | `updateSteps` |
| `AVISO_DE_QUEDA_ID` | `CRASH_NOTICE_ID` |
| `AvisoDeQuedaCtx` | `CrashNoticeCtx` |
| `caaDisponiveis` | `caaAvailable` |
| `caaMotivo` | `caaReason` |
| `caaRotulo` | `caaLabel` |
| `Caixa` | `Box` |
| `caixaAltaLigada` | `upperCaseOn` |
| `CaixaNomeada` | `NamedBox` |
| `CHAVE_DA_RECUSA` | `REFUSAL_KEY` |
| `CHAVES_DE_CENA` | `SCENE_KEYS` |
| `cicloDeTipografia` | `typographyCycle` |
| `contadorLabel` | `counterLabel` |
| `criarAvisoDeQueda` | `createCrashNotice` |
| `definirAlternanciaDeCorrida` | `setRunLatch` |
| `definirAlternanciaDeMarcha` | `setMoveLatch` |
| `desenharOpcoesDoJogo` | `drawGameOptions` |
| `Escala` | `Scale` |
| `ESCALA_DA_MAO` | `HANDWRITING_SCALE` |
| `escalaDaFace` | `faceScale` |
| `escalaDoPalco` | `stageScale` |
| `EscritaDaAlternanciaCtx` | `LatchWriteCtx` |
| `EscritoresVisuais` | `VisualWriters` |
| `EXIGEM_ALTERNANCIA` | `NEED_LATCH` |
| `faceDisponivel` | `faceAvailable` |
| `familiasDaFace` | `faceFamilies` |
| `focaveisNoDom` | `focusablesInDom` |
| `FormaDoControle` | `ControlShape` |
| `GLIFO_DO_ITEM` | `ITEM_GLYPH` |
| `glifoFalado` | `spokenGlyph` |
| `guardarCena` | `storeScene` |
| `iconesQueAccionam` | `iconsThatAct` |
| `idsDaCasca` | `shellIds` |
| `INICIO_DO_CICLO` | `CYCLE_START` |
| `initSettingsMotor` | `initSettingsMobility` |
| `invasoresDaBarra` | `barIntruders` |
| `ITENS_DA_ENGINE` | `ENGINE_ITEMS` |
| `itensNavegaveis` | `navigableItems` |
| `itensQueAccionam` | `itemsThatAct` |
| `legendaDoIcone` | `iconCaption` |
| `lerCenaGuardada` | `readStoredScene` |
| `letrasRowHtml` | `lettersRowHtml` |
| `ligarLegendaDaBarra` | `wireBarCaption` |
| `linhaDaFonte` | `fontRow` |
| `linhaDeControle` | `controlRow` |
| `linhasDoAviso` | `noticeRows` |
| `LQ_PASSOS` | `LQ_STEPS` |
| `lqPosicao` | `lqPosition` |
| `maosDaEtiqueta` | `handsForTag` |
| `MedidaDeNo` | `NodeMeasure` |
| `montarCasca` | `mountShell` |
| `montarInteriorDoAudio` | `mountAudioInside` |
| `montarInteriorDoMotor` | `mountMobilityInside` |
| `montarInteriorDoSom` | `mountSoundInside` |
| `montarPainel` | `mountPanel` |
| `montarPassos` | `mountSteps` |
| `montarSlides` | `mountSlides` |
| `mostraMesmoExigida` | `showsEvenWhenRequired` |
| `mostrarAvisoDeAlcance` | `showReachNotice` |
| `mostrarSlide` | `showSlide` |
| `mostrarSubmenuDaPausa` | `showPauseOptions` |
| `motivoDoItem` | `itemReason` |
| `MotorPlayer` | `MobilityPlayer` |
| `MotorStore` | `MobilityStore` |
| `opcoesDeMotor` | `voiceEngineOptions` |
| `padraoDeCena` | `sceneDefault` |
| `papelDaFonte` | `fontRole` |
| `partesDoControle` | `controlParts` |
| `PassoDeTipografia` | `TypographyStep` |
| `passoNaPausa` | `stepInPause` |
| `passoSeguinte` | `nextStep` |
| `PassosSpec` | `StepsSpec` |
| `PM_ITENS_VISIVEIS` | `PM_VISIBLE_ITEMS` |
| `PM_JOGO_BTNS` | `PM_GAME_BTNS` |
| `proximoNaArmadilha` | `nextInTrap` |
| `raizQueAcciona` | `rootThatActs` |
| `recusaDaAlternancia` | `latchRefusal` |
| `RecusaDaAlternancia` | `LatchRefusal` |
| `resumirSonda` | `summariseProbe` |
| `ResumoDaSonda` | `ProbeSummary` |
| `rotularLinha` | `labelRow` |
| `saneiaNivelTea` | `sanitiseTeaLevel` |
| `SELETOR_FOCAVEL` | `FOCUSABLE_SELECTOR` |
| `SEM_TECLA` | `NO_KEY` |
| `SettingsMotorApi` | `SettingsMobilityApi` |
| `SettingsMotorCtx` | `SettingsMobilityCtx` |
| `VozDoPainel` | `PanelVoice` |

## AR · The last three layers, and the public surface is English (ADR-0219, issue #202)

**What this is.** `educational` (15 names), `consumer-quiz` (9) and `boot` (2) — and with them the rename decided in
ADR-0219 is complete. 📏 The tree's Portuguese debt falls from 1022 identifiers to 1020, and the measurement that closes the
phase is the other one: **zero of the 1620 public names carries a Portuguese word**, down from 454 of 1612 when this started.

**What to do.** Rename on your side by the table. 📌 The two that a cartridge holds are in `boot`:
`GanchosDoCartucho`→`CartridgeHooks` (the half of a game `mount` receives) and `MedicaoDeFlashes`→`FlashMeasurement`.

⚠️ **What did NOT change, and is not an oversight:** the i18n dictionaries and their keys, the `incl_*` stored keys, the
cache name `incl-pesados-v2`, the FILE names (`app/js/platform/pesados.ts` is still called that — renaming files is the
next phase, and doing it here would make two histories to follow instead of one), and 1020 identifiers that are internal to a
module and reach nobody outside it. What this release promised was the SURFACE, and the surface is done.

**educational** — 15 names, applied 2026-09-21

| was | is |
|---|---|
| `ALVO_DE_SUBIDA` | `LEVEL_UP_TARGET` |
| `aposSinalizar` | `afterSignalling` |
| `Barra` | `Bar` |
| `barraDe` | `barOf` |
| `Contexto` | `Context` |
| `CorDaBarra` | `BarColour` |
| `Faixa` | `Band` |
| `faixaDe` | `bandOf` |
| `FALHAS_SEGUIDAS_QUE_DESCEM` | `MISSES_IN_A_ROW_THAT_DROP` |
| `JANELA` | `WINDOW` |
| `Motivo` | `Reason` |
| `pisoDeChute` | `guessFloor` |
| `SEGMENTOS_DA_BARRA` | `BAR_SEGMENTS` |
| `Veredicto` | `Verdict` |
| `VeredictoLido` | `ReadVerdict` |

**consumer-quiz** — 9 names, applied 2026-09-21

| was | is |
|---|---|
| `alternativaOuvida` | `heardAlternative` |
| `declararQuiz` | `declareQuiz` |
| `fimTexto` | `endText` |
| `narracaoAoDesenhar` | `narrationOnDraw` |
| `narracaoDaPergunta` | `questionNarration` |
| `opcaoFalada` | `spokenOption` |
| `perguntaHtml` | `questionHtml` |
| `proximoFoco` | `nextFocus` |
| `respostaTexto` | `answerText` |

**boot** — 2 names, applied 2026-09-21

| was | is |
|---|---|
| `GanchosDoCartucho` | `CartridgeHooks` |
| `MedicaoDeFlashes` | `FlashMeasurement` |

## AS · A root now has an END: `Engine.dispose()` (issue #201 neighbourhood; the case the Dev asked about on 2026-09-21)

**What this is.** `Engine` gains a REQUIRED member, `dispose()`, which releases the current cartridge — everything `unmount()`
does — and then **stops the root listening to the window**. It is a breaking change only for code that *implements* the `Engine`
type (a hand-written double in a game's tests); for everybody who merely receives what `createGame` returns, it is an addition.

**Why a root needed an end, and it is measured and not tidiness.** `createGame` installs about thirty listeners on the window —
the scan interception, START, SELECT, `action4`, the resize, the language change, and the five that `ui/menu-nav.attach()` puts
there — and **nothing could ever take them off**. Removing the host element from the document does not silence a root, and every
query a root makes is document-wide (`getPauseMenu` is `doc.querySelector('#vp-pause-0')`), so a root that was finished went on
driving the pause card of whatever root came next. 📏 Measured in the browser with the real engine: **one ArrowDown moved the
cursor one item with one root alive, two with a second, three with a third** — the child presses down once and the cursor jumps.

⚠️ **And the cure is NOT in `unmount()`, which is where it first looks like it belongs.** `unmount()` releases the CARTRIDGE
(ADR-0142), and a `mount()` after it must find a root that still hears the keyboard — taking the listeners off there would leave
the child who swaps cartridges with no keyboard at all, a worse defect than the one being cured. The two are separate methods for
that reason, and a case in `tests/a-disposed-root-stops-listening.browser.test.js` holds the separation.

**What to do.** Nothing, unless you wrote an object typed `Engine` by hand: then add `dispose()`. And if your page drops a root
without dropping the document — a menu that swaps games, a test that opens several — call `motor.dispose()` when you drop it.

## AT · The FILE names speak English too — `core` (ADR-0219 phase 3, issue #202)

**What this is.** Phase 2 renamed what a module exports; this renames what a module IS CALLED. A game writes
`from '@the-inclusionist/engine/core/anel.js'`, so a path is a contract exactly as a name is, and note AR said this phase was
next. It lands in the SAME major as AL–AS on purpose: a consumer should edit an import once, not twice.

**What to do.** Change the path in your imports by the table. The names inside them did not change in this commit — `stepInRing`
and `accessibleLabel` are what they were called after phase 2; only the file they come from moved.

📌 **The new name is the one the module already said out loud.** `anel.ts` exported `stepInRing` and nothing else, and
`rotulo-acessivel.ts` exported `accessibleLabel` — a file whose name disagrees with its only export makes a reader look twice
for a second thing that is not there. And the test moved with its module: a test still called `rotulo-acessivel` would have been
the last place the old word survived.

⚠️ **`git mv`, not a rewrite**, so `git blame` still answers for every line — the reason a line exists is the most expensive
thing in this repository, and a moved file that was retyped loses all of it.

<!-- printed by `node scripts/print-rename-table.mjs --files core` -->

**core** — 3 files, moved 2026-09-22

| was | is |
|---|---|
| `app/js/core/anel.ts` | `app/js/core/ring.ts` |
| `app/js/core/rotulo-acessivel.ts` | `app/js/core/accessible-label.ts` |
| `tests/rotulo-acessivel.node.test.js` | `tests/accessible-label.node.test.js` |

## AU · The FILE names speak English too — `platform`, and the delivery's last Portuguese words (ADR-0219 phase 3, issue #202)

**What this is.** The two modules of the heavy delivery change path, and with them the script a cartridge runs after its own
build. The names inside them were already English — `HEAVY_FILES`, `CACHE_HEAVY`, `downloadHeavy`, `heavyAtBoot` — so the files
were the last place the old word lived. 📏 The house spells it **catalogue**, 159 times against 36; that was measured, not picked.

🔴 **AND TWO THINGS NOTE AN RENAMED AND NEVER FOLLOWED THROUGH, fixed here.** `docs/6-DevOps-SRE/models.md` still told a school
to run **`npx inclusionist-pesados`**, a command that stopped existing on 2026-09-21, and still described the delivery folder as
`pesados/` when it has been `heavy/` since the same day. A page that names a command nobody can run is worse than no page.
`package-lock.json` carried the same stale `bin` name and was regenerated.

**What to do.** Change the path in your imports by the table. If you script the delivery, the npm script inside this repository
is now `npm run heavy:delivery`; the published command has been `npx inclusionist-heavy` since note AN and does not change here.

⚠️ **What did NOT change, and is not an oversight:** the cache is still called `incl-pesados-v2`. Note AN already said why —
renaming it orphans every byte a school has already downloaded, and 814 MiB is not a thing to make a school fetch twice for a
spelling.

<!-- printed by `node scripts/print-rename-table.mjs --files platform` -->

**platform** — 5 files, moved 2026-09-22

| was | is |
|---|---|
| `app/js/platform/pesados-catalogo.ts` | `app/js/platform/heavy-catalogue.ts` |
| `app/js/platform/pesados.ts` | `app/js/platform/heavy.ts` |
| `scripts/pesados-na-entrega.mjs` | `scripts/heavy-into-the-delivery.mjs` |
| `tests/pesados-na-entrega.node.test.js` | `tests/heavy-into-the-delivery.node.test.js` |
| `tests/pesados.node.test.js` | `tests/heavy.node.test.js` |

## AV · The FILE names speak English too — `input` (ADR-0219 phase 3, issue #202)

**What this is.** Three modules of the input layer change path. As in AT and AU, the names inside them do not change: each new
file name is the one the module already exported. `motor-simulation.ts` exports `EmpathySimulation`, `EmpathyFilter` and
`createEmpathyFilter` — phase 2 moved that family to EMPATHY on purpose, because «motor» is the same word in both languages
with different meanings and here the engine itself is «o motor» — so the file was the last thing still calling it motor.

📌 `transport-in-use.ts` keeps the longer name rather than becoming `transport.ts`: `input/transports.ts` already exists and is
a different thing. The length is what keeps the two apart.

**What to do.** Change the path in your imports by the table.

<!-- printed by `node scripts/print-rename-table.mjs --files input` -->

**input** — 5 files, moved 2026-09-22

| was | is |
|---|---|
| `app/js/input/motor-simulation.ts` | `app/js/input/empathy-filter.ts` |
| `app/js/input/origem-sintetica.ts` | `app/js/input/synthetic-source.ts` |
| `app/js/input/transporte-em-uso.ts` | `app/js/input/transport-in-use.ts` |
| `tests/simulacao-motora.node.test.js` | `tests/empathy-filter.node.test.js` |
| `tests/transporte-em-uso.node.test.js` | `tests/transport-in-use.node.test.js` |

## AW · The FILE names speak English too — `render` and `ui`, and the ten modules are done (ADR-0219 phase 3, issue #202)

**What this is.** The last three modules that carried a Portuguese word in their name. With them, **all ten modules measured on
2026-09-22 have moved** — the rest of the 185 file names are 145 tests, 6 scripts and the docs, which break nobody and can
follow at any time.

As in AT, AU and AV, no exported name changes: `cenario-data.ts` already exported `SceneryTheme`, `SCENERIES` and
`DEFAULT_SCENERY`; `set-cenario.ts` already exported `createSetScenery`; and `settings-motor.ts` already exported
`MobilityStore`, `MobilityPlayer` and `SettingsMobilityCtx` — phase 2 moved that family to MOBILITY for the same reason the
empathy filter left «motor» behind, and the file was the last holdout.

📌 **The two layers are one note and one commit on purpose.** The map marks a layer as applied, and the gate reads the map
against the disk; committing `render` by itself would have left a commit in the history whose own gate was red about `ui`.

⚠️ **`docs/art-ref/cenarios/**` and `docs/game-design/plano-cenario-cidade.md` did NOT move**: the first is art reference the
Dev owns and the second is a document — phase 5 — and neither is a path anybody imports.

<!-- printed by `node scripts/print-rename-table.mjs --files render` and `… --files ui` -->

**render** — 4 files, moved 2026-09-22

| was | is |
|---|---|
| `app/js/render/cenario-data.ts` | `app/js/render/scenery-data.ts` |
| `app/js/render/set-cenario.ts` | `app/js/render/set-scenery.ts` |
| `tests/cenario-data.node.test.js` | `tests/scenery-data.node.test.js` |
| `tests/set-cenario.node.test.js` | `tests/set-scenery.node.test.js` |

**ui** — 3 files, moved 2026-09-22

| was | is |
|---|---|
| `app/js/ui/settings-motor.ts` | `app/js/ui/settings-mobility.ts` |
| `tests/settings-motor.browser.test.js` | `tests/settings-mobility.browser.test.js` |
| `tests/settings-motor.node.test.js` | `tests/settings-mobility.node.test.js` |

## AX · The scripts, the tools and the fixtures — NOT breaking (ADR-0219 phase 3, issue #202)

⚠️ **This note breaks nothing, and it is here so nobody goes looking.** None of these files is published: the package ships
`dist-pkg`, the stylesheet, the fonts, the licences and one script (`heavy-into-the-delivery.mjs`, which already moved in AU).
Fourteen internal file names stopped being Portuguese. The only thing a contributor notices is one npm script:
**`npm run censo:issues` is now `npm run issues:census`**.

📌 **Chosen by READING the folders, not by asking the dictionary — and that is a finding worth writing down.** The word lists
classify the words of IDENTIFIERS, so a word that only ever appeared in a FILE NAME was never put in either list:
`acomodacoes`, `taxonomia`, `censo`, `auditar`, `respostas`. 📏 A measurement that trusts them reads those files as clean, which
means the «185 files» measured on the morning of 2026-09-22 was a LOWER BOUND, and so is every number derived from it.

<!-- printed by `node scripts/print-rename-table.mjs --files scripts` -->

**scripts** — 14 files, moved 2026-09-22

| was | is |
|---|---|
| `scripts/acomodacoes-gag.mjs` | `scripts/accommodations-gag.mjs` |
| `scripts/acomodacoes-por-genero.mjs` | `scripts/accommodations-by-genre.mjs` |
| `scripts/censo-de-issues.mjs` | `scripts/issue-census.mjs` |
| `scripts/lib/acomodacoes.mjs` | `scripts/lib/accommodations.mjs` |
| `scripts/lib/taxonomia.mjs` | `scripts/lib/taxonomy.mjs` |
| `scripts/medir-camadas.py` | `scripts/measure-layers.py` |
| `scripts/medir-forma-do-menu.py` | `scripts/measure-menu-shape.py` |
| `scripts/revisao-das-paginas.mjs` | `scripts/page-revisions.mjs` |
| `scripts/taxonomia-de-generos.mjs` | `scripts/genre-taxonomy.mjs` |
| `tests/fixtures/cartucho-falso.js` | `tests/fixtures/fake-cartridge.js` |
| `tests/fixtures/contraste-wcag.js` | `tests/fixtures/wcag-contrast.js` |
| `tests/fixtures/respostas-de-acomodacao.js` | `tests/fixtures/accommodation-answers.js` |
| `tools/auditar-historico.py` | `tools/audit-history-for-secrets.py` |
| `tools/migrar-issues-para-github.py` | `tools/migrate-issues-to-github.py` |

## AY · The 136 test names, in four batches — NOT breaking (ADR-0219 phase 3, issue #202)

⚠️ **Nothing to migrate, and this note exists so nobody looks for something to migrate.** No test is published: the package
ships `dist-pkg`, the stylesheet, the fonts, the licences and one script. One note for the four batches, as promised when the
first one landed — four notes saying «nothing to migrate» would have been four notes too many.

📏 **With this, phase 3's file names are done for everything that is code.** Of the 185 file names measured on the morning of
2026-09-22, **21 are left, and all 21 are documents** — which is phase 5, and a different question: a document's name is read by
a person looking for it, not by an import.

🎯 **The rule the four batches were named by: A TEST'S NAME IS A CLAIM, NOT A LABEL.** `nada-vem-de-fora` asserts that nothing
reaches the device at run time — pillar 8 — so it is `nothing-comes-from-outside`; `estado-nao-so-por-cor` asserts that a state
is never shown by colour alone, so it is `state-never-by-colour-alone`. The old names often said the SUBJECT; the new ones say
what is guaranteed, which is what the file is for.

📌 **What kept its stem on purpose:** `exports-sem-consumidor` → `exports-without-consumer`, because that is what the script and
the ledger beside it are already called; and `revisao-das-paginas` → `page-revisions`, the same stem as `scripts/page-revisions.mjs`.
A gate whose name disagrees with its own ledger makes a reader look for a third thing.

The tables are printed from the map: `node scripts/print-rename-table.mjs --files tests-1` (and `-2`, `-3`, `-4`).

## AZ · Sensory comfort leaves the icon module: `core/calm-mode` (ADR-0221, issue #203)

**What this is.** Six names move from `ui/pause-icons` to a new leaf module, `core/calm-mode`: `CALM_NAMES`,
`CALM_AUDIO_CATS`, `nextCalmMode`, `sanitiseTeaLevel`, `calmAudioPlan` and `calmMotionPlan`. The spelling of each is unchanged;
only the module is.

📏 **Measured before moving: none of the six is imported by any of the seven games** — the surface gate is what asks for this
note, and it asks by shape, not by whether anybody is on the other side. If you do import one, change the path.

⚠️ **One signature changed**: `sanitiseTeaLevel(raw)` is now `sanitiseTeaLevel(raw, fallback)`. The module is a LEAF — zero
imports, no DOM, no storage — which is what makes the destructive volume clamp of level 1 measurable without mounting
anything; and a leaf cannot reach into `core/state` for the default.

📌 **Why it moved at all:** `ui/pause-icons` is 695 lines and 127 decision nodes, and this group is not about ICONS. It is
about what a child who cannot bear noise needs the engine to silence — the icon is one of the surfaces she asks through, the
panel row is another. A module that answers «what does level 2 do to the audio?» should not require reading a file about the
accessibility bar to be found.

## BA · The two visual cycles leave the panel and the icon: `core/visual-cycles` (ADR-0221, issue #203)

**What this is.** High contrast and colour correction are two choices a child steps through from the quick bar, and they lived
in TWO modules: the list of levels in `ui/settings-visual`, the steps and the names in `ui/pause-icons`. Five names move to a
new leaf, `core/visual-cycles`: `CONTRAST_LEVELS`, `CVD_SEQ`, `CVD_NAMES`, `nextContrast` and `nextCvd`. The spelling of each
is unchanged; only the module is. 📏 None of the five is imported by any of the seven games.

📌 **They are together because of the ASYMMETRY between them, which is the expensive thing to maintain.** An unknown `viz`
sends `nextContrast` to index 0 and `nextCvd` to index **1** — so from a mode that is not a correction, contrast switches on at
its first level while colour correction skips «normal» and lands straight in protanopia. It is verbatim from `game.js`. Apart,
a reader fixes one by the other and deletes a decision without knowing it existed.

🔴 **And one name was DELETED rather than moved: `CVD_LABELS`.** It was in the declared debt of `ui/pause-icons` — published,
and measured to have no consumer anywhere — and its own comment said it was «the label `iconLabel` uses», which had stopped
being true without anybody noticing. A debt ledger exists to SHRINK; carrying it to a new house would have carried it another
year. What `iconLabel` uses is `CVD_NAMES`.

## BB · The icon catalogue leaves the icon module: `core/pause-icon-catalogue` (ADR-0221, issue #203)

**What this is.** Three names move from `ui/pause-icons` to a new leaf, `core/pause-icon-catalogue`: the `PauseIcon`
interface, the `PAUSE_ICONS` list and the `pauseIcon(key)` lookup. The spelling of each is unchanged; only the module is.
📏 Measured in all seven games before moving: none of the three is imported by any of them.

📌 **No alias was left behind.** A re-export would have kept the old path working for nobody — and it would have made the
public-surface portrait lie, because the portrait does not see re-exports (issue #204). If you do import one of the three,
change `ui/pause-icons.js` to `core/pause-icon-catalogue.js` in that import and nothing else.

🎯 **Why the DATA had to leave first, before the markup it belongs to.** The cut this step wanted is the markup —
`iconBtnMarkup`, `iconsMarkup`, `quickBarMarkup`, `screenPauseMarkup` — and the markup needs the catalogue. With both in one
file, moving the markup alone would have made the two modules import each other, which is the cycle ADR-0173 forbids. Data at
the bottom, drawing above it, and the next cut becomes possible.

✅ **And `pauseIcon` was PAID rather than carried.** It sat in the declared debt of `ui/pause-icons` — published with no
consumer anywhere — and the consumer it lacked was in the same file: `computeIconLabel` read the private map directly instead
of calling the lookup published beside it. It now calls it. The debt ledger for that module goes from 7 names to 6.

## BC · The markup leaves the icon module: `ui/pause-markup` (ADR-0221, issue #203)

**What this is.** Eight names move from `ui/pause-icons` to a new module, `ui/pause-markup`: the `PauseMenuButton` and
`ScreenPauseMarkupOpts` shapes, the `PauseSub` union, and `iconBtnMarkup`, `iconsMarkup`, `pmBtnMarkup`, `quickBarMarkup` and
`screenPauseMarkup`. The spelling of each is unchanged; only the module is. 📏 Measured in all seven games before moving: none
of the eight is imported by any of them, and inside the engine the only consumer outside the icon module was
`boot/create-game`, which asks for `iconsMarkup`.

🔴 **And TWO names stopped being published rather than moving house: `ITEM_GLYPH` and `pauseMenuHtml`.** Both were in the
declared debt of `ui/pause-icons` — published with no importer anywhere — and both have their only reader in the new module,
one screen away. Moving a published name with no consumer is carrying the debt to a new address; they are now internal. The
ledger for that module goes from 6 names to 4.

🎯 **What each half is for.** `ui/pause-markup` BUILDS strings and touches nothing else: no `document`, no injected ctx, no
state, which is what lets a node test read the pause card without a browser. `ui/pause-icons` keeps the other job — wiring the
elements the browser made from those strings, reflecting their state, and moving the cursor through them.

📌 **No alias was left behind**, for the reason note BB gives: a re-export would keep a path alive for nobody and would make
the public-surface portrait lie, since it does not see re-exports (issue #204). If you import one of the eight, change
`ui/pause-icons.js` to `ui/pause-markup.js` in that import and nothing else.

## BD · The audio panel's pure half leaves: `ui/audio-choices` (ADR-0221, issue #203)

**What this is.** Nineteen names move from `ui/settings-audio` to a new module, `ui/audio-choices`: the `AudioCatDef`,
`AudioCatState`, `VoiceLike` and `SinkDeviceLike` shapes, the `NAV_CATS` and `GEN_CATS` lists, `TTS_ENGINE_OPTIONS`, and
`volPercent`, `catRowHTML`, `catsListHTML`, `navMasterVolume`, `parseCaneDiv`, `caneDivMessage`, `voiceEngineOptions`,
`pickVoicesFor`, `voiceLabel`, `sinksSupported`, `sinkOptionLabel` and `sinkSelectValue`. The spelling of each is unchanged;
only the module is. If you import one of them, change `ui/settings-audio.js` to `ui/audio-choices.js` and nothing else.

🎯 **What each half is for.** `ui/audio-choices` answers what a choice IS — the categories, the volume arithmetic, the engine
catalogue, the voice filter, the label of an output — with no `document`, no ctx and no state. `ui/settings-audio` keeps the
other job: finding the thirteen controls the panel reaches and never created, wiring them, and reflecting what the child
chose. 📏 That module was 568 lines and 112 decision nodes, the third largest in the engine, and goes to **517 and 107**.

🔴 **And the suite had already made this cut, which is what made it obvious.** `tests/settings-audio.node.test.js` imported
exactly these names and nothing else, while `settings-audio.browser.test.js` drove the DOM half. The file was two modules
wearing one name, and the only place that said so out loud was the test folder.

## BE · The voice section leaves the hearing panel: `ui/voice-settings` (ADR-0221, issue #203)

**What this is.** Three shapes move from `ui/settings-audio` to a new module, `ui/voice-settings`: `TtsPanel`,
`TtsPanelEngine` and `PanelVoice`. The spelling of each is unchanged; only the module is. If you import one of them, change
`ui/settings-audio.js` to `ui/voice-settings.js` and nothing else. `SettingsAudioCtx.tts` still takes the same `TtsPanel`.

🎯 **What moved with them.** The narration switch, the engine list, the system-voice list, the speech rate, the spoken index,
the sample button and the rule that locks the five speech rows when no voice speaks the language — the whole VOICE half of
the hearing panel. 📏 `ui/settings-audio.ts` goes from **568 lines and 112 decision nodes to 339 and 59** across today's two
cuts; `ui/voice-settings.ts` is 221 and 47.

⚠️ **And it receives the browser instead of reaching it.** `document.createElement`, `speechSynthesis.getVoices`, the sample
utterance and the `onvoiceschanged` subscription arrive as four ports (`VoicePorts`). That is not taste: the health ratchet
refuses a NEW module that reaches a global, where the ceiling is zero and not a p90 (ADR-0178, ADR-0221 step 7d). A consumer
that mounts the panel through `initSettingsAudio` passes nothing new — the panel builds the four ports itself.

📌 **A caller that only wanted `reflectTts` is unaffected**: `initSettingsAudio(...).reflectTts` still exists and still does
the same thing, which is what the quick bar's icon calls.

## BF · `core/i18n` stops reaching the browser: the page arrives through the port (ADR-0221 step 7g)

**What this is.** Three changes to `core/i18n`, all of them the same decision: the module decides the language and the HOST
does what a page does about it.

| | |
|---|---|
| `LocalePort` | gains two OPTIONAL members: `applied(locale, tag)` — what the page does once a language is kept (`<html lang>`, re-translating the markup, dispatching `i18n:change`) — and `preferred()`, the browser's `navigator.language`. `platform/locale-host.localeHostHooks(doc, win, applyDom)` builds both |
| `setLocale(code)` | no longer writes `<html lang>`, no longer calls `applyDom`, no longer dispatches on `window`. It calls `port.applied?.(…)`. **A host that passes no hooks gets no page effects** — which is what a node process, a worker or a second engine wants |
| `applyDom(root)` · `initI18n(root)` | `root` is REQUIRED. It used to default to the global `document`, which is the reach this step removes |
| `window.__i18n` | no longer set by importing `core/i18n`. `platform/locale-host.exposeI18n(win, i18n)` does it, and `createGame` calls it with the window it was given |

📏 **The result, measured:** `core/i18n` goes from **three global reaches to zero**, and `platform/locale-host` — the module
that holds them — has zero of its own, because it receives the document and the window as parameters.

⚠️ **What to change.** If you call `createGame`, nothing: the root wires the hooks. If you drive `core/i18n` yourself —
`loadLocale(store)` and then `setLocale('es')` — pass the hooks too, or the page will not follow the language:
`loadLocale({ ...store, ...localeHostHooks(document, window, applyDom) })`. And pass the root to `applyDom`/`initI18n`.

🔴 **This was caught by a case and not by reasoning**: `tests/tts.browser` asserts that `<html lang>` and the spoken language
are the same tag, and it went red the moment the cut landed, because the shared test setup wires the port and had no hooks.
It was right: a setup is a composition root, and this one was no longer telling the page anything.

## BG · The four ways of playing with the body get a family name: `SwitchableControl` (ADR-0221 step 7f)

**What this is.** Four interfaces that were the same line leave, and one shared interface arrives.

| gone | in its place |
|---|---|
| `ui/camera-control.CameraModeControl` | `ui/switchable-control.SwitchableControl` — same shape, a name that also fits the voice |
| `ui/eye-control.EyeControl` | `createEyeControl` returns `SwitchableControl` |
| `ui/face-control.FaceControl` | `createFaceControl` returns `SwitchableControl` |
| `ui/hand-control.HandControl` | `createHandControl` returns `SwitchableControl` |
| `ui/voice-control.VoiceControl` | KEPT — it has `refreshGrammar` too, and now `extends SwitchableControl` |

🎯 **Why.** The eyes, the face, the hands and the voice are four ways into the same virtual controller, and they had the same
shape without saying so: 📏 four modules, four interfaces, `apply(on: boolean): Promise<void>` in all four. The abstraction
was not missing — it was unnamed, which is worse, because only the co-change of the four files said it existed. With the
family named, a member that drifts fails where it is WRITTEN instead of where it is combined by `followCameraMode`.

⚠️ **What to change.** If you only call `createEyeControl` / `createFaceControl` / `createHandControl` /
`createVoiceControl`, nothing: the objects are identical. If you named one of the four types, import `SwitchableControl`
from `ui/switchable-control.js` instead — `VoiceControl` still exists for the one that has a method more.

📌 The voice is in the family and NOT in the camera cycle: it answers to the 👄, not to the 📷. That is why the interface is
not called «camera» anything.

## BH · The CAA panel builds NODES: its three string builders leave (ADR-0129, issue #135)

**What this is.** `ui/settings-caa` adopted the panel kit, so the three functions that returned HTML strings leave, and
three that return DATA arrive in their place.

| gone | in its place |
|---|---|
| `ui/settings-caa.lettersRowHtml(on)` | `lettersRowSpec()` → a `ControlRowSpec` the kit turns into a row |
| `ui/settings-caa.caaRowHtml(set, selected)` | `caaRowSpec(set)` → a `ControlRowSpec`; the selection is reflected, not built |
| `ui/settings-caa.caaListHtml(letterCase)` | `mountCaaInside(ctx, list)` — it APPENDS nodes instead of returning a string |
| — | `caaControlId(key)`, `CAA_SECTIONS` — the id rule and the three sections, now readable from outside |
| — | `ui/panel-widgets.sectionHeader(ctx, title, tag, rows)` — ADDITIVE, and the piece four modules were writing by hand |

🎯 **Why.** The rule of `CLAUDE.md` §4 — short label in sight, ALL the prose in a single `.opt-hint` inside the `<span>` —
was enforced by construction in the kit and by convention in the string panels. 📏 A convention copied into four files is a
convention that drifts, and the same was true of `.panel-sub__tag`, hand-written in four modules. Now `controlRow` and
`sectionHeader` write both rules once.

⚠️ **What to change.** If you mount the panel through `initSettingsCaa`, nothing: the ctx is unchanged, the ids are
unchanged (`#caa-caixa-alta`, `#caa-letras`, `button[data-caa="<key>"]`), and the markup a stylesheet sees is the same. If
you called one of the three builders to render the CAA list yourself, call `mountCaaInside(ctx, list)` with a
`{ procurar, criar }` ctx — the same shape the other kit panels take.

📌 **And the panel stopped rebuilding itself.** It used to replace the whole list on every render; now it mounts once and
REFLECTS, which is why `labelRow` exists (rebuilding a row leaves a control in the document with no listener — a dead
button that looks alive, ADR-0106 §5). Practical consequence for a consumer: the nodes in `#caa-list` are now stable
across renders, so a reference you hold stays valid.

## BI · The font menu builds nodes, and the kit learns a fourth shape (ADR-0129, ADR-0012, issue #135)

**What this is.** `ui/settings-typo` adopted the panel kit, so the function that returned the whole list as an HTML string
leaves.

| gone | in its place |
|---|---|
| `ui/settings-typo.typoListHTML(fontKey, installed)` | `mountTypoInside(ctx, list, fontKey, installed)` — it APPENDS nodes |
| — | `typoRowSpec(row)`, `typoControlId(key)` — the row DATA and the id rule, ADDITIVE |
| — | `ui/panel-widgets.ControlShape` gains `'radio'` — ADDITIVE to the union, but see below |

⚠️ **The `ControlShape` union GREW, and a union that grows is only breaking in one direction.** If you accept a
`ControlShape` you are fine; if you produce an exhaustive `switch` over it, or assign one to a narrower type of your own,
TypeScript will now tell you about `'radio'`. 🎯 It exists because a choice is not a toggle: `'radio'` builds a `<button>`
with `role="radio"` and `aria-checked`, WITHOUT the `switch` class — which draws a 52×28 px key with a knob, the picture of
a state that does not exist here. That is the ADR-0012 amendment in a shape: «THE MENU IS A CHOICE, NOT A TOGGLE».

⚠️ **What to change.** Mounting through `initSettingsTypo` needs nothing: the ids the page could already target
(`#typo-list`, `#typo-preview`, `button[data-font="<key>"]`) are unchanged and the `.ctrl-row` markup is the same. Each font
button now also carries an `id` of `typo-font-<key>` — additive. If you rendered the list yourself with `typoListHTML`, call
`mountTypoInside(ctx, list, fontKey, installed)` with a `{ procurar, criar }` ctx.

📌 **And the panel stopped rebuilding itself**, so the seventeen buttons are stable across renders and the focus no longer
falls when a font is chosen. The `radiogroup` is still ONE across the three family headings, because the exclusivity belongs
to the menu and not to each family.

## BJ · What a typography CHOICE is moves out: `ui/typo-choices` (ADR-0221, issue #203)

**What this is.** Nine names leave `ui/settings-typo` and arrive, unchanged, in `ui/typo-choices`. No behaviour changes.

| gone from `ui/settings-typo` | now in `ui/typo-choices` |
|---|---|
| `isSelectableFont`, `fontCssTarget`, `FontCssTarget` | same names, same signatures |
| `fontRow`, `typoGroups`, `TypoRow`, `TypoGroupView` | same |
| `typoRowSpec`, `typoControlId` | same |

🎯 **Why.** The module had two jobs and its name only ever described one. `ui/typo-choices` answers what a choice IS — which
faces can be chosen, what CSS each one drives, what shape the row offering it has — with no DOM, no ctx and no state;
`ui/settings-typo` keeps the work the name always meant: find the nodes it reaches but never created, wire them, and reflect
the choice. 📌 It is the same cut `ui/audio-choices` got from `ui/settings-audio` (note BD), and the same thing marked it: the
test files had already split along that seam, the pure cases in the node project and the markup ones in the browser.

📏 **And the ratchet pointed at it.** Adopting the panel kit (note BI) left `ui/settings-typo` at 183 code lines against a
p90 ceiling of 187 — it had spent its headroom. After the cut it is **134 lines and 20 branches**, below where it stood
*before* the kit adoption (137 and 24), and `ui/typo-choices` is 53 lines with a fan-out of 3.

⚠️ **What to change.** If you only call `initSettingsTypo`, nothing. If you imported any of the nine, change the module path
to `@the-inclusionist/engine/ui/typo-choices.js` — the names and signatures are identical. 📌 No alias was left behind on
purpose: a re-export would keep a path alive that nothing uses and would make the public-surface portrait lie, because it
does not see re-exports (#204).

📌 `resolveFontKey` and `persistFontKey` stay re-exported from `ui/settings-typo`, because that is where their consumer is.

## BK · The remapping panel shows the KEY on the button (ADR-0129, issue #135)

**What this is.** `ui/settings-controls` adopted the panel kit, and the row changed shape on screen. Nothing was removed from
the module's exports — this note exists because the INTERFACE changed, which a consumer's CSS or tests may target.

| before | now |
|---|---|
| `<span><b class="ctrl-nome">Esquerda</b>: <kbd>A</kbd></span>` + `<button>Alterar</button>` | `<span><strong>Esquerda</strong></span>` + `<button id="ctrl-act-left"><kbd>A</kbd></button>` |
| the word «Alterar» is the button's face | the CURRENT KEY is the button's face; «Alterar» appears only where a position has no key |
| `.ctrl-nome` holds the game's word | the kit's `<strong>` holds it; `.ctrl-nome` is gone |
| the button had no `id` | `id="ctrl-act-<action>"`, from the abstract position name — ADDITIVE |
| — | `ControlShape` gains `'button'`: a control that DOES something instead of holding a value — ADDITIVE to the union |

🔴 **Why the value moved, and it was measured rather than preferred.** The old row carried the keys INSIDE the label's
`<span>`, with a `<b>` where the kit emits `<strong>` — and it was the `<b>` that made the row invisible to `fillExplain`,
which gives up on any row without a short label. With a `<strong>` there, `fillExplain` acts, and what it does is
`span.innerHTML = strong.outerHTML`: 📏 measured in a browser probe, **zero of the two `<kbd>` survive**, and «: A Seta
esquerda» goes to the footer as if it were an explanation. The panel would stop showing what is mapped.

📌 **The house had already answered this once.** `mountSteps` has the same problem — label plus live value — and solves it by
putting the value INSIDE the control («◀ Cantos arredondados: pequeno ▶»). Here the value is the key and the control is the
button that changes it. The Dev decided it in those terms, asked whether «Alterar» was worth keeping on screen: «Não vale».

⚠️ **What to change.** If you mount through `initSettingsControls`, nothing: the ids (`#ctrl-list`, `#ctrl-players`,
`button[data-act="<action>"]`), the ctx and the behaviour are the same, and the accessible name is still «Alterar tecla de
X do Jogador N». If your CSS or your tests targeted `.ctrl-nome`, target `.ctrl-row > span > strong` — 📏 measured: that
class carried no styling in this engine, only two test selectors.

## BL · What a KEY is, and whose it already is, moves out: `ui/control-choices` (ADR-0221, issue #203)

**What this is.** Three names leave `ui/settings-controls` and arrive, unchanged, in `ui/control-choices`. No behaviour
changes.

| gone from `ui/settings-controls` | now in `ui/control-choices` |
|---|---|
| `keyName(code)` | same name, same signature |
| `keyUsedByOther(code, mapRef, schemes)` | same |
| `actionAlreadyBound(code, mapRef, except)` | same (the third parameter was renamed `exceto` → `except`; positional, so nothing changes for a caller) |

🎯 **Why.** Third module to take this cut, after `ui/audio-choices` (note BD) and `ui/typo-choices` (note BJ), and marked by
the same thing: `tests/settings-controls.node.test.js` already exercised exactly these functions in a project WITHOUT a
document, while the browser file drove the rest. `ui/control-choices` answers what a key is CALLED and whose it already is;
`ui/settings-controls` keeps drawing the screen, wiring the clicks and driving the capture.

📏 **And the ratchet pointed at it.** Adopting the panel kit (note BK) left `ui/settings-controls` at 195 code lines against
a p90 ceiling of 195 — no headroom at all. After the cut it is **173 lines**, its worst function went **14 → 12**, and
`ui/control-choices` is 26 lines with a fan-out of 3.

⚠️ **What to change.** If you only call `initSettingsControls`, nothing. If you imported any of the three, change the path
to `@the-inclusionist/engine/ui/control-choices.js` — names and signatures are identical. 📌 No alias was left behind, for
the reason the pause-icon cut wrote down: a re-export keeps alive a path nothing uses and makes the public-surface portrait
lie, because it does not see re-exports (#204).

📌 `ACT_LABEL` did NOT move, and that is a decision: it is declared debt with a migration of its own written above it — one
game's words inside the engine, waiting for that cartridge's help screen to ask the cartridge instead. Carrying it to a new
module would be moving the debt to a new address.

## BM · One door to the cartridge: the touch pad presses the virtual controller (ADR-0223, issue #197)

**What this is.** The finger stopped writing KEYS. `input/touch-bindings` now presses a POSITION on
`input/virtual-controller` — the same door the eyes, the face, the hands, the voice and the scan already press — and
`VirtualController.press` answers whether the press reached PLAY.

| before | after |
|---|---|
| `TouchBindingsCtx.markKey(code, source)` | **gone** — `press(action, source): boolean` |
| `TouchBindingsCtx.releaseKey(code)` | **gone** — `release(action, source): void` |
| `TouchBindingsCtx.emMenu(): boolean` | **gone** — the controller answers it, once |
| `TouchBindingsCtx.teclaDeMenu(code, source)` | **gone** — the controller sends it |
| `VirtualController.press(...): void` | `press(...): boolean` — `false` means a menu took it |
| `TouchDecision` carried `code: string` | carries `action: Action` |

🎯 **Why, and it is measured, not argued.** A cartridge that listens only to `onCommand` — which is what the erratum of
ADR-0111 asked every cartridge to do — **received nothing from the finger**. Touch wrote keys, and the root's window
listener excludes the source `toque` explicitly, with a comment claiming those "come as commands already" — true of the
eyes, false of the finger. So the quiz, written after that erratum, did not answer the touch pad at all.

📏 **And the two doors disagreed in three measured places**: with a menu open, door 1 delivered nothing while door 2
delivered the `keyup`; door 1 keeps a `held` map so a game is never left believing a button is still down, and door 2 had
no memory, so a press a menu swallowed followed by a release delivered a release with no press; and door 2 delivered for
a synthetic event nobody signed. With one door, the menu rule, the `held` memory and the source stamp are written once
and hold for every transport.

⚠️ **What to change.** If you only call `createGame`, nothing — the root does the wiring. If you build
`initTouchBindings` yourself, replace the four members above with the two; if you read `TouchDecision`, read `action`
instead of `code`; if you implement something against `VirtualController`, `press` now returns a boolean, and a
transport that raises an edge, hides its tips or announces something should act only when it answers `true`.

📌 **A position with NO key bound now reaches the cartridge.** It used to be silence. The map belongs to the GAME and
not to the keyboard (ADR-0111), so a position the cartridge declared arrives even where the child has no key for it.

📌 **And the touch door takes no SEAT.** The multiplayer of this engine is on separate screens (pillar 7), so a device
with a pad has one finger and one seat. An argument nobody can exercise is a capability nobody can prove.

## BN · The gamepad presses the same door, and the engine hands the cartridge the control object (ADR-0223, ADR-0216, issue #197)

**What this is.** `input/gamepad` stopped raising edges as its only output. Every position that goes down is pressed on
`input/virtual-controller` with the source `gamepad` and the SEAT of that controller; every position that comes up is
released. The edge still rises — the physics of a cartridge learns from it that a button was tapped — but now only for a
press that reached PLAY, which is what the controller answers.

| before | after |
|---|---|
| `GamepadCtx` had no door to the cartridge | **`press(action, source, player): boolean`** and **`release(action, source, player): void`**, both REQUIRED |
| the engine kept the virtual controller private | **`Engine.controller`** is published |
| six positions reached the player, as edge flags | **eight positions reach the cartridge**, as commands |

🎯 **Why the ctx and not the root.** `createGame` mounts the touch pad, the eyes, the face, the hands, the voice and the
scan — and does NOT mount the gamepad: the CARTRIDGE calls `initGamepad`. So the door has to arrive through the ctx, and it
is REQUIRED rather than optional because an optional door is a field a game can forget, and forgetting it returns exactly
the silence this work removes. The errata of ADR-0223 records the measurement.

📌 **And the engine offering the control object is not new policy** — it is ADR-0216 in the Dev's own words: «Assim como a
engine oferece o objeto de controle, ela deve oferecer objetos de leitura e TTS.» `Engine.controller` sits beside
`keyboard`, `nav`, `overlays`, `sonar` and `scenes`.

⚠️ **What to change.** Wherever you call `initGamepad`, add two members to the ctx you pass:

```js
const motor = createGame({ /* … */ });
const pad = initGamepad({
  /* … everything you already pass … */
  press: motor.controller.press,
  release: motor.controller.release,
});
```

📌 **Easy Mode did not change, and that is deliberate.** It filters the EDGE, never the door: the cartridge hears the
button in Easy Mode exactly as the keyboard has always delivered it. The accommodation decides what the physics does with
the button, not whether the game knew the child pressed it.

📌 **Two positions that never had an edge now reach the cartridge**: `up` and `down` always travelled as a held key, and a
cartridge listening to `onCommand` hears them for the first time.

⚠️ **What the gamepad still does not read**: the shoulders and the triggers. A cartridge may declare `leftShoulder`,
`rightTrigger` and the rest, and this transport has no reading for them — measured, and named here so it is not mistaken
for something this change broke.

## BO · The keyboard goes through the same door, and there is one `deliver` left (ADR-0223, issue #197)

**What this is.** The root's window listener was the SECOND door to the cartridge: it resolved the action and delivered
the command itself. It now resolves the action and presses `input/virtual-controller`, like the other five transports.
After this, `deliver` is called from one place.

| before | after |
|---|---|
| the listener called `onCommand` directly | it calls `controller.press` / `controller.release` |
| a `keyup` with a menu open was delivered | nothing is delivered for a press the game never heard |
| the exclusion list NAMED four transports | the question is the inverse: is this the keyboard? |
| `VirtualControllerDeps.holdKey` / `menuKey` took `TransportName` | they take `TransportName \| undefined` |

🎯 **Three measured disagreements between the two doors are gone**, and they were measured before the work (ADR-0223's
context). With a menu open one door delivered the `keyup` and the other delivered nothing. One kept a `held` map so a
release only reaches a press the game heard, and the other had no memory — a press a menu swallowed, followed by a
release, handed the cartridge half of an event that never happened. And the enumerated exclusion list aged with the
list: the voice and the scan arrived after it was written and were never added to it, so a position they had already
pressed could be delivered a second time by the keyboard's driver.

📌 **The keyboard's key is already in the world, and that is why the driver does not ask about menus.** The controller
turns a POSITION into a menu's key for transports that do not produce keys; the keyboard produces them. The host's
`menuKey` implementation refuses to re-dispatch a keyboard key, so one press stays one cursor move — and the menu
question keeps having exactly one answer, the controller's.

⚠️ **What to change.** A cartridge that only listens to `onCommand` gets fewer, more honest events: no release without
a press, and nothing while a menu has the key. If you implement `VirtualControllerDeps` yourself — which only a host
does — `holdKey` and `menuKey` now receive `TransportName | undefined`; wire `holdKey` to `input/state.markKeyFrom`,
which chooses between `markKey` and `markKeyWithoutSource` for you. An unsigned key ERASES the previous producer: it
does not inherit it, and `teclado` is not invented for it (ADR-0109).

## BP · The engine mounts the gamepad (ADR-0224, issue #197)

**What this is.** `createGame` now mounts the controller itself, the way it already mounts the touch pad, the eyes, the
face, the hands, the voice and the scan. A cartridge stops calling `initGamepad` and declares, in one optional field,
only what nothing in the engine can know.

| before | after |
|---|---|
| the CARTRIDGE called `initGamepad` and wired ~25 ctx members | the engine mounts it; the cartridge declares up to ten answers |
| the cartridge polled `pollPads()` from its own frame loop | the engine polls, while a controller is connected |
| the cartridge's players needed `pad` / `waiting` / `quit` | the engine seeds them on the objects you passed |

⚠️ **What to change.** Delete your `initGamepad` call and your `pollPads()` from the frame loop — leaving them mounts a
second controller over the engine's, and both will read the same pad. Move the handful of answers only you have into
`CreateGameOptions.gamepad`:

```js
createGame({
  /* … */
  gamepad: {
    worldRunning: () => phase === 'playing',
    navTitle: (k) => titleMenu.move(k),
    hasModal: (i) => !!challenges[i],
    modalInput: (i, intent) => challenges[i].take(intent),
    joinPlayer, respawnPlayer, clearWaitingBadge,
    attractActive: () => attract.on, stopAttract: attract.stop,
    spriteBase: 'assets/sprites/',
  },
});
```

📌 **Every absence is an answer, and it is written down** (in `GamepadGameHooks`): no title screen to navigate, no demo
to end, no modal to feed, no seat to join or respawn, no badge to clear, no wizard art — and a world that is running
whenever the pause card is not open. **Declare nothing and the controller still works**: it plays, and the parts that
depend on your world do not happen. A field you write as `undefined` is an absence like any other, not a hole.

📌 **`initGamepad` stays published** and its `press`/`release` (note BN) keep working: a game that assembles a transport
of its own still needs the door, and `Engine.controller` is how it gets one.

✅ **And a half-wired thing finished on the way**: the quick bar's second exit. `navBar`'s third argument — the START
edge, which is the other way out of the bar (ADR-0044 item 7) — arrived through a route the cartridge owned and the
root did not mount. The root mounts it now, so it arrives.

⚠️ **Measured and named rather than fixed**: `padCur` / `padPrevAct` are module state in `input/state`, so two engine
roots on one page poll the SAME controller and the first to run consumes the edge. There is one root in a page that
plays; it is the same family as ADR-0142, one floor down.

## BQ · The recogniser stops choosing its language once (ADR-0225, issue #184)

**What this is.** `VoiceControl` gains a required member, `languageChanged(): Promise<void>`, and the root calls it on
`i18n:change`. A listening recogniser is restarted so the model, the vocabulary and the grammar are chosen again; one
that is off has nothing to do, because its next start already reads the new language.

🎯 **Why it is worse than a recogniser that simply stops.** The grammar already followed the language, because it is
rebuilt whenever a menu opens (ADR-0194) — the MODEL and the vocabulary did not. So after a change the new language's
words were fed to the old language's model, and a closed grammar answers with the nearest candidate: measured in the
lab on 2026-09-14, «configurações de inclusão» came back as «quatro». A microphone that acts on a word the child did
not say is the defect this closes.

📏 **What already followed, and still does** — measured before the work so it could not be quietly lost: `platform/tts`
reads the language when it lists voices and again when it speaks, and the voice in use falls back to the new language's
first voice; `platform/reading` reads it at every `listen()`.

⚠️ **What to change.** If you only call `createGame`, nothing. If you implement `VoiceControl` yourself, add
`languageChanged()`. 📌 And if your cartridge draws its own text, the engine cannot repaint it: `i18n:change` is
dispatched for exactly that, and `dictionaryGaps` says in `problems` when a registered dictionary has holes.

📌 **A language whose model never reached the delivery is SAID** (ADR-0169). The heavy files are chosen at boot for the
boot language, so a child who switches may be asking for something that is not there — that becomes a line in
`problems` and the 👄 goes back to off, not a microphone listening in the wrong language.

## BR · The visual panel builds NODES, and `renderVisualPanelHtml` is gone (ADR-0129, issue #135)

**What this is.** `ui/settings-visual` no longer exports `renderVisualPanelHtml`. The panel built its interior by
assembling an HTML string and assigning it to `innerHTML` at every render; it now builds NODES with the panel kit
(`ui/panel-widgets.controlRow`), mounting once and relabelling afterwards.

🎯 **Why it is worth a break.** Two defects came with the rebuild, and neither was cosmetic. 📏 Measured on
2026-09-23: the contrast-enhancement STEPS control was constructed anew at every render, so a click on any other row
of the panel took the cursor off it — the same defect the simulation list's own comment warns about. And the
composition root had to mount the owner-colours row OUTSIDE this list, under a second id (`#opt-dono`), precisely
because an `innerHTML` from here would erase any node it inserted. One markup sink leaves the census with it.

⚠️ **What to change.** If you call `initSettingsVisual`, nothing: the ids, the rows and the words are the same, and
`render()` is still what you call. If you imported `renderVisualPanelHtml` to draw the panel's interior yourself,
there is no replacement export — the interior is mounted by `initSettingsVisual(ctx).render()`, which needs
`#visual-list` in the document and nothing else.

📌 **The four role colours stayed a hand-built row, and not for want of a sixth kit shape.** `controlRow` builds «one
label, one hint, ONE control», and that row has five — four colour swatches and the ↺ that puts them back. Inventing a
shape for it would be giving a second answer to «what is a row», which is what the kit exists to prevent. It is built
as nodes like everything else, with the same discipline: mounted once, relabelled after.

## BS · What a visual choice IS leaves the panel that draws it (ADR-0221 step 7c, issue #203)

**What this is.** Sixteen names move from `ui/settings-visual` to the new `ui/visual-choices`, with no alias left
behind: `VISUAL_MODES`, `VISUAL_MODE_LIST`, `CONTRAST_LABELS`, `ROLE_KEYS`, `ROLE_LABELS`, `LQ_STEPS`,
`resolveVisualMode`, `contrastLabel`, `clamp01`, `lqLabel`, `lqPosition`, `lqPercent`, `lqFromPercent`,
`clampSelectedPlayer`, `rgbToHex`, `onOffLabel`, plus the types `RGB` and `RoleKey`. `sameRgb` is no longer exported
at all — it was declared debt and both of its readers live in the panel, a screen apart, so it was paid rather than
moved. `initSettingsVisual` and `VisualSettings` stay where they were.

🎯 **Why the seam is there.** `tests/settings-visual.node.test.js` imported exactly those names and nothing else, and
the node project mounts no document — whoever wrote those cases already knew where the panel stops being a panel. It
is the fourth module to come out this way, after `ui/audio-choices`, `ui/typo-choices` and `ui/control-choices`.

⚠️ **What to change.** Change the import path. Nothing about the names, their values or their behaviour moved with
them. 📌 No alias was left: a re-export would keep alive a path nothing inside the engine uses, and would make the
public-surface portrait lie, because it does not see re-exports (issue #204).

## BT · The motion panel builds NODES, and the «coming soon» mechanism goes with it (ADR-0129, issue #135)

**What this is.** `ui/settings-motion` no longer exports `motionRowHtml`, `buildCharRowsHtml`, `buildSceneRowsHtml`,
`crtToggleRowHtml`, `crtRoundRowHtml` or `RM_SOON`. The panel assembled its three row families as HTML strings and
assigned them to `innerHTML` at every render; it now builds nodes with the panel kit, mounting once and reconciling
afterwards — creating what is missing, rewriting what stayed, removing what lost its subject.

🎯 **Why it is worth a break.** 📏 Measured in the built `dist` on 2026-09-23: with the cursor on the rounded-corners
steps control, a click on the scanlines switch DESTROYED it and dropped the focus to `<body>`. A child navigating by
keyboard lost her place in the whole panel. The steps handler already avoided re-rendering for exactly that reason,
in a comment beside it; the neighbouring row undid it. Two markup sinks leave the census with the conversion.

⚠️ **What to change.** If you call `initSettingsMotion`, nothing: the ids, the `data-rmc`/`data-rm`/`data-crt-tgl`
attributes, the rows and the words are the same, and `render()` is still what you call. If you imported one of the
five builders to draw rows yourself, there is no replacement export — the interior is mounted by
`initSettingsMotion(ctx).render()`, which needs `#motion-list` in the document.

📌 **`RM_SOON` and the «coming soon» tag are gone because they had no subject**, not because the kit had no slot for
them. 📏 It was an EMPTY set from the day the cartridge left this repository (`b55b88e7`), `render` always passed that
same empty set, and no path let a cartridge supply another — the only things giving it a value were two test cases. A
mechanism whose sole user is a test is not a mechanism. It is the second time this mechanism has gone for losing its
last user: its twin in the icon bar went in `760faad`. The `ui.soon` dictionary key stays in all three languages.

## BU · What a movement choice IS leaves the panel that draws it (ADR-0221 step 7c, issue #203)

**What this is.** Eleven names move from `ui/settings-motion` to the new `ui/motion-choices`, with no alias left
behind: `RM_LABEL`, `CRT_LBL`, `CRT_ROUND_LEVELS`, `clampSelectedPlayer`, `allMotionFrozen`, `motionMasterLabel`,
`sceneMotionAnnouncement`, `crtToggleAnnouncement`, `crtLevelLabel`, `crtRoundAnnouncement` and
`stopResumeAllAnnouncement`. `initSettingsMotion`, `getSelectedPlayer`, `setSelectedPlayer` and the five type
aliases stay where they were.

🎯 **Why the seam is there.** `tests/settings-motion.node.test.js` exercises exactly those names, and the node
project mounts no document — whoever wrote those cases already knew where the panel stops being a panel. It is the
fifth module to come out this way, after `ui/audio-choices`, `ui/typo-choices`, `ui/control-choices` and
`ui/visual-choices`.

⚠️ **What to change.** Change the import path. Nothing about the names, their values or their behaviour moved with
them. 📌 No alias was left: a re-export would keep alive a path nothing inside the engine uses, and would make the
public-surface portrait lie, because it does not see re-exports (issue #204).

## BV · The hearing panel builds NODES — the last one outside the kit (ADR-0129, issue #135)

**What this is.** `ui/audio-choices` no longer exports `catRowHTML` or `catsListHTML`, and no alias is left behind.
The category list of `#audio-list` and `#navsound-list` was an HTML string assigned to `innerHTML` at every render;
it is now built as nodes and RECONCILED — what is missing is created in place, what stayed is rewritten, and what
lost its name is removed. The sinks section and the «no output device» sentence went with it, so `ui/settings-audio`
has no `innerHTML` left at all: three markup sinks leave the census, paid rather than moved.

🎯 **Why it is worth a break.** A category row carries TWO controls — the volume and the on/off of the same
category — and the kit's `controlRow` mounts one, so this is «string → NODES», not «string → kit»; the same
conclusion, for the same reason, that left the visual panel's four paper-colour row hand-built. What the conversion
buys is the reconciliation: the row a child is dragging the volume on is the SAME node after the next render, and a
row that loses its subject is removed instead of surviving with a stale label. 📏 Measured: with the list rebuilt
from a string, every render destroyed and recreated all four sliders.

⚠️ **What to change.** If you call `initSettingsAudio`, nothing: the ids, the `data-acat`/`data-avol` attributes,
the rows and the words are the same, and `renderAudio()` is still what you call. If you imported either builder to
draw rows yourself, there is no replacement export — the interior is mounted by `initSettingsAudio(ctx).renderAudio()`,
which needs `#audio-list` and `#navsound-list` in the document. 📌 No alias was left: a re-export would keep alive a
path nothing inside the engine uses, and would make the public-surface portrait lie (issue #204).

📌 **One decision left the sink census with the list, and it has NOT been revoked.** That entry was the only one in
that ledger carrying a decision of the Dev's — «audio categories are THE ENGINE's» (2026-09-06) — rather than a
classification. It still holds, and is still written down, in the module that now builds the row; what stopped being
necessary is the exception.

## BW · Sixteen names that nothing here reads stop being published (ADR-0170 §3, issue #164)

**What this is.** Sixteen names leave the package's surface. Fourteen stop being exported and stay exactly where
they are, doing exactly what they did — they are implementation details that were published by habit:
`core/i18n.availableLocales`, `input/gamepad.PADWIZ_ANIM`, `input/keyboard.KB_SCHEMES4`,
`input/touch-bindings.TOUCH_FORCE_RE`, `input/touch.buttonName`, `platform/audio-sonar.GUIDE_HZ`, `GUIDE_TAU`,
`ROUTE_BUDGET`, `ui/fonts.FONT_KEY`, `FONT_KEY_LEGACY`, `ui/loop-crash.CRASH_NOTICE_ID`,
`ui/pause-icons.itemReason`, `ui/settings-mobility.playerPrefix`, `ui/settings-motion.mountMotionInside`. Two are
DELETED: `ui/fonts.loadFontKey` and `ui/fonts.saveFontKey`.

🎯 **Why now, and why these sixteen and not the seventy.** The ledger of published names nothing in this
repository reads holds 70 in 29 modules, and the Dev's rule of 2026-09-22 is that such a name is debt — declared
or removed, with no appeal to what a game outside might import. 📏 Measured before touching any of them: 29 of
the 70 belong to the tile-world stack, whose place in this repository is an open decision, and most of the rest
travel by ctx INJECTION into modules the engine's own root never composes. These sixteen are the ones that
depend on neither question: orphans inside modules the engine itself mounts.

📌 **`tsc` sorted them, not taste.** Every one had its `export` removed; the type checker then named the three it
could no longer see any reader for. Two were conveniences over `resolveFontKey`/`persistFontKey` with the `store`
already filled in — the same two lines, for a caller that never existed — and they are gone. 🎯 And removing them
took `ui/fonts`'s last import with it: the module reached `platform/storage` only to close over it for those two,
so the catalogue is now a leaf with NO imports and the decision of where a choice is kept went back whole to
whoever calls.

⚠️ **The third one is NOT here, and that is the finding.** `ui/layout.initLayout` also had no reader, and its own
comment says «called once by the root, before the first `layout()`» — nobody calls it, so `_numJogadores` stays at
its default of ONE for ever and `screenBaseSize(n)` answers 320×180 where two to four players need 640×180 or
640×360. It keeps its `export` and is written down as an open item: deleting it would freeze the lie, and wiring
it is an API question, because nothing in the engine calls `layout()` either.

⚠️ **What to change.** Nothing, if you import from the engine what the engine's own root imports. If you imported
one of the fourteen, it is an implementation detail of the module that holds it and there is no replacement; if
you imported `loadFontKey`/`saveFontKey`, call `resolveFontKey(store)` / `persistFontKey(store, key)`, which are
the same two lines and are still published.


## BX · The audio panel receives the browser in three obligatory ports (ADR-0227, issue #203)

**Who is affected:** anyone calling `initSettingsAudio(ctx)` directly. The engine's own root already answers.

`SettingsAudioCtx` gains **three required members**. The code stops compiling until they are answered, and that
is the point: 📏 this was the last module of step 7d with `globalReach 3` — `document`,
`window.speechSynthesis` and `navigator.mediaDevices` — against a ceiling of ZERO, and a module that reaches a
global cannot be driven without a browser, cannot be mounted twice against two documents (ADR-0142), and cannot
be TOLD by its host that this device has no voices; it finds out by asking a global that may not exist.

```ts
interface SettingsAudioCtx {
  // …everything it already required…

  /** Creates an element KEEPING its type. */
  newElement: <K extends keyof HTMLElementTagNameMap>(tag: K) => HTMLElementTagNameMap[K];

  /** This device's speech synthesis. No voices is an EMPTY LIST, which is an answer. */
  speech: {
    voices: () => readonly SpeechSynthesisVoice[];
    speakSample: (sample: string, chosen: SpeechSynthesisVoice | null) => void;
    whenVoicesChange: (again: () => void) => void;
  };

  /** This device's audio outputs, and what it can do with them. */
  audioOutputs: {
    canList: () => boolean;    // can this browser enumerate outputs?
    canRoute: () => boolean;   // can it route sound to a chosen one? (an AudioContext is needed)
    list: () => Promise<readonly MediaDeviceInfo[]>;    // what is known, without asking permission
    detect: () => Promise<readonly MediaDeviceInfo[]>;  // ask permission so the outputs have NAMES
  };
}
```

**The migration, and a host on a normal page can copy it verbatim** — this is what the engine's own root now
passes, built from the `doc` and `win` its `EngineHost` handed it:

```ts
newElement: (tag) => doc.createElement(tag),
speech: {
  voices: () => { try { return win.speechSynthesis?.getVoices() ?? []; } catch (e) { return []; } },
  speakSample: (sample, chosen) => { /* new SpeechSynthesisUtterance(sample), u.voice = chosen, ss.speak(u) */ },
  whenVoicesChange: (again) => { if (win.speechSynthesis) win.speechSynthesis.onvoiceschanged = again; },
},
audioOutputs: {
  canList: () => !!win.navigator?.mediaDevices?.enumerateDevices,
  canRoute: () => typeof (win.AudioContext ?? win.webkitAudioContext) !== 'undefined',
  list: async () => (await win.navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput'),
  detect: async () => { /* getUserMedia({audio:true}), stop the tracks, then enumerate */ },
},
```

🎯 **A host with nothing to offer answers so, and is not silent.** A device without speech synthesis answers
`voices: () => []`, and the panel already knows what to do with an empty list — it says «this browser cannot»
in the child's language, a sentence the dictionary has carried since ADR-0185. ⚠️ That is the whole reason the
ports are obligatory instead of optional: **an empty answer is the host SPEAKING, an absent port is the host
SILENT**, and a field nobody wrote is indistinguishable from a field answered «no». This repository has paid
for that confusion twice — a cartridge that seeded no seat without saying so, and four named imports resolving
to `undefined` with the suite green.

📏 **Measured after the change:** `ui/settings-audio` goes `globalReach 3 → 0` and gets SMALLER doing it (412 →
395 lines, 73 → 66 branches). The root stays at `globalReach 0`, because what it passes down it received from
its host — the reach changed place, not owner.


## BY · The tile-world stack leaves the engine (ADR-0228, issue #203)

**Who is affected:** anyone importing one of the twenty-six paths below. The package's `exports` are wildcards
(`./render/*.js`, `./core/*.js`, `./ui/*.js`), so every one of them was a published entry point.

📏 **The engine goes from 205 modules to 180, and from 20 597 lines to 18 275.** What leaves describes a game
rather than serving one — judged by what each module PUBLISHES, which is the only test that survived two
failed attempts at counting words:

| leaving | what it publishes, and why that settles it |
|---|---|
| `render/city-tex` | `paintPigeon`, `paintCat`, `paintDog`, `CAR_PALETTES`, `paintCar` |
| `render/recycling-tex` | `paintCan`, `paintPetBottle`, `paintGlassJar`, `paintBin`, `paintSign` |
| `render/scene-city` | `SIGNAGE_COLORS`, `GRAFFITI_COLORS`, `CORAL_COLORS`, `FISH_COLORS` |
| `render/textures` | `PLAYER_IDLE`, `PLAYER_WALK`, `PLAYER_CLIMB`, `PLAYER_HURT`, `PUP_TEX` |
| `render/player-anim` | `COYOTE` — coyote time, and the cling/ladder/swim/fly states |
| `core/tiles`, `core/collision`* | `TYPE_GLYPH`, `TILE_NAME`, `GLYPH_TYPE` |
| `ui/map-hub` | `MAP_HUB_ROWS` |
| `render/fx` | `JUICE`, `getHitstopT`, `getShakeT` |
| and the rest | `draw`, `camera`, `minimap`, `weather`, `parallax`, `scene-parallax`, `scene-sky`, `city-tiles`, `scenery-data`, `set-scenery`, `world-tex`, `title-scene`, `wheelchair-sprites`, `core/world`, `core/run-state`, `core/letter-grid`, `core/password`, `core/layers` |

Also leaving, from `core/constants`: **`ANIM`** (the animation cadences of a character that walks, runs, swims,
clings and climbs), **`EASY`** (gravity, jump, slow-fall and trampoline multipliers) and **`TILE_COLOR`**.

**Where they went:** `game-platformer`, at the fork point **v9.0.0** — the version that repository already runs.
Landing the engine's current source broke its typecheck before anything imported it, because those files ask
the package for names the installed 9.0.0 does not publish; making them compile would have meant migrating the
whole cartridge, which is other work. It picks up anything newer on its own clock.

🔴 **THREE MODULES WERE TRIED AND CAME BACK, and naming them is the point of this note.** They looked like a
game's because their only readers were, but what they PUBLISH is accessibility:

- **`core/collision`** — `caneBlockPx` (how far apart a white cane strikes), `isSolidType` (a hazard is SOLID
  for a blind child and for one in a wheelchair — «a criança em cadeira de rodas não cai no fosso»), and
  `isWcRampRiser`. A gate stopped the move by naming the rule: *«isHazard saiu: `isSolidType` depende dele no
  modo cego»*. ⏸ It is genuinely mixed — four of its seven exports are tile geometry — and splitting it means
  the engine expressing «hazard» without tiles, through `core/contract.roleOf`. That decision is not taken here.
- **`render/viewports`** — the per-player screen, with the colour-blind correction and low-vision drawing
  applied to each. That is pillar 7, and its imports are six accessibility modules.
- **`render/sprite-fx`** — `outlineCanvas` is the dark outline the high-contrast mode draws behind the art.

⚠️ **AND THE MOVE COST CONFORMANCE EVIDENCE, which is worse than code and is recorded rather than swallowed.**
Two WCAG criteria moved out of the «measured» table of `docs/compliance/gates-de-acessibilidade.md` and into
the holes: **2.2.2 Pause, Stop, Hide** (proven by the weather gate) and **2.4.1 Bypass Blocks** (proven by the
layer-order gates). And **2.3.1 Three Flashes** got worse: the module that declared `FLASH_LIMIT` as the
outermost pass left, so the engine no longer even has a marked address for a flash limiter it never built —
and that is photosensitive epilepsy, which is safety and not comfort.

📌 **Nothing was deleted before its new home was green.** The platformer received the stack, rewired 48 imports
and passed 1351 cases BEFORE a single file was removed here — which is ADR-0123's driver 5 applied across two
repositories.

## BZ · What a gamepad is DOING moves to `input/pad-reading` (ADR-0221, issue #203)

**Who is affected:** anyone importing one of the twelve names below from `the-inclusionist-engine/input/gamepad.js`.
The package's `exports` are wildcards (`./input/*.js`), so both paths are published entry points — **only the path
changes, and no name, signature or behaviour does.**

📏 `input/gamepad` carried two jobs under one name: the pure reading — buttons and axes in, positions out, no host,
no state, no clock — and the DI runtime that polls the pads every frame and decides where the reading goes. The
first is arithmetic over a snapshot and is now its own module; the second stays. The file goes from **415 to 333
lines** and from **96 to 77 decision nodes**.

| the import to edit | from | to |
|---|---|---|
| `padActions`, `stdDirs`, `bindActive`, `oneButtonAtOnce` | `input/gamepad.js` | `input/pad-reading.js` |
| `PadLike`, `PadButtonLike`, `GetGamepads`, `PadBinding`, `PadMap`, `PadActions`, `ActionKey`, `Dirs` (types) | `input/gamepad.js` | `input/pad-reading.js` |

**What does NOT move, and stays exactly where it was:** `initGamepad`, `GamepadCtx`, `GamepadApi`,
`GamepadGameHooks`, `PadGameAnswers`, `padGameAnswers`, `seatEveryPlayer`, `GamepadPlayer`, `WizState`,
`WizAnimDef`, `PADWIZ_ORDER`, and the `NavKeys`/`DomQuery` re-exports.

⚠️ **No alias was left behind**, which is the same choice the five earlier pure-half cuts made (`ui/audio-choices`,
`ui/typo-choices`, `ui/control-choices`, `ui/visual-choices`, `ui/motion-choices`): a re-export would keep alive a
path the public-surface portrait cannot see, and this table is what says where each name went.

📌 The move carried one behaviour-preserving change of shape, so that the new module is born under every ceiling: the
hat-step loop of `stdDirs` and the three-way form of `padActions` became named steps. Its measures: 98 lines, 18
decision nodes, depth 2, fan-out 4, no global reach, worst function 10.

## CA · High contrast ASKS which tile is there instead of importing it (ADR-0228, issue #203)

**Who is affected:** whoever calls `initHighContrast`. 📏 Measured: that is the `game-platformer` and nobody else —
the engine publishes this module and never mounts it itself.

**The one line to add:** `HighContrastCtx` gains an obligatory `tileAt: (tx: number, ty: number) => number`, next to
the `W`, `H` and canvases it already receives. The platformer passes its own `core/collision.tileAt`.

🎯 **Why it is a port and not an import.** `render/high-contrast` is the engine's without doubt — it publishes
`HC_ROLE`, `dimDesat` and the high-contrast textures, and its subject is WCAG 1.4.6. But to repaint role by role it
has to know what sits in each cell, and **that is the grid of one game**. Importing `core/collision` made the
engine's contrast renderer depend on tile geometry; asking makes whoever has a grid answer, and whoever has none
never mounts the module.

⚠️ **Obligatory and not optional**, by the precedent of ADR-0224: an optional port is one more field a game can
forget, and forgetting this one paints the whole world a single colour.

📏 **And this was the last engine module importing `core/collision`** — `git grep` now finds it only in comments.
That is what lets the tile-world stack's final piece leave, which is the next note.

## CB · The grid leaves: `core/collision` and the tile-type table (ADR-0228, issue #63, issue #203)

**Who is affected:** anyone importing `the-inclusionist-engine/core/collision.js`, or `TILE_TYPES`, `TileType`,
`isHazard` or `isTrampoline` from `core/constants.js`. 📏 Measured: the `game-platformer`, and it already has all
of them — `game-platformer:e81b0d9` and `de9290a` landed them there before this deletion, and its 1351 tests are
green on its own copies.

🔴 **These three went and came back once, and that is the finding worth keeping.** When the tile world left in
note BY, `core/collision` was pulled back into the engine because a gate said its subject was ACCESSIBILITY: the
cane's tap spacing (`caneBlockPx`), a hazard being SOLID for a child who cannot see and for one in a wheelchair
(`isSolidType`), and the riser a wheelchair ramp covers (`isWcRampRiser`). That reading was right about the
subject and wrong about the address — **all three rules are written in the vocabulary of a tile grid**:
`isWcRampRiser` is `surfTop` three times, `caneBlockPx` is `TILE` over a number, and `isSolidType` reads the
tile-type table. Keeping them here was keeping the grid here.

📏 And once `core/collision` left, `TILE_TYPES`, `isHazard` and `isTrampoline` had **no reader in the engine at
all** — the `isSolidType` that justified them was the only one. The engine had written this ending beside the
table since 2026-09-07: «o fim honesto é a tabela mudar de casa e o jogo declarar os papéis pelo `core/contract`».

🎯 **The engine does not stop knowing what is dangerous.** It asks the CONTRACT, through `roleOf`, which is the
mechanism that already existed. What it stops having is a table of tile NUMBERS, which is only true of one map:
`t === 9` in a second game with another numbering would inherit physics, high contrast and sonar all pointing at
the wrong tile, with no type error and no red test.

| leaving | where it went |
|---|---|
| `core/collision.js` — `initCollision`, `caneBlockPx`, `isSolidType`, `tileAt`, `solidTile`, `solidAt`, `surfTop`, `isWcRampRiser`, `rampSurfaceY`, `CollisionCtx` | `game-platformer/app/js/core/collision.ts` |
| `core/constants.js` — `TILE_TYPES`, `TileType`, `isHazard`, `isTrampoline` | `game-platformer/app/js/core/tiles.ts`, as `ehPerigo`/`ehTrampolim` |

📌 **`core/constants` now publishes three names** — `LOGICAL_W`, `LOGICAL_H`, `TILE` — the logical resolution and
the pixel grid, which is what any 2D pixel game shares. ⚠️ And four ledgers changed SIDE rather than shrinking:
`logic`, `superficie-publica`, `cartridge-constants` and `action-vocabulary-boundary` each carried a written
argument for why these names stayed, and each now carries the measurement that ended it.

## CC · The cane and the blind swim leave: `platform/audio-nav` (ADR-0228, issue #203)

**Who is affected:** anyone importing `the-inclusionist-engine/platform/audio-nav.js` — `createAudioNav`,
`AudioNavCtx`, `AudioNav`, and the `PlayerCtxOut` it re-exported. 📏 Measured: nothing in the engine imports
it, and the `game-platformer` is its only consumer anywhere. It already has its own copy —
`game-platformer:3389241` landed it before this deletion, with 1356 tests green.

🎯 **Why it goes:** it is the half of the navigation sound that reads a tile world — the cane taps tiles and
the blind swim asks which tile is water. That is the criterion of ADR-0228 («the modules that describe a game
leave `app/js`»), and the Dev authorised the move on 2026-09-23. The half that serves any game stays:
`platform/audio-sonar`, which points at a target by the contract and never asks what a tile is.

📌 **The guide sound is the platformer's to decide** (the Dev, same day). The one question it left open here —
whether a player with their own output device should hear the guide before the engine's audio starts — now
belongs to that repository.

| leaving | where it went |
|---|---|
| `platform/audio-nav.js` — `createAudioNav`, `AudioNavCtx`, `AudioNav`, re-export of `PlayerCtxOut` | `game-platformer/app/js/platform/audio-nav.ts`; `PlayerCtxOut` stays exported by `platform/audio-sonar.js` |

## CD · The mapping wizard's demonstration is the game's: `spriteBase` becomes `wizardStep`/`wizardTick` (ADR-0228, ADR-0224, issue #203)

**Who is affected:** anyone passing `spriteBase` to `initGamepad` (`GamepadCtx`) or in `CreateGameOptions.gamepad`
(`GamepadGameHooks`), anyone importing `WizAnimDef` from `input/gamepad.js`, and any page that relied on the
engine's `style.css` to animate `#padwiz-demo`. 📏 Measured: the `game-platformer` is the one game with a
`#padwiz-demo` in its page, and it already has the demonstration — `game-platformer:0b6a7f3`.

🎯 **Why:** while the wizard asks for each position, a picture showed the platformer's boy doing it — climbing,
walking, jumping, the swap icons — from a table of that game's sprite paths inside the engine (`PADWIZ_ANIM`),
drawn frame by frame from the `spriteBase` the game passed, with `pw-*` animations in the engine's stylesheet.
The Dev ordered on 2026-09-23: «PADWIZ_ANIM e wizDemo vão para o platformer». The engine keeps what is the
wizard's — which positions it asks and in what order — and tells the game which step it is on.

| leaving | instead |
|---|---|
| `GamepadCtx.spriteBase`, `GamepadGameHooks.spriteBase` | `wizardStep(position \| null)` and `wizardTick()` — the game draws; `null` is the wizard opening. Absent in `CreateGameOptions.gamepad`: the wizard speaks with no drawing (ADR-0224's table). |
| `WizAnimDef`, and the private `PADWIZ_ANIM` | `game-platformer/app/js/ui/pad-wizard-demo.ts` (`createPadWizardDemo({ $, spriteBase })` returns `step` and `tick`) |
| `#padwiz-demo`, `#padwiz-demo-img`, `#padwiz-demo-fx`, `.pw-*` and the `pw*` keyframes in `style.css` | `game-platformer/app/js/ui/pad-wizard-demo.css` |

📌 Migrating the platformer is two fields: `wizardStep: demo.step, wizardTick: demo.tick`, with `demo` made once
from the module above.

## CE · `padKind` leaves `input/touch`: a published name nothing reads (ADR-0221, issue #203)

**Who is affected:** anyone importing `padKind` or `PadKind` from `input/touch.js`. 📏 Measured: nothing in the engine
calls it (only its own test did), and in the seven games the one mention is a comment in the platformer saying its own
copy was deleted. Its comment here read «UNUSED hoje … NÃO apagado (relatado, não conserto)» since the extraction.

🎯 **Why now:** it was the one line of `input/touch` that reached a browser global — `navigator.getGamepads()` — in a
module whose job is the on-screen pad, while reading a gamepad is `input/gamepad`'s. The R3 rule decides a name
with no reader: it gains one or it goes, and there is no one to read it. `input/touch`: global reach 1 → 0.

| leaving | instead |
|---|---|
| `padKind()`, `PadKind` | nothing — which kind of pad is connected is read by `input/gamepad` (`input/pad-reading`) where a pad is read |

## CF · The mobility panel's pure half moves to `ui/mobility-choices` (ADR-0221, issue #203)

**Who is affected:** anyone importing `clampSelPlayer`, `anyMobilityActive`, `onOffLabel`, `playerTabsHTML` or
`easyAnnouncement` from `ui/settings-mobility.js`. 📏 Measured: none of the seven games imports any of them; in the
engine, only the panel itself and its node test did.

🎯 **Why:** the sixth module cut this way, after `audio-`, `typo-`, `control-`, `visual-` and `motion-choices`, and marked
the same way — the node test drove exactly these names with no document. The three stored KEYS (`easyKey`,
`toggleRunKey`, `toggleMoveKey`) stay in `ui/settings-mobility`, beside the writers that use them: the ledger of files
touching the per-player toggle key only shrinks, and moving the definition would have grown it by a change of address.

| leaving `ui/settings-mobility.js` | now in |
|---|---|
| `clampSelPlayer`, `anyMobilityActive`, `onOffLabel`, `playerTabsHTML`, `easyAnnouncement` | `ui/mobility-choices.js`, same names, no alias left behind |
| — | `ui/mobility-choices.js` also publishes `playerPrefix`, which the panel's two toggle writers use |

## CG · What a key means in a menu moves to `ui/menu-intent` (ADR-0221, issue #203)

**Who is affected:** anyone importing `KEY_YES`, `KEY_NO`, `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`,
`menuKeyIntent`, `selectStep`, `selectWrap`, `rangeStep` or `stepInPause` from `ui/menu-nav.js`. 📏 Measured: none of the
seven games imports any of them (the pinball names `menuKeyIntent` in a test comment, not an import). In the engine only
`ui/menu-nav` and its node test did.

🎯 **Why:** the same seam as the `*-choices` modules, drawn the same way by the suite: the node test drove exactly these
names with no document. `ui/menu-intent` says what a key MEANS inside a menu and how far a step goes; `ui/menu-nav` keeps
the navigation that needs a page. `hasIntent` and `stepInRing` stay published by `ui/menu-nav` as they were (they are
re-exports of `input/edges` and `core/ring`, not its pure half).

| leaving `ui/menu-nav.js` | now in |
|---|---|
| `KEY_YES`, `KEY_NO`, `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`, `KEY_RIGHT`, `menuKeyIntent`, `selectStep`, `selectWrap`, `rangeStep`, `stepInPause` | `ui/menu-intent.js`, same names, no alias left behind |

## CH · Eight names nothing reads stop being published (ADR-0221, issue #203)

**Who is affected:** anyone importing one of the eight names below. 📏 Measured: nothing in `app/js`, in `tests/` or
in the seven games imports any of them; each one's only reader is the module that declares it, a screen away.

🎯 **Why:** the R3 rule (the precedent is note BW): a published name with no reader gains one or stops being published.
All eight are used inside their own module, so they stay — only the `export` keyword goes.
⚠️ `ui/menu-items.ITEM_SELECTOR` has no importer either and **stays published on purpose**: the public-surface gate
uses it as its live sample of a comma inside a string (`'button:not([disabled]), select…'` must not publish a name
`select`), and no other published constant has that shape. Un-exporting it would leave that case measuring nothing.

| no longer published | module |
|---|---|
| `bootQuiz`, `declareQuiz`, `spokenOption` | `consumer-quiz/main-quiz.js` |
| `HOLDS_TOUCH` | `input/transports.js` |
| `directTheme` | `render/viz-axes.js` |
| `ENGINE_ITEMS`, `iconCaption`, `itemsThatAct` | `ui/pause-icons.js` |

## CI · Published members speak English — the `core` layer (ADR-0230, issue #206)

**Who is affected:** a cartridge or host that WRITES or READS one of the members below — above all a game's declaration
(`holdsKeys` for `seguraTeclas`, `keyboardMapping`/`padMapping` for the two mappings) and a loop started with
`onFailure` for `aoFalhar`. The problem lines of the contract name the new fields.

⚠️ **The quiet case, and the one line to act on:** a TypeScript consumer that writes the declaration as a fresh object
literal gets a compile error on the old key. One that builds it in plain JavaScript, or through `any`, gets NOTHING: the
engine reads the new key, finds `undefined`, and the contract refuses the declaration at boot (`holdsKeys: missing`) —
or, for an optional member, silently uses its default. Search the game for the old names in this table.

📌 **What did NOT move, by decision:** `VisualState.tema`, `.correcao` and `.simulacao` are the shape of a value stored per
player; renaming them would erase the child's visual setting (ADR-0230 §3, the rule of ADR-0219 §6).

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table core`.

| module | type | old member | new member |
|---|---|---|---|
| `core/contract.js` | `GameDeclaration` | `mapeamentoDoPad` | `padMapping` |
| `core/contract.js` | `GameDeclaration` | `mapeamentoDoTeclado` | `keyboardMapping` |
| `core/contract.js` | `GameDeclaration` | `seguraTeclas` | `holdsKeys` |
| `core/entity.js` | `Player` | `alfWins` | `literacyWins` |
| `core/flash-threshold.js` | `FlashVerdict` | `passa` | `passes` |
| `core/flash-threshold.js` | `FlashVerdict` | `piorSegundo` | `worstSecond` |
| `core/flash-threshold.js` | `LuminanceFrame` | `luminancias` | `luminances` |
| `core/genres.js` | `Genre` | `familia` | `family` |
| `core/genres.js` | `Genre` | `marca` | `mark` |
| `core/genres.js` | `Genre` | `nome` | `name` |
| `core/loop.js` | `LoopOptions` | `aoFalhar` | `onFailure` |
| `core/route.js` | `Route` | `ate` | `reached` |
| `core/route.js` | `Route` | `passos` | `steps` |
| `core/route.js` | `Route` | `proximo` | `next` |
| `core/route.js` | `RouteCtx` | `orcamento` | `budget` |
| `core/scenes.js` | `Scene` | `nome` | `name` |
| `core/scenes.js` | `SceneFacts` | `menuDePausa` | `pauseMenu` |
| `core/scenes.js` | `SceneFacts` | `mundoRodando` | `worldRunning` |
| `core/scenes.js` | `SceneFacts` | `telaDeTitulo` | `titleScreen` |
| `core/scenes.js` | `SceneStack` | `nomes` | `names` |
| `core/scenes.js` | `createSceneStack` | `nomes` | `names` |
| `core/speech-rate.js` | `speechPlaybackRate` | `ppmDaVoz` | `voiceWpm` |
| `core/speech-rate.js` | `speechPlaybackRate` | `taxa` | `rate` |

## CJ · Published members speak English — the `platform` layer (ADR-0230, issue #206)

**Who is affected:** a host or cartridge that builds or reads the voice engine (`Tts.voices`, `currentVoice`, `setVoice`,
`neuralAvailable`, `kokoroDevice`), a Kokoro port (`phonemize`, `vocabulary`, `voice`, `session`, `synthesize`), the
heavy-file download (`HeavyOptions.fetch`/`only`/`onProgress`, `HeavyReport.outcome`/`error`), the flash measurement
(`measured`, `reason`, `passes`, `worstSecond`), the command reader and the sonar's ctx (`getBlindMode`,
`visionImpaired`).

⚠️ **A typed consumer is NOT safe by construction here, and this layer measured why.** `ui/voice-settings` held its own
view of the voice engine with every member OPTIONAL (`vozes?`, `vozAtual?`, …). The real engine, renamed, stayed
assignable to that view — an optional member that is absent is not an error — and the panel saw no voices at all, with
`tsc` clean. Only a browser test caught it. A consumer that declares its own optional mirror of these types must rename
it by this table; the compiler will not ask.

📌 **The delivery `bin` speaks the same shape:** its report rows are `{ id, outcome, error }` and its option is `fetch`.
The values it prints (`ja-tinha`, `falhou`, `sem-fonte`, `escrito`) did not change.

📌 **Not moved:** `TasksVision.FilesetResolver` is the name MediaPipe exports; the engine only mirrors it.

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table platform`.

| module | type | old member | new member |
|---|---|---|---|
| `platform/audio-sonar.js` | `LiveGuide` | `desdeARota` | `framesSinceRoute` |
| `platform/audio-sonar.js` | `LiveGuide` | `filtro` | `filter` |
| `platform/audio-sonar.js` | `LiveGuide` | `ganho` | `gain` |
| `platform/audio-sonar.js` | `LiveGuide` | `passos` | `steps` |
| `platform/audio-sonar.js` | `PlayerAudioOut` | `_guia` | `_guide` |
| `platform/audio-sonar.js` | `SonarCtx` | `getModoCego` | `getBlindMode` |
| `platform/audio-sonar.js` | `SonarCtx` | `visaoComprometida` | `visionImpaired` |
| `platform/flash-sampler.js` | `FlashMeasurement` | `lido` | `measured` |
| `platform/flash-sampler.js` | `FlashMeasurement` | `motivo` | `reason` |
| `platform/flash-sampler.js` | `FlashMeasurement` | `passa` | `passes` |
| `platform/flash-sampler.js` | `FlashMeasurement` | `piorSegundo` | `worstSecond` |
| `platform/guide-intensity.js` | `Intensity` | `corte` | `cutoff` |
| `platform/heavy-catalogue.js` | `HeavyFile` | `porQueNaoTemFonte` | `whyNoSource` |
| `platform/heavy.js` | `HeavyOptions` | `aoProgredir` | `onProgress` |
| `platform/heavy.js` | `HeavyOptions` | `apenas` | `only` |
| `platform/heavy.js` | `HeavyOptions` | `buscar` | `fetch` |
| `platform/heavy.js` | `HeavyReport` | `erro` | `error` |
| `platform/heavy.js` | `HeavyReport` | `estado` | `outcome` |
| `platform/interruptible-speech.js` | `InterruptibleSpeech` | `calar` | `silence` |
| `platform/interruptible-speech.js` | `InterruptibleSpeech` | `falando` | `speaking` |
| `platform/interruptible-speech.js` | `InterruptibleSpeech` | `falar` | `speak` |
| `platform/interruptible-speech.js` | `SpeechEngine` | `parar` | `stop` |
| `platform/interruptible-speech.js` | `SpeechEngine` | `sintetizar` | `synthesize` |
| `platform/interruptible-speech.js` | `SpeechEngine` | `tocar` | `play` |
| `platform/kokoro-port.js` | `createKokoroPort` | `fonemizar` | `phonemize` |
| `platform/kokoro-port.js` | `createKokoroPort` | `sessao` | `session` |
| `platform/kokoro-port.js` | `createKokoroPort` | `vocabulario` | `vocabulary` |
| `platform/kokoro-port.js` | `createKokoroPort` | `voz` | `voice` |
| `platform/kokoro-port.js` | `session` | `sintetizar` | `synthesize` |
| `platform/kokoro.js` | `KokoroModule` | `fonemizar` | `phonemize` |
| `platform/kokoro.js` | `KokoroModule` | `sessao` | `session` |
| `platform/kokoro.js` | `KokoroModule` | `vocabulario` | `vocabulary` |
| `platform/kokoro.js` | `KokoroModule` | `voz` | `voice` |
| `platform/kokoro.js` | `KokoroSession` | `sintetizar` | `synthesize` |
| `platform/kokoro.js` | `KokoroVoice` | `boa` | `recommended` |
| `platform/speech-recognition.js` | `CommandReader` | `itens` | `items` |
| `platform/speech-recognition.js` | `CommandReader` | `ler` | `read` |
| `platform/speech-recognition.js` | `createCommandReader` | `itens` | `items` |
| `platform/speech-recognition.js` | `createCommandReader` | `ler` | `read` |
| `platform/speech-recognition.js` | `HeardCommand` | `nome` | `name` |
| `platform/speech-recognition.js` | `HeardCommand` | `palavra` | `word` |
| `platform/speech-recognition.js` | `HeardCommand` | `tipo` | `kind` |
| `platform/speech-recognition.js` | `RecognitionRoute` | `estado` | `status` |
| `platform/speech-recognition.js` | `RecognitionRoute` | `rota` | `route` |
| `platform/tts.js` | `Tts` | `kokoroDispositivo` | `kokoroDevice` |
| `platform/tts.js` | `createTts` | `kokoroDispositivo` | `kokoroDevice` |
| `platform/tts.js` | `Tts` | `neuralDisponivel` | `neuralAvailable` |
| `platform/tts.js` | `createTts` | `neuralDisponivel` | `neuralAvailable` |
| `platform/tts.js` | `Tts` | `setVoz` | `setVoice` |
| `platform/tts.js` | `Tts` | `vozAtual` | `currentVoice` |
| `platform/tts.js` | `Tts` | `vozes` | `voices` |
| `platform/tts.js` | `TtsCtx` | `criarAudio` | `createAudio` |
| `platform/tts.js` | `speakByWav` | `falar` | `speak` |
| `platform/tts.js` | `speakByWav` | `taxa` | `rate` |
| `ui/voice-settings.js` | `PanelVoice` | `boa` | `recommended` |
| `ui/voice-settings.js` | `TtsPanel` | `neuralDisponivel` | `neuralAvailable` |
| `ui/voice-settings.js` | `TtsPanel` | `setVoz` | `setVoice` |
| `ui/voice-settings.js` | `TtsPanel` | `vozAtual` | `currentVoice` |
| `ui/voice-settings.js` | `TtsPanel` | `vozes` | `voices` |

## CK · Published members speak English — the `input` layer (ADR-0230, issue #206)

**Who is affected:** a cartridge or host that builds one of these ctx objects or reads one of these results — above all
a game that mounts the gamepad or the pad-mapping assistant itself (`GamepadCtx.worldRunning`, `pauseMenu`, `pause`,
`resume`, `onBar`, `actionLabel`; `PadWizardCtx.say`, `progress`, `onStep`, `onTick`, `onClose`), the touch pad
(`TouchCtx.gameActions` with `{ action, label }` items; `TouchMarkupSpec.map`, `dpad`, `slotLabel`), a pointer sample
(`source`, `pressed`), and the reach answer (`Reach.asked`, `holdsAsked`, `wouldServeIfOn`, …).

⚠️ **The quiet case is the ctx a game builds by hand.** A TypeScript consumer gets an error on a fresh object literal;
one that builds the ctx in plain JavaScript gets `ctx.onBar is not a function` on the first frame — or, for an optional
member, nothing at all. Search the game for the old names in this table.

📌 **Not moved, by what they are:** the transport NAMES are values (`'teclado'`, `'toque'`, `'olhos'`) — the stamp a key
carries — so `SLOTS.teclado` stays; so do the pad personas' stored values (`'crianca-pequena'`) and the `data-acao`
attribute. Only the member names around them changed.

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table input`.

| module | type | old member | new member |
|---|---|---|---|
| `input/empathy-filter.js` | `EmpathySimulation` | `umPorVez` | `noChords` |
| `input/gamepad.js` | `GamepadCtx` | `menuDePausa` | `pauseMenu` |
| `input/gamepad.js` | `GamepadCtx` | `mundoRodando` | `worldRunning` |
| `input/gamepad.js` | `GamepadCtx` | `naBarraDe` | `onBar` |
| `input/gamepad.js` | `GamepadCtx` | `pausar` | `pause` |
| `input/gamepad.js` | `GamepadCtx` | `retomar` | `resume` |
| `input/gamepad.js` | `GamepadCtx` | `rotuloDaAcao` | `actionLabel` |
| `input/keydown.js` | `KeydownCtx` | `isEmJogo` | `isInGame` |
| `input/keydown.js` | `KeydownCtx` | `isTelaDeTitulo` | `isTitleScreen` |
| `input/keydown.js` | `KeydownSnapshot` | `emJogo` | `inGame` |
| `input/keydown.js` | `KeydownSnapshot` | `telaDeTitulo` | `titleScreen` |
| `input/latch-edge.js` | `LatchedEdgeOptions` | `armazem` | `store` |
| `input/latch-scope.js` | `LatchReading` | `doLegado` | `fromLegacy` |
| `input/latch-scope.js` | `LatchReading` | `doTransporte` | `fromTransport` |
| `input/pad-wizard.js` | `PadWizard` | `abrir` | `open` |
| `input/pad-wizard.js` | `PadWizard` | `abrirPara` | `openFor` |
| `input/pad-wizard.js` | `PadWizard` | `estado` | `state` |
| `input/pad-wizard.js` | `PadWizard` | `fechar` | `close` |
| `input/pad-wizard.js` | `PadWizard` | `tique` | `tick` |
| `input/pad-wizard.js` | `PadWizardCtx` | `aoFechar` | `onClose` |
| `input/pad-wizard.js` | `PadWizardCtx` | `aoPasso` | `onStep` |
| `input/pad-wizard.js` | `PadWizardCtx` | `aoTique` | `onTick` |
| `input/pad-wizard.js` | `PadWizardCtx` | `dizer` | `say` |
| `input/pad-wizard.js` | `PadWizardCtx` | `progresso` | `progress` |
| `input/pad-wizard.js` | `PadWizardCtx` | `rotuloDaAcao` | `actionLabel` |
| `input/pointer.js` | `PointerSample` | `apertado` | `pressed` |
| `input/pointer.js` | `PointerSample` | `origem` | `source` |
| `input/touch-bindings.js` | `TouchBindingsCtx` | `abrirMenus` | `openMenus` |
| `input/touch.js` | `PersonaDoPad` | `chave` | `key` |
| `input/touch.js` | `PersonaDoPad` | `rotulo` | `label` |
| `input/touch.js` | `TouchCtx` | `acoesDoJogo` | `gameActions` |
| `input/touch.js` | `TouchCtx.acoesDoJogo` | `acao` | `action` |
| `input/touch.js` | `TouchCtx.acoesDoJogo` | `rotulo` | `label` |
| `input/touch.js` | `TouchMarkupCtx` | `criar` | `create` |
| `input/touch.js` | `TouchMarkupCtx` | `procurar` | `find` |
| `input/touch.js` | `TouchMarkupSpec` | `acoesDoJogo` | `gameActions` |
| `input/touch.js` | `TouchMarkupSpec` | `direcional` | `dpad` |
| `input/touch.js` | `TouchMarkupSpec` | `mapa` | `map` |
| `input/touch.js` | `TouchMarkupSpec` | `rotuloDoSlot` | `slotLabel` |
| `input/transport-in-use.js` | `InputState` | `assistidaLigada` | `assistedOn` |
| `input/transport-in-use.js` | `InputState` | `emUso` | `inUse` |
| `input/transports.js` | `Availability` | `rato` | `mouse` |
| `input/transports.js` | `Availability` | `teclado` | `keyboard` |
| `input/transports.js` | `Availability` | `toque` | `touch` |
| `input/transports.js` | `Reach` | `curtos` | `short` |
| `input/transports.js` | `Reach` | `naoApontam` | `cannotPoint` |
| `input/transports.js` | `Reach` | `naoSeguram` | `cannotHold` |
| `input/transports.js` | `Reach` | `pedePonteiro` | `needsPointer` |
| `input/transports.js` | `Reach` | `pedidas` | `asked` |
| `input/transports.js` | `Reach` | `seguraPedidas` | `holdsAsked` |
| `input/transports.js` | `Reach` | `serviriamSeLigados` | `wouldServeIfOn` |
| `input/transports.js` | `Transport` | `aponta` | `points` |

## CL · Published members speak English — the `render` layer (ADR-0230, issue #206)

**Who is affected:** a host that fills the render ctx objects (`ScreenPipelineCtx.createDrawing`/`createSprite`,
`ViewportsCtx.renderInto`, `VizSettersCtx.applyCssFilter`/`applyHighContrastToDom`/`setBlindMode`), or calls the visual
writers (`setPlayerTheme`, `setPlayerCorrection`, `setPlayerVisual`, `renderVisualAxes`), or reads `howItApplies`
(`{ direct, filter }`), a `buttonChoice` (`{ axis, value }`), a `VizMode.name` or a refusal (`{ key, axis }`).

⚠️ **The quiet case is the ctx a host builds by hand**, as in the layers before: a JavaScript host that keeps
`setModoCego` gets no error, and the blind mode is never switched on by the simulation that asks for it.

📌 **Not moved:** the markup attributes `data-eixo`/`data-valor` — `buttonChoice` still reads them from a `dataset`, and
the panel queries them; they are markup, not member names. What `buttonChoice` RETURNS is `{ axis, value }`.

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table render`.

| module | type | old member | new member |
|---|---|---|---|
| `render/crt.js` | `initCrt` | `a11yVisualAtiva` | `a11yVisualOn` |
| `render/crt.js` | `initCrt` | `numJogadores` | `numPlayers` |
| `render/screen-pipeline.js` | `ScreenPipelineCtx` | `criarDesenho` | `createDrawing` |
| `render/screen-pipeline.js` | `ScreenPipelineCtx` | `criarSprite` | `createSprite` |
| `render/viewports.js` | `ViewportsCtx` | `renderizarEm` | `renderInto` |
| `render/viz-axes-labels.js` | `AxisChoice` | `eixo` | `axis` |
| `render/viz-axes-labels.js` | `AxisChoice` | `valor` | `value` |
| `render/viz-axes.js` | `HowItApplies` | `direto` | `direct` |
| `render/viz-axes.js` | `HowItApplies` | `filtro` | `filter` |
| `render/viz-modes.js` | `VizMode` | `nome` | `name` |
| `render/viz-refusal.js` | `Refusal` | `chave` | `key` |
| `render/viz-refusal.js` | `Refusal` | `eixo` | `axis` |
| `render/viz-setters.js` | `VizSettersApi` | `renderEixosVisuais` | `renderVisualAxes` |
| `render/viz-setters.js` | `VizSettersApi` | `setCorrecaoDoJogador` | `setPlayerCorrection` |
| `render/viz-setters.js` | `VizSettersApi` | `setTemaDoJogador` | `setPlayerTheme` |
| `render/viz-setters.js` | `VizSettersApi` | `setVisualDoJogador` | `setPlayerVisual` |
| `render/viz-setters.js` | `VizSettersCtx` | `aplicarAltoContrasteNoDom` | `applyHighContrastToDom` |
| `render/viz-setters.js` | `VizSettersCtx` | `aplicarFiltroCss` | `applyCssFilter` |
| `render/viz-setters.js` | `VizSettersCtx` | `setModoCego` | `setBlindMode` |

## CM · Published members speak English — the `ui` layer (ADR-0230, issue #206)

**Who is affected:** the largest layer, and the one a cartridge meets most. A game that mounts a panel through the kit
(`ControlRowSpec { label, hint, shape, ariaLabel }`, `StepsSpec { label, values, current }`, `PanelShellSpec`/`MountPanelSpec`
with `title`, `listLabel`, `resetLabel`, `closeLabel`, `intro`, `listId`, `labels`, `closeOwn`, and ctx `find`/`create`), fills a
pause-icons or settings ctx (`getBlindMode`, `setBlindMode`, `setPlayerTheme`, `setPlayerCorrection`, `holdsKeys`,
`transportInUse`, `openMenus`, `explainItem`, `gameButtons`, …), reads the bar API (`onBar`, `enterBar`, `leaveBar`,
`mountedIcons`) or the layout measures (`Scale.width`/`height`, `NamedBox { name, box, isBar }`).

⚠️ **The quiet case, once more, and it is at its worst here:** a JavaScript ctx that keeps `setModoCego` or `naBarraDe`
compiles to nothing and fails on the first call, or — for an optional member — never answers. Search by this table.

📌 **Not moved, each for a reason written in the map:**
· `HudBar.segmentos`/`.cor` — the learning band takes a bar in the SAME shape as `educational/segment-bar`'s `Bar`
  (ADR-0168), and `educational` stays in pt-BR (ADR-0032); renaming one side would break the handoff.
· what reads the STORED `VisualState` (`player.visual.tema`/`.correcao`, ADR-0230 §3).
· `window.__sonda`, the console handle of the debug panel.
· DOM dataset keys (`data-fonte`, `data-cursiva`, `data-estado`, `data-acao`) and the ids that are data — the pause
  action ids (`tipo`, `nivel`, `letra`), the bar's icon ids (`idioma`, `tipografia`, `velocidade`), role and sound names.

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table ui`.

| module | type | old member | new member |
|---|---|---|---|
| `ui/caa-sets.js` | `CaaSet` | `nome` | `name` |
| `ui/caa-sets.js` | `CaaSet` | `licenca` | `license` |
| `ui/caa-sets.js` | `CaaSet` | `disponivel` | `available` |
| `ui/caa-sets.js` | `CaaSet` | `nota` | `note` |
| `ui/debug-panel.js` | `CharacterSample` | `texturaId` | `textureId` |
| `ui/debug-panel.js` | `CharacterSample` | `recorte` | `crop` |
| `ui/debug-panel.js` | `CharacterSample` | `posicao` | `position` |
| `ui/debug-panel.js` | `CharacterSample` | `escala` | `scale` |
| `ui/debug-panel.js` | `CharacterSample` | `irmaosDesenhando` | `siblingsDrawing` |
| `ui/debug-panel.js` | `CharacterSample` | `posIrmaos` | `siblingPositions` |
| `ui/debug-panel.js` | `ProbeSummary` | `quadros` | `frames` |
| `ui/debug-panel.js` | `ProbeSummary` | `texturas` | `textures` |
| `ui/debug-panel.js` | `ProbeSummary` | `maxIrmaos` | `maxSiblings` |
| `ui/debug-panel.js` | `ProbeSummary` | `exemploIrmaos` | `siblingExample` |
| `ui/debug-panel.js` | `ProbeSummary` | `escalas` | `scales` |
| `ui/debug-panel.js` | `ProbeSummary` | `veredito` | `verdict` |
| `ui/debug-panel.js` | `DebugPanelCtx` | `amostrarPersonagem` | `sampleCharacter` |
| `ui/debug-panel.js` | `DebugPanelCtx` | `aoQuadro` | `onFrame` |
| `ui/debug-panel.js` | `Range` | `cad` | `cadence` |
| `ui/focus-trap.js` | `FocusTrapCtx` | `overlayDeCima` | `topOverlay` |
| `ui/focus-trap.js` | `FocusTrapCtx` | `focoAtual` | `currentFocus` |
| `ui/focus-trap.js` | `FocusTrapCtx` | `focaveisDe` | `focusablesIn` |
| `ui/focus-trap.js` | `FocusTrapApi` | `aoTeclar` | `onKeydown` |
| `ui/fonts.js` | `TypographyStep` | `caixa` | `letterCase` |
| `ui/fonts.js` | `TypographyStep` | `fonte` | `font` |
| `ui/fonts.js` | `TypographyStep` | `escala` | `scale` |
| `ui/fonts.js` | `FontItem` | `papel` | `role` |
| `ui/game-options.js` | `GameOptionsDrawCtx` | `dizer` | `say` |
| `ui/help-panel.js` | `SlideCtx` | `criar` | `create` |
| `ui/help-panel.js` | `showSlide` | `titulo` | `title` |
| `ui/help-panel.js` | `showSlide` | `indice` | `index` |
| `ui/help-panel.js` | `showSlide` | `falado` | `spoken` |
| `ui/item-announcement.js` | `ItemDeMenu` | `rotulo` | `label` |
| `ui/item-announcement.js` | `ItemDeMenu` | `estado` | `state` |
| `ui/item-announcement.js` | `ItemDeMenu` | `posicao` | `position` |
| `ui/latch-refusal.js` | `LatchRefusal` | `chave` | `key` |
| `ui/latch-refusal.js` | `LatchRefusal` | `transporte` | `transport` |
| `ui/layout.js` | `NodeMeasure` | `nome` | `name` |
| `ui/layout.js` | `NodeMeasure` | `fontePx` | `fontPx` |
| `ui/layout.js` | `NodeMeasure` | `alvo` | `target` |
| `ui/layout.js` | `belowFloor` | `texto` | `text` |
| `ui/layout.js` | `belowFloor` | `alvos` | `targets` |
| `ui/layout.js` | `NamedBox` | `nome` | `name` |
| `ui/layout.js` | `NamedBox` | `caixa` | `box` |
| `ui/layout.js` | `NamedBox` | `daBarra` | `isBar` |
| `ui/layout.js` | `initLayout` | `numJogadores` | `numPlayers` |
| `ui/layout.js` | `Scale` | `largura` | `width` |
| `ui/layout.js` | `Scale` | `altura` | `height` |
| `ui/loop-crash.js` | `CrashNoticeCtx` | `procurar` | `find` |
| `ui/loop-crash.js` | `CrashNoticeCtx` | `criar` | `create` |
| `ui/loop-crash.js` | `CrashNoticeCtx` | `narrar` | `narrate` |
| `ui/menu-nav.js` | `MenuNavCtx` | `comIndice` | `withIndex` |
| `ui/menu-nav.js` | `MenuNavCtx` | `explicarItem` | `explainItem` |
| `ui/menu-nav.js` | `MenuNavCtx` | `naBarraDe` | `onBar` |
| `ui/menu-nav.js` | `controlParts` | `rotulo` | `label` |
| `ui/menu-nav.js` | `controlParts` | `estado` | `state` |
| `ui/menu-nav.js` | `itemUnder` | `pausa` | `inPause` |
| `ui/mount-panel.js` | `MountPanelSpec` | `idDaLista` | `listId` |
| `ui/mount-panel.js` | `MountPanelSpec` | `rotulos` | `labels` |
| `ui/mount-panel.js` | `MountPanelSpec` | `fecharProprio` | `closeOwn` |
| `ui/mount-panel.js` | `MountedPanel` | `casca` | `shell` |
| `ui/mount-panel.js` | `MountedPanel` | `abrir` | `open` |
| `ui/mount-panel.js` | `MountedPanel` | `fechar` | `close` |
| `ui/panel-shell.js` | `PanelShellCtx` | `procurar` | `find` |
| `ui/panel-shell.js` | `PanelShellCtx` | `criar` | `create` |
| `ui/panel-shell.js` | `PanelShellSpec` | `idDaLista` | `listId` |
| `ui/panel-shell.js` | `PanelShellSpec` | `titulo` | `title` |
| `ui/panel-shell.js` | `PanelShellSpec` | `rotuloDaLista` | `listLabel` |
| `ui/panel-shell.js` | `PanelShellSpec` | `rotuloReset` | `resetLabel` |
| `ui/panel-shell.js` | `PanelShellSpec` | `rotuloFechar` | `closeLabel` |
| `ui/panel-shell.js` | `PanelShellSpec` | `introducao` | `intro` |
| `ui/panel-shell.js` | `PanelShell` | `titulo` | `title` |
| `ui/panel-shell.js` | `PanelShell` | `lista` | `list` |
| `ui/panel-shell.js` | `PanelShell` | `fechar` | `close` |
| `ui/panel-shell.js` | `PanelShell.ids` | `lista` | `list` |
| `ui/panel-shell.js` | `PanelShell.ids` | `fechar` | `close` |
| `ui/panel-widgets.js` | `ControlRowSpec` | `rotulo` | `label` |
| `ui/panel-widgets.js` | `ControlRowSpec` | `dica` | `hint` |
| `ui/panel-widgets.js` | `ControlRowSpec` | `forma` | `shape` |
| `ui/panel-widgets.js` | `ControlRowSpec` | `rotuloAria` | `ariaLabel` |
| `ui/panel-widgets.js` | `ControlRow` | `linha` | `row` |
| `ui/panel-widgets.js` | `StepsSpec` | `rotulo` | `label` |
| `ui/panel-widgets.js` | `StepsSpec` | `valores` | `values` |
| `ui/panel-widgets.js` | `StepsSpec` | `atual` | `current` |
| `ui/pause-buttons.js` | `PauseBtnDef` | `letra` | `dynamicLabel` |
| `ui/pause-buttons.js` | `PauseBtnDef` | `nivel` | `level` |
| `ui/pause-icons.js` | `IconStateSnapshot` | `voz` | `voice` |
| `ui/pause-icons.js` | `IconStateSnapshot` | `velocidade` | `speed` |
| `ui/pause-icons.js` | `IconStateSnapshot` | `idioma` | `locale` |
| `ui/pause-icons.js` | `IconStateSnapshot` | `alternanciaExigida` | `latchRequired` |
| `ui/pause-icons.js` | `IconStateSnapshot` | `semVoz` | `noVoice` |
| `ui/pause-icons.js` | `ActionableIcons` | `tema` | `theme` |
| `ui/pause-icons.js` | `ActionableIcons` | `correcao` | `correction` |
| `ui/pause-icons.js` | `ActionableIcons` | `seguraTeclas` | `holdsKeys` |
| `ui/pause-icons.js` | `ActionableIcons` | `relogio` | `clock` |
| `ui/pause-icons.js` | `ActionableIcons` | `tipografia` | `typography` |
| `ui/pause-icons.js` | `ActionableIcons` | `microfone` | `microphone` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `aoSairDaBarra` | `onLeaveBar` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `explicarIcone` | `explainIcon` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `explicarItem` | `explainItem` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `jogoButtons` | `gameButtons` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `getModoCego` | `getBlindMode` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `setModoCego` | `setBlindMode` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `transporteEmUso` | `transportInUse` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `setTemaDoJogador` | `setPlayerTheme` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `setCorrecaoDoJogador` | `setPlayerCorrection` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `ciclarTipografia` | `cycleTypography` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `seguraTeclas` | `holdsKeys` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `relogio` | `clock` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `microfone` | `microphone` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `abrirMenus` | `openMenus` |
| `ui/pause-icons.js` | `PauseIconsCtx` | `semVoz` | `noVoice` |
| `ui/pause-icons.js` | `PauseIconsApi` | `iconesMontados` | `mountedIcons` |
| `ui/pause-icons.js` | `PauseIconsApi` | `entrarNaBarra` | `enterBar` |
| `ui/pause-icons.js` | `PauseIconsApi` | `sairDaBarra` | `leaveBar` |
| `ui/pause-icons.js` | `PauseIconsApi` | `naBarraDe` | `onBar` |
| `ui/pause-markup.js` | `PauseMenuButton` | `letra` | `dynamicLabel` |
| `ui/pause-markup.js` | `PauseMenuButton` | `nivel` | `level` |
| `ui/pause-markup.js` | `ScreenPauseMarkupOpts` | `jogoButtons` | `gameButtons` |
| `ui/reach-notice.js` | `ReachNoticeCtx` | `procurar` | `find` |
| `ui/reach-notice.js` | `ReachNoticeCtx` | `criar` | `create` |
| `ui/settings-audio.js` | `SettingsAudioCtx` | `getModoCego` | `getBlindMode` |
| `ui/settings-audio.js` | `SettingsAudioCtx` | `setModoCego` | `setBlindMode` |
| `ui/settings-audio.js` | `SettingsAudioApi` | `reflectModoCego` | `reflectBlindMode` |
| `ui/settings-audio.js` | `pieces` | `contentor` | `container` |
| `ui/settings-audio.js` | `pieces` | `rotulo` | `label` |
| `ui/settings-controls.js` | `SettingsControlsCtx` | `acoesDoJogo` | `gameActions` |
| `ui/settings-controls.js` | `SettingsControlsCtx.acoesDoJogo` | `acao` | `action` |
| `ui/settings-controls.js` | `SettingsControlsCtx.acoesDoJogo` | `rotulo` | `label` |
| `ui/settings-empathy.js` | `EmpathySettingsCtx` | `reflectMotorEmpathy` | `reflectMobilityEmpathy` |
| `ui/settings-mobility.js` | `SettingsMobilityCtx` | `seguraTeclas` | `holdsKeys` |
| `ui/settings-mobility.js` | `SettingsMobilityCtx` | `transporteEmUso` | `transportInUse` |
| `ui/settings-mobility.js` | `SettingsMobilityApi` | `reflectFacil` | `reflectEasy` |
| `ui/settings-mobility.js` | `LatchWriteCtx` | `transporteEmUso` | `transportInUse` |
| `ui/settings-motion.js` | `SettingsMotionCtx` | `comPersonagem` | `hasCharacter` |
| `ui/settings-motion.js` | `SettingsMotionCtx` | `rotuloDoPersonagem` | `characterLabel` |
| `ui/settings-motion.js` | `MotionInsideSpec.roundSpec` | `rotulo` | `label` |
| `ui/settings-motion.js` | `MotionInsideSpec.roundSpec` | `valores` | `values` |
| `ui/settings-motion.js` | `MotionInsideSpec.roundSpec` | `atual` | `current` |
| `ui/settings-typo.js` | `SettingsTypoCtx` | `fonteInstalada` | `fontInstalled` |
| `ui/settings-visual.js` | `SettingsVisualCtx` | `renderEixosVisuais` | `renderVisualAxes` |
| `ui/settings-visual.js` | `SettingsVisualCtx` | `oferecer` | `offer` |
| `ui/settings-visual.js` | `playerVisual` | `tema` | `theme` |
| `ui/settings-visual.js` | `playerVisual` | `correcao` | `correction` |
| `ui/settings-visual.js` | `VisualRowsOffered` | `dono` | `owner` |
| `ui/settings-visual.js` | `VisualRowsOffered` | `papeis` | `roles` |
| `ui/shell.js` | `ShellCtx` | `fatosDaCena` | `sceneFacts` |
| `ui/shell.js` | `ShellCtx` | `retomarJogo` | `resumeGame` |
| `ui/shell.js` | `ShellCtx` | `rotuloCurto` | `shortLabel` |
| `ui/shell.js` | `ShellCtx` | `setMotorPlayer` | `setMobilityPlayer` |
| `ui/shell.js` | `ShellApi` | `aplicarCena` | `applyScene` |
| `ui/typo-choices.js` | `FontCssTarget` | `fonte` | `font` |
| `ui/typo-choices.js` | `FontCssTarget` | `cursiva` | `cursive` |

## CN · Published members speak English — the `boot` layer, which is the contract (ADR-0230, issue #206)

**Who is affected: every cartridge.** This is `CreateGameOptions`, `Declinios` and `Engine` — what a game writes to
`createGame` and what it reads back.
· **`acomodacoes` is now `accommodations`, and it is REQUIRED**: a game that still passes `acomodacoes` is refused at
  boot, loudly, by the same check that refused a game with no answer. Also `genero` → `genre`, `controleNaTela` →
  `onScreenPad`, `comIndice` → `withIndex`, `naBarraDe` → `onBar`, `disponibilidade` → `availability`,
  `aoProgredirPesados` → `onHeavyProgress`, `setTemaDoJogador`/`setCorrecaoDoJogador` → `setPlayerTheme`/`setPlayerCorrection`.
· `declines`: `semVozNeural` → `noNeuralVoice`, `semAtorDePausa` → `noPauseActor`, `semAssistenteDePad` → `noPadAssistant`.
  The problem lines name the new keys.
· what the engine returns: `engine.pause.show(i)`/`hide(i)` (was `pausa.mostrar`/`esconder`), `captionSound`,
  `gameSpeed`, `measureFlashes`, `applyVisionFilter`, `scenes`, `onFailure`.

⚠️ **The quiet case is an OPTIONAL option under its old name**: `naBarraDe`, `comIndice`, `setTemaDoJogador` and the
`declines` compile in plain JavaScript and are simply not read — the bar is not steered by the game, the index is
spoken, the engine's own writer is used, the decline is not taken. A TypeScript cartridge gets an error on a fresh
object literal. Search the game for the old names in this table.

📌 **Phase 7 ends here.** Every Portuguese member left in `app/js` is one of eleven exclusions, each with its reason in
`scripts/member-rename-map.json`, and `tests/member-renames-leave-nothing-behind.node.test.js` holds that as a set.

The table is printed from `scripts/member-rename-map.json` by `node scripts/apply-member-rename.mjs --table boot`.

| module | type | old member | new member |
|---|---|---|---|
| `boot/create-game.js` | `Declinios` | `semAssistenteDePad` | `noPadAssistant` |
| `boot/create-game.js` | `Declinios` | `semAtorDePausa` | `noPauseActor` |
| `boot/create-game.js` | `Declinios` | `semVozNeural` | `noNeuralVoice` |
| `boot/create-game.js` | `CreateGameOptions` | `comIndice` | `withIndex` |
| `boot/create-game.js` | `CreateGameOptions` | `naBarraDe` | `onBar` |
| `boot/create-game.js` | `CreateGameOptions` | `controleNaTela` | `onScreenPad` |
| `boot/create-game.js` | `CreateGameOptions` | `acomodacoes` | `accommodations` |
| `boot/create-game.js` | `CreateGameOptions` | `genero` | `genre` |
| `boot/create-game.js` | `CreateGameOptions` | `aoProgredirPesados` | `onHeavyProgress` |
| `boot/create-game.js` | `CreateGameOptions` | `disponibilidade` | `availability` |
| `boot/create-game.js` | `CreateGameOptions` | `setTemaDoJogador` | `setPlayerTheme` |
| `boot/create-game.js` | `CreateGameOptions` | `setCorrecaoDoJogador` | `setPlayerCorrection` |
| `boot/create-game.js` | `Engine` | `pausa` | `pause` |
| `boot/create-game.js` | `Engine.pausa` | `mostrar` | `show` |
| `boot/create-game.js` | `Engine.pausa` | `esconder` | `hide` |
| `boot/create-game.js` | `Engine` | `legendarSom` | `captionSound` |
| `boot/create-game.js` | `Engine` | `velocidadeDoJogo` | `gameSpeed` |
| `boot/create-game.js` | `Engine` | `medirFlashes` | `measureFlashes` |
| `boot/create-game.js` | `Engine` | `aplicarFiltroDeVisao` | `applyVisionFilter` |
| `boot/create-game.js` | `Engine` | `cenas` | `scenes` |
| `boot/create-game.js` | `Engine` | `aoFalhar` | `onFailure` |
| `boot/create-game.js` | `keyboardRows` | `modo` | `mode` |
| `boot/create-game.js` | `keyboardRows` | `linha` | `row` |
| `boot/create-game.js` | `keyboardRows` | `forte` | `strong` |
| `boot/create-game.js` | `keyboardRows` | `botao` | `button` |

## CO · Three members the word list hid: `padrao` was filed as English (ADR-0230, issue #206)

**Who is affected:** a host that builds a latch option or reading (`LatchedEdgeOptions.padrao`, `LatchReading.padrao` →
`byDefault`: the value to use when nothing is stored) or the controls panel's ctx (`SettingsControlsCtx.kbPadraoFor` →
`defaultSchemeFor`: a player's factory keyboard scheme).

📌 **Why now, after phase 7 was called done:** the language gate's word list had `padrao` in its ENGLISH list, so these
three members counted as clean. Moving the word made the phase-7 gate red — which is the gate doing its job: the phase
was not finished, it was mis-measured. The same `padrao` also marks two published names (`PADRAO`, `nosPadroes`) that
change in a note of their own.

| module | type | old member | new member |
|---|---|---|---|
| `input/latch-edge.js` | `LatchedEdgeOptions` | `padrao` | `byDefault` |
| `input/latch-scope.js` | `LatchReading` | `padrao` | `byDefault` |
| `ui/settings-controls.js` | `SettingsControlsCtx` | `kbPadraoFor` | `defaultSchemeFor` |

## CP · Five published names the word list hid (ADR-0219, issue #206)

**Who is affected:** anyone importing one of these. 📏 Measured by reading the seven games' imports, as information: the
platformer imports the visual default (three uses) and the 15-puzzle one — both are `render/viz-axes`'s `PADRAO`.

📌 **Why now, after phase 2 said zero of 1620:** its words sat in the language gate's English list — `padrao` until
`63865376`, `tokenizar` until `4a0a2707` — so the names counted as clean. The measure changed, not the names.

| module | old name | new name | what it is |
|---|---|---|---|
| `render/viz-axes.js` | `PADRAO` | `DEFAULT_VISUAL` | the visual state with nothing chosen |
| `render/viz-axes.js` | `nosPadroes` | `bothAxesAtDefault` | are both axes at their default? (what frees a simulation) |
| `input/pointer.js` | `PADRAO` | `DEFAULT_POINTER` | the pointer sample before any input |
| `input/transport-in-use.js` | `PADRAO` | `DEFAULT_INPUT_STATE` | the input state of a player who touched nothing |
| `platform/kokoro.js` | `tokenizar` | `tokenize` | the token ids of a phoneme string |

## CQ · The controller-mapping wizard cannot be declined: `Declinios.noPadAssistant` leaves the type (ADR-0231)

**Who is affected:** a host that passes `declines: { noPadAssistant: true }` (`semAssistenteDePad` before note CN). The
type no longer has the field, so the declaration stops compiling. **Delete the line; nothing else changes.**

📌 **Behaviour does not change, and that is the point of the note:** the field had no reader since the engine started
mounting its own wizard (the `#padwiz` panel, «Mapear controle», note CD). Declaring it and not declaring it already gave
the same result — the wizard was in the Motora panel either way. The engine's accessibility is not declinable (ADR-0122),
and the wizard is accessibility the engine offers every game: a donated, adapted or one-handed controller only works once
it is mapped.

📏 **Measured in the seven games, as information:** five declare it — `game-2048`, `game-chess` (and its two spikes),
`game-soccer`, `game-whackwhack`, `pixi-15-puzzle`. ⚠️ `game-soccer`'s `mundoRodando` comment says the wizard path is
unreachable *because* the game declines it; that was already not true, so the answer it gives (`() => !paused`) is now
the one that matters when a child maps a controller mid-pause.

## CR · The ambient water is asked of the game: `AudioAmbientCtx.tileAt` becomes `roleAt` (ADR-0027, ADR-0224)

**Who is affected:** a host that calls `createAudioAmbient` (`platform/audio-ambient`). The ctx loses `tileAt` and gains
a REQUIRED `roleAt(at: Spot): Role` — the cartridge's own `GameDeclaration.roleAt`. **Migration: replace `tileAt` with
`roleAt: (at) => declaration.roleAt(at)`; `TILE` stays.**

📌 **Why:** the module decided where the water was with `tileAt(...) === 3`, and tile 3 is water only in the
platformer's map. A game with another numbering would hear a river in its lava and silence in its lake, with no error.
The water is now whatever the game's `roleAt` calls `'water'`, asked at each cell's corner in world units (`TILE` per
cell) — the same answer that paints high contrast and routes the sonar. Required and not optional, by ADR-0224's
precedent: an optional port would let the water fall silent without a word.

📏 **Measured in the seven games, as information:** one caller — `game-platformer` (`app/js/main.ts`, the `ambient`
ctx). Its `roleAt` already answers `'water'` through `tile-roles.ts`, so the sound does not change. Its `declaration` is
built later in the file than `ambient`, which is why the migration is a closure and not `declaration.roleAt` itself.

## CS · The pure names leave the settings store and the storage, and the reduced-motion default is asked through `matchMedia` (ADR-0232, issue #207)

**Who is affected:** anyone importing the names below from their old module, calling `defaultReducedMotion`,
`sceneDefault` or `readStoredScene` without an argument, or building a `PauseIconsCtx` or `SettingsMotionCtx` by hand.
A game that only calls `createGame` changes nothing in its ctx: the root passes `matchMedia` itself.

📌 **Why:** outside the composition root a module imports by value only what holds no state and reaches no global
(ADR-0232). `DEFAULTS`, the 📷 cycle and the key table are pure, but they lived in `core/state` and `platform/storage`,
so a panel that only compared against a default imported the page's one settings store to do it. They moved to three
stateless modules, and `defaultReducedMotion` stopped reaching `window`: whoever calls passes the question.

| old | new | migration |
|---|---|---|
| `core/state.js` `DEFAULTS` | `core/setting-defaults.js` `DEFAULTS` | change the import path |
| `core/state.js` `defaultReducedMotion()` | `core/setting-defaults.js` `defaultReducedMotion(matchMedia)` | pass the browser's question: `defaultReducedMotion((q) => window.matchMedia(q))` — a bare `window.matchMedia` throws «Illegal invocation» |
| `core/state.js` `nextCameraControl`, type `CameraControl` | `core/camera-cycle.js` | change the import path |
| `platform/storage.js` `gameKey` | `platform/storage-keys.js` `gameKey` | change the import path |
| `ui/motion-scene.js` `sceneDefault()`, `readStoredScene()` | `sceneDefault(reducedByDefault)`, `readStoredScene(reducedByDefault)` | pass the system's answer: `readStoredScene(defaultReducedMotion((q) => window.matchMedia(q)))` |
| `PauseIconsCtx`, `SettingsMotionCtx` | gain a REQUIRED `matchMedia: MediaQuery` | pass `(q) => window.matchMedia(q)`; required, by ADR-0227's precedent — an optional port would let a host forget it and switch the animation back on for a child whose system asked for less |

⚠️ **`platform/storage.js` still publishes `KEYS`**, as an alias of `platform/storage-keys.js`'s table, and that is
measured and not habit: `game-whackwhack` imports `KEYS` from it by name, `game-platformer` reads `store.KEYS` through the
namespace, eight engine modules do the same, and the namespace is the port `core/state.loadState` receives. Both paths give
the same object. The alias ends with D2b, when the root builds the storage.

📏 **Measured in the seven games, as information:** `game-platformer` imports `defaultReducedMotion` from `core/state`
and calls it twice (`app/js/main.ts`, the scene flags and the per-player character flags); `game-2048` and
`pixi-15-puzzle` import the scene reader under its older name (`lerCenaGuardada`, note AQ) and will pass the default when
they migrate to it. No game imports `DEFAULTS`, `nextCameraControl`, `CameraControl` or `gameKey`, or builds either ctx.

## CT · The storage is built by the root and passed in: no module reads `localStorage` by import (ADR-0232, issue #207)

**Who is affected:** anyone calling the functions below outside `createGame`, building one of the ctx listed by hand, or
importing the page-wide functions of `platform/storage`. A game that only calls `createGame` changes nothing: the root
builds the store and passes it everywhere itself.

📌 **Why:** outside the composition root a module imports by value only what holds no state and reaches no global
(ADR-0232). `platform/storage` was the page's one `localStorage` reached by import from twelve modules, and the browser
suite's instability (F9) was exactly that: ~115 test files on one origin writing the same keys while others booted.
`platform/storage` is now a factory, `createStorage(backend)`; the root builds ONE store from `EngineHost.storage` (new,
optional) or the host window's `localStorage`, and every module that persists receives it. A migrating game builds its
own the same way: `const store = createStorage(window.localStorage)` — or passes `memoryBackend()` in a test.

| old | new | migration |
|---|---|---|
| `platform/storage.js` `get`, `set`, `remove`, `getBool`, `setBool`, `getNum`, `getJSON`, `setJSON`, `getWithLegacy`, `getJsonWithLegacy` | the same ten, as members of the `Store` that `createStorage(backend)` returns | `const store = createStorage(window.localStorage)` once at boot, then `store.get(…)` where `get(…)` was |
| `platform/storage.js` `KEYS` | `platform/storage-keys.js` `KEYS` (note CS) | change the import path |
| `input/keyboard.js` `loadKB()`, `initKB()`, `resetKB()`, `saveKB(kb)` | `loadKB(store)`, `initKB(store)`, `resetKB(store)`, `saveKB(store, kb)` | pass the store first |
| `input/latch-edge.js` `LatchedEdgeOptions.store` | REQUIRED (was optional, defaulting to the page's storage) | `createLatchedEdge(() => players, { store })` |
| `input/pad-wizard.js` `padMap(id)` · `PadWizardCtx` | `padMap(store, id)` · `PadWizardCtx.store` REQUIRED | pass the store |
| `input/gamepad.js` `GamepadCtx` | gains a REQUIRED `store` | pass the store; the controller maps are read and saved through it |
| `platform/audio.js` `initAudioMixer()` | `initAudioMixer(store)` | pass the store; `setCatGain` persists through it |
| `platform/audio-mixer.js` `loadAudioCat()`, `saveAudioCat(k, obj)` | `loadAudioCat(store)`, `saveAudioCat(store, k, obj)` | pass the store first |
| `platform/tts.js` `TtsCtx` | gains a REQUIRED `store` | pass the store; the chosen engine and voice are read and kept through it |
| `render/crt.js` `initCrt({ numPlayers, a11yVisualOn })` · `CRT` | `initCrt({ numPlayers, a11yVisualOn, store })`; `CRT` is the factory CRT until `initCrt` reads the stored one into it (it was read at IMPORT) | pass the store; read `CRT` after `initCrt` |
| `render/lq-filter.js` `LqFilterCtx` · `getLqT()` | gains a REQUIRED `store`; the amount is 0 until `initLqFilter` reads it (it was read at IMPORT) | pass the store to `initLqFilter` |
| `render/high-contrast.js` `HighContrastCtx` · `HC_ROLE` | gains a REQUIRED `store`; `HC_ROLE` holds the defaults until `initHighContrast` lays the stored colours over them (they were read at IMPORT); `saveHcRole()` keeps them in that store | pass the store to `initHighContrast` |
| `render/viz-setters.js` `readStoredVisual(i)` · `VizSettersCtx` | `readStoredVisual(store, i)` · `VizSettersCtx.store` REQUIRED | pass the store |
| `ui/motion-scene.js` `readStoredScene(reducedByDefault)`, `storeScene(rm)` | `readStoredScene(store, reducedByDefault)`, `storeScene(store, rm)` | pass the store first |
| `ui/pause-icons.js` `PauseIconsCtx` | gains a REQUIRED `store` | pass the store; the calm level, the movement latch and the scene flags' default go through it |
| `ui/settings-motion.js` `SettingsMotionCtx.store` | widens from `{ setBool }` to `setBool`, `getJSON`, `setJSON` | pass the store itself; the scene flags are read and kept through it when no `rm` is shared |
| `ui/vlibras.js` `librasOpen` | OFF until the new `initLibras(store)` reads the stored choice (it was read at IMPORT); `toggleLibras` keeps the choice in that store | call `initLibras(store)` at boot — `createGame` does; without it the choice lasts the session only |

Required and not optional, by ADR-0224/0227's precedent: each of these has no safe answer without a store — the child's
remap, latch, controller map, voice, colours or calm level would be read from nowhere and lost in silence. The one
optional field is `EngineHost.storage` itself, because its absence HAS a safe answer: the host window's `localStorage`,
which is what «this browser remembers the child's choices» means.

⚠️ **Four values stopped being read at import** — `CRT`, the L→Q amount (`getLqT()`), `HC_ROLE` and `librasOpen`. Each
holds its factory value until its init reads the store. A game that read one of them right after importing, before the
init, now sees the factory value; `createGame` inits `CRT`, the L→Q amount and deaf mode before anything reads them.

📏 **Measured in the seven games, read-only, as information** — every one consumes an older published engine, and several
still import names older than this note (`criarArestaComAlternancia`, `lerCenaGuardada`, `lerVisualGuardado`, `kJogo`), so
each meets these changes together with the renames already listed:

- **Direct use of `platform/storage`'s page-wide functions:** `game-platformer` (`app/js/main.ts`, `game/state.ts`,
  `game/attract.ts` — the namespace, with `store.KEYS`), `game-soccer` (`boot/main.ts`; `input/keymap.ts` reads and
  writes its keymap through a store it declares as a slice), `game-whackwhack` (`boot/standalone.ts` `KEYS`, `set`;
  `store/high-score.ts` `getNum`, `set`), `game-2048` (`src/standalone.ts`, the namespace), `pixi-15-puzzle`
  (`cartridge.ts`, `get`/`set`/`getBool`/`setBool`). Each builds its store once with `createStorage(window.localStorage)`
  — or, better, passes the same backend to `createGame` as `host.storage` so the game and the engine keep the child's
  data in one place.
- **Functions and ctx that now take the store:** `game-platformer` calls `initKB`, `initCrt`, `initAudioMixer`,
  `createTts`, `initLqFilter`, `initHighContrast`, `saveHcRole`, `initPauseIcons`, `initGamepad`, `initVizSetters`,
  `initSettingsMotion` and the latch factory; `game-soccer` calls `initGamepad`, `initAudioMixer`, the latch factory and
  `toggleLibras`/`vlibrasOpen` (deaf mode starts off unless `initLibras(store)` runs — its own `createGame` root does
  it); `game-2048` passes `saveKB`/`resetKB` to the controls panel; `game-whackwhack` and `pixi-15-puzzle` call the visual
  reader, and `pixi-15-puzzle` and `game-2048` the scene reader. `game-chess` and `game-pinball` use none of these.

## CU · The settings store arrives by injection: no module reads `core/state` by import (ADR-0232, issue #207)

**Who is affected:** anyone calling the functions below outside `createGame`, or building one of the ctx listed by hand.
A game that only calls `createGame` changes nothing in its ctx: the root answers every question from the settings
store it loaded. What a game calls itself — `startLoop` above all — changes.

📌 **Why:** outside the composition root a module imports by value only what holds no state and reaches no global
(ADR-0232). `core/state` is the page's settings store; seven modules read or wrote it by import, so a panel, the
gamepad and the loop each depended on WHICH store existed, and a test could not hand them its own. Each now receives
the reads and writes it needs as REQUIRED ports (ADR-0224/0227's precedent: an absent port would ignore a child's
setting in silence). A game that is its own root answers them from `core/state` — `() => state.oneButton` — or, beside
`createGame`, from the engine handle (`engine.gameSpeed`).

| old | new | migration |
|---|---|---|
| `input/gamepad.js` `GamepadCtx` | gains a REQUIRED `oneButton: () => boolean` | pass `() => state.oneButton` (`core/state`), read each frame |
| `core/loop.js` `startLoop(ticker, frame, maxDt?, options?)` | `startLoop(ticker, frame, maxDt, options)` with a REQUIRED `options.speed: () => number` — the loop no longer reads the game speed from the settings store | pass `{ speed: engine.gameSpeed }` beside `createGame` (or `() => state.gameSpeed` in a game that is its own root); `maxDt` may be `undefined` for the default 2 |
| `ui/pause-icons.js` `PauseIconsCtx` | gains a REQUIRED `settings: PauseIconsSettings` — the live reads and writers of the menu index, game speed, camera and voice controls, switch scanning, and the default blind-mode writer | pass `core/state` itself (`settings: state`): the names are its own, and its live bindings are the reads |
| `ui/settings-audio.js` `SettingsAudioCtx` | gains a REQUIRED `settings: SettingsAudioSettings` (the voice section's reads and writers, the default blind-mode writer) and a REQUIRED `on(setting, react)` that returns the release | pass `settings: state` and, as `on`, the root's own disposable door to the bus — `createGame` passes its `stateOn`, released by `dispose()` (ADR-0220); a game that is its own root passes `state.on` |
| `ui/voice-settings.js` `VoiceSettingsCtx` | gains a REQUIRED `settings: VoiceSettingsStore` (menu index, speech rate) | pass `core/state` |
| `render/viz-setters.js` `VizSettersCtx` | `setBlindMode` becomes REQUIRED (its default was `core/state`'s writer), and it gains a REQUIRED `setVizMode: (mode: string) => void` — the legacy mirror `incl_viz` | pass `setBlindModeValue` and `setVizModeValue` from `core/state` |

📌 **`startLoop`'s port was a decision, recorded before the code** (ADR-0232 erratum, docs `ced165e`): a REQUIRED port,
and not a speed reader the root registers beside `registerCrashNotice` — that would be the module state D4 removes, and a
second root on the page would overwrite the first's reader — nor an optional port defaulting to 100%, which ADR-0224/0227
rule out because a game that forgot it would ignore the child's speed in silence.

📏 **Measured in the seven games, read-only, as information:** `initGamepad` is called by `game-platformer`
(`app/js/main.ts`) and `game-soccer` (`app/js/boot/main.ts`). `startLoop` is called by five: `game-chess`
(`app/js/boot/standalone.ts`, with `{ aoFalhar }` — the older name of `onFailure`), `game-platformer`
(`src/standalone.ts`), `game-soccer` (`app/js/boot/main.ts`, with no options at all), `game-whackwhack`
(`app/js/boot/standalone.ts`) and `pixi-15-puzzle` (`app/js/boot/standalone.ts`). Each of them has a `createGame` handle
to answer from. `initVizSetters` is called by `game-platformer` alone (`app/js/main.ts`, which already passes the
blind writer, under its older name `setModoCego`). `initPauseIcons` and `initSettingsAudio` are called by `game-platformer`
alone (`app/js/main.ts`); no game calls `createVoiceSettings`.

## CV · The translator is built by the root and passed in: no module reads `core/i18n` by import (ADR-0232 D3, issue #207)

**Who is affected:** anyone calling the functions below outside `createGame`, building one of the ctx listed by hand, or
importing `core/i18n`'s page-wide functions. A game that only calls `createGame` changes nothing in its ctx: the root
builds the translator and hands `t` down itself.

📌 **Why:** outside the composition root a module imports by value only what holds no state and reaches no global
(ADR-0232). `core/i18n` holds the page's language and, until this note, one game dictionary for the whole page — so a
dictionary one root registered resolved in another. The decisions, recorded as an ADR-0232 erratum before the code (docs
`dac7a6d`): the LANGUAGE is the page's (`<html lang>` is one attribute, so two roots in two languages would tell a screen
reader one of them wrongly), a game's DICTIONARY is the root's; a module that only translates receives a bare `t`, one
that reads or sets the language receives the `Translator`; a helper function gains a `t` parameter and stays a function
(no new factories); a module that must hear a language change subscribes through `translator.onChange`, which the root
passes through its disposing door. The window's `i18n:change` event stays, as the page's signal to its host.

| old | new | migration |
|---|---|---|
| `core/i18n.js` `applyDom(root)` | the root's `translator.applyDom(root)` — no longer published by the module | a game's markup is translated by its root; `createTranslator().applyDom` where a page translates its own |
| `input/gamepad.js` `GamepadCtx` · `input/keydown.js` `KeydownCtx` · `input/pad-wizard.js` `PadWizardCtx` · `input/touch.js` `TouchCtx`, `TouchMarkupCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` (`createGame`'s engine answers for its own mounts) |
| `platform/audio-earcons.js` `AudioEarconsCtx` · `platform/audio-sonar.js` `SonarCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` |
| `render/viz-setters.js` `VizSettersCtx` · `vizGroupHtml(modes, cur)` | `VizSettersCtx` gains a REQUIRED `t: Translate`; `vizGroupHtml(t, modes, cur)` | pass your root's `t` |
| the ui helpers that translate: `dom.toggleLabel`, `toggleAria` · `changed-mark.markChanged`, `markMenuChanged` · `item-announcement.announceItem` · `control-choices.keyName` · `audio-choices.caneDivMessage`, `sinkOptionLabel` · `caa-sets.caaLabel` · `mobility-choices.playerPrefix`, `easyAnnouncement` · `motion-choices.motionMasterLabel`, `sceneMotionAnnouncement`, `crtToggleAnnouncement`, `crtLevelLabel`, `crtRoundAnnouncement`, `stopResumeAllAnnouncement` · `typo-choices.fontRow`, `typoGroups` · `visual-choices.onOffLabel` · `menu-nav.controlParts` | each takes `t: Translate` as its FIRST parameter and stays a function | pass your root's `t` first: `toggleLabel(t, on)` |
| `ui/menu-nav.js` `MenuNavCtx` · `ui/where-the-child-is.js` `WhereTheChildIsCtx` · `ui/game-options.js` `GameOptionsDrawCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` |
| `platform/tts.js` `TtsCtx` | gains a REQUIRED `translator: Pick<Translator, 't' \| 'bcp47'>` — narration speaks the page's language, read at every utterance | pass your root's translator |
| `ui/eye-control.js` `EyeControlDeps` · `ui/face-control.js` `FaceControlDeps` · `ui/hand-control.js` `HandControlDeps` · `ui/voice-control.js` `VoiceControlDeps` · `ui/loop-crash.js` `CrashNoticeCtx` · `ui/simulation-list.js` `SimulationListCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` |
| `ui/hud.js` `counterLabel`, `applyCounterLabel`, `waitBadgeHtml`, `hudRowView` · `ui/hud-bands.js` `mountHudBands` · `ui/shell.js` `spokenGlyph`, `pauseLegendHtml`, `legendRow1` · `ui/vlibras.js` `toggleLibras` · `ui/gaze-overlay.js` `drawGazeOverlay` | each takes `t: Translate` as its FIRST parameter and stays a function; `drawGazeOverlay` loses its `say` option, which that parameter replaces | pass your root's `t` first: `toggleLibras(t)`, `pauseLegendHtml(t, sim, no)` |
| `ui/hud.js` `HudCtx` · `ui/shell.js` `ShellCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` |
| `ui/settings-panel.js` `SettingsPanelCtx` · `ui/settings-empathy.js` `EmpathySettingsCtx` · `ui/settings-typo.js` `SettingsTypoCtx` · `ui/settings-caa.js` `SettingsCaaCtx` · `ui/settings-controls.js` `SettingsControlsCtx` · `ui/settings-mobility.js` `SettingsMobilityCtx`, `LatchWriteCtx` · `ui/settings-motion.js` `SettingsMotionCtx` · `ui/settings-visual.js` `SettingsVisualCtx` | each gains a REQUIRED `t: Translate` | pass your root's `t` |
| `ui/settings-audio.js` `SettingsAudioCtx` · `ui/voice-settings.js` `VoiceSettingsCtx` | each gains a REQUIRED `translator: Pick<Translator, 't' \| 'bcp47'>` — the voice list reads the page's language | pass your root's translator |
| `ui/settings-audio.js` `mountAudioInside`, `mountSoundInside` · `ui/settings-caa.js` `lettersRowSpec`, `caaRowSpec`, `mountCaaInside` · `ui/settings-controls.js` `drawKeys` · `ui/settings-mobility.js` `mountMobilityInside` · `ui/settings-typo.js` `mountTypoInside` | each takes `t: Translate` as its FIRST parameter and stays a function | pass your root's `t` first: `drawKeys(t, button, codes)` |
| `ui/settings-caa.js` `CAA_SECTIONS` | each section's `rows` takes the `t` to write them in: `rows(t)` | pass your root's `t` |
| `ui/pause-icons.js` `PauseIconsCtx` | gains a REQUIRED `translator: Pick<Translator, 't' \| 'locale' \| 'setLocale'>` — the 🌐 shows the page's language and sets the next one through it | pass your root's translator |
| `ui/pause-icons.js` `computeIconLabel` | takes `t: Translate` as its FIRST parameter and stays a function | `computeIconLabel(t, k, snapshot)` |
| `ui/pause-markup.js` (also re-exported by `ui/pause-icons.js`) `iconBtnMarkup`, `iconsMarkup`, `quickBarMarkup` | each takes the new `BarTranslator` (`Pick<Translator, 't' \| 'locale'>`) as its FIRST parameter — the 🌐 flag reads the language | `iconsMarkup(translator)`, `quickBarMarkup(translator, icons)` |
| `core/i18n.js` `dictionaryGaps()` | removed: the gaps are the root's, `Translator.dictionaryGaps()`, which `createGame`'s `problems` reads | nothing, if you read `problems`; otherwise ask your translator |
| `core/i18n.js` `Translator.registerDict` · `Translator.dictionaryGaps` | now the TRANSLATOR's own dictionary, read by no other translator on the page (they wrote and read the page-wide one); the translator still reads the page-wide `registerDict` after its own, until the module-level `t` and `registerDict` leave | register through `CreateGameOptions.dictionaries` (new, section E), or the module-level `registerDict` as before |
| `ui/pause-markup.js` `ScreenPauseMarkupOpts.t` | is a `Translate` (it carries `{param}`s) and now names the dialog and the seat too, which the module's own `t` used to | pass your root's `t` |

📏 **Measured in the seven games, read-only, as information:** no game calls `applyDom` (two mention it in comments).
`game-platformer` calls `initKeydown`, `initGamepad` and `initTouch` (`app/js/main.ts`); `game-soccer` calls `initGamepad`
(`app/js/boot/main.ts`); no game calls `createPadWizard` or `mountTouchControls`. `game-platformer` calls
`createAudioEarcons`, `createTts` and `createAudioSonar` (`app/js/main.ts`); `game-soccer` calls `createAudioEarcons`
(`app/js/audio/sound.ts`). Of the ui helpers, only `game-platformer` calls any (`playerPrefix` ×3, `toggleLabel` ×2 and
`initMenuNav`, in `app/js/main.ts`). No game builds a camera, voice, crash-notice or simulation-list ctx by hand.
`game-platformer` calls `initHud`, `initShell` and `pauseLegendHtml` (`app/js/main.ts`); `game-soccer` calls
`toggleLibras` (`app/js/boot/main.ts`, and its `tests/libras.browser.test.ts`). Of the settings panels, `game-platformer`
calls `initSettingsPanel`, `initSettingsCaa`, `initSettingsEmpathy`, `initSettingsVisual`, `initSettingsTypo`,
`initSettingsAudio`, `initSettingsControls` and `initSettingsMotion` (`app/js/main.ts`); `game-2048` calls
`initSettingsTypo` and `initSettingsControls` (`src/standalone.ts`); `game-soccer` calls `initSettingsControls`
(`app/js/ui/controls-panel.ts`). `game-platformer` calls `initPauseIcons` and `iconsMarkup()` (`app/js/main.ts`); no
game calls `computeIconLabel`, `iconBtnMarkup`, `quickBarMarkup` or `screenPauseMarkup`.

## CW · The member the word list hid: `ControlRow.controle` becomes `control` (ADR-0230, issue #206)

**Who is affected:** anyone who calls `ui/panel-widgets`'s `controlRow` and reads the control it built —
`const { row, controle } = controlRow(ctx, spec)` becomes `const { row, control } = controlRow(ctx, spec)`.

📌 **Why now, after phase 7 was called done:** `controle` sat in the language gate's ENGLISH list until `18740e02`, so
the member counted as clean; the map then filed it as an exclusion «pending decision». It was not pending: phase 7
decided every Portuguese published member (ADR-0230), and this one mirrors nothing foreign and is stored nowhere. The
exclusion leaves the map in the same commit.

Printed by `node scripts/apply-member-rename.mjs --table ui` (the one row of this note):

| module | type | old member | new member |
|---|---|---|---|
| `ui/panel-widgets.js` | `ControlRow` | `controle` | `control` |

📏 **Measured in the seven games, read-only, as information:** no game calls `controlRow` or reads a `ControlRow`
(`git grep` for `controlRow` and `.controle` in `game-2048`, `game-chess`, `game-pinball`, `game-platformer`,
`game-soccer`, `game-whackwhack` and `pixi-15-puzzle`: the only hits are the Portuguese word in comments and in UI text).

## CX · The Portuguese acronym leaves the surface: CAA becomes AAC, in names, a member, two paths and the i18n keys (ADR-0219 phases 2 and 3, ADR-0230, issue #206)

**Who is affected:** a game that mounts the augmentative and alternative communication panel itself, or reads its
catalogue — the import path, the names, one member of the shell's ctx and, for a game that registers its own
dictionary over the engine's, the i18n keys.

📌 **Why now, after phases 2, 3 and 7 said done:** `caa` (*comunicação aumentativa e alternativa*) sat in the
language gate's ENGLISH list, so every name built on it counted as clean. Moved to the Portuguese list, the inventory
went from 11 to 26 identifiers (14 declarations in the two modules, 1 member of `ShellCtx`) — the measure widening,
not new debt — and this note is the payment that brings it back to 11. The English acronym is AAC.

Printed by `node scripts/print-rename-table.mjs aac` (names, phase 2):

| was | is |
|---|---|
| `CAA_BY_KEY` | `AAC_BY_KEY` |
| `CAA_SECTIONS` | `AAC_SECTIONS` |
| `CAA_SETS` | `AAC_SETS` |
| `caaAvailable` | `aacAvailable` |
| `caaControlId` | `aacControlId` |
| `caaLabel` | `aacLabel` |
| `caaReason` | `aacReason` |
| `caaRowSpec` | `aacRowSpec` |
| `CaaSet` | `AacSet` |
| `CaaTier` | `AacTier` |
| `initSettingsCaa` | `initSettingsAac` |
| `mountCaaInside` | `mountAacInside` |
| `SettingsCaaApi` | `SettingsAacApi` |
| `SettingsCaaCtx` | `SettingsAacCtx` |

Printed by `node scripts/print-rename-table.mjs --files aac` (paths, phase 3) — the import specifier changes with it,
`@the-inclusionist/engine/ui/settings-caa.js` → `@the-inclusionist/engine/ui/settings-aac.js`:

| was | is |
|---|---|
| `app/js/ui/caa-sets.ts` | `app/js/ui/aac-sets.ts` |
| `app/js/ui/settings-caa.ts` | `app/js/ui/settings-aac.ts` |
| `tests/caa-sets.node.test.js` | `tests/aac-sets.node.test.js` |
| `tests/settings-caa.browser.test.js` | `tests/settings-aac.browser.test.js` |

The member (phase 7), the row printed by `node scripts/apply-member-rename.mjs --table ui`:

| module | type | old member | new member |
|---|---|---|---|
| `ui/shell.js` | `ShellCtx` | `openCaa` | `openAac` |

The i18n keys, renamed by prefix in the three dictionaries and in every reader (`caa.letras` → `aac.letras`,
`sr.caa.reset` → `sr.aac.reset`, and so on for all fifteen): `caa.grupo.rotulo`, `caa.letras`, `caa.letras.dica`,
`caa.emPreparo`, `caa.aguardandoNegociacao`, `caa.secao.agora`, `caa.secao.agoraTag`, `caa.secao.preparo`,
`caa.secao.preparoTag`, `caa.secao.negociacao`, `caa.secao.negociacaoTag`, `sr.caa.escolha`, `sr.caa.reset`,
`sr.caa.caixaAltaOn`, `sr.caa.caixaAltaOff`. 📏 Measured before renaming: no stored value depends on one (no `incl_*` key in
`platform/storage-keys` carries `caa`, and these keys are only ever handed to `t()` when a row is drawn or a sentence
is said), and no game writes one.

⚠️ **What stays `caa`, and why:** the pause ACTION id `caa` (`data-act="caa"`, the `caa` entry of the shell's action
table and of the pause icons) and the keys built from it (`pause.caa`, `menu.caa`) are DATA a game's markup and code
read, the same exemption the member map gives the other pause action ids; the DOM ids and data attributes the panel
queries (`#caa`, `#caa-list`, `#caa-reset`, `#caa-close`, `#caa-caixa-alta`, `#caa-letras`, `caa-set-<key>`,
`data-caa`, `data-caa-section`) are the markup contract with a game's page — `game-platformer`'s `app/index.html`
writes four of them. No storage key contains `caa`, so none had to be kept.

📏 **Measured in the seven games, read-only, as information:** only `game-platformer` is affected — `app/js/main.ts`
imports `initSettingsCaa` from `@the-inclusionist/engine/ui/settings-caa.js` (line 83), calls it (line 1792) and passes
`openCaa` in its `ShellCtx` (line 2099). `game-2048` names the `caa` pause action in comments only; `game-chess`,
`game-pinball`, `game-soccer`, `game-whackwhack` and `pixi-15-puzzle` use none of it.

## CY · ADR-0232 D4-B1: the announcer, Libras, the loop's crash notice, the shared RNG and the UI shells (issue #207)

**Who is affected:** every game — all seven announce through `core/a11y-sr` — and, besides, a game that calls
`startLoop`, uses deaf mode (`ui/vlibras`), draws from the shared RNG, or mounts the pause icons or the debug panel
itself.

📌 **Why:** each of these modules held module-level state or reached a browser global — the announcer the global
document and a registered Libras mirror, deaf mode its choice and queue, the loop a registered crash notice, the RNG
two shared streams — so two roots on one page shared them, and a root building in another document announced into
the page's regions. Each root now builds what holds state; a helper receives what it uses (ADR-0232 D4).

| was | is |
|---|---|
| `import { srSay, srAlert } from '…/core/a11y-sr.js'` | `engine.say(text)` / `engine.alert(text)` — this root's announcer, over the host's document |
| `setVlibrasSay(vlibrasSay)` (the root's announcements signed in Libras) | `engine.mirrorAnnouncements(engine.libras.say)` — returns its release. The root connects NOTHING by itself (decision DD1, pending the Dev): a game that did not call `setVlibrasSay` keeps not signing |
| an announcement with no root (a boot that failed before `createGame` returned) | `createAnnouncer({ doc: document, raf: (cb) => requestAnimationFrame(cb) }).alert(text)` — the factory stays published for this |
| `vlibrasOpen()` / `librasOpen` · `toggleLibras(t)` · `vlibrasSay(text)` · `vlTick()` | `engine.libras.isOpen()` · `engine.libras.toggle()` (confirms in the root's language) · `engine.libras.say(text)` · `engine.libras.tick()` — the ROOT's deaf mode, the one the bar's 🦻 toggles |
| `initLibras(store)` · `setOnLibrasChange(fn)` (a game that is its own root) | `createLibras({ doc, win, store, now })` → `{ isOpen, toggle(t), say, tick, onChange(fn): release }`; the stored choice is read at build |
| `startLoop(ticker, frame, maxDt, { speed })` relying on `registerCrashNotice` | `startLoop(ticker, frame, maxDt, { speed, onFailure: engine.onFailure })` — `onFailure` is REQUIRED; `registerCrashNotice` is gone |
| `rnd` · `randInt` · `shuffle` · `reseed` from `core/rng` | `createRng(seed)` — a stream of the game's own |
| `decorationRng` (`rngDecoracao` in 9.0) | `createRng(DEFAULT_SEED ^ 0x5eed)` — the same sequence, built by the game |
| `initPauseIcons({ …, doc? })` | `doc` is REQUIRED (`Pick<Document, 'createElement'>`) |
| `initDebugPanel({ …, search? })` | `search`, `doc` and `expose(samples)` are REQUIRED — pass `location.search`, `document` and `(s) => { window.__sonda = s; }` to keep what it did |
| `mountPanel(ctx, spec)` | `ctx.localeOn(react): release` is REQUIRED — the root's door to a language change, instead of the window's `i18n:change` |

⚠️ **Deaf mode's behaviour is unchanged, on purpose:** a choice restored from storage signs only after the first
`tick`, the queue holds one utterance, and the root's own announcements reach the interpreter only through a mirror a
game connects. Having the root sign everything is one line in the root (`announcer.mirrorTo(libras.say)`) the day the
Dev decides it.

📌 **Unchanged in shape:** `consumer-quiz/main-quiz` now exports `bootQuiz({ doc, win })`, called by `app/quiz.html`;
it is not published. `ui/fonts.FONT_BY_KEY` is the same table with the same type, built in one expression.

📏 **Measured in the seven games, read-only, as information** (9.0.0 names):
- `core/a11y-sr` — all seven. `game-2048` (`app/js/boot/main.ts:13`, `src/standalone.ts:16`, `tests/announcement.browser.test.ts:15`);
  `game-chess` (`app/js/boot/game-shell.ts:31`, `boot/narration.ts:28`, and `boot/standalone.ts:21`, whose `srAlert` at
  `:150` is the rootless boot-failure alert → `createAnnouncer`); `game-pinball` (`app/js/main.ts:95`, passed on to
  `shell/announce.ts`); `game-platformer` (`app/js/main.ts:163`, with `setVlibrasSay` at `:652`); `game-soccer`
  (`app/js/boot/main.ts:11`); `game-whackwhack` (`app/js/boot/main.ts:21`, `boot/standalone.ts:39`); `pixi-15-puzzle`
  (`app/js/cartridge.ts:35`, `boot/standalone.ts:27` with `setVlibrasSay` at `:151`, `tests/announce.browser.test.ts:21`).
- `ui/vlibras` — `game-platformer` (`app/js/main.ts:166`: all six, `setOnLibrasChange(layout)` at `:2074`, `vlTick` on a
  250 ms interval at `:2075`); `game-soccer` (`app/js/boot/main.ts:47`: its own Libras button toggles, `vlibrasSay` beside
  its captions, `vlTick` each frame; `tests/libras.browser.test.ts:21`); `pixi-15-puzzle` (`app/js/boot/standalone.ts:28`,
  `vlibrasSay` into the announcer and `vlTick` each frame). `game-2048`, `game-chess`, `game-pinball` and
  `game-whackwhack` never signed, and still do not.
- `startLoop` — `game-chess` (`app/js/boot/standalone.ts:104`), `game-platformer` (`src/standalone.ts:78`), `game-soccer`
  (`app/js/boot/main.ts:1065`, which passed NO notice and relied on the registration), `game-whackwhack`
  (`app/js/boot/standalone.ts:229`), `pixi-15-puzzle` (`app/js/boot/standalone.ts:212`).
- `core/rng` — `game-platformer`'s `render/draw.ts:67`, `render/fx.ts:10` and `render/weather.ts:13` read `rngDecoracao`;
  no game reads the shared four. The other imports are `createRng` and the `Rng` type, which stay.
- `initPauseIcons` and `initDebugPanel` — `game-platformer` only (`app/js/main.ts:1241`, passing no `doc`; `:2323`).
- `mountPanel` — no game.

## CZ · ADR-0232 D4-B2: the settings store becomes a factory (issue #207)

**Who is affected:** a game that imports anything BY VALUE from `@the-inclusionist/engine/core/state.js` — a setting's
live binding (`blindMode`, `vizMode`, `oneButton`, …), a setter (`setXValue`), `initVizMode`, the bus (`on`, `off`,
`emit`) or `loadState`. The types stay: `GameEvent` (and a game's `declare module` augmentation of it), `LetterCase`,
`OutlineLevel`, `GateTile` and `StatePort`.

📌 **Why:** the module held the page's settings in twenty module-level bindings and one subscriber map, so two roots on one
page — and two test files — shared them (ADR-0142, ADR-0232 D3). The store is now built by the root, over the storage its
host lends, and a game reads the ROOT's store. A second store built over the same storage would read the child's saved
choices but hear none of the root's changes, so a game must not build its own.

| was | is |
|---|---|
| `import { blindMode, vizMode, … } from '…/core/state.js'` (live bindings) | `engine.settings.blindMode`, `engine.settings.vizMode`, … — live getters on the store `createGame` returns |
| `import { setBlindModeValue, … } from '…/core/state.js'` | `engine.settings.setBlindModeValue(…)`, … — same names, same three effects (store, persist, tell) |
| `initVizMode(mode)` | `engine.settings.initVizMode(mode)` |
| `on` / `off` / `emit` | `engine.settings.on` / `.off` / `.emit` — the root's bus; a game's own events (declaration merging on `GameEvent`) travel on it as before |
| `loadState(port)` | `createSettingsStore(port)` — the root calls it; a game does not (`Engine.settings` is additive) |
| the error «wrote a setting before loadState» | gone: a store cannot exist without its port, so there is no «before the load» to write in |

⚠️ **Reading a setting by destructuring freezes it:** `const { blindMode } = engine.settings` copies the value of that
moment, as copying a live binding into a local did. Read `engine.settings.blindMode` where the value of now is wanted.
The setters and the bus hold no `this` and can be destructured.

📏 **Measured in the seven games, read-only, as information** (`git grep "engine/core/state.js'"`):
- `game-platformer` — `app/js/main.ts:45` imports 24 names (`emit`, `vizMode`, `initVizMode`, `modoCego`,
  `setModoCegoValue`, `caneBlockDiv` and the other settings with their setters, `menuIndexOn`, and `defaultReducedMotion`,
  which already moved to `core/setting-defaults`); `game/coin-spawning.ts:12` and `game/level-geometry.ts:17` import
  `vizMode`; `game/state.ts:29` imports `emit` and augments `GameEvent` (the augmentation keeps working);
  `ui/activities-menu.ts:69` imports `menuIndexOn`; `tests/state-bus.node.test.ts:19` imports `on`/`emit`/`off`.
  `core/run-state.ts:32` imports only the type `GateTile`, which stays.
- `game-pinball` — `app/js/main.ts:110` imports the namespace and reads `modoCego` and `setModoCegoValue`.
- `game-soccer` — `app/js/boot/main.ts:46` imports the namespace (reads `captionsOn`) and `:53` imports `oneButton`;
  `tests/boot.browser.test.ts:19` imports `setOneButtonValue` and `tests/captions.browser.test.ts:22` imports
  `setCaptionsOnValue` and `captionsOn`.
- `game-2048`, `game-chess`, `game-whackwhack` and `pixi-15-puzzle` import nothing from `core/state`.

(The `modoCego` names are the 9.0.0 names these games are pinned at; the store carries today's, `blindMode` and
`setBlindModeValue`.)
## DA · ADR-0232 D4-B3: the input state, keyboard config, pad tables and pad maps become factories (issue #207)

**Who is affected:** a game that imports anything BY VALUE from `input/state.js` (the held keys, the pad frames, `held`,
the key doors, the transport automaton), the live map or its doors from `input/keyboard.js` (`kb`, `initKB`, `setKB`,
`resetKB`, `registerKeyboardMapping`), `input/pad-defaults.js`'s `padTable`/`registerPadMapping` or `input/pad-wizard.js`'s
`padMap`; or that builds a `GamepadCtx`, `PadWizardCtx`, `LatchedEdgeOptions` or `TouchCtx` by hand. A game that only calls
`createGame` changes nothing in what the root mounts.

📌 **Why:** all of it was one per page — a module `Set`, three `Record`s of pad frames, the per-player automaton, the live
key map, two mapping registrations and two memos — so a second root read and wrote the first one's held keys, a pad's
previous frame, the child's device and the stored pad maps (ADR-0142), and two test files inherited each other's. The root
now builds one of each and hands it down; a game reads the ROOT's through two additive handles. The registrations went for
the D2b erratum's reason: a registration is module state a second root overwrites, and what once justified it — the
controls panel resetting without the declaration at hand — is answered by a config built WITH the mapping.

| old | new | migration |
|---|---|---|
| `input/state.js` `keys`, `keySource`, `markKey`, `markKeyWithoutSource`, `markKeyFrom`, `releaseKey`, `releaseAllKeys`, `letGoOfTheKeyboard`, `sourceOf`, `inputOf`, `playerEdge`, `enableAssistedFor`, `disableAssistedFor`, `forgetInputs`, `padCur`, `padPrevAct`, `padPrevStart`, `held` | removed as module exports. `createInputState()` returns a `LiveInput` with the same eighteen as members, same names and same behaviour (the containers are still mutated in place) | under `createGame`: `engine.input.keys`, `engine.input.held(pl, act)`, `engine.input.padCur`, … (new, below) — the methods hold no `this` and can be destructured: `const { held, keys } = engine.input`. A game that is its own root: `const input = createInputState()` once, and hand it to everything below |
| `input/state.js` `PAD_DEAD` | removed; the dead zone is internal to `input/pad-reading`, the reading that uses it | nothing reads it outside the engine |
| `input/keyboard.js` `kb`, `initKB(store)`, `setKB(next)`, `resetKB(store)`, `registerKeyboardMapping(f)` | removed. `createKeyboardConfig({ store, mapping })` returns a `KeyboardConfigApi`: `kb()` (the live map), `set(next)`, `save(conf?)` (the live map when omitted), `reset()` (erases the stored map, returns the GAME's default — it does not replace the live map, as `resetKB` did not), `factoryWithGame()`, `load()`. Both options are REQUIRED; `mapping` is the game's `KeyboardMapping` or `null` | under `createGame`: `engine.keyboardConfig` (new, below) — `kb` → `engine.keyboardConfig.kb()`, `setKB` → `.set`, `saveKB(store, conf)` → `.save(conf)`, `resetKB(store)` → `.reset()`, `factoryWithGame()` → `.factoryWithGame()`. Its own root: `const config = createKeyboardConfig({ store, mapping: declaration.keyboardMapping ?? null }); config.load()` |
| `input/keyboard.js` `factoryWithGame()`, `loadKB(store)` | `factoryWithGame(mapping)`, `loadKB(store, mapping)` — the mapping is a REQUIRED parameter (`null` = the engine's factory); `saveKB(store, kb)` and `KB_DEFAULTS` are unchanged | pass the game's mapping, or use the config's members above |
| `input/pad-defaults.js` `padTable(players, seat)`, `registerPadMapping(f)` | removed. `createPadTable(mapping)` returns a `PadTableFor` — `(players, seat) => PadTable` — with its memo inside; one table per mapping | `createPadTable(declaration.padMapping ?? null)` |
| `input/pad-wizard.js` `padMap(store, id)` | removed. `createPadMaps(store)` returns a `PadMaps`: `padMap(id)`, `store(id, map)`, `skip(id)` — the cache of stored maps, one per root | build ONE and hand it to the wizard and the gamepad, so a map the wizard saves is the one the pad reads next frame |
| `input/pad-wizard.js` `PadWizardCtx.store` | replaced by a REQUIRED `maps: PadMaps` | `createPadWizard({ ...ctx, maps })` |
| `input/gamepad.js` `GamepadCtx.store` | replaced by three REQUIRED ports: `padMaps: PadMaps`, `padTable: PadTableFor` and `input: Pick<LiveInput, 'padCur' \| 'padPrevAct' \| 'padPrevStart'>` — the pad's frames are written THERE | `initGamepad({ ...ctx, padMaps, padTable: createPadTable(mapping), input: engine.input })` |
| `input/latch-edge.js` `LatchedEdgeOptions` | gains a REQUIRED `input: Pick<LiveInput, 'playerEdge' \| 'inputOf'>`: the automaton the edge records into | `createLatchedEdge(() => players, { store, input: engine.input })` |
| `input/touch.js` `TouchCtx.win` | REQUIRED (was optional, falling back to the global): the window whose `resize` re-measures the pad; `null` for a host with none | `initTouch({ ...ctx, win: window })` |

The additive half, on the `gameSpeed`/`menuIndexOn`/`t` precedent: **`Engine.input`** (the root's `LiveInput` — the keys its
transports hold, the pads it polls, the device each child is on) and **`Engine.keyboardConfig`** (the root's
`KeyboardConfigApi` — the map its keyboard conductor, its virtual controller and its controls panel read). `keyboardConfig`
exists because a game still WRITES the keyboard config: `game-2048` mounts its own remapping screen over the engine's map.

📏 **Measured in the seven games, read-only, as information** (under the 9.0 names they are pinned at):
- `game-2048` — `src/standalone.ts:25` imports the factory-with-game reader, `kb`, `resetKB`, `saveKB` and `setKB`, and
  hands them to its own `initSettingsControls` (228-238). On the bump: `kb` → `motor.keyboardConfig.kb()`, `setKB` →
  `motor.keyboardConfig.set`, the store's `saveKB` → `motor.keyboardConfig.save(conf)` (after its own null filter, as
  today), `resetKB` → `motor.keyboardConfig.reset`, and the default scheme → `motor.keyboardConfig.factoryWithGame().solo`.
  `tests/keyboard-save.node.test.ts` reads only `KB_DEFAULTS` (unchanged); `padPxPerMm` from `input/touch` is pure and
  unchanged.
- `game-platformer` — its own root (it calls no `createGame`): `app/js/main.ts:74` (`kb`, `initKB`, `setKB`, `saveKB`,
  `resetKB`, `fabricaComOJogo`; `initKB()` at 541), `:96` (`keys`, `padCur`, `padPrevAct`, `held`, the key doors), `:97`
  and 593 (`criarArestaComAlternancia` — now needs `input`), `:1640` (`initGamepad` — now `padMaps`, `padTable`, `input`),
  `:1876` (`initTouch` — now `win`); `app/js/game/physics.ts:28` imports `held`; `tests/physics.node.test.js:13` and
  `tests/physics-golden.node.test.js:16` import `keys`. It builds `createInputState`, `createKeyboardConfig`,
  `createPadTable` and `createPadMaps` once and passes the same `input` to its physics.
- `game-soccer` — `app/js/boot/main.ts:42` imports `padCur` (read at 793) and mounts its own `initGamepad` (466) and
  `criarArestaComAlternancia` (543) beside `createGame` (166): read `motor.input.padCur`, and hand its gamepad
  `input: motor.input` so the frames it polls are the ones it reads. `tests/boot.browser.test.ts:18` imports `padCur`.
- `game-pinball` — `tests/shell-cabinet-declaration.node.test.ts:30` imports `registrarMapeamentoDoTeclado` and `resetKB`:
  `createKeyboardConfig({ store, mapping }).reset()` or `factoryWithGame(mapping)`.
- `game-chess`, `game-whackwhack` and `pixi-15-puzzle` import none of this.

## DB · ADR-0232 D4-B4: audio and speech receive the browser (issue #207)

**Who is affected:** a game that imports anything BY VALUE from `@the-inclusionist/engine/platform/audio.js` except
`noiseBuffer`, that calls `platform/speech`'s `gameSay`, or that builds a `SonarCtx`, `TtsCtx`, `KokoroRuntimeDeps` or
`EmpathySettingsCtx` by hand. A game that only calls `createGame` changes nothing in what the root mounts: the root makes
the audio context, the speech port, the clock and the Kokoro loader from `host.win` and hands them down.

📌 **Why:** `platform/audio` held one audio context, one master, one mixer and one step counter per page, in module
`let`s, so two roots on one page shared them (ADR-0142, ADR-0232 D3); and `platform/audio`, `speech`, `audio-sonar`, `tts`
and `kokoro-runtime` reached `window`, `document`, `performance`, `SpeechSynthesisUtterance`, `fetch` or `WebAssembly`
(ADR-0232 point 2). The audio becomes a factory the root builds; `gameSay`, a helper that holds nothing, takes what it uses
as a parameter and stays a function (erratum D3 point 2); every port that fell back to a global is now REQUIRED
(ADR-0224/0227, erratum D2b). The Kokoro loader moved into the root, so `platform/tts` no longer imports
`platform/kokoro-runtime` — it is still loaded by `import()` at the first neural utterance, never before.

| old | new | migration |
|---|---|---|
| `platform/audio.js` `soundOn`, `volume`, `audioCtx`, `hearingLoss`, `audioCat`, `_footCount` (live bindings) and `setSoundOn`, `setVolume`, `ensureAC`, `audioOut`, `setHearingLossGraph`, `setMasterMuted`, `catNode`, `setCatGain`, `tone`, `tonePan`, `noiseHit` | removed as module exports. `createAudio({ newContext, store })` returns an `Audio`: the six reads as live GETTERS (`_footCount` → `footCount`) and the eleven functions as members, with no `this` (they can be destructured). `newContext: () => AudioContext \| null` is called at the FIRST sound, never at construction. `noiseBuffer` stays; `AudioDeps`, `Audio` and `CatState` are new types | under `createGame`: `engine.audio` (new, below) — `engine.audio.ensureAC()`, `engine.audio.audioCat.tts.on`, `engine.audio.soundOn`. A game that is its own root builds one: `const audio = createAudio({ newContext: () => new AudioContext(), store })` |
| `platform/audio.js` `initAudioMixer(store)` | removed: `createAudio` reads the mixer from its `store` as it is built, so `audioCat` is never `null` and «the mixer before the voice» is the order of construction | pass the store to `createAudio` |
| `platform/speech.js` `gameSay(text)` | `gameSay(voice, text)` — `voice: GameVoice` = `{ synth(): SpeechSynthesis \| null; utterance(text): SpeechSynthesisUtterance; soundOn(): boolean; volume(): number }`. `SpeechPort` (the first two) and `GameVoice` are new types | `gameSay({ synth: () => window.speechSynthesis ?? null, utterance: (t) => new SpeechSynthesisUtterance(t), soundOn: () => audio.soundOn, volume: () => audio.volume }, text)` — build the voice once and close over it |
| `platform/audio-sonar.js` `SonarCtx` | gains a REQUIRED `newContext: () => AudioContext \| null` — the per-player context a child with an audio device of their own is routed through (it read `window.AudioContext`) | pass the same maker your `createAudio` receives |
| `platform/tts.js` `TtsCtx` | gains REQUIRED `speech: SpeechPort` (it read `window.speechSynthesis` and `SpeechSynthesisUtterance`) and `now: () => number` (it read `performance.now`); `createAudio: () => HTMLAudioElement` and `loadKokoro: LoadKokoro` become REQUIRED (they defaulted to `document.createElement('audio')` and to the engine's own loader) | `speech` as in the `gameSay` row, `now: () => performance.now()`, `createAudio: () => document.createElement('audio')`, and `loadKokoro: () => import('@the-inclusionist/engine/platform/kokoro-runtime.js').then((m) => m.loadKokoroRuntime({ base: document.baseURI, fetch: (u) => fetch(u), compileWasm: (b) => WebAssembly.compile(b), instantiateWasm: (m2, i) => WebAssembly.instantiate(m2, i) }))` — keep it an `import()`, or espeak-ng and the ONNX runtime enter your bundle |
| `platform/kokoro-runtime.js` `KokoroRuntimeDeps` | `fetch`, `compileWasm` and `instantiateWasm` become REQUIRED (they defaulted to the page's `fetch` and `WebAssembly`); `importModule` stays optional (`import()` is not a global) | see the loader in the row above |
| `ui/settings-empathy.js` `EmpathySettingsCtx` | gains a REQUIRED `hearing: Pick<Audio, 'hearingLoss' \| 'setHearingLossGraph'>` — the button, the mark, the reset and the boot restore read the ROOT's sound (they imported the page-wide one) | pass your `Audio` itself: a copied `hearingLoss` would freeze the button |

The additive half, on the `gameSpeed`/`menuIndexOn`/`t` precedent: **`Engine.audio`**, the root's `Audio` — the one its
voice, sonar, hearing and sound panels and empathy panel use, so what a game switches through it is what the child hears.
A game must not build a second one under `createGame`: it would make a second context and a second mixer, deaf to the
panels.

📏 **Measured in the seven games, read-only, as information:**
- `game-pinball` — `app/js/main.ts:92` imports `ensureAC` (called at 1057, 1973 and 1982) → `engine.audio.ensureAC()`;
  `tests/the-game-speaks.browser.test.ts:16` imports `audioCat` and switches `audioCat.tts.on` → `engine.audio.audioCat`.
- `game-soccer` — `app/js/boot/main.ts:45` imports the namespace, calls `mixer.initAudioMixer()` (602; the 9.0 shape, with
  no store) and reads `ensureAC`, `catNode`, `audioOut`, `noiseHit`, `tone`, `soundOn` and `volume` (628-636) → drop the
  init and read the same names on `motor.audio`.
- `game-platformer` is its own root (it calls no `createGame`): `app/js/main.ts:98` imports nineteen names of
  `platform/audio` (`initAudioMixer`, `_footCount` and `noiseBuffer` among them), `:99` `gameSay` (handed to
  `game/quiz.ts` as `c.gameSay`), `:102` `createAudioSonar`, `:105` `createTts` and `:85` `initSettingsEmpathy` — it builds
  `createAudio({ newContext, store })`, a `GameVoice` for `gameSay`, and passes `newContext`, the four `TtsCtx` ports and
  `hearing: audio`. `app/js/platform/audio-nav.ts:27` imports only types of `audio-sonar`, which keep their shape.
- `game-2048`, `game-chess`, `game-whackwhack` and `pixi-15-puzzle` import none of these modules.

## DC · ADR-0232 D4-B5: heavy files and the recognisers receive the browser (issue #207)

**Who is affected:** anyone who calls the functions below outside `createGame`, or builds one of the deps listed by hand. A
game that only calls `createGame` changes nothing: the root reads `caches`, `fetch`, `crypto.subtle`, the microphone, the
audio context, the clock and the worker from `host.win`, and hands them down.

📌 **Why:** outside the composition root a module reaches no browser global (ADR-0232 point 2). These modules held no state
of their own; each was in the stateful set only because an optional port fell back to the global (`d.fetch ?? fetch`,
`typeof caches !== 'undefined' ? caches : …`). A port that falls back to the global is the global reached one step later, and
a game that forgets it silently gets the page's instead of its root's (ADR-0224/0227, erratum D2b): so each port is now
REQUIRED. Where the host may genuinely lack the thing (an insecure context has no `caches` or `crypto.subtle`), the port is
required and may carry the absence (`undefined` as the window answers it, `null` for a digest), which keeps the answer the
module already gave: every file reported, nothing kept unverified.

| old | new | migration |
|---|---|---|
| `platform/heavy.js` `downloadHeavy(options = {})` | `downloadHeavy(options)` — `HeavyOptions.cacheStorage: CacheStorage \| undefined`, `fetch: typeof fetch \| undefined`, `digest: ((body) => Promise<string>) \| null` and `base: string` are REQUIRED keys; nothing defaults to `caches`, `fetch`, `crypto` or `location` | `downloadHeavy({ only, cacheStorage: window.caches, fetch: window.fetch.bind(window), digest: sha256With(window.crypto?.subtle), base: document.baseURI })` — or let `createGame` download (its `downloadHeavy` option, unchanged) |
| `platform/heavy.js` `sha256Hex(payload)` | removed: `sha256With(subtle)` answers the digest function for the `subtle` it is handed, or `null` without one | `sha256With(crypto.subtle)(payload)` |
| — | `platform/heavy.js` `checkedCacheHas(cacheStorage)` (new): whether a catalogue file is in the checked cache — the question the vision and command loaders ask | pass it as `hasFile` below |
| `platform/vision.js` `VisionDeps.hasFile` | REQUIRED (it defaulted to reading the global `caches`) | `loadFaceTracker({ base, hasFile: checkedCacheHas(window.caches) })`, the same for `loadHandTracker` |
| `ui/eye-control.js` `EyeControlDeps` · `ui/face-control.js` `FaceControlDeps` · `ui/hand-control.js` `HandControlDeps` | each gains a REQUIRED `hasFile`, which the control hands to its tracker's loader | pass `checkedCacheHas(window.caches)` |
| `platform/vosk-runtime.js` `VoskDeps.hasFile`, `VoskDeps.loadBundle` | both REQUIRED; the module no longer reads `caches`, and no longer keeps the page-wide memo of loaded bundles | `hasFile: checkedCacheHas(window.caches)`, `loadBundle: createBundleLoader((url) => import(url))` — build the loader ONCE and reuse it, which is what keeps the bundle loaded once per address |
| — | `platform/vosk-runtime.js` `createBundleLoader(load)` (new): the once-per-address loader, its memo per instance (a rejection is forgotten, so a failed load can be retried) | see the row above |
| `platform/voice-listener.js` `VoiceListenerDeps.getUserMedia`, `createContext` | both REQUIRED; `getUserMedia` may be `undefined`, which is a device with no microphone and is refused as before | `getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices)`, `createContext: () => new AudioContext()` |
| `ui/voice-control.js` `VoiceControlDeps` | gains REQUIRED `hasFile`, `loadBundle`, `getUserMedia` and `createContext`, handed to the recogniser's loader and to the listener | pass the four above |
| `platform/microphone.js` `createMicrophone(d = {})` | `createMicrophone(d)` — `MicrophoneDeps.getUserMedia` (may be `undefined`: no microphone, refused as before), `createContext` and `now` are REQUIRED | `createMicrophone({ getUserMedia: navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices), createContext: (rate) => new AudioContext({ sampleRate: rate }), now: () => performance.now() })` |
| `platform/reading-in-worker.js` `ReadingInWorkerDeps.spawn` | REQUIRED; the module no longer opens `reading-worker.js` itself | `spawn: () => new Worker(new URL('<path to>/platform/reading-worker.js', import.meta.url), { type: 'module' })` — written in exactly this form in YOUR module, or your bundler will not emit the worker's file |
| `platform/reading-runtime.js` `ReadingRuntimeDeps.fetch` | REQUIRED | pass your realm's `fetch`: `(url) => window.fetch(url)` |
| `platform/reading-worker.js` `WorkerScope` | gains `fetch(url)`, the worker realm's own, which `serveReading` hands to the runtime | a real `self` has it; a test double needs one |

📏 **Measured in the seven games, read-only, as information:** `pixi-15-puzzle` calls the download itself
(`app/js/boot/standalone.ts`, under the 9.0 names `baixarPesados({ apenas })` from `platform/pesados.js`): on the bump it
must pass the four ports, as in the migration above. The other six only set `createGame`'s `downloadHeavy: false` (9.0:
`baixarPesados: false`), which is unchanged. No game calls `sha256Hex`, the vision or command loaders, the voice listener,
the microphone, the reading runtime or its thread, or builds a camera or voice control's deps: the reading reaches games
through `engine.reading`, which is unchanged.

📌 **The worker's literal moved into `createGame`, and the root's reach to globals did NOT grow for it.** A bundler emits the
worker's file only for `new Worker(new URL('…', import.meta.url), { type: 'module' })` written out, so the literal has to sit
where the thread is opened. In the root the `Worker` it names is a LOCAL holding `host.win.Worker`: the bundler reads the
name, the value is the host's, and the code-health measure sees injection. Measured: `npm run build` still emits
`dist/assets/reading-worker-*.js`, now referenced from the root's chunk; the same build with the address written as a plain
string emits none, and the browser case that opens the thread through `createGame` goes red.

## DD · ADR-0232 D4-B6: render and layout become factories (issue #207)

**Who is affected:** a game that imports `render/canvas`'s canvas makers, `render/sprite-fx`'s `spriteToCanvas`, or
anything stateful from `render/crt`, `render/lq-filter`, `render/high-contrast`, `ui/layout` or `ui/settings-motion`, or
builds a `ViewportsCtx`, `VizSettersCtx` or `SettingsMotionCtx` by hand. A game that only calls `createGame` changes
nothing in what the root mounts: the root builds its own CRT and L→Q enhancement and hands them down.

📌 **Why:** outside the composition root a module imports by value only what holds no state and reaches no global
(ADR-0232). The CRT config, the L→Q amount, the high-contrast palette and texture caches, the layout's player-count getter
and the motion panel's selected player were one per page (module `let`s and mutated constants), so a second root read and
wrote the first one's; and `render/canvas`, `render/crt`, `render/lq-filter` and `ui/layout` reached `document`, `window` or
`location`. The helpers that hold nothing take the document as a parameter and stay functions; the modules that hold state
become factories. 📏 One defect this cures, measured in the node suite: under an injected document (`host.doc`), the root's
CRT looked `#game-region` up in the GLOBAL document, so it drew on the page's region or on none — never on the injected one.

| old | new | migration |
|---|---|---|
| `render/canvas.js` `makeCanvas(w, h)` · `pixelCanvas(w, h, paint)` · `pixelTexture(w, h, paint)` | each takes the document FIRST: `makeCanvas(doc, w, h)`, `pixelCanvas(doc, w, h, paint)`, `pixelTexture(doc, w, h, paint)`; the new type `CanvasDoc` is `Pick<Document, 'createElement'>`. `tex` and `pixDisc` are unchanged | pass your root's document: `makeCanvas(doc, 16, 16)` |
| `render/sprite-fx.js` `spriteToCanvas(art)` | `spriteToCanvas(doc, art)`; `outlineCanvas(src, thick)` keeps its shape and makes its canvases in `src.ownerDocument` | pass your root's document first |
| `render/crt.js` `CRT`, `initCrt(deps)`, `applyCrt()`, `crtScanVars()` | removed. `createCrt({ region, win, numPlayers, a11yVisualOn, store })` returns a `Crt`: `cfg` (the live config), `apply()`, `scanVars()`. `region` is a getter for `#game-region`; `win` gives the pixel ratio. `CRT_DEFAULT` stays; `CrtCfg`, `CrtCtx` and `Crt` are new types | under `createGame`: use `engine.crt` (new, below) — `engine.crt.cfg` for `CRT`, `engine.crt.apply()` for `applyCrt()`. A game that is its own root builds one: `const crt = createCrt({ region: () => doc.querySelector('#game-region'), win, numPlayers, a11yVisualOn, store })` |
| `render/lq-filter.js` `initLqFilter(ctx)`, `setLq(t)`, `getLqT()`, `lqFilter()`, `ensureLqFilter()` | removed. `createLqFilter({ doc, onChange, store })` returns an `LqFilter`: `filter()`, `t()`, `set(t)`; the `<filter>` node is created in `doc`. `LqFilterCtx` gains a REQUIRED `doc`. `lqCurve` and `lqName` stay pure | under `createGame`: `engine.lq` (new) — `engine.lq.set(t)`, `engine.lq.t()`, `engine.lq.filter()`. Its own root: `createLqFilter({ doc, onChange, store })` |
| `render/high-contrast.js` `HC_ROLE`, `saveHcRole`, `initHighContrast`, `worldToTextureDirect`, `directBgTexture`, `directSpriteCanvas`, `directSpriteTexture`, `worldTexFor`, `spriteTexFor`, `clearWorldTexCache`, `clearSpriteTexCache` | removed as module functions. `createHighContrast(ctx)` returns a `HighContrast` with the same ten as members (`HC_ROLE` → `role`, `saveHcRole` → `saveRole`); `HighContrastCtx` gains a REQUIRED `doc: CanvasDoc`. `DIRECT_CFG`, `dcfg`, `dimDesat`, `HC_ROLE_DEF` and `HC_ROLE_KEYS` stay; `RolePalette` and `DirectTexSource` are now exported. **`createGame` does not build one** — the root has no world; a game that draws a tile world does | `const hc = createHighContrast({ ...yourCtx, doc })`, then `hc.role[k] = rgb; hc.saveRole()`, `hc.spriteTexFor('coin', mode)`, `hc.clearWorldTexCache()` |
| `render/viewports.js` `ViewportsCtx` | gains REQUIRED `doc: CanvasDoc` (the low-vision overlay's canvas) and `hc: Pick<HighContrast, 'directBgTexture' \| 'directSpriteTexture'>` | pass your document and the world's `HighContrast` |
| `render/viz-setters.js` `VizSettersCtx` | gains REQUIRED `hc: Pick<HighContrast, 'worldTexFor' \| 'spriteTexFor' \| 'clearWorldTexCache' \| 'clearSpriteTexCache'>` and `lqFilter: () => string` | pass the world's `HighContrast` and your `LqFilter`'s `filter` |
| `ui/layout.js` `initLayout(deps)`, `layout()` | removed. `createLayout({ doc, win, numPlayers, afterScale, debug? })` returns a `Layout` with `layout()`. `afterScale` is REQUIRED: it runs after every scale, and is what re-anchors the scanlines — `layout()` used to call the page's one CRT by import. `debug` (optional) replaces reading `?debug=true` from `location`. `stageScale`, `applyScale`, `minimumTarget`, `belowFloor` and `barIntruders` stay pure; `LayoutCtx`, `LayoutDoc` and `Layout` are new types | see «how a game gets `afterScale`» below |
| `ui/settings-motion.js` `getSelectedPlayer()`, `setSelectedPlayer(i)` | removed. The selected player lives in the panel: `SettingsMotionApi` gains `selectedPlayer()` and `setSelectedPlayer(i)` | `const motion = initSettingsMotion(ctx); motion.setSelectedPlayer(i)` |
| `ui/settings-motion.js` `SettingsMotionCtx` | gains a REQUIRED `crt: Pick<Crt, 'cfg' \| 'apply'>` — the three CRT rows read and write that config | pass your root's CRT (`engine.crt` under `createGame`) |

**How a game gets `afterScale` now.** Under `createGame`, the root ALREADY scales `#game-region` and re-anchors the CRT on
every `resize` (its `applyResolution`), so a game that calls `layout()` only repeats it; it can drop the call. A game that
keeps its own scaler passes the root's CRT: `createLayout({ doc, win, numPlayers: () => 1, afterScale: engine.crt.scanVars
}).layout()`. A game that is its own root passes the `scanVars` of the CRT it built, or `() => {}` if it has none.

The additive half, on the `gameSpeed`/`menuIndexOn`/`t` precedent: **`Engine.crt`** (the root's `Crt`) and **`Engine.lq`**
(the root's `LqFilter`) — the instances the root's own motion and visual panels and its world-filter recomposition use, so
what a game does through them reaches the world.

📏 **Measured in the seven games, read-only, as information:** `game-2048` imports `initLayout` and `layout`
(`app/js/boot/main.ts:15`, called at 183-185 with a `resize` listener) and has `ctx.engine`, so `engine.crt.scanVars` is
its `afterScale` — or it drops the call. `pixi-15-puzzle` does the same (`app/js/boot/standalone.ts:30`, called at
197-199) and holds `engine` from its own `createGame` (line 91). `game-platformer` is its own root (it calls no
`createGame`): it imports `initLayout`/`layout` (`app/js/main.ts:167`, 225, 2076), `CRT`/`applyCrt`/`initCrt` (164,
229, 1222), `lqFilter`/`setLq`/`getLqT`/`initLqFilter` (115, 883), eight names of `render/high-contrast` (120; `HC_ROLE`
written at 1805-1812), `setSelectedPlayer` of `ui/settings-motion` (87, 2106), `initViewports` and `initVizSetters` (144,
147), `spriteToCanvas` (`app/js/render/textures.ts:10`) and `makeCanvas`/`pixelCanvas`/`pixelTexture` in nine files
(`main.ts`, `game/props.ts` and seven under `render/`) plus `tests/city-tex.node.test.js` — it builds `createCrt`, `createLqFilter`, `createHighContrast` and `createLayout`
itself, with `afterScale: crt.scanVars`, and passes `doc` to every canvas maker. `game-whackwhack` and `pixi-15-puzzle`'s cartridge
import only pure functions of `render/viz-setters`, which keep their shape; `game-chess`, `game-pinball` and `game-soccer` use none of this.

## DE · ADR-0232 D4, the final sweep: the page-wide selectors leave (issue #207)

Every module now queries the document it is given, and the root builds its own `$` over the host's document. The two
selectors that read the page-wide `document` were the last global reach outside the root, so they leave.

| before | after |
|---|---|
| `$`, `$$` from `core/dom-query` | removed; `core/dom-query` keeps only `type DomQuery` |
| `$`, `$$` from `ui/dom` | removed; query the document you hold (`doc.querySelector`, `[...doc.querySelectorAll(s)]`) |

Games (measured read-only): **game-platformer** imports `$` and `$$` from `ui/dom`; the other six do not.

## DF · Only ARASAAC and PCS, locked until licensed: the AAC catalogue changes shape (ADR-0233, issue #57)

**Who is affected:** a game that imports `ui/aac-sets` or reads the AAC menu's i18n keys. A game that mounts the AAC
panel with `initSettingsAac` changes no code: its context and API keep their shape, and the menu now draws the letters
switch plus two locked sets, in two sections instead of three.

📌 **Why:** the Dev settled the roster (ADR-0233): the only candidates are ARASAAC and PCS, each only once a licence is
obtained, and none is. The old tiers (`bundled`, `fetched`, `negotiating`) described sets that were never built or that
the project dropped, so the tier now says one legal fact — licensed or not — and a set with no recorded licence can never
be selectable (`tests/aac-sets.node.test.js`).

| old | new | migration |
|---|---|---|
| `AacTier` = `'bundled' \| 'fetched' \| 'negotiating'` | `'licensed' \| 'unlicensed'` | compare with `'licensed'`, or call `aacSelectable(s)` |
| `AacSet` (interface, `license: string \| null`, `available: boolean`) | a union: `tier: 'licensed'` with `license: string`, or `tier: 'unlicensed'` with `license: null`; `available` is gone | `aacSelectable(s)` for `s.available` |
| `AAC_SETS`, `AAC_BY_KEY`: eight sets | two, `arasaac` and `pcs`, both `unlicensed`; `mulberry`, `blissymbolics`, `tawasol`, `sclera`, `symbolstix` and `widgit` left | a lookup of a dropped key answers `undefined` |
| `aacReason(s)`: `'aac.emPreparo'` or `'aac.aguardandoNegociacao'` | `'aac.noLicence'`, or `null` for a selectable set | — |
| `AAC_SECTIONS`: three sections | two: `aac.secao.agora` (the letters) and `aac.section.pictograms` (every set) | — |
| i18n keys `aac.emPreparo`, `aac.aguardandoNegociacao`, `aac.secao.preparo(Tag)`, `aac.secao.negociacao(Tag)` | removed; `aac.noLicence`, `aac.section.pictograms(Tag)` are new | a game dictionary that overrode the old keys overrides the new ones |
| — | `aacSelectable(s)` (new): whether the child may choose the set | — |

📏 **Measured in the seven games, read-only, as information:** none imports `ui/aac-sets` or reads the AAC keys, under
the 9.0 names (`caa-sets`, `CaaTier`, `CaaSet`, `CAA_SETS`, `caaMotivo`, …) or the current ones. `game-platformer` mounts
the panel (`app/js/main.ts:83`, `initSettingsCaa` from `ui/settings-caa`, called at 1792): no code change, and on the bump
its menu shows ARASAAC and PCS locked with «sem licença» instead of eight sets. The other six use none of this.

📌 **Not breaking, and said here because it changes what `game-platformer` shows (ADR-0233 erratum):** the AAC menu's
DOOR is now disabled while no set is licensed. `initSettingsAac` marks the host's `[data-act="caa"]` with
`aria-disabled="true"` and `data-motivo` «Menu desabilitado», and its `open()` says that reason and opens nothing; on the
engine's pause card a `caa` item stays locked with the same reason even when the game hands over a `caa` action. Upper
case stays reachable through the quick bar's communication cycle (ADR-0151). New, additive: `aacMenuLocked()` in
`ui/aac-sets`.

## DG · ADR-0234: there is no Libras mode, there is a deaf mode

**Who is affected:** a game that reads `engine.libras`, builds `createLibras` from `@the-inclusionist/engine/ui/vlibras.js`
itself, or signed its announcements with `engine.mirrorAnnouncements(engine.libras.say)`.

📌 **Why:** the Dev, 2026-09-25: «não existe modo libras, mas modo pessoa surda: sons ganham legenda e o sonar chama o
intérprete». The 🦻 is one setting that turns on two things: every interface sound is captioned, and the sonar hands the
text it would read aloud to an INTERPRETER, which signs it in front of the screen; with the mode off the sonar speaks, as
before. Written Portuguese is never removed. The interpreter answers the sonar when the child asks — it no longer signs
announcements, so the one-utterance queue and the `tick` latch are gone. Which player signs (self-hosting the VLibras player,
a free player, or the hosted widget) is the Dev's open choice; until then the root's interpreter answers «signing
unavailable», which goes to `problems` and to the child, and the captions and text keep working.

| was | is |
|---|---|
| `engine.libras.isOpen()` | `engine.deafMode.isOn()` |
| `engine.libras.toggle()` | `engine.deafMode.toggle()` |
| `engine.libras.say(text)` · `engine.mirrorAnnouncements(engine.libras.say)` | removed: the interpreter answers the sonar (`engine.sonar.sonar(player)`), not a queue of messages. `mirrorAnnouncements` stays, with no Libras sink to connect |
| `engine.libras.tick()` | removed: a choice restored from storage is on at boot, with nothing to latch |
| earcons gated on `engine.settings.captionsOn` | pass `engine.deafMode.captionsOn` as `createAudioEarcons`'s `getCaptionsOn` — captions on OR deaf mode on — and `engine.captionSound` as its `showCaption`, which writes under the same rule |
| `createLibras({ doc, win, store, now })` → `Libras` (`isOpen`, `toggle(t)`, `say`, `tick`, `onChange`) | `createDeafMode({ store, captionsSetting, t, interpreter, speak, caption, tell, report })` → `DeafMode` (`isOn`, `toggle()`, `captionsOn`, `sonar(text)`, `onChange`, `dispose`). `interpreter` is the new port `Interpreter` — `sign(text): Promise<SignResult>`, `hide()`, `dispose()` — and `NO_INTERPRETER` is the one the root injects today |
| types `Libras`, `LibrasPorts`, `LibrasStore` | `DeafMode`, `DeafModePorts`, `DeafModeStore`; new `Interpreter`, `SignResult`, `signingUnavailableLine` |

⚠️ **Unchanged, on purpose:** the stored key `incl_libras` — a child who left the mode on finds deaf mode on — and the bar's
`PauseIconsCtx.isLibrasOn`/`toggleLibras` names, which the root fills from deaf mode.

📏 **Measured in the seven games, read-only, as information:** no game uses `createLibras` or `engine.libras` — the names this
note changes. `game-platformer` (`app/js/main.ts:166`: `vlibrasSay`, `vlibrasOpen`, `toggleLibras`, `vlTick`, `librasOpen`,
`setOnLibrasChange`; the widget loaded by its own `app/index.html:443`), `game-soccer` (`app/js/boot/main.ts:47`:
`toggleLibras`, `vlibrasOpen`, `vlibrasSay`, `vlTick`; `tests/libras.browser.test.ts:21`; the widget in `app/index.html:186`) and
`pixi-15-puzzle` (`app/js/boot/standalone.ts:28`: `vlibrasSay`, `vlTick`, with `setVlibrasSay` at `:151`; the widget in
`app/index.html:69`) still import the module-level names note CY already removed — all three pin engine 9.x — so each meets
this note together with CY's. `game-2048`, `game-chess`, `game-pinball` and `game-whackwhack` never signed.

## DH · Thirty-three re-exports nothing in the engine imports stop being published (issue #204)

**Who is affected:** a game that imports one of the names below through the module that RE-EXPORTED it rather than the one
that declares it. Every name still exists — only the second path is gone. 31 of the 33 are types (a type error at build);
two are values, `edgeAllowed` and `HC_ROLE_KEYS` (an import error at build, or at load with no type check).

📌 **Why:** a published name that nothing inside the engine imports is debt, declared or deleted, and whoever consumes adapts
(the Dev, 22/09). The public-surface portrait used to leave re-exports out, so these paths were never weighed and deleting
one passed the surface gate green. The portrait now reads `export { … } from`, `export type { … } from` and `export { a, b };`
(the name after `as`), so the fifteen re-exports the engine does import are portrait entries, protected like any other.

| old path | name(s) | where the name still lives |
|---|---|---|
| `.` (`boot/create-game.js`) | `GamepadGameHooks` | `input/gamepad.js` |
| `.` (`boot/create-game.js`) | `FlashMeasurement` | `platform/flash-sampler.js` |
| `input/gamepad.js`, `input/keydown.js`, `input/touch-bindings.js`, `input/touch.js`, `ui/hud.js`, `ui/menu-nav.js`, `ui/settings-audio.js`, `ui/settings-controls.js`, `ui/settings-mobility.js`, `ui/settings-typo.js`, `ui/shell.js`, `ui/title.js` | `DomQuery` | `core/dom-query.js` |
| `input/keyboard.js`, `input/keyboard-runtime.js`, `input/keydown.js`, `input/touch-bindings.js`, `ui/settings-controls.js` | `KeyScheme` | `core/entity.js` |
| `input/gamepad.js`, `ui/menu-nav.js` | `NavKeys` | `input/edges.js` |
| `input/keydown.js` | `TitleNav` | `input/edges.js` as `NavKeys` — the same type under its own name |
| `input/keydown.js` | `edgeAllowed`, `EdgeFlag` | `input/edges.js` |
| `input/touch-bindings.js` | `RectLike` | `input/pointer-space.js` |
| `platform/heavy.js` | `HeavyFile` | `platform/heavy-catalogue.js` |
| `platform/tts.js` | `KokoroModule`, `KokoroSession` | `platform/kokoro.js` |
| `render/high-contrast.js` | `PaintableRole`, `HcRoleKey`, `HC_ROLE_KEYS` | `render/hc-role-data.js` |
| `ui/hud.js` | `ScreenGrid` | `core/screens.js` |
| `ui/shell.js` | `SceneFacts` | `core/scenes.js` |

**Migration:** change the import's path to the right-hand column; for `TitleNav`, `import type { NavKeys as TitleNav } from
'…/input/edges.js'` keeps your local name. What STAYS re-exported, because the engine imports it through that path:
`boot/create-game.VirtualCommand`, `input/keydown.EDGE_BY_ACTION` and `.hasTitleIntent`, `input/touch-bindings.TOUCH_EDGE_BY_ACTION`,
`platform/heavy.CACHE_HEAVY` and `.HEAVY_FILES`, `platform/tts.LoadKokoro`, `render/high-contrast.HC_ROLE_DEF`, `ui/hud.screenGrid`,
`ui/menu-nav.hasIntent` and `.stepInRing`, `ui/settings-typo.resolveFontKey` and `.persistFontKey`, `ui/visual-choices.RoleKey`
and `.lqLabel`.

## DI · ADR-0194 §2–§3: a menu item's name said by voice activates it

**Who is affected:** a game that builds `createVoiceControl` itself, calls `createVoiceCommands` from `input/voice-map`, or
implements `MenuNavApi` (a double of `initMenuNav`'s result). A game that lets `createGame` mount the 👄 changes no code: the
root wires all of this, and a name said in the pause card or a panel now activates the item.

📌 **Why:** the vocabulary's reader (`platform/speech-recognition.createCommandReader`) already implemented «a whole name
activates its item» and «on a partial a name another item's name continues waits for the end of the utterance», but only its
test imported it; the 👄 path put the open menu's names in the grammar and a heard name activated nothing. The 👄 now reads
what it hears through that reader, and a name is carried to its item the way every transport reaches a menu: the menu
navigation puts its cursor on the item, and the voice presses the menu's confirm position on the virtual controller.

| was | is | migration |
|---|---|---|
| `VoiceCommands.partial(text): Action \| null` | `partial(text): readonly VoiceCommand[]` — every command the partial completes | map `c.kind === 'position'` to `c.action` |
| `VoiceCommands.reset()` | `final(text): readonly VoiceCommand[]` — the end of the utterance, with its text: a name the partials held back is decided there, and the next partial starts afresh | call `final(text)` where `reset()` was called; `platform/voice-listener`'s `onFinal` now receives that text |
| — | `VoiceCommands.items(names)`: the open menu's names, as shown | call it whenever the menu changes; `[]` for a menu closed |
| — | `type VoiceCommand = { kind: 'position'; action } \| { kind: 'item'; name }` (new) | an `item` carries the name exactly as handed to `items` |
| `VoiceControlDeps` without a cursor | `pointAt(name): boolean`, REQUIRED | pass `(name) => nav.pointAt(name, 0)` from your `initMenuNav` result |
| `VoiceControlDeps.menuWords` read the top overlay's buttons | unchanged in shape; the root now answers it with `nav.itemNames(0)` | pass `() => nav.itemNames(0)` |
| `MenuNavApi` | gains `itemNames(playerIndex)` and `pointAt(name, playerIndex)` | a double of the API adds the two members |

⚠️ **Behaviour, not shape:** the names now enter the grammar with their accents («configurações», not «configuracoes», which
the small Vosk model drops); the grammar is refreshed when a card, one of its lists or a panel shows or hides (it was only
refreshed when the «N of M» setting changed, so no menu's names ever reached the recogniser); `spokenText` keeps digits.
And (ADR-0194 §5) `MenuNavApi.itemNames` now lists LOCKED items too, and `pointAt` reaches them: a locked item said by name is
confirmed like any other, and its own press says its reason and does nothing — a voice path of your own gets that for free.
New, additive: `ui/menu-intent.MENU_CONFIRM` (the menu's «yes» position, `action2`).

📏 **Not measured in the games:** this change was made without reading the sibling repositories. Before the bump, `git grep`
them for `createVoiceControl`, `createVoiceCommands`, `VoiceCommands` and `MenuNavApi` doubles.

## DJ · The session clock is one hour, with no setting — nothing to migrate (ADR-0236, ADR-0240, issue #94)

**Who is affected:** nobody who consumes a published version. Against `10.0.0`, `SettingsStore`, `GameEvent`, `DEFAULTS` and
`KEYS` are unchanged, and nothing is stored under a new key.

⚠️ **Why this note exists:** commit `bf489607` made the clock's length and ending stored settings and wrote a `BREAKING
CHANGE:` footer pointing here; the generated CHANGELOG carries that footer. Before any of it was published, ADR-0240 took it
back — the clock has no settings on the child's side — and the commit that removed them carries a footer that says so. Both
footers describe the same unpublished round trip, and this is what ships:

| new, additive | what it is |
|---|---|
| `core/session-clock` (new module) | the arithmetic of a one-hour session: `readSession(elapsedMs)` → `SessionReading` (`left`, `leftMs`, `minutesLeft`, `over`), `clockDigits(leftMs)` (hours only while there are hours), `clockWords(reading)` (the dictionary key and minutes of the accessible name) |

The clock always shows, always measures one hour from the mount and turns red at the end — no pulse, no lock, nothing in
`problems`. `incl_session_minutes` and `incl_session_ending` are never read or written. Where the clock sits and the
`ui/session-clock` module are note DK's.

## DK · The HUD is one row at the bottom, around the session clock (ADR-0239 and its erratum, ADR-0238, issue #94)

**Who is affected:** code that IMPLEMENTS `Engine` or `HudBandsMounted` (a hand-made double), and a page or game that relied
on where the engine drew a HUD band or on how much `--rodape-h` reserves. A game that only declares `hud` and reads
`--barra-a11y-h` and `--rodape-h` changes no code — its bands move with the engine.

📌 **Why:** the Dev reorganised the HUD into one row along the bottom of the game region, with Super Mario World's clock and
score as the visual reference: the learning bars at the left, the session clock centred (a label over the time left in
digits, the Time Timer pie to their right), the power over the score between the centre and the right, and a slot for the
game's map at the right. The mission sits at the top centre, just under the quick bar. The score is five digits with leading
zeros, clamped at 99999, and a listener hears the number («12 points»), never the zeros.

| was | is | migration |
|---|---|---|
| `Engine` | gains the REQUIRED `mapSlot: HTMLElement \| null` — the row's bottom-right cell; empty, it takes no room | a double of `Engine` adds it; a game with a map appends its element there. `unmount()` empties it |
| `HudBandsMounted` (`left`, `right`, `learning`) | gains the REQUIRED `points` (the identity band, the score); `left` holds the mission alone | a double adds `points` |
| `mountHudBands(t, doc, region, numbers, seat)` | an optional sixth argument, `row?: HudRowSlots` (`learning`, `score` cells); without it every band goes in the region as before | — |
| identity band: «Pontos: 12», top left | «00012» in the row, `role="img"` named «12 Pontos» (`hud.points`) | a game that styled `.hud-esquerda .hud-numero` for its points styles `.hud-points .hud-numero` |
| mission: top left, level with the bar | top centre, just under the bar (`ui/top-band` writes its `top`); the bar's momentary name line covers it while a name shows | — |
| power: top right | above the score, in the row | — |
| learning bars: centred in the footer | stacked at the row's left; the whole row is hidden while the explanation shows | — |
| `--rodape-h` = the footer's 2.6 lines + 8 px | the HUD ROW's room only: `--hud-row-h` plus `--hud-row-bottom` (the pad's lift). The caption, the legend and the explanation still stand above the row but are momentary and OVERLAY the workspace while they show (ADR-0239 erratum). The footer's own two lines are `--footer-band-h`, which the engine's panels keep free | a game's workspace that ends at `--rodape-h` ends LOWER (48 px at 640×360 with only the clock in the row, against 49.6 before); a game that must keep something clear of a showing caption reads `--footer-band-h` too |
| `TopBandCtx.hud: { left, right }` | `{ left }` — the right column is in the row and no longer room at the top | a caller that passes `right` may keep passing it; it is not read |
| — | new: `ui/hud-row` (`mountHudRow`, `reserveBottomBand`, `--hud-row-h`, `--hud-row-bottom`), `ui/session-clock` (`mountSessionClock`), `ui/hud-bands.fiveDigits`, the i18n keys `clock.label`, `hud.points` | — |

📏 **Measured in the seven games, read-only, as information:** none declares a HUD band, styles `.hud-*`, reads `--rodape-h`
or implements `Engine` or `HudBandsMounted`; each only receives an `Engine`. On the bump every one that has a `#game-region`
gains the row with the session clock at the bottom of it — drawn OVER the bottom of its world, since none reads `--rodape-h`
to end its workspace above it. That is the visible change each game meets.

## DL · The CRT asks two questions: the scanlines stay under the colour-vision modes (ADR-0241)

**Who is affected:** a game or page that builds `createCrt` itself. A game that lets `createGame` build it changes no code:
the root answers both questions, and under a colour-vision mode on its own the scanlines now stay.

📌 **Why:** the Dev, after testing the demo: «Modos de daltonismo estão tirando as scanlines sem necessidade.» A colour-vision
correction (🚥) or the simulation of the same colour blindness changes hue, not contrast or sharpness, so the scanline stays
under it; the vignette still yields to every visual mode, and the scanline still yields to every other one (ADR-0047).

| was | is | migration |
|---|---|---|
| `CrtCtx.a11yVisualOn: () => boolean` — both effects yield when it is true | `scanlineYields: () => boolean` and `vignetteYields: () => boolean`, both REQUIRED; each effect follows its own | pass your old answer to `vignetteYields`; for `scanlineYields`, the same answer AND NOT «a colour-vision mode is the only visual mode on» — `render/viz-axes.onlyColourVision(state)` answers that for a visual state |
| — | new: `render/viz-axes.onlyColourVision(state)` — a correction or a simulation of colour blindness, with the theme at its default; the list is `render/cvd-matrices.CVD_KEYS` | — |

⚠️ **Behaviour, not shape:** under `createGame`, the game's 🌗 high-contrast theme now makes both effects yield — the root
handed the game's writer straight through and never learned of the theme (ADR-0047's rule, which the root had not applied).

📏 **Measured in the sibling repositories, read-only:** no game builds `createCrt` or names `a11yVisualOn`.

## DM · The sonar reads what is on the screen now (ADR-0234)

**Who is affected:** every game that rings `engine.sonar.sonar(…)`, by what the child hears — no code has to change for it;
a game whose tests read `engine.problems` over a world with a `<canvas>` in it; and code that builds `createAudioSonar` or
`createVirtualController` itself, which may pass the two new optional members.

📌 **Why:** the Dev, testing the demo quiz: «O sonar não está lendo o que aparece na tela: a tela só é lida ao carregar.»
ADR-0234 decided «sonar do que está na tela» and it was never built: the sonar spoke the NAVIGATION sentence («Sonar: pergunta
1, aqui, bem perto»), and in deaf mode the interpreter was handed that sentence, not the screen.

| was | is | migration |
|---|---|---|
| the sonar's words: always the navigation sentence (the nearest target's name, side and distance) | the text ON SCREEN at the press when there is any: the dialog in front (the focused one, else the last open; `inert` layers skipped), else the declared world, in DOM order, one sentence per block — skipping what is not rendered, `aria-hidden`, and the engine's chrome (quick bar, footer, scan chip, pad, camera overlays, `.sr-only`, the session clock). The navigation sentence stays for a screen with no text the engine can read. The TONE is unchanged | none; a game that relied on the sentence naming its target hears its screen instead — that is the decision |
| R1 (`rightShoulder`) with a menu open: a key the menus ignored | the ENGINE's sonar: it reads the menu in front, spoken or, in deaf mode, captioned and signed | none |
| a world with a `<canvas>` (not the engine's own) | a line in `problems`: «the sonar cannot read this game's screen: its world draws on a <canvas>…» — the sonar keeps its navigation sentence there | a test that expects `problems` to be `[]` over such a world expects that line, or the game writes its words as page text in the world |
| — | `SonarCtx.screenText?: () => string`, `VirtualControllerDeps.menuAnswers?: (action, player) => boolean`, `EngineHost.interpreter?: Interpreter` (absent: `NO_INTERPRETER`), new module `ui/screen-text` (`screenText`, `unreadableWorldProblems`, `menuSonarPress`, `ScreenTextCtx`) — all additive | — |

📏 **Measured in the sibling repositories, read-only, as information:** `game-chess`, `game-pinball`, `game-soccer` (`app/js/boot/main.ts:590`)
and `game-2048` ring `engine.sonar.sonar`; `game-chess`, `game-pinball`, `game-whackwhack`, `game-2048` and `game-platformer`
declare an element world, and every one of the seven draws on a canvas somewhere (grep for `<canvas`/`createElement('canvas')`/a
PIXI application), so where the canvas sits inside the declared world the sonar keeps its sentence and `problems` gains the line.
`game-pinball` asserts `problems` is `[]` in three browser tests (`tests/accessibility.browser.test.ts:271`,
`tests/art-reaches-the-screen.browser.test.ts:126`, `tests/boot.browser.test.ts:82`) over `#game-region` — those three meet this
note on the bump. `game-platformer` builds its own `createAudioSonar` (`app/js/main.ts:747`) without `screenText`, so its
sonar keeps the navigation sentence, unchanged; no game builds `createVirtualController`.

## DN · ADR-0232 D3, the last step: a game declares the KEYS of its words, and `core/i18n` holds no state (issue #207)

**Who is affected:** every game that calls `createGame` with a `preset`, `accommodations` that name a subject, `gameOptions`,
`howToPlay` or `hud` — each word it declares becomes a KEY of its own dictionary — and every game that imports
`core/i18n`'s module-level functions (`t`, `registerDict`, `setLocale`, `getLocale`, `initI18n`, `localeReady`,
`loadLocale`, the default `i18n` object).

📌 **Why:** 📏 measured, a preset built with `t` in Portuguese still read «Acima» after `setLocale('en')`: a word handed
over at boot stays in the boot language. The erratum of 2026-09-25 to ADR-0232 settled it by two decisions the Dev had
already made — the game asks and never needs to know how the engine does it (ADR-0216), and changing the language changes
everything at once (ADR-0225). A KEY meets both by construction: the root's translator resolves it each time the engine
draws or speaks it. Getters were rejected (one forgotten wrap freezes a word silently); a translator the game builds was
rejected (two translators in one page may disagree on the language). With the words keyed, nothing needs the page-wide
dictionary, and `core/i18n`'s module-level state leaves: the language, the dictionaries loaded, the listeners and the port
now live in the translator a root builds, and no stateful module remains outside the composition root.

| old | new | migration |
|---|---|---|
| `core/actions.js` `ActionPreset` = `{ [position]: { label, short?, hint? } }` (words) | `{ [position]: ActionKeys }`, `ActionKeys` = `{ labelKey, shortKey?, hintKey? }` — keys of `CreateGameOptions.dictionaries`. `ActionWord` stays as the RESOLVED word, and the new `ActionWords` is a preset in words; `labellerFrom` and `shortLabellerFrom` take `ActionWords`; new `wordsOf(preset, word)` resolves a preset now | `preset: { action2: { labelKey: 'game.jump', hintKey: 'game.jump.hint' } }`, and the words into `dictionaries` |
| `core/accommodations.js` `AccommodationAnswers` = `{ [accommodation]: AccommodationWord \| false }` | `{ [accommodation]: AccommodationKeys \| false }`, `AccommodationKeys` = `{ labelKey, shortKey?, hintKey? }`; `subjectWord(answers, k)` → `subjectWord(answers, k, word)`, which resolves through `word` and returns `null` for a key the dictionary lacks. A word under `label` is refused at boot and at `mount` | `hints: { labelKey: 'game.hints' }` |
| `ui/game-options.js` `GameOption.label`, `.hint`, `GameOptionValue.label` | `labelKey`, `hintKey`, `GameOptionValue.labelKey`; `GameOptionsDrawCtx` gains a REQUIRED `word` (`Translator.word`). A row whose name or any position's name the dictionary lacks is not drawn. A word under `label` is refused at boot and at `mount` | rename the three fields and write keys |
| `ui/help-panel.js` `HowToPlaySlide.text: () => string` | `textKey: string`; `showSlide`/`animateFigure` take the new `PlaySlide` (`{ text, figure? }`, the slide as shown) and `helpRows` takes `ActionWords`; new `playSlidesOf(slides, word)`. A slide whose text the dictionary lacks is left out. A `text` function is refused at boot and at `mount` | `howToPlay: [{ textKey: 'game.howTo.read', figure }]` |
| `ui/hud-bands.js` `HudNumber.name: Speakable` | `nameKey: string`; `mountHudBands(t, …)` → `mountHudBands(translator, …)` (`{ t, word }`). A name the dictionary lacks hides its line. A `name` is refused at boot and at `mount` | `hud: [{ band: 'identity', nameKey: 'game.points', value }]` |
| `core/i18n.js` `t`, `registerDict`, `setLocale`, `getLocale`, `initI18n`, `localeReady`, `loadLocale`, the default `i18n` object | removed: `core/i18n` holds no state. `createTranslator(port?)` builds a translator that holds the language (`locale()`, `setLocale`, `init(root)`, `ready()`, `onChange`) and the game's dictionary (`registerDict`, `dictionaryGaps`, new `word(key)` and `declares(key)`); `bcp47(code)` stays, with the code REQUIRED (a translator's `bcp47()` defaults to its language); the default object's `availableLocales()` becomes a named export. `LocaleDict`, the `LocalePort` hooks and `Translate` stay | a game's words: `CreateGameOptions.dictionaries`; its own sentences: `engine.t`; the language: `engine.locale()` and `engine.setLocale(code)` (new); the boot language: `engine.localeReady()` |
| `core/i18n.js` `LocalePort` · `platform/locale-host.js` `LocaleHostHooks` | `LocalePort` gains an optional `follow` and `LocaleHostHooks` a required `follow`: the page's `i18n:change` heard on the root's scoped window, so every root on the page follows a switch another root made (ADR-0232 D3 point 3) | nothing, if you spread `localeHostHooks(…)` into the port |
| `window.__i18n` | the root's `Translator`, not the module's object | read `locale()` instead of `getLocale()` |

⚠️ **What is never shown, and where it goes instead:** a declared key the game's dictionaries lack in EVERY language is a
line of `problems` — the field by name, what the child loses, and the fix («add it to CreateGameOptions.dictionaries, in
pt, en and es») — and what needed it is left out, never drawn as the key. A key given in one language and not another is
still the `dictionaryGaps` line, and falls back to the game's pt. A word handed over in the old shape reaches `problems` as
«is not a key». The declaration's `Speakable`s (`nameAt`, `objectiveOf`) do not change: they are returned by functions the
engine calls at every reading, and a name can be content that is no dictionary word (pillar 3).

📌 **Additive in the same change:** `Engine.locale` and `Engine.setLocale`; `CartridgeHooks.dictionaries` — a cartridge
`mount()` swaps in may bring its words, ADDED to the root's dictionary; `ui/declared-words.missingDeclaredKeys` (the rule
behind the `problems` line); the demo quiz's declared words moved from the engine's dictionaries to its own
`consumer-quiz/quiz-words.ts` (twelve `quiz.pos.*`, `quiz.comoJogar.*`, `quiz.acom.*` keys left `app/js/i18n/*.ts`).

📏 **Measured in the six games, read-only, as information:** `game-2048`, `game-platformer`, `game-soccer` and `game-pinball`
(`app/js/standalone.ts`) register their dictionaries with the module-level `registerDict`, and `game-2048`,
`game-platformer`, `game-soccer` and `game-chess` import the module-level `t`; `game-pinball` also imports `getLocale` and
`initI18n`; `game-2048`, `game-chess` and
`game-whackwhack` build their preset by calling a translator at boot (`criarPreset(t)`, `actionPreset(…)`), which is the
measured defect. Each moves its dictionaries to `CreateGameOptions.dictionaries` and hands the keys its preset already
names instead of their words.

## DO · ADR-0234 phase B3: the free Libras player is THE interpreter, and the VLibras Unity player leaves

**Who is affected:** nobody who consumes a release — 📏 v10.0.0 carries neither Libras player nor any Libras delivery step
(`git merge-base --is-ancestor` on every commit of routes A and B), and no sibling repository names anything that leaves
(`git grep` over the checkouts beside the engine, 2026-09-26). What changes is the surface added since v10.0.0 — the rows of
section E marked **✖DO** — and so what the next release publishes: a host that builds `createVlibrasInterpreter` or reads the
two route A folders, a delivery script that passes `--libras-avatar`, a test that matches the old «not installed» text.

📌 **Why:** the Dev's «rota A seguida pela B». Route A was a declared, temporary exception — Unity Technologies' closed runtime,
whose redistribution terms nobody determined, with its one `eval` rewritten at delivery time so it could run under the
delivery's policy. Route B, LAViD-UFPB's GPL signs exported to a three.js avatar, stood beside it through phases B1 and B2 and
kept itself offline in B3's first half; with this change it is the engine's interpreter, and route A leaves the engine, the
package and the delivery. Letter timing and chaining are unchanged (an open question to the Dev).

| was | is | migration |
|---|---|---|
| `createGame` with no `EngineHost.interpreter`: the VLibras Unity player (`ui/vlibras-player`) in a same-origin frame | the free player (`ui/libras-avatar-player`) over `doc.baseURI`; three.js arrives with its first sign, never before. Where the delivery carries no avatar manifest it answers EXACTLY as `NO_INTERPRETER` does | none; a host that lent the free player itself may stop lending it |
| `ui/vlibras-player` (`createVlibrasInterpreter`, `VlibrasPlayerPorts`) | removed | `ui/libras-avatar-player.createLibrasAvatarInterpreter` with `LibrasAvatarPorts` (`doc`, `win`, `fetch`, `base`, `title`; optional `avatarFolder`, `loadTimeoutMs`, `leaveAfterMs`, `loadStage`) |
| `LibrasAvatarPorts.glossesFolder` · `ui/libras-avatar-load.avatarPlace(base, folder, glossesFolder)` | removed: the glosses live beside the avatar, `libras/avatar/glosses.json`; `avatarPlace(base, folder?)` | drop the port and the third argument |
| `ui/libras-avatar-load.NOT_SHIPPED` («the Libras avatar is not installed … `--libras-avatar`») | the reason `NO_INTERPRETER` gives, word for word — new `ui/vlibras.LIBRAS_NOT_INSTALLED`, naming `--libras` | a test matching the old text matches `LIBRAS_NOT_INSTALLED` |
| `platform/heavy-catalogue`: `HEAVY_FILES` `libras:player:loader`, `…:framework`, `…:code`, `…:data`, `…:framework:noeval`; `HeavyFile.madeFrom`; `LIBRAS_PLAYER_FOLDER`, `LIBRAS_SIGNS_FOLDER`; the `libras:delivery` list (`libras/offline.json`) | removed: no catalogue file is the Libras player's. `DELIVERY_LISTS` holds `libras:avatar:delivery` (`libras/offline-avatar.json`) alone, and `heavyAtBoot({ libras: true })` asks for that list and nothing else | a `downloadHeavy` without `only`, and `bytesLeftToDownload`, count 20,694,515 bytes (19.7 MiB) less |
| `platform/heavy-mirror.MIRROR_FOLDERS` | the `vlibras-web-browsers-9d093f2/public/unity` folder leaves | a base need not carry it |
| `inclusionist-heavy --libras` | delivers the free player: `libras/avatar/glosses.json`, then the avatar and its 655 clips checked against `scripts/libras-avatar.json` — from the pins' `source` or `<base>/vlibras-avatar-f8ddb37/` — and last `libras/offline-avatar.json`, which now names the glosses too. It finds the build's stage chunk first and stops without exactly one. It no longer writes `heavy/raw.githubusercontent.com/…/public/unity/*`, `libras/player/*`, `libras/signs/*` or `libras/offline.json`, and prints `signs … signed by the avatar's clips` instead of `… carried (scripts/libras-signs.json)` | a `--base` for `--libras` needs `vlibras-avatar-f8ddb37/` (⚠️ not yet on the project's mirror) and no longer `vlibras-web-browsers-9d093f2/` nor `vlibras-dictionary-sources-f8ddb37/FILES/BUNDLES/`; run it on the page's fresh build output |
| `inclusionist-heavy --libras-avatar` | removed — unreleased, and now ignored like any unknown flag | `--libras` |
| `scripts/vlibras-player.mjs` and `scripts/vlibras-player/` · `scripts/libras-signs.json` · `scripts/licences/LGPL-3.0.txt` | leave the repository and the package | none |
| `scripts/libras-glosses.mjs` `deliverLibrasSigns`, `readSignPins`, `signsSourceOf`; `deliverLibrasGlosses({ destino, playerFolder, signsFolder, glossesFile, dictionaries, translate, pins, base, fetch, read })` → `{ path, texts, tokens, signs, unpinned, spelled }` | the three leave; `deliverLibrasGlosses({ destino, folder, glossesFile, dictionaries, translate, carried? })` → `{ path, texts, tokens, signed, fingerspelled, spelled }` — a token is a sign exactly when the avatar carries its clip (`carried`, by default the clip names `scripts/libras-avatar.json` pins), and an avatar with no clip is refused | pass `folder` (the avatar's) and, if not the delivery's own pins, `carried` |
| `scripts/libras-avatar.mjs` `avatarListPaths({ folder, pins, stageChunk })`, `writeAvatarList({ … })` | both take `glosses` (the path the glossing step wrote), REQUIRED — a list without it is not written; `writeDeliveryList` moves here from `scripts/vlibras-player.mjs` | pass `glosses` |
| `scripts/libras-export.mjs` `SIGN_LIST`; the export's default names from `libras-signs.json` | removed; the defaults are the signs `libras-export/sources.json` pins (the same 655) | a new sign enters with `--signs NAME --write-pins` |
| `scripts/licences/third-party.mjs` | the `vlibras-player` group and the `LGPL-3.0` licence text (and the «incorporates» rule only it used) leave | none |
| the engine's service worker | its Libras route answers `…/libras/avatar/*` and the stage chunk only; `libras/player/` and `libras/signs/` go to the network | a cartridge that copies the route copies the narrower one |
| `consumer-quiz` `QuizHost.librasAvatar` · `quiz.html?libras=avatar` | the field is removed; the page ignores the query (a no-op), and the service worker still matches such a link to the precached `quiz.html`, so it opens offline | drop the field |

⚠️ **Behaviour a consumer may notice:** 📏 measured on the engine's own delivery (`npm run build`, then
`inclusionist-heavy dist --reading pt --libras` over one local base, 2026-09-26): the delivery shrinks from 655,032,001 to
619,110,716 bytes (−35,921,285: the Unity build's 20,739,366 with its licence files, the 630 sign bundles' 15,074,119 with
theirs, route A's page and `offline.json`); the engine's `glosses.json` is BYTE-IDENTICAL to route A's (sha256 `965791ea…`),
since the avatar carries every sign the bundles did — 630 signed, 132 fingerspelled, as before; a device with deaf mode on keeps
681 files instead of 1,321. In a served delivery, the plain `quiz.html` in deaf mode shows the avatar 438 ms after the sonar
online and 295 ms offline, with zero CSP violations and not one request to `libras/player/`, `libras/signs/` or a Unity file.

⚠️ **Not purged:** a browser that kept route A's files before this change keeps them in `incl-pesados-v2` — nothing asks for
them any more, and nothing deletes them. No delivery is deployed (CLAUDE.md §2), so only test browsers hold any.

## DP · ADR-0218 §3: one-button scanning offers the engine's doors and steps its menus

**Who is affected:** a consumer of v10.0.0 that calls `ui/scan-overlay.scanItemText` itself, or builds a double of `MenuNavApi`
in its tests. 📏 No sibling repository names either (`git grep` over the checkouts beside the engine, 2026-09-26); a game that
only turns one-button mode on through the engine needs nothing.

📌 **Why:** ADR-0218 §3 decided that scanning offers cancel, the game's positions, then the doors the engine opens (the menu and
the pause), and it offered only the first two; a child who opened the pause by scanning was stuck in it, because a scan press
did nothing inside a menu. The scan now offers the doors in play and steps the engine's menus when one is in front (engine
`dcae9422`, `66342f10`).

| was | is | migration |
|---|---|---|
| `ui/scan-overlay.scanItemText(item, label, cancelWord)` | `scanItemText(item, label, t)` — the root's translator, because a menu step and a door are named in the child's language too | pass the translator instead of the word for «cancel» |
| `ui/menu-nav.MenuNavApi` | gains `navIntent(player, keys)`, the path a scanned menu step takes (the same guards as a key) | a hand-built double adds `navIntent` |

## DQ · ADR-0218: one-button scanning adjusts a panel's values, and any input takes the one shown

**Who is affected:** a consumer that builds a double of `MenuNavApi` in its tests, or switches exhaustively over
`ui/menu-intent.MenuStep`. 📏 No sibling repository names `MenuStep`, `MENU_SCAN` or `underCursor`, and none builds a
`MenuNavApi` by hand (`git grep` over the checkouts beside the engine, 2026-09-26); `game-platformer` calls `initMenuNav` and
receives `underCursor` with it. A game that only turns one-button mode on through the engine needs nothing — but it will SEE
the behaviour of section E's two rows for this note.

📌 **Why:** two parts of ADR-0218 were partial after DP. A slider, a list or a ⯇ ⯈ row in a panel could be reached by scanning
and never changed, because no scanned step moved a value; and §4's «what selects is ANY input» held for keys only — a touch on
the game region, the on-screen pad, the camera modes, the voice and the gamepad still pressed what they pressed while the scan
was on. On a control with a value the pass now offers «increase» and «decrease», and every transport's press takes the item
shown (engine `07568574` the sideways step, `5f3e3732` any input).

| was | is | migration |
|---|---|---|
| `ui/menu-nav.MenuNavApi` | gains `underCursor(player)`: `'item'`, `'list'` or `'value'`, the kind of control a sideways step would reach — what the scan asks before it offers «increase» and «decrease» | a hand-built double adds `underCursor`; answering `'item'` keeps the old pass |
| `ui/menu-intent.MenuStep` = `'next' \| 'previous' \| 'confirm' \| 'back'` | adds `'increase' \| 'decrease'` (the right and left keys' intents, `menuStepKeys`) | an exhaustive `switch` over `MenuStep` handles the two new members |

## DR · ADR-0218 §4 and ADR-0194: under one button only, a word heard is one press

**Who is affected:** a consumer of v10.0.0 that builds `ui/voice-control.createVoiceControl` itself. 📏 No sibling repository
does (`git grep` over the checkouts beside the engine, 2026-09-26); a game that lets `createGame` build the voice control needs
nothing.

📌 **Why:** with one-button scanning on, saying a menu item's name did two things — it moved the cursor to the item (ADR-0194
§2) and its confirm then collapsed into «take the one shown» (ADR-0218 §4) —, so one utterance could take a step the child
never saw. Now the control asks whether one button only is on before anything else: a position word presses its position,
a name presses confirm, nothing moves the cursor first, and the scan takes that one press (engine `66b35c6d`).

| was | is | migration |
|---|---|---|
| `ui/voice-control.VoiceControlDeps` | gains `oneButtonOnly(): boolean`, REQUIRED — asked at every word, never cached | pass a function that answers whether one-button scanning is on; `() => false` keeps ADR-0194 exactly as before |

## DS · ADR-0243 §4: `gameSay` takes the language of its word, required

**Who is affected:** a consumer that calls `platform/speech.gameSay`. 📏 One sibling repository does (`git grep` over the checkouts
beside the engine, 2026-09-26): `game-platformer`, whose `app/js/main.ts` imports `gameSay` and hands it to `app/js/game/quiz.ts`
as `c.gameSay(text)` for its literacy words; it consumes `^9.0.0`, so it meets this change, together with note DB's, on the day it
moves to this version. No other sibling names `gameSay`.

📌 **Why:** ADR-0243 §4. `gameSay` forced `pt-BR` whatever the page said — the monolith's behaviour, carried over, never a
decision — so it could not read an English word of an English lesson with an English voice. The game now says which language its
word is in, and the voice is chosen by the rule narration's parts use (§2). The language is REQUIRED because an optional one
would default to one, and that default is the defect the record removes; a device that lists voices and none of the language
says nothing (§3) (engine `f59b39a3` on branch `speech-language`).

| was | is | migration |
|---|---|---|
| `platform/speech.gameSay(voice, text)` — the utterance tagged `pt-BR`, its voice `ptbrVoice`'s (pt-BR, then a `pt` voice named Brasil, then a region-less `pt`, never pt-PT; with only pt-PT, no voice set) | `gameSay(voice, text, language)` — `language` a BCP-47 tag, REQUIRED; the utterance tagged with it, its voice the exact tag's, else the FIRST voice of the same language (a pt-PT voice listed first reads a pt-BR word when no pt-BR voice exists); a device that lists voices and none of the language says nothing | pass the language the word is in: the platformer's literacy words are Brazilian Portuguese, so `c.gameSay` becomes `(text) => gameSay(voice, text, 'pt-BR')` |

## DT · ADR-0248: the pad wizard says it closed, required, and the focus comes back

**Who is affected:** a consumer that builds `input/gamepad.GamepadCtx` by hand and calls `initGamepad` itself. 📏 Two sibling
repositories do (`git grep` over the checkouts beside the engine, 2026-09-26): `game-platformer` (`app/js/main.ts`) and
`game-soccer` (`app/js/boot/main.ts`), both on `^9.0.0`, so each meets this change on the day it moves to this version. A game
that lets `createGame` mount the gamepad (note BP) needs nothing: the root answers the port itself.

📌 **Why:** ADR-0248. The transport's own mapping wizard — the one that opens by itself when an unmapped DirectInput pad presses a
button, possibly over the pause card — hid its overlay when it ended and never gave the focus back, so the focus dropped to
`<body>` and a screen-reader child lost her place. The transport knows the wizard ended; the root owns the focus. The port is
REQUIRED because the Dev chose the engine right first and the games adapting to it: an optional port is one more field a game
can forget, and forgetting it keeps the defect in silence.

| was | is | migration |
|---|---|---|
| `input/gamepad.GamepadCtx` — the transport's wizard closed with no word to anyone | gains `wizardClosed(): void`, REQUIRED — called once per close (saved, cancelled, or closed by the root), after `#padwiz` is hidden and after the resume of a game the wizard paused | pass a function that returns the focus to whoever held it when the wizard opened — with the engine's overlays, `wizardClosed: () => { overlays.restoreFocus('padwiz'); }` |

## DU · ADR-0249: the game says whether a one-command transport latches, and the child may change it

**Who is affected:** a consumer that calls the latch rule or its storage itself — `input/latch-scope`, `input/latch-store`,
`input/latch-sync`, `input/latch-edge` — or `ui/latch-refusal`, or `ui/pause-icons.nextInputMode` with three arguments. 📏 Two
sibling repositories call the latched edge (`git grep` over the checkouts beside the engine, 2026-09-27): `game-platformer`
(`app/js/main.ts`) and `game-soccer` (`app/js/boot/main.ts`), both through `criarArestaComAlternancia(() => players)` of
`^9.0.0`, so each already meets note AO's rename (`createLatchedEdge`) and now also `holdsKeys` on the day it moves to this
version. No sibling
names `latchRefusal`, `latchAlwaysOn`, `latchIsOptional`, `nextInputMode` or the `alt.exigida.*` keys. A game that lets
`createGame` mount its transports needs nothing: the root reads its `holdsKeys()` itself.

📌 **Why:** ADR-0249. On eyes, face, gestures and speech the latch was ALWAYS on and the stored choice was never read
(ADR-0109, ADR-0113 clause 3). The Dev decided that the game says it: the latch on those four starts as the game's
`holdsKeys()` — read when the transport presses, since a game changes it between stages — and the child's stored choice for
that transport wins over it; the option is offered there as on the keyboard. A platform game keeps walking on «direita», a quiz
presses once on «abaixo». Keyboard, pad and touch keep their rules. The root now resolves the latch when one of the four presses
the virtual controller (`VirtualControllerDeps.pressedBy`, new and optional).

| was | is | migration |
|---|---|---|
| `input/latch-scope.latchAlwaysOn(t)`, `latchIsOptional(t)` | removed; `latchDefaultFromGame(t)` answers whether the transport's default is the game's (`true` on the four) — the option is offered on every transport | a caller of `latchIsOptional` offers the option always; a caller of `latchAlwaysOn` asks `latchDefaultFromGame` and resolves with `latchOf` |
| `input/latch-scope.LatchReading` `{ fromTransport, fromLegacy, byDefault }`; `latchOf` answering `true` on the four | gains `gameHoldsKeys: boolean`, REQUIRED; `latchOf`: the transport's stored value · on the four, `gameHoldsKeys` · the legacy key · the factory default — the four no longer inherit the legacy key | add `gameHoldsKeys: declaration.holdsKeys()` to a reading built by hand; new type `LatchDefaults` = `{ byDefault, gameHoldsKeys }` |
| `input/latch-store.readLatch(store, base, player, transport, fallback)`, `storedLatch(…, fallback)` | `(…, transport, defaults: LatchDefaults)` | pass `{ byDefault: fallback, gameHoldsKeys: declaration.holdsKeys() }` |
| `input/latch-store.writeLatch(…): boolean` — `false` (nothing written) on the four | `: void` — writes on every transport | drop the use of the answer; the four are a choice now |
| `input/latch-sync.syncLatch(p, store, player, transport, byDefault)` | `(…, transport, defaults: LatchDefaults)` | as `storedLatch` |
| `input/latch-edge.LatchedEdgeOptions` `{ input, store, byDefault? }` | gains `holdsKeys: () => boolean`, REQUIRED, called at every edge | `createLatchedEdge(() => players, { input, store, holdsKeys: () => declaration.holdsKeys() })` |
| `ui/latch-refusal` (`latchRefusal`, `LatchRefusal`, `REFUSAL_KEY`, `NEED_LATCH`, `showsEvenWhenRequired`) · dictionary keys `alt.exigida.olhos`, `.rosto`, `.gestos`, `.fala` | removed: no device refuses the latch | delete the refusal branch; `ONE_COMMAND_AT_A_TIME` still names the four |
| `ui/pause-icons.nextInputMode(m, holdsKeys, latchRequired?)` · `IconStateSnapshot.latchRequired?` | `nextInputMode(m, holdsKeys)`; the snapshot member removed — the ☝️ offers «padrão» on every device of a game that holds keys | drop the third argument and the member |

## DV · ADR-0253: the shared CI builds and checks every game's cartridge, with the engine's build — required

**Who is affected:** every game that calls `.github/workflows/game-ci.yml`. The PACKAGE's shapes do not change (the build and
the checker are additive, section E); what changes is the gate. After `npm run build`, the shared CI now runs
`vite build --mode cartridge` and `npx inclusionist-check-cartridge`, with no input to turn them off, so a game's CI is RED until
it builds its cartridge with the engine. 📏 Measured 2026-09-27 (read-only `git grep` of the checkouts beside the engine): five of
seven games declare a `build:lib`, each its own way — `game-platformer` `vite build --mode lib`; `game-chess` the same plus
`tsc -p tsconfig.build.json`; `game-pinball` a second config, `vite.lib.config.ts`; `game-whackwhack` `vite build` under the
`build:lib` lifecycle plus `tsc -p tsconfig.pkg.json`; `pixi-15-puzzle` `--mode lib`, `tsc` and its own `check-cartridge.mjs`;
`game-2048` builds both in `build` through `scripts/build-lib.mjs`; `game-soccer` has none. None of the seven passes the gate as it
stands, because none has the engine's build.

📌 **Why:** ADR-0253, which builds the gate ADR-0140 called «not optional»: two targets written by hand in each game drift, and
the cartridge — the half the platform installs — was built by no CI at all.

**The migration a game makes, once, on the day it moves to this version:**

1. `vite.config.ts` wraps the config it has and names the cartridge's entry; the game's own lib branch, second config or
   environment switch is deleted:
   ```ts
   import { defineGameBuild } from '@the-inclusionist/engine/build';
   export default defineGameBuild({ cartridge: 'src/index.ts', config: { /* the app config, as it was */ } });
   ```
2. The entry's **default export** is the cartridge, `{ slug, declaration, hooks, create(ctx) }` (ADR-0139 §2): the checker reads
   `declaration` and `hooks` from it, at import, as `createGame` does at boot. A game whose declaration or hooks live only on the
   instance `create` returns (`game-2048`), or that exports a factory or named members instead (`pixi-15-puzzle`, `game-chess`,
   `game-platformer`, `game-whackwhack`, `game-pinball`), moves them onto that default export.
3. `package.json`: `build:lib` becomes `vite build --mode cartridge` (or goes), the own `tsconfig.*` for the cartridge's types and
   the own checker script go, and `exports["."]` points at `./dist-lib/cartridge.js` with `types` `./dist-lib/cartridge.d.ts`.
4. The workflow keeps its one line, unchanged: `uses: the-inclusionist/the-inclusionist-engine/.github/workflows/game-ci.yml@main`.

A game on an engine without the build is told so by the step's first line, naming ADR-0253.

## DW · ADR-0255: the font library left the package — a game declares the library families it draws with

**Who is affected:** every game that draws text in a font family the engine packaged and does not use itself — any family of
`vendor/fonts.css` before this version except Atkinson Hyperlegible, Andika, Lexend, Atkinson Hyperlegible Mono and the fifteen
Playwrite hands the typography button can pick (BR, US Trad, US Modern, CA, MX, AR, CL, CO, ES, ES Deco, PT, GB J, GB S, CU, PE).
The other 194 families (Press Start 2P, Lato, Cookie, the Noto scripts, the other Playwrite hands and every «Guides», the display
faces…) are no longer in `app/public/vendor/fonts/`, in `fonts.css`, in the npm package or in the precache: they live in the font
library, `the-inclusionist-lfs/fonts/<family>/`, catalogued with each face's sha256 in `platform/font-library.json`. A game that
names one in its CSS or canvas without declaring it now draws the next face of its stack, and `problems` does not see a family
it was never told of. **Merriweather** is gone from the package AND the library (ADR-0254): a game that used it picks another face.

The library's reserved-name families are now their authors' ORIGINALS (ADR-0254): Lato, Lora, Playfair Display, Press Start 2P,
Quicksand, Source Sans 3, Source Serif 4, UnifrakturMaguntia, Abril Fatface, Alfa Slab One, Bowlby One SC, Cookie, Lilita One,
Lobster, Monofett, Petit Formal Script, Plaster, Ranchers, Sancreek, Titan One and Ubuntu cover the whole character set in one
file per weight (or one variable file), with no `unicode-range` — larger than the subsets, and the weights are the originals'
(Playfair Display 400–900, Source Sans 3 and Source Serif 4 200–900, Quicksand 300–700, Lora 400–700; Ubuntu 400 and 700).

📌 **Why:** ADR-0255 — the engine carries what the engine uses; a library for cartridges is delivered when a cartridge asks for
it, once per delivery however many cartridges use it, as the heavy files are (ADR-0177).

**The migration a game makes, once, on the day it moves to this version:**

1. Declare every library family it draws with — `createGame({ …, uses: { fonts: ['Press Start 2P', 'Lato'] } })`, beside
   `reading` and `neuralVoice`. The engine writes their `@font-face` rules itself (pointing at the delivery's `heavy/`) and keeps
   each file in the checked cache for the days without a network; a game's own `@font-face` for these families is deleted. The
   engine's own faces need no declaration.
2. Build its delivery with them: `npx inclusionist-heavy dist --fonts "Press Start 2P,Lato"` (repeatable, or `--fonts all`), from
   the project's mirror or `--base <the-inclusionist-lfs folder>`. Each face is checked against the engine's catalogue by sha256,
   and each family gets its licence text and `NOTICE.txt`.
3. Read `problems` once: a family the library does not hold, or one the delivery did not carry, is a line naming it and the fix.

| was | now | what to do |
|---|---|---|
| 214 families in `vendor/fonts.css` and `vendor/fonts/` | the 19 the engine draws with; the rest in the library | declare the others in `uses.fonts`, deliver with `--fonts` |
| `vendor/fonts-licences/Apache-2.0.txt`, `UFL-1.0.txt` | gone (no engine face is under them); every library folder and delivered family carries its own | nothing, unless a page linked them: link the family's folder in `heavy/` |
| `ui/fonts.faceAvailable(it)` answered `true` for every face not `off` | `true` for the engine's faces; a library face (and the ronde, whose stack ends in Cookie) answers through the detector | a panel mounted by a game passes `fontInstalled`; the root passes «the game declared the family» |
| the kit row `merriweather` | gone | nothing |

## DX · ADR-0256: a child answers an option by saying it — `engine.reading.choose()`, and the quiz's own matcher leaves

**Who is affected:** a game that answered options by voice with `engine.reading.listen()` and compared the text itself, and anyone
who builds an object of the type `Reading` (a test double of it): the type has a new REQUIRED method, `choose`. The demo's
`consumer-quiz/main-quiz.heardAlternative` is no longer published — the rule moved into the engine with the matching.

📌 **Why:** ADR-0256 — an option is one or two words, which the reading (Whisper) transcribes badly (the lab: 1 of 7 on words said
alone) and a closed grammar hears (7 of 7). The game says what it shows; the engine hears only that, with the command recogniser,
and answers WHICH option — never text to compare. Two options in one sentence are no answer (a child thinking out loud).

**The migration a game makes, once:**

1. Where it asked `reading.listen()` to hear an answer among options, call `reading.choose(options)` with the option texts as shown
   (a leading pictogram is not spoken and is dropped by the engine) and use `chosen` — the index, or `null` — and `heard`. The game
   still decides WHEN to ask: the demo asks on action 1, which the child reaches by saying «ação», by the key or by the pad.
2. If it no longer transcribes anything, drop `uses: { reading: true }`: that declaration puts 850 MiB of reading models into its
   delivery. `choose()` needs the command models, which every delivery carries unless its `--commands` list narrows it.
3. A double of `Reading` gains `choose`.

| was | now | what to do |
|---|---|---|
| `reading.listen()` + the game's own comparison | `reading.choose(options, { language?, maxMs? })` → `{ chosen, heard, ended }` | call `choose` for options; keep `listen` for reading aloud |
| `consumer-quiz/main-quiz.heardAlternative` | gone (`platform/choose-by-voice.optionsNamed` is the engine's rule) | nothing — the demo was its only caller |
| the demo declared `uses: { reading: true }` | it declares none | nothing |

## DY · Three published names nothing in the engine read leave the surface

**Who is affected:** a game that imports one of them. 📌 **Why:** the Dev, 2026-09-27, shown that nothing inside the engine reads
them: «Sai e é quebra». A name published with no reader in the engine is debt (the exports ledger), and each of these had its
reader only outside — or none at all.

| was | now | what to do |
|---|---|---|
| `core/contract.dimension(topology)` | gone | `topology.kind === 'hotspots' ? 0 : topology.size.length` |
| `input/transports.holds(transport, asked)` | no longer exported (the engine's own reach check still uses it) | `transport.holds === undefined \|\| transport.holds >= asked` |
| `ui/title.TITLE_MENU_IDS_ORDERED` | no longer exported | `ui/title.TITLE_MENU_IDS` (the set) is still published; a game that needs an order keeps its own |

## DZ · The continuous sound guide leaves the engine for the platformer (ADR-0257)

**Who is affected:** a game that runs the sonar's guide — `engine.sonar.updateGuide()` or `createAudioSonar(…).updateGuide()` —
or reads `guideCount`; a game that builds a `SonarCtx` by hand; anyone importing `platform/guide-intensity.js` or the guide's
names from `platform/audio-sonar.js`. 📏 Measured 2026-09-27: nothing in the engine runs the guide (`createGame` wired it and
never called it); in the catalogue the platformer did (through its own root) and `game-pinball` does (`engine.sonar`). The
platformer already owns its copy — `game-platformer:69d2a06`, 1385 tests green.

📌 **Why:** the Dev, 2026-09-23: «O guia sonoro é do platformer e deve ser decidido por ele sim», and 2026-09-27: «Pode tirar e
levar da engine para o platformer». The SONAR — the tone that points, its words, the pan, `needsAudioCues`, a child's own output
device — serves any game and stays.

| was | now | what to do |
|---|---|---|
| `AudioSonar.updateGuide()`, `AudioSonar.guideCount` (also on `engine.sonar`) | gone | own the guide, as `game-platformer/app/js/platform/audio-guide.ts` does: it asks the sonar instance for `playerCtx`, `panFor` and `needsAudioCues`, and measures with `core/contract.distance` and `core/route.routeTo` |
| `platform/guide-intensity.js` — `guideIntensity`, `Intensity`, `STEPS_TO_FLOOR`, `FAR_CUT`, `NEAR_CUT`, `FAR_VOL` | gone | copy the pure mapping (`game-platformer/app/js/platform/guide-intensity.ts`) |
| `platform/audio-sonar.js` — `LiveGuide`, `GUIDE_WAVE`, `GUIDE_VOL`, `FRAMES_BETWEEN_ROUTES`, `PlayerAudioOut._guide` | gone | the guide's own module declares them, and hangs its graph on its own player type |
| `SonarCtx.roleAt`, `catNode`, `audioOut`, `getVolume`, `getPlayers`, `getAudioCtx`, `getSoundOn`, `getAudioCat` | gone — only the guide read them | delete them from a hand-built ctx; a guide of your own takes them in its ctx |
| `CreateGameOptions.sonarPlayers` | still accepted, `@deprecated`, **read by nothing** | nothing breaks; stop passing it when convenient — the sonar gets its player in `engine.sonar.sonar(pl)` |

The mixer's `guide` category and its row in the hearing panel stay (ADR-0151, ADR-0155): a game's guide plays in it.

## E · What is ADDITIVE, listed so nobody migrates for nothing

⚠️ Rows marked **✖DO** were added after v10.0.0 for the Libras players and were withdrawn or changed by note DO (ADR-0234 phase B3) before any release: read DO for what holds now.

| | |
|---|---|
| `ui/mount-panel.ts` | new module: the five lines every consumer had to write to mount a panel |
| `ui/panel-widgets.ts` | new module: one menu row, built rather than demanded |
| `ui/panel-shell` | gains `PanelLabels` and `aplicarRotulos` |
| `ui/panel-shell.idsDaCasca` | gains an optional second argument, the list's id |
| `ui/settings-motor` | gains `definirAlternanciaDeCorrida`, `montarInteriorDoMotor` |
| `ui/settings-audio` | gains `montarInteriorDoAudio` |
| `input/touch` | gains `montarControleDeToque`, `lacunasDoToque` |
| `SettingsMotorCtx` | `setToggleRun` and `rebuildCoins` became OPTIONAL — a widening; whoever injects still rules |
| `CreateGameOptions.players` | gains an optional `audioSink`, written by the hearing panel and read by `ui/pause-icons` |
| `platform/storage.chavesForaDosEscopos` | new: keys outside `incl_*`, `inclusionist.*` and `incl.<game>.*`; `createGame`'s `problems` names those that appeared during the page's life (study item E2) |
| `Engine.medirFlashes` · `core/flash-threshold` | new: measures the world's canvas against the WCAG 2.3.1 general flash threshold, only when called; a failure is a line of `problems` (study item B2) |
| `core/i18n.lacunasDosDicionarios` | new: keys a cartridge registered in one of pt/en/es and not another, read by `createGame`'s `problems` (study item E4) |
| `CreateGameOptions.howToPlay` · `ui/help-panel.howToPlayProblems`, `animarFigura`, `HowToPlaySlide` | new, optional: the cartridge's «how to play» slides (text read at each showing, a figure it draws on the engine's surface), shown by the help before the button slides; a slide without text refuses the boot and `mount` (ADR-0195, issue #188). `mostrarSlide` accepts these slides beside the button rows — a widening |
| `core/speech-rate` · `core/state.speechPpm`, `setSpeechPpmValue` · `TtsCtx.getSpeechPpm`, `criarAudio` | new: the child's speech rate, 254–504 words a minute by 50, never under the voice's own speed (`incl_speech_ppm`, 254 by default; ADR-0196), a list in the hearing panel; a neural utterance is measured and played at the ratio through a media element that keeps the pitch; a browser voice's rate comes from its measured average (ADR-0183 §1, issue #179). Both `TtsCtx` fields optional |
| `CreateGameOptions.carregarKokoro` · `TtsCtx.carregarKokoro` · `platform/kokoro` · `Tts.kokoroDispositivo` | new, optional: the Kokoro port (`ModuloKokoro`: phonemize, vocabulary, voice table, session on WebGPU or WASM), filled by the game; its voices listed after Piper's, Heart and Bella marked with a heart; WebGPU kept only when a test synthesis is speech (ADR-0198, issue #181). `Tts.neuralDisponivel` is true with either port |
| `core/loop.registrarAvisoDeQueda` | new: `createGame` registers its crash notice, and a `startLoop` with no `aoFalhar` announces through it (study item D1); a game's own `aoFalhar` still wins |
| `Engine.legendarSom` | new: the engine hosts the sound caption in the screen footer (study item D3); pass it as `createAudioEarcons`'s `showCaption` instead of a page `#caption` |
| `CreateGameOptions.dictionaries` | new (note CV): the game's dictionaries, one per language, registered into THIS root's translator before the host's markup is translated — a key resolves for this game and no other root on the page; a key given in one language and not another is a line of `problems`. The module-level `registerDict` still works meanwhile |
| `Engine.t` · `Engine.localeReady` | new (note CV): the root's `t` and the promise of its boot language, on the handle — a game that writes its own words asks here instead of importing `core/i18n`, as it asks `gameSpeed`; the demo quiz does, binding the words it hands `createGame` late |
| `Engine.menuIndexOn` | new (note CU): the child's choice of hearing «N de M» after an item, read live from the settings store — a game that announces its own items asks here, as it asks `gameSpeed`; the demo quiz does |
| `platform/storage.createStorage`, `memoryBackend`, `StorageLike`, `Store` · `EngineHost.storage` · `ui/vlibras.initLibras` | new (note CT): the store as a factory over the backend it is given, a Map-backed backend for a test or a second root, the host's optional storage the root builds the page's store from (absent: the host window's `localStorage`), and deaf mode's init |
| `core/camera-cycle` · `core/setting-defaults` · `platform/storage-keys` | new, stateless (note CS): besides the names that moved, `CAMERA_CONTROLS` (the 📷 order, also the motor panel's camera row), `toCameraControl` (a stored value that is not a position reads as off), the `MediaQuery` type, and `KEYS` at its new home |
| `CreateGameOptions.hud` · `ui/hud-bands` | new, optional: the numbers a game shows, each with its band (`identity`, `mission`, `power`, `learning`); the engine mounts the HUD — points and mission top left, power top right (under the clock, ADR-0175), nothing under the quick bar, one to three learning bars (a `Barra` from `educational/segment-bar`) centred in the footer under the explanation — and `--barra-a11y-h` grows by what it takes (ADR-0168, issue #162). A malformed list is refused. A game that keeps its own HUD passes nothing |
| `platform/vosk-vocabulary.readModelVocabulary` · `VoskDeps.fetch` · `VoskLoad.vocabulary` · `VoiceControlDeps.fetch` | new, optional (ADR-0194 §4): the words a Vosk model knows, read from the output symbol table of its archive's `Gr.fst` — the runtime keeps them in its worker and tells the page nothing; with a `fetch` lent, the load offers `vocabulary()` for the loaded model, and the voice control writes one line of `problems` per menu item whose name has a word the model lacks. `createGame` lends the host's `fetch`; a game that builds `createVoiceControl` itself passes `fetch` to get the lines, and without it nothing is reported |
| ✖DO `ui/vlibras-player` · `platform/heavy-catalogue.LIBRAS_PLAYER_FOLDER`, `LIBRAS_SIGNS_FOLDER` · `heavyAtBoot({ libras })` · `inclusionist-heavy --libras` | new (ADR-0234, route A): `createVlibrasInterpreter({ doc, win, fetch, base, title })` is the `Interpreter` over the VLibras player a delivery built with `--libras` carries, and the one `createGame` uses when the host lends no `EngineHost.interpreter` (a host's own always wins); where the delivery carries none it answers as `NO_INTERPRETER`, whose reason now names the fix. ⚠️ **Behaviour a consumer may notice:** `HEAVY_FILES` gains the four `libras:player:*` files (19.3 MiB), so a `downloadHeavy` called WITHOUT `only` and `bytesLeftToDownload` count them; `heavyAtBoot` leaves them out unless asked with `libras: true`, which the root does while deaf mode is on |
| ✖DO `ui/libras-glosses` (`glosserOf`, `loadGlosser`, `provisionalGloss`, `LIBRAS_GLOSSES_FILE`, `GlossFile`, `Glosser`) · `inclusionist-heavy --libras-texts <file>`, `--libras-setup` · `npm run libras:setup` | new (ADR-0234 route A, plan item 5b): a delivery built with `--libras` also GLOSSES the engine's Portuguese dictionary and, with `--libras-texts` (repeatable, implies `--libras`), the game's — at build time, with LAViD's rule-based `vlibras-translator` 1.3.3 in a uv environment outside the repository (`scripts/libras-glosses/uv.lock`, built once by `--libras-setup`) — and writes `libras/player/glosses.json`; `ui/vlibras-player` hands the player the gloss it finds there, and today's rule (capitals, accents stripped, fingerspelled) for any text or `{param}` value it does not cover. ⚠️ **Behaviour a consumer may notice:** `--libras` now STOPS with exit 1, before downloading anything, on a machine without the glosser's environment (no `uv`, no Python 3.12, no model) — never a delivery with a player and no glosses. `--libras` has not been released (it came after v10.0.0), so no published delivery command changes |
| `ui/camera-control.startCameraReader`, `CameraWords`, `CameraStartDeps`, `CameraStartFailure` · `sr.hands.failed`, `sr.face.failed`, `sr.eyes.failed` | new (ADR-0169, ADR-0215): the one place the hands, face and eyes controls start through — the reader, then the camera — so a vision runtime that REJECTS (a server sending `.mjs` as `text/plain`, a 404, a task the GPU and the CPU both refuse to build) is said to the child, written once in `problems` and puts the 📷 back to off, instead of dying as an unhandled rejection under a lit icon. ⚠️ **Behaviour a consumer may notice:** a start that fails after the 📷 already moved on (the child chose another mode, or the root was disposed) now says nothing and no longer turns the 📷 off over that newer choice — what `ui/voice-control` already did for the 👄 |
| ✖DO `scripts/libras-signs.json` · `inclusionist-heavy --libras` | new data (ADR-0234 route A, the Dev: «Autorizo»): the 632 sign bundles the engine's glosses use, pinned by sha256 and byte count at a commit of LAViD's `vlibras-dictionary-sources` (GPL-3.0; 15,086,780 bytes), delivered into `libras/signs/` with the GPL-3.0 and a NOTICE, so the avatar SIGNS those words instead of fingerspelling them. ⚠️ **Behaviour a consumer may notice:** a delivery built with `--libras` fetches 15.1 MB more, from `gitlab.lavid.ufpb.br` or from `--base` (under `vlibras-dictionary-sources-f8ddb37/FILES/BUNDLES/2018.3.1/WEBGL/BR/`, laid out as the other mirrored heavy files are; the project's bucket does not hold them), and stops on a byte that differs from the pin; and the player page's sign-set revision changes, so each device's player deletes its IndexedDB sign cache once, on its next start |
| `inclusionist-heavy --libras` · `scripts/libras-glosses/gloss.py` | behaviour (ADR-0234 erratum «A WORD WITH NO SIGN IS SPELLED AS IT IS WRITTEN»; the Dev: «Soletra-se a palavra escrita»): in the `glosses.json` a delivery writes, a token the delivery carries no sign for is the word AS WRITTEN on the screen (capitals, accents stripped to the base letter, as the run-time fallback spells) instead of the translator's lemma — «entrou» is spelled ENTROU, not ENTRAR. The file's shape is unchanged (`[text, gloss]` pairs), and so is the run-time fallback. ⚠️ **Behaviour a consumer may notice:** the glosser's answer now carries each text's written words, and a `gloss.py` that does not send them is REFUSED — an environment built for an older package keeps working, since the script travels with the package; and the delivery prints one more line, `spelled`, saying how the spelled tokens were found |
| `ui/libras-avatar-plan` (`ClipWindow.held`, `SignStep.word`, `createSignSequencer`'s third argument, `avatarManifestOf`) · `scripts/libras-avatar.json` · `scripts/libras-avatar.mjs` (`isSpelledClip`, `heldWindowsOf`, `avatarPinsFromExport`'s third argument, `deliveredManifest`) · `inclusionist-heavy --libras` (`libras/avatar/manifest.json`) | new, optional, and behaviour (interface log, 2026-09-26; the Dev: «Sim»): a fingerspelled word is signed with the HAND HELD UP between its letters. Each letter's and digit's clip carries `held: [up, down]` — where its hand is up, measured on the clip by the export's forward kinematics (`scripts/libras-export.mjs` `heldWindow`: 90 % of the rise to the height it holds; E, still, its whole clip) — in the pins and in the manifest a delivery writes; inside one spelled word the player starts a letter after the first at `up` and hands over at `down`, so the hand rises at the first letter and comes down after the last. Signs, a word of one letter and two neighbouring words are unchanged; digits are chained like letters. `SignStep.word` (a letter's word, by its place in the gloss) and `ClipWindow.held` are optional; the sequencer's third argument defaults to no windows, which is the old timing. ⚠️ **Behaviour a consumer may notice:** a spelled word takes less time — 📏 on a served delivery «PÕE» 4.37 s → 2.86 s, «TRIÂNGULO» 12.60 s → 5.35 s — so a request with one resolves sooner and the avatar leaves sooner after it; `planSigns` steps now carry `word`, so a test comparing them whole sees one more field; the pins' and the manifest's clip lines for the 37 letters and digits gain `held`, and no byte count or sha256 changes |
| ✖DO `ui/vlibras-player` · `VlibrasPlayerPorts.leaveAfterMs` | new, optional, and behaviour (interface log, «The Libras interpreter: bottom right, and only while it signs»; the Dev: «ele só deve aparecer quando for "invocado" via sonar e desaparecer quando não estiver em uso»): the interpreter's frame LEAVES THE SCREEN a pause after `counter_gloss` reports the last token (1 s unless `leaveAfterMs` says), hidden and NOT unloaded, so the next sonar press shows the same player at once; a press during the pause cancels the leaving; `hide()` and `dispose()` are unchanged. ⚠️ **Behaviour a consumer may notice:** a test that expected the frame to stay visible after a request resolved now sees it hidden after the pause |
| ✖DO `ui/vlibras-player` · `VlibrasPlayerPorts.leaveAfterMs` | behaviour, no shape change (interface log, «The interpreter leaves 5 s after the player itself says it stopped»; the Dev: «Sim.»): the frame leaves the screen 5 s (`leaveAfterMs` unless set) after THE PLAYER reports it stopped signing — `on_playing_state_change` with `isPlaying` turning from "True" to "False" — no longer 1 s after `counter_gloss` reaches its total, which still answers the request. A "True" within those seconds (every `playNow` sends "False" then "True") or a new call cancels the leaving; hidden, never unloaded; `hide()` and `dispose()` unchanged. ⚠️ **Behaviour a consumer may notice:** a player page pointed at with `playerFolder` that never sends `on_playing_state_change` now keeps the frame on the screen until `hide()` |
| `inclusionist-heavy --commands` · `heavyAtBoot({ commands })` · `HeavyOptions.only` | a widening and behaviour (ADR-0225 erratum; the Dev: «A entrega leva as três línguas.»): `commands` accepts a LIST of languages beside a single one, and the command models come in the list's order; `downloadHeavy` fetches `only` in the order given (it followed the catalogue's). `createGame` asks for the command model of every language the page can switch to, the boot language's first, so a switch mid-game — offline the next day — finds its model kept. `inclusionist-heavy` WITHOUT `--commands` now carries the pt, en and es Vosk models and their runtime; `--commands <lang>` (repeatable) narrows to the languages named, and the new `--commands none` carries none. `--reading` is unchanged. ⚠️ **Behaviour a consumer may notice:** a delivery built with the same command as before grows by 116,455,039 bytes (111.1 MiB; measured 2026-09-25 against the staging tree) — or by 80,865,466 (77.1 MiB) if it passed `--commands pt` and drops that flag; pass `--commands none` to keep the old delivery. Each device's start fetches up to 113.2 MB of command models instead of one language's 32–41 MB, the child's own first. The `problems` line for a missing command model now names both fixes — no `--commands`, or that language in its list — instead of `npx inclusionist-heavy --commands <lang>` alone, which would now narrow the delivery to that one language |
| ✖DO `platform/heavy-catalogue.HeavyFile.madeFrom` · `HEAVY_FILES` (`libras:player:framework:noeval`) · `inclusionist-heavy --libras` | new, optional field and a new entry (ADR-0234 route A, pillar 8): an entry with `madeFrom` is made by the DELIVERY from the entry it names and never downloaded by the build (the delivery prints it as `derived`); its `sha256` still pins the bytes a device may keep. The patched VLibras framework the player page RUNS (478,335 bytes) is now such an entry, so a device with deaf mode on fetches it from `heavy/`, checks it and keeps it like the four published files, and the delivery checks what it writes against the same pin — `scripts/vlibras-player.mjs` no longer exports `PATCHED_FRAMEWORK_SHA256`, and `LIBRAS_PLAYER_IDS` gains `patched`. ⚠️ **Behaviour a consumer may notice:** `heavyAtBoot({ libras: true })` asks for five `libras:` files instead of four, and a `downloadHeavy` without `only` and `bytesLeftToDownload` count 0.46 MiB more |
| ✖DO `platform/heavy-catalogue.DELIVERY_LISTS`, `DeliveryList` · `inclusionist-heavy --libras` | new (ADR-0234 route A, pillar 8): a list a delivery writes of its OWN files, with the sha256 and size of each — for what no catalogue can pin because each delivery makes it. The one list is `libras:delivery`: a delivery built with `--libras` now writes, last, `libras/offline.json` (`{ format: 1, files: [{ path, sha256, bytes }] }`) naming the player's page, glue, shim, parser, Unity configuration, `glosses.json` and every sign it carries (📏 the engine's delivery: 638 files, 15,153,760 bytes), and prints an `offline` line. A listed path outside `libras/player/` and `libras/signs/` stops the delivery. `scripts/vlibras-player.mjs` gains `writeDeliveryList` and `librasListPaths` |
| ✖DO `platform/heavy.downloadHeavy` · `heavyAtBoot({ libras })` | behaviour, no shape change (ADR-0234 route A, pillar 8): `downloadHeavy` also reads the delivery's lists (`DELIVERY_LISTS`) named in `only` — or all of them without `only` — AFTER the catalogue's files, fetching each listed file from the page's origin under `?sha256=<its hash>`, keeping it in `incl-pesados-v2` under its own address only if its bytes match the list, with the listed hash in an `x-inclusionist-sha256` header so a later start fetches nothing kept and anything the list changed; ONE report per list (`baixado` with the bytes fetched, `ja-tinha`, or `falhou` naming up to five files refused and why). A list naming anything outside its folders is refused whole. `heavyAtBoot({ libras: true })` adds `libras:delivery` after the five player files. ⚠️ **Behaviour a consumer may notice:** `onHeavyProgress` hears one more report while deaf mode is on — `falhou … HTTP 404` from a delivery built without `--libras`, as for its player files — and a device with deaf mode on keeps 15.2 MB more (the engine's delivery); `bytesLeftToDownload` does not count a list, whose size is known only once it is read |
| ✖DO the engine's service worker (`vite.config.ts`) | behaviour (ADR-0234 route A, pillar 8): a new `CacheFirst` route answers `…/libras/player/*` and `…/libras/signs/*` of the page's own origin from `incl-pesados-v2` — the files the start kept from the delivery's list — and on a miss asks this origin, writing nothing. With it, a device that booted once online with deaf mode on opens the player, runs it and plays the signs the delivery carries with no network. ⚠️ **Behaviour a consumer may notice:** a cartridge that builds its own service worker from this configuration gets the route too; one that writes its own must add an equivalent, or its Libras player stays online-only |
| `ui/vlibras.SignResult` · `ui/vlibras.signedInPartLine` | a widening (ADR-0234 route B, phase B2; ADR-0169): the `signed: true` answer gains an optional `unsigned` — what the interpreter left out of the text, and why — and deaf mode writes it once in `problems` (`signedInPartLine`) without telling the child «unavailable», since she saw the rest signed. An interpreter that never sets it is unchanged, and so is every reader of `signed` and `reason` |
| ✖DO `ui/libras-avatar-player.createLibrasAvatarInterpreter`, `LibrasAvatarPorts` · `ui/libras-avatar-plan`, `ui/libras-avatar-clip`, `ui/libras-avatar-load`, `ui/libras-avatar-stage` · `inclusionist-heavy --libras-avatar` · `scripts/libras-avatar.json` | new (ADR-0234 route B, phase B2): the FREE Libras player — LAViD's signs on a three.js avatar — behind the same `Interpreter` port route A implements. It is NOT the default: `createGame` still builds the VLibras player; a host lends this one through `EngineHost.interpreter` (the demo quiz does with `?libras=avatar`). A delivery built with `--libras-avatar` carries its avatar and 655 clips — the 632 signs the glosses use and the manual alphabet's 23 other letters (34,283,274 bytes) — in `libras/avatar/`, checked by sha256 and read from `--base` under `vlibras-avatar-f8ddb37/` (the project's bucket does not hold them yet). ⚠️ **Behaviour a consumer may notice:** the package gains its first run-time `dependency`, `three` pinned to exactly `0.186.1` (MIT), so a consumer's `npm ci` installs it; it is imported only by `ui/libras-avatar-stage`, reached by a dynamic `import()` at the first sign, so a bundler cuts it into a chunk of its own that a page loads only when the free player first signs, and the engine's own service worker does not precache it |
| ✖DO `platform/heavy-catalogue.DELIVERY_LISTS` (`libras:avatar:delivery`) · `LIBRAS_AVATAR_FOLDER`, `LIBRAS_AVATAR_STAGE_CHUNK` · `heavyAtBoot({ libras })` | new entry and constants (ADR-0234 route B, phase B3, pillar 8): a second delivery list, `libras/offline-avatar.json`, names the free player's files — `libras/avatar/` and the stage chunk whose name starts `assets/libras-avatar-stage-` — and a device with deaf mode on keeps each, checked by sha256, by the same rule as route A's list. `DeliveryList.folders` may now hold a NAME's start (no trailing `/`) as well as a folder. `LIBRAS_AVATAR_FOLDER` is now written in the catalogue; `ui/libras-avatar-plan` re-exports it unchanged. ⚠️ **Behaviour a consumer may notice:** `heavyAtBoot({ libras: true })` ends with `libras:avatar:delivery` after `libras:delivery`, so `onHeavyProgress` hears one more report while deaf mode is on — `falhou … HTTP 404 — libras/offline-avatar.json` from a delivery built without `--libras-avatar` — and a device whose delivery carries both players keeps both (the rule is «what the delivery carries, deaf mode keeps») |
| ✖DO `inclusionist-heavy --libras-avatar` · `scripts/libras-avatar.mjs` (`stageChunkOf`, `avatarListPaths`, `writeAvatarList`) | behaviour and new script exports (ADR-0234 route B, phase B3, pillar 8): the step now finds the build's stage chunk FIRST — exactly one `assets/libras-avatar-stage-<hash>.js`, or it stops before downloading anything — and, last, writes `libras/offline-avatar.json` (`{ format: 1, files: [{ path, sha256, bytes }] }`) naming the avatar's manifest, `avatar.glb`, every clip and that chunk with the sha256 of the bytes on the disk (📏 the engine's delivery: 635 files, 34,372,868 bytes), and prints an `offline` line. ⚠️ **Behaviour a consumer may notice:** `--libras-avatar` must run after the page's build, on its output folder, with the output emptied between builds; a build that never emitted the free player's chunk, or left two, now stops the step |
| the engine's service worker (`vite.config.ts`) · `scripts/check-precache.mjs` | behaviour (ADR-0234 route B, phase B3, pillar 8): the Libras `CacheFirst` route also answers `…/libras/avatar/*` and `…/assets/libras-avatar-stage-<hash>.js` of the page's own origin from `incl-pesados-v2` — the files the start kept from `libras/offline-avatar.json` — and on a miss asks this origin, writing nothing. The chunk is matched by its name alone, so no precached asset is shadowed (the precache route is registered first in any case). The chunk stays out of the precache. ⚠️ **Behaviour a consumer may notice:** a cartridge that builds its own service worker from this configuration gets the wider route; one that writes its own must add an equivalent, or its free Libras player stays online-only |
| `ui/libras-avatar-load.prepareClips` | behaviour, no shape change (ADR-0234 route B, phase B3): a clip is fetched at its name as a URL spells it (`new URL('clips/PRIMEIRO&ORDINAL.json', folder)`), no longer through `encodeURIComponent`, so it is the address `libras/offline-avatar.json` keeps it under. Online nothing changes — the server decodes both — but offline the two clips with `&` in their names were never found in the checked cache. ⚠️ **Behaviour a consumer may notice:** a host serving the avatar from a server that treats `&` in a path differently from `%26` sees another request line for those two clips |
| ✖DO the engine's service worker (`vite.config.ts`, `ignoreURLParametersMatching`) | behaviour (ADR-0234 route B, phase B3, pillar 8): the precache ignores a `libras` query parameter when matching, beside Workbox's own defaults (`utm_*`, `fbclid`), so `quiz.html?libras=avatar` — the demo lending the free Libras player — is answered by the precached `quiz.html` and opens offline. ⚠️ **Behaviour a consumer may notice:** a cartridge that builds its service worker from this configuration and uses a `libras` query of its own gets its page from the precache for it too |
| ✖DO `ui/libras-glosses.provisionalGloss` · `inclusionist-heavy --libras` (`glosses.json`) · `ui/libras-avatar-plan.planSigns` | behaviour, no shape change (ADR-0234 erratum «A WORD WITH NO SIGN IS SPELLED AS IT IS WRITTEN»; the Dev: «Soletra-se a palavra escrita»): a fingerspelled word keeps its Ç — «caça» is spelled C-A-Ç-A, no longer C-A-C-A — in the `glosses.json` a delivery writes (`scripts/libras-glosses.mjs` `spelledWord`), in the run-time fallback (`provisionalGloss`), and so in both players; an accented vowel is still spelled as its base letter (Ã → A, É → E). Ç is a letter of the Libras manual alphabet, with its own handshape and movement: 📏 route A's VLibras player spells «CAÇA» C-A-Ç-A from a clip of its own (it asks `libras/signs/` for no `Ç` bundle, and none is pinned), and route B's delivery carries a `Ç` clip. ⚠️ **Behaviour a consumer may notice:** 12 of the engine's 598 glossed texts change, each only by a spelled C that is now Ç («Sons de navegação» → `SOM NAVEGAÇAO`, «Desça!» → `DESÇA [EXCLAMAÇÃO]`), and a game's own texts with Ç change the same way on its next delivery; `provisionalGloss('Açaí')` returns `AÇAI`, no longer `ACAI`; with route B, a word with Ç is spelled with the `Ç` clip — every delivery built from this version carries it, and a manifest without it would leave such a word out, said in `problems`, where it used to be spelled with C |
| `createGame`'s keyboard conductor · `input/key-default` (`cancelsKeyDefault`, `KeyTargetLike`) | behaviour, and a new module (ADR-0111 erratum of 2026-09-26): a key the engine DELIVERS to the game through `onCommand` is spent — the conductor cancels its browser default, so Space on a focused `<button>` is the game's `action2` and no longer ALSO the button's click on the release. 📏 Measured before the change with a minimal game and real keys: one Space, two actions. What keeps its default: a key the engine does not deliver (unmapped — Tab, Escape, any other —, refused by an open menu, or signed by another transport), a key typed into an input, textarea, select or contenteditable, and a key on the engine's own accessibility bar (`.pi-btn`), which stays in the tab order in play. `ui/menu-nav`, the quick pause and Escape are unchanged. The demo quiz's own guard (e1fe84ba) left with it. ⚠️ **Behaviour a consumer may notice:** a cartridge that declares `onCommand` and relied on a mapped key's NATIVE action on its own DOM — Space pressing a focused button, an arrow scrolling the page — no longer gets it while in play; it answers the position in `onCommand`, where it already arrived. 📏 None of the six sibling games declares `onCommand` (read-only `git grep`, 2026-09-26), and a cartridge without it sees no change: the conductor delivers nothing to it |
| `heavyAtBoot({ reading })` | a widening and behaviour (ADR-0225 erratum of 2026-09-26; the Dev: «Negativo, baixar os três. Toda criança vai experimentar as três línguas imediatamente.»): `reading` accepts a LIST of languages beside a single one, as `commands` does, and the ids come ranked by language — a file of a language takes that language's position in the list it was asked by, a file of no language (the runtimes, vision) the first, in the catalogue's order within a position. `createGame`, for a game that declares `uses: { reading: true }`, asks for the reading models of every language the page can switch to, the boot language's first. ⚠️ **Behaviour a consumer may notice:** a device of a game that listens fetches up to 850 MiB of reading models (pt 378, en 162, es 310) instead of its boot language's alone, the child's whole language first; and `heavyAtBoot` asked with languages returns its ids in that order — with a list of languages, the vision files now come before the other languages' command models (they came after them). A single language, or none, returns the ids it returned before |
| `platform/reading-in-worker.keepOneThreadPerLanguage`, `ReadingThreads` · `createGame`'s reading · `sr.reading.failed` | new, and a fix (issue #185; ADR-0225 erratum of 2026-09-26): the root keeps ONE reading thread per base language — a second reading in the same language reuses it, a reading after a language switch closes the old thread and opens the new language's, and a thread whose opening failed is forgotten so the next reading opens it again. It used to close and reopen the thread at every `listen()`, compiling up to 378 MiB of model again per reading. When the thread cannot open, the child now hears `sr.reading.failed` (new key in pt, en and es) through the assertive region. ⚠️ **Behaviour a consumer may notice:** the `problems` line of a thread that could not open now names the language and BOTH fixes — `npx inclusionist-heavy --reading` alone, or that language in the `--reading` list — instead of `--reading <language>` alone, which would now narrow the delivery; a test matching `the transcription thread could not open — ` must allow `for <language>` before the dash; and `#sr-alert` is written on that failure |
| `inclusionist-heavy --reading` · `scripts/heavy-into-the-delivery.mjs` (`readingLanguagesOfTheDelivery`, `idsOfTheDelivery`) | a widening and behaviour (ADR-0225 erratum of 2026-09-26; the Dev: «Negativo, baixar os três.»): `--reading` with no value — last, or before another flag — or `--reading all` carries every language the catalogue has a reading model for (pt, en, es); `--reading <language>` still repeats and narrows, with the same bytes as before; the new `--reading none` carries none, like no flag. `argumentosDaEntrega` keeps its shape (the bare flag is `'all'`); the new `readingLanguagesOfTheDelivery(asked, catalogue, readingLanguageOf)` resolves the list, and `idsOfTheDelivery` takes `readingLanguageOf` beside `commandsLanguageOf`. The run prints a `reading` line. ⚠️ **Behaviour a consumer may notice:** a language the catalogue has no reading model for now STOPS the command with exit 2, naming it and the languages it has, before a byte is fetched — `--reading fr`, or a folder written after the flag (`--reading dist`), used to carry nothing in silence; put the folder first. `--reading` directly before the folder (`--reading dist`) still reads the folder as a language. A delivery built with `--reading pt` still carries Portuguese alone: its devices ask for the en and es models too (two quiet 404s in `onHeavyProgress`), and a child who reads in those languages is told reading could not start, with the fix in `problems`. 📏 Measured 2026-09-26 on the engine's `dist` from the local staging tree: `--reading` 1,079,687,568 bytes, `--reading pt` 584,586,876 (+495,100,692 bytes, 472.2 MiB, for the other two), no `--reading` 160,916,123 |
| `createGame`'s keyboard conductor · `input/key-default` (`keyGoesToGame`, `BUTTON_ACTIVATION_KEYS`) · `VirtualController.press(…, toPlay?)` · `MenuNavApi.consumed` · the demo quiz | behaviour, and additive shape (ADR-0111 errata of 2026-09-26: one key press is one action; this row narrows the one above). 📏 Measured on the served quiz with real keys, each one press doing two things: Space on ☰ opened the menus AND answered; Space on «resume» closed the card AND answered; typing into a text field in play moved the cursor and answered; with the focus on «Quatro», Space answered «Três». A key that went to something else is no longer ALSO delivered to `onCommand`: a key typed into an input, textarea, select or contenteditable (it keeps its default, as before); Space, Enter or NumpadEnter on the engine's own focused control (`.pi-btn`), which it presses (other keys there — an arrow, a letter — are still delivered, and now also lose their default); and any key the engine's menus consumed in the same event, including one that closed the last menu (resume, «no» at the card's root, a step on the quick bar). `VirtualController.press` gains an optional fourth argument, `toPlay` (false: nothing held or delivered in play; with a menu open the press is the menu's as before), and `MenuNavApi` gains `consumed(e)`. `cancelsKeyDefault`, added after v10.0.0, leaves unpublished. The demo quiz's cursor now follows the focus, with `aria-checked`. ⚠️ **Behaviour a consumer may notice:** a cartridge that declares `onCommand` no longer hears a mapped key typed into its own text field, nor a key pressed on its own `<select>`, in play; one that implements `MenuNavApi` itself must add `consumed`. A cartridge without `onCommand` sees no change |
| `platform/reading-runtime.loadReadingRuntime` (English and Spanish) · `platform/reading-model` (`inWholeFrames`, `waveFrameOf`, `WaveFrameConfig`) | a fix, and new names (issue #185): Moonshine streaming's encoder cuts the wave into frames of `encoder_config.frame_ms` at `encoder_config.sample_rate` — 5 ms, 80 samples — and onnxruntime refused any other length (`Input shape:{1,45056}, requested shape:{1,-1,80}`), so every English and Spanish reading whose length was not whole frames failed and the child heard «This device cannot listen right now». 📏 Measured 2026-09-26 on a served delivery: before, a recording of 20 microphone blocks (81,920 samples) was read and one of 19 or 21 failed; after, 77,824, 86,016 and 233,472 samples are read. The wave is now filled with zeros at the END to the next whole frame, as the model's own processor does (`pad_to_multiple_of: 80`), with the frame read from the `config.json` the catalogue already fetches; an empty recording becomes one frame of silence. Whisper (pt) is unchanged. ⚠️ **Behaviour a consumer may notice:** English and Spanish readings answer text where they failed; the encoder is handed up to 79 more samples of silence (under 5 ms) after the child's wave, which is untouched |
| `inclusionist-heavy --commands` · `scripts/heavy-into-the-delivery.mjs` (`commandLanguagesOfTheDelivery`) | behaviour: a `--commands` language the catalogue has no command model for now STOPS the command with exit 2, naming it and the languages the catalogue has (pt, en, es), before a byte is fetched — as `--reading` does. 📏 Measured 2026-09-26: `--commands xx` used to print `commands  xx` and carry the three command runtime files and no model. A regional tag is its base language (`--commands pt-BR` carries `pt`, and the `commands` line prints `pt`). ⚠️ **Behaviour a consumer may notice:** a build script that passed an unknown language — or a misspelt one — to `--commands` now fails instead of producing a delivery that carries a runtime able to open nothing; `commandLanguagesOfTheDelivery` throws for such a list, and `idsOfTheDelivery` with it |
| `createGame`'s reading where the host has no `Worker` | a fix (issue #185): the root keeps ONE reading runtime per base language on this thread too, by the rule the worker path already follows (`keepOneThreadPerLanguage`) — a second reading reuses it, a language switch loads the new language's, a load that failed is forgotten and tried again at the next reading, and the cartridge leaving lets it go. It used to load the runtime again at every `listen()` — up to 378 MiB fetched and compiled per reading, on the thread that draws the game. ⚠️ **Behaviour a consumer may notice:** the `problems` line `reading: this browser has no \`Worker\` …` is written once, not once per reading; a host without `Worker` sees one model load per language instead of one per reading |
| `input/virtual-controller` (`VirtualController.press`) · `input/key-default.keyPressesOwnControl` · `createGame`'s START listener and print mode | behaviour, and one new export (ADR-0111 erratum of 2026-09-26; ADR-0144 §4, ADR-0155 §4; this row narrows the two above). 📏 Measured on the served quiz with real keys, the quiz's `onCommand` wrapped in flight: Enter in play opened the quick pause AND `onCommand` heard `start`, press and release; F opened the card AND it heard `select`; Enter on the focused ☰ opened the quick pause instead of pressing ☰; the arrow that ended print mode brought the card back AND was heard as `down`. After: `onCommand` hears none of the four, Enter on ☰ opens the menus as Space does, and Enter elsewhere in play, H on ☰ and Enter on the quick pause's bar behave as before. The virtual controller never delivers `start` or `select` to play, from any transport — a cartridge may not declare either, so none has a word for them; with a menu open they are still the menu's key. `keyPressesOwnControl` is the question `keyGoesToGame` already asked, now published so START's listener asks it too. Not breaking: a read-only `git grep` of the seven sibling game repositories finds no `onCommand`, so no consumer hears `start` or `select` today. ⚠️ **Behaviour a consumer may notice:** a cartridge with `onCommand` that read `start` or `select` although it could not declare them no longer hears them; the engine's pause is their only meaning |
| `platform/heavy-catalogue` (`voz:runtime:fonemas`, `voz:runtime:fonemas:wasm`) · `platform/heavy-mirror` (`MIRROR_FOLDERS`, `NOT_MIRRORED`) · `scripts/licences/third-party.mjs` (the `espeak-ng` group) · `inclusionist-heavy --kokoro` | behaviour, no shape change (ADR-0203 erratum, issue #192; the Dev: «Minha escolha é a c, compilar nós mesmos o .wasm.»): the neural voice's phonemizer is the project's own build of eSpeak NG, commit `530bf0ab`, made by `scripts/models/build-espeak-ng.ps1` with its data cut to the pt, es and en voices (and the de and fr dictionaries Portuguese hands words to). The two catalogue entries now name `https://lfs-oinclusionista.jrocha.dev.br/espeak-ng-530bf0a/espeak-ng.js` and `…/espeak-ng.wasm` (70,951 and 1,493,661 bytes) instead of jsDelivr's `espeak-ng@1.0.2/dist/…` (178,386 and 18,485,010); `NOT_MIRRORED` is empty; the delivery's `SOURCE` beside them names the commit and the recipe instead of an unverified revision. 📏 The same phonemes and the same Kokoro token ids for all 2,590 utterances of the engine's three dictionaries in pt-br, es-419, en-us and en-gb (`models.md`). ⚠️ **Behaviour a consumer may notice:** a delivery built with `--kokoro` carries 17,098,784 bytes (16.3 MiB) less, and a device that turns the neural voice on fetches that much less; the files sit at `heavy/lfs-oinclusionista.jrocha.dev.br/espeak-ng-530bf0a/` instead of `heavy/cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/`, so a page and its delivery are rebuilt together (a delivery made before carries the old path, which the engine no longer asks for); until the Dev uploads the folder, `--kokoro` without a `--base` that holds it fails these two files with HTTP 404 and exits 1 («the delivery is incomplete»), and a page served from such a delivery refuses the neural voice naming `voz:runtime:fonemas`; a device that kept the old two files keeps them in `incl-pesados-v2`, unused |
| `input/virtual-controller` (`VirtualControllerDeps.systemPress`) · `createGame`'s START listener and keyboard conductor | behaviour, and an optional field (ADR-0144 §1 and its erratum of 2026-09-26, ADR-0155; this row widens the one above on system positions): START and SELECT pressed on the virtual controller IN PLAY now open the engine's pause for the seat that pressed — START the quick pause (START again leaves it), SELECT the card — instead of being dropped. That is what the keys already did; it is new for the transports that press the controller directly: the eyes, the face, the hands, the voice and the scan. 📏 Measured on the served quiz for `olhos`, `rosto`, `gestos` and `fala`: before, START, START again and SELECT changed nothing; after, PAUSADO with the bar cursor, back to play, the card. `VirtualControllerDeps` gains `systemPress?(action, player)`, called for `start`/`select` in play (never for a press with `toPlay` false, never with a menu open, where the position is still the menu's key); absent, nothing happens, as before. `onCommand` still hears neither. The keyboard conductor no longer presses the two on the controller — their keys are answered by the engine's own listeners, as before. ⚠️ **Behaviour a consumer may notice:** a game played by camera or voice now PAUSES on that transport's START (both eyes closed for 2 s, a long squeeze, 🤟, «start») and opens the menus on SELECT (the dog, «select»); a host that builds `createVirtualController` itself gets the old behaviour until it passes `systemPress` |
| `input/virtual-controller` (`VirtualController.press`, `VirtualControllerDeps.systemPress`) · `createGame`'s `systemPress` | behaviour (ADR-0144 erratum of 2026-09-26; this row narrows the one above): with a menu open, `start` and `select` are no longer handed to the menu as the FIRST key the child bound to them — they go to `systemPress` as the position, as in play, and the root answers them with its START and SELECT listeners' own functions: START again leaves the quick pause, SELECT goes on to the card, an open card or panel refuses both. 📏 Measured before: with `start` bound to `Enter` alone, a camera's START in the quick pause was the bar's «confirm» — the icon under the cursor was pressed and the game stayed frozen; in the solo scheme (`KeyH` first) it only worked because H means nothing to a menu. `systemPress` is now called with a menu open too, whatever `toPlay` says there; in play a press with `toPlay` false still reaches nobody. The keyboard is unchanged: its Enter on the bar is still «confirm». ⚠️ **Behaviour a consumer may notice:** a host that builds `createVirtualController` itself WITHOUT `systemPress` now gets nothing for START or SELECT with a menu open, where it used to get the first bound key; a host with `systemPress` receives the call in menus too |
| `input/gamepad` (`GamepadCtx.press`) · `createGame`'s gamepad | behaviour, and a widened parameter: the pad's SELECT button (8 in the standard table) now PRESSES `select` on the virtual controller on its edge, for the pad's seat (a pad nobody has seated yet presses for seat 0) — so it opens the card in play, goes on from the quick pause to the card, and does nothing over an open card or panel, as the keyboard's F. It used to be read and ignored. `GamepadCtx.press` receives `'select'` beside the eight positions. A pad with a map recorded in the mapping wizard has no SELECT (the wizard does not ask for one), as before. ⚠️ **Behaviour a consumer may notice:** a host that implements `GamepadCtx.press` itself with its parameter ANNOTATED as `ActionKey` must widen it to `ActionKey \| 'select'` (an unannotated arrow is typed by the context and compiles as it is); a read-only `git grep` of the sibling games (2026-09-26) finds `initGamepad` in `game-platformer` and `game-soccer`, neither passing `press` (they consume `^9.0.0`) |
| `ui/scan-overlay.scanItemText` · `input/switch-scan` (`createSwitchScan`, `ScanItem`, `ScanOutput`, `SwitchScan`) · `ui/menu-intent` (`MenuStep`, `MENU_SCAN`, `menuStepKeys`) · `MenuNavApi.navIntent` · `scan.menu.*` | 🔴 BREAKING for a caller of `scanItemText`, and new names (ADR-0218 erratum of 2026-09-26): one-button scanning works inside the engine's menus. With the quick pause, the card or a panel in front, the scan offers that menu's steps — «cancel · next · confirm · back · previous» — and a press moves the menu through `MenuNavApi.navIntent(player, keys)`, the path and guards `menuNavKey` applies to a key; the list changes, from «cancel», when a menu opens or closes. 📏 Measured before: inside any menu a scan press did nothing — the switch's key is stopped before any listener and reached the menu-key translator stamped `teclado`, which never re-sends a keyboard key — so a child who opened the quick pause by scanning was left in it. `scanItemText(item, label, t)` takes the root's translator as its third argument instead of the word for «cancel», and says the engine's word for the engine's items; `createSwitchScan` and its types are generic over the items offered (default `Action`, so existing calls compile unchanged). New dictionary keys `scan.menu.next`, `scan.menu.confirm`, `scan.menu.back`, `scan.menu.previous` in pt, en and es. ⚠️ **What a consumer must do:** a caller of `scanItemText` passes a `Translate` instead of a string; a double of `MenuNavApi` adds `navIntent`. A read-only `git grep` of the sibling games (2026-09-26) finds neither called; `game-platformer` calls `initMenuNav` and receives `navIntent` with it |
| `input/switch-scan` (`playScanList`, `ScanDoors`) · `createGame`'s scan · `scan.door.*` | behaviour, and new names (ADR-0218 §3, «then the doors the engine itself opens», and its erratum of 2026-09-26): in play, after the game's named positions, the scan offers «menu» (SELECT: the card, where the card is mounted) and then «pausar» (START: the quick pause, where the quick pause has its bar); a door with nothing behind it is not offered. Taking one presses the position on the virtual controller, which hands it to the engine (`systemPress`). New dictionary keys `scan.door.menus` and `scan.door.pause` in pt, en and es. ⚠️ **Behaviour a consumer may notice:** a pass in play is up to two items longer, so a child scanning a game waits up to two more steps for «cancel» to come round again |
| `ui/menu-intent` (`MenuCursor`, `menuScanFor`, `MenuStep`) · `MenuNavApi.underCursor` · `createGame`'s scan · `scan.menu.increase`, `scan.menu.decrease` | 🔴 BREAKING for a double of `MenuNavApi` (note DQ), and new names (ADR-0218 erratum of 2026-09-26, the sideways step): with a panel's cursor on a control that has a value, the menu's pass offers «increase» and «decrease» right after «next» — the right and left keys' intents, through `navIntent`: the next option of a list, one step of a slider, the ⯈ or ⯇ of a steps row. On a slider or a steps row the pass drops «confirm», which does nothing there; on a list it keeps it. On a button, a switch, the quick bar or the pause card the pass is unchanged. When the cursor reaches a control of another kind the pass starts again from «cancel». `menuScanFor(cursor)` gives the list; `MENU_SCAN` keeps its value. New dictionary keys in pt («aumentar», «diminuir»), en and es («aumentar», «disminuir»). 📏 Measured before: on a panel's slider the pass was «cancel · next · confirm · back · previous», and none moves a value. ⚠️ **Behaviour a consumer may notice:** a pass on a slider or a steps row is one item longer (two added, «confirm» dropped), on a list two longer, so «cancel» comes round that much later |
| `input/virtual-controller` (`VirtualControllerDeps.takeShown`) · `input/gamepad` (`GamepadCtx.takeShown`) · `createGame`'s scan and pointer listener | behaviour, and two optional fields (ADR-0218 §4, «what selects is ANY input»): with one-button mode on, every press takes the item the scan shows. The virtual controller asks `takeShown(source)` first, for every press, so the eyes, the face, the hands, the voice, the on-screen pad and the gamepad's positions collapse at one door; a taken press reaches nothing — not play, not a menu, not the engine's START or SELECT — and no release is owed for it. The gamepad, which also steers menus and the pause without pressing a position, asks `takeShown()` once per frame in which a button went down. The root's pointer listener takes a touch on `#game-region` or `#touch-controls` and swallows the click after it, except on the quick bar: ☝️ (the way out of one-button mode), 📷, 👄 and the other icons stay themselves. A press that lands on «cancel» still means nothing. Absent, both fields change nothing. 📏 Measured before: only keys collapsed — with the chip on «Cima», a click answered the quiz's button, a camera's «Confirmar» answered and its START opened the pause, the pad's START pill paused. ⚠️ **Behaviour a consumer may notice:** while one-button mode is on, a game's own buttons in the game region no longer receive pointer events or clicks, and a host that drives `createGame`'s `controller` sees its presses taken by the scan; a host that builds `createVirtualController` or `initGamepad` itself gets the old behaviour until it passes `takeShown` |
| `createGame`'s speech lock · `ui/voice-settings` (`createVoiceSettings`, its `whenVoicesChange` port) · `audio.comVoz` | a fix, behaviour, no shape change (ADR-0185 erratum of 2026-09-26; engine `cb797964` on branch `late-voices-unlock`): the lock of ADR-0185 §4 now follows the DEVICE's voices while the child looks, both ways. 📏 Measured before, with a host whose `getVoices()` answered `[]` and then a pt-BR voice with `voiceschanged`: a hearing panel opened before the voices kept its five speech rows locked, the «Voz» list said «Nenhuma voz», and the bar's 🗣 stayed greyed out, though the press itself already spoke — a child whose device has a voice was told narration was unavailable. Now, when the voices change, the rows are unlocked or locked again IN PLACE (the same nodes, the focus kept), the «Voz» list is drawn again only when its voices differ, and every bar's 🗣 is reflected. Nothing is said unless the lock flips on the row under the focus: then its footer shows what focusing it shows now — the reason when it locks, heard once through the footer's `aria-live`, and the row's own explanation when it unlocks — and an unlock also says «Agora há uma voz que fala este idioma.» (new key `audio.comVoz` in pt, en and es). The root takes the page's one `onvoiceschanged` slot and hands each change to the panel and the bars. ⚠️ **Behaviour a consumer may notice:** the root takes `speechSynthesis.onvoiceschanged` at boot even in a game without the hearing panel (it took it only with the panel), so a page that sets its own handler before `createGame` loses it there too; a host that builds `createVoiceSettings` itself and fires its `whenVoicesChange` sees the rows' `aria-disabled` and `data-motivo` change and, with the focus on a speech row, one `srSay` on an unlock |
| `ui/voice-control` (`VoiceControlDeps.oneButtonOnly`) · `createGame`'s 👄 | 🔴 BREAKING for a caller of `createVoiceControl`, and behaviour (ADR-0218 §4 and its erratum of 2026-09-26; ADR-0194 §2; one input, one action): with one-button mode on, a word heard is ONE press of the switch and nothing else — a menu item's name is no longer pointed at before its press, so it takes the step the scan shows, like any other word. `VoiceControlDeps` gains `oneButtonOnly(): boolean`, REQUIRED and asked for every word heard; `createGame` answers it with the stored one-button position. 📏 Measured before, on a root with the pause card open: on «cancelar» a name said moved the cursor to its item; on «próximo» the cursor went to the named item AND one step on; on «confirmar» the named item was activated — one utterance, two actions. With one-button mode off nothing changes: a name is still a cursor and a confirm. ⚠️ **What a consumer must do:** a caller of `createVoiceControl` passes `oneButtonOnly` — `() => false` keeps the old behaviour where no scan exists. A read-only `git grep` of the sibling games (2026-09-26) finds no `createVoiceControl` |
| `createGame`'s `speech.speakSample` (the hearing panel's «test voice», `#opt-tts-test`) | a fix, behaviour, no shape change (ADR-0185; engine `ccefaa41` on branch `voice-sample-language`): the sample the root speaks through the browser's synthesiser is tagged with the page's language — `bcp47()`, read at every press, so `en-US` or `es-MX` on an English or Spanish page and the new language after a switch — instead of `pt-BR` always. Its text already came from the page's dictionary: 📏 measured before, with a lent host recording each utterance, an English page sent «Hello! This is the Inclusionist narration voice…» tagged `pt-BR`, and with no voice chosen the browser read it with a Portuguese voice. A chosen system voice is handed to the sample only if the engine's voice list for the page's language (`tts.voices()`, ADR-0185) has it: the page's `#tts-voice` list offers every voice when none speaks the language, and the voice picked before a language switch outlived it (📏 measured: a pt-BR voice chosen at boot was still handed the English sample). `platform/speech`'s `gameSay`, the literacy voice, stays Portuguese. ⚠️ **Behaviour a consumer may notice:** on a page that carries `#opt-tts-test`, the sample's `SpeechSynthesisUtterance.lang` changes on an English or Spanish page, and where the device has no voice for the page's language the sample goes with no voice set, for the browser to choose by the tag, instead of with the other language's voice picked in `#tts-voice`. A read-only `git grep` of the sibling games (2026-09-26) finds `#opt-tts-test` and `#tts-voice` in `game-platformer`'s `app/index.html` (it consumes `^9.0.0`); a host that builds `initSettingsAudio` itself speaks through its own `speakSample` and sees no change |
| `Tts.narrate` (`Engine.tts.narrate`) · `platform/tts` (`SpokenPart`, `SpokenText`, `TtsCtx.report`) · `platform/voice-plan` (`voiceOfLanguage`, `languageName`, `speaksLanguageOf`) · `platform/interruptible-speech` (`speak(request, finished?)`, a third type parameter `Request = string`) · `sr.tts.noVoiceForLanguage` | a widening, new names, and behaviour (ADR-0243 §1, §2, §3, §5; engine `6353acb7`, `8c803f5b`, `b7111d32` on branch `speech-language`): `narrate` takes a text as before, or a list of parts `{ text, language? }` spoken in order — a part without `language` in the interface's voice, a part with a BCP-47 `language` in a voice of that language, chosen by `voiceOfLanguage` (the child's chosen voice if it speaks the language, else the exact tag, else the first voice of the same language, the browser's before the neural; never another language). Web Speech gets one utterance per part, each with its `lang` and `voice`; a loaded Kokoro model reads a part with the part's voice and phonemizer. A part whose language has no voice on the device is not spoken; once per language the interface's voice says so (new key in pt, en and es) and `problems` gets one line naming the language and the fix — through the new optional `TtsCtx.report`, which `createGame` fills. `InterruptibleSpeech.speak` gains an optional `finished`, called once however the utterance ends. ⚠️ **Behaviour a consumer may notice:** after a language switch, narration no longer keeps a browser voice object of the old language — the new language's voice speaks (📏 measured before: English narration from the pt-BR voice); the interface's voice is now the exact tag's before the first voice of the language, so a pt-BR page whose device lists pt-PT before pt-BR speaks pt-BR, and, in a game that declared a neural voice, a pt-BR page whose device has only pt-PT now narrates with Kokoro's pt-BR voice and downloads it; a newer narration also silences a neural part still speaking. A `tts` a game builds itself (`game-platformer` calls `createTts`) gets no `problems` line unless it passes `report`. A read-only `git grep` of the sibling games (2026-09-26) finds `narrate` called with a text in `game-2048`, `game-pinball` and `game-platformer` — unchanged for them |
| `ui/audio-choices.pickVoicesFor` · `ui/voice-settings` (`#opt-tts-test`) | behaviour, no shape change (ADR-0185 §4, with ADR-0243 §3; engine `9324d8fa`, `5857de37` on branch `speech-language`): the system-voice list offers only the voices of the page's language — with none, none, where it fell back to every voice and chose the first (📏 measured before: an English page on a device with only a pt-BR voice chose that voice in `#tts-voice`); and the «test voice» button a page may carry locks with the speech rows when no voice speaks the language (`aria-disabled`, the reason said on a press, no sample and no neural download). ⚠️ **Behaviour a consumer may notice:** a page's `#tts-voice` says «no system voices» on a device without a voice of the page's language, and its `#opt-tts-test` refuses; a test that expected the whole list back from `pickVoicesFor` now gets `[]`. A read-only `git grep` of the sibling games (2026-09-26) finds both controls in `game-platformer`'s `app/index.html`, wired by `initSettingsAudio` (it consumes `^9.0.0`) |
| `createGame`'s `speech.speakSample` (the hearing panel's «test voice», `#opt-tts-test`) | a fix, behaviour, no shape change (ADR-0185; engine `ccefaa41` on branch `voice-sample-language`): the sample the root speaks through the browser's synthesiser is tagged with the page's language — `bcp47()`, read at every press, so `en-US` or `es-MX` on an English or Spanish page and the new language after a switch — instead of `pt-BR` always. Its text already came from the page's dictionary: 📏 measured before, with a lent host recording each utterance, an English page sent «Hello! This is the Inclusionist narration voice…» tagged `pt-BR`, and with no voice chosen the browser read it with a Portuguese voice. A chosen system voice is handed to the sample only if the engine's voice list for the page's language (`tts.voices()`, ADR-0185) has it: the page's `#tts-voice` list offers every voice when none speaks the language, and the voice picked before a language switch outlived it (📏 measured: a pt-BR voice chosen at boot was still handed the English sample). `platform/speech`'s `gameSay`, the literacy voice, stays Portuguese. ⚠️ **Behaviour a consumer may notice:** on a page that carries `#opt-tts-test`, the sample's `SpeechSynthesisUtterance.lang` changes on an English or Spanish page, and where the device has no voice for the page's language the sample goes with no voice set, for the browser to choose by the tag, instead of with the other language's voice picked in `#tts-voice`. A read-only `git grep` of the sibling games (2026-09-26) finds `#opt-tts-test` and `#tts-voice` in `game-platformer`'s `app/index.html` (it consumes `^9.0.0`); a host that builds `initSettingsAudio` itself speaks through its own `speakSample` and sees no change |
| `Engine.explain(text \| null)` | new, additive (ADR-0244; the Dev: «Tela inicial para escolher a habilidade via sigla da BNCC (explicação no rodapé).»): a game's own screen explains the item under its cursor in the engine's footer band, the one the quick bar and the pause card write in. The text — already in the child's language, as `say` takes it — becomes the band's RESTING text: a quick-bar icon, a pause-card item's reason or any engine item takes the band while pointed and gives it back to the game's text when it leaves, where it used to leave the band empty. `explain(null)` clears it, and so do `unmount()` and `mount()` of another cartridge. Two lines at most, as every footer text (ADR-0164). While it shows, the band covers the HUD row, as the engine's own explanations do (ADR-0239 point 6). A game that never calls it sees no change; the demo quiz is the first consumer |
| `ui/footer-scroll` (`footerScrollPlan`, `readLines`, `FooterScrollPlan`, `FooterScrollStep`, `FooterLines`) · `ui/footer-scroll-driver` (`watchFooterScroll`, `FooterScrollHost`) · the footer's `data-scroll`, `data-top-line` and `--footer-lines` · `createGame`'s footers | new modules, new page names, and behaviour (ADR-0245): an explanation longer than its lines — the screen's band (`.barra-explicacao`, which `Engine.explain` writes) and a panel's `.opt-explain` — is no longer clamped with an ellipsis: it moves INSIDE the same box at the child's caption rate (60 000 / ppm ms a word, 125, 145 or 175). It GLIDES (ADR-0245 erratum): still while the first view's words are read, then up continuously at one speed until its last line is in view — the distance in the time the words below the first view take —, the last view held as long as its lines take, then again from the top; `footerScrollPlan` answers `{ mode: 'glide', waitMs, travelMs, holdMs, toLine }`. With reduced motion (the system's, or any scene switch the child reduced) it turns pages of two, with no slide: `{ mode: 'pages', steps }`. A pointer over it or focus in it holds it where it is; a footer out of view keeps no animation and no timer. The box does not change. The glide MOVES the footer's text node into one `.footer-scroll-text` block and translates it with a Web Animation; pages move by `scrollTop`; nothing is written into the live region after the text arrives, so it still carries the whole text once. The driver marks the footer `data-scroll="glide"` or `"pages"`, and while it turns pages the top line on show `data-top-line`; `--footer-lines` (2, or 1 beside another footer line) is what the clamp and the scrolling box read. ⚠️ **Behaviour a consumer may notice:** while it moves the band takes pointer events (a pointer on it no longer passes through to the game under it); a page that writes its own long text into `.opt-explain` in the region sees it move; and a gliding footer's children are the `.footer-scroll-text` block, not the text node directly (the node itself is the one written). A game that never writes more than two lines sees no change |
| `Audio.onCatChange` (`Engine.audio.onCatChange`) · `Audio.audioCat` · `ui/settings-audio.SettingsAudioApi.reflectCategory` · `ui/voice-settings` (`reflectTts`) | new, additive, and behaviour (ADR-0247; the Dev: «Misturador de audio: a»): the mixer tells every change of a category — its `on` or its `vol` — whoever made it, the engine's bar and panels or a game writing `audio.audioCat.tts.on = false` itself; `onCatChange(listener)` is called with the category's key after the value changed (a write of the value already there is no change) and answers the function that stops listening. The write IS the door, so each category's `on` and `vol` are now accessors on the mixer's own object, and a category replaced whole (`audioCat.tts = { on, vol }`) is COPIED into that object instead of taking its place. `createGame` listens once, for the root's life (`dispose()` releases it, `unmount()` keeps it): the bar's 🗣 and the hearing and sound panels are drawn from that listener, so a game switching narration on `Engine.audio` moves the 🗣's label and `aria-pressed` and the panel's switch, and a volume it sets moves the panel's slider. `SettingsAudioApi` gains `reflectCategory(cat)` (one category's switch, volume and marks, in place); `reflectTts` also draws `#tts-vol`. ⚠️ **Behaviour a consumer may notice:** `#tts-vol` now opens at the stored narration volume, where it opened at the range's middle whatever was stored; `delete audio.audioCat.tts` throws; a test comparing a category with `toEqual({ on, vol })` is unchanged, and `JSON.stringify` still gives `{ on, vol }`. A host that builds `initPauseIcons` itself and relied on `reflectTtsPanel` keeps it — only `createGame` stopped passing `reflectTtsPanelEnabled: true`. A read-only `git grep` of the sibling games (2026-09-26) finds `audioCat.tts.on` written only in two of `game-pinball`'s tests, and no replacement or `delete` of a category |
| `input/gamepad.GamepadCtx.resume` | `() => void` → `(seat: number) => void` (`35bde6d5`, ADR-0144 erratum: pause per screen) — a widening on the side the consumer provides: a function that ignores the seat still compiles and still resumes. Found on 2026-09-27 by the shape gate reading member types |
| `platform/audio-sonar.SonarCtx.narrate` | `(text) => void` → `(text, seat: number) => void` (`d0413acf`, ADR-0234: the sonar takes turns) — the same widening: a consumer narrating without the seat still works, and its readings simply do not take turns |
| `@the-inclusionist/engine/build` (`defineGameBuild`, `CARTRIDGE_MODE`, `CARTRIDGE_DIR`, `CARTRIDGE_FILE`, `CARTRIDGE_EXTERNAL`) · bin `inclusionist-check-cartridge` · `cartridgeRefusals` (package root) | new (ADR-0253): the build of both targets of a game from one declaration in its `vite.config` — `vite build` the app, `vite build --mode cartridge` the cartridge into `dist-lib/cartridge.js` and `cartridge.d.ts`, the engine, `pixi.js` and `zdog` external — and the checker that imports a built cartridge in Node and runs on it `cartridgeRefusals`, the list `createGame` and `mount()` refuse a cartridge with. The gate that requires them is note DV. ⚠️ **Behaviour a consumer may notice:** `createGame` and `mount()` now throw ONCE with every refusal of a cartridge (`declaração malformada — a; b; c`), where they threw with the first group only — the declaration's lines first, then the preset's, the accommodations', the genre's, the HUD's, the game options' and `howToPlay`'s; the sentence and the order are unchanged |
| `CreateGameOptions.uses.fonts` · `platform/font-library` (`libraryFiles`, `libraryFaceRules`, `declaredFamilies`, `startLibraryFonts`, …) · `HeavyOptions.also` · `ui/fonts` `ENGINE_FACE_KEYS`, `ENGINE_FAMILIES`, `MATHEMATICS_FAMILY` · `inclusionist-heavy --fonts` | new (ADR-0255): the font library's families a game declares, their `@font-face` written by the engine at `heavy/` and their files kept checked, FIRST, by the same download as the heavy files; `also` is that download's door for files outside its catalogue. What a game must change is note DW |

## F · The commits, and whether they carry the footer

| | |
|---|---|
| `218f315` | `PanelShell.titulo` — footer written |
| `f96354d` | `allMotionFrozen` — footer written |
| `1207308` | `EXPLAIN_IDLE` — footer written, **after this measurement caught its absence** |

⚠️ The third is the honest entry in this table. The rule this file states — «a commit that breaks the package
writes the footer» — was followed for the two breaks that a type error would have surfaced, and missed for the
one that would not. The footer was added by amending an unpushed commit, which rewrites nothing anybody else
has seen.
