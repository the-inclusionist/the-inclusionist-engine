# Changelog

## [10.0.0](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v9.0.0...v10.0.0) (2026-09-25)

### ⚠ BREAKING CHANGES

* **core,ui:** `$` and `$$` leave `core/dom-query` and `ui/dom`; query the document you hold. Note DE in
docs/6-DevOps-SRE/Breaking-Changes.md. game-platformer imports both from `ui/dom`.
* **platform:** `TtsCtx` requires `speech` ({ synth(), utterance(text) }), `now`, `createAudio` and
`loadKokoro`; `KokoroRuntimeDeps` requires `fetch`, `compileWasm` and `instantiateWasm`. A game under
`createGame` changes nothing; a game that builds its own voice (platformer) passes them - see
Breaking-Changes.md, note DB, for the loader to write, kept as an `import()`.
* **platform,ui:** `platform/audio.js` no longer exports `soundOn`, `volume`, `audioCtx`,
`hearingLoss`, `audioCat`, `_footCount`, `initAudioMixer`, `setSoundOn`, `setVolume`, `ensureAC`,
`audioOut`, `setHearingLossGraph`, `setMasterMuted`, `catNode`, `setCatGain`, `tone`, `tonePan` or
`noiseHit`: `createAudio({ newContext, store })` returns them as members (`_footCount` ->
`footCount`); under `createGame` use `engine.audio`. `gameSay(text)` is `gameSay(voice, text)`.
`SonarCtx.newContext` and `EmpathySettingsCtx.hearing` are required. Games affected: pinball,
platformer, soccer - see Breaking-Changes.md, note DB.
* **input:** `input/state.js` exports no state: build one with `createInputState()`,
or under `createGame` read `engine.input` (same member names). `input/keyboard.js` loses
`kb`, `initKB`, `setKB`, `resetKB` and `registerKeyboardMapping` for
`createKeyboardConfig({ store, mapping })` (under `createGame`: `engine.keyboardConfig`),
and `factoryWithGame`/`loadKB` take the mapping. `input/pad-defaults.js` loses
`padTable`/`registerPadMapping` for `createPadTable(mapping)`; `input/pad-wizard.js`
loses `padMap(store, id)` for `createPadMaps(store)` and `PadWizardCtx.store` becomes
`maps`. `GamepadCtx.store` becomes the required `padMaps`, `padTable` and `input`;
`LatchedEdgeOptions` requires `input`; `TouchCtx.win` is required. `PAD_DEAD` is no longer
exported. Migration per game in docs/6-DevOps-SRE/Breaking-Changes.md, note DA.
* **core:** `core/a11y-sr` no longer exports `srSay`, `srAlert` or `setVlibrasSay`; it exports `createAnnouncer`.
`ui/vlibras` no longer exports `librasOpen`, `initLibras`, `setOnLibrasChange`, `vlibrasSay`, `vlibrasOpen`,
`toggleLibras` or `vlTick`; it exports `createLibras`. A game beside `createGame` announces with `engine.say` /
`engine.alert` and reaches deaf mode through `engine.libras`; one that signed its announcements connects
`engine.mirrorAnnouncements(engine.libras.say)`. A game that is its own root builds both factories. All seven games
call `srSay`/`srAlert`; game-platformer, game-soccer and pixi-15-puzzle use `ui/vlibras`.
* **ui:** `MountPanelCtx.localeOn` is required: a function that subscribes to a language change and returns
its release. No game calls `mountPanel` (measured in the seven), so none is affected.
* **ui:** `DebugPanelCtx.search`, `doc` and `expose` are required. game-platformer, the only caller, passes
`search: location.search`, `doc: document` and `expose: (s) => { window.__sonda = s; }` to keep what it had.
* **ui:** `PauseIconsCtx.doc` is required. A game that calls `initPauseIcons` itself passes its document
(`doc: document`); game-platformer is the one that does, and passes none today.
* **core:** `core/loop.registerCrashNotice` is removed and `LoopOptions.onFailure` is required. Pass
`onFailure: engine.onFailure` to `startLoop` (game-chess, game-platformer, game-soccer, game-whackwhack,
pixi-15-puzzle call it; game-soccer passed no notice and relied on the registration).
* **core:** `core/rng` no longer exports `rnd`, `randInt`, `shuffle`, `reseed` or `decorationRng`. Build a
stream with `createRng(seed)`; for ornament, `createRng(DEFAULT_SEED ^ 0x5eed)` gives the old decoration sequence.
* **platform:** `ReadingInWorkerDeps.spawn`, `ReadingRuntimeDeps.fetch`, `WorkerScope.fetch`
and `MicrophoneDeps.getUserMedia`, `createContext` and `now` are required. Migration in
Breaking-Changes.md, note DC.
* **platform:** `VoskDeps.hasFile` and `loadBundle`, `VoiceListenerDeps.getUserMedia` and
`createContext`, and the same four on `VoiceControlDeps` are required; `createBundleLoader` is new.
Migration in Breaking-Changes.md, note DC.
* **platform:** `downloadHeavy` requires `cacheStorage`, `fetch`, `digest` and `base`;
`sha256Hex` is replaced by `sha256With(subtle)`; `VisionDeps.hasFile` and the eye, face and
hand controls' `hasFile` are required. Migration in Breaking-Changes.md, note DC.
* **render,ui:** `render/crt`'s `CRT`/`initCrt`/`applyCrt`/`crtScanVars`, `render/lq-filter`'s
`initLqFilter`/`setLq`/`getLqT`/`lqFilter`/`ensureLqFilter`, `ui/layout`'s `initLayout`/`layout` and
`ui/settings-motion`'s `getSelectedPlayer`/`setSelectedPlayer` are removed in favour of `createCrt`,
`createLqFilter`, `createLayout` (with a required `afterScale`) and the motion panel's own api;
`SettingsMotionCtx` requires `crt`. Under `createGame`, use `engine.crt` and `engine.lq`; a game that scales
its own stage passes `engine.crt.scanVars` as `afterScale`. Note DD in docs/6-DevOps-SRE/Breaking-Changes.md.
* **render:** `makeCanvas`, `pixelCanvas`, `pixelTexture` and `spriteToCanvas` take the document first;
`render/high-contrast`'s module functions and `HC_ROLE`/`saveHcRole`/`initHighContrast` are replaced by
`createHighContrast(ctx)` members (`role`, `saveRole`, ...), and `HighContrastCtx` requires `doc`;
`ViewportsCtx` requires `doc` and `hc`; `VizSettersCtx` requires `hc` and `lqFilter`. Migration in
docs/6-DevOps-SRE/Breaking-Changes.md, note DD.
* **core:** `core/state` exports no bindings or functions any more, only
`createSettingsStore` and the types. A game reads the root's store: `engine.settings.blindMode`
for `blindMode`, `engine.settings.setBlindModeValue(…)` for `setBlindModeValue(…)`, and
`engine.settings.on/off/emit` for the bus (a `GameEvent` augmentation keeps working). Do not
build a second store: it would read the stored settings but hear none of the root's changes.
Affects game-platformer, game-pinball and game-soccer; see note CZ in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `@the-inclusionist/engine/ui/caa-sets.js` is now `ui/aac-sets.js` and
`ui/settings-caa.js` is now `ui/settings-aac.js`. Their names change: `CaaTier`,
`CaaSet`, `CAA_SETS`, `CAA_BY_KEY`, `caaAvailable`, `caaReason`, `caaLabel` become
`AacTier`, `AacSet`, `AAC_SETS`, `AAC_BY_KEY`, `aacAvailable`, `aacReason`,
`aacLabel`; `caaControlId`, `caaRowSpec`, `CAA_SECTIONS`, `mountCaaInside`,
`SettingsCaaCtx`, `SettingsCaaApi`, `initSettingsCaa` become `aacControlId`,
`aacRowSpec`, `AAC_SECTIONS`, `mountAacInside`, `SettingsAacCtx`, `SettingsAacApi`,
`initSettingsAac`. `ui/shell`'s `ShellCtx.openCaa` is now `openAac`. The i18n keys
`caa.*` and `sr.caa.*` are now `aac.*` and `sr.aac.*` — a game that overrides one
in its own dictionary renames it. The pause action id `caa` and the panel's DOM ids
do not change. In the catalogue only game-platformer uses any of this.
* **ui:** `ui/panel-widgets`'s `ControlRow.controle` is now `ControlRow.control`.
Write `const { row, control } = controlRow(ctx, spec)`. No game in the catalogue
calls `controlRow`.
* **i18n:** `core/i18n.dictionaryGaps()` is removed (read `problems`, or
`Translator.dictionaryGaps()`); `Translator.registerDict` and `Translator.dictionaryGaps` now act on
the translator's own dictionary, which no other translator on the page reads. See note CV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `PauseIconsCtx` gains a required `translator: Pick<Translator, 't' | 'locale' |
'setLocale'>`; `computeIconLabel` takes `t` as its first parameter; `iconBtnMarkup`, `iconsMarkup` and
`quickBarMarkup` take a `BarTranslator` as their first parameter; `ScreenPauseMarkupOpts.t` is a
`Translate`. See note CV in docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** the settings panels' ctx gain a required `t: Translate` (`SettingsPanelCtx`,
`EmpathySettingsCtx`, `SettingsTypoCtx`, `SettingsCaaCtx`, `SettingsControlsCtx`,
`SettingsMobilityCtx`, `LatchWriteCtx`, `SettingsMotionCtx`, `SettingsVisualCtx`), and
`SettingsAudioCtx` and `VoiceSettingsCtx` a required `translator: Pick<Translator, 't' | 'bcp47'>`;
`mountAudioInside`, `mountSoundInside`, `lettersRowSpec`, `caaRowSpec`, `mountCaaInside`, `drawKeys`,
`mountMobilityInside` and `mountTypoInside` take `t` as their first parameter, and
`CAA_SECTIONS[].rows` takes `t`. See note CV in docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `counterLabel`, `applyCounterLabel`, `waitBadgeHtml`, `hudRowView`, `mountHudBands`,
`spokenGlyph`, `pauseLegendHtml`, `legendRow1`, `toggleLibras` and `drawGazeOverlay` take
`t: Translate` as their first parameter (`drawGazeOverlay` drops its `say` option); `HudCtx` and
`ShellCtx` gain a required `t`. See note CV in docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `EyeControlDeps`, `FaceControlDeps`, `HandControlDeps`, `VoiceControlDeps`,
`CrashNoticeCtx` and `SimulationListCtx` gain a required `t: Translate`. See note CV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** twenty ui helpers take `t: Translate` as their first parameter (`toggleLabel(t, on)`,
`announceItem(t, item, withIndex)`, `keyName(t, code)`, …), and `MenuNavCtx`, `WhereTheChildIsCtx` and
`GameOptionsDrawCtx` gain a required `t`. See note CV in docs/6-DevOps-SRE/Breaking-Changes.md.
* **render:** `VizSettersCtx` gains a required `t: Translate`, and `vizGroupHtml(modes, cur)`
becomes `vizGroupHtml(t, modes, cur)`. See note CV in docs/6-DevOps-SRE/Breaking-Changes.md.
* **platform:** `AudioEarconsCtx` and `SonarCtx` gain a required `t: Translate`; `TtsCtx` gains a
required `translator: Pick<Translator, 't' | 'bcp47'>`. Pass your root's translator. See note CV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** `GamepadCtx`, `KeydownCtx`, `PadWizardCtx`, `TouchCtx` and `TouchMarkupCtx` gain a
required `t: Translate`; pass your root's translator's `t`. See note CV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **core:** `core/i18n` no longer exports `applyDom`; a root translates its markup through the
translator it builds (`createTranslator().applyDom`). See note CV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `PauseIconsCtx`, `SettingsAudioCtx` and `VoiceSettingsCtx` gain a required
`settings` port — pass `core/state` itself — and `SettingsAudioCtx` a required `on(setting, react)`
that returns the release (pass the root's disposable door, or `state.on`). See note CU in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **render:** `VizSettersCtx.setBlindMode` is required, and `VizSettersCtx` gains a required
`setVizMode: (mode: string) => void`; pass `setBlindModeValue` and `setVizModeValue` from
`core/state`. See note CU in docs/6-DevOps-SRE/Breaking-Changes.md.
* **core:** `startLoop` requires its options with a `speed: () => number` port; pass
`{ speed: engine.gameSpeed }` (or `() => state.gameSpeed`). See note CU in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** `GamepadCtx` gains a required `oneButton: () => boolean`; pass
`() => state.oneButton` from `core/state`. See note CU in docs/6-DevOps-SRE/Breaking-Changes.md.
* **platform:** `platform/storage` no longer exports `get`, `set`, `remove`, `getBool`, `setBool`,
`getNum`, `getJSON`, `setJSON`, `getWithLegacy`, `getJsonWithLegacy` nor `KEYS`. Build a store once
with `createStorage(window.localStorage)` and call the same members on it; import `KEYS` from
`platform/storage-keys`. See note CT in docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `readStoredScene` and `storeScene` take the store first; `PauseIconsCtx.store` is
required; `SettingsMotionCtx.store` needs `getJSON` and `setJSON` besides `setBool`; `librasOpen` is
no longer read at import — call `initLibras(store)` at boot (`createGame` does). Build the store
with `createStorage(window.localStorage)` from `platform/storage`. See note CT in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **render:** `initCrt`, `initLqFilter` (`LqFilterCtx`), `initHighContrast` (`HighContrastCtx`)
and `initVizSetters` (`VizSettersCtx`) require a `store`; `readStoredVisual(i)` becomes
`readStoredVisual(store, i)`. `CRT`, the L->Q amount and `HC_ROLE` are no longer read at import:
they hold the factory values until their init reads the store. Build the store with
`createStorage(window.localStorage)` from `platform/storage`. See note CT in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **platform:** `initAudioMixer()` becomes `initAudioMixer(store)`; `loadAudioCat()` and
`saveAudioCat(k, obj)` take the store first; `TtsCtx.store` is required. Build the store with
`createStorage(window.localStorage)` from `platform/storage`. See note CT in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** `loadKB`, `initKB`, `resetKB` take the store as their first parameter and
`saveKB(kb)` becomes `saveKB(store, kb)`; `padMap(id)` becomes `padMap(store, id)`;
`LatchedEdgeOptions.store`, `PadWizardCtx.store` and `GamepadCtx.store` are required. Build the store
with `createStorage(window.localStorage)` from `platform/storage`. See note CT in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **core:** DEFAULTS and defaultReducedMotion move from core/state to core/setting-defaults, and
defaultReducedMotion takes the media query (pass (q) => window.matchMedia(q)); nextCameraControl and the
CameraControl type move to core/camera-cycle; gameKey moves from platform/storage to platform/storage-keys;
ui/motion-scene's sceneDefault and readStoredScene take the system default as a boolean; PauseIconsCtx and
SettingsMotionCtx require matchMedia. Migration note CS in docs/6-DevOps-SRE/Breaking-Changes.md.
* **platform:** AudioAmbientCtx loses `tileAt` and gains a required `roleAt(at: Spot): Role`. Migrate with `roleAt: (at) => declaration.roleAt(at)` in place of `tileAt`; `TILE` stays.
* **boot:** `Declinios.noPadAssistant` is removed. A host that
declares it gets an excess-property error on that line; delete it.
Nothing else changes - the field was already ignored (note CQ).
* **surface:** render/viz-axes PADRAO -> DEFAULT_VISUAL and
nosPadroes -> bothAxesAtDefault; input/pointer PADRAO ->
DEFAULT_POINTER; input/transport-in-use PADRAO -> DEFAULT_INPUT_STATE;
platform/kokoro tokenizar -> tokenize (note CP).
* **language-gate:** LatchedEdgeOptions.padrao and LatchReading.padrao are
now byDefault; SettingsControlsCtx.kbPadraoFor is defaultSchemeFor
(note CO).
* **boot:** the contract's members are renamed (note CN).
CreateGameOptions: acomodacoes -> accommodations (REQUIRED: the old key
is refused at boot), genero -> genre, controleNaTela -> onScreenPad,
comIndice -> withIndex, naBarraDe -> onBar, disponibilidade ->
availability, aoProgredirPesados -> onHeavyProgress, setTemaDoJogador/
setCorrecaoDoJogador -> setPlayerTheme/setPlayerCorrection. Declinios:
semVozNeural/semAtorDePausa/semAssistenteDePad -> noNeuralVoice/
noPauseActor/noPadAssistant. Engine: pausa.mostrar/esconder ->
pause.show/hide, legendarSom -> captionSound, velocidadeDoJogo ->
gameSpeed, medirFlashes -> measureFlashes, aplicarFiltroDeVisao ->
applyVisionFilter, cenas -> scenes, aoFalhar -> onFailure. An optional
option under its old name compiles in JavaScript and is not read.
* **ui:** 153 ui members (map entries) are renamed (note CM),
among them the panel kit's specs (ControlRowSpec, StepsSpec,
PanelShellSpec, MountPanelSpec and their ctx find/create), the
PauseIconsCtx and PauseIconsApi members (getModoCego/setModoCego ->
getBlindMode/setBlindMode, setTemaDoJogador -> setPlayerTheme,
naBarraDe -> onBar, ...), the settings panels' ctx, Scale.largura/altura
-> width/height and NamedBox { name, box, isBar }. A ctx built without
types must be searched for the old keys.
* **render:** 19 render members (map entries) are renamed (note CL):
ScreenPipelineCtx.criarDesenho/criarSprite -> createDrawing/
createSprite, ViewportsCtx.renderizarEm -> renderInto, the VizSettersApi
writers (setTemaDoJogador, setCorrecaoDoJogador, setVisualDoJogador,
renderEixosVisuais -> setPlayerTheme, setPlayerCorrection,
setPlayerVisual, renderVisualAxes), the VizSettersCtx members
(aplicarFiltroCss, aplicarAltoContrasteNoDom, setModoCego ->
applyCssFilter, applyHighContrastToDom, setBlindMode), HowItApplies
{ direct, filter }, AxisChoice { axis, value }, VizMode.name and
Refusal { key, axis }.
* **input:** 52 input members (map entries) are renamed (note CK),
among them GamepadCtx.mundoRodando/menuDePausa/pausar/retomar/naBarraDe/
rotuloDaAcao -> worldRunning/pauseMenu/pause/resume/onBar/actionLabel,
the PadWizard and PadWizardCtx members, TouchCtx.acoesDoJogo ->
gameActions with { action, label } items, TouchMarkupSpec.mapa/
direcional/rotuloDoSlot -> map/dpad/slotLabel, PointerSample.origem/
apertado -> source/pressed, Availability.toque/teclado/rato -> touch/
keyboard/mouse, and the Reach fields. A ctx built without types must be
searched for the old keys.
* **platform:** 59 platform members (map entries) are renamed (note CJ),
among them Tts.vozes/vozAtual/setVoz/neuralDisponivel/kokoroDispositivo
-> voices/currentVoice/setVoice/neuralAvailable/kokoroDevice, the
KokoroModule and SpeechEngine methods, HeavyOptions.buscar/apenas/
aoProgredir -> fetch/only/onProgress, HeavyReport.estado/erro ->
outcome/error, FlashMeasurement.lido/motivo/passa/piorSegundo ->
measured/reason/passes/worstSecond, SonarCtx.getModoCego/
visaoComprometida -> getBlindMode/visionImpaired. A consumer's own
OPTIONAL mirror of these types compiles and silently reads nothing.
* **core:** 23 members of core types are renamed (note CI):
GameDeclaration.seguraTeclas/mapeamentoDoTeclado/mapeamentoDoPad ->
holdsKeys/keyboardMapping/padMapping, LoopOptions.aoFalhar -> onFailure,
the Genre, Route, RouteCtx, Scene, SceneFacts, SceneStack, FlashVerdict,
LuminanceFrame and speechPlaybackRate fields, and Player.alfWins. A
consumer building these objects without types must search for the old
keys: the engine reads the new ones and finds nothing.
* **surface:** bootQuiz, declareQuiz and spokenOption
(consumer-quiz/main-quiz), HOLDS_TOUCH (input/transports), directTheme
(render/viz-axes) and ENGINE_ITEMS, iconCaption and itemsThatAct
(ui/pause-icons) are no longer exported. None had a reader outside its
module; see note CH.
* **ui:** `KEY_YES`, `KEY_NO`, `KEY_UP`, `KEY_DOWN`, `KEY_LEFT`,
`KEY_RIGHT`, `menuKeyIntent`, `selectStep`, `selectWrap`, `rangeStep` and
`stepInPause` move from `ui/menu-nav.js` to `ui/menu-intent.js`. See
note CG.
* **ui:** `clampSelPlayer`, `anyMobilityActive`, `onOffLabel`,
`playerTabsHTML` and `easyAnnouncement` move from `ui/settings-mobility.js`
to `ui/mobility-choices.js`, which also publishes `playerPrefix`. See
note CF.
* **touch:** `padKind` and `PadKind` are no longer exported by
`input/touch.js`. Nothing read them; see note CE.
* **input:** `GamepadCtx.spriteBase` and
`CreateGameOptions.gamepad.spriteBase` are replaced by
`wizardStep(position | null)` and `wizardTick()`, which the game uses to
draw its own demonstration; `WizAnimDef` is no longer published, and the
`#padwiz-demo` rules and `pw*` keyframes leave `style.css`. See note CD.
* **platform:** `platform/audio-nav.js` is no longer published
(`createAudioNav`, `AudioNavCtx`, `AudioNav`, and its re-export of
`PlayerCtxOut`). The game-platformer carries its own copy; import
`PlayerCtxOut` from `platform/audio-sonar.js`. See note CC.
* **core:** `core/collision.js` stops being published — `initCollision`, `caneBlockPx`, `isSolidType`,
`tileAt`, `solidTile`, `solidAt`, `surfTop`, `isWcRampRiser`, `rampSurfaceY` and `CollisionCtx` go with it. From
`core/constants.js`, `TILE_TYPES`, `TileType`, `isHazard` and `isTrampoline` leave too. All of them are in the
`game-platformer`, which already runs on its own copies. Note CB in `docs/6-DevOps-SRE/Breaking-Changes.md` has the
table of where each one went.
* **render:** `HighContrastCtx` gains an obligatory `tileAt: (tx: number, ty: number) => number`. Whoever calls
`initHighContrast` passes the lookup of their own grid — the platformer passes its `core/collision.tileAt`. Note CA
in `docs/6-DevOps-SRE/Breaking-Changes.md`.
* **input:** twelve names move from `input/gamepad.js` to `input/pad-reading.js` — `padActions`, `stdDirs`,
`bindActive`, `oneButtonAtOnce` and the types `PadLike`, `PadButtonLike`, `GetGamepads`, `PadBinding`, `PadMap`,
`PadActions`, `ActionKey`, `Dirs`. Only the path changes: no name, signature or behaviour does. `initGamepad` and
everything around the runtime stay where they were. Note BZ in `docs/6-DevOps-SRE/Breaking-Changes.md` has the table
of what moved and what did not.
* **engine:** twenty-six modules and three constants of `core/constants` stop being published. The package's
`exports` are wildcards, so each was an entry point. Note BY in `docs/6-DevOps-SRE/Breaking-Changes.md` names
every one, says where it went (`game-platformer`, forked at v9.0.0), lists the three that were tried and came
back because they are accessibility, and records the two WCAG criteria that lost their gate here.
* **audio:** `SettingsAudioCtx` gains three required members — `newElement`, `speech` and `audioOutputs`.
A host that mounts the audio panel does not compile until it answers them. Note BX in
`docs/6-DevOps-SRE/Breaking-Changes.md` carries the three shapes and the migration the engine's own root uses,
which a host on a normal page can copy verbatim.
* sixteen names leave the package's surface. Fourteen stop being exported and stay where they
are — `core/i18n.availableLocales`, `input/gamepad.PADWIZ_ANIM`, `input/keyboard.KB_SCHEMES4`,
`input/touch-bindings.TOUCH_FORCE_RE`, `input/touch.buttonName`, `platform/audio-sonar.GUIDE_HZ`, `GUIDE_TAU`,
`ROUTE_BUDGET`, `ui/fonts.FONT_KEY`, `FONT_KEY_LEGACY`, `ui/loop-crash.CRASH_NOTICE_ID`,
`ui/pause-icons.itemReason`, `ui/settings-mobility.playerPrefix`, `ui/settings-motion.mountMotionInside` — and
there is no replacement for them: each is an implementation detail of the module that holds it. Two are deleted:
`ui/fonts.loadFontKey` and `ui/fonts.saveFontKey`; call `resolveFontKey(store)` and `persistFontKey(store, key)`
instead, which are the same two lines and are still published. See nota BW in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `ui/audio-choices` no longer exports `catRowHTML` or `catsListHTML`, and no alias is left
behind. The hearing panel's category list is built as nodes by `initSettingsAudio(ctx).renderAudio()`, which
needs `#audio-list` and `#navsound-list` in the document; the ids, the `data-acat`/`data-avol` attributes, the
rows and the words are unchanged, so a consumer that only calls `initSettingsAudio` changes nothing. A consumer
that imported either builder to draw rows itself has no replacement export. See nota BV in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** eleven names move from `ui/settings-motion` to `ui/motion-choices` with no alias left
behind — `RM_LABEL`, `CRT_LBL`, `CRT_ROUND_LEVELS`, `clampSelectedPlayer`, `allMotionFrozen`,
`motionMasterLabel`, `sceneMotionAnnouncement`, `crtToggleAnnouncement`, `crtLevelLabel`,
`crtRoundAnnouncement`, `stopResumeAllAnnouncement`. `initSettingsMotion`, `getSelectedPlayer`,
`setSelectedPlayer` and the type aliases stay. Migration note BU.
* **ui:** `ui/settings-motion` no longer exports `motionRowHtml`, `buildCharRowsHtml`,
`buildSceneRowsHtml`, `crtToggleRowHtml`, `crtRoundRowHtml` or `RM_SOON`. The interior is mounted by
`initSettingsMotion(ctx).render()`; the ids, the data attributes, the rows and the words are unchanged.
Migration note BT.
* **ui:** sixteen names move from `ui/settings-visual` to `ui/visual-choices` with no alias left
behind — `VISUAL_MODES`, `VISUAL_MODE_LIST`, `CONTRAST_LABELS`, `ROLE_KEYS`, `ROLE_LABELS`, `LQ_STEPS`,
`resolveVisualMode`, `contrastLabel`, `clamp01`, `lqLabel`, `lqPosition`, `lqPercent`, `lqFromPercent`,
`clampSelectedPlayer`, `rgbToHex`, `onOffLabel`, plus the types `RGB` and `RoleKey`. `sameRgb` is no
longer exported at all. `initSettingsVisual` and `VisualSettings` stay where they are. Migration note BS.
* **ui:** `ui/settings-visual` no longer exports `renderVisualPanelHtml`. The panel's interior is
mounted by `initSettingsVisual(ctx).render()`, which needs `#visual-list` in the document and nothing
else; the ids, the rows and the words are unchanged. Migration note BR.
* **ui:** `VoiceControl` gains a required member, `languageChanged(): Promise<void>`. A caller of
`createGame` changes nothing — the root calls it on `i18n:change`. Whoever implements `VoiceControl`
themselves adds it. Migration note BQ in docs/6-DevOps-SRE/Breaking-Changes.md.
* **boot:** a cartridge must stop calling `initGamepad` and stop calling `pollPads()` from its frame
loop — leaving them mounts a second controller over the engine's. What only the game knows moves to
`CreateGameOptions.gamepad`, where every absence has a written meaning and declaring nothing still leaves
a working controller. `initGamepad` stays published for a game that assembles a transport of its own.
Migration note BP in docs/6-DevOps-SRE/Breaking-Changes.md.
* **boot:** the root's window listener no longer delivers commands; `input/virtual-controller` does,
for every transport. A cartridge listening to `onCommand` gets fewer and more honest events: no release
without a press it heard, and nothing while a menu holds the key. `VirtualControllerDeps.holdKey` and
`.menuKey` now receive `TransportName | undefined` — a host wires `holdKey` to `input/state.markKeyFrom`.
Migration note BO in docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** `GamepadCtx` gains two REQUIRED members, `press(action, source, player): boolean` and
`release(action, source, player): void`. Whoever calls `initGamepad` passes `press: motor.controller.press`
and `release: motor.controller.release` — `Engine.controller` is published for exactly that. Migration
note BN in docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** `TouchBindingsCtx` replaces `markKey`, `releaseKey`, `emMenu` and `teclaDeMenu` with
`press(action, source): boolean` and `release(action, source): void`; `TouchDecision` carries `action`
instead of `code`; and `VirtualController.press` now returns a boolean, `false` meaning a menu took the
press. A caller of `createGame` changes nothing. Whoever builds `initTouchBindings` themselves, reads
`TouchDecision`, or implements something against `VirtualController` migrates with note BM in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** `keyName`, `keyUsedByOther` and `actionAlreadyBound` left `ui/settings-controls` for
`ui/control-choices`, unchanged in signature. If you only call `initSettingsControls`, nothing changes. If you imported any
of the three, change the path to `@the-inclusionist/engine/ui/control-choices.js`. See note BL in
`docs/6-DevOps-SRE/Breaking-Changes.md`.
* **ui:** `ui/settings-controls` rows changed shape. Mounting through `initSettingsControls` needs no change — the
ids, the ctx, the behaviour and the accessible names are the same — but the button's face is now the CURRENT KEY instead of
the word «Alterar», the game's word moved from `<b class="ctrl-nome">` to the kit's `<strong>`, and each button gained an
`id` of `ctrl-act-<action>`. If your CSS or tests targeted `.ctrl-nome`, target `.ctrl-row > span > strong`; measured, that
class carried no styling in this engine. `ui/panel-widgets.ControlShape` also gained `'button'`: harmless if you consume the
union, a new case if you switch over it exhaustively. See note BK in `docs/6-DevOps-SRE/Breaking-Changes.md`.
* **ui:** nine names left `ui/settings-typo` for `ui/typo-choices`, unchanged in signature: `isSelectableFont`,
`fontCssTarget`, `FontCssTarget`, `fontRow`, `typoGroups`, `TypoRow`, `TypoGroupView`, `typoRowSpec`, `typoControlId`. If you
only call `initSettingsTypo`, nothing changes. If you imported any of the nine, change the path to
`@the-inclusionist/engine/ui/typo-choices.js`. See note BJ in `docs/6-DevOps-SRE/Breaking-Changes.md`.
* **ui:** `ui/settings-typo` no longer publishes `typoListHTML`. Mounting through `initSettingsTypo` needs no change —
`#typo-list`, `#typo-preview` and `button[data-font="<key>"]` are the same, and each font button merely gains an `id` of
`typo-font-<key>`. If you rendered the list yourself, call `mountTypoInside(ctx, list, fontKey, installed)` with a
`{ procurar, criar }` ctx; `typoRowSpec(row)` gives you the row data to draw it another way. And `ui/panel-widgets.ControlShape`
gained `'radio'`: harmless if you consume the union, a new case if you switch over it exhaustively. See note BI in
`docs/6-DevOps-SRE/Breaking-Changes.md`.
* **ui:** `ui/settings-caa` no longer publishes `lettersRowHtml`, `caaRowHtml` or `caaListHtml`. If you mount the panel
through `initSettingsCaa`, nothing changes — the ctx, the ids (`#caa-caixa-alta`, `#caa-letras`, `button[data-caa="<key>"]`)
and the markup are the same. If you rendered the CAA list yourself with those builders, call `mountCaaInside(ctx, list)` with a
`{ procurar, criar }` ctx, the same shape the other kit panels take; `lettersRowSpec()` and `caaRowSpec(set)` give you the row
DATA if you want to draw it another way. See note BH in `docs/6-DevOps-SRE/Breaking-Changes.md`.
* **ui:** four interfaces were removed — `ui/camera-control.CameraModeControl`, `ui/eye-control.EyeControl`,
`ui/face-control.FaceControl` and `ui/hand-control.HandControl`. Their shape is `ui/switchable-control.SwitchableControl`,
which `ui/voice-control.VoiceControl` now extends. The objects the factories return are unchanged. Note BG in
docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **core:** `core/i18n.setLocale` no longer touches the page by itself — `<html lang>`, the DOM re-translation and the
`i18n:change` event now come from `LocalePort.applied`, which `platform/locale-host.localeHostHooks` builds; `applyDom` and
`initI18n` require their root argument; and `window.__i18n` is set by `platform/locale-host.exposeI18n` instead of by
importing `core/i18n`. Note BF in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** three shapes moved from `ui/settings-audio.js` to `ui/voice-settings.js` — `TtsPanel`, `TtsPanelEngine` and
`PanelVoice`. Note BE in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** nineteen names moved from `ui/settings-audio.js` to `ui/audio-choices.js` — `AudioCatDef`, `AudioCatState`,
`VoiceLike`, `SinkDeviceLike`, `NAV_CATS`, `GEN_CATS`, `TTS_ENGINE_OPTIONS`, `volPercent`, `catRowHTML`, `catsListHTML`,
`navMasterVolume`, `parseCaneDiv`, `caneDivMessage`, `voiceEngineOptions`, `pickVoicesFor`, `voiceLabel`, `sinksSupported`,
`sinkOptionLabel` and `sinkSelectValue`. Note BD in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** eight names moved from `ui/pause-icons.js` to `ui/pause-markup.js` — `PauseMenuButton`,
`ScreenPauseMarkupOpts`, `PauseSub`, `iconBtnMarkup`, `iconsMarkup`, `pmBtnMarkup`, `quickBarMarkup` and `screenPauseMarkup` —
and `ITEM_GLYPH` and `pauseMenuHtml` are no longer exported at all, having had no consumer. Note BC in
docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** three names moved from `ui/pause-icons.js` to `core/pause-icon-catalogue.js` — the `PauseIcon` interface,
`PAUSE_ICONS` and `pauseIcon`. Note BB in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** five names moved from `ui/pause-icons.js` and `ui/settings-visual.js` to `core/visual-cycles.js` —
`CONTRAST_LEVELS`, `CVD_SEQ`, `CVD_NAMES`, `nextContrast` and `nextCvd` — and `CVD_LABELS` was removed, having had no consumer.
Note BA in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **ui:** six names moved from `ui/pause-icons.js` to `core/calm-mode.js` — `CALM_NAMES`, `CALM_AUDIO_CATS`,
`nextCalmMode`, `sanitiseTeaLevel`, `calmAudioPlan` and `calmMotionPlan` — and `sanitiseTeaLevel` takes the fallback as a
second argument. Note AZ in docs/6-DevOps-SRE/Breaking-Changes.md says what to change.
* **architecture:** the map stops being an inventory and says where to go
* **render,ui:** three modules changed PATH — `render/cenario-data.js` is now `render/scenery-data.js`,
`render/set-cenario.js` is now `render/set-scenery.js`, and `ui/settings-motor.js` is now `ui/settings-mobility.js`. The names
they export did not change. Note AW in docs/6-DevOps-SRE/Breaking-Changes.md carries both tables.
* **input:** three modules changed PATH — `input/motor-simulation.js` is now `input/empathy-filter.js`,
`input/origem-sintetica.js` is now `input/synthetic-source.js`, and `input/transporte-em-uso.js` is now
`input/transport-in-use.js`. The names they export did not change. Note AV in docs/6-DevOps-SRE/Breaking-Changes.md carries the
table.
* **platform:** two modules changed PATH — `platform/pesados.js` is now `platform/heavy.js` and
`platform/pesados-catalogo.js` is now `platform/heavy-catalogue.js`. The names they export did not change. Inside this
repository the npm script is now `npm run heavy:delivery`; the published command `npx inclusionist-heavy` is unchanged. Note AU
in docs/6-DevOps-SRE/Breaking-Changes.md carries the table.
* **core:** two modules changed PATH — `core/anel.js` is now `core/ring.js` and `core/rotulo-acessivel.js` is now
`core/accessible-label.js`. The names inside them did not change: `stepInRing` and `accessibleLabel` are what phase 2 left them.
Note AT in docs/6-DevOps-SRE/Breaking-Changes.md carries the table.
* **boot:** the exported `Engine` interface gains a REQUIRED member, `dispose()`. It breaks only code that IMPLEMENTS that
type (a hand-written double in a game's tests); for everybody who merely receives what `createGame` returns it is an addition.
Note AS in docs/6-DevOps-SRE/Breaking-Changes.md says what to do, and when a page should call it.
* **engine:** the public names of `educational/**`, `consumer-quiz/**` and `boot/**` that carried a Portuguese word were
renamed — among them `GanchosDoCartucho`→`CartridgeHooks` and `MedicaoDeFlashes`→`FlashMeasurement`, which a cartridge holds.
With this the whole public surface of the package is English; the complete tables are notes AL, AM, AN, AO, AP, AQ and AR in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **ui:** every public name of `ui/**` that carried a Portuguese word was renamed, with no alias left behind — 101 of
them, among which `montarPainel`→`mountPanel`, `linhaDeControle`→`controlRow`, `montarPassos`→`mountSteps`,
`rotularLinha`→`labelRow`, `iconesQueAccionam`→`iconsThatAct`, `anunciarItem`→`announceItem`, `alvoMinimo`→`minimumTarget`,
`MotorPlayer`→`MobilityPlayer`, `initSettingsMotor`→`initSettingsMobility`. The complete table is note AQ in
docs/6-DevOps-SRE/Breaking-Changes.md.
* **render:** every public name of `render/**` that carried a Portuguese word was renamed, with no alias left behind — 103
of them, among which the whole render port (`Desenho`→`Drawing`, `Camada`→`Layer`, `CriarSprite`→`CreateSprite`,
`CriarDesenho`→`CreateDrawing`, `Tingivel`→`Tintable`, `Visivel`→`Visible`, `Descartavel`→`Disposable`),
`migrarVisual`→`migrateVisual`, `lerVisualGuardado`→`readStoredVisual`, `proximaCorrecao`→`nextCorrection`,
`createSetCenario`→`createSetScenery`. The complete table is note AP in docs/6-DevOps-SRE/Breaking-Changes.md.
* **input:** every public name of `input/**` that carried a Portuguese word was renamed, with no alias left behind — 84
of them, among which `marcarTecla`→`markKey`, `soltarTecla`→`releaseKey`, `carimbarOrigem`→`stampSource`,
`entradaDe`→`inputOf`, `Transporte`→`TransportName`, `alternanciaDe`→`latchOf`, `chaveDaAlternancia`→`latchKey`,
`criarArestaComAlternancia`→`createLatchedEdge`, `montarControleDeToque`→`mountTouchControls`. The complete table is note AO
in docs/6-DevOps-SRE/Breaking-Changes.md.
* **delivery:** the delivery folder is `heavy/` instead of `pesados/`, and the published command is `inclusionist-heavy`
instead of `inclusionist-pesados`. Build the delivery again after bumping the engine — a `dist` written by the old command
404s under the new one. The verified cache is keyed by the upstream address, so nothing is re-downloaded; the cache's name
(`incl-pesados-v2`) deliberately does not change. Note AN in docs/6-DevOps-SRE/Breaking-Changes.md.
* **platform:** every public name of `platform/**` that carried a Portuguese word was renamed, with no alias left behind —
54 of them, among which `baixarPesados`→`downloadHeavy` (also a field of `CreateGameOptions`), `kJogo`→`gameKey`,
`getComLegado`→`getWithLegacy`, `getJSONComLegado`→`getJsonWithLegacy`, `PESADOS`→`HEAVY_FILES`,
`caminhoNaEntrega`→`deliveryPath`, `chaveDaEntrega`→`deliveryCacheKey`, `vozesDoIdioma`→`voicesForLocale`. The complete table
is note AM in docs/6-DevOps-SRE/Breaking-Changes.md.
* **core:** every public name of `core/**` that carried a Portuguese word was renamed, with no alias left behind — 67 of
them, among which `modoCego`→`blindMode` (binding AND event name), `setModoCegoValue`→`setBlindModeValue`,
`idiomaPronto`→`localeReady`, `carregarEstado`→`loadState`, `rotuloAcessivel`→`accessibleLabel`, `Tema`/`Correcao`/`Simulacao`
→`Theme`/`Correction`/`Simulation`. The complete table is note AL in docs/6-DevOps-SRE/Breaking-Changes.md.
* **voice:** `VoskDeps.doc` and `VoskDeps.loadScript` are gone; `VoskDeps.loadBundle` replaces them and
`VoskApi.createModel` takes the file resolver as its second argument. Nothing outside this repository reads these names —
they exist so a gate can inject a double. Note AK in docs/6-DevOps-SRE/Breaking-Changes.md.
* **voice:** `PauseIcon.soon` is gone, with the `.pi-soon` CSS rule and the `icon.soon` key in pt/en/es; an icon with
nothing to act on is ABSENT from the bar, which is what `iconesQueAccionam` already did. `EventoDoJogo.voiceControl`
entered as required: whoever writes their own map of the state's events adds this member. Measured across the seven game
repositories: none reads `PauseIcon.soon`, `pi-soon` or `icon.soon`. Note AK in docs/6-DevOps-SRE/Breaking-Changes.md.
* **voice:** `CreateGameOptions.carregarKokoro` left. A game that filled it
declares `uses: { neuralVoice: true }` instead and deletes its loader; the types
`ModuloKokoro`, `SessaoKokoro` and `CarregarKokoro` are now `KokoroModule`,
`KokoroSession` and `LoadKokoro`, declared in `platform/kokoro` and re-exported
from `platform/tts`. Note AJ in docs/6-DevOps-SRE/Breaking-Changes.md.
Measured on 2026-09-21: no sibling repository names `carregarKokoro`.
* **camera:** ui/webcam (eyeMode, setEyeMode, eyeSet, onGaze, startEyeControl, stopEyeControl, loadWebGazer), the catalogue entry visao:olhar and blob: in script-src are removed; play with the eyes through the quick bar's 👀 and receive commands with onCommand.
* **input:** input/gaze-keys (gazeKeyEvents, dispatchGazeKeys, GazeKeyEvent) is removed, and ui/eye-control's EyeControlDeps takes controller: VirtualController instead of scheme.
* **input:** input/camera-gestures and all its exports (criarLeitorDaCamera, criarLeitorDoRosto, criarLeitorDosOlhos, criarLeitorDosGestosEstaticos, criarLeitorDosGestosDinamicos, formaDaMao, tresDedos, poseDaCabeca, GESTOS_ESTATICOS, GRUPOS_DA_CAMERA, ESPERA_MS, FIRMEZA_MS, REPOUSO_MS and its types) are removed; use input/face-map, input/hand-map, input/gaze-relative and input/gaze-cycle.
* **voice:** `CreateGameOptions.carregarVozNeural`, `TtsCtx.carregarVozNeural`, the Piper provider types, `platform/vozes-prontas`, the Piper catalogue exports of `platform/voice-plan` and the Piper heavy-file entries are removed; `vozesDoIdioma` takes the catalogue as a required argument. See docs/6-DevOps-SRE/Breaking-Changes.md, note AF.
* **help:** `ui/help-panel.helpListHtml` left; build the help with `montarSlides({ criar })` and show a row with `mostrarSlide(el, rows, i, { criar, t, titulo })`; `#help-list` holds one `.slides` element, not `.ctrl-row`s (see Breaking-Changes.md, AE).
* **captions:** `core/caption-duration.duracaoDaLegenda` takes the reading rate (`duracaoDaLegenda(texto, state.captionPpm)`) and `MS_POR_PALAVRA` left (see Breaking-Changes.md, AD).
* **accommodations:** `acomodacoes` must answer `ownerColors` and `contrastOutlines`; an answer without them is refused at `createGame` and `mount()` (see Breaking-Changes.md, AC).
* **core:** `core/state` and `core/i18n` no longer read storage at
import. A root that does not go through `createGame` calls
`carregarEstado(store)` and `carregarIdioma(store)` before reading or writing
a setting (`store` is `@the-inclusionist/engine/platform/storage.js`); a
setter that would write before that throws, and `setLocale` is refused.
game-platformer: before `i18n.initI18n()` in app/js/main.ts. See
Breaking-Changes.md §AA.
* `ui/activities-menu` is gone — the platformer's title menu
lives in game-platformer. The pause card's buttons moved: import `PM_BTNS`,
`PM_OPTIONS_BTNS`, `PM_JOGO_BTNS` and `PauseBtnDef` from
`@the-inclusionist/engine/ui/pause-buttons.js`. 161 dictionary keys only
game-platformer used are no longer in the engine's pt/en/es; a game that
used one registers it with `registerDict`. See Breaking-Changes.md §Y.
* **webcam:** `loadWebGazer` no longer fetches WebGazer from the
network; it runs only what `baixarPesados` downloaded and checked. See
docs/6-DevOps-SRE/Breaking-Changes.md section W.
* **platform:** `CACHE_PESADOS` is `incl-pesados-v2` and heavy files
are kept only when their sha256 matches; an insecure context keeps none.
See docs/6-DevOps-SRE/Breaking-Changes.md section V.
* **boot:** the lines of `createGame`'s `problems` and of
`lacunasDoToque` change value — English, with the child's cost and the
fix. See docs/6-DevOps-SRE/Breaking-Changes.md section U.
* **menus:** `ui/menu-items.numerarItens` and `ATRIBUTO_DO_NUMERO`
are removed, panel rows no longer carry `data-item-num`, and the quick
bar's visible name no longer ends in «, N de M». See
docs/6-DevOps-SRE/Breaking-Changes.md section T.
* **touch:** createGame no longer draws the on-screen pad unless the cartridge passes
controleNaTela: true; with it, the pad hides while the pause card or a panel is open.
See docs/6-DevOps-SRE/Breaking-Changes.md section R.
* **layout:** `ui/layout.REGUA_DE_ALVO` and `ui/layout.alvoMinimoDeToque`
are removed; use `alvoMinimo(k)`. `aplicarEscala(regiao, escala)` takes no
height. `createGame` sizes `#game-region` itself and `--alvo-min` is never
24 or 34 px any more. See docs/6-DevOps-SRE/Breaking-Changes.md section O.
* **touch:** the touch transport has 13 slots (`TOUCH_DEFAULT`, `TOUCH_SLOTS`, `TOUCH_ACTS`, `LUGARES.toque`), adding the four shoulders; `#touch-controls` covers the whole region. See Breaking-Changes.md section N.
* **touch:** the virtual pad no longer draws unnamed directions or action buttons; declare in `preset` every position a touch-only child needs, including the directions and `action2`/`action3` for menus. Action buttons are placed by `data-acao`. See Breaking-Changes.md section N.
* **pause:** pause items with no action are `aria-disabled` with `data-motivo` instead of `hidden`; `pause.som`/`menu.som` values changed to «Conforto auditivo». See Breaking-Changes.md section M.
* **panels:** `MountPanelSpec.primeiroFoco` is removed and a mounted panel always focuses `#X-close`; `montarCasca` places `#X-close` (class `overlay__back`) before the list and leaves only `#X-reset` in `.overlay__actions`. See Breaking-Changes.md section L.
* **touch:** `montarControleDeToque` no longer filters directions and buttons by the game's actions, pad presses go to an open menu as stamped keydowns, and the pad no longer hides under the pause card or panels. `TouchBindingsCtx` gains optional `emMenu` and `teclaDeMenu`. See Breaking-Changes.md section K.
* **ui:** the `other` audio category is removed from `AUDIO_CATS`, `GEN_CATS` and `CALM_AUDIO_CATS`; `#navsound-master` is no longer built; the general sound rows and the taste categories moved from `#audio` to the new `#som` panel. See Breaking-Changes.md section J.
* **core:** a `preset` that declares `select` is refused by `createGame` and `mount()` (`core/actions.selectClaimProblem`). See Breaking-Changes.md section I.
* **boot:** the `start` action no longer opens the pause card — it is the quick pause (game frozen, quick bar on the directional, PAUSED shown); the `select` action opens the card. `ui/pause-icons.entrarNaBarra` no longer calls `acts.resume()`. See Breaking-Changes.md section I.
* **boot:** createGame({ ... }) now requires `acomodacoes`, an answer
for all sixteen game-keyed accommodations (core/accommodations GAME_KEYED):
the game's word when the accommodation has a subject in the game, or `false`.
mount(declaration, ganchos) requires the same answer in `ganchos`. A cartridge
without it is refused at boot. Start with every key `false` and give a word to
each accommodation your game really has; see
docs/6-DevOps-SRE/Breaking-Changes.md section G.
* **ui:** `FontCssTarget` gains a REQUIRED `cursiva: boolean`, so anything constructing that type by
hand stops compiling — add `cursiva: it.fb === 'cursive'`, or take the value from `fontCssTarget`, which is
where it is computed. And the document's default letter/word spacing moves from the WCAG 1.4.12 floor
(0.12em/0.16em) to the BDA recommendation (0.18em/0.63em): every screen's text metrics change, so a game that
lays out by measured text width, or fits labels by eye, will see it. A joined face is exempt and gets both
back to `normal` via `data-cursiva` on the root.
* **fonts:** the PWA precache grows from 1922 KiB to 3512 KiB (65 to 106 entries) — twenty-two font
families join the packaged roster, including seven Playwrite that ADR-0108 had explicitly kept OUT of the
bundle. A consumer measuring first-load size, or asserting the precache manifest, will see it; nothing in the
published API changed, which is why this is written here and in ADR-0150 rather than left to the surface gate.
* **boot:** the `start` action now opens the pause, and the solo keyboard scheme puts `start` on `KeyH`
and `Enter` (`input/default-bindings.ts:89`) — so `Enter` opens the pause during play and the engine calls
`preventDefault()` on it. That is the behaviour the monolith always had (`PAUSE_KEYS = {Escape, Enter}`) and
the stated reason `Enter` was bound to `start`, but a game that relied on `Enter` reaching it while the card
was closed will feel it; remap it, since the child's scheme is the source of truth. And a cartridge that
declares `start` in its own `preset` is now REFUSED at boot and at `mount()`, with the reason said — measured,
no game in the catalogue declares it today, so this refuses nothing that exists. No exported name or type
shape changed, which is why this is written here and in `docs/6-DevOps-SRE/Breaking-Changes.md` §D2: the
surface gate compares names and shapes, and a behaviour that changes meaning passes it green.
* **i18n:** `ui/settings-panel.EXPLAIN_IDLE` changed VALUE, not shape: it was the Portuguese sentence
itself and is now the i18n key `'menu.explainIdle'`. Code that displayed it directly — `footer.textContent =
EXPLAIN_IDLE` — now shows the key instead of a sentence; wrap it in `t()`. Code that only passes it to
`fillExplain`, or that sets `data-explain-idle` on the card, is unaffected. ⚠️ The published-surface gate does
NOT catch this class of change: it compares exported NAMES and type SHAPES, and a string constant whose value
changes keeps both. It was caught by measuring the surface by hand for the migration note.
* **ui:** `allMotionFrozen(rmKeys, rm, rmChar, undefined)` now returns `true` when every scene key is
frozen, where it previously always returned `false`. Consumers that call it directly with no player — and that
therefore render the master toggle's label from it — will see «Retomar» offered where «Parar» used to be, which
is the point: the previous label offered an action that could not be undone.
* **ui:** `PanelShell` gained a required `titulo` field — the `<h2>` node, exposed because whoever
retranslates a panel writes into it. Code that only READS what `montarCasca` returns is unaffected; code that
CONSTRUCTS a `PanelShell` by hand (a test double) has to add the field. `MountPanelSpec` also replaced its four
label strings with a single `rotulos: () => PanelLabels`, but that type ships for the first time in this same
release and so breaks nobody yet.

### Features

* **a11y-bar:** the quick bar shows the name below its row and what the icon does in the footer ([8417667](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8417667efbbdeb963a78e5e328b89f503628011e))
* **a11y:** ☝️ cycles standard control, sticky keys and one button only ([0cae5c0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0cae5c00c33d7d5064e77440696a2ebc973891de)), closes [#201](https://github.com/the-inclusionist/the-inclusionist-engine/issues/201)
* **a11y:** every change of menu context is announced ([df7dd6d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/df7dd6de2a51b151b12b2a080ab5d7594cddf765)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** one button only becomes play — the scan drives the controller ([c1156cd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c1156cdc48c6bab134325332078c83d573bc4cbf)), closes [#201](https://github.com/the-inclusionist/the-inclusionist-engine/issues/201)
* **accommodations:** owner colours and contrast outlines are game-keyed subjects ([04f1e34](https://github.com/the-inclusionist/the-inclusionist-engine/commit/04f1e347d332b2c815caf34184f6c947013099fa)), closes [#183](https://github.com/the-inclusionist/the-inclusionist-engine/issues/183)
* **accommodations:** what applies carries the game's word ([160508a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/160508ac9175ec196ba1b8a89417ad3056899b3f)), closes [#149](https://github.com/the-inclusionist/the-inclusionist-engine/issues/149)
* **audio:** a Piper voice carries a feather in the voice list ([7ef8b61](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7ef8b611d2f0db9cb861e4ed0629a38a68ccad5e)), closes [#180](https://github.com/the-inclusionist/the-inclusionist-engine/issues/180)
* **audio:** the child picks the voice, among the voices that speak the language ([9d0f5e5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9d0f5e5d170097cec85d9ef9c8ba00ac1e787398)), closes [#180](https://github.com/the-inclusionist/the-inclusionist-engine/issues/180)
* **audio:** the child's speech rate, measured on every utterance ([c3a0097](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c3a00976bfeed1872badf3ceafbf41a5178c9844)), closes [#179](https://github.com/the-inclusionist/the-inclusionist-engine/issues/179)
* **audio:** the panel receives the browser in three obligatory ports ([7b1825f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7b1825f7e02383c35d9ce2f61f97e7f779f315ed)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **boot:** `medirFlashes` samples the world's canvas against WCAG 2.3.1 ([ba5e077](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ba5e07753b12d369dd931d6aacc179a915c70c8c)), closes [#141414](https://github.com/the-inclusionist/the-inclusionist-engine/issues/141414)
* **boot:** a cartridge that sizes the game region is named in problems ([2683f80](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2683f808f0e9c807334efad27054bfdd395c77e5)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **boot:** a key stored outside the engine's scopes is said in problems ([ab8180f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ab8180f65352e84e639a741152bec1c41c599f0a))
* **boot:** a language changed mid-game redraws what is on screen ([46dbf37](https://github.com/the-inclusionist/the-inclusionist-engine/commit/46dbf37dea817dd9e6120787142dfa8191dc331b))
* **boot:** a page without a skip link gets the engine's ([2d787a7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2d787a7b63725831f3e56a028f17641ecf680ecb))
* **boot:** a page without the engine stylesheet is told so in problems ([aae1daf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/aae1daf99dd98d2942d24faf237f9387ab9ad813))
* **boot:** createGame applies the stored CRT, yields it to visual modes, and anchors its scanlines ([67ba391](https://github.com/the-inclusionist/the-inclusionist-engine/commit/67ba391e83fee0b6b5f325f490dac4ab1b7e7e79))
* **boot:** createGame mounts the virtual pad — a tablet with no keyboard can play ([2567148](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2567148bade19d078ceb80a199dc34981b3bad90)), closes [#game-region](https://github.com/the-inclusionist/the-inclusionist-engine/issues/game-region)
* **boot:** every cartridge answers its accommodations, and the boot refuses one that does not ([bae1ef1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bae1ef17ace4b777474cf9bb0ebc6e3f35999dbd)), closes [#cane-div](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cane-div) [#typo](https://github.com/the-inclusionist/the-inclusionist-engine/issues/typo) [#caa](https://github.com/the-inclusionist/the-inclusionist-engine/issues/caa) [#149](https://github.com/the-inclusionist/the-inclusionist-engine/issues/149)
* **boot:** motor.reading — the game asks to listen, the engine answers ([b888c17](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b888c174518b26e7f04d1002adcc116f7baef446)), closes [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **boot:** playing with the eyes, wired into createGame ([0e3054f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0e3054fed2a4a934faf6d63a5f1f8a84495508c1)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194) [#196](https://github.com/the-inclusionist/the-inclusionist-engine/issues/196)
* **boot:** START is the quick pause and SELECT opens the menus ([207f6e3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/207f6e3b2a600967ca2de5ed574ae075da364984)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **boot:** text and targets a cartridge draws under the floor are named in problems ([99d307e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/99d307e953f23b2a53e99dd5e5d93dc486493f27)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **boot:** the controller-mapping wizard cannot be declined ([47b103d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/47b103d2e08412076ff5c4539f5fcbd16b53ca38))
* **boot:** the engine actions `print` and `quit` — and «leaving» finally has an answer ([c5521ff](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c5521ff3699685e4c0ea3975ef0eacc4cf0ffc41))
* **boot:** the engine answers the spoken index, and the demo quiz asks it instead of the store ([717945d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/717945d67ec9af6ea4ff5f5b7291bfceda9419e0)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **boot:** the engine corrects colour-vision by default — and 🌗 turns out NOT to be hers ([a64e042](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a64e04201dabe887bd46e93fe3f8f078e64c45da)), closes [#cvd-fix-protan](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-fix-protan)
* **boot:** the engine hosts the sound caption, above the explanation ([5664ad9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5664ad9e13f66eceb9c90f11b556502df6eb8243))
* **boot:** the engine mounts and wires the typography panel, and the pause card stops being one button ([77a1407](https://github.com/the-inclusionist/the-inclusionist-engine/commit/77a1407442c75c479ac511ce5773286bb871c4c8)), closes [#game-region](https://github.com/the-inclusionist/the-inclusionist-engine/issues/game-region)
* **boot:** the engine mounts the communication panel, and a panel that closes itself keeps ONE way out ([9647a41](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9647a4100b84431028fa6132b5ad231c27255052))
* **boot:** the engine mounts the gamepad, and the cartridge declares only what it alone knows ([ebf83ec](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ebf83ec711831cef726e14a2f7531c7e4bff8b1e)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **boot:** the engine mounts the hearing panel, and the monolith's dead guard fires again ([9848bde](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9848bdef3542796756e364b809c36042bc43ad6e))
* **boot:** the engine mounts the motor panel, and its first row sizes the pad by persona ([1734cb9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1734cb9daf22f61be5e69e9b55425876da3bef70)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **boot:** the engine mounts the visual-sensitivity panel, id mismatch and all ([2e672d8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2e672d86b96df59b03e872e9af5e7b4864ba9360))
* **boot:** the engine OPENS the pause by the `start` action — and the card it opens has a way OUT ([a6a7572](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a6a7572198f3f79d3300da65802c390e43d9de1c)), closes [#142](https://github.com/the-inclusionist/the-inclusionist-engine/issues/142)
* **boot:** the frozen screen says how to reach the menus, and action4 opens them ([1ccc6ef](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1ccc6ef962fec9cfef49721f8b29aa059dc119dc)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **boot:** the keyboard goes through the same door, and one `deliver` is left ([04b61db](https://github.com/the-inclusionist/the-inclusionist-engine/commit/04b61db6c23498740ba33c8992cc1504edadb96c)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **boot:** the motor panel maps the keyboard for 1, 2 and 3–4 players ([82930e8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/82930e8ebcef3287c707a10341b4216357178492)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **camera:** one webcam icon cycles off, hands, face and eyes ([68de1b5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/68de1b582b142a4d0905b74e4037ec4d6bf85a85)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191) [#199](https://github.com/the-inclusionist/the-inclusionist-engine/issues/199) [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **camera:** play with the face from the quick bar's 🧑 ([2a69e03](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2a69e030a054b42621e547b159f0c21863652d91)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191) [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **captions:** a sound caption stays for its words, at a child's reading rate ([2bd2826](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2bd282686060422286fdebe88f6099a940557dbf))
* **captions:** the child sets the caption reading rate — 125, 145 or 175 words a minute ([e61d571](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e61d571ed34a0cb2076ec554272f41866ba05f87)), closes [#179](https://github.com/the-inclusionist/the-inclusionist-engine/issues/179)
* **catalogue:** the reading models, asked for by language ([20dd187](https://github.com/the-inclusionist/the-inclusionist-engine/commit/20dd1873f05295fa5e1bbc52bd7d0ce7e6bef2ff)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **catalogue:** the voice runtime is the engine's, not each game's ([d175bb8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d175bb80139dc16622a59078d4135fdb029319e4)), closes [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200) [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192)
* **core:** a cartridge may not claim `select` either — it opens the pause menus ([c1ce1a6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c1ce1a6187fde007ed6167b1d83a6473885ce7c2)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **core:** the accommodation catalogue — a closed vocabulary in three families ([59dc3e0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/59dc3e0842201246cac6278f0a3aeb6ea34bd3fb)), closes [#143](https://github.com/the-inclusionist/the-inclusionist-engine/issues/143)
* **core:** the cartridge's answer to the accommodations — complete, and a missing key is a malformed declaration ([aa6f724](https://github.com/the-inclusionist/the-inclusionist-engine/commit/aa6f72431c7c19f7469d7b6ea3bd91d7acb5c5fd)), closes [#149](https://github.com/the-inclusionist/the-inclusionist-engine/issues/149)
* **core:** the contract-keyed accommodations are derived from the contract, and navigation sound obeys ([22e1170](https://github.com/the-inclusionist/the-inclusionist-engine/commit/22e11700e2de30bc2a7aad264830a5174ebe284e)), closes [#149](https://github.com/the-inclusionist/the-inclusionist-engine/issues/149)
* **core:** the grid leaves — `core/collision` and the tile-type table ([203801a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/203801a7129c1149e04e2a2f28593a6c5339c738)), closes [#63](https://github.com/the-inclusionist/the-inclusionist-engine/issues/63) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **core:** the root builds a translator, and hears a language change through its disposing door ([e4d9a55](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e4d9a5510f153d88db14f8d7279138f71d6a4ee5)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** the WCAG 2.3.1 general flash threshold, as a pure analyzer ([3a04adf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3a04adf13083f94c409bec61a07673d8c2569cf5))
* **delivery:** the heavy files can come from a mirror, chosen by --base or .env ([a1bd77e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a1bd77e2a5da99058cb3947cbd957f1b3ccc37d3)), closes [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192) [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **delivery:** the voice-command models enter the catalogue, one per language ([2b6aa1c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2b6aa1c98bb2f1eabca49eedf97d2243762015df)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **delivery:** write each heavy file's licence and notices beside it ([f27035a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f27035a22b11220d807b5e6acd64f53776437d22))
* **empathy:** «one button at a time» and «no strength to hold» simulate a motor difficulty ([caf2ce1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/caf2ce112300804cd85c1ff1e8a8c2eaaa932f6c)), closes [#177](https://github.com/the-inclusionist/the-inclusionist-engine/issues/177)
* **empathy:** tunnel vision, a central scotoma and scattered scotomas are drawn over the world ([4627dde](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4627ddef97c034cc594e173637904fa35c617cab)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182) [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **engine:** the tile world leaves — the engine stops describing a game ([87b6cdb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/87b6cdbe6861910b839a169379dd3278edc03745)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **fonts:** four rounded faces join the roster — Fredoka, Comfortaa, Quicksand and Nunito ([b0b3540](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b0b3540d54885c91b49bcfbbe7d29d4f464ecb53))
* **fonts:** Teachers joins the roster and Comfortaa leaves it — «ruim para dislexia» ([0e9d241](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0e9d24187c81c564f6ee27360158056085183c5a))
* **fonts:** the engine packages every active family of the typographic catalogue ([192f777](https://github.com/the-inclusionist/the-inclusionist-engine/commit/192f7774b642df1ccd535d19188b5da334130d42)), closes [#172](https://github.com/the-inclusionist/the-inclusionist-engine/issues/172)
* **fonts:** the faces answer to the typographic catalogue ([a5e8534](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a5e8534e3a6fb8b1f08bec2b0c211e13a750cb35)), closes [#172](https://github.com/the-inclusionist/the-inclusionist-engine/issues/172) [#172](https://github.com/the-inclusionist/the-inclusionist-engine/issues/172)
* **fonts:** the roster grows by twenty-two — seven Playwrite packaged, and fifteen text faces ([d6af366](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d6af36622163fcbe53b372a0f7e4420e96234ce0))
* **footer:** the pause card shows its own button legend ([1f4b863](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1f4b863eae1b487b76a13427e44f4d5ceaa769e4)), closes [#157](https://github.com/the-inclusionist/the-inclusionist-engine/issues/157)
* **gate:** code health is a ratchet — the four measures, and nothing gets worse ([b98338d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b98338d561cdb62181665e6d83bd8570e688b157)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **gate:** Portuguese only shrinks, and a new word must be classified ([91e1a6c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/91e1a6c56c6ff71f0e73c5211942fac4050128a7))
* **gate:** the fifth measure is what a module REACHES (step 7d) ([4cc6b05](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4cc6b05ab4a43a12a7c855ea9f014345b67625d2)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **genres:** a cartridge may declare its genre from the Dev's list; Casino game is refused ([5f0fd96](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5f0fd968bf8751c168c1134f725aa2d86e22099e)), closes [#149](https://github.com/the-inclusionist/the-inclusionist-engine/issues/149)
* **headers:** a Content-Security-Policy that names only what the engine fetches ([6bffc16](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6bffc16f56eff5115d4908cad4b2acd2c50e5d85)), closes [#170](https://github.com/the-inclusionist/the-inclusionist-engine/issues/170) [#169](https://github.com/the-inclusionist/the-inclusionist-engine/issues/169) [#170](https://github.com/the-inclusionist/the-inclusionist-engine/issues/170) [#170](https://github.com/the-inclusionist/the-inclusionist-engine/issues/170)
* **health:** fan-out counts value imports, reach sees more of the browser, and a seventh measure counts value edges into state ([a0ef751](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a0ef751224385b60c3eeeb1e16daf2a8eeb8c0f9)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **help:** «how to play» slides are the cartridge's, shown before the buttons ([a85bfee](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a85bfeedce4f1db066637ed277995ccb586a5f55)), closes [#188](https://github.com/the-inclusionist/the-inclusionist-engine/issues/188)
* **help:** the help is a slide show, not a menu ([e9a24d1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e9a24d1ac81a9074b2d64978d1dc8b72a8fa9f5b))
* **hud:** points and mission top left, power top right, nothing under the bar ([bf828a9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bf828a96577b793922bb900feb1bc88ba72de10b)), closes [#94](https://github.com/the-inclusionist/the-inclusionist-engine/issues/94) [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162)
* **hud:** the engine mounts the HUD from the numbers a game declares by band ([2e83917](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2e839179a7c00f2711561b7dc96240f36573e5f3)), closes [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162) [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162)
* **hud:** the learning bars, centred in the footer under the explanation ([a998e33](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a998e33f17a6f111977aaf3fd49fa180a90612ff)), closes [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162) [#94](https://github.com/the-inclusionist/the-inclusionist-engine/issues/94) [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162)
* **i18n:** a cartridge key missing in one of the three languages is said ([06117e1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/06117e18db1d5a3d10aa79819b8ec7627fd8a2f6))
* **i18n:** a game's dictionary is its root's, registered through CreateGameOptions.dictionaries ([cb823a9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cb823a9537b46ce1a84a3bcf283fcd153eb4b2fc)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **i18n:** the eleventh quick-bar button is the communication cycle ([0a0b4f7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0a0b4f768e127c98963092dcff21047383beffc9)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **input:** a tremor is not a second press ([c477ba6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c477ba6276a19ebe1974f6d3f8e6559a50d21824)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **input:** every eye command is a look and a blink pattern (ADR-0202) ([39d469c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/39d469c52802eabbba47bb4dab4b65160c37a284)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **input:** hand gestures, face and eyes read as commands ([ae3ec23](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ae3ec23693f9044df9d5a4ce17a8b8ce0d589126)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **input:** read the gaze from its own rest, with no calibration ([42a2ae7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/42a2ae7dd418b63e582103e86b203693492db5c7)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **input:** read the head pose and the eye blendshapes for eye control ([a9bec44](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a9bec44a28c18eda453cdbcb396a500412beba6b)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194) [#196](https://github.com/the-inclusionist/the-inclusionist-engine/issues/196)
* **input:** the camera reads one group at a time; a held command never repeats ([f5547d9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f5547d987e1847afe96c5642efe42f7ddc8c45f3)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **input:** the engine carries the virtual button to the game ([de2e77a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/de2e77a9831cf20a7b14f30dfab35ef51ab1002a)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197) [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **input:** the eye control presses keys stamped as the eyes ([b728445](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b728445ee80cb0ebfaf205cb3f53f81c3e476f08)), closes [#196](https://github.com/the-inclusionist/the-inclusionist-engine/issues/196)
* **input:** the face as a controller, by the Dev's map ([73f6a9f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/73f6a9fa047a7406f38b97432581d47772b26a50)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **input:** the face says down with the mouth; the eyes need a blink to move (ADR-0199) ([cd2bbaa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cd2bbaae64f47137435386cfeacf1378e61e5105)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **input:** the finger presses the virtual controller, not a key ([a1e4d3e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a1e4d3e0f37cd2e4fec24537adcda2a4a4053a48)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **input:** the gamepad presses the same door, and the engine offers the control object ([103843c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/103843cebbe245cbafe7df2482297aa39c5c2db0)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **input:** the hands as a controller, by the Dev's map ([ddd7a47](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ddd7a47f55f6c56e120175f4aa94ea4e33bfba59)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **input:** the scan of «one button only» — the machine offers, the child takes ([058f539](https://github.com/the-inclusionist/the-inclusionist-engine/commit/058f5393e536b47f95533b0ab3d60c49c9ed890d)), closes [#201](https://github.com/the-inclusionist/the-inclusionist-engine/issues/201)
* **input:** the touch pad draws a SELECT pill beside START ([3983f82](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3983f8211f8260ff043436a852d0151c414fc20c)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **input:** the virtual control is drawn from what the game declares, and its absence stops being silent ([5bee1ca](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5bee1ca14e7a5cba51e192b3bd35256fdad2c10d))
* **input:** the words a child says, and the position each one presses ([821cc67](https://github.com/the-inclusionist/the-inclusionist-engine/commit/821cc678af91ad45969909d6c655edcb75148122)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#190](https://github.com/the-inclusionist/the-inclusionist-engine/issues/190)
* **input:** turn four gaze zones into twelve actions and START ([9d0a50a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9d0a50a09d2935cf1d563f6bcba3236433b969f3)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **language:** measure Portuguese prose in the Markdown, and let it only shrink ([8472017](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8472017111422f56f64aaa573d207d2adad19c9d))
* **language:** the comment gate reads the whole tree, by kind ([478f5dd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/478f5dd77a010e53b262a518fac4031f2ab6075b))
* **layout:** createGame applies the resolution — the cartridge has no other ([337b16a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/337b16afa2aa4c867daaf469da237db960ad2d66)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **layout:** the target floor is 44 px at 640x360 and grows with the scale ([6142618](https://github.com/the-inclusionist/the-inclusionist-engine/commit/61426184611120bc6282d26c5b7755227a87b7dc)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **loop:** a loop with no crash notice announces through the engine's ([08a1f51](https://github.com/the-inclusionist/the-inclusionist-engine/commit/08a1f517ab332db98476e12b932257c2b6f17cff))
* **menu-nav:** a panel item speaks its label, type, value and position ([afaf8da](https://github.com/the-inclusionist/the-inclusionist-engine/commit/afaf8da9c761cd710feab85bb481e2a36a293613)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **menu-nav:** a press held on a menu item places the cursor and says it ([906e5d0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/906e5d0371010200d8609cfd8cf8a115ca16de47)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **menus:** items show no number; the place is spoken after the name ([e3e53d3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e3e53d31647889a4f776a2071cd76aa77427e7e1)), closes [#161](https://github.com/the-inclusionist/the-inclusionist-engine/issues/161)
* **models:** a script to upload the staging tree to R2 and check what it serves ([20964d5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/20964d52ba98c4a1c66761ce69f527251c6bf0c4)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192) [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **models:** export Whisper small to ONNX here, from the Apache-2.0 weights ([bfc591f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bfc591f747d5211ed050049c3cf981f671eab84e)), closes [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192) [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192) [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **motor:** «Jogar falando» in the motor panel — the last row of the Dev's list ([#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)) ([392f378](https://github.com/the-inclusionist/the-inclusionist-engine/commit/392f378843a99e9bc16dbbf84d1405cd2c3abea6)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **motor:** «Mapear controle» opens the engine's gamepad mapping wizard ([17237e9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/17237e98f74c621b416482b661e4c98e2fa2673c)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **motor:** «Mapear toque» sets the function of each on-screen pad button ([dffc265](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dffc2651201325886555a515f2023a4dccd394a6)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **panels:** a settings panel opens on «Voltar», item 1, with no close at the bottom ([e2d3225](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e2d32258aab36d8ec065d72272970421a09491d2)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **panels:** every stop of a settings panel shows its number ([61d8775](https://github.com/the-inclusionist/the-inclusionist-engine/commit/61d8775797ad37105c4974a65a5a50f86792e4f5)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153) [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **panels:** the engine mounts the empathy panel — the last locked settings item unlocks ([b6037e4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6037e441586abf1b31df2463b01511539b90d1c))
* **panels:** the engine mounts the visual accessibility panel, and its item unlocks ([f16bb63](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f16bb635284f20ae871b3de1a9600b3f9024fd5d)), closes [#155](https://github.com/the-inclusionist/the-inclusionist-engine/issues/155)
* **pause:** a cartridge declares its game options as rows, and the engine draws them ([16e6bda](https://github.com/the-inclusionist/the-inclusionist-engine/commit/16e6bdaad1ba9cd1671986588e29a63af4e2ede0)), closes [#178](https://github.com/the-inclusionist/the-inclusionist-engine/issues/178)
* **pause:** every item of the pause card shows its number ([b1ee7dc](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b1ee7dc992fa28886e18c144aa077cca80184ba7)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **pause:** the pause card always shows all its items; a locked one says why ([f13c8e4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f13c8e4733c78de687e77e41e53816650564b979)), closes [#155](https://github.com/the-inclusionist/the-inclusionist-engine/issues/155)
* **pesados:** a cartridge puts the heavy files into its delivery with `npx inclusionist-pesados` ([39f04b5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/39f04b5afb1be11a49bf22f39b212b6c9ca33bde)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173)
* **pesados:** the heavy files come from the delivery's own origin, never from a third party ([d02a6e5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d02a6e5e2a366b1ed725e0057453bf091c3b8ba6)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173) [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173)
* **pesados:** the voice's phonemizer comes from the delivery, and jsDelivr leaves the policy ([a28b115](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a28b115dceaff7c5e17a0821a655c649641f0daa)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173)
* **platform:** a camera frame loop that cannot stop in silence ([92678df](https://github.com/the-inclusionist/the-inclusionist-engine/commit/92678dfb79c5e9dbf29be6bc77a27081b97ecf95)), closes [#196](https://github.com/the-inclusionist/the-inclusionist-engine/issues/196)
* **platform:** hand the eye and brow line sets to whoever draws them ([c089c5d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c089c5d58a58084c3e8b3967bb2c132a74bc15e5)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **platform:** load the face landmarker and the camera from the game's origin ([a6675e6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a6675e69b1843cee39cc3417c4dccf2d809a448c)), closes [#196](https://github.com/the-inclusionist/the-inclusionist-engine/issues/196)
* **platform:** load the Gesture Recognizer the same way as the face ([98c0e36](https://github.com/the-inclusionist/the-inclusionist-engine/commit/98c0e3640f6e27de7beb82dd33fae49c11759ce3)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **platform:** the ambient water is asked of the game through roleAt ([9b5ecbd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9b5ecbd409dc33b47b1857aa6e5b7f6ecfdf010e))
* **platform:** the child reads aloud and the engine answers with text ([589d801](https://github.com/the-inclusionist/the-inclusionist-engine/commit/589d80177547f8c709aca4dc7a4a62c4fb02af74)), closes [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200) [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **platform:** the command recogniser opens from the delivery, or says what is missing ([211582a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/211582a6c4811dabd20e3114a82c269245dcc047)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **platform:** the engine's own Kokoro loader, from the delivery ([deec829](https://github.com/the-inclusionist/the-inclusionist-engine/commit/deec82979236f3ec3e0689f4918ce0b590cb9aa5)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **platform:** the last two third-party addresses join the mirror ([48a07e7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/48a07e721d924e922163b7cf8cc89ee0f46b22f3)), closes [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192)
* **platform:** the microphone that hears commands, and lets go ([3670302](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3670302505a0d9007f6f32e1ea975234409f0e65)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **platform:** the microphone, and the reading has both halves ([d23fe66](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d23fe66b89a0fd220d1479486476f7b7a5802593)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **platform:** the reading runs — sound in, the child's words out ([4a24ff2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4a24ff2861defc8c0b02e2f1bb7242ec38437a0e)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **platform:** the reading's arithmetic, measured against the originals ([8bcb64a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8bcb64a9f9fdeedfe6d4a760999ec7c0f4834615)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **platform:** the storage is a factory, and the root builds the page's store from the host ([2f030e1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2f030e15bcbcd36c84012300d711415b1e771fec)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **quiz:** options show their numbers and are read after the statement ([d662f52](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d662f52b496d798a2cd038e00a51fb5ba9b54864)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **quiz:** the child answers the quiz out loud ([5cff72f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5cff72fb05d7fd9509b444e621794708a3e4c457)), closes [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200) [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **quiz:** the demo fills the Kokoro port ([f8fa77d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f8fa77d445b0eca8e3e2a6e71e6afc930d0e0e9a)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181)
* **reading:** the transcription runs in a thread of its own ([f936436](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f93643699013fa14c1095edb30f2c70255cd922a)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **render:** high contrast ASKS which tile is there, and the engine stops importing tile geometry ([54dddc5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/54dddc587dab096626a50b2e9fbe9ce43fdc8553)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **scripts:** the closing criterion of ADR-0221 becomes a command ([9102580](https://github.com/the-inclusionist/the-inclusionist-engine/commit/910258032dfc2588443bc7b1fca1667dcc2c2651)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **scripts:** the language gate learns that a MEMBER is a name, and step 7h closes ([e44480f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e44480ff9223e35a4958452cb08c82bb6a97e331)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **scripts:** the language gate learns that a PARAMETER is a name ([0095700](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0095700bae4fa671699f8da14ca6c9a5993c4fa5)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **scripts:** the sixth measure is the worst FUNCTION, and its ceiling has a source ([5caa8de](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5caa8de74cc0ec9c8d4d42be49b749e6536e5659)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **security:** the page is cross-origin isolated ([e8a3bd6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e8a3bd691dacee3f1947c6cdee9839385aaea94b)), closes [#186](https://github.com/the-inclusionist/the-inclusionist-engine/issues/186)
* **speed:** the game speed is an hourglass on the quick bar, and the bar sits on the screen's edge ([d65f111](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d65f1110706364759ebce075c911f698ad98cd41)), closes [#176](https://github.com/the-inclusionist/the-inclusionist-engine/issues/176)
* **touch:** the on-screen pad only on request, out of the menus; the quiz gets a menu button ([5025be2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5025be2401d2e0c01732391a68ad9985286608b9)), closes [#touch-controls](https://github.com/the-inclusionist/the-inclusionist-engine/issues/touch-controls) [#159](https://github.com/the-inclusionist/the-inclusionist-engine/issues/159)
* **touch:** the shoulders L2 over L1 and R2 over R1 sit in the top corners of the virtual pad ([757392a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/757392a670b39e1c995f9c4a502d27ed7da08d5a)), closes [#154](https://github.com/the-inclusionist/the-inclusionist-engine/issues/154)
* **touch:** the virtual pad draws only what the game names, by action number ([7981f6c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7981f6c4f08a2e0c1e86ed9450f59a6675391391)), closes [#154](https://github.com/the-inclusionist/the-inclusionist-engine/issues/154)
* **touch:** the virtual pad is always the minimum, and it drives the menus ([254864b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/254864bc03546b5807c7d0b0c78cb00074d2838c)), closes [#151](https://github.com/the-inclusionist/the-inclusionist-engine/issues/151)
* **ui:** «Não precisa segurar» — the sticky keys, named and offered ([8c1ed04](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8c1ed044cd57dfb9372f8dceef24c0f1bedd77a5)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **ui:** a menu row is built, not demanded — and the motor panel builds the three it reaches ([67b7668](https://github.com/the-inclusionist/the-inclusionist-engine/commit/67b7668cabe7b4214ce866274ae7d73ad48cf397)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **ui:** a panel's words are resolved when it OPENS, not when it mounts ([218f315](https://github.com/the-inclusionist/the-inclusionist-engine/commit/218f31587be7ca876f4352675fcd156706db3663))
* **ui:** a small choice is one row — «◀ Rounded corners: small ▶» ([80c07ec](https://github.com/the-inclusionist/the-inclusionist-engine/commit/80c07ec9f93999dcff1e2d626876f141210eefaa)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** a step control ⯇ ⯈ for left/right choices, first used by the rounded corners ([55d717f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/55d717f78d9df4397058fc93aa4709f2733895f2)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** contrast enhancement is chosen in steps, and its explanation is born in the footer's hint ([48931a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/48931a8f3bb0a6ad2ae9ab69d02c4dbd35a1e082)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** draw the eye control's regions, words and eye lines over the game ([ee37285](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ee37285edf763fd366846ceb407990aef6be282a)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **ui:** Menu is the quick bar's first icon, and the icons touch ([4d651f0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4d651f04e417e2af608e1daf1da1eab462964909)), closes [#199](https://github.com/the-inclusionist/the-inclusionist-engine/issues/199)
* **ui:** playing with the camera, offered in the panel too ([f4ccb64](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f4ccb6403beaf6f85e53fb977518c2319744aea7)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182) [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182) [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **ui:** the 👀 on the quick bar cycles off, outlines and hatching ([1e24681](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1e24681ff71b54c5076bdc6437cfe6769f205c38)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **ui:** the accessibility bar is HUD — the engine declares its strip and SAYS when a game draws over it ([e28ca8d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e28ca8d292fd4580374dbe1525d48bcc6d62dc54))
* **ui:** the audio panel builds the fifteen nodes it reaches — the largest invisible contract of the eight ([80ef95d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/80ef95d95dd2166cad38ab63261c4b38da7aaf22)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **ui:** the BDA spacing stops being one face's exception and becomes the document's default ([6386175](https://github.com/the-inclusionist/the-inclusionist-engine/commit/63861751c27f827681afa7fe955a6cb15674075d))
* **ui:** the country's hand comes in 25% larger — and the ratio IS the legibility floor ([541d42c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/541d42c4d52c17b4a401377b1f8597dbaba1fb94))
* **ui:** the deaf person's icon is 🦻 ([96a7572](https://github.com/the-inclusionist/the-inclusionist-engine/commit/96a7572272e9787b6848de76444202e1fba7dc16)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **ui:** the ELEVENTH quick-bar button — one press changes the case AND the face ([690d3d3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/690d3d361d41d55335d686143c830925ec8ad2ff))
* **ui:** the engine has a HELP screen — which button does what, in this game, on this child's keyboard ([33cefc9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/33cefc99ab484a21eb24d6a7373141493390b08f)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **ui:** the engine mounts a settings panel, so the game writes none of the five lines ([6652522](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6652522df886c264e567bce1dd500b2555c92640))
* **ui:** the eye control's reading is readable on its drawing ([bde4814](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bde48143c009adc8d1cdfab9f8add26654f9920a)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **ui:** the hearing panel keeps accessibility, and a new Audio panel holds the sound ([07a1d0d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/07a1d0d09773898c7fe672adc483b702ca6e2b6f)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** the hearing panel stops offering the TTS engine, the voice and per-player audio output ([9ca032a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9ca032ae4453650e4aa1d84d81baf600f8d5a5e1)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** the inclusion settings lose Comunicação and Tipografia, and the submenu fits 640x360 ([e9bea8a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e9bea8ada6f287420eee7e384349f1f710dc8615)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** the language button, last on the quick bar, cycles three flags ([da1704b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/da1704be6c6f765d06b915badc095631b36f33ad))
* **ui:** the Okabe-Ito palette paints menus and HUD, and follows the colour correction ([0e2eeae](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0e2eeaeca4934fe8d8e111fa040101fbf0075492)), closes [#E69F00](https://github.com/the-inclusionist/the-inclusionist-engine/issues/E69F00) [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** the pause root is six items and SELECT opens the quick bar ([c296c84](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c296c84064c3b3f5a8e04429815506818049ab37)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** the recogniser stops choosing its language once ([573d9a6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/573d9a650d6e6e7dbc84f601ef09c2107294b4f5)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **ui:** the run latch gets the writer its sister already had, and the motor panel stops needing the game ([e67d675](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e67d675324c5a68b90deedb2b2fb56a98d5f35a4))
* **visual:** the captions switch is in the visual panel ([8d5fe15](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8d5fe1554a456622f9ef214400d4923541dd64f0)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **voice:** a spoken word presses the virtual controller, and the 👄 leaves construction ([760faad](https://github.com/the-inclusionist/the-inclusionist-engine/commit/760faade537e04581ec35e0f0130c77f6614fe1c)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#190](https://github.com/the-inclusionist/the-inclusionist-engine/issues/190)
* **voice:** Kokoro in the heavy-file catalogue; Amy speaks first in English ([2595bf2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2595bf2fbd2a62229991bd977d1616b201c37945)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181)
* **voice:** Kokoro speaks through the game's port, marked by quality ([1064e8c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1064e8c93446dcc6b07573ef455f4f10b2d0d38f)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181) [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181)
* **voice:** Piper leaves the engine; Kokoro is the only neural voice ([913051b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/913051b9cd15d20c01f6481e8be6b287f5d431ce)), closes [#193](https://github.com/the-inclusionist/the-inclusionist-engine/issues/193)
* **voice:** the browser's voice speaks first; Piper and Kokoro are the fallback (ADR-0200) ([ded6bcb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ded6bcb2969765b03da9076576fa8f1004154ded)), closes [#190](https://github.com/the-inclusionist/the-inclusionist-engine/issues/190)
* **voice:** the game asks for a neural voice; the engine loads it ([24cea10](https://github.com/the-inclusionist/the-inclusionist-engine/commit/24cea1070a4d28cb1be7c400db07e845d9cfcdd6)), closes [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **voice:** the Kokoro voices, in their pure half ([09b9492](https://github.com/the-inclusionist/the-inclusionist-engine/commit/09b94929c05718bc6cd2bc85b6b8ffaf3a0957f6)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181) [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181)
* **voice:** which recogniser hears the child — the browser only on the device (ADR-0200) ([42909e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/42909e25e0bbe526603c4a696a8a3520bf418d67)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184) [#190](https://github.com/the-inclusionist/the-inclusionist-engine/issues/190)

### Bug Fixes

* **a11y:** a switched-on icon and a marked option are not shown by colour alone ([04459bf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/04459bf1fb7b0ced94c09868efe93dbbc1e72325)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** no parentheses in icon names, and the bar check counts only what paints ([3f24a68](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3f24a68dd36d86f70a975cbdf57ef8bf09fc435c)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** pause item and panel Back glyphs are drawn out of the name ([5483155](https://github.com/the-inclusionist/the-inclusionist-engine/commit/54831552dc5672b7f4a579f697606e74552b017d)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** pause items have a 3:1 boundary, and menu contrast is gated ([b91430f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b91430f0fdaf244d8173d92bc56db06e2213129f)), closes [#3a4a6a](https://github.com/the-inclusionist/the-inclusionist-engine/issues/3a4a6a) [#0e1626](https://github.com/the-inclusionist/the-inclusionist-engine/issues/0e1626) [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** switch words and the motion master button carry no glyph ([ca0308e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ca0308ea500b556b9409eadf3781d128b61c85f4)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **a11y:** the scan's chip keeps its own room instead of taking the game's ([48a145f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/48a145fece42922cd57619fdcafab4287f61a030)), closes [#160](https://github.com/the-inclusionist/the-inclusionist-engine/issues/160) [#201](https://github.com/the-inclusionist/the-inclusionist-engine/issues/201)
* **audio:** the voice's normal speed is the slowest speech rate ([ed37200](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ed372001bb5eaf2fdaaf410a68aa541338d5bd57)), closes [#179](https://github.com/the-inclusionist/the-inclusionist-engine/issues/179)
* **boot:** a disposed root lets go of the state bus and of what it started ([5fc254b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5fc254b02188db6fe7dac3fc82a154502cac8cfa)), closes [#sr-alert](https://github.com/the-inclusionist/the-inclusionist-engine/issues/sr-alert)
* **boot:** a root now has an end — `dispose()` stops it listening ([6193f91](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6193f9145d0030b30d76b7f60301478125ca6068)), closes [#201](https://github.com/the-inclusionist/the-inclusionist-engine/issues/201)
* **boot:** Escape closes the controller-mapping panel ([2e30243](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2e3024387945a23286046e2affcd29b55e9bf00f)), closes [#padwiz-](https://github.com/the-inclusionist/the-inclusionist-engine/issues/padwiz-)
* **boot:** every line of problems is English and says the child's cost ([55eb3a4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/55eb3a4ccc89bbeeb4b5567e526d03e395308a03)), closes [#163](https://github.com/the-inclusionist/the-inclusionist-engine/issues/163)
* **boot:** mount() without hooks is refused by ADR-0153, not a TypeError ([79042b1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79042b1591d674024265fd1296f082442fda6b12))
* **boot:** one set of scene reduced-motion flags for the quick bar and the motion panel ([b729ab3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b729ab336d3fd4150a57415429214906a45ebdcf)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **boot:** the quick bar reads the same players as the keyboard, so its cycles move in a game with no players ([4199e1a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4199e1a5d690edd24979897531c5e158dcbf7c79)), closes [#147](https://github.com/the-inclusionist/the-inclusionist-engine/issues/147)
* **boot:** the room under the quick bar counts the icon name and a gap ([4f111ec](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4f111ec01a71b2f12d7b3a4d9ac1274d7e691a08)), closes [#160](https://github.com/the-inclusionist/the-inclusionist-engine/issues/160)
* **ci:** the precache gate asks the worker instead of assuming a fallback ([8355e0a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8355e0a4c7a999cff6f05e8272052e1ab487548b)), closes [#73](https://github.com/the-inclusionist/the-inclusionist-engine/issues/73) [#73](https://github.com/the-inclusionist/the-inclusionist-engine/issues/73) [#73](https://github.com/the-inclusionist/the-inclusionist-engine/issues/73)
* **code-health:** the ceiling moves only when someone re-measures and says so ([f781b9f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f781b9f32db3488cf394a19831a7d261e36537e3))
* **contract:** the mapping refusals show the signature in the contract's own names ([37a56fd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/37a56fd1f4e8d91afc8701dc73860f74a31ee910))
* **core:** the stored wait between presses survives a reload ([d2d9863](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d2d98633b58e3b508ef0fb79b869e99b4d636308))
* **csp:** the policy names only what a library on the page requests ([e85f32e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e85f32e6b7fab80b4773fd36178f73319b4b1c6c)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173) [#170](https://github.com/the-inclusionist/the-inclusionist-engine/issues/170)
* **css:** no text under 16 px at 640x360, and none sized in rem ([2d3e24d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2d3e24dd7db8d830aceb592b4fcc1a90471a8383)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **css:** PAUSED is only the word — white letters with a black outline, no box ([a55f5e0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a55f5e039a1afebd6677a58646eaf21ce7f08164)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **css:** the menus' width grows with their text on larger screens ([8763cce](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8763cce2a95bb00e3f722ede8bbd6dcdc1db1aea))
* **delivery:** the fonts are immutable, the index of them is not ([620cc6b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/620cc6b3947aaaceceeb5b62ab69586582208770)), closes [#73](https://github.com/the-inclusionist/the-inclusionist-engine/issues/73)
* **delivery:** the graph runtime belongs to whoever needs a graph, not to the voice ([b6fde2e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6fde2e343e3e3e27930ae00671967941a0070a9)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185) [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **empathy:** a disability simulation runs in the game, never in a menu ([f04b55c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f04b55c27b2fa0c9ed1c5f2ff9f6c5a6c9b42968)), closes [#182](https://github.com/the-inclusionist/the-inclusionist-engine/issues/182)
* **empathy:** the seven simulations are one list, not seven buttons ([7b5d80f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7b5d80f80b028c33639a506ffa53707a9ea1d6fb)), closes [#153](https://github.com/the-inclusionist/the-inclusionist-engine/issues/153)
* **footer:** panel explanations at the screen's bottom; the button legend without a band ([d8f2426](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d8f24269a53b96258ea85fe6eb9e4ef465e592d0)), closes [#157](https://github.com/the-inclusionist/the-inclusionist-engine/issues/157)
* **footer:** two lines at most, at the bottom of the screen, over a dark band ([5034980](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5034980432fde537ccde4fdac46b7b5ea8ee1f9d)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156) [#157](https://github.com/the-inclusionist/the-inclusionist-engine/issues/157)
* **health:** fan-out and statefulEdges read every import form through the shared parser ([2d3c04d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2d3c04d95012e520abdcadc7afff2efbe6dcef89))
* **hud:** the bars leave while the explanation shows, and round numbers share a line ([84360fc](https://github.com/the-inclusionist/the-inclusionist-engine/commit/84360fc7b873905466722456bd363fb0222c7076)), closes [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162) [#162](https://github.com/the-inclusionist/the-inclusionist-engine/issues/162)
* **i18n:** a refused dictionary entry is reported in English ([45e9119](https://github.com/the-inclusionist/the-inclusionist-engine/commit/45e911970cb1f1ffb9a901e4805487bf0a7de191))
* **i18n:** the flag changed the engine's frame and left the ACTIVITY in Portuguese ([08e9860](https://github.com/the-inclusionist/the-inclusionist-engine/commit/08e9860584f41a8b0ac411f91eca6651ceca6fd3)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **i18n:** the panel footer's resting text was a raw Portuguese literal, and four panels just made it visible ([9e30292](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9e30292d283bf64666041a9fc12e7fc1b742f498))
* **i18n:** the two raw «Jogador N» left in engine modules — and the sieve that could not see either of them ([892351b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/892351bf45ce8a9320e08507047e81a5c7b8bbab))
* **i18n:** two keys reached the child as identifiers, and now a gate says so ([f2c544a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f2c544a245e4d45f027a130fbd52ba40bd398312)), closes [#164](https://github.com/the-inclusionist/the-inclusionist-engine/issues/164)
* **input:** a failed hand detection was pressing a button ([b7b7c70](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b7b7c70c1cad54b3051070aecb84cc88ae70216f)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **input:** losing focus lets go of what the keyboard holds ([679add7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/679add784974256e14eda69d28d50912d9c9f2ed))
* **input:** read the face from its rest; the eyes wait while the head moves ([c966797](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c966797eee282a33a40d7ebbafec32f0f9d4dbd1)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **input:** the look is one vertical axis from rest, so a weak look up is up ([59402a7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/59402a7d69f266e49960fcefeefe4ed5c21c5679)), closes [#189](https://github.com/the-inclusionist/the-inclusionist-engine/issues/189)
* **language-gate:** `padrao` was filed as English, and it hid three members ([6386537](https://github.com/the-inclusionist/the-inclusionist-engine/commit/63865376c24bbc1bfd99f37d93e9185401c85155)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **language-gate:** fifteen Portuguese words were filed as English ([4a0a270](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4a0a2707237c8919c3c2bfd784296ad6a9559674)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **language:** a word joined by an apostrophe counts for neither language ([ece6ff0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ece6ff077a13174915349791bb159699f6e64b23))
* **language:** note names are not Portuguese, and a quotation of the Dev spans `//` lines ([6f98a89](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6f98a89d72d52b551b7f1029589359aeae9a28da))
* **language:** the comment gate reads comments with the parser, and sees 5 414 more lines ([c647f0a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c647f0afbb9b855c471cb81a4145792ec1df34c6))
* **language:** the high-contrast guard and the licence stamp speak English ([a717171](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a717171c792c6fcd951d1dd8024c7316533a90e3))
* **layout:** on a fractional display scale the scale never goes under 2 CSS px (ADR-0179) ([e038a18](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e038a18d09def7addbe6d9d31165cdc3040b53ba)), closes [#175](https://github.com/the-inclusionist/the-inclusionist-engine/issues/175)
* **layout:** one target ruler — `--tap` no longer falls under 44 px when the scale is under 2 ([e143dd9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e143dd9c82e8d55187b0848c6a07d62662267824))
* **layout:** text in the game region grows with the scale the engine forces ([afdae7e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/afdae7ed0e61657975396046aa87dd785db78df2)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **letter-case:** the communication button's capital position shows capitals ([c7f8896](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c7f8896c702075b668f0f8006f85f25760933544))
* **motora:** the pad size row is offered only to a cartridge that has a pad ([e7aa5ee](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e7aa5ee82777801678bc4b28aed1756e1c064473)), closes [#159](https://github.com/the-inclusionist/the-inclusionist-engine/issues/159)
* **panels:** a settings panel wears the pause card ([d5b4c10](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d5b4c107f3c37570a8d0be0eba3704d14e363328)), closes [#0e1626](https://github.com/the-inclusionist/the-inclusionist-engine/issues/0e1626) [#0e1326](https://github.com/the-inclusionist/the-inclusionist-engine/issues/0e1326)
* **panels:** row labels carry no explanation in parentheses ([5196de7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5196de7f5608e6e8e9b03725c725dc820b14f978)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **panels:** the engine does not describe one game's sounds and animations ([ab7ffa7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ab7ffa70a47078cc30ed67f6588f9b694200d99c)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **pause:** every menu card holds the whole height ([36ca8d6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/36ca8d6af5fae86260767fcc5cbb61be080ad544))
* **pause:** opening the card puts the cursor on item 1 of the root ([ce38ed3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ce38ed3c1576dfd26796bcd96513c23f94311f70))
* **pause:** the cursor never lands on a hidden item of the pause card ([b3db875](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b3db8758426a6266f246b850859059f04557ea52))
* **pesados:** Kokoro's 327 MB only for a game with the Kokoro port ([2ed1bf7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2ed1bf7f8bc4e8d5db7d1094d1d3012a1af5dfeb)), closes [#181](https://github.com/the-inclusionist/the-inclusionist-engine/issues/181)
* **pesados:** the voice runtime leaves the download catalogue ([35dea11](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35dea1136a32fcea06d0dc417915f387e0a6e0ea)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173)
* **pkg:** build:pkg empties dist-pkg first, so a removed module is not published ([8407322](https://github.com/the-inclusionist/the-inclusionist-engine/commit/84073221e3bb158806e590a0c5805e223e13f650)), closes [#171](https://github.com/the-inclusionist/the-inclusionist-engine/issues/171)
* **platform:** a parameter named like a platformer action ([ced46d7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ced46d785da840f63164bb4e4e3beb5006084f9b)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **platform:** a released listener scope listens to nothing more ([d4e8ce8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d4e8ce8634dba51af72c6f2829f28ec054e9fb75))
* **platform:** espeak-ng goes back to upstream, because the mirror answers 404 for it ([7bef8a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7bef8a8c454141dcbb67e209c84bd5c188e7ed23)), closes [#192](https://github.com/the-inclusionist/the-inclusionist-engine/issues/192)
* **platform:** heavy downloads are checked by sha256 before they are kept ([7dfb335](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7dfb3352016e6ab7df20f50cc454926c59405437)), closes [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168) [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168) [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168)
* **platform:** the reading thread's opening has an owner, and the suite's exit code stops lying ([b997d64](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b997d645916a834b0abf2236a8e0c4183e9f6b7c)), closes [#185](https://github.com/the-inclusionist/the-inclusionist-engine/issues/185)
* **privacy:** a recorded voice cannot enter the tree by accident ([62fffa1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/62fffa1bae0ae55708c3b982ac652f4de45a1f19))
* **pwa:** a page's precache revision carries the headers ([4822c8c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4822c8cb7d96057572dc9956b870b92be64ba34f)), closes [#186](https://github.com/the-inclusionist/the-inclusionist-engine/issues/186)
* **pwa:** the service worker registers its runtime routes again ([e56554a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e56554a3665d36a94b493ffa6b81960c61522673)), closes [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168) [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173) [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173) [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168)
* **quick-bar:** a click writes the icon's name, not the spoken «N de M» ([051707d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/051707dfef25d4acee58470af5a491e09629ea76)), closes [#161](https://github.com/the-inclusionist/the-inclusionist-engine/issues/161)
* **quiz:** an answer said aloud is compared with the options' words, not their keys ([3910bb8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3910bb87c9307f6fb2683d9db84d42ef9f424b30)), closes [#200](https://github.com/the-inclusionist/the-inclusionist-engine/issues/200)
* **quiz:** hear the virtual controller, not the keyboard; the sonar on R1 ([0cc20ac](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0cc20acc8b9255e5463fb21f900f92f68a972245)), closes [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197) [#197](https://github.com/the-inclusionist/the-inclusionist-engine/issues/197)
* **quiz:** its sentences come from the dictionary, drawn in the boot language ([f2bf7a1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f2bf7a1b0e5df412e2bcf184d7e4f576ccb20428))
* **quiz:** options take the engine's target and fit 640x360 above the footer ([0972387](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0972387901444541f671bf3cae13353e43a69e6c)), closes [#156](https://github.com/the-inclusionist/the-inclusionist-engine/issues/156)
* **quiz:** read positions, not keys, so the eyes can move and confirm ([0075e9f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0075e9fcddd88afb4bd36ed4c6f9ea75cd9ead23)), closes [#194](https://github.com/the-inclusionist/the-inclusionist-engine/issues/194)
* **quiz:** the page title and the install description say what the demo is ([0f8365f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0f8365fc8fd1d12698810672ae5b1a4a6290490a))
* **quiz:** the selected option's mark is a ring, so its fill sits centred ([0a90d6e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0a90d6e3b13fd02c3cb8d519daece77c670b78a0)), closes [#166](https://github.com/the-inclusionist/the-inclusionist-engine/issues/166)
* **quiz:** the statement starts below the quick bar, and the footer zone holds no controls ([cd3e0c1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cd3e0c19c1a6aba861a0f1a3c1febc08f3d388e4)), closes [#152](https://github.com/the-inclusionist/the-inclusionist-engine/issues/152)
* **scripts:** give the taxonomy back its `Desenho / Criativo` category key ([66a46a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/66a46a8f9d754a16476ef1f0cb7c89760cb42453))
* **scripts:** the accommodations study names holdsKeys and counts three built accommodations ([faf58f6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/faf58f693a11ab74f5af24abd76b6f29e3cc7287))
* **scripts:** the language gate asks the parser, and sees a file before it is tracked ([c480fb7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c480fb7f6e854133b08e0b9268b3ad8ce73088bb)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **strings:** prose the member rename turned into identifiers, written in English ([5c37709](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5c377090ac9b14b76b827e38bfff32e43790caf7))
* **tooling:** the portrait of the public surface sees every name a line publishes ([8da217b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8da217bfd3ee2c28f7f48e7405d9219d365f85d4)), closes [#164](https://github.com/the-inclusionist/the-inclusionist-engine/issues/164)
* **touch:** a pad button's face shows its name, and the game's word is its function ([32a1348](https://github.com/the-inclusionist/the-inclusionist-engine/commit/32a1348c130ba3f536b08759b0cb1c387707aa50)), closes [#158](https://github.com/the-inclusionist/the-inclusionist-engine/issues/158)
* **touch:** switching to the keyboard inside a menu hides the virtual pad ([9b9ce70](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9b9ce70f7bb3d8baa77990c7dfe22d3cfb5fdb8d))
* **tts:** onnxruntime runs the wasm the game bundled, not cdnjs 1.18.0 ([c708d3b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c708d3bb13aa6fa086a02755f33a9ed17ae83095)), closes [#173](https://github.com/the-inclusionist/the-inclusionist-engine/issues/173)
* **types:** drop the dead espeak-ng module declaration that skipLibCheck hid ([12b0372](https://github.com/the-inclusionist/the-inclusionist-engine/commit/12b0372979288dd5946a5f5e6af73349c961403d))
* **typography:** a face with a 20 px floor enlarges its own text, not the document ([0223db1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0223db1fba1740f07aba3da3ea55fe255271f92f)), closes [#172](https://github.com/the-inclusionist/the-inclusionist-engine/issues/172)
* **typography:** the BDA spacing reaches the text inside controls ([d7160fe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d7160fe32c6b306f0ec4acf9a88c22e785b8e343)), closes [#187](https://github.com/the-inclusionist/the-inclusionist-engine/issues/187)
* **ui:** a missing command model names its language and the --commands fix ([555735b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/555735bfa8b62b484f2f56fa881bcb2a3bc784da))
* **ui:** a panel's INTERIOR retranslates too — the frame was fixed and the rows were left behind ([ba28f6a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ba28f6a564a39172c942570b38f1f807740c9aaf))
* **ui:** a row of the motion panel stops taking the focus off the row beside it ([e537809](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e537809c3566f91966b00124c25a06f329ffa1de)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** a step row is the item — no box inside the box, and its hint reaches the footer ([4a877ef](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4a877efca14f12517f0271dba8101b3ae01f3e13)), closes [#148](https://github.com/the-inclusionist/the-inclusionist-engine/issues/148)
* **ui:** a voice start that fails after it was turned off stays silent ([25ef063](https://github.com/the-inclusionist/the-inclusionist-engine/commit/25ef0632b265051ab0839fe4289ce3ca962b43c5))
* **ui:** an explanation follows the language, like every other word the engine draws ([46a2676](https://github.com/the-inclusionist/the-inclusionist-engine/commit/46a2676124fd936c26f2f6dfcf7e8f1d98dd28ab)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** each arrow key shows ITS arrow, not a machine name ([4d03a32](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4d03a321e2f3cf41fa7ced5019ce4dbb6df08a60))
* **ui:** stopping every animation stopped being a one-way door for a game with no players ([f96354d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f96354d1c0ff03c8690b58bc5cd6259730f81db9))
* **ui:** the pause card ANNOUNCES itself in the boot language — only the child who listens was losing ([dc037ba](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dc037baa60665110cd51874f3c321a3e4a59aee7))
* **ui:** the pause card's first item says «Voltar», like every other level ([6d918c8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6d918c8e39e5ff9b590c2079b024f90209c51a69))
* **ui:** the visual panel's last two Portuguese sentences go through the dictionary ([14524de](https://github.com/the-inclusionist/the-inclusionist-engine/commit/14524ded6f780fd62ea6736246d80a8c36402936)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **visual:** the caption rate's explanation lives in the footer, and the rate reads «125 PPM» ([48c4b1f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/48c4b1f9c84f8f78751ecd9dc6db3281a51da5aa)), closes [#179](https://github.com/the-inclusionist/the-inclusionist-engine/issues/179) [#183](https://github.com/the-inclusionist/the-inclusionist-engine/issues/183)
* **voice:** three defects the browser found, and the double that could not see them ([4c2ad27](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4c2ad27efb13ad4ecead37c9b110410cea260701)), closes [#184](https://github.com/the-inclusionist/the-inclusionist-engine/issues/184)
* **webcam:** WebGazer runs from the checked cache, never fetched on first use ([b8ba748](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b8ba748284d501b8e3278551386f4369d639632d)), closes [#169](https://github.com/the-inclusionist/the-inclusionist-engine/issues/169) [#168](https://github.com/the-inclusionist/the-inclusionist-engine/issues/168) [#169](https://github.com/the-inclusionist/the-inclusionist-engine/issues/169) [#169](https://github.com/the-inclusionist/the-inclusionist-engine/issues/169)

### Performance Improvements

* **scripts:** the shared specifier parser skips the work no entry used ([a9ac267](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a9ac26766f48a99d3125a9933856b9871bc1590a))

### Documentation

* **architecture:** the map stops being an inventory and says where to go ([69052a1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/69052a12479d4c94ce491ffef908a1f5a00d3f34))

### Code Refactoring

* **boot:** published members speak English — phase 7 ends with the contract ([28f1499](https://github.com/the-inclusionist/the-inclusionist-engine/commit/28f1499a37be5b68a4a2c4287998faa2187e98de)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **camera:** WebGazer leaves the engine ([ed2181b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ed2181b7fcd8c3d5976693dfc8e5616afb6f879c)), closes [#198](https://github.com/the-inclusionist/the-inclusionist-engine/issues/198)
* **core,ui:** the page-wide selectors leave, and no module outside the root reaches a global (ADR-0232 D4) ([6f91dd4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6f91dd4cf990b320ff847d2e7ec626fa9f1f3e9d)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** `core/i18n` stops reaching the browser, and the page arrives through the port ([2a5e1b7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2a5e1b7ddc36e4213789a51f98de95d92e14a7e0)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **core:** core/rng holds no stream of its own ([e26e93a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e26e93acea09ddbd41d967b1f053f2e8958bee4c)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** published members speak English — phase 7, the core layer ([b3f507d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b3f507d57fe6062b2bcac4dec1a44c64ba8bd3bd)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **core:** the announcer and deaf mode are factories each root builds ([8575640](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8575640302c967bc899a5ea0db54d6c1727b3de0)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** the FILE names speak English too — `core` (phase 3) ([20d2b03](https://github.com/the-inclusionist/the-inclusionist-engine/commit/20d2b0354b0036d818dbb3aa71742122e08f7d79)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **core:** the loop takes the game speed through a required port ([64a5281](https://github.com/the-inclusionist/the-inclusionist-engine/commit/64a5281c939e4c3e0f4b0b6048092a53dd31c45a)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** the loop's crash notice is passed, never registered ([33175be](https://github.com/the-inclusionist/the-inclusionist-engine/commit/33175be7c5d6927108227b1deeaa73e0b558f3b9)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** the public surface of `core` speaks English ([55cd728](https://github.com/the-inclusionist/the-inclusionist-engine/commit/55cd728cb8189ec360ffbb24c83bfcfe5be4102f)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **core:** the pure names leave the settings store and the storage (ADR-0232 D2a) ([e59e579](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e59e579ff68f3c3da6549fee1e2d0140113822f9)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **core:** the root loads the stored settings, and a write before the load throws ([61ed77f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/61ed77fe0e59a03acee7e05607284b59695a0d76)), closes [#174](https://github.com/the-inclusionist/the-inclusionist-engine/issues/174) [#167](https://github.com/the-inclusionist/the-inclusionist-engine/issues/167) [#167](https://github.com/the-inclusionist/the-inclusionist-engine/issues/167) [#174](https://github.com/the-inclusionist/the-inclusionist-engine/issues/174)
* **core:** the settings store becomes a factory the root builds, and games read it as Engine.settings ([881b445](https://github.com/the-inclusionist/the-inclusionist-engine/commit/881b445083602504c526a3e08241c9fdfcd65cf5)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **delivery:** the heavy folder is `heavy/` and the command is `inclusionist-heavy` ([9f9068b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9f9068b0fac9a98ff23d6e32b49dc29feef1a4ef)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **engine:** the last three layers — the public surface speaks English ([d20a54a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d20a54a7a4de9f2919348e4d7e4e146ab8a7f09d)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **input:** published members speak English — phase 7, the input layer ([a62cc21](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a62cc21f001c14fc23e286011bb38921ba300571)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **input:** the FILE names speak English too — `input` (phase 3) ([79dee3f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79dee3f8ff3d991495b08693a0aefaa2c685d4d1)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **input:** the gamepad asks the root whether one-button mode is on ([85d72d5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/85d72d5382e91a8236b05ffecf6f62d7f52b31ab)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#120](https://github.com/the-inclusionist/the-inclusionist-engine/issues/120) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **input:** the gamepad, the keydown, the pad wizard and the touch pad receive the root's t ([0af8320](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0af832036d458ccb772b2cbc0d15fd756ec64d41)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **input:** the input state, keyboard config, pad tables and pad maps become factories the root builds ([d1f09e3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d1f09e32c77795d39f47c77382e3aaa3da0e4014)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **input:** the keyboard, the latch and the pad maps receive the store ([b74b3f2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b74b3f2deff59586ae41bb9fb1d580f21bf301b1)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **input:** the mapping wizard's demonstration is the game's to draw ([a96f748](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a96f7480ace18f81357e2f20681c44b15805b5c1)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **input:** the old camera readers leave; the face and hands read by the Dev's map ([b710fec](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b710feccb756be0476904a29d465eb22d885137c)), closes [#191](https://github.com/the-inclusionist/the-inclusionist-engine/issues/191)
* **input:** the public surface of `input` speaks English ([dac3ce7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dac3ce7be9d34eac73358f9380cfd09616c186e1)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **input:** what a gamepad is DOING becomes its own module ([3205cd7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3205cd78d84c6c26efbaf020773f530aeccb992b)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **platform,ui:** the audio becomes createAudio, one per root, and Engine gains audio ([d8147ee](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d8147ee8c1d650f2377d3c398e203351922d288f)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** published members speak English — phase 7, the platform layer ([ee09d32](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ee09d32bba02037db4d654b238927c70fae35851)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **platform:** the audio mixer and the narration receive the store ([2835f3c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2835f3c2df6f05cf3e5a1b7e28ae3e87347994f3)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the cane and the blind swim leave — platform/audio-nav ([a303c3d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a303c3da5932cf13edc7bc1181eaee3d025b1bed)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **platform:** the command recogniser receives the cache, the bundle loader and the microphone ([b28c7aa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b28c7aa146cc395a343f03782ef1471c58e8b544)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the earcons and the sonar receive the root's t, and narration its translator ([d88371b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d88371b69bf2e26fa8cc3e3fe0f5d7ea59a680c6)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the FILE names speak English too — `platform` (phase 3) ([2e6da3b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2e6da3b65ebffeb750913bc0ece5cfe770f9856b)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **platform:** the heavy files and the vision loaders receive the host's cache, fetch and hash ([412d7e6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/412d7e67ecb244b060880b5dcf6eefe22f5f40a6)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the public surface of `platform` speaks English ([37b9cd4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/37b9cd4fe9fb309b562d0996519a69ce59a1fd33)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **platform:** the reading receives its worker, fetch, microphone and clock; the worker literal moves into the root ([f58c245](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f58c2453dc601fe254a23f02b0062199892716b7)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the storage publishes the factory only — the page-wide functions and the KEYS alias leave ([a8b3d4a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a8b3d4a53a706aa2b3ee8a32a481cc36cbf5cb1d)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **platform:** the voice receives the browser's speech, clock, audio element and Kokoro loader from the root ([6569dcb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6569dcbfb7dda4447c7b576876e0936f47f07e35)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **render,ui:** the CRT, the L->Q enhancement and the layout become factories, and Engine gains crt and lq ([4b94ebe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4b94ebec6d4bcb49f61afc2108b9e4a1c916730a))
* **render,ui:** the FILE names speak English — the ten modules are done (phase 3) ([4281d9e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4281d9e6592a25c25d52ad5833451708afbb57cf)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **render:** canvas makers take the document, and high contrast becomes createHighContrast ([9a234e6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9a234e6cb80860e1111831b80c776105ae906e2f))
* **render:** published members speak English — phase 7, the render layer ([f092a15](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f092a15247d44e5f255614759677d0623850ba8f)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **render:** the CRT, the enhancement, the role colours and the visual state receive the store ([89bbea6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/89bbea6f5ea157bfbea72e9ed332c708e07a77a6)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **render:** the public surface of `render` speaks English ([b5f72f0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b5f72f04e11ec80bca11afaefc8aaefe5b250dcb)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **render:** the viz setters receive the blind-mode and legacy-mode writers ([e648281](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e6482810786d9b160787fbfc51e786f84e879375)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **render:** the viz setters receive the root's t, and their group builder takes it ([5353d0c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5353d0cc8eb47e49d5990e0a041f8f211796a6e8)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* sixteen names that nothing here reads stop being published ([e2f335c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e2f335ca7cf2d64fc51b18cc6391a943634ee9e2)), closes [#164](https://github.com/the-inclusionist/the-inclusionist-engine/issues/164)
* **surface:** eight names nothing reads stop being published ([af04adf](https://github.com/the-inclusionist/the-inclusionist-engine/commit/af04adf352ef7e85d1b2d3eb7b7494255eb7d559)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **surface:** five published names the word list hid speak English ([7fe2dc0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7fe2dc04bb5580511f41bdc4bc4da68312820812)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* the platformer's title menu and 161 of its sentences leave the engine ([371017d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/371017d6916ec011e776a3c744e0c22ae55d764d)), closes [#171](https://github.com/the-inclusionist/the-inclusionist-engine/issues/171) [#171](https://github.com/the-inclusionist/the-inclusionist-engine/issues/171)
* **touch:** padKind leaves — a published name nothing reads, and the module's one global ([03b0698](https://github.com/the-inclusionist/the-inclusionist-engine/commit/03b069878652edef1fa5d61f67a7483d1f2bd048)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** a mounted panel hears the language through the root's door ([674d3c6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/674d3c69540de1395815f6f710b8020435fec93d)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** ControlRow.controle becomes control, and the exclusion that called it pending leaves ([f7daef1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f7daef1fba4f50f3dbc236576bbd2b06b4273548)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **ui:** published members speak English — phase 7, the ui layer ([15a452a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/15a452a9f3acc0e87f23420241f3509241456c72)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **ui:** sensory comfort leaves the icon module, and the ratchet learns what an extraction costs ([4c575e4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4c575e4bdf78ffad9dafa806d0ac8113de70c237)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the audio panel's pure half leaves, and the suite had already drawn the line ([3039d1a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3039d1a7131d4abb73151faeb8d729514cd6f8af)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the CAA panel builds nodes, and the section header joins the kit ([075d510](https://github.com/the-inclusionist/the-inclusionist-engine/commit/075d510dbfe7c68f1201daad116b4f93dcb0e19a)), closes [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135)
* **ui:** the camera, voice, crash-notice and simulation-list ctx receive the root's t ([7d0c3e3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7d0c3e38a44052b044ed32ed74bc45f748926400)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the debug panel receives its document, query string and exposure ([ea5987c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ea5987cf4b18bd1b622172fb67b2dadbcd3c7c2f)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the font menu builds nodes, and the kit learns that a choice is not a toggle ([7f104c8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7f104c872177712924f38df70307d5467c30d157)), closes [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135)
* **ui:** the four ways of playing with the body get a family name ([bde6471](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bde64712962616aca1b40f11289e4e04de3380ca)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the hearing panel builds NODES — the last panel outside the kit ([8664619](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8664619cc991b7f7a7f7771c6588a4e23b28f24c)), closes [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203) [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **ui:** the hud, the shell, the gaze overlay and deaf mode take the root's t ([4e9bf0c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4e9bf0c55bd860ce249f1919e68974c4c998b140)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the icon catalogue leaves the icon module, and the ratchet learns what DATA costs ([c7af7a4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c7af7a46098ae5bf28e9b956f588c7ab190849d1)), closes [#205](https://github.com/the-inclusionist/the-inclusionist-engine/issues/205) [#204](https://github.com/the-inclusionist/the-inclusionist-engine/issues/204) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the markup leaves the icon module, and two published names stop being published ([bd9562d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bd9562db57a0411eec676732c20618137abe086e)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the mobility panel's pure half moves to ui/mobility-choices ([be04d40](https://github.com/the-inclusionist/the-inclusionist-engine/commit/be04d401533472c09d384fa1a1cf464faa98da87)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the motion panel builds NODES, and two markup sinks leave the census ([cd42f80](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cd42f80caf76320dbde603a1a526413455a3a374)), closes [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the pause bar and its markup read and set the language through the root's translator ([6388f43](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6388f43b3550988689f7328ff78623f39305bbca)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the pause icons build in the document they are given ([b384217](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b384217601bb14d21596f923e88825e50235c1f6)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the Portuguese acronym CAA becomes AAC in names, a member, two paths and the i18n keys ([13e9982](https://github.com/the-inclusionist/the-inclusionist-engine/commit/13e9982ed2bd70d75b5b31ca5c1bb590b3d9f9b5)), closes [#206](https://github.com/the-inclusionist/the-inclusionist-engine/issues/206)
* **ui:** the public surface of `ui` speaks English ([35a91b9](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35a91b9ab7d7d1146cd1f7af3a79f04380b399e9)), closes [#202](https://github.com/the-inclusionist/the-inclusionist-engine/issues/202)
* **ui:** the quick bar and the hearing panel receive the settings store, and the panel's subscription ends with dispose() ([9bd4b8d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9bd4b8da696a177b0364a42c30c47f6f4654bd90)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the remapping panel shows the KEY on the button, and the kit adoption closes ([964daa3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/964daa3df5baf13a680e442c160bb6327827ec6c)), closes [#125](https://github.com/the-inclusionist/the-inclusionist-engine/issues/125) [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135)
* **ui:** the scene flags, the quick bar, the motion panel and deaf mode receive the store ([8d219c0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8d219c02a1ebb6db0a024535be093071df20ec72)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the settings panels receive the root's t, and the hearing panel its translator ([bcd3ebc](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bcd3ebcb9af69eab9e02d0dd575acba453cb80b3)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the two visual cycles leave the panel and the icon, and one dead name is paid ([bcd5d77](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bcd5d779eac90bb05df1875816db7802055770f0)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the ui helpers that translate take t as a parameter, and the menu reading receives it ([827698a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/827698a266467a67a74fb1be1437f68321b766b4)), closes [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207) [#207](https://github.com/the-inclusionist/the-inclusionist-engine/issues/207)
* **ui:** the visual panel builds NODES, and one markup sink leaves the census ([abef154](https://github.com/the-inclusionist/the-inclusionist-engine/commit/abef15453191a48d9e70dfd992cff22166dec96f)), closes [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** the voice section leaves the hearing panel, and takes the browser as four ports ([fc55157](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fc55157d82c309819a30f39cb229d87326ffc222)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** what a KEY is, and whose it already is, moves out of the panel that draws it ([6b040b5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6b040b56650198a4e2dd9b18bd00f065c711202c)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** what a key means in a menu moves to ui/menu-intent ([4974c2a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4974c2ab39dd493654c3b476d0dae7b6f5faab0a)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** what a movement choice IS leaves the panel that draws it ([8a80773](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8a807730e9efaacd4285d2a0a43d0bc93e957c89)), closes [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203) [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135)
* **ui:** what a typography CHOICE is moves out of the panel that draws it ([8306e6c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8306e6cf300dc73d10c479668fbebdeac7e03388)), closes [#204](https://github.com/the-inclusionist/the-inclusionist-engine/issues/204) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203)
* **ui:** what a visual choice IS leaves the panel that draws it ([5be4def](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5be4def9e491776dc9b533349943bff8fe82710a)), closes [#204](https://github.com/the-inclusionist/the-inclusionist-engine/issues/204) [#203](https://github.com/the-inclusionist/the-inclusionist-engine/issues/203) [#135](https://github.com/the-inclusionist/the-inclusionist-engine/issues/135)

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
