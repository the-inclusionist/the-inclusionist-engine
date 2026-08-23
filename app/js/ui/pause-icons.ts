// SPDX-License-Identifier: GPL-3.0-or-later
// ui/pause-icons — the PER-SCREEN pause menu (`.screen-pause`) and the accessibility icon bar (`.pi-btn`).
// Extracted VERBATIM from game.js (Estágio 4): PAUSE_ICONS, buildScreenPause, calmMode/applyCalm, iconAct,
// iconLabel, reflectIconBtn, reflectPauseIcons and hasPrivateOutput.
//
// WHY THE ICON BAR IS ITS OWN SLICE: the ten `.pi-btn` buttons are the ONLY place in the game where a state
// owned by another subsystem (blind mode, TTS, Libras, TEA/reduced-motion, toggle-keys, contrast, CVD) is both
// mutated AND read back as an `aria-label`. That round-trip — "the label must tell the truth about the state" —
// is the whole reason `iconLabel` exists, and it is what the pure functions below make testable in node.
//
// `iconAct` IS A DISPATCHER (its ctx list is long by nature: seven subsystems, one button each), so it is
// implemented here as a TABLE (`ICON_ACTS`) rather than the original if/else chain. Same order, same
// guards, same announcements — only the shape changed.
//
// WHAT STAYS IN game.js (injected):
//   · `pauseActor`      — read by the gamepad (input/gamepad.ts ctx) and the keyboard router, and by
//                         openHelp()/openOptions(); this module only WRITES it (`setPauseActor`).
//   · `pauseActs`       — the `.pm-btn` action table; every entry calls a panel that still lives in game.js
//                         (openTypo/openAudio/openMovement/motion.open/openVisual/empathy.open/printMode/
//                         quitGame/openHelp/setPhase/applyLetra/setQuizLevel/joinPlayer/fitsN/vpScreens).
//                         Injected LAZILY (`getPauseActs`) because it is a `const` declared ~1200 lines below
//                         the init site — an eager reference would hit its temporal dead zone.
//   · `vpPause`         — the array of built pause screens; game.js rebuilds it in buildGameHud() and reads it
//                         in setPhase/navPause/printMode/pauseSelect/__incl. Injected as a getter.
//   · `rm`/`saveRM`     — the reduced-motion flags object, co-owned with ui/settings-motion (same reference).
//   · `PM_BTNS`/`QL_NAME` — owned by ui/activities-menu; injected, never copied.

import { numPlayers, players, quizLevel } from '../core/state.js';
import { t } from '../core/i18n.js';
import { CONTRAST_LEVELS, CONTRAST_LABELS } from './settings-visual.js';
import type { MotionSceneFlags, MotionSceneKey, MotionCharDef } from './settings-motion.js';
import type { AudioCatState } from './settings-audio.js';

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

export interface PauseIcon {
  /** `data-pi` key — the dispatch key of iconAct/iconLabel/reflectIconBtn. */
  k: string;
  /** The emoji glyph rendered inside the button. */
  e: string;
  /** Base name; also the `aria-label` when the icon carries no state (or is `soon`). */
  n: string;
  /** Under construction: the button announces itself and does nothing else. */
  soon?: boolean;
}

/** The accessibility shortcut bar at the top of every pause screen (and of the splash `#title-icons`).
 *  Sound-bound icons (blind/TTS) require a private audio output; webcam/voice are still `soon`.
 *  VERBATIM from game.js — including the pt-BR-only names (see the i18n note in the report). */
export const PAUSE_ICONS: readonly PauseIcon[] = [
  { k: 'blind', e: '🦯', n: 'Modo cego (navegação sonora)' },
  { k: 'tts', e: '🗨️', n: 'Narração por voz (TTS)' },
  { k: 'libras', e: '🤟', n: 'Modo pessoa surda (Libras)' },
  { k: 'tea', e: '🧩', n: 'Modo TEA (calmo / silencioso)' },
  { k: 'altmove', e: '🦾', n: 'Teclas de alternância' },
  { k: 'contrast', e: '🌗', n: 'Alto contraste' },
  { k: 'cvd', e: '🚥', n: 'Correção de daltonismo (protan/deutan/tritan)' },
  { k: 'face', e: '🧑', n: 'Webcam — rosto', soon: true },
  { k: 'eyes', e: '👀', n: 'Webcam — olhos', soon: true },
  { k: 'voice', e: '👄', n: 'Comando de voz', soon: true },
];

const ICON_BY_KEY: ReadonlyMap<string, PauseIcon> = new Map(PAUSE_ICONS.map((ic) => [ic.k, ic]));
export function pauseIcon(k: string): PauseIcon | undefined { return ICON_BY_KEY.get(k); }

/** TEA cycle: 0 = normal · 1 = calmo (reduces) · 2 = silencioso (switches off). Never touches TTS/blind mode. */
export const CALM_NAMES: readonly string[] = ['off', 'calmo', 'silencioso'];
/** The audio categories `applyCalm` governs. TTS/sonar/guarda/guia stay untouched — a calm player still needs them. */
export const CALM_AUDIO_CATS: readonly string[] = ['ambient', 'music', 'earcons', 'other', 'interact'];
/** Colour-vision-deficiency cycle, in `player.viz` values. */
export const CVD_SEQ: readonly string[] = ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan'];
/** Announcement names for CVD, indexed the same as CVD_SEQ. */
export const CVD_NAMES: readonly string[] = ['off', 'protanopia', 'deuteranopia', 'tritanopia'];
/** `player.viz` → label used by iconLabel (anything else is "off"). */
export const CVD_LABELS: Readonly<Record<string, string>> = {
  'fix-protan': 'protanopia', 'fix-deuter': 'deuteranopia', 'fix-tritan': 'tritanopia',
};

// ---------------------------------------------------------------------------------------------
// Shapes this module reads but does not own
// ---------------------------------------------------------------------------------------------

/** The slice of a player object the pause icons touch. `players` (core/state) is typed `unknown[]`. */
export interface PausePlayer {
  viz?: string;
  toggleMove?: boolean;
  audioSink?: string | null;
  [prop: string]: unknown; // rmWalk/rmBreath/rmFlavor, written by applyCalm through RM_CHAR[].prop
}

/** One `.pm-btn` descriptor — the shape of game.js's PM_BTNS (owned by ui/activities-menu). */
export interface PauseMenuButton {
  act: string;
  lbl: string;
  /** Dynamic label (the ABC cycle) — rendered from `lbl`, not from i18n, and NOT given `data-i18n`. */
  letra?: boolean;
  /** Dynamic label (the literacy level) — rendered from quizLevel + qlName. Currently dormant: no PM_BTNS
   *  entry sets it, but the branch is live code and is ported verbatim. */
  nivel?: boolean;
}

// ---------------------------------------------------------------------------------------------
// PURE LOGIC — no `document`, no ctx. This is the half that carries the accessibility contract.
// ---------------------------------------------------------------------------------------------

/** Everything the label/visual of ONE icon depends on, gathered in one value. */
export interface IconStateSnapshot {
  modoCego: boolean;
  ttsOn: boolean;
  librasOn: boolean;
  calmMode: number;
  toggleMove: boolean;
  /** `player.viz` — shared by the contrast and CVD icons (they overwrite each other; that is by design). */
  viz: string;
  /** False disables the blind/TTS icons: those need an audio output nobody else is listening to. */
  privateOutput: boolean;
}

/** A player has private output when nobody else is on the same sink. Single screen ⇒ always private.
 *  Pure form of game.js's hasPrivateOutput (see the report: it had no other caller left). */
export function hasPrivateOutputIn(list: readonly PausePlayer[], count: number, i: number): boolean {
  if (count <= 1) return true;
  const p = list[i];
  if (!p || !p.audioSink) return false;
  return !list.some((q, j) => j !== i && q && q.audioSink === p.audioSink);
}

/** TEA cycle step. */
export function nextCalmMode(cur: number): number { return (cur + 1) % 3; }

/** Next high-contrast level. An unlisted `viz` (e.g. a CVD filter) is treated as index 0 ⇒ jumps to 'hc-direto'. */
export function nextContrast(cur: string | undefined): string {
  let idx = CONTRAST_LEVELS.indexOf(cur as string);
  idx = idx < 0 ? 0 : idx;
  return CONTRAST_LEVELS[(idx + 1) % CONTRAST_LEVELS.length];
}

/** Next CVD filter. NOTE the asymmetry with nextContrast: an unlisted `viz` maps to index 1 ('fix-protan'),
 *  not 0 — verbatim from game.js (`idx = idx<0 ? 1 : (idx+1)%seq.length`). */
export function nextCvd(cur: string | undefined): { idx: number; mode: string } {
  let idx = CVD_SEQ.indexOf(cur as string);
  idx = idx < 0 ? 1 : (idx + 1) % CVD_SEQ.length;
  return { idx, mode: CVD_SEQ[idx] };
}

/** What `applyCalm` does to ONE audio category, given the TEA level. Extracted so the (destructive) volume
 *  clamp at level 1 is visible and testable — see the report. */
export function calmAudioPlan(calmMode: number, vol: number): { on: boolean; vol: number } {
  if (calmMode === 0) return { on: true, vol };
  if (calmMode === 1) return { on: true, vol: Math.min(vol, 0.3) };
  return { on: false, vol };
}

/** What `applyCalm` does to the scene/character reduced-motion flags. */
export function calmMotionPlan(calmMode: number): { sceneReduced: boolean; charFrozen: boolean } {
  return { sceneReduced: calmMode >= 1, charFrozen: calmMode === 2 };
}

/** The `aria-label` of one icon — it MUST reflect the current state, on/off or level. This is the whole
 *  point of the function: a toggle that looks pressed but does not say so is invisible to a screen reader. */
export function computeIconLabel(k: string, s: IconStateSnapshot): string {
  const ic = ICON_BY_KEY.get(k);
  if (!ic) return '';
  if (ic.soon) return ic.n + ' (em construção)';
  if (k === 'blind') return 'Modo cego (navegação sonora): ' + (s.modoCego ? 'on' : 'off');
  if (k === 'tts') return 'Narração por voz (TTS): ' + (s.ttsOn ? 'on' : 'off');
  if (k === 'libras') return 'Modo pessoa surda (Libras): ' + (s.librasOn ? 'on' : 'off');
  if (k === 'tea') return 'Modo TEA: ' + CALM_NAMES[s.calmMode];
  if (k === 'altmove') return 'Teclas de alternância: ' + (s.toggleMove ? 'on' : 'off');
  if (k === 'contrast') return 'Alto contraste: ' + (CONTRAST_LABELS[s.viz] || 'off');
  if (k === 'cvd') return 'Correção de daltonismo: ' + (CVD_LABELS[s.viz] || 'off');
  return ic.n;
}

/** The visual state of one icon button. `active` is what becomes `aria-pressed`. */
export interface IconVisual {
  /** `.pi-on` — the yellow "this is on" state. */
  on: boolean;
  /** `.pi-dis` — greyed out (blind/TTS without a private audio output). */
  dis: boolean;
  /** `.pi-calm` — TEA level 1 only (white); level 2 uses `.pi-on` instead. */
  calm: boolean;
  /** `.pi-cvd-protan` | `.pi-cvd-deuter` | `.pi-cvd-tritan`, or '' — the two-tone background IS the on-signal. */
  cvd: string;
  /** aria-pressed: on OR calm OR a CVD tint. */
  active: boolean;
}

/** Pure form of reflectIconBtn's branching. A `soon` icon lands on all-false — it never claims to be on. */
export function computeIconVisual(k: string, s: IconStateSnapshot): IconVisual {
  let on = false, dis = false, calm = false, cvd = '';
  if (k === 'blind') { on = s.modoCego; dis = !s.privateOutput; }
  else if (k === 'tts') { on = s.ttsOn; dis = !s.privateOutput; }
  else if (k === 'libras') { on = s.librasOn; }
  else if (k === 'tea') { on = s.calmMode === 2; calm = s.calmMode === 1; }
  else if (k === 'altmove') { on = s.toggleMove; }
  else if (k === 'contrast') { on = /^hc-direto/.test(s.viz || ''); }
  else if (k === 'cvd') {
    if (s.viz === 'fix-protan') cvd = 'pi-cvd-protan';
    else if (s.viz === 'fix-deuter') cvd = 'pi-cvd-deuter';
    else if (s.viz === 'fix-tritan') cvd = 'pi-cvd-tritan';
  }
  return { on, dis, calm, cvd, active: on || calm || !!cvd };
}

/** The CSS classes reflectIconBtn clears before applying a fresh visual — in the original order. */
export const ICON_STATE_CLASSES: readonly string[] = ['pi-calm', 'pi-cvd-protan', 'pi-cvd-deuter', 'pi-cvd-tritan'];

// --- markup (pure string builders; the DOM shell below just assigns them) ---

/** One `.pi-btn`. `soon` icons get `.pi-soon` and the "(em construção)" suffix baked into the aria-label. */
export function iconBtnMarkup(ic: PauseIcon): string {
  return '<button class="pi-btn' + (ic.soon ? ' pi-soon' : '') + '" type="button" data-pi="' + ic.k +
    '" aria-label="' + ic.n + (ic.soon ? ' (em construção)' : '') + '">' + ic.e + '</button>';
}

/** The whole icon bar. Used by the pause screen AND by the splash `#title-icons` (which built the same string
 *  by hand in game.js — that duplication dies with this export). */
export function iconsMarkup(): string { return PAUSE_ICONS.map(iconBtnMarkup).join(''); }

/** One `.pm-btn`. Dynamic labels (`letra`/`nivel`) are rendered eagerly and carry NO `data-i18n`, so
 *  i18n.applyDom() cannot overwrite them. */
export function pmBtnMarkup(
  b: PauseMenuButton, level: number, qlName: Readonly<Record<number, string>>, tr: (key: string) => string,
): string {
  const dyn = b.letra || b.nivel;
  const lbl = b.nivel ? ('📚 Nível ' + level + ' · ' + qlName[level]) : (dyn ? b.lbl : tr('pause.' + b.act));
  return '<button class="pm-btn' + (b.letra ? ' pm-letra' : '') + (b.nivel ? ' pm-nivel' : '') +
    '" role="menuitem" type="button" data-act="' + b.act + '"' +
    (dyn ? '' : (' data-i18n="pause.' + b.act + '"')) + '>' + lbl + '</button>';
}

export interface ScreenPauseMarkupOpts {
  /** Screen/player index (0-based); the dialog label and the "· Jogador N" suffix are 1-based. */
  player: number;
  /** Live player count — the suffix only appears in multiplayer. */
  numPlayers: number;
  pmButtons: readonly PauseMenuButton[];
  quizLevel: number;
  qlName: Readonly<Record<number, string>>;
  t: (key: string) => string;
}

/** The full innerHTML of a `.screen-pause`. Pure — every input is a parameter. */
export function screenPauseMarkup(o: ScreenPauseMarkupOpts): string {
  return '<div class="pause-card" role="dialog" aria-modal="true" aria-label="Menu de pausa do jogador ' + (o.player + 1) + '">' +
    '<div class="pause-icons" role="group" aria-label="Atalhos de acessibilidade">' + iconsMarkup() + '</div><p class="pause-icons-cap" aria-live="polite"></p>' +
    '<h2><span data-i18n="pause.title">' + o.t('pause.title') + '</span>' + (o.numPlayers > 1 ? ' · Jogador ' + (o.player + 1) : '') + '</h2><div class="pause-menu" role="menu">' +
    o.pmButtons.map((b) => pmBtnMarkup(b, o.quizLevel, o.qlName, o.t)).join('') +
    '</div><p class="pause-legend" aria-hidden="true"></p></div>';
}

// ---------------------------------------------------------------------------------------------
// Injection contract
// ---------------------------------------------------------------------------------------------

export interface PauseIconsCtx {
  // --- announcements (core/a11y-sr; injected because they reach `document` at call time) ---
  /** aria-live "polite" — every successful toggle announces its NEW state. */
  srSay: (text: string) => void;
  /** aria-live "assertive" — the two refusals (`soon` icon, shared audio output). */
  srAlert: (text: string) => void;

  // --- the per-screen pause menu ---
  /** PM_BTNS — the `.pm-btn` list. Owned by ui/activities-menu; injected, never copied. */
  pmButtons: readonly PauseMenuButton[];
  /** QL_NAME — literacy-level names, for the (dormant) `nivel` button. Same owner as pmButtons. */
  qlName: Readonly<Record<number, string>>;
  /** The `.pm-btn` action table. LAZY: `pauseActs` is a `const` declared far below the init site in game.js. */
  getPauseActs: () => Record<string, (() => void) | undefined>;
  /** Records which player opened the menu. `pauseActor` itself stays in game.js — the gamepad, the keyboard
   *  router, openHelp() and openOptions() all read it there. */
  setPauseActor: (i: number) => void;
  /** The live `vpPause` array (game.js rebuilds it on every buildGameHud). Getter, not the array. */
  getPauseScreens: () => readonly Element[];

  // --- blind mode (game.js owns `modoCego` + persistence + the cane/extras rebuild) ---
  getModoCego: () => boolean;
  setModoCego: (on: boolean) => void;

  // --- TTS (platform/audio mixer; the panel refresh lives in ui/settings-audio) ---
  getAudioCat: () => Record<string, AudioCatState>;
  /** Re-applies a category's gain node after `on`/`vol` changed. */
  setCatGain: (k: string) => void;
  /** Repaints the TTS row of the auditory panel. See BUG #1 in the report: in game.js this call is behind a
   *  `typeof reflectTTS==='function'` guard on a symbol that no longer exists, so it never fires. The guard is
   *  ported verbatim as `reflectTtsPanelEnabled` below rather than silently fixed. */
  reflectTtsPanel: () => void;
  /** Verbatim port of game.js's dead guard: `typeof reflectTTS === 'function'`. Pass `false` to preserve
   *  today's behaviour (the panel is NOT refreshed), `true` to restore the intended call. */
  reflectTtsPanelEnabled: boolean;

  // --- Libras (ui/vlibras; both reach `document` at call time) ---
  isLibrasOn: () => boolean;
  toggleLibras: () => void;

  // --- TEA / reduced motion (the `rm` object is co-owned with ui/settings-motion — same reference) ---
  rm: MotionSceneFlags;
  rmKeys: readonly MotionSceneKey[];
  rmChar: readonly MotionCharDef[];
  saveRM: () => void;

  // --- motor + visual (both mutate state and rebake textures in game.js) ---
  setToggleMove: (i: number, on: boolean) => void;
  setPlayerViz: (i: number, mode: string) => void;
}

export interface PauseIconsApi {
  /** Builds one `.screen-pause` (hidden), wired for click + hover/focus caption. Caller appends it. */
  buildScreenPause: (i: number) => HTMLElement;
  /** Runs the icon `k` for screen `i`. Does NOT reflect — callers reflect after, as game.js always did. */
  iconAct: (k: string, i: number) => void;
  /** The state-reflecting `aria-label` of icon `k` for screen `i`. */
  iconLabel: (k: string, i: number) => string;
  /** Applies classes + aria-pressed + aria-label to ONE `.pi-btn`. */
  reflectIconBtn: (b: HTMLElement, i: number) => void;
  /** Reflects every `.pi-btn` inside `root` in screen `i`'s scope. `#title-icons` uses i=0 (splash = J1). */
  reflectIconsIn: (root: ParentNode | null, i: number) => void;
  /** Reflects every pause screen (each in its own player's scope). */
  reflectPauseIcons: () => void;
  /** Applies the current TEA level to scene motion, character motion and the five audio categories. */
  applyCalm: () => void;
  getCalmMode: () => number;
  /** Sets the TEA level WITHOUT applying it (applyCalm is the apply step) — for tests and future restore. */
  setCalmMode: (n: number) => void;
  /** Snapshot of everything the label/visual of screen `i` depends on. Exposed for tests and debugging. */
  iconState: (i: number) => IconStateSnapshot;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing shell
// ---------------------------------------------------------------------------------------------

export function initPauseIcons(ctx: PauseIconsCtx): PauseIconsApi {
  // TEA level. It lives HERE (game.js's `let calmMode` had no other reader) and is deliberately NOT persisted
  // — verbatim: game.js never wrote it to storage, even though applyCalm() persists `rm` as a side effect.
  let calmMode = 0;

  const P = (): PausePlayer[] => players as PausePlayer[];

  function hasPrivateOutput(i: number): boolean { return hasPrivateOutputIn(P(), numPlayers, i); }

  function iconState(i: number): IconStateSnapshot {
    const p = P()[i] || {};
    const cat = ctx.getAudioCat();
    return {
      modoCego: ctx.getModoCego(),
      ttsOn: !!(cat && cat.tts && cat.tts.on),
      librasOn: ctx.isLibrasOn(),
      calmMode,
      toggleMove: !!p.toggleMove,
      viz: p.viz || '',
      privateOutput: hasPrivateOutput(i),
    };
  }

  // --- TEA ---------------------------------------------------------------------------------

  function applyCalm(): void {
    const plan = calmMotionPlan(calmMode);
    for (const k of ctx.rmKeys) ctx.rm[k] = plan.sceneReduced;
    ctx.saveRM();
    // "silencioso" freezes the character too. Iterates the WHOLE players array (not just numPlayers) — verbatim.
    for (const p of P()) for (const c of ctx.rmChar) p[c.prop] = plan.charFrozen;
    const cat = ctx.getAudioCat();
    for (const k of CALM_AUDIO_CATS) {
      const c = cat && cat[k];
      if (!c) continue;
      const next = calmAudioPlan(calmMode, c.vol);
      c.on = next.on; c.vol = next.vol;
      ctx.setCatGain(k);
    }
    // TTS/sonar/guarda/guia stay intact on purpose: TEA is about noise, not about losing navigation.
  }

  // --- icon actions (the dispatcher, as a table) ---------------------------------------------

  const ICON_ACTS: Record<string, (i: number) => void> = {
    blind: () => {
      ctx.setModoCego(!ctx.getModoCego());
      ctx.srSay('Modo cego ' + (ctx.getModoCego() ? 'ligado.' : 'desligado.'));
    },
    tts: () => {
      const cat = ctx.getAudioCat();
      cat.tts.on = !cat.tts.on; // verbatim: no guard here, unlike iconLabel's `audioCat.tts &&`
      ctx.setCatGain('tts');
      if (ctx.reflectTtsPanelEnabled) ctx.reflectTtsPanel();
      ctx.srSay('Narração ' + (cat.tts.on ? 'ligada.' : 'desligada.'));
    },
    libras: () => {
      ctx.toggleLibras();
      ctx.srSay('Modo pessoa surda: Libras ' + (ctx.isLibrasOn() ? 'ligado.' : 'desligado.'));
    },
    tea: () => {
      calmMode = nextCalmMode(calmMode);
      applyCalm();
      ctx.srSay('Modo TEA: ' + CALM_NAMES[calmMode] + '.');
    },
    altmove: (i) => {
      // verbatim: `players[i].toggleMove` with no `||{}` guard (unlike contrast/cvd below).
      ctx.setToggleMove(i, !P()[i].toggleMove);
    },
    contrast: (i) => {
      const nx = nextContrast((P()[i] || {}).viz);
      ctx.setPlayerViz(i, nx);
      ctx.srSay('Alto contraste: ' + CONTRAST_LABELS[nx] + '.');
    },
    cvd: (i) => {
      const nx = nextCvd((P()[i] || {}).viz);
      ctx.setPlayerViz(i, nx.mode);
      ctx.srSay('Correção de daltonismo: ' + CVD_NAMES[nx.idx] + '.');
    },
  };

  function iconAct(k: string, i: number): void {
    const ic = ICON_BY_KEY.get(k);
    if (ic && ic.soon) {
      ctx.srAlert(ic.n + ': em construção — chega com os subsistemas de webcam/fala e o filtro de daltonismo.');
      return;
    }
    if ((k === 'blind' || k === 'tts') && !hasPrivateOutput(i)) {
      ctx.srAlert('Só dá para mexer em som/TTS/modo cego com uma saída de áudio SÓ sua (não compartilhada). Escolha um dispositivo próprio em A12e auditiva.');
      return;
    }
    const act = ICON_ACTS[k];
    if (act) act(i);
  }

  // --- reflection --------------------------------------------------------------------------

  function iconLabel(k: string, i: number): string { return computeIconLabel(k, iconState(i)); }

  function reflectIconBtn(b: HTMLElement, i: number): void {
    const k = b.dataset.pi || '';
    const st = iconState(i);
    const v = computeIconVisual(k, st);
    b.classList.remove(...ICON_STATE_CLASSES);
    if (v.calm) b.classList.add('pi-calm');
    if (v.cvd) b.classList.add(v.cvd);
    b.classList.toggle('pi-on', v.on);
    b.classList.toggle('pi-dis', v.dis);
    b.setAttribute('aria-pressed', String(v.active));
    // `soon` buttons keep the label the markup gave them (same string) — no state to report.
    if (!(ICON_BY_KEY.get(k) || {} as PauseIcon).soon) b.setAttribute('aria-label', computeIconLabel(k, st));
  }

  function reflectIconsIn(root: ParentNode | null, i: number): void {
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => reflectIconBtn(b, i));
  }

  function reflectPauseIcons(): void {
    ctx.getPauseScreens().forEach((sp, i) => reflectIconsIn(sp, i));
  }

  // --- the pause screen ----------------------------------------------------------------------

  function buildScreenPause(i: number): HTMLElement {
    const sp = document.createElement('div');
    sp.className = 'screen-pause';
    sp.hidden = true;
    sp.dataset.player = String(i);
    sp.innerHTML = screenPauseMarkup({
      player: i, numPlayers, pmButtons: ctx.pmButtons, quizLevel, qlName: ctx.qlName, t,
    });

    sp.addEventListener('click', (e) => {
      const target = e.target as Element | null;
      const b = target && target.closest<HTMLElement>('.pm-btn');
      if (b) {
        ctx.setPauseActor(i);
        const act = b.dataset.act || '';
        const acts = ctx.getPauseActs();
        const fn = acts[act];
        if (fn) fn();
        return;
      }
      const ib = target && target.closest<HTMLElement>('.pi-btn');
      if (ib) {
        ctx.setPauseActor(i);
        iconAct(ib.dataset.pi || '', i);
        reflectPauseIcons(); // must run BEFORE reading the label back — that is what makes the caption honest
        const cp = sp.querySelector('.pause-icons-cap');
        if (cp) cp.textContent = ib.getAttribute('aria-label') || '';
      }
    });

    // Caption = the button's aria-label, so hovering/focusing an icon speaks the SAME state text a screen
    // reader would announce. One source of truth for sighted and non-sighted players.
    const cap = sp.querySelector('.pause-icons-cap');
    sp.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => {
      const show = (): void => { if (cap) cap.textContent = b.getAttribute('aria-label') || ''; };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
    });
    return sp;
  }

  return {
    buildScreenPause, iconAct, iconLabel, reflectIconBtn, reflectIconsIn, reflectPauseIcons,
    applyCalm, getCalmMode: () => calmMode, setCalmMode: (n) => { calmMode = n; }, iconState,
  };
}
