// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-empathy.ts — Empathy/simulation panel (Sensibilidade → Empatia): lets a player WITHOUT a disability
// experience one (VIZ_SIM: color-blindness/low-vision/blindness simulation, simulated hearing loss, one-button
// play, wheelchair). This is the opposite of settings-visual, which CORRECTS the game for a player who has the
// disability — do not merge the two, even where they share the viz-mode catalog or a helper.
// Injected via initSettingsEmpathy(ctx): DOM selector, srSay, store, the state setters (setHearingLoss/
// setOneButton/setWheelchair — still game.js: they touch the audio graph, player powers and world geometry far
// beyond this panel) plus their live getters, and the shared reflect/overlay helpers (renderVizGroup,
// reflectMotorEmpathy, reflectVizButtons, frontOverlay — used by sibling panels too, so they stay in game.js).
// Pure catalog/label logic (isSimKind/EMPATHY_VIZ_MODES/toggleLabel) is unit-tested in node; render/open/close
// are a thin DOM shell tested in browser. Model: app/js/render/fx.ts.

import { VIZ_MODES, type VizMode } from '../render/viz-modes.js';
import { hearingLoss, setHearingLossGraph } from '../platform/audio.js';

/** Kinds treated as *simulation* here (vs. the 'hcnew' *correction* kind that settings-visual owns). */
export const isSimKind = (kind: string): boolean => kind === 'filter' || kind === 'lowvision' || kind === 'blind';

/** This panel's slice of the shared viz-mode catalog: color-blindness/low-vision/blindness simulations. */
export const EMPATHY_VIZ_MODES: VizMode[] = VIZ_MODES.filter((m) => isSimKind(m.kind));

/** On/off label shared by every toggle button in this panel (hearing, one-button, wheelchair). */
export const toggleLabel = (on: boolean): string => (on ? '❚❚ Ligado' : '▶ Desligado');

export interface EmpathySettingsCtx {
  /** ui/dom.ts querySelector shortcut. */
  $<T extends Element = Element>(sel: string): T | null;
  /** core/a11y-sr.ts screen-reader announcer. */
  srSay(msg: string): void;
  /** platform/storage.ts (or a test double) — read here only, to restore hearing-loss simulation on boot. */
  store: { getBool(key: string, fallback?: boolean): boolean };
  /** Renders one viz-mode radio list (+ per-player tabs); shared with settings-visual, so it stays in game.js. */
  renderVizGroup(listSel: string, tabsSel: string, modes: VizMode[]): void;
  /** Reflects #opt-onebtn/#opt-wheelchair; game.js also calls it from its setOneButton/setWheelchair bodies. */
  reflectMotorEmpathy(): void;
  /** Reflects the #opt-visual/#opt-empathy summary buttons; shared across every viz-mode change in the game. */
  reflectVizButtons(): void;
  /** Brings an overlay to front + fills its footer explanations; shared by every Sensibilidade panel. */
  frontOverlay(el: HTMLElement | null): void;
  /** Persists + applies the audio graph change (and announces); body stays in game.js. */
  setHearingLoss(on: boolean): void;
  /** Persists + applies one-button-only play (and announces); body stays in game.js. */
  setOneButton(on: boolean): void;
  /** Persists + rebuilds world geometry for wheelchair mode (and announces); body stays in game.js. */
  setWheelchair(on: boolean): void;
  /** Live reads of game.js's oneButton/wheelchair booleans (not yet migrated to core/state.ts). */
  getOneButton(): boolean;
  getWheelchair(): boolean;
}

export interface EmpathySettingsApi {
  /** Redraws the simulation list + reflects the hearing/one-button/wheelchair toggle buttons. */
  render(): void;
  /** Opens the #empathy overlay (renders first, fronts it, focuses its first button). */
  open(): void;
  /** Closes the #empathy overlay and returns focus to #opt-empathy. */
  close(): void;
}

/** Wires the empathy panel's DOM (buttons + boot restore) and returns render/open/close for game.js to call. */
export function initSettingsEmpathy(ctx: EmpathySettingsCtx): EmpathySettingsApi {
  function render(): void {
    ctx.renderVizGroup('#empathy-list', '#empathy-players', EMPATHY_VIZ_MODES);
    const h = ctx.$<HTMLElement>('#opt-hearing');
    if (h) {
      h.classList.toggle('is-on', hearingLoss);
      h.setAttribute('aria-pressed', String(hearingLoss));
      h.textContent = toggleLabel(hearingLoss);
    }
    ctx.reflectMotorEmpathy();
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
    const b = ctx.$<HTMLElement>('#opt-empathy');
    if (b) b.focus();
  }

  const empathyBtn = ctx.$<HTMLElement>('#opt-empathy');
  if (empathyBtn) empathyBtn.addEventListener('click', open);
  const empathyClose = ctx.$<HTMLElement>('#empathy-close');
  if (empathyClose) empathyClose.addEventListener('click', close);

  const hearingBtn = ctx.$<HTMLElement>('#opt-hearing');
  if (hearingBtn) hearingBtn.addEventListener('click', () => { ctx.setHearingLoss(!hearingLoss); render(); ctx.reflectVizButtons(); });
  if (ctx.store.getBool('incl_hearingloss')) setHearingLossGraph(true); // restaura o grafo de áudio persistido no boot

  const oneBtn = ctx.$<HTMLElement>('#opt-onebtn');
  if (oneBtn) oneBtn.addEventListener('click', () => ctx.setOneButton(!ctx.getOneButton()));
  const wheelBtn = ctx.$<HTMLElement>('#opt-wheelchair');
  if (wheelBtn) wheelBtn.addEventListener('click', () => ctx.setWheelchair(!ctx.getWheelchair()));

  return { render, open, close };
}
