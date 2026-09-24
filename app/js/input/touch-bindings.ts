// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch-bindings.ts — THE TOUCH CONTROL'S BINDINGS: the gesture becomes a POSITION.
//
// This module is the other half of `input/touch.ts`. That one OWNS THE PAD — the physical geometry (mm→px), the
// settings panel, the remappable map (`getTouchMap`), showing/hiding the buttons. It knows where the thumb lands and
// how big the target has to be. It does not know what happens after the touch.
// This is what does. A screen button PRESSES A POSITION on the virtual controller (ADR-0223), stamped `toque`, the
// same door the eyes, the voice and the keyboard use: in a menu the position becomes the menu's key, in play the
// controller holds the child's key and delivers the command to the cartridge. On top of that, for a press that reached
// the game, this module raises the matching edge flag on every player whose scheme holds that key.
//
// ======================= WHY A FILE OF ITS OWN, AND NOT INSIDE input/touch.ts =======================
// Because they are two different questions, and the second depends on things the first does not know.
// `input/touch.ts` closes over `$`, `store`, `root`, `viewport` — drawing and persistence. This module needs the live KEY
// SCHEME, the PLAYERS array, the controller's door, `togglePause` and the host's hooks: dependencies that have nothing
// to do with drawing a pad. So the boundary falls between "where the finger is" (there) and "what the finger means"
// (here). If they are ever merged, let it be as TWO `init`s in one file, never one `ctx`: a unified ctx would make the
// module "everything about touch", which is a theme, not a responsibility. The real coupling is narrow and explicit in
// this ctx: `getTouchMap`, `getStickTravelPx`, `getStickDeadPx` and `showTouchControls` — four read-only getters.
//
// ======================= DECIDING ≠ DOING =======================
// Two parts are PURE and kept apart, the same move `input/keydown.ts` made with `decideKeydown`:
//   · `decideTouch(action, on, snapshot) -> TouchDecision` — given (action, P1's scheme, the players' schemes, the keys
//     already held) there is ONE answer. No DOM, no pointer, no `window`: it runs in the `node` project.
//   · `crossDirsAt` / `stickDirsAt` / `stickKnobOffset` — pointer position + the element's rectangle → the set of
//     directions on. Dead zone, quadrants and the dead zone's edge become test cases.
//   · `initTouchBindings(ctx).attach()` — the IMPURE half: pointer capture, `preventDefault`, `classList`,
//     `setTimeout`. The only part that needs a real browser.
//
// ======================= ONE ACTION → EDGE TABLE, AND ONE EASY-MODE RULE =======================
// The keyboard, the pad and touch raise edges from the same table and the same guard (`input/edges`). They used to be
// three hand-written copies, and touch's forgot Easy mode: `runEdge` is not running speed but the trigger that clings
// to and lets go of a wall, so a child in Easy mode (which exists for motor difficulty) could climb by the screen
// button and not by keyboard or pad. One table leaves the divergence nowhere to come back.
//
// ======================= WHAT STAYED OUT, AND WHY =======================
//  · `hideTouchControls`/`showTouchControls` belong to `input/touch.ts`. Here `showTouchControls` is only CALLED (touch
//    reveals the buttons); hiding belongs to whoever knows the keyboard took over.
//  · The demo's `attractOnInput()` does not become pure, for the same reason as in `keydown.ts`'s header: it DECIDES AND
//    ACTS in one call (resets idleness, ends the demo, returns whether it ended). It stays in the listener.
//  · The d-pad's PHYSICAL geometry (how many px the travel is, how many px the stick's dead zone is) is
//    `input/touch.ts`'s, recomputed on every `applyPadPhysical()`. It comes in by getter and is read ON EVERY MOVE —
//    turning the device mid-gesture changes the travel on the next gesture.
//  · The CROSS's dead zone, by contrast, is not configurable: 18% of the side (`CROSS_DEAD_FRACTION`).
//
// ======================= BOOT-ORDER TRAPS =======================
// `initTouchBindings(ctx)` touches no DOM: it only closes over the `ctx` and returns the api. Every effect is in
// `attach()`, which is where `#touch-controls` is looked up (and where the whole function gives up if it is missing).
// Even so, the ctx is almost all GETTERS: what the host REASSIGNS (the players, the controls) comes in by getter, and
// what is a `const` mutated in place (`keys`) comes in by VALUE.
// REGISTRATION ORDER: `attach()` installs a CAPTURE `pointerdown` on the window, which is what ends a demo on the first
// touch; registering later only matters if another window pointer listener is ever born in between.
//
// NO I/O ON IMPORT: the module body only declares frozen constants and pure functions.

/* ===================== minimal interfaces ===================== */

/** `ui/dom.ts` `$` — injected; the module never reaches `document`. */
import { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
import type { TransportName } from './transport-in-use.js';
import { fromCentre, type RectLike } from './pointer-space.js';
import type { PlayerView } from '../core/entity.js';
import type { DomQuery } from '../core/dom-query.js';
import type { KeyScheme } from '../core/entity.js';
// `isAction` guards the door: the `act` arrives as a string from a `data-` of the touch markup, and since #118 the
// scheme only accepts the fourteen positions. A string that is not a position returns `null` — the touch does nothing,
// which is what this function's header promises.
import { isAction, type Action } from '../core/actions.js';
// `DomQuery` lives in `core/dom-query`: this line was copied into SIXTEEN modules, and the copies drifted.
// Re-exported for whoever already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** action -> list of physical codes. */
// `KeyScheme` lives in `core/entity`: the entity declares `ctrl: KeyScheme | null`, so it is the owner. The same line was
// written in SIX modules. Re-exported for whoever already imported it from here.
export type { KeyScheme } from '../core/entity.js';

/** The six input edges touch raises on the player (consumed and cleared by the game's physics). */
export type EdgeFlag = 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge';

/** An edge to raise: which player (POSITION in the array) and which flag. */
export interface EdgeRaise { playerIndex: number; edge: EdgeFlag }

/** What this module reads (and writes) of a player — and ONLY that. DERIVED from core/entity.
 *  `easy`: whoever is in Easy mode raises no `runEdge`, and so does not cling to the wall — the same rule as the
 *  keyboard and the pad, which is exactly the one that once drifted across three copies. See the header. */
export type TouchBindPlayer = PlayerView<'ctrl'>
  & Partial<PlayerView<'easy' | 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge'>>;
/*
 * ⚠️ THE SIX EDGES AND `easy` ARE OPTIONAL: requiring them would force `createGame` — whose players are
 * `{ ctrl, audioSink? }` — to hang PLATFORMER vocabulary (`jumpEdge`, `swapEdge`) on a quiz's player for the pad to
 * exist. That is what ADR-0145 D4 refuses: `jumpEdge` stays on `Player` for whoever jumps, and whoever does not jump
 * never declares it.
 *
 * 📌 IT DOES NOT CHANGE WHAT THE MODULE DOES: `edgeAllowed` accepts an undefined `easy`, and writing `p[edge] = true` on
 * a player without the edge leaves a flag nobody reads — harmless.
 */

/** EVERYTHING the decision needs to know about the world, in one object, built BEFORE any effect. */
export interface TouchBindSnapshot {
  /** Player 1's scheme (remappable). The key a screen button holds comes from it, and only it: touch is always P1,
   *  even with several screens. */
  controls: KeyScheme;
  /** the live array of players: edges are raised on ALL who have the code in their own scheme. */
  players: readonly TouchBindPlayer[];
  /** `input/state.ts`'s `keys`: the keys held NOW (every transport's, mixed). */
  heldKeys: ReadonlySet<string>;
}

/** Re-exported: the definition lives in `input/pointer-space`, with the arithmetic that uses it (issue #105). */
export type { RectLike } from './pointer-space.js';

/** The d-pad's four physical directions, on or off. */
export interface DirSet { left: boolean; right: boolean; up: boolean; down: boolean }

/** A pointer event, reduced to what this module reads (a real `PointerEvent` is assignable to this). */
export interface PointerLike { pointerId: number; clientX: number; clientY: number; preventDefault(): void }

/**
 * The single answer: what this touch MEANS.
 *
 * 🔴 THE CURRENCY OF THIS DECISION IS THE POSITION, NOT THE KEY (ADR-0223). Touch PRESSES the virtual controller, the
 * single door, and the key is an effect of the press written in one place — a screen button that pretended to be the
 * keyboard never reached a cartridge that listens to `onCommand`, because the root's window listener leaves `toque`
 * out.
 *
 * ⚠️ AND A POSITION WITH NO MAPPED KEY IS NOT A `noop`. The map is the GAME's, not the keyboard's (ADR-0111), so a
 * position the cartridge declared reaches it even if the child has no key for it.
 */
export type TouchDecision =
  /** an empty slot, an action that does not exist, or RELEASING `pause` — nothing happens. */
  | { kind: 'noop' }
  /** `pause` is the only special case: it is not a position, it calls `togglePause()` directly (and only on PRESS). */
  | { kind: 'pause' }
  /** press. `addKey=false` = the key was ALREADY held (another finger, or the keyboard): no edge is raised again — that
   *  is what makes this an EDGE and not a state. `hideTips` is independent. */
  | { kind: 'press'; action: Action; addKey: boolean; edges: EdgeRaise[]; hideTips: boolean }
  /** release. It lowers NO edge (the game's physics clears the edges). */
  | { kind: 'release'; action: Action };

/* ===================== PURE (no DOM — node project) ===================== */

/** Action → edge: the ONE table keyboard, pad and touch share (`input/edges`), re-exported under touch's old name. */
export { EDGE_BY_ACTION as TOUCH_EDGE_BY_ACTION } from './edges.js'; // the SAME table as the other two paths

/** `?touch=1` in the URL forces the touch controls to show on a desktop (the Dev's testing shortcut). */
const TOUCH_FORCE_RE = /[?&]touch=1/;

/** The `?touch=1` predicate, isolated so the test does not repeat the regex. */
export function wantsForcedTouch(search: string): boolean {
  return TOUCH_FORCE_RE.test(search || '');
}

/**
 * Which KEY does this screen button's position hold? The 1st in Player 1's scheme for that action — the 1st and not all,
 * because only one has to enter `keys` for the whole game to react. Remapping the keyboard remaps touch along with it,
 * for free: it is the same table.
 * `null` = the action is not in the scheme (or the touch map's slot is empty) → no key, and so no edge.
 */
export function codeForAction(act: string | undefined | null, controls: KeyScheme): string | null {
  if (!act || !isAction(act)) return null;
  const list = controls[act];
  return (list && list[0]) || null;
}

/**
 * The edges this touch raises, and on whom.
 *
 * WITH THE EASY-MODE GUARD (`edgeAllowed`, from `input/edges`), the same as the keyboard and the pad: `runEdge` is the
 * trigger that clings to and lets go of a wall, not running speed, so without the guard a child in Easy mode could
 * climb by the screen button and not by keyboard or pad.
 *
 * `p.ctrl[a] || []` and not a raw `p.ctrl[a]`: a scheme without the action turns a TypeError into a no-op — the same
 * choice `input/keydown`'s `edgesFor` makes, for the same reason.
 */
export function touchEdgesFor(act: string, code: string, players: readonly TouchBindPlayer[]): EdgeRaise[] {
  const out: EdgeRaise[] = [];
  players.forEach((p, idx) => {
    if (!p.ctrl) return; // a player with no scheme (screen not activated) gets no edge
    for (const [a, edge] of EDGE_BY_ACTION) {
      if (a !== act) continue;
      if (!edgeAllowed(a, p.easy)) continue; // Easy: no running (input/edges.ts)
      if ((p.ctrl[a] || []).includes(code)) out.push({ playerIndex: idx, edge });
    }
  });
  return out;
}

/**
 * THE DECISION. A gesture (mapped action + press/release) + the world → what it means.
 * `pause` first, because it is the only one that is not a position. Then the position and its key; without a key, the
 * press still happens, with no edge.
 */
export function decideTouch(act: string | undefined | null, on: boolean, s: TouchBindSnapshot): TouchDecision {
  if (act === 'start') return on ? { kind: 'pause' } : { kind: 'noop' }; // RELEASING START does not unpause
  // ⚠️ THE SLOT MAY BE EMPTY OR CARRY A STRING THAT IS NOT A POSITION: the value comes from a markup `data-`, and since
  // #118 the scheme only accepts the fourteen. Then there really is nothing to press — a VALID position with no mapped
  // key does not land here.
  if (!act || !isAction(act)) return { kind: 'noop' };
  if (!on) return { kind: 'release', action: act };
  const code = codeForAction(act, s.controls);
  // EDGE: only the FIRST time the code enters `keys`. If the keyboard (or the other thumb) already held it, touch does
  // not raise the edges again — but `hideTips` runs all the same. With no key there is no edge to raise.
  const fresh = !!code && !s.heldKeys.has(code);
  return {
    kind: 'press', action: act, addKey: fresh,
    edges: fresh && code ? touchEdgesFor(act, code, s.players) : [],
    hideTips: act === 'action2',
  };
}

/* --- d-pad geometry (pure: position + rectangle → directions) --- */

/** The CROSS's dead zone: ~18% of the SIDE from the centre, on each axis. See the note on `crossDirsAt` about `width`
 *  also counting for the vertical axis — it is a real asymmetry. */
export const CROSS_DEAD_FRACTION = 0.18;

/**
 * Cross (D-pad): where the finger is → which directions turn on. A neutral core so brushing the middle does not fire.
 * The four comparisons are INDEPENDENT: outside the core, a diagonal turns on TWO directions (which gives a physical
 * 8-sector D-pad's behaviour). The exact centre turns on none.
 *
 * Including the asymmetry: both axes' dead zone comes from `rect.width` — the height never enters. On a square cross
 * (what the CSS `--dpad-span` produces) it is the same; on a flattened one, the vertical core would be proportionally
 * larger or smaller than the horizontal. Noted, not fixed.
 */
export function crossDirsAt(px: number, py: number, rect: RectLike): DirSet {
  const { dx, dy } = fromCentre(px, py, rect);
  const dead = rect.width * CROSS_DEAD_FRACTION;
  return { left: dx < -dead, right: dx > dead, up: dy < -dead, down: dy > dead };
}

/**
 * Virtual stick: the cross's rule, but the dead zone comes in PX from `input/touch.ts` (derived from the configurable
 * mm), not as a fraction of the element.
 */
export function stickDirsAt(px: number, py: number, rect: RectLike, deadPx: number): DirSet {
  const { dx, dy } = fromCentre(px, py, rect);
  return { left: dx < -deadPx, right: dx > deadPx, up: dy < -deadPx, down: dy > deadPx };
}

/**
 * Where the stick's knob goes (px, relative to the base's centre): it follows the finger up to the `travelPx` limit
 * and STOPS there, keeping the angle (a radial clip, not per axis — hence `hypot` and not `clamp`).
 * The `|| 1` avoids a division by zero when the finger lands on the exact centre.
 */
export function stickKnobOffset(px: number, py: number, rect: RectLike, travelPx: number): { x: number; y: number } {
  const { dx, dy } = fromCentre(px, py, rect);
  const m = Math.hypot(dx, dy) || 1;
  const f = m > travelPx ? travelPx / m : 1;
  return { x: dx * f, y: dy * f };
}

/* ===================== IMPURE (DOM + pointer — through initTouchBindings(ctx)) ===================== */

/**
 * The event-LISTENING door, generic over the event map because that is what `window` is.
 *
 * ⚠️ NOT `fn: (e: never) => void`: a `never` parameter looks like "the listener does not look at the event", but by
 * contravariance it demands that the TARGET accept anything, and the real `window` declares `ev: any`, which is not
 * assignable to `never`. That cost a cast at every registration inside the engine and a one-line adapter in every
 * consumer.
 *
 * Generic over `WindowEventMap`, `window` satisfies it DIRECTLY and each listener gets the right event: `'keydown'`
 * matches `KeyboardEvent`, `'pointerdown'` matches `PointerEvent`. No cast and no adapter.
 *
 * `WindowEventMap` is a `lib.dom` global, enabled in `tsconfig` — there is no import to make, and so no new dependency
 * edge.
 */
export interface EventTargetLike {
  addEventListener<K extends keyof WindowEventMap>(
    type: K,
    fn: (e: WindowEventMap[K]) => void,
    opts?: boolean | { capture?: boolean; passive?: boolean },
  ): void;
}

/** How long START holds the action when it is momentary (not `pause`). */
export const START_TAP_MS = 140;

export interface TouchBindingsCtx {
  /** `ui/dom.ts` `$` — injected; the module never reaches `document`. */
  $: DomQuery;
  /** `window`, only for the two global "there was a finger/pointer" listeners. */
  win: EventTargetLike;
  /** `location.search` — read by getter so the test can lie without touching the URL. */
  getSearch: () => string;
  /** Player 1's scheme (memoised on the other side), read on every touch. */
  getControls: () => KeyScheme;
  /** the live array of players. A getter: the host may repopulate it on a restart. */
  getPlayers: () => readonly TouchBindPlayer[];
  /*
   * ⚠️ THIS MODULE NEVER WRITES `keys` (ADR-0109): a code put there by TOUCH would be indistinguishable from one put by
   * the keyboard, and the latch, which is a property of the DEVICE, could not be resolved (issue #114 §C). Writing goes
   * through `press`/`release`, which stamp the source; reading goes through `heldKeys`.
   *
   * 📌 Received and not imported: a consumer can mount touch without the engine's global state (a test, a second
   * consumer), and these doors are what it injects.
   */
  /**
   * THE SINGLE DOOR TO THE CARTRIDGE (ADR-0223): press a POSITION. Answers whether the press reached the GAME — `false`
   * means a menu took it.
   *
   * 🔴 One decision, taken once: what the controller does for touch is what it does for the eyes and the voice, as
   * ADR-0111 decided — with a menu open the position becomes the menu's key, in play it holds the child's key AND
   * delivers the command to the cartridge. A second copy of that decision here is how the two doors once came to
   * disagree.
   *
   * 📌 NO SEAT, and the absence is the statement: this engine's multiplayer is on SEPARATE screens (pillar 7), so a
   * device with a pad has ONE finger and ONE seat. A signature accepting a seat would offer a capability this transport
   * does not have, and nobody could exercise it to prove it.
   */
  press: (action: Action, source: TransportName) => boolean;
  /** Release the POSITION. The controller lets go of the key it held and delivers the release — only for a press the game heard. */
  release: (action: Action, source: TransportName) => void;
  /**
   * THIS EDGE IS THIS PLAYER'S, AND IT CAME FROM TOUCH (ADR-0113 clause 4, issue #127) — `input/state.playerEdge`.
   *
   * 🔴 REQUIRED, and it is where the device switch becomes VISIBLE: touch is the transport the child uses beside the
   * keyboard, and without this line the automaton answers `teclado` even with the finger on the screen — so the latch
   * read would be the keyboard's, on the wrong device.
   */
  playerEdge: (player: number, source: TransportName) => void;
  /**
   * The set for READING — the pure decision asks which keys are already held.
   *
   * ⚠️ `ReadonlySet` and not `Set`: READING the set was never the problem; WRITING into it is what erased the source.
   * The type says so, and a raw write coming back here stops compiling instead of slipping by.
   */
  readonly heldKeys: ReadonlySet<string>;
  /** The demo: resets idleness and ends the demo; `true` = the touch was only to wake it up. A function, called when a
   *  touch happens, because the demo may be built after this module. */
  attractOnInput: () => boolean;
  /** `input/touch.ts`: touch REVEALS the buttons (`hideTouchControls` belongs to whoever sees the keyboard take over). */
  showTouchControls: () => void;
  /** Hides the host's start tips on a jump; the root has none and passes a no-op. */
  hideTips: () => void;
  togglePause: () => void;
  /** The SELECT pill opens the pause menus (ADR-0155). Absent, the pill does nothing — only the root that draws it wires it. */
  openMenus?: () => void;
  /** `input/touch.ts:getTouchMap()` — slot → action, remappable. Read ON EVERY event: a remap in the panel counts on the
   *  next touch, without rewiring any listener. */
  getTouchMap: () => Record<string, string>;
  /** The action of the `start` slot — the root reads it from the live touch map. */
  getStartAction: () => string | undefined;
  /** `input/touch.ts`: the stick's travel and dead zone, in px, recomputed on every `applyPadPhysical()`. */
  getStickTravelPx: () => number;
  getStickDeadPx: () => number;
  /** `setTimeout` — injectable only so the START test does not wait 140 ms of clock. */
  defer?: (fn: () => void, ms: number) => void;
}

export interface TouchBindingsApi {
  /** The pure decision, with the world of now. Exposed so the test can compare without applying. */
  decide: (act: string | undefined, on: boolean) => TouchDecision;
  /** The whole dispatch: decides and stamps it on the world. */
  doTouch: (act: string | undefined, on: boolean) => void;
  /** What the START button does on a click (pause, or press-and-release after `START_TAP_MS`). */
  pressStart: () => void;
  /** Reveals the buttons by force, for testing on a desktop. */
  revealForTests: () => void;
  /** Wires everything: the two global listeners, the `.touch-btn`s, START, the stick and the cross. */
  attach: () => void;
  /**
   * Wires ONLY what is inside `#touch-controls` — buttons, START, stick, cross —, without the window listeners. It is
   * what gets called after the pad is REDRAWN (another cartridge's `mount()`, ADR-0142).
   *
   * ⚠️ IT EXISTS BECAUSE `attach()` TWICE PILES LISTENERS ON THE WINDOW: a hub mounting ten cartridges would end up with
   * twenty `pointerdown` listeners. The pad's nodes are new on every drawing, and their listeners die with the old
   * nodes; the window's do not.
   */
  rewire: () => void;
}

export function initTouchBindings(ctx: TouchBindingsCtx): TouchBindingsApi {
  const later = ctx.defer || ((fn: () => void, ms: number) => { setTimeout(fn, ms); });

  function snapshot(): TouchBindSnapshot {
    return { controls: ctx.getControls(), players: ctx.getPlayers(), heldKeys: ctx.heldKeys };
  }

  function decide(act: string | undefined, on: boolean): TouchDecision {
    return decideTouch(act, on, snapshot());
  }

  /** The IMPURE half: takes the ready decision and stamps it on the world. The press first, then the edges, and
   *  `hideTips` after everything. */
  function apply(d: TouchDecision): void {
    if (d.kind === 'noop') return;
    if (d.kind === 'pause') { ctx.togglePause(); return; }
    if (d.kind === 'release') { ctx.release(d.action, 'toque'); return; }
    /*
     * 🔴 TOUCH PRESSES THE VIRTUAL CONTROLLER (ADR-0223). What a press means — going to the menu, holding the key,
     * delivering nothing — is exactly the decision `input/virtual-controller` exists to take ONCE: with a menu open the
     * position becomes the menu's key (ADR-0157), in play it holds the child's key AND delivers the command.
     *
     * 📌 ITS ANSWER IS WHAT SAYS THERE WAS PLAY. The question "is a menu open?" has one answer, the controller's — two
     * answers to one question is how the two doors once came to disagree.
     *
     * ⚠️ `'toque'` is the stamp, and it is ADR-0109's rule 2 kept executable: it is THIS transport whose latch turns on,
     * and the controller is what carries it to the key and the command.
     */
    if (!ctx.press(d.action, 'toque')) return; // a menu took the press: no edge and no tip to touch
    if (d.addKey) {
      const players = ctx.getPlayers();
      for (const { playerIndex, edge } of d.edges) {
        const p = players[playerIndex];
        // 📌 THE EDGE PER PLAYER, beside the flag it raises — and not once per touch: the same code may belong to more
        // than one seat (`d.edges` is built with `includes` over each one's scheme), and the transport in use is a
        // question PER CHILD. Marking only player 0 would give the first seat's latch to whoever plays in the second.
        // (The guard on `p` is defensive: `d.edges` comes from the same frame's players, so an index without one does
        // not happen today.)
        if (p) { p[edge] = true; ctx.playerEdge(playerIndex, 'toque'); }
      }
    }
    if (d.hideTips) ctx.hideTips();
  }

  function doTouch(act: string | undefined, on: boolean): void { apply(decide(act, on)); }

  function pressStart(): void {
    const a = ctx.getStartAction();
    if (a === 'start') { ctx.togglePause(); return; }
    doTouch(a, true);
    later(() => doTouch(a, false), START_TAP_MS); // a momentary action: press and release by itself
  }

  function revealForTests(): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc) tc.hidden = false;
  }

  /** The d-pad (stick or cross): one pattern — state per direction, dispatched only on a CHANGE. Without it, dragging
   *  the thumb inside the same quadrant would raise the edge again on every `pointermove`. */
  function makeDirGate(onChange: (dir: keyof DirSet, on: boolean) => void): {
    set: (dir: keyof DirSet, on: boolean) => void;
    apply: (dirs: DirSet) => void;
    reset: () => void;
  } {
    const state: DirSet = { left: false, right: false, up: false, down: false };
    const set = (dir: keyof DirSet, on: boolean): void => {
      if (state[dir] === on) return;
      state[dir] = on;
      onChange(dir, on);
    };
    return {
      set,
      apply: (dirs: DirSet) => { set('left', dirs.left); set('right', dirs.right); set('up', dirs.up); set('down', dirs.down); },
      reset: () => { (['left', 'right', 'up', 'down'] as const).forEach((d) => set(d, false)); },
    };
  }

  /* --- the diamond's .touch-btn buttons --- */
  function wireButtons(tc: HTMLElement): void {
    tc.querySelectorAll<HTMLElement>('.touch-btn').forEach((b) => {
      const slot = 'b' + (b.dataset.btn || ''); // the function comes from the (remappable) touchMap, not from a data attribute
      const down = (e: PointerLike): void => { e.preventDefault(); doTouch(ctx.getTouchMap()[slot], true); };
      const up = (e: PointerLike): void => { e.preventDefault(); doTouch(ctx.getTouchMap()[slot], false); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);   // the finger slid off: counts as a release
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e: Event) => e.preventDefault()); // holding does not open the system menu
    });
  }

  /**
   * Stick and cross share the WHOLE pointer lifecycle (capture, one finger at a time, release/cancel, losing the
   * capture). Only the direction arithmetic and the visual feedback differ — so both come in here and the difference
   * becomes two callbacks.
   */
  function wirePointerPad(
    el: HTMLElement,
    dirsAt: (px: number, py: number, rect: RectLike) => DirSet,
    onMove: ((px: number, py: number, rect: RectLike) => void) | null,
    onReset: (() => void) | null,
    onDirVisual: ((dir: keyof DirSet, on: boolean) => void) | null,
  ): void {
    let pid: number | null = null;
    const gate = makeDirGate((dir, on) => {
      doTouch(ctx.getTouchMap()[dir], on); // PHYSICAL direction → mapped function (the cross is remappable too)
      if (onDirVisual) onDirVisual(dir, on);
    });
    const at = (px: number, py: number): void => {
      const rect = el.getBoundingClientRect();
      if (onMove) onMove(px, py, rect);
      gate.apply(dirsAt(px, py, rect));
    };
    const reset = (): void => { if (onReset) onReset(); gate.reset(); pid = null; };
    el.addEventListener('pointerdown', (e: PointerLike) => {
      e.preventDefault();
      const id = e.pointerId;
      pid = id;
      // capture: the finger can leave the element without ending the gesture (it is what makes a d-pad usable)
      try { el.setPointerCapture(id); } catch { /* no pointer capture: the gesture still works over the element */ }
      at(e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e: PointerLike) => {
      if (pid !== e.pointerId) return; // one finger at a time: the second pointer is ignored, not contested
      e.preventDefault();
      at(e.clientX, e.clientY);
    });
    const end = (e: PointerLike): void => { if (pid !== e.pointerId) return; e.preventDefault(); reset(); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', reset); // a net: capture lost = release everything (nothing stays stuck)
    el.addEventListener('contextmenu', (e: Event) => e.preventDefault());
  }

  function attach(): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc) return; // without the buttons in the document there is nothing to wire

    // switching by modality: a touch/click SHOWS; the keyboard/pad HIDES (over there).
    if (wantsForcedTouch(ctx.getSearch())) ctx.showTouchControls();
    const onPointerDown = (): void => { if (ctx.attractOnInput()) return; ctx.showTouchControls(); }; // touch reveals (and ends the demo)
    const onTouchStart = (): void => { ctx.showTouchControls(); };
    ctx.win.addEventListener('pointerdown', onPointerDown, true);
    ctx.win.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });

    rewire();
  }

  function rewire(): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc) return;
    wireButtons(tc);

    const startBtn = ctx.$<HTMLElement>('#touch-start');
    if (startBtn) startBtn.addEventListener('click', pressStart);
    const selectBtn = ctx.$<HTMLElement>('#touch-select');
    if (selectBtn) selectBtn.addEventListener('click', () => ctx.openMenus?.());

    // stick: a base (the large circle) + a knob that slides toward the touched direction
    const stick = ctx.$<HTMLElement>('#touch-stick');
    const knob = stick && stick.querySelector<HTMLElement>('.touch-knob');
    if (stick && knob) {
      wirePointerPad(
        stick,
        (px, py, rect) => stickDirsAt(px, py, rect, ctx.getStickDeadPx()), // px/mm reread on every move
        (px, py, rect) => {
          const o = stickKnobOffset(px, py, rect, ctx.getStickTravelPx());
          knob.style.transform = `translate(${o.x}px,${o.y}px)`;
        },
        () => { knob.style.transform = 'translate(0,0)'; },
        null,
      );
    }

    // cross (the alternative to the stick): a surface split by hit-test, with a neutral core
    const cross = ctx.$<HTMLElement>('#touch-cross');
    if (cross) {
      const arms: Record<keyof DirSet, HTMLElement | null> = {
        up: cross.querySelector<HTMLElement>('.dpad-up'),
        down: cross.querySelector<HTMLElement>('.dpad-down'),
        left: cross.querySelector<HTMLElement>('.dpad-left'),
        right: cross.querySelector<HTMLElement>('.dpad-right'),
      };
      wirePointerPad(cross, crossDirsAt, null, null, (dir, on) => { arms[dir]?.classList.toggle('on', on); });
    }
  }

  return { decide, doTouch, pressStart, revealForTests, attach, rewire };
}
