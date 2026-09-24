// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-setters — APPLYING the accessible vision modes (colour blindness, low vision, blindness, high contrast), per
// player and globally. It is the POLICY layer — "which mode counts where" — and not the FACTORY: whoever builds pixels
// (pixiFilterFor / parallaxTexFor / playerVizTex / lvOverlayTex / renderVpOverlay) is `render/viewports`, and those
// come in HERE by injection.
//
// Boundaries this module does NOT reopen:
//  · The host keeps the "mode the STATIC render pipeline last applied" record — not a vision cache, a record several
//    places write. It comes in through `getSharedViz`/`setSharedViz`/`invalidateSharedViz`.
//  · The selected player of the visual panel likewise: several writers (renderVizGroup, a player tab, the visual
//    panel, the pause menu) → get/set through the ctx.
//  · The outlined-player-frame cache belongs to render/viewports and is reassigned by these functions → cleared through
//    the ctx (an imported binding cannot be reassigned).
//
// The PIXI layers and sprites (camera/worldSprite/parallaxLayers/decoSprites/vpSpr/vpDots) are CREATED by the host — the
// addChild order is the drawing order — and come in injected through a STRUCTURAL interface, so the module runs in the
// `node` project without importing PIXI.
// NO I/O on import: initVizSetters(ctx) only closes closures, it calls nothing.

import { VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, simulatesDisability, type VizMode } from './viz-modes.js';
import {
  migrateVisual, filterKey, textureKey, legacyKey, isSimulation, isLowVision, isBlind, hasHighContrast, DEFAULT_VISUAL,
  type Theme, type Correction,
  type VisualState,
} from './viz-axes.js';
import { t } from '../core/i18n.js'; // VIZ_MODES keeps i18n KEYS; whoever shows them resolves them
import {
  axesHtml, buttonChoice, THEME_LABEL, CORRECTION_LABEL,
} from './viz-axes-labels.js';
import { simulationRefusal } from './viz-refusal.js';
import { DIRECT_CFG, worldTexFor, spriteTexFor, clearWorldTexCache, clearSpriteTexCache } from './high-contrast.js';

import { lqFilter } from './lq-filter.js';
import { setVizModeValue, setBlindModeValue } from '../core/state.js';
import * as store from '../platform/storage.js';
import type { DomQuery } from '../core/dom-query.js';
import type { WithFilter, WithTexture, Visible, DrawingWithCircle, ApplyCssFilter, FilterReach,
  ApplyHighContrastToDom } from './port.js';

/* ===================== PURE (no PIXI, no DOM) — what really earns a test ===================== */

/**
 * How far this mode's filter reaches. ENHANCEMENT reaches the menus; EMPATHY stays in the world (see `FilterReach`).
 * Derived from the catalogue's `sim` — the same flag that already tells the two apart, not a second list for someone
 * to forget to update.
 */
export function reachOfMode(mode: string): FilterReach {
  return simulatesDisability(mode) ? 'mundo' : 'mundo-e-menus';
}

/** The mode by key, with a fallback: an unknown (or null) key FALLS to `normal`. */
export function resolveViz(key: string | null | undefined): VizMode {
  return VIZ_BY_KEY[key as string] || VIZ_BY_KEY.normal;
}

/**
 * This player's STORED VISUAL STATE, in either of its two shapes (issue #104).
 *
 * ⚠️ THIS FUNCTION IS THE definition of done's box that says a setting saved before the split restores the same visible
 * state, and the order of the two reads is the whole decision:
 *
 *   1. the NEW key (`visualP`), the only one that can express two axes;
 *   2. without it, the OLD key (`vizP`), which keeps the single string — and where the setting of every child who
 *      played this game before the split lives;
 *   3. without either, the default.
 *
 * ⚠️ THE FALLBACK IS NOT ZEAL: without it, the first session after the update would erase the visual mode the child
 * chose — and whoever chose `fix-deuter` or `hc-direto-7` chose it because that is how they see. It is the difference
 * between migrating and starting over.
 *
 * `migrateVisual` accepts both shapes and is idempotent, so this can run as many times as needed.
 */
export function readStoredVisual(i: number): VisualState {
  const storedVisual = store.getJSON<unknown>(store.KEYS.visualP(i), null);
  if (storedVisual !== null) return migrateVisual(storedVisual);
  return migrateVisual(store.get(store.KEYS.vizP(i), null));
}

/** Is it one of the three Direct Rendering (high contrast) levels? The test is `!!DIRECT_CFG[mode]`. */
export function isDirectMode(mode: string): boolean { return !!DIRECT_CFG[mode]; }

/** The canvas's CSS filter in SOLO: vision simulation/correction + the L→Q enhancement, composed and with no gaps. */
export function cssFilterFor(mode: string, lq: string): string {
  return [VIZ_FILTER[mode] || '', lq].filter(Boolean).join(' ');
}

/** A viewport's indicator dot: only blindness (white) and low vision (green) light it. */
export function vizDotFor(m: VizMode | undefined): { visible: boolean; fill: number | null } {
  const on = !!m && (m.kind === 'blind' || m.kind === 'lowvision');
  return { visible: on, fill: on ? (m!.kind === 'blind' ? 0xffffff : 0x36d36a) : null };
}

/** The GLOBAL dot (#viz-indicator) for a `kind`: visible, classes and screen-reader label. */
export function vizIndicatorFor(kind: string): { on: boolean; blind: boolean; low: boolean; label: string } {
  return {
    on: kind === 'blind' || kind === 'lowvision',
    blind: kind === 'blind', low: kind === 'lowvision',
    label: (kind === 'blind' ? 'Modo cegueira total' : 'Modo baixa visão') + '. Toque duas vezes para voltar às cores normais.',
  };
}

/** The low-vision DOM overlay's class (`lv-haze`/`lv-tunnel`/…); '' for any other kind. */
export function lvOverlayClassFor(m: VizMode): string {
  return m.kind === 'lowvision' ? 'lv-' + m.lv : '';
}

/** The HTML of the vision modes' radio group (one row per mode; the current one marked). */
export function vizGroupHtml(modes: readonly VizMode[], cur: string): string {
  return modes.map((m) => {
    const sel = m.key === cur;
    return `<div class="ctrl-row"><span><strong>${t(m.name)}</strong><br><span class="opt-hint" style="margin:0">${t(m.desc)}</span></span>`
      + `<button class="mode-btn${sel ? ' is-on' : ''}" role="radio" aria-checked="${sel}" data-viz="${m.key}" type="button">${sel ? '✓ Selecionado' : 'Selecionar'}</button></div>`;
  }).join('');
}

/** The screen reader's line when a mode is chosen: prefixed with the player only on several screens. */
export function vizGroupSay(numPlayers: number, sel: number, name: string): string {
  return (numPlayers > 1 ? 'Jogador ' + (sel + 1) + ': ' : '') + name + '.';
}

/* ===================== shells: PIXI/DOM injected ===================== */

// `Filtered`, `Textured` and `DotGfx` come from `render/port`: local descriptions of the same PixiJS drift (the dot's
// graphics once returned `unknown` where the other copies returned `this`) — that is how graphics copies drift.
type Filtered = WithFilter;
type Textured = WithTexture;
/** The per-viewport dot's PIXI.Graphics — only what updateVpDots really uses. */
type DotGfx = Visible & DrawingWithCircle;
interface ClassListHost { classList: { toggle(token: string, force?: boolean): unknown; remove(...tokens: string[]): unknown } }
// ⚠️ `visual` OPTIONAL HERE, and `viz` not: this is the STRUCTURAL slice the module reads, and it is also satisfied by
// test fixtures written before #104. Making it required in this local interface would force every fixture to know a
// field it does not exercise — and the really required field is where it belongs, in `core/entity.PlayerBase`, which is
// what describes the player for real.
interface Pl { viz: string; visual?: VisualState; sprite?: Textured | null; _tx?: unknown }
interface Pu { kind: string; sprite?: Textured | null }

export interface VizSettersCtx {
  /* --- DOM (ui/dom + a11y) --- */
  /** The game's selector (#viz-overlay, #viz-indicator, the panel's lists). `DomQuery` from `core/dom-query`: a local
   *  NON-GENERIC version would instantiate a generic function by its CONSTRAINT when assigned to it. */
  $: DomQuery;
  body: ClassListHost;                              // document.body — the `lowvision-mode`/`blind-mode` classes gate the CSS
  srSay: (s: string) => void;                       // screen reader (aria-live region)

  /* --- PIXI objects the host creates (z-order welded there) --- */
  applyCssFilter: ApplyCssFilter;               // the verb, not the application object; see the port
  /** High contrast in the DOM — the filter does not reach it because it IS not a filter. Issue #83. */
  applyHighContrastToDom: ApplyHighContrastToDom;
  camera: Filtered;                                 // solo: high contrast = a GPU filter on the camera
  worldSprite: Textured;                            // the world, recoloured per mode
  parallaxLayers: Textured[];                       // background layers (the elements only get their .texture swapped)
  decoSprites: Textured[];                          // trees/background decoration
  getVpSpr: () => Filtered[];                       // GETTER: configureRender REASSIGNS the array when the number of screens changes
  getVpDots: () => DotGfx[];                        // GETTER: likewise (the per-viewport dots, above everything)
  /**
   * The declared ITEMS' sprites (the array lives in the game and may be recreated — hence a getter).
   *
   * A list of sprites, with the drawing not knowing what each one represents — not a coin-shaped getter.
   */
  getItemSprites: () => (Textured | null | undefined)[];
  /**
   * What the GAME calls its items in `render/high-contrast`'s recolour cache.
   *
   * The cache keys by `(id, mode)`; a `'coin'` string fixed in here would be this module naming one game's item. Note
   * the neighbour below: power-ups always carried their own `kind`, and the engine only passes it on. The items carried
   * nothing, so the name had to live somewhere — it lives on the side of whoever chose it.
   */
  itemTexId: string;
  getPowerups: () => readonly Pu[];                          // the game's power-ups

  /* --- the game's state --- */
  getPlayers: () => Pl[];
  getNumPlayers: () => number;                      // it changes with the player count
  getSelVizPlayer: () => number;                    // several writers outside here → get/set, not a value
  setSelVizPlayer: (i: number) => void;
  getSharedViz: () => string | null;                // the static render's record, kept by the host
  setSharedViz: (mode: string) => void;
  invalidateSharedViz: () => void;

  /* --- texture/filter factories (render/viewports) --- */
  parallaxTexFor: (i: number, mode: string) => unknown;
  treeTexFor: (mode: string) => unknown;
  playerVizTex: (base: unknown, mode: string) => unknown;
  pixiFilterFor: (mode: string) => unknown;
  clearPlayerDirectCache: () => void;               // clears the playerVizTex cache, which lives there
  /**
   * A POWER-UP'S TEXTURE IN THIS VISUAL MODE, and forgetting it — through a DOOR (ADR-0228).
   *
   * 🔴 A power-up is a game's furniture, and so is its texture cache. What is the ENGINE's is the rule — switching visual
   * mode repaints what is on screen —, and that rule does not need to know what a power-up is.
   */
  pupTexFor: (kind: string, mode: string) => unknown;
  resetPupTexCache: () => void;

  /* --- side effects of other subsystems (the game's) --- */
  setFrontDim: (on: boolean) => void;               // foreground props (cars/signs/lights) darken like the background
  rebuildExtras: () => void;                        // the level's extra geometry
  rebuildCoins: () => void;                         // the level's collectables
  setBlindMode?: (on: boolean) => void;               // the blindness empathy mode turns on the cane + audio cues
  hideTouchControls: (reason?: string) => void;     // input/touch
  reflectVizButtons: () => void;                    // lights #opt-visual/#opt-empathy
  renderVisualPanel: () => void;                    // the visual panel's render()
  renderEmpathyPanel: () => void;                   // the empathy panel's render()
}

export interface VizSettersApi {
  /** Several screens: applies the mode's STATIC textures (memoised) + each player's current frame. */
  applySharedTextures(mode: string): void;
  /** Per-viewport indicator dots (outside the viewport's filter — visible even in blindness). */
  updateVpDots(): void;
  /** Each viewport's PIXI filter = the mode of that screen's player. */
  applyVpFilters(): void;
  /** Changes ONE player's mode: persists, invalidates the static render and reapplies by the right path. */
  setPlayerViz(i: number, mode: string): void;
  /**
   * A player's WHOLE state, and the TWO per-axis writers (#104).
   *
   * ⚠️ The per-axis writers are separate because that is what a two-control panel needs: changing the THEME without
   * touching the correction, and vice versa. With a single field, changing one inevitably meant erasing the other — and
   * that was the defect, not the API.
   */
  setPlayerVisual(i: number, v: VisualState): void;
  setPlayerTheme(i: number, theme: Theme): void;
  setPlayerCorrection(i: number, correction: Correction): void;
  /** The SOLO path: CSS filter on the canvas + global textures + DOM overlay + dot. */
  applyVizGlobal(v: VisualState): void;
  /** Reapplies everything after a structural change (scenery, number of screens). */
  reapplyVizAll(): void;
  /** The global dot (#viz-indicator) for a `kind`. */
  updateVizIndicator(kind: string): void;
  /** Invalidates the direct texture caches (world/sprites/power-ups/player) and re-renders. */
  rebakeDirect(): void;
  /** The vision modes' radio group in the panels (visual/empathy). */
  renderVizGroup(listSel: string, tabsSel: string, modes: readonly VizMode[]): void;
  /** The visual panel's TWO axes (#104). The sibling of the one above — see the note in the implementation. */
  renderVisualAxes(listSel: string, tabsSel: string): void;
}

export function initVizSetters(ctx: VizSettersCtx): VizSettersApi {
  // the statics (world/parallax/items) only reapply when the mode changes (the host keeps the record)
  function applySharedTextures(mode: string): void {
    if (mode !== ctx.getSharedViz()) {
      ctx.setSharedViz(mode);
      ctx.setFrontDim(!!DIRECT_CFG[mode]); // HC: foreground props darken like the background
      ctx.worldSprite.texture = worldTexFor(mode);
      ctx.parallaxLayers.forEach((ts, j) => { ts.texture = ctx.parallaxTexFor(j, mode); });
      ctx.decoSprites.forEach((s) => { s.texture = ctx.treeTexFor(mode); });
      for (const s of ctx.getItemSprites()) { if (s) s.texture = spriteTexFor(ctx.itemTexId, mode); }
      for (const pu of ctx.getPowerups()) { if (pu.sprite) pu.sprite.texture = ctx.pupTexFor(pu.kind, mode); }
    }
    for (const pl of ctx.getPlayers()) { if (pl.sprite && pl._tx) pl.sprite.texture = ctx.playerVizTex(pl._tx, mode); } // the player changes frame every tick
  }

  // per-viewport indicator dots (over the output sprites → they do NOT get the viewport's filter, e.g. blindness)
  function updateVpDots(): void {
    const dots = ctx.getVpDots(), players = ctx.getPlayers();
    for (let i = 0; i < dots.length; i++) {
      const g = dots[i], m = VIZ_BY_KEY[(players[i] && players[i].viz) as string];
      if (!g) continue;
      const d = vizDotFor(m); g.visible = d.visible;
      if (d.visible) { g.clear(); g.lineStyle(1, 0x000000, .6); g.beginFill(d.fill!); g.drawCircle(0, 0, 5); g.endFill(); }
    }
  }

  function applyVpFilters(): void {
    const spr = ctx.getVpSpr(), players = ctx.getPlayers();
    // ⚠️ `filterKey` AND NOT `p.viz` (#104). The THEME goes through the texture (`playerVizTex`/`applySharedTextures`)
    // and the CORRECTION or SIMULATION through the FILTER — and it is precisely because they are two paths that the two
    // axes can coexist. `null` (no filter) enters as `'normal'`, the key `pixiFilterFor` already uses for "none", and it
    // caches by it.
    for (let i = 0; i < ctx.getNumPlayers(); i++) {
      const p = players[i];
      if (spr[i]) spr[i].filters = ctx.pixiFilterFor((p.visual && filterKey(p.visual)) || 'normal');
    }
  }

  /**
   * THE REAL WRITER (#104): it takes the STATE, not a key.
   *
   * ⚠️ AND HERE THE MIRROR CHANGES MEANING. While the controls wrote one value at a time, `viz` could be "the equivalent
   * mode". With two axes no single key describes `hc7 + fix-deuter`, so the mirror is exactly what it can still honestly
   * be: the legacy key (`legacyKey`) — simulation, else theme, else correction, else default.
   *
   * It is not a hidden loss: an old reader still sees something true about the screen; what it stops seeing is the half
   * the old shape never could say.
   */
  function writePlayerVisual(i: number, v: VisualState): void {
    const p = ctx.getPlayers()[i];
    p.visual = v;
    p.viz = legacyKey(v);
    store.set(store.KEYS.vizP(i), p.viz);        // legacy: an old reader would do `VIZ_BY_KEY[v]` and refuse JSON
    store.setJSON(store.KEYS.visualP(i), v);     // new: the two axes, which the old key cannot say
    applyPlayerVisual(i, v);
  }

  /** Changes ONLY this player's theme. The correction and the simulation stay where they were — the point of #104. */
  function writePlayerTheme(i: number, theme: Theme): void {
    const p = ctx.getPlayers()[i];
    writePlayerVisual(i, { ...(p.visual ?? DEFAULT_VISUAL), tema: theme });
  }

  /** Changes ONLY this player's colour correction. The theme and the simulation stay where they were. */
  function writePlayerCorrection(i: number, correction: Correction): void {
    const p = ctx.getPlayers()[i];
    writePlayerVisual(i, { ...(p.visual ?? DEFAULT_VISUAL), correcao: correction });
  }

  /** The old API, by a single key. It still holds: a game that picks a whole mode goes through here. */
  function setPlayerViz(i: number, mode: string): void {
    writePlayerVisual(i, migrateVisual(resolveViz(mode).key));
  }

  /** The side effects of having changed a player's visual. Separate from WRITING on purpose: the two per-axis writers
   *  and the old per-key one share them, and one more copy would be one more copy to drift. */
  function applyPlayerVisual(i: number, v: VisualState): void {
    ctx.invalidateSharedViz();
    if (isBlind(v)) (ctx.setBlindMode ?? setBlindModeValue)(true); // total-blindness empathy turns blind mode (audio) on by default
    if (ctx.getNumPlayers() <= 1 && i === 0) { applyVizGlobal(v); } else { applyVpFilters(); updateVpDots(); }
    ctx.reflectVizButtons(); ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
  }

  /**
   * ⚠️ THIS IS WHERE THE TWO AXES COEXIST (#104, ADR-0076), and the function did not grow — it SPLIT.
   *
   * With one key, every line below asked the same thing (`mode`, `m.kind`) and the answer had to be one. With two axes,
   * the same lines fall into three groups that never touch — which is why the composition is mechanically possible, as
   * `viz-axes` records:
   *
   *   · THEME (contrast) → texture and DOM class. `textureKey` and `hasHighContrast`.
   *   · CORRECTION or SIMULATION → CSS filter. `filterKey`.
   *   · SIMULATION → the body classes, the overlay, the touch controls, the dot.
   *
   * ⚠️ AND THE FILTER'S REACH STILL DEPENDS ON SIMULATING OR CORRECTING, ADR-0046's distinction: a CORRECTION reaches the
   * menus, because the child needs it to READ the menu; a SIMULATION stays in the world, because whoever simulates has to
   * be able to leave.
   *
   * `setVizModeValue` keeps writing the single legacy key. It is a mirror, not a source: the real state is the two axes,
   * and this line goes when the last reader of the old key goes.
   */
  function applyVizGlobal(v: VisualState): void {
    const filterName = filterKey(v);
    const textureForMode = textureKey(v);
    // ⚠️ `legacyKey` AND NOT the texture key: that one returns `normal` for a colour correction, and writing it here
    // would make an old reader of the global key lose the child's correction. See the note on `legacyKey`.
    setVizModeValue(legacyKey(v)); // core/state: value + persistence (incl_viz) + event — the legacy mirror
    // There is no separate "high contrast is on" flag: deriving it from VIZ_BY_KEY costs a comparison and cannot drift,
    // where a copied flag once disagreed with its own setter.
    // --- the CORRECTION/SIMULATION axis: the CSS filter ---
    ctx.applyCssFilter(cssFilterFor(filterName ?? '', lqFilter()), isSimulation(v) ? 'mundo' : 'mundo-e-menus');
    // --- the THEME axis: DOM and texture. It is not a filter (see `ApplyHighContrastToDom`), which is why it composes.
    ctx.applyHighContrastToDom(hasHighContrast(v));
    ctx.camera.filters = hasHighContrast(v) ? ctx.pixiFilterFor(textureForMode) : null; // solo: high contrast on the camera
    ctx.setFrontDim(hasHighContrast(v)); // HC: the foreground props darken like the background
    ctx.worldSprite.texture = worldTexFor(textureForMode);         // direct high contrast = Direct Rendering · else normal
    ctx.parallaxLayers.forEach((ts, i) => { ts.texture = ctx.parallaxTexFor(i, textureForMode); });
    ctx.decoSprites.forEach((s) => { s.texture = ctx.treeTexFor(textureForMode); });
    ctx.rebuildExtras(); ctx.rebuildCoins();
    // --- SIMULATION: low vision = haze+spots (overlay) + green dot; blindness = black screen + hidden controls + white
    //     dot. None of them looks at the theme, which is why the theme does not erase them.
    ctx.body.classList.toggle('lowvision-mode', isLowVision(v));
    ctx.body.classList.toggle('blind-mode', isBlind(v));
    const ov = ctx.$('#viz-overlay');
    if (ov) { ov.hidden = !isLowVision(v); ov.className = isLowVision(v) ? 'lv-' + String(v.simulacao).slice(3) : ''; }
    if (isBlind(v)) { ctx.hideTouchControls('cegueira'); }
    updateVizIndicator(isBlind(v) ? 'blind' : isLowVision(v) ? 'lowvision' : 'normal');
    ctx.reflectVizButtons();
    ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
  }

  // the indicator dot (top right corner): white=blindness, green=low vision; a double tap/click goes back to normal
  function updateVizIndicator(kind: string): void {
    const el = ctx.$('#viz-indicator'); if (!el) return;
    const s = vizIndicatorFor(kind);
    el.hidden = !s.on;
    el.classList.toggle('blind', s.blind); el.classList.toggle('low', s.low);
    el.setAttribute('aria-label', s.label);
  }

  // several screens: the global CSS filter/overlay/dot OFF (per viewport now)
  function reapplyVizAll(): void {
    ctx.invalidateSharedViz();
    if (ctx.getNumPlayers() <= 1) { applyVizGlobal(ctx.getPlayers()[0].visual ?? DEFAULT_VISUAL); }
    else {
      ctx.applyCssFilter(lqFilter(), 'mundo-e-menus'); // the L/Q enhancement is an enhancement: it reaches the menu
      ctx.camera.filters = null;
      ctx.body.classList.remove('lowvision-mode', 'blind-mode');
      const ov = ctx.$('#viz-overlay'); if (ov) ov.hidden = true;
      updateVizIndicator('normal'); applyVpFilters();
    }
  }

  // invalidates the direct texture caches (the world depends on bg; sprites on fg) and re-renders
  function rebakeDirect(): void {
    clearWorldTexCache(); clearSpriteTexCache(); ctx.resetPupTexCache(); ctx.clearPlayerDirectCache(); ctx.invalidateSharedViz();
    if (ctx.getNumPlayers() <= 1) applyVizGlobal(ctx.getPlayers()[0].visual ?? DEFAULT_VISUAL); else applyVpFilters();
  }

  function renderVizGroup(listSel: string, tabsSel: string, modes: readonly VizMode[]): void {
    const el = ctx.$(listSel); if (!el) return;
    if (ctx.getSelVizPlayer() >= ctx.getNumPlayers()) ctx.setSelVizPlayer(0);
    const tabs = ctx.$(tabsSel);
    if (tabs) {
      tabs.hidden = true; // no tabs — each player edits only their own
      tabs.innerHTML = '';
      // ⚠️ DEAD CODE, kept as it was: the innerHTML above has already emptied `tabs`, so this querySelectorAll finds
      // nothing and the listener is never wired.
      tabs.querySelectorAll<HTMLElement>('button[data-vp]').forEach((b) => b.addEventListener('click', () => {
        ctx.setSelVizPlayer(+(b.dataset.vp as string)); ctx.renderVisualPanel(); ctx.renderEmpathyPanel();
      }));
    }
    const players = ctx.getPlayers(), sel = ctx.getSelVizPlayer();
    const v = players[sel]?.visual ?? DEFAULT_VISUAL;
    const cur = legacyKey(v);
    el.innerHTML = vizGroupHtml(modes, cur);
    // ⚠️ THE SIMULATION'S REFUSAL (#104, ADR-0076 §4). With either axis off its default, a demonstration does not show
    // the disability — it shows the SETTING it runs over, and that teaches something false. The row STAYS on screen,
    // disabled and with the reason: vanishing would teach that the thing does not exist, and an adult would conclude it
    // was taken away instead of noticing they turned the contrast on themselves.
    //
    // The prose goes into an `.opt-hint`, which the shell (`ui/settings-panel.fillExplain`) MOVES to the footer — the
    // three-zone rule in CLAUDE.md: the explanation lives in the footer, never in the row.
    //
    // ⚠️ ONLY THE ROWS THAT SIMULATE. This function draws the list of simulations (the visual panel uses
    // `drawVisualAxes`), but it still gets the modes as a parameter — and a colour correction in this list must not be
    // refused because of its own axis.
    const refusal = simulationRefusal(v);
    el.querySelectorAll<HTMLElement>('button[data-viz]').forEach((btn) => {
      const key = btn.dataset.viz as string;
      if (refusal && simulatesDisability(key)) {
        btn.setAttribute('aria-disabled', 'true');
        const explanation = btn.closest('.ctrl-row')?.querySelector<HTMLElement>('.opt-hint');
        if (explanation) explanation.textContent = `${explanation.textContent} ${t(refusal.key)}`.trim();
        return; // no listener: accepting the click and ignoring it is the other half of what the ADR forbids
      }
      btn.addEventListener('click', () => {
        setPlayerViz(ctx.getSelVizPlayer(), key);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), ctx.getSelVizPlayer(), t(VIZ_MODES.find((m) => m.key === key)!.name)));
      });
    });
  }

  /**
   * The TWO AXES in the VISUAL panel (#104). The sibling of `renderVizGroup`, and SEPARATE from it on purpose.
   *
   * ⚠️ DOING THIS INSIDE `renderVizGroup` WOULD BREAK THE EMPATHY PANEL. That function serves BOTH panels —
   * `#visual-modes` with the seven modes and `#empathy-list` with the nine simulations —, and changing its body would put
   * the two axes into the list of simulations. There the single radio stays RIGHT: the simulations really are exclusive
   * among themselves; what stopped being exclusive is something else.
   *
   * ⚠️ AND THE TWO GROUPS GO INTO THE CONTAINER THAT ALREADY EXISTS, with no new host markup. Requiring one more element
   * would make every game have to remember it — the shape of defect ADR-0106 measured in five games with no accessibility
   * bar at all.
   */
  function drawVisualAxes(listSel: string, tabsSel: string): void {
    const el = ctx.$(listSel); if (!el) return;
    if (ctx.getSelVizPlayer() >= ctx.getNumPlayers()) ctx.setSelVizPlayer(0);
    const tabs = ctx.$(tabsSel); if (tabs) { tabs.hidden = true; tabs.innerHTML = ''; }
    const sel = ctx.getSelVizPlayer();
    const v = ctx.getPlayers()[sel]?.visual ?? DEFAULT_VISUAL;
    el.innerHTML = axesHtml(v, t);
    el.querySelectorAll<HTMLElement>('button[data-eixo]').forEach((btn) => btn.addEventListener('click', () => {
      const choice = buttonChoice(btn.dataset);
      if (!choice) return; // a button of another subject, or a hand-edited `data-`: no guessing
      const i = ctx.getSelVizPlayer();
      if (choice.axis === 'tema') {
        writePlayerTheme(i, choice.value as Theme);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), i, t(THEME_LABEL[choice.value as Theme])));
      } else {
        writePlayerCorrection(i, choice.value as Correction);
        ctx.srSay(vizGroupSay(ctx.getNumPlayers(), i, t(CORRECTION_LABEL[choice.value as Correction])));
      }
    }));
  }

  return {
    applySharedTextures, updateVpDots, applyVpFilters, setPlayerViz, applyVizGlobal, reapplyVizAll,
    updateVizIndicator, rebakeDirect, renderVizGroup, renderVisualAxes: drawVisualAxes,
    // The TWO per-axis writers (#104): what a two-control panel calls.
    setPlayerVisual: writePlayerVisual, setPlayerTheme: writePlayerTheme, setPlayerCorrection: writePlayerCorrection,
  };
}
