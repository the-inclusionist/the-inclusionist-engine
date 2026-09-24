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
 * O QUE UMA INTENÇÃO SIGNIFICA DENTRO DO MODO `accessibility` (ADR-0044, item 7).
 *
 * O registro listou este modo entre as consequências NEGATIVAS da decisão, e disse por quê: "um modo em que
 * se entra e não se sabe sair é a própria armadilha de que este registro trata — então a saída dele (START ou
 * VOLTAR) é parte da decisão, e não um detalhe de implementação".
 *
 * Daí a forma desta função: SAIR vem primeiro, e vem por DUAS portas. Não é redundância. VOLTAR é a saída de
 * tudo no jogo, e é o que quem já o conhece tenta primeiro; START é o botão que ABRE a pausa, e a pausa é de
 * onde se entrou aqui — quem se perde tenta voltar por onde veio. Ter só uma das duas seria apostar que a
 * criança adivinhe qual delas foi escolhida.
 *
 * E a precedência é decisão também: um controle registra mais de uma borda no mesmo quadro (dedos apertam
 * junto), e nesse quadro `sair` não pode ficar atrás de `ativar`.
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
   * ⚠️ O MODO CEGO IDEM, e aqui o padrão é literalmente o que o `core/state` já decidiu que um setter faz:
   * «grava, persiste, avisa» — e nada mais. Os efeitos de jogo (refazer os extras do nível) são REACÇÃO, e
   * quem reage assina `on('blindMode', …)`. O anúncio não se perde para quem não injecta: este ícone já diz
   * `sr.icon.blindOn`/`Off` por si, logo abaixo.
   */
  const writeBlindMode = ctx.setBlindMode ?? setBlindModeValue;

  /** O documento onde se constroi. Resolvido a cada uso, e por globalThis — em node o identificador
   *  document nem existe, e um ?? sobre ele lançaria ReferenceError em vez de cair no padrão. */
  const mountDoc = (): Document => ctx.doc ?? (globalThis as { document?: Document }).document as Document;

  /*
   * ⚠️ O CONTRASTE E A COR SÓ APARECEM SE HOUVER QUEM OS ESCREVA (ADR-0106 §5).
   *
   * 📏 Medido em 2026-09-08, e é o que separa este caso dos outros seis campos «acidentais»: eles eram estado
   * que um cartucho calhou de guardar, e a engine pôde reclamá-los. Estes precisam de um
   * `render/viz-setters`, cujo contexto pede **34 campos** do grafo de render de UM jogo — `parallaxLayers`,
   * `decoSprites`, `getPowerups`, `rebuildCoins`, `worldSprite`. O `createGame` não monta isso, e um quiz não
   * tem nada disso para montar. A engine não pode dar um padrão aqui; o que ela pode é não FINGIR.
   *
   * Decidido uma vez, no arranque, e não a cada montagem de barra: o conjunto de escritores de um consumidor
   * não muda a meio de uma partida, e recalcular por tela faria as telas discordarem entre si.
   */
  const gameIcons = iconsThatAct({
    theme: Boolean(ctx.setPlayerTheme),
    correction: Boolean(ctx.setPlayerCorrection),
    // 📌 Sem `Boolean(...)`: os dois de cima perguntam «existe escritor?» a um campo opcional; este é uma
    // RESPOSTA que o jogo deu, e envolvê-la faria um `undefined` de um ctx mal montado virar `false` —
    // esconder o controle em silêncio, que é metade do defeito que este campo existe para não cometer.
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
   * ⚠️ RESOLVIDOS UMA VEZ, no arranque, pela mesma razão do `settings-motion`: o `rm` é mutado in-place e
   * partilhado por REFERÊNCIA com quem desenha a cena, e resolvê-lo a cada uso criaria um objecto novo por
   * chamada — o interruptor deixaria de alcançar o desenho, sem erro nenhum.
   *
   * 📌 O `getPauseActs` fica FUNÇÃO e não valor, porque a laziness dele é a razão de ele existir assim: no
   * cartucho a tabela é um `const` declarado ~1200 linhas abaixo, e lê-la aqui cairia na zona morta temporal.
   */
  const rm: MotionSceneFlags = ctx.rm ?? readStoredScene();
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? SCENE_KEYS;
  const rmChar: readonly MotionCharDef[] = ctx.rmChar ?? CHARACTER_ANIMATIONS;
  const saveRM: () => void = ctx.saveRM ?? (() => storeScene(rm));
  /*
   * ⚠️ ESTES TRÊS SÃO LIDOS A CADA CHAMADA, e não resolvidos uma vez como o `rm` acima. A diferença é
   * deliberada e um teste apanhou-me a errá-la: congelar `ctx.getPauseActs` no arranque partiu um caso que
   * TROCA a tabela depois do `init` — e trocar depois é legítimo, porque a laziness deste campo existe
   * precisamente por a tabela chegar tarde. Um padrão não pode custar a ligação tardia que o campo tem.
   *
   * O `rm` é o contrário e por isso fica congelado: ali o que importa é a IDENTIDADE do objecto, partilhada
   * por referência com quem desenha a cena.
   *
   * A anotação de tipo é necessária: sem ela o padrão `() => ({})` infere `{}`, que não aceita indexação por
   * string, e o compilador passaria a recusar `acts[act]` — o despacho inteiro.
   */
  const dynLabel = (b: PauseMenuButton): string | null => (ctx.dynLabel ? ctx.dynLabel(b) : null);
  const getPauseActs = (): Record<string, (() => void) | undefined> => (ctx.getPauseActs ? ctx.getPauseActs() : {});
  const setPauseActor = (i: number): void => { if (ctx.setPauseActor) ctx.setPauseActor(i); };

  function hasPrivateOutput(i: number): boolean { return hasPrivateOutputIn(P(), ctx.getNumPlayers(), i); }
  /** A recusa da alternância para este jogador agora, ou `null`. Recalculada: o aparelho em uso muda. */
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
      // ⚠️ `DEFAULTS.viz` E NÃO `''` (issue #61). A cadeia vazia funcionava por ACIDENTE: não casa
      // `hc-direto` nem `fix-*`, então os dois ícones ficavam apagados pelo motivo certo por engano. O padrão
      // passou a ter nome em `core/state`, e `render/viz-modes` já declarava esse modo com `kind:'normal'` —
      // o que não faz nada. Dizer o padrão em vez de o deduzir é o que torna a marca do ADR-0029 possível
      // aqui, porque ela lê `DEFAULTS` e mais nada.
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
      if (!cat || !cat.tts) return; // a guarda que `iconLabel` e `applyCalm` já tinham e esta ação não
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
      store.set(store.KEYS.tea, calmMode); // ADR-0028: todo menu persiste. Ver a nota no `let` acima.
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
    // ⚠️ OS DOIS ÍCONES DEIXARAM DE SE APAGAR UM AO OUTRO (#104). Eles SEMPRE ciclaram dentro do seu eixo —
    // `nextContrast` e `nextCvd` existem separados desde sempre —, mas escreviam os dois no mesmo campo, e
    // por isso mexer num zerava o outro. O snapshot dizia isso como se fosse desenho: «they overwrite each
    // other; that is by design». Agora cada um escreve no seu eixo e o outro fica onde estava.
    // ⚠️ AS DUAS GUARDAS NÃO SÃO CINTO E SUSPENSÓRIOS. Sem escritor, o ícone nem sequer é montado
    // (`iconesDoJogo`), então este ramo não deveria ser alcançável pela barra — mas `iconAct` é EXPORTADO e
    // qualquer consumidor pode chamá-lo por chave. Sem a guarda, essa chamada rebentaria; com ela, não faz
    // nada e não anuncia — que é o mesmo que dizer a verdade: este jogo não tem por onde.
    contrast: (i) => {
      if (!ctx.setPlayerTheme) return;
      const v = nextTheme((P()[i] || {}).visual ?? DEFAULT_VISUAL);
      ctx.setPlayerTheme(i, v.tema);
      ctx.srSay(t('sr.visual.contrast', { v: t(SHORT_THEME[v.tema]) }));
    },
    /*
     * O CICLO DE TIPOGRAFIA (ADR-0149 §1): uma pressão muda a CAIXA e a FACE de uma vez.
     *
     * 📌 A guarda é a mesma dos dois abaixo e pela mesma razão escrita ali: sem quem accione, o ícone nem é
     * montado — mas `iconAct` é EXPORTADO e um consumidor pode chamá-lo por chave. Sem ela, essa chamada
     * rebentava; com ela, não faz nada e não anuncia, que é dizer a verdade.
     *
     * ⚠️ ANUNCIA A FACE E NÃO A POSIÇÃO. «Posição 3 de 5» não diz nada a ninguém; o nome da face é o que a
     * criança reconhece, e é a mesma razão pela qual o ADR-0074 proíbe `action2` chegar a uma pessoa.
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
    // 🔴 A RECUSA EM BLOCO DO `altmove` SAIU DAQUI em 2026-09-21 (ADR-0218), e a razão é o que ela passou a custar: ela dizia
    // «este aparelho exige a alternância» e devolvia sem fazer NADA — o que, com três posições, também trancava «um botão só»
    // para quem joga com os olhos, que é quem mais precisa dele. Agora a trava vive no CICLO, que não passa pelo «padrão»
    // nesse aparelho, e a recusa sobrevive dentro do acto, sobre a única coisa que ela sempre foi: a escrita da aderência.
    // 📌 O motivo continua dito na LINHA DO PAINEL, que é a outra superfície do mesmo ajuste (ADR-0113 cláusula 3).
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
     * 🔴 A ISSUE #128, E ELA É DE UMA LINHA: `pi-dis` é CLASSE CSS. A criança que enxerga vê o ícone
     * apagado; a que navega por leitor de tela não recebe nada — o botão anuncia-se accionável e não
     * responde. `aria-disabled` espelha o mesmo facto para quem ouve.
     *
     * ⚠️ E `aria-disabled` e NÃO `disabled`: o segundo tira o botão da ordem de tabulação, e quem navega
     * por teclado deixaria de o alcançar — logo deixaria de poder ouvir POR QUE ele não responde. É a
     * mesma escolha que o `#opt-altmove` faz no painel, pela mesma razão.
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
   * Reflete os ícones de TODAS as telas. Varre as BARRAS e não mais os cartões de pausa: desde o item 7 do
   * ADR-0044 os ícones vivem no HUD, e um cartão de pausa não contém `.pi-btn` nenhum.
   */
  /**
   * OS CARTÕES QUE ESTA INSTÂNCIA CONSTRUIU. Privado, e é a resposta a um problema que eu próprio criei.
   *
   * ⚠️ O `PauseIconsCtx` tinha um `getPauseScreens` e eu removi-o hoje, com razão: tinha ZERO leitores. Agora
   * este módulo precisa de alcançar os cartões — e a saída certa NÃO é repor o campo. Quem os construiu foi
   * ele; guardar o que construiu não pede nada a consumidor nenhum, e um campo de ctx é mais uma coisa que
   * cada um dos 300 jogos teria de se lembrar de passar.
   */
  const cards: HTMLElement[] = [];

  /**
   * ESCONDE OS ITENS QUE ESTE JOGO NÃO CONSEGUE ACCIONAR — recalculado, e não decidido no arranque.
   *
   * ⚠️ ESTA FUNÇÃO EXISTE POR UM DEFEITO DE TEMPO. O cartão era FILTRADO no `buildScreenPause`, e o
   * `getPauseActs` é um getter precisamente porque a tabela CHEGA TARDE — «`pauseActs` is a `const` declared
   * far below the init site», diz o próprio campo. Um consumidor que siga esse padrão documentado montava um
   * cartão sem os itens cuja acção só existiu depois do boot, e nunca mais os recuperava.
   *
   * 📌 A avaliação passou para o ÚLTIMO instante possível: o `ui/shell` chama `reflectPauseIcons()` quando a
   * fase vira `pause-menu`, ou seja quando a pausa ABRE. O §5 continua respeitado — a criança nunca vê um
   * item que não acciona —, e agora também vê os que passaram a accionar.
   */
  /**
   * O NOME DO CARTÃO — o que se VÊ e o que se OUVE — repintado no idioma corrente.
   *
   * 🔴 MEDIDO em 2026-09-12, no `dist/quiz.html` com `documentElement.lang === 'en'`: o cartão de pausa
   * mostrava «Paused», «Resume», «Accessibility», «Typography» — tudo em inglês — e anunciava-se a quem usa
   * leitor de tela como **«Menu de pausa do jogador 1»**. A chave existe nos três dicionários; o que falha é
   * o TEMPO, o mesmo do ficheiro `barra-no-idioma-do-arranque`: o `initI18n` aplica pt de forma síncrona e
   * pede en/es de forma assíncrona, a marcação nasce nesse intervalo, e um `aria-label` colado não tem como
   * ser corrigido depois — `applyDom` só alcança `[data-i18n]` e `[data-i18n-aria]`.
   *
   * ⚠️ E `data-i18n-aria` NÃO SERVIRIA AQUI: `applyDom` chama `t(k)` sem parâmetros, e esta chave leva o
   * número do assento. Um `data-i18n-aria` deixaria a pessoa a ouvir «Player {n} pause menu», com as chavetas.
   *
   * 🎯 Por isso repinta-se aqui: `refrescarItensDaPausa` já corre a cada `reflectPauseIcons()`, ou seja a
   * cada vez que a pausa ABRE. O idioma vale no instante em que a criança a abre, que é o instante certo.
   *
   * ⚠️ QUEM PERDIA ERA SÓ QUEM ESCUTA, e é isso que faz este defeito ser da família que o ADR-0044 item 4
   * nomeia: para quem vê, o cartão estava inteiro em inglês e nada havia a notar. O canal partido era o
   * único canal de outra criança.
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
    // ⚠️ `filter(Boolean)` VIROU ÍNDICE EXPLÍCITO, e a razão é a linha do nome logo abaixo: os cartões são
    // indexados por JOGADOR, montar só a tela 2 deixa um buraco no índice 0 — e `filter` fechava o buraco,
    // o que renumerava os assentos. O guarda de `undefined` que ele dava fica, escrito à mão.
    for (let i = 0; i < cards.length; i++) {
      const cardEl = cards[i];
      if (!cardEl) continue;
      renameCard(cardEl, i);
      for (const btn of cardEl.querySelectorAll<HTMLElement>('.pm-btn')) {
        // 🔴 TRAVADO COM O MOTIVO, E NÃO ESCONDIDO (ADR-0161, que supersede aqui o §5 do ADR-0106). O Dev achou três
        // itens no quiz em vez de seis: o cartão mudava de forma a cada jogo, e a criança não sabia que a opção
        // existia. O cursor continua a parar no item e o número dele conta; alcançá-lo ou accioná-lo diz o motivo.
        // ⚠️ E NÃO `remove()`: a tabela pode crescer depois (um jogo que liga «sair» só depois da primeira fase).
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
   * Troca a lista visível E ANUNCIA o primeiro item da lista que entrou.
   *
   * O anúncio não é enfeite: quem não enxerga acabou de mudar de menu e o cursor pulou para outro lugar. Sem
   * a fala, a única pista de que a tela mudou seria o silêncio. O índice "N de M" vem junto (item 3), e é ele
   * que diz de quantos itens é a lista nova.
   */
  function announceList(sp: HTMLElement, sub: PauseSub): void {
    const first = showPauseOptions(sp, sub);
    if (!first) return;
    const items = [...sp.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
    ctx.srSay(announceItem(
      { label: first.textContent || '', position: 1, total: items.length }, menuIndexOn,
    ));
  }

  /* ===================== O MODO `accessibility` (ADR-0044, item 7) ===================== */

  /**
   * Quem está com o direcional dirigindo a BARRA em vez do personagem.
   *
   * Vida de RODADA (ADR-0038): mora no closure desta instância, não é persistido, e some com a partida. Um
   * modo de entrada que sobrevivesse ao reinício seria a armadilha voltando pela porta dos fundos — a criança
   * abriria o jogo no dia seguinte e o personagem não andaria.
   */
  const onBar = new Set<number>();

  /** O cursor da barra da tela `i`, ou o primeiro ícone quando ainda não há cursor. */
  function selectedIcon(bar: HTMLElement): HTMLElement | null {
    return bar.querySelector<HTMLElement>('.pi-sel') || bar.querySelector<HTMLElement>('.pi-btn');
  }

  /** Põe o cursor num ícone, escreve a legenda e ANUNCIA — a legenda é o canal de quem não vê o ícone. */
  function selectIcon(i: number, bar: HTMLElement, el: HTMLElement): void {
    bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
    el.classList.add('pi-sel');
    const cap = bar.querySelector('.pause-icons-cap');
    if (cap) cap.textContent = accessibleLabel(el);
    ctx.srSay(iconCaption(bar, el)); // the spoken one carries the place (ADR-0167)
    ctx.explainIcon?.(i, el.dataset.pi ?? null);
  }

  /**
   * ENTRA no modo: o direcional passa a dirigir a barra da tela `i`.
   *
   * 🔴 E JÁ NÃO RETOMA O JOGO (ADR-0155). Até ali o modo era «para usar DURANTE a partida» e entrar chamava
   * `acts.resume()`; desde que o START é a PAUSA RÁPIDA, a barra é usada com o jogo CONGELADO, e retomar ao
   * entrar descongelaria o mundo no instante em que a criança pediu que parasse. Quem entra decide a fase.
   *
   * O anúncio diz como SAIR, e diz na hora de entrar. É a linha que desarma a armadilha que o próprio
   * ADR-0044 anotou como consequência negativa desta decisão: quem não enxerga aperta a direção, o personagem
   * não anda, e sem esta frase não há nada na tela que explique — porque a tela não é o canal dessa criança.
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
   * SAI do modo e devolve o direcional ao personagem. Anuncia, porque a devolução também é informação.
   *
   * `silencioso` é para quem sai da barra para OUTRO ecrã e não para o jogo — o SELECT, que troca a pausa rápida
   * pelo cartão (ADR-0155): «de volta ao jogo» dito aí seria mentira, com o cartão a abrir por cima.
   *
   * 📌 E `aoSairDaBarra` corre em TODA saída — Voltar, START ou quem chame isto —, porque a raiz tem de
   * descongelar o jogo por qualquer porta. Uma saída que só um caminho conhecesse deixava o outro com a criança
   * de volta ao personagem num mundo parado.
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

  /** A tela `i` está com o direcional na barra? É o que o roteamento de entrada pergunta a cada quadro. */
  const isOnBar = (i: number): boolean => onBar.has(i);

  /**
   * UM PASSO dentro do modo. `temStart` é a borda do botão que abre a pausa — a segunda saída.
   *
   * A barra é uma fileira, então as QUATRO direções andam nela: para quem navega sem ver, "cima" numa lista
   * de uma linha só não pode ser um beco. E anda em ANEL, como todo menu do jogo desde o item 1.
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
     * ⚠️ MONTA A LISTA INTEIRA E ESCONDE DEPOIS — e a versão anterior desta linha FILTRAVA aqui, o que estava
     * errado por uma razão de TEMPO. O comentário que estava neste sítio dizia «montar é o primeiro instante
     * em que a resposta existe»; não é. O `getPauseActs` é um getter precisamente porque a tabela chega
     * TARDE — «`pauseActs` is a `const` declared far below the init site», diz o próprio campo —, e o
     * `createGame` monta durante o próprio `createGame(...)`. Filtrar aqui apagava para sempre todo item cuja
     * acção só passou a existir depois do boot.
     *
     * Quem decide o que se VÊ é o `refrescarItensDaPausa`, a cada `reflectPauseIcons()` — que o `ui/shell`
     * dispara quando a fase vira `pause-menu`, ou seja quando a pausa ABRE. O §5 continua respeitado (a
     * criança nunca vê um item que não acciona) e agora também vê os que passaram a accionar.
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
    refreshPauseItems(); // o §5 vale já na montagem, e não só na primeira abertura

    sp.addEventListener('click', (e) => {
      const b = (e.target as Element | null)?.closest<HTMLElement>('.pm-btn');
      if (b) pressPauseItem(i, sp, b);
    });
    return sp;
  }

  /** One item of screen `i`'s pause card pressed — a locked one, a door between its lists, the quick bar, or an action. */
  function pressPauseItem(i: number, sp: HTMLElement, b: HTMLElement): void {
    // TRAVADO (ADR-0161): accioná-lo DIZ o motivo e não faz nada — nem porta, nem acção.
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
    // `acessibilidade` leva o cursor à BARRA RÁPIDA. ⚠️ O ITEM SAIU DA RAIZ (ADR-0151) e só o alcança uma lista que o
    // JOGO passe; para ela o comportamento antigo fica aqui, explícito — fechar o cartão e jogar com a barra —, já que
    // `enterBar` deixou de retomar sozinho (ADR-0155).
    if (act === 'acessibilidade') { getPauseActs().resume?.(); enterBarMode(i); return; }
    const fn = getPauseActs()[act];
    if (fn) fn();
  }

  /**
   * A BARRA RÁPIDA de uma tela: os dez alternadores, a legenda, e a fiação dos dois.
   *
   * Ela é IRMÃ da `.screen-exp` e não filha, e isso é a decisão do #82 aplicada: a barra é CONTROLE, não
   * experiência. O modo empatia degrada a experiência de propósito — simulação é criar dificuldade onde a
   * facilidade não existe —, e degradar o que existe para DAR acesso seria o contrário do que ele serve.
   */
  function buildQuickBar(i: number): HTMLElement {
    const bar = mountDoc().createElement('div');
    bar.className = 'screen-a11y';
    bar.dataset.player = String(i);
    bar.innerHTML = quickBarMarkup(gameIcons);
    // FORA DA ORDEM DE TABULAÇÃO durante a partida (ADR-0044, item 7). Dez paradas entre a criança e o jogo
    // seria o preço de deixá-los lá — e o alcance por teclado não se perde: ele passa a ser o modo
    // `accessibility`, que se abre pela pausa. A barra do TÍTULO não é afetada: lá não se está jogando, e o
    // `tabindex` é posto AQUI, no elemento, e não no markup que as duas compartilham.
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

    // Legenda = o `aria-label` do botão, para que passar o mouse ou focar diga a MESMA verdade que um leitor
    // de tela anunciaria. Uma fonte só para quem vê e para quem escuta.
    //
    // E ELA SOME AO SAIR. Antes ficava: a última explicação apontada permanecia por cima do jogo até alguém
    // apontar outra. Numa barra que agora vive na TELA DE JOGO isso é uma faixa de texto parada em cima da
    // partida — o Dev viu e disse o que é: explicação só enquanto o mouse estiver no botão.
    //
    // A EXCEÇÃO É O CURSOR DO MODO `accessibility`: quando ele está pousado num ícone, a legenda é a única
    // coisa que diz onde ele está, e apagá-la ao mexer o mouse cegaria o modo. Daí a pergunta pelo `.pi-sel`.
    wireBarCaption(bar, (k) => ctx.explainIcon?.(i, k));
    return bar;
  }

  return {
    buildScreenPause, buildQuickBar, enterBar: enterBarMode, leaveBar: leaveBarMode, onBar: isOnBar, navBar,
    mountedIcons: gameIcons,
    iconAct, iconLabel, reflectIconBtn, reflectIconsIn, reflectPauseIcons,
    // ⚠️ O `setCalmMode` PERSISTE TAMBÉM, e sanea. Ele é a outra porta para o mesmo valor — se só o ciclo do
    // ícone gravasse, um nível posto por aqui sobreviveria à sessão e não ao fecho da aba, que é a metade
    // pior do defeito: o ajuste parece ter pegado e some depois.
    applyCalm,
    getCalmMode: () => calmMode,
    setCalmMode: (n) => { calmMode = sanitiseTeaLevel(n, DEFAULTS.calmMode); store.set(store.KEYS.tea, calmMode); },
    iconState,
  };
}
