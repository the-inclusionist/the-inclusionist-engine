// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud.ts — PER-SCREEN HUD + the game's SCREEN infrastructure. Two responsibilities: (a) the GRID of
// `.player-screen` inside `#game-hud` — one container per player, positioned in %, hosting the HUD, the quit badge, the
// press-a-button-to-join badge (`.vp-wait`), that player's pause menu and (in multiplayer) their quiz overlay; and (b)
// the HUD's CONTENT — the player's OBJECTIVE and active power — rewritten every frame by updateGameHud().
//
// ========================= THE COUNTER IS NOT A COIN COUNTER =========================
// The counter receives an `Objective` — field 5 of `core/contract` — and the icon comes in by injection, so the HUD
// shows what the game declared without knowing whether it is a coin, a word or a sum. And `Objective.name` gives the
// counter an ACCESSIBLE NAME: without it a blind child would hear "3 / 10", two numbers with no noun — the engine did
// not know the name of what is collected. Now the game declares it.
//
// The HUD is OVERLAID DOM (not pixelated: it stays in high definition over the 320×180 canvas) — which is why it lives
// here and not in render. The pause menu is NOT this module's: `buildScreenPause(i)` comes in by injection, and this
// module only attaches the result to the right screen and hands the finished panels back through `onScreensBuilt`.
//
// No I/O on import: `document` only appears INSIDE functions → the module is importable in the node project, where the
// tests exercise only the PURE half (screenGrid/screenRect/hudRowView/vphudHtml/waitBadgeHtml).
import { screenGrid } from '../core/screens.js';
import type { PlayerView } from '../core/entity.js';
import type { Objective } from '../core/contract.js';

import type { Translate } from '../core/i18n.js';
import type { DomQuery } from '../core/dom-query.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` lives in `core/dom-query`: copies of this line in many modules drifted apart. Re-exported for whoever
// already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** Only the player fields the HUD reads. Structural on purpose: the real `players[]` is `unknown[]` in core/state. */
/** What the HUD reads from the PLAYER: the active power and whether they quit. Progress comes from the `Objective`,
 *  not from here. */
export type HudPlayer = PlayerView<'activePower' | 'quit'>;

// ---------------------------------------------------------------------------------------------
// PURE logic (no `document`; testable in the node project)
// ---------------------------------------------------------------------------------------------

/** Screen grid: 1 → 1×1, 2 → 2×1, 3-4 → 2×2 (the 3rd screen is centred on the bottom row). */

// The grid lives in core/screens (a leaf, no dependencies), because the layout and the CRT need the SAME arithmetic and
// have no business importing from a HUD module. Re-exported here under its usual name.
export { screenGrid } from '../core/screens.js';
export type { ScreenGrid } from '../core/screens.js';

/** Screen `i`'s rectangle in CSS percentages, ready for `style.left/top/width/height`. */
export interface ScreenRect { L: string; T: string; W: string; H: string; }

/**
 * Position/size of screen `i` in a grid of `n` players; `n` is a parameter, so it is testable without state. Special
 * case: with 3 screens, the third is centred on the bottom row, to match the renderer's positioning.
 */
export function screenRect(i: number, n: number): ScreenRect {
  const { cols, rows } = screenGrid(n);
  const col = i % cols, row = Math.floor(i / cols);
  let colFrac = col / cols;
  if (n === 3 && i === 2) colFrac = (1 - 1 / cols) / 2;
  return { L: (colFrac * 100) + '%', T: (row / rows * 100) + '%', W: (100 / cols) + '%', H: (100 / rows) + '%' };
}

/** How many screens the HUD mounts: at least one, even before `players[]` exists at boot. */
export function screenCount(n: number): number { return Math.max(1, n); }

/** The text a screen reader hears on the counter. The FRAME is the key; the objective's NAME passes through as a
 *  parameter — pillar 3's rule (ADR-0010), the same the curriculum follows. */
export const counterLabel = (t: Translate, o: Objective): string =>
  t('hud.contador', { have: String(o.have), need: String(o.need), nome: o.name.text });

/**
 * The counter's markup (objective in the 1st column, power in the 2nd).
 *
 * The objective comes in WHOLE — name, how much you have, how much you need — and the icon by injection: the HUD shows
 * what the game declared (field 5 of the contract), without knowing whether it is a coin, a word or a sum.
 *
 * The accessible name is set separately (`applyCounterLabel`), because the objective's name is outside data.
 */
export function vphudHtml(objective: Objective, icon: string): string {
  return '<span class="vphud-obj"><b class="vphud-ico">' + icon
    + '</b> <b class="vphud-n">' + finiteOrZero(objective.have) + '</b> / ' + finiteOrZero(objective.need)
    + '</span><span class="vphud-power"><b class="vphud-ico">✨</b> <span class="vphud-pw">—</span></span>';
}

/**
 * PUTS THE NAME THE GAME DECLARED INTO THE SCREEN READER'S LABEL — by attribute, never by markup (issue #106).
 *
 * ⚠️ The games live in SEPARATE REPOSITORIES and consume the engine as a package (ADR-0083), so the objective's
 * `name.text` is text from a game this tree does not review.
 *
 * ⚠️ AND IT GOES INTO AN ATTRIBUTE, the worse of the two contexts: inside an element a quote is harmless; inside
 * `aria-label="…"` it CLOSES the attribute and what follows becomes an attribute — an `onmouseover` without a single
 * tag.
 *
 * `setAttribute` escapes by construction, which is why the answer is building nodes and not escaping by hand: a
 * forgotten escape leaves no trace; a forgotten `setAttribute` removes the label, and a case holds it.
 */
export function applyCounterLabel(t: Translate, vphud: Element | null, objective: Objective): void {
  vphud?.querySelector('.vphud-obj')?.setAttribute('aria-label', counterLabel(t, objective));
}

/**
 * A number from the game, coerced.
 *
 * ⚠️ `Objective.have` IS `number` IN THE TYPE AND THE TYPE DOES NOT CROSS THE PACKAGE BOUNDARY: a game in plain
 * JavaScript, or compiled from another tree, returns whatever it likes. Pasting that into a template literal is the
 * same category of defect as the name — only easier to forget, because "it is a number" is written in the type. A
 * non-number becomes `0`, which is false but harmless; letting it through would be false AND dangerous.
 */
function finiteOrZero(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

/**
 * The markup of the press-a-button-to-join badge (a screen created mid-game, still with no owner). `i` is 0-based.
 *
 * 🔴 FROM THE DICTIONARY, never raw text: it is the only sentence that tells the child who just got a screen HOW to join,
 * and the badge is their whole screen at that instant, not a corner detail.
 *
 * 📌 ITS OWN KEY and not the existing `sr.player.pressToJoin`, although the two look alike: the screen reader's says to
 * press a button, this one says WHICH — your own keyboard or a free controller —, because whoever reads it is looking
 * at a screen with other people around and needs to know it is not just any keyboard. Merging them would erase that
 * half of one of the two.
 */
export function waitBadgeHtml(t: Translate, i: number): string {
  return '<div class="vphud-quit vp-wait">' + t('hud.waitBadge', { n: i + 1 }) + '</div>';
}

/** The HUD projection of ONE screen: everything updateGameHud() writes to the DOM, without touching the DOM. */
export interface HudRowView {
  /** The counter's text: how much the player has, as given (no formatting nor clamp). */
  have: string;
  /** What the screen reader hears on the counter — rewritten with the number, otherwise it would keep saying the first
   *  frame's value the whole match. That is the defect a static `aria-label` would have. */
  label: string;
  /** Short label of the active power, with the dash as the fallback for an unknown/absent power. */
  power: string;
  /** `hidden` of the quit badge: hidden while the player has NOT quit. */
  quitHidden: boolean;
  /** The counter's `style.visibility`: whoever quit sees a black screen with the badge, no numbers. */
  visibility: 'hidden' | 'visible';
}

/**
 * One player's HUD state, as a value. `powerShort` is injected by the host (the same function other game modules
 * receive). A function and not a table: the text depends on the CURRENT language, and a table read at boot would stay
 * frozen in it.
 */
export function hudRowView(t: Translate, p: HudPlayer, powerShort: (kind: string) => string, objective: Objective): HudRowView {
  return {
    have: String(objective.have),
    label: counterLabel(t, objective),
    // The `|| '—'` STAYS, even with the resolver already handling unknowns. It is not redundancy: it guarantees the
    // power field NEVER appears blank on the HUD, and that cannot depend on every future consumer remembering the case.
    power: powerShort(p.activePower) || '—',
    quitHidden: !p.quit,
    visibility: p.quit ? 'hidden' : 'visible',
  };
}

// ---------------------------------------------------------------------------------------------
// Casca de DOM (initHud(ctx) → HudApi)
// ---------------------------------------------------------------------------------------------

export interface HudCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** How many players/screens. ROUND state (ADR-0038): it comes from the instance the root owns — a module `let` would
   *  be shared by any second game the same page loads. */
  getNumPlayers: () => number;
  /** The players. ROUND state, for the same reason. `readonly unknown[]` because each consumer narrows to ITS slice —
   *  the real type is the game's, not the engine's (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /** DOM selector (ui/dom.ts's `$` shape), injected — the module never reaches `document` through a global. */
  $: DomQuery;
  /**
   * Short power labels shown on the HUD. Injected so the host keeps one table for every module that shows powers.
   */
  powerShort: (kind: string) => string;
  /**
   * Player `i`'s OBJECTIVE — field 5 of the contract (`core/contract.Objective`): the name of what is collected, how
   * much they have and how much they need. A FUNCTION and not a value, because `have` changes every frame.
   */
  hudObjective: (playerIndex: number) => Objective;
  /** The counter's icon. It is the game's, like the name. */
  hudIcon: string;
  /**
   * Screen `i`'s pause panel. NOT this module's: it comes in by injection and the HUD only attaches the result inside
   * the matching `.player-screen`.
   */
  buildScreenPause: (i: number) => HTMLElement;
  /**
   * Screen `i`'s accessibility QUICK BAR (ui/pause-icons `buildQuickBar`). Attached as a SIBLING of `.screen-exp`, not
   * inside it: the bar is CONTROL, and empathy mode does not reach it (issue #82).
   */
  buildQuickBar: (i: number) => HTMLElement;
  /**
   * Called at the END of buildGameHud() with the freshly created pause panels, in screen order — the hook where the
   * host keeps its references and runs what depends on them. Optional: without it the HUD mounts the same, it just
   * tells nobody.
   */
  onScreensBuilt?: (pausePanels: HTMLElement[]) => void;
  /** The freshly mounted quick bars, in screen order. The root keeps them for `getA11yBars`. */
  onBarsBuilt?: (bars: HTMLElement[]) => void;
}

export interface HudApi {
  /** (Re)mounts `#game-hud`: one `.player-screen` per player, with HUD, quit badge and pause panel. */
  buildGameHud: () => void;
  /** Rewrites the objective/power and the quit badge on every mounted screen. Called every frame. */
  updateGameHud: () => void;
  /** Screen `i`'s `.player-screen` container (the multiplayer quiz and other per-player overlays hang here). */
  getScreen: (i: number) => HTMLElement | null;
  /** Creates the `.vp-wait` badge on screen `i` (idempotent: does not duplicate if it already exists). */
  showWaitingBadge: (i: number) => void;
  /** Removes the `.vp-wait` badge from screen `i` (the player joined). No-op if the screen or the badge does not exist. */
  clearWaitingBadge: (i: number) => void;
}

export function initHud(ctx: HudCtx): HudApi {
  const { t } = ctx;
  let gameHudEl: HTMLElement | null = null;
  let vpHudDom: HTMLElement[] = [];
  let vpQuitDom: HTMLElement[] = [];
  let vpScreens: HTMLElement[] = [];
  /** Each screen's EXPERIENCE sub-layer — what empathy gets in the way of. See `buildGameHud`. */
  let vpExpDom: HTMLElement[] = [];

  function buildGameHud(): void {
    if (!gameHudEl) gameHudEl = ctx.$<HTMLElement>('#game-hud');
    if (!gameHudEl) return;
    gameHudEl.innerHTML = '';
    vpHudDom = []; vpQuitDom = []; vpScreens = []; vpExpDom = [];
    const panes: HTMLElement[] = [];
    const bars: HTMLElement[] = [];
    const n = ctx.getNumPlayers();
    // the screens are made by the document the hud is drawn in — the host's own, never the global (ADR-0221 step 7d)
    const doc = gameHudEl.ownerDocument;
    for (let i = 0; i < screenCount(n); i++) {
      const r = screenRect(i, n);
      const scr = doc.createElement('div');
      scr.className = 'player-screen'; scr.dataset.player = String(i);
      scr.style.left = r.L; scr.style.top = r.T; scr.style.width = r.W; scr.style.height = r.H;

      // THE SCREEN HAS TWO SUB-LAYERS, divided by ROLE (issue #82, the Dev's decision):
      //
      //   · EXPERIENCE (`.screen-exp`) — HUD, quit badge and the multi-screen learning activity. EMPATHY mode has to get
      //     in the way here: it is the harm the person has to feel.
      //   · CONTROL (the pause panel, a sibling) — never touched by empathy. Simulation is not accessibility: it creates
      //     difficulty where ease does not exist. What exists to GIVE ACCESS — pause, captions, touch controls — cannot
      //     be degraded by it.
      //
      // They are SIBLINGS and not parent/child because a CSS `filter` descends to descendants and a child cannot cancel
      // it: with the pause inside the experience, there would be no way to exempt it.
      const exp = doc.createElement('div');
      exp.className = 'screen-exp';
      scr.appendChild(exp); vpExpDom.push(exp);

      const d = doc.createElement('div');
      d.className = 'vphud';
      d.innerHTML = vphudHtml(ctx.hudObjective(i), ctx.hudIcon);
      applyCounterLabel(t, d, ctx.hudObjective(i)); // #106: the name comes from the GAME — attribute, never markup
      exp.appendChild(d); vpHudDom.push(d);

      const q = doc.createElement('div');
      q.className = 'vphud-quit'; q.hidden = true; q.textContent = 'Jogo abandonado';
      exp.appendChild(q); vpQuitDom.push(q);

      // THE QUICK BAR goes between the experience and the pause, as a SIBLING of both. Not INSIDE `.screen-exp`, because
      // a CSS `filter` descends to descendants and a child cannot cancel it: in there, empathy mode would degrade exactly
      // what exists to give access.
      const bar = ctx.buildQuickBar(i);
      scr.appendChild(bar); bars.push(bar);

      const sp = ctx.buildScreenPause(i);
      scr.appendChild(sp); panes.push(sp);

      gameHudEl.appendChild(scr); vpScreens.push(scr);
    }
    // What depends on the finished panels belongs to other modules, so it leaves through these hooks.
    ctx.onBarsBuilt?.(bars);
    ctx.onScreensBuilt?.(panes);
  }

  function updateGameHud(): void {
    for (let i = 0; i < vpHudDom.length; i++) {
      const p = ctx.getPlayers()[i] as HudPlayer | undefined;
      if (!p) continue;
      const d = vpHudDom[i];
      const v = hudRowView(t, p, ctx.powerShort, ctx.hudObjective(i));
      const n = d.querySelector('.vphud-n'); if (n) n.textContent = v.have;
      // The accessible label follows the number. Writing it only at mount would leave the screen reader repeating
      // "0 of 10" the whole match — worse than no label, because it sounds like information.
      const obj = d.querySelector('.vphud-obj'); if (obj) obj.setAttribute('aria-label', v.label);
      const pw = d.querySelector('.vphud-pw'); if (pw) pw.textContent = v.power;
      if (vpQuitDom[i]) vpQuitDom[i].hidden = v.quitHidden;
      if (d) d.style.visibility = v.visibility; // a player who left: black screen with the quit badge
    }
  }

  const getScreen = (i: number): HTMLElement | null => vpScreens[i] ?? null;

  function showWaitingBadge(i: number): void {
    const scr = vpScreens[i];
    if (scr && !scr.querySelector('.vp-wait')) scr.insertAdjacentHTML('beforeend', waitBadgeHtml(t, i));
  }

  function clearWaitingBadge(i: number): void {
    const scr = vpScreens[i];
    const w = scr && scr.querySelector('.vp-wait');
    if (w) w.remove();
  }

  return { buildGameHud, updateGameHud, getScreen, showWaitingBadge, clearWaitingBadge };
}
