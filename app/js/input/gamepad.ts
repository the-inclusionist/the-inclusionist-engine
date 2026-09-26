// SPDX-License-Identifier: AGPL-3.0-or-later
// input/gamepad.ts — gamepad READING (stdDirs/padActions/bindActive/padMapFor) + the poll dispatcher
// (pollPads) + the accessibility MAPPING WIZARD (openPadWiz/openPadWizFor/closePadWiz/padWizTick). Pure
// button->action logic is separated from the DI runtime (initGamepad(ctx)): the Gamepad API is injected
// (ctx.getGamepads, so tests feed a fake pad with no browser) and every cross-subsystem call (menu nav, modal,
// join/respawn, pause, overlays) is injected too — it never reaches `document`/`navigator`.
// Boundary: this module only READS buttons/axes and maps them to actions; the physical button ARTWORK/labels
// (PAD_DESIGNS) and the on-screen touch pad are input/devices.ts + input/touch — not here.

import type { Translate } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';
import { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
import { createPadWizard, PADWIZ_ORDER as ORDEM_DO_ASSISTENTE, type PadMaps } from './pad-wizard.js';
import type { PadTable, PadTableFor } from './pad-defaults.js';
import type { LiveInput } from './state.js';
// 📌 The pad's frame memory, the stored maps and the game's button table arrive through the ctx, built once by the root
// (ADR-0232 D4): as module state, two roots on one page shared a pad's previous frame and each other's maps.
// 📌 `oneButton` (the motor empathy's one-button mode, issue #120) arrives through the ctx, as `input/keydown`'s does:
// the settings store is built by the root and passed in (ADR-0232, issue #207). The field is REQUIRED, which is what the
// old live import defended — an optional field would make the accommodation exist only where someone remembered it
// (ADR-0077's M3 argument); a required one does not compile without it.

// ---------------------------------------------------------------------------------------------
// Gamepad API surface (minimal, adapter-friendly — mirrors the real Gamepad/GamepadButton shape)
// ---------------------------------------------------------------------------------------------

// 🔴 WHAT A PAD IS DOING lives in `input/pad-reading`: it is the PURE half — buttons and axes in, positions out. Here
// is the wiring, which can only be read with a ctx in hand: the conductor that polls the pads every frame and decides
// where the reading goes.
// ⚠️ NO ALIAS: a re-export would keep alive a published path nothing in the engine imports (issue #204), and the
// migration note is what says where each name went.
import {
  type PadLike, type GetGamepads, type PadMap, type PadActions, type ActionKey,
  padActions, oneButtonAtOnce,
} from './pad-reading.js';

// ---------------------------------------------------------------------------------------------
// Wizard data (the ORDER of the steps; the WORDS and the demonstration come from the game)
// ---------------------------------------------------------------------------------------------

/**
 * The ORDER in which the wizard asks. ONLY the order — the same list `input/pad-wizard` walks, where it lives apart
 * from any game (issue #182).
 *
 * ⚠️ NO WORDS HERE: the word comes from `ctx.actionLabel`, which the game supplies through its preset (ADR-0074 —
 * platformer vocabulary, in one language, inside the engine was the defect this removed). What stays is what really
 * is the engine's: the sequence of the questions — directions first, actions next, system last —, an ergonomic
 * decision of the wizard and not of the game.
 *
 * ⚠️ AND AN ACTION THE GAME DOES NOT NAME IS NOT ASKED. `input/pad-wizard` skips it, because a game that does not use
 * the position has nothing to map on it — and asking would produce a mute step or, worse, a step saying `action7` out
 * loud.
 */
export const PADWIZ_ORDER: readonly string[] = ORDEM_DO_ASSISTENTE;

interface WizBase { b: boolean[]; a: number[]; }
interface WizAxTrack { i: number; v: number; last: number; changes: number; ticks: number; }
/** The state of a wizard in progress; `null` = closed. */
export interface WizState {
  gi: number; // index of the gamepad being mapped (-1 = not identified yet)
  id: string;
  step: number; // index into PADWIZ_ORDER (-1 = still waiting for baseWait to finish)
  base: WizBase | null; // the resting snapshot (everything released) taken after baseWait
  map: PadMap;
  release: boolean; // waiting for the previous step's button to be RELEASED before asking the next
  baseWait: boolean; // waiting for EVERYTHING to be released to take the resting snapshot
  axTrack: WizAxTrack | null; // an axis being classified (~240ms): analogue (varies) vs D-pad/hat (jumps and sticks)
  timer: ReturnType<typeof setInterval> | null;
}

// ---------------------------------------------------------------------------------------------
// DI runtime — pollPads (dispatcher) + the wizard. Nothing here touches `document`/`navigator` directly.
// ---------------------------------------------------------------------------------------------

import type { NavKeys } from './edges.js';
import type { ModalIntent } from './keydown.js';
import type { DomQuery } from '../core/dom-query.js';

/** The minimal player shape this module reads/writes — DERIVED from core/entity, not retyped. There is no `quiz`
 *  here (ADR-0033): the question is `ctx.hasModal(i)` and the answer is an INTENT, so this module never reads the
 *  game's object. */
export type GamepadPlayer = PlayerView<
  'pad' | 'quit' | 'waiting' | 'easy' |
  'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge'
>;

/**
 * WHAT ONLY THE CARTRIDGE KNOWS ABOUT ITS WORLD (ADR-0224). The engine mounts this transport — as it mounts touch, the
 * eyes, the face, the hands, the voice and the scan —, and 📏 of `GamepadCtx`'s 25 doors the root answers 23 with what
 * it already has. These are the ones left, and they are the ones nothing in the engine can know.
 *
 * 🎯 **ALL OPTIONAL, AND EVERY ABSENCE HAS A WRITTEN MEANING** — never guessed (ADR-0113 clause 3, ADR-0169). A
 * cartridge that declares nothing has a working pad; what depends on its world simply does not happen. Refusing the
 * boot for lack of these would break every game with a pad and no title screen, over a declaration that has a safe
 * meaning — refusing where it should report.
 *
 * 📌 ONE FIELD in `CreateGameOptions`, not nine loose ones: nine fields are nine things every game has to learn in a
 * contract whose cost is a one-way door (ADR-0172), and the next transport needing the same treatment would bring nine
 * more. Grouping them also says something true — they belong together because they are what the pad needs from the
 * game.
 */
export interface GamepadGameHooks {
  /** Is the world moving? **Absent: it is**, whenever the pause card is not open. */
  readonly worldRunning?: () => boolean;
  /** This game's title screen. **Absent: no title to navigate** — the pad does nothing outside play and the pause. */
  readonly navTitle?: (k: NavKeys) => void;
  /** The demonstration that plays by itself. **Absent: no demo**, so nothing to stop. */
  readonly attractActive?: () => boolean;
  readonly stopAttract?: () => void;
  /** This player's open challenge. **Absent: no modal**, and the d-pad belongs to the game. */
  readonly hasModal?: (playerIndex: number) => boolean;
  readonly modalInput?: (playerIndex: number, intent: ModalIntent) => void;
  /** Joining a running game with a new screen. **Absent: nobody joins midway** (returns `false`). */
  readonly joinPlayer?: (padIndex: number) => boolean;
  /** Restarting only this player's screen. **Absent: nothing happens** — an abandoned screen stays abandoned. */
  readonly respawnPlayer?: (playerIndex: number) => void;
  /** The game's HUD "waiting" badge. **Absent: there is no badge** to remove. */
  readonly clearWaitingBadge?: (playerIndex: number) => void;
  /**
   * A demonstration of what each position does, drawn by the GAME while the mapping wizard asks for it — `null` is
   * the wizard opening. **Absent: the wizard speaks, with no drawing.** The engine asks the questions and in what
   * order; what a position LOOKS like is the game's (note CD — the engine used to draw one game's boy here).
   */
  readonly wizardStep?: (position: string | null) => void;
  /** One tick of the wizard's clock, for a demonstration that animates. **Absent: nothing animates.** */
  readonly wizardTick?: () => void;
}

/** The same answers, all present: this is what `GamepadCtx` consumes, and what the table below guarantees. */
export type PadGameAnswers = Required<Omit<GamepadGameHooks, 'worldRunning'>> & { readonly worldRunning: () => boolean };

/**
 * WHAT EACH ABSENCE MEANS, AS DATA (ADR-0224). A table and not ten `??` scattered through whoever mounts: the meaning
 * of an absence is a DECISION, and a composition root should hold only wiring — ten decisions in it are ten branches in
 * a function the ratchet already watches (ADR-0221, erratum).
 *
 * ⚠️ `worldRunning` is not here because its absence has no universal answer: it depends on whoever mounts knowing
 * which menus they have open. It comes in as a parameter, which also makes it the only absence a host can answer.
 */
const SILENT_PAD_ANSWERS: Omit<PadGameAnswers, 'worldRunning'> = Object.freeze({
  navTitle: () => {},             // no title screen to navigate
  attractActive: () => false,     // no demonstration running
  stopAttract: () => {},          // so nothing to stop
  hasModal: () => false,          // no open challenge: the d-pad belongs to the game
  modalInput: () => {},           // and so nothing to feed
  joinPlayer: () => false,        // nobody joins a running game midway
  respawnPlayer: () => {},        // an abandoned screen stays abandoned
  clearWaitingBadge: () => {},    // the waiting badge is the game's HUD; with no game declaring it, it does not exist
  wizardStep: () => {},           // the mapping wizard speaks, with no drawing
  wizardTick: () => {},           // and so nothing animates
});

/**
 * The cartridge's answers with every absence already resolved. 📌 A field DECLARED as `undefined` is an absence like any
 * other — spreading the raw object over the table would erase the answer with an `undefined`, which is the silent
 * defect this function exists not to have.
 */
export function padGameAnswers(hooks: GamepadGameHooks | undefined, worldRunningWhenSilent: () => boolean): PadGameAnswers {
  const declared: Record<string, unknown> = {};
  for (const [name, answer] of Object.entries(hooks ?? {})) if (answer !== undefined) declared[name] = answer;
  return { worldRunning: worldRunningWhenSilent, ...SILENT_PAD_ANSWERS, ...declared } as PadGameAnswers;
}

/**
 * THE SEAT FIELDS, SEEDED BY THE ENGINE (ADR-0224). 📏 Measured: the players a cartridge declares are
 * `{ ctrl, audioSink? }`, and this transport needs to know whose each pad is (`pad`), who is still waiting (`waiting`)
 * and who left the screen (`quit`).
 *
 * 🔴 IT SEEDS THE OBJECT ITSELF and returns the SAME list — copying would lose the seat on the next frame, because
 * `takeSeat` writes into this object. That is also why there is no `.map`: the identity is what carries the state.
 * 📌 It only touches whoever does not have the fields yet, so a cartridge that declares them keeps its own.
 */
export function seatEveryPlayer(list: readonly object[]): GamepadPlayer[] {
  for (const p of list) {
    const seat = p as { pad?: number; waiting?: boolean; quit?: boolean };
    seat.pad ??= -1;
    seat.waiting ??= false;
    seat.quit ??= false;
  }
  return list as GamepadPlayer[];
}

export interface GamepadCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /**
   * The controller maps a child made — this root's `createPadMaps(store)` (ADR-0232 D4), the SAME object its own mapping
   * wizard writes. Required: a pad whose map is read from nowhere answers with the standard layout, and a custom pad goes
   * dead with no word said.
   */
  padMaps: PadMaps;
  /**
   * THIS GAME'S BUTTON TABLE per arrangement and seat — `createPadTable(declaration.padMapping)` (ADR-0115, ADR-0232 D4).
   * Required: a transport handed no table would give the ENGINE's map, in silence, to a game that declared another.
   */
  padTable: PadTableFor;
  /** Where each pad's frame is kept — this root's input state (`Engine.input`), mutated in place every poll. */
  input: Pick<LiveInput, 'padCur' | 'padPrevAct' | 'padPrevStart'>;
  /**
   * Is the ONE-BUTTON mode on (the motor empathy, issue #120)? Read each frame — the child turns it on mid-game. The
   * root answers from the settings store it built (ADR-0232); required, see the note at the imports.
   */
  oneButton: () => boolean;
  /** The Gamepad API adapter (replaces `navigator.getGamepads()`) — the DI point for testing with no browser. */
  getGamepads: GetGamepads;
  /** DOM selector (querySelector), injected — never reaches the global `document`. */
  $: DomQuery;
  /**
   * WHAT this position IS CALLED, in the GAME's word and the current language. `null` = the game does not use it.
   *
   * ⚠️ It is the boundary between engine and game as a field: the engine knows a position exists, only the game knows
   * the word. Without it the wizard would speak a constant of this file — in one language, without `t()`, inside the
   * engine.
   */
  actionLabel: (action: string) => string | null;
  /** Screen-reader announcements (core/a11y-sr), injected. */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;
  /** Brings an overlay to the front + fills in the help text (the shared overlay helper, used by every overlay). */
  frontOverlay: (el: HTMLElement | null) => void;
  /* --- THE SCENE, as booleans and verbs (ADR-0030 C3) ---
     Not `getPhase()`/`setPhase()`: the module is ENGINE, and a phase type would make it know THIS game's phase
     vocabulary. `consumer-quiz` showed in `menu-nav` what that costs — a quiz whose settings are always available had
     to declare itself "paused" to navigate its own menus. What this module needs is two questions and two verbs. */
  /** Is the world running? (START here PAUSES.) */
  worldRunning: () => boolean;
  /** Is the pause menu open? (START here RESUMES.) */
  pauseMenu: () => boolean;
  /** Pause and resume. The root stacks the scene; only the intent leaves from here. */
  pause: () => void;
  resume: () => void;
  /** Demonstration (attract) mode. */
  isAttractActive: () => boolean;
  stopAttract: () => void;
  /** On-screen touch controls — they vanish on the first physical input. */
  isTouchMode: () => boolean;
  hideTouchControls: () => void;
  /** Live state of players/screens (injected as a getter — never cached by this module). */
  getPlayers: () => GamepadPlayer[];
  getNumPlayers: () => number;
  /** Menu navigation: the title, the shared dialog (the topmost), and the pause per screen. */
  navTitle: (k: NavKeys) => void;
  /** Is screen `i` in `accessibility` mode? (ADR-0044, item 7 — the d-pad steers the HUD bar.) */
  onBar: (i: number) => boolean;
  /** One step inside the bar. `hasStart` is the pause button's edge, which is the mode's SECOND exit. */
  navBar: (i: number, k: NavKeys, hasStart: boolean) => void;
  sharedDialogOpen: () => HTMLElement | null;
  navDialog: (dlg: HTMLElement, k: NavKeys) => void;
  /** The player's pause screen. `HTMLElement` and not `{ hidden: boolean }`: the structural minimum works for READING,
   *  but this module HANDS the menu to `navPause`, which needs the whole element — and in parameter position the
   *  minimal slice inverts (ADR-0039). */
  getPauseMenu: (playerIndex: number) => HTMLElement | null | undefined;
  navPause: (menu: HTMLElement, playerIndex: number, k: NavKeys) => void;
  /** Which player opens the accessibility submenu next. */
  setPauseActor: (playerIndex: number) => void;
  /**
   * THIS EDGE IS THIS PLAYER'S, AND IT CAME FROM THE PAD (ADR-0113 clause 4, issue #127).
   *
   * 🔴 REQUIRED: without it the input state's `playerEdge` has no caller for the pad, so `inputOf(i).inUse` answers
   * `teclado` for everyone — and the latch read is the keyboard's even with the pad in hand. 📌 Pass
   * `createLatchedEdge(() => players, { store, input })` from `input/latch-edge`, not the raw one: it also resolves this
   * device's latch on the player.
   *
   * ⚠️ The gamepad is the transport that stays identifiable without the key set — it goes through `padCur` —, and that
   * is exactly why a gap here is invisible: the module knows which pad the edge came from, and the automaton does not.
   */
  playerEdge: (player: number, origin: 'gamepad') => void;
  /**
   * THE SINGLE DOOR TO THE CARTRIDGE (ADR-0223): press a POSITION on this pad's seat. Answers whether the press reached
   * the GAME — `false` means a menu took it.
   *
   * 🔴 Edges alone are not a door: a cartridge that listens only to `onCommand` — which ADR-0111's erratum asks of
   * everyone — would not answer a pad. The edges stay (a cartridge's physics learns from them that there was a press),
   * but they are the CONSEQUENCE of a press that reached the game.
   *
   * 📌 REQUIRED, and ADR-0223's erratum says why: an optional door is one more field a game can forget, and forgetting
   * it brings back the silence this work exists to end. The root passes its virtual controller's `press`.
   */
  press: (action: ActionKey | 'select', source: 'gamepad', player: number) => boolean;
  /** Release the POSITION. The controller lets go of the key it held and delivers the release — only for a press the game heard. */
  release: (action: ActionKey, source: 'gamepad', player: number) => void;
  /**
   * The player's OWN modal: the engine delivers the INTENT, the game decides (ADR-0033).
   *
   * One intent and not four verbs (move, confirm, erase, announce Braille): with the verbs, the decision of which to
   * call lived here, with the three-column grid and the Braille detour — and the pad and the keyboard each had a COPY
   * of it, which is the worst way to have it: two to drift apart.
   */
  /** The player's INDEX, not the player (ADR-0033/0039): the engine delivers an intent and does not need to know what a
   *  player with an open challenge is. The challenge's owner resolves the index. */
  modalInput: (playerIndex: number, intent: ModalIntent) => void;
  /** Does this player have a modal open? A question, and not the game's object. */
  hasModal: (playerIndex: number) => boolean;
  /** Joins a running game with a new screen. */
  joinPlayer: (padIndex: number) => boolean;
  /** Restarts only this player's screen. */
  respawnPlayer: (playerIndex: number) => void;
  /** Removes the screen's "waiting" badge when it gets a pad (part of the game's HUD). */
  clearWaitingBadge: (playerIndex: number) => void;
  /** The game's demonstration of each wizard step (`GamepadGameHooks.wizardStep`). */
  wizardStep: (position: string | null) => void;
  /** One tick of the wizard's clock for that demonstration (`GamepadGameHooks.wizardTick`). */
  wizardTick: () => void;
}

export interface GamepadApi {
  pollPads(): void;
  openPadWiz(): void;
  openPadWizFor(gp: PadLike): void;
  closePadWiz(save: boolean): void;
  padWizTick(): void;
  padMapFor(id: string): PadMap | null;
  /** The wizard's live state (`null` = closed). */
  getPadWiz(): WizState | null;
}

/**
 * WHAT ONE FRAME KNOWS ABOUT ONE PAD: the actions now, the edges against the previous frame, and whose seat it is.
 *
 * 🔴 IT EXISTS SO THE DESTINATIONS CAN STAND SIDE BY SIDE (ADR-0221, step 7c): with the reading as a VALUE, each of the
 * five places a pad's frame can go is a function next to the others, none nested in the next — where once the real
 * game sat nine levels deep.
 *
 * 📌 And it is not only the measure: each destination has a name. What happens when the child is on the quick bar is
 * `steerGame` calling something called that, not an `if` in the middle of two hundred lines.
 */
interface PadFrame {
  readonly gp: PadLike;
  readonly gi: number;
  /** This pad's seat, or −1 while nobody has taken it. */
  readonly owner: number;
  /** The LIVE list of players: the seat branch writes into it. */
  readonly players: GamepadPlayer[];
  readonly cur: PadActions;
  /** The START (or jump) that went DOWN this frame — it closes dialogs and win screens. */
  readonly startEdge: boolean;
  /** Only the START that went down — pause and resume. */
  readonly pauseEdge: boolean;
  /** Only the SELECT that went down — the menus (ADR-0155). */
  readonly selectEdge: boolean;
  readonly edge: (k: ActionKey) => boolean;
  /**
   * THE RELEASE EDGE: the button that was down on the previous frame and is not now.
   *
   * 🔴 It is what makes the single door (ADR-0223) HONEST on this transport: the virtual controller keeps a `held` map
   * so no game is left believing a button is still down, and without this half the pad would press and never release.
   * The pad is the only transport that reads STATE per frame instead of receiving events, so the release never arrives
   * to it — it is computed.
   */
  readonly released: (k: ActionKey) => boolean;
  /** The six menu intents. `withStart` only on the title, where START means "begin" and not "leave". */
  readonly navKeys: (withStart?: boolean) => NavKeys;
}

/** The eight positions THIS transport reads: the d-pad and the four actions. The shoulders and triggers a cartridge may
 *  declare have no reading on the pad — the list says what is true today. */
const PAD_POSITIONS: readonly ActionKey[] = Object.freeze(
  ['left', 'right', 'up', 'down', 'action1', 'action2', 'action3', 'action4'] as const,
);

/** Inside a modal the ORDER is the rule — `input/keydown`'s: a pad delivers a snapshot with no order of arrival, and
 *  with left and confirm in the same frame it is this list that decides the child moves instead of confirming. */
const MODAL_BY_POSITION: readonly (readonly [ActionKey, ModalIntent])[] = Object.freeze([
  ['left', 'left'], ['right', 'right'], ['up', 'up'], ['down', 'down'], ['action2', 'confirm'], ['action3', 'erase'],
] as const);

export function initGamepad(ctx: GamepadCtx): GamepadApi {
  const { t } = ctx;
  const { padCur, padPrevAct, padPrevStart } = ctx.input;
  let padWizAutoResume = false; // the wizard opened by itself mid-game -> resume when it closes

  // the root's one cache of stored maps (input/pad-wizard): a map saved by the engine's own wizard is read here next frame
  const padMapFor = (id: string): PadMap | null => ctx.padMaps.padMap(id);
  function actionsFor(gp: PadLike, table?: PadTable): PadActions { return padActions(gp, padMapFor(gp.id), table); }

  // the wizard asks; what a position LOOKS like is drawn by the game (note CD), through the two hooks it may answer
  const wizard = createPadWizard({
    maps: ctx.padMaps, t,
    getGamepads: () => ctx.getGamepads(),
    actionLabel: (action) => ctx.actionLabel(action),
    say: (phrase) => { const el = ctx.$<HTMLElement>('#padwiz-prompt'); if (el) el.textContent = phrase; ctx.srSay(phrase); },
    progress: (text) => { const pr = ctx.$<HTMLElement>('#padwiz-progress'); if (pr) pr.textContent = text; },
    srAlert: (phrase) => ctx.srAlert(phrase),
    onStep: (position) => ctx.wizardStep(position),
    onTick: () => ctx.wizardTick(),
    onClose: (gi) => {
      const ov = ctx.$<HTMLElement>('#padwiz'); if (ov) ov.hidden = true;
      // no phantom edges: the button still HELD from the last step (START) must not pause or act on resume
      try {
        const pads = ctx.getGamepads() ?? [];
        const gp = pads[gi];
        if (gp) { const c = actionsFor(gp); padCur[gi] = c; padPrevAct[gi] = c; padPrevStart[gi] = c._start; }
      } catch { /* a pad API that throws here only costs the edge baseline, never the closing */ }
      if (padWizAutoResume) { padWizAutoResume = false; if (ctx.pauseMenu()) ctx.resume(); }
    },
  });
  function openPadWiz(): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    wizard.open();
  }
  // The wizard opened BY ITSELF (a DirectInput pad with no map pressed something): we already know which pad it is.
  function openPadWizFor(gp: PadLike): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    wizard.openFor(gp);
  }
  const closePadWiz = (save: boolean): void => wizard.close(save);
  const padWizTick = (): void => wizard.tick();

  const cancelBtn = ctx.$<HTMLButtonElement>('#padwiz-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closePadWiz(false));

  // ----- poll (called every frame of the loop) -----

  /** This frame's reading for ONE pad: the actions now, the edges against the previous frame, and the seat. */
  function readPad(gp: PadLike, players: GamepadPlayer[]): PadFrame {
    const gi = gp.index;
    const prev = padPrevAct[gi] || {};
    // ⚠️ THE SEAT IS READ BEFORE THE ACTIONS, and the reason is ADR-0115: this game's button table is declared PER SEAT,
    // and it is read inside `actionsFor`. Read after, the actions would be taken before knowing whose pad it is — and a
    // per-seat default would arrive late.
    const owner = players.findIndex((p) => p.pad === gi);
    // ⚠️ AND A PAD NOT YET ASSIGNED (`owner < 0`) READS SEAT 0, not "none": it is producing edges on the title screen,
    // and an empty map there would leave the child with no way to choose their own game.
    // THE MOTOR EMPATHY SIMULATION APPLIED TO THE PAD (issue #120). Without this line, a child with the one-button mode
    // on and a pad in hand WAS NOT in the mode — and nothing anywhere said so.
    const cur = oneButtonAtOnce(
      prev,
      actionsFor(gp, ctx.padTable(ctx.getNumPlayers(), owner < 0 ? 0 : owner)),
      ctx.oneButton(),
    );
    const startEdge = cur._start && !padPrevStart[gi]; padPrevStart[gi] = cur._start;
    const pauseEdge = cur._pause && !prev._pause;
    const selectEdge = !!cur.select && !prev.select;
    const edge = (k: ActionKey): boolean => cur[k] && !prev[k];
    const released = (k: ActionKey): boolean => !!prev[k] && !cur[k];
    padCur[gi] = cur; padPrevAct[gi] = cur;
    // 📌 START counts as "yes" ONLY on the title: there it is the button that begins the game, and on the pause card or
    // the bar it is the EXIT (ADR-0044 item 7). One parameter instead of three lists equal but for one term.
    const navKeys = (withStart = false): NavKeys => ({
      yes: edge('action2') || (withStart && startEdge), no: edge('action3'),
      up: edge('up'), down: edge('down'), left: edge('left'), right: edge('right'),
    });
    return { gp, gi, owner, players, cur, startEdge, pauseEdge, selectEdge, edge, released, navKeys };
  }

  /** Did any of the six menu intents happen this frame? */
  // 📌 The `!!` is what `NavKeys` asks for: its six fields are OPTIONAL, because not every transport produces them all.
  const anyIntent = (k: NavKeys): boolean => !!(k.yes || k.no || k.up || k.down || k.left || k.right);

  /** A non-standard (DirectInput) pad with NO stored map pressed something: pause everything and open the wizard on it. */
  function wizardTookOver(gp: PadLike): boolean {
    if (gp.mapping === 'standard' || padMapFor(gp.id) || !gp.buttons.some((b) => b && b.pressed)) return false;
    padWizAutoResume = ctx.worldRunning();
    if (ctx.worldRunning()) ctx.pause();
    openPadWizFor(gp);
    return true;
  }

  /** A win: START/jump close the modal (Play again), and nothing from this pad reaches the game underneath it. */
  function winOverlayTook(f: PadFrame): boolean {
    const winOv = ctx.$<HTMLElement & { hidden: boolean }>('#win-overlay');
    if (!winOv || winOv.hidden) return false;
    if (f.startEdge) { const b = ctx.$<HTMLElement>('#btn-again'); if (b) b.click(); }
    return true;
  }

  /** The title menu: the pad navigates, and in a multiplayer game only P1 chooses. */
  function steerTitle(f: PadFrame): void {
    const k = f.navKeys(true);
    if (!anyIntent(k)) return;
    if (ctx.getNumPlayers() > 1 && f.owner > 0) { ctx.srSay(t('sr.title.waitP1')); return; } // only P1 chooses
    ctx.navTitle(k); // the title menu, navigable by pad
  }

  /** The pause card: START resumes, and the d-pad navigates the shared dialog or the seat's own menu. */
  function steerPause(f: PadFrame): void {
    if (f.pauseEdge) { ctx.resume(); return; } // START resumes
    const k = f.navKeys();
    if (!anyIntent(k)) return;
    const dlg = ctx.sharedDialogOpen();
    if (dlg) { ctx.navDialog(dlg, k); return; }
    const pi = f.owner < 0 ? 0 : f.owner;
    const menu = ctx.getPauseMenu(pi);
    if (menu && !menu.hidden) ctx.navPause(menu, pi, k);
  }

  /** Assignment BY ORDER OF ACTION: any button binds -> the 1st pad to act -> the 1st player without a pad. */
  function takeSeat(f: PadFrame): void {
    if (!f.startEdge && !PAD_POSITIONS.some((k) => f.edge(k))) return;
    const waitI = f.players.findIndex((p) => p && p.waiting);
    const free = waitI >= 0 ? waitI : f.players.findIndex((p) => p && p.pad < 0 && !p.quit);
    if (free < 0) { ctx.joinPlayer(f.gi); return; }
    const seated = f.players[free]!;
    seated.pad = f.gi;
    if (seated.waiting) { seated.waiting = false; ctx.clearWaitingBadge(free); }
    ctx.srSay(t('sr.pad.assigned', { n: free + 1 }));
  }

  /**
   * THE HALF OF THE SINGLE DOOR THAT PRESSES (ADR-0223): every position that WENT DOWN this frame goes to the virtual
   * controller, stamped `gamepad` with this pad's seat. Returns the ones that reached the GAME — the controller's
   * answer, which is what tells a game press from one a menu took.
   *
   * ⚠️ The EIGHT positions and not the six with an edge: those with an edge are a subset (`EDGE_BY_ACTION`), and up and
   * down always travelled as held keys. All eight reach the cartridge.
   */
  function pressWhatWentDown(f: PadFrame): ReadonlySet<ActionKey> {
    const reached = new Set<ActionKey>();
    for (const act of PAD_POSITIONS) if (f.edge(act) && ctx.press(act, 'gamepad', f.owner)) reached.add(act);
    return reached;
  }

  /**
   * THE HALF THAT RELEASES, and it is UNCONDITIONAL on purpose (ADR-0223). A press is only born in the PLAY branch, but
   * the finger leaves the button wherever it likes — a child who opens the pause with jump held would leave the key held
   * forever if the release depended on the branch. The controller ignores the release of a press the game never heard,
   * which is exactly the memory it exists to have.
   *
   * 📌 The pad is the only transport that reads STATE per frame instead of receiving events, so the release never
   * arrives to it: it is computed against the previous frame.
   */
  function releaseWhatCameUp(f: PadFrame): void {
    if (f.owner < 0) return; // a pad with no seat never pressed anything
    for (const act of PAD_POSITIONS) if (f.released(act)) ctx.release(act, 'gamepad', f.owner);
  }

  /** The real game: START pauses, the modal eats the d-pad, and the rest becomes an action flag. */
  function playRound(f: PadFrame, p: GamepadPlayer): void {
    if (f.pauseEdge) { ctx.pause(); ctx.setPauseActor(f.owner); return; } // START pauses (everyone pauses; each screen navigates its own)
    if (ctx.hasModal(f.owner)) { // the pad navigates the player's OWN modal (the others' game goes on)
      // What left this module is the MEANING — the grid's ±1/±3 and the Braille detour, which are the game's decision.
      const hit = MODAL_BY_POSITION.find(([position]) => f.edge(position));
      if (hit) ctx.modalInput(f.owner, hit[1]);
      return;
    }
    // The table and the Easy guard come from input/edges.ts, the SAME ones keydown and touch use — three hand-written
    // copies had already drifted once (the touch one forgot `!p.easy`).
    // 🔴 THE SINGLE DOOR FIRST (ADR-0223): the position goes to the virtual controller, which holds the child's key
    // stamped `gamepad` and delivers the command to the cartridge. Only then is an edge raised — and only for a press
    // that REACHED the game, which is the controller's answer.
    const reachedPlay = pressWhatWentDown(f);
    let hasAnyEdge = false;
    for (const [act, flag] of EDGE_BY_ACTION) {
      if (!reachedPlay.has(act)) continue;
      hasAnyEdge = true;
      if (edgeAllowed(act, p.easy)) p[flag] = true;
    }
    // 📌 THE PAD'S EDGE, and it counts EVEN WHEN EASY FILTERS IT (ADR-0113 clause 4): the child pressed the button —
    // that the Easy Mode rule does not raise the game's flag does not change the fact that this is the device in use.
    // Reading the same condition as `p[flag]` would leave a child in Easy Mode with the keyboard's latch while playing
    // on the pad.
    // ⚠️ AND IT IS HERE, in the PLAY branch, not the menu ones: `onBar`, the title and the pause are navigation, and the
    // question this feeds — which latch holds NOW — is about playing.
    if (hasAnyEdge) ctx.playerEdge(f.owner, 'gamepad');
  }

  /** With the world moving: the quick bar first, then the seat, the abandoned screen, and finally the game. */
  function steerGame(f: PadFrame): void {
    // ===================== THE `accessibility` MODE (ADR-0044, item 7) =====================
    // With the game RUNNING, this player's d-pad steers the QUICK BAR and not the character. It comes before everything
    // that is the game's, because while the mode is on nothing else from this pad is the game's.
    //
    // Both exits arrive together: `especial` (action 3) is the project's BACK — the east button: B on Xbox, ◯ on
    // PlayStation, A on Nintendo — and `startEdge` is the button that opens the pause, where this was entered. A child
    // who is lost goes back the way they came, one who knows the game tries the usual back; both work.
    if (f.owner >= 0 && ctx.onBar(f.owner)) {
      const k = f.navKeys();
      if (f.startEdge || anyIntent(k)) ctx.navBar(f.owner, k, !!f.startEdge);
      return;
    }
    if (f.owner < 0) { takeSeat(f); return; }
    const p = f.players[f.owner]!;
    if (p.quit) { if (f.startEdge) ctx.respawnPlayer(f.owner); return; } // abandoned screen -> restart ONLY it
    playRound(f, p);
  }

  /** In the demonstration, a pad button ends the demo — and the frame ends here, button or not. */
  function attractTook(pads: readonly (PadLike | null | undefined)[]): boolean {
    if (!ctx.isAttractActive()) return false;
    if (pads.some((gp) => gp && gp.buttons.some((b) => b && b.pressed))) ctx.stopAttract();
    return true;
  }

  /** A physical button used -> the on-screen pad goes away (the keyboard's rule): any of the nine positions read. */
  function hideTouchPadIfHeld(f: PadFrame): void {
    if (ctx.isTouchMode() && (f.cur._start || PAD_POSITIONS.some((k) => f.cur[k]))) ctx.hideTouchControls();
  }

  /**
   * Where this frame goes. The destinations ask for the facts, not a PHASE. The pause wins over a world running beneath
   * it, and the title is derived by exclusion on purpose: in a scene this module does not know (a map, a results
   * screen), the pad should navigate as on the title — the safe behaviour — instead of doing nothing.
   */
  function steerFrame(f: PadFrame): void {
    // SELECT OPENS THE MENUS wherever the keyboard's F does — in play and in the quick pause (ADR-0155) — and it is PRESSED,
    // not decided here: the virtual controller hands the position to the engine, which answers it as F (ADR-0144 §1). An open
    // card or panel refuses it there. A pad nobody has seated yet is seat 0's, as on the pause card below.
    if (f.selectEdge) { ctx.press('select', 'gamepad', f.owner < 0 ? 0 : f.owner); return; }
    if (ctx.pauseMenu()) steerPause(f);
    else if (ctx.worldRunning()) steerGame(f);
    else steerTitle(f);
  }

  function pollPads(): void {
    if (wizard.state()) return; // during the wizard, the pads talk only to it
    const pads = ctx.getGamepads();
    if (!pads || attractTook(pads)) return;
    for (const gp of pads) {
      if (!gp) continue;
      // a non-standard (DirectInput) pad with NO saved map pressed something -> pause everything + the wizard directly
      if (wizardTookOver(gp)) return;
      // ⚠️ `getPlayers()` IS READ HERE, once per pad, and not once before the loop: the seat branch WRITES into the list
      // (`players[free].pad = gi`), and reading it only once would change what the next pad sees.
      const f = readPad(gp, ctx.getPlayers());
      releaseWhatCameUp(f); // before every branch: the finger leaves the button wherever it likes (ADR-0223)
      hideTouchPadIfHeld(f);
      if (!winOverlayTook(f)) steerFrame(f);
    }
  }

  return { pollPads, openPadWiz, openPadWizFor, closePadWiz, padWizTick, padMapFor, getPadWiz: () => wizard.state() };
}
