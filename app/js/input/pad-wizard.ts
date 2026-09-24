// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pad-wizard — the gamepad MAPPING WIZARD, apart from any game (issue #182).
//
// The Dev listed «mapear controle» in the motor panel (ADR-0151 §2). The wizard lived inside `initGamepad`, which a cartridge
// starts — two of seven games — and drew the platformer's sprites as its demonstration; `createGame` could not offer it
// without describing that game. Here is only what every game shares: the steps, one per position the GAME names, reading a
// button or an axis against the pad at rest, and the stored map per pad id. The demonstration and what happens around closing
// (the play phase, the edges of the held button) are the host's, by hooks.
//
// ⚠️ ONE CACHE of stored maps for the whole page: a map saved by the engine's wizard is the one `initGamepad` reads on the next
// frame, not a copy it cached before.
import { t } from '../core/i18n.js';
import { migrateControlMap } from './vocabulary-migration.js';
import type { Store } from '../platform/storage.js';

// ⚠️ THE SHAPES ARE WRITTEN HERE, not imported from `input/gamepad`: gamepad imports this module, and a type import back would
// close a cycle in the module graph (`step-5-batches-leaf-first`). They are the same shapes, structurally — `initGamepad` passes its
// own values straight in and returns this wizard's state as its `WizState`.
interface PadLike {
  readonly id: string;
  readonly index: number;
  readonly buttons: readonly ({ pressed: boolean } | null | undefined)[];
  readonly axes: readonly number[];
}
type GetGamepads = () => readonly (PadLike | null | undefined)[] | null | undefined;
interface PadBinding { b?: number; ax?: number; s?: number; av?: number; v?: number; }
type PadMap = Record<string, PadBinding | boolean | undefined>;
/** This pad's resting pose: which buttons were already down and where each axis rested. */
interface Baseline { b: boolean[]; a: number[] }
interface WizState {
  gi: number;
  id: string;
  step: number;
  base: Baseline | null;
  map: PadMap;
  release: boolean;
  baseWait: boolean;
  axTrack: { i: number; v: number; last: number; changes: number; ticks: number } | null;
  timer: ReturnType<typeof setInterval> | null;
}

export const PADWIZ_ORDER: readonly string[] = [
  // Directions first: they are what the child finds without thinking, and getting all four right gives confidence for
  // the other ten.
  'up', 'down', 'left', 'right',
  // The diamond, in the order the finger walks it in this project (ADR-0086 §2).
  'action2', 'action1', 'action4', 'action3',
  // The four shoulders: the wizard exists FOR pads that are not "standard" — generic, adapted, one-handed — and a game
  // that declares `leftShoulder` needs a way for the child to map it.
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
  // System last: `start` and `select` are usually the smallest and most hidden buttons.
  'start', 'select',
];

/** What this module reads and writes the maps through: the page's store, built by the root (ADR-0232, issue #207). */
export type PadMapStore = Pick<Store, 'getJSON' | 'setJSON'>;

const KEY = (id: string): string => 'incl_padmap_' + id;
const maps = new Map<string, PadMap | null>();

/**
 * The stored map of pad `id`, or `null`. Read through the vocabulary translator: a map saved before ADR-0086 has the old
 * action keys, and a custom pad would otherwise stop answering with no word said.
 */
export function padMap(store: PadMapStore, id: string): PadMap | null {
  if (!maps.has(id)) maps.set(id, migrateControlMap(store.getJSON<PadMap>(KEY(id), null)));
  return maps.get(id) ?? null;
}
/** Stores the map of pad `id` and makes it the one read from now on. */
function storePadMap(store: PadMapStore, id: string, map: PadMap): void {
  store.setJSON(KEY(id), map);
  maps.set(id, map);
}
/** A cancelled wizard: the DEFAULT map for this session, not stored, so the wizard does not reopen in a loop. */
function skipInSession(id: string): void {
  if (!maps.get(id)) maps.set(id, { _skip: true });
}

export interface PadWizardCtx {
  /** Where the finished map is stored — the page's store (ADR-0232). Required: a wizard that saved nowhere would ask the
   *  child the fourteen questions again at every visit, in silence. */
  store: PadMapStore;
  getGamepads: GetGamepads;
  /** The position's name in the GAME's word and the language of now; `null` = the game does not use it (the step is skipped). */
  actionLabel: (action: string) => string | null;
  /** Shows and says the wizard's sentence. */
  say: (phrase: string) => void;
  /** Shows what is mapped so far. */
  progress: (text: string) => void;
  srAlert: (phrase: string) => void;
  /** The step that starts (`null` while waiting for a pad) — the host's demonstration, when it has one. */
  onStep?: (action: string | null) => void;
  /** Every tick while open — the host's animation, when it has one. */
  onTick?: () => void;
  /** After closing: the pad index mapped (-1 if none was identified) and whether the map was saved. */
  onClose?: (gi: number, saved: boolean) => void;
}

export interface PadWizard {
  /** Opens waiting for any pad to press a button. */
  open(): void;
  /** Opens for a pad already identified. */
  openFor(gp: PadLike): void;
  close(save: boolean): void;
  tick(): void;
  state(): WizState | null;
}

export function createPadWizard(ctx: PadWizardCtx): PadWizard {
  let padWiz: WizState | null = null;

  /**
   * Walks to the next step THIS game uses, or closes if there is none left. ONE function: after the last named step the
   * wizard does not stay open pointing at a position the game does not use.
   */
  function advance(): void {
    if (!padWiz) return;
    while (padWiz.step < PADWIZ_ORDER.length && !ctx.actionLabel(PADWIZ_ORDER[padWiz.step]!)) padWiz.step++;
    if (padWiz.step >= PADWIZ_ORDER.length) closeWizard(true);
  }
  function ask(): void {
    if (!padWiz) return;
    advance();
    if (!padWiz) return; // it closed while advancing
    const action = PADWIZ_ORDER[padWiz.step]!;
    ctx.say(t('pad.wiz.step', { n: padWiz.step + 1, total: PADWIZ_ORDER.length, acao: ctx.actionLabel(action)! }));
    ctx.onStep?.(action);
    // The empty list's dash stays raw on purpose: it is punctuation, not language.
    ctx.progress(t('pad.wiz.mapped', { lista: Object.keys(padWiz.map).join(' · ') || '—' }));
  }
  function wire(bd: PadBinding): void {
    if (!padWiz) return;
    padWiz.map[PADWIZ_ORDER[padWiz.step]!] = bd;
    padWiz.step++;
    padWiz.release = true; // requires letting go before the next step
    advance();
  }

  function begin(gi: number, id: string, phrase: string): void {
    padWiz = { gi, id, step: -1, base: null, map: {}, release: false, baseWait: gi >= 0, axTrack: null, timer: null };
    ctx.say(phrase);
    ctx.onStep?.(null);
    ctx.progress('');
    padWiz.timer = setInterval(tickWizard, 30);
  }
  function openAny(): void { begin(-1, '', t('pad.wiz.pressAny')); }
  function openForPad(gp: PadLike): void { begin(gp.index, gp.id, t('pad.wiz.detected', { id: gp.id })); }

  function closeWizard(save: boolean): void {
    if (!padWiz) return;
    if (padWiz.timer != null) clearInterval(padWiz.timer);
    if (save && padWiz.id) {
      storePadMap(ctx.store, padWiz.id, padWiz.map);
      ctx.srAlert(t('sr.pad.mapSaved', { id: padWiz.id }));
    } else if (padWiz.id) {
      skipInSession(padWiz.id);
    }
    const gi = padWiz.gi;
    const saved = save && !!padWiz.id;
    padWiz = null;
    ctx.onClose?.(gi, saved);
  }

  /* ===================== the five moments of a frame =====================
   *
   * 🔴 This is a STATE MACHINE, and the order below is what it is: no pad adopted · waiting for the resting pose ·
   * waiting for the hand to let go · an axis under watch · reading what moved. Each moment is a function named for what
   * it waits for, and `tickWizard` is their list.
   *
   * ⚠️ AND IT IS NOT A TABLE, unlike `input/keydown`'s chain, because the moments are not symmetric: the first runs
   * WITHOUT a pad in hand (it is the one that picks it) and the other four need one. A list of equal rows would have to
   * pretend the first receives what does not exist yet.
   *
   * 📌 Each moment receives the state instead of reaching for it, which is what lets them be read one at a time — and
   * what removes the non-null assertions a closure looking at `padWiz` would need.
   */

  /** 1 · No pad adopted: the FIRST button pressed on any pad picks the pad the hand is holding. */
  function adoptTheHandsPad(w: WizState, pads: readonly (PadLike | null | undefined)[]): void {
    for (const gp of pads) {
      if (gp && gp.buttons.some((b) => b && b.pressed)) {
        w.gi = gp.index; w.id = gp.id; w.baseWait = true;
        ctx.say(t('pad.wiz.releaseAll', { id: gp.id }));
        break;
      }
    }
  }

  /** 2 · This pad's RESTING pose, measured on the one frame in which nothing is pressed. */
  function takeTheRestingPose(w: WizState, gp: PadLike): void {
    if (gp.buttons.some((b) => b && b.pressed)) return;
    w.baseWait = false;
    w.base = { b: gp.buttons.map((x) => !!(x && x.pressed)), a: gp.axes.slice() };
    w.step = 0;
    ask();
  }

  /** 3 · The hand has to LET GO before the next question — and letting go has two halves, the buttons and the axes. */
  function waitForTheHandToLetGo(w: WizState, gp: PadLike, base: Baseline): void {
    const idle = !gp.buttons.some((b, i) => b && b.pressed && !base.b[i]) && gp.axes.every((v, i) => Math.abs((v || 0) - base.a[i]!) < 0.35);
    if (idle) { w.release = false; ask(); }
  }

  /**
   * 4 · An axis under watch (~240 ms): classified by BEHAVIOUR — varies continuously = analogue (threshold by sign);
   * jumps and STAYS CONSTANT = a D-pad/POV hat (exact value, ±0.13).
   */
  function classifyTheWatchedAxis(w: WizState, gp: PadLike, base: Baseline): void {
    const tr = w.axTrack!; const v = gp.axes[tr.i] || 0;
    if (Math.abs(v - tr.last) > 0.03) tr.changes++;
    tr.last = v;
    if (Math.abs(v - base.a[tr.i]!) > Math.abs(tr.v - base.a[tr.i]!)) tr.v = v;
    if (++tr.ticks < 8) return;
    const pv = tr.v; w.axTrack = null;
    wire(tr.changes >= 2 ? { ax: tr.i, s: pv > 0 ? 1 : -1 } : { av: tr.i, v: Math.round(pv * 10000) / 10000 });
  }

  /** 5 · What moved since rest: a button first, and only then an axis that really left. */
  function readWhatMoved(w: WizState, gp: PadLike, base: Baseline): void {
    for (let i = 0; i < gp.buttons.length; i++) {
      if (gp.buttons[i] && gp.buttons[i]!.pressed && !base.b[i]) { wire({ b: i }); return; }
    }
    for (let i = 0; i < gp.axes.length; i++) {
      const v = gp.axes[i] || 0;
      if (Math.abs(v - base.a[i]!) > 0.45) { w.axTrack = { i, v, last: v, changes: 0, ticks: 0 }; return; }
    }
  }

  function tickWizard(): void {
    if (!padWiz) return;
    ctx.onTick?.();
    const pads = ctx.getGamepads() ?? [];
    if (padWiz.gi < 0) { adoptTheHandsPad(padWiz, pads); return; }
    const gp = pads[padWiz.gi];
    if (!gp) return; // pad disconnected (or its index not populated yet): freezes until it comes back
    if (padWiz.baseWait) { takeTheRestingPose(padWiz, gp); return; }
    const base = padWiz.base!;
    if (padWiz.release) { waitForTheHandToLetGo(padWiz, gp, base); return; }
    if (padWiz.axTrack) { classifyTheWatchedAxis(padWiz, gp, base); return; }
    readWhatMoved(padWiz, gp, base);
  }

  return { open: openAny, openFor: openForPad, close: closeWizard, tick: tickWizard, state: () => padWiz };
}
