// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/create-game — THE BOUNDARY TEST OF ADR-0027 (step 4), written instead of argued.
//
// ========================= THE QUESTION THIS FILE EXISTS TO ANSWER =========================
// ADR-0027 set a verdict and did not leave it vague: if `createGame()` could not be written without a parameter
// called `coinTarget`, the boundary that record proposed was wrong, and its steps 5 to 7 could not begin.
//
// It can. There is no `coinTarget` here, and not out of discipline: ADR-0030 settled where the target comes from —
// field 5 of the contract (`objectiveOf`). The HUD that asked for a coin count asks the game how many of how many, and
// the coin stops being an engine word. `tests/boot-create-game.node.test.js` holds this.
//
// ========================= WHAT THIS IS: THE ORDER =========================
// Not a framework. It is the sequence that switches the engine on, which every consumer would otherwise rewrite by
// hand — and the second consumer measured the price of rewriting it (`consumer-quiz`, findings 3, 6 and 12):
//
//  · FINDING 3 — the mixer MUST be loaded before `createTts`, or `audioCat` is null and `narrate` gives up
//    SILENTLY. An order dependency no type declared, found by the silence. Here it cannot be got wrong: `createAudio`
//    loads the mixer as it is built, and the voice is built after it.
//  · FINDING 6 — the panels need fixed ids in the document and, when they are missing, OPEN EMPTY, with no error.
//    Here the engine builds its panels, and what the page lacks becomes `problems`, a list the consumer can read.
//  · FINDING 12 — every consumer wrote the same one-line adapter for `window`. Written once.
//
// And one finding that only appeared when this function tried to boot against an injected document:
//
//  · FINDING 15 — the language's boot called `applyDom(document)`, the GLOBAL, underneath whoever called it. In a
//    browser it makes no difference, which is how it survived; in a pure-logic test it is the difference between booting
//    and not, and with two documents (an engine in an iframe, an editor beside the game) it would be the difference
//    between translating the right document and the other one. Hence `translator.init(root)`: the document comes in.
//
// ========================= DECLINING IS NOT LYING =========================
// The quiz declined the sonar and the pad instead of inventing tiles and a fake collision box, and that distinction
// separates a finding from a false green. Here it becomes a TYPE: a game without a piece says so in a field instead
// of returning `null` from a getter and hoping. What is declined is kept in the returned object, so a consumer can be
// audited by what it refused.
// ⚠️ THIS PARAGRAPH NAMES NONE OF THE FIELDS, which looks odd and is deliberate: `tests/no-decline-is-dead` counts
// MENTIONS, comments included, on purpose — erring towards «alive» is the right direction for that error, because a
// false accusation switches a gate off. So using a decline as an EXAMPLE in prose makes it look read, and a field
// that is genuinely dead stops being accused.
//
// ========================= WHAT THIS DOES NOT DO =========================
// It does not start a renderer, physics or tiles, nor the game loop: none of that belongs to every game, and the loop
// is the cartridge's (`core/loop.startLoop`, called by the game). It does not mount `ui/shell`, the phase machine of a
// game with a title screen. What it covers is what is the SAME in every game: language, screen reader, mixer, voice,
// the dialog stack, the colour filters, the remappable keyboard, menu navigation, the pause card and the accessibility
// bar, the settings panels, the navigation sonar, and every input transport.
import { createTranslator, availableLocales, type Translate } from '../core/i18n.js';
import { localeHostHooks, exposeI18n } from '../platform/locale-host.js';
import { createInputState, type LiveInput } from '../input/state.js';
import { initTouch, mountTouchControls, touchGaps } from '../input/touch.js';
import { initTouchBindings } from '../input/touch-bindings.js';
import { createCrashNotice } from '../ui/loop-crash.js';
import { sampleFlashes, type FlashMeasurement } from '../platform/flash-sampler.js';
import { initFocusTrap, focusablesInDom } from '../ui/focus-trap.js';
import { showReachNotice, REACH_NOTICE_ID } from '../ui/reach-notice.js';
import { reach, defaultTransports, type Reach, type Availability } from '../input/transports.js';
import { accommodationAnswersProblems, subjectWord, type AccommodationAnswers } from '../core/accommodations.js';
import { genreProblems, genreWarning } from '../core/genres.js';
import { cartridgeProblems } from '../core/cartridge-problems.js';
import { contractSubjects } from '../core/accommodation-subjects.js';
import { presetActions, startClaimProblem, selectClaimProblem, labellerFrom, shortLabellerFrom, wordsOf, ACTIONS, type Action, type ActionPreset, type ActionWords } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';
import { createAnnouncer } from '../core/a11y-sr.js';
import { createEyeControl, videoFeed } from '../ui/eye-control.js';
import { createFaceControl } from '../ui/face-control.js';
import { createHandControl } from '../ui/hand-control.js';
import { checkedCacheHas, sha256With } from '../platform/heavy.js';
import { createBundleLoader } from '../platform/vosk-runtime.js';
import { followCameraMode } from '../ui/camera-control.js';
import { initPauseIcons, wireBarCaption, showPauseOptions } from '../ui/pause-icons.js';
// 📌 The bar's markup is a pure string builder and lives with the rest of the pause markup (ADR-0221, issue #203); what this
// root asks `ui/pause-icons` for is the WIRING — the icons this game can actually act on, and the reflection of their state.
import { iconsMarkup } from '../ui/pause-markup.js';
import { accessibleLabel } from '../core/accessible-label.js';
import { helpRows, mountSlides, showSlide, animateFigure, howToPlayProblems, playSlidesOf, type HowToPlaySlide } from '../ui/help-panel.js';
import { missingDeclaredKeys } from '../ui/declared-words.js';
import { initSettingsControls, type SettingsControlsApi } from '../ui/settings-controls.js';
import { keyName } from '../ui/control-choices.js';
import { reserveTopBand } from '../ui/top-band.js';
// The settings store's FACTORY: this root builds the one store it, its modules and its game read (ADR-0232 D4).
import { createSettingsStore, type SettingsStore, type LetterCase } from '../core/state.js';
import { DEFAULTS, defaultReducedMotion } from '../core/setting-defaults.js';
import { CAMERA_CONTROLS, type CameraControl } from '../core/camera-cycle.js';
import { createDeafMode, type Interpreter } from '../ui/vlibras.js';
import { createLibrasAvatarInterpreter } from '../ui/libras-avatar-player.js';
import { screenText, unreadableWorldProblems, menuSonarPress, type ScreenTextCtx } from '../ui/screen-text.js';
import { conformanceProblems, type GameDeclaration } from '../core/contract.js';
import { createSceneStack, type SceneStack } from '../core/scenes.js';
import { createTts, type LoadKokoro } from '../platform/tts.js';
import type { SpeechPort } from '../platform/speech.js';
import { createReading, type Reading, type ListenOptions } from '../platform/reading.js';
import type { ReadingThreads, ReadingInWorker } from '../platform/reading-in-worker.js';
import { createAudio, type Audio } from '../platform/audio.js';
import { createAudioSonar, type AudioSonar, type SonarPlayer } from '../platform/audio-sonar.js';
// The root is the layer that MAY know both axes: `render/` is below it, and it is the root's job to answer
// `platform/audio-sonar`, which cannot import from here without inverting an edge (#104).
import { isBlind, isLowVision, hasHighContrast, onlyColourVision, DEFAULT_VISUAL, filterKey, simulationUnavailable, type VisualState, type Theme, type Correction } from '../render/viz-axes.js';
// 📌 The mode → `url(#...)` table, which `render/cvd-matrices` installs and the `consumer-quiz` consumes.
import { VIZ_FILTER } from '../render/viz-modes.js';
import { createPadWizard, createPadMaps } from '../input/pad-wizard.js';
import { typographyCycle, CYCLE_START, FONT_BY_KEY } from '../ui/fonts.js';
// 📏 The drawing reporters (`barIntruders`, `belowFloor`, `minimumTarget` and their types) live in `ui/drawing-problems`
// (ADR-0221, issue #203), and the root does not know them. An import that can be deleted is coupling that no longer
// exists, and that is how this debt is paid: by subject.
import { stageScale, applyScale, type Scale } from '../ui/layout.js';
import { screenBaseSize } from '../core/screens.js';
import { OVERLAY_SCOPE_SELECTOR } from '../ui/settings-panel.js';
import { drawnBelowTheFloor, barIntruderProblems, type DrawingProblemsCtx } from '../ui/drawing-problems.js';
import { createListenerScope } from '../platform/listener-scope.js';
import type { FilterReach } from '../render/port.js';
import { LOGICAL_W } from '../core/constants.js';
import { captionDuration, CAPTION_RATES } from '../core/caption-duration.js';
import { initSettingsPanel, type SettingsPanelApi } from '../ui/settings-panel.js';
import { mountPanel } from '../ui/mount-panel.js';
// 📌 No `latchRefusal` or `setMoveLatch` here: the sticky keys are written by the bar's ☝️, which already resolves both
// the device's refusal and the two stored keys.
import { stampSource, sourceOfEvent } from '../input/synthetic-source.js';
import type { TransportName } from '../input/transport-in-use.js';
import { createVirtualController, type VirtualCommand, type VirtualController } from '../input/virtual-controller.js';
import { keyGoesToGame, keyPressesOwnControl, keyTypedIntoField } from '../input/key-default.js';
import { createSwitchScan, playScanList, SWITCH_SCAN_DEFAULTS, type SwitchScan } from '../input/switch-scan.js';
import { menuScanFor, menuStepKeys, type MenuCursor, type MenuStep } from '../ui/menu-intent.js';
import { mountScanOverlay, scanItemText } from '../ui/scan-overlay.js';
import { createVoiceControl, type VoiceControl } from '../ui/voice-control.js';
export type { VirtualCommand } from '../input/virtual-controller.js';
import { mountSteps, updateSteps, nextStep, controlRow, labelRow, mountChoice } from '../ui/panel-widgets.js';
import { PERSONAS_DO_PAD, closestPersona } from '../input/touch.js';
import { initSettingsTypo, type SettingsTypoApi } from '../ui/settings-typo.js';
import { initSettingsMotion, type SettingsMotionApi } from '../ui/settings-motion.js';
import { readStoredScene, storeScene, SCENE_KEYS } from '../ui/motion-scene.js';
import { watchFooterScroll } from '../ui/footer-scroll-driver.js';
import { initSettingsVisual } from '../ui/settings-visual.js';
import { initSettingsEmpathy } from '../ui/settings-empathy.js';
import { HC_ROLE_DEF } from '../render/hc-role-data.js';
import { createLqFilter, type LqFilter } from '../render/lq-filter.js';
import { createCrt, type Crt } from '../render/crt.js';
import { initSettingsAudio, mountAudioInside, mountSoundInside, type SettingsAudioApi } from '../ui/settings-audio.js';
import { AUDIO_CATS } from '../platform/audio-mixer.js';
import { toggleBtn, toggleLabel } from '../ui/dom.js';
import { createEmpathyFilter } from '../input/empathy-filter.js';
import { createInputCooldown, COOLDOWN_MS } from '../input/input-cooldown.js';
import { markChanged } from '../ui/changed-mark.js';
import { mountHudBands, hudNumbersProblems, type HudNumber, type HudBandsMounted } from '../ui/hud-bands.js';
import { mountSessionClock, type SessionClockMounted } from '../ui/session-clock.js';
import { mountHudRow, reserveBottomBand } from '../ui/hud-row.js';
import { gameOptionsProblems, drawGameOptions, type GameOption } from '../ui/game-options.js';
import { createStorage, keysOutsideScopes, type StorageLike } from '../platform/storage.js';
import { KEYS } from '../platform/storage-keys.js';
import { initMenuNav, type MenuNavApi } from '../ui/menu-nav.js';
import type { NavKeys } from '../input/edges.js';
// 🔴 THE GAMEPAD IS MOUNTED HERE (ADR-0224), like every other transport — no longer by the cartridge.
import { initGamepad, padGameAnswers, seatEveryPlayer, type GamepadGameHooks } from '../input/gamepad.js';
import { whereTheChildIs, type Place } from '../ui/where-the-child-is.js';
import { createSimulationOverTheWorld } from '../ui/simulation-over-the-world.js';
import { createSimulationList } from '../ui/simulation-list.js';
import { showOnlyRowsThatApply } from '../ui/audio-rows-that-apply.js';
import { initKeyboardRuntime, type KeyboardRuntime } from '../input/keyboard-runtime.js';
import { createKeyboardConfig, type KBDefaults, type KeyboardConfigApi, type KeyboardMapping } from '../input/keyboard.js';
import { createPadTable, type PadTableFor } from '../input/pad-defaults.js';
import { downloadHeavy, heavyAtBoot, type HeavyReport } from '../platform/heavy.js';
import { installCvdFilters } from '../render/cvd-matrices.js';

/** What the game lends from the document. Everything optional but `doc`/`win`: what is missing becomes `problems`. */
export interface EngineHost {
  readonly doc: Document;
  readonly win: Window;
  /** An empty `<svg>` where the six colour-vision filters are mounted at run time. */
  readonly cvdHost?: SVGElement | Element | null;
  /**
   * WHERE THE ACCESSIBILITY BAR GOES, on the game's FIRST screen.
   *
   * ⚠️ THE DEV'S REQUEST, 2026-09-07: «o menu de pausa, o design do menu de pausa e os ícones de acessibilidade
   * que aparecem no jogo desde a primeira tela devem ser oferecidos pela ENGINE e não pela programação do
   * jogo. Todo jogo da engine inclusionist deve ter o mesmo menu de pausa e ícones de acessibilidade desde a
   * primeira.»
   *
   * Left to each game, the bar was missing from most of the catalogue: each game had to remember to call
   * `initPauseIcons`, and a child who depends on blind mode, narration or high contrast opened those games with no way
   * in. So the engine mounts it (ADR-0106 §4, step 2).
   *
   * Absent, the engine looks for `#title-icons` — the id the platformer has always used. Found, the bar is written and
   * wired here; not found, it is a line of `problems`: the engine can offer the icons, but it cannot guess WHERE they
   * fit in the layout of a game it does not know.
   */
  readonly a11yBarHost?: Element | null;
  /**
   * WHERE THE PAUSE CARD of the first screen is hung. Absent, the engine uses `#game-region`.
   *
   * ⚠️ For the same reason as `a11yBarHost`: the engine OFFERS the pause, but does not know where it fits in the
   * layout of a game it does not know. 📌 And since ADR-0120/ADR-0122 WHERE is not WHETHER: the pause is not
   * declinable, and what this field keeps is the place. A host that takes no children becomes a line of `problems` —
   * the difference between the engine not knowing and the engine keeping quiet.
   */
  readonly pauseHost?: Element | null;
  /**
   * WHERE THE VIRTUAL CONTROLLER IS HUNG (ADR-0143). Absent, the engine uses `#game-region`.
   *
   * ⚠️ For the same reason as `pauseHost`: the engine draws the pad from the `preset`, but does not know where it fits
   * in the layout of a game it does not know. And the stylesheet puts `.touch` at `position:absolute` at the bottom of
   * the host — so the host is the game's rectangle, not the page.
   */
  readonly touchHost?: Element | null;
  /**
   * WHERE THE CHILD'S SETTINGS ARE KEPT (ADR-0232, issue #207). The root builds the page's one store from it and hands that
   * store to every module that persists.
   *
   * 📌 OPTIONAL, against ADR-0224/ADR-0227's preference for required ports, because here absence has a SAFE answer rather
   * than a silent one: the host window's `localStorage`, which is what «this browser remembers the child's choices» means.
   * A host passes one to keep a root's settings apart from everything else on the origin — a test file its own
   * `memoryBackend()`, so no file inherits or races another's keys; a page with two roots one each (ADR-0142).
   */
  readonly storage?: StorageLike;
  /**
   * WHO SIGNS IN DEAF MODE (ADR-0234): the Libras player behind the `Interpreter` port, handed the text the sonar reads. Absent:
   * the free player the delivery shipped (`ui/libras-avatar-player`, `inclusionist-heavy --libras`); and where it shipped none,
   * the answer `NO_INTERPRETER` gives — «signing unavailable», a line of `problems` and a notice to the child, with the captions
   * and the text intact. A host's own interpreter always wins; a test hands its double here.
   */
  readonly interpreter?: Interpreter;
}

/**
 * The backend the host lent, else its window's `localStorage` — or `null` where the window has none or reading it throws
 * (file://, private modes): a host with no storage, whose reads give their fallbacks.
 */
function hostStorage(host: EngineHost): StorageLike | null {
  if (host.storage) return host.storage;
  try { return host.win.localStorage ?? null; } catch { return null; }
}

/**
 * The interpreter the host lent — it always wins — else the one the DELIVERY carries (`delivered`, built only when needed): the
 * free Libras player where the delivery was built with `--libras`, which answers as `NO_INTERPRETER` where it was not.
 */
function hostInterpreter(host: EngineHost, delivered: () => Interpreter): Interpreter {
  return host.interpreter ?? delivered();
}

/**
 * What this game does NOT have. Declared, not deduced from a getter that returns null.
 *
 * Finding 10 of the second consumer is why this exists as a type: the quiz had to declare itself paused to navigate its
 * own menus, because the engine had no way to hear that a game has no phases.
 */
export interface Declinios {
  /*
   * ⚠️ THE PAUSE-MENU DECLINE IS GONE, and the note stays because its absence is a decision.
   *
   * It existed because the engine had nothing for a game without a pause of its own; ADR-0106 built that (a default
   * list of buttons and the mounting of the card), and ADR-0120 retired it. It came back once (ADR-0121) when four of
   * five games turned out to use it, for fear that a mounted card would eat every arrow, Enter and Space. It does not:
   * both readers of the card (`ui/menu-nav` and `input/gamepad`) consume a key only while the card is NOT hidden, and
   * `buildScreenPause` delivers it hidden — a MOUNTED card eats nothing; only an OPEN card owns the keyboard, which is
   * right. ADR-0122 retired it for good, with the Dev's reason: the pause menu and the HUD's accessibility icons are in
   * EVERY game, which is why they are the engine's.
   *
   * 📌 A game that genuinely has no pause does not get this back — that would be a new decision about what a pause
   * means in a game with no running state. What a game still declares is WHERE it fits: `host.pauseHost`, with
   * `#game-region` as the fallback.
   */
  /*
   * No controller-mapping decline (ADR-0231): the wizard is accessibility the engine offers to every game, and the
   * engine's accessibility is not declinable (ADR-0122).
   */
  /** No pause actor — who pressed the button that opened the menu. */
  readonly noPauseActor?: boolean;
  /**
   * No neural voice — this game does not declare `uses: { neuralVoice: true }` (ADR-0216 §3).
   *
   * Exists because the absence is otherwise silent: a game that does not ask for one has only the browser's voice, which a school
   * Chromebook may not have for the child's language. Declining is a choice; not declaring is an omission, and `problems` says so.
   */
  readonly noNeuralVoice?: boolean;
}

export interface CreateGameOptions {
  /** The SEVEN FIELDS (core/contract). It is what the accessibility stack reads, and the only thing it reads. */
  readonly declaration: GameDeclaration;
  readonly host: EngineHost;
  readonly declines?: Declinios;
  /**
   * Is it menu-navigation time NOW? The platformer answers `phase === 'paused'`; a quiz answers `true`.
   * Absent = `true`, the case of a game with no phases — the simplest one, and the one that does not force one to be invented.
   */
  readonly isNavigable?: () => boolean;
  /** Is the position index (item N of M) on? Absent = yes. See `withIndex` in ui/menu-nav. */
  readonly withIndex?: () => boolean;
  /**
   * ADR-0044's `accessibility` MODE (item 7): the directional drives the quick bar instead of the character.
   *
   * Optional: absent, the engine answers with the bar it mounted itself (`ui/pause-icons`). A game that draws its own
   * bar answers for it.
   */
  readonly onBar?: (i: number) => boolean;
  readonly navBar?: (i: number, k: NavKeys) => void;
  /**
   * Players for the remappable keyboard. `Pick<ControlledPlayer,'ctrl'>` — a key scheme and nothing more.
   * ⚠️ `KeyScheme` and not `Record<string, string[]>` (#118): a structural COPY of a type that nothing forces to agree
   * drifts — the lesson `core/entity` opens with.
   *
   * ⚠️ `audioSink` is ADDITIVE AND OPTIONAL: no consumer needs to write it.
   *
   * 🎯 It is here because the seat has a second reader inside the engine. The hearing panel, which the engine mounts,
   * writes into it the audio output the child chose — and `ui/pause-icons` reads it to answer a question that changes
   * what the bar offers: does this child have an output of HER OWN? Without it, changing sound, narration or blind
   * mode on a shared headset would change everyone's audio.
   *
   * 📌 AND ONLY THIS FIELD. The MOTOR fields (`easy`, `toggleMove`, `toggleRun`) are left out: they are required in
   * `MobilityPlayer` — the panel READS them to draw its state — and making them required here would force every game
   * to carry them. That is a contract decision still to be taken, and it is not taken in passing by a cast that would
   * silence the compiler.
   */
  readonly players?: { ctrl: KeyScheme; audioSink?: string | null }[];
  /** Phase change, for a game that has phases. Absent = does nothing (a game without phases loses nothing). */
  readonly setPhase?: (p: 'title' | 'playing' | 'paused') => void;
  /**
   * The players as NAVIGATION SOUND sees them. Absent, `createGame` DERIVES one from field 4 of the contract: the focus
   * says where the player is, which is all the sonar needs to know about position.
   *
   * A game with several players, or with an audio device per player, supplies its own list. A one-child game supplies
   * nothing — and gets the sonar anyway, which is the point.
   */
  readonly sonarPlayers?: () => SonarPlayer[];
  /** Blind mode on? Absent = the engine's own stored value (`core/state.blindMode`). Applies to every player. */
  readonly isBlindMode?: () => boolean;
  /**
   * THIS GAME'S POSITIONS AND THE KEYS OF THEIR WORDS (`core/actions`). Without them the engine does not know HOW MANY
   * actions to ask of a transport, and ADR-0079 §3's guarantee cannot be measured (issue #112).
   *
   * 🔴 KEYS of `dictionaries`, never words (ADR-0232 D3, erratum of 2026-09-25): the root's translator resolves them each
   * time the engine draws or speaks them, so a language change reaches the help, the remap screen, the pad and the scan.
   * A key the dictionaries lack leaves its position unnamed and is a line of `problems`.
   *
   * Optional because a game may not declare a preset yet; without it the reach notice simply does not appear, and the
   * help and the scan have no words to show.
   */
  readonly preset?: ActionPreset;
  /**
   * THE ON-SCREEN PAD, only when the cartridge asks for it (ADR-0166): «Controle de tela é só para jogo que não funciona tão
   * bem como via mouse e/ou touch (o cartucho decide), nunca para menu.» Absent = no pad — a game played by touching its
   * own elements, and every menu, need none on top of them. It leaves the pause card and the panels; it stays on the quick
   * pause.
   */
  readonly onScreenPad?: boolean;
  /**
   * THE NUMBERS THIS GAME SHOWS, each in the band of what it is about (ADR-0168, ADR-0175; issue #162). The engine mounts
   * the HUD and places them: `identity` top left and `mission` under it, `power` top right (under the clock), `learning` bars (one to three, as
   * `educational/segment-bar.barOf` returns them) centred in the footer, under the explanation; the room the game leaves free at the
   * top (`--barra-a11y-h`) grows by what they take. Absent = no HUD mounted, and the game keeps drawing its own.
   * 📏 Measured on 2026-09-13: six sibling games, six HUDs of their own, none in the bands.
   * A malformed list is refused at boot and at `mount`, like the declaration.
   */
  readonly hud?: readonly HudNumber[];
  /**
   * THE OPTIONS OF THIS GAME, as rows the engine draws (ADR-0182; issue #178): the keys of a label and hint in the game's
   * dictionary (resolved at every drawing, ADR-0232 D3), a kind (steps, list or switch), how to read the value and how to write it. «Opções do jogo» opens them in a panel of the
   * engine's own; absent or empty, the door stays on the card locked with its reason (ADR-0161). A cartridge draws its own
   * options only where rows cannot express what it needs. A malformed list is refused at boot and at `mount`.
   */
  readonly gameOptions?: readonly GameOption[];
  /**
   * HOW TO PLAY THIS GAME, as slides the help shows before the buttons (ADR-0195; issue #188): «O "Como jogar" é justamente algo a
   * ser feito pelo cartucho.» Each slide's text is a KEY of `dictionaries`, resolved at every showing in the page's language
   * (ADR-0232 D3); its figure, when given, is drawn
   * by the cartridge on a surface the engine gives, with the time for an animation (still under reduced motion). Absent = the help
   * shows the buttons alone. A malformed list is refused at boot and at `mount`.
   */
  readonly howToPlay?: readonly HowToPlaySlide[];
  /**
   * THIS GAME'S DICTIONARIES, one per language (`pt`, `en`, `es`), registered into THIS ROOT's translator before anything is
   * translated (ADR-0232 D3 erratum): a key resolves for this game and for no other root on the page. A string with markup is
   * refused and named in the console; a key given in one language and not another is a line of `problems`.
   *
   * 🔴 THE ONE PLACE A GAME'S WORDS LIVE (ADR-0232 D3, erratum of 2026-09-25): every word the game DECLARES — `preset`,
   * `accommodations`, `gameOptions`, `howToPlay`, `hud` — is a key of these, and a declared key they lack is a line of
   * `problems` and is never shown. A cartridge `mount()` swaps in may bring its own; they are added to these.
   * Decision (mechanical, ADR-0232 D3): an option and not a method on the handle, because the markup is translated at boot.
   */
  readonly dictionaries?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * THE VIRTUAL CONTROLLER'S COMMANDS, CARRIED TO THE GAME (ADR-0111 and its erratum; issue #197): «a engine lida com o hardware e passa
   * para o jogo o nome virtual do botão». Each press and release of a position the child's hardware reached — the keyboard by the
   * child's scheme, the eyes — with its source and seat. What it executes is the game's, named by its `preset`. Not called while a menu
   * has the directional. Absent = the game hears commands only through what it reads itself.
   */
  readonly onCommand?: (command: VirtualCommand) => void;
  /**
  /**
   * WHAT ONLY THIS GAME KNOWS ABOUT THE GAMEPAD (ADR-0224). The engine mounts the transport; these are the few answers
   * nothing in it can know — the title screen, the attract demo, the modal, joining and respawning a seat, the waiting
   * badge, the wizard's art, and whether the world is running.
   *
   * 🎯 **Absent altogether is an answer**, not an oversight: the gamepad works, and what depends on the cartridge's
   * world simply does not happen. Each absence is written in `GamepadGameHooks`.
   */
  readonly gamepad?: GamepadGameHooks;
  /**
   * THE ACCOMMODATIONS THAT HAVE A SUBJECT IN THIS GAME — the cartridge's answer, REQUIRED (ADR-0153).
   *
   * 🔴 For each of the sixteen only the game can answer (`GAME_KEYED` in `core/accommodations`): the KEYS of the game's
   * word in `dictionaries` (ADR-0232 D3), if it has a subject here, or `false`. In the Dev's words: «Gênero não precisa responder todas as acomodações, mas
   * sim o cartucho, obrigatoriamente.»
   *
   * ⚠️ REQUIRED, by the `holdsAtOnce` rubric: there is no safe default — yes mounts the wheelchair in chess, no
   * hides it from the platformer — and forgetting fails INVISIBLY to whoever writes the game. A missing or incomplete
   * answer is a malformed declaration, and the boot REFUSES.
   *
   * 📌 The general ones always mount and the contract's are derived; none of them is answered here.
   */
  readonly accommodations: AccommodationAnswers;
  /**
   * The game's genre, OPTIONAL (ADR-0153), from the engine's list (`core/genres`, ADR-0156): what the game plays like.
   * The cartridge chooses it and nobody assigns it. Casino game and a name outside the list refuse the boot; Horror game
   * boots and `problems` carries its «avoid» mark.
   */
  readonly genre?: string;
  /**
   * WHAT THIS GAME USES OF THE VOICE (ADR-0216 §3) — never how. Two answers, and each one is a sentence about the child, not
   * about a library:
   *
   * · `neuralVoice: true` — a child who cannot read is read TO by this game, so it wants a voice even where the device has
   *   none of its own. The engine loads Kokoro from the delivery at the first such utterance (ADR-0216 §1); the game names no
   *   phonemizer, runtime or model. Absent, no Kokoro voice is listed, the audio panel does not offer the neural engine, and
   *   the 371 MiB of model, voices and runtime never enter the delivery.
   * · `reading: true` — a child reads aloud TO this game and it wants the text; the engine decides who hears her, and a
   *   delivery carries the reading models of pt, en and es because of this answer (each device keeps the three, her
   *   language's first: she can switch at any moment). Absent, `motor.reading.listen()` refuses and
   *   says which line is missing: a game that asks for a microphone it never declared would also be a delivery without the
   *   model, which is a silence in a school nobody can debug.
   */
  readonly uses?: { readonly reading?: boolean; readonly neuralVoice?: boolean };
  /**
   * FETCH THE HEAVY FILES ON THE FIRST LOAD? Default **yes** (ADR-0110 (b), ADR-0116, ADR-0119).
   *
   * The vision runtime and models, and with `uses.neuralVoice` Kokoro's model, voices and runtime (371 MiB), come down in the
   * BACKGROUND, one at a time, without blocking the game: the child plays while they arrive, and what must not happen is a child
   * back on the second day, offline, finding they were never fetched. Pillar 8 is «first day ONLINE, then offline-first», and
   * ADR-0116 removed the contradiction that blocked this — installing is already a network act.
   *
   * ⚠️ `false` IS FOR WHOEVER HAS A REASON, and the reason that exists is a TEST: a case that mounts the start in a real browser
   * cannot fire hundreds of MB at the network. A game in production that turns it off decides its child has no neural voice offline.
   *
   * 📌 ADR-0117 says the one who should pay this once is the PLATFORM, not each cartridge — the Cache Storage is partitioned by
   * origin, and on one site the heavy files come down once for every game. Until the platform asks for them, the game does: better
   * twice than never.
   */
  readonly downloadHeavy?: boolean;
  /**
   * WHAT HAPPENED TO EACH HEAVY FILE, as it happens. Absent = nobody is watching.
   *
   * ⚠️ HERE AND NOT IN `problems`, because the download runs in the BACKGROUND: `createGame` returns `problems` synchronously, and a
   * line arriving later lands in an array its reader already read. ADR-0110 asks that a failed fetch be REPORTED — reporting is having
   * a channel that exists when the news arrives, not pushing into a list already delivered.
   *
   * 📌 The engine invents no surface for this: where «N MB left» fits on a game's screen is the game's to know.
   * `bytesLeftToDownload(relatorio)` gives the number for the sentence.
   */
  readonly onHeavyProgress?: (r: HeavyReport) => void;
  /**
   * How each transport is found to be here. Absent = the engine asks the device.
   *
   * Injectable because whether a gamepad is connected and whether this is a touch screen are questions to the browser, and a
   * test that cannot answer them cannot exercise the screen that depends on them.
   */
  readonly availability?: Availability;
  /**
   * WHAT EACH ITEM OF THE PAUSE CARD DOES IN THIS GAME — «continuar», «sair», «ajuda», whatever the game wires.
   *
   * 🔴 The engine hides every item nothing acts on (ADR-0106 §5, no dead buttons — `refreshPauseItems` in
   * `ui/pause-icons`), so without this field a game could wire no item beyond the ones the engine acts on itself
   * (`ENGINE_ITEMS` and the engine's own actions below). The game's table is spread over the engine's, so the game wins.
   *
   * 📌 A FUNCTION and not a value, for the reason `ui/pause-icons` records: a game's table changes during a match (a
   * «sair» that is wired only after the first level), and freezing it at boot broke a case there. Absent = only what
   * the engine acts on.
   */
  readonly getPauseActs?: () => Record<string, (() => void) | undefined>;
  /**
   * WHO OPENED THE PAUSE, when there is more than one seat — the keyboard panel edits the seat of THIS index.
   *
   * ⚠️ Without it the child in the SECOND seat cannot remap, and `problems` says so for a game that declares more than
   * one player and does not answer this (`core/cartridge-problems`).
   */
  readonly setPauseActor?: (i: number, ...rest: unknown[]) => void;
  /**
   * HOW THIS GAME REPAINTS FOR HIGH CONTRAST, and how it corrects colour vision — the two axes of ADR-0104.
   *
   * 🔴 THE ⚫ ICON IS OFFERED ONLY TO A GAME THAT HANDS IN A WRITER. `iconsThatAct` mounts an icon only for whoever
   * hands in its writer, and that rule is right — an icon that acts on nothing is worse than one icon fewer. What
   * these fields add is the DOOR: without it, an outside consumer read the absence as this game having its own
   * controls, true about the result and false about the cause. A gap the consumer reads as a choice is the worst kind.
   * The 🚥 has an engine default (a filter over the world, below); a game that corrects colour in its own render wins.
   *
   * ⚠️ TWO FIELDS AND NOT ONE, because they are two questions: a game may know how to repaint textures and have no way
   * to correct colour, or the other way round — `game-pinball`'s image is a 320×180 framebuffer with no texture to
   * repaint, and it applies the colour filter itself.
   */
  readonly setPlayerTheme?: (i: number, theme: Theme) => void;
  readonly setPlayerCorrection?: (i: number, correction: Correction) => void;
}

export interface Engine {
  readonly declaration: GameDeclaration;
  /**
   * THE PAUSE THIS ROOT MOUNTED — show and hide, without the consumer hunting for any id.
   *
   * ⚠️ IT EXISTS BECAUSE MOUNTING IS NOT SHOWING. The card is born `hidden` (that is how `buildScreenPause` delivers
   * it, and it must be: a pause is opened, not open). The engine opens it on SELECT, the ☰ and the quick pause's
   * `action4`; these two let a game open and close it too, without looking for `#vp-pause-0` in the document — exactly
   * the kind of knowledge this file exists not to demand.
   *
   * 📌 The engine OFFERS the mechanism and does not take the phase. When to open the pause stays the game's, because
   * only it knows what playing is; what stops being its business is HOW.
   */
  readonly pause: {
    /** Reveals screen `i`'s card and rebuilds its items — ADR-0106 §5 evaluated the moment it opens. */
    readonly show: (i: number) => void;
    /** Hides it again. */
    readonly hide: (i: number) => void;
  };
  readonly tts: ReturnType<typeof createTts>;
  /**
   * THE CHILD READS ALOUD AND THIS ANSWERS WITH TEXT (ADR-0216, issue #200; the Dev, 2026-09-21: «o jogo… apenas deve pedir
   * para ouvir e receber o texto»). `listen()` ends when she goes quiet or the ceiling falls; `stop()` gives the microphone
   * back; `ready()` says whether this device can hear her language at all. Which recogniser hears her is the engine's
   * business — and never one that would send her voice to a server. A game that wants it declares `uses: { reading: true }`.
   */
  readonly reading: Reading;
  /**
   * THE SOUND CAPTION, hosted by the engine (study item D3; ADR-0014; ADR-0164 rules 4–5): a line for eyes that cannot
   * hear, in the screen footer above the explanation, at most two lines, gone after a moment. Written only while the
   * child has captions on. Pass it as `createAudioEarcons`'s `showCaption`.
   * 📏 Before it, each game wrote its own `#caption` with its own timer (platformer 1300 ms, soccer 2600 ms).
   */
  readonly captionSound: (text: string) => void;
  /**
   * THE GAME EXPLAINS THE ITEM UNDER ITS OWN CURSOR IN THE ENGINE'S FOOTER (ADR-0244): `text`, already in the child's language as
   * `say` takes it, becomes the footer's RESTING text — the engine's own items (a quick-bar icon, a pause-card item) take the
   * footer while pointed and give it back to this text when they leave. `null` clears it; call it again when the cursor moves
   * or the language changes, and with `null` when the screen it explains goes. At most two lines (ADR-0164): a longer text is
   * clamped there, so say it whole through narration too. Releasing the cartridge clears it.
   */
  readonly explain: (text: string | null) => void;
  /**
   * The game speed the child chose on the quick bar (ADR-0180): 1 is 100%, down to 0.5. Pass it as `startLoop`'s REQUIRED
   * `speed` (ADR-0232 D2c), which multiplies the frame time by it; a game that runs its own frames multiplies by this.
   */
  readonly gameSpeed: () => number;
  /**
   * Does the child want the «N de M» said after an item (ADR-0044 item 3)? Read at each announcement: the hearing panel
   * turns it off and on. A game that announces its own items asks here instead of reading the settings store by import
   * (ADR-0232 D2c), as it asks `gameSpeed` — the demo quiz does.
   */
  readonly menuIndexOn: () => boolean;
  /**
   * TRANSLATES IN THIS ROOT'S LANGUAGE (ADR-0232 D3): the root's own `t`, the one every engine module receives. A game that
   * writes its own words asks here instead of importing `core/i18n` — the demo quiz does — as it asks `gameSpeed`.
   */
  readonly t: Translate;
  /**
   * Resolves when the language chosen at boot has loaded — at once for pt (ADR-0232 D3). A game that draws its first screen
   * waits on it, or the screen is born in the fallback language.
   */
  readonly localeReady: () => Promise<void>;
  /**
   * THE PAGE'S LANGUAGE (`pt`, `en`, `es`) as this root speaks it, and the door to switch it — the one the 🌐 on the bar uses.
   * Since `core/i18n` holds no state (ADR-0232 D3, erratum of 2026-09-25) a game asks here instead of `getLocale`/`setLocale`
   * by import; a switch is kept, told to the page, and followed by every root on it.
   */
  readonly locale: () => string;
  readonly setLocale: (code: string) => Promise<void>;
  /**
   * THIS ROOT'S SCREEN-READER ANNOUNCEMENTS (ADR-0232 D4): «polite» (`#sr-status`, does not interrupt) — the announcer every
   * engine module receives. A game announces HERE instead of importing `core/a11y-sr`, which is a factory now: a second
   * announcer would write the same regions but carry none of this root's Libras mirror.
   */
  readonly say: (text: string) => void;
  /** The «assertive» announcement (`#sr-alert`): interrupts and speaks now — errors, a checkmate, a crash. See `say`. */
  readonly alert: (text: string) => void;
  /**
   * Every `say`/`alert` — the engine's and the game's — also goes to `sink`, until the returned release. The root connects
   * nothing. ⚠️ Deaf mode does NOT sign announcements: the interpreter signs what the sonar finds, when the child asks
   * (ADR-0234) — no queue of messages.
   */
  readonly mirrorAnnouncements: (sink: (text: string) => void) => () => void;
  /**
   * THIS ROOT'S DEAF MODE (ADR-0234): the one the bar's 🦻 toggles. With it on, every sound is captioned and the sonar has
   * the interpreter sign what it found; `isOn` is the child's choice, `toggle` flips it from a game's own control.
   * `captionsOn` is whether a sound gets its caption now — the captions setting OR deaf mode: pass it as
   * `createAudioEarcons`'s `getCaptionsOn`, beside `captionSound` as its `showCaption`.
   */
  readonly deafMode: {
    readonly isOn: () => boolean;
    readonly toggle: () => void;
    readonly captionsOn: () => boolean;
  };

  /**
   * THIS ROOT'S SETTINGS STORE (ADR-0232 D4): the child's settings, read through live getters (`settings.blindMode`) and written
   * by the setters, plus the bus a game subscribes and emits on. A game reads HERE instead of importing `core/state`, which is
   * a factory now: a second store would read the same storage but hear none of this root's changes.
   */
  readonly settings: SettingsStore;

  /**
   * WHERE A GAME MOUNTS ITS MAP (ADR-0239 point 4): the bottom-right cell of the HUD row. The engine draws nothing in it — an
   * empty slot takes no room — and a game with a map appends its own element here. `null` where the page has no
   * `#game-region` to hold the row.
   */
  readonly mapSlot: HTMLElement | null;

  /**
   * THIS ROOT'S INPUT STATE (ADR-0232 D4): the held keys and who pressed them, the transport in use per player, the pads'
   * frames, and `held(player, action)`. A game reads and writes HERE instead of importing `input/state`, which is a factory
   * now: a second instance would hold keys this root's transports never press.
   */
  readonly input: LiveInput;
  /**
   * THIS ROOT'S KEYBOARD MAP and its doors (ADR-0232 D4): `kb()` the live map, `set`, `save`, `reset` (back to the GAME's
   * default, ADR-0115), `factoryWithGame()` and `load()`. For a game with a remapping screen of its own — `game-2048`'s —
   * instead of importing `input/keyboard`'s module map, which no longer exists.
   */
  readonly keyboardConfig: KeyboardConfigApi;

  /**
   * THIS ROOT'S SOUND (ADR-0232 D4): the context (made at the first sound, from the host's window), the master, the mixer and
   * the syntheses. Read through live getters (`audio.soundOn`, `audio.audioCat`) and moved by its methods (`ensureAC()`,
   * `tone(…)`). A game asks HERE instead of importing `platform/audio`, which is a factory now: a second one would make a
   * second context and a second mixer, deaf to this root's volume and categories.
   */
  readonly audio: Audio;

  /**
   * THIS ROOT'S CRT (ADR-0232 D4): its live config, `apply()` (classes on `#game-region`, kept in the store) and
   * `scanVars()`, which re-anchors the scanlines to real pixels. A game that scales its own stage with `ui/layout`'s
   * `createLayout` passes `engine.crt.scanVars` as `afterScale`; a game with a CRT menu of its own reads and writes `cfg`
   * and calls `apply()` here instead of importing `render/crt`, as it asks `gameSpeed`.
   */
  readonly crt: Crt;
  /**
   * THIS ROOT'S L→Q CONTRAST ENHANCEMENT (ADR-0232 D4): `filter()` for composing a CSS filter, `t()` the amount, `set(t)`
   * to change it (kept in the store; the root recomposes the world's filter). A game asks here instead of importing
   * `render/lq-filter`.
   */
  readonly lq: LqFilter;

  /**
   * MEASURES WHAT THE WORLD'S CANVAS FLASHES for `ms`, against the WCAG 2.3.1 general flash threshold (study item B2;
   * `core/flash-threshold`). Only when called — reading pixels every frame costs a school machine (pillar 1), so play never
   * pays for it. A failure is also a line of `problems`. `lido: false` says why nothing was measured (no canvas, a canvas
   * the page may not read, or one that reads transparent, as a WebGL canvas without `preserveDrawingBuffer` does) — never a
   * pass by silence. The red flash is not measured.
   */
  readonly measureFlashes: (ms: number) => Promise<FlashMeasurement>;
  readonly overlays: SettingsPanelApi;
  readonly nav: MenuNavApi;
  readonly keyboard: KeyboardRuntime;
  /**
   * THE CONTROLLER OBJECT, offered to the cartridge (ADR-0216, in the Dev's words: «Assim como a engine oferece o objeto de
   * controle, ela deve oferecer objetos de leitura e TTS»).
   *
   * 📌 Every transport the engine knows — keyboard, gamepad (ADR-0224), touch, eyes, face, hands, voice, scan — is mounted
   * here and presses this controller by itself. This is for a transport a game mounts ITSELF: pressing a position by hand
   * is telling the engine that the child's device produced that position — with the source, which ADR-0109 demands.
   *
   * ⚠️ What it is NOT: a second way for the game to receive input. The game receives through `onCommand`.
   */
  readonly controller: VirtualController;
  /**
   * APPLIES THE VISION FILTER TO THE WORLD THIS GAME DECLARED (ADR-0087).
   *
   * ⚠️ It exists because, without it, each consumer wrote its own — and `game-15puzzle` did, with the right reasoning
   * and on its own. What it adds is the rule of MENUS, which a consumer has no way to know: they live over the
   * simulation and are the way out of it, so if they inherited the filter by being INSIDE the world, it is undone on
   * them. A blindness that blacked out the pause menu would lock the child inside the simulation (#82).
   */
  readonly applyVisionFilter: (css: string, reach: FilterReach) => void;
  /**
   * NAVIGATION SOUND, ready and wired to this game's declaration (item 19).
   *
   * It comes for free because the sonar no longer needs tiles: it asks for topology (field 1), targets (field 5) and
   * names (field 3), and the game already declared all three to exist. It was finding 9 of the second consumer: wiring
   * the sonar meant LYING to the engine, and the lie was demanded by the SHAPE of the question, not by the sound.
   */
  readonly sonar: AudioSonar;
  /**
   * THE SCENE STACK (item 22, C3 of ADR-0030), empty and ready.
   *
   * It comes from `createGame` and not from each game for the same reason as the sonar: it is infrastructure. What it
   * replaces is `phase: 'title' | 'playing' | 'paused'` — ONE game's enum that engine modules read, and that a game
   * with a level map or a results screen could not extend without asking the engine for a new constant (ADR-0030
   * records widening the union as a NON-option, and that is why).
   *
   * It is born EMPTY: the game pushes, because which scenes there are is the only part of this that is its own.
   */
  readonly scenes: SceneStack;
  /**
   * TELLS THE CARTRIDGE THE LANGUAGE CHANGED — the only thing it needs to know about it (ADR-0225).
   *
   * 📌 The engine already redraws everything that IS its own: the bar, the caption, the card, the pad, an open panel, the
   * voice that speaks and the model that listens. What it cannot redraw is the ACTIVITY — and without this door the
   * cartridge would have to subscribe to `i18n:change` on the window, knowing the event's name and reaching a global to
   * do it. It is the rule the Dev wrote for reading and speech: «o jogo não deve precisar saber como isso funciona»
   * (ADR-0216).
   *
   * ⚠️ Called AFTER the engine has redrawn itself, so the cartridge never sees a half-translated screen.
   */
  readonly onLocaleChange: (fn: () => void) => void;
  /** How many colour-vision filters were mounted. `0` = there was no host, and the visual menu loses half. */
  readonly cvdFilters: number;
  /** What the host page lacks and what the cartridge left undone, each line naming its fix. Empty = nothing to fix. */
  readonly problems: readonly string[];
  /** What this game declared it does not have. Returned so it can be audited — declining stays on the record. */
  readonly declines: Declinios;
  /**
   * THE ANNOUNCEMENT THAT THE LOOP STOPPED, ready to go into `startLoop(ticker, frame, maxDt, { onFailure })`.
   *
   * ⚠️ ADR-0054 says in writing that it is only half true while this does not exist, and the missing half is the one
   * that matters: **a blind child does not see a frozen screen.** Without an announcement, blind mode cannot tell
   * a crash from a pause to think, and the silence is the same in both cases.
   *
   * ⚠️ IT COMES FROM THE ENGINE AND NOT FROM EACH GAME because the message is the same in all of them and the channel
   * (screen reader + narration + what is SEEN) is infrastructure. The game owns the ticker and calls `startLoop`, whose
   * `onFailure` is REQUIRED (ADR-0232 D4): the game passes this, and no registration in `core/loop` stands in for it.
   */
  readonly onFailure: (failure: unknown) => void;
  /**
   * THE REACH MEASURED FOR THE MOUNTED CARTRIDGE — ADR-0079 §3's guarantee as data, for whoever wants to read it.
   *
   * The engine has already shown the notice if there was something to say; this is returned because a game may want to
   * decide more (hide a level that demands twelve actions, for example), and because `ok: false` is the kind of fact
   * that must be auditable instead of living only on a screen that has closed.
   */
  readonly reach: Reach;
  /**
   * MAKES THIS CARTRIDGE THE CURRENT ONE (ADR-0142). One composition root, several games.
   *
   * ⚠️ **THROWS** on a malformed declaration, and does not put it in `problems`: the contract is a PRECONDITION and not
   * a diagnosis, as at boot. A bad cartridge is never mounted.
   *
   * 📌 What it redoes is only what reading again cannot fix: effects written elsewhere — the two mapping registers, the
   * HUD, the game-options rows, the bar, the reach notice and the pad. `problems` and `reach` describe the mounted
   * cartridge because they are derived when read, not because `mount` copies them.
   */
  mount(declaration: GameDeclaration, hooks?: CartridgeHooks): void;
  /**
   * RELEASES THE CURRENT ONE: mappings set to `null`, reach notice and HUD removed, reading thread
   * closed, scene stack emptied.
   *
   * ⚠️ The stack is emptied with `pop()` and not with a `clear()`, and the difference is the decision: a scene's `exit()`
   * is its DOM cleanup, so running it is the teardown wanted. A `clear()` that skipped them would be the wrong fix.
   */
  unmount(): void;
  /**
   * ENDS THIS ROOT: it releases the current cartridge, like `unmount()`, AND STOPS LISTENING TO THE WINDOW.
   *
   * 🔴 The two are separate on purpose, and the separation is the whole point. `unmount()` releases the CARTRIDGE (ADR-0142) and
   * a `mount()` after it must find a root that still hears the keyboard — so `unmount()` may not take the listeners off. But a
   * page that is finished with a root had, until this method existed, no way to say so: the root kept its ~30 window listeners
   * for the lifetime of the document, and since every query it makes is document-wide, it went on driving the pause card of
   * whatever root came after it. 📏 Measured: one ArrowDown moved the cursor one item with one root, two with a second root
   * alive, three with a third.
   *
   * ⚠️ A disposed root is not to be used again: it no longer hears anything. Call it when the page drops the root, not between
   * cartridges — that is what `unmount()` is for.
   */
  dispose(): void;
}

/** The game's half WITHOUT the declaration — what `mount` receives beside it. */
export type CartridgeHooks = Omit<GameHalf, 'declaration'>;

/*
 * ONE SENTENCE FOR BOTH REFUSALS.
 *
 * ⚠️ The boot and `mount()` refuse a malformed declaration for the SAME reason, so with the same sentence: two copies
 * of a sentence are two places for it to drift, and a second translation to do when pillar 3 reaches it (the i18n
 * gate caps this module's raw text).
 */
function refuseDeclaration(who: string, problemas: readonly string[]): never {
  throw new Error(`${who}: declaração malformada — ${problemas.join('; ')}`);
}

/*
 * «start» BELONGS TO THE PAUSE, AND A CARTRIDGE DOES NOT TAKE IT (ADR-0144 §4).
 *
 * ⚠️ THE SENTENCE LIVES IN `core/actions`, not here, for two reasons that point the same way: that is where the
 * validity of an `ActionPreset` lives, and that is where the raw-prose ledger already answers for messages read by
 * whoever WRITES a preset. A new sentence in this module would raise its cap to pay for text that belongs to the input
 * vocabulary, not to the boot.
 *
 * ⚠️ IT THROWS, by the rubric of the two refusals above: this is a PROGRAM defect — the game declared a word for a
 * position that is not its own — and not a gap of the host. `problems` is for what still lets the child play.
 */
function refuseIfItClaimsStart(who: string, preset: ActionPreset | undefined): void {
  // 📌 AND SELECT TOO, since ADR-0155: the two system positions are the two doors of the pause.
  const problemas = [startClaimProblem(preset), selectClaimProblem(preset)].filter((x): x is string => x !== null);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/**
 * Did the cartridge ANSWER its accommodations? (ADR-0153.) Same rubric as the contract: a missing or incomplete answer is
 * a precondition, not a gap — `problems` is for what still lets the child play, and here the engine would not know which
 * rows to mount.
 */
function refuseIfNoAnswer(who: string, answers: unknown): void {
  const problemas = accommodationAnswersProblems(answers);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A genre outside the engine's list, or Casino game, refuses the boot (ADR-0156 §2, §4); an absent genre is conformant. */
function refuseIfGenreRefused(who: string, genre: unknown): void {
  const problemas = genreProblems(genre);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A malformed `hud` is a program defect, refused like the declaration (ADR-0169): the engine would not know what to place. */
function refuseIfHudMalformed(who: string, hud: unknown): void {
  const problemas = hudNumbersProblems(hud);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** Malformed game options are a program defect, refused like the declaration (ADR-0169): the engine would not know what to draw. */
function refuseIfOptionsMalformed(who: string, options: unknown): void {
  const problemas = gameOptionsProblems(options);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A malformed `howToPlay` is a program defect, refused like the declaration (ADR-0169): the help would not know what to show. */
function refuseIfHowToPlayMalformed(who: string, slides: unknown): void {
  const problemas = howToPlayProblems(slides);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** The ids the engine announces and draws into. Without them a child who listens hears nothing (finding 6). */
const REQUIRED_MARKUP: readonly string[] = ['#game-region', '#sr-status', '#sr-alert'];

/**
 * Where the engine looks for the accessibility bar when the game does not declare `host.a11yBarHost`.
 *
 * ⚠️ NOT IN `REQUIRED_MARKUP` on purpose, and the difference is one of message, not of rigour. That list produces «the
 * page lacks #x», which is what one says of an id the game forgot. What is missing here is not an id — it is the whole
 * bar, and its own sentence can say WHAT is lost, which is what makes it useful to whoever reads it first.
 */
const A11Y_BAR_SELECTOR = '#title-icons';

/**
 * The engine's own controls that stay pressable by key IN PLAY: the accessibility bar's icons, in `#title-icons` and in the
 * HUD. A key that activates one of them is that control's, and play does not hear it (`input/key-default`, ADR-0111 errata of
 * 2026-09-26).
 */
const ENGINE_CONTROLS_IN_PLAY = '.pi-btn';

/**
 * THE GAME'S HALF of `CreateGameOptions` — the fields ADR-0139 §1 says a cartridge SUPPLIES, apart from the ones that
 * describe the page and the device.
 *
 * The test that record gives: could a PAGE answer this without knowing which game runs? If not, the field is here.
 */
type GameHalf = Pick<CreateGameOptions,
  'declaration' | 'isNavigable' | 'withIndex' | 'onBar' | 'navBar' | 'players' | 'setPhase'
  | 'sonarPlayers' | 'isBlindMode' | 'preset' | 'declines' | 'getPauseActs' | 'setPauseActor'
  | 'setPlayerTheme' | 'setPlayerCorrection' | 'accommodations' | 'genre' | 'onScreenPad' | 'hud' | 'gameOptions' | 'howToPlay' | 'onCommand' | 'gamepad'
  | 'dictionaries'>;

/**
 * Switches the engine on for a declared game.
 *
 * ⚠️ THROWS if the declaration is malformed, and does NOT throw if markup is missing. The difference is not taste: a
 * wrong declaration is a PROGRAM defect, and a game that runs half-declared is worse than one that does not open; a
 * missing id is a gap of the HOST, and the quiz proved that switching on only the part that serves is legitimate —
 * that is how it declined the pad and the sonar without lying. So one becomes an exception and the other `problems`.
 */
export function createGame(o: CreateGameOptions): Engine {
  /*
   * THE CURRENT CARTRIDGE, which starts as the options that arrived.
   *
   * 📌 Every read of the game's half goes through `cartridge`, which is the PLACE `mount()` writes (ADR-0142): a read
   * tied to the argument would leave a root serving several cartridges with the first of them forever.
   */
  let cartridge: GameHalf = o;

  const contractProblems = conformanceProblems(cartridge.declaration);
  if (contractProblems.length) {
    refuseDeclaration('createGame', contractProblems);
  }
  refuseIfItClaimsStart('createGame', cartridge.preset);
  refuseIfNoAnswer('createGame', cartridge.accommodations);
  refuseIfGenreRefused('createGame', cartridge.genre);
  refuseIfHudMalformed('createGame', cartridge.hud);
  refuseIfOptionsMalformed('createGame', cartridge.gameOptions);
  refuseIfHowToPlayMalformed('createGame', cartridge.howToPlay);

  const { doc } = o.host;
  /*
   * 🔴 THE WINDOW THIS ROOT LISTENS ON IS A SCOPED ONE, and it is not plumbing: a root installs about thirty listeners on the
   * window and, until this line existed, NOTHING COULD TAKE THEM OFF. A root whose host was removed from the document kept
   * listening, and because every query it makes is document-wide (`getPauseMenu` below is `doc.querySelector('#vp-pause-0')`) it
   * drove the NEXT root's pause card: measured in the browser, one ArrowDown moved the cursor one item with one root, two with a
   * second, three with a third. `dispose()` is the end of life this had never had. See `platform/listener-scope`.
   */
  const listeners = createListenerScope(o.host.win);
  const win = listeners.win;
  /*
   * 🔴 AND THE REST OF WHAT THIS ROOT HOLDS ENDS WITH IT (ADR-0220): the window's scope never saw the STATE BUS, which keeps
   * its subscribers for the whole page. So every `state.on` of this root goes through `stateOn`, and whatever a subscription
   * started (the scan's frames, the recogniser, the camera) hands its stop to `whenDisposed`. `dispose()` runs them all;
   * `unmount()` runs none, because it releases the cartridge and the root goes on hearing (ADR-0142).
   */
  const endOfLife: (() => void)[] = [];
  const whenDisposed = (release: () => void): void => { endOfLife.push(release); };
  const stateOn: SettingsStore['on'] = (evt, fn) => { const off = state.on(evt, fn); whenDisposed(off); return off; };
  /*
   * 🔴 THE PAGE'S ONE STORE IS BUILT HERE, from what the HOST lends (ADR-0232 point 2, issue #207): the backend the host
   * passed, or its window's `localStorage`. Every module below that persists receives THIS store; none reaches the global.
   * Reading `win.localStorage` can itself THROW (file://, some private modes), which is a host with no storage: `null`.
   */
  const store = createStorage(hostStorage(o.host));
  /*
   * THE ROOT'S TRANSLATOR (ADR-0232 D3): the page's language as this root speaks it, the game's dictionary, and this root's
   * `t`, markup pass and door to a language change. `core/i18n` holds none of it (erratum of 2026-09-25).
   * 🔴 ITS PORT IS THE STORED LANGUAGE **AND** THE BROWSER'S (ADR-0221 step 7g): the page effects — writing `<html lang>`,
   * dispatching on the window, reading `navigator.language`, hearing another root switch — come in through `localeHostHooks`,
   * which is THIS root's host speaking: the document and the scoped window it received, never the globals.
   * `localeOn` is its door — like `stateOn`, whatever subscribes through it is released by `dispose()` (ADR-0220).
   */
  const translator = createTranslator({
    ...store, KEYS, ...localeHostHooks(doc as Document, win, (root) => { translator.applyDom(root); }),
  });
  for (const [code, entries] of Object.entries(o.dictionaries ?? {})) translator.registerDict(code, entries);
  // 📌 The root's own words go through ITS translator, which reads this game's dictionary (ADR-0232 D3).
  const { t, bcp47, word } = translator;
  const localeOn = (react: (locale: string) => void): (() => void) => { const off = translator.onChange(react); whenDisposed(off); return off; };
  /**
   * THE GAME'S POSITIONS IN WORDS, resolved NOW from its keys (ADR-0232 D3, erratum of 2026-09-25). A function and never a
   * value: every surface that shows a position asks at its drawing, so a language change reaches all of them at once.
   */
  const actionWords = (): ActionWords => (cartridge.preset ? wordsOf(cartridge.preset, word) : {});
  // THE CHILD'S STORED SETTINGS, FIRST (ADR-0178): nothing below reads or writes one before this.
  // ⚠️ The port of ADR-0178 carries the key names beside the store, so `core` names no storage place itself.
  const state = createSettingsStore({ ...store, KEYS });
  // THIS ROOT'S INPUT STATE (ADR-0232 D4): held keys and their sources, the transport in use per player, the pads' frames.
  // Destructured so the call sites below read as they did; a game reads the same object as `Engine.input`.
  const input = createInputState();
  const { inputOf, keys, markKeyFrom, releaseKey, playerEdge, letGoOfTheKeyboard } = input;
  // 📌 And the debugging exposure: whoever HAS a window is this root, and what it exposes is its translator.
  exposeI18n(win, translator);
  /*
   * ⚠️ A READER AND NOT A SNAPSHOT. `declines` belongs to the GAME's half (ADR-0139: the cartridge declares what it does
   * NOT have), so a `const` taken at boot would return, after a `mount()`, the previous cartridge's declines — and a
   * decline read wrong hides a line of `problems` or invents one.
   *
   * 📌 The empty value is a constant and not a literal per call: `declines()` is read in places that compare.
   */
  const NO_DECLINES: Declinios = {};
  const declines = () => cartridge.declines ?? NO_DECLINES;
  const hostProblems: string[] = [];

  const $ = <T extends Element = Element>(sel: string): T | null => doc.querySelector<T>(sel);
  const $$ = <T extends Element = Element>(sel: string): T[] => [...doc.querySelectorAll<T>(sel)];
  /*
   * THIS ROOT'S ANNOUNCER AND DEAF MODE (ADR-0232 D4, ADR-0234): the screen reader's two regions written in the HOST's
   * document on the host's frames, and deaf mode over its store. A window with no frames (a test double) is the announcer's to answer.
   * 📌 Deaf mode hands the interpreter what the SONAR reads — the text on screen (`ui/screen-text`) — never the announcements,
   * and that text is spoken with the mode off. The interpreter is the host's; else the free Libras player the DELIVERY shipped
   * (`ui/libras-avatar-player`, ADR-0234 route B), opened from the page's own origin at the first request — three.js arrives
   * with it, never before; and where the delivery shipped none, that player answers as `NO_INTERPRETER` does — the sonar's text
   * is captioned, and «signing unavailable» goes to `problems` and to the child. The ports it calls later (`tts`, the caption,
   * `measuredProblems`) are read when it calls.
   */
  const announcer = createAnnouncer({
    doc,
    raf: win.requestAnimationFrame, // as the host has it: the announcer answers a window with none (bound by the listener scope)
  });
  const { say: srSay, alert: srAlert } = announcer;
  const deafMode = createDeafMode({
    store,
    captionsSetting: () => state.captionsOn,
    t: translator.t,
    interpreter: hostInterpreter(o.host, () => createLibrasAvatarInterpreter({
      doc, win, fetch: win.fetch, base: doc.baseURI, title: () => t('sr.deaf.interpreter'),
    })),
    speak: (text) => { tts.narrate(text); },
    caption: (text) => { writeSoundCaption(text); },
    tell: srSay,
    report: (line) => { measuredProblems.push(line); },
  });
  whenDisposed(deafMode.dispose);
  for (const sel of REQUIRED_MARKUP) {
    if (!$(sel)) hostProblems.push(`the page lacks ${sel}: the engine announces and draws into it, and without it a child who listens hears nothing — add it to the page`);
  }

  // ⚠️ THE DECLARED WORLD MUST EXIST IN THE DOCUMENT, the gap ADR-0087 would leave open if it stopped at conformance.
  // `conformanceProblems` checks the SHAPE — that there is a selector and it is not empty — and cannot check whether it
  // MATCHES anything, because `core/contract` is pure and sees no DOM.
  //
  // A selector with a typo (`#gaem-region`) passes conformance and produces exactly the defect that record exists to
  // remove: the empathy simulation applied to NOTHING, and an adult told they felt something they did not. It is a
  // HOST problem and not a program one, so it goes into `problems` like the markup — the game opens, and whoever
  // integrated it reads that their world is not there.
  /*
   * `problems` HAS TWO HALVES. The HOST's lines (`hostProblems`) are measured once at boot and hold for as long as the
   * page does: they are about the page, not the game, and do not change when a cartridge is swapped. The CARTRIDGE's
   * lines are measured again at every read, so they follow `mount()`. Recomputing everything would drop host
   * diagnoses nobody fixed; recomputing nothing would leave the diagnosis talking about the wrong game.
   */
  /**
   * The VIRTUAL CONTROLLER's gaps for this cartridge. Starts empty and is replaced once the pad is mounted, below:
   * `measureCartridgeProblems` runs only when `problems` is read, after boot, but reading the pad from here before it
   * exists would fall into the temporal dead zone.
   */
  let padGapProblems: () => string[] = () => [];

  /*
   * 🔴 THE RULES LIVE IN `core/cartridge-problems` (ADR-0221 step 7c). What stays here is MEASURING the page and answering
   * that module; what is a decision — the rules, the order of the lines, when to keep quiet — lives where a sentence can
   * be read whole. A composition root is big on purpose and carries WIRING; branches are logic, and ADR-0221's erratum
   * measures a root's debt in branches.
   */
  function measureCartridgeProblems(): string[] {
    const declaredWorld = cartridge.declaration.world();
    const worldCssSelector = declaredWorld.kind === 'element' ? declaredWorld.selector : null;
    return cartridgeProblems(
      {
        padGaps: padGapProblems(),
        resizedRegion: regionResizedByCartridge(),
        drawnBelowFloor: drawnBelowTheFloor(drawingContext),
        genreWarning: genreWarning(cartridge.genre),
      },
      {
        worldSelector: worldCssSelector,
        worldIsInPage: !!worldCssSelector && !!$(worldCssSelector),
        wantsNeuralVoice: !!o.uses?.neuralVoice,
        declinesNeuralVoice: !!declines().noNeuralVoice,
        seats: (cartridge.players ?? []).length,
        setsPauseActor: !!cartridge.setPauseActor,
        declinesPauseActor: !!declines().noPauseActor,
      },
    );
  }

  // 1. LANGUAGE BEFORE EVERYTHING. The interface cannot be built before the language is known. The document goes in:
  //    see finding 15.
  translator.init(doc); // the host's markup, with THIS game's dictionary too, and the stored or preferred language asked for

  // 2. MIXER BEFORE VOICE. Finding 3 turned into sequence: `createAudio` loads the mixer, and the voice reads it.
  //    🔴 THE BROWSER'S SOUND AND SPEECH ARE LENT HERE, from the host's window (ADR-0232 D4): the audio context — made at the
  //    first sound, never at boot, so it is born inside the child's gesture and the browser lets it run — and the speech
  //    synthesis the voice speaks through. The sonar's per-player contexts come from the same maker.
  const audioHost = win as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const newAudioContext = (): AudioContext | null => {
    const AC = audioHost.AudioContext ?? audioHost.webkitAudioContext;
    return AC ? new AC() : null;
  };
  const speechHost = win as unknown as { speechSynthesis?: SpeechSynthesis; SpeechSynthesisUtterance: typeof SpeechSynthesisUtterance };
  const speech: SpeechPort = {
    synth: () => speechHost.speechSynthesis ?? null,
    utterance: (text) => new speechHost.SpeechSynthesisUtterance(text),
  };
  /*
   * THE DEVICE'S VOICES ARRIVE LATE, AND TWO THINGS FOLLOW THEM (ADR-0185 §4, erratum 2026-09-26): the hearing panel's speech rows
   * and the 🗣 of the bars. The page has ONE `onvoiceschanged` slot, so this root takes it once and hands each change to every
   * listener. The last root takes the slot, and an ended root empties it only if it is still its own (ADR-0220).
   */
  const voicesListeners: (() => void)[] = [];
  const voicesChanged = (): void => { for (const again of voicesListeners) again(); };
  const whenVoicesChange = (again: () => void): void => {
    voicesListeners.push(again);
    if (voicesListeners.length > 1) return;
    try { if (speechHost.speechSynthesis) speechHost.speechSynthesis.onvoiceschanged = voicesChanged; } catch (e) { /* noop */ }
    whenDisposed(() => {
      try { if (speechHost.speechSynthesis?.onvoiceschanged === voicesChanged) speechHost.speechSynthesis.onvoiceschanged = null; } catch (e) { /* noop */ }
    });
  };
  /*
   * THE ENGINE'S OWN KOKORO LOADER (ADR-0216 §1 and §5) — the Dev, 2026-09-21: «O jogo não deve precisar saber como isso funciona».
   * ⚠️ IMPORTED AT THE FIRST NEURAL UTTERANCE AND NOT BEFORE: `kokoro-runtime` is what names espeak-ng and the ONNX runtime, so a
   * game that never speaks neurally never loads a byte of them — which is the whole reason this is an `import()` and not an
   * import. The page's address, `fetch` and WebAssembly are the host's.
   */
  const wasmHost = (win as unknown as { WebAssembly: typeof WebAssembly }).WebAssembly;
  const loadKokoro: LoadKokoro = () => import('../platform/kokoro-runtime.js').then((m) => m.loadKokoroRuntime({
    base: doc.baseURI,
    fetch: (url) => win.fetch(url),
    compileWasm: (bytes) => wasmHost.compile(bytes),
    instantiateWasm: (module, imports) => wasmHost.instantiate(module, imports),
  }));
  const mixer = createAudio({ newContext: newAudioContext, store });
  const { ensureAC, catNode, audioOut, setSoundOn, setVolume, tonePan, setCatGain, setHearingLossGraph } = mixer;
  const tts = createTts({
    store, translator, srSay, srAlert, ensureAC, catNode, audioOut,
    getSoundOn: () => mixer.soundOn, getVolume: () => mixer.volume, getAudioCat: () => mixer.audioCat,
    neuralVoice: !!o.uses?.neuralVoice, // ADR-0216 §3: the game says it wants one; the engine loads it
    loadKokoro,
    getSpeechPpm: () => state.speechPpm, // ADR-0183 §1: the child's speech rate
    createAudio: () => doc.createElement('audio'),
    speech,
    now: () => win.performance.now(),
    // a part in a language the device has no voice for (ADR-0243 §3); `measuredProblems` is declared below and read when it calls
    report: (line) => { if (!measuredProblems.includes(line)) measuredProblems.push(line); },
  });
  // 📌 The neural-voice line lives in `measureCartridgeProblems()`: the decline that silences it is the game's.

  /**
   * THE VISION FILTER, applied to THE WORLD THE GAME DECLARED (ADR-0087).
   *
   * ⚠️ THE RULE OF MENUS IS A GENERALISATION, not a second rule. A CSS filter is inherited, so a menu inside the world
   * would be filtered with it — a blindness simulation would black out the pause menu and lock the child inside it
   * (#82). A world with nothing inside it (the 15-puzzle) is untouched by the same line. One code serves both shapes
   * because it asks the DOM instead of assuming the shape: it clears the filter on the overlays that ARE inside the
   * world.
   *
   * ⚠️ `{kind:'none'}` APPLIES NOTHING. An activity with no space has no world to simulate, and painting a filter over
   * it would be the lie ADR-0087 exists to prevent, only backwards.
   */
  function setVisionFilter(css: string, reach: FilterReach): void {
    const declaredWorld = cartridge.declaration.world();
    if (declaredWorld.kind !== 'element') return;
    const el = $<HTMLElement>(declaredWorld.selector);
    if (!el) return; // already reported in `problems`; no surface is invented
    el.style.filter = css;
    if (reach === 'mundo') {
      // Menus live ABOVE the simulation and are the way out of it: if they inherited the filter by being inside the
      // world, it is undone on them.
      for (const ov of $$<HTMLElement>(OVERLAY_SCOPE_SELECTOR)) {
        if (el.contains(ov)) ov.style.filter = '';
      }
    }
  }

  /*
   * THE WORLD'S FILTER IS A COMPOSITION: the 🚥's colour correction and the L→Q contrast enhancement (ADR-0151). Written
   * apart, the second writer erased the first — turning the enhancement on turned off the correction a colour-blind
   * child had set. Each writer keeps its part and asks for the composition.
   */
  // The visual state the WORLD shows: the correction (🚥) and the simulation (empathy mode) are two fields of it, and
  // `filterKey` already knows the simulation runs only with the correction at its default (ADR-0076).
  let worldState: VisualState = DEFAULT_VISUAL;
  /*
   * A DISABILITY SIMULATION RUNS IN THE GAME, NEVER IN A MENU (issue #182). The Dev: «Simulação de deficiência não pode
   * funcionar no menu! Só no jogo! Senão fica impossível desabilitar em certos casos.» Two rules make it so:
   *   · SUSPENDED while a menu is open — the pause card, a panel, the quick pause — and back when the child returns to play;
   *   · NEVER ON AN ANCESTOR OF A MENU: a CSS filter reaches every descendant, and clearing it on the child does not undo it.
   *     📏 In the quiz the world is the whole region, menus inside it: a simulated blindness blacked out the empathy panel
   *     where it is turned off. So the filter goes on the world's parts that hold no menu, down to the world itself when
   *     it holds none (a canvas world).
   */
  /** Assigned once the menus exist (below): until then no menu can be open. */
  let simulationSuspended = (): boolean => false;
  /*
   * 🔴 WHERE THE SIMULATION LANDS lives in `ui/simulation-over-the-world` (ADR-0221 step 7c). Going down into a box that
   * holds a door, sending the layer to a canvas's parent because a canvas has no children, keeping what HELPS under what
   * SIMULATES: those are rules with reasons, not wiring.
   */
  const simulationOverWorld = createSimulationOverTheWorld({
    world: () => cartridge.declaration.world(),
    find: <T extends Element>(sel: string) => $<T>(sel),
    createCanvas: () => doc.createElement('canvas'),
  });
  function recomposeWorldFilter(): void {
    // what HELPS (the colour correction, the contrast enhancement) stays on the world as before; the SIMULATION is laid apart
    const enhancementKey = filterKey({ ...worldState, simulacao: null });
    const enhancement = [enhancementKey ? (VIZ_FILTER[enhancementKey] ?? '') : '', lq.filter()].filter(Boolean).join(' ');
    setVisionFilter(enhancement, 'mundo');
    const simulation = simulationSuspended() ? null : worldState.simulacao;
    simulationOverWorld.onlyInPlay(simulation ? (VIZ_FILTER[simulation] ?? '') : '', enhancement);
    simulationOverWorld.drawLayer(simulation);
    applyCrt(); // the decorative CRT yields to the visual modes, and comes back when none is on (ADR-0047, ADR-0241)
  }
  /*
   * WHICH VISUAL MODES ARE ON — decided here, once: a colour correction or a simulation (the world filter), the game's
   * high-contrast theme, the contrast enhancement. A colour-vision mode ON ITS OWN only changes hue (ADR-0241).
   */
  const visualModeOn = (): boolean => filterKey(worldState) !== null || hasHighContrast(worldState) || lq.t() > 0;
  const onlyHueChanges = (): boolean => lq.t() === 0 && onlyColourVision(worldState);
  /*
   * THE CRT, applied by the engine (study items A5, B1). 📏 Measured: the panel said «Scanlines: on» and the region had no
   * CRT class until a toggle was pressed — `render/crt` was never started under `createGame`. The vignette yields to every
   * visual mode; the scanline to every one but a colour-vision mode on its own (ADR-0241). Its scanlines are re-anchored
   * to real pixels at every scale.
   */
  const crt: Crt = createCrt({
    region: () => $<HTMLElement>('#game-region'),
    win,
    // `cartucho` and not `players()`: this runs at boot, above the `players` declaration (temporal dead zone)
    numPlayers: () => Math.max(1, (cartridge.players ?? []).length),
    scanlineYields: () => visualModeOn() && !onlyHueChanges(),
    vignetteYields: visualModeOn,
    store,
  });
  const { apply: applyCrt, scanVars: crtScanVars } = crt;
  const lq: LqFilter = createLqFilter({ doc, onChange: recomposeWorldFilter, store });
  if (lq.t() > 0) recomposeWorldFilter(); // the stored enhancement holds from boot
  else applyCrt(); // and the stored CRT too (the recompose above applies it when it runs)

  // 3. The dialog stack. The ctx is the same in every game — it is boilerplate, and repeated boilerplate is where
  //    consumers diverge without meaning to.
  const overlays = initSettingsPanel({
    t: translator.t, $, $$, doc,
    computedZ: (el) => +win.getComputedStyle(el).zIndex || 0,
  });

  // 4. Colour vision: the engine HANDS OVER the markup instead of making the consumer guess it (finding 7).
  const cvdFilters = installCvdFilters(o.host.cvdHost ?? null);
  if (!cvdFilters) hostProblems.push('there is no filter host (<svg>): colour-vision correction was not mounted, so a colour-blind child cannot turn it on — set `host.cvdHost`');

  // 4c. THE FIRST SCREEN'S ACCESSIBILITY BAR. See the note on `EngineHost.a11yBarHost`. This block only reports that it
  //     is missing, with a sentence that names the way out; the bar is mounted further below, once the icons exist.
  const a11yBar = o.host.a11yBarHost ?? $(A11Y_BAR_SELECTOR);
  if (!a11yBar) {
    hostProblems.push(
      `there is no accessibility bar on the first screen: a child cannot reach blind mode, narration or Libras before starting — set \`host.a11yBarHost\` or put a ${A11Y_BAR_SELECTOR} in the page`,
    );
  }

  /*
   * ⚠️ THE ENGINE MOUNTS IT (ADR-0106 §4, step 2): step 1 took from the game the duty of answering the seven incidental
   * fields, and step 3 gave the menu a default list, so `PauseIconsCtx` demands nothing this root cannot answer.
   *
   * ⚠️ IT IS NOT `buildQuickBar`, and the difference has a reason: that one sets `tabIndex = -1` on the buttons because
   * during play ten tab stops separate the child from the game (ADR-0044 item 7). On the first screen nobody is playing,
   * and taking the icons out of the tab order there would hide them from whoever navigates by keyboard — exactly the
   * person they exist for.
   */
  /**
   * THE BLIND-MODE READER — and it must read WHERE THE DEFAULT WRITER WRITES.
   *
   * 🔴 The writer's default is the engine's (`ui/pause-icons`: `ctx.setBlindMode ?? setBlindModeValue`), which stores
   * in `core/state`. A reader that answered a CONSTANT `false` made blind mode impossible to turn off in a game that does
   * not inject `isBlindMode`: the first press turned it on; the reflection read `false` and the icon said off; the
   * second press wrote `true` AGAIN, `core/state`'s equality guard returned early, and nothing happened. A game that
   * starts describing everything aloud and never stops, with no error anywhere.
   *
   * 📌 ONE CONSTANT AND NOT THE EXPRESSION REPEATED IN TWO PLACES, because repetition IS the defect: two answers to the
   * same question drift. The store's `blindMode` is a LIVE getter, so this reads the value of now and not of boot.
   */
  const readBlindMode = cartridge.isBlindMode ?? (() => state.blindMode);

  /**
   * WHAT THE ENGINE CAN ACT ON BY ITSELF IN THE PAUSE MENU — filled below, read when the pause opens.
   *
   * 🔴 Without it, a game that calls only `createGame` got a pause card of one item: with an empty table
   * `itemsThatAct` keeps only the `ENGINE_ITEMS`, and `rootThatActs` also drops `options` — «uma porta para uma sala
   * vazia». A pause menu with one item is not a pause menu.
   *
   * ⚠️ MUTABLE AND READ LATE, on purpose, which is what the field's laziness is for: `initPauseIcons` runs here and the
   * panels mount further below. `refreshPauseItems` evaluates it when the pause OPENS, not at mounting; reading the
   * table now would freeze an empty object.
   *
   * 📌 AND THE CARTRIDGE OVERRIDES, not the other way round: a game that brings its own entry wins over the engine's.
   * What ADR-0122 makes non-declinable is that the pause EXISTS, not that the engine owns every item in it.
   */
  const engineActions: Record<string, () => void> = {};
  /** Opens the game options panel, once mounted (ADR-0182). Offered as the door's action only while the cartridge declares rows. */
  let openGameOptions: (() => void) | null = null;
  let redrawGameOptions = (): void => {};

  /*
   * ===================== THE WAY OUT, BORN WITH THE WAY IN (ADR-0144, erratum) =====================
   *
   * 🔴 `resume` is not in `ENGINE_ITEMS`, so without this entry `itemsThatAct` cut «continuar» from the card of EVERY game
   * that calls only `createGame`; and Escape at the card's root calls `setPhase('playing')` (`ui/menu-nav`), which with
   * no hook was a no-op. Both go through `changePhase` now.
   *
   * ⚠️ OPENING A DOOR WITH NO WAY OUT IS WORSE THAN NOT OPENING IT. It is ADR-0106 §5 in so many words, and the child
   * stuck on the card would be precisely the one who navigates without seeing, who has no mouse to fall back on.
   *
   * 📌 It also unlocks a third thing: `enterBarMode` in `ui/pause-icons` calls `resume` before handing the directional
   * to the bar, so ADR-0044's item 7 is reachable from any game.
   *
   * 📌 THE CARTRIDGE STILL OVERRIDES (the order of the spread in `getPauseActs` does not change): a game with its own
   * «continuar» — because resuming there means unfreezing physics, resuming audio and more — wins over this one. What the
   * engine guarantees is that there is ALWAYS one.
   */
  // The screen footer (see `screenFooter`): declared HERE, before the first `changePhase`, which already clears it.
  let footer: HTMLElement | null = null;
  let barExplanation: HTMLElement | null = null;
  /*
   * WHO HOLDS THE EXPLANATION BAND (ADR-0244): the GAME's text is the band's resting text (`Engine.explain`); an engine item —
   * a quick-bar icon, a pause-card item, a locked item's reason — takes the band while it is pointed and gives it back.
   */
  let gameExplanation: string | null = null;
  let itemExplanation: string | null = null;
  // The quick-pause state and the button legend, declared before the first `changePhase` too: its `pauseControls.hide`
  // refreshes the legend (ADR-0164 rule 3), and reading them earlier would be a temporal-dead-zone error at boot.
  const inQuickPause = new Set<number>();
  // the menus and the quick pause exist from here on: a simulation is suspended while one is open (issue #182)
  simulationSuspended = () => isMenuOpen() || inQuickPause.size > 0;
  let pauseCaption: HTMLElement | null = null;
  function changePhase(p: 'title' | 'playing' | 'paused'): void {
    // ⚠️ THE ENGINE CLOSES ITS CARD; THE GAME STILL DECIDES THE WORLD. It is the exact symmetry of ADR-0144 §2 from the
    // other side: there the engine reveals and ASKS for the pause, here it hides and ASKS for the resume.
    if (p !== 'paused') { pauseControls.hide(0); writeInFooter(null); } // an item's reason does not stay over the game
    cartridge.setPhase?.(p);
  }
  engineActions.resume = () => changePhase('playing');

  /*
   * QUIT — «voltar à tela de press start» (the Dev's decision, 2026-09-12; erratum of ADR-0144 §5).
   *
   * 🔴 ADR-0144 §5 had left this OPEN on purpose, because the wrong answer loses a child's game: reload? `history.back()`?
   * an activities menu that may not exist? The answer is none of the three — it is a PHASE the project already has a
   * name and a contract for.
   *
   * ⚠️ AND THE EDGE IS STATED: `ui/shell`, which draws that screen, is deliberately not mounted by this root. The engine
   * hides its card and ASKS for the phase; a game without the hook stays where it is. It is the same asymmetry as
   * `setPhase('paused')` in ADR-0144 §2, and that is why the gate asserts the CALL.
   *
   * 📌 NO CONFIRMATION, and that is a choice, not an omission. The ring puts `quit` one step from `resume` (ADR-0044
   * item 1), which makes it easy to reach by mistake — but ADR-0037 decides: this project saves nothing, so what is lost
   * is the current round and not progress. A confirmation dialog would cost one more stop in the scan of EVERY exit to
   * protect what does not exist.
   */
  engineActions.quit = () => changePhase('title');

  /** Print mode is armed: the next key is its way out, and not play's (read by the keyboard conductor). */
  let printArmed = false;

  /*
   * PRINT — «ver a tela sem menus», and any button comes back.
   *
   * 📌 `ui/shell.printMode` does this, and `ui/shell` is not mounted by this root. But it needs no phase machine: it needs
   * the cards, the window and the announcement — three things the engine has. Rewritten here with the SAME behaviour,
   * including the delay.
   *
   * ⚠️ THE 80 ms ARE NOT SUPERSTITION: without them, the very event that TRIGGERED print is what undoes it — the child
   * presses once and sees the clean screen blink.
   *
   * 📌 IN CAPTURE, not bubbling, because the point is to intercept BEFORE anyone else: in print mode the key belongs
   * neither to the game nor to the pause, it is the way out. 🎯 And it does not collide with the `start` hook (ADR-0144),
   * which bubbles: `goBack` reveals the card in the capture, and when the bubbling one arrives the card-already-open
   * guard sends it away.
   *
   * 🔴 AND THE KEY THAT ENDS IT IS NOT PLAYED (ADR-0111 erratum of 2026-09-26, one key one action). `goBack` is added after
   * the keyboard conductor, on the same node and phase, so the conductor runs first and saw no menu: 📏 on the served quiz
   * the arrow that ended print mode also moved the quiz's cursor. The conductor reads `printArmed` instead. Not
   * `stopImmediatePropagation`: the cool-down, the motor filter and the pad's hiding listen after, and must still see the key.
   */
  engineActions.print = () => {
    const findPauseCard = (): HTMLElement | null => $<HTMLElement>('#vp-pause-0');
    const eventTarget = findPauseCard();
    if (!eventTarget) return;
    eventTarget.hidden = true;
    const goBack = (e?: Event): void => {
      printArmed = false;
      if (e && typeof e.preventDefault === 'function') { try { e.preventDefault(); } catch { /* noop */ } }
      win.removeEventListener('keydown', goBack, true);
      win.removeEventListener('pointerdown', goBack, true);
      const c = findPauseCard();
      if (c) c.hidden = false;
    };
    win.setTimeout(() => {
      printArmed = true;
      win.addEventListener('keydown', goBack, true);
      win.addEventListener('pointerdown', goBack, true);
    }, 80);
    srSay(t('sr.print.on'));
  };

  /**
   * THE HEARING PANEL, resolved late and read early — the same laziness as `engineActions` above, for the same reason:
   * `initPauseIcons` runs here and the panels mount further below.
   *
   * 🔴 IT IS A `let` BECAUSE OF A DEFECT KEPT VERBATIM. `ui/pause-icons` documents it: in the monolith the call that
   * refreshed the narration row sat behind `typeof reflectTTS === 'function'`, a symbol that no longer existed, «so it
   * never fires». The guard was ported as `reflectTtsPanelEnabled`, defaulting to `false`, so as not to fix it
   * silently — and with a field to switch it back on.
   *
   * 🎯 THE ENGINE CAN: it mounts the panel, so it has the `reflectTts` to hand over. Without it, the child turns
   * narration on with the bar's 🗣 icon and the panel goes on saying it is off — the family of defect where a control
   * lies about its state.
   */
  let audio: SettingsAudioApi | null = null;

  /*
   * ⚠️ HOISTED ABOVE `initPauseIcons`, and the reason is ORDER, not tidiness: the bar decides WHICH ICONS it mounts at
   * boot (`iconsThatAct`, resolved once), and the 11th — the typography cycle — exists only if the typography writer
   * exists. That writer is born inside `if (pauseMountPoint && pauseUsable)`, further below; read there, the bar would
   * already have decided.
   *
   * 📌 Hoisting instead of repeating the question: `o.host.pauseHost ?? $('#game-region')` written in two places would be
   * the same answer with two sources.
   */
  const pauseMountPoint = o.host.pauseHost ?? $('#game-region');
  const pauseUsable = !!pauseMountPoint && typeof (pauseMountPoint as HTMLElement).appendChild === 'function';
  /*
   * ⚠️ `typo` IS HOISTED TOO, for the same reason: the bar's typography cycle, decided earlier, must reach it. It is still
   * assigned below; what changed is the SCOPE, not the moment.
   */
  let typo: SettingsTypoApi | null = null;
  /** The typography cycle's current position. See the note on `cycleTypography`, below. */
  let typographyStep = CYCLE_START;

  /*
   * 🔴 THE PLAYERS ARE HOISTED HERE (issue #147), for an order-of-boot reason: `initPauseIcons` consumes `getPlayers()`
   * EAGERLY (when building the audio sub-ctx), so a `players` declared lower down fell into the temporal dead zone and
   * brought the boot down. And with the bar reading `cartridge.players ?? []` instead, a game that declares no players
   * had ZERO seats for the bar and ONE for the keyboard, and the bar's cycles (🚥 correction, ☝️, ASD) stuck on the
   * first position: the state had nowhere to be kept and each press re-read the default.
   */
  // ⚠️ THE BOOT SCHEME REACHES NOTHING, and says so with `null` instead of with an empty object (issue #118). It lives an
  // instant — `assignControls()` just below replaces it with the real scheme — but while it lives it is a `KeyScheme` like
  // any other, and the only honest form of a scheme that reaches nothing is fourteen declared absences. A `{}` made the
  // type lie about being complete.
  const withoutReach = Object.fromEntries(ACTIONS.map((a) => [a, null])) as KeyScheme;
  // ⚠️ THE FALLBACK IS A CONSTANT and not a new literal per call: `getPlayers` is read by the keyboard runtime at every
  // control read, and returning a new array each time would make any identity comparison lie — a defect that shows
  // only in whoever compares, and late.
  const withoutPlayers = [{ ctrl: withoutReach }];
  // ⚠️ IT READS `cartridge.players`, NOT A SNAPSHOT: with several cartridges on one composition root (ADR-0142), a `const`
  // taken at boot would leave the keyboard with the players of the cartridge that booted first.
  const players = () => cartridge.players ?? withoutPlayers;

  /*
   * THE COLOUR-BLIND-SAFE PALETTE IN THE MENUS AND THE HUD (ADR-0151) — Okabe-Ito, through `:root[data-paleta]`.
   *
   * 📌 `core/state.cbSafe` stores, persists and notifies; this is its writer on the page. The colours, and the measure
   * that chose them, are in the stylesheet (`style.css`, beside `data-cursiva`).
   *
   * 🎯 THE RULE IS THE DEV'S, in their words: «ativada automaticamente quando se liga correção para protano,
   * deutero e tritanopia e desativada automaticamente quando muda para visão padrão (tricromática). Aqui se
   * permite ativá-la sem usar o filtro.» So the state is ONE (`cbSafe`), and the correction only pushes it.
   */
  const applySafePalette = (on: boolean): void => {
    if (on) doc.documentElement.dataset.paleta = 'okabe-ito';
    else delete doc.documentElement.dataset.paleta;
  };
  applySafePalette(state.cbSafe);
  stateOn('cbSafe', (v) => applySafePalette(Boolean(v)));
  /**
   * Wraps ANY correction writer — the cartridge's or the engine's: the palette follows the correction whoever applies it.
   * ⚠️ Wrapping only the engine's would leave a game that corrects in its own render (`game-pinball`) without the palette
   * the child asked for by pressing the same icon.
   */
  function withSafePalette(write: (i: number, correction: Correction) => void): (i: number, correction: Correction) => void {
    return (i, correction) => {
      write(i, correction);
      state.setCbSafeValue(correction !== 'tricro');
    };
  }

  // 📌 ONE DOOR FOR BOTH, and the name says so since 2026-09-21: getUserMedia is what a page has to ask the camera AND the
  // microphone for. It used to be called «temCamera» and the 👄 read it anyway — a name that describes half of what it answers is
  // how a device with a headset and no webcam would have lost the voice for a reason nobody could see in the code.
  const canCaptureMedia = typeof win.navigator?.mediaDevices?.getUserMedia === 'function';
  /*
   * ONE SET OF SCENE REDUCED-MOTION FLAGS, built here and handed to BOTH writers — the quick bar's calm icon and the motion
   * panel (ADR-0232: state is built by the root). Left to themselves each read its own copy from storage, so the panel
   * showed the scene animated after the calm mode reduced it, and its next switch stored that stale copy over the calm mode.
   * The object is mutated in place; its identity is what the two share.
   */
  const sceneMotion = readStoredScene(store, defaultReducedMotion(win.matchMedia));
  const saveSceneMotion = (): void => { storeScene(store, sceneMotion); };
  const setGameTheme = cartridge.setPlayerTheme;
  const pauseIcons = initPauseIcons({
    translator, store,
    settings: state, // the page's settings store itself: its live bindings are the reads the bar asks for (ADR-0232)
    doc, matchMedia: win.matchMedia, // the reduced-motion default when nothing is stored (ADR-0232)
    rm: sceneMotion, saveRM: saveSceneMotion,
    /*
     * THE GAME'S ANSWER, read from the declaration (ADR-0115). Without it the `altmove` icon is not mounted.
     *
     * ⚠️ WHICH ICONS THE BAR HAS IS DECIDED ONCE, AT BOOT, and the reason is not economy — it is the child. The field is
     * a FUNCTION because ADR-0084 says a game changes its demands between phases, but the bar's COMPOSITION must not
     * change under the hand of whoever is using it: an icon that comes and goes between phases is worse than one that
     * was never there, and for someone navigating by keyboard it shifts the tab order midway.
     * 📌 So the right reading of the contract is: this game holds keys in SOME phase — a game that holds keys on foot
     * and nothing inside a vehicle declares `true`.
     */
    // ⚠️ THE REFERENCE, not the result: the ☝️'s cycle reads it again at each press, and with several cartridges on one
    // composition root (ADR-0142) it must describe the mounted one.
    holdsKeys: () => cartridge.declaration.holdsKeys(),
    // how many positions this cartridge declared — what «one button only» would have to offer (ADR-0218, issue #201)
    declaredPositions: () => (cartridge.preset ? presetActions(cartridge.preset).length : 0),
    // the hourglass is offered where time runs by itself (ADR-0180), read per cartridge
    clock: () => cartridge.declaration.tick === 'clock',
    // the 📷 is offered where there is a camera to ask for (ADR-0215); the three camera controls below follow its position
    camera: canCaptureMedia,
    // and the 👄 where there is a MICROPHONE (issue #184) — the same door as the camera's, so the same answer
    microphone: canCaptureMedia,
    // the ☰, the bar's first icon (interface log 2026-09-16): the SELECT door, where there is a card to open. Hoisted, read at the press.
    ...(pauseUsable ? { openMenus: (i: number) => { openSeatMenus(i); } } : {}),
    // no voice speaks the current language: the narration icon locks like the panel's rows (ADR-0185)
    noVoice: () => tts.voices().length === 0,
    /*
     * ✅ THE SAME LIST AS THE KEYBOARD (issue #147).
     *
     * 📏 With an empty list, `iconAct('cvd', i)` re-read `(P()[i] || {}).visual` as `undefined` at every press: the cycle
     * STUCK on the first position while the icon announced different corrections — and the same for the ☝️ and ASD.
     * Since ADR-0151 the correction also switches the safe palette, which is PERSISTED, so it stuck for good.
     *
     * ⚠️ `initPauseIcons` consumes this EAGERLY, which is why `players` is hoisted above this call. A game that declares
     * no players has ONE child playing, not none.
     */
    getPlayers: () => players(),
    getNumPlayers: () => players().length,
    srSay, srAlert,
    // Leaving the bar is leaving the quick pause, by any door (ADR-0155). Hoisted function, read when called.
    onLeaveBar: (i, silent) => endQuickPause(i, silent),
    // What the pointed icon DOES goes to the footer (hoisted function, read when called).
    explainIcon: (_i, k) => explainIconInFooter(k),
    explainItem: (text) => writeInFooter(text),
    // ⚠️ NOT `instanceof HTMLElement`: that is a BROWSER GLOBAL, and reading it where it does not exist THROWS — it does
    // not return false. It is the same shape of error as FINDING 15 in this file's header: reaching the global underneath
    // whoever injected the document. The right question is the one `barUsable` asks — can it be a bar?
    getA11yBars: () => (barUsable && a11yBar ? [a11yBar as HTMLElement] : []),
    getBlindMode: readBlindMode,
    getAudioCat: () => mixer.audioCat,
    setCatGain,
    /*
     * ⚠️ THE ROOT ANSWERS FOR THE DEVICE IN USE, and here ADR-0109's automaton gets its reader. `input/state.inputOf(i)`
     * returns `DEFAULT_INPUT_STATE` for whoever never produced an edge, so this is never `undefined` and the icon never
     * writes to a crooked key.
     *
     * 📌 And the ROOT passes it rather than the icon importing it: `ui/` reading module state from `input/` would be a new
     * edge between layers to save one argument. Composition is this file's job.
     */
    transportInUse: (i: number) => inputOf(i).inUse,
    // ✅ The monolith's dead guard works again — see the note on `audio`, above.
    reflectTtsPanel: () => { audio?.reflectTts(); },
    reflectTtsPanelEnabled: true,
    isLibrasOn: deafMode.isOn,
    toggleLibras: deafMode.toggle,
    /*
     * ⚠️ WHAT THE GAME HANDS OVER: the three fields are optional on both sides. Absent, the pause card holds only what the
     * engine acts on, and the two visual icons follow their own rules. See the notes in `CreateGameOptions`.
     */
    // ⚠️ ALWAYS PASSED: a cartridge's absence means only what the engine acts on, which is what ADR-0106 §1 asks for.
    getPauseActs: () => ({
      ...engineActions,
      ...(openGameOptions && cartridge.gameOptions?.length ? { opcoesdojogo: openGameOptions } : {}),
      ...(cartridge.getPauseActs ? cartridge.getPauseActs() : {}),
    }),
    /*
     * THE TYPOGRAPHY CYCLE OF THE 11th ICON (ADR-0149 §1, ADR-0150 §2).
     *
     * 🎯 ONE PRESS CHANGES THE CASE **AND** THE FACE, and that is the decision: `letterCase` (ADR-0028) and the face are
     * two settings, and Andika in capitals is ONE pedagogical choice of whoever teaches reading. A child should not
     * have to know the model to make it.
     *
     * 📌 THE POSITION LIVES HERE, in a `let` of the root, and not in `core/state`: it is derived — the case and the face
     * are each persisted on their own —, and storing an index beside what it derives from is a third place for the
     * three to drift. On reopening, the cycle restarts at the default position with the face that was left.
     *
     * ⚠️ THE COUNTRY'S HAND COMES FROM THE BCP-47 TAG of the current language, and the fallback is the COLONISER's
     * (ADR-0150): Spanish → Spain, Portuguese → Portugal, English → England. A language outside the repertoire returns an
     * empty list and the cycle has four positions — better one fewer than the hand of a country that is not that child's.
     */
    cycleTypography: pauseUsable ? (): string | null => {
      // ⚠️ `typo` is read HERE and not in the condition: it is born further below, and the condition runs now. Whether
      // the icon exists is decided by `pauseUsable`, the SAME question that decides whether the writer is born.
      if (!typo) return null;
      const cycle = typographyCycle(bcp47());
      typographyStep = (typographyStep + 1) % cycle.length;
      const position = cycle[typographyStep]!;
      state.setLetterCaseValue(position.letterCase);
      typo.setFont(position.font, false);
      /*
       * ⚠️ THE SCALE IS ALWAYS WRITTEN, not only when it is above 1. Writing only on the way up would leave the country's
       * hand in force after the child went back to Atkinson — the whole text 25% larger with nothing explaining it, and
       * her pressing the button again to try to undo it.
       * 📌 On the document root and not on `#game-region`: the base `font-size` belongs to `html,body`, and that is what
       * this ratio multiplies.
       */
      doc.documentElement.style.setProperty('--fonte-escala', String(position.scale));
      reserveBarBand(); // the name line under the bar grows with the text (issue #160)
      return FONT_BY_KEY[position.font]?.fam ?? null;
    } : undefined,
    /*
     * 🌗 THE THEME IS THE GAME'S TO DRAW (ADR-0148 erratum) AND THE ROOT'S TO KNOW: the decorative CRT yields to high
     * contrast (ADR-0047), and a writer handed straight through left the root blind to it — the scanlines and the vignette
     * stayed over a high-contrast screen.
     */
    ...(setGameTheme ? { setPlayerTheme: (i: number, theme: Theme) => {
      setGameTheme(i, theme);
      worldState = { ...worldState, tema: theme };
      applyCrt();
    } } : {}),
    /*
     * 🚥 COLOUR-VISION CORRECTION HAS AN ENGINE DEFAULT (ADR-0148 §1), so the icon is never missing for want of a writer.
     *
     * 🎯 A FILTER NEEDS NOT KNOW THE GAME — the argument that makes this legitimate. It goes over whatever the game drew,
     * the same way the `consumer-quiz` does by hand. What the engine CANNOT do is repaint textures, which is why the 🌗
     * stays the game's (see the ADR-0148 erratum).
     *
     * ⚠️ AND ONLY IF THE FILTERS EXIST. Without `host.cvdHost`, `installCvdFilters` returns zero, `url(#cvd-fix-protan)`
     * points at nothing and the icon would announce a correction that does not happen — a control that lies about its
     * state, worse than one icon fewer (ADR-0106 §5). The `problems` line for that gap already exists.
     *
     * 📌 THE CARTRIDGE STILL WINS: a game that corrects colour in its own render (`game-pinball`, in a framebuffer) hands in
     * its own and the engine steps aside.
     */
    ...(cartridge.setPlayerCorrection
      ? { setPlayerCorrection: withSafePalette(cartridge.setPlayerCorrection) }
      : cvdFilters
        /*
         * ⚠️ `filterKey` AND NOT `VIZ_FILTER[correction]`: the two vocabularies are DIFFERENT. The axis says `protan`;
         * `VIZ_FILTER` knows `fix-protan`. Translated by hand, the lookup gave `undefined`, the filter came out empty and
         * the icon ANNOUNCED a correction that did not happen — exactly the control lying about its state.
         * 📌 And `filterKey` does more than glue a prefix: it puts the SIMULATION ahead of the correction when there is
         * one, a rule this module should not reinvent.
         */
        ? { setPlayerCorrection: withSafePalette((i: number, correction: Correction) => {
          /*
           * 🔴 STORE BEFORE APPLYING: applying alone left the cycle STUCK on the first position. The next step is computed
           * by `nextCorrection(p.visual)` in `ui/pause-icons`; without writing it back, every press re-read the default and
           * returned `protan`.
           * ⚠️ No error at all: the icon announced the right correction, the filter changed the first time, and the child
           * pressed twice more to see the same screen. Caught by a surviving MUTATION — always apply, never clear — that stayed
           * green because the case pressed only once.
           */
          // ⚠️ `players()`, the SAME list `ui/pause-icons` reads (`getPlayers`, above) to compute the next step: written
          // anywhere else, the state would land where nobody reads it again.
          const player = players()[i] as { visual?: VisualState } | undefined;
          // A correction switched ON stops the demonstration (ADR-0076): a simulation over an adaptation teaches something false.
          const before = player?.visual ?? worldState;
          const nextVisual: VisualState = { ...before, correcao: correction, simulacao: correction === 'tricro' ? before.simulacao : null };
          if (player) player.visual = nextVisual;
          worldState = nextVisual;
          recomposeWorldFilter();
        }) }
        : {}),
  });

  /*
   * ⚠️ THE HOST MUST BE ABLE TO BE A BAR, and asking is not fussiness: `a11yBarHost` is `Element` in the type, and a
   * consumer may pass a double, a node from another document, or an element of an `<svg>`. Without this guard, an object
   * without `addEventListener` brings the WHOLE BOOT down — and bringing it down for the accessibility bar would take
   * the game from everyone so as to give it to no one.
   *
   * If it cannot, it is `problems` like any other gap of the host: the consumer reads and fixes.
   */
  const barUsable = !!a11yBar
    && typeof (a11yBar as HTMLElement).addEventListener === 'function'
    && 'innerHTML' in a11yBar;
  if (a11yBar && !barUsable) {
    hostProblems.push(
      'the accessibility bar element takes neither content nor clicks: its icons were not mounted, so a child cannot reach them — give `host.a11yBarHost` a real element',
    );
  }

  if (a11yBar && barUsable) {
    // 🔴 WITH THE NAME CAPTION under the row: the bar the engine mounted had none, and the Dev saw it mute when navigating
    // and hovering. `aria-hidden` because the name is already SPOKEN (`srSay` on the cursor, the `aria-label` on focus).
    a11yBar.innerHTML = iconsMarkup(translator, pauseIcons.mountedIcons) + '<p class="pause-icons-cap" aria-hidden="true"></p>';
    wireBarCaption(a11yBar as HTMLElement, explainIconInFooter);
    a11yBar.addEventListener('click', (e) => {
      const rowButton = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!rowButton) return;
      pauseIcons.iconAct(rowButton.dataset.pi ?? '', 0);
      pauseIcons.reflectIconsIn(a11yBar, 0);
      const caption = a11yBar.querySelector('.pause-icons-cap');
      if (caption) caption.textContent = accessibleLabel(rowButton); // the NEW state, after the reflection; «N de M» is spoken, never written (ADR-0167)
      // The announcement reads the `aria-label` AFTER the reflection, because that carries the NEW state — announcing
      // before would say the state the child just left.
      srSay(rowButton.getAttribute('aria-label') ?? '');
    });
    pauseIcons.reflectIconsIn(a11yBar, 0);

    /*
     * ⚠️ AND AGAIN WHEN THE BOOT LANGUAGE ARRIVES — without it the bar stays in the FALLBACK language.
     *
     * `translator.init` applies pt synchronously (so the page is never blank) and, if the preferred language is another, ASKS
     * for the switch — which is asynchronous, because en/es are on-demand chunks. This markup is born in that interval.
     *
     * 📌 IT IS THE `i18n:change` LISTENER near the pad that repaints it (study item C6, ADR-0031): the boot's preferred
     * language arrives through `setLocale`, which dispatches that same event, so one path serves the boot and a change
     * made mid-game.
     */

    /*
     * ⚠️ AND IT MUST GO ON TELLING THE TRUTH when a state changes ELSEWHERE. Blind mode is also switched by the hearing
     * panel and by the empathy simulation; without this subscription, the bar's icon would go on saying off with
     * `aria-pressed=false` after the child had turned it on — the control lying about its state.
     *
     * 📌 ONLY THE STATES WITH AN EVENT that can change elsewhere: blind mode, the camera control and the voice control
     * (`GameEvent`). NARRATION changes elsewhere too, but it is the mixer's category and has no event: the hearing panel's
     * `setCatGain`, further below, reflects the bar. The other icons reflect themselves on the click, which is the path by
     * which they change.
     */
    stateOn('blindMode', () => { pauseIcons.reflectIconsIn(a11yBar, 0); });
    // the 👀 changes elsewhere too: the eye control puts it back to off when the camera or the files are missing (ADR-0213)
    stateOn('cameraControl', () => { pauseIcons.reflectIconsIn(a11yBar, 0); }); // a mode that cannot start puts the 📷 back to off
    // 🔴 AND THE 👄 FOR THE SAME REASON, measured in a browser on 2026-09-21: with the microphone refused, the child heard «it did
    // not open», the stored answer went back to off — and the button went on saying «ligado». A control that lies about its state
    // is worse than a missing one (ADR-0106 §5), and the click path does not cover it, because this change comes from elsewhere.
    stateOn('voiceControl', () => { pauseIcons.reflectIconsIn(a11yBar, 0); });
  }
  // 🔴 AND THE 🗣 WHEN THE DEVICE'S VOICES CHANGE (ADR-0185 erratum 2026-09-26): they can arrive after load, or leave, and the
  // icon's greyed-out look is the lock the child sees. Silent: the press says why on its own, and nothing else changed.
  whenVoicesChange(() => {
    if (a11yBar && barUsable) pauseIcons.reflectIconsIn(a11yBar, 0);
    pauseIcons.reflectPauseIcons();
  });

  // 4d. WHO OPENED THE PAUSE, when there is more than one seat — finding 3 of the `game-soccer` audit.
  //
  // ⚠️ THE KEYBOARD PANEL IS PARAMETERISED BY THE SEAT: `render(selPlayer)` draws the positions of THAT scheme, and the
  // consumer decides the seat by passing the pause actor: the panel edits the controls of whoever opened the menu.
  //
  // 📌 The pause-actor line of `problems` lives in `measureCartridgeProblems()`: whoever declares seats is the game, and
  // the line accuses only a game that did not answer (ADR-0106 §2).

  /*
   * 4e. THE FIRST SCREEN'S PAUSE CARD. `#vp-pause-0` is what this root looks for (`getPauseMenu` of `initMenuNav`, below),
   * and games did not create it: the engine had invented a convention, looked for it, not found it, and concluded in
   * silence that no game had a pause menu — the same shape of defect as ADR-0106 §2, committed by the engine against
   * itself. So the engine creates what it looks for, for EVERY game (ADR-0120, ADR-0122): the pause and the
   * accessibility icons are in every game, so they are the engine's.
   */
  // (`pauseMountPoint` and `pauseUsable` are hoisted above `initPauseIcons` — see the note there. They depend only on
  //  `o.host` and `$`, and the bar needs the answer BEFORE deciding which icons it mounts.)
  if (!pauseUsable) {
    hostProblems.push(
      'the pause menu has nowhere to mount: a child cannot reach the settings during play — set `host.pauseHost` or give '
      + '#game-region room for children (the pause is the engine\'s in every game, ADR-0122; the game only says where it fits)',
    );
  }
  if (pauseMountPoint && pauseUsable) {
    const findPauseCard = pauseIcons.buildScreenPause(0);
    // ⚠️ THE ID IS WHAT THE ENGINE ITSELF LOOKS FOR, just below, in `getPauseMenu`. Mounting without it would leave the
    // loop as open as it was — the card would exist and menu navigation would still not find it.
    findPauseCard.id = 'vp-pause-0';
    pauseMountPoint.appendChild(findPauseCard);
  }

  /*
   * 4f. THE SETTINGS PANELS (ADR-0106 §1).
   *
   * 🔴 `ui/panel-shell.mountShell` BUILDS a panel's shell, and each `ui/settings-*` fills the INSIDE of ids somebody
   * must create. Left to the page, the failure took the worst form available — the quiz recorded it as finding 6: the
   * panel opens EMPTY, with no error. So the engine mounts each shell (`ui/mount-panel`) and then its writer.
   *
   * ⚠️ AND THE PANELS LIVE WHERE THE CARD LIVES, which is not tidiness: `ui/settings-panel.topVisibleOverlay` scans
   * `'#game-region .overlay'` (`OVERLAY_SCOPE_SELECTOR`), and that is how `ui/menu-nav` reaches the top dialog to move
   * with the arrows. A panel hung outside that scope OPENS, closes with Escape — and **the arrows do not move inside
   * it**, with no error at all. Hence the `problems` line below instead of silence.
   */
  if (pauseMountPoint && pauseUsable) {
    const regionEl = $<HTMLElement>('#game-region');
    const insideScope = !!regionEl && typeof regionEl.contains === 'function'
      && regionEl.contains(pauseMountPoint);
    if (!insideScope) {
      hostProblems.push(
        'the pause host is outside #game-region: settings panels open, but arrows do not move inside them, so a child '
        + 'who plays by keyboard cannot reach the settings — put `host.pauseHost` inside #game-region',
      );
    }

    const panelCtx = {
      find: (sel: string) => $<HTMLElement>(sel),
      create: (tag: string) => doc.createElement(tag),
      host: pauseMountPoint as HTMLElement,
      overlays,
      localeOn, // a language change redraws an open panel, and `dispose()` releases it (ADR-0232 D4)
    };

    /*
     * TYPOGRAPHY — NO PANEL since ADR-0151: «quem escolhe a tipografia é o jogo, o jogador escolhe suas fontes via o
     * menu de acessibilidade rápida». Its door left the inclusion settings and its shell is not mounted — a dialog in the
     * document that nobody reaches is the defect ADR-0144 measured.
     *
     * 📌 BUT THE WRITER STAYS, which is why the `init` is still here: the 11th button's cycle writes the face through this
     * API (`typo.setFont`), and the `init` applies at boot the font the child left stored. `initSettingsTypo` guards each
     * access to the document, so it runs without the shell.
     */
    typo = initSettingsTypo({
      t: translator.t, $, srSay, store, root: doc.documentElement,
      // The rows' prose goes to the footer at EVERY render, or it appears twice on the first click.
      fillExplain: overlays.fillExplain,
      // ⚠️ `doc.fonts` IS A BROWSER GLOBAL — FINDING 15 of this file. Here it comes from the host's `doc` and is still
      // asked whether it exists: a fake document has no `fonts`, and the absence has a declared answer (the row is
      // disabled WITH the message that tells the adult which fonts solve it).
      ...(typeof doc.fonts?.check === 'function'
        ? { fontInstalled: (family: string) => doc.fonts.check(`16px "${family}"`) }
        : {}),
    });

    /*
     * AAC — COMMUNICATION: THE PANEL IS NOT MOUNTED (ADR-0151).
     *
     * 🔴 The «Comunicação» door left the inclusion settings: the letter case moves with the bar's 11th button, which is the
     * COMMUNICATION cycle (with ARASAAC and PCS disabled). Mounting a panel with no door would leave in the document a
     * dialog nobody reaches — the defect ADR-0144 measured. The `ui/settings-aac` module stays in the engine for whoever
     * wants to mount it.
     */

    /*
     * HELP — which button does what, IN THIS game, on THIS child's keyboard (ADR-0147 §4).
     *
     * 🔴 The `ajuda` item has been on the pause list since ADR-0044 and the engine could not act on it, so `itemsThatAct`
     * hid it in every game. The engine draws it now, so no game has to write its own.
     *
     * ⚠️ IT IS NOT MOUNTED WITHOUT `howToPlay` OR `preset`, and the absence is the right answer: without the game's words,
     * the table could only show `action2` — an identifier in front of a child, the defect ADR-0074 forbids in so many
     * words. Better no help than one that cannot be read.
     *
     * 📌 THE KEY COMES FROM `kbFor(0)`, not the factory map: whoever remapped sees HER key. It is the same reason ADR-0144
     * listens to the action and not the key.
     */
    // The cartridge's «how to play» slides come first (ADR-0195; issue #188); the help stands with them, with the buttons, or both.
    if (cartridge.preset || cartridge.howToPlay?.length) {
      let stopFigure = (): void => {};
      const helpPanel = mountPanel(panelCtx, {
        id: 'help',
        labels: () => ({
          title: t('menu.help'),
          listLabel: t('help.grupo.rotulo'),
          resetLabel: t('menu.restoreDefaults'),
          closeLabel: t('pause.pmback'),
        }),
        // ⚠️ `render` AND NOT A ONE-OFF MOUNTING: the preset may change with another cartridge's `mount()` (ADR-0142) and
        // the child may have remapped between two openings. A table built at boot would show yesterday's key — the exact
        // shape of the control lying about its state.
        // The slide show opens on its first slide (interface log, 2026-09-13; `ui/help-panel`).
        render: () => {
          const list = $<HTMLElement>('#help-list');
          if (!list) return;
          while (list.firstChild) list.removeChild(list.firstChild);
          // the game's words resolved NOW, in the page's language (ADR-0232 D3): a language change re-renders an open panel
          const slideContents = [
            ...playSlidesOf(cartridge.howToPlay ?? [], word),
            ...helpRows(actionWords(), (a) => keyboard.kbFor(0)[a], (code) => keyName(t, code)),
          ];
          const ctxDoSlide = { create: (tag: string) => doc.createElement(tag), t, title: t('menu.help') };
          const slides = mountSlides(ctxDoSlide);
          list.appendChild(slides);
          const slideTimer = {
            requestFrame: (cb: (ms: number) => void) => win.requestAnimationFrame(cb),
            cancelFrame: (id: number) => win.cancelAnimationFrame(id),
            reduced: defaultReducedMotion(win.matchMedia),
          };
          const showSlideAt = (i: number): { index: number; spoken: string } => {
            stopFigure();
            const shown = showSlide(slides, slideContents, i, ctxDoSlide);
            const slide = slideContents[shown.index];
            if (slide && 'text' in slide) stopFigure = animateFigure(slides, slide, slideTimer);
            return shown;
          };
          let currentSlide = showSlideAt(0).index;
          slides.addEventListener('passo', (ev) => {
            const fresh = nextStep(currentSlide, slideContents.length, (ev as CustomEvent<number>).detail);
            if (fresh === currentSlide) return;
            const shown = showSlideAt(fresh);
            currentSlide = shown.index;
            srSay(shown.spoken);
          });
        },
      });
      // A slide show restores nothing: the reset row the panel shell builds does not show here.
      const helpActions = helpPanel.shell.reset.parentElement;
      if (helpActions) helpActions.hidden = true;
      engineActions.ajuda = helpPanel.open;
    } else {
      hostProblems.push(
        'the help screen was not mounted: it shows how to play and each position, its key and the game\'s word, and without '
        + '`howToPlay` or `preset` it could only show a child `action2` — declare `howToPlay` (ADR-0195) or `preset` (ADR-0085)',
      );
    }

    /*
     * OPÇÕES DO JOGO — the cartridge's rows, drawn by the engine (ADR-0182; issue #178).
     * 📌 Drawn at every opening and at every `mount()`: the rows are the CURRENT cartridge's, and each value is read from it.
     * The shell's «restore defaults» is hidden: a cartridge declares no defaults, and a button that does nothing is the
     * dead control ADR-0106 §5 forbids.
     */
    const gamePanel = mountPanel(panelCtx, {
      id: 'game-options',
      labels: () => ({
        title: t('pause.opcoesdojogo'),
        listLabel: t('pause.opcoesdojogo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => redrawGameOptions(),
    });
    gamePanel.shell.reset.hidden = true;
    redrawGameOptions = () => {
      drawGameOptions({ ...panelCtx, say: srSay, t: translator.t, word }, gamePanel.shell.list, cartridge.gameOptions ?? []);
      if (!gamePanel.shell.overlay.hidden) overlays.fillExplain(gamePanel.shell.card);
    };
    openGameOptions = gamePanel.open;

    /*
     * ANIMATION — motion sensitivity.
     *
     * 📌 `rm`, `saveRM`, `rmKeys` and `rmChar` are OPTIONAL (ADR-0106 step 1), and the absence is the news: none of them
     * held a choice of the game — `rmKeys` was the `MotionSceneKey` union written by hand and `rm`/`saveRM` read an engine
     * storage key with an engine default. `ui/motion-scene` answers for the four, so this panel needs nothing only the
     * cartridge knows. The root still passes `rm`/`saveRM`: not the game's, but the ONE object the quick bar also writes.
     *
     * ⚠️ AND ITS LIST IS `#motion-list`, NOT `#animation-list` — inherited from the monolith, where the panel was called
     * «motion» and the overlay «animation». See `PanelShellSpec.listId`: renaming would touch the contract with markup of
     * consumers this repository cannot measure.
     */
    let motion: SettingsMotionApi | null = null;
    const animPanel = mountPanel(panelCtx, {
      id: 'animation',
      listId: 'motion-list',
      labels: () => ({
        title: t('menu.animation'),
        listLabel: t('animation.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => motion?.render(),
    });
    /*
     * THE MASTER BUTTON — stop all animations at once.
     *
     * ⚠️ CREATED HERE AND BEFORE THE `init`: `initSettingsMotion` wires its click ONCE, at boot. And it is not
     * decoration — it is the way out for someone who felt sick with the screen moving and needs to stop EVERYTHING in one
     * gesture, instead of going through seven rows one by one.
     * 📌 The label comes from the panel itself (`motionMasterLabel`), which swaps it by state; setting it here would give
     * two hands writing the same text, and the one left behind would lie about the state.
     */
    const animMaster = doc.createElement('button');
    animMaster.id = 'motion-master';
    animMaster.className = 'mode-btn switch';
    animMaster.setAttribute('type', 'button');
    animPanel.shell.card.insertBefore(animMaster, animPanel.shell.list);

    motion = initSettingsMotion({
      t: translator.t, $, srSay, store, matchMedia: win.matchMedia, crt,
      // the SAME flags the quick bar's calm icon writes (see `sceneMotion`, above)
      rm: sceneMotion, saveRM: saveSceneMotion,
      getNumPlayers: () => (cartridge.players ?? [null]).length,
      getPlayers: () => cartridge.players ?? [],
      frontOverlay: overlays.frontOverlay,
      restoreFocus: overlays.restoreFocus,
      fillExplain: overlays.fillExplain,
      toggleBtn,
      // The «Personagem» section exists only if the GAME said it has one (ADR-0153). Read at every render: it changes on `mount()`.
      hasCharacter: () => subjectWord(cartridge.accommodations, 'reducedCharacterMotion', word) !== null,
      // and its title is the game's word for it (ADR-0153 confirmation), resolved at every render (ADR-0232 D3)
      characterLabel: () => subjectWord(cartridge.accommodations, 'reducedCharacterMotion', word)?.label ?? null,
    });
    engineActions.anim = animPanel.open;

    /*
     * VISUAL ACCESSIBILITY (ADR-0151) — and the item is no longer locked (ADR-0161).
     *
     * 📌 THE MODULE IS `ui/settings-visual`, with the two rows the engine CAN act on: the contrast enhancement (the L→Q
     * filter, composed on the world with the colour correction) and the safe palette (`core/state.cbSafe`, which paints
     * menus and HUD). ⚠️ Role colours («lava, escada, água, portão») stay OUT: they belong to a game with those roles, and
     * the engine does not describe a game it does not know. Owner colours and outlines are offered below, where the game
     * answers them (ADR-0188). High contrast and colour correction left this panel for the quick bar (ADR-0151).
     * ⚠️ The writers of the rows not offered are inert ON PURPOSE: `reset` calls them only when the value read differs
     * from the default, and the value returned here IS the default.
     */
    const visualPanel = mountPanel(panelCtx, {
      id: 'visual',
      labels: () => ({
        title: t('menu.visual'),
        listLabel: t('visual.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        rateHint.textContent = t('visual.legenda.ritmo.dica'); // before `visual.render()` runs `fillExplain`
        fgOutline.escreverDica();
        bgOutline.escreverDica();
        visual.render();
        offerOwnerAndOutlines();
        labelRow(captionsRow, captionsSpec()); // in the language of the opening
        reflectCaptions();
        reflectCaptionRate();
      },
    });
    /*
     * CAPTIONS (ADR-0151 §2; issue #182): the Dev listed them in the visual panel. `state.captionsOn` was stored and read by
     * the sound captions (`captionSound`) with no row to change it. Placed after the panel's list, which `visual.render()`
     * rewrites by markup; built once, so its listener is not lost.
     */
    const captionsSpec = () => ({ id: 'opt-captions', label: t('visual.captions'), hint: t('visual.captions.dica') });
    const { row: captionsRow, control: captionsButton } = controlRow(panelCtx, captionsSpec());
    visualPanel.shell.card.insertBefore(captionsRow, visualPanel.shell.list.nextSibling);
    const reflectCaptions = (): void => {
      toggleBtn(captionsButton, state.captionsOn);
      captionsButton.textContent = toggleLabel(t, state.captionsOn);
      markChanged(t, captionsRow, state.captionsOn !== DEFAULTS.captionsOn);
    };
    /* THE CAPTION RATE (ADR-0183 §4; issue #179): 125, 145 or 175 words a minute, by steps, right after the captions switch. */
    const rateSpec = () => ({
      label: t('visual.legenda.ritmo'),
      values: CAPTION_RATES.map((n) => t('visual.legenda.ppm', { n })),
      current: Math.max(0, (CAPTION_RATES as readonly number[]).indexOf(state.captionPpm)),
    });
    const speechRateRow = doc.createElement('div');
    speechRateRow.className = 'ctrl-row ctrl-row--passos';
    const rateEnvelope = doc.createElement('span');
    const rateHint = doc.createElement('span');
    rateHint.className = 'opt-hint';
    // ⚠️ WRITTEN NOW, and again before the panel's render: `visual.render()` runs `fillExplain` on the whole card, and a row it
    // meets with an empty hint is marked done and keeps its hint INSIDE — the Dev saw the explanation in the row.
    rateHint.textContent = t('visual.legenda.ritmo.dica');
    rateEnvelope.appendChild(rateHint);
    speechRateRow.appendChild(rateEnvelope);
    const rateSteps = mountSteps(panelCtx, rateSpec());
    rateSteps.id = 'opt-legenda-ppm';
    speechRateRow.appendChild(rateSteps);
    visualPanel.shell.card.insertBefore(speechRateRow, captionsRow.nextSibling);
    rateSteps.addEventListener('passo', (ev) => {
      const currentSlide = rateSpec().current;
      const fresh = nextStep(currentSlide, CAPTION_RATES.length, (ev as CustomEvent<number>).detail);
      if (fresh === currentSlide) return;
      state.setCaptionPpmValue(CAPTION_RATES[fresh]!);
      updateSteps(rateSteps, rateSpec());
      markChanged(t, speechRateRow, state.captionPpm !== DEFAULTS.captionPpm);
      srSay(`${t('visual.legenda.ritmo')}: ${t('visual.legenda.ppm', { n: state.captionPpm })}`);
    });
    const reflectCaptionRate = (): void => {
      updateSteps(rateSteps, rateSpec());
      rateHint.textContent = t('visual.legenda.ritmo.dica');
      markChanged(t, speechRateRow, state.captionPpm !== DEFAULTS.captionPpm);
    };
    captionsButton.addEventListener('click', () => {
      state.setCaptionsOnValue(!state.captionsOn);
      reflectCaptions();
      srSay(t(state.captionsOn ? 'sr.visual.captionsOn' : 'sr.visual.captionsOff'));
    });
    /*
     * OWNER COLOURS AND CONTRAST OUTLINES (ADR-0188; issue #183): rows only where the cartridge answers the subject. Built once
     * beside the panel's list (`visual.render()` rewrites that by markup), with their own ids — `ui/settings-visual` wires
     * `#opt-ownercolors` at every render — and shown or hidden at each opening: `mount()` may have swapped the answer.
     * Owner colours carries the game's word; the outlines are two positions of one subject, named by the engine.
     */
    const ownerSpec = () => {
      const owner = subjectWord(cartridge.accommodations, 'ownerColors', word);
      return { id: 'opt-dono', label: owner?.label ?? '', hint: owner?.hint };
    };
    const { row: ownerRow, control: ownerButton } = controlRow(panelCtx, ownerSpec());
    const reflectOwner = (): void => {
      toggleBtn(ownerButton, state.ownerColors);
      ownerButton.textContent = toggleLabel(t, state.ownerColors);
      markChanged(t, ownerRow, state.ownerColors !== DEFAULTS.ownerColors);
    };
    ownerButton.addEventListener('click', () => {
      state.setOwnerColorsValue(!state.ownerColors);
      reflectOwner();
      srSay(`${ownerSpec().label}: ${toggleLabel(t, state.ownerColors)}`);
    });
    const OUTLINE_LEVELS = ['visual.contorno.0', 'visual.contorno.1', 'visual.contorno.2'] as const;
    const outline = (plane: 'fg' | 'bg') => {
      const readOutline = (): number => (plane === 'fg' ? state.hcOutlineFg : state.hcOutlineBg);
      const write = plane === 'fg' ? state.setOutlineFgValue : state.setOutlineBgValue;
      const spec = () => ({ label: t(`visual.contorno.${plane}`), values: OUTLINE_LEVELS.map((k) => t(k)), current: readOutline() });
      const rowC = doc.createElement('div');
      rowC.className = 'ctrl-row ctrl-row--passos';
      const envelope = doc.createElement('span');
      const explanation = doc.createElement('span');
      explanation.className = 'opt-hint';
      envelope.appendChild(explanation);
      rowC.appendChild(envelope);
      const stepper = mountSteps(panelCtx, spec());
      stepper.id = `opt-contorno-${plane}`;
      rowC.appendChild(stepper);
      stepper.addEventListener('passo', (ev) => {
        const fresh = nextStep(readOutline(), OUTLINE_LEVELS.length, (ev as CustomEvent<number>).detail);
        if (fresh === readOutline()) return;
        write(fresh);
        updateSteps(stepper, spec());
        srSay(`${t(`visual.contorno.${plane}`)}: ${t(OUTLINE_LEVELS[fresh]!)}`);
      });
      // the hint is written BEFORE the panel's render, which runs `fillExplain`: written after, it stays inside the row
      const writeHint = (): void => {
        explanation.textContent = subjectWord(cartridge.accommodations, 'contrastOutlines', word)?.hint ?? t(`visual.contorno.${plane}.dica`);
      };
      writeHint();
      const reflect = (): void => { updateSteps(stepper, spec()); };
      return { row: rowC, refletir: reflect, escreverDica: writeHint };
    };
    const fgOutline = outline('fg');
    const bgOutline = outline('bg');
    const offerOwnerAndOutlines = (): void => {
      ownerRow.hidden = subjectWord(cartridge.accommodations, 'ownerColors', word) === null;
      if (!ownerRow.hidden) { labelRow(ownerRow, ownerSpec()); reflectOwner(); }
      const withoutOutlines = subjectWord(cartridge.accommodations, 'contrastOutlines', word) === null;
      for (const c of [fgOutline, bgOutline]) { c.row.hidden = withoutOutlines; if (!withoutOutlines) c.refletir(); }
    };
    // after the list, owner colours first, then the two outlines (the captions row, built above, follows them)
    for (const l of [bgOutline.row, fgOutline.row, ownerRow]) visualPanel.shell.card.insertBefore(l, visualPanel.shell.list.nextSibling);
    offerOwnerAndOutlines();
    const noEffect = (): void => {};
    const visual = initSettingsVisual({
      t: translator.t, $, srSay,
      getNumPlayers: () => players().length,
      getPlayers: () => cartridge.players ?? [],
      getVisualSettings: () => ({
        lq: lq.t(), cbSafe: state.cbSafe,
        ownerColors: state.ownerColors, outlineFg: state.hcOutlineFg, outlineBg: state.hcOutlineBg,
        roleColors: { ...HC_ROLE_DEF },
      }),
      getSelectedPlayer: () => 0,
      setSelectedPlayer: noEffect,
      setPlayerViz: noEffect,
      renderVisualAxes: noEffect,
      setLq: lq.set,
      setCbSafe: state.setCbSafeValue,
      // the panel's «restore» puts these back too (ADR-0188): their rows now exist where the game answered them
      setOwnerColors: state.setOwnerColorsValue, setOutlineFg: state.setOutlineFgValue, setOutlineBg: state.setOutlineBgValue,
      setRoleColor: noEffect, resetRoleColors: noEffect,
      fillExplain: overlays.fillExplain,
      offer: { owner: false, roles: false },
    });
    engineActions.visual = visualPanel.open;

    /*
     * EMPATHY MODE (ADR-0151) — and the last locked item of the submenu unlocks (ADR-0161).
     *
     * 📌 THE MODULE IS `ui/settings-empathy`, with what the engine CAN do:
     *   · the SIMULATIONS that are a filter on the world — the three colour-blindness ones (the matrices of
     *     `installCvdFilters`), blur, haze and blindness; and the three DRAWN ones — tunnel vision, a central scotoma,
     *     scattered scotomas — whose filter is only a blur: `ui/simulation-over-the-world` lays their drawing over the
     *     world (issue #182);
     *   · HEARING LOSS (`platform/audio.setHearingLossGraph`, already the engine's);
     *   · the two MOTOR simulations (ADR-0181): «um botão por vez» and «sem força para segurar», applied to game keys by
     *     the filter at the end of the boot, before any cartridge hears them.
     * ⚠️ No wheelchair (cut by ADR-0151).
     * ⚠️ And the simulation respects ADR-0076: with a colour correction on it does not run, and SAYS why.
     */
    const WORLD_SIMULATIONS = ['normal', 'sim-protan', 'sim-deuter', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind'];
    const empathyPanel = mountPanel(panelCtx, {
      id: 'empathy',
      labels: () => ({
        title: t('menu.empathy'),
        listLabel: t('empathy.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      // the hearing-loss row was born in the fallback language: relabelled at every opening, like the hearing panel's inside
      render: () => {
        labelRow(hearingRow, hearingSpec());
        labelRow(oneAtOnceRow, oneAtOnceSpec());
        labelRow(noStrengthRow, noStrengthSpec());
        empathy.render();
      },
    });
    // The hearing-loss row is born BEFORE the `init`, which wires its click once (the same order rule as the motion master).
    const hearingSpec = () => ({ id: 'opt-hearing', label: t('empathy.hearing'), hint: t('empathy.hearing.dica') });
    const hearingRow = controlRow(panelCtx, hearingSpec()).row;
    empathyPanel.shell.card.insertBefore(hearingRow, empathyPanel.shell.list);
    // THE TWO MOTOR SIMULATIONS (ADR-0181), before the `init`, which wires `#opt-onebtn` once (the same order rule).
    const oneAtOnceSpec = () => ({ id: 'opt-onebtn', label: t('empathy.onebtn'), hint: t('empathy.onebtn.dica') });
    const noStrengthSpec = () => ({ id: 'opt-semforca', label: t('empathy.semforca'), hint: t('empathy.semforca.dica') });
    const oneAtOnceRow = controlRow(panelCtx, oneAtOnceSpec()).row;
    const noStrengthRow = controlRow(panelCtx, noStrengthSpec()).row;
    empathyPanel.shell.card.insertBefore(oneAtOnceRow, empathyPanel.shell.list);
    empathyPanel.shell.card.insertBefore(noStrengthRow, empathyPanel.shell.list);
    const reflectMobilitySimulations = (): void => {
      for (const [id, on] of [['#opt-onebtn', state.oneButton], ['#opt-semforca', state.noGripStrength]] as const) {
        const b = $<HTMLElement>(id);
        if (!b) continue;
        toggleBtn(b, on);
        b.textContent = toggleLabel(t, on);
      }
      markChanged(t, noStrengthRow, state.noGripStrength !== DEFAULTS.noGripStrength);
    };
    const simulate = (i: number, key: string): boolean => {
      const simulation = (key === 'normal' ? null : key) as VisualState['simulacao'];
      const player = players()[i] as { visual?: VisualState; viz?: string } | undefined;
      const base = player?.visual ?? worldState;
      const reason = simulation ? simulationUnavailable(base) : null;
      if (reason) { srSay(t(`sim.indisponivel.${reason}`)); return false; } // a VISIBLE, explained refusal (ADR-0076)
      const nextVisual: VisualState = { ...base, simulacao: simulation };
      if (player) { player.visual = nextVisual; player.viz = key; }
      worldState = nextVisual;
      recomposeWorldFilter();
      return true;
    };
    // ONE LIST, NOT SEVEN BUTTONS (ADR-0159 rule 7) — `ui/simulation-list` says why, and it is not wiring.
    const simulationPicker = createSimulationList({
      t: translator.t,
      find: $,
      make: (tag) => doc.createElement(tag),
      keys: WORLD_SIMULATIONS,
      running: () => worldState.simulacao ?? null,
      // a refused simulation (ADR-0076) is announced by `simular` and the re-render puts the list back on what runs
      picked: (key) => { simulate(0, key); empathy.render(); },
    });
    const empathy = initSettingsEmpathy({
      t: translator.t, $, srSay, store,
      hearing: mixer,
      renderVizGroup: (listSelector) => { simulationPicker.render(listSelector); },
      reflectMobilityEmpathy: reflectMobilitySimulations,
      reflectVizButtons: noEffect,
      frontOverlay: overlays.frontOverlay,
      fillExplain: overlays.fillExplain,
      restoreFocus: overlays.restoreFocus,
      setHearingLoss: (on) => {
        setHearingLossGraph(on);
        store.set(KEYS.hearingloss, on);
        srSay(t(on ? 'sr.empathy.hearingOn' : 'sr.empathy.hearingOff'));
      },
      setOneButton: (on) => {
        state.setOneButtonValue(on);
        srSay(t(on ? 'sr.empathy.onebtnOn' : 'sr.empathy.onebtnOff'));
        reflectMobilitySimulations();
      },
      setWheelchair: noEffect,
      getOneButton: () => state.oneButton,
      getWheelchair: () => DEFAULTS.wheelchair,
      getPlayers: () => [{ viz: worldState.simulacao ?? 'normal' }],
      setPlayerViz: (i, rowMode) => { simulate(i, rowMode); },
    });
    // «sem força para segurar» is wired here: the empathy module predates it. Refused over toggle keys (ADR-0076): a latch
    // would hold what the simulation lets go, and the demonstration would show the accommodation instead of the difficulty.
    $<HTMLElement>('#opt-semforca')?.addEventListener('click', () => {
      const wire = !state.noGripStrength;
      if (wire && players().some((p) => (p as { toggleMove?: boolean }).toggleMove)) { srAlert(t('sim.indisponivel.alternancia')); return; }
      state.setNoGripStrengthValue(wire);
      srSay(t(wire ? 'sr.empathy.semforcaOn' : 'sr.empathy.semforcaOff'));
      empathy.render();
    });
    // and the panel's «restore defaults» turns it off too, after the module's own reset
    $<HTMLElement>('#empathy-reset')?.addEventListener('click', () => { state.setNoGripStrengthValue(false); empathy.render(); });
    engineActions.empatia = empathyPanel.open;

    /*
     * HEARING ACCESSIBILITY — the biggest of the panels, and the one with the most to lose by not existing.
     *
     * 📏 The panel reached nodes it never created; `mountAudioInside`, beside it, builds them. ⚠️ And the inside goes in
     * BEFORE the `init`, by the order rule the panels above already paid for: `initSettingsAudio` wires its clicks once,
     * at boot.
     *
     * 📌 None of the `ctx` fields is the game's: the mixer, the volume, blind mode, the cane and the voice are all the
     * engine's, and the cartridge's players serve as they are. It was the most expensive panel to mount and the least
     * dependent on who mounts it.
     */
    const audioPanel = mountPanel(panelCtx, {
      id: 'audio',
      // 📌 THE SHELL'S LIST IS NAVIGATION SOUND since ADR-0151: the taste categories went to «Áudio». The id
      // `navsound-list` is the one `initSettingsAudio` fills with sonar, cane and guide.
      listId: 'navsound-list',
      labels: () => ({
        title: t('menu.audio'),
        listLabel: t('audio.navsound.grupo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      /*
       * ⚠️ THE INSIDE GOES IN AT RENDER, not only at mounting. The frame is retranslated (`MountPanelSpec.labels`); the
       * inside, run once, would keep the text of the boot interval, where the language is still the fallback — the
       * title in English and the rows in Portuguese on the same screen, as measured in a real browser with `lang="en"`.
       *
       * 📌 `mountAudioInside` RELABELS what exists instead of rebuilding it — rebuilding would leave controls in the
       * document with no listener. And no unit test catches this: they all run in one language.
       */
      render: () => {
        mountAudioInside(translator.t, panelCtx, audioPanel.shell.card, audioPanel.shell.list);
        hideRowsWithoutSubject();
        audio?.renderAudio();
      },
    });
    mountAudioInside(translator.t, panelCtx, audioPanel.shell.card, audioPanel.shell.list);
    /*
     * AUDIO — general sound and the four taste categories (ADR-0151 §2 item 4), apart from hearing accessibility.
     * ⚠️ MOUNTED BEFORE `initSettingsAudio`, by the siblings' order rule: this panel's master switch, volume and «restore»
     * are wired ONCE, at boot.
     */
    const soundPanel = mountPanel(panelCtx, {
      id: 'som',
      listId: 'audio-list',
      labels: () => ({
        title: t('menu.som'),
        listLabel: t('audio.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        mountSoundInside(translator.t, panelCtx, soundPanel.shell.card, soundPanel.shell.list);
        audio?.renderAudio();
      },
    });
    mountSoundInside(translator.t, panelCtx, soundPanel.shell.card, soundPanel.shell.list);
    // The two hearing-panel rows that exist only where there is a subject — `ui/audio-rows-that-apply` says why, and it
    // is not wiring. ⚠️ Read at every opening: the topology is a function, and a game changes its demands between phases (ADR-0084).
    const hideRowsWithoutSubject = (): void => showOnlyRowsThatApply({
      find: $,
      caneWord: () => subjectWord(cartridge.accommodations, 'caneSpacing', word),
      hasNavigationSound: () => contractSubjects({
        declaration: cartridge.declaration,
        actions: cartridge.preset ? presetActions(cartridge.preset) : [],
        players: players().length,
      }).has('navigationSound'),
    });
    hideRowsWithoutSubject();
    audio = initSettingsAudio({
      translator, $, srSay, store,
      // the page's settings store, and the ROOT'S door to its bus: the panel's subscription ends with `dispose()` (ADR-0220)
      settings: state, on: stateOn,
      /*
       * 🔴 THE AUDIO PANEL'S BROWSER COMES FROM HERE (ADR-0227). What ADR-0221 step 7d asks is not that nobody touches the
       * browser — it is that whoever touches it is whoever RECEIVED it. This root receives `doc` and `win` from the host
       * (`EngineHost`), so the reach moves place and not owner: out of a panel that does not know which page it is in,
       * into the only module of the tree that legitimately knows.
       */
      newElement: (tag) => doc.createElement(tag),
      speech: {
        voices: () => { try { return win.speechSynthesis?.getVoices() ?? []; } catch (e) { return []; } },
        /*
         * 🔴 THE SAMPLE SPEAKS THE PAGE'S LANGUAGE, read at every press: its text comes from the page's dictionary, so a fixed tag
         * asked the browser for a Portuguese voice to read English words. And a chosen voice of ANOTHER language is not handed
         * over (ADR-0185): the page's system-voice list offers every voice when none matches, and the one picked before a
         * language switch outlives it. So the voice goes only if the engine's own list for the language (`tts.voices()`) has it.
         */
        speakSample: (sample, chosen) => {
          try {
            const ss = win.speechSynthesis;
            if (!ss) return;
            ss.cancel();
            const u = speech.utterance(sample);
            u.lang = bcp47();
            if (chosen && tts.voices().some((v) => v.voice === 'webspeech:' + chosen.name)) u.voice = chosen;
            u.rate = 1; u.volume = 1;
            ss.speak(u);
          } catch (e) { /* the device refused to speak; the panel already says what it can do */ }
        },
        whenVoicesChange,
      },
      audioOutputs: {
        canList: () => !!(win.navigator?.mediaDevices && win.navigator.mediaDevices.enumerateDevices),
        canRoute: () => {
          const w = win as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
          return typeof (w.AudioContext ?? w.webkitAudioContext) !== 'undefined';
        },
        list: async () => {
          const md = win.navigator?.mediaDevices;
          if (!md?.enumerateDevices) return [];
          return (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
        },
        detect: async () => {
          const md = win.navigator?.mediaDevices;
          if (!md?.enumerateDevices) return [];
          // 📌 The permission is what gives the outputs NAMES: without it the browser lists anonymous devices, and a choice
          // between «Saída 1» and «Saída 2» is not a choice. The track is let go at once.
          await md.getUserMedia?.({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
          return (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
        },
      },
      audioCats: AUDIO_CATS,
      toggleBtn,
      getNumPlayers: () => players().length,
      getPlayers: () => cartridge.players ?? [],
      getSoundOn: () => mixer.soundOn,
      setSoundOn,
      getVolume: () => mixer.volume,
      setVolume,
      getAudioCat: () => mixer.audioCat,
      /*
       * 🔴 THE PANEL IS THE OTHER WRITER OF NARRATION, and the bar's 🗣 has to follow it. Narration is the mixer's `tts`
       * category, not a setting of the store, so there is no `stateOn` for it beside the three the bar subscribes to above;
       * but every writer commits a category through `setCatGain`, and here the panel's do — the switch, the volume slider that
       * turns narration on, the reset. Without this, the child who turned narration on here heard the 🗣 under the bar's cursor
       * say «desligado» (ADR-0159 rule 10: the state is said in words, and a stale word is a lie). The other direction is
       * `reflectTtsPanel`, handed to the bar.
       */
      setCatGain: (k) => {
        setCatGain(k);
        if (k === 'tts' && a11yBar && barUsable) pauseIcons.reflectIconsIn(a11yBar, 0);
      },
      tts,
      getBlindMode: readBlindMode,
      // 📌 The `core/state` pattern: store, persist, notify. The game effects are a REACTION, and whoever reacts
      // subscribes to `on('blindMode', …)` — the same decision `ui/pause-icons` took for the icon.
      setBlindMode: state.setBlindModeValue,
      getCaneBlockDiv: () => state.caneBlockDiv,
      setCaneBlockDiv: state.setCaneBlockDivValue,
      fillExplain: overlays.fillExplain,
    });
    engineActions.audio = audioPanel.open;
    engineActions.som = soundPanel.open;
  }

  // 4b. THE SONAR. Only the contract goes in: no tile, collision box or coin array. Its WORDS are the text on screen at the
  //     press, read from the page by `ui/screen-text` (ADR-0234: «sonar do que está na tela»); its tone points at the target.
  const screen: ScreenTextCtx = { doc, world: () => cartridge.declaration.world() };
  const sonar = createAudioSonar({
    screenText: () => screenText(screen),
    t: translator.t,
    topology: () => cartridge.declaration.topology(),
    targetsOf: (i) => cartridge.declaration.targetsOf(i),
    nameAt: (at) => cartridge.declaration.nameAt(at),
    // Field 2 + the mixer bus: what the CONTINUOUS GUIDE needs and the beep did not (#84 item 2). `roleAt` is what lets
    // the route go round a wall; `catNode`/`audioOut`/`getVolume` put a PERMANENT graph on the same volume slider as
    // all the rest of the audio.
    roleAt: (at) => cartridge.declaration.roleAt(at),
    // what the sonar reads is spoken — or, in deaf mode, captioned and signed by the interpreter (ADR-0234)
    tonePan, srSay, narrate: deafMode.sonar,
    catNode, audioOut, getVolume: () => mixer.volume,
    // ⚠️ THE ANSWER, NOT THE TABLE (#104): `platform/audio-sonar` does not know what a visual mode is, so it is answered
    // here — the root is the only layer that knows both axes AND may import from `render/`.
    visionImpaired: (pl) => {
      const v = (pl as { visual?: VisualState }).visual;
      return !!v && (isBlind(v) || isLowVision(v));
    },
    getBlindMode: readBlindMode, LOGICAL_W,
    // The player DERIVED from the focus: field 4 answering where the child is. A game that supplies no list still has
    // the sonar, and that is what makes the accessibility stack not an accessory.
    getPlayers: cartridge.sonarPlayers ?? (() => {
      const f = cartridge.declaration.focusOf(0);
      return f ? [{ i: 0, x: f.at.x, y: f.at.y, visual: DEFAULT_VISUAL }] : [];
    }),
    getNumPlayers: () => (cartridge.players ?? [null]).length,
    getAudioCtx: () => mixer.audioCtx, getSoundOn: () => mixer.soundOn, getAudioCat: () => mixer.audioCat,
    newContext: newAudioContext,
  });

  // 5. Remappable keyboard — the best cut of the base (finding 11): a key scheme, no world.
  //
  /*
   * THE MOUNTED CARTRIDGE'S TWO DEFAULT MAPPINGS (ADR-0115), held by THIS root (ADR-0232 D4): they were module registrations,
   * and a second root overwrote the first root's. `null` is the honest value of «this game has no opinion», and it is also
   * what `unmount()` sets. The keyboard config reads the mapping through a closure, so a `mount()` answers with the new
   * cartridge's; the pad table is REBUILT, because its memo belongs to one mapping — a kept memo would serve the previous
   * game's table.
   */
  let keyboardMappingNow: KeyboardMapping | null = null;
  let padTableNow: PadTableFor = createPadTable(null);
  function followCartridgeMappings(declaration: GameDeclaration | null): void {
    const keyboardMapping = declaration?.keyboardMapping;
    keyboardMappingNow = keyboardMapping ? (players, seat) => keyboardMapping(players, seat) : null;
    const padMapping = declaration?.padMapping;
    padTableNow = createPadTable(padMapping ? (players, seat) => padMapping(players, seat) : null);
  }
  followCartridgeMappings(cartridge.declaration);
  // ⚠️ THE GAME'S DEFAULT IS KNOWN BEFORE `load()`, and the order is the rule: whoever reads the disk must already know which
  // factory the child's data overlays (ADR-0115).
  const keyboardConfig: KeyboardConfigApi = createKeyboardConfig({
    store, mapping: (players, seat) => keyboardMappingNow?.(players, seat) ?? null,
  });
  keyboardConfig.load();
  // THE CHILD'S PAD MAPS, one cache for this root, handed to BOTH readers: the motor panel's wizard and the gamepad.
  const padMaps = createPadMaps(store);
  // (`withoutReach`, `withoutPlayers` and `players` are hoisted above `initPauseIcons` — issue #147.)
  const keyboard = initKeyboardRuntime({
    getKB: keyboardConfig.kb, getNumPlayers: () => players().length, getPlayers: () => players(),
  });
  /** The «Mapear teclado» panel, once mounted. Declared here because the menu navigation, just below, asks it whether it
   *  is capturing a key — and it is born only with the motor panel, further on. */
  let keyboardControls: SettingsControlsApi | null = null;
  keyboard.assignControls();

  /*
   * THE THREE ANSWERS THE CARTRIDGE MAY REPLACE, resolved ONCE. They feed the menu navigation and, since ADR-0224, the
   * gamepad too — and writing the same `??` in two places is writing the same decision twice.
   */
  const isOnBar = cartridge.onBar ?? ((i: number) => pauseIcons.onBar(i));
  const navBar = cartridge.navBar ?? ((i: number, k: NavKeys, withStart?: boolean) => pauseIcons.navBar(i, k, withStart));
  const setPauseActor = cartridge.setPauseActor ?? ((): void => {});

  // 6. Menu navigation.
  const nav = initMenuNav({
    $, t: translator.t, getActiveElement: () => doc.activeElement,
    topVisibleOverlay: overlays.topVisibleOverlay, closeById: overlays.closeById,
    getPauseMenu: (i) => $<HTMLElement>(`#vp-pause-${i}`),
    // ⚠️ NOT `cartridge.setPhase ?? (() => {})`: «no» at the card's root calls `setPhase('playing')` (`ui/menu-nav`) and
    // nothing more — it hides nothing —, so in a game without the hook Escape did not close the pause ADR-0144 opens. It
    // goes through the same `changePhase` as the «continuar» item: one way out, whatever door the child leaves by.
    setPhase: changePhase,
    setPauseActor,
    srSay,
    // With no declared opinion, the index is ON: whoever needs it to find their way cannot know it exists if it comes
    // switched off (the same reason blind mode is born with narration and sonar).
    withIndex: cartridge.withIndex ?? (() => true),
    explainItem: (text) => writeInFooter(text),
    isNavigable: cartridge.isNavigable ?? (() => true),
    /*
     * ⚠️ THE DEFAULT IS THE ENGINE'S BAR, and not `() => false` / `() => {}`: this root MOUNTS the bar (ADR-0106 step 2).
     * With these two as no-ops the bar would exist and **could not be navigated by keyboard or gamepad** — reachable only
     * by pointer. For a blind child, who navigates by keyboard, a bar she cannot reach is the same as no bar — exactly
     * the offer-the-path-then-refuse-it that ADR-0106 §5 forbids.
     *
     * The engine answers with ITS instance, the same one that mounted the bar. Whoever injects still rules.
     *
     * 📌 `ui/menu-nav` calls `navBar` with `(i, k)` and never the third argument, the START edge — the SECOND way out of
     * the mode (ADR-0044 item 7). That one arrives through the gamepad transport, which this root mounts below.
     */
    onBar: isOnBar,
    navBar,
    // ⚠️ NOT `() => false`: the remapping panel captures a key (ADR-0151), and without this the arrow the child wants to
    // record would move the menu instead of landing on the key.
    isCapturing: () => keyboardControls?.isCapturing() ?? false,
    // Escape on the controller-mapping panel (`#padwiz`) closes it the way «Voltar» does: through the panel's own closer,
    // registered with the overlays, which cancels a running wizard without storing its map.
    closePadWiz: () => { overlays.closeById('padwiz'); },
    whichPlayer: (code) => keyboard.whichPlayer(code),
    actionOf: (code, i) => keyboard.actionOf(code, i),
    // Finding 12, SOLVED IN THE ENGINE: the port is generic over `WindowEventMap` (see `EventTargetLike` in
    // input/touch-bindings), so the real `window` goes straight in, with no adapter per consumer.
    win,
  });

  // ⚠️ AND IT IS SWITCHED ON. A wire the engine MOUNTS and does not switch on is worse than one it does not mount: the
  // absence would be visible — the object has a `nav`, and it looks ready — while the accessibility dialogs and the pause
  // menu answered only to the MOUSE, pillar 2 failing whole.
  //
  // Attaching here is safe before the game finishes booting: with no dialog open and no pause menu, `menuNavKey`
  // consumes no key and lets it go on to its owner.
  /*
   * 🔴 ONE BUTTON ONLY TAKES THE KEY BEFORE EVERYONE ELSE (ADR-0218, issue #201), and that is why this listener is registered
   * HERE, above `nav.attach()`, instead of beside the cool-down and the simulations further down.
   *
   * With the scan on, the child has ONE input in the world, and every press of it means the same thing: take what is showing.
   * It must not also move a menu, reach the game or feed the motor filters — so the press is stopped dead (`barrar`) and the
   * scan decides what happens. Listeners on one node run in the order they were registered, and `stopImmediatePropagation`
   * only reaches the ones after it: registered below the menu navigation, this would have let the menu move AND the scan take,
   * which is one press doing two things.
   *
   * ⚠️ `scanPress` is filled in much later, where the virtual controller exists. Until then, and whenever the scan is off,
   * this listener answers nothing — the same hoisting the pause card's host uses, and for the same reason: what has to run
   * first is not what can be built first.
   */
  const blockKey = (e: Event): void => { e.preventDefault(); e.stopImmediatePropagation(); };
  /** Takes the item the scan shows, for a press from `source`; answers whether one-button scanning took it (ADR-0218 §4). */
  let scanPress: ((source: TransportName | undefined) => boolean) | null = null;
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!state.switchScan || !scanPress || keyboard.whichPlayer(e.code) < 0) return;
    // A HELD KEY IS ONE PRESS, not one a frame: a child who cannot let go would otherwise take an item every repeat.
    if (!e.repeat) scanPress(sourceOfEvent(e) ?? 'teclado');
    blockKey(e);
  }, true);
  win.addEventListener('keyup', (e: KeyboardEvent) => {
    if (state.switchScan && scanPress && keyboard.whichPlayer(e.code) >= 0) blockKey(e);
  }, true);
  /*
   * 🔴 AND EVERY TOUCH ON THE GAME REGION (ADR-0218 §4) — and on the on-screen pad, wherever the host put it. Registered here
   * for the key's reason: above the menus' own pointer listeners (a hold places the cursor, ADR-0159), the pad's and the game's,
   * so one touch is one take and nothing else. The click the browser fires after it is swallowed too; a click the ENGINE sends
   * — a menu's «confirm» pressing its item — is not, which is why `scanPress` clears the mark before every take.
   * 📌 THE QUICK BAR STAYS ITSELF: ☝️ on it is the way OUT of one-button mode, and 📷 and 👄 turn the camera and voice transports
   * on and off — the child's own switches, which a scan must not swallow (ADR-0218 erratum of 2026-09-26).
   */
  let swallowClick = false;
  const scanTakesTouch = (target: EventTarget | null): boolean => {
    const el = target as Element | null;
    if (!state.switchScan || !scanPress || !el || typeof el.closest !== 'function') return false;
    const onTheBar = !!el.closest(`${ENGINE_CONTROLS_IN_PLAY}, .pause-icons`) || !!a11yBar?.contains(el);
    return !onTheBar && !!el.closest('#game-region, #touch-controls');
  };
  win.addEventListener('pointerdown', (e: PointerEvent) => {
    swallowClick = false;
    if (!scanTakesTouch(e.target)) return;
    blockKey(e);
    scanPress?.('toque');
    swallowClick = true;
  }, true);
  win.addEventListener('pointerup', (e: PointerEvent) => { if (scanTakesTouch(e.target)) blockKey(e); }, true);
  win.addEventListener('click', (e: MouseEvent) => { if (swallowClick) { swallowClick = false; blockKey(e); } }, true);

  // ⚠️ AND NOW THE MENU NAVIGATION SWITCHES ON — after the block above, and the ORDER IS THE BEHAVIOUR: listeners on one
  // node run in registration order, so the scan sees the key first and can stop it. The other way round, one press would
  // move the menu AND take an item (ADR-0218). 🔴 No type sees a lost call: browser cases hold that the menus answer the
  // keyboard.
  nav.attach();

  // ⚠️ AND THE FOCUS TRAP. With an overlay open, Tab went into the board underneath, while every `.overlay__card` in the
  // document says `aria-modal="true"`. A promise the keyboard contradicts is worse than no promise: a screen-reader user
  // steps out into a game whose state they do not understand.
  initFocusTrap({
    topOverlay: overlays.topVisibleOverlay,
    currentFocus: () => doc.activeElement,
    focusablesIn: focusablesInDom,
    win,
  }).attach();

  /**
   * THE REACH: among the transports AVAILABLE to this child, does any carry this game's actions?
   *
   * ⚠️ The detection: `pointer:coarse && hover:none` is touch, and the opposite is keyboard. It is wrong on a tablet WITH
   * a keyboard — and the error is tolerable only because the screen INFORMS instead of refusing. See the header of
   * `ui/reach-notice`.
   */
  const deviceAvailability: Availability = o.availability ?? {
    gamepad: () => { try { return [...(win.navigator?.getGamepads?.() ?? [])].some(Boolean); } catch { return false; } },
    touch: () => { try { return win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches; } catch { return false; } },
    keyboard: () => { try { return !(win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches); } catch { return true; } },
    /**
     * THE MOUSE (ADR-0112) — and the probe is `any-pointer` on purpose, not `pointer`.
     *
     * ⚠️ `(pointer:fine)` describes the PRIMARY pointer, so a tablet with a mouse plugged in answers coarse and the mouse
     * disappeared — exactly the device this question exists to find. `any-pointer:fine` says ANY of the pointing devices
     * is fine, which is the right question: to draw, one is enough.
     *
     * ⚠️ A stylus also answers `fine`, and it is a real pointer — so that is not an error. What can be missing is a mouse
     * plugged in after boot, which is why the probe is a FUNCTION, evaluated at every question, like the three above.
     */
    mouse: () => { try { return win.matchMedia('(any-pointer:fine)').matches; } catch { return false; } },
  };
  // The second axis (ADR-0104 §A) and the third (ADR-0112) come from the game, like the first: how many positions it
  // holds at once, and whether it needs a pointer. `?? false` and not an invented default: the field is optional on
  // purpose — see its note —, and its absence means the game does not draw.
  /*
   * THE REACH AND ITS NOTICE, in one function, because both depend on the cartridge and the second CREATES DOM.
   *
   * ⚠️ The notice is the only place in this root that writes an element from a game's answer, and so the only one that
   * must be REMOVED before being rewritten: `showReachNotice` creates a `div` with a fixed `id`, so calling it twice
   * would leave two — and the second cartridge would have the first one's notice under its own.
   *
   * 📌 `removeReachNotice()` ALWAYS runs first, not only when there is something to show: a cartridge with nothing to
   * warn about must erase the previous one's notice, and that is the case that gets forgotten.
   */
  function removeReachNotice(): void {
    const notice = $<HTMLElement>(`#${REACH_NOTICE_ID}`);
    if (!notice) return;
    // ⚠️ CAPABILITY AND NOT TYPE, for the reason this file gives about `instanceof HTMLElement`: the host may be a fake
    // document, and the ones these tests use have `parentNode` but no `remove`. Asking for the method works in both.
    if (typeof notice.remove === 'function') notice.remove();
    else notice.parentNode?.removeChild(notice);
  }
  function deriveReach(): Reach {
    const declaredActions = cartridge.preset ? presetActions(cartridge.preset) : [];
    const a = reach(
      defaultTransports(deviceAvailability),
      declaredActions,
      cartridge.declaration.holdsAtOnce(),
      cartridge.declaration.needsPointer?.() ?? false,
    );
    removeReachNotice();
    // ⚠️ IT APPEARS ONLY WHEN THERE IS SOMETHING TO SAY. A notice that always appears stops being read, and a game whose
    // actions fit the touch screen has nothing to warn about — the common case, which must stay silent.
    if (declaredActions.length) {
      showReachNotice({
        find: (sel) => $<HTMLElement>(sel),
        create: (tag) => doc.createElement(tag),
        t,
        srAlert,
      }, a);
    }
    return a;
  }
  let currentReach = deriveReach();

  /*
   * THE RESOLUTION IS THE ENGINE'S (ADR-0163), and the cartridge has no other. The Dev: «A Engine deve forçar isso e
   * guiar esta construção, de modo que o cartucho não tenha alternativa». The region gets the largest integer multiple
   * of 320×180 in REAL pixels that fits the stage, never less than 640×360, with the tolerance of ≤5 logical px cut
   * per side — and again at every window resize (ADR-0001).
   * ⚠️ The STAGE is the `#stage-wrap`/`.stage-wrap` shell when it exists; without it, the region's parent — the room it has.
   * ⚠️ BY CAPABILITY, like the rest: a double without `style.setProperty` is not resized, and the boot does not fall for it.
   */
  let appliedScale: Scale | null = null;
  /**
   * What departs is SAID (ADR-0163 rule 4): the region's measured size against the one the engine gave it, read when
   * `problems` is read — a cartridge that resizes the region after boot is seen then, and the line goes when it stops.
   */
  function regionResizedByCartridge(): string | null {
    const regionEl = $<HTMLElement>('#game-region');
    if (!appliedScale || !regionEl || typeof regionEl.getBoundingClientRect !== 'function') return null;
    const r = regionEl.getBoundingClientRect();
    if (!r.width || !r.height) return null; // not laid out: nothing measured, nothing to accuse
    const { width: scaledWidth, height: scaledHeight } = appliedScale;
    if (Math.abs(r.width - scaledWidth) < 1 && Math.abs(r.height - scaledHeight) < 1) return null;
    return `the cartridge sized #game-region to ${Math.round(r.width)}×${Math.round(r.height)} over the engine's `
      + `${Math.round(scaledWidth)}×${Math.round(scaledHeight)}: text and targets stop following the screen, so a child with low vision `
      + 'gets them small — the resolution is the engine\'s (ADR-0163): lay the game out inside the region and read `--ui-fs` and `--alvo-min`';
  }
  /*
   * THE CONTEXT OF THE TWO DRAWING REPORTERS (`ui/drawing-problems`), and the three readers are FUNCTIONS on purpose: the
   * region, the bar and the scale are things this root SWAPS — a `mount()` swaps the cartridge, the bar is born after the
   * root, and the scale changes at every `resize`. Passing them by value would freeze the first answer, and an element
   * out of the page still answers `getBoundingClientRect()` without complaint.
   */
  const drawingContext: DrawingProblemsCtx = {
    region: () => $<HTMLElement>('#game-region'),
    bar: () => a11yBar,
    scale: () => appliedScale,
    computedStyle: typeof win.getComputedStyle === 'function' ? (el) => win.getComputedStyle(el) : undefined,
  };
  function applyResolution(): void {
    const regionEl = $<HTMLElement>('#game-region');
    const stage = $<HTMLElement>('#stage-wrap') ?? $<HTMLElement>('.stage-wrap') ?? (regionEl?.parentElement ?? null);
    if (!regionEl || !stage || typeof regionEl.style?.setProperty !== 'function') return;
    const { w, h } = screenBaseSize(Math.max(1, players().length));
    appliedScale = stageScale(stage.clientWidth || w, stage.clientHeight || h, win.devicePixelRatio || 1, w, h);
    applyScale(regionEl, appliedScale);
    crtScanVars(); // the scanline period is one art pixel in REAL pixels, so it follows the scale (study item A5)
    reserveBarBand();
  }
  /**
   * THE ROOM THE GAME LEAVES FREE UNDER THE TOP EDGE (ADR-0148 §3, erratum of 2026-09-13; issue #160), written as
   * `--barra-a11y-h` on the region: the bar's own offset, the bar, the line of the pointed icon's NAME under it, and a
   * light gap of a quarter of that line's font (4 px at 640×360). 📏 Measured at 640×360: the variable said 44 px (the bar alone) and the name, at
   * 57–87 px, covered the quiz statement. The Dev: «é necessário que exista um leve espaçamento abaixo da barra».
   * 📌 The name line is counted whether or not a name is showing — reserving only while pointing would move the game
   * under the child's finger. Measured again at every scale and every typography step: both change the text's size.
   * ⚠️ Zero without a bar: nothing to reserve.
   * 📌 With a HUD the room also holds the mission, centred just under the bar (ADR-0239 erratum), when it reaches lower than
   * the bar's room. The rest of the HUD is the row at the bottom, measured with it.
   */
  function reserveBarBand(): void {
    reserveTopBand({
      region: $<HTMLElement>('#game-region'),
      bar: a11yBar as HTMLElement | null,
      hud: hudMounted,
      ...(typeof win.getComputedStyle === 'function' ? { computedStyle: (el: HTMLElement) => win.getComputedStyle(el) } : {}),
    });
    reserveRowBand();
  }
  /*
   * THE HUD ROW AT THE BOTTOM (ADR-0239; issue #94): learning bars · the session clock · the power over the score · the game's
   * map, left to right. The ROOT's, for its whole life — the clock lives in it and the session is the root's — and the bands
   * of each cartridge go into its cells. Measured (`--hud-row-h`, `--hud-row-bottom`) at every measure of the top and at every
   * tick of the clock: the on-screen pad shows and hides with the child's hands, and the row must stand above it.
   */
  const hudRow = mountHudRow(doc, $<HTMLElement>('#game-region'));
  whenDisposed(() => { hudRow?.row.parentNode?.removeChild(hudRow.row); });
  function reserveRowBand(): void {
    reserveBottomBand({ region: $<HTMLElement>('#game-region'), row: hudRow?.row ?? null, pad: $<HTMLElement>('#touch-controls') });
  }
  /*
   * THE HUD the engine mounts from the cartridge's `hud` (ADR-0168; issue #162). Read on every animation frame while mounted —
   * the numbers are functions, so a game never has to say «refresh»; only a changed text is written, and a changed text
   * measures the room again, because a longer number can wrap.
   */
  let hudMounted: HudBandsMounted | null = null;
  let hudFrame = false;
  /*
   * THE SESSION CLOCK (ADR-0236, ADR-0239, ADR-0050 §3; issue #94): a label over the time left in digits and a Time Timer pie,
   * in the centre of the HUD row, for every cartridge — it measures the SESSION, which is this root's life, so a `mount()` does
   * not restart it and only `dispose()` takes it away. It always shows, measures one hour and turns red at the end: nothing on
   * the child's side sets it, and nothing about it is stored (ADR-0240).
   */
  const sessionClock: SessionClockMounted | null = mountSessionClock({
    doc, slot: hudRow?.clock ?? null, t: translator.t,
    // as the host has them: a host with no clock mounts none, answered in the module (ADR-0232)
    performance: win.performance, setInterval: win.setInterval, clearInterval: win.clearInterval,
    announce: srSay, drawn: reserveRowBand,
  });
  whenDisposed(() => { sessionClock?.remove(); });
  localeOn(() => { sessionClock?.refresh(); });
  function mountHud(): void {
    hudMounted?.remove();
    hudMounted = null;
    const regionEl = $<HTMLElement>('#game-region');
    const numbers = cartridge.hud ?? [];
    if (numbers.length && regionEl && typeof regionEl.appendChild === 'function') hudMounted = mountHudBands(translator, doc, regionEl, numbers, 0, hudRow ?? undefined);
    reserveBarBand();
    if (hudMounted && !hudFrame && typeof win.requestAnimationFrame === 'function') {
      hudFrame = true;
      const position = (): void => {
        if (!hudMounted) { hudFrame = false; return; }
        if (hudMounted.refresh()) reserveBarBand();
        win.requestAnimationFrame(position);
      };
      win.requestAnimationFrame(position);
    }
  }
  mountHud();
  applyResolution();
  if (typeof win.addEventListener === 'function') win.addEventListener('resize', applyResolution);

  /*
   * THE SKIP LINK, when the page has none (study item C5; WCAG 2.4.1). The stylesheet rule, the dictionary sentence and its
   * layer (ADR-0102) already existed, and the element depended on each page remembering it: the quiz writes its own, and a
   * cartridge page that did not copy it left a keyboard no way over what precedes the game. First in the body, so it is the
   * first thing a keyboard reaches; a page's own link is kept. By capability: a host double without a body mounts nothing.
   */
  if (doc.body && typeof doc.body.insertBefore === 'function' && !$('.skip-link')) {
    const skipLink = doc.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.setAttribute('href', '#game-region');
    skipLink.setAttribute('data-i18n', 'skip.toGame');
    skipLink.textContent = t('skip.toGame');
    doc.body.insertBefore(skipLink, doc.body.firstChild); // `data-i18n`: every `setLocale` rewrites it, the boot's included
  }

  /*
   * THE LETTER CASE REACHES THE PAGE (ADR-0028; ADR-0149 §1). The stylesheet capitalises under `:root[data-letras="upper"]`,
   * and nothing wrote that attribute: the communication button's first position kept «capitals» in the state and showed
   * natural case (reported by the Dev). Written at every change, and at boot only when the child CHOSE a case — the state's
   * default is `upper` (ADR-0028) while the cycle's default is position (c), natural case (ADR-0149), and writing the default
   * would put every new child's game in capitals.
   */
  const writeBox = (c: LetterCase): void => {
    if (doc.documentElement?.dataset) doc.documentElement.dataset.letras = c;
  };
  if (store.get(KEYS.letterCase, null) !== null) writeBox(state.letterCase);
  stateOn('letterCase', writeBox);

  {
    /*
     * THE BAR IS HUD, AND THE GAME DOES NOT WRITE OVER IT (ADR-0148 §3). `#title-icons` is `position:absolute` INSIDE
     * `#game-region`, and a game's heading can take the same pixels: the child looking for blind mode finds the question's
     * title over the buttons, with no error, no type, no console — and whoever depends on the row most is whoever cannot
     * see it is covered.
     *
     * 📌 THE ENGINE SAYS, and does not fix — because it cannot. Pushing the game's content would mean changing the width
     * and height `ui/layout` locks to an integer multiple of real pixels, which is ADR-0001's scale. The engine has the
     * rectangle; the game draws, and now knows where not to draw. The reserved room itself (`--barra-a11y-h`, next to
     * `--tap` and `--alvo-min`) is written by `reserveBarBand`, inside `applyResolution`.
     *
     * ⚠️ BY CAPABILITY AND NOT BY TYPE: a fake document has no `getBoundingClientRect`, and reading it blindly would bring
     * the boot down where there is no DOM. Without the measure, nobody is accused: silence beats an invented accusation.
     */
    const intruders = barIntruderProblems(drawingContext);
    if (intruders.length) {
      hostProblems.push(
        `the game draws over the accessibility bar (${intruders.slice(0, 4).join(', ')}): a child who needs its buttons `
        + 'to start cannot reach them — read `--barra-a11y-h` on #game-region and leave that room free (ADR-0148)',
      );
    }
  }

  const announceFailure = createCrashNotice({
    t: translator.t,
    find: (sel) => $<HTMLElement>(sel),
    create: (tag) => doc.createElement(tag),
    narrate: (text) => tts.narrate(text),
  });

  /*
   * ⚠️ SHOWING REBUILDS THE ITEMS BEFORE REVEALING, and the order is the rule: ADR-0106 §5 says the child never sees an
   * item that does not act, and this game's action table may have changed since mounting. Revealing first and
   * rebuilding after would leave a blink in which she sees what she cannot use.
   */
  const pauseControls = {
    show: (i: number) => {
      pauseIcons.reflectPauseIcons();
      const findPauseCard = $<HTMLElement>(`#vp-pause-${i}`);
      if (!findPauseCard) return;
      findPauseCard.hidden = false;
      updateCaption();
      // 🔴 THE CURSOR LANDS ON ITEM 1, at the root (ADR-0158: «a saída é onde o cursor cai ao abrir»). Without it, opened
      // by SELECT no item was marked, and the first arrow jumped to item 2.
      showPauseOptions(findPauseCard, 'raiz');
    },
    hide: (i: number) => {
      const findPauseCard = $<HTMLElement>(`#vp-pause-${i}`);
      if (findPauseCard) findPauseCard.hidden = true;
      updateCaption();
    },
  };

  /*
   * ===================== THE KEYS THAT OPEN THE PAUSE (ADR-0144, ADR-0155) =====================
   *
   * ⚠️ BUBBLING, NOT CAPTURE. `menuNavKey` runs in CAPTURE with `stopPropagation()`, and the header of `ui/menu-nav` keeps
   * TWO preserved defects about it — today's correct behaviour depends on that `stopPropagation()` and not on the
   * registered chain. Putting a second meaning in the same phase would lean on that accidental safety net. In bubbling,
   * `menuNavKey` always has the first refusal, and the game's OWN listener — which lives in `#game-region`, under the
   * window — runs before these. Whoever owns the key stays its owner.
   *
   * 📏 AND `menuNavKey` DOES NOT EAT these keys: `menuKeyIntent` (`ui/menu-intent`) has no branch for `start`, `select`
   * or `action4` (only `action2`, `action3` and the four directions), so it finds no intent and lets them go. That is
   * why the guards below exist — in real situations the key arrives here and is not ours.
   *
   * ⚠️ THE ENGINE OPENS THE CARD; THE GAME STOPS THE WORLD (ADR-0144 §2). Freezing physics and silencing the ambience are
   * the game's, so the second half is a request, `setPhase('paused')`, and not an order.
   */
  /** The seat that owns a key, if it is ITS `presetAction` position; otherwise `null`. */
  function seatOfPosition(code: string, presetAction: 'start' | 'select' | 'action4'): number | null {
    // ⚠️ THE KEY'S OWNER DECIDES THE SEAT, as in `menuNavKey`: whoever pressed opens THEIR pause. A key that is nobody's
    // (`-1`) cannot be any seat's «start» — asking seat 0 about it would hand Player 1's pause to whoever pressed a loose
    // key.
    const keyOwner = keyboard.whichPlayer(code);
    if (keyOwner < 0) return null;
    return keyboard.actionOf(code, keyOwner) === presetAction ? keyOwner : null;
  }

  /*
   * ===================== THE QUICK PAUSE — START (ADR-0155) =====================
   *
   * The game FREEZES (`setPhase('paused')` is asked, as ADR-0144 §2 asked for the card), the directional goes to the BAR,
   * and the word PAUSED appears in the centre. No card is drawn: it is the print view.
   *
   * 📌 ONE WAY OUT, by any door. «Voltar» on the bar, START again and SELECT all end in `pauseIcons.leaveBar`, and the
   * `onLeaveBar` hook is what unfreezes. Two ways out written apart would be two chances for one of them to leave the
   * world stopped with the child back on the character.
   *
   * ⚠️ AND THE STATE IS IN-QUICK-PAUSE, not on-the-bar: a host without `#title-icons` has no bar to enter, and the quick
   * pause still freezes and says PAUSED — with START leaving it. Asking the bar would trap that child in a stopped game.
   */
  let pausedWord: HTMLElement | null = null;
  /*
   * THE FOOTER LEGEND of the frozen screen (ADR-0155 erratum): «Ação 2: confirmar · Ação 3: voltar · Ação 4: menu ·
   * START: voltar ao jogo». It is the menus' second door — `action4` — and it also tells the child SELECT is not the
   * only one: the stopped screen teaches how to leave it and where to.
   * (`pauseCaption` is declared before `changePhase`; see there.)
   */

  function showPaused(): void {
    const regionEl = $<HTMLElement>('#game-region');
    if (!pausedWord && regionEl && typeof regionEl.appendChild === 'function') {
      pausedWord = doc.createElement('div');
      pausedWord.className = 'pausa-rapida';
      // The screen reader already hears the entry into the bar, which says the game stopped and how to go back; the word
      // is for the eyes, and said twice it trampled the announcement that teaches the way out.
      pausedWord.setAttribute('aria-hidden', 'true');
      regionEl.appendChild(pausedWord);
    }
    if (!pausedWord) return;
    // resolved WHEN SHOWN: the language may have changed since boot
    pausedWord.textContent = t('pause.quick');
    pausedWord.hidden = false;
    updateCaption();
  }

  /**
   * THE BUTTON LEGEND FOLLOWS THE SCREEN (ADR-0164 rule 3): on the quick pause it says the quick pause's buttons, on the
   * pause card (SELECT) the menu's — «2: confirmar · 3: voltar» —, and nothing in play. Asked again whenever one of them
   * opens or closes; a card hidden by a path that calls nothing here (the print mode) is seen by the observer below.
   */
  function updateCaption(): void {
    const cardOpen = !!$<HTMLElement>('.screen-pause:not([hidden])');
    const text = inQuickPause.size ? t('pause.quick.legenda') : cardOpen ? t('pause.card.legenda') : null;
    if (!text) { if (pauseCaption) pauseCaption.hidden = true; return; }
    if (!pauseCaption) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (!home) return;
      pauseCaption = doc.createElement('div');
      pauseCaption.className = 'pausa-legenda';
      pauseCaption.setAttribute('aria-hidden', 'true');
      home.appendChild(pauseCaption);
    }
    writeCaption(pauseCaption, text); // resolved when shown: the language may have changed since boot
    pauseCaption.hidden = false;
  }
  /*
   * EVERY CHANGE OF CONTEXT IS ANNOUNCED (ADR-0159 rule 3): «Opening a menu or panel speaks its title; closing it speaks
   * where the child is back to; entering play is announced.» 📏 Measured in the dist: SELECT opened the card in silence,
   * and a panel opened, closed and went back to the root without a word.
   * 📌 ONE PLACE, by comparison: the observer below asks where the child is now — a panel, a list of the card, or the
   * game — and speaks only when that changed. An arrow changes no `hidden`, so it still says only the item.
   */
  let screenAnnounced = 'jogo';
  const rootWithIndex = (): boolean => (cartridge.withIndex ?? (() => true))();
  /*
   * 🔴 THE QUESTION LIVES IN `ui/where-the-child-is` (ADR-0221 step 7c); what stays here is answering where it reads the
   * document from. Whether this is a panel, a list of the card or the game, and what it is called, is a rule with a
   * reason — not wiring — and ADR-0221's erratum measures a root's debt in branches.
   */
  const whereIsTheChild = (): Place => whereTheChildIs({
    t: translator.t,
    topVisibleOverlay: overlays.topVisibleOverlay,
    pauseCard: () => $<HTMLElement>('.screen-pause:not([hidden])'),
    focused: () => doc.activeElement,
    withIndex: rootWithIndex,
  });
  function announceContext(): void {
    const nowMs = whereIsTheChild();
    if (nowMs.key === screenAnnounced) return;
    const cameFromMenu = screenAnnounced !== 'jogo';
    screenAnnounced = nowMs.key;
    if (nowMs.sentence) srSay(nowMs.sentence);
    // back in play from a menu — the quick pause says its own exit
    else if (cameFromMenu && !inQuickPause.size) srSay(t('sr.a11y.barExit'));
  }
  {
    const regionEl = $<HTMLElement>('#game-region');
    const Observer = (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (regionEl && Observer && typeof regionEl.appendChild === 'function') {
      new Observer((records) => {
        const classes = records.map((r) => (r.target as Element).classList);
        if (classes.some((c) => c?.contains('screen-pause'))) updateCaption();
        // the modal boundary follows the front card by ANY door, including a close that returns no focus (ADR-0130 rule 1)
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay'))) overlays.syncLayers?.();
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay') || c?.contains('pause-menu'))) {
          announceContext();
          // 🔴 THE NAMES A CHILD CAN SAY CHANGED (ADR-0194 §1): this is the one signal that a card, one of its lists or a panel
          // showed or hid — without it no menu's names reach the recogniser, and no name can be said.
          voiceControl?.refreshGrammar();
        }
        // ADR-0166: the pad leaves when the card or a panel opens, and comes back when the last of them closes
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay'))) reflectPadInMenus();
        // a simulation stops while a menu is open and comes back with the game (issue #182)
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay'))) recomposeWorldFilter();
      }).observe(regionEl, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    }
    // ADR-0245: a footer explanation longer than its lines scrolls inside them, at the child's caption rate; reduced motion is the
    // system's or the child's (any scene switch reduced: pages carry the same words, so a false «reduced» costs nothing)
    if (regionEl && Observer && typeof win.getComputedStyle === 'function' && typeof doc.createRange === 'function') {
      watchFooterScroll(regionEl, {
        doc, getComputedStyle: (el) => win.getComputedStyle(el), MutationObserver: Observer,
        setTimeout: (fn, ms) => win.setTimeout(fn, ms), clearTimeout: (id) => win.clearTimeout(id),
        ppm: () => state.captionPpm,
        reduced: () => defaultReducedMotion(win.matchMedia) || SCENE_KEYS.some((k) => sceneMotion[k]),
      });
    }
  }

  /*
   * THE SCREEN FOOTER: one column, at the bottom of the region, with the EXPLANATION of the pointed icon above the quick
   * pause's LEGEND. The Dev's request — the name under the row, what it does in the footer (`CLAUDE.md` §4, the three
   * zones).
   * ⚠️ ONE COLUMN and not two bands positioned apart: the quick pause lands the cursor on the first icon on entering, so
   * both appear together from the first instant, and two absolute boxes covered each other when one wrapped.
   */
  function screenFooter(regionEl: HTMLElement | null): HTMLElement | null {
    if (footer || !regionEl || typeof regionEl.appendChild !== 'function') return footer;
    footer = doc.createElement('div');
    footer.className = 'rodape-da-tela';
    regionEl.appendChild(footer);
    return footer;
  }
  /**
   * The button legend as one dark chip per «name: function» (ADR-0164 rule 3) — the dictionary writes the items joined
   * by « · », and each becomes its own element so the background sits behind the words and not across the screen.
   */
  function writeCaption(home: HTMLElement, text: string): void {
    home.textContent = '';
    text.split('·').map((s) => s.trim()).filter(Boolean).forEach((item, i) => {
      // a space between chips, by capability: a host document without createTextNode still gets the chips
      if (i > 0 && typeof doc.createTextNode === 'function') home.appendChild(doc.createTextNode(' '));
      const name = doc.createElement('span');
      name.className = 'lg-nome';
      name.textContent = item;
      home.appendChild(name);
    });
  }
  function explainIconInFooter(k: string | null): void {
    writeInFooter(k ? t(`icon.${k}.dica`) : null);
  }
  /*
   * THE SOUND CAPTION (study item D3). In the footer column, above the button legend and the explanation (ADR-0164 rule 4:
   * «the sound caption above, the explanation below it»); `aria-hidden`, because whoever listens heard the sound itself.
   * 📌 Its time on screen is a child's reading time for its words, never under the 2600 ms the games had measured in play
   * (`core/caption-duration`, plan phase 5c); a new caption restarts it.
   * 📌 Written while captions are on OR deaf mode is: in deaf mode every sound gets its caption (ADR-0234).
   */
  let soundCaption: HTMLElement | null = null;
  let clearSoundCaption: ReturnType<typeof setTimeout> | null = null;
  function writeSoundCaption(text: string): void {
    if (!deafMode.captionsOn() || !text) return;
    if (!soundCaption) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (!home) return;
      soundCaption = doc.createElement('div');
      soundCaption.className = 'legenda-de-som';
      soundCaption.setAttribute('aria-hidden', 'true');
      home.appendChild(soundCaption);
    }
    const captionHome = soundCaption;
    captionHome.textContent = text;
    captionHome.hidden = false;
    if (clearSoundCaption !== null) clearTimeout(clearSoundCaption);
    clearSoundCaption = setTimeout(() => { captionHome.hidden = true; captionHome.textContent = ''; }, captionDuration(text, state.captionPpm));
  }
  /**
   * The footer says ONE explanation at a time: the pointed icon's, or the reason a locked item is locked (ADR-0161). `null` is
   * the item leaving — and the band goes back to the game's text, not to empty (ADR-0244 §2).
   */
  function writeInFooter(text: string | null): void {
    itemExplanation = text || null;
    showExplanation();
  }
  /** The game's own explanation, its resting text (ADR-0244 §1); `null` clears it. Under a pointed engine item until it leaves. */
  function explainForGame(text: string | null): void {
    gameExplanation = text || null;
    showExplanation();
  }
  function showExplanation(): void {
    const text = itemExplanation ?? gameExplanation;
    if (!barExplanation && text) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (home) {
        barExplanation = doc.createElement('div');
        barExplanation.className = 'barra-explicacao';
        barExplanation.setAttribute('aria-live', 'polite');
        home.insertBefore(barExplanation, home.firstChild);
      }
    }
    if (!barExplanation) return;
    barExplanation.textContent = text ?? '';
    barExplanation.hidden = !text;
  }

  function enterQuickPause(seat: number): void {
    inQuickPause.add(seat);
    recomposeWorldFilter(); // the quick pause is a menu: the simulation stops (issue #182)
    pauseIcons.enterBar(seat);
    if (!pauseIcons.onBar(seat)) srSay(t('sr.a11y.quickPause'));
    showPaused();
    changePhase('paused');
  }

  /** Leaves by any door. `to` says where: the game (unfreezes) or the card (stays stopped). */
  function leaveQuickPause(seat: number, to: 'jogo' | 'cartao'): void {
    if (pauseIcons.onBar(seat)) { pauseIcons.leaveBar(seat, to === 'cartao'); return; } // the hook finishes the job
    if (to === 'jogo') srSay(t('sr.a11y.barExit'));
    endQuickPause(seat, to === 'cartao');
  }

  function endQuickPause(seat: number, toOtherScreen: boolean): void {
    if (!inQuickPause.delete(seat)) return; // the simulation returns through the observer: leaving writes the card's `hidden`
    if (pausedWord && inQuickPause.size === 0) pausedWord.hidden = true;
    if (!toOtherScreen) changePhase('playing');
  }

  /**
   * THE PAUSE IS PER SCREEN, AND A SHARED SCREEN'S IS ITS FIRST PLAYER'S (ADR-0144, erratum of 2026-09-26). This root draws ONE
   * screen — one region, one pause card (`#vp-pause-0`), one quick bar (`getA11yBars`) — and every seat it seats plays on it, so
   * its pause and its menus answer seat 0: START and SELECT from any other seat, by any transport, do nothing. A player with a
   * screen of her own has a root of her own, and its pause. START asks this below and the pad's START on an open menu asks it
   * too (`resume`); SELECT needs no question, because `openSeatMenus` opens the seat's own card and this root mounts seat 0's only.
   */
  function leadsTheScreen(seat: number): boolean {
    return seat === 0;
  }

  /**
   * START for a seat, by whatever door: the key below, or a transport pressing the virtual controller in play (`systemPress`,
   * ADR-0144 §1 «from any transport»). Answers whether it acted — the key is consumed only then.
   */
  function startForSeat(seat: number): boolean {
    if (!leadsTheScreen(seat)) return false; // another seat of this screen: its START does nothing (ADR-0144 erratum)
    // GUARD 1 — A PANEL IS OPEN. With an overlay visible, `menuNavKey` receives the key, finds no intent in it and leaves
    // without consuming it. Without this guard the quick pause would open UNDER the panel the child is in. Escape closes
    // a panel, not START.
    if (overlays.topVisibleOverlay()) return false;

    // START AGAIN LEAVES — the second way out of the mode that ADR-0044 item 7 already gave START.
    if (inQuickPause.has(seat)) { leaveQuickPause(seat, 'jogo'); return true; }

    // GUARD 2 — THE CARD IS OPEN. With it open and a «start» key other than `Enter`, `menuNavKey` finds no intent and
    // lets it through. Closing the card belongs to «Voltar ao jogo» and to Escape.
    const findPauseCard = $<HTMLElement>(`#vp-pause-${seat}`);
    if (findPauseCard && findPauseCard.hidden === false) return false;

    enterQuickPause(seat);
    return true;
  }

  function toggleQuickPauseByStart(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'start');
    if (seat === null) return;
    // GUARD 0 — THE KEY WAS TYPED INTO A FIELD. A text field owns Enter and every character, so `Enter` or `H` typed there is
    // the field's and not START, on the way in and out alike (ADR-0111 erratum of 2026-09-26). Left undecided, so it types.
    if (keyTypedIntoField(e.target as Element | null)) return;
    // GUARD 3 — THE KEY PRESSES THE ENGINE'S FOCUSED CONTROL. `Enter` is «start», and a focused button is activated by Enter as
    // well as Space: on ☰ it is ☰'s press, not the pause (ADR-0111 erratum of 2026-09-26, one key one action). Left undecided
    // here, so the browser clicks it. Only on the way IN: on the quick pause's own bar the leave keeps its meaning.
    if (!inQuickPause.has(seat) && keyPressesOwnControl(e.code, e.target as Element | null, ENGINE_CONTROLS_IN_PLAY)) return;
    // 📌 CONSUMED ONLY when it was in fact OURS. `Enter` is «start» by default (`input/default-bindings`), and without this
    // the same press would pause AND activate whatever had focus.
    if (startForSeat(seat)) e.preventDefault();
  }

  win.addEventListener('keydown', toggleQuickPauseByStart);

  /*
   * ===================== SELECT OPENS THE MENUS (ADR-0155) =====================
   *
   * The card of ADR-0151. `select` is mapped (`KeyF`, `input/default-bindings`), and ADR-0086 kept it for «what belongs
   * to the session» — the pause menus are that.
   *
   * ⚠️ FROM THE QUICK PAUSE TO THE CARD the game does NOT unfreeze: the bar is left in silence (saying «back to the game»
   * with the card opening would be a lie) and the phase is already `paused` — asking for it again would be a second
   * `paused` in a stopped game.
   */
  /** Opens the seat's card, whichever door it comes from — the SELECT key, the ☰ or the touch pill. Returns whether it opened. */
  function openSeatMenus(seat: number): boolean {
    if (overlays.topVisibleOverlay()) return false;
    const findPauseCard = $<HTMLElement>(`#vp-pause-${seat}`);
    if (!findPauseCard || findPauseCard.hidden === false) return false;
    const alreadyStopped = inQuickPause.has(seat);
    if (alreadyStopped) leaveQuickPause(seat, 'cartao');
    // ⚠️ SHOWING COMES FIRST, and the order is the defence: a game without `setPhase` must get the card all the same.
    pauseControls.show(seat);
    if (!alreadyStopped) changePhase('paused');
    return true;
  }
  function openMenusBySelect(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'select');
    // `F` typed into a field is a letter, not SELECT (ADR-0111 erratum of 2026-09-26): the field owns every character.
    if (seat === null || keyTypedIntoField(e.target as Element | null)) return;
    if (openSeatMenus(seat)) e.preventDefault();
  }
  win.addEventListener('keydown', openMenusBySelect);

  /*
   * THE MENUS' SECOND DOOR: `action4`, only INSIDE the quick pause (ADR-0155 erratum). Outside it `action4` is the game's,
   * and the engine does not touch it — that is the pair that keeps the door from stealing a verb mid-match.
   * 📏 `menuNavKey` has no intent for `action4` and, on the bar, lets it rise without consuming it: it arrives here.
   */
  function openMenusByAction4(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'action4');
    if (seat === null || !inQuickPause.has(seat)) return;
    if (overlays.topVisibleOverlay() || keyTypedIntoField(e.target as Element | null)) return; // a letter typed into a field
    leaveQuickPause(seat, 'cartao');
    pauseControls.show(seat);
    e.preventDefault();
  }
  win.addEventListener('keydown', openMenusByAction4);

  /*
   * ===================== THE VIRTUAL CONTROLLER (ADR-0143, plan phase 4) =====================
   *
   * 🔴 `mountTouchControls`, `initTouch` and `initTouchBindings` are wired HERE: in a school where the device is a tablet
   * with no keyboard, a game booted by this root has to be playable, and nothing else would call them.
   *
   * 📌 THE PAD IS DRAWN ONLY WHEN THE CARTRIDGE ASKS FOR IT (`onScreenPad`, ADR-0166): a game played by touching its own
   * elements needs none. What it lacks is said in `problems` (`touchGaps`); with no `preset` it carries only START and
   * SELECT, the doors to the pause, which is not declinable (ADR-0122).
   */
  const touchHostEl = o.host.touchHost ?? $('#game-region');
  const touchUsable = !!touchHostEl && typeof (touchHostEl as HTMLElement).appendChild === 'function';
  const seat0CardOpen = (): boolean => {
    const c = $<HTMLElement>('#vp-pause-0');
    return !!c && c.hidden === false;
  };
  /** A menu the directional moves is open: an overlay, the seat-0 card, or the quick pause (ADR-0157). */
  const menuWithDpad = (): boolean => !!overlays.topVisibleOverlay() || seat0CardOpen() || inQuickPause.has(0);
  /** A position's key handed to the menus, which read keys — stamped with who produced it (ADR-0109). */
  const keyToMenu = (code: string, origin: TransportName | undefined): void => {
    // 🔴 THE KEYBOARD'S KEY IS ALREADY IN THE WORLD (ADR-0223). This function translates POSITION → key, and it exists for
    // the transports that produce no keys: the finger, the eyes, the face, the hands, the voice, the scan. The keyboard
    // does — the event that got here IS the key — so dispatching it again would move the menu TWICE.
    // 📌 Because this is written here, the keyboard conductor need not ask whether a menu is open: that question has ONE
    // answer, the controller's, and this line is what makes it true for the keyboard too.
    if (!origin || origin === 'teclado') return;
    const eventTarget = $<HTMLElement>('#game-region') ?? doc.body;
    eventTarget.dispatchEvent(stampSource(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }), origin));
  };
  const labelledActions = (): readonly { action: string; label: string }[] => {
    const preset = actionWords();
    const labelOf = labellerFrom(preset);
    return presetActions(preset).flatMap((a) => {
      const label = labelOf(a);
      return label ? [{ action: a, label }] : [];
    });
  };
  const touchPad = initTouch({
    $, srSay, store, win, t: translator.t,
    gameActions: labelledActions,
    root: doc.documentElement,
    isMobile: deviceAvailability.touch,
    viewport: () => ({ w: win.innerWidth, h: win.innerHeight }),
    frontOverlay: overlays.frontOverlay,
    // Touch always belongs to Player 1 (`touch-bindings`), and with the card or a panel open the child touches the menu's
    // buttons DIRECTLY (ADR-0166, which undid ADR-0157's «the pad stays over the menus»). The only two callers that show
    // the pad — the touch listener below and `reflectPadInMenus` — already ask `isMenuOpen()` first.
    padAllowed: () => players().length <= 1,
    // each slot drawn by its size, five named positions or fewer a cycle row (ADR-0130 rule 3)
    drawChoice: (spec, pick) => mountChoice({ find: (sel) => $<HTMLElement>(sel), create: (tag) => doc.createElement(tag) }, spec, pick),
  });

  /** A menu the child touches directly is open: the pause card or a settings panel (ADR-0166 rule 2). */
  function isMenuOpen(): boolean {
    return !!overlays.topVisibleOverlay() || !!$<HTMLElement>('.screen-pause:not([hidden])');
  }
  /** The pad was in view (or asked for by a touch) when a menu took the screen — it comes back when the menu goes. */
  let padBeforeMenu = false;
  function reflectPadInMenus(): void {
    const pad = $<HTMLElement>('#touch-controls');
    if (!pad) return;
    if (isMenuOpen()) {
      if (!pad.hidden) { padBeforeMenu = true; touchPad.hideTouchControls('menu'); }
    } else if (padBeforeMenu) {
      padBeforeMenu = false;
      touchPad.showTouchControls();
    }
  }

  const cartridgeActions = (): Set<string> => new Set(cartridge.preset ? presetActions(cartridge.preset) : []);


  function drawPad(): void {
    if (!touchUsable || !touchHostEl) return;
    // ADR-0166: a cartridge that does not ask for the pad gets none — and one swapped in by `mount()` takes the last one away
    if (!cartridge.onScreenPad) {
      const old = $<HTMLElement>('#touch-controls');
      old?.parentNode?.removeChild(old);
      return;
    }
    const padMap = touchPad.getTouchMap();
    const short = shortLabellerFrom(actionWords());
    const pad = mountTouchControls(
      { find: (sel) => $<HTMLElement>(sel), create: (tag) => doc.createElement(tag), t: translator.t },
      {
        map: padMap,
        gameActions: cartridgeActions(),
        // The FUNCTION of each slot (ADR-0165): the game's SHORT word, said after the button's name in its accessible
        // name; the face shows the name. `start`/`select` are system positions the engine names itself.
        slotLabel: (slot) => (slot === 'start' ? t('touch.start') : slot === 'select' ? t('touch.select')
            // only what the game names is drawn (ADR-0162), so its word always exists
            : (short(padMap[slot] as Action) ?? '')),
        dpad: store.get(KEYS.padDir, 'stick') === 'cross' ? 'cruz' : 'analogico',
      },
    );
    if (!pad.parentNode) touchHostEl.appendChild(pad);
  }

  padGapProblems = () => (!cartridge.onScreenPad ? [] : touchUsable
    ? touchGaps({ map: touchPad.getTouchMap(), gameActions: cartridgeActions() })
    : ['the virtual pad has nowhere to mount: set `host.touchHost`, or give #game-region room for children. '
      + 'Without it, a child on a keyboardless tablet cannot play, nor reach the pause']);

  /**
   * The screen's START: seat 0's QUICK PAUSE, like the key (ADR-0155) — and a second touch leaves it.
   *
   * ⚠️ THE PAD STAYS IN VIEW on the quick pause: the START pill IS the way out for someone who has only a finger, and
   * hiding it would leave the child in a stopped game with no door. With the card open, START closes it.
   */
  function togglePauseByTouch(): void {
    if (overlays.topVisibleOverlay()) return;
    if (inQuickPause.has(0)) { leaveQuickPause(0, 'jogo'); return; }
    if (seat0CardOpen()) { changePhase('playing'); return; }
    enterQuickPause(0);
  }

  const touchBindings = initTouchBindings({
    $, win,
    getSearch: () => win.location?.search ?? '',
    getControls: () => keyboard.controlsState().controls,
    getPlayers: () => players(),
    /*
     * 🔴 TOUCH PRESSES THE VIRTUAL CONTROLLER (ADR-0223), like every other transport: one decision, not a second copy of
     * it inside the pad — a copy that, when it existed, left a cartridge listening to `onCommand` deaf to the finger.
     * 📌 Arrows and not direct references: `virtualController` is born further below (the temporal dead zone).
     */
    press: (action, source) => virtualController.press(action, source),
    release: (action, source) => virtualController.release(action, source),
    playerEdge,
    heldKeys: keys,
    attractOnInput: () => false,
    // a touch inside a menu does not bring the pad over it; it only remembers that the child is on touch (ADR-0166)
    showTouchControls: () => { if (isMenuOpen()) { padBeforeMenu = true; return; } touchPad.showTouchControls(); },
    hideTips: () => {},
    togglePause: togglePauseByTouch,
    /*
     * THE SELECT PILL (ADR-0155): the menus by touch. Without it, someone with only a finger could not reach «Sair», the
     * number of players or the settings — SELECT was a key. ⚠️ THE PAD LEAVES when the card opens (ADR-0166,
     * `reflectPadInMenus`): over the card it would cover the buttons that are now her way out («Voltar ao jogo»).
     */
    openMenus: () => { openSeatMenus(0); },
    getTouchMap: () => touchPad.getTouchMap(),
    // ✅ This root HAS the map, so the screen's START reads the action it carries.
    getStartAction: () => touchPad.getTouchMap().start,
    getStickTravelPx: () => touchPad.getStickTravelPx(),
    getStickDeadPx: () => touchPad.getStickDeadPx(),
  });
  drawPad();
  touchBindings.attach();
  /*
   * A LANGUAGE CHANGED MID-GAME REACHES WHAT THE ENGINE DREW (study item C6; ADR-0031). 📏 Measured in the quiz: after
   * `setLocale('en')` the icon bar's names, the card's name, the button legend and the PAUSED word stayed in the old
   * language — `applyDom` reaches only `[data-i18n]`, and these are written by code. An open panel redraws itself
   * (`ui/mount-panel`), keeping focus where it was; nothing here moves focus.
   * 🔴 THE BOOT IS THE SAME EVENT: the pad and the bar are drawn in the fallback language, and the preferred one arrives
   * through `setLocale` (measured in the `dist`: «Cima/Baixo» on an English page). This listener replaced the
   * `localeReady()` repaints that did it for the boot alone.
   */
  /**
   * The 👄, when it exists. Declared HERE because the language change — just below — must reach it, and it is born further
   * down: the temporal dead zone again.
   */
  let voiceControl: VoiceControl | null = null;
  /*
   * 🔴 AND THE CARTRIDGE NEEDS TO KNOW TOO (ADR-0225): changing the flag took `<html lang>`, the footer, the bar and the
   * panels to the new language and left the ACTIVITY — the quiz's statement — in the old one. The frame followed; the
   * activity did not.
   *
   * 📌 The door is the engine's and not the event's, by the rule the Dev wrote for reading and speech (ADR-0216): «o jogo
   * não deve precisar saber como isso funciona». A cartridge that had to subscribe to `i18n:change` on the WINDOW would
   * have to know the event's name, the object it is dispatched on and the order in which the engine handles it — and
   * would reach a global to do it, which ADR-0221 step 7d refuses to a new module.
   */
  const localeListeners: (() => void)[] = [];
  {
    // through the root's door, released by `dispose()`; the window's `i18n:change` stays the host's page-level signal
    localeOn(() => {
      pauseIcons.reflectPauseIcons();
      updateCaption();
      if (pausedWord && !pausedWord.hidden) pausedWord.textContent = t('pause.quick');
      drawPad();
      touchBindings.rewire();
      /*
       * 🔴 AND WHAT THE ENGINE HEARS CHANGES TOO (ADR-0225). What it DRAWS follows since study item C6; what it SAYS follows
       * by itself (`tts` reads `bcp47()` at every utterance) and what it READS too (at every `listen()`). Command
       * recognition chose its language ONCE — and listening in the old language is worse than stopping, because the
       * grammar follows the menu and the new words would feed the old model.
       */
      void voiceControl?.languageChanged();
      // ⚠️ THE CARTRIDGE LAST, on purpose: when it redraws, the bar, the caption and the pad are already in the new language,
      // so it never measures a half-translated screen. And a cartridge that throws does not take the engine's frame with it.
      for (const listener of localeListeners) { try { listener(); } catch (e) { /* the cartridge failed; the engine goes on */ } }
    });
  }

  /*
   * ===================== MOTOR ACCESSIBILITY — the engine's panel (ADR-0151 §2 item 5) =====================
   *
   * 🔴 THE OLD PANEL DOES NOT SERVE, and not by taste: `ui/settings-mobility` mounts Easy Mode and the two toggles, and
   * ADR-0151 took the three out of this panel («dificuldade é opção do jogo»; the toggles live on the ☝️). So this is a
   * NEW panel (`#motora`), and the old one still serves whoever mounts it with their own markup.
   *
   * 📌 ITS ROWS are the Dev's list: the CONTROLLER SIZE in four steps, one per persona; mapping the keyboard (for 1, 2 and
   * 3–4 players), the gamepad and the touch pad; waiting between presses; the camera; the microphone. Each is offered
   * only where it has a subject.
   *
   * ⚠️ IT EXISTS ONLY WHERE THERE IS A TOUCH HOST: without one there is no pad size to choose, and the submenu's door
   * falls away by itself (`engineActions.motora` is not defined).
   */
  /** The motor panel's mapping wizard, once mounted: declared out here because the pad's poll below stands aside while it maps. */
  let padWizard: ReturnType<typeof createPadWizard> | null = null;
  if (pauseMountPoint && pauseUsable && touchUsable) {
    const mobilityCtx = {
      find: (sel: string) => $<HTMLElement>(sel),
      create: (tag: string) => doc.createElement(tag),
      host: pauseMountPoint as HTMLElement,
      overlays,
      localeOn, // a language change redraws an open panel, and `dispose()` releases it (ADR-0232 D4)
    };
    let padSteps: HTMLElement | null = null;
    let padHint: HTMLElement | null = null;
    let padSizeRow: HTMLElement | null = null;
    /** Reflects the keyboard-mapping rows (defined further below, with the `#ctrl` panel). */
    let reflectKeyboard = (): void => {};
    let currentPersona = closestPersona(store.getNum(KEYS.padBtnMm, 12.5));
    const specDoPad = () => ({
      label: t('motora.pad'),
      values: PERSONAS_DO_PAD.map((p) => t(p.label)),
      current: currentPersona,
    });
    const mobilityPanel = mountPanel(mobilityCtx, {
      id: 'motora',
      labels: () => ({
        title: t('menu.motora'),
        listLabel: t('menu.motora'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      // Read again at every opening: the size may have changed elsewhere, and the labels follow the language of now.
      render: () => {
        currentPersona = closestPersona(store.getNum(KEYS.padBtnMm, 12.5));
        // ADR-0166 + ADR-0106 §5: the pad's size is offered only to a cartridge that has a pad — hidden, not locked, because
        // there is nothing to unlock. Read at each opening: `mount()` may have swapped the cartridge.
        if (padSizeRow) padSizeRow.hidden = !cartridge.onScreenPad;
        if (padSteps) updateSteps(padSteps, specDoPad());
        // ⚠️ THE HINT IN THE LANGUAGE OF NOW, before the footer collects it: written at boot, it came out in the fallback
        // language.
        if (padHint) padHint.textContent = t('motora.pad.dica');
        reflectKeyboard();
      },
    });
    const rowNode = doc.createElement('div');
    rowNode.className = 'ctrl-row ctrl-row--passos';
    padSizeRow = rowNode; // offered or not is decided at each opening (`render` above)
    const explanation = doc.createElement('span');
    explanation.className = 'opt-hint';
    padHint = explanation;
    const envelope = doc.createElement('span');
    envelope.appendChild(explanation);
    rowNode.appendChild(envelope);
    padSteps = mountSteps(mobilityCtx, specDoPad());
    padSteps.id = 'opt-pad-persona';
    rowNode.appendChild(padSteps);
    mobilityPanel.shell.list.appendChild(rowNode);
    padSteps.addEventListener('passo', (ev) => {
      const fresh = nextStep(currentPersona, PERSONAS_DO_PAD.length, (ev as CustomEvent<number>).detail);
      if (fresh === currentPersona) return; // at the end, a step that did not happen is not announced
      currentPersona = fresh;
      touchPad.setPadMm(PERSONAS_DO_PAD[fresh]!.mm);
      updateSteps(padSteps!, specDoPad());
      srSay(`${t('motora.pad')}: ${t(PERSONAS_DO_PAD[fresh]!.label)}`);
    });
    engineActions.motora = mobilityPanel.open;

    /*
     * ===================== MAP THE KEYBOARD — for 1, for 2 and for 3–4 players (ADR-0151 §2 item 5) =====================
     *
     * 🎯 THREE ROWS, ONE PANEL: each row opens `#ctrl` in ITS mode, and `ui/settings-controls` sees only that mode's schemes
     * (`kbFor` and `getNumPlayers` answer for the mode, not for the match). A child alone can thus prepare the keyboard
     * for when her brother sits beside her, without having to enter a two-player match.
     *
     * ⚠️ «3–4» IS ONE KEYBOARD, as the Dev named it: the four-player scheme is edited, and the first three seats of the
     * three-player mode follow (`kb.p3` is stored apart since the `p34` migration). Without this, the child remapped for
     * «3–4» and, in a three-player match, the old keys came back.
     *
     * ⚠️ AND THE «3–4» ROW EXISTS ONLY WITHOUT SHOULDERS OR TRIGGERS in the preset: four schemes on one keyboard have no
     * keys left for the four side positions (ADR-0151 erratum). The Dev's reason: in chess, four children against four
     * different computers — «o modo competitivo deve ser desencorajado».
     */
    type KeyboardMode = 1 | 2 | 4;
    let keyboardMode: KeyboardMode = 1;
    let seatInMap = 0;
    const modeScheme = (conf: KBDefaults, i: number) => (keyboardMode === 1 ? conf.solo
      : keyboardMode === 2 ? (conf.p2[i] ?? conf.p2[0]!) : (conf.p4[i] ?? conf.p4[0]!));
    const modeLabel = (m: KeyboardMode): string => t(m === 1 ? 'motora.teclado.1' : m === 2 ? 'motora.teclado.2' : 'motora.teclado.34');
    const SIDES = ['leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger'] as const;
    const actionsToMap = () => {
      const words = actionWords();
      const nameOf = labellerFrom(words);
      return presetActions(words).flatMap((presetAction) => {
        const actionWord = nameOf(presetAction);
        return actionWord ? [{ action: presetAction, label: actionWord }] : [];
      });
    };
    let seatSteps: HTMLElement | null = null;
    const seatSpec = () => ({
      label: t('ctrl.assento'),
      values: Array.from({ length: keyboardMode }, (_, i) => t('ctrl.jogador', { n: i + 1 })),
      current: seatInMap,
    });
    const keyboardPanel = mountPanel(mobilityCtx, {
      id: 'ctrl',
      labels: () => ({
        title: modeLabel(keyboardMode),
        listLabel: modeLabel(keyboardMode),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        if (seatSteps) {
          seatInMap = Math.min(seatInMap, keyboardMode - 1);
          updateSteps(seatSteps, seatSpec());
          (seatSteps.closest('.ctrl-row') as HTMLElement).hidden = keyboardMode === 1;
        }
        keyboardControls?.render(seatInMap);
      },
    });
    {
      // THE SEAT, by steps — only in the modes of more than one: «◀ Teclado de: Jogador 2 ▶».
      const seatRow = doc.createElement('div');
      seatRow.className = 'ctrl-row ctrl-row--passos';
      seatSteps = mountSteps(mobilityCtx, seatSpec());
      seatSteps.id = 'ctrl-assento';
      seatRow.appendChild(seatSteps);
      keyboardPanel.shell.card.insertBefore(seatRow, keyboardPanel.shell.list);
      seatSteps.addEventListener('passo', (ev) => {
        const nextValue = nextStep(seatInMap, keyboardMode, (ev as CustomEvent<number>).detail);
        if (nextValue === seatInMap) return;
        seatInMap = nextValue;
        updateSteps(seatSteps!, seatSpec());
        keyboardControls?.render(seatInMap);
        srSay(`${t('ctrl.assento')}: ${t('ctrl.jogador', { n: nextValue + 1 })}`);
      });
    }
    /** The four-player mode carries the first three seats of the three-player mode — see the header above. */
    const syncThree = (conf: KBDefaults): void => {
      conf.p3.forEach((left, i) => {
        const de = conf.p4[i];
        if (de) for (const a of ACTIONS) left[a] = de[a] ? [...de[a]!] : de[a];
      });
    };
    keyboardControls = initSettingsControls({
      t: translator.t, $, srSay, srAlert,
      gameActions: actionsToMap,
      store: {
        saveKB: (conf) => { if (keyboardMode === 4) syncThree(conf); keyboardConfig.save(conf); },
        // ⚠️ «RESTORE» FOR THIS MODE, not for the whole keyboard: whoever resets the two-player keyboard does not erase the one-player one.
        resetKB: () => {
          const factory = keyboardConfig.factoryWithGame();
          const kb = keyboardConfig.kb();
          if (keyboardMode === 1) kb.solo = factory.solo;
          else if (keyboardMode === 2) kb.p2 = factory.p2;
          else { kb.p4 = factory.p4; kb.p3 = factory.p3; }
          keyboardConfig.save(kb);
          return kb;
        },
      },
      kb: keyboardConfig.kb(),
      setKB: keyboardConfig.set,
      kbFor: (i) => modeScheme(keyboardConfig.kb(), i),
      defaultSchemeFor: (i) => modeScheme(keyboardConfig.factoryWithGame(), i),
      getNumPlayers: () => keyboardMode,
      applyControls: () => { keyboard.refreshControls(); },
      assignControls: () => { keyboard.assignControls(); },
      fillExplain: overlays.fillExplain,
    });
    // THE CAPTURE GETS THE KEY BEFORE EVERYTHING ELSE: while capturing, the menu navigation already steps aside, and this
    // keeps the recorded key from rising on to START, SELECT or the game.
    win.addEventListener('keydown', (e: KeyboardEvent) => {
      if (keyboardControls?.isCapturing() && keyboardControls.handleCaptureKeydown(e)) e.stopPropagation();
    }, true);

    // THE THREE ROWS in the motor panel, each a DOOR to `#ctrl` in its mode.
    const keyboardRows: { mode: KeyboardMode; row: HTMLElement; strong: HTMLElement; button: HTMLElement }[] = [];
    for (const rowMode of [1, 2, 4] as const) {
      const rowT = doc.createElement('div');
      rowT.className = 'ctrl-row';
      const envelope = doc.createElement('span');
      const strongLabel = doc.createElement('strong');
      envelope.appendChild(strongLabel);
      rowT.appendChild(envelope);
      const rowButton = doc.createElement('button');
      rowButton.className = 'mode-btn';
      rowButton.setAttribute('type', 'button');
      rowButton.id = `opt-teclado-${rowMode}`;
      rowButton.addEventListener('click', () => {
        keyboardMode = rowMode;
        seatInMap = 0;
        keyboardPanel.open();
      });
      rowT.appendChild(rowButton);
      mobilityPanel.shell.list.appendChild(rowT);
      keyboardRows.push({ mode: rowMode, row: rowT, strong: strongLabel, button: rowButton });
    }
    /** Labels in the language of now, and who appears: with no named positions there is nothing to map; «3–4» without sides. */
    const reflectKeyboardRows = (): void => {
      const declaredActions = cartridge.preset ? presetActions(cartridge.preset) : [];
      const hasSides = declaredActions.some((a) => (SIDES as readonly string[]).includes(a));
      for (const { mode: rowMode, row: l, strong: strongLabel, button: rowButton } of keyboardRows) {
        strongLabel.textContent = modeLabel(rowMode);
        rowButton.textContent = t('motora.abrir');
        rowButton.setAttribute('aria-label', modeLabel(rowMode));
        l.hidden = actionsToMap().length === 0 || (rowMode === 4 && hasSides);
      }
    };
    reflectKeyboardRows();

    /*
     * MAPEAR CONTROLE (ADR-0151 §2; issue #182): the engine's own wizard (`input/pad-wizard`), asking the positions this
     * game names, in its words, then START and SELECT in the engine's (ADR-0144 erratum of 2026-09-26 — this labeller is the
     * preset's, which may not name them), and storing the map `initGamepad` reads — one cache for the page. It reads the pads
     * only while it is open. «Voltar» cancels; SELECT, the last step, saves and closes. The shell's «restore» is hidden: a
     * pad's map is replaced by mapping again.
     * 🔴 ONE WIZARD OWNS THE PAD: the gamepad transport builds its own wizard too (the one that opens by itself on a DirectInput
     * pad with no map), and each asks only about itself. So the root, which holds both, keeps them apart: while this one maps,
     * the pad's poll does not run (below), and while that one maps, this row does not open a second.
     */
    /**
     * One closer for «Voltar» and Escape: a running wizard is cancelled (and its close hides the panel); an idle one just hides.
     * 🔴 WHICHEVER WIZARD IS MAPPING: the transport's own shows in this same overlay, and hiding it alone left that wizard
     * mapping unseen — the game paused, the pad answering questions nobody showed, and its map stored at the end.
     */
    const closeControl = (): void => {
      if (padWizard?.state()) { padWizard.close(false); return; }
      if (gamepad.getPadWiz()) gamepad.closePadWiz(false); // its close hides the overlay and resumes the game it paused
      controlPanel.shell.overlay.hidden = true;
      overlays.restoreFocus?.('padwiz');
    };
    const controlPanel = mountPanel(mobilityCtx, {
      id: 'padwiz',
      labels: () => ({
        title: t('motora.controle'),
        listLabel: t('motora.controle'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {},
      closeOwn: () => closeControl(),
    });
    controlPanel.shell.reset.hidden = true;
    controlPanel.shell.close.addEventListener('click', closeControl); // `closeOwn` means this panel wires its own button
    const controlSentence = doc.createElement('p');
    controlSentence.id = 'padwiz-prompt';
    controlSentence.setAttribute('aria-live', 'assertive');
    const controlProgress = doc.createElement('p');
    controlProgress.id = 'padwiz-progress';
    controlProgress.className = 'opt-hint';
    controlPanel.shell.card.insertBefore(controlSentence, controlPanel.shell.list);
    controlPanel.shell.card.insertBefore(controlProgress, controlPanel.shell.list);
    padWizard = createPadWizard({
      maps: padMaps, t: translator.t,
      getGamepads: () => {
        const nav = win.navigator as Navigator | undefined;
        return typeof nav?.getGamepads === 'function' ? nav.getGamepads() : null;
      },
      actionLabel: (presetAction) => actionsToMap().find((x) => x.action === presetAction)?.label ?? null,
      say: (phrase) => { controlSentence.textContent = phrase; srSay(phrase); },
      progress: (text) => { controlProgress.textContent = text; },
      srAlert,
      onClose: () => {
        controlPanel.shell.overlay.hidden = true;
        overlays.restoreFocus?.('padwiz');
      },
    });
    const controlMappingRow = doc.createElement('div');
    controlMappingRow.className = 'ctrl-row';
    const controlMappingLabel = doc.createElement('span');
    const controlStrong = doc.createElement('strong');
    controlMappingLabel.appendChild(controlStrong);
    controlMappingRow.appendChild(controlMappingLabel);
    const controlButton = doc.createElement('button');
    controlButton.className = 'mode-btn';
    controlButton.setAttribute('type', 'button');
    controlButton.id = 'opt-controle';
    controlButton.addEventListener('click', () => {
      if (gamepad.getPadWiz()) return; // the transport's own wizard is mapping a pad: it keeps it
      controlPanel.open();
      padWizard?.open();
    });
    controlMappingRow.appendChild(controlButton);
    mobilityPanel.shell.list.appendChild(controlMappingRow);
    const reflectControlRow = (): void => {
      controlStrong.textContent = t('motora.controle');
      controlButton.textContent = t('motora.abrir');
      controlButton.setAttribute('aria-label', t('motora.controle'));
      // ⚠️ SHOWN FOR EVERY GAME: one that names no position gets the wizard's fourteen default positions (ADR-0144, erratum of
      // 2026-09-26), so there is always something to map.
    };
    reflectControlRow();

    /*
     * MAPEAR TOQUE (ADR-0151 §2; issue #182): which function each on-screen pad button carries, with `input/touch`'s own
     * editor (`renderTouchMap`, slot → one of the functions the game names). Offered only to a cartridge with a pad (ADR-0166),
     * and only for the buttons the pad DRAWS — a slot whose function the game does not name is not drawn (ADR-0162), so its
     * row would change nothing on screen. The pad is redrawn with every choice.
     */
    const touchPanel = mountPanel(mobilityCtx, {
      id: 'touchcfg',
      listId: 'touchmap-list',
      labels: () => ({
        title: t('motora.toque'),
        listLabel: t('motora.toque'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => { touchPad.renderTouchMap(); hideSlotsWithoutAction(); },
    });
    touchPanel.shell.reset.hidden = true;
    const hideSlotsWithoutAction = (): void => {
      const named = cartridgeActions();
      const padMap = touchPad.getTouchMap();
      for (const sel of Array.from(touchPanel.shell.list.querySelectorAll<HTMLElement>('[data-slot]'))) {
        const rowNode = sel.closest<HTMLElement>('.ctrl-row');
        if (rowNode) rowNode.hidden = !named.has(padMap[sel.dataset.slot ?? ''] ?? '');
      }
    };
    // after the select's own listener (it writes the map), the pad is drawn again with the new function
    touchPanel.shell.list.addEventListener('change', () => { drawPad(); hideSlotsWithoutAction(); });
    const touchMappingRow = doc.createElement('div');
    touchMappingRow.className = 'ctrl-row';
    const touchEnvelope = doc.createElement('span');
    const touchStrong = doc.createElement('strong');
    touchEnvelope.appendChild(touchStrong);
    touchMappingRow.appendChild(touchEnvelope);
    const touchButton = doc.createElement('button');
    touchButton.className = 'mode-btn';
    touchButton.setAttribute('type', 'button');
    touchButton.id = 'opt-toque';
    touchButton.addEventListener('click', () => touchPanel.open());
    touchMappingRow.appendChild(touchButton);
    mobilityPanel.shell.list.appendChild(touchMappingRow);
    const reflectTouchRow = (): void => {
      touchStrong.textContent = t('motora.toque');
      touchButton.textContent = t('motora.abrir');
      touchButton.setAttribute('aria-label', t('motora.toque'));
      touchMappingRow.hidden = !cartridge.onScreenPad || actionsToMap().length === 0; // no pad, or nothing named
    };
    reflectTouchRow();

    /*
     * 🔴 NO STICKY-KEYS ROW IN THIS PANEL (the Dev: «Tire a linha de acessibilidade motora»): the bar's ☝️ is the one
     * surface for that cycle (ADR-0218), and two surfaces of one setting was what the row had become.
     *
     * ⚠️ The row was also the only place that said WHY the latch is locked on a device that sends one command at a time
     * (ADR-0113 clause 3). It stays honest because the cycle does not OFFER what is locked: where the latch is required,
     * «padrão» does not appear, and there is nothing to explain. The «Esperar entre toques» row (ADR-0217) stays: it is
     * another setting.
     */
    /*
     * «ESPERAR ENTRE TOQUES» (ADR-0217; GAG Advanced/Motor, issue #182). The row beside the sticky keys, and the other half of
     * the same problem: that one is for a hand that cannot HOLD, this one for a hand that cannot press ONCE.
     *
     * ⚠️ OFF BY DEFAULT and offered as a choice, because for a child with no tremor it is half a second lost between every two
     * presses — in a game of reaction, the game. Hidden where the game holds no key, like its neighbour: what it refuses is a
     * second press, and a game nobody presses twice has none to refuse.
     */
    const cooldownRowSpec = () => ({ id: 'opt-cooldown', label: t('motor.espera'), hint: t('motor.espera.dica') });
    const { row: cooldownRow, control: cooldownButton } = controlRow(mobilityCtx, cooldownRowSpec());
    mobilityPanel.shell.list.appendChild(cooldownRow);
    const reflectCooldown = (): void => {
      labelRow(cooldownRow, cooldownRowSpec());
      const on = state.inputCooldown > 0;
      toggleBtn(cooldownButton, on);
      cooldownButton.textContent = toggleLabel(t, on);
      markChanged(t, cooldownRow, on !== (DEFAULTS.inputCooldown > 0));
      cooldownRow.hidden = !cartridge.declaration.holdsKeys();
    };
    cooldownButton.addEventListener('click', () => {
      state.setInputCooldownValue(state.inputCooldown > 0 ? 0 : COOLDOWN_MS);
      reflectCooldown();
      srSay(`${t('motor.espera')}: ${t(state.inputCooldown > 0 ? 'state.on' : 'state.off')}`);
    });
    reflectCooldown();

    /*
     * PLAYING WITH THE CAMERA, IN THE PANEL (issue #182; ADR-0215): «webcam (gestos/rosto/olhos)» was one of the motor rows the
     * Dev listed as missing, and until the 📷 existed there was nothing to put in it. Now there is, and this row is the same
     * setting the bar's 📷 cycles — one stored value (`incl_camera_control`), two surfaces, the panel's being the one that says
     * what each position does.
     *
     * ⚠️ HIDDEN WHERE THERE IS NO CAMERA TO ASK FOR, the same rule the icon uses: a row that offers a device the browser does
     * not have is the dead button of ADR-0106 §5, and a child who picks it waits for a permission dialog that never comes.
     *
     * 📌 AND THE MICROPHONE ROW IS RIGHT BELOW, since 2026-09-21: it used to be missing on purpose, because with no voice-command
     * transport a «microfone» row would switch nothing. The transport landed (issue #184), so the row has a subject.
     */
    const CAMERA_MODE_WORD: { readonly [M in CameraControl]: string } = {
      off: 'state.off', hands: 'camera.hands', face: 'camera.face', eyes: 'camera.eyes',
    };
    const cameraRowSpec = () => ({
      label: t('motora.camera'),
      values: CAMERA_CONTROLS.map((m) => t(CAMERA_MODE_WORD[m])),
      current: Math.max(0, CAMERA_CONTROLS.indexOf(state.cameraControl)),
    });
    const cameraRow = doc.createElement('div');
    cameraRow.className = 'ctrl-row ctrl-row--passos';
    const cameraHint = doc.createElement('span');
    cameraHint.className = 'opt-hint';
    const cameraWrap = doc.createElement('span');
    cameraWrap.appendChild(cameraHint);
    cameraRow.appendChild(cameraWrap);
    const cameraSteps = mountSteps(mobilityCtx, cameraRowSpec());
    cameraSteps.id = 'opt-camera';
    cameraRow.appendChild(cameraSteps);
    mobilityPanel.shell.list.appendChild(cameraRow);
    const reflectCamera = (): void => {
      updateSteps(cameraSteps, cameraRowSpec());
      cameraHint.textContent = t('motora.camera.dica');
      cameraRow.hidden = !canCaptureMedia;
    };
    cameraSteps.addEventListener('passo', (ev) => {
      const next = nextStep(
        Math.max(0, CAMERA_CONTROLS.indexOf(state.cameraControl)), CAMERA_CONTROLS.length, (ev as CustomEvent<number>).detail,
      );
      const mode = CAMERA_CONTROLS[next]!;
      if (mode === state.cameraControl) return; // at the end of the line nothing moved, and nothing is announced
      state.setCameraControlValue(mode);
      reflectCamera();
      // 🔴 A MODE THAT STARTS IS ANNOUNCED BY ITS CONTROL, which answers once it has really started or says why it could not —
      // the rule and its reason are at the 📷 in `ui/pause-icons`. Off is true at once, and is said here.
      if (mode === 'off') srSay(`${t('motora.camera')}: ${t('state.off')}`);
    });
    // the 📷 and this row are one setting: whoever changes it, both show it
    stateOn('cameraControl', () => { reflectCamera(); });
    reflectCamera();

    /*
     * PLAYING BY SPEAKING, IN THE PANEL (issue #182's «microfone» row; ADR-0189): the same stored answer the bar's 👄 writes
     * (`incl_voice_control`), on the surface that has room to say what it does. Two surfaces of one setting, and neither may
     * name it differently — which is the correction ADR-0218 had just made to the ☝️.
     *
     * ⚠️ HIDDEN WHERE THERE IS NO MICROPHONE TO ASK FOR, the rule the 📷 above follows and the one ADR-0106 §5 states: a row
     * that offers a device this browser cannot even ask for is a dead control, and a child who picks it waits for a permission
     * dialog that never comes. What happens when the microphone EXISTS and is refused is another matter and is already
     * answered: `ui/voice-control` says why and puts the answer back to off, and this row follows it like the icon does.
     */
    const voiceRowSpec = () => ({ id: 'opt-voice', label: t('motora.voz'), hint: t('motora.voz.dica') });
    const { row: voiceRow, control: voiceButton } = controlRow(mobilityCtx, voiceRowSpec());
    mobilityPanel.shell.list.appendChild(voiceRow);
    const reflectVoice = (): void => {
      labelRow(voiceRow, voiceRowSpec());
      toggleBtn(voiceButton, state.voiceControl);
      voiceButton.textContent = toggleLabel(t, state.voiceControl);
      markChanged(t, voiceRow, state.voiceControl !== DEFAULTS.voiceControl);
      voiceRow.hidden = !canCaptureMedia;
    };
    voiceButton.addEventListener('click', () => {
      state.setVoiceControlValue(!state.voiceControl);
      reflectVoice();
      // 🔴 ON IS ANNOUNCED BY `ui/voice-control`, which starts AFTER this click, asynchronously, and answers either way: ready,
      // or the reason it could not start. Reading the state here still read «on», because the failure had not happened yet —
      // the rule and its reason are at the 👄 in `ui/pause-icons`. Off is true at once, and is said here.
      if (!state.voiceControl) srSay(`${t('motora.voz')}: ${t('state.off')}`);
    });
    stateOn('voiceControl', () => { reflectVoice(); });
    reflectVoice();

    reflectKeyboard = () => {
      reflectKeyboardRows(); reflectControlRow(); reflectTouchRow(); reflectCooldown();
      reflectCamera(); reflectVoice();
    };
  }
  /*
   * THE MOTOR EMPATHY SIMULATIONS REACH THE GAME HERE (ADR-0181): in the window's capture, after the menu navigation registered
   * its own, and before any cartridge hears a game key. A refused key and its release stop here; a tapped key passes and is
   * released at once by a synthetic keyup, which this filter lets through.
   */
  const empathyFilter = createEmpathyFilter();
  /*
   * AND THE COOL-DOWN, WHICH IS THE OPPOSITE OF THEM (ADR-0217): the simulations above make play harder so an adult can feel
   * what a motor disability costs; this refuses the SECOND press of a hand that shakes, which is a child losing a turn she did
   * not play. It sits in the same pass because the question is the same one — does this key reach the game — and it comes
   * FIRST: a press the cool-down refuses never happened, so it must not teach the simulations that a key is held.
   */
  const cooldown = createInputCooldown();
  stateOn('inputCooldown', () => { cooldown.reset(); }); // turning it off must not leave a press refused by an old wait
  const releasedByFilter = new WeakSet<Event>();
  const block = (e: Event): void => { e.preventDefault(); e.stopImmediatePropagation(); };
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (keyboard.whichPlayer(e.code) < 0) return;
    if (cooldown.keydown(e.code, win.performance.now(), state.inputCooldown, e.repeat || keys.has(e.code)) === 'refuse') {
      block(e);
      return;
    }
    const decision = empathyFilter.keydown(e.code, e.repeat, { noChords: state.oneButton, noGripStrength: state.noGripStrength });
    if (decision === 'barrar') { block(e); return; }
    if (decision === 'tocar') {
      const eventTarget = e.target ?? win;
      setTimeout(() => {
        // a release the keyboard's own press produced
        const released = stampSource(new KeyboardEvent('keyup', { code: e.code, key: e.key, bubbles: true, cancelable: true }), 'teclado');
        releasedByFilter.add(released);
        eventTarget.dispatchEvent(released);
      }, 0);
    }
  }, true);
  win.addEventListener('keyup', (e: KeyboardEvent) => {
    if (releasedByFilter.has(e) || keyboard.whichPlayer(e.code) < 0) return;
    if (empathyFilter.keyup(e.code) === 'barrar') block(e);
  }, true);

  // Playing on the keyboard HIDES the pad — the same per-modality switch `input/keydown` makes. Only some player's keys:
  // a browser shortcut is not the child changing device.
  // 🔴 IN CAPTURE (`true`): `ui/menu-nav` consumes a menu's key in the window's capture with `stopPropagation()`, and a
  // bubbling listener never heard it — in a menu, the child moved to the keyboard and the pad stayed over the card (seen
  // by the Dev). `stopPropagation` does not silence another listener on the SAME node, so registration order does not matter.
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (sourceOfEvent(e) === 'toque') return; // the key the pad itself handed to a menu
    if (keyboard.whichPlayer(e.code) >= 0) { touchPad.hideTouchControls(); padBeforeMenu = false; } // on the keyboard now
  }, true);

  /*
   * 🔴 THE BROWSER THE HEAVY FILES AND THE RECOGNISERS USE IS LENT HERE, ONCE (ADR-0232 D4, issue #207): the checked cache, the
   * hash and `fetch` are read from the HOST's window, and the modules below receive them instead of reaching the globals.
   * 📌 `caches` and `crypto.subtle` are ABSENT outside a secure context, and absent is an answer each module already gives: the
   * download reports every file, a loader names the files it cannot find, and nothing is kept unverified.
   */
  const heavyCaches = (win as { caches?: CacheStorage }).caches;
  const hasHeavyFile = checkedCacheHas(heavyCaches);
  // 📌 The microphone and the audio context the recognisers open, from the same window: `undefined` is a device without one.
  const mediaDevices = win.navigator?.mediaDevices;
  const getUserMedia = mediaDevices?.getUserMedia?.bind(mediaDevices);
  const HostAudioContext = (win as unknown as { AudioContext?: typeof AudioContext }).AudioContext;

  /*
   * THE HEAVY FILES START COMING DOWN HERE, and the line is deliberately the LAST thing of the boot.
   *
   * ⚠️ NO `await`. The start does not wait for the heavy files — if it did, a 3G school's first screen would stay blank for minutes
   * and the child would conclude the game does not open. The empty `catch` is the same rule written twice: a network failure here
   * cannot bring down a game that may not even use the voice.
   *
   * 🔴 AND THE REPORT DOES NOT GO TO `problems`, for two reasons, and the first is the one that matters:
   *
   *  1. **IT ARRIVES AFTER THE READER HAS GONE.** `problems` is returned synchronously; the download runs in the background,
   *     so EVERY line of it would land in an array the consumer has already read. Whoever does `if (motor.problems.length) …`
   *     would see nothing, and whoever read it later would see a list that grew after boot.
   *  2. **IT WOULD DROWN WHAT CAN BE FIXED.** Without a network — a school without one is the target, not the exception —
   *     every file is a failure pushed into a list ADR-0106 §2 built to say what the HOST LACKS. The child loses the
   *     accessibility bar and the line that says so sits under all of them.
   *
   * 📌 The right channel is the one the function already has: `onHeavyProgress`, handed to whoever calls. A consumer who
   * wants to show «N MB left» or «the voice did not come down» has a way; the engine invents no surface.
   */
  if (o.downloadHeavy !== false) {
    // ⚠️ THE READING MODELS OF EVERY LANGUAGE THE PAGE CAN SWITCH TO, when the game listens (ADR-0225 erratum, the Dev:
    // «Negativo, baixar os três. Toda criança vai experimentar as três línguas imediatamente.»). `bcp47()` is the language the
    // interface booted in (ADR-0031), named first so everything of hers comes down before the 850 MiB of the three does.
    void downloadHeavy({
      // 📌 AND THE COMMAND MODELS ARE ASKED FOR WITHOUT ASKING THE GAME (issue #184): a child who says «menu» instead of pressing
      // it is reaching the controller, and no cartridge declares — or denies — a way in (ADR-0111). ONE PER LANGUAGE THE PAGE
      // CAN SWITCH TO, the child's first (ADR-0225 erratum): a language changed mid-game, offline the next day, must find its
      // model kept. A language the delivery's `--commands` left out fails quietly here, and the transport says so when she speaks.
      // 📌 The Libras player only while deaf mode is on (ADR-0234): the delivery's list of its avatar, clips, glosses and three.js,
      // which a child who never asks for signing does not pay — and which keep it signing on the days without a network.
      only: heavyAtBoot({
        kokoro: !!o.uses?.neuralVoice, reading: o.uses?.reading ? [bcp47(), ...availableLocales()] : null,
        commands: [bcp47(), ...availableLocales()], libras: deafMode.isOn(),
      }),
      onProgress: o.onHeavyProgress,
      cacheStorage: heavyCaches, fetch: win.fetch, digest: sha256With(win.crypto?.subtle), base: doc.baseURI,
    })
      .catch(() => { /* a background download brings down no boot */ });
  }

  /*
   * ⚠️ `declaration`, `declines`, `problems` AND `reach` ARE GETTERS; the rest are not, and the asymmetry is the decision.
   *
   * The first two belong to the GAME's half (ADR-0139 §1), and the last two are derived from it, so all four must follow
   * the mounted cartridge — a plain field here would return, after a `mount()`, what the cartridge that booted first had.
   * `pause`, `tts`, `overlays`, `nav`, `keyboard` and the sonar belong to the PAGE and exist once, which is the whole
   * decision of ADR-0117 §2.
   */
  /*
   * THE SCENE STACK BELONGS TO THE ROOT, and not to the return value, because `unmount()` must reach it. Born once
   * (ADR-0117 §2: the page has one) and emptied between cartridges, never replaced.
   */
  const rootScenes = createSceneStack();

  // The hooks carry the REQUIRED answer to the accommodations (ADR-0153). The public type lets them be omitted, so an
  // absent value becomes `{}` — the cartridge that did not answer — and is refused below with ADR-0153's sentence, never
  // with a TypeError on `hooks.preset`.
  function mountAll(declaration: GameDeclaration, hooks: CartridgeHooks = {} as CartridgeHooks): void {
    // ⚠️ IT THROWS, IT DOES NOT DIAGNOSE — the boot's rule, and so the boot's sentence. A malformed declaration is a
    // precondition: `problems` is for gaps one can still play with, and this is not one.
    const malformed = conformanceProblems(declaration);
    if (malformed.length) {
      refuseDeclaration('mount', malformed);
    }
    // ⚠️ AND `mount()` REFUSES BY THE SAME RULES, before writing to `cartridge`. `CartridgeHooks` is
    // `Omit<GameHalf, 'declaration'>`, so it carries `preset` — a second cartridge could take the «start» the first one
    // respected, and the root would be left with the pause unreachable mid-session.
    refuseIfItClaimsStart('mount', hooks.preset);
    refuseIfNoAnswer('mount', hooks.accommodations);
    refuseIfGenreRefused('mount', hooks.genre);
    refuseIfHudMalformed('mount', hooks.hud);
    refuseIfOptionsMalformed('mount', hooks.gameOptions);
    refuseIfHowToPlayMalformed('mount', hooks.howToPlay);
    cartridge = { ...hooks, declaration };
    explainForGame(null); // the explanation was the replaced cartridge's (ADR-0244)
    // its words, before anything draws them: ADDED to the root's dictionary, so the keys a shell registered at boot stay
    for (const [code, entries] of Object.entries(hooks.dictionaries ?? {})) translator.registerDict(code, entries);
    mountHud(); // the numbers are the cartridge's: the new one's replace the old one's, and the room is measured again
    followCartridgeMappings(declaration);
    redrawGameOptions(); // the rows are the new cartridge's, drawn or cleared before its door is weighed
    pauseIcons.reflectPauseIcons(); // the bar follows the new cartridge: the hourglass exists only where time runs by itself
    currentReach = deriveReach();
    // The pad has the SHAPE of the preset, so it changes with the cartridge; the window listeners stay (`rewire`, not `attach`).
    drawPad();
    touchBindings.rewire();
  }

  /**
   * THE PAGE LINKS THE ENGINE STYLESHEET, or it is told (study item B4). `createGame` injects no CSS; without
   * `style.css` the panels, the footer band, the target floor and the focus rings are all missing, and nothing said so.
   * Read when `problems` is read, by the sentinel only that stylesheet declares — a stylesheet loading late is not
   * accused; a host without `getComputedStyle` measures nothing and accuses nothing.
   */
  function stylesheetMissing(): string[] {
    if (typeof win.getComputedStyle !== 'function' || !doc.documentElement) return [];
    const rootStyles = win.getComputedStyle(doc.documentElement);
    if (!rootStyles || typeof rootStyles.getPropertyValue !== 'function') return [];
    return rootStyles.getPropertyValue('--incl-engine-stylesheet').trim() ? [] : [`the page does not link the engine stylesheet \
(package export \`the-inclusionist-engine/style.css\`): panels, the footer band, the target floor and the focus rings are \
unstyled, so a child who plays by keyboard cannot see where focus is — link that stylesheet`];
  }

  /*
   * THE FLASH SAMPLER (study item B2, cut 2). Each animation frame the world's canvas is drawn into 160×120, the relative
   * luminance is computed per pixel (WCAG's sRGB formula) and averaged into the 16×12 grid of `core/flash-threshold` — per
   * pixel and then averaged, so a small bright area weighs by its area; a direct 16×12 downscale samples a few pixels and a
   * flash between them goes unseen. Registered from the frame after the call, gone when the time is up.
   */
  /*
   * STORAGE OUTSIDE THE ENGINE'S SCOPES (study item E2). The keys of both storages are photographed at boot; `problems`
   * names the ones that appeared since and sit outside every scope. Only what appeared: on a shared origin (localhost)
   * the keys already there are other pages'. By capability: a host without storage, or one that throws, measures nothing.
   */
  function storageKeys(): Set<string> {
    const keysFound = new Set<string>();
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try {
        const area = (win as unknown as Record<string, Storage | undefined>)[name];
        if (!area || typeof area.key !== 'function') continue;
        for (let i = 0; i < area.length; i++) { const k = area.key(i); if (k !== null) keysFound.add(k); }
      } catch { /* private mode or a host double: nothing to read */ }
    }
    return keysFound;
  }
  const keysAtBoot = storageKeys();
  function storageOutsideScope(): string[] {
    const keysSinceBoot = [...storageKeys()].filter((k) => !keysAtBoot.has(k));
    const outsideScopes = keysOutsideScopes(keysSinceBoot);
    if (!outsideScopes.length) return [];
    return [`the cartridge stored keys outside the engine's scopes (${outsideScopes.slice(0, 5).join(', ')}): a child's settings `
      + 'kept there do not follow them to the next game, and a game\'s own collide with other games\' — what belongs to '
      + 'the child goes under incl_* through the engine\'s settings, what belongs to the game under incl.<game>.* (storage-keys.gameKey)'];
  }

  const measuredProblems: string[] = [];
  /*
   * THE CHILD READS ALOUD, AND THE GAME RECEIVES TEXT (ADR-0216, issue #200). The engine owns the microphone, the route and
   * the promise of privacy; the cartridge calls `listen()`. ⚠️ Recognition on the device or nothing: `platform/reading` only
   * uses the browser's recogniser where it says it recognises locally, and refuses otherwise instead of quietly sending a
   * child's voice to a server.
   */
  /*
   * 📌 THE READING THREAD GOES WITH THE CARTRIDGE (issue #185), and the closer lives OUT HERE rather than on the `Reading`
   * object: a root that mounts another game keeps the same reading object, and a worker holding a compiled model of up to
   * 378 MiB for a cartridge that never listens is a school machine's memory spent on nothing. It is opened again at the next
   * `listen()`, which is also the moment the child is willing to wait. ⚠️ Out here because `Reading` is the CARTRIDGE's
   * vocabulary (ADR-0216): a method only this file calls has no business in a contract seven repositories read.
   */
  let closeReadingThread = (): void => {};
  const reading: Reading = (() => {
    const browserApis = win as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown; Worker?: typeof Worker };
    let microphone: { record(o: ListenOptions): Promise<Float32Array>; stop(): void } | null = null;
    /**
     * The reading thread, ONE PER LANGUAGE and kept between readings — opening it compiles the model again, up to 378 MiB — and let
     * go with the game (`platform/reading-in-worker.keepOneThreadPerLanguage`, built at the first reading with the module).
     */
    let readingThreads: ReadingThreads<ReadingInWorker> | null = null;
    /** And where there is no `Worker`, the runtime on this thread, kept by the same rule: one per language, forgotten on failure. */
    type KeptRuntime = { readonly runtime: Promise<{ transcribe(samples: Float32Array): Promise<string> }>; close(): void };
    let readingRuntimes: ReadingThreads<KeptRuntime> | null = null;
    closeReadingThread = () => { readingThreads?.close(); readingRuntimes?.close(); };
    const listener = createReading({
      language: () => bcp47(),
      api: (browserApis.SpeechRecognition ?? browserApis.webkitSpeechRecognition ?? null) as never,
      now: () => win.performance.now(),
      every: (fn, ms) => win.setInterval(fn, ms),
      stopEvery: (h) => win.clearInterval(h as number),
      report: (rowNode) => { if (!measuredProblems.includes(rowNode)) measuredProblems.push(rowNode); },
      /**
       * THE ENGINE'S OWN RECOGNISER, and it arrives late on purpose (ADR-0216 §5): `platform/reading-runtime` is what names the
       * model files, so a game that never listens — and a child of a game that does, until the first `listen()` — loads none of
       * it. Only reached where the device's own recogniser cannot serve the language (ADR-0200 erratum).
       */
      /*
       * 🔴 AND IT RUNS IN A THREAD OF ITS OWN (issue #185). 📏 Measured in the lab: transcribing on the main thread cut the
       * recording in gaps of 4 s — the child goes on reading and the words she says while the page is busy are not in the
       * sound at all. In a worker the biggest gap was 264 ms.
       * ⚠️ WHERE THERE IS NO `Worker` the reading still works, on this thread, and the LINE SAYS SO: an engine that quietly
       * fell back would put the defect back exactly where nobody looks for it.
       */
      model: o.uses?.reading
        ? async (language) => {
          /*
           * ⚠️ A LOCAL NAMED `Worker`, HOLDING THE HOST'S, AND THE LITERAL BELOW IN EXACTLY THIS FORM (ADR-0232 D4). A bundler
           * emits the worker's file and rewrites its address only for `new Worker(new URL('…', import.meta.url), { … })`
           * written out — which is what makes the thread travel with whoever installs the package; a plain string would
           * resolve against the PAGE and 404 in every game whose folders differ. The bundler reads the NAME; the VALUE is the
           * window this root was lent, so the thread is opened by the host and no global is reached.
           */
          const Worker = browserApis.Worker;
          if (typeof Worker === 'function') {
            const { createReadingInWorker, keepOneThreadPerLanguage } = await import('../platform/reading-in-worker.js');
            // 🔴 THE SAME LANGUAGE REUSES ITS THREAD: this port is asked at EVERY `listen()`, and it used to close and reopen the
            // thread each time — recompiling up to 378 MiB per reading. Another language closes the old one and opens hers.
            readingThreads ??= keepOneThreadPerLanguage<ReadingInWorker>();
            return readingThreads.forLanguage(language, (failed) => createReadingInWorker({
              base: doc.baseURI,
              language,
              spawn: () => new Worker(new URL('../platform/reading-worker.js', import.meta.url), { type: 'module' }) as never,
              // 📌 THE SENTENCE IS WRITTEN HERE and the module hands over only the REASON: a thread that fails to open when
              // nobody is waiting for the answer had nowhere to be said (ADR-0169), and whoever knows what the child loses
              // is the diagnostic channel, not a thread's protocol. It names BOTH fixes, since `--reading <language>` alone
              // would now narrow the delivery (ADR-0225 erratum) — and the child is told too, not only the adult.
              report: (reason) => {
                failed(); // forgotten: the next reading opens it again, the model may have come down since
                const line = `reading: the transcription thread could not open for ${language} — ${reason}; a child who reads `
                  + 'aloud in this language gets no answer — build the delivery with `npx inclusionist-heavy --reading` alone (it '
                  + `carries every language) or with \`--reading ${language.split('-')[0]!.toLowerCase()}\` in its list, and open `
                  + 'the game once online so the install fetches it';
                if (!measuredProblems.includes(line)) measuredProblems.push(line);
                srAlert(t('sr.reading.failed'));
              },
            }));
          }
          const sameThreadLine = 'reading: this browser has no `Worker`, so the transcription runs on the same thread that '
            + 'draws the game and feeds the microphone — measured, that cuts the recording in gaps of seconds and the child '
            + 'loses the words she said meanwhile; serve the game where workers are available';
          if (!measuredProblems.includes(sameThreadLine)) measuredProblems.push(sameThreadLine);
          // 🔴 ONE RUNTIME PER LANGUAGE HERE TOO (issue #185): loading it at every `listen()` fetched and compiled up to 378 MiB per
          // reading, on the very thread that draws the game. A switch loads hers; a load that failed is forgotten and tried again.
          const { keepOneThreadPerLanguage } = await import('../platform/reading-in-worker.js');
          readingRuntimes ??= keepOneThreadPerLanguage();
          return readingRuntimes.forLanguage(language, (failed) => {
            const runtime = import('../platform/reading-runtime.js')
              .then(({ loadReadingRuntime }) => loadReadingRuntime({ base: doc.baseURI, language, fetch: (url) => win.fetch(url) }));
            runtime.catch(() => failed()); // the reading that asked still hears the reason: it awaits this same promise
            return { runtime, close: () => {} };
          }).runtime;
        }
        : undefined,
      /**
       * AND THE MICROPHONE, for the model route only: the browser's own recogniser opens one itself. It is built at the first
       * reading and let go at the end of each — a track left running is a browser still saying «this page is listening».
       */
      record: o.uses?.reading
        ? async (options) => {
          const { createMicrophone } = await import('../platform/microphone.js');
          microphone ??= createMicrophone({
            getUserMedia, createContext: (rate) => new HostAudioContext!({ sampleRate: rate }) as never, now: () => win.performance.now(),
          });
          return microphone.record(options);
        }
        : undefined,
    });
    const notDeclared = 'reading: this game called `reading.listen()` without declaring `uses: { reading: true }` — the child '
      + 'speaks and nothing answers, because a delivery built from this declaration carries no reading model; declare it';
    return {
      ready: () => (o.uses?.reading ? listener.ready() : Promise.resolve({ can: false as const, why: 'no-model' as const })),
      stop: () => listener.stop(),
      listen: (options) => {
        if (!o.uses?.reading) {
          if (!measuredProblems.includes(notDeclared)) measuredProblems.push(notDeclared);
          return Promise.reject(new Error('reading was not declared by this game: `uses: { reading: true }`'));
        }
        return listener.listen(options);
      },
    };
  })();

  /*
   * PLAYING WITH THE EYES (ADR-0213; issues #194, #196): the stored 👀 position drives `ui/eye-control` — the camera, the reading, the
   * keys stamped `olhos` on `#game-region` for seat 0, and the regions drawn over the game. What cannot start is said, lands here in
   * `problems`, and puts the 👀 back to off. A stored position opens the camera at start, which asks the child's permission.
   */
  /*
   * THE VIRTUAL CONTROLLER CARRIES COMMANDS TO THE GAME (ADR-0111 erratum; issue #197). The keyboard reaches it by the child's scheme,
   * in the window's capture after the menu navigation and the motor simulations (a key they refused stopped there); a transport that
   * reads positions presses the controller directly.
   */
  const deliverCommand = (cmd: VirtualCommand): void => { cartridge.onCommand?.(cmd); };
  /*
   * THE SCAN ITSELF (ADR-0218): the list is the positions this cartridge declared AND NAMED, because the chip says the game's
   * own words and a position nobody named would cost the child a pass of silence (ADR-0074). It is rebuilt every time the scan
   * starts, so a `mount()` of another cartridge scans ITS positions and not the ones that booted first (ADR-0142). After them come
   * the engine's own doors, «menu» (SELECT) and «pausar» (START), each only where it has something behind it (ADR-0218 §3).
   *
   * 🔴 AND INSIDE A MENU THE LIST IS THAT MENU'S STEPS (ADR-0218 erratum of 2026-09-26). The switch's key is stopped before any
   * listener, so no menu ever saw it: 📏 a child who opened the quick pause by scanning was left in it, every press doing nothing.
   * With the quick bar, the card or a panel in front, the scan offers «cancel · next · confirm · back · previous» and a press
   * moves the menu through `ui/menu-nav`, the path the keys and the pad take. On a panel's control with a value — a slider, a
   * list, a ⯇ ⯈ row — the pass also offers «increase» and «decrease», the right and left keys' step (`menuScanFor`).
   */
  const gameRegion = $<HTMLElement>('#game-region');
  const scanChip = gameRegion ? mountScanOverlay(doc, gameRegion) : null;
  /** The pass going on: the game's positions in play, a menu's steps in a menu — typed by what a press does with each. */
  type Scanning =
    | { readonly inMenu: false; readonly pass: SwitchScan<Action> }
    | { readonly inMenu: true; readonly cursor: MenuCursor; readonly pass: SwitchScan<MenuStep> };
  let scanning: Scanning | null = null;
  let scanFrame = 0;
  // «Is a menu in front?» is the question the virtual controller asks (`menuWithDpad`): the quick pause, the card or a panel.
  const freshScan = (): Scanning => {
    if (menuWithDpad()) {
      const cursor = nav.underCursor(0);
      return { inMenu: true, cursor, pass: createSwitchScan(menuScanFor(cursor)) };
    }
    const words = actionWords();
    const names = labellerFrom(words);
    // the ENGINE'S DOORS after the game's words (ADR-0218 §3): the card where it is mounted, the quick pause where it has its bar
    const doors = { menus: pauseUsable, quickPause: barUsable };
    return { inMenu: false, pass: createSwitchScan(playScanList(presetActions(words).filter((a) => !!names(a)), doors)) };
  };
  const scanWord = (item: string): string => scanItemText(item, labellerFrom(actionWords()), t);
  // A word of a different length is a different amount of room to keep free, so the band is measured again — and only then.
  const scanShow = (item: string): void => { if (scanChip?.showing(scanWord(item))) reserveBarBand(); };
  const scanTick = (): void => {
    if (!scanning) return;
    // 📌 A MENU OPENED OR CLOSED, OR ITS CURSOR REACHED A CONTROL OF ANOTHER KIND: the pass becomes the other list, from
    // «cancel», which is also what a press does — so the first thing offered in a menu just opened is the item that takes nothing.
    if (scanning.inMenu !== menuWithDpad() || (scanning.inMenu && scanning.cursor !== nav.underCursor(0))) scanning = freshScan();
    scanShow(scanning.pass(win.performance.now()).showing.item);
    scanFrame = win.requestAnimationFrame(scanTick);
  };
  const stopScan = (): void => {
    if (scanFrame) win.cancelAnimationFrame(scanFrame);
    scanFrame = 0; scanning = null; scanChip?.hide();
    reserveBarBand(); // the room the chip was keeping goes back to the game
  };
  const startScan = (): void => {
    if (scanning) return;
    scanning = freshScan();
    scanTick();
  };
  /** The scan is pressing the controller itself: that press is the position it took, and must not be taken again. */
  let scanIsPressing = false;
  scanPress = (source) => {
    if (!scanning || scanIsPressing) return false;
    swallowClick = false; // a click this take sends — a menu's «confirm» — is the take's, not a touch's (see the pointer above)
    // 📌 THE CHIP IS NOT REDRAWN HERE, and a surviving mutation is why: the frame loop above draws every frame, so a second
    // drawing path only saved the sixteen milliseconds until the next one — a line that could disagree with the loop and could
    // never be seen doing it.
    const now = win.performance.now();
    if (scanning.inMenu) {
      // THE MENU MOVES BY ITS OWN PATH: the step is the intent a key with that meaning carries, handed to `ui/menu-nav` as seat 0.
      const step = scanning.pass(now, { press: true }).commanded;
      if (step) nav.navIntent(0, menuStepKeys(step));
      return true;
    }
    const action = scanning.pass(now, { press: true }).commanded;
    if (!action) return true; // «cancel»: the press was taken, and means nothing
    // 📌 THROUGH THE VIRTUAL CONTROLLER, like every other transport (ADR-0111): in play it holds the child's key and reaches the
    // cartridge. The scan decides WHICH position; it does not decide what a position does.
    scanIsPressing = true;
    try { virtualController.press(action, source, 0); } finally { scanIsPressing = false; }
    win.setTimeout(() => virtualController.release(action, source, 0), SWITCH_SCAN_DEFAULTS.pulseMs);
    return true;
  };
  stateOn('switchScan', (on) => { if (on) startScan(); else stopScan(); });
  whenDisposed(stopScan); // the scan's frames are this root's, and an ended root keeps none running (ADR-0220)
  if (state.switchScan) startScan();
  const virtualController = createVirtualController({
    scheme: (i) => keyboard.kbFor(i), menuOpen: menuWithDpad,
    // ⚠️ `markKeyFrom` AND NOT RAW `markKey`: a key that arrives WITHOUT a source — which is every real keyboard event —
    // must ERASE whoever held it last instead of inheriting them (ADR-0109). The choice between the two doors lives in
    // `input/state`.
    holdKey: markKeyFrom,
    releaseKey: releaseKey, menuKey: keyToMenu, deliver: deliverCommand,
    // With a menu open the game hears no press, so the engine answers the sonar there: R1 reads the menu in front, spoken or,
    // in deaf mode, captioned and signed — the same two doors the play sonar's words take (ADR-0234).
    menuAnswers: (action) => menuSonarPress(action, screen, (text) => { srSay(text); deafMode.sonar(text); }),
    // START and SELECT from a transport with no key in the world — the eyes, the face, the hands, the voice, the scan — do what
    // the keys do, for the seat that pressed (ADR-0144 §1, ADR-0155): in play and in the quick pause alike, so START there
    // always LEAVES, whatever key the child bound first to `start` (ADR-0144 erratum of 2026-09-26).
    systemPress: (action, seat) => { if (action === 'start') startForSeat(seat); else openSeatMenus(seat); },
    // 🔴 WITH ONE BUTTON ONLY ON, EVERY PRESS HERE IS THE SWITCH (ADR-0218 §4): the eyes, the face, the hands, the voice, the
    // on-screen pad and the gamepad press this controller, so asking here is asking once for all of them.
    takeShown: (source) => !!scanPress?.(source),
  });
  /*
   * 🔴 THE KEYBOARD CONDUCTOR, AND ONLY THAT (ADR-0223). It resolves the action and PRESSES the virtual controller, like the
   * other transports — so there is ONE `deliver`, called from one place.
   *
   * 📏 What that guarantees:
   *   · with a menu open, a release is delivered only for a press the game HEARD — the controller's `held` memory;
   *   · a press swallowed by a menu followed by a release does not deliver a release without a press;
   *   · the question is asked the INVERSE way and does not age: what is not the keyboard is not this conductor's. A
   *     list of transports to exclude would age with the list, as it did when voice and scan arrived.
   *
   * 📌 And it does not ask whether a menu is open. That question has ONE answer, the controller's; what makes it true
   * for the keyboard is `keyToMenu` above, which does not redispatch a key that is already in the world.
   *
   * 🔴 ONE KEY PRESS IS ONE ACTION (ADR-0111 errata of 2026-09-26), from both sides. A key the game HEARD is spent: its browser
   * default is cancelled, or Space on a focused button was the game's `action2` AND the button's click. A key that went to
   * something else — a field being typed into, the engine's own control it activates — is not also played: `input/key-default`
   * says which, and the controller holds it back from play (with a menu open it is the menu's either way).
   */
  for (const kind of ['keydown', 'keyup'] as const) {
    win.addEventListener(kind, (e: KeyboardEvent) => {
      if (e.repeat || !cartridge.onCommand) return;
      const source = sourceOfEvent(e);
      // ⚠️ NO STAMP IS THE REAL KEYBOARD: an event the child produced carries no expando. The only stamp that belongs to
      // this conductor is `teclado`, and it exists for the release the motor filter synthesises.
      if (source && source !== 'teclado') return;
      const seat = keyboard.whichPlayer(e.code);
      if (seat < 0) return;
      const action = keyboard.actionOf(e.code, seat) as Action | null;
      // ⚠️ START AND SELECT ARE NOT PRESSED HERE: their key is answered by the engine's own listeners above, which run for a
      // cartridge with no `onCommand` too — pressed here as well, the controller would open the pause a second time (ADR-0144).
      if (!action || action === 'start' || action === 'select') return;
      if (kind === 'keyup') { virtualController.release(action, source, seat); return; }
      // 🔴 A KEY THE MENUS CONSUMED IS NOT ALSO PLAYED (ADR-0111 erratum of 2026-09-26). `nav.attach()` put `menuNavKey` on this
      // window's capture first, so it has already decided — and a key that CLOSED the last menu (resume, «no» at the card's
      // root, a panel's «Voltar») leaves the controller no menu to see: 📏 Space on resume resumed AND answered the quiz.
      // 📌 And the key that ends print mode is print's: its listener runs after this one, so it is asked by its state (see there).
      if (nav.consumed(e) || printArmed) return;
      const toPlay = keyGoesToGame(e.code, e.target as Element | null, ENGINE_CONTROLS_IN_PLAY);
      if (virtualController.press(action, source, seat, toPlay)) e.preventDefault();
    }, true);
  }
  /*
   * 🔴 LOSING FOCUS IS THE KEYUP THAT NEVER ARRIVES. With a key down, a click on the browser's own bar, an on-screen
   * keyboard or a switch-access program taking focus, or a tab change leaves the page without its keyup: the key stays
   * held, the character keeps walking, and the cartridge believes the button is still down. The window's `blur` is the
   * only signal left, so it dispatches the keyup each held key is owed — through every listener a real one would reach
   * (the simulations, the cool-down, this conductor), which is what keeps them all agreeing that the key is up.
   *
   * Which keys those are is `input/state`'s answer (`letGoOfTheKeyboard`); stamped `teclado` because this engine never
   * dispatches an unsigned synthetic key (ADR-0109), and the keyboard's own stamp is what the motor filter's release uses.
   */
  win.addEventListener('blur', () => letGoOfTheKeyboard((code) => {
    win.dispatchEvent(stampSource(new KeyboardEvent('keyup', { code, bubbles: true, cancelable: true }), 'teclado'));
  }));

  /*
   * 🔴 THE GAMEPAD, MOUNTED BY THE ENGINE (ADR-0224), like every other transport: the virtual controller is a local of
   * this function, and the one door (ADR-0223) has to reach it. A physical gamepad works because the child plugged one
   * in, not because a game remembered to ask.
   *
   * 📌 Almost every port of `GamepadCtx` is answered here with what this root already has. The rest are the cartridge's
   * world and arrive in one field (`GamepadGameHooks`), with **each absence having a written meaning** — never guessed.
   * A cartridge that declares nothing has a working gamepad.
   */
  // 📌 The absences are resolved in `input/gamepad`, in a table: what an absence MEANS is a decision, and a composition
  // root carries wiring (ADR-0221, erratum). Only `worldRunning`'s is from here, because only whoever mounts knows which
  // menus it has open.
  const gameHooks = padGameAnswers(cartridge.gamepad, () => !menuWithDpad());
  const gamepad = initGamepad({
    $, padMaps, input, t: translator.t,
    padTable: (players, seat) => padTableNow(players, seat), // the MOUNTED cartridge's table, rebuilt by `mount()`
    oneButton: () => state.oneButton, // the motor empathy, read each frame from the settings store (ADR-0232)
    getGamepads: () => win.navigator?.getGamepads?.() ?? [],
    // THE GAME'S WORD for a position: the engine knows the position exists, only the cartridge knows what it is called —
    // and it already declared that in the `preset` to exist.
    actionLabel: (action) => labellerFrom(actionWords())(action as Action),
    srSay, srAlert,
    frontOverlay: overlays.frontOverlay,
    // ⚠️ «PAUSE MENU» HERE IS EVERY MENU WITH A DIRECTIONAL, not only the card: the transport's `steerPause` already
    // handles the shared dialog before the card, which is the panel open on top. The same question the controller asks.
    pauseMenu: menuWithDpad,
    worldRunning: gameHooks.worldRunning,
    // The pad's START in play is PRESSED for its seat and answered by `systemPress` (ADR-0144 §1); this `pause` is the mapping
    // wizard's, which stops the game while a pad is mapped. The way out on the card and on seat 0's quick pause reuses the
    // decision already written for the finger, which knows leaving the quick pause from closing the card — for the screen's
    // first seat only: another seat's START there does nothing (ADR-0144, erratum of 2026-09-26).
    pause: () => { enterQuickPause(0); },
    resume: (seat) => { if (leadsTheScreen(seat)) togglePauseByTouch(); },
    isAttractActive: gameHooks.attractActive,
    stopAttract: gameHooks.stopAttract,
    // A PHYSICAL button makes the on-screen pad vanish — the same per-modality switch as the keyboard.
    isTouchMode: () => { const p = $<HTMLElement>('#touch-controls'); return !!p && !p.hidden; },
    hideTouchControls: () => { touchPad.hideTouchControls(); padBeforeMenu = false; },
    // ⚠️ SEEDED AT EVERY READ and not once: the cartridge repopulates the list at every restart, and a seat seeded only at
    // boot would leave the new players without a `pad` — invisible to the transport, with no error anywhere.
    getPlayers: () => seatEveryPlayer(players()),
    getNumPlayers: () => players().length,
    navTitle: gameHooks.navTitle,
    onBar: isOnBar,
    // ✅ THE BAR'S SECOND WAY OUT: `ui/menu-nav` calls `navBar` with `(i, k)` and never the third argument, the START edge —
    // the SECOND way out of the mode (ADR-0044 item 7). With the gamepad mounted by the root, it arrives here.
    navBar,
    sharedDialogOpen: nav.sharedDialogOpen,
    navDialog: nav.navDialog,
    getPauseMenu: (i) => $<HTMLElement>(`#vp-pause-${i}`),
    navPause: nav.navPause,
    setPauseActor,
    playerEdge,
    press: (action, source, player) => virtualController.press(action, source, player),
    release: (action, source, player) => virtualController.release(action, source, player),
    // the pad also steers menus and the pause without pressing a position, so it asks the scan's question itself (ADR-0218 §4)
    takeShown: () => !!scanPress?.('gamepad'),
    modalInput: gameHooks.modalInput,
    hasModal: gameHooks.hasModal,
    joinPlayer: gameHooks.joinPlayer,
    respawnPlayer: gameHooks.respawnPlayer,
    clearWaitingBadge: gameHooks.clearWaitingBadge,
    wizardStep: gameHooks.wizardStep,
    wizardTick: gameHooks.wizardTick,
  });
  /*
   * AND THE ENGINE POLLS, because whoever mounts polls. ⚠️ The game loop is the CARTRIDGE's (`core/loop.startLoop` is
   * called by it), so the root has nowhere to hang a frame — it opens its own, as it already does for the scan and the
   * camera. A gamepad read every frame is the price written in ADR-0224's negative consequence.
   */
  let padFrameHandle = 0;
  const anyPadConnected = (): boolean => (win.navigator?.getGamepads?.() ?? []).some(Boolean);
  // 📌 While the motor panel's wizard maps, the pads talk only to it (the transport asks only about its own wizard): read
  // under it, an unmapped DirectInput pad opened a second wizard on the same pad, and a standard pad steered the menus.
  const pollPad = (): void => { if (!padWizard?.state()) gamepad.pollPads(); padFrameHandle = win.requestAnimationFrame(pollPad); };
  const stopPollingPad = (): void => { if (padFrameHandle) win.cancelAnimationFrame(padFrameHandle); padFrameHandle = 0; };
  /*
   * ⚠️ THE LOOP EXISTS ONLY WHILE A GAMEPAD IS CONNECTED, and that is pillar 1 deciding: a `requestAnimationFrame` that
   * never sleeps costs battery on a school Chromebook, and the vast majority of machines will never see a gamepad.
   * 📌 `gamepadconnected` is the event the specification requires to arrive before the pad appears in the list, and the
   * query at boot covers the root born with one already connected (another cartridge's `mount()`, for example).
   * 📌 A host WITHOUT frames — the node project is one — is a capability of the environment and stays quiet (ADR-0169):
   * with no frames there is no game running for the gamepad to drive.
   */
  const startPollingPad = (): void => { if (padFrameHandle || typeof win.requestAnimationFrame !== 'function') return; padFrameHandle = win.requestAnimationFrame(pollPad); };
  win.addEventListener('gamepadconnected', startPollingPad);
  win.addEventListener('gamepaddisconnected', () => { if (!anyPadConnected()) stopPollingPad(); });
  if (anyPadConnected()) startPollingPad();

  const gazeRegion = $<HTMLElement>('#game-region');
  if (canCaptureMedia && gazeRegion) {
    // PLAYING THROUGH THE WEBCAM (ADR-0215): one stored position, off · hands · face · eyes; `ui/camera-control` starts only the control at
    // that position. Each control opens the camera itself and lets it go when the position moves on.
    const visionLoop = {
      requestFrame: (cb: FrameRequestCallback) => win.requestAnimationFrame(cb), cancelFrame: (h: number) => win.cancelAnimationFrame(h),
      now: () => win.performance.now(), every: (cb: () => void, ms: number) => win.setInterval(cb, ms), stopEvery: (h: number) => win.clearInterval(h),
    };
    const cameraDeps = {
      t: translator.t, doc, region: gazeRegion, base: doc.baseURI, hasFile: hasHeavyFile, loop: visionLoop, controller: virtualController, say: srSay, alert: srAlert,
      report: (rowNode: string) => { if (!measuredProblems.includes(rowNode)) measuredProblems.push(rowNode); },
      turnOff: () => state.setCameraControlValue('off'),
    };
    // the eyes: the relative reading and the four-zone cycle (ADR-0213), presses from `olhos`, the eye lines and the regions' outlines
    const eyes = createEyeControl(cameraDeps);
    // the face: the Dev's face map (ADR-0210), presses from `rosto`, the eyes, brows and lips lines
    const face = createFaceControl({ ...cameraDeps, openFeed: videoFeed(doc, win.navigator.mediaDevices) });
    // the hands: the Gesture Recognizer and the Dev's hands map (ADR-0210), presses from `gestos`, the hands' lines (issue #191)
    const hands = createHandControl({ ...cameraDeps, openFeed: videoFeed(doc, win.navigator.mediaDevices) });
    const cameraControls = { eyes, face, hands };
    stateOn('cameraControl', (mode) => { followCameraMode(mode, cameraControls); });
    followCameraMode(state.cameraControl, cameraControls);
    whenDisposed(() => { followCameraMode('off', cameraControls); }); // the camera closes with the root that opened it (ADR-0220)
  }

  /*
   * PLAYING BY SPEAKING (ADR-0189, ADR-0193, ADR-0194; issue #184): the stored 👄 drives `ui/voice-control` — the recogniser
   * from the delivery, the microphone that stays open, and presses stamped `fala` on the virtual controller.
   *
   * 📌 THE GRAMMAR FOLLOWS THE OPEN MENU: the names the child can see are the names she can say, and a name heard activates
   * its item (ADR-0194 §2). Both are asked of the MENU NAVIGATION for seat 0 — the seat the voice presses — so the names are
   * those of the menu a confirm would reach (the panel on top, else the pause card), and saying one puts that navigation's
   * cursor on it before the voice confirms through the virtual controller. The grammar is re-read when a card, a list of it or
   * a panel shows or hides — the region's observer above.
   */
  if (canCaptureMedia) {
    voiceControl = createVoiceControl({
      t: translator.t, base: doc.baseURI, language: () => bcp47(), controller: virtualController,
      menuWords: () => nav.itemNames(0), pointAt: (name) => nav.pointAt(name, 0),
      // with one button only on, a word heard is the switch and nothing else: a name is not pointed at (ADR-0218 §4)
      oneButtonOnly: () => state.switchScan,
      say: srSay, alert: srAlert,
      report: (line) => { if (!measuredProblems.includes(line)) measuredProblems.push(line); },
      turnOff: () => { state.setVoiceControlValue(false); },
      after: (fn, ms) => { win.setTimeout(fn, ms); },
      // ⚠️ THE ADDRESS IS ABSOLUTE AND THE BUNDLER MUST NOT FOLLOW IT: the recogniser arrives with the delivery at runtime.
      hasFile: hasHeavyFile, loadBundle: createBundleLoader((url) => import(/* @vite-ignore */ url)),
      // the model's vocabulary is read from its archive, so a menu name the model cannot hear is a line of `problems` (ADR-0194 §4)
      fetch: (url) => win.fetch(url),
      getUserMedia, createContext: () => new HostAudioContext!() as never,
    });
    stateOn('voiceControl', (on) => { void voiceControl?.apply(on); });
    void voiceControl.apply(state.voiceControl);
    // and so does the microphone; `apply(false)` stops without writing the stored answer, which belongs to the child (ADR-0220)
    whenDisposed(() => { void voiceControl?.apply(false); });
  }
  /*
  /*
   * THE FLASH SAMPLER LIVES IN `platform/flash-sampler` (ADR-0221, issue #203); what stays here is what only the root
   * knows: which is THIS cartridge's world canvas, and where a failure goes.
   */
  const sampleWorldFlashes = (ms: number): Promise<FlashMeasurement> => sampleFlashes({
    canvas: () => {
      const declaredWorld = cartridge.declaration.world();
      const eventTarget = declaredWorld.kind === 'element' ? $<HTMLElement>(declaredWorld.selector) : null;
      return eventTarget?.tagName === 'CANVAS' ? eventTarget as HTMLCanvasElement : eventTarget?.querySelector('canvas') ?? null;
    },
    scratch: () => doc.createElement('canvas'),
    frame: typeof win.requestAnimationFrame === 'function' ? (cb) => { win.requestAnimationFrame(cb); } : undefined,
    report: (rowNode) => { measuredProblems.push(rowNode); },
  }, ms);

  function unmountAll(): void {
    closeReadingThread();
    followCartridgeMappings(null);
    removeReachNotice();
    // the released cartridge's explanation goes with it: the next one has not explained anything yet (ADR-0244)
    explainForGame(null);
    hudMounted?.remove();
    hudMounted = null;
    // the map was the released cartridge's; the next one mounts its own (ADR-0239)
    while (hudRow?.map.firstChild) hudRow.map.removeChild(hudRow.map.firstChild);
    reserveBarBand();
    // ⚠️ `pop()` AND NOT A `clear()`: each `exit()` is that scene's DOM cleanup, and skipping it would leave on the page
    // what the previous cartridge drew. The loop ends because `pop()` returns `null` on an empty stack.
    while (rootScenes.pop()) { /* each scene's `exit()` IS its teardown */ }
  }

  function dispose(): void {
    unmountAll();
    // 📌 The gamepad's polling loop belongs to the ROOT since ADR-0224, so it dies with it: a `requestAnimationFrame` that
    // survives `dispose()` reads the Gamepad API forever, in a root that has no players any more (ADR-0220).
    stopPollingPad();
    for (const release of endOfLife.splice(0)) release(); // drained as it goes: a second `dispose()` finds nothing to release
    listeners.releaseAll();
  }

  return {
    get declaration() { return cartridge.declaration; },
    get declines() { return declines(); },
    mount: mountAll,
    unmount: unmountAll,
    dispose,
    pause: pauseControls,
    tts,
    reading,
    captionSound: writeSoundCaption,
    explain: explainForGame,
    gameSpeed: () => state.gameSpeed,
    menuIndexOn: () => state.menuIndexOn,
    t: translator.t,
    localeReady: translator.ready,
    locale: translator.locale,
    setLocale: translator.setLocale,
    say: srSay,
    alert: srAlert,
    mirrorAnnouncements: announcer.mirrorTo,
    deafMode: { isOn: deafMode.isOn, toggle: deafMode.toggle, captionsOn: deafMode.captionsOn },

    settings: state,
    mapSlot: hudRow?.map ?? null,

    input,
    keyboardConfig,

    audio: mixer,

    crt,
    lq,

    measureFlashes: sampleWorldFlashes,
    overlays,
    nav,
    keyboard,
    controller: virtualController,
    sonar,
    applyVisionFilter: setVisionFilter,
    scenes: rootScenes,
    onLocaleChange: (fn) => { localeListeners.push(fn); },
    cvdFilters,
    get problems() {
      return [...hostProblems, ...stylesheetMissing(), ...measureCartridgeProblems(), ...translator.dictionaryGaps(),
        ...missingDeclaredKeys(cartridge, translator.declares), ...measuredProblems, ...storageOutsideScope(),
        ...unreadableWorldProblems(screen)];
    },
    onFailure: announceFailure,
    get reach() { return currentReach; },
  };
}
