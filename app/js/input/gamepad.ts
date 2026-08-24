// SPDX-License-Identifier: GPL-3.0-or-later
// input/gamepad.ts — gamepad READING (stdDirs/padActions/bindActive/padMapFor) + the poll dispatcher
// (pollPads) + the accessibility MAPPING WIZARD (openPadWiz/openPadWizFor/closePadWiz/padWizTick). Pure
// button->action logic is separated from the DI runtime (initGamepad(ctx)): the Gamepad API is injected
// (ctx.getGamepads, so tests feed a fake pad with no browser) and every cross-subsystem call (menu nav, quiz,
// join/respawn, phase, overlays) is injected too — never reaches `document`/`navigator` or imports game.js.
// Boundary: this module only READS buttons/axes and maps them to actions; the physical button ARTWORK/labels
// (PAD_DESIGNS) and the on-screen touch pad are input/devices.ts + input/touch (a parallel extraction) — not here.

import { t } from '../core/i18n.js';
import { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
import type { Phase } from '../core/state.js';
import { padCur, padPrevAct, padPrevStart, PAD_DEAD } from './state.js';
import * as store from '../platform/storage.js';

// ---------------------------------------------------------------------------------------------
// Gamepad API surface (minimal, adapter-friendly — mirrors the real Gamepad/GamepadButton shape)
// ---------------------------------------------------------------------------------------------

export interface PadButtonLike { pressed: boolean; }
export interface PadLike {
  id: string;
  index: number;
  mapping: string; // 'standard' (XInput) | '' (DirectInput/other)
  buttons: readonly (PadButtonLike | null | undefined)[];
  axes: readonly number[];
}
/** Adapter for `navigator.getGamepads()` — the DI point that lets tests feed a fake pad without a browser. */
export type GetGamepads = () => readonly (PadLike | null | undefined)[] | null | undefined;

export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

// ---------------------------------------------------------------------------------------------
// Action mapping (button/axis -> game action)
// ---------------------------------------------------------------------------------------------

/** One binding captured by the wizard: a digital button, a signed analog threshold, or an exact hat/POV value.
 *  Loosely-shaped (all fields optional) rather than a strict union: bindings round-trip through JSON in
 *  localStorage, so `bindActive` must stay defensive against malformed/partial saved data, same as the original. */
export interface PadBinding { b?: number; ax?: number; s?: number; av?: number; v?: number; }
/** action -> binding, keyed by the 9 wizard steps (left/right/up/down/jump/run/swap/especial/start), PLUS the
 *  `_skip: true` sentinel meaning "user cancelled the wizard for this model — use the default mapping, don't
 *  ask again this session" (not persisted). A flat index signature (not `Partial<Record<..>> & {_skip}`) so the
 *  boolean `_skip` and the PadBinding action values can coexist under TS's index-signature rule; `bindingAt`
 *  narrows a lookup back down to a PadBinding for `bindActive`. */
export type PadMap = Record<string, PadBinding | boolean | undefined>;
function bindingAt(map: PadMap, key: string): PadBinding | undefined {
  const v = map[key];
  return typeof v === 'object' && v !== null ? v : undefined;
}

export type ActionKey = 'left' | 'right' | 'up' | 'down' | 'jump' | 'run' | 'swap' | 'especial';
export interface Dirs { left: boolean; right: boolean; up: boolean; down: boolean; }
export interface PadActions extends Dirs {
  [key: string]: boolean; // torna PadActions atribuível a PadState (input/state.ts's Record<string,boolean>)
  jump: boolean; run: boolean; swap: boolean; especial: boolean;
  _start: boolean; // pulo OU start (fecha diálogos/telas de vitória)
  _pause: boolean; // só start (pausa/retoma)
}

// [axisValue, up, down, left, right] — os 8 passos de um D-pad "POV hat" (eixo alto do DirectInput), repouso ~1.286.
const HAT_STEPS: readonly [number, 0 | 1, 0 | 1, 0 | 1, 0 | 1][] = [
  [-1, 1, 0, 0, 0], [-0.7143, 1, 0, 0, 1], [-0.4286, 0, 0, 0, 1], [-0.1429, 0, 1, 0, 1],
  [0.1429, 0, 1, 0, 0], [0.4286, 0, 1, 1, 0], [0.7143, 0, 0, 1, 0], [1, 1, 0, 1, 0],
];

/** Direções pelas FONTES PADRÃO: stick 0/1 (zona morta PAD_DEAD), D-pad 12-15, e o "hat" nos eixos >=6 (POV do
 *  DirectInput). Controles com os dois direcionais mapeados ficam com ambos vivos (dedo no stick não mata o D-pad). */
export function stdDirs(gp: PadLike): Dirs {
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const ax = (i: number): number => gp.axes[i] || 0;
  const d: Dirs = { left: ax(0) < -PAD_DEAD || b(14), right: ax(0) > PAD_DEAD || b(15), up: ax(1) < -PAD_DEAD || b(12), down: ax(1) > PAD_DEAD || b(13) };
  for (let i = 6; i < gp.axes.length; i++) {
    const v = gp.axes[i];
    if (typeof v !== 'number' || Math.abs(v) > 1.001) continue; // fora do repouso do hat
    for (const [hv, u, dn, l, r] of HAT_STEPS) {
      if (Math.abs(v - hv) <= 0.09) { if (u) d.up = true; if (dn) d.down = true; if (l) d.left = true; if (r) d.right = true; break; }
    }
  }
  return d;
}

/** Está o binding `bd` ativo agora neste gamepad? Digital = pressed; analógico ({ax,s}) = limiar por sinal
 *  (metade do curso); hat ({av,v}) = valor exato do passo (±0.13 — os 8 passos distam ~0.286). */
export function bindActive(gp: PadLike, bd: PadBinding | null | undefined): boolean {
  if (!bd) return false;
  if (bd.b != null) return !!(gp.buttons[bd.b] && gp.buttons[bd.b]!.pressed);
  if (bd.ax != null) return ((gp.axes[bd.ax] || 0) * (bd.s ?? 0)) > 0.5;
  if (bd.av != null) return Math.abs((gp.axes[bd.av] || 0) - (bd.v ?? 0)) <= 0.13;
  return false;
}

/** Ações do frame para este gamepad. `custom` = mapa salvo pelo wizard para este `gp.id` (null/`_skip` = usa o
 *  mapa PADRÃO da Gamepad API "standard": 0=pulo · 1=especial · 2/5/7=correr · 3=troca · 9=START). Direções
 *  custom caem de volta em stdDirs quando o binding do usuário não está ativo (D-pad/stick continuam vivos). */
export function padActions(gp: PadLike, custom: PadMap | null): PadActions {
  if (custom && !custom._skip) {
    const A = (k: string): boolean => bindActive(gp, bindingAt(custom, k));
    const sd = stdDirs(gp);
    return {
      left: A('left') || sd.left, right: A('right') || sd.right, up: A('up') || sd.up, down: A('down') || sd.down,
      jump: A('jump'), run: A('run'), swap: A('swap'), especial: A('especial'), _start: A('jump') || A('start'), _pause: A('start'),
    };
  }
  const b = (i: number): boolean => !!(gp.buttons[i] && gp.buttons[i]!.pressed);
  const sd = stdDirs(gp);
  return {
    left: sd.left, right: sd.right, up: sd.up, down: sd.down,
    jump: b(0), run: b(2) || b(5) || b(7), swap: b(3), especial: b(1), _start: b(0) || b(9), _pause: b(9),
  };
}

// ---------------------------------------------------------------------------------------------
// Wizard data (steps + demo animation, verbatim from game.js's PADWIZ_STEPS/PADWIZ_ANIM)
// ---------------------------------------------------------------------------------------------

/** [ação, rótulo pt-BR] na ordem em que o wizard pergunta — 9 passos (8 ações + START/pausa). */
export const PADWIZ_STEPS: readonly [string, string][] = [
  ['up', 'CIMA'], ['down', 'BAIXO'], ['left', 'ESQUERDA'], ['right', 'DIREITA'], ['jump', 'PULAR'],
  ['run', 'CORRER / INTERAGIR'], ['swap', 'TROCAR PODER'], ['especial', 'ESPECIAL'], ['start', 'START (pausa)'],
];

export interface WizAnimDef { seq?: string[]; hold?: number; cls: string; fx?: string; noimg?: number; flip?: number; }
/** Demonstração animada de cada ação (frames reais do jogo) mostrada durante o passo correspondente do wizard. */
export const PADWIZ_ANIM: Record<string, WizAnimDef> = {
  up: { seq: ['escada/0', 'escada/1'], hold: 9, cls: 'pw-up' },
  down: { seq: ['escada/1', 'escada/0'], hold: 9, cls: 'pw-down' },
  left: { seq: ['andar/0', 'andar/1', 'andar/2', 'andar/3', 'andar/4', 'andar/5', 'andar/6', 'andar/7'], hold: 4, cls: 'pw-left', flip: 1 },
  right: { seq: ['andar/0', 'andar/1', 'andar/2', 'andar/3', 'andar/4', 'andar/5', 'andar/6', 'andar/7'], hold: 4, cls: 'pw-right' },
  jump: { seq: ['pulo/0', 'pulo/0', 'pulo/1', 'pulo/1'], hold: 7, cls: 'pw-jump' },
  run: { seq: ['correr/0', 'correr/1', 'correr/2', 'correr/3'], hold: 3, cls: 'pw-run' },
  swap: { fx: '👟 🕷️ 🎈 🐇 🦘', cls: 'pw-swap', noimg: 1 },
  especial: { seq: ['idle/0', 'idle/1', 'idle/2', 'idle/3'], hold: 8, fx: '✨', cls: 'pw-especial' },
  start: { fx: 'PAUSA', cls: 'pw-start', noimg: 1 },
};

interface WizBase { b: boolean[]; a: number[]; }
interface WizAxTrack { i: number; v: number; last: number; changes: number; ticks: number; }
/** Estado do wizard em andamento; `null` = fechado. Espelha o `padWiz` do game.js. */
export interface WizState {
  gi: number; // índice do gamepad sendo mapeado (-1 = ainda não identificado)
  id: string;
  step: number; // índice em PADWIZ_STEPS (-1 = ainda esperando baseWait terminar)
  base: WizBase | null; // snapshot de repouso (tudo solto) capturado após baseWait
  map: PadMap;
  release: boolean; // esperando o botão do passo anterior ser SOLTO antes de perguntar o próximo
  baseWait: boolean; // esperando TUDO ser solto para capturar o snapshot de repouso
  axTrack: WizAxTrack | null; // eixo em classificação (~240ms): analógico (varia) vs D-pad/hat (salta e trava)
  timer: ReturnType<typeof setInterval> | null;
}

// ---------------------------------------------------------------------------------------------
// DI runtime — pollPads (dispatcher) + o wizard. Nada aqui toca `document`/`navigator` diretamente.
// ---------------------------------------------------------------------------------------------

export type NavKeys = { yes: boolean; no: boolean; up: boolean; down: boolean; left: boolean; right: boolean };

/** Forma mínima de jogador que este módulo lê/escreve (core/state.ts's `players` carrega muito mais). */
export interface GamepadPlayer {
  pad: number;
  quit: boolean;
  waiting?: boolean;
  quiz?: { kind: string } | null;
  easy: boolean;
  jumpEdge: boolean;
  runEdge: boolean;
  leftEdge: boolean;
  rightEdge: boolean;
  swapEdge: boolean;
  specialEdge: boolean;
}

export interface GamepadCtx {
  /** Adaptador da Gamepad API (substitui `navigator.getGamepads()`) — o ponto de DI para testar sem browser. */
  getGamepads: GetGamepads;
  /** Seletor DOM (querySelector), injetado — nunca alcança `document` global. */
  $: DomQuery;
  /** Anúncios de leitor de tela (core/a11y-sr), injetados. */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;
  /** Traz um overlay para frente + preenche o texto de ajuda (game.js's frontOverlay, compartilhado por todo overlay). */
  frontOverlay: (el: Element | null) => void;
  /** Fase atual e sua troca (game.js's setPhase: some o toque, muda o mudo do áudio, foca a região certa...). */
  getPhase: () => Phase;
  setPhase: (p: Phase) => void;
  /** Modo demonstração (attract) — game.js's attractCtl. */
  isAttractActive: () => boolean;
  stopAttract: () => void;
  /** Controles virtuais de toque — somem no primeiro input físico. */
  isTouchMode: () => boolean;
  hideTouchControls: () => void;
  /** Estado vivo de jogadores/telas (core/state.ts, injetado como getter — nunca cacheado por este módulo). */
  getPlayers: () => GamepadPlayer[];
  getNumPlayers: () => number;
  /** Navegação de menus (game.js): título, diálogo compartilhado (o de cima), e a pausa por tela. */
  navTitle: (k: NavKeys) => void;
  sharedDialogOpen: () => Element | null;
  navDialog: (dlg: Element, k: NavKeys) => void;
  getPauseMenu: (playerIndex: number) => { hidden: boolean } | null | undefined;
  navPause: (menu: { hidden: boolean }, playerIndex: number, k: NavKeys) => void;
  /** Qual jogador abre o submenu de a11y em seguida (game.js's `pauseActor`). */
  setPauseActor: (playerIndex: number) => void;
  /** Navegação do quiz do PRÓPRIO jogador (game.js). */
  quizMove: (p: GamepadPlayer, delta: number) => void;
  quizConfirm: (p: GamepadPlayer) => void;
  quizErase: (p: GamepadPlayer) => void;
  announceBraille: (p: GamepadPlayer) => void;
  /** Entra num jogo em andamento com uma tela nova (game.js's joinPlayer). */
  joinPlayer: (padIndex: number) => boolean;
  /** Recomeça só a tela deste jogador (game.js's respawnPlayer). */
  respawnPlayer: (playerIndex: number) => void;
  /** Remove o selo "aguardando" da tela quando ela ganha um controle (parte do HUD, game.js). */
  clearWaitingBadge: (playerIndex: number) => void;
  /**
   * Caminho-base dos sprites usado pela demo animada do wizard. NOTA — bug encontrado, não corrigido: o
   * game.js original referencia um identificador `SPR` que NUNCA é declarado/importado ali (só existe, sem
   * export, em render/sprites.ts) — `padWizDemo`/`padWizDemoTick` lançam ReferenceError em runtime assim que
   * o wizard mostra qualquer demonstração animada (inclusive ao abrir: `padWizDemo(null)` já cai no ramo que lê
   * `SPR`). Fica como dependência EXPLÍCITA aqui em vez de reproduzir o global inexistente — ver retorno da tarefa.
   */
  spriteBase: string;
}

export interface GamepadApi {
  pollPads(): void;
  openPadWiz(): void;
  openPadWizFor(gp: PadLike): void;
  closePadWiz(save: boolean): void;
  padWizTick(): void;
  padMapFor(id: string): PadMap | null;
  /** Estado vivo do wizard (para expor via `get padWiz(){}` no window.__incl, como o game.js original). */
  getPadWiz(): WizState | null;
}

export function initGamepad(ctx: GamepadCtx): GamepadApi {
  const _padMaps = new Map<string, PadMap | null>(); // cache id -> mapa custom (evita reparsear JSON a cada frame)
  let padWiz: WizState | null = null;
  let padWizAutoResume = false; // wizard aberto automaticamente no meio do jogo -> retoma a fase ao fechar
  let padWizAnim: { seq: string[]; hold: number; t: number } | null = null;

  function padMapFor(id: string): PadMap | null {
    if (!_padMaps.has(id)) _padMaps.set(id, store.getJSON<PadMap>('incl_padmap_' + id, null));
    return _padMaps.get(id) ?? null;
  }
  function actionsFor(gp: PadLike): PadActions { return padActions(gp, padMapFor(gp.id)); }

  // ----- wizard: anúncio + demo animada (DOM-facing, thin) -----

  function wizSay(t: string): void {
    const el = ctx.$<HTMLElement>('#padwiz-prompt');
    if (el) el.textContent = t;
    ctx.srSay(t);
  }

  function wizDemo(k: string | null): void {
    const d = ctx.$<HTMLElement>('#padwiz-demo');
    const img = ctx.$<HTMLImageElement>('#padwiz-demo-img');
    const fx = ctx.$<HTMLElement>('#padwiz-demo-fx');
    if (!d) return;
    const a = k ? PADWIZ_ANIM[k] : null;
    d.className = a ? a.cls : '';
    padWizAnim = null;
    if (fx) fx.textContent = (a && a.fx) || '';
    if (img) {
      img.style.display = a && a.noimg ? 'none' : '';
      img.style.transform = a && a.flip ? 'scaleX(-1)' : '';
      if (a && a.seq) { img.src = ctx.spriteBase + a.seq[0] + '.png'; padWizAnim = { seq: a.seq, hold: a.hold || 6, t: 0 }; }
      else if (!a) img.src = ctx.spriteBase + 'idle/0.png';
    }
  }
  function wizDemoTick(): void {
    if (!padWizAnim) return;
    const a = padWizAnim; a.t++;
    const img = ctx.$<HTMLImageElement>('#padwiz-demo-img');
    if (img) img.src = ctx.spriteBase + a.seq[Math.floor(a.t / a.hold) % a.seq.length] + '.png';
  }
  function wizPrompt(): void {
    if (!padWiz) return;
    const s = PADWIZ_STEPS[padWiz.step];
    wizSay((padWiz.step + 1) + ' de ' + PADWIZ_STEPS.length + ' — aperte: ' + s[1]);
    wizDemo(s[0]); // demonstração animada do que a ação FAZ
    const pr = ctx.$<HTMLElement>('#padwiz-progress');
    if (pr) pr.textContent = 'Mapeados: ' + (Object.keys(padWiz.map).join(' · ') || '—');
  }
  function wizBind(bd: PadBinding): void {
    if (!padWiz) return;
    padWiz.map[PADWIZ_STEPS[padWiz.step][0]] = bd;
    padWiz.step++;
    padWiz.release = true; // exige soltar antes do próximo passo (mesmo botão segurado não dobra pro passo seguinte)
    if (padWiz.step >= PADWIZ_STEPS.length) closePadWiz(true);
  }

  // ----- wizard: abrir/fechar -----

  function openPadWiz(): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    padWiz = { gi: -1, id: '', step: -1, base: null, map: {}, release: false, baseWait: false, axTrack: null, timer: null };
    wizSay('Aperte QUALQUER botão no controle que deseja mapear.'); wizDemo(null);
    const pr = ctx.$<HTMLElement>('#padwiz-progress'); if (pr) pr.textContent = '';
    padWiz.timer = setInterval(padWizTick, 30);
  }
  // Wizard aberto AUTOMATICAMENTE (controle DirectInput sem mapa apertou algo): já sabemos qual controle é.
  function openPadWizFor(gp: PadLike): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    padWiz = { gi: gp.index, id: gp.id, step: -1, base: null, map: {}, release: false, baseWait: true, axTrack: null, timer: null };
    wizSay('Controle novo detectado: ' + gp.id + '. O jogo pausou para você configurá-lo. SOLTE tudo para começar.'); wizDemo(null);
    const pr = ctx.$<HTMLElement>('#padwiz-progress'); if (pr) pr.textContent = '';
    padWiz.timer = setInterval(padWizTick, 30);
  }
  function closePadWiz(save: boolean): void {
    if (!padWiz) return;
    if (padWiz.timer != null) clearInterval(padWiz.timer);
    if (save && padWiz.id) {
      store.setJSON('incl_padmap_' + padWiz.id, padWiz.map);
      _padMaps.set(padWiz.id, padWiz.map);
      ctx.srAlert(t('sr.pad.mapSaved', { id: padWiz.id }));
    } else if (padWiz.id && !_padMaps.get(padWiz.id)) {
      _padMaps.set(padWiz.id, { _skip: true }); // cancelou: usa o mapa PADRÃO nesta sessão (não persiste, evita reabrir em loop)
    }
    const gi = padWiz.gi;
    padWiz = null;
    const ov = ctx.$<HTMLElement>('#padwiz'); if (ov) ov.hidden = true;
    // sem edges fantasmas: o botão ainda SEGURADO do último passo (START) não pode pausar/agir ao retomar
    try {
      const pads = ctx.getGamepads() ?? [];
      const gp = pads[gi];
      if (gp) { const c = actionsFor(gp); padCur[gi] = c; padPrevAct[gi] = c; padPrevStart[gi] = c._start; }
    } catch { /* espelha o try/catch silencioso do original */ }
    if (padWizAutoResume) { padWizAutoResume = false; if (ctx.getPhase() === 'paused') ctx.setPhase('playing'); }
  }

  // ----- wizard: tick (roda a cada 30ms enquanto aberto) -----

  function padWizTick(): void {
    if (!padWiz) return;
    wizDemoTick();
    const pads = ctx.getGamepads() ?? [];
    if (padWiz.gi < 0) {
      for (const gp of pads) {
        if (gp && gp.buttons.some((b) => b && b.pressed)) {
          padWiz.gi = gp.index; padWiz.id = gp.id; padWiz.baseWait = true;
          wizSay('Controle: ' + gp.id + '. Agora SOLTE tudo.');
          break;
        }
      }
      return;
    }
    const gp = pads[padWiz.gi];
    if (!gp) return; // controle desconectado (ou índice ainda não populado): congela até voltar
    if (padWiz.baseWait) {
      if (!gp.buttons.some((b) => b && b.pressed)) {
        padWiz.baseWait = false;
        padWiz.base = { b: gp.buttons.map((x) => !!(x && x.pressed)), a: gp.axes.slice() };
        padWiz.step = 0;
        wizPrompt();
      }
      return;
    }
    const base = padWiz.base!;
    if (padWiz.release) {
      const idle = !gp.buttons.some((b, i) => b && b.pressed && !base.b[i]) && gp.axes.every((v, i) => Math.abs((v || 0) - base.a[i]) < 0.35);
      if (idle) { padWiz.release = false; wizPrompt(); }
      return;
    }
    // eixo em rastreio (~240ms): classifica pelo COMPORTAMENTO — varia continuamente = analógico (limiar por
    // sinal); salta e FICA CONSTANTE = D-pad/POV hat (valor exato, ±0.13).
    if (padWiz.axTrack) {
      const t = padWiz.axTrack; const v = gp.axes[t.i] || 0;
      if (Math.abs(v - t.last) > 0.03) t.changes++;
      t.last = v;
      if (Math.abs(v - base.a[t.i]) > Math.abs(t.v - base.a[t.i])) t.v = v;
      if (++t.ticks >= 8) {
        const pv = t.v; padWiz.axTrack = null;
        wizBind(t.changes >= 2 ? { ax: t.i, s: pv > 0 ? 1 : -1 } : { av: t.i, v: Math.round(pv * 10000) / 10000 });
      }
      return;
    }
    for (let i = 0; i < gp.buttons.length; i++) {
      if (gp.buttons[i] && gp.buttons[i]!.pressed && !base.b[i]) { wizBind({ b: i }); return; }
    }
    for (let i = 0; i < gp.axes.length; i++) {
      const v = gp.axes[i] || 0;
      if (Math.abs(v - base.a[i]) > 0.45) { padWiz.axTrack = { i, v, last: v, changes: 0, ticks: 0 }; return; }
    }
  }

  const cancelBtn = ctx.$<HTMLButtonElement>('#padwiz-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closePadWiz(false));

  // ----- poll (chamado a cada frame do loop) -----

  function pollPads(): void {
    if (padWiz) return; // durante o wizard, os pads falam só com ele
    const pads = ctx.getGamepads();
    if (!pads) return;
    if (ctx.isAttractActive()) {
      for (const gp of pads) { if (gp && gp.buttons.some((b) => b && b.pressed)) { ctx.stopAttract(); return; } } // botão de pad encerra a demo
      return;
    }
    for (const gp of pads) {
      if (!gp) continue;
      const gi = gp.index;
      // controle fora do padrão (DirectInput) SEM mapa salvo apertou algo -> pausa geral + wizard direto
      if (gp.mapping !== 'standard' && !padMapFor(gp.id) && gp.buttons.some((b) => b && b.pressed)) {
        padWizAutoResume = ctx.getPhase() === 'playing';
        if (ctx.getPhase() === 'playing') ctx.setPhase('paused');
        openPadWizFor(gp);
        return;
      }
      const cur = actionsFor(gp);
      const prev = padPrevAct[gi] || {};
      if (ctx.isTouchMode() && (cur.left || cur.right || cur.up || cur.down || cur.jump || cur.run || cur.swap || cur.especial || cur._start)) {
        ctx.hideTouchControls(); // botão físico usado -> some o gamepad virtual (mesma regra do teclado)
      }
      const startEdge = cur._start && !padPrevStart[gi]; padPrevStart[gi] = cur._start;
      const pauseEdge = cur._pause && !prev._pause;
      const edge = (k: ActionKey): boolean => cur[k] && !prev[k];
      padCur[gi] = cur; padPrevAct[gi] = cur;

      const winOv = ctx.$<HTMLElement & { hidden: boolean }>('#win-overlay');
      if (winOv && !winOv.hidden) { // Vitória: START/pulo fecham o modal (Jogar de novo)
        if (startEdge) { const b = ctx.$<HTMLElement>('#btn-again'); if (b) b.click(); }
        continue;
      }

      const phase = ctx.getPhase();
      const players = ctx.getPlayers();

      if (phase === 'title') {
        const k: NavKeys = { yes: edge('jump') || startEdge, no: edge('especial'), up: edge('up'), down: edge('down'), left: edge('left'), right: edge('right') };
        const any = k.yes || k.no || k.up || k.down || k.left || k.right;
        const owner = players.findIndex((p) => p.pad === gi);
        if (ctx.getNumPlayers() > 1 && owner > 0) { if (any) ctx.srSay(t('sr.title.waitP1')); continue; } // só o J1 escolhe
        if (any) ctx.navTitle(k); // menu inicial navegável pelo pad
        continue;
      }
      if (phase === 'paused') {
        const owner = players.findIndex((p) => p.pad === gi); const pi = owner < 0 ? 0 : owner;
        if (pauseEdge) { ctx.setPhase('playing'); continue; } // START retoma
        const k: NavKeys = { yes: edge('jump'), no: edge('especial'), up: edge('up'), down: edge('down'), left: edge('left'), right: edge('right') };
        if (k.yes || k.no || k.up || k.down || k.left || k.right) {
          const dlg = ctx.sharedDialogOpen();
          if (dlg) ctx.navDialog(dlg, k);
          else { const menu = ctx.getPauseMenu(pi); if (menu && !menu.hidden) ctx.navPause(menu, pi, k); }
        }
        continue;
      }
      if (phase === 'playing') {
        const owner = players.findIndex((p) => p.pad === gi);
        if (owner < 0) { // atribuição POR ORDEM DE AÇÃO: qualquer botão associa -> 1º controle a agir -> 1º jogador sem pad
          const anyEdge = edge('jump') || edge('run') || edge('swap') || edge('especial') || startEdge || edge('left') || edge('right') || edge('up') || edge('down');
          if (anyEdge) {
            const waitI = players.findIndex((p) => p && p.waiting);
            const free = waitI >= 0 ? waitI : players.findIndex((p) => p && p.pad < 0 && !p.quit);
            if (free >= 0) {
              players[free].pad = gi;
              if (players[free].waiting) { players[free].waiting = false; ctx.clearWaitingBadge(free); }
              ctx.srSay(t('sr.pad.assigned', { n: free + 1 }));
            } else { ctx.joinPlayer(gi); }
          }
        } else if (players[owner].quit) {
          if (startEdge) ctx.respawnPlayer(owner); // tela abandonada -> recomeça SÓ ela
        } else {
          const p = players[owner];
          if (pauseEdge) { ctx.setPhase('paused'); ctx.setPauseActor(owner); continue; } // START pausa (todos pausam; cada tela navega a sua)
          if (p.quiz) { // o pad navega o quiz do PRÓPRIO jogador (o jogo dos outros segue)
            if (p.quiz.kind === 'braille') {
              if (edge('up')) ctx.announceBraille(p); else if (edge('jump')) ctx.quizConfirm(p);
              continue;
            }
            if (edge('left')) ctx.quizMove(p, -1); else if (edge('right')) ctx.quizMove(p, 1);
            else if (edge('up')) ctx.quizMove(p, -3); else if (edge('down')) ctx.quizMove(p, 3);
            else if (edge('jump')) ctx.quizConfirm(p);
            else if (edge('especial')) ctx.quizErase(p); // ESPECIAL = apagar última sílaba/letra
            continue;
          }
          // A tabela e a guarda do Fácil vêm de input/edges.ts, as MESMAS que keydown e touch usam. Antes eram
          // seis `if` à mão aqui, seis lá e seis no toque — e o do toque tinha esquecido o `!p.easy`.
          for (const [act, flag] of EDGE_BY_ACTION) {
            if (edgeAllowed(act, p.easy) && edge(act)) p[flag] = true;
          }
        }
      }
    }
  }

  return { pollPads, openPadWiz, openPadWizFor, closePadWiz, padWizTick, padMapFor, getPadWiz: () => padWiz };
}
