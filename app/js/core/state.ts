// SPDX-License-Identifier: AGPL-3.0-or-later
// core/state.ts — the child's settings for the PAGE (the SINGLE source), read as live bindings and written by setters,
// plus a minimal typed bus (Map<event, Set<fn>>) for the readers "from afar" that react to a setting.

// ⚠️ NO STORAGE IMPORT (ADR-0178, issue #174): the child's settings come through the port `loadState` receives — the
// shape `platform/storage` already has — so `core` does not reach up to `platform` (ADR-0173).

import { isGameSpeed } from './game-speed.js';
import { isCaptionRate } from './caption-duration.js';
import { isSpeechRate } from './speech-rate.js';

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

/** An empty storage: every read gives its fallback. What the bindings hold until the root loads the child's settings. */
const NULL_PORT: StatePort = {
  get: (_k, fallback) => fallback,
  set: () => false,
  getBool: (_k, fallback = false) => fallback,
  setBool: () => undefined,
  getNum: (_k, fallback = 0) => fallback,
  KEYS: { letterCase: '', captions: '', menuIndex: '', cbsafe: '', ownercolors: '', outfg: '', outbg: '' },
};

let port: StatePort | null = null;

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

  /* --- GAME: a game AUGMENTS this interface with its own events by declaration merging. The engine cannot name a game's
     payload — it is a type of the game (ADR-0033/0039) — and does not need to: whoever owns the event declares it. --- */
}

type Listener<K extends keyof GameEvent> = (val: GameEvent[K]) => void;
const _subs = new Map<keyof GameEvent, Set<(val: never) => void>>();

/** Subscribes to `evt`. Returns the function that cancels — keeping the return is cheaper than remembering `off`. */
export function on<K extends keyof GameEvent>(evt: K, fn: Listener<K>): () => void {
  if (!_subs.has(evt)) _subs.set(evt, new Set());
  _subs.get(evt)!.add(fn as (val: never) => void);
  return () => off(evt, fn);
}

export function off<K extends keyof GameEvent>(evt: K, fn: Listener<K>): void {
  const s = _subs.get(evt);
  if (s) s.delete(fn as (val: never) => void);
}

/**
 * Tells the subscribers of `evt`. EXPORTED because a game emits on the same channels: a second map of subscribers would
 * be a second bus, and whoever subscribed in the wrong one would simply never be told — no error, no red test.
 *
 * The `try` around each subscriber is NOT laziness: a listener that throws must not stop the others from receiving. A
 * broken panel brings down the panel, not the game.
 */
export function emit<K extends keyof GameEvent>(evt: K, val: GameEvent[K]): void {
  const s = _subs.get(evt);
  if (s) for (const fn of s) { try { (fn as unknown as Listener<K>)(val); } catch (e) { /* noop */ } }
}

// ========================= WHAT DOES NOT LIVE HERE (ADR-0038, cut by LIFETIME) =========================
// This module holds what lives for the PAGE — the child's accessibility, language and device settings — and nothing
// else; `tests/lifetime-gate.node.test.ts` asserts it on every run.
//   · The PHASE became a stack (`core/scenes`). `phase === 'paused'` ERASED the fact that a game is underneath; the stack
//     keeps it, and engine modules receive BOOLEANS, never the phase names (ADR-0030).
//   · The ROUND (players, who paused, what ended) does not persist, and a `export let` is a SHARED live binding: two games
//     on one page would see the same list, and the second would start with the first one's players still in it.
//   · A GAME's own state (its scenery, activity, level, coins) persists under the game's key and travels with the
//     cartridge (ADR-0033, ADR-0036).

// --- vizMode: the active visual/colour mode (stored in incl_viz). `initVizMode` does NOT store it: a default taken from
//     the media query must follow the OS at every boot, and storing it would freeze the tracking of prefers-contrast. The
//     child's own changes go through `setVizModeValue`. ---
export let vizMode = 'normal';
export function initVizMode(mode: string): void { vizMode = mode; }
export function setVizModeValue(mode: string): void { const p = portFor('setVizModeValue'); p.set('incl_viz', mode); vizMode = mode; emit('vizMode', mode); }

/**
 * The REDUCED MOTION default is not a constant — it is what the operating system asks for.
 *
 * It lives here, beside `DEFAULTS`, because ADR-0029's rule is ONE source for what a default is, and a computed default
 * is no less a default for not fitting a frozen object. Its readers are the boot and the visual sensitivity panel's
 * "restore defaults".
 *
 * Why the reset must read this and not `false`: on a machine whose owner asked for less motion, `false` would TURN THE
 * ANIMATION BACK ON — the reset would do, by itself, exactly what WCAG 2.3.3 exists to prevent, on the screen of someone
 * who already said they cannot take it.
 *
 * `matchMedia` is guarded: this module runs in the tests' `node` project, where there is no `window`.
 */
export function defaultReducedMotion(): boolean {
  return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/**
 * THE DEFAULTS, named. One value per line, each used in TWO places: the boot's read (when nothing is stored) and the
 * "restore defaults" of the panel that holds it (ADR-0028).
 *
 * The alternative is writing each default twice — once in the stored read, once in the reset — and two copies nobody
 * forces to agree diverge. Here the divergence would be worse than elsewhere: a reset that restores a value DIFFERENT
 * from what the game uses when nothing was set leaves the child in a third state, neither theirs nor the factory's, that
 * they have no name for when asking for help.
 *
 * `as const` + `Object.freeze` on purpose: a default someone can write at run time stops being a default.
 */
export const DEFAULTS = Object.freeze({
  // hearing
  blindMode: false,
  caneBlockDiv: 1,
  captionsOn: true,
  menuIndexOn: true, // the index is born ON: whoever does not know it exists is whoever needs it most
  // motor
  wheelchair: false,
  oneButton: false,
  inputCooldown: 0,
  switchScan: false,
  voiceControl: false,
  gameSpeed: 1,
  captionPpm: 125,
  speechPpm: 254, // the voice's normal speed, the minimum (ADR-0196)
  noGripStrength: false,
  cameraControl: 'off' as CameraControl,
  easy: false,       // per player (Easy mode)
  toggleMove: false,  // per player (movement by toggling)
  // The run-button toggle is born off at the FACTORY — and switches itself on with the on-screen pad, which is context,
  // not choice. The difference matters to ADR-0029's mark, which marks the stored CHOICE and not the state.
  toggleRun: false,   // per player (run-button toggle)
  // visual
  cbSafe: false,
  ownerColors: true,
  lq: 0,              // the L→Q contrast boost, off
  hcOutlineFg: 1,
  hcOutlineBg: 1,
  // communication (the letter case today; the AAC panel of ADR-0028 widens this)
  letterCase: 'upper',
  // ⚠️ THE LAST TWO are here because they were missing and it had a cost (issue #61): ADR-0029's mark reads `DEFAULTS`
  // and nothing else, so a value with no named default here is one the mark CANNOT mark.
  //   · `calmMode` — the autism-support level (0 normal · 1 calm · 2 quiet).
  //   · `viz` — the vision mode. `'normal'` is the mode that does nothing, now said instead of deduced from an empty
  //     string that happened to match no mode.
  calmMode: 0,
  viz: 'normal',
} as const);

// --- blindMode: BLIND MODE. Only the audio aids — cane, sonar, edge guard, narration — with no black screen; the
//     Empathy blindness simulation is another thing and turns this on as well.
//
//     State that six modules consult does not belong to the composition root; while it did, `createGame()` could not
//     exist without capturing it, which is the boundary test ADR-0027 wanted to run.
//
//     THE SETTER DOES THREE THINGS AND ONLY THREE: stores, persists, tells. Redrawing the level, reflecting a panel,
//     announcing to the screen reader are REACTIONS, and whoever reacts subscribes to the event. A setter that knows how
//     to redraw the screen is a setter no test can call. ---
export let blindMode: boolean = NULL_PORT.getBool('incl_modocego', DEFAULTS.blindMode);
export function setBlindModeValue(on: boolean): void {
  if (blindMode === on) return; // without this guard the announcement would repeat on every redundant click
  const p = portFor('setBlindModeValue'); p.setBool('incl_modocego', on); blindMode = on; emit('blindMode', on);
}


/**
 * A gate tile: a gate is a LIST of these, not one object with a position. A STRUCTURAL minimum — `core/` does not
 * import a game's types, and a game's richer tile is assignable to this.
 */
export interface GateTile { readonly tx: number; readonly ty: number }

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
//     THE DERIVATION MATTERS: there is no `caaMode` yet, on purpose. While only the two letter cases can be chosen, a
//     second variable for the same question would be a duplicate state (#54). When a pictogram set can be chosen,
//     `caaMode` is born and `letterCase` derives from it. ---
export type LetterCase = 'mixed' | 'upper';
export let letterCase: LetterCase = NULL_PORT.get(NULL_PORT.KEYS.letterCase, DEFAULTS.letterCase) === 'upper' ? 'upper' : 'mixed';
export function setLetterCaseValue(c: LetterCase): void {
  if (letterCase === c) return;
  const p = portFor('setLetterCaseValue'); p.set(p.KEYS.letterCase, c); letterCase = c; emit('letterCase', c);
}

export let captionsOn = NULL_PORT.getBool(NULL_PORT.KEYS.captions, DEFAULTS.captionsOn);
export function setCaptionsOnValue(on: boolean): void {
  const v = !!on;
  if (captionsOn === v) return;
  const p = portFor('setCaptionsOnValue'); p.setBool(p.KEYS.captions, v); captionsOn = v; emit('captionsOn', v);
}

// --- menuIndexOn: the "6 of 10" at the end of each menu item's announcement (ADR-0044, item 3).
//
//     BORN ON, for the reason blind mode is born with speech and sonar: whoever needs the index to find their way has
//     no way to know it exists if it arrives off. Whoever does NOT need it finds the setting by reading the menu,
//     which is exactly what that person can do.
//
//     STORED in `incl_menuindex` (the CHILD's scope, ADR-0027): the preference follows them from game to game.
export let menuIndexOn = NULL_PORT.getBool(NULL_PORT.KEYS.menuIndex, DEFAULTS.menuIndexOn);
export function setMenuIndexOnValue(on: boolean): void {
  const v = !!on;
  if (menuIndexOn === v) return;
  const p = portFor('setMenuIndexOnValue'); p.setBool(p.KEYS.menuIndex, v); menuIndexOn = v; emit('menuIndexOn', v);
}

// --- cbSafe: the COLOUR-BLIND SAFE PALETTE (Okabe-Ito). Not a filter over the image — the choice of the source colours,
//     applied IN PLACE so everyone who already references the palette sees the change. ---
export let cbSafe: boolean = NULL_PORT.getBool(NULL_PORT.KEYS.cbsafe, DEFAULTS.cbSafe);
export function setCbSafeValue(on: boolean): void {
  const v = !!on;
  if (cbSafe === v) return;
  const p = portFor('setCbSafeValue'); p.setBool(p.KEYS.cbsafe, v); cbSafe = v; emit('cbSafe', v);
}

// --- ownerColors: in multiplayer, each item shows in the colour of WHO can take it. Off, everyone sees the original
//     colour — preferable for whoever cannot tell the owners' colours apart. ---
export let ownerColors: boolean = NULL_PORT.getBool(NULL_PORT.KEYS.ownercolors, DEFAULTS.ownerColors);
export function setOwnerColorsValue(on: boolean): void {
  const v = !!on;
  if (ownerColors === v) return;
  const p = portFor('setOwnerColorsValue'); p.setBool(p.KEYS.ownercolors, v); ownerColors = v; emit('ownerColors', v);
}

/** Outline thickness: 0 none · 1 thin · 2 thick. Out of range saturates, it is not rejected. */
export type OutlineLevel = 0 | 1 | 2;
const toOutlineLevel = (v: number): OutlineLevel => Math.max(0, Math.min(2, v | 0)) as OutlineLevel;

// --- hcOutlineFg / hcOutlineBg: the high-contrast OUTLINES, two because they serve different criteria. `fg` outlines
//     the foreground — character and items — for WCAG 2.4.7 (focus visible). `bg` outlines the outer edge of what can
//     and cannot be walked, for WCAG 1.4.11 (component contrast ≥ 3:1). Merging them would erase one of the guarantees.
//
//     Saturating to 0..2 happens twice: at boot (against corrupted storage) and on write (against a caller). ---
export let hcOutlineFg: OutlineLevel = toOutlineLevel(NULL_PORT.getNum(NULL_PORT.KEYS.outfg, DEFAULTS.hcOutlineFg));
export function setOutlineFgValue(v: number): void {
  const n = toOutlineLevel(v);
  if (hcOutlineFg === n) return;
  const p = portFor('setOutlineFgValue'); p.set(p.KEYS.outfg, n); hcOutlineFg = n; emit('hcOutlineFg', n);
}
export let hcOutlineBg: OutlineLevel = toOutlineLevel(NULL_PORT.getNum(NULL_PORT.KEYS.outbg, DEFAULTS.hcOutlineBg));
export function setOutlineBgValue(v: number): void {
  const n = toOutlineLevel(v);
  if (hcOutlineBg === n) return;
  const p = portFor('setOutlineBgValue'); p.set(p.KEYS.outbg, n); hcOutlineBg = n; emit('hcOutlineBg', n);
}

// --- caneBlockDiv: the CANE's tap spacing, in blocks walked. 1 = one tap per block; 2 = one tap every half block. Not a
//     sound preference: it is the resolution at which a blind child measures how far they walked. ---
export let caneBlockDiv: number = NULL_PORT.getNum('incl_cane_div', DEFAULTS.caneBlockDiv) || DEFAULTS.caneBlockDiv;
export function setCaneBlockDivValue(div: number): void {
  const d = (+div) || 1; // the `|| 1`: a corrupted stored value would become NaN and the cane
  if (caneBlockDiv === d) return; //  would stop tapping, which is the most silent failure there is
  const p = portFor('setCaneBlockDivValue'); p.set('incl_cane_div', d); caneBlockDiv = d; emit('caneBlockDiv', d);
}

// --- wheelchair: WHEELCHAIR MODE, a game's answer to a child who plays seated: steps and ladders become ramps and lifts
//     in a game that has them. The engine stores and announces it; what it changes is the game's to decide. ---
export let wheelchair: boolean = NULL_PORT.getBool('incl_wheelchair', DEFAULTS.wheelchair);
export function setWheelchairValue(on: boolean): void {
  if (wheelchair === on) return;
  const p = portFor('setWheelchairValue'); p.setBool('incl_wheelchair', on); wheelchair = on; emit('wheelchair', on);
}

// --- oneButton: «um botão por vez», an EMPATHY SIMULATION (ADR-0181): while one game key is held, a second is never
//     accepted. It was described as an accommodation; the Dev: it simulates a motor difficulty. ---
export let oneButton: boolean = NULL_PORT.getBool('incl_onebtn', DEFAULTS.oneButton);
export function setOneButtonValue(on: boolean): void {
  if (oneButton === on) return;
  const p = portFor('setOneButtonValue'); p.setBool('incl_onebtn', on); oneButton = on; emit('oneButton', on);
}

// --- noGripStrength: «sem força para segurar botão», the second motor empathy simulation (ADR-0181): any sustained contact of a
//     game key reads as one tap. Stored like the other simulations, off by default. ---
export let noGripStrength: boolean = NULL_PORT.getBool('incl_sem_forca', DEFAULTS.noGripStrength);
export function setNoGripStrengthValue(on: boolean): void {
  const v = !!on;
  if (noGripStrength === v) return;
  const p = portFor('setNoGripStrengthValue'); p.setBool('incl_sem_forca', v); noGripStrength = v; emit('noGripStrength', v);
}

// --- inputCooldown: a tremor is not a second press (ADR-0217, GAG Advanced/Motor). MILLISECONDS, and 0 is off — the rule reads
//     the number, so «how long» and «whether» are one value and cannot disagree. Off by default: a child with no tremor would
//     lose half a second between every two presses, which in a game of reaction is the game. ---
export let inputCooldown: number = NULL_PORT.getNum('incl_input_cooldown', DEFAULTS.inputCooldown);
export function setInputCooldownValue(ms: number): void {
  const v = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : 0;
  if (inputCooldown === v) return;
  const p = portFor('setInputCooldownValue'); p.set('incl_input_cooldown', v); inputCooldown = v; emit('inputCooldown', v);
}

// --- switchScan: PLAYING WITH ONE BUTTON, the third position of the quick bar's ☝️ (ADR-0218, issue #201). The scan offers the
//     game's declared positions one at a time and any press takes the one showing (`input/switch-scan`).
//     📌 ONE KEY FOR THE WHOLE ENGINE, and not one per seat like the latch beside it: this describes the CHILD'S BODY and not
//     the game — the switch she has in the platformer she also has in the quiz — while the latch answers «does THIS transport
//     need me to hold», which is why that one is kept per seat and per transport (ADR-0113).
//     ⚠️ NOT `oneButton` ABOVE, and the two names are a debt worth seeing: that one is the empathy SIMULATION «um botão por
//     vez» (ADR-0181), which makes play harder on purpose, and this is the ACCOMMODATION of the same catalogue id. The Dev
//     named the confusion on 2026-09-21; renaming the simulation crosses into a cartridge (`p.oneButton` in game-soccer) and
//     waits for its own commit. ---
export let switchScan: boolean = NULL_PORT.getBool('incl_switch_scan', DEFAULTS.switchScan);
export function setSwitchScanValue(on: boolean): void {
  const v = !!on;
  if (switchScan === v) return;
  const p = portFor('setSwitchScanValue'); p.setBool('incl_switch_scan', v); switchScan = v; emit('switchScan', v);
}

// --- voiceControl: PLAYING BY SPEAKING, the quick bar's 👄 (ADR-0189, ADR-0193; issue #184). The child says a word of the
//     game and the position it names is pressed. ONE key for the whole engine, like the camera's: it describes the CHILD, and
//     a voice she has in one game she has in the next. Off by default, because it opens a MICROPHONE and nothing may do that
//     by itself; a stored value that is not a yes reads as off. ---
export let voiceControl: boolean = NULL_PORT.getBool('incl_voice_control', DEFAULTS.voiceControl);
export function setVoiceControlValue(on: boolean): void {
  const v = !!on;
  if (voiceControl === v) return;
  const p = portFor('setVoiceControlValue'); p.setBool('incl_voice_control', v); voiceControl = v; emit('voiceControl', v);
}

// --- cameraControl: playing through the webcam, the quick bar's 📷 (ADR-0215): off · hands · face · eyes, in that order. ONE key, so one
//     camera mode at a time holds by construction (ADR-0197); every playing position draws its lines. Kept on the device; a stored value
//     that is not a position reads as off, because the camera must never switch itself on. ---
export type CameraControl = 'off' | 'hands' | 'face' | 'eyes';
const CAMERA_CONTROLS: readonly CameraControl[] = ['off', 'hands', 'face', 'eyes'];
const cameraModeOf = (v: string | null): CameraControl => ((CAMERA_CONTROLS as readonly (string | null)[]).includes(v) ? v as CameraControl : 'off');
/** The next position of the 📷 cycle, wrapping back to off. */
export const nextCameraControl = (v: CameraControl): CameraControl => CAMERA_CONTROLS[(CAMERA_CONTROLS.indexOf(v) + 1) % CAMERA_CONTROLS.length]!;
export let cameraControl: CameraControl = cameraModeOf(NULL_PORT.get('incl_camera_control', DEFAULTS.cameraControl));
export function setCameraControlValue(v: CameraControl): void {
  const valid = cameraModeOf(v);
  if (cameraControl === valid) return;
  const p = portFor('setCameraControlValue'); p.set('incl_camera_control', valid); cameraControl = valid; emit('cameraControl', valid);
}

// --- gameSpeed: the game speed the quick bar's hourglass cycles (ADR-0180); `core/loop.startLoop` multiplies the frame time
//     by it. Stored and carried between games; a stored value outside the steps reads as 100%. ---
export let gameSpeed: number = isGameSpeed(NULL_PORT.getNum('incl_game_speed', DEFAULTS.gameSpeed));
export function setGameSpeedValue(v: number): void {
  const isValidSpeed = isGameSpeed(v);
  if (gameSpeed === isValidSpeed) return;
  const p = portFor('setGameSpeedValue'); p.set('incl_game_speed', isValidSpeed); gameSpeed = isValidSpeed; emit('gameSpeed', isValidSpeed);
}

// --- captionPpm: the child's caption reading rate, words a minute (ADR-0183 §4): how long a sound caption stays. One of
//     125, 145, 175; anything else reads as 125. ---
export let captionPpm: number = isCaptionRate(NULL_PORT.getNum('incl_caption_ppm', DEFAULTS.captionPpm));
export function setCaptionPpmValue(ppm: number): void {
  const isValidRate = isCaptionRate(ppm);
  if (captionPpm === isValidRate) return;
  const p = portFor('setCaptionPpmValue'); p.set('incl_caption_ppm', isValidRate); captionPpm = isValidRate; emit('captionPpm', isValidRate);
}

// --- speechPpm: the child's speech rate, words a minute (ADR-0183 §1; issue #179): each engine measures its voice and plays at
//     the ratio (`core/speech-rate`). One of 254…504 by 50; anything else reads as 254, the normal speed (ADR-0196). ---
export let speechPpm: number = isSpeechRate(NULL_PORT.getNum('incl_speech_ppm', DEFAULTS.speechPpm));
export function setSpeechPpmValue(ppm: number): void {
  const isValidRate = isSpeechRate(ppm);
  if (speechPpm === isValidRate) return;
  const p = portFor('setSpeechPpmValue'); p.set('incl_speech_ppm', isValidRate); speechPpm = isValidRate; emit('speechPpm', isValidRate);
}

/* ===================== THE STORED SETTINGS, LOADED BY THE ROOT (ADR-0178, issue #174) ===================== */


/**
 * The port for a write — or an error. ⚠️ A write before the load would put a default over what the child saved, and nobody
 * would see it; the error names the setter, so the root that calls it too early is found the first time it runs.
 */
function portFor(setter: string): StatePort {
  if (!port) throw new Error(`core/state: ${setter} wrote a setting before loadState — it would overwrite the child's stored choice; the composition root loads the settings first (ADR-0178)`);
  return port;
}

/**
 * Loads the child's stored settings into the bindings, and keeps the port for the setters. The composition root calls it
 * first (`createGame` does); calling it again reads again.
 */
export function loadState(p: StatePort): void {
  port = p;
  blindMode = p.getBool('incl_modocego', DEFAULTS.blindMode);
  letterCase = p.get(p.KEYS.letterCase, DEFAULTS.letterCase) === 'upper' ? 'upper' : 'mixed';
  captionsOn = p.getBool(p.KEYS.captions, DEFAULTS.captionsOn);
  menuIndexOn = p.getBool(p.KEYS.menuIndex, DEFAULTS.menuIndexOn);
  cbSafe = p.getBool(p.KEYS.cbsafe, DEFAULTS.cbSafe);
  ownerColors = p.getBool(p.KEYS.ownercolors, DEFAULTS.ownerColors);
  hcOutlineFg = toOutlineLevel(p.getNum(p.KEYS.outfg, DEFAULTS.hcOutlineFg));
  hcOutlineBg = toOutlineLevel(p.getNum(p.KEYS.outbg, DEFAULTS.hcOutlineBg));
  caneBlockDiv = p.getNum('incl_cane_div', DEFAULTS.caneBlockDiv) || DEFAULTS.caneBlockDiv;
  wheelchair = p.getBool('incl_wheelchair', DEFAULTS.wheelchair);
  oneButton = p.getBool('incl_onebtn', DEFAULTS.oneButton);
  gameSpeed = isGameSpeed(p.getNum('incl_game_speed', DEFAULTS.gameSpeed));
  noGripStrength = p.getBool('incl_sem_forca', DEFAULTS.noGripStrength);
  switchScan = p.getBool('incl_switch_scan', DEFAULTS.switchScan);
  voiceControl = p.getBool('incl_voice_control', DEFAULTS.voiceControl);
  cameraControl = cameraModeOf(p.get('incl_camera_control', DEFAULTS.cameraControl));
  captionPpm = isCaptionRate(p.getNum('incl_caption_ppm', DEFAULTS.captionPpm));
  speechPpm = isSpeechRate(p.getNum('incl_speech_ppm', DEFAULTS.speechPpm));
}
