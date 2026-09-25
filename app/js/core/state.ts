// SPDX-License-Identifier: AGPL-3.0-or-later
// core/state.ts — the child's settings for a ROOT (the SINGLE source it reads), built by `createSettingsStore` over the port the
// root lends, read through live getters and written by setters, plus a minimal typed bus (Map<event, Set<fn>>) for the
// readers "from afar" that react to a setting.

// ⚠️ NO STORAGE IMPORT (ADR-0178, issue #174): the child's settings come through the port `createSettingsStore` receives — the
// shape `platform/storage` already has — so `core` does not reach up to `platform` (ADR-0173).
// 🔴 A FACTORY, NOT A MODULE OF BINDINGS (ADR-0232 D4, issue #207): the settings and the bus live in the closure a root builds,
// so two roots on one page — and two test files — share nothing (ADR-0142). A game reads the root's store as `engine.settings`.

import { isGameSpeed } from './game-speed.js';
import { isCaptionRate } from './caption-duration.js';
import { isSpeechRate } from './speech-rate.js';
// 📌 THE VOCABULARY IS NOT HERE (ADR-0232, issue #207): the defaults and the camera positions are stateless, and a module that
// needs only them imports `core/setting-defaults` or `core/camera-cycle`, never this store.
import { DEFAULTS } from './setting-defaults.js';
import { toCameraControl, type CameraControl } from './camera-cycle.js';
import { toSessionMinutes, toSessionEnding, type SessionEnding } from './session-clock.js';

/** The port the settings are read and written through. `platform/storage` has this shape; a test passes a double. */
export interface StatePort {
  get(key: string, fallback: string | null): string | null;
  set(key: string, value: string | number | boolean): unknown;
  getBool(key: string, fallback?: boolean): boolean;
  setBool(key: string, on: boolean): unknown;
  getNum(key: string, fallback?: number): number;
  readonly KEYS: {
    readonly letterCase: string; readonly captions: string; readonly menuIndex: string; readonly cbsafe: string;
    readonly ownercolors: string; readonly outfg: string; readonly outbg: string;
  };
}

/**
 * ========================= THE BUS, TYPED =========================
 *
 * It was `emit(evt: string, val: unknown)`, two wrongs in one signature:
 *
 *   · THE NAME WAS A `string`. An `emit('viz', …)` instead of `'vizMode'` is an error nowhere — it is SILENCE. The right
 *     subscriber is never called, nothing goes red, and the only clue is a panel that stopped updating.
 *   · THE PAYLOAD WAS `unknown`. A subscriber had to cast, and the cast is where the lie gets in.
 *
 * Now `GameEvent` maps name → payload and `emit`/`on` are generic over it: an unknown name does not compile, a wrong
 * payload does not compile. It was typed before it had subscribers on purpose — ADR-0031 already required panels to
 * redraw when the child changes a setting, and the first subscribers (the bar and the audio panel, which must not lie
 * about blind mode) arrived with the contract already typed instead of being followed by a migration.
 */
export interface GameEvent {
  /* --- ENGINE: what this module emits --- */
  numPlayers: number;
  vizMode: string;
  blindMode: boolean;
  letterCase: LetterCase;
  captionsOn: boolean;
  menuIndexOn: boolean;
  cbSafe: boolean;
  ownerColors: boolean;
  hcOutlineFg: OutlineLevel;
  hcOutlineBg: OutlineLevel;
  caneBlockDiv: number;
  wheelchair: boolean;
  oneButton: boolean;
  /** The wait after an accepted key, in milliseconds (ADR-0217); 0 is off, which is how it leaves the factory. */
  inputCooldown: number;
  /** Playing with ONE button: the machine offers each position and any press takes the one showing (ADR-0218). */
  switchScan: boolean;
  /** Playing by SPEAKING: the child says a word of the game and the position it names is pressed (ADR-0189, issue #184). */
  voiceControl: boolean;
  /** The game speed, a step of `core/game-speed` (ADR-0180): 1 is 100%. */
  gameSpeed: number;
  /** The child's caption reading rate, words a minute (ADR-0183 §4): 125, 145 or 175. */
  captionPpm: number;
  /** The child's speech rate, words a minute (ADR-0183 §1, ADR-0196): 254 to 504 by 50. */
  speechPpm: number;
  /** The «no strength to hold» empathy simulation (ADR-0181): a held game key reads as one tap. */
  noGripStrength: boolean;
  /** Playing through the webcam (ADR-0215): off, hands, face or eyes — one mode at a time, each with its lines. */
  cameraControl: CameraControl;
  /** The session's length in whole minutes, the Time Timer's whole disc (ADR-0236): 60 unless an adult set another. */
  sessionMinutes: number;
  /** What the session clock does when the length runs out (ADR-0236 erratum): red, red pulsing gently, or screen lock. */
  sessionEnding: SessionEnding;

  /* --- GAME: a game AUGMENTS this interface with its own events by declaration merging. The engine cannot name a game's
     payload — it is a type of the game (ADR-0033/0039) — and does not need to: whoever owns the event declares it. --- */
}

type Listener<K extends keyof GameEvent> = (val: GameEvent[K]) => void;

/**
 * A gate tile: a gate is a LIST of these, not one object with a position. A STRUCTURAL minimum — `core/` does not
 * import a game's types, and a game's richer tile is assignable to this.
 */
export interface GateTile { readonly tx: number; readonly ty: number }

/**
 * letterCase: letters show in UPPER CASE or in their natural case. A stored 'lower' reads as 'mixed': the Dev asked for two
 * options, upper and lower case together or upper case only (see the store's `letterCase`).
 */
export type LetterCase = 'mixed' | 'upper';

/** Outline thickness: 0 none · 1 thin · 2 thick. Out of range saturates, it is not rejected. */
export type OutlineLevel = 0 | 1 | 2;
const toOutlineLevel = (v: number): OutlineLevel => Math.max(0, Math.min(2, v | 0)) as OutlineLevel;

/** A wait in whole milliseconds; anything that is not a positive number is off. The writer and the loader share it. */
const toCooldown = (ms: number): number => (Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0);

/**
 * A root's settings store: every read is a LIVE getter (it answers the value of now, not of when it was taken), every write
 * a setter that does three things and only three — stores, persists, tells.
 *
 * ⚠️ DESTRUCTURING A READ FREEZES IT: `const { blindMode } = store` copies the value of that moment. Read `store.blindMode`.
 * The setters and the bus hold no `this`, so they can be taken apart (`const { on, emit } = store`).
 */
export interface SettingsStore {
  /** The active visual/colour mode (stored in incl_viz by its setter; `initVizMode` does not store). */
  readonly vizMode: string;
  readonly blindMode: boolean;
  readonly letterCase: LetterCase;
  readonly captionsOn: boolean;
  readonly menuIndexOn: boolean;
  readonly cbSafe: boolean;
  readonly ownerColors: boolean;
  readonly hcOutlineFg: OutlineLevel;
  readonly hcOutlineBg: OutlineLevel;
  readonly caneBlockDiv: number;
  readonly wheelchair: boolean;
  readonly oneButton: boolean;
  readonly noGripStrength: boolean;
  readonly inputCooldown: number;
  readonly switchScan: boolean;
  readonly voiceControl: boolean;
  readonly cameraControl: CameraControl;
  readonly gameSpeed: number;
  readonly captionPpm: number;
  readonly speechPpm: number;
  readonly sessionMinutes: number;
  readonly sessionEnding: SessionEnding;
  /** Sets the visual mode WITHOUT storing it: a default taken from the media query must follow the OS at every boot. */
  initVizMode(mode: string): void;
  setVizModeValue(mode: string): void;
  setBlindModeValue(on: boolean): void;
  setLetterCaseValue(c: LetterCase): void;
  setCaptionsOnValue(on: boolean): void;
  setMenuIndexOnValue(on: boolean): void;
  setCbSafeValue(on: boolean): void;
  setOwnerColorsValue(on: boolean): void;
  setOutlineFgValue(v: number): void;
  setOutlineBgValue(v: number): void;
  setCaneBlockDivValue(div: number): void;
  setWheelchairValue(on: boolean): void;
  setOneButtonValue(on: boolean): void;
  setNoGripStrengthValue(on: boolean): void;
  setInputCooldownValue(ms: number): void;
  setSwitchScanValue(on: boolean): void;
  setVoiceControlValue(on: boolean): void;
  setCameraControlValue(v: CameraControl): void;
  setGameSpeedValue(v: number): void;
  setCaptionPpmValue(ppm: number): void;
  setSpeechPpmValue(ppm: number): void;
  setSessionMinutesValue(minutes: number): void;
  setSessionEndingValue(ending: SessionEnding): void;
  /** Subscribes to `evt`. Returns the function that cancels — keeping the return is cheaper than remembering `off`. */
  on<K extends keyof GameEvent>(evt: K, fn: Listener<K>): () => void;
  off<K extends keyof GameEvent>(evt: K, fn: Listener<K>): void;
  /**
   * Tells the subscribers of `evt`. PUBLIC because a game emits on the same channels: a second map of subscribers would be a
   * second bus, and whoever subscribed in the wrong one would simply never be told — no error, no red test.
   */
  emit<K extends keyof GameEvent>(evt: K, val: GameEvent[K]): void;
}

// ========================= WHAT DOES NOT LIVE HERE (ADR-0038, cut by LIFETIME) =========================
// This store holds what lives for the PAGE — the child's accessibility, language and device settings — and nothing
// else; `tests/lifetime-gate.node.test.ts` asserts it on every run.
//   · The PHASE became a stack (`core/scenes`). `phase === 'paused'` ERASED the fact that a game is underneath; the stack
//     keeps it, and engine modules receive BOOLEANS, never the phase names (ADR-0030).
//   · The ROUND (players, who paused, what ended) does not persist, and lives in the game's run state, not here.
//   · A GAME's own state (its scenery, activity, level, coins) persists under the game's key and travels with the
//     cartridge (ADR-0033, ADR-0036).

/**
 * Builds a settings store over `port`, READING THE CHILD'S STORED SETTINGS FIRST (ADR-0178): the composition root builds it
 * before anything reads or writes a setting, so no write can put a default over what the child saved. The port is
 * REQUIRED — an optional one falling back to a shared store would be the singleton again (ADR-0232, erratum D2b).
 */
export function createSettingsStore(port: StatePort): SettingsStore {
  const subs = new Map<keyof GameEvent, Set<(val: never) => void>>();

  function on<K extends keyof GameEvent>(evt: K, fn: Listener<K>): () => void {
    if (!subs.has(evt)) subs.set(evt, new Set());
    subs.get(evt)!.add(fn as (val: never) => void);
    return () => off(evt, fn);
  }
  function off<K extends keyof GameEvent>(evt: K, fn: Listener<K>): void {
    const s = subs.get(evt);
    if (s) s.delete(fn as (val: never) => void);
  }
  /*
   * The `try` around each subscriber is NOT laziness: a listener that throws must not stop the others from receiving. A
   * broken panel brings down the panel, not the game.
   */
  function emit<K extends keyof GameEvent>(evt: K, val: GameEvent[K]): void {
    const s = subs.get(evt);
    if (s) for (const fn of s) { try { (fn as unknown as Listener<K>)(val); } catch (e) { /* noop */ } }
  }

  // --- vizMode: the active visual/colour mode (stored in incl_viz). `initVizMode` does NOT store it: a default taken from
  //     the media query must follow the OS at every boot, and storing it would freeze the tracking of prefers-contrast. The
  //     child's own changes go through `setVizModeValue`. ---
  let vizMode = 'normal';

  // --- blindMode: BLIND MODE. Only the audio aids — cane, sonar, edge guard, narration — with no black screen; the
  //     Empathy blindness simulation is another thing and turns this on as well.
  //
  //     THE SETTER DOES THREE THINGS AND ONLY THREE: stores, persists, tells. Redrawing the level, reflecting a panel,
  //     announcing to the screen reader are REACTIONS, and whoever reacts subscribes to the event. A setter that knows how
  //     to redraw the screen is a setter no test can call. ---
  let blindMode = port.getBool('incl_modocego', DEFAULTS.blindMode);

  // --- letterCase: letters show in UPPER CASE or in their natural case. A pedagogical choice, not an aesthetic one:
  //     Brazilian literacy usually starts in upper case, and a child past that stage needs the lower case.
  //
  // --- captionsOn: captions for sounds (deaf accessibility).
  //
  //     BOTH PERSIST (ADR-0028). The Dev's answer was wider than the question: EVERY settings panel persists, and every
  //     panel ends with a control that restores its own defaults. The reason is accessibility, not convenience — a deaf
  //     child who turns captions on and finds them off tomorrow pays that price every day, and whoever needs the panel
  //     most has the least margin to lose it.
  //
  //     The values are 'mixed' | 'upper', a choice inside the AAC panel. A stored 'lower' reads as 'mixed': the Dev asked
  //     for two options, upper and lower case together or upper case only, and the first is text in its NATURAL case, not
  //     text forced to lower — forcing lower case on a proper noun teaches wrong.
  //
  //     THE DERIVATION MATTERS: there is no `aacMode` yet, on purpose. While only the two letter cases can be chosen, a
  //     second variable for the same question would be a duplicate state (#54). When a pictogram set can be chosen,
  //     `aacMode` is born and `letterCase` derives from it. ---
  let letterCase: LetterCase = port.get(port.KEYS.letterCase, DEFAULTS.letterCase) === 'upper' ? 'upper' : 'mixed';
  let captionsOn = port.getBool(port.KEYS.captions, DEFAULTS.captionsOn);

  // --- menuIndexOn: the "6 of 10" at the end of each menu item's announcement (ADR-0044, item 3).
  //
  //     BORN ON, for the reason blind mode is born with speech and sonar: whoever needs the index to find their way has
  //     no way to know it exists if it arrives off. Whoever does NOT need it finds the setting by reading the menu,
  //     which is exactly what that person can do.
  //
  //     STORED in `incl_menuindex` (the CHILD's scope, ADR-0027): the preference follows them from game to game. ---
  let menuIndexOn = port.getBool(port.KEYS.menuIndex, DEFAULTS.menuIndexOn);

  // --- cbSafe: the COLOUR-BLIND SAFE PALETTE (Okabe-Ito). Not a filter over the image — the choice of the source colours,
  //     applied IN PLACE so everyone who already references the palette sees the change. ---
  let cbSafe = port.getBool(port.KEYS.cbsafe, DEFAULTS.cbSafe);

  // --- ownerColors: in multiplayer, each item shows in the colour of WHO can take it. Off, everyone sees the original
  //     colour — preferable for whoever cannot tell the owners' colours apart. ---
  let ownerColors = port.getBool(port.KEYS.ownercolors, DEFAULTS.ownerColors);

  // --- hcOutlineFg / hcOutlineBg: the high-contrast OUTLINES, two because they serve different criteria. `fg` outlines
  //     the foreground — character and items — for WCAG 2.4.7 (focus visible). `bg` outlines the outer edge of what can
  //     and cannot be walked, for WCAG 1.4.11 (component contrast ≥ 3:1). Merging them would erase one of the guarantees.
  //
  //     Saturating to 0..2 happens twice: at load (against corrupted storage) and on write (against a caller). ---
  let hcOutlineFg = toOutlineLevel(port.getNum(port.KEYS.outfg, DEFAULTS.hcOutlineFg));
  let hcOutlineBg = toOutlineLevel(port.getNum(port.KEYS.outbg, DEFAULTS.hcOutlineBg));

  // --- caneBlockDiv: the CANE's tap spacing, in blocks walked. 1 = one tap per block; 2 = one tap every half block. Not a
  //     sound preference: it is the resolution at which a blind child measures how far they walked. ---
  let caneBlockDiv = port.getNum('incl_cane_div', DEFAULTS.caneBlockDiv) || DEFAULTS.caneBlockDiv;

  // --- wheelchair: WHEELCHAIR MODE, a game's answer to a child who plays seated: steps and ladders become ramps and lifts
  //     in a game that has them. The engine stores and announces it; what it changes is the game's to decide. ---
  let wheelchair = port.getBool('incl_wheelchair', DEFAULTS.wheelchair);

  // --- oneButton: «um botão por vez», an EMPATHY SIMULATION (ADR-0181): while one game key is held, a second is never
  //     accepted. It was described as an accommodation; the Dev: it simulates a motor difficulty. ---
  let oneButton = port.getBool('incl_onebtn', DEFAULTS.oneButton);

  // --- noGripStrength: «sem força para segurar botão», the second motor empathy simulation (ADR-0181): any sustained contact of a
  //     game key reads as one tap. Stored like the other simulations, off by default. ---
  let noGripStrength = port.getBool('incl_sem_forca', DEFAULTS.noGripStrength);

  // --- inputCooldown: a tremor is not a second press (ADR-0217, GAG Advanced/Motor). MILLISECONDS, and 0 is off — the rule reads
  //     the number, so «how long» and «whether» are one value and cannot disagree. Off by default: a child with no tremor would
  //     lose half a second between every two presses, which in a game of reaction is the game. ---
  let inputCooldown = toCooldown(port.getNum('incl_input_cooldown', DEFAULTS.inputCooldown));

  // --- switchScan: PLAYING WITH ONE BUTTON, the third position of the quick bar's ☝️ (ADR-0218, issue #201). The scan offers the
  //     game's declared positions one at a time and any press takes the one showing (`input/switch-scan`).
  //     📌 ONE KEY FOR THE WHOLE ENGINE, and not one per seat like the latch beside it: this describes the CHILD'S BODY and not
  //     the game — the switch she has in the platformer she also has in the quiz — while the latch answers «does THIS transport
  //     need me to hold», which is why that one is kept per seat and per transport (ADR-0113).
  //     ⚠️ NOT `oneButton` ABOVE, and the two names are a debt worth seeing: that one is the empathy SIMULATION «um botão por
  //     vez» (ADR-0181), which makes play harder on purpose, and this is the ACCOMMODATION of the same catalogue id. The Dev
  //     named the confusion on 2026-09-21; renaming the simulation crosses into a cartridge (`p.oneButton` in game-soccer) and
  //     waits for its own commit. ---
  let switchScan = port.getBool('incl_switch_scan', DEFAULTS.switchScan);

  // --- voiceControl: PLAYING BY SPEAKING, the quick bar's 👄 (ADR-0189, ADR-0193; issue #184). The child says a word of the
  //     game and the position it names is pressed. ONE key for the whole engine, like the camera's: it describes the CHILD, and
  //     a voice she has in one game she has in the next. Off by default, because it opens a MICROPHONE and nothing may do that
  //     by itself; a stored value that is not a yes reads as off. ---
  let voiceControl = port.getBool('incl_voice_control', DEFAULTS.voiceControl);

  // --- cameraControl: playing through the webcam, the quick bar's 📷 (ADR-0215). ONE key, so one camera mode at a time holds by
  //     construction (ADR-0197); every playing position draws its lines. Kept on the device; the positions, their order and the
  //     sanitiser live in `core/camera-cycle`. ---
  let cameraControl = toCameraControl(port.get('incl_camera_control', DEFAULTS.cameraControl));

  // --- gameSpeed: the game speed the quick bar's hourglass cycles (ADR-0180); a game hands it to `core/loop.startLoop` as its
  //     `speed` port (ADR-0232), which multiplies the frame time by it. Stored and carried between games; a stored value
  //     outside the steps reads as 100%. ---
  let gameSpeed = isGameSpeed(port.getNum('incl_game_speed', DEFAULTS.gameSpeed));

  // --- captionPpm: the child's caption reading rate, words a minute (ADR-0183 §4): how long a sound caption stays. One of
  //     125, 145, 175; anything else reads as 125. ---
  let captionPpm = isCaptionRate(port.getNum('incl_caption_ppm', DEFAULTS.captionPpm));

  // --- speechPpm: the child's speech rate, words a minute (ADR-0183 §1; issue #179): each engine measures its voice and plays at
  //     the ratio (`core/speech-rate`). One of 254…504 by 50; anything else reads as 254, the normal speed (ADR-0196). ---
  let speechPpm = isSpeechRate(port.getNum('incl_speech_ppm', DEFAULTS.speechPpm));

  // --- sessionMinutes / sessionEnding: the SESSION CLOCK's two options (ADR-0236 and its erratum; issue #94) — how long a
  //     session is, and what the clock does when it runs out. The adult's values, not the child's (ADR-0050 §2): they are
  //     stored here because the engine enforces the time locally, and until an adult sets them the defaults apply. No menu
  //     writes them yet; where they live and whether the child can reach them is the Dev's open question. ---
  let sessionMinutes = toSessionMinutes(port.getNum('incl_session_minutes', DEFAULTS.sessionMinutes), DEFAULTS.sessionMinutes);
  let sessionEnding = toSessionEnding(port.get('incl_session_ending', DEFAULTS.sessionEnding), DEFAULTS.sessionEnding);

  return {
    get vizMode() { return vizMode; },
    get blindMode() { return blindMode; },
    get letterCase() { return letterCase; },
    get captionsOn() { return captionsOn; },
    get menuIndexOn() { return menuIndexOn; },
    get cbSafe() { return cbSafe; },
    get ownerColors() { return ownerColors; },
    get hcOutlineFg() { return hcOutlineFg; },
    get hcOutlineBg() { return hcOutlineBg; },
    get caneBlockDiv() { return caneBlockDiv; },
    get wheelchair() { return wheelchair; },
    get oneButton() { return oneButton; },
    get noGripStrength() { return noGripStrength; },
    get inputCooldown() { return inputCooldown; },
    get switchScan() { return switchScan; },
    get voiceControl() { return voiceControl; },
    get cameraControl() { return cameraControl; },
    get gameSpeed() { return gameSpeed; },
    get captionPpm() { return captionPpm; },
    get speechPpm() { return speechPpm; },
    get sessionMinutes() { return sessionMinutes; },
    get sessionEnding() { return sessionEnding; },

    initVizMode(mode) { vizMode = mode; },
    setVizModeValue(mode) { port.set('incl_viz', mode); vizMode = mode; emit('vizMode', mode); },
    setBlindModeValue(on) {
      if (blindMode === on) return; // without this guard the announcement would repeat on every redundant click
      port.setBool('incl_modocego', on); blindMode = on; emit('blindMode', on);
    },
    setLetterCaseValue(c) {
      if (letterCase === c) return;
      port.set(port.KEYS.letterCase, c); letterCase = c; emit('letterCase', c);
    },
    setCaptionsOnValue(on) {
      const v = !!on;
      if (captionsOn === v) return;
      port.setBool(port.KEYS.captions, v); captionsOn = v; emit('captionsOn', v);
    },
    setMenuIndexOnValue(on) {
      const v = !!on;
      if (menuIndexOn === v) return;
      port.setBool(port.KEYS.menuIndex, v); menuIndexOn = v; emit('menuIndexOn', v);
    },
    setCbSafeValue(on) {
      const v = !!on;
      if (cbSafe === v) return;
      port.setBool(port.KEYS.cbsafe, v); cbSafe = v; emit('cbSafe', v);
    },
    setOwnerColorsValue(on) {
      const v = !!on;
      if (ownerColors === v) return;
      port.setBool(port.KEYS.ownercolors, v); ownerColors = v; emit('ownerColors', v);
    },
    setOutlineFgValue(v) {
      const n = toOutlineLevel(v);
      if (hcOutlineFg === n) return;
      port.set(port.KEYS.outfg, n); hcOutlineFg = n; emit('hcOutlineFg', n);
    },
    setOutlineBgValue(v) {
      const n = toOutlineLevel(v);
      if (hcOutlineBg === n) return;
      port.set(port.KEYS.outbg, n); hcOutlineBg = n; emit('hcOutlineBg', n);
    },
    setCaneBlockDivValue(div) {
      const d = (+div) || 1; // the `|| 1`: a corrupted stored value would become NaN and the cane
      if (caneBlockDiv === d) return; //  would stop tapping, which is the most silent failure there is
      port.set('incl_cane_div', d); caneBlockDiv = d; emit('caneBlockDiv', d);
    },
    setWheelchairValue(on) {
      if (wheelchair === on) return;
      port.setBool('incl_wheelchair', on); wheelchair = on; emit('wheelchair', on);
    },
    setOneButtonValue(on) {
      if (oneButton === on) return;
      port.setBool('incl_onebtn', on); oneButton = on; emit('oneButton', on);
    },
    setNoGripStrengthValue(on) {
      const v = !!on;
      if (noGripStrength === v) return;
      port.setBool('incl_sem_forca', v); noGripStrength = v; emit('noGripStrength', v);
    },
    setInputCooldownValue(ms) {
      const v = toCooldown(ms);
      if (inputCooldown === v) return;
      port.set('incl_input_cooldown', v); inputCooldown = v; emit('inputCooldown', v);
    },
    setSwitchScanValue(on) {
      const v = !!on;
      if (switchScan === v) return;
      port.setBool('incl_switch_scan', v); switchScan = v; emit('switchScan', v);
    },
    setVoiceControlValue(on) {
      const v = !!on;
      if (voiceControl === v) return;
      port.setBool('incl_voice_control', v); voiceControl = v; emit('voiceControl', v);
    },
    setCameraControlValue(v) {
      const valid = toCameraControl(v);
      if (cameraControl === valid) return;
      port.set('incl_camera_control', valid); cameraControl = valid; emit('cameraControl', valid);
    },
    setGameSpeedValue(v) {
      const isValidSpeed = isGameSpeed(v);
      if (gameSpeed === isValidSpeed) return;
      port.set('incl_game_speed', isValidSpeed); gameSpeed = isValidSpeed; emit('gameSpeed', isValidSpeed);
    },
    setCaptionPpmValue(ppm) {
      const isValidRate = isCaptionRate(ppm);
      if (captionPpm === isValidRate) return;
      port.set('incl_caption_ppm', isValidRate); captionPpm = isValidRate; emit('captionPpm', isValidRate);
    },
    setSpeechPpmValue(ppm) {
      const isValidRate = isSpeechRate(ppm);
      if (speechPpm === isValidRate) return;
      port.set('incl_speech_ppm', isValidRate); speechPpm = isValidRate; emit('speechPpm', isValidRate);
    },
    setSessionMinutesValue(minutes) {
      const valid = toSessionMinutes(minutes, DEFAULTS.sessionMinutes);
      if (sessionMinutes === valid) return;
      port.set('incl_session_minutes', valid); sessionMinutes = valid; emit('sessionMinutes', valid);
    },
    setSessionEndingValue(ending) {
      const valid = toSessionEnding(ending, DEFAULTS.sessionEnding);
      if (sessionEnding === valid) return;
      port.set('incl_session_ending', valid); sessionEnding = valid; emit('sessionEnding', valid);
    },

    on, off, emit,
  };
}
