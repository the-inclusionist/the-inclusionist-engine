// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-icons — the PER-SCREEN pause card (`.screen-pause`) and the accessibility quick bar (`.pi-btn`).
//
// WHY THE QUICK BAR IS ITS OWN MODULE: its buttons are the ONLY place where a state owned by another subsystem (blind
// mode, TTS, Libras, calm mode, the input mode, contrast, colour correction, camera, voice, speed, language) is both
// changed AND read back as an `aria-label`. That round-trip — «the label must tell the truth about the state» — is why
// `computeIconLabel` exists, and it is what the pure functions below make testable in node.
//
// Each icon's action is a row of a TABLE (`ICON_ACTS`), not a chain of `if`s: the list of subsystems is long by nature,
// one button each.
//
// INJECTED, not owned here:
//   · `setPauseActor` — who opened the card; the panels open scoped to that player. This module only WRITES it.
//   · `getPauseActs`  — the `.pm-btn` action table (`ui/shell` or the host's own), asked when an item is pressed, so it
//                       can be wired after this module.
//   · the pause screens, asked through a getter: the host rebuilds them when the number of screens changes.
//   · `rm`/`saveRM`   — the reduced-motion flags, shared with ui/settings-motion (same reference).
//   · `PM_BTNS` and the other lists of buttons are `ui/pause-buttons`', imported, never copied.


import type { PlayerView } from '../core/entity.js';
import type { NavKeys } from '../input/edges.js'; // the SAME intent the keyboard, controller, eyes and speech build
import { t, getLocale, setLocale } from '../core/i18n.js';
import { flagOf, nextLocale, LANGUAGE_NAME, type CycleLocale } from './locale-flags.js';
/*
 * 🔴 THE TWO VISUAL CYCLES MOVED HOUSE to `core/visual-cycles` (ADR-0221, issue #203). They lived in TWO modules — the list of
 * levels in the panel, the steps and the names here — and the thing that costs most to maintain is the ASYMMETRY between them,
 * which only reads with both in sight. See the header there.
 */
import { SHORT_THEME, SHORT_CORRECTION } from './visual-axes-panel.js';
/*
 * 🔴 CALM MODE MOVED HOUSE (ADR-0221, issue #203). It is not about ICONS: it is about what a child who cannot bear noise needs
 * the engine to silence, and the icon is only one of the surfaces she asks through. It lives in `core/calm-mode`, a leaf
 * module — zero imports, zero DOM — which is why the destructive clamp of level 1 can be measured without mounting anything.
 */
import { CALM_NAMES, CALM_AUDIO_CATS, nextCalmMode, sanitiseTeaLevel, calmAudioPlan, calmMotionPlan } from '../core/calm-mode.js';
/*
 * 🔴 THE MARKUP MOVED HOUSE to `ui/pause-markup` (ADR-0221, issue #203). Building the strings and wiring the elements the
 * browser makes from them are two jobs that do not need each other; what is left in this file is the second one. See the
 * header there for why the icon catalogue had to leave before the markup could.
 */
import {
  type PauseMenuButton, type PauseSub,
  quickBarMarkup, screenPauseMarkup,
} from './pause-markup.js';
/*
 * 🔴 THE ICON CATALOGUE MOVED HOUSE to `core/pause-icon-catalogue` (ADR-0221, issue #203): WHICH icons exist and in what order
 * is DATA, and this file is about what they DO. See the header there for why the data had to leave first.
 */
import { type PauseIcon, PAUSE_ICONS, pauseIcon } from '../core/pause-icon-catalogue.js';
import {
  nextTheme, nextCorrection, hasHighContrast, DEFAULT_VISUAL,
  type Theme, type Correction, type VisualState,
} from '../render/viz-axes.js';
import type { MotionSceneFlags, MotionSceneKey, MotionCharDef } from './settings-motion.js';
import type { AudioCatState } from './audio-choices.js';
import { announceItem } from './item-announcement.js';
import { accessibleLabel } from '../core/accessible-label.js';
import { stepInRing } from '../core/ring.js'; // from the LEAF, not from ui/menu-nav: see the note there
// A LIVE BINDING (ESM): the index can be turned off in the menu, and the value here follows without a subscription.
import { menuIndexOn, DEFAULTS, setBlindModeValue, gameSpeed, setGameSpeedValue, cameraControl, setCameraControlValue, nextCameraControl, voiceControl, setVoiceControlValue, switchScan, setSwitchScanValue, type CameraControl } from '../core/state.js';

/** The word for each position of the 📷 cycle (ADR-0215). */
const CAMERA_MODE_NAME: { readonly [M in CameraControl]: string } = { off: 'state.off', hands: 'camera.hands', face: 'camera.face', eyes: 'camera.eyes' };

/**
 * THE THREE POSITIONS OF ☝️ (ADR-0218): how the child's presses are read.
 *
 * They are not three settings but three READINGS of the same press, which is why one icon holds them and why they are shown as
 * one position. `standard` is the press as it arrives; `sticky` makes a tap last until the next one (ADR-0113); `scan` offers
 * the game's positions one at a time and lets any press take the one showing.
 */
export type InputMode = 'standard' | 'sticky' | 'scan';
/**
 * The word for each position. Private again since 2026-09-21: it was exported for the motor panel's row, and the Dev took that
 * row out («Tire a linha de acessibilidade motora») — the icon is the only surface of this setting now.
 */
const INPUT_MODE_NAME: { readonly [M in InputMode]: string } = { standard: 'input.standard', sticky: 'input.sticky', scan: 'input.scan' };

/**
 * Which of the three is showing. The SCAN WINS over the latch on purpose: with one button there is nothing to hold, so a stored
 * latch would otherwise make the icon claim a position the child is not in.
 */
export function inputModeOf(s: { readonly toggleMove?: boolean; readonly switchScan?: boolean }): InputMode {
  return s.switchScan ? 'scan' : s.toggleMove ? 'sticky' : 'standard';
}

/**
 * The next position. Two things take one away, and neither is an error to report — a cycle simply never stops where nothing
 * would happen (ADR-0155), and a word that promised what this game cannot do would teach a child that her setting is broken
 * (ADR-0106 §5):
 *
 * · A GAME THAT HOLDS NO KEY has nothing for the latch to hold, so the icon offers standard and one button.
 * · A DEVICE THAT SENDS ONE COMMAND AT A TIME always latches and cannot be asked not to (ADR-0113 clause 3, ADR-0211), so
 *   `standard` is unreachable there. 🔴 That used to grey the whole icon out, and with three positions that would have cost a
 *   child playing with her eyes the one-button scan as well — the lock is the latch's, not the scan's.
 */
function inputModeOrder(holdsKeys: boolean, latchRequired = false): readonly InputMode[] {
  if (!holdsKeys) return ['standard', 'scan'];
  return latchRequired ? ['sticky', 'scan'] : ['standard', 'sticky', 'scan'];
}

export function nextInputMode(m: InputMode, holdsKeys: boolean, latchRequired = false): InputMode {
  const order = inputModeOrder(holdsKeys, latchRequired);
  const i = order.indexOf(m);
  return order[(i < 0 ? 0 : i + 1) % order.length]!;
}

// The rule for applying an input mode is written in the icon's own action, where it happens: the ☝️ is the only surface of
// this setting.
import { nextGameSpeed } from '../core/game-speed.js';
// ⚠️ A DIRECT IMPORT of `platform/storage`, not one more piece of the ctx: an injected `store` is a field a host could
// omit, and omitting it would make the calm level stop persisting, silently. ADR-0232 moves storage to injection from the
// root (issue #207), and this import goes with it.
import * as store from '../platform/storage.js';
import { setMoveLatch } from './settings-mobility.js';
import { latchRefusal } from './latch-refusal.js';
import { PM_BTNS, PM_OPTIONS_BTNS, PM_GAME_BTNS } from './pause-buttons.js';
import { SCENE_KEYS, CHARACTER_ANIMATIONS, readStoredScene, storeScene } from './motion-scene.js';

/**
 * Hover and focus on a bar's icons write its NAME in the bar's `.pause-icons-cap` and ask for its EXPLANATION.
 *
 * Shared by the per-screen quick bars and the bar the engine mounts in `#title-icons`: two copies of this wiring is
 * how one bar showed the name and the other did not — the Dev found the engine's bar silent on hover and on the
 * cursor. Leaving an icon falls back to the CURSOR of the bar's mode when there is one (`.pi-sel`): it is the only
 * thing saying where that cursor is.
 */
export function wireBarCaption(bar: HTMLElement, explain: (k: string | null) => void): void {
  const cap = bar.querySelector('.pause-icons-cap');
  const captionFor = (b: HTMLElement): void => {
    if (cap) cap.textContent = accessibleLabel(b); // name and state only: «N de M» is spoken, never written (ADR-0167)
    explain(b.dataset.pi ?? null);
  };
  const restoreCaption = (): void => {
    const cursor = bar.querySelector<HTMLElement>('.pi-sel');
    if (cursor) { captionFor(cursor); return; }
    if (cap) cap.textContent = '';
    explain(null);
  };
  bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => {
    b.addEventListener('mouseenter', () => captionFor(b));
    b.addEventListener('focus', () => captionFor(b));
    b.addEventListener('mouseleave', restoreCaption);
    b.addEventListener('blur', restoreCaption);
  });
}

/**
 * What an icon of the quick bar SAYS — one function, not three copies of the same expression. It is spoken at moments
 * that look different and are the same (the cursor lands on the icon, a finger activates it), and the `aria-label` it
 * reads already carries the STATE («Alto contraste, ativado»): `reflectIconBtn` rewrites it on every change, which is why
 * this reads it back instead of rebuilding the text.
 */
function iconCaption(barEl: ParentNode, el: HTMLElement): string {
  const icons = [...barEl.querySelectorAll<HTMLElement>('.pi-btn')];
  // «A declared label wins» is `core/accessible-label`'s rule, shared with the pause list and every menu: one answer to
  // «what is this control called».
  return announceItem(
    { label: accessibleLabel(el), position: icons.indexOf(el) + 1, total: icons.length },
    menuIndexOn,
  );
}

/** Reads the calm level from storage, sanitised. Called in `init`, never on import. */
function readTeaLevel(): number {
  return sanitiseTeaLevel(store.getNum(store.KEYS.tea, DEFAULTS.calmMode), DEFAULTS.calmMode);
}

// ---------------------------------------------------------------------------------------------
// Shapes this module reads but does not own
// ---------------------------------------------------------------------------------------------

/**
 * The slice of a player the pause icons touch — derived from core/entity, and WITHOUT an index signature: one would
 * accept ANY property with an `unknown` value, so a typo in any field would compile silently. `applyCalm` writes by a
 * computed name (`p[c.prop] = …`), and `c.prop` is the literal union `'rmWalk' | 'rmBreath' | 'rmFlavor'`, which TypeScript
 * checks without any signature.
 */
export type PausePlayer = PlayerView<'visual' | 'toggleMove' | 'walkDir' | 'audioSink' | 'rmWalk' | 'rmBreath' | 'rmFlavor'>;


// ---------------------------------------------------------------------------------------------
// PURE LOGIC — no `document`, no ctx. This is the half that carries the accessibility contract.
// ---------------------------------------------------------------------------------------------

/** Everything the label/visual of ONE icon depends on, gathered in one value. */
export interface IconStateSnapshot {
  blindMode: boolean;
  ttsOn: boolean;
  librasOn: boolean;
  calmMode: number;
  toggleMove: boolean;
  /**
   * The visual state on TWO AXES (#104): the contrast icon cycles the theme and the colour icon cycles the correction,
   * each within its own axis, and neither erases the other.
   */
  visual: VisualState;
  /** Playing by SPEAKING (ADR-0189): the 👄 of the bar, on or off. */
  voice?: boolean;
  /** Playing with ONE button (ADR-0218): the third position of ☝️, which wins over the latch when it is on. */
  switchScan?: boolean;
  /** The game speed (ADR-0180), a step of `core/game-speed`; absent reads as 100%. */
  speed?: number;
  /** Playing through the webcam (ADR-0215); absent reads as off. */
  camera?: CameraControl;
  /** The current locale (`core/i18n`), for the language button. */
  locale?: string;
  /** False disables the blind/TTS icons: those need an audio output nobody else is listening to. */
  privateOutput: boolean;
  /**
   * Does the device in use REQUIRE the latch? (ADR-0113 clause 3.) With the eyes, the face, gestures and speech the latch
   * is what makes the input work, so there is no choice to offer: the ☝️ cycle then skips `standard` (see
   * `inputModeOrder`).
   *
   * OPTIONAL because adding a required member to a published snapshot is a breaking change (the shape gate,
   * `tests/superficie-publica`, fails on it). Absent means «nobody told me», which degrades to «not required».
   */
  latchRequired?: boolean;
  /** No voice speaks the current language (ADR-0185): the narration icon is locked. Absent reads as a voice. */
  noVoice?: boolean;
}

/** A player has private output when nobody else is on the same sink. Single screen ⇒ always private. */
export function hasPrivateOutputIn(list: readonly PausePlayer[], count: number, i: number): boolean {
  if (count <= 1) return true;
  const p = list[i];
  if (!p || !p.audioSink) return false;
  return !list.some((q, j) => j !== i && q && q.audioSink === p.audioSink);
}

/** The `aria-label` of one icon — it MUST reflect the current state, on/off or level. This is the whole
 *  point of the function: a toggle that looks pressed but does not say so is invisible to a screen reader. */
export function computeIconLabel(k: string, s: IconStateSnapshot): string {
  const ic = pauseIcon(k);
  if (!ic) return '';
  const state = STATE_OF_ICON[k];
  // The state is ALWAYS a parameter (`{v}`), never a concatenation: a language that puts the state before the name needs
  // the dictionary to reorder it. «name: state» is the frame; the state is the content, and it is translated too.
  return state ? t('icon.state', { nome: t(SHORT_NAME[k] ?? ic.n), v: state(s) }) : t(ic.n);
}

const onOff = (on: boolean | undefined): string => t(on ? 'state.on' : 'state.off');

/** What each icon with a state says after its name, already in the child's language. An icon not here has no state to say. */
const STATE_OF_ICON: { readonly [k: string]: (s: IconStateSnapshot) => string } = {
  blind: (s) => onOff(s.blindMode),
  tts: (s) => onOff(s.ttsOn),
  libras: (s) => onOff(s.librasOn),
  tea: (s) => t(CALM_NAMES[s.calmMode]!),
  altmove: (s) => t(INPUT_MODE_NAME[inputModeOf(s)]),
  contrast: (s) => t(SHORT_THEME[s.visual.tema]),
  cvd: (s) => t(SHORT_CORRECTION[s.visual.correcao]),
  camera: (s) => t(CAMERA_MODE_NAME[s.camera ?? 'off']),
  voice: (s) => onOff(s.voice),
  // a language's own name is not translated: «Español» reads the same in every interface
  idioma: (s) => LANGUAGE_NAME[(s.locale ?? 'pt') as CycleLocale] ?? LANGUAGE_NAME.pt,
  velocidade: (s) => t('icon.velocidade.valor', { pct: Math.round((s.speed ?? 1) * 100) }),
};

/**
 * Calm mode and colour correction have a SHORT name key for the label, because the button's name once carried the list of
 * levels («(calmo / silencioso)», «(protan/deutan/tritan)») and the label already says the level. ⚠️ In the three
 * dictionaries the short key now equals the long one word for word: the distinction has no subject left, and merging the
 * keys is a dictionary change.
 */
const SHORT_NAME: { readonly [k: string]: string } = { tea: 'icon.tea.short', cvd: 'icon.cvd.short' };

/** The visual state of one icon button. `active` is what becomes `aria-pressed`. */
export interface IconVisual {
  /** `.pi-on` — the yellow "this is on" state. */
  on: boolean;
  /** `.pi-dis` — greyed out (blind/TTS without a private audio output). */
  dis: boolean;
  /** `.pi-calm` — TEA level 1 only (white); level 2 uses `.pi-on` instead. */
  calm: boolean;
  /** `.pi-cvd-protan` | `.pi-cvd-deuter` | `.pi-cvd-tritan`, or '' — the two-tone background IS the on-signal. */
  cvd: string;
  /** aria-pressed: on OR calm OR a CVD tint. */
  active: boolean;
}

/**
 * WHAT EACH ICON SHOWS, AS A TABLE — one rule per icon, each returning only what it decides. A decision that is a mapping
 * is written as a table here (as the glyph of a key or the edge of an action are): adding an icon is adding a ROW, not
 * nesting one more `else if`.
 */
type IconVisualRule = (s: IconStateSnapshot) => Partial<IconVisual>;

const ICON_VISUAL: Readonly<Record<string, IconVisualRule>> = Object.freeze({
  blind: (s) => ({ on: s.blindMode, dis: !s.privateOutput }),
  tts: (s) => ({ on: s.ttsOn, dis: !s.privateOutput || !!s.noVoice }),
  libras: (s) => ({ on: s.librasOn }),
  tea: (s) => ({ on: s.calmMode === 2, calm: s.calmMode === 1 }),
  // ⚠️ AND IT IS NEVER GREYED OUT. `latchRequired` says the DEVICE in use sends one command at a time and the latch cannot be
  // turned off (ADR-0113 clause 3) — which the CYCLE tells, since `standard` simply does not appear in it. Greying the icon
  // would take the one-button scan away from the child playing with their eyes, who is the likeliest to need it.
  altmove: (s) => ({ on: inputModeOf(s) !== 'standard' }),
  contrast: (s) => ({ on: hasHighContrast(s.visual) }),
  velocidade: (s) => ({ on: (s.speed ?? 1) < 1 }),
  camera: (s) => ({ on: (s.camera ?? 'off') !== 'off' }),
  voice: (s) => ({ on: !!s.voice }),
  // ⚠️ THE TWO-TONE BACKGROUND IS THIS ICON'S «ON» SIGNAL, and it reads the correction AXIS — so it still says the same when
  // the high-contrast theme is on too, and the child's correction does not vanish from the icon that exists to show it.
  cvd: (s) => ({ cvd: s.visual.correcao !== 'tricro' ? `pi-cvd-${s.visual.correcao}` : '' }),
});

/** At rest: an icon the table does not name shows nothing. */
const ICON_VISUAL_AT_REST: IconVisual = Object.freeze({ on: false, dis: false, calm: false, cvd: '', active: false });

/** Pure form of reflectIconBtn's branching. */
export function computeIconVisual(k: string, s: IconStateSnapshot): IconVisual {
  const v = { ...ICON_VISUAL_AT_REST, ...ICON_VISUAL[k]?.(s) };
  // 📌 `active` is DERIVED, declared by no rule: it is the `aria-pressed`, and no icon should be able to say it is pressed
  // without showing why.
  return { ...v, active: v.on || v.calm || !!v.cvd };
}

/** The CSS classes reflectIconBtn clears before applying a fresh visual — in the original order. */
export const ICON_STATE_CLASSES: readonly string[] = ['pi-calm', 'pi-cvd-protan', 'pi-cvd-deuter', 'pi-cvd-tritan'];


/**
 * THE ICONS THIS GAME CAN ACTUALLY ACTIVATE (ADR-0106 §5): no stage may ship a dead button — «a bar that offers a child a
 * way and then refuses it is worse than a bar she sees is not there, because the first teaches her the way is not for
 * her». An icon with nothing to activate it is not mounted, rather than mounted to announce «soon».
 */
export interface ActionableIcons {
  /** Is there anyone to write the THEME (high contrast)? Without it, the `contrast` icon is not mounted. */
  readonly theme: boolean;
  /** Is there anyone to write the colour CORRECTION? Without it, the `cvd` icon is not mounted. */
  readonly correction: boolean;
  /**
   * DOES THIS GAME HOLD ANY KEY? — `GameDeclaration.holdsKeys`, the field of ADR-0115.
   *
   * The latch exists for whoever cannot keep a key pressed; in a game where nothing is held it has nothing to hold, and a
   * control that does nothing teaches a child that the setting she depends on is broken. (A different absence from
   * ADR-0113 clause 3's, where the device REQUIRES the latch: see `latchRequired`.)
   *
   * A FUNCTION, not a value (as in ADR-0084): an answer read once goes stale silently, and with one `createGame` serving
   * several cartridges (ADR-0142) the icon would describe the game that booted first.
   */
  readonly holdsKeys: () => boolean;
  /**
   * HOW MANY POSITIONS THIS GAME DECLARED (`CreateGameOptions.preset`, ADR-0162) — what a scan would have to offer (ADR-0218).
   * A function like its neighbour, so a cartridge mounted later answers for itself (ADR-0142); absent reads as none.
   */
  readonly declaredPositions?: () => number;
  /**
   * Does this game's time run by itself? (`tick: 'clock'`, ADR-0180.) Without it the hourglass is not mounted. A function,
   * like `holdsKeys`, so a cartridge mounted later answers for itself (ADR-0142).
   */
  readonly clock?: () => boolean;
  /**
   * Does anyone know how to walk the typography cycle? (ADR-0149 §1.)
   *
   * OPTIONAL, absent meaning `false` — unlike `holdsKeys`, which is required because both of its values can be wrong.
   * Here `false` hides an icon that would do nothing, which is exactly what ADR-0106 §5 wants.
   */
  readonly typography?: boolean;
  /** Can this device play through the webcam — is there a camera to ask for? Without it the 📷 is not mounted (ADR-0215). */
  readonly camera?: boolean;
  /** Is there a microphone to ask for? Without one the 👄 is not mounted. */
  readonly microphone?: boolean;
  /** Is there a card of menus to open? Without it the ☰ is not mounted. */
  readonly menus?: boolean;
}

/**
 * @deprecated The name said «VISUAL writers», and the question stopped being only visual when `holdsKeys` joined it
 * (ADR-0115). Use `ActionableIcons`.
 */
export type VisualWriters = ActionableIcons;

/**
 * WHO ACTIVATES EACH ICON — one question per icon, and an icon nothing locks is offered.
 *
 * PER ICON, not one flag for the whole bar: with one flag, a single missing writer would either hide an icon that WORKS
 * or show one that does NOT. The question is «does this ICON have something to activate it». A table, so adding an icon
 * is adding a row.
 */
const ICON_IS_ACTIONABLE: Readonly<Record<string, (w: ActionableIcons) => boolean>> = Object.freeze({
  contrast: (w) => w.theme,
  cvd: (w) => w.correction,
  // «Does this game hold keys?» is the same question, asked of a contract field rather than an injected writer.
  // AND A SECOND HALF (ADR-0218): «one button only» has a subject wherever the game declares a position to scan, so a game
  // holding no key (the quiz demo) still has a ☝️. A game that declares nothing has none: a scan of nothing is the dead
  // button of ADR-0106 §5 paid for in seconds.
  altmove: (w) => w.holdsKeys() || (w.declaredPositions?.() ?? 0) > 0,
  // The same question asked of the typography cycle (ADR-0149): the icon exists when someone knows how to walk it.
  // `Boolean(...)` and not the raw field: it is optional, and the conversion is written rather than left to a `filter`.
  tipografia: (w) => Boolean(w.typography),
  // the hourglass exists where time runs by itself (ADR-0180): a turn game has nothing to slow
  velocidade: (w) => Boolean(w.clock?.()),
  camera: (w) => Boolean(w.camera),
  // 👄 exists where there is a MICROPHONE to ask for, the same rule as the camera's (ADR-0106 §5)
  voice: (w) => Boolean(w.microphone),
  menu: (w) => Boolean(w.menus),
});

export function iconsThatAct(writers: ActionableIcons): readonly PauseIcon[] {
  // ABSENCE FROM THE TABLE MEANS YES: an icon no rule locks depends on nobody to work, and hiding it for lack of a row
  // would take away from the child a way that exists.
  return PAUSE_ICONS.filter((ic) => ICON_IS_ACTIONABLE[ic.k]?.(writers) ?? true);
}

/**
 * THE ITEMS THE ENGINE ACTIVATES BY ITSELF, which therefore never depend on a game's `getPauseActs`. Read from the
 * dispatch, not decided here: `options`, `opcoesdojogo` and `pmback` change which list is on the card, and
 * `acessibilidade` takes the cursor to the quick bar — all four are handled in this module before the game's table is
 * consulted. What belongs to the game is the CONTENT of the list `opcoesdojogo` opens.
 */
const ENGINE_ITEMS: ReadonlySet<string> = new Set(['options', 'opcoesdojogo', 'pmback', 'acessibilidade']);

/**
 * Why a pause item is locked, in the child's words (ADR-0161). A key per item where the reason is particular to it —
 * «Número de jogadores»: the GAME decides how many (ADR-0147) — and one general reason for the rest. Resolved at every
 * refresh, so it follows the language of the moment the card opens.
 */
const OWN_REASONS: ReadonlySet<string> = new Set(['ajuda', 'addplayer', 'opcoesdojogo']);
function itemReason(act: string): string {
  return t(OWN_REASONS.has(act) ? `pause.motivo.${act}` : 'pause.motivo');
}

/**
 * THE MENU ITEMS THIS GAME CAN ACTUALLY ACTIVATE. The others are not hidden: they stay on the card, LOCKED with their
 * reason said (ADR-0161) — an item that does nothing when pressed, and says nothing, reads to a screen-reader user as an
 * item that does not exist.
 */
function itemsThatAct(
  buttons: readonly PauseMenuButton[],
  acts: Record<string, (() => void) | undefined>,
): readonly PauseMenuButton[] {
  return buttons.filter((b) => ENGINE_ITEMS.has(b.act) || typeof acts[b.act] === 'function');
}

/**
 * THE ROOT LIST, with one more rule: `options` is a DOOR, and a door to an empty room acts no more than a dead button.
 * An item-by-item filter misses this: the engine activates `options` itself, so it would pass and open a list with
 * nothing in it.
 */
export function rootThatActs(
  rootEl: readonly PauseMenuButton[],
  options: readonly PauseMenuButton[],
  acts: Record<string, (() => void) | undefined>,
  // An OPTIONAL fourth argument defaulting to the EMPTY list: a game that declares nothing of its own is exactly that
  // case, so the default is also the right answer.
  fromGame: readonly PauseMenuButton[] = [],
): readonly PauseMenuButton[] {
  const howManyAct = (bs: readonly PauseMenuButton[]): number =>
    itemsThatAct(bs, acts).filter((b) => b.act !== 'pmback').length;
  let alive = itemsThatAct(rootEl, acts);
  if (howManyAct(options) === 0) alive = alive.filter((b) => b.act !== 'options');
  // The same rule for the game's own door (ADR-0146): a game with nothing of its own gets no live «game options».
  // ADR-0182: a door whose room the ENGINE draws from the cartridge's rows is live through its action, with no list behind it
  if (howManyAct(fromGame) === 0 && typeof acts.opcoesdojogo !== 'function') alive = alive.filter((b) => b.act !== 'opcoesdojogo');
  return alive;
}


/**
 * The navigable items of a pause card — those of the VISIBLE list, and only those.
 *
 * One constant because THREE modules ask (navigation in `ui/menu-nav`, the first selection in `ui/shell` and the list
 * switch here): if one of them forgot `:not([hidden])`, the ring would step into the invisible list and the child would
 * hear items of a menu that is not on screen. `:not([hidden])` on the ITEM too: a hidden item must not be reached nor
 * counted in «N de M» (a locked one is not hidden — it is reached, and says why).
 */
export const PM_VISIBLE_ITEMS = '.pause-menu:not([hidden]) .pm-btn:not([hidden])';


/**
 * THE DOORS INSIDE THE CARD, and which list each opens. They do nothing to the game — they change which list is on
 * screen — so they live here and not in the action table, which lives in `ui/shell` and does not know the card.
 * `pmback` always returns to the ROOT, from either list. A table and not a chain of `if`s: a fourth list is one more
 * row, not one more branch.
 */
const DOOR_TO_LIST: Readonly<Record<string, PauseSub>> = Object.freeze({ options: 'opcoes', opcoesdojogo: 'jogo', pmback: 'raiz' });

/**
 * Switches the visible list of ONE pause card, and puts the cursor on the FIRST item of the list that came in.
 *
 * Free-standing (not a method of `init`) on purpose: `ui/menu-nav` needs it for «no» to go back to the root, and it has no
 * access to the button tables. Every list already exists in the markup, so the switch is DOM only.
 */
export function showPauseOptions(sp: HTMLElement, sub: PauseSub): HTMLElement | null {
  sp.querySelectorAll<HTMLElement>('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
  const first = sp.querySelector<HTMLElement>(PM_VISIBLE_ITEMS);
  sp.querySelectorAll<HTMLElement>('.pm-sel,.pi-sel').forEach((b) => b.classList.remove('pm-sel', 'pi-sel'));
  if (first) first.classList.add('pm-sel');
  return first;
}


/**
 * WHAT AN INTENT MEANS INSIDE THE `accessibility` MODE (ADR-0044 item 7).
 *
 * The record lists this mode among the decision's NEGATIVE consequences, and says why: a mode one enters and does not
 * know how to leave is the very trap the record is about — so its way out (START or BACK) is part of the decision.
 *
 * Hence the shape: LEAVING comes first, through TWO doors. BACK is the way out of everything in the game, the one a child
 * who knows it tries first; START is the button that OPENS the pause, and the pause is where this mode was entered from —
 * whoever gets lost tries to go back the way they came. One door only would be betting that the child guesses which.
 *
 * The precedence is a decision too: a controller can report more than one edge in the same frame (fingers press
 * together), and in that frame leaving must not come after activating.
 */
export type BarAction = 'sair' | 'ativar' | 'andar' | 'nada';
export function barAction(k: NavKeys, hasStart: boolean): BarAction {
  if (hasStart || k.no) return 'sair';
  if (k.yes) return 'ativar';
  if (k.up || k.down || k.left || k.right) return 'andar';
  return 'nada';
}


// ---------------------------------------------------------------------------------------------
// Injection contract
// ---------------------------------------------------------------------------------------------

export interface PauseIconsCtx {
  /**
   * The DOCUMENT where the pause card and the bar are BUILT. Absent, the global one (ADR-0232 is to remove that fallback).
   * `createGame` receives its document through `host.doc` and may be building in another one (an iframe, an editor beside
   * the game), so building on the global would put the card in the wrong document.
   */
  doc?: Document;
  /** How many players/screens. ROUND state (ADR-0038): it comes from the instance the host owns — a module-level
   *  binding would be shared by a second game on the same page. */
  getNumPlayers: () => number;
  /** The players. ROUND state, for the same reason. `readonly unknown[]` because each consumer narrows to ITS slice —
   *  the real type is the game's, not the engine's (ADR-0033). */
  getPlayers: () => readonly unknown[];
  // --- announcements (core/a11y-sr; injected because they reach `document` at call time) ---
  /** aria-live "polite" — every successful toggle announces its NEW state. */
  srSay: (text: string) => void;
  /** aria-live "assertive" — the refusals (a shared audio output, a device that always latches). */
  srAlert: (text: string) => void;
  /**
   * Called after EVERY exit from the bar mode, with the screen and whether it was silent. Absent, nothing happens. It lets
   * the root unfreeze the game whichever door was used (ADR-0155) — the bar knows nothing of phases.
   */
  onLeaveBar?: (i: number, silent: boolean) => void;
  /**
   * The icon screen `i` is pointing at — by the cursor of the bar, or hover/focus — or `null` when nothing is. The
   * root writes that icon's EXPLANATION in the footer (the Dev: the name below the row, what it does in the footer;
   * `CLAUDE.md` §4, the three zones). Absent, the bar still shows the name.
   */
  explainIcon?: (i: number, k: string | null) => void;
  /** A text for the screen footer — the reason of a locked pause item (ADR-0161) — or `null` to clear it. */
  explainItem?: (text: string | null) => void;

  // --- the per-screen pause menu ---
  /**
   * The per-screen QUICK BARS (`.screen-a11y`), in player order. A getter, because the host rebuilds them when the number of
   * screens changes. Separate from the pause card because the bar does not live inside it (ADR-0044 item 7) — colour
   * correction is PER PLAYER, and reflecting the icons means finding that screen's bar.
   */
  getA11yBars: () => readonly HTMLElement[];
  /*
   * The lists of buttons are OPTIONAL (ADR-0106 §4): they belong to the engine (`ui/pause-buttons`), and asking a game to
   * hand them back would be asking it for something it does not own — «the engine ships a default list, so that a game
   * that contributes nothing has one». Absent, `PM_BTNS` / `PM_OPTIONS_BTNS` / `PM_GAME_BTNS`; a host that passes its own
   * still rules.
   */
  /** PM_OPTIONS_BTNS — the options sub-list. */
  optionsButtons?: readonly PauseMenuButton[];
  /** The GAME's list (ADR-0146). Absent = `PM_GAME_BTNS`, which is only «back» — and the door drops by itself. */
  gameButtons?: readonly PauseMenuButton[];
  /** PM_BTNS — the root `.pm-btn` list (`ui/pause-buttons`). */
  pmButtons?: readonly PauseMenuButton[];
  /*
   * The next three are the GAME's by nature, and still optional: being the game's by nature says WHO has the right answer,
   * not that its absence should stop the card from existing. Absent: `dynLabel` means no dynamic label, `getPauseActs`
   * means an empty table (only the items the ENGINE activates act; the rest are locked with their reason) and
   * `setPauseActor` records nothing.
   */
  /**
   * The ready LABEL of a dynamic button, or `null` when that button has none. A function, because the label changes at run
   * time — in value and in language. A pause card of the ENGINE does not know what a literacy level is, nor how to say it.
   */
  dynLabel?: (b: PauseMenuButton) => string | null;
  /** The `.pm-btn` action table, asked when an item is pressed (so it can be wired after this module). */
  getPauseActs?: () => Record<string, (() => void) | undefined>;
  /** Records which player opened the card; the panels open scoped to that player. */
  setPauseActor?: (i: number) => void;

  // --- blind mode (the host owns `blindMode`, its persistence and whatever it rebuilds) ---
  getBlindMode: () => boolean;
  setBlindMode?: (on: boolean) => void;

  // --- TTS (platform/audio mixer; the panel refresh lives in ui/settings-audio) ---
  /**
   * The mixer by category. NULL until `initAudioMixer()`: `platform/audio`'s import is PURE (it reads no storage), and the
   * host's boot initialises it.
   */
  getAudioCat: () => Record<string, AudioCatState> | null;
  /** Re-applies a category's gain node after `on`/`vol` changed. */
  setCatGain: (k: string) => void;
  /** Repaints the TTS row of the auditory panel after the icon changes it. */
  reflectTtsPanel: () => void;
  /** Whether the TTS icon also calls `reflectTtsPanel`. `createGame` passes `true`; `false` leaves the panel as it was. */
  reflectTtsPanelEnabled: boolean;

  // --- Libras (ui/vlibras; both reach `document` at call time) ---
  isLibrasOn: () => boolean;
  toggleLibras: () => void;

  // --- TEA / reduced motion (the `rm` object is co-owned with ui/settings-motion — same reference) ---
  /*
   * OPTIONAL, as in `SettingsMotionCtx`: the same four questions in two places must have the same answer. Absent, what
   * `ui/motion-scene` knows is used.
   */
  rm?: MotionSceneFlags;
  rmKeys?: readonly MotionSceneKey[];
  rmChar?: readonly MotionCharDef[];
  saveRM?: () => void;

  // --- mobility + visual (each writes state that the host may also redraw from) ---
  setToggleMove?: (i: number, on: boolean) => void;
  /**
   * WHICH DEVICE THIS PLAYER IS USING (ADR-0113). The `altmove` icon is the OTHER surface that writes the latch, besides
   * the panel: without this it would write a different key from the panel's, and the two surfaces would disagree silently.
   */
  transportInUse?: (player: number) => string;
  setPlayerViz?: (i: number, mode: string) => void;
  /** The writers PER AXIS (#104): changing the theme does not erase the correction, and vice versa. */
  setPlayerTheme?: (i: number, theme: Theme) => void;
  setPlayerCorrection?: (i: number, correction: Correction) => void;
  /**
   * MOVES ONE STEP IN THE TYPOGRAPHY CYCLE and returns the face it landed on (ADR-0149 §1). ONE field, not two (read and
   * write): the position belongs to whoever keeps the cycle; this module only needs the face's NAME to announce it.
   * ABSENT = THE ICON IS NOT MOUNTED (ADR-0106 §5).
   */
  cycleTypography?: () => string | null;
  /**
   * DOES THIS GAME HOLD ANY KEY? — `GameDeclaration.holdsKeys` (ADR-0115). Without it the `altmove` icon is not mounted.
   *
   * ⚠️ REQUIRED, against ADR-0106's direction of making this ctx's fields optional: the fields that got a default have a
   * SAFE one (blind mode starts off, the button lists come from the engine). This one has none — `true` mounts a control
   * that may do nothing, `false` hides one a child depends on. Both are wrong, which is the same reason `holdsAtOnce` is
   * required. Whoever goes through `createGame` never writes it: the root reads the declaration. A FUNCTION, not a value
   * (see `ActionableIcons.holdsKeys`): a cartridge wiring this itself passes `() => declaration.holdsKeys()`.
   */
  holdsKeys: () => boolean;
  /** How many positions the current game declared — what «one button only» would scan (ADR-0218). Absent reads as none. */
  declaredPositions?: () => number;
  /** Does the current game's time run by itself? (ADR-0180: the hourglass.) Optional; absent, no hourglass. */
  clock?: () => boolean;
  /** Can this device play through the webcam? (ADR-0215: the 📷.) Optional; absent, no 📷. */
  camera?: boolean;
  /** Can this device hear the child — is there a microphone to ask for? (issue #184: the 👄.) Absent, no 👄. */
  microphone?: boolean;
  /** Opens the menus of seat `i`, as SELECT does (the ☰). Optional; absent, no ☰. */
  openMenus?: (i: number) => void;
  /** Does no voice speak the current language? (ADR-0185: the narration icon locks.) Optional; absent, a voice. */
  noVoice?: () => boolean;
}

export interface PauseIconsApi {
  /** Builds one `.screen-pause` (hidden), wired for click + hover/focus caption. Caller appends it. */
  buildScreenPause: (i: number) => HTMLElement;
  /** Builds screen `i`'s QUICK BAR (`.screen-a11y`), already wired. Called by ui/hud.ts, one per screen. */
  buildQuickBar: (i: number) => HTMLElement;
  /**
   * THE ICONS THIS INSTANCE MOUNTS — already filtered by ADR-0106 §5. It exists so the bar the root mounts in
   * `#title-icons` (which cannot use `buildQuickBar`: that one sets `tabIndex = -1`, for a game in play) does not repeat
   * the filter — a second copy of the same decision.
   */
  mountedIcons: readonly PauseIcon[];
  /** ENTERS screen `i`'s `accessibility` mode — the bar half of the quick pause (ADR-0155). Does not touch the phase. */
  enterBar: (i: number) => void;
  /** LEAVES the mode and gives the d-pad back to the character. `silent` = leaving for another screen, not for the game. */
  leaveBar: (i: number, silent?: boolean) => void;
  /** Is screen `i`'s d-pad on the BAR instead of on the character? Asked every frame. */
  onBar: (i: number) => boolean;
  /** One step inside the mode. `hasStart` is the pause button's edge — the second way out (ADR-0044 item 7). */
  navBar: (i: number, k: NavKeys, hasStart?: boolean) => void;
  /** Runs the icon `k` for screen `i`. Does NOT reflect — callers reflect after. */
  iconAct: (k: string, i: number) => void;
  /** The state-reflecting `aria-label` of icon `k` for screen `i`. */
  iconLabel: (k: string, i: number) => string;
  /** Applies classes + aria-pressed + aria-label to ONE `.pi-btn`. */
  reflectIconBtn: (b: HTMLElement, i: number) => void;
  /** Reflects every `.pi-btn` inside `root` in screen `i`'s scope. `#title-icons` uses i=0 (splash = J1). */
  reflectIconsIn: (root: ParentNode | null, i: number) => void;
  /** Reflects every pause screen (each in its own player's scope). */
  reflectPauseIcons: () => void;
  /** Applies the current TEA level to scene motion, character motion and the five audio categories. */
  applyCalm: () => void;
  getCalmMode: () => number;
  /** Sets the TEA level WITHOUT applying it (applyCalm is the apply step) — for tests and future restore. */
  setCalmMode: (n: number) => void;
  /** Snapshot of everything the label/visual of screen `i` depends on. Exposed for tests and debugging. */
  iconState: (i: number) => IconStateSnapshot;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing shell
// ---------------------------------------------------------------------------------------------

export function initPauseIcons(ctx: PauseIconsCtx): PauseIconsApi {
  // THE CALM LEVEL PERSISTS (issue #61; ADR-0028: every menu setting persists). The child who uses the SILENT mode is the
  // one for whom unexpected noise costs most, and a setting that is forgotten is a daily chore, not a setting.
  //
  // READ IN INIT, NEVER ON IMPORT: a test importing this module would otherwise depend on the environment's storage, and a
  // level inherited from another case is a failure that shows up far from its cause.
  let calmMode = readTeaLevel();

  const P = (): readonly PausePlayer[] => ctx.getPlayers() as readonly PausePlayer[];

  /*
   * THE MOVEMENT LATCH HAS AN ENGINE DEFAULT (ADR-0106 §4): a host that injects one still rules; a host that does not is
   * no longer left without it. The `store` is this module's direct import (see the note at the import).
   */
  const setToggleMove = ctx.setToggleMove
    ?? ((i: number, on: boolean) => setMoveLatch(
      {
        players: P(), store, srSay: ctx.srSay, getNumPlayers: ctx.getNumPlayers,
        // Passed through, not resolved here: the icon and the panel must write the SAME thing, and resolving the
        // device in one of them only is how two surfaces of the same engine come to disagree.
        transportInUse: ctx.transportInUse,
      }, i, on));

  /*
   * BLIND MODE LIKEWISE: the default is exactly what `core/state` decided a setter does — write, persist, notify — and
   * nothing more. Game effects are REACTIONS, subscribed with `on('blindMode', …)`. The announcement is not lost for a host
   * that injects nothing: this icon says `sr.icon.blindOn`/`Off` itself, below.
   */
  const writeBlindMode = ctx.setBlindMode ?? setBlindModeValue;

  /** The document to build in. Resolved on each use, through `globalThis` — in node the `document` identifier does not
   *  even exist, and a `??` on it would throw a ReferenceError instead of falling back. */
  const mountDoc = (): Document => ctx.doc ?? (globalThis as { document?: Document }).document as Document;

  /*
   * CONTRAST AND COLOUR ONLY APPEAR IF SOMEONE CAN WRITE THEM (ADR-0106 §5): the theme and the correction are written by
   * the host (`setPlayerTheme`/`setPlayerCorrection`), and without a writer the engine does not pretend.
   *
   * Decided once, at start, not per bar: a host's set of writers does not change mid-game, and recomputing per screen
   * would let the screens disagree.
   */
  const gameIcons = iconsThatAct({
    theme: Boolean(ctx.setPlayerTheme),
    correction: Boolean(ctx.setPlayerCorrection),
    // No `Boolean(...)`: the two above ask an optional field «is there a writer?»; this is an ANSWER the game gave, and
    // wrapping it would turn a badly wired ctx's `undefined` into `false` — hiding the control silently.
    holdsKeys: ctx.holdsKeys,
    // the same question the scan asks (ADR-0218): how many positions this game would give it to offer
    declaredPositions: ctx.declaredPositions,
    typography: Boolean(ctx.cycleTypography),
    // mounted when the root can answer the clock question; shown or hidden per cartridge in `reflectIconBtn` (ADR-0142)
    clock: () => Boolean(ctx.clock),
    camera: Boolean(ctx.camera),
    microphone: Boolean(ctx.microphone),
    menus: Boolean(ctx.openMenus),
  });

  /*
   * RESOLVED ONCE, at start, as in `settings-motion`: `rm` is mutated in place and shared by REFERENCE with whoever draws
   * the scene, and resolving it on each use would make a new object per call — the switch would stop reaching the drawing,
   * with no error at all.
   */
  const rm: MotionSceneFlags = ctx.rm ?? readStoredScene();
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? SCENE_KEYS;
  const rmChar: readonly MotionCharDef[] = ctx.rmChar ?? CHARACTER_ANIMATIONS;
  const saveRM: () => void = ctx.saveRM ?? (() => storeScene(rm));
  /*
   * THESE THREE ARE READ ON EACH CALL, not resolved once like `rm` above: a host may replace the action table after `init`
   * (it can arrive late), and a default must not cost that late binding. `rm` is the opposite — what matters there is the
   * object's IDENTITY, shared by reference with whoever draws the scene.
   *
   * The type annotation is needed: without it the default `() => ({})` infers `{}`, which does not accept string indexing,
   * and the compiler would refuse `acts[act]` — the whole dispatch.
   */
  const dynLabel = (b: PauseMenuButton): string | null => (ctx.dynLabel ? ctx.dynLabel(b) : null);
  const getPauseActs = (): Record<string, (() => void) | undefined> => (ctx.getPauseActs ? ctx.getPauseActs() : {});
  const setPauseActor = (i: number): void => { if (ctx.setPauseActor) ctx.setPauseActor(i); };

  function hasPrivateOutput(i: number): boolean { return hasPrivateOutputIn(P(), ctx.getNumPlayers(), i); }
  /** The latch refusal for this player now, or `null`. Recomputed: the device in use changes. */
  function refusalNow(i: number) { return ctx.transportInUse ? latchRefusal(ctx.transportInUse(i)) : null; }

  function iconState(i: number): IconStateSnapshot {
    const p = P()[i] || {};
    const cat = ctx.getAudioCat();
    return {
      blindMode: ctx.getBlindMode(),
      ttsOn: !!(cat && cat.tts && cat.tts.on),
      librasOn: ctx.isLibrasOn(),
      calmMode,
      toggleMove: !!p.toggleMove,
      switchScan,
      voice: voiceControl,
      // The NAMED default, not an empty value that only happened to match nothing: ADR-0029's changed-mark reads the
      // default and nothing else.
      visual: p.visual ?? DEFAULT_VISUAL,
      speed: gameSpeed,
      camera: cameraControl,
      locale: getLocale(),
      privateOutput: hasPrivateOutput(i),
      latchRequired: refusalNow(i) !== null,
      noVoice: !!ctx.noVoice?.(),
    };
  }

  // --- TEA ---------------------------------------------------------------------------------

  function applyCalm(): void {
    const plan = calmMotionPlan(calmMode);
    for (const k of rmKeys) rm[k] = plan.sceneReduced;
    saveRM();
    // "silencioso" freezes the character too. Iterates the WHOLE players array (not just numPlayers) — verbatim.
    for (const p of P()) for (const c of rmChar) p[c.prop] = plan.charFrozen;
    const cat = ctx.getAudioCat();
    for (const k of CALM_AUDIO_CATS) {
      const c = cat && cat[k];
      if (!c) continue;
      const next = calmAudioPlan(calmMode, c.vol);
      c.on = next.on; c.vol = next.vol;
      ctx.setCatGain(k);
    }
    // TTS/sonar/guarda/guia stay intact on purpose: TEA is about noise, not about losing navigation.
  }

  // --- icon actions (the dispatcher, as a table) ---------------------------------------------

  const ICON_ACTS: Record<string, (i: number) => void> = {
    menu: (i) => { ctx.openMenus?.(i); },
    blind: () => {
      writeBlindMode(!ctx.getBlindMode());
      ctx.srSay(t(ctx.getBlindMode() ? 'sr.icon.blindOn' : 'sr.icon.blindOff'));
    },
    tts: () => {
      const cat = ctx.getAudioCat();
      if (!cat || !cat.tts) return; // the same guard `iconLabel` and `applyCalm` have
      cat.tts.on = !cat.tts.on;
      ctx.setCatGain('tts');
      if (ctx.reflectTtsPanelEnabled) ctx.reflectTtsPanel();
      ctx.srSay(t(cat.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
    },
    libras: () => {
      ctx.toggleLibras();
      ctx.srSay(t(ctx.isLibrasOn() ? 'sr.icon.librasOn' : 'sr.icon.librasOff'));
    },
    tea: () => {
      calmMode = nextCalmMode(calmMode);
      store.set(store.KEYS.tea, calmMode); // ADR-0028: every menu setting persists. See the note at the `let` above.
      applyCalm();
      ctx.srSay(t('sr.icon.tea', { v: t(CALM_NAMES[calmMode]!) }));
    },
    /*
     * ☝️ CYCLES THREE READINGS OF A PRESS (ADR-0218): standard · no holding needed · one button only.
     *
     * 📌 ENTERING THE SCAN LEAVES THE LATCH WHERE IT IS, and leaving it turns the latch off. The scan wins in `inputModeOf`, so
     * the position shown is never ambiguous; and because the latch writer announces by itself, it is called ONLY where it
     * changes something — otherwise the child would hear «no holding needed, off» when what ended was the scan.
     */
    altmove: (i) => {
      // verbatim: `players[i].toggleMove` with no `||{}` guard (unlike contrast/cvd below).
      const latched = !!P()[i].toggleMove;
      const next = nextInputMode(inputModeOf({ toggleMove: latched, switchScan }), ctx.holdsKeys(), refusalNow(i) !== null);
      setSwitchScanValue(next === 'scan');
      // 📌 ENTERING THE SCAN LEAVES THE LATCH WHERE SHE PUT IT — the scan wins in `inputModeOf`, so the position shown is never
      // ambiguous and coming back out returns her to the choice she had made. Leaving it writes the position she walked to.
      // ⚠️ And the latch writer ANNOUNCES BY ITSELF, so it is called only where it changes something: otherwise the child would
      // hear «não precisa segurar, desligado» when what ended was the scan.
      if (next !== 'scan' && latched !== (next === 'sticky')) {
        // ⚠️ THE REFUSAL, over the WRITE, which is the only thing it ever meant. The cycle above already skips `standard` on a
        // device that always latches, so this should be unreachable — and it stays because `iconAct` is exported and the two
        // rules could drift apart, which is the same reason the guards below give for not being belt and braces.
        const refusal = refusalNow(i);
        if (refusal) { ctx.srAlert(t(refusal.key)); return; }
        setToggleMove(i, next === 'sticky');
        return;
      }
      ctx.srSay(t('sr.icon.inputMode', { v: t(INPUT_MODE_NAME[next]) }));
    },
    // Each of the two icons writes its OWN axis (#104), so changing one leaves the other where it was.
    // ⚠️ THE TWO GUARDS ARE NOT BELT AND BRACES. Without a writer the icon is not even mounted (`gameIcons`), so the bar
    // cannot reach this branch — but `iconAct` is EXPORTED and any host can call it by key. Without the guard that call
    // would throw; with it, nothing happens and nothing is announced — which is the truth: this game has no way to do it.
    contrast: (i) => {
      if (!ctx.setPlayerTheme) return;
      const v = nextTheme((P()[i] || {}).visual ?? DEFAULT_VISUAL);
      ctx.setPlayerTheme(i, v.tema);
      ctx.srSay(t('sr.visual.contrast', { v: t(SHORT_THEME[v.tema]) }));
    },
    /*
     * THE TYPOGRAPHY CYCLE (ADR-0149 §1): one press changes the letter CASE and the FACE at once. The guard is the one
     * written at `contrast` above, for the same reason.
     *
     * It ANNOUNCES THE FACE, NOT THE POSITION: «position 3 of 5» tells nobody anything; the face's name is what the child
     * recognises — the same reason ADR-0074 forbids `action2` from reaching a person.
     */
    tipografia: () => {
      if (!ctx.cycleTypography) return;
      const face = ctx.cycleTypography();
      if (face) ctx.srSay(t('sr.typo.font', { fam: face }));
    },
    // PLAYING THROUGH THE WEBCAM (ADR-0215): off → hands → face → eyes → off; stored in one key, so one mode at a time.
    camera: () => {
      const v = nextCameraControl(cameraControl);
      setCameraControlValue(v);
      ctx.srSay(t('sr.icon.camera', { v: t(CAMERA_MODE_NAME[v]) }));
    },
    // PLAYING BY SPEAKING (ADR-0189, issue #184): on or off, one stored key. What cannot start puts it back to off and says why,
    // which is the control's own job (`ui/voice-control`) — this only writes the child's answer.
    voice: () => {
      const v = !voiceControl;
      setVoiceControlValue(v);
      ctx.srSay(t('sr.icon.voice', { v: t(v ? 'state.on' : 'state.off') }));
    },
    // THE LANGUAGE (the Dev, 2026-09-16): the next flag; `setLocale` stores it and every surface redraws on `i18n:change`. Said in the NEW
    // language, once it has loaded.
    idioma: () => {
      const v = nextLocale(getLocale());
      void setLocale(v).then(() => ctx.srSay(t('sr.icon.idioma', { v: LANGUAGE_NAME[v] })));
    },
    // THE GAME SPEED (ADR-0180): one step down, wrapping at 50%; stored, and felt on the next frame of `startLoop`.
    velocidade: () => {
      const v = nextGameSpeed(gameSpeed);
      setGameSpeedValue(v);
      ctx.srSay(t('sr.icon.velocidade', { pct: Math.round(v * 100) }));
    },
    cvd: (i) => {
      if (!ctx.setPlayerCorrection) return;
      const v = nextCorrection((P()[i] || {}).visual ?? DEFAULT_VISUAL);
      ctx.setPlayerCorrection(i, v.correcao);
      ctx.srSay(t('sr.icon.cvd', { v: t(SHORT_CORRECTION[v.correcao]) }));
    },
  };

  function iconAct(k: string, i: number): void {
    // locked like the panel's row (ADR-0185): the same reason, said, and nothing turned on
    if (k === 'tts' && ctx.noVoice?.()) {
      ctx.srAlert(t('audio.semVoz'));
      return;
    }
    if ((k === 'blind' || k === 'tts') && !hasPrivateOutput(i)) {
      ctx.srAlert(t('sr.icon.needsPrivateOutput'));
      return;
    }
    // No blanket refusal for `altmove` here (ADR-0218): refusing the whole icon on a device that always latches would also
    // lock «one button only» away from the child playing with their eyes. The lock lives in the CYCLE, which skips
    // `standard` on that device, and the refusal lives inside the action, over the latch write only.
    const act = ICON_ACTS[k];
    if (act) act(i);
  }

  // --- reflection --------------------------------------------------------------------------

  function iconLabel(k: string, i: number): string { return computeIconLabel(k, iconState(i)); }

  function reflectIconBtn(b: HTMLElement, i: number): void {
    const k = b.dataset.pi || '';
    // the hourglass follows the CURRENT cartridge's clock (ADR-0180): a turn game mounted later hides it, a clock game shows it
    if (k === 'velocidade') b.hidden = !ctx.clock?.();
    if (k === 'idioma') { const flag = flagOf(getLocale()); if (b.innerHTML !== flag) b.innerHTML = flag; }
    const st = iconState(i);
    const v = computeIconVisual(k, st);
    b.classList.remove(...ICON_STATE_CLASSES);
    if (v.calm) b.classList.add('pi-calm');
    if (v.cvd) b.classList.add(v.cvd);
    b.classList.toggle('pi-on', v.on);
    b.classList.toggle('pi-dis', v.dis);
    /*
     * `pi-dis` is a CSS class (issue #128): a child who sees gets a greyed icon, a child on a screen reader gets nothing — the
     * button announces itself actionable and does not respond. `aria-disabled` mirrors the same fact for whoever listens.
     * `aria-disabled` and NOT `disabled`: the latter takes the button out of the tab order, and a keyboard user could no
     * longer reach it — nor hear WHY it does not respond.
     */
    if (v.dis) b.setAttribute('aria-disabled', 'true');
    else b.removeAttribute('aria-disabled');
    // the ☰ opens something and holds no state: a pressed/unpressed button would announce a toggle
    if (k === 'menu') b.removeAttribute('aria-pressed');
    else b.setAttribute('aria-pressed', String(v.active));
    // ⚠️ EVERY icon is relabelled here, including the ones that carry no state — because the markup and this reflection do not
    // run in the same language. `initI18n` loads en/es asynchronously, so the markup is born in pt and only the reflection
    // corrects it. 📌 Measured in a browser back when a guard skipped some of them: five icons in English and three still in
    // Portuguese, on the same bar.
    b.setAttribute('aria-label', computeIconLabel(k, st));
  }

  function reflectIconsIn(root: ParentNode | null, i: number): void {
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => reflectIconBtn(b, i));
  }

  /**
   * THE CARDS THIS INSTANCE BUILT. Private: whoever built them keeps them, which asks nothing of any host — a ctx field
   * would be one more thing every game had to remember to pass.
   */
  const cards: HTMLElement[] = [];

  /*
   * `refreshPauseItems` LOCKS THE ITEMS THIS GAME CANNOT ACTIVATE — recomputed, not decided at start. The action table can
   * arrive after the card is built (`getPauseActs` is asked when needed), so deciding at build time would lose for good
   * every item whose action exists only later. The host calls `reflectPauseIcons()` when the pause opens and when a
   * cartridge is mounted, so the card is right at the moment the child sees it.
   */
  /**
   * THE CARD'S NAME — what is SEEN and what is HEARD — repainted in the current language.
   *
   * The markup is born before an asynchronously loaded dictionary arrives, and an `aria-label` set once cannot be corrected
   * later by `applyDom`, which only reaches `[data-i18n]` and `[data-i18n-aria]`. Nor would `data-i18n-aria` do: `applyDom`
   * calls `t(k)` without parameters, and this key carries the seat number — the child would hear «Player {n} pause menu»,
   * braces included. So it is repainted on each `reflectPauseIcons()`, i.e. when the pause opens.
   *
   * The one who lost was the one who LISTENS (ADR-0044 item 4): to a sighted child the card was entirely in the right
   * language, and nothing looked wrong.
   */
  function renameCard(cardEl: HTMLElement, i: number): void {
    const card = cardEl.querySelector<HTMLElement>('.pause-card');
    if (card) card.setAttribute('aria-label', t('pause.cardAria', { n: i + 1 }));
    const seat = cardEl.querySelector<HTMLElement>('h2 .pause-seat');
    if (seat) seat.textContent = ctx.getNumPlayers() > 1 ? t('pause.cardSeat', { n: i + 1 }) : '';
  }

  function refreshPauseItems(): void {
    const acts = getPauseActs();
    const rootEl = ctx.pmButtons ?? PM_BTNS;
    const options = ctx.optionsButtons ?? PM_OPTIONS_BTNS;
    const fromGame = ctx.gameButtons ?? PM_GAME_BTNS;
    const actingItems = new Set([
      ...rootThatActs(rootEl, options, acts, fromGame).map((b) => b.act),
      ...itemsThatAct(options, acts).map((b) => b.act),
      ...itemsThatAct(fromGame, acts).map((b) => b.act),
    ]);
    // An explicit index, not `filter(Boolean)`: the cards are indexed by PLAYER, building only screen 2 leaves a hole at
    // index 0, and closing the hole would renumber the seats in the card's name. The `undefined` guard is written by hand.
    for (let i = 0; i < cards.length; i++) {
      const cardEl = cards[i];
      if (!cardEl) continue;
      renameCard(cardEl, i);
      for (const btn of cardEl.querySelectorAll<HTMLElement>('.pm-btn')) {
        // LOCKED WITH ITS REASON, NOT HIDDEN (ADR-0161, superseding ADR-0106 §5 here): a card that changed shape from game
        // to game hid from the child that an option exists. The cursor still stops on the item and it still counts;
        // reaching or pressing it says why. And not `remove()`: the table can grow later.
        const act = btn.dataset.act ?? '';
        if (actingItems.has(act)) {
          btn.removeAttribute('aria-disabled');
          delete btn.dataset.motivo;
        } else {
          btn.setAttribute('aria-disabled', 'true');
          btn.dataset.motivo = itemReason(act);
        }
      }
    }
  }

  function reflectPauseIcons(): void {
    ctx.getA11yBars().forEach((bar, i) => reflectIconsIn(bar, i));
    refreshPauseItems();
  }

  // --- the pause screen ----------------------------------------------------------------------

  /**
   * Switches the visible list AND ANNOUNCES the first item of the list that came in. Not decoration: a child who cannot see
   * has just changed menus and the cursor jumped; without speech the only clue would be silence. The «N de M» index comes
   * with it (ADR-0044 item 3) and says how many items the new list has.
   */
  function announceList(sp: HTMLElement, sub: PauseSub): void {
    const first = showPauseOptions(sp, sub);
    if (!first) return;
    const items = [...sp.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
    ctx.srSay(announceItem(
      { label: first.textContent || '', position: 1, total: items.length }, menuIndexOn,
    ));
  }

  /* ===================== THE `accessibility` MODE (ADR-0044 item 7) ===================== */

  /**
   * Who has the d-pad steering the BAR instead of the character. ROUND lifetime (ADR-0038): it lives in this instance's
   * closure, is not persisted, and goes with the round — an input mode that survived a restart would be the trap coming
   * back: the child would open the game the next day and the character would not move.
   */
  const onBar = new Set<number>();

  /** Screen `i`'s bar cursor, or the first icon when there is no cursor yet. */
  function selectedIcon(bar: HTMLElement): HTMLElement | null {
    return bar.querySelector<HTMLElement>('.pi-sel') || bar.querySelector<HTMLElement>('.pi-btn');
  }

  /** Puts the cursor on an icon, writes the caption and ANNOUNCES — speech is the channel of whoever cannot see the icon. */
  function selectIcon(i: number, bar: HTMLElement, el: HTMLElement): void {
    bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
    el.classList.add('pi-sel');
    const cap = bar.querySelector('.pause-icons-cap');
    if (cap) cap.textContent = accessibleLabel(el);
    ctx.srSay(iconCaption(bar, el)); // the spoken one carries the place (ADR-0167)
    ctx.explainIcon?.(i, el.dataset.pi ?? null);
  }

  /**
   * ENTERS the mode: the d-pad now steers screen `i`'s bar.
   *
   * It does NOT resume the game (ADR-0155): START is the QUICK PAUSE, the bar is used with the game FROZEN, and resuming on
   * entry would unfreeze the world the instant the child asked it to stop. Whoever enters decides the phase.
   *
   * The announcement says how to LEAVE, at the moment of entering — the line that disarms the trap ADR-0044 recorded as a
   * negative consequence: a child who cannot see presses a direction, the character does not move, and nothing on screen
   * explains why, because the screen is not that child's channel.
   */
  function enterBarMode(i: number): void {
    const bar = ctx.getA11yBars()[i];
    const first = bar && selectedIcon(bar);
    if (!bar || !first) return;
    onBar.add(i);
    ctx.srSay(t('sr.a11y.barEnter'));
    selectIcon(i, bar, first);
  }

  /**
   * LEAVES the mode and gives the d-pad back to the character. It announces, because giving it back is information too.
   *
   * `silent` is for leaving the bar for ANOTHER screen, not for the game — SELECT, which swaps the quick pause for the card
   * (ADR-0155): «back to the game» said there would be a lie, with the card opening on top.
   *
   * `onLeaveBar` runs on EVERY exit — Back, START or whoever calls this — because the root must unfreeze the game by any
   * door. An exit only one path knew would leave the child on the other back at the character in a stopped world.
   */
  function leaveBarMode(i: number, silent = false): void {
    if (!onBar.delete(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (bar) {
      bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
      const cap = bar.querySelector('.pause-icons-cap');
      if (cap) cap.textContent = '';
    }
    ctx.explainIcon?.(i, null);
    if (!silent) ctx.srSay(t('sr.a11y.barExit'));
    ctx.onLeaveBar?.(i, silent);
  }

  /** Is screen `i`'s d-pad on the bar? What input routing asks every frame. */
  const isOnBar = (i: number): boolean => onBar.has(i);

  /**
   * ONE STEP inside the mode. `hasStart` is the edge of the button that opens the pause — the second way out.
   *
   * The bar is one row, so all FOUR directions move along it: for someone navigating without sight, «up» in a one-row list
   * must not be a dead end. And it moves in a RING, like every menu of the game (ADR-0044 item 1).
   */
  function navBar(i: number, k: NavKeys, hasStart = false): void {
    if (!onBar.has(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (!bar) return;
    const action = barAction(k, hasStart);
    if (action === 'sair') { leaveBarMode(i); return; }
    const icons = [...bar.querySelectorAll<HTMLElement>('.pi-btn')];
    if (!icons.length) return;
    // never null here: the bar has an icon, and `selectedIcon` falls back to the first one
    const cur = selectedIcon(bar) as HTMLElement;
    // the click goes through the bar's own listener, which records who pressed it (`setPauseActor`)
    if (action === 'ativar') { cur.click(); return; }
    if (action === 'andar') selectIcon(i, bar, icons[stepInRing(icons.length, icons.indexOf(cur), (k.down || k.right) ? 1 : -1)]);
  }

  function buildScreenPause(i: number): HTMLElement {
    const sp = mountDoc().createElement('div');
    sp.className = 'screen-pause';
    sp.hidden = true;
    sp.dataset.player = String(i);
    /*
     * BUILDS THE WHOLE LIST, and `refreshPauseItems` decides which items act — here and on every `reflectPauseIcons()`.
     * Filtering at build time would lose for good every item whose action exists only after the boot (see above).
     */
    sp.innerHTML = screenPauseMarkup({
      player: i,
      numPlayers: ctx.getNumPlayers(),
      pmButtons: ctx.pmButtons ?? PM_BTNS,
      optionsButtons: ctx.optionsButtons ?? PM_OPTIONS_BTNS,
      gameButtons: ctx.gameButtons ?? PM_GAME_BTNS,
      dynLabel: dynLabel, t,
    });
    cards[i] = sp;
    refreshPauseItems(); // the lock holds from the build, not only from the first opening

    sp.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest<HTMLElement>('.pm-btn');
      if (b) pressPauseItem(i, sp, b);
    });
    return sp;
  }

  /** One item of screen `i`'s pause card pressed — a locked one, a door between its lists, the quick bar, or an action. */
  function pressPauseItem(i: number, sp: HTMLElement, b: HTMLElement): void {
    // LOCKED (ADR-0161): pressing it SAYS the reason and does nothing — neither door nor action.
    if (b.getAttribute('aria-disabled') === 'true') {
      const reason = b.dataset.motivo ?? '';
      ctx.srSay(reason);
      ctx.explainItem?.(reason);
      return;
    }
    setPauseActor(i);
    const act = b.dataset.act || '';
    // «Opções do jogo» with the cartridge's rows opens the engine's panel (ADR-0182), not the list a host may pass
    const doorWithPanel = act === 'opcoesdojogo' && typeof getPauseActs().opcoesdojogo === 'function';
    if (DOOR_TO_LIST[act] && !doorWithPanel) { announceList(sp, DOOR_TO_LIST[act]!); return; }
    // `acessibilidade` takes the cursor to the QUICK BAR. The item is not in the engine's root (ADR-0151); only a list a
    // GAME passes reaches it, and for that list the card closes and the bar is used — explicitly, since `enterBar` does
    // not resume by itself (ADR-0155).
    if (act === 'acessibilidade') { getPauseActs().resume?.(); enterBarMode(i); return; }
    const fn = getPauseActs()[act];
    if (fn) fn();
  }

  /**
   * One screen's QUICK BAR: the toggles, the caption, and their wiring.
   *
   * A SIBLING of `.screen-exp`, not a child (#82): the bar is CONTROL, not experience. Empathy mode degrades the experience
   * on purpose — a simulation creates difficulty — and degrading what exists to GIVE access would be the opposite.
   */
  function buildQuickBar(i: number): HTMLElement {
    const bar = mountDoc().createElement('div');
    bar.className = 'screen-a11y';
    bar.dataset.player = String(i);
    bar.innerHTML = quickBarMarkup(gameIcons);
    // OUT OF THE TAB ORDER during play (ADR-0044 item 7): a stop per icon between the child and the game would be the price
    // of leaving them in, and keyboard reach is not lost — it becomes the `accessibility` mode, opened from the pause. The
    // bar the root mounts in `#title-icons` is unaffected: the `tabindex` is set HERE, on the element, not in the shared markup.
    bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => { b.tabIndex = -1; });

    const cap = bar.querySelector('.pause-icons-cap');
    bar.addEventListener('click', (e) => {
      const ib = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!ib) return;
      setPauseActor(i);
      iconAct(ib.dataset.pi || '', i);
      reflectPauseIcons(); // must run BEFORE reading the label back — that is what makes the caption honest
      if (cap) cap.textContent = accessibleLabel(ib);
    });

    // Caption = the button's `aria-label`, so hovering or focusing says the SAME truth a screen reader would announce: one
    // source for whoever sees and whoever listens. It GOES AWAY on leaving — a bar on the play screen must not leave a strip
    // of text over the game (the Dev: an explanation only while the pointer is on the button). The exception is the
    // `accessibility` mode's CURSOR: when it sits on an icon the caption is the only thing saying where it is, hence the
    // `.pi-sel` check in `wireBarCaption`.
    wireBarCaption(bar, (k) => ctx.explainIcon?.(i, k));
    return bar;
  }

  return {
    buildScreenPause, buildQuickBar, enterBar: enterBarMode, leaveBar: leaveBarMode, onBar: isOnBar, navBar,
    mountedIcons: gameIcons,
    iconAct, iconLabel, reflectIconBtn, reflectIconsIn, reflectPauseIcons,
    // `setCalmMode` PERSISTS TOO, and sanitises: it is the other door to the same value, and a level set here that only
    // lasted the session would look applied and then vanish.
    applyCalm,
    getCalmMode: () => calmMode,
    setCalmMode: (n) => { calmMode = sanitiseTeaLevel(n, DEFAULTS.calmMode); store.set(store.KEYS.tea, calmMode); },
    iconState,
  };
}
