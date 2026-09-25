// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/shell.ts — THE SHELL: which SCREEN the game is on (title, playing, paused), and what the screen turns on and off
// when it changes.
//
// It knows nothing of physics or pixels; it knows `hidden`, focus, mute and the pause cards. `createGame` does NOT mount
// it — nothing in `app/js` calls `initShell`. It is a published kit for a game that has a title screen and wants the
// engine's projection of scenes onto the document; several of its ctx fields (`setQuizLevel`, `openTypo`, the pause
// actions) are one game's vocabulary.
//
// WHY `projectScene` IS NOT A STATE MACHINE WITH A TRANSITION TABLE. There are three scenes and every transition between
// them is legal — no guard, no named event, no entry/exit hook beyond the body below. A `Map<[from, to], handler>` would
// forbid no illegal state (there is none) and turn a block read top to bottom into a jump. What IS worth it is separating
// the DECISION from the EFFECT: `phaseView(facts)` returns everything a scene asks of the document, and `applyPhaseView`
// is the only part that touches it. The decision is then testable in the `node` project, and a sign error (the title
// overlay visible during play, sound not muted on pause — accessibility broken silently) becomes an assertion instead of a
// symptom found by playing. `ui/title.ts` made the same move with `computeTitleMenuView`.
// The only part with MEMORY — giving the touch controls back on resume, from the `dataset.wasOn` written on pause — is
// `touchControlsPlan`, a pure function of (scene facts, previous state, number of screens).
//
// WHAT IS NOT HERE: the `.pm-btn`/`.pi-btn` markup and click delegation belong to `ui/pause-icons`, which reads this
// module's action table through `getPauseActs()`. Opening and closing the settings panels belongs to
// `ui/settings-panel` and the `ui/settings-*` panels; `pauseActs` only CALLS them, by injection.
//
// INJECTION: every entry of `pauseActs` is a callback resolved when it is CALLED, so the host can wire the shell before
// the panels it opens exist. The number of players and the players are asked through getters: they are round state,
// owned by the host, and a module-level binding would be shared by a second game on the same page.
//
// NO I/O ON IMPORT: the module body only declares data and pure functions. Every effect goes through `initShell`.
// GUARDS: every DOM lookup is null-guarded, which is what lets the `node` project run it with a fake `$` returning `null`.

import type { Translate } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';

import { PAD_DESIGNS, PAD_GLYPH_SPOKEN } from '../input/devices.js'; // a DATA leaf module (zero deps) — imported, not injected
import type { DomQuery } from '../core/dom-query.js';
import type { PadMap } from '../input/pad-reading.js';
import type { SceneFacts } from '../core/scenes.js';
// ONE constant, not a repeated selector: the pause card has more than one list (ADR-0044 item 5), and whoever scans raw
// `.pm-btn` also sees the hidden ones.
import { PM_VISIBLE_ITEMS } from './pause-icons.js';

/* ===================== minimal interfaces ===================== */

/** What `pauseActs.addplayer` reads of a player. `players` is `unknown[]` to the shell. */
/** The shell only needs to know WHO the player is and whether they are waiting for the next round. */
type ShellPlayer = PlayerView<'i' | 'waiting'>;

/** The part of `Window` that `printMode` uses (adding and removing a listener in CAPTURE, and the 80 ms delay). */
export interface ShellWindow {
  addEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  removeEventListener(type: string, fn: (e: Event) => void, capture: boolean): void;
  setTimeout(fn: () => void, ms: number): unknown;
}

/** A pause screen (`.screen-pause`) — only what the shell touches. */
export interface PauseScreen {
  hidden: boolean;
  querySelectorAll<T extends Element = Element>(sel: string): ArrayLike<T> & Iterable<T>;
}

/** A gamepad, as little of it as the title legend reads. */
interface PadLike { index: number; id: string; mapping: string }

// ---------------------------------------------------------------------------------------------------------
// PURE PROJECTION — the scene decision, without a DOM. Testable in the `node` project.
// ---------------------------------------------------------------------------------------------------------

// The shell does not know HOW MANY scenes there are nor what they are called — see `SceneFacts`: the composition root
// names the scenes of its game.

/** Where the focus goes on ENTERING a scene. */
export type PhaseFocus = 'game-region' | 'pause-menu' | 'title-button';

/**
 * What the scene on top asks of the document — a projection of the scene facts, with no field depending on history (the
 * one that would, `#touch-controls`, lives in `touchControlsPlan`, apart on purpose).
 */
export interface PhaseView {
  /** `#title-overlay`.hidden — the splash only shows on the title. */
  titleOverlayHidden: boolean;
  /**
   * There is no global pause overlay to hide: each screen has its own pause card (below). A field saying «it is hidden»
   * would accept that one exists — and a leftover global menu in a page is the one the next game author would copy.
   */
  /** `.screen-pause`.hidden of EACH screen — the per-screen cards only show while paused. */
  screenPauseHidden: boolean;
  /** `setMasterMuted(...)` — GAG: outside play ALL sound goes quiet (ambient and rain loops included). */
  masterMuted: boolean;
  /** `hideTouchControls()` — an active menu (title or pause) = no virtual controller. */
  hideTouchControls: boolean;
  /**
   * The pause button's `aria-pressed` — it tells a screen reader WHETHER the game is paused. The target is
   * `#touch-start`, the pad's START: the button that exists, and the only way to pause on a tablet without a keyboard.
   */
  pausePressed: boolean;
  /** Who receives the focus on entering this scene. */
  focus: PhaseFocus;
}

// `SceneFacts` lives in `core/scenes`, beside the stack that produces them — it is an ENGINE type.

/** Every question the scene change asks of the scene, asked at once. */
export function phaseView(f: SceneFacts): PhaseView {
  return {
    titleOverlayHidden: !f.titleScreen,
    screenPauseHidden: !f.pauseMenu,
    masterMuted: !f.worldRunning,
    hideTouchControls: !f.worldRunning,
    pausePressed: f.pauseMenu,
    focus: f.worldRunning ? 'game-region' : f.pauseMenu ? 'pause-menu' : 'title-button',
  };
}

/** The part of `#touch-controls` that matters: hidden? and was the pad on before the pause? */
export interface TouchControlsState {
  /** `tc.hidden`. */
  hidden: boolean;
  /** `tc.dataset.wasOn === '1'`. Absent or any other value = false. */
  wasOn: boolean;
}

/**
 * The ONE part of a scene change with memory: hide the touch controls on pause (recording that they were on) and give them
 * back on resume. Pure, so it can be pinned without a browser.
 *
 * The state that arrives here is the one from BEFORE `hideTouchControls()` — the caller reads first and hides after.
 * The other order never records `wasOn` (the plan sees the pad already off), and resuming on a phone would not give the
 * virtual d-pad back.
 */
export function touchControlsPlan(f: SceneFacts, st: TouchControlsState, screens: number): TouchControlsState {
  if (f.pauseMenu) {
    if (!st.hidden) return { hidden: true, wasOn: true }; // record that it was on, and hide
    return st;                                            // already hidden: nothing changes (not even `wasOn`)
  }
  if (f.worldRunning) {
    return { hidden: st.wasOn && screens <= 1 ? false : st.hidden, wasOn: false };
  }
  return { hidden: true, wasOn: false }; // the title (or any scene that is neither play nor pause): hide and forget
}

// ---------------------------------------------------------------------------------------------------------
// THE TITLE LEGEND — the pure part (building the two rows of chips from the chosen glyphs)
// ---------------------------------------------------------------------------------------------------------

/** One legend «chip»: the glyph (with an optional background colour) followed by the word it stands for. */
export function chip(txt: string, col: string | null, word?: string): string {
  return `<span class="lg"><span class="lg-ico"${col ? ` style="background:${col}"` : ''}>${txt}</span>${word ? ' ' + word : ''}</span>`;
}

/**
 * The SPOKEN name of a controller glyph. A glyph that already reads as a word passes untouched.
 *
 * `PAD_GLYPH_SPOKEN` in `input/devices` holds KEYS, not text, because it is a module `const` evaluated once on import —
 * resolved text would freeze the language at boot. It is resolved here, on each call, in the language of that moment.
 */
export function spokenGlyph(t: Translate, g: string): string {
  const k = PAD_GLYPH_SPOKEN[g];
  return k ? t(k) : g;
}

/**
 * THE PAUSE LEGEND — two layers in the same place (ADR-0044 item 4).
 *
 * It says which button confirms and which goes back, and XAG 106 asks for exactly this to be narrated ("A to Select").
 * The CHIPS stay visible and silent — a screen reader would read `✕` as a multiplication sign — and beside them a single
 * sentence exists for screen readers only, with the glyphs already turned into words. Two readings of the same
 * information, each in the sense that reaches it.
 *
 * Takes the `[glyph, colour]` pairs of the pad's design by position: yes is the south button (A · ✕ · B) and no the east one
 * (B · ◯ · A) on every design — no design swaps them (the Dev's association, ADR-0013 erratum).
 */
export function pauseLegendHtml(t: Translate, sim: readonly [string, string], no: readonly [string, string]): string {
  const silentLegend = (g: readonly [string, string], word: string): string =>
    `<span class="lg" aria-hidden="true"><span class="lg-ico" style="background:${g[1]}">${g[0]}</span> ${word}</span>`;
  const spoken = t('menu.legendSpoken', { sim: spokenGlyph(t, sim[0]), nao: spokenGlyph(t, no[0]) });
  return silentLegend(sim, t('menu.yes')) + silentLegend(no, t('menu.no')) + `<span class="sr-only">${spoken}</span>`;
}

/** The four action buttons, in the legend's fixed glyph order: action2 · action3 · action1 · action4. */
export interface ActionGlyphs {
  action2: readonly [string, string | null];
  action3: readonly [string, string | null];
  action1: readonly [string, string | null];
  action4: readonly [string, string | null];
}

/**
 * Legend row 1: the d-pad and START/Enter. The same for touch and gamepad; the keyboard overrides the labels.
 *
 * The words come from `legend.*` and are resolved HERE, on each call — not in a module table, which would freeze the
 * language at boot. The SHORT register on purpose: this row sits under a glyph and has no room for the longer wording the
 * remapping list uses.
 */
export function legendRow1(t: Translate, dirTxt: string, pauseTxt: string): string {
  return chip(dirTxt, null, t('legend.move')) + chip(pauseTxt, null, t('legend.pause'));
}

/**
 * Legend row 2: the action buttons, in glyph order.
 *
 * The words are asked of the GAME (`wordFor`, the SHORT version — see `ActionWord.short`): the engine does not assume
 * every game has jump, special, run and swap. A position the game does not name becomes no chip at all.
 */
export function legendRow2(g: ActionGlyphs, wordFor: (action: string) => string | null): string {
  const GLYPH_ORDER: readonly (keyof ActionGlyphs)[] = ['action2', 'action3', 'action1', 'action4'];
  return GLYPH_ORDER.map((a) => {
    const word = wordFor(a);
    return word ? chip(g[a][0], g[a][1], word) : '';
  }).join('');
}

/** The final innerHTML of `#title-legend`: two `.lg-row`. */
export function legendHtml(l1: string, l2: string): string {
  return `<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`;
}

/**
 * The glyphs of a PHYSICAL pad. `layout` comes from `padLayoutFromId` (only when `mapping === 'standard'`; off-standard it
 * is always 'generic'), and `custom` is the wizard's map (only consulted OFF the standard). A button with no entry in the
 * custom map falls back to its default index ('0'..'3'), and an index the design does not know becomes the pair
 * `[index, '#3a4a6a']` — the fallback grey.
 */
export function padActionGlyphs(layout: string, custom: PadMap | null): ActionGlyphs {
  const set = PAD_DESIGNS[layout] || PAD_DESIGNS.generic;
  // The `typeof b === 'object'` is not ceremony: a `PadMap` admits a `boolean` besides a `PadBinding` — the mapping
  // wizard's `_skip: true` sentinel. The four keys read here are never it, so nothing changes at run time; what changes is
  // that the read ASKS instead of assuming.
  const bOf = (k: string, def: string): string => {
    const b = custom && custom[k];
    return b && typeof b === 'object' && typeof b.b === 'number' ? String(b.b) : def;
  };
  const gy = (k: string): readonly [string, string | null] => (set[k] as [string, string] | undefined) || [k, '#3a4a6a'];
  return { action2: gy(bOf('action2', '0')), action3: gy(bOf('action3', '1')), action1: gy(bOf('action1', '2')), action4: gy(bOf('action4', '3')) };
}

/** The glyphs of the VIRTUAL (touch) pad: always the 'generic' design (0/1/2/3), no custom map. */
export function touchActionGlyphs(): ActionGlyphs {
  return padActionGlyphs('generic', null);
}

/**
 * Chooses WHICH gamepad the legend describes: Player 1's, if they have one (`players[0].pad`); otherwise the first one
 * connected. With `p1pad >= 0` and no pad of that index present, the result is `null` (the legend falls back to the
 * keyboard) rather than picking another.
 */
export function pickLegendPad(pads: readonly (PadLike | null)[], p1pad: number): PadLike | null {
  let gp: PadLike | null = null;
  for (const g of pads) {
    if (!g) continue;
    if (p1pad >= 0) { if (g.index === p1pad) { gp = g; break; } } else if (!gp) gp = g;
  }
  return gp;
}

// ---------------------------------------------------------------------------------------------------------
// ctx / api
// ---------------------------------------------------------------------------------------------------------

export interface ShellCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** The three facts of the scene on TOP, asked on each use — the root holds the stack and names the scenes. A getter,
   *  not a value: the shell projects the CURRENT state, not the one of the moment it was wired. */
  sceneFacts: () => SceneFacts;
  /** BACK TO THE GAME. What the pause card's «Continue» does, and what a new player joining does. Resuming is what the
   *  shell means; pushing and popping scenes is the root's. */
  resumeGame: () => void;
  /** How many players/screens. ROUND state (ADR-0038): it comes from the instance the host owns — a module-level
   *  binding would be shared by a second game on the same page. */
  getNumPlayers: () => number;
  /** The players. ROUND state, for the same reason. `readonly unknown[]` because each consumer narrows to ITS slice —
   *  the real type is the game's, not the engine's (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /* --- DOM and platform --- */
  /** ui/dom.ts `$`. Injected: the module never reaches `document`. */
  $: DomQuery;
  /** `window` — only for Print mode's two CAPTURE listeners and the 80 ms delay. */
  win: ShellWindow;
  /** platform/audio.ts `setMasterMuted` — the master node that silences EVERYTHING on pause and title (GAG). */
  setMasterMuted: (muted: boolean) => void;
  /** core/a11y-sr `srSay` (polite) and `srAlert` (assertive). */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;

  /* --- asked on each use --- */
  /** The pause cards, one per screen; the host rebuilds them when the number of screens changes. */
  getPauseScreens: () => PauseScreen[];
  /** Who opened the pause card; the accessibility panels open scoped to that player. */
  getPauseActor: () => number;

  /* --- neighbouring effects, as callbacks --- */
  /** input/touch.ts: hides the virtual d-pad. */
  hideTouchControls: () => void;
  /** ui/pause-icons.ts: reflects the `.pi-btn` of every screen (accessibility state). */
  reflectPauseIcons: () => void;

  /* --- the title legend --- */
  /** Gamepad API adapter — the same pattern as input/gamepad.ts (it is what makes it testable without a browser). */
  getGamepads: () => readonly (PadLike | null)[];
  /** `document.body.classList.contains('touch-mode')` — injected so as not to reach `document`. */
  isTouchMode: () => boolean;
  /** input/touch.ts `padLayoutFromId` — controller id → button design. */
  padLayoutFromId: (id: string) => string;
  /** The wizard's map for that controller model (only used OFF the standard). `PadMap` comes from `input/pad-reading`,
   *  which owns it, including the `boolean` the map admits. */
  padMapFor: (id: string) => PadMap | null;
  /** input/keyboard-runtime.ts `kbFor(i)` — player `i`'s CONFIGURED keys (the remap honoured). */
  kbFor: (i: number) => Record<string, string[]>;
  /** ui/control-choices `keyName` — `KeyboardEvent.code` → a human label. */
  keyName: (code: string) => string;
  /**
   * The SHORT word for this position, in the game's language. `null` = the game does not use it.
   *
   * ⚠️ Short and not the long one: the legend puts the word under a glyph, in a row of four, and has no room for the
   * «Correr / interagir» the remapping list uses. The distinction was already in the dictionary (`legend.*` against
   * `act.*`) and now crosses the boundary WITH the words — see `ActionWord.short`.
   */
  shortLabel: (action: string) => string | null;

  /* --- the pause card's actions (each a callback, resolved when called — see the header) --- */
  /** `setQuizLevel(n, announce)` — the 1..5 cycle of the literacy level. */
  setQuizLevel: (n: number, announce: boolean) => void;
  /** The current literacy level — read to compute the next in the cycle. */
  getQuizLevel: () => number;
  openTypo: () => void;
  openAudio: () => void;
  openMovement: () => void;
  openVisual: () => void;
  openHelp: () => void;
  quitGame: () => void;
  /** Does one more screen fit in this window? */
  fitsN: (n: number) => boolean;
  /** Creates/activates the next player; `null` = no pad associated yet. */
  joinPlayer: (padIdx: number | null) => boolean;
  /** ui/hud.ts: the «press a button to join» badge on the new player's screen. */
  showWaitingBadge: (i: number) => void;
  /** ui/settings-mobility.ts: scopes the Mobility panel to the player who opened it. */
  setMobilityPlayer: (i: number) => void;
  /** ui/settings-motion.ts `setSelectedPlayer`: the same for the Motion panel. */
  setMotionPlayer: (i: number) => void;
  /** ui/settings-motion.ts `motion.open`. */
  openMotion: () => void;
  /** Opens the Augmentative and Alternative Communication menu (ui/settings-aac). */
  openAac: () => void;
  /** ui/settings-empathy.ts `empathy.open`. */
  openEmpathy: () => void;
  /** Scopes Visual and Empathy to the player who opened them. */
  setSelVizPlayer: (i: number) => void;
}

/** The table of the `.pm-btn` actions. Key = the button's `data-act`. */
export type PauseActs = Record<string, () => void>;

export interface ShellApi {
  /** Projects onto the document the scene on top of the stack NOW. The root calls it after pushing or popping: pushing
   *  is the root's, since the root names the scenes. */
  applyScene: () => void;
  /** Selects the 1st `.pm-btn` (Continue) on EACH pause screen. */
  pauseSelect: () => void;
  /** Print mode: hides the pause cards to see the screen clean; any key or click brings them back. */
  printMode: () => void;
  /** Repaints `#title-legend` with Player 1's current device and mapping. */
  updateTitleLegend: () => void;
  /** The pause card's action table — read by ui/pause-icons.ts (`getPauseActs`). */
  pauseActs: PauseActs;
}

export function initShell(ctx: ShellCtx): ShellApi {
  const { t } = ctx;
  /* ===================== the title legend ===================== */

  /** Rows 1 and 2 when there is neither touch nor a gamepad: Player 1's ACTUALLY configured keys. */
  function keyboardLegend(): [string, string] {
    const m = ctx.kbFor(0);
    const K = (a: string): string => ctx.keyName((m[a] || [])[0] || '?');
    const l1 = legendRow1(t, `${K('up')} ${K('left')} ${K('down')} ${K('right')}`, 'Enter');
    const l2 = legendRow2({ action2: [K('action2'), null], action3: [K('action3'), null], action1: [K('action1'), null], action4: [K('action4'), null] }, ctx.shortLabel);
    return [l1, l2];
  }

  function updateTitleLegend(): void {
    const el = ctx.$<HTMLElement>('#title-legend');
    if (!el) return; // 2 ROWS, with what is CONFIGURED for the screen's player
    let l1: string, l2: string;
    if (ctx.isTouchMode()) {                       // VIRTUAL pad: 0/1/2/3 + START
      l1 = legendRow1(t, '✜', 'START');
      l2 = legendRow2(touchActionGlyphs(), ctx.shortLabel);
    } else {
      const p0 = ctx.getPlayers()[0] as { pad?: number } | undefined;
      const p1pad = p0 && typeof p0.pad === 'number' && p0.pad >= 0 ? p0.pad : -1;
      const gp = pickLegendPad(ctx.getGamepads(), p1pad);
      if (gp) {                                    // PHYSICAL pad: the model's design + the wizard's custom map
        const layout = gp.mapping === 'standard' ? ctx.padLayoutFromId(gp.id) : 'generic';
        const custom = gp.mapping !== 'standard' ? ctx.padMapFor(gp.id) : null;
        l1 = legendRow1(t, '✜', 'START');
        l2 = legendRow2(padActionGlyphs(layout, custom), ctx.shortLabel);
      } else {
        [l1, l2] = keyboardLegend();               // KEYBOARD: the configured keys (remap honoured)
      }
    }
    el.innerHTML = legendHtml(l1, l2);
    const w = ctx.$<HTMLElement>('#title-wait');
    if (w) w.hidden = ctx.getNumPlayers() <= 1;             // multiplayer: the «wait for Player 1» notice
  }

  /* ===================== selection and Print ===================== */

  function pauseSelect(): void {
    ctx.getPauseScreens().forEach((sp) => {
      const items = [...sp.querySelectorAll<HTMLElement>(PM_VISIBLE_ITEMS)];
      items.forEach((b) => b.classList.remove('pm-sel'));
      if (items[0]) items[0].classList.add('pm-sel'); // the 1st item (Continue) selected on each screen
    });
  }

  function printMode(): void {
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = true; }); // see the screen clean; any button brings them back
    const back = (e?: Event): void => {
      if (e && e.preventDefault) { try { e.preventDefault(); } catch { /* noop */ } }
      ctx.win.removeEventListener('keydown', back, true);
      ctx.win.removeEventListener('pointerdown', back, true);
      if (ctx.sceneFacts().pauseMenu) { ctx.getPauseScreens().forEach((sp) => { sp.hidden = false; }); pauseSelect(); }
    };
    // An 80 ms delay: the very event that TRIGGERED Print must not be the one that undoes it.
    ctx.win.setTimeout(() => {
      ctx.win.addEventListener('keydown', back, true);
      ctx.win.addEventListener('pointerdown', back, true);
    }, 80);
    ctx.srSay(t('sr.print.on'));
  }

  /* ===================== the scene change ===================== */

  /** The IMPURE half: takes the ready projection and stamps it on the document. */
  function applyPhaseView(v: PhaseView): void {
    // There is no global pause overlay to look for — see the note in `PhaseView`.
    const title = ctx.$<HTMLElement>('#title-overlay');
    if (title) title.hidden = v.titleOverlayHidden;
    ctx.getPauseScreens().forEach((sp) => { sp.hidden = v.screenPauseHidden; });
  }

  /** The state of `#touch-controls` BEFORE anything in this scene change touches it. */
  function readTouchControls(): TouchControlsState | null {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    return tc ? { hidden: tc.hidden, wasOn: tc.dataset.wasOn === '1' } : null;
  }

  /** The IMPURE half of the touch plan: receives the state read BEFORE the hide and writes the plan back. */
  function applyTouchControls(f: SceneFacts, before: TouchControlsState | null): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (!tc || !before) return;
    const after = touchControlsPlan(f, before, ctx.getNumPlayers());
    // Writes only what CHANGED: on pause with the pad already hidden nothing is touched, and removing a flag that was
    // never set is not attempted.
    if (after.hidden !== before.hidden) tc.hidden = after.hidden;
    if (after.wasOn !== before.wasOn) { if (after.wasOn) tc.dataset.wasOn = '1'; else delete tc.dataset.wasOn; }
  }

  function applyFocus(f: PhaseFocus): void {
    if (f === 'game-region') { const gr = ctx.$<HTMLElement>('#game-region'); if (gr) gr.focus(); return; }
    if (f === 'pause-menu') { pauseSelect(); ctx.reflectPauseIcons(); return; }
    updateTitleLegend();
    const b = ctx.$<HTMLElement>('#tm-main button');
    if (b) b.focus();
  }

  /**
   * Projects the scene on top onto the document. Called by the root AFTER it changes the stack — the shell neither pushes
   * nor pops: whoever changes scenes knows their names, whoever projects only needs the three facts.
   */
  function projectScene(): void {
    const f = ctx.sceneFacts();
    const v = phaseView(f);
    // READ BEFORE HIDING: `hideTouchControls()` below already sets `tc.hidden`, and a plan that read after it would see the
    // pad as already off, never record `wasOn`, and never give the d-pad back on resume.
    const touchStateBeforeHiding = readTouchControls();
    if (v.hideTouchControls) ctx.hideTouchControls(); // an active menu (title or pause) = no virtual controller
    // GAG: on pause, ALL the game's sound goes quiet (ambient and rain loops included) — it comes back on resume.
    ctx.setMasterMuted(v.masterMuted);
    applyPhaseView(v);
    applyTouchControls(f, touchStateBeforeHiding); // the state from BEFORE the hide — see above
    // `aria-pressed` comes AFTER the touch block.
    //
    // On the TITLE the attribute is REMOVED rather than set to `false`. There the button means «start», and
    // `aria-pressed` on a button that toggles nothing makes a screen reader announce a state that does not exist — worse
    // than announcing nothing. `titleOverlayHidden` is true outside the title.
    const pb = ctx.$<HTMLElement>('#touch-start');
    if (pb) {
      if (v.titleOverlayHidden) pb.setAttribute('aria-pressed', String(v.pausePressed));
      else pb.removeAttribute('aria-pressed');
    }
    applyFocus(v.focus);
  }


  /* ===================== the pause card's table ===================== */

  // The pause card's actions (shared by the per-screen cards). Opening an accessibility panel scopes it to the player who
  // acted (pauseActor) — the panel opens on their tab.
  const pauseActs: PauseActs = {
    resume: () => ctx.resumeGame(),
    // The door to the Augmentative and Alternative Communication menu (ADR-0028). DISABLED while no pictogram set is
    // licensed (ADR-0233 erratum): `ui/pause-icons` locks the `caa` item and `ui/settings-aac`'s `open` refuses, both
    // saying only «menu disabled».
    caa: () => ctx.openAac(),
    nivel: () => ctx.setQuizLevel(ctx.getQuizLevel() % 5 + 1, true), // cycles 1..5
    tipo: () => ctx.openTypo(),
    // Only ever ADDS a player (never removes); the new screen WAITS for its player to press a button
    addplayer: () => {
      const n = ctx.getNumPlayers();
      if (n >= 4) { ctx.srAlert(t('sr.screens.maxPlayers')); return; }
      if (!ctx.fitsN(n + 1)) { ctx.srAlert(t('sr.screens.wontFitOneMore')); return; }
      if (!ctx.joinPlayer(null)) return;
      const p = ctx.getPlayers()[ctx.getNumPlayers() - 1] as ShellPlayer;
      p.waiting = true;
      ctx.showWaitingBadge(p.i);
      ctx.resumeGame();
      ctx.srAlert(t('sr.player.pressToJoin', { n: p.i + 1 }));
    },
    audio: () => ctx.openAudio(),
    motora: () => { ctx.setMobilityPlayer(ctx.getPauseActor()); ctx.openMovement(); },
    anim: () => { ctx.setMotionPlayer(ctx.getPauseActor()); ctx.openMotion(); },
    visual: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openVisual(); },
    empatia: () => { ctx.setSelVizPlayer(ctx.getPauseActor()); ctx.openEmpathy(); },
    print: () => printMode(),
    quit: () => ctx.quitGame(),
    ajuda: () => ctx.openHelp(),
  };

  return { applyScene: projectScene, pauseSelect, printMode, updateTitleLegend, pauseActs };
}
