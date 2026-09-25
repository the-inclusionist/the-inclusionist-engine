// SPDX-License-Identifier: AGPL-3.0-or-later
// input/keydown.ts — THE KEYBOARD ROUTER: what ONE key MEANS, here and now.
//
// The BUBBLING `keydown` listener a cartridge mounts (`initKeydown(ctx).attach()`) — the one point every key passes
// that was not intercepted before. It is not "the character's control": walking and jumping are the consequence of the
// LAST of the nine questions it asks. The first eight decide whether the key belongs to the game or to something else —
// demo, remapping, dialog, win screen, title menu, number of screens, pause, modal — and that SEQUENCE is the
// specification: the earlier one wins, and swapping two guards changes the game without breaking anything a build, a
// `tsc` or an eye could see. (The engine's own root has its own keyboard conductor, for the virtual controller.)
//
// ======================= DECIDING ≠ DOING =======================
// Given (key code, scene, who has a modal open, which dialog is visible, number of screens, key schemes) there is ONE
// answer about what the key means — and the `preventDefault`, the `click()`, the `togglePause()` come only AFTER that
// answer. With the two halves braided, each `if` mixing the question ("is a dialog open?") with the answer ("then hide
// and leave"), the precedence — the part that matters — could only be checked by playing.
//
// Here they are two separate objects:
//   · `decideKeydown(event, state) -> KeydownDecision` — PURE. No DOM, no PIXI, no audio, no `window`. It runs in the
//     `node` project. Each branch of the precedence is a test case, and the precedence BETWEEN branches (modal open AND
//     dialog visible: who wins?) is an assertion, not an anecdote.
//   · `initKeydown(ctx).onKeydown(e)` — the IMPURE half: takes the ready decision and stamps it on the world.
// It matters more here than anywhere, because what is at stake is the keyboard — the one modality EVERY person who
// plays without a mouse, without sight or without a pad depends on.
//
// ======================= WHAT STAYED OUT OF THE PURE PART, AND WHY =======================
// Two guards at the top do NOT fit in `decideKeydown`, and forcing them in would be a lie:
//   · `attractOnInput()` (the demo) — it DECIDES AND ACTS in one call: resets the idleness counter, ends the demo if it
//     is running, and returns whether it ended. There is no asking without touching.
//   · `handleCaptureKeydown(e)` (ui/settings-controls.ts) — likewise: if a remap is in progress, it WRITES the key into
//     the scheme and returns `true`.
// Both are the first two lines of `onKeydown`, in that order, and the test proving they come before everything is the
// wrapper's (with fake probes), not the pure function's.
// Reading the dialogs' VISIBILITY does not enter the pure part either: it is `querySelector` + `.hidden`. What enters is
// its RESULT (three booleans and an id), built by `snapshot()`.
//
// ======================= ⚠️ PAUSED, THIS LISTENER IS NOT REACHED FOR Escape =======================
// `ui/menu-nav.ts` registers its OWN `keydown` in the CAPTURE phase and calls `stopPropagation()`. With the game PAUSED,
// every key with a menu intent — Escape included — dies up there and never comes down here (menu-nav's header, DEFECT
// 2): the `escapeTarget()` chain and Escape's `togglePause()` are dead code while paused; whoever closes is always the
// top of the z-index stack.
// THIS IS CURRENT BEHAVIOUR AND IT IS KEPT — not a bug to fix here, but a safety net the future fix will need (removing
// the `stopPropagation()` with nothing else makes this module's `if(Escape||Enter) togglePause()` UNPAUSE the game with
// Help open). The tests anchor it as it is: `decideKeydown` returns the decision IT would take, and the wrapper test
// documents that, paused, it is not consulted because the event does not arrive. See `tests/keydown.node.test.js`.
//
// ======================= WHAT CAME ALONG, AND WHAT DID NOT =======================
//  · `keyup` CAME. It is the exact other half of the keydown's hold: with the two apart, whoever reads "when a key
//    enters `keys`" would have to look for the exit in another file. `attach()` installs both, in the same order.
//  · `blur` did NOT come. It looks like a sibling and is not: `keys` also holds codes the virtual controller writes
//    for a position the eyes pressed (`input/virtual-controller`), so letting go on `blur` is a lifecycle net of the
//    WINDOW over a set that is not only the keyboard's. It lives in the root (`boot/create-game`), which dispatches
//    the keyup each keyboard-held key is owed and leaves the camera's alone.
//  · The Escape chain, the overlay registry and `closeById` belong to `ui/settings-panel.ts`. This module CONSUMES them
//    (`escapeTarget`, `closeOverlayById`) and does not reimplement them — the same discipline as menu-nav.
//  · `whichPlayer`/`actionOf`/`controlsState` belong to `input/keyboard-runtime.ts`, which is what knows key schemes.
//    Here they come in injected and are only consulted. `controlsState()` is MEMOISED there: this module calls it once
//    per key.
//  · The title menu's navigation (`navTitle`) is the game's; the pause menu's is `ui/menu-nav.ts`'s. This module
//    decides THAT the key is navigation and for WHOM — it never draws a menu.
//
// ======================= INJECTION AND BOOT ORDER =======================
//   1. REGISTRATION ORDER. Bubbling listeners on the same target fire in the order they were registered; the only
//      capture one (menu-nav) already wins by phase. Registering elsewhere changes nothing as long as no other window
//      listener is born in between — an invisible dependency worth not creating.
//   2. LAZINESS. The whole ctx is `() => …`: no value is resolved at mount, only on the first key. A host that builds
//      the demo, the panels or the pad AFTER mounting this module works; passing them by VALUE would read them before
//      they exist.
// What the host REASSIGNS comes in by GETTER (`oneButton`, `numPlayers`, `players`, the controls state). `keys` is a
// `const` of `input/state.ts`, mutated in place — it comes in by VALUE (the same object forever).
//
// One behaviour note, declared: `snapshot()` reads the three `hidden` flags and `escapeTarget()` at once, rather than in
// short circuit. That is at most four extra `querySelector` per key, all pure reads (`escapeTarget` only walks the
// registry and tests `.hidden`). Nothing observable changes; noted because measuring later costs more than writing now.
//
// NO I/O ON IMPORT: the module body only declares frozen tables and pure functions. Every effect goes through
// `initKeydown` (and even it does nothing until `attach()`).

import type { Translate } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';
import { EDGE_BY_ACTION, edgeAllowed, type EdgeFlag } from './edges.js';

/* ===================== minimal interfaces ===================== */

/** What this module reads and does with a `keydown` `KeyboardEvent`. */
export interface KeydownEventLike {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  preventDefault(): void;
  /**
   * Did the browser see the person press? (ADR-0109) — OPTIONAL, and the optionality is the decision.
   *
   * ⚠️ Making it required would break every existing test double, for a false reason: they describe the keyboard
   * decision, which does not depend on this. What the absence means is written in `input/synthetic-source` — "I
   * asserted nothing", whose answer is `undefined` and not `'teclado'`.
   */
  isTrusted?: boolean;
}

/** `keyup` only needs the code. */
export interface KeyupEventLike { code: string }

/** The six input edges keydown raises on the player (consumed and cleared by the game's physics). */
// `EdgeFlag` comes from input/edges.ts — it used to be declared here and in touch-bindings.

/**
 * What this module reads (and writes) of a player — and ONLY that. DERIVED from core/entity.
 *
 *  · `i`        — the player's OWN index. Routing goes by it, not by the position in the array.
 *  · `ctrl`     — the key scheme; `null` before assignControls.
 *  (There is no `quiz` — ADR-0033. The open challenge arrives through `modalOpen` in the snapshot, and what the key
 *   MEANS inside it is the game's decision. See the "MODAL" block below.)
 *  · `waiting`  — a screen on standby (multi-screen): THAT player's 1st key joins the match.
 *  · `easy`     — Easy mode (motor difficulty): no running, and the Ctrl/Shift shortcuts in solo.
 */
export type KeydownPlayer = PlayerView<
  'i' | 'ctrl' | 'waiting' | 'easy' |
  'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge'
>;

/** The subset of input/keyboard-runtime.ts's `ControlsState` the decision consults (`controls` stays out: only the six
 *  aliases and the flattened list are used here). */
export interface ControlsSnapshot {
  action2: string[]; left: string[]; right: string[]; up: string[]; down: string[]; action1: string[];
  gameKeys: string[];
}

/** The title menu's navigation intent — `NavKeys` from input/edges, under the local name this module reads by (it was a
 *  fourth structural copy under another name). */
import type { NavKeys as TitleNav } from './edges.js';

/** EVERYTHING the decision needs to know about the world, in one object, built BEFORE any effect. */
export interface KeydownSnapshot {
  /* THE SCENE, as two booleans (ADR-0030 C3), not a `phase: string`: with a string, `s.phase === 'titel'` is an error
     nowhere, only a key that never arrives. These two questions are the only ones the keyboard decision asks the
     scene. */
  /** Is the title screen on top? (Only Player 1 picks the game; the others hear a notice.) */
  titleScreen: boolean;
  /** Is a game in progress — running OR paused? (Alt+N and the pause key need this, and no modal open.) */
  inGame: boolean;
  numPlayers: number;
  players: readonly KeydownPlayer[];
  /**
   * Is a MODAL open for the player at each POSITION? — the answer, beside the players (ADR-0033).
   *
   * Not `players[i].quiz`: reading that field would force `core/entity.Player` — the ENGINE's canonical entity — to
   * DECLARE it, and every game in the catalogue to have a "quiz" of that shape.
   *
   * Why here and not two ctx functions: this module already builds a snapshot before any effect, and adding ctx to
   * whoever has a snapshot is one more piece. Why a PARALLEL array and not a field on `KeydownPlayer`: that type is a
   * `PlayerView<>` derived from `Player`, so the field would be required on the entity again — a better name, the same
   * wrong place. And why not wrap the players in a copy: this module WRITES into them (the six edges), and a copy would
   * lose the write.
   */
  modalOpen: readonly boolean[];
  controls: ControlsSnapshot;
  /** input/state.ts's `keys`: the keys held NOW (every transport's, mixed). */
  heldKeys: ReadonlySet<string>;
  /** motor empathy: one game button at a time. */
  oneButton: boolean;
  /** `overlays.escapeTarget()` — the id of the 1st REGISTERED dialog that is open, or null. */
  escapeTargetId: string | null;
  touchCfgVisible: boolean;
  padWizVisible: boolean;
  winVisible: boolean;
  actionOf(code: string, playerIndex: number): string | null;
  whichPlayer(code: string): number;
}

/* ===================== the decision ===================== */

/* ===================== MODAL: the engine delivers the INTENT, the game decides (ADR-0033) =====================
 *
 * An intent and nothing more. Carrying the MEANING — "up" moves three cells in a three-column grid, "up" dictates a
 * Braille cell — would put one game's grid inside the keyboard dispatch. Translating a key into a direction, through the
 * player's remappable scheme, is engine work; deciding what a direction does in a challenge is the game's.
 */
export type ModalIntent = 'left' | 'right' | 'up' | 'down' | 'confirm' | 'erase';

/** An edge to raise: which player (POSITION in the array) and which flag. */
export interface EdgeRaise { playerIndex: number; edge: EdgeFlag }

/**
 * The key just pressed AND WHO PRESSED IT, as one value — because ADR-0109's rule is about the PAIR and never about the
 * key: a key with no transport is no device's edge, and inventing `teclado` for it would let a touch key turn off the
 * latch of whoever plays by gaze. `transport` is `undefined` for an event nobody signed — every real key.
 */
interface PressedKey { readonly code: string; readonly transport: TransportName | undefined }

/**
 * The single answer: what this key MEANS. `kind` is the precedence branch that won — and it is that word, not the
 * effect, that the precedence tests assert.
 */
export type KeydownDecision =
  /** 1st · a REGISTERED dialog open: Escape closes (`closeId`), any other key is swallowed. */
  | { kind: 'overlay'; closeId: string | null; preventDefault: boolean }
  /** 2nd · `#touchcfg` visible: Escape hides, the rest is swallowed. */
  | { kind: 'touchcfg'; close: boolean; preventDefault: boolean }
  /** 3rd · `#padwiz` (the pad wizard) visible: Escape CANCELS (`save:false`), the rest is swallowed. */
  | { kind: 'padwiz'; close: boolean; preventDefault: boolean }
  /** 4th · win screen: jump (any player's) or Escape/Enter press "Play again". */
  | { kind: 'win'; again: boolean; preventDefault: boolean }
  /** 5th · title screen: `wait` = multi-screen and the key is another player's (only P1 commands). */
  | { kind: 'title'; wait: boolean; nav: TitleNav | null; preventDefault: boolean }
  /** 6th · Alt+1..4 = number of screens. */
  | { kind: 'screens'; count: number; preventDefault: boolean }
  /** 7th · Escape/Enter = pause. */
  | { kind: 'pause'; preventDefault: boolean }
  /** 8th · a modal open: the key acts on its OWNER's modal (`playerIndex` = position in the array). */
  | { kind: 'modal'; playerIndex: number; intent: ModalIntent | null; preventDefault: boolean }
  /** 9th · normal play. */
  | { kind: 'play'; gameKey: boolean; wake: number[]; edges: EdgeRaise[]; releaseKeys: string[]; preventDefault: boolean };

/* --- tables (frozen: they are data, and a named `Set` keeps the table auditable from outside) --- */

/** Easy (SOLO): Ctrl = Special, Shift = Swap power. Not Win/Alt/AltGr, on purpose. */
export const EASY_SHORTCUTS: ReadonlySet<string> = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);
/** Alt + the digit row (NOT the numeric keypad) = 1..4 screens. Alt is free: solo does not use it. */
export const SCREEN_DIGITS = /^Digit[1234]$/;
/** Pause: Escape or the MAIN Enter. `NumpadEnter` does NOT pause. */
export const PAUSE_KEYS: ReadonlySet<string> = new Set(['Escape', 'Enter']);
// The table lives in input/edges.ts, shared with gamepad and touch-bindings. Re-exported under the old name because the
// engine's tests import it from here.
export { EDGE_BY_ACTION } from './edges.js';

/* --- pure predicates (exported: the test imports the piece instead of repeating the expression) --- */

/** Does the key count as JUMP for anybody? P1's alias OR any player's `action2` (it is what makes "anyone can press
 *  Play again" and "anyone confirms on the title" true). */
export function isJumpKey(code: string, s: KeydownSnapshot): boolean {
  return s.controls.action2.includes(code) || s.players.some((_p, i) => s.actionOf(code, i) === 'action2');
}

/** Is the key a GAME key? The flattened alias OR some player's scheme. It does NOT include the Easy shortcuts: those
 *  are added apart (`isEasyShortcut`). */
export function isGameKeyCode(code: string, s: KeydownSnapshot): boolean {
  return s.controls.gameKeys.includes(code)
    // `arr &&` because a position with no reach is `null` since #118 — and `null.includes` would be an exception on the
    // keyboard path, that is, the game ceasing to answer any key.
    || s.players.some((p) => !!p.ctrl && Object.values(p.ctrl).some((arr) => !!arr && arr.includes(code)));
}

/** Easy's accessibility shortcuts exist only in SOLO (`numPlayers<=1`) and only for Player 1. */
export function isEasyShortcut(code: string, s: KeydownSnapshot): boolean {
  return !!s.players[0]?.easy && s.numPlayers <= 1 && EASY_SHORTCUTS.has(code);
}

/**
 * The title menu intent. Note the ASYMMETRY, kept as it is: `up`/`down` accept ArrowUp/ArrowDown ON TOP of the
 * configured alias, `left`/`right` do not accept ArrowLeft/ArrowRight. It does not show in the factory scheme (solo
 * already has the arrows on all four sides); it shows for whoever REMAPS — remap left to KeyA and the arrow stops moving
 * in the menu, while up keeps working both ways. It is a test case in tests/keydown.node.test.js, and a candidate for a
 * fix, not for a silent "cleanup".
 */
export function titleNavOf(code: string, s: KeydownSnapshot, action2: boolean): TitleNav {
  return {
    yes: action2 || code === 'Enter',
    no: code === 'Escape' || s.players.some((_p, i) => s.actionOf(code, i) === 'action3'),
    up: s.controls.up.includes(code) || code === 'ArrowUp',
    down: s.controls.down.includes(code) || code === 'ArrowDown',
    left: s.controls.left.includes(code),
    right: s.controls.right.includes(code),
  };
}

/** Was any intent expressed? One definition in input/edges; here only the name this module always had. */
import { hasNavIntent as hasTitleIntent } from './edges.js';
import type { EventTargetLike } from './touch-bindings.js'; // the listening door, generic over WindowEventMap
import type { DomQuery } from '../core/dom-query.js';
import type { TransportName } from './transport-in-use.js';
// ⚠️ IMPORTED AND NOT INJECTED, unlike the three writers below, and the line between them is this: `sourceOfEvent` is a
// PURE function of the event — it touches no state the cartridge owns. The writers touch `input/state`, which is mutated
// in place and shared, and that is why they keep coming in through the ctx.
import { sourceOfEvent } from './synthetic-source.js';
export { hasNavIntent as hasTitleIntent } from './edges.js';

/**
 * Who owns the modal this key commands? Returns the POSITION in the array, or -1.
 * A player's key goes to THAT player's modal (and only if they have one open); a generic key falls to Player 1. A key of
 * a player WITHOUT an open modal does not fall to P1 — it goes down to normal play, which is what lets their match go on
 * while the other solves the challenge.
 */
export function modalOwnerIndex(code: string, s: KeydownSnapshot): number {
  const owner = s.whichPlayer(code);
  if (owner >= 0) return s.modalOpen[owner] ? owner : -1;
  return s.modalOpen[0] ? 0 : -1;
}

/**
 * Which INTENT this key expresses inside its owner's modal. `owner` is the position in the array; `generic` says whether
 * the key arrived with no owner (then the six readings use P1's aliases instead of the remapped action).
 *
 * What a direction DOES inside the challenge (move one cell or three, dictate a Braille cell) is grid, and grid is the
 * game's.
 */
/*
 * The six readings, IN THIS ORDER — and the order is the rule: with a scheme where the same key is `left` and jump,
 * `left` wins. Each row says which ACTION means that intent and, for a key with no owner, which alias list carries it.
 * ⚠️ SPECIAL = erase the last syllable/letter, and its generic reading comes from `pl.ctrl` and NOT `controls` — an
 * asymmetry kept, because `ControlsSnapshot` has no `action3` alias.
 */
const MODAL_READINGS: readonly {
  readonly intent: ModalIntent;
  readonly action: string;
  readonly alias: (s: KeydownSnapshot, pl: KeydownPlayer) => readonly string[];
}[] = [
  { intent: 'left', action: 'left', alias: (s) => s.controls.left },
  { intent: 'right', action: 'right', alias: (s) => s.controls.right },
  { intent: 'up', action: 'up', alias: (s) => s.controls.up },
  { intent: 'down', action: 'down', alias: (s) => s.controls.down },
  { intent: 'confirm', action: 'action2', alias: (s) => s.controls.action2 },
  { intent: 'erase', action: 'action3', alias: (_s, pl) => pl.ctrl?.action3 || [] },
];

export function modalIntentOf(code: string, s: KeydownSnapshot, owner: number, generic: boolean): ModalIntent | null {
  const pl = s.players[owner];
  if (!pl) return null;
  const act = generic ? null : s.actionOf(code, pl.i); // the player's own `i`, not the position
  const read = MODAL_READINGS.find((r) => (act ? act === r.action : r.alias(s, pl).includes(code)));
  return read ? read.intent : null;
}

/**
 * The edges this key raises. It is only called when the key is NOT YET held — that is what makes it an EDGE and not a
 * state, and what keeps the system's auto-repeat from becoming ten jumps.
 * `p.ctrl[act] || []`: a scheme without the action turns a TypeError into a no-op (the precedent is `navPause`'s guard
 * in ui/menu-nav.ts) — a net that removes no chance of a fix.
 */
export function edgesFor(code: string, s: KeydownSnapshot): EdgeRaise[] {
  const out: EdgeRaise[] = [];
  s.players.forEach((p, idx) => {
    if (!p.ctrl) return;
    for (const [act, edge] of EDGE_BY_ACTION) {
      if (!edgeAllowed(act, p.easy)) continue; // Easy: no running (input/edges.ts, holding on all three paths)
      if ((p.ctrl?.[act] || []).includes(code)) out.push({ playerIndex: idx, edge });
    }
  });
  // Easy (solo): Ctrl becomes Special and Shift becomes Swap power, ALWAYS on Player 1.
  if (isEasyShortcut(code, s)) out.push({ playerIndex: 0, edge: code.startsWith('Control') ? 'specialEdge' : 'swapEdge' });
  return out;
}

/** The event as the chain reads it. */
type KeyEventFacts = { code: string; altKey?: boolean; ctrlKey?: boolean };

/**
 * The three answers the chain shares. They are computed ONCE, before the first question, and that is the one
 * difference from the ladder these rows replace: it computed `action2` and `pauseKey` only after the three
 * dialog rows had declined. The cost is two pure calls per key while a dialog is open — `isJumpKey` asks
 * `actionOf` once per player and `PAUSE_KEYS.has` is a set lookup — and it is declared here for the same reason
 * the header declares the four extra `querySelector` of `snapshot()`: measuring it later costs more than
 * writing it now.
 */
interface ChainFacts {
  readonly code: string;
  /** Does this key count as JUMP for anybody? */
  readonly action2: boolean;
  readonly pauseKey: boolean;
  readonly anyModal: boolean;
}

/** One question of the chain: the decision that ENDS this key, or null for «not mine, ask the next». */
type ChainQuestion = (ev: KeyEventFacts, s: KeydownSnapshot, f: ChainFacts) => KeydownDecision | null;

/*
 * 🔴 THE CHAIN, AND THE ORDER IS THE SPECIFICATION — which is exactly why it is a LIST and no longer a ladder.
 * The header of this module says it in as many words: "the earlier one wins, and swapping two guards changes the game
 * without breaking anything a build, a `tsc` or an eye could see". A ladder buries that claim in indentation; an array
 * states it. Moving two questions is now moving two lines, and reading the precedence is
 * reading the array from the top.
 *
 * ⚠️ Eight questions here and the ninth below, and the asymmetry is the point: the first eight may DECLINE, and
 * normal play never does. Putting it in the list would give the list a member whose null can never happen, and
 * would cost every caller a branch for a case that does not exist.
 *
 * 📌 The comments are the ones each question always carried, moved with the code they explain — a comment left
 * behind starts explaining code that is no longer there (ADR-0171).
 */
const CHAIN: readonly ChainQuestion[] = [
  // 1..3 · an open dialog BLOCKS the game — but only if the element is REALLY visible (a stuck flag does not lock the
  // keyboard). The three leave without `preventDefault`: the dialog is DOM and wants the browser's native behaviour
  // (Tab, typing in a range) underneath.
  (_ev, s, f) => (s.escapeTargetId
    ? { kind: 'overlay', closeId: f.code === 'Escape' ? s.escapeTargetId : null, preventDefault: false }
    : null),
  (_ev, s, f) => (s.touchCfgVisible ? { kind: 'touchcfg', close: f.code === 'Escape', preventDefault: false } : null),
  (_ev, s, f) => (s.padWizVisible ? { kind: 'padwiz', close: f.code === 'Escape', preventDefault: false } : null),

  // 4 · end of the level. ANY player's jump presses the main button, without depending on the mouse's focus (clicking
  // the screen took focus off the button and the keyboard stopped working — the Dev's report).
  (_ev, s, f) => {
    if (!s.winVisible) return null;
    const again = f.action2 || f.pauseKey;
    return { kind: 'win', again, preventDefault: again };
  },

  // 5 · title.
  (_ev, s, f) => {
    if (!s.titleScreen) return null;
    // multi-screen: only Player 1 picks the game. Another player's key is consumed with a spoken notice.
    if (s.numPlayers > 1 && s.whichPlayer(f.code) > 0) return { kind: 'title', wait: true, nav: null, preventDefault: true };
    const nav = titleNavOf(f.code, s, f.action2);
    const has = hasTitleIntent(nav);
    return { kind: 'title', wait: false, nav: has ? nav : null, preventDefault: has };
  },

  // 6..7 · number of screens and pause. BOTH require no modal open: with a challenge open on screen, Alt+3 must not
  // reconfigure the game beneath it, and Enter is the challenge's confirmation, not the pause.
  (ev, s, f) => (ev.altKey && !ev.ctrlKey && SCREEN_DIGITS.test(f.code) && s.inGame && !f.anyModal
    ? { kind: 'screens', count: +f.code.slice(5), preventDefault: true }
    : null),
  (_ev, s, f) => (!f.anyModal && f.pauseKey && s.inGame ? { kind: 'pause', preventDefault: true } : null),

  // 8 · modal. The key acts on its OWNER's modal; a generic one falls to P1. `preventDefault` does NOT depend on the key
  // meaning something inside: being a game key is enough — the challenge swallows the key either way.
  (_ev, s, f) => {
    if (!f.anyModal) return null;
    const owner = modalOwnerIndex(f.code, s);
    // a key of a player WITHOUT a modal falls to normal play (their match goes on) — move along
    if (owner < 0) return null;
    return {
      kind: 'modal', playerIndex: owner, intent: modalIntentOf(f.code, s, owner, s.whichPlayer(f.code) < 0),
      preventDefault: s.controls.gameKeys.includes(f.code),
    };
  },
];

/** 9 · normal play — the one question that ALWAYS answers, and so the one that closes the chain instead of being in it. */
function playDecision(s: KeydownSnapshot, f: ChainFacts): KeydownDecision {
  const code = f.code;
  const gameKey = isEasyShortcut(code, s) || isGameKeyCode(code, s);
  const wake = s.players.reduce<number[]>((acc, p, idx) => { if (p.waiting && s.actionOf(code, p.i)) acc.push(idx); return acc; }, []);
  const edges = s.heldKeys.has(code) ? [] : edgesFor(code, s);
  // Motor empathy (one button at a time): the new key comes in and the OTHER game keys go out. The hold comes after the
  // clearing in the wrapper, so the newcomer survives even if it was already on the list.
  const releaseKeys = s.oneButton && gameKey ? [...s.heldKeys].filter((k) => isGameKeyCode(k, s)) : [];
  return { kind: 'play', gameKey, wake, edges, releaseKeys, preventDefault: gameKey };
}

/**
 * THE CHAIN. Nine questions, in this order — and the order IS the specification.
 * What is NOT here, and comes first in the wrapper: the demo (attract) and the remapping capture. See the header.
 */
export function decideKeydown(ev: KeyEventFacts, s: KeydownSnapshot): KeydownDecision {
  const facts: ChainFacts = {
    code: ev.code, action2: isJumpKey(ev.code, s), pauseKey: PAUSE_KEYS.has(ev.code), anyModal: s.modalOpen.some(Boolean),
  };
  for (const ask of CHAIN) {
    const decided = ask(ev, s, facts);
    if (decided) return decided;
  }
  return playDecision(s, facts);
}

/* ===================== ctx / api ===================== */

export interface KeydownCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /* --- the two probes that DECIDE AND ACT: they run before the pure decision, in this order --- */
  /** The demo: resets idleness and ends the demo; `true` = the key was only to wake it up. */
  attractOnInput: () => boolean;
  /** ui/settings-controls.ts: a remap in progress — the next key BECOMES the control. */
  handleCaptureKeydown: (e: KeydownEventLike) => boolean;

  /* --- state (all getters: the host reassigns) --- */
  /** The scene's two facts. See `KeydownSnapshot`: booleans, never the phase. */
  isTitleScreen: () => boolean;
  isInGame: () => boolean;
  getNumPlayers: () => number;
  getPlayers: () => readonly KeydownPlayer[];
  /** The keyboard runtime's `controlsState()` — memoised over there; one call per key. */
  getControls: () => ControlsSnapshot;
  /**
   * THE `input/state` DOORS, NOT THE RAW SET (ADR-0109) — the same cut `input/touch-bindings` made.
   *
   * ⚠️ `ReadonlySet` and not `Set`, and the difference IS why the doors exist: READING the set was never the problem;
   * WRITING into it erased the source. With the type like this, a raw write stops compiling — the inventory gate has the
   * compiler on its side instead of being the only thing holding the line.
   */
  readonly heldKeys: ReadonlySet<string>;
  /** A key was held, and who pressed it is known. */
  markKey: (code: string, origin: TransportName) => void;
  /**
   * A key was held and who pressed it is NOT known — an event nobody signed, which every real key is.
   *
   * ⚠️ It sits in the ctx beside the other two on purpose: imported, a consumer would have no way to see it exists, and
   * the consumer is exactly who produces the events that land here.
   */
  markKeyWithoutSource: (code: string) => void;
  /**
   * THIS EDGE IS THIS PLAYER'S, AND IT CAME FROM HERE (ADR-0113 clause 4, issue #127) — `input/state.playerEdge`.
   *
   * 🔴 A REQUIRED FIELD: without a feeder, ADR-0109's automaton answers `teclado` for everyone through
   * `inputOf(i).inUse` — forever, with no error. Then clause 3's refusal never fires: the child who plays by webcam can
   * turn off the latch their input depends on, and nothing says so.
   *
   * ⚠️ AND IT IS HERE THAT IT COUNTS, not on the keyboard, which is already the default: a stamped synthetic event
   * (`input/synthetic-source`) is how `olhos`/`rosto`/`gestos`/`fala` become the transport in use through this module.
   * A key really pressed brings back the keyboard, which is ADR-0109's rule 3.
   */
  playerEdge: (player: number, origin: TransportName) => void;
  releaseKey: (code: string) => void;
  /** Motor empathy's one-button mode → getter. */
  isOneButton: () => boolean;
  actionOf: (code: string, playerIndex: number) => string | null;
  whichPlayer: (code: string) => number;

  /* --- DOM (reading visibility + two point touches) --- */
  $: DomQuery;
  /** ui/settings-panel.ts's `overlays.escapeTarget()`. */
  escapeTarget: () => string | null;
  /** `overlays.closeById(id)` — its return value is ignored. */
  closeOverlayById: (id: string) => void;
  /** input/gamepad.ts's. LAZY: the pad api may be built after this module. */
  closePadWiz: (save: boolean) => void;

  /* --- effects --- */
  /** input/touch.ts's. No reason on the title; `'teclado'` in play. */
  hideTouchControls: (reason?: string) => void;
  srSay: (msg: string) => void;
  navTitle: (k: TitleNav) => void;
  activateScreens: (n: number) => void;
  togglePause: () => void;
  /**
   * The INTENT arrives, and the GAME decides what it means (ADR-0033).
   *
   * One door and not four verbs (move, confirm, erase, announce Braille): with the verbs, which one to call was decided
   * here, with a three-column grid and a Braille detour. A game with a four-column grid, or a vertical list, answers
   * differently without this module knowing there is a grid.
   */
  /** The player's INDEX, not the player (ADR-0033/0039). See the same note in input/gamepad. */
  modalInput: (playerIndex: number, intent: ModalIntent) => void;
  /** Does the player at POSITION `i` have a modal open? A question, and not the object: see `modalOpen` in the snapshot. */
  hasModal: (playerIndex: number) => boolean;
  /** Removes the "screen on standby" badge when that screen's player joins. */
  clearWaitingBadge: (playerIndex: number) => void;

  /** The keyboard listener. See `EventTargetLike` in input/touch-bindings: generic over `WindowEventMap`, because the
   *  `fn: (e: never)` version forced a cast here and an adapter in every consumer. */
  win: EventTargetLike;
}

export interface KeydownApi {
  /** The snapshot the decision consumes. Exposed so the test can build and compare it. */
  snapshot: () => KeydownSnapshot;
  /** The whole bubbling listener (probes + decision + effect). Exported apart so the test can fire it without DOM. */
  onKeydown: (e: KeydownEventLike) => void;
  /** The other half of the hold. */
  onKeyup: (e: KeyupEventLike) => void;
  /** Installs both on the window, in BUBBLE. */
  attach: () => void;
}

export function initKeydown(ctx: KeydownCtx): KeydownApi {
  const { t } = ctx;
  /** An open dialog = an element that exists AND is not `hidden` — so a flag stuck on `true` cannot lock the whole
   *  game's keyboard. */
  const visible = (id: string): boolean => { const el = ctx.$<HTMLElement>('#' + id); return !!el && !el.hidden; };

  function snapshot(): KeydownSnapshot {
    return {
      titleScreen: ctx.isTitleScreen(), inGame: ctx.isInGame(), numPlayers: ctx.getNumPlayers(), players: ctx.getPlayers(), controls: ctx.getControls(),
      // THE ANSWER, beside the players — built here, where they are already in hand (ADR-0033).
      modalOpen: ctx.getPlayers().map((_, i) => ctx.hasModal(i)),
      heldKeys: ctx.heldKeys, oneButton: ctx.isOneButton(),
      escapeTargetId: ctx.escapeTarget(),
      touchCfgVisible: visible('touchcfg'), padWizVisible: visible('padwiz'), winVisible: visible('win-overlay'),
      actionOf: ctx.actionOf, whichPlayer: ctx.whichPlayer,
    };
  }

  /**
   * ⚠️ THE SOURCE COMES FROM THE EVENT AND IS NOT INVENTED HERE (ADR-0109). `transport` is `undefined` for an event
   * nobody signed — every real key — and then the narrow door ERASES the previous entry instead of letting the key
   * inherit whoever held it last time. See `markKeyWithoutSource`.
   *
   * 📌 THE EDGE FEEDS THE AUTOMATON AT THE SAME POINT AND UNDER THE SAME CONDITION the source is written on the key — an
   * unknown source is no device's edge, and inventing `teclado` for it would let a touch key turn off the latch of
   * whoever plays by gaze, with no error and mid-match.
   * ⚠️ A generic key (no owner) counts for player 1, the same convention as `ui/menu-nav`: whoever presses a key that
   * belongs to no seat is playing in the first seat.
   */
  function rememberWhoPressed({ code, transport }: PressedKey): void {
    // one question: a key with no source says so and stops; a key with one marks it and the seat's transport
    if (!transport) { ctx.markKeyWithoutSource(code); return; }
    ctx.markKey(code, transport);
    const keyOwner = ctx.whichPlayer(code);
    ctx.playerEdge(keyOwner < 0 ? 0 : keyOwner, transport);
  }

  /*
   * The IMPURE half, ONE ENTRY PER `kind` — and the table is stronger than a `switch`, not just shorter: the mapped type
   * demands an entry for EACH branch of the decision, so a new `kind` nobody stamps on the world stops compiling. A
   * `switch` without `default` would accept it silently, and the key would start doing nothing.
   */
  type Effect<K extends KeydownDecision['kind']> = (d: Extract<KeydownDecision, { kind: K }>, key: PressedKey) => void;

  const EFFECTS: { readonly [K in KeydownDecision['kind']]: Effect<K> } = {
    overlay: (d) => { if (d.closeId) ctx.closeOverlayById(d.closeId); },
    touchcfg: (d) => { if (!d.close) return; const el = ctx.$<HTMLElement>('#touchcfg'); if (el) el.hidden = true; },
    padwiz: (d) => { if (d.close) ctx.closePadWiz(false); }, // the pad wizard: Esc CANCELS (does not save)
    win: (d) => {
      if (!d.again) return;
      const b = ctx.$<HTMLElement>('#btn-again');
      if (b) (b as HTMLElement & { click(): void }).click();
    },
    title: (d) => {
      ctx.hideTouchControls(); // the keyboard on the title hides the virtual controls — BEFORE the notice
      if (d.wait) { ctx.srSay(t('sr.title.waitP1')); return; }
      if (d.nav) ctx.navTitle(d.nav);
    },
    screens: (d) => ctx.activateScreens(d.count),
    pause: () => ctx.togglePause(),
    // THE INDEX, NOT THE PLAYER: looking the player up here would only pass on an object whose challenge this module
    // cannot describe — which is exactly what the other side needs to read.
    modal: (d) => { if (d.intent) ctx.modalInput(d.playerIndex, d.intent); },
    play: (d, key) => {
      const players = ctx.getPlayers();
      if (d.gameKey) ctx.hideTouchControls('teclado'); // playing on the keyboard hides the touch buttons
      for (const idx of d.wake) { // THAT player's key activates the screen on standby
        const p = players[idx]; if (!p) continue;
        p.waiting = false; ctx.clearWaitingBadge(p.i); ctx.srSay(t('sr.player.entered', { n: p.i + 1 }));
      }
      for (const { playerIndex, edge } of d.edges) { const p = players[playerIndex]; if (p) p[edge] = true; }
      for (const k of d.releaseKeys) ctx.releaseKey(k);
      rememberWhoPressed(key);
    },
  };

  /** Takes the ready decision and stamps it on the world. */
  function apply(d: KeydownDecision, key: PressedKey): void {
    // ⚠️ The cast is the one thing the mapped type does not give for free: TypeScript does not narrow `d` and the table
    // entry at the same time. The exhaustiveness — which is what matters — is guaranteed above.
    (EFFECTS[d.kind] as Effect<KeydownDecision['kind']>)(d, key);
  }

  function onKeydown(e: KeydownEventLike): void {
    if (ctx.attractOnInput()) { e.preventDefault(); return; } // any key ends the demo
    if (ctx.handleCaptureKeydown(e)) return;                  // remap: the next key becomes the control
    const d = decideKeydown(e, snapshot());
    if (d.preventDefault) e.preventDefault();
    apply(d, { code: e.code, transport: sourceOfEvent(e) });
  }

  // ⚠️ IT RELEASES IN BOTH. A raw `keys.delete` would leave the source behind, and a map describing keys nobody holds
  // answers the latch with the wrong device — with no error, and only on the next edge.
  function onKeyup(e: KeyupEventLike): void { ctx.releaseKey(e.code); }

  function attach(): void {
    ctx.win.addEventListener('keydown', onKeydown);
    ctx.win.addEventListener('keyup', onKeyup);
  }

  return { snapshot, onKeydown, onKeyup, attach };
}
