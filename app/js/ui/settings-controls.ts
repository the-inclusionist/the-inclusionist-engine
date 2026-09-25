// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-controls — Keyboard-remap panel: the thin DOM-touching render()/handleCaptureKeydown(); what a key is
// and whose it already is lives in ./control-choices.js. DI via initSettingsControls(ctx): `$` (DOM selector),
// `srSay`/`srAlert`, `store` (save/reset persistence), the live `kb` value + `setKB` setter, and the shared per-player
// helpers (`kbFor`/`getNumPlayers`/`applyControls`/`assignControls`) the host also uses elsewhere, injected. Overlay
// open/close plumbing (focus management, Escape-closes-dialog) is shared infrastructure.
import { t } from '../core/i18n.js';
import type { DomQuery } from '../core/dom-query.js';
import type { KeyScheme } from '../core/entity.js';
import { isAction, type Action } from '../core/actions.js';
import { keyName, keyUsedByOther, actionAlreadyBound } from './control-choices.js';
import { markChanged } from './changed-mark.js';
import { controlRow } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import type { KBDefaults } from '../input/keyboard.js';
import type { KeydownEventLike } from '../input/keydown.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` lives in `core/dom-query`: copies of this line in many modules drifted apart. Re-exported for whoever
// already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {jump:['KeyJ','Space']}. */
// `KeyScheme` lives in `core/entity`: the entity declares `ctrl: KeyScheme | null`, so it is the owner. Re-exported for
// whoever already imported it from here.
export type { KeyScheme } from '../core/entity.js';

/** Opaque keyboard config (input/keyboard.ts's KBDefaults shape: {solo,p2,p3,p4}) — never indexed directly here;
 *  all per-player reads go through the injected `kbFor`, so this module stays decoupled from its exact shape. */
/** `input/keyboard`'s `KBDefaults`, which is the owner. This module still does NOT INDEX the value — every per-player
 *  read goes through the injected `kbFor` —, and that discipline is what decouples it, not a wide type. */
export type KeyboardConfig = KBDefaults;

/** Minimal persistence shape this module needs (input/keyboard.ts's saveKB/resetKB — no direct localStorage). */
export interface ControlsStore {
  saveKB(kb: KeyboardConfig): void;
  resetKB(): KeyboardConfig;
}

export interface SettingsControlsCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /**
   * THE POSITIONS THIS GAME USES, each with its own word, in the current language.
   *
   * ⚠️ The engine does not decide which positions a game has: a table here would give every game the same rows, and a
   * quiz would show rows for actions that do not exist in it — a child would try to remap a button that does nothing.
   */
  // ⚠️ `action` is `Action` and not `string` (issue #118): it is the ABSTRACT name of the position, which the engine
  // enumerates in `core/actions` (ADR-0086). As a `string`, a game could declare a position that does not exist and the
  // row would be drawn with empty keys, nothing pointing at the error — the child would see an action that never answers.
  gameActions: () => readonly { readonly action: Action; readonly label: string }[];
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Screen-reader "assertive" announcement (core/a11y-sr's srAlert) — used for the capture prompt/conflict. */
  srAlert: (msg: string) => void;
  /** Persistence (input/keyboard.ts's saveKB/resetKB), injected. */
  store: ControlsStore;
  /** The live keyboard config object. Mutated in place by successful remaps. */
  kb: KeyboardConfig;
  /** Replaces the host's keyboard config wholesale — only used by the reset (reset reassigns, doesn't mutate). */
  setKB: (kb: KeyboardConfig) => void;
  /** Shared helper (the host's): the scheme for a given player index, given `kb`/numPlayers. Not owned by this panel —
   *  other systems (gamepad binding, HUD) call the same function. */
  kbFor: (playerIndex: number) => KeyScheme;
  /**
   * This seat's FACTORY scheme (ADR-0029) — what it would have if nobody had remapped anything.
   *
   * ⚠️ INJECTED FOR THE SAME REASON AS `kbFor` JUST ABOVE: the "how many players → which bucket" mapping
   * (`solo`/`p2`/`p3`/`p4`) is the consumer's, and a second copy of that rule inside the engine would drift from the
   * first the day one of them changed.
   *
   * 🎯 AND IT IS NOT OBTAINED BY CALLING `store.resetKB()`, although it returns exactly the factory configuration:
   * `input/keyboard.resetKB` does `store.remove(CKEY)` BEFORE returning the copy. Using it as a reader would erase the
   * child's remapping on every render, and the damage would only show at the next boot.
   */
  defaultSchemeFor: (playerIndex: number) => KeyScheme;
  /** Shared: current player count, read live from the host. */
  getNumPlayers: () => number;
  /** Shared: propagates `kb` -> the live control aliases (the host's applyControls). Called after remap/reset. */
  applyControls: () => void;
  /** Shared: propagates `kb` -> each player's `p.ctrl` (the host's assignControls). Called after remap/reset. */
  assignControls: () => void;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY render.
   *
   * ⚠️ This panel REBUILDS its rows, and the new rows come back with the prose inside — so without this call the
   * explanation appears twice, in the footer and under the label, from the first click. `CLAUDE.md` §4 records exactly
   * this (issue #109).
   *
   * Optional in the signature because a consumer can mount the panel without the shell (a test): without the shell
   * there is no footer to duplicate.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

export interface SettingsControlsApi {
  /** Re-renders #ctrl-list for the given player index and (re)wires its "Alterar" buttons. Idempotent. */
  render: (selPlayer: number) => void;
  /** True while a key capture is in progress (menu navigation gates on this). */
  isCapturing: () => boolean;
  /** Cancels any in-progress capture without re-rendering (dialog is closing anyway). */
  cancelCapture: () => void;
  /**
   * Feeds a keydown to the in-progress capture, if any. Returns true when the event was consumed (capture was
   * active — Escape/conflict/success all consume it) so the caller's keydown handler can return early. Returns false
   * (no-op) when nothing is being captured.
   */
  /** `KeydownEventLike` from `input/keydown`, which listens to the keyboard and so owns the event's shape in this
   *  engine. This handler reads only `e.code` and calls `preventDefault()` — a subset —, and asking for the whole
   *  `KeyboardEvent` would force the dispatch to deliver more than it has (ADR-0039). */
  handleCaptureKeydown: (e: KeydownEventLike) => boolean;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/**
 * The platformer's eight positions, tied to the i18n keys of ITS words.
 *
 * ⚠️ DECLARED DEBT: the words of ONE game inside an engine module. Nothing in `app/js` reads it — the engine's help
 * panel (`ui/help-panel`) and this remap panel ask the game for its words through `gameActions()`, because the engine
 * knows a position exists and only the game knows what it is called (ADR-0086). It stays published only for a consumer
 * that has not migrated; removing it is a change to published surface.
 *
 * It holds KEYS and not text because a module `const` is evaluated once, on import, and `core/i18n`'s dictionary is
 * reassigned by `setLocale` — text captured here would freeze the language at boot.
 */
export const ACT_LABEL: Record<string, string> = {
  left: 'act.left', right: 'act.right', up: 'act.up', down: 'act.down',
  action1: 'act.run', action2: 'act.jump', action4: 'act.swap', action3: 'act.especial',
};

/*
 * 🎯 WHAT A KEY IS AND WHOSE IT ALREADY IS lives in `./control-choices.js` — `keyName`, `keyUsedByOther` and
 * `actionAlreadyBound`. This file keeps the work its name always described: drawing the screen, wiring the clicks and
 * driving the capture. No alias left behind: a re-export keeps alive a path nothing here uses and makes the surface
 * snapshot LIE, because it does not see re-exports (#204).
 */

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

interface CaptureState { action: Action; mapRef: KeyScheme }

/** The id of a position's button. It comes from the action's ABSTRACT name, unique by construction (`core/actions`). */
export const ctrlControlId = (action: string): string => `ctrl-act-${action}`;

/**
 * THE BUTTON'S FACE: the current keys, one `<kbd>` each.
 *
 * ⚠️ With no key the button would have an empty face — a 44 px target with nothing to say —, so the change word comes
 * back, which is where it still means something: there is no key to show, there is one to set.
 *
 * 📌 Through the DOM API and not a string: `keyName` returns a code's READABLE name, which may be translated tomorrow —
 * translated text interpolated into markup is the door issue #106 closed.
 */
export function drawKeys(button: HTMLElement, codes: readonly string[]): void {
  button.textContent = '';
  if (!codes.length) { button.textContent = t('ctrl.change'); return; }
  for (const code of codes) {
    const key = button.ownerDocument.createElement('kbd');
    key.textContent = keyName(t, code);
    button.appendChild(key);
  }
}

export function initSettingsControls(ctx: SettingsControlsCtx): SettingsControlsApi {
  let kb = ctx.kb;
  let capture: CaptureState | null = null;
  let lastPlayer = 0;

  function schemesFor(): KeyScheme[] {
    const n = ctx.getNumPlayers();
    return Array.from({ length: n }, (_, i) => ctx.kbFor(i));
  }

  /**
   * HOW THIS GAME CALLS this position, or `null` if it does not name it. One place, because several points need it and
   * each fetching it on its own is how one of them reads the wrong table (#125).
   *
   * 🔴 NO FALLBACK TO THE ABSTRACT ID. ADR-0074 says so in so many words: the name the CHILD reads and hears is always
   * the game's word, never `action1`, and an abstract name reaching a person is a defect. With the engine's DEFAULT
   * scheme binding eight positions and a quiz naming three, a fallback would have the screen reader say a key already
   * belongs to `action2` — precisely to the child who has no other channel.
   *
   * 📌 It is the same answer `core/actions.labellerFrom` gives: `null`, and the caller decides — an absence becomes one
   * step less, never a mute step.
   */
  function gameWordFor(a: Action): string | null {
    return ctx.gameActions().find((x) => x.action === a)?.label ?? null;
  }

  /**
   * THE LINE THAT SAYS WHOSE CONTROLLER THIS IS — «editing your controller, mode N players». There are no
   * tabs for the other players: each child edits only their own, and only the mode changes the sentence.
   *
   * ⚠️ The sentence is split at the `{modo}` marker BEFORE substitution, so the mode can sit in a `<strong>`
   * without the dictionary carrying markup (the `i18n-sem-markup` gate forbids that, rightly: a dictionary
   * string that becomes markup is where a translation turns into code). It left raw Portuguese in #125.
   */
  function drawModeLine(n: number): void {
    const tabs = ctx.$<HTMLElement>('#ctrl-players');
    if (!tabs) return;
    tabs.hidden = false;
    // The skeleton by `innerHTML` carries no outside data; the TEXT goes in by `textContent`.
    tabs.innerHTML = '<span class="opt-hint" style="width:100%;margin:0">'
      + '<span data-modo="pre"></span><strong data-modo="v"></strong><span data-modo="pos"></span></span>';
    const [before, after] = t('ctrl.editingYours').split('{modo}');
    const setText = (sel: string, txt: string): void => {
      const part = tabs.querySelector<HTMLElement>(sel);
      if (part) part.textContent = txt;
    };
    setText('[data-modo="pre"]', before ?? '');
    setText('[data-modo="v"]', n === 1 ? t('ctrl.mode.one') : t('ctrl.mode.many', { n }));
    setText('[data-modo="pos"]', after ?? '');
  }

  /**
   * THE «LEFT THE DEFAULT» MARK (ADR-0029), on every row whose keys differ from this seat's factory scheme.
   * It is missed most in this menu, whose whole reason to exist is changing things: without it a child who
   * remapped heard the action names and nothing said where they had changed something.
   *
   * ⚠️ The default comes from the host (`ctx.defaultSchemeFor`), like `kbFor`: which scheme a player count uses is
   * theirs, and a second copy here would drift. And never `resetKB` to read it — it is DESTRUCTIVE
   * (`input/keyboard.resetKB` removes the stored scheme first), so calling it per render would erase the
   * child's remapping.
   *
   * 📌 It compares the LIST OF CODES, not object identity: re-binding the SAME key is not a change, and a child
   * who tries something and goes back cannot be left with the mark lit for good.
   */
  function markWhatLeftTheDefault(list: HTMLElement, player: number): void {
    const factory = ctx.defaultSchemeFor(player);
    const now = ctx.kbFor(player);
    const sameKeys = (a: readonly string[] | null | undefined, b: readonly string[] | null | undefined): boolean =>
      (a ?? []).length === (b ?? []).length && (a ?? []).every((k, i) => k === (b ?? [])[i]);
    for (const row of list.querySelectorAll<HTMLElement>('.ctrl-row')) {
      const act = row.querySelector<HTMLElement>('button[data-act]')?.dataset.act;
      if (!act || !isAction(act)) continue;
      markChanged(t, row, !sameKeys(now[act], factory[act]));
    }
  }

  function render(selPlayer: number): void {
    const el = ctx.$<HTMLElement>('#ctrl-list');
    if (!el) return;
    const n = ctx.getNumPlayers();
    const player = selPlayer >= n ? 0 : selPlayer;
    lastPlayer = player;
    drawModeLine(n);

    const map = ctx.kbFor(player);
    /*
     * 🎯 THE ROWS COME FROM THE KIT (ADR-0129), and the button's face is the current key — the Dev, asked whether the
     * change word was worth keeping: «Não vale, vamos de B».
     *
     * 🔴 AND THE REASON IS NOT TASTE, IT IS A COLLISION: `fillExplain` acts on any row with a short `<strong>` label by
     * keeping only that label in the `<span>`, so keys placed inside the label's `<span>` would be wiped and the key text
     * sent to the footer as if it were an explanation. The keys go INSIDE the control, the same answer `mountSteps`
     * gives to a label plus a live value.
     *
     * ⚠️ The game's word goes in through `textContent` (`controlRow` writes `label` that way) and the accessible name by
     * `setAttribute` (`ariaLabel`), the two fixes issues #106 and #125 paid for: `label` is GAME TEXT this tree does not
     * review, and a wrong `aria-label` OVERRIDES the visible text.
     */
    const panelCtx: PanelShellCtx = { find: (sel) => ctx.$<HTMLElement>(sel), create: (tag) => el.ownerDocument.createElement(tag) };
    el.textContent = '';
    for (const { action: a, label: label } of ctx.gameActions()) {
      const { row: row, controle: control } = controlRow(panelCtx, {
        id: ctrlControlId(a),
        label: label,
        shape: 'button',
        ariaLabel: t('ctrl.changeKeyAria', { acao: label, n: player + 1 }),
      });
      // `data-act` stays, and the difference from `label` is the reason: `a` is the position's ABSTRACT name, which the
      // engine enumerates in `core/actions`, and `label` is the GAME's word (ADR-0086).
      control.dataset.act = a;
      drawKeys(control, map[a] ?? []);
      el.appendChild(row);
    }

    markWhatLeftTheDefault(el, player);

    el.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        // ⚠️ `isAction` AND NOT JUST `if (!act)`: the value comes from a DOM attribute, and the scheme accepts only the
        // fourteen positions (#118). A capture started on an invented position would store a key under a name no
        // transport reads — the child would press the new key and nothing would happen.
        const act = b.dataset.act;
        if (!act || !isAction(act)) return;
        // ⚠️ NO WORD, NO QUESTION — `labellerFrom`'s rule, applied where it is visible: if the game does not use it,
        // there is nothing to map. The rows all come from `gameActions()`, so this does not happen today — and that
        // guarantee is written rather than assumed, because whoever breaks it tomorrow wakes an announcement with no
        // subject.
        const word = gameWordFor(act);
        if (!word) return;
        capture = { action: act, mapRef: map };
        b.textContent = t('ctrl.pressing'); // from the dictionary, never raw text inside the engine (#125)
        ctx.srAlert(t('sr.ctrl.pressNewKey', { acao: word, n: player + 1 }));
      });
    });
    // The prose goes back to the footer after the rows are rebuilt (CLAUDE.md §4, #109).
    // ⚠️ ON THE CARD THAT HOLDS THE LIST, not a fixed `#options`: the engine mounts this panel with another id (`#ctrl`,
    // ADR-0151), and the footer of a panel that is not open is not this child's.
    ctx.fillExplain?.(el.closest<HTMLElement>('.overlay__card'));
  }

  function isCapturing(): boolean {
    return capture !== null;
  }

  function cancelCapture(): void {
    capture = null;
  }

  function handleCaptureKeydown(e: KeydownEventLike): boolean {
    if (!capture) return false;
    if (e.code === 'Escape') {
      capture = null;
      render(lastPlayer);
      e.preventDefault();
      return true;
    }
    const other = keyUsedByOther(e.code, capture.mapRef, schemesFor());
    if (other >= 0) {
      ctx.srAlert(t('sr.ctrl.keyTaken', { n: other + 1 }));
      e.preventDefault();
      return true; // does not bind: keeps capturing
    }
    // THE SAME guard, inside the scheme itself (#126). It refuses instead of MOVING, and the choice has a reason: moving
    // would leave the old action with an empty list — which `bindingProblems` classifies as a problem, and which the
    // child would discover mid-game, with no announcement, as an action that stopped existing. Refusing costs two steps
    // (free the old one, bind the new one) and loses nothing on the way.
    const here = actionAlreadyBound(e.code, capture.mapRef, capture.action);
    if (here) {
      // ⚠️ `here` COMES FROM THE SCHEME, and the scheme binds positions the game may not name. With no word, the sentence
      // says the truth that MATTERS (the key is taken here) instead of the internal name: silence would be the twin
      // defect, and saying `action2` would be the defect.
      const word = gameWordFor(here);
      ctx.srAlert(word
        ? t('sr.ctrl.keyTakenHere', { acao: word })
        : t('sr.ctrl.keyTakenHereUnnamed'));
      e.preventDefault();
      return true; // does not bind: keeps capturing
    }
    capture.mapRef[capture.action] = [e.code];
    ctx.store.saveKB(kb);
    ctx.applyControls();
    ctx.assignControls();
    capture = null;
    render(lastPlayer);
    e.preventDefault();
    return true;
  }

  const resetBtn = ctx.$<HTMLButtonElement>('#ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      kb = ctx.store.resetKB();
      ctx.setKB(kb);
      ctx.applyControls();
      ctx.assignControls();
      render(lastPlayer);
      ctx.srSay(t('sr.ctrl.reset'));
    });
  }

  return { render, isCapturing, cancelCapture, handleCaptureKeydown };
}
