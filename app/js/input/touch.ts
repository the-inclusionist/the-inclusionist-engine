// SPDX-License-Identifier: AGPL-3.0-or-later
// input/touch.ts — on-screen touch controls (Estágio 4): the physical geometry of the touch pad (mm→px) and
// its config UI (#touchcfg, #touch-controls visibility). Extracted from the monolith's E13 block. Geometry/layout/
// touch-map-merge are pure (padPxPerMm/padHandTag/computePadPhysicalPx/padLayoutFromId/normalizeTouchMap —
// project node); DOM wiring + persisted state (touchMap/padDesign/padBtnMm/padGapMm/padStickMm/padTravelMm/
// padDpadMm/padDir) live behind initTouch(ctx). PAD_DESIGNS/TOUCH_ACT_LABELS/TOUCH_DEFAULT come from
// ./devices.js (not reimplemented). Reading the real Gamepad API (polling, mapping wizard) is input/gamepad's
// territory, not this module's.
import { PAD_DESIGNS, TOUCH_DEFAULT } from './devices.js';
import { migrateTouchMap } from './vocabulary-migration.js';
import type { Translate } from '../core/i18n.js';
import { KEYS } from '../platform/storage-keys.js'; // the names only — reading and writing go through ctx.store (ADR-0232)
import type { DomQuery } from '../core/dom-query.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` lives in `core/dom-query`: this line was copied into SIXTEEN modules, and the copies drifted.
// Re-exported for whoever already imported it from here.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs. */
export interface TouchStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
  getNum(key: string, fallback?: number): number;
  getJSON<T = unknown>(key: string, fallback?: T | null): T | null;
  setJSON(key: string, obj: unknown): void;
}

/* There is no `TouchPlayer`: the touch layer does not know what a player carries — whether the pad may show is one
 * boolean the game answers (`padAllowed` on the ctx). */

export interface TouchCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /**
   * THE POSITIONS THIS GAME USES, each with its own word, in the current language.
   *
   * ⚠️ The slot menu offers these and not a fixed list: with a fixed list the engine would be deciding that every
   * game has jump, run, swap and special, and a child in a quiz could assign a button a power swap that then does
   * nothing.
   *
   * The order comes from here too: it is `core/actions`' canonical order, the same the remapping screen uses, so the
   * child does not have to relearn the list when switching panels.
   */
  gameActions: () => readonly { readonly action: string; readonly label: string }[];
  /** Persistence (platform/storage.ts), injected. */
  store: TouchStore;
  /** Element the --pad-* CSS custom properties are written to: document.documentElement in production
   *  (mirrors ui/settings-typo.ts's `root` injection for the same reason — no direct `document` access). */
  root: HTMLElement;
  /** Shared device-class check (the host's, used by several subsystems) — injected, not duplicated. */
  isMobile: () => boolean;
  /** Screen dimensions, injected (never reads `window.innerWidth/innerHeight` directly). */
  viewport: () => { w: number; h: number };
  /** Shared overlay z-index/focus helper, used by every panel — injected. */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Optional hook fired after applyPadDesign() changes padDesign — whatever draws the button glyphs elsewhere (a
   *  pause legend, say) is NOT part of this module's boundary but must still refresh. */
  onPadDesignApplied?: () => void;
  /**
   * The on-screen control CAME ON. It exists so the root can turn on by itself what only makes sense on touch — the
   * run button's latch, say: on a virtual button nobody "holds" comfortably, because the finger that holds is the
   * same one that has to reach the others.
   *
   * A hook and not a rule in here: this module draws controls and knows no accessibility setting at all. Whoever owns
   * the players knows what to turn on.
   */
  onTouchControlsShown?: () => void;
  /**
   * The on-screen controls LEFT the screen — the pair of `onTouchControlsShown`. A root that moves something out of the
   * pad's way (the platformer's minimap corner) moves it back here; `input/` does not reach `render/` for it (issue #167).
   */
  onTouchControlsHidden?: () => void;
  /**
   * MAY the virtual pad show NOW? Injected, and it is the GAME's policy, not the engine's.
   *
   * Reading the player count, the phase and whether a player has a quiz open here would write one game's policy
   * into the engine — and make the touch layer know that a literacy activity exists. So it is the same move as
   * `isNavigable`: inject the BOOLEAN, not the state. The platformer answers "one player, playing, no challenge
   * open"; a game of another genre answers whatever is true in it.
   */
  padAllowed: () => boolean;
  /**
   * The window, only to listen for `resize` — the root's (ADR-0232 D4). REQUIRED, and `null` is an answer: a host with no
   * window at all does not listen, and the geometry stays as at boot. A fallback to the global would reach a window the
   * root never handed in, which is what took down every boot in a fake document once this was wired to `createGame`.
   */
  win: Pick<Window, 'addEventListener'> | null;
}

// ===================== PURE (no DOM/store — node project) =====================

// Physical target anchored on a full-screen iPhone 16 (the long edge of the 1179×2556 @460ppi display is 141.1 mm →
// ~6.04 CSS px/mm) — see `padPxPerMm` for what this estimate is and is not (WCAG 2.5.5 / GAG).
export const IPHONE16_LONG_MM = 141.1;
export const IPHONE16_LONG_PX = 852;
export const IPHONE16_PXMM = IPHONE16_LONG_PX / IPHONE16_LONG_MM; // ~6.04 CSS px/mm

/**
 * CSS px per ASSUMED millimetre — an estimate anchored on one phone, NOT a measurement of the device (plan phase 5b).
 * On a mobile, the window's long edge is taken to be an iPhone 16's display (141.1 mm), whatever the device: a 10-inch
 * tablet window of 1280×800 is read as 141.1 mm long, about 9.07 px/mm, where its glass is about 216 mm. On a desktop it is
 * the iPhone 16 ratio, fixed (it does not grow with the monitor). The browser exposes no physical size, so a «real
 * millimetre» is not reachable from here; targets that must meet a floor use the engine's `--alvo-min` (ADR-0163).
 * Pure: `mobile`/`viewW`/`viewH` arrive resolved (isMobile()/innerWidth/innerHeight stay on the impure side).
 */
export function padPxPerMm(mobile: boolean, viewW: number, viewH: number): number {
  return mobile ? Math.max(viewW, viewH) / IPHONE16_LONG_MM : IPHONE16_PXMM;
}

export type HandTag = 'crianca' | 'adulto' | 'inter';
/** Sorts a value in mm into the child's-hand / in-between / adult's-hand band (used by the touch settings panel's
 *  tags). */
export function padHandTag(v: number, lo: number, hi: number): HandTag {
  return v <= lo ? 'crianca' : v >= hi ? 'adulto' : 'inter';
}

export interface PadMm { btn: number; gap: number; stick: number; travel: number; dpad: number; }
export interface PadPhysicalPx {
  btnPx: number; diamPx: number; knobPx: number; basePx: number;
  armPx: number; armWPx: number; spanPx: number; stickTravelPx: number; stickDeadPx: number;
}
/** All the geometry in px from the configured mm + the px/mm factor — kept pure so it is testable (high/low dpr, small
 *  screen, extreme values). applyPadPhysical() only calls this and writes the result into CSS custom properties + the
 *  panel's labels. */
export function computePadPhysicalPx(mm: PadMm, pxPerMm: number): PadPhysicalPx {
  const btnPx = mm.btn * pxPerMm, gapPx = mm.gap * pxPerMm;
  const diamPx = btnPx + Math.SQRT2 * (btnPx + gapPx); // diamond: edge clearance = gap
  const knobPx = mm.stick * pxPerMm, travelPx = mm.travel * pxPerMm;
  const basePx = knobPx + 2 * travelPx + 16; // stick base = contact + travel
  const armPx = mm.dpad * pxPerMm, armWPx = armPx * 0.8, spanPx = 2 * armPx + armWPx; // cross: arm + width (0.8×)
  const stickTravelPx = travelPx, stickDeadPx = Math.max(6, travelPx * 0.4); // dead zone ~40% of the travel
  return { btnPx, diamPx, knobPx, basePx, armPx, armWPx, spanPx, stickTravelPx, stickDeadPx };
}

export type PadLayout = 'sony' | 'nintendo' | 'microsoft' | 'generic';
/** The button-labelling layout from the controller's reported id (a substring/VID heuristic). */
export function padLayoutFromId(id: string | null | undefined): PadLayout {
  const s = (id || '').toLowerCase();
  if (/dualshock|dualsense|playstation|054c/.test(s)) return 'sony';
  if (/switch|nintendo|joy-con|057e/.test(s)) return 'nintendo';
  if (/xbox|xinput|microsoft|045e/.test(s)) return 'microsoft';
  return 'generic';
}

/** The 13 remappable touch slots (d-pad×4, START, buttons 0–3, the four shoulders) — `lbl` is the label's i18n key. */
// `lbl` keeps the i18n KEY, not the text: a module table resolved on import would freeze the language at boot (see the
// note in input/devices). The arrow and the button's name travel INSIDE the translation, because in English the
// direction word changes and the arrow stays where it is — it is the whole frame, not interpolated content.
export const TOUCH_SLOTS: ReadonlyArray<{ k: string; lbl: string }> = [
  { k: 'up', lbl: 'touch.slot.up' }, { k: 'down', lbl: 'touch.slot.down' },
  { k: 'left', lbl: 'touch.slot.left' }, { k: 'right', lbl: 'touch.slot.right' },
  { k: 'start', lbl: 'touch.slot.start' },
  { k: 'b0', lbl: 'touch.slot.b0' }, { k: 'b1', lbl: 'touch.slot.b1' },
  { k: 'b2', lbl: 'touch.slot.b2' }, { k: 'b3', lbl: 'touch.slot.b3' },
  { k: 'bl2', lbl: 'touch.slot.bl2' }, { k: 'bl1', lbl: 'touch.slot.bl1' },
  { k: 'br2', lbl: 'touch.slot.br2' }, { k: 'br1', lbl: 'touch.slot.br1' },
];
/**
 * The actions the touch TRANSPORT can carry.
 *
 * ⚠️ IT IS NOT THE `<select>`'S LIST: the options come from `ctx.gameActions()`, because the game decides which actions
 * exist. This list is what THIS transport reaches — and it is against it that `input/touch-bindings`' gate checks the
 * dispatch recognises everything that can be offered. The two were the same by accident while there was one game.
 */
export const TOUCH_ACTS: readonly string[] = ['left', 'right', 'up', 'down', 'action2', 'action1', 'action3', 'action4', 'start',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger'];

/** Merges the persisted map (loose JSON from localStorage) over TOUCH_DEFAULT. It does NOT validate keys/values
 *  against TOUCH_SLOTS/TOUCH_ACTS — malformed JSON with strange keys/values passes as it is (it only fails if it is not
 *  an object). */
export function normalizeTouchMap(stored: unknown): Record<string, string> {
  // ⚠️ WHAT IS STORED GOES THROUGH THE TRANSLATOR BEFORE THE MERGE, and the order is what matters: `Object.assign`
  // lets the stored map WIN over the default, so a `b0: 'jump'` from before ADR-0086 would overwrite the correct
  // `b0: 'action2'` and the on-screen button would stop doing anything — with no error at all. Here the action name
  // is in the VALUE, not the key, which is why it needs its own translator. See `input/vocabulary-migration.ts`.
  const migrated = migrateTouchMap(stored && typeof stored === 'object' ? (stored as Record<string, string>) : null);
  return Object.assign({}, TOUCH_DEFAULT, migrated || {});
}

// ===================== IMPURE (DOM + store — through initTouch(ctx)) =====================

export interface PadMmPatch { btn?: number; gap?: number; stick?: number; travel?: number; dpad?: number; }

/** The five size sliders a page's touch panel may carry, each writing its own measure (mm). */
const PAD_SLIDERS: readonly (readonly [string, keyof PadMmPatch])[] = [
  ['#pad-size', 'btn'], ['#pad-gap', 'gap'], ['#pad-stick', 'stick'], ['#pad-travel', 'travel'], ['#pad-dpad', 'dpad'],
];

/** The two presets: every size at once, and the sentence that says so — a child who cannot see five sliders move hears it. */
const PAD_PRESETS: readonly (readonly [string, Required<PadMmPatch>, string])[] = [
  ['#pad-preset-child', { btn: 12, gap: 2.5, stick: 16.5, travel: 4, dpad: 11.5 }, 'sr.touch.presetChild'],
  ['#pad-preset-adult', { btn: 14, gap: 4.5, stick: 20, travel: 5.5, dpad: 14 }, 'sr.touch.presetAdult'],
];

export interface TouchApi {
  /** (Re)draws #touchmap-list from the current touchMap and wires each slot's <select>. */
  renderTouchMap(): void;
  /** Opens the on-screen buttons dialog (#touchcfg). */
  openTouchCfg(): void;
  /** Closes the #touchcfg dialog and gives focus back to the button that opened it. */
  closeTouchCfg(): void;
  /** Hides the touch controls (the keyboard or a physical pad took over, or a menu opened on top). The `reason`
   *  parameter is only a debugging label at call sites; the function ignores it and keeps it so existing calls do not
   *  break. */
  hideTouchControls(reason?: string): void;
  /** Shows the touch controls (a touch/click was detected). A no-op whenever the game's `padAllowed()` says no — on
   *  those screens the child touches the on-screen buttons directly. */
  showTouchControls(): void;
  /** Switches between the virtual stick and the cross (D-pad), following `padDir`. */
  applyDirStyle(): void;
  /** Recomputes all the geometry (mm→px) and writes the custom properties + the panel's labels. */
  applyPadPhysical(): void;
  /** Updates one or more sizes (mm), persists them and reapplies the geometry. */
  setPadMm(patch: PadMmPatch): void;
  /** Applies (and optionally switches) the button design; persists it; repaints the touch diamond's buttons
   *  (#pad-diamond); fires ctx.onPadDesignApplied(). Returns the resulting design. */
  applyPadDesign(d?: string): string;
  /** The button design currently active ('generic'|'microsoft'|'sony'|'nintendo'). */
  getPadDesign(): string;
  /** A live reference to the current touch map (slot → action) — mutated by renderTouchMap(); NOT a copy. */
  getTouchMap(): Record<string, string>;
  /** The virtual stick's useful travel in px, recomputed on every applyPadPhysical(). */
  getStickTravelPx(): number;
  /** The virtual stick's dead zone in px, recomputed on every applyPadPhysical(). */
  getStickDeadPx(): number;
}

export function initTouch(ctx: TouchCtx): TouchApi {
  const { t } = ctx;
  let padDesign = ctx.store.get(KEYS.padDesign, 'generic') || 'generic';
  let padBtnMm = ctx.store.getNum(KEYS.padBtnMm, 12.5);
  let padGapMm = ctx.store.getNum(KEYS.padGapMm, 3);
  let padStickMm = ctx.store.getNum(KEYS.padStickMm, 18);
  let padTravelMm = ctx.store.getNum(KEYS.padTravelMm, 4.5);
  let padDpadMm = ctx.store.getNum(KEYS.padDpadMm, 12);
  let padDir = ctx.store.get(KEYS.padDir, 'stick') || 'stick';
  let _stickTravelPx = 42, _stickDeadPx = 12; // boot values; applyPadPhysical() sets the real ones
  const touchMap: Record<string, string> = normalizeTouchMap(ctx.store.getJSON(KEYS.touchmap, null));

  function renderTouchMap(): void {
    const el = ctx.$<HTMLElement>('#touchmap-list');
    if (!el) return;
    el.innerHTML = TOUCH_SLOTS.map((s) =>
      `<div class="ctrl-row"><label for="tm-${s.k}">${t(s.lbl)}</label><select id="tm-${s.k}" class="vol" data-slot="${s.k}">` +
      // ⚠️ THE OPTION IS BORN EMPTY and the `label` goes in just below through `textContent` (issue #106). It is the
      // game's WORD — `gameActions()` comes from the preset —, and a game lives in another repository (ADR-0083), so
      // this text is not reviewed by this tree. `value="${slotAction}"` stays: `slotAction` is the ABSTRACT name, and
      // the engine enumerates it in `core/actions`; it is the engine's and not the game's.
      ctx.gameActions().map(({ action: slotAction }) => `<option value="${slotAction}"${touchMap[s.k] === slotAction ? ' selected' : ''}></option>`).join('') +
      `</select></div>`
    ).join('');
    // The game's words, through `textContent` — which escapes by construction. The order matches because it is the same list.
    for (const sel of el.querySelectorAll<HTMLSelectElement>('select[data-slot]')) {
      const words = ctx.gameActions();
      for (let i = 0; i < sel.options.length && i < words.length; i++) {
        sel.options[i]!.textContent = words[i]!.label;
      }
    }
    el.querySelectorAll<HTMLSelectElement>('select[data-slot]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const slot = sel.dataset.slot || '';
        touchMap[slot] = sel.value;
        ctx.store.setJSON(KEYS.touchmap, touchMap);
        const label = sel.previousElementSibling ? sel.previousElementSibling.textContent : null;
        // ⚠️ The spoken word is the SAME as the one read: it comes from the list that just built the `<option>`, so
        // nothing has to make two tables agree.
        const chosen = ctx.gameActions().find((x) => x.action === sel.value);
        const slotName = label || t('touch.slot.fallback');
        // ⚠️ WITHOUT THE GAME'S WORD, THE ANNOUNCEMENT DROPS THE POSITION — IT DOES NOT FALL BACK TO THE ID. `sel.value`
        // is the ABSTRACT name (`action3`), and ADR-0074 says it never reaches a person; `7742ac0` already paid for
        // this defect on the remapping screen and the way out is the same: a key of its own that says what matters.
        // 📌 The fallback is reachable because `gameActions()` is a FUNCTION of the cartridge, reread on every
        // `change`: in an activity hub the list changes underneath and the `<option>` drawn before is orphaned.
        ctx.srSay(chosen
          ? t('sr.touch.slotSet', { slot: slotName, acao: chosen.label })
          : t('sr.touch.slotSetUnnamed', { slot: slotName }));
      });
    });
  }

  function openTouchCfg(): void {
    const ov = ctx.$<HTMLElement>('#touchcfg');
    if (!ov) return;
    renderTouchMap();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('select,button');
    if (f) f.focus();
  }
  function closeTouchCfg(): void {
    const ov = ctx.$<HTMLElement>('#touchcfg');
    if (!ov) return;
    ov.hidden = true;
    const b = ctx.$<HTMLElement>('#opt-touchcfg');
    if (b) b.focus();
  }

  function hideTouchControls(_reason?: string): void {
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc && !tc.hidden) tc.hidden = true;
    ctx.$<HTMLElement>('body')?.classList.remove('touch-mode');
    ctx.onTouchControlsHidden?.();
  }
  function showTouchControls(): void {
    // A MENU up = no virtual pad: the child touches the on-screen buttons directly. The GAME decides.
    if (!ctx.padAllowed()) return;
    const tc = ctx.$<HTMLElement>('#touch-controls');
    if (tc) tc.hidden = false;
    ctx.$<HTMLElement>('body')?.classList.add('touch-mode');
    ctx.onTouchControlsShown?.();
  }

  function applyDirStyle(): void {
    const st = ctx.$<HTMLElement>('#touch-stick'), cr = ctx.$<HTMLElement>('#touch-cross');
    if (st) st.hidden = padDir === 'cross';
    if (cr) cr.hidden = padDir !== 'cross';
    const sel = ctx.$<HTMLSelectElement>('#pad-dir');
    if (sel && sel.value !== padDir) sel.value = padDir;
  }

  function applyPadPhysical(): void {
    const vp = ctx.viewport();
    const r = padPxPerMm(ctx.isMobile(), vp.w, vp.h);
    const px = computePadPhysicalPx({ btn: padBtnMm, gap: padGapMm, stick: padStickMm, travel: padTravelMm, dpad: padDpadMm }, r);
    _stickTravelPx = px.stickTravelPx; _stickDeadPx = px.stickDeadPx;
    const S = ctx.root.style;
    S.setProperty('--pad-btn', px.btnPx.toFixed(1) + 'px');
    S.setProperty('--pad-diam', px.diamPx.toFixed(1) + 'px');
    S.setProperty('--stick-knob', px.knobPx.toFixed(1) + 'px');
    S.setProperty('--stick-base', px.basePx.toFixed(1) + 'px');
    S.setProperty('--dpad-arm-l', px.armPx.toFixed(1) + 'px');
    S.setProperty('--dpad-arm-w', px.armWPx.toFixed(1) + 'px');
    S.setProperty('--dpad-span', px.spanPx.toFixed(1) + 'px');
    const fmt = (n: number): string => n.toFixed(1).replace('.', ',');
    const lbl: Record<HandTag, string> = { crianca: 'mão de criança', adulto: 'mão de adulto', inter: 'intermediário' };
    const upd = (valId: string, tagId: string, mm: number, lo: number, hi: number, slId: string): void => {
      const v = ctx.$<HTMLElement>(valId); if (v) v.textContent = fmt(mm) + ' mm';
      const t = ctx.$<HTMLElement>(tagId);
      if (t) { const w = padHandTag(mm, lo, hi); t.dataset.who = w; t.textContent = lbl[w]; }
      const s = ctx.$<HTMLInputElement>(slId); if (s && parseFloat(s.value) !== mm) s.value = String(mm);
    };
    upd('#pad-size-val', '#pad-size-tag', padBtnMm, 12.5, 13, '#pad-size');
    upd('#pad-gap-val', '#pad-gap-tag', padGapMm, 3, 4.5, '#pad-gap');
    upd('#pad-stick-val', '#pad-stick-tag', padStickMm, 17, 19, '#pad-stick');
    upd('#pad-travel-val', '#pad-travel-tag', padTravelMm, 4, 5.5, '#pad-travel');
    upd('#pad-dpad-val', '#pad-dpad-tag', padDpadMm, 12, 14, '#pad-dpad');
  }

  function setPadMm(o: PadMmPatch): void {
    if (o.btn != null) padBtnMm = o.btn;
    if (o.gap != null) padGapMm = o.gap;
    if (o.stick != null) padStickMm = o.stick;
    if (o.travel != null) padTravelMm = o.travel;
    if (o.dpad != null) padDpadMm = o.dpad;
    ctx.store.set(KEYS.padBtnMm, padBtnMm);
    ctx.store.set(KEYS.padGapMm, padGapMm);
    ctx.store.set(KEYS.padStickMm, padStickMm);
    ctx.store.set(KEYS.padTravelMm, padTravelMm);
    ctx.store.set(KEYS.padDpadMm, padDpadMm);
    applyPadPhysical();
  }

  function applyPadDesign(d?: string): string {
    if (d && PAD_DESIGNS[d]) padDesign = d;
    ctx.store.set(KEYS.padDesign, padDesign);
    const set = PAD_DESIGNS[padDesign] || PAD_DESIGNS.generic;
    const diamond = ctx.$<HTMLElement>('#pad-diamond');
    if (diamond) {
      diamond.querySelectorAll<HTMLElement>('.pad-b').forEach((b) => {
        const s = set[b.dataset.btn || ''];
        if (s) { b.textContent = s[0]; b.style.background = s[1]; }
      });
    }
    ctx.onPadDesignApplied?.();
    return padDesign;
  }

  /**
   * The touch panel's controls, where a PAGE carries them (the engine's own panels do not): open and close, the direction, the
   * five sizes and the two presets. The selector is not set here — the boot's `applyDirStyle` sets it to the stored direction.
   */
  function wirePanel(): void {
    ctx.$<HTMLElement>('#opt-touchcfg')?.addEventListener('click', openTouchCfg);
    ctx.$<HTMLElement>('#touchcfg-close')?.addEventListener('click', closeTouchCfg);
    const padDirSel = ctx.$<HTMLSelectElement>('#pad-dir');
    if (padDirSel) {
      padDirSel.addEventListener('change', () => {
        padDir = padDirSel.value;
        ctx.store.set(KEYS.padDir, padDir);
        applyDirStyle();
        ctx.srSay(t('sr.touch.dirSet', { tipo: t(padDir === 'cross' ? 'touch.dir.cross' : 'touch.dir.stick') }));
      });
    }
    for (const [id, field] of PAD_SLIDERS) {
      const slider = ctx.$<HTMLInputElement>(id);
      if (!slider) continue;
      slider.addEventListener('input', () => { const patch: PadMmPatch = {}; patch[field] = parseFloat(slider.value); setPadMm(patch); });
    }
    for (const [id, mm, said] of PAD_PRESETS) {
      ctx.$<HTMLElement>(id)?.addEventListener('click', () => { setPadMm(mm); ctx.srSay(t(said)); });
    }
  }
  wirePanel();
  // Recomputes the px on rotate/resize; the mm are fixed.
  // ⚠️ THE WINDOW COMES THROUGH THE `ctx` (see `TouchCtx.win`). Without a window there is nothing to listen to.
  ctx.win?.addEventListener('resize', applyPadPhysical);

  // initial state: the stored design, geometry and direction applied once at boot
  applyPadDesign();
  applyPadPhysical();
  applyDirStyle();

  return {
    renderTouchMap, openTouchCfg, closeTouchCfg, hideTouchControls, showTouchControls,
    applyDirStyle, applyPadPhysical, setPadMm, applyPadDesign,
    getPadDesign: () => padDesign,
    getTouchMap: () => touchMap,
    getStickTravelPx: () => _stickTravelPx,
    getStickDeadPx: () => _stickDeadPx,
  };
}

// =============================================================================================
// THE VIRTUAL PAD, DRAWN FROM WHAT THE GAME DECLARES (ADR-0143)
// =============================================================================================
//
// 🔴 WHAT THIS FIXES. The rest of this file reaches the pad's ids and creates none, and `input/touch-bindings` gives up
// on a missing `#touch-controls` without a line in `problems`. A game without that markup had no pad, no error and no
// way of knowing why. In a school where the device is a tablet with no keyboard, that is not a missing comfort: it is
// the only input.
//
// ⚠️ AND IT LIVES HERE, NOT IN A MODULE BESIDE IT, because a gate of this house refused the alternative: the package's
// `exports` is a WILDCARD (`./input/*.js`), so a new file in `input/` is born public API by accident — a function in
// this one is not.
//
// ========================= WHY IT IS NOT A FIXED MOULD =========================
// The obvious reading of the Dev's request had already been refused, in writing, by the engine's own second consumer
// (`consumer-quiz/main-quiz.ts`): reproducing a dozen ids for a set of controls the quiz does not want would be the same
// kind of lie as the sonar. Mounting the platformer's pad in every game would hand NINE DEAD BUTTONS to whoever
// declares two actions — ADR-0106 §5 broken by the very work that cites it.
//
// 🎯 So the shape comes from the `preset`: a slot is drawn when the action it fires is one THIS game declares. 📌 And
// it fires through the MAP, not the slot's name — `touch-bindings` recomposes the slot as `'b' + dataset.btn` and reads
// `ctx.getTouchMap()[slot]`: the function comes from the (remappable) touchMap, not from a data attribute. Reading the name would draw the factory pad
// for whoever remapped it.

/** The three `document` things the pad's markup needs. Same shape as `ui/panel-shell`. */
export interface TouchMarkupCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  find: (sel: string) => HTMLElement | null;
  create: (tag: string) => HTMLElement;
}

export interface TouchMarkupSpec {
  /** The LIVE slot→action map (`TOUCH_DEFAULT` merged with what the child remapped). */
  readonly map: Readonly<Record<string, string>>;
  /** The actions THIS game declares (`presetActions(preset)`). Empty = nothing to draw. */
  readonly gameActions: ReadonlySet<string>;
  /** Each slot's label, already translated — the GAME's word for the action it fires. */
  readonly slotLabel: (slot: string) => string;
  /** The d-pad's drawing: `cruz` (cross) or `analogico` (stick). It comes from the pad's persisted setting (`padDir`). */
  readonly dpad?: 'cruz' | 'analogico';
}

/**
 * A BUTTON'S NAME, from the position it fires (ADR-0165): the same in every game — 1 to 4, L1/L2/R1/R2, SELECT, START,
 * and the four directions by their spoken name. The cartridge's word is the FUNCTION, and it never reaches the face.
 */
const SLOT_NAME: Readonly<Record<string, string>> = {
  action1: '1', action2: '2', action3: '3', action4: '4',
  leftShoulder: 'L1', leftTrigger: 'L2', rightShoulder: 'R1', rightTrigger: 'R2',
  select: 'SELECT', start: 'START',
};
function buttonName(t: Translate, slotAction: string): string | null {
  if (SLOT_NAME[slotAction]) return SLOT_NAME[slotAction]!;
  return slotAction === 'up' || slotAction === 'down' || slotAction === 'left' || slotAction === 'right' ? t(`touch.nome.${slotAction}`) : null;
}

/** The four direction slots, in the order the cross draws them. */
const DIRECTIONS = ['up', 'left', 'right', 'down'] as const;
/** The four action-button slots, in the diamond's order. */
const BUTTONS = ['b0', 'b1', 'b2', 'b3'] as const;
/** The SHOULDERS per corner, top to bottom (ADR-0160): the trigger (2) over the shoulder (1). */
const SHOULDERS = [['esq', ['bl2', 'bl1']], ['dir', ['br2', 'br1']]] as const;

/**
 * Builds (or reuses) `#touch-controls` and returns it.
 *
 * ⚠️ IT IS BORN HIDDEN, and that is not a detail: switching by modality belongs to `touch-bindings` — a touch or click
 * SHOWS it, the keyboard or a pad HIDES it. A pad born on screen covers the game of whoever will never touch it.
 *
 * 🔴 ONLY WHAT THE GAME NAMES, since ADR-0162 — which undid ADR-0157's minimum (directions and four buttons in every
 * game, with the physical legend on the unnamed ones): «Vale para todos os botões: somente aparecem se o jogo os
 * nomeia.» SELECT and START always stay, because they are the pause's doors. ⚠️ A game that names no direction does not
 * move through menus by touch; that is why `consumer-quiz` declares the positions it uses. The four buttons sit in a 2×2
 * block by the action's NUMBER (ADR-0160): 1 and 4 on top, 2 and 3 below.
 *
 * Idempotent: mounting twice returns the same node, its content rebuilt for the map of now.
 */
export function mountTouchControls(ctx: TouchMarkupCtx, spec: TouchMarkupSpec): HTMLElement {
  const { t } = ctx;
  const touchControls = ctx.find('#touch-controls') ?? ctx.create('div');
  touchControls.id = 'touch-controls';
  touchControls.className = 'touch';
  touchControls.hidden = true;
  while (touchControls.firstChild) touchControls.removeChild(touchControls.firstChild);

  const f = padFacesOf(t, spec);
  // in the order they sit on the screen; a part the game names nothing for is an empty list, never an empty box
  const parts = [...directionPad(ctx, spec, f), ...actionButtons(ctx, spec, f), ...shoulderCorners(ctx, f), systemPills(ctx, f)];
  for (const part of parts) touchControls.appendChild(part);
  return touchControls;
}

/** How the pad shows a slot: whether it is drawn at all, its face, and its accessible name. */
interface PadFaces {
  readonly named: (slot: string) => boolean;
  readonly nameOf: (slot: string) => string;
  readonly accessible: (slot: string) => string;
}

function padFacesOf(t: Translate, spec: TouchMarkupSpec): PadFaces {
  // 🔴 ONLY WHAT THE GAME NAMES (ADR-0162, superseding ADR-0157's minimum): «Vale para todos os botões: somente
  // aparecem se o jogo os nomeia.» A button on screen is a promise that it does something, and the game is who knows.
  const named = (slot: string): boolean => spec.gameActions.has(spec.map[slot] ?? '');
  // ADR-0165: the face is the NAME of the position the slot fires; the accessible name is «name, function».
  const nameOf = (slot: string): string => buttonName(t, spec.map[slot] ?? slot) ?? spec.slotLabel(slot);
  const accessible = (slot: string): string => {
    const name = nameOf(slot);
    const purpose = spec.slotLabel(slot);
    return purpose && purpose !== name ? `${name}, ${purpose}` : name;
  };
  return { named, nameOf, accessible };
}

/** The directional, where the game names a direction: the analog stick with its knob, or the cross with its arms. */
function directionPad(ctx: TouchMarkupCtx, spec: TouchMarkupSpec, f: PadFaces): HTMLElement[] {
  const live = DIRECTIONS.filter(f.named);
  if (!live.length) return [];
  const kind = spec.dpad === 'analogico' ? 'touch-stick' : 'touch-cross';
  const dir = ctx.create('div');
  dir.id = kind;
  dir.className = kind; // the id is what `touch-bindings` finds; the class is what the stylesheet DRAWS
  if (kind === 'touch-stick') {
    // `touch-bindings` requires the `.touch-knob` inside the base (`if (stick && knob)`), and without it gives up on the
    // whole stick — silently.
    const knob = ctx.create('div');
    knob.className = 'touch-knob';
    dir.appendChild(knob);
    return [dir];
  }
  for (const d of live) {
    const arm = ctx.create('button');
    // ⚠️ THE THREE CLASSES, and each has a reader. `touch-arm` is this module's; `dpad-arm` is the one the stylesheet
    // DRAWS; `dpad-<dir>` is the one `touch-bindings` LIGHTS on touch (`.dpad-up` & co.). With only the first, the arm
    // is an unstyled button that never lights, and no case sees it unless both are mounted together.
    arm.className = `touch-arm dpad-arm dpad-${d}`;
    arm.setAttribute('type', 'button');
    arm.setAttribute('aria-label', f.accessible(d));
    dir.appendChild(arm);
  }
  return [dir];
}

/**
 * One button the dispatch can read back: `data-btn` is the slot without its `b` (`b2` -> `2`, `bl1` -> `l1`), which is
 * what `'b' + dataset.btn` in `touch-bindings` recomposes. Writing the ACTION here would be a second source for the same
 * answer, and the child's remapping would stop counting.
 */
function padButton(ctx: TouchMarkupCtx, f: PadFaces, slot: string, className: string): HTMLElement {
  const button = ctx.create('button');
  button.className = className;
  button.dataset.btn = slot.slice(1);
  button.setAttribute('type', 'button');
  button.setAttribute('aria-label', f.accessible(slot));
  button.textContent = f.nameOf(slot);
  return button;
}

/** The four action buttons, where the game names them, in a 2×2 block by the action's NUMBER (ADR-0160). */
function actionButtons(ctx: TouchMarkupCtx, spec: TouchMarkupSpec, f: PadFaces): HTMLElement[] {
  const live = BUTTONS.filter(f.named);
  if (!live.length) return [];
  const rhombus = ctx.create('div');
  rhombus.className = 'touch-pad';
  for (const b of live) {
    const button = padButton(ctx, f, b, 'touch-btn');
    // THE PLACE FOLLOWS THE ACTION, not the slot (ADR-0160: 1 4 on top, 2 3 below): the stylesheet puts each button in
    // its number's cell, and a remapped slot takes the button to the place of the action it now fires.
    button.dataset.acao = spec.map[b] ?? '';
    rhombus.appendChild(button);
  }
  return [rhombus];
}

/** THE SHOULDERS, each pair in its top corner (ADR-0160), and only those the game names (ADR-0162) — no empty corner. */
function shoulderCorners(ctx: TouchMarkupCtx, f: PadFaces): HTMLElement[] {
  return SHOULDERS.flatMap(([side, slots]) => {
    const named = slots.filter(f.named);
    if (!named.length) return [];
    const corner = ctx.create('div');
    corner.className = `touch-ombros touch-ombros--${side}`;
    for (const s of named) corner.appendChild(padButton(ctx, f, s, 'touch-btn touch-ombro'));
    return [corner];
  });
}

/*
 * THE TWO SYSTEM PILLS, side by side in the centre: SELECT (the menus) and START (the quick pause), in a console pad's
 * order. ⚠️ BOTH UNCONDITIONAL, for the same reason: since ADR-0155 they are the pause's two doors, and the pause cannot
 * be declined (ADR-0122) — a tablet without a keyboard has no other way to reach "Quit".
 */
function systemPills(ctx: TouchMarkupCtx, f: PadFaces): HTMLElement {
  const system = ctx.create('div');
  system.className = 'touch-sistema';
  for (const slot of ['select', 'start'] as const) {
    const b = ctx.create('button');
    b.id = `touch-${slot}`;
    b.className = `touch-btn touch-${slot}`;
    b.setAttribute('type', 'button');
    b.setAttribute('aria-label', f.accessible(slot));
    // ⚠️ AND WRITTEN, not only spoken: a pill with no text is a button a sighted child cannot read.
    b.textContent = f.nameOf(slot);
    system.appendChild(b);
  }
  return system;
}

/**
 * What this game does NOT reach by touch, said instead of kept quiet — the half of ADR-0143 §4 that is not markup.
 *
 * 📌 It returns LINES and does not throw: a host gap never takes the boot down, by the same rule the rest of
 * `problems` follows. The sentences go to the consumer that INTEGRATES the engine, not to a child.
 */
export function touchGaps(spec: Pick<TouchMarkupSpec, 'map' | 'gameActions'>): string[] {
  // ⚠️ WITHOUT `preset` THE PAD HAS ONLY SELECT AND START (ADR-0162): no direction, no button — not even to move
  // through menus. It is the integrator's gap, and it is said.
  if (!spec.gameActions.size) {
    return ['the virtual pad shows only SELECT and START — no direction and no button: a child on a tablet without a '
      + 'keyboard cannot play — declare `preset` with the positions this game uses and a word for each'];
  }
  // ⚠️ AND THE PARTIAL GAP IS SAID TOO. A game may declare an action no slot fires: it exists on the keyboard and not on
  // touch, and without this line that would show up nowhere.
  const reached = new Set(TOUCH_SLOTS.map((s) => spec.map[s.k]).filter(Boolean));
  const outsideTouch = [...spec.gameActions].filter((a) => !reached.has(a));
  if (!outsideTouch.length) return [];
  return [`the virtual pad does not reach ${outsideTouch.join(', ')}: no slot fires them, so a child playing by touch `
    + 'does not have them — remap a slot in the pad panel, or declare fewer actions'];
}

// ===================== THE FOUR SIZES OF THE VIRTUAL PAD, one per persona (ADR-0151 erratum) =====================
//
// The Dev: the touch pad size is chosen with left/right in FOUR steps, «cada um direcionado a uma persona» —
// small child (under 6), older child (12), small adult, adult with large hands. Data and one pure function, no DOM, no
// storage. ⚠️ HERE and not in a module of its own: the input boundary (ADR-0111) closes by shrinking, and the pad
// module already owns every pad size — a new `input/` file would be one more door for cartridges.
//
// ========================= WHERE THE MILLIMETRES COME FROM =========================
// Research first (`CLAUDE.md` §4): the numbers are DERIVED from these measurements, not chosen by taste.
//   · Vatavu, Cramariuc & Schipor (2015), «Touch interaction for children aged 3 to 6 years», IJHCS 74:54–76 —
//     mean touch offset 4.5 mm at 3 years, 3.8 mm at 4, 3.4 mm above 5, against 2.1–3.3 mm for adults; and the
//     guideline to accept offsets of up to 10 mm for 3-year-olds.
//   · Anthony et al. (2013), cited there — children aged 7–10 miss 7 mm targets almost 30% of the time and 11–17
//     year-olds 20%; 9 mm targets are missed once in six attempts until 17.
//   · Parhi, Karlson & Bederson (2006), «Target size study for one-handed thumb use on small touchscreen
//     devices», MobileHCI — for adults, no error difference above 9.6 mm (discrete) and 9.2–9.6 mm sufficient;
//     performance levels off above 11.5 mm.
//   · MIT Touch Lab, as reported by Smashing Magazine (2012) — adult index finger 16–20 mm wide, pad 10–14 mm.
//
// 📌 AND SO THE SMALL CHILD GETS THE LARGEST BUTTONS, which reads backwards and is not: the small hand is not the
// constraint, the imprecision is. A 3-year-old lands up to twice as far from the centre as an adult (Vatavu), so
// their target has to absorb that spread. The large-handed adult is second largest for the other reason — the
// finger itself is 16–20 mm and covers a smaller button entirely.
//
// ⚠️ `gap`, `stick`, `travel` and `dpad` follow the button in proportion to the engine's factory pad (button
// 12.5, gap 3, stick 18, travel 4.5, cross 12 mm — `input/touch`), because no source measures them per age.
// That is stated rather than hidden: they are the part of this table that is proportion, not measurement.

export type PersonaKey = 'crianca-pequena' | 'crianca-grande' | 'adulto-pequeno' | 'adulto-maos-grandes';

export interface PersonaDoPad {
  readonly key: PersonaKey;
  /** The i18n key of the persona's name. */
  readonly label: string;
  readonly mm: Readonly<PadMm>;
}

/** The factory pad of `input/touch`, the base the non-button sizes are proportioned from. */
const FACTORY: Readonly<PadMm> = { btn: 12.5, gap: 3, stick: 18, travel: 4.5, dpad: 12 };

/** A persona's pad: the button from the sources, the rest in proportion to the factory pad. */
function pad(btn: number): PadMm {
  const k = btn / FACTORY.btn;
  const r = (n: number): number => Math.round(n * k * 10) / 10;
  return { btn, gap: r(FACTORY.gap), stick: r(FACTORY.stick), travel: r(FACTORY.travel), dpad: r(FACTORY.dpad) };
}

/** The four, in the Dev's order. */
export const PERSONAS_DO_PAD: readonly PersonaDoPad[] = Object.freeze([
  // 16 mm: an adult's 9.6 mm plus twice the extra spread of a 3-year-old (≈ 2.4 mm each side), rounded up.
  { key: 'crianca-pequena', label: 'motora.pad.crianca-pequena', mm: pad(16) },
  // 14 mm: 9 mm is still missed once in six until 17 (Anthony), and 12.7 mm was the size that did not trouble them.
  { key: 'crianca-grande', label: 'motora.pad.crianca-grande', mm: pad(14) },
  // 11.5 mm: where adult performance levels off (Parhi) — above it there is no gain, only lost room.
  { key: 'adulto-pequeno', label: 'motora.pad.adulto-pequeno', mm: pad(11.5) },
  // 15 mm: a 16–20 mm finger covers anything smaller and hides the label under the thumb (MIT Touch Lab).
  { key: 'adulto-maos-grandes', label: 'motora.pad.adulto-maos-grandes', mm: pad(15) },
]);

/**
 * The persona whose button is closest to `btnMm` — what the step control shows for a pad that was sized before
 * the personas existed (the factory 12.5 mm reads as «small adult»). Ties go to the LARGER button: when in doubt,
 * the easier target.
 */
export function closestPersona(btnMm: number): number {
  let best = 0;
  PERSONAS_DO_PAD.forEach((p, i) => {
    const d = Math.abs(p.mm.btn - btnMm);
    const dm = Math.abs(PERSONAS_DO_PAD[best]!.mm.btn - btnMm);
    if (d < dm || (d === dm && p.mm.btn > PERSONAS_DO_PAD[best]!.mm.btn)) best = i;
  });
  return best;
}
