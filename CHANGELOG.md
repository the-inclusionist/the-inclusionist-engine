# Changelog

## [9.0.0](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v8.0.0...v9.0.0) (2026-09-11)

### ⚠ BREAKING CHANGES

* **boot:** Engine gains two required members, mount(declaration, ganchos?)
and unmount(). Anyone implementing Engine by hand has to add them; consumers that
only call createGame and read the result are unaffected. GanchosDoCartucho is
exported alongside them.
* **pause-icons:** EscritoresVisuais.seguraTeclas and PauseIconsCtx.seguraTeclas are
now () => boolean instead of boolean. A consumer that builds a pause-icons context
by hand passes () => declaration.seguraTeclas() rather than the result of calling
it. Nothing in the catalogue does today; game-platformer, the only outside caller
of initPauseIcons, omits the field.

### Features

* **boot:** a game can finally hand over its pause actions and its visual writers ([55b71ce](https://github.com/the-inclusionist/the-inclusionist-engine/commit/55b71ce20679f11bafa70d849e456147bf9a408e))
* **boot:** the engine mounts and unmounts a cartridge ([26b6d92](https://github.com/the-inclusionist/the-inclusionist-engine/commit/26b6d92a5e93d00365dbeea3a44544c7d272a3ad))

### Bug Fixes

* **boot:** the keyboard runtime reads o.players live, not a boot snapshot ([a7437ad](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a7437ad5293695c244596e7d01e419bab9ef9cab))
* **pause-icons:** seguraTeclas is a reference, because the icon was describing the game that booted ([d621fef](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d621fefec518c29d878f73bb0fef23366273ee6e))

## [8.0.0](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v8.0.0-rc.2...v8.0.0) (2026-09-11)

## [8.0.0-rc.2](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v8.0.0-rc.1...v8.0.0-rc.2) (2026-09-11)

### ⚠ BREAKING CHANGES

* **platform:** platform/pesados now downloads ~285 MB on first load instead of ~241 MB, and the catalogue
exposes runtime entries alongside the voice models. A consumer filtering ids by the oz: prefix now also
matches oz:runtime*.

And a gate was found DEAD. 	ests/boot-create-game.node.test.js asserted that no line of the boot reaches the
global document, and its regex carried an invisible control character - /docu<VT>ment/ - injected by a
PowerShell edit where the backtick is an escape. It could never match, so the case passed always, for the worst
possible reason. Revived, it produced a false positive on the Portuguese word 'documento' inside a problems
line; a word boundary separates them. Three files were swept clean of control characters.

Refs ADR-0124, ADR-0127, ADR-0132, ADR-0116
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **pwa:** `npm run check:precache` no longer fails on total precache weight. A build that grows the
first-day download now passes; only the floor and the update-safety questions still fail it.

Refs ADR-0114, ADR-0117, ADR-0124
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **docs:** the ADR tree is no longer in this repository. It lives in
`github.com/the-inclusionist/the-inclusionist-docs`, at the same path, and `docs/2-Architecture/ADR.md` says
so. Anything that read `docs/2-Architecture/adr/` — a script, a link, another repository's job — must point at
the records' repository instead. The engine's own `adr` job shows the shape: check the tree out, then
`python scripts/validate-adr.py <tree> --repo engine=.`.
* **input:** `GamepadCtx` gains a required `arestaDoJogador(jogador, 'gamepad')`. Pass
`criarArestaComAlternancia(() => players)` from `@the-inclusionist/engine/input/latch-edge.js` — the same
instance you pass to `initKeydown` and `initTouchBindings`, so every transport writes the same player.
Measured across the catalogue, this one reaches TWO repositories: `game-platformer` and `game-soccer`.
* **input:** `KeydownCtx` and `TouchBindingsCtx` gain a required `arestaDoJogador(jogador, origem)`. Pass
`arestaDoJogador` from `@the-inclusionist/engine/input/state.js` — the same module you already take
`marcarTecla` from; one line in each context. Measured across the catalogue, `game-platformer` is the only
consumer of either. Once it is passed, that repository's `onTouchControlsShown` patch (`main.ts:1695`) can go:
it exists to compensate for the edge this change delivers.
* **a11y:** `Declinios.semMenuDePausa` is removed. Delete the line from your `createGame({ declines })`;
there is no replacement field. Your game receives the engine's pause card, mounted at `host.pauseHost` or, by
default, `#game-region`, and it offers only what your `getPauseActs()` can action. It is born hidden and eats
no keys until it is opened. `game-chess` has more to do than delete a line: its own `ui/pause-menu.ts` holds
«leave the lesson», and those items are `getPauseActs()` material.
* **a11y:** `Declinios` loses `semMenuDePausa`. A consumer that declined the pause deletes the line and
receives the engine's pause card, mounted at `host.pauseHost` or `#game-region`; a host that cannot accept
children is reported in `problems` as it already was. There is no replacement field — a game that genuinely
has no pause would need a new decision about what «pause» means without running state, not this field back.
* **a11y:** `SettingsMotorCtx` gains the required `seguraTeclas: boolean`. A consumer answers whether any
key is held in its game; with `false` the engine hides the `#opt-altmove` row it does not own. There is no
safe default — `true` leaves a row that does nothing, `false` hides one a child depends on — which is the
same condition that made `holdsAtOnce` mandatory.
* **a11y:** `PauseIconsCtx` gains the required `seguraTeclas: boolean` — a consumer that calls
`initPauseIcons` directly answers whether any key is held in its game, and a consumer that goes through
`createGame` writes nothing, because the root reads the declaration. `EscritoresVisuais` is renamed
`AccionaveisDoJogo` and gains `seguraTeclas`; the old name survives as a deprecated type alias, so existing
type annotations keep compiling.
* **contract:** `GameDeclaration` gains the mandatory `seguraTeclas(): boolean`. `conformanceProblems` now
reports TEN missing fields for an empty declaration instead of nine. Every cartridge answers whether any key
is held in it — `false` for a quiz, a board or a tile puzzle; `true` wherever a direction, a run or a charge
is held. ⚠️ Do NOT derive it from `holdsAtOnce`: that field counts simultaneous positions, refuses zero, and a
game that holds nothing still declares 1.

### Features

* **a11y:** a game that holds nothing does not OFFER latching — absent, not disabled ([41cd345](https://github.com/the-inclusionist/the-inclusionist-engine/commit/41cd345a7b5645096cba74f457aada6b97646306))
* **a11y:** the latching ROW disappears too — and thirty cases were exercising a hidden one without knowing ([4ed9dec](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4ed9dec1fd3d163e22346096fb739922db379b04))
* **a11y:** the pause stops being declinable — ADR-0106 parked this collision and the Dev closed it ([bd168ee](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bd168ee1c48d9404776b29a1557c863f7346895a))
* **a11y:** the pause stops being declinable, for good — and this time the keyboard cost was measured ([70c124e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/70c124e54cbe351ba9ba476999173411c9b5495c)), closes [#132](https://github.com/the-inclusionist/the-inclusionist-engine/issues/132) [#132](https://github.com/the-inclusionist/the-inclusionist-engine/issues/132)
* **a11y:** the Ronde option ENABLES when a face is installed — the «enquanto» ADR-0012 wrote ([fcce4e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fcce4e223d234e38cd1ada8556697b6cbe86ac55)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **a11y:** the Ronde option speaks — it names the THREE faces that would enable it ([919c4c1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/919c4c16e6e1a042f4e188bd454399e3317e5ebb)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **art:** "may we convey it" stops approving and starts ROUTING, and the ledger says how it arrives ([a99d4b3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a99d4b322809e7ea4b6b482297af553154e43f76)), closes [#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140)
* **art:** the gate learns three doors, and share-alike stops being refused by name ([dd5fa79](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dd5fa7945f97734cc73ba722794c3a61d029a9d2)), closes [#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140)
* **art:** the quarantine gate turns inside out — four licences accepted, ND/NC/SA refused by name ([65c6007](https://github.com/the-inclusionist/the-inclusionist-engine/commit/65c6007ee55e07613d6a7759ab8e99ce76863f17)), closes [#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140) [#140](https://github.com/the-inclusionist/the-inclusionist-engine/issues/140)
* **contract:** a game DECLARES whether it holds keys — the question `holdsAtOnce` looked like it answered ([2dfd4f6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2dfd4f61fcee853efb9037b21551d292e2a8d6de))
* **fonts:** as OITO Playwrite entram no pacote — a decisão do ADR-0108 deixa de ser registada e passa a entregue ([a365f8e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a365f8e602eefdc0cc182c2d277d131246189112)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87) [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87) [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **input:** the automaton finally gets fed — the keyboard and the touch record WHOSE edge it was ([ca08b7d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ca08b7d4713da4cfea08b446ad2557e246e013e8)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the chain closes — one edge records the device AND resolves that device's latching ([403cb65](https://github.com/the-inclusionist/the-inclusionist-engine/commit/403cb65591386df5cc75e3815a5bd25d50edd16b)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the game declares its button map too — ADR-0115's second half is finished ([2e7a92d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2e7a92d491207b6fe4b10d72281fc6abf8bfb2b5)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the GAME declares its default keyboard — and «restore defaults» goes back to ITS map, not ours ([dbaff04](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dbaff044ff472a6abbcfe7fbafb18a7e83c0311e)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127) [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127) [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the gamepad feeds the automaton too — and the case that guarded the Easy mode was measuring the void ([50b7b4d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/50b7b4d117e390a73d194527d86df86408bb9948)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the latching finally has a READER — the transport in use decides, and switching writes nothing ([326d95d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/326d95dc92044de483f781d759f69c5525d28b6d)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127) [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **platform:** the four neural voices come down on first load, and what has no source SAYS SO ([c7b165d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c7b165df3246a26636541bf1c1921c012a9152a2)), closes [#129](https://github.com/the-inclusionist/the-inclusionist-engine/issues/129)
* **platform:** the vision and voice runtimes come down with the engine — and a dead gate is found ([188f076](https://github.com/the-inclusionist/the-inclusionist-engine/commit/188f07683a29a89bbd8a4c56e1d97ce36e22d4a2)), closes [#129](https://github.com/the-inclusionist/the-inclusionist-engine/issues/129) [#119](https://github.com/the-inclusionist/the-inclusionist-engine/issues/119)
* **platform:** what came down reaches whoever answers "which voice is this child hearing" — ADR-0110 gates 3 and 4 ([2d13c7a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2d13c7a9d55785af1cadd16e9fd2a8df82136318))
* **pwa:** the first-day ceiling is removed — it was never the Dev's number ([d1df800](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d1df8000ffb4bc8c0221bfbce691b06655119fb3))
* **scripts:** scaffold a new repository, and turn ADR-0067 §5 from a gate into a form field ([9fbceef](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9fbceeff7cf3a984a4533a4be46cd77b262a7bba))
* **scripts:** the issue census is repeatable — the second gate ADR-0126 owed ([f8ff54f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f8ff54f1152dcb4b845756b687510a8fed52f52c))

### Bug Fixes

* **adr:** sync the validator copy and give the cross-repo run the `docs` root ([8738067](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8738067a00b4862745172e243fb252ab24798ac5))
* **adr:** the validator's root becomes DECLARABLE — and measuring it drew the line of an open decision ([d432a88](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d432a8828e6b0694df02fcf2e3886480ac63853e)), closes [#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101)
* **pwa:** the 241 MB become readable — fetch from where the READER reads, and route it through the SW ([fada5a1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fada5a1de0c757e9e318b0d5c412a6ce484e8334)), closes [#119](https://github.com/the-inclusionist/the-inclusionist-engine/issues/119)
* **scripts:** the issue census had an invented budget and reported noise ([1ea2bbc](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1ea2bbcb7e1f457d7a5c65f29ba1f6cb26065d2b))
* **test:** a trailing slash decided where the records' root was — and it made the drift gate BLIND ([6a23287](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6a23287c839a9803b165e9aeafe88255b1c91d44))
* **test:** the TEA announcement case measured the CLOCK — green here, red on the runner ([1c83320](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1c83320df39d50e86ea807161b1e0eb6f020750c)), closes [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112)

### Reverts

* **a11y:** the pause decline comes back — I retired it after measuring ONE consumer of five ([7f256f0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7f256f003b70953375b108abed8cebce489703b6)), closes [#132](https://github.com/the-inclusionist/the-inclusionist-engine/issues/132) [#132](https://github.com/the-inclusionist/the-inclusionist-engine/issues/132)

### Code Refactoring

* **docs:** the records leave the engine — and the gate that stays is the one that can OPEN them ([0cb6ed5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0cb6ed51e5b2992020f64352e961f802e7f708f1)), closes [#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101) [the-inclusionist/the-inclusionist-engine#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101)

## [8.0.0-rc.1](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v7.0.1...v8.0.0-rc.1) (2026-09-09)

### ⚠ BREAKING CHANGES

* **a11y:** `SettingsControlsCtx` gains `kbPadraoFor`, required. A consumer supplying its own ctx must
answer what a seat's keys would be from the factory — using the same bucket mapping it already uses for
`kbFor`, and never by calling `resetKB`.
* **input:** `Disponibilidade` gains `rato`, required — a consumer supplying its own must answer whether
there is a mouse. `Alcance` gains `pedePonteiro` and `naoApontam`, required. `Transport.aponta` is optional
and `alcance()`'s fourth parameter defaults to `false`, deliberately: the three hundred games that do not draw
must not feel this change, and a required fourth argument would make every existing caller decide today a
thing that does not concern it.
* **input:** `KeydownCtx` gains `marcarTecla`, `marcarTeclaSemOrigem` and `soltarTecla`, all required, and
`heldKeys` narrows to `readonly ReadonlySet<string>`. The narrowing breaks no PROVIDER — a `Set` satisfies
`ReadonlySet` — and that is deliberate: what it forbids is the engine writing through the injected reference,
which is how the origin was being erased. `KeydownEventLike` gains an OPTIONAL `isTrusted`, which breaks
nothing: making it required would have broken every existing double for a false reason.
* **boot:** `Engine` gains `pausa`. Nothing to migrate; a consumer that showed the card by hand can keep
doing it, and now has a way that does not depend on an id.

Refs ADR-0106
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **input:** `TouchBindingsCtx` gains the required `marcarTecla(code, origem)` and `soltarTecla(code)`,
and `heldKeys` becomes `ReadonlySet<string>`. A consumer must pass `input/state`'s pair instead of writing
into the set itself — which is the entire point: writing into it is what erased the origin.
* **a11y:** none — seven fields went from required to OPTIONAL. ⚠️ But a consumer that relied on
`initPauseIcons` REJECTING an incomplete ctx no longer gets that error; the missing pieces now resolve to
engine defaults, which is the entire point.

Refs ADR-0106
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **a11y:** none — `pmButtons` and `optionsButtons` went from required to OPTIONAL, which breaks nobody.
⚠️ But the RENDERED menu changes for a consumer whose `getPauseActs()` does not cover its own list: those
items stop being drawn. They never worked; they are now honest about it.

Refs ADR-0106
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **a11y:** `PauseIconsCtx` no longer accepts `getPauseScreens`. Consumers should delete the line; the
field was never read. `ShellCtx.getPauseScreens` is a different field and is unaffected.

Refs ADR-0106
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **a11y:** `MotorPlayer` and `PausePlayer` gain `walkDir`. Every engine player already carries it
(`PlayerBase.walkDir`), so a consumer passing real players is unaffected; one passing a hand-made narrower
object must add the field. `SettingsMotorCtx.setToggleMove` and `PauseIconsCtx.setToggleMove` became OPTIONAL,
which breaks nobody — a cartridge that injects its own keeps winning, and one that injects nothing now gets
tap-to-move instead of going without.

Refs ADR-0106
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
* **a11y:** `PauseIconsCtx` gains `setTemaDoJogador` / `setCorrecaoDoJogador`, `IconStateSnapshot`
carries `visual: VisualState` instead of `viz: string`, and `PausePlayer` asks for `'visual'`.
* **a11y:** `VizSettersApi` gains `renderEixosVisuais(listSel, tabsSel)`, and `SettingsVisualCtx` now
requires it instead of `renderVizGroup`. A consumer passes the new function from the same `initVizSetters`
result it already destructures.
* **a11y:** `applyVizGlobal(v: VisualState)` instead of `applyVizGlobal(mode: string)`. A consumer that
held a mode string passes `migrarVisual(key)`; one that holds a player passes `p.visual`.
* **a11y:** `SonarCtx` loses `VIZ_BY_KEY` and gains `visaoComprometida: (pl) => boolean`; `SonarPlayer`
loses `viz`. A consumer answers the predicate from its own visual state — `ehCego(v) || ehBaixaVisao(v)` is
what `createGame` passes — instead of handing over a table for the engine to cross.
* **render:** `caneColor` takes `{ visual: VisualState }` instead of `{ viz: string }`, and the
`DrawPlayer`/`DrawablePlayer` slices ask for `'visual'`. A consumer passing a player built from
`core/entity.PlayerBase` needs no change; one that hand-builds the slice swaps the field.
* **viz:** `PlayerBase` gains the required field `visual: VisualState`. A consumer that builds its own
players sets it — `migrarVisual(saved)` produces it from whatever was stored before, and `PADRAO` is the
default. `viz` still works and still means what it meant, and it is deprecated: it cannot express both axes
at once, which is the whole reason for the change.
* **shell:** the global pause is not hidden, it is gone
* **contract:** `GameDeclaration` gains the mandatory `holdsAtOnce()`. `conformanceProblems` now reports
NINE missing fields for an empty declaration instead of eight, and `alcance()` takes a third argument. Five
external games declare and are edited in lockstep, each in its own repository.
* **a11y:** `guideT` is gone from the engine entity — it timed the 48 frames between beeps and there
are no beeps left to time. What replaced it, the live audio graph, is not the engine entity's to own
(ADR-0033) and lives in `PlayerAudioOut` beside `_ac`. `SonarCtx` gains four OPTIONAL fields (`roleAt`,
`catNode`, `audioOut`, `getVolume`), so every hand-built ctx keeps compiling; without them the guide falls
back to the straight line and to `destination`, which is what it already did.
* **pkg:** `exports["./assets/*"]` is removed. Use `./assets/vendor/*`, which resolves the same files —
`@the-inclusionist/engine/assets/vendor/fonts.css` is unchanged. Only paths outside `vendor/` are affected,
and those already 404'd because `files` never shipped them.
* **core:** water, ladder, gate and secret area leave, and the ledger reaches zero
* **core:** gravity and the coin quota leave the engine, and the ledger drops to four
* **core:** the two dead constants leave, and the ledger ceiling drops to six
* **input:** KeyScheme closes on the fourteen, and the two keyboard tables become one
* the cartridge LEAVES - this repository becomes the engine, as ADR-0036 ordered on 2026-08-25

### Features

* **a11y:** an earcon can rise or fall, so scoring and conceding stop sounding alike ([be3f0a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/be3f0a80848771ec0d5574d4064232c6468e908d)), closes [#124](https://github.com/the-inclusionist/the-inclusionist-engine/issues/124) [#124](https://github.com/the-inclusionist/the-inclusionist-engine/issues/124) [#124](https://github.com/the-inclusionist/the-inclusionist-engine/issues/124)
* **a11y:** an icon appears when its action works, and not before ([49873a1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/49873a1d71cc598c43453281051cd6435d18241d))
* **a11y:** blind mode has an engine default, and the panel subscribes instead of being told ([0c9052f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0c9052f6732ff5f44a745fa60d0248f3614eac07))
* **a11y:** distance becomes brightness, so the guide stops being a beep ([19ab808](https://github.com/the-inclusionist/the-inclusionist-engine/commit/19ab808344f54520b2e997a380b7e8036716d9fe)), closes [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84) [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84)
* **a11y:** high contrast and colour correction at the SAME TIME ([abc1235](https://github.com/the-inclusionist/the-inclusionist-engine/commit/abc1235dc5b8f2255cafaee9c4a865cb07445b80)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** one writer per axis, and the mirror learns what it can honestly say ([9a772a1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9a772a18ff137a89c5ab7df8f31d6de227925415)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** OpenDyslexic and Fondamento join the roster, and neither promises anything ([a56f70f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a56f70f2fb410354a4b5783c3eaad662e6d5ce2a)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87) [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **a11y:** Press Start 2P joins as the GAME face, with the lesson whackwhack paid for ([3e28ad4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3e28ad46232b65ffce01680415fd5395c66144ae)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **a11y:** reduced scene motion belongs to the engine, not to each cartridge ([e943061](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e94306107370fac95045cf856e1849db29f72e98))
* **a11y:** tap-to-move is the engine's to write, and its own comment said so ([8dcaafc](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8dcaafc86e3d80ca3dd38eb7512a5089e047de9f))
* **a11y:** the contrast and colour icons stop erasing each other ([e170846](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e1708468691666b1090e943c5d96137712e2f652)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** the engine MOUNTS the accessibility bar on the first screen ([fb1116c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fb1116c3f3cab7c94b16762108f76a915afa3de8))
* **a11y:** the engine mounts the pause card, and stops looking for an id nobody creates ([092a670](https://github.com/the-inclusionist/the-inclusionist-engine/commit/092a670312ab3609bb14aa5a08dce4a2d8c1bb07))
* **a11y:** the engine ships a default pause menu, and it only offers what the game can action ([001b185](https://github.com/the-inclusionist/the-inclusionist-engine/commit/001b185d4cf2063fc879ddae871136eaa2217e84))
* **a11y:** the guide stops beeping and starts being there ([d644164](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d6441641afa0e0af8e305f9cbb3d3c415549f8e3)), closes [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84) [#121](https://github.com/the-inclusionist/the-inclusionist-engine/issues/121) [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84)
* **a11y:** the pause can be mounted by the engine alone — seven more ctx fields gain defaults ([e6173cf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e6173cf694d2d5085f0dcd6a9541876f043f9471))
* **a11y:** the refused simulation is disabled, stays on screen, and says why ([20a599f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/20a599f9b82db97df24378bebd9121439c095e86)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** the refused simulation says WHY, and stays on screen while it says it ([2144da1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2144da1e42a2adaf53623bab33db323304cf9998)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** the remap screen marks what the child changed — the last menu without the ADR-0029 mark ([50d1592](https://github.com/the-inclusionist/the-inclusionist-engine/commit/50d15926b7322d4aa1656db3b52fcd9001533cb9)), closes [#61](https://github.com/the-inclusionist/the-inclusionist-engine/issues/61)
* **a11y:** the route knows where the walls are, so a cue can stop pointing through them ([33afd7e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/33afd7e52c14dcb0c5b4e3c8e1d3dd8a0f52a61c)), closes [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84) [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84) [#84](https://github.com/the-inclusionist/the-inclusionist-engine/issues/84)
* **a11y:** the visual menu becomes two controls, and the defaults get names of their own ([eea187b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/eea187b210c3d64a7b11c8fc3943b89787ffef2b)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** the visual panel draws the two axes, and the empathy panel keeps its single radio ([b0e725f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b0e725f02fdcfd459207ba5c1896fa0824926b61)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **adr:** the validator learns the difference between decided and BUILT ([68a5902](https://github.com/the-inclusionist/the-inclusionist-engine/commit/68a5902b25f1e69d54b9fa68a7b3beae4cfac6f8)), closes [#95](https://github.com/the-inclusionist/the-inclusionist-engine/issues/95) [#95](https://github.com/the-inclusionist/the-inclusionist-engine/issues/95)
* **boot:** a game with no neural voice says so, instead of three games going quiet ([7212479](https://github.com/the-inclusionist/the-inclusionist-engine/commit/72124793e12691bee4624a3d968e88918d044e05)), closes [#91](https://github.com/the-inclusionist/the-inclusionist-engine/issues/91) [#91](https://github.com/the-inclusionist/the-inclusionist-engine/issues/91)
* **boot:** mounting is not showing — the engine offers both, and a browser global stops throwing ([8a1f9b9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8a1f9b9a95025eccb11d8f33d77bf5c12bfeafdc))
* **boot:** the engine stops being silent about a missing accessibility bar ([44a7ba3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/44a7ba36257aa78179c3200a966359f2e245e685)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **boot:** the root answers which device each player is using — the ADR-0109 automaton gets its first reader ([08410b0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/08410b01e1a5db9c805e5f7b6c82c99dff8221b5)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **boot:** two seats and no pause actor is now said out loud, not discovered later ([aa2f444](https://github.com/the-inclusionist/the-inclusionist-engine/commit/aa2f4449de0c3054cd46b146738ceb8480b2b233)), closes [#126](https://github.com/the-inclusionist/the-inclusionist-engine/issues/126)
* **ci:** the one obligation that undoes itself now has a machine holding it ([7c33f9d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7c33f9d6062aebf913a93f7eb3e624078b7954a5)), closes [#95](https://github.com/the-inclusionist/the-inclusionist-engine/issues/95) [#95](https://github.com/the-inclusionist/the-inclusionist-engine/issues/95)
* **contract:** a game can finally SAY it needs a pointer — and the path there was crashing the boot ([c805fd0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c805fd0f054aa08d316a632beede6c404f3054c7)), closes [#105](https://github.com/the-inclusionist/the-inclusionist-engine/issues/105) [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112)
* **contract:** a game declares how many positions it holds AT ONCE ([c3b3235](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c3b3235fe4d82e1462638eed4ebe42e003ca4501)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114) [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112) [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **devops:** a name cannot leave the package without somebody saying it left ([27e3fa1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/27e3fa1fb9151445623eab85e29c2cd75d611779)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63)
* **educational:** the retry IS the scaffolding, and the engine stopped throwing it away ([0885255](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0885255a1a3be81322a37b41d6caf76ca07f3686)), closes [#92](https://github.com/the-inclusionist/the-inclusionist-engine/issues/92) [#92](https://github.com/the-inclusionist/the-inclusionist-engine/issues/92) [#92](https://github.com/the-inclusionist/the-inclusionist-engine/issues/92) [#92](https://github.com/the-inclusionist/the-inclusionist-engine/issues/92)
* **educational:** the ten-segment bar, which cannot count ([7f81053](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7f8105357fe8d8a83f9eaf2d2013ec3b91031662)), closes [#93](https://github.com/the-inclusionist/the-inclusionist-engine/issues/93) [#93](https://github.com/the-inclusionist/the-inclusionist-engine/issues/93)
* **input:** a game can declare it needs a POINTER, and a device without one refuses before the child starts ([7ddb857](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7ddb8571597d182cd239bb93913852afaf929c48)), closes [#105](https://github.com/the-inclusionist/the-inclusionist-engine/issues/105) [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112)
* **input:** latching belongs to a transport, not to a child ([53cb4a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/53cb4a8dc4f4b4fd358f8ecd3b96be97ce6262ae)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114) [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **input:** the adapter between the latching rule and storage — and TWO gates caught this commit ([7467fed](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7467fede0f7c9f7e0204e11ce3ab68e80c1ebdf8)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the key carries its origin — the edge half of ADR-0109, by strangler ([2df16c7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2df16c7d8c7b97437ed6ff7239b38363a746c7aa)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **input:** the latch automaton of ADR-0109, in its pure half ([f146ea7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f146ea72f36ca9e7a855ae14c2e8629198bfa31d)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114) [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **input:** the pointer sample — and saturating it must not erase the fact that it left the screen ([51e1acd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/51e1acd60104d87b4664e20e53bf04b0456193a7)), closes [#105](https://github.com/the-inclusionist/the-inclusionist-engine/issues/105)
* **input:** the transport in use, per player — and it does NOT belong on `PlayerBase` ([2caa67d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2caa67d3ba2db12f0dd5310ef32a2d0c4616b1f0)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **input:** the two-player keyboard is the same geometry twice - and the arrows change owner ([b5a4a5b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b5a4a5bf4a64b1f4ebe67464e59fbf24e867e45c))
* **input:** the webcam declares itself, and the key-origin sieve reaches its floor ([a78816c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a78816c46fb5b438bc66a30a04da0c4904c325a3)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **input:** touch stamps its origin — the first writer migrates off the raw set ([2bc08b2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2bc08b2eb94ec92a087f6a99bb355d75af64a016)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114) [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* **quiz:** the engine's OWN consumer had no accessibility bar — found in a real browser ([362295f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/362295fc6f15c52f516cd610e08ccc600232ccfa))
* **tts:** the model host, named in one place — and the URL is DERIVED, not tabled ([6e26c83](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6e26c8360f7bb0ccf8c6b9dcd1660feaa457b4f0))
* **tts:** the voice plan — the four are named, and the engine can say WHICH voice is actually speaking ([6ea47c8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6ea47c869f6e8996903a27d5d3a9162a13da50f3)), closes [#91](https://github.com/the-inclusionist/the-inclusionist-engine/issues/91)
* **ui:** the latching control refuses on screen — disabled, with the reason, and it SPEAKS ([e73e1a0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e73e1a0e613606cb85d5daadbb976ad83748953a)), closes [#128](https://github.com/the-inclusionist/the-inclusionist-engine/issues/128) [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127) [#128](https://github.com/the-inclusionist/the-inclusionist-engine/issues/128)
* **ui:** the latching panel writes the per-transport key — dual write, and the old one does NOT go yet ([787169d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/787169d0de38d92ac064f2e761c6fc357d299b3c)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **ui:** the panel shell is BUILT, so the markup contract stops being invisible ([a837b71](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a837b718c88ff79df23c78231cece70736d26e07)), closes [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111) [#62](https://github.com/the-inclusionist/the-inclusionist-engine/issues/62) [#62](https://github.com/the-inclusionist/the-inclusionist-engine/issues/62) [#115](https://github.com/the-inclusionist/the-inclusionist-engine/issues/115) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63)
* **ui:** the refusal when latching cannot be switched off — ADR-0113 clause 3, the pure half ([2c4dfbf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2c4dfbff8c1a741f42545b281f3c607e102a16bd)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **viz:** the saved visual setting survives the split, from either key ([53b977f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/53b977f6f019b88dc9c63a57475dce1741ba1f68)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **viz:** the two-axis state arrives beside the single string, not instead of it ([465a3dd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/465a3dd016d3bfb76f90b8e0ae2c2fb398c15510)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)

### Bug Fixes

* **a11y:** a screen reader was saying «action2» to a child, on the very screen ADR-0074 names ([7742ac0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7742ac0c020ab4100beb438069b8958bc6272866))
* **a11y:** five panels put the explanation back inside the rows on first click ([0ebc180](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0ebc1805332eb67ebfe1aadb44913df3414decbc)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **a11y:** one-button mode did not exist on the gamepad path ([f984ee7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f984ee7c6b050e8b4ee7018bca6bee0b1e71c805))
* **a11y:** the «left the default» mark is per AXIS again — a granularity my own change had removed ([01f3c48](https://github.com/the-inclusionist/the-inclusionist-engine/commit/01f3c48c54978cd9f0f21b198e5acf5831b22a0d)), closes [#61](https://github.com/the-inclusionist/the-inclusionist-engine/issues/61) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#61](https://github.com/the-inclusionist/the-inclusionist-engine/issues/61) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **a11y:** the accessibility bar spoke two languages at once — and the premise that allowed it ([424ee36](https://github.com/the-inclusionist/the-inclusionist-engine/commit/424ee369925797fd86b7888108a03029b58d9e01))
* **a11y:** the autism setting was forgotten every session, and nobody was tracking it ([358c6ca](https://github.com/the-inclusionist/the-inclusionist-engine/commit/358c6cadf90d69578191695df6b9ae34ea144555)), closes [#61](https://github.com/the-inclusionist/the-inclusionist-engine/issues/61)
* **a11y:** the bar the engine mounts can be navigated by keyboard — a hole stage 2 opened ([2c2fa14](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2c2fa14814edf058e37e264ae2b6f928f9d9d853))
* **a11y:** the bar's altmove icon refused nothing — and [#128](https://github.com/the-inclusionist/the-inclusionist-engine/issues/128) closes with the same line ([57df596](https://github.com/the-inclusionist/the-inclusionist-engine/commit/57df596d9bb9c46d7985541e72d797b8f005dd44)), closes [#127](https://github.com/the-inclusionist/the-inclusionist-engine/issues/127)
* **a11y:** the blind-mode toggle announces, like the five siblings beside it ([ba355f3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ba355f318fb33351d4e116c8c7705975d3f13c17))
* **a11y:** the empathy panel rebuilds its list by proxy, and the gate could not see it ([443f00c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/443f00c538ebcf9c6bc20c2f609b533a0830019c)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109) [#62](https://github.com/the-inclusionist/the-inclusionist-engine/issues/62)
* **a11y:** the keyboard's emergency exit sat below the modals, and the page had none anyway ([3cf4feb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3cf4febcaef278924eb9c68a235588c5d5276f50)), closes [#52](https://github.com/the-inclusionist/the-inclusionist-engine/issues/52)
* **a11y:** the mounted bar keeps telling the truth when blind mode changes elsewhere ([96ae788](https://github.com/the-inclusionist/the-inclusionist-engine/commit/96ae78845fd82ffa6db7c87d4d26e05f5682fa26))
* **a11y:** the pause card decides what to show when it OPENS, not when it is built ([4f715f3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4f715f3af5bb07140b80fd1624877868cd05c637))
* **a11y:** the pause list obeyed a literal 44px, not the ADR-0095 ruler ([ab49ff6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ab49ff67312b1d9074900f1fb50da14a7827c10c)), closes [#117](https://github.com/the-inclusionist/the-inclusionist-engine/issues/117)
* **a11y:** the remap screen said "undefined" to the child who cannot see it ([12caa94](https://github.com/the-inclusionist/the-inclusionist-engine/commit/12caa940a517b8572c1ec363c94603e19a22bc43)), closes [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106) [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125)
* **a11y:** the screen reader said «action3» on the touch bubble too — and ADR-0111's fourth gate ([dc4b28f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dc4b28f8dd11147cec6e8189226027f16348d639)), closes [#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101)
* **a11y:** the sonar measured its stereo width in screen pixels and went mono on a real pitch ([06aab8c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/06aab8c19a7f65c4e456870e5cc4a5607299b9b6)), closes [#121](https://github.com/the-inclusionist/the-inclusionist-engine/issues/121) [#121](https://github.com/the-inclusionist/the-inclusionist-engine/issues/121)
* **a11y:** the typography menu offered seven display faces as the interface font ([def657b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/def657b32a7a85c0a3f19b98133a41c3d869e034)), closes [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87) [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87) [#87](https://github.com/the-inclusionist/the-inclusionist-engine/issues/87)
* **a11y:** the typography menu offered seventeen fonts and loaded none of them ([51deec9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/51deec9396afa19263c4b72ab834a54aff106d75)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **a11y:** the typography menu was seventeen switches for choosing one font ([dfd6021](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dfd602183d237ff2b2d9070e3593963ee74940ae))
* **adr:** a SUPERSEDED record owes no current gate — and the pointer list goes from seven to three ([d2d5115](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d2d5115c254a37d5ae82dc22264b84a263e66831))
* **adr:** the pointer inventory had no way to SHRINK, and its sharpest entry was wrong ([d26d6b4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d26d6b495754e6aef3376fc277c8c230e046a6b6))
* **boot:** blind mode turned on once and could never be turned off, and only a real document could see it ([6b790c9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6b790c9a0c93c1e2badfef4e322047bc7430f6a1)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **ci:** the a11y gate was auditing a page that left with the cartridge ([b5fb8da](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b5fb8daf6042fef1a81ac1d46a32340c39216b9e)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **docs:** ACT_LABEL has a consumer, and I told you it did not ([8b5b469](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8b5b4692620c75db147513c5544c7c7cf1cfbaaf)), closes [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111) [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125)
* **i18n:** the pad wizard spoke five raw pt-BR sentences, and a parameter name is why ([3e39cd8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3e39cd8545220f4bb6a6a762777c713204902647)), closes [#123](https://github.com/the-inclusionist/the-inclusionist-engine/issues/123) [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103) [#123](https://github.com/the-inclusionist/the-inclusionist-engine/issues/123)
* **input:** a second player took the spacebar away from the child playing with their eyes ([6446eaf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6446eaf555a0cec16719123fa05cf9f3aea289c0)), closes [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118) [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118) [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118)
* **input:** the remap screen let one key hold two actions, and only for a child playing alone ([01a07d6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/01a07d63218f845d3cf2542da4561d72106a482b)), closes [#126](https://github.com/the-inclusionist/the-inclusionist-engine/issues/126) [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#126](https://github.com/the-inclusionist/the-inclusionist-engine/issues/126) [#126](https://github.com/the-inclusionist/the-inclusionist-engine/issues/126)
* **input:** the second seat had no door out of the numpad, on the hardware pillar 1 names ([8ebf4ca](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8ebf4cab176ec4ea9e856f0871ac57cd6da3c93f)), closes [#122](https://github.com/the-inclusionist/the-inclusionist-engine/issues/122) [#122](https://github.com/the-inclusionist/the-inclusionist-engine/issues/122) [#122](https://github.com/the-inclusionist/the-inclusionist-engine/issues/122)
* **layout:** the engine did not scale in the only host it has left ([af19da3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/af19da3c45eb4ca81254212e292b4d293eb792e8)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **pkg:** the assets door gets a narrow twin that tells the truth, and the gate learns to tell them apart ([c9ff119](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c9ff1192d51bf2a4093e4251a2be2d55a4fdec9c)), closes [#119](https://github.com/the-inclusionist/the-inclusionist-engine/issues/119)
* **pkg:** the package emitted three dictionaries it did not let anyone import ([5e5d2a9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5e5d2a936c72d7cc49f03bd6d3236a13402efe0c))
* **pkg:** the wide assets door is gone, and nobody's import line changes ([6489888](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6489888223362b1311d65d391f306ed62841eb24)), closes [#119](https://github.com/the-inclusionist/the-inclusionist-engine/issues/119) [#119](https://github.com/the-inclusionist/the-inclusionist-engine/issues/119)
* **test:** the browser twin of the keydown double was left behind, and it failed as an UNHANDLED ERROR ([922851d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/922851d299e49f099224e259aabbb372261036e0)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)

### Code Refactoring

* **a11y:** the pause icons stop asking every game for a field nobody read ([42b10b2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/42b10b246c2caff5b98471c7ce292fcd8649888a))
* **a11y:** the sonar stops knowing what a visual mode is, and the viewport filter reads its own half ([3d0d385](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3d0d385fe5749292d3bf30d73b7961e54c2fd474)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **core:** gravity and the coin quota leave the engine, and the ledger drops to four ([91b4cd2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/91b4cd2af71375ddd804f05b3c8e8ee220c3898f)), closes [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63)
* **core:** the two dead constants leave, and the ledger ceiling drops to six ([7ab9658](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7ab96581874b4642e57e4ab39fc5660d6e4ce682)), closes [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63)
* **core:** water, ladder, gate and secret area leave, and the ledger reaches zero ([40f2dd9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/40f2dd9102170ea5eb22e7df6ae473f4e71ae6c1)), closes [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63)
* **input:** KeyScheme closes on the fourteen, and the two keyboard tables become one ([3726087](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3726087499189a946067a3002da955a0206f24ce)), closes [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118) [#112](https://github.com/the-inclusionist/the-inclusionist-engine/issues/112) [#118](https://github.com/the-inclusionist/the-inclusionist-engine/issues/118)
* **render:** the drawing readers ask the two-axis state, not the single string ([971d72d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/971d72d705135d63f4faec4eadf13b0ebeb4e389)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104) [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **shell:** the global pause is not hidden, it is gone ([a270854](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a270854cab6122c6c7c5f858bfc5afd03db4a85a)), closes [#114](https://github.com/the-inclusionist/the-inclusionist-engine/issues/114)
* the cartridge LEAVES - this repository becomes the engine, as ADR-0036 ordered on 2026-08-25 ([b55b88e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b55b88e7d50ea04b106402082c2c11e8c9028545))

## [7.0.1](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v7.0.0...v7.0.1) (2026-09-07)

## [7.0.0](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v6.36.1...v7.0.0) (2026-09-07)

### ⚠ BREAKING CHANGES

* **input:** the gamepad READS the declared table, and R1/R2 stop running
* **contract:** `GameDeclaration` gains `world(): WorldScope`. It is MANDATORY.
`game-chess` and `game-15puzzle` both need it; neither is in this repository.

⚠️ THE DEFECT IS THE WORST CLASS THIS PRODUCT CAN HAVE. `alcanceDoModo` gives the
nine empathy simulations the scope `mundo`, and the root implements `mundo` as the
PixiJS canvas. The reasoning is CORRECT and written down: the menu is the
instrument for leaving the simulation, and a blindness that blanked the pause menu
* **input:** the touch layer stops calling `pause` what everything else calls `start`
* **input:** the transports speak POSITIONS, and 126 points of game vocabulary leave the engine
* **input:** `action5`..`action8` are now `leftShoulder`, `leftTrigger`,
`rightShoulder`, `rightTrigger`. Nothing consumes them yet, so nothing breaks
today.

=== 1. THE NAMES, AND A RECORD FROM THIS MORNING IS SUPERSEDED ===

ADR-0085 named them `action5`..`action8` and argued that gamepad vocabulary in
the abstract set repeats the defect ADR-0074 was written to fix. The Dev read the
argument and answered with a different one: `action7` is unreadable at the point
where somebody writes code, and a project built by volunteers cannot afford a
vocabulary nobody can say out loud.

⚠️ THE OBJECTION IS NOT WITHDRAWN, and both records keep it in writing. On a
speech recogniser `leftTrigger` names nothing that exists. What ADR-0086 answers
is that the names are ANATOMICAL before they are gamepad - two fingers per hand,
one above the other - which survives a transport with no shoulders better than a
number does: a touch layout can stack two buttons under each thumb and the name
still says where the finger goes.

⚠️ AND THE EIGHT VERBS NOW CARRY TWO NAMING CRITERIA, deliberately. The diamond
stays NUMBERED because four positions in a cross have no name that crosses genres
- what a platformer calls jump, a quiz calls confirm - and a thumb reaches all
four, so there is no anatomy to borrow. The shoulders have one. Where a name
describes the HAND it beats a number; where none exists, a number beats a
borrowed metaphor.

=== 2. THE PRESET, AND THE MEASUREMENT THAT DECIDES IT ===

ADR-0074 §1 said "what today is jump is action1; run is action1-mod; swap is
action2; especial is action3". The Dev corrected three of the four:

  action1 -> run        keyboard U          pad X (b2)
  action2 -> jump       keyboard J/Space    pad A (b0)
  action3 -> especial   keyboard K          pad B (b1)
  action4 -> swap       keyboard I          pad Y (b3)

⚠️ MEASURED AGAINST `input/keyboard.ts:36-37` AND `input/gamepad.ts:111`, verb by
verb:

  · the corrected preset moves ZERO of four verbs off the key and the button a
    child uses today;
  · ADR-0074's preset would have moved THREE.

The record that looked conservative was the disruptive one. This correction is a
* **contract:** `GameDeclaration.topology` is now `topology(): Topology`
rather than a value. Both existing games need one line - see below.

Five of the six declaration fields were already functions. The sixth was a
value, inherited from the first declaration ever written, a platformer whose
world never resizes. The asymmetry had already been patched TWICE before anyone
named it: `platform/audio-sonar.ts` always asked for `topology: () => Topology`
in its port, and `boot/create-game.ts:205` bridged the gap with
`() => o.declaration.topology` - a function returning a constant. A patch that
appears twice is the contract asking to change.

The second game broke on it. `game-15puzzle` has three board sizes chosen while
the game runs, and wrote `get topology()` to fit. It type-checks. It is also a
COINCIDENCE OF TypeScript rather than a contract: nothing tells the next author
it is expected, nothing tests it, and `conformanceProblems` still read it once -
so a caching consumer went stale in silence.

⚠️ CONFORMANCE NOW REPORTS THREE FAILURES WHERE IT REPORTED ONE, and the split is
the point. `topology: missing` is a field nobody wrote. `topology: must be a
FUNCTION (it was a value until ADR-0084)` is the field written the old way -
which is what an author copying a pre-0084 example produces, and what otherwise
dies in the first frame with «o.declaration.topology is not a function»: a
frozen screen, indistinguishable to a child who cannot see from a game that
never started. Saying only "missing" would send that author hunting for a field
that is right in front of him.

⚠️ AND THE MESSAGES BECAME ENGLISH, WHICH WAS NOT A CHOICE. The `engine-i18n`
gate refused the first version of this change: it took `core/contract.ts` from 6
raw Portuguese strings to 8, and that ceiling only shrinks. Two of the three ways
out were wrong - writing the new messages in Portuguese (still fails), or raising
the ceiling, which is loosening the anchor the gate exists to hold. The third:
these sixteen strings are DEVELOPER DIAGNOSTICS that never reach a child, and the
CLAUDE.md artefact rule already asked for English. All sixteen converted, and
`core/contract.ts` left the debt list - which the gate then required too, in a
separate assertion. It is a good gate and it caught me twice in one change.

THE GATE: `tests/contract-topologia-e-funcao.node.test.js`, born failing under a
confirmed mutation - removing the `typeof !== 'function'` branch turns the
value-rejection test red. It asserts the three distinct messages, that a board
changing 3x3 -> 5x5 reports 5 on the second read with `distance` following it,
and that columns collapsing to zero start failing conformance AT THAT MOMENT.

⚠️ The bridge in `boot/create-game` is guarded by the TYPE CHECKER, not a test,
and deliberately: reverting it to `() => o.declaration.topology` produces
`TS2322: Type '() => () => Topology' is not assignable to type '() => Topology'`.
Measured. A test would say less, later.

WHAT THE TWO GAMES NEED, one line each, neither in this repository:
  · game-chess     `chess-declaration.ts:53`  `topology: {...}` -> `topology: () => ({...})`
  · game-15puzzle  `puzzle-declaration.ts:64` `get topology()` -> `topology()`

WHAT THIS DOES NOT DECIDE: the shape of `Topology` itself. The grid metric and
dimensions beyond two are a separate open question, and answering it here would
have hidden it.

Verified: 84 records sound, typecheck clean, 133 files / 2414 tests green,
build passes, precache 98 entries.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

### Features

* **a11y:** a alternância chega ao botão de CORRER, e grudar migra para o pulo em contexto ([d91e5a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d91e5a8161e325ed7ca3f9d4f02b3e2b6133a973))
* **a11y:** a alternância de movimento passa a mostrar ☝️, não 🦾 ([7dc1f96](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7dc1f96c07b55f34c2d270584a6c7e9ce83e0749))
* **a11y:** a barra rápida vai para o HUD, e a pausa fecha o ANEL ([8a45034](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8a45034554f79f845ddd1134e4fca75d4ff8e1ee)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** a legenda da pausa deixa de ser invisível para quem mais precisa dela ([73f5962](https://github.com/the-inclusionist/the-inclusionist-engine/commit/73f596241129b96fabafa8ee8d254e580831c65b))
* **a11y:** a lista de pausa vai a 44 px, uma coluna, centrada e mais larga ([b8ea6a2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b8ea6a29b6363f57e01f0713627141557d944642))
* **a11y:** a narração passa a INTERROMPER, e não a enfileirar ([bf00001](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bf00001445cf0ba86d25e0b4eda226f495cd2fe3))
* **a11y:** a navegação de menu vira ANEL — antes do primeiro está o último ([2836aa1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2836aa101da99ff3ccd9313c1621ef18c9f6665d))
* **a11y:** a pausa vira SETE itens e os ajustes descem para um submenu ([da59096](https://github.com/the-inclusionist/the-inclusionist-engine/commit/da5909665a3bb853b55e623b5bb9613381442d98))
* **a11y:** as cinco notações de fração viram AJUSTE com moldura e marca, não botão de menu ([ac22354](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ac22354893a40a118c2e5104c7bee8a49ffcf3b9)), closes [#tm-fr](https://github.com/the-inclusionist/the-inclusionist-engine/issues/tm-fr)
* **a11y:** o alto contraste passa a alcançar os menus — por classe, não por filtro ([875a43c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/875a43c80b5f9f3dfd8e152c3f172ba243b02b90)), closes [#83](https://github.com/the-inclusionist/the-inclusionist-engine/issues/83) [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** o CRT decorativo cede à acessibilidade, e a saída é da criança — uma chave por efeito ([c0222a7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c0222a7b8eeabd4104aff233d78adb2156ee9243))
* **a11y:** o menu de abertura dobra de largura e os submenus viram listas verticais ([74af726](https://github.com/the-inclusionist/the-inclusionist-engine/commit/74af726eaa19d1bfab16986bf03c639a157af250))
* **a11y:** o modo `accessibility` — e a saída dele vem antes da entrada ([a73a81d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a73a81d6fc25c049c598e0d483f34f410ebc66c5)), closes [#6](https://github.com/the-inclusionist/the-inclusionist-engine/issues/6)
* **a11y:** todo item de menu anuncia a POSIÇÃO — "6 de 10", e dá para desligar ([51d5574](https://github.com/the-inclusionist/the-inclusionist-engine/commit/51d5574bece7c10b1049930b21fbbbbb985cdaa6))
* **boot:** createGame ATTACHES the menu navigation it was already building ([73dd3f2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/73dd3f2b5e203e228a23cbed1221326e2bbfafac))
* **boot:** the declared world must exist in the document, or the host is told ([1f50190](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1f50190815e3ac187589976d6de4df0bdb4019d5))
* **boot:** the vision filter reaches the DECLARED world, and the menu rule generalises ([72f78e3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/72f78e39c2dd16d46bbf9f056ec261928521682a)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **contract:** the game declares which element is its world ([bc14f95](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bc14f9572bdc71802035472207dec09969cb3da8)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **contract:** the grid was never ONE thing - the game declares how a step is counted ([be704d1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/be704d1ae6b3e0c1b923dd39d41176956ce82812))
* **contract:** topology is a function, because a board can change size ([75e208d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/75e208d3981ee74a762076220f4c97540b5df26f))
* **core:** the game's WORDS become a preset, and the boundary becomes a gate ([93c6fb4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/93c6fb4c1c0b8f52286e60064173cb48408ee20f)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **css:** a faixa de OVERLAY do `Z` chega ao CSS, com gate — e a adoção fica NOMEADA ([5ebbb76](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5ebbb76cce454786826d37da3aa0af45a71b6cba))
* **debug:** a sonda do personagem vai para dentro do painel `?debug=true` ([35544ba](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35544bac2612bc62ea7a94e1b3f95f623f8f2988))
* **engine:** quadro que lança PARA o laço e anuncia — e ponto deixa de ser sinônimo de acerto acadêmico ([33c373a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/33c373a69950dc23b20f9d77866f9e865df9c774))
* **game:** a arte procedural do lixo e das lixeiras, e a placa vira BARREIRA em vez de penalidade ([0923712](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0923712d246ed211086f78eea45d6682ebdaf98e))
* **game:** a geografia da reciclagem — onde o lixo, as lixeiras e a placa nascem ([1fd663a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1fd663ac5e9eeb0b01d25eb88cbce09623709e9d))
* **game:** a máquina de estados de pegar/carregar/arremessar — a metade que não depende do objeto ([4e256f7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4e256f787cc7fc60b64ff7eaa4e24ed4e1ad9122))
* **game:** a placa barra a CRIANÇA, o lixo trava na mão, e a carga passa a ter tipo ([50b32d8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/50b32d8e75c65aed1749d5e429baa1acefdf2f38))
* **game:** a reciclagem ligada ao mundo — sprites, a guarda de entrada, e o ponto que sai uma vez ([c65e45d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c65e45d18d3c80214812449d0fa059d6e64b194b))
* **game:** o botão de interação volta a ser o único gatilho da carga, e o objeto vai para a barriga ([b34c87e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b34c87e23924528535c7bc3f31eeabe1b4fb3001))
* **game:** o estado do lixo no mundo — pegar, carregar, arremessar e descartar ([c2a658d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c2a658d35c2b789a6efc815e043f44e94ed3723a))
* **game:** pegar vira botão, a direção separa arremessar de soltar, e um item por volta ([9461308](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9461308c153b84017a6defb94ba8e7f7dffd566f))
* **game:** reciclagem — quatro materiais, quatro lixeiras, e um ponto que não move nada ([35f7077](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35f7077700750002877d7a4544c863a6cc56347d))
* **i18n:** a consumer can register its own dictionary ([3f27fc8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3f27fc8102e769356d99af0c7b2b377a557808d5))
* **input:** fourteen abstract actions, and the gamepad's names stay in the gamepad ([ba48b08](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ba48b08cca85a44e79171b8c4ec6ca93a49ab906)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103) [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the default bindings for keyboard and Xbox, and a gate that catches a duplicate ([5107c9b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5107c9b847eef91a1ee7d6139f64813a3a3006ec))
* **input:** the saved-scheme vocabulary migration, quarantined in its own module ([f0324dd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f0324dd70178195e09c3ecb9494f2bdf0c4e8d94))
* **input:** the touch slot menu asks the game, and the last label table dies ([0a64051](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0a64051abba49dba3faa4f4eafaabd64eccafc07)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103) [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **input:** the transport list stops living in a test and becomes the engine's ([fa65440](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fa6544090c2e21c9df3231212bcaf8edd319f1ad))
* **input:** the transport registry, and the sentence a child gets BEFORE starting ([e86bb82](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e86bb82fa454e90e5512a78b383817b085b6c3e4))
* **input:** the wizard asks the game what a button is called, instead of knowing ([7c9c085](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7c9c085a7d5c282bc623a10beb517d5d502e9f11))
* **loop:** a stopped loop now SAYS it stopped - ADR-0054's other half ([7079368](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7079368803efad1043dd3730a0a70b30bf377db6)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **main:** the platformer root shows the reach notice too - and it has exactly nine actions ([789f3e5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/789f3e510a42ac2e4c47e314f9a24d7b85dd42b1))
* **render:** name the questions the 31 readers of `p.viz` actually ask ([153e090](https://github.com/the-inclusionist/the-inclusionist-engine/commit/153e09072c75afc0cd2c477528c39289f7cb5b6d)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **render:** the two axes COMPOSE, and the keys are checked against the real tables ([63ff8aa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/63ff8aa8409546ee0ab158aad7243d87f2ae551e))
* **render:** two composable axes, and the migration that comes before any reading ([bb796e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bb796e21e5ca36e7a3c142e93a03fef78d7aa877)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **sonar:** the narration says the BEARING, in the words the game's space uses ([b88a354](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b88a354fbe146b32df3e4a4e4fc72dd524ec8040))
* **storage:** the game id leaves the engine, and two games stop colliding ([eae8a2c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/eae8a2c6fbde46374ac8a77e4a7e0a7399ee4e51)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **ui:** a focus trap, because `aria-modal="true"` was a promise the keyboard denied ([dfaec02](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dfaec02598a0e948e6857c375cec8d55dac7827f)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **ui:** the remap screen asks the game which actions it has, and what they are called ([76fb052](https://github.com/the-inclusionist/the-inclusionist-engine/commit/76fb05262feb3f39603bb912082c94cc8a3aec6d)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **ui:** the screen that says, BEFORE starting, that your control cannot reach this game ([848e4c6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/848e4c69a19bfbed96453b688c38837a41495d5e))
* **ui:** the title legend asks the game for the SHORT word, and a second label is born ([cb54556](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cb54556e09848e051663a9c9b928c55c8741d319)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)

### Bug Fixes

* **a11y:** a alternância do correr ganha padrão declarado e a marca do ADR-0029 ([29ced47](https://github.com/the-inclusionist/the-inclusionist-engine/commit/29ced478de1cd354fd7c680c168e5b75a381507e))
* **a11y:** a alternância do correr tirava a SONDAGEM da bengala de quem não vê ([ec223be](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ec223bec32ec2a81cacbd2df627245e5c788b191))
* **a11y:** a barra do HUD mostra SÓ os botões, e o HUD desce para baixo dela ([3be21f7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3be21f7807011326061aaabce850edd3ce780d86))
* **a11y:** a correção de daltonismo passa a alcançar os MENUS — e a empatia não ([45bf345](https://github.com/the-inclusionist/the-inclusionist-engine/commit/45bf345d9cfe06789bb54c4ad03e85d5bee4e63c)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82) [#cvd-fix-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-fix-deuter) [#cvd-fix-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-fix-deuter) [#cvd-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-deuter)
* **a11y:** a instrução FALADA passa a nomear o botão que de fato funciona ([d8c4954](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d8c4954321db32cd192c12d54aa514607cb28095)), closes [#6](https://github.com/the-inclusionist/the-inclusionist-engine/issues/6)
* **a11y:** a lista de pausa deixa de ser MUDA ao ser navegada ([ce5f891](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ce5f89187cdf04d877e339248bc069d57c75171a))
* **a11y:** a mensagem do `throw` do TTS sai do crivo de português ([e0cacbe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e0cacbe0524f9693cd60a7b8c255056d92c83d22))
* **a11y:** a vinheta do CRT cede para os modos de acessibilidade ([6a7100e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6a7100e8b8625f6cb635d591d2650b7100361165)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** as notações de fração e as fileiras da tabuada param de se deitar ([1496b2b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1496b2bbb9eee9ac3af1ae92b9d8b8cef7c1ea05))
* **a11y:** criança em teclas de alternância volta a correr, e a explicação da fonte para de aparecer duas vezes ([40dfc0d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/40dfc0d21fb7597c0d50d2a916e385db1a9e9734)), closes [#11](https://github.com/the-inclusionist/the-inclusionist-engine/issues/11) [#88](https://github.com/the-inclusionist/the-inclusionist-engine/issues/88)
* **a11y:** o `aria-pressed` da pausa passa a cair no botão que existe ([cece449](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cece449cd5da9e61255a46f40062119363cf52ac)), closes [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** o bipe do guia auditivo nasce DESLIGADO — provisório, e com data marcada ([0fd35f1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0fd35f1d54ced43914797ff0354769334b8778ff))
* **a11y:** o jogo e o leitor de tela passam a dizer o MESMO nome do item ([b6f6d2a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6f6d2ad40ce7ab87f31f5adc465337d099a3ff4))
* **a11y:** o menu já nasce em 7:1 — não depois de a pessoa achar o ajuste ([a88db4a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a88db4a3210c66967158271f0e824b0fbecc34bd)), closes [#83](https://github.com/the-inclusionist/the-inclusionist-engine/issues/83)
* **a11y:** o NOME do diálogo de pausa era português cru num jogo em inglês ([65c527b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/65c527b4f3c2a6d2656ed4f8a5eb57e71a23f752))
* **a11y:** os dez ícones da tela de título voltam a funcionar — um comentário os comeu ([94c8111](https://github.com/the-inclusionist/the-inclusionist-engine/commit/94c811164b785a45658727a3c29eb409ed5dd6da)), closes [#80](https://github.com/the-inclusionist/the-inclusionist-engine/issues/80)
* **adr-gate:** a record that does not parse no longer takes the whole gate down ([551d3b2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/551d3b297851b81a9c573145361c7136ae670a7b))
* **ci:** `default:` was killing both scanners, and they had never run once ([d5f54ce](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d5f54ce32eb046ab7870c1db16ad2b10ecb9d2d1))
* **game:** "um por volta" era UMA UNIDADE DE CADA — quatro itens, um de cada material ([9fe7b87](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9fe7b8789958aa205b16b46ad14f94381b505308))
* **game:** a barreira vira SEGMENTO, e o alcance do pegar cobre o tile do lado ([68c3476](https://github.com/the-inclusionist/the-inclusionist-engine/commit/68c3476204865e68e9a634222cb0e2768e9c92d3))
* **game:** a placa vira DADO DE FASE — coluna 26, linha 46, onde o Dev a pôs ([1ae6a53](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1ae6a53f0b05501738ed24f3e2733c594e17c7e5))
* **game:** a reciclagem ligada ao MAPA de verdade — quatro defeitos que só o navegador mostrou ([30a1d8c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/30a1d8c37cd0525b4781133bc162182fa12159a9))
* **game:** o lixo passa a nascer onde as MOEDAS nascem, roda de material a cada volta, e o grude sai do pulo ([25d0743](https://github.com/the-inclusionist/the-inclusionist-engine/commit/25d0743b46f14c03ece436b10bcd2fe4a35bf93b))
* **hud:** a game's declared name stops going into an HTML attribute ([79baa27](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79baa27eee676a3923715197b1c2f87208b9cc48)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)
* **i18n:** `cvd.off` is a FALLBACK, not the fourth choice - split the two ([ff9141a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ff9141afe9cbda08d7abecd5d00db7cfd9dc6770))
* **i18n:** a game's strings are checked at the door, because "i18n" stopped meaning "reviewed" ([a9670fa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a9670fa30f24ae63c11552e26b6bf44073719dea)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)
* **i18n:** matemática volta a traduzir — a exceção da alfabetização tinha comido a regra ([a937f7c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a937f7c05073ad078f7ee48c838a5d1c5a3b1b79))
* **i18n:** the corrections' off entry says "trichromatic vision", not "normal" ([e747406](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e7474060934ce8b58a60cb8fad7cb32068ddb332))
* **i18n:** the fourth colour-vision choice names a VISION, not a switch ([3dd0988](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3dd0988411360ae4cdc0f4c7a0dfe282e3c59049))
* **input,ui:** the game's WORD leaves the markup in the two remaining sinks that took it ([1653574](https://github.com/the-inclusionist/the-inclusionist-engine/commit/16535748b5386c89a11f8a3aa7539df8139ae3c8))
* **input:** the gamepad READS the declared table, and R1/R2 stop running ([b6b514a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6b514a239fd3e924bd03e23300ea9160b04e01b))
* **input:** the gamepad wizard's saved map is the THIRD format, found by sweeping instead of waiting ([5c63cdb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5c63cdbe6018232545a822382aa77e4415cd94e5))
* **input:** the mapping wizard can reach all fourteen positions, not nine ([14e1f41](https://github.com/the-inclusionist/the-inclusionist-engine/commit/14e1f41955328dc872cb9de745ef49b0766150a7))
* **input:** the touch map is a SECOND saved format, and it nearly went unmigrated ([79dbd47](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79dbd47f1a32c8950cefa37687d2ba786ad903f7)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **pkg:** sync the lockfile - the previous commit would have failed CI at `npm ci` ([5e2f058](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5e2f05824da4c1a71182509200480c50348b012c))
* **pkg:** the published engine could not be built against by anyone - and nothing here could see it ([a2306f0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a2306f0df25499fff07c3444071f0b1bc1c31539))
* **pwa:** a segunda página deixa de depender da ORDEM das rotas para existir ([f463f4c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f463f4c0297553ae7cc43571f75eb3a734f32448))
* **quiz:** activity content stops being markup - the sink [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106) was actually about ([d2bdf99](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d2bdf9979db4650ca4e1797d50c691448830f2fd))
* **quiz:** the three lights return DATA, not markup — and the label now translates ([9dd4205](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9dd4205a3accfb2c531b6e460d1f283c2b2b200a))
* **render:** a roda do carro vira redonda, e o teto deixa de ser um bloco ([5bbef1f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5bbef1f5bf026b8930c77fbb8ae818bfb51e6e7f))
* **render:** o alto contraste contornava o ATLAS INTEIRO — o "kage bunshin" ([688ee9a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/688ee9a4460bbf5ca3229cf4b0438a888950ebc5))
* **rng:** a factory, 32-bit arithmetic, and decoration stops moving the game's draw ([479f07f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/479f07fb1fd2e1e748de0dd02aab74f725de38af)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **tools:** the migration asked an eventually-consistent list, and stopped itself ([cc1ebfe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cc1ebfe3dfc7c46a86cbad9910abb20be6a21f2d)), closes [#2](https://github.com/the-inclusionist/the-inclusionist-engine/issues/2) [#1](https://github.com/the-inclusionist/the-inclusionist-engine/issues/1) [#1](https://github.com/the-inclusionist/the-inclusionist-engine/issues/1) [#3](https://github.com/the-inclusionist/the-inclusionist-engine/issues/3) [#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101)
* **tts:** the neural voice arrives by a port - 165.6 MB of consumer install becomes 23.1 MB ([2999bbd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2999bbd7770041c2c3f39c0f9a15841e3b3fc953))
* **ui:** the crash notice becomes a real element - the pseudo-element could never have shown ([ca0384a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ca0384a31ab8d1cbd02e5750fe6c428d0d8bc2db)), closes [#7f1d1d](https://github.com/the-inclusionist/the-inclusionist-engine/issues/7f1d1d)
* **ui:** the scenario id is escaped, and the remaining census is classified - ceiling 11 -> 1 ([7229f07](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7229f078b3ff17e276383669e7bb69563de8204a)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106) [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)

### Code Refactoring

* **input:** shoulders and triggers get names, and the platformer preset is corrected ([ab78095](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ab7809573634e1f4d34942bced203892d2f84863)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the touch layer stops calling `pause` what everything else calls `start` ([d22a8e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d22a8e2321f3b7fc4c9e22da4b6dfa24a6417ffb)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the transports speak POSITIONS, and 126 points of game vocabulary leave the engine ([d10a641](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d10a641c01ecd686554f74b73d11269231099812)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
