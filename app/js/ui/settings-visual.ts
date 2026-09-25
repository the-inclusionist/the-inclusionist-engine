// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-visual — the visual accessibility overlay: high-contrast level, L→Q contrast enhancement,
// owner-colored items, CB-safe (Okabe-Ito) palette, color-blocking role colors, and the two outline selects
// (foreground/background). The selected player and `setPlayerViz`/`setLq`/`setOwnerColors`/`setCbSafe`/
// `setOutlineFg`/`setOutlineBg`/`setRoleColor`/`resetRoleColors` are INJECTED — they reach texture caches and the
// world, which belong to the host. The player count and players come from the round the root owns.

import type { Translate } from '../core/i18n.js';
import { mountSteps, updateSteps, nextStep, controlRow, labelRow, type ControlRowSpec } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';


// The DEFAULT colours of the four roles, from render/hc-role-data (a leaf, no dependencies) — the same source
// render/high-contrast uses to repaint the tiles. Here they only say whether the child changed one.
import { HC_ROLE_DEF } from '../render/hc-role-data.js';
import { DEFAULTS } from '../core/setting-defaults.js';
/*
 * 📌 THE PURE HALF LIVES IN `ui/visual-choices` (ADR-0221), and the SUITE pointed at the seam:
 * `tests/settings-visual.node.test.js` imports exactly those names, and the node project mounts no document — so whoever
 * wrote those cases had to know where this panel stops being a panel.
 *
 * ⚠️ NO ALIAS: a re-export would keep alive a published path nothing in here uses — surface with no consumer
 * (issue #204).
 */
import {
  ROLE_KEYS, ROLE_LABELS, LQ_STEPS, lqLabel, lqPosition, clampSelectedPlayer, rgbToHex, onOffLabel, resolveVisualMode,
  VISUAL_MODES, type RGB, type RoleKey,
} from './visual-choices.js';
// The default of the TWO AXES (ADR-0076/#104). The mark asks the new model, not the p.viz mirror.
import { DEFAULT_VISUAL as PADRAO_VISUAL } from '../render/viz-axes.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/** Live snapshot of the state this panel does not own — read fresh on every render(). */
export interface VisualSettings {
  lq: number; // 0..1, L→Q contrast enhancement
  ownerColors: boolean;
  cbSafe: boolean;
  outlineFg: number; // 0=none 1=thin 2=thick
  outlineBg: number;
  roleColors: Record<RoleKey, RGB>;
}

export interface SettingsVisualCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** How many players/screens. ROUND state (ADR-0038): it comes from the instance the root owns — a module `let` would
   *  be shared by any second game the same page loads. */
  getNumPlayers: () => number;
  /** The players. ROUND state, for the same reason. `readonly unknown[]` because each consumer narrows to ITS slice —
   *  the real type is the game's, not the engine's (ADR-0033). */
  getPlayers: () => readonly unknown[];
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (text: string) => void;
  /** Fresh read of lq/ownerColors/cbSafe/outlineFg/outlineBg/roleColors (the host's live values). */
  getVisualSettings: () => VisualSettings;
  /** The selected player — shared with the Empathy panel; owned by the host. */
  getSelectedPlayer: () => number;
  setSelectedPlayer: (i: number) => void;
  /** Same setPlayerViz used by the Empathy panel and the physical contrast-cycle shortcut. */
  setPlayerViz: (i: number, mode: string) => void;
  /**
   * The TWO axes of this panel (#104). The Empathy panel keeps `renderVizGroup`.
   *
   * ⚠️ The state has two axes, and the per-axis writers change one without touching the other — a single exclusive list
   * would no longer tell the truth about it.
   */
  renderVisualAxes: (listSel: string, tabsSel: string) => void;
  setLq: (t: number) => void;
  setOwnerColors: (on: boolean) => void;
  setCbSafe: (on: boolean) => void;
  setOutlineFg: (level: number) => void;
  setOutlineBg: (level: number) => void;
  setRoleColor: (key: RoleKey, hex: string) => void;
  resetRoleColors: () => void;
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
  /** Which host-specific rows to draw (see `VisualRowsOffered`). Absent = all, as before. */
  offer?: VisualRowsOffered;
}


/**
 * Reads `player[i].visual` defensively, without importing the player type — the same shape as `playerViz` below, for
 * the same reason: `getPlayers()` returns `readonly unknown[]` because the real type is the GAME's (ADR-0033), and each
 * consumer narrows to ITS slice.
 *
 * ⚠️ With no player or no field, it returns the DEFAULT — the right answer to "did this child change anything?":
 * whoever does not exist changed nothing. Inventing a value here would mark a menu nobody touched.
 */
function playerVisual(list: readonly unknown[], i: number): { theme: string; correction: string } {
  const v = (list[i] as { visual?: { tema?: unknown; correcao?: unknown } } | undefined)?.visual;
  return {
    theme: typeof v?.tema === 'string' ? v.tema : PADRAO_VISUAL.tema,
    correction: typeof v?.correcao === 'string' ? v.correcao : PADRAO_VISUAL.correcao,
  };
}

/** Reads player[i].viz defensively (no player at that index -> 'normal'), without a Player type import. */
function playerViz(list: readonly unknown[], i: number): string {
  const p = list[i] as { viz?: unknown } | undefined;
  return typeof p?.viz === 'string' ? p.viz : 'normal';
}


/**
 * The rows a host OFFERS beyond the two every host can drive (contrast enhancement and the safe palette).
 *
 * ⚠️ Owner colours and the colour-blocking roles belong to a game that has item owners and «lava, ladder, water, gate»
 * roles; the engine's own panel (`createGame`) has no writer for either and must not describe a game it does not know.
 * The default keeps every existing consumer's panel exactly as it was.
 */
export interface VisualRowsOffered { readonly owner: boolean; readonly roles: boolean }
const EVERY_ROW_OFFERED: VisualRowsOffered = { owner: true, roles: true };

/** The OWNER-COLOURED ITEMS row, already translated. A switch. */
function ownerRowSpec(t: Translate): ControlRowSpec {
  return { id: 'opt-ownercolors', label: t('visual.dono'), hint: t('visual.dono.dica') };
}

/** The SAFE PALETTE (Okabe-Ito) row, already translated. */
function cbSafeRowSpec(t: Translate): ControlRowSpec {
  return { id: 'opt-cbsafe', label: t('visual.cbsafe'), hint: t('visual.cbsafe.dica') };
}

/**
 * Mounts this panel's inside ONCE. Called again, it RELABELS instead of rebuilding.
 *
 * 🔴 Rebuilding costs more than duplicated markup: rebuilt on every render, the contrast boost's STEPS control would be
 * a new element each time — a click on any other row would take the cursor off it —, and any node the root inserts
 * into the list would be erased.
 *
 * ⚠️ Relabel and not rebuild, for the reason `labelRow` already states: listeners are wired at boot, and remaking the
 * row would leave a control in the document with no listener — a dead button that looks alive (ADR-0106 §5).
 */
function mountVisualInside(t: Translate, ctx: PanelShellCtx, list: HTMLElement, offered: VisualRowsOffered = EVERY_ROW_OFFERED): void {
  /*
   * 🔴 THE CONTRAST BOOST, IN STEPS AND WITH THE PROSE IN THE RIGHT PLACE (ADR-0151). The explanation lives in an
   * `.opt-hint` from birth (`CLAUDE.md` §4), and THE LABEL GOES INSIDE THE STEPS — «◀ Realce de contraste: linear ▶»
   * (ADR-0130 errata). `render` places the control, because it knows the current position.
   */
  let enhanceRow = list.querySelector<HTMLElement>('.ctrl-row--passos');
  if (!enhanceRow) {
    enhanceRow = ctx.create('div');
    enhanceRow.className = 'ctrl-row ctrl-row--passos';
    const envelope = ctx.create('span');
    const newHint = ctx.create('span');
    newHint.className = 'opt-hint';
    envelope.appendChild(newHint);
    enhanceRow.appendChild(envelope);
    const placeholder = ctx.create('span');
    placeholder.setAttribute('data-passos-lugar', 'lq');
    enhanceRow.appendChild(placeholder);
    list.appendChild(enhanceRow);
  }
  const enhanceHint = enhanceRow.querySelector<HTMLElement>('.opt-hint');
  if (enhanceHint) enhanceHint.textContent = t('visual.lq.dica');

  for (const spec of [...(offered.owner ? [ownerRowSpec(t)] : []), cbSafeRowSpec(t)]) {
    const already = ctx.find('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
    if (already) labelRow(already, spec);
    else list.appendChild(controlRow(ctx, spec).row);
  }

  if (offered.roles) mountRoleColoursRow(t, ctx, list);
}

/**
 * The FOUR ROLES row, and the only row of this panel the kit does not build.
 *
 * 📌 AND NOT FOR LACK OF ANOTHER SHAPE: `controlRow` builds one label, one hint and ONE control, and this row has FIVE —
 * four colour swatches and the ↺ that resets them. Inventing a shape for it would give a second answer to the question
 * of what a row is, which is exactly what the kit exists to prevent. It stays in nodes with the same discipline as the
 * rest: mounted once, relabelled after.
 *
 * 📌 THE FRAME TRANSLATES, THE ROLE'S NAME PASSES THROUGH (`CLAUDE.md` §A FRONTEIRA): the frame is the engine's and goes
 * through `t()`; the role's name is the word of the GAME mounting this panel, and the engine neither translates nor
 * invents it — it passes through `{param}`, so the sentence stays true in a cartridge with other roles.
 */
function mountRoleColoursRow(t: Translate, ctx: PanelShellCtx, list: HTMLElement): void {
  let row = ctx.find('#opt-role-reset')?.closest<HTMLElement>('.ctrl-row') ?? null;
  if (!row) {
    row = ctx.create('div');
    row.className = 'ctrl-row';
    const envelope = ctx.create('span');
    envelope.appendChild(ctx.create('strong'));
    const newHint = ctx.create('span');
    newHint.className = 'opt-hint';
    envelope.appendChild(newHint);
    row.appendChild(envelope);
    const swatches = ctx.create('span');
    swatches.style.cssText = 'display:flex;gap:.35rem;align-items:center';
    for (const k of ROLE_KEYS) {
      const swatch = ctx.create('input');
      swatch.id = 'opt-role-' + k;
      swatch.setAttribute('type', 'color');
      swatch.style.cssText = 'inline-size:2.2em;block-size:1.8em;padding:0;border:1px solid #666;border-radius:4px;background:none';
      swatches.appendChild(swatch);
    }
    const resetButton = ctx.create('button');
    resetButton.id = 'opt-role-reset';
    resetButton.className = 'mode-btn';
    resetButton.setAttribute('type', 'button');
    resetButton.textContent = '↺';
    swatches.appendChild(resetButton);
    row.appendChild(swatches);
    list.appendChild(row);
  }
  const label = row.querySelector<HTMLElement>('strong');
  if (label) label.textContent = t('visual.papeis');
  const hint = row.querySelector<HTMLElement>('.opt-hint');
  if (hint) hint.textContent = t('visual.papeis.dica');
  for (const k of ROLE_KEYS) {
    ctx.find('#opt-role-' + k)?.setAttribute('aria-label', t('visual.papel.cor', { papel: ROLE_LABELS[k] }));
  }
  ctx.find('#opt-role-reset')?.setAttribute('aria-label', t('visual.papel.repor'));
}

/** Are two role colours the same? Compared per component — `[0,0,0] === [0,0,0]` is `false` in JS, and that `false`
 *  would say "changed" for a colour nobody touched, sending the child to undo what they did not do. */
// 🎯 Not published: both its readers are here, a screen away.
function sameRgb(a: RGB | undefined, b: RGB | undefined): boolean {
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// ---------- Thin DOM shell ----------

export interface SettingsVisual {
  /** Rebuilds #visual-list and (re)wires its controls — call whenever the panel should reflect fresh state. */
  render: () => void;
}

export function initSettingsVisual(ctx: SettingsVisualCtx): SettingsVisual {
  const { t } = ctx;
  /*
   * 📌 THE KIT'S CTX COMES FROM THE LIST NODE ITSELF, not from a global `document` nor a new contract field.
   * `ownerDocument` is the document that list LIVES in — exactly the document the rows must be born in —, so this
   * module's global reach stays ZERO (ADR-0221) and `SettingsVisualCtx`, which is published surface, gains no required
   * member (ADR-0172). The same shape as `ui/settings-aac`.
   */
  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  /** The boost's position is LOCAL to the control: the injected `setLq` may not return the new value in
   *  `getVisualSettings` until the next render, and rereading from there would move the position back. */
  let enhanceStep = lqPosition(ctx.getVisualSettings().lq);
  const enhanceSpec = () => ({ label: t('visual.lq'), values: LQ_STEPS.map((v) => t(lqLabel(v))), current: enhanceStep });

  /** Listeners are wired ONCE. A second `addEventListener` on the same button gives two clicks per click. */
  let wired = false;
  function wireOnce(list: HTMLElement): void {
    if (wired) return;
    wired = true;
    const placeholder = ctx.$<HTMLElement>('[data-passos-lugar="lq"]');
    if (placeholder) {
      const stepper = mountSteps(kitCtx(list), enhanceSpec());
      stepper.id = 'opt-lq';
      placeholder.replaceWith(stepper);
      stepper.addEventListener('passo', (ev) => {
        const nextIndex = nextStep(enhanceStep, LQ_STEPS.length, (ev as CustomEvent<number>).detail);
        if (nextIndex === enhanceStep) return; // at the end, a step that did not happen is not announced
        enhanceStep = nextIndex;
        ctx.setLq(LQ_STEPS[enhanceStep] as number);
        updateSteps(stepper, enhanceSpec());
        ctx.srSay(t('sr.visual.lq', { v: t(lqLabel(LQ_STEPS[enhanceStep] as number)) }));
      });
    }
    const oc = ctx.$<HTMLButtonElement>('#opt-ownercolors');
    if (oc) oc.addEventListener('click', () => { ctx.setOwnerColors(!ctx.getVisualSettings().ownerColors); render(); });
    const cb = ctx.$<HTMLButtonElement>('#opt-cbsafe');
    if (cb) cb.addEventListener('click', () => { ctx.setCbSafe(!ctx.getVisualSettings().cbSafe); render(); });
    for (const k of ROLE_KEYS) {
      const inp = ctx.$<HTMLInputElement>('#opt-role-' + k);
      if (inp) inp.addEventListener('change', () => ctx.setRoleColor(k, inp.value));
    }
    const rr = ctx.$<HTMLButtonElement>('#opt-role-reset');
    if (rr) rr.addEventListener('click', () => { ctx.resetRoleColors(); render(); });
  }

  /** What the controls SHOW — the state, written on every render. */
  function reflectControls(s: VisualSettings): void {
    for (const [sel, on] of [['#opt-ownercolors', s.ownerColors], ['#opt-cbsafe', s.cbSafe]] as const) {
      const b = ctx.$<HTMLButtonElement>(sel);
      if (!b) continue;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = onOffLabel(t, on);
    }
    for (const k of ROLE_KEYS) {
      const inp = ctx.$<HTMLInputElement>('#opt-role-' + k);
      if (inp) inp.value = rgbToHex(s.roleColors[k]);
    }
    const stepper = ctx.$<HTMLElement>('#opt-lq');
    if (stepper) updateSteps(stepper, enhanceSpec());
  }

  function reflectOutlines(): void {
    const s = ctx.getVisualSettings();
    const f = ctx.$<HTMLSelectElement>('#opt-outline-fg');
    if (f) f.value = String(s.outlineFg);
    const b = ctx.$<HTMLSelectElement>('#opt-outline-bg');
    if (b) b.value = String(s.outlineBg);
  }

  // Outline selects live in static HTML outside #visual-list (untouched by innerHTML rebuilds) -> wire once.
  const outFg = ctx.$<HTMLSelectElement>('#opt-outline-fg');
  if (outFg) outFg.addEventListener('change', () => ctx.setOutlineFg(+outFg.value));
  const outBg = ctx.$<HTMLSelectElement>('#opt-outline-bg');
  if (outBg) outBg.addEventListener('change', () => ctx.setOutlineBg(+outBg.value));
  reflectOutlines();

  function render(): void {
    const el = ctx.$<HTMLElement>('#visual-list');
    if (!el) return;

    const rawSelected = ctx.getSelectedPlayer();
    const selected = clampSelectedPlayer(rawSelected, ctx.getNumPlayers());
    if (selected !== rawSelected) ctx.setSelectedPlayer(selected);

    const contrastValue = resolveVisualMode(playerViz(ctx.getPlayers(), selected));
    const settings = ctx.getVisualSettings();
    // ⚠️ `renderVisualAxes` AND NOT `renderVizGroup` (#104): this panel has TWO controls, and `renderVizGroup` keeps
    // serving the EMPATHY panel, whose simulation list really is exclusive. Changing that function's body instead of
    // adding this one would put the two axes into the simulation list — the separation prevents it.
    ctx.renderVisualAxes('#visual-modes', '#visual-players');
    void contrastValue; // not read: `refreshMarks` compares through the new model, not this mirror
    mountVisualInside(t, kitCtx(el), el, ctx.offer);
    wireOnce(el);
    reflectControls(settings);
    reflectOutlines();
    refreshMarks();
    // The prose goes back to the footer after the rows are relabelled (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#visual .overlay__card'));
  }

  /**
   * The left-the-default mark (ADR-0029). Each row against ITS default, and the menu's button on top.
   *
   * A SIMULATION switched on (empathy) does not mark THIS menu: its mark belongs to the empathy menu, and that is where it
   * has to lead the child.
   */
  function refreshMarks(): void {
    const s = ctx.getVisualSettings();
    /**
     * 🔴 THE MARK IS PER AXIS. `#visual-modes` holds TWO axes, and a mark on the container would stop saying WHICH one
     * left the default — the third channel of ADR-0029 losing information: a blind child walks the menu and HEARS, in
     * order, what left the default. Hearing "changed" without knowing what sends them searching through every row.
     *
     * ⚠️ AND IT COMES FROM THE NEW MODEL, not from the deprecated `p.viz`.
     *
     * 📌 AND THE SIMULATION RULE IS STRUCTURAL: the simulation lives in another field of `VisualState`, so asking for the
     * theme and the correction never reaches it.
     */
    const visual = playerVisual(ctx.getPlayers(), ctx.getSelectedPlayer());
    const themeChanged = visual.theme !== PADRAO_VISUAL.tema;
    const correctionChanged = visual.correction !== PADRAO_VISUAL.correcao;
    const rowOfCheckedAxis = (axis: string): HTMLElement | null =>
      ctx.$<HTMLElement>(`#visual-modes button[data-eixo="${axis}"][aria-checked="true"]`)
        ?.closest<HTMLElement>('.ctrl-row') ?? null;
    const lqOff = s.lq !== DEFAULTS.lq;
    const owner = s.ownerColors !== DEFAULTS.ownerColors;
    const cb = s.cbSafe !== DEFAULTS.cbSafe;
    const fg = s.outlineFg !== DEFAULTS.hcOutlineFg;
    const bg = s.outlineBg !== DEFAULTS.hcOutlineBg;
    const rolesChanged = ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]));
    const rowOf = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(t, rowOfCheckedAxis('tema'), themeChanged);
    markChanged(t, rowOfCheckedAxis('correcao'), correctionChanged);
    markChanged(t, rowOf('#opt-lq'), lqOff);
    markChanged(t, rowOf('#opt-ownercolors'), owner);
    markChanged(t, rowOf('#opt-cbsafe'), cb);
    markChanged(t, rowOf('#opt-outline-fg'), fg);
    markChanged(t, rowOf('#opt-outline-bg'), bg);
    markChanged(t, rowOf('#opt-role-reset'), rolesChanged);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="visual"]'), [themeChanged, correctionChanged, lqOff, owner, cb, fg, bg, rolesChanged]);
  }

  // ---- reset THIS menu's defaults (ADR-0028) ----
  //
  // `p.viz` is ONE field shared with the empathy menu, so the reset may only clear it when what is there is a mode of
  // THIS menu. If the child has a low-vision or blindness simulation on, this button has nothing to say about it.
  //
  // The colour-blindness corrections ARE among what it clears: they live here (#60), and undoing them is legitimate
  // because the child finds them again in the SAME selector they just used — a reset may only undo what it can also
  // redo. That is why the announcement names the visual mode among what came back.
  //
  // The CAPTIONS switch (#opt-captions) stays out: this panel is not given its writer, and a reset that could not
  // reach it would announce a default it did not restore.
  const resetBtn = ctx.$<HTMLButtonElement>('#visual-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.getPlayers().forEach((_p, i) => {
      const viz = playerViz(ctx.getPlayers(), i);
      if (VISUAL_MODES.includes(viz) && viz !== 'normal') ctx.setPlayerViz(i, 'normal');
    });
    const s = ctx.getVisualSettings();
    if (s.lq !== DEFAULTS.lq) ctx.setLq(DEFAULTS.lq);
    if (s.ownerColors !== DEFAULTS.ownerColors) ctx.setOwnerColors(DEFAULTS.ownerColors);
    if (s.cbSafe !== DEFAULTS.cbSafe) ctx.setCbSafe(DEFAULTS.cbSafe);
    if (s.outlineFg !== DEFAULTS.hcOutlineFg) ctx.setOutlineFg(DEFAULTS.hcOutlineFg);
    if (s.outlineBg !== DEFAULTS.hcOutlineBg) ctx.setOutlineBg(DEFAULTS.hcOutlineBg);
    if (ROLE_KEYS.some((k) => !sameRgb(s.roleColors[k], HC_ROLE_DEF[k]))) ctx.resetRoleColors();
    render();
    ctx.srSay(t('sr.visual.reset'));
  });

  return { render };
}
