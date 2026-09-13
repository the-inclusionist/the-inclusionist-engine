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
| `Engine.legendarSom` | new: the engine hosts the sound caption in the screen footer (study item D3); pass it as `createAudioEarcons`'s `showCaption` instead of a page `#caption` |

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
