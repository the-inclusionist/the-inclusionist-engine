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
/** A pose de repouso deste controle: que botões já estavam em baixo e onde cada eixo descansava. */
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
  actionLabel: (acao: string) => string | null;
  /** Shows and says the wizard's sentence. */
  say: (phrase: string) => void;
  /** Shows what is mapped so far. */
  progress: (texto: string) => void;
  srAlert: (phrase: string) => void;
  /** The step that starts (`null` while waiting for a pad) — the host's demonstration, when it has one. */
  onStep?: (acao: string | null) => void;
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
   * Anda até o próximo passo que ESTE jogo usa, ou fecha se não houver mais. UMA função: depois do último passo nomeado o
   * assistente não fica aberto a apontar para uma posição que o jogo não usa.
   */
  function advance(): void {
    if (!padWiz) return;
    while (padWiz.step < PADWIZ_ORDER.length && !ctx.actionLabel(PADWIZ_ORDER[padWiz.step]!)) padWiz.step++;
    if (padWiz.step >= PADWIZ_ORDER.length) closeWizard(true);
  }
  function ask(): void {
    if (!padWiz) return;
    advance();
    if (!padWiz) return; // fechou ao avançar
    const acao = PADWIZ_ORDER[padWiz.step]!;
    ctx.say(t('pad.wiz.step', { n: padWiz.step + 1, total: PADWIZ_ORDER.length, acao: ctx.actionLabel(acao)! }));
    ctx.onStep?.(acao);
    // O travessão da lista vazia fica cru de propósito: é pontuação, não idioma.
    ctx.progress(t('pad.wiz.mapped', { lista: Object.keys(padWiz.map).join(' · ') || '—' }));
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
      storePadMap(padWiz.id, padWiz.map);
      ctx.srAlert(t('sr.pad.mapSaved', { id: padWiz.id }));
    } else if (padWiz.id) {
      skipInSession(padWiz.id);
    }
    const gi = padWiz.gi;
    const saved = save && !!padWiz.id;
    padWiz = null;
    ctx.onClose?.(gi, saved);
  }

  /* ===================== os cinco momentos de um quadro =====================
   *
   * 🔴 Este é um AUTÓMATO, e a ordem abaixo é o que ele é: sem controle adoptado · à espera da pose de repouso · à
   * espera de a mão largar · com um eixo em observação · a ler o que mexeu. Cada momento é uma função com o nome do
   * que ele espera, e o `tickWizard` é a lista deles.
   *
   * ⚠️ E NÃO É UMA TABELA, ao contrário da cadeia do `input/keydown`, porque os momentos não são simétricos: o
   * primeiro corre SEM um controle na mão (é ele que o escolhe) e os outros quatro precisam de um. Uma lista de
   * linhas iguais teria de fingir que o primeiro recebe o que ainda não existe.
   *
   * 📌 Cada momento recebe o estado em vez de o alcançar, o que é o que permite lê-los um a um — e o que tira as
   * asserções de não-nulo que um fecho a olhar para `padWiz` obrigaria.
   */

  /** 1 · Nenhum controle adoptado: a PRIMEIRA tecla premida de qualquer pad escolhe o pad que a mão segura. */
  function adoptTheHandsPad(w: WizState, pads: readonly (PadLike | null | undefined)[]): void {
    for (const gp of pads) {
      if (gp && gp.buttons.some((b) => b && b.pressed)) {
        w.gi = gp.index; w.id = gp.id; w.baseWait = true;
        ctx.say(t('pad.wiz.releaseAll', { id: gp.id }));
        break;
      }
    }
  }

  /** 2 · A pose de REPOUSO deste controle, medida no único quadro em que nada está premido. */
  function takeTheRestingPose(w: WizState, gp: PadLike): void {
    if (gp.buttons.some((b) => b && b.pressed)) return;
    w.baseWait = false;
    w.base = { b: gp.buttons.map((x) => !!(x && x.pressed)), a: gp.axes.slice() };
    w.step = 0;
    ask();
  }

  /** 3 · A mão tem de LARGAR antes da pergunta seguinte — e largar são duas metades, os botões e os eixos. */
  function waitForTheHandToLetGo(w: WizState, gp: PadLike, base: Baseline): void {
    const idle = !gp.buttons.some((b, i) => b && b.pressed && !base.b[i]) && gp.axes.every((v, i) => Math.abs((v || 0) - base.a[i]!) < 0.35);
    if (idle) { w.release = false; ask(); }
  }

  /**
   * 4 · Eixo em rastreio (~240 ms): classifica pelo COMPORTAMENTO — varia continuamente = analógico (limiar por
   * sinal); salta e FICA CONSTANTE = D-pad/POV hat (valor exato, ±0.13).
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

  /** 5 · O que mexeu desde o repouso: um botão primeiro, e só depois um eixo que tenha saído de verdade. */
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
    if (!gp) return; // controle desconectado (ou índice ainda não populado): congela até voltar
    if (padWiz.baseWait) { takeTheRestingPose(padWiz, gp); return; }
    const base = padWiz.base!;
    if (padWiz.release) { waitForTheHandToLetGo(padWiz, gp, base); return; }
    if (padWiz.axTrack) { classifyTheWatchedAxis(padWiz, gp, base); return; }
    readWhatMoved(padWiz, gp, base);
  }

  return { open: openAny, openFor: openForPad, close: closeWizard, tick: tickWizard, state: () => padWiz };
}
