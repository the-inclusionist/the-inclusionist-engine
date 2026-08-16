# Mapa de extração — o que ainda falta tirar do `game.js`

Estudo do `game.js` (v4.164.23, **3555 linhas**) para parar de extrair a conta-gotas e ter o alvo COMPLETO
(pedido do José 2026-07-04). Companheiro do `plano-modularizacao.md` (§3 alvo, §4 ordem, §8 testes). Cada módulo
segue o padrão firmado: **import puro, I/O explícito, com teste do contrato** (ver [[project-inclusionist-testes]]).

## Já extraído (24 módulos)
`core/{constants,tiles,world,state,loop,i18n,collision}` · `platform/{storage,audio,audio-mixer,speech}` ·
`input/{keyboard,devices,state}` · `ui/{fonts,dom}` · `render/{viz-modes,canvas,sprites,props,sprite-fx}` ·
`game/{player}` · `i18n/{pt,en,es}`. Todos `.ts`. `core/collision` e `game/player` (Estágio 4) vêm com testes
node (ZOMBIES + Right-BICEP). `game/player` levou a geometria de colisão; `jumpVel`/`showPower` ficaram no game.js.

## Restante — ~34 módulos, em 3 tiers por acoplamento

Legenda de acoplamento: 🟢 folha (≈zero deps de jogo) · 🟡 subsistema coeso (deps localizadas) · 🔴 núcleo acoplado.

### TIER 1 — Folhas / baixo risco / alto valor de teste (fazer primeiro)
| Módulo | O que vai | game.js (linhas ref.) | Dep |
|---|---|---|---|
| `core/rng.js` 🟢 | `rnd`/`randInt`/`shuffle` + `_seed` (RNG semeado, determinístico) | 246–249 | — |
| ~~`core/a11y-sr.js` 🟢~~ **FEITO** | `srSay`/`srAlert` extraídos (+ testes browser). `vlibrasSay` por injeção (`setVlibrasSay`) até `ui/vlibras` sair. | — | ui/dom |
| ~~`core/collision.js` 🟡~~ **FEITO** | `isSolidType`/`tileAt`/`solidTile`/`solidAt`/`surfTop`/`isWcRampRiser`/`caneBlockPx` + `rampSurfaceY`. Estado `gate`/`gateTiles`/`wcSolid`/`wheelchair`/`modoCego` SEGUE no game.js; a colisão o lê por **closures** no `initCollision(ctx)`. + testes node. | — | WORLD, ctx |
| ~~`render/crt.js` 🟢~~ **FEITO** | `crtScanVars`/`applyCrt` + `CRT` extraídos (+ testes browser). Auto-contido (recomputa escala do clientHeight; NÃO era cluster). | — | ui/dom, state |
| ~~`render/minimap.js` 🟡~~ **FEITO** | `markSeen`/`redrawMinimapIfDirty`/`drawMinimapPlayer`/`resetMinimap`/`setMinimapCorner` + `setMinimapVisible`/`getMinimap`/`minimapSeenCount` extraídos (+ testes browser; `initMinimap` cria os objetos PIXI no boot). 11 sites no game.js atualizados. | — | PIXI, constants, collision |
| `game/attract.js` 🟡 | modo atração/demo: `startAttract`/`stepAttract`/`stopAttract`/`attractRecFor` + `_idleT`/`attract` | 752–806 | input, loop |
| ~~`ui/vlibras.js` 🟡~~ **FEITO** | `vlibrasSay`/`vlibrasOpen`/`toggleLibras`/`vlTick` + `librasOpen`/`LIBRAS_RESERVE` extraídos (+ testes browser). Cluster com `layout` quebrado por callback (`setOnLibrasChange`); importa `srAlert` (a11y-sr NÃO importa de volta → sem ciclo). | — | a11y-sr, DOM |
| ~~`ui/webcam.js` 🟢~~ **FEITO** | `eyeSet`/`onGaze`/`startEyeControl`/`stopEyeControl`/`loadWebGazer` + `eyeMode`/`setEyeMode` extraídos (+ testes browser, incl. mapeamento olhar→tecla). O handler do #opt-eyes fica no game.js (usa toggleBtn). | — | dom, a11y-sr, WebGazer |
| `ui/debug-panel.js` 🟡 | `buildDebugPanel` (painel `?debug` de afinação: TUNE/ANIM/JUICE/CRT) | 3499+ | TUNE, JUICE |
| ~~`ui/layout.js` 🟡~~ **FEITO (layout)** | `layout` (escala inteira 320×180 + reserva VLibras) extraído (+ testes browser). Fecha o cluster vlibras↔layout (importa librasOpen/LIBRAS_RESERVE; sem ciclo). **Faltam:** `fpsTick` (usa app.ticker/fps-state) e `configureRender` (multi-tela → render/viewports). | — | dom, state, crt, vlibras |

> **Recalibração (durante a execução, 2026-07-04):** ao abrir o código, o Tier 1 tem mais acoplamento que os
> rótulos sugeriam. Correções:
> - **FEITO:** `core/rng.js` (2.26) e **`ui/dom.js`** (`$`/`$$`, 2.27) — util-base novo, não estava na lista; `$`
>   é usado 219× e destrava os outros. Ordem: **utilitários primeiro**.
> - **`vlibras` + `layout` + `crt` são um CLUSTER interdependente** (não leaves): `vlTick`→`layout`, `layout`→
>   `crtScanVars` + lê `librasOpen`/`numPlayers`, `crt` lê `$`/`numPlayers` + localStorage no import. Extrair
>   juntos ou com injeção de dependência clara — provavelmente Tier 2, não Tier 1.
> - **`a11y-sr`** (`srSay`/`srAlert`, 111/37×) depende de `$` (✅) + `vlibrasSay` → sai DEPOIS do `vlibras`.
> - **`webcam`** depende de `$` + `srSay` + `eyeMode` + `keys` (input) → médio, não leaf puro.
> - Próxima ordem realista: `vlibras` (fala+estado) → `a11y-sr` → `minimap` → `attract` → `webcam` →
>   `debug-panel` → (cluster `crt`+`layout` movido p/ Tier 2).

### TIER 2 — Subsistemas coesos / médio acoplamento
| Módulo | O que vai | game.js (linhas ref.) | Dep |
|---|---|---|---|
| ~~`platform/audio-cues.js`~~ | **NÃO é um módulo só** — a superfície de cues é heterogênea; decomposta em 4 rodadas por acoplamento crescente (abaixo). `platform/audio.js` já tem a base (audioCtx/mixer/tone/noiseHit). | — | — |
| `platform/audio-jingles.ts` ✅ | **[áudio r1 — FEITO]** jingles SEM estado de jogo: `playVictory`/`playPuzzleSolved`/`firework` | 625–633 | audio.js (tone/ensureAC/catNode) |
| `platform/audio-earcons.ts` ✅ | **[áudio r2 — FEITO]** earcons + ponte c/ legendas: `sfx`/`doorSound` (`showCaption`/`captionsOn` ficam no game.js — UI alterna, `win()` reusa — e entram por injeção) | 461–474, 527–530 | audio.js, showCaption (inj.) |
| `platform/audio-nav.ts` ✅ | **[áudio r3 — FEITO]** pistas espaciais a11y (cego/baixa-visão): `playerCtx`/`caneProbe`/`caneTap`/`waterNav`/`sonar`/`panFor`/`needsAudioCues`/`updateGuide` + contadores (`SURF_MAT`, `_guideCount` migraram). `playerCtx`/`panFor`/`needsAudioCues` expostos na API (guarda de beirada + gate de movimento). `surfaceUnder`/`caneOn`/`caneColor` FICARAM no game.js (passo/movimento/render) | 489–540, 561–564 | audio.js, tiles, players, coins |
| `platform/audio-ambient.ts` ✅ | **[áudio r4 — FEITO]** trilha de ambiente + trovão: `buildAmbient`/`updateAmbient`/`thunder` (`_ambient` migrou). Ponte `_rainLevel` (updateWeather escreve, módulo lê por getter). O clima VISUAL `updateWeather`/`drawWeather` FICOU no game.js → migra p/ render (Tier 2). **Áudio 100% modularizado.** | 542–560 | audio.js, players, tiles |
| `platform/tts.ts` ✅ | **[GH#38 — FEITO]** TTS neural (F5): `loadTTS`/`ttsSpeak`/`narrate`/`speakWebSpeech` + estado dos motores. Criado ANTES do `audio-nav` (que injeta `narrate`). `populateTTSEngines`/`populateTTSVoices`/`reflectTTS` FICARAM no game.js (painel → #54) e usam `tts.get/setEngineSel` + `tts.get/setVoiceObj` + `tts.getEngine`. | 515–558, 2605–2634 | audio.js, audioCat |
| `render/world-tex.js` 🟡 | `worldCanvas`/`worldToTexture`/`worldTexFor` + tiles vivos `stepTileFx` (água/lava animadas) | 142–169, 909, 1457–1487 | WORLD, TILE_COLOR |
| `render/high-contrast.js` 🟡 | Renderização Direta (a11y): `_dimDesat`/`worldToTextureDirect`/`directBgTexture`/`directSpriteCanvas`/`_roleOf`/`HC_ROLE`/`setRoleColor`/`resetRoleColors`/`DIRECT_CFG`/`hcOutline*` + persistência | 173–232, 2734–2768 | WORLD, canvas.js |
| `render/scene-parallax.js` 🟡 | `parallaxPlaceholder`/`themeSkyTexture`/`themeHillsTexture`/`updateParallax` + camadas | 806–842 | PIXI, tema |
| `render/scene-city.js` 🟡 | Cidade viva (L5): `creatures`/`stepLife`/`spawnCreature`/`streetCols`/tráfego (`spawnCar`/`stepTraffic`/`drawSemaforo`)/`buildCityDeco` + `LIFE_TEX`/`ADULT_TEX`/`CAR_TEX` | 1175–1346 | WORLD, PIXI |
| `render/scene-sky.ts` ✅ | **[GH#43 — FEITO]** `cloudWrapX` (+ **fix GH#21**) + `stepSky`/`stepV3Decor`/`drawV3Cloud`/`drawV3Grass` + estado `clouds`/`birds`. As **6 camadas** (`skyLayer`/`starsG`/`skyDecoG`/`fogG`/`grassG`/`themeFxG`) continuam **criadas no game.js** (z-order do render-graph soldado em parallax/worldSprite/lifeLayer/carLayer) e são **injetadas** — movemos só a lógica, z-order intocado. Fórmulas v3 verbatim; teste com camadas falsas. | 1347–1454 | PIXI, tema |
| `render/fx.js` 🟡 | Juice: `spawnParticle`/`puffDust`/`burstSparkle`/`addShake`/`addHitstop`/`setSquash`/`stepFx`/`drawFx` + `JUICE`/`particles` | 1490–1522 | PIXI |
| ~~`game/player.js` 🟡~~ **FEITO** | `makePlayer`/`BOX`/`SPAWN`/`jumpVel`/`isBouncyGroundBelow`/`touchingWall`/`clingSides`/`firstClingSide`/`spiderReattach`/`wrapConvex` extraídos (+ testes). `EASY` foi p/ `constants`. Só `showPower` ficou (DOM/HUD → futura `ui/hud`). | — | collision, constants |
| ~~`game/coins.js` 🟡~~ **FEITO (posicionamento completo)** | `findCoinCandidates`/`pickCoins`/`positionEasyCoins`/`takeCoin` extraídos (+ testes; mundo+anyEasy/wheelchair por `initCoins`, pools passados pelo game.js). O que resta rotulado "coins" NÃO é posicionamento: `rebuildCoins`/`coinTexFor`/`shapeTexture`/`letterTexture`/`coinSprites` (render → rodada de render) e `malform`/`ferreiroDistractors` (distratores → `game/quiz`); `addCoinsForOwner` (push+render). | — | collision, rng, state |
| `game/powerups.js` 🟡 | `powerups`/`pupTexFor`/`rebuildExtras`/`setupExtras`/`takePu`/`puTaken` | 1020–1054 | WORLD, props.js |
| `game/level-geometry.js` 🟡 | geometria de acessibilidade (cadeirante): `buildRamps`/`buildWcGeom`/`buildRopes`/`buildElevators`/`elevAt`/`drawElevators`/`drawCane`/`drawRunCane`/`drawChair` | 1056–1173 | WORLD, wcSolid |
| `input/keyboard-runtime.js` 🟡 | handler `keydown`/`keyup` + `applyControls`/`assignControls`/`kbFor`/`keyUsedByOther` + `controls`/`GAME_KEYS` | 413–507 | keyboard.js, state, menus |
| `input/gamepad.js` 🟡 | `pollPads`/`padActions`/`stdDirs`/`padMapFor`/`bindActive` + wizard DirectInput (`padWiz*`/`openPadWiz`/`padWizTick`/`padWizBind`…) + `gamepaddisconnected` | 2440–2600 | state, players, devices.js |
| `input/touch.js` 🟡 | controles de toque: `renderTouchMap`/`showTouchControls`/`hideTouchControls`/`applyPadDesign`/`applyPadPhysical`/`setPadMm`/`padLayoutFromId` | 2927–2996, 3426–3497 | DOM, devices.js |
| `ui/title.js` 🟡 | `drawTitleScene`/`titleButtons`/`buildTitleMenus`/`updateTitleLegend`/`navTitle` | 738, 3308–3424 | DOM, i18n |
| `ui/hud.js` 🟡 | `buildGameHud`/`updateGameHud`/`buildScreenPause`/`updateHud` | 1609–1625, 2254 | DOM, players |
| `ui/activities-menu.js` 🟡 | `setActivity`/`startActivity`/`reallyStart`/`setMode`/`actCat` + estado `_pendingAct`/`MODE` | 2305–2412 | state, quiz |
| `ui/settings-*` 🟡 | família de painéis de a11y (grandes): `-visual` (`renderVisual`/viz/cores) · `-audio` (`renderAudio`/`catRowHTML`/`wireCatControls`/`renderNavSound`/sinks) · `-typo` (`renderTypo`/`setGameFont`) · `-motion` (`renderMotion`/juice) · `-empathy` (`renderEmpathy`/`setWheelchair`/`setOneButton`/hearing) · `-controls` (`renderControls`/`keyName`/remap) · `-motor` (`renderMovPlayers`/`setEasy`) | 2685–3110 | DOM, muitos setters |

### TIER 3 — Núcleo acoplado / alto risco (por último, com testes fortes antes)
| Módulo | O que vai | game.js (linhas ref.) | Nota |
|---|---|---|---|
| `game/physics.js` 🔴 | **coração:** `sampleFeatures`/`resolveX`/`resolveY`/`triggerLava`/`stepPlayer`/`update` | 1681–1946 | determinístico → **alvo nº1 de testes node** (pulo/gravidade/água/trampolim/colisão) |
| `render/viewports.js` 🔴 | textura por jogador: `parallaxTexFor`/`pixiFilterFor`/`playerVizTex`/`applySharedTextures`/`applyVpFilters`/`applyVizGlobal`/`setPlayerViz`/`reapplyVizAll`/`renderVpOverlay`/`updateVpDots` | 2628–2728 | multiplayer em telas separadas |
| `render/draw.js` 🔴 | orquestração de render: `draw`/`placeCam`/`ensureSprites` (ordem de camadas) | 1537, 1947, 1954–1995 | consome quase todo o render |
| `game/quiz.js` 🔴 | atividades (letramento/matemática): `openQuiz`/`pickWord`/`openSilabas`/`openAlf`/`openBraille`/`openPre`/`renderQuiz`/`quizConfirm`/`quizWin`/… + pools (`SILABA_POOL`/`_recentWords`) + frações (`fracStr`/`fracGraphic`/`fracSpeak`) | 1996–2252, 2322–2372 | grande, DOM + gameSay + state |
| `ui/settings-panel.js` 🔴 | `openOptions`/`closeOptions`/`openHelp`/`renderMapHub` (orquestrador dos painéis Tier 2) | 3023–3110 | abre os `settings-*` |
| `ui/shell.js` + `ui/menu-nav.js` 🔴 | máquina de fases: `setPhase`/`togglePause`/`showTitleMenu`/`quitGame`/`printMode`/`restartGame`/`win` + navegação universal `menuNavKey`/`navDialog`/`navPause`/`pauseSelect`/`menuItems`/`dialogBack` | 2258–2304, 3199–3301 | amarra tudo |
| `game/session.js` 🔴 | ciclo/multiplayer: `respawnFigure`/`respawnPlayer`/`joinPlayer`/`setNumPlayers`/`fitsN`/`activateScreens`/`resetPlayerState`/`win` | 2246, 2383–2438 | telas dinâmicas |

## Fecho
- **`main.js` (composition root):** importa todos, faz o wiring do boot (os vários `initX()` na ordem certa),
  registra listeners. O `game.js` **dissolve** (vira só o `main.js` ou some).
- **Estado restante → `core/state.js`:** migrar aos poucos os `let` de topo que ainda são estado global
  (`collected`/`ended`/`MODE`/`letterCase`/`calmMode`/`blindMode`/`hcMode`/`oneButton`/`wheelchair`/`modoCego`…)
  conforme cada consumidor sai — cada um com seu setter, como as 8 mega-variáveis já feitas.

## Ordem sugerida
1. **Tier 1 inteiro** (folhas) — blinda peças estáveis e sobe a cobertura de teste rápido.
2. **Tier 2** por subsistema, na ordem: **áudio em 4 rodadas ✅** (`audio-jingles` → `audio-earcons` → `audio-nav`
   → `audio-ambient`, todas FEITAS) + `tts` ✅ → `player`/`coins`/`powerups`/`level-geometry` →
   `render/*` (world-tex, high-contrast, scene-*, fx) → `input/*` → `ui/*` (title, hud, activities, settings-*).
3. **Tier 3** por último, cada um com **testes fortes ANTES** (especialmente `physics`): physics → draw/viewports
   → quiz → shell/menu-nav/session.
4. **`main.js`** e dissolução do `game.js`.

> Estimativa: ~34 módulos + `main.js`. Não é preciso segui-la ao pé da letra — é o mapa; ajusto fronteiras ao
> abrir cada peça. Mas agora dá pra ver o todo e priorizar (ex.: adiantar `scene-sky` p/ já corrigir as nuvens).
