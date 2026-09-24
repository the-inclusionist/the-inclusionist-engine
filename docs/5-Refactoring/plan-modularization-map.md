Historical plan (2026-07-04, last updated 2026-08-23): kept as a record; the current state lives in the code under `app/js/**` and in ADR-0173 (the layer rule). [Today: `game.js` is gone; the engine's entry is `app/js/boot/create-game.ts`.]

# Extraction map — what is still left to take out of `game.js`

A study of `game.js` (v4.164.23, **3555 lines**) to stop extracting drop by drop and have the COMPLETE target
(the Dev's request, 2026-07-04). A companion to `plan-modularization.md` (§3 target, §4 order, §8 tests). Each module
follows the established pattern: **pure import, explicit I/O, with a test of the contract** (see [[project-inclusionist-testes]]).


> **Record correction (2026-08-06).** Commit `e30e8af` claims, as a finding that deserves action, that six
> accessibility panels would be unreachable because the buttons `#opt-sound`, `#opt-animation`,
> `#opt-movement`, `#opt-empathy`, `#opt-controls` and `#opt-visual` are missing. **The claim is false.** The panels open
> through the **pause menu**: the `.pm-btn[data-act]` items dispatch into the action table of `game.js`
> (`audio`, `motora`, `anim`, `visual`, `empatia`, `tipo`, `ajuda`). Checked in the browser with the game running:
> the six overlays open and render (audio 5 rows, visual 5, empathy 12, animation 10, typography 18,
> motor via `#opt-facil`/`#opt-altmove`), with no console error. The menu has 21 items.
>
> The `#opt-*` identifiers are **hooks for a future button bar**, not dead code: the `if(btn)` guards
> exist precisely so that the wiring takes effect when the buttons are created. Nothing to fix.
>
> The cause of the error is recorded because it is reusable: I tested ONE door (the button), did not find it, and
> concluded there was no door instead of a test error — even having read the menu's dispatch table twice
> during the rewiring.


## Already extracted (24 modules)
`core/{constants,tiles,world,state,loop,i18n,collision}` · `platform/{storage,audio,audio-mixer,speech}` ·
`input/{keyboard,devices,state}` · `ui/{fonts,dom}` · `render/{viz-modes,canvas,sprites,props,sprite-fx}` ·
`game/{player}` · `i18n/{pt,en,es}`. All `.ts`. `core/collision` and `game/player` (Stage 4) come with node
tests (ZOMBIES + Right-BICEP). `game/player` took the collision geometry; `jumpVel`/`showPower` stayed in game.js.

## Remaining — ~34 modules, in 3 tiers by coupling

Coupling legend: 🟢 leaf (≈zero game deps) · 🟡 cohesive subsystem (localised deps) · 🔴 coupled core.

### TIER 1 — Leaves / low risk / high test value (do first)
| Module | What goes | game.js (ref. lines) | Dep |
|---|---|---|---|
| `core/rng.js` 🟢 | `rnd`/`randInt`/`shuffle` + `_seed` (seeded, deterministic RNG) | 246–249 | — |
| ~~`core/a11y-sr.js` 🟢~~ **DONE** | `srSay`/`srAlert` extracted (+ browser tests). `vlibrasSay` by injection (`setVlibrasSay`) until `ui/vlibras` comes out. | — | ui/dom |
| ~~`core/collision.js` 🟡~~ **DONE** | `isSolidType`/`tileAt`/`solidTile`/`solidAt`/`surfTop`/`isWcRampRiser`/`caneBlockPx` + `rampSurfaceY`. The `gate`/`gateTiles`/`wcSolid`/`wheelchair`/`blindMode` state STAYS in game.js; the collision reads it through **closures** in `initCollision(ctx)`. + node tests. | — | WORLD, ctx |
| ~~`render/crt.js` 🟢~~ **DONE** | `crtScanVars`/`applyCrt` + `CRT` extracted (+ browser tests). Self-contained (recomputes the scale from clientHeight; it was NOT a cluster). | — | ui/dom, state |
| ~~`render/minimap.js` 🟡~~ **DONE** | `markSeen`/`redrawMinimapIfDirty`/`drawMinimapPlayer`/`resetMinimap`/`setMinimapCorner` + `setMinimapVisible`/`getMinimap`/`minimapSeenCount` extracted (+ browser tests; `initMinimap` creates the PIXI objects at boot). 11 sites in game.js updated. | — | PIXI, constants, collision |
| `game/attract.js` 🟡 | attract/demo mode: `startAttract`/`stepAttract`/`stopAttract`/`attractRecFor` + `_idleT`/`attract` | 752–806 | input, loop |
| ~~`ui/vlibras.js` 🟡~~ **DONE** | `vlibrasSay`/`vlibrasOpen`/`toggleLibras`/`vlTick` + `librasOpen`/`LIBRAS_RESERVE` extracted (+ browser tests). The cluster with `layout` broken by a callback (`setOnLibrasChange`); it imports `srAlert` (a11y-sr does NOT import back → no cycle). | — | a11y-sr, DOM |
| ~~`ui/webcam.js` 🟢~~ **DONE** | `eyeSet`/`onGaze`/`startEyeControl`/`stopEyeControl`/`loadWebGazer` + `eyeMode`/`setEyeMode` extracted (+ browser tests, incl. the gaze→key mapping). The #opt-eyes handler stays in game.js (it uses toggleBtn). | — | dom, a11y-sr, WebGazer |
| `ui/debug-panel.js` 🟡 | `buildDebugPanel` (the `?debug` tuning panel: TUNE/ANIM/JUICE/CRT) | 3499+ | TUNE, JUICE |
| ~~`ui/layout.js` 🟡~~ **DONE (layout)** | `layout` (integer 320×180 scale + VLibras reserve) extracted (+ browser tests). It closes the vlibras↔layout cluster (imports librasOpen/LIBRAS_RESERVE; no cycle). **Still missing:** `fpsTick` (uses app.ticker/fps-state) and `configureRender` (multi-screen → render/viewports). | — | dom, state, crt, vlibras |

> **Recalibration (during execution, 2026-07-04):** once the code was opened, Tier 1 has more coupling than the
> labels suggested. Corrections:
> - **DONE:** `core/rng.js` (2.26) and **`ui/dom.js`** (`$`/`$$`, 2.27) — a new base utility, it was not on the list; `$`
>   is used 219× and unblocks the others. Order: **utilities first**.
> - **`vlibras` + `layout` + `crt` are an interdependent CLUSTER** (not leaves): `vlTick`→`layout`, `layout`→
>   `crtScanVars` + reads `librasOpen`/`numPlayers`, `crt` reads `$`/`numPlayers` + localStorage on import. Extract them
>   together or with clear dependency injection — probably Tier 2, not Tier 1.
> - **`a11y-sr`** (`srSay`/`srAlert`, 111/37×) depends on `$` (✅) + `vlibrasSay` → it comes out AFTER `vlibras`.
> - **`webcam`** depends on `$` + `srSay` + `eyeMode` + `keys` (input) → medium, not a pure leaf.
> - Next realistic order: `vlibras` (speech+state) → `a11y-sr` → `minimap` → `attract` → `webcam` →
>   `debug-panel` → (the `crt`+`layout` cluster moved to Tier 2).

### TIER 2 — Cohesive subsystems / medium coupling
| Module | What goes | game.js (ref. lines) | Dep |
|---|---|---|---|
| ~~`platform/audio-cues.js`~~ | **It is NOT a single module** — the cue surface is heterogeneous; decomposed into 4 rounds of increasing coupling (below). `platform/audio.js` already has the base (audioCtx/mixer/tone/noiseHit). | — | — |
| `platform/audio-jingles.ts` ✅ | **[audio r1 — DONE]** jingles WITHOUT game state: `playVictory`/`playPuzzleSolved`/`firework` | 625–633 | audio.js (tone/ensureAC/catNode) |
| `platform/audio-earcons.ts` ✅ | **[audio r2 — DONE]** earcons + a bridge to captions: `sfx`/`doorSound` (`showCaption`/`captionsOn` stay in game.js — the UI toggles them, `win()` reuses them — and come in by injection) | 461–474, 527–530 | audio.js, showCaption (inj.) |
| `platform/audio-nav.ts` ✅ | **[audio r3 — DONE]** spatial a11y cues (blind/low vision): `playerCtx`/`caneProbe`/`caneTap`/`waterNav`/`sonar`/`panFor`/`needsAudioCues`/`updateGuide` + counters (`SURF_MAT`, `_guideCount` migrated). `playerCtx`/`panFor`/`needsAudioCues` exposed in the API (ledge guard + movement gate). `surfaceUnder`/`caneOn`/`caneColor` STAYED in game.js (step/movement/render) [Today: `platform/audio-nav.ts` was removed on 2026-09-23; the cane and blind-swim cues left the engine, and the sonar navigation lives in `app/js/platform/audio-sonar.ts`.] | 489–540, 561–564 | audio.js, tiles, players, coins |
| `platform/audio-ambient.ts` ✅ | **[audio r4 — DONE]** ambient track + thunder: `buildAmbient`/`updateAmbient`/`thunder` (`_ambient` migrated). A `_rainLevel` bridge (updateWeather writes, the module reads through a getter). The VISUAL weather `updateWeather`/`drawWeather` STAYED in game.js → it migrates to render (Tier 2). **Audio 100% modularised.** | 542–560 | audio.js, players, tiles |
| `platform/tts.ts` ✅ | **[GH#38 — DONE]** neural TTS (F5): `loadTTS`/`ttsSpeak`/`narrate`/`speakWebSpeech` + the engines' state. Created BEFORE `audio-nav` (which injects `narrate`). `populateTTSEngines`/`populateTTSVoices`/`reflectTTS` STAYED in game.js (panel → #54) and use `tts.get/setEngineSel` + `tts.get/setVoiceObj` + `tts.getEngine`. | 515–558, 2605–2634 | audio.js, audioCat |
| `render/world-tex.js` 🟡 | `worldCanvas`/`worldToTexture`/`worldTexFor` + live tiles `stepTileFx` (animated water/lava) | 142–169, 909, 1457–1487 | WORLD, TILE_COLOR |
| `render/high-contrast.js` 🟡 | Direct Rendering (a11y): `_dimDesat`/`worldToTextureDirect`/`directBgTexture`/`directSpriteCanvas`/`_roleOf`/`HC_ROLE`/`setRoleColor`/`resetRoleColors`/`DIRECT_CFG`/`hcOutline*` + persistence | 173–232, 2734–2768 | WORLD, canvas.js |
| `render/scene-parallax.js` 🟡 | `parallaxPlaceholder`/`themeSkyTexture`/`themeHillsTexture`/`updateParallax` + layers | 806–842 | PIXI, theme |
| `render/scene-city.js` 🟡 | Living city (L5): `creatures`/`stepLife`/`spawnCreature`/`streetCols`/traffic (`spawnCar`/`stepTraffic`/`drawSemaforo`)/`buildCityDeco` + `LIFE_TEX`/`ADULT_TEX`/`CAR_TEX` | 1175–1346 | WORLD, PIXI |
| `render/scene-sky.ts` ✅ | **[GH#43 — DONE]** `cloudWrapX` (+ **fix GH#21**) + `stepSky`/`stepV3Decor`/`drawV3Cloud`/`drawV3Grass` + `clouds`/`birds` state. The **6 layers** (`skyLayer`/`starsG`/`skyDecoG`/`fogG`/`grassG`/`themeFxG`) are still **created in game.js** (the render graph's z-order is welded to parallax/worldSprite/lifeLayer/carLayer) and are **injected** — we moved only the logic, z-order untouched. v3 formulas verbatim; test with fake layers. | 1347–1454 | PIXI, theme |
| `render/fx.js` 🟡 | Juice: `spawnParticle`/`puffDust`/`burstSparkle`/`addShake`/`addHitstop`/`setSquash`/`stepFx`/`drawFx` + `JUICE`/`particles` | 1490–1522 | PIXI |
| ~~`game/player.js` 🟡~~ **DONE** | `makePlayer`/`BOX`/`SPAWN`/`jumpVel`/`isBouncyGroundBelow`/`touchingWall`/`clingSides`/`firstClingSide`/`spiderReattach`/`wrapConvex` extracted (+ tests). `EASY` went to `constants`. Only `showPower` stayed (DOM/HUD → future `ui/hud`). | — | collision, constants |
| ~~`game/coins.js` 🟡~~ **DONE (placement complete)** | `findCoinCandidates`/`pickCoins`/`positionEasyCoins`/`takeCoin` extracted (+ tests; world+anyEasy/wheelchair via `initCoins`, pools passed by game.js). What remains labelled "coins" is NOT placement: `rebuildCoins`/`coinTexFor`/`shapeTexture`/`letterTexture`/`coinSprites` (render → render round) and `malform`/`ferreiroDistractors` (distractors → `game/quiz`); `addCoinsForOwner` (push+render). | — | collision, rng, state |
| `game/powerups.js` 🟡 | `powerups`/`pupTexFor`/`rebuildExtras`/`setupExtras`/`takePu`/`puTaken` | 1020–1054 | WORLD, props.js |
| `game/level-geometry.js` 🟡 | accessibility geometry (wheelchair): `buildRamps`/`buildWcGeom`/`buildRopes`/`buildElevators`/`elevAt`/`drawElevators`/`drawCane`/`drawRunCane`/`drawChair` | 1056–1173 | WORLD, wcSolid |
| `input/keyboard-runtime.js` 🟡 | `keydown`/`keyup` handler + `applyControls`/`assignControls`/`kbFor`/`keyUsedByOther` + `controls`/`GAME_KEYS` | 413–507 | keyboard.js, state, menus |
| `input/gamepad.js` 🟡 | `pollPads`/`padActions`/`stdDirs`/`padMapFor`/`bindActive` + DirectInput wizard (`padWiz*`/`openPadWiz`/`padWizTick`/`padWizBind`…) + `gamepaddisconnected` | 2440–2600 | state, players, devices.js |
| `input/touch.js` 🟡 | touch controls: `renderTouchMap`/`showTouchControls`/`hideTouchControls`/`applyPadDesign`/`applyPadPhysical`/`setPadMm`/`padLayoutFromId` | 2927–2996, 3426–3497 | DOM, devices.js |
| `ui/title.js` 🟡 | `drawTitleScene`/`titleButtons`/`buildTitleMenus`/`updateTitleLegend`/`navTitle` | 738, 3308–3424 | DOM, i18n |
| `ui/hud.js` 🟡 | `buildGameHud`/`updateGameHud`/`buildScreenPause`/`updateHud` | 1609–1625, 2254 | DOM, players |
| `ui/activities-menu.js` 🟡 | `setActivity`/`startActivity`/`reallyStart`/`setMode`/`actCat` + `_pendingAct`/`MODE` state | 2305–2412 | state, quiz |
| `ui/settings-*` 🟡 | a family of a11y panels (large): `-visual` (`renderVisual`/viz/colours) · `-audio` (`renderAudio`/`catRowHTML`/`wireCatControls`/`renderNavSound`/sinks) · `-typo` (`renderTypo`/`setGameFont`) · `-motion` (`renderMotion`/juice) · `-empathy` (`renderEmpathy`/`setWheelchair`/`setOneButton`/hearing) · `-controls` (`renderControls`/`keyName`/remap) · `-motor` (`renderMovPlayers`/`setEasy`) | 2685–3110 | DOM, many setters |

### TIER 3 — Coupled core / high risk (last, with strong tests first)
| Module | What goes | game.js (ref. lines) | Note |
|---|---|---|---|
| `game/physics.js` 🔴 | **the heart:** `sampleFeatures`/`resolveX`/`resolveY`/`triggerLava`/`stepPlayer`/`update` | 1681–1946 | deterministic → **target no. 1 for node tests** (jump/gravity/water/trampoline/collision) |
| `render/viewports.js` 🔴 | per-player texture: `parallaxTexFor`/`pixiFilterFor`/`playerVizTex`/`applySharedTextures`/`applyVpFilters`/`applyVizGlobal`/`setPlayerViz`/`reapplyVizAll`/`renderVpOverlay`/`updateVpDots` | 2628–2728 | multiplayer on separate screens |
| `render/draw.js` 🔴 | render orchestration: `draw`/`placeCam`/`ensureSprites` (layer order) | 1537, 1947, 1954–1995 | consumes almost the whole render |
| `game/quiz.js` 🔴 | activities (literacy/maths): `openQuiz`/`pickWord`/`openSilabas`/`openAlf`/`openBraille`/`openPre`/`renderQuiz`/`quizConfirm`/`quizWin`/… + pools (`SILABA_POOL`/`_recentWords`) + fractions (`fracStr`/`fracGraphic`/`fracSpeak`) | 1996–2252, 2322–2372 | large, DOM + gameSay + state |
| `ui/settings-panel.js` 🔴 | `openOptions`/`closeOptions`/`openHelp`/`renderMapHub` (orchestrator of the Tier 2 panels) | 3023–3110 | opens the `settings-*` |
| `ui/shell.js` + `ui/menu-nav.js` 🔴 | phase machine: `setPhase`/`togglePause`/`showTitleMenu`/`quitGame`/`printMode`/`restartGame`/`win` + universal navigation `menuNavKey`/`navDialog`/`navPause`/`pauseSelect`/`menuItems`/`dialogBack` | 2258–2304, 3199–3301 | ties everything together |
| `game/session.js` 🔴 | cycle/multiplayer: `respawnFigure`/`respawnPlayer`/`joinPlayer`/`setNumPlayers`/`fitsN`/`activateScreens`/`resetPlayerState`/`win` | 2246, 2383–2438 | dynamic screens |


## Completion plan — full inventory of what remains (2026-08-06)

Measured on the `game.js` of **2786 lines**: 220 top-level functions, 64 mutable globals, 31 direct accesses to
`localStorage`, 60 imports.

**What decides parallel vs serial.** It is not the coupling between functions — it is the coupling in the *file*. While
the agents only write NEW modules and nobody edits `game.js`, the extraction parallelises almost without limit (Wave 1:
10 simultaneous agents, zero conflict). What needs ordering is (a) the contract between new modules, (b) the
rewiring, which is serial by nature, and (c) the special case of the physics, which needs an anchor before it moves.

### GROUP A — parallelisable right away (17 modules, none depends on another)

| # | Module | Functions that go |
|---|---|---|
| A1 | `render/high-contrast` | worldToTextureDirect · directBgTexture · directSpriteCanvas · directSpriteTexture · _dimDesat · _dcfg · _roleOf · saveHcRole · worldTexFor · coinTexFor · _rebakeDirect |
| A2 | `render/textures` | shapeTexture · letterTexture · pupTexFor · indexedToCanvas · silhouetteCanvasIdx |
| A3 | `render/weather` | updateWeather · drawWeather (+ _rainLevel, _weatherT, weatherLayer, _rainDrops, _flash, _thunderCD) |
| A4 | `render/lq-filter` | lqCurve · ensureLqFilter · lqFilter · lqName · setLq (+ lqT) |
| A5 | `render/scene-city` | buildCityDeco · applyCenarioVida · stepTileFx (+ grassDensity, decorSeed) |
| A6 | `game/traffic` | drawSemaforo · initTraffic · spawnCar · setFrontDim · stepTraffic (+ cars, _carT, _frontDim) |
| A7 | `game/life` | spawnCreature · stepLife · inDark · lifeSurfaceAt · lifeSurfaceLowAt · streetCols (+ creatures, _lifeSpawnT, _streetCols) |
| A8 | `game/level-geometry` | buildRamps · buildWcGeom · buildRopes · drawElevators · setupExtras · rebuildExtras · buildDarkRegions |
| A9 | `game/coins` | rebuildCoins · addCoinsForOwner · respawnCoinsForOwner · showPower (+ coinSprites, powerups) |
| A10 | `input/keyboard-runtime` | kbFor · applyControls (became `computeControlsState`, pure) · assignControls · actionOf · whichPlayer |

> **Sixth duplication: the semantic roles (A1) — RESOLVED.** `ui/settings-visual` declares
> `RoleKey`+`ROLE_KEYS` and `render/high-contrast` declares `PaintableRole`+`HcRoleKey` — the same four roles
> (`hazard`/`climb`/`water`/`gate`), in two lists that nothing links. The pt-BR labels and the colours are **not**
> duplicated; only the type and the list of keys. The symptom is change amplification and it is silent: a fifth role
> added to the render would get a colour and would not get a selector, with no type error anywhere.
>
> Postponed on purpose until the rewiring, and the wait paid off — but not for the reason I expected. I expected the
> injection of `roleColors` to evaporate; it **stayed**, and `game.js` became a pass-through (it imports `HC_ROLE` from
> `high-contrast` and injects it into the panel). That is right: it is `game.js` as the composition root, which is where
> **D2** wants to get to.
>
> Solution: `render/hc-role-data.ts`, a **zero-dependency leaf** module with the type, the canonical order of the
> keys and the default colours. Both sides import from there; `high-contrast` and `settings-visual` re-export with
> the names they always had, so no caller changed. The pt-BR labels did **not** go along: they are
> presentation and stay in the panel — but now typed by `HcRoleKey`, obliged to cover the list.
>
> The test that counts is `tests/hc-role-data.node.test.js`, and it was checked the other way round: with a fifth fake
> role, it goes red. Two cases I had written were **removed** because they could not fail —
> `ROLE_KEYS` now IS `HC_ROLE_KEYS` (the same reference) and `HC_ROLE` is born as a copy of `HC_ROLE_DEF`; comparing
> the two is asserting that an object equals itself. Apparent coverage is worse than none.

> **`core/world-query` — proposed by A5, postponed on purpose (2026-08-23).** Three modules of wave A receive
> `solidAt`/`tileAt`/`lifeSurfaceAt` by injection, and the `scene-city` agent proposed gathering them into a leaf module.
> The proposal is right and the timing is wrong: those functions read the world's `map` array, which is still a
> global of `game.js`. Extracting now would create a module whose only reason to exist is to receive as a parameter the
> state that **D1** will move. It is left for D1, together with the `map`; until then the injection continues, which is cheap and does not
> lie about where the state lives.
>
> **`getRainLevel` is not a collision (A3).** The weather agent flagged a name clash with `audio-ambient`. There is none:
> in `audio-ambient`, `getRainLevel` is a **ctx key** (something it receives); in `render/weather` it is an **export**
> (something it offers). The rewiring fits one into the other — `getRainLevel: weather.getRainLevel` — and that is
> exactly why the two names coincide.

> **Inventory correction (A10).** `releaseKey` was listed here by mistake: despite the name, it does not route the
> keyboard — it returns the **gate-key** powerup when a player gives up. It stays with the owner of the gate/powerups,
> not with the input. The agent that extracted the module read the function's body and refused to take it; the list was
> wrong, not the extraction.
| A11 | `input/gamepad` | stdDirs · padActions · pollPads · padMapFor · bindActive · padWiz* (10 fn) |
| A12 | `input/touch` | renderTouchMap · open/closeTouchCfg · hide/showTouchControls · padPxPerMm · padHandTag · applyDirStyle · applyPadPhysical · setPadMm · applyPadDesign · padLayoutFromId · padKind |
| A13 | `ui/hud` | buildGameHud · updateGameHud · updateHud · screenRect · buildScreenPause · renderPauseLegend |
| A14 | `ui/pause-icons` | PAUSE_ICONS · hasPrivateOutput · applyCalm · iconAct · iconLabel · reflectIconBtn · reflectPauseIcons · reflectTitleIcons (+ calmMode) |
| A15 | `ui/activities-menu` | buildTitleMenus · updateTitleLegend · setActivity · startActivity · reallyStart · actCat · setMode · setQuizLevel · applyLetra · mapSoon · renderMapHub · simNaoGlyphs · attachAbbr |
| A16 | `render/viz-setters` | setOwnerColors · setCbSafe · setRoleColor · resetRoleColors · setOutlineFg · setOutlineBg · reflectVizButtons · renderVizGroup · updateVizIndicator · fillExplain |
| A17 | `platform/storage` (close) | the **31** remaining direct accesses, including `inclusionist.reducedmotion.v1`, of a different format from the `incl_*` keys |

### GROUP B — after A (they consume A's contracts), parallel among themselves

| # | Module | Depends on | Note |
|---|---|---|---|
| B0 | **characterisation of `physics`** | — | node tests pinning jump, gravity, water, trampoline, collision. **It comes before B1**, not together |
| B1 | `game/physics` | B0, A8, A9, A7, A6 | sampleFeatures · resolveX · resolveY · triggerLava · stepPlayer · update |
| B2 | `render/viewports` | A1, A2, A4 | parallaxTexFor · pixiFilterFor · lvOverlayCanvas · playerVizTex · applySharedTextures · applyVpFilters · applyVizGlobal · setPlayerViz · reapplyVizAll · renderVpOverlay · updateVpDots |
| B3 | `game/quiz` | A15, A9 | 29 functions — the largest remaining block (openQuiz, renderQuiz, quizConfirm, the 5 activity generators, the 6 *Html) |
| B4 | `ui/settings-panel` | the 7 panels (done), A13 | open/close of each overlay + frontOverlay + _ovZ |

### GROUP C — mandatory series (mutually coupled, one at a time)

They share `collected`, `ended`, `pauseActor`, `phase` and call each other
(`win` -> `restartGame` -> `setPhase` -> `pauseSelect`). Extracting them in parallel produces three modules that
import each other in a cycle.

| # | Module | Functions |
|---|---|---|
| C1 | `render/draw` | draw · placeCam · ensureSprites · configureRender — consumes practically the whole render |
| C2 | `game/session` | respawnFigure · respawnPlayer · joinPlayer · setNumPlayers · fitsN · activateScreens · resetPlayerState · win · restartGame · isMobile |
| C3 | `ui/shell` + `ui/menu-nav` | setPhase · togglePause · quitGame · printMode · hideTips · fpsTick + menuItems · menuFocus · dialogBack · navDialog · pauseSetSel · navPause · menuNavKey · pauseSelect · sharedDialogOpen · navTitle · titleButtons |

### GROUP D — closing

| # | Work |
|---|---|
| D1 | migrate the **64 remaining globals** to `core/state.ts`, one setter at a time (like the mega-variables already done) |
| D2 | `main.js` as the composition root; `game.js` **dissolves** |

### Caveat about the coupling measurement

The sweep of who writes which global has known noise: local variable names (`s`) and top-level declarations
that fall inside the range attributed to the previous function (that is why `showPower` appears writing overlay
flags). The hubs that survive the noise and sustain GROUP C: `_lastSharedViz` (7 writers), `collected`
(5), `pauseActor` (5), `selVizPlayer` (4), `MODE` (3).


## Closing
- **`main.js` (composition root):** imports everything, does the boot wiring (the various `initX()` in the right order),
  registers listeners. `game.js` **dissolves** (it becomes just `main.js` or disappears).
- **Remaining state → `core/state.js`:** gradually migrate the top-level `let`s that are still global state
  (`collected`/`ended`/`MODE`/`letterCase`/`calmMode`/`blindMode`/`hcMode`/`oneButton`/`wheelchair`/`blindMode`…)
  as each consumer leaves — each with its setter, like the 8 mega-variables already done.

## Suggested order
1. **The whole of Tier 1** (leaves) — it shields stable pieces and raises test coverage quickly.
2. **Tier 2** per subsystem, in the order: **audio in 4 rounds ✅** (`audio-jingles` → `audio-earcons` → `audio-nav`
   → `audio-ambient`, all DONE) + `tts` ✅ → `player`/`coins`/`powerups`/`level-geometry` →
   `render/*` (world-tex, high-contrast, scene-*, fx) → `input/*` → `ui/*` (title, hud, activities, settings-*).
3. **Tier 3** last, each one with **strong tests BEFORE** (especially `physics`): physics → draw/viewports
   → quiz → shell/menu-nav/session.
4. **`main.js`** and the dissolution of `game.js`.

> Estimate: ~34 modules + `main.js`. It does not need to be followed to the letter — it is the map; I adjust boundaries when
> opening each piece. But now the whole can be seen and prioritised (e.g. bring `scene-sky` forward to fix the clouds right away).
