// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-mobility — the per-player MOBILITY panel: the thin DOM-touching render/reflect functions; what a choice IS
// lives in ./mobility-choices.js. DI via initSettingsMobility(ctx): `$` (DOM selector), `srSay`, `store`
// (platform/storage shape), `players`/`getNumPlayers` (the live round) and optionally `rebuildCoins` (the game's reaction
// to Easy Mode).
//
// ⚠️ The movement latch setter is the ENGINE's (`setMoveLatch`, ADR-0106 §4, step 1b): being shared by two ENGINE
// surfaces — this panel and the pause bar's `altmove` icon — is a reason for the engine to own it. The ctx field is
// OPTIONAL, so whoever injects still rules and whoever does not still gets it.
// Overlay open/close plumbing (frontOverlay, Escape handling) is the SHARED helper every settings panel uses.

import type { PlayerView } from '../core/entity.js';
import type { Translate } from '../core/i18n.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import type { DomQuery } from '../core/dom-query.js';
// ⚠️ A DIRECT IMPORT, not one more `ctx` piece: an injected key name is a field a consumer may omit, and omitting it here
// would make the panel write under a crooked name. The table is stateless (`platform/storage-keys`, ADR-0232), so the
// import brings names and no storage.
import { KEYS } from '../platform/storage-keys.js';
import { writeLatch } from '../input/latch-store.js';
import {
  applyLatch, BASE_DA_MARCHA, type LatchPlayer as JogadorDaAlternanciaDaAresta,
} from '../input/latch-sync.js';
import { latchRefusal } from './latch-refusal.js';
import { clampSelPlayer, anyMobilityActive, onOffLabel, playerTabsHTML, easyAnnouncement, playerPrefix } from './mobility-choices.js';
import type { PanelShellCtx } from './panel-shell.js';
import { controlRow, labelRow, type ControlRowSpec } from './panel-widgets.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` lives in `core/dom-query`: copies of this line in many modules drifted apart. Re-exported for whoever
// already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs. */
export interface MobilityStore {
  setBool(key: string, on: boolean): void;
  /** Reads the raw key. Only ADR-0029's mark uses it, for one precise question: did the child CHOOSE this? */
  get(key: string): string | null;
}

/** Minimal per-player shape this module reads/writes (core/state.ts's `players` entries carry much more). */
/** The per-player mobility choices: Easy Mode and the latches. */
export type MobilityPlayer = PlayerView<'easy' | 'toggleMove' | 'toggleRun' | 'walkDir'>;

export interface SettingsMobilityCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: MobilityStore;
  /** Live player list (core/state.ts's `players` — mutated in place, same reference every call). */
  players: MobilityPlayer[];
  /** Live player count (core/state.ts's `numPlayers`); a getter because the value is reassigned over time. */
  getNumPlayers: () => number;
  /** SHARED setter (also used by the pause-menu quick icon `altmove`) — optional: the engine's `setMoveLatch` otherwise. */
  setToggleMove?: (i: number, on: boolean) => void;
  /**
   * DOES THIS GAME HOLD ANY KEY? — `GameDeclaration.holdsKeys` (ADR-0115). Without it the latch row is ABSENT from this
   * panel.
   *
   * ⚠️ Not offering it means making the row absent for everyone, with `hidden`, which takes it off the screen AND out of
   * the accessibility tree. An `aria-disabled` would be the wrong answer — that is clause 3 of ADR-0113, where the
   * control EXISTS and is locked with a reason.
   *
   * ⚠️ REQUIRED, for the same reason as in `PauseIconsCtx`: there is no safe default. `true` leaves the row in a game
   * where it does nothing; `false` hides it from a child who depends on it.
   */
  holdsKeys: boolean;
  /**
   * WHICH DEVICE THIS PLAYER IS USING (ADR-0113) — it travels from here to the write.
   *
   * ⚠️ Optional for the same reason as in `LatchWriteCtx`: without it the write does what it already did.
   */
  transportInUse?: (player: number) => string;
  /**
   * THE RUN BUTTON'S LATCH.
   *
   * ⚠️ OPTIONAL (ADR-0106 §1): the engine answers it itself, through `setRunLatch` — none of its steps is the game's.
   * Whoever injects still rules.
   */
  setToggleRun?: (i: number, on: boolean) => void;
  /**
   * THE WORLD'S REACTION to Easy Mode (e.g. coins on the ground) — the game's, and therefore OPTIONAL rather than
   * required.
   *
   * 📌 The default is to DO NOTHING, which is what `core/state` decides a setter does — store, persist, notify — and
   * nothing more: game effects are REACTIONS, subscribed by whoever reacts. The child's choice is stored and holds for
   * whoever reads it; a game without coins has nothing to rebuild, and one that has them injects its own.
   *
   * ⚠️ AND THE ROW STAYS ALIVE WITHOUT IT — not a dead button. `setEasy` writes `p.easy`, persists and announces before
   * calling this; what is missing without the injection is the finishing touch in the world, not the effect.
   */
  rebuildCoins?: () => void;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY render.
   *
   * ⚠️ Relabelling a row puts its `.opt-hint` back inside it — so without this call the explanation appears twice, in
   * the footer and under the label, from the first click. `CLAUDE.md` §4 records exactly this (issue #109).
   *
   * Optional in the signature because a consumer can mount the panel without the shell (a test): without the shell
   * there is no footer to duplicate.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

export interface SettingsMobilityApi {
  /** Re-renders #movement-players (kept `hidden` — see playerTabsHTML) and (re)wires its buttons. */
  renderMovPlayers: () => void;
  /** Reflects the selected player's Easy Mode onto #opt-facil (+ the #opt-movement bar light). */
  reflectEasy: () => void;
  /** Reflects the selected player's movement latch onto #opt-altmove (+ the #opt-movement bar light). */
  reflectAltMove: () => void;
  /** Likewise for the RUN button's latch (#opt-togglerun). */
  reflectToggleRun: () => void;
  /** Sets Easy Mode for player `i`. */
  setEasy: (i: number, on: boolean) => void;
  /** Selects which player this panel edits (the pause actor, before opening the panel). */
  setSelPlayer: (i: number) => void;
  /** Currently selected player index. */
  getSelPlayer: () => number;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/** localStorage key for a player's Modo Fácil flag (== platform/storage.ts's `easy_p{i}` pattern). */
export function easyKey(i: number): string {
  // ⚠️ IT DELEGATES, like its siblings: two copies of a name change one at a time, and `platform/storage` makes the keys
  // functions to stop anyone writing under a crooked name. A gate asserts the three agree with `KEYS`.
  return KEYS.easyP(i);
}

/**
 * localStorage key of the RUN button's latch, in the LEGACY form (no transport).
 *
 * ⚠️ IT DELEGATES to `platform/storage`, so there is one name only.
 *
 * ⚠️ AND IT IS THE LEGACY KEY. ADR-0104 §C put the TRANSPORT in the name, because the latch belongs to the device and not
 * the person; this one is still read to inherit what the child already had, and is not written. The new key is
 * `latchKey`, in `input/latch-scope`.
 */
export function toggleRunKey(i: number): string {
  return KEYS.toggleRunP(i);
}

/** localStorage key of the MOVEMENT latch, per player. It delegates, like the two siblings above. */
export function toggleMoveKey(i: number): string {
  return KEYS.toggleMoveP(i);
}

/**
 * The minimal slice the movement latch's write touches.
 *
 * ⚠️ `walkDir` IS IN IT, and not as a detail: switching the latch off has to STOP whoever is walking by latch. Without
 * it, the child switches the mode off and the character keeps walking by itself, with no key pressed — and no error
 * says so.
 *
 * ⚠️ AND IT IS ITS OWN SLICE, not `MobilityPlayer`, because the TWO callers have different slices: the mobility panel
 * brings `easy`/`toggleRun`, which this does not read, and `PausePlayer` brings the visual and the three reduced-motion
 * flags. A minimal slice lets both pass without either carrying the other's.
 *
 * 📌 THE DEFINITION LIVES IN `input/latch-sync` (issue #127), beside the rule that uses it, and the NAME stays published
 * here. ⚠️ **An alias and not `export ... from`**: the names snapshot leaves re-exports out and would read the change of
 * home as a removal (the lesson of ADR-0106 step 1a).
 */
export type LatchPlayer = JogadorDaAlternanciaDaAresta;

/** What the write needs to know. Everything here already lives in `SettingsMobilityCtx` and `PauseIconsCtx`. */
export interface LatchWriteCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  readonly t: Translate;
  readonly players: readonly LatchPlayer[];
  readonly store: { setBool(key: string, on: boolean): void };
  readonly srSay: (msg: string) => void;
  readonly getNumPlayers: () => number;
  /**
   * WHICH DEVICE THIS PLAYER IS USING (ADR-0113). `input/state.inputOf(i)` answers it.
   *
   * ⚠️ OPTIONAL ON PURPOSE, because of what happens without it: the write falls back to exactly what it did before —
   * only the per-player key.
   *
   * 📌 And it is INJECTED instead of imported: `ui/` reading `input/` module state would be a new edge between two
   * layers, to save one argument. This ctx receives everything else that way.
   */
  readonly transportInUse?: (player: number) => string;
}

/**
 * SWITCHES A PLAYER'S MOVEMENT LATCH ON OR OFF — the engine does it (ADR-0106 §4).
 *
 * ⚠️ Being shared by TWO engine surfaces (this panel and the pause bar's `altmove` icon) is a reason for the engine to
 * own it, not for the cartridge to keep it — and every step is the engine's: `toggleMove` and `walkDir` are
 * `PlayerBase` fields, the key is `platform/storage`'s, and `sr.motor.toggleMove*` are engine i18n keys. There is no
 * game effect left to inject.
 */
export function setMoveLatch(ctx: LatchWriteCtx, i: number, on: boolean): void {
  const p = ctx.players[i];
  if (!p) return;
  // 📌 THE SWITCH-OFF RULE LIVES IN ONE PLACE (issue #127): `applyLatch` sets the value AND stops whoever walks by latch.
  // It is shared with the edge sync (`input/latch-sync`), which answers the SAME question when the device changes — two
  // copies of "otherwise the character walks by itself" would drift the day one of them changed.
  applyLatch(p, on);
  // ⚠️ BOTH KEYS, AND THE OLD ONE STAYS FOR NOW — the same shape as `p.visual` beside `p.viz` (#104 step 1a), for the same
  // reason: a cartridge may still READ it through `KEYS.toggleMoveP(i)`. Stopping writing it now would make the child
  // lose the choice at the next boot — the cost ADR-0113 names.
  ctx.store.setBool(toggleMoveKey(i), on);
  // 📌 And the NEW key, when the device is known. `writeLatch` refuses on the four assisted transports, where there is no
  // choice to store (ADR-0113 clause 3) — and returns `false` so a caller can disable the control with the reason said.
  // Here the refusal changes nothing else: the in-memory value is still what the rule resolves, and the rule answers
  // `true` on those four.
  const transport = ctx.transportInUse ? ctx.transportInUse(i) : null;
  if (transport) writeLatch((key, isOn) => ctx.store.setBool(key, isOn), BASE_DA_MARCHA, i, transport, on);
  // 📌 THE ANNOUNCEMENT IS UNCONDITIONAL, unlike `applyLatch`, which returns "changed". The child pressed the icon:
  // staying silent because the value already was that would leave the button with no answer for whoever listens.
  const { t } = ctx;
  ctx.srSay(playerPrefix(t, i, ctx.getNumPlayers()) + t(on ? 'sr.motor.toggleMoveOn' : 'sr.motor.toggleMoveOff'));
}

/**
 * SWITCHES THE RUN LATCH ON OR OFF — `setMoveLatch`'s sibling, and simpler.
 *
 * 🎯 THE SAME REASON TO EXIST: every step is the engine's — `toggleRun` is a `PlayerBase` field, the key is
 * `platform/storage`'s `KEYS.toggleRunP(i)`, and `sr.motor.toggleRun*` are engine i18n keys. **There is no game effect
 * to inject**, which is why `SettingsMobilityCtx.setToggleRun` is optional: a game that does not supply it still gets a
 * live run row instead of a dead one.
 *
 * ⚠️ AND IT DOES NOT CALL `applyLatch`, unlike its sibling. That one stops whoever walks by latch on switch-off, because
 * the MOVEMENT latch leaves the character walking by itself; the run latch governs a speed lock, which cannot leave anyone
 * moving. Copying the line "for symmetry" would touch `walkDir` because of a button that does not.
 *
 * 📌 The announcement is UNCONDITIONAL, like its sibling's: the child pressed the button, and staying silent because the
 * value already was that leaves the control with no answer for whoever listens instead of looking.
 */
export function setRunLatch(ctx: LatchWriteCtx, i: number, on: boolean): void {
  const p = ctx.players[i] as ({ toggleRun?: boolean } | undefined);
  if (!p) return;
  p.toggleRun = on;
  ctx.store.setBool(toggleRunKey(i), on);
  const { t } = ctx;
  ctx.srSay(playerPrefix(t, i, ctx.getNumPlayers()) + t(on ? 'sr.motor.toggleRunOn' : 'sr.motor.toggleRunOff'));
}

/**
 * MOUNTS THIS PANEL'S INSIDE — the per-seat tabs and the three rows it reaches.
 *
 * 🔴 THE CONTRACT WOULD OTHERWISE BE INVISIBLE (the shape `ui/panel-shell` names one level up): this module looks for
 * `#movement-players`, `#opt-facil`, `#opt-altmove` and `#opt-togglerun`, and nothing in the type says so — so it builds
 * them, instead of a panel that opens with nothing but a card, a title and a reset button.
 *
 * ⚠️ AND IT LIVES HERE, not in the composition root: whoever knows these four ids and each control's shape is this file,
 * and nobody else. A root writing them would be a root guessing.
 *
 * ⚠️ THE THREE ROWS ARE ALWAYS CREATED, the latch row included. Whether it is SEEN is decided at init by `holdsKeys`
 * (ADR-0115), with `hidden`, which takes the row off the screen AND out of the accessibility tree. Creating it only when
 * it applies would put the same rule in two places, and the day they diverged the row would appear in a game where it
 * does nothing.
 *
 * 📌 THE ORDER IS THE DECISION, as in every menu of this project (ADR-0044 §2): the tabs first, because they say WHOSE
 * the next choices are; then Easy Mode, the most sought; and the two latches together, the same idea applied to two
 * buttons.
 *
 * Idempotent: calling it twice reuses the list instead of duplicating it.
 */
export function mountMobilityInside(t: Translate, ctx: PanelShellCtx, card: HTMLElement, list: HTMLElement): void {
  if (!ctx.find('#movement-players')) {
    const abas = ctx.create('div');
    abas.id = 'movement-players';
    // Born hidden and empty: `renderMovPlayers()` draws them, because it knows how many seats there are NOW — and the
    // number changes during the match.
    abas.hidden = true;
    card.insertBefore(abas, list);
  }
  const rows: ControlRowSpec[] = [
    { id: 'opt-facil', label: t('motor.facil'), hint: t('motor.facil.dica') },
    { id: 'opt-altmove', label: t('motor.altmove'), hint: t('motor.altmove.dica') },
    { id: 'opt-togglerun', label: t('motor.togglerun'), hint: t('motor.togglerun.dica') },
  ];
  for (const spec of rows) {
    // ⚠️ IT RELABELS INSTEAD OF SKIPPING when the row exists, which is why this function is also called from every
    // open's `render()`: text captured at boot may be in the fallback language, and the title and the rows would end
    // up in different languages on the same screen. See `ui/panel-widgets.labelRow`.
    const existingRow = ctx.find('#' + spec.id);
    if (existingRow) {
      const rowNode = existingRow.closest<HTMLElement>('.ctrl-row');
      if (rowNode) labelRow(rowNode, spec);
      continue;
    }
    list.appendChild(controlRow(ctx, spec).row);
  }
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsMobility(ctx: SettingsMobilityCtx): SettingsMobilityApi {
  const { t } = ctx;
  // ⚠️ RESOLVED ONCE: whoever injects rules, whoever does not still gets it — the engine does it itself (`setMoveLatch`).
  const setToggleMove = ctx.setToggleMove ?? ((i: number, on: boolean) => setMoveLatch(ctx, i, on));
  // Its sibling, by the same rule and for the same reason — see `setRunLatch`.
  const setToggleRun = ctx.setToggleRun ?? ((i: number, on: boolean) => setRunLatch(ctx, i, on));
  // ⚠️ THE WORLD'S REACTION IS THE GAME'S, and its absence is not a dead button: `setEasy` has already written,
  // persisted and announced before getting here.
  const rebuildCoins = ctx.rebuildCoins ?? ((): void => {});
  let selMovPlayer = 0; // the player selected in the mobility panel

  const easyModeButton = ctx.$<HTMLElement>('#opt-facil');
  const altMoveBtn = ctx.$<HTMLElement>('#opt-altmove');
  /**
   * THE ROW'S ORIGINAL HINT, kept once.
   *
   * ⚠️ HERE THE REFUSAL COMES AND GOES: this button is persistent, and the child may put the webcam down and go back to
   * the keyboard — without keeping the original text, the reason would pile up on the row with every device change.
   */
  const altMoveRow = altMoveBtn?.closest<HTMLElement>('.ctrl-row') ?? null;
  const altMoveHint = altMoveRow?.querySelector<HTMLElement>('.opt-hint') ?? null;
  const originalHint = altMoveHint?.textContent ?? '';

  /*
   * ADR-0115 · THE ROW DISAPPEARS IN A GAME THAT HOLDS NOTHING — and disappears for EVERYONE.
   *
   * 🔴 `hidden` and not `aria-disabled`: the child who depends on the latch opens this panel to switch it on, and in a
   * quiz there is nothing to switch on. A control disabled with a reason is still a control that does nothing — and it
   * still takes a place in keyboard navigation, between two that work.
   * 📌 Clause 3 of ADR-0113 is the opposite case and stays intact: there the device REQUIRES the latch, the control
   * exists, and it is `aria-disabled` WITH the reason, reachable so it can be read.
   * ⚠️ `hidden` and not removal: the row may be the page's own markup, and `hidden` is reversible and idempotent where
   * removing someone else's markup is neither.
   */
  if (!ctx.holdsKeys && altMoveRow) altMoveRow.hidden = true;

  /** THIS player's refusal now, or `null`. Recomputed on every reflect: the device in use changes. */
  function refusalFor(i: number) {
    return ctx.transportInUse ? latchRefusal(ctx.transportInUse(i)) : null;
  }
  const toggleRunBtn = ctx.$<HTMLElement>('#opt-togglerun');

  // the bar lights up if ANY player uses Easy Mode or a latch
  function reflectMovementBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-movement');
    if (b) b.classList.toggle('is-on', anyMobilityActive(ctx.players));
    refreshMarks();
  }

  /**
   * The left-the-default mark (ADR-0029). Hung on the reflect that ALREADY runs on every change of the two controls,
   * because a mark that needs its own call is a mark someone will forget — and a wrong mark sends the child to undo what
   * they never touched.
   *
   * The scope follows this menu's reset: the PREFERENCES. The input methods (eyes, mapping) stay out here too — not
   * because they cannot change, but because their default does not live in DEFAULTS, and marking without a single source
   * of "default" would invent a second opinion on it.
   */
  function refreshMarks(): void {
    const easy = ctx.players.some((p) => !!p.easy) !== DEFAULTS.easy;
    const alt = ctx.players.some((p) => !!p.toggleMove) !== DEFAULTS.toggleMove;
    // THE RUN LATCH ASKS DIFFERENTLY, because it SWITCHES ON BY ITSELF on the touch controls. Marking by STATE would
    // light the mark for everyone playing on a tablet, with nobody touching anything — and a mark always lit means
    // nothing.
    //
    // So what marks is the STORED CHOICE. A saved value means someone touched that control; the automatic switch-on
    // saves nothing, so it does not mark.
    const anyRunToggleChosen = ctx.players.some((p, i) => ctx.store.get(toggleRunKey(i)) != null && !!p.toggleRun !== DEFAULTS.toggleRun);
    markChanged(t, easyModeButton?.closest<HTMLElement>('.ctrl-row') ?? null, easy);
    markChanged(t, altMoveBtn?.closest<HTMLElement>('.ctrl-row') ?? null, alt);
    markChanged(t, toggleRunBtn?.closest<HTMLElement>('.ctrl-row') ?? null, anyRunToggleChosen);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="motora"]'), [easy, alt, anyRunToggleChosen]);
  }

  function drawEasy(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.easy);
    if (easyModeButton) {
      easyModeButton.classList.toggle('is-on', on);
      easyModeButton.setAttribute('aria-pressed', String(on));
      easyModeButton.textContent = onOffLabel(t, on);
    }
    reflectMovementBtn();
  }

  function reflectToggleRun(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.toggleRun);
    if (toggleRunBtn) {
      toggleRunBtn.classList.toggle('is-on', on);
      toggleRunBtn.setAttribute('aria-pressed', String(on));
      toggleRunBtn.textContent = onOffLabel(t, on);
    }
    reflectMovementBtn();
  }

  function reflectAltMove(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.toggleMove);
    if (altMoveBtn) {
      altMoveBtn.classList.toggle('is-on', on);
      altMoveBtn.setAttribute('aria-pressed', String(on));
      altMoveBtn.textContent = onOffLabel(t, on);
      /*
       * ⚠️ CLAUSE 3 OF ADR-0113 ON SCREEN: where the latch is required, the control does NOT disappear — it is
       * `aria-disabled` and the reason goes into the hint, which the shell (`ui/settings-panel.fillExplain`) moves to the
       * footer. Disappearing would teach that the thing does not exist; leaving it active would make the child press it
       * and not understand why nothing changed.
       *
       * 📌 And `aria-disabled`, not `disabled`: a really disabled button LEAVES the tab order, and a keyboard user could no
       * longer reach it — so could no longer READ the reason. The same choice #128 names as a defect when made the other
       * way (a CSS class only, no `aria`).
       */
      const refusal = refusalFor(selMovPlayer);
      if (refusal) altMoveBtn.setAttribute('aria-disabled', 'true');
      else altMoveBtn.removeAttribute('aria-disabled');
      if (altMoveHint) altMoveHint.textContent = refusal ? `${originalHint} ${t(refusal.key)}`.trim() : originalHint;
    }
    reflectMovementBtn();
  }

  function setEasy(i: number, on: boolean): void {
    const p = ctx.players[i];
    if (!p) return;
    p.easy = on;
    ctx.store.setBool(easyKey(i), on);
    drawEasy();
    rebuildCoins();
    ctx.srSay(easyAnnouncement(t, i, ctx.getNumPlayers(), on));
  }

  function renderMovPlayers(): void {
    const tabs = ctx.$<HTMLElement>('#movement-players');
    if (!tabs) return;
    const numPlayers = ctx.getNumPlayers();
    selMovPlayer = clampSelPlayer(selMovPlayer, numPlayers);
    tabs.hidden = true; // no tabs — each player edits only their own (scope = the pause actor)
    tabs.innerHTML = playerTabsHTML(numPlayers, selMovPlayer);
    tabs.querySelectorAll<HTMLButtonElement>('button[data-mp]').forEach((b) => {
      b.addEventListener('click', () => {
        selMovPlayer = Number(b.dataset.mp);
        renderMovPlayers();
        drawEasy();
        reflectAltMove();
      });
    });
    // The prose goes back to the footer after the rows are rebuilt (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#movement .overlay__card'));
  }

  /**
   * The panel's four buttons — easy mode, the move toggle, the run toggle and the reset — wired where the page carries
   * them. The engine builds none of them here; a page that lacks one simply has that row missing.
   */
  function wireButtons(): void {
    if (easyModeButton) {
      easyModeButton.addEventListener('click', () => setEasy(selMovPlayer, !ctx.players[selMovPlayer].easy));
    }
    if (altMoveBtn) {
      altMoveBtn.addEventListener('click', () => {
        /*
         * ⚠️ REFUSE BY SAYING, NOT IN SILENCE. The listener is wired once, and a mute `return` would accept the click and
         * ignore it — the other half of what ADR-0076 forbids. So the refusal SPEAKS: whoever pressed learns why, even
         * without seeing the hint.
         */
        const refusal = refusalFor(selMovPlayer);
        if (refusal) { ctx.srSay(t(refusal.key)); return; }
        setToggleMove(selMovPlayer, !ctx.players[selMovPlayer].toggleMove);
        reflectAltMove();
      });
    }
    if (toggleRunBtn) {
      toggleRunBtn.addEventListener('click', () => {
        setToggleRun(selMovPlayer, !ctx.players[selMovPlayer].toggleRun);
        reflectToggleRun();
      });
    }

    // ---- reset THIS menu's defaults (ADR-0028) ----
    //
    // The reach here is SMALLER than the screen, on purpose. The mobility panel also hosts the input methods (key and
    // controller mapping); the reset returns the PREFERENCES and does not touch the INPUT METHOD, for a reason worth more
    // than symmetry:
    //
    //   A RESET MAY ONLY UNDO WHAT IT CAN ALSO REDO.
    //
    // Whoever remapped the keys did it because they reach only some: returning the factory map returns keys their hand
    // does not reach. That mapping has its own reset (#ctrl-reset), where the choice is explicit and not a side effect.
    //
    // That is why the announcement SAYS what was left out: a button that restores less than its name promises has to say
    // so aloud, or the child concludes it did not work.
    const resetBtn = ctx.$<HTMLButtonElement>('#movement-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      ctx.players.forEach((p, i) => {
        if (p.easy) setEasy(i, false);
        if (p.toggleMove) setToggleMove(i, false);
        if (p.toggleRun) setToggleRun(i, false);
      });
      drawEasy();
      reflectAltMove();
      reflectToggleRun();
      ctx.srSay(t('sr.motor.reset'));
    });
  }
  wireButtons();

  drawEasy();
  reflectAltMove();
  reflectToggleRun();

  return {
    renderMovPlayers,
    reflectEasy: drawEasy,
    reflectAltMove,
    reflectToggleRun,
    setEasy,
    setSelPlayer: (i: number) => { selMovPlayer = i; },
    getSelPlayer: () => selMovPlayer,
  };
}
