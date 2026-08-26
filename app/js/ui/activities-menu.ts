// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/activities-menu.ts — the TITLE-SCREEN menus and the "pick an activity" flow (Estágio 4). Owns everything
// between "the player is looking at the splash" and "the round actually starts": the activity submenus' markup
// (buildTitleMenus), arrow-key traversal (titleButtons/navTitle), the whole `#title-overlay` click dispatcher
// (`data-tm`/`data-tm-back`/`data-act-id`/`data-tab-n`/`data-fnot`/`data-cen`/`#np-btn`/`#tab-play`), the
// two-step start (startActivity → scenario picker → reallyStart), the current activity's category (actCat) and
// the persisted menu selections (tabuada numbers, fraction notations).
//
// DI via initActivitiesMenu(ctx) — no I/O at import time. Imported DIRECTLY (leaf modules, never game.js):
//   core/state.ts        → `activity`/`setActivityValue` (live binding + persistence + event), `players`,
//                          `numPlayers`. The VALIDATION of the id lives here, on purpose: core/state.ts stores
//                          whatever it is given, so somebody outside has to know the catalog.
//   educational/activities-registry.ts → the catalog (getActivity/hasActivity/isValidActivityId/
//                          DEFAULT_ACTIVITY_ID). Never re-declared here; this module only *reads* it.
//                          É CURRÍCULO, não jogo (ADR-0032) — e é por isso que a aresta antiga `ui/ → game/`
//                          morreu por mudança de ENDEREÇO. O que sobra é `ui/ → educational/`, que é uma
//                          aresta menor e ainda assim uma aresta: o menu conhece UM catálogo. O conserto
//                          verdadeiro é a EdSP entregar o catálogo por injeção — e até lá o gate conta
//                          esta linha, em vez de deixá-la passar por ter mudado de pasta.
//   platform/storage.ts  → every read/write goes through `store.KEYS` (`tabsel`, `fracnot`); no raw localStorage.
// Injected instead of imported, and why:
//   `$` / `getActiveElement` / `enterFullscreen` — the DOM handles, so the node project can drive the whole
//     dispatcher with plain objects (same contract as input/gamepad.ts and ui/settings-*.ts).
//   `srSay`/`srAlert` — core/a11y-sr.ts touches `document` at CALL time; injecting keeps node tests honest.
//   `titleShow` — ui/title.ts's `show()`, already extracted; game.js builds it with its own ctx, so we take the
//     instance rather than a second one.
//   everything else (`cenarios`, `setCenario`, `setModeValue`, `setQuizLevel`, `isMobile`, `fitsN`,
//     `setNumPlayers`, `restartGame`, `setPhase`, `hideTips`) is still game.js's — see ActivitiesMenuCtx.
//
// NOT here (deliberately): ui/title.ts's submenu show/hide, render/title-scene.ts's PIXI backdrop,
// updateTitleLegend (device legend — gamepad slice), the `#title-icons` a11y shortcut row (pause-icons slice;
// it only shares the `#title-overlay` element, never a listener), and setMode()/applyLetra() (HUD toggles).

// `activity`/`setActivityValue` NÃO são mais importados: eles vão para `game/state` (Fase B do plano), e
// este módulo é ENGINE — o gate de fronteira proíbe engine importar de `game/`, e a lista dele esvaziou em
// 2026-08-25. Chegam por injeção, como todo o resto do que é do jogo.
import { getActivity, hasActivity, isValidActivityId, DEFAULT_ACTIVITY_ID, activityCategory,
         type ActivityDef, type ActivityCat } from '../educational/activities-registry.js';
import * as store from '../platform/storage.js';
import { t } from '../core/i18n.js';
import type { TitleMenuId } from './title.js';
import { TITLE_MENU_IDS_ORDERED as TITLE_MENU_ORDER } from './title.js';

// -------------------------------------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------------------------------------

// `GameMode`, `ActivityCat`, `activityCategory` e `modeForCategory` mudaram-se para
// `educational/activities-registry` (ADR-0040). São funções puras sobre o catálogo, e o catálogo mora lá
// desde o ADR-0032 — esta casca só as hospedava. Reexportadas aqui porque o menu é a superfície pública
// delas para quem já as importava; a definição é uma só.
export type { ActivityCat, GameMode } from '../educational/activities-registry.js';
export { activityCategory, modeForCategory } from '../educational/activities-registry.js';
/** The five fraction notations the "Fração" submenu toggles. */
export type FracNotKey = 'v' | 'd' | 'dec' | 'pct' | 'mix';
/** On/off state per notation, stored as 0/1 (game.js persisted numbers, not booleans — kept verbatim). */
export type FracNot = Record<FracNotKey, number>;

/** The 6 directional/confirm flags the title menu reacts to. Single definition in input/edges. */
import type { NavKeys } from '../input/edges.js';
import { passoNoAnel } from './menu-nav.js';
import type { DomQuery } from '../core/dom-query.js';
export type { NavKeys } from '../input/edges.js';

/** One scenario as the "Cenário" submenu needs it — id + display name only (CENARIOS' texture data stays put). */
export interface CenarioOption { readonly id: string; readonly nome: string }

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

export interface ActivitiesMenuCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /** DOM selector (ui/dom.ts `$`) — injected so the node project can hand over fake elements. */
  $: DomQuery;
  /** `document.activeElement`, injected: navTitle needs the focused button and node has no document. */
  getActiveElement: () => Element | null;
  /** Polite screen-reader announcement (core/a11y-sr.ts `srSay`). Injected: it reaches `document` when called. */
  srSay: (text: string) => void;
  /** Assertive announcement (core/a11y-sr.ts `srAlert`) — the three refusals of this menu use it. */
  srAlert: (text: string) => void;
  /** ui/title.ts's `show()` — game.js already owns the initTitle({ $ }) instance; we reuse it, never rebuild it. */
  titleShow: (which: TitleMenuId) => void;
  /** The scenarios of the "Cenário" submenu, in menu order. Source is game.js's CENARIOS, whose other fields
   *  (sky/cloud/hills/decor) are parallax TEXTURE data — that belongs to the render slice, not to a menu. */
  cenarios: readonly CenarioOption[];
  /** Applies the chosen scenario (game.js: validates, persists via core/state, rebuilds the parallax textures). */
  setCenario: (theme: string) => void;
  /** A ATIVIDADE ESCOLHIDA, por injeção. É estado do JOGO (`game/state`), e este módulo é engine — o gate
   *  de fronteira proíbe a importação, então a raiz de composição entrega. */
  getActivityId: () => string;
  setActivityId: (id: string) => void;
  /** game.js's setQuizLevel(n, announce): persists via core/state and refreshes the `.pm-nivel` pause labels.
   *  Stays in game.js because the pause menu — not this menu — owns those labels. */
  setQuizLevel: (n: number, announce: boolean) => void;
  /** Coarse-pointer detection (game.js): on mobile the round is forced to a single screen + fullscreen. */
  isMobile: () => boolean;
  /** "Do N viewports still fit this window?" — game.js's fitsN, which mirrors layout()'s arithmetic. */
  fitsN: (n: number) => boolean;
  /** Rebuilds the player list + viewports for N screens (game.js). Also restarts the round internally. */
  setNumPlayers: (n: number) => void;
  /** Restarts the round in place (game.js) — the branch taken when the screen count did not change. */
  restartGame: () => void;
  /** Phase transition (game.js setPhase, which also shows/hides overlays and the HUD). */
  setPhase: (p: 'title' | 'playing' | 'paused') => void;
  /** Start-hints dismissal (game.js). Today a no-op stub kept for its call sites — see the extraction notes. */
  hideTips: () => void;
  /** Requests fullscreen on the document element (game.js keeps the vendor-prefix try/catch verbatim). */
  enterFullscreen: () => void;
}

export interface ActivitiesMenuApi {
  /** Category of the CURRENT activity ('ludico' when unknown) — read by the quiz/win flow in game.js. */
  actCat: () => ActivityCat;
  /** Validates + commits an activity id: state, quiz level (literacy) and MODE. */
  setActivity: (id: string) => void;
  /** Step 1 of starting: remembers the pick, computes the "Voltar" target, opens the scenario submenu. */
  startActivity: (id: string) => void;
  /** Step 2: commits the pending activity and actually starts the round. */
  reallyStart: () => void;
  /** (Re)writes the markup of the alf/mat/fr/tab/cen submenus. */
  buildTitleMenus: () => void;
  /** The buttons of the ONE visible title submenu, in DOM order. */
  titleButtons: () => HTMLElement[];
  /** Arrow/confirm/back traversal of the visible submenu (keyboard + gamepad). */
  navTitle: (k: NavKeys) => void;
  /** Tabuada numbers, LIVE array — mutated in place (splice/push), never reassigned, exactly as in game.js. */
  readonly tabSel: number[];
  /** Fraction notations, LIVE object — mutated in place, never reassigned (window.__incl reads it). */
  readonly fracNot: FracNot;
  /** Where "Voltar" on the scenario submenu goes right now (the `_cenBack` latch). */
  getCenBack: () => TitleMenuId;
  /** The player count staged on the splash (only reallyStart applies it). */
  getPendingPlayers: () => number;
}

// -------------------------------------------------------------------------------------------------------
// Menu DATA (verbatim from game.js) — plain tables, no behaviour.
// -------------------------------------------------------------------------------------------------------

/** The five literacy levels of the Ferreiro psychogenesis, by number. Domain content (pt-BR) — read by educators. */
export const QL_NAME: Readonly<Record<number, string>> = {
  1: 'pré-silábico', 2: 'silábico', 3: 'silábico-alfabético', 4: 'escritor', 5: 'escritor cego',
};

/** Which literacy activity trains which of the 5 levels — setActivity reuses the psychogenesis ladder. */
export const ALF_LEVEL: Readonly<Record<string, number>> = { alf1: 1, alf2: 2, alf3: 3, alf4: 4, alf5: 5 };

/** One row of the per-screen pause menu. `letra` marks the label that ABC/abc rewrites live. */
export interface PauseBtnDef { readonly act: string; readonly lbl: string; readonly letra?: boolean; readonly nivel?: boolean }

/** The pause menu's items — MENU DATA, so it lives with the other menu tables. The pause slice (ui/pause-icons)
 *  receives it through its own ctx instead of re-declaring it; nobody owns two copies of a list of buttons. */
export const PM_BTNS: readonly PauseBtnDef[] = [
  // 'letra' virou 'caa' (ADR-0028): era um CICLO de duas posições cujo rótulo mudava junto (`letra: true`),
  // e virou a porta de um menu. Sem ciclo não há rótulo dinâmico, então ele volta a ser traduzível como os
  // irmãos — o `letra: true` existia só para o i18n não sobrescrever o ABC/abc que o ciclo escrevia.
  { act: 'resume', lbl: '▶ Continuar' }, { act: 'caa', lbl: '🔠 Comunicação' }, { act: 'tipo', lbl: '🔤 Tipografia' },
  { act: 'addplayer', lbl: '👥 Adicionar jogador' }, { act: 'audio', lbl: '🦻 Acessibilidade auditiva' },
  { act: 'motora', lbl: '♿ Acessibilidade motora' }, { act: 'anim', lbl: '🎞 Sensibilidade visual' },
  { act: 'visual', lbl: '🎨 Acessibilidade visual' }, { act: 'empatia', lbl: '🫂 Modo empatia' },
  { act: 'ajuda', lbl: '❓ Ajuda' }, { act: 'print', lbl: '📷 Print (ver a tela)' }, { act: 'quit', lbl: '🚪 Sair do jogo' },
];

/** i18n KEY of the spoken/aria name of each fraction notation. Keys, not text: a module-level const is
 *  evaluated once at import and would freeze the language at boot (see the note in input/devices). */
export const FNOT_LBL: Readonly<Record<FracNotKey, string>> = {
  v: 'fnot.v', d: 'fnot.d', dec: 'fnot.dec', pct: 'fnot.pct', mix: 'fnot.mix',
};
/** Visible label = the notation ITSELF (x/y), so the five toggles fit side by side; aria-label keeps the word. */
export const FNOT_SYM: Readonly<Record<FracNotKey, string>> = {
  v: `<span class="fv"><b>x</b><b>y</b></span>`, d: 'x/y', dec: 'x,y', pct: 'x%',
  mix: `x<span class="fv"><b>y</b><b>z</b></span>`,
};
/** i18n KEY of the footer text (same style as the pause menu) shown on focus/hover of a notation toggle. */
export const FNOT_DESC: Readonly<Record<FracNotKey, string>> = {
  v: 'fnot.desc.v', d: 'fnot.desc.d', dec: 'fnot.desc.dec', pct: 'fnot.desc.pct', mix: 'fnot.desc.mix',
};

/** The notation keys in menu order — also the defaults' key order (`v` on, rest off). */
export const FNOT_KEYS: readonly FracNotKey[] = ['v', 'd', 'dec', 'pct', 'mix'];

/** Ids of the literacy submenu, in menu order. */
export const ALF_MENU_IDS: readonly string[] = ['alf1', 'alf2', 'alf3', 'alf4', 'alf5'];
/** Ids of the math submenu (the "Fração" button is not an activity — it opens another submenu). */
export const MAT_MENU_IDS: readonly string[] = ['mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6'];
/** Ids of the fractions submenu, in menu order. */
export const FR_MENU_IDS: readonly string[] = ['fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6'];
/** The 6 title submenus, in the order game.js has always scanned them for the visible one. */
// A lista ordenada vem de ui/title, que e a dona dos submenus; aqui so ganha o nome que este modulo e
// seus testes ja usavam. Duas copias mantidas em sincronia por disciplina eram uma a mais.
export { TITLE_MENU_IDS_ORDERED as TITLE_MENU_ORDER } from './title.js';
/** The two rows of the tabuada number picker (0–5 then 6–10). */
export const TAB_ROWS: readonly (readonly number[])[] = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];
/** Default tabuada selection when storage is empty (or holds something unusable). */
export const TAB_SEL_DEFAULT: readonly number[] = [2, 3, 4, 5];

// -------------------------------------------------------------------------------------------------------
// PURE logic — no document, no storage; this is what the node project exercises.
// -------------------------------------------------------------------------------------------------------


/** Unknown/absent id → the default activity. game.js's `if(!hasActivity(id))id=DEFAULT_ACTIVITY_ID`. */
export function normalizeActivityId(id: string): string {
  return hasActivity(id) ? id : DEFAULT_ACTIVITY_ID;
}

/**
 * Where "Voltar" on the scenario submenu must return to — a pure mapping from the activity that opened it:
 * number-picking activities (Tabuada/Divisão) came through `tm-tab`, fraction activities through `tm-fr`,
 * and otherwise the category's own submenu; free play came straight off `tm-main`.
 * VERBATIM caveat: game.js dereferences `getActivity(id)` without a guard, so an unknown id throws here too.
 */
export function cenBackMenuFor(id: string): TitleMenuId {
  const a = getActivity(id) as ActivityDef;
  return a.pick ? 'tm-tab' : a.dens ? 'tm-fr' : a.cat === 'alf' ? 'tm-alf' : a.cat === 'mat' ? 'tm-mat' : 'tm-main';
}

/**
 * Reads the persisted tabuada selection. VERBATIM port, quirks included: the filter is `n>=0 && n<=10`, which
 * JavaScript evaluates after coercion — so `"3"`, `true` and `null` all survive it while `'x'` and `{}` do not.
 * Anything that is not a non-empty array falls back to [2,3,4,5]; an array that filters down to EMPTY stays
 * empty (the "Jogar" button then refuses with an srAlert, which is how game.js has always behaved).
 */
export function sanitizeTabSel(raw: unknown): number[] {
  if (Array.isArray(raw) && raw.length) return (raw as number[]).filter((n) => n >= 0 && n <= 10);
  return [...TAB_SEL_DEFAULT];
}

/**
 * Reads the persisted fraction notations. Defaults `{v:1,d:0,dec:0,pct:0,mix:0}`; only the five known keys are
 * copied over (any extra key in storage is ignored) and each is coerced to 0/1; if the result would leave every
 * notation off, `v` is forced back on — the menu's invariant "at least one notation is always lit".
 */
export function sanitizeFracNot(raw: unknown): FracNot {
  const d: FracNot = { v: 1, d: 0, dec: 0, pct: 0, mix: 0 };
  if (raw && typeof raw === 'object') {
    const s = raw as Record<string, unknown>;
    for (const k of FNOT_KEYS) if (k in s) d[k] = s[k] ? 1 : 0;
  }
  if (!Object.values(d).some((x) => x)) d.v = 1;
  return d;
}

/** How many notations are currently on — the guard behind "Deixe ao menos uma notação ligada." */
export function fracNotOnCount(f: FracNot): number {
  return Object.values(f).filter((x) => x).length;
}

/** True when turning `k` OFF is allowed (it is not the last one lit). */
export function canToggleFracNot(f: FracNot, k: FracNotKey): boolean {
  return !(f[k] && fracNotOnCount(f) <= 1);
}

/** Player count staged on the splash: 1..4, never outside. */
export function clampPendingPlayers(n: number): number {
  return Math.max(1, Math.min(4, n));
}

/**
 * Next focused index for arrow traversal. VERBATIM quirk: when nothing in the submenu has focus (`cur < 0`),
 * BOTH directions land on index 0 — pressing "up" from nowhere does not wrap to the last button.
 *
 * A CONTA DO ANEL saiu daqui e passou a ser `passoNoAnel` (ui/menu-nav), que é a mesma do menu de pausa. Eram
 * duas escritas da mesma volta — `(cur + d + len) % len` aqui, a de lá — e o ADR-0044 §5 pede UMA resposta
 * para "o que acontece no fim da lista" no jogo inteiro. Duas cópias respondem igual até o dia em que uma
 * delas é corrigida sozinha.
 */
export function nextTitleIndex(cur: number, len: number, k: NavKeys): number {
  const d = (k.down || k.right) ? 1 : -1;
  return cur < 0 ? 0 : passoNoAnel(len, cur, d);
}

/** Footer description for a focused/hovered title button: notation text wins, else the activity's `d`.
 *  The notation half resolves its key here; the activity's `d` comes from educational/activities-registry
 *  and is still pt-BR, for the same curriculum-boundary reason as the activity `nome` (ADR-0032). */
export function titleDescFor(actId: string | undefined, fnotKey: string | undefined): string {
  if (fnotKey) { const k = FNOT_DESC[fnotKey as FracNotKey]; return k ? t(k) : ''; }
  return (getActivity(actId ?? '') || ({} as Partial<ActivityDef>)).d || '';
}

// --- HTML builders (pure strings; the DOM layer only assigns them) ---------------------------------------

/** One activity button, with the optional example sub-label (literacy). */
export function activityBtnHtml(id: string): string {
  const a = getActivity(id) as ActivityDef;
  return `<button class="title-btn" data-act-id="${id}" type="button">${a.nome}${a.sub ? `<span class="act-sub">${a.sub}</span>` : ''}</button>`;
}
/** The "Voltar" ghost button of a submenu. */
export function backBtnHtml(to: TitleMenuId): string { return `<button class="title-btn ghost" data-tm-back="${to}" type="button">${t('menu.back')}</button>`; }
/** The live-region footer that shows the focused minigame's description. */
export const TM_DESC_HTML = `<div class="tm-desc" aria-live="polite"></div>`;
/** A submenu heading. O parâmetro chamava-se `t` e sombreava a função de tradução — quarta colisão desse
 *  nome no projeto; recebe o texto JÁ resolvido, e agora se chama `titulo` para dizê-lo. */
export function tmTitleHtml(titulo: string): string { return `<h3 class="tm-title">${titulo}</h3>`; }

export function alfMenuHtml(): string {
  return tmTitleHtml(t('menu.alf')) + ALF_MENU_IDS.map(activityBtnHtml).join('') + backBtnHtml('tm-main') + TM_DESC_HTML;
}
export function matMenuHtml(): string {
  return tmTitleHtml(t('menu.mat')) + MAT_MENU_IDS.map(activityBtnHtml).join('')
    + `<button class="title-btn" data-tm-fr="1" type="button">${t('menu.frac')}</button>` + backBtnHtml('tm-main') + TM_DESC_HTML;
}
export function fracNotsHtml(f: FracNot): string {
  return `<div class="frac-nots" role="group" aria-label="${t('menu.notationGroupAria')}">`
    + FNOT_KEYS.map((k) => `<button class="title-btn tab-num${f[k] ? ' tab-on' : ''}" data-fnot="${k}" type="button" aria-pressed="${!!f[k]}" aria-label="${t(FNOT_LBL[k])}">${FNOT_SYM[k]}</button>`).join('')
    + `</div>`;
}
export function frMenuHtml(f: FracNot): string {
  return tmTitleHtml(t('menu.fracTitle')) + fracNotsHtml(f)
    + FR_MENU_IDS.map(activityBtnHtml).join('') + backBtnHtml('tm-mat') + TM_DESC_HTML;
}
export function tabRowHtml(row: readonly number[], sel: readonly number[]): string {
  return row.map((n) => `<button class="title-btn tab-num${sel.includes(n) ? ' tab-on' : ''}" data-tab-n="${n}" type="button" aria-pressed="${sel.includes(n)}">${n}</button>`).join('');
}
export function tabMenuHtml(sel: readonly number[]): string {
  return tmTitleHtml(t('menu.tab')) + `<div class="game-subtitle">${t('menu.tabHint')}</div>`
    + TAB_ROWS.map((r) => `<div class="tab-row">${tabRowHtml(r, sel)}</div>`).join('')
    + `<button class="title-btn" id="tab-play" type="button">${t('menu.play')}</button>` + backBtnHtml('tm-mat');
}
export function cenMenuHtml(cenarios: readonly CenarioOption[]): string {
  // `c.nome` é a CHAVE do cenário (render/cenario-data); resolve aqui, no ponto de exibição.
  return tmTitleHtml(t('menu.cen')) + cenarios.map((c) => `<button class="title-btn" data-cen="${c.id}" type="button">${t(c.nome)}</button>`).join('')
    + `<button class="title-btn ghost" data-cen-back="1" type="button">${t('menu.back')}</button>`;
}

// -------------------------------------------------------------------------------------------------------
// Abbreviated labels ("A12e" → "Acessibilidade") — hover/focus scrolls the hidden letters open.
// Generic sweep over the option bar (.mode-btn) AND the pause menu (.pm-btn).
// -------------------------------------------------------------------------------------------------------

/** token found in a label → the letters it hides. */
export const ABBR_MID: Readonly<Record<string, string>> = { 'A12e': 'cessibilidad', 'S11e': 'ensibilidad' };

/** The three fixed pieces of an abbreviated label, or null when the label carries no known token. */
export interface AbbrParts { readonly pre: string; readonly hid: string; readonly suf: string }

/** Splits a label around its abbreviation token. `pre` keeps the first letter, `suf` starts at the last one. */
export function abbrParts(txt: string): AbbrParts | null {
  let tok: string | null = null;
  for (const t in ABBR_MID) { if (txt.includes(t)) { tok = t; break; } }
  if (!tok) return null;
  const i = txt.indexOf(tok);
  return { pre: txt.slice(0, i + 1), suf: txt.slice(i + tok.length - 1), hid: ABBR_MID[tok] };
}

/** Label with `k` of the hidden letters revealed; the remaining count stands in for the rest ("A12e" at k=0). */
export function abbrText(p: AbbrParts, k: number): string {
  const N = p.hid.length;
  return p.pre + p.hid.slice(0, k) + ((N - k > 0) ? String(N - k) : '') + p.suf;
}

/**
 * Wires one button's expand/collapse animation. Idempotent (`data-abbrDone`) and a no-op for labels without a
 * token — which, today, is EVERY button in the app: no label in index.html or PM_BTNS contains "A12e"/"S11e"
 * any more (they were spelled out). Ported verbatim rather than deleted; see the extraction report.
 */
export function attachAbbr(b: HTMLElement | null | undefined): void {
  if (!b || b.dataset.abbrDone) return;
  const parts = abbrParts(b.textContent || '');
  if (!parts) return;
  const N = parts.hid.length;
  b.dataset.abbrDone = '1';
  let k = 0, tgt = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  const render = (): void => { b.textContent = abbrText(parts, k); };
  const tick = (): void => { if (k === tgt) { if (timer) clearInterval(timer); timer = null; return; } k += k < tgt ? 1 : -1; render(); };
  const go = (t: number): void => { tgt = t; if (!timer) timer = setInterval(tick, 16); };
  render();
  b.addEventListener('mouseenter', () => go(N)); b.addEventListener('mouseleave', () => go(0));
  b.addEventListener('focus', () => go(N)); b.addEventListener('blur', () => go(0));
}

// -------------------------------------------------------------------------------------------------------
// DOM-facing (thin) — everything below needs the ctx.
// -------------------------------------------------------------------------------------------------------

/** `#title-overlay` carries a re-entrancy latch so the 230ms activation animation cannot be double-fired. */
interface BusyOverlay extends HTMLElement { _busy?: boolean }

export function initActivitiesMenu(ctx: ActivitiesMenuCtx): ActivitiesMenuApi {
  // ACTIVITY arrives from core/state.ts already read from storage; the CATALOG check is ours (state.ts has no
  // opinion about which ids exist), so a value left over from an activity that no longer ships falls back here.
  if (!isValidActivityId(ctx.getActivityId() ?? '')) ctx.setActivityId(DEFAULT_ACTIVITY_ID);

  // Escopo DO JOGO agora (ver os dois escopos em platform/storage); a leitura herda do nome antigo.
  const tabSel: number[] = sanitizeTabSel(store.getJSONComLegado(store.KEYS.tabsel, store.KEYS.tabselLegado, null));
  const fracNot: FracNot = sanitizeFracNot(store.getJSONComLegado(store.KEYS.fracnot, store.KEYS.fracnotLegado, null));

  /**
   * Escreve o rótulo do #np-btn — o VISÍVEL e o do leitor de tela, juntos.
   *
   * Uma função só, e chamada também no INIT, porque era aí que o defeito morava: o texto vinha do
   * index.html em português e a `aria-label` também, e ambos só se corrigiam no PRIMEIRO clique. Numa build
   * em inglês o botão nascia dizendo "Nº de jogadores" e assim ficava para quem não o clicasse.
   *
   * O texto visível deixou de ter um `<span id="np-n">` filho: aquele span existia para o JavaScript trocar
   * só o número, e era ele que impedia o `data-i18n` de funcionar aqui (o `applyDom` escreve `textContent` e
   * o destruiria). Com o rótulo inteiro vindo de `t()`, o span não tem mais função.
   */
  function escreverNp(n: number): void {
    const b = ctx.$<HTMLElement>('#np-btn');
    if (!b) return;
    b.textContent = t('menu.playerCount', { n });
    b.setAttribute('aria-label', t('menu.playerCountAria', { n }));
  }

  let pendingAct = 'ludico';
  let pendingPlayers = 1;
  let cenBack: TitleMenuId = 'tm-main';
  escreverNp(pendingPlayers); // o botão nasce no idioma certo, não no do markup
  let tabFor = 'mat5'; // which "pick numbers" activity the tabuada submenu is currently serving

  function actCat(): ActivityCat { return activityCategory(ctx.getActivityId()); }

  function setActivity(id: string): void {
    id = normalizeActivityId(id);
    ctx.setActivityId(id); // game/state: valor + persistência + evento. A validação continua sendo daqui.
    const cat = (getActivity(id) as ActivityDef).cat;
    if (cat === 'alf') ctx.setQuizLevel(ALF_LEVEL[id], false); // reuses the 5 psychogenesis levels
    // O MODE NÃO É ESCRITO AQUI, e é este apagamento que fecha a issue #54: ele DERIVA de `activity`, que a
    // linha acima acabou de gravar. Enquanto havia dois caminhos de escrita, um deles podia mentir.
  }

  // R-splash 2: after the challenge is chosen, PLAYER 1 picks the SCENARIO (the others get "aguarde").
  function startActivity(id: string): void {
    pendingAct = id;
    cenBack = cenBackMenuFor(id);
    ctx.titleShow('tm-cen'); ctx.srSay(t('sr.menu.pickScenario'));
  }

  function reallyStart(): void {
    const id = pendingAct; setActivity(id);
    if (ctx.isMobile()) { if (pendingPlayers > 1) pendingPlayers = 1; ctx.enterFullscreen(); }
    (ctx.getPlayers() as readonly { alfWins?: number }[]).forEach((p) => { p.alfWins = 0; });
    if (pendingPlayers !== ctx.getNumPlayers()) ctx.setNumPlayers(pendingPlayers); else ctx.restartGame();
    // O NOME da atividade atravessa como parâmetro, ainda em pt-BR: os nomes vivem em
    // educational/activities-registry e são CURRÍCULO — que o pilar 3 manda REESCREVER por idioma, não
    // traduzir (ADR-0032). A moldura — ". Jogo iniciado." — é o que traduz aqui.
    ctx.setPhase('playing'); ctx.hideTips(); ctx.srSay(t('sr.menu.gameStarted', { atividade: (getActivity(id) as ActivityDef).nome }));
  }

  function buildTitleMenus(): void {
    const alf = ctx.$<HTMLElement>('#tm-alf'); if (alf) alf.innerHTML = alfMenuHtml();
    const mat = ctx.$<HTMLElement>('#tm-mat'); if (mat) mat.innerHTML = matMenuHtml();
    const fr = ctx.$<HTMLElement>('#tm-fr'); if (fr) fr.innerHTML = frMenuHtml(fracNot);
    const tab = ctx.$<HTMLElement>('#tm-tab'); if (tab) tab.innerHTML = tabMenuHtml(tabSel);
    const cen = ctx.$<HTMLElement>('#tm-cen'); if (cen) cen.innerHTML = cenMenuHtml(ctx.cenarios);
  }

  /** Buttons of the ONE submenu that is currently visible (the others carry `hidden`). */
  function titleButtons(): HTMLElement[] {
    const m = TITLE_MENU_ORDER.map((id) => ctx.$<HTMLElement>('#' + id)).find((el) => el && !el.hidden);
    return m ? [...m.querySelectorAll<HTMLElement>('button')] : [];
  }

  /**
   * O botão "Voltar" desta tela, seja qual for o atributo que o marca.
   *
   * São DOIS atributos porque os alvos são de naturezas diferentes: cinco telas voltam para um destino FIXO
   * (`data-tm-back="tm-main"`), e a de cenário volta para a tela de onde se veio, calculada em `cenBackMenuFor`
   * — daí `data-cen-back`, sem valor. A distinção é legítima; o defeito era `navTitle` conhecer só a primeira.
   *
   * O EFEITO ERA ESTE: na tela de cenário — a última antes do jogo começar, por onde passa TODA partida — o
   * botão Voltar do controle não fazia nada. Quem usa mouse ou toque vê e clica o "Voltar" que está ali; quem
   * depende do controle só conseguia ir para a frente, para dentro de um jogo. É a GAG A1 (menu navegável por
   * controle) quebrada na única tela que ninguém consegue evitar.
   */
  const isBackButton = (b: HTMLElement): boolean => b.dataset.tmBack != null || b.dataset.cenBack != null;

  function navTitle(k: NavKeys): void {
    const bs = titleButtons(); if (!bs.length) return;
    const i = bs.indexOf(ctx.getActiveElement() as HTMLElement);
    if (k.up || k.down || k.left || k.right) {
      const n = nextTitleIndex(i, bs.length, k);
      bs[n].focus(); ctx.srSay(bs[n].textContent || '');
    } else if (k.yes) { (i < 0 ? bs[0] : bs[i]).click(); }
    else if (k.no) { const back = bs.find(isBackButton); if (back) back.click(); }
  }

  // --- wiring -------------------------------------------------------------------------------------------
  const ov = ctx.$<BusyOverlay>('#title-overlay');
  if (!ov) {
    // No splash in this document: game.js's titleSetup() bailed out the same way, WITHOUT building the menus.
    return { actCat, setActivity, startActivity, reallyStart, buildTitleMenus, titleButtons, navTitle, tabSel, fracNot, getCenBack: () => cenBack, getPendingPlayers: () => pendingPlayers };
  }
  buildTitleMenus();

  // Player-count selector by KEYBOARD: ←/→ on the single button means −1/+1 (a click uses the half you hit).
  ov.addEventListener('keydown', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('#np-btn'); if (!b) return;
    const ke = e as KeyboardEvent;
    if (ke.key === 'ArrowLeft' || ke.key === 'ArrowRight') { ke.preventDefault(); b.dataset.np = ke.key === 'ArrowLeft' ? '-1' : '1'; b.click(); }
  });

  // Footer (same style as the pause menu): the focused/hovered minigame's or notation's description.
  const showDesc = (e: Event): void => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('button[data-act-id],button[data-fnot]'); if (!b) return;
    const d = titleDescFor(b.dataset.actId, b.dataset.fnot);
    const box = b.closest('.title-menu'); const el = box && box.querySelector('.tm-desc');
    if (el) el.textContent = d;
  };
  ov.addEventListener('focusin', showDesc); ov.addEventListener('mouseover', showDesc);

  ov.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest<HTMLElement>('button'); if (!b) return;
    if (b.classList.contains('title-btn')) { b.classList.remove('act-fx'); void b.offsetWidth; b.classList.add('act-fx'); } // ACTIVATION effect
    const go = (fn: () => void): void => { if (ov._busy) return; ov._busy = true; setTimeout(() => { ov._busy = false; fn(); }, 230); }; // the animation plays BEFORE the screen changes
    if (b.id === 'np-btn') { // ONE button "◀ Nº de jogadores: X ▶": the side you clicked (or ←/→) decides +1 / −1
      let d = +(b.dataset.np || 0); b.dataset.np = ''; // ←/→ set data-np on keydown; a click uses the position
      if (!d) { const r = b.getBoundingClientRect(); d = ((e as MouseEvent).clientX - r.left) < r.width / 2 ? -1 : 1; }
      const n = clampPendingPlayers(pendingPlayers + d);
      // MESMO evento que game/session anuncia, e a frase divergia: esta omitia o mínimo de 640×360. Passa a
      // usar a chave já unificada, em vez de virar uma terceira redação da mesma recusa.
      if (n > 1 && !ctx.fitsN(n)) { ctx.srAlert(t('sr.screens.wontFitN', { n })); return; }
      pendingPlayers = n; escreverNp(n);
      ctx.srSay(t(n > 1 ? 'sr.menu.playersN' : 'sr.menu.player1', { n })); return;
    }
    if (b.dataset.tmFr) { go(() => { ctx.titleShow('tm-fr'); ctx.srSay(t('sr.menu.fractionsIntro')); }); return; }
    if (b.dataset.fnot) { const k = b.dataset.fnot as FracNotKey; // NOTATION toggle (immediate; at least 1 ALWAYS on)
      if (!canToggleFracNot(fracNot, k)) { ctx.srAlert(t('sr.menu.keepOneNotation')); return; }
      fracNot[k] = fracNot[k] ? 0 : 1; store.setJSON(store.KEYS.fracnot, fracNot);
      b.classList.toggle('tab-on', !!fracNot[k]); b.setAttribute('aria-pressed', String(!!fracNot[k])); // state by highlight, NO ✔
      ctx.srSay(t(fracNot[k] ? 'sr.menu.notationOn' : 'sr.menu.notationOff', { notacao: t(FNOT_LBL[k]) })); return;
    }
    if (b.dataset.cen) { const c = b.dataset.cen; go(() => { ctx.setCenario(c); reallyStart(); }); return; }
    if (b.dataset.cenBack) { go(() => ctx.titleShow(cenBack)); return; }
    if (b.dataset.tm === 'ludico') { go(() => startActivity('ludico')); return; }
    if (b.dataset.tm === 'alf') { go(() => ctx.titleShow('tm-alf')); return; }
    if (b.dataset.tm === 'mat') { go(() => ctx.titleShow('tm-mat')); return; }
    if (b.dataset.tmBack) { const to = b.dataset.tmBack as TitleMenuId; go(() => ctx.titleShow(to)); return; }
    if (b.id === 'tab-play') { if (!tabSel.length) { ctx.srAlert(t('sr.menu.pickOneNumber')); return; } go(() => startActivity(tabFor)); return; }
    if (b.dataset.tabN != null) { const n = +b.dataset.tabN, i = tabSel.indexOf(n); // toggle: no screen change → immediate
      if (i >= 0) tabSel.splice(i, 1); else tabSel.push(n);
      store.setJSON(store.KEYS.tabsel, tabSel);
      b.classList.toggle('tab-on', i < 0); b.setAttribute('aria-pressed', String(i < 0));
      ctx.srSay(t(i < 0 ? 'sr.menu.numberOn' : 'sr.menu.numberOff', { n })); return;
    }
    if (b.dataset.actId) { const id = b.dataset.actId;
      if ((getActivity(id) as ActivityDef).pick) {
        go(() => { tabFor = id; buildTitleMenus();
          const titulo = ctx.$('#tm-tab .tm-title'); if (titulo) titulo.textContent = (getActivity(id) as ActivityDef).nome; // Tabuada/Divisão heading
          ctx.titleShow('tm-tab'); ctx.srSay(t('sr.menu.pickNumbers', { atividade: (getActivity(id) as ActivityDef).nome })); });
      } else go(() => startActivity(id));
    }
  });

  return {
    actCat, setActivity, startActivity, reallyStart, buildTitleMenus, titleButtons, navTitle,
    tabSel, fracNot, getCenBack: () => cenBack, getPendingPlayers: () => pendingPlayers,
  };
}
