// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-empathy.ts — Empathy/simulation panel: lets a player WITHOUT a disability experience one
// (color-blindness/low-vision/blindness simulation, simulated hearing loss, one-button play, wheelchair). This is the
// opposite of settings-visual, which CORRECTS the game for a player who has the disability — do not merge the two,
// even where they share the viz-mode catalog or a helper.
// Injected via initSettingsEmpathy(ctx): DOM selector, srSay, store, the state setters (setHearingLoss/
// setOneButton/setWheelchair — the host's: they reach far beyond this panel) plus their live getters, and the shared
// reflect/overlay helpers (renderVizGroup, reflectMobilityEmpathy, reflectVizButtons, frontOverlay — used by sibling
// panels too). The pure catalog slice (EMPATHY_VIZ_MODES) is unit-tested in node; render/open/close are a thin DOM
// shell tested in browser.

import { toggleLabel } from './dom.js';
import { VIZ_MODES, simulatesDisability, type VizMode } from '../render/viz-modes.js';
import { hearingLoss, setHearingLossGraph } from '../platform/audio.js';
import type { Translate } from '../core/i18n.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/**
 * The slice of the catalogue THIS panel shows: only what SIMULATES a disability.
 *
 * The catalogue's `kind` does not tell simulating from correcting, so a filter by `kind` brings the colour-blindness
 * corrections into a menu about feeling what a disability is like — a colour-blind child would have to enter it to find
 * the correction for their own condition, beside the button that simulates it for someone who does not have it. Two
 * opposite audiences in one list.
 *
 * The Dev decided (#60): the corrections live in visual accessibility, and this list is cut by `simulatesDisability`,
 * which answers the right question.
 */
export const EMPATHY_VIZ_MODES: VizMode[] = VIZ_MODES.filter((m) => simulatesDisability(m.key));

/** On/off label shared by every toggle button in this panel (hearing, one-button, wheelchair). */
// `toggleLabel` lives in ui/dom, beside `toggleBtn`.

export interface EmpathySettingsCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** ui/dom.ts querySelector shortcut. */
  $<T extends Element = Element>(sel: string): T | null;
  /** core/a11y-sr.ts screen-reader announcer. */
  srSay(msg: string): void;
  /** platform/storage.ts (or a test double) — read here only, to restore hearing-loss simulation on boot. */
  store: { getBool(key: string, fallback?: boolean): boolean };
  /** Renders one viz-mode radio list (+ per-player tabs); shared with settings-visual. */
  renderVizGroup(listSel: string, tabsSel: string, modes: VizMode[]): void;
  /** Reflects #opt-onebtn/#opt-wheelchair; the host also calls it from its setOneButton/setWheelchair bodies. */
  reflectMobilityEmpathy(): void;
  /** Reflects the #opt-visual/#opt-empathy summary buttons; shared across every viz-mode change in the game. */
  reflectVizButtons(): void;
  /** Brings an overlay to front + fills its footer explanations; shared by every settings panel. */
  frontOverlay(el: HTMLElement | null): void;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY render.
   *
   * ⚠️ AND HERE THE REBUILD IS NOT VISIBLE IN THE FILE. This panel has no `innerHTML` at all: the list is rebuilt by
   * the injected `renderVizGroup`, whose implementation (`render/viz-setters`) sets `el.innerHTML` and returns NEW
   * `.ctrl-row`s, with the `.opt-hint` back inside and without the `data-explain-done` that makes `fillExplain`
   * idempotent.
   *
   * That happens on every click on a simulation and every use of the hearing-loss button — the worst possible case,
   * because the child who just switched on the total-blindness simulation has a black screen and depends on the
   * `aria-live` footer to know where they are.
   *
   * Optional (`?.`) as in the siblings: a consumer that does not inject it still draws the panel.
   */
  fillExplain?: (card: HTMLElement | null) => void;
  /** Returns focus to whoever opened the dialog (ui/settings-panel `restoreFocus`). Injected, not a fixed `#opt-*`:
   *  that id does not exist in the document, so closing would leave focus on `<body>`. */
  restoreFocus?: (id: string) => boolean;
  /** Persists + applies the audio graph change (and announces); the body is the host's. */
  setHearingLoss(on: boolean): void;
  /** Persists + applies one-button-only play (and announces); the body is the host's. */
  setOneButton(on: boolean): void;
  /** Persists + applies wheelchair mode (and announces); the body is the host's. */
  setWheelchair(on: boolean): void;
  /** Live reads of the host's oneButton/wheelchair booleans. */
  getOneButton(): boolean;
  getWheelchair(): boolean;
  /** Live players (core/state `players`), only to know WHICH visual mode each one is using now. */
  getPlayers(): readonly { viz: string }[];
  /** The same setPlayerViz as the visual panel and the contrast shortcut; used here only by the reset. */
  setPlayerViz(i: number, mode: string): void;
}

export interface EmpathySettingsApi {
  /** Redraws the simulation list + reflects the hearing/one-button/wheelchair toggle buttons. */
  render(): void;
  /** Opens the #empathy overlay (renders first, fronts it, focuses its first button). */
  open(): void;
  /** Closes the #empathy overlay and returns focus to #opt-empathy. */
  close(): void;
}

/** Wires the empathy panel's DOM (buttons + boot restore) and returns render/open/close for the host to call. */
export function initSettingsEmpathy(ctx: EmpathySettingsCtx): EmpathySettingsApi {
  const { t } = ctx;
  function render(): void {
    ctx.renderVizGroup('#empathy-list', '#empathy-players', EMPATHY_VIZ_MODES);
    const h = ctx.$<HTMLElement>('#opt-hearing');
    if (h) {
      h.classList.toggle('is-on', hearingLoss);
      h.setAttribute('aria-pressed', String(hearingLoss));
      h.textContent = toggleLabel(t, hearingLoss);  // ui/dom
    }
    ctx.reflectMobilityEmpathy();
    refreshMarks();
    // After `renderVizGroup`, not before: it is what puts the `.opt-hint` back inside the rows.
    ctx.fillExplain?.(ctx.$<HTMLElement>('#empathy .overlay__card'));
  }

  /**
   * The left-the-default mark (ADR-0029). In this menu it means this simulation is ON, which makes it the most useful
   * of all: a child who switched on the blindness simulation has a black screen and cannot read anything — but their
   * screen reader walks the menu and says which row left the default.
   *
   * The cut is the reset's, for the same reason: a colour-blindness CORRECTION a player chose in the visual panel is
   * not this menu's. Marking it here would send the colour-blind child to undo, in the empathy menu, the correction
   * that lets them see the game.
   */
  function refreshMarks(): void {
    const simulating = ctx.getPlayers().some((p) => simulatesDisability(p.viz));
    const deafness = hearingLoss;
    const um = ctx.getOneButton() !== DEFAULTS.oneButton;
    const wheelchair = ctx.getWheelchair() !== DEFAULTS.wheelchair;
    const rowOf = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(t, rowOf('#opt-hearing'), deafness);
    markChanged(t, rowOf('#opt-onebtn'), um);
    markChanged(t, rowOf('#opt-wheelchair'), wheelchair);
    markChanged(t, ctx.$<HTMLElement>('#empathy-list'), simulating);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="empatia"]'), [simulating, deafness, um, wheelchair]);
  }

  function open(): void {
    const ov = ctx.$<HTMLElement>('#empathy');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#empathy');
    if (!ov) return;
    ov.hidden = true;
    if (ctx.restoreFocus && ctx.restoreFocus('empathy')) return;
    const b = ctx.$<HTMLElement>('#opt-empathy');
    if (b) b.focus(); // fallback: this id does not exist in the document today (a hook for a future bar)
  }

  const empathyBtn = ctx.$<HTMLElement>('#opt-empathy');
  if (empathyBtn) empathyBtn.addEventListener('click', open);
  const empathyClose = ctx.$<HTMLElement>('#empathy-close');
  if (empathyClose) empathyClose.addEventListener('click', close);

  const hearingBtn = ctx.$<HTMLElement>('#opt-hearing');
  if (hearingBtn) hearingBtn.addEventListener('click', () => { ctx.setHearingLoss(!hearingLoss); render(); ctx.reflectVizButtons(); });
  if (ctx.store.getBool('incl_hearingloss')) setHearingLossGraph(true); // restores the persisted audio graph at boot

  // `refreshMarks()` after EACH one: these two setters do not go through `render()` — they reflect the button on
  // their own —, so the mark has to be pulled here or it never follows the change.
  const oneBtn = ctx.$<HTMLElement>('#opt-onebtn');
  if (oneBtn) oneBtn.addEventListener('click', () => { ctx.setOneButton(!ctx.getOneButton()); refreshMarks(); });
  const wheelBtn = ctx.$<HTMLElement>('#opt-wheelchair');
  if (wheelBtn) wheelBtn.addEventListener('click', () => { ctx.setWheelchair(!ctx.getWheelchair()); refreshMarks(); });

  // ---- reset THIS menu's defaults (ADR-0028) ----
  //
  // Of all the panels, this is the reset that most needs to exist and most needs care, for the same reason: it is the
  // menu that simulates disabilities. A child who switches on the total-blindness simulation has a black screen.
  //
  // And the care: THE RESET ASKS `simulatesDisability`, which answers per mode. A colour-blindness CORRECTION a player
  // chose in the visual panel is not a simulation; switching it off here would take the only correction a colour-blind
  // child has, at the command of a menu made for whoever is not colour-blind.
  const resetBtn = ctx.$<HTMLButtonElement>('#empathy-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    // Each setter is idempotent and announces on its own when it changes; calling only on a difference avoids a false
    // "off" announcement for something that was never on. The summary announcement comes last, and it is what stays in
    // `#sr-status` — one action, one sentence, instead of three.
    ctx.getPlayers().forEach((p, i) => { if (simulatesDisability(p.viz)) ctx.setPlayerViz(i, 'normal'); });
    if (hearingLoss) ctx.setHearingLoss(false);
    if (ctx.getOneButton() !== DEFAULTS.oneButton) ctx.setOneButton(DEFAULTS.oneButton);
    if (ctx.getWheelchair() !== DEFAULTS.wheelchair) ctx.setWheelchair(DEFAULTS.wheelchair);
    render(); ctx.reflectVizButtons();
    ctx.srSay(t('sr.empathy.reset'));
  });

  return { render, open, close };
}
