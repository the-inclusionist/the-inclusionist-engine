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

`tests/superficie-publica.node.test.js` gained a second half, backed by `scripts/shape-surface.mjs`. It fails
on a member that leaves, a member that goes from optional to required, a **required member that arrives**, and
a type alias whose right-hand side changes.

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

## E · What is ADDITIVE, listed so nobody migrates for nothing

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
| `CreateGameOptions.hud` · `ui/hud-bands` | new, optional: the numbers a game shows, each with its band (`identity`, `mission`, `power`, `learning`); the engine mounts the HUD — points and mission top left, power top right (under the clock, ADR-0175), nothing under the quick bar, one to three learning bars (a `Barra` from `educational/segment-bar`) centred in the footer under the explanation — and `--barra-a11y-h` grows by what it takes (ADR-0168, issue #162). A malformed list is refused. A game that keeps its own HUD passes nothing |

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
