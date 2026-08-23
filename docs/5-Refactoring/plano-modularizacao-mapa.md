# Mapa de extração — o que ainda falta tirar do `game.js`

Estudo do `game.js` (v4.164.23, **3555 linhas**) para parar de extrair a conta-gotas e ter o alvo COMPLETO
(pedido do José 2026-07-04). Companheiro do `plano-modularizacao.md` (§3 alvo, §4 ordem, §8 testes). Cada módulo
segue o padrão firmado: **import puro, I/O explícito, com teste do contrato** (ver [[project-inclusionist-testes]]).


> **Correcao de registro (2026-08-06).** O commit `e30e8af` afirma, como "achado que merece acao", que seis
> paineis de acessibilidade estariam inalcancaveis por faltarem os botoes `#opt-sound`, `#opt-animation`,
> `#opt-movement`, `#opt-empathy`, `#opt-controls` e `#opt-visual`. **A afirmacao e falsa.** Os paineis abrem
> pelo **menu de pausa**: os itens `.pm-btn[data-act]` despacham na tabela de acoes do `game.js`
> (`audio`, `motora`, `anim`, `visual`, `empatia`, `tipo`, `ajuda`). Verificado no navegador com o jogo rodando:
> os seis overlays abrem e renderizam (audio 5 linhas, visual 5, empatia 12, animacao 10, tipografia 18,
> motor via `#opt-facil`/`#opt-altmove`), sem erro de console. O menu tem 21 itens.
>
> Os identificadores `#opt-*` sao **ganchos para uma barra de botoes futura**, nao codigo morto: as guardas
> `if(btn)` existem justamente para que a fiacao passe a valer quando os botoes forem criados. Nada a consertar.
>
> A causa do erro fica registrada porque e reutilizavel: eu testei UMA porta (o botao), nao a encontrei, e
> conclui ausencia de porta em vez de erro de teste — mesmo tendo lido a tabela de despacho do menu duas vezes
> durante a religacao.


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


## Plano de conclusao — inventario completo do que resta (2026-08-06)

Medido no `game.js` de **2786 linhas**: 220 funcoes top-level, 64 globais mutaveis, 31 acessos diretos a
`localStorage`, 60 imports.

**O que decide paralelo vs serie.** Nao e o acoplamento entre funcoes — e o acoplamento no *arquivo*. Enquanto
os agentes so escrevem modulos NOVOS e ninguem edita `game.js`, a extracao paraleliza quase sem limite (Onda 1:
10 agentes simultaneos, zero conflito). O que precisa de ordem e (a) contrato entre modulos novos, (b) a
religacao, que e serial por natureza, e (c) o caso especial da fisica, que exige ancora antes de se mover.

### GRUPO A — paralelizavel de imediato (17 modulos, nenhum depende de outro)

| # | Modulo | Funcoes que saem |
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
| A10 | `input/keyboard-runtime` | kbFor · applyControls (virou `computeControlsState`, pura) · assignControls · actionOf · whichPlayer |

> **Sexta duplicação: os papéis semânticos (A1) — RESOLVIDA.** `ui/settings-visual` declara
> `RoleKey`+`ROLE_KEYS` e `render/high-contrast` declara `PaintableRole`+`HcRoleKey` — os mesmos quatro papéis
> (`hazard`/`climb`/`water`/`gate`), em duas listas que nada liga. Os rótulos pt-BR e as cores **não** estão
> duplicados; só o tipo e a lista de chaves. O sintoma é amplificação de mudança e é silencioso: um quinto papel
> adicionado ao render ganharia cor e não ganharia seletor, sem erro de tipo em lugar nenhum.
>
> Adiada até a religação de propósito, e a espera valeu — mas não pelo motivo que eu previ. Eu esperava que a
> injeção de `roleColors` evaporasse; ela **ficou**, e o `game.js` virou passa-fio (importa `HC_ROLE` do
> `high-contrast` e injeta no painel). Isso está certo: é o `game.js` como raiz de composição, que é onde o
> **D2** quer chegar.
>
> Solução: `render/hc-role-data.ts`, módulo **folha de dependência zero** com o tipo, a ordem canônica das
> chaves e as cores padrão. Os dois lados importam de lá; `high-contrast` e `settings-visual` reexportam com
> os nomes que sempre tiveram, então nenhum chamador mudou. Os rótulos pt-BR **não** foram junto: são
> apresentação e ficam no painel — mas agora digitados por `HcRoleKey`, obrigados a cobrir a lista.
>
> O teste que vale é `tests/hc-role-data.node.test.js`, e ele foi verificado ao contrário: com um quinto papel
> de mentira, fica vermelho. Dois casos que eu havia escrito foram **removidos** por não poderem falhar —
> `ROLE_KEYS` agora É `HC_ROLE_KEYS` (mesma referência) e `HC_ROLE` nasce de cópia de `HC_ROLE_DEF`; comparar
> os dois é afirmar que um objeto é igual a si mesmo. Cobertura aparente é pior que nenhuma.

> **`core/world-query` — proposto pelo A5, adiado de propósito (2026-08-23).** Três módulos da onda A recebem
> `solidAt`/`tileAt`/`lifeSurfaceAt` por injeção, e o agente do `scene-city` propôs juntá-los num módulo-folha.
> A proposta está certa e o momento está errado: essas funções leem o array `map` do mundo, que ainda é um
> global do `game.js`. Extrair agora criaria um módulo cuja única razão de existir é receber por parâmetro o
> estado que o **D1** vai mover. Fica para o D1, junto com o `map`; até lá a injeção segue, que é barata e não
> mente sobre onde o estado mora.
>
> **`getRainLevel` não é colisão (A3).** O agente do clima sinalizou choque de nomes com `audio-ambient`. Não há:
> em `audio-ambient` `getRainLevel` é **chave de ctx** (algo que ele recebe), em `render/weather` é **export**
> (algo que ele oferece). A religação encaixa uma na outra — `getRainLevel: weather.getRainLevel` — e é
> exatamente para isso que os dois nomes coincidem.

> **Correção de inventário (A10).** `releaseKey` foi listada aqui por engano: apesar do nome, ela não roteia
> teclado — devolve o powerup **chave-do-portão** quando um jogador desiste. Fica com o dono do gate/powerups,
> não com o input. O agente que extraiu o módulo leu o corpo da função e recusou levá-la; a lista é que estava
> errada, não a extração.
| A11 | `input/gamepad` | stdDirs · padActions · pollPads · padMapFor · bindActive · padWiz* (10 fn) |
| A12 | `input/touch` | renderTouchMap · open/closeTouchCfg · hide/showTouchControls · padPxPerMm · padHandTag · applyDirStyle · applyPadPhysical · setPadMm · applyPadDesign · padLayoutFromId · padKind |
| A13 | `ui/hud` | buildGameHud · updateGameHud · updateHud · screenRect · buildScreenPause · renderPauseLegend |
| A14 | `ui/pause-icons` | PAUSE_ICONS · hasPrivateOutput · applyCalm · iconAct · iconLabel · reflectIconBtn · reflectPauseIcons · reflectTitleIcons (+ calmMode) |
| A15 | `ui/activities-menu` | buildTitleMenus · updateTitleLegend · setActivity · startActivity · reallyStart · actCat · setMode · setQuizLevel · applyLetra · mapSoon · renderMapHub · simNaoGlyphs · attachAbbr |
| A16 | `render/viz-setters` | setOwnerColors · setCbSafe · setRoleColor · resetRoleColors · setOutlineFg · setOutlineBg · reflectVizButtons · renderVizGroup · updateVizIndicator · fillExplain |
| A17 | `platform/storage` (fechar) | os **31** acessos diretos restantes, incluindo `inclusionist.reducedmotion.v1`, de formato diferente das chaves `incl_*` |

### GRUPO B — depois do A (consomem contratos do A), paralelo entre si

| # | Modulo | Depende de | Nota |
|---|---|---|---|
| B0 | **caracterizacao de `physics`** | — | testes de no fixando pulo, gravidade, agua, trampolim, colisao. **Vem antes do B1**, nao junto |
| B1 | `game/physics` | B0, A8, A9, A7, A6 | sampleFeatures · resolveX · resolveY · triggerLava · stepPlayer · update |
| B2 | `render/viewports` | A1, A2, A4 | parallaxTexFor · pixiFilterFor · lvOverlayCanvas · playerVizTex · applySharedTextures · applyVpFilters · applyVizGlobal · setPlayerViz · reapplyVizAll · renderVpOverlay · updateVpDots |
| B3 | `game/quiz` | A15, A9 | 29 funcoes — o maior bloco restante (openQuiz, renderQuiz, quizConfirm, os 5 geradores de atividade, os 6 *Html) |
| B4 | `ui/settings-panel` | os 7 paineis (feitos), A13 | open/close de cada overlay + frontOverlay + _ovZ |

### GRUPO C — serie obrigatoria (mutuamente acoplados, um por vez)

Compartilham `collected`, `ended`, `pauseActor`, `phase` e chamam uns aos outros
(`win` -> `restartGame` -> `setPhase` -> `pauseSelect`). Extrair em paralelo produz tres modulos que se
importam em ciclo.

| # | Modulo | Funcoes |
|---|---|---|
| C1 | `render/draw` | draw · placeCam · ensureSprites · configureRender — consome praticamente todo o render |
| C2 | `game/session` | respawnFigure · respawnPlayer · joinPlayer · setNumPlayers · fitsN · activateScreens · resetPlayerState · win · restartGame · isMobile |
| C3 | `ui/shell` + `ui/menu-nav` | setPhase · togglePause · quitGame · printMode · hideTips · fpsTick + menuItems · menuFocus · dialogBack · navDialog · pauseSetSel · navPause · menuNavKey · pauseSelect · sharedDialogOpen · navTitle · titleButtons |

### GRUPO D — fecho

| # | Trabalho |
|---|---|
| D1 | migrar os **64 globais** restantes para `core/state.ts`, um setter por vez (como as mega-variaveis ja feitas) |
| D2 | `main.js` como composition root; `game.js` **dissolve** |

### Ressalva sobre a medicao de acoplamento

A varredura de "quem escreve qual global" tem ruido conhecido: nomes de variavel local (`s`) e declaracoes de
topo que caem dentro da faixa atribuida a funcao anterior (por isso `showPower` aparece escrevendo flags de
overlay). Os hubs que sobrevivem ao ruido e sustentam o GRUPO C: `_lastSharedViz` (7 escritores), `collected`
(5), `pauseActor` (5), `selVizPlayer` (4), `MODE` (3).


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
