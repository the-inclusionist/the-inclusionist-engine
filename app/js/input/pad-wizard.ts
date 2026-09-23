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
import * as store from '../platform/storage.js';

// ⚠️ THE SHAPES ARE WRITTEN HERE, not imported from `input/gamepad`: gamepad imports this module, and a type import back would
// close a cycle in the module graph (`lotes-passo5`). They are the same shapes, structurally — `initGamepad` passes its
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
interface WizState {
  gi: number;
  id: string;
  step: number;
  base: { b: boolean[]; a: number[] } | null;
  map: PadMap;
  release: boolean;
  baseWait: boolean;
  axTrack: { i: number; v: number; last: number; changes: number; ticks: number } | null;
  timer: ReturnType<typeof setInterval> | null;
}

export const PADWIZ_ORDER: readonly string[] = [
  // Direções primeiro: são o que a criança encontra sem pensar, e acertar as quatro dá confiança para as
  // outras dez.
  'up', 'down', 'left', 'right',
  // O losango, na ordem em que o dedo o percorre neste projeto (ADR-0086 §2).
  'action2', 'action1', 'action4', 'action3',
  // Os quatro ombros: o assistente existe PARA controles que não são «standard» — genéricos, adaptados, de uma mão —, e
  // um jogo que declare `leftShoulder` precisa de por onde a criança o mapear.
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
  // Sistema por último: `start` e `select` costumam ser os botões mais pequenos e mais escondidos.
  'start', 'select',
];

const KEY = (id: string): string => 'incl_padmap_' + id;
const maps = new Map<string, PadMap | null>();

/**
 * The stored map of pad `id`, or `null`. Read through the vocabulary translator: a map saved before ADR-0086 has the old
 * action keys, and a custom pad would otherwise stop answering with no word said.
 */
export function padMap(id: string): PadMap | null {
  if (!maps.has(id)) maps.set(id, migrateControlMap(store.getJSON<PadMap>(KEY(id), null)));
  return maps.get(id) ?? null;
}
/** Stores the map of pad `id` and makes it the one read from now on. */
function storePadMap(id: string, map: PadMap): void {
  store.setJSON(KEY(id), map);
  maps.set(id, map);
}
/** A cancelled wizard: the DEFAULT map for this session, not stored, so the wizard does not reopen in a loop. */
function skipInSession(id: string): void {
  if (!maps.get(id)) maps.set(id, { _skip: true });
}

export interface PadWizardCtx {
  getGamepads: GetGamepads;
  /** The position's name in the GAME's word and the language of now; `null` = the game does not use it (the step is skipped). */
  rotuloDaAcao: (acao: string) => string | null;
  /** Shows and says the wizard's sentence. */
  dizer: (phrase: string) => void;
  /** Shows what is mapped so far. */
  progresso: (texto: string) => void;
  srAlert: (phrase: string) => void;
  /** The step that starts (`null` while waiting for a pad) — the host's demonstration, when it has one. */
  aoPasso?: (acao: string | null) => void;
  /** Every tick while open — the host's animation, when it has one. */
  aoTique?: () => void;
  /** After closing: the pad index mapped (-1 if none was identified) and whether the map was saved. */
  aoFechar?: (gi: number, saved: boolean) => void;
}

export interface PadWizard {
  /** Opens waiting for any pad to press a button. */
  abrir(): void;
  /** Opens for a pad already identified. */
  abrirPara(gp: PadLike): void;
  fechar(save: boolean): void;
  tique(): void;
  estado(): WizState | null;
}

export function createPadWizard(ctx: PadWizardCtx): PadWizard {
  let padWiz: WizState | null = null;

  /**
   * Anda até o próximo passo que ESTE jogo usa, ou fecha se não houver mais. UMA função: depois do último passo nomeado o
   * assistente não fica aberto a apontar para uma posição que o jogo não usa.
   */
  function advance(): void {
    if (!padWiz) return;
    while (padWiz.step < PADWIZ_ORDER.length && !ctx.rotuloDaAcao(PADWIZ_ORDER[padWiz.step]!)) padWiz.step++;
    if (padWiz.step >= PADWIZ_ORDER.length) fechar(true);
  }
  function ask(): void {
    if (!padWiz) return;
    advance();
    if (!padWiz) return; // fechou ao avançar
    const acao = PADWIZ_ORDER[padWiz.step]!;
    ctx.dizer(t('pad.wiz.step', { n: padWiz.step + 1, total: PADWIZ_ORDER.length, acao: ctx.rotuloDaAcao(acao)! }));
    ctx.aoPasso?.(acao);
    // O travessão da lista vazia fica cru de propósito: é pontuação, não idioma.
    ctx.progresso(t('pad.wiz.mapped', { lista: Object.keys(padWiz.map).join(' · ') || '—' }));
  }
  function wire(bd: PadBinding): void {
    if (!padWiz) return;
    padWiz.map[PADWIZ_ORDER[padWiz.step]!] = bd;
    padWiz.step++;
    padWiz.release = true; // exige soltar antes do próximo passo
    advance();
  }

  function begin(gi: number, id: string, phrase: string): void {
    padWiz = { gi, id, step: -1, base: null, map: {}, release: false, baseWait: gi >= 0, axTrack: null, timer: null };
    ctx.dizer(phrase);
    ctx.aoPasso?.(null);
    ctx.progresso('');
    padWiz.timer = setInterval(tique, 30);
  }
  function abrir(): void { begin(-1, '', t('pad.wiz.pressAny')); }
  function abrirPara(gp: PadLike): void { begin(gp.index, gp.id, t('pad.wiz.detected', { id: gp.id })); }

  function fechar(save: boolean): void {
    if (!padWiz) return;
    if (padWiz.timer != null) clearInterval(padWiz.timer);
    if (save && padWiz.id) {
      storePadMap(padWiz.id, padWiz.map);
      ctx.srAlert(t('sr.pad.mapSaved', { id: padWiz.id }));
    } else if (padWiz.id) {
      skipInSession(padWiz.id);
    }
    const gi = padWiz.gi;
    const saved = save && !!padWiz.id;
    padWiz = null;
    ctx.aoFechar?.(gi, saved);
  }

  function tique(): void {
    if (!padWiz) return;
    ctx.aoTique?.();
    const pads = ctx.getGamepads() ?? [];
    if (padWiz.gi < 0) {
      for (const gp of pads) {
        if (gp && gp.buttons.some((b) => b && b.pressed)) {
          padWiz.gi = gp.index; padWiz.id = gp.id; padWiz.baseWait = true;
          ctx.dizer(t('pad.wiz.releaseAll', { id: gp.id }));
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
        ask();
      }
      return;
    }
    const base = padWiz.base!;
    if (padWiz.release) {
      const idle = !gp.buttons.some((b, i) => b && b.pressed && !base.b[i]) && gp.axes.every((v, i) => Math.abs((v || 0) - base.a[i]!) < 0.35);
      if (idle) { padWiz.release = false; ask(); }
      return;
    }
    // eixo em rastreio (~240ms): classifica pelo COMPORTAMENTO — varia continuamente = analógico (limiar por sinal);
    // salta e FICA CONSTANTE = D-pad/POV hat (valor exato, ±0.13).
    if (padWiz.axTrack) {
      const tr = padWiz.axTrack; const v = gp.axes[tr.i] || 0;
      if (Math.abs(v - tr.last) > 0.03) tr.changes++;
      tr.last = v;
      if (Math.abs(v - base.a[tr.i]!) > Math.abs(tr.v - base.a[tr.i]!)) tr.v = v;
      if (++tr.ticks >= 8) {
        const pv = tr.v; padWiz.axTrack = null;
        wire(tr.changes >= 2 ? { ax: tr.i, s: pv > 0 ? 1 : -1 } : { av: tr.i, v: Math.round(pv * 10000) / 10000 });
      }
      return;
    }
    for (let i = 0; i < gp.buttons.length; i++) {
      if (gp.buttons[i] && gp.buttons[i]!.pressed && !base.b[i]) { wire({ b: i }); return; }
    }
    for (let i = 0; i < gp.axes.length; i++) {
      const v = gp.axes[i] || 0;
      if (Math.abs(v - base.a[i]!) > 0.45) { padWiz.axTrack = { i, v, last: v, changes: 0, ticks: 0 }; return; }
    }
  }

  return { abrir, abrirPara, fechar, tique, estado: () => padWiz };
}
